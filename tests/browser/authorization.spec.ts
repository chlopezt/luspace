import { test, expect } from '@playwright/test';

test('restricted members see permitted modules and forms without private fields or export actions', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const status = await (await page.request.get('/api/status')).json();
  const suffix = Date.now();
  if (status.setup) {
    const setup = await page.request.post('/api/setup', { headers: { Origin: origin }, data: {
      nombre: 'QA installer', familia: 'QA installation', correo: `install-${suffix}@example.test`, password: 'SyntheticInstaller2026!',
    } });
    expect(setup.status()).toBe(201);
  } else {
    const register = await page.request.post('/api/register', { headers: { Origin: origin }, data: {
      nombre: 'QA owner', familia: 'QA authorization', correo: `owner-${suffix}@example.test`, password: 'SyntheticOwner2026!',
      password_confirmation: 'SyntheticOwner2026!', legal_accepted: true, legal_version: '2026-10-08-v3',
    } });
    expect(register.status()).toBe(201);
  }
  const child = await page.request.post('/api/children', { headers: { Origin: origin }, data: {
    primer_nombre: 'QA authorized', fecha_nacimiento: '2020-01-01', rut: '12.345.678-5', diagnostico: 'PRIVATE_DIAGNOSIS',
    contacto_emergencia_principal_telefono: 'PRIVATE_PHONE',
  } });
  expect(child.status()).toBe(201);
  const email = `member-${suffix}@example.test`;
  const member = await page.request.post('/api/users', { headers: { Origin: origin }, data: {
    nombre: 'QA member', correo: email, password: 'SyntheticMember2026!', rol: 'editor',
  } });
  expect(member.status()).toBe(201);
  const { id } = await member.json();
  const permissions = await page.request.put('/api/users/' + id, { headers: { Origin: origin }, data: {
    permisos_json: { modules: ['perfil', 'salud'], acciones: ['ver', 'editar'], sensibles: [], privacidad: ['rut', 'telefono', 'diagnosticos', 'archivos'] },
  } });
  expect(permissions.status()).toBe(200);
  await page.request.post('/api/logout', { headers: { Origin: origin } });
  const login = await page.request.post('/api/login', { headers: { Origin: origin }, data: {
    correo: email, password: 'SyntheticMember2026!',
  } });
  expect(login.status()).toBe(200);
  const forbiddenRequests: string[] = [], errors: string[] = [];
  page.on('response', response => { if (response.status() === 403) forbiddenRequests.push(response.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hola, familia.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hoy en el colegio' })).toHaveCount(0);
  await expect(page.locator('.sidebar').getByRole('button', { name: 'Escolar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Descargar informe PDF', exact: true })).toHaveCount(0);
  await page.locator('.sidebar').getByRole('button', { name: 'Perfil', exact: true }).click();
  await expect(page.getByText('PRIVATE_DIAGNOSIS')).toHaveCount(0);
  await expect(page.getByText('PRIVATE_PHONE')).toHaveCount(0);
  await expect(page.getByText('12.345.678-5', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('RUT', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver foto de perfil', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(forbiddenRequests).toEqual([]);
});
