import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(m.text());
  });
  await page.goto("http://127.0.0.1:5176/");
  await page.getByLabel("Correo", { exact: true }).fill("qa@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("QaPassword!2026");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("button", { name: "Descargar informe PDF" }).click();
  const downloaded = page
    .waitForEvent("download", { timeout: 20000 })
    .catch(async (e) => {
      console.log("ERROR UI", await page.getByRole("alert").allTextContents());
      throw e;
    });
  await page
    .getByRole("button", { name: "Descargar PDF", exact: true })
    .click();
  await (await downloaded).saveAs("../work/qa-informe-final.pdf");
  console.log("PDF final descargado");
} finally {
  await browser.close();
}
