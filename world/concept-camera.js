import {composePlate} from './plate-views.js';
import * as THREE from '../assets/vendor/three.module.js';
import {createCamera} from './camera.js';
import {reference, referenceCamera, targets} from './concept-layout.js';

// The rendered scenery has a composed camera. Cropping pans across that view,
// revealing objects on phones without pretending a photograph can orbit.
// Only the opt-in walking comparison follows the actor outside activities.
export function createConceptCamera(host, actor, {walkthrough=true}={}) {
  const reading = createCamera(host, actor, {minimumDistance:.035,near:.01}), camera = reading.camera;
  const fixed = referenceCamera();
  let userPan = 0, sceneCentre = .18, preview=null,plate=null;
  function compose(activity = false) {
    camera.fov = reference.fov;
    camera.position.copy(fixed.position);
    camera.quaternion.copy(fixed.quaternion);
    camera.up.set(0, 1, 0);
    const w = host.clientWidth, h = Math.max(1, host.clientHeight);
    const zoom=activity&&activity.type!=='drive'?(w<720&&activity.type==='skate'?1.45:1.8):preview?1.45:1;
    const fullW = Math.max(w, h * reference.width / reference.height)*zoom, fullH = fullW * reference.height / reference.width;
    const focusPoint=actor.getWorldPosition(new THREE.Vector3());
    if(activity?.type==='drive')focusPoint.x+=.35;
    const focus=focusPoint.project(fixed);
    const centre = activity||walkthrough&&w<720 ? (focus.x+1)/2 : preview?targets[preview][0]:w<720?sceneCentre:.5;
    const screenX=activity&&w>=720?.38:.5;
    const left = THREE.MathUtils.clamp(fullW*centre-w*screenX+(activity?0:userPan),0,fullW-w);
    const targetY=preview&&!activity?targets[preview][1]:(1-focus.y)/2;
    const top=preview||activity?THREE.MathUtils.clamp(fullH*targetY-h*.43,0,fullH-h):(fullH-h)/2;
    camera.aspect = fullW / fullH;
    camera.setViewOffset(fullW, fullH, left, top, w, h);
    camera.updateProjectionMatrix();
  }
  return {
    camera,
    panTo(u) {preview=null;sceneCentre=u;userPan=0;compose();},
    previewActivity(id) {preview=id;userPan=0;},
    get yaw() {return userPan / 100;},
    set yaw(value) {userPan = value * 100;},
    inspect(object, immediate) {
      if(object.plate){reading.clearInspection();plate=object;composePlate(object,camera,host);return;}
      plate=null;
      camera.clearViewOffset();
      camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix();
      reading.inspect(object, immediate);
    },
    clearInspection() {plate=null;preview=null;reading.clearInspection(); compose();},
    inspecting: ()=>plate||reading.inspecting(),
    animating: reading.animating,
    pause: reading.pause,
    update(activity) {if(plate){composePlate(plate,camera,host);return;}if (reading.inspecting()) reading.update(activity); else compose(activity);},
    resize() {if(plate){composePlate(plate,camera,host);return;}if (reading.inspecting()) reading.resize(); else compose();}
  };
}
