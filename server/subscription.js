import {activeBilling} from './billing.js';
export function accessWindow(row, paidUntil, now=Date.now()) {
  const ends=[row.trial_ends_at,row.manual_paid_until,paidUntil].map(Date.parse).filter(Number.isFinite);
  const until=ends.length?Math.max(...ends):null;
  const unlimited=!!row.commercial_exempt || (row.subscription_status==='active' && !row.manual_access_managed && !paidUntil);
  const canWrite=unlimited || (until!==null && until>now);
  const graceEnd=until===null?null:until+14*86400000;
  return {can_write:canWrite,can_read:canWrite || (graceEnd!==null && now<graceEnd),access_expires_at:until===null?null:new Date(until).toISOString(),read_access_ends_at:graceEnd===null?null:new Date(graceEnd).toISOString(),access_phase:canWrite?'active':graceEnd!==null&&now<graceEnd?'grace':'locked'};
}
export async function subscription(db,familyId,env={}) {
  await db.prepare("UPDATE familias SET subscription_status='expired' WHERE id=? AND commercial_exempt=0 AND manual_access_managed=1 AND subscription_status='active' AND julianday(manual_paid_until)<=julianday('now')").bind(familyId).run();
  await db.prepare("UPDATE familias SET subscription_status='expired' WHERE id=? AND commercial_exempt=0 AND subscription_status='trial' AND (trial_ends_at IS NULL OR julianday(trial_ends_at)<=julianday('now'))").bind(familyId).run();
  const row=await db.prepare('SELECT subscription_status,trial_ends_at,storage_used_bytes,storage_limit_bytes,commercial_exempt,manual_paid_until,manual_access_managed FROM familias WHERE id=?').bind(familyId).first();
  // Read paid periods even when checkout is temporarily disabled. Never revoke an existing paid period just because a secret is unavailable.
  const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='billing_subscriptions'").first();
  let paidUntil=null,confirmedPaidUntil=null;
  if(exists){
    const mode=env.LUSPACE_BILLING_MODE==='test'&&activeBilling(env).enabled?'test':'production';
    const stamp=new Date().toISOString();
    // Display confirmed coverage even when it starts after the remaining trial.
    // This does not advance the paid period or change the access calculation.
    const confirmed=await db.prepare("SELECT MAX(p.period_end) AS until FROM billing_payments p JOIN billing_subscriptions s ON s.id=p.subscription_id WHERE s.familia_id=? AND s.environment=? AND p.state='approved' AND p.period_end>?").bind(familyId,mode,stamp).first();
    confirmedPaidUntil=confirmed?.until||null;
    const history=await db.prepare("SELECT MAX(p.period_end) AS until FROM billing_payments p JOIN billing_subscriptions s ON s.id=p.subscription_id WHERE s.familia_id=? AND s.environment=? AND p.state='approved' AND p.period_start<=?").bind(familyId,mode,stamp).first();
    paidUntil=history?.until||null;
    const paid=await db.prepare("SELECT MAX(p.period_end) AS until FROM billing_payments p JOIN billing_subscriptions s ON s.id=p.subscription_id WHERE s.familia_id=? AND s.environment=? AND p.state='approved' AND p.period_start<=? AND p.period_end>?").bind(familyId,mode,stamp,stamp).first();
    if(paid?.until){row.subscription_status='active';row.billing_paid_until=paid.until;}
    const oneoffExists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='billing_orders'").first();
    if(oneoffExists){
      const confirmedOnce=await db.prepare("SELECT MAX(p.period_end) AS until FROM billing_order_payments p JOIN billing_orders o ON o.id=p.order_id WHERE o.familia_id=? AND o.environment=? AND p.state='approved' AND p.period_end>?").bind(familyId,mode,stamp).first();
      confirmedPaidUntil=[confirmedPaidUntil,confirmedOnce?.until].filter(Boolean).sort().at(-1)||null;
      const historyOnce=await db.prepare("SELECT MAX(p.period_end) AS until FROM billing_order_payments p JOIN billing_orders o ON o.id=p.order_id WHERE o.familia_id=? AND o.environment=? AND p.state='approved' AND p.period_start<=?").bind(familyId,mode,stamp).first();
      paidUntil=[paidUntil,historyOnce?.until].filter(Boolean).sort().at(-1)||null;
      const once=await db.prepare("SELECT MAX(p.period_end) AS until FROM billing_order_payments p JOIN billing_orders o ON o.id=p.order_id WHERE o.familia_id=? AND o.environment=? AND p.state='approved' AND p.period_start<=? AND p.period_end>?").bind(familyId,mode,stamp,stamp).first();
      if(once?.until){row.subscription_status='active';row.billing_paid_until=[row.billing_paid_until,once.until].filter(Boolean).sort().at(-1);}
    }
  }
  if(Date.parse(row.manual_paid_until)>Date.now())row.subscription_status='active';
  const access=accessWindow(row,paidUntil);
  const exception=await db.prepare('SELECT read_until,write_until FROM family_access_exceptions WHERE familia_id=?').bind(familyId).first();
  const temporaryWrite=Date.parse(exception?.write_until)>Date.now();
  const temporaryRead=temporaryWrite || Date.parse(exception?.read_until)>Date.now();
  if(temporaryWrite)access.can_write=true;
  if(temporaryRead)access.can_read=true;
  if(temporaryWrite)access.access_phase='temporary';
  else if(temporaryRead&&!access.can_write)access.access_phase='grace';
  if(temporaryRead)access.read_access_ends_at=[access.read_access_ends_at,exception?.read_until,exception?.write_until].filter(Boolean).sort().at(-1);
  if(!access.can_write)row.subscription_status='expired';
  return {...row,...access,confirmed_paid_until:confirmedPaidUntil,access_exception:exception||{read_until:null,write_until:null}};
}

