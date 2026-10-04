import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localEnv } from "../server/local.js";
import { handle } from "../server/api.js";
test("platform admin is separate, read-only and cannot bypass family isolation", async () => {
  const env = localEnv(mkdtempSync(join(tmpdir(), "luspace-platform-")));
  let cookie = "";
  async function call(path, method="GET",data) {
    const r = await handle(new Request("http://localhost:5173/api/"+path,{method,headers:{origin:"http://localhost:5173",cookie,"Content-Type":"application/json"},body:data===undefined?undefined:JSON.stringify(data)}),env);
    if(r.headers.get("set-cookie")) cookie=r.headers.get("set-cookie").split(";")[0];
    return {status:r.status,body:await r.json()};
  }
  try {
    assert.equal((await call("platform/overview")).status,401);
    await call("setup","POST",{nombre:"QA",familia:"Familia QA",correo:"platform@example.test",password:"QaPassword!2026"});
    const me=(await call("me")).body;
    assert.equal(me.platform_admin,false);
    assert.equal((await call("platform/overview")).status,403);
    await env.DB.prepare("INSERT INTO familias(id,nombre) VALUES('other','Familia B')").run();
    await env.DB.prepare("INSERT INTO ninos(id,familia_id,primer_nombre,fecha_nacimiento) VALUES('secret-child','other','SECRET-CHILD','2020-01-01')").run();
    await env.DB.prepare("INSERT INTO administradores_plataforma(usuario_id) VALUES(?)").bind(me.id).run();
    assert.equal((await call("me")).body.platform_admin,true);
    const overview=await call("platform/overview");
    assert.equal(overview.status,200);
    assert.equal(overview.body.totals.familias,2);
    assert.ok(!JSON.stringify(overview.body).includes("SECRET-CHILD"));
    assert.deepEqual(Object.keys(overview.body.families[0]).sort(),["id","nombre","created_at","miembros_activos","archivos","storage_used_bytes"].sort());
    assert.equal((await call("records/medicamentos?child=secret-child")).status,404);
    assert.equal((await call("children/secret-child","PUT",{primer_nombre:"MODIFIED"})).status,404);
    assert.equal((await call("platform/overview","POST",{})).status,404);
    assert.equal((await call("platform/children")).status,404);
    assert.equal((await env.DB.prepare("SELECT count(*) AS n FROM auditoria_plataforma").first()).n,1);
    await env.DB.prepare("UPDATE administradores_plataforma SET activo=0 WHERE usuario_id=?").bind(me.id).run();
    assert.equal((await call("platform/overview")).status,403);
    assert.equal((await call("me")).body.platform_admin,false);
  } finally {env.close();}
});
