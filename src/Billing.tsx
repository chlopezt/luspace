import {useEffect,useState} from 'react';
import {CreditCard,RefreshCw,ShieldCheck,ExternalLink,CalendarDays,Check,History} from 'lucide-react';
import {api,dateLabel,type Row} from './lib';
import {Modal,ErrorNote} from './components';
import './billing.css';
const labels:Record<string,string>={pending:'Pendiente',authorized:'Autorizada',paused:'Pausada',cancelled:'Cancelada',approved:'Aprobado',rejected:'Rechazado',refunded:'Reembolsado',charged_back:'Revertido',expired:'Vencido'};
const money=(n:number)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
export default function Billing({close}:{close:()=>void}){
  const [data,setData]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
  const [connection,setConnection]=useState<Row|null>(null);
  const load=async()=>{setError('');try{setData(await api('billing'));}catch(e){setError((e as Error).message);}};
  useEffect(()=>{void load();},[]);
  async function checkConnection(){setBusy(true);setError('');setConnection(null);try{setConnection(await api('billing/connection'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function act(path:string){setBusy(true);setError('');try{
    const result=await api(path,'POST',path==='billing/checkout'?{accepted:consent,amount_clp:data?.amount}:path==='billing/oneoff'?{accepted:true,amount_clp:data?.amount}:{});
    if(result.url){const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='www.mercadopago.cl')throw new Error('Enlace de pago no autorizado.');sessionStorage.setItem('luspace-billing-return','1');location.assign(url.href);}
    else {setData(result);window.dispatchEvent(new Event('luspace-subscription-refresh'));}
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const open=data?.subscriptions?.find((s:Row)=>s.state!=='cancelled'),live=data?.mode==='production';
  const pendingOnce=data?.orders?.find((o:Row)=>o.state==='pending');
  const paidOnce=data?.orders?.find((o:Row)=>o.state==='approved'&&Date.parse(o.paid_until)>Date.now());
  return <Modal title="Tu plan LuSpace" description="Elige cómo quieres pagar." close={close} className="billing-modal">
    <div className="billing-panel"><ErrorNote error={error}/>
    {!data&&!error&&<p role="status">Cargando opciones de pago…</p>}
    {data&&<>
      {!live&&data.enabled&&<div className="billing-test-notice"><ShieldCheck size={20}/><span>Entorno de pruebas · Sin cobros reales.</span></div>}
      {!data.enabled?<p>Los pagos todavía no están habilitados. Tu información sigue disponible para consulta y descarga.</p>:<>
        <div className="billing-price"><CreditCard size={26}/><div><strong>{money(data.amount)} <small>/ mes</small></strong><span>{live?'IVA incluido · Mismo precio en ambas modalidades':'Monto de simulación en pesos chilenos'}</span></div></div>
        {data.can_manage?<>
          {!open&&!pendingOnce&&!paidOnce&&<div className="billing-options">
            <section className="billing-option"><div className="billing-option-icon"><CalendarDays size={23}/></div><h3>Pagar un mes</h3><p>Sin renovación automática.</p><ul><li><Check size={16}/>Un mes de acceso</li><li><Check size={16}/>Tú decides cuándo volver a pagar</li></ul><button className="primary" disabled={busy||!data.oneoff_enabled} onClick={()=>void act('billing/oneoff')}><ExternalLink size={17}/>{busy?'Procesando…':'Pagar un mes'}</button></section>
            <section className="billing-option billing-option-recurring"><div className="billing-option-icon"><RefreshCw size={23}/></div><h3>Suscripción mensual</h3><p>Renovación automática.</p><ul><li><Check size={16}/>Pago mensual sin recordatorios</li><li><Check size={16}/>Cancela futuras renovaciones</li></ul><label className="billing-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Acepto el cobro mensual de {money(data.amount)} hasta cancelar.</label><button disabled={busy||!consent} onClick={()=>void act('billing/checkout')}><ExternalLink size={17}/>{busy?'Procesando…':'Suscribirme'}</button></section>
          </div>}
          {(open||pendingOnce||paidOnce)&&<section className="billing-current"><h3>{open?'Tu suscripción':pendingOnce?'Pago único pendiente':'Tu mes pagado'}</h3><p>{open?labels[open.state]:pendingOnce?'Continúa el pago o actualiza su estado.':`Vigente hasta ${dateLabel(paidOnce.paid_until)}. Sin renovación automática.`}</p><div className="billing-actions">
            {open?.state==='pending'&&<button className="primary" disabled={busy} onClick={()=>void act('billing/checkout')}>Continuar suscripción</button>}
            {pendingOnce&&<button className="primary" disabled={busy} onClick={()=>void act('billing/oneoff')}>Continuar pago único</button>}
            {open&&<button disabled={busy} onClick={()=>{if(confirm('¿Cancelar futuras renovaciones? Conservarás el período ya pagado y los datos de tu familia.'))void act('billing/'+open.id+'/cancel');}}>Cancelar renovación</button>}
          </div>{open&&<small>El período confirmado se conserva al cancelar. Puedes cambiar de modalidad después de cancelar la renovación.</small>}</section>}
          <button className="billing-refresh" disabled={busy} onClick={()=>void act('billing/refresh')}><RefreshCw size={16}/>{busy?'Actualizando…':'Actualizar estado del pago'}</button>
        </>:<p>El Administrador de la familia gestiona los pagos.</p>}
      </>}
      <p className="billing-secure"><ShieldCheck size={16}/>Pago seguro con Mercado Pago. No guardamos tu tarjeta.</p>
      <details className="billing-details"><summary><History size={17}/>Historial de pagos</summary><div>
        {!data.payments.length?<p className="muted">Todavía no hay pagos confirmados.</p>:<ul className="billing-history">{data.payments.map((p:Row)=><li key={p.id}><strong>{labels[p.state]||p.state}</strong><span>{money(p.amount_clp)}</span><small>{p.kind==='oneoff'?'Pago único':'Suscripción'} · {dateLabel(p.created_at)} · Hasta {dateLabel(p.period_end)}</small></li>)}</ul>}
        {!!data.subscriptions.length&&<><h3>Suscripciones</h3><ul className="billing-history">{data.subscriptions.map((s:Row)=><li key={s.id}><strong>{labels[s.state]||s.state}</strong><span>{money(s.amount_clp)}</span>{s.paid_until&&<small>Pagado hasta {dateLabel(s.paid_until)}</small>}</li>)}</ul></>}
      </div></details>
      {data.can_manage&&<details className="billing-details"><summary>Ayuda con el pago</summary><div><p>El acceso se activa al confirmar un pago aprobado, no solo al autorizar una suscripción. Si tienes días de prueba o un período pagado, se conservan al pagar un mes.</p><button disabled={busy} onClick={()=>void checkConnection()}>Comprobar conexión</button>{connection&&<p role="status">Conexión verificada. No se realizó ningún cobro.</p>}</div></details>}
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
    <h3>Pagos únicos · Sin renovación</h3>{!data.orders?.length?<p className="muted">Sin pagos únicos registrados.</p>:<ul className="billing-history">{data.orders.map((o:Row)=><li key={o.id}><strong>{o.family}</strong><span>{labels[o.state]} · {money(o.amount_clp)}</span>{o.paid_until&&<small>Período hasta {dateLabel(o.paid_until)}</small>}</li>)}</ul>}
  </>}</article>;
}

