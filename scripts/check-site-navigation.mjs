import {containsPrivateProject} from './public-content-guard.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const art='validation-artifacts/site-review-14oct-implementation/'+name;await mkdir(art,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(v,m)=>{assert.ok(v,m);checks++;};
async function tap(p,target,touch){
 await target.scrollIntoViewIfNeeded();
 if(touch){const r=await target.boundingBox();await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}else await target.click();
}
async function settled(p,id){await p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);}
try{for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:844,height:390}]){
 const touch=viewport.width<720||viewport.height<500,p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'}),errors=[];current=p;
 p.on('pageerror',e=>errors.push(e.message));console.log(name+': navigation '+viewport.width+'px');
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true');
 check(await p.evaluate(()=>document.activeElement===document.body),'Startup leaves focus on the document');
 await p.keyboard.press('Tab');
 check(await p.locator('.skip-link').evaluate(n=>document.activeElement===n),'First Tab reaches Skip to content');
 const role=p.locator('.world-identity p');check(await role.isVisible(),'Role is visible on the first screen');
 check(await role.innerText()==='Quality engineer & product builder · Perth','Role uses the approved existing copy');
 check(await role.evaluate(n=>n.scrollWidth<=n.clientWidth+1&&n.getBoundingClientRect().height<=parseFloat(getComputedStyle(n).lineHeight)+1),
  'The complete role fits one line');
 const dock=p.locator('.world-dock');
 check(await dock.locator(':scope > a').allTextContents().then(a=>a.join('|')==='My apps|About|Résumé|Contact|Maths'),
  'The primary dock names all portfolio destinations');
 check(await dock.locator(':scope > a').count()===5&&await p.locator('[data-world-map]').isHidden(),'Five direct links replace the activity catalogue');
 check(await p.locator('.scene-pan').count()===0,'No viewpoint chips compete with main navigation');
 for(const target of await dock.locator(':scope > a, :scope > details > summary').all()){
  const r=await target.boundingBox();check(r.height>=43&&r.x>=0&&r.x+r.width<=viewport.width+1,'A readable dock action fits the viewport');
 }
 for(const marker of await p.locator('[data-scene-object]:visible').all())
  check(await marker.evaluate(n=>{const r=n.getBoundingClientRect();
   return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-scene-object]')===n;
  }),'Every visible object center is clickable without interception');
 const labels=p.locator('[data-scene-object]:visible > span:last-child');
 for(const label of await labels.all()){
  await label.locator('..').focus();
  await p.waitForFunction(id=>Number(getComputedStyle(document.querySelector('[data-scene-object="'+id+'"] .scene-object-label')).opacity)>.99,
   await label.evaluate(n=>n.closest('button').dataset.sceneObject));
  check(await label.evaluate(n=>Number(getComputedStyle(n).opacity)>.99),'Keyboard focus reveals the attached name');
  const r=await label.boundingBox();check(r.x>=0&&r.x+r.width<=viewport.width+1,'Marker labels stay within the viewport');
  const own=await label.evaluate(n=>n.closest('button').dataset.sceneObject);
  for(const marker of await p.locator('[data-scene-object]:visible').all()){
   if(await marker.getAttribute('data-scene-object')===own)continue;
   const box=await marker.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
   check(!(x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height),'A label never blocks another object click target');
  }
 }
 await p.screenshot({path:art+'/'+viewport.width+'-overview.png'});
 await tap(p,dock.locator('[data-world-route="fibonacci"]'),touch);await settled(p,'fibonacci');
 check(await p.locator('.maths-notebook').isVisible(),'Maths opens directly without a menu');
 await p.locator('[data-world-close]').click();
 await tap(p,dock.locator('[data-world-route="work"]'),touch);await settled(p,'work');
 await tap(p,p.locator('[data-demo-open]'),touch);
 const game=p.frameLocator('.tank-frame');await game.locator('html[data-connected="true"]').waitFor();
 check(await p.locator('[data-world-reader]').getAttribute('data-object')==='work','Treadfront uses the real laptop surface');
 check(await p.locator('[data-tank-drive]').count()===0,'There is no empty duplicate tank sheet');
 check(await p.locator('.tank-frame').getAttribute('sandbox')==='allow-scripts','The opaque one-sector sandbox is preserved');
 const state=await game.locator('canvas').evaluate(n=>JSON.parse(n.dataset.gameState));
 check(state.phase==='ready'&&state.levelId==='outer-wall','The single approved sector is ready');
 await tap(p,game.locator('[data-start]'),touch);
 check(await game.locator('canvas').evaluate(n=>JSON.parse(n.dataset.gameState).phase==='playing'),'A native Start plays the actual sector');
 await p.screenshot({path:art+'/'+viewport.width+'-treadfront.png'});
 if(await p.locator('[data-demo-close]').isVisible())await p.locator('[data-demo-close]').click();else await tap(p,p.locator('[data-world-close]'),touch);
 await p.locator('.tank-frame').waitFor({state:'detached'});
 const app=await p.locator('.workspace-app[data-demo-open]').boundingBox(),reader=await p.locator('[data-world-reader]').boundingBox();
 check(app.y>=reader.y-1&&app.y+app.height<=reader.y+reader.height+1,'Back restores the visible Treadfront card');
 await p.locator('[data-world-close]').click();check(await p.locator('[data-world-intro]').isHidden(),'The hint stays dismissed after the first interaction');
 for(const [id,canonical] of [['coaching','experience'],['tennis','work'],['receipts','work']]){
  await p.evaluate(id=>{location.hash=id;},id);await settled(p,canonical);
  const copy=await p.locator('[data-world-content]').textContent();
  check(copy.trim().length>100&&await p.locator('[data-discovery]').count()===0,id+': old deep links open canonical content rather than blank sheets');
  check(!containsPrivateProject(copy),id+': private descriptions are absent');
  if(id==='coaching')check(copy.includes('Floreat Athena FC')&&copy.includes('Football Australia C Licence'),'Approved public coaching facts remain in About');
  await p.locator('[data-world-close]').click();
 }
 check(errors.length===0,'No page errors: '+errors.join('; '));await p.close();
}console.log(name+': '+checks+' whole-site navigation checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:art+'/failure.png'});throw e;}finally{await browser.close();}
