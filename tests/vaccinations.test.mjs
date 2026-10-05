import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { localEnv } from "../server/local.js";
import { handle } from "../server/api.js";
import {
  vaccinationCatalog,
  vaccinationDue,
  vaccinationState,
} from "../shared/vaccinations.js";
test("vaccination reference never invents administered or overdue history", () => {
  assert.equal(vaccinationCatalog.length, 23);
  assert.equal(vaccinationDue("2024-12-31", 2), "2025-02-28");
  assert.equal(vaccinationDue("2024-02-29", 12), "2025-02-28");
  assert.equal(vaccinationDue("2020-01-01", null), "");
  assert.equal(
    vaccinationState({ catalogo_id: "bcg-rn" }, "2018-01-01", "2026-10-05"),
    "Por verificar",
  );
  assert.equal(
    vaccinationState(
      { id: "saved", catalogo_id: "bcg-rn", estado: "Pendiente/Próxima" },
      "2018-01-01",
      "2026-10-05",
    ),
    "Atrasada",
  );
  assert.equal(
    vaccinationState({ id: "saved", estado: "Administrada" }, "2018-01-01"),
    "Administrada",
  );
});
test("vaccination CRUD persists, isolates families, rejects duplicates and protects read-only users", async () => {
  mkdirSync(resolve("../work"), { recursive: true });
  const env = localEnv(mkdtempSync(resolve("../work", "vaccination-test-")));
  let cookie = "",
    ip = 0;
  const call = async (path, method = "GET", data, session = cookie) => {
    const response = await handle(
      new Request("http://localhost:5173/api/" + path, {
        method,
        headers: {
          origin: "http://localhost:5173",
          cookie: session,
          "Content-Type": "application/json",
          "CF-Connecting-IP": "vac-" + ip++,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      env,
    );
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
  try {
    const setup = await call("setup", "POST", {
      nombre: "Admin QA",
      familia: "QA",
      correo: "vaccines@example.test",
      password: "QaPassword!2026",
    });
    assert.equal(setup.status, 201);
    cookie = setup.cookie;
    const c = await call("children", "POST", {
      primer_nombre: "QA",
      fecha_nacimiento: "2025-01-01",
    });
    assert.equal(c.status, 201);
    const id = c.data.id,
      path = "records/vacunas?child=" + id;
    const v = {
      nombre: "BCG",
      dosis: "Única",
      catalogo_id: "bcg-rn",
      etapa: "0–6 meses",
      estado: "Administrada",
      fecha_aplicacion: "2025-01-02",
      centro: "CESFAM QA",
      lote_marca: "Lote QA",
      notas: "Observación conservada",
    };
    assert.equal(
      (await call(path, "POST", { ...v, fecha_aplicacion: "" })).status,
      400,
    );
    assert.equal(
      (await call(path, "POST", { ...v, fecha_aplicacion: "2099-01-01" }))
        .status,
      400,
    );
    assert.equal(
      (await call(path, "POST", { ...v, fecha_aplicacion: "2024-01-01" }))
        .status,
      400,
    );
    const saved = await call(path, "POST", v);
    assert.equal(saved.status, 201, JSON.stringify(saved));
    assert.equal((await call(path, "POST", v)).status, 409);
    assert.equal(
      (
        await call("records/vacunas/" + saved.data.id + "?child=" + id, "PUT", {
          ...v,
          centro: "Otro CESFAM",
        })
      ).status,
      200,
    );
    const rows = await call(path);
    assert.equal(rows.data[0].centro, "Otro CESFAM");
    assert.equal(rows.data[0].notas, v.notas);
    await env.DB.prepare("INSERT INTO familias(id,nombre) VALUES(?,?)")
      .bind("other", "Otra")
      .run();
    await env.DB.prepare(
      "INSERT INTO ninos(id,familia_id,primer_nombre,fecha_nacimiento) VALUES(?,?,?,?)",
    )
      .bind("foreign", "other", "Privado", "2025-01-01")
      .run();
    assert.equal((await call("records/vacunas?child=foreign")).status, 404);
    assert.equal(
      (await call("records/vacunas?child=foreign", "POST", v)).status,
      404,
    );
    assert.equal(
      (
        await call("users", "POST", {
          nombre: "Lectura",
          correo: "reader-vax@example.test",
          password: "QaPassword!2026",
          rol: "lector",
        })
      ).status,
      201,
    );
    const login = await call(
      "login",
      "POST",
      { correo: "reader-vax@example.test", password: "QaPassword!2026" },
      "",
    );
    assert.equal(login.status, 200);
    const reader = login.cookie;
    assert.equal((await call(path, "GET", undefined, reader)).status, 200);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"])
      assert.equal(
        (
          await call(
            "records/vacunas/" + saved.data.id + "?child=" + id,
            method,
            v,
            reader,
          )
        ).status,
        403,
      );
    const exported = await call("export", "POST", {
      child: id,
      modules: ["salud"],
    });
    assert.equal(exported.status, 200, JSON.stringify(exported));
    assert.equal(exported.data.sections.vacunas[0].notas, v.notas);
    assert.equal(
      (
        await call(
          "records/vacunas/" + saved.data.id + "?child=" + id,
          "DELETE",
        )
      ).status,
      200,
    );
    assert.equal((await call(path)).data.length, 0);
  } finally {
    env.close();
  }
});
