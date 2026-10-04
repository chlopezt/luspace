import { useEffect, useState, type FormEvent } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, Archive, KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { api, dateLabel, download, type Row } from "./lib";
import { modules } from "../shared/models.js";
import { Empty, ErrorNote, Modal } from "./components";

const allModules = Object.keys(modules);
const actions = ["ver", "crear", "editar", "eliminar", "descargar", "adjuntar"];
const sensitiveItems = [["rnd", "Credencial RND"], ["anamnesis", "Anamnesis"], ["diagnosticos", "Diagnósticos"], ["examenes", "Exámenes"], ["recetas", "Recetas"], ["foto_perfil", "Foto de perfil"]] as const;
const privacyItems = [["rut", "RUT"], ["telefono", "Teléfonos"], ["direccion", "Dirección"], ["diagnosticos", "Diagnósticos"], ["archivos", "Archivos adjuntos"]] as const;

function AdminDashboard({ onBackup }: { onBackup: () => void }) {
  const [data, setData] = useState<Row | null>(null), [error, setError] = useState("");
  useEffect(() => { api("admin/dashboard").then(setData).catch((e) => setError(e.message)); }, []);
  const mb = (n = 0) => n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (!data) return <div className="admin-dashboard card"><p className="muted">Preparando resumen de administración…</p><ErrorNote error={error} /></div>;
  const cards = [[UsersRound, data.summary.members, "Miembros activos", "menta"], [KeyRound, data.summary.guests, "Invitados vigentes", "violet"], [Activity, data.summary.sessions, "Sesiones activas", "blue"], [Archive, data.summary.files, `${mb(data.summary.bytes)} en R2`, "amber"]] as const;
  return <section className="admin-dashboard"><div className="admin-kpis">{cards.map(([Icon, value, label, tone]) => <article className={`admin-kpi ${tone}`} key={label}><Icon size={20}/><strong>{value}</strong><span>{label}</span></article>)}</div><div className="admin-grid"><article className="card admin-panel"><div className="admin-title"><div><ShieldCheck size={20}/><h2>Seguridad y alertas</h2></div><span className="status-good">Protegido</span></div><ul className="admin-alerts"><li><AlertTriangle size={16}/><span>{data.alerts.rnd_expiring ? `${data.alerts.rnd_expiring} credencial(es) RND próxima(s) a vencer` : "No hay credenciales próximas a vencer"}</span></li><li><AlertTriangle size={16}/><span>{data.alerts.inactive_users.length ? `${data.alerts.inactive_users.length} cuenta(s) sin actividad por 30 días` : "Todas las cuentas registran actividad reciente"}</span></li><li><ShieldCheck size={16}/><span>Contraseñas fuertes y sesiones revocables activas</span></li></ul></article><article className="card admin-panel"><div className="admin-title"><div><Activity size={20}/><h2>Accesos de la semana</h2></div></div><div className="admin-chart"><ResponsiveContainer width="100%" height={150}><BarChart data={data.access_series}><XAxis dataKey="day" tick={{fontSize:10}}/><YAxis allowDecimals={false} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="total" fill="#8b5cf6" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article></div><div className="admin-grid"><article className="card admin-panel"><div className="admin-title"><div><Activity size={20}/><h2>Actividad reciente</h2></div></div><div className="admin-feed">{data.recent.length ? data.recent.map((r: Row, i: number) => <p key={i}><b>{r.actor}</b> · {r.descripcion}<small>{dateLabel(r.created_at)}</small></p>) : <p className="muted">Aún no hay eventos registrados.</p>}</div></article><article className="card admin-panel"><div className="admin-title"><div><KeyRound size={20}/><h2>Invitados activos</h2></div></div><div className="admin-feed">{data.guests.length ? data.guests.map((g: Row) => <p key={g.id}><b>{g.destino_nombre}</b> · vence {dateLabel(g.expira_at)}<small>{g.contador_accesos} accesos · {JSON.parse(g.modulos_json).length} módulos</small></p>) : <p className="muted">No hay enlaces profesionales activos.</p>}</div></article></div><article className="card admin-backup"><div><Archive size={20}/><div><h2>Estado de datos</h2><p>{data.summary.files} documentos · {mb(data.summary.bytes)} · respaldo disponible bajo demanda</p></div></div><button className="primary" onClick={onBackup}>Generar respaldo JSON</button></article></section>;
}
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
    [reset, setReset] = useState<Row | null>(null),
    [permissionsFor, setPermissionsFor] = useState<Row | null>(null),
    [settings, setSettings] = useState<Row | null>(null);
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
  useEffect(() => {
    if (me.rol === "superadmin") api("family/settings").then(setSettings).catch((e) => setError(e.message));
  }, [me.rol]);
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
          <AdminDashboard onBackup={async () => { try { download(new Blob([JSON.stringify(await api("backup"), null, 2)], { type: "application/json" }), "luspace-respaldo.json"); setOk("Respaldo generado y registrado en auditoría."); } catch (e) { setError((e as Error).message); } }} />
          {settings && <form className="card admin-settings" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { const values = Object.fromEntries(new FormData(e.currentTarget)); await api("family/settings", "PUT", { ...settings, nombre: values.nombre, nino_principal_id: values.nino_principal_id, rnd_visible: values.rnd_visible === "on", modulos_activos_json: allModules.filter((m) => values["module_" + m] === "on") }); setOk("Configuración familiar actualizada."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><h2>Configuración familiar</h2><div className="form-grid"><label className="field">Nombre de la familia<input name="nombre" defaultValue={settings.nombre}/></label><label className="field">Niño/a principal<select name="nino_principal_id"><option value="">Seleccionar después</option><option value={settings.nino_principal_id}>{settings.nino_principal_id ? "Perfil principal actual" : "Sin perfil seleccionado"}</option></select></label><label className="check"><input name="rnd_visible" type="checkbox" defaultChecked={!!settings.rnd_visible}/> Mostrar botón Credencial RND</label><div className="wide"><strong>Módulos activos</strong><div className="check-grid">{allModules.map((m) => <label className="check" key={m}><input name={`module_${m}`} type="checkbox" defaultChecked={JSON.parse(settings.modulos_activos_json || "[]").includes(m)}/>{modules[m as keyof typeof modules]}</label>)}</div></div></div><button className="secondary" disabled={busy}>Guardar configuración</button></form>}
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
                  <option value="lector">Solo lectura</option>
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
                  {JSON.parse(r.permisos_json || "{}").acciones?.length === 1
                    ? "Solo lectura"
                    : r.rol} · {r.activo ? "Activo" : "Revocado"}
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
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setPermissionsFor(r)}
                    >
                      Configurar permisos
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
      {permissionsFor && <PermissionsModal user={permissionsFor} busy={busy} close={() => setPermissionsFor(null)} onSave={async (permisos_json) => { setBusy(true); try { await api("users/" + permissionsFor.id, "PUT", { permisos_json }); setOk("Permisos actualizados y sesiones cerradas."); setPermissionsFor(null); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }} />}
    </>
  );
}

function PermissionsModal({ user, close, onSave, busy }: { user: Row; close: () => void; onSave: (permissions: Row) => Promise<void>; busy: boolean }) {
  const initial = (() => { try { return JSON.parse(user.permisos_json || "{}"); } catch { return {}; } })();
  const [p, setP] = useState<Row>({ modules: initial.modules || allModules, acciones: initial.acciones || ["ver"], sensibles: initial.sensibles || [], privacidad: initial.privacidad || [] });
  const toggle = (key: string, value: string) => setP((old) => ({ ...old, [key]: old[key].includes(value) ? old[key].filter((x: string) => x !== value) : [...old[key], value] }));
  return <Modal title={`Permisos de ${user.nombre}`} description="Los cambios se aplican de inmediato y cierran sus sesiones activas." close={close}><div className="permission-editor"><section><h3>Módulos visibles</h3>{allModules.map((m) => <label className="check" key={m}><input type="checkbox" checked={p.modules.includes(m)} onChange={() => toggle("modules",m)}/>{modules[m as keyof typeof modules]}</label>)}</section><section><h3>Acciones permitidas</h3>{actions.map((a) => <label className="check" key={a}><input type="checkbox" checked={p.acciones.includes(a)} disabled={a === "ver"} onChange={() => toggle("acciones",a)}/>{a}</label>)}</section><section><h3>Documentos sensibles permitidos</h3>{sensitiveItems.map(([k,l]) => <label className="check" key={k}><input type="checkbox" checked={p.sensibles.includes(k)} onChange={() => toggle("sensibles",k)}/>{l}</label>)}</section><section><h3>Ocultar datos privados</h3>{privacyItems.map(([k,l]) => <label className="check" key={k}><input type="checkbox" checked={p.privacidad.includes(k)} onChange={() => toggle("privacidad",k)}/>{l}</label>)}</section></div><button className="primary" disabled={busy || !p.modules.length || !p.acciones.includes("ver")} onClick={() => void onSave(p)}>Guardar permisos</button></Modal>;
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
