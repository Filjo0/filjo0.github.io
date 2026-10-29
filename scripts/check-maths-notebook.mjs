import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {GOLDEN_ANGLE,seedPattern} from '../world-state.js';
import {spiralFamilies} from '../world/seed-spirals.js';
import {dragRange,rendered,paintedThumb} from './maths-browser-input.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765/';
const out=(process.env.MATHS_ARTIFACT_DIR||'validation-artifacts/redesign-15oct/stage4-first-page')+'/'+name;
await mkdir(out,{recursive:true});
const browser=await pw[name].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?
 {executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const sizes=(process.env.MATHS_VIEWPORTS||'1440x900,1280x720,390x844,320x568,844x390,768x1024,1024x768').split(',')
 .map(s=>{const [width,height]=s.split('x').map(Number);return {width,height};});
let checks=0,current;const captures=[];
const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const expected=spiralFamilies(seedPattern(400,GOLDEN_ANGLE));
const settled=p=>p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='fibonacci'&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
const idle=p=>p.waitForFunction(()=>document.querySelector('[data-maths-step]').dataset.animating==='false');
async function press(p,n,touch) {
 if(touch){const r=await n.boundingBox();await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}else await n.click();
}
async function capture(p,size,label) {
 const file=size.width+'x'+size.height+'-'+label+'.png';
 await press(p,p.locator('.creative-title h3'),size.width<=960);await rendered(p);await p.screenshot({path:out+'/'+file});captures.push(file);
}
async function fit(p,size,label) {
 const reader=p.locator('[data-world-reader]'),body=p.locator('[data-world-content]');
 const back=p.locator('[data-world-close]');
 check(await back.isVisible(),'Back to the scene remains visible');
 check(await back.evaluate(n=>{const r=n.getBoundingClientRect();return r.height>=44&&r.top>=0&&
  n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),label+': Back is a usable native control');
 const r=await reader.boundingBox();
 check(r.x>=-1&&r.y>=63&&r.x+r.width<=size.width+1&&r.y+r.height<=size.height+1,label+': notebook fits below Back');
 const deltas=await reader.evaluate(n=>{
  const host=document.querySelector('[data-world-render]').getBoundingClientRect(),q=JSON.parse(n.dataset.surfaceCorners);
  return [[0,0],[1,0],[1,1],[0,1]].map(([x,y],i)=>{
   const point=document.createElement('span');point.style.cssText=`position:absolute;left:${x*100}%;top:${y*100}%;width:0;height:0`;
   n.append(point);const r=point.getBoundingClientRect();point.remove();return Math.hypot(r.x-host.x-q[i].x,r.y-host.y-q[i].y);
  });
 });
 deltas.forEach(d=>check(d<1,label+': actual notebook mesh and HTML align within 1px'));
 const overflow=await body.evaluate(n=>({w:n.scrollWidth-n.clientWidth,h:n.scrollHeight-n.clientHeight}));
 check(overflow.w<=1&&overflow.h<=1,label+': no hidden or scrollable outer text '+JSON.stringify(overflow));
 for(const target of await body.locator('button:visible,a:visible,input:visible').all()) {
  const q=await target.boundingBox();
  check(q.height>=44&&q.width>=44,label+': actual 44px control '+await target.textContent());
  check(q.x>=r.x-1&&q.y>=r.y-1&&q.x+q.width<=r.x+r.width+1&&q.y+q.height<=r.y+r.height+1,label+': control stays on paper');
  check(await target.evaluate(n=>{const q=n.getBoundingClientRect();return n.contains(document.elementFromPoint(q.x+q.width/2,q.y+q.height/2));}),
   label+': native control is unobstructed: '+await target.textContent());
 }
 const clipped=await body.evaluate(root=>{
  const b=root.getBoundingClientRect(),walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),bad=[];
  while(walk.nextNode()){
   const n=walk.currentNode;if(!n.textContent.trim()||!n.parentElement.checkVisibility())continue;
   const range=document.createRange();range.selectNodeContents(n);
   for(const r of range.getClientRects())if(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)
    bad.push(n.textContent.trim());
  }return bad;
 });
 check(clipped.length===0,label+': every line is visible '+clipped.join('|'));
 const flower=await p.locator('[data-seed-art]').boundingBox();
 check(flower.width>=140&&flower.height>=140,label+': flower has a readable area');
}
async function verifyArms(p) {
 for(let i=0;i<expected.length;i++) {
  const paths=p.locator('[data-spiral-family="'+i+'"]');
  check(await paths.count()===expected[i].count,'Family '+i+' uses the count computed from actual seed coordinates');
  for(let j=0;j<expected[i].arms.length;j++) {
   const drawn=(await paths.nth(j).getAttribute('d')).slice(1).split('L').map(s=>s.trim().split(/\s+/).map(Number));
   const arm=expected[i].arms[j];
   check(drawn.length===arm.length&&drawn.every((p,k)=>Math.hypot(p[0]-arm[k].x,p[1]-arm[k].y)<1e-7),
    'Drawn arm matches computed neighbouring seed chain within floating-point precision');
  }
 }
 const caption=await p.locator('[data-maths-caption]').innerText(),counts=await p.locator('[data-maths-count]').innerText();
 check(expected.every(f=>counts.includes(String(f.count)))&&caption.toLowerCase().includes('fibonacci numbers'),'The visible counts and caption explain actual Fibonacci numbers');
}
try {
 for(const size of sizes){
  const touch=size.width<=960,p=await browser.newPage({viewport:size,hasTouch:touch,reducedMotion:'reduce'});current=p;
  const errors=[];p.on('pageerror',e=>errors.push(e.message));console.log(name+': maths sliders '+size.width+'x'+size.height);
  await p.goto(url);await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true');
  const notebook=p.locator('[data-scene-object="fibonacci"]'),viaDot=await notebook.isVisible();
  if(viaDot)await press(p,notebook,touch);
  else{const entry=p.locator('.world-dock [data-world-route="fibonacci"]');check((await entry.innerText()).includes('Maths'),'Direct navigation names maths');await press(p,entry,touch);}
  await settled(p);if(await p.locator('[data-maths-chapter="0"]').isVisible())await press(p,p.locator('[data-maths-chapter="0"]'),touch);
  const range=p.getByRole('slider',{name:'Turn angle',exact:true});
  check(await range.count()===1&&await range.getAttribute('step')==='0.01','One labelled native fine-step angle slider');
  check(await p.locator('[data-angle-preset]').count()===4,'Four labelled quick-pick angles');
  check(await p.locator('[data-maths-reset],[data-seed-count],[data-spiral-step]').count()===0,'Retired reset, seed counter and arm stepper remain removed');
  check(await p.locator('[data-maths-caption]').getAttribute('aria-live')==='polite','Caption is a polite live region');
  const thumb=await paintedThumb(p,range);
  check(thumb.width>=42&&thumb.height>=42,'The 44px thumb renders in native pixels, within 2px antialiasing tolerance: '+JSON.stringify(thumb));
  let base=null;
  const geometry=()=>p.locator('[data-seed-art]').evaluate(n=>({box:n.getBoundingClientRect().toJSON(),parts:[...n.querySelectorAll(':scope > path,:scope > circle,:scope > g:not([data-seed-layer]):not([data-spiral-layer])')].map(e=>({markup:e.outerHTML,box:e.getBoundingClientRect().toJSON()}))}));
  for(const [pick,angle,spokes] of [['90',90,4],['120',120,3],['144',144,5],['golden',GOLDEN_ANGLE,0]]){
   await press(p,p.locator('[data-angle-preset="'+pick+'"]'),touch);
   const points=seedPattern(400,angle),seeds=await p.locator('[data-sunflower-seed]').evaluateAll(ns=>ns.map(n=>[Number(n.getAttribute('cx')),Number(n.getAttribute('cy'))]));
   check(seeds.length===400,'Every arrangement draws the full bounded 400-seed head');
   check(seeds.every((v,i)=>Math.hypot(v[0]-points[i].x,v[1]-points[i].y)<.001),'Every visible seed follows the actual chosen angle');
   check(await p.locator('[data-spiral-family]').count()===0,'A new angle clears old arms');
   check(await p.locator('[data-maths-next]').isEnabled(),'Count is available at every selected angle');
   if(spokes)check((await p.locator('[data-maths-next]').innerText()).includes('137.5°'),'The action explains the switch to the golden angle');
   const text=await p.locator('[data-maths-caption]').innerText();check(spokes?text.includes(spokes+' straight spokes'):text.toLowerCase().includes('no spokes'),'Caption explains the chosen angle');
   const current=await geometry();if(!base)base=current;else check(JSON.stringify(base)===JSON.stringify(current),'Petals, head and frame remain identical across angles');
   await fit(p,size,pick);await capture(p,size,pick);
  }
  await press(p,p.locator('[data-angle-preset="90"]'),touch);
  await press(p,p.locator('[data-maths-next]'),touch);await idle(p);await verifyArms(p);
  check(Number(await p.locator('[data-sunflower-page]').getAttribute('data-angle-value'))===GOLDEN_ANGLE,'Counting from a different angle selects the exact golden angle');
  check(await range.inputValue()==='137.51','Counting keeps the visible angle slider in sync');
  for(const family of ['0','1'])check(await p.locator('[data-spiral-family="'+family+'"]').evaluateAll(ns=>ns.every(n=>Number(getComputedStyle(n).opacity)>=.9&&Number(n.getAttribute('stroke-width'))>=2)),'Both families remain bold in the finished crossing lattice');
  check(JSON.stringify(base)===JSON.stringify(await geometry()),'Counting changes only the spiral overlay');
  await fit(p,size,'golden arms');await capture(p,size,'golden-arms');
  const before=await p.locator('[data-sunflower-seed]').nth(12).getAttribute('cx'),captionBefore=await p.locator('[data-maths-caption]').innerText();
  const position=()=>p.evaluate(()=>({y:scrollY,reader:document.querySelector('[data-world-content]').scrollTop,page:document.querySelector('.maths-notebook-shell').dataset.mathsPage}));
  const scroll=await position(),dragged=await dragRange(p,range,100,{touch,engine:name});
  check(Math.abs(dragged-100)<2,'Native thumb drag reaches the intended angle');
  check(await p.locator('[data-sunflower-seed]').nth(12).getAttribute('cx')!==before,'Dragging immediately changes visible seed geometry');
  check(await p.locator('[data-maths-caption]').innerText()!==captionBefore,'Dragging changes the caption');
  check(await p.locator('[data-spiral-family],[data-selected-seed]').count()===0,'Dragging clears arms and selection');
  check(JSON.stringify(scroll)===JSON.stringify(await position()),'Dragging neither scrolls nor turns the notebook');
  await dragRange(p,range,GOLDEN_ANGLE,{touch,engine:name});
  check(await range.inputValue()==='137.51','A native near-golden drag snaps to the golden thumb position: '+await range.inputValue());
  check(Number(await p.locator('[data-sunflower-page]').getAttribute('data-angle-value'))===GOLDEN_ANGLE,'Snapping retains the exact mathematical angle');
  check(await p.locator('[data-range-control="turn-angle"] output').innerText()==='137.51°','Visible output gives the live angle');
  for(const offset of [-.2,.2]){
   await dragRange(p,range,offset<0?160:100,{touch,engine:name});
   await dragRange(p,range,GOLDEN_ANGLE+offset,{touch,engine:name});
   check(await range.inputValue()==='137.51','Finger drag sticks on both sides within the widened golden region: '+offset);
  }
  await dragRange(p,range,100,{touch,engine:name});
  const outside=await dragRange(p,range,GOLDEN_ANGLE+2,{touch,engine:name});
  check(Math.abs(outside-GOLDEN_ANGLE)>1.2,'Dragging outside the magnetic region remains freely adjustable: '+outside);
  // Keep the existing +2 degree boundary probe and exercise clearly outside both sides.
  for(const offset of [-4,4]){
   await dragRange(p,range,offset<0?160:100,{touch,engine:name});
   const target=GOLDEN_ANGLE+offset,value=await dragRange(p,range,target,{touch,engine:name});
   check(Math.abs(value-target)<2,'Native outside-band drag reaches its intended angle: '+offset);
   check(Math.abs(value-GOLDEN_ANGLE)>1.2,'Clearly outside the snap band stays adjustable: '+offset);
  }
  await dragRange(p,range,100,{touch,engine:name});
  await dragRange(p,range,GOLDEN_ANGLE,{touch,engine:name});
  await range.focus();await p.keyboard.press('ArrowRight');check(await range.inputValue()==='137.52','Fine keyboard movement escapes the magnetic area');
  await p.keyboard.press('PageUp');check(await range.inputValue()==='142.52','Page Up moves five degrees');
  await p.keyboard.press('PageDown');check(await range.inputValue()==='137.52','Page Down moves five degrees back');
  await p.keyboard.press('Home');check(await range.inputValue()==='1','Home reaches the lower limit');
  await p.keyboard.press('End');check(await range.inputValue()==='180','End reaches the upper limit');
  await p.keyboard.press('ArrowLeft');check(await range.inputValue()==='179.99','Arrow keys keep hundredth-degree steps');
  await p.locator('[data-angle-preset="golden"]').focus();await p.keyboard.press('Enter');check(await range.inputValue()==='137.51','Quick picks work from the keyboard');
  await p.keyboard.press('Escape');check(await p.locator('[data-world-reader]').isHidden(),'Escape returns to the scene');
  if(viaDot){await p.waitForFunction(()=>document.activeElement===document.querySelector('[data-scene-object="fibonacci"]'));check(await notebook.evaluate(n=>document.activeElement===n),'Focus returns to the exact notebook opener');}
  check(!errors.length,'No runtime errors: '+errors.join('; '));await p.close();
 }
 const size={width:390,height:844},p=await browser.newPage({viewport:size,hasTouch:true,reducedMotion:'no-preference'});current=p;
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.mathsRaf=0;const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{window.mathsRaf++;return raf(cb);};});
 await p.goto(url+'/#fibonacci');await settled(p);await press(p,p.locator('[data-maths-chapter="0"]'),true);
 await press(p,p.locator('[data-maths-next]'),true);
 await p.waitForFunction(()=>document.querySelectorAll('[data-spiral-family="0"]').length>5&&document.querySelectorAll('[data-spiral-family="1"]').length===0);
 check(await p.locator('[data-maths-next]').isDisabled()&&(await p.locator('[data-maths-next]').innerText())==='Counting…','The action is only disabled while counting and explains its progress');
 await capture(p,size,'count-orange');check(await p.locator('[data-spiral-family="0"]').first().getAttribute('stroke')==='#f5a33c','The first family is orange');
 await p.keyboard.press('p');await p.waitForTimeout(80);const held=await p.locator('[data-spiral-family]').count();await p.waitForTimeout(180);
 check(await p.locator('[data-spiral-family]').count()===held,'Global pause freezes actual arm tracing');await p.keyboard.press('p');
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=await p.locator('[data-spiral-family]').count();await p.waitForTimeout(180);check(await p.locator('[data-spiral-family]').count()===hidden,'Hidden pages stop drawing arms');
 await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await p.waitForFunction(()=>document.querySelectorAll('[data-spiral-family="1"]').length>5);await capture(p,size,'count-teal');
 check(await p.locator('[data-spiral-family="0"]').first().evaluate(n=>Number(getComputedStyle(n).opacity))>=.6,'Orange remains visible while teal draws');
 await idle(p);await verifyArms(p);await p.waitForTimeout(400);const frames=await p.evaluate(()=>window.mathsRaf);await p.waitForTimeout(180);
 check(await p.evaluate(()=>window.mathsRaf)===frames,'Completed drawing has no idle RAF');
 await press(p,p.locator('[data-maths-next]'),true);await p.waitForFunction(()=>document.querySelectorAll('[data-spiral-family]').length>2);
 await press(p,p.locator('[data-angle-preset="120"]'),true);check(await p.locator('[data-spiral-family]').count()===0,'A changed angle cancels a running trace synchronously');
 await press(p,p.locator('[data-angle-preset="golden"]'),true);await press(p,p.locator('[data-maths-next]'),true);await p.waitForFunction(()=>document.querySelectorAll('[data-spiral-family]').length>2);
 await p.emulateMedia({reducedMotion:'reduce'});await idle(p);await verifyArms(p);
 await p.emulateMedia({reducedMotion:'no-preference'});await press(p,p.locator('[data-maths-next]'),true);await p.waitForFunction(()=>document.querySelectorAll('[data-spiral-family]').length>2);
 await p.keyboard.press('Escape');await p.waitForTimeout(400);const exited=await p.evaluate(()=>window.mathsRaf);await p.waitForTimeout(180);
 check(await p.evaluate(()=>window.mathsRaf)===exited,'Exiting mid-trace cancels every notebook frame');
 await p.emulateMedia({reducedMotion:'reduce'});
 await p.goto(url+'/#books');await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='books'&&
  !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 await press(p,p.locator('[data-book-topic="apps"]'),true);await press(p,p.locator('[data-book-open]').first(),true);
 await press(p,p.locator('[data-book-turn]'),true);await press(p,p.locator('[data-book-turn]'),true);
 const next=p.getByRole('button',{name:'Next reading →',exact:true});
 check(await next.count()===1,'Voice-control name exactly matches visible Next reading');
 const previous=await p.locator('[data-reading-id]').getAttribute('data-reading-id');await press(p,next,true);
 check(await p.locator('[data-reading-id]').getAttribute('data-reading-id')!==previous,'Accessible Next reading action opens another actual reading');
 check(errors.length===0,'No animation or book errors: '+errors.join('; '));await p.close();
 await writeFile(out+'/result.json',JSON.stringify({browser:name,checks,viewports:sizes,captures},null,2));
 console.log(name+': '+checks+' maths notebook checks passed.');
} catch(e) {if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw e;}
finally {await browser.close();}
