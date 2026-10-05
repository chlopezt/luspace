const id=process.env.BACKUP_RUN_ID,status=process.env.INDEPENDENT_COPY;
if(!/^[a-f0-9-]{36}$/.test(id||'')||!['verified','failed'].includes(status))throw new Error('Estado de copia inválido.');
const res=await fetch('https://api.cloudflare.com/client/v4/accounts/b82d9c355fea7fa6d20ed89e2b3971fa/d1/database/853a2ab9-2950-4be8-8aec-4350cd7dd8a0/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql:'UPDATE respaldos_plataforma SET independent_copy=? WHERE id=?',params:[status,id]}),signal:AbortSignal.timeout(30000)});
if(!res.ok||(await res.json()).success===false)throw new Error('No se pudo registrar la copia independiente.');
