import {setTimeout as delay} from 'node:timers/promises';
if(!/^[a-f0-9]{64}$/i.test(process.env.LUSPACE_BACKUP_KEY?.trim()||''))throw new Error('Configura LUSPACE_BACKUP_KEY en GitHub Secrets; no se escribirá una copia sin cifrar.');
const url='https://api.cloudflare.com/client/v4/accounts/b82d9c355fea7fa6d20ed89e2b3971fa/d1/database/853a2ab9-2950-4be8-8aec-4350cd7dd8a0/query';
let ready=false;for(let i=0;i<30;i++){try{const res=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql:'SELECT id FROM respaldos_plataforma LIMIT 0'}),signal:AbortSignal.timeout(10000)});const data=await res.json();if(res.ok&&data.success){ready=true;break;}}catch{}await delay(5000);}
if(!ready)throw new Error('La migración de respaldo no está disponible; no se modificaron datos.');
