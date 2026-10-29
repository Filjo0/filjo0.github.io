// Pure screen-space geometry; the caller supplies points projected by the real camera.
export const bounds=ring=>({left:Math.min(...ring.map(p=>p[0])),top:Math.min(...ring.map(p=>p[1])),
  right:Math.max(...ring.map(p=>p[0])),bottom:Math.max(...ring.map(p=>p[1]))});
export const ringPath=ring=>ring.length?'M'+ring.map(p=>p.map(v=>v.toFixed(3)).join(' ')).join('L')+'Z':'';
export const shapePath=shape=>[shape.outline,...shape.holes||[]].map(ringPath).join('');
export function clipRing(ring,box) {
  let out=ring;
  for(const [axis,edge,sign] of [[0,box.left,1],[0,box.right,-1],[1,box.top,1],[1,box.bottom,-1]]){
    const input=out;out=[];if(!input.length)break;
    let a=input.at(-1),aIn=(a[axis]-edge)*sign>=0;
    for(const b of input){const bIn=(b[axis]-edge)*sign>=0;
      if(aIn!==bIn){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
      if(bIn)out.push(b);a=b;aIn=bIn;
    }
  }
  return out;
}
export function pointInRing([x,y],ring) {
  return ring.reduce((yes,[ax,ay],i)=>{const [bx,by]=ring[(i+1)%ring.length];
    return (ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax?!yes:yes;},false);
}
export function nearestPoint(point,ring) {
  let best=null,distance=Infinity;
  ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
    const p=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(p[0]-point[0],p[1]-point[1]);
    if(d<distance){best=p;distance=d;}
  });return best;
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const crosses=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
export function rectangleHitsRing(rect,ring,pad=0) {
  const l=rect.left-pad,t=rect.top-pad,r=rect.right+pad,b=rect.bottom+pad;
  const corners=[[l,t],[r,t],[r,b],[l,b]];
  return ring.some(([x,y])=>x>=l&&x<=r&&y>=t&&y<=b)||corners.some(p=>pointInRing(p,ring))||
    ring.some((a,i)=>corners.some((c,j)=>crosses(a,ring[(i+1)%ring.length],c,corners[(j+1)%4])));
}
export function labelPlacement(shape,size,viewport,others,reserved=[]) {
  const b=bounds(shape),w=size.width,h=size.height,rect=(x,y)=>({
    left:Math.max(viewport.left,Math.min(viewport.right-w,x)),
    top:Math.max(viewport.top,Math.min(viewport.bottom-h,y))});
  const candidates=[];
  for(const gap of [8,18,32,52]){
    const cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;
    candidates.push(rect(cx-w/2,b.top-h-gap),rect(b.right+gap,cy-h/2),rect(cx-w/2,b.bottom+gap),rect(b.left-w-gap,cy-h/2),
      rect(b.right+gap,b.bottom+gap),rect(b.left-w-gap,b.bottom+gap),rect(b.right+gap,b.top-h-gap),rect(b.left-w-gap,b.top-h-gap));
  }
  const score=c=>{
    const box={...c,right:c.left+w,bottom:c.top+h};
    if(box.right>viewport.right+.01||box.bottom>viewport.bottom+.01)return null;
    if([shape,...others].some(r=>rectangleHitsRing(box,r,3))||reserved.some(r=>
      box.left<r.right+5&&box.right>r.left-5&&box.top<r.bottom+5&&box.bottom>r.top-5))return null;
    const centre=[c.left+w/2,c.top+h/2],start=nearestPoint(centre,shape);
    const end=[Math.max(box.left,Math.min(box.right,start[0])),Math.max(box.top,Math.min(box.bottom,start[1]))];
    const actualStart=nearestPoint(end,shape),length=Math.hypot(actualStart[0]-end[0],actualStart[1]-end[1]);
    // A short connector may not run through a different interactive object.
    for(let i=1;i<Math.ceil(length/2);i++){
      const t=i/Math.ceil(length/2),p=[actualStart[0]+(end[0]-actualStart[0])*t,actualStart[1]+(end[1]-actualStart[1])*t];
      if(others.some(r=>pointInRing(p,r)))return null;
    }
    return {box,start:actualStart,end,cost:length+Math.hypot(centre[0]-(b.left+b.right)/2,centre[1]-(b.top+b.bottom)/2)*.03};
  };
  let best=null;
  for(const c of candidates){const result=score(c);if(result&&(!best||result.cost<best.cost))best=result;}
  if(!best)for(let y=viewport.top;y+h<=viewport.bottom;y+=16)for(let x=viewport.left;x+w<=viewport.right;x+=16){
    const result=score(rect(x,y));if(result&&(!best||result.cost<best.cost))best=result;
  }
  return best;
}
