import {randomUUID} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createArchive,restoreArchive,hashBytes,decrypt} from './backup-core.mjs';

const ACCOUNT='b82d9c355fea7fa6d20ed89e2b3971fa', DATABASE='853a2ab9-2950-4be8-8aec-4350cd7dd8a0';
const SOURCE='luspace-files', VAULT='luspace-backups', RETENTION_DAYS=7;
const ACCOUNT_LIMIT=8_000_000_000,VAULT_LIMIT=1_000_000_000,COPY_LIMIT=100_000_000;
const KEY=process.env.LUSPACE_BACKUP_KEY?.trim(),TOKEN=process.env.CLOUDFLARE_API_TOKEN;
let requests=0;
async function request(path,options={}){
 if(++requests>10000)throw new Error('CAPACITY');
 const res=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{...options,headers:{Authorization:'Bearer '+TOKEN,...options.headers},signal:AbortSignal.timeout(60000)});
 if(!res.ok){const error=new Error(res.status===403?'PERMISSION':'PROVIDER');error.httpStatus=res.status;throw error;}return res;
}
async function json(path,method='GET',data){const res=await request(path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const body=await res.json();if(body.success===false)throw new Error('PROVIDER');return body;}
const objectsPath=bucket=>'r2/buckets/'+bucket+'/objects';
const objectPath=(bucket,key)=>objectsPath(bucket)+'/'+key.split('/').map(encodeURIComponent).join('/');
async function limitedBytes(res,max){let size=0;const chunks=[];for await(const chunk of res.body){size+=chunk.length;if(size>max)throw new Error('CAPACITY');chunks.push(chunk);}return Buffer.concat(chunks);}
async function listObjects(bucket){
 const result=[];let cursor='';do{
  const response=await json(objectsPath(bucket)+'?per_page=1000'+(cursor?'&cursor='+encodeURIComponent(cursor):''));result.push(...response.result);if(result.length>20000)throw new Error('CAPACITY');
  cursor=response.result_info?.is_truncated?response.result_info.cursor:'';if(response.result_info?.is_truncated&&!cursor)throw new Error('PROVIDER');
 }while(cursor);return result;
}
async function getObject(bucket,key){return limitedBytes(await request(objectPath(bucket,key)),COPY_LIMIT);}
async function putObject(key,bytes){
 await request(objectPath(VAULT,key),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});
 const copy=await getObject(VAULT,key);if(copy.length!==bytes.length||hashBytes(copy)!==hashBytes(bytes))throw new Error('INTEGRITY');
}
async function status(id,values){
 const cols=Object.keys(values);await json('d1/database/'+DATABASE+'/query','POST',{sql:'INSERT INTO respaldos_plataforma(id,'+cols.join(',')+') VALUES(?,'+cols.map(()=>'?').join(',')+') ON CONFLICT(id) DO UPDATE SET '+cols.map(c=>c+'=excluded.'+c).join(','),params:[id,...Object.values(values)]});
}
async function exportSql(){
 let bookmark;for(let i=0;i<60;i++){
  const body=await json('d1/database/'+DATABASE+'/export','POST',{output_format:'polling',...(bookmark?{current_bookmark:bookmark}:{})});const value=body.result;
  if(value.status==='error'||value.success===false)throw new Error('EXPORT');
  if(value.status==='complete'){
   const url=new URL(value.result.signed_url);if(url.protocol!=='https:')throw new Error('EXPORT');
   // Never attach the API token to the signed download or write its URL to logs.
   const res=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!res.ok)throw new Error('EXPORT');return (await limitedBytes(res,500_000_000)).toString();
  }bookmark=value.at_bookmark||bookmark;await delay(2000);
 }throw new Error('EXPORT');
}
async function inventory(){
 const buckets=(await json('r2/buckets')).result.buckets;if(!Array.isArray(buckets)||buckets.length>20)throw new Error('CAPACITY');
 let total=0;const byBucket=new Map();for(const bucket of buckets){const list=await listObjects(bucket.name);byBucket.set(bucket.name,list);for(const obj of list){if(obj.storage_class&&obj.storage_class!=='Standard')throw new Error('CAPACITY');total+=Number(obj.size);}}
 if(!Number.isSafeInteger(total))throw new Error('CAPACITY');return {total,byBucket};
}
async function cleanup(previous,newId,key){
 const manifests=previous.filter(o=>/^snapshots\/[a-f0-9-]{36}\/manifest\.enc$/.test(o.key));
 const valid=[];for(const object of manifests){
  try{const m=JSON.parse(decrypt(await getObject(VAULT,object.key),key,'manifest.enc'));if(m.format==='luspace-encrypted-backup-v1'&&object.key==='snapshots/'+m.id+'/manifest.enc'&&Number.isFinite(Date.parse(m.created_at)))valid.push(m);}catch{throw new Error('INTEGRITY');}
 }
 valid.sort((a,b)=>b.created_at.localeCompare(a.created_at));const keep=new Set([newId,...valid.slice(0,1).map(m=>m.id)]);
 for(const m of valid){if(keep.has(m.id)||Date.parse(m.created_at)>Date.now()-RETENTION_DAYS*86400000)continue;const prefix='snapshots/'+m.id+'/';const managed=previous.filter(o=>o.key.startsWith(prefix));for(const object of managed){if(!/^snapshots\/[a-f0-9-]{36}\/(manifest\.enc|database\.sql\.gz\.enc|objects\/[a-f0-9-]{36}\.enc)$/.test(object.key))throw new Error('INTEGRITY');await request(objectPath(VAULT,object.key),{method:'DELETE'});}console.log('Copia cifrada vencida retirada: '+m.id);}
}
async function main(){
 const runId=randomUUID(),started=new Date().toISOString();let phase='CONFIGURATION';
 try{
  if(!TOKEN||!/^[a-f0-9]{64}$/i.test(KEY||''))throw new Error('CONFIGURATION');
  await status(runId,{started_at:started,status:'running'});
  phase='INVENTORY';let account=await inventory();
  if(!account.byBucket.has(SOURCE))throw new Error('CONFIGURATION');
  const source=account.byBucket.get(SOURCE);if(source.length>2000)throw new Error('CAPACITY');
  phase='EXPORT';const sql=await exportSql();
  phase='INTEGRITY';const archive=await createArchive({sql,key:KEY,getObject:key=>getObject(SOURCE,key),listObjects:source,maxBytes:COPY_LIMIT});
  // Read and restore the complete encrypted archive before uploading anything.
  const restored=restoreArchive(archive.objects,KEY);restored.db.close();
  if(account.total+archive.bytes>ACCOUNT_LIMIT||(account.byBucket.get(VAULT)?.reduce((n,o)=>n+Number(o.size),0)||0)+archive.bytes>VAULT_LIMIT)throw new Error('CAPACITY');
  if(!account.byBucket.has(VAULT)){await json('r2/buckets','POST',{name:VAULT});account.byBucket.set(VAULT,[]);}
  phase='UPLOAD';const prefix='snapshots/'+archive.id+'/';
  // Commit manifest last. Incomplete copies are never presented as verified.
  for(const [name,bytes] of archive.objects)if(name!=='manifest.enc')await putObject(prefix+name,bytes);
  await putObject(prefix+'manifest.enc',archive.objects.get('manifest.enc'));
  phase='RESTORE_TEST';const stored=new Map();for(const name of archive.objects.keys())stored.set(name,await getObject(VAULT,prefix+name));const check=restoreArchive(stored,KEY);check.db.close();
  await status(runId,{started_at:started,status:'verified',completed_at:new Date().toISOString(),restore_test_at:new Date().toISOString(),verified_files:archive.manifest.summary.files,verified_families:archive.manifest.summary.families,encrypted_bytes:archive.bytes,retained_until:new Date(Date.now()+RETENTION_DAYS*86400000).toISOString(),error_code:null});
  // Only ciphertext is eligible for the independent GitHub copy. No SQL, names,
  // credentials, sessions or signed links are written to job artifacts/logs.
  const out=resolve('.private-backups/encrypted');mkdirSync(out,{recursive:true,mode:0o700});for(const [name,bytes] of archive.objects){const target=resolve(out,name);mkdirSync(resolve(target,'..'),{recursive:true,mode:0o700});writeFileSync(target,bytes,{flag:'wx',mode:0o600});}
  if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,'backup_id='+runId+'\n',{flag:'a'});
  phase='RETENTION';try{await cleanup(account.byBucket.get(VAULT),archive.id,KEY);}catch{
   await status(runId,{started_at:started,status:'verified',error_code:'RETENTION'});
   console.log('Retención pendiente de revisar. Se conservaron las copias existentes y la nueva copia verificada.');
  }
  console.log('Respaldo cifrado y restauración aislada verificados. Archivos: '+archive.manifest.summary.files+'.');
 }catch(e){const code=['CONFIGURATION','PERMISSION','PROVIDER','EXPORT','INTEGRITY','ISOLATION','CAPACITY'].find(c=>String(e.message).startsWith(c))||phase;try{if(TOKEN)await status(runId,{started_at:started,status:'failed',completed_at:new Date().toISOString(),error_code:code});}catch{}console.error('Respaldo no completado: '+code+'; etapa '+phase+(e.httpStatus?'; HTTP '+e.httpStatus:'')+'. Los datos originales no se modificaron.');process.exitCode=1;}
}
if(process.argv[1]?.endsWith('cloudflare-backup.mjs'))await main();
