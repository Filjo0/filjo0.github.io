import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {readingSurfaceEdges} from './reading-surface-evidence.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const url=process.env.STUDIO_URL||'http://127.0.0.1:8765/',out=(process.env.APPS_SIMPLE_ARTIFACT_DIR||'validation-artifacts/straight-and-simple-24oct/stage-a')+'/'+engine;
await mkdir(out,{recursive:true});const captures=JSON.parse(await readFile('assets/previews/previews.json','utf8'));
const b=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const errors=[],failures=[],evidence=[],check=(v,m)=>{assert.ok(v,m);checks++;};
const destinations={
 futsl:[['Visit website','https://perth-futsal.onrender.com/about'],['App Store','https://apps.apple.com/au/app/perth-futsal/id6758882763'],['Google Play','https://play.google.com/store/apps/details?id=com.perthunited.app']],
 aqua:[['Visit website','https://aqualocal.com.au'],['App Store','https://apps.apple.com/au/app/aqua-local/id6773764070']],
 treadfront:[['App Store','https://apps.apple.com/au/app/treadfront-tank-defense/id6795040585']]
};
const external=/https:\/\/(?:apps\.apple\.com|play\.google\.com|aqualocal\.com\.au|perth-futsal\.onrender\.com)\//;
const stub=r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>External destination</title>'});
async function verifyLink(p,link,label,href,touch,reader){
 check(await link.getAttribute('href')===href,label+': exact verified destination');
 check(await link.getAttribute('target')==='_blank',label+': new tab');
 const rel=(await link.getAttribute('rel')||'').split(/\s+/);
 check(rel.includes('noopener')&&rel.includes('noreferrer'),label+': isolated new tab');
 check(await link.getAttribute('tabindex')==='0',label+': explicit keyboard stop');
 check((await link.innerText()).includes(label),label+': clear action name');
 check(await link.evaluate(n=>!n.closest('button')),label+': never nested in another control');
 await link.scrollIntoViewIfNeeded();const rect=await link.boundingBox();
 check(rect.height+1e-4>=44&&rect.width+1e-4>=44,label+': usable touch target');
 check(await link.evaluate(n=>n.scrollWidth<=n.clientWidth+1),label+': complete label fits without overflow');
 if(reader){const bounds=await reader.boundingBox();check(rect.y>=bounds.y-1&&rect.y+rect.height<=bounds.y+bounds.height+1,label+': reachable in outer scroll');}
 for(const method of ['pointer','keyboard']){
  const opened=p.waitForEvent('popup');
  if(method==='pointer')await press(p,link,touch);else{await link.focus();await p.keyboard.press('Enter');}
  const popup=await opened;await popup.waitForLoadState();
  check(popup.url()===new URL(href).href,label+': '+method+' opens expected destination');
  check(await popup.evaluate(()=>opener===null),label+': '+method+' has no opener');await popup.close();
 }
}
const settled=p=>p.waitForFunction(()=>document.querySelector('[data-world-reader]')?.dataset.object==='work'&&!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
async function press(p,n,touch){await n.scrollIntoViewIfNeeded();touch?await n.tap():await n.click();}
try{for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
 const touch=viewport.width<720||viewport.height<500,context=await b.newContext({viewport,hasTouch:touch,reducedMotion:'reduce'}),p=await context.newPage();current=p;
 // Native new-tab activation without loading third-party services during tests.
 await context.route(external,stub);
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
 await p.goto(url+'#work');await settled(p);await p.waitForFunction(()=>document.querySelectorAll('.workspace-shot img').length===5);
 await p.locator('.workspace-shot img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
 const edges=await readingSurfaceEdges(p.locator('[data-world-reader]'));check(edges.maxDeviation<=1,'Apps reading surface is square to screen');evidence.push({viewport,edges});
 check(await p.locator('.workspace-card').count()===3,'Exactly the three approved apps');
 if(touch){
  const reader=await p.locator('[data-world-reader]').boundingBox(),first=await p.locator('[data-app-website="futsl"]').boundingBox();
  check(Math.abs(reader.x)<1&&Math.abs(reader.y-64)<1&&reader.width>=viewport.width-1&&reader.height>=viewport.height-65,'Compact Apps uses available screen space instead of a nested laptop frame');
  check(first.y>=reader.y&&first.y+first.height<=reader.y+reader.height,'The first website action is visible on arrival without scrolling');
 }

 check(await p.locator('[data-preview],.captured-preview,.capture-screen').count()===0,'No offline-preview launcher or frame');
 for(const id of ['futsl','aqua']){
  const card=p.locator('[data-app-card="'+id+'"]'),screens=captures.projects[id].screens.slice(0,2);
  check(await card.locator('img').count()===2,id+': two flat captures');
  for(const [i,screen] of screens.entries()){
   const image=card.locator('img').nth(i);check(await image.getAttribute('src')===screen.image,id+': verified capture asset');
   check(await image.evaluate(n=>n.complete&&n.naturalWidth>0&&getComputedStyle(n).objectFit==='contain'&&getComputedStyle(n).transform==='none'),id+': full screenshot without cropping or rotation');
   check(await image.getAttribute('alt')===screen.alt,id+': meaningful screenshot text');
  }
  check((await card.locator('.workspace-capture-date').innerText()).includes('9 Oct 2026'),id+': capture date stays visible');
 }
 for(const [index,id] of ['futsl','aqua','treadfront'].entries()){
  const card=p.locator('[data-app-card="'+id+'"]'),links=card.locator('.workspace-links a');
  check(await links.count()===destinations[id].length,id+': exactly the published website/store links');
  const canonical=p.locator('[data-world-section="work"] .project').nth(index).locator('.project-links a[href^="https:"]');
  for(const [n,[label,href]] of destinations[id].entries()){
   check(await canonical.nth(n).getAttribute('href')===href,id+': scene and simple page share the same source');
   await verifyLink(p,links.nth(n),label,href,touch,p.locator('[data-world-reader]'));
  }
  await card.locator('[data-project-notes]').scrollIntoViewIfNeeded();
  await p.screenshot({path:out+'/'+viewport.width+'-'+id+'-links.png'});
 }
 await p.locator('[data-world-content]').evaluate(n=>n.scrollTop=0);
 if(viewport.width===1440){
  const bounds=await p.locator('[data-world-reader]').boundingBox();
  for(const link of await p.locator('.workspace-card [data-project-notes]').all()){
   const rect=await link.boundingBox();check(rect.y>=bounds.y&&rect.y+rect.height<=bounds.y+bounds.height,'Desktop case studies remain visible on arrival');
  }
 }
 await p.screenshot({path:out+'/'+viewport.width+'-apps.png'});
 for(const index of [0,1,2]){
  await press(p,p.locator('[data-project-notes="'+index+'"]'),touch);
  check(await p.locator('[data-world-content]').evaluate(n=>getComputedStyle(n).backgroundColor)==='rgb(245, 242, 233)','Every case study has a paper background, including its heading');
  check(await p.locator('[data-world-section="work"] .section-heading h2').evaluate(n=>getComputedStyle(n).color)==='rgb(31, 42, 35)','Case study heading retains the shared dark ink');
  check(await p.locator('[data-world-section="work"] .project').nth(index).isVisible(),'The selected case study remains visible');
  await press(p,p.locator('[data-notes-home]'),touch);
  check(await p.locator('[data-world-content]').getAttribute('data-workspace-view')==='apps','Back restores the laptop launcher');
 }
 await press(p,p.locator('[data-demo-open]'),touch);await p.frameLocator('.tank-frame').locator('[data-start]').waitFor();
 check(await p.locator('.tank-frame').getAttribute('sandbox')==='allow-scripts','Treadfront retains opaque-origin demo isolation');
 await press(p,p.locator(touch?'[data-world-close]':'[data-demo-close]'),touch);await p.locator('.tank-frame').waitFor({state:'detached'});
 for(const old of ['futsl','aqua']){
  await p.goto(url+'#'+old);await p.waitForFunction(()=>location.hash==='#work');await settled(p);
  check(await p.locator('.workspace-card').count()===3,old+': old URL lands on My apps');check(await p.locator('.captured-preview').count()===0,old+': old preview is absent');
 }
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&scrollY===0),'Only the app reader scrolls; no horizontal page overflow');
 await context.close();
}
// Both conventional modes keep working store actions without the scene launcher.
for(const viewport of [{width:1440,height:900},{width:320,height:568}])for(const javaScriptEnabled of [true,false]){
 const context=await b.newContext({viewport,hasTouch:viewport.width<720,javaScriptEnabled,reducedMotion:'reduce'});
 await context.route(external,stub);const p=await context.newPage();current=p;
 await p.goto(url);
 if(javaScriptEnabled){
  await p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true');
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-text]').click();
 }
 for(const [index,id] of ['futsl','aqua','treadfront'].entries()){
  const card=p.locator('#work .project').nth(index),links=card.locator('.project-links a[href^="https:"]');
  check(await links.count()===destinations[id].length,id+': simple page has every published link');
  for(const [n,[label,href]] of destinations[id].entries())await verifyLink(p,links.nth(n),label,href,viewport.width<720);
  if(id==='futsl')check((await card.locator('.project-lede').innerText()).endsWith('on web, iOS and Android.'),'Simple page has approved released Android wording');
 }
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Simple page has no horizontal overflow');
 await p.screenshot({path:out+'/'+viewport.width+'-simple-'+(javaScriptEnabled?'js':'no-js')+'.png',fullPage:true});
 await context.close();
}
// Capture failure must leave real project links and case studies usable.
const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});current=p;
await p.route('**/assets/previews/previews.json',r=>r.fulfill({status:404,body:'Missing'}));await p.goto(url+'#work');await settled(p);
await p.waitForFunction(()=>[...document.querySelectorAll('.workspace-shot')].filter(n=>n.textContent==='Screenshot unavailable').length===2);
check(await p.locator('[data-app-website],[data-app-store]').count()===6,'Missing captures retain every app’s published links');
await p.locator('[data-project-notes="0"]').click();check(await p.locator('[data-world-section="work"] .project').first().isVisible(),'Case study survives unavailable images');await p.close();
check(errors.length===0,'No runtime errors: '+errors.join('; '));check(failures.length===0,'No failed normal requests: '+failures.join('; '));
await writeFile(out+'/results.json',JSON.stringify({engine,checks,evidence,errors,failures},null,2));console.log(engine+': '+checks+' flat-app checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw e;}finally{await b.close();}
