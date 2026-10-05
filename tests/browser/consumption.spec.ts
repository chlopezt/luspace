import {test,expect} from '@playwright/test';
test('global consumption dashboard and bell are accessible and mobile-safe',async({page})=>{
 const report={generated_at:new Date().toISOString(),storage:{committed_bytes:1200000,used_bytes:1200000,reserved_bytes:0,reservation_count:0,limit_bytes:8000000000,r2_metadata_bytes:1200000,files:7,level:'normal',uploads_blocked:false},d1:{attachment_bytes:500000,attachment_limit_bytes:200000000},ai:{requests_today:3,daily_request_limit:10},families:[{id:'test',nombre:'Familia de ejemplo',bytes:1200000,files:7,storage_limit_bytes:52428800,commercial_exempt:0}]};
 let items=[{key:'family-new:test',title:'Nueva familia registrada',detail:'Familia de ejemplo',severity:'info',target:'families',read:false},{key:'global-storage:warning',title:'Almacenamiento global por revisar',detail:'Aviso preventivo de capacidad.',severity:'warning',target:'consumption',read:false}];
 await page.route('**/api/platform/me',r=>r.fulfill({json:{nombre:'Administrador QA'}}));
 await page.route('**/api/platform/overview?*',r=>r.fulfill({json:{families:[],totals:{familias:1,miembros_activos:1,archivos:7,storage_used_bytes:1200000,trials_ending_soon:0,family_sessions:0,platform_sessions:1},generated_at:new Date().toISOString(),statuses:[],roles:[],logins:[],registrations:[],monthly_files:[],file_types:[],activity:[]}}));
 await page.route('**/api/platform/consumption',r=>r.fulfill({json:report}));
 await page.route('**/api/platform/notifications',r=>r.fulfill({json:{items,unread:items.filter(i=>!i.read).length,scope:'Últimos 30 días y alertas vigentes'}}));
 await page.route('**/api/platform/notifications/read',r=>{const keys=r.request().postDataJSON().keys;items=items.map(i=>({...i,read:i.read||keys.includes(i.key)}));return r.fulfill({json:{ok:true}});});
 await page.goto('/admin#consumption');
 await expect(page.getByRole('heading',{name:'Consumo global y alertas',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Consumo informado por Cloudflare',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Notificaciones · 2 sin leer',exact:true})).toBeVisible();
 for(const width of [320,375,414,1024,1440]){
  await page.setViewportSize({width,height:950});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({path:'../work/consumption-'+width+'.png',fullPage:true});
 }
 await page.getByRole('button',{name:'Oscuro',exact:true}).click();
 await page.screenshot({path:'../work/consumption-dark.png',fullPage:true});
 await page.getByRole('button',{name:'Notificaciones · 2 sin leer',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText('Nueva familia registrada');
 for(const width of [320,375,414,1440]){
  await page.setViewportSize({width,height:950});
  await expect.poll(()=>dialog.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 }
 await dialog.getByRole('button',{name:'Marcar todas como leídas',exact:true}).click();
 await expect(dialog).toContainText('0 sin leer');
 await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('button',{name:'Notificaciones',exact:true}).click();
 await expect(dialog).toContainText('0 sin leer');
 await dialog.getByRole('button',{name:'Ver sección',exact:true}).last().click();
 await expect(dialog).toHaveCount(0);
 await expect(page).toHaveURL(/#consumption$/);
});
