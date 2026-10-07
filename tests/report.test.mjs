import { test } from "node:test";
import assert from "node:assert/strict";
import {filterReport,selectionModules,reportGroups} from '../shared/report-selection.js';
test('granular reports exclude unchecked fields, split appointments and deduplicate treatments',()=>{
  const data={created:'2026-10-07T12:00:00Z',child:{primer_nombre:'Ejemplo',fecha_nacimiento:'2020-01-01',alergias:'NO MOSTRAR'},sections:{ninos:[{id:'n',diagnostico:'NO MOSTRAR',alergias:'Alergia',rut:'NO MOSTRAR'}],medicamentos:[{id:'m',activo:1,nombre:'Activo'},{id:'f',activo:0,nombre:'Finalizado'}],consultas_medicas:[{id:'future',fecha:'2026-10-08T12:00:00Z'},{id:'past',fecha:'2026-10-06T12:00:00Z'}]},anamnesis:{embarazo:{0:'NO MOSTRAR'},lenguaje:{0:'Palabras'}},documents:[{nombre:'archivo.pdf'}]};
  const r=filterReport(data,['allergies','medication_active','appointments_past','anamnesis_lenguaje']);
  assert.deepEqual(r.sections.ninos,[{id:'n',alergias:'Alergia'}]);
  assert.equal(r.child.fecha_nacimiento,undefined);
  assert.equal(r.child.alergias,'Alergia');
  assert.equal(r.sections.medicamentos.length,1);
  assert.equal(r.sections.consultas_medicas[0].id,'past');
  assert.deepEqual(Object.keys(r.anamnesis),['lenguaje']);
  assert.deepEqual(r.documents,[]);
  assert.equal(r.includePhoto,false);
  assert.equal(filterReport(data,['medication_active','treatments']).sections.medicamentos.length,2);
  assert.deepEqual(selectionModules(['nutrition','school_support']),['salud','escolar']);
  const ids=reportGroups.flatMap(g=>g.items.map(i=>i.id));
  assert.equal(new Set(ids).size,ids.length);
});
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
