package co.jhonjara.controlhoras.service;

import co.jhonjara.controlhoras.repo.WorkSessionRepository;
import co.jhonjara.controlhoras.web.ApiException;
import co.jhonjara.controlhoras.web.Dtos.PauseDto;
import co.jhonjara.controlhoras.web.Dtos.SessionInput;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class SessionServiceTest {
    static final long H = 3_600_000L;
    final long now = Instant.parse("2026-10-09T22:00:00Z").toEpochMilli();
    final SessionService svc = new SessionService(Mockito.mock(WorkSessionRepository.class), Clock.fixed(Instant.ofEpochMilli(now), ZoneOffset.UTC));

    SessionInput in(long a, long b, List<PauseDto> p) {
        return new SessionInput(null, a, b, p, "", "", false);
    }

    @Test
    void rechazaRangosInvalidos() {
        long a = now - 10 * H;
        assertThatThrownBy(() -> svc.validate(in(a, a, List.of()))).isInstanceOf(ApiException.class).hasMessageContaining("posterior");
        assertThatThrownBy(() -> svc.validate(in(a - 50 * H, a, List.of()))).hasMessageContaining("48 h");
        assertThatThrownBy(() -> svc.validate(in(now, now + H, List.of()))).hasMessageContaining("futuro");
        assertThatThrownBy(() -> svc.validate(in(a, a + 2 * H, List.of(new PauseDto(a - H, a + H))))).hasMessageContaining("pausas");
        assertThatThrownBy(() -> svc.validate(in(a, a + 2 * H, List.of(new PauseDto(a, a + 2 * H))))).hasMessageContaining("superan");
    }

    @Test
    void aceptaSesionValida() {
        long a = now - 10 * H;
        assertThatCode(() -> svc.validate(in(a, a + 8 * H, List.of(new PauseDto(a + 4 * H, a + 5 * H))))).doesNotThrowAnyException();
    }
}
