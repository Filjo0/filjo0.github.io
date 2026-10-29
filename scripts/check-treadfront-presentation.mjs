import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {WORLD} from '../demo/treadfront/core.js';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const art='validation-artifacts/presentation-recheck3-implementation/'+name;await mkdir(art,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(v,m)=>{assert.ok(v,m);checks++;};
async function activate(p,locator,touch){
 if(touch){const r=await locator.boundingBox();assert.ok(r,'Native touch target exists');
  await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
 }else await locator.click();
}
async function alignment(p){return p.locator('[data-world-reader]').evaluate(n=>{
 const expected=JSON.parse(n.dataset.surfaceCorners),host=document.querySelector('[data-world-render]').getBoundingClientRect();
 return Math.max(...[[0,0],[1,0],[1,1],[0,1]].map(([x,y],i)=>{
  const marker=document.createElement('i');marker.style.cssText=`position:absolute;left:${x*100}%;top:${y*100}%;width:0;height:0`;
  n.append(marker);const r=marker.getBoundingClientRect();marker.remove();
  return Math.hypot(r.x-host.x-expected[i].x,r.y-host.y-expected[i].y);
 }));
});}
try{for(const viewport of [{width:390,height:844},{width:1440,height:900},{width:320,height:844},{width:844,height:390}]){
 const full=viewport.width<720||viewport.height<500,touch=full;
 const p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'}),errors=[];current=p;
 let accessProbe=false;const probeErrors=[];
 p.on('pageerror',e=>(accessProbe?probeErrors:errors).push(e.message));console.log(name+': Treadfront '+viewport.width+'px');
 await p.goto(url+'/#work');
 await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='work'&&
  !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 const launch=p.locator('.workspace-app[data-demo-open]');await launch.locator('..').scrollIntoViewIfNeeded();
 const scroll=await p.locator('[data-world-content]').evaluate(n=>n.scrollTop);
 const appsFullscreen=await p.locator('[data-world-reader]').getAttribute('data-fullscreen');
 await activate(p,launch,touch);
 const iframe=p.locator('.tank-frame'),game=p.frameLocator('.tank-frame'),canvas=game.locator('canvas');
 await game.locator('html[data-embedded="true"][data-connected="true"]').waitFor();
 await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.fullscreen===
  String(innerWidth<720||innerHeight<500));
 await game.locator('html').evaluate((n,expected)=>new Promise(resolve=>{
  const poll=()=>n.dataset.handheld===String(expected)?resolve():setTimeout(poll,10);poll();
 }),full);
 check(await iframe.getAttribute('sandbox')==='allow-scripts','Sandbox remains opaque-origin and script-only');
 // WebKit reports its sandbox refusal even when this deliberate read is caught.
 // Account for that negative probe only; all visitor-workflow errors still fail.
 accessProbe=true;
 const opaque=await iframe.evaluate(n=>{try{return n.contentDocument===null;}catch{return true;}});
 await p.waitForTimeout(50);accessProbe=false;
 check(opaque,'The parent cannot read the game document');
 check(probeErrors.every(e=>e.startsWith('Blocked a frame at')&&
  e.includes('sandboxed and lacks the "allow-same-origin" flag')),'Only the deliberate blocked read is reported by the isolation probe');
 check(await alignment(p)<1,'The actual fullscreen/laptop mesh and DOM align within 1px');
 const view=await iframe.boundingBox(),reader=await p.locator('[data-world-reader]').boundingBox();
 if(full){
  check(Math.abs(reader.x)<1&&Math.abs(reader.y-64)<1&&reader.width>=viewport.width-1,
   'The physical game surface starts below Back and fills the phone width');
  check(Math.abs(reader.height-(viewport.height-64))<1&&view.x<1&&view.width>=viewport.width-1&&
   view.y>=64&&view.y+view.height<=viewport.height+1,'The full game frame fits the remaining viewport');
  check(await p.locator('[data-world-close]').innerText()==='← Apps'&&await p.locator('[data-demo-close]').isHidden(),
   'There is one visible Back to apps action');
  const intro=await game.locator('.start p').innerText();
  check(/Hold the arrows/.test(intro)&&!/WASD|Space|keyboard/.test(intro),'The single introduction uses touch wording');
  check(await game.locator('[data-status]').evaluate(n=>{
   const s=getComputedStyle(n);return s.position==='absolute'&&s.clipPath==='inset(50%)'&&n.getBoundingClientRect().height<=1;
  }),'No repeated instructions take space above the board');
  check(await game.locator('[data-fire]').innerText()==='Fire'&&await game.locator('[data-mine]').innerText()==='Place mine',
   'Touch actions carry no keyboard-only shortcuts');
 }else check(reader.width<viewport.width-100&&await p.locator('[data-demo-close]').isVisible(),
  'Desktop keeps the demo on the existing photographed laptop');
 const state=()=>canvas.evaluate(n=>JSON.parse(n.dataset.gameState));
 check((await state()).phase==='ready'&&(await state()).levelId==='outer-wall','Only the approved sector is ready');
 await p.screenshot({path:art+'/'+viewport.width+'-treadfront-open.png'});
 await activate(p,game.locator('[data-start]'),touch);
 await game.locator('.start').waitFor({state:'hidden'});
 const initial=await state();check(initial.phase==='playing','Start opens the actual approved battle');
 const screen=await canvas.boundingBox(),board=(await state()).board;
 const visibleWidth=board.width*screen.width/(await canvas.evaluate(n=>n.clientWidth));
 const area=await canvas.evaluate(n=>({width:n.clientWidth,height:n.clientHeight}));
 const mapWidth=board.rotated?WORLD.height:WORLD.width,mapHeight=board.rotated?WORLD.width:WORLD.height;
 const fit=Math.min(area.width/mapWidth,area.height/mapHeight);
 check(Math.abs(board.width-mapWidth*fit)<1&&Math.abs(board.height-mapHeight*fit)<1,
  'The entire painted sector fills the available height/width without stretching or clipping');
 if(viewport.width<720)check(visibleWidth>=240,'The actual portrait board is much larger than the former 80px');
 else check(visibleWidth>=120,'The full board has useful space in desktop/landscape');
 for(const action of ['[data-fire]','[data-mine]','[data-direction="right"]','[data-ammo="he"]']){
  const r=await game.locator(action).boundingBox();
  check(r.width>=43&&r.height>=43&&r.x>=view.x-1&&r.y>=view.y&&
   r.x+r.width<=view.x+view.width+1&&r.y+r.height<=viewport.height+1,'A usable tank action stays in the visible frame');
  if(full)check(r.y>=screen.y+screen.height-1,'Phone actions stay below the battlefield');
 }
 await activate(p,game.locator('[data-ammo="he"]'),touch);
 check((await state()).ammo==='he','A native tap selects HE');
 const right=await game.locator('[data-direction="right"]').boundingBox();
 await p.mouse.move(right.x+right.width/2,right.y+right.height/2);await p.mouse.down();await p.waitForTimeout(350);await p.mouse.up();
 check((await state()).playerScreen.x>initial.playerScreen.x+3,'A real held Right moves the painted tank right in either orientation');
 const painted=await canvas.evaluate((n,worldWidth)=>{
  const s=JSON.parse(n.dataset.gameState),c=n.getContext('2d'),ratio=n.width/n.clientWidth;
  const scale=s.board.width/(s.board.rotated?worldWidth.height:worldWidth.width),x=s.playerScreen.x,y=s.playerScreen.y;
  const r=Math.max(3,Math.round(22*scale*ratio)),left=Math.max(0,Math.round(x*ratio)-r),top=Math.max(0,Math.round(y*ratio)-r);
  const pixels=c.getImageData(left,top,Math.min(r*2,n.width-left),Math.min(r*2,n.height-top)).data;
  let hull=0;for(let i=0;i<pixels.length;i+=4)
   if(Math.abs(pixels[i]-194)<3&&Math.abs(pixels[i+1]-208)<3&&Math.abs(pixels[i+2]-165)<3)hull++;
  return hull;
 },WORLD);check(painted>2,'The moved tank is painted at its actual position');
 const shots=(await state()).shotsFired,fireButton=await game.locator('[data-fire]').boundingBox();
 await p.mouse.move(fireButton.x+fireButton.width/2,fireButton.y+fireButton.height/2);
 await p.mouse.down();await p.waitForTimeout(400);await p.mouse.up();
 check((await state()).shotsFired>shots,'Holding Fire launches real shots from the approved combat core');
 await p.screenshot({path:art+'/'+viewport.width+'-treadfront-playing.png'});
 await activate(p,p.locator('[data-demo-pause]'),touch);
 await game.locator('[data-pause][aria-pressed="true"]').waitFor({state:'attached'});
 const frozen=await state();await p.waitForTimeout(180);
 check(frozen.paused&&(await state()).elapsedMs===frozen.elapsedMs,'The checked control port pauses the real game');
 await activate(p,p.locator('[data-demo-pause]'),touch);
 if(viewport.width===390||viewport.width===1440){
  await game.locator('[data-start]').waitFor({state:'visible',timeout:120000});
  check((await state()).phase!=='playing'&&await game.locator('.start').isVisible(),'An unattended sector reaches a visible real result');
  await p.screenshot({path:art+'/'+viewport.width+'-treadfront-result.png'});
  await activate(p,game.locator('[data-start]'),touch);check((await state()).phase==='playing','Retry starts the same sector');
 }
 if(full)await activate(p,p.locator('[data-world-close]'),touch);
 else await p.locator('[data-demo-close]').click();
 check(await iframe.count()===0&&await p.locator('.workspace-launcher').isVisible(),'Back disposes the game and restores the app list');
 check(await p.locator('[data-world-reader]').getAttribute('data-fullscreen')===appsFullscreen&&await alignment(p)<1,
  'The same desktop or compact Apps reading plane is restored within 1px');
 check(Math.abs(await p.locator('[data-world-content]').evaluate(n=>n.scrollTop)-scroll)<2,
  'Back restores the scrolled app card');
 await p.screenshot({path:art+'/'+viewport.width+'-apps-restored.png'});
 await activate(p,launch,touch);await game.locator('html[data-connected="true"]').waitFor();
 await game.locator('[data-start]').focus();await p.keyboard.press('Escape');
 await iframe.waitFor({state:'detached'});
 check(await p.locator('.workspace-launcher').isVisible(),'Escape inside the isolated frame returns to apps');
 check(errors.length===0,'No runtime errors: '+errors.join('; '));await p.close();
}console.log(name+': '+checks+' Treadfront presentation checks passed.');
}catch(error){if(current&&!current.isClosed())await current.screenshot({path:art+'/failure.png'});throw error;
}finally{await browser.close();}
