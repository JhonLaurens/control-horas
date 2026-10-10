package co.jhonjara.controlhoras.service;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ExportServiceTest {
    @Test
    void formatosCsv() {
        assertThat(ExportService.dec(5_400_000)).isEqualTo("1,50");
        assertThat(ExportService.hhmm(30_600_000)).isEqualTo("08:30");
        assertThat(ExportService.cell("a;b")).isEqualTo("\"a;b\"");
        assertThat(ExportService.cell("dijo \"hola\"\n")).isEqualTo("\"dijo \"\"hola\"\"\n\"");
        assertThat(ExportService.cell("simple")).isEqualTo("simple");
    }
}
