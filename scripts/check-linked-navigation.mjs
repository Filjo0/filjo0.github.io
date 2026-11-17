import {sceneFixtureURL} from './scene-fixture-url.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {markerEvidence} from './marker-browser-evidence.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const base=sceneFixtureURL(),out=(process.env.OBJECT_MARKER_ARTIFACT_DIR||'validation-artifacts/iphone-navigation-17nov/linked')+'/'+engine;
await mkdir(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const errors=[],evidence=[];let checks=0,current;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const ready=p=>p.waitForFunction(()=>document.querySelector('.scene-hotspots')?.dataset.markerLayout==='ready');
const opened=(p,id)=>p.waitForFunction(id=>document.body.dataset.linkedFlowPhase==='open'&&document.querySelector('[data-world-reader]').dataset.object===id,id);
async function press(node,touch){touch?await node.tap():await node.click();}
async function close(p,touch){await press(p.locator('[data-world-close]'),touch);await p.waitForFunction(()=>document.body.dataset.linkedFlowPhase==='idle');}
try{
 for(const [width,height] of [[1440,900],[1280,720],[390,844],[390,664],[375,553],[320,568],[320,844],[844,390]]){
  const touch=width<960,p=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});current=p;
  p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await ready(p);
  for(const area of ['desk','coast']){
   const frame=p.locator('[data-scene-framing]');
   if(area==='coast'&&await frame.isVisible()){
    await press(frame,touch);await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneFrameMode==='coast');
   }
   const measured=await markerEvidence(p,check);evidence.push({width,height,area,markers:measured.objects});
   await p.screenshot({path:out+'/'+width+'x'+height+'-'+area+'.png'});
   for(const id of ['work','experience','resume','contact','fibonacci']){
    const target=p.locator('.world-dock [data-world-route="'+id+'"]');
    await press(target,touch);await opened(p,id);
    check((await p.locator('[data-world-close]').innerText()).includes('Back to '+(width<720&&height>width?area:'desk')),id+': the return label names the actual scene');
    if(id==='experience'){
     await press(p.locator('[data-about-reading]'),touch);await opened(p,'books');
     check((await p.locator('[data-world-close]').innerText()).includes('Back to About'),'Reading has an explicit parent route');
     await press(p.locator('[data-world-close]'),touch);await opened(p,'experience');
     check(await p.locator('[data-about-reading]').evaluate(n=>document.activeElement===n),'Reading restores its exact parent opener');
    }
    if(id==='resume')check(await p.locator('[data-resume-document]').evaluate(n=>n.shadowRoot.activeElement?.matches('h1[data-resume-heading]')),'Résumé focus is its named heading');
    await close(p,touch);
    check(await target.evaluate(n=>document.activeElement===n),id+': Back restores the exact menu opener');
    check(await p.locator('.linked-input-shield,.linked-transition').count()===0,id+': no input shield remains after Back');
   }
   for(const m of measured.objects){
    const target=p.locator('[data-scene-object="'+m.id+'"]');
    await p.keyboard.press('Tab');await target.focus();check(await target.getAttribute('data-hotspot-state')==='focus',m.id+': keyboard focus highlights its object');
    if(m.id==='globe')continue;
    await p.keyboard.press('Enter');await opened(p,['aqua','futsl'].includes(m.id)?'work':m.id);
    if(['aqua','futsl'].includes(m.id))check(await p.locator('[data-app-card="'+m.id+'"]').getAttribute('data-selected')==='true',m.id+': the shortcut selects the correct app');
    await p.keyboard.press('Escape');await p.waitForFunction(()=>document.body.dataset.linkedFlowPhase==='idle');
    check(await target.evaluate(n=>document.activeElement===n),m.id+': Escape restores the shortcut');
   }
   await p.locator('[data-world-render]').focus();
  }
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-route="winter"]').click();
  await p.waitForFunction(()=>document.body.dataset.worldRegion==='winter');await p.keyboard.press('Escape');
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-night]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.progress===1&&JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.phase==='night');
  await p.keyboard.press('Escape');await markerEvidence(p,check);await p.screenshot({path:out+'/'+width+'x'+height+'-winter-night.png'});
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No sideways document overflow');
  await p.close();console.log(engine+': linked navigation '+width+'x'+height+' passed');
 }
 const p=await browser.newPage({viewport:{width:390,height:664},hasTouch:true,reducedMotion:'no-preference'});current=p;
 await p.goto(base);await ready(p);const menu=p.locator('.world-dock [data-world-route="work"]');
 await menu.hover();check(await p.locator('[data-scene-object="work"]').getAttribute('data-hotspot-state')==='hover','The named menu action highlights the matching laptop');
 await menu.tap();await opened(p,'work');await close(p,true);
 await p.locator('[data-scene-framing]').tap();await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneFrameMode==='coast'&&document.querySelector('[data-world-render]').dataset.scenePanning==='false');
 await menu.tap();await opened(p,'work');
 const record=JSON.parse(await p.locator('[data-world-render]').getAttribute('data-linked-flow-record'));
 check(record.plannedMs===900&&record.openCalls===1,'Coast travel opens once with the measured longer approach');
 await close(p,true);check(await p.locator('[data-world-render]').getAttribute('data-scene-frame-mode')==='coast','Animated Back returns to the coast');
 await p.locator('.world-dock [data-world-route="work"]').tap();
 await p.waitForFunction(()=>document.body.dataset.linkedFlowPhase==='mounting'&&location.hash==='#work');
 await p.goBack();await p.waitForFunction(()=>document.body.dataset.linkedFlowPhase==='idle'&&document.querySelector('[data-world-reader]').hidden);
 check(await p.locator('.linked-input-shield,.linked-transition').count()===0,'Browser Back cancels a mounting approach without trapping input');
 await p.waitForFunction(()=>document.activeElement===document.querySelector('.world-dock [data-world-route="work"]'));
 check(await menu.evaluate(n=>document.activeElement===n),'Interrupted browser navigation restores the named menu opener');
 await p.close();
 const probe=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});current=probe;
 await probe.goto(base);await ready(probe);
 const dot=probe.locator('[data-scene-object="work"] .scene-object-dot');
 const original=await dot.evaluate(n=>n.style.left);
 await dot.evaluate(n=>n.style.left=(parseFloat(n.style.left)+3)+'px');
 let caught='';try{await markerEvidence(probe,(v,m)=>assert.ok(v,m));}catch(error){caught=error.message;}
 await dot.evaluate((n,value)=>n.style.left=value,original);
 check(caught.includes('within 1px'),'A deliberately moved anchor fails the unchanged 1px calibration rule');
 await markerEvidence(probe,check);await probe.close();
 check(errors.length===0,'No runtime errors');
 await writeFile(out+'/results.json',JSON.stringify({engine,checks,errors,evidence},null,2));console.log(engine+': '+checks+' navigation and shortcut assertions passed');
}catch(error){
 if(current&&!current.isClosed()){await current.screenshot({path:out+'/failure.png'});await writeFile(out+'/failure.json',JSON.stringify({message:error.message,...error.markerEvidence},null,2));}
 throw error;
}finally{await browser.close();}
