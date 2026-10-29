import * as THREE from '../assets/vendor/three.module.js';
import {fromPlate, destinations, walkable} from './concept-layout.js';
import {skatingGates} from '../world-state.js';
import {createSurf} from './stations/surf.js';
import {createJuggle} from './stations/juggle.js';
import {createFutsal} from './stations/futsal.js';
import {createSkate} from './stations/skate.js';
import {createTank} from './stations/tank.js';

// Each activity retains its tested local simulation. Frames place its actual
// geometry in the pictured court/pool/coast, with a human of unchanged height.
export function createConceptActivities(environment, person, view, onGame, clearInput, onExit) {
  const {scene,mat,mesh,box,resources,materials}=environment;
  let active=null;
  const operatorSpot=destinations.tank.clone().add(new THREE.Vector3(-.5,0,-.8));
  const remote=box(.14,.045,.08,mat('#303739',{metalness:.6}),0,1.05,.31,person.root);
  remote.visible=false;
  const definitions = {
    ball: {factory:createJuggle, uv:[.697,.449], home:[-16,-13], yaw:.65, scale:.65, route:'ball'},
    penalty: {factory:createFutsal, uv:[.656,.445], home:[-16,-20], yaw:.65, scale:.65, route:'ball'},
    surf: {factory:createSurf, uv:[.90,.47], home:[26,7], yaw:0, scale:1, route:'surf'},
    skate: {factory:createSkate, uv:[.80,.59], home:[0,-54], yaw:.2, scale:.7, route:'skate'},
    drive: {factory:createTank, uv:[.57,.81], home:[-16,13], yaw:0, scale:.1, route:'tank'}
  };
  const stations=new Map();
  for(const [type,d] of Object.entries(definitions)) {
    const frame=new THREE.Group(); frame.rotation.y=d.yaw;frame.scale.setScalar(d.scale);
    const home=new THREE.Vector3(d.home[0],0,d.home[1]).applyQuaternion(frame.quaternion).multiplyScalar(d.scale);
    frame.position.copy(fromPlate(...d.uv)).sub(home);frame.visible=false;scene.add(frame);
    const ball=mesh(new THREE.IcosahedronGeometry(.17,3),mat('#ece7d7'),-16,.17,-14,frame);
    const ink=mat('#242a2a');
    for(let i=0;i<12;i++) {
      const a=i*2.399,y=1-2*(i+.5)/12,r=Math.sqrt(1-y*y);
      const patch=mesh(new THREE.CircleGeometry(.046,5),ink,Math.cos(a)*r*.172,y*.172,Math.sin(a)*r*.172,ball);
      patch.lookAt(patch.position.clone().multiplyScalar(2));
    }
    const outline=new THREE.Shape();
    outline.moveTo(0,-1.05);outline.bezierCurveTo(-.36,-.8,-.36,.7,0,1.12);
    outline.bezierCurveTo(.36,.7,.36,-.8,0,-1.05);
    const boardGeometry=new THREE.ExtrudeGeometry(outline,{depth:.045,bevelEnabled:true,
      bevelThickness:.012,bevelSize:.012,bevelSegments:3,curveSegments:24,steps:1});
    boardGeometry.rotateX(-Math.PI/2);
    const board=mesh(boardGeometry,mat('#ebe4cf',{roughness:.3}),26,.03,7,frame);
    const tank=new THREE.Group();tank.position.set(-16,0,13);frame.add(tank);
    const metal=mat('#5c6851',{metalness:.6,roughness:.4});
    box(4.5,1.7,6.7,metal,0,1,0,tank);
    const turret=mesh(new THREE.CylinderGeometry(1.25,1.5,.75,24),metal,0,2,0,tank);
    box(.18,.18,3.6,metal,0,2,-2.8,turret);
    for(const side of [-1,1]) {
      box(.65,1.1,6.2,ink,side*2.25,.65,0,tank);
      for(let i=0;i<7;i++) {
        const wheel=mesh(new THREE.CylinderGeometry(.48,.48,.68,20),metal,side*2.25,.65,(i-3)*.8,tank);
        wheel.rotation.z=Math.PI/2;
      }
    }
    const skates=new THREE.Group();skates.visible=false;frame.add(skates);
    for(const x of [-.11,.11]) box(.025,.06,.27,metal,x,.035,0,skates);
    const props={ball,board,tank};
    const localRoot=new THREE.Group();
    const facade=new Proxy({}, {get(_,key) {
      if(key==='root') return localRoot;
      if(key==='footWorld') return (...args)=>frame.worldToLocal(person.footWorld(...args));
      if(key==='handWorld') return (...args)=>frame.worldToLocal(person.handWorld(...args));
      const value=person[key]; return typeof value==='function'?value.bind(person):value;
    }});
    // Juggling expects root.localToWorld to return the simulation's coordinates.
    // This proxy root is intentionally detached; syncActor maps it to the scene.
    const gates=[];
    const station=d.factory({avatar:facade,props,skates,view,
      isWalkable(x,z) {const p=frame.localToWorld(new THREE.Vector3(x,0,z));return walkable(p.x,p.z);},
      winter:{markGate(index){
        gates.forEach((gate,i)=>{gate.visible=index>=0&&i>=index;
          gate.material.opacity=i===index?1:.28;gate.material.emissiveIntensity=i===index?.9:.2;});
      },footprint(){}},mat:(color,options)=>{
        const material=mat(color,options);
        if(type==='surf') {
          material.transparent=true;material.opacity=color==='#487d87'?.42:.65;material.depthWrite=false;
          material.customProgramCacheKey=()=> 'concept-water-'+color;
          material.onBeforeCompile=shader=>{
            shader.vertexShader='varying vec2 activityUv;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
              '#include <begin_vertex>\nactivityUv=uv;');
            shader.fragmentShader='varying vec2 activityUv;\n'+shader.fragmentShader;
            if(color==='#487d87') {
              shader.uniforms.conceptWater=environment.waterImage;
              shader.fragmentShader='uniform sampler2D conceptWater;\n'+shader.fragmentShader;
              shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
                '#include <color_fragment>\n'+
                'diffuseColor.rgb=texture2D(conceptWater,vec2(0.90+activityUv.x*0.09,0.56+activityUv.y*0.04)).rgb;');
            }
            shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
              '#include <opaque_fragment>\n'+
              'float edge=min(min(activityUv.x,1.0-activityUv.x),min(activityUv.y,1.0-activityUv.y));'+
              'gl_FragColor.a*=smoothstep(0.0,0.24,edge);');
          };
        }
        return material;
      },mesh:(g,m,x,y,z,parent=frame)=>mesh(g,m,x,y,z,parent)});
    if(type==='skate') for(const {x,z} of skatingGates) {
      const material=mat('#e0b46e',{emissive:'#e0b46e',emissiveIntensity:.9,transparent:true});
      const gate=mesh(new THREE.TorusGeometry(.95,.045,8,48),material,x,1.6,z,frame);
      gate.scale.y=1.6;gate.castShadow=false;gates.push(gate);
    }
    stations.set(type,{...d,frame,props,station,localRoot,skates,gates});
  }
  function syncActor() {
    if(!active)return;
    const p=active.frame.localToWorld(active.localRoot.position.clone());
    if(active.factory===createTank) {
      person.reset();person.root.position.copy(operatorSpot);
      person.root.rotation.y=Math.atan2(p.x-operatorSpot.x,p.z-operatorSpot.z);
      person.limbs.forEach(limb=>{limb.arm.rotation.x=-.3;});remote.visible=true;
    } else {
      person.root.position.copy(p);
      person.root.quaternion.copy(active.frame.quaternion).multiply(active.localRoot.quaternion);
    }
    person.root.updateMatrixWorld(true);
    if(person.update)person.update();
    if(active.skates.visible) for(let i=0;i<2;i++) {
      const foot=active.frame.worldToLocal(person.footWorld(i));
      active.skates.children[i].position.set(foot.x,foot.y-.035,foot.z);
    }
  }
  function exit() {
    if(!active)return;
    const route=active.route;
    active.station.exit();active.frame.visible=false;active=null;remote.visible=false;
    person.reset();person.root.rotation.set(0,0,0);person.root.position.copy(destinations[route]);
    clearInput();onExit(route);
  }
  return {
    enter(type,options) {
      exit();active=stations.get(type);if(!active)throw new Error('Unknown activity '+type);
      person.reset();clearInput();active.frame.visible=true;
      active.props.ball.visible=['ball','penalty'].includes(type);
      active.props.tank.visible=type==='drive';active.props.board.visible=type==='surf';
      active.localRoot.position.copy(active.frame.worldToLocal(person.root.position.clone()));
      active.localRoot.rotation.set(0,0,0);
      active.wait=options?.prepare||0;active.station.enter(options);
      if(type==='ball')active.localRoot.position.set(-16,0,-13);
      active.station.update(0,{dx:0,dz:0,yaw:0});syncActor();
    },
    update(dt,input) {
      if(!active)return;
      if(active.wait>0) {
        active.wait=Math.max(0,active.wait-dt);
        onGame({...active.station.state(),phase:'preparing',countdown:Math.ceil(active.wait)});return;
      }
      let remaining=dt;
      do {
        const step=Math.min(.04,remaining);
        active.station.update(step,{...input,yaw:input.yaw-active.yaw});
        syncActor();remaining-=step;
        if(['lost','won','goal','missed'].includes(active.station.state().phase))break;
      }while(remaining>.000001);
      const state=active.station.state();
      if(['lost','won','goal','missed'].includes(state.phase))exit();
      onGame(state);
    },
    exit,
    state:()=>active?{...active.station.state(),...(active.wait>0?{phase:'preparing',countdown:Math.ceil(active.wait)}:{})}:null,
    running:()=>!!active&&(active.wait>0||!active.station.running||active.station.running()),
    kick:()=>active?.wait>0?false:active?.station.kick?.()||false,
    stroke(){active?.station.stroke?.();},
    props:()=>active?.props||stations.get('ball').props,
    dispose(){exit();for(const s of stations.values())s.frame.removeFromParent();}
  };
}
