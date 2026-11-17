export const LIGHT_PHASES=['morning','day','sunset','night'];
export const LIGHT_NAMES={auto:'Auto · Perth',morning:'Morning',day:'Daylight',sunset:'Sunset',night:'Night'};
const formatter=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function perthLight(date=new Date()){
 const parts=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));
 const minutes=Number(parts.hour)*60+Number(parts.minute),hour=Number(parts.hour);
 const phase=hour<6||hour>=19?'night':hour<11?'morning':hour<17?'day':'sunset';
 return {phase,minutes,time:parts.hour+':'+parts.minute};
}
export function sceneAsset(region,phase){
 if(!['coast','winter'].includes(region)||!LIGHT_PHASES.includes(phase))throw Error('Invalid scene lighting');
 return 'concept-'+region+(phase==='night'?'-dusk-v2':phase==='sunset'?'-v2':'-day-v1')+'.webp';
}
export function lightChoice(){
 const query=new URLSearchParams(location.search).get('light');
 if(query==='auto'||LIGHT_PHASES.includes(query))return query;
 try{const saved=localStorage.getItem('portfolio-light');if(saved==='auto'||LIGHT_PHASES.includes(saved))return saved;}catch{}
 return 'auto';
}
export function initialLight(){const choice=lightChoice();return {choice,phase:choice==='auto'?perthLight().phase:choice};}
export function createSceneClock({apply,changed=()=>{},failed=()=>{},now=()=>new Date(),
 initial=initialLight(),hostDocument=document,timers={setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id)}}){
 let {choice,phase}=initial,version=0,disposed=false,timer=0,loading=null;
 const state=()=>({choice,phase,time:perthLight(now()).time,perthPhase:perthLight(now()).phase,pending:loading});
 const notify=()=>changed(state());
 async function select(next,{automatic=false}={}){
  if(disposed||!(next==='auto'||LIGHT_PHASES.includes(next)))return false;
  const token=++version,target=next==='auto'?perthLight(now()).phase:next,needed=target!==phase||loading!==null;
  loading=next;notify();
  try{
   if(needed)await apply(target);
   if(disposed||token!==version)return false;
   choice=next;phase=target;loading=null;
   if(!automatic)try{localStorage.setItem('portfolio-light',choice);}catch{}
   notify();return true;
  }catch(error){if(!disposed&&token===version){loading=null;notify();failed(error);}return false;}
 }
 function schedule(){
  timers.clearTimeout(timer);if(disposed||hostDocument.hidden)return;
  timer=timers.setTimeout(()=>{if(choice==='auto')select('auto',{automatic:true});else notify();schedule();},60000);
 }
 const visible=()=>{if(!hostDocument.hidden){if(choice==='auto')select('auto',{automatic:true});notify();}schedule();};
 hostDocument.addEventListener('visibilitychange',visible);
 if(choice==='auto'&&perthLight(now()).phase!==phase)select('auto',{automatic:true});
 notify();schedule();
 return {select,state,dispose(){disposed=true;++version;timers.clearTimeout(timer);hostDocument.removeEventListener('visibilitychange',visible);}};
}
