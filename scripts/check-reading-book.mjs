import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {readings,readingCategories} from '../room-reading.js';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765/';
const out=(process.env.BOOK_ARTIFACT_DIR||'validation-artifacts/redesign-15oct/stage3-fit')+'/'+name;await mkdir(out,{recursive:true});
const sizes=(process.env.BOOK_VIEWPORTS||'1440x900,1280x720,390x844,320x568,844x390').split(',').map(s=>{
 const [width,height]=s.split('x').map(Number);return {width,height};});
const browser=await pw[name].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const captures=[];
const settled=p=>p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='books'&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
async function capture(p,viewport,label){
 const file=viewport.width+'x'+viewport.height+'-'+label+'.png';await p.screenshot({path:out+'/'+file});captures.push(file);
}
try{for(const viewport of sizes){
 const mobile=viewport.width<=720||viewport.height<500,touch=viewport.width<=960;
 const p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'});current=p;
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 console.log(name+': reading book '+viewport.width+'x'+viewport.height);
 await p.goto(url+'#books');await settled(p);await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 async function control(n,onPaper=true){
  const r=await n.boundingBox(),paper=await p.locator('[data-world-reader]').boundingBox();
  check(r.width>=44&&r.height>=44,'Real projected control keeps a 44px target: '+JSON.stringify(r)+' '+await n.getAttribute('data-book-topic'));
  if(onPaper)check(r.x>=paper.x-1&&r.y>=paper.y-1&&r.x+r.width<=paper.x+paper.width+1&&r.y+r.height<=paper.y+paper.height+1,'Control remains on the physical paper');
  check(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1,'Control remains inside the viewport');
  check(await n.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'No layer covers the actual control centre');
  return r;
 }
 async function press(n,onPaper=true){const r=await control(n,onPaper);touch?await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2):await n.click();}
 async function fits(label){
  const measurements=await p.locator('.book-leaf:visible').evaluateAll(ns=>ns.map(leaf=>{
   const n=leaf.querySelector('.book-leaf-text'),box=n.getBoundingClientRect();
   const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),outside=[];
   for(let t=walker.nextNode();t;t=walker.nextNode()){
    if(!t.textContent.trim()||!t.parentElement.getClientRects().length)continue;
    const range=document.createRange();range.selectNodeContents(t);
    for(const r of range.getClientRects())if(r.width&&r.height&&
     (r.top<box.top-1||r.bottom>box.bottom+1||r.left<box.left-1||r.right>box.right+1))outside.push(t.textContent.trim());
   }
   const footerNode=leaf.querySelector('footer'),footer=footerNode.getBoundingClientRect();
   return {width:n.clientWidth,height:n.clientHeight,scrollWidth:n.scrollWidth,scrollHeight:n.scrollHeight,
    overflow:getComputedStyle(n).overflow,outside,footerClear:!footerNode.getClientRects().length||box.bottom<=footer.top+1};
  }));
  for(const m of measurements){
   check(m.scrollHeight<=m.height+1,label+': every line fits vertically '+JSON.stringify(m));
   check(m.scrollWidth<=m.width+1,label+': every line fits horizontally');
   check(!['auto','scroll','hidden','clip'].includes(m.overflow),label+': no scroll or clipping area hides notes');
   check(m.outside.length===0,label+': text line boxes stay inside the page: '+m.outside.join(' / '));
   check(m.footerClear,label+': page controls do not overlap the text');
  }
  check(await p.locator('[data-world-content]').evaluate(n=>n.scrollHeight<=n.clientHeight+1&&n.scrollWidth<=n.clientWidth+1),
   label+': the outer book does not hide overflow');
 }
 check(await p.locator('[data-book-topic]').count()===6,'Six topics are available');
 await fits('Contents');
 if(mobile){
  check(await p.locator('.book-leaf:visible').count()===1,'Only one physical book page is visible on a phone');
  await control(p.locator('[data-book-turn]'));await control(p.locator('[data-book-suggest]'));
 }
 await capture(p,viewport,'contents');
 const visited=new Set();
 for(const [category] of readingCategories){
  await press(p.locator('[data-book-topic="'+category+'"]'));
  await fits(category+' titles');
  check(await p.locator('[data-book-open]').count()===5,'Each chapter offers five distinct readings');
  if(mobile)check(await p.locator('.book-contents').isHidden(),'Turning to titles hides the contents leaf');
  if(category==='apps')await capture(p,viewport,'titles');
  const chapter=readings.filter(r=>r.category===category);
  for(const r of chapter){
   await press(p.locator('[data-book-open="'+r.id+'"]'));
   check(await p.locator('.book-notes h3').innerText()===r.displayTitle,'Chosen short title is the actual reading');
   check(await p.locator('[data-reading-id]').getAttribute('data-reading-id')===r.id,'Choice and displayed reading agree');
   check(await p.locator('.book-key-ideas li').count()===3,'Every recommendation has three key ideas');
   check((await p.locator('.book-key-ideas').innerText()).includes(r.keyIdeas[2]),'The third idea is present, not truncated from the DOM');
   check(await p.locator('.book-intro').innerText()===r.intro,'The full why-read-it introduction is rendered');
   check(await p.locator('.book-notes .book-author').innerText()===r.author,'The chosen author is credited');
   check(await p.locator('[data-world-content]').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'The outer book has no horizontal overflow');
   if(mobile)check(await p.locator('.book-leaf:visible').count()===1,'Notes show one leaf, with exercise on the next');
   const sample=['quality-1','apps-2','apps-3','accessibility-2','maths-5'].includes(r.catalogueId);
   await fits(r.catalogueId+' notes');
   if(sample)await capture(p,viewport,r.catalogueId+'-notes');
   await control(p.locator('[data-book-shelf]:visible'));
   if(mobile){
    await press(p.locator('[data-book-turn]'));
    check(await p.locator('.book-ideas').isVisible()&&await p.locator('.book-summary').isHidden(),
     'The middle phone page is Three ideas, without repeating the notes');
    await fits(r.catalogueId+' ideas');
    if(sample)await capture(p,viewport,r.catalogueId+'-ideas');
    await press(p.locator('[data-book-turn]'));
   }
   await fits(r.catalogueId+' exercise');
   check(await p.locator('.book-recommendation h3').isVisible(),'Exercise page is visible');
   check(await p.locator('.book-exercise').innerText()===r.prompt,'Each reading has its own original exercise');
   check(await p.locator('.book-access').innerText()===r.access,'Free and paid access are labelled accurately');
   check(await p.locator('.book-source').getAttribute('href')===r.source,'Source points to the verified work');
   const basis=p.locator(r.basis.url===r.source?'.book-source':'.book-basis');
   check(await basis.getAttribute('href')===r.basis.url,'The three ideas have a visible evidence link');
   check((await p.locator('.book-credits').innerText()).includes(r.author),'Full author credits are retained');
   if(r.author===r.publisher)check(await p.locator('.book-credits').innerText()===r.author,'Self-published credit is shown once');
   for(const link of [p.locator('.book-source'),basis]){
    check(await link.getAttribute('target')==='_blank'&&(await link.getAttribute('rel')).includes('noopener'),'External reading opens only on a deliberate safe link');
   }
   check(await p.locator('[data-reading-next]').innerText()==='Surprise me ↻','Suggestions have a visible word label');
   if(mobile)check(await p.locator('.book-recommendation [data-book-prev-page]').innerText()==='← Back','Back has a visible word label');
   if(r.basis.url!==r.source){
    check((await basis.innerText()).replace(/\s+/g,' ')==='About this reading ↗','Supporting links have a visitor-facing label');await control(basis);
   }else check(await p.locator('.book-basis').count()===0,'Identical source links are not duplicated');
   check(await p.getByRole('button',{name:'Next reading →',exact:true}).count()===1,'Next reading has the visible accessible name');
   await control(p.locator('[data-book-next]'));
   if(sample)await capture(p,viewport,r.catalogueId+'-exercise');
   await control(p.locator('.book-source'));
   if(mobile){await press(p.locator('[data-book-prev-page]:visible'));await fits('Previous ideas');
    await press(p.locator('[data-book-prev-page]:visible'));await fits('Previous notes');}
   await press(p.locator('[data-book-shelf]:visible'));visited.add(r.id);
  }
  // Chapter stepping wraps deterministically rather than choosing a random work.
  await press(p.locator('[data-book-open="'+chapter.at(-1).id+'"]'));
  if(mobile){await press(p.locator('[data-book-turn]'));await press(p.locator('[data-book-turn]'));}
  await press(p.locator('[data-book-next]'));
  check(await p.locator('[data-reading-id]').getAttribute('data-reading-id')===chapter[0].id,'Next in chapter wraps to its first reading');
  await press(p.locator('[data-book-shelf]:visible'));await press(p.locator('[data-book-shelf]:visible'));
 }
 check(visited.size===30,'All 30 readings were opened through native controls');
 if(mobile)await press(p.locator('[data-book-suggest]'));else await press(p.locator('[data-reading-next]'));
 let previous=await p.locator('[data-reading-id]').getAttribute('data-reading-id');
 for(let i=0;i<5;i++){
  if(mobile){await press(p.locator('[data-book-turn]'));await press(p.locator('[data-book-turn]'));}
  await press(p.locator('[data-reading-next]'));
  const next=await p.locator('[data-reading-id]').getAttribute('data-reading-id');
  check(next!==previous,'Global suggestions do not immediately repeat the current reading');previous=next;
 }
 await press(p.locator('[data-world-close]'),false);
 check(await p.locator('[data-world-reader]').isHidden(),'Back exits the book to the scene');
 await p.goto(url+'#books');await settled(p);
 check(await p.locator('[data-book-topic]').count()===6,'Re-entry starts a clean, complete book');
 check(errors.length===0,'No runtime errors during the full book journey: '+errors.join('; '));
 await p.close();
}
await writeFile(out+'/result.json',JSON.stringify({engine:name,checks,viewports:sizes,captures},null,2));
console.log(name+': '+checks+' reading-book checks passed.');
}catch(error){if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw error;}
finally{await browser.close();}
