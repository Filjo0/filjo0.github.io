import {QUALITY_SOURCE_DIGEST} from './quality-build.js';
import {qualityStats} from './quality-record.js';
const roles={work:'Laptop → My apps',contact:'Phone → Contact',resume:'Clipboard → Résumé',experience:'Bag → About',
 books:'Book stack → Reading',fibonacci:'Notebook → Maths',globe:'Snow globe → Season',aqua:'Pool → Aqua Local',futsl:'Pitch → FUTSL'};
export function createSceneInspector(header,{signal,onChange=()=>{}}={}){
 const own=new AbortController(),wrap=document.createElement('div');wrap.className='scene-inspector';
 wrap.innerHTML='<button type="button" class="scene-inspect-toggle" data-scene-inspect aria-label="Inspect portfolio quality" '+
  'aria-pressed="false" '+
  'aria-controls="scene-quality-panel">'+
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">'+
  '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg><span>Inspect</span></button>'+
  '<aside id="scene-quality-panel" class="scene-quality-panel" hidden aria-label="Portfolio quality inspection">'+
  '<header><h2><button type="button" class="quality-disclosure" data-inspect-expand aria-expanded="true" '+
  'aria-controls="scene-quality-details">How this site is tested '+
  '<svg class="nav-icon quality-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '+
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+
  '<path d="m6 9 6 6 6-6"/></svg></button></h2>'+
  '<button type="button" data-inspect-close aria-label="Close inspection">×</button></header>'+
  '<div id="scene-quality-details" class="quality-details">'+
  '<p class="quality-object" data-quality-object>Outlines show where each object opens.</p>'+
  '<div data-quality-evidence role="status">Loading recorded checks…</div></div>'+
  '</aside>';
 header.querySelector('.scene-settings').before(wrap);
 const button=wrap.querySelector('[data-scene-inspect]'),panel=wrap.querySelector('aside'),evidence=wrap.querySelector('[data-quality-evidence]');
 const disclosure=wrap.querySelector('[data-inspect-expand]'),detailsBody=wrap.querySelector('.quality-details');
 let data=null,pending=null,disposed=false;
 function expand(value){
  detailsBody.hidden=!value;disclosure.setAttribute('aria-expanded',String(value));
 }
 disclosure.addEventListener('click',()=>expand(detailsBody.hidden),{signal:own.signal});
 function describe(id){
  const found=data?.objects?.[id];
  wrap.querySelector('[data-quality-object]').textContent=roles[id]?
   roles[id]+(found?' · checked at '+found.viewports+' visible screen sizes.':'.'): 'Outlines show where each object opens.';
 }
 async function load(){
  if(data||pending)return;
  pending=fetch(new URL('../assets/quality-evidence.json',import.meta.url),{signal:own.signal}).then(r=>{
   if(!r.ok)throw Error('Evidence unavailable');return r.json();
  }).then(value=>{
   if(disposed)return;
   const verified=qualityStats(value,QUALITY_SOURCE_DIGEST);data=value;
   evidence.replaceChildren();const date=document.createElement('p');date.className='quality-date';
   date.textContent='Local checks · '+new Date(data.recordedAt).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
   evidence.append(date);
   const stats=document.createElement('div');stats.className='quality-stats';
   const entries=[[verified.suites,'suites in Chromium'],[verified.viewports,'screen sizes']];
   for(const [count,label] of entries){const item=document.createElement('div'),number=document.createElement('strong');
    number.textContent=count;item.append(number,document.createTextNode(label));stats.append(item);}
   evidence.append(stats);const engines=document.createElement('p');engines.className='quality-engine-scope';
   engines.textContent='Marker and scene checks also run in WebKit (Safari’s engine).';evidence.append(engines);
   const details=document.createElement('details'),summary=document.createElement('summary');
   summary.textContent='Test record and limits';details.append(summary);const list=document.createElement('ul');
   for(const c of data.checks){const item=document.createElement('li');item.textContent=c.label+' · '+c.passed+' passed';list.append(item);}
   details.append(list);const build=document.createElement('small');build.textContent='Source fingerprint '+data.sourceDigest.slice(0,12);
   details.append(build);const scope=document.createElement('p');scope.className='quality-scope';
   scope.textContent=data.scope+'. Real-device testing and production deployment are separate.';details.append(scope);evidence.append(details);

  }).catch(()=>{if(!disposed){evidence.textContent='Test summary unavailable';pending=null;}});
 }
 function close(restore=false){
  if(panel.hidden)return;panel.hidden=true;button.setAttribute('aria-pressed','false');delete document.body.dataset.inspecting;
  onChange(false);if(restore)button.focus({preventScroll:true});
 }
 button.addEventListener('click',()=>{
  if(!panel.hidden){close();return;}
  expand(!matchMedia('(max-width:959px)').matches);
  panel.hidden=false;button.setAttribute('aria-pressed','true');document.body.dataset.inspecting='true';onChange(true);load();
 },{signal:own.signal});
 wrap.querySelector('[data-inspect-close]').addEventListener('click',()=>close(true),{signal:own.signal});
 for(const type of ['pointerover','focusin'])document.addEventListener(type,e=>{
  if(panel.hidden)return;
  const id=e.target.closest?.('[data-scene-object]')?.dataset.sceneObject;
  const focused=document.activeElement?.closest?.('[data-scene-object]')?.dataset.sceneObject;
  describe(id||focused);
 },{signal:own.signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopImmediatePropagation();close(true);}},
  {signal:own.signal,capture:true});
 document.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-settings-toggle]'))close();},{signal:own.signal});
 const dispose=()=>{disposed=true;close();own.abort();wrap.remove();};signal?.addEventListener('abort',dispose,{once:true});
 return {close,dispose};
}
