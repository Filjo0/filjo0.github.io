import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765/';
const out='validation-artifacts/redesign-15oct/stage2/'+name;await mkdir(out,{recursive:true});
const resume=await readFile(new URL('../resume.html',import.meta.url),'utf8');
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(v,m)=>{assert.ok(v,m);checks++;};
const settled=async(p,id)=>{
 await p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&
  !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
 await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
};
async function painted(p){
 await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true'&&
  JSON.parse(document.querySelector('canvas').dataset.worldState).ready);
 await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 // Inspect the native screenshot, not a render-ready flag or a synthetic canvas export.
 const png=await p.screenshot();
 const pixels=await p.evaluate(async base64=>{
  const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
  const context=c.getContext('2d');context.drawImage(image,0,0);
  const focused=document.body.dataset.objectOpen==='true',compact=innerWidth<720||innerHeight<500;
  const x=focused?(compact?innerWidth*.75:innerWidth*.15):innerWidth*.03;
  const y=focused?(compact?24:innerHeight*.55):innerHeight*.7;
  return [[0,0],[5,0],[0,5]].map(([dx,dy])=>[...context.getImageData(Math.floor(x+dx),Math.floor(y+dy),1,1).data]);
 },png.toString('base64'));
 check(pixels.some(p=>Math.hypot(p[0]-125,p[1]-104,p[2]-76)>12),
  'Native capture contains actual scene/object artwork instead of the blank stage colour');
}
async function dot(p,id,touch){
 const n=p.locator(`[data-scene-object="${id}"]`);
 if(!await n.isVisible()){
  await p.locator(`.world-dock [data-world-route="${id}"]`).click();await settled(p,id);return;
 }
 if(touch)await n.tap();else await n.click();await settled(p,id);
}
async function aligned(p,id){
 const e=await p.locator('[data-world-reader]').evaluate(n=>{
  const host=document.querySelector('[data-world-render]').getBoundingClientRect();
  const expected=JSON.parse(n.dataset.surfaceCorners);
  const actual=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{
   const a=document.createElement('span');a.style.cssText=`position:absolute;left:${x*100}%;top:${y*100}%;width:0;height:0`;
   n.append(a);const r=a.getBoundingClientRect();a.remove();return {x:r.x-host.x,y:r.y-host.y};
  });return {expected,actual,object:n.dataset.object,rect:n.getBoundingClientRect().toJSON()};
 });
 check(e.object===id,id+': content belongs to its actual object mesh');
 e.actual.forEach((p,i)=>check(Math.hypot(p.x-e.expected[i].x,p.y-e.expected[i].y)<1,id+': HTML/mesh corner '+i+' aligns within 1px'));
 return e.rect;
}
try{
 for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  console.log(name+': stage 2 '+viewport.width+'x'+viewport.height);
  const touch=viewport.width<960,p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'});current=p;
  const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.goto(url);await painted(p);
  check(await p.locator('[data-world-intro]').isHidden(),'Redundant introductory hint is removed');
  check(!requests.some(u=>u.includes('contact-closeup')),'Phone photograph is lazy loaded');
  const gear=p.locator('[data-settings-toggle]');await gear.click();
  check(await p.locator('[data-world-day]').innerText()==='Sunset'&&await p.locator('[data-world-night]').innerText()==='Night',
   'Light labels describe the actual imagery');
  for(const s of ['[data-world-day]','[data-world-night]','[data-world-regions] a']){
   check(await p.locator(s).first().evaluate(n=>getComputedStyle(n).fontFamily.includes('sans-serif')),'Settings has a complete sans-serif fallback');
  }
  await painted(p);await p.screenshot({path:out+'/'+viewport.width+'-settings.png'});await p.keyboard.press('Escape');
  for(const season of ['coast','winter']){
   if(season==='winter'){
    await gear.click();await p.locator('[data-world-regions] [data-world-route="winter"]').click();
    await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='winter');
   }
   await painted(p);
   const resumeDot=p.locator('[data-scene-object="resume"]');
   const marker=await resumeDot.boundingBox();
   check(Boolean(marker)||await p.locator('.world-dock [data-world-route="resume"]').isVisible(),
    'Résumé remains reachable by its pictured silhouette or the unobscured primary navigation in '+season);
   await p.screenshot({path:out+'/'+viewport.width+'-'+season+'-overview.png'});
   await dot(p,'resume',touch);await aligned(p,'resume');
   await p.locator('[data-resume-document] h1').waitFor();
   check(await p.locator('[data-resume-document]').evaluate((n,text)=>{
    const source=new DOMParser().parseFromString(text,'text/html'),clean=t=>t.replace(/\s+/g,' ').trim();
    return clean([...n.shadowRoot.querySelectorAll('article.page')].map(n=>n.textContent).join(' '))===
     clean([...source.querySelectorAll('body > article.page')].map(n=>n.textContent).join(' '));
   },resume),'All approved résumé wording remains exact');
   await painted(p);await p.screenshot({path:out+'/'+viewport.width+'-'+season+'-resume-open.png'});
   await p.locator('[data-world-close]').click();await painted(p);
   check(await p.locator('[data-world-reader]').isHidden(),'Clipboard closes to the same scene');
   await p.screenshot({path:out+'/'+viewport.width+'-'+season+'-resume-closed.png'});
   await dot(p,'contact',touch);await aligned(p,'contact');
   check(requests.some(u=>u.endsWith('concept-contact-closeup-v2.webp')),'Actual phone close-up photograph is used');
   check(await p.locator('.phone-status').isVisible(),'Contact phone has a status bar');
   check(await p.locator('.phone-address').innerText()==='philalimov.apps@gmail.com','Approved business email is shown');
   check(await p.locator('.contact-actions :is(a,button)').count()===4,'Exactly four contact actions');
   check(await p.getByRole('link',{name:'Email Philipp Alimov'}).getAttribute('href')==='mailto:philalimov.apps@gmail.com','Email action uses the correct address');
   check(await p.getByRole('link',{name:'LinkedIn',exact:true}).getAttribute('href')==='https://www.linkedin.com/in/philalimov','LinkedIn stays canonical');
   check(await p.getByRole('link',{name:'GitHub',exact:true}).getAttribute('href')==='https://github.com/Filjo0','GitHub stays canonical');
   const dimensions=await p.locator('.contact-actions :is(a,button)').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().toJSON()));
   for(const r of dimensions)check(r.width>=43&&r.height>=43&&r.y>=64&&r.bottom<=viewport.height&&r.x>=0&&r.right<=viewport.width,
    'Each contact action is readable and reachable in the screen');
   check(await p.locator('[data-world-content]').evaluate(n=>n.scrollHeight<=n.clientHeight+1),'Contact screen fits without nested scrolling');
   if(viewport.width<720||viewport.height<500){
    const screen=await p.locator('[data-world-reader]').boundingBox();
    check(screen.x<1&&Math.abs(screen.y-64)<1&&screen.width>=viewport.width-1&&screen.y+screen.height>=viewport.height-1,
     'Real contact screen fills the viewport below Back');
    check(await p.locator('[data-world-reader]').evaluate(n=>parseFloat(getComputedStyle(n).borderRadius)>=20),'Full-screen contact keeps rounded glass corners');
   }
   await painted(p);await p.screenshot({path:out+'/'+viewport.width+'-'+season+'-contact-open.png'});
   await p.locator('[data-copy-email]').click();
   await p.waitForFunction(()=>document.querySelector('[data-copy-email]').textContent!=='Copy email');
   check(['Email copied','Use the email link above'].includes(await p.locator('[data-copy-email]').innerText()),'Copy reports actual browser outcome');
   await p.locator('[data-world-close]').click();await painted(p);
   await p.screenshot({path:out+'/'+viewport.width+'-'+season+'-contact-closed.png'});
   await gear.click();await p.locator('[data-world-night]').click();
   await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1);
   await p.keyboard.press('Escape');await painted(p);
   check(await p.locator('[data-scene-object="resume"]').isVisible()||await p.locator('.world-dock [data-world-route="resume"]').isVisible(),
    'Clipboard remains reachable in '+season+' night');
   await p.screenshot({path:out+'/'+viewport.width+'-'+season+'-night.png'});
   await gear.click();await p.locator('[data-world-day]').click();
   await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===0);
   await p.keyboard.press('Escape');
  }
  await gear.click();await p.locator('[data-world-text]').click();
  check(await p.locator('#contact a[href^="mailto:"]').innerText()==='philalimov.apps@gmail.com','Simple page restores original canonical email text');
  check(await p.locator('.phone-profile,.phone-status,.phone-footnote').count()===0,'Object-only phone chrome is removed on fallback');
  check(errors.length===0,'No runtime errors: '+errors.join('; '));await p.close();
 }
 const retry=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});current=retry;
 const retryErrors=[];retry.on('pageerror',e=>retryErrors.push(e.message));
 await retry.route('**/concept-contact-closeup-v2.webp',r=>r.abort());await retry.goto(new URL('#contact',url).href);
 await retry.locator('[data-view-retry]').waitFor();
 check(await retry.locator('[data-world-close]').isVisible(),'Missing phone artwork retains a usable Back control');
 await retry.unroute('**/concept-contact-closeup-v2.webp');await retry.locator('[data-view-retry]').click();await settled(retry,'contact');
 await aligned(retry,'contact');await painted(retry);
 check(await retry.locator('.contact-actions :is(a,button)').count()===4,'Artwork retry restores exactly four canonical contact actions');
 await retry.locator('[data-world-close]').click();await retry.locator('[data-settings-toggle]').click();
 await retry.locator('[data-world-text]').click();
 check(await retry.locator('#contact a[href^="mailto:"]').innerText()==='philalimov.apps@gmail.com','Failed artwork and retry do not lose canonical contact content');
 check(retryErrors.length===0,'Optional phone load failure/retry creates no uncaught errors');await retry.close();
 console.log(name+': '+checks+' stage 2 object checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw e;}
finally{await browser.close();}
