import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
const art=(process.env.STUDIO_ARTIFACTS||'validation-artifacts/presentation-followup-implementation')+'/'+name;await mkdir(art,{recursive:true});
let currentPage=null,diagnostics=[];let checks=0;function check(v,m){assert.ok(v,m);checks++;}
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:844,height:390}]){
  const p=await browser.newPage({viewport,reducedMotion:'reduce',hasTouch:viewport.width<700}),errors=[];
  currentPage=p;console.log(name+': checking '+viewport.width+'px presentation');
  diagnostics=[];p.on('console',m=>{if(m.type()==='error')diagnostics.push(m.text());});
  p.on('requestfailed',r=>diagnostics.push(r.url()+' '+r.failure()?.errorText));
  p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/#ball');
  await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='ball'&&
    document.querySelector('[data-world-content]').dataset.artState==='ready'&&
    !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  for(const selector of ['.world-dock','.world-map','.scene-settings','[data-world-text]'])
    check(await p.locator(selector).isHidden(),viewport.width+': no global chrome over a game');
  check(await p.locator('canvas').count()===2,'Game has an actual separate rendered playfield');
  if(viewport.width<720||viewport.height<500){const screen=await p.locator('[data-world-reader]').boundingBox();
    check(screen.x<1&&screen.width>=viewport.width-1&&screen.y<=65&&screen.height>=viewport.height-65,
      'Mobile play fills the viewport without a nested phone frame');}
  await p.screenshot({path:art+'/'+viewport.width+'-ball.png'});
  await p.locator('[data-game-start]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).phase==='playing');
  check(await p.locator('[data-juggle-instructions]').isHidden(),'Brief instructions disappear after the countdown');
  const canvas=p.locator('[data-juggle-canvas]');
  const state=()=>canvas.evaluate(n=>JSON.parse(n.dataset.juggleState));
  const kickTarget=await p.locator('[data-game-kick]').boundingBox();
  // Observe pixels during the native input event, before its handler changes the frame.
  // Reading a GPU-backed canvas in the wait predicate can itself consume the timing window.
  await p.evaluate(()=>{
    const observe=e=>{
      const key=e.type==='keydown'&&e.code==='Space'&&!e.target.closest('a,button,summary');
      const click=e.type==='click'&&e.target.closest('[data-game-kick]');
      if(!key&&!click)return;
      const n=document.querySelector('[data-juggle-canvas]');if(!n)return;
      const s=JSON.parse(n.dataset.juggleState),kick=document.querySelector('[data-game-kick]'),ratio=n.width/n.clientWidth;
      const colour=n.getContext('2d').getImageData(Math.round((s.ring.x+s.ring.rx*.35)*ratio),Math.round(s.ring.y*ratio),1,1).data;
      const fill=n.getContext('2d').getImageData(Math.round((s.ring.x-s.ring.rx*.35)*ratio),Math.round(s.ring.y*ratio),1,1).data;
      window.juggleInputCue={lit:s.ring.lit,colour:[...colour],fill:[...fill],enabled:!kick.disabled,
        label:kick.textContent,glowing:kick.classList.contains('kick-ready')};
    };
    document.addEventListener('keydown',observe,true);document.addEventListener('click',observe,true);
  });
  await p.keyboard.press('Space');
  check((await state()).score===0&&await p.locator('[data-game-status]').innerText().then(t=>t.includes('Mistimed kick')),
    'A too-early kick gives visible feedback and no score');
  let frozen;
  for(let i=1;i<=3;i++){
    await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).canKick);
    if(i===2&&viewport.width<700)await p.touchscreen.tap(kickTarget.x+kickTarget.width/2,kickTarget.y+kickTarget.height/2);
    else await p.keyboard.press('Space');
    if(i===3){
      check(await p.locator('[data-game-kick]').isEnabled(),'Kick remains live between valid windows');
      // Pause before slower layout/screenshot checks can let the scored ball fall.
      const pause=await p.locator('[data-device-pause]').boundingBox();
      await p.mouse.move(pause.x+pause.width/2,pause.y+pause.height/2);
      await p.mouse.down();await p.waitForTimeout(150);await p.mouse.up();
      await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).paused&&
        document.querySelector('[data-device-pause]').textContent==='Resume');
      frozen=await state();
    }
    const cue=await p.evaluate(()=>window.juggleInputCue);
    check(cue.lit&&cue.colour[0]>140&&cue.colour[1]>160,'The valid timing cue is visibly painted bright green');
    check(cue.fill[1]>175&&cue.fill[1]>cue.fill[2]+45,'The valid zone has a strong visible green fill, not only a dashed rim');
    check(cue.enabled&&cue.label==='Kick'&&cue.glowing,'The primary Kick control stays live, stable and glows when ready');
    check((await state()).score===i,'A real input scores exactly one keep-up');
    const contact=await canvas.evaluate(n=>JSON.parse(n.dataset.juggleImpact));
    check(contact.score===i&&Math.hypot(contact.toe.x-contact.ball.x,contact.toe.y-contact.ball.y)<contact.ball.radius,
      'The scored kick moves the boot into contact with the ball');
    if(i<3)check(await p.locator('[data-game-kick]').isEnabled(),'Kick remains live between valid windows');
    if(i===1){
      const peak=await p.waitForFunction(()=>{const s=JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState);
        return s.phase==='playing'&&s.score===1&&s.velocity<0?{top:s.ball.y-s.ball.radius}:false;});
      const apex=await peak.jsonValue();await peak.dispose();
      check(apex.top>=0,'The actual ball stays visible at the top of its flight, including landscape');
    }
    await p.waitForFunction(()=>!JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).canKick);
  }
  const geometry=await canvas.evaluate(n=>{
    const s=JSON.parse(n.dataset.juggleState),r=n.getBoundingClientRect(),root=document.querySelector('[data-world-reader]').getBoundingClientRect();
    const controls=[...document.querySelectorAll('.juggling-controls button:not([hidden])')].map(b=>b.getBoundingClientRect().toJSON());
    const ratio=n.width/r.width,c=n.getContext('2d');
    const colour=c.getImageData(Math.round(s.ball.x*ratio),Math.round(s.ball.y*ratio),1,1).data;
    const court=c.getImageData(Math.round((s.ball.x+s.ball.radius+5)*ratio),Math.round(s.ball.y*ratio),1,1).data;
    return {s,r:r.toJSON(),root:root.toJSON(),controls,colour:[...colour],court:[...court]};
  });
  check(geometry.r.y>=0&&geometry.r.bottom<=viewport.height&&geometry.r.x>=0&&geometry.r.right<=viewport.width,
    'The complete playfield is visible');
  const {s,r}=geometry;
  check(s.ball.y-s.ball.radius>=0&&s.ball.y+s.ball.radius<r.height&&s.ball.x-s.ball.radius>=0&&s.ball.x+s.ball.radius<r.width,
    'The actual ball is inside the rendered playfield');
  check(s.shadow.y>s.ball.y,'Shadow stays on the ground below the airborne ball');
  check(geometry.colour[3]===255&&Math.hypot(...geometry.colour.slice(0,3).map((v,i)=>v-geometry.court[i]))>30,'Ball is visibly painted, not only present in state');
  for(const control of geometry.controls){check(control.height>=43&&control.width>=43,'Touch control is large enough');
    check(control.y>=r.y+s.ground+s.ball.radius&&control.bottom<=geometry.root.bottom+1,'Controls overlay the court margin clear of the ball and feet');
    check(control.x>=geometry.root.x-1&&control.right<=geometry.root.right+1,'Controls fit horizontally inside the device');}
  await p.screenshot({path:art+'/'+viewport.width+'-ball-engaged-paused.png'});
  await p.waitForTimeout(250);
  check((await state()).height===frozen.height&&frozen.paused,'Own Pause button freezes the ball');
  await p.locator('[data-device-pause]').click();
  await p.waitForFunction(()=>!JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).paused);
  await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).phase==='lost');
  const dropped=await state();
  check(Math.abs(dropped.ball.y+dropped.ball.radius-dropped.ground)<1,'A dropped ball actually rests on the court');
  check(await p.locator('[data-game-start]').innerText()==='Retry','Drop ends the round with Retry');
  check(await p.locator('[data-juggle-result]').isVisible(),'Result is a banner within the game');
  check(await p.locator('[data-juggle-result]').innerText().then(t=>t.includes('New best!')&&t.includes('court glows green')),
    'A new record is celebrated with a useful retry tip');
  const banner=await p.locator('[data-juggle-result]').boundingBox(),court=await canvas.boundingBox();
  check(banner.y-court.y<100&&banner.y+banner.height<court.y+dropped.player.top&&
    banner.y+banner.height<court.y+dropped.ball.y-dropped.ball.radius,
    'Result sits in the sky clear of the resting ball and boot');
  check(await p.locator('[data-game-status]').isHidden()&&await p.locator('[data-game-status]').innerText()==='',
    'No duplicate round-over message below the result');
  await p.screenshot({path:art+'/'+viewport.width+'-ball-result.png'});
  await p.locator('[data-game-start]').click();check((await state()).score===0&&(await state()).best===3,'Retry resets score and retains best');
  await p.locator('[data-world-close]').click();
  check(await p.locator('[data-juggle-canvas]').count()===0,'Leaving disposes the running game');
  await p.locator('[data-settings-toggle]').click();await p.locator('[data-world-regions] [data-world-route="winter"]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.worldState).region==='winter');
  await p.locator('[data-world-map] summary').click();await p.locator('[data-world-map] [data-world-route="ball"]').click();
  await p.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  await p.screenshot({path:art+'/'+viewport.width+'-ball-winter.png'});
  check(await p.locator('[data-world-close]').innerText()==='← Coast','The coastal court returns to its matching season');
  await p.locator('[data-world-close]').click();
  await p.locator('.world-dock [data-world-route="work"]').click();
  await p.waitForFunction(()=>!document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  check(await p.locator('.workspace-app').count()===3&&await p.locator('[data-project-tab]').count()===0,
    'Laptop starts with three icons and no duplicate tabs');
  await p.locator('[data-demo-open]').click();
  const iframe=p.locator('.tank-frame'),frame=p.frameLocator('.tank-frame');
  check(await iframe.getAttribute('sandbox')==='allow-scripts','Demo keeps its opaque-origin sandbox');
  await frame.locator('[data-start]').waitFor();
  await frame.locator('html[data-embedded="true"][data-connected="true"]').waitFor();
  check(await frame.locator('body').evaluate(n=>n.parentElement.dataset.embedded==='true'),'Nonce and port handshake completes');
  const start=await frame.locator('[data-start]').boundingBox(),view=await iframe.boundingBox();
  const battlefield=await frame.locator('.arena').boundingBox();
  check(battlefield.width>=Math.min(250,view.width-24)&&battlefield.height>=105,'Battlefield gets useful device space');
  check(start.y>=view.y&&start.y+start.height<=view.y+view.height,'Demo Start is visible inside the game screen');
  await p.screenshot({path:art+'/'+viewport.width+'-treadfront-ready.png'});
  await frame.locator('[data-start]').click();
  check(await frame.locator('.start').isHidden(),'Starting reveals the actual approved sector');
  for(const action of ['[data-fire]','[data-mine]','[data-direction=right]']){
    const rect=await frame.locator(action).boundingBox();
    check(rect.x>=view.x&&rect.x+rect.width<=view.x+view.width+1&&rect.y>=view.y&&rect.y+rect.height<=view.y+view.height+1,
      'Each tank action fits inside the visible screen');
  }
  await p.screenshot({path:art+'/'+viewport.width+'-treadfront-playing.png'});
  if(viewport.width<720||viewport.height<500)await p.locator('[data-world-close]').click();
  else await p.locator('[data-demo-close]').click();
  check(await p.locator('.workspace-app').first().isVisible(),'Back to apps restores the laptop launcher');
  check(errors.length===0,'No browser errors: '+errors.join('; '));await p.close();
  console.log(name+': '+viewport.width+'px presentation checks passed');
 }
 const missing=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});currentPage=missing;
 let failView=true;
 await missing.route('**/assets/outdoor/object-views.json',r=>{
  if(failView){failView=false;return r.fulfill({status:404,body:'Missing'});}return r.continue();});
 await missing.goto(url+'/#books');await missing.getByText('This close-up could not load.').waitFor();
 check(await missing.locator('[data-world-close]').isVisible(),'Optional close-up failure retains a visible exit');
 await missing.locator('[data-view-retry]').click();
 await missing.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='books'&&
   !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 check(await missing.locator('.book-contents').isVisible(),'Retry recovers the physical book after an asset failure');
 await missing.close();
 console.log(name+': '+checks+' presentation checks passed.');
}catch(error){
 console.error('Browser diagnostics:',diagnostics);
 if(currentPage&&!currentPage.isClosed()){console.error(await currentPage.evaluate(()=>({body:document.body.dataset,
  reader:document.querySelector('[data-world-reader]')?.outerHTML.slice(0,1300),state:document.querySelector('canvas')?.dataset.worldState})));
  await currentPage.screenshot({path:art+'/failure.png'});}
 throw error;
}finally{await browser.close();}
