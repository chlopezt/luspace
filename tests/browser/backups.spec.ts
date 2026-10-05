import {test,expect} from '@playwright/test';
test('backup dashboard shows honest status and contains mobile width',async({page})=>{
 await page.route('**/api/**',r=>r.fulfill({json:[]}));
 await page.route('**/api/platform/me',r=>r.fulfill({json:{nombre:'Administrador QA'}}));
 await page.route('**/api/platform/notifications',r=>r.fulfill({json:{items:[],unread:0}}));
 let verified=false;
 await page.route('**/api/platform/backups',r=>r.fulfill({json:{state:verified?'verified':'pending',stale:!verified,workflow_url:'https://github.com/chlopezt/luspace/actions/workflows/backup.yml',runs:verified?[{id:'qa',started_at:'2026-10-05T07:23:00Z',status:'verified',verified_files:3,restore_test_at:'2026-10-05T07:25:00Z'}]:[],last_verified:verified?{completed_at:'2026-10-05T07:25:00Z',verified_files:3,encrypted_bytes:12000,restore_test_at:'2026-10-05T07:25:00Z',independent_copy:'verified'}:null}}));
 await page.goto('/admin#backups');
 await expect(page.getByRole('heading',{name:'Respaldos y recuperación',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Pendiente de activar',exact:true})).toBeVisible();
 for(const width of [320,375,414,1280]){
  await page.setViewportSize({width,height:900});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(0);
 }
 verified=true;await page.getByRole('button',{name:'Actualizar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Respaldo verificado',exact:true})).toBeVisible();
 await expect(page.getByText('Registrada',{exact:true})).toBeVisible();
});
