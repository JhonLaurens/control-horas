package co.jhonjara.controlhoras.engine;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

/**
 * Parámetros de jornada usados por el clasificador.
 *
 * @param workdays días laborales con la numeración de JavaScript (0 = domingo ... 6 = sábado)
 * @param nightStart inicio de la jornada nocturna personalizado; {@code null} = según la ley
 */
public record Schedule(LocalTime schedStart, LocalTime schedEnd, int lunchMinutes,
                       LocalTime nightStart, LocalTime nightEnd, Set<Integer> workdays) {

    /** Ley 2466 de 2025 (art. 10, CST art. 160): nocturno desde las 19:00 a partir del 25-dic-2025. */
    public static final LocalDate LAW_2466_EFFECTIVE = LocalDate.of(2025, 12, 25);

    public static Schedule defaults() {
        return new Schedule(LocalTime.of(7, 30), LocalTime.of(17, 30), 90, null, LocalTime.of(6, 0), Set.of(1, 2, 3, 4, 5));
    }

    /** Antes del 25-dic-2025 rige la Ley 1846 de 2017: nocturno desde las 21:00. */
    public static LocalTime legalNightStart(LocalDate d) {
        return d.isBefore(LAW_2466_EFFECTIVE) ? LocalTime.of(21, 0) : LocalTime.of(19, 0);
    }

    public LocalTime nightStartFor(LocalDate d) {
        return nightStart != null ? nightStart : legalNightStart(d);
    }

    public long lunchMs() {
        return Math.max(0, lunchMinutes) * 60_000L;
    }

    public long dailyGoalMs() {
        long span = (schedEnd.toSecondOfDay() - schedStart.toSecondOfDay()) * 1000L;
        return Math.max(0, span - lunchMs());
    }

    public long weeklyGoalMs() {
        return dailyGoalMs() * workdays.size();
    }
}
