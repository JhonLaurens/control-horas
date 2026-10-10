package co.jhonjara.controlhoras.engine;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Festivos de Colombia (Ley 51 de 1983 "Ley Emiliani" y festivos religiosos basados en la Pascua).
 * Se calculan para cualquier año sin conexión.
 */
public final class Holidays {

    public record Holiday(LocalDate date, String name) {}

    private static final Map<Integer, List<Holiday>> CACHE = new ConcurrentHashMap<>();

    private Holidays() {}

    /** Domingo de Pascua (algoritmo gregoriano anónimo / Meeus). */
    public static LocalDate easter(int y) {
        int a = y % 19, b = y / 100, c = y % 100, d = b / 4, e = b % 4, f = (b + 8) / 25, g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30, i = c / 4, k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31, day = ((h + l - 7 * m + 114) % 31) + 1;
        return LocalDate.of(y, month, day);
    }

    static LocalDate nextMonday(LocalDate d) {
        return d.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
    }

    public static List<Holiday> forYear(int y) {
        return CACHE.computeIfAbsent(y, Holidays::compute);
    }

    private static List<Holiday> compute(int y) {
        Map<LocalDate, String> map = new TreeMap<>();
        java.util.function.BiConsumer<LocalDate, String> add = (d, n) -> map.merge(d, n, (a, b) -> a + " / " + b);
        add.accept(LocalDate.of(y, 1, 1), "Año Nuevo");
        add.accept(LocalDate.of(y, 5, 1), "Día del Trabajo");
        add.accept(LocalDate.of(y, 7, 20), "Día de la Independencia");
        add.accept(LocalDate.of(y, 8, 7), "Batalla de Boyacá");
        add.accept(LocalDate.of(y, 12, 8), "Inmaculada Concepción");
        add.accept(LocalDate.of(y, 12, 25), "Navidad");
        add.accept(nextMonday(LocalDate.of(y, 1, 6)), "Día de los Reyes Magos");
        add.accept(nextMonday(LocalDate.of(y, 3, 19)), "Día de San José");
        add.accept(nextMonday(LocalDate.of(y, 6, 29)), "San Pedro y San Pablo");
        add.accept(nextMonday(LocalDate.of(y, 8, 15)), "Asunción de la Virgen");
        add.accept(nextMonday(LocalDate.of(y, 10, 12)), "Día de la Raza");
        add.accept(nextMonday(LocalDate.of(y, 11, 1)), "Todos los Santos");
        add.accept(nextMonday(LocalDate.of(y, 11, 11)), "Independencia de Cartagena");
        LocalDate e = easter(y);
        add.accept(e.minusDays(3), "Jueves Santo");
        add.accept(e.minusDays(2), "Viernes Santo");
        add.accept(e.plusDays(43), "Ascensión del Señor");
        add.accept(e.plusDays(64), "Corpus Christi");
        add.accept(e.plusDays(71), "Sagrado Corazón");
        List<Holiday> out = new ArrayList<>();
        map.forEach((d, n) -> out.add(new Holiday(d, n)));
        return List.copyOf(out);
    }

    public static Optional<String> nameOf(LocalDate d) {
        return forYear(d.getYear()).stream().filter(h -> h.date().equals(d)).map(Holiday::name).findFirst();
    }
}
