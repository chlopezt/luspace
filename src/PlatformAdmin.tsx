import { useEffect, useState } from "react";
import { Building2, Users, HardDrive, Files, ShieldCheck, ArrowLeft, RefreshCw } from "lucide-react";
import { api, dateLabel, type Row } from "./lib";
import { ErrorNote } from "./components";
const bytes = (n: number) => n >= 1048576 ? `${(n/1048576).toFixed(1)} MiB` : `${(n/1024).toFixed(1)} KiB`;
export default function PlatformAdmin({ back }: { back: () => void }) {
  const [data,setData] = useState<Row|null>(null), [error,setError] = useState(""), [busy,setBusy] = useState(false), [search,setSearch] = useState("");
  async function load() { setBusy(true);setError("");try {setData(await api("platform/overview"));}catch(e){setData(null);setError((e as Error).message);}finally{setBusy(false);} }
  useEffect(()=>{void load();},[]);
  const totals = data?.totals;
  return <section className="platform-dashboard">
    <div className="actions"><button onClick={back}><ArrowLeft size={18}/> Mi familia</button><button disabled={busy} onClick={()=>void load()}><RefreshCw size={18}/> Actualizar</button></div>
    <h1><Building2 size={28}/> Administrar LuSpace</h1>
    <p>Espacio de plataforma, separado de la administración familiar.</p>
    <article className="card"><h2><ShieldCheck size={20}/> Privacidad por diseño</h2><p>Este panel muestra únicamente información administrativa y consumo agregado. No permite abrir perfiles, diagnósticos, bitácoras ni documentos de otras familias.</p><p className="muted">Pruebas gratuitas, suscripciones y cobros todavía no están activados. Tu familia continúa sin bloqueos comerciales.</p></article>
    <ErrorNote error={error}/>{busy && <p role="status">Cargando métricas…</p>}
    {totals && <><div className="platform-kpis">{[[Building2,"Familias",totals.familias],[Users,"Miembros activos",totals.miembros_activos],[Files,"Archivos almacenados",totals.archivos],[HardDrive,"Espacio registrado",bytes(totals.storage_used_bytes)]].map(([Icon,label,value]:any)=><article className="card" key={label}><Icon size={24}/><p>{label}</p><strong>{value}</strong></article>)}</div>
    <article className="card"><h2>Familias registradas</h2><label>Buscar familia<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre de la familia"/></label><p className="muted">Hasta 200 familias recientes. Los archivos se cuentan por metadatos, sin consultar contenidos ni nombres.</p><div className="platform-table"><table><thead><tr><th>Familia</th><th>Registro</th><th>Miembros activos</th><th>Archivos</th><th>Espacio</th></tr></thead><tbody>{data!.families.filter((f:Row)=>f.nombre.toLowerCase().includes(search.toLowerCase())).map((f:Row)=><tr key={f.id}><td>{f.nombre}</td><td>{dateLabel(f.created_at)}</td><td>{f.miembros_activos}</td><td>{f.archivos}</td><td>{bytes(f.storage_used_bytes)}</td></tr>)}</tbody></table></div></article></>}
  </section>;
}
