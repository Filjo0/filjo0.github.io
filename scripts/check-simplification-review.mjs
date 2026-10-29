import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {integerRange} from './maths-browser-input.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765/';
const out=(process.env.SIMPLIFICATION_REVIEW_ARTIFACT_DIR||'validation-artifacts/simplification-review-19oct')+'/'+engine;await mkdir(out,{recursive:true});
const sizes=(process.env.REVIEW_VIEWPORTS||'1440x900,390x844,320x568,844x390').split(',').map(s=>{const [width,height]=s.split('x').map(Number);return {width,height};});
const browser=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(value,message)=>{assert.ok(value,message);checks++;};
const rendered=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const settled=p=>p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='fibonacci'&&!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
async function press(p,n,touch){await n.scrollIntoViewIfNeeded();touch?await n.tap():await n.click();await rendered(p);}
async function noPointerOutline(svg){return svg.evaluate(n=>{
 const s=getComputedStyle(n);return {active:document.activeElement===n,style:s.outlineStyle,width:parseFloat(s.outlineWidth),pointer:n.hasAttribute('data-pointer-focus')};});}
async function nav(p){
 for(const n of await p.locator('.maths-page-nav button:visible').all()){
  const result=await n.evaluate(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {border:parseFloat(s.borderTopWidth),radius:parseFloat(s.borderTopLeftRadius),bg:s.backgroundColor,height:r.height,width:r.width};});
  check(result.border===0&&result.radius===0&&result.bg==='rgba(0, 0, 0, 0)','Page navigation is plain text without boxed borders or fill');
  check(result.width>=43&&result.height>=43,'Plain page actions keep usable targets');
 }
 const body=p.locator('[data-world-content]');
 check(await body.evaluate(n=>n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1),'Page has no hidden clipping');
}
const evidence=[];
try{for(const viewport of sizes){
 console.log(engine+': simplification review '+viewport.width+'x'+viewport.height);
 const touch=viewport.width<960,p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'});current=p;
 const requests=[],errors=[];p.on('request',r=>requests.push(r.url()));p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true');await rendered(p);
 check(requests.some(u=>u.endsWith('/concept-coast-v2.webp')),'The approved board-free coastal plate is loaded');
 check(!requests.some(u=>/concept-coast(-dusk)?-v3\.webp$/.test(u)),'Retired surfboard plates are not loaded');
  check(await p.locator('.scene-object-dot').count()===0,'Objects use silhouettes without dots or target rings');
  check(await p.locator('[data-scene-object]:visible').evaluateAll(ns=>ns.every(n=>{
   const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;
  })),'Every visible silhouette keeps a 44px target');
 await p.waitForTimeout(3200);await p.screenshot({path:out+'/'+viewport.width+'-overview.png'});
 await press(p,p.locator('.world-dock [data-world-route="fibonacci"]'),touch);await settled(p);
 for(const [index,selector,next] of [[0,'[data-seed-art]','[data-turn-angle]'],[1,'[data-fibonacci-art]','[data-sequence-count]'],[2,'[data-pascal-art]','[data-pascal-rows]']]){
  if(index===0)await press(p,p.locator('[data-maths-chapter="0"]'),touch);
  else await press(p,p.locator('[data-maths-next-page]'),touch);
  const svg=p.locator(selector),main=p.locator(next);
  if(index===2){await integerRange(p,main,8);
    check(await p.locator('[data-pascal-row]').count()===8,'Pascal focus screenshots show eight actual constructed rows');}
  await press(p,svg,touch);
  let state=await noPointerOutline(svg);
  check(state.active&&state.pointer&&state.style==='none','A native '+(touch?'tap':'click')+' leaves no diagram outline on page '+(index+1)+': '+JSON.stringify(state));
  await p.screenshot({path:out+'/'+viewport.width+'-page'+(index+1)+'-pointer.png'});await nav(p);
  // Reach the drawing with a real Tab action, retaining an indicator for keyboard users.
  await main.focus();await p.keyboard.press('Shift+Tab');await rendered(p);
  check(await svg.evaluate(n=>document.activeElement===n),'Shift+Tab reaches the actual drawing');
  check(await svg.evaluate(n=>{const s=getComputedStyle(n);return s.outlineStyle==='solid'&&parseFloat(s.outlineWidth)>=2;}),'Keyboard focus keeps a visible diagram indicator');
  if(index===0)await p.screenshot({path:out+'/'+viewport.width+'-keyboard-focus.png'});
  await press(p,svg,touch);state=await noPointerOutline(svg);
  check(state.active&&state.pointer&&state.style==='none','Pointer input removes the indicator even after keyboard focus');
  await p.keyboard.press('Enter');await rendered(p);
  check(await svg.evaluate(n=>{const s=getComputedStyle(n);return document.activeElement===n&&s.outlineStyle==='solid'&&parseFloat(s.outlineWidth)>=2;}),'Keyboard activation restores its focus indicator');
  // Finish with the pointer state visitors see; do not capture a keyboard-only ring as touch UI.
  await press(p,svg,touch);await p.screenshot({path:out+'/'+viewport.width+'-page'+(index+1)+'-after-keyboard-tap.png'});
 }
 await press(p,p.locator('[data-world-close]'),touch);
 await press(p,p.locator('[data-settings-toggle]'),touch);await press(p,p.locator('[data-world-night]'),touch);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1);await p.keyboard.press('Escape');await rendered(p);
 check(requests.some(u=>u.endsWith('/concept-coast-dusk-v2.webp')),'Night uses the approved board-free plate');
 check(!requests.some(u=>/concept-coast(-dusk)?-v3\.webp$/.test(u)),'No surfboard variant is requested after changing light');
 await p.screenshot({path:out+'/'+viewport.width+'-night.png'});
 await press(p,p.locator('[data-settings-toggle]'),touch);await press(p,p.locator('[data-world-regions] [data-world-route="winter"]'),touch);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='winter');await p.keyboard.press('Escape');await rendered(p);
 await p.screenshot({path:out+'/'+viewport.width+'-winter-night.png'});
 check(errors.length===0,'No runtime errors: '+errors.join('; '));evidence.push({viewport,errors});await p.close();
}
 await writeFile(out+'/review-checks.json',JSON.stringify({engine,checks,evidence},null,2));console.log(engine+': '+checks+' simplification-review checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:out+'/review-failure.png'});throw e;}finally{await browser.close();}
