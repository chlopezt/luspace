import {models,modules} from '../shared/models.js';
import {canAccess,fieldAllowed,projectAnamnesis} from '../shared/access-policy.js';
const ids=value=>{try{const x=JSON.parse(value||'[]');return Array.isArray(x)?x.filter(v=>typeof v==='string'):[];}catch{return [];}};
const sensitiveFor=(table,field)=>table==='examenes_medicos'?['examenes']:table==='consultas_medicas'?['examenes','recetas']:field==='foto_perfil_id'?['foto_perfil']:[];

// Metadata only. Never return storage keys, hashes, contents or foreign family rows.
export async function fileCatalog(db,actor,permission,visibleModules){
 const p=permission||{}, hidden=actor.rol!=='superadmin'&&p.privacidad?.includes('archivos');
 const policyActor={...actor,permisos_json:JSON.stringify(p)};
 visibleModules=visibleModules.filter(module=>canAccess(policyActor,module));
 if(hidden||!visibleModules.length||(actor.rol!=='superadmin'&&!actor.guest&&!p.acciones?.includes('ver')))return [];
 const rows=(await db.prepare('SELECT a.id,a.nino_id,a.modulo,a.nombre,a.mime,a.bytes,a.created_at,n.primer_nombre FROM archivos a JOIN ninos n ON n.id=a.nino_id AND n.familia_id=a.familia_id WHERE a.familia_id=? ORDER BY a.created_at DESC,a.id DESC').bind(actor.familia_id).all()).results;
 const references=new Map();
 const add=(id,child,module,label,sensitive=[],forbidden=false)=>{if(!id)return;const key=child+'/'+module+'/'+id;const refs=references.get(key)||[];refs.push({label,sensitive,forbidden});references.set(key,refs);};
 for(const [table,model] of Object.entries(models)){
  if(!visibleModules.includes(model.module))continue;
  const fields=model.fields.filter(f=>f.type==='file'||f.type==='files');
  if(!fields.length)continue;
  const columns=fields.map(f=>f.key).join(',');
  const sql=table==='ninos'?`SELECT id AS child,${columns} FROM ninos WHERE familia_id=?`:`SELECT r.nino_id AS child,${fields.map(f=>'r.'+f.key).join(',')} FROM ${table} r JOIN ninos n ON n.id=r.nino_id WHERE n.familia_id=?`;
  const records=(await db.prepare(sql).bind(actor.familia_id).all()).results;
  for(const r of records)for(const f of fields)for(const id of f.type==='files'?ids(r[f.key]):[r[f.key]])add(id,r.child,model.module,model.title+' · '+f.label,sensitiveFor(table,f.key),!fieldAllowed(policyActor,table,f.key));
 }
 if(visibleModules.includes('anamnesis')){
  const records=(await db.prepare('SELECT a.nino_id,a.documento_json FROM anamnesis a JOIN ninos n ON n.id=a.nino_id WHERE n.familia_id=?').bind(actor.familia_id).all()).results;
  for(const r of records){let doc;try{doc=JSON.parse(r.documento_json||'{}');}catch{continue;}const visible=projectAnamnesis(policyActor,doc);for(const [key,section] of Object.entries(doc))for(const id of Array.isArray(section?.archivos)?section.archivos:[])add(id,r.nino_id,'anamnesis','Anamnesis',['anamnesis'],!visible[key]?.archivos);}
 }
 return rows.filter(f=>visibleModules.includes(f.modulo)&&(!actor.guest||f.nino_id===actor.nino_id)).flatMap(f=>{
  const refs=references.get(f.nino_id+'/'+f.modulo+'/'+f.id)||[];
  if(refs.some(r=>r.forbidden))return [];
  const sensitive=new Set(refs.flatMap(r=>r.sensitive));
  if(f.modulo==='rnd')sensitive.add('rnd');if(f.modulo==='anamnesis')sensitive.add('anamnesis');
  // Old health attachments cannot be safely classified as non-sensitive.
  if(!refs.length&&f.modulo==='salud'){sensitive.add('examenes');sensitive.add('recetas');}
  if(actor.rol!=='superadmin'&&Array.isArray(p.sensibles)&&[...sensitive].some(s=>!p.sensibles.includes(s)))return [];
  return [{id:f.id,nino_id:f.nino_id,nino_nombre:f.primer_nombre,modulo:f.modulo,seccion:modules[f.modulo],origen:[...new Set(refs.map(r=>r.label))].join(' / ')||modules[f.modulo]+' · Adjunto sin registro vinculado',nombre:f.nombre,mime:f.mime,bytes:f.bytes,created_at:f.created_at,can_download:actor.rol==='superadmin'||(!actor.guest&&p.acciones?.includes('descargar'))}];
 });
}
