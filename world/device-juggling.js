import {DeviceJugglingRound} from './juggling-round.js';
import {paintJuggling} from './juggling-paint.js';
import {loadJugglingArt} from './juggling-art.js';
import {reducedMotion} from './motion.js';
const round=new DeviceJugglingRound();
export function createDeviceJuggling({content,publish,announce,onPause,onFocus}) {
  let frame=0,last=0,wait=0,paused=false,disposed=false,kickTime=1,phase='ready',contact=null,feedback='',feedbackTime=0;
  let art=null,loading=false,loadError=false,age=0,missTime=0;
  const touchControls=matchMedia('(pointer: coarse)');
  const shortView=matchMedia('(max-height: 500px), (min-width: 720px) and (max-height: 780px)');
  function instructionsCopy(){
    if(shortView.matches)return touchControls.matches?'Tap Kick at the glow · ← / → move':'Kick / Space at the glow · ← / → move';
    if(touchControls.matches)return 'Tap Kick when the zone glows.<br>Use ← / → to follow the ball.';
    return 'Keep the ball up.<br>Kick or press Space when the zone glows.<br>Use ← / → to follow a drifting ball.';
  }
  const events=new AbortController();
  const observer=new ResizeObserver(()=>draw());
  function enter(){
    round.cancel();phase='ready';
    content.innerHTML=`<div class="juggling-device">
      <header class="juggling-hud"><span>Keep-ups <output data-game-score>0</output></span>
      <span>Best <output data-game-best>${round.best}</output></span><span data-game-level>Level 1</span></header>
      <div class="juggling-arena" data-juggle-play>
      <canvas data-juggle-canvas aria-label="A rendered player juggling a ball on the coastal futsal court"></canvas>
      <p class="juggling-instructions" data-juggle-instructions></p>
      <p class="juggling-result" data-juggle-result hidden></p></div>
      <p class="juggling-cue" data-game-status>Start when you are ready.</p>
      <div class="juggling-controls"><button type="button" data-device-pause>Pause</button>
      <button type="button" data-game-start>Start juggling</button>
      <button type="button" data-juggle-nudge="-1" aria-label="Nudge left" hidden>←</button>
      <button type="button" data-game-kick hidden>Kick</button>
      <button type="button" data-juggle-nudge="1" aria-label="Nudge right" hidden>→</button></div></div>`;
    content.querySelector('[data-game-start]').addEventListener('click',start,{signal:events.signal});
    content.querySelector('[data-game-kick]').addEventListener('click',kick,{signal:events.signal});
    content.querySelector('[data-device-pause]').addEventListener('click',onPause,{signal:events.signal});
    content.querySelector('[data-juggle-canvas]').addEventListener('pointerdown',kick,{signal:events.signal});
    content.querySelectorAll('[data-juggle-nudge]').forEach(b=>b.addEventListener('click',()=>nudge(Number(b.dataset.juggleNudge)),
      {signal:events.signal}));
    document.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('input,select,textarea,iframe')||phase!=='playing')return;
      e.preventDefault();e.stopImmediatePropagation();nudge(e.key==='ArrowLeft'?-1:1);
    },{capture:true,signal:events.signal});
    document.addEventListener('visibilitychange',()=>{stop();if(!document.hidden)request();draw();},{signal:events.signal});
    observer.observe(content);draw();publish(null);loadArt();
  }
  async function loadArt(){
    loading=true;loadError=false;draw();
    try{const loaded=await loadJugglingArt();if(!disposed)art=loaded;}
    catch{if(!disposed)loadError=true;}
    finally{if(!disposed){loading=false;draw();}}
  }
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  function request(){if(!disposed&&!paused&&!document.hidden&&!frame&&
    (['preparing','playing'].includes(phase)||phase==='lost'&&missTime<.5&&!reducedMotion()))
    frame=requestAnimationFrame(tick);}
  function start(){if(!art){if(loadError)loadArt();return;}stop();age=0;missTime=0;round.start();phase='preparing';
    wait=3;kickTime=1;contact=null;feedback='';feedbackTime=0;
    draw();onFocus();request();}
  function nudge(direction){if(paused||document.hidden||phase!=='playing')return;round.nudge(direction);draw();}
  function kick(){
    if(paused||document.hidden||phase!=='playing')return false;
    const canvas=content.querySelector('[data-juggle-canvas]'),geometry=JSON.parse(canvas.dataset.juggleState);
    const hit=round.kick();contact={...geometry.ball,hit};kickTime=0;
    feedback=hit?'':round.inReach?'Mistimed kick — wait for the glow.':'Out of reach — nudge towards the ball.';
    feedbackTime=hit?0:.65;
    if(hit)announce(round.score+' keep-ups.');else announce(feedback);
    draw();
    if(hit){const rendered=JSON.parse(canvas.dataset.juggleState);
      canvas.dataset.juggleImpact=JSON.stringify({ball:rendered.ball,toe:rendered.leg.toe,score:rendered.score});}
    request();return hit;
  }
  function tick(now){
    frame=0;if(disposed||paused||document.hidden)return;
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;age+=dt;kickTime+=dt;feedbackTime=Math.max(0,feedbackTime-dt);
    if(phase==='lost')missTime=Math.min(.5,missTime+dt);
    else if(phase==='preparing'){wait=Math.max(0,wait-dt);if(!wait)phase='playing';}
    else {round.update(dt);if(round.phase==='lost'){phase='lost';announce('Ball dropped. '+round.score+' keep-ups.');}}
    draw();request();
  }
  // Preserve interactive text nodes across animation frames: WebKit can cancel a
  // native press when its text target is replaced between mouse-down and mouse-up.
  function text(node,value){if(node.textContent!==String(value))node.textContent=String(value);}
  function html(node,value){if(node.innerHTML!==value)node.innerHTML=value;}
  function draw(){
    const canvas=content.querySelector('[data-juggle-canvas]');if(!canvas||disposed)return;
    const geometry=paintJuggling(canvas,round,{phase,kickTime,contact,art,age,missTime});
    content.dataset.artState=art?'ready':loadError?'failed':'loading';
    const canKick=phase==='playing'&&round.canKick;
    const state={type:'ball',phase,score:round.score,best:round.best,canKick,height:round.y,velocity:round.velocity,
      paused:paused||document.hidden,countdown:Math.ceil(wait),level:round.level,gravity:round.gravity,ceiling:round.ceiling,
      drift:round.vx,foot:round.foot,newBest:round.record,feedback:feedbackTime?feedback:'',...geometry};
    canvas.dataset.juggleState=JSON.stringify(state);publish(phase==='ready'?null:state);
    const score=content.querySelector('[data-game-score]'),best=content.querySelector('[data-game-best]');
    if(score.value!==String(round.score))score.value=round.score;if(best.value!==String(round.best))best.value=round.best;
    text(content.querySelector('[data-game-level]'),'Level '+(round.level+1));
    const startButton=content.querySelector('[data-game-start]'),kickButton=content.querySelector('[data-game-kick]');
    startButton.hidden=['preparing','playing'].includes(phase);
    text(startButton,!art?(loadError?'Retry artwork':'Loading court…'):phase==='lost'?'Retry':'Start juggling');
    startButton.disabled=paused;startButton.setAttribute('aria-disabled',String(loading));kickButton.hidden=phase!=='playing';kickButton.disabled=paused;
    text(kickButton,'Kick');kickButton.classList.toggle('kick-ready',canKick&&!paused);
    kickButton.setAttribute('aria-description',canKick?'Ball in reach — kick now':'Wait for the ball to descend and the court glow to turn green');
    content.querySelectorAll('[data-juggle-nudge]').forEach(b=>{b.hidden=phase!=='playing';b.disabled=paused;});
    const instructions=content.querySelector('[data-juggle-instructions]');instructions.hidden=['playing','lost'].includes(phase);
    html(instructions,!art?(loadError?'The court could not load. Retry the artwork, or return to the coast.':
      'Preparing the court and player…'):phase==='preparing'?'<strong>'+Math.ceil(wait)+'</strong>':
      instructionsCopy());
    const result=content.querySelector('[data-juggle-result]');result.hidden=phase!=='lost';
    html(result,'<strong>'+(round.record?'New best!':'Ball dropped.')+'</strong><span>'+
      (round.inReach?'Kick when the court glows green.':'Use the arrows to stay under the ball.')+'</span>');
    canvas.classList.toggle('juggle-finished',phase==='lost');
    content.querySelector('[data-game-status]').hidden=phase!=='playing';
    text(content.querySelector('[data-game-status]'),paused?'Paused':phase==='lost'?'':
      phase==='ready'?(art?'Start when you are ready.':loadError?'Artwork unavailable':'Loading artwork…'):
      phase==='preparing'?'Get ready':canKick?'Kick now':feedbackTime?feedback:
      !round.inReach?'Nudge '+(round.x>round.foot?'right':'left')+' towards the ball':'Watch the descent');
    text(content.querySelector('[data-device-pause]'),paused?'Resume':'Pause');
    content.querySelector('[data-device-pause]').disabled=phase==='ready'||phase==='lost';
    content.querySelector('[data-device-pause]').hidden=phase==='lost'||phase==='ready';
  }
  return {enter,kick,setPaused(value){paused=value;stop();draw();if(!paused)request();},update(){},
    exit(){disposed=true;stop();events.abort();observer.disconnect();round.cancel();publish(null);content.replaceChildren();}};
}
