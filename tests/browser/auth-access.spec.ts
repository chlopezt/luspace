import {test,expect} from '@playwright/test';

test('Google button, return navigation and trial CTA work on narrow login and signup screens',async({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{setup:false,registration:true,google:true}}));
  await page.route('**/api/me',route=>route.fulfill({status:401,json:{error:'Inicia sesión'}}));
  let posted:any;
  await page.route('**/api/auth/google/start',route=>{posted=route.request().postDataJSON();return route.fulfill({json:{url:'/oauth-test-return'}})});
  await page.goto('/login');
  await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeEnabled();
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
  await page.getByLabel('Tu nombre').fill('Familia QA');
  await page.getByLabel('Nombre de la familia').fill('Ejemplo');
  await page.getByLabel('Correo',{exact:true}).fill('no-transmitir@example.test');
  await page.getByLabel('Contraseña (mínimo 12 caracteres)',{exact:true}).fill('NoEnviarEstaClave2026');
  await page.getByRole('button',{name:'Continuar con Google'}).click();
  await expect(page).toHaveURL(/oauth-test-return$/);
  expect(posted).toEqual({mode:'register',nombre:'Familia QA',familia:'Ejemplo'});
});
