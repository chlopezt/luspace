import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function setup(page: any, role = "superadmin") {
  const image = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 60;
      canvas.height = 60;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#14b8a6";
      context.fillRect(0, 0, 60, 60);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  let child: any = {
    id: "child-qa",
    primer_nombre: "Paciente QA",
    fecha_nacimiento: "2026-09-01",
    colegio_actual: "Cuidado en el hogar",
    curso_actual: "Lactante menor",
    hospitalizado: "No",
  };
  const users = [
    { id: "admin", nombre: "Administrador QA", rol: "superadmin" },
    {
      id: "editor",
      nombre: "Familiar QA",
      rol: "editor",
      permisos_json: JSON.stringify({
        modules: ["perfil", "salud"],
        acciones: ["ver", "editar"],
        sensibles: ["foto_perfil"],
        privacidad: [],
      }),
    },
  ];
  let saves = 0,
    permissions: any = null;
  await page.route("**/api/**", (r: any) => r.fulfill({ json: [] }));
  await page.route("**/api/status", (r: any) =>
    r.fulfill({ json: { setup: false, registration: true } }),
  );
  await page.route("**/api/me", (r: any) =>
    r.fulfill({
      json: {
        id: "admin",
        rol: role,
        permisos_json: JSON.stringify({
          acciones: ["crear", "editar", "eliminar"],
        }),
        nombre: "QA",
        familia: "QA",
        subscription: { commercial_exempt: 1 },
        platform_controls: { blocked_modules: [] },
      },
    }),
  );
  await page.route("**/api/subscription", (r: any) =>
    r.fulfill({ json: { commercial_exempt: 1 } }),
  );
  await page.route("**/api/children", (r: any) => r.fulfill({ json: [child] }));
  await page.route("**/api/children/child-qa", (r: any) => {
    saves++;
    child = { ...child, ...r.request().postDataJSON() };
    return r.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/files?*", (r: any) =>
    r.fulfill({ json: { id: "photo-qa" } }),
  );
  await page.route("**/api/files/photo-qa", (r: any) =>
    r.fulfill({ body: image, contentType: "image/png" }),
  );
  await page.route("**/api/users", (r: any) => r.fulfill({ json: users }));
  await page.route("**/api/users/editor", (r: any) => {
    permissions = r.request().postDataJSON();
    return r.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  if (
    await page
      .getByRole("button", { name: "Abrir menú", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Perfil", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar perfil", exact: true })
    .click();
  return {
    image,
    child: () => child,
    saves: () => saves,
    permissions: () => permissions,
  };
}
for (const width of [320, 375, 414, 1280])
  test(`profile tabs and fixed save fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const state = await setup(page);
    const modal = page.getByRole("dialog", {
      name: "Editar perfil",
      exact: true,
    });
    await expect(modal.getByRole("tab")).toHaveCount(5);
    await modal.getByLabel("Apellidos", { exact: true }).fill("Ejemplo");
    await modal
      .getByLabel("Subir foto de perfil", { exact: true })
      .setInputFiles({
        name: "photo.png",
        mimeType: "image/png",
        buffer: state.image,
      });
    await expect(modal.getByAltText("Vista previa de la foto")).toBeVisible();
    await modal.getByRole("tab", { name: "Salud", exact: true }).click();
    await modal
      .getByLabel("¿Ha estado hospitalizado/a?", { exact: true })
      .selectOption("Sí");
    await modal
      .getByLabel("Motivo de hospitalización", { exact: true })
      .fill("Motivo de prueba");
    await modal.getByRole("tab", { name: "Cuidado", exact: true }).click();
    await expect(
      modal.getByLabel("Institución o modalidad de cuidado", { exact: true }),
    ).toHaveValue("Cuidado en el hogar");
    await modal
      .getByLabel("Nivel, etapa o curso actual", { exact: true })
      .fill("Sala Cuna Mayor");
    await modal.getByRole("tab", { name: "Contactos", exact: true }).click();
    await modal
      .getByLabel("Contacto principal: teléfono", { exact: true })
      .fill("+56 9 1234 5678");
    await modal
      .getByRole("tab", { name: "Identificación", exact: true })
      .click();
    await expect(modal.getByLabel("Apellidos", { exact: true })).toHaveValue(
      "Ejemplo",
    );
    await expect(modal.getByAltText("Vista previa de la foto")).toBeVisible();
    const save = modal.getByRole("button", {
      name: "Guardar cambios",
      exact: true,
    });
    for (const title of [
      "Identificación",
      "Salud",
      "Cuidado",
      "Contactos",
      "Privacidad",
    ]) {
      await modal.getByRole("tab", { name: title, exact: true }).click();
      await modal
        .locator(".profile-editor-body")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      const box = await save.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(800);
      expect(box!.y).toBeGreaterThan(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await modal.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
    if (width === 320 || width === 1280) {
      await mkdir("tmp/profile-editor", { recursive: true });
      await modal
        .getByRole("tab", { name: "Identificación", exact: true })
        .click();
      await page.screenshot({ path: `tmp/profile-editor/${width}.png` });
    }
    await save.click();
    await expect(modal).toHaveCount(0);
    expect(state.child()).toMatchObject({
      apellidos: "Ejemplo",
      foto_perfil_id: "photo-qa",
      hospitalizacion_motivo: "Motivo de prueba",
      curso_actual: "Sala Cuna Mayor",
      contacto_emergencia_principal_telefono: "+56 9 1234 5678",
    });
  });
test("validation switches to hidden invalid field and privacy preserves draft", async ({
  page,
}) => {
  const state = await setup(page);
  const modal = page.getByRole("dialog", {
    name: "Editar perfil",
    exact: true,
  });
  await modal.getByLabel("Nombre", { exact: true }).fill("");
  await modal.getByRole("tab", { name: "Salud", exact: true }).click();
  await modal
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  expect(state.saves()).toBe(0);
  await expect(
    modal.getByRole("tab", { name: "Identificación", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await modal.getByLabel("Nombre", { exact: true }).fill("Nombre conservado");
  await modal.getByRole("tab", { name: "Privacidad", exact: true }).click();
  await modal
    .getByRole("button", {
      name: "Configurar visibilidad y permisos",
      exact: true,
    })
    .click();
  const access = page.getByRole("dialog", {
    name: "Visibilidad de datos familiares",
    exact: true,
  });
  await access
    .getByRole("button", {
      name: "Configurar permisos de Familiar QA",
      exact: true,
    })
    .click();
  const permissions = page.getByRole("dialog", {
    name: "Permisos de Familiar QA",
    exact: true,
  });
  await permissions.getByLabel("RUT", { exact: true }).check();
  await permissions
    .getByRole("button", { name: "Guardar permisos", exact: true })
    .click();
  await expect(permissions).toHaveCount(0);
  expect(state.permissions().permisos_json.privacidad).toContain("rut");
  await access.getByRole("button", { name: "Cerrar", exact: true }).click();
  await modal.getByRole("tab", { name: "Identificación", exact: true }).click();
  await expect(modal.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Nombre conservado",
  );
  await modal.getByRole("tab", { name: "Identificación", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    modal.getByRole("tab", { name: "Salud", exact: true }),
  ).toBeFocused();
});
test("editor sees privacy explanation, not administrative controls; dark colors adapt", async ({
  page,
}) => {
  await setup(page, "editor");
  const modal = page.getByRole("dialog", {
    name: "Editar perfil",
    exact: true,
  });
  await modal.getByRole("tab", { name: "Privacidad", exact: true }).click();
  await expect(
    modal.getByRole("button", {
      name: "Configurar visibilidad y permisos",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  const color = await modal.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(color).not.toBe("rgb(255, 255, 255)");
  await expect(
    modal.getByText("El SuperAdmin de tu familia administra estos permisos.", {
      exact: true,
    }),
  ).toBeVisible();
});
