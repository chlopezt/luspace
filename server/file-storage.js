const failure = (message, status = 503) => {
  throw Object.assign(new Error(message), { status });
};
export const r2Enabled = (env) =>
  !!env.FILES && env.LUSPACE_R2_ENABLED === "true";
export function objectKey(file) {
  for (const value of [file.familia_id, file.nino_id, file.id])
    if (typeof value !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(value))
      failure("Identificador de archivo inválido.", 500);
  return `${file.familia_id}/${file.nino_id}/${file.id}`;
}
export function storedKey(file) {
  const expected = objectKey(file);
  if (file.r2_key !== expected)
    failure("La ubicación del archivo no corresponde a su familia.", 500);
  return expected;
}
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
const binary = (value) =>
  value instanceof Uint8Array
    ? value
    : value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : Array.isArray(value)
          ? Uint8Array.from(value)
          : failure("Formato de archivo inválido.", 500);
export async function d1Bytes(db, file) {
  const chunks = (
    await db
      .prepare(
        "SELECT contenido FROM archivo_chunks WHERE archivo_id=? ORDER BY indice",
      )
      .bind(file.id)
      .all()
  ).results;
  const parts = chunks.length
    ? chunks
    : file.contenido
      ? [{ contenido: file.contenido }]
      : [];
  if (!parts.length) return null;
  const values = parts.map((part) => binary(part.contenido));
  const bytes = new Uint8Array(
    values.reduce((n, value) => n + value.byteLength, 0),
  );
  let offset = 0;
  for (const value of values) {
    bytes.set(value, offset);
    offset += value.length;
  }
  if (bytes.length !== Number(file.bytes))
    failure(
      "El tamaño del original no coincide. No se modificó el archivo.",
      500,
    );
  return bytes;
}
async function r2Bytes(env, key) {
  const obj = await env.FILES.get(key);
  if (!obj) return null;
  return new Uint8Array(
    obj.arrayBuffer
      ? await obj.arrayBuffer()
      : await new Response(obj.body).arrayBuffer(),
  );
}
export async function putVerified(env, file, bytes) {
  if (!r2Enabled(env))
    failure("R2 no está vinculado o habilitado. Los originales siguen en D1.");
  const key = objectKey(file),
    sha = await digest(bytes);
  await env.FILES.put(key, bytes, {
    httpMetadata: { contentType: file.mime },
    customMetadata: { sha256: sha },
    storageClass: "Standard",
  });
  const copy = await r2Bytes(env, key);
  if (!copy || copy.length !== bytes.length || (await digest(copy)) !== sha)
    failure(
      "No se pudo verificar la copia en R2. El original no se ha modificado.",
    );
  return { key, sha };
}
export async function readFileBytes(env, file) {
  if (!file.r2_key.startsWith("d1:")) {
    const key = storedKey(file); // Validate even when falling back; never read another family's key.
    try {
      if (env.FILES) {
        const bytes = await r2Bytes(env, key);
        if (
          bytes &&
          bytes.length === Number(file.bytes) &&
          (!file.sha256 || (await digest(bytes)) === file.sha256)
        )
          return bytes;
      }
    } catch {} // For migrated files, the preserved D1 copy is an integrity fallback.
  }
  const original = await d1Bytes(env.DB, file);
  if (original && (!file.sha256 || (await digest(original)) === file.sha256))
    return original;
  failure(
    "Archivo no disponible. No se ha podido verificar su contenido.",
    503,
  );
}
export async function removeR2(env, file) {
  if (file.r2_key.startsWith("d1:")) return;
  const key = storedKey(file);
  if (!env.FILES) failure("R2 no está disponible; no se eliminó el registro.");
  await env.FILES.delete(key);
}
export async function copyNextFile(env, actorId) {
  const file = await env.DB.prepare(
    "SELECT * FROM archivos WHERE r2_key LIKE 'd1:%' ORDER BY created_at,id LIMIT 1",
  ).first();
  if (!file) return { copied: false, complete: true };
  const bytes = await d1Bytes(env.DB, file);
  if (!bytes)
    failure("Falta el original en D1. No se ha cambiado su referencia.", 500);
  const { key, sha } = await putVerified(env, file, bytes);
  // Compare the source pointer so a concurrent migration/deletion cannot
  // re-create metadata or change ownership. Original chunks are never deleted.
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE archivos SET r2_key=?,sha256=?,r2_verified_at=CURRENT_TIMESTAMP WHERE id=? AND familia_id=? AND nino_id=? AND r2_key=?",
    ).bind(key, sha, file.id, file.familia_id, file.nino_id, file.r2_key),
    env.DB.prepare(
      "INSERT INTO auditoria_plataforma(id,usuario_id,accion,descripcion) SELECT ?,?,'MIGRATE_FILE_R2',? WHERE EXISTS(SELECT 1 FROM archivos WHERE id=? AND familia_id=? AND r2_key=? AND sha256=?)",
    ).bind(
      crypto.randomUUID(),
      actorId,
      JSON.stringify({
        familia_id: file.familia_id,
        archivo_id: file.id,
        bytes: file.bytes,
        verificacion: "SHA-256",
        original_d1_conservado: true,
      }),
      file.id,
      file.familia_id,
      key,
      sha,
    ),
  ]);
  if (
    !results[0].meta.changes &&
    !(await env.DB.prepare(
      "SELECT id FROM archivos WHERE id=? AND familia_id=? AND r2_key=?",
    )
      .bind(file.id, file.familia_id, key)
      .first())
  )
    await env.FILES.delete(key);
  return { copied: !!results[0].meta.changes, complete: false };
}
export async function migrationStatus(env) {
  const summary = await env.DB.prepare(
    "SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN r2_key LIKE 'd1:%' THEN 1 ELSE 0 END),0) AS pending,COALESCE(SUM(CASE WHEN r2_verified_at IS NOT NULL AND r2_key NOT LIKE 'd1:%' THEN 1 ELSE 0 END),0) AS verified,COALESCE(SUM(bytes),0) AS bytes FROM archivos",
  ).first();
  return { ...summary, r2_enabled: r2Enabled(env), originals_deleted: false };
}
