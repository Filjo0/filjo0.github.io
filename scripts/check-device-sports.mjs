import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const name=process.env.STUDIO_BROWSER||'chromium',url=process.env.STUDIO_URL||'http://127.0.0.1:8765';
const art=(process.env.STUDIO_ARTIFACTS||'validation-artifacts/presentation-recheck2-implementation')+'/'+name;await mkdir(art,{recursive:true});
const browser=await pw[name].launch({headless:true,
 ...(process.env.STUDIO_BROWSER_EXECUTABLE?{executablePath:process.env.STUDIO_BROWSER_EXECUTABLE}:{}),
 ...(name==='chromium'?{args:['--enable-unsafe-swiftshader']}: {})});
let checks=0,current;const check=(v,m)=>{assert.ok(v,m);checks++;};
async function nativeActivate(p,selector,touch){
 if(touch||selector==='[data-game-kick]'){
  const r=await p.locator(selector).boundingBox();assert.ok(r,'Native input target must be visible: '+selector);
  if(touch)await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  else await p.mouse.click(r.x+r.width/2,r.y+r.height/2);
 }else await p.locator(selector).click();
}
async function pause(p){
 const r=await p.locator('[data-device-pause]').boundingBox();
 await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.waitForTimeout(150);await p.mouse.up();
 await p.waitForFunction(()=>document.querySelector('[data-device-pause]').textContent==='Resume');
}
async function alignment(p){
 return p.locator('[data-world-reader]').evaluate(n=>{
  const expected=JSON.parse(n.dataset.surfaceCorners),host=document.querySelector('[data-world-render]').getBoundingClientRect();
  return Math.max(...[[0,0],[1,0],[1,1],[0,1]].map(([x,y],i)=>{
   const marker=document.createElement('i');marker.style.cssText=`position:absolute;left:${x*100}%;top:${y*100}%;width:0;height:0`;
   n.append(marker);const r=marker.getBoundingClientRect();marker.remove();
   return Math.hypot(r.x-host.x-expected[i].x,r.y-host.y-expected[i].y);
  }));
 });
}
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844},{width:844,height:390}]){
  const touch=viewport.width<720,p=await browser.newPage({viewport,hasTouch:touch,reducedMotion:'reduce'}),errors=[];current=p;
  p.on('pageerror',e=>errors.push(e.message));console.log(name+': device games '+viewport.width+'px');
  // A full touch-only round, without relying on an obsolete prompt or mutating the model.
  await p.goto(url+'/#ball');await p.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='ball'&&
   !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
  await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).artReady);
  check(await p.locator('[data-world-content]').getAttribute('data-art-state')==='ready',
   'The lazily loaded artwork is visibly ready before the native Start tap');
  await p.screenshot({path:art+'/'+viewport.width+'-ball-open.png'});
  await nativeActivate(p,'[data-game-start]',touch);
  await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).phase==='playing');
  // Measure outside the short valid window; layout queries must not delay the timed kick.
  const kickTarget=await p.locator('[data-game-kick]').boundingBox();
  assert.ok(kickTarget,'The visible Kick button has a native input target before play');
  const kickPoint={x:kickTarget.x+kickTarget.width/2,y:kickTarget.y+kickTarget.height/2};
  for(let i=1;i<=6;i++){
   const deadline=Date.now()+3500;
   while(true){
    const s=await p.locator('[data-juggle-canvas]').evaluate(n=>JSON.parse(n.dataset.juggleState));
    check(s.phase==='playing','Native steering keeps the ball in play');if(s.canKick)break;
    if(Date.now()>deadline)throw Error('Native steering did not reach a kick window');
    const delta=s.ball.x-(s.ring.x-s.ball.radius*.5);
    if(Math.abs(delta)>s.ball.radius*1.8){
     const q=await p.locator('[data-juggle-nudge="'+(delta>0?'1':'-1')+'"]').boundingBox();
     if(touch)await p.touchscreen.tap(q.x+q.width/2,q.y+q.height/2);
     else await p.mouse.click(q.x+q.width/2,q.y+q.height/2);
    }
    else await p.waitForFunction(()=>{
     const q=JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState);
     return q.phase!=='playing'||q.canKick||Math.abs(q.ball.x-(q.ring.x-q.ball.radius*.5))>q.ball.radius*1.8;
    },null,{polling:'raf',timeout:3500});
   }
   if(touch)await p.touchscreen.tap(kickPoint.x,kickPoint.y);
   else await p.mouse.click(kickPoint.x,kickPoint.y);
   check(await p.locator('[data-game-score]').innerText()===String(i),'Native '+(touch?'touch':'mouse')+' scores keep-up '+i);
  }
  // Capture only after a native pause; encoding a screenshot can outlast a live kick window.
  await pause(p);
  await p.screenshot({path:art+'/'+viewport.width+'-ball-playing.png'});
  check(await p.locator('[data-game-level]').innerText()==='Level 2','Touch play reaches the harder second level');
  await p.screenshot({path:art+'/'+viewport.width+'-ball-touch-paused.png'});
  await p.locator('[data-device-pause]').click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-juggle-canvas]').dataset.juggleState).phase==='lost');
  check(await p.locator('[data-juggle-result]').isVisible(),'Native play ends in one visible juggling result');
  await p.screenshot({path:art+'/'+viewport.width+'-ball-result.png'});
  await p.locator('[data-world-close]').click();
  for(const type of ['skate','surf']){
   await p.locator('[data-world-map] summary').click();
   await p.locator('[data-world-map] [data-world-route="'+type+'"]').click();
   await p.waitForFunction(t=>document.querySelector('[data-world-reader]').dataset.object===t&&
    !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'),type);
   const canvas=p.locator('[data-sport-canvas]'),state=()=>canvas.evaluate(n=>JSON.parse(n.dataset.sportState));
   // The reading mesh can settle one frame after the route is published. Inspect a real,
   // resized canvas, retaining the fill and painted-pixel assertions below.
   await p.waitForFunction(()=>{
    const n=document.querySelector('[data-sport-canvas]'),ratio=Math.min(devicePixelRatio,2);
    return n&&n.width===Math.round(n.clientWidth*ratio)&&n.height===Math.round(n.clientHeight*ratio);
   });
   await canvas.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   check(await p.locator('[data-sport-instructions]').isVisible(),'Visible '+type+' instructions before the timer');
   check((await state()).phase==='ready','No activity timer before Start');
   if(type==='skate'){
    const s=await state(),surface=s.rink;
    const box=await canvas.evaluate(n=>({width:n.clientWidth,height:n.clientHeight}));
    check(surface.x<=10&&surface.y<=10&&surface.width>=box.width-20&&surface.height>=box.height-20,
     type+': the overhead play surface fills the canvas');
    const top=await canvas.evaluate(n=>{return [...n.getContext('2d').getImageData(
     Math.round(n.width*.5),Math.round(n.height*.1),1,1).data];});
    check(top[1]>top[0]+25&&top[2]>top[0]+20,type+': the actual upper playfield is ice, not empty scenery');
   }
   check(await alignment(p)<1,'Actual '+type+' device mesh/DOM corners stay aligned within 1px');
   const frame=await canvas.boundingBox(),root=await p.locator('[data-world-reader]').boundingBox();
   check(frame.x>=0&&frame.y>=64&&frame.x+frame.width<=viewport.width+1&&frame.y+frame.height<=viewport.height,
    'The complete '+type+' playfield fits the viewport');
   if(viewport.width<720||viewport.height<500)check(root.x<1&&root.width>=viewport.width-1&&root.height>=viewport.height-65,
    type+' fills the phone without another device frame');
   for(const selector of ['.world-dock','.scene-settings','.world-map','[data-world-text]'])
    check(await p.locator(selector).isHidden(),'No global '+selector+' overlays '+type);
   await p.screenshot({path:art+'/'+viewport.width+'-'+type+'-ready.png'});
   await nativeActivate(p,'[data-game-start]',touch);
   check((await state()).phase==='preparing','Start produces a visible countdown');
   await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-sport-canvas]').dataset.sportState).phase==='playing');
   check(await p.locator('[data-sport-instructions]').isHidden(),'Countdown disappears during play');
   await p.screenshot({path:art+'/'+viewport.width+'-'+type+'-playing.png'});
   const before=await state();
   const iceStrip=()=>canvas.evaluate(n=>{
    const ratio=n.width/n.clientWidth,region=n.getContext('2d').getImageData(Math.round(20*ratio),Math.round(12*ratio),
     Math.round(8*ratio),n.height-Math.round(24*ratio)).data;
    return region.reduce((sum,v,i)=>sum+v*(i%19+1),0);
   });
   const iceBefore=type==='skate'?await iceStrip():null;
   {
    const direction=type==='skate'?'left':'right';
    if(touch){await nativeActivate(p,'[data-sport-steer="'+direction+'"]',true);await p.waitForTimeout(220);}
    else{
     const r=await p.locator('[data-sport-steer="'+direction+'"]').boundingBox();
     await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.waitForTimeout(220);await p.mouse.up();
    }
   }
   const moving=await state();
   if(type==='skate')check(moving.scroll>before.scroll&&await iceStrip()!==iceBefore,
    'Actual overhead ice markings scroll with the skater');
   if(type==='skate')check(moving.x<before.x&&moving.player.x<before.player.x,'Steering moves the actual painted skater');
   else check(moving.balance>before.balance&&moving.wave.crest!==before.wave.crest,'Leaning tilts the board on a moving wave');
   await pause(p);const frozen=await state();
   await p.waitForTimeout(250);check((await state()).elapsed===frozen.elapsed&&frozen.paused,'Pause freezes '+type);
   check((await state()).steer===0,'Pause clears held steering');
   const painted=await canvas.evaluate(n=>{
    const s=JSON.parse(n.dataset.sportState),ratio=n.width/n.clientWidth,c=n.getContext('2d');
    const pixel=c.getImageData(Math.round(s.player.x*ratio),Math.round(s.player.y*ratio),1,1).data;
    const background=c.getImageData(Math.round((s.player.x+s.player.radius+10)*ratio),Math.round(s.player.y*ratio),1,1).data;
    // The surfer rotates about the board: the unrotated anchor can land beside the shirt.
    // Require a solid visible shirt within the player region, not a lucky single pixel.
    let shirtPixels=0;
    if(s.type==='surf'){
     const left=Math.max(0,Math.floor((s.player.x-s.player.radius)*ratio));
     const top=Math.max(0,Math.floor((s.player.y-s.player.radius)*ratio));
     const width=Math.min(n.width-left,Math.ceil(s.player.radius*2*ratio));
     const height=Math.min(n.height-top,Math.ceil(s.player.radius*2*ratio));
     const pixels=c.getImageData(left,top,width,height).data;
     for(let i=0;i<pixels.length;i+=4)
      if(Math.abs(pixels[i]-35)<=2&&Math.abs(pixels[i+1]-75)<=2&&Math.abs(pixels[i+2]-77)<=2)shirtPixels++;
    }
    return {s,pixel:[...pixel],background:[...background],shirtPixels,ratio};
   });
   const visiblePlayer=type==='surf'?painted.shirtPixels>=30*painted.ratio**2&&
    Math.hypot(...[35,75,77].map((v,i)=>v-painted.background[i]))>20:
    Math.hypot(...painted.pixel.slice(0,3).map((v,i)=>v-painted.background[i]))>20;
   check(visiblePlayer,'The '+type+' player is visibly painted on the playfield');
   const controls=await p.locator('.sport-controls button:visible').all();
   for(const b of controls){const r=await b.boundingBox();check(r.height>=43&&r.width>=43,'Usable touch control');
    check(r.y>=frame.y+frame.height-1&&r.y+r.height<=root.y+root.height+1,'Controls stay outside the playfield');}
   await p.screenshot({path:art+'/'+viewport.width+'-'+type+'-paused.png'});
   await p.locator('[data-device-pause]').click();
   if(type==='skate'){
    // Follow the actual next gate using native keyboard holds. Never change simulation state.
    let held='';const deadline=Date.now()+18000;
    while(Date.now()<deadline){const s=await state();if(s.phase!=='playing')break;
     const target=s.passed%2?1.3:-1.3,error=(target-s.x)*6-s.velocity*2.2;
     const next=s.passed>=5?'':error<-.35?'ArrowLeft':error>.35?'ArrowRight':'';
     if(next!==held){if(held)await p.keyboard.up(held);if(next)await p.keyboard.down(next);held=next;}
     await p.waitForTimeout(65);
    }
    if(held)await p.keyboard.up(held);
    const final=await state();check(final.phase==='won'&&final.passed===5,'Native steering clears all five gates and ends at the finish');
   }else if(type==='surf'){
    let held='';const deadline=Date.now()+18000;
    while(Date.now()<deadline){const s=await state();if(s.phase!=='playing')break;
     const next=s.balance>.08?'ArrowLeft':s.balance<-.08?'ArrowRight':'';
     if(next!==held){if(held)await p.keyboard.up(held);if(next)await p.keyboard.down(next);held=next;}
     await p.waitForTimeout(65);
    }
    if(held)await p.keyboard.up(held);
    check((await state()).phase==='won'&&(await state()).elapsed>=12,'Balancing the real moving wave completes a bounded ride');
    const clear=await canvas.evaluate(n=>{
     const s=JSON.parse(n.dataset.sportState),ratio=n.width/n.clientWidth,m=s.balanceMeter;
     const pixel=n.getContext('2d').getImageData(Math.round(m.marker*ratio),Math.round(m.y*ratio),1,1).data;
     return !m.visible&&pixel[0]>170;
    });
    check(clear,'Surf result clears the inactive balance marker/caption from the actual sky');
   }
   check(await p.locator('[data-game-status]').isHidden(),'Result has no duplicate footer message');
   check(await p.locator('[data-sport-result]').isVisible()&&await p.locator('[data-game-start]').innerText()==='Retry',
    'A visible result gives a clear Retry action');
   await p.screenshot({path:art+'/'+viewport.width+'-'+type+'-won.png'});
   const done=await state();await p.waitForTimeout(150);check((await state()).elapsed===done.elapsed,'Finished game stops animating');
   await nativeActivate(p,'[data-game-start]',touch);check((await state()).score===0&&(await state()).best===done.best,'Retry resets score and preserves best');
   {
    await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-sport-canvas]').dataset.sportState).phase==='playing');
    if(type==='surf'){await p.keyboard.down('ArrowRight');}
    await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-sport-canvas]').dataset.sportState).phase==='lost');
    if(type==='surf'){
     await p.keyboard.up('ArrowRight');const fallen=await state();
     check(fallen.player.pose==='fallen'&&fallen.fallProgress===1&&
      Math.abs(fallen.player.head.x-fallen.player.x)>Math.abs(fallen.player.head.y-fallen.player.y),
      'Wipeout visibly turns the surfer sideways into the water instead of leaving them standing');
     const splash=await canvas.evaluate(n=>{
      const s=JSON.parse(n.dataset.sportState),ratio=n.width/n.clientWidth,c=n.getContext('2d');
      const y=Math.round((s.board.y+20)*ratio),strip=c.getImageData(0,y,n.width,Math.min(30*ratio,n.height-y)).data;
      let foam=0;for(let i=0;i<strip.length;i+=4)if(strip[i]>170&&strip[i+1]>190&&strip[i+2]>170)foam++;
      return foam;
     });
     check(splash>20,'The actual wipeout leaves a visible splash in the water');
    }
    check(await p.locator('[data-sport-result]').isVisible(),'A '+(type==='surf'?'wipeout':'missed gate')+' visibly ends the round');
    await p.screenshot({path:art+'/'+viewport.width+'-'+type+'-lost.png'});
   }
   await p.keyboard.press('Escape');check(await p.locator('[data-world-reader]').isHidden(),'Escape exits '+type+' to the scene');
   check(await p.locator('[data-sport-canvas]').count()===0,'Exit disposes the device game');
   check(await p.locator('.world-dock [data-world-route="contact"]').isVisible(),'Portfolio navigation returns after '+type);
  }
  check(errors.length===0,'No runtime errors: '+errors.join('; '));await p.close();
 }
 // The physical fall is brief, pauses without catch-up and stops drawing when complete.
 const motion=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'});current=motion;
 await motion.goto(url+'/#surf');
 await motion.waitForFunction(()=>document.querySelector('[data-world-reader]').dataset.object==='surf'&&
  !document.querySelector('[data-world-reader]').classList.contains('world-object-opening'));
 await nativeActivate(motion,'[data-game-start]',false);
 await motion.waitForFunction(()=>JSON.parse(document.querySelector('[data-sport-canvas]').dataset.sportState).phase==='playing');
 await motion.keyboard.down('ArrowRight');
 await motion.waitForFunction(()=>{const s=JSON.parse(document.querySelector('[data-sport-canvas]').dataset.sportState);
  return s.phase==='lost'&&s.fallProgress>0&&s.fallProgress<.8;});
 await motion.keyboard.up('ArrowRight');await motion.keyboard.press('p');
 const fallState=()=>motion.locator('[data-sport-canvas]').evaluate(n=>JSON.parse(n.dataset.sportState));
 const stopped=await fallState();await motion.waitForTimeout(200);
 check(stopped.paused&&(await fallState()).fallProgress===stopped.fallProgress,'Pause freezes the actual wipeout animation');
 await motion.screenshot({path:art+'/390-surf-mid-fall-paused.png'});
 await motion.keyboard.press('p');
 await motion.waitForFunction(()=>JSON.parse(document.querySelector('[data-sport-canvas]').dataset.sportState).fallProgress===1);
 check((await fallState()).player.pose==='fallen'&&(await fallState()).elapsed===stopped.elapsed,
  'The completed fall leaves a fallen surfer without advancing the finished game');
 const idle=await motion.locator('[data-sport-canvas]').evaluate(async n=>{
  let updates=0;const observer=new MutationObserver(()=>updates++);
  observer.observe(n,{attributes:true,attributeFilter:['data-sport-state']});
  await new Promise(r=>setTimeout(r,250));observer.disconnect();return updates;
 });
 check(idle===0,'A completed wipeout stops repainting the canvas');
 await motion.screenshot({path:art+'/390-surf-normal-result.png'});
 await motion.keyboard.press('Escape');
 check(await motion.locator('[data-sport-canvas]').count()===0,'Exit disposes the wipeout animation');await motion.close();
 console.log(name+': '+checks+' device-sports checks passed.');
}catch(error){
 if(current&&!current.isClosed()){
  console.error(await current.locator('[data-sport-canvas], [data-juggle-canvas]')
   .evaluateAll(ns=>ns.map(n=>n.dataset.sportState||n.dataset.juggleState)));
  await current.screenshot({path:art+'/sports-failure.png'});
 }
 throw error;
}finally{await browser.close();}
