import {test,expect} from '@playwright/test';
test('RND header icon stays visible on home and modules, with safe empty state',async({page})=>{
 let attached=false;
 await page.route('**/api/**',r=>r.fulfill({json:[]}));
 await page.route('**/api/admin/dashboard',r=>r.fulfill({json:{summary:{members:1,guests:0,sessions:1,files:0,bytes:0},alerts:{rnd_expiring:0,inactive_users:[]},access_series:[],recent:[],guests:[]}}));
 await page.route('**/api/family/settings',r=>r.fulfill({json:null}));
 await page.route('**/api/anamnesis?*',r=>r.fulfill({json:{documento:{}}}));
 await page.route('**/api/status',r=>r.fulfill({json:{setup:false,registration:true,google:true}}));
 await page.route('**/api/me',r=>r.fulfill({json:{id:'qa-user',nombre:'Usuario QA',familia:'Familia QA',rol:'superadmin',subscription:{subscription_status:'active',commercial_exempt:1},platform_controls:{blocked_modules:[]}}}));
 await page.route('**/api/children',r=>r.fulfill({json:[{id:'qa-child',primer_nombre:'Niño de prueba',fecha_nacimiento:'2020-01-01',rnd_habilitado:1}]}));
 await page.route('**/api/records/credenciales_discapacidad?*',r=>r.fulfill({json:attached?[{id:'qa-rnd',nino_id:'qa-child',activo:1,folio:'QA'}]:[]}));
 await page.goto('/');
 const button=page.locator('.page > header').getByRole('button',{name:'Ver credencial RND',exact:true});
  await expect(page.locator('.page > header')).toBeVisible();
  await expect(button).toHaveCount(0);
 attached=true;await page.reload();await expect(button).toBeEnabled();
 const icon=await button.locator('svg').innerHTML();
 for(const width of [1440,320,375,414]){
  await page.setViewportSize({width,height:900});
  for(const section of ['Inicio','Perfil','Salud','Escolar','Anamnesis','Credencial RND','Invitados','Familia y accesos','Auditoría']){
   if(width<=760)await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
   await page.locator('.sidebar').getByRole('button',{name:section,exact:true}).click();
   await expect(button).toBeVisible();await expect(button.locator('svg')).toBeVisible();
   for(const theme of ['Claro','Oscuro','Sistema']){
    const choice=page.locator('.page > header').getByRole('button',{name:theme,exact:true});
    await expect(choice).toBeVisible();await expect(choice.locator('svg')).toBeVisible();
    await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');
   }
   expect(await button.locator('svg').innerHTML()).toBe(icon);
   const size=await button.locator('svg').boundingBox();
   expect(size?.width).toBe(20);expect(size?.height).toBe(20);
   if(width<=760){
    const rect=await button.boundingBox();
    const header=await page.locator('.page > header').boundingBox();
    expect(Math.abs((size!.x+size!.width/2)-(rect!.x+rect!.width/2))).toBeLessThan(0.6);
    expect(Math.abs((size!.y+size!.height/2)-(rect!.y+rect!.height/2))).toBeLessThan(0.6);
    expect(Math.abs((rect!.y+rect!.height/2)-(header!.y+header!.height/2))).toBeLessThan(0.6);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
 await button.click();await expect(page.getByRole('dialog',{name:'Credencial RND',exact:true})).toBeVisible();
});
