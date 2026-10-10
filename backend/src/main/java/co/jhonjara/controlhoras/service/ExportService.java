package co.jhonjara.controlhoras.service;

import co.jhonjara.controlhoras.engine.*;
import co.jhonjara.controlhoras.web.Dtos.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Exportación CSV/JSON e importación del respaldo JSON generado por la versión HTML. */
@Service
public class ExportService {
    private static final long H = 3_600_000L, M = 60_000L;
    private static final Pattern HM = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final Pattern ID = Pattern.compile("^[A-Za-z0-9_-]{1,40}$");
    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    private final SummaryService summary;
    private final SessionService sessions;
    private final SettingsService settings;

    public ExportService(SummaryService summary, SessionService sessions, SettingsService settings) {
        this.summary = summary;
        this.sessions = sessions;
        this.settings = settings;
    }

    static String dec(long ms) {
        return String.format(Locale.ROOT, "%.2f", ms / (double) H).replace('.', ',');
    }

    static String hhmm(long ms) {
        long s = Math.max(0, ms) / 1000;
        return String.format(Locale.ROOT, "%02d:%02d", s / 3600, (s % 3600) / 60);
    }

    static String cell(String v) {
        if (v == null) return "";
        return v.matches("(?s).*[;\"\\n\\r].*") ? "\"" + v.replace("\"", "\"\"") + "\"" : v;
    }

    /** CSV compatible con Excel en español (separador ';', coma decimal y BOM UTF-8). */
    public String csv(LocalDate from, LocalDate to, String q) {
        HourClassifier c = summary.classifier();
        ZoneId z = summary.zone();
        long a = from == null ? Long.MIN_VALUE : from.atStartOfDay(z).toInstant().toEpochMilli();
        long b = to == null ? Long.MAX_VALUE : to.plusDays(1).atStartOfDay(z).toInstant().toEpochMilli();
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        long now = Instant.now().toEpochMilli();
        List<SessionDto> rows = new ArrayList<>(sessions.all());
        rows.removeIf(s -> !(s.start() < b && (s.end() == null ? now : s.end()) > a));
        rows.removeIf(s -> !query.isEmpty() && !s.note().toLowerCase(Locale.ROOT).contains(query) && !s.tag().toLowerCase(Locale.ROOT).contains(query));
        rows.sort(Comparator.comparingLong(SessionDto::start));

        List<String> head = new ArrayList<>(List.of("Fecha inicio", "Hora inicio", "Fecha fin", "Hora fin", "Trabajado (hh:mm)", "Horas trabajadas", "Horas ordinarias", "Horas extra"));
        for (Category k : Category.values()) head.add(k.label);
        head.addAll(List.of("Inicio nocturna aplicado", "Tipo", "Festivo", "Pausas (min)", "Marcada como extra", "Proyecto", "Nota"));
        StringBuilder sb = new StringBuilder("\uFEFF").append(String.join(";", head));
        Breakdown tot = new Breakdown();
        long totPause = 0;
        for (SessionDto s : rows) {
            HourClassifier.Session es = SessionService.toEngine(s);
            Breakdown br = c.session(es);
            tot.addAll(br);
            long end = es.endOr(now);
            ZonedDateTime zs = Instant.ofEpochMilli(s.start()).atZone(z), ze = Instant.ofEpochMilli(end).atZone(z);
            long pause = 0;
            for (PauseDto p : s.pauses()) pause += Math.max(0, Math.min(p.end() == null ? end : p.end(), end) - Math.max(p.start(), s.start()));
            totPause += pause;
            List<String> tipos = new ArrayList<>();
            for (Category k : Category.values()) if (br.get(k) >= M) tipos.add(k.label);
            Set<String> fest = new LinkedHashSet<>();
            for (LocalDate d = zs.toLocalDate(); !d.isAfter(ze.toLocalDate()); d = d.plusDays(1)) {
                if (d.atStartOfDay(z).toInstant().toEpochMilli() >= end) break;
                Holidays.nameOf(d).ifPresent(fest::add);
            }
            List<String> r = new ArrayList<>(List.of(zs.toLocalDate().toString(), zs.format(HHMM), ze.toLocalDate().toString(),
                    s.end() == null ? "en curso" : ze.format(HHMM), hhmm(br.work()), dec(br.work()), dec(br.ordinary()), dec(br.extra())));
            for (Category k : Category.values()) r.add(dec(br.get(k)));
            r.addAll(List.of(c.schedule().nightStartFor(zs.toLocalDate()).toString(), tipos.isEmpty() ? "—" : String.join(" + ", tipos),
                    String.join(" / ", fest), String.valueOf(Math.round(pause / (double) M)), s.extra() ? "Sí" : "No", s.tag(), s.note()));
            sb.append("\r\n").append(r.stream().map(ExportService::cell).collect(Collectors.joining(";")));
        }
        List<String> t = new ArrayList<>(List.of("TOTAL", "", "", "", hhmm(tot.work()), dec(tot.work()), dec(tot.ordinary()), dec(tot.extra())));
        for (Category k : Category.values()) t.add(dec(tot.get(k)));
        t.addAll(List.of("", "", "", String.valueOf(Math.round(totPause / (double) M)), "", "", ""));
        sb.append("\r\n").append(String.join(";", t));
        return sb.toString();
    }

    /** Respaldo con el mismo formato que la versión HTML (se puede volver a importar en ambas). */
    public Map<String, Object> backup() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("app", "ControlHoras");
        m.put("version", 3);
        m.put("exportado", Instant.now().toString());
        m.put("sessions", sessions.all().stream().filter(s -> s.end() != null).toList());
        m.put("active", sessions.active().orElse(null));
        m.put("settings", settings.get());
        return m;
    }

    /** Sin transacción global: cada sesión se guarda por separado y las inválidas se omiten. */
    public ImportResult importBackup(JsonNode d) {
        if (d == null || !d.path("sessions").isArray()) throw co.jhonjara.controlhoras.web.ApiException.badRequest("Archivo de respaldo no válido: falta la lista de sesiones");
        Set<String> ids = sessions.all().stream().map(SessionDto::id).collect(Collectors.toSet());
        int imported = 0, skipped = 0;
        for (JsonNode s : d.path("sessions")) {
            if (!s.path("start").isNumber() || !s.path("end").isNumber()) { skipped++; continue; }
            long a = s.path("start").asLong(), b = s.path("end").asLong();
            String id = s.path("id").asText("");
            if (b <= a || ids.contains(id)) { skipped++; continue; }
            if (!ID.matcher(id).matches()) id = SessionService.newId();
            List<PauseDto> ps = new ArrayList<>();
            for (JsonNode p : s.path("pauses")) {
                if (!p.path("start").isNumber() || !p.path("end").isNumber()) continue;
                long ps0 = Math.max(a, p.path("start").asLong()), ps1 = Math.min(b, p.path("end").asLong());
                if (ps1 >= ps0) ps.add(new PauseDto(ps0, ps1));
            }
            ps.sort(Comparator.comparingLong(PauseDto::start));
            List<PauseDto> clean = new ArrayList<>();
            long prev = a;
            for (PauseDto p : ps) if (p.start() >= prev) { clean.add(p); prev = p.end(); }
            try {
                sessions.create(new SessionInput(id, a, b, clean, cut(s.path("note").asText(""), 200), cut(s.path("tag").asText(""), 40), s.path("extra").asBoolean(false)), true);
                ids.add(id);
                imported++;
            } catch (RuntimeException e) {
                skipped++;
            }
        }
        boolean applied = false;
        JsonNode o = d.path("settings");
        if (o.isObject()) {
            SettingsDto cur = settings.get();
            String schedStart = hm(o, "schedStart", cur.schedStart()), schedEnd = hm(o, "schedEnd", cur.schedEnd());
            String nightEnd = hm(o, "nightEnd", cur.nightEnd());
            String nightStart = o.has("nightStart") ? (HM.matcher(o.path("nightStart").asText("")).matches() ? o.path("nightStart").asText() : null) : cur.nightStart();
            if ("19:00".equals(nightStart) && !o.path("nightCustom").asBoolean(false)) nightStart = null;
            int lunch = o.path("lunch").isNumber() && o.path("lunch").asInt() >= 0 && o.path("lunch").asInt() <= 240 ? o.path("lunch").asInt() : cur.lunch();
            List<Integer> wd = cur.workdays();
            if (o.path("workdays").isArray()) {
                List<Integer> l = new ArrayList<>();
                o.path("workdays").forEach(x -> { if (x.isInt() && x.asInt() >= 0 && x.asInt() <= 6) l.add(x.asInt()); });
                wd = l;
            }
            String theme = Set.of("dark", "light").contains(o.path("theme").asText()) ? o.path("theme").asText() : cur.theme();
            int accent = o.path("accent").isInt() && o.path("accent").asInt() >= 0 && o.path("accent").asInt() <= 6 ? o.path("accent").asInt() : cur.accent();
            String custom = o.path("customAccent").asText("").matches("^#[0-9a-fA-F]{6}$") ? o.path("customAccent").asText() : (o.has("customAccent") ? null : cur.customAccent());
            boolean hint = o.has("hint") ? o.path("hint").asBoolean(true) : cur.hint();
            try {
                settings.update(new SettingsDto(schedStart, schedEnd, lunch, nightStart, nightEnd, wd, theme, accent, custom, hint, cur.goalNotified(), cur.endNotified()));
                applied = true;
            } catch (RuntimeException e) {
                applied = false;
            }
        }
        boolean activeIgnored = d.path("active").isObject();
        return new ImportResult(imported, skipped, applied, activeIgnored);
    }

    private static String hm(JsonNode o, String k, String def) {
        String v = o.path(k).asText("");
        return HM.matcher(v).matches() ? v : def;
    }

    private static String cut(String s, int n) {
        return s.length() > n ? s.substring(0, n) : s;
    }
}
