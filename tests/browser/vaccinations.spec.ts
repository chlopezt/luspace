import { test, expect } from "@playwright/test";
for (const width of [320, 375, 414, 1280])
  test(`vaccination carnet and saved dose at ${width}px`, async ({ page }) => {
    const child = {
      id: "qa",
      primer_nombre: "QA",
      fecha_nacimiento: "2025-01-01",
    };
    let rows: any[] = [];
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/**", (r) => r.fulfill({ json: [] }));
    await page.route("**/api/status", (r) =>
      r.fulfill({ json: { setup: false, registration: true } }),
    );
    await page.route("**/api/me", (r) =>
      r.fulfill({
        json: {
          id: "owner",
          rol: "superadmin",
          nombre: "QA",
          familia: "QA",
          subscription: { subscription_status: "active", commercial_exempt: 1 },
          platform_controls: { blocked_modules: [] },
        },
      }),
    );
    await page.route("**/api/subscription", (r) =>
      r.fulfill({
        json: { subscription_status: "active", commercial_exempt: 1 },
      }),
    );
    await page.route("**/api/children", (r) => r.fulfill({ json: [child] }));
    await page.route("**/api/records/vacunas**", async (r) => {
      if (r.request().method() === "POST") {
        rows.push({ ...r.request().postDataJSON(), id: "dose" });
        await r.fulfill({ status: 201, json: { id: "dose" } });
      } else await r.fulfill({ json: rows });
    });
    await page.goto("/");
    if (width < 760)
      await page
        .getByRole("button", { name: "Abrir menú", exact: true })
        .click();
    await page
      .locator(".sidebar")
      .getByRole("button", { name: "Salud", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Carnet de vacunas", exact: true })
      .click();
    await expect(
      page.getByText("Por verificar", { exact: true }).first(),
    ).toBeVisible();
    await page.locator('.vaccine-dose').filter({has:page.getByRole('heading',{name:'BCG',exact:true})}).locator('summary').click();
    await page
      .locator(".vaccine-dose")
      .filter({ has: page.getByRole("heading", { name: "BCG", exact: true }) })
      .getByRole("button", { name: "Registrar dosis" })
      .click();
    const modal = page.getByRole("dialog", { name: "Registrar vacuna" });
    await modal
      .getByLabel("Estado", { exact: true })
      .selectOption("Administrada");
    await modal
      .getByLabel("Fecha de aplicación", { exact: true })
      .fill("2025-01-02");
    await modal
      .getByLabel("Centro o lugar de vacunación", { exact: true })
      .fill("CESFAM QA");
    await modal.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(modal).toHaveCount(0);
    await page.locator('.vaccine-dose').filter({has:page.getByRole('heading',{name:'BCG',exact:true})}).locator('summary').click();
    await expect(page.getByText("CESFAM QA")).toBeVisible();
    await expect(page.getByText("Administrada", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 375)
      await page.screenshot({
        path: "tmp/vaccines-mobile.png",
        fullPage: true,
      });
    await page.reload();
    if (width < 760)
      await page
        .getByRole("button", { name: "Abrir menú", exact: true })
        .click();
    await page
      .locator(".sidebar")
      .getByRole("button", { name: "Salud", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Carnet de vacunas", exact: true })
      .click();
    await page.locator('.vaccine-dose').filter({has:page.getByRole('heading',{name:'BCG',exact:true})}).locator('summary').click();
    await expect(page.getByText("CESFAM QA")).toBeVisible();
  });
