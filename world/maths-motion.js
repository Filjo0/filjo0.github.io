import {reducedMotion} from './motion.js';

// Finite tap-triggered animation; no frames are requested while idle or hidden.
export function createMathsMotion(paint,complete) {
  let duration=0,elapsed=0,last=0,frame=0,paused=false,events=null,running=false;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;last=0;};
  const request=()=>{if(events&&running&&!paused&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);};
  function finish(){paint(1);running=false;stop();complete();}
  function tick(now) {
    frame=0;if(!running||!events||paused||document.hidden){last=0;return;}
    if(reducedMotion()){finish();return;}
    elapsed+=last?Math.min((now-last)/1000,.1):0;last=now;
    if(elapsed>=duration){finish();return;}
    paint(elapsed/duration);request();
  }
  return {
    enter(){events=new AbortController();paused=false;
      document.addEventListener('visibilitychange',()=>{stop();request();},{signal:events.signal});
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{
        if(running&&reducedMotion())finish();
      },{signal:events.signal});},
    start(seconds){stop();duration=seconds;elapsed=0;running=true;if(reducedMotion())finish();else{paint(0);request();}},
    setPaused(value){paused=value;stop();request();},
    update(){if(running&&reducedMotion())finish();},
    running:()=>running,
    cancel(){stop();running=false;},
    exit(){stop();running=false;events?.abort();events=null;}
  };
}
