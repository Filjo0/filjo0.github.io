import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),engine=process.env.STUDIO_BROWSER||'chromium';
const base=process.env.STUDIO_URL||'http://127.0.0.1:8765/',root=(process.env.DESIGN_READABILITY_ARTIFACT_DIR||'validation-artifacts/design-audit-20oct/d1/checks')+'/'+engine;
const sizes=(process.env.DESIGN_READABILITY_VIEWPORTS||'320x568,1440x900,390x844,844x390').split(',').map(s=>{const [width,height]=s.split('x').map(Number);return{width,height};});
await mkdir(root,{recursive:true});let checks=0,current;const captures=[],failures=[],errors=[],samples=[],check=(x,m)=>{assert.ok(x,m);checks++;};
const browser=await pw[engine].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{a=lum(a);b=lum(b);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
async function sampledPixel(p,point){const data=(await p.screenshot()).toString('base64');return p.evaluate(async({data,point})=>{
 const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const c=canvas.getContext('2d');c.drawImage(image,0,0);const pixels=c.getImageData(Math.round(point.x)-1,Math.round(point.y)-1,3,3).data;
 return [0,1,2].map(k=>Array.from({length:9},(_,i)=>pixels[i*4+k]).sort((a,b)=>a-b)[4]);},{data,point});}
const settled=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
const shot=async(p,size,label)=>{const file=size.width+'x'+size.height+'-'+label+'.png';await p.screenshot({path:root+'/'+file});captures.push(file);};
try{for(const size of sizes){
 const touch=size.width<720||size.height<500,p=await browser.newPage({viewport:size,hasTouch:touch,reducedMotion:'reduce'});current=p;
 p.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status(),page:p.url()});});p.on('pageerror',e=>errors.push({url:p.url(),message:e.message}));
 const press=n=>touch?n.tap():n.click(),go=async id=>{
  if(await p.locator('[data-world-reader]').isVisible())await press(p.locator('[data-world-close]'));
  await press(p.locator('.world-dock [data-world-route="'+id+'"]'));await settled(p,id);
 };
 console.log(engine+': Design readability '+size.width+'x'+size.height);await p.goto(base);await p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true');
 const nav=p.locator('.world-dock > a');
 check(await nav.evaluateAll(ns=>ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=12)),'Primary navigation labels are at least 12px');
 check(await nav.evaluateAll(ns=>ns.every(n=>/system-ui/.test(getComputedStyle(n).fontFamily))),'Navigation uses the loaded system-font stack');
 check(await p.evaluate(()=>CSS.supports('background','color-mix(in srgb, white 90%, transparent)')),'The engine supports the shared translucent colour tokens');
 check(await p.locator('.world-header h1').evaluate(n=>/Georgia/.test(getComputedStyle(n).fontFamily)),'Name shares the paper-heading serif');
 check(await p.locator('.scene-maths').evaluate(n=>getComputedStyle(n).color===getComputedStyle(document.querySelector('.world-dock > [data-world-route="work"]')).color),'Maths has the same inactive colour as the other links');await shot(p,size,'home');
 await p.locator('[data-settings-toggle]').click();
 const segments=p.locator('.scene-settings .settings-segment > :is(a,button)');
 check(await segments.evaluateAll(ns=>ns.every(n=>{const s=getComputedStyle(n);return parseFloat(s.fontSize)===15&&parseFloat(s.borderRadius)===8&&n.getBoundingClientRect().height>=44;})),'Every Settings segment actually uses the shared readable control');
 check(await p.locator('.scene-settings .settings-segment > [aria-current="location"]').evaluate(n=>{const s=getComputedStyle(n);return s.backgroundColor==='rgb(224, 232, 221)'&&s.borderTopColor==='rgb(54, 91, 64)'&&parseFloat(s.borderTopWidth)>=1;}),'The selected Settings segment paints the soft-green fill and visible green boundary');
 await shot(p,size,'settings');await p.keyboard.press('Escape');
 await go('work');for(const date of await p.locator('.workspace-capture-date:visible').all())check(await date.evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=12),'Capture dates remain readable');
 await shot(p,size,'apps');
 await go('experience');const content=p.locator('[data-world-content]'),cue=p.locator('.about-scroll-cue');await cue.waitFor();
 check(await content.evaluate(n=>n.scrollTop===0),'Native navigation opens About at the beginning');
 const r=await cue.boundingBox();check(r.height>=44&&r.width>=44,'The About scroll action is at least 44px');
 check(await cue.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'The visible scroll cue can actually be pressed');
 await shot(p,size,'about-top');await press(cue);await p.waitForFunction(()=>document.querySelector('[data-world-content]').scrollTop>0);
 check(await content.evaluate(n=>n.scrollTop>0),'Pressing the cue scrolls the real content');
 const max=await content.evaluate(n=>Math.ceil(n.scrollHeight/(n.clientHeight*.6))+3);
 for(let i=0;i<max;i++){
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  if(await cue.isHidden())break;
  const before=await content.evaluate(n=>n.scrollTop);await press(cue);
  await p.waitForFunction(before=>{const n=document.querySelector('[data-world-content]');return n.scrollTop>before||document.querySelector('.about-scroll-cue').hidden;},before);
 }
 await p.waitForFunction(()=>!document.querySelector('[data-world-reader]').hasAttribute('data-about-more'));
 check(await cue.isHidden(),'Cue and fade disappear at the actual end');await shot(p,size,'about-bottom');
 await content.hover();await p.mouse.wheel(0,-10000);await cue.waitFor();
 check(await cue.isVisible(),'Native scrolling upward restores the cue');
 await go('contact');check(await p.locator('.about-scroll-cue').count()===0&&!await p.locator('[data-world-reader]').getAttribute('data-about-more'),'Leaving About cleans up its cue and fade');
 check(await p.locator('.phone-footnote').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=12),'Contact footnote is at least 12px');await shot(p,size,'contact');
 await go('fibonacci');
 const notebookOpen=p.locator('.maths-page-nav[data-contents="true"] button[data-maths-next-page]');
 check(await notebookOpen.evaluate(n=>{const s=getComputedStyle(n);return /system-ui/.test(s.fontFamily)&&parseFloat(s.borderRadius)===8&&n.getBoundingClientRect().height>=44;}),'Open notebook is the same legible primary control on desktop and phone');
 await shot(p,size,'maths-contents');
 await press(p.locator('[data-maths-chapter="0"]'));
 const eyebrow=p.locator('.creative-title > span');
 check(await p.locator('[data-maths-next]').evaluate(n=>{const s=getComputedStyle(n);return /system-ui/.test(s.fontFamily)&&parseFloat(s.borderRadius)===8&&n.getBoundingClientRect().height>=44;}),'The main maths action uses the shared control and a native 44px hit area');
 check(await eyebrow.evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=11),'Uppercase notebook eyebrow is at least 11px');
 check(await p.locator('[data-angle-preset="golden"] small').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=12),'Golden chip caption is at least 12px');
 const textSample=await eyebrow.evaluate(n=>{const r=document.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();return{foreground:getComputedStyle(n).color,point:{x:b.right+5,y:b.y+b.height/2}};});
 const textPaper=await sampledPixel(p,textSample.point),textRatio=contrast(rgb(textSample.foreground),textPaper);samples.push({size,kind:'eyebrow',paper:textPaper,foreground:textSample.foreground,ratio:textRatio});
 check(textRatio>=4.5,'Eyebrow contrast on native sampled paper is at least 4.5:1: '+textRatio);await shot(p,size,'sunflower');
 await press(p.locator('[data-maths-contents]'));await press(p.locator('[data-maths-chapter="2"]'));
 check(await p.locator('[data-pascal-row]').count()===5&&await p.locator('[data-pascal-rows]').inputValue()==='5','Pascal starts with five real rows and a matching slider');
 const secondary=p.locator('.maths-quiet'),borderSample=await secondary.evaluate(n=>{const r=n.getBoundingClientRect();return{colour:getComputedStyle(n).borderLeftColor,point:{x:r.x+10,y:r.y+r.height/2}};});
 const borderPaper=await sampledPixel(p,borderSample.point),borderRatio=contrast(rgb(borderSample.colour),borderPaper);samples.push({size,kind:'secondary-border',paper:borderPaper,foreground:borderSample.colour,ratio:borderRatio});
 check(borderRatio>=3,'Secondary boundary contrast on native sampled paper is at least 3:1: '+borderRatio);await shot(p,size,'pascal');
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page scrolls horizontally');
 await p.locator('[data-world-close]').click();
 for(const season of ['coast','winter']){
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-regions] [data-world-route="'+season+'"]').click();
  await p.waitForFunction(season=>{const s=JSON.parse(document.querySelector('canvas').dataset.worldState);return s.region===season&&s.transition.phase==='settled';},season);
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-night]').click();await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1);await p.keyboard.press('Escape');await shot(p,size,season+'-night');
 }
 await go('work');
 // Load the real isolated project demo to trace its resource responses too.
 await press(p.locator('.workspace-app[data-demo-open]'));await p.frameLocator('.tank-frame').locator('[data-start]').waitFor();
 if(await p.locator('[data-demo-close]').isVisible())await press(p.locator('[data-demo-close]'));else await press(p.locator('[data-world-close]'));
 await p.locator('.tank-frame').waitFor({state:'detached'});
 const launch=p.locator('.workspace-app[data-demo-open] .workspace-action');
 check(await launch.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Returning from Treadfront preserves its visible Play demo action');
 await go('experience');
 check(await p.locator('[data-world-content]').evaluate(n=>n.scrollTop===0),'After Treadfront and returning to the scene, About starts at the top');
 check(await p.locator('[data-world-content] .section-heading h2').first().evaluate(n=>{const r=n.getBoundingClientRect(),b=n.closest('[data-world-content]').getBoundingClientRect();return r.top>=b.top-1&&r.bottom<=b.bottom+1;}),'The About opening heading is actually visible after the demo');
 await shot(p,size,'about-after-demo');
 await press(p.locator('[data-world-close]'));
 await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-text]').click();
 const brand=await p.locator('.world-brand').boundingBox();check(brand.width>=44&&brand.height>=44,'Simple-page Return to the scene is at least 44px');await shot(p,size,'simple');
 check(await p.locator('#experience .timeline-entry').count()===5,'All approved experience entries survive simple-page restoration');
 await p.close();
 // A fresh top-level document catches standalone-only resource failures.
 const resume=await browser.newPage({viewport:size});current=resume;resume.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status(),page:resume.url()});});
 await resume.goto(base+'resume.html');await shot(resume,size,'resume-standalone');await resume.close();
 }
 check(!errors.length,'No uncaught page errors: '+JSON.stringify(errors));check(!failures.length,'No HTTP failures across scene, night, previews, demo, simple page and standalone résumé: '+JSON.stringify(failures));
 await writeFile(root+'/results.json',JSON.stringify({engine,checks,sizes,captures,samples,failures,errors},null,2));console.log(engine+': '+checks+' design readability checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:root+'/failure.png'});await writeFile(root+'/failure.json',JSON.stringify({message:e.message,failures,errors,samples},null,2));throw e;}
finally{await browser.close();}
