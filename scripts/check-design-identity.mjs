import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resumeFacts,approvedResumeFacts,canonicalFacts} from './resume-content-evidence.mjs';
const resumeApproval=JSON.parse(await readFile(new URL('./fixtures/resume-approved.json',import.meta.url),'utf8'));
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const base=process.env.STUDIO_URL||'http://127.0.0.1:8765/',root=(process.env.DESIGN_IDENTITY_ARTIFACT_DIR||'validation-artifacts/design-audit-20oct/d3/checks')+'/'+engine;
const sizes=(process.env.DESIGN_IDENTITY_VIEWPORTS||'1440x900,390x844,320x568,844x390').split(',').map(s=>{const[width,height]=s.split('x').map(Number);return{width,height};});


await mkdir(root,{recursive:true});let checks=0,current;const errors=[],failures=[],samples=[],captures=[],check=(ok,message)=>{assert.ok(ok,message);checks++;};
const browser=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
async function pixel(p,point){const data=(await p.screenshot()).toString('base64');return p.evaluate(async({data,point})=>{const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return [...x.getImageData(Math.round(point.x),Math.round(point.y),1,1).data].slice(0,3);},{data,point});}
const settled=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
const shot=async(p,size,label)=>{const file=size.width+'x'+size.height+'-'+label+'.png';await p.screenshot({path:root+'/'+file});captures.push(file);};
try{for(const size of sizes){
 const touch=size.width<720||size.height<500,p=await browser.newPage({viewport:size,hasTouch:touch,reducedMotion:'reduce'});current=p;
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});
 const press=n=>touch?n.tap():n.click(),go=async id=>{if(await p.locator('[data-world-reader]').isVisible())await press(p.locator('[data-world-close]'));await press(p.locator('.world-dock > [data-world-route="'+id+'"]'));await settled(p,id);};
 const settings=async()=>{await press(p.locator('[data-settings-toggle]'));await p.locator('.scene-settings-body').waitFor();};
 const light=async night=>{await press(p.locator(night?'[data-world-night]':'[data-world-day]'));await p.waitForFunction(night=>{const s=JSON.parse(document.querySelector('canvas').dataset.worldState);return s.lighting.blend===(night?1:0)&&document.body.dataset.worldLight===(night?'night':'sunset');},night);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
 console.log(engine+': D3 identity '+size.width+'x'+size.height);
 await p.goto(base);await p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true');
 const header=p.locator('.world-header');check(await header.evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(245, 242, 233)'),'Initial chrome retains the approved ivory default');
 await settings();await light(true);
 check(await header.evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(28, 36, 32)'),'Night visibly changes the actual header, after artwork loads');
 const paper=await pixel(p,{x:5,y:5}),ink=rgb(await header.evaluate(n=>getComputedStyle(n).color));
 samples.push({size,kind:'night-header',paper,ink,contrast:contrast(ink,paper)});check(contrast(ink,paper)>=4.5,'Night header text contrasts with its painted background');
 const selected=p.locator('.scene-settings .settings-segment > [aria-current="location"]');
 check(await selected.evaluate(n=>{const s=getComputedStyle(n);return s.backgroundColor==='rgb(46, 61, 51)'&&s.color==='rgb(156, 195, 164)';}),'Selected controls use the dark surface and readable mint ink');
 for(const on of [false,true]){
  const toggle=await p.locator('.settings-motion button').getAttribute('aria-checked');
  if(toggle!==String(on))await press(p.locator('.settings-motion button'));
  await p.waitForFunction(on=>document.querySelector('.settings-motion button').getAttribute('aria-checked')===String(on),on);
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const knob=await p.locator('.settings-motion button span').boundingBox(),button=await p.locator('.settings-motion button').boundingBox();
  const a=await pixel(p,{x:knob.x+knob.width/2,y:knob.y+knob.height/2}),b=await pixel(p,{x:button.x+(on?12:37),y:button.y+22});
  samples.push({size,kind:'night-switch-'+on,knob:a,track:b,contrast:contrast(a,b)});check(contrast(a,b)>=3,'The switch knob is visible in both actual painted states');
 }
 await shot(p,size,'night-settings');await p.keyboard.press('Escape');await shot(p,size,'night-home');
 const dock=p.locator('.world-dock'),d=await dock.boundingBox();const dockPaper=await pixel(p,{x:d.x+8,y:d.y+8});
 check(lum(dockPaper)<.12,'Night navigation has a dark painted surface, including the phone tab bar');
 await go('work');
 check(await p.locator('.workspace-action').first().evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(245, 242, 233)'),'Laptop primary action is ivory, not lime');await shot(p,size,'apps');
 await go('fibonacci');await press(p.locator('[data-maths-chapter="0"]'));
 check(await p.locator('.creative-title > span').evaluate(n=>getComputedStyle(n).color==='rgb(78, 92, 76)'),'Night does not turn fixed-paper text into pale night ink');
 const back=p.locator('[data-world-close]');check(await back.evaluate(n=>{const s=getComputedStyle(n);return s.color==='rgb(156, 195, 164)'&&n.getBoundingClientRect().height>=44;}),'Back uses the readable night chrome and keeps its native hit area');await shot(p,size,'night-paper');
 await press(back);await settings();await light(false);await p.keyboard.press('Escape');
 check(await header.evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(245, 242, 233)'),'Sunset restores ivory chrome');
 await settings();await press(p.locator('[data-world-text]'));
 check(await p.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(245, 242, 233)'),'The simple page uses ivory, including after leaving Night');
 const cards=await p.locator('.project-grid > .project').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().toJSON()));
 check(cards.length===3,'All three real projects remain present');
 check(size.width>900?cards.every(c=>Math.abs(c.y-cards[0].y)<1):cards.every(c=>Math.abs(c.x-cards[0].x)<1),'Projects occupy one desktop row or a single mobile column');
 check(await p.locator('.section-education').evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(224, 232, 221)'),'Education uses the shared soft green');
 check(await p.locator('.contact').evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(37, 53, 45)'),'Contact uses deep green, not black');
 for(const selector of ['#work','.section-education','#contact']){await p.locator(selector).evaluate(n=>n.scrollIntoView({block:'start',behavior:'instant'}));check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Simple page remains free of sideways scrolling');}
 await shot(p,size,'simple-contact');await p.close();
 const resume=await browser.newPage({viewport:size});current=resume;resume.on('pageerror',e=>errors.push(e.message));
 await resume.goto(base+'resume.html');await resume.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/resume-chrome.css')));
 check(await resume.locator('.resume-toolbar').evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(245, 242, 233)'),'Standalone toolbar shares the ivory UI without editing its HTML');
 for(const n of await resume.locator('.resume-toolbar :is(a,button)').all())check(await n.evaluate(n=>{const r=n.getBoundingClientRect();return r.height>=44&&r.x>=0&&r.right<=innerWidth+1;}),'Every résumé action remains visible and at least 44px');
 check(await resume.locator('.resume-toolbar [data-print-resume]').evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(54, 91, 64)'),'Print is the primary green action');
 await shot(resume,size,'resume-toolbar');await resume.emulateMedia({media:'print'});
 const print=await resume.locator('.page').evaluateAll(ns=>ns.map(n=>({box:n.getBoundingClientRect().toJSON(),text:n.innerText,fonts:[...n.querySelectorAll('*')].map(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.color,s.lineHeight];})})));
 check(print.length===1&&Math.abs(print[0].box.width-210*96/25.4)<1&&Math.abs(print[0].box.height-297*96/25.4)<1,'Approved Stage C print geometry is exactly one A4 page');
 assert.deepEqual(canonicalFacts(await resumeFacts(resume.locator('.page'))),canonicalFacts(approvedResumeFacts(resumeApproval)),'Printed wording retains every approved Stage C fact');checks++;
 check(await resume.locator('.masthead').evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(37, 53, 45)'),'Approved résumé uses the shared deep green in print');
 check(await resume.locator('.resume-toolbar').isHidden(),'Toolbar styling stays outside print');
 const icon=await resume.request.get(base+'favicon.ico');check(icon.status()===200&&(await icon.body()).readUInt16LE(2)===1,'The formerly missing default favicon is a real ICO returning HTTP 200');await resume.close();
 const plain=await browser.newPage({viewport:size,javaScriptEnabled:false});current=plain;await plain.goto(base);
 check(await plain.locator('#work .project').count()===3&&await plain.locator('#experience .timeline-entry').count()===5,'JavaScript-off visitors retain the complete factual portfolio');
 check(await plain.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor==='rgb(245, 242, 233)'),'JavaScript-off visitors receive the same ivory identity');await shot(plain,size,'javascript-off');await plain.close();
 }
 check(!errors.length,'No runtime errors: '+JSON.stringify(errors));check(!failures.length,'No ordinary HTTP failures: '+JSON.stringify(failures));
 await writeFile(root+'/results.json',JSON.stringify({engine,checks,sizes,samples,captures,errors,failures},null,2));console.log(engine+': '+checks+' D3 identity checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:root+'/failure.png'});await writeFile(root+'/failure.json',JSON.stringify({message:e.message,errors,failures,samples},null,2));throw e;}finally{await browser.close();}
