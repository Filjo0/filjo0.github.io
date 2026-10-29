import * as THREE from './assets/vendor/three.module.js';
import {
  skatingGates
} from './world-state.js';

// Original winter scenery: an imagined timber pavilion and pines, not a landmark replica.
export function createWinter({
  scene,
  mat,
  mesh,
  box,
  wood,
  dark,
  line,
  resources
}) {
  const snow = mat('#e5e9e5', {
      roughness: .96
    }),
    ice = mat('#bacbd3', {
      metalness: .10,
      roughness: .36
    }),
    pine = mat('#344c42'),
    timber = mat('#695047');
  box(65, .25, 58, snow, -4, -.13, -61);
  box(8, .12, 14, mat('#aaa99b'), 0, -.045, -29);
  box(3.2, .028, 20, mat('#bdc9cd', {
    roughness: .95
  }), 0, .08, -43);
  // Slightly uneven snow, bounded in geometry rather than animated weather.
  const surface = new THREE.PlaneGeometry(64, 57, 38, 38),
    v = surface.attributes.position;
  for (let i = 0; i < v.count; i++) {
    const x = v.getX(i),
      z = v.getY(i);
    v.setZ(i, .035 + .025 * Math.sin(x * .9) * Math.cos(z * .6));
  }
  surface.computeVertexNormals();
  const ground = mesh(surface, snow, -4, .01, -61);
  ground.rotation.x = -Math.PI / 2;
  box(11, .10, 31, mat('#b5c5cb'), 0, .02, -68);
  box(10, .025, 30, ice, 0, .09, -68);
  const scratches = document.createElement('canvas');
  scratches.width = scratches.height = 256;
  const c = scratches.getContext('2d');
  c.fillStyle = '#bacbd3';
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#bdcdd4';
  c.globalAlpha = .12;
  c.lineWidth = .5;
  for (let i = 0; i < 85; i++) {
    c.beginPath();
    c.arc((i * 67) % 256, (i * 137) % 256, 25 + i % 45, .2 + i, 1.3 + i);
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(scratches);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  resources.push(texture);
  ice.map = texture;
  ice.color.set('#ffffff');
  for (const x of [-5.5, 5.5]) {
    box(.12, .48, 31, timber, x, .24, -68);
    box(.15, .035, 31, snow, x, .5, -68);
  }
  const gateRings = [],
    pendingGate = mat('#537381'),
    currentGate = mat('#946132', {
      emissive: '#634421',
      emissiveIntensity: .18
    }),
    passedGate = mat('#3d705b');
  let markedGate = -2;
  for (const g of skatingGates) {
    for (const side of [-1, 1]) {
      box(.045, .9, .045, wood, g.x + side * .95, .53, g.z);
      box(.26, .18, .018, mat(side < 0 ? '#b76f45' : '#406b72'), g.x + side * .95, .94, g.z);
    }
    const hoop = mesh(new THREE.TorusGeometry(.25, .025, 6, 20), pendingGate, g.x, .44, g.z);
    gateRings.push(hoop);
  }
  for (let i = 0; i < 20; i++) box(.5, .015, .45, i % 2 ? dark : line, -4.75 + i * .5, .12, -82);
  // Horizontal timbers, a snow-covered pitched roof and lit windows.
  box(6, 2.8, 5, timber, -11, 1.4, -45);
  for (let row = 0; row < 18; row++) {
    const y = .12 + row * .155;
    box(6.06, .09, .08, wood, -11, y, -42.46);
    box(.08, .09, 5.05, wood, -7.96, y, -45);
  }
  for (const side of [-1, 1]) {
    const roof = box(3.8, .14, 6, wood, -11 + side * 1.48, 3.1, -45);
    roof.rotation.z = -side * .46;
    const cap = box(3.9, .09, 6.1, snow, -11 + side * 1.49, 3.21, -45);
    cap.rotation.z = -side * .46;
  }
  const glow = mat('#edc899', {
    emissive: '#cf9755',
    emissiveIntensity: .65,
    roughness: .6
  });
  for (const x of [-12.6, -9.5]) {
    box(1.35, 1.15, .04, dark, x, 1.67, -42.44);
    box(1.17, .98, .045, glow, x, 1.67, -42.41);
    box(.045, 1.1, .05, wood, x, 1.67, -42.37);
    box(1.3, .045, .05, wood, x, 1.67, -42.37);
  }
  box(.9, 1.95, .045, wood, -11.1, .98, -42.41);
  box(1.2, .12, .7, snow, -11.1, .06, -42.0);
  for (const z of [-44.3, -44, -43.7]) box(2.8, .12, .23, wood, -5, .6, z);
  for (const x of [-6, -4]) box(.1, .6, .1, dark, x, .3, -44);
  box(2.8, .12, .4, wood, -5, 1, -44.4);
  box(.45, .05, .4, line, -5, .71, -44);
  // Pines use radial branch tiers and individual needle clusters, with snow on top.
  const spots = [
    [-22, -39],
    [-19, -49],
    [-24, -58],
    [-19, -69],
    [-24, -82],
    [13, -40],
    [17, -50],
    [13, -61],
    [17, -74],
    [12, -83],
    [-10, -82]
  ];
  const needleGeo = new THREE.ConeGeometry(.16, .6, 5);
  resources.push(needleGeo);
  for (const [index, [x, z]] of spots.entries()) {
    const scale = .9 + (index % 3) * .18,
      tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    scene.add(tree);
    mesh(new THREE.CylinderGeometry(.10, .19, 4.5, 9), wood, 0, 2.15, 0, tree);
    const needles = new THREE.InstancedMesh(needleGeo, pine, 180);
    needles.castShadow = true;
    tree.add(needles);
    const caps = new THREE.InstancedMesh(needleGeo, snow, 180);
    caps.castShadow = true;
    tree.add(caps);
    const pose = new THREE.Object3D();
    let n = 0;
    for (let tier = 0; tier < 6; tier++) {
      const y = 1 + tier * .58,
        r = 1.65 - tier * .22;
      for (let j = 0; j < 30; j++) {
        const a = j * 2.399 + index * .31,
          f = .3 + (j % 10) / 13;
        pose.position.set(Math.sin(a) * r * f, y + .2 * (1 - f), Math.cos(a) * r * f);
        pose.rotation.set(.22 * Math.sin(a), a, .22 * Math.cos(a));
        pose.scale.set(.85, 1.2, .85);
        pose.updateMatrix();
        needles.setMatrixAt(n, pose.matrix);
        pose.position.y += .11;
        pose.scale.set(.75, .85, .75);
        pose.updateMatrix();
        caps.setMatrixAt(n++, pose.matrix);
      }
    }
  }
  // Warm path lamps give winter a different atmosphere while retaining readable UI.
  const lamps = [];
  for (const z of [-38, -47, -54, -65, -77]) {
    box(.07, 2.35, .07, dark, 6.3, 1.18, z);
    const glass = mesh(new THREE.SphereGeometry(.15, 12, 8), glow, 6.3, 2.43, z);
    const light = new THREE.PointLight('#ffcb8b', .8, 5, 2);
    light.position.copy(glass.position);
    scene.add(light);
    lamps.push(light);
  }
  const trailGeo = new THREE.CircleGeometry(.095, 10);
  resources.push(trailGeo);
  const trail = new THREE.InstancedMesh(trailGeo, mat('#aebfc5', {
    transparent: true,
    opacity: .6,
    depthWrite: false
  }), 96);
  trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(trail);
  trail.count = 0;
  let last = null,
    index = 0;
  const pose = new THREE.Object3D();

  function footprint(position) {
    if (position.z > -35) {
      last = null;
      return;
    }
    if (last && last.distanceTo(position) < .38) return;
    pose.position.set(position.x + (index % 2 ? -.10 : .10), .11, position.z);
    pose.rotation.x = -Math.PI / 2;
    pose.scale.set(.72, 1.25, 1);
    pose.updateMatrix();
    trail.setMatrixAt(index % 96, pose.matrix);
    trail.count = Math.min(96, ++index);
    trail.instanceMatrix.needsUpdate = true;
    trail.computeBoundingSphere();
    last = position.clone();
  }
  return {
    markGate(index) {
      if (index === markedGate) return;
      markedGate = index;
      gateRings.forEach((ring, i) => {
        ring.material = i === index ? currentGate : index >= 0 && i < index ? passedGate : pendingGate;
      });
    },
    footprint,
    footprintCount() {
      return trail.count;
    },
    setNight(value) {
      lamps.forEach(l => l.intensity = value ? 2 : .8);
    },
    addClothes(hips, limbs) {
      const wool = mat('#874f40', {
          roughness: 1
        }),
        cap = new THREE.Group();
      hips.add(cap);
      mesh(new THREE.SphereGeometry(.116, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), wool, 0, .89, -.015, cap);
      const scarf = mesh(new THREE.TorusGeometry(.11, .026, 8, 20), wool, 0, .65, 0, cap);
      scarf.rotation.x = Math.PI / 2;
      const mittens = limbs.map(l => {
        const mitten = mesh(new THREE.SphereGeometry(.055, 12, 8), wool, 0, -.45, 0, l.arm);
        mitten.scale.y = 1.4;
        return mitten;
      });
      return {
        setCold(value) {
          cap.visible = value;
          mittens.forEach(m => m.visible = value);
        }
      };
    },
    addSkates(avatar) {
      const blades = new THREE.Group();
      avatar.add(blades);
      for (const x of [-.11, .11]) box(.025, .04, .28, mat('#a6b7b9', {
        metalness: .75,
        roughness: .25
      }), x, -.045, .035, blades);
      blades.visible = false;
      return blades;
    }
  };
}
