import { test, expect } from "@playwright/test";
test("family workflow, persistence, PDF and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Tu nombre").fill("Administrador QA");
  await page.getByLabel("Nombre de la familia").fill("Familia de prueba");
  await page.getByLabel("Correo", { exact: true }).fill("qa@example.test");
  await page
    .getByLabel("Contraseña (mínimo 12 caracteres)")
    .fill("QaPassword!2026");
  await page.getByRole("button", { name: "Crear mi familia" }).click();
  await page.getByRole("button", { name: "Crear primer perfil" }).click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Luciano QA");
  await page.getByLabel("Apodo", { exact: true }).fill("Lu");
  await page
    .getByLabel("Fecha de nacimiento", { exact: true })
    .fill("2018-05-20");
  await page.getByLabel("Sexo de referencia OMS").selectOption("masculino");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Hola, familia.")).toBeVisible();
  await expect(page.getByText("28,4 kg")).toHaveCount(0);
  await page.getByRole("button", { name: "Salud", exact: true }).click();
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.getByLabel("Fecha", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Peso (kg)").fill("25");
  await page.getByLabel("Talla o longitud (cm)").fill("125");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("25", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Salud", exact: true }).click();
  await expect(page.getByText("25", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Escolar", exact: true }).click();
  await page
    .getByRole("button", { name: "Historial de colegios", exact: true })
    .click();
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.getByLabel("Establecimiento", { exact: true }).fill("Escuela QA");
  await page
    .getByLabel("Motivo de retiro o cambio")
    .fill("Cambio de domicilio");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Escuela QA")).toBeVisible();
  await page.getByRole("button", { name: "Anamnesis", exact: true }).click();
  await page
    .getByLabel("Padres y cuidadores: nombres, parentesco y contacto")
    .fill("Texto de prueba para verificar autoguardado");
  await expect(page.getByText("Guardado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Descargar informe PDF" }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar PDF", exact: true })
    .click();
  const file = await download;
  await file.saveAs("../work/qa-informe.pdf");
  expect(await file.failure()).toBeNull();
  await page.getByRole("button", { name: "Inicio", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "../work/luspace-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await page.screenshot({
    path: "../work/luspace-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("treatments, appointments, school, RND and temporary professional access", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByLabel("Correo", { exact: true }).fill("qa@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("QaPassword!2026");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("button", { name: "Salud", exact: true }).click();
  await page.getByRole("button", { name: "Tratamientos", exact: true }).click();
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Medicamento", { exact: true })
    .fill("Tratamiento de prueba");
  await dialog.getByLabel("Dosis indicada").fill("Según receta de prueba");
  await dialog.getByLabel("Frecuencia (horas)").fill("24");
  await dialog.getByLabel("Primera dosis programada").fill("2026-10-02T21:00");
  await dialog.getByLabel("Inicio", { exact: true }).fill("2026-01-01");
  await dialog.getByLabel("Tratamiento activo").check();
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Tratamiento de prueba", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Consultas médicas", exact: true })
    .click();
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Fecha y hora").fill("2026-12-14T10:30");
  await dialog
    .getByLabel("Profesional", { exact: true })
    .fill("Profesional QA");
  await dialog.getByLabel("Especialidad").fill("Neurología");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Profesional QA", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Escolar", exact: true }).click();
  await page
    .getByRole("button", { name: "Bitácora diaria", exact: true })
    .click();
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Estado de ánimo").selectOption("feliz");
  await dialog.getByLabel("Qué ocurrió").fill("Jornada tranquila de prueba");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Jornada tranquila de prueba")).toBeVisible();
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await page.getByRole("button", { name: "Editar perfil" }).click();
  await page.getByLabel("Mostrar credencial RND").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar", exact: true })
    .click();
  await page
    .locator("aside")
    .getByRole("button", { name: "Credencial RND", exact: true })
    .click();
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Credencial activa").check();
  await dialog.getByLabel("Número de registro / folio").fill("QA-123");
  await dialog
    .locator("input[type=file]")
    .first()
    .setInputFiles("../work/qa-informe.pdf");
  await expect(dialog.getByRole("link", { name: "Ver adjunto" })).toBeVisible();
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await page
    .locator("header")
    .getByRole("button", { name: "Credencial RND" })
    .click();
  await expect(page.getByRole("dialog").getByText("QA-123")).toBeVisible();
  await expect(page.getByRole("dialog").locator("iframe")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Invitados", exact: true }).click();
  await page.getByLabel("Profesional o destinatario").fill("Terapeuta QA");
  await page.getByLabel("PIN opcional de 4 dígitos").fill("2468");
  await page.getByLabel("Un solo uso").check();
  await page.getByRole("button", { name: "Generar enlace" }).click();
  const link = await page.getByLabel("Enlace generado").inputValue();
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(link);
  await guest.getByLabel("PIN, si te lo entregaron").fill("2468");
  await guest.getByRole("button", { name: "Consultar información" }).click();
  await expect(
    guest.getByText("Consulta profesional · solo lectura"),
  ).toBeVisible();
  await expect(
    guest.locator("aside").getByRole("button", { name: "Salud", exact: true }),
  ).toHaveCount(0);
  await expect(
    guest.getByLabel("Padres y cuidadores: nombres, parentesco y contacto"),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Revocar acceso", exact: true })
    .click();
  await guest.reload();
  await expect(
    guest.getByRole("button", { name: "Iniciar sesión" }),
  ).toBeVisible();
  await context.close();
  await page.getByRole("button", { name: "Auditoría", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar respaldo JSON" }).click();
  expect((await backup).suggestedFilename()).toContain(".json");
});
