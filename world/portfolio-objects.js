import * as THREE from '../assets/vendor/three.module.js';
import {
  destinationFor
} from '../world-state.js';

// First-party geometry. Each HTML surface is tied to this actual front face.
export function createPortfolioObjects({
  scene,
  mesh,
  box,
  mat,
  resources
}) {
  const objects = new Map(),
    hitMeshes = [];
  const frame = mat('#243b35', {
    roughness: .45
  });
  const paper = mat('#f7f4eb', {
    emissive: '#f7f4eb',
    emissiveIntensity: .1
  });
  const glass = mat('#172c29', {
    roughness: .3,
    emissive: '#31564b',
    emissiveIntensity: .25
  });
  const definitions = {
    coaching: {
      width: .22, height: .30, y: .75, offset: 1.05,
      material: paper, kind: 'clipboard', flat: true, centre: [-5.6, .665, 3.1], winterCentre: [-5.8, .665, -44.03]
    },
    tennis: {
      width: .075, height: .12, y: .75, offset: 1.05,
      material: paper, kind: 'racket', flat: true, centre: [-6.1, .665, 3.7], winterCentre: [-4.02, .665, -43.71]
    },
    receipts: {
      width: .075, height: .19, y: 1.05, offset: 1.55,
      material: paper, kind: 'receipt', flat: true, centre: [-5.75, 1.0604, -.56], winterCentre: [-6.2, .6604, -43.74]
    },
    work: {
      width: 2.4,
      height: 1.75,
      y: 1.9,
      offset: 2,
      material: glass,
      kind: 'kiosk'
    },
    resume: {
      width: 1.4,
      height: 2,
      y: 1.85,
      offset: 1.2,
      material: paper,
      kind: 'board'
    },
    experience: {
      width: .5,
      height: .68,
      y: 1.05,
      offset: 1.7,
      material: paper,
      kind: 'booklet'
    },
    contact: {
      width: .24,
      height: .48,
      y: 1.6,
      offset: 1.2,
      material: glass,
      kind: 'phone'
    },
    futsl: {
      width: .26,
      height: .51,
      y: 1.5,
      offset: 2,
      material: glass,
      kind: 'phone'
    },
    aqua: {
      width: .44,
      height: .68,
      y: 1.4,
      offset: 1.2,
      material: glass,
      kind: 'tablet'
    },
    tank: {
      width: 1.3,
      height: .95,
      y: 1.5,
      offset: 1.2,
      material: glass,
      kind: 'arcade'
    }
  };
  for (const region of ['coast', 'winter']) {
    for (const [id, d] of Object.entries(definitions)) {
      if (region === 'winter' && ['futsl', 'aqua', 'tank'].includes(id)) continue;
      const approach = destinationFor(id, region === 'winter' ? -43 : 19);
      const root = new THREE.Group();
      root.position.set(approach.x, d.y, approach.z - (region === 'winter' && id === 'experience' ? .8 : d
        .offset));
      const centre = region === 'winter' ? d.winterCentre : d.centre;
      if (centre) root.position.fromArray(centre);
      if (d.flat) root.rotation.x = -Math.PI / 2;
      scene.add(root);
      const bezel = d.kind === 'receipt' ? 0 : d.flat ? .006 : ['phone', 'tablet', 'booklet'].includes(d.kind) ? .018 : .07;
      const thickness = d.kind === 'receipt' ? .0008 : d.flat ? .008 : .08;
      const faceDepth = d.kind === 'receipt' ? .0005 : d.flat ? .005 : .043;
      const housing = box(d.width + bezel, d.height + bezel, thickness,
        d.kind === 'receipt' ? paper : frame, 0, 0, 0, root);
      const face = mesh(new THREE.PlaneGeometry(d.width, d.height), d.material, 0, 0, faceDepth, root);
      face.castShadow = false;
      for (const m of [housing, face]) {
        m.userData.route = id;
        hitMeshes.push(m);
      }
      if (!d.flat && d.kind !== 'booklet') box(.06, Math.max(.15, d.y - d.height / 2), .06, frame,
        0, -d.y + (d.y - d.height / 2) / 2, 0, root);
      if (d.kind === 'booklet') box(.5, .035, .24, frame, 0, -d.height / 2 - .05, 0, root);
      const object = {
        id,
        region,
        root,
        face,
        width: d.width,
        height: d.height,
        kind: d.kind,
        approach,
        readingMaterial:d.material,
        restingMaterial:null
      };
      objects.set(`${region}:${id}`, object);
      if (d.kind === 'racket') {
        const hoop = mesh(new THREE.TorusGeometry(.11, .007, 8, 48), frame, 0, .25, .008, root);
        hoop.scale.y = 1.35;
        box(.018, .18, .02, frame, 0, .01, .008, root);
        for (let i = -4; i <= 4; i++) {
          const span = .11 * Math.sqrt(1 - (i * .02 / .1485) ** 2);
          box(span * 2, .0015, .0015, frame, 0, .25 + i * .02, .008, root);
        }
        hoop.userData.route = id;
        hitMeshes.push(hoop);
      }
      // A meaningful object label remains visible before the HTML is mounted.
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 440;
      const ctx = c.getContext('2d');
      ctx.fillStyle = d.flat || d.kind === 'board' || d.kind === 'booklet' ? '#f7f4eb' : '#173b33';
      ctx.fillRect(0, 0, 640, 440);
      ctx.fillStyle = d.flat || d.kind === 'board' || d.kind === 'booklet' ? '#172c29' : '#f7f4eb';
      ctx.font = 'bold 48px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(approach.label, 320, 195);
      ctx.font = '25px Segoe UI';
      ctx.fillText('Click to explore', 320, 255);
      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      resources.push(texture);
      const resting = mat('#ffffff', {
        map: texture,
        emissive: '#ffffff',
        emissiveMap: texture,
        emissiveIntensity: .18
      });
      face.material = resting;object.restingMaterial=resting;
    }
  }
  return {
    hitMeshes,
    inspect(active){for(const object of objects.values())
      object.face.material=object===active?object.readingMaterial:object.restingMaterial;},
    get(id, z) {
      return objects.get(`${z<-29?'winter':'coast'}:${id}`);
    },
    objects
  };
}
