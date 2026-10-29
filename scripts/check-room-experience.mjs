import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browserName=process.env.STUDIO_BROWSER||'chromium',root=resolve(import.meta.dirname,'..');
const artifacts=resolve(root,'validation-artifacts',browserName,'room-experience');await mkdir(artifacts,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.glb':'model/gltf-binary','.pdf':'application/pdf'};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,`.${path==='/'?'/index.html':path}`);if(!file.startsWith(root+sep))throw Error('Outside project');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
let browser,checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
try{
 browser=await playwright[browserName].launch({headless:true,...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),...(browserName==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.roomFrameRequests=0;const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>{window.roomFrameRequests++;return raf(fn);};});
 const settled=async(route,p=page)=>p.waitForFunction(r=>document.body.dataset.studioReady==='true'&&document.querySelector('[data-studio]').dataset.destination===r&&document.querySelector('[data-studio]').dataset.travelling==='false',route);
 const visit=async(route,p=page)=>{await p.goto(`${url}/validation-artifacts/legacy-studio/studio.html#${route==='overview'?'':route}`);await settled(route,p);};
 const state=()=>page.locator('canvas').evaluate(n=>JSON.parse(n.dataset.roomState));
 const props=()=>page.locator('canvas').evaluate(n=>JSON.parse(n.dataset.objectPositions));
 const open=async(route,p=page)=>{await p.locator('[data-studio-home]').first().click();await settled('overview',p);if(!await p.locator('[data-explore-menu]').evaluate(n=>n.open))await p.locator('[data-explore-menu] summary').click();await p.locator(`[data-explore-menu] [data-studio-route="${route}"]`).click();await settled(route,p);};
 const fit=async(p=page)=>{
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&scrollY===0),'No page overflow');
   check(await p.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.length===new Set(ids).size;}),'IDs stay unique');
   const surface=await p.locator('[data-object-surface]').boundingBox(),v=p.viewportSize();
   if(surface){check(surface.x>=-1&&surface.y>=0&&surface.x+surface.width<=v.width+1&&surface.y+surface.height<=v.height+1,'Projected reading fits');check(await p.locator('[data-reader-body]').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'Reader has no sideways overflow');}
   const actions=await p.locator('[data-room-actions]').boundingBox();if(actions)check(actions.x>=0&&actions.y>=0&&actions.x+actions.width<=v.width+1&&actions.y+actions.height<=v.height+1,'Activity controls fit');
 };
 await visit('overview');await page.waitForFunction(()=>document.querySelector('canvas').dataset.artLiving==='loaded'&&document.querySelector('canvas').dataset.artDesk==='loaded'&&document.querySelector('canvas').dataset.artCorner==='loaded');
 check(await page.locator('[data-room-sound]').getAttribute('aria-pressed')==='false','Room starts silent');
 check((await page.locator('.studio-dock a span').allTextContents()).join('|')==='My apps|About me|Résumé|Contact me','Navigation names visitor intent');
 await page.locator('[data-room-lights]').click();check(!(await state()).lightsOn,'Lights switch enters night');
 await page.screenshot({path:resolve(artifacts,'night-overview.png')});
 await open('books');check(!(await state()).lightsOn&&await page.locator('.reading-page').isVisible(),'Night preserves readable content and survives navigation');
 await page.locator('[data-room-lights]').click();check((await state()).lightsOn,'Lights restore without losing destination');await page.locator('[data-studio-home]').first().click();await settled('overview');
 check(Number(await page.locator('canvas').getAttribute('data-surface-details'))===18,'All authored zones retain their baked surface detail');
 await page.screenshot({path:resolve(artifacts,'overview.png')});
 await open('window');check(await page.locator('[data-object-surface]').isHidden(),'Window uses its physical handle and action controls');
 check(await page.locator('[data-reader-toggle]').isHidden(),'Window has no redundant read toggle');
 await page.locator('[data-room-action="window"]').click();await page.waitForFunction(()=>document.querySelector('[data-room-action="window"]').getAttribute('aria-pressed')==='true');
 check((await state()).windowAngle<-.9,'Window sash physically opens');
 const supportsAudio=await page.evaluate(()=>Boolean(window.AudioContext||window.webkitAudioContext));
 await page.locator('[data-room-sound]').click();
 if(supportsAudio){
   await page.waitForFunction(()=>document.querySelector('[data-room-sound]').getAttribute('aria-pressed')==='true');
   check(await page.locator('[data-room-sound]').getAttribute('aria-pressed')==='true','Sound enabled by an explicit click');
 }else{
   check(await page.locator('[data-room-sound]').isDisabled(),'No-audio browsers get an explicit unavailable state');
   console.log(`${browserName}: AudioContext unavailable in this browser build; verifying the no-audio fallback.`);
 }
 await page.screenshot({path:resolve(artifacts,'window-open.png')});
 await page.locator('[data-room-action="window"]').click();check(Math.abs((await state()).windowAngle)<.001,'Window physically closes');
 if(supportsAudio){await page.locator('[data-room-sound]').click();await page.waitForFunction(()=>document.querySelector('[data-room-sound]').getAttribute('aria-pressed')==='false');check(await page.locator('[data-room-sound]').getAttribute('aria-pressed')==='false','Sound can be muted');}
 else check(await page.locator('[data-room-sound]').getAttribute('aria-pressed')==='false','Unavailable audio stays muted');
 await open('plants');const canHome=(await props()).plants;
 await page.locator('[data-room-action="water"]').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.roomState).plantLeaves===1);
 check(JSON.stringify((await props()).plants)===JSON.stringify(canHome),'Watering returns can home');
 check((await state()).plantLeaves===1&&(await state()).visibleNewLeaves===1,'Watering earns a visible new leaf');
 await open('window');await open('plants');check((await state()).plantLeaves===1,'Plant progress survives room navigation');
 for(let i=0;i<2;i++)await page.locator('[data-room-action="water"]').click();check((await state()).plantLeaves===3&&await page.locator('[data-room-action="water"]').isDisabled(),'Fully grown plant has a bounded cared-for state');
 await open('books');const bookPose=(await props()).books;check(bookPose[1]>.8,'Book is physically picked up');
 await page.locator('[data-book-page="1"]').click();await page.waitForFunction(()=>document.querySelector('.page-number').textContent.startsWith('Page 2 of 3'));
 check(await page.locator('.page-number').textContent()==='Page 2 of 3 · Studio reading','Page turn advances the selected article');
 await page.locator('[data-reading-topic]').selectOption('maths');await page.waitForFunction(()=>document.querySelector('.reading-page').dataset.readingId==='fibonacci'||document.querySelector('.reading-page').dataset.readingId==='golden');
 const firstArticle=await page.locator('.reading-page').getAttribute('data-reading-id');await page.locator('[data-reading-next]').click();await page.waitForFunction(id=>document.querySelector('.reading-page').dataset.readingId!==id,firstArticle);
 check(await page.locator('[data-reading-topic]').inputValue()==='maths','Another reading respects the selected category');check(await page.locator('[data-reading-topic]').evaluate(n=>n===document.activeElement),'Article selection retains visible keyboard focus');
 check((await page.locator('.reading-page > a').getAttribute('href')).startsWith('https://mathworld.wolfram.com/'),'Article has an attributed full source');
 await page.locator('[data-book-page="1"]').click();await page.waitForFunction(()=>document.querySelector('.page-number').textContent.startsWith('Page 2 of 3'));
 await page.locator('[data-reader-toggle]').click();check(await page.locator('[data-object-surface]').isHidden(),'Put book back closes reading');
 check((await props()).books[1]<.6,'Book returns to table');await page.locator('[data-reader-toggle]').click();
 await settled('books');await page.locator('[data-book-page="-1"]').click();await page.waitForFunction(()=>document.querySelector('.page-number').textContent.startsWith('Page 1 of 3'));
 await page.locator('[data-book-link="work"]').click();await settled('work');
 await page.locator('[data-computer-view="desktop"]').click();check(await page.locator('.computer-desktop').isVisible(),'Computer desktop opens on monitor');
 await page.locator('[data-computer-project="1"]').click();check(await page.locator('[data-studio-section="work"]').isVisible(),'Desktop launches the canonical project content');
 check(await page.locator('[data-reader-body]').evaluate(n=>n.scrollTop)>0,'Project launch scrolls to chosen project');
 check(await page.evaluate(()=>document.activeElement?.textContent==='Aqua Local'),'Computer project launch focuses the chosen project');
 await open('fibonacci');await page.locator('[data-fibonacci-next]').click();
 check(await page.locator('[data-fibonacci-sequence]').textContent()==='1, 1, 2, 3, 5, 8, 13, 21, 34','Fibonacci adds the correct next number');
 check(await page.locator('[data-fibonacci-drawing] rect').count()===9,'Diagram grows with sequence');
 await page.locator('[data-fibonacci-next]').click();check(await page.locator('[data-fibonacci-next]').isEnabled(),'Fibonacci continues beyond ten numbers');
 for(let i=0;i<90;i++)await page.locator('[data-fibonacci-next]').click();
 check(await page.locator('[data-fibonacci-count]').textContent()==='100','Fibonacci extends to a hundred terms');
 check((await page.locator('[data-fibonacci-full-values]').textContent()).includes('354224848179261915075'),'Large Fibonacci values stay exact');
 check(await page.locator('[data-fibonacci-drawing] rect').count()===12,'Drawing window stays bounded as the sequence grows');
 await page.locator('[data-fibonacci-auto]').click();await page.waitForFunction(()=>Number(document.querySelector('[data-fibonacci-count]').value)>101);
 await page.locator('[data-fibonacci-auto]').click();const stoppedCount=await page.locator('[data-fibonacci-count]').textContent();await page.waitForTimeout(900);
 check(await page.locator('[data-fibonacci-count]').textContent()===stoppedCount,'Continuous Fibonacci generation can be paused');
 await page.locator('[data-fibonacci-auto]').click();const leavingCount=Number(await page.locator('[data-fibonacci-count]').textContent());
 await open('books');await page.waitForTimeout(1000);await open('fibonacci');
 check(Number(await page.locator('[data-fibonacci-count]').textContent())===leavingCount,'Leaving the sketch stops generation and preserves progress');
 check(await page.locator('[data-fibonacci-auto]').getAttribute('aria-pressed')==='false','Returning to the sketch does not restart its timer');
 await page.setViewportSize({width:320,height:844});await page.locator('[data-fibonacci-full] summary').click();await fit();
 await page.screenshot({path:resolve(artifacts,'320x844-fibonacci-large-values.png')});await page.setViewportSize({width:1440,height:1000});
 await open('ball');const ballHome=(await props()).ball;await page.locator('[data-room-action="grab-ball"]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>Boolean(document.querySelector('[data-room-action="start-game"]')));
 check((await state()).ballPicked,'Ball is picked up');check(await page.locator('[data-room-action="start-game"]').evaluate(n=>n===document.activeElement),'Pickup preserves keyboard focus on Start juggling');check((await props()).ball[1]>.8,'Ball moves from floor into reach');
 await page.locator('[data-room-action="start-game"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-room-actions]').dataset.gamePhase==='lost');
 check((await state()).game.phase==='lost'&&(await state()).game.height===.115,'Missing the ball ends the round at the floor');
 check(await page.locator('[data-game-status]').textContent()==='Ball dropped. Round over.','Loss is explicit and offers retry');
 await page.locator('[data-room-action="start-game"]').click();
 const canHit=()=>page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.roomState).game.canKick);
 await canHit();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('[data-ball-score]').value==='1');
 check(true,'A correctly timed Space return scores');
 await canHit();const ballTarget=await page.locator('.studio-point[data-studio-route="ball"]').boundingBox();await page.mouse.click(ballTarget.x+ballTarget.width/2,ballTarget.y+ballTarget.height/2);
 await page.waitForFunction(()=>document.querySelector('[data-ball-score]').value==='2');check(true,'The moving ball can be returned by a timed tap');
 await page.waitForFunction(()=>document.querySelector('[data-room-actions]').dataset.gamePhase==='lost');
 check(await page.locator('[data-ball-best]').textContent()==='2','Best survives a dropped ball');
 await page.locator('[data-room-action="return-ball"]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>Boolean(document.querySelector('[data-room-action="grab-ball"]')));
 check(JSON.stringify((await props()).ball)===JSON.stringify(ballHome),'Put ball back restores floor position');check(await page.locator('[data-room-action="grab-ball"]').evaluate(n=>n===document.activeElement),'Put-back preserves focus on Pick up ball');
 await page.keyboard.press('Escape');await settled('overview');check(await page.locator('[data-explore-menu]').isVisible(),'Escape restores room discovery');
 check(await page.locator('[data-explore-menu] summary').evaluate(n=>n===document.activeElement),'Escape returns keyboard focus to activity discovery');
 for(const viewport of [{width:320,height:844},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);await visit('overview');await fit();
   await page.locator('[data-explore-menu] summary').click();
   for(const a of await page.locator('[data-explore-menu] nav a').all())check((await a.boundingBox()).height>=44,'Touch discovery has readable action targets');
   for(const route of ['window','plants','books','fibonacci','ball']){
     await open(route);await fit();
     if(route==='books'||route==='fibonacci'){
       const controls=await page.locator('.object-controls').boundingBox(),surface=await page.locator('[data-object-surface]').boundingBox();
       check(controls.y>=surface.y&&controls.y+controls.height<=surface.y+surface.height+1,'Page and sequence controls remain visible on the object');
     }
     if(route==='ball'){
       await page.locator('[data-room-action="grab-ball"]').click();await page.locator('[data-room-action="start-game"]').click();
       await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.roomState).game.phase==='lost');await fit();
       const ball=await page.locator('.studio-point[data-studio-route="ball"]').boundingBox(),tray=await page.locator('[data-room-actions]').boundingBox();
       check(ball&&!(ball.x<tray.x+tray.width&&ball.x+ball.width>tray.x&&ball.y<tray.y+tray.height&&ball.y+ball.height>tray.y),`Dropped ball remains visible outside the controls at ${viewport.width}x${viewport.height}: ${JSON.stringify({ball,tray})}`);
     }
     await page.screenshot({path:resolve(artifacts,`${viewport.width}x${viewport.height}-${route}.png`)});
   }
 }
 const animated=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),animatedErrors=[];animated.on('pageerror',e=>animatedErrors.push(e.message));
 await animated.addInitScript(()=>{window.roomFrameRequests=0;const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>{window.roomFrameRequests++;return raf(fn);};});
 await visit('plants',animated);await animated.waitForFunction(()=>{const d=document.querySelector('canvas').dataset;return d.artCorner==='loaded'&&d.artDesk==='loaded'&&d.artLiving==='loaded';});await animated.locator('[data-room-action="water"]').click();
 const pouring=await animated.waitForFunction(()=>{const s=JSON.parse(document.querySelector('canvas').dataset.roomState);return s.waterDrops>0&&s.waterPosition[1]>.7?s:null;});
 const pourPose=await pouring.jsonValue();check(pourPose.waterPosition[1]>.7&&pourPose.waterDrops>0,'Watering lifts the can and pours visible droplets');await pouring.dispose();
 await animated.locator('.studio-dock [data-studio-route="work"]').click();await settled('work',animated);
 check(await animated.locator('[data-object-surface]').isVisible(),'Navigating mid-water reaches Work');
 check(await animated.locator('canvas').evaluate(n=>JSON.parse(n.dataset.objectPositions).plants[1]===.02),'Interrupted watering returns can home');
 check(await animated.locator('canvas').evaluate(n=>JSON.parse(n.dataset.roomState).plantLeaves===0),'Cancelled watering earns no growth');
 await animated.waitForTimeout(600);check(await animated.locator('[data-studio]').getAttribute('data-destination')==='work','Cancelled watering cannot overwrite destination');
 await visit('ball',animated);await animated.waitForFunction(()=>document.querySelector('canvas').dataset.artDesk==='loaded');
 await animated.locator('[data-room-action="grab-ball"]').click();await animated.waitForFunction(()=>Boolean(document.querySelector('[data-room-action="start-game"]')));
 await animated.locator('[data-room-action="start-game"]').click();await animated.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.objectPositions).ball[1]>.95);
 await animated.locator('[data-studio-motion]').click();
 await animated.screenshot({path:resolve(artifacts,'juggling-in-air.png')});
 check(await animated.locator('[data-room-action="kick-ball"]').isDisabled(),'Paused game disables kicks');
 const pausedHeight=await animated.locator('canvas').evaluate(n=>JSON.parse(n.dataset.roomState).game.height);await animated.waitForTimeout(1000);
 check(await animated.locator('canvas').evaluate(n=>JSON.parse(n.dataset.roomState).game.height)===pausedHeight,'Pause freezes gravity without losing the round');
 await animated.locator('[data-studio-motion]').click();await animated.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.roomState).game.phase==='lost');
 const idleFrames=await animated.evaluate(()=>window.roomFrameRequests);await animated.waitForTimeout(300);
 check(await animated.evaluate(()=>window.roomFrameRequests)===idleFrames,'A dropped round stops requesting animation frames');
 await animated.locator('[data-room-action="start-game"]').click();
 await animated.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const hiddenHeight=await animated.locator('canvas').evaluate(n=>JSON.parse(n.dataset.roomState).game.height);await animated.waitForTimeout(1000);
 check(await animated.locator('canvas').evaluate((n,height)=>JSON.parse(n.dataset.roomState).game.phase==='playing'&&JSON.parse(n.dataset.roomState).game.height===height,hiddenHeight),'Visibility interruption freezes the game');
 await animated.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await animated.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.roomState).game.height>.95);
 await animated.locator('.studio-dock [data-studio-route="contact"]').click();await settled('contact',animated);
 check(await animated.locator('[data-phone-wake]').isVisible(),'Navigation interrupts juggling and reaches phone');
 check(await animated.locator('canvas').evaluate(n=>!JSON.parse(n.dataset.roomState).ballPicked),'Interrupted juggling releases ball');
 check(animatedErrors.length===0,`No animated runtime errors: ${animatedErrors.join(';')}`);await animated.close();
 for(const corrupt of [false,true]){
   const p=await browser.newPage({reducedMotion:'reduce'});await p.route('**/assets/studio/living-zone.glb',r=>corrupt?r.fulfill({status:200,body:'bad model'}):r.abort());
   await visit('books',p);await p.waitForFunction(()=>document.querySelector('canvas').dataset.artLiving==='fallback');
   check(await p.locator('.reading-page').isVisible(),'Missing/corrupt room art retains live book and original geometry');await p.close();
 }
 await visit('overview');await page.waitForFunction(()=>document.querySelector('canvas').dataset.artLiving==='loaded');await page.waitForTimeout(250);
 const count=await page.evaluate(()=>window.roomFrameRequests);await page.waitForTimeout(350);
 check(await page.evaluate(()=>window.roomFrameRequests)===count,'Room rendering stays idle after activities');
 check(errors.length===0,`No room runtime errors: ${errors.join('; ')}`);
 console.log(`${browserName}: ${checks} room experience checks passed; screenshots in validation-artifacts/${browserName}/room-experience.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
