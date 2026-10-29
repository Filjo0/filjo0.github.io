import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {readingSurfaceEdges} from './reading-surface-evidence.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const out='validation-artifacts/straight-and-simple-24oct/stage-b/viewer/'+engine;await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('assets/previews/previews.json','utf8'));
const b=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const errors=[],failures=[],sizes=[],check=(v,m)=>{assert.ok(v,m);checks++;};
const settled=p=>p.waitForFunction(()=>document.querySelector('[data-world-reader]')?.dataset.object==='work'&&!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
try{for(const [width,height] of [[1440,900],[1280,720],[390,844],[320,568],[844,390]]){
 const touch=width<720||height<500,p=await b.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});current=p;
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
 await p.goto((process.env.STUDIO_URL||'http://127.0.0.1:8765/')+'#work');await settled(p);
 await p.waitForFunction(()=>document.querySelectorAll('[data-enlarge-screenshot]').length===4);
 const dialog=p.locator('.app-screenshot-viewer'),image=dialog.locator('img');
 for(const id of ['futsl','aqua'])for(const [i,capture] of manifest.projects[id].screens.slice(0,2).entries()){
  const trigger=p.locator('[data-app-card="'+id+'"] [data-enlarge-screenshot]').nth(i);await trigger.scrollIntoViewIfNeeded();
  touch?await trigger.tap():await trigger.click();await image.evaluate(n=>n.decode());
  check(await dialog.evaluate(n=>n.open&&n.matches(':modal')),'Image opens as a native modal, independent of laptop projection');
  check(await dialog.locator('h2').innerText()===manifest.projects[id].name+' · '+capture.label,'Viewer identifies the exact screenshot');
  check(await image.getAttribute('src')===capture.image&&await image.getAttribute('alt')===capture.alt,'Viewer uses the original dated capture and alt text');
  check((await dialog.locator('figcaption').innerText()).includes('9 Oct 2026'),'Capture date remains visible');
  const rect=await image.boundingBox(),frame=await dialog.boundingBox(),edges=await readingSurfaceEdges(dialog.locator('.screenshot-image'));
  check(rect.width>=(width<720?140:height<500?80:300),'Enlarged screenshot is readable, not a laptop thumbnail: '+JSON.stringify({width,height,rect}));
  const wrapper=await dialog.locator('.screenshot-image').boundingBox();
  check(['x','y','width','height'].every(k=>Math.abs(wrapper[k]-rect[k])<.1),'Rendered edge probes coincide with all image bounds');
  check(await image.evaluate(n=>getComputedStyle(n).transform==='none'),'Image has no independent transform inside its measured wrapper');
  check(edges.maxDeviation<=1,'Enlarged screenshot is flat');
  if(id==='futsl'&&i===0){
   const surface=dialog.locator('.screenshot-image');await surface.evaluate(n=>n.style.transform='rotate(2deg)');
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   try{check((await readingSurfaceEdges(surface)).maxDeviation>1,'Negative control: rendered-edge check rejects a two-degree tilt');}
   finally{await surface.evaluate(n=>n.style.removeProperty('transform'));
    await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
   check((await readingSurfaceEdges(surface)).maxDeviation<=1,'Negative control fully restores the flat image before layout checks');
  }
  check(frame.x>=0&&frame.y>=0&&frame.x+frame.width<=width+1&&frame.y+frame.height<=height+1,'Whole viewer fits the viewport');
  check(rect.x>=frame.x&&rect.y>=frame.y&&rect.x+rect.width<=frame.x+frame.width+1&&rect.y+rect.height<=frame.y+frame.height+1,'All four image edges are visible inside the viewer');
  check(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1),'Viewer has no hidden overflow at this size');
  check(await image.evaluate(n=>getComputedStyle(n).objectFit==='contain'&&n.getBoundingClientRect().height<=n.naturalHeight+1),'Whole capture is shown without cropping');
  check(await dialog.locator('button').evaluate(n=>document.activeElement===n),'Focus starts on Close');
  await p.keyboard.press('Tab');await p.keyboard.press('Tab');
  check(await p.evaluate(()=>document.activeElement.closest('.app-screenshot-viewer')!==null),'Native modal contains keyboard focus');
  if(i===0)await p.screenshot({path:out+'/'+width+'x'+height+'-'+id+'-large.png'});
  if(i===0)await p.keyboard.press('Escape');else {const close=dialog.locator('button');touch?await close.tap():await close.click();}
  check(await dialog.evaluate(n=>!n.open),'Escape or Close dismisses the viewer');
  check(await trigger.evaluate(n=>document.activeElement===n),'Focus returns to the exact thumbnail');
  check(await p.locator('[data-world-reader]').getAttribute('data-object')==='work'&&await p.locator('[data-world-reader]').isVisible(),'Closing the viewer keeps My apps open');
 }
 const first=p.locator('[data-enlarge-screenshot]').first();await first.focus();await p.keyboard.press('Enter');await image.evaluate(n=>n.decode());
 check(await dialog.evaluate(n=>n.open),'Enter opens a focused screenshot');
 await p.evaluate(()=>location.hash='experience');await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='experience');
 check(await p.locator('.app-screenshot-viewer').count()===0,'Navigating away disposes the viewer and modal');
 await p.locator('[data-world-close]').click();check(await p.locator('[data-world-reader]').isHidden(),'No orphan modal blocks returning to the scene');
 sizes.push({width,height});await p.close();
}
check(!errors.length,'No runtime errors: '+errors.join(';'));check(!failures.length,'No failed requests: '+failures.join(';'));
await writeFile(out+'/results.json',JSON.stringify({engine,checks,sizes,errors,failures},null,2));console.log(engine+': '+checks+' enlarged-screenshot checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw e;}finally{await b.close();}
