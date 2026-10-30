import {revealDesk} from './outline-browser-evidence.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const artifact=resolve(import.meta.dirname,'../validation-artifacts/object-scenes',name);await mkdir(artifact,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const state=p=>p.locator('[data-world-render] canvas').evaluate(n=>JSON.parse(n.dataset.worldState));
try {
 for(const viewport of [{width:1672,height:941},{width:390,height:844},{width:320,height:844},{width:844,height:390}]) {
  console.log(name+': checking scene at '+viewport.width+'px');
  const p=await browser.newPage({viewport,reducedMotion:'reduce',hasTouch:viewport.width<700});
  const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.goto(url);await p.waitForFunction(()=>document.querySelector('canvas')&&
    JSON.parse(document.querySelector('canvas').dataset.worldState).ready);
  const initial=await state(p);
  check(await p.locator('.concept-loading').isHidden(),'Loading message disappears after art is ready');
  check(initial.navigation==='objects'&&initial.character==='none','Homepage is object navigation without an avatar');
  check(!requests.some(u=>u.endsWith('/person.glb')),'No visitor model is downloaded');
  check(!requests.some(u=>u.includes('-dusk-v')),'Dusk artwork is not downloaded before use');
  check(await p.locator('[data-world-touch]').isHidden(),'No walking controls in the scene');
  check(!await p.locator('[data-world-intro]').textContent().then(t=>/WASD|walk|run/i.test(t)),'No walking instructions');
  await p.locator('[data-world-render]').focus();await p.keyboard.down('KeyW');await p.waitForTimeout(150);await p.keyboard.up('KeyW');
  check(JSON.stringify((await state(p)).position)===JSON.stringify(initial.position),'Walking keys do not move the scene');
  // A fixed lower-centre point became the portrait coast-navigation button.
  // Select actual scenery and still assert hit ownership before clicking it.
  const empty=await p.locator('[data-world-render]').evaluate(host=>{
   const r=host.getBoundingClientRect();
   for(const v of [.4,.6,.8])for(const u of [.95,.75,.5,.25,.05]){
    const x=r.x+r.width*u,y=r.y+r.height*v;
    if(document.elementFromPoint(x,y)?.closest('[data-world-render]')===host)return {x,y};
   }
   return null;
  });
  check(empty&&await p.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('[data-world-render]'),empty),
    'The empty-scenery probe actually targets scenery, clear of navigation');
  await p.mouse.click(empty.x,empty.y);
  check(!(await state(p)).moving,'Empty scenery clicks never start walking');
  check(await p.locator('[data-world-reader]').isHidden(),'Empty scenery does not open a card');
  const visible=p.locator('[data-scene-object]:visible');check(await visible.count()>0,'Objects are discoverable at this size');
  if(viewport.width<720) {
    await p.locator('.world-dock [data-world-route="work"]').click();
    await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='work'&&
      !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
    check(await p.locator('.workspace-launcher').isVisible(),'The primary dock opens apps on phones without extra viewpoint chips');
    await p.locator('[data-world-close]').click();
  }
  for(const b of await visible.all()) {
    const r=await b.boundingBox();check(r.width>=44&&r.height>=44,'Hotspot has a 44px target');
  }
  await p.screenshot({path:artifact+'/'+viewport.width+'-coast.png'});
  const apps=p.locator('[data-scene-object="work"]');
  if(await apps.isVisible()) {
    await apps.click();await p.locator('[data-world-reader]').waitFor();
    await p.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
    check(await p.locator('[data-world-reader]').getAttribute('data-object')==='work','Pictured laptop opens apps');
    check(await p.locator('.scene-hotspots').isHidden(),'Overview markers disappear in close-ups');
    check(await p.locator('[data-world-close]').textContent()==='← Coast','Clear return action');
    await p.screenshot({path:artifact+'/'+viewport.width+'-apps.png'});
    await p.keyboard.press('Escape');check(await p.locator('[data-world-reader]').isHidden(),'Escape returns to scene');
  }
  if(!await p.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await p.locator('[data-settings-toggle]').click();
  await p.locator('[data-world-regions] [data-world-route="winter"]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='winter');
  check((await state(p)).snow===1,'Globe transforms the approved setting');
  check(await p.locator('[data-world-reader]').isHidden(),'Globe transforms scenery without a dialog');
  await p.screenshot({path:artifact+'/'+viewport.width+'-winter.png'});
  check(await p.locator('[data-scene-object="surf"],[data-scene-object="skate"],[data-scene-object="plants"],[data-scene-object="ball"]').count()===0,'Winter has no retired activity markers');
  if(!await p.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await p.locator('[data-settings-toggle]').click();
  await p.locator('[data-world-night]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1);
  check((await state(p)).lighting.ready,'Dusk loads the actual authored evening plates');
  await p.screenshot({path:artifact+'/'+viewport.width+'-winter-dusk.png'});
  if(!await p.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await p.locator('[data-settings-toggle]').click();
  await p.locator('[data-world-day]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===0);
  if(!await p.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await p.locator('[data-settings-toggle]').click();
  await p.locator('[data-world-route="coast"]').first().click();
  await p.locator('.world-dock [data-world-route="contact"]').click();
  await p.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  check(await p.locator('a[href="mailto:philalimov.apps@gmail.com"]').isVisible(),'Contact is readable on the phone');
  await p.locator('[data-world-close]').click();
  check(await p.locator('.scene-hotspots').isVisible(),'Close restores object exploration');
  await revealDesk(p);
  for(const id of ['books','fibonacci']) {
    const opener=id==='books'?p.locator('[data-scene-object="books"]'):p.locator('.world-dock [data-world-route="fibonacci"]');
    await opener.click();await p.locator('[data-world-reader]').waitFor();
    await p.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
    check((await state(p)).route===id,'A native click opens '+id+' on its real surface');
    await p.locator('[data-world-close]').click();
    check(await p.locator('[data-world-reader]').isHidden(),'Close exits '+id+' to the scene');
    await p.locator('[data-settings-toggle]').click();
    check(await p.locator('[data-world-text]').isVisible(),'Simple page remains available after '+id);
    await p.locator('[data-settings-toggle]').click();
  }
  check(await p.evaluate(()=>scrollY===0&&document.documentElement.scrollWidth<=innerWidth),'No document overflow');
  check(errors.length===0,'No runtime errors: '+errors.join('; '));await p.close();
 }
 const motion=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
 await motion.goto(url);await motion.waitForFunction(()=>document.querySelector('canvas')&&
   JSON.parse(document.querySelector('canvas').dataset.worldState).ready);
 await motion.locator('[data-settings-toggle]').click();
 await motion.locator('[data-world-regions] [data-world-route="winter"]').click();
 await motion.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).snow>.05);
 if(!await motion.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await motion.locator('[data-settings-toggle]').click();
 await motion.keyboard.press('p');const frozen=(await state(motion)).snow;
 await motion.waitForTimeout(180);check((await state(motion)).snow===frozen,'Pause freezes the seasonal blend');
 if(!await motion.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await motion.locator('[data-settings-toggle]').click();
 await motion.keyboard.press('p');
 await motion.locator('.world-dock [data-world-route="contact"]').click();
 await motion.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 check((await state(motion)).transition.phase==='settled','Opening an object cancels partial season changes');
 check(await motion.locator('a[href="mailto:philalimov.apps@gmail.com"]').isVisible(),'Animated close-up settles into readable contact');
 await motion.keyboard.press('Escape');
 check((await state(motion)).navigation==='objects'&&!(await state(motion)).moving,'Returning remains avatar-free');
 if(!await motion.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await motion.locator('[data-settings-toggle]').click();
 await motion.locator('[data-world-night]').click();
 await motion.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend>.05);
 if(!await motion.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await motion.locator('[data-settings-toggle]').click();
 await motion.keyboard.press('p');const pausedDusk=(await state(motion)).lighting.blend;
 await motion.waitForTimeout(180);check((await state(motion)).lighting.blend===pausedDusk,'Pause freezes dusk transition');
 if(!await motion.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await motion.locator('[data-settings-toggle]').click();
 await motion.keyboard.press('p');
 await motion.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1);
 await motion.close();
 const unavailable=await browser.newPage({reducedMotion:'reduce'});
 await unavailable.route('**/*-dusk-v*.webp',r=>r.abort());await unavailable.goto(url);
 await unavailable.waitForFunction(()=>document.querySelector('canvas')&&JSON.parse(document.querySelector('canvas').dataset.worldState).ready);
 if(!await unavailable.locator('.scene-settings').evaluate(n=>n.querySelector('[data-settings-toggle]').getAttribute('aria-expanded')==='true'))await unavailable.locator('[data-settings-toggle]').click();
 await unavailable.locator('[data-world-night]').click();
 await unavailable.waitForFunction(()=>!document.querySelector('[data-world-night]').disabled);
 check((await state(unavailable)).lighting.blend===0&&await unavailable.locator('[data-world-fallback]').isHidden(),
   'Optional dusk failure keeps the approved daylight scene usable');
 await unavailable.close();
 const fallback=await browser.newPage();
 await fallback.route('**/concept-coast-v2.webp',r=>r.abort());await fallback.goto(url);
 await fallback.locator('[data-world-fallback]').waitFor();
 check(await fallback.locator('#work').isVisible(),'Failed art restores the ordinary portfolio');
 check(await fallback.locator('.scene-hotspots').count()===0,'Fallback removes scene controls');await fallback.close();
 console.log(name+': '+checks+' object-navigation checks passed.');
} finally {await browser.close();}
