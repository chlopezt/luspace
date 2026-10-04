export async function subscription(db,familyId) {
  await db.prepare("UPDATE familias SET subscription_status='expired' WHERE id=? AND commercial_exempt=0 AND subscription_status='trial' AND (trial_ends_at IS NULL OR julianday(trial_ends_at)<=julianday('now'))").bind(familyId).run();
  const row=await db.prepare('SELECT subscription_status,trial_ends_at,storage_used_bytes,storage_limit_bytes,commercial_exempt FROM familias WHERE id=?').bind(familyId).first();
  return {...row,can_write:!!row.commercial_exempt || row.subscription_status==='active' || (row.subscription_status==='trial' && Date.parse(row.trial_ends_at)>Date.now())};
}
