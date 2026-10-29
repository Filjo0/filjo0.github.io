import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),name=process.env.STUDIO_BROWSER||'chromium';
const url=process.env.STUDIO_URL||'http://127.0.0.1:8765/',out='validation-artifacts/redesign-15oct/stage4-complete/diagnostics-'+name;
await mkdir(out,{recursive:true});
const browser=await pw[name].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?
 {executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let currentPage,currentScenario,currentLogs=[];
let checks=0;const records=[],check=(v,m)=>{assert.ok(v,m);checks++;};
try{
 for(const scenario of (process.env.FALLBACK_SCENARIOS||'visitor-request,webgl-context-lost,startup-error,scene-asset-error,module-load-error').split(',')){
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),events=[],errors=[];
  currentPage=p;currentScenario=scenario;currentLogs=[];
  p.on('console',m=>{if(['warning','error'].includes(m.type())||m.text().includes('[portfolio:fallback]'))currentLogs.push(m.text());});
  console.log(name+': fallback '+scenario);
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',async m=>{if(m.type()==='info'&&m.text().startsWith('[portfolio:fallback]'))
    events.push(await m.args()[1].jsonValue());});
  if(scenario==='startup-error')await p.addInitScript(()=>{const context=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:context.call(this,type,...args);};});
  if(scenario==='scene-asset-error')await p.route('**/assets/outdoor/concept-coast-v2.webp',r=>r.fulfill({status:404,body:'missing'}));
  if(scenario==='module-load-error')await p.route('**/world-controller.js',r=>r.fulfill({status:404,body:'missing'}));
  await p.goto(url);
  if(['visitor-request','webgl-context-lost'].includes(scenario)){
   await p.waitForFunction(()=>document.querySelector('[data-world-render]').dataset.sceneReady==='true');
   check(events.length===0,'Healthy scene produces no fallback log');
   if(scenario==='visitor-request'){
    await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-text]').click();
   }else{
    const native=await p.locator('canvas').evaluate(n=>{const gl=n.getContext('webgl2')||n.getContext('webgl');
     const loss=gl.getExtension('WEBGL_lose_context');if(loss){loss.loseContext();return true;}
     n.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));return false;});
    records.push({browser:name,scenario,nativeContextLoss:native});
   }
  }
  await p.waitForFunction(()=>!document.body.dataset.worldReady&&document.querySelector('[data-world-fallback]').hidden===false);
  for(let i=0;i<30&&!events.length;i++)await p.waitForTimeout(50);
  check(events.length===1,'Each actual fallback records one diagnostic: '+scenario);
  check(events[0].reason===scenario,'The recorded cause identifies '+scenario+': '+JSON.stringify(events[0]));
  if(scenario==='scene-asset-error')check(events[0].asset==='concept-coast-v2.webp','Failed artwork filename is retained');
  if(scenario==='startup-error')check(/webgl/i.test(events[0].error.message),'Unavailable WebGL context is identified in the startup error');
  check(await p.locator('[data-world-fallback] #experience .timeline-entry').count()===5,'The complete approved portfolio remains visible');
  check(await p.locator('a[href="mailto:philalimov.apps@gmail.com"]').count()>0,'Contact action remains available');
  check(!('userAgent' in events[0])&&!('session' in events[0]),'Diagnostics contain no visitor/session identifiers');
  check(!errors.length,'No uncaught errors in the controlled fallback: '+errors.join('; '));
  records.push({browser:name,scenario,diagnostic:events[0]});await p.close();
 }
 await writeFile(out+'/result.json',JSON.stringify({checks,records},null,2));console.log(name+': '+checks+' fallback diagnostic checks passed.');
}catch(error){
 if(currentPage&&!currentPage.isClosed()){
  const state=await currentPage.evaluate(()=>({body:{...document.body.dataset},
   canvas:document.querySelector('canvas')?.dataset.worldState,
   resources:performance.getEntriesByType('resource').map(r=>({name:r.name,duration:r.duration}))}));
  await writeFile(out+'/failure.json',JSON.stringify({scenario:currentScenario,error:error.message,logs:currentLogs,state},null,2));
  await currentPage.screenshot({path:out+'/failure.png'});
 }
 throw error;
}finally{await browser.close();}
