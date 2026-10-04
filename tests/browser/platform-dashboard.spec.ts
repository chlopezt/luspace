import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
test('platform dashboard navigation, charts, theme and mobile containment',async({page,baseURL})=>{
  if(!process.env.PLATFORM_QA_DB) throw new Error('Run against an isolated local DB with PLATFORM_QA_DB set.');
  const origin=new URL(baseURL!).origin;
  const post=async(path:string,data:any)=>{const r=await page.request.post('/api/'+path,{data,headers:{Origin:origin}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
  const status=await (await page.request.get('/api/status')).json();
  if(status.setup) await post('setup',{nombre:'Admin QA',familia:'Familia QA',correo:'dashboard@example.test',password:'QaPassword!2026'});else await post('login',{correo:'dashboard@example.test',password:'QaPassword!2026'});
  const me=await (await page.request.get('/api/me')).json();
  const db=new DatabaseSync(process.env.PLATFORM_QA_DB);
  try{
    db.prepare('INSERT OR IGNORE INTO administradores_plataforma(usuario_id) VALUES(?)').run(me.id);
    for(const [i,state] of ['active','trial','expired','past_due','canceled'].entries()){
      db.prepare("INSERT OR IGNORE INTO familias(id,nombre) VALUES(?,?)").run('qa-platform-'+i,'Familia ejemplo '+(i+1));
      db.prepare("UPDATE familias SET subscription_status=?,trial_ends_at=?,commercial_exempt=0 WHERE id=?").run(state,state==='expired'?'2000-01-01T00:00:00Z':new Date(Date.now()+2*86400000).toISOString(),'qa-platform-'+i);
    }
    db.prepare('UPDATE familias SET commercial_exempt=1,subscription_status=? WHERE id=?').run('active',me.familia_id);
    db.prepare("INSERT OR IGNORE INTO ninos(id,familia_id,primer_nombre,fecha_nacimiento) VALUES('qa-chart-child',?,'PRIVATE-QA-CHILD','2020-01-01')").run(me.familia_id);
    for(const [i,mime] of ['application/pdf','image/jpeg','image/png'].entries()) db.prepare("INSERT OR IGNORE INTO archivos(id,familia_id,nino_id,modulo,nombre,mime,bytes,r2_key) VALUES(?,?,'qa-chart-child','salud','PRIVATE-QA-FILE',?,? ,?)").run('qa-chart-file-'+i,me.familia_id,mime,(i+1)*100000,'d1:qa-chart-file-'+i);
  }finally{db.close();}
  const members=await (await page.request.get('/api/users')).json();
  if(!members.some((u:any)=>u.correo==='managed-editor@example.test')) await post('users',{nombre:'Editor de prueba',correo:'managed-editor@example.test',rol:'editor',password:'EditorPassword!2026'});
  if(me.platform_setup_available || !me.platform_admin) await post('platform/enroll',{correo:'platform-dashboard@example.test',password:'AdminPassword!2026',current_password:'QaPassword!2026'});
  await post('platform/login',{correo:'platform-dashboard@example.test',password:'AdminPassword!2026'});
  await page.goto('/admin');await expect(page.locator('.platform-family-card')).toBeVisible();
  await expect(page.getByText('PRIVATE-QA-CHILD',{exact:true})).toHaveCount(0);await expect(page.getByText('PRIVATE-QA-FILE',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Estado de las familias',{exact:true})).toBeVisible();
  await expect(page.getByText('Excepción de continuidad',{exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Período de estadísticas'}).selectOption('90');
  for(const width of [320,375,414,1024,1440]){
    await page.setViewportSize({width,height:950});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
    for(const title of ['Familias','Pruebas y suscripciones','Almacenamiento','Seguridad y actividad','Resumen']){
      if(width<=900) await page.getByRole('button',{name:'Abrir menú de administración',exact:true}).click();
      await page.getByRole('navigation',{name:'Administración de plataforma'}).getByRole('button',{name:title,exact:true}).click();
      await expect(page.getByRole('heading',{name:title,exact:true,level:1})).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),{message:title+' at '+width}).toBeLessThanOrEqual(0);
    }
    await page.screenshot({path:'../work/platform-dashboard-'+width+'.png',fullPage:true});
  }
  await page.getByRole('button',{name:'Oscuro',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.screenshot({path:'../work/platform-dashboard-dark.png',fullPage:true});
  await page.getByRole('button',{name:'Claro',exact:true}).click();
  await page.getByRole('button',{name:'Gestionar Familia QA',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:'Parámetros de la familia',exact:true})).toBeVisible();
  for(const width of [320,375,414,1440]){
    await page.setViewportSize({width,height:950});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
    await expect.poll(()=>dialog.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  }
  await dialog.getByRole('checkbox',{name:'Subir adjuntos',exact:true}).uncheck();
  await dialog.getByRole('textbox',{name:'Motivo del cambio',exact:true}).fill('QA: bloqueo manual de archivos');
  await dialog.getByLabel('Tu contraseña administrativa',{exact:true}).fill('AdminPassword!2026');
  await dialog.getByRole('button',{name:'Guardar parámetros',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('Cambio aplicado');
  const details=await (await page.request.get('/api/platform/families/'+me.familia_id)).json();expect(details.controls.uploads_enabled).toBe(false);
  await dialog.getByRole('checkbox',{name:'Subir adjuntos',exact:true}).check();
  await dialog.getByRole('textbox',{name:'Motivo del cambio',exact:true}).fill('QA: restaurar función de adjuntos');
  await dialog.getByLabel('Tu contraseña administrativa',{exact:true}).fill('AdminPassword!2026');
  await dialog.getByRole('button',{name:'Guardar parámetros',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('Cambio aplicado');
  await dialog.getByRole('button',{name:'Restablecer contraseña',exact:true}).click();
  await dialog.getByLabel('Nueva contraseña familiar (12–128 caracteres)',{exact:true}).fill('UpdatedEditor!2026');
  await dialog.getByRole('textbox',{name:'Motivo del cambio',exact:true}).fill('QA: solicitud de recuperación de acceso');
  await dialog.getByLabel('Tu contraseña administrativa',{exact:true}).fill('AdminPassword!2026');
  await dialog.getByRole('button',{name:'Confirmar acción',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('Cambio aplicado');
  await page.screenshot({path:'../work/platform-family-manager.png',fullPage:true});
  await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
});
