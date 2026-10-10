import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  HeartPulse,
  BookOpen,
  ClipboardList,
  Link,
  ShieldCheck,
  Users as UsersIcon,
  Menu,
  LogOut,
  UserRound,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Files,
  ListTodo,
  Mail,
  LockKeyhole,
  ArrowRight,
  Gift,
  UserRoundPlus,
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
  PdfPreview,
  Empty,
} from "./components";
import { modules } from "../shared/models.js";
import { reportGroups, selectionModules, documentSelection } from '../shared/report-selection.js';
import Dashboard from "./Dashboard";
import {AccessActor} from "./AccessPolicy";
import {canAccess} from "../shared/access-policy.js";
import SidebarLogo from './SidebarLogo';
import Reminders from './Reminders';
import ChildAvatar from './ChildAvatar';
import TrialCard from './TrialCard';
import ConsultationPrep from "./ConsultationPrep";
import VaccinationCard from "./VaccinationCard";
import AdminPortal from "./AdminPortal";
import Landing from './Landing';
import MyFiles from './MyFiles';
import Billing from './Billing';
import SiteBanner from './SiteBanner';
import LegalPage from './LegalPage';
import {LEGAL_VERSION} from '../shared/legal.js';
import './legal.css';
import Theme from './ThemeControl';
import './auth-access.css';
import AuthWelcome from './AuthWelcome';
import './auth-conversion.css';
import { useSubscription } from './useSubscription';
import Anamnesis from "./Anamnesis";
import {useStartupLoading} from './StartupScreen';
import { Audit, Guests, Users, ProfileAccess } from "./Administration";
import { loadPdfModule, PdfModuleError, recoverPdfDeployment, takePdfResume, type PdfResume } from './pdfRecovery';

function RegistrationNotice() {
  return <p className="registration-notice">Al crear tu cuenta, aceptas los <a href="/terminos" target="_blank" rel="noopener noreferrer">Términos y condiciones</a> y la <a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad</a> de LuSpace.</p>;
}
export function Auth({
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
  const showcase = !setup && !register && !guestToken && location.pathname !== '/registro';
  async function continueGoogle(button: HTMLButtonElement) {
    const form = button.closest('form');
    const data = form ? Object.fromEntries(new FormData(form)) : {};
    setBusy(true); setError('');
    try {
      // Acceptance is submitted only after this registration action, never on page load.
      const legalInput = {legal_accepted:true,legal_version:LEGAL_VERSION};
      const result = await api('auth/google/start', 'POST', {nombre:data.nombre, familia:data.familia, mode:register ? 'register' : 'login',...(register?legalInput:{})});
      location.assign(result.url);
    } catch(e) {setError((e as Error).message); setBusy(false);}
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      const legalInput = {legal_accepted:true,legal_version:LEGAL_VERSION};
      await api(
        guestToken ? "guest/exchange" : register ? "register" : setup ? "setup" : "login",
        "POST",
        guestToken ? { ...b, token: guestToken } : register ? {...b,...legalInput} : showcase ? {...b,remember:b.remember==='on'} : b,
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
    <div className={'auth-page auth-minimal-page'+(showcase?' auth-login-showcase':'')+((showcase||register)?' auth-entry':'')}>
      <div className="auth-theme">
        <Theme />
      </div>
      {showcase&&<><div className="login-organic login-organic-mint" aria-hidden="true"/><div className="login-organic login-organic-lilac" aria-hidden="true"/><div className="login-wave" aria-hidden="true"/><div className="login-leaves" aria-hidden="true"><i/><i/><i/></div></>}
      {showcase && <AuthWelcome/>}
      <main className="auth-card auth-minimal">
        {(showcase||register)&&registration&&<nav className="auth-route-selector" aria-label="Acceso a LuSpace"><a href="/registro" aria-current={register?'page':undefined}><UserRoundPlus size={17} aria-hidden="true"/><span>Probar 14 días gratis</span></a><a href="/login" aria-current={showcase?'page':undefined}>Entrar</a></nav>}
        <a className="auth-home-logo" href="/presentacion" aria-label="LuSpace, volver al inicio">{showcase||register?<img className="auth-horizontal-logo" src="/brand/luspace-horizontal.png" alt="LuSpace" width="2172" height="724"/>:<Brand />}</a>
        <a className="auth-back" href="/presentacion" aria-label="Volver al inicio">← Volver al inicio</a>
        <h1>
          {guestToken
            ? "Acceso profesional"
            : createAccount
              ? "Crea tu cuenta"
              : showcase ? "Inicia sesión" : "Bienvenido a LuSpace"}
        </h1>
        {showcase&&<p className="login-subtitle">Accede a tu espacio familiar</p>}
        {!showcase && !setup && !guestToken && registration && <p className="auth-trial-badge">Familias nuevas: 14 días gratis · $0</p>}
        {guestToken && <p className="muted">Acceso compartido por tu familia.</p>}
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            {!showcase && !setup && !guestToken && <>
              <button className="google-signin" type="button" disabled={!google || busy} onClick={e => continueGoogle(e.currentTarget)}><img src="/brand/google-g.png" alt="" width="20" height="20"/> <span>Continuar con Google</span></button>
              {!google && <p className="auth-hint">Google no está disponible todavía.</p>}
              <div className="auth-divider"><span>o continúa con tu correo</span></div>
            </>}
            {createAccount && !guestToken && (
              <>
                <label className="field">
                  Tu nombre
                  <input name="nombre" required autoComplete="name" placeholder="Ej. Mateo Rivera" />
                </label>
                <label className="field">
                  Nombre de la familia
                  <input name="familia" required placeholder="Ej. Familia Rivera" />
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
                  {showcase?'Correo electrónico':'Correo'}
                  <span className={showcase?'login-input-wrap':''}>
                  {showcase&&<Mail size={20} aria-hidden="true"/>}
                  <input
                    name="correo"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder={showcase ? 'Correo electrónico' : register ? "tunombre@email.com" : undefined}
                  />
                  </span>
                </label>
                <label className="field">
                  Contraseña{createAccount ? " (mínimo 12 caracteres)" : ""}
                  <span className="password-field">
                    {showcase&&<LockKeyhole size={20} className="login-lock" aria-hidden="true"/>}
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={createAccount ? 12 : undefined}
                      maxLength={128}
                      autoComplete={createAccount ? "new-password" : "current-password"}
                      placeholder={showcase ? 'Contraseña' : register ? "••••••••••••" : undefined}
                    />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                {register && <>
                  <p className="auth-hint">Usa letras y números.</p>
                  <label className="field">Confirmar contraseña
                    <input name="password_confirmation" type={showPassword ? "text" : "password"} required minLength={12} maxLength={128} autoComplete="new-password" placeholder="••••••••••••" />
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
            {showcase&&<div className="login-options"><label title="Mantener la sesión en este navegador durante un máximo de 8 horas"><input type="checkbox" name="remember"/>Recordarme</label><button type="button" onClick={()=>setRecoveryOpen(true)}>¿Olvidaste tu contraseña?</button></div>}
            <button className="primary" disabled={busy}>
              {busy
                ? "Ingresando…"
                : guestToken
                  ? "Consultar información"
                  : createAccount
                    ? register ? "Comenzar prueba GRATIS de 14 días" : "Crear mi familia"
                    : "Iniciar sesión"}
              {showcase&&<ArrowRight size={22} aria-hidden="true"/>}
            </button>
            {showcase&&<><div className="auth-divider"><span>o</span></div><button className="google-signin" type="button" disabled={!google || busy} onClick={e=>continueGoogle(e.currentTarget)}><img src="/brand/google-g.png" alt="" width="20" height="20"/><span>Continuar con Google</span></button>{!google&&<p className="auth-hint">Google no está disponible todavía.</p>}</>}
            {register && <RegistrationNotice/>}
          </fieldset>
        </form>
        {!showcase && !createAccount && !guestToken && (
          <button type="button" className="auth-help" onClick={() => setRecoveryOpen(true)}>¿Olvidaste tu contraseña?</button>
        )}
        {showcase&&registration&&<div className="login-register-action"><a className="login-register-button" href="/registro"><Gift size={20} aria-hidden="true"/><span>Probar 14 días gratis · $0</span><ArrowRight size={20} aria-hidden="true"/></a><p>Sin tarjeta</p></div>}
        {!showcase && !setup && !guestToken && (register
          ? <p className="auth-alternate">¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a></p>
          : registration
            ? <div className="auth-trial"><p>¿Tu familia aún no tiene cuenta?</p><a href="/registro">Probar LuSpace durante 14 días</a><span>$0 durante la prueba · Sin tarjeta</span></div>
            : location.pathname === "/registro" && <p className="muted">El registro de nuevas familias todavía no está habilitado. <a href="/login">Volver al inicio de sesión</a></p>)}
        {!register && !setup && !guestToken && <p className="auth-legal-link"><a href="/terminos" target="_blank" rel="noopener noreferrer">Términos y condiciones</a> y la <a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad</a></p>}
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
                  {String(files.find(file=>file.id===document.id)?.mime||'').startsWith('image/')?<img className="credential-image" src={"/api/files/"+document.id} alt={document.label}/>:<PdfPreview name={files.find(file=>file.id===document.id)?.nombre||document.label} url={"/api/files/"+document.id}/>}
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
  actor,
  canReload,
  resume,
}: {
  child: Row;
  allowed: string[];
  close: () => void;
  actor: string;
  canReload: boolean;
  resume: PdfResume | null;
}) {
  const [selected, setSelected] = useState(
      resume ? reportGroups.filter(g=>allowed.includes(g.module)).flatMap(g=>g.items.filter(i=>i.id===documentSelection ? false : i.id==='photo' ? !!child.foto_perfil_id&&(resume.photo||resume.selected.includes('photo')) : resume.selected.includes(i.id)||resume.selected.includes(g.module)).map(i=>i.id)).concat(resume.selected.includes(documentSelection)?[documentSelection]:[]) : reportGroups.filter(g=>g.module===(allowed.includes('anamnesis')?'anamnesis':allowed[0])).flatMap(g=>g.items.map(i=>i.id)).filter(id=>!['photo',documentSelection].includes(id)),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  return (
    <Modal
      title="Descargar informe PDF"
      description="Selecciona la información que incluirá el documento."
      close={close}
    >
      {resume && <p role="status" className="muted">LuSpace se actualizó. Conservamos tu selección; pulsa Descargar PDF para continuar.</p>}
      <div className="report-selection">
        {reportGroups.filter(g=>allowed.includes(g.module)).map(g=>{
          const items=g.items.filter(i=>i.id!=='photo'||child.foto_perfil_id);
          const ids=items.map(i=>i.id), count=ids.filter(id=>selected.includes(id)).length;
          return <details key={g.module} open>
            <summary>{g.label} <span className="muted">{count}/{ids.length}</span></summary>
            <label className="check"><input type="checkbox" aria-label={g.label} disabled={busy} checked={count===ids.length} ref={el=>{if(el)el.indeterminate=count>0&&count<ids.length;}} onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,...ids])]:old.filter(id=>!ids.includes(id)))} />Seleccionar todo / desmarcar todo</label>
            <div className="check-grid">{items.map(i=><label className="check" key={i.id}><input type="checkbox" disabled={busy} checked={selected.includes(i.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,i.id]:old.filter(id=>id!==i.id))} />{i.label}</label>)}</div>
          </details>;
        })}
        {!allowed.includes('rnd') && <label className="check"><input type="checkbox" disabled={busy} checked={selected.includes(documentSelection)} onChange={e=>setSelected(old=>e.target.checked?[...old,documentSelection]:old.filter(id=>id!==documentSelection))} />Lista / resumen de documentos adjuntos de los módulos seleccionados</label>}
        <p className="muted">La ficha de identificación, contacto principal y últimas mediciones siempre se incluye según tus permisos. Estas casillas controlan las secciones detalladas. Se omiten datos vacíos del detalle. Los adjuntos se listan por nombre; no se incrustan. Si solo eliges documentos, se resumen todos los módulos permitidos.</p>
      </div>
      <ErrorNote error={error} />
      {busy && <p role="status" aria-live="polite">Generando informe…</p>}
      <button
        className="primary"
        disabled={busy || !selected.length}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const data = await api("export", "POST", {
              child: child.id,
              modules: selectionModules(selected).length ? selectionModules(selected) : selected.includes(documentSelection) ? allowed : [],
              selection: selected,
            });
            if (selected.includes('photo') && child.foto_perfil_id) {
              const response = await fetch("/api/files/" + child.foto_perfil_id, { credentials: "same-origin" });
              if (!response.ok) throw new Error('No se pudo cargar la foto seleccionada. Inténtalo nuevamente o desmarca Foto de perfil.');
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
            const { exportPdf } = await loadPdfModule(() => import("./report"));
            await exportPdf(data);
            close();
          } catch (e) {
            if (e instanceof PdfModuleError) {
              if (await recoverPdfDeployment({ actor, child: child.id, selected, photo: selected.includes('photo') }, () => canReload && alive.current)) return;
              if (alive.current) setError(e.message);
            } else if (alive.current) setError((e as Error).message || 'No se pudo generar el informe. Inténtalo nuevamente.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Generando informe…" : "Descargar PDF"}
      </button>
    </Modal>
  );
}
const navigation = [
  ["inicio", "Inicio", Activity],
  ["recordatorios", "Recordatorios", ListTodo],
  ["perfil", "Perfil", UserRound],
  ["salud", "Salud", HeartPulse],
  ["escolar", "Escolar", BookOpen],
  ["anamnesis", "Anamnesis", ClipboardList],
  ["rnd", "Credencial RND", ShieldCheck],
  ["invitados", "Invitados", Link],
  ["usuarios", "Familia y accesos", UsersIcon],
  ["archivos", "Mis archivos", Files],
  ["auditoria", "Auditoría", ShieldCheck],
] as const;
export default function App() {
  if(location.pathname==='/terminos') return <LegalPage kind="terms"/>;
  if(location.pathname==='/privacidad') return <LegalPage kind="privacy"/>;
  return location.pathname === "/admin" || location.pathname.startsWith("/admin/") ? <AdminPortal /> : <FamilyApp />;
}
function FamilyApp() {
  const [subscriptionInfo,setSubscriptionInfo]=useState(()=>{const returned=sessionStorage.getItem('luspace-billing-return')==='1';sessionStorage.removeItem('luspace-billing-return');return returned;});
  const [profileAccess,setProfileAccess]=useState(false);
  const [pdfResume, setPdfResume] = useState<PdfResume | null>(() => takePdfResume());
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
  useEffect(()=>{if(!profile)setProfileAccess(false);},[profile]);
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
      if(user.subscription?.can_read===false){setChildren([]);setChildId('');setGuestToken('');return;}
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
    if (!childId || !me || !canAccess(me, "rnd")) {
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
  useEffect(()=>{if(me && subscription.canRead && !loading)void reloadChildren().catch(()=>{});},[subscription.canRead]);
  useStartupLoading(loading);
  const child = children.find((n) => n.id === childId),
    roleReadonly = !!me?.guest || (me?.rol !== "superadmin" && !JSON.parse(me?.permisos_json || "{}").acciones?.some((action: string) => ["crear", "editar", "eliminar"].includes(action))),
    readonly = roleReadonly || !subscription.canWrite,
    available = Object.keys(modules).filter(m => !!me && canAccess(me, m));
  const reminderPermissions=JSON.parse(me?.permisos_json || '{}');
  const remindersEnabled=!!me&&!me.guest&&available.includes('recordatorios')&&(me.rol==='superadmin'||reminderPermissions.modules?.includes('recordatorios')||(me.rol==='editor'&&!reminderPermissions.modules?.length));
  useEffect(() => {
    if (loading || !me || !pdfResume) return;
    if (pdfResume.actor === me.id && children.some(n => n.id === pdfResume.child) && me.platform_controls?.reports_enabled !== false) {
      setChildId(pdfResume.child); setReport(true);
    } else setPdfResume(null);
  }, [loading, me?.id, children, pdfResume]);
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
      "horario_escolar",
    ],
    healthTables = [
      "registros_crecimiento",
      "medicamentos",
      "consultas_medicas",
      "examenes_medicos",
      "vacunas",
      "alimentacion",
      "dosis_sos",
      "urgencias",
      "sesiones_terapia",
      "gastos_medicos",
      "turnos_cuidadores",
    ];
  return (
    <AccessActor.Provider value={me}><FileUploadEnabled.Provider value={me.platform_controls?.uploads_enabled!==false}><div className={"app-shell" + (view === "inicio" ? " home-shell" : "")}>
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
        <SidebarLogo />
        <nav>
          {navigation
            .filter(([k]) => !Object.hasOwn(modules,k) || available.includes(k))
            .filter(([k]) => k !== 'archivos' || !me.guest)
            .filter(([k]) => k !== 'recordatorios' || remindersEnabled)
            .filter(([k]) =>
              readonly
                ? available.includes(k) || (k === 'inicio' && !me.guest) || (k === 'archivos' && !me.guest)
                : k !== "auditoria" || (me.rol === "superadmin" && !!me.audit_visible),
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
        {!me.guest && (subscription.trial || subscription.confirmedPaidUntil) && <TrialCard daysLeft={subscription.daysLeft} paidUntil={subscription.confirmedPaidUntil} onActivate={()=>setSubscriptionInfo(true)}/>}
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
            <ChildAvatar child={subscription.canRead ? child : undefined}/>
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
          {view !== "plataforma" && subscription.canRead && child && available.some(m => canAccess(me, m, "descargar")) && me.platform_controls?.reports_enabled!==false && (
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
        <SiteBanner/>
        <main id="main" className="content" key={childId}>
          {!subscription.canWrite && <div className="subscription-banner" role="status"><p>Tu período terminó. Activa tu plan para continuar.</p><p>{subscription.canRead ? `Puedes consultar y descargar tu información hasta ${new Date(subscription.value?.read_access_ends_at).toLocaleString('es-CL')}. Realiza el pago para mantener el acceso o descarga un respaldo antes de esa fecha.` : 'El plazo de 14 días para consultar y descargar terminó. Tus datos no se han eliminado automáticamente.'}</p>{!me.guest && <button onClick={()=>setSubscriptionInfo(true)}>Activar plan</button>} <a href="mailto:contacto@luspace.cl">Solicitar recuperación de datos</a></div>}
          <ErrorNote error={error} />
          {!subscription.canRead ? <section className="card"><h1>Reactiva tu plan</h1><p>El acceso a los módulos está bloqueado. Puedes gestionar el pago o solicitar recuperación de tus datos.</p></section> : view==='recordatorios'&&remindersEnabled ? <Reminders children={children} readonly={readonly}/> : !child ? (
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
              {view === "inicio" && <Dashboard child={child} go={go} readonly={readonly} remindersEnabled={remindersEnabled} available={available} />}{" "}
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
                      <RecordDetails table="ninos" row={child} onlyFields={["primer_nombre", "apellidos", "rut", "fecha_nacimiento", "convivientes", "sexo_referencia", "foto_perfil_id", "carnet_identidad_id", "adjuntos_json"]} />
                    </article>
                    <article className="card profile-card">
                      <h2>Información médica y previsión</h2>
                      <RecordDetails table="ninos" row={child} onlyFields={["grupo_sanguineo", "prevision_salud", "alergias", "diagnostico", "hospitalizado", "hospitalizacion_motivo", "hospitalizacion_estadia", "especialistas_json", "rnd_habilitado"]} />
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
                      ? ["Mediciones", "Tratamientos continuos", "Consultas médicas", "Exámenes", "Carnet de vacunas", "Alimentación", "Dosis SOS / Enfermedad", "Urgencias", "Terapias y equipo", "Gastos y reembolsos", "Muro de cuidadores"]
                      : [
                          "Manual de apoyo",
                          "Adecuaciones PIE / PACI",
                          "Historial de cuidado y educación",
                          "Bitácora diaria",
                          "Horario / Rutina diaria",
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
                  {view === "salud" && tab === 2 && !readonly && !!me.ai_visible && me.platform_controls?.ai_enabled!==false && <ConsultationPrep key={child.id} child={child} allowed={available || []} />}
                  {view === 'salud' && tab === 4 ? <VaccinationCard key={child.id} child={child} readonly={readonly} user={me}/> : <Records
                    key={view + tab}
                    table={
                      (view === "salud" ? healthTables : schoolTables)[tab] ||
                      healthTables[0]
                    }
                    child={child}
                    readonly={readonly}
                    onlyFields={
                      view === "escolar" && tab === 1
                        ? ["pie_paci_activo", "adecuaciones_json", "paec_json", "adecuaciones_adjuntos_json"]
                        : undefined
                    }
                  />}
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
              {view === "auditoria" && me.rol === "superadmin" && !!me.audit_visible && <Audit />}
              {view === "archivos" && !me.guest && <MyFiles children={children}/>}
            </>
          )}
        </main>
      </div>
      {subscriptionInfo && <Billing close={()=>setSubscriptionInfo(false)}/>}
      {subscription.canRead && <>
      {profile && (
        <Modal
          title={profile.id ? "Editar perfil" : "Nuevo perfil"}
          className="profile-editor-modal"
          description="Organiza sus datos por sección."
          close={() => setProfile(null)}
        >
          <RecordForm
            table="ninos"
            initial={profile}
            child={profile.id}
            onCancel={()=>setProfile(null)}
            onManagePrivacy={me?.rol === 'superadmin' ? ()=>setProfileAccess(true) : undefined}
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
      {profile && profileAccess && me?.rol === 'superadmin' && <ProfileAccess close={()=>setProfileAccess(false)}/>}
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
          allowed={available.filter(m => canAccess(me, m, "descargar"))}
          actor={me.id}
          canReload={!dirty && !profile}
          resume={pdfResume}
          close={() => { setReport(false); setPdfResume(null); }}
        />
      )}
      </>}
    </div></FileUploadEnabled.Provider></AccessActor.Provider>
  );
}

