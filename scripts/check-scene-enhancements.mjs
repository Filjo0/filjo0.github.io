import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {qualityDigest} from './build-quality-evidence.mjs';
import {markerEvidence} from './marker-browser-evidence.mjs';
import {brightMarkerEvidence} from './marker-bright-evidence.mjs';
import {reducedMotionLayoutEvidence} from './reduced-motion-layout-evidence.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const base=new URL(process.env.STUDIO_URL||'http://127.0.0.1:8765/');
const out=(process.env.SCENE_ENHANCEMENT_ARTIFACT_DIR||'validation-artifacts/scene-enhancements-30oct/enhancements')+'/'+engine;await mkdir(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const expectedFallbacks=new Map(),errors=[],captures=[],check=(v,m)=>{assert.ok(v,m);checks++;};
const url=light=>{const target=new URL(base);target.searchParams.set('light',light);target.hash='';return target.href;};
const ready=p=>p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true'&&
 document.querySelector('.scene-hotspots')?.dataset.markerLayout==='ready');
const state=p=>p.locator('[data-world-render] canvas').evaluate(n=>JSON.parse(n.dataset.worldState));
const opened=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&
 !document.querySelector('[data-world-reader]').hidden&&!document.querySelector('[data-world-reader]').classList.contains('world-object-opening')&&!document.querySelector('.linked-input-shield'),id);
const watch=p=>{current=p;p.on('pageerror',e=>errors.push(e.message));p.on('console',async m=>{
 if(m.type()==='error'&&/shader|WebGL/.test(m.text()))errors.push(m.text());
 if(m.text().startsWith('[portfolio:fallback]')){
  const diagnostic=await m.args()[1].jsonValue(),expected=expectedFallbacks.get(p);
  if(expected&&diagnostic.reason==='visitor-request'){expectedFallbacks.delete(p);expected(diagnostic);}
  else errors.push(JSON.stringify(diagnostic));
 }});};
async function capture(p,label){const png=await p.screenshot({path:out+'/'+label+'.png'});captures.push(label+'.png');return png;}
async function fixedClock(p,instant){await p.addInitScript(value=>{
 const Original=Date;window.__testInstant=value;
 window.Date=class extends Original {constructor(...args){super(...(args.length?args:[window.__testInstant]));}static now(){return new Original(window.__testInstant).getTime();}};
},instant);}
async function light(p,phase){
 await p.locator('[data-settings-toggle]').click();await p.locator('[data-scene-light="'+phase+'"]').click();
 await p.waitForFunction(phase=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.phase===phase&&
 JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.progress===1,phase);await p.keyboard.press('Escape');
}
const phasePictures={};let lightingDifference;
try{
 for(const [phase,instant] of [['morning','2026-10-30T00:00:00Z'],['day','2026-10-30T06:00:00Z'],
  ['sunset','2026-10-30T09:30:00Z'],['night','2026-10-30T13:00:00Z']]){
  const p=await browser.newPage({viewport:{width:1440,height:900},timezoneId:'America/New_York',reducedMotion:'reduce'});watch(p);
  const requests=[];p.on('request',r=>requests.push(r.url()));await fixedClock(p,instant);await p.goto(url('auto'));await ready(p);
  check((await state(p)).lighting.phase===phase,'Automatic '+phase+' uses Perth, not the visitor timezone');
  const expected=phase==='night'?'concept-coast-dusk-v2.webp':phase==='sunset'?'concept-coast-v2.webp':'concept-coast-day-v1.webp';
  const assets=[...new Set(requests.filter(s=>/concept-(?:coast|winter)(?:-(?:day|dusk))?-v\d+\.webp$/.test(new URL(s).pathname)).map(s=>new URL(s).pathname.split('/').at(-1)))];
  check(assets.length===1&&assets[0]===expected,'Only the active '+phase+' source loads initially: '+assets);
  check(!requests.some(s=>s.endsWith('quality-evidence.json')),'QA evidence stays lazy');
  await markerEvidence(p,check);phasePictures[phase]=await capture(p,'1440-'+phase);
  if(phase==='day'){
   await p.locator('[data-scene-inspect]').click();await p.locator('.quality-stats').waitFor();
   check(await p.locator('[data-inspect-expand]').getAttribute('aria-expanded')==='true','Desktop inspection opens expanded');
   check((await p.locator('.quality-stats').innerText()).includes('suites in Chromium'),'Full suite figures explicitly name Chromium');
   check((await p.locator('.quality-engine-scope').innerText()).includes('WebKit (Safari’s engine)'),
    'Focused WebKit coverage is stated separately from full Chromium suites');
   check(!(await p.locator('[data-quality-evidence]').innerText()).includes('browser engines'),'No equal-coverage engine tile is implied');
   await capture(p,'1440-inspect');await p.keyboard.press('Escape');
  }
  await p.locator('[data-settings-toggle]').click();
  check(await p.locator('[data-scene-light="auto"]').getAttribute('aria-pressed')==='true','Automatic choice is visibly selected');
  check((await p.locator('[data-perth-time]').innerText()).includes(phase==='day'?'Daylight':phase[0].toUpperCase()+phase.slice(1)),
   'The settings explain the current Perth phase');
  await p.keyboard.press('Escape');
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-route="winter"]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).snow===1);
  await p.keyboard.press('Escape');await markerEvidence(p,check);await capture(p,'1440-winter-'+phase);
  if(phase==='night'){
   lightingDifference=await p.evaluate(async({morning,day})=>{
    const pixels=async value=>{const image=new Image();image.src='data:image/png;base64,'+value;await image.decode();
     const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');
     ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
    const a=await pixels(morning),b=await pixels(day);let warmth=0,n=0;const samples=[[],[]];
    for(let y=120;y<550;y+=3)for(let x=760;x<1420;x+=3){
     const i=(y*1440+x)*4;warmth+=(a[i]-a[i+2])-(b[i]-b[i+2]);n++;
     for(const [j,data] of [a,b].entries())samples[j].push(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722);
    }
    const contrast=values=>{const mean=values.reduce((a,b)=>a+b,0)/values.length;
     return Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/values.length);};
    return {warmth: warmth/n,contrast:contrast(samples[0])/contrast(samples[1])};
   },{morning:phasePictures.morning.toString('base64'),day:phasePictures.day.toString('base64')});
   check(lightingDifference.warmth>3,'Morning is visibly warmer in native pixels: '+JSON.stringify(lightingDifference));
   check(lightingDifference.contrast>=.97,'Morning preserves daylight contrast without lifting blacks: '+JSON.stringify(lightingDifference));
  }
  await p.close();
 }
 for(const [width,height] of [[390,664],[375,553],[320,568],[844,390],[320,844]]){
  const p=await browser.newPage({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});watch(p);await p.goto(url('day'));await ready(p);
  await markerEvidence(p,check);
  const header=await p.locator('.world-header').boundingBox(),role=await p.locator('.world-identity p').boundingBox();
  check(role&&role.y>=header.y&&role.y+role.height<=header.y+header.height,'Role stays inside the mobile header');
  // Portrait stacks Inspect above the full-width role line; compact landscape puts them side by side.
  check(await p.locator('[data-scene-inspect]').evaluate((n,{role,landscape})=>{const r=n.getBoundingClientRect();
   return landscape?r.right<=role.x||r.left>=role.x+role.width||r.bottom<=role.y||r.top>=role.y+role.height:r.bottom<=role.y;},
   {role,landscape:width>height}),'The labelled Inspect button also stays clear of the role line');
  check(await p.locator('[data-scene-inspect]').evaluate(n=>n.getBoundingClientRect().width>=44),'Inspect has a real phone target');
  check(await p.locator('[data-scene-inspect] span').isVisible(),'The phone control visibly says Inspect, not an unexplained Search icon');
  check(await p.locator('.world-identity h1').evaluate(n=>n.getBoundingClientRect().right<=
   document.querySelector('[data-scene-inspect]').getBoundingClientRect().left),'The labelled button never overlaps the name');
  const panWasVisible=await p.locator('[data-scene-framing]').isVisible();
  await capture(p,width+'x'+height+'-day');await p.locator('[data-scene-inspect]').tap();
  await p.waitForFunction(()=>document.querySelector('[data-quality-evidence]').textContent.includes('passed'));
  check(await p.locator('[data-inspect-expand]').getAttribute('aria-expanded')==='false','Phone inspection starts compact');
  check(await p.locator('[data-inspect-expand]').innerText().then(t=>t.includes('How this site is tested')),'Inspection has a plain descriptive title');
  const compact=await p.locator('.scene-quality-panel').boundingBox(),dock=await p.locator('.world-dock').boundingBox();
  check(compact.height<=80&&compact.y>=header.y+header.height,'The compact bottom sheet leaves the scene visible');
  check(compact.y+compact.height<=dock.y-4,'The inspector never covers phone navigation');
  check(await p.locator('[data-scene-framing]').isHidden(),'The covered coast control never peeks out behind the inspector');
  check(await p.locator('[data-inspect-expand] .quality-chevron').evaluate(n=>{
   const r=n.getBoundingClientRect();return r.width===20&&r.height===20&&n.tagName.toLowerCase()==='svg';
  }),'The disclosure uses a clearly sized SVG chevron from the site icon style');
  const mathsPill=await p.locator('[data-scene-object="fibonacci"] .scene-marker-name').boundingBox();
  check(mathsPill&&(mathsPill.x+mathsPill.width<=compact.x-4||mathsPill.x>=compact.x+compact.width+4||
   mathsPill.y+mathsPill.height<=compact.y-4||mathsPill.y>=compact.y+compact.height+4),
   'The entire MATHS name stays clear of the compact inspector, not just its dot');
  await markerEvidence(p,check);

  await capture(p,width+'x'+height+'-inspect');await p.locator('[data-inspect-expand]').tap();
  check(await p.locator('.quality-details').isVisible(),'Tapping the disclosure reveals the recorded evidence');
  check(await p.locator('.quality-chevron').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).a===-1),
   'Opening the sheet points the SVG chevron up');
  check(await p.locator('.scene-quality-panel').evaluate(n=>{const r=n.getBoundingClientRect();
   return r.height<=240&&r.top>=document.querySelector('.world-header').getBoundingClientRect().bottom+8;}),
   'Expanded phone details stay bounded between the header and navigation');
  const visibleScope=await p.locator('.quality-engine-scope').boundingBox(),expanded=await p.locator('.scene-quality-panel').boundingBox();
  check(visibleScope.y+visibleScope.height<=expanded.y+expanded.height-6,
   'Both engine scopes are visible on first expansion, without scrolling');
  check(await p.locator('[data-inspect-close]').evaluate(n=>n.getBoundingClientRect().width>=44),'Inspection closes with an accessible touch target');
  check(await p.locator('[data-scene-inspect]').getAttribute('aria-pressed')==='true','Native tap enables QA inspection');
  check(await p.locator('[data-quality-evidence]').innerText().then(t=>t.includes('checks ·')&&!t.includes('undefined')),'Recorded scope/date are visible');
  const record=await p.locator('.quality-date').boundingBox(),panelBox=await p.locator('.scene-quality-panel').boundingBox();
  check(record.y+record.height<=panelBox.y+panelBox.height,'The date/scope record is actually inside the visible panel');
  await p.locator('.scene-quality-panel summary').click();
  check(await p.locator('.quality-scope').isVisible(),'The detailed record states its testing limits');
  await p.locator('.scene-quality-panel summary').click();
  check(await p.locator('[data-scene-effect="work"] .scene-object-rim').evaluate(n=>getComputedStyle(n).display!=='none'&&
   Number(getComputedStyle(n).opacity)===1),'QA mode outlines the real laptop');
  await p.locator('[data-scene-object="work"]').focus();
  check((await p.locator('[data-quality-object]').innerText()).includes('Laptop → My apps'),'Keyboard focus explains the object meaning');
  await p.mouse.move(width-2,90);await p.waitForTimeout(50);
  check((await p.locator('[data-quality-object]').innerText()).includes('Laptop → My apps'),'A stray pointer event cannot erase the focused object explanation');
  await p.locator('.quality-details').evaluate(n=>n.scrollTop=0);
  await capture(p,width+'x'+height+'-inspect-details');await p.locator('[data-inspect-expand]').tap();
  check(await p.locator('.quality-details').isHidden(),'The panel collapses without switching object outlines off');
  check(await p.locator('.quality-chevron').evaluate(n=>getComputedStyle(n).transform==='none'),
   'Collapsing the sheet points the SVG chevron down');
  if(width===320&&height===568){
   await p.locator('.world-dock [data-world-route="fibonacci"]').tap();await opened(p,'fibonacci');
   check(await p.locator('.maths-notebook').isVisible(),'The MATHS name opens its actual notebook while Inspect is compact');
   await p.locator('[data-world-close]').tap();await p.locator('[data-scene-inspect]').tap();
  }
  check(await p.locator('[data-scene-inspect]').getAttribute('aria-pressed')==='true','Collapsing keeps inspection active');
  await p.keyboard.press('Escape');
  check(await p.locator('[data-scene-inspect]').evaluate(n=>n===document.activeElement),'Escape restores the inspector toggle');
  check(await p.locator('.scene-quality-panel').isHidden(),'QA mode closes completely');
  check(await p.locator('[data-scene-framing]').isVisible()===panWasVisible,'Closing Inspect restores the coast control');
  await p.locator('[data-settings-toggle]').tap();await capture(p,width+'x'+height+'-settings');await p.keyboard.press('Escape');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal phone overflow');
  await p.locator('.world-dock [data-world-route="contact"]').tap();await opened(p,'contact');
  check(await p.locator('.linked-transition').count()===0,'Reduced motion has no camera glide');
  await p.locator('[data-world-close]').tap();await p.locator('[data-settings-toggle]').tap();
  check(await p.locator('[data-settings-panel]').isVisible(),'Contact → close → settings works');await p.keyboard.press('Escape');await p.close();
 }
 // Reproduce the intermediate pan rectangle captured in the short-phone startup failure.
 for(const [width,height] of [[375,553],[320,568]]){
  const p=await browser.newPage({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});watch(p);
  await p.addInitScript(()=>{
   const actual=Element.prototype.getBoundingClientRect;window.__panRectOffset=20.1875;
   Element.prototype.getBoundingClientRect=function(){const r=actual.call(this);return this.matches('.scene-framing')?
    new DOMRect(r.x,r.y-window.__panRectOffset,r.width,r.height):r;};
  });
  await p.goto(url('sunset'));await ready(p);
  await p.evaluate(()=>{window.__panRectOffset=0;});
  check(await p.locator('[data-scene-object]:visible').evaluateAll(ns=>ns.every(n=>!n.disabled)),
   'An intermediate pan rectangle cannot leave visible objects disabled');
  await markerEvidence(p,check);await capture(p,width+'x'+height+'-pan-measurement-regression');
  await p.locator('.world-dock [data-world-route="resume"]').tap();await opened(p,'resume');
  check(await p.locator('[data-resume-document]').isVisible(),'The actual resume marker remains tappable after startup layout settles');
  await p.close();
 }
 const motion=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});watch(motion);
 await motion.addInitScript(()=>{window.__sceneFrames=0;const original=requestAnimationFrame;
  window.requestAnimationFrame=fn=>original.call(window,t=>{window.__sceneFrames++;fn(t);});});
 await motion.goto(url('sunset'));await ready(motion);await motion.bringToFront();await motion.waitForTimeout(500);
 check(await motion.locator('.scene-atmosphere').isVisible(),'Living details are enabled with full motion');
 check(await motion.locator('.scene-atmosphere').evaluate(n=>n.getAnimations({subtree:true}).length>=3),'The compositor animates leaves, lamp and water');
 const frames=await motion.evaluate(()=>window.__sceneFrames);await motion.waitForTimeout(400);
 check(await motion.evaluate(()=>window.__sceneFrames)===frames,'Living details do not keep WebGL rendering while idle');
 const isolate=await motion.addStyleTag({content:'.scene-atmosphere,.scene-hotspots{visibility:hidden!important}'});
 const beforeDepth=await motion.screenshot();
 await motion.mouse.move(1420,180);await motion.waitForTimeout(500);

 const afterDepth=await motion.screenshot();
 const paintedDepth=await motion.evaluate(async({before,after})=>{
  const load=async value=>{const image=new Image();image.src='data:image/png;base64,'+value;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height);};
  const a=await load(before),b=await load(after);
  const count=(left,top,right,bottom)=>{let n=0;for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const i=(y*a.width+x)*4;if([0,1,2].some(c=>Math.abs(a.data[i+c]-b.data[i+c])>2))n++;}return n;};
  return {sky:count(1200,100,1400,240),desk:count(150,730,350,850),tree:count(610,95,860,335),whole:count(0,0,a.width,a.height)};
 },{before:beforeDepth.toString('base64'),after:afterDepth.toString('base64')});
 check(paintedDepth.sky===0&&paintedDepth.whole===0,'Every native base-scene pixel stays fixed on pointer movement: '+JSON.stringify(paintedDepth));
 check(paintedDepth.desk===0,'Native foreground pixels remain steady rather than moving the whole photograph');
 check(paintedDepth.tree===0,'Native branches beside the pool and court stay rigid during pointer depth: '+JSON.stringify(paintedDepth));
 const stopped=await motion.evaluate(()=>window.__sceneFrames);await motion.waitForTimeout(300);
 check(await motion.evaluate(()=>window.__sceneFrames)===stopped,'Pointer movement never starts an idle WebGL loop');
 await isolate.evaluate(n=>n.remove());
 await capture(motion,'1440-rigid-scene');
 await motion.locator('.world-dock [data-world-route="work"]').click();
 await motion.waitForFunction(()=>document.querySelector('.linked-plane'));
 check(await motion.locator('.linked-transition').count()===1,'Clicking the real laptop starts its approach');
 await motion.waitForTimeout(70);
 check(await motion.locator('.linked-plane').evaluate(n=>Number(new DOMMatrix(getComputedStyle(n).transform).a)>1),'The visible scene actually scales toward the object');
 await capture(motion,'1440-approach');
 await opened(motion,'work');check(await motion.locator('.linked-transition').count()===0,'The overlay leaves once the real close-up is ready');
 await capture(motion,'1440-arrived');await motion.keyboard.press('Escape');await ready(motion);
 await motion.locator('.world-dock [data-world-route="contact"]').click();await motion.keyboard.press('Escape');
 await motion.waitForFunction(()=>document.querySelector('[data-world-reader]').hidden&&document.body.dataset.linkedFlowPhase==='idle');check(await motion.locator('[data-world-reader]').isHidden(),'Back during an approach cannot reopen stale content');
 check(await motion.locator('.linked-transition').count()===0,'Interrupted approach cleans up its snapshot');
 await motion.emulateMedia({reducedMotion:'reduce'});await motion.waitForTimeout(150);
 check(await motion.locator('.scene-atmosphere').isHidden(),'Reduce motion stops the living layers');
 check(!('depth' in await state(motion)),'The retired depth state is absent');await motion.close();
 const overlap=await browser.newPage({viewport:{width:390,height:664},hasTouch:true,reducedMotion:'no-preference'});watch(overlap);
 await overlap.goto(url('sunset'));await ready(overlap);
 await overlap.locator('[data-settings-toggle]').click();await overlap.locator('[data-world-route="winter"]').click();
 await overlap.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).transition.phase==='transition');
 await overlap.locator('[data-settings-toggle]').click();await overlap.locator('[data-scene-light="night"]').click();
 await overlap.waitForFunction(()=>{const s=JSON.parse(document.querySelector('canvas').dataset.worldState);
  return s.snow===1&&s.lighting.phase==='night'&&s.lighting.progress===1&&s.lighting.blend===1;});
 await overlap.keyboard.press('Escape');
 check((await state(overlap)).lighting.files.winter==='concept-winter-dusk-v2.webp','Overlapping light/season changes retain the actual winter night source');
 await capture(overlap,'390-season-light-overlap');await overlap.close();
 const failure=await browser.newPage({viewport:{width:390,height:664},hasTouch:true,reducedMotion:'reduce'});watch(failure);
 await failure.route('**/concept-coast-dusk-v2.webp',r=>r.abort());await failure.goto(url('sunset'));await ready(failure);
 await failure.locator('[data-settings-toggle]').click();await failure.locator('[data-scene-light="night"]').click();
 await failure.waitForFunction(()=>document.querySelector('[data-world-status]').textContent.includes('Lighting could not load'));
 check((await state(failure)).lighting.phase==='sunset','A failed phase retains the last usable picture');await failure.keyboard.press('Escape');
 await failure.locator('.world-dock [data-world-route="work"]').tap();await opened(failure,'work');
 check(await failure.locator('.workspace-launcher').isVisible(),'Light failure never blocks portfolio navigation');
 await failure.locator('[data-world-close]').click();await failure.locator('[data-settings-toggle]').click();
 const requestedFallback=new Promise(resolve=>expectedFallbacks.set(failure,resolve));
 await failure.locator('[data-world-text]').click();
 const fallbackReason=await Promise.race([requestedFallback,new Promise((_,reject)=>setTimeout(()=>reject(Error('Missing requested fallback diagnostic')),3000))]);
 check(fallbackReason.reason==='visitor-request'&&fallbackReason.error===null,'Simple page records the intentional visitor request, without a runtime error');
 check(await failure.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Switching to the simple page cannot retain scene header overflow');
 check(await failure.locator('.scene-inspector,.scene-atmosphere').count()===0,'Simple page disposes inspection and atmosphere UI');
 await capture(failure,'390-simple-page');await failure.close();
 const realRecord=JSON.parse(await readFile(new URL('../assets/quality-evidence.json',import.meta.url),'utf8'));
 for(const kind of ['missing','empty','stale']){
  const p=await browser.newPage({viewport:{width:320,height:568},hasTouch:true,reducedMotion:'reduce'});watch(p);
  await p.route('**/assets/quality-evidence.json',r=>r.fulfill(kind==='missing'?{status:404,body:'missing'}:
   {contentType:'application/json',body:JSON.stringify(kind==='empty'?{...realRecord,checks:[],objects:{}}:
    {...realRecord,sourceDigest:'0'.repeat(64)})}));
  await p.goto(url('sunset'));await ready(p);await p.locator('[data-scene-inspect]').tap();
  await p.locator('[data-inspect-expand]').tap();
  await p.getByText('Test summary unavailable',{exact:true}).waitFor();
  check(await p.locator('.quality-stats').count()===0,kind+': unavailable QA data never paints invented numbers');
  await p.keyboard.press('Escape');await p.locator('.world-dock [data-world-route="contact"]').tap();await opened(p,'contact');
  check(await p.locator('.phone-address').isVisible(),kind+': QA failure never blocks the portfolio');await p.close();
 }
 await reducedMotionLayoutEvidence(browser,{base,out,check,watch});
 await brightMarkerEvidence(browser,{base,out,check,watch,capture});
 check(errors.length===0,'No shader or runtime errors: '+errors.join('; '));
 await writeFile(out+'/results.json',JSON.stringify({engine,sourceDigest:qualityDigest(),checks,captures,lightingDifference,errors},null,2));
 console.log(engine+': '+checks+' scene enhancement checks passed.');
}catch(e){if(current&&!current.isClosed()){await current.screenshot({path:out+'/failure.png'});
 const diagnostic=await current.evaluate(()=>({hidden:document.hidden,body:{...document.body.dataset},
  host:{...document.querySelector('[data-world-render]')?.dataset},nav:{...document.querySelector('.scene-hotspots')?.dataset},
  canvas:document.querySelector('canvas')?.dataset.worldState,
  targets:[...document.querySelectorAll('[data-scene-object]')].map(n=>({id:n.dataset.sceneObject,hidden:n.hidden,disabled:n.disabled}))}));
 await writeFile(out+'/failure.json',JSON.stringify({error:e.message,checks,errors,diagnostic,markerEvidence:e.markerEvidence},null,2));}throw e;
}finally{await browser.close();}
