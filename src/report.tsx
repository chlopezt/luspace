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
import { download, type Row } from "./lib";
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 40,
    paddingBottom: 60,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#173f43",
  },
  logo: { width: 80, height: 54, objectFit: "contain", marginBottom: 10 },
  h1: { fontSize: 22, marginBottom: 8 },
  h2: { fontSize: 14, marginTop: 17, marginBottom: 8, color: "#0d847b" },
  label: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 6 },
  value: { fontSize: 10, color: "#354f55", lineHeight: 1.4 },
  footer: {
    position: "absolute",
    top: 808,
    left: 40,
    right: 40,
    height: 14,
    fontSize: 8,
    lineHeight: 1,
    color: "#65797c",
  },
  record: {
    borderBottomWidth: 1,
    borderBottomColor: "#dce7e5",
    paddingBottom: 10,
    marginBottom: 10,
  },
});
function Pair({ label, value }: { label: string; value: string }) {
  return (
    <View wrap={value.length > 500}>
      <Text style={styles.label} minPresenceAhead={22}>
        {label}
      </Text>
      <Text style={styles.value} orphans={3} widows={3}>
        {value}
      </Text>
    </View>
  );
}
export function Report({ data }: { data: Row }) {
  return (
    <Document title={"LuSpace · " + data.child.primer_nombre} author="LuSpace">
      <Page size="A4" style={styles.page}>
        {data.logo ? (
          <Image src={data.logo} style={styles.logo} />
        ) : (
          <Text style={styles.h2}>LuSpace</Text>
        )}
        <Text style={styles.h1}>Informe de cuidado</Text>
        {data.includePhoto && data.profilePhoto && <Image src={data.profilePhoto} style={{ width: 80, height: 80, objectFit: "cover", marginBottom: 8 }} />}
        <Text>
          {data.child.primer_nombre} {data.child.apellidos || ""}
        </Text>
      {data.child.fecha_nacimiento && <Text>Nacimiento: {data.child.fecha_nacimiento}</Text>}
      {data.child.alergias && <Text>Alergias: {data.child.alergias}</Text>}
      {data.child.grupo_sanguineo && <Text>Grupo sanguíneo: {data.child.grupo_sanguineo}</Text>}
        <Text>
          Emitido: {new Date(data.created).toLocaleDateString("es-CL")}
        </Text>
        <Text>
          Información registrada por la familia. Compartir solo con el
          destinatario autorizado.
        </Text>
        {data.anamnesis && (
          <>
            <Text style={styles.h2} minPresenceAhead={80}>
              Anamnesis pediátrica
            </Text>
            {anamnesisSections.filter(([key]) => Object.values(data.anamnesis[key as string] || {}).some(Boolean)).map(([key, title, fields]) => (
              <View
                key={String(key)}
                wrap={(fields as string[]).some(
                  (_, i) =>
                    (data.anamnesis[key as string]?.[i] || "").length > 600,
                )}
              >
                <Text style={styles.h2} minPresenceAhead={60}>
                  {title as string}
                </Text>
                {(fields as string[]).map((label, i) => data.anamnesis[key as string]?.[i] ? (
                  <Pair
                    key={i}
                    label={label}
                    value={
                      data.anamnesis[key as string]?.[i]
                    }
                  />
                ) : null)}
              </View>
            ))}
          </>
        )}
        {Object.entries(data.sections).filter(([, rows]) => (rows as Row[]).length).map(([table, rows]) => (
          <View key={table}>
            <Text style={styles.h2} minPresenceAhead={60}>
              {(models as Row)[table].title}
            </Text>
            {(rows as Row[]).map((r: Row) => (
              <View style={styles.record} key={r.id}>
                {(models as Row)[table].fields
                  .filter((f: Row) => fieldVisible(f, r) && f.type !== "file" && r[f.key] !== null && r[f.key] !== undefined && r[f.key] !== "" && !(f.type === "lines" && !JSON.parse(r[f.key] || "[]").length))
                  .map((f: Row) => (
                    <Pair
                      key={f.key}
                      label={f.label}
                      value={
                        f.type === "checkbox"
                          ? r[f.key]
                            ? "Sí"
                            : "No"
                          : f.type === "lines"
                            ? JSON.parse(r[f.key] || "[]").join("\n")
                            : String(r[f.key])
                      }
                    />
                  ))}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
export async function exportPdf(data: Row) {
  let logo = "";
  try {
    const res = await fetch("/brand/luspace-logo.png");
    if (res.ok) {
      const blob = await res.blob();
      logo = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }
  } catch {}
  const blob = await pdf(<Report data={{ ...data, logo }} />).toBlob();
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const document = await PDFDocument.load(await blob.arrayBuffer()),
    font = await document.embedFont(StandardFonts.Helvetica),
    pages = document.getPages();
  pages.forEach((page, i) =>
    page.drawText(`LuSpace · Documento privado · ${i + 1} / ${pages.length}`, {
      x: 40,
      y: 22,
      size: 8,
      font,
      color: rgb(0.35, 0.45, 0.46),
    }),
  );
  const bytes = await document.save();
  download(
    new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }),
    "LuSpace-informe.pdf",
  );
}
