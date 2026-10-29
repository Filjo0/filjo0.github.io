import * as THREE from '../assets/vendor/three.module.js';

// Measurements are in the approved 1672 x 941 plate, never in the legacy park.
export const reference = {width: 1672, height: 941, fov: 49, eye: [0, 2.15, 0], look: [0, .835, -10]};
export function referenceCamera() {
  const camera = new THREE.PerspectiveCamera(reference.fov, reference.width / reference.height, .05, 180);
  camera.position.fromArray(reference.eye);
  camera.lookAt(...reference.look);
  camera.updateMatrixWorld(true);
  return camera;
}
const calibrated = referenceCamera();
export function fromPlate(u, v, height = 0) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(u * 2 - 1, 1 - v * 2), calibrated);
  const result = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
  if (!result || result.z >= -.5) throw new Error('Plate anchor must be below its ground horizon.');
  return result;
}

// All silhouette vertices use the same real camera as the scene and current native targets.
export function projectPlateRing(ring,height,camera,width,viewportHeight) {
  return ring.map(([u,v])=>{const p=fromPlate(u,v,height).project(camera);
    return [(p.x+1)*width/2,(1-p.y)*viewportHeight/2];});
}

// The visitor can follow the curved boardwalk and enter the pavilion. Sea, planted
// borders, the table and pool are not walkable; activities own their separate exits.
const polygons = [
  [[.34, 1], [.755, 1], [.675, .77], [.606, .65], [.606, .60], [.58, .56], [.535, .545], [.46, .54],
    [.51, .60], [.47, .68], [.425, .77]],
  [[.355, .82], [.475, .82], [.50, .65], [.44, .60], [.355, .66]],
  [[.46, .54], [.535, .545], [.52, .49], [.48, .478], [.445, .49]],
  [[.475, .50], [.50, .53], [.68, .48], [.69, .45], [.65, .442]],
  [[.435, .475], [.46, .50], [.51, .49], [.50, .455], [.45, .445]]
].map(poly => poly.map(([u, v]) => fromPlate(u, v)));
// Sheltered floor behind the table and the narrow aisle beside its right edge.
// The table itself stays blocked. Foreground artwork occludes the visitor there.
polygons.push(...[
  [[-4.6,-8.4],[-.65,-8.4],[-.65,-6.2],[-4.6,-6.2]],
  [[-1.45,-6.3],[-.65,-6.3],[-.65,-3.8],[-1.45,-3.8]]
].map(poly=>poly.map(([x,z])=>new THREE.Vector3(x,0,z))));
function inside(p, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) result = !result;
  }
  return result;
}
export function walkable(x, z) {return polygons.some(poly => inside({x, z}, poly));}
export const destinations = Object.fromEntries(Object.entries({
  overview: [.565, .66], coast: [.565, .66], winter: [.565, .66],
  work: [.43, .73], contact: [.425, .78], resume: [.395, .77], experience: [.40, .70],
  books: [.38, .75], fibonacci: [.385, .80], plants: [.445, .67],
  coaching: [.448, .70], tennis: [.448, .735], receipts: [.415, .80], globe: [.425, .715],
  ball: [.648, .477], futsl: [.663, .473], aqua: [.485, .473],
  surf: [.59, .62], skate: [.59, .62], tank: [.535, .83]
}).map(([id, uv]) => [id, fromPlate(...uv)]));
Object.assign(destinations, {
  work:new THREE.Vector3(-3.22,0,-6.6),resume:new THREE.Vector3(-3.8,0,-6.8),
  contact:new THREE.Vector3(-1.25,0,-4.46),globe:new THREE.Vector3(-1.25,0,-4.99),
  books:new THREE.Vector3(-4.05,0,-6.45),plants:new THREE.Vector3(-3.55,0,-6.45),
  fibonacci:new THREE.Vector3(-2.8,0,-6.3),receipts:new THREE.Vector3(-1.3,0,-4.15)
});
export const targets = {
  work: [.151, .61, .84], contact: [.181, .674, .83], globe: [.228, .614, .96],
  resume: [.287, .625, .84], experience: [.389, .624, .6], books: [.056, .64, .84],
  fibonacci: [.073, .742, .84], plants: [.195, .482, .6],
  coaching: [.40, .637, .63], tennis: [.391, .72, .1], receipts: [.172, .70, .84],
  ball: [.643, .412, .15], futsl: [.687, .422, .8], aqua: [.43, .429, .6],
  surf: [.87, .57, 0], skate: [.87, .57, 0], tank: [.60, .77, .15]
};
// Object-mode dots use measured pictured objects, independently of legacy activity framing.
export const hotspotTargets={
  work:targets.work,contact:targets.contact,globe:targets.globe,resume:targets.resume,
  experience:targets.experience,books:[.082,.645,.84],fibonacci:targets.fibonacci
};
// Mobile discovery labels sit below the clipboard, joined to its paper by a fine stem.
export const hotspotLabelTargets={resume:[.287,.665,.84]};
const junctions = [[.55,.88], [.53,.77], [.54,.68], [.55,.625], [.555,.575], [.515,.56], [.49,.543],
  [.488,.497], [.477,.477], [.54,.485], [.59,.48], [.64,.474], [.436,.75], [.438,.68], [.397,.765]]
  .map(uv => fromPlate(...uv));
junctions.push(...[[-.85,-6.8],[-1.25,-6.8],[-2.3,-6.8],[-3.9,-6.8],[-1.2,-4.5]]
  .map(([x,z])=>new THREE.Vector3(x,0,z)));
export function nearestWalkable(p) {
  if (walkable(p.x, p.z)) return p.clone();
  return [...junctions, ...Object.values(destinations)].filter(q => walkable(q.x, q.z))
    .reduce((best, q) => q.distanceToSquared(p) < best.distanceToSquared(p) ? q : best).clone();
}
function clear(a, b) {
  const length = a.distanceTo(b), n = Math.max(2, Math.ceil(length / .08));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}
export function findPath(start, end) {
  const points = [nearestWalkable(start), nearestWalkable(end), ...junctions];
  const distances = points.map(() => Infinity), previous = [], pending = new Set(points.map((_, i) => i));
  distances[0] = 0;
  while (pending.size) {
    const i = [...pending].reduce((a, b) => distances[a] < distances[b] ? a : b);
    if (!Number.isFinite(distances[i])) break;
    pending.delete(i);
    if (i === 1) {
      const path = [];
      for (let at = 1; at !== 0; at = previous[at]) path.unshift(points[at].clone());
      return path;
    }
    for (const j of pending) {
      const distance = distances[i] + points[i].distanceTo(points[j]);
      if (distance < distances[j] && clear(points[i], points[j])) {distances[j] = distance; previous[j] = i;}
    }
  }
  return null;
}
