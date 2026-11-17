import {reducedMotion} from './motion.js';
// A composited snapshot travels while the real close-up loads behind it.
export function createSceneTravel(host,finished){
 const events=new AbortController();let sheet=null,motion=null,fade=null,started=0,token=0,source='';
 function cancel(){++token;motion?.cancel();fade?.cancel();sheet?.remove();sheet=null;motion=null;fade=null;
  delete host.dataset.sceneTravel;delete document.body.dataset.sceneTravelling;}
 function start(id,canvas){
  cancel();if(reducedMotion())return;
  const object=document.querySelector('[data-scene-object="'+id+'"]:not([hidden])');if(!object)return;
  const dot=object.querySelector('.scene-object-dot').getBoundingClientRect(),box=host.getBoundingClientRect();
  sheet=document.createElement('canvas');sheet.className='scene-travel';sheet.setAttribute('aria-hidden','true');
  sheet.width=canvas.width;sheet.height=canvas.height;
  try{sheet.getContext('2d').drawImage(canvas,0,0);}catch{sheet=null;return;}
  host.append(sheet);source=id;started=performance.now();host.dataset.sceneTravel='approaching';
  document.body.dataset.sceneTravelling='true';
  const x=dot.x+dot.width/2-box.x,y=dot.y+dot.height/2-box.y,scale=box.width<720?1.25:1.55;
  sheet.style.transformOrigin=x+'px '+y+'px';
  const dx=(box.width/2-x)*.14,dy=(box.height*.5-y)*.14;
  motion=sheet.animate([{transform:'translate(0,0) scale(1)'},{transform:'translate('+dx+'px,'+dy+'px) scale('+scale+')'}],
   {duration:260,easing:'cubic-bezier(.2,.65,.25,1)',fill:'forwards'});
 }
 async function reveal(){
  if(!sheet)return;const current=token;
  try{await motion.finished;}catch{return;}
  if(current!==token||!sheet)return;
  host.dataset.sceneTravel='revealing';
  fade=sheet.animate([{opacity:1},{opacity:0}],{duration:100,fill:'forwards'});
  try{await fade.finished;}catch{return;}
  if(current!==token)return;cancel();finished();
 }
 const stop=()=>{if(sheet){cancel();finished();}};
 window.addEventListener('resize',stop,{signal:events.signal});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},{signal:events.signal});
 return {start,reveal,cancel,refresh(){if(reducedMotion())stop();},running:()=>!!sheet,
  state:()=>({active:!!sheet,source,elapsed:sheet?Math.round(performance.now()-started):0}),
  dispose(){cancel();events.abort();}};
}
