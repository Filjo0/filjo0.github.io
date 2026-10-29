import * as THREE from '../../assets/vendor/three.module.js';
import {
  SurfRide
} from '../logic/surf.js';
export function createSurf({
  avatar,
  props,
  mesh,
  mat
}) {
  const ride = new SurfRide();
  const home = props.board.position.clone();
  const geometry = new THREE.PlaneGeometry(8, 10, 24, 36);
  geometry.rotateX(-Math.PI / 2);
  const wave = mesh(geometry, mat('#487d87', {
    side: THREE.DoubleSide,
    roughness: .24,
    metalness: .25
  }), 26, -.009, 7);
  wave.visible = false;
  props.wave = wave;
  wave.castShadow = false;
  const foamGeometry = new THREE.PlaneGeometry(6.5, .14, 32, 1);
  foamGeometry.rotateX(-Math.PI / 2);
  const foam = mesh(foamGeometry, mat('#e5eee7', {
    side: THREE.DoubleSide,
    transparent: true,
    opacity: .75
  }));
  foam.visible = false;
  foam.castShadow = false;
  const foamPositions = foamGeometry.attributes.position;
  const baseZ = Array.from({
    length: foamPositions.count
  }, (_, i) => foamPositions.getZ(i));
  const positions = geometry.attributes.position;
  let crest = 0;
  return {
    exitSpot: {
      x: 17,
      z: 7
    },
    enter() {
      ride.start();
      wave.visible = true;
      foam.visible = true;
    },
    update(dt, input) {
      ride.step(dt, input.dx);
      const t = ride.elapsed;
      crest = Math.sin(t * 1.3) * 1.8;
      for (let i = 0; i < positions.count; i++) {
        const z = positions.getZ(i);
        const x = positions.getX(i);
        const edge = Math.pow(Math.max(0, 1 - x * x / 16), 2) * Math.pow(Math.max(0, 1 - z * z / 25), 2);
        const h = .75 * Math.exp(-Math.pow((z - crest) / 1.3, 2));
        positions.setY(i, (h + Math.sin(z * 1.5 - t * 2) * .08) * edge);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      for (let i = 0; i < foamPositions.count; i++) {
        const x = foamPositions.getX(i),
          z = crest + baseZ[i] + Math.sin(x * 1.2 + t) * .035;
        const edge = Math.pow(Math.max(0, 1 - x * x / 16), 2) * Math.pow(Math.max(0, 1 - z * z / 25), 2);
        const h = .75 * Math.exp(-Math.pow((z - crest) / 1.3, 2));
        foamPositions.setZ(i, z);
        foamPositions.setY(i, (h + Math.sin(z * 1.5 - t * 2) * .08) * edge + .012);
      }
      foamPositions.needsUpdate = true;
      foamGeometry.computeBoundingBox();
      const x = 26 - t * .08;
      wave.position.set(x, -.009, 7 - t * .5);
      foam.position.copy(wave.position);
      const crestHeight = .75 * Math.pow(Math.max(0, 1 - crest * crest / 25), 2);
      props.board.position.set(x, crestHeight + Math.sin(crest * 1.5 - t * 2) * .04 + .055,
        wave.position.z + crest);
      props.board.rotation.set(.07 * Math.sin(t), 0, ride.balance * .3);
      avatar.root.position.copy(props.board.position);
      avatar.root.position.y += .08;
      avatar.root.rotation.y = Math.PI;
      avatar.root.rotation.z = ride.balance * .3;
      avatar.hips.position.y = (avatar.restHeight ?? .87) - .10;
    },
    state() {
      return {
        type: 'surf',
        phase: ride.phase,
        balance: ride.balance,
        elapsed: ride.elapsed,
        goalSeconds: 12,
        waveCrest: crest
      };
    },
    exit() {
      wave.visible = false;
      foam.visible = false;
      props.board.position.copy(home);
      props.board.rotation.set(0, 0, 0);
    }
  };
}
