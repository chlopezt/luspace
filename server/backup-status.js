export async function backupStatus(env){
 const rows=(await env.DB.prepare("SELECT id,started_at,completed_at,status,verified_files,verified_families,encrypted_bytes,restore_test_at,error_code,retained_until,independent_copy FROM respaldos_plataforma ORDER BY started_at DESC LIMIT 20").all()).results;
 const verified=rows.find(r=>r.status==='verified'),latest=rows[0]||null;
 const stale=!verified||Date.now()-Date.parse(verified.completed_at)>36*3600000;
 return {latest,last_verified:verified||null,runs:rows,stale,retention_days:7,target_interval_hours:24,alert_after_hours:36,encrypted:true,restore_mode:'Ensayo aislado; sin restauración directa sobre producción',source:'D1 y adjuntos referenciados + objetos R2 sin referencia en cuarentena',independent_retention_days:1,workflow_url:'https://github.com/chlopezt/luspace/actions/workflows/backup.yml',limits:{snapshot_bytes:100000000,vault_bytes:1000000000,account_safety_bytes:8000000000},state:!latest?'pending':latest.status==='failed'?'failed':stale?'stale':latest.status==='running'?'running':'verified'};
}
