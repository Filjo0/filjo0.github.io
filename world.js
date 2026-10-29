import {
  createPortfolioObjects
} from './world/portfolio-objects.js';
import {
  createScene
} from './world/scene.js';
import {
  createAvatar
} from './world/avatar.js';
import {createModelPerson} from './world/person-model.js';
import {
  createCamera
} from './world/camera.js';
import {
  createInput
} from './world/input.js';
import {
  createStations
} from './world/stations/index.js';
import {
  geometryEvidence
} from './world/surfaces.js';
import * as THREE from './assets/vendor/three.module.js';
import {
  places,
  findPath,
  walkable,
  climateAt,
  destinationFor
} from './world-state.js';
import {
  createWinter
} from './world-winter.js';
export function createWorld({
  host,
  onNear,
  onArrive,
  onGame,
  onFailure,
  onRegion = () => {},
  onSurface = () => {},
  onObject = () => {}
}) {
  const environment = createScene({
    host,
    onFailure
  });
  const {
    scene,
    renderer,
    resources,
    props,
    lights,
    materials
  } = environment;
  const person = createAvatar(environment),
    avatar = person.root;
  const view = createCamera(host, avatar),
    camera = view.camera;
  const winter = createWinter({
    ...environment,
    ...materials
  });
  const portfolio = createPortfolioObjects(environment);
  const skates = winter.addSkates(avatar),
    winterClothes = winter.addClothes(person.hips, person.limbs);
  const {
    sun,
    hemi
  } = lights;
  let paused = false,
    night = false,
    route = 'overview',
    path = [],
    arrival = null;
  let pendingPerson = null;
  let characterStatus = 'loading';
  let frame = 0,
    last = 0,
    disposed = false,
    near = '',
    previousRegion = '',
    walkingPhase = 0;
  const input = createInput({
    host,
    view,
    request,
    render,
    stop,
    active: () => stations.state(),
    objects: portfolio.hitMeshes,
    onObject,
    inspecting: () => !!view.inspecting(),
    onVisibility: () => view.pause(document.hidden || paused),
    onGround(p) {
      path = findPath(avatar.position, p);
      arrival = null;
      request();
    }
  });
  const stations = createStations({
    ...environment,
    avatar: person,
    winter,
    skates,
    view
  }, onGame, () => input.clear());

  function render() {
    if (disposed) return;
    // Keep the root and station facade stable; never replace an actor mid-game.
    if (pendingPerson && !stations.state()) {
      const next = pendingPerson;
      pendingPerson = null;
      const oldHips = person.hips;
      next.root.removeFromParent();
      next.root.position.set(0, 0, 0);
      avatar.add(next.root);
      oldHips.removeFromParent();
      const reset = next.reset;
      Object.assign(person, next, {
        root: avatar,
        reset() {avatar.position.y = 0; avatar.rotation.z = 0; reset();}
      });
      characterStatus = 'model';
    }
    const climate = climateAt(avatar.position.z);
    if (person.modelled) {
      person.setCold(climate.snow >= .5);
      person.update();
      if (skates.visible) person.limbs.forEach((limb, index) => {
        const foot = avatar.worldToLocal(limb.foot.getWorldPosition(new THREE.Vector3()));
        skates.children[index].position.set(foot.x, foot.y - .115, foot.z + .035);
      });
    }
    else winterClothes.setCold(climate.snow >= .5);
    const warmSky = new THREE.Color(night ? '#384b5b' : '#a4c2cd'),
      coldSky = new THREE.Color(night ? '#263549' : '#bdcbd6');
    scene.background.copy(warmSky.lerp(coldSky, climate.snow));
    scene.fog.color.copy(scene.background);
    sun.color.set('#ffe0b2').lerp(new THREE.Color('#dbe5f5'), climate.snow);
    hemi.groundColor.set('#4d533b').lerp(new THREE.Color('#8295a9'), climate.snow);
    sun.target.position.set(0, 0, avatar.position.z);
    sun.position.set(-20, 26, avatar.position.z + 10);
    sun.target.updateMatrixWorld();
    if (previousRegion !== climate.region) {
      previousRegion = climate.region;
      onRegion(climate.region);
    }
    view.update(stations.state() || ['ball', 'surf', 'skate'].includes(route));
    avatar.visible = !view.inspecting();
    portfolio.inspect(view.inspecting());
    renderer.render(scene, camera);
    onSurface(view.inspecting(), camera, !view.animating());
    renderer.domElement.dataset.worldState = JSON.stringify({
      character: characterStatus,
      position: {
        x: avatar.position.x,
        y: avatar.position.y,
        z: avatar.position.z
      },
      region: climate.region,
      snow: climate.snow,
      footprints: winter.footprintCount(),
      route,
      moving: path.length > 0,
      paused,
      night,
      game: stations.state(),
      geometry: geometryEvidence({
        avatar: person,
        props,
        camera,
        host,
        portfolio
      })
    });
  }


  new THREE.GLTFLoader().load(new URL('./assets/outdoor/person.glb', import.meta.url).href,
    gltf => {
      if (disposed) {
        gltf.scene.traverse(object => {
          if (!object.isMesh) return;
          object.geometry.dispose();
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
        });
        return;
      }
      try {
        pendingPerson = createModelPerson(environment, gltf.scene);
        characterStatus = 'waiting';
        pendingPerson.root.removeFromParent();
        render();
        request();
      } catch {
        characterStatus = 'fallback';
        render();
      }
    }, undefined, () => {
      if (disposed) return;
      characterStatus = 'fallback';
      render();
    });

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }

  function request() {
    if (!frame && !disposed && !paused && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    if (disposed || paused || document.hidden) return;
    const elapsedDt = last ? Math.min((now - last) / 1000, .25) : 0;
    const dt = Math.min(elapsedDt, .04);
    last = now;
    let moving = false;
    const sample = input.sample(),
      {
        dx,
        dz,
        yaw
      } = sample;
    if (stations.state()) stations.update(elapsedDt, sample);
    else if (dx || dz) {
      path = [];
      arrival = null;
      const speed = input.keys.has('run') ? 5 : 2.5,
        l = Math.hypot(dx, dz);
      const x = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / l;
      const z = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) / l;
      const nx = avatar.position.x + x * dt * speed,
        nz = avatar.position.z + z * dt * speed;
      if (walkable(nx, nz)) {
        avatar.position.set(nx, 0, nz);
        avatar.rotation.y = Math.atan2(x, z);
        moving = true;
      }
    } else if (path.length) {
      const target = path[0],
        x = target.x - avatar.position.x,
        z = target.z - avatar.position.z;
      const d = Math.hypot(x, z),
        step = dt * 4.5;
      if (d <= Math.max(step, .06)) {
        avatar.position.set(target.x, 0, target.z);
        path.shift();
        if (!path.length && arrival) {
          const id = arrival;
          arrival = null;
          onArrive(id);
        }
      } else {
        avatar.position.x += x / d * step;
        avatar.position.z += z / d * step;
        avatar.rotation.y = Math.atan2(x, z);
        moving = true;
      }
    }
    if (!stations.state()) {
      if (moving) {
        winter.footprint(avatar.position);
        walkingPhase += dt * (input.keys.has('run') ? 12 : 8);
        person.walk(walkingPhase);
      } else person.reset();
      let closest = '',
        d = 2.1;
      for (const id of Object.keys(places)) {
        if (['overview', 'coast', 'winter'].includes(id)) continue;
        const p = destinationFor(id, avatar.position.z),
          n = Math.hypot(p.x - avatar.position.x, p.z - avatar.position.z);
        if (n < d) {
          closest = id;
          d = n;
        }
      }
      if (closest !== near) {
        near = closest;
        onNear(near);
      }
    }
    render();
    if (path.length || input.keys.size || stations.running() || view.animating()) request();
    else last = 0;
  }
  const resize = () => {
    renderer.setSize(host.clientWidth, host.clientHeight);
    view.resize();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  onNear('');
  return {
    travel(id, {
      immediate = false
    } = {}) {
      view.clearInspection();
      stations.exit();
      input.clear();
      route = id;
      arrival = null;
      const p = destinationFor(id, avatar.position.z);
      if (!p) return;
      if (immediate) {
        path = [];
        avatar.position.set(p.x, 0, p.z);
        render();
        onArrive(id);
        return;
      }
      path = findPath(avatar.position, p);
      arrival = id;
      if (!path.length) {
        arrival = null;
        onArrive(id);
      } else request();
    },
    inspect(id, {
      immediate = false
    } = {}) {
      input.clear();
      path = [];
      arrival = null;
      const object = portfolio.get(id, avatar.position.z);
      if (object) {
        view.inspect(object, immediate);
        render();
        request();
      }
      return !!object;
    },
    move: input.move,
    nearby() {
      return near;
    },
    setPaused(value) {
      paused = value;
      view.pause(value || document.hidden);
      stop();
      render();
      if (!value) request();
    },
    setNight(value) {
      night = value;
      sun.intensity = value ? .9 : 3.3;
      hemi.intensity = value ? .8 : 2;
      winter.setNight(value);
      render();
    },
    startGame(type) {
      if (paused) return;
      path = [];
      arrival = null;
      view.clearInspection();
      stations.enter(type);
      render();
      request();
    },
    penalty(angle, power) {
      if (paused) return;
      path = [];
      arrival = null;
      stations.enter('penalty', {
        angle,
        power
      });
      render();
      request();
    },
    kick() {
      if (paused) return false;
      const accepted = stations.kick();
      request();
      return accepted;
    },
    stroke() {
      if (paused) return;
      stations.stroke();
      request();
    },
    stopGame() {
      stations.exit();
      render();
    },
    garden(stage, species) {
      const growing = props.growing;
      while (growing.children.length) {
        const c = growing.children[0];
        growing.remove(c);
        c.geometry.dispose();
        const i = resources.indexOf(c.geometry);
        if (i >= 0) resources.splice(i, 1);
      }
      for (let i = 0; i < stage * 4; i++) {
        const a = i * 2.4;
        const blade = person.oval(species === 'rosemary' ? .025 : .09, .16, .022, materials.leaf,
          Math.sin(a) * .1, .08 + i * .045, Math.cos(a) * .1, growing);
        blade.rotation.set(.4 * Math.sin(a), a, .5 * Math.cos(a));
      }
      render();
    },
    state() {
      return JSON.parse(renderer.domElement.dataset.worldState);
    },
    dispose() {
      disposed = true;
      stop();
      stations.exit();
      input.dispose();
      observer.disconnect();
      scene.traverse(o => {
        if (o.isInstancedMesh) o.dispose();
      });
      resources.forEach(r => r.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
