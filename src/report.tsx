import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { models, anamnesisSections, fieldVisible } from "../shared/models.js";
import {
  meaningful,
  fieldText,
  reportDate,
  reportText,
  reportAge,
  reportFilename,
} from "../shared/report-format.js";
import { download, type Row } from "./lib";
import { loadPdfModule } from "./pdfRecovery";
import { vaccinationState } from "../shared/vaccinations.js";

const s = StyleSheet.create({
  page: {
    paddingTop: 80,
    paddingHorizontal: 30,
    paddingBottom: 48,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#263c50",
    lineHeight: 1.2,
  },
  date: { fontSize: 8, lineHeight: 1.2, color: "#64748b", marginTop: 3 },
  patient: {
    backgroundColor: "#ecfaf7",
    borderColor: "#ccece6",
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    lineHeight: 1.2,
    color: "#134e4a",
    marginBottom: 4,
  },
  photo: {
    width: 52,
    height: 52,
    objectFit: "cover",
    borderRadius: 9,
    marginRight: 12,
  },
  allergy: {
    backgroundColor: "#fff6dc",
    color: "#92400e",
    borderRadius: 4,
    padding: 5,
    marginTop: 6,
    fontSize: 8,
  },
  section: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    lineHeight: 1.2,
    color: "#0f766e",
    backgroundColor: "#edf9f6",
    borderRadius: 5,
    padding: 4,
    marginBottom: 3,
    marginTop: 2,
  },
  card: {
    borderWidth: 0.6,
    borderColor: "#dfe6ee",
    borderRadius: 7,
    padding: 6,
    marginBottom: 5,
  },
  subtitle: {
    fontFamily: "Helvetica-Bold",
    color: "#7351a8",
    fontSize: 9,
    marginBottom: 5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  pair: { width: "50%", paddingRight: 9, marginBottom: 2 },
  full: { width: "100%", marginBottom: 2 },
  label: { fontSize: 7, lineHeight: 1.1, color: "#65758a", marginBottom: 1 },
  value: { fontSize: 8.5, lineHeight: 1.15 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#eef0ff",
    padding: 6,
    borderRadius: 4,
  },
  row: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5ebf1",
  },
  cell: { paddingRight: 6, fontSize: 8 },
  status: { color: "#0f766e", fontFamily: "Helvetica-Bold", fontSize: 8 },
  note: {
    borderLeftWidth: 2,
    borderLeftColor: "#b8a1e9",
    backgroundColor: "#f8f7fd",
    padding: 7,
    marginTop: 5,
  },
});
type Entry = { label: string; value: string };
const lineCount = (text: string, columns = 60) =>
  String(text)
    .split("\n")
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / columns)), 0);
const longItems = (items: Entry[]) =>
  items.reduce((n, e) => n + e.value.length + e.label.length, 0) > 1600 ||
  items.reduce((n, e) => n + lineCount(e.value), 0) > 45;
function entries(table: string, row: Row, excluded: string[] = []): Entry[] {
  return ((models as Row)[table]?.fields || [])
    .filter(
      (f: Row) =>
        !["file", "files"].includes(f.type) && !excluded.includes(f.key) && fieldVisible(f, row),
    )
    .map((f: Row) => ({ label: f.label, value: fieldText(f, row[f.key]) }))
    .filter((e: Entry) => meaningful(e.value));
}
function Pairs({ items }: { items: Entry[] }) {
  return (
    <View style={s.grid}>
      {items.map((e, i) => (
        <View
          key={i}
          style={
            e.value.length > 100 || e.value.includes("\n") ? s.full : s.pair
          }
          wrap={e.value.length > 450 || lineCount(e.value) > 30}
        >
          <Text style={s.label} minPresenceAhead={15}>
            {e.label}
          </Text>
          <Text style={s.value} orphans={2} widows={2}>
            {e.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
function Card({ items, title }: { items: Entry[]; title?: string }) {
  if (!items.length) return null;
  const long = longItems(items);
  return (
    <View
      style={[s.card, title ? { backgroundColor: "#fbfaff" } : {}]}
      wrap={long}
    >
      {title && (
        <Text style={s.subtitle} minPresenceAhead={24}>
          {title}
        </Text>
      )}
      <Pairs items={items} />
    </View>
  );
}
function Band({ title }: { title: string }) {
  return (
    <Text style={s.section} minPresenceAhead={65}>
      {title}
    </Text>
  );
}
function Table({ table, rows }: { table: string; rows: Row[] }) {
  const medicine = table === "medicamentos";
  const columns = medicine
    ? ["Medicamento / dosis", "Pauta y período", "Estado"]
    : ["Fecha", "Peso (kg)", "Talla (cm)", "P. cefálico (cm)"];
  const widths = medicine
    ? ["36%", "46%", "18%"]
    : ["28%", "24%", "24%", "24%"];
  return (
    <>
      {rows.map((r, i) => {
        const pauta = entries(table, r, [
          "nombre",
          "dosis",
          "activo",
          "instrucciones_especiales",
        ])
          .map((e) => `${e.label}: ${e.value}`)
          .join("\n");
        const cells = medicine
          ? [
              [r.nombre, r.dosis].filter(meaningful).map(reportText).join("\n"),
              pauta,
              r.activo ? "Activo" : "Finalizado",
            ]
          : [
              reportDate(r.fecha_medicion),
              r.peso_kg,
              r.talla_cm,
              r.perimetro_cefalico_cm,
            ].map((v) => (meaningful(v) ? String(v) : ""));
        const note = fieldText(
          { type: "textarea" },
          medicine ? r.instrucciones_especiales : r.notas,
        );
        // Short table groups remain intact; long indications flow separately without losing text.
        return (
          <View key={r.id || i} style={{ marginBottom: 5 }}>
            <View
              wrap={
                cells.join("").length > 1000 ||
                cells.some((c) => lineCount(c, 30) > 40)
              }
            >
              <View style={s.tableHead}>
                {columns.map((c, j) => (
                  <Text
                    key={c}
                    style={[
                      s.cell,
                      { width: widths[j], fontFamily: "Helvetica-Bold" },
                    ]}
                  >
                    {c}
                  </Text>
                ))}
              </View>
              <View style={s.row}>
                {cells.map((c, j) => (
                  <Text
                    key={j}
                    style={[
                      s.cell,
                      { width: widths[j] },
                      medicine && j === 2 ? s.status : {},
                    ]}
                  >
                    {c}
                  </Text>
                ))}
              </View>
            </View>
            {meaningful(note) && (
              <View
                style={s.note}
                wrap={note.length > 450 || lineCount(note) > 30}
              >
                <Text style={s.label} minPresenceAhead={15}>
                  {medicine
                    ? `Indicaciones - ${reportText(r.nombre)}`
                    : "Notas de la medición"}
                </Text>
                <Text orphans={2} widows={2}>
                  {note}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}
function Log({ row }: { row: Row }) {
  const metadata = entries("bitacora_escolar_diaria", row, [
    "incidentes",
    "resolucion",
  ]);
  const notes = [
    { label: "Observaciones e incidentes", value: reportText(row.incidentes) },
    {
      label: "Resolución y apoyos registrados",
      value: reportText(row.resolucion),
    },
  ].filter((e) => meaningful(e.value));
  return (
    <View style={s.card} wrap={longItems(notes)}>
      <Pairs items={metadata} />
      {notes.map((e) => (
        <View
          key={e.label}
          style={s.note}
          wrap={e.value.length > 450 || lineCount(e.value) > 30}
        >
          <Text style={s.subtitle} minPresenceAhead={20}>
            {e.label}
          </Text>
          <Text orphans={2} widows={2}>
            {e.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
function Vaccines({
  rows,
  birth,
  at,
}: {
  rows: Row[];
  birth: string;
  at: string;
}) {
  const sorted = [...rows].sort((a, b) =>
    (b.fecha_aplicacion || "").localeCompare(a.fecha_aplicacion || ""),
  );
  return (
    <>
      <Text style={{ marginBottom: 7, color: "#64748b" }}>
        Registro familiar de inmunizaciones. No constituye certificado MINSAL.
        Aplicadas recientes y dosis con seguimiento pendiente.
      </Text>
      {sorted.map((r, i) => (
        <View
          key={r.id || i}
          style={s.card}
          wrap={JSON.stringify(r).length > 1500}
        >
          <Text style={s.subtitle} minPresenceAhead={20}>
            {reportText(r.nombre)}
            {r.dosis ? " - " + reportText(r.dosis) : ""}
          </Text>
          <Pairs
            items={[
              { label: "Estado", value: vaccinationState(r, birth, at) },
              {
                label:
                  r.estado === "Administrada"
                    ? "Fecha de aplicación"
                    : "Fecha prevista",
                value: reportDate(
                  r.estado === "Administrada"
                    ? r.fecha_aplicacion
                    : r.fecha_prevista,
                ),
              },
              { label: "Lugar", value: reportText(r.centro) },
              { label: "Lote / marca", value: reportText(r.lote_marca) },
              { label: "Observaciones", value: reportText(r.notas) },
            ].filter((e) => meaningful(e.value))}
          />
        </View>
      ))}
    </>
  );
}
export function Report({ data }: { data: Row }) {
  const child = data.child || {},
    profile = data.sections?.ninos?.[0] || {};
  // Only use the export payload: never request additional clinical fields or attachments.
  const blood = child.grupo_sanguineo ?? profile.grupo_sanguineo,
    allergies = child.alergias ?? profile.alergias;
  const name =
    [child.primer_nombre, child.apellidos].filter(meaningful).join(" ") ||
    "Ficha pediátrica";
  const age = reportAge(child.fecha_nacimiento, data.created);
  return (
    <Document
      title={`Informe de Cuidado y Salud Pediátrica - ${name}`}
      author="LuSpace"
      language="es-CL"
    >
      <Page size="A4" style={s.page}>
        <View style={s.patient} wrap={reportText(allergies).length > 1200}>
          {data.includePhoto && data.profilePhoto && (
            <Image src={data.profilePhoto} style={s.photo} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{reportText(name)}</Text>
            <Text>
              {[age, meaningful(blood) ? `Grupo sanguíneo: ${blood}` : ""]
                .filter(Boolean)
                .join("   |   ")}
            </Text>
            {child.fecha_nacimiento && (
              <Text style={s.date}>
                Nacimiento: {reportDate(child.fecha_nacimiento)}
              </Text>
            )}
            {meaningful(allergies) && (
              <Text style={s.allergy}>
                ALERGIAS REGISTRADAS: {reportText(allergies)}
              </Text>
            )}
          </View>
        </View>
        {Object.entries(data.sections || {})
          .filter(
            ([table, rows]) =>
              (models as Row)[table] &&
              (rows as Row[]).some(
                (r) =>
                  entries(
                    table,
                    r,
                    table === "ninos"
                      ? [
                          "primer_nombre",
                          "apellidos",
                          "fecha_nacimiento",
                          "alergias",
                          "grupo_sanguineo",
                        ]
                      : [],
                  ).length,
              ),
          )
          .map(([table, rows]) => (
            <View
              key={table}
              wrap={
                (rows as Row[]).length > 1 ||
                JSON.stringify(rows).length > 2200 ||
                (rows as Row[]).some((r) => longItems(entries(table, r)))
              }
            >
              <Band title={(models as Row)[table].title} />
              {table === "vacunas" ? (
                <Vaccines
                  rows={rows as Row[]}
                  birth={child.fecha_nacimiento}
                  at={String(data.created || "").slice(0, 10)}
                />
              ) : ["medicamentos", "registros_crecimiento"].includes(table) ? (
                <Table table={table} rows={rows as Row[]} />
              ) : (
                (rows as Row[]).map((r, i) =>
                  table === "bitacora_escolar_diaria" ? (
                    <Log key={r.id || i} row={r} />
                  ) : (
                    <Card
                      key={r.id || i}
                      items={entries(
                        table,
                        r,
                        table === "ninos"
                          ? [
                              "primer_nombre",
                              "apellidos",
                              "fecha_nacimiento",
                              "alergias",
                              "grupo_sanguineo",
                            ]
                          : [],
                      )}
                    />
                  ),
                )
              )}
            </View>
          ))}
        {data.anamnesis &&
          anamnesisSections.some(([key]) =>
            Object.values(data.anamnesis[key as string] || {}).some(meaningful),
          ) && <Band title="Anamnesis pediátrica" />}
        {anamnesisSections.map(([key, title, fields]) => {
          const items = (fields as string[])
            .map((label, i) => ({
              label,
              value: reportText(data.anamnesis?.[key as string]?.[i]),
            }))
            .filter((e) => meaningful(e.value));
          return items.length ? (
            <View key={String(key)} wrap={longItems(items)}>
              <Card items={items} title={String(title)} />
            </View>
          ) : null;
        })}
      </Page>
    </Document>
  );
}
export async function exportPdf(data: Row) {
  let logo = "";
  try {
    const res = await fetch("/brand/luspace-logo.png");
    if (res.ok)
      logo = await new Promise<string>((resolve, reject) => {
        res
          .blob()
          .then((blob) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
          .catch(reject);
      });
  } catch {
    /* The text brand remains available offline. */
  }
  const issued = data.created || new Date().toISOString();
  const blob = await pdf(
    <Report data={{ ...data, created: issued, logo }} />,
  ).toBlob();
  // Isolate each laid-out page in a form before stamping: split rounded cards can
  // leave graphics clipping active, hiding repeated branding in some viewers.
  // The same protected lazy loader handles this module after deployments as well.
  const { PDFDocument, StandardFonts, rgb } = await loadPdfModule(
    () => import("pdf-lib"),
  );
  const source = await PDFDocument.load(await blob.arrayBuffer());
  const document = await PDFDocument.create();
  document.setTitle("Informe de Cuidado y Salud Pediátrica");
  document.setAuthor("LuSpace");
  const font = await document.embedFont(StandardFonts.Helvetica),
    bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoImage = logo
    ? await document.embedPng(logo).catch(() => null)
    : null;
  const embedded = await document.embedPages(source.getPages());
  const pages = embedded.map((body) => {
    const page = document.addPage([body.width, body.height]);
    page.drawPage(body);
    return page;
  });
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    if (logoImage)
      page.drawImage(logoImage, {
        x: 30,
        y: height - 62,
        width: 55,
        height: 37,
      });
    else
      page.drawText("LuSpace", {
        x: 30,
        y: height - 48,
        size: 13,
        font: bold,
        color: rgb(0.05, 0.58, 0.53),
      });
    page.drawText("Informe de Cuidado y Salud Pediátrica", {
      x: 97,
      y: height - 42,
      size: 14,
      font: bold,
      color: rgb(0.09, 0.16, 0.25),
    });
    page.drawText(`LuSpace | Emitido el ${reportDate(issued, false, true)}`, {
      x: 97,
      y: height - 56,
      size: 8,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
    page.drawLine({
      start: { x: 30, y: height - 71 },
      end: { x: width - 30, y: height - 71 },
      thickness: 0.6,
      color: rgb(0.8, 0.92, 0.89),
    });
    page.drawLine({
      start: { x: 30, y: 35 },
      end: { x: width - 30, y: 35 },
      thickness: 0.5,
      color: rgb(0.87, 0.9, 0.93),
    });
    page.drawText(
      "Documento de uso privado y familiar - Generado por LuSpace",
      { x: 30, y: 24, size: 7, font, color: rgb(0.39, 0.45, 0.55) },
    );
    const number = `Página ${i + 1} de ${pages.length}`;
    page.drawText(number, {
      x: width - 30 - font.widthOfTextAtSize(number, 7),
      y: 24,
      size: 7,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
  });
  const bytes = await document.save();
  download(
    new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }),
    reportFilename(data.child, issued),
  );
}
