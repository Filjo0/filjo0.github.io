import * as THREE from '../assets/vendor/three.module.js';
export function createScene({
  host,
  onFailure
}) {
  const resources = [],
    scene = new THREE.Scene();
  scene.background = new THREE.Color('#a4c2cd');
  scene.fog = new THREE.Fog('#a4c2cd', 42, 115);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'low-power'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    onFailure({reason:'webgl-context-lost'});
  });
  const mat = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: .82,
      ...extra
    });
    resources.push(m);
    return m;
  };
  const mesh = (shape, m, x = 0, y = 0, z = 0, parent = scene) => {
    resources.push(shape);
    const o = new THREE.Mesh(shape, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (w, h, d, m, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  const wood = mat('#85755b'),
    stone = mat('#bcb5a3'),
    grass = mat('#78826a'),
    dark = mat('#324b44'),
    skin = mat('#b58b69'),
    clay = mat('#926b53'),
    leaf = mat('#3e6748');
  // Fine authored surface noise avoids uniform plastic. No external texture requests.
  function surfaceTexture(base, kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    let seed = 72;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 20000; i++) {
      g.globalAlpha = .035 + rnd() * .08;
      g.fillStyle = rnd() > .5 ? '#fff7dc' : '#172319';
      g.fillRect(rnd() * 256, rnd() * 256, kind === 'wood' ? 1 : 2, kind === 'wood' ? 12 : 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(kind === 'wood' ? 2 : 18, kind === 'wood' ? 2 : 18);
    resources.push(t);
    return t;
  }
  grass.map = surfaceTexture('#78826a', 'grass');
  stone.map = surfaceTexture('#bcb5a3', 'stone');
  wood.map = surfaceTexture('#85755b', 'wood');
  box(65, .3, 58, grass, -4, -.18, 0);
  box(3.2, .03, 50, stone, 0, .005, 0);
  box(41, .03, 2.7, stone, -4, .02, 5);
  box(8, .03, 57, mat('#c9b994'), 17, -.01, 0);
  const hemi = new THREE.HemisphereLight('#dce5e4', '#4d533b', 2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0b2', 3.3);
  sun.position.set(-20, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -34,
    right: 34,
    top: 30,
    bottom: -30,
    near: 1,
    far: 85
  });
  sun.shadow.normalBias = .035;
  scene.add(sun);
  scene.add(sun.target);
  const oceanMat = mat('#487d87', {
      metalness: .25,
      roughness: .24
    }),
    ocean = box(70, .06, 100, oceanMat, 54, -.04, 0);
  // Court markings and real mesh nets.
  box(14, .04, 22, mat('#777d70'), -16, .04, -9);
  const line = mat('#e7e2d3');
  for (const x of [-23, -9]) box(.07, .02, 22, line, x, .071, -9);
  for (const z of [-20, 2, -9]) box(14, .02, .07, line, -16, .071, z);
  const ring = mesh(new THREE.TorusGeometry(2, .035, 6, 64), line, -16, .075, -9);
  ring.rotation.x = Math.PI / 2;
  for (const z of [-20, 2]) {
    for (const x of [-18, -14]) box(.06, 2, .06, line, x, 1, z);
    box(4, .06, .06, line, -16, 2, z);
    for (let i = 0; i < 17; i++) box(.015, 2, .015, line, -18 + i * .25, 1, z - .4);
    for (let i = 0; i < 9; i++) box(4, .015, .015, line, -16, i * .25, z - .4);
  }
  const ball = mesh(new THREE.SphereGeometry(.17, 24, 16), mat('#e5dfc8'), -16, .17, -6);
  for (let i = 0; i < 8; i++) {
    const p = mesh(new THREE.CircleGeometry(.06, 5), dark, 0, 0, 0, ball),
      a = i * Math.PI / 4;
    p.position.set(Math.sin(a) * .171, 0, Math.cos(a) * .171);
    p.lookAt(p.position.clone().multiplyScalar(2));
  }
  // Pool walls, steps, lane ropes and a blue tiled basin.
  for (const x of [.5, 9.5]) box(1, .08, 16, stone, x, .05, -11);
  for (const z of [-18.5, -3.5]) box(8, .08, 1, stone, 5, .05, z);
  for (const x of [1, 9]) box(.12, 1.1, 14, stone, x, -.4, -11);
  for (const z of [-18, -4]) box(8, 1.1, .12, stone, 5, -.4, z);
  box(8, .12, 14, mat('#60808a', {
    roughness: .45
  }), 5, -.9, -11);
  const poolWater = box(7.8, .03, 13.8, mat('#4e8995', {
    transparent: true,
    opacity: .55,
    metalness: .3,
    roughness: .18
  }), 5, .17, -11);
  for (const x of [2.35, 5, 7.65])
    for (let i = 0; i < 40; i++) mesh(new THREE.SphereGeometry(.043, 6, 4), i % 6 < 3 ? line : dark, x, .2, -
      17.5 + i *
      .33);
  for (const x of [3.6, 4.2]) {
    const rail = mesh(new THREE.TorusGeometry(.32, .025, 6, 20, Math.PI), line, x, .35, -3.9);
    rail.rotation.y = Math.PI / 2;
  }
  // Coastal pavilion and tangible places to read, grow and investigate.
  for (const x of [-8.5, -5.5]) box(.14, 3, .14, wood, x, 1.5, -1);
  box(4, .16, 3.5, wood, -7, 3, -1);
  box(2.8, .12, 1.2, wood, -7, 1, -1);
  for (const z of [2.9, 3.3, 3.7]) box(2.8, .12, .22, wood, -5, .6, z);
  for (const x of [-6, -4]) box(.1, .6, .1, dark, x, .3, 3.3);
  box(2.8, .12, .45, wood, -5, 1.02, 2.82);
  for (let i = 0; i < 3; i++) box(.35, .07, .45, mat(['#627467', '#a67f5c', '#556d78'][i]), -5 + i * .4, .73,
    3.3);
  box(2, .08, 1, wood, 8, .8, 2);
  for (const x of [7.3, 8.7]) box(.09, .8, .09, dark, x, .4, 2);
  box(.35, .03, .45, line, 8, .87, 2);
  for (let i = 0; i < 3; i++) {
    box(1.8, .45, 1.8, wood, .6 + i * 2.3, .22, 12);
    box(1.55, .06, 1.55, mat('#4a3c2f'), .6 + i * 2.3, .48, 12);
  }
  const growing = new THREE.Group();
  growing.position.set(3, .52, 12);
  scene.add(growing);
  // The resume board, contact postbox and shelf each have a separate approach.
  box(2, 1.7, .4, wood, -5, .85, 6.8);
  for (let i = 0; i < 12; i++) {
    box(.11, .5 + i % 3 * .07, .28, mat(['#627467', '#a67f5c', '#556d78'][i % 3]),
      -5.8 + i * .14, 1, 6.8);
  }
  // Tank station uses a full-size exhibit; the real one-sector game opens at the station.
  box(11, .03, 9, mat('#8d8b79'), -16, .03, 13);
  const tank = new THREE.Group();
  tank.position.set(-16, .45, 13);
  tank.scale.setScalar(2.5);
  scene.add(tank);
  for (const x of [-.6, .6]) box(.35, .36, 1.6, dark, x, 0, 0, tank);
  box(1.2, .35, 1.45, mat('#737d5b'), 0, .25, 0, tank);
  mesh(new THREE.CylinderGeometry(.43, .5, .25, 24, 1, true), dark, 0, .55, 0, tank);
  const hatch = mesh(new THREE.TorusGeometry(.43, .04, 8, 32), dark, 0, .68, 0, tank);
  hatch.rotation.x = Math.PI / 2;
  box(.08, .08, 1.3, dark, 0, .59, -.6, tank);
  // Surfboard on the strand and a gentle rocky headland in the distance.
  const board = mesh(new THREE.SphereGeometry(1, 24, 12), mat('#d7cbb0'), 18, .1, 7);
  board.scale.set(.42, .06, 1.7);
  for (let i = 0; i < 18; i++) {
    const a = i * 1.2;
    const rock = mesh(new THREE.IcosahedronGeometry(2 + i % 3, 1), mat('#737971'), 25 + Math.sin(a) * 3, -.1,
      -28 + i *
      .15);
    rock.scale.y = .55;
  }
  // Branching foliage uses curved leaves, rather than solid spherical crowns.
  const blade = new THREE.Shape();
  blade.moveTo(0, 0);
  blade.bezierCurveTo(-.08, .10, -.09, .21, 0, .34);
  blade.bezierCurveTo(.09, .21, .08, .10, 0, 0);
  const bladeGeo = new THREE.ShapeGeometry(blade, 5),
    positions = bladeGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getY(i) / .34 * Math.PI) *
    .035);
  bladeGeo.computeVertexNormals();
  resources.push(bladeGeo);
  const foliage = mat('#5a7450', {
    side: THREE.DoubleSide,
    roughness: .9
  });
  const locations = [
    [-26, -19, 1],
    [-26, -7, 1.2],
    [-26, 6, 1],
    [-25, 21, 1.3],
    [-9, 22, 1.2],
    [9, 23, 1.1],
    [13, -22, 1],
    [13, -7, .9],
    [-6, -22, 1.3],
    [-25, 15, .8]
  ];
  for (const [x, z, size] of locations) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(size);
    scene.add(tree);
    mesh(new THREE.CylinderGeometry(.11, .23, 3.8, 10), wood, 0, 1.9, 0, tree);
    const leaves = new THREE.InstancedMesh(bladeGeo, foliage, 960);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    tree.add(leaves);
    let index = 0;
    const pose = new THREE.Object3D(),
      colour = new THREE.Color();
    for (let b = 0; b < 8; b++) {
      const a = b * 2.399,
        tip = new THREE.Vector3(Math.sin(a) * (1.3 + (b % 3) * .25), 3.3 + (b % 3) * .6, Math.cos(a) * (1.3 +
          (b % 3) *
          .25));
      const branch = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.8 + b * .1, 0), new THREE.Vector3(tip
        .x * .5, 3,
        tip.z * .5), tip]);
      mesh(new THREE.TubeGeometry(branch, 10, .045, 5, false), wood, 0, 0, 0, tree);
      for (let j = 0; j < 120; j++) {
        const t = j / 120 * 2.399 * Math.PI,
          r = .9 * Math.sqrt((j + .5) / 120),
          yy = ((j * 37) % 101) / 101;
        pose.position.set(tip.x + Math.cos(t) * r, tip.y + (yy - .5) * 1.6, tip.z + Math.sin(t) * r);
        pose.rotation.set(j * .31, b + t, j * .47);
        pose.scale.setScalar(1.2 + yy * .65);
        pose.updateMatrix();
        leaves.setMatrixAt(index, pose.matrix);
        colour.setHSL(.24 + yy * .03, .24, .23 + yy * .12);
        leaves.setColorAt(index++, colour);
      }
    }
  }
  // Small coastal planting breaks up empty grass, while paths and activity areas stay clear.
  const coastalPlanting = new THREE.InstancedMesh(bladeGeo, leaf, 450);
  scene.add(coastalPlanting);
  const shrubPose = new THREE.Object3D();
  for (let i = 0; i < 90; i++) {
    const x = 11.8 + (i % 6) * .35,
      z = -3 + Math.floor(i / 6) * .6;
    for (let j = 0; j < 5; j++) {
      shrubPose.position.set(x, .03, z);
      shrubPose.rotation.set(-.65, j * 1.256, .3);
      shrubPose.scale.setScalar(.7);
      shrubPose.updateMatrix();
      coastalPlanting.setMatrixAt(i * 5 + j, shrubPose.matrix);
    }
  }
  for (const [x, z, label] of [
      [-24, -5, 'FUTSL'],
      [7, -2.5, 'AQUA LOCAL'],
      [-15, 8, 'TREADFRONT']
    ]) {
    box(.065, 1.2, .065, wood, x, .6, z);
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#e7dfc9';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#263c32';
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.fillText(label, 256, 80);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    resources.push(t);
    const m = mat('#ffffff', {
      map: t,
      roughness: .8,
      side: THREE.DoubleSide
    });
    mesh(new THREE.PlaneGeometry(1.4, .35), m, x, 1.3, z);
  }
  return {
    scene,
    renderer,
    resources,
    mat,
    mesh,
    box,
    materials: {
      wood,
      stone,
      dark,
      line,
      leaf,
      skin
    },
    props: {
      ball,
      board,
      tank,
      growing
    },
    lights: {
      hemi,
      sun
    }
  };
}
