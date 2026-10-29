// Infer the two nearest-neighbour winding families from actual seed coordinates.
// An index step is a result of the geometry, never a preselected Fibonacci value.
export function spiralFamilies(points,centre={x:130,y:130}) {
  if(points.length<30)return [];
  const lo=Math.floor(points.length*.55),hi=Math.floor(points.length*.75),best=new Map();
  for(let step=1;step<=Math.floor(points.length*.24);step++) {
    let distance=0,winding=0,samples=0;
    for(let i=lo;i<hi&&i+step<points.length;i++) {
      const a=points[i],b=points[i+step];
      distance+=(a.x-b.x)**2+(a.y-b.y)**2;
      winding+=(a.x-centre.x)*(b.y-centre.y)-(a.y-centre.y)*(b.x-centre.x);samples++;
    }
    const direction=Math.sign(winding),score=distance/samples;
    if(direction&&samples&&(!best.has(direction)||score<best.get(direction).score))
      best.set(direction,{step,score,direction});
  }
  return [...best.values()].sort((a,b)=>a.direction-b.direction).map(family=>{
    const arms=[];
    for(let first=0;first<family.step;first++) {
      const arm=[];for(let i=first;i<points.length;i+=family.step)arm.push(points[i]);
      if(arm.length>1)arms.push(arm);
    }
    // Count adjacent outer endpoints clockwise from the top of the head.
    const rimAngle=arm=>{
      const p=arm.at(-1);
      return (Math.atan2(p.y-centre.y,p.x-centre.x)+Math.PI*2.5)%(Math.PI*2);
    };
    arms.sort((a,b)=>rimAngle(a)-rimAngle(b));
    let a=0,b=1;while(b<arms.length)[a,b]=[b,a+b];
    return {...family,arms,count:arms.length,fibonacci:b===arms.length};
  });
}
