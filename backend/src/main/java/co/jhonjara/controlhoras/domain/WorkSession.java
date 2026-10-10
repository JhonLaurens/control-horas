package co.jhonjara.controlhoras.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "work_session")
public class WorkSession {
    @Id
    @Column(length = 40)
    private String id;
    @Column(name = "start_at", nullable = false)
    private Instant startAt;
    @Column(name = "end_at")
    private Instant endAt;
    @Column(nullable = false, length = 200)
    private String note = "";
    @Column(nullable = false, length = 40)
    private String tag = "";
    @Column(nullable = false)
    private boolean extra;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("startAt ASC")
    private List<SessionPause> pauses = new ArrayList<>();

    protected WorkSession() {}

    public WorkSession(String id, Instant startAt) {
        this.id = id;
        this.startAt = startAt;
    }

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }

    public void replacePauses(List<SessionPause> list) {
        pauses.clear();
        for (SessionPause p : list) { p.setSession(this); pauses.add(p); }
    }

    public void addPause(SessionPause p) { p.setSession(this); pauses.add(p); }

    public String getId() { return id; }
    public Instant getStartAt() { return startAt; }
    public void setStartAt(Instant startAt) { this.startAt = startAt; }
    public Instant getEndAt() { return endAt; }
    public void setEndAt(Instant endAt) { this.endAt = endAt; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note == null ? "" : note; }
    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag == null ? "" : tag; }
    public boolean isExtra() { return extra; }
    public void setExtra(boolean extra) { this.extra = extra; }
    public List<SessionPause> getPauses() { return pauses; }
}
