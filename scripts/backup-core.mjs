import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {objectKey,readFileBytes} from '../server/file-storage.js';

export const FORMAT='luspace-encrypted-backup-v1';
export const hashBytes=value=>createHash('sha256').update(value).digest('hex');
const keyBytes=key=>{if(!/^[a-f0-9]{64}$/i.test(key||''))throw new Error('CONFIGURATION: falta una clave de cifrado de 32 bytes.');return Buffer.from(key,'hex');};
export function encrypt(value,key,label){
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keyBytes(key),nonce);
 cipher.setAAD(Buffer.from(FORMAT+':'+label));
 const body=Buffer.concat([cipher.update(value),cipher.final()]);
 return Buffer.concat([Buffer.from('LUB1'),nonce,cipher.getAuthTag(),body]);
}
export function decrypt(value,key,label){
 const b=Buffer.from(value);if(b.length<32||b.subarray(0,4).toString()!=='LUB1')throw new Error('INTEGRITY: formato de copia inválido.');
 const cipher=createDecipheriv('aes-256-gcm',keyBytes(key),b.subarray(4,16));cipher.setAAD(Buffer.from(FORMAT+':'+label));cipher.setAuthTag(b.subarray(16,32));
 try{return Buffer.concat([cipher.update(b.subarray(32)),cipher.final()]);}catch{throw new Error('INTEGRITY: clave incorrecta o copia alterada.');}
}
export function adapter(sqlite){
 const prepare=(sql,args=[])=>({bind(...values){return prepare(sql,values);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};},sql,args});
 return {prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>({meta:{changes:Number(sqlite.prepare(s.sql).run(...s.args).changes)}}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
function tables(db){return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);}
function identifier(name){if(!/^[a-zA-Z0-9_]+$/.test(name))throw new Error('INTEGRITY: tabla no reconocida.');return '"'+name+'"';}
function normalized(value){if(value instanceof Uint8Array)return {binary:Buffer.from(value).toString('hex')};if(typeof value==='bigint')return String(value);return value;}
export function databaseSummary(db){
 const result={};for(const table of tables(db)){
  const rows=db.prepare('SELECT * FROM '+identifier(table)).all().map(row=>JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(k=>[k,normalized(row[k])])))).sort();
  result[table]={rows:rows.length,sha256:hashBytes(Buffer.from(rows.join('\n')))};
 }return result;
}
export function verifyDatabase(db){
 if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('INTEGRITY: la base tiene referencias inválidas.');
 const available=tables(db);for(const required of ['familias','ninos','usuarios','archivos'])if(!available.includes(required))throw new Error('INTEGRITY: faltan tablas familiares.');
 const files=db.prepare('SELECT a.*,n.familia_id AS owner_family FROM archivos a LEFT JOIN ninos n ON n.id=a.nino_id').all();
 for(const file of files)if(!file.owner_family||file.owner_family!==file.familia_id)throw new Error('ISOLATION: un adjunto no corresponde a su familia.');
 return {tables:databaseSummary(db),families:Number(db.prepare('SELECT COUNT(*) AS n FROM familias').get().n),children:Number(db.prepare('SELECT COUNT(*) AS n FROM ninos').get().n),files:files.length};
}
export function openSnapshot(sql){
 // Only execute authenticated snapshots exported from the trusted database,
 // exclusively in memory. This module never sends SQL to production.
 const db=new DatabaseSync(':memory:');try{db.exec(sql);verifyDatabase(db);return db;}catch(e){db.close();throw e;}
}
export async function createArchive({sql,key,getObject,listObjects=[],at=new Date().toISOString(),maxBytes=100_000_000}){
 keyBytes(key);const db=openSnapshot(sql),objects=new Map(),id=randomUUID();
 try{
  const summary=verifyDatabase(db),manifest={format:FORMAT,id,created_at:at,source:'D1 + adjuntos R2/D1',tables:summary.tables,summary:{families:summary.families,children:summary.children,files:summary.files},files:[],extras:[],objects:[]};
  let total=0;
  const add=(name,plain)=>{const encrypted=encrypt(plain,key,name);total+=encrypted.length;if(total>maxBytes)throw new Error('CAPACITY: la copia excede el límite gratuito interno.');objects.set(name,encrypted);manifest.objects.push({name,bytes:encrypted.length,sha256:hashBytes(encrypted)});return name;};
  add('database.sql.gz.enc',gzipSync(Buffer.from(sql)));manifest.sql_sha256=hashBytes(Buffer.from(sql));
  const files=db.prepare('SELECT * FROM archivos ORDER BY id').all();
  if(files.length+listObjects.length>2000)throw new Error('CAPACITY: demasiados objetos para este lote gratuito.');
  const env={DB:adapter(db),FILES:{async get(name){const bytes=await getObject(name);return bytes?{async arrayBuffer(){return Uint8Array.from(bytes).buffer;}}:null;}}};
  const referenced=new Set();
  for(const file of files){
   const bytes=Buffer.from(await readFileBytes(env,file));
   if(bytes.length!==Number(file.bytes)||(file.sha256&&hashBytes(bytes)!==file.sha256))throw new Error('INTEGRITY: un adjunto no pudo verificarse.');
   const name='objects/'+randomUUID()+'.enc';add(name,bytes);
   manifest.files.push({id:file.id,familia_id:file.familia_id,nino_id:file.nino_id,key:objectKey(file),name,bytes:bytes.length,sha256:hashBytes(bytes)});
   referenced.add(objectKey(file));
  }
  // Preserve unreferenced R2 objects separately, never reattach them to families.
  for(const object of listObjects){if(referenced.has(object.key))continue;const bytes=await getObject(object.key);if(!bytes||bytes.length!==object.size)throw new Error('INTEGRITY: objeto sin referencia incompleto.');const name='objects/'+randomUUID()+'.enc';add(name,bytes);manifest.extras.push({key:object.key,name,bytes:bytes.length,sha256:hashBytes(bytes)});}
  const encryptedManifest=encrypt(Buffer.from(JSON.stringify(manifest)),key,'manifest.enc');total+=encryptedManifest.length;if(total>maxBytes)throw new Error('CAPACITY: la copia excede el límite interno.');objects.set('manifest.enc',encryptedManifest);
  return {id,manifest,objects,bytes:total};
 }finally{db.close();}
}
export function restoreArchive(objects,key){
 const manifest=JSON.parse(decrypt(objects.get('manifest.enc')||Buffer.alloc(0),key,'manifest.enc'));
 if(manifest.format!==FORMAT||!Array.isArray(manifest.objects)||manifest.objects.length>2002)throw new Error('INTEGRITY: manifiesto inválido.');
 for(const object of manifest.objects){const bytes=objects.get(object.name);if(!bytes||bytes.length!==object.bytes||hashBytes(bytes)!==object.sha256)throw new Error('INTEGRITY: falta un objeto o su huella no coincide.');}
 const sql=gunzipSync(decrypt(objects.get('database.sql.gz.enc'),key,'database.sql.gz.enc'),{maxOutputLength:500_000_000}).toString();
 if(hashBytes(Buffer.from(sql))!==manifest.sql_sha256)throw new Error('INTEGRITY: SQL alterado.');
 const db=openSnapshot(sql);
 try{
  const summary=verifyDatabase(db);if(JSON.stringify(summary.tables)!==JSON.stringify(manifest.tables))throw new Error('INTEGRITY: las filas restauradas no coinciden.');
  const files=new Map();const actualRows=db.prepare('SELECT id,familia_id,nino_id,bytes FROM archivos').all();
  if(actualRows.length!==manifest.files.length||new Set(manifest.files.map(f=>f.id)).size!==actualRows.length)throw new Error('ISOLATION: manifiesto de adjuntos incompleto.');
  for(const file of manifest.files){const row=actualRows.find(r=>r.id===file.id);if(!row||row.familia_id!==file.familia_id||row.nino_id!==file.nino_id||Number(row.bytes)!==file.bytes||objectKey(row)!==file.key)throw new Error('ISOLATION: propiedad de adjunto inválida.');const bytes=decrypt(objects.get(file.name),key,file.name);if(bytes.length!==file.bytes||hashBytes(bytes)!==file.sha256)throw new Error('INTEGRITY: adjunto alterado.');files.set(file.key,bytes);}
  // A restored sandbox must not inherit live sessions or guest bearer access.
  for(const table of ['sesiones','sesiones_plataforma'])if(tables(db).includes(table))db.exec('DELETE FROM '+identifier(table));
  if(tables(db).includes('tokens_invitados'))db.exec('UPDATE tokens_invitados SET activo=0');
  return {db,manifest,summary,env:{DB:adapter(db),LOCAL_DEV:true,FILES:{async get(name){const bytes=files.get(name);return bytes?{async arrayBuffer(){return Uint8Array.from(bytes).buffer;}}:null;}},LUSPACE_R2_ENABLED:'true'}};
 }catch(e){db.close();throw e;}
}
