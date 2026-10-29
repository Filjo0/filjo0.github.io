import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const b=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const dir='validation-artifacts/presentation-recheck2-implementation/'+name;await mkdir(dir,{recursive:true});
const captures=JSON.parse(await readFile('assets/previews/previews.json','utf8'));
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
try{for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:844,height:390}]){
 const p=await b.newPage({viewport,reducedMotion:'reduce',hasTouch:viewport.width<720}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));console.log(name+': checking follow-up '+viewport.width+'px');
 await p.goto(url+'/#work');await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='work'&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 await p.waitForFunction(()=>document.querySelectorAll('.workspace-shot img').length===5);
 check(await p.locator('.workspace-subtitle').count()===0,'No clipped footer hangs onto the laptop bezel');
 if(viewport.width<720){
  const rows=await p.locator('.workspace-card').evaluateAll(ns=>ns.map(n=>({
   rect:n.getBoundingClientRect().toJSON(),left:n.offsetLeft,top:n.offsetTop,height:n.offsetHeight})));
  check(rows.slice(1).every((r,i)=>r.left===rows[0].left&&r.top>=rows[i].top+rows[i].height&&r.rect.y>=rows[i].rect.bottom),
   'Phone apps form one card per row, without overlapping screenshots');
 }
 await p.screenshot({path:dir+'/'+viewport.width+'-work-open.png'});
 for(const [i,id] of ['futsl','aqua','treadfront'].entries()){
  const card=p.locator('.workspace-card').nth(i),image=card.locator('img').first();await image.evaluate(n=>n.decode());
  if(viewport.width<720)await card.scrollIntoViewIfNeeded();
  check(await image.evaluate(n=>n.complete&&n.naturalWidth>0),id+': actual image is loaded');
  if(id!=='treadfront'){
   const expected=captures.projects[id].screens.slice(0,2).map(s=>s.image);
   check(JSON.stringify(await card.locator('img').evaluateAll(ns=>ns.map(n=>n.getAttribute('src'))))===JSON.stringify(expected),id+': both real dated captures are used');
   check(await card.locator('[data-app-website],[data-app-store]').count()===(id==='futsl'?3:2),id+': website and published stores replace preview');
  }
  check(await card.locator('.workspace-purpose').innerText().then(t=>t.length>15),id+': clear app purpose');
  const emphasis=await card.evaluate(n=>{
   const primary=n.querySelector('.workspace-action'),secondary=n.querySelector('[data-project-notes]');
   return {fill:getComputedStyle(primary).backgroundColor,height:primary.getBoundingClientRect().height,
    border:getComputedStyle(secondary).borderTopWidth};
  });
  check(emphasis.height>=43&&emphasis.fill!=='rgba(0, 0, 0, 0)'&&emphasis.border==='0px',
   id+': website/demo has the filled primary action and case study is secondary');
  // Two external links make cards taller; short landscape uses the same outer scroll as portrait phones.
  if(viewport.width<720||viewport.height<500)await card.locator('[data-project-notes]').scrollIntoViewIfNeeded();
  const caseStudy=await card.locator('[data-project-notes]').boundingBox(),reader=await p.locator('[data-world-reader]').boundingBox();
  check(caseStudy.height>=43&&caseStudy.y>=reader.y&&caseStudy.y+caseStudy.height<=reader.y+reader.height,
   id+': usable case-study action fully visible'+(viewport.width<720||viewport.height<500?' after scrolling its card':' in the first screen'));
  if(viewport.width<720){
   const singleLine=await card.locator('.workspace-action').evaluate(n=>{
    const range=document.createRange();range.selectNodeContents(n);
    return range.getBoundingClientRect().height<=parseFloat(getComputedStyle(n).lineHeight)+2&&range.getBoundingClientRect().width<=n.clientWidth;
   });
   check(singleLine,id+': primary action fits on one readable line');
   const widths=await card.locator('img').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().width));
   check(widths.reduce((a,b)=>a+b,0)>=reader.width*.5,id+': complete screenshots fill useful phone-card space');
   check(await p.evaluate(()=>scrollY===0),id+': scrolling stays inside the laptop screen');
  }
 }
 if(viewport.width<720)await p.locator('.workspace-home h3').scrollIntoViewIfNeeded();
 await p.screenshot({path:dir+'/'+viewport.width+'-work.png'});
 await p.locator('[data-project-notes="0"]').click();check(await p.locator('[data-world-section="work"] .project').first().isVisible(),
 'Case study opens the canonical project story');await p.locator('[data-notes-home]').click();
 await p.locator('[data-world-close]').click();await p.locator('[data-scene-object="books"]').click();
 await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='books'&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 if(viewport.width<720||viewport.height<500){
  for(const action of ['[data-book-turn]','[data-book-suggest]']){
   const r=await p.locator(action).boundingBox(),paper=await p.locator('[data-world-reader]').boundingBox();
   check(r.width>=44&&r.height>=44&&r.x>=paper.x&&r.y>=paper.y&&r.x+r.width<=paper.x+paper.width+1&&r.y+r.height<=paper.y+paper.height+1,
   'Both mobile book actions are immediately visible on the current page');
  }
  await p.screenshot({path:dir+'/'+viewport.width+'-books.png'});
  await p.locator('[data-book-turn]').click();check(await p.locator('[data-book-open]').count()===5,'Turn page shows five real titles');
  await p.locator('[data-book-shelf]').click();await p.locator('[data-book-suggest]').click();
 }else await p.locator('[data-reading-next]').click();
 check(await p.locator('[data-reading-id]').isVisible(),'Suggestion opens an actual recommendation with its source');
 await p.screenshot({path:dir+'/'+viewport.width+'-book-suggested.png'});
 await p.locator('[data-world-close]').click();await p.locator('.world-dock [data-world-route="resume"]').click();
 await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='resume'&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 await p.locator('[data-resume-document] h1').waitFor();
 const evidence=await p.locator('[data-world-reader]').evaluate(n=>{
  const root=n.querySelector('[data-world-content]'),host=root.querySelector('[data-resume-document]'),shadow=host.shadowRoot;
  const scrolling=[root,...root.querySelectorAll('*'),...shadow.querySelectorAll('*')].filter(e=>
   e.clientHeight&&e.scrollHeight>e.clientHeight+1&&/auto|scroll/.test(getComputedStyle(e).overflowY));
  const paper=n.getBoundingClientRect(),header=shadow.querySelector('.masthead').getBoundingClientRect();
  return {owners:scrolling.map(e=>e===root?'outer':e.tagName),paper:paper.toJSON(),header:header.toJSON()};
 });
 check(evidence.owners.length===1&&evidence.owners[0]==='outer','Résumé has exactly one outer scroll owner');
 check(evidence.header.x>=evidence.paper.x&&evidence.header.right<=evidence.paper.right+1,'Résumé header stays within the paper');
 if(viewport.width<720)check(evidence.paper.height>=viewport.height-110,'Mobile paper uses the full available height');
 if(viewport.height<500)check(evidence.paper.width>=500,'Landscape paper has a useful text width');
 await p.screenshot({path:dir+'/'+viewport.width+'-resume.png'});
 check(await p.locator('[data-resume-pager]').count()===0,'Continuous résumé has no duplicated page switches');
 check(await p.locator('[data-resume-document]').getAttribute('data-layout')==='continuous','Résumé uses one continuous layout');
 const last=p.locator('[data-resume-document] .language-list li').last(),resumeScroll=p.locator('[data-world-content]');
 await resumeScroll.hover();for(let i=0;i<25;i++){
  if(await resumeScroll.evaluate(n=>n.scrollTop>=n.scrollHeight-n.clientHeight-1))break;
  await p.mouse.wheel(0,600);await p.waitForTimeout(50);
 }
 const end=await last.boundingBox(),clip=await p.locator('[data-world-content]').boundingBox();
 check(end.y>=clip.y-1&&end.y+end.height<=clip.y+clip.height+1,'Final résumé content is reachable with the one outer scroll');
 check(await p.evaluate(()=>scrollY===0),'Reading to the end does not move the world page');
 await p.screenshot({path:dir+'/'+viewport.width+'-resume-end.png'});
 check(errors.length===0,'No browser errors: '+errors.join('; '));await p.close();
}console.log(name+': '+checks+' follow-up object checks passed.');}finally{await b.close();}
