import {projectPlateRing} from './concept-layout.js';
import {navIcon} from './scene-icons.js';
import {reducedMotion} from './motion.js';
import {MORNING_GRADE} from './scene-lighting.js';
import {bounds,clipRing,shapePath} from './scene-object-geometry.js';
import {placeMarkers,markerVisible} from './scene-marker-layout.js';

const NS='http://www.w3.org/2000/svg';let instance=0;
const names={work:'My apps',contact:'Contact',resume:'Résumé',experience:'About',books:'Book',fibonacci:'Maths',
  globe:'Winter',aqua:'Aqua Local',futsl:'FUTSL'};
const accessible={work:'My apps',experience:'About',books:'Book · Find a reading',fibonacci:'Maths notebook',
  globe:'Winter · Change season with the snow globe',aqua:'Aqua Local · Pool',futsl:'FUTSL · Pitch'};
const svg=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};

// A photographed silhouette, its dot and its name share one native accessible control.
export function createSceneHotspots(host,onObject,view,render) {
  const events=new AbortController(),{signal}=events,prefix='scene-outlines-'+(++instance);
  const layer=document.createElement('nav');layer.hidden=true;layer.className='scene-hotspots';
  layer.setAttribute('aria-label','Objects in this scene');host.after(layer);
  const effects=svg('svg',{'class':'scene-object-effects','aria-hidden':'true'}),defs=svg('defs');effects.append(defs);layer.append(effects);
  // Explicit sRGB primitives avoid the engines' different CSS brightness handling on SVG use.
  const lightFilter=svg('filter',{id:prefix+'-lift',filterUnits:'userSpaceOnUse',x:0,y:0,'color-interpolation-filters':'sRGB'});
  const transfer=svg('feComponentTransfer'),channels=['feFuncR','feFuncG','feFuncB'].map(name=>svg(name,{type:'linear',slope:1.2}));
  transfer.append(...channels);lightFilter.append(transfer);defs.append(lightFilter);
  const photo=svg('g',{id:prefix+'-plate'}),old=svg('g'),current=svg('g');
  const photoImage=()=>svg('image',{width:1672,height:941});
  const oldCoast=photoImage(),oldWinter=photoImage(),currentCoast=photoImage(),currentWinter=photoImage();
  old.append(oldCoast,oldWinter);current.append(currentCoast,currentWinter);photo.append(old,current);defs.append(photo);
  const morningFilter=svg('filter',{id:prefix+'-morning','color-interpolation-filters':'linearRGB'});
  const {scale,offset}=MORNING_GRADE;
  morningFilter.append(svg('feColorMatrix',{type:'matrix',values:[
    scale[0],0,0,0,offset[0],0,scale[1],0,0,offset[1],0,0,scale[2],0,offset[2],0,0,0,1,0].join(' ')}));
  defs.append(morningFilter);
  const framing=document.createElement('button');framing.type='button';framing.className='scene-framing';framing.hidden=true;
  if(!host.id)host.id='world-render';framing.dataset.sceneFraming='';framing.setAttribute('aria-controls',host.id||'world-render');host.after(framing);
  framing.addEventListener('click',()=>{
    view.panTo(view.sceneArea()==='coast'?.18:.565,{immediate:reducedMotion()});
    projectionKey='';render();
  },{signal});
  const buttons=[];let data=null,visible=false,disposed=false,hover='',keyboard='',linked='',projectionKey='',geometry=[],safe=null,previousMarkers={};
  function paint(){
    for(const b of buttons){
      const state=b.button.disabled?'none':b.id===keyboard?'focus':b.id===hover||b.id===linked?'hover':'none';
      if(b.button.dataset.hotspotState!==state)b.button.dataset.hotspotState=state;
      if(b.effect.dataset.hotspotState!==state)b.effect.dataset.hotspotState=state;
      if(['work','experience','resume','contact','books',
        'fibonacci'].includes(b.id))for(const channel of b.localFilter.querySelectorAll('feFuncR,feFuncG,feFuncB'))channel.setAttribute('slope',
        state==='none'?(layer.dataset.cool==='true'?1.09:1.2):(layer.dataset.cool==='true'?1.15:1.18));
      const shown=!b.button.hidden&&!b.button.disabled;
      b.button.toggleAttribute('data-show-name',shown);b.effect.toggleAttribute('data-show-name',shown);
    }
  }
  // Compact dot-and-name buttons stay close to their calibrated objects.
  function layoutMarkers(obstacles){
    const solve=()=>placeMarkers(geometry.map(g=>({id:g.id,anchor:g.anchor,outline:g.shape.outline,
      size:{width:g.label.getBoundingClientRect().width,height:44},visualHeight:g.pill.getBoundingClientRect().height,attached:false})),safe,
        obstacles,previousMarkers);
    let layout=solve();
    if(!layout.ok){
      const unavailable=new Set([...(layout.unavailable||[]),...(layout.counts||[]).filter(([,n])=>!n).map(([id])=>id)]);
      // Preserve all usable targets, including the narrow Book. Only an unplaceable
      // sliver leaving the crop becomes inactive until it comes back into view.
      const cropped=geometry.filter(g=>unavailable.has(g.id)&&!markerVisible(g.raw.outline,g.shape.outline));
      if(cropped.length){
        for(const g of cropped){g.button.hidden=true;g.effect.style.display='none';}
        geometry=geometry.filter(g=>!cropped.includes(g));layout=solve();
      }
    }
    layer.dataset.markerLayout=layout.ok?'ready':'unresolved';if(layout.ok)previousMarkers=layout.positions;
    for(const b of geometry){
      const r=layout.positions[b.id];b.button.dataset.labelFit=String(!!r);b.button.disabled=!r;
      if(!r)continue;
      b.dot.style.left=(r.anchor[0]-b.hit.left)+'px';b.dot.style.top=(r.anchor[1]-b.hit.top)+'px';
      b.label.style.left=(r.box.left-b.hit.left)+'px';b.label.style.top=(r.box.top-b.hit.top)+'px';

    }
  }
  function initialize(meta){
    if(meta.outline_schema?.version!==1||Object.keys(meta.targets||{}).length!==9)throw Error('Unsupported scene outlines');
    for(const id of Object.keys(names)){
      const t=meta.targets[id];
      if(!Array.isArray(t?.anchor)||t.anchor.length!==3||t.anchor.some(n=>!Number.isFinite(n)))throw Error('Invalid scene anchor: '+id);
      for(const shape of [t,...Object.values(t?.outline_variants||{})]){
        if(!Array.isArray(shape?.outline)||shape.outline.length<3||[shape.outline,...shape.outline_holes||[]].some(r=>r.some(p=>
          p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1))))throw Error('Invalid scene silhouette: '+id);
      }
    }
    if(disposed)return;data=meta;
    for(const [id,label] of Object.entries(names)){
      const key=prefix+'-'+id,clip=svg('clipPath',{id:key+'-clip',clipPathUnits:'userSpaceOnUse'}),clipPath=svg('path',{'clip-rule':'evenodd'});
      clip.append(clipPath);defs.append(clip);
      const mask=svg('mask',{id:key+'-outside',maskUnits:'userSpaceOnUse','mask-type':'luminance'}),
        maskRect=svg('rect',{fill:'white'}),maskPath=svg('path',{fill:'black','fill-rule':'evenodd'});
      mask.append(maskRect,maskPath);defs.append(mask);
      const effect=svg('g',{'data-scene-effect':id,'data-hotspot-state':'none'});
      const lift=svg('g',{'class':'scene-object-lift','clip-path':`url(#${key}-clip)`}),sweep=svg('g',{'class':'scene-object-sweep'});
      const localFilter=lightFilter.cloneNode(true);localFilter.id=key+'-lift';defs.append(localFilter);
      const lit=svg('g',{filter:`url(#${key}-lift)`});lit.append(svg('use',{href:'#'+prefix+'-plate'}));sweep.append(lit);lift.append(sweep);
      const halo=svg('path',{'class':'scene-object-halo',mask:`url(#${key}-outside)`});
      const edge=svg('path',{'class':'scene-object-focus-edge'}),rim=svg('path',{'class':'scene-object-rim'});
      effect.append(lift,halo,edge,rim);effects.append(effect);
      const button=document.createElement('button');button.type='button';button.dataset.sceneObject=id;
      button.style.setProperty('--marker-phase',(-buttons.length*.35)+'s');
      button.setAttribute('aria-label',accessible[id]||label);
      const hitSvg=svg('svg',{'class':'scene-object-hit-svg','aria-hidden':'true'}),hitPath=svg('path',{'data-scene-hit':id,'fill-rule':'evenodd'});
      hitSvg.append(hitPath);const tag=document.createElement('span');tag.className='scene-object-label';tag.setAttribute('aria-hidden','true');
      const pill=document.createElement('span');pill.className='scene-marker-name';pill.innerHTML=navIcon(id==='globe'?'winter':id,'scene-tab-icon');
      const text=document.createElement('span');text.className='scene-marker-text';text.textContent=label;pill.append(text);tag.append(pill);
      const dot=document.createElement('span');dot.className='scene-object-dot';dot.setAttribute('aria-hidden','true');
      // Invisible calibration point: the native SVG silhouette owns the object hit.
      button.append(hitSvg,dot,tag);layer.append(button);
      chromeObserver.observe(tag);
      let drag=null,suppressClick=false;
      button.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;keyboard='';
        drag={x:e.clientX,y:e.clientY,yaw:view.yaw,moved:false};button.setPointerCapture(e.pointerId);paint();
      },{signal});
      button.addEventListener('pointermove',e=>{
        if(!drag)return;
        if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>8)drag.moved=true;
        if(drag.moved){hover='';keyboard='';view.yaw=drag.yaw-(e.clientX-drag.x)*.008;host.focus({preventScroll:true});render();}
      },{signal});
      button.addEventListener('pointerup',()=>{suppressClick=!!drag?.moved;drag=null;},{signal});
      button.addEventListener('pointercancel',()=>{drag=null;paint();},{signal});
      button.addEventListener('click',e=>{
        const dragged=suppressClick;suppressClick=false;
        if(dragged&&e.detail>0){e.preventDefault();return;}
        paint();onObject(id,button);
      },{signal});
      button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen'){hover=id;paint();}},{signal});
      button.addEventListener('pointerleave',()=>{if(hover===id){hover='';paint();}},{signal});
      button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))keyboard=id;paint();},{signal});
      button.addEventListener('blur',()=>{if(keyboard===id)keyboard='';paint();},{signal});
      button.addEventListener('keydown',e=>{if(!['Shift','Control','Alt','Meta'].includes(e.key)){keyboard=id;paint();}},{signal});
      buttons.push({id,button,dot,localFilter,label:tag,hitSvg,hitPath,effect,clipPath,mask,maskRect,maskPath,halo,edge,rim,text,pill});
    }
  }
  // Font metrics must be final before the first capsule placement. A failed font keeps system-type navigation usable.
  const markerFont=document.fonts.load('500 13px "Zalando Sans Expanded"').catch(()=>[]);
  const outlineData=fetch(new URL('../assets/outdoor/hotspot-layout.json',import.meta.url),{signal}).then(r=>{
    if(!r.ok)throw Error('Scene outlines HTTP '+r.status);return r.json();
  });
  const ready=Promise.all([outlineData,markerFont]).then(([meta])=>initialize(meta)).catch(cause=>{
    throw Object.assign(new Error('Scene outlines failed to load'),{asset:'hotspot-layout.json',cause});
  });
  document.addEventListener('pointerdown',e=>{
    const outside=!e.target.closest?.('[data-scene-object]');
    // Switching from mouse to touch need not emit a mouse pointerleave (WebKit).
    if(outside||e.pointerType==='touch'){hover='';if(outside)keyboard='';paint();}
  },{signal});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')paint();},{signal});
  for(const menu of document.querySelectorAll('.world-dock [data-world-route]')){
    const id=menu.dataset.worldRoute;
    menu.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){hover=id;paint();}},{signal});
    menu.addEventListener('pointerleave',()=>{if(hover===id){hover='';paint();}},{signal});
    menu.addEventListener('focus',()=>{if(menu.matches(':focus-visible'))keyboard=id;paint();},{signal});
    menu.addEventListener('blur',()=>{if(keyboard===id)keyboard='';paint();},{signal});
  }
  document.addEventListener('linked-menu-highlight',e=>{linked=e.detail||'';paint();},{signal});
  const suspend=()=>{layer.dataset.suspended='true';hover='';paint();};
  const resume=()=>{delete layer.dataset.suspended;paint();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else resume();},{signal});
  window.addEventListener('blur',suspend,{signal});window.addEventListener('focus',resume,{signal});
  const preference=()=>paint();
  const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',preference,{signal});
  const observer=new MutationObserver(preference);observer.observe(document.body,{attributes:true,attributeFilter:['data-motion']});
  // Header and tabs can settle after the scene (fonts, readiness styles, or text zoom).
  const chromeObserver=new ResizeObserver(render);
  for(const node of document.querySelectorAll('.world-header,.world-dock,.scene-quality-panel'))chromeObserver.observe(node);
  return {
    ready,
    layout:()=>ready.then(()=>data),
    update(camera,region,show,lighting,season,paused=false) {
      visible=show;layer.hidden=!visible;
      framing.hidden=!visible||!view.compact();
      const area=view.sceneArea();
      framing.textContent=area==='desk'?'See coast →':'← Back to desk';
      framing.dataset.sceneDestination=area==='desk'?'coast':'desk';
      host.dataset.sceneFrameMode=area;host.dataset.scenePanning=String(view.panning());
      if(!visible){hover='';keyboard='';return;}
      if(!data)return;
      const globe=buttons.find(b=>b.id==='globe'),next=region==='winter'?'Coast':'Winter';
      if(globe.text.textContent!==next){
        globe.text.textContent=next;globe.button.setAttribute('aria-label',next+' · Change season with the snow globe');
        globe.pill.querySelector('svg').outerHTML=navIcon(next==='Winter'?'winter':'coast','scene-tab-icon');
      }
      names.globe=next;
      const w=host.clientWidth,h=host.clientHeight,origin=host.getBoundingClientRect();
      const header=document.querySelector('.world-header').getBoundingClientRect(),dock=document.querySelector('.world-dock').getBoundingClientRect();
      if(!framing.hidden)framing.style.top=(header.bottom+12)+'px';
      safe={left:8,right:w-8,top:Math.max(8,header.bottom-origin.top+8),bottom:dock.top>header.bottom+1?dock.top-origin.top-8:h-8};
      const cool=region==='winter'||lighting.blend>.5;
      effects.setAttribute('viewBox',`0 0 ${w} ${h}`);layer.dataset.cool=String(cool);
      lightFilter.setAttribute('width',w);lightFilter.setAttribute('height',h);
      for(const b of buttons)for(const channel of b.localFilter.querySelectorAll('feFuncR,feFuncG,feFuncB'))
        channel.setAttribute('slope',cool?1.09:1.2);
      const imageSource=(node,file)=>{const url=new URL('../assets/outdoor/'+file,import.meta.url).href;
        if(node.getAttribute('href')!==url)node.setAttribute('href',url);};
      imageSource(currentCoast,lighting.files.coast);imageSource(currentWinter,lighting.files.winter);
      imageSource(oldCoast,lighting.previous.coast);imageSource(oldWinter,lighting.previous.winter);
      oldWinter.setAttribute('opacity',season.blend);currentWinter.setAttribute('opacity',season.blend);
      current.setAttribute('opacity',lighting.progress);
      for(const [group,warm] of [[old,lighting.oldMorning],[current,lighting.morning]]){
        if(warm)group.setAttribute('filter','url(#'+prefix+'-morning)');else group.removeAttribute('filter');
      }
      const panBox=framing.hidden?null:framing.getBoundingClientRect();
      const obstacles=panBox?[{left:panBox.left-origin.left,right:panBox.right-origin.left,
        top:panBox.top-origin.top,bottom:panBox.bottom-origin.top}]:[];
      const panel=document.querySelector('.scene-quality-panel:not([hidden]):has([data-inspect-expand][aria-expanded="false"])');
      if(panel){const box=panel.getBoundingClientRect();obstacles.push({left:box.left-origin.left,right:box.right-origin.left,
        top:box.top-origin.top,bottom:box.bottom-origin.top});}
      const sizes=buttons.map(b=>b.button.hidden?0:b.label.getBoundingClientRect().width);
      const key=[w,h,safe.top,safe.bottom,...sizes,...obstacles.flatMap(box=>Object.values(box)),
        ...camera.projectionMatrix.elements,...camera.matrixWorldInverse.elements,region,lighting.blend>.5].join(':');
      if(key!==projectionKey){
        projectionKey=key;geometry=[];
        const plate='concept-'+region+(lighting.blend>.5?'-dusk':'')+'-v2.webp';
        const [[x,y],[xx,yy]]=projectPlateRing([[.1,.6],[.2,.7]],.84,camera,w,h);
        photo.setAttribute('transform',`translate(${x-(xx-x)} ${y-6*(yy-y)}) scale(${(xx-x)*10/1672} ${(yy-y)*10/941})`);
        for(const b of buttons){
          const meta=data.targets[b.id],shape=meta.outline_variants?.[plate]||meta;
          const raw={outline:projectPlateRing(shape.outline,meta.anchor[2],camera,w,h),
            holes:(shape.outline_holes||[]).map(r=>projectPlateRing(r,meta.anchor[2],camera,w,h))};
          const clipped=clipRing(raw.outline,{left:0,right:w,top:safe.top,bottom:safe.bottom}),box=bounds(clipped);
          const minimum=['contact','aqua','futsl'].includes(b.id)?2:16;
          const off=clipped.length<3||box.right-box.left<minimum||box.bottom-box.top<minimum;
          b.button.hidden=off;b.effect.style.display=off?'none':'';
          if(off)continue;
          for(const [name,value] of Object.entries({x:box.left-8,y:box.top-8,width:box.right-box.left+16,height:box.bottom-box.top+16}))
            b.localFilter.setAttribute(name,value);
          const rim={outline:clipRing(raw.outline,{...safe,left:12,right:w-12}),holes:raw.holes};
          const path=shapePath(raw),rimPath=shapePath(rim);
          b.clipPath.setAttribute('d',path);b.clipPath.dataset.sceneOutline=b.id;b.clipPath.dataset.plate=plate;
          b.maskPath.setAttribute('d',rimPath);b.maskRect.setAttribute('width',w);b.maskRect.setAttribute('height',h);
          for(const n of [b.halo,b.edge,b.rim])n.setAttribute('d',rimPath);
          const pad=Math.max(0,(44-(box.right-box.left))/2,(44-(box.bottom-box.top))/2);
          const width=Math.max(44,Math.min(w,box.right-box.left+2*pad)),height=Math.max(44,box.bottom-box.top+2*pad);
          const left=Math.max(0,Math.min(w-width,box.left-pad)),top=Math.max(safe.top,Math.min(safe.bottom-height,box.top-pad));
          const hit={left,top,right:left+width,bottom:top+height};
          Object.assign(b.button.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
          b.hitSvg.setAttribute('viewBox',`${left} ${top} ${width} ${height}`);
          b.hitPath.setAttribute('d',shapePath({outline:clipped,holes:raw.holes}));b.hitPath.style.strokeWidth=String(pad*2);
          const anchor=projectPlateRing([meta.anchor.slice(0,2)],meta.anchor[2],camera,w,h)[0];
          geometry.push({...b,anchor,shape:{outline:clipped,holes:raw.holes},raw,hit});
        }
      }
      if(key!==layer.dataset.markerProjection){layoutMarkers(obstacles);layer.dataset.markerProjection=key;}
      paint();
    },
    dispose(){disposed=true;events.abort();observer.disconnect();chromeObserver.disconnect();layer.remove();framing.remove();}
  };
}
