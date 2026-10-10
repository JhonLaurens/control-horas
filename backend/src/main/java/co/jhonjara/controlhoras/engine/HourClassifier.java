package co.jhonjara.controlhoras.engine;

import java.time.*;
import java.util.*;

/**
 * Clasifica el tiempo trabajado en las 8 categorías (ordinaria/extra/dominical-festivo/sábado-descanso,
 * cada una diurna o nocturna). Es la fuente de verdad del backend y replica exactamente la lógica del frontend.
 *
 * <ul>
 *   <li>Cada sesión se divide primero por día calendario (un festivo/domingo solo afecta su propio día).</li>
 *   <li>Días no laborales (festivo, domingo, sábado o día no marcado): todo es extra dominical/festivo o sábado/descanso.</li>
 *   <li>Días laborales: dentro del horario es ordinaria hasta completar la jornada (horario − almuerzo); el resto es extra.</li>
 *   <li>Diurna/nocturna según la ventana nocturna del día (inicio legal por fecha o personalizado, fin 06:00 por defecto).</li>
 * </ul>
 */
public final class HourClassifier {

    public record Pause(long start, Long end) {}

    public record Session(String id, long start, Long end, List<Pause> pauses, boolean extra) {
        public long endOr(long now) {
            return end != null ? end : now;
        }
    }

    public record DayInfo(LocalDate date, int dow, String festivo, boolean working, String kind) {}

    public record DayResult(DayInfo info, long goal, Breakdown total, long pause, long lunchOver,
                            Map<String, Breakdown> perSession) {}

    private final Schedule schedule;
    private final ZoneId zone;
    private final long now;
    private final List<Session> sessions;
    private final Map<LocalDate, DayResult> cache = new HashMap<>();

    public HourClassifier(Schedule schedule, ZoneId zone, List<Session> sessions, long now) {
        this.schedule = schedule;
        this.zone = zone;
        this.now = now;
        this.sessions = sessions.stream().sorted(Comparator.comparingLong(Session::start)).toList();
    }

    public Schedule schedule() {
        return schedule;
    }

    public long at(LocalDate d, LocalTime t) {
        return d.atTime(t).atZone(zone).toInstant().toEpochMilli();
    }

    public long dayStart(LocalDate d) {
        return d.atStartOfDay(zone).toInstant().toEpochMilli();
    }

    public LocalDate dateOf(long t) {
        return Instant.ofEpochMilli(t).atZone(zone).toLocalDate();
    }

    public DayInfo dayInfo(LocalDate d) {
        int dow = d.getDayOfWeek().getValue() % 7; // 0 = domingo
        String fest = Holidays.nameOf(d).orElse(null);
        boolean working = fest == null && schedule.workdays().contains(dow);
        String kind = fest != null ? "fest" : working ? "lab" : dow == 0 ? "dom" : dow == 6 ? "sab" : "desc";
        return new DayInfo(d, dow, fest, working, kind);
    }

    static long overlap(long a, long b, long c, long d) {
        return Math.max(0, Math.min(b, d) - Math.max(a, c));
    }

    /** Intervalos efectivamente trabajados (sesión menos pausas). */
    List<long[]> workIntervals(Session s) {
        long e = s.endOr(now), cur = s.start();
        List<long[]> ps = new ArrayList<>();
        for (Pause p : s.pauses()) {
            long a = Math.max(p.start(), s.start()), b = Math.min(p.end() != null ? p.end() : e, e);
            if (b > a) ps.add(new long[]{a, b});
        }
        ps.sort(Comparator.comparingLong(x -> x[0]));
        List<long[]> out = new ArrayList<>();
        for (long[] p : ps) {
            if (p[0] > cur) out.add(new long[]{cur, p[0]});
            cur = Math.max(cur, p[1]);
        }
        if (e > cur) out.add(new long[]{cur, e});
        return out;
    }

    long pauseIn(Session s, long from, long to) {
        long e = s.endOr(now), t = 0;
        for (Pause p : s.pauses()) {
            long pe = p.end() != null ? p.end() : e;
            t += overlap(Math.max(p.start(), s.start()), Math.min(pe, e), from, to);
        }
        return t;
    }

    public DayResult day(LocalDate d) {
        return cache.computeIfAbsent(d, this::computeDay);
    }

    private DayResult computeDay(LocalDate d) {
        long d0 = dayStart(d), d1 = dayStart(d.plusDays(1));
        DayInfo info = dayInfo(d);
        long goal = info.working() ? schedule.dailyGoalMs() : 0;
        long w0 = at(d, schedule.schedStart()), w1 = at(d, schedule.schedEnd());
        long[][] night = {{d0, at(d, schedule.nightEnd())}, {at(d, schedule.nightStartFor(d)), d1}};

        Map<String, Breakdown> per = new LinkedHashMap<>();
        record Piece(Session s, long a, long b) {}
        List<Piece> pieces = new ArrayList<>();
        long pause = 0;
        for (Session s : sessions) {
            if (!(s.start() < d1 && s.endOr(now) > d0)) continue;
            per.put(s.id(), new Breakdown());
            pause += pauseIn(s, d0, d1);
            for (long[] iv : workIntervals(s)) {
                long a = Math.max(iv[0], d0), b = Math.min(iv[1], d1);
                if (b > a) pieces.add(new Piece(s, a, b));
            }
        }
        pieces.sort(Comparator.comparingLong(Piece::a));
        long used = 0;
        for (Piece p : pieces) {
            Breakdown B = per.get(p.s().id());
            B.addWork(p.b() - p.a());
            if (!info.working()) {
                boolean df = info.kind().equals("fest") || info.kind().equals("dom");
                split(B, df ? Category.fD : Category.sD, df ? Category.fN : Category.sN, p.a(), p.b(), night);
                continue;
            }
            if (p.s().extra()) {
                split(B, Category.eD, Category.eN, p.a(), p.b(), night);
                continue;
            }
            long a0 = Math.max(p.a(), w0), a1 = Math.min(p.b(), w1);
            if (a1 > a0) {
                long take = Math.min(a1 - a0, Math.max(0, goal - used));
                used += take;
                split(B, Category.oD, Category.oN, a0, a0 + take, night);
                split(B, Category.eD, Category.eN, a0 + take, a1, night);
            }
            split(B, Category.eD, Category.eN, p.a(), Math.min(p.b(), w0), night);
            split(B, Category.eD, Category.eN, Math.max(p.a(), w1), p.b(), night);
        }
        Breakdown total = new Breakdown();
        per.values().forEach(total::addAll);
        long lunchOver = info.working() ? Math.max(0, pause - schedule.lunchMs()) : 0;
        return new DayResult(info, goal, total, pause, lunchOver, per);
    }

    private static void split(Breakdown B, Category day, Category nightCat, long a, long b, long[][] night) {
        if (b <= a) return;
        long n = 0;
        for (long[] w : night) n += overlap(a, b, w[0], w[1]);
        B.add(nightCat, n);
        B.add(day, b - a - n);
    }

    /** Desglose de una sesión sumando todos los días que toca. */
    public Breakdown session(Session s) {
        Breakdown t = new Breakdown();
        for (LocalDate d = dateOf(s.start()); dayStart(d) < s.endOr(now); d = d.plusDays(1)) {
            Breakdown p = day(d).perSession().get(s.id());
            if (p != null) t.addAll(p);
        }
        return t;
    }

    /** Totales de un rango de días [from, to). */
    public Breakdown range(LocalDate from, LocalDate toExclusive) {
        Breakdown t = new Breakdown();
        for (LocalDate d = from; d.isBefore(toExclusive); d = d.plusDays(1)) t.addAll(day(d).total());
        return t;
    }
}
