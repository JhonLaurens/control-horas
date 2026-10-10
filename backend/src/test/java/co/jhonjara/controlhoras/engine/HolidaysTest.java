package co.jhonjara.controlhoras.engine;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class HolidaysTest {
    private static List<String> dates(int y) {
        return Holidays.forYear(y).stream().map(h -> h.date().toString()).toList();
    }

    @Test
    void festivos2026() {
        assertThat(dates(2026)).containsExactly("2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
                "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12",
                "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25");
    }

    @Test
    void festivos2025() {
        assertThat(dates(2025)).containsExactly("2025-01-01", "2025-01-06", "2025-03-24", "2025-04-17", "2025-04-18", "2025-05-01",
                "2025-06-02", "2025-06-23", "2025-06-30", "2025-07-20", "2025-08-07", "2025-08-18", "2025-10-13", "2025-11-03",
                "2025-11-17", "2025-12-08", "2025-12-25");
    }

    @Test
    void pascua() {
        assertThat(Holidays.easter(2026)).isEqualTo(LocalDate.of(2026, 4, 5));
        assertThat(Holidays.easter(2027)).isEqualTo(LocalDate.of(2027, 3, 28));
        assertThat(Holidays.nameOf(LocalDate.of(2026, 10, 12))).contains("Día de la Raza");
    }
}
