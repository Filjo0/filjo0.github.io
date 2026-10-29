import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {outlineGeometry,outlineContrast,dragScene} from './outline-browser-evidence.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const url=process.env.STUDIO_URL||'http://127.0.0.1:8765/',root=process.env.OBJECT_HIGHLIGHT_ARTIFACT_DIR||'validation-artifacts/object-highlights-20oct';
const out=root+'/'+engine;await mkdir(out,{recursive:true});
const layout=JSON.parse(await readFile(new URL('../art/outdoor/hotspot-layout.json',import.meta.url),'utf8'));
const sizes=(process.env.OBJECT_HIGHLIGHT_VIEWPORTS||'1440x900,390x844,320x568,844x390').split(',').map(s=>{
 const [width,height]=s.split('x').map(Number);return {width,height};});
const browser=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const part=process.env.OBJECT_HIGHLIGHT_PART||'all';
let checks=0,current;const captures=[],errors=[],check=(v,m)=>{assert.ok(v,m);checks++;};
const ready=p=>p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true');
const settled=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
const rendered=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function outside(p,touch=false){const r=await p.locator('[data-world-render]').boundingBox();
 if(touch)await p.touchscreen.tap(r.x+r.width-10,r.y+r.height*.65);else await p.mouse.click(r.x+r.width-10,r.y+r.height*.65);
 await p.waitForTimeout(200);
}
async function screenshot(p,size,state){await rendered(p);const file=size.width+'x'+size.height+'-'+state+'.png';
 await p.screenshot({path:out+'/'+file});captures.push(file);}
async function theme(p,season,night){
 await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-regions] [data-world-route="'+season+'"]').click();
 await p.waitForFunction(season=>{const s=JSON.parse(document.querySelector('canvas').dataset.worldState);return s.region===season&&s.transition.phase==='settled';},season);
 await p.locator('[data-settings-toggle]').click();await p.locator(night?'[data-world-night]':'[data-world-day]').click();
 await p.waitForFunction(n=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===n,night?1:0);
 await p.keyboard.press('Escape');await outside(p);
}
async function photoDifference(p,before,id,afterOverride){
 const after=afterOverride||await p.screenshot();
 return p.evaluate(async({before,after,id})=>{
  const load=async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
   const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return x.getImageData(0,0,c.width,c.height);};
  const a=await load(before),b=await load(after),host=document.querySelector('[data-world-render]').getBoundingClientRect();
  const effect=document.querySelector('[data-scene-effect="'+id+'"]'),shape=document.querySelector('[data-scene-outline="'+id+'"]');
  const button=document.querySelector('[data-scene-object="'+id+'"]'),object=effect.querySelector('.scene-object-rim').getBoundingClientRect(),label=button.lastElementChild.getBoundingClientRect();
  const connector=effect.querySelector('.scene-label-connector').getBoundingClientRect();
  let outside=0,inside=0,lift=0;
  for(let y=Math.ceil(host.y);y<Math.min(a.height,Math.floor(host.bottom));y++)for(let x=0;x<a.width;x++){
   const i=(y*a.width+x)*4,diff=Math.max(...[0,1,2].map(c=>Math.abs(a.data[i+c]-b.data[i+c])));
   const onObject=shape.isPointInFill(new DOMPoint(x-host.x,y-host.y));
   const allowed=onObject||[object,label,connector].some(r=>x>=r.left-15&&x<=r.right+15&&y>=r.top-15&&y<=r.bottom+15);
   if(diff>2&&!allowed)outside++;
   // Interior pixels are selected by native SVG fill, away from the outline and its labels.
   if(x%3||y%3||!onObject)continue;
   const old=a.data[i]+a.data[i+1]+a.data[i+2],now=b.data[i]+b.data[i+1]+b.data[i+2];
   if(old>60&&old<620){inside++;lift+=now/old-1;}
  }
  return {outside,inside,lift:lift/Math.max(1,inside)};
 },{before:before.toString('base64'),after:after.toString('base64'),id});
}
try{
 for(const size of (['all','scenes'].includes(part)?sizes:[])){
  const touch=size.width<960,p=await browser.newPage({viewport:size,hasTouch:touch,reducedMotion:'reduce'});current=p;
  p.on('pageerror',e=>errors.push(e.message));const requests=[];p.on('request',r=>requests.push(r.url()));
  await p.bringToFront();await p.goto(url);await ready(p);
  check(!requests.some(u=>/concept-(?:coast|winter)-dusk/.test(u)),'Night artwork stays lazy before selecting Night');
  await outlineGeometry(p,layout,check);await screenshot(p,size,'arrival-reduced');await outside(p,touch);
  check(await p.locator('.scene-object-dot').count()===0,'No circles or dot elements remain');
  if(size.width===320)check(await p.locator('[data-scene-object="contact"]').isVisible(),'The tiny pictured phone retains its padded target at 320px');
  if(size.width===844&&size.height===390){
   // Reproduce a taller initial tab bar, then its normal layout at the same camera size.
   const dock=p.locator('.world-dock'),book=p.locator('[data-scene-object="books"]');
   await dock.evaluate(n=>{n.style.setProperty('height','82px','important');n.style.setProperty('min-height','82px','important');});
   await p.setViewportSize({width:845,height:390});await rendered(p);
   await p.setViewportSize(size);await rendered(p);
   check(await book.evaluate(n=>n.hidden),'A truly occluded book stays out of the keyboard sequence');
   await dock.evaluate(n=>{n.style.removeProperty('height');n.style.removeProperty('min-height');});await rendered(p);
   check(await book.evaluate(n=>!n.hidden),'Restoring the tab bar reveals the Book without a camera change or extra action');
   await p.keyboard.press('Tab');await book.focus();await rendered(p);
   check(await book.evaluate(n=>document.activeElement===n&&n.dataset.hotspotState==='focus'),
     'The restored Book is keyboard focused on its real silhouette');
   await p.keyboard.press('Enter');await settled(p,'books');
   check(await p.locator('[data-world-reader]').getAttribute('data-object')==='books','Enter opens the restored Book');
   await p.keyboard.press('Escape');
   await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-scene-object="books"]'));
   check(await book.evaluate(n=>document.activeElement===n),'Escape restores that Book target');
   await screenshot(p,size,'book-after-dock-reflow');await outside(p,touch);
  }
  for(const season of ['coast','winter'])for(const night of [false,true]){
   await theme(p,season,night);console.log(engine+': outline '+size.width+' '+season+' '+(night?'night':'sunset'));
   const label=season+'-'+(night?'night':'sunset');
   await outlineGeometry(p,layout,check);await screenshot(p,size,label+'-rest');
   const work=p.locator('[data-scene-object="work"]'),before=await p.screenshot();
   await work.hover();await p.waitForTimeout(220);
   check(await p.locator('[data-world-reader]').isHidden(),'Hover reveals the object without opening');
   check(await work.locator('small').count()===0&&(await work.locator('.scene-object-label').innerText())==='Apps','Hover shows the name without a redundant Open action');
   await outlineGeometry(p,layout,check);const pixels=await photoDifference(p,before,'work');
   check(pixels.outside===0,'Highlight changes only its own object, halo, tag and connector: '+JSON.stringify(pixels));
   if(size.width===1440&&season==='coast'&&!night){
    // A one-pixel change in the empty sky must still fail the zero-outside rule.
    const changed=await p.evaluate(async base64=>{
     const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
     const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
     const host=document.querySelector('[data-world-render]').getBoundingClientRect(),x=Math.floor(innerWidth*.9),y=Math.floor(host.y+host.height*.2);
     const pixel=ctx.getImageData(x,y,1,1);for(let i=0;i<3;i++)pixel.data[i]=(pixel.data[i]+128)%256;ctx.putImageData(pixel,x,y);
     return c.toDataURL('image/png').split(',')[1];
    },before.toString('base64'));
    const negative=await photoDifference(p,before,'work',Buffer.from(changed,'base64'));
    check(negative.outside===1,'Negative control: one changed sky pixel is still rejected by the exact outside mask');
   }
   check(pixels.inside>30&&pixels.lift>=(night||season==='winter'?.035:.12),'The rendered object visibly brightens: '+JSON.stringify(pixels));
   await screenshot(p,size,label+'-hover');await outside(p,touch);
   const contact=p.locator('[data-scene-object="contact"]');
   if(await contact.isVisible()){
    await contact.hover();await p.waitForTimeout(220);await outlineGeometry(p,layout,check);
    check(await contact.locator('.scene-object-label').innerText()==='Contact'&&await contact.locator('small').count()===0,
     'Contact keeps its attached name without a second action');
    await screenshot(p,size,label+'-contact-tag');await outside(p,touch);
   }
   await p.keyboard.press('Tab');const book=p.locator('[data-scene-object="books"]');
   await book.focus();await p.waitForTimeout(220);await outlineGeometry(p,layout,check);
   check(await book.getAttribute('data-hotspot-state')==='focus','Keyboard focus uses the real book silhouette');
   check((await book.locator('.scene-object-label').innerText())==='Book'&&await book.locator('small').count()===0,'Keyboard focus names the object without an Open badge');
   const painted=await p.locator('[data-scene-effect="books"] .scene-object-rim').boundingBox();
   check(painted.x>=8&&painted.x+painted.width<=size.width-8,'Book rim stays inward of the cropped screen edge');
   await screenshot(p,size,label+'-keyboard');await outside(p,touch);
  }
  // Test actual opening and exact return focus using the silhouette, not only the header.
  const phone=p.locator('[data-scene-object="contact"]');
  if(await phone.isVisible()){
   if(touch)await phone.tap();else await phone.click();
   await settled(p,'contact');check(await p.locator('.phone-address').isVisible(),'A single click or tap reveals the real contact phone');
   await p.keyboard.press('Escape');await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-scene-object="contact"]'));
   check(await phone.evaluate(n=>document.activeElement===n),'Escape restores the exact silhouette opener');
  }
  await outside(p,touch);
  const workBox=await p.locator('[data-scene-object="work"]').boundingBox(),empty=[workBox.x+2,workBox.y+2];
  check(await p.evaluate(([x,y])=>!document.elementFromPoint(x,y)?.closest('[data-scene-object]'),empty),'An empty corner of the laptop box is not a hit');
  await p.mouse.click(...empty);check(await p.locator('[data-world-reader]').isHidden(),'Clicking an empty box corner does not open a menu');
  for(const measured of await outlineContrast(p))check(measured.ratio>=7,measured.id+': painted keyboard focus retains ≥7:1 contrast');
  if(touch&&size.height>700){
   // Drag from the object itself: the touch must pan and never become an activation.
   await theme(p,'coast',false);const n=p.locator('[data-scene-object="work"]'),r=await n.boundingBox();
   const a=[r.x+r.width/2,r.y+r.height/2],b=[12,a[1]];
   await dragScene(p,a,b,{touch,engine});
   await rendered(p);check(await p.locator('[data-world-reader]').isHidden(),'A native touch drag on the pictured object pans rather than opening');
   const pan=(a[0]-b[0])*.8;
   await outlineGeometry(p,layout,check,pan);await screenshot(p,size,'panned-from-object');
   const host=await p.locator('[data-world-render]').boundingBox(),start=[size.width-12,host.y+host.height*.62],end=[24,start[1]];
   await dragScene(p,start,end,{touch,engine});await rendered(p);
   await outlineGeometry(p,layout,check,pan+(start[0]-end[0])*.8);await screenshot(p,size,'bag-in-view');
  }
  check(await p.locator('.scene-hotspots').evaluate(n=>!n.getAnimations({subtree:true}).some(a=>a.effect.getTiming().iterations===Infinity)),
   'No perpetual outline animation exists');await p.close();
 }
 if(['all','lifecycle'].includes(part)&&process.env.OBJECT_HIGHLIGHT_LIFECYCLE!=='skip'){
  const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});current=p;
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__arrivalEvidence=[];
   new MutationObserver(records=>{for(const {target:n} of records)if(n.dataset?.sceneObject&&n.dataset.hotspotState==='arrival'&&
     window.__arrivalEvidence.at(-1)!==n.dataset.sceneObject)window.__arrivalEvidence.push(n.dataset.sceneObject);
   }).observe(document,{subtree:true,attributes:true,attributeFilter:['data-hotspot-state']});
  });
  await p.bringToFront();await p.goto(url);await ready(p);
  await p.waitForFunction(()=>document.querySelector('[data-scene-object="resume"]')?.dataset.hotspotState==='arrival');
  await screenshot(p,{width:1440,height:900},'arrival-sweep');
  await p.waitForFunction(()=>!document.querySelector('.scene-hotspots').dataset.intro);await p.waitForTimeout(250);
  check((await p.evaluate(()=>window.__arrivalEvidence.join('|')))==='work|contact|resume|experience|books|fibonacci|globe','One arrival sweep visits all seven objects in order');
  check(await p.locator('.scene-hotspots').evaluate(n=>n.getAnimations({subtree:true}).every(a=>a.playState!=='running')),'Arrival animations settle completely');
  for(let count=1;count<=3;count++){
   await p.waitForFunction(count=>Number(document.querySelector('.scene-hotspots').dataset.glints)===count,count,{timeout:11000});
   check(await p.locator('[data-hotspot-state="idle"][data-scene-effect]').count()===1,'Only one idle object catches the light');
   await screenshot(p,{width:1440,height:900},'idle-glint-'+count);
   await p.waitForTimeout(800);
  }
  await p.waitForTimeout(8500);
  check(await p.locator('.scene-hotspots').getAttribute('data-glints')==='3','Idle hints stop after three glints per visit');
  check(await p.locator('.scene-hotspots').evaluate(n=>!n.getAnimations({subtree:true}).some(a=>a.playState==='running')),'Idle decorations settle with no animation loop');
  // Simulate the browser lifecycle environment, never a visitor input event.
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  check(await p.locator('.scene-hotspots').getAttribute('data-suspended')==='true','Hidden pages suspend all hint timers/animations');
  await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await p.locator('.world-dock [data-world-route="work"]').click();await settled(p,'work');
  check(await p.locator('.scene-hotspots').isHidden(),'Close-up content hides the scene effects and targets');
  await p.locator('[data-world-close]').click();await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-text]').click();
  check(await p.locator('.scene-hotspots').count()===0,'Plain-page fallback disposes SVGs, targets and owned listeners');await p.close();
 }
 if(['all','mixed-input'].includes(part)){
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});current=p;
  p.on('pageerror',e=>errors.push(e.message));await p.bringToFront();await p.goto(url);await ready(p);
  const contact=p.locator('[data-scene-object="contact"]');
  await contact.hover();await p.waitForTimeout(220);
  check(await contact.getAttribute('data-hotspot-state')==='hover','A mouse highlights Contact before switching to touch');
  await outside(p,true);
  check(await p.locator('[data-world-reader]').isHidden(),'Touching the background does not open an object');
  check(await p.locator('[data-scene-object]').evaluateAll(ns=>ns.every(n=>n.dataset.hotspotState==='none'&&!n.hasAttribute('data-show-name'))),
   'Touching elsewhere dismisses the previous mouse highlight and name');
  check(await p.locator('.scene-object-effects').evaluate(n=>[...n.querySelectorAll('.scene-object-lift,.scene-object-rim,.scene-object-halo,.scene-label-connector')]
   .every(e=>getComputedStyle(e).opacity==='0')),'The previous object glow and connector are visibly cleared');
  await screenshot(p,{width:390,height:844},'mouse-to-touch-cleared');
  const work=p.locator('[data-scene-object="work"]'),r=await work.boundingBox(),a=[r.x+r.width/2,r.y+r.height/2];
  await dragScene(p,a,[a[0]-80,a[1]],{touch:true,engine});await rendered(p);
  check(await p.locator('[data-world-reader]').isHidden(),'Dragging an object leaves the overview open');
  // Some touch drags emit no click. A stale pointer suppression must never eat keyboard activation.
  await p.keyboard.press('Tab');await work.focus();await p.keyboard.press('Enter');await settled(p,'work');
  check(await p.locator('[data-world-reader]').isVisible(),'Enter opens the object immediately after a touch drag');
  await p.keyboard.press('Escape');await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-scene-object="work"]'));
  check(await work.evaluate(n=>n===document.activeElement),'Escape restores the exact object after mixed input');
  await p.keyboard.press('Space');await settled(p,'work');
  check(await p.locator('[data-world-reader]').isVisible(),'Space still opens the object after returning');await p.close();
 }
 for(const kind of (part==='all'?['missing','invalid']:['missing','invalid'].includes(part)?[part]:[])){
  const p=await browser.newPage({reducedMotion:'reduce'});current=p;const diagnostics=[];p.on('pageerror',e=>errors.push(e.message));
  p.on('console',async m=>{if(m.text().startsWith('[portfolio:fallback]'))diagnostics.push(await m.args()[1].jsonValue());});
  await p.route('**/assets/outdoor/hotspot-layout.json',r=>r.fulfill({status:kind==='missing'?404:200,body:kind==='missing'?'missing':'{bad'}));
  await p.goto(url);await p.locator('[data-world-fallback]:visible').waitFor();
  for(let i=0;i<20&&!diagnostics.length;i++)await p.waitForTimeout(50);
  check(diagnostics.length===1&&diagnostics[0].reason==='scene-asset-error'&&diagnostics[0].asset==='hotspot-layout.json','Outline '+kind+' failure records its precise cause once');
  check(await p.locator('[data-world-fallback] #experience .timeline-entry').count()===5,'Complete portfolio survives unavailable outlines');await p.close();
 }
 check(!errors.length,'No uncaught runtime errors: '+errors.join('; '));
 const resultFile=part==='all'?'results.json':part==='scenes'?'scenes-'+sizes.map(s=>s.width+'x'+s.height).join('_')+'.json':part+'.json';
 await writeFile(out+'/'+resultFile,JSON.stringify({engine,part,checks,captures,errors,sizes},null,2));
 console.log(engine+': '+checks+' live outline checks passed.');
}catch(e){if(current&&!current.isClosed()){
 const diagnostic=await Promise.race([current.evaluate(()=>({state:document.readyState,hidden:document.hidden,focus:document.hasFocus(),
  ready:document.body.dataset.worldReady,scene:document.querySelector('[data-world-render]')?.dataset.sceneReady,text:document.body.innerText.slice(0,600)}))
  .catch(error=>({evaluationError:error.message})),new Promise(resolve=>setTimeout(()=>resolve({evaluationTimedOut:true}),2000))]);
 await writeFile(out+'/failure.json',JSON.stringify({error:e.message,errors,diagnostic},null,2));
 await current.screenshot({path:out+'/failure.png'});
 }throw e;}
finally{await browser.close();}
