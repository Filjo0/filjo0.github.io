import * as THREE from '../assets/vendor/three.module.js';

// The rigged asset uses one skeleton with two wardrobe meshes. Controllers retain
// the existing station API while bones and skin remain in one consistent person.
export function createModelPerson({scene, resources}, model) {
  const root = new THREE.Group();
  function updateMatrices() {
    // Update ancestors first, then use the SkinnedMesh override that refreshes its
    // inverse bind matrix. Object3D.updateWorldMatrix alone does not call it.
    root.updateWorldMatrix(true, false);
    root.updateMatrixWorld(true);
  }
  root.position.set(0, 0, 19);
  const bones = new Map();
  model.traverse(object => {if (object.isBone) bones.set(object.name, object);});
  const bone = name => {
    const result = bones.get(name);
    if (!result?.isBone) throw new Error('Missing character bone: ' + name);
    return result;
  };
  for (const name of ['hips', 'head', ...['r', 'l'].flatMap(side =>
    ['arm', 'leg', 'shin', 'foot', 'hand'].map(part => part + '_' + side))]) bone(name);
  scene.add(root);
  root.add(model);
  updateMatrices();
  const hipsBone = bone('hips');
  const hips = new THREE.Group();
  hips.position.copy(root.worldToLocal(hipsBone.getWorldPosition(new THREE.Vector3())));
  const restHeight = hips.position.y;
  root.add(hips);
  hips.attach(hipsBone);
  const clothes = [];
  const lower = [];
  const meshes = [];
  const skeletons = new Set();
  model.traverse(object => {
    if (object.userData.wardrobe) clothes.push(object);
    if (!object.isMesh) return;
    meshes.push(object);
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    resources.push(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.push(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.push(value);
      if (['person_trousers', 'person_shoes'].includes(material.name)) lower.push(object);
    }
    if (object.skeleton) skeletons.add(object.skeleton);
  });

  resources.push(...skeletons);

  function control(source, restRoll = 0) {
    const anchor = new THREE.Group();
    anchor.position.copy(hips.worldToLocal(source.getWorldPosition(new THREE.Vector3())));
    hips.add(anchor);
    const resting = new THREE.Group();
    const moving = new THREE.Group();
    anchor.add(resting);
    resting.add(moving);
    moving.attach(source);
    resting.rotation.z = restRoll;
    return moving;
  }
  const limbs = [-1, 1].map(side => {
    const label = side < 0 ? 'r' : 'l';
    const arm = control(bone('arm_' + label), -side * .65);
    const leg = control(bone('leg_' + label));
    const shin = bone('shin_' + label);
    return {side, arm, leg, shin, shinRest:shin.quaternion.clone(),
      foot:bone('foot_' + label), hand:bone('hand_' + label)};
  });
  const head = new THREE.Object3D();
  head.position.y = .10;
  bone('head').add(head);
  let cold = false;
  const kneeAxis = new THREE.Vector3(1, 0, 0);
  const kneeRotation = new THREE.Quaternion();
  function knee(limb, angle) {
    limb.shin.quaternion.copy(limb.shinRest).multiply(kneeRotation.setFromAxisAngle(kneeAxis, angle));
  }
  let lastPose = '';
  function update() {
    for (const item of clothes) {
      item.visible = item.userData.wardrobe === 'shared' ||
        item.userData.wardrobe === (cold ? 'winter' : 'coast');
    }
    const legsVisible = limbs.some(limb => limb.leg.visible);
    for (const object of lower) object.visible = legsVisible;
    updateMatrices();
    for (const skeleton of skeletons) skeleton.update();
    const pose = [hips.position.y, ...hips.rotation.toArray(), ...limbs.flatMap(limb =>
      [...limb.arm.rotation.toArray(), ...limb.leg.rotation.toArray(), ...limb.shin.quaternion.toArray()])].join('|');
    if (pose === lastPose) return;
    lastPose = pose;
    for (const object of meshes) {
      if (object.isSkinnedMesh) {
        // Bounds and raycasts follow the real pose, not the original bind pose.
        object.computeBoundingBox();
        object.boundingSphere ||= new THREE.Sphere();
        object.boundingBox.getBoundingSphere(object.boundingSphere);
      }
    }
  }
  const restFeet = limbs.map(limb => limb.foot.getWorldPosition(new THREE.Vector3()).y - root.position.y);
  const person = {
    root, hips, limbs, head, meshes, restHeight,
    modelled:true,
    setCold(value) {if (cold !== value) {cold = value; update();}},
    update,
    reset() {
      root.rotation.z = 0;
      root.position.y = 0;
      hips.position.y = restHeight;
      hips.rotation.set(0, 0, 0);
      for (const limb of limbs) {
        limb.leg.visible = true;
        limb.arm.rotation.set(0, 0, 0);
        limb.leg.rotation.set(0, 0, 0);
        knee(limb, 0);
      }
      update();
    },
    walk(phase) {
      hips.position.y = restHeight;
      for (const limb of limbs) {
        const swing = Math.sin(phase) * limb.side;
        limb.arm.rotation.x = swing * .34;
        limb.leg.rotation.x = -swing * .40;
        knee(limb, Math.max(0, swing) * .45);
      }
      updateMatrices();
      const footHeight = Math.min(...limbs.map(limb =>
        limb.foot.getWorldPosition(new THREE.Vector3()).y - root.position.y));
      hips.position.y += Math.min(...restFeet) - footHeight;
      update();
    },
    kick(t) {
      const swing = Math.sin(Math.min(1, Math.max(0, t / .45)) * Math.PI);
      limbs[1].leg.rotation.x = -swing * .48;
      limbs[1].leg.rotation.z = swing * .4;
      limbs[0].arm.rotation.x = swing * .4;
      knee(limbs[1], swing * .12);
      update();
    },
    swim(clock) {
      hips.position.y = 0;
      hips.rotation.x = Math.PI / 2;
      for (const limb of limbs) {
        limb.arm.rotation.x = clock * 2 + (limb.side < 0 ? Math.PI : 0);
        limb.arm.rotation.z = limb.side * .2;
        limb.leg.rotation.x = Math.sin(clock * 4) * .18 * limb.side;
        knee(limb, .16);
      }
      update();
    },
    footWorld() {
      updateMatrices();
      return limbs[1].foot.getWorldPosition(new THREE.Vector3());
    },
    handWorld(limb) {
      updateMatrices();
      return limb.hand.getWorldPosition(new THREE.Vector3());
    }
  };
  person.reset();
  return person;
}
