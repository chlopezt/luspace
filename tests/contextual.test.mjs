import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localEnv } from "../server/local.js";
import { handle } from "../server/api.js";
test("contextual attachments, nutrition, ownership, legacy compatibility and per-account feature gates", async () => {
  const env = localEnv(mkdtempSync(join(tmpdir(), "luspace-contextual-")));
  let cookie = "";
  async function call(path, method = "GET", data) {
    const response = await handle(
      new Request("http://localhost:5173/api/" + path, {
        method,
        headers: {
          origin: "http://localhost:5173",
          cookie,
          ...(data instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body:
          data === undefined
            ? undefined
            : data instanceof FormData
              ? data
              : JSON.stringify(data),
      }),
      env,
    );
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const raw = await response.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
    return { status: response.status, body };
  }
  async function upload(child, module, name) {
    const data = new FormData();
    data.append(
      "file",
      new Blob(["%PDF-1.4\nQA"], { type: "application/pdf" }),
      name,
    );
    const result = await call(
      `files?child=${child}&module=${module}`,
      "POST",
      data,
    );
    assert.equal(result.status, 201, JSON.stringify(result));
    return result.body.id;
  }
  try {
    assert.equal(
      (
        await call("setup", "POST", {
          nombre: "QA",
          familia: "QA",
          correo: "context@example.test",
          password: "FamilyPassword!2026",
        })
      ).status,
      201,
    );
    const me = (await call("me")).body,
      owner = cookie;
    const child = (
      await call("children", "POST", {
        primer_nombre: "QA",
        fecha_nacimiento: "2020-01-01",
      })
    ).body.id;
    const child2 = (
      await call("children", "POST", {
        primer_nombre: "Segundo",
        fecha_nacimiento: "2021-01-01",
      })
    ).body.id;
    const a = await upload(child, "salud", "consulta-a.pdf"),
      b = await upload(child, "salud", "consulta-b.pdf"),
      wrongChild = await upload(child2, "salud", "otro-perfil.pdf"),
      school = await upload(child, "escolar", "escolar.pdf");
    const visit = {
      fecha: "2026-10-20T12:00:00Z",
      medico_nombre: "Profesional QA",
      especialidad: "Pediatría",
      archivo_r2_key: a,
      adjuntos_json: [a, b],
    };
    const record = await call(
      "records/consultas_medicas?child=" + child,
      "POST",
      visit,
    );
    assert.equal(record.status, 201, JSON.stringify(record));
    const endpoint = `records/consultas_medicas/${record.body.id}?child=${child}`;
    let rows = (await call("records/consultas_medicas?child=" + child)).body;
    assert.deepEqual(JSON.parse(rows[0].adjuntos_json), [a, b]);
    assert.equal(
      (await call(endpoint, "PUT", { ...visit, adjuntos_json: [wrongChild] }))
        .status,
      400,
    );
    assert.equal(
      (await call(endpoint, "PUT", { ...visit, adjuntos_json: [school] }))
        .status,
      400,
    );
    assert.equal(
      (await call(endpoint, "PUT", { ...visit, adjuntos_json: [a, a] })).status,
      400,
    );
    const { adjuntos_json, ...legacy } = visit;
    assert.equal((await call(endpoint, "PUT", legacy)).status, 200);
    rows = (await call("records/consultas_medicas?child=" + child)).body;
    assert.deepEqual(JSON.parse(rows[0].adjuntos_json), [a, b]);
    assert.equal((await call("files/" + b, "DELETE")).status, 409);
    assert.equal(
      (await call(endpoint, "PUT", { ...visit, adjuntos_json: [a] })).status,
      200,
    );
    assert.equal((await call("files/" + b, "DELETE")).status, 200);
    const food = {
      fecha: "2026-10-06T12:00:00Z",
      via: "Oral",
      tipo_comida: "Almuerzo",
      textura: "Papilla",
      cantidad: 120,
      unidad: "ml",
      aceptacion: "Buena tolerancia",
      adjuntos_json: [a],
    };
    assert.equal(
      (await call("records/alimentacion?child=" + child, "POST", food)).status,
      201,
    );
    assert.equal(
      (
        await call("records/alimentacion?child=" + child, "POST", {
          ...food,
          unidad: "%",
          cantidad: 101,
        })
      ).status,
      400,
    );
    assert.equal((await call("audit")).status, 403);
    assert.equal(
      (
        await call("consultation/preview", "POST", {
          child,
          modules: ["salud"],
        })
      ).status,
      403,
    );
    const anam = await upload(child, "anamnesis", "anamnesis.pdf");
    const current = (await call("anamnesis?child=" + child)).body;
    const saved = await call("anamnesis?child=" + child, "PUT", {
      version: current.version,
      documento: { identificacion: { 0: "QA", archivos: [anam] } },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved));
    assert.equal((await call("files/" + anam, "DELETE")).status, 409);
    assert.equal(
      (
        await call("register", "POST", {
          legal_accepted:true,care_authorized:true,legal_version:'2026-10-08-v2',
          nombre: "B",
          familia: "B",
          correo: "other-context@example.test",
          password: "OtherPassword!2026",
          password_confirmation: "OtherPassword!2026",
        })
      ).status,
      201,
    );
    const otherChild = (
      await call("children", "POST", {
        primer_nombre: "B",
        fecha_nacimiento: "2020-01-01",
      })
    ).body.id;
    assert.equal(
      (
        await call("records/alimentacion?child=" + otherChild, "POST", {
          ...food,
          adjuntos_json: [a],
        })
      ).status,
      400,
    );
    assert.equal((await call("files/" + a)).status, 404);
    cookie = owner;
    await env.DB.prepare(
      "UPDATE usuarios SET rol='editor',permisos_json=? WHERE id=?",
    )
      .bind(
        JSON.stringify({ modules: ["salud", "anamnesis"], acciones: ["ver"] }),
        me.id,
      )
      .run();
    assert.equal(
      (await call("records/alimentacion?child=" + child, "POST", food)).status,
      403,
    );
    assert.equal((await call(endpoint, "PUT", visit)).status, 403);
    assert.equal((await call(endpoint, "DELETE")).status, 403);
    assert.equal(
      (await call("records/alimentacion?child=" + child)).status,
      200,
    );
  } finally {
    env.close();
  }
});
test("only platform sessions can toggle per-account Audit and AI visibility, without clinical access", async () => {
  const env = localEnv(mkdtempSync(join(tmpdir(), "luspace-visibility-")));
  let cookie = "";
  async function call(path, method = "GET", data) {
    const response = await handle(
      new Request("http://localhost:5173/api/" + path, {
        method,
        headers: {
          origin: "http://localhost:5173",
          cookie,
          "Content-Type": "application/json",
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      env,
    );
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return { status: response.status, body: await response.json() };
  }
  try {
    await call("setup", "POST", {
      nombre: "QA",
      familia: "QA",
      correo: "visibility@example.test",
      password: "FamilyPassword!2026",
    });
    const me = (await call("me")).body;
    await env.DB.prepare(
      "INSERT INTO administradores_plataforma(usuario_id) VALUES(?)",
    )
      .bind(me.id)
      .run();
    await call("platform/enroll", "POST", {
      correo: "admin-visibility@example.test",
      current_password: "FamilyPassword!2026",
      password: "AdminPassword!2026",
    });
    const endpoint = `platform/families/${me.familia_id}/users/${me.id}/visibility`;
    const payload = {
      audit_visible: true,
      ai_visible: true,
      reason: "Activación autorizada para pruebas",
      admin_password: "AdminPassword!2026",
    };
    assert.equal((await call(endpoint, "POST", payload)).status, 401);
    await call("platform/login", "POST", {
      correo: "admin-visibility@example.test",
      password: "AdminPassword!2026",
    });
    assert.equal(
      (await call(endpoint, "POST", { ...payload, admin_password: "wrong" }))
        .status,
      401,
    );
    assert.equal((await call(endpoint, "POST", payload)).status, 200);
    const members = (await call("platform/families/" + me.familia_id)).body
      .members;
    assert.equal(members.find((user) => user.id === me.id).audit_visible, 1);
    assert.equal(members.find((user) => user.id === me.id).ai_visible, 1);
    assert.equal((await call("children")).status, 401);
    assert.equal(
      (
        await call(
          "platform/families/wrong/users/" + me.id + "/visibility",
          "POST",
          payload,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(endpoint, "POST", {
          ...payload,
          audit_visible: false,
          ai_visible: false,
        })
      ).status,
      200,
    );
    await call("login", "POST", {
      correo: "visibility@example.test",
      password: "FamilyPassword!2026",
    });
    assert.equal((await call("audit")).status, 403);
    assert.equal((await call("me")).body.ai_visible, 0);
    const events = (
      await env.DB.prepare(
        "SELECT descripcion FROM auditoria_plataforma WHERE accion='SET_FAMILY_USER_VISIBILITY'",
      ).all()
    ).results;
    assert.equal(events.length, 2);
    assert.equal(JSON.parse(events[0].descripcion).audit_visible, true);
  } finally {
    env.close();
  }
});
