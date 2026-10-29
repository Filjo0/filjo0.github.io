import {reducedMotion} from './motion.js';
import {SkatingRun} from '../world-state.js';
import {SurfRide} from './logic/surf.js';
import {paintDeviceSport} from './sports-paint.js';

const best={skate:0,surf:0};
const descriptions={
  skate:{title:'Skating',score:'Gates',start:'Start skating',tip:'Hold ← / → to glide through five glowing gates. Release early to coast.'},
  surf:{title:'Surfing',score:'Ride',start:'Catch a wave',tip:'Hold ← / → against the drift. Keep the balance marker in the centre for 12 seconds.'}
};
// Screen games reuse the existing tested simulations. No actor is placed over the photograph.
export function createDeviceSport({type,content,publish,announce,onPause,onFocus}){
  const model=type==='skate'?new SkatingRun():new SurfRide(),copy=descriptions[type];
  const events=new AbortController(),held=new Set();
  let phase='ready',frame=0,last=0,wait=0,paused=false,disposed=false,cooldown=0,previousBest=best[type];
  let pulse=0,pulseTime=0,fallTime=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fallDuration=.6;
  const observer=new ResizeObserver(()=>draw());
  const text=(node,value)=>{if(node.textContent!==String(value))node.textContent=String(value);};
  const steer=()=>held.has('right')||held.has('left')?Number(held.has('right'))-Number(held.has('left')):pulseTime>0?pulse:0;
  const ended=()=>['lost','won'].includes(phase);
  const score=()=>type==='skate'?model.passed:Math.floor(model.elapsed*10)/10;
  function enter(){
    content.innerHTML=`<div class="juggling-device sport-device" data-sport-device="${type}">
      <header class="juggling-hud"><span>${copy.score} <output data-game-score>0</output>${type==='surf'?' / 12 s':' / 5'}</span>
      <span>Best <output data-game-best>${best[type]}</output></span></header>
      <div class="juggling-arena sport-arena"><canvas data-sport-canvas aria-label="${copy.title} game playfield"></canvas>
      <p class="juggling-instructions" data-sport-instructions></p>
      <p class="juggling-result" data-sport-result hidden><strong></strong><span></span></p></div>
      <p class="juggling-cue" data-game-status></p>
      <div class="juggling-controls sport-controls"><button type="button" data-device-pause>Pause</button>
      <button type="button" data-game-start>${copy.start}</button>
      ${
      '<button type="button" data-sport-steer="left" aria-label="'+(type==='skate'?'Steer':'Lean')+' left" hidden>← Left</button>'+
      '<button type="button" data-sport-steer="right" aria-label="'+(type==='skate'?'Steer':'Lean')+' right" hidden>Right →</button>'}
      </div></div>`;
    content.querySelector('[data-game-start]').addEventListener('click',start,{signal:events.signal});
    content.querySelector('[data-device-pause]').addEventListener('click',onPause,{signal:events.signal});
    content.querySelectorAll('[data-sport-steer]').forEach(button=>{
      const name='pointer:'+button.dataset.sportSteer;let pressedAt=0,pointerFinished=false;
      button.addEventListener('pointerdown',e=>{
        if(paused||phase!=='playing')return;
        e.preventDefault();pressedAt=performance.now();pointerFinished=false;button.setPointerCapture(e.pointerId);held.add(name);syncPointer();request();
      },{signal:events.signal});
      const release=e=>{
        const completed=e?.type==='pointerup'&&held.has(name);
        if(completed)pointerFinished=true;
        held.delete(name);syncPointer();
        // A completed short touch must work even when preventDefault suppresses click.
        if(completed&&performance.now()-pressedAt<180&&!paused&&phase==='playing'&&!document.hidden){
          pulse=button.dataset.sportSteer==='left'?-1:1;pulseTime=.18;request();
        }
        draw();
      };
      button.addEventListener('click',e=>{
        if(pointerFinished&&(e.detail||e.pointerType)){pointerFinished=false;return;}
        if(paused||phase!=='playing'||document.hidden)return;
        pulse=button.dataset.sportSteer==='left'?-1:1;pulseTime=.18;draw();request();
      },{signal:events.signal});
      for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])
        button.addEventListener(event,release,{signal:events.signal});
      button.addEventListener('keydown',e=>{
        if(!['Space','Enter'].includes(e.code)||paused||phase!=='playing')return;
        e.preventDefault();held.add(name);syncPointer();request();
      },{signal:events.signal});
      button.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code))release();},{signal:events.signal});
    });
    document.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight'].includes(e.code)||phase!=='playing'||paused||
        e.target.closest('input,select,textarea,iframe')||e.altKey||e.ctrlKey||e.metaKey)return;
      e.preventDefault();e.stopImmediatePropagation();held.add(e.code);syncPointer();request();
    },{capture:true,signal:events.signal});
    document.addEventListener('keyup',e=>{held.delete(e.code);syncPointer();draw();},{signal:events.signal});
    window.addEventListener('blur',()=>{held.clear();pulseTime=0;stop();draw();},{signal:events.signal});
    window.addEventListener('focus',()=>{request();},{signal:events.signal});
    document.addEventListener('visibilitychange',()=>{held.clear();pulseTime=0;stop();draw();if(!document.hidden)request();},{signal:events.signal});
    reduced.addEventListener('change',()=>{
      if(type==='surf'&&phase==='lost'){stop();draw();request();}
    },{signal:events.signal});
    observer.observe(content);draw();publish(null);
  }
  function syncPointer(){
    held.delete('left');held.delete('right');
    if(held.has('pointer:left')||held.has('ArrowLeft'))held.add('left');
    if(held.has('pointer:right')||held.has('ArrowRight'))held.add('right');
  }
  function stop(){cancelAnimationFrame(frame);frame=0;last=0;}
  function request(){
    const falling=type==='surf'&&phase==='lost'&&fallTime<fallDuration&&!reducedMotion();
    const running=falling||phase==='preparing'||phase==='playing';
    if(!disposed&&!paused&&!document.hidden&&!frame&&running)frame=requestAnimationFrame(tick);
  }
  function start(){
    stop();held.clear();pulseTime=0;fallTime=0;model.start();phase='preparing';wait=3;cooldown=0;previousBest=best[type];
    draw();onFocus();request();
  }
  function tick(now){
    frame=0;if(disposed||paused||document.hidden)return;
    const dt=last?Math.min((now-last)/1000,.04):0;last=now;cooldown=Math.max(0,cooldown-dt);pulseTime=Math.max(0,pulseTime-dt);
    if(type==='surf'&&phase==='lost')fallTime=Math.min(fallDuration,fallTime+dt);
    else if(phase==='preparing'){wait=Math.max(0,wait-dt);if(!wait)phase='playing';}
    else{
      model.step(dt,steer());phase=model.phase;best[type]=Math.max(best[type],score());
      if(ended()){held.clear();pulseTime=0;announce(resultTitle()+'. '+resultTip());}
    }
    draw();request();
  }
  function resultTitle(){
    if(phase==='won')return type==='skate'?'Five gates cleared!':type==='surf'?'Wave complete!':'Wave complete!';
    return type==='skate'?'Gate missed': 'Wipeout';
  }
  function resultTip(){
    if(phase==='won')return score()>previousBest?'New best! Play again when you are ready.':'Play again when you are ready.';
    return type==='skate'?'Aim for the next green gate; release early to glide.':'Lean against the drift to keep the marker centred.';
  }
  function draw(){
    const canvas=content.querySelector('[data-sport-canvas]');if(!canvas||disposed)return;
    if(type==='surf'&&phase==='lost'&&reducedMotion())fallTime=fallDuration;
    const geometry=paintDeviceSport(canvas,type,model,{fallProgress:fallTime/fallDuration});
    const state={type,phase,paused:paused||document.hidden,countdown:Math.ceil(wait),elapsed:model.elapsed,
      score:score(),best:best[type],passed:model.passed,x:model.x,z:model.z,velocity:model.velocity,
      balance:model.balance,steer:steer(),...geometry};
    canvas.dataset.sportState=JSON.stringify(state);publish(phase==='ready'?null:state);
    text(content.querySelector('[data-game-score]'),score());text(content.querySelector('[data-game-best]'),best[type]);
    const startButton=content.querySelector('[data-game-start]');startButton.hidden=['preparing','playing'].includes(phase);
    text(startButton,ended()?'Retry':copy.start);startButton.disabled=paused;
    const pause=content.querySelector('[data-device-pause]');pause.hidden=ended();pause.disabled=phase==='ready';
    text(pause,paused?'Resume':'Pause');
    content.querySelectorAll('[data-sport-steer]').forEach(b=>{b.hidden=phase!=='playing';b.disabled=paused;});
    const instructions=content.querySelector('[data-sport-instructions]');instructions.hidden=phase!=='ready'&&phase!=='preparing';
    text(instructions,phase==='preparing'?String(Math.ceil(wait)):copy.tip);
    const result=content.querySelector('[data-sport-result]');result.hidden=!ended();
    text(result.querySelector('strong'),resultTitle());text(result.querySelector('span'),resultTip());
    const cue=content.querySelector('[data-game-status]');cue.hidden=ended();
    text(cue,paused?'Paused':phase==='ready'?'Start when you are ready.':phase==='preparing'?'Get ready':
      type==='skate'?'Hold to steer · release to glide':Math.abs(model.balance)<.15?'Balanced':
      model.balance>0?'Lean left':'Lean right');
    canvas.classList.toggle('juggle-finished',ended());
  }
  return {enter,setPaused(value){paused=value;held.clear();pulseTime=0;stop();draw();if(!paused)request();},update(){},
    exit(){disposed=true;stop();held.clear();events.abort();observer.disconnect();model.reset();publish(null);content.replaceChildren();}};
}
