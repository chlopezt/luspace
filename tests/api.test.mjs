import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { localEnv } from "../server/local.js";
import { handle } from "../server/api.js";
import { calendarAge } from "../shared/dates.js";
mkdirSync(resolve("../work"), {recursive:true});
const dir = mkdtempSync(resolve("../work", "api-test-")),
  env = localEnv(dir);
const origin = "http://localhost:5173";
let cookie = "";
let ip = 0;
async function call(path, method = "GET", data, session = cookie, extras = {}) {
  const req = new Request(origin + "/api/" + path, {
    method,
    headers: {
      origin,
      cookie: session,
      "CF-Connecting-IP": `test-${ip++}`,
      ...(data instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...extras,
    },
    body:
      data === undefined
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
  });
  const response = await handle(req, env);
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  return {
    status: response.status,
    body,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
const baseChild = {
  primer_nombre: "Prueba",
  apellidos: "QA",
  apodo: "Lu",
  fecha_nacimiento: "2018-05-20",
  sexo_referencia: "masculino",
  grupo_sanguineo: "",
  alergias: "",
  rnd_habilitado: 1,
};
test("authentication, family isolation, CRUD, guest scope, revocation, files, exports and audit", async () => {
  assert.equal((await call("children")).status, 401);
  const setup = await call("setup", "POST", {
    nombre: "QA Admin",
    familia: "Familia QA",
    correo: "admin@example.test",
    password: "QaPassword!2026",
  });
  assert.equal(setup.status, 201, JSON.stringify(setup));
  cookie = setup.cookie;
  const owner = cookie;
  assert.equal((await call("setup", "POST", { nombre: "X" })).status, 409);
  assert.equal(
    (
      await call("children", "POST", baseChild, owner, {
        origin: "http://evil.test",
      })
    ).status,
    403,
  );
  const c = await call("children", "POST", baseChild);
  assert.equal(c.status, 201, JSON.stringify(c));
  const child = c.body.id;
  const me = (await call("me")).body;
  await env.DB.prepare("INSERT INTO familias(id,nombre) VALUES(?,?)")
    .bind("other-family", "Otra")
    .run();
  await env.DB.prepare(
    "INSERT INTO ninos(id,familia_id,primer_nombre,fecha_nacimiento) VALUES(?,?,?,?)",
  )
    .bind("other-child", "other-family", "Privado", "2018-01-01")
    .run();
  assert.equal(
    (await call("records/medicamentos?child=other-child")).status,
    404,
  );
  assert.equal(
    (await call("children/other-child", "PUT", baseChild)).status,
    404,
  );
  const growth = {
    fecha_medicion: "2026-01-01",
    peso_kg: 25,
    talla_cm: 125,
    perimetro_cefalico_cm: "",
    notas: "QA",
  };
  assert.equal(
    (
      await call(`records/registros_crecimiento?child=${child}`, "POST", {
        ...growth,
        peso_kg: -5,
      })
    ).status,
    400,
  );
  const rec = await call(
    `records/registros_crecimiento?child=${child}`,
    "POST",
    growth,
  );
  assert.equal(rec.status, 201, JSON.stringify(rec));
  assert.equal(
    (
      await call(
        `records/registros_crecimiento/${rec.body.id}?child=${child}`,
        "PUT",
        { ...growth, peso_kg: 26 },
      )
    ).status,
    200,
  );
  const user = await call("users", "POST", {
    nombre: "Editora",
    correo: "editor@example.test",
    rol: "editor",
    password: "QaPassword!2026",
  });
  assert.equal(user.status, 201, JSON.stringify(user));
  const editorLogin = await call(
    "login",
    "POST",
    { correo: "editor@example.test", password: "QaPassword!2026" },
    "",
  );
  assert.equal(editorLogin.status, 200);
  const editor = editorLogin.cookie;
  assert.equal((await call("audit", "GET", undefined, editor)).status, 403);
  assert.equal((await call("backup", "GET", undefined, editor)).status, 403);
  assert.equal((await call("users", "GET", undefined, editor)).status, 403);
  assert.equal(
    (
      await call(
        `records/registros_crecimiento?child=${child}`,
        "GET",
        undefined,
        editor,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`anamnesis?child=${child}`, "PUT", {
        documento: { identificacion: { 0: "Padres QA" } },
        version: 0,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`anamnesis?child=${child}`, "PUT", {
        documento: {},
        version: 0,
      })
    ).status,
    409,
  );
  const fd = new FormData();
  fd.append(
    "file",
    new Blob(["%PDF-1.4\nQA"], { type: "application/pdf" }),
    "receta.pdf",
  );
  const file = await call(`files?child=${child}&module=salud`, "POST", fd);
  assert.equal(file.status, 201, JSON.stringify(file));
  assert.equal((await call("files/" + file.body.id)).status, 200);
  const bad = new FormData();
  bad.append(
    "file",
    new Blob(["<script>alert(1)</script>"], { type: "image/png" }),
    "x.png",
  );
  assert.equal(
    (await call(`files?child=${child}&module=salud`, "POST", bad)).status,
    400,
  );
  const g = await call(`guests?child=${child}`, "POST", {
    nombre: "Profesional",
    hours: 24,
    modules: ["anamnesis"],
    pin: "1234",
    single: true,
  });
  assert.equal(g.status, 201, JSON.stringify(g));
  const tok = g.body.url.split("#")[1];
  assert.equal(
    (await call("guest/exchange", "POST", { token: tok, pin: "0000" }, ""))
      .status,
    403,
  );
  const exchanges = await Promise.all([
    call("guest/exchange", "POST", { token: tok, pin: "1234" }, ""),
    call("guest/exchange", "POST", { token: tok, pin: "1234" }, ""),
  ]);
  assert.deepEqual(exchanges.map((x) => x.status).sort(), [200, 403]);
  const guest = exchanges.find((x) => x.status === 200).cookie;
  assert.equal(
    (await call(`anamnesis?child=${child}`, "GET", undefined, guest)).status,
    200,
  );
  assert.equal(
    (
      await call(
        `anamnesis?child=${child}`,
        "PUT",
        { documento: {}, version: 1 },
        guest,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `records/registros_crecimiento?child=${child}`,
        "GET",
        undefined,
        guest,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("files/" + file.body.id, "GET", undefined, guest)).status,
    403,
  );
  assert.equal(
    (await call("export", "POST", { child, modules: ["salud"] }, guest)).status,
    403,
  );
  const report = await call(
    "export",
    "POST",
    { child, modules: ["anamnesis"] },
    guest,
  );
  assert.equal(report.status, 200);
  assert.equal(report.body.anamnesis.identificacion[0], "Padres QA");
  const guests = (await call("guests?child=" + child)).body;
  assert.equal("token_hash" in guests[0], false);
  assert.equal((await call("guests/" + guests[0].id, "DELETE")).status, 200);
  assert.equal((await call("me", "GET", undefined, guest)).status, 401);
  assert.equal(
    (await call("users/" + user.body.id, "PUT", { activo: false })).status,
    200,
  );
  assert.equal((await call("me", "GET", undefined, editor)).status, 401);
  const backup = (await call("backup")).body;
  assert.equal(backup.ninos.length, 1);
  assert.equal(backup.ninos[0].id, child);
  assert.equal(JSON.stringify(backup).includes("password_hash"), false);
  assert.equal(JSON.stringify(backup).includes("token_hash"), false);
  assert.equal(
    (
      await call(
        `records/registros_crecimiento/${rec.body.id}?child=${child}`,
        "DELETE",
      )
    ).status,
    200,
  );
  const logs = (await call("audit")).body;
  for (const action of [
    "CREATE",
    "UPDATE",
    "DELETE",
    "GUEST_ACCESS",
    "DOWNLOAD_PDF",
    "REVOKE",
    "BACKUP_EXPORT",
  ])
    assert.ok(
      logs.some((l) => l.accion === action),
      action,
    );
  assert.ok(logs.every((l) => l.familia_id === me.familia_id));
  await call("logout", "POST");
  assert.equal((await call("me")).status, 401);
  env.close();
});
test("calendar age handles end-of-month and leap days", () => {
  assert.deepEqual(calendarAge("2020-01-31", "2020-03-01"), {years:0,months:1,days:1});
  assert.deepEqual(calendarAge("2020-02-29", "2021-02-28"), {years:1,months:0,days:0});
  assert.equal(calendarAge("2027-01-01", "2026-01-01"), null);
});
