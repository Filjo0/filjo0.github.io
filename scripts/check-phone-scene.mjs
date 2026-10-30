import assert from 'node:assert/strict';
import {dragScene} from './outline-browser-evidence.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'webkit';
const base=process.env.STUDIO_URL||'http://127.0.0.1:8765/',out=(process.env.PHONE_SCENE_ARTIFACT_DIR||'validation-artifacts/phone-pan-30oct/checks')+'/'+engine;
await mkdir(out,{recursive:true});const layout=JSON.parse(await readFile('assets/outdoor/hotspot-layout.json','utf8'));
const browser=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const evidence=[],errors=[],check=(v,m)=>{assert.ok(v,m);checks++;};
const ready=p=>p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true');
const opened=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]')?.dataset.object===id&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
const paint=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));

const stopped=p=>p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.scenePanning==='false');
const frame=p=>p.evaluate(()=>{const m=document.querySelector('.scene-object-effects defs g[id$="-plate"]').transform.baseVal.consolidate().matrix;
 return {width:m.a*1672,height:m.d*941,left:-m.e,top:-m.f};});
async function cover(p,size){
 const f=await frame(p),full=Math.max(size.width,size.height*1672/941);
 check(Math.abs(f.width-full)<1&&Math.abs(f.height-full*941/1672)<1,'Independent projected image scale fills the viewport');
 check(f.left>=-1&&f.top>=-1&&f.width-f.left>=size.width-1&&f.height-f.top>=size.height-1,'All viewport edges are covered by the photograph');
 check(await p.locator('[data-world-render]').evaluate(n=>getComputedStyle(n,'::before').content==='none'),'No blurred extension or letterbox bands');
}

async function activate(n,touch){
 await n.scrollIntoViewIfNeeded();const destination=await n.getAttribute('data-scene-destination');
 touch?await n.tap():await n.click();
 // Native touch can return at pointerup, before its click and the resulting camera update.
 if(destination)await n.page().waitForFunction(area=>{
  const host=document.querySelector('[data-world-render]');return host.dataset.sceneFrameMode===area&&host.dataset.scenePanning==='false';
 },destination);
}
try{
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1440,height:900}]){
  const touch=viewport.width<960,portrait=viewport.width<720&&viewport.height>viewport.width;
  const p=await browser.newPage({viewport,hasTouch:touch,isMobile:portrait,reducedMotion:'reduce'});current=p;
  await p.addInitScript(()=>{window.__panInput=[];for(const type of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(type,e=>{
   window.__panInput.push({time:performance.now(),type:e.type,target:e.target.closest('button')?.outerHTML.slice(0,200)||e.target.tagName,x:e.clientX,y:e.clientY,pointer:e.pointerType});window.__panInput=window.__panInput.slice(-24);
  },true);});
  if(viewport.width===844)await p.addInitScript(()=>{
   const Native=ResizeObserver;window.__holdResize=false;window.__heldResizes=[];
   window.ResizeObserver=class{
    constructor(cb){this.inner=new Native((entries,observer)=>{
     const run=()=>cb(entries,observer);window.__holdResize?window.__heldResizes.push(run):run();
    });}
    observe(...a){this.inner.observe(...a);}unobserve(...a){this.inner.unobserve(...a);}disconnect(){this.inner.disconnect();}
   };
  });
  p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await ready(p);
  check(await p.locator('[data-scene-object]').count()===9,'Exactly seven desk objects plus pool and pitch');
  check(await p.locator('[data-scene-framing]').isVisible()===portrait,'Only portrait phones need a framing control');
  await p.keyboard.press('Escape');await p.waitForTimeout(200);
  if(portrait){
   check(await p.locator('[data-world-render]').getAttribute('data-scene-frame-mode')==='desk','Phone opens on the full-height desk');
   check(await p.locator('[data-scene-object="work"]').isVisible()&&await p.locator('[data-scene-object="books"]').isVisible(),'Desk objects start large and directly usable');
   check(await p.locator('[data-scene-framing]').innerText()==='See the coast \u2192','The coast is a clearly named next view');
   await cover(p,viewport);
   await p.screenshot({path:out+'/'+viewport.width+'-desk.png'});
   await activate(p.locator('[data-scene-framing]'),touch);await stopped(p);
   check(await p.locator('[data-world-render]').getAttribute('data-scene-frame-mode')==='coast','The coast action pans to the right');
   check(await p.locator('[data-scene-framing]').innerText()==='\u2190 Back to desk','The coast has a clear way back');
   await p.waitForFunction(()=>document.querySelector('.scene-hotspots').dataset.intro==='names');
   await p.waitForFunction(()=>['aqua','futsl'].every(id=>
    Number(getComputedStyle(document.querySelector('[data-scene-object="'+id+'"] .scene-object-label')).opacity)>=.99));
   for(const id of ['aqua','futsl'])check(await p.locator('[data-scene-object="'+id+'"]').getAttribute('data-show-name')!==null,
    'Newly reached coast places briefly introduce their names, like the desk');
   for(const id of ['aqua','futsl'])check(await p.locator('[data-scene-object="'+id+'"]').evaluate(n=>{
    const r=n.lastElementChild.getBoundingClientRect(),header=document.querySelector('.world-header').getBoundingClientRect(),dock=document.querySelector('.world-dock').getBoundingClientRect();
    return n.dataset.labelFit==='true'&&r.left>=7&&r.right<=innerWidth-7&&r.top>=header.bottom&&r.bottom<=dock.top-7;
   }),'Arrival name stays on screen beside its photographed place');
   await p.screenshot({path:out+'/'+viewport.width+'-coast-labels.png'});
   await p.waitForFunction(()=>!document.querySelector('.scene-hotspots').dataset.intro);
   await p.waitForFunction(()=>['aqua','futsl'].every(id=>
    getComputedStyle(document.querySelector('[data-scene-object="'+id+'"] .scene-object-label')).opacity==='0'));
   for(const id of ['aqua','futsl'])check(await p.locator('[data-scene-object="'+id+'"] .scene-object-label').evaluate(n=>
    getComputedStyle(n).opacity==='0'),'The actual coast tag finishes fading, beyond just its visibility flag');
   for(const id of ['aqua','futsl'])check(await p.locator('[data-scene-object="'+id+'"]').getAttribute('data-show-name')===null,
    'Coast names fade instead of becoming permanent tags');
   await p.locator('[data-scene-object="aqua"]').hover();
   check(await p.locator('[data-scene-object="aqua"]').getAttribute('data-show-name')!==null,'Hover restores the pool name');
   await p.mouse.move(viewport.width-8,150);
   await cover(p,viewport);
  }
  await p.screenshot({path:out+'/'+viewport.width+'-coast.png'});
  for(const [id,name] of [['aqua','Aqua Local'],['futsl','FUTSL']]){
   const target=p.locator('[data-scene-object="'+id+'"]');check(await target.isVisible(),name+': pictured place is discoverable');
   const rect=await target.boundingBox();check(rect.width>=44&&rect.height>=44,name+': touch target at least 44px');
   const own=await target.evaluate(n=>{const r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===n;});
   if(!own)console.log('Hit diagnostic',JSON.stringify(await target.evaluate(n=>{
    const r=n.getBoundingClientRect(),e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),path=n.querySelector('path');
    return {viewport:[innerWidth,innerHeight],rect:r.toJSON(),hit:e?.outerHTML.slice(0,150),path:path.getAttribute('d'),
     host:document.querySelector('[data-world-render]').getBoundingClientRect().toJSON()};
   })));
   check(own,name+': no other target intercepts its center');
   if(id==='futsl'){
    const goal=await p.evaluate(box=>{
     const b=document.querySelector('[data-scene-outline="futsl"]').getBBox(),host=document.querySelector('[data-world-render]').getBoundingClientRect();
     const scale=b.width/(box[2]-box[0]),x=host.x+b.x+(.652-box[0])*scale,y=host.y+b.y+(.395-box[1])*scale*941/1672;
     return {x,y,hit:document.elementFromPoint(x,y)?.closest('[data-scene-object]')?.dataset.sceneObject};
    },layout.targets.futsl.box);
    check(goal.hit==='futsl','The visible goal net belongs to the pitch interaction');
    touch?await p.touchscreen.tap(goal.x,goal.y):await p.mouse.click(goal.x,goal.y);
   }else await activate(target,touch);
   await opened(p,'work');
   check(await p.locator('[data-app-card][data-selected]').getAttribute('data-app-card')===id,name+': selects its real app card');
   const card=p.locator('[data-app-card="'+id+'"]'),link=card.locator('[data-app-website]');await link.scrollIntoViewIfNeeded();
   const r=await link.boundingBox(),reader=await p.locator('[data-world-reader]').boundingBox();
   check(r.y>=reader.y&&r.y+r.height<=reader.y+reader.height,name+': real website action is visible and reachable');
   check(await card.locator('[data-app-store]').count()===(id==='futsl'?2:1),name+': retains all verified stores');
   await p.screenshot({path:out+'/'+viewport.width+'-'+id+'.png'});
   // A slow browser may deliver resize notifications after the next visitor action.
   if(viewport.width===844)await p.evaluate(()=>window.__holdResize=true);
   await p.goBack();await p.waitForFunction(()=>document.querySelector('[data-world-reader]').hidden);
   await paint(p); // Let the overview's scheduled focus restoration finish before a new keyboard action.
   check(await target.isVisible(),'Browser Back returns to the pictured place');
   await target.focus();await p.keyboard.press('Enter');await opened(p,'work');check(await card.isVisible(),'Keyboard Enter opens the same app');
   await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('[data-world-reader]').hidden);
   await p.waitForFunction(id=>document.activeElement===document.querySelector('[data-scene-object="'+id+'"]'),id);
   check(await target.evaluate(n=>document.activeElement===n),'Escape restores focus to its place');
  }
  if(viewport.width===844)await p.evaluate(()=>{
   window.__holdResize=false;window.__heldResizes.splice(0).forEach(run=>run());
  });
  if(portrait){
   await activate(p.locator('[data-scene-framing]'),touch);await stopped(p);
   check(await p.locator('[data-world-render]').getAttribute('data-scene-frame-mode')==='desk','Returning from the coast restores the desk');
   await activate(p.locator('[data-scene-object="books"]'),touch);await opened(p,'books');
   check(await p.locator('[data-book-topic]').count()===6,'Book still opens directly with all chapters');await p.keyboard.press('Escape');
   await p.waitForFunction(()=>document.querySelector('[data-world-reader]').hidden);
   await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-scene-object="books"]'));
   check(await p.locator('[data-scene-object="books"]').evaluate(n=>document.activeElement===n),'Book focus returns after closing');
   await activate(p.locator('[data-scene-framing]'),touch);await stopped(p);
   // Keep the complete browse-and-tap sequence on one supported pointer path.
   // Raw CDP touch drags suppress a later Playwright tap even in a blank-page control.
   // The separate motion scenario below still verifies native touch swiping in Chromium.
   const coastStop=await frame(p);
   for(let i=0;i<4;i++)await dragScene(p,[viewport.width-30,160],[30,160],{touch:false,engine});
   check(await p.locator('[data-world-reader]').isHidden(),'Trying to swipe past the coast never opens an app');
   check(Math.abs((await frame(p)).left-coastStop.left)<2,'The photograph stops at pool/pitch instead of continuing to an empty beach');
   for(const id of ['aqua','futsl'])check(await p.locator('[data-scene-object="'+id+'"]').isVisible(),'The last stop keeps both real app places visible');
   await cover(p,viewport);await p.screenshot({path:out+'/'+viewport.width+'-coast-limit.png'});
   await activate(p.locator('[data-scene-framing]'),touch);await stopped(p);
   check(await p.locator('[data-world-render]').getAttribute('data-scene-frame-mode')==='desk','The final coast stop keeps a direct return to the desk');
   await activate(p.locator('[data-scene-framing]'),touch);await stopped(p);
  }
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-route="winter"]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).transition.region==='winter');await p.keyboard.press('Escape');
  check(await p.locator('[data-scene-object="aqua"]').isVisible()&&await p.locator('[data-scene-object="futsl"]').isVisible(),'Winter keeps both app places usable');
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-night]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1&&document.body.dataset.worldLight==='night');
  await p.keyboard.press('Escape');
  // WebKit can paint inherited text/icon colours one frame after its themed parent.
  await p.waitForFunction(()=>{
   const ink=getComputedStyle(document.documentElement).getPropertyValue('--chrome-night-ink').trim();
   const expected='rgb('+ink.slice(1).match(/../g).map(v=>parseInt(v,16)).join(', ')+')';
   return getComputedStyle(document.querySelector('.world-header')).color===expected&&getComputedStyle(document.querySelector('.world-header h1')).color===expected&&
    [...document.querySelectorAll('.world-dock > a svg,.scene-settings-toggle svg')].every(n=>getComputedStyle(n).color===getComputedStyle(n.closest('a,button')).color);
  });
  await paint(p);
  const nightChrome=await p.evaluate(()=>{
   const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   return [...document.querySelectorAll('.world-header h1,.world-dock > a,.world-dock > a svg,.scene-settings-toggle svg')].map(n=>{
    const foreground=luminance(getComputedStyle(n).color),background=luminance(getComputedStyle(n.closest('.world-header,.world-dock')).backgroundColor);
    return {text:n.textContent.trim()||n.closest('a,button').getAttribute('aria-label')||n.closest('a,button').textContent.trim(),minimum:n.tagName.toLowerCase()==='svg'?3:4.5,contrast:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)};
   });
  });
  check(nightChrome.length===12&&nightChrome.every(n=>n.contrast>=n.minimum),'Settled night header and navigation retain readable text contrast: '+JSON.stringify(nightChrome));
  await p.screenshot({path:out+'/'+viewport.width+'-winter-night.png'});
  const filter=await p.locator('[data-scene-effect="futsl"]').evaluate(n=>{
   const f=n.querySelector('[filter]').getAttribute('filter').slice(5,-1),r=document.getElementById(f);
   return {width:Number(r.getAttribute('width')),height:Number(r.getAttribute('height'))};
  });check(filter.width*filter.height<viewport.width*viewport.height*.3,'Highlight filter processes its object, not the entire viewport');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No sideways page overflow');
  evidence.push({viewport,filter,nightChrome,input:await p.evaluate(()=>window.__panInput)});await p.close();
 }
 // Smooth pan, real pointer/touch drag, bounded edges and an idle renderer.
 const motion=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference'});current=motion;
 motion.on('pageerror',e=>errors.push(e.message));
 await motion.addInitScript(()=>{const native=requestAnimationFrame;window.__testFrames=0;
  window.requestAnimationFrame=fn=>native(time=>{window.__testFrames++;fn(time);});});
 await motion.goto(base);await ready(motion);await motion.keyboard.press('Escape');await paint(motion);
 const before=await frame(motion);await motion.locator('[data-scene-framing]').tap();
 check(await motion.locator('[data-world-render]').getAttribute('data-scene-panning')==='true','Coast navigation animates when motion is allowed');
 await motion.waitForTimeout(100);const midway=await frame(motion);await cover(motion,{width:390,height:844});
 await stopped(motion);const after=await frame(motion);
 check(midway.left>before.left&&midway.left<after.left,'The scene visibly slides through intermediate viewpoints');
 await motion.screenshot({path:out+'/390-coast-animated.png'});
 await motion.locator('[data-scene-framing]').tap();await stopped(motion);
 const dragBefore=await frame(motion);
 await dragScene(motion,[300,160],[100,160],{touch:true,engine});await paint(motion);const dragged=await frame(motion);
 check(Math.abs(dragged.left-dragBefore.left-160)<4,'A native swipe moves the photograph and calibrated objects together');
 check(await motion.locator('[data-world-reader]').isHidden(),'Swiping does not open an object');
 for(let i=0;i<6;i++)await dragScene(motion,[300,160],[50,160],{touch:true,engine});
 const edge=await frame(motion);check(Math.abs(edge.left-(edge.width*.565-195))<2,'Native swiping stops at the pool/pitch viewpoint, with no empty destination');
 await dragScene(motion,[100,160],[200,160],{touch:true,engine});const reverse=await frame(motion);
 check(Math.abs(edge.left-reverse.left-80)<4,'Reversing at the edge responds immediately without an overscroll dead zone');
 await motion.locator('[data-scene-framing]').focus();await motion.keyboard.press('Enter');await stopped(motion);
 check(await motion.locator('[data-world-render]').getAttribute('data-scene-frame-mode')==='desk','The framing button also returns from a swipe by keyboard');
 await motion.waitForTimeout(250);
 const idle=await motion.evaluate(()=>window.__testFrames);await motion.waitForTimeout(150);
 check(await motion.evaluate(()=>window.__testFrames)===idle,'The scene stops scheduling animation frames after the pan');
 await motion.close();
 // Delayed mobile artwork must acknowledge the tap and allow a clean cancellation.
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});current=p;
 let release;const held=new Promise(r=>release=r);await p.route('**/concept-contact-closeup-v2.webp',async r=>{await held;await r.continue();});
 try{
  await p.goto(base);await ready(p);await p.locator('.world-dock [data-world-route="contact"]').tap();
  await p.locator('.scene-loading:not([hidden])').waitFor();check((await p.locator('.scene-loading').innerText()).includes('Contact'),'Slow artwork visibly acknowledges the chosen object');
  check(await p.locator('[data-world-reader]').getAttribute('aria-busy')==='true','Assistive tech receives loading state');
  await p.locator('[data-world-close]').tap();check(await p.locator('.scene-loading').isHidden(),'Back cancels the waiting indicator');
  release();await p.waitForTimeout(250);check(await p.locator('[data-world-reader]').isHidden(),'Late artwork cannot reopen a closed object');
  await p.locator('.world-dock [data-world-route="experience"]').tap();await opened(p,'experience');
  check(await p.locator('[data-world-reader]').getAttribute('aria-busy')===null,'The next object clears busy state');
  await p.locator('[data-world-close]').tap();await p.locator('.world-dock [data-world-route="contact"]').tap();
  await opened(p,'contact');await p.locator('[data-world-close]').tap();await p.locator('[data-settings-toggle]').tap();
  check(await p.locator('[data-settings-panel]').isVisible(),'Settings opens immediately after closing Contact on a phone');
  await p.keyboard.press('Escape');
 }finally{release();await p.close();}
 check(errors.length===0,'No runtime errors: '+errors.join('; '));
 await writeFile(out+'/results.json',JSON.stringify({engine,checks,evidence,errors},null,2));console.log(engine+': '+checks+' phone framing, pictured apps and loading checks passed.');
}catch(e){
 if(current&&!current.isClosed()){
  await current.screenshot({path:out+'/failure.png'});
  const state=await current.evaluate(()=>({viewport:[innerWidth,innerHeight],hash:location.hash,focused:document.hasFocus(),input:window.__panInput,scroll:[scrollX,scrollY],visual:visualViewport?{top:visualViewport.offsetTop,left:visualViewport.offsetLeft,scale:visualViewport.scale}:null,framing:document.querySelector('[data-scene-framing]')?.getBoundingClientRect().toJSON(),active:document.activeElement?.outerHTML.slice(0,500),body:document.body.dataset,
   reader:document.querySelector('[data-world-reader]')?.dataset,scene:JSON.parse(document.querySelector('canvas').dataset.worldState)}));
  await writeFile(out+'/failure-context.json',JSON.stringify({message:e.message,checks,state,errors},null,2));
 }
 throw e;
}finally{await browser.close();}
