import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceCamera,fromPlate,projectPlateRing,destinations,walkable,findPath,hotspotTargets,hotspotLabelTargets} from '../world/concept-layout.js';
import {createRegions} from '../world/regions.js';

test('measured object anchors project back onto the approved pixels',()=>{
  const camera=referenceCamera();
  for(const [u,v,h] of [[.151,.61,.84],[.228,.614,.96],[.643,.412,.15],[.565,.66,0]]) {
    const p=fromPlate(u,v,h).project(camera);
    assert.ok(Math.abs((p.x+1)/2-u)<1e-8);assert.ok(Math.abs((1-p.y)/2-v)<1e-8);
  }
});
test('every destination is on connected solid ground; routes avoid planted and water areas',()=>{
  for(const [id,p] of Object.entries(destinations)) {
    assert.ok(walkable(p.x,p.z),id+' has a solid-ground approach');
    const route=findPath(destinations.overview,p);assert.ok(route,id+' is connected');
    let previous=destinations.overview;
    for(const point of route) {
      const n=Math.max(2,Math.ceil(previous.distanceTo(point)/.04));
      for(let i=0;i<=n;i++){
        const t=i/n;assert.ok(walkable(previous.x+(point.x-previous.x)*t,previous.z+(point.z-previous.z)*t),id+' route collision');
      }
      previous=point;
    }
  }
  assert.equal(walkable(...[fromPlate(.86,.70).x,fromPlate(.86,.70).z]),false,'ocean is blocked');
  assert.equal(walkable(fromPlate(.15,.77).x,fromPlate(.15,.77).z),false,'desk is blocked');
  const main=['work','experience','resume','contact'].map(id=>destinations[id]);
  assert.equal(new Set(main.map(p=>p.toArray().join(','))).size,4,'four distinct approaches');
});
test('season transformation reverses without jumping, settles, and can be cancelled',async()=>{
  const applied=[],changed=[];
  const seasons=createRegions({ready:Promise.resolve(),apply:v=>applied.push(v),changed:r=>changed.push(r)});
  await seasons.select('winter');seasons.step(.6);const midway=seasons.state().blend;
  assert.ok(midway>0&&midway<1);await seasons.select('coast');assert.equal(seasons.state().blend,midway);
  seasons.step(1.8);assert.equal(seasons.state().region,'coast');assert.equal(seasons.state().blend,0);
  await seasons.select('winter');seasons.step(.4);seasons.cancel();assert.equal(seasons.state().blend,0);
  seasons.step(10);assert.equal(seasons.state().region,'coast');
  await seasons.select('winter');seasons.step(1.8);assert.equal(seasons.state().phase,'settled');
  assert.equal(seasons.state().blend,1);assert.deepEqual(changed.at(-1),'winter');seasons.dispose();
});
test('seasons load before use; latest request wins; failure does not start transformation',async()=>{
  let release;const ready=new Promise(resolve=>release=resolve);let applied=-1;
  const seasons=createRegions({ready,apply:v=>applied=v,changed(){},reduced:()=>true});
  const first=seasons.select('winter'),last=seasons.select('coast');assert.equal(applied,-1);
  release();assert.equal(await first,false);assert.equal(await last,true);assert.equal(seasons.state().region,'coast');
  let failures=0;
  const failed=createRegions({ready:Promise.reject(new Error('missing')),apply(){},changed(){},failed(){failures++;}});
  assert.equal(await failed.select('winter'),false);assert.equal(failures,1);assert.equal(failed.state().region,'coast');
  assert.equal(failed.state().phase,'failed');seasons.dispose();failed.dispose();
});

test('navigation cancels a season request while artwork is still loading',async()=>{
  let release;const ready=new Promise(resolve=>release=resolve);
  const seasons=createRegions({ready,apply(){},changed(){},reduced:()=>true});
  const pending=seasons.select('winter');seasons.cancel();release();
  assert.equal(await pending,false);assert.equal(seasons.state().region,'coast');
  assert.equal(seasons.state().phase,'settled');seasons.dispose();
});

test('object-mode dots agree with recorded pictured-object bounds',()=>{
  const layout=JSON.parse(readFileSync(new URL('../art/outdoor/hotspot-layout.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(hotspotTargets).sort(),Object.keys(layout.targets).sort());
  for(const [id,{anchor,box}] of Object.entries(layout.targets)){
    assert.deepEqual(hotspotTargets[id],anchor,id+' has one recorded anchor');
    const [u,v]=anchor,[l,t,r,b]=box;
    assert.ok(l>=0&&t>=0&&r<=1&&b<=1&&l<r&&t<b,id+' box is within both plates');
    assert.ok(u>=l&&u<=r&&v>=t&&v<=b,id+' dot sits on its object');
  }
  // A loose bounding box also includes the desk beside the slanted clipboard.
  const paper=layout.targets.resume.surface_polygon,[u,v]=hotspotTargets.resume;
  const crosses=paper.map(([x,y],i)=>{const [xx,yy]=paper[(i+1)%paper.length];return (xx-x)*(v-y)-(yy-y)*(u-x);});
  assert.ok(crosses.every(n=>n>0)||crosses.every(n=>n<0),'Résumé dot is inside the actual clipboard, not just its box');
  assert.deepEqual(hotspotLabelTargets.resume,layout.targets.resume.mobile_label_anchor);
  assert.ok(hotspotLabelTargets.resume[1]>layout.targets.resume.box[3],'Mobile name is below the clipboard');
  assert.deepEqual(hotspotTargets.fibonacci,[.073,.742,.84],'Maths notebook uses its pictured desk anchor');
});


test('B1 silhouettes are valid, plate-specific, separated and camera-calibrated',()=>{
  const data=JSON.parse(readFileSync(new URL('../art/outdoor/hotspot-layout.json',import.meta.url),'utf8'));
  const inside=([x,y],ring)=>ring.reduce((result,[ax,ay],i)=>{
    const [bx,by]=ring[(i+1)%ring.length];
    return (ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax?!result:result;
  },false);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const intersect=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
  const camera=referenceCamera();
  assert.equal(data.outline_schema.version,1);
  assert.equal(data.outline_schema.plates.length,4);
  assert.equal(Object.keys(data.targets).length,9);
  for(const [id,target] of Object.entries(data.targets)){
    for(const name of Object.keys(target.outline_variants||{}))assert.ok(data.outline_schema.plates.includes(name),'override selects an active filename');
    for(const plate of data.outline_schema.plates){
      assert.ok(readFileSync(new URL('../assets/outdoor/'+plate,import.meta.url)).length>0);
      const shape=target.outline_variants?.[plate]||target;
      assert.ok(inside(target.anchor,shape.outline),id+' existing anchor is on the traced object: '+plate);
      for(const hole of shape.outline_holes||[]){
        assert.ok(hole.every(p=>inside(p,shape.outline)),id+' transparent handle lies inside the outer ring');
        assert.ok(!inside(target.anchor,hole),id+' anchor is not in a hole');
      }
      for(const ring of [shape.outline,...shape.outline_holes||[]]){
        assert.ok(ring.length>=3&&ring.length<=100,'bounded polygon size');
        ring.forEach(([u,v],i)=>{
          assert.ok(Number.isFinite(u)&&Number.isFinite(v)&&u>=0&&u<=1&&v>=0&&v<=1,'normalized coordinates');
          const [l,t,r,b]=target.outline_bounds;
          assert.ok(u>=l-1e-7&&u<=r+1e-7&&v>=t-1e-7&&v<=b+1e-7,id+' silhouette stays in measured outline bounds');
          const projected=fromPlate(u,v,target.anchor[2]).project(camera);
          assert.ok(Math.hypot(((projected.x+1)/2-u)*1672,((1-projected.y)/2-v)*941)<.001,'outline shares actual reference projection');
          const a=ring[(i+1)%ring.length];assert.notDeepEqual([u,v],a,'no zero length edges');
          for(let j=i+2;j<ring.length;j++){
            if(i===0&&j===ring.length-1)continue;
            assert.ok(!intersect([u,v],a,ring[j],ring[(j+1)%ring.length]),id+' ring has no crossing edges');
          }
        });
      }
    }
  }
  for(const plate of data.outline_schema.plates){
    const shapes=Object.entries(data.targets).map(([id,t])=>[id,(t.outline_variants?.[plate]||t).outline]);
    for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){
      const [id,a]=shapes[i],[other,b]=shapes[j];
      assert.ok(a.every(p=>!inside(p,b))&&b.every(p=>!inside(p,a)),id+' and '+other+' outlines do not overlap');
      for(let k=0;k<a.length;k++)for(let l=0;l<b.length;l++)assert.ok(!intersect(a[k],a[(k+1)%a.length],b[l],b[(l+1)%b.length]),'neighbouring silhouettes never cross');
    }
  }
});


test('silhouettes preserve real camera projection through viewport crop and pan',()=>{
  const camera=referenceCamera();
  for(const [w,h,pan] of [[1440,816,0],[390,772,0],[320,496,80],[844,342,180]]){
    const fullW=Math.max(w,h*1672/941),fullH=fullW*941/1672;
    const left=Math.max(0,Math.min(fullW-w,fullW*(w<720?.18:.5)-w/2+pan)),top=(fullH-h)/2;
    camera.setViewOffset(fullW,fullH,left,top,w,h);camera.updateProjectionMatrix();
    const ring=[[.09,.54],[.194,.674],[.257,.669]];
    projectPlateRing(ring,.84,camera,w,h).forEach(([x,y],i)=>{
      assert.ok(Math.hypot(x-(ring[i][0]*fullW-left),y-(ring[i][1]*fullH-top))<.001);
    });
  }
});
test('cropped outlines keep their genuine edges and retain an inset viewport rim',async()=>{
  const {clipRing,bounds}=await import('../world/scene-object-geometry.js');
  const ring=[[-20,100],[60,80],[70,160],[-30,170]],clipped=clipRing(ring,{left:12,right:390,top:72,bottom:760});
  assert.equal(bounds(clipped).left,12);assert.ok(clipped.some(([x,y])=>x===60&&y===80));
  assert.ok(clipped.every(([x,y])=>x>=12&&y>=72&&x<=390&&y<=760));
});
test('labels avoid neighbours and connect to their actual polygon within one pixel',async()=>{
  const {labelPlacement,nearestPoint,rectangleHitsRing}=await import('../world/scene-object-geometry.js');
  const phone=[[166,558],[200,551],[224,572],[191,582]],other=[[230,477],[307,477],[307,566],[230,566]];
  const result=labelPlacement(phone,{width:112,height:44},{left:8,right:382,top:80,bottom:760},[other]);
  assert.ok(result);assert.ok(!rectangleHitsRing(result.box,phone)&&!rectangleHitsRing(result.box,other));
  assert.ok(Math.hypot(...nearestPoint(result.start,phone).map((n,i)=>n-result.start[i]))<.001);
  assert.ok(result.end[0]===result.box.left||result.end[0]===result.box.right||result.end[1]===result.box.top||result.end[1]===result.box.bottom);
});

// Lazy winter preparation must not commit an obsolete or failed season change.
test('lazy season assets wait before transition and cancellation supersedes the load',async()=>{
  let resolveWinter;
  const pending=new Promise(r=>resolveWinter=r),changes=[];
  const seasons=createRegions({ready:Promise.resolve(),prepare:n=>n==='winter'?pending:Promise.resolve(),
    apply(){},changed:n=>changes.push(n),reduced:()=>true});
  const winter=seasons.select('winter');await Promise.resolve();await Promise.resolve();
  assert.equal(seasons.state().region,'coast');assert.equal(seasons.state().blend,0);
  await seasons.select('coast');resolveWinter();assert.equal(await winter,false);
  assert.equal(changes.at(-1),'coast');
  await seasons.select('winter');assert.equal(seasons.state().region,'winter');seasons.dispose();
});
test('lazy season asset failure reports once without showing an incomplete scene',async()=>{
  let errors=0;const seasons=createRegions({ready:Promise.resolve(),prepare:()=>Promise.reject(new Error('missing')),
    apply(){},changed(){},failed(){errors++;},reduced:()=>true});
  assert.equal(await seasons.select('winter'),false);assert.equal(errors,1);
  assert.equal(seasons.state().region,'coast');assert.equal(seasons.state().blend,0);seasons.dispose();
});
