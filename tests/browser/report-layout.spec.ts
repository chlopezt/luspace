import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("representative and long reports download complete PDFs", async ({
  page,
}) => {
  await page.goto("/");
  await mkdir("tmp/pdfs", { recursive: true });
  for (const stress of [false, true]) {
    const event = page.waitForEvent("download");
    await page.evaluate(async (stress) => {
      const { exportPdf } = await import(/* @vite-ignore */ "/src/report.tsx");
      const { models, anamnesisSections } = await import(
        /* @vite-ignore */ "/shared/models.js"
      );
      const sections: any = {};
      for (const [table, model] of Object.entries(models) as any) {
        const row: any = { id: table };
        for (const f of model.fields) {
          if (f.type === "file") continue;
          row[f.key] =
            f.type === "checkbox"
              ? 1
              : f.type === "date"
                ? "2026-09-11"
                : f.type.includes("datetime")
                  ? "2026-09-11T23:59:00.000Z"
                  : f.type === "number"
                    ? 21
                    : f.type === "lines"
                      ? '["Apoyo visual", "Pausas planificadas"]'
                      : f.options?.[1] ||
                        (stress
                          ? "Información de ejemplo registrada por la familia."
                          : "Información de ejemplo.");
        }
        sections[table] = [row];
      }
      sections.medicamentos = [
        {
          id: "med",
          nombre: "Medicamento de ejemplo",
          dosis: "25 mcg",
          frecuencia_horas: 24,
          hora_referencia: "2026-09-11T11:00:00Z",
          fecha_inicio: "2026-09-11",
          activo: 1,
          instrucciones_especiales:
            "Indicaciones registradas por el profesional.",
        },
      ];
      sections.vacunas = [
        {id:'v1',nombre:'BCG',dosis:'Única',estado:'Administrada',fecha_aplicacion:'2018-10-20',centro:'CESFAM de ejemplo',lote_marca:'Lote QA',notas:'Sin reacción informada'},
        {id:'v2',nombre:'Influenza',dosis:'Campaña de ejemplo',estado:'Pendiente/Próxima',fecha_prevista:'2027-03-20',notas:'Confirmar fecha con el vacunatorio'},
      ];
      sections.ninos[0].hospitalizado = "Sí";
      if (stress)
        sections.bitacora_escolar_diaria[0].incidentes =
          "Nota larga conservada íntegramente. ".repeat(180) + "FINAL DE NOTA";
      const anamnesis: any = {};
      for (const [key, , fields] of anamnesisSections as any)
        anamnesis[key] = Object.fromEntries(
          fields.map((_: any, i: number) => [
            i,
            stress
              ? "Antecedente de ejemplo registrado por la familia."
              : "Antecedente registrado.",
          ]),
        );
      await exportPdf({
        child: {
          primer_nombre: "Paciente",
          apellidos: stress ? "Prueba extensa" : "Ejemplo",
          fecha_nacimiento: "2018-10-19",
          grupo_sanguineo: "O+",
          alergias:
            "Alergia de ejemplo: evitar exposición según indicación médica.",
        },
        sections,
        anamnesis,
        created: "2026-10-05T12:00:00Z",
      });
    }, stress);
    const file = await event;
    await file.saveAs(`tmp/pdfs/${stress ? "stress" : "representative"}.pdf`);
    expect(file.suggestedFilename()).toContain("Informe-LuSpace_Paciente");
  }
});
