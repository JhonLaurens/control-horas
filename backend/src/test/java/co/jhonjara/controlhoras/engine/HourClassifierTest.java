package co.jhonjara.controlhoras.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import java.io.InputStream;
import java.time.*;
import java.util.*;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Ejecuta los vectores compartidos (shared/classification-vectors.json) contra el clasificador Java. */
class HourClassifierTest {
    static final double H = 3_600_000d;
    static final ZoneId Z = ZoneId.of("America/Bogota");
    static final long NOW = LocalDateTime.of(2026, 10, 9, 22, 0).atZone(Z).toInstant().toEpochMilli();

    static long t(String s) {
        return LocalDateTime.parse(s).atZone(Z).toInstant().toEpochMilli();
    }

    static Schedule schedule(JsonNode o) {
        Schedule d = Schedule.defaults();
        if (o == null || o.isMissingNode()) return d;
        return new Schedule(
                o.has("schedStart") ? LocalTime.parse(o.get("schedStart").asText()) : d.schedStart(),
                o.has("schedEnd") ? LocalTime.parse(o.get("schedEnd").asText()) : d.schedEnd(),
                o.has("lunch") ? o.get("lunch").asInt() : d.lunchMinutes(),
                o.has("nightStart") ? LocalTime.parse(o.get("nightStart").asText()) : null,
                o.has("nightEnd") ? LocalTime.parse(o.get("nightEnd").asText()) : d.nightEnd(),
                d.workdays());
    }

    @TestFactory
    Stream<DynamicTest> vectoresCompartidos() throws Exception {
        JsonNode root;
        try (InputStream in = getClass().getResourceAsStream("/classification-vectors.json")) {
            root = new ObjectMapper().readTree(in);
        }
        List<DynamicTest> tests = new ArrayList<>();
        for (JsonNode c : root.get("cases")) {
            List<HourClassifier.Session> ss = new ArrayList<>();
            for (JsonNode s : c.get("sessions")) {
                List<HourClassifier.Pause> ps = new ArrayList<>();
                for (JsonNode p : s.path("pauses")) ps.add(new HourClassifier.Pause(t(p.get(0).asText()), t(p.get(1).asText())));
                ss.add(new HourClassifier.Session(s.get("id").asText(), t(s.get("start").asText()), t(s.get("end").asText()), ps, s.path("extra").asBoolean(false)));
            }
            HourClassifier hc = new HourClassifier(schedule(c.path("settings")), Z, ss, NOW);
            String name = c.get("name").asText();
            c.path("expectSessions").fields().forEachRemaining(e -> tests.add(DynamicTest.dynamicTest(name + " · " + e.getKey(), () -> {
                HourClassifier.Session s = ss.stream().filter(x -> x.id().equals(e.getKey())).findFirst().orElseThrow();
                Breakdown b = hc.session(s);
                for (Category k : Category.values())
                    assertThat(b.get(k) / H).as(e.getKey() + "." + k).isCloseTo(e.getValue().path(k.name()).asDouble(0), within(1e-9));
            })));
            c.path("expectDays").fields().forEachRemaining(e -> tests.add(DynamicTest.dynamicTest(name + " · día " + e.getKey(), () -> {
                HourClassifier.DayResult r = hc.day(LocalDate.parse(e.getKey()));
                JsonNode x = e.getValue();
                if (x.has("work")) assertThat(r.total().work() / H).isCloseTo(x.get("work").asDouble(), within(1e-9));
                if (x.has("lunchOver")) assertThat(r.lunchOver() / H).isCloseTo(x.get("lunchOver").asDouble(), within(1e-9));
                if (x.has("goal")) assertThat(r.goal() / H).isCloseTo(x.get("goal").asDouble(), within(1e-9));
            })));
            c.path("expectNightStart").fields().forEachRemaining(e -> tests.add(DynamicTest.dynamicTest(name + " · nocturna " + e.getKey(), () ->
                    assertThat(hc.schedule().nightStartFor(LocalDate.parse(e.getKey())).toString()).isEqualTo(e.getValue().asText()))));
        }
        assertThat(tests).hasSizeGreaterThan(15);
        return tests.stream();
    }

    @Test
    void sesionActivaUsaAhora() {
        long start = t("2026-10-09T20:00");
        HourClassifier.Session a = new HourClassifier.Session("a", start, null,
                List.of(new HourClassifier.Pause(t("2026-10-09T21:00"), null)), false);
        HourClassifier hc = new HourClassifier(Schedule.defaults(), Z, List.of(a), NOW);
        Breakdown b = hc.session(a);
        assertThat(b.get(Category.eN) / H).isCloseTo(1, within(1e-9));
        assertThat(hc.day(LocalDate.of(2026, 10, 9)).pause() / H).isCloseTo(1, within(1e-9));
    }

    @Test
    void metasDerivadas() {
        Schedule s = Schedule.defaults();
        assertThat(s.dailyGoalMs() / H).isEqualTo(8.5);
        assertThat(s.weeklyGoalMs() / H).isEqualTo(42.5);
        assertThat(Schedule.legalNightStart(LocalDate.of(2025, 12, 24))).isEqualTo(LocalTime.of(21, 0));
        assertThat(Schedule.legalNightStart(LocalDate.of(2025, 12, 25))).isEqualTo(LocalTime.of(19, 0));
    }
}
