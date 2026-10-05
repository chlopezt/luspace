import { test } from "node:test";
import assert from "node:assert/strict";
import {
  meaningful,
  reportFilename,
  reportAge,
  reportDate,
  fieldText,
  reportText,
} from "../shared/report-format.js";
test("report formatting preserves dates, meaningful zero and names safely", () => {
  assert.equal(
    reportFilename(
      { primer_nombre: "Luciano", apellidos: "López / Torres" },
      "2026-10-05T01:00:00Z",
    ),
    "Informe-LuSpace_Luciano_Lopez_Torres_04-10-2026.pdf",
  );
  assert.equal(
    reportFilename({}, "2026-10-05T12:00:00Z"),
    "Informe-LuSpace_Ficha_Pediatrica_05-10-2026.pdf",
  );
  assert.equal(reportDate("2026-09-11"), "11/09/2026");
  assert.match(
    reportDate("2026-09-11T23:59:00.000Z", true),
    /11\/09\/2026.*20:59/,
  );
  assert.match(reportDate("2026-09-11T08:00", true), /11\/09\/2026.*08:00/);
  assert.equal(
    reportAge("2018-10-19", "2026-10-05T12:00:00Z"),
    "7 años y 11 meses",
  );
  assert.equal(meaningful("Sin registrar"), false);
  assert.equal(meaningful("sin_registrar"), false);
  assert.equal(meaningful(0), true);
  assert.equal(
    fieldText({ type: "lines" }, '["", "Sin registrar", "Apoyo visual"]'),
    "Apoyo visual",
  );
  assert.equal(
    fieldText({ type: "lines" }, "Texto anterior no JSON"),
    "Texto anterior no JSON",
  );
  assert.equal(fieldText({ type: "checkbox" }, 0), "No");
  assert.ok(!reportText("Consulta 2026-09-11T23:59:00.000Z").includes("T23"));
  assert.equal(reportText("Texto extenso ".repeat(1000)).length, 14000);
});
