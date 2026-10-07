export const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
export function nextSosDose(row) {
  const start = Date.parse(row.fecha), hours = Number(row.intervalo_horas);
  return Number.isFinite(start) && Number.isFinite(hours) && hours > 0 ? start + hours * 3600000 : null;
}
export function sosReminders(rows, now = Date.now()) {
  const latest = new Map();
  for (const row of rows) {
    const key = String(row.medicamento || '').trim().toLocaleLowerCase('es');
    if (!key || !Number.isFinite(Date.parse(row.fecha))) continue;
    if (!latest.has(key) || Date.parse(row.fecha) > Date.parse(latest.get(key).fecha)) latest.set(key, row);
  }
  return [...latest.values()].map(row => ({...row, next: nextSosDose(row)}))
    .filter(row => row.next !== null && now - row.next < 86400000)
    .sort((a,b) => a.next-b.next);
}
export function todaySchedule(rows, now = new Date()) {
  const weekday = new Intl.DateTimeFormat('es-CL', {weekday:'long', timeZone:'America/Santiago'}).format(now);
  return rows.filter(row => row.dia?.toLocaleLowerCase('es') === weekday.toLocaleLowerCase('es'))
    .sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio));
}
export function careValidation(table, values, birth, now = Date.now()) {
  if (['dosis_sos','urgencias'].includes(table)) {
    const date = Date.parse(values.fecha);
    if (!Number.isFinite(date) || date > now || values.fecha.slice(0,10) < birth) return 'La atención o dosis debe estar entre el nacimiento y el momento actual.';
  }
  if (table === 'horario_escolar' && (!/^\d{2}:\d{2}$/.test(values.hora_inicio) || !/^\d{2}:\d{2}$/.test(values.hora_fin) || values.hora_inicio >= values.hora_fin || values.hora_fin > '23:59' || values.hora_inicio > '23:59' || Number(values.hora_inicio.slice(3))>59 || Number(values.hora_fin.slice(3))>59)) return 'La hora de fin debe ser posterior al inicio, dentro del mismo día.';
  return '';
}
