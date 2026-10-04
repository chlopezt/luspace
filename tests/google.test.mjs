import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {localEnv} from '../server/local.js';
import {handle} from '../server/api.js';

test('Google registration and login: browser state, PKCE, verified identity, isolation and no automatic linking', async () => {
  const env = localEnv(mkdtempSync(join(tmpdir(), 'luspace-google-')));
  const origin = 'https://luspace.test'; let ip = 0;
  const call = (path, method='GET', data, cookie='') => handle(new Request(origin+'/api/'+path, {method, headers:{origin,cookie,'CF-Connecting-IP':'google-qa-'+ip++}, body:data ? JSON.stringify(data):undefined}), env);
  const originalFetch = globalThis.fetch;
  let info = {sub:'google-account-1', email:'google@example.test', email_verified:true};
  let verifier;
  globalThis.fetch = async (url, options) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      assert.equal(options.body.get('client_secret'), 'test-secret');
      verifier = options.body.get('code_verifier'); assert.match(verifier, /^[a-f0-9]{64}$/);
      return Response.json({access_token:'test-access-token'});
    }
    assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo');
    assert.equal(options.headers.Authorization, 'Bearer test-access-token');
    return Response.json(info);
  };
  async function start(mode='register') {
    const response = await call('auth/google/start','POST',{mode,nombre:'Usuario Google',familia:'Familia Google',rol:'platform'});
    assert.equal(response.status,200);
    const url = new URL((await response.json()).url);
    assert.equal(url.origin,'https://accounts.google.com');
    assert.equal(url.searchParams.get('scope'),'openid email profile');
    assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    return {state:url.searchParams.get('state'),cookie:response.headers.get('set-cookie').split(';')[0], challenge:url.searchParams.get('code_challenge')};
  }
  const finish = f => call('auth/google/callback?code=qa&state='+f.state,'GET',undefined,f.cookie);
  try {
    await call('setup','POST',{nombre:'Original',familia:'Original',correo:'existing@example.test',password:'PasswordOriginal123'});
    assert.equal((await call('status').then(r=>r.json())).google,false);
    assert.equal((await call('auth/google/start','POST',{})).status,400);
    Object.assign(env,{GOOGLE_CLIENT_ID:'test-id',GOOGLE_CLIENT_SECRET:'test-secret',GOOGLE_REDIRECT_URI:origin+'/api/auth/google/callback'});
    assert.equal((await call('status').then(r=>r.json())).google,true);
    assert.equal((await call('auth/google/start','POST',{mode:'register'})).status,400);
    const f = await start();
    assert.match(f.cookie,/luspace_google=/);
    const missing = await call('auth/google/callback?code=qa&state='+f.state);
    assert.match(missing.headers.get('location'),/google_error/);
    const registered = await finish(f);
    assert.equal(registered.headers.get('location'),'/');
    const expectedChallenge = Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
    assert.equal(f.challenge,expectedChallenge);
    const sessionCookie = registered.headers.getSetCookie().find(x=>x.startsWith('luspace_session=')).split(';')[0];
    const me = await call('me','GET',undefined,sessionCookie).then(r=>r.json());
    assert.equal(me.rol,'superadmin'); assert.equal(me.subscription.subscription_status,'trial'); assert.equal(me.subscription.storage_limit_bytes,52428800);
    assert.deepEqual(await call('children','GET',undefined,sessionCookie).then(r=>r.json()),[]);
    assert.equal((await call('platform/overview','GET',undefined,sessionCookie)).status,401);
    assert.equal(await env.DB.prepare('SELECT * FROM credenciales_usuario WHERE usuario_id=?').bind(me.id).first(),null);
    assert.equal((await call('password','PUT',{actual:'irrelevant123',nueva:'NewPassword123'},sessionCookie)).status,400);
    assert.match((await finish(f)).headers.get('location'),/google_error/);
    assert.equal((await finish(await start('login'))).headers.get('location'),'/');
    const count = (await env.DB.prepare('SELECT count(*) n FROM familias').first()).n;
    info = {sub:'unverified', email:'unverified@example.test', email_verified:false};
    assert.match((await finish(await start())).headers.get('location'),/google_error/);
    info = {sub:'different', email:'existing@example.test', email_verified:true};
    assert.match(decodeURIComponent((await finish(await start())).headers.get('location')),/no se vinculó/);
    info = {sub:'not-registered',email:'unknown@example.test',email_verified:true};
    assert.match((await finish(await start('login'))).headers.get('location'),/google_error/);
    const expired = await start();
    await env.DB.prepare("UPDATE oauth_google_estados SET expira_at='2000-01-01'").run();
    assert.match((await finish(expired)).headers.get('location'),/google_error/);
    const canceled = await start();
    assert.match((await call('auth/google/callback?error=access_denied&state='+canceled.state,'GET',undefined,canceled.cookie)).headers.get('location'),/google_error/);
    const closed = await start(); env.LUSPACE_REGISTRATION_ENABLED='false';
    assert.match((await finish(closed)).headers.get('location'),/google_error/);
    assert.equal((await env.DB.prepare('SELECT count(*) n FROM familias').first()).n,count);
    env.LUSPACE_REGISTRATION_ENABLED='true';
    await env.DB.prepare('UPDATE usuarios SET activo=0 WHERE id=?').bind(me.id).run();
    info = {sub:'google-account-1',email:'google@example.test',email_verified:true};
    assert.match((await finish(await start('login'))).headers.get('location'),/google_error/);
  } finally {globalThis.fetch=originalFetch; env.close();}
});
