export async function subscription(db,familyId) {
  await db.prepare("UPDATE familias SET subscription_status='expired' WHERE id=? AND commercial_exempt=0 AND manual_access_managed=1 AND subscription_status='active' AND julianday(manual_paid_until)<=julianday('now')").bind(familyId).run();
  await db.prepare("UPDATE familias SET subscription_status='expired' WHERE id=? AND commercial_exempt=0 AND subscription_status='trial' AND (trial_ends_at IS NULL OR julianday(trial_ends_at)<=julianday('now'))").bind(familyId).run();
  const row=await db.prepare('SELECT subscription_status,trial_ends_at,storage_used_bytes,storage_limit_bytes,commercial_exempt,manual_paid_until,manual_access_managed FROM familias WHERE id=?').bind(familyId).first();
  if(Date.parse(row.manual_paid_until)>Date.now())row.subscription_status='active';
  return {...row,can_write:!!row.commercial_exempt || row.subscription_status==='active' || (row.subscription_status==='trial' && Date.parse(row.trial_ends_at)>Date.now())};
}
