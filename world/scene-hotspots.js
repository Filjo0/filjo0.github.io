import {projectPlateRing} from './concept-layout.js';
import {reducedMotion} from './motion.js';
import {bounds,clipRing,shapePath,labelPlacement} from './scene-object-geometry.js';

const NS='http://www.w3.org/2000/svg';let instance=0;
const names={work:'Apps',contact:'Contact',resume:'Résumé',experience:'About me',books:'Book',fibonacci:'Maths',
  globe:'Globe',aqua:'Aqua Local · Pool',futsl:'FUTSL · Pitch'};
const svg=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;};

// Native buttons own keyboard/focus; only their SVG silhouettes (or small-object padding) receive pointers.
export function createSceneHotspots(host,onObject,view,render) {
  const events=new AbortController(),{signal}=events,prefix='scene-outlines-'+(++instance);
  const layer=document.createElement('nav');layer.hidden=true;layer.className='scene-hotspots';
  layer.setAttribute('aria-label','Objects in this scene');host.after(layer);
  const effects=svg('svg',{'class':'scene-object-effects','aria-hidden':'true'}),defs=svg('defs');effects.append(defs);layer.append(effects);
  // Explicit sRGB primitives avoid the engines' different CSS brightness handling on SVG use.
  const lightFilter=svg('filter',{id:prefix+'-lift',filterUnits:'userSpaceOnUse',x:0,y:0,'color-interpolation-filters':'sRGB'});
  const transfer=svg('feComponentTransfer'),channels=['feFuncR','feFuncG','feFuncB'].map(name=>svg(name,{type:'linear',slope:1.2}));
  transfer.append(...channels);lightFilter.append(transfer);defs.append(lightFilter);
  const photo=svg('g',{id:prefix+'-plate'}),dayWinter=svg('image'),night=svg('g'),nightWinter=svg('image');
  const image=file=>svg('image',{href:new URL('../assets/outdoor/'+file,import.meta.url).href,width:1672,height:941});
  photo.append(image('concept-coast-v2.webp'));
  for(const n of [dayWinter,nightWinter]){n.setAttribute('width',1672);n.setAttribute('height',941);}
  photo.append(dayWinter,night);defs.append(photo);
  const framing=document.createElement('button');framing.type='button';framing.className='scene-framing';framing.hidden=true;
  if(!host.id)host.id='world-render';framing.dataset.sceneFraming='';framing.setAttribute('aria-controls',host.id||'world-render');host.after(framing);
  framing.addEventListener('click',()=>{
    view.panTo(view.sceneArea()==='coast'?.18:.565,{immediate:reducedMotion()});
    activity();projectionKey='';render();
  },{signal});
  const buttons=[];let data=null,visible=false,disposed=false,introduced=false,hover='',keyboard='',hint='',hintKind='';
  let introTimer=0,idleTimer=0,hintTimer=0,arrivalTimer=0,arrivalPending=false,previousArea=null,wasVisible=false;
  let introIndex=0,glints=0,idleIndex=0,projectionKey='',geometry=[],safe=null;
  const clearTimer=name=>{clearTimeout(name);};
  function endHint(){clearTimer(hintTimer);hintTimer=0;hint='';hintKind='';}
  function endIntro(){clearTimer(introTimer);introTimer=0;delete layer.dataset.intro;endHint();}
  function stopHints(){endIntro();clearTimer(idleTimer);idleTimer=0;clearTimer(arrivalTimer);arrivalTimer=0;arrivalPending=false;}
  const available=()=>visible&&!disposed&&!document.hidden&&document.hasFocus()&&!layer.hidden;
  function idleLater(){
    clearTimer(idleTimer);idleTimer=0;
    if(!available()||reducedMotion()||layer.dataset.intro||hover||keyboard||glints>=3)return;
    idleTimer=setTimeout(()=>{
      idleTimer=0;if(!available()||reducedMotion())return;
      const shown=buttons.filter(b=>!b.button.hidden);if(!shown.length)return;
      hint=shown[idleIndex++%shown.length].id;hintKind='idle';glints++;layer.dataset.glints=String(glints);paint();
      hintTimer=setTimeout(()=>{endHint();paint();idleLater();},650);
    },8000);
  }
  function introduce(allNames=false){
    introduced=true;
    if(allNames||reducedMotion()){
      layer.dataset.intro='names';paint();introTimer=setTimeout(()=>{endIntro();paint();idleLater();},3000);return;
    }
    layer.dataset.intro='sweep';introIndex=0;
    const step=()=>{
      if(!available()){endIntro();paint();return;}
      const shown=buttons.filter(b=>!b.button.hidden);
      if(introIndex>=shown.length){endIntro();paint();idleLater();return;}
      hint=shown[introIndex++].id;hintKind='arrival';paint();introTimer=setTimeout(step,240);
    };step();
  }
  function activity(){
    stopHints();idleLater();
  }
  function paint(){
    if(!geometry.length)return;
    const shown=[];
    for(const b of buttons){
      const state=b.id===keyboard?'focus':b.id===hover?'hover':b.id===hint?hintKind:'none';
      const name=state==='focus'||state==='hover'||state==='arrival'||layer.dataset.intro==='names';
      b.label.textContent=names[b.id];
      b.button.dataset.hotspotState=state;b.effect.dataset.hotspotState=state;
      b.button.toggleAttribute('data-show-name',name);b.effect.toggleAttribute('data-show-name',name);
      if(name&&!b.button.hidden)shown.push(b);
    }
    // Current input wins placement; reduced-motion arrival tags avoid each other too.
    shown.sort((a,b)=>Number(['focus','hover'].includes(b.button.dataset.hotspotState))-
      Number(['focus','hover'].includes(a.button.dataset.hotspotState)));
    const reserved=[];
    for(const b of shown){
      const g=geometry.find(g=>g.id===b.id),r=labelPlacement(g.shape.outline,{width:b.label.offsetWidth,height:b.label.offsetHeight},safe,
        geometry.filter(o=>o.id!==b.id&&!o.button.hidden).map(o=>o.shape.outline),reserved);
      b.button.dataset.labelFit=String(!!r);if(!r)continue;
      reserved.push(r.box);b.label.style.left=(r.box.left-g.hit.left)+'px';b.label.style.top=(r.box.top-g.hit.top)+'px';
      const path=`M${r.start.join(' ')}L${r.end.join(' ')}`;
      b.connector.setAttribute('d',path);b.connectorEdge.setAttribute('d',path);
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
      const connectorEdge=svg('path',{'class':'scene-connector-edge'}),connector=svg('path',{'class':'scene-label-connector'});
      effect.append(lift,halo,edge,rim,connectorEdge,connector);effects.append(effect);
      const button=document.createElement('button');button.type='button';button.dataset.sceneObject=id;
      button.setAttribute('aria-label',id==='globe'?'Change season with the snow globe':id==='work'?'My apps':
        id==='books'?'Read a book':id==='fibonacci'?'Maths notebook':label);
      const hitSvg=svg('svg',{'class':'scene-object-hit-svg','aria-hidden':'true'}),hitPath=svg('path',{'data-scene-hit':id,'fill-rule':'evenodd'});
      hitSvg.append(hitPath);const tag=document.createElement('span');tag.className='scene-object-label';tag.setAttribute('aria-hidden','true');
      tag.textContent=label;
      button.append(hitSvg,tag);layer.append(button);
      let drag=null,suppressClick=false;
      button.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;keyboard='';activity();
        drag={x:e.clientX,y:e.clientY,yaw:view.yaw,moved:false};button.setPointerCapture(e.pointerId);paint();
      },{signal});
      button.addEventListener('pointermove',e=>{
        if(!drag)return;
        if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>8)drag.moved=true;
        if(drag.moved){hover='';keyboard='';view.yaw=drag.yaw-(e.clientX-drag.x)*.008;host.focus({preventScroll:true});render();}
      },{signal});
      button.addEventListener('pointerup',()=>{suppressClick=!!drag?.moved;drag=null;},{signal});
      button.addEventListener('pointercancel',()=>{drag=null;paint();idleLater();},{signal});
      button.addEventListener('click',e=>{
        const dragged=suppressClick;suppressClick=false;
        if(dragged&&e.detail>0){e.preventDefault();return;}
        activity();
        paint();onObject(id,button);
      },{signal});
      button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen'){hover=id;activity();paint();}},{signal});
      button.addEventListener('pointerleave',()=>{if(hover===id){hover='';paint();idleLater();}},{signal});
      button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))keyboard=id;activity();paint();},{signal});
      button.addEventListener('blur',()=>{if(keyboard===id)keyboard='';paint();idleLater();},{signal});
      button.addEventListener('keydown',e=>{if(!['Shift','Control','Alt','Meta'].includes(e.key)){keyboard=id;activity();paint();}},{signal});
      buttons.push({id,button,localFilter,label:tag,hitSvg,hitPath,effect,clipPath,mask,maskRect,maskPath,halo,edge,rim,connector,connectorEdge});
    }
  }
  const ready=fetch(new URL('../assets/outdoor/hotspot-layout.json',import.meta.url),{signal}).then(r=>{
    if(!r.ok)throw Error('Scene outlines HTTP '+r.status);return r.json();
  }).then(initialize).catch(cause=>{throw Object.assign(new Error('Scene outlines failed to load'),{asset:'hotspot-layout.json',cause});});
  document.addEventListener('pointerdown',e=>{
    activity();const outside=!e.target.closest?.('[data-scene-object]');
    // Switching from mouse to touch need not emit a mouse pointerleave (WebKit).
    if(outside||e.pointerType==='touch'){hover='';if(outside)keyboard='';paint();}
  },{signal});
  document.addEventListener('pointermove',()=>{if(!layer.dataset.intro)idleLater();},{signal,passive:true});
  document.addEventListener('keydown',e=>{activity();if(e.key==='Escape'){paint();}},{signal});
  const suspend=()=>{layer.dataset.suspended='true';stopHints();hover='';paint();};
  const resume=()=>{delete layer.dataset.suspended;if(!introduced&&available())introduce();else idleLater();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else resume();},{signal});
  window.addEventListener('blur',suspend,{signal});window.addEventListener('focus',resume,{signal});
  const preference=()=>{stopHints();if(available()){paint();idleLater();}};
  const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',preference,{signal});
  const observer=new MutationObserver(preference);observer.observe(document.body,{attributes:true,attributeFilter:['data-motion']});
  // Header and tabs can settle after the scene (fonts, readiness styles, or text zoom).
  const chromeObserver=new ResizeObserver(render);
  for(const node of document.querySelectorAll('.world-header,.world-dock'))chromeObserver.observe(node);
  return {
    ready,
    update(camera,region,show,lighting,season,paused=false) {
      visible=show&&!paused;const entering=visible&&!wasVisible;wasVisible=visible;layer.hidden=!visible;
      framing.hidden=!visible||!view.compact();
      const area=view.sceneArea();
      framing.textContent=area==='desk'?'See the coast \u2192':'\u2190 Back to desk';
      framing.dataset.sceneDestination=area==='desk'?'coast':'desk';
      if(!framing.hidden)framing.style.top=(document.querySelector('.world-dock').getBoundingClientRect().top-host.getBoundingClientRect().top-60)+'px';
      host.dataset.sceneFrameMode=area;host.dataset.scenePanning=String(view.panning());
      if(!visible){stopHints();hover='';keyboard='';return;}
      if(!data)return;
      const w=host.clientWidth,h=host.clientHeight,origin=host.getBoundingClientRect();
      const header=document.querySelector('.world-header').getBoundingClientRect(),dock=document.querySelector('.world-dock').getBoundingClientRect();
      safe={left:8,right:w-8,top:Math.max(8,header.bottom-origin.top+8),bottom:dock.top>header.bottom+1?dock.top-origin.top-8:h-8};
      const cool=region==='winter'||lighting.blend>.5;
      effects.setAttribute('viewBox',`0 0 ${w} ${h}`);layer.dataset.cool=String(cool);
      lightFilter.setAttribute('width',w);lightFilter.setAttribute('height',h);
      for(const b of buttons)for(const channel of b.localFilter.querySelectorAll('feFuncR,feFuncG,feFuncB'))
        channel.setAttribute('slope',cool?1.09:1.2);
      if(season.blend>0&&!dayWinter.hasAttribute('href'))
        dayWinter.setAttribute('href',new URL('../assets/outdoor/concept-winter-v2.webp',import.meta.url));
      dayWinter.setAttribute('opacity',season.blend);nightWinter.setAttribute('opacity',season.blend);night.setAttribute('opacity',lighting.blend);
      if(lighting.ready&&!night.firstChild){
        night.append(image('concept-coast-dusk-v2.webp'),nightWinter);
        nightWinter.setAttribute('href',new URL('../assets/outdoor/concept-winter-dusk-v2.webp',import.meta.url));}
      const key=[w,h,safe.top,safe.bottom,...camera.projectionMatrix.elements,...camera.matrixWorldInverse.elements,region,lighting.blend>.5].join(':');
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
          geometry.push({...b,shape:{outline:clipped,holes:raw.holes},raw,hit});
        }
      }
      if(introduced&&(entering||previousArea!==area))arrivalPending=true;previousArea=area;
      paint();
      if(!introduced&&available())introduce();
      else if(arrivalPending){
        clearTimer(arrivalTimer);arrivalTimer=0;
        if(!view.panning())arrivalTimer=setTimeout(()=>{
          arrivalTimer=0;arrivalPending=false;if(available())introduce(true);
        },180);
      }else if(!introTimer&&!idleTimer&&!hintTimer)idleLater();
    },
    dispose(){disposed=true;stopHints();events.abort();observer.disconnect();chromeObserver.disconnect();layer.remove();framing.remove();}
  };
}
