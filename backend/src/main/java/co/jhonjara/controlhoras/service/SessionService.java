package co.jhonjara.controlhoras.service;

import co.jhonjara.controlhoras.domain.SessionPause;
import co.jhonjara.controlhoras.domain.WorkSession;
import co.jhonjara.controlhoras.engine.HourClassifier;
import co.jhonjara.controlhoras.repo.WorkSessionRepository;
import co.jhonjara.controlhoras.web.ApiException;
import co.jhonjara.controlhoras.web.Dtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

@Service
public class SessionService {
    static final long H = 3_600_000L, M = 60_000L;
    private final WorkSessionRepository repo;
    private final Clock clock;

    public SessionService(WorkSessionRepository repo, Clock clock) {
        this.repo = repo;
        this.clock = clock;
    }

    long now() { return clock.millis(); }

    public static String newId() {
        return Long.toString(System.currentTimeMillis(), 36) + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
    }

    public static SessionDto toDto(WorkSession s) {
        List<PauseDto> ps = s.getPauses().stream()
                .map(p -> new PauseDto(p.getStartAt().toEpochMilli(), p.getEndAt() == null ? null : p.getEndAt().toEpochMilli())).toList();
        return new SessionDto(s.getId(), s.getStartAt().toEpochMilli(), s.getEndAt() == null ? null : s.getEndAt().toEpochMilli(),
                ps, s.getNote(), s.getTag(), s.isExtra());
    }

    public static HourClassifier.Session toEngine(SessionDto s) {
        List<HourClassifier.Pause> ps = s.pauses().stream().map(p -> new HourClassifier.Pause(p.start(), p.end())).toList();
        return new HourClassifier.Session(s.id(), s.start(), s.end(), ps, s.extra());
    }

    @Transactional(readOnly = true)
    public List<SessionDto> all() {
        return repo.findAllByOrderByStartAtAsc().stream().map(SessionService::toDto).toList();
    }

    @Transactional(readOnly = true)
    public Optional<SessionDto> active() {
        return repo.findFirstByEndAtIsNull().map(SessionService::toDto);
    }

    private WorkSession activeEntity() {
        return repo.findFirstByEndAtIsNull().orElseThrow(() -> ApiException.conflict("No hay una jornada en curso"));
    }

    private static SessionPause openPause(WorkSession s) {
        List<SessionPause> ps = s.getPauses();
        if (ps.isEmpty()) return null;
        SessionPause last = ps.get(ps.size() - 1);
        return last.getEndAt() == null ? last : null;
    }

    @Transactional
    public SessionDto start(StartInput in) {
        if (repo.findFirstByEndAtIsNull().isPresent()) throw ApiException.conflict("Ya hay una jornada en curso");
        WorkSession s = new WorkSession(newId(), Instant.ofEpochMilli(now()));
        s.setNote(trim(in == null ? null : in.note()));
        s.setTag(trim(in == null ? null : in.tag()));
        s.setExtra(in != null && Boolean.TRUE.equals(in.extra()));
        return toDto(repo.save(s));
    }

    @Transactional
    public SessionDto pause() {
        WorkSession s = activeEntity();
        if (openPause(s) != null) throw ApiException.conflict("La jornada ya está en pausa");
        s.addPause(new SessionPause(Instant.ofEpochMilli(Math.max(now(), s.getStartAt().toEpochMilli())), null));
        return toDto(repo.save(s));
    }

    @Transactional
    public SessionDto resume() {
        WorkSession s = activeEntity();
        SessionPause p = openPause(s);
        if (p == null) throw ApiException.conflict("La jornada no está en pausa");
        p.setEndAt(Instant.ofEpochMilli(Math.max(now(), p.getStartAt().toEpochMilli())));
        return toDto(repo.save(s));
    }

    @Transactional
    public StopResult stop(ActivePatch in) {
        WorkSession s = activeEntity();
        long t = Math.max(now(), s.getStartAt().toEpochMilli());
        SessionPause p = openPause(s);
        if (p != null) p.setEndAt(Instant.ofEpochMilli(Math.max(t, p.getStartAt().toEpochMilli())));
        applyPatch(s, in);
        if (t - s.getStartAt().toEpochMilli() < 1000) {
            repo.delete(s);
            return new StopResult(null, true);
        }
        s.setEndAt(Instant.ofEpochMilli(t));
        return new StopResult(toDto(repo.save(s)), false);
    }

    @Transactional
    public SessionDto patchActive(ActivePatch in) {
        WorkSession s = activeEntity();
        applyPatch(s, in);
        return toDto(repo.save(s));
    }

    private static void applyPatch(WorkSession s, ActivePatch in) {
        if (in == null) return;
        if (in.note() != null) s.setNote(trim(in.note()));
        if (in.tag() != null) s.setTag(trim(in.tag()));
        if (in.extra() != null) s.setExtra(in.extra());
    }

    @Transactional
    public SessionDto create(SessionInput in) {
        return create(in, false);
    }

    /** @param fromBackup los respaldos pueden traer sesiones con fecha futura (la versión HTML lo permitía). */
    @Transactional
    public SessionDto create(SessionInput in, boolean fromBackup) {
        validate(in, fromBackup);
        String id = in.id() == null || in.id().isBlank() ? newId() : in.id();
        if (repo.existsById(id)) throw ApiException.conflict("Ya existe una sesión con ese id");
        WorkSession s = new WorkSession(id, Instant.ofEpochMilli(in.start()));
        fill(s, in);
        return toDto(repo.save(s));
    }

    @Transactional
    public SessionDto update(String id, SessionInput in) {
        WorkSession s = repo.findById(id).orElseThrow(() -> ApiException.notFound("Sesión no encontrada"));
        if (s.getEndAt() == null) throw ApiException.conflict("Finaliza la jornada en curso antes de editarla");
        validate(in, false);
        s.setStartAt(Instant.ofEpochMilli(in.start()));
        fill(s, in);
        return toDto(repo.save(s));
    }

    @Transactional
    public void delete(String id) {
        WorkSession s = repo.findById(id).orElseThrow(() -> ApiException.notFound("Sesión no encontrada"));
        repo.delete(s);
    }

    @Transactional
    public void deleteAll() {
        repo.deleteAll();
    }

    private static void fill(WorkSession s, SessionInput in) {
        s.setEndAt(Instant.ofEpochMilli(in.end()));
        s.setNote(trim(in.note()));
        s.setTag(trim(in.tag()));
        s.setExtra(Boolean.TRUE.equals(in.extra()));
        List<SessionPause> ps = new ArrayList<>();
        for (PauseDto p : pauses(in)) ps.add(new SessionPause(Instant.ofEpochMilli(p.start()), Instant.ofEpochMilli(p.end())));
        s.replacePauses(ps);
    }

    private static List<PauseDto> pauses(SessionInput in) {
        List<PauseDto> ps = new ArrayList<>(in.pauses() == null ? List.of() : in.pauses());
        ps.sort(Comparator.comparingLong(PauseDto::start));
        return ps;
    }

    void validate(SessionInput in) {
        validate(in, false);
    }

    void validate(SessionInput in, boolean allowFuture) {
        long a = in.start(), b = in.end();
        if (b <= a) throw ApiException.badRequest("La hora de fin debe ser posterior al inicio");
        if (b - a > 48 * H) throw ApiException.badRequest("Una sesión no puede superar 48 h");
        if (!allowFuture && b > now() + M) throw ApiException.badRequest("La sesión no puede terminar en el futuro");
        long prev = a, total = 0;
        for (PauseDto p : pauses(in)) {
            if (p.end() == null) throw ApiException.badRequest("Las pausas de una sesión terminada deben tener fin");
            if (p.start() < prev || p.end() < p.start() || p.end() > b)
                throw ApiException.badRequest("Las pausas deben estar dentro de la sesión y no solaparse");
            prev = p.end();
            total += p.end() - p.start();
        }
        if (total >= b - a) throw ApiException.badRequest("Las pausas superan la duración");
    }

    static String trim(String s) {
        return s == null ? "" : s.trim();
    }
}
