import { models } from "../shared/models.js";
// Field allowlist; free-text notes still require family review before transmission.
export function consultationContext(child, sections, anamnesis) {
  const fields = {
    ninos: ["grupo_sanguineo", "alergias", "diagnostico"],
    medicamentos: ["nombre", "dosis", "frecuencia_horas", "fecha_inicio", "fecha_termino", "instrucciones", "instrucciones_especiales", "activo"],
    registros_crecimiento: ["fecha_medicion", "peso_kg", "talla_cm", "notas"],
    consultas_medicas: ["fecha", "especialidad", "motivo_consulta", "diagnostico", "plan_tratamiento"],
    examenes_medicos: ["nombre", "fecha", "observaciones"],
    perfiles_escolares: ["curso", "fortalezas", "detonantes", "estrategias_autorregulacion", "adecuaciones_json", "paec_json"],
    bitacora_escolar_diaria: ["fecha", "estado_animo", "crisis_sobrecarga", "incidentes", "resolucion"],
    credenciales_discapacidad: ["tipo_discapacidad", "movilidad_reducida", "fecha_vencimiento"],
  };
  const result = { paciente: { edad_meses: Math.max(0, Math.floor((Date.now() - Date.parse(child.fecha_nacimiento)) / 2629800000)) }, registros: {} };
  for (const [table, rows] of Object.entries(sections)) {
    const keys = fields[table] || [];
    const items = rows.filter(r => table !== "medicamentos" || r.activo).slice(0,20).map(r => Object.fromEntries(keys.filter(k => r[k] !== null && r[k] !== undefined && r[k] !== "").map(k => [k, typeof r[k] === "string" ? r[k].slice(0, 1000) : r[k]]))).filter(r => Object.keys(r).length);
    if (items.length) result.registros[table] = items;
  }
  // Anamnesis contains family identifiers: excluded from external AI in this version.
  return result;
}
export function basicDraft(context, concern) {
  const sections = Object.entries(context.registros).map(([table, rows]) => {
    const definition = models[table];
    const records = rows.map(row => Object.entries(row).map(([key, value]) => {
      const label = definition?.fields.find(f => f.key === key)?.label || key.replaceAll("_", " ");
      if (key === "activo") return value ? "Tratamiento activo" : "";
      return label + ": " + String(value);
    }).filter(Boolean).join("\n")).join("\n\n");
    return (definition?.title || table) + "\n" + records;
  });
  return "PREPARACIÓN DE CONSULTA · BORRADOR\n\n" + (concern ? "INQUIETUDES DE LA FAMILIA\n" + concern + "\n\n" : "") +
    "Edad aproximada: " + context.paciente.edad_meses + " meses\n\n" + sections.join("\n\n") +
    "\n\nPREGUNTAS PARA EL PROFESIONAL\n• ¿Qué cambios debemos revisar?\n• ¿Qué observaciones conviene registrar?\n• ¿Cuándo corresponde el próximo control?\n\nVerificar antecedentes. No sustituye la evaluación profesional. No se han leído los adjuntos.";
}
