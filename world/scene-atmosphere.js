import {reducedMotion} from './motion.js';
import {projectPlateRing} from './concept-layout.js';
const NS='http://www.w3.org/2000/svg';let serial=0;
const node=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,v);return n;};
// The compositor owns the idle details; the photographed scene stays fixed.
export function createSceneAtmosphere(host,request){
 const events=new AbortController(),id='atmosphere-'+(++serial),root=node('svg',{class:'scene-atmosphere','aria-hidden':'true'});
 const defs=node('defs'),group=node('g'),leaves=node('g',{class:'atmo-leaves'}),photo=node('image',{width:1672,height:941});
 root.append(defs,group);root.setAttribute('hidden','');host.after(root);
 const gradient=node('radialGradient',{id:id+'-lamp'});
 gradient.append(node('stop',{offset:0,'stop-color':'var(--object-halo-warm)','stop-opacity':'.25'}),
  node('stop',{offset:1,'stop-color':'var(--object-halo-warm)','stop-opacity':0}));defs.append(gradient);
 const glow=node('ellipse',{cx:147,cy:266,rx:102,ry:85,fill:'url(#'+id+'-lamp)',class:'atmo-lamp'});group.append(glow);
 const clip=node('clipPath',{id:id+'-leaves'});clip.append(node('path',{d:'M0 180L104 180L140 375L92 534L0 543Z'}));defs.append(clip);
 leaves.setAttribute('clip-path','url(#'+id+'-leaves)');leaves.append(photo);group.append(leaves);
 const sea=node('g',{class:'atmo-sea'});
 for(const [x,y,w] of [[1420,405,95],[1510,445,80],[1480,480,110]])
  sea.append(node('path',{d:'M'+x+' '+y+'q'+w/2+' -3 '+w+' 0',class:'atmo-shimmer'}));group.append(sea);
 let visible=false,paused=false,inspected=false,focused=document.hasFocus(),projection='',file='';
 const allowed=()=>visible&&focused&&!paused&&!inspected&&!reducedMotion()&&!document.hidden&&!document.body.hasAttribute('data-inspecting');
 const reset=()=>{root.toggleAttribute('hidden',!allowed());request();};
 document.addEventListener('visibilitychange',reset,{signal:events.signal});
 window.addEventListener('blur',()=>{focused=false;reset();},{signal:events.signal});
 window.addEventListener('focus',()=>{focused=true;reset();},{signal:events.signal});
 return {
  update(camera,region,lighting,show,isPaused){
   visible=show;paused=isPaused;inspected=!show;root.toggleAttribute('hidden',!allowed());
   const w=host.clientWidth,h=host.clientHeight;root.setAttribute('viewBox','0 0 '+w+' '+h);
   const key=[w,h,...camera.projectionMatrix.elements,...camera.matrixWorldInverse.elements].join(':');
   if(projection!==key){projection=key;const [[x,y],[xx,yy]]=projectPlateRing([[.1,.6],[.2,.7]],.84,camera,w,h);
    group.setAttribute('transform','translate('+(x-(xx-x))+' '+(y-6*(yy-y))+') scale('+((xx-x)*10/1672)+' '+((yy-y)*10/941)+')');}
   const next=lighting.files[region];if(next!==file){file=next;photo.setAttribute('href',new URL('../assets/outdoor/'+file,import.meta.url));}
   root.dataset.phase=lighting.phase;root.dataset.season=region;
  },
  reset,dispose(){events.abort();root.remove();}
 };
}
