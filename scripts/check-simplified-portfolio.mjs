import {outlineContrast} from './outline-browser-evidence.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pascalRows} from '../world/maths-patterns.js';
import {integerRange} from './maths-browser-input.mjs';
import {seedPattern} from '../world-state.js';
import {spiralFamilies} from '../world/seed-spirals.js';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765/';
const out=(process.env.SIMPLIFIED_ARTIFACT_DIR||'validation-artifacts/simplification-18oct')+'/'+engine;await mkdir(out,{recursive:true});
const sizes=(process.env.SIMPLIFIED_VIEWPORTS||'1440x900,390x844,320x568,844x390').split(',').map(s=>{
 const [width,height]=s.split('x').map(Number);return {width,height};});
const browser=await pw[engine].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(engine==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(value,message)=>{assert.ok(value,message);checks++;};
const settled=(p,id)=>p.waitForFunction(id=>document.querySelector('[data-world-reader]').dataset.object===id&&
 !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),id);
async function press(p,n,touch){await n.scrollIntoViewIfNeeded();if(touch)await n.tap();else await n.click();}
async function fit(p,label){
 const content=p.locator('[data-world-content]');
 check(await content.evaluate(n=>n.scrollHeight<=n.clientHeight+1&&n.scrollWidth<=n.clientWidth+1),label+': no hidden text or horizontal clipping');
 for(const n of await content.locator('button:visible,a:visible,[data-direct-maths]:visible').all()){
  const r=await n.boundingBox(),b=await content.boundingBox();
  check(r.width>=43&&r.height>=43,label+': usable control size');
  check(r.x>=b.x-1&&r.y>=b.y-1&&r.x+r.width<=b.x+b.width+1&&r.y+r.height<=b.y+b.height+1,label+': control fits the paper');
 }
}
const evidence=[];
try{for(const viewport of sizes){
 console.log(engine+': simplified portfolio '+viewport.width+'x'+viewport.height);
 const touch=viewport.width<960,p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'});current=p;
 const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 await p.goto(url);await p.waitForFunction(()=>document.querySelector('[data-world-render]')?.dataset.sceneReady==='true');
 check((await p.locator('.world-dock > a').allTextContents()).join('|')==='My apps|About|Résumé|Contact|Maths','Five direct, named portfolio links');
 check(await p.locator('[data-world-map]').isHidden(),'No activity catalogue competes with navigation');
 check(await p.locator('.world-dock > .scene-maths').evaluate(n=>getComputedStyle(n).color===getComputedStyle(document.querySelector('.world-dock > [data-world-route="work"]')).color),'All inactive primary links share their colour; only the actual current page is distinguished');
 check(await p.locator('[data-scene-object="ball"],[data-scene-object="surf"],[data-scene-object="skate"],[data-scene-object="plants"]').count()===0,'Retired activities have no scene markers');
 check(await p.locator('a[href="#ball"],a[href="#surf"],a[href="#skate"],a[href="#plants"]').count()===0,'Retired activities have no page links');
 await p.keyboard.press('Tab');check(await p.locator('.skip-link').evaluate(n=>n===document.activeElement),'First Tab reaches Skip to content');
 await p.mouse.move(10,100);await p.locator('[data-world-render]').focus();await p.waitForTimeout(3200);
 for(const item of await outlineContrast(p))check(item.ratio>=7,item.id+': actual native screenshot retains ≥7:1 light/dark silhouette focus contrast');
 await p.screenshot({path:out+'/'+viewport.width+'-coast.png'});
 for(const id of ['ball','surf','skate','plants','swim']){
  await p.evaluate(id=>{location.hash=id;},id);
  await p.waitForFunction(()=>location.hash==='#top'&&document.querySelector('[data-world-reader]').hidden);
  check(await p.locator('[data-game-start],[data-plant-choice]').count()===0,id+': old link safely returns to the scene');
 }
 for(const id of ['experience','resume','contact']){
  await press(p,p.locator('.world-dock [data-world-route="'+id+'"]'),touch);await settled(p,id);
  // The imported résumé is in an open shadow root, excluded from the outer reader's innerText.
  const content=p.locator(id==='resume'?'[data-resume-document] article.page':'[data-world-content]');
  await content.waitFor({state:'visible'});
  check(await content.innerText().then(s=>s.trim().length>30),id+': core content remains readable');
  if(id==='resume')check(await content.locator('h1').innerText()==='Philipp Alimov','The loaded résumé document identifies its owner');
  if(id==='experience')check((await p.locator('[data-world-content]').innerText()).includes('Floreat Athena FC'),'Approved coaching experience remains');
  if(id==='contact')check(await p.locator('a[href="mailto:philalimov.apps@gmail.com"]').isVisible(),'Canonical contact remains reachable');
  await press(p,p.locator('[data-world-close]'),touch);
 }
 await press(p,p.locator('.world-dock [data-world-route="work"]'),touch);await settled(p,'work');
 check(await p.locator('.workspace-card').count()===3,'All three real project cards remain');
 await press(p,p.locator('[data-demo-open]'),touch);
 const game=p.frameLocator('.tank-frame');await game.locator('html[data-connected="true"]').waitFor();
 check(await p.locator('.tank-frame').getAttribute('sandbox')==='allow-scripts','Project demo retains its opaque-origin sandbox');
 check(await game.locator('canvas').evaluate(n=>JSON.parse(n.dataset.gameState).levelId==='outer-wall'),'Only the approved sector opens');
 await press(p,game.locator('[data-start]'),touch);
 check(await game.locator('canvas').evaluate(n=>JSON.parse(n.dataset.gameState).phase==='playing'),'The project demo still starts with native input');
 if(await p.locator('[data-demo-close]').isVisible())await p.locator('[data-demo-close]').click();else await press(p,p.locator('[data-world-close]'),touch);
 await p.locator('.tank-frame').waitFor({state:'detached'});await press(p,p.locator('[data-world-close]'),touch);
 const book=p.locator('[data-scene-object="books"]');await press(p,book,touch);
 await settled(p,'books');
 check(await p.locator('[data-book-topic]').count()===6,'Reading book retains all six topics');
 await press(p,p.locator('[data-world-close]'),touch);
 await press(p,p.locator('.world-dock [data-world-route="fibonacci"]'),touch);await settled(p,'fibonacci');
 await press(p,p.locator('[data-maths-chapter="0"]'),touch);
 const flower=p.locator('[data-seed-art]');
 await press(p,flower,touch);
 check(await p.locator('[data-sunflower-seed]').count()===400,'Direct flower interaction preserves the complete bounded seed geometry');
 for(const [i,family] of spiralFamilies(seedPattern(400)).entries())check(await p.locator('[data-spiral-family="'+i+'"]').count()===family.count,'Both real computed crossing families remain');
 await press(p,p.locator('[data-seed-index="350"]'),touch);
 check(await p.locator('[data-selected-seed]').getAttribute('data-selected-seed')==='350','A native tap selects the actual seed under the pointer');
 check(await p.locator('[data-traced="true"]').count()===2,'Exactly one arm in each family crosses the selected seed');
 await flower.focus();await p.keyboard.press('ArrowRight');
 check(await p.locator('[data-selected-seed]').getAttribute('data-selected-seed')==='351','Keyboard arrows also choose the next seed');
 await fit(p,'Sunflower');await p.screenshot({path:out+'/'+viewport.width+'-sunflower.png'});
 await press(p,p.locator('[data-maths-next-page]'),touch);
 await press(p,p.locator('[data-fibonacci-preview]'),touch);
 check(await p.locator('[data-fibonacci-square]').count()===2,'Tapping the outline places the next actual square');
 const sequence=p.locator('[data-fibonacci-art]');await sequence.focus();await p.keyboard.press('Enter');
 check(await p.locator('[data-fibonacci-square]').count()===3,'Keyboard Enter places the next square');
 for(let i=3;i<12;i++)await press(p,p.locator('[data-fibonacci-preview]'),touch);
 check(await p.locator('[data-fibonacci-ratio]').innerText()==='144 ÷ 89 = 1.61798','Direct construction reaches the exact ratio');
 await press(p,p.locator('[data-fibonacci-square="8"]'),touch);
 check(await p.locator('[data-sequence-caption]').innerText().then(s=>s.includes('13 + 21 = 34')),'Selecting a filled square explains its actual side length');
 await fit(p,'Fibonacci');await p.screenshot({path:out+'/'+viewport.width+'-sequence.png'});
 await press(p,p.locator('[data-maths-next-page]'),touch);
 await integerRange(p,'[data-pascal-rows]',8);
 await press(p,p.locator('[data-pascal-cell="6:3"]'),touch);
 check(await p.locator('[data-pascal-equation]').innerText()==='10 + 10 = 20','A selected Pascal cell reveals its two real parents');
 check(await p.locator('[data-selected-cell]').count()===3,'The selected cell and both parents are outlined');
 await press(p,p.locator('[data-pascal-next]'),touch);
 check(await p.locator('[data-pascal-row]').count()===32,'Odd-number reveal retains the 32-row fractal');
 await press(p,p.locator('[data-pascal-cell="31:15"]'),touch);
 check(await p.locator('[data-pascal-equation]').innerText()===pascalRows(32)[31][15]+' is odd.','Tapping the fractal inspects the actual integer parity');
 await fit(p,'Pascal');await p.screenshot({path:out+'/'+viewport.width+'-pascal.png'});
 await press(p,p.locator('[data-world-close]'),touch);
 await press(p,p.locator('[data-settings-toggle]'),touch);await press(p,p.locator('[data-world-night]'),touch);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).lighting.blend===1);await p.keyboard.press('Escape');
 for(const item of await outlineContrast(p))check(item.ratio>=7,item.id+': marker remains distinct at night');
 await p.screenshot({path:out+'/'+viewport.width+'-night.png'});
 check(!requests.some(u=>u.includes('/assets/games/')||u.endsWith('/stations/garden.js')||u.endsWith('/device-juggling.js')||u.endsWith('/device-sports.js')),'Removed games and planting do not download their UI or artwork');
 check(errors.length===0,'No runtime errors: '+errors.join('; '));
 evidence.push({viewport,errors,requests:requests.length});await p.close();
}
 await writeFile(out+'/checks.json',JSON.stringify({engine,checks,evidence},null,2));
 console.log(engine+': '+checks+' simplified-portfolio checks passed.');
}catch(error){if(current&&!current.isClosed())await current.screenshot({path:out+'/failure.png'});throw error;}finally{await browser.close();}
