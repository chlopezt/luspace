import { token, hash } from './security.js';

export const googleEnabled = env => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
export const googleCookie = (req, value, age = 600) => `luspace_google=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
const reject = message => { throw Object.assign(new Error(message), { status: 400 }); };
const query = (db, sql, ...args) => db.prepare(sql).bind(...args);
export async function startGoogle(req, env, input) {
  if (!googleEnabled(env)) reject('El acceso con Google aún no está configurado. Usa correo y contraseña.');
  const mode = input.mode === 'register' ? 'register' : 'login';
  const name = typeof input.nombre === 'string' ? input.nombre.trim() : '';
  const family = typeof input.familia === 'string' ? input.familia.trim() : '';
  if (mode === 'register' && (!name || !family || name.length > 120 || family.length > 120)) reject('Completa tu nombre y el nombre de la familia antes de continuar con Google.');
  const state = token(), browser = token(), verifier = token();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await query(env.DB, 'DELETE FROM oauth_google_estados WHERE expira_at<=?', new Date().toISOString()).run();
  await query(env.DB, 'INSERT INTO oauth_google_estados(id,navegador_hash,verifier,modo,nombre,familia,expira_at) VALUES(?,?,?,?,?,?,?)', await hash(state), await hash(browser), verifier, mode, name, family, new Date(Date.now() + 600000).toISOString()).run();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account'}).toString();
  return {url: url.href, cookie: googleCookie(req, browser)};
}

export async function finishGoogle(req, env) {
  if (!googleEnabled(env)) reject('El acceso con Google aún no está configurado.');
  const url = new URL(req.url), state = url.searchParams.get('state') || '';
  const browser = req.headers.get('cookie')?.match(/(?:^|;\s*)luspace_google=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!browser || !/^[a-f0-9]{64}$/.test(state)) reject('La solicitud de Google venció. Vuelve a intentarlo.');
  // Consume una sola vez, vinculada al navegador que inició el flujo.
  const flow = await query(env.DB, 'DELETE FROM oauth_google_estados WHERE id=? AND navegador_hash=? AND expira_at>? RETURNING *', await hash(state), await hash(browser), new Date().toISOString()).first();
  if (!flow) reject('La solicitud de Google venció o ya se utilizó.');
  if (url.searchParams.has('error')) reject('No se autorizó el acceso con Google. Puedes usar correo y contraseña.');
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) reject('Respuesta de Google inválida.');
  const response = await fetch('https://oauth2.googleapis.com/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({code, client_id:env.GOOGLE_CLIENT_ID, client_secret:env.GOOGLE_CLIENT_SECRET, redirect_uri:env.GOOGLE_REDIRECT_URI, grant_type:'authorization_code', code_verifier:flow.verifier}), signal:AbortSignal.timeout(15000)});
  const tokens = await response.json();
  if (!response.ok || typeof tokens.access_token !== 'string') reject('Google no pudo confirmar tu acceso. Vuelve a intentarlo.');
  // No confiamos en un JWT decodificado: identidad obtenida directamente de Google
  // mediante el token de acceso intercambiado por el servidor con PKCE.
  const infoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {headers:{Authorization:'Bearer ' + tokens.access_token}, signal:AbortSignal.timeout(15000)});
  const info = await infoResponse.json();
  if (!infoResponse.ok || info.email_verified !== true || typeof info.sub !== 'string' || !info.sub || info.sub.length > 255 || typeof info.email !== 'string') reject('Google no confirmó un correo verificado.');
  return {flow, subject:info.sub, email:info.email.trim().toLowerCase()};
}
