import * as THREE from '../assets/vendor/three.module.js';
import {supportsSurfacePerspective} from './surfaces.js';
const fov=49,depth=100;
const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
function dimensions(q) {
  return {width:Math.max(...[Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]),Math.hypot(q[2][0]-q[3][0],q[2][1]-q[3][1])]),
    height:Math.max(...[Math.hypot(q[3][0]-q[0][0],q[3][1]-q[0][1]),Math.hypot(q[2][0]-q[1][0],q[2][1]-q[1][1])])};
}
function within(q,u,v) {
  return [q[0][0]*(1-u)*(1-v)+q[1][0]*u*(1-v)+q[2][0]*u*v+q[3][0]*(1-u)*v,
    q[0][1]*(1-u)*(1-v)+q[1][1]*u*(1-v)+q[2][1]*u*v+q[3][1]*(1-u)*v];
}
export function plateMetrics(asset,host,perspective=true,readingBook=false) {
  const w=host.clientWidth,h=host.clientHeight;
  const q=w<720&&asset.mobile_corners?asset.mobile_corners:asset.corners,full=dimensions(q);
  const shortPhone=asset.kind==='phone'&&asset.mobile_corners&&w>=720&&h<500;
  const maxWidth=shortPhone?520:asset.kind==='phone'?390:asset.kind==='board'?600:1040;
  const availableWidth=Math.min(w-32,maxWidth),availableHeight=Math.max(110,h-100);
  const fit=readingBook&&w<720?Math.max(Math.min(availableWidth/full.width,availableHeight/full.height),
    Math.min(availableHeight,480)/full.height):shortPhone?availableWidth/full.width:asset.kind==='board'&&(w<720||h<500)?
    (w<720?availableHeight/full.height:availableWidth/full.width):Math.min(availableWidth/full.width,availableHeight/full.height);
  const scale=Math.max(w/asset.width,h/asset.height,fit);
  const u=Math.min(1,availableWidth/(full.width*scale)),v=Math.min(1,availableHeight/(full.height*scale));
  let crop=[[.5-u/2,.5-v/2],[.5+u/2,.5-v/2],[.5+u/2,.5+v/2],[.5-u/2,.5+v/2]].map(([x,y])=>within(q,x,y));
  // Engines that flatten CSS perspective read on a real rectangle inscribed in the photographed face.
  if(!perspective){
    const left=Math.max(crop[0][0],crop[3][0]),right=Math.min(crop[1][0],crop[2][0]);
    const top=Math.max(crop[0][1],crop[1][1]),bottom=Math.min(crop[2][1],crop[3][1]);
    crop=[[left,top],[right,top],[right,bottom],[left,bottom]];
  }
  const area=dimensions(crop);
  return {scale,corners:crop,width:area.width,height:area.height,
    centre:[mean(crop.map(p=>p[0])),mean(crop.map(p=>p[1]))]};
}
function worldPoint(p,asset) {
  const height=2*Math.tan(THREE.MathUtils.degToRad(fov/2))*depth,width=height*asset.width/asset.height;
  return new THREE.Vector3((p[0]/asset.width-.5)*width,(.5-p[1]/asset.height)*height,-depth+.01);
}
export function composePlate(object,camera,host) {
  const asset=object.plate,perspective=!host.ownerDocument||supportsSurfacePerspective(host.ownerDocument);
  // Contact always uses its measured glass inset, below the photographed camera.
  const readingAsset=object.id==='contact'?{...asset,corners:asset.mobile_corners||asset.corners}:asset;
  const metrics=plateMetrics(readingAsset,host,perspective&&!['work','resume','contact'].includes(object.id),object.id==='books');
  const w=host.clientWidth,h=host.clientHeight;
  object.currentArea={width:metrics.width,height:metrics.height};
  object.surfaceVertices=metrics.corners.map(p=>worldPoint(p,asset));
  const position=object.face.geometry.attributes.position;
  object.surfaceVertices.forEach((p,i)=>position.setXYZ(i,p.x,p.y,p.z));position.needsUpdate=true;
  object.face.geometry.computeBoundingSphere();
  camera.fov=fov;camera.position.set(0,0,0);camera.up.set(0,1,0);camera.lookAt(0,0,-1);
  camera.aspect=asset.width/asset.height;
  camera.setViewOffset(asset.width*metrics.scale,asset.height*metrics.scale,
    THREE.MathUtils.clamp(metrics.centre[0]*metrics.scale-w/2,0,asset.width*metrics.scale-w),
    THREE.MathUtils.clamp(metrics.centre[1]*metrics.scale-(h/2+16),0,asset.height*metrics.scale-h),w,h);
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const touch=object.expandScreen&&host.ownerDocument?.defaultView?.matchMedia('(pointer: coarse)').matches;
  object.fullViewport=Boolean(object.fullScreenGame||(object.expandScreen||
    ['work','ball','skate','surf','plants','fibonacci'].includes(object.id))&&(w<720||h<500||touch));
  if(object.fullViewport){
    const top=64;
    object.currentArea={width:w,height:h-top};
    object.surfaceVertices=[[0,top],[w,top],[w,h],[0,h]].map(([x,y])=>{
      const p=new THREE.Vector3(x/w*2-1,1-y/h*2,.5).unproject(camera);return p.multiplyScalar((-depth+.01)/p.z);
    });
    object.surfaceVertices.forEach((p,i)=>position.setXYZ(i,p.x,p.y,p.z));position.needsUpdate=true;
    object.face.geometry.computeBoundingSphere();
  }

}
export function createPlateViews({scene,resources,texture}) {
  let manifest,disposed=false;
  const pending=new Map(),images=new Map();
  function loadManifest(){
    return manifest ||= fetch(new URL('../assets/outdoor/object-views.json',import.meta.url)).then(r=>{
      if(!r.ok)throw Error('Object views unavailable');return r.json();
    }).catch(e=>{manifest=null;throw e;});
  }
  const aliases={tank:'work',skate:'ball',surf:'ball',plants:'books',fibonacci:'books'};
  const ids=new Set(['work','books','resume','contact','experience','ball','tank','skate','surf','plants','fibonacci']);
  async function ensure(object,region='coast') {
    if(!ids.has(object.id))return object;
    const key=['ball','skate','surf'].includes(object.id)?(region==='winter'?'ball_winter':'ball'):
      aliases[object.id]||object.id;
    const pendingKey=object.id+':'+key;
    if(object.plate&&object.plateKey===key)return object;
    if(pending.has(pendingKey)&&!object.plate)return pending.get(pendingKey);
    const promise=(async()=>{
      const data=await loadManifest(),game=['ball','skate','surf'].includes(object.id);
      const asset=game?{width:1600,height:900,kind:'game',corners:[[0,0],[1600,0],[1600,900],[0,900]]}:data.views[key];
      object.fullScreenGame=game;
      if(!game&&!images.has(asset.image))images.set(asset.image,texture(asset.image).catch(e=>{images.delete(asset.image);throw e;}));
      const image=game?null:await images.get(asset.image);if(disposed){image?.dispose();return object;}
      if(object.plate){object.root.children[0].material.map=image;object.plate=asset;object.plateKey=key;return object;}
      const root=new THREE.Group();root.visible=false;scene.add(root);
      const height=2*Math.tan(THREE.MathUtils.degToRad(fov/2))*depth,width=height*asset.width/asset.height;
      const geometry=new THREE.PlaneGeometry(width,height);
      const material=new THREE.MeshBasicMaterial({map:image,toneMapped:false});
      const photo=new THREE.Mesh(geometry,material);photo.position.z=-depth;root.add(photo);
      const faceGeometry=new THREE.BufferGeometry();
      faceGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));
      faceGeometry.setIndex([0,1,2,0,2,3]);
      const clear=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
      const face=new THREE.Mesh(faceGeometry,clear);root.add(face);
      resources.push(geometry,material,faceGeometry,clear);
      object.plateKey=key;object.overviewPoint=object.face.getWorldPosition(new THREE.Vector3());object.root.visible=false;
      Object.assign(object,{root,face,plate:asset,readingMaterial:clear});return object;
    })().catch(e=>{pending.delete(pendingKey);throw e;});
    pending.set(pendingKey,promise);return promise;
  }
  return {ensure,dispose(){disposed=true;},has:id=>ids.has(id)};
}
