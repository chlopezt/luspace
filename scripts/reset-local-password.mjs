import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { existsSync } from "node:fs";
import { localEnv } from "../server/local.js";
import { password, uid, hash } from "../server/security.js";
if (!process.stdin.isTTY)
  throw Error("Ejecuta la recuperación en una terminal interactiva.");
if (!existsSync(".local/luspace.sqlite"))
  throw Error("No existe una instalación local para recuperar.");
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
let env;
try {
  console.log("Recuperación local. Detén primero el servidor de LuSpace.");
  const email = (await rl.question("Correo del SuperAdmin: "))
    .trim()
    .toLowerCase();
  process.stdout.write("Nueva contraseña (no se mostrará): ");
  muted = true;
  const value = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  process.stdout.write("Repetir contraseña: ");
  muted = true;
  const confirm = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  if (value.length < 12 || value.length > 128 || value !== confirm)
    throw Error("Contraseñas distintas o longitud inválida (12–128).");
  env = localEnv(".local");
  const user = await env.DB.prepare(
    "SELECT id,familia_id FROM usuarios WHERE correo=? AND rol='superadmin' AND activo=1",
  )
    .bind(email)
    .first();
  if (!user) throw Error("SuperAdmin activo no encontrado.");
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE credenciales_usuario SET password_hash=? WHERE usuario_id=?",
    ).bind(await password(value), user.id),
    env.DB.prepare("DELETE FROM sesiones WHERE usuario_id=?").bind(user.id),
    env.DB.prepare(
      "INSERT INTO audit_logs(id,familia_id,usuario_id,accion,descripcion,ip_hash) VALUES(?,?,?,'UPDATE','Recuperación local de contraseña',?)",
    ).bind(uid(), user.familia_id, user.id, await hash("local-recovery")),
  ]);
  console.log(
    "Contraseña actualizada. Se cerraron todas las sesiones de esta cuenta.",
  );
} finally {
  muted = false;
  rl.close();
  env?.close();
}
