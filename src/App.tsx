import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  HeartPulse,
  BookOpen,
  ClipboardList,
  Link,
  ShieldCheck,
  Users as UsersIcon,
  Sun,
  Moon,
  Monitor,
  Menu,
  LogOut,
  UserRound,
  Download,
} from "lucide-react";
import { api, type Row } from "./lib";
import {
  Brand,
  ErrorNote,
  Modal,
  RecordForm,
  RecordDetails,
  Records,
  Attachments,
  Empty,
} from "./components";
import { modules } from "../shared/models.js";
import Dashboard from "./Dashboard";
import Anamnesis from "./Anamnesis";
import { Audit, Guests, Users } from "./Administration";

function Theme() {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem("luspace-theme") || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("luspace-theme", value);
    } catch {}
  }, [value]);
  return (
    <div className="theme-control" aria-label="Tema visual">
      {[
        ["light", Sun, "Claro"],
        ["dark", Moon, "Oscuro"],
        ["system", Monitor, "Sistema"],
      ].map(([k, I, label]) => {
        const Icon = I as typeof Sun;
        return (
          <button
            key={String(k)}
            onClick={() => setValue(String(k))}
            className={value === k ? "active" : ""}
            aria-label={String(label)}
            aria-pressed={value === k}
          >
            <Icon size={16} />
            <span>{String(label)}</span>
          </button>
        );
      })}
    </div>
  );
}
function Auth({
  setup,
  local,
  onDone,
  guestToken,
}: {
  setup: boolean;
  local: boolean;
  onDone: () => void;
  guestToken: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      await api(
        guestToken ? "guest/exchange" : setup ? "setup" : "login",
        "POST",
        guestToken ? { ...b, token: guestToken } : b,
      );
      if (guestToken) history.replaceState(null, "", "/");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-theme">
        <Theme />
      </div>
      <main className="auth-card">
        <Brand />
        <p className="eyebrow">UN ESPACIO PARA ACOMPAÑAR</p>
        <h1>
          {guestToken
            ? "Acceso profesional"
            : setup
              ? "Bienvenidos a LuSpace"
              : "Bienvenido de nuevo"}
        </h1>
        <p className="muted">
          {guestToken
            ? "Consulta segura de los módulos compartidos por la familia."
            : setup
              ? "Crea tu cuenta principal para comenzar. Después podrás invitar a otros cuidadores."
              : "Ingresa para continuar con el cuidado de tu familia."}
        </p>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            {setup && !guestToken && (
              <>
                <label className="field">
                  Tu nombre
                  <input name="nombre" required autoComplete="name" />
                </label>
                <label className="field">
                  Nombre de la familia
                  <input name="familia" required />
                </label>
                {!local && (
                  <label className="field">
                    Clave de instalación
                    <input name="setup_key" type="password" required />
                  </label>
                )}
              </>
            )}
            {!guestToken ? (
              <>
                <label className="field">
                  Correo
                  <input
                    name="correo"
                    type="email"
                    required
                    autoComplete="username"
                  />
                </label>
                <label className="field">
                  Contraseña{setup ? " (mínimo 12 caracteres)" : ""}
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={setup ? 12 : undefined}
                    maxLength={128}
                    autoComplete={setup ? "new-password" : "current-password"}
                  />
                </label>
              </>
            ) : (
              <label className="field">
                PIN, si te lo entregaron
                <input
                  name="pin"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="off"
                />
              </label>
            )}
            <ErrorNote error={error} />
            <button className="primary" disabled={busy}>
              {busy
                ? "Ingresando…"
                : guestToken
                  ? "Consultar información"
                  : setup
                    ? "Crear mi familia"
                    : "Iniciar sesión"}
            </button>
          </fieldset>
        </form>
        {!setup && !guestToken && (
          <p className="muted">
            Si olvidaste tu contraseña, pide a un SuperAdmin de tu familia que
            restablezca tu acceso.
          </p>
        )}
      </main>
    </div>
  );
}
function Rnd({ child, close }: { child: Row; close: () => void }) {
  const [record, setRecord] = useState<Row | null>(null),
    [files, setFiles] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api("records/credenciales_discapacidad?child=" + child.id),
      api("files?child=" + child.id + "&module=rnd"),
    ])
      .then(([records, attachments]) => {
        setRecord(records[0] || {});
        setFiles(attachments);
      })
      .catch((e) => setError(e.message));
  }, [child.id]);
  const linked = record
    ? [record.frente_r2_key, record.reverso_r2_key].filter(Boolean)
    : [];
  const documents = [
    ...(record?.frente_r2_key
      ? [{ id: record.frente_r2_key, label: "Frente / documento" }]
      : []),
    ...(record?.reverso_r2_key
      ? [{ id: record.reverso_r2_key, label: "Reverso" }]
      : []),
    ...files
      .filter((file) => !linked.includes(file.id))
      .map((file) => ({ id: file.id, label: "Documento adjunto: " + file.nombre })),
  ];
  return (
    <Modal
      title="Credencial RND"
      fullScreen
      description={"Documento de " + child.primer_nombre}
      close={close}
    >
      <ErrorNote error={error} />
      {record ? (
        record.id || documents.length ? (
          <>
            {record?.id && !record.activo && (
              <p className="muted">
                La credencial está adjunta, pero figura como inactiva. Puedes activarla desde Editar credencial.
              </p>
            )}
            {record?.id && <RecordDetails table="credenciales_discapacidad" row={record} />}
            {documents.map((document) => (
                <section key={document.id}>
                  <h3>{document.label}</h3>
                  <iframe
                    title={document.label}
                    src={"/api/files/" + document.id}
                    className="credential-frame"
                  />
                  <a
                    className="secondary"
                    href={"/api/files/" + document.id + "?download=1"}
                  >
                    <Download size={16} />
                    Descargar
                  </a>
                </section>
              ))}
          </>
        ) : (
          <Empty>No hay una credencial activa adjunta.</Empty>
        )
      ) : (
        <p>Cargando credencial…</p>
      )}
    </Modal>
  );
}
function Export({
  child,
  allowed,
  close,
}: {
  child: Row;
  allowed: string[];
  close: () => void;
}) {
  const [selected, setSelected] = useState(
      allowed.includes("anamnesis") ? ["anamnesis"] : allowed.slice(0, 1),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Descargar informe PDF"
      description="Selecciona la información que incluirá el documento."
      close={close}
    >
      <div className="check-grid">
        {Object.entries(modules)
          .filter(([k]) => allowed.includes(k))
          .map(([k, label]) => (
            <label className="check" key={k}>
              <input
                type="checkbox"
                checked={selected.includes(k)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, k]
                      : selected.filter((v) => v !== k),
                  )
                }
              />
              {label}
            </label>
          ))}
      </div>
      <ErrorNote error={error} />
      <button
        className="primary"
        disabled={busy || !selected.length}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const data = await api("export", "POST", {
              child: child.id,
              modules: selected,
            });
            const { exportPdf } = await import("./report");
            await exportPdf(data);
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparando PDF…" : "Descargar PDF"}
      </button>
    </Modal>
  );
}
const navigation = [
  ["inicio", "Inicio", Activity],
  ["perfil", "Perfil", UserRound],
  ["salud", "Salud", HeartPulse],
  ["escolar", "Escolar", BookOpen],
  ["anamnesis", "Anamnesis", ClipboardList],
  ["rnd", "Credencial RND", ShieldCheck],
  ["invitados", "Invitados", Link],
  ["usuarios", "Familia y accesos", UsersIcon],
  ["auditoria", "Auditoría", ShieldCheck],
] as const;
export default function App() {
  const [me, setMe] = useState<Row | null>(null),
    [status, setStatus] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [children, setChildren] = useState<Row[]>([]),
    [childId, setChildId] = useState(""),
    [view, setView] = useState("inicio"),
    [menu, setMenu] = useState(false),
    [profile, setProfile] = useState<Row | null>(null),
    [rnd, setRnd] = useState(false),
    [report, setReport] = useState(false),
    [tab, setTab] = useState(0),
    [dirty, setDirty] = useState(false);
  const [guestToken, setGuestToken] = useState(() =>
    location.pathname.startsWith("/invitado")
      ? location.hash.slice(1) || location.pathname.split("/")[2] || ""
      : "",
  );
  async function load(afterLogin = false) {
    setLoading(true);
    setError("");
    try {
      setStatus(await api("status"));
      if (guestToken && !afterLogin) {
        setMe(null);
        return;
      }
      let user;
      try {
        user = await api("me");
      } catch {
        setMe(null);
        return;
      }
      setMe(user);
      const list = await api("children");
      setChildren(list);
      setChildId((id) =>
        list.some((n: Row) => n.id === id) ? id : list[0]?.id || "",
      );
      if (user.guest) setView(user.modules[0]);
      setGuestToken("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function reloadChildren() {
    const list = await api("children");
    setChildren(list);
    if (!childId && list.length) setChildId(list[0].id);
  }
  function go(next: string) {
    if (
      dirty &&
      !window.confirm(
        "Hay cambios sin guardar en la anamnesis. ¿Quieres salir y descartarlos?",
      )
    )
      return;
    setDirty(false);
    setView(next);
    setTab(0);
    setMenu(false);
  }
  async function logout() {
    if (
      dirty &&
      !window.confirm("Hay cambios sin guardar. ¿Quieres cerrar sesión?")
    )
      return;
    try {
      await api("logout", "POST");
      setMe(null);
      setChildren([]);
      setChildId("");
      setView("inicio");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const child = children.find((n) => n.id === childId),
    readonly = !!me?.guest,
    available = readonly ? me?.modules : Object.keys(modules);
  if (loading)
    return (
      <div className="loading" role="status">
        <Brand />
        <p>Abriendo tu espacio…</p>
      </div>
    );
  if (!me)
    return (
      <>
        <ErrorNote error={error} />
        {status ? (
          <Auth
            setup={status.setup}
            local={status.local}
            guestToken={guestToken}
            onDone={() => void load(true)}
          />
        ) : (
          <div className="loading">
            <button className="primary" onClick={() => void load()}>
              Reintentar conexión
            </button>
          </div>
        )}
      </>
    );
  const schoolTables = [
      "perfiles_escolares",
      "perfiles_escolares",
      "historial_colegios",
      "bitacora_escolar_diaria",
    ],
    healthTables = [
      "registros_crecimiento",
      "medicamentos",
      "consultas_medicas",
      "examenes_medicos",
    ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <Brand />
        <nav>
          {navigation
            .filter(([k]) =>
              readonly
                ? available.includes(k)
                : k !== "auditoria" || me.rol === "superadmin",
            )
            .map(([key, label, Icon]) => (
              <button
                key={key}
                className={view === key ? "selected" : ""}
                onClick={() => go(key)}
                aria-current={view === key ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}
        </nav>
        <div className="profile">
          <span>{me.nombre.slice(0, 1)}</span>
          <div>
            <strong>{me.familia}</strong>
            <small>{readonly ? "Invitado · solo lectura" : me.nombre}</small>
          </div>
        </div>
        <button className="link-button" onClick={() => void logout()}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </aside>
      <div className="page">
        <header>
          <button
            className="menu-button"
            aria-label="Abrir menú"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <label className="child-selector">
            <span className="sr-only">Perfil seleccionado</span>
            <select
              value={childId}
              onChange={(e) => {
                if (
                  dirty &&
                  !confirm("Hay cambios sin guardar. ¿Cambiar de perfil?")
                )
                  return;
                setDirty(false);
                setChildId(e.target.value);
              }}
            >
              {children.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.apodo || c.primer_nombre}
                </option>
              ))}
              {!children.length && <option>Mi familia</option>}
            </select>
          </label>
          {child?.rnd_habilitado && available.includes("rnd") ? (
            <button className="rnd" onClick={() => setRnd(true)}>
              <ShieldCheck size={17} />
              <span>Credencial RND</span>
            </button>
          ) : null}
          <Theme />
        </header>
        <main id="main" className="content" key={childId}>
          <ErrorNote error={error} />
          {!child ? (
            <section className="card welcome">
              <h1>Comencemos con su perfil</h1>
              <p className="muted">
                Registra los datos de Luciano o de otro niño/a de tu familia.
                Podrás editarlos cuando quieras.
              </p>
              {!readonly && (
                <button className="primary" onClick={() => setProfile({})}>
                  Crear primer perfil
                </button>
              )}
            </section>
          ) : (
            <>
              <div className="page-tools">
                {readonly && (
                  <span className="badge">
                    Consulta profesional · solo lectura
                  </span>
                )}
                <button className="link-button" disabled={dirty} title={dirty ? "Espera a que la anamnesis indique Guardado" : undefined} onClick={() => setReport(true)}>
                  <Download size={16} />
                  Descargar informe PDF
                </button>
              </div>
              {view === "inicio" && <Dashboard child={child} go={go} />}{" "}
              {view === "perfil" && (
                <>
                  <div className="section-heading">
                    <h1>Perfil de {child.primer_nombre}</h1>
                    <div className="actions">
                      <button
                        className="secondary"
                        onClick={() => setProfile(child)}
                      >
                        Editar perfil
                      </button>
                      <button
                        className="secondary"
                        onClick={() => setProfile({})}
                      >
                        Agregar niño/a
                      </button>
                    </div>
                  </div>
                  <article className="card">
                    <RecordDetails table="ninos" row={child} />
                  </article>
                </>
              )}
              {["salud", "escolar"].includes(view) && (
                <>
                  <h1>
                    {view === "salud"
                      ? "Salud y crecimiento"
                      : "Escuela y neurodiversidad"}
                  </h1>
                  <div className="tabs" role="group" aria-label="Secciones">
                    {(view === "salud"
                      ? ["Mediciones", "Tratamientos", "Consultas médicas", "Exámenes"]
                      : [
                          "Manual de apoyo",
                          "Adecuaciones PIE / PACI",
                          "Historial de colegios",
                          "Bitácora diaria",
                        ]
                    ).map((s, i) => (
                      <button
                        key={s}
                        className={tab === i ? "selected" : ""}
                        aria-pressed={tab === i}
                        onClick={() => setTab(i)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <Records
                    key={view + tab}
                    table={
                      (view === "salud" ? healthTables : schoolTables)[tab] ||
                      healthTables[0]
                    }
                    child={child}
                    readonly={readonly}
                    onlyFields={
                      view === "escolar" && tab === 1
                        ? ["adecuaciones_json"]
                        : undefined
                    }
                  />
                  <Attachments
                    child={child}
                    module={view}
                    readonly={readonly}
                  />
                </>
              )}
              {view === "anamnesis" && (
                <Anamnesis
                  child={child}
                  readonly={readonly}
                  onDirty={setDirty}
                />
              )}{" "}
              {view === "rnd" && (
                <>
                  <h1>Credencial de discapacidad</h1>
                  <p className="muted">
                    Activa el acceso rápido desde el perfil del niño/a.
                  </p>
                  <Records
                    table="credenciales_discapacidad"
                    child={child}
                    readonly={readonly}
                  />
                  {!!child.rnd_habilitado && (
                    <button className="secondary" onClick={() => setRnd(true)}>
                      Ver credencial en pantalla completa
                    </button>
                  )}
                </>
              )}
              {view === "invitados" && !readonly && <Guests child={child} />}{" "}
              {view === "usuarios" && !readonly && (
                <Users
                  me={me}
                  onLogout={() => {
                    setMe(null);
                    setChildren([]);
                  }}
                />
              )}
              {view === "auditoria" && me.rol === "superadmin" && <Audit />}
            </>
          )}
        </main>
      </div>
      {profile && (
        <Modal
          title={profile.id ? "Editar perfil" : "Nuevo perfil"}
          close={() => setProfile(null)}
        >
          <RecordForm
            table="ninos"
            initial={profile}
            onSave={async (v) => {
              const r = await api(
                profile.id ? "children/" + profile.id : "children",
                profile.id ? "PUT" : "POST",
                v,
              );
              await reloadChildren();
              if (r.id) setChildId(r.id);
              setProfile(null);
            }}
          />
        </Modal>
      )}
      {rnd && child && <Rnd child={child} close={() => setRnd(false)} />}{" "}
      {report && child && (
        <Export
          child={child}
          allowed={available}
          close={() => setReport(false)}
        />
      )}
    </div>
  );
}

