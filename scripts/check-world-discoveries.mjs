import assert from 'node:assert/strict';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium';
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0;const check=(value,message)=>{assert.ok(value,message);checks++};
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:844,height:390}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce',hasTouch:viewport.width<700});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>document.body.dataset.worldReady==='true');
  for(const region of ['coast','winter']){
   await page.locator('[data-settings-toggle]').click();
   await page.locator('[data-world-route="'+region+'"]').first().click();
   // The first winter request loads its artwork; wait for the selected view before leaving it.
   await page.waitForFunction(region=>{
    const state=JSON.parse(document.querySelector('canvas').dataset.worldState);
    return state.region===region&&state.transition.phase==='settled';
   },region);
   // Removed discoveries retain useful deep links to canonical public content.
   for(const [id,text] of [['coaching','Floreat Athena FC'],['tennis','FUTSL'],['receipts','Aqua Local']]){
    const canonical=id==='coaching'?'experience':'work';
    await page.evaluate(route=>{location.hash=route;},id);
    await page.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
    const reader=page.locator('[data-world-reader]');
    check(await reader.getAttribute('data-object')===canonical,id+': canonical physical object');
    check((await page.locator('[data-world-content]').textContent()).includes(text),id+': factual public content');
    const alignment=await reader.evaluate(n=>{
     const host=document.querySelector('[data-world-render]').getBoundingClientRect();
     const expected=JSON.parse(n.dataset.surfaceCorners);
     return [[0,0],[1,0],[1,1],[0,1]].map(([x,y],i)=>{
      const point=document.createElement('span');
      point.style.cssText='position:absolute;left:'+x*100+'%;top:'+y*100+'%;width:0;height:0;pointer-events:none';
      n.append(point);const r=point.getBoundingClientRect();point.remove();
      return Math.hypot(r.x-host.x-expected[i].x,r.y-host.y-expected[i].y);
     });
    });
    alignment.forEach(error=>check(error<1,id+': actual mesh and DOM corners align within 1 px'));
    const rect=await reader.boundingBox();
    check(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1,id+': reader fits');
    const body=page.locator('[data-world-content]');
    check(await body.evaluate(n=>n.scrollWidth<=n.clientWidth+1),id+': no horizontal content overflow');
    const action=id==='coaching'?body.locator('a[data-world-route="resume"]').first():
      body.locator('[data-project-notes="'+(id==='tennis'?'0':'1')+'"]');
    await action.focus();const link=await action.boundingBox();
    check(link.height>=44,id+': accessible action');
    await page.screenshot({path:'validation-artifacts/coastal-rebuild/'+name+'-'+viewport.width+'x'+viewport.height+'-'+region+'-'+id+'.png'});
    await action.press('Enter');
    const destination=id==='coaching'?'resume':'work';
    await page.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id &&
      !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),destination);
    check(await reader.getAttribute('data-object')===destination,id+': contextual action opens the canonical public case study');
    await page.keyboard.press('Escape');
    if(await reader.isVisible())await page.keyboard.press('Escape');
    await reader.waitFor({state:'hidden'});
    const state=await page.locator('canvas').first().getAttribute('data-world-state');
    check(JSON.parse(state).region===region,id+': exit preserves region');
   }
  }
  check(errors.length===0,JSON.stringify(errors));await page.close();
 }
 console.log('Discovery browser checks: '+checks+' passed ('+name+')');
}finally{await browser.close()}
