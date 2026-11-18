// Object anchors never move. Each name is pinned to its own dot by a short stem.
import {bounds,clipRing,pointInRing,nearestPoint,rectangleHitsRing} from './scene-object-geometry.js';
const overlaps=(a,b,pad=0)=>a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;
const rect=(x,y,w,h)=>({left:x,top:y,right:x+w,bottom:y+h});
const closest=(p,r)=>[Math.max(r.left,Math.min(r.right,p[0])),Math.max(r.top,Math.min(r.bottom,p[1]))];
// Sample a stem segment; true when it passes through a rectangle (inflated by pad).
export const stemHits=(s,r,pad=2)=>{
 const length=Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1]);
 for(let i=0;i<=length;i+=2){
  const t=length?i/length:0,x=s.start[0]+(s.end[0]-s.start[0])*t,y=s.start[1]+(s.end[1]-s.start[1])*t;
  if(x>r.left-pad&&x<r.right+pad&&y>r.top-pad&&y<r.bottom+pad)return true;
 }
 return false;
};
const stemCrosses=(s,others)=>{
 const length=Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1]);
 for(let i=0;i<=length;i+=3){
  const t=length?i/length:0,p=[s.start[0]+(s.end[0]-s.start[0])*t,s.start[1]+(s.end[1]-s.start[1])*t];
  if(others.some(o=>pointInRing(p,o.outline)))return true;
 }
 return false;
};
// Two markers clash when their targets overlap or one stem runs through the other's name.
export const markersClash=(a,b,strict=true)=>overlaps(a.box,b.box,4)||strict&&(stemHits(a,b.pill)||stemHits(b,a.pill));
export function markerAnchor(anchor,outline,viewport){
 const ring=clipRing(outline,{left:viewport.left+3,right:viewport.right-3,top:viewport.top+3,bottom:viewport.bottom-3});
 if(ring.length<3)return null;
 return pointInRing(anchor,ring)?anchor:nearestPoint(anchor,ring);
}
export function markerVisible(raw,clipped){
 if(clipped.length<3)return false;
 const a=bounds(raw),b=bounds(clipped);
 // A cropped sliver must not leave an unrelated control pinned to the screen edge.
 return b.right-b.left>=(a.right-a.left)*.4&&b.bottom-b.top>=(a.bottom-a.top)*.4;
}
export function placeMarkers(markers,viewport,obstacles=[],previous={}){
 const prepared=markers.map(m=>({...m,anchor:markerAnchor(m.anchor,m.outline,viewport),bounds:bounds(m.outline)}));
 if(prepared.some(m=>!m.anchor))return {ok:false,positions:{},reason:'No visible object anchor',
  unavailable:prepared.filter(m=>!m.anchor).map(m=>m.id),counts:[]};
 function candidate(m,left,top,penalty=0){
  const [x,y]=m.anchor,w=m.size.width,h=44,ph=m.visualHeight||28,offset=(h-ph)/2;
  left=Math.max(viewport.left,Math.min(viewport.right-w,left));
  top=Math.max(viewport.top-8,Math.min(viewport.bottom+8-h,top));
  const box=rect(left,top,w,h),pill=rect(left,top+offset,w,ph),end=closest(m.anchor,pill);
  const length=Math.hypot(x-end[0],y-end[1]),other=prepared.filter(o=>o.id!==m.id);
  const extent=m.outline.reduce((value,p)=>Math.max(value,Math.hypot(p[0]-x,p[1]-y)),0);
  const reach=m.outsideObject?Math.max(44,extent+ph+52):44;
  if(box.right>viewport.right+.01||box.bottom>viewport.bottom+8+.01||length>reach||(!m.attached&&overlaps(pill,rect(x-9,y-9,18,18),2)))return null;
  if(length<(m.minGap||0))return null;
  if(m.outsideObject&&overlaps(pill,m.bounds,3)&&rectangleHitsRing(pill,m.outline,3))return null;
  if(m.outsideObject){
   const edge=nearestPoint([left+w/2,top+h/2],m.outline),near=closest(edge,pill);
   if(Math.hypot(edge[0]-near[0],edge[1]-near[1])>52)return null;
  }
  if(m.attached&&!m.outline.some((a,i)=>rectangleHitsRing(pill,[a,m.outline[(i+1)%m.outline.length]],3)))return null;
  if(obstacles.some(o=>overlaps(box,o,5)))return null;
  if(other.some(o=>overlaps(box,rect(o.anchor[0]-9,o.anchor[1]-9,18,18),2)||
    overlaps(pill,o.bounds,2)&&rectangleHitsRing(pill,o.outline,2)))return null;
  if(!m.outsideObject)for(let i=9;i<length;i+=2){
   const p=[x+(end[0]-x)*i/length,y+(end[1]-y)*i/length];
   if(other.some(o=>pointInRing(p,o.outline)))return null;
  }
  const start=length?[x+(end[0]-x)*Math.min(9,length)/length,y+(end[1]-y)*Math.min(9,length)/length]:[x,y];
  // A visible stem joins every dot to its own name. Prefer a short vertical stem with
  // the name centred directly below its dot (as in the reference); above only when needed.
  const aligned=x>=pill.left+10&&x<=pill.right-10,above=pill.bottom<=y;
  let cost=penalty+length+Math.abs(left+w/2-x)*(aligned?.15:.6)+(aligned?0:40)+(above&&!m.preferAbove?24:0);
  if(stemCrosses({start,end},other))cost+=120;
  return {box,pill,start,end,anchor:m.anchor,cost};
 }
 // A pan translates the photograph. Reuse its valid layout instead of solving
 // the same arrangement on every frame; all collision checks still apply.
 if(Object.keys(previous).length===prepared.length&&prepared.every(m=>previous[m.id])){
  const restored=prepared.map(m=>{
   const old=previous[m.id];return [m.id,candidate(m,old.box.left+m.anchor[0]-old.anchor[0],old.box.top+m.anchor[1]-old.anchor[1])];
  });
  if(restored.every(([,p],i)=>p&&restored.slice(0,i).every(([,o])=>o&&!markersClash(p,o))))
   return {ok:true,positions:Object.fromEntries(restored),steps:0,reused:true};
 }
 const items=prepared.map(m=>{
  const [x,y]=m.anchor,w=m.size.width,h=44,options=[],seen=new Set();
  const add=(left,top,penalty)=>{
   const value=candidate(m,left,top,penalty);if(!value)return;
   const key=value.box.left.toFixed(2)+':'+value.box.top.toFixed(2);if(seen.has(key))return;seen.add(key);options.push(value);
  };
  if(m.attached||m.outsideObject){
   const ph=m.visualHeight||28,offset=(44-ph)/2,edge=[nearestPoint(m.anchor,m.outline)];
   for(let i=0;i<m.outline.length;i++){
    const a=m.outline[i],b=m.outline[(i+1)%m.outline.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let d=0;d<=length;d+=8){
     const t=length?d/length:0,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
     if(m.outsideObject||Math.hypot(p[0]-x,p[1]-y)<=80)edge.push(p);
    }
   }
   const gaps=m.outsideObject?[4,8,12,20,28,36,44,52]:[-2,0,2,3];
   for(const [ex,ey] of edge)for(const shift of [0,-12,12,-24,24])for(const gap of gaps){
    // Captions search the perimeter, while attached tabs can meet the edge.
    // Transparent 44px targets remain separate from neighbouring controls.
    add(ex-w/2+shift,ey-offset+gap,(gap+2)*2);add(ex-w/2+shift,ey-offset-ph-gap,2+(gap+2)*2);
    add(ex+gap,ey-22+shift,4+(gap+2)*2);add(ex-w-gap,ey-22+shift,4+(gap+2)*2);
   }
  }else{
  for(const d of [0,8,16,24])for(const dx of [0,-12,12,-24,24,-36,36,-48,48,-64,64]){
   add(x-w/2+dx,y+6+d,(m.preferAbove?22:0)+d*.2);
   add(x-w/2+dx,y-h-6-d,(m.preferAbove?0:22)+d*.2);
  }
  for(const gap of [14,22,30,38])for(const dy of [0,-12,12,-24,24,-36,36]){
   add(x+gap,y-h/2+dy,16+Math.abs(dy)*.1);add(x-w-gap,y-h/2+dy,16+Math.abs(dy)*.1);
  }
  }
  // Very narrow tall screens can have only a small gap above a cropped book.
  // Search that real gap at 2px resolution before declaring the marker impossible.
  if(!options.length)for(let yy=Math.max(viewport.top-8,y-100);yy<=Math.min(viewport.bottom+8-44,y+50);yy+=2)
   for(let xx=Math.max(viewport.left,x-w-50);xx<=Math.min(viewport.right-w,x+50);xx+=2)add(xx,yy,32);
  return {m,options:options.sort((a,b)=>a.cost-b.cost)};
 }).sort((a,b)=>a.options.length-b.options.length);
 const result=new Map();let steps=0,strict=true;
 function search(index){
  if(index===items.length)return true;if(++steps>15000)return false;
  const placed=[...result.values()];let next=null,choices=null;
  // Choose the name with the fewest currently legal positions, not its initial count.
  // This avoids spending the unchanged search budget on already impossible branches.
  for(const item of items){
   if(result.has(item.m.id))continue;
   const legal=item.options.filter(p=>placed.every(o=>!markersClash(p,o,strict)));
   if(!legal.length)return false;
   if(!choices||legal.length<choices.length){next=item;choices=legal;}
  }
  for(const p of choices){
   result.set(next.m.id,p);if(search(index+1))return true;result.delete(next.m.id);
  }return false;
 }
 // Crowded crops may have no layout where every stem avoids every name; then
 // keep the name next to its object rather than disabling the marker.
 let ok=search(0);
 if(!ok){result.clear();steps=0;strict=false;ok=search(0);}
 return {ok,positions:Object.fromEntries(result),steps,strictStems:strict,counts:items.map(o=>[o.m.id,o.options.length])};
}
