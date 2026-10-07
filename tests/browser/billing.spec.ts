import {test,expect} from '@playwright/test';
import path from 'node:path';
test('billing modal is compact, consent gated and responsive; cancellation keeps history',async({page})=>{
  test.skip(!process.env.PW_CONTEXTUAL_PREVIEW,'Requires the isolated fictional preview');
  page.setDefaultTimeout(12000);
  let subscriptions:any[]=[],payments:any[]=[];
  const state=()=>({enabled:true,mode:'test',amount:5938,can_manage:true,subscriptions,payments});
  await page.route('**/api/billing',route=>route.fulfill({json:state()}));
  await page.route('**/api/billing/refresh',route=>{
    subscriptions=[{id:'fictional',state:'authorized',amount_clp:5938,paid_until:'2026-11-07T12:00:00Z'}];
    payments=[{id:'fictional-payment',state:'approved',amount_clp:5938,created_at:'2026-10-07T12:00:00Z'}];
    return route.fulfill({json:state()});
  });
  await page.route('**/api/billing/fictional/cancel',route=>{subscriptions[0].state='cancelled';return route.fulfill({json:state()});});
  await page.goto('/login');
  await page.locator('input[name=correo]').fill('familia@preview.luspace.test');
  await page.locator('input[name=password]').fill('VistaPrevia!2026');
  await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.locator('.sidebar').getByRole('button',{name:/^(Mi suscripción|Activar suscripción)$/}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByText('Entorno de pruebas · Sin cobros reales. Usa solo cuentas y tarjetas ficticias.',{exact:true})).toBeVisible();
  const checkout=dialog.getByRole('button',{name:'Continuar en Mercado Pago (prueba)',exact:true});
  await expect(checkout).toBeDisabled();
  await dialog.getByRole('checkbox').check();await expect(checkout).toBeEnabled();
  // Do not navigate or pay: UI fixture only. Backend flow tested separately with a fake provider.
  for(const width of [320,375,414,1280]){
    await page.setViewportSize({width,height:900});
    await expect(dialog).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    expect(overflow).toBe(false);
  }
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:path.resolve('../work/billing-preview-desktop.png')});
  subscriptions=[{id:'fictional',state:'pending',amount_clp:5938}];
  await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.locator('.sidebar').getByRole('button',{name:/^(Mi suscripción|Activar suscripción)$/}).click();
  await dialog.getByRole('button',{name:'Actualizar estado',exact:true}).click();
  await expect(dialog.getByText('Aprobado',{exact:true})).toBeVisible();
  page.once('dialog',d=>d.accept());
  await dialog.getByRole('button',{name:'Cancelar suscripción de prueba',exact:true}).click();
  await expect(dialog.getByText('Cancelada',{exact:true})).toBeVisible();
  await expect(dialog.getByText('Aprobado',{exact:true})).toBeVisible();
  await page.setViewportSize({width:375,height:900});
  await page.screenshot({path:path.resolve('../work/billing-preview-mobile.png')});
});
