export const STORAGE_LIMIT = 8000000000;
export const D1_ATTACHMENT_LIMIT = 200000000;
const rows = async (db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
export function storageLevel(used,limit) {
  const ratio=limit>0?used/limit:0;
  return ratio>=1?'blocked':ratio>=.95?'critical':ratio>=.85?'warning':ratio>=.7?'notice':'normal';
}
export async function consumption(env) {
  const db=env.DB;
  const [storage,reserved,d1,ai,families]=await Promise.all([
    db.prepare("SELECT COUNT(*) AS files,COALESCE(SUM(bytes),0) AS bytes,COALESCE(SUM(CASE WHEN r2_key NOT LIKE 'd1:%' THEN bytes ELSE 0 END),0) AS r2_bytes FROM archivos").first(),
    db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(bytes),0) AS bytes FROM reservas_almacenamiento').first(),
    db.prepare('SELECT (SELECT COALESCE(SUM(length(contenido)),0) FROM archivo_chunks)+(SELECT COALESCE(SUM(length(contenido)),0) FROM archivos) AS bytes').first(),
    db.prepare('SELECT cantidad FROM intentos_acceso WHERE clave=?').bind('consultation-ai:'+new Date().toISOString().slice(0,10)).first(),
    rows(db,"SELECT f.id,f.nombre,f.storage_limit_bytes,f.commercial_exempt,COALESCE(SUM(a.bytes),0) AS bytes,COUNT(a.id) AS files FROM familias f LEFT JOIN archivos a ON a.familia_id=f.id GROUP BY f.id ORDER BY bytes DESC,f.id LIMIT 20")
  ]);
  const used=Number(storage.bytes)+Number(reserved.bytes);
  return {
    generated_at:new Date().toISOString(),source:'Metadatos de LuSpace; no es facturación ni consumo total de la cuenta Cloudflare',
    storage:{used_bytes:Number(storage.bytes),reserved_bytes:Number(reserved.bytes),reservation_count:Number(reserved.count),committed_bytes:used,limit_bytes:STORAGE_LIMIT,reference_free_bytes:10000000000,r2_metadata_bytes:Number(storage.r2_bytes),files:Number(storage.files),level:storageLevel(used,STORAGE_LIMIT),uploads_blocked:used>=STORAGE_LIMIT},
    d1:{attachment_bytes:Number(d1.bytes),attachment_limit_bytes:D1_ATTACHMENT_LIMIT,total_database_bytes:null,level:storageLevel(Number(d1.bytes),D1_ATTACHMENT_LIMIT)},
    ai:{requests_today:Number(ai?.cantidad||0),daily_request_limit:10,neurons_used:null,enabled:!!env.AI&&env.LUSPACE_AI_ENABLED==='true'},
    cloudflare:{account_storage_bytes:null,r2_class_a_operations:null,r2_class_b_operations:null,d1_rows_read:null,d1_rows_written:null,workers_requests:null},families
  };
}
export async function notifications(env,actorId,metrics=null) {
  const db=env.DB,report=metrics||await consumption(env),items=[];
  const add=(key,title,detail,severity='info',target='consumption',created_at=null)=>items.push({key,title,detail,severity,target,created_at});
  const {storage,d1,ai}=report;
  const backupRows=await rows(db,"SELECT id,status,completed_at,error_code,independent_copy FROM respaldos_plataforma ORDER BY started_at DESC LIMIT 20");
  const backup=backupRows.find(r=>r.status==='verified'),latestBackup=backupRows[0];
  if(!backup||Date.now()-Date.parse(backup.completed_at)>36*3600000)add('backup-stale','Respaldo pendiente o desactualizado','No hay una copia verificada reciente. Revisar protección y recuperación de datos.','critical','backups');
  if(latestBackup?.status==='failed')add('backup-failed:'+latestBackup.id,'Falló la copia de seguridad','Código operativo: '+latestBackup.error_code+'. Los originales no fueron modificados.','critical','backups',latestBackup.completed_at);
  if(backup?.independent_copy==='failed')add('backup-independent:'+backup.id,'Copia independiente pendiente','La copia R2 está verificada, pero no se completó la copia cifrada fuera de Cloudflare.','warning','backups',backup.completed_at);
  if(backup?.error_code==='RETENTION')add('backup-retention:'+backup.id,'Revisar retención de respaldos','Se conservó la nueva copia verificada; la limpieza de copias vencidas requiere revisión.','warning','backups',backup.completed_at);
  if(storage.level!=='normal')add('global-storage:'+storage.level,'Almacenamiento global '+(storage.level==='blocked'?'completo':'por revisar'),'Uso y reservas al '+(storage.committed_bytes/storage.limit_bytes*100).toFixed(2)+' % del límite interno. No se borran archivos.',storage.level==='blocked'||storage.level==='critical'?'critical':'warning');
  if(d1.level!=='normal')add('d1-attachments:'+d1.level,'Adjuntos conservados en D1','Revisar el espacio de los originales y el uso real de D1 en Cloudflare.','warning');
  if(storage.reservation_count)add('pending-reservations','Subidas con espacio reservado',storage.reservation_count+' reservas pendientes. No se liberan automáticamente para evitar exceder el límite.','warning');
  if(ai.requests_today>=ai.daily_request_limit)add('ai-daily:'+new Date().toISOString().slice(0,10),'Límite diario de IA alcanzado','El resumen básico sigue disponible. No se activa un servicio de pago.','warning');
  const [newFamilies,expiring,quotas]=await Promise.all([
    rows(db,"SELECT id,nombre,created_at FROM familias WHERE julianday(created_at)>=julianday('now','-30 days') ORDER BY created_at DESC,id LIMIT 50"),
    rows(db,"SELECT id,nombre,trial_ends_at FROM familias WHERE commercial_exempt=0 AND subscription_status='trial' AND julianday(trial_ends_at)>julianday('now') AND julianday(trial_ends_at)<=julianday('now','+3 days') ORDER BY trial_ends_at,id LIMIT 20"),
    rows(db,"SELECT id,nombre,storage_used_bytes,storage_limit_bytes FROM familias WHERE commercial_exempt=0 AND storage_limit_bytes>0 AND storage_used_bytes>=storage_limit_bytes*.7 ORDER BY storage_used_bytes*1.0/storage_limit_bytes DESC,id LIMIT 20")
  ]);
  for(const f of newFamilies)add('family-new:'+f.id,'Nueva familia registrada',f.nombre,'info','families',f.created_at);
  for(const f of expiring)add('trial-ending:'+f.id+':'+f.trial_ends_at,'Prueba próxima a vencer',f.nombre+' · '+Math.ceil((Date.parse(f.trial_ends_at)-Date.now())/86400000)+' días restantes.','warning','families',f.trial_ends_at);
  for(const f of quotas){const level=storageLevel(f.storage_used_bytes,f.storage_limit_bytes);add('family-quota:'+f.id+':'+level,'Cuota familiar por revisar',f.nombre+' · '+(f.storage_used_bytes/f.storage_limit_bytes*100).toFixed(2)+' %.',level==='critical'||level==='blocked'?'critical':'warning','families');}
  const keys=items.slice(0,100).map(i=>i.key);
  const read=new Set((keys.length?await rows(db,'SELECT clave FROM notificaciones_plataforma_leidas WHERE usuario_id=? AND clave IN ('+keys.map(()=>'?').join(',')+')',actorId,...keys):[]).map(r=>r.clave));
  const result=items.slice(0,100).map(i=>({...i,read:read.has(i.key)}));
  return {items:result,unread:result.filter(i=>!i.read).length,scope:'Últimos 30 días y alertas vigentes; hasta 100 avisos',generated_at:report.generated_at};
}
