package co.jhonjara.controlhoras.service;

import co.jhonjara.controlhoras.domain.AppSettings;
import co.jhonjara.controlhoras.engine.Schedule;
import co.jhonjara.controlhoras.repo.AppSettingsRepository;
import co.jhonjara.controlhoras.web.ApiException;
import co.jhonjara.controlhoras.web.Dtos.SettingsDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SettingsService {
    private final AppSettingsRepository repo;

    public SettingsService(AppSettingsRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public SettingsDto get() {
        return toDto(entity());
    }

    AppSettings entity() {
        return repo.findById((short) 1).orElseThrow(() -> new IllegalStateException("Falta la fila de ajustes"));
    }

    @Transactional
    public SettingsDto update(SettingsDto in) {
        validate(in);
        AppSettings s = entity();
        s.setSchedStart(in.schedStart());
        s.setSchedEnd(in.schedEnd());
        s.setLunchMin(in.lunch());
        s.setNightStart(in.nightStart());
        s.setNightEnd(in.nightEnd());
        s.setWorkdays(new TreeSet<>(in.workdays()).stream().map(String::valueOf).collect(Collectors.joining(",")));
        s.setTheme(in.theme());
        s.setAccent(in.accent());
        s.setCustomAccent(in.customAccent());
        s.setHint(in.hint());
        s.setGoalNotified(in.goalNotified());
        s.setEndNotified(in.endNotified());
        return toDto(repo.save(s));
    }

    @Transactional
    public void reset() {
        update(new SettingsDto("07:30", "17:30", 90, null, "06:00", List.of(1, 2, 3, 4, 5), "dark", 0, null, true, null, null));
    }

    static void validate(SettingsDto in) {
        int span = LocalTime.parse(in.schedEnd()).toSecondOfDay() / 60 - LocalTime.parse(in.schedStart()).toSecondOfDay() / 60;
        if (span <= 0) throw ApiException.badRequest("La hora de salida debe ser posterior a la de entrada");
        if (in.lunch() >= span) throw ApiException.badRequest("El almuerzo no puede ocupar toda la jornada");
    }

    public static SettingsDto toDto(AppSettings s) {
        List<Integer> wd = s.getWorkdays().isBlank() ? List.of()
                : Arrays.stream(s.getWorkdays().split(",")).map(String::trim).map(Integer::valueOf).toList();
        return new SettingsDto(s.getSchedStart(), s.getSchedEnd(), s.getLunchMin(), s.getNightStart(), s.getNightEnd(), wd,
                s.getTheme(), s.getAccent(), s.getCustomAccent(), s.isHint(), s.getGoalNotified(), s.getEndNotified());
    }

    public static Schedule toSchedule(SettingsDto s) {
        return new Schedule(LocalTime.parse(s.schedStart()), LocalTime.parse(s.schedEnd()), s.lunch(),
                s.nightStart() == null ? null : LocalTime.parse(s.nightStart()), LocalTime.parse(s.nightEnd()),
                Set.copyOf(s.workdays()));
    }

    @Transactional(readOnly = true)
    public Schedule schedule() {
        return toSchedule(get());
    }
}
