import {useEffect,useState,type FormEvent} from 'react';
import {ShieldCheck,KeyRound,Download,ShieldOff} from 'lucide-react';
import QRCode from 'qrcode';
import {api,type Row} from './lib';
import {ErrorNote} from './components';
import './platform-mfa.css';
export default function PlatformMfa(){
 const [status,setStatus]=useState<Row|null>(null),[pending,setPending]=useState<Row|null>(null),[qr,setQr]=useState(''),[codes,setCodes]=useState<string[]>([]),[password,setPassword]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState('verify');
 useEffect(()=>{let live=true;api('platform/mfa').then(r=>{if(live)setStatus(r);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  const action=!status?.enabled?(pending?'enable':'setup'):mode;
  const r=await api('platform/mfa/'+action,'POST',{admin_password:password,code});
  if(action==='setup'){setPending(r);setQr(await QRCode.toDataURL(r.uri,{width:232,margin:2,errorCorrectionLevel:'M'}));setCode('');}
  else{setPending(null);setQr('');setCode('');setPassword('');if(r.recovery_codes)setCodes(r.recovery_codes);setStatus(await api('platform/mfa'));setNotice(action==='enable'?'2FA activado. Las demás sesiones administrativas se cerraron.':action==='disable'?'2FA desactivado; las demás sesiones se cerraron.':'Identidad confirmada. Puedes realizar cambios durante 15 minutos.');setMode('verify');}
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function download(){const content='LuSpace · Códigos de recuperación del administrador\nCada código se puede usar una sola vez, junto con tu contraseña.\nNo compartas este archivo.\n\n'+codes.join('\n');const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='LuSpace-recuperacion-2FA.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="platform-dashboard platform-mfa"><div className="platform-page-heading"><div><p className="eyebrow">ACCESO ADMINISTRATIVO</p><h1><ShieldCheck/> Seguridad de mi cuenta</h1><p className="muted">Segundo factor solo para tu cuenta de administrador de plataforma.</p></div></div><ErrorNote error={error}/>{notice&&<p role="status" className="card">{notice}</p>}
 <article className="card"><h2><ShieldCheck size={21}/> Autenticación de dos factores</h2><p><strong>{status?(status.enabled?'Activado':'Desactivado'):'Consultando…'}</strong></p><p className="muted">Usa una aplicación autenticadora compatible con códigos de 6 dígitos. El QR se genera aquí, sin enviarlo a otros servicios.</p>{status?.enabled&&<p>Códigos de recuperación disponibles: <strong>{status.recovery_remaining}</strong></p>}
 {codes.length>0&&<div className="mfa-recovery"><h3><KeyRound size={20}/> Guarda tus códigos de recuperación</h3><p>Se muestran solo ahora. Cada código sirve una vez y también requiere tu contraseña. Guárdalos fuera de LuSpace; no los envíes por el chat.</p><div className="mfa-code-grid">{codes.map(c=><code key={c}>{c}</code>)}</div><button type="button" onClick={download}><Download size={18}/> Descargar códigos</button><button type="button" onClick={()=>setCodes([])}>Ya los guardé · Ocultar</button></div>}
 {status&&<form onSubmit={submit}><fieldset disabled={busy}>
 {pending&&<div className="mfa-enrollment"><h3>1. Escanea el QR</h3>{qr&&<img src={qr} width={232} height={232} alt="QR privado de configuración de 2FA"/>}<details><summary>No puedo escanear: mostrar clave manual</summary><code className="mfa-secret">{pending.secret}</code></details><p>Configuración válida por 10 minutos. Todavía no se ha activado el 2FA.</p><h3>2. Confirma el código de tu autenticador</h3></div>}
 <label className="field">Contraseña administrativa<input type="password" required autoComplete="current-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>
 {(pending||status.enabled)&&<label className="field">{pending?'Código de 6 dígitos':'Código del autenticador o de recuperación'}<input type="text" required autoComplete="one-time-code" maxLength={40} inputMode={pending?'numeric':'text'} value={code} onChange={e=>setCode(e.target.value.trim())} placeholder={pending?'123456':'Código de seguridad'}/></label>}
 {status.enabled&&<label className="field">Acción<select value={mode} onChange={e=>setMode(e.target.value)}><option value="verify">Confirmar identidad para cambios administrativos</option><option value="disable">Desactivar 2FA</option></select></label>}
 {mode==='disable'&&status.enabled&&<p className="mfa-warning"><ShieldOff size={18}/> Desactivar reduce la protección del administrador. Necesitas contraseña y un segundo factor válido.</p>}
 <button className="primary" type="submit">{busy?'Verificando…':status.enabled?(mode==='disable'?'Verificar y desactivar 2FA':'Confirmar identidad'):(pending?'Confirmar y activar 2FA':'Configurar 2FA')}</button>
 {pending&&<button type="button" onClick={()=>{setPending(null);setQr('');setCode('');setPassword('');}}>Cancelar configuración</button>}
 </fieldset></form>}</article><p className="muted">El login familiar no cambia. Para acciones administrativas sensibles, la verificación del segundo factor se renueva cada 15 minutos. Si pierdes el teléfono y todos los códigos, la recuperación requiere soporte del titular de la infraestructura; no existe una omisión pública del 2FA.</p></section>;
}
