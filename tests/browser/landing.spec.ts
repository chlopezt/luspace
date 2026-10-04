import {test,expect} from '@playwright/test';

test('public presentation is responsive and links to login and signup without exposing patient data',async({page})=>{
  await page.goto('/presentacion');
  await expect(page.getByRole('heading',{level:1})).toContainText('Todo su cuidado');
  for(const width of [320,375,414,1280]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('header').getByRole('link',{name:'Iniciar sesión'})).toBeVisible();
    await expect(page.locator('header').getByRole('link',{name:/Probar 14 días gratis/})).toBeVisible();
  }
  await page.getByRole('link',{name:'Características',exact:true}).click();
  await expect(page).toHaveURL(/#caracteristicas$/);
  await page.locator('header').getByRole('link',{name:'Iniciar sesión'}).click();
  await expect(page).toHaveURL(/\/login$/);
});
