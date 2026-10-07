import { test, expect } from "@playwright/test";
test("health previews images and downloads bytes, not JSON error responses", async ({
  page,
}) => {
  let failed = false,
    unexpected = false;
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBMcAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/api/**", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { setup: false, registration: true } }),
  );
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        id: "qa-user",
        nombre: "QA",
        familia: "QA",
        rol: "editor",
        subscription: { subscription_status: "active", commercial_exempt: 1 },
        platform_controls: { blocked_modules: [] },
      },
    }),
  );
  await page.route("**/api/children", (r) =>
    r.fulfill({
      json: [
        {
          id: "qa-child",
          primer_nombre: "QA",
          fecha_nacimiento: "2020-01-01",
          rnd_habilitado: 0,
        },
      ],
    }),
  );
  await page.route("**/api/files?*", (r) =>
    r.fulfill({
      json: [
        {
          id: "qa-image",
          nombre: "foto.png",
          mime: "image/png",
          bytes: image.length,
        },
      ],
    }),
  );
  await page.route("**/api/files/qa-image", (r) =>
    failed
      ? r.fulfill({
          status: 500,
          json: { error: "Archivo temporalmente no disponible." },
        })
      : unexpected
        ? r.fulfill({ json: { error: "unexpected" } })
        : r.fulfill({ contentType: "image/png", body: image }),
  );
  await page.route('**/api/records/registros_crecimiento?*',r=>r.fulfill({json:[{id:'measurement',nino_id:'qa-child',fecha_medicion:'2026-10-06',peso_kg:21,adjuntos_json:JSON.stringify(['qa-image'])}]}));
  await page.goto("/");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Salud", exact: true })
    .click();
  await page.locator('.record-card>summary').first().click();
  const attachments = page.locator(".record-file-item");
  await attachments.getByText("Vista previa", { exact: true }).click();
  await expect(
    attachments.getByRole("img", { name: "foto.png" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      attachments
        .getByRole("img", { name: "foto.png" })
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  const downloaded = page.waitForEvent("download");
  await attachments.getByRole("button", { name: "Descargar foto.png" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("foto.png");
  const { readFile } = await import("node:fs/promises");
  expect(await readFile((await file.path())!)).toEqual(image);
  let extraDownloads = 0;
  page.on("download", () => extraDownloads++);
  failed = true;
  await attachments.getByRole("button", { name: "Descargar foto.png" }).click();
  await expect(
    attachments.getByText("Archivo temporalmente no disponible.", {
      exact: true,
    }),
  ).toBeVisible();
  await attachments.getByText("Vista previa", { exact: true }).click();
  await attachments.getByText("Vista previa", { exact: true }).click();
  await expect(
    attachments
      .locator("details")
      .getByText("Archivo temporalmente no disponible.", { exact: true }),
  ).toBeVisible();
  failed = false;
  unexpected = true;
  await attachments.getByRole("button", { name: "Descargar foto.png" }).click();
  await expect(
    attachments.getByText("El servidor no devolvió un documento válido.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(extraDownloads).toBe(0);
});
