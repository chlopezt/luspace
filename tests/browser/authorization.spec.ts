import { test, expect, type Page } from '@playwright/test';

async function syntheticFamily(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin, suffix = crypto.randomUUID();
  const status = await (await page.request.get('/api/status')).json();
  const data = { nombre: 'Synthetic owner', familia: 'Synthetic family', correo: `owner-${suffix}@example.test`, password: 'SyntheticOwner2026!' };
  const response = await page.request.post(status.setup ? '/api/setup' : '/api/register', {
    headers: { Origin: origin }, data: { ...data, password_confirmation: data.password, legal_accepted: true, legal_version: '2026-10-08-v3' },
  });
  expect(response.status()).toBe(201);
  return { origin, suffix };
}

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

test('unassigned users get a clear access notice and can change their own password without clinical access', async ({ page, baseURL }) => {
  const { origin, suffix } = await syntheticFamily(page, baseURL!);
  const email = `unassigned-${suffix}@example.test`;
  const member = await page.request.post('/api/users', { headers: { Origin: origin }, data: {
    nombre: 'Synthetic unassigned', correo: email, password: 'SyntheticMember2026!', rol: 'editor',
  } });
  expect(member.status()).toBe(201);
  const { id } = await member.json();
  expect((await page.request.put('/api/users/' + id, { headers: { Origin: origin }, data: {
    permisos_json: { modules: [], acciones: [], sensibles: [], privacidad: [] },
  } })).status()).toBe(200);
  await page.request.post('/api/logout', { headers: { Origin: origin } });
  expect((await page.request.post('/api/login', { headers: { Origin: origin }, data: { correo: email, password: 'SyntheticMember2026!' } })).status()).toBe(200);
  const errors: string[] = [], forbidden: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() === 403) forbidden.push(response.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Acceso pendiente de autorización' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear primer perfil', exact: true })).toHaveCount(0);
  await page.locator('.sidebar').getByRole('button', { name: 'Familia y accesos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cambiar mi contraseña', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configurar permisos', exact: true })).toHaveCount(0);
  await page.getByLabel('Contraseña actual', { exact: true }).fill('SyntheticMember2026!');
  await page.getByLabel('Nueva contraseña (mínimo 12 caracteres)', { exact: true }).fill('SyntheticUpdated2026!');
  await page.getByRole('button', { name: 'Cambiar y cerrar sesiones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cambiar mi contraseña', exact: true })).toHaveCount(0);
  const login = await page.request.post('/api/login', { headers: { Origin: origin }, data: { correo: email, password: 'SyntheticUpdated2026!' } });
  expect(login.status()).toBe(200);
  expect(await (await page.request.get('/api/children')).json()).toEqual([]);
  expect(errors).toEqual([]);
  expect(forbidden).toEqual([]);
});

test('owner can explicitly restore empty permissions before creating children and guest navigation stays scoped', async ({ page, baseURL }) => {
  const { origin, suffix } = await syntheticFamily(page, baseURL!);
  const member = await page.request.post('/api/users', { headers: { Origin: origin }, data: {
    nombre: 'Synthetic pending', correo: `pending-${suffix}@example.test`, password: 'SyntheticMember2026!', rol: 'editor',
  } });
  expect(member.status()).toBe(201);
  const memberId = (await member.json()).id;
  expect((await page.request.put('/api/users/' + memberId, { headers: { Origin: origin }, data: {
    permisos_json: { modules: [], acciones: [], sensibles: [], privacidad: [] },
  } })).status()).toBe(200);
  await page.goto('/');
  await page.locator('.sidebar').getByRole('button', { name: 'Familia y accesos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi familia y accesos', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cambiar mi contraseña', exact: true })).toBeVisible();
  await page.locator('article.card').filter({ hasText: 'Synthetic pending' }).getByRole('button', { name: 'Configurar permisos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Permisos de Synthetic pending', exact: true });
  await expect(dialog.locator('input:checked')).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: 'Salud', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'ver', exact: true }).check();
  await dialog.getByRole('button', { name: 'Guardar permisos', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const users = await (await page.request.get('/api/users')).json();
  const restored = JSON.parse(users.find((u: { id: string }) => u.id === memberId).permisos_json);
  expect(restored.modules).toEqual(['salud']);
  expect(restored.acciones).toEqual(['ver']);
  const children: string[] = [];
  for (const name of ['Authorized synthetic', 'Other synthetic']) {
    const response = await page.request.post('/api/children', { headers: { Origin: origin }, data: {
      primer_nombre: name, fecha_nacimiento: '2020-01-01', rut: '12.345.678-5', diagnostico: 'PRIVATE_PROFILE_DIAGNOSIS',
    } });
    expect(response.status()).toBe(201);
    children.push((await response.json()).id);
  }
  const share = await page.request.post('/api/guests?child=' + children[0], { headers: { Origin: origin }, data: {
    nombre: 'Synthetic guest', hours: 24, modules: ['salud'],
  } });
  expect(share.status()).toBe(201);
  const bearer = (await share.json()).url.split('#')[1];
  await page.request.post('/api/logout', { headers: { Origin: origin } });
  expect((await page.request.post('/api/guest/exchange', { headers: { Origin: origin }, data: { token: bearer } })).status()).toBe(200);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await expect(page.locator('.child-selector option')).toHaveCount(1);
  await expect(page.locator('.child-selector option')).toHaveText('Authorized synthetic');
  await expect(page.locator('.sidebar').getByRole('button', { name: 'Perfil', exact: true })).toHaveCount(0);
  await expect(page.locator('.sidebar').getByRole('button', { name: 'Familia y accesos', exact: true })).toHaveCount(0);
  await expect(page.getByText('PRIVATE_PROFILE_DIAGNOSIS', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Descargar informe PDF', exact: true })).toBeVisible();
  expect((await page.request.get('/api/records/consultas_medicas?child=' + children[1])).status()).toBe(404);
  expect(errors).toEqual([]);
});
