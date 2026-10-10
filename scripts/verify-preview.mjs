import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const origin = 'https://review.luspace-review.pages.dev';
process.on('uncaughtException', error => {
  console.error('::error::Vista previa: ' + String(error.message).replaceAll('%', '%25').replaceAll('\n', '%0A'));
  process.exitCode = 1;
});
let status;
for (let attempt = 0; attempt < 15; attempt++) {
  const response = await fetch(origin + '/api/status');
  const revision = await fetch(origin + '/review-revision.json').then(response => response.json()).catch(() => null);
  if (response.ok && revision?.synthetic === true && revision?.commit === process.env.GITHUB_SHA) { status = await response.json(); break; }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
assert(status, 'La API del preview no respondió correctamente.');
assert.equal(status.setup, false, 'El preview debe estar inicializado con datos ficticios.');
assert.equal(status.registration, false, 'El registro público debe estar desactivado.');
assert.equal(status.local, false, 'El preview debe usar Functions y D1 aisladas.');
assert.equal((await fetch(origin + '/api/children')).status, 401);

const chromePath = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch({ ...(chromePath ? { executablePath: chromePath } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin + '/login');
  try { await page.locator('input[type="email"]').fill('familia@preview.luspace.test', { timeout: 15000 }); }
  catch { throw new Error(`Login no disponible: ${page.url()} · ${(await page.locator('body').innerText()).slice(0, 1500)} · ${pageErrors.join('; ')}`); }
  await page.locator('input[type="password"]').fill('VistaPrevia!2026');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  const card = page.locator('article.medicine');
  await card.waitFor();
  await card.getByRole('button', { name: /Dosis SOS recientes/ }).click();
  await card.locator('.sos-history-card').first().waitFor();
  assert(await card.locator('.sos-history-card').count() > 0, 'Debe aparecer el historial ficticio.');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No debe haber desbordamiento horizontal.');
  await card.getByRole('button', { name: 'Ver tratamientos', exact: true }).click();
  await page.getByRole('button', { name: 'Tratamientos continuos', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Tratamientos continuos', exact: true }).getAttribute('aria-pressed'), 'true');
  console.log('Preview verificado: Functions, login ficticio, historial SOS, móvil y navegación.');
} finally { await browser.close(); }
