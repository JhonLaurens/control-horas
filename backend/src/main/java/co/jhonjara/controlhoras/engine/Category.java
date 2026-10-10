package co.jhonjara.controlhoras.engine;

/** Las 8 categorías de horas (solo horas, sin cálculo de dinero). */
public enum Category {
    oD("Ordinaria diurna", false), oN("Ordinaria nocturna", false),
    eD("Extra diurna", true), eN("Extra nocturna", true),
    fD("Dominical/festivo diurna", true), fN("Dominical/festivo nocturna", true),
    sD("Sábado/descanso diurna", true), sN("Sábado/descanso nocturna", true);

    public final String label;
    public final boolean extra;

    Category(String label, boolean extra) {
        this.label = label;
        this.extra = extra;
    }
}
