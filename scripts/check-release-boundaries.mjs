import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.STUDIO_BROWSER||'chromium',base=process.env.STUDIO_URL||'http://127.0.0.1:8765/';
const out='validation-artifacts/release-boundaries/'+engine;await mkdir(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const results=[];let failures=0;
async function check(name,run){try{await run();results.push({name,passed:true});console.log('PASS '+name);}
 catch(error){failures++;results.push({name,passed:false,error:error.message});console.error('FAIL '+name+': '+error.message);}}
const ready=p=>p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true');
try {
 await check('Startup requests only the coast; a cancelled winter load cannot change Contact’s return scene',async()=>{
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),requests=[];
  p.on('request',r=>requests.push(new URL(r.url()).pathname));
  let release;const held=new Promise(r=>release=r);let requested;
  const started=new Promise(r=>requested=r);
  await p.route('**/concept-winter-v2.webp',async route=>{requested();await held;await route.continue();});
  try {
   await p.goto(base);await ready(p);
   assert.ok(!requests.some(s=>s.endsWith('/world.js')||/concept-(?:winter|desk)|-dusk-v/.test(s)),requests.join('\n'));
   await p.locator('[data-settings-toggle]').tap();await p.locator('[data-world-route="winter"]').tap();await started;
   assert.match(await p.locator('[data-world-route="winter"]').textContent(),/loading/);
   await p.keyboard.press('Escape');await p.locator('.world-dock [data-world-route="contact"]').tap();release();
   await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='contact'&&
    !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
   await p.locator('[data-world-close]').tap();
   assert.equal(await p.locator('body').getAttribute('data-world-region'),'coast');
   await p.locator('[data-settings-toggle]').tap();await p.locator('[data-world-route="winter"]').tap();
   await p.waitForFunction(()=>document.body.dataset.worldRegion==='winter');
   assert.equal(await p.locator('[data-world-regions]').getAttribute('aria-busy'),'false');
   await p.screenshot({path:out+'/winter-after-cancellation.png'});
  } finally {release?.();await p.close();}
 });
 for(const mode of ['no JavaScript','module failure','simple page'])await check(mode+': every visible portfolio link has a usable target',async()=>{
  const p=await browser.newPage({viewport:{width:320,height:568},javaScriptEnabled:mode!=='no JavaScript'});
  try {
   if(mode==='module failure')await p.route('**/world-controller.js',r=>r.abort());
   await p.goto(base);
   if(mode==='simple page'){await ready(p);await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-text]').click();}
   assert.equal(await p.locator('.scene-maths').isVisible(),false);
   for(const a of await p.locator('.world-dock a:visible').all()){
    const href=await a.getAttribute('href');
    if(href.startsWith('#'))assert.equal(await p.locator(href).count(),1,href+' has one real target');
    else assert.ok((await p.request.get(new URL(href,base).href)).ok(),href+' responds');
   }
   assert.equal(await p.locator('[data-world-fallback]').isVisible(),true);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:out+'/'+mode.replaceAll(' ','-')+'.png'});
  } finally {await p.close();}
 });
 await check('The résumé is readable and prints from HTML without requesting a PDF asset',async()=>{
  const p=await browser.newPage({viewport:{width:1280,height:1100}}),requests=[];
  p.on('request',r=>requests.push(new URL(r.url()).pathname));
  await p.addInitScript(()=>{window.printCalls=0;window.print=()=>window.printCalls++;});
  try{
   const response=await p.goto(new URL('resume.html',base).href);assert.equal(response.status(),200);
   await p.evaluate(()=>document.fonts.ready);
   assert.equal(await p.locator('article.page').count(),1);
   assert.equal(await p.locator('a[download],a[href*="Philipp_Alimov_Resume.pdf"]').count(),0);
   await p.locator('[data-print-resume]').click();assert.equal(await p.evaluate(()=>window.printCalls),1);
   await p.emulateMedia({media:'print'});assert.equal(await p.locator('.resume-toolbar').isVisible(),false);
   const box=await p.locator('article.page').boundingBox();
   assert.ok(Math.abs(box.width-210*96/25.4)<1&&Math.abs(box.height-297*96/25.4)<1,'One A4 print sheet');
   assert.ok(!requests.some(path=>/\.pdf$/i.test(path)),'No PDF download dependency');
  }finally{await p.close();}
 });
 await check('The retired résumé PDF address returns 404',async()=>{
  const context=await browser.newContext();try{
   const response=await context.request.get(new URL('assets/Philipp_Alimov_Resume.pdf',base).href);
   assert.equal(response.status(),404,'Old PDF must not be served');
  }finally{await context.close();}
 });
 await check('The résumé remains readable and printable with JavaScript disabled',async()=>{
  const p=await browser.newPage({viewport:{width:320,height:568},javaScriptEnabled:false});
  try{
   await p.goto(new URL('resume.html',base).href);
   assert.equal(await p.locator('article.page h1').innerText(),'Philipp Alimov');
   assert.equal(await p.locator('[data-print-resume]').isVisible(),false,'Do not offer an inactive Print button');
   assert.match(await p.locator('.resume-toolbar').innerText(),/browser’s Print command/);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.emulateMedia({media:'print'});assert.equal(await p.locator('.resume-toolbar').isVisible(),false);
  }finally{await p.close();}
 });
} finally {await writeFile(out+'/results.json',JSON.stringify(results,null,2));await browser.close();}
if(failures)process.exitCode=1;
