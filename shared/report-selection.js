import { models, anamnesisSections } from './models.js';

const item = (id, label, table, fields, mode) => ({ id, label, table, fields, mode });
export const reportGroups = [
  { module: 'perfil', label: 'Perfil clínico', items: [
    item('personal', 'Datos personales, identificación y previsión', 'ninos', ['primer_nombre','apellidos','rut','fecha_nacimiento','sexo_referencia','convivientes','grupo_sanguineo','prevision_salud']),
    item('diagnoses', 'Diagnósticos / condiciones', 'ninos', ['diagnostico']),
    item('allergies', 'Alergias y advertencias médicas', 'ninos', ['alergias']),
    item('hospital', 'Hospitalizaciones', 'ninos', ['hospitalizado','hospitalizacion_motivo','hospitalizacion_estadia']),
    item('specialists', 'Profesionales y especialistas tratantes', 'ninos', ['especialistas_json']),
    item('emergency', 'Contactos de emergencia', 'ninos', models.ninos.fields.filter(f=>f.key.startsWith('contacto_emergencia')).map(f=>f.key)),
    item('care', 'Institución de cuidado y nivel actual', 'ninos', ['colegio_actual','curso_actual']),
    item('photo', 'Foto de perfil'),
  ] },
  { module: 'salud', label: 'Salud y crecimiento', items: [
    item('medication_active', 'Medicamentos activos y esquemas', 'medicamentos', undefined, 'active'),
    item('treatments', 'Historial completo de tratamientos', 'medicamentos'),
    item('appointments_future', 'Próximos controles / consultas pendientes', 'consultas_medicas', undefined, 'future'),
    item('appointments_past', 'Consultas realizadas', 'consultas_medicas', undefined, 'past'),
    item('exams', 'Exámenes y resultados', 'examenes_medicos'),
    item('vaccines', 'Carnet de vacunas', 'vacunas'),
    item('growth', 'Mediciones de crecimiento', 'registros_crecimiento'),
    item('nutrition', 'Alimentación y nutrición', 'alimentacion'),
  ] },
  { module: 'escolar', label: 'Escolar', items: [
    item('school_logs', 'Bitácoras diarias / informes del colegio', 'bitacora_escolar_diaria'),
    item('school_data', 'Datos del establecimiento', 'perfiles_escolares', ['colegio_actual','curso']),
    item('school_support', 'Manual de apoyo, PIE / PACI / PAEC', 'perfiles_escolares', ['pie_paci_activo','fortalezas','detonantes','estrategias_autorregulacion','adecuaciones_json','paec_json','adecuaciones_adjuntos_json']),
    item('school_history', 'Historial y cambios de establecimiento', 'historial_colegios'),
  ] },
  { module: 'anamnesis', label: 'Anamnesis', items: anamnesisSections.map(([key,label])=>item('anamnesis_'+key,label,undefined,undefined,key)) },
  { module: 'rnd', label: 'Credencial RND y documentos', items: [item('rnd_data', 'Datos de credencial RND', 'credenciales_discapacidad'), item('documents', 'Lista / resumen de documentos adjuntos')] },
];
export const documentSelection = 'documents';
export function selectionModules(selected) {
  return reportGroups.filter(g=>g.items.some(i=>i.id!==documentSelection&&selected.includes(i.id))).map(g=>g.module);
}
export function filterReport(data, selected) {
  const chosen = new Set(selected), sections = {}, now = Date.parse(data.created);
  for (const group of reportGroups) for (const option of group.items) {
    if (!chosen.has(option.id) || !option.table) continue;
    let rows = data.sections?.[option.table] || [];
    if (option.mode === 'active') rows = rows.filter(r=>r.activo);
    if (option.mode === 'future' || option.mode === 'past') rows = rows.filter(r=>Number.isFinite(Date.parse(r.fecha)) && (option.mode === 'future' ? Date.parse(r.fecha)>=now : Date.parse(r.fecha)<now));
    for (const row of rows) {
      const existing = (sections[option.table] ||= []);
      let target = existing.find(r=>r.id===row.id);
      if (!target) { target={id:row.id}; existing.push(target); }
      const keys = option.fields || models[option.table].fields.map(f=>f.key);
      for (const key of keys) if (Object.hasOwn(row,key)) target[key]=row[key];
    }
  }
  const profile = sections.ninos?.[0] || {};
  const child = {primer_nombre:data.child?.primer_nombre,apellidos:data.child?.apellidos};
  if (chosen.has('personal')) { child.fecha_nacimiento=data.child?.fecha_nacimiento; child.grupo_sanguineo=profile.grupo_sanguineo; }
  if (chosen.has('allergies')) child.alergias=profile.alergias;
  const anamnesis = {};
  for (const [key] of anamnesisSections) if(chosen.has('anamnesis_'+key)) anamnesis[key]=data.anamnesis?.[key] || {};
  return {...data,child,sections,anamnesis,selection:[...chosen],includePhoto:chosen.has('photo'),documents:chosen.has(documentSelection)?data.documents||[]:[]};
}
