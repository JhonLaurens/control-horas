package co.jhonjara.controlhoras.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** Fila única (id = 1) con la configuración del usuario. */
@Entity
@Table(name = "app_settings")
public class AppSettings {
    @Id
    private Short id = 1;
    @Column(name = "sched_start", nullable = false, length = 5) private String schedStart;
    @Column(name = "sched_end", nullable = false, length = 5) private String schedEnd;
    @Column(name = "lunch_min", nullable = false) private int lunchMin;
    @Column(name = "night_start", length = 5) private String nightStart;
    @Column(name = "night_end", nullable = false, length = 5) private String nightEnd;
    @Column(nullable = false, length = 20) private String workdays;
    @Column(nullable = false, length = 10) private String theme;
    @Column(nullable = false) private int accent;
    @Column(name = "custom_accent", length = 7) private String customAccent;
    @Column(nullable = false) private boolean hint;
    @Column(name = "goal_notified", length = 10) private String goalNotified;
    @Column(name = "end_notified", length = 10) private String endNotified;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }

    public String getSchedStart() { return schedStart; }
    public void setSchedStart(String v) { schedStart = v; }
    public String getSchedEnd() { return schedEnd; }
    public void setSchedEnd(String v) { schedEnd = v; }
    public int getLunchMin() { return lunchMin; }
    public void setLunchMin(int v) { lunchMin = v; }
    public String getNightStart() { return nightStart; }
    public void setNightStart(String v) { nightStart = v; }
    public String getNightEnd() { return nightEnd; }
    public void setNightEnd(String v) { nightEnd = v; }
    public String getWorkdays() { return workdays; }
    public void setWorkdays(String v) { workdays = v; }
    public String getTheme() { return theme; }
    public void setTheme(String v) { theme = v; }
    public int getAccent() { return accent; }
    public void setAccent(int v) { accent = v; }
    public String getCustomAccent() { return customAccent; }
    public void setCustomAccent(String v) { customAccent = v; }
    public boolean isHint() { return hint; }
    public void setHint(boolean v) { hint = v; }
    public String getGoalNotified() { return goalNotified; }
    public void setGoalNotified(String v) { goalNotified = v; }
    public String getEndNotified() { return endNotified; }
    public void setEndNotified(String v) { endNotified = v; }
}
