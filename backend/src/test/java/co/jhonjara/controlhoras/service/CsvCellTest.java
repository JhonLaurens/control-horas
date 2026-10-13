package co.jhonjara.controlhoras.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class CsvCellTest {
    @Test
    void notaMultilineaSeConservaEntreComillas() {
        String nota = "Proyecto Demo – ajustes\n- Tarea 1: \"filtro\" por área\n- Tarea 2; exportar";
        assertEquals("\"Proyecto Demo – ajustes\n- Tarea 1: \"\"filtro\"\" por área\n- Tarea 2; exportar\"", ExportService.cell(nota));
    }
}
