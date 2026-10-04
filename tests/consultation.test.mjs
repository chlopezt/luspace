import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localEnv } from "../server/local.js";
import { handle } from "../server/api.js";
test("consultation consent, isolation, minimized payload, AI and fallback", async () => {
  const env = localEnv(mkdtempSync(join(tmpdir(), "luspace-ai-test-")));
  let cookie = "", calls = 0;
  async function call(path, data) {
    const r = await handle(new Request("http://localhost:5173/api/" + path, {method:"POST",headers:{origin:"http://localhost:5173",cookie,"Content-Type":"application/json"},body:JSON.stringify(data)}),env);
    if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie").split(";")[0];
    return {status:r.status, body:await r.json()};
  }
  try {
    assert.equal((await call("consultation/preview",{})).status,401);
    await call("setup", {nombre:"QA",familia:"QA",correo:"ai@example.test",password:"QaPassword!2026"});
    const child = (await call("children",{primer_nombre:"SECRET-NAME",fecha_nacimiento:"2020-01-01",sexo_referencia:"masculino",contacto_emergencia_principal_telefono:"SECRET-PHONE",alergias:"Polen"})).body.id;
    const input = {child,modules:["perfil","salud"],concern:"Preparar preguntas"};
    const preview = await call("consultation/preview",input);
    assert.equal(preview.status,200);
    assert.ok(!JSON.stringify(preview.body.payload).includes("SECRET"));
    assert.equal((await call("consultation/preview",{...input,child:"other-family"})).status,404);
    assert.equal((await call("consultation/generate",input)).status,400);
    assert.equal((await call("consultation/generate",{...input,consent:true,preview_hash:"wrong"})).status,409);
    const approved = {...input,consent:true,preview_hash:preview.body.preview_hash};
    assert.equal((await call("consultation/generate",approved)).body.mode,"basic");
    env.AI = {run:async (model,options) => {calls++; assert.equal(options.max_tokens,800); return {response:"Borrador de prueba"};}};
    env.LUSPACE_AI_ENABLED = "true";
    assert.equal((await call("consultation/generate",approved)).body.mode,"ai");
    env.AI.run = async()=>{calls++; throw new Error("quota");};
    assert.equal((await call("consultation/generate",approved)).body.mode,"basic");
    for (let i=0;i<10;i++) await call("consultation/generate",approved);
    assert.equal(calls,10);
    // Role values are mapped by the existing account API; verify server-side permissions directly.
    const user = await env.DB.prepare("SELECT id FROM usuarios WHERE correo=?").bind("ai@example.test").first();
    await env.DB.prepare("UPDATE usuarios SET rol='editor',permisos_json=? WHERE id=?").bind(JSON.stringify({modules:["salud"],acciones:["ver"]}),user.id).run();
    assert.equal((await call("consultation/preview",input)).status,403);
  } finally {env.close();}
});
