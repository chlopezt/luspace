import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {base32,totp,sealSecret,openSecret} from '../server/platform-mfa.js';
import {hash} from '../server/security.js';

test('RFC 6238 vectors, authenticated encryption, no plaintext seed and account binding',async()=>{
 const secret=base32(new TextEncoder().encode('12345678901234567890'));
 for(const [at,expected]of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])assert.equal(await totp(secret,at*1000,8),expected);
 const encrypted=await sealSecret(secret,'AdminPassword!2026','account-a');assert.ok(!encrypted.includes(secret));assert.equal(await openSecret(encrypted,'AdminPassword!2026','account-a'),secret);
 await assert.rejects(openSecret(encrypted,'wrong','account-a'));
 await assert.rejects(openSecret(encrypted,'AdminPassword!2026','account-b'));
 assert.notEqual(await sealSecret(secret,'AdminPassword!2026','account-a'),encrypted);
});

test('platform MFA: opt-in confirmation, session revocation, single-use codes, recovery, fresh sensitive actions and disable verification',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-mfa-')));let cookie='';
 const call=async(path,method='GET',data)=>{const r=await handle(new Request('http://localhost:5173/api/'+path,{method,headers:{origin:'http://localhost:5173',cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return{status:r.status,body:await r.json(),setCookie:c};};
 try{
  assert.equal((await call('platform/mfa')).status,401);
  await call('setup','POST',{nombre:'QA',familia:'QA MFA',correo:'mfa-family@example.test',password:'FamilyPassword!2026'});
  const me=(await call('me')).body,familyCookie=cookie;
  await env.DB.prepare('INSERT INTO administradores_plataforma(usuario_id) VALUES(?)').bind(me.id).run();
  await call('platform/enroll','POST',{correo:'mfa-admin@example.test',current_password:'FamilyPassword!2026',password:'AdminPassword!2026'});
  const login={correo:'mfa-admin@example.test',password:'AdminPassword!2026'};
  assert.equal((await call('platform/login','POST',login)).status,200);const oldCookie=cookie;
  await call('platform/login','POST',login);const current=cookie;
  assert.equal((await call('platform/mfa')).body.enabled,false);
  assert.equal((await call('platform/mfa/setup','POST',{admin_password:'wrong'})).status,401);
  const setup=await call('platform/mfa/setup','POST',{admin_password:login.password});assert.equal(setup.status,200);assert.ok(setup.body.uri.startsWith('otpauth://totp/'));const secret=setup.body.secret;
  const stored=await env.DB.prepare('SELECT * FROM plataforma_mfa WHERE usuario_id=?').bind(me.id).first();assert.equal(stored.activo,0);assert.ok(!stored.pendiente_cifrado.includes(secret));assert.equal(stored.secreto_cifrado,null);
  const code=await totp(secret);
  assert.equal((await call('platform/mfa/enable','POST',{admin_password:login.password,code:'not-valid'})).status,401);
  const activated=await call('platform/mfa/enable','POST',{admin_password:login.password,code});assert.equal(activated.status,200);assert.equal(activated.body.recovery_codes.length,10);
  const recovery=activated.body.recovery_codes;
  const hashes=(await env.DB.prepare('SELECT codigo_hash FROM plataforma_mfa_recuperacion WHERE usuario_id=?').bind(me.id).all()).results;
  assert.ok(!JSON.stringify(hashes).includes(recovery[0]));
  cookie=oldCookie;assert.equal((await call('platform/me')).status,401);
  cookie=current;assert.equal((await call('platform/me')).body.mfa_enabled,true);
  cookie=familyCookie;assert.equal((await call('me')).status,200);assert.equal((await call('platform/mfa')).status,401);
  cookie='';const challenge=await call('platform/login','POST',login);assert.equal(challenge.body.mfa_required,true);assert.ok(!challenge.setCookie.includes('Max-Age=3600'));assert.equal((await call('platform/me')).status,401);
  const replay=await call('platform/login','POST',{...login,mfa_code:code});assert.equal(replay.status,401);
  assert.equal((await call('platform/login','POST',{...login,mfa_code:recovery[0]})).status,200);const recoveredCookie=cookie;
  assert.equal((await call('platform/mfa')).body.recovery_remaining,9);
  assert.equal((await call('platform/login','POST',{...login,mfa_code:recovery[0]})).status,401);
  cookie=recoveredCookie;
  const session=await hash(cookie.split('=')[1]);await env.DB.prepare('UPDATE sesiones_plataforma SET mfa_verified_at=? WHERE id=?').bind(Date.now()-960000,session).run();
  assert.equal((await call('platform/manual-payments','POST',{})).status,403);assert.equal((await call('platform/overview')).status,200);
  const refreshed=await call('platform/mfa/verify','POST',{admin_password:login.password,code:recovery[1]});assert.equal(refreshed.status,200);
  assert.equal((await call('platform/manual-payments','POST',{})).status,401); // now reaches password check, not stale MFA guard
  assert.equal((await call('platform/mfa/disable','POST',{admin_password:'wrong',code:recovery[2]})).status,401);
  assert.equal((await call('platform/mfa/disable','POST',{admin_password:login.password,code:'bad'})).status,401);
  assert.equal((await call('platform/mfa/disable','POST',{admin_password:login.password,code:recovery[2]})).status,200);
  assert.equal((await call('platform/mfa')).body.enabled,false);
  assert.equal((await call('platform/login','POST',login)).body.ok,true);
  const audit=await env.DB.prepare('SELECT descripcion FROM auditoria_plataforma').all();assert.ok(!JSON.stringify(audit).includes(secret));assert.ok(!JSON.stringify(audit).includes(recovery[0]));
  const ui=readFileSync(new URL('../src/AdminPortal.tsx',import.meta.url),'utf8');assert.ok(ui.includes('name="mfa_code"'));assert.ok(ui.includes('mfa_required'));
 }finally{env.close();}
});
