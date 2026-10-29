import {outlineGeometry} from './outline-browser-evidence.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765/';
const out=(process.env.NAV_REDESIGN_ARTIFACT_DIR||'validation-artifacts/redesign-15oct/navigation')+'/'+name;await mkdir(out,{recursive:true});
const layout=JSON.parse(await readFile(new URL('../art/outdoor/hotspot-layout.json',import.meta.url),'utf8'));
const sizes=(process.env.NAV_REDESIGN_VIEWPORTS||'1440x900,1280x720,390x844,320x844,844x390').split(',')
 .map(s=>{const [width,height]=s.split('x').map(Number);return {width,height};});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(v,m)=>{assert.ok(v,m);checks++;};
const state=p=>p.locator('canvas').evaluate(n=>JSON.parse(n.dataset.worldState));
const settled=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
async function activate(p,n,touch){
 await n.scrollIntoViewIfNeeded();if(touch){const r=await n.boundingBox();await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}
 else await n.click();
}
const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
try{for(const viewport of sizes){
 const touch=viewport.width<=960,p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'no-preference'});current=p;
 const errors=[];p.on('pageerror',e=>errors.push(e.message));console.log(name+': redesigned navigation '+viewport.width+'x'+viewport.height);
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true');
 check(await p.locator('.scene-hotspots').getAttribute('data-intro')==='sweep','Arrival uses one finite sequence of object light sweeps');
 await p.screenshot({path:out+'/'+viewport.width+'x'+viewport.height+'-intro.png'});
 await p.waitForFunction(()=>!document.querySelector('.scene-hotspots').dataset.intro);
 await outlineGeometry(p,layout,check);
 check(await p.locator('.scene-object-dot').count()===0,'Dots and plus markers are removed entirely');
 check(await p.locator('[data-scene-object="fibonacci"]').count()===1&&
  await p.locator('[data-scene-object="fibonacci"]').getAttribute('aria-label')==='Maths notebook',
  'The pictured notebook has a clearly named target, even when cropped outside a narrow view');
 check(await p.locator('[data-scene-object="books"]').isVisible(),'The book stack has a visible target');
 check(await p.locator('[data-world-globe]').isHidden()&&await p.locator('[data-world-pause]').isHidden(),
  'No duplicate globe button or vague global Pause is visible');
 check(await p.evaluate(()=>document.activeElement===document.body),'Initialization does not steal keyboard focus');
 await p.keyboard.press('Tab');check(await p.locator('.skip-link').evaluate(n=>document.activeElement===n),'First Tab still reaches Skip to content');
 const header=await p.locator('.world-header').boundingBox(),dock=await p.locator('.world-dock').boundingBox();
 await (touch?p.touchscreen.tap(8,header.height+18):p.mouse.click(8,header.height+18));
 check(touch?dock.y>viewport.height-90:dock.y>=header.y&&dock.y+dock.height<=header.y+header.height,
  'Primary navigation is in the desktop header or slim phone tab bar');
 if(touch){check(dock.height<=60,'Phone tab bar stays slim');
  check(await p.locator('.world-dock .nav-icon:visible').count()===5,'All phone tabs have matching line icons');}
 else check(await p.locator('.world-dock .nav-icon:visible').count()===0,'Desktop navigation is plain text');
 check((await p.locator('.world-dock > a').allTextContents()).join('|')==='My apps|About|Résumé|Contact|Maths','Navigation names are clear');
 await p.waitForFunction(()=>!document.querySelector('.scene-hotspots').dataset.intro);
 await p.waitForTimeout(220);
 check(await p.locator('.scene-object-label').evaluateAll(ns=>ns.every(n=>Number(getComputedStyle(n).opacity)===0)),
  'Initial labels fade after about three seconds');
 await p.screenshot({path:out+'/'+viewport.width+'x'+viewport.height+'-closed.png'});
 const book=p.locator('[data-scene-object="books"]');
 await book.hover();await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-scene-object="books"] .scene-object-label')).opacity)>.99);
 check(await book.locator('.scene-object-label').innerText()==='Book','Hover shows only the object name');
 check(await book.locator('small').count()===0,'No extra Open action remains');
 await p.screenshot({path:out+'/'+viewport.width+'x'+viewport.height+'-names.png'});
 await activate(p,book,touch);await settled(p,'books');
 check(await p.locator('[data-world-reader]').getAttribute('data-experience')==='books','One click or tap opens the real reading object');
 check(await p.locator('.world-dock').isHidden(),'Focused objects still have one Back control and no navigation clutter');
 await p.locator('[data-world-close]').click();
 await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-scene-object="books"]'));
 check(await book.evaluate(n=>document.activeElement===n),'Back restores focus to the book opener');
 const contact=p.locator('[data-scene-object="contact"]');
 // Short landscape may intentionally hide cropped optional dots; navigation remains available.
 if(await contact.isVisible()) {
  await contact.focus();await p.keyboard.press('Enter');await settled(p,'contact');
  await p.keyboard.press('Escape');
  await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-scene-object="contact"]'));
  check(await contact.evaluate(n=>document.activeElement===n),'Escape restores focus to the Contact dot');
 }
 const contactLink=p.locator('.world-dock > [data-world-route="contact"]');
 await contactLink.focus();await p.keyboard.press('Enter');await settled(p,'contact');
 await p.locator('[data-world-close]').click();
 await p.waitForFunction(()=>document.activeElement===document.querySelector('.world-dock > [data-world-route="contact"]'));
 check(await contactLink.evaluate(n=>document.activeElement===n),'Back restores focus to the Contact navigation link');
 const gear=p.locator('[data-settings-toggle]'),panel=p.locator('[data-settings-panel]');
 await gear.focus();await p.keyboard.press('Enter');
 check(await gear.getAttribute('aria-expanded')==='true'&&await panel.isVisible(),'Gear opens an accessible panel with keyboard');
 check(await p.locator('[data-world-regions] [aria-current]').evaluate(n=>document.activeElement===n),'Opening Settings focuses its current season');
 await p.screenshot({path:out+'/'+viewport.width+'x'+viewport.height+'-settings.png'});
 const address=p.url();await p.keyboard.press('Escape');
 check(await panel.isHidden()&&p.url()===address&&await gear.evaluate(n=>document.activeElement===n),'Escape closes only Settings and returns focus');
 await activate(p,gear,touch);await (touch?p.touchscreen.tap(8,header.height+18):p.mouse.click(8,header.height+18));
 check(await panel.isHidden(),'Outside click closes Settings');
 await activate(p,gear,touch);await activate(p,p.locator('[data-world-reduce-motion]'),touch);
 check(await p.locator('[data-world-reduce-motion]').getAttribute('aria-checked')==='true','Reduce motion is a working named switch');
 await p.waitForTimeout(30);
 check(await p.locator('.scene-hotspots').evaluate(n=>n.getAnimations({subtree:true}).every(a=>a.playState!=='running')),
  'Reduce motion stops every decorative outline animation');
 await activate(p,p.locator('[data-world-regions] [data-world-route="winter"]'),touch);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='winter');
 check((await state(p)).snow===1&&(await state(p)).transition.phase==='settled','Reduced motion settles the seasonal change');
 await activate(p,gear,touch);await activate(p,p.locator('[data-world-night]'),touch);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1);
 check(await p.locator('[data-world-night]').getAttribute('aria-pressed')==='true'&&await p.locator('[data-world-day]').getAttribute('aria-pressed')==='false',
  'Night selects the real evening scene and segmented state');
 await activate(p,p.locator('[data-world-night]'),touch);
 check((await state(p)).lighting.blend===1,'Selecting Night again keeps Night, rather than toggling Sunset');
 await activate(p,p.locator('[data-world-day]'),touch);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===0);
 check(await p.locator('[data-world-day]').getAttribute('aria-pressed')==='true','Sunset restores golden-hour light and selected state');
 await p.keyboard.press('Escape');
 const globe=p.locator('[data-scene-object="globe"]');await activate(p,globe,touch);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='coast');
 check((await state(p)).snow===0,'One click or tap on the pictured globe changes seasons');
 const maths=p.locator('.world-dock [data-world-route="fibonacci"]');
 await activate(p,maths,touch);await settled(p,'fibonacci');
 check(await maths.getAttribute('aria-current')==='page','The direct Maths link tracks its current page');
 await p.locator('[data-world-close]').click();
 check(await p.locator('[data-world-map]').isHidden(),'No retired activity catalogue is shown');
 await activate(p,p.locator('.world-dock [data-world-route="work"]'),touch);await settled(p,'work');
 check(await p.locator('.world-dock [data-world-route="work"]').getAttribute('aria-current')==='page','Navigation tracks the current item');
 await p.locator('[data-world-close]').click();
 await p.reload();await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true');
 await activate(p,gear,touch);
 check(await p.locator('[data-world-reduce-motion]').getAttribute('aria-checked')==='true','The local motion preference survives reload');
 check(await p.locator('[data-world-text]').innerText()==='Simple page view','Plain page option has a clear name');
 await activate(p,p.locator('[data-world-text]'),touch);
 check(await p.locator('[data-world-fallback]').isVisible()&&await p.locator('#experience .timeline-entry').count()===5,
  'Simple page restores the approved complete portfolio');
 check(await p.locator('[data-settings-toggle]').isHidden(),'Scene-only gear is removed from the simple page');
 check(errors.length===0,'No runtime errors: '+errors.join('; '));await p.close();
}
const blocked=await browser.newPage({reducedMotion:'reduce'});current=blocked;
await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked');}}));
const blockedErrors=[];blocked.on('pageerror',e=>blockedErrors.push(e.message));
await blocked.goto(url);await blocked.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true');
await blocked.locator('[data-settings-toggle]').click();
check(await blocked.locator('[data-world-reduce-motion]').getAttribute('aria-checked')==='true','Device motion preference is the default');
await blocked.locator('[data-world-reduce-motion]').click();
check(await blocked.locator('[data-world-reduce-motion]').getAttribute('aria-checked')==='false','An explicit choice works even when storage is blocked');
check(blockedErrors.length===0,'Blocked optional storage does not produce runtime errors');await blocked.close();
console.log(name+': '+checks+' navigation redesign checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw e;}
finally{await browser.close();}
