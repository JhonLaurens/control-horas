package co.jhonjara.controlhoras.engine;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/** Acumulador de milisegundos por categoría. */
public final class Breakdown {
    private final EnumMap<Category, Long> ms = new EnumMap<>(Category.class);
    private long work;

    public Breakdown() {
        for (Category c : Category.values()) ms.put(c, 0L);
    }

    void add(Category c, long v) {
        if (v > 0) ms.merge(c, v, Long::sum);
    }

    void addWork(long v) {
        work += v;
    }

    public void addAll(Breakdown o) {
        work += o.work;
        o.ms.forEach(this::add);
    }

    public long get(Category c) {
        return ms.get(c);
    }

    public long work() {
        return work;
    }

    public long ordinary() {
        return get(Category.oD) + get(Category.oN);
    }

    public long extra() {
        long t = 0;
        for (Category c : Category.values()) if (c.extra) t += get(c);
        return t;
    }

    /** Mapa {oD: ms, oN: ms, ...} para la API. */
    public Map<String, Long> asMap() {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Category c : Category.values()) m.put(c.name(), get(c));
        return m;
    }
}
