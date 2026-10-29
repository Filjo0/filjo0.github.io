import {
  readableArea, supportsSurfacePerspective
} from './surfaces.js';
import * as THREE from '../assets/vendor/three.module.js';
export function createCamera(host, avatar, {minimumDistance = .15, near = .1} = {}) {
  const camera = new THREE.PerspectiveCamera(48, 1, near, 160);
  const perspective = supportsSurfacePerspective(host.ownerDocument);
  let yaw = .2,
    inspecting = null,
    transition = null,
    pausedAt = null;

  function inspectionPose(object) {
    object.root.updateMatrixWorld(true);
    const focus = object.face.getWorldPosition(new THREE.Vector3());
    const w = host.clientWidth,
      h = host.clientHeight;
    const area = readableArea(object, host);
    const availableW = area.availableWidth,
      availableH = area.availableHeight;
    const fov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(minimumDistance, area.height * h / (2 * fov * availableH),
      area.width * h / (2 * fov * availableW));
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(object.root.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(object.root.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(object.root.quaternion);
    const position = focus.clone().addScaledVector(normal, distance);
    const look = focus.clone();
    if (perspective) {
      // Keep a small perspective angle while preserving readable text scale.
      position.addScaledVector(right, distance * .035);
      position.addScaledVector(up, distance * .015);
      look.addScaledVector(up, -distance * 2 * fov * 22 / h);
    } else {
      // Preserve a parallel reading plane; shift the frustum instead of tilting it.
      camera.setViewOffset(w, h, 0, 22, w, h);
    }
    const helper = camera.clone();
    helper.up.copy(up);
    helper.position.copy(position);
    helper.lookAt(look);
    return {
      position,
      rotation: helper.quaternion
    };
  }
  return {
    camera,
    get yaw() {
      return yaw;
    },
    set yaw(value) {
      yaw = value;
    },
    inspect(object, immediate = false) {
      inspecting = object;
      transition = immediate ? null : {
        at: performance.now(),
        position: camera.position.clone(),
        rotation: camera.quaternion.clone()
      };
      if (immediate) {
        const pose = inspectionPose(object);
        camera.position.copy(pose.position);
        camera.quaternion.copy(pose.rotation);
      }
    },
    clearInspection() {
      inspecting = null;
      transition = null;
      camera.clearViewOffset();
    },
    pause(value) {
      if (value && pausedAt === null) pausedAt = performance.now();
      if (!value && pausedAt !== null) {
        if (transition) transition.at += performance.now() - pausedAt;
        pausedAt = null;
      }
    },
    inspecting() {
      return inspecting;
    },
    animating() {
      return !!transition;
    },
    update(activity) {
      if (inspecting) {
        const pose = inspectionPose(inspecting);
        const t = transition ? Math.min(1, ((pausedAt ?? performance.now()) - transition.at) / 850) : 1;
        const eased = t * t * (3 - 2 * t);
        camera.position.copy(transition ? transition.position : pose.position).lerp(pose.position, eased);
        camera.quaternion.copy(transition ? transition.rotation : pose.rotation).slerp(pose.rotation, eased);
        if (t === 1) transition = null;
        return;
      }
      const focus = avatar.position.clone();
      focus.y = 1;
      const distance = host.clientWidth < 650 ? 10 : 12;
      camera.position.set(focus.x + Math.sin(yaw) * distance, 7.8, focus.z + Math.cos(yaw) * distance);
      if (activity && host.clientWidth < 720) {
        focus.x += Math.sin(yaw) * 3;
        focus.z += Math.cos(yaw) * 3;
      }
      camera.lookAt(focus);
    },
    resize() {
      camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      camera.updateProjectionMatrix();
    }
  };
}
