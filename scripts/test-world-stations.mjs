import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three.module.js';
import {createAvatar} from '../world/avatar.js';
import {createStations} from '../world/stations/index.js';
import {walkable} from '../world-state.js';
function setup(){
 const scene=new THREE.Scene();
 const mat=color=>new THREE.MeshStandardMaterial({color});
 function mesh(geometry,material,x=0,y=0,z=0,parent=scene){
  const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);parent.add(o);return o;
 }
 const avatar=createAvatar({scene,mesh,mat,materials:{skin:mat('#b58b69')}});
 const ball=mesh(new THREE.SphereGeometry(.17),mat('#eee'),-16,.17,-6);
 const board=mesh(new THREE.BoxGeometry(1,.1,3),mat('#bbb'),18,.1,7);
 const tank=mesh(new THREE.BoxGeometry(4,2,4),mat('#777'),-16,.45,13);
 const skates=new THREE.Group();
 const context={avatar,scene,mesh,mat,props:{ball,board,tank},view:{yaw:1},skates,
  winter:{markGate(){}}};
 let result=null,cleared=0;
 const stations=createStations(context,s=>{result=s;},()=>{cleared++;});
 return {context,stations,result:()=>result,cleared:()=>cleared};
}
test('all station cancellations restore pose, props, input and safe walking ground',()=>{
 for(const type of ['ball','penalty','surf','drive','skate']){
  const {context:c,stations:s,cleared}=setup();
  const ball=c.props.ball.position.clone(),board=c.props.board.position.clone(),tank=c.props.tank.position.clone();
  s.enter(type);s.update(.4,{dx:0,dz:0,yaw:0});s.exit();
  assert.equal(s.state(),null);assert.ok(walkable(c.avatar.root.position.x,c.avatar.root.position.z));
  assert.equal(c.avatar.root.position.y,0);assert.equal(c.avatar.hips.rotation.x,0);
  assert.equal(c.avatar.root.rotation.z,0);assert.equal(c.view.yaw,.2);assert.ok(cleared()>=2);
  assert.deepEqual(c.props.ball.position,type==='penalty'?new THREE.Vector3(-16,.17,-14):ball);assert.deepEqual(c.props.board.position,board);
  assert.deepEqual(c.props.tank.position,tank);assert.ok(c.avatar.limbs.every(l=>l.leg.visible));
 }
});
test('juggling kick cues match real geometry, accepted kicks swing the actual foot, loss restores walking',()=>{
 const {context:c,stations:s,result}=setup();s.enter('ball');let hit=false;
 for(let i=0;i<400&&s.state();i++){
  s.update(1/120,{dx:0,dz:0,yaw:0});const state=s.state();
  if(state?.canKick&&!hit){
   const foot=c.avatar.footWorld();assert.ok(c.props.ball.position.y-.17>foot.y);
   assert.ok(Math.hypot(c.props.ball.position.x-foot.x,c.props.ball.position.z-foot.z)<.4);
   assert.ok(s.kick());s.update(.18,{dx:0,dz:0,yaw:0});
   assert.ok(Math.abs(c.avatar.limbs[1].leg.rotation.x)>.3);hit=true;
  }
 }
 assert.ok(hit);assert.equal(result().phase,'lost');assert.equal(s.state(),null);
 assert.equal(c.props.ball.position.y,.17);assert.ok(walkable(c.avatar.root.position.x,c.avatar.root.position.z));
});
test('futsal approaches without a jump, launches at the foot and finishes with a grounded reset',()=>{
 const {context:c,stations:s,result}=setup();c.avatar.root.position.set(-16,0,-6);
 s.enter('penalty',{angle:0,power:16});s.update(.04,{dx:0,dz:0,yaw:0});
 assert.ok(Math.abs(c.avatar.root.position.z+6)<.13);let launched=false;
 for(let i=0;i<1200&&s.state();i++){
  s.update(1/120,{dx:0,dz:0,yaw:0});const state=s.state();
  if(state?.launch&&!launched){
   const foot=c.avatar.footWorld();const launch=new THREE.Vector3(state.launch.x,state.launch.y,state.launch.z);
   assert.ok(launch.distanceTo(foot)<.4);launched=true;
  }
  assert.ok(c.props.ball.position.z>=-20.23);
 }
 assert.ok(launched);assert.equal(result().phase,'goal');assert.equal(s.state(),null);
 assert.deepEqual(c.props.ball.position,new THREE.Vector3(-16,.17,-14));
 assert.equal(c.props.ball.position.y,.17);assert.ok(walkable(c.avatar.root.position.x,c.avatar.root.position.z));
});
