import { test, expect } from '@playwright/test';

test('registration form starts an empty family with a trial and stays contained on mobile', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const status = await (await page.request.get('/api/status')).json();
  if (status.setup) {
    const setup = await page.request.post('/api/setup', { headers: { Origin: origin }, data: {
      nombre: 'QA instalación', familia: 'QA inicial', correo: 'install@example.test', password: 'Installation2026!',
    } });
    expect(setup.ok()).toBeTruthy();
    await page.request.post('/api/logout', { headers: { Origin: origin } });
  }
  await page.goto('/login');
  await page.getByRole('link', { name: 'Probar LuSpace durante 14 días' }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByText('Clave de instalación', { exact: true })).toHaveCount(0);
  await page.getByLabel('Tu nombre').fill('QA registro');
  await page.getByLabel('Nombre de la familia').fill('Familia nueva QA');
  await page.getByLabel('Correo', { exact: true }).fill('signup-ui@example.test');
  await page.getByLabel('Contraseña (mínimo 12 caracteres)', { exact: true }).fill('FamiliaSegura2026!');
  await page.getByLabel('Confirmar contraseña').fill('DifferentPassword2026!');
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute('type', 'text');
  for (const width of [320, 375, 414]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Comenzar prueba de 14 días' }).click();
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
  await expect(page.getByLabel('Tu nombre')).toHaveValue('QA registro');
  await page.getByLabel('Confirmar contraseña').fill('FamiliaSegura2026!');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Comenzar prueba de 14 días' }).click();
  await expect(page.getByRole('button', { name: 'Crear primer perfil' })).toBeVisible();
  await expect(page.getByText(/Prueba gratis:.*14 días/)).toBeVisible();
  expect((await (await page.request.get('/api/children')).json()).length).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Crear primer perfil' })).toBeVisible();
});
