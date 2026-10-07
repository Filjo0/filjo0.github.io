import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => { throw new Error('Set PLAYWRIGHT_MODULE to development Playwright index.mjs.'); });
const browserName = process.env.STUDIO_BROWSER || 'chromium';
const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'validation-artifacts', browserName);
await mkdir(artifacts, { recursive: true });
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.pdf':'application/pdf' };
const server = createServer(async (request,response) => {
  try {
    const pathname = new URL(request.url,'http://localhost').pathname;
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + sep)) throw new Error('Outside project');
    const bytes=await readFile(file);
    response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' });
    response.end(bytes);
  } catch { response.writeHead(404);response.end('Not found'); }
});
await new Promise(done => server.listen(0,'127.0.0.1',done));
const url = `http://127.0.0.1:${server.address().port}`;
let checks=0,browser;
const check=(value,message)=>{assert.ok(value,message);checks++;};
try {
  browser=await playwright[browserName].launch({headless:true,
    ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
    ...(browserName==='chromium'?{args:['--enable-unsafe-swiftshader']}:{}),
  });
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.studioFrameRequests=0;const original=requestAnimationFrame;
    window.requestAnimationFrame=callback=>{window.studioFrameRequests++;return original(callback);};
  });
  const settled=(route,p=page)=>p.waitForFunction(route=>{
    const room=document.querySelector('[data-studio]');return document.body.dataset.studioReady==='true'&&room.dataset.destination===route&&room.dataset.travelling==='false';
  },route);
  const open=async route=>{await page.locator(`.studio-dock [data-studio-route="${route}"]`).click();await settled(route);};
  const home=async()=>{await page.goto(url);await settled('overview');};
  const screenshot=name=>page.screenshot({path:resolve(artifacts,`${name}.png`)});
  const unique=async()=>check(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return new Set(ids).size===ids.length;}),'Canonical IDs stay unique');
  const fits=async()=>{
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1&&scrollY===0),'Room fits viewport without document scrolling');
    const bounds=await page.locator('[data-object-surface]').boundingBox();
    if(bounds){const viewport=page.viewportSize();check(bounds.x>=-1&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1,'Projected object surface fits viewport');}
    const reading=await page.locator('[data-reader-body]').evaluate(n=>({width:n.clientWidth,scrollWidth:n.scrollWidth}));
    check(reading.scrollWidth<=reading.width+1,`Reading has no horizontal overflow at ${page.viewportSize().width}px ${await page.locator('[data-studio]').getAttribute('data-destination')}: ${JSON.stringify(reading)}`);
  };
  await home();await unique();await fits();await screenshot('walk-overview');
  check(await page.locator('canvas.room-canvas').count()===1,'One real world canvas');
  check(await page.locator('dialog,[role="dialog"],[data-viewpoint-image]').count()===0,'No dialogs or photograph swaps');
  check(await page.locator('[data-studio-fallback]').isHidden(),'No duplicate page beneath scene');
  check(await page.locator('.studio-point-resume').getAttribute('aria-label')==='Walk to the desk folio: Resume','Resume belongs to desk folio');
  const marker=page.locator('.studio-point-work');
  check(await marker.locator('.studio-label').evaluate(n=>getComputedStyle(n).opacity==='0'),'Desktop labels hidden at rest');
  await marker.hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.studio-point-work .studio-label')).opacity==='1');
  await marker.focus();await page.keyboard.press('Tab');await marker.focus();
  check(await marker.evaluate(n=>n.matches(':focus-visible')),'Hotspots support keyboard discovery');
  const camera=()=>page.locator('canvas').getAttribute('data-camera-position');
  const rotation=()=>page.locator('canvas').getAttribute('data-camera-rotation');
  const homeObjects=await page.locator('canvas').getAttribute('data-object-positions');
  const before=await camera(),fov=await page.locator('canvas').getAttribute('data-fov');
  await marker.click();await page.waitForTimeout(250);
  check(await camera()!==before,'Camera physically translates during walk');
  check(await page.locator('[data-object-surface]').isHidden(),'Walking precedes object reading');
  await screenshot('walk-in-progress');await settled('work');
  check(await page.locator('canvas').getAttribute('data-fov')===fov,'Walking retains constant lens FOV');
  check(await page.locator('[data-object-surface]').getAttribute('data-surface')==='monitor','Projects on monitor');
  check(await page.locator('[data-scene-content] [data-studio-section="work"]').isVisible(),'Canonical projects mounted on physical surface');
  check(await page.locator('[data-scene-title]').evaluate(n=>document.activeElement===n),'Destination heading receives focus');
  await fits();await screenshot('monitor');
  await page.locator('[data-reader-body]').evaluate(n=>n.scrollTop=230);
  await open('experience');await screenshot('notebook');
  for(const id of ['experience','capabilities','resume'])check(await page.locator(`[data-scene-content] [data-studio-section="${id}"]`).count()===1,`${id} on notebook`);
  await page.goBack();await settled('work');
  check(Math.abs(await page.locator('[data-reader-body]').evaluate(n=>n.scrollTop)-230)<3,'Back restores scroll position');
  await page.goForward();await settled('experience');
  await open('resume');await page.waitForFunction(()=>document.querySelector('[data-resume-view]').dataset.state==='ready');
  check(await page.locator('[data-object-surface]').getAttribute('data-surface')==='folio','Resume on physical desk folio');
  check(await page.frameLocator('[data-resume-frame]').locator('.page').count()===2,'Approved two-page resume embedded');
  check(await page.frameLocator('[data-resume-frame]').locator('.resume-toolbar').isHidden(),'Embedded resume has no duplicate toolbar');
  await screenshot('folio');await page.goBack();await settled('experience');
  check(page.url().endsWith('#experience'),'Frame adds no joint history entry');
  await open('resume');await page.frameLocator('[data-resume-frame]').locator('a').first().focus();await page.keyboard.press('Escape');await settled('overview');
  await marker.focus();await page.keyboard.press('Enter');await settled('work');await page.keyboard.press('Escape');await settled('overview');
  check(await marker.evaluate(n=>document.activeElement===n),'Escape restores hotspot focus');
  await open('contact');
  check(await page.locator('[data-phone-wake]').isVisible(),'Phone must be activated after approach');
  check(await page.locator('[data-scene-reader]').isHidden(),'Contacts stay off while phone asleep');
  check(await page.locator('[data-phone-wake]').evaluate(n=>n===document.activeElement),'Wake is keyboard focus target');
  // WebKit snapshots after iframe focus can clear native focus; capture the
  // sleeping screen in the separate touch scenario, after keyboard checks.
  await page.keyboard.press('Enter');await page.waitForTimeout(250);
  check(await page.locator('[data-object-surface]').getAttribute('data-surface')==='phone','Contacts on phone glass');
  check(await page.locator('[data-object-surface] a[href="mailto:philalimov.apps@gmail.com"]').isVisible(),'Business email active inside phone');
  check(await page.locator('[data-studio]').getAttribute('data-phase')==='phone-awake','Tap wakes screen');
  await screenshot('phone-awake');await fits();
  await page.locator('[data-reader-toggle]').click();
  check(await page.locator('[data-object-surface]').isHidden(),'Look around puts phone down');
  await page.waitForFunction(expected=>document.querySelector('canvas').dataset.objectPositions===expected,homeObjects);
  const lookBounds=await page.locator('[data-room-world]').boundingBox(),lookRotation=await rotation();
  await page.mouse.move(lookBounds.width*.45,lookBounds.y+lookBounds.height*.4);await page.mouse.down();await page.mouse.move(lookBounds.width*.65,lookBounds.y+lookBounds.height*.4,{steps:4});await page.mouse.up();
  check(await rotation()!==lookRotation,'Look around allows turning at the approached object');
  await page.locator('[data-reader-toggle]').click();await settled('contact');
  check(await page.locator('[data-scene-reader]').isVisible(),'Picking phone up again retains awake state');
  await page.locator('.studio-dock [data-studio-route="work"]').click();
  await page.locator('.studio-dock [data-studio-route="experience"]').click();
  await page.locator('.studio-dock [data-studio-route="contact"]').click();await settled('contact');
  check(await page.locator('[data-scene-content] [data-studio-section="work"]').count()===0,'Interrupted journeys do not restore stale content');
  await unique();
  await page.locator('.studio-dock [data-studio-route="experience"]').click();await page.waitForTimeout(120);
  await page.setViewportSize({width:390,height:844});await settled('experience');await fits();
  check(await page.locator('[data-reader-body]').evaluate(n=>n.clientHeight>=300),'Resize during movement fits the newly held page');
  await page.setViewportSize({width:1440,height:1000});await open('contact');
  await page.locator('.studio-dock [data-studio-route="experience"]').click();await page.locator('[data-studio-motion]').click();await settled('experience');
  check(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length===0),'Pause stops room motion');
  await page.keyboard.press('Escape');await settled('overview');
  check(await page.locator('canvas').getAttribute('data-object-positions')===homeObjects,'Interrupted put-down returns every prop to its home');
  const room=await page.locator('[data-room-world]').boundingBox(),oldRotation=await rotation();
  await page.mouse.move(room.x+room.width*.6,room.y+room.height*.45);await page.mouse.down();await page.mouse.move(room.x+room.width*.8,room.y+room.height*.45,{steps:6});await page.mouse.up();
  check(await rotation()!==oldRotation,'Dragging rotates real camera');
  await page.waitForTimeout(300);const requests=await page.evaluate(()=>window.studioFrameRequests);await page.waitForTimeout(500);
  check(await page.evaluate(()=>window.studioFrameRequests)===requests,'Idle room requests no ongoing render frames');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-studio-motion]').disabled);check(await page.locator('[data-studio-motion]').isDisabled(),'System reduced motion takes precedence');
  for(const hash of ['work','experience','resume','contact','capabilities']){
    await page.goto(`${url}/#${hash}`);await settled(hash==='capabilities'?'experience':hash);await unique();await fits();
  }
  for(const viewport of [{width:320,height:844},{width:390,height:844},{width:720,height:900},{width:1100,height:800},{width:720,height:500},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.goto(url);await settled('overview');await fits();
    for(const route of ['work','experience','resume','contact']){
      await open(route);if(route==='contact')await page.locator('[data-phone-wake]').click();
      await fits();await unique();
      if(route==='resume'){
        await page.waitForFunction(()=>document.querySelector('[data-resume-view]').dataset.state==='ready');
        check(await page.frameLocator('[data-resume-frame]').locator('h1').isVisible(),'Resume identity is visible in embedded screen mode');
        if(viewport.height<540)check(await page.locator('[data-resume-frame]').evaluate(n=>n.clientHeight>=100),'Short landscape preserves document reading area');
      }
      if(viewport.width===390)check(await page.locator('[data-reader-body]').evaluate(n=>n.clientHeight>=300),'Portrait readers keep substantial readable height');
      await screenshot(`${viewport.width}x${viewport.height}-${route}`);
    }
    if(viewport.width===844)check(await page.locator('[data-object-surface]').getAttribute('data-orientation')==='landscape','Short landscape phone rotates with upright UI');
  }
  const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await touch.goto(url);await settled('overview',touch);
  await touch.locator('.studio-dock [data-studio-route="contact"]').tap();await settled('contact',touch);
  check(await touch.locator('[data-phone-wake]').isVisible(),'Touch destination reaches sleeping phone');
  await touch.screenshot({path:resolve(artifacts,'phone-asleep.png')});
  await touch.locator('[data-phone-wake]').tap();
  const contactLinks=touch.locator('[data-object-surface] .contact-actions a');
  for(let i=0;i<await contactLinks.count();i++)check((await contactLinks.nth(i).boundingBox()).height>=44,'Touch contact link keeps 44px target');
  await touch.screenshot({path:resolve(artifacts,'touch-phone.png')});await touch.close();
  check(errors.length===0,`No runtime errors: ${errors.join('; ')}`);await page.close();
  const fallback=async({noJS=false,block,webglFailure=false,contextLoss=false})=>{
    const p=await browser.newPage({viewport:{width:390,height:844},javaScriptEnabled:!noJS,reducedMotion:'reduce'});
    if(block)await p.route(block,r=>r.abort());
    if(webglFailure)await p.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.startsWith('webgl')?null:getContext.call(this,kind,...args);};});
    await p.goto(url);
    if(contextLoss){await settled('overview',p);await p.locator('.studio-dock [data-studio-route="work"]').click();await settled('work',p);await p.locator('canvas').evaluate(n=>n.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));}
    await p.waitForFunction(()=>!document.querySelector('[data-studio-fallback]').hidden);
    // Initialization may still be attempting module import before fallback checks.
    await p.waitForTimeout(350);
    check(await p.locator('[data-studio-fallback]').isVisible(),'Ordinary content survives initialization/context failures');
    check(await p.locator('#work').count()===1&&await p.locator('#contact').count()===1,'Fallback restores original section IDs');
    check(await p.locator('.studio-dock [data-studio-route="resume"]').getAttribute('href')==='resume.html','Fallback resume opens standalone');
    await p.close();
  };
  await fallback({noJS:true});await fallback({block:'**/room.js'});await fallback({block:'**/assets/vendor/three.module.js'});await fallback({webglFailure:true});await fallback({contextLoss:true});
  const missing=await browser.newPage({reducedMotion:'reduce'});await missing.route('**/assets/studio-workspace.webp',r=>r.abort());await missing.goto(url);await settled('overview',missing);
  check(await missing.locator('canvas.room-canvas').isVisible(),'Missing exterior texture still leaves full room geometry');await missing.close();
  const resumeFailure=await browser.newPage({reducedMotion:'reduce'});await resumeFailure.route('**/resume.html?embed=1',r=>r.fulfill({status:404,contentType:'text/html',body:'Missing document'}));await resumeFailure.goto(`${url}/#resume`);await settled('resume',resumeFailure);
  await resumeFailure.waitForFunction(()=>document.querySelector('[data-resume-view]').dataset.state==='error');
  check(await resumeFailure.locator('[data-resume-retry]').isVisible(),'Resume failure offers retry');
  check(await resumeFailure.locator('[data-standalone-resume]').isVisible(),'Resume failure retains standalone link');
  check(await resumeFailure.locator('.studio-resume-actions a[download]').isVisible(),'Resume failure retains PDF');await resumeFailure.close();
  const walker=await browser.newPage({viewport:{width:1440,height:1000}});await walker.goto(url);await settled('overview',walker);
  await walker.locator('.studio-dock [data-studio-route="contact"]').click();
  await walker.waitForFunction(()=>Number(document.querySelector('canvas.room-canvas').dataset.cameraPosition.split(',')[2])<1.4);
  const pitch=await walker.evaluate(()=>{const [x,y,z,w]=document.querySelector('canvas.room-canvas').dataset.cameraRotation.split(',').map(Number);return 2*(w*x-y*z);});
  check(pitch>-.2,`Walker faces the path with a level gaze mid-walk: ${pitch.toFixed(3)}`);
  await settled('contact',walker);await walker.close();
  const narrow=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});await narrow.goto(url);await settled('overview',narrow);
  // The hint is click-through; probe its stacking with hit-testing briefly enabled.
  check(await narrow.evaluate(()=>{const node=document.querySelector('[data-swipe-hint]');node.style.pointerEvents='auto';const hint=node.getBoundingClientRect();const top=document.elementFromPoint(hint.x+hint.width/2,hint.y+hint.height/2);node.style.pointerEvents='';return Boolean(top?.closest('[data-swipe-hint]'));}),'Mobile look-around hint is drawn above the room');
  const caption=await narrow.locator('[data-scene-caption]').boundingBox(),notebook=await narrow.locator('.studio-point-experience').boundingBox();
  check(caption.y+caption.height<=notebook.y,'Mobile overview caption does not cover the notebook');await narrow.close();
  console.log(`${browserName}: ${checks} walkthrough checks passed; screenshots in validation-artifacts/${browserName}.`);
} finally {await browser?.close();await new Promise(done=>server.close(done));}
