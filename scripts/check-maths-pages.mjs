import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {integerRange,dragRange,rendered} from './maths-browser-input.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),name=process.env.STUDIO_BROWSER||'chromium';
const url=process.env.STUDIO_URL||'http://127.0.0.1:8765/',out=(process.env.MATHS_PAGES_ARTIFACT_DIR||'validation-artifacts/redesign-15oct/stage4-complete')+'/'+name;
await mkdir(out,{recursive:true});
const sizes=(process.env.MATHS_PAGES_VIEWPORTS||'1440x900,1280x720,390x844,320x568,844x390').split(',')
 .map(s=>{const [width,height]=s.split('x').map(Number);return {width,height};});
const browser=await pw[name].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?
 {executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const captures=[],check=(v,m)=>{assert.ok(v,m);checks++;};
const settled=p=>p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='fibonacci'&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
async function press(p,n,touch){const r=await n.boundingBox();if(touch)await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);else await n.click();}
async function capture(p,size,label){const file=size.width+'x'+size.height+'-'+label+'.png';
 await press(p,p.locator('.creative-title h3'),size.width<960);await rendered(p);await p.screenshot({path:out+'/'+file});captures.push(file);}
async function fit(p,size,label){
 const reader=p.locator('[data-world-reader]'),body=p.locator('[data-world-content]'),r=await reader.boundingBox();
 check(r.x>=-1&&r.y>=63&&r.x+r.width<=size.width+1&&r.y+r.height<=size.height+1,label+': notebook fits');
 check(await body.evaluate(n=>n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1),label+': strict no scrolling or clipped overflow');
 const deltas=await reader.evaluate(n=>{
  const host=document.querySelector('[data-world-render]').getBoundingClientRect(),expected=JSON.parse(n.dataset.surfaceCorners);
  return [[0,0],[1,0],[1,1],[0,1]].map(([x,y],i)=>{const a=document.createElement('span');
   a.style.cssText=`position:absolute;left:${x*100}%;top:${y*100}%;width:0;height:0`;n.append(a);
   const q=a.getBoundingClientRect();a.remove();return Math.hypot(q.x-host.x-expected[i].x,q.y-host.y-expected[i].y);});
 });deltas.forEach(d=>check(d<1,label+': real mesh alignment within 1px'));
 for(const n of await body.locator('button:visible,a:visible,input:visible').all()){
  const q=await n.boundingBox();check(q.height>=44&&q.width>=44,label+': actual 44px control '+await n.textContent());
  check(q.x>=r.x-1&&q.y>=r.y-1&&q.x+q.width<=r.x+r.width+1&&q.y+q.height<=r.y+r.height+1,label+': action stays on paper');
  check(await n.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),
   label+': action is unobstructed');
 }
 const bad=await body.evaluate(root=>{const b=root.getBoundingClientRect(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),bad=[];
  while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||!n.parentElement.checkVisibility())continue;
   const range=document.createRange();range.selectNodeContents(n);
   for(const r of range.getClientRects())if(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)bad.push(n.textContent.trim());}
  return bad;});check(!bad.length,label+': every visible line fits '+bad.join('|'));
 if(size.width>=720&&size.height>500){
  const crossing=await body.evaluate(root=>{const box=root.getBoundingClientRect(),mid=box.left+box.width/2;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),bad=[];
   while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||!n.parentElement.checkVisibility())continue;
    const range=document.createRange();range.selectNodeContents(n);
    for(const q of range.getClientRects())if(q.left<mid+12&&q.right>mid-12)bad.push(n.textContent.trim());}return bad;});
  check(!crossing.length,label+': no words cross the physical spine '+crossing.join('|'));
  check(await body.locator('.maths-page-nav button:visible').evaluateAll(ns=>ns.every(n=>{
   const s=getComputedStyle(n);return parseFloat(s.borderLeftWidth)===0&&parseFloat(s.borderRightWidth)===0;
  })),label+': secondary notebook navigation has no boxes');
 }

 const primary=await body.locator('button:visible').evaluateAll(ns=>ns.filter(n=>getComputedStyle(n).backgroundColor==='rgb(54, 91, 64)').length);
 check(primary===(await body.locator('[data-sequence-page]').count()?0:1),label+': one primary payoff, with the range itself primary on the sequence page');
}
try {
 for(const size of sizes){
  const touch=size.width<960,p=await browser.newPage({viewport:size,hasTouch:touch,reducedMotion:'reduce'});current=p;
  const errors=[];p.on('pageerror',e=>errors.push(e.message));console.log(name+': live maths '+size.width+'x'+size.height);
  await p.goto(url+'/#fibonacci');await settled(p);check(await p.locator('[data-maths-chapter]').count()===3,'Contents has three named chapters');
  await fit(p,size,'contents');await capture(p,size,'contents');await press(p,p.locator('[data-maths-chapter="0"]'),touch);
  await press(p,p.locator('[data-maths-next]'),touch);await fit(p,size,'sunflower lattice');await capture(p,size,'sunflower-lattice');
  await press(p,p.locator('[data-maths-next-page]'),touch);
  check(await p.locator('[data-fibonacci-square]').count()===1,'The Squares slider starts at its actual minimum');
  const expected=[];
  for(let n=1;n<=12;n++){
   await integerRange(p,'[data-sequence-count]',n);expected.push(n<=2?1:expected.at(-1)+expected.at(-2));
   const squares=await p.locator('[data-fibonacci-square]').evaluateAll(ns=>ns.map(n=>{const r=n.querySelector('rect');return {value:Number(n.dataset.squareValue),size:Number(r.getAttribute('width'))};}));
   check(squares.length===n&&squares.every((s,i)=>s.value===expected[i]&&Math.abs(s.size/s.value-squares[0].size)<.001),'Actual squares obey the recurrence at '+n);
   check(await p.locator('[data-fibonacci-numbers]').innerText()===expected.join(' · '),'The complete visible sequence matches the actual squares');
   check(await p.locator('[data-fibonacci-arc]').count()===n,'One actual spiral arc per square');
   if(n>=5){await p.waitForFunction(()=>getComputedStyle(document.querySelector('[data-fibonacci-ratio]')).visibility==='visible');const ratioText=await p.locator('[data-fibonacci-ratio]').innerText(),ratio=(expected.at(-1)/expected.at(-2)).toFixed(5);check(ratioText.trim().endsWith(ratio),'Visible ratio is calculated from the last two drawn squares '+JSON.stringify({n,ratioText,ratio}));}
   check(await p.locator('[data-sequence-page]').getAttribute('data-animating')==='false','Slider changes are immediate, without animation');
   await fit(p,size,'Fibonacci '+n);if(n===5||n===12)await capture(p,size,'fibonacci-'+n);
  }
  check((await p.locator('[data-sequence-caption]').innerText()).includes('golden ratio'),'The final explanatory sentence is retained');
  const dragged=await dragRange(p,'[data-sequence-count]',5,{touch,engine:name});
  check(dragged===5&&await p.locator('[data-fibonacci-square]').count()===5,'Native dragging backwards removes excess squares immediately');
  await press(p,p.locator('[data-fibonacci-square="4"]'),touch);check((await p.locator('[data-sequence-caption]').innerText()).includes('2 + 3 = 5'),'A square still explains its real recurrence');
  await integerRange(p,'[data-sequence-count]',12);await press(p,p.locator('[data-maths-next-page]'),touch);
  check(await p.locator('[data-pascal-caption]').isVisible()&&
   (await p.locator('[data-pascal-caption]').innerText())==='Tap a number to see the two above it.',
   'Pascal explains tapping before any number is selected, on desktop and phones');
  check(await p.locator('[data-pascal-row]').count()===5&&await p.locator('[data-pascal-rows]').inputValue()==='5','Pascal opens with five real rows and the slider in sync');
  for(let n=1;n<=10;n++){
   await integerRange(p,'[data-pascal-rows]',n);
   const rows=await p.locator('[data-pascal-row]').evaluateAll(ns=>ns.map(n=>[...n.querySelectorAll('[data-value]')].map(c=>Number(c.dataset.value))));
   check(rows.length===n,'Rows slider changes the actual row count');
   check(rows.every((row,r)=>row.length===r+1&&row.every((v,c)=>c===0||c===r?v===1:v===rows[r-1][c-1]+rows[r-1][c])),'Every drawn Pascal value comes from its actual two parents');
   check(await p.locator('[data-pascal-cell] text').count()===n*(n+1)/2,'All numeric rows, including the maximum, keep visible labels');
   if(n===1){check(await p.locator('[data-pascal-cell] circle').evaluate(n=>n.getBoundingClientRect().width)<=44,'The initial 1 has a capped cell size');await capture(p,size,'pascal-1');}
   if(n===8&&size.width<360&&size.height>=568&&size.height<=700){
    const drawing=await p.locator('[data-pascal-art]').evaluate(svg=>{const r=svg.getBoundingClientRect(),cells=[...svg.querySelectorAll('circle')].map(n=>n.getBoundingClientRect());return {fraction:(Math.max(...cells.map(c=>c.right))-Math.min(...cells.map(c=>c.left)))/r.width,cellWidth:Math.min(...cells.map(c=>c.width))};});
    check(drawing.fraction>=.8&&drawing.cellWidth>=24,'Eight rows retain the approved broad, tappable small-phone sizing');
   }
   await fit(p,size,'Pascal '+n);
  }
  await integerRange(p,'[data-pascal-rows]',8);await press(p,p.locator('[data-pascal-cell="4:2"] circle'),touch);
  check(await p.locator('[data-pascal-equation]').innerText()==='3 + 3 = 6','A native number tap explains the exact two parents');
  check(await p.locator('[data-selected-cell]').count()===3,'The tapped value and its two parents are circled');
  await capture(p,size,'pascal-8');await press(p,p.locator('[data-pascal-next]'),touch);
  check(await p.locator('[data-pascal-row]').count()===32,'Odd reveal retains all 32 actual rows');
  check((await p.locator('[data-pascal-pattern-rows]').innerText()).includes('32'),'The actual pattern row count is visible');
  check(await p.locator('[data-pascal-rows]').isHidden(),'A 1–10 range never misrepresents the 32-row pattern');
  const odd=await p.locator('[data-pascal-cell]').evaluateAll(ns=>ns.every(n=>(n.querySelector('circle').getAttribute('fill')==='#365b40')===(Number(n.dataset.value)%2===1)));
  check(odd,'Every odd value is coloured and every even value neutral');await fit(p,size,'Odd pattern');await capture(p,size,'pascal-odd');
  await press(p,p.locator('[data-pascal-reveal]'),touch);
  check(await p.locator('[data-pascal-row]').count()===8&&await p.locator('[data-pascal-diagonal]').count()===6,'Diagonal reveal retains the readable eight-row construction');
  const actual=await p.locator('[data-pascal-cell]').evaluateAll(ns=>{const sums=Array(8).fill(0);for(const n of ns){const [r,c]=n.dataset.pascalCell.split(':').map(Number);if(r+c<8)sums[r+c]+=Number(n.dataset.value);}return sums;});
  check(await p.locator('[data-pascal-sums]').innerText()===actual.join(' · '),'Visible totals are sums of the actual triangle cells');
  check(actual.slice(2).every((v,i)=>v===actual[i]+actual[i+1]),'The diagonals really obey Fibonacci recurrence');
  await fit(p,size,'Diagonal totals');await capture(p,size,'pascal-diagonals');
  await press(p,p.locator('[data-maths-previous]'),touch);check(await p.locator('[data-fibonacci-square]').count()===12,'Previous retains the chosen square count');
  await press(p,p.locator('[data-maths-contents]'),touch);await fit(p,size,'return contents');await press(p,p.locator('[data-maths-chapter="2"]'),touch);
  check(await p.locator('[data-pascal-sums]').innerText()===actual.join(' · '),'Contents preserves the completed triangle');
  await press(p,p.locator('[data-pascal-next]'),touch);await integerRange(p,'[data-pascal-rows]',3);
  check(await p.locator('[data-pascal-row]').count()===3&&await p.locator('[data-pascal-diagonal]').count()===0,'Returning to the row range clears the reveal cleanly');
  await p.keyboard.press('Escape');check(await p.locator('[data-world-reader]').isHidden(),'Escape exits the notebook');check(!errors.length,'No runtime errors: '+errors.join('; '));await p.close();
 }
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'no-preference'});current=p;
 await p.addInitScript(()=>{window.mathsFrames=0;const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>{window.mathsFrames++;return raf(cb);};});
 await p.goto(url+'/#fibonacci');await settled(p);await press(p,p.locator('[data-maths-chapter="1"]'),true);
 await integerRange(p,'[data-sequence-count]',5);
 check(await p.locator('[data-fibonacci-arc]').evaluateAll(ns=>ns.every(n=>parseFloat(getComputedStyle(n).strokeDashoffset)===0)),'All slider-driven arcs are complete immediately');
 const artwork=await p.locator('[data-fibonacci-art]').innerHTML();await p.emulateMedia({reducedMotion:'reduce'});
 check(await p.locator('[data-fibonacci-art]').innerHTML()===artwork,'Reduced motion does not change immediate slider geometry');
 await p.waitForTimeout(400);const stable=await p.evaluate(()=>window.mathsFrames);await p.waitForTimeout(180);check(await p.evaluate(()=>window.mathsFrames)===stable,'A slider-driven tiling has no idle RAF');
 await p.emulateMedia({reducedMotion:'no-preference'});await press(p,p.locator('[data-maths-next-page]'),true);await integerRange(p,'[data-pascal-rows]',8);await press(p,p.locator('[data-pascal-next]'),true);
 await p.waitForFunction(()=>document.querySelectorAll('[data-pascal-row]').length>8&&document.querySelectorAll('[data-pascal-row]').length<32);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const rows=await p.locator('[data-pascal-row]').count();await p.waitForTimeout(150);check(await p.locator('[data-pascal-row]').count()===rows,'Hidden pages freeze the finite odd reveal');
 await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>document.querySelector('[data-pascal-page]').dataset.animating==='false');
 check(await p.locator('[data-pascal-row]').count()===32,'Growth resumes to its finite ending');await press(p,p.locator('[data-pascal-reveal]'),true);await p.waitForTimeout(400);
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.querySelector('[data-pascal-page]').dataset.animating==='false');
 check((await p.locator('[data-pascal-sums]').innerText()).endsWith('21'),'A preference change completes the actual diagonal reveal');
 await p.keyboard.press('Escape');await p.waitForTimeout(400);const exited=await p.evaluate(()=>window.mathsFrames);await p.waitForTimeout(180);check(await p.evaluate(()=>window.mathsFrames)===exited,'Exiting leaves no maths animation loop');await p.close();
 await writeFile(out+'/result.json',JSON.stringify({browser:name,checks,viewports:sizes,captures},null,2));console.log(name+': '+checks+' complete maths-page checks passed.');
}catch(e){if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw e;}finally{await browser.close();}
