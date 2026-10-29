import {outlineGeometry} from './outline-browser-evidence.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {seedPattern} from '../world-state.js';
import {spiralFamilies} from '../world/seed-spirals.js';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765/';
const art=(process.env.CREATIVE_ARTIFACTS||'validation-artifacts/creative-review')+'/'+name;await mkdir(art,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;
const check=(v,m)=>{assert.ok(v,m);checks++;};
const families=spiralFamilies(seedPattern(400));
const layout=JSON.parse(await readFile(new URL('../art/outdoor/hotspot-layout.json',import.meta.url),'utf8'));
const count=p=>p.locator('[data-sunflower-seed]').count();
async function activate(p,n,touch){
 await n.scrollIntoViewIfNeeded();
 if(touch){const r=await n.boundingBox();await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}else await n.click();
}
async function fit(p,viewport,id){
 const reader=p.locator('[data-world-reader]'),r=await reader.boundingBox();
 check(r.x>=-1&&r.y>=63&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1,id+': real page fits');
 const errors=await reader.evaluate(n=>{
  const host=document.querySelector('[data-world-render]').getBoundingClientRect(),expected=JSON.parse(n.dataset.surfaceCorners);
  return [[0,0],[1,0],[1,1],[0,1]].map(([x,y],i)=>{
   const point=document.createElement('span');point.style.cssText=`position:absolute;left:${x*100}%;top:${y*100}%;width:0;height:0;pointer-events:none`;
   n.append(point);const r=point.getBoundingClientRect();point.remove();return Math.hypot(r.x-host.x-expected[i].x,r.y-host.y-expected[i].y);
  });
 });
 errors.forEach(e=>check(e<1,id+': DOM and actual mesh agree within 1px'));
 const body=p.locator('[data-world-content]');
 check(await body.evaluate(n=>n.scrollWidth<=n.clientWidth+1&&
  (n.scrollHeight<=n.clientHeight+1||getComputedStyle(n).overflowY==='auto')),id+': no clipping/hidden outer scroll');
 for(const target of await body.locator('button:visible,a:visible,input:visible,[role="slider"]:visible').all()){
  await target.scrollIntoViewIfNeeded();
  // Scroll/layout can settle the expanded mesh after fit() began. Compare the
  // control and its actual page in one frame, retaining the same containment limits.
  const {q,page}=await target.evaluate(n=>({q:n.getBoundingClientRect().toJSON(),
   page:n.closest('[data-world-reader]').getBoundingClientRect().toJSON()}));
  const inside=q.x>=page.x-1&&q.y>=page.y-1&&q.x+q.width<=page.x+page.width+1&&q.y+q.height<=page.y+page.height+1;
  if(!inside)console.error('Creative fit evidence',JSON.stringify({id,text:await target.textContent(),before:r,actual:page,target:q}));
  check(inside&&q.x>=-1&&q.y>=63&&q.x+q.width<=viewport.width+1&&q.y+q.height<=viewport.height+1,
   id+': '+(await target.textContent()).trim().slice(0,20)+' fits');
  check(q.height>=43,id+': usable touch control');
  if(!await target.isDisabled())check(await target.evaluate(n=>{const q=n.getBoundingClientRect();return n.contains(document.elementFromPoint(q.x+q.width/2,q.y+q.height/2));}),id+': native target is unobstructed');
 }
}
try{for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:320,height:568},{width:844,height:390}]){
 const touch=viewport.width<720||viewport.height<500;
 const p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'}),errors=[];current=p;
 await p.addInitScript(()=>{window.rafRequests=0;const request=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>{window.rafRequests++;return request(cb);};});
 p.on('pageerror',e=>errors.push(e.message));console.log(name+': creative '+viewport.width+'x'+viewport.height);
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true');
 check(await p.locator('[data-scene-object="tank"]').count()===0,'No floating boardwalk Treadfront marker');
 await outlineGeometry(p,layout,check);
 await activate(p,p.locator('[data-settings-toggle]'),touch);
 check(await p.locator('[data-world-intro]').evaluate(n=>n.hidden&&getComputedStyle(n).display==='none'),'The first Settings click really hides the hint');
 await activate(p,p.locator('[data-settings-toggle]'),touch);
 const go=async id=>{
  const link=p.locator('.world-dock [data-world-route="'+id+'"]');await activate(p,link,touch);
  await p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&
   !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
 };
 await go('fibonacci');
 if(await p.locator('[data-maths-chapter="0"]').isVisible())await activate(p,p.locator('[data-maths-chapter="0"]'),touch);
 await fit(p,viewport,'sunflower');
 check(await count(p)===400,'The new notebook shows the full bounded seed pattern');
 for(const angle of ['90','120','golden']){
  await activate(p,p.locator('[data-angle-preset="'+angle+'"]'),touch);
  check(await count(p)===400,'Changing an angle redraws the full bounded head');
  check(await p.locator('[data-spiral-family]').count()===0,'Changing angle clears the old overlay');
  await fit(p,viewport,'maths angle '+angle);
 }
 await activate(p,p.locator('[data-maths-next]'),touch);
 await p.waitForFunction(()=>document.querySelector('[data-sunflower-page]').dataset.animating==='false');
 for(let i=0;i<families.length;i++)check(await p.locator('[data-spiral-family="'+i+'"]').count()===families[i].count,
  'The actual seed geometry determines each spiral-arm count');
 check((await p.locator('[data-maths-caption]').innerText()).toLowerCase().includes('fibonacci numbers'),'The computed connection is visible');
 await p.screenshot({path:art+'/'+viewport.width+'x'+viewport.height+'-maths-complete.png'});
 await p.waitForTimeout(180);const completed=await p.evaluate(()=>window.rafRequests);await p.waitForTimeout(180);
 check(await p.evaluate(()=>window.rafRequests)===completed,'The finished notebook has no idle RAF');
 await activate(p,p.locator('[data-world-close]'),touch);await go('fibonacci');
 check(await count(p)===400&&await p.locator('[data-spiral-family]').count()===families.reduce((n,f)=>n+f.count,0),'Reopening retains the chosen angle and completed arms');
 await p.locator('[data-turn-angle]').focus();await p.keyboard.press('Home');
 check(await count(p)===400&&await p.locator('[data-spiral-family]').count()===0,'A native slider reset clears the actual arms while retaining the bounded head');
 check(errors.length===0,'No page errors: '+errors.join('; '));await p.close();
}console.log(name+': '+checks+' creative-object checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:art+'/failure.png'});throw e;}finally{await browser.close();}
