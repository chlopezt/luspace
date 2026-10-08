import { useEffect, useState, type FormEvent } from "react";
import { Building2, LogOut, ShieldCheck, Eye, EyeOff, Users, Clock, HardDrive, Menu, Sun, Moon, Monitor, ArrowLeft } from "lucide-react";
import { api, type Row } from "./lib";
import { Brand, ErrorNote } from "./components";
import PlatformAdmin, {platformSections} from "./PlatformAdmin";
import PlatformNotifications from './PlatformNotifications';
import {useStartupLoading} from './StartupScreen';

function PlatformTheme(){
 const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('luspace-theme')||'system';}catch{return 'system';}});
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('luspace-theme',theme);}catch{}},[theme]);
 return <div className="theme-control" aria-label="Tema visual de administración">{[['light',Sun,'Claro'],['dark',Moon,'Oscuro'],['system',Monitor,'Sistema']].map(([key,Icon,label]:any)=><button key={key} aria-label={label} aria-pressed={theme===key} className={theme===key?'active':''} onClick={()=>setTheme(key)}><Icon size={17}/><span className="sr-only">{label}</span></button>)}</div>;
}

export default function AdminPortal() {
  const [mfaRequired,setMfaRequired]=useState(false);
  const [section,setSection]=useState(()=>platformSections.some(([key])=>key===location.hash.slice(1))?location.hash.slice(1):'overview'),[menu,setMenu]=useState(false);
  const [me,setMe]=useState<Row|null>(null),[owner,setOwner]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[enroll,setEnroll]=useState(false),[show,setShow]=useState(false),[notice,setNotice]=useState('');
  async function load() {
    try {setMe(await api('platform/me'));history.replaceState(null,'','/admin'+location.hash);}
    catch {setMe(null);history.replaceState(null,'','/admin/login');try{setOwner(!!(await api('me')).platform_setup_available);}catch{setOwner(false);}}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');
    try {const data=Object.fromEntries(new FormData(e.currentTarget));const result=await api(enroll?'platform/enroll':'platform/login','POST',data);if(result.mfa_required){setMfaRequired(true);setNotice('Ingresa tu código del autenticador o un código de recuperación.');return;}if(enroll){setEnroll(false);setOwner(false);setNotice('Acceso creado. Ingresa con tu correo y contraseña administrativos.');}else{setMfaRequired(false);await load();}}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  useStartupLoading(loading);
  if(loading) return null;
  if(!me) return <div className="auth-page"><main className="auth-card"><Brand/><h1><ShieldCheck/> Administración de LuSpace</h1><p>Acceso independiente del portal familiar. Sin acceso a información clínica de otras familias.</p><ErrorNote error={error}/>{notice && <p role="status">{notice}</p>}<form onSubmit={submit}><fieldset disabled={busy}><label className="field">Correo administrativo<input name="correo" type="email" required autoComplete="username"/></label>{enroll && <label className="field">Contraseña familiar actual (verificación)<input name="current_password" type="password" required autoComplete="current-password"/></label>}<label className="field">{enroll?'Nueva contraseña administrativa (mínimo 12 caracteres)':'Contraseña administrativa'}<span className="password-field"><input name="password" type={show?'text':'password'} required minLength={enroll?12:undefined} maxLength={128} autoComplete={enroll?'new-password':'current-password'}/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Ocultar contraseña':'Mostrar contraseña'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>{mfaRequired&&!enroll&&<label className="field">Código del autenticador o de recuperación<input name="mfa_code" type="text" required maxLength={40} autoComplete="one-time-code" placeholder="Código de seguridad"/></label>}<button className="primary" type="submit">{busy?'Procesando…':enroll?'Crear acceso administrativo':mfaRequired?'Verificar e ingresar':'Ingresar a administración'}</button></fieldset></form>{owner && <button onClick={()=>{setEnroll(!enroll);setError('');}}>{enroll?'Ya tengo acceso':'Configurar mi acceso administrativo'}</button>}<p className="muted">Las cuentas familiares no habilitan este acceso automáticamente.</p><a href="/login">Ir al acceso familiar</a></main></div>;
  const icons=[Building2,Users,Clock,HardDrive,ShieldCheck,HardDrive,ShieldCheck,Clock,ShieldCheck,Building2];
  return <div className="platform-shell">
    {menu&&<button className="platform-scrim" aria-label="Cerrar menú de administración" onClick={()=>setMenu(false)}/>}
    <aside className={'platform-sidebar'+(menu?' open':'')}><Brand/><p className="eyebrow">ADMINISTRACIÓN</p><nav aria-label="Administración de plataforma">{platformSections.map(([key,label],i)=>{const Icon=icons[i];return <button key={key} className={section===key?'selected':''} aria-current={section===key?'page':undefined} onClick={()=>{setSection(key);setMenu(false);history.replaceState(null,'','/admin#'+key);}}><Icon size={19}/><span>{label}</span></button>;})}</nav><div className="platform-sidebar-bottom"><div className="platform-user"><span>{me.nombre.slice(0,1)}</span><div><strong>{me.nombre}</strong><small>Administrador de plataforma</small></div></div><a href="/login"><ArrowLeft size={17}/> Portal familiar</a><button disabled={busy} onClick={async()=>{setBusy(true);try{await api('platform/logout','POST',{});setMe(null);setMenu(false);history.replaceState(null,'','/admin/login');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><LogOut size={17}/> Cerrar sesión</button></div></aside>
    <div className="platform-workspace"><header className="platform-topbar"><button className="platform-menu" aria-label="Abrir menú de administración" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Menu size={22}/></button><div className="platform-topbar-title"><strong>LuSpace · Plataforma</strong><small>Administración privada</small></div><div className="platform-topbar-user"><span>{me.nombre.slice(0,1)}</span><strong>{me.nombre}</strong></div><PlatformNotifications navigate={key=>{setSection(key);setMenu(false);history.replaceState(null,'','/admin#'+key);}}/><PlatformTheme/></header><main className="platform-content"><ErrorNote error={error}/><PlatformAdmin section={section}/></main></div>
  </div>;
}
