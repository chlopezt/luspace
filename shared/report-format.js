import { calendarAge } from "./dates.js";
const zone = "America/Santiago";
export function meaningful(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(meaningful);
  return !["", "sin registrar", "sin_registrar", "[]", "{}"].includes(
    String(value).trim().toLowerCase(),
  );
}
export function issueDay(value) {
  const date = new Date(value);
  const valid = Number.isFinite(+date) ? date : new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(valid)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function reportDate(value, time = false, friendly = false) {
  if (!meaningful(value)) return "";
  const raw = String(value);
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const localTime =
    /T\d{2}:\d{2}/.test(raw) && !/(Z|[+-]\d{2}:\d{2})$/.test(raw);
  // Calendar dates are not instants. Keep their day, regardless of timezone.
  const date = new Date(
    dayOnly ? raw + "T12:00:00Z" : localTime ? raw + "Z" : raw,
  );
  if (!Number.isFinite(+date)) return raw;
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: dayOnly || localTime ? "UTC" : zone,
    day: "2-digit",
    month: friendly ? "long" : "2-digit",
    year: "numeric",
    ...(time && !dayOnly
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : {}),
  })
    .format(date)
    .replace(/-/g, "/");
}
export function reportText(value) {
  return String(value ?? "")
    .replace(/[\u2011-\u2014]/g, "-")
    .replace(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?/g,
      (x) => reportDate(x, true),
    );
}
export function reportAge(birth, issued) {
  const age = calendarAge(String(birth || "").slice(0, 10), issueDay(issued));
  return age
    ? `${age.years} ${age.years === 1 ? "año" : "años"} y ${age.months} ${age.months === 1 ? "mes" : "meses"}`
    : "";
}
export function reportFilename(child = {}, issued) {
  const name =
    [child.primer_nombre, child.apellidos]
      .filter(meaningful)
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "Ficha_Pediatrica";
  return `Informe-LuSpace_${name}_${issueDay(issued).split("-").reverse().join("-")}.pdf`;
}
export function fieldText(field, value) {
  if (!meaningful(value)) return "";
  if (field.type === "checkbox")
    return value === true || value === 1 || value === "1" ? "Sí" : "No";
  if (
    field.type === "date" ||
    field.type === "datetime-local" ||
    field.type === "datetime"
  )
    return reportDate(value, field.type !== "date");
  if (field.type === "lines") {
    let list = value;
    if (!Array.isArray(list)) {
      try {
        list = JSON.parse(value);
      } catch {
        list = [value];
      }
    }
    return reportText(
      Array.isArray(list) ? list.filter(meaningful).join("\n") : value,
    );
  }
  return reportText(value);
}
