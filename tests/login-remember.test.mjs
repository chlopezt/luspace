import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {localEnv} from '../server/local.js';import {handle} from '../server/api.js';
test('remember controls browser persistence without increasing the eight-hour server session',async()=>{
 const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-login-')));
 const call=(path,data)=>handle(new Request('http://localhost:5173/api/'+path,{method:'POST',headers:{origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify(data)}),env);
 try{
 assert.equal((await call('setup',{nombre:'QA',familia:'QA',correo:'login-remember@example.test',password:'FamilyPassword!2026'})).status,201);
 const base={correo:'login-remember@example.test',password:'FamilyPassword!2026'};
 const temporary=await call('login',{...base,remember:false});assert.equal(temporary.status,200);assert.doesNotMatch(temporary.headers.get('set-cookie'),/Max-Age|Expires/);assert.match(temporary.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
 const remembered=await call('login',{...base,remember:true});assert.equal(remembered.status,200);assert.match(remembered.headers.get('set-cookie'),/Max-Age=28800/);
 const legacy=await call('login',base);assert.match(legacy.headers.get('set-cookie'),/Max-Age=28800/);
 const rows=(await env.DB.prepare('SELECT expira_at FROM sesiones').all()).results;
 for(const row of rows)assert.ok(Date.parse(row.expira_at)<=Date.now()+28800000);
 }finally{env.close();}
});
