import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedPattern} from '../world-state.js';
import {spiralFamilies} from '../world/seed-spirals.js';
test('spiral families follow actual geometry, with chains covering every drawn seed',()=>{
 for(const n of [100,240,400,800]){
  const points=seedPattern(n),families=spiralFamilies(points);
  assert.equal(families.length,2);
  for(const f of families){
   assert.equal(f.count,f.arms.length);assert.ok(f.fibonacci);
   assert.equal(f.arms.flat().length,n);
   assert.equal(new Set(f.arms.flat().map(p=>p.index)).size,n);
   const first=f.arms[0];assert.equal(first[1].index-first[0].index,f.step);
  }
 }
 assert.deepEqual(spiralFamilies(seedPattern(800)).map(f=>f.count),[89,55]);
 assert.notDeepEqual(spiralFamilies(seedPattern(240)).map(f=>f.count),[89,55]);
});
test('rotation, translation and scale do not invent different spiral counts',()=>{
 const points=seedPattern(800),r=.7;
 const mapped=points.map(p=>({...p,x:400+3*((p.x-130)*Math.cos(r)-(p.y-130)*Math.sin(r)),
  y:200+3*((p.x-130)*Math.sin(r)+(p.y-130)*Math.cos(r))}));
 assert.deepEqual(spiralFamilies(mapped,{x:400,y:200}).map(f=>f.count),[89,55]);
});

test('counting follows neighbouring outer arms around the head, including the wrap',()=>{
 for(const n of [100,240,400,800])for(const f of spiralFamilies(seedPattern(n))){
  const angles=f.arms.map(arm=>{const p=arm.at(-1);return Math.atan2(p.y-130,p.x-130);});
  for(let i=0;i<angles.length;i++){
   const gap=(angles[(i+1)%angles.length]-angles[i]+2*Math.PI)%(2*Math.PI);
   assert.ok(gap>0&&gap<1.5*2*Math.PI/f.count,`${n} seeds, ${f.count} arms: distant jump ${gap}`);
  }
 }
});
