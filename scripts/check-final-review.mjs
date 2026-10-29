import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const out=(process.env.FINAL_REVIEW_ARTIFACT_DIR||'validation-artifacts/final-review')+'/'+name;await mkdir(out,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(v,m)=>{assert.ok(v,m);checks++;};
const settled=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
async function activate(p,n,touch){await n.scrollIntoViewIfNeeded();
 if(touch){const r=await n.boundingBox();await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}else await n.click();}
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  const touch=viewport.width<720||viewport.height<500;
  const p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'}),errors=[];current=p;
  p.on('pageerror',e=>errors.push(e.message));console.log(name+': final review '+viewport.width+'x'+viewport.height);
  await p.goto(url+'/#experience');await settled(p,'experience');
  check(await p.evaluate(()=>document.activeElement===document.body),'Async deep-link arrival does not steal initial focus');
  await p.keyboard.press('Tab');
  check(await p.locator('.skip-link').evaluate(n=>document.activeElement===n),'Deep links preserve first Tab to Skip to content');
  await p.keyboard.press('Tab');
  const body=p.locator('[data-world-content]'),reader=p.locator('[data-world-reader]');
  if(!touch){
   const r=await reader.boundingBox();check(r.width>=440,'About has a useful desktop reading width');
   check(await body.evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=17),'About uses readable desktop body type');
  }
  const last=body.locator('a').last();await last.scrollIntoViewIfNeeded();
  check(await last.evaluate(n=>{const r=n.getBoundingClientRect(),b=n.closest('[data-world-content]').getBoundingClientRect();
   return r.top>=b.top-1&&r.bottom<=b.bottom+1&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),
   'Final About action remains visible and usable in the single outer scroll');
  await p.screenshot({path:out+'/'+viewport.width+'-about.png'});
  await activate(p,p.locator('[data-world-close]'),touch);
  await activate(p,p.locator('.world-dock [data-world-route="work"]'),touch);await settled(p,'work');
  const aqua=p.locator('[data-app-card="aqua"]');
  const picture=aqua.locator('.workspace-shot');await picture.scrollIntoViewIfNeeded();
  await picture.locator('img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
  check(await picture.evaluate(n=>{const images=[...n.querySelectorAll('img')],b=n.closest('[data-world-content]').getBoundingClientRect();
   const rects=images.map(image=>image.getBoundingClientRect());
   return images.length===2&&rects.reduce((sum,r)=>sum+r.width,0)>100&&images.every((image,i)=>{
    const r=rects[i];return r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1&&getComputedStyle(image).objectFit==='contain';
   });}), 'Both flat Aqua screenshots fit inside My apps without cropping');
  const website=aqua.locator('[data-app-website]');await website.scrollIntoViewIfNeeded();
  check(await website.getAttribute('href')==='https://aqualocal.com.au'&&await aqua.locator('[data-app-store]').count()===1,'Aqua has its canonical website and App Store actions');
  check(await p.locator('[data-preview-screen],.capture-hotspot').count()===0,'Interactive preview controls are retired');
  await p.screenshot({path:out+'/'+viewport.width+'-aqua.png'});
  await activate(p,p.locator('[data-world-close]'),touch);
  check(errors.length===0,'No runtime errors: '+errors.join('; '));await p.close();
 }
 for(const viewport of [{width:768,height:1024},{width:900,height:900},{width:1024,height:768}]) {
  const p=await browser.newPage({viewport,reducedMotion:'reduce'}),errors=[];current=p;
  p.on('pageerror',e=>errors.push(e.message));
  console.log(name+': tablet creative '+viewport.width+'x'+viewport.height);
  async function fitCreative(label){
   const body=p.locator('[data-world-content]');
   check(await body.evaluate(n=>n.scrollHeight<=n.clientHeight+1&&n.scrollWidth<=n.clientWidth+1),label+': no hidden tablet clipping');
   for(const target of await body.locator('button:visible,a:visible,[role="slider"]:visible').all()){
    check(await target.evaluate(n=>{const r=n.getBoundingClientRect(),b=n.closest('[data-world-content]').getBoundingClientRect();
     return r.top>=b.top-1&&r.bottom<=b.bottom+1&&r.left>=b.left-1&&r.right<=b.right+1&&r.height>=43;}),
     label+': visible, usable tablet action');
    if(!await target.isDisabled())check(await target.evaluate(n=>{const r=n.getBoundingClientRect();
     return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),label+': action is unobstructed');
   }
  }
  await p.goto(url+'/#fibonacci');await settled(p,'fibonacci');await fitCreative('tablet sunflower');
  await p.screenshot({path:out+'/'+viewport.width+'-tablet-sunflower.png'});
  check(errors.length===0,'No tablet runtime errors: '+errors.join('; '));await p.close();
 }
 // Every arrival must work; never retry a failed first Tab until it passes.
 for(const delay of [0,200])for(let iteration=0;iteration<4;iteration++){
  const p=await browser.newPage({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'reduce'});current=p;
  if(delay)await p.route('**/world-controller.js',async route=>{await new Promise(r=>setTimeout(r,delay));await route.continue();});
  await p.goto(url+'/#experience');await settled(p,'experience');
  check(await p.evaluate(()=>document.activeElement===document.body),'Repeated deep link keeps document focus');
  check(await p.evaluate(()=>!document.body.hasAttribute('tabindex')&&!document.body.matches(':focus-visible')),
   'Startup reset leaves no body tab stop or visible focus outline');
  await p.keyboard.press('Tab');
  check(await p.locator('.skip-link').evaluate(n=>document.activeElement===n),
   'First Tab reaches Skip on every 320px arrival: delay '+delay+', iteration '+iteration);
  check(new URL(p.url()).hash==='#experience','Focus reset preserves the direct link');await p.close();
 }
 // Keep visitor focus during the initial, motion-enabled close-up transition.
 {
  const p=await browser.newPage({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'no-preference'});current=p;
  await p.goto(url+'/#experience');
  for(let i=0;i<20&&!await p.locator('.skip-link').evaluate(n=>document.activeElement===n);i++)
   await p.keyboard.press('Shift+Tab');
  check(await p.locator('.skip-link').evaluate(n=>document.activeElement===n),'Native keyboard reaches Skip during initial loading');
  await settled(p,'experience');
  check(await p.locator('.skip-link').evaluate(n=>document.activeElement===n),'Initial close-up never takes existing visitor focus');
  check(new URL(p.url()).hash==='#experience','Early keyboard navigation preserves the requested About route');
  await p.close();
 }
 for(const file of ['studio.html','studio.css','walkthrough.css','room.js','room-details.js','room-experience.js','room-audio.js',
  'assets/studio/contact-zone.glb','assets/studio/desk-zone.glb','assets/studio/living-zone.glb','assets/studio-workspace.webp']){
  const response=await browser.newContext();
  check((await response.request.get(url+'/'+file)).status()===404,'Unused prototype is absent from public root: '+file);
  await response.close();
 }
 const ignores=await readFile('.gitignore','utf8');
 check(ignores.split(/\r?\n/).includes('tasks/'),'Internal task notes are ignored');
 console.log(name+': '+checks+' final-review checks passed.');
} catch(e){if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw e;}
finally {await browser.close();}
