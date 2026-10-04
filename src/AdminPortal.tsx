import { useEffect, useState, type FormEvent } from "react";
import { Building2, LogOut, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { api, type Row } from "./lib";
import { Brand, ErrorNote } from "./components";
import PlatformAdmin from "./PlatformAdmin";

export default function AdminPortal() {
  const [me,setMe]=useState<Row|null>(null),[owner,setOwner]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[enroll,setEnroll]=useState(false),[show,setShow]=useState(false),[notice,setNotice]=useState('');
  async function load() {
    try {setMe(await api('platform/me'));history.replaceState(null,'','/admin');}
    catch {setMe(null);history.replaceState(null,'','/admin/login');try{setOwner(!!(await api('me')).platform_setup_available);}catch{setOwner(false);}}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');
    try {const data=Object.fromEntries(new FormData(e.currentTarget));await api(enroll?'platform/enroll':'platform/login','POST',data);if(enroll){setEnroll(false);setOwner(false);setNotice('Acceso creado. Ingresa con tu correo y contraseña administrativos.');}else await load();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(loading) return <main className="auth-page"><p role="status">Comprobando acceso administrativo…</p></main>;
  if(!me) return <div className="auth-page"><main className="auth-card"><Brand/><h1><ShieldCheck/> Administración de LuSpace</h1><p>Acceso independiente del portal familiar. Sin acceso a información clínica de otras familias.</p><ErrorNote error={error}/>{notice && <p role="status">{notice}</p>}<form onSubmit={submit}><fieldset disabled={busy}><label className="field">Correo administrativo<input name="correo" type="email" required autoComplete="username"/></label>{enroll && <label className="field">Contraseña familiar actual (verificación)<input name="current_password" type="password" required autoComplete="current-password"/></label>}<label className="field">{enroll?'Nueva contraseña administrativa (mínimo 12 caracteres)':'Contraseña administrativa'}<span className="password-field"><input name="password" type={show?'text':'password'} required minLength={enroll?12:undefined} maxLength={128} autoComplete={enroll?'new-password':'current-password'}/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Ocultar contraseña':'Mostrar contraseña'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label><button className="primary" type="submit">{busy?'Procesando…':enroll?'Crear acceso administrativo':'Ingresar a administración'}</button></fieldset></form>{owner && <button onClick={()=>{setEnroll(!enroll);setError('');}}>{enroll?'Ya tengo acceso':'Configurar mi acceso administrativo'}</button>}<p className="muted">Las cuentas familiares no habilitan este acceso automáticamente.</p><a href="/login">Ir al acceso familiar</a></main></div>;
  return <div className="admin-portal"><aside className="card"><Brand/><p className="eyebrow">PLATAFORMA</p><nav aria-label="Administración de plataforma"><a href="/admin"><Building2 size={18}/> Resumen de LuSpace</a></nav><p>{me.nombre}</p><button disabled={busy} onClick={async()=>{setBusy(true);try{await api('platform/logout','POST',{});setMe(null);history.replaceState(null,'','/admin/login');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><LogOut size={18}/> Cerrar sesión administrativa</button><a href="/login">Abrir portal familiar</a></aside><main><ErrorNote error={error}/><PlatformAdmin back={()=>{location.href='/login';}}/></main></div>;
}
