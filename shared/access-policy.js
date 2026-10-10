import { models, modules, anamnesisSections } from './models.js';

export const permissionActions = ['ver', 'crear', 'editar', 'eliminar', 'descargar', 'adjuntar'];
export const sensitiveCategories = ['rnd', 'anamnesis', 'diagnosticos', 'examenes', 'recetas', 'foto_perfil'];
export const privacyCategories = ['rut', 'telefono', 'direccion', 'diagnosticos', 'archivos'];
const list = (value, choices) => Array.isArray(value) && value.every(v => typeof v === 'string' && choices.includes(v));
const denied = () => ({ modules: [], acciones: [], sensibles: [], privacidad: [...privacyCategories] });

export function permissions(actor) {
  if (actor.rol === 'superadmin') return { modules: Object.keys(modules), acciones: [...permissionActions] };
  if (actor.guest) return {
    modules: list(actor.modules, Object.keys(modules)) ? [...actor.modules] : [],
    // A shared link has always allowed a report of its explicitly shared modules.
    acciones: ['ver', 'descargar'], privacidad: [],
  };
  let p;
  try { p = JSON.parse(actor.permisos_json || '{}'); } catch { return denied(); }
  if (!p || !list(p.modules, Object.keys(modules)) || !list(p.acciones, permissionActions)
    || (Object.hasOwn(p, 'sensibles') && !list(p.sensibles, sensitiveCategories))
    || (Object.hasOwn(p, 'privacidad') && !list(p.privacidad, privacyCategories))) return denied();
  // Omitted optional restrictions retain the established legacy contract;
  // explicit empty sensitive permissions grant none. Required lists never default to full access.
  return { modules: [...p.modules], acciones: [...p.acciones],
    ...(Object.hasOwn(p, 'sensibles') ? { sensibles: [...p.sensibles] } : {}),
    privacidad: [...(p.privacidad || [])] };
}

export function sensitiveAllowed(actor, category) {
  const p = permissions(actor);
  return !Array.isArray(p.sensibles) || p.sensibles.includes(category);
}

export function canAccess(actor, module, action = 'ver') {
  const p = permissions(actor);
  return !actor.platform_controls?.blocked_modules?.includes(module)
    && p.modules.includes(module) && p.acciones.includes(action)
    && (!['rnd', 'anamnesis'].includes(module) || sensitiveAllowed(actor, module));
}

export function recordAllowed(actor, table) {
  return !!models[table] && canAccess(actor, models[table].module)
    && (table !== 'examenes_medicos' || sensitiveAllowed(actor, 'examenes'));
}

export function fieldAllowed(actor, table, key) {
  if (actor.rol === 'superadmin') return true;
  const p = permissions(actor), field = models[table]?.fields.find(f => f.key === key);
  if (p.privacidad.includes('rut') && /rut/i.test(key)) return false;
  if (p.privacidad.includes('telefono') && (field?.type === 'tel' || /telefono/i.test(key))) return false;
  if (p.privacidad.includes('direccion') && /direccion/i.test(key)) return false;
  if (/diagnostico/i.test(key) && (p.privacidad.includes('diagnosticos') || !sensitiveAllowed(actor, 'diagnosticos'))) return false;
  if (field?.type === 'file' || field?.type === 'files') {
    if (p.privacidad.includes('archivos')) return false;
    if (key === 'foto_perfil_id' && !sensitiveAllowed(actor, 'foto_perfil')) return false;
    if (key === 'carnet_identidad_id' && p.privacidad.includes('rut')) return false;
    if (table === 'consultas_medicas' && (!sensitiveAllowed(actor, 'examenes') || !sensitiveAllowed(actor, 'recetas'))) return false;
  }
  return true;
}

export function projectRecord(actor, table, row) {
  if (!recordAllowed(actor, table)) return null;
  return Object.fromEntries(Object.entries(row).filter(([key]) => fieldAllowed(actor, table, key)));
}

export function projectChild(actor, row) {
  if (actor.guest && row.id !== actor.nino_id) return null;
  const readable = Object.keys(modules).filter(m => canAccess(actor, m));
  if (!readable.length) return null;
  // Identity needed to select the shared profile and interpret its age-based records.
  const base = { id: row.id, primer_nombre: row.primer_nombre, apodo: row.apodo };
  if (readable.some(m => ['perfil', 'salud', 'escolar', 'anamnesis', 'rnd'].includes(m))) {
    base.fecha_nacimiento = row.fecha_nacimiento;
    base.sexo_referencia = row.sexo_referencia;
  }
  base.rnd_habilitado = canAccess(actor, 'rnd') ? row.rnd_habilitado : 0;
  return !actor.guest && canAccess(actor, 'perfil')
    ? { ...projectRecord(actor, 'ninos', row), rnd_habilitado: base.rnd_habilitado } : base;
}

export function projectAnamnesis(actor, document) {
  if (actor.rol === 'superadmin') return document;
  const p = permissions(actor);
  // Free text cannot be reliably redacted by key or regex. Omit entire sections
  // that contain family identifiers or diagnoses when their privacy category is restricted.
  const hidden = new Set();
  if (['rut', 'telefono', 'direccion'].some(k => p.privacidad.includes(k))) hidden.add('identificacion');
  if (p.privacidad.includes('diagnosticos') || !sensitiveAllowed(actor, 'diagnosticos')) {
    hidden.add('antecedentes');
  }
  if (!sensitiveAllowed(actor, 'examenes') || !sensitiveAllowed(actor, 'recetas')) hidden.add('antecedentes');
  return Object.fromEntries(Object.entries(document).filter(([key]) => !hidden.has(key)).map(([key, value]) =>
    [key, Object.fromEntries(Object.entries(value || {}).filter(([field]) => field !== 'archivos' || !p.privacidad.includes('archivos')))]));
}

export function canShare(actor, module) {
  if (!canAccess(actor, module) || !canAccess(actor, module, 'descargar') || permissions(actor).privacidad?.length) return false;
  if (module === 'anamnesis' && Object.keys(projectAnamnesis(actor,
    Object.fromEntries(anamnesisSections.map(([key]) => [key, {}])))).length !== anamnesisSections.length) return false;
  return !Object.entries(models).some(([table, model]) => model.module === module
    && (!recordAllowed(actor, table) || model.fields.some(f => !fieldAllowed(actor, table, f.key))));
}
