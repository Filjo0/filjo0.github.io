import {markerContrast} from './marker-contrast-evidence.mjs';
async function readMarkerState(page){
 return page.evaluate(async()=>{
  const layout=await (await fetch('assets/outdoor/hotspot-layout.json')).json();
  const host=document.querySelector('[data-world-render]').getBoundingClientRect();
  const header=document.querySelector('.world-header').getBoundingClientRect(),dock=document.querySelector('.world-dock').getBoundingClientRect();
  const nav=document.querySelector('.scene-hotspots'),pan=document.querySelector('[data-scene-framing]');
  const inspector=document.querySelector('.scene-quality-panel:not([hidden]):has([data-inspect-expand][aria-expanded="false"])');
  const matrix=document.querySelector('.scene-object-effects defs g[id$="-plate"]').transform.baseVal.consolidate().matrix;
  const box=n=>n.getBoundingClientRect().toJSON();
  const swatch=document.createElement('canvas');swatch.width=swatch.height=1;const paint=swatch.getContext('2d');
  return {region:document.body.dataset.worldRegion,ready:nav.dataset.markerLayout,stems:nav.dataset.markerStems,host:host.toJSON(),header:header.toJSON(),dock:dock.toJSON(),
   fontLoaded:[...document.fonts].some(face=>face.family.includes('Zalando Sans Expanded')&&face.status==='loaded'),
   diagnostic:{at:performance.now(),projection:nav.dataset.markerProjection,host:{...document.querySelector('[data-world-render]').dataset},
    canvas:JSON.parse(document.querySelector('[data-world-render] canvas').dataset.worldState),
    plate:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f],solver:globalThis.__markerSolverProbe||null,
    animations:document.getAnimations().map(a=>({target:a.effect?.target?.getAttribute('class'),tag:a.effect?.target?.tagName,playState:a.playState,currentTime:a.currentTime,name:a.animationName,property:a.transitionProperty,keyframes:a.effect?.getKeyframes()}))},
   pan:pan.hidden?null:box(pan),inspector:inspector?box(inspector):null,objects:[...nav.querySelectorAll('[data-scene-object]')].filter(n=>!n.hidden).map(n=>{
    const dot=n.querySelector('.scene-object-dot'),label=n.querySelector('.scene-marker-name'),target=n.querySelector('.scene-object-label');
    const stemNode=n.querySelector('.scene-marker-stem'),buttonBox=n.getBoundingClientRect();
    // data-stem holds the drawn ends relative to the marker button.
    const ends=(stemNode?.dataset.stem||'').split(',').map(Number);
    const stem=ends.length===4&&ends.every(Number.isFinite)?{shown:!stemNode.hidden&&getComputedStyle(stemNode).display!=='none',
     start:[buttonBox.x+ends[0],buttonBox.y+ends[1]],end:[buttonBox.x+ends[2],buttonBox.y+ends[3]],
     length:Math.hypot(ends[2]-ends[0],ends[3]-ends[1])}:null;
    if(stem?.shown){const box=stemNode.getBoundingClientRect(),xs=[stem.start[0],stem.end[0]],ys=[stem.start[1],stem.end[1]];
     // The painted stem must actually span its recorded ends (within its 2px width).
     stem.painted=box.left<=Math.min(...xs)+1.5&&box.right>=Math.max(...xs)-1.5&&box.top<=Math.min(...ys)+1.5&&box.bottom>=Math.max(...ys)-1.5;}
    const d=box(dot),r=box(label),centre=[d.x+d.width/2,d.y+d.height/2],style=getComputedStyle(label);
    paint.clearRect(0,0,1,1);paint.fillStyle=style.backgroundColor;paint.fillRect(0,0,1,1);
    const surface=[...paint.getImageData(0,0,1,1).data];
    const range=document.createRange();range.selectNodeContents(label.querySelector(".scene-marker-text"));
    const actual=layout.targets[n.dataset.sceneObject],original=new DOMPoint(actual.anchor[0]*1672,actual.anchor[1]*941).matrixTransform(matrix);
    const path=document.querySelector('[data-scene-outline="'+n.dataset.sceneObject+'"]'),local=new DOMPoint(centre[0]-host.x,centre[1]-host.y);
    let distance=path.isPointInFill(local)?0:Infinity;
    if(distance)for(let i=0,len=path.getTotalLength();i<=len;i+=.5){
     const p=path.getPointAtLength(i);distance=Math.min(distance,Math.hypot(p.x-local.x,p.y-local.y));
    }
    let edgeGap=Infinity;
    for(let i=0,len=path.getTotalLength();i<=len;i+=1){
     const point=path.getPointAtLength(i),px=point.x+host.x,py=point.y+host.y;
     edgeGap=Math.min(edgeGap,Math.hypot(Math.max(r.x-px,0,px-r.right),Math.max(r.y-py,0,py-r.bottom)));
    }
    return {id:n.dataset.sceneObject,disabled:n.disabled,name:label.textContent,accessible:n.getAttribute('aria-label'),
     anchorHidden:getComputedStyle(dot).opacity==='0',dotColor:getComputedStyle(dot).backgroundColor,uppercase:style.textTransform==='uppercase',iconVisible:[...label.querySelectorAll('svg')].some(n=>getComputedStyle(n).display!=='none'),iconCount:label.querySelectorAll("svg.scene-tab-icon").length,shadow:style.textShadow,dot:d,pill:r,target:box(target),button:box(n),original:[host.x+original.x,host.y+original.y],distance,edgeGap,
     nativeStyles:{button:n.style.cssText,dot:dot.style.cssText,label:target.style.cssText,
      buttonComputed:{top:getComputedStyle(n).top,left:getComputedStyle(n).left,width:getComputedStyle(n).width,transform:getComputedStyle(n).transform,transition:getComputedStyle(n).transition,animation:getComputedStyle(n).animation},
      dotComputed:{top:getComputedStyle(dot).top,left:getComputedStyle(dot).left,transform:getComputedStyle(dot).transform}},
     font:Number.parseFloat(style.fontSize),family:style.fontFamily,weight:Number(style.fontWeight),
     surface,glass:style.backdropFilter||style.webkitBackdropFilter,border:style.borderWidth,pillShadow:style.boxShadow,color:style.color,background:style.backgroundColor,opacity:getComputedStyle(target).opacity,
     textBox:range.getBoundingClientRect().toJSON(),
     stem,side:n.dataset.markerSide,state:n.dataset.hotspotState,
     dotHit:document.elementFromPoint(...centre)?.closest('[data-scene-object]')===n,
     pillHit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-scene-object]')===n};
   })};
 });
}
export async function markerEvidence(page,check,{native=true}={}){
 const state=await readMarkerState(page);
 try{
 const measuredContrast=await markerContrast(page);
 for(const m of state.objects){const c=measuredContrast.find(c=>c.id===m.id);m.contrast=c?.minimum;m.contrastSamples=c?.samples;}
 const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
 check(state.ready==='ready','All currently enabled scene objects have a resolved marker layout');
 check(state.objects.length>0,'The view has discoverable objects without any pointer interaction');
 check(state.fontLoaded,'The locally hosted extended marker typeface is loaded');
 const names={work:'My apps',contact:'Contact',resume:'R\u00e9sum\u00e9',experience:'About',books:'Book',fibonacci:'Maths',
  globe:'Globe',aqua:'Aqua Local',futsl:'FUTSL'};
 for(const m of state.objects){
  check(m.name===names[m.id],m.id+': the permanent label uses its approved name and intact accents');
  const p=m.pill,t=m.target,d=m.dot;
  check(!m.disabled&&m.opacity==='1',m.id+': dot and name stay enabled and visible at rest');
  check(!m.anchorHidden&&m.dotColor==='rgb(255, 255, 255)'&&!m.iconVisible&&m.uppercase&&m.shadow==='none',m.id+': a visible white dot and a compact uppercase name pill');
  check(m.accessible.includes(m.name),m.id+': visible words are included in its accessible name');
  check(m.font>=13&&m.contrastSamples>=15&&m.contrast>=4.5,m.id+': native text/glow contrast '+m.contrast?.toFixed(2));
  check(m.weight===500&&m.family.includes('Zalando Sans Expanded'),m.id+': the name uses the approved extended medium face');
  check(m.border==='0px'&&m.pillShadow!=='none'&&m.color==='rgb(0, 0, 0)',
   m.id+': the borderless pill has black extended lettering and a soft lifting shadow');
  check(m.surface[0]>=250&&m.surface[1]>=245&&m.surface[2]>=235&&m.surface[3]>=170&&m.surface[3]<=(m.state==='none'?215:240)&&/blur\(/.test(m.glass),
   m.id+': a frosted, warm-white glass surface shows the scene through a soft backdrop');
  // The stem joins the dot to its own name, so every name visibly belongs to one object.
  const s=m.stem,dc=[d.x+d.width/2,d.y+d.height/2];
  const nearPill=s&&Math.hypot(Math.max(p.x-s.end[0],0,s.end[0]-p.right),Math.max(p.y-s.end[1],0,s.end[1]-p.bottom))<=1.5;
  // Only a layout the solver reports as cramped ('crossing') may drop a stem; that name still sits
  // beside its own object (edge gap check below), as in the earlier stemless design.
  check(s&&(s.shown?s.painted&&Math.hypot(s.start[0]-dc[0],s.start[1]-dc[1])<=10.5&&nearPill:
   Math.hypot(Math.max(p.x-dc[0],0,dc[0]-p.right),Math.max(p.y-dc[1],0,dc[1]-p.bottom))<=12||state.stems==='crossing'),
   m.id+': a stem joins its dot to its own name');
  if(state.host.width>=600||state.host.height>=330)check(state.stems==='clear',m.id+': every stem avoids every name at this size');
  for(const o of state.objects)if(o.id!==m.id&&s?.shown){
   const q=o.pill,steps=Math.ceil(s.length/2);let crosses=false;
   for(let i=0;i<=steps;i++){const t=steps?i/steps:0,x=s.start[0]+(s.end[0]-s.start[0])*t,y=s.start[1]+(s.end[1]-s.start[1])*t;
    if(x>q.x+1&&x<q.right-1&&y>q.y+1&&y<q.bottom-1)crosses=true;}
   check(!crosses,m.id+': its stem never runs through the '+o.id+' name');
  }
  check(p.x>=state.host.x+7.9&&p.right<=state.host.right-7.9&&p.y>=state.header.bottom+7.9&&
   p.bottom<=(state.dock.top>state.header.bottom?state.dock.top:state.host.bottom)-7.9,m.id+': the whole pill stays on screen');
  if(state.host.width>=360||state.host.height<760)check(m.font>=13,m.id+': standard layouts retain at least 13px type');
  check(t.width>=44&&t.height>=44&&m.button.width>=44&&m.button.height>=44,m.id+': the combined native marker has a real touch target');
  check(d.x>=0&&d.right<=state.host.right&&d.y>=state.header.bottom&&
   d.bottom<=(state.dock.top>state.header.bottom?state.dock.top:state.host.bottom),m.id+': the dot never clips into navigation');
  const x=d.x+d.width/2,y=d.y+d.height/2;
  check(m.edgeGap<=52.5,m.id+': the name remains next to its object edge');
  check(['above','below','beside'].includes(m.side),m.id+': the marker records which side of its dot the name sits');
  check(m.distance<.75,m.id+': the dot is actually on the photographed object');
  if(m.original[0]>=11&&m.original[0]<=state.host.right-11&&m.original[1]>=state.header.bottom+11&&
   m.original[1]<=(state.dock.top>state.header.bottom?state.dock.top:state.host.bottom)-11)
   check(Math.hypot(m.original[0]-x,m.original[1]-y)<1,m.id+': an unclipped anchor stays within 1px (expected '+m.original.join(',')+'; actual '+[x,y].join(',')+'; delta '+Math.hypot(m.original[0]-x,m.original[1]-y)+')');
  check(m.dotHit&&m.pillHit,m.id+': both the actual dot and pill receive the correct native hit');
  if(state.pan)check(!overlap(t,state.pan),m.id+': the marker never covers the pan button');
  if(state.inspector)check(!overlap(t,state.inspector),m.id+': the whole marker stays clear of the compact Inspect panel');
  for(const o of state.objects){
   if(o.id!==m.id)check(!overlap(t,o.target),m.id+': no overlapping marker targets with '+o.id);
   const intersects=await page.locator('[data-scene-outline="'+o.id+'"]').evaluate((path,{p,host})=>{
    for(let y=p.y;y<=p.bottom;y+=2)for(let x=p.x;x<=p.right;x+=2)
     if(path.isPointInFill(new DOMPoint(x-host.x,y-host.y)))return true;
    return false;
   },{p,host:state.host});
   check(!intersects,m.id+': its name never covers the pictured '+o.id);
  }
 }
 if(native)check(await page.locator('.scene-label-connector,.scene-connector-edge').count()===0,'No legacy SVG label connectors remain; stems live inside each marker');

 return state;
 }catch(error){
  Object.defineProperty(error,'markerEvidence',{value:{captured:state,current:await readMarkerState(page).catch(e=>({error:e.message}))}});
  throw error;
 }
}
