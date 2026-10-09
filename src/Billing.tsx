import {useEffect,useState} from 'react';
import {CreditCard,RefreshCw,ShieldCheck,ExternalLink} from 'lucide-react';
import {api,dateLabel,type Row} from './lib';
import {Modal,ErrorNote} from './components';
import './billing.css';
const labels:Record<string,string>={pending:'Pendiente',authorized:'Autorizada',paused:'Pausada',cancelled:'Cancelada',approved:'Aprobado',rejected:'Rechazado',refunded:'Reembolsado',charged_back:'Revertido'};
const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export default function Billing({close}:{close:()=>void}){
  const [data,setData]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
  const [connection,setConnection]=useState<Row|null>(null);
  const load=async()=>{setError('');try{setData(await api('billing'));}catch(e){setError((e as Error).message);}};
  useEffect(()=>{void load();},[]);
  async function checkConnection(){setBusy(true);setError('');setConnection(null);try{setConnection(await api('billing/connection'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function act(path:string){setBusy(true);setError('');try{
    const result=await api(path,'POST',path==='billing/checkout'?{accepted:consent,amount_clp:data?.amount}:{});
    if(result.url){const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='www.mercadopago.cl')throw new Error('Enlace de pago no autorizado.');sessionStorage.setItem('luspace-billing-return','1');location.assign(url.href);}
    else {setData(result);window.dispatchEvent(new Event('luspace-subscription-refresh'));}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const open=data?.subscriptions?.find((s:Row)=>s.state!=='cancelled'),live=data?.mode==='production';
  return <Modal title="Suscripción de LuSpace" description="Gestiona tu suscripción y consulta el historial." close={close} className="billing-modal">
    <div className="billing-panel"><ErrorNote error={error}/>
    {!data&&!error&&<p role="status">Cargando suscripción…</p>}
    {data&&<>
      {data.enabled&&<div className="billing-test-notice"><ShieldCheck size={20}/><span>{live?'Pago seguro en Mercado Pago. LuSpace no guarda datos de tu tarjeta.':'Entorno de pruebas · Sin cobros reales. Usa solo cuentas y tarjetas ficticias.'}</span></div>}
      {!data.enabled?<p>Los pagos todavía no están habilitados. Tu información sigue disponible para consulta y descarga.</p>:<>
        <div className="billing-price"><CreditCard size={26}/><div><strong>{money(data.amount)} / mes</strong><span>{live?'Total mensual en pesos chilenos · IVA incluido':'Monto de simulación en pesos chilenos'}</span></div></div>
        {data.can_manage?<>
          <button disabled={busy} onClick={()=>void checkConnection()}><ShieldCheck size={17}/>{busy?'Comprobando…':'Comprobar conexión (sin cobros)'}</button>
          {connection&&<p role="status">{live?'Conexión con el vendedor real de Chile verificada. No se realizó ningún cobro.':`Vendedor ficticio de Chile verificado. ${connection.buyer_configured?'Correo de prueba del comprador configurado.':'Falta configurar el correo del comprador ficticio.'}`}</p>}
          {!open&&<><label className="billing-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{live?`Quiero contratar la suscripción de ${money(data.amount)} al mes, con renovación automática hasta cancelarla. Confirmaré el pago en Mercado Pago.`:'Quiero simular una suscripción mensual. No usaré una tarjeta real.'}</label><button className="primary" disabled={busy||!consent} onClick={()=>void act('billing/checkout')}><ExternalLink size={17}/>{busy?'Procesando…':live?'Continuar en Mercado Pago':'Continuar en Mercado Pago (prueba)'}</button></>}
          {open&&<div className="billing-actions">
            {open.state==='pending'&&<button disabled={busy} onClick={()=>void act('billing/checkout')}>Continuar suscripción pendiente</button>}
            <button disabled={busy} onClick={()=>void act('billing/refresh')}><RefreshCw size={16}/>Actualizar estado</button>
            <button disabled={busy} onClick={()=>{if(confirm('¿Cancelar esta suscripción? Se detendrán futuras renovaciones. No se eliminará información de la familia.'))void act('billing/'+open.id+'/cancel');}}>{live?'Cancelar renovación automática':'Cancelar suscripción de prueba'}</button>
          </div>}
        </>:<p>El Administrador de la familia gestiona los pagos.</p>}
      </>}
      <h3>Suscripciones</h3>{!data.subscriptions.length?<p className="muted">Aún no hay suscripciones registradas.</p>:<ul className="billing-history">{data.subscriptions.map((s:Row)=><li key={s.id}><strong>{labels[s.state]||s.state}</strong><span>{money(s.amount_clp)}</span>{s.paid_until&&<small>Período pagado hasta {dateLabel(s.paid_until)}</small>}</li>)}</ul>}
      <h3>Historial de pagos</h3>{!data.payments.length?<p className="muted">Aún no hay pagos registrados.</p>:<ul className="billing-history">{data.payments.map((p:Row)=><li key={p.id}><strong>{labels[p.state]||p.state}</strong><span>{money(p.amount_clp)}</span><small>{dateLabel(p.created_at)}</small></li>)}</ul>}
      <p className="muted">Una autorización no equivale a un pago aprobado. Al cancelar se detienen futuras renovaciones y se conserva el período ya pagado.</p>
    </>}
    </div>
  </Modal>;
}
export function PlatformBilling(){
  const [data,setData]=useState<Row|null>(null),[error,setError]=useState('');
  const [verified,setVerified]=useState(false),[checking,setChecking]=useState(false);
  useEffect(()=>{void api('platform/billing').then(setData).catch(e=>setError(e.message));},[]);
  return <article className="card billing-panel"><h2><CreditCard size={20}/>Mercado Pago</h2><ErrorNote error={error}/>{data&&<>
    <p>{data.enabled?(data.mode==='production'?'Producción':'Entorno de pruebas'):'Cobros bloqueados'} · {data.pending_notifications} notificaciones pendientes de confirmar.</p>
    <p>Última verificación automática: {data.job?.last_finished_at?dateLabel(data.job.last_finished_at):'Sin ejecutar'}. {data.job?.failures>0?'Hay operaciones pendientes de revisión.':''}</p>
    <button disabled={checking} onClick={async()=>{setChecking(true);setError('');setVerified(false);try{await api('platform/billing/connection');setVerified(true);}catch(e){setError((e as Error).message);}finally{setChecking(false);}}}>{checking?'Comprobando…':'Comprobar vendedor (sin cobros)'}</button>
    {verified&&<p role="status">Vendedor y conexión verificados. No se realizó ningún cobro.</p>}
    {!data.subscriptions.length?<p className="muted">Sin suscripciones registradas.</p>:<ul className="billing-history">{data.subscriptions.map((s:Row)=><li key={s.id}><strong>{s.family}</strong><span>{s.environment==='test'?'Prueba · ':''}{labels[s.state]} · {money(s.amount_clp)}</span>{s.paid_until&&<small>Pagado hasta {dateLabel(s.paid_until)}</small>}</li>)}</ul>}
  </>}</article>;
}

