// Versioned reference, not an RNI connection or proof of immunization.
export const vaccinationSource =
  "https://saludresponde.minsal.cl/calendarios-de-vacunacion/";
export const vaccinationVersion = "PNI Chile · septiembre 2026";
const dose = (id, nombre, dosis, meses, etapa, extra = {}) => ({
  id,
  nombre,
  dosis,
  meses,
  etapa,
  ...extra,
});
export const vaccinationCatalog = [
  dose("bcg-rn", "BCG", "Única", 0, "0–6 meses"),
  dose("hb-rn", "Hepatitis B", "Nacimiento", 0, "0–6 meses"),
  ...[2, 4, 6, 18].map((m, i) =>
    dose(
      "hexa-" + m,
      "Hexavalente",
      i === 3 ? "Refuerzo" : `${i + 1}ª dosis`,
      m,
      m < 12 ? "0–6 meses" : "12–36 meses",
    ),
  ),
  ...[2, 4, 6, 12].map((m, i) =>
    dose(
      "pcv-" + m,
      "Neumocócica conjugada",
      m === 12 ? "Refuerzo" : `${i + 1}ª dosis`,
      m,
      m < 12 ? "0–6 meses" : "12–36 meses",
      {
        nota: "PCV20 desde septiembre de 2026; registra la marca realmente recibida.",
        ...(m === 6 ? { condicion: "Solo prematuros" } : {}),
      },
    ),
  ),
  ...[2, 4, 18].map((m, i) =>
    dose(
      "menb-" + m,
      "Meningocócica B",
      m === 18 ? "Refuerzo" : `${i + 1}ª dosis`,
      m,
      m < 12 ? "0–6 meses" : "12–36 meses",
      {
        nota: "La incorporación al PNI depende de la cohorte; verifica el calendario del año correspondiente.",
      },
    ),
  ),
  dose("srp-12", "Tres vírica (SRP)", "1ª dosis", 12, "12–36 meses"),
  dose("acwy-12", "Meningocócica ACWY", "Única", 12, "12–36 meses"),
  dose("ha-18", "Hepatitis A", "Única", 18, "12–36 meses"),
  dose("var-18", "Varicela", "1ª dosis", 18, "12–36 meses"),
  dose("fa-18", "Fiebre amarilla", "Única", 18, "12–36 meses", {
    condicion: "Solo Rapa Nui",
  }),
  dose("srp-36", "Tres vírica (SRP)", "2ª dosis", 36, "12–36 meses"),
  dose("var-36", "Varicela", "2ª dosis", 36, "12–36 meses"),
  dose("dtpa-1", "dTPa (acelular)", "Refuerzo · 1° Básico", null, "Escolar"),
  dose("vph-4", "VPH", "Única · 4° Básico", null, "Escolar", {
    nota: "Pauta 2026: dosis única en 4° Básico; verifica pautas previas con el vacunatorio.",
  }),
  dose("dtpa-8", "dTPa (acelular)", "Refuerzo · 8° Básico", null, "Escolar"),
];
export function vaccinationToday(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
export function vaccinationDue(birth, months) {
  if (months == null || !/^\d{4}-\d{2}-\d{2}$/.test(birth || "")) return "";
  const [y, m, d] = birth.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}
export function vaccinationState(row, birth, today = vaccinationToday()) {
  if (row.estado === "Administrada") return "Administrada";
  const ref = vaccinationCatalog.find((c) => c.id === row.catalogo_id);
  const due =
    row.fecha_prevista ||
    (row.id && ref ? vaccinationDue(birth, ref.meses) : "");
  if (row.estado === "Atrasada" || (row.id && due && due < today))
    return "Atrasada";
  return row.id ? "Pendiente/Próxima" : "Por verificar";
}
