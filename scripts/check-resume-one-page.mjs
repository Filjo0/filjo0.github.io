import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resumeFacts,approvedResumeFacts,canonicalFacts} from './resume-content-evidence.mjs';
import {readingSurfaceEdges} from './reading-surface-evidence.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const base=process.env.STUDIO_URL||'http://127.0.0.1:8765/',out=(process.env.RESUME_ARTIFACT_DIR||'validation-artifacts/straight-and-simple-24oct/stage-c')+'/'+engine;
const approved=JSON.parse(await readFile(new URL('./fixtures/resume-approved.json',import.meta.url),'utf8'));
const expected=canonicalFacts(approvedResumeFacts(approved));
await mkdir(out,{recursive:true});const samples=[];let checks=0,current;
const check=(ok,message)=>{assert.ok(ok,message);checks++;};
const browser=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  const p=await browser.newPage({viewport,reducedMotion:'reduce',hasTouch:viewport.width<850});current=p;
  const errors=[],failures=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
  await p.addInitScript(()=>{window.printCalls=0;window.print=()=>window.printCalls++;});
  await p.goto(base+'resume.html');await p.evaluate(()=>document.fonts.ready);
  check(await p.locator('a[download],a[href*="Philipp_Alimov_Resume.pdf"]').count()===0,'No PDF download is offered');
  await p.locator('[data-print-resume]').click();
  check(await p.evaluate(()=>window.printCalls)===1,'Print invokes the browser print command');
  check(await p.locator('[contenteditable="true"],input,textarea').count()===0,'The résumé is a read-only document');
  check(await p.locator('article.page').count()===1,'Standalone has one logical résumé article');
  assert.deepEqual(canonicalFacts(await resumeFacts(p.locator('article.page'))),expected,'Every approved word, role, date, skill, degree, language and link is retained');checks++;
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Standalone has no sideways scrolling');
  check(await p.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(245, 242, 233)'),'Standalone uses the site ivory');
  for(const n of await p.locator('.resume-toolbar :is(a,button)').all())check(await n.evaluate(n=>{const r=n.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth+1;}),'Toolbar actions remain visible and touch-sized');
  await p.screenshot({path:out+'/'+viewport.width+'x'+viewport.height+'-standalone.png',fullPage:true});
  await p.emulateMedia({media:'print'});
  const print=await p.locator('article.page').evaluate(n=>{
   const paper=n.getBoundingClientRect(),walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT),outside=[];
   while(walker.nextNode()){
    if(!walker.currentNode.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(walker.currentNode);
    for(const r of range.getClientRects())if(r.width&&r.height&&(r.left<paper.left-1||r.right>paper.right+1||r.top<paper.top-1||r.bottom>paper.bottom+1))outside.push(walker.currentNode.textContent.trim());
   }
   return {paper:paper.toJSON(),outside,fonts:[...n.querySelectorAll('p,li,address')].map(e=>Number.parseFloat(getComputedStyle(e).fontSize)),
    heading:getComputedStyle(n.querySelector('h1')).fontFamily,header:getComputedStyle(n.querySelector('.masthead')).backgroundColor};
  });
  check(Math.abs(print.paper.width-210*96/25.4)<1&&Math.abs(print.paper.height-297*96/25.4)<1,'Print geometry is exactly one A4 page');
  check(print.outside.length===0,'No text extends beyond the A4 page: '+print.outside.join('; '));
  check(Math.min(...print.fonts)>=12,'Print text is at least 9pt, without a scale transform');
  check(print.heading.includes('Georgia')&&print.header==='rgb(37, 53, 45)','Print shares the site typography and deep green');
  check(await p.locator('.resume-toolbar').isHidden(),'Toolbar never prints');
  check(await p.locator('[aria-labelledby="education-heading"] br').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).display!=='none')),'Education retains its intentional line breaks in print');
  check(await p.locator('[aria-labelledby="education-heading"] strong').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).display==='block')),'Each degree starts on its own print line');
  if(engine==='chromium'&&viewport.width===1440){
    const pdf=await p.pdf({path:out+'/browser-print.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
    check(pdf.subarray(0,5).toString()==='%PDF-'&&pdf.subarray(-1024).includes(Buffer.from('%%EOF')),'Browser printing generates a complete document');
    check([...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length===1,'Actual browser output is one page');
    await p.setViewportSize({width:794,height:1123});await p.screenshot({path:out+'/print-layout.png',fullPage:true});await p.setViewportSize(viewport);
  }
  samples.push({viewport,kind:'print',...print});await p.emulateMedia({media:'screen'});
  await p.goto(base+'#resume');await p.waitForFunction(()=>document.querySelector('[data-world-reader]')?.dataset.object==='resume'&&!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  check(await p.locator('.world-resume-actions a[download]').count()===0,'Clipboard has no PDF download');
  const printable=p.getByRole('link',{name:'Read or print résumé ↗',exact:true});
  const [standalone]=await Promise.all([p.waitForEvent('popup'),printable.click()]);
  await standalone.waitForLoadState();
  check(new URL(standalone.url()).pathname.endsWith('/resume.html')&&await standalone.locator('[data-print-resume]').isVisible(),'Clipboard link opens the readable page with Print');
  await standalone.close();
  const host=p.locator('[data-resume-document]');await host.locator('h1').waitFor();await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.deepEqual(canonicalFacts(await resumeFacts(host)),expected,'Clipboard imports exactly the same approved document');checks++;
  check(await host.locator('article.page').count()===1,'Clipboard has the same single logical page');
  check(await host.locator('.contact .separator').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).display==='none')),'Clipboard contact has no visible hanging separators');
  check(await host.locator('.contact :is(a,.contact-item)').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect(),h=n.closest('.masthead').getBoundingClientRect();return getComputedStyle(n).whiteSpace==='nowrap'&&r.left>=h.left-1&&r.right<=h.right+1;})),'Contact items wrap only between intact facts and stay inside the header');
  check(await p.locator('[data-resume-pager]').count()===0,'Clipboard has no page switches');
  const edges=await readingSurfaceEdges(p.locator('[data-world-reader]'));check(edges.maxDeviation<=1,'Actual clipboard reading surface is square to the screen');
  await p.screenshot({path:out+'/'+viewport.width+'x'+viewport.height+'-clipboard.png'});
  const root=p.locator('[data-world-content]'),last=host.locator('.language-list li').last();await last.scrollIntoViewIfNeeded();
  const a=await last.boundingBox(),r=await root.boundingBox();check(a.y>=r.y-1&&a.y+a.height<=r.y+r.height+1,'Languages at the end remain reachable');
  const owners=await root.evaluate(n=>[n,...n.querySelectorAll('*'),...n.querySelector('[data-resume-document]').shadowRoot.querySelectorAll('*')].filter(e=>e.clientHeight&&e.scrollHeight>e.clientHeight+1&&/auto|scroll/.test(getComputedStyle(e).overflowY)).map(e=>e===n?'outer':e.tagName));
  assert.deepEqual(owners,['outer'],'Only the outer clipboard scrolls');checks++;
  await p.screenshot({path:out+'/'+viewport.width+'x'+viewport.height+'-clipboard-end.png'});
  await p.keyboard.press('Escape');check(await p.locator('[data-world-reader]').isHidden(),'Escape returns to the scene');
  check(errors.length===0&&failures.length===0,'No runtime errors or failed requests: '+errors.concat(failures).join('; '));
  samples.push({viewport,kind:'clipboard',edges,owners});await p.close();
 }
 console.log(engine+': '+checks+' read-only résumé and browser-print checks passed.');
}finally{await writeFile(out+'/resume-evidence.json',JSON.stringify({checks,samples},null,2));await browser.close();}
