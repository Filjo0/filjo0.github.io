import {sceneFixtureURL} from './scene-fixture-url.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {markerEvidence} from './marker-browser-evidence.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const base=sceneFixtureURL(),out=(process.env.OBJECT_MARKER_ARTIFACT_DIR||'validation-artifacts/object-markers-30oct/after')+'/'+engine;
await mkdir(out,{recursive:true});
const b=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const sizes=[[1440,900],[1280,720],[390,844],[390,664],[375,553],[320,568],[320,844],[844,390],[568,320],[844,280],[568,280]],errors=[],evidence=[];
let checks=0,current;const check=(v,m)=>{assert.ok(v,m);checks++;};
const ready=p=>p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true'&&
 document.querySelector('[data-world-render]').clientHeight===innerHeight&&document.querySelector('.scene-hotspots')?.dataset.markerLayout==='ready');
const opened=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]')?.dataset.object===id&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening')&&!document.querySelector('.linked-input-shield'),id);
async function press(n,touch){
 if(await n.evaluate(e=>e.classList.contains('scene-object-dot'))){const box=await n.boundingBox(),p=n.page();
  if(touch)await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);else await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
 }else touch?await n.tap():await n.click();
}
async function close(p,touch){await press(p.locator('[data-world-close]'),touch);await p.waitForFunction(()=>document.querySelector('[data-world-reader]').hidden);}
try{
 for(const mode of ['delayed','failed']){
  const p=await b.newPage({viewport:{width:375,height:553},hasTouch:true,isMobile:true,reducedMotion:'reduce'});current=p;
  p.on('pageerror',e=>errors.push(e.message));
  let releaseFont;const heldFont=new Promise(resolve=>{releaseFont=resolve;});
  await p.route('**/assets/fonts/zalando-sans-expanded/medium-latin.woff2',async route=>{
   if(mode==='delayed'){await heldFont;await route.continue();}else await route.abort();
  });
  const requested=p.waitForRequest(r=>r.url().endsWith('/medium-latin.woff2'));
  await p.goto(base,{waitUntil:'domcontentloaded'});await requested;
  if(mode==='delayed'){
   try{check(await p.locator('.scene-marker-name').count()===0,'Initial capsules wait for final font metrics instead of exposing fallback-width placement');}
   finally{releaseFont();}
  }
  await ready(p);await p.evaluate(()=>document.fonts.ready);
  if(mode==='delayed')await markerEvidence(p,check);
  else{
   const fallback=await p.locator('[data-scene-object]:not([hidden]) .scene-object-label').evaluateAll(nodes=>nodes.map(n=>{
    const label=n.querySelector('.scene-marker-name'),style=getComputedStyle(label);
    const canvas=document.createElement('canvas'),paint=canvas.getContext('2d');paint.fillStyle=style.backgroundColor;paint.fillRect(0,0,1,1);
    return {box:n.getBoundingClientRect().toJSON(),font:parseFloat(style.fontSize),color:style.color,surface:[...paint.getImageData(0,0,1,1).data]};
   }));
   check(fallback.length>=5,'A failed optional font preserves the pictured controls');
   for(const item of fallback)check(item.box.width>=44&&item.box.height>=44&&item.font>=13&&
    item.color==='rgb(0, 0, 0)'&&item.surface[0]>=250&&item.surface[1]>=245&&item.surface[2]>=235&&item.surface[3]>=170&&item.surface[3]<=215,'System fallback retains target size and readable glass name pills');
   for(const a of fallback)for(const c of fallback)if(a!==c)
    check(a.box.right<=c.box.left||c.box.right<=a.box.left||a.box.bottom<=c.box.top||c.box.bottom<=a.box.top,
     'Font failure cannot leave overlapping native controls');
  }
  await press(p.locator('[data-scene-object="work"] .scene-object-label'),true);await opened(p,'work');await close(p,true);
  check(await p.locator('[data-world-reader]').isHidden(),mode+': font loading preserves one-tap entry and Back');
  await p.screenshot({path:out+'/font-'+mode+'.png'});await p.close();
 }
 for(const [width,height] of sizes){
  const touch=width<960,p=await b.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'reduce'});current=p;
  p.on('pageerror',e=>errors.push(e.message));console.log(engine+': markers '+width+'x'+height);
  await p.goto(base);await ready(p);await p.evaluate(()=>document.fonts.ready);
  if(width===320)check(await p.locator('[data-scene-object="contact"]').isVisible(),'The tiny pictured phone retains its padded target at 320px');
  if(width===320&&height===844)check(await p.locator('[data-scene-object="books"]').isVisible(),'The tall narrow Book remains keyboard reachable');
  for(const area of ['desk','coast']){
   const frame=p.locator('[data-scene-framing]');
   if(area==='coast'&&await frame.isVisible()){
    await press(frame,touch);await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneFrameMode==='coast');
   }
   await ready(p);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const measured=await markerEvidence(p,check);evidence.push({width,height,area,markers:measured.objects});
   check(await p.locator('.scene-hotspots').getAttribute('data-intro')===null,'No timed arrival names or sweep');
   check(await p.locator('.scene-hotspots').evaluate(n=>n.getAnimations({subtree:true}).length===0),'Reduced motion has no marker animations');
   await p.screenshot({path:out+'/'+width+'x'+height+'-'+area+'.png'});
   for(const m of measured.objects){
    const target=p.locator('[data-scene-object="'+m.id+'"]');
    for(const part of ['.scene-object-dot','.scene-object-label']){
     if(m.id==='globe'){
      const before=await p.locator('body').getAttribute('data-world-region');await press(target.locator(part),touch);
      await p.waitForFunction(old=>document.body.dataset.worldRegion!==old,before);
      check(await p.locator('[data-world-reader]').isHidden(),'Both globe targets transform the scene without a panel');
     }else{
      await press(target.locator(part),touch);const id=['aqua','futsl'].includes(m.id)?'work':m.id;await opened(p,id);
      check(await p.locator('[data-world-reader]').getAttribute('data-object')===id,m.id+': '+part+' opens the intended object in one tap');
      if(['aqua','futsl'].includes(m.id))check(await p.locator('[data-app-card="'+m.id+'"]').getAttribute('data-selected')==='true',m.id+': the correct real app is selected');
      await close(p,touch);
     }
    }
    if(m.id!=='globe'){
     await p.keyboard.press('Tab');await target.focus();
     check(await target.getAttribute('data-hotspot-state')==='focus',m.id+': native focus keeps the object highlight');
     check(await target.locator('.scene-marker-name').evaluate(n=>parseFloat(getComputedStyle(n).outlineWidth)>=2),m.id+': its pill has a visible keyboard focus ring');
     await p.keyboard.press('Enter');await opened(p,['aqua','futsl'].includes(m.id)?'work':m.id);
     await p.keyboard.press('Escape');await p.waitForFunction(id=>document.activeElement===document.querySelector('[data-scene-object="'+id+'"]'),m.id);
     check(await target.evaluate(n=>document.activeElement===n),m.id+': Escape restores the exact marker');
    }
   }
   // Leave no transient hover/focus state for the next native snapshot.
   await p.mouse.move(width-4,100);await p.locator('[data-world-render]').focus();
  }
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-regions] [data-world-route="winter"]').click();
  await p.waitForFunction(()=>document.body.dataset.worldRegion==='winter');
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-night]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1);
  await p.keyboard.press('Escape');await ready(p);await markerEvidence(p,check);
  await p.screenshot({path:out+'/'+width+'x'+height+'-winter-night.png'});
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No sideways document overflow');
  await p.close();
 }
 // Attached tabs remain discoverable without motion or a timed reveal.
 const p=await b.newPage({viewport:{width:390,height:664},hasTouch:true,reducedMotion:'no-preference'});current=p;
 p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await ready(p);
 const names=await p.locator('[data-scene-object]:visible .scene-marker-name').allTextContents();
 await p.waitForTimeout(3500);
 check(JSON.stringify(await p.locator('[data-scene-object]:visible .scene-marker-name').allTextContents())===JSON.stringify(names),
  'The names remain without fading after the former reveal interval');
 const readPulse=()=>p.locator('[data-scene-object]:visible .scene-object-dot').evaluateAll(ns=>ns.map(n=>{
  const pulse=getComputedStyle(n,'::after'),box=n.getBoundingClientRect();
  return {name:pulse.animationName,delay:pulse.animationDelay,opacity:parseFloat(pulse.opacity),x:box.x+box.width/2,y:box.y+box.height/2};
 }));
 const pulseBefore=await readPulse();await p.waitForTimeout(450);const pulseAfter=await readPulse();
 check(pulseBefore.every(value=>value.name==='scene-marker-breathe'),'Every visible marker has the gentle halo animation');
 check(new Set(pulseBefore.map(value=>value.delay)).size===pulseBefore.length,'Marker pulses are staggered');
 check(pulseBefore.some((value,i)=>Math.abs(value.opacity-pulseAfter[i].opacity)>.01),'The halo visibly changes over time');
 check(pulseBefore.every((value,i)=>Math.hypot(value.x-pulseAfter[i].x,value.y-pulseAfter[i].y)<.1),'Animation never moves a calibrated dot');
 check(await p.locator('[data-scene-object],.scene-object-label,.scene-marker-name').evaluateAll(ns=>ns.every(n=>n.getAnimations().length===0)),
  'Names and native hit targets stay still while the decorative halo animates');
 await p.keyboard.press('p');
 check(await p.locator('[data-world-pause]').getAttribute('aria-pressed')==='true','The native pause shortcut pauses the site');
 check(await p.locator('.scene-hotspots').evaluate(n=>n.getAnimations({subtree:true}).length===0),'Pausing leaves the marker surface still');
 await p.keyboard.press('p');await ready(p);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 check(await p.locator('.scene-hotspots').evaluate(n=>n.getAnimations({subtree:true}).length===0),'A hidden document has no active tab animation');
 await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-reduce-motion]').click();await p.keyboard.press('Escape');
 check(await p.locator('[data-world-reduce-motion]').getAttribute('aria-checked')==='true'&&
  await p.locator('body').getAttribute('data-motion')==='reduce','The visitor preference actually enables reduced motion');
 check(await p.locator('.scene-object-dot').first().evaluate(n=>getComputedStyle(n,'::after').animationName==='none'),
  'Reduced-motion CSS immediately removes the pulse');
 // Returning focus can create a 0.01ms CSS transition. Let it paint, but require
 // exactly zero animations, rather than filtering or ignoring any active effect.
 await p.waitForFunction(()=>document.querySelector('.scene-hotspots').getAnimations({subtree:true}).length===0,null,{timeout:1000});
 check(await p.locator('.scene-hotspots').evaluate(n=>n.getAnimations({subtree:true}).length===0),'Reduce motion stops the pulse entirely');
 check(await p.locator('[data-scene-object]:visible .scene-object-label').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).opacity==='1')),
  'Reducing motion never removes names');
 await p.close();
 check(errors.length===0,'No runtime errors: '+errors.join('; '));
 await writeFile(out+'/results.json',JSON.stringify({engine,checks,evidence,errors},null,2));
 console.log(engine+': '+checks+' persistent marker checks passed.');
}catch(e){
 if(current&&!current.isClosed()){await current.screenshot({path:out+'/failure.png'});
  const motion=await current.evaluate(()=>({choice:document.body.dataset.motion,
   animations:document.querySelector('.scene-hotspots')?.getAnimations({subtree:true}).map(a=>({
    type:a.constructor.name,name:a.animationName,property:a.transitionProperty,timing:a.effect.getComputedTiming()}))}));
  await writeFile(out+'/failure.json',JSON.stringify({error:e.message,errors,motion,markerEvidence:e.markerEvidence},null,2));}
 throw e;
}finally{await b.close();}
