import { test, expect } from "@playwright/test";
test("isolated preview: multi-file persistence, contextual galleries, accordions and mobile layout", async ({
  page,
}) => {
  test.skip(
    !process.env.PW_CONTEXTUAL_PREVIEW,
    "Run against the isolated seeded preview only",
  );
  page.setDefaultTimeout(12000);
  await page.goto("/login");
  await page.locator("input[name=correo]").fill("familia@preview.luspace.test");
  await page.locator("input[name=password]").fill("VistaPrevia!2026");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Auditoría", exact: true }),
  ).toHaveCount(0);
  const section = async (name: string) => {
    if (
      await page
        .getByRole("button", { name: "Abrir menú", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Abrir menú", exact: true })
        .click();
    await page
      .locator(".sidebar")
      .getByRole("button", { name, exact: true })
      .click();
  };
  await section("Salud");
  await page
    .getByRole("button", { name: "Consultas médicas", exact: true })
    .click();
  await expect(page.locator(".attachments")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Preparar próxima consulta/ }),
  ).toHaveCount(0);
  const summary = page.locator(".record-card>summary").first();
  await summary.click();
  await expect(page.locator(".record-file-item")).toHaveCount(2);
  await page
    .locator(".record-file-item")
    .first()
    .getByText("Vista previa", { exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Ver PDF", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Alimentación", exact: true }).click();
  await expect(page.locator(".consultation-body").first()).not.toBeVisible();
  await page.locator(".record-card>summary").first().click();
  await expect(page.locator(".consultation-body").first()).toContainText(
    "Buena tolerancia",
  );
  const originalFiles = await page.locator(".record-file-item").count();
  await page.screenshot({
    path: "../work/contextual-preview-desktop.png",
    fullPage: true,
  });
  for (const width of [320, 375, 414, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: "../work/contextual-preview-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .locator(".record-card")
    .first()
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.locator("input[type=file][multiple]").setInputFiles([
    {
      name: "Alimentacion-adjunto-A.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nQA A"),
    },
    {
      name: "Alimentacion-adjunto-B.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nQA B"),
    },
  ]);
  await expect(
    modal.getByRole("button", { name: "Guardar", exact: true }),
  ).toBeEnabled();
  await modal.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.reload();
  await section("Salud");
  await expect(
    page.getByRole("button", { name: "Alimentación", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Alimentación", exact: true }).click();
  await page.locator(".record-card>summary").first().click();
  await expect(page.locator(".record-file-item")).toHaveCount(
    originalFiles + 2,
  );
  await section("Escolar");
  await page.locator(".record-card>summary").first().click();
  await expect(page.locator(".record-file-gallery")).toContainText(
    "Apoyos-del-entorno.pdf",
  );
  await expect(page.locator(".record-file-gallery")).not.toContainText(
    "Plan-PAEC.pdf",
  );
  await page
    .getByRole("button", { name: "Adecuaciones PIE / PACI", exact: true })
    .click();
  await page.locator(".record-card>summary").first().click();
  await expect(page.locator(".record-file-gallery")).toContainText(
    "Plan-PAEC.pdf",
  );
  await expect(page.locator(".record-file-gallery")).not.toContainText(
    "Apoyos-del-entorno.pdf",
  );
  await section("Anamnesis");
  await expect(page.locator(".anamnesis-accordion")).toHaveCount(7);
  await expect(page.locator(".anamnesis-body").first()).not.toBeVisible();
  await page.locator(".anamnesis-accordion>summary").first().click();
  await expect(page.locator(".anamnesis-body").first()).toBeVisible();
  await expect(page.locator(".anamnesis-body").first()).toContainText(
    "Antecedentes-del-desarrollo.pdf",
  );
});
test("platform preview shows independent per-account feature controls defaulting off", async ({
  page,
}) => {
  test.skip(
    !process.env.PW_CONTEXTUAL_PREVIEW,
    "Run against the isolated seeded preview only",
  );
  await page.goto("/admin/login");
  await page.locator("input[name=correo]").fill("admin@preview.luspace.test");
  await page.locator("input[name=password]").fill("AdminVista!2026");
  await page
    .getByRole("button", { name: "Ingresar a administración", exact: true })
    .click();
  await page
    .locator(".platform-sidebar")
    .getByRole("button", { name: "Familias", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Gestionar Familia de vista previa",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Visibilidad de Auditoría e IA", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: /Visibilidad de funciones/ });
  await expect(
    modal.getByRole("checkbox", {
      name: "Mostrar Auditoría familiar",
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(
    modal.getByRole("checkbox", {
      name: "Mostrar asistencia IA en Consultas médicas",
      exact: true,
    }),
  ).not.toBeChecked();
  await modal
    .getByLabel("Motivo", { exact: true })
    .fill("Verificación de controles en vista previa");
  await modal
    .getByLabel("Tu contraseña administrativa", { exact: true })
    .fill("AdminVista!2026");
  await page.screenshot({
    path: "../work/contextual-preview-admin.png",
    fullPage: true,
  });
  await modal
    .getByRole("button", { name: "Guardar visibilidad", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
});
