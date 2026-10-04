import {test,expect} from '@playwright/test';
test('expired trial disables content actions while preserving navigation and downloads',async({page,baseURL})=>{
  const origin=new URL(baseURL!).origin;
  const status=await (await page.request.get('/api/status')).json();
  const credentials={correo:'mobile@example.test',password:'QaPassword!2026'};
  const auth=await page.request.post('/api/'+(status.setup?'setup':'login'),{data:status.setup?{...credentials,nombre:'QA',familia:'Trial QA'}:credentials,headers:{Origin:origin}});expect(auth.ok()).toBeTruthy();
  const existing=await (await page.request.get('/api/children')).json();
  if(!existing.length) await page.request.post('/api/children',{data:{primer_nombre:'QA',fecha_nacimiento:'2020-01-01',sexo_referencia:'masculino'},headers:{Origin:origin}});
  // Simulate the expired server response without mutating real trial dates.
  await page.route('**/api/me',async route=>{const response=await route.fetch();const data=await response.json();data.subscription={...data.subscription,subscription_status:'expired',commercial_exempt:0,can_write:false,trial_ends_at:'2000-01-01T00:00:00Z'};await route.fulfill({response,json:data});});
  await page.goto('/');
  await expect(page.getByText('Tu prueba gratuita de 14 días ha terminado. Suscríbete para continuar organizando la salud de tu familia.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Registrar bitácora'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Descargar informe PDF',exact:true})).toBeEnabled();
  await page.locator('.sidebar').getByRole('button',{name:'Perfil',exact:true}).click();await expect(page.getByRole('button',{name:'Editar perfil',exact:true})).toHaveCount(0);
  await page.locator('.sidebar').getByRole('button',{name:'Salud',exact:true}).click();await expect(page.getByRole('button',{name:'Agregar',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Activar suscripción',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('No se realizará ningún cobro');
});
