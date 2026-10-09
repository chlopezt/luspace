import {activeBilling} from './billing.js';
export async function subscription(db,familyId,env={}) {
  await db.prepare("UPDATE familias SET subscription_status='expired' WHERE id=? AND commercial_exempt=0 AND manual_access_managed=1 AND subscription_status='active' AND julianday(manual_paid_until)<=julianday('now')").bind(familyId).run();
  await db.prepare("UPDATE familias SET subscription_status='expired' WHERE id=? AND commercial_exempt=0 AND subscription_status='trial' AND (trial_ends_at IS NULL OR julianday(trial_ends_at)<=julianday('now'))").bind(familyId).run();
  const row=await db.prepare('SELECT subscription_status,trial_ends_at,storage_used_bytes,storage_limit_bytes,commercial_exempt,manual_paid_until,manual_access_managed FROM familias WHERE id=?').bind(familyId).first();
  // Read paid periods even when checkout is temporarily disabled. Never revoke an existing paid period just because a secret is unavailable.
  const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='billing_subscriptions'").first();
  if(exists){
    const mode=env.LUSPACE_BILLING_MODE==='test'&&activeBilling(env).enabled?'test':'production';
    const stamp=new Date().toISOString();
    const paid=await db.prepare("SELECT MAX(p.period_end) AS until FROM billing_payments p JOIN billing_subscriptions s ON s.id=p.subscription_id WHERE s.familia_id=? AND s.environment=? AND p.state='approved' AND p.period_start<=? AND p.period_end>?").bind(familyId,mode,stamp,stamp).first();
    if(paid?.until){row.subscription_status='active';row.billing_paid_until=paid.until;}
  }
  if(Date.parse(row.manual_paid_until)>Date.now())row.subscription_status='active';
  return {...row,can_write:!!row.commercial_exempt || row.subscription_status==='active' || (row.subscription_status==='trial' && Date.parse(row.trial_ends_at)>Date.now())};
}

