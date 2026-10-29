// Measure rendered DOM corners independently of the renderer’s projection metadata.
export async function readingSurfaceEdges(locator) {
 const corners=await locator.evaluate(n=>[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{
  const p=document.createElement('span');p.style.cssText=`position:absolute;left:${x*100}%;top:${y*100}%;width:0;height:0;pointer-events:none`;
  n.append(p);const r=p.getBoundingClientRect();p.remove();return {x:r.x,y:r.y};
 }));
 const deviations=corners.map((a,i)=>{
  const b=corners[(i+1)%4],angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  return Math.abs((angle-[0,90,180,-90][i]+540)%360-180);
 });
 return {corners,deviations,maxDeviation:Math.max(...deviations)};
}
