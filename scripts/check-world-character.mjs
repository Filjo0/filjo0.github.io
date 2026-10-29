import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium';
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}:{})});
const url=process.env.STUDIO_URL||'http://127.0.0.1:8765/?navigation=walk';
const artifact='validation-artifacts/'+name+'/character';await mkdir(artifact,{recursive:true});
let checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
async function state(page){return page.locator('[data-world-render] canvas').evaluate(c=>JSON.parse(c.dataset.worldState));}
async function ready(page,status='model'){await page.waitForFunction(s=>{
 const canvas=document.querySelector('[data-world-render] canvas');return canvas&&JSON.parse(canvas.dataset.worldState).character===s;
},status,{timeout:30000});}
async function route(page,id){const target=page.locator('[data-world-route="'+id+'"]').first();if(!await target.isVisible())await page.locator('[data-world-map] summary').click();await target.click();await page.waitForFunction(id=>JSON.parse(document.querySelector('canvas').dataset.worldState).route===id,id);}
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await ready(page);const start=await state(page);
  check(start.geometry.actor.size.y>1.7&&start.geometry.actor.size.y<1.9,'Adult human height');
  check(Math.abs(start.geometry.actor.min.y)<.06,'Shoes rest on ground');
  await page.locator('[data-world-render]').focus();await page.keyboard.down('KeyW');
  await page.waitForFunction(before=>{const s=JSON.parse(document.querySelector('canvas').dataset.worldState);return Math.hypot(s.position.x-before.x,s.position.z-before.z)>.5;},start.position);
  const moving=await state(page);await page.keyboard.up('KeyW');
  check(JSON.stringify(moving.geometry.hands)!==JSON.stringify(start.geometry.hands),'Actual rigged hands move while walking');
  check(moving.geometry.actor.min.y>-.10,'Walking stays above ground');
  await route(page,'winter');const winter=await state(page);
  check(winter.character==='model'&&winter.region==='winter','Character remains available in winter');
  check(winter.geometry.actor.size.x>start.geometry.actor.size.x,'Winter coat changes actual silhouette');
  await page.screenshot({path:artifact+'/'+viewport.width+'x'+viewport.height+'-winter.png'});
  await route(page,'coast');check((await state(page)).region==='coast','Coast remains reachable');
  check(errors.length===0,'No character page errors');await page.close();
 }
 for(const corruption of ['missing','corrupt']){
  const page=await browser.newPage({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets/outdoor/person.glb',r=>r.fulfill({status:corruption==='missing'?404:200,contentType:'model/gltf-binary',body:corruption==='missing'?'Not found':'broken model'}));
  await page.goto(url);await ready(page,'fallback');check((await state(page)).geometry.actor.size.y>1.5,'Fallback person still visible');
  await route(page,'contact');await page.locator('[data-world-reader]').waitFor({state:'visible'});check((await page.locator('[data-world-reader]').textContent()).includes('philalimov.apps@gmail.com'),'Contact works with '+corruption+' model');check(errors.length===0,'Fallback avoids page errors');await page.close();
 }
 const page=await browser.newPage({reducedMotion:'reduce'});let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/assets/outdoor/person.glb',async r=>{await gate;await r.continue()});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.worldReady==='true');
 await route(page,'ball');await page.locator('[data-game-start]').click();release();await ready(page,'waiting');
 check((await state(page)).game?.type==='ball','A delayed model never interrupts juggling');
 await page.locator('[data-world-close]').click();await ready(page);check(!(await state(page)).game,'Character adopts after the activity exits');await page.close();
 console.log(name+': '+checks+' character, wardrobe, movement and fallback checks passed');
} finally {await browser.close();}
