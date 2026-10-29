import {reducedMotion} from './motion.js';
import * as THREE from '../assets/vendor/three.module.js';
import {createConceptScene} from './concept-scene.js';
import {createConceptCamera} from './concept-camera.js';
import {createConceptActivities} from './concept-activities.js';
import {createSceneHotspots} from './scene-hotspots.js';
import {createAvatar} from './avatar.js';
import {createModelPerson} from './person-model.js';
import {createInput} from './input.js';
import {createRegions} from './regions.js';
import {geometryEvidence} from './surfaces.js';
import {destinations, walkable, findPath, nearestWalkable, fromPlate, targets} from './concept-layout.js';

export function createWorld({host,onNear,onArrive,onGame,onFailure,onRegion=()=>{},onSurface=()=>{},onObject=()=>{},onSeasonLoading=()=>{}}) {
  const walkthrough=new URLSearchParams(location.search).get('navigation')==='walk';
  const environment=createConceptScene({host,onFailure,walkthrough});
  const {scene,renderer,resources,portfolio}=environment;
  const person=createAvatar(environment), actor=person.root;
  actor.position.copy(destinations.overview);actor.rotation.y=Math.PI;actor.visible=false;
  const view=createConceptCamera(host,actor,{walkthrough}), camera=view.camera;
  const reduced=()=>reducedMotion();
  let route='overview',near='',path=[],arrival=null,paused=false,night=false,disposed=false;
  let frame=0,last=0,walkingPhase=0,character='loading',pendingPerson=null;
  let loaded=false,deviceGame=null;
  const snowPositions=new Float32Array(64*3);
  for(let i=0;i<64;i++) {
    snowPositions[i*3]=Math.sin(i*2.399)*.14;
    snowPositions[i*3+1]=(i%16)/16*.26;
    snowPositions[i*3+2]=Math.cos(i*2.399)*.14;
  }
  const snowGeometry=new THREE.BufferGeometry();
  snowGeometry.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));
  const snowMaterial=new THREE.PointsMaterial({color:'#fff8ed',size:.014,transparent:true,opacity:.9,depthTest:false});
  resources.push(snowGeometry,snowMaterial);
  const globeSnow=new THREE.Points(snowGeometry,snowMaterial);globeSnow.position.copy(fromPlate(...targets.globe));
  globeSnow.visible=false;globeSnow.renderOrder=10;scene.add(globeSnow);
  const regions=createRegions({ready:environment.ready,prepare:environment.prepareSeason,reduced,apply:environment.applySeason,
    loading:onSeasonLoading,changed(region) {onRegion(region);render();},failed:error=>onFailure({reason:'scene-asset-error',error})});
  const input=createInput({host,view,request,render,stop,active:()=>activities.state(),
    objects:portfolio.hitMeshes,onObject,inspecting:()=>!!view.inspecting(),isWalkable:walkable,
    onVisibility() {view.pause(document.hidden||paused);},
    walkingEnabled:()=>walkthrough||!!activities.state(),
    isObjectEnabled:o=>walkthrough&&
      !(regions.state().region==='winter'?['surf',...(!walkthrough?['ball']:[])]:['skate']).includes(o.userData.route),
    onGround(p) {if(regions.state().phase==='transition')return;path=findPath(actor.position,p)||[];arrival=null;request();}});
  const activityResult=game=>{
    if(!walkthrough&&['lost','won','goal','missed'].includes(game.phase))view.previewActivity(route);
    onGame(game);
  };
  const activities=createConceptActivities(environment,person,view,activityResult,()=>input.clear(),()=>{
    actor.position.copy(nearestWalkable(actor.position));
  });

  if(walkthrough)new THREE.GLTFLoader().load(new URL('../assets/outdoor/person.glb',import.meta.url).href,gltf=>{
    if(disposed) {
      gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();
        for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});return;
    }
    try {
      pendingPerson=createModelPerson(environment,gltf.scene);pendingPerson.root.removeFromParent();
      character='waiting';render();request();
    }catch{character='fallback';render();}
  },undefined,()=>{if(!disposed){character='fallback';render();}});

  const hotspots=walkthrough?null:createSceneHotspots(host,onObject,view,render);
  if(!walkthrough)character='none';
  Promise.all([environment.ready,hotspots?.ready]).then(()=>{
    if(disposed)return;loaded=true;host.dataset.sceneReady='true';render();request();
  }).catch(error=>{if(!disposed)onFailure({reason:'scene-asset-error',error});});


  function stop() {cancelAnimationFrame(frame);frame=0;last=0;}
  function request() {if(!frame&&!disposed&&!paused&&!document.hidden)frame=requestAnimationFrame(tick);}
  function render() {
    if(disposed)return;
    if(pendingPerson&&!activities.state()) {
      const next=pendingPerson;pendingPerson=null;
      next.root.position.set(0,0,0);actor.add(next.root);person.hips.removeFromParent();
      const reset=next.reset;
      Object.assign(person,next,{root:actor,reset(){actor.position.y=0;actor.rotation.z=0;reset();}});
      character='model';
    }
    const season=regions.state();
    if(person.modelled){person.setCold(season.blend>=.5);person.update();}
    actor.visible=loaded&&!view.inspecting()&&(walkthrough||!!activities.state());
    globeSnow.visible=season.phase==='transition'&&!reduced();
    view.update(activities.state());portfolio.inspect(view.inspecting());environment.highlight(activities.state()?null:near,camera);
    renderer.render(scene,camera);
    hotspots?.update(camera,season.region,loaded&&!view.inspecting()&&!activities.state()&&
      ['overview','coast','winter','globe'].includes(route),environment.lighting(),season,paused);
    onSurface(view.inspecting(),camera,!view.animating());
    renderer.domElement.dataset.worldState=JSON.stringify({
      renderer:'concept-scenes',navigation:walkthrough?'walk':'objects',character,position:{x:actor.position.x,y:actor.position.y,z:actor.position.z},
      region:season.region,snow:season.blend,transition:season,footprints:0,route,moving:path.length>0,
      paused,night,lighting:environment.lighting(),ready:loaded,walkable:walkable(actor.position.x,actor.position.z),game:deviceGame||activities.state(),
      geometry:geometryEvidence({avatar:person,props:activities.props(),camera,host,portfolio})
    });
  }
  function arrived(id) {
    if(id==='globe') {
      regions.toggle().then(()=>{if(!disposed){render();request();}});
      onArrive('overview');
    } else {
      if(!walkthrough&&['ball','surf','skate'].includes(id))view.previewActivity(id);
      onArrive(id);render();
    }
  }
  function tick(now) {
    frame=0;if(disposed||paused||document.hidden)return;
    const elapsed=last?Math.min((now-last)/1000,.25):0,dt=Math.min(elapsed,.04);last=now;
    const sample=input.sample();let moving=false;
    regions.step(elapsed);environment.stepLighting(elapsed);globeSnow.rotation.y+=dt*5;
    if(activities.state())activities.update(elapsed,sample);
    else if(walkthrough&&(sample.dx||sample.dz)&&regions.state().phase!=='transition') {
      path=[];arrival=null;
      const length=Math.hypot(sample.dx,sample.dz),speed=input.keys.has('run')?3.6:1.8;
      const x=sample.dx/length,z=sample.dz/length;
      const nx=actor.position.x+x*dt*speed,nz=actor.position.z+z*dt*speed;
      if(walkable(nx,nz)){actor.position.set(nx,0,nz);actor.rotation.y=Math.atan2(x,z);moving=true;}
    } else if(path.length) {
      const target=path[0],delta=target.clone().sub(actor.position),distance=Math.hypot(delta.x,delta.z),step=dt*2.8;
      if(distance<=Math.max(step,.02)) {
        actor.position.copy(target);path.shift();
        if(!path.length&&arrival&&regions.state().phase==='settled'){const id=arrival;arrival=null;arrived(id);}
      } else {actor.position.addScaledVector(delta,step/distance);actor.rotation.y=Math.atan2(delta.x,delta.z);moving=true;}
    }
    if(walkthrough&&!activities.state()) {
      if(moving){walkingPhase+=dt*8;person.walk(walkingPhase);}else person.reset();
      let closest='',distance=.65;
      for(const [id,p] of Object.entries(destinations)) {
        if(['overview','coast','winter'].includes(id))continue;
        const d=p.distanceTo(actor.position);
        if(d<distance){closest=id;distance=d;}
      }
      if(near!==closest){near=closest;onNear(near);}
    }
    if(!path.length&&arrival&&regions.state().phase==='settled'){const id=arrival;arrival=null;arrived(id);}
    render();
    if(path.length||arrival||input.keys.size||activities.running()||view.animating()||regions.state().phase==='transition'||
      environment.lightingRunning())request();
    else last=0;
  }
  const observer=new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);view.resize();render();});
  observer.observe(host);
  renderer.setSize(host.clientWidth,host.clientHeight);view.resize();onNear('');render();
  return {
    travel(id,{immediate=false}={}) {
      if(!destinations[id])return;
      if(!['coast','winter','globe'].includes(id)&&regions.state().target!==regions.state().region)regions.cancel();
      view.clearInspection();activities.exit();input.clear();route=id;arrival=null;path=[];
      if(id==='coast'||id==='winter') {
        regions.select(id).then(()=>{if(!disposed){render();request();}});
        onArrive(id);render();return;
      }
      const destination=destinations[id];
      const required=id==='skate'?'winter':['ball','surf'].includes(id)?'coast':null;
      let seasonal=null;
      if(required&&regions.state().target!==required) {
        seasonal=regions.select(required).then(()=>{if(!disposed){render();request();}});
      }
      if(immediate||!walkthrough) {
        const arrive=()=>{if(disposed||route!==id)return;actor.position.copy(destination);render();
          if(regions.state().phase==='settled')arrived(id);else{arrival=id;request();}};
        if(seasonal)seasonal.then(arrive);else arrive();
        return;
      }
      const next=findPath(actor.position,destination);
      if(!next){actor.position.copy(nearestWalkable(actor.position));onArrive('overview');render();return;}
      path=next;arrival=id;
      if(!path.length){arrival=null;arrived(id);}else request();
    },
    async inspect(id,{immediate=false}={}) {
      input.clear();path=[];arrival=null;
      const object=portfolio.get(id);
      if(object){
        if(!walkthrough)await portfolio.ensure(object,regions.state().region);
        if(disposed||route!==id)return false;
        view.inspect(object,immediate);render();request();
      }
      return !!object;
    },
    refreshMotion() {
      if(reduced()){regions.step(2);environment.stepLighting(2);const object=view.inspecting();if(object)view.inspect(object,true);}
      render();request();
    },
    setScreenExpanded(value) {
      const object=view.inspecting();if(!object?.plate)return false;
      object.expandScreen=Boolean(value);render();return Boolean(object.fullViewport);
    },
    setDeviceGame(state) {
      deviceGame=state;
      const snapshot=JSON.parse(renderer.domElement.dataset.worldState);snapshot.game=state||activities.state();
      renderer.domElement.dataset.worldState=JSON.stringify(snapshot);
    },
    globe() {if(paused)return;this.travel('globe',{immediate:reduced()});},
    move:input.move, nearby:()=>near,
    setPaused(value) {paused=value;view.pause(value||document.hidden);stop();render();if(!value)request();},
    async setNight(value) {await environment.setNight(value);if(disposed)return;night=value;
      environment.stepLighting(0);render();request();},
    startGame(type) {
      if(paused||regions.state().phase==='transition')return;
      path=[];arrival=null;view.clearInspection();activities.enter(type,{prepare:!walkthrough&&['ball','skate','surf'].includes(type)?2:0});render();request();
    },
    penalty(angle,power) {if(paused)return;path=[];arrival=null;view.clearInspection();
      activities.enter('penalty',{angle,power});render();request();},
    kick() {if(paused)return false;const result=activities.kick();request();return result;},
    stroke() {if(!paused){activities.stroke();request();}},
    stopGame() {activities.exit();render();},
    garden(stage,species) {
      // The live growth belongs to the pictured desk pot, retained between seasons.
      const pot=fromPlate(...targets.plants);
      if(!this.growth){this.growth=new THREE.Group();this.growth.position.copy(pot);scene.add(this.growth);}
      while(this.growth.children.length)this.growth.children[0].removeFromParent();
      for(let i=0;i<stage*4;i++) {
        const leaf=person.oval(.025,.1,.015,environment.materials.leaf,
          Math.sin(i*2.4)*.045,.025+i*.016,Math.cos(i*2.4)*.045,this.growth);
        leaf.rotation.z=Math.sin(i)*.5;
      }
      render();
    },
    state:()=>JSON.parse(renderer.domElement.dataset.worldState),
    dispose() {
      disposed=true;environment.cancelLighting();regions.dispose();stop();activities.dispose();input.dispose();hotspots?.dispose();observer.disconnect();
      resources.forEach(resource=>resource.dispose());renderer.dispose();renderer.domElement.remove();
    }
  };
}
