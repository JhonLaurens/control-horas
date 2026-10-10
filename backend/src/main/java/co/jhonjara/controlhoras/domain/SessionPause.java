package co.jhonjara.controlhoras.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "session_pause")
public class SessionPause {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id")
    private WorkSession session;
    @Column(name = "start_at", nullable = false)
    private Instant startAt;
    @Column(name = "end_at")
    private Instant endAt;

    protected SessionPause() {}

    public SessionPause(Instant startAt, Instant endAt) {
        this.startAt = startAt;
        this.endAt = endAt;
    }

    void setSession(WorkSession s) { this.session = s; }
    public Instant getStartAt() { return startAt; }
    public Instant getEndAt() { return endAt; }
    public void setEndAt(Instant endAt) { this.endAt = endAt; }
}
