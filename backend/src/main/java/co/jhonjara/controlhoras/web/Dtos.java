package co.jhonjara.controlhoras.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;

/** DTOs de la API. Los instantes viajan como milisegundos desde epoch (igual que la versión HTML). */
public final class Dtos {
    private Dtos() {}

    public static final String HM = "^([01]\\d|2[0-3]):[0-5]\\d$";

    public record PauseDto(@NotNull Long start, Long end) {}

    public record SessionDto(String id, long start, Long end, List<PauseDto> pauses, String note, String tag, boolean extra) {}

    public record SessionInput(
            @Size(max = 40) @Pattern(regexp = "^[A-Za-z0-9_-]*$", message = "id inválido") String id,
            @NotNull Long start,
            @NotNull Long end,
            @Valid List<PauseDto> pauses,
            @Size(max = 200) String note,
            @Size(max = 40) String tag,
            Boolean extra) {}

    public record StartInput(@Size(max = 200) String note, @Size(max = 40) String tag, Boolean extra) {}

    public record ActivePatch(@Size(max = 200) String note, @Size(max = 40) String tag, Boolean extra) {}

    public record SettingsDto(
            @NotNull @Pattern(regexp = HM) String schedStart,
            @NotNull @Pattern(regexp = HM) String schedEnd,
            @NotNull @Min(0) @Max(240) Integer lunch,
            @Pattern(regexp = HM) String nightStart,
            @NotNull @Pattern(regexp = HM) String nightEnd,
            @NotNull List<@Min(0) @Max(6) Integer> workdays,
            @NotNull @Pattern(regexp = "^(dark|light)$") String theme,
            @NotNull @Min(0) @Max(6) Integer accent,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$") String customAccent,
            @NotNull Boolean hint,
            @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$") String goalNotified,
            @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$") String endNotified) {}

    public record StateDto(List<SessionDto> sessions, SessionDto active, SettingsDto settings, long serverTime, String zone) {}

    public record StopResult(SessionDto session, boolean discarded) {}

    public record DaySummary(String date, String kind, String festivo, boolean working, long goalMs, long workMs,
                             long ordinaryMs, long extraMs, long pauseMs, long lunchOverMs, String nightStart,
                             Map<String, Long> categories) {}

    public record PeriodSummary(String from, String to, long goalMs, long workMs, long ordinaryMs, long extraMs,
                                Map<String, Long> categories, List<DaySummary> days) {}

    public record HolidayDto(String date, String name) {}

    public record ImportResult(int imported, int skipped, boolean settingsApplied, boolean activeIgnored) {}
}
