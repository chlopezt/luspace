import {hash,token,uid} from './security.js';
const enc=new TextEncoder(),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const sql=(db,q,...args)=>db.prepare(q).bind(...args);
const audit=(db,id,action)=>sql(db,'INSERT INTO auditoria_plataforma(id,usuario_id,accion,descripcion) VALUES(?,?,?,?)',uid(),id,action,'Gestión de segundo factor administrativo; sin claves ni códigos.');
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const bytes=hex=>Uint8Array.from(hex.match(/../g)||[],v=>parseInt(v,16));
export function base32(data){let value=0,bits=0,out='';for(const b of data){value=(value<<8)|b;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function unbase32(secret){let value=0,bits=0,out=[];for(const c of secret){const i=alphabet.indexOf(c);if(i<0)throw Error('Invalid base32');value=(value<<5)|i;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return new Uint8Array(out);}
export async function totp(secret,at=Date.now(),digits=6){
 const counter=new Uint8Array(8);new DataView(counter.buffer).setBigUint64(0,BigInt(Math.floor(at/30000)));
 const key=await crypto.subtle.importKey('raw',unbase32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const h=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter)),off=h[h.length-1]&15;
 const n=((h[off]&127)*16777216)+(h[off+1]<<16)+(h[off+2]<<8)+h[off+3];
 return String(n%10**digits).padStart(digits,'0');
}
const same=(a,b)=>{let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return diff===0;};
async function matchingStep(secret,code,at=Date.now()){
 if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;
 const step=Math.floor(at/30000);let found=null;
 for(const shift of [-1,0,1])if(same(await totp(secret,(step+shift)*30000),code))found=step+shift;
 return found;
}
async function encryptionKey(password,salt){
 const base=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function sealSecret(secret,password,id){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('LuSpace/admin/mfa/'+id)},await encryptionKey(password,salt),enc.encode(secret));
 return JSON.stringify({v:1,salt:hex(salt),iv:hex(iv),data:hex(new Uint8Array(encrypted))});
}
export async function openSecret(stored,password,id){
 try{const s=JSON.parse(stored);if(s.v!==1)throw Error('Version');const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(s.iv),additionalData:enc.encode('LuSpace/admin/mfa/'+id)},await encryptionKey(password,bytes(s.salt)),bytes(s.data));return new TextDecoder().decode(raw);}
 catch{fail(401,'No se pudo verificar el segundo factor. Revisa tu contraseña administrativa.');}
}
const recoveryHash=(id,code)=>hash('LuSpace/admin/recovery/'+id+'/'+code.replace(/[-\s]/g,'').toUpperCase());
export async function mfaStatus(db,id){
 const row=await sql(db,'SELECT activo,activado_at FROM plataforma_mfa WHERE usuario_id=?',id).first();
 const count=await sql(db,'SELECT COUNT(*) AS n FROM plataforma_mfa_recuperacion WHERE usuario_id=? AND usado_at IS NULL',id).first();
 return {enabled:!!row?.activo,enabled_at:row?.activado_at||null,recovery_remaining:count.n};
}
export async function beginMfa(db,id,mail,password){
 const current=await mfaStatus(db,id);if(current.enabled)fail(409,'El 2FA ya está activo. No se reemplaza sin verificar el acceso actual.');
 const secret=base32(crypto.getRandomValues(new Uint8Array(20))),sealed=await sealSecret(secret,password,id);
 await db.batch([sql(db,'INSERT INTO plataforma_mfa(usuario_id,pendiente_cifrado,pendiente_expira_at) VALUES(?,?,?) ON CONFLICT(usuario_id) DO UPDATE SET pendiente_cifrado=excluded.pendiente_cifrado,pendiente_expira_at=excluded.pendiente_expira_at',id,sealed,Date.now()+600000),audit(db,id,'MFA_SETUP_STARTED')]);
 return {secret,uri:'otpauth://totp/'+encodeURIComponent('LuSpace:'+mail)+'?'+new URLSearchParams({secret,issuer:'LuSpace',algorithm:'SHA1',digits:'6',period:'30'}),expires_in:600};
}
export async function enableMfa(db,id,password,code,sessionId){
 const row=await sql(db,'SELECT * FROM plataforma_mfa WHERE usuario_id=?',id).first();
 if(!row||row.activo||!row.pendiente_cifrado||row.pendiente_expira_at<=Date.now())fail(409,'La configuración venció o ya se activó. Comienza nuevamente.');
 const step=await matchingStep(await openSecret(row.pendiente_cifrado,password,id),code);if(step===null)fail(401,'Código incorrecto. Revisa la hora automática de tu teléfono.');
 const recovery=Array.from({length:10},()=>token().slice(0,24).toUpperCase().match(/.{6}/g).join('-'));
 const hashes=await Promise.all(recovery.map(c=>recoveryHash(id,c)));
 const activation=uid();
 // All changes, invalidation of older sessions and recovery hashes commit together.
 const result=await db.batch([
  sql(db,'UPDATE plataforma_mfa SET activo=1,secreto_cifrado=pendiente_cifrado,pendiente_cifrado=NULL,pendiente_expira_at=NULL,ultimo_paso=?,activacion_id=?,activado_at=CURRENT_TIMESTAMP WHERE usuario_id=? AND activo=0 AND pendiente_cifrado=? AND pendiente_expira_at>?',step,activation,id,row.pendiente_cifrado,Date.now()),
  ...hashes.map(h=>sql(db,'INSERT INTO plataforma_mfa_recuperacion(usuario_id,codigo_hash) SELECT ?,? WHERE EXISTS(SELECT 1 FROM plataforma_mfa WHERE usuario_id=? AND activacion_id=?)',id,h,id,activation)),
  sql(db,'DELETE FROM sesiones_plataforma WHERE usuario_id=? AND id<>? AND EXISTS(SELECT 1 FROM plataforma_mfa WHERE usuario_id=? AND activacion_id=?)',id,sessionId,id,activation),
  sql(db,'UPDATE sesiones_plataforma SET mfa_verified_at=? WHERE id=? AND usuario_id=? AND EXISTS(SELECT 1 FROM plataforma_mfa WHERE usuario_id=? AND activacion_id=?)',Date.now(),sessionId,id,id,activation),
  sql(db,'INSERT INTO auditoria_plataforma(id,usuario_id,accion,descripcion) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM plataforma_mfa WHERE usuario_id=? AND activacion_id=?)',uid(),id,'MFA_ENABLED','Segundo factor activado y sesiones antiguas cerradas.',id,activation)
 ]);
 if(result[0].meta.changes!==1)fail(409,'La configuración cambió. Actualiza y revisa el estado del 2FA.');
 return {enabled:true,recovery_codes:recovery};
}
export async function proveMfa(db,id,password,code){
 const row=await sql(db,'SELECT * FROM plataforma_mfa WHERE usuario_id=?',id).first();if(!row?.activo)return false;
 if(typeof code!=='string'||code.length>100)fail(401,'Ingresa el código de tu autenticador o uno de recuperación.');
 let changed;
 if(/^\d{6}$/.test(code)){
  const step=await matchingStep(await openSecret(row.secreto_cifrado,password,id),code);
  if(step===null)fail(401,'Código incorrecto o vencido.');
  if(step<=row.ultimo_paso)fail(401,'Ese código ya se utilizó. Espera el siguiente código de tu autenticador.');
  changed=await sql(db,'UPDATE plataforma_mfa SET ultimo_paso=? WHERE usuario_id=? AND activo=1 AND ultimo_paso<?',step,id,step).run();
 }else{
  if(!/^[A-Fa-f0-9-\s]{24,40}$/.test(code))fail(401,'Código de recuperación inválido.');
  changed=await sql(db,'UPDATE plataforma_mfa_recuperacion SET usado_at=CURRENT_TIMESTAMP WHERE usuario_id=? AND codigo_hash=? AND usado_at IS NULL',id,await recoveryHash(id,code)).run();
 }
 if(changed.meta.changes!==1)fail(401,'Código incorrecto, vencido o ya utilizado.');
 return true;
}
export async function refreshMfa(db,id,password,code,sessionId){
 if(!await proveMfa(db,id,password,code))fail(409,'El 2FA no está activo.');
 await db.batch([sql(db,'UPDATE sesiones_plataforma SET mfa_verified_at=? WHERE id=? AND usuario_id=?',Date.now(),sessionId,id),audit(db,id,'MFA_REVERIFIED')]);return {ok:true};
}
export async function disableMfa(db,id,password,code,sessionId){
 if(!await proveMfa(db,id,password,code))fail(409,'El 2FA ya está desactivado.');
 await db.batch([sql(db,'DELETE FROM plataforma_mfa_recuperacion WHERE usuario_id=?',id),sql(db,'DELETE FROM plataforma_mfa WHERE usuario_id=?',id),sql(db,'DELETE FROM sesiones_plataforma WHERE usuario_id=? AND id<>?',id,sessionId),sql(db,'UPDATE sesiones_plataforma SET mfa_verified_at=0 WHERE id=?',sessionId),audit(db,id,'MFA_DISABLED')]);return {enabled:false};
}
