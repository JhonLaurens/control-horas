package co.jhonjara.controlhoras.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class CsvCellTest {
    @Test
    void notaMultilineaSeConservaEntreComillas() {
        String nota = "Portal Presupuesto – ajustes\n- REQ-03: \"filtro\" por área\n- REQ-04; exportar";
        assertEquals("\"Portal Presupuesto – ajustes\n- REQ-03: \"\"filtro\"\" por área\n- REQ-04; exportar\"", ExportService.cell(nota));
    }
}
