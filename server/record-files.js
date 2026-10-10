import {canAccess} from '../shared/access-policy.js';

export async function validateRecordFiles(db, actor, value, child, module, previous = []) {
  let ids = value ?? [];
  if (typeof ids === "string") {
    try {
      ids = JSON.parse(ids);
    } catch {
      throw Object.assign(new Error("Lista de archivos inválida."), {
        status: 400,
      });
    }
  }
  if (
    !Array.isArray(ids) ||
    ids.length > 20 ||
    ids.some(
      (id) => typeof id !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(id),
    ) ||
    new Set(ids).size !== ids.length
  )
    throw Object.assign(
      new Error("Selecciona hasta 20 archivos distintos por registro."),
      { status: 400 },
    );
  for (const id of ids) {
    let retained = previous;
    if (typeof retained === 'string') { try { retained = JSON.parse(retained); } catch { retained = []; } }
    if (!canAccess(actor, module, 'adjuntar') && (!Array.isArray(retained) || !retained.includes(id)))
      throw Object.assign(new Error('Tu cuenta no tiene permiso para adjuntar archivos.'), {status:403});
    const file = await db
      .prepare(
        "SELECT id FROM archivos WHERE id=? AND familia_id=? AND nino_id=? AND modulo=?",
      )
      .bind(id, actor.familia_id, child, module)
      .first();
    if (!file)
      throw Object.assign(
        new Error("El adjunto no pertenece a este perfil y categoría."),
        { status: 400 },
      );
  }
  return ids;
}
