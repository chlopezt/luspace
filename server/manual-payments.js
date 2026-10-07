import {uid} from './security.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const sql=(db,q,...args)=>db.prepare(q).bind(...args);
const rows=async(db,q,...args)=>(await sql(db,q,...args).all()).results;
const text=(v,max)=>{if(typeof v!=='string'||v.length>max)fail(400,'Revisa la longitud de los datos del pago.');return v.trim();};

export async function manualPaymentOverview(db) {
  return {
    families:await rows(db,'SELECT id,nombre,subscription_status,commercial_exempt,manual_paid_until,storage_limit_bytes FROM familias ORDER BY nombre,id'),
    payments:await rows(db,'SELECT p.*,f.nombre AS familia_nombre FROM pagos_manuales p JOIN familias f ON f.id=p.familia_id ORDER BY p.creado_at DESC,p.id DESC LIMIT 200'),
    pending:(await sql(db,"SELECT COUNT(*) AS n FROM pagos_manuales WHERE estado='pendiente'").first()).n,
    limit:200
  };
}
export async function registerManualPayment(db,actor,b) {
  const familyId=text(b.familia_id,100),kind=b.tipo;
  if(!['transferencia','cortesia'].includes(kind))fail(400,'Tipo de registro inválido.');
  const family=await sql(db,'SELECT id,commercial_exempt FROM familias WHERE id=?',familyId).first();
  if(!family)fail(404,'Familia no encontrada.');
  if(family.commercial_exempt)fail(409,'Esta familia tiene acceso exento. Revisa sus parámetros antes de registrar períodos pagados.');
  const amount=b.monto_clp,days=b.dias_cortesia,quota=b.cuota_bytes;
  if(!Number.isSafeInteger(amount)||amount<0||amount>1e9||!Number.isInteger(days)||days<0||days>90||!Number.isSafeInteger(quota)||quota<0||quota>10737418240||(quota>0&&quota<1048576))fail(400,'Monto, días o cuota inválidos.');
  if(kind==='transferencia'?(amount<=0||days!==0):(amount!==0||days<1))fail(400,'La cortesía no registra dinero; la transferencia requiere un monto positivo.');
  const date=text(b.fecha_pago,10),reference=text(b.referencia||'',120),notes=text(b.notas||'',1000),key=text(b.request_key,100);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))fail(400,'Indica una fecha de pago válida, no futura.');
  if(notes.length<5||! /^[a-zA-Z0-9-]{16,100}$/.test(key))fail(400,'Indica un motivo y una referencia de solicitud válida.');
  const existing=await sql(db,'SELECT * FROM pagos_manuales WHERE creado_por=? AND request_key=?',actor.id,key).first();
  if(existing){if(existing.familia_id!==familyId||existing.tipo!==kind||existing.monto_clp!==amount||existing.dias_cortesia!==days||existing.cuota_bytes!==quota||existing.fecha_pago!==date||existing.referencia!==reference||existing.notas!==notes)fail(409,'Esta solicitud ya se utilizó para otro registro.');return existing;}
  if(reference&&await sql(db,"SELECT id FROM pagos_manuales WHERE familia_id=? AND referencia=? AND tipo='transferencia' AND estado<>'rechazado'",familyId,reference).first())fail(409,'Esta referencia de transferencia ya está registrada para la familia.');
  const id=uid();
  await db.batch([
    sql(db,'INSERT INTO pagos_manuales(id,familia_id,tipo,monto_clp,fecha_pago,referencia,notas,dias_cortesia,cuota_bytes,creado_por,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,familyId,kind,amount,date,reference,notes,days,quota,actor.id,key),
    sql(db,'INSERT INTO auditoria_plataforma(id,usuario_id,accion,descripcion) VALUES(?,?,?,?)',uid(),actor.id,'REGISTER_MANUAL_PAYMENT',JSON.stringify({familia_id:familyId,registro:id,tipo:kind,motivo:notes}))
  ]);
  return sql(db,'SELECT * FROM pagos_manuales WHERE id=?',id).first();
}
export async function reviewManualPayment(db,actor,id,b) {
  if(!['confirmado','rechazado'].includes(b.estado))fail(400,'Estado de revisión inválido.');
  if(b.estado==='confirmado'&&b.bank_verified!==true)fail(400,'Confirma que verificaste el ingreso bancario o la autorización de cortesía.');
  const notes=text(b.notas||'',1000);if(notes.length<5)fail(400,'Indica el motivo de la revisión.');
  const p=await sql(db,'SELECT * FROM pagos_manuales WHERE id=?',id).first();
  if(!p)fail(404,'Pago no encontrado.');
  if(p.estado===b.estado)return p; // A retried confirmation never adds another month.
  if(p.estado!=='pendiente')fail(409,'El registro ya fue revisado; no se puede cambiar ni eliminar su historial.');
  await sql(db,"UPDATE pagos_manuales SET estado=?,revisado_por=?,revisado_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),notas_revision=? WHERE id=? AND estado='pendiente'",b.estado,actor.id,notes,id).run();
  const result=await sql(db,'SELECT * FROM pagos_manuales WHERE id=?',id).first();
  if(result.estado!==b.estado)fail(409,'Otro administrador ya revisó este registro. Actualiza el historial.');
  return result;
}
