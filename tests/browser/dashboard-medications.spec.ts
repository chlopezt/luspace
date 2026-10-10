import { test, expect, type Page } from '@playwright/test';

let syntheticClient = 0;
async function fixture(page: Page, baseURL: string, doseCount = 1) {
  const origin = new URL(baseURL).origin, suffix = crypto.randomUUID();
  // Isolate synthetic families as separate edge clients without disabling rate limits.
  const clientIp = `192.0.2.${++syntheticClient}`;
  const write = async (path: string, data: unknown, method = 'POST') => {
    const response = await page.request.fetch('/api/' + path, { method, headers: { Origin: origin, 'CF-Connecting-IP': clientIp }, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const status = await (await page.request.get('/api/status')).json();
  const owner = { nombre: 'Synthetic owner', familia: 'Synthetic family', correo: `medicine-${suffix}@example.test`, password: 'SyntheticOwner2026!' };
  await write(status.setup ? 'setup' : 'register', { ...owner, password_confirmation: owner.password, legal_accepted: true, care_authorized: true, legal_version: '2026-10-08-v3' });
  const child = (await write('children', { primer_nombre: 'Synthetic child', fecha_nacimiento: '2020-01-01' })).id;
  const medication = { nombre: 'Tratamiento sintético', dosis: 'Dosis habitual registrada', frecuencia_horas: 8, hora_referencia: new Date(Date.now() - 3600000).toISOString(), fecha_inicio: '2026-01-01', activo: 1 };
  await write('records/medicamentos?child=' + child, medication);
  for (let i = 0; i < doseCount; i++) await write('records/dosis_sos?child=' + child, {
    medicamento: `SOS sintético ${i}`, dosis: `Dosis registrada ${i}`, motivo: 'Fiebre',
    // An old administration without an interval used to render no reminder.
    fecha: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
  });
  return { child, write, suffix, origin, medication };
}
const card = (page: Page) => page.locator('article.medicine');
const toggle = (page: Page) => card(page).getByRole('button', { name: /Dosis SOS recientes/ });
const home = async (page: Page) => { await page.locator('.sidebar').getByRole('button', { name: 'Inicio', exact: true }).click(); await expect(card(page)).toBeVisible(); };

test('history renders actual administrations without intervals, keeps five latest and navigates to existing treatments', async ({ page, baseURL }) => {
  const f = await fixture(page, baseURL!, 6);
  await page.goto('/');
  await expect(card(page).getByText(f.medication.nombre, { exact: true })).toBeVisible();
  await expect(card(page).getByText(f.medication.dosis, { exact: true })).toBeVisible();
  await toggle(page).click();
  await expect(card(page).locator('.sos-history-card')).toHaveCount(5);
  await expect(card(page).locator('.sos-history-card').first()).toContainText('SOS sintético 0');
  await expect(card(page).locator('.sos-history-card').first()).toContainText('Dosis registrada 0');
  await expect(card(page).locator('.sos-history-card time').first()).toHaveAttribute('datetime', /T/);
  await expect(card(page).locator('.sos-history-card time').first()).toHaveText(/\d{2}:\d{2}/);
  await expect(card(page).locator('.sos-count')).toHaveText('6');
  await card(page).getByRole('button', { name: 'Ver historial completo' }).click();
  await expect(page.getByRole('button', { name: 'Dosis SOS / Enfermedad', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await home(page);
  await card(page).getByRole('button', { name: 'Ver tratamientos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tratamientos continuos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await home(page);
  await card(page).getByRole('button', { name: '＋ Agregar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Tratamientos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const rows = await (await page.request.get('/api/records/medicamentos?child=' + f.child)).json();
  expect(rows[0].dosis).toBe(f.medication.dosis);
  expect(rows[0].hora_referencia).toBe(f.medication.hora_referencia);
  expect(rows[0].frecuencia_horas).toBe(f.medication.frecuencia_horas);
});

test('empty history supports keyboard expansion, collapse and an existing SOS registration form', async ({ page, baseURL }) => {
  const f = await fixture(page, baseURL!, 0);
  await page.goto('/');
  await toggle(page).focus();
  await page.keyboard.press('Enter');
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(card(page).getByText('No hay dosis SOS registradas recientemente', { exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(card(page).getByRole('region')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await card(page).getByRole('button', { name: 'Registrar dosis SOS', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dosis SOS / Episodios de enfermedad', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Medicamento', { exact: true }).fill('Nueva dosis sintética');
  await dialog.getByLabel('Dosis entregada', { exact: true }).fill('Dato sintético');
  await dialog.getByLabel('Fecha y hora de administración', { exact: true }).fill('2026-10-09T10:30');
  await dialog.getByLabel('Motivo / síntoma', { exact: true }).selectOption('Fiebre');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await home(page); await toggle(page).click();
  await expect(card(page).getByText('Nueva dosis sintética', { exact: true })).toBeVisible();
  const rows = await (await page.request.get('/api/records/dosis_sos?child=' + f.child)).json();
  expect(rows).toHaveLength(1);
  expect(rows[0].dosis).toBe('Dato sintético');
});

test('SOS loading and retry do not hide active medications or turn errors into an empty history', async ({ page, baseURL }) => {
  await fixture(page, baseURL!);
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  await page.route('**/api/records/dosis_sos?*', async route => {
    if (fail) { await wait; await route.fulfill({ status: 500, json: { error: 'Fallo sintético de carga' } }); }
    else await route.continue();
  });
  await page.goto('/'); await toggle(page).click();
  await expect(card(page).getByText('Cargando dosis SOS…', { exact: true })).toBeVisible();
  await expect(card(page).getByText('Tratamiento sintético', { exact: true })).toBeVisible();
  release();
  await expect(card(page).getByRole('alert')).toContainText('Fallo sintético');
  await expect(card(page).getByText('No hay dosis SOS registradas recientemente', { exact: true })).toHaveCount(0);
  fail = false;
  await card(page).getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(card(page).getByText('SOS sintético 0', { exact: true })).toBeVisible();
});

test('legacy rows with missing date and dose render without inventing those values', async ({ page, baseURL }) => {
  await fixture(page, baseURL!, 0);
  await page.route('**/api/records/dosis_sos?*', route => route.fulfill({ json: [{ id: 'legacy-synthetic', medicamento: 'Registro sintético incompleto', fecha: null }] }));
  await page.goto('/'); await toggle(page).click();
  await expect(card(page).getByText('Registro sintético incompleto', { exact: true })).toBeVisible();
  await expect(card(page).getByText('Fecha y hora no registradas', { exact: true })).toBeVisible();
  await expect(card(page).locator('.sos-history-card time')).toHaveCount(0);
  await expect(card(page).getByText(/^Dosis registrada:/)).toHaveCount(0);
});

test('reader permissions allow history and treatments but hide registration and disable adding', async ({ page, baseURL }) => {
  const f = await fixture(page, baseURL!);
  const email = `reader-${f.suffix}@example.test`;
  const member = await f.write('users', { nombre: 'Synthetic reader', correo: email, rol: 'editor', password: 'SyntheticReader2026!' });
  await f.write('users/' + member.id, { permisos_json: { modules: ['salud'], acciones: ['ver'], sensibles: [], privacidad: [] } }, 'PUT');
  await f.write('logout', {});
  await f.write('login', { correo: email, password: 'SyntheticReader2026!' });
  await page.goto('/'); await toggle(page).click();
  await expect(card(page).getByText('SOS sintético 0', { exact: true })).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Registrar dosis SOS', exact: true })).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: '＋ Agregar', exact: true })).toBeDisabled();
  await card(page).getByRole('button', { name: 'Ver tratamientos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tratamientos continuos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('switching children discards late SOS responses from the previously selected profile', async ({ page, baseURL }) => {
  const f = await fixture(page, baseURL!);
  const other = await f.write('children', { primer_nombre: 'Other synthetic child', fecha_nacimiento: '2020-01-01' });
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/records/dosis_sos?child=' + f.child, async route => {
    await wait;
    await route.fulfill({ json: [{ id: 'late', medicamento: 'Previous profile only', dosis: 'Synthetic', fecha: '2026-10-09T12:00:00Z' }] });
  });
  await page.goto('/');
  await page.locator('.child-selector select').selectOption(f.child);
  await expect(page.locator('.child-selector select')).toHaveValue(f.child);
  await toggle(page).click();
  await expect(card(page).getByText('Cargando dosis SOS…', { exact: true })).toBeVisible();
  await page.locator('.child-selector select').selectOption(other.id);
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  release(); await toggle(page).click();
  await expect(card(page).getByText('No hay dosis SOS registradas recientemente', { exact: true })).toBeVisible();
  await expect(page.getByText('Previous profile only', { exact: true })).toHaveCount(0);
});

test('medication card fits mobile and desktop in both themes and supports reduced motion', async ({ page, baseURL }) => {
  await fixture(page, baseURL!, 6);
  await page.goto('/'); await toggle(page).click();
  await expect(card(page).locator('.sos-history-card')).toHaveCount(5);
  for (const theme of ['light', 'dark']) for (const width of [320, 375, 414, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await card(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
    expect((await card(page).getByRole('button', { name: 'Ver tratamientos', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `/workspace/work/medicine-${theme}-${width}.png`, fullPage: true });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await card(page).locator('.sos-collapse').evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  await card(page).locator('.sos-history').focus();
  await page.keyboard.press('End');
  await expect.poll(() => card(page).locator('.sos-history').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
});

test('members without Health access never request medication or SOS records', async ({ page, baseURL }) => {
  const f = await fixture(page, baseURL!);
  const email = `school-${f.suffix}@example.test`;
  const member = await f.write('users', { nombre: 'Synthetic school member', correo: email, rol: 'editor', password: 'SyntheticSchool2026!' });
  await f.write('users/' + member.id, { permisos_json: { modules: ['escolar'], acciones: ['ver', 'editar'], sensibles: [], privacidad: [] } }, 'PUT');
  await f.write('logout', {}); await f.write('login', { correo: email, password: 'SyntheticSchool2026!' });
  const requests: string[] = [];
  page.on('request', request => { if (/records\/(dosis_sos|medicamentos)/.test(request.url())) requests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Hola, familia/ })).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('guests use the existing shared SOS section without access to other children or registration', async ({ page, baseURL }) => {
  const f = await fixture(page, baseURL!);
  const other = await f.write('children', { primer_nombre: 'Unshared synthetic child', fecha_nacimiento: '2020-01-01' });
  await f.write('records/dosis_sos?child=' + other.id, { medicamento: 'Unshared synthetic SOS', dosis: 'Synthetic', motivo: 'Fiebre', fecha: new Date(Date.now()-60000).toISOString() });
  const share = await f.write('guests?child=' + f.child, { nombre: 'Synthetic guest', hours: 24, modules: ['salud'] });
  await f.write('logout', {}); await f.write('guest/exchange', { token: share.url.split('#')[1] });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dosis SOS / Enfermedad', exact: true }).click();
  await expect(page.locator('.record-card>summary').getByText('SOS sintético 0', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Registrar Dosis SOS/ })).toHaveCount(0);
  await expect(page.getByText('Unshared synthetic SOS', { exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/records/dosis_sos?child=' + other.id)).status()).toBe(404);
  const rows = await (await page.request.get('/api/records/dosis_sos?child=' + f.child)).json();
  expect(rows).toHaveLength(1); expect(rows[0].medicamento).toBe('SOS sintético 0');
});
