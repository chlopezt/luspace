import {test,expect} from '@playwright/test';

test('legal documents are public, dismiss startup loading and fit mobile',async({page})=>{
  for(const path of ['/terminos','/privacidad']){
    await page.goto(path);
    await expect(page.locator('.legal-document h1')).toBeVisible();
    await expect(page.getByRole('status',{name:'Cargando LuSpace'})).toHaveCount(0);
    for(const width of [320,375,414,1280]){
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
});

test('Google button, return navigation and trial CTA work on narrow login and signup screens',async({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{setup:false,registration:true,google:true}}));
  await page.route('**/api/me',route=>route.fulfill({status:401,json:{error:'Inicia sesión'}}));
  let posted:any;
  await page.route('**/api/auth/google/start',route=>{posted=route.request().postDataJSON();return route.fulfill({json:{url:'/oauth-test-return'}})});
  await page.goto('/login');
  await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeEnabled();
  await expect(page.locator('.auth-trial-badge')).toHaveText('Familias nuevas: 14 días gratis · $0');
  await expect(page.locator('.auth-card')).not.toContainText('50 MB');
  await page.getByRole('button',{name:'¿Olvidaste tu contraseña?'}).click();
  await expect(page.getByRole('dialog')).toContainText('Si olvidaste tu contraseña, pide al administrador de tu familia que restablezca tu acceso.');
  await page.getByRole('button',{name:'Entendido'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.auth-trial').getByRole('link')).toContainText('Probar LuSpace durante 14 días');
  await expect.poll(()=>page.locator('.google-signin img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
  for(const width of [320,375,414,1280]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole('link',{name:'Volver al inicio',exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'Continuar con Google'}).click();
  await expect(page).toHaveURL(/oauth-test-return$/);
  expect(posted).toEqual({mode:'login'});
  await page.goto('/registro');
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  await page.getByRole('button',{name:'Continuar con Google'}).click();
  await expect(page).toHaveURL(/registro$/);
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await expect(page.getByLabel('Confirmar contraseña')).toBeVisible();
  for(const width of [320,375,414,1280]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByLabel('Tu nombre').fill('Familia QA');
  await page.getByLabel('Nombre de la familia').fill('Ejemplo');
  await page.getByLabel('Correo',{exact:true}).fill('no-transmitir@example.test');
  await page.getByLabel('Contraseña (mínimo 12 caracteres)',{exact:true}).fill('NoEnviarEstaClave2026');
  await page.getByRole('button',{name:'Continuar con Google'}).click();
  await expect(page).toHaveURL(/oauth-test-return$/);
  expect(posted).toEqual({mode:'register',nombre:'Familia QA',familia:'Ejemplo',legal_accepted:true,care_authorized:true,legal_version:'2026-10-08-v1'});
});
