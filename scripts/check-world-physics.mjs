import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {walkable} from '../world-state.js';
const pw=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const name=process.env.STUDIO_BROWSER || 'chromium';
const url=process.env.STUDIO_URL || 'http://127.0.0.1:8765';
const art=resolve(import.meta.dirname, '../validation-artifacts/phase01', name);
await mkdir(art,{recursive:true});
const browser=await pw[name].launch({headless:true,
  ...(process.env.STUDIO_BROWSER_EXECUTABLE ? {executablePath:process.env.STUDIO_BROWSER_EXECUTABLE} : {}),
  ...(name==='chromium' ? {args:['--enable-unsafe-swiftshader']} : {})});
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
try {
 for (const viewport of (process.env.STUDIO_LAYOUT_ONLY ? [] : [{width:1440,height:900},{width:390,height:844}])) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});
  const errors=[],failures=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  page.on('requestfailed',r=>{if(!/ERR_ABORTED|cancelled/i.test(r.failure()?.errorText||''))
    failures.push(`${r.failure()?.errorText} ${r.url()}`);});
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')warnings.push(m.text());});
  await page.addInitScript(()=>{
    window.activityEvidence=[];
    function attach(){
      const canvas=document.querySelector('[data-world-render] canvas');
      if(!canvas)return;
      new MutationObserver(()=>{
        const state=JSON.parse(canvas.dataset.worldState);
        if(state.game)window.activityEvidence.push(state);
        if(window.activityEvidence.length>4000)window.activityEvidence.shift();
      }).observe(canvas,{attributes:true,attributeFilter:['data-world-state']});
    }
    document.addEventListener('DOMContentLoaded',attach,{once:true});
  });
  await page.goto(url);
  try {await page.waitForFunction(()=>document.body.dataset.worldReady==='true');}
  catch(error){
    console.error('World startup diagnostics', {errors,warnings,failures,
      document:await page.evaluate(()=>({ready:document.body.dataset.worldReady,
        stageHidden:document.querySelector('[data-world-stage]')?.hidden,readyState:document.readyState}))});
    throw error;
  }
  const state=()=>page.locator('[data-world-render] canvas').evaluate(n=>JSON.parse(n.dataset.worldState));
  async function go(id){
    if(!['work','resume','contact','experience','coast','winter','overview'].includes(id)) {
      await page.locator('[data-world-route="coast"]').first().click();
      await page.locator('[data-world-map] summary').click();
    }
    await page.locator(`[data-world-route="${id}"]`).first().click();
    await page.waitForFunction(id=>JSON.parse(document.querySelector('canvas').dataset.worldState).route===id,id);
    await page.evaluate(()=>{window.activityEvidence=[];});
  }
  async function snap(label){await page.screenshot({path:resolve(art,`${viewport.width}-${label}.png`)});}
  async function walkAway(label){
    const before=await state();
    check(!before.game&&walkable(before.position.x,before.position.z)&&before.position.y===0,
      `${label}: solid ground, upright pose, no active game`);
    const reader=await page.locator('[data-world-reader]').boundingBox();
    const surface=await page.locator('[data-world-render]').boundingBox();
    const actor=before.geometry.actorScreen;
    if(reader)check(actor.x+surface.x<reader.x||actor.x+surface.x>reader.x+reader.width||
      actor.y+surface.y+10<reader.y,`${label}: result panel leaves the person visible`);
    const host=page.locator('[data-world-render]');await host.focus();
    await page.keyboard.down('KeyS');
    await page.waitForFunction(start=>{
      const p=JSON.parse(document.querySelector('canvas').dataset.worldState).position;
      return Math.hypot(p.x-start.x,p.z-start.z)>=1;
    },before.position,{timeout:20000});
    await page.keyboard.up('KeyS');
    check(walkable((await state()).position.x,(await state()).position.z),`${label}: can walk a metre`);
  }
  const destinations=[];
  for(const id of ['work','resume','contact','experience','books']){
    await go(id);destinations.push((await state()).position);
    if(id==='resume')await page.locator('[data-resume-document] h1').waitFor();
  }
  check(new Set(destinations.map(p=>`${p.x},${p.z}`)).size===5,'Every portfolio destination is a different place');
  for(const id of ['plants','fibonacci']){await go(id);check(await page.locator('[data-world-reader]').isVisible(),
    `${id}: static station opens during the network tour`);}
  await go('surf');await page.locator('[data-game-start]').click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).game?.elapsed>.5);
  const surf1=await state();await page.waitForTimeout(400);const surf2=await state();
  check(surf1.geometry.wave.visible&&surf2.geometry.wave.visible,'A rendered wave mesh accompanies the board');
  check(surf1.geometry.wave.vertexY!==surf2.geometry.wave.vertexY,'Actual wave vertices move');
  check(!('height' in surf2.game)&&!('laps' in surf2.game),'Surf has no juggling or swimming fields');
  await snap('surf-playing');
  await page.waitForFunction(()=>document.querySelector('[data-game-status]').textContent.includes('Ride over'),null,
    {timeout:60000});
  await snap('surf-fall');await walkAway('Surf fall');
  await page.locator('[data-game-start]').click();
  // Play through the real held-button input, correcting drift from the displayed balance.
  await page.evaluate(()=>{
    window.surfPlayer=setInterval(()=>{
      const g=JSON.parse(document.querySelector('canvas').dataset.worldState).game;
      const left=document.querySelector('[data-lean="left"]'),right=document.querySelector('[data-lean="right"]');
      if(!g||g.type!=='surf') {
        left.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));
        right.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));
        clearInterval(window.surfPlayer);return;
      }
      const drift=.20+Math.sin(g.elapsed*1.7)*.35;
      const chosen=g.balance>.06||(g.balance>-.06&&drift>0)?left:right;
      (chosen===left?right:left).dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));
      chosen.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));
    },40);
  });
  await page.waitForFunction(()=>document.querySelector('[data-game-status]').textContent.includes('Wave complete'),null,
    {timeout:60000});
  check(Number(await page.locator('[data-game-score]').textContent())===12,'Successful ride ends at 12 seconds');
  await snap('surf-win');await walkAway('Surf win');
  await go('surf');await page.locator('[data-game-start]').click();
  await page.locator('[data-world-close]').click();await walkAway('Surf cancelled');
  await go('ball');await page.locator('[data-game-start]').click();
  await page.waitForFunction(()=>{
    const g=JSON.parse(document.querySelector('canvas').dataset.worldState).game;
    if(!g?.canKick)return false;
    document.querySelector('[data-world-pause]').click();return true;
  });
  const juggling=await state();
  check(!juggling.geometry.ballOccludedByAvatar,'Actual ball is visible beside the body');
  check(juggling.geometry.ball.y-.17>juggling.geometry.foot.y,'Kick cue appears with ball visibly above the foot');
  if(viewport.width<720){
    const reader=await page.locator('[data-world-reader]').boundingBox();
    const host=await page.locator('[data-world-render]').boundingBox();
    check(juggling.geometry.ballScreen.y+host.y<reader.y,'Mobile activity panel leaves the ball visible');
  }
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  check(await page.locator('.world-game-meter').evaluate(meter=>{
    const dot=meter.querySelector('span').getBoundingClientRect(),rect=meter.getBoundingClientRect();
    const zone=getComputedStyle(meter,'::before'),left=parseFloat(zone.left),width=parseFloat(zone.width);
    const centre=dot.x+dot.width/2-rect.x;return centre>=left-.5&&centre<=left+width+.5;
  }),'Kick cue matches the visible green meter region');
  check(await page.locator('[data-game-kick]').isDisabled(),'Paused round disables the kick control');
  await snap('juggle-kick-window');
  const help=page.getByText('How to play',{exact:true});
  await help.press('Space');
  check(await help.evaluate(n=>n.parentElement.open),'Keyboard opens game instructions');
  const untouched=await page.evaluate(async()=>{
    document.querySelector('[data-world-pause]').click();
    const summary=[...document.querySelectorAll('summary')].find(n=>n.textContent==='How to play');
    summary.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));
    await new Promise(resolve=>requestAnimationFrame(resolve));
    document.querySelector('[data-world-pause]').click();
    return JSON.parse(document.querySelector('canvas').dataset.worldState).game.score;
  });
  check(untouched===0,'Space on instructions cannot kick or change the score');
  await help.press('Space');
  await page.locator('[data-game-kick]').scrollIntoViewIfNeeded();
  await page.evaluate(()=>{
    document.querySelector('[data-world-pause]').click();
    document.querySelector('[data-game-kick]').click();
  });
  await page.waitForFunction(()=>Number(document.querySelector('[data-game-score]').textContent)===1);
  await snap('juggle-kick');
  await page.waitForFunction(()=>document.querySelector('[data-game-status]').textContent.includes('Round over'),null,
    {timeout:30000});
  await walkAway('Juggling drop');
  await page.locator('details:has([data-shot-kick]) summary').click();
  await page.locator('[data-shot-angle]').fill('0');await page.locator('[data-shot-power]').fill('16');
  await page.locator('[data-shot-kick]').click();
  await page.locator('[data-game-start]').click();
  check(!await page.locator('[data-shot-kick]').isDisabled(),'Interrupted shot can be played again');
  check(await page.locator('[data-shot-status]').textContent()==='Shot cancelled.',
    'Interrupted shot has a clear result');
  await page.evaluate(()=>{window.activityEvidence=[];});
  const beforeShot=(await state()).position;await page.locator('[data-shot-kick]').click();
  check(await page.locator('[data-game-kick]').isHidden(),'Juggling actions are hidden during a shot');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).game?.phase==='approaching');
  const approach=await page.evaluate(()=>window.activityEvidence.find(s=>s.game?.phase==='approaching')?.position);
  check(approach&&Math.hypot(approach.x-beforeShot.x,approach.z-beforeShot.z)<.5,'Futsal starts by walking, without teleporting');
  await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).game?.phase==='playing',null,
    {timeout:30000});
  await snap('futsal-launch');
  await page.waitForFunction(()=>document.querySelector('[data-shot-status]').textContent==='Goal!',null,{timeout:30000});
  const flight=await page.evaluate(()=>window.activityEvidence.filter(s=>s.game?.type==='penalty'));
  const launch=flight.find(s=>s.game.launch);
  check(launch&&Math.hypot(launch.game.launch.x-launch.geometry.foot.x,
    launch.game.launch.y-launch.geometry.foot.y,launch.game.launch.z-launch.geometry.foot.z)<.4,
    'Ball launches within 40 cm of the actual animated foot');
  check(flight.every(s=>s.geometry.ball.z>=-20.23),'Rendered ball never crosses the back net');
  check((await state()).geometry.ball.y===.17,'Finished shot restores the ball to ground');
  check((await state()).geometry.ball.x===-16&&(await state()).geometry.ball.z===-14,
    'Finished shot restores the penalty spot');
  await snap('futsal-goal');await walkAway('Futsal finished');
  await go('ball');await page.locator('[data-game-start]').click();
  await page.locator('[data-world-close]').click();await walkAway('Juggling cancelled');
  await go('tank');await page.locator('[data-tank-drive]').click();
  const tank=await state();
  check(tank.geometry.tank.size.x>3.8,'Tank is full sized against the person');
  check(tank.geometry.actor.max.y>tank.geometry.tank.max.y&&
    tank.geometry.actor.min.y<tank.geometry.tank.max.y,'Person is seated within the open hatch');
  check(await page.locator('[data-world-leave]').isVisible(),'Tank has a visible touch exit');
  await snap('tank-seated');await page.locator('[data-world-leave]').click();await walkAway('Tank cancelled');
  await go('skate');await page.locator('[data-skate-start]').click();
  await page.waitForFunction(()=>document.querySelector('[data-skate-status]').textContent.includes('Run over'),null,
    {timeout:30000});await walkAway('Skating loss');
  await go('skate');await page.locator('[data-skate-start]').click();
  await page.locator('[data-world-close]').click();await walkAway('Skating cancelled');
  await go('tank');await page.locator('[data-demo-open]').click();
  const frame=page.frameLocator('.world-demo .tank-frame');await frame.locator('[data-start]').waitFor();
  check(await frame.locator('body').evaluate(()=>window.origin==='null'),'Demo really runs in an opaque origin');
  check(await frame.locator('body').evaluate(()=>{try{void parent.document;return false;}catch{return true;}}),
    'Sandbox denies access to the parent document');
  check(await page.locator('.world-demo iframe').getAttribute('sandbox')==='allow-scripts','Demo has an opaque-origin sandbox');
  const button=await frame.locator('[data-start]').boundingBox(),iframe=await page.locator('.world-demo iframe').boundingBox();
  check(button.y>=iframe.y&&button.y+button.height<=iframe.y+iframe.height,'Start sector fits inside the visible frame');
  await frame.locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await snap('demo-start');await frame.locator('[data-start]').click();
  await frame.locator('canvas').evaluate(n=>new Promise(resolve=>{
    const timer=setInterval(()=>{if(JSON.parse(n.dataset.gameState).elapsedMs>50){clearInterval(timer);resolve();}},20);
  }));
  await page.locator('[data-demo-pause]').click();await page.waitForTimeout(100);
  const paused=await frame.locator('canvas').getAttribute('data-game-state');await page.waitForTimeout(200);
  check(await frame.locator('canvas').getAttribute('data-game-state')===paused,'MessagePort pauses sandboxed combat');
  await frame.locator('body').press('Escape');await page.waitForSelector('.world-demo',{state:'detached'});
  check(await page.locator('[data-demo-open]').evaluate(n=>n===document.activeElement),'Demo Escape restores launcher focus');
  check(errors.length===0,`No page errors: ${errors.join('; ')}`);
  check(failures.length===0,`No failed tour requests: ${failures.join('; ')}`);
  check(warnings.length===0,`No warnings: ${warnings.join('; ')}`);
  await page.close();
  console.log(`${name}: ${viewport.width}px physical activity tour passed`);
 }
 for(const viewport of [{width:320,height:844},{width:844,height:390}]){
  const p=await browser.newPage({viewport,reducedMotion:'reduce'});await p.goto(new URL('#tank',url).href);
  await p.locator('[data-demo-open]').click();const frame=p.frameLocator('.world-demo iframe');
  await frame.locator('[data-start]').waitFor();const button=await frame.locator('[data-start]').boundingBox();
  const parent=await p.locator('.world-demo iframe').boundingBox();
  check(button.y>=parent.y&&button.y+button.height<=parent.y+parent.height,'Narrow/landscape Start sector is visible');
  for(const control of await frame.locator('[data-direction],[data-ammo],[data-fire],[data-mine]').all()) {
    const b=await control.boundingBox();
    check(b.x>=parent.x&&b.x+b.width<=parent.x+parent.width+.5&&b.y>=parent.y&&
      b.y+b.height<=parent.y+parent.height+.5,'All narrow/landscape combat controls are visible');
  }
  check(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&
    document.documentElement.scrollHeight<=innerHeight),'Demo has no nested scrolling');
  await frame.locator('body').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await p.screenshot({path:resolve(art,`${viewport.width}-demo-start.png`)});
  await p.locator('[data-demo-close]').click();
  for(const id of ['surf','ball','skate','tank']) {
    await p.locator('[data-world-route="coast"]').first().click();
    await p.locator('[data-world-map] summary').click();
    await p.locator(`[data-world-route="${id}"]`).first().click();
    await p.locator(id==='tank'?'[data-tank-drive]':id==='skate'?'[data-skate-start]':'[data-game-start]').click();
    await p.locator('[data-world-pause]').click();
    const state=await p.locator('canvas').evaluate(n=>JSON.parse(n.dataset.worldState));
    const reader=await p.locator('[data-world-reader]').boundingBox();
    const host=await p.locator('[data-world-render]').boundingBox();
    const actor=state.geometry.actorScreen;
    check(actor.x>0&&actor.x<host.width&&actor.y>0&&actor.y<host.height,`${id}: actor is in view`);
    if(reader){
      const clip=await p.locator('[data-world-content]').boundingBox();
      const controls=p.locator('[data-game-start],[data-game-kick],[data-game-stroke],[data-lean],'+
        '[data-skate-start],[data-skate-steer]');
      for(const control of await controls.all()) {
        if(!await control.isVisible())continue;
        const b=await control.boundingBox();
        check(b.y>=clip.y&&b.y+b.height<=clip.y+clip.height+1&&b.x>=clip.x&&
          b.x+b.width<=clip.x+clip.width+1,`${id}: essential controls visible without scrolling`);
      }
    }
    if(reader)check(actor.x+host.x<reader.x||actor.x+host.x>reader.x+reader.width||
      actor.y+host.y<reader.y,`${id}: panel does not cover the actor`);
    await p.screenshot({path:resolve(art,`${viewport.width}-${id}-active.png`)});
  }
  await p.close();
 }
 console.log(`${name}: ${checks} physical, recovery, sandbox and network checks passed.`);
 } catch(error) {
  for(const context of browser.contexts())for(const page of context.pages()) {
    console.error('Physical failure evidence',await page.evaluate(()=>({
      state:JSON.parse(document.querySelector('canvas')?.dataset.worldState||'null'),
      status:document.querySelector('[data-game-status]')?.textContent,
      kick:document.querySelector('[data-game-kick]')?.disabled,hidden:document.hidden
    })).catch(()=>null));
    await page.screenshot({path:resolve(art,'failure.png')}).catch(()=>{});
  }
  throw error;
}finally{await browser.close();}
