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
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { api, type Row } from "./lib";
import {
  Brand,
  FileUploadEnabled,
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
import ConsultationPrep from "./ConsultationPrep";
import AdminPortal from "./AdminPortal";
import Landing from './Landing';
import './auth-access.css';
import { useSubscription } from './useSubscription';
import Anamnesis from "./Anamnesis";
import {useStartupLoading} from './StartupScreen';
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
            title={String(label)}
            aria-pressed={value === k}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
function Auth({
  setup,
  local,
  registration,
  google,
  onDone,
  guestToken,
}: {
  setup: boolean;
  local: boolean;
  registration: boolean;
  google: boolean;
  onDone: () => void;
  guestToken: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(() => new URLSearchParams(location.search).get('google_error') || ""),
    [showPassword, setShowPassword] = useState(false),
    [recoveryOpen, setRecoveryOpen] = useState(false);
  const register = !setup && !guestToken && registration && location.pathname === "/registro";
  const createAccount = setup || register;
  async function continueGoogle(button: HTMLButtonElement) {
    const form = button.closest('form');
    const data = form ? Object.fromEntries(new FormData(form)) : {};
    setBusy(true); setError('');
    try {
      const result = await api('auth/google/start', 'POST', {nombre:data.nombre, familia:data.familia, mode:register ? 'register' : 'login'});
      location.assign(result.url);
    } catch(e) {setError((e as Error).message); setBusy(false);}
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      await api(
        guestToken ? "guest/exchange" : register ? "register" : setup ? "setup" : "login",
        "POST",
        guestToken ? { ...b, token: guestToken } : b,
      );
      if (guestToken || register) history.replaceState(null, "", "/");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page auth-minimal-page">
      <div className="auth-theme">
        <Theme />
      </div>
      <main className="auth-card auth-minimal">
        <a className="auth-home-logo" href="/presentacion" aria-label="LuSpace, volver al inicio"><Brand /></a>
        <a className="auth-back" href="/presentacion" aria-label="Volver al inicio">← Volver al inicio</a>
        <h1>
          {guestToken
            ? "Acceso profesional"
            : createAccount
              ? "Crea tu cuenta"
              : "Bienvenido a LuSpace"}
        </h1>
        {!setup && !guestToken && registration && <p className="auth-trial-badge">Familias nuevas: 14 días gratis · $0</p>}
        {guestToken && <p className="muted">Acceso compartido por tu familia.</p>}
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            {!setup && !guestToken && <>
              <button className="google-signin" type="button" disabled={!google || busy} onClick={e => continueGoogle(e.currentTarget)}><img src="/brand/google-g.png" alt="" width="20" height="20"/> <span>Continuar con Google</span></button>
              {!google && <p className="auth-hint">Google no está disponible todavía.</p>}
              <div className="auth-divider"><span>o continúa con tu correo</span></div>
            </>}
            {createAccount && !guestToken && (
              <>
                <label className="field">
                  Tu nombre
                  <input name="nombre" required autoComplete="name" />
                </label>
                <label className="field">
                  Nombre de la familia
                  <input name="familia" required />
                </label>
                {setup && !local && (
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
                  Contraseña{createAccount ? " (mínimo 12 caracteres)" : ""}
                  <span className="password-field">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={createAccount ? 12 : undefined}
                      maxLength={128}
                      autoComplete={createAccount ? "new-password" : "current-password"}
                    />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                {register && <>
                  <p className="auth-hint">Usa letras y números.</p>
                  <label className="field">Confirmar contraseña
                    <input name="password_confirmation" type={showPassword ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" />
                  </label>
                </>}
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
                  : createAccount
                    ? register ? "Comenzar prueba de 14 días" : "Crear mi familia"
                    : "Iniciar sesión"}
            </button>
          </fieldset>
        </form>
        {!createAccount && !guestToken && (
          <button type="button" className="auth-help" onClick={() => setRecoveryOpen(true)}>¿Olvidaste tu contraseña?</button>
        )}
        {!setup && !guestToken && (register
          ? <p className="auth-alternate">¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a></p>
          : registration
            ? <div className="auth-trial"><p>¿Tu familia aún no tiene cuenta?</p><a href="/registro">Probar LuSpace durante 14 días</a><span>$0 durante la prueba · Sin tarjeta</span></div>
            : location.pathname === "/registro" && <p className="muted">El registro de nuevas familias todavía no está habilitado. <a href="/login">Volver al inicio de sesión</a></p>)}
      </main>
      {recoveryOpen && <Modal title="Ayuda de acceso" description="Si olvidaste tu contraseña, pide al administrador de tu familia que restablezca tu acceso." close={() => setRecoveryOpen(false)}><button type="button" className="primary" onClick={() => setRecoveryOpen(false)}>Entendido</button></Modal>}
    </div>
  );
}
function Rnd({ child, close, readonly = false, onChange }: { child: Row; close: () => void; readonly?: boolean; onChange?: () => void }) {
  const [record, setRecord] = useState<Row | null>(null),
    [files, setFiles] = useState<Row[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const [records, attachments] = await Promise.all([
        api("records/credenciales_discapacidad?child=" + child.id),
        api("files?child=" + child.id + "&module=rnd"),
      ]);
      setRecord(records[0] || {});
      setFiles(attachments);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [child.id]);
  const linked = record
    ? [record.frente_r2_key, record.reverso_r2_key].filter(Boolean)
    : [];
  const fileIds = new Set(files.map((file) => file.id));
  const documents = [
    ...(record?.frente_r2_key && fileIds.has(record.frente_r2_key)
      ? [{ id: record.frente_r2_key, label: "Frente / documento" }]
      : []),
    ...(record?.reverso_r2_key && fileIds.has(record.reverso_r2_key)
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
                  {!readonly && (
                    <button type="button" className="link-button danger" onClick={async () => {
                      if (!confirm("¿Eliminar este archivo de la credencial?")) return;
                      try {
                        await api("files/" + document.id, "DELETE");
                        await load();
                        onChange?.();
                      } catch (e) { setError((e as Error).message); }
                    }}>
                      <Trash2 size={16} /> Eliminar archivo
                    </button>
                  )}
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
    [includePhoto, setIncludePhoto] = useState(false),
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
      {child.foto_perfil_id && (
        <label className="check">
          <input type="checkbox" checked={includePhoto} onChange={(e) => setIncludePhoto(e.target.checked)} />
          Incluir foto de perfil
        </label>
      )}
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
            if (includePhoto && child.foto_perfil_id) {
              const response = await fetch("/api/files/" + child.foto_perfil_id, { credentials: "same-origin" });
              if (response.ok) {
                const blob = await response.blob();
                data.includePhoto = true;
                data.profilePhoto = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              }
            }
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
  return location.pathname === "/admin" || location.pathname.startsWith("/admin/") ? <AdminPortal /> : <FamilyApp />;
}
function FamilyApp() {
  const [subscriptionInfo,setSubscriptionInfo]=useState(false);
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
    [rndAvailable, setRndAvailable] = useState(false),
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
  async function refreshRnd() {
    if (!childId || !me) {
      setRndAvailable(false);
      return;
    }
    try {
      const [records, files] = await Promise.all([
        api("records/credenciales_discapacidad?child=" + childId),
        api("files?child=" + childId + "&module=rnd"),
      ]);
      const record = records[0] as Row | undefined;
      const hasInformation = !!record && Object.entries(record).some(
        ([key, value]) =>
          !["id", "nino_id", "created_at", "updated_at"].includes(key) &&
          value !== null &&
          value !== "" &&
          value !== 0 &&
          value !== false,
      );
      setRndAvailable(Boolean(files.length || hasInformation));
    } catch {
      setRndAvailable(false);
    }
  }
  useEffect(() => {
    void refreshRnd();
  }, [childId, me?.id]);
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
  const subscription = useSubscription(me?.subscription,!!me?.guest);
  useStartupLoading(loading);
  const child = children.find((n) => n.id === childId),
    roleReadonly = !!me?.guest || (me?.rol !== "superadmin" && !JSON.parse(me?.permisos_json || "{}").acciones?.some((action: string) => ["crear", "editar", "eliminar"].includes(action))),
    readonly = roleReadonly || !subscription.canWrite,
    available = (me?.guest ? me.modules : Object.keys(modules)).filter((m:string)=>!me?.platform_controls?.blocked_modules?.includes(m));
  if (loading) return null;
  if (!me && status && !status.setup && location.pathname === '/') return <Landing/>;
  if (!me)
    return (
      <>
        <ErrorNote error={error} />
        {status ? (
          <Auth
            setup={status.setup}
            local={status.local}
            registration={status.registration}
            google={status.google === true}
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
    <FileUploadEnabled.Provider value={me.platform_controls?.uploads_enabled!==false}><div className={"app-shell" + (view === "inicio" ? " home-shell" : "")}>
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
            .filter(([k]) => !me.platform_controls?.blocked_modules?.includes(k))
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
        {!me.guest && subscription.trial && <div className="subscription-badge"><span>Prueba gratis: Te quedan {subscription.daysLeft} días</span><button onClick={()=>setSubscriptionInfo(true)}>Activar suscripción</button></div>}
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
        <header className={view === "inicio" ? "home-topbar" : ""}>
          <button
            className="menu-button"
            aria-label="Abrir menú"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          {view === "plataforma" ? <strong>Administración de plataforma</strong> : <label className="child-selector">
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
          {c.primer_nombre}
                </option>
              ))}
              {!children.length && <option>Mi familia</option>}
            </select>
          </label>}
          {view !== "plataforma" && child?.rnd_habilitado && rndAvailable && available.includes("rnd") ? (
            <button className="rnd" aria-label="Ver credencial RND" title="Ver credencial RND" onClick={() => setRnd(true)}>
              <ShieldCheck size={20} />
              <span>Credencial RND</span>
            </button>
          ) : null}
          {view !== "plataforma" && child && me.platform_controls?.reports_enabled!==false && (
            <button
              className="secondary header-pdf"
              aria-label="Descargar informe PDF"
              disabled={dirty}
              title={dirty ? "Espera a que la anamnesis indique Guardado" : undefined}
              onClick={() => setReport(true)}
            >
              <Download size={16} />
              <span>Descargar PDF</span>
            </button>
          )}
          <Theme />
        </header>
        <main id="main" className="content" key={childId}>
          {!me.guest && !subscription.canWrite && <div className="subscription-banner" role="status"><p>Tu prueba gratuita de 14 días ha terminado. Suscríbete para continuar organizando la salud de tu familia.</p><p>Puedes consultar y descargar tu información. No se han eliminado tus datos.</p><button onClick={()=>setSubscriptionInfo(true)}>Activar suscripción</button></div>}
          <ErrorNote error={error} />
          {!child ? (
            <section className="card welcome">
              <h1>Comencemos con su perfil</h1>
              <p className="muted">
                Registra los datos de un niño o niña de tu familia.
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
              {readonly && (
                <div className="page-tools">
                  <span className="badge">Solo lectura</span>
                </div>
              )}
              {view === "inicio" && <Dashboard child={child} go={go} readonly={readonly} />}{" "}
              {view === "perfil" && (
                <>
                  <div className="section-heading">
                    <h1>Perfil de {child.primer_nombre}</h1>
                    {!readonly && <div className="actions">
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
                    </div>}
                  </div>
                  <div className="profile-cards">
                    <article className="card profile-card">
                      <h2>Datos personales e identificación</h2>
                      {child.foto_perfil_id ? (
                        <img className="patient-photo" src={"/api/files/" + child.foto_perfil_id} alt={"Foto de " + child.primer_nombre} />
                      ) : (
                        <div className="patient-avatar" aria-label="Sin foto de perfil"><UserRound size={48} /></div>
                      )}
                      <RecordDetails table="ninos" row={child} onlyFields={["primer_nombre", "apellidos", "rut", "fecha_nacimiento", "sexo_referencia", "foto_perfil_id", "carnet_identidad_id"]} />
                    </article>
                    <article className="card profile-card">
                      <h2>Información médica y previsión</h2>
                      <RecordDetails table="ninos" row={child} onlyFields={["grupo_sanguineo", "prevision_salud", "alergias", "diagnostico", "especialistas_json", "rnd_habilitado"]} />
                    </article>
                    <article className="card profile-card">
                      <h2>Contactos de emergencia y datos escolares</h2>
                      <RecordDetails table="ninos" row={child} onlyFields={["contacto_emergencia_principal_nombre", "contacto_emergencia_principal_parentesco", "contacto_emergencia_principal_telefono", "contacto_emergencia_secundario_nombre", "contacto_emergencia_secundario_parentesco", "contacto_emergencia_secundario_telefono", "colegio_actual", "curso_actual"]} />
                    </article>
                  </div>
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
                  {view === "salud" && tab === 2 && !readonly && me.platform_controls?.ai_enabled!==false && <ConsultationPrep key={child.id} child={child} allowed={available || []} />}
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
                    onChange={() => void refreshRnd()}
                  />
                  {!!child.rnd_habilitado && rndAvailable && (
                    <button className="secondary" onClick={() => setRnd(true)}>
                      Ver credencial en pantalla completa
                    </button>
                  )}
                </>
              )}
              {view === "invitados" && !readonly && <Guests child={child} />}{" "}
              {view === "usuarios" && !roleReadonly && (
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
      {subscriptionInfo && <Modal title="Activar suscripción" close={()=>setSubscriptionInfo(false)}><p>La contratación y los pagos aún no están habilitados. No se realizará ningún cobro desde esta ventana.</p><p>Tu información seguirá disponible para consulta y descarga.</p>{subscription.value && <p>Almacenamiento: {(subscription.value.storage_used_bytes/1048576).toFixed(1)} MB de {(subscription.value.storage_limit_bytes/1048576).toFixed(0)} MB.</p>}</Modal>}
      {profile && (
        <Modal
          title={profile.id ? "Editar perfil" : "Nuevo perfil"}
          close={() => setProfile(null)}
        >
          <RecordForm
            table="ninos"
            initial={profile}
            child={profile.id}
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
      {rnd && child && (
        <Rnd
          child={child}
          close={() => setRnd(false)}
          readonly={readonly}
          onChange={() => void refreshRnd()}
        />
      )}{" "}
      {report && child && me.platform_controls?.reports_enabled!==false && (
        <Export
          child={child}
          allowed={available}
          close={() => setReport(false)}
        />
      )}
    </div></FileUploadEnabled.Provider>
  );
}
