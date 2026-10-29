import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceMatrix,readableArea,projectSurface} from '../world/surfaces.js';
import * as THREE from '../assets/vendor/three.module.js';
function map(m,x,y){const w=m[3]*x+m[7]*y+m[15];return {x:(m[0]*x+m[4]*y+m[12])/w,y:(m[1]*x+m[5]*y+m[13])/w};}
test('HTML corners follow the exact mesh quadrilateral, including perspective',()=> {
  for(const corners of [
    [{x:20,y:30},{x:500,y:30},{x:500,y:400},{x:20,y:400}],
    [{x:40,y:80},{x:710,y:30},{x:630,y:660},{x:110,y:590}]
  ]) {
    const m=surfaceMatrix(corners,560,640);
    [[0,0],[560,0],[560,640],[0,640]].forEach(([x,y],i)=> {
      const p=map(m,x,y);assert.ok(Math.abs(p.x-corners[i].x)<1e-8);assert.ok(Math.abs(p.y-corners[i].y)<1e-8);
    });
  }
});
test('degenerate or non-finite projections cannot generate a CSS transform',()=> {
  assert.equal(surfaceMatrix([{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}],200,300),null);
  assert.equal(surfaceMatrix([],200,300),null);
  assert.equal(surfaceMatrix([{x:NaN,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}],50,50),null);
});
test('readable inspection area stays within the original face at phone and landscape sizes',()=> {
  for(const [clientWidth,clientHeight] of [[1440,750],[390,630],[320,610],[844,250]]) {
    for(const object of [{width:1.4,height:2,kind:'board'},{width:.24,height:.48,kind:'phone'}]) {
      const a=readableArea(object,{clientWidth,clientHeight});
      assert.ok(a.width<=object.width&&a.height<=object.height);
      assert.ok(a.height>0&&a.availableWidth>=Math.min(256,clientWidth-64));
    }
  }
});
test('behind-camera faces remain hidden rather than projecting an unrelated overlay',()=> {
  const root=new THREE.Group(),face=new THREE.Mesh(new THREE.PlaneGeometry(1,1));root.add(face);
  root.position.z=3;root.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.lookAt(0,0,-1);camera.updateMatrixWorld();
  const element={style:{},dataset:{}};
  assert.equal(projectSurface(element,{root,face,width:1,height:1,kind:'board'},camera,
    {clientWidth:500,clientHeight:600}),false);
  assert.equal(element.style.transform,undefined);
});

test('real captured flows have intact images, public sources, dates and reachable measured controls',()=> {
  const data=JSON.parse(readFileSync(new URL('../assets/previews/previews.json',import.meta.url),'utf8'));
  for(const [id,project] of Object.entries(data.projects)) {
    assert.ok(Number.isFinite(Date.parse(project.capturedAt)));
    const screens=new Map(project.screens.map(s=>[s.id,s]));assert.ok(screens.has(project.start));
    for(const screen of screens.values()) {
      const bytes=readFileSync(new URL('../'+screen.image,import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),screen.sha256);
      assert.equal(new URL(screen.sourceUrl).hostname,id==='aqua'?'aqualocal.com.au':'perth-futsal.onrender.com');
      for(const h of screen.hotspots){assert.ok(screens.has(h.target));
        assert.ok(h.rect.width>0&&h.rect.height>0&&h.rect.x>=0&&h.rect.y>=0);
        assert.ok(h.rect.x+h.rect.width<=screen.width+.01&&h.rect.y+h.rect.height<=screen.height+.01);
      }
    }
  }
});
