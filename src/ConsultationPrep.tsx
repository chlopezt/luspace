import { useEffect, useState } from "react";
import { Sparkles, Download, ShieldCheck } from "lucide-react";
import { Modal, ErrorNote } from "./components";
import { api, download, dateLabel, type Row } from "./lib";

const examples = [
  "Prepara un resumen para neurología. Incluye medicamentos activos y observaciones escolares. Quiero conversar sobre el sueño y la sobrecarga sensorial.",
  "Resume los cambios registrados desde el último control.",
  "Ayúdame a preparar preguntas sobre alimentación y selectividad.",
  "Organiza las observaciones del colegio para comentarlas en consulta.",
];
const labels: Record<string, string> = { perfil: "Perfil clínico", salud: "Salud y tratamientos", escolar: "Observaciones escolares", rnd: "Credencial RND" };
export default function ConsultationPrep({ child, allowed }: { child: Row; allowed: string[] }) {
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<string[]>([]),
    [concern, setConcern] = useState(""), [draft, setDraft] = useState(""),
    [visits, setVisits] = useState<Row[]>([]), [visit, setVisit] = useState(""),
    [preview, setPreview] = useState<Row | null>(null), [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  function invalidate() { setPreview(null); setConsent(false); setDraft(""); setNotice(""); setPdfUrl(""); }
  async function start() {
    setError(""); invalidate(); setConcern(""); setVisit(""); setVisits([]);
    setSelected(["perfil", "salud"].filter(m => allowed.includes(m))); setOpen(true);
    try { setVisits(await api(`records/consultas_medicas?child=${encodeURIComponent(child.id)}`)); }
    catch (e) { setError((e as Error).message); }
  }
  function input() {
    const appointment = visits.find(v => v.id === visit);
    return { child: child.id, modules: selected, concern: appointment ? `Consulta de ${appointment.especialidad || "especialidad no registrada"}, ${appointment.fecha}. ${concern}` : concern };
  }
  async function review() {
    setBusy(true); setError(""); setDraft(""); setPdfUrl("");
    try { setPreview(await api("consultation/preview", "POST", input())); setConsent(false); }
    catch(e) { setError((e as Error).message); } finally {setBusy(false);}
  }
  async function generate() {
    setBusy(true); setError(""); setPdfUrl("");
    try {
      const result = await api("consultation/generate", "POST", { ...input(), consent, preview_hash: preview?.preview_hash });
      setDraft(result.draft); setNotice(result.warning || "Borrador generado con Cloudflare AI. Revisa cada dato antes de compartirlo.");
    } catch(e) { setError((e as Error).message); } finally {setBusy(false);}
  }
  async function savePdf() {
    setBusy(true); setError("");
    try {
      const { Document, Page, Text, pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(<Document><Page size="A4" style={{padding:40,fontSize:11,fontFamily:"Helvetica",lineHeight:1.5}}><Text style={{fontSize:18,marginBottom:15}}>LuSpace · Preparación de consulta</Text><Text>{draft}</Text><Text style={{marginTop:20,fontSize:9}}>Borrador revisable · No sustituye evaluación profesional · {new Date().toLocaleDateString("es-CL")}</Text></Page></Document>).toBlob();
      download(blob, "LuSpace-preparar-consulta.pdf");
      setPdfUrl(URL.createObjectURL(blob));
      setNotice("PDF preparado. Si la descarga no comienza, utiliza el enlace Descargar archivo PDF.");
    } catch { setError("No se pudo generar el PDF. Puedes copiar el borrador; no se ha perdido."); } finally {setBusy(false);}
  }
  return <><button className="primary" onClick={start}><Sparkles size={18}/> Preparar próxima consulta</button>{open && <Modal title="Preparar próxima consulta" description="Selecciona tus registros, revisa lo que se enviará y edita el borrador antes de compartirlo." close={() => setOpen(false)}>
    <div className="consultation-prep">
    <ErrorNote error={error}/>
    <label>Consulta<select disabled={busy} value={visit} onChange={e => {setVisit(e.target.value); invalidate();}}><option value="">Preparación general</option>{visits.map(v => <option key={v.id} value={v.id}>{v.especialidad} · {v.medico_nombre} · {dateLabel(v.fecha)}</option>)}</select></label>
    <fieldset disabled={busy}><legend>Información a incluir</legend>{Object.entries(labels).filter(([m]) => allowed.includes(m)).map(([m,label]) => <label key={m}><input type="checkbox" checked={selected.includes(m)} onChange={e => {setSelected(e.target.checked ? [...selected,m] : selected.filter(x=>x!==m)); invalidate();}}/>{label}</label>)}</fieldset>
    <p className="muted">La anamnesis y el contenido de los adjuntos no se enviarán en esta primera versión. Se incluirán hasta 20 registros por categoría.</p>
    <label>¿Qué quieres conversar con el profesional? (opcional)<textarea disabled={busy} maxLength={1500} rows={4} value={concern} onChange={e=>{setConcern(e.target.value); invalidate();}} placeholder={examples[0]}/></label>
    <p className="muted">Pulsa un ejemplo y adáptalo:</p><div className="prep-examples">{examples.map(example=><button disabled={busy} key={example} onClick={()=>{setConcern(example); invalidate();}}>{example}</button>)}</div>
    <button disabled={busy || !selected.length} onClick={review}>{busy ? "Preparando…" : "Revisar información seleccionada"}</button>
    {preview && <><details><summary><ShieldCheck size={16}/> Ver exactamente qué se enviará a Cloudflare AI</summary><pre>{JSON.stringify(preview.payload, null, 2)}</pre></details>
    <p className="muted">Se excluyen campos de RUT, teléfono, nombre, foto y archivos. Las notas libres pueden contener datos personales: revísalas. No incluyas identificadores en tu petición.</p>
    {!preview.ai_available && <p role="status">La IA está pendiente de activación. Puedes preparar el resumen básico sin enviar información externa.</p>}
    <label><input disabled={busy || !preview.ai_available} type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Autorizo enviar esta información clínica seleccionada a Cloudflare Workers AI para preparar el borrador.</label>
    <div className="actions"><button className="primary" disabled={busy || !consent || !preview.ai_available} onClick={generate}><Sparkles size={18}/> Generar con IA</button><button disabled={busy} onClick={()=>{setDraft(preview.basic); setNotice("Resumen básico: no se envió información a IA externa.");}}>Preparar sin IA externa</button></div></>}
    {notice && <p role="status">{notice}</p>}
    {draft && <><label>Borrador editable<textarea rows={16} value={draft} onChange={e=>{setDraft(e.target.value);setPdfUrl("");}}/></label><details><summary>Registros de origen</summary><ul>{preview?.sources?.map((s: Row,i: number)=><li key={i}>{s.table.replaceAll("_"," ")} · {s.date ? dateLabel(s.date) : "sin fecha"} · referencia {s.id}</li>)}</ul></details><button disabled={busy || !draft.trim()} onClick={savePdf}><Download size={18}/> Descargar PDF revisado</button>{pdfUrl && <a href={pdfUrl} download="LuSpace-preparar-consulta.pdf">Descargar archivo PDF</a>}</>}
    </div>
  </Modal>}</>;
}
