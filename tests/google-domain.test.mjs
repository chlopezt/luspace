import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {startGoogle,finishGoogle,googleRedirect} from '../server/google-auth.js';

test('OAuth keeps owned hosts isolated and uses the same callback for authorization and exchange',async()=>{
  const env=localEnv(mkdtempSync(join(tmpdir(),'luspace-domain-')));
  Object.assign(env,{GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_REDIRECT_URI:'https://luspace-app.pages.dev/api/auth/google/callback'});
  const originalFetch=globalThis.fetch;
  try{
    for(const origin of ['https://luspace.cl','https://luspace-app.pages.dev']){
      const req=new Request(origin+'/api/auth/google/start');
      const flow=await startGoogle(req,env,{mode:'login'});
      const url=new URL(flow.url),callback=origin+'/api/auth/google/callback';
      assert.equal(url.searchParams.get('redirect_uri'),callback);
      assert.ok(!flow.cookie.includes('Domain='));
      globalThis.fetch=async(endpoint,options)=>{
        if(endpoint==='https://oauth2.googleapis.com/token'){
          assert.equal(options.body.get('redirect_uri'),callback);
          return Response.json({access_token:'fictional'});
        }
        return Response.json({sub:'fictional',email:'fictional@example.test',email_verified:true});
      };
      const cb=new Request(callback+'?code=fictional&state='+url.searchParams.get('state'),{headers:{cookie:flow.cookie.split(';')[0]}});
      assert.equal((await finishGoogle(cb,env)).flow.redirect_uri,callback);
      await assert.rejects(()=>finishGoogle(cb,env));
    }
    for(const host of ['https://attacker.test','https://luspace.cl.attacker.test','http://luspace.cl','https://www.luspace.cl']){
      assert.throws(()=>googleRedirect(new Request(host+'/api/auth/google/start'),env));
    }
    const f=await startGoogle(new Request('https://luspace.cl/api/auth/google/start'),env,{mode:'login'});
    await assert.rejects(()=>finishGoogle(new Request(env.GOOGLE_REDIRECT_URI+'?code=fictional&state='+new URL(f.url).searchParams.get('state'),{headers:{cookie:f.cookie.split(';')[0]}}),env),/dominio/);
  }finally{globalThis.fetch=originalFetch;env.close();}
});

