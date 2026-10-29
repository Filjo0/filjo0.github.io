import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const art=resolve(import.meta.dirname,'../validation-artifacts/phase02',name);await mkdir(art,{recursive:true});
const captures=JSON.parse(await readFile(resolve(import.meta.dirname,'../assets/previews/previews.json'),'utf8'));
const resume=await readFile(resolve(import.meta.dirname,'../resume.html'),'utf8');
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0;function check(value,message){assert.ok(value,message);checks++;}
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:844,height:390}]) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce',hasTouch:viewport.width<700});
  const errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  page.on('requestfailed',r=>{if(!/ABORTED|cancelled/i.test(r.failure()?.errorText||''))failures.push(r.url());});
  await page.goto(url);await page.waitForFunction(()=>document.body.dataset.worldReady==='true');
  const go=async id=>{
   if(await page.locator('.tank-frame').count()){
    const close=page.locator('[data-demo-close]');
    if(await close.isVisible())await close.click();else await page.locator('[data-world-close]').click();
    await page.locator('.tank-frame').waitFor({state:'detached'});
   }
   if(await page.locator('[data-world-reader]').isVisible())await page.locator('[data-world-close]').click();
   if(id==='tank'){await go('work');await page.locator('[data-demo-open]').click();}
   else if(['futsl','aqua'].includes(id)) {await page.evaluate(id=>{location.hash=id;},id);await page.waitForFunction(()=>location.hash==='#work');}
   else if(['coast','winter','overview'].includes(id)) {
    await page.locator('[data-settings-toggle]').click();
    await page.locator(`[data-world-route="${id==='overview'?'coast':id}"]`).first().click();
   } else {
    const link=page.locator(`[data-world-route="${id}"]`).first();
    await link.click();
   }
   if(!['overview','coast','winter'].includes(id))await page.locator('[data-world-reader]').waitFor();
   if(['work','experience','resume','contact','futsl','aqua','tank'].includes(id))
    await page.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  };
  async function surface(id) {
   const reader=page.locator('[data-world-reader]');
   await reader.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   check(await reader.getAttribute('data-object')===id,`${id}: actual object is inspected`);
   check(await reader.evaluate(n=>n.classList.contains('world-object')&&n.style.transform.startsWith('matrix3d')),
     `${id}: mounted on a projected object, not a fixed side card`);
   const evidence=await reader.evaluate(n=>{
    const host=document.querySelector('[data-world-render]').getBoundingClientRect();
    const expected=JSON.parse(n.dataset.surfaceCorners);
    const markers=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{
      const point=document.createElement('span');point.style.cssText=`position:absolute;left:${x*100}%;top:${y*100}%;width:0;height:0;pointer-events:none`;
      n.append(point);const r=point.getBoundingClientRect();point.remove();return {x:r.x-host.x,y:r.y-host.y};
    });
    const clip=n.querySelector('[data-world-content]');
    return {expected,markers,rect:n.getBoundingClientRect().toJSON(),font:parseFloat(getComputedStyle(clip).fontSize),
      pageScroll:scrollY,overflow:document.documentElement.scrollWidth>innerWidth,clipHeight:clip.clientHeight,clipOverflow:getComputedStyle(clip).overflowY};
   });
   evidence.markers.forEach((point,i)=>check(Math.hypot(point.x-evidence.expected[i].x,point.y-evidence.expected[i].y)<1,
     `${id} ${viewport.width}px: DOM corner ${i} aligns: actual ${JSON.stringify(point)} expected ${JSON.stringify(evidence.expected[i])}`));
   check(evidence.clipHeight>=(viewport.height<500?90:280),`${id}: useful reading viewport height ${evidence.clipHeight}`);
   const r=evidence.rect;check(r.x>=0&&r.y>=0&&r.right<=viewport.width&&r.bottom<=viewport.height,
     `${id}: readable surface fits viewport`);
   check(evidence.font>=15&&!evidence.overflow&&evidence.pageScroll===0,`${id}: readable type without page overflow`);
   check(await page.locator('[data-world-text]').isHidden(),`${id}: text-mode control cannot cover the surface`);
   const button=await page.locator('[data-world-close]').boundingBox();
   check(button.width>=43&&button.height>=43,`${id}: return control has a real touch target`);
  }
  await page.screenshot({path:resolve(art,`${viewport.width}-overview.png`)});
  for(const id of ['work','experience','resume','contact','tank']) {
   await go(id);await surface(id==='tank'?'work':id);
   if(id==='resume') {
    await page.locator('[data-resume-document] h1').waitFor();
    check(await page.locator('.world-resume').count()===0,'Résumé has no nested frame');
    const same=await page.locator('[data-resume-document]').evaluate((n,text)=> {
      const source=new DOMParser().parseFromString(text,'text/html');
      const clean=s=>s.replace(/\s+/g,' ').trim();
      return clean([...n.shadowRoot.querySelectorAll('article.page')].map(n=>n.textContent).join(' '))===
        clean([...source.querySelectorAll('body > article.page')].map(n=>n.textContent).join(' '));
    },resume);check(same,'Every approved résumé fact matches its source document');
    check(await page.locator('[data-resume-pager]').count()===0,'The full résumé has no page-switch controls');
    check(await page.locator('[data-resume-document] article.page').evaluateAll(ns=>ns.every(n=>!n.hidden)),
      'Both source sections remain in the same continuous paper flow');
    const scroll=page.locator('[data-world-content]');
    const start=await scroll.evaluate(n=>n.scrollTop);await scroll.hover();await page.mouse.wheel(0,360);
    await page.waitForFunction(()=>document.querySelector('[data-world-content]').scrollTop>50);
    check(await scroll.evaluate(n=>n.scrollTop)>start,'The single outer résumé scroll moves');
    check(await page.evaluate(()=>scrollY===0),'Reading résumé does not scroll the world page');
    await scroll.evaluate(n=>n.scrollTop=0);
    await page.locator('#world-reader-title').focus();
    for(let i=0;i<5;i++) {
      await page.keyboard.press('Tab');
      const focused=await page.evaluate(()=>{let n=document.activeElement;while(n.shadowRoot?.activeElement)n=n.shadowRoot.activeElement;
        const r=n.getBoundingClientRect(),clip=document.querySelector('[data-world-content]').getBoundingClientRect();
        return {tag:n.tagName,text:n.textContent.trim().slice(0,80),href:n.getAttribute('href'),r:r.toJSON(),clip:clip.toJSON()};});
      if(!(['A','BUTTON'].includes(focused.tag)&&focused.r.y>=0&&focused.r.bottom<=viewport.height&&
        (focused.tag==='BUTTON'||(focused.r.y>=focused.clip.y-1&&focused.r.bottom<=focused.clip.bottom+1))))
        console.error('Keyboard focus evidence',JSON.stringify({viewport,step:i,focused}));
      check(['A','BUTTON'].includes(focused.tag)&&focused.r.y>=0&&focused.r.bottom<=viewport.height&&
        (focused.tag==='BUTTON'||(focused.r.y>=focused.clip.y-1&&focused.r.bottom<=focused.clip.bottom+1)),
        'Keyboard reaches visible real links/controls on the résumé board');
    }
    await page.keyboard.press('Escape');check(await page.locator('[data-world-reader]').isHidden(),'Escape from résumé returns to the world');
    await go('resume');await page.locator('[data-resume-document] h1').waitFor();
   }
   if(id==='contact') {
    check(await page.locator('[data-world-section="contact"] a[href="mailto:philalimov.apps@gmail.com"]').isVisible(),
      'Business email is readable on the phone');
    check(await page.locator('[data-world-section="contact"]').innerText().then(t=>!t.includes('philalimov@gmail.com')),
      'Portfolio phone retains the approved business contact');
   }
   await page.screenshot({path:resolve(art,`${viewport.width}-${id}.png`)});
  }
  for(const id of ['futsl','aqua']) {
    await go(id);await page.locator('.workspace-shot img').first().waitFor();await surface('work');
    check(new URL(page.url()).hash==='#work',id+': retired preview URL redirects to My apps');
    const card=page.locator('[data-app-card="'+id+'"]'),project=captures.projects[id];
    check(await card.locator('.workspace-capture-date').textContent().then(t=>t.includes('Screenshots')),id+': capture date remains visible');
    check(await card.locator('img').count()===2,id+': two real static screenshots');
    for(const [i,screen] of project.screens.slice(0,2).entries()){
      const image=card.locator('img').nth(i);await image.evaluate(n=>n.decode());
      check(await image.getAttribute('src')===screen.image&&await image.evaluate(n=>n.naturalWidth===390&&n.naturalHeight===744&&getComputedStyle(n).objectFit==='contain'),id+': full real capture is loaded');
    }
    for(const link of await card.locator('[data-app-website],[data-app-store]').all()){await link.scrollIntoViewIfNeeded();
      check(await link.getAttribute('target')==='_blank'&&(await link.getAttribute('rel')).includes('noopener'),id+': canonical external action is available safely');
    }
    check(await page.locator('.capture-hotspot,.captured-preview,[data-preview-back]').count()===0,id+': no interactive preview remains');
    await page.screenshot({path:resolve(art,`${viewport.width}-${id}-screenshots.png`)});
  }
  await go('winter');for(const id of ['work','experience','resume','contact']) {await go(id);await surface(id);}
  await go('work');await page.evaluate(()=>location.hash='contact');await page.locator('[data-world-section="contact"]').waitFor();
  await page.goBack();
  await page.locator('.workspace-launcher').waitFor();await surface('work');
  check(errors.length===0,errors.join(';'));check(failures.length===0,failures.join(';'));
  await page.locator('[data-world-close]').click();await page.locator('[data-settings-toggle]').click();
  await page.locator('[data-world-text]').click();
  check(await page.locator('#work').isVisible()&&await page.locator('#contact').isVisible(),'Text mode restores canonical sections');
  check(await page.locator('canvas').count()===0&&await page.locator('.preview-launch').count()===0,'Text mode disposes world-only content');
  check(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.length===new Set(ids).size;}),
    'Fallback restores unique public IDs');
  await page.close();console.log(`${name}: ${viewport.width}px object content passed`);
 }
 // Click the actual pictured silhouette and watch its finite real-surface close-up approach.
 const journey=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await journey.goto(new URL('#work',url).href);await journey.locator('.workspace-launcher').waitFor();
 await journey.locator('[data-world-close]').click();
 const target=await journey.locator('canvas').evaluate(n=>JSON.parse(n.dataset.worldState).geometry.targets
   .find(t=>t.id==='work'&&t.region==='coast').screen);
 const hostBox=await journey.locator('[data-world-render]').boundingBox();
 await journey.mouse.move(hostBox.x+target.x,hostBox.y+target.y);
 const hovered=await journey.evaluate(({x,y})=>{const n=document.elementFromPoint(x,y);
   return {id:n?.closest('[data-scene-object]')?.dataset.sceneObject,cursor:n?getComputedStyle(n).cursor:''};
 },{x:hostBox.x+target.x,y:hostBox.y+target.y});
 check(hovered.id==='work'&&hovered.cursor==='pointer','Actual hovered silhouette advertises its click interaction');
 await journey.mouse.click(hostBox.x+target.x,hostBox.y+target.y);
 await journey.locator('.workspace-launcher').waitFor();
 check(await journey.locator('[data-world-reader]').getAttribute('data-object')==='work',
   'Clicking the real kiosk mesh opens its own surface');
 await journey.locator('[data-app-website="futsl"]').focus();await journey.keyboard.press('Tab');
 check(await journey.locator('[data-app-store="futsl"]').first().evaluate(n=>document.activeElement===n),'Keyboard reaches FUTSL App Store after its website');
 await journey.keyboard.press('Tab');
 check(await journey.locator('[data-app-store="futsl"]').nth(1).evaluate(n=>document.activeElement===n),'Keyboard reaches FUTSL Google Play after App Store');
 await journey.keyboard.press('Tab');
 check(await journey.locator('[data-project-notes="0"]').evaluate(n=>document.activeElement===n),'Keyboard reaches FUTSL case study');
 for(let i=0;i<2;i++){
  await journey.keyboard.press('Tab');
  check(await journey.locator('[data-app-card="aqua"] [data-enlarge-screenshot]').nth(i).evaluate(n=>document.activeElement===n),
    'Keyboard reaches Aqua screenshot '+(i+1)+' before its website');
 }
 await journey.keyboard.press('Tab');
 check(await journey.locator('[data-app-website="aqua"]').evaluate(n=>document.activeElement===n),'Keyboard reaches Aqua website');
 await journey.keyboard.press('Tab');
 check(await journey.locator('[data-app-store="aqua"]').evaluate(n=>document.activeElement===n),'Keyboard reaches Aqua App Store');
 await journey.keyboard.press('Tab');
 check(await journey.locator('[data-project-notes="1"]').evaluate(n=>document.activeElement===n),'Keyboard reaches Aqua case study');
 await journey.keyboard.press('Tab');
 check(await journey.locator('[data-demo-open]').evaluate(n=>document.activeElement===n),'Keyboard reaches the playable one-sector app');
 await journey.keyboard.press('Enter');
 check(await journey.locator('.tank-frame').getAttribute('sandbox')==='allow-scripts',
   'Kiosk launches the same opaque-origin one-sector demo');
 await journey.locator('[data-demo-close]').click();
 await journey.emulateMedia({reducedMotion:'no-preference'});
 await journey.locator('[data-world-close]').click();
 await journey.locator('.world-dock [data-world-route="resume"]').click();
 await journey.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='resume'&&
   !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 await journey.waitForFunction(()=>document.querySelector('[data-world-content]').getAnimations().some(a=>a.playState==='running'));
 await journey.keyboard.press('p');
 // Web Animations pause is pending until the browser commits its hold time.
 await journey.waitForFunction(()=>document.querySelector('[data-world-content]').getAnimations().some(a=>
  a.playState==='paused'&&!a.pending));
 const frozen=await journey.locator('[data-world-content]').evaluate(n=>n.getAnimations()[0].currentTime);
 await journey.waitForTimeout(220);
 check(await journey.locator('[data-world-content]').evaluate(n=>n.getAnimations()[0].currentTime)===frozen,
   'Pause freezes the actual photographed-object content transition');
 await journey.keyboard.press('p');
 await journey.waitForFunction(()=>!document.querySelector('[data-world-content]').getAnimations().some(a=>a.playState==='running'));
 check(await journey.locator('[data-resume-document] h1').isVisible(),'Finite transition ends on a readable board');
 await journey.screenshot({path:resolve(art,'physical-board-arrival.png')});await journey.close();
 const slow=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await slow.route('**/resume.html',async r=>{await new Promise(resolve=>setTimeout(resolve,600));await r.continue();});
 await slow.goto(`${url}/#resume`);await slow.getByText('Loading résumé…').waitFor();
 await slow.evaluate(()=>location.hash='contact');await slow.waitForTimeout(800);
 check(await slow.locator('[data-resume-document]').count()===0&&
   await slow.locator('[data-world-section="contact"]').isVisible(),'Interrupted résumé load cannot overwrite the contact phone');
 await slow.close();
 const broken=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 let failResume=true;
 await broken.route('**/resume.html',r=>{if(failResume){failResume=false;return r.fulfill({status:404,body:'Missing'});}return r.continue();});
 await broken.goto(`${url}/#resume`);await broken.getByRole('button',{name:'Retry résumé',exact:true}).waitFor();
 check(await broken.getByRole('link',{name:'Read or print résumé ↗',exact:true}).isVisible(),'Failed clipboard retains the standalone readable and printable résumé');
 await broken.getByRole('button',{name:'Retry résumé',exact:true}).click();
 await broken.locator('[data-resume-document] h1').waitFor();check(true,'Retry loads the approved résumé on its original board');
 await broken.close();
 // Missing screenshot metadata must leave real app links and canonical content usable.
 const missing=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await missing.route('**/assets/previews/previews.json',r=>r.fulfill({status:404,body:'Missing'}));
 await missing.goto(`${url}/#aqua`);await missing.waitForFunction(()=>location.hash==='#work');
 await missing.waitForFunction(()=>[...document.querySelectorAll('.workspace-shot')].filter(n=>n.textContent==='Screenshot unavailable').length===2);
 check(await missing.locator('[data-app-website],[data-app-store]').count()===6,'Missing captures retain every website and published store link');
 await missing.locator('[data-project-notes="0"]').click();check(await missing.locator('[data-world-section="work"] .project').first().isVisible(),'Missing screenshots retain the real case study');await missing.close();
 console.log(`${name}: ${checks} object, capture, résumé and accessibility checks passed.`);
}finally{await browser.close();}
