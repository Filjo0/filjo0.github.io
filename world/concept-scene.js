import {reducedMotion} from './motion.js';
import {createPlateViews} from './plate-views.js';
import * as THREE from '../assets/vendor/three.module.js';
import {referenceCamera, fromPlate, targets} from './concept-layout.js';
import {createPortfolioObjects} from './portfolio-objects.js';

export function createConceptScene({host, onFailure, walkthrough=false}) {
  const scene = new THREE.Scene(), resources = [];
  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.addEventListener('webglcontextlost', event => {event.preventDefault(); onFailure({reason:'webgl-context-lost'});});
  const mat = (color, extra = {}) => {
    const result = new THREE.MeshStandardMaterial({color, roughness: .65, ...extra});
    resources.push(result); return result;
  };
  const mesh = (geometry, material, x = 0, y = 0, z = 0, parent = scene) => {
    resources.push(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z); result.castShadow = true; result.receiveShadow = true;
    parent.add(result); return result;
  };
  const box = (w,h,d,m,x,y,z,parent) => mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
  const materials = {skin: mat('#b58b69'), wood: mat('#755236'), dark: mat('#233633'), leaf: mat('#3e6748')};
  const hemi = new THREE.HemisphereLight('#ffe4ca', '#54533f', 1.2);
  const sun = new THREE.DirectionalLight('#ffd2a0', 2.2);
  sun.position.set(10, 12, -4); sun.target.position.set(0, 0, -12);
  sun.castShadow = true; sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera, {left:-15,right:15,top:15,bottom:-15,far:60});
  sun.shadow.bias = -.0001; sun.shadow.normalBias = .025;
  scene.add(hemi, sun, sun.target);
  const environment = {scene, renderer, resources, mat, mesh, box, materials, lights:{hemi,sun}};
  const loader = new THREE.TextureLoader();
  async function texture(file) {
    let result;
    try {result=await loader.loadAsync(new URL('../assets/outdoor/' + file, import.meta.url).href);}
    catch(cause){throw Object.assign(new Error('Scene artwork failed to load'),{asset:file,cause});}
    result.colorSpace = THREE.SRGBColorSpace; resources.push(result); return result;
  }
  const waterImage={value:null};
  const fixed = referenceCamera();
  const uniforms = {coast:{value:null}, winter:{value:null}, coastDusk:{value:null}, winterDusk:{value:null},
    twilight:{value:0}, season:{value:0}, darkness:{value:1},
    referenceMatrix:{value:new THREE.Matrix4().multiplyMatrices(fixed.projectionMatrix, fixed.matrixWorldInverse)}};
  const plateMaterial = new THREE.ShaderMaterial({uniforms, toneMapped:false, side:THREE.DoubleSide,
    vertexShader: `varying vec4 plateCoord;
      uniform mat4 referenceMatrix;
      void main(){vec4 world=modelMatrix*vec4(position,1.0);plateCoord=referenceMatrix*world;
        gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `varying vec4 plateCoord;uniform sampler2D coast;uniform sampler2D winter;
      uniform sampler2D coastDusk;uniform sampler2D winterDusk;uniform float twilight;
      uniform float season;uniform float darkness;
      void main(){vec2 uv=plateCoord.xy/plateCoord.w*0.5+0.5;
        vec3 day=mix(texture2D(coast,uv).rgb,texture2D(winter,uv).rgb,season);
        vec3 evening=mix(texture2D(coastDusk,uv).rgb,texture2D(winterDusk,uv).rgb,season);
        gl_FragColor=vec4(mix(day,evening,twilight)*darkness,1.0);
        #include <colorspace_fragment>
      }`});
  resources.push(plateMaterial);
  const scenery = new THREE.Group(); scene.add(scenery);
  function polygon(points, depth) {
    const vertices = points.map(([u,v]) => {
      const point = new THREE.Vector3(u*2-1, 1-v*2, .5).unproject(fixed).sub(fixed.position);
      point.multiplyScalar(depth / -point.clone().applyQuaternion(fixed.quaternion.clone().invert()).z);
      return point.add(fixed.position);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(v=>v.toArray()),3));
    geometry.setIndex(points.slice(2).flatMap((_,i)=>[0,i+1,i+2]));
    const object = mesh(geometry,plateMaterial,0,0,0,scenery); object.castShadow=false; object.receiveShadow=false;
    return object;
  }
  polygon([[0,0],[1,0],[1,1],[0,1]],100);
  // Foreground occlusion layers contain the same pixels, at measured depths.
  // Walking behind a desk/post or shrub must hide the body, not paint it on top.
  polygon([[0,.61],[.332,.585],[.332,.63],[0,.90]],2.8);
  polygon([[.336,.17],[.36,.185],[.365,.648],[.34,.677]],3.4);
  polygon([[.114,.10],[.131,.117],[.131,.595],[.115,.61]],2.5);
  polygon([[.246,.675],[.346,.70],[.289,1],[.15,1]],2.2);
  polygon([[.78,.76],[1,.69],[1,1],[.77,1]],3);
  const waterVertices=[[.389,.416],[.51,.414],[.523,.427],[.49,.435],[.389,.435]].map(uv=>fromPlate(...uv,.09));
  const waterGeometry=new THREE.BufferGeometry();
  waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(waterVertices.flatMap(p=>p.toArray()),3));
  waterGeometry.setIndex([0,1,2,0,2,3,0,3,4]);
  const waterSurface=mesh(waterGeometry,plateMaterial);waterSurface.castShadow=false;waterSurface.receiveShadow=false;
  scenery.add(waterSurface);
  const shadow = new THREE.ShadowMaterial({opacity:.23,depthWrite:false}); resources.push(shadow);
  const ground = mesh(new THREE.PlaneGeometry(70,95),shadow,0,.006,-30);
  ground.rotation.x=-Math.PI/2; ground.castShadow=false;

  const portfolio = createPortfolioObjects(environment);
  const objects = new Map(), hitMeshes = [];
  for (const old of portfolio.objects.values()) {
    old.root.visible = false;
    if (old.region !== 'coast' || ['coaching','tennis','receipts','plants','ball','surf','skate'].includes(old.id)) continue;
    const anchor = targets[old.id];
    old.root.position.copy(fromPlate(...anchor));
    old.root.rotation.set(0,0,0);
    if (['phone','booklet','board','receipt','clipboard','racket'].includes(old.kind)) old.root.rotation.x=-Math.PI/2;
    if (old.id==='work' || old.id==='tank') old.root.rotation.y=Math.PI;
    for (const child of [...old.root.children]) child.removeFromParent();
    const sizes = old.id==='experience' ? [.30,.297,.013] : old.id==='aqua' ? [.28,.31,.013] :
      old.kind==='phone' ? [.076,.155,.012] : old.kind==='receipt' ? [.075,.19,.001] :
      old.kind==='kiosk' || old.kind==='arcade' ? [.34,.23,.016] : [.21,.297,.013];
    [old.width,old.height]=sizes;
    const housingMaterial=old.kind==='phone'?mat('#24282a',{metalness:.75,roughness:.32}):materials.dark;
    const edge=old.kind==='phone'?.005:.008;
    box(sizes[0]+edge,sizes[1]+edge,sizes[2],housingMaterial,0,0,-sizes[2]/2,old.root);
    if(old.kind==='phone') {
      box(.018,.001,.0005,housingMaterial,0,sizes[1]/2-.003,.002,old.root);
      box(.014,.001,.0005,housingMaterial,0,-sizes[1]/2+.003,.002,old.root);
    }
    old.face = mesh(new THREE.PlaneGeometry(old.width,old.height),old.readingMaterial,0,0,.001,old.root);
    old.face.castShadow=false;
    if (old.kind==='kiosk') {
      const base=box(.36,.012,.24,materials.dark,0,-.126,.1,old.root);
      base.rotation.x=-.05;
      for(let i=0;i<5;i++) for(let j=0;j<12;j++)
        box(.019,.002,.015,materials.dark,(j-5.5)*.025,-.119,.02+i*.025,old.root);
    }
    old.approach = null;
    objects.set(old.id,old);
  }
  for(const id of ['books','fibonacci']) {
    const root=new THREE.Group();root.position.copy(fromPlate(...targets[id]));root.rotation.x=-Math.PI/2;scene.add(root);
    const width=.42,height=.297;
    const paper=mat('#f7f4eb',{emissive:'#f7f4eb',emissiveIntensity:.15});
    box(width+.01,height+.01,.012,materials.wood,0,0,-.008,root);
    const face=mesh(new THREE.PlaneGeometry(width,height),paper,0,0,.001,root);face.castShadow=false;
    root.visible=false;
    objects.set(id,{id,region:'coast',root,face,width,height,kind:'booklet',readingMaterial:paper});
  }
  const transparent = new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  resources.push(transparent);
  const halos = new Map();
  for (const [id,[u,v,height]] of Object.entries(targets)) {
    if(['tank','coaching','tennis','receipts','plants','ball','surf','skate'].includes(id))continue;
    const p = fromPlate(u,v,height);
    const radius = ['surf','skate','ball','tank'].includes(id) ? .7 : .15;
    const hit = mesh(new THREE.SphereGeometry(radius,16,8),transparent,p.x,p.y,p.z);
    hit.userData.route=id;hit.castShadow=false;hitMeshes.push(hit);
    const haloMaterial = new THREE.MeshBasicMaterial({color:'#fff4d7',transparent:true,opacity:.75,depthTest:false});
    resources.push(haloMaterial);
    const halo = mesh(new THREE.RingGeometry(radius*.75,radius*.82,40),haloMaterial,p.x,p.y,p.z);
    halo.visible=false;halo.renderOrder=5;halo.castShadow=false;halos.set(id,halo);
  }
  const plateViews=createPlateViews({scene,resources,texture});
  let inspected = null;
  let closeupCoast=null,closeupWinter=null,season=0;
  // The coast is the only photograph needed to open the object-based portfolio.
  const ready = texture('concept-coast-v2.webp').then(a=>{
    uniforms.coast.value=a;uniforms.winter.value=a;uniforms.coastDusk.value=a;uniforms.winterDusk.value=a;
    waterImage.value=a;
    if(walkthrough)return Promise.all(['concept-desk-closeup-v1.webp','concept-winter-desk-closeup-v1.webp'].map(texture))
      .then(([c,d])=>{closeupCoast=c;closeupWinter=d;});
  });
  let winterLoad=null;
  function prepareSeason(next) {
    if(next!=='winter')return Promise.resolve();
    if(!winterLoad)winterLoad=texture('concept-winter-v2.webp').then(b=>{
      uniforms.winter.value=b;
      if(!eveningLoaded)uniforms.winterDusk.value=b;
    }).catch(error=>{winterLoad=null;throw error;});
    return winterLoad;
  }
  let eveningLoad=null,eveningTarget=0,eveningLoaded=false,lightingDisposed=false,lightingVersion=0;
  function inspect(object) {
    if (inspected) inspected.root.visible=false;
    inspected=object;
    if (object) {object.root.visible=true; object.face.material=object.readingMaterial;}
    scenery.visible=!object;
    ground.visible=!object;
    // A linked close-up is filled with a matching desk photograph when available.
    scene.background=object?.plate?new THREE.Color('#342c25'):object?(season<.5?closeupCoast:closeupWinter):null;
  }
  return {...environment,waterImage, portfolio:{objects,hitMeshes,get:id=>objects.get(id),inspect,ensure:plateViews.ensure,hasPlate:plateViews.has},
    ready,prepareSeason,
    applySeason(value) {
      uniforms.season.value=value;season=value;
      if(inspected&&!inspected.plate)scene.background=value<.5?closeupCoast:closeupWinter;
      sun.color.set('#ffd2a0').lerp(new THREE.Color('#dbe8ff'),value);
      hemi.color.set('#ffe4ca').lerp(new THREE.Color('#e0edff'),value);
    },
    async setNight(value) {
      const token=++lightingVersion;
      if(value&&!eveningLoaded) {
        if(!eveningLoad)eveningLoad=Promise.all(['concept-coast-dusk-v2.webp','concept-winter-dusk-v2.webp'].map(texture))
          .then(([a,b])=>{uniforms.coastDusk.value=a;uniforms.winterDusk.value=b;eveningLoaded=true;})
          .catch(e=>{eveningLoad=null;throw e;});
        await eveningLoad;
      }
      if(lightingDisposed||token!==lightingVersion)return;
      eveningTarget=value?1:0;
      if(reducedMotion())uniforms.twilight.value=eveningTarget;
    },
    stepLighting(dt) {
      const current=uniforms.twilight.value,delta=eveningTarget-current;
      uniforms.twilight.value=current+Math.sign(delta)*Math.min(Math.abs(delta),dt/1.1);
      sun.intensity=2.2-uniforms.twilight.value*1.8;hemi.intensity=1.2-uniforms.twilight.value*.45;
      scene.backgroundIntensity=1-uniforms.twilight.value*.45;
      waterImage.value=uniforms.twilight.value>.5?uniforms.coastDusk.value:uniforms.coast.value;
    },
    lighting:()=>({blend:uniforms.twilight.value,target:eveningTarget,ready:eveningLoaded}),
    lightingRunning:()=>Math.abs(uniforms.twilight.value-eveningTarget)>.00001,
    cancelLighting(){plateViews.dispose();lightingDisposed=true;++lightingVersion;},
    highlight(id,camera) {for(const [key,halo] of halos){halo.visible=key===id&&!inspected;halo.quaternion.copy(camera.quaternion);}}
  };
}
