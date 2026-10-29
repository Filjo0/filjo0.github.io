import * as THREE from '../assets/vendor/three.module.js';
export function geometryEvidence({
  avatar,
  props,
  camera,
  host,
  portfolio
}) {
  const point = p => ({
    x: p.x,
    y: p.y,
    z: p.z
  });

  function bounds(object) {
    const b = new THREE.Box3();
    if (object === avatar.root && avatar.modelled) {
      object.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) return;
        if (mesh.isSkinnedMesh) {
          if (!mesh.boundingBox) mesh.computeBoundingBox();
          b.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
        } else {
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          b.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
        }
      });
    } else b.setFromObject(object);
    const size = b.getSize(new THREE.Vector3());
    return {
      min: point(b.min),
      max: point(b.max),
      size: point(size)
    };
  }

  function project(p) {
    const v = p.clone().project(camera);
    return {
      x: (v.x + 1) * host.clientWidth / 2,
      y: (1 - v.y) * host.clientHeight / 2
    };
  }
  avatar.root.updateMatrixWorld(true);
  props.tank.updateMatrixWorld(true);
  props.ball.updateMatrixWorld(true);
  const foot = avatar.footWorld();
  const ballPosition = props.ball.getWorldPosition(new THREE.Vector3());
  const direction = ballPosition.clone().sub(camera.position);
  const distance = direction.length();
  const ray = new THREE.Raycaster(camera.position, direction.normalize(), 0, Math.max(0, distance - .17));
  const ballOccludedByAvatar = ray.intersectObject(avatar.root, true).some(hit => {
    for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
    return true;
  });
  return {
    targets: portfolio ? [...portfolio.objects.values()].map(o=>({id:o.id,region:o.region,
      screen:project(o.overviewPoint||o.face.getWorldPosition(new THREE.Vector3()))})) : [],
    actor: bounds(avatar.root),
    actorScreen: project(avatar.root.getWorldPosition(new THREE.Vector3())),
    foot: point(foot),
    footScreen: project(foot),
    ball: point(ballPosition),
    ballOccludedByAvatar,
    ballScreen: project(ballPosition),
    tank: bounds(props.tank),
    wave: props.wave ? {
      visible: props.wave.visible,
      bounds: bounds(props.wave),
      vertexY: props.wave.geometry.attributes.position.getY(Math.floor(props.wave.geometry.attributes
        .position.count / 2))
    } : null,
    head: point(avatar.head.getWorldPosition(new THREE.Vector3())),
    hands: avatar.limbs.map(l => point(avatar.handWorld ? avatar.handWorld(l) :
      l.arm.localToWorld(new THREE.Vector3(0, -.44, 0))))
  };
}


// Measure support: Windows WebKit accepts matrix3d syntax but flattens its perspective.
// A head-on reading pose can still align HTML to the real face on those engines.
const perspectiveSupport = new WeakMap();
export function supportsSurfacePerspective(document) {
  if (perspectiveSupport.has(document)) return perspectiveSupport.get(document);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px;border:0;padding:0;' +
    'visibility:hidden;pointer-events:none;transform-origin:0 0;transform:perspective(200px) rotateY(30deg);';
  document.body.append(probe);
  const expected = Math.cos(Math.PI / 6) * 100 / 1.25;
  const supported = Math.abs(probe.getBoundingClientRect().width - expected) < 1;
  probe.remove();
  perspectiveSupport.set(document, supported);
  return supported;
}

export function surfaceMatrix(corners, width, height) {
  if (corners.length !== 4 || width <= 0 || height <= 0) return null;
  const [p0, p1, p2, p3] = corners;
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    dy3 = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < .01) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant,
    h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const a = p1.x - p0.x + g * p1.x,
    b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y,
    e = p3.y - p0.y + h * p3.y;
  const matrix = [a / width, d / width, 0, g / width, b / height, e / height, 0, h / height, 0, 0, 1, 0, p0.x,
    p0.y, 0, 1
  ];
  return matrix.every(Number.isFinite) ? matrix : null;
}

export function projectSurface(element, object, camera, host) {
  if (!object) return false;
  object.root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const area = readableArea(object, host);
  const corners = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1]
  ].map(([x, y],i) => {
    const local=object.surfaceVertices?.[i]?.clone()||new THREE.Vector3(x*area.width/2,y*area.height/2,0);
    const v = object.face.localToWorld(local)
      .project(camera);
    return {
      x: (v.x + 1) * host.clientWidth / 2,
      y: (1 - v.y) * host.clientHeight / 2,
      z: v.z
    };
  });
  if (corners.some(p => p.z < -1 || p.z > 1)) return false;
  const width = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const height = width * area.height / area.width;
  const matrix = surfaceMatrix(corners, width, height);
  if (!matrix) return false;
  if(object.fullViewport)for(let i=0;i<matrix.length;i++)if(Math.abs(matrix[i])<1e-10)matrix[i]=0;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.transform = `matrix3d(${matrix.join(',')})`;
  element.dataset.fullscreen=String(Boolean(object.fullViewport));
  element.dataset.surface = object.kind;
  element.dataset.object = object.id;
  element.dataset.surfaceCorners = JSON.stringify(corners);
  const inset=object.fullViewport?0:8,bottom=object.fullViewport?0:host.ownerDocument?.body.dataset.objectOpen==='true'?16:54;
  const epsilon=object.fullViewport?.01:0;
  return corners.every(p=>p.x>=inset-epsilon&&p.x<=host.clientWidth-inset+epsilon&&p.y>=inset&&p.y<=host.clientHeight-bottom+epsilon);
}


// Inspect the readable central part of a fixed face when the viewport is shallow.
// The virtual scroll viewport remains inside the actual object plane.
export function readableArea(object,host) {
  if(object.currentArea)return object.currentArea;
  const availableWidth=Math.max(100,Math.min(host.clientWidth-(host.clientHeight<420?112:64),900));
  const concept=host.ownerDocument?.body.dataset.worldRenderer==='concept';
  const focused=host.ownerDocument?.body.dataset.objectOpen==='true';
  const bottomReserve=focused?32:concept?(host.clientHeight<420?150:180):100;
  const topReserve=focused?64:concept?(host.clientWidth<720?104:host.clientHeight<500?48:68):0;
  const availableHeight=Math.max(100,Math.min(host.clientHeight-bottomReserve-topReserve,660));
  let desiredWidth=Math.min(availableWidth,
    object.kind==='phone'?360:object.kind==='board'?580:object.kind==='booklet'?560:780);
  if(host.clientWidth>=720&&host.clientHeight>=500&&['experience','aqua'].includes(object.id))
    desiredWidth=Math.min(availableWidth,availableHeight*object.width/object.height);
  const ratio=desiredWidth/availableHeight;
  const width=Math.min(object.width,object.height*ratio);
  const height=Math.min(object.height,object.width/ratio);
  return {width,height,availableWidth:desiredWidth,availableHeight};
}
