import {test,expect,type Page} from '@playwright/test';
async function fixture(page:Page,readonly=false){
 await page.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
 await page.route('**/api/**',r=>r.fulfill({json:[]}));
 await page.route('**/api/status',r=>r.fulfill({json:{setup:false,registration:true}}));
 await page.route('**/api/subscription',r=>r.fulfill({json:{subscription_status:'active',commercial_exempt:1,can_write:true}}));
 await page.route('**/api/me',r=>r.fulfill({json:{id:'qa',nombre:'QA',familia:'QA',rol:readonly?'readonly':'editor',permisos_json:JSON.stringify({acciones:readonly?['ver']:['ver','crear','editar','eliminar','adjuntar','descargar']}),subscription:{subscription_status:'active',commercial_exempt:1},platform_controls:{blocked_modules:[],ai_enabled:false}}}));
 await page.route('**/api/children',r=>r.fulfill({json:[{id:'child',primer_nombre:'QA',fecha_nacimiento:'2020-01-01'}]}));
 await page.route('**/api/records/medicamentos?*',r=>r.fulfill({json:[{id:'m1',nombre:'Medicamento de nombre largo',dosis:'1 pastilla 10 mg',activo:1,fecha_inicio:'2026-01-01',hora_referencia:'2026-10-06T13:40:00Z',frecuencia_horas:24},{id:'m2',nombre:'Otro medicamento',dosis:'25 mcg',activo:1,fecha_inicio:'2026-01-01',hora_referencia:'2026-10-06T14:00:00Z',frecuencia_horas:24}]}));
  await page.route('**/api/records/consultas_medicas?*',r=>r.fulfill({json:[{id:'late',fecha:'2026-10-20T15:00:00Z',especialidad:'Neurología',medico_nombre:'Futuro lejano',motivo_consulta:'Seguimiento'},{id:'old',fecha:'2026-10-01T15:00:00Z',especialidad:'Pediatría',medico_nombre:'Pasado antiguo'},{id:'near',fecha:'2026-10-08T15:00:00Z',especialidad:'Laboratorio / Toma de Muestras con un título muy largo',medico_nombre:'Futuro cercano',motivo_consulta:'Control detallado'},{id:'recent',fecha:'2026-10-05T15:00:00Z',especialidad:'Nutrición',medico_nombre:'Pasado reciente'}]}));
 await page.route('**/api/files?*',r=>r.fulfill({json:[{id:'pdf',nombre:'Examen pediátrico.pdf',mime:'application/pdf',bytes:25}]}));
 await page.route('**/api/files/pdf',r=>r.fulfill({contentType:'application/pdf',body:'%PDF-1.4\nDocumento QA'}));
 await page.goto('/');
}
test('dashboard lists align at mobile and desktop widths without countdown',async({page})=>{
 await fixture(page);
 await expect(page.locator('.medication-list li')).toHaveCount(2);
 await expect(page.locator('.dose-badge')).toHaveCount(0);
 for(const width of [320,375,414,1280]){
  await page.setViewportSize({width,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const times=await page.locator('.medication-list time').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().right));
  expect(Math.abs(times[0]-times[1])).toBeLessThan(1);
  await expect(page.locator('.appointment-copy').first()).toContainText('Laboratorio / Toma de Muestras');
 }
});
test('consultations collapse, sort both categories and offer mobile PDF actions',async({page})=>{
 await fixture(page);await page.setViewportSize({width:375,height:900});
 await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:'Salud',exact:true}).click();
 await page.getByRole('button',{name:'Consultas médicas',exact:true}).click();
 const summaries=page.locator('.consultation-summary');
 await expect(summaries).toHaveCount(2);
 await expect(summaries.first()).toContainText('Futuro cercano');
 await expect(page.locator('.consultation-body').first()).not.toBeVisible();
 await summaries.first().click();
 await expect(page.locator('.consultation-body').first()).toContainText('Control detallado');
 await expect(page.locator('.consultation-body').first().getByRole('button',{name:'Editar',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Realizadas (2)',exact:true}).click();
 await expect(summaries.first()).toContainText('Pasado reciente');
 await expect(summaries.last()).toContainText('Pasado antiguo');
 await page.locator('.attachments').getByText('Vista previa',{exact:true}).click();
 await expect(page.locator('.pdf-preview-card').getByRole('link',{name:'Ver PDF',exact:true})).toBeVisible();
 await expect(page.locator('.pdf-preview-card').getByRole('link',{name:'Descargar PDF',exact:true})).toBeVisible();
 await expect(page.locator('iframe,embed')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
