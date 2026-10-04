import { test, expect } from '@playwright/test';
test('family mobile containment and unchanged desktop chart/header layout',async({page,baseURL})=>{
  const origin=new URL(baseURL!).origin;
  const post=async(path:string,data:any)=>{const res=await page.request.post('/api/'+path,{data,headers:{Origin:origin}});expect(res.ok(),await res.text()).toBeTruthy();return res.json();};
  const status=await (await page.request.get('/api/status')).json();
  if(status.setup) await post('setup',{nombre:'QA',familia:'Responsividad QA',correo:'mobile@example.test',password:'QaPassword!2026'});
  else await post('login',{correo:'mobile@example.test',password:'QaPassword!2026'});
  const child=await post('children',{primer_nombre:'Luciano nombre largo de prueba',apellidos:'QA',fecha_nacimiento:'2018-05-20',sexo_referencia:'masculino',grupo_sanguineo:'',alergias:'Alergia registrada para pruebas de pantalla pequeña',rnd_habilitado:1});
  await post('records/registros_crecimiento?child='+child.id,{fecha_medicion:'2026-01-01',peso_kg:25,talla_cm:125,notas:''});
  await post('records/credenciales_discapacidad?child='+child.id,{activo:1,folio:'QA',tipo_discapacidad:'',movilidad_reducida:0,fecha_vencimiento:'',frente_r2_key:'',reverso_r2_key:''});
  await page.goto('/');
  await page.locator('.child-selector select').selectOption(child.id);
  await expect(page.locator('header .rnd')).toBeVisible();
  await expect(page.locator('.growth-chart svg[role="application"]')).toBeVisible();
  for(const width of [320,375,414,1024,1440]){
    await page.setViewportSize({width,height:900});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByRole('button',{name:'Estado almacenamiento',exact:true})).toHaveCount(0);
    expect(await page.locator('.growth .section-heading').evaluate(el=>getComputedStyle(el).flexDirection)).toBe(width<=760?'column':'row');
    await expect(page.locator('.header-pdf span')).toBeVisible({visible:width>760});
    if(width<=760){
      const rects=await page.locator('.page > header > *').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
      expect(Math.max(...rects.map(r=>r.top))).toBeLessThan(Math.min(...rects.map(r=>r.bottom)));
      expect(Math.max(...rects.map(r=>r.right))).toBeLessThanOrEqual(width);
      for(const module of ['Perfil','Salud','Escolar','Anamnesis','Credencial RND','Invitados','Familia y accesos','Auditoría']){
        await page.getByRole('button',{name:'Abrir menú'}).click();
        await expect(page.getByRole('button',{name:'Estado almacenamiento',exact:true})).toHaveCount(0);
        await page.locator('.sidebar').getByRole('button',{name:module,exact:true}).click();
        await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),{message:`${module} at ${width}px`}).toBeLessThanOrEqual(0);
      }
      await page.getByRole('button',{name:'Abrir menú'}).click();await page.getByRole('button',{name:'Inicio',exact:true}).click();
    }
    await page.screenshot({path:`../work/responsive-${width}.png`,fullPage:true});
  }
});
