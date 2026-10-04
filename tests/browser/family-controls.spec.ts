import {test,expect} from '@playwright/test';

test('platform quota presets persist independently of active status',async({page})=>{
  let family={id:'quota-qa',nombre:'Familia de prueba',subscription_status:'active',trial_ends_at:null,storage_limit_bytes:52428800,commercial_exempt:0,storage_used_bytes:0,miembros_activos:1,archivos:0,created_at:new Date().toISOString()};
  const controls={blocked_modules:[],ai_enabled:true,uploads_enabled:true,reports_enabled:true};
  await page.route('**/api/platform/me',r=>r.fulfill({json:{nombre:'Admin QA'}}));
  await page.route('**/api/platform/overview?*',r=>r.fulfill({json:{families:[family],totals:{familias:1,miembros_activos:1,archivos:0,storage_used_bytes:0,trials_ending_soon:0,family_sessions:0,platform_sessions:1},generated_at:new Date().toISOString(),statuses:[],roles:[],logins:[],registrations:[],monthly_files:[],file_types:[],audit:[]}}));
  await page.route('**/api/platform/families/quota-qa',async r=>{
    if(r.request().method()==='PUT'){
      const body=r.request().postDataJSON();
      expect(body.subscription_status).toBe('active');
      expect(body.storage_limit_bytes).toBe(1073741824);
      family={...family,...body};
    }
    await r.fulfill({json:{family,controls,members:[]}});
  });
  await page.goto('/admin#families');
  await page.getByRole('button',{name:'Gestionar Familia de prueba',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'50 MB · Prueba',exact:true})).toHaveAttribute('aria-pressed','true');
  await dialog.getByRole('button',{name:'1 GB',exact:true}).click();
  await expect(dialog.getByLabel('Cuota de adjuntos (MiB)')).toHaveValue('1024');
  for(const width of [320,375,414,1280]){
    await page.setViewportSize({width,height:900});
    expect(await dialog.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  }
  await dialog.getByLabel('Motivo del cambio').fill('Ampliar cuota de familia de prueba');
  await dialog.getByLabel('Tu contraseña administrativa').fill('MockOnlyPassword2026');
  await dialog.getByRole('button',{name:'Guardar parámetros',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('Cambio aplicado');
  await expect(dialog.getByRole('button',{name:'1 GB',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('family welcome is neutral and theme stays icon-only across sections',async({page})=>{
  await page.route('**/api/status',r=>r.fulfill({json:{setup:false,registration:true,google:true}}));
  await page.route('**/api/me',r=>r.fulfill({json:{nombre:'Usuario QA',familia:'Familia QA',rol:'superadmin',subscription:{subscription_status:'active',commercial_exempt:1},platform_controls:{blocked_modules:[]}}}));
  await page.route('**/api/children',r=>r.fulfill({json:[]}));
  await page.goto('/');
  await expect(page.getByText('Registra los datos de un niño o niña de tu familia. Podrás editarlos cuando quieras.')).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Luciano');
  for(const section of ['Inicio','Perfil','Salud','Escolar','Anamnesis','Credencial RND','Invitados','Familia y accesos','Auditoría']){
    await page.locator('.sidebar').getByRole('button',{name:section,exact:true}).click();
    await expect(page.locator('header .theme-control span')).toHaveCount(0);
    await page.locator('header').getByRole('button',{name:'Oscuro',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await page.locator('header').getByRole('button',{name:'Claro',exact:true}).click();
  }
});
