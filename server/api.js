import { models, modules, anamnesisSections } from "../shared/models.js";
import { uid, token, hash, password, verify, cookie } from "./security.js";

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
const first = (db, sql, ...args) => stmt(db, sql, ...args).first();
const all = async (db, sql, ...args) =>
  (await stmt(db, sql, ...args).all()).results;
async function body(req) {
  if (Number(req.headers.get("content-length")) > 500000)
    fail(413, "Formulario demasiado grande.");
  const raw = await req.text();
  if (raw.length > 500000) fail(413, "Formulario demasiado grande.");
  try {
    return JSON.parse(raw);
  } catch {
    fail(400, "Formulario inválido.");
  }
}
function text(v, max = 12000) {
  if (typeof v !== "string" || v.length > max)
    fail(400, "Revisa la longitud de los campos.");
  return v.trim();
}
function email(v) {
  const s = text(v, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail(400, "Correo inválido.");
  return s;
}
function pass(v) {
  if (typeof v !== "string" || v.length < 12 || v.length > 128)
    fail(400, "La contraseña debe tener entre 12 y 128 caracteres.");
  return v;
}
function rut(v) {
  const clean = text(v, 16).replace(/[^0-9kK]/g, "").toUpperCase();
  if (!clean) return "";
  if (clean.length < 2) fail(400, "RUT inválido.");
  const body = clean.slice(0, -1);
  const verifier = clean.slice(-1);
  let sum = 0, factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const expected = String(11 - (sum % 11)).replace("10", "K").replace("11", "0");
  if (verifier !== expected) fail(400, "RUT inválido. Revisa el dígito verificador.");
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + verifier;
}
function auditStatement(db, a, action, detail, ip, address) {
  return stmt(
    db,
    "INSERT INTO audit_logs(id,familia_id,usuario_id,token_invitado_id,accion,descripcion,ip_hash,ip_address) VALUES(?,?,?,?,?,?,?,?)",
    uid(),
    a.familia_id,
    a.guest ? null : a.id,
    a.guest ? a.token_id : null,
    action,
    detail,
    ip,
    address,
  );
}
async function limit(db, key) {
  const now = Date.now();
  await stmt(
    db,
    "INSERT INTO intentos_acceso(clave,cantidad,reinicio) VALUES(?,1,?) ON CONFLICT(clave) DO UPDATE SET cantidad=CASE WHEN reinicio<? THEN 1 ELSE cantidad+1 END, reinicio=CASE WHEN reinicio<? THEN excluded.reinicio ELSE reinicio END",
    key,
    now + 900000,
    now,
    now,
  ).run();
  const v = await first(
    db,
    "SELECT cantidad FROM intentos_acceso WHERE clave=?",
    key,
  );
  if (v.cantidad > 10) fail(429, "Demasiados intentos. Espera 15 minutos.");
}
async function actor(req, db) {
  const raw = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)luspace_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!raw) fail(401, "Inicia sesión para continuar.");
  const s = await first(
    db,
    "SELECT * FROM sesiones WHERE id=? AND expira_at>?",
    await hash(raw),
    new Date().toISOString(),
  );
  if (!s) fail(401, "La sesión venció. Vuelve a ingresar.");
  if (s.usuario_id) {
    const u = await first(
      db,
      "SELECT id,familia_id,nombre,correo,rol,permisos_json FROM usuarios WHERE id=? AND activo=1",
      s.usuario_id,
    );
    if (!u) fail(401, "Acceso revocado.");
    return u;
  }
  const g = await first(
    db,
    "SELECT t.*,n.familia_id FROM tokens_invitados t JOIN ninos n ON n.id=t.nino_id WHERE t.id=? AND t.activo=1 AND t.expira_at>?",
    s.token_invitado_id,
    new Date().toISOString(),
  );
  if (!g) fail(401, "Este acceso venció o fue revocado.");
  return {
    id: g.id,
    token_id: g.id,
    familia_id: g.familia_id,
    nino_id: g.nino_id,
    nombre: g.destino_nombre,
    rol: "invitado",
    guest: true,
    modules: JSON.parse(g.modulos_json),
  };
}
function admin(a) {
  if (a.rol !== "superadmin")
    fail(403, "Solo la administración principal puede realizar esta acción.");
}
function permissions(a) {
  if (a.rol === "superadmin") return { modules: Object.keys(modules), acciones: ["ver", "crear", "editar", "eliminar"] };
  try { return JSON.parse(a.permisos_json || "{}"); } catch { return {}; }
}
function member(a, module, action = "editar") {
  if (a.guest) fail(403, "El acceso de invitado es de solo lectura.");
  const p = permissions(a);
  if (!module && !p.acciones?.some((x) => ["crear", "editar", "eliminar"].includes(x)))
    fail(403, "Tu cuenta es de solo lectura.");
  if (module && (!p.modules?.includes(module) || !p.acciones?.includes(action)))
    fail(403, "Tu cuenta no tiene permiso para realizar esta acción.");
}
function allowed(a, module) {
  if (a.guest && !a.modules.includes(module))
    fail(403, "El enlace no incluye este módulo.");
  if (!a.guest && a.rol !== "superadmin" && !permissions(a).modules?.includes(module))
    fail(403, "Tu cuenta no tiene acceso a este módulo.");
}
async function child(db, a, id) {
  const n = await first(
    db,
    "SELECT * FROM ninos WHERE id=? AND familia_id=?",
    id,
    a.familia_id,
  );
  if (!n || (a.guest && a.nino_id !== id)) fail(404, "Perfil no encontrado.");
  return n;
}
async function session(db, who, expiry) {
  const raw = token();
  await stmt(
    db,
    "INSERT INTO sesiones(id,usuario_id,token_invitado_id,expira_at) VALUES(?,?,?,?)",
    await hash(raw),
    who.user || null,
    who.guest || null,
    expiry || new Date(Date.now() + 28800000).toISOString(),
  ).run();
  return raw;
}
async function validate(db, a, table, input, nino) {
  const values = {};
  for (const f of models[table].fields) {
    let v = input[f.key];
    if (f.type === "select" && (v === undefined || v === null || v === ""))
      v = f.options?.[0] || "";
    if (f.type === "checkbox") {
      v = v ? 1 : 0;
    } else if (f.type === "number") {
      v = v === "" || v == null ? null : Number(v);
      if (v !== null && (!Number.isFinite(v) || v < f.min || v > f.max))
        fail(400, `Revisa ${f.label}.`);
    } else if (f.type === "lines") {
      if (v == null) v = [];
      if (typeof v === "string")
        v = v
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);
      if (
        !Array.isArray(v) ||
        v.length > 100 ||
        v.some((x) => typeof x !== "string" || x.length > 1000)
      )
        fail(400, "Adecuaciones inválidas.");
      v = JSON.stringify(v);
    } else if (f.type === "rut") {
      v = v == null ? "" : rut(v);
    } else {
      v = v == null ? "" : text(v);
    }
    if (f.required && (v === "" || v == null))
      fail(400, `Completa ${f.label}.`);
    if (f.options && !f.options.includes(v))
      fail(400, `Selecciona ${f.label}.`);
    if (v && (f.type === "date" || f.type === "datetime-local")) {
      if (!Number.isFinite(Date.parse(v)))
        fail(400, `Fecha inválida: ${f.label}.`);
      if (
        f.type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          new Date(v).toISOString().slice(0, 10) !== v)
      )
        fail(400, "Fecha inválida.");
    }
    if (f.type === "file" && v) {
      const file = await first(
        db,
        "SELECT id FROM archivos WHERE id=? AND familia_id=? AND nino_id=? AND modulo=?",
        v,
        a.familia_id,
        nino,
        models[table].module,
      );
      if (!file) fail(400, "El adjunto no pertenece a este perfil y módulo.");
    }
    values[f.key] = v;
  }
  if (
    table === "ninos" &&
    values.fecha_nacimiento > new Date().toISOString().slice(0, 10)
  )
    fail(400, "La fecha de nacimiento no puede estar en el futuro.");
  if (table === "registros_crecimiento") {
    if (!values.peso_kg && !values.talla_cm && !values.perimetro_cefalico_cm)
      fail(400, "Registra al menos una medición.");
    const n = await child(db, a, nino);
    if (
      values.fecha_medicion < n.fecha_nacimiento ||
      values.fecha_medicion > new Date().toISOString().slice(0, 10)
    )
      fail(400, "La medición debe estar entre el nacimiento y hoy.");
  }
  if (
    table === "medicamentos" &&
    values.fecha_termino &&
    values.fecha_termino < values.fecha_inicio
  )
    fail(400, "El término debe ser posterior al inicio.");
  return values;
}
async function records(db, a, table, nino) {
  allowed(a, models[table].module);
  await child(db, a, nino);
  // El perfil usa `id` como clave; los demás módulos se relacionan por nino_id.
  // Sin esta distinción, exportar "Perfil clínico" provocaba un error SQL y
  // detenía por completo la descarga del informe.
  if (table === "ninos")
    return all(db, "SELECT * FROM ninos WHERE id=?", nino);
  return all(
    db,
    `SELECT * FROM ${table} WHERE nino_id=? ORDER BY rowid DESC`,
    nino,
  );
}

export async function handle(req, env) {
  try {
    const db = env.DB;
    if (!db) fail(503, "La base de datos no está configurada.");
    const url = new URL(req.url),
      path = url.pathname.replace(/^\/api\/?/, ""),
      method = req.method;
    if (
      !["GET", "HEAD"].includes(method) &&
      req.headers.get("origin") !== url.origin
    )
      fail(403, "Origen no autorizado.");
    const ip = await hash(
      (env.IP_SALT || "local") +
        ":" +
        (req.headers.get("CF-Connecting-IP") || "local"),
    );
    const ipAddress = req.headers.get("CF-Connecting-IP") || (env.LOCAL_DEV === true ? "127.0.0.1" : null);
    const audit = (db, a, action, detail, ip) => auditStatement(db, a, action, detail, ip, ipAddress);
    if (path === "status" && method === "GET") {
      const count = await first(db, "SELECT count(*) AS n FROM usuarios");
      return json({ setup: count.n === 0, local: env.LOCAL_DEV === true });
    }
    if (path === "setup" && method === "POST") {
      await limit(db, "setup:" + ip);
      const b = await body(req);
      if (
        env.LOCAL_DEV !== true &&
        (!env.SETUP_KEY || b.setup_key !== env.SETUP_KEY)
      )
        fail(403, "La clave de instalación es incorrecta.");
      if ((await first(db, "SELECT count(*) AS n FROM usuarios")).n)
        fail(409, "La instalación ya fue completada.");
      const family = uid(),
        id = uid(),
        name = text(b.nombre, 120),
        mail = email(b.correo),
        pw = await password(pass(b.password));
      if (!name) fail(400, "Completa tu nombre.");
      // A singleton installation guard makes simultaneous setup requests mutually exclusive.
      await db.batch([
        stmt(
          db,
          "INSERT INTO intentos_acceso(clave,cantidad,reinicio) VALUES('installed',1,0)",
        ),
        stmt(
          db,
          "INSERT INTO familias(id,nombre) VALUES(?,?)",
          family,
          text(b.familia, 120) || "Mi familia",
        ),
        stmt(
          db,
          "INSERT INTO usuarios(id,familia_id,nombre,correo,rol) VALUES(?,?,?,?,'superadmin')",
          id,
          family,
          name,
          mail,
        ),
        stmt(
          db,
          "INSERT INTO credenciales_usuario(usuario_id,password_hash) VALUES(?,?)",
          id,
          pw,
        ),
        audit(
          db,
          { id, familia_id: family },
          "CREATE",
          "Instalación de la familia",
          ip,
        ),
      ]);
      return json({ ok: true }, 201, {
        "Set-Cookie": cookie(req, await session(db, { user: id })),
      });
    }
    if (path === "login" && method === "POST") {
      await limit(db, "login:" + ip);
      const b = await body(req),
        mail = email(b.correo),
        accountKey = "login-account:" + (await hash(mail));
      await limit(db, accountKey);
      const u = await first(
        db,
        "SELECT u.*,c.password_hash FROM usuarios u JOIN credenciales_usuario c ON c.usuario_id=u.id WHERE u.correo=? AND u.activo=1",
        mail,
      );
      const valid = await verify(
        typeof b.password === "string" ? b.password.slice(0, 128) : "",
        u?.password_hash ||
          "00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000",
      );
      if (!u || !valid) fail(401, "Correo o contraseña incorrectos.");
      await db.batch([
        audit(db, u, "LOGIN", "Inicio de sesión", ip),
        stmt(
          db,
          "DELETE FROM intentos_acceso WHERE clave IN (?,?)",
          "login:" + ip,
          accountKey,
        ),
      ]);
      return json({ ok: true }, 200, {
        "Set-Cookie": cookie(req, await session(db, { user: u.id })),
      });
    }
    if (path === "guest/exchange" && method === "POST") {
      await limit(db, "guest:" + ip);
      const b = await body(req);
      const t = await first(
        db,
        "SELECT t.*,n.familia_id FROM tokens_invitados t JOIN ninos n ON n.id=t.nino_id WHERE t.token_hash=?",
        await hash(text(b.token, 128)),
      );
      if (!t || !t.activo || t.expira_at <= new Date().toISOString())
        fail(403, "Enlace vencido, revocado o inválido.");
      await limit(db, "guest-token:" + t.id);
      if (t.pin_hash && !(await verify(text(b.pin || "", 4), t.pin_hash)))
        fail(403, "PIN incorrecto.");
      const update = await stmt(
        db,
        "UPDATE tokens_invitados SET contador_accesos=contador_accesos+1 WHERE id=? AND activo=1 AND expira_at>? AND (max_accesos IS NULL OR contador_accesos<max_accesos)",
        t.id,
        new Date().toISOString(),
      ).run();
      if (!update.meta.changes) fail(403, "El enlace ya fue utilizado.");
      const expiry = new Date(
        Math.min(Date.parse(t.expira_at), Date.now() + 3600000),
      ).toISOString();
      await audit(
        db,
        { guest: true, token_id: t.id, familia_id: t.familia_id },
        "GUEST_ACCESS",
        "Acceso profesional",
        ip,
      ).run();
      return json({ ok: true }, 200, {
        "Set-Cookie": cookie(
          req,
          await session(db, { guest: t.id }, expiry),
          Math.floor((Date.parse(expiry) - Date.now()) / 1000),
        ),
      });
    }
    const a = await actor(req, db);
    if (path === "me" && method === "GET") {
      const family = await first(
        db,
        "SELECT nombre FROM familias WHERE id=?",
        a.familia_id,
      );
      return json({ ...a, familia: family.nombre });
    }
    if (path === "admin/storage-metrics" && method === "GET") {
      admin(a);
      const total = await first(
        db,
        "SELECT count(*) AS total_files, coalesce(sum(bytes),0) AS total_bytes, coalesce(avg(bytes),0) AS average_bytes FROM archivos WHERE familia_id=?",
        a.familia_id,
      );
      const breakdown = await all(
        db,
        "SELECT CASE WHEN modulo='rnd' THEN 'Credenciales RND' WHEN modulo='escolar' THEN 'Bitácoras y escolar' WHEN modulo='salud' THEN 'Exámenes y recetas' WHEN modulo IN ('perfil','ninos') THEN 'Fotos de perfil' ELSE 'Otros documentos' END AS tipo, count(*) AS archivos, coalesce(sum(bytes),0) AS bytes FROM archivos WHERE familia_id=? GROUP BY tipo ORDER BY bytes DESC",
        a.familia_id,
      );
      return json({
        limit_bytes: 10 * 1024 * 1024 * 1024,
        total_files: Number(total.total_files || 0),
        total_bytes: Number(total.total_bytes || 0),
        average_bytes: Number(total.average_bytes || 0),
        breakdown,
      });
    }
    if (path === "logout" && method === "POST") {
      const raw = req.headers
        .get("cookie")
        ?.match(/luspace_session=([a-f0-9]{64})/)?.[1];
      if (raw)
        await stmt(
          db,
          "DELETE FROM sesiones WHERE id=?",
          await hash(raw),
        ).run();
      return json({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
    }
    if (path === "children" && method === "GET") {
      const rows = await all(
        db,
        "SELECT * FROM ninos WHERE familia_id=? ORDER BY created_at",
        a.familia_id,
      );
      return json(
        a.guest
          ? rows
              .filter((n) => n.id === a.nino_id)
              .map((n) => ({
                id: n.id,
                primer_nombre: n.primer_nombre,
                apodo: n.apodo,
                fecha_nacimiento: n.fecha_nacimiento,
                sexo_referencia: n.sexo_referencia,
                rnd_habilitado: a.modules.includes("rnd")
                  ? n.rnd_habilitado
                  : 0,
              }))
          : rows,
      );
    }
    if (path === "children" && method === "POST") {
      member(a, "perfil", "crear");
      const v = await validate(db, a, "ninos", await body(req));
      const id = uid(),
        keys = Object.keys(v);
      await db.batch([
        stmt(
          db,
          `INSERT INTO ninos(id,familia_id,${keys.join(",")}) VALUES(${Array(keys.length + 2).fill("?")})`,
          id,
          a.familia_id,
          ...Object.values(v),
        ),
        audit(db, a, "CREATE", "Perfil creado", ip),
      ]);
      return json({ id }, 201);
    }
    if (path.startsWith("children/") && method === "PUT") {
      member(a, "perfil", "editar");
      const id = path.split("/")[1];
      await child(db, a, id);
      const v = await validate(db, a, "ninos", await body(req));
      await db.batch([
        stmt(
          db,
          `UPDATE ninos SET ${Object.keys(v)
            .map((k) => k + "=?")
            .join(
              ",",
            )},updated_at=CURRENT_TIMESTAMP WHERE id=? AND familia_id=?`,
          ...Object.values(v),
          id,
          a.familia_id,
        ),
        audit(db, a, "UPDATE", "Perfil actualizado", ip),
      ]);
      return json({ ok: true });
    }
    if (path.startsWith("records/")) {
      const [, table, id] = path.split("/");
      if (!models[table] || table === "ninos")
        fail(404, "Módulo no encontrado.");
      const nino = url.searchParams.get("child");
      if (!nino) fail(400, "Selecciona un perfil.");
      await child(db, a, nino);
      allowed(a, models[table].module);
      if (method === "GET") return json(await records(db, a, table, nino));
      member(a, models[table].module, method === "DELETE" ? "eliminar" : id ? "editar" : "crear");
      if (
        id &&
        !(await first(
          db,
          `SELECT id FROM ${table} WHERE id=? AND nino_id=?`,
          id,
          nino,
        ))
      )
        fail(404, "Registro no encontrado.");
      if (method === "DELETE" && id) {
        const ops = [];
        if (table === "credenciales_discapacidad") {
          ops.push(
            stmt(db, "DELETE FROM archivo_chunks WHERE archivo_id IN (SELECT id FROM archivos WHERE nino_id=? AND modulo='rnd')", nino),
            stmt(db, "DELETE FROM archivos WHERE nino_id=? AND modulo='rnd'", nino),
          );
        }
        ops.push(
          stmt(db, `DELETE FROM ${table} WHERE id=? AND nino_id=?`, id, nino),
          audit(
            db,
            a,
            "DELETE",
            `${models[table].title}: registro eliminado`,
            ip,
          ),
        );
        await db.batch(ops);
        return json({ ok: true });
      }
      if (method === "POST" || method === "PUT") {
        const v = await validate(db, a, table, await body(req), nino);
        let rid = id;
        if (models[table].single && !rid)
          rid = (
            await first(db, `SELECT id FROM ${table} WHERE nino_id=?`, nino)
          )?.id;
        if (rid) {
          await db.batch([
            stmt(
              db,
              `UPDATE ${table} SET ${Object.keys(v)
                .map((k) => k + "=?")
                .join(",")} WHERE id=? AND nino_id=?`,
              ...Object.values(v),
              rid,
              nino,
            ),
            audit(
              db,
              a,
              "UPDATE",
              `${models[table].title}: registro actualizado`,
              ip,
            ),
          ]);
        } else {
          rid = uid();
          v.id = rid;
          v.nino_id = nino;
          if (
            ["registros_crecimiento", "bitacora_escolar_diaria"].includes(table)
          )
            v.creado_por_usuario_id = a.id;
          await db.batch([
            stmt(
              db,
              `INSERT INTO ${table}(${Object.keys(v)}) VALUES(${Object.keys(v).map(() => "?")})`,
              ...Object.values(v),
            ),
            audit(
              db,
              a,
              "CREATE",
              `${models[table].title}: registro creado`,
              ip,
            ),
          ]);
        }
        return json({ id: rid }, method === "POST" ? 201 : 200);
      }
    }
    if (path === "anamnesis") {
      const nino = url.searchParams.get("child");
      await child(db, a, nino);
      allowed(a, "anamnesis");
      const row = await first(
        db,
        "SELECT * FROM anamnesis WHERE nino_id=?",
        nino,
      );
      if (method === "GET")
        return json({
          documento: row ? JSON.parse(row.documento_json) : {},
          version: row?.version || 0,
        });
      if (method === "PUT") {
        member(a, "anamnesis", "editar");
        const b = await body(req);
        if (
          !Number.isInteger(b.version) ||
          !b.documento ||
          typeof b.documento !== "object"
        )
          fail(400, "Anamnesis inválida.");
        const doc = {};
        for (const [key, , fields] of anamnesisSections) {
          doc[key] = {};
          for (let i = 0; i < fields.length; i++)
            doc[key][i] = text(b.documento[key]?.[i] || "", 8000);
        }
        if (row) {
          const r = await db.batch([
            stmt(
              db,
              "UPDATE anamnesis SET documento_json=?,version=version+1,actualizado_por_usuario_id=?,updated_at=CURRENT_TIMESTAMP WHERE nino_id=? AND version=?",
              JSON.stringify(doc),
              a.id,
              nino,
              b.version,
            ),
            stmt(
              db,
              "INSERT INTO audit_logs(id,familia_id,usuario_id,accion,descripcion,ip_hash,ip_address) SELECT ?,?,?,'UPDATE','Anamnesis actualizada',?,? WHERE changes()=1",
              uid(),
              a.familia_id,
              a.id,
              ip,
              ipAddress,
            ),
          ]);
          if (!r[0].meta.changes)
            fail(
              409,
              "Otra persona actualizó esta anamnesis. Conserva tu texto y recarga para comparar.",
            );
        } else {
          if (b.version !== 0)
            fail(409, "La versión cambió. Recarga la anamnesis.");
          await db.batch([
            stmt(
              db,
              "INSERT INTO anamnesis(id,nino_id,documento_json,actualizado_por_usuario_id) VALUES(?,?,?,?)",
              uid(),
              nino,
              JSON.stringify(doc),
              a.id,
            ),
            audit(db, a, "CREATE", "Anamnesis creada", ip),
          ]);
        }
        return json({ version: b.version + 1 });
      }
    }
    if (path === "guests") {
      member(a);
      const nino = url.searchParams.get("child");
      await child(db, a, nino);
      if (method === "GET")
        return json(
          await all(
            db,
            "SELECT id,destino_nombre,modulos_json,expira_at,contador_accesos,max_accesos,activo,created_at,pin_hash IS NOT NULL AS con_pin FROM tokens_invitados WHERE nino_id=? ORDER BY created_at DESC",
            nino,
          ),
        );
      if (method === "POST") {
        const b = await body(req);
        const hours = Number(b.hours);
        if (
          ![1, 24, 168, 720].includes(hours) ||
          !Array.isArray(b.modules) ||
          !b.modules.length ||
          b.modules.some((m) => !modules[m])
        )
          fail(400, "Selecciona duración y módulos válidos.");
        if (b.pin && !/^\d{4}$/.test(b.pin))
          fail(400, "El PIN debe tener 4 dígitos.");
        const raw = token(),
          id = uid();
        const destination = text(b.nombre, 120);
        if (!destination) fail(400, "Indica el destinatario.");
        await db.batch([
          stmt(
            db,
            "INSERT INTO tokens_invitados(id,token_hash,nino_id,destino_nombre,modulos_json,expira_at,pin_hash,max_accesos,un_solo_uso,creado_por_usuario_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
            id,
            await hash(raw),
            nino,
            destination,
            JSON.stringify(b.modules),
            new Date(Date.now() + hours * 3600000).toISOString(),
            b.pin ? await password(b.pin) : null,
            b.single ? 1 : null,
            b.single ? 1 : 0,
            a.id,
          ),
          audit(db, a, "CREATE", "Enlace profesional creado", ip),
        ]);
        return json({ url: `${url.origin}/invitado#${raw}` }, 201);
      }
    }
    if (path.startsWith("guests/") && method === "DELETE") {
      member(a);
      const id = path.split("/")[1];
      const t = await first(
        db,
        "SELECT t.id FROM tokens_invitados t JOIN ninos n ON n.id=t.nino_id WHERE t.id=? AND n.familia_id=?",
        id,
        a.familia_id,
      );
      if (!t) fail(404, "Enlace no encontrado.");
      await db.batch([
        stmt(
          db,
          "UPDATE tokens_invitados SET activo=0,revoked_at=CURRENT_TIMESTAMP WHERE id=?",
          id,
        ),
        stmt(db, "DELETE FROM sesiones WHERE token_invitado_id=?", id),
        audit(db, a, "REVOKE", "Enlace profesional revocado", ip),
      ]);
      return json({ ok: true });
    }
    if (path === "users") {
      admin(a);
      if (method === "GET")
        return json(
          await all(
            db,
            "SELECT id,nombre,correo,rol,activo,permisos_json FROM usuarios WHERE familia_id=? ORDER BY created_at",
            a.familia_id,
          ),
        );
      if (method === "POST") {
        const b = await body(req),
          id = uid();
        const name = text(b.nombre, 120);
        if (!name || !["editor", "superadmin", "lector"].includes(b.rol))
          fail(400, "Nombre y rol requeridos.");
        const soloLectura = b.rol === "lector";
        await db.batch([
          stmt(
            db,
            "INSERT INTO usuarios(id,familia_id,nombre,correo,rol,permisos_json) VALUES(?,?,?,?,?,?)",
            id,
            a.familia_id,
            name,
            email(b.correo),
            soloLectura ? "editor" : b.rol,
            JSON.stringify(soloLectura ? { modules: Object.keys(modules), acciones: ["ver"] } : { modules: Object.keys(modules), acciones: ["ver", "crear", "editar", "eliminar"] }),
          ),
          stmt(
            db,
            "INSERT INTO credenciales_usuario(usuario_id,password_hash) VALUES(?,?)",
            id,
            await password(pass(b.password)),
          ),
          audit(db, a, "CREATE", "Usuario creado", ip),
        ]);
        return json({ id }, 201);
      }
    }
    if (path.startsWith("users/") && method === "PUT") {
      admin(a);
      const id = path.split("/")[1],
        b = await body(req);
      const target = await first(
        db,
        "SELECT * FROM usuarios WHERE id=? AND familia_id=?",
        id,
        a.familia_id,
      );
      if (!target) fail(404, "Usuario no encontrado.");
      if (id === a.id)
        fail(
          400,
          "Usa Cambiar mi contraseña. No puedes revocar tu propio acceso.",
        );
      const ops = [];
      if (b.password)
        ops.push(
          stmt(
            db,
            "UPDATE credenciales_usuario SET password_hash=? WHERE usuario_id=?",
            await password(pass(b.password)),
            id,
          ),
        );
      if (b.activo !== undefined)
        ops.push(
          stmt(
            db,
            "UPDATE usuarios SET activo=? WHERE id=?",
            b.activo ? 1 : 0,
            id,
          ),
        );
      if (b.permisos_json !== undefined) {
        let p;
        try { p = typeof b.permisos_json === "string" ? JSON.parse(b.permisos_json) : b.permisos_json; } catch { fail(400, "Permisos inválidos."); }
        if (!Array.isArray(p?.modules) || !Array.isArray(p?.acciones) || p.modules.some((m) => !modules[m]) || p.acciones.some((x) => !["ver", "crear", "editar", "eliminar"].includes(x)))
          fail(400, "Permisos inválidos.");
        ops.push(stmt(db, "UPDATE usuarios SET permisos_json=? WHERE id=?", JSON.stringify({ modules: [...new Set(p.modules)], acciones: [...new Set(p.acciones)] }), id));
      }
      ops.push(
        stmt(db, "DELETE FROM sesiones WHERE usuario_id=?", id),
        audit(
          db,
          a,
          "REVOKE",
          "Acceso de usuario actualizado; sesiones cerradas",
          ip,
        ),
      );
      await db.batch(ops);
      return json({ ok: true });
    }
    if (path === "password" && method === "PUT") {
      member(a);
      await limit(db, "password:" + a.id);
      const b = await body(req),
        c = await first(
          db,
          "SELECT password_hash FROM credenciales_usuario WHERE usuario_id=?",
          a.id,
        );
      if (!(await verify(text(b.actual, 128), c.password_hash)))
        fail(403, "La contraseña actual no es correcta.");
      await db.batch([
        stmt(
          db,
          "UPDATE credenciales_usuario SET password_hash=? WHERE usuario_id=?",
          await password(pass(b.nueva)),
          a.id,
        ),
        stmt(db, "DELETE FROM sesiones WHERE usuario_id=?", a.id),
        audit(db, a, "UPDATE", "Contraseña cambiada y sesiones cerradas", ip),
      ]);
      return json({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
    }
    if (path === "audit" && method === "GET") {
      admin(a);
      const from = url.searchParams.get("from") || "0000",
        to = url.searchParams.get("to") || "9999",
        action = url.searchParams.get("action") || "",
        user = url.searchParams.get("user") || "";
      const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
      return json(
        await all(
          db,
          "SELECT l.*,coalesce(u.nombre,t.destino_nombre,'Cuenta eliminada') AS actor FROM audit_logs l LEFT JOIN usuarios u ON u.id=l.usuario_id LEFT JOIN tokens_invitados t ON t.id=l.token_invitado_id WHERE l.familia_id=? AND substr(l.created_at,1,10)>=? AND substr(l.created_at,1,10)<=? AND (?='' OR l.accion=?) AND (?='' OR l.usuario_id=? OR l.token_invitado_id=?) ORDER BY l.rowid DESC LIMIT 51 OFFSET ?",
          a.familia_id,
          from,
          to,
          action,
          action,
          user,
          user,
          user,
          page * 50,
        ),
      );
    }
    if (path === "backup" && method === "GET") {
      admin(a);
      await audit(
        db,
        a,
        "BACKUP_EXPORT",
        "Respaldo familiar JSON descargado",
        ip,
      ).run();
      const result = {
        format: "luspace-family-backup-v1",
        exported_at: new Date().toISOString(),
      };
      result.familias = await all(
        db,
        "SELECT * FROM familias WHERE id=?",
        a.familia_id,
      );
      result.usuarios = await all(
        db,
        "SELECT id,familia_id,nombre,correo,rol,activo,created_at FROM usuarios WHERE familia_id=?",
        a.familia_id,
      );
      result.ninos = await all(
        db,
        "SELECT * FROM ninos WHERE familia_id=?",
        a.familia_id,
      );
      for (const t of [
        ...Object.keys(models).filter((t) => t !== "ninos"),
        "anamnesis",
        "archivos",
      ])
        result[t] = await all(
          db,
          `SELECT t.* FROM ${t} t JOIN ninos n ON n.id=t.nino_id WHERE n.familia_id=?`,
          a.familia_id,
        );
      result.audit_logs = await all(
        db,
        "SELECT * FROM audit_logs WHERE familia_id=?",
        a.familia_id,
      );
      result.tokens_invitados = await all(
        db,
        "SELECT t.id,t.nino_id,t.destino_nombre,t.modulos_json,t.expira_at,t.contador_accesos,t.activo FROM tokens_invitados t JOIN ninos n ON n.id=t.nino_id WHERE n.familia_id=?",
        a.familia_id,
      );
      return json(result, 200, {
        "Content-Disposition": 'attachment; filename="luspace-respaldo.json"',
      });
    }
    if (path === "export" && method === "POST") {
      const b = await body(req),
        n = await child(db, a, b.child);
      if (
        !Array.isArray(b.modules) ||
        !b.modules.length ||
        b.modules.some((m) => !modules[m])
      )
        fail(400, "Selecciona módulos.");
      const data = {
        child: {
          primer_nombre: n.primer_nombre,
          apellidos: n.apellidos,
          fecha_nacimiento: n.fecha_nacimiento,
        },
        created: new Date().toISOString(),
        sections: {},
      };
      for (const m of b.modules) {
        allowed(a, m);
        if (m === "salud") {
          data.child.grupo_sanguineo = n.grupo_sanguineo;
          data.child.alergias = n.alergias;
        }
        for (const [t, c] of Object.entries(models)) {
          if (c.module === m) data.sections[t] = await records(db, a, t, n.id);
        }
        if (m === "anamnesis") {
          const r = await first(
            db,
            "SELECT documento_json FROM anamnesis WHERE nino_id=?",
            n.id,
          );
          data.anamnesis = r ? JSON.parse(r.documento_json) : {};
        }
      }
      await audit(
        db,
        a,
        "DOWNLOAD_PDF",
        "Exportación de " + b.modules.join(", "),
        ip,
      ).run();
      return json(data);
    }
    if (path === "files" && method === "GET") {
      const n = url.searchParams.get("child"),
        m = url.searchParams.get("module");
      await child(db, a, n);
      allowed(a, m);
      return json(
        await all(
          db,
          "SELECT id,nombre,mime,bytes,created_at FROM archivos WHERE nino_id=? AND modulo=?",
          n,
          m,
        ),
      );
    }
    if (path === "files" && method === "POST") {
      if (Number(req.headers.get("content-length")) > 10500000)
        fail(413, "El archivo supera 10 MB.");
      const n = url.searchParams.get("child"),
        m = url.searchParams.get("module");
      member(a, m, "crear");
      await child(db, a, n);
      if (!modules[m]) fail(400, "Módulo inválido.");
      const file = (await req.formData()).get("file");
      if (
        !file ||
        typeof file === "string" ||
        !file.size ||
        file.size > 10000000
      )
        fail(400, "Adjunta un archivo de hasta 10 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let mime = "";
      if (
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
      )
        mime = "application/pdf";
      else if (
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71
      )
        mime = "image/png";
      else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        mime = "image/jpeg";
      if (!mime) fail(400, "Solo se permiten PDF, PNG y JPG.");
      const id = uid(), key = `d1:${id}`, chunkSize = 1000000;
      const chunks = [];
      for (let offset = 0; offset < bytes.length; offset += chunkSize)
        chunks.push(bytes.slice(offset, offset + chunkSize));
      await db.batch([
          stmt(
            db,
            "INSERT INTO archivos(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key) VALUES(?,?,?,?,?,?,?,?)",
            id,
            a.familia_id,
            n,
            m,
            text(file.name, 180),
            mime,
            file.size,
            key,
          ),
          ...chunks.map((part, indice) =>
            stmt(db, "INSERT INTO archivo_chunks(archivo_id,indice,contenido) VALUES(?,?,?)", id, indice, part),
          ),
          audit(db, a, "CREATE", "Archivo adjuntado a " + m, ip),
        ]);
      return json({ id }, 201);
    }
    if (path.startsWith("files/") && method === "DELETE") {
      const id = path.split("/")[1];
      const f = await first(db, "SELECT * FROM archivos WHERE id=? AND familia_id=?", id, a.familia_id);
      if (!f) fail(404, "Archivo no encontrado.");
      member(a, f.modulo, "eliminar");
      await db.batch([
        stmt(db, "DELETE FROM archivo_chunks WHERE archivo_id=?", id),
        stmt(db, "DELETE FROM archivos WHERE id=?", id),
        audit(db, a, "DELETE", "Archivo eliminado: " + f.modulo, ip),
      ]);
      return json({ ok: true });
    }
    if (path.startsWith("files/") && method === "GET") {
      const f = await first(
        db,
        "SELECT * FROM archivos WHERE id=? AND familia_id=?",
        path.split("/")[1],
        a.familia_id,
      );
      if (!f) fail(404, "Archivo no encontrado.");
      await child(db, a, f.nino_id);
      allowed(a, f.modulo);
      const chunks = await all(
        db,
        "SELECT contenido FROM archivo_chunks WHERE archivo_id=? ORDER BY indice",
        f.id,
      );
      const parts = chunks.length ? chunks : f.contenido ? [{ contenido: f.contenido }] : [];
      if (!parts.length) fail(404, "Archivo no disponible.");
      // D1 puede entregar BLOB como ArrayBuffer, vista tipada o arreglo de bytes
      // según el entorno de ejecución. Normalizamos antes de reconstruir el archivo.
      const binary = (value) => {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value))
          return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        if (Array.isArray(value)) return Uint8Array.from(value);
        fail(500, "El formato del archivo almacenado no es válido.");
      };
      const values = parts.map((part) => binary(part.contenido));
      const bytes = new Uint8Array(values.reduce((size, value) => size + value.byteLength, 0));
      let offset = 0;
      for (const value of values) {
        bytes.set(value, offset);
        offset += value.byteLength;
      }
      await audit(
        db,
        a,
        "DOWNLOAD_PDF",
        "Archivo consultado: " + f.modulo,
        ip,
      ).run();
      return new Response(bytes, {
        headers: {
          "Content-Type": f.mime,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.nombre)}`,
        },
      });
    }
    fail(404, "Ruta no encontrada.");
  } catch (e) {
    if (e.status) return json({ error: e.message }, e.status);
    if (String(e.message).includes("UNIQUE"))
      return json(
        { error: "Este registro ya existe. Revisa la fecha o el correo." },
        409,
      );
    console.error("LuSpace API failure:", e.name);
    return json(
      {
        error:
          "No se pudo completar la operación. Tus cambios siguen en el formulario.",
      },
      500,
    );
  }
}
