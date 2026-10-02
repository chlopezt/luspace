import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
const root = "https://cdn.who.int/media/docs/default-source/child-growth/";
const sources = [
  [
    "weight_masculino",
    "child-growth-standards/indicators/weight-for-age/wfa_boys_0-to-5-years_zscores.xlsx",
  ],
  [
    "weight_femenino",
    "child-growth-standards/indicators/weight-for-age/wfa_girls_0-to-5-years_zscores.xlsx",
  ],
  [
    "height_masculino",
    "child-growth-standards/indicators/length-height-for-age/lhfa_boys_0-to-2-years_zscores.xlsx",
  ],
  [
    "height_femenino",
    "child-growth-standards/indicators/length-height-for-age/lhfa_girls_0-to-2-years_zscores.xlsx",
  ],
  [
    "height_masculino",
    "child-growth-standards/indicators/length-height-for-age/lhfa_boys_2-to-5-years_zscores.xlsx",
  ],
  [
    "height_femenino",
    "child-growth-standards/indicators/length-height-for-age/lhfa_girls_2-to-5-years_zscores.xlsx",
  ],
  [
    "weight_masculino",
    "growth-reference-5-19-years/weight-for-age-%285-10-years%29/hfa-boys-perc-who2007-exp_07eb5053-9a09-4910-aa6b-c7fb28012ce6.xlsx",
  ],
  [
    "weight_femenino",
    "growth-reference-5-19-years/weight-for-age-%285-10-years%29/hfa-girls-perc-who2007-exp_6040a43e-81da-48fa-a2d4-5c856fe4fe71.xlsx",
  ],
  [
    "height_masculino",
    "growth-reference-5-19-years/height-for-age-%285-19-years%29/hfa-boys-perc-who2007-exp.xlsx",
  ],
  [
    "height_femenino",
    "growth-reference-5-19-years/height-for-age-%285-19-years%29/hfa-girls-perc-who2007-exp.xlsx",
  ],
];
const output = {},
  provenance = [];
for (const [key, path] of sources) {
  const url = root + path,
    response = await fetch(url);
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  const sheet = book.worksheets[0];
  let header, columns;
  sheet.eachRow((row, index) => {
    const vals = row.values;
    const labels = vals.map((v) =>
      String(v ?? "")
        .trim()
        .toLowerCase(),
    );
    if (labels.includes("l") && labels.includes("m") && labels.includes("s")) {
      header = index;
      columns = {
        month: labels.findIndex((x) =>
          ["month", "months", "age (months)"].includes(x),
        ),
        l: labels.indexOf("l"),
        m: labels.indexOf("m"),
        s: labels.indexOf("s"),
      };
    }
  });
  if (!header || columns.month < 0)
    throw Error(
      "Unknown WHO table headers: " + JSON.stringify(sheet.getRow(1).values),
    );
  const rows = [];
  sheet.eachRow((row, index) => {
    if (index <= header) return;
    const r = [columns.month, columns.l, columns.m, columns.s].map((c) =>
      Number(row.getCell(c).value),
    );
    if (
      r.every(Number.isFinite) &&
      r[0] >= 0 &&
      r[0] <= 228 &&
      r[2] > 0 &&
      r[3] > 0
    )
      rows.push(r);
  });
  if (rows.length < 20) throw Error("Incomplete WHO table " + url);
  output[key] ||= [];
  for (const row of rows) {
    const ix = output[key].findIndex((v) => v[0] === row[0]);
    if (ix >= 0) output[key][ix] = row;
    else output[key].push(row);
  }
  provenance.push({ key, url, rows: rows.length });
  console.log(key, rows.length, rows[0], rows.at(-1));
}
for (const [key, rows] of Object.entries(output)) {
  rows.sort((a, b) => a[0] - b[0]);
  const max = key.startsWith("weight") ? 120 : 228;
  for (let m = 0; m <= max; m++)
    if (!rows.some((r) => r[0] === m))
      throw Error("Missing month " + key + " " + m);
  if (rows.length !== max + 1) throw Error("Unexpected WHO row count");
}
await mkdir("public/data", { recursive: true });
await writeFile("public/data/who.json", JSON.stringify(output));
await writeFile(
  "public/data/who-sources.json",
  JSON.stringify(
    {
      source: "WHO Child Growth Standards 2006 and Growth Reference 2007",
      imported: new Date().toISOString(),
      columns: ["age_months", "L", "M", "S"],
      sources: provenance,
    },
    null,
    2,
  ),
);
