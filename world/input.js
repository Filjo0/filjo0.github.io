import * as THREE from '../assets/vendor/three.module.js';
import {
  walkable
} from '../world-state.js';
export function createInput({
  host,
  view,
  request,
  render,
  stop,
  onGround,
  active,
  objects = [],
  onObject = () => {},
  inspecting = () => false,
  onVisibility = () => {},
  isWalkable = walkable,
  walkingEnabled = () => true,
  isObjectEnabled = () => true
}) {
  const events = new AbortController(),
    signal = events.signal,
    keys = new Set();
  const ray = new THREE.Raycaster(),
    ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointer = new THREE.Vector2();
  let drag = null;
  const keyMap = {
    KeyW: 'forward',
    ArrowUp: 'forward',
    KeyS: 'back',
    ArrowDown: 'back',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    ShiftLeft: 'run',
    ShiftRight: 'run'
  };
  host.addEventListener('keydown', e => {
    if (e.target !== host || !keyMap[e.code] || inspecting() || !walkingEnabled()) return;
    e.preventDefault();
    keys.add(keyMap[e.code]);
    request();
  }, {
    signal
  });
  window.addEventListener('keyup', e => keys.delete(keyMap[e.code]), {
    signal
  });
  window.addEventListener('blur', () => {
    keys.clear();
    stop();
  }, {
    signal
  });
  host.addEventListener('blur', () => keys.clear(), {
    signal
  });
  document.addEventListener('visibilitychange', () => {
    onVisibility();
    keys.clear();
    stop();
    if (!document.hidden) request();
  }, {
    signal
  });
  host.addEventListener('pointerdown', e => {
    if (inspecting()) return;
    drag = {
      x: e.clientX,
      y: e.clientY,
      yaw: view.yaw,
      moved: false
    };
    host.setPointerCapture(e.pointerId);
    host.focus({
      preventScroll: true
    });
  }, {
    signal
  });
  host.addEventListener('pointermove', e => {
    if (!drag) {
      if(inspecting()||active())return;
      const b=host.getBoundingClientRect();
      pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);
      ray.setFromCamera(pointer,view.camera);
      host.style.cursor=ray.intersectObjects(objects.filter(isObjectEnabled),false).length?'pointer':'grab';
      return;
    }
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
    if (drag.moved) {
      view.yaw = drag.yaw - (e.clientX - drag.x) * .008;
      render();
    }
  }, {
    signal
  });
  host.addEventListener('pointerup', e => {
    if (!drag) return;
    if (!drag.moved && !active()) {
      const b = host.getBoundingClientRect();
      pointer.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
      ray.setFromCamera(pointer, view.camera);
      const hit = ray.intersectObjects(objects.filter(isObjectEnabled), false)[0];
      if (hit) {
        onObject(hit.object.userData.route);
        drag = null;
        return;
      }
      const p = new THREE.Vector3();
      if (walkingEnabled() && ray.ray.intersectPlane(ground, p) && isWalkable(p.x, p.z)) onGround(p);
    }
    drag = null;
  }, {
    signal
  });
  host.addEventListener('pointercancel', () => {
    drag = null;
  }, {
    signal
  });
  return {
    keys,
    clear() {
      keys.clear();
      drag = null;
    },
    move(name, value) {
      if (value) keys.add(name);
      else keys.delete(name);
      request();
    },
    sample() {
      return {
        dx: Number(keys.has('right')) - Number(keys.has('left')),
        dz: Number(keys.has('back')) - Number(keys.has('forward')),
        yaw: view.yaw
      };
    },
    dispose() {
      events.abort();
      host.style.removeProperty('cursor');
      keys.clear();
    }
  };
}
