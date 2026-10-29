import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),name=process.env.STUDIO_BROWSER||'chromium';
const url=process.env.STUDIO_URL||'http://127.0.0.1:8765/',out=(process.env.JUGGLING_ARTIFACTS||'validation-artifacts/redesign-15oct/stage5-juggling-review')+'/'+name;
await mkdir(out,{recursive:true});
const browser=await pw[name].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?
 {executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const sizes=(process.env.JUGGLING_VIEWPORTS||'1440x900,1280x640,390x844,320x568,844x390').split(',').map(s=>{
 const [width,height]=s.split('x').map(Number);return {width,height};});
const suites=new Set((process.env.JUGGLING_CHECKS||'layout,assets,lifecycle').split(','));
let checks=0,current;
function diagnose(p){
 p.on('console',async m=>{if(m.text().includes('[portfolio:fallback]'))
  console.error('FALLBACK',m.text(),await m.args()[1]?.jsonValue());});
 p.on('requestfailed',r=>console.error('REQUEST_FAILED',r.url(),r.failure()?.errorText));
}const captures=[],captureStates={},check=(v,m)=>{assert.ok(v,m);checks++;};
const state=p=>p.locator('[data-juggle-canvas]').evaluate(n=>JSON.parse(n.dataset.juggleState));
async function open(p){
 await p.waitForFunction(()=>document.querySelector('[data-world-reader]')?.dataset.object==='ball'&&
  document.querySelector('[data-world-content]')?.dataset.artState==='ready'&&
  !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
}
async function press(p,selector,touch){
 const n=p.locator(selector);await n.waitFor({state:'visible'});
 const r=await n.boundingBox();assert.ok(r,'Visible native input target: '+selector);
 if(touch)await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
 else await p.mouse.click(r.x+r.width/2,r.y+r.height/2);
}
async function capture(p,size,label){
 const file=size.width+'x'+size.height+'-'+label+'.png';
 captureStates[file]={before:await state(p)};await p.screenshot({path:out+'/'+file});
 captureStates[file].after=await state(p);captures.push(file);
}
async function fit(p,size){
 const reader=p.locator('[data-world-reader]'),r=await reader.boundingBox(),canvas=await p.locator('[data-juggle-canvas]').boundingBox();
 check(Math.abs(r.x)<1&&Math.abs(r.y-64)<1&&Math.abs(r.width-size.width)<1&&Math.abs(r.height-(size.height-64))<1,
  'The real sports surface fills the viewport below Back at '+size.width);
 check(Math.abs(canvas.x)<1&&Math.abs(canvas.y-64)<1&&Math.abs(canvas.width-size.width)<1&&
  Math.abs(canvas.height-(size.height-64))<1,'The court itself fills the complete surface without HUD bands');
 check(await reader.evaluate(n=>{const host=document.querySelector('[data-world-render]').getBoundingClientRect();
  const corners=JSON.parse(n.dataset.surfaceCorners);
  return [[0,0],[1,0],[1,1],[0,1]].every(([x,y],i)=>{const marker=document.createElement('i');
   marker.style.cssText='position:absolute;left:'+x*100+'%;top:'+y*100+'%;width:0;height:0';n.append(marker);
   const q=marker.getBoundingClientRect();marker.remove();return Math.hypot(q.x-host.x-corners[i].x,q.y-host.y-corners[i].y)<1;});
 }),'Actual mesh corners agree with the HTML within 1px');
 check(await p.locator('[data-world-content]').evaluate(n=>n.scrollHeight<=n.clientHeight+1&&n.scrollWidth<=n.clientWidth+1),
  'No clipping or nested scrolling');
 const field=await state(p);
 for(const b of await p.locator('.juggling-controls button:visible').all()){
  const q=await b.boundingBox();check(q.width>=44&&q.height>=44,'Every touch control is at least 44px');
  check(q.x>=0&&q.x+q.width<=size.width+1&&q.y>=canvas.y+field.ground+field.ball.radius&&q.y+q.height<=size.height,
   'Overlay controls fit in the court margin below the ball and feet');
 }
 const visibleAnchors=await p.locator('[data-juggle-canvas]').evaluate(async n=>{
  const {loadJugglingArt}=await import(new URL('world/juggling-art.js',document.baseURI));
  const art=await loadJugglingArt(),s=JSON.parse(n.dataset.juggleState),f=art.data.clips[s.sprite.clip][s.sprite.frame];
  const tile=document.createElement('canvas');tile.width=7;tile.height=7;const c=tile.getContext('2d');
  return ['toe','plant'].every(key=>{
   c.clearRect(0,0,7,7);c.drawImage(art.player,f.rect[0]+f[key][0]-3,f.rect[1]+f[key][1]-3,7,7,0,0,7,7);
   return [...c.getImageData(0,0,7,7).data].some((v,i)=>i%4===3&&v>180);
  });
 });check(visibleAnchors,'Toe and standing-foot markers touch actual rendered footwear pixels');
 const s=await state(p);check(s.player.left>=-1&&s.player.top>=-1&&s.player.right<=canvas.width+1&&s.player.bottom<=canvas.height+1,
  'The actual rendered human stays on the court');
 check(s.artReady&&s.sprite&&s.player.bottom-s.player.top>canvas.height*.4,'A substantial rendered human replaces the floating leg');
 for(const selector of ['[data-juggle-instructions]','[data-juggle-result]']){
  const message=p.locator(selector);
  if(await message.isVisible()){
   const q=await message.boundingBox();
   check(q.y+q.height<=canvas.y+s.player.top+1,'Instructions and results stay above the rendered player’s head');
  }
 }
 const painted=await p.locator('[data-juggle-canvas]').evaluate(n=>{
  const s=JSON.parse(n.dataset.juggleState),ratio=n.width/n.clientWidth,c=n.getContext('2d');
  // Sample the backdrop outside the actual moving human and ball; a fixed point may hit a boot.
  const points=[[.04,.2],[.96,.2],[.04,.94],[.96,.94]].map(([x,y])=>[x*n.clientWidth,y*n.clientHeight]);
  const colours=points.filter(([x,y])=>!(x>=s.player.left&&x<=s.player.right&&y>=s.player.top&&y<=s.player.bottom)&&
   Math.hypot(x-s.ball.x,y-s.ball.y)>s.ball.radius*2).map(([x,y])=>c.getImageData(Math.round(x*ratio),Math.round(y*ratio),1,1).data);
  const difference=Math.max(...colours.flatMap(a=>colours.map(b=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]))));
  const ball=c.getImageData(Math.round(s.ball.x*ratio),Math.round(s.ball.y*ratio),1,1).data;
  return {difference,ball:[...ball],backgroundSamples:colours.length};
 });
 check(painted.backgroundSamples>=2&&painted.difference>40&&painted.ball[3]===255,'The actual canvas paints the textured court and opaque ball');
}
try{
 if(suites.has('layout')){
 const overview=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});current=overview;diagnose(overview);
 const requests=[];overview.on('request',r=>requests.push(r.url()));
 await overview.goto(url);await overview.waitForFunction(()=>document.body.dataset.worldReady==='true');
 check(!requests.some(u=>u.includes('/assets/games/')),'Sports artwork is not fetched by the homepage');
 await overview.goto(url+'#swim');await overview.waitForFunction(()=>document.body.dataset.worldReady==='true'&&location.hash==='#top');
 check(await overview.locator('[data-world-route="swim"]').count()===0,'The retired swimming route redirects and has no menu/marker');
 await overview.locator('.world-dock [data-world-route="work"]').click();
 await overview.locator('[data-preview="aqua"]').waitFor();
 check(await overview.locator('[data-preview="aqua"]').isVisible(),'Aqua Local remains in My apps');await overview.close();
 for(const size of sizes){
  const touch=size.width<720,p=await browser.newPage({viewport:size,hasTouch:touch,reducedMotion:'reduce'});current=p;diagnose(p);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  console.log(name+': rendered juggling '+size.width+'x'+size.height);
  await p.goto(url+'#ball');await open(p);await fit(p,size);await capture(p,size,'ready');
  await press(p,'[data-game-start]',touch);await fit(p,size);
  await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).phase==='playing');
  check(await p.locator('[data-juggle-instructions]').isHidden(),'The countdown and instructions leave during play');
  const target=await p.locator('[data-game-kick]').boundingBox(),point={x:target.x+target.width/2,y:target.y+target.height/2};
  for(let score=1;score<=6;score++){
   // Follow the drifting ball during flight, using native steering rather than a stale post-kick position.
   const deadline=Date.now()+3500;
   while(true){
    const s=await state(p);
    check(s.phase==='playing','The ball remains in play while following its drift');
    if(s.canKick)break;
    if(Date.now()>deadline)throw Error('No valid kick window after native steering');
    const delta=s.ball.x-(s.ring.x-s.ball.radius*.5);
    if(Math.abs(delta)>s.ball.radius*1.8)await press(p,'[data-juggle-nudge="'+(delta>0?'1':'-1')+'"]',touch);
    else await p.waitForFunction(()=>{
     const q=JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState);
     return q.phase!=='playing'||q.canKick||Math.abs(q.ball.x-(q.ring.x-q.ball.radius*.5))>q.ball.radius*1.8;
    },null,{polling:'raf',timeout:3500});
   }
   if(touch)await p.touchscreen.tap(point.x,point.y);else await p.mouse.click(point.x,point.y);
   check((await state(p)).score===score,'Native '+(touch?'touch':'mouse')+' scores '+score+' keep-ups');
   const impact=await p.locator('[data-juggle-canvas]').evaluate(n=>JSON.parse(n.dataset.juggleImpact));
   check(Math.hypot(impact.toe.x-impact.ball.x,impact.toe.y-impact.ball.y)<impact.ball.radius*2.5,
    'The actual rendered boot reaches the ball on an accepted kick');
   if(score===6){await capture(p,size,'mid-kick');
    check(!captureStates[size.width+'x'+size.height+'-mid-kick.png'].before.paused,'The mid-kick capture is live, not paused');}
  }
  await press(p,'[data-device-pause]',touch);const held=await state(p);await p.waitForTimeout(180);
  check((await state(p)).height===held.height&&held.paused,'Pause freezes the actual ball and human');
  check(held.level>=1,'The challenge progresses beyond level one');await fit(p,size);await capture(p,size,'playing');
  await press(p,'[data-device-pause]',touch);
  await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).phase==='lost');
  check(await p.locator('[data-juggle-result]').isVisible(),'A dropped ball loses with one result banner');
  check(await p.locator('[data-game-start]').innerText()==='Retry','The result has a clear retry action');
  check((await state(p)).sprite.clip==='miss','The rendered player reacts to the drop');
  await fit(p,size);await capture(p,size,'result');const best=(await state(p)).best;
  await press(p,'[data-game-start]',touch);check((await state(p)).score===0&&(await state(p)).best===best,
   'Retry resets the round and preserves best');
  await p.keyboard.press('Escape');check(await p.locator('[data-world-reader]').isHidden(),'Escape returns to the scene');
  check(await p.locator('[data-juggle-canvas]').count()===0,'Exit disposes the game');
  check(errors.length===0,'No page errors: '+errors.join('; '));await p.close();
 }
 await writeFile(out+'/result-layout.json',JSON.stringify({browser:name,checks,captures,captureStates},null,2));
 }
 if(suites.has('assets')){
 // A failed asset is recoverable without affecting the portfolio or starting a hidden game.
 const failed=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});current=failed;diagnose(failed);
 await failed.route('**/assets/games/juggling-player-v2.webp',r=>r.abort());
 await failed.goto(url+'#ball');await failed.waitForFunction(()=>document.querySelector('[data-world-content]').dataset.artState==='failed');
 check(await failed.locator('[data-game-start]').innerText()==='Retry artwork','A broken art load offers a visible retry');
 check((await state(failed)).phase==='ready','Loading failure never starts the game');
 await failed.unroute('**/assets/games/juggling-player-v2.webp');await press(failed,'[data-game-start]',true);await open(failed);
 check((await state(failed)).artReady,'The deliberate artwork retry recovers');await failed.close();
 }
 if(suites.has('lifecycle')){
 const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});current=p;diagnose(p);
 await p.addInitScript(()=>{window.gameFrames=0;const raf=requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>{window.gameFrames++;return raf(cb);};});
 await p.goto(url+'#ball');await open(p);await press(p,'[data-game-start]',false);
 await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).phase==='playing');
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=await state(p);await p.waitForTimeout(180);
 check((await state(p)).height===hidden.height,'Hidden pages freeze the actual ball with no catch-up');
 await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).phase==='lost');
 await p.waitForTimeout(650);const frames=await p.evaluate(()=>window.gameFrames);await p.waitForTimeout(180);
 check(await p.evaluate(()=>window.gameFrames)===frames,'The finite miss animation stops; no idle RAF');
 await p.keyboard.press('Escape');await p.waitForTimeout(400);const exited=await p.evaluate(()=>window.gameFrames);await p.waitForTimeout(180);
 check(await p.evaluate(()=>window.gameFrames)===exited,'Navigation leaves no game animation loop');await p.close();
 }
 await writeFile(out+'/result-'+[...suites].join('-')+'.json',JSON.stringify({browser:name,checks,captures,captureStates},null,2));console.log(name+': '+checks+' rendered juggling checks passed.');
 }catch(error){if(current&&!current.isClosed()){
 console.error('FAILED_PAGE',await current.evaluate(()=>({body:{...document.body.dataset},
  content:document.querySelector('[data-world-content]')?.innerHTML.slice(0,600)})));
 await current.screenshot({path:out+'/failure.png'});}throw error;}
finally{await browser.close();}