package co.jhonjara.controlhoras.web;

import co.jhonjara.controlhoras.engine.Holidays;
import co.jhonjara.controlhoras.service.*;
import co.jhonjara.controlhoras.web.Dtos.*;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final SessionService sessions;
    private final SettingsService settings;
    private final SummaryService summary;
    private final ExportService export;

    public ApiController(SessionService sessions, SettingsService settings, SummaryService summary, ExportService export) {
        this.sessions = sessions;
        this.settings = settings;
        this.summary = summary;
        this.export = export;
    }

    /** Estado completo para la interfaz: sesiones terminadas, jornada activa y ajustes. */
    @GetMapping("/state")
    public StateDto state() {
        List<SessionDto> done = sessions.all().stream().filter(s -> s.end() != null).toList();
        return new StateDto(done, sessions.active().orElse(null), settings.get(), System.currentTimeMillis(), summary.zone().getId());
    }

    // ---- Jornada activa ----
    @PostMapping("/active/start")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionDto start(@Valid @RequestBody(required = false) StartInput in) { return sessions.start(in); }

    @PostMapping("/active/pause")
    public SessionDto pause() { return sessions.pause(); }

    @PostMapping("/active/resume")
    public SessionDto resume() { return sessions.resume(); }

    @PostMapping("/active/stop")
    public StopResult stop(@Valid @RequestBody(required = false) ActivePatch in) { return sessions.stop(in); }

    @PatchMapping("/active")
    public SessionDto patchActive(@Valid @RequestBody ActivePatch in) { return sessions.patchActive(in); }

    // ---- Sesiones ----
    @GetMapping("/sessions")
    public List<SessionDto> list() { return sessions.all(); }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionDto create(@Valid @RequestBody SessionInput in) { return sessions.create(in); }

    @PutMapping("/sessions/{id}")
    public SessionDto update(@PathVariable String id, @Valid @RequestBody SessionInput in) { return sessions.update(id, in); }

    @DeleteMapping("/sessions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) { sessions.delete(id); }

    // ---- Ajustes ----
    @GetMapping("/settings")
    public SettingsDto getSettings() { return settings.get(); }

    @PutMapping("/settings")
    public SettingsDto putSettings(@Valid @RequestBody SettingsDto in) { return settings.update(in); }

    // ---- Resúmenes calculados en el servidor ----
    @GetMapping("/summary/day")
    public DaySummary day(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return summary.day(date == null ? summary.today() : date);
    }

    @GetMapping("/summary/week")
    public PeriodSummary week(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate d = date == null ? summary.today() : date;
        LocalDate mon = d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return summary.period(mon, mon.plusDays(7));
    }

    @GetMapping("/summary/month")
    public PeriodSummary month(@RequestParam(required = false) Integer year, @RequestParam(required = false) Integer month) {
        LocalDate t = summary.today();
        int y = year == null ? t.getYear() : year, m = month == null ? t.getMonthValue() : month;
        if (m < 1 || m > 12 || y < 1900 || y > 2200) throw ApiException.badRequest("Mes o año no válido");
        LocalDate first = LocalDate.of(y, m, 1);
        return summary.period(first, first.plusMonths(1));
    }

    @GetMapping("/summary/range")
    public PeriodSummary range(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                               @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        if (to.isBefore(from) || from.plusDays(400).isBefore(to)) throw ApiException.badRequest("Rango no válido (máximo 400 días)");
        return summary.period(from, to.plusDays(1));
    }

    @GetMapping("/holidays")
    public List<HolidayDto> holidays(@RequestParam int year) {
        if (year < 1900 || year > 2200) throw ApiException.badRequest("Año no válido");
        return Holidays.forYear(year).stream().map(h -> new HolidayDto(h.date().toString(), h.name())).toList();
    }

    // ---- Exportar / importar ----
    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> csv(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                      @RequestParam(required = false) String q) {
        String name = "horas_" + (from == null ? "inicio" : from) + "_a_" + (to == null ? summary.today() : to) + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build().toString())
                .body(export.csv(from, to, q).getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/export/json")
    public ResponseEntity<Map<String, Object>> json() {
        String name = "control-horas_respaldo_" + summary.today() + ".json";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build().toString())
                .body(export.backup());
    }

    @PostMapping("/import")
    public ImportResult importBackup(@RequestBody JsonNode body) { return export.importBackup(body); }

    @DeleteMapping("/data")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void wipe() {
        sessions.deleteAll();
        settings.reset();
    }
}
