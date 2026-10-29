import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765/?navigation=walk';
const artifact=resolve(import.meta.dirname,'../validation-artifacts/concept-scenes',name);await mkdir(artifact,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
const state=p=>p.locator('[data-world-render] canvas').evaluate(n=>JSON.parse(n.dataset.worldState));
const ready=p=>p.waitForFunction(()=>{const c=document.querySelector('[data-world-render] canvas');
 return c&&JSON.parse(c.dataset.worldState).ready&&JSON.parse(c.dataset.worldState).character==='model';});
async function go(p,id) {
 const link=p.locator('[data-world-route="'+id+'"]').first();
 if(!await link.isVisible())await p.locator('[data-world-map] summary').click();
 await link.click();await p.waitForFunction(id=>JSON.parse(document.querySelector('canvas').dataset.worldState).route===id,id);
 if(!['overview','coast','winter'].includes(id))await p.locator('[data-world-reader]').waitFor({state:'visible'});
}
try {
 for(const viewport of [{width:1672,height:941},{width:390,height:844},{width:320,height:844},{width:844,height:390}]) {
  const p=await browser.newPage({viewport,reducedMotion:'reduce',hasTouch:viewport.width<700});
  const errors=[],bad=[];p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
  await p.goto(url);await ready(p);const start=await state(p);
  check(start.renderer==='concept-scenes','Approved plates are the actual homepage');
  check(start.walkable&&start.geometry.actor.size.y>1.7&&start.geometry.actor.size.y<1.9,'Grounded adult visitor');
  check(await p.locator('.world-intro h2').isHidden(),'No large card over the composition');
  check((await p.locator('.world-dock a').allTextContents()).join('|')==='My apps|About me|Résumé|Contact','Intent-based navigation');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&scrollY===0),'Viewport fits');
  const header=await p.locator('.world-header').boundingBox();
  for(const selector of ['[data-world-globe]','[data-world-pause]','[data-world-night]','[data-world-route="winter"]']) {
    const control=await p.locator(selector).first().boundingBox();
    check(control.x>=0&&control.y>=0&&control.x+control.width<=viewport.width&&
      control.y+control.height<=header.y+header.height,'Header control is fully visible: '+selector);
  }
  await p.screenshot({path:artifact+'/'+viewport.width+'-coast.png'});
  await p.locator('[data-world-globe]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='winter');
  const cold=await state(p);
  check(cold.snow===1&&cold.transition.phase==='settled','Globe transforms this setting into winter');
  check(cold.position.z>-15&&cold.walkable,'Globe approaches the pictured desk without leaving the setting');
  check(await p.locator('[data-world-reader]').isHidden(),'Globe is not a generic dialog');
  await p.screenshot({path:artifact+'/'+viewport.width+'-winter.png'});
  const same=cold.position;await go(p,'coast');const warm=await state(p);
  check(warm.region==='coast'&&warm.position.x===same.x&&warm.position.z===same.z,'Direct season control keeps the same position');
  const positions=[];
  for(const id of ['work','experience','resume','contact']) {
   await go(p,id);const s=await state(p);positions.push([s.position.x,s.position.z].join(','));
   check(await p.locator('[data-world-reader]').getAttribute('data-object')===id,id+' uses its actual object');
   const reader=await p.locator('[data-world-reader]').boundingBox(),dock=await p.locator('.world-dock').boundingBox();
   check(reader.y+reader.height<dock.y,id+' is clear of the dock');
   await p.screenshot({path:artifact+'/'+viewport.width+'-'+id+'.png'});
   if(id==='resume')check(await p.locator('[data-resume-document] h1').textContent()==='Philipp Alimov','Approved résumé remains integrated');
   if(id==='contact')check(await p.locator('a[href="mailto:philalimov.apps@gmail.com"]').isVisible(),'Approved contact action');
   await p.keyboard.press('Escape');
  }
  check(new Set(positions).size===4,'Portfolio destinations have distinct walk-up positions');
  await go(p,'books');await p.locator('[data-reading-topic]').selectOption('maths');
  check(await p.locator('[data-world-reader]').getAttribute('data-object')==='books','Reading choices are on a book');await p.locator('[data-world-close]').click();
  await go(p,'fibonacci');
  if(await p.locator('[data-maths-chapter="0"]').isVisible())await p.locator('[data-maths-chapter="0"]').click();
  await p.locator('[data-maths-next]').click();
  await p.waitForFunction(()=>document.querySelector('[data-maths-step]').dataset.animating==='false');
  const before=await p.locator('[data-seed-art]').innerHTML();await p.locator('[data-maths-next]').click();
  await p.waitForFunction(()=>document.querySelector('[data-maths-step]').dataset.animating==='false');
  check(before!==await p.locator('[data-seed-art]').innerHTML(),'The sunflower angle changes real notebook geometry');
  check(await p.locator('[data-sunflower-seed]').count()===800,'The illustrated head stays bounded');
  await p.locator('[data-world-close]').click();
  await go(p,'plants');await p.locator('[data-plant-choice="rosemary"]').click();await p.locator('[data-plant-step]').click();
  check(await p.locator('.garden-stages [data-complete="true"]').count()===2&&
    await p.locator('.planter-study [data-plant-art]').getAttribute('data-stage')==='1','Soil and planted starter retain progress');await p.locator('[data-world-close]').click();
  for(const id of ['ball','surf']) {
   await go(p,id);await p.locator('[data-game-start]').click();
   await p.waitForFunction(id=>JSON.parse(document.querySelector('canvas').dataset.worldState).game?.type===id,id);
   const game=await state(p);check(game.geometry.actor.size.y>0,'Actual player geometry exists in '+id);
   const actor=game.geometry.actorScreen,sceneBox=await p.locator('[data-world-render]').boundingBox();
   const hud=await p.locator('[data-world-reader]').boundingBox();
   check(actor.x+sceneBox.x<hud.x||actor.x+sceneBox.x>hud.x+hud.width||
     actor.y+sceneBox.y<hud.y||actor.y+sceneBox.y>hud.y+hud.height,id+' HUD leaves the actual visitor visible');
   if(id==='ball') {
    const b=game.geometry.ballScreen,host=await p.locator('[data-world-render]').boundingBox();
    const panel=await p.locator('[data-world-reader]').boundingBox();
    check(b.x>=0&&b.x<viewport.width&&b.y>=0&&b.y<host.height,'Juggling ball is in the visible scene');
    check(b.x+host.x<panel.x||b.x+host.x>panel.x+panel.width||
      b.y+host.y<panel.y||b.y+host.y>panel.y+panel.height,'Game controls do not cover the real ball');
   }
   if(id==='surf')check(game.geometry.wave.visible&&game.geometry.wave.vertexY!==0,'Surf wave has real moving geometry');
   await p.screenshot({path:artifact+'/'+viewport.width+'-'+id+'-playing.png'});
   await p.keyboard.press('Escape');const end=await state(p);
   check(!end.game&&end.walkable&&Math.abs(end.geometry.actor.min.y)<.08,id+' exit restores grounded walking');
   const z=end.position.z;await p.locator('[data-world-render]').focus();await p.keyboard.down('KeyW');await p.waitForTimeout(220);
   await p.keyboard.up('KeyW');check((await state(p)).position.z<z-.1,id+' exit accepts actual movement');
  }
  await go(p,'tank');await p.locator('[data-tank-drive]').click();
  const driving=await state(p),centre=driving.geometry.tank.min.z;
  check(driving.game.type==='drive'&&driving.walkable,'Tank operator stands on solid ground');
  await p.locator('[data-world-render]').focus();await p.keyboard.down('KeyW');
  await p.waitForFunction(z=>JSON.parse(document.querySelector('canvas').dataset.worldState).geometry.tank.min.z<z-.15,centre);
  await p.keyboard.up('KeyW');check((await state(p)).geometry.tank.min.z<centre-.15,'The real tank responds to controls');
  await p.screenshot({path:artifact+'/'+viewport.width+'-tank-playing.png'});
  await p.keyboard.press('Escape');check(!(await state(p)).game&&(await state(p)).walkable,'Tank exits to walking');
  await go(p,'skate');check((await state(p)).region==='winter','Skating chooses the matching winter scene');
  await p.locator('[data-world-close]').click();await go(p,'surf');check((await state(p)).region==='coast','Surfing returns to the coastal sea');
  await p.locator('[data-world-close]').click();
  await go(p,'contact');await p.locator('[data-world-text]').click();
  check(await p.locator('#work').isVisible()&&await p.locator('#contact').isVisible(),'Text fallback restores approved portfolio');
  check(await p.locator('canvas').count()===0,'Text mode disposes the scene');
  check(errors.length===0,errors.join(';'));check(bad.length===0,bad.join(';'));await p.close();
 }
 const p=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'no-preference'});
 await p.goto(url);await ready(p);await p.locator('[data-world-globe]').click();
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).transition.phase==='transition');
 await p.locator('[data-world-pause]').click();const frozen=(await state(p)).snow;await p.waitForTimeout(300);
 check((await state(p)).snow===frozen,'Pause freezes the seasonal transformation');
 await p.locator('[data-world-pause]').click();await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='winter');
 await p.locator('[data-world-globe]').click();await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).transition.phase==='transition');
 await p.keyboard.press('Escape');check((await state(p)).region==='winter'&&(await state(p)).snow===1,'Escape cancels partial transformation safely');
 await p.locator('[data-world-route="coast"]').click();await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).snow<.8);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=(await state(p)).snow;await p.waitForTimeout(250);check((await state(p)).snow===hidden,'Hidden page freezes transformation');
 await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='coast');
 await p.evaluate(()=>{window.conceptFrames=0;const raf=requestAnimationFrame;window.requestAnimationFrame=f=>{window.conceptFrames++;return raf(f);};});
 await p.waitForTimeout(180);const count=await p.evaluate(()=>window.conceptFrames);await p.waitForTimeout(250);
 check(await p.evaluate(()=>window.conceptFrames)===count,'Scene stops rendering when idle');await p.close();
 const failed=await browser.newPage();await failed.route('**/concept-winter-v2.webp',r=>r.fulfill({status:404,body:'missing'}));
 await failed.goto(url);await failed.locator('#work').waitFor({state:'visible'});
 check(await failed.locator('[data-world-stage]').isHidden(),'Missing artwork recovers to the usable portfolio');await failed.close();
 console.log(name+': '+checks+' concept scene, navigation, activity and snow-globe checks passed');
} finally {await browser.close();}
