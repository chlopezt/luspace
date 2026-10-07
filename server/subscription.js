import {testBilling} from './billing.js';
export async function subscription(db,familyId,env={}) {
  await db.prepare("UPDATE familias SET subscription_status='expired' WHERE id=? AND commercial_exempt=0 AND subscription_status='trial' AND (trial_ends_at IS NULL OR julianday(trial_ends_at)<=julianday('now'))").bind(familyId).run();
  const row=await db.prepare('SELECT subscription_status,trial_ends_at,storage_used_bytes,storage_limit_bytes,commercial_exempt FROM familias WHERE id=?').bind(familyId).first();
  let status=row.subscription_status;
  if(testBilling(env).enabled && !row.commercial_exempt){
    const latest=await db.prepare("SELECT state,paid_until FROM billing_subscriptions WHERE familia_id=? AND environment='test' ORDER BY created_at DESC LIMIT 1").bind(familyId).first();
    if(latest){
      const paid=await db.prepare("SELECT MAX(p.period_end) AS until FROM billing_payments p JOIN billing_subscriptions s ON s.id=p.subscription_id WHERE s.familia_id=? AND s.environment='test' AND p.state='approved' AND p.period_start<=? AND p.period_end>?").bind(familyId,new Date().toISOString(),new Date().toISOString()).first();
      if(paid?.until)status='active';
      else if(status!=='trial'){
        if(latest.state==='cancelled')status='canceled';
        else if(latest.state==='authorized'||latest.state==='paused')status='past_due';
      }
    }
  }
  return {...row,subscription_status:status,can_write:!!row.commercial_exempt || status==='active' || (status==='trial' && Date.parse(row.trial_ends_at)>Date.now())};
}
