import { useEffect, useState, type FormEvent } from "react";
import { api, dateLabel, download, type Row } from "./lib";
import { modules } from "../shared/models.js";
import { Empty, ErrorNote, Modal } from "./components";
export function Guests({ child }: { child: Row }) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>(["anamnesis"]),
    [copied, setCopied] = useState(false);
  async function load() {
    try {
      setRows(await api("guests?child=" + child.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [child.id]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      values = Object.fromEntries(new FormData(form));
    try {
      const r = await api("guests?child=" + child.id, "POST", {
        ...values,
        modules: selected,
        single: values.single === "on",
      });
      setLink(r.url);
      setCopied(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Accesos para profesionales</h1>
      <p className="muted">
        Cada enlace permite consultar solo los módulos seleccionados. Puedes
        revocarlo en cualquier momento.
      </p>
      <div className="card spaced">
        <form onSubmit={create}>
          <fieldset disabled={busy} className="form-grid">
            <label className="field">
              <span>Profesional o destinatario</span>
              <input name="nombre" required maxLength={120} />
            </label>
            <label className="field">
              <span>Vencimiento</span>
              <select name="hours">
                <option value="1">1 hora</option>
                <option value="24">24 horas</option>
                <option value="168">7 días</option>
                <option value="720">30 días</option>
              </select>
            </label>
            <label className="field">
              <span>PIN opcional de 4 dígitos</span>
              <input
                name="pin"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
              />
            </label>
            <label className="check">
              <input name="single" type="checkbox" />
              Un solo uso
            </label>
            <div className="wide">
              <strong>Módulos visibles</strong>
              <div className="check-grid">
                {Object.entries(modules).map(([key, label]) => (
                  <label className="check" key={key}>
                    <input
                      type="checkbox"
                      checked={selected.includes(key)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, key]
                            : selected.filter((k) => k !== key),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
          <ErrorNote error={error} />
          <button className="primary" disabled={busy || !selected.length}>
            {busy ? "Creando…" : "Generar enlace"}
          </button>
        </form>
        {link && (
          <div className="success">
            <strong>Enlace creado</strong>
            <p>
              Se muestra una sola vez. Compártelo únicamente con su
              destinatario; envía el PIN por separado.
            </p>
            <input
              aria-label="Enlace generado"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setError("Selecciona y copia el enlace manualmente.");
                }
              }}
            >
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
        )}
      </div>
      <h2>Enlaces emitidos</h2>
      {!rows.length && <Empty>No has creado enlaces.</Empty>}
      <div className="record-list">
        {rows.map((r) => (
          <article className="card" key={r.id}>
            <h3>{r.destino_nombre}</h3>
            <p>
              {JSON.parse(r.modulos_json)
                .map((m: keyof typeof modules) => modules[m])
                .join(" · ")}
            </p>
            <p className="muted">
              Vence: {dateLabel(r.expira_at)} · {r.contador_accesos} accesos
              {r.max_accesos ? " · un solo uso" : ""}
              {r.con_pin ? " · con PIN" : ""}
            </p>
            <p className="badge">
              {!r.activo
                ? "Revocado"
                : Date.parse(r.expira_at) < Date.now()
                  ? "Vencido"
                  : r.max_accesos && r.contador_accesos >= r.max_accesos
                    ? "Canjeado"
                    : "Activo"}
            </p>
            {!!r.activo && (
              <button
                className="link-button danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("guests/" + r.id, "DELETE");
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Revocar acceso
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
export function Users({ me, onLogout }: { me: Row; onLogout: () => void }) {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [ok, setOk] = useState(""),
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState<Row | null>(null);
  async function load() {
    if (me.rol === "superadmin")
      try {
        setRows(await api("users"));
      } catch (e) {
        setError((e as Error).message);
      }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(
    e: FormEvent<HTMLFormElement>,
    path: string,
    method = "POST",
  ) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    try {
      await api(path, method, Object.fromEntries(new FormData(form)));
      form.reset();
      setOk("Cambios guardados.");
      await load();
      if (path === "password") onLogout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Mi familia y accesos</h1>
      <p className="muted">
        {me.familia} · {me.nombre} ({me.rol})
      </p>
      <ErrorNote error={error} />
      {ok && (
        <p className="success" role="status">
          {ok}
        </p>
      )}
      {me.rol === "superadmin" && (
        <>
          <form
            className="card spaced"
            onSubmit={(e) => void submit(e, "users")}
          >
            <h2>Agregar usuario</h2>
            <div className="form-grid">
              <label className="field">
                Nombre
                <input name="nombre" required maxLength={120} />
              </label>
              <label className="field">
                Correo
                <input type="email" name="correo" required />
              </label>
              <label className="field">
                Contraseña inicial
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  required
                  autoComplete="new-password"
                />
              </label>
              <label className="field">
                Rol
                <select name="rol">
                  <option value="editor">
                    Editora / administrador operativo
                  </option>
                  <option value="superadmin">SuperAdmin</option>
                </select>
              </label>
            </div>
            <button className="primary" disabled={busy}>
              Crear usuario
            </button>
          </form>
          <div className="record-list">
            {rows.map((r) => (
              <article className="card" key={r.id}>
                <h3>{r.nombre}</h3>
                <p>{r.correo}</p>
                <p className="muted">
                  {r.rol} · {r.activo ? "Activo" : "Revocado"}
                </p>
                {r.id !== me.id && (
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api("users/" + r.id, "PUT", {
                            activo: !r.activo,
                          });
                          await load();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {r.activo ? "Revocar acceso" : "Reactivar"}
                    </button>
                    <button className="secondary" onClick={() => setReset(r)}>
                      Restablecer contraseña
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <form
        className="card spaced"
        onSubmit={(e) => void submit(e, "password", "PUT")}
      >
        <h2>Cambiar mi contraseña</h2>
        <label className="field">
          Contraseña actual
          <input
            name="actual"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          Nueva contraseña (mínimo 12 caracteres)
          <input
            name="nueva"
            type="password"
            minLength={12}
            maxLength={128}
            required
            autoComplete="new-password"
          />
        </label>
        <button className="primary" disabled={busy}>
          Cambiar y cerrar sesiones
        </button>
      </form>
      {reset && (
        <Modal
          title={"Restablecer acceso de " + reset.nombre}
          close={() => setReset(null)}
          description="Se cerrarán las sesiones abiertas de esta persona."
        >
          <form
            onSubmit={async (e) => {
              await submit(e, "users/" + reset.id, "PUT");
            }}
          >
            <label className="field">
              Nueva contraseña
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <ErrorNote error={error} />
            {ok && <p role="status">{ok}</p>}
            <button className="primary" disabled={busy}>
              Guardar contraseña
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Audit() {
  const [rows, setRows] = useState<Row[]>([]),
    [users, setUsers] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [filters, setFilters] = useState({
      from: "",
      to: "",
      action: "",
      user: "",
    }),
    [page, setPage] = useState(0);
  async function load() {
    try {
      setRows(
        await api(
          "audit?" + new URLSearchParams({ ...filters, page: String(page) }),
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [filters, page]);
  useEffect(() => {
    api("users")
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="section-heading">
        <h1>Auditoría y respaldos</h1>
        <button
          className="secondary"
          onClick={async () => {
            try {
              download(
                new Blob([JSON.stringify(await api("backup"), null, 2)], {
                  type: "application/json",
                }),
                "luspace-respaldo.json",
              );
              void load();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Descargar respaldo JSON
        </button>
      </div>
      <p className="muted">
        El respaldo contiene los registros familiares y las referencias a
        archivos. Los documentos se descargan por separado. No incluye
        contraseñas ni enlaces secretos.
      </p>
      <div className="filters">
        {(["from", "to"] as const).map((k) => (
          <label className="field" key={k}>
            {k === "from" ? "Desde" : "Hasta"}
            <input
              type="date"
              value={filters[k]}
              onChange={(e) => {
                setFilters({ ...filters, [k]: e.target.value });
                setPage(0);
              }}
            />
          </label>
        ))}
        <label className="field">
          Acción
          <select
            value={filters.action}
            onChange={(e) => {
              setFilters({ ...filters, action: e.target.value });
              setPage(0);
            }}
          >
            <option value="">Todas</option>
            {[
              "LOGIN",
              "CREATE",
              "UPDATE",
              "DELETE",
              "DOWNLOAD_PDF",
              "GUEST_ACCESS",
              "REVOKE",
              "BACKUP_EXPORT",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Usuario
          <select
            value={filters.user}
            onChange={(e) => {
              setFilters({ ...filters, user: e.target.value });
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorNote error={error} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Detalle</th>
              <th>Dirección IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r) => (
              <tr key={r.id}>
                <td>{dateLabel(r.created_at)}</td>
                <td>{r.actor}</td>
                <td>{r.accion}</td>
                <td>{r.descripcion}</td>
                <td>
                  <code>{r.ip_address || "Sin registrar"}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty>No hay eventos con estos filtros.</Empty>}
      <div className="form-actions">
        <button
          className="secondary"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span>Página {page + 1}</span>
        <button
          className="secondary"
          disabled={rows.length <= 50}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </>
  );
}
