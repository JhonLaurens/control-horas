package co.jhonjara.controlhoras.service;

import co.jhonjara.controlhoras.engine.Breakdown;
import co.jhonjara.controlhoras.engine.HourClassifier;
import co.jhonjara.controlhoras.engine.Schedule;
import co.jhonjara.controlhoras.web.Dtos.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

@Service
public class SummaryService {
    private final SessionService sessions;
    private final SettingsService settings;
    private final Clock clock;
    private final ZoneId zone;

    public SummaryService(SessionService sessions, SettingsService settings, Clock clock, @Value("${app.zone}") String zone) {
        this.sessions = sessions;
        this.settings = settings;
        this.clock = clock;
        this.zone = ZoneId.of(zone);
    }

    public ZoneId zone() { return zone; }

    public LocalDate today() { return LocalDate.now(clock.withZone(zone)); }

    /** Clasificador con todas las sesiones (incluida la activa). Un solo usuario: el volumen es pequeño. */
    public HourClassifier classifier() {
        Schedule sch = settings.schedule();
        List<HourClassifier.Session> all = Stream.concat(sessions.all().stream().filter(s -> s.end() != null), sessions.active().stream())
                .map(SessionService::toEngine).toList();
        return new HourClassifier(sch, zone, all, clock.millis());
    }

    public DaySummary day(LocalDate d) {
        return toDay(classifier(), d);
    }

    public PeriodSummary period(LocalDate from, LocalDate toExclusive) {
        HourClassifier c = classifier();
        List<DaySummary> days = new ArrayList<>();
        Breakdown t = new Breakdown();
        long goal = 0;
        for (LocalDate d = from; d.isBefore(toExclusive); d = d.plusDays(1)) {
            HourClassifier.DayResult r = c.day(d);
            t.addAll(r.total());
            goal += r.goal();
            days.add(toDay(c, d));
        }
        return new PeriodSummary(from.toString(), toExclusive.minusDays(1).toString(), goal, t.work(), t.ordinary(), t.extra(), t.asMap(), days);
    }

    static DaySummary toDay(HourClassifier c, LocalDate d) {
        HourClassifier.DayResult r = c.day(d);
        Breakdown b = r.total();
        return new DaySummary(d.toString(), r.info().kind(), r.info().festivo(), r.info().working(), r.goal(), b.work(),
                b.ordinary(), b.extra(), r.pause(), r.lunchOver(), c.schedule().nightStartFor(d).toString(), b.asMap());
    }
}
