import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';
import {defaultSiteConfig,validateSiteConfig} from '../shared/site-config.js';
import {hash} from '../server/security.js';
test('CMS: public read, platform-only write, validation, persistence and revision conflict',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'luspace-cms-'));let env=localEnv(dir);
 const call=async(path,method='GET',data,cookie='',origin='http://localhost:5192')=>{
   const response=await handle(new Request('http://localhost:5192/api/'+path,{method,headers:{origin,cookie,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)}),env);
   return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 };
 try{
   assert.deepEqual((await call('site-config')).body.config,defaultSiteConfig);
   assert.equal((await call('platform/site-config')).status,401);
   const registration=await call('setup','POST',{nombre:'Prueba CMS',familia:'Familia QA',correo:'cms@example.test',password:'CmsTesting!2026'});
   assert.equal(registration.status,201);
   const familyCookie=registration.cookie;
   assert.equal((await call('platform/site-config','PUT',{config:defaultSiteConfig,revision:0},familyCookie)).status,401);
   const user=(await call('me','GET',undefined,familyCookie)).body;
   await env.DB.prepare('INSERT INTO administradores_plataforma(usuario_id) VALUES(?)').bind(user.id).run();
   const raw='a'.repeat(64);
   await env.DB.prepare('INSERT INTO sesiones_plataforma(id,usuario_id,expira_at) VALUES(?,?,?)').bind(await hash(raw),user.id,new Date(Date.now()+3600000).toISOString()).run();
   const cookie='luspace_platform='+raw;
   assert.equal((await call('platform/site-config','GET',undefined,cookie)).status,200);
   const config=structuredClone(defaultSiteConfig);config.hero_title='Cuidado conectado desde el CMS';config.banner={enabled:true,type:'promotion',text:'Prueba de aviso'};config.faqs.reverse();config.contact.whatsapp='+56912345678';
   assert.equal((await call('platform/site-config','PUT',{config,revision:0},cookie,'https://wrong.test')).status,403);
   assert.equal((await call('platform/site-config','PUT',{config:{...config,hero_title:'<script>alert(1)</script>'},revision:0},cookie)).status,400);
   assert.equal((await call('platform/site-config','PUT',{config:{...config,contact:{...config.contact,instagram:'javascript:alert(1)'}},revision:0},cookie)).status,400);
   assert.equal((await call('platform/site-config','PUT',{config,revision:0},cookie)).status,200);
   assert.deepEqual((await call('site-config')).body.config,config);
   assert.equal((await call('platform/site-config','PUT',{config,revision:0},cookie)).status,409);
   assert.equal((await env.DB.prepare("SELECT count(*) n FROM auditoria_plataforma WHERE accion='SITE_CONFIG_UPDATE'").first()).n,1);
   assert.deepEqual(Object.keys((await call('site-config')).body).sort(),['config','revision','updated_at']);
   env.close();env=localEnv(dir);assert.equal((await call('site-config')).body.config.hero_title,config.hero_title);
   assert.equal((await env.DB.prepare('SELECT count(*) n FROM familias').first()).n,1);
 }finally{env.close();rmSync(dir,{recursive:true,force:true});}
});
test('CMS rejects invalid banner, empty FAQ and malformed WhatsApp',()=>{
 for(const patch of [{banner:{enabled:true,type:'info',text:''}},{faqs:[{question:'',answer:'x'}]},{contact:{...defaultSiteConfig.contact,whatsapp:'bad'}},{faqs:Array(31).fill({question:'a',answer:'b'})}])assert.throws(()=>validateSiteConfig({...defaultSiteConfig,...patch}));
});
