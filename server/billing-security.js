// Foundation only: no network calls, no charges, no family activation.
const encoder = new TextEncoder();
const invalid = message => { throw Object.assign(new Error(message), {status:400}); };
export const billingTopics = new Set(['subscription_preapproval','subscription_authorized_payment','payment']);

export function billingConfiguration(env) {
  // Fail closed: credentials alone cannot enable production or test checkout.
  const mode = env.LUSPACE_BILLING_MODE;
  if (!['test','production'].includes(mode)) return {enabled:false,mode:'disabled'};
  if (mode==='production' && env.LUSPACE_BILLING_LIVE_APPROVED!=='true')
    return {enabled:false,mode:'disabled'};
  const amount = Number(env.LUSPACE_BILLING_AMOUNT_CLP);
  const ready = typeof env.MP_ACCESS_TOKEN==='string' && !!env.MP_ACCESS_TOKEN.trim()
    && typeof env.MP_WEBHOOK_SECRET==='string' && !!env.MP_WEBHOOK_SECRET.trim()
    && Number.isSafeInteger(amount) && amount>0;
  return {enabled:!!ready,mode,amount:ready?amount:null,currency:'CLP'};
}

export async function verifyBillingSignature(req, secret, now=Date.now()) {
  if (typeof secret!=='string' || !secret.trim()) return false;
  const url = new URL(req.url);
  const ids = url.searchParams.getAll('data.id');
  const requestId = req.headers.get('x-request-id');
  // Require all signed components; reject ambiguous queries and delimiters.
  if (ids.length!==1 || !/^[a-zA-Z0-9_-]{1,128}$/.test(ids[0])
      || !requestId || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) return false;
  const signature = req.headers.get('x-signature') || '';
  const fields = signature.split(',').map(part=>part.trim().split('='));
  if (fields.length!==2 || fields.some(parts=>parts.length!==2)
      || fields.filter(([key])=>key==='ts').length!==1
      || fields.filter(([key])=>key==='v1').length!==1) return false;
  const values = Object.fromEntries(fields), ts=values.ts, v1=values.v1;
  if (!/^\d{10,13}$/.test(ts) || !/^[a-fA-F0-9]{64}$/.test(v1)) return false;
  const timestamp = ts.length===10 ? Number(ts)*1000 : Number(ts);
  // Retried notifications receive a fresh signature; stale ones cannot be replayed.
  if (Math.abs(now-timestamp)>5*60*1000) return false;
  const manifest=`id:${ids[0].toLowerCase()};request-id:${requestId};ts:${ts};`;
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes=Uint8Array.from(v1.match(/../g),value=>parseInt(value,16));
  return crypto.subtle.verify('HMAC',key,bytes,encoder.encode(manifest));
}

export function validateBillingNotification(req, payload, mode) {
  const id=new URL(req.url).searchParams.get('data.id');
  if (!payload || !billingTopics.has(payload.type) || String(payload.data?.id)!==id)
    invalid('Notificación de pago inválida.');
  if (typeof payload.live_mode!=='boolean' || payload.live_mode!==(mode==='production'))
    invalid('La notificación no corresponde al entorno de pagos.');
  // Store identifiers, not the untrusted raw body or customer/clinical information.
  return {topic:payload.type,resourceId:id,requestId:req.headers.get('x-request-id')};
}

export function assertProviderSubscription(record, provider, expectedSellerId) {
  // Must run after retrieving the resource through the authenticated provider API.
  if (!record.provider_id || String(provider.id)!==record.provider_id
      || provider.external_reference!==record.external_reference
      || String(provider.collector_id)!==String(expectedSellerId)
      || !['pending','authorized','paused','cancelled'].includes(provider.status)
      || provider.auto_recurring?.currency_id!=='CLP'
      || provider.auto_recurring?.transaction_amount!==record.amount_clp
      || provider.auto_recurring?.frequency!==1
      || provider.auto_recurring?.frequency_type!=='months')
    invalid('La suscripción no coincide con el registro de la familia.');
  // Authorization alone is NOT proof of an approved payment.
  return provider.status;
}
