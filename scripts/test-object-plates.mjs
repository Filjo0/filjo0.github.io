import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as THREE from '../assets/vendor/three.module.js';
import {composePlate,plateMetrics} from '../world/plate-views.js';
const manifest=JSON.parse(await readFile(new URL('../assets/outdoor/object-views.json',import.meta.url),'utf8'));
test('calibrated paper and screen edges fit the viewport, including tapered clipboard and landscape',()=>{
 for(const asset of Object.values(manifest.views))for(const [w,h] of [[1440,900],[390,844],[320,568],[844,390]]){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
  const object={plate:asset,face:new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())};
  const camera=new THREE.PerspectiveCamera(49,w/h,.006,160);
  composePlate(object,camera,{clientWidth:w,clientHeight:h});
  for(const p of object.surfaceVertices){const q=p.clone().project(camera),x=(q.x+1)*w/2,y=(1-q.y)*h/2;
   assert.ok(x>=8&&x<=w-8&&y>=64&&y<=h-16,`${asset.image} ${w}x${h} corner (${x},${y})`);}
  geometry.dispose();object.face.material.dispose();
 }
});

test('engines without CSS perspective read on a rectangle inside the original photographic quad',()=>{
 for(const asset of Object.values(manifest.views))for(const [w,h] of [[1440,900],[390,844],[320,568],[844,390]]){
  const host={clientWidth:w,clientHeight:h},q=w<720&&asset.mobile_corners?asset.mobile_corners:asset.corners;
  const {corners}=plateMetrics(asset,host,false);
  assert.equal(corners[0][0],corners[3][0]);assert.equal(corners[1][0],corners[2][0]);
  assert.equal(corners[0][1],corners[1][1]);assert.equal(corners[2][1],corners[3][1]);
  for(const p of corners){const cross=q.map((a,i)=>{const b=q[(i+1)%4];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);});
   assert.ok(cross.every(v=>v>=-.001)||cross.every(v=>v<=.001),'The mesh must remain inside the actual paper/screen');}
 }
});


test('retained comparison sports screens project the real mesh into the complete area below Back',()=>{
 for(const id of ['ball','skate','surf'])for(const [w,h] of [[390,844],[320,568],[844,390]]){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
  const object={id,plate:manifest.views[id==='contact'?'contact':'ball'],face:new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())};
  const camera=new THREE.PerspectiveCamera(49,w/h,.006,160);
  composePlate(object,camera,{clientWidth:w,clientHeight:h});
  assert.equal(object.fullViewport,true);
  assert.deepEqual(object.currentArea,{width:w,height:h-64});
  const expected=[[0,64],[w,64],[w,h],[0,h]];
  object.surfaceVertices.forEach((p,i)=>{
   const q=p.clone().project(camera),x=(q.x+1)*w/2,y=(1-q.y)*h/2;
   assert.ok(Math.hypot(x-expected[i][0],y-expected[i][1])<.001);
  });
  geometry.dispose();object.face.material.dispose();
 }
});

test('the demo restores the desktop laptop or full-height compact Apps reading plane',()=>{
 for(const [w,h] of [[1440,900],[390,844],[320,844],[844,390]]){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
  const object={id:'work',plate:manifest.views.work,face:new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())};
  const camera=new THREE.PerspectiveCamera(49,w/h,.006,160),host={clientWidth:w,clientHeight:h};
  let initial;
  for(const expandScreen of [true,false]){
   object.expandScreen=expandScreen;composePlate(object,camera,host);
   const compact=w<720||h<500;assert.equal(object.fullViewport,compact);
   const projected=object.surfaceVertices.map(p=>{const q=p.clone().project(camera);return [(q.x+1)*w/2,(1-q.y)*h/2];});
   if(compact){
    const expected=[[0,64],[w,64],[w,h],[0,h]];
    projected.forEach((p,i)=>assert.ok(Math.hypot(p[0]-expected[i][0],p[1]-expected[i][1])<.001));
   }else for(const p of projected)assert.ok(p[0]>=8&&p[0]<=w-8&&p[1]>=64&&p[1]<=h-16);
   if(initial)assert.deepEqual(projected,initial,'Closing the demo restores exactly the original Apps plane');else initial=projected;
  }
  geometry.dispose();object.face.material.dispose();
 }
});

test('illustrated creative notebooks fill small viewports using their actual mesh',()=>{
 for(const id of ['plants','fibonacci'])for(const [w,h] of [[390,844],[320,568],[844,390]]){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
  const object={id,plate:manifest.views.books,face:new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())};
  const camera=new THREE.PerspectiveCamera(49,w/h,.006,160);
  composePlate(object,camera,{clientWidth:w,clientHeight:h});
  assert.equal(object.fullViewport,true);
  const expected=[[0,64],[w,64],[w,h],[0,h]];
  object.surfaceVertices.forEach((p,i)=>{const q=p.clone().project(camera);
   assert.ok(Math.hypot((q.x+1)*w/2-expected[i][0],(1-q.y)*h/2-expected[i][1])<.001);
  });
  geometry.dispose();object.face.material.dispose();
 }
});


test('short-phone book framing enlarges real paper without changing other book-backed objects',()=>{
 const asset=manifest.views.books;
 const plain=plateMetrics(asset,{clientWidth:320,clientHeight:568},false);
 const reading=plateMetrics(asset,{clientWidth:320,clientHeight:568},false,true);
 assert.ok(reading.height*reading.scale>=460);
 assert.ok(reading.height*reading.scale>plain.height*plain.scale);
 for(const [w,h] of [[1440,900],[390,844]]){
  assert.deepEqual(plateMetrics(asset,{clientWidth:w,clientHeight:h},false,true),
   plateMetrics(asset,{clientWidth:w,clientHeight:h},false));
 }
});

test('sports use a genuine full-viewport mesh on desktop as well as phones',()=>{
 for(const id of ['ball','skate','surf'])for(const [w,h] of [[1440,900],[1280,720],[390,844],[844,390]]){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
  const object={id,fullScreenGame:true,plate:{width:1600,height:900,kind:'game',corners:[[0,0],[1600,0],[1600,900],[0,900]]},
   face:new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())};
  const camera=new THREE.PerspectiveCamera(49,w/h,.006,160);
  composePlate(object,camera,{clientWidth:w,clientHeight:h});
  assert.deepEqual(object.currentArea,{width:w,height:h-64});
  for(const [i,p] of object.surfaceVertices.entries()){
   const q=p.clone().project(camera),x=(q.x+1)*w/2,y=(1-q.y)*h/2;
   const expected=[[0,64],[w,64],[w,h],[0,h]][i];
   assert.ok(Math.hypot(x-expected[0],y-expected[1])<.001);
  }
  geometry.dispose();object.face.material.dispose();
 }
});

test('Contact uses measured phone glass instead of expanding HTML beyond the photograph',()=>{
 for(const [w,h] of [[1440,900],[390,844],[390,664],[375,553],[320,568],[844,390]]){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
  const asset=manifest.views.contact,object={id:'contact',plate:asset,face:new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())};
  const camera=new THREE.PerspectiveCamera(49,w/h,.006,160);
  composePlate(object,camera,{clientWidth:w,clientHeight:h});
  assert.equal(object.fullViewport,false);
  const photoHeight=2*Math.tan(THREE.MathUtils.degToRad(49/2))*100,photoWidth=photoHeight*asset.width/asset.height;
  for(const p of object.surfaceVertices){
   const x=(p.x/photoWidth+.5)*asset.width,y=(.5-p.y/photoHeight)*asset.height;
   const ring=[[638,110],[1020,110],[1030,837],[635,837]];
   for(let i=0;i<4;i++){
    const [ax,ay]=ring[i],[bx,by]=ring[(i+1)%4];
    assert.ok(((bx-ax)*(y-ay)-(by-ay)*(x-ax))/Math.hypot(bx-ax,by-ay)>=-.001,'Content stays below the camera and within measured glass');
   }
   const q=p.clone().project(camera),sx=(q.x+1)*w/2,sy=(1-q.y)*h/2;
   assert.ok(sx>=8&&sx<=w-8&&sy>=64&&sy<=h-16,'Glass remains visible at '+w+'x'+h);
  }
  geometry.dispose();object.face.material.dispose();
 }
});
