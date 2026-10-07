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
  if (['dosis_sos','urgencias','sesiones_terapia'].includes(table)) {
    const date = Date.parse(values.fecha);
    if (!Number.isFinite(date) || date > now || values.fecha.slice(0,10) < birth) return 'La atención, dosis o sesión debe estar entre el nacimiento y el momento actual.';
  }
  if (table === 'gastos_medicos') {
    if (!Number.isInteger(values.monto) || (values.monto_reembolsado != null && !Number.isInteger(values.monto_reembolsado)) || (values.monto_reembolsado || 0) > values.monto) return 'Registra pesos chilenos enteros; el reembolso no puede superar el gasto.';
    if (values.fecha > new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date(now))) return 'La fecha del gasto no puede estar en el futuro.';
    if (values.estado_reembolso === 'No aplica' && values.monto_reembolsado > 0) return 'Selecciona un estado de reembolso para registrar el monto devuelto.';
    if (values.estado_reembolso === 'Reembolsado' && values.monto > 0 && !(values.monto_reembolsado > 0)) return 'Indica el monto efectivamente reembolsado.';
  }
  if (table === 'turnos_cuidadores') {
    const start=Date.parse(values.hora_inicio),end=Date.parse(values.hora_fin);
    if (!Number.isFinite(start) || start>now || values.hora_inicio.slice(0,10)<birth) return 'El inicio del turno debe estar entre el nacimiento y el momento actual.';
    if (values.hora_fin && (!Number.isFinite(end) || end<=start || end>now)) return 'El fin debe ser posterior al inicio y no estar en el futuro. Déjalo vacío si el turno continúa.';
  }
  if (table === 'horario_escolar' && (!/^\d{2}:\d{2}$/.test(values.hora_inicio) || !/^\d{2}:\d{2}$/.test(values.hora_fin) || values.hora_inicio >= values.hora_fin || values.hora_fin > '23:59' || values.hora_inicio > '23:59' || Number(values.hora_inicio.slice(3))>59 || Number(values.hora_fin.slice(3))>59)) return 'La hora de fin debe ser posterior al inicio, dentro del mismo día.';
  return '';
}
export function currentCaregiver(rows, now=Date.now()) {
  return [...rows].filter(row=>!row.hora_fin && Number.isFinite(Date.parse(row.hora_inicio)) && Date.parse(row.hora_inicio)<=now)
    .sort((a,b)=>Date.parse(b.hora_inicio)-Date.parse(a.hora_inicio))[0] || null;
}
export function expenseTotals(rows) {
  return rows.reduce((t,row)=>({spent:t.spent+Number(row.monto||0), reimbursed:t.reimbursed+Number(row.monto_reembolsado||0),pending:t.pending+(row.estado_reembolso?.startsWith('Pendiente') ? Math.max(0,Number(row.monto||0)-Number(row.monto_reembolsado||0)) : 0)}),{spent:0,reimbursed:0,pending:0});
}
export const moneyCLP = value => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(value||0));
