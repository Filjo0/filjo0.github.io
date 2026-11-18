import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {placeMarkers,markerAnchor,markerVisible} from '../world/scene-marker-layout.js';
import {clipRing,pointInRing,rectangleHitsRing} from '../world/scene-object-geometry.js';
const layout=JSON.parse(readFileSync(new URL('../assets/outdoor/hotspot-layout.json',import.meta.url),'utf8'));
const widths={work:75,contact:79,resume:71,experience:64,books:56,fibonacci:64,globe:104,aqua:100,futsl:58};
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
function fixtures(w,h,centre){
 const fw=Math.max(w,h*1672/941),fh=fw*941/1672,left=Math.max(0,Math.min(fw-w,fw*centre-w/2)),top=(fh-h)/2;
 const viewport={left:8,right:w-8,top:w<960?80:92,bottom:w<960?h-74:h-8};
 const markers=Object.entries(layout.targets).map(([id,m])=>{
  const raw=m.outline.map(([u,v])=>[u*fw-left,v*fh-top]),outline=clipRing(raw,viewport);
  return {id,raw,outline,anchor:[m.anchor[0]*fw-left,m.anchor[1]*fh-top],size:{width:widths[id],height:44}};
 }).filter(m=>markerVisible(m.raw,m.outline));
 const pan=w<720&&h>w?[{left:w/2-67,right:w/2+67,top:h-126,bottom:h-82}]:[];
 return {viewport,markers,pan};
}
test('persistent marker pills fit the actual seven scene sizes without shrinking or moving objects',()=>{
 for(const [w,h] of [[1440,900],[1280,720],[390,844],[390,664],[375,553],[320,568],[844,390]])
  for(const centre of [w<720?.18:.5,w<720?.565:.5]){
   const {viewport,markers,pan}=fixtures(w,h,centre),result=placeMarkers(markers,viewport,pan);
   assert.ok(result.ok,'Marker layout fits '+w+'x'+h);
   const values=Object.values(result.positions);
   for(const m of markers){
    const p=result.positions[m.id];assert.ok(p,'Every enabled object gets a marker');
    assert.ok(p.box.right-p.box.left>=44-1e-9&&Math.abs(p.box.bottom-p.box.top-44)<1e-9,'Keep real 44px pill targets');
    assert.ok(p.pill.left>=8&&p.pill.right<=w-8&&p.pill.top>=viewport.top&&p.pill.bottom<=viewport.bottom,'No clipping');
    assert.ok(Math.hypot(p.anchor[0]-p.end[0],p.anchor[1]-p.end[1])<=44,'The name remains attached');
    for(const obstacle of pan)assert.ok(!overlap(p.box,obstacle),'The pan control stays clear');
    for(const other of values)if(other!==p)assert.ok(!overlap(p.box,other.box),'Marker targets do not overlap');
   }
  }
});
test('visible anchors stay on their objects; edge clipping never relocates them to empty scenery',()=>{
 const ring=[[0,120],[50,120],[50,170],[0,170]],v={left:8,right:312,top:80,bottom:494};
 assert.deepEqual(markerAnchor([25,145],ring,v),[25,145]);
 const edge=markerAnchor([-12,145],ring,v);assert.ok(pointInRing([edge[0]+.001,edge[1]],ring));
 assert.ok(edge[0]>=11&&edge[0]<=50);
});
test('unrecognizable crop slivers cannot leave detached clickable markers at a viewport edge',()=>{
 const raw=[[0,0],[100,0],[100,100],[0,100]];
 assert.equal(markerVisible(raw,[[0,0],[25,0],[25,100],[0,100]]),false);
 assert.equal(markerVisible(raw,[[0,0],[60,0],[60,100],[0,100]]),true);
});
test('panning can reuse a valid placement, but still rejects collisions with a new control',()=>{
 const a=fixtures(390,664,.18),first=placeMarkers(a.markers,a.viewport,a.pan);assert.ok(first.ok);
 const again=placeMarkers(a.markers,a.viewport,a.pan,first.positions);assert.ok(again.ok&&again.reused);
 const blocked=Object.values(first.positions)[0].box;
 const next=placeMarkers(a.markers,a.viewport,[...a.pan,blocked],first.positions);
 assert.ok(!next.reused,'A cached placement cannot bypass the collision checks');
 if(next.ok)for(const p of Object.values(next.positions))assert.ok(!overlap(p.box,blocked));
});
test('impossible layouts return an explicit failure rather than shrinking text or moving dots',()=>{
 const result=placeMarkers([{id:'one',anchor:[50,50],outline:[[10,10],[90,10],[90,90],[10,90]],size:{width:200,height:44}}],
  {left:8,right:92,top:8,bottom:92});
 assert.equal(result.ok,false);
 const clipped=placeMarkers([{id:'one',anchor:[2,2],outline:[[0,0],[2,0],[2,2],[0,2]],size:{width:60,height:44}}],
  {left:8,right:92,top:8,bottom:92});
 assert.equal(clipped.ok,false);assert.deepEqual(clipped.positions,{});
});

test('the tall narrow Book stays reachable without covering neighbouring objects',()=>{
 const {viewport,markers,pan}=fixtures(320,844,.18),fw=844*1672/941,left=fw*.18-160,meta=layout.targets.books;
 const raw=meta.outline.map(([u,v])=>[u*fw-left,v*844]);
 if(!markers.some(m=>m.id==='books'))markers.push({id:'books',anchor:[meta.anchor[0]*fw-left,meta.anchor[1]*844],
  outline:clipRing(raw,viewport),size:{width:widths.books,height:44}});
 for(const m of markers)m.size.width=(m.size.width-20)*11/12+20;
 const result=placeMarkers(markers,viewport,pan);assert.ok(result.ok);
 assert.ok(result.positions.books,'The cropped Book is still a genuine keyboard/click target');
 assert.ok(result.positions.books.pill.left>=8);
});


test('a contrast-driven name preference moves the caption while preserving its dot and collision rules',()=>{
 const marker={id:'pool',anchor:[100,100],outline:[[80,80],[120,80],[120,120],[80,120]],size:{width:80,height:44},preferAbove:true,minGap:32};
 const viewport={left:8,top:8,right:212,bottom:212};
 const above=placeMarkers([marker],viewport);assert.ok(above.ok);assert.ok(above.positions.pool.end[1]<100);
 assert.ok(Math.hypot(above.positions.pool.end[0]-100,above.positions.pool.end[1]-100)>=32);
 assert.deepEqual(above.positions.pool.anchor,[100,100]);
 const blocked=placeMarkers([marker],viewport,[{left:0,top:0,right:220,bottom:100}]);
 assert.ok(blocked.ok);assert.ok(blocked.positions.pool.box.top>100);assert.deepEqual(blocked.positions.pool.anchor,[100,100]);
});


test('the measured 375x553 plain-name layout resolves within the unchanged search budget',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/short-phone-marker-layout.json',import.meta.url),'utf8'));
 const result=placeMarkers(fixture.markers,fixture.viewport,fixture.obstacles);
 assert.ok(result.ok);assert.equal(Object.keys(result.positions).length,fixture.markers.length);
 assert.ok(result.steps<15000);
});

test('measured icon tabs attach to the real object edges without sacrificing targets or calibration',()=>{
 const cases=JSON.parse(readFileSync(new URL('./fixtures/attached-tabs.json',import.meta.url),'utf8'));
 for(const c of cases){
  const result=placeMarkers(c.markers,c.viewport);assert.ok(result.ok,String(c.width));
  for(const marker of c.markers){
   const p=result.positions[marker.id];assert.deepEqual(p.anchor,markerAnchor(marker.anchor,marker.outline,c.viewport));
   assert.ok(p.box.bottom-p.box.top===44&&p.box.right-p.box.left>=44);
   assert.ok(p.pill.left>=c.viewport.left&&p.pill.right<=c.viewport.right);
   const edge=marker.outline.some((a,i)=>rectangleHitsRing(p.pill,[a,marker.outline[(i+1)%marker.outline.length]],3));
   assert.ok(edge,marker.id+' remains attached to its own edge');
   for(const other of c.markers.filter(m=>m!==marker))assert.ok(!rectangleHitsRing(p.pill,other.outline,2));
   for(const other of Object.values(result.positions).filter(q=>q!==p))assert.ok(!overlap(p.box,other.box));
  }
 }
});

test('outside captions uncover their own object and reject an overlapping cached placement',()=>{
 const marker={id:'phone',anchor:[150,130],outline:[[100,100],[200,100],[200,160],[100,160]],
  size:{width:80,height:44},visualHeight:22};
 const viewport={left:8,top:8,right:292,bottom:292};
 const previous=placeMarkers([marker],viewport);assert.ok(previous.ok);
 assert.ok(rectangleHitsRing(previous.positions.phone.pill,marker.outline,0),'The former placement covers the object');
 const outside=placeMarkers([{...marker,outsideObject:true}],viewport,[],previous.positions);
 assert.ok(outside.ok);assert.ok(!outside.reused,'A cached overlap must be replaced');
 assert.ok(!rectangleHitsRing(outside.positions.phone.pill,marker.outline,3),'The entire visible caption clears its own outline');
 assert.deepEqual(outside.positions.phone.anchor,marker.anchor,'The dot keeps its calibrated object anchor');
 assert.equal(outside.positions.phone.box.bottom-outside.positions.phone.box.top,44,'The native target keeps its height');
});

test('a pinned name sits directly below or above its own dot when there is room',()=>{
 const marker={id:'phone',anchor:[150,130],outline:[[120,115],[180,115],[180,145],[120,145]],
  size:{width:80,height:44},visualHeight:26,outsideObject:true};
 const result=placeMarkers([marker],{left:8,top:8,right:292,bottom:292});
 assert.ok(result.ok&&result.strictStems);
 const p=result.positions.phone;
 assert.ok(p.pill.left+10<=150&&p.pill.right-10>=150,'The dot is horizontally inside its name, so the stem is vertical');
 assert.ok(p.pill.top>=145||p.pill.bottom<=115,'The whole name stays outside its own object');
 assert.ok(Math.abs(p.end[0]-p.start[0])<1e-9,'The joining stem is vertical');
});

test('a stem never runs through another name when a clean layout exists',()=>{
 const make=(id,x)=>({id,anchor:[x,150],outline:[[x-15,140],[x+15,140],[x+15,160],[x-15,160]],
  size:{width:70,height:44},visualHeight:26,outsideObject:true});
 const markers=[make('a',120),make('b',150),make('c',180)];
 const result=placeMarkers(markers,{left:8,top:8,right:312,bottom:312});
 assert.ok(result.ok&&result.strictStems,'Three crowded names still find stems that avoid every other name');
 const stemHitsPill=(s,r)=>{
  const n=Math.ceil(Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1])/2);
  for(let i=0;i<=n;i++){const t=n?i/n:0,x=s.start[0]+(s.end[0]-s.start[0])*t,y=s.start[1]+(s.end[1]-s.start[1])*t;
   if(x>r.left&&x<r.right&&y>r.top&&y<r.bottom)return true;}
  return false;
 };
 for(const a of markers)for(const b of markers)if(a!==b)
  assert.ok(!stemHitsPill(result.positions[a.id],result.positions[b.id].pill),a.id+' stem avoids the '+b.id+' name');
});

test('the measured phone and desktop desks pin every name above or below its dot',()=>{
 for(const [w,h,centre] of [[390,664,.18],[320,568,.18],[1440,900,.5]]){
  const {viewport,markers,pan}=fixtures(w,h,centre);
  const result=placeMarkers(markers.map(m=>({...m,visualHeight:26,outsideObject:true})),viewport,pan);
  assert.ok(result.ok,'Layout fits '+w+'x'+h);
  for(const m of markers){
   const p=result.positions[m.id];
   assert.ok(p.pill.left+10<=m.anchor[0]&&p.pill.right-10>=m.anchor[0],m.id+' at '+w+'x'+h+': name centred on its dot');
  }
 }
});
