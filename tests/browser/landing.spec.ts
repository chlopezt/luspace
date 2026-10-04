import {test,expect} from '@playwright/test';

test('public presentation is responsive and links to login and signup without exposing patient data',async({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{setup:false,registration:true,google:false}}));
  await page.route('**/api/me',route=>route.fulfill({status:401,json:{error:'Inicia sesión'}}));
  await page.goto('/presentacion');
  await expect(page.getByRole('heading',{level:1})).toContainText('Todo su cuidado');
  await expect(page.locator('#precios')).toContainText('$4.990');
  await expect(page.locator('#precios')).toContainText('mensual + IVA');
  await expect(page.locator('#precios')).toContainText('$0');
  for(const width of [320,375,414,1280]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.evaluate(()=>document.querySelector('.lp-header')!.getBoundingClientRect().bottom <= document.querySelector('.lp-hero')!.getBoundingClientRect().top)).toBe(true);
    await expect(page.locator('header').getByRole('link',{name:'Iniciar sesión'})).toBeVisible();
    await expect(page.locator('header').getByRole('link',{name:/Probar 14 días gratis/})).toBeVisible();
  }
  await page.getByRole('link',{name:'Características',exact:true}).click();
  await expect(page).toHaveURL(/#caracteristicas$/);
  await page.locator('header').getByRole('link',{name:'Iniciar sesión'}).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('link',{name:'Volver al inicio',exact:true})).toBeVisible();
  await expect(page.locator('.google-signin img')).toHaveAttribute('src','/brand/google-g.png');
  await page.getByRole('link',{name:'LuSpace, volver al inicio'}).click();
  await expect(page).toHaveURL(/\/presentacion$/);
});
