import {test,expect} from '@playwright/test';
async function family(page:any){
 await page.route('**/api/**',(r:any)=>r.fulfill({json:[]}));
 await page.route('**/api/status',(r:any)=>r.fulfill({json:{setup:false,registration:true}}));
 await page.route('**/api/me',(r:any)=>r.fulfill({json:{id:'qa-user',nombre:'QA',familia:'QA',rol:'superadmin',subscription:{commercial_exempt:1},platform_controls:{blocked_modules:[]}}}));
 await page.route('**/api/subscription',(r:any)=>r.fulfill({json:{commercial_exempt:1}}));
 await page.route('**/api/children',(r:any)=>r.fulfill({json:[{id:'qa-child',primer_nombre:'QA',fecha_nacimiento:'2020-01-01',rnd_habilitado:0}]}));
 await page.route('**/api/export',(r:any)=>r.fulfill({json:{child:{id:'qa-child',primer_nombre:'QA'},sections:{},created:new Date().toISOString()}}));
}
test('outdated PDF module reloads once, restores selection and hides technical URLs on persistent failure',async({page})=>{
 page.setDefaultTimeout(10000);await family(page);
 await page.route('**/api/children',r=>r.fulfill({json:[{id:'qa-child',primer_nombre:'QA',fecha_nacimiento:'2020-01-01',rnd_habilitado:0},{id:'qa-child-2',primer_nombre:'QA segundo',fecha_nacimiento:'2021-01-01',rnd_habilitado:0}]}));
 let navigations=0,exportCalls=0;
 page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
 page.on('request',r=>{if(r.url().endsWith('/api/export'))exportCalls++;});
 await page.route('**/src/report.tsx*',r=>r.abort('failed'));
 await page.route('**/app-version.json',r=>r.fulfill({json:{version:'qa-new-deployment'}}));
 await page.goto('/');await page.locator('.child-selector select').selectOption('qa-child-2');await page.locator('.page > header').getByRole('button',{name:'Descargar informe PDF',exact:true}).click();
 let modal=page.getByRole('dialog',{name:'Descargar informe PDF',exact:true});
 await modal.getByLabel('Anamnesis',{exact:true}).uncheck();await modal.getByLabel('Perfil clínico',{exact:true}).check();
 await modal.getByRole('button',{name:'Descargar PDF',exact:true}).click();
 await expect(page.getByText('LuSpace se actualizó. Conservamos tu selección; pulsa Descargar PDF para continuar.',{exact:true})).toBeVisible();
 expect(navigations).toBe(2);expect(exportCalls).toBe(1);
 await expect(page.locator('.child-selector select')).toHaveValue('qa-child-2');
 modal=page.getByRole('dialog',{name:'Descargar informe PDF',exact:true});
 await expect(modal.getByLabel('Perfil clínico',{exact:true})).toBeChecked();await expect(modal.getByLabel('Anamnesis',{exact:true})).not.toBeChecked();
 await modal.getByRole('button',{name:'Descargar PDF',exact:true}).click();
 await expect(modal.getByRole('status').filter({hasText:'Generando informe…'})).toBeVisible();
 await expect(modal.getByText('No se pudo cargar el generador PDF. Revisa tu conexión y recarga la página para intentarlo nuevamente.',{exact:true})).toBeVisible();
 await expect(modal.getByRole('button',{name:'Descargar PDF',exact:true})).toBeEnabled();
 expect(navigations).toBe(2);expect(exportCalls).toBe(2);
 expect(await modal.innerText()).not.toContain('Failed to fetch');expect(await modal.innerText()).not.toContain('/src/report');
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('luspace:pdf-reload')!));expect(saved.version).toBe('qa-new-deployment');
});
test('PDF module helper retries transient failures, preserves real errors and never reloads unsaved work',async({page})=>{
 await family(page);await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {loadPdfModule,isChunkLoadError,recoverPdfDeployment}=await import(/* @vite-ignore */ '/src/pdfRecovery.ts');
  let attempts=0,realAttempts=0;
  const value=await loadPdfModule(async()=>{attempts++;if(attempts===1)throw new TypeError('Failed to fetch dynamically imported module: https://example.test/old.js');return 'loaded';});
  let message='';try{await loadPdfModule(async()=>{realAttempts++;throw new Error('Invalid report data');});}catch(e){message=(e as Error).message;}
  const safe=await recoverPdfDeployment({actor:'qa-user',child:'qa-child',selected:['perfil'],photo:false},()=>false);
  return {value,attempts,realAttempts,message,safe,matched:isChunkLoadError(new TypeError('Importing a module script failed.'))};
 });
 expect(result).toEqual({value:'loaded',attempts:2,realAttempts:1,message:'Invalid report data',safe:false,matched:true});
});
test('report still generates and downloads a real PDF when modules load successfully',async({page})=>{
 await family(page);await page.goto('/');
 await page.locator('.page > header').getByRole('button',{name:'Descargar informe PDF',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Descargar informe PDF',exact:true});
 const download=page.waitForEvent('download');
 await modal.getByRole('button',{name:'Descargar PDF',exact:true}).click();
 const file=await download;expect(file.suggestedFilename()).toMatch(/^Informe-LuSpace_QA_\d{2}-\d{2}-\d{4}\.pdf$/);
 const {readFile}=await import('node:fs/promises');const bytes=await readFile((await file.path())!);
 expect(bytes.subarray(0,5).toString()).toBe('%PDF-');await expect(modal).toHaveCount(0);
});
