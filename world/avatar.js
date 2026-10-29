import * as THREE from '../assets/vendor/three.module.js';
export function createAvatar({
  scene,
  mesh,
  mat,
  materials
}) {
  const {
    skin
  } = materials;
  // Original articulated person: proportions, clothing, shoulders, hands and shoes.
  const avatar = new THREE.Group();
  avatar.position.set(0, 0, 19);
  scene.add(avatar);
  const hips = new THREE.Group();
  hips.position.y = .87;
  avatar.add(hips);
  const jacket = mat('#566860'),
    pants = mat('#3b4648'),
    shoe = mat('#292f2d');
  const oval = (x, y, z, m, px, py, pz, parent) => {
    const o = mesh(new THREE.SphereGeometry(1, 20, 14), m, px, py, pz, parent);
    o.scale.set(x, y, z);
    return o;
  };
  oval(.21, .28, .135, jacket, 0, .30, 0, hips);
  oval(.2, .13, .14, pants, 0, 0, 0, hips);
  oval(.085, .09, .085, skin, 0, .65, 0, hips);
  const head = oval(.105, .135, .105, skin, 0, .79, 0, hips);
  oval(.11, .06, .11, mat('#3a302a'), 0, .89, -.02, hips);
  const limbs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * .24, .48, 0);
    hips.add(arm);
    oval(.066, .23, .072, jacket, 0, -.18, 0, arm);
    oval(.045, .08, .048, skin, 0, -.44, 0, arm);
    const leg = new THREE.Group();
    leg.position.set(side * .11, -.07, 0);
    hips.add(leg);
    oval(.09, .35, .095, pants, 0, -.34, 0, leg);
    const foot = oval(.095, .06, .16, shoe, 0, -.72, .035, leg);
    limbs.push({
      arm,
      leg,
      foot,
      side
    });
  }
  return {
    root: avatar,
    hips,
    restHeight: .87,
    limbs,
    oval,
    head,
    reset() {
      avatar.rotation.z = 0;
      avatar.position.y = 0;
      hips.position.y = .87;
      hips.rotation.set(0, 0, 0);
      for (const l of limbs) {
        l.leg.visible = true;
        l.arm.rotation.set(0, 0, 0);
        l.leg.rotation.set(0, 0, 0);
      }
    },
    walk(phase) {
      hips.position.y = .87 + Math.sin(phase * 2) * .012;
      for (const l of limbs) {
        l.arm.rotation.x = Math.sin(phase) * .45 * l.side;
        l.leg.rotation.x = -Math.sin(phase) * .55 * l.side;
      }
    },
    kick(t) {
      const swing = Math.sin(Math.min(1, Math.max(0, t / .45)) * Math.PI);
      limbs[1].leg.rotation.x = -swing * .48;
      limbs[1].leg.rotation.z = swing * .4;
      limbs[0].arm.rotation.x = swing * .4;
    },
    swim(clock) {
      hips.position.y = 0;
      hips.rotation.x = Math.PI / 2;
      for (const l of limbs) {
        l.arm.rotation.x = clock * 2 + (l.side < 0 ? Math.PI : 0);
        l.arm.rotation.z = l.side * .2;
        l.leg.rotation.x = Math.sin(clock * 4) * .18 * l.side;
      }
    },
    footWorld() {
      avatar.updateMatrixWorld(true);
      return limbs[1].foot.getWorldPosition(new THREE.Vector3());
    }
  };
}
