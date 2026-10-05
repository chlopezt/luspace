import {test,expect} from '@playwright/test';

test('startup breath, theme, mobile containment and fade reveal the login',async({page})=>{
 let release!:()=>void;const ready=new Promise<void>(resolve=>{release=resolve;});
 await page.addInitScript(()=>localStorage.setItem('luspace-theme','light'));
 await page.route('**/api/status',async r=>{await ready;await r.fulfill({json:{setup:false,registration:true,google:true}});});
 await page.route('**/api/me',r=>r.fulfill({status:401,json:{error:'Inicia sesión'}}));
 await page.goto('/login',{waitUntil:'domcontentloaded'});
 const screen=page.locator('.startup-screen');
 await expect(screen).toHaveCount(1);
 await expect(screen).toContainText('Abriendo tu espacio…');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect.poll(()=>page.locator('.startup-brand img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
 expect(await page.locator('.startup-brand').evaluate(el=>getComputedStyle(el).animationName)).toBe('startup-breathe');
 for(const width of [320,375,414,1024]){
  await page.setViewportSize({width,height:700});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:900,height:600});
 await page.screenshot({path:'../work/startup-preview-light.png',animations:'disabled'});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await page.screenshot({path:'../work/startup-preview-dark.png',animations:'disabled'});
  await page.evaluate(()=>{
    (window as any).startupFadeFrames=[];
    const observer=new MutationObserver(()=>{
      const overlay=document.querySelector('.startup-screen.is-leaving');
      if(overlay)(window as any).startupFadeFrames.push({contentMounted:!!document.querySelector('.auth-card h1'),transition:getComputedStyle(overlay).transitionDuration});
    });
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  });
 release();
 await expect(page.getByRole('heading',{name:'Bienvenido a LuSpace',exact:true})).toBeVisible();
  await expect(screen).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).startupFadeFrames.some((frame:any)=>frame.contentMounted&&frame.transition==='0.26s'))).toBe(true);
 await expect(page.locator('#startup-fallback')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Iniciar sesión',exact:true})).toBeEnabled();
});

test('saved dark theme is applied before React and respects reduced motion',async({page})=>{
 let release!:()=>void;const boot=new Promise<void>(resolve=>{release=resolve;});
 await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('luspace-theme','dark'));
 await page.route('**/src/entry.tsx',async r=>{await boot;await r.continue();});
 await page.route('**/api/status',r=>r.fulfill({json:{setup:false,registration:true,google:true}}));
 await page.route('**/api/me',r=>r.fulfill({status:401,json:{error:'Inicia sesión'}}));
 await page.goto('/login',{waitUntil:'commit'});
 await expect(page.locator('#startup-fallback')).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(14, 36, 37)');
 expect(await page.locator('.startup-brand').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 expect(await page.locator('.startup-track>span').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 release();
 await expect(page.getByRole('heading',{name:'Bienvenido a LuSpace',exact:true})).toBeVisible();
 await expect(page.locator('.startup-screen')).toHaveCount(0);
});

test('system theme follows OS on the first loading frame',async({page})=>{
 let release!:()=>void;const boot=new Promise<void>(resolve=>{release=resolve;});
 await page.emulateMedia({colorScheme:'dark'});
 await page.addInitScript(()=>localStorage.removeItem('luspace-theme'));
 await page.route('**/src/entry.tsx',async r=>{await boot;await r.continue();});
 await page.route('**/api/status',r=>r.fulfill({json:{setup:false,registration:true,google:true}}));
 await page.route('**/api/me',r=>r.fulfill({status:401,json:{error:'Inicia sesión'}}));
 await page.goto('/login',{waitUntil:'commit'});
 await expect(page.locator('#startup-fallback')).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-theme','system');
 expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(14, 36, 37)');
 release();
 await expect(page.getByRole('heading',{name:'Bienvenido a LuSpace',exact:true})).toBeVisible();
});
