import * as THREE from './assets/vendor/three.module.js';

const vec = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (t) => t * t * (3 - 2 * t);

// One physical room and camera. HTML surfaces use the same projected corners as
// their meshes, so links, scrolling and the approved resume stay on the objects.
export function createWalkthrough({ host, surface, points, onContextLost }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor('#171b21');
  renderer.domElement.className = 'room-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); stop(); onContextLost(); });
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.025, 40);
  camera.position.set(0, 1.65, 5.8);
  camera.lookAt(0, 1.05, -0.7);
  let disposed = false;
  let width = 1;
  let height = 1;
  let motion = true;
  let tween = null;
  let frame = 0;
  let sequence = 0;
  let held = null;
  let active = 'overview';
  let inspecting = false;
  let yaw = 0;
  let drag = null;
  const objects = {};
  const resources = [];
  const events = new AbortController();
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
    resources.push(value);
    return value;
  };
  let seed = 301;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const texture = (kind) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = kind === 'wood' ? '#a98d6d' : kind === 'fabric' ? '#4b5146' : '#5d5a55';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < (kind === 'wood' ? 650 : 26000); i++) {
      ctx.globalAlpha = kind === 'wood' ? 0.025 + random() * 0.09 : 0.012 + random() * 0.035;
      ctx.fillStyle = random() > 0.5 ? '#f4d6ab' : '#171715';
      const x = random() * 512;
      const y = random() * 512;
      if (kind === 'wood') {
        ctx.fillRect(x, y, 30 + random() * 380, 0.3 + random() * 1.1);
      } else ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
    }
    ctx.globalAlpha = 1;
    const value = new THREE.CanvasTexture(canvas);
    value.colorSpace = THREE.SRGBColorSpace;
    value.wrapS = value.wrapT = THREE.RepeatWrapping;
    value.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    resources.push(value);
    return value;
  };
  const oak = material('#d4c4a8', { map: texture('wood'), roughness: 0.7 });
  const darkOak = material('#755439', { map: oak.map, roughness: 0.68 });
  const wall = material('#9c9790', { map: texture('stone'), roughness: 0.98 });
  const upholstery = material('#626b5b', { map: texture('fabric'), roughness: 0.98 });
  const charcoal = material('#292d2c', { roughness: 0.73 });
  const copper = material('#b97343', { metalness: 0.72, roughness: 0.3 });
  const paper = material('#f0e6cc', { roughness: 0.96 });
  const black = material('#151b20', { roughness: 0.79, metalness: 0.08 });
  const glow = material('#fce0b2', { emissive: '#ffd49d', emissiveIntensity: 1.4 });
  const geometry = (value) => { resources.push(value); return value; };
  const add = (parent, shape, mat, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry(shape), mat);
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (parent, size, position, mat, radius = 0) => {
    if (!radius) return add(parent, new THREE.BoxGeometry(...size), mat, position);
    const [w, h, d] = size;
    const r = Math.min(radius, w / 3, h / 3);
    const shape = new THREE.Shape();
    shape.moveTo(-w/2+r, -h/2);
    shape.lineTo(w/2-r, -h/2); shape.quadraticCurveTo(w/2, -h/2, w/2, -h/2+r);
    shape.lineTo(w/2, h/2-r); shape.quadraticCurveTo(w/2, h/2, w/2-r, h/2);
    shape.lineTo(-w/2+r, h/2); shape.quadraticCurveTo(-w/2, h/2, -w/2, h/2-r);
    shape.lineTo(-w/2, -h/2+r); shape.quadraticCurveTo(-w/2, -h/2, -w/2+r, -h/2);
    const mesh = add(parent, new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.005, d - r), bevelEnabled:true, bevelThickness:r/2, bevelSize:r/2, bevelSegments:3, steps:1, curveSegments:8 }), mat, position);
    mesh.geometry.translate(0, 0, -d/2 + r/2);
    return mesh;
  };
  const cylinder = (parent, radius, h, position, mat, topRadius = radius) => add(parent, new THREE.CylinderGeometry(topRadius, radius, h, 32), mat, position);
  const group = (position, rotation = 0) => { const g = new THREE.Group(); g.position.set(...position); g.rotation.y = rotation; scene.add(g); return g; };
  const remember = (key, root, face, w, h, labelPosition) => {
    objects[key] = { root, face, w, h, home:root.position.clone(), rotation:root.quaternion.clone(), marker:labelPosition || face };
    return objects[key];
  };
  const face = (parent, w, h, z, color) => {
    const mesh = add(parent, new THREE.PlaneGeometry(w, h), material(color, { emissive:color, emissiveIntensity:0.08 }), [0,0,z]);
    mesh.castShadow = false;
    return mesh;
  };

  // Architectural shell: open entrance, an actual window aperture and oak boards.
  box(scene, [8.2,0.12,9.2], [0,-0.075,1.35], darkOak);
  for (let i = 0; i < 26; i++) {
    const plank = box(scene, [0.308,0.025,9], [-3.9+i*0.312,-0.005,1.4], oak);
    plank.material = material(new THREE.Color('#baa18a').multiplyScalar(0.75 + random()*0.28), { map:oak.map, roughness:0.65 });
  }
  box(scene, [2.0,3.2,0.15], [-3,1.6,-2.8], wall);
  box(scene, [2.0,3.2,0.15], [3,1.6,-2.8], wall);
  box(scene, [4,0.7,0.15], [0,0.35,-2.8], wall);
  box(scene, [4,0.25,0.15], [0,3.075,-2.8], wall);
  box(scene, [0.16,3.2,8.7], [-4.05,1.6,1.55], wall);
  box(scene, [0.16,3.2,8.7], [4.05,1.6,1.55], wall);
  box(scene, [8.2,0.12,8.7], [0,3.24,1.55], material('#55544f'));
  for (const x of [-2, -0.67, 0.67, 2]) box(scene, [0.05,2.33,0.12], [x,1.825,-2.72], black);
  box(scene, [4.12,0.05,0.12], [0,0.7,-2.72], black);
  box(scene, [4.12,0.05,0.12], [0,2.98,-2.72], black);
  const sky = add(scene, new THREE.PlaneGeometry(4.05,2.4), new THREE.MeshBasicMaterial({color:'#526172'}), [0,1.85,-2.91]);
  const loader = new THREE.TextureLoader();
  loader.load('assets/studio-workspace.webp', (map) => {
    if(disposed){map.dispose();return;}
    map.colorSpace = THREE.SRGBColorSpace;
    // Reuse only the window area of our own original artwork as an exterior texture.
    map.repeat.set(0.255,0.36); map.offset.set(0.345,0.45);
    sky.material.map = map; sky.material.needsUpdate = true; resources.push(map); render();
  }, undefined, () => render());
  const rug = box(scene, [2.9,0.018,2.45], [0,0.025,0.65], material('#97866a', {map:texture('fabric')}));
  rug.receiveShadow = true;
  const rugBorder = box(scene, [3.06,0.015,2.6], [0,0.016,0.65], material('#736047'));
  rugBorder.receiveShadow = true;

  // Desk, keyboard, seated chair, monitor and a real resume folio on its right edge.
  const desk = group([-2.55,0,-1.72]);
  box(desk, [2.35,0.075,0.9], [0,0.79,0], oak, 0.025);
  for (const x of [-1.02,1.02]) for (const z of [-0.32,0.32]) box(desk,[0.055,0.76,0.055],[x,0.38,z],charcoal);
  box(desk,[0.75,0.025,0.34],[-0.25,0.843,0.18],charcoal,0.014);
  for (let row=0;row<4;row++) for(let col=0;col<13;col++) box(desk,[0.044,0.007,0.04],[-0.52+col*0.048,0.86,0.08+row*0.052],material(row%2 ? '#4d5150':'#606561'));
  const chair = group([-2.65,0,-0.62]);
  box(chair,[0.5,0.14,0.49],[0,0.48,0],upholstery,0.075);
  const back = box(chair,[0.49,0.65,0.1],[0,0.93,0.23],charcoal,0.06); back.rotation.x = -0.13;
  cylinder(chair,0.04,0.39,[0,0.23,0],black);
  for(let i=0;i<5;i++) {const arm=box(chair,[0.055,0.03,0.38],[0,0.065,0],black);arm.rotation.y=i*Math.PI*2/5;}
  const monitor = group([-2.68,1.35,-2.12]);
  box(monitor,[1.4,0.84,0.065],[0,0,0],black,0.025);
  box(monitor,[0.055,0.23,0.055],[0,-0.49,-0.012],black);
  box(monitor,[0.4,0.024,0.23],[0,-0.55,0],black,0.009);
  const monitorFace = face(monitor,1.32,0.75,0.037,'#26383a');
  remember('work',monitor,monitorFace,1.32,0.75);
  // Dim code at rest is a first-party procedural screen texture, never project evidence.
  const code = document.createElement('canvas'); code.width=800;code.height=450;
  const codeContext=code.getContext('2d'); codeContext.fillStyle='#102527';codeContext.fillRect(0,0,800,450);
  for(let i=0;i<28;i++){codeContext.fillStyle=['#78a9a3','#bc9c7d','#547679'][i%3];codeContext.fillRect(35+(i%4)*18,22+i*14,80+(i%7)*31,3);}
  monitorFace.material.map=new THREE.CanvasTexture(code);monitorFace.material.map.colorSpace=THREE.SRGBColorSpace;resources.push(monitorFace.material.map,sky.material);
  const display=new THREE.MeshBasicMaterial({map:monitorFace.material.map});resources.push(display);monitorFace.material=display;
  const folio = group([-1.64,0.85,-1.66]); folio.rotation.x=-Math.PI/2;folio.rotation.z=0.12;
  box(folio,[0.26,0.36,0.019],[0,0,0],material('#594939'),0.008);
  box(folio,[0.247,0.346,0.009],[0,0,0.013],paper,0.004);
  const resumeFace=face(folio,0.235,0.33,0.02,'#fff8e9');
  remember('resume',folio,resumeFace,0.235,0.33);

  const coffee = group([0,0,0]);
  box(coffee,[1.72,0.075,1.02],[0,0.41,0],oak,0.025);
  for(const x of [-0.7,0.7])for(const z of [-0.36,0.36])box(coffee,[0.055,0.37,0.055],[x,0.205,z],darkOak);
  const notebook = group([-0.08,0.463,0.12]); notebook.rotation.x=-Math.PI/2;notebook.rotation.z=-0.18;
  box(notebook,[0.28,0.38,0.024],[0,0,0],material('#424b42'),0.012);
  box(notebook,[0.269,0.369,0.015],[0,0,0.018],paper,0.003);
  const bookFace=face(notebook,0.26,0.36,0.028,'#eee5cd');
  for(let i=0;i<9;i++)add(notebook,new THREE.TorusGeometry(.009,.002,5,12),copper,[-.136,-.15+i*.037,.034]);
  remember('experience',notebook,bookFace,0.26,0.36);
  for(let i=0;i<3;i++){const b=box(coffee,[0.31,0.034,0.23],[-0.48,0.468+i*0.038,-0.28],material(['#8e7252','#4e604f','#c0af88'][i]));b.rotation.y=i*.09;}
  cylinder(coffee,0.075,0.14,[0.53,0.515,-0.15],charcoal);
  const handle=add(coffee,new THREE.TorusGeometry(0.05,0.011,8,24),charcoal,[0.62,0.51,-0.15]);handle.rotation.y=Math.PI/2;
  const ottoman=group([0.9,0,1.18]);cylinder(ottoman,0.46,0.35,[0,0.2,0],upholstery,0.48);
  add(ottoman,new THREE.SphereGeometry(0.48,32,16,0,Math.PI*2,0,Math.PI/2),upholstery,[0,0.37,0]).scale.y=0.16;

  const sofa=group([3.24,0,0.15],-Math.PI/2);
  box(sofa,[2.4,0.29,0.9],[0,0.33,0],charcoal,0.1);
  box(sofa,[2.4,0.55,0.2],[0,0.73,-0.36],upholstery,0.09);
  for(const x of [-1.12,1.12])box(sofa,[0.2,0.46,0.92],[x,0.52,0],upholstery,0.09);
  for(const x of [-0.55,0.55])box(sofa,[0.92,0.17,0.72],[x,0.55,0.04],upholstery,0.06);
  const cushion=box(sofa,[0.45,0.45,0.14],[-0.6,0.84,-0.19],material('#a48d62',{map:texture('fabric')}),0.06);cushion.rotation.z=0.13;
  const table=group([2.22,0,-1.46]);cylinder(table,0.43,0.055,[0,0.69,0],oak);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;box(table,[0.04,0.67,0.04],[Math.cos(a)*.3,.35,Math.sin(a)*.3],darkOak);}
  const phone=group([2.15,0.732,-1.34]);phone.rotation.x=-Math.PI/2;phone.rotation.z=-0.2;
  box(phone,[0.102,0.203,0.01],[0,0,0],black,0.012);
  const phoneFace=face(phone,0.092,0.184,0.014,'#091114');
  remember('contact',phone,phoneFace,0.092,0.184);
  box(phone,[0.025,0.003,0.002],[0,0.086,0.016],black,0.001);

  const lamp=(parent, x, y, z, small=false)=>{
    const scale=small?0.7:1;
    cylinder(parent,0.11*scale,0.025,[x,y,z],copper);
    cylinder(parent,0.018*scale,0.36*scale,[x,y+0.19*scale,z],copper);
    add(parent,new THREE.SphereGeometry(0.18*scale,32,16,0,Math.PI*2,0,Math.PI/2),copper,[x,y+0.42*scale,z]);
    cylinder(parent,0.13*scale,0.01,[x,y+0.416*scale,z],glow);
    const light=new THREE.PointLight('#ffcf91',small?9:15,3,2);light.position.set(x,y+0.34*scale,z);parent.add(light);
  };
  lamp(table,0.15,0.725,-0.13,true);
  lamp(desk,-0.83,0.85,-0.08,true);
  const plant=(position,size)=>{
    const p=group(position);
    const ceramic=material('#8c8270',{roughness:.86});
    cylinder(p,size*.3,size*.55,[0,size*.28,0],ceramic,size*.36);
    cylinder(p,size*.335,.012,[0,size*.56,0],material('#39382b'));
    const rim=add(p,new THREE.TorusGeometry(size*.35,size*.014,8,40),ceramic,[0,size*.56,0]);rim.rotation.x=Math.PI/2;
    const stalk=material('#52613f',{roughness:.95});
    const shades=['#34553c','#426a47','#52754a'];
    for(let i=0;i<14;i++){
      const a=i*2.3999,r=size*(.12+random()*.31),y=size*(.61+random()*.65);
      const base=vec(0,size*.55,0),tip=vec(Math.cos(a)*r,y,Math.sin(a)*r);
      const delta=tip.clone().sub(base);
      const stem=add(p,new THREE.CylinderGeometry(size*.003,size*.006,delta.length(),6),stalk,base.clone().add(tip).multiplyScalar(.5).toArray());
      stem.quaternion.setFromUnitVectors(vec(0,1,0),delta.normalize());
      // Curved pointed leaves, with a shallow central crease and tapered edges.
      const vertices=[],indices=[];
      for(let row=0;row<=10;row++)for(let col=0;col<=4;col++){
        const v=row/10,u=col/4*2-1,edge=Math.sin(v*Math.PI);
        vertices.push(u*size*.105*edge,v*size*.47,size*(.055*Math.sin(v*Math.PI)-.035*u*u*edge));
      }
      for(let row=0;row<10;row++)for(let col=0;col<4;col++){
        const n=row*5+col;indices.push(n,n+1,n+5,n+1,n+6,n+5);
      }
      const leafGeometry=new THREE.BufferGeometry();leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));leafGeometry.setIndex(indices);leafGeometry.computeVertexNormals();
      const leaf=add(p,leafGeometry,material(shades[i%3],{roughness:.88,side:THREE.DoubleSide}),tip.toArray());
      leaf.rotation.set(.55+random()*.6,a,Math.cos(a)*.4);
    }
  };
  plant([-1.65,0,-2.5],1.12);plant([1.65,0,-2.45],.82);plant([-3.48,0.86,-1.66],.27);
  plant([2.38,0.723,-1.39],.22);
  const shelf=group([3.68,0,-2.24],-Math.PI/2);
  for(const x of [-.4,.4])box(shelf,[.045,2.8,.36],[x,1.4,0],darkOak);
  for(let row=0;row<6;row++){
    box(shelf,[.85,.045,.4],[0,.18+row*.48,0],oak);
    for(let i=0;i<5;i++){const b=box(shelf,[.055+.02*random(),.25+.06*random(),.2],[-.28+i*.1,.33+row*.48,0],material(['#a38360','#d1c0a0','#475749','#55504b'][i%4]));b.rotation.z=(random()-.5)*.12;}
  }
  // Wall art is decoration, deliberately not a resume destination.
  const art=group([3.95,1.92,.1],-Math.PI/2);
  box(art,[.76,.96,.04],[0,0,0],darkOak);
  face(art,.69,.89,.025,'#c4b49a');
  const motif=add(art,new THREE.CircleGeometry(.25,40,0,Math.PI),charcoal,[-.08,.13,.028]);motif.rotation.z=Math.PI/2;
  const lower=add(art,new THREE.CircleGeometry(.24,40,0,Math.PI),material('#a55732'),[.07,-.17,.03]);lower.rotation.z=0;
  add(scene,new THREE.SphereGeometry(.115,24,16),material('#d4c8ab'),[-3.15,.125,.05]);
  const hem=new THREE.HemisphereLight('#d2dce1','#6c6256',2.3);scene.add(hem);
  const key=new THREE.SpotLight('#ffe9cf',55,12,Math.PI/3,0.8,2);key.position.set(-2.6,2.9,1.8);key.target.position.set(-.4,.1,-1);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-0.0007;key.shadow.normalBias=.035;scene.add(key,key.target);
  const fill=new THREE.DirectionalLight('#98bed8',1.25);fill.position.set(0,2.8,-2.4);scene.add(fill);

  const positions={ overview:[0,1.65,3.55], work:[-2.68,1.36,-.7], experience:[.12,1.43,1.0], resume:[-1.47,1.48,-.56], contact:[1.37,1.47,-.65] };
  const targets={ overview:[0,1.0,-.85], work:[-2.68,1.34,-2.12], experience:[-.08,.46,.12], resume:[-1.64,.85,-1.66], contact:[2.15,.73,-1.34] };
  const waypoint={ work:[-1.7,1.65,1.75], resume:[-1.7,1.65,1.75], experience:[.1,1.65,1.85], contact:[1.5,1.65,1.75], overview:[0,1.65,2.5] };
  const endPosition=(route)=>{
    const value=vec(...positions[route]);
    if(route==='work') {
      const minDistance=(width<720 ? .75/.74 : Math.max(.75/.78,1.32/(Math.max(.38,width/height)*.88)))/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
      value.z=-2.12+minDistance;
    }
    return value;
  };
  const project=(point)=>{
    const p=point.clone().project(camera);
    return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};
  };
  const landscapeSurface=()=>width>height && height<420;
  const heldPose=(route)=>{
    const o=objects[route];
    const sideways=route!=='work' && landscapeSurface();
    const physicalWidth=sideways?o.h:o.w,physicalHeight=sideways?o.w:o.h;
    const screenHeight=Math.min(height*.82,(width-48)/(physicalWidth/physicalHeight));
    const distance=physicalHeight*height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(80,screenHeight));
    const forward=camera.getWorldDirection(new THREE.Vector3());
    const rotation=camera.quaternion.clone();
    if(sideways)rotation.multiply(new THREE.Quaternion().setFromAxisAngle(vec(0,0,1),Math.PI/2));
    return {position:camera.position.clone().addScaledVector(forward,distance),rotation};
  };
  const projectSurface=()=>{
    if(!inspecting || active==='overview')return;
    const o=objects[active];
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    // Narrow screens inspect the readable center of the actual monitor, closer
    // than its full-width framing. The monitor geometry stays the same.
    const faceWidth=active==='work' && width<720 ? Math.min(o.w,o.h*(width*.88)/(height*.74)) : o.w;
    const corners=[[-faceWidth/2,o.h/2,0],[faceWidth/2,o.h/2,0],[faceWidth/2,-o.h/2,0],[-faceWidth/2,-o.h/2,0]].map(p=>project(o.face.localToWorld(vec(...p))));
    const sideways=active!=='work' && landscapeSurface();
    if(sideways)corners.push(corners.shift());
    const projectedWidth=Math.hypot(corners[1].x-corners[0].x,corners[1].y-corners[0].y);
    // Lay held paper out near its projected width so text keeps its CSS size.
    const cssWidth=active==='contact'?(sideways?Math.min(560,height*.82*2):Math.min(360,projectedWidth)):Math.min(active==='resume'?560:active==='experience'?Math.max(320,projectedWidth):880,width-48,height<420?projectedWidth:Infinity);
    const cssHeight=sideways?cssWidth*o.w/o.h:cssWidth*o.h/faceWidth;
    surface.style.width=`${cssWidth}px`;surface.style.height=`${cssHeight}px`;
    const [p0,p1,p2,p3]=corners;
    const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x;
    const dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
    const determinant=dx1*dy2-dx2*dy1;
    if(Math.abs(determinant)<.01)return;
    const g=(dx3*dy2-dx2*dy3)/determinant;
    const h=(dx1*dy3-dx3*dy1)/determinant;
    const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x;
    const d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y;
    surface.style.transform=`matrix3d(${a/cssWidth},${d/cssWidth},0,${g/cssWidth},${b/cssHeight},${e/cssHeight},0,${h/cssHeight},0,0,1,0,${p0.x},${p0.y},0,1)`;
    surface.dataset.orientation=sideways?'landscape':'portrait';
    surface.dataset.surface=active==='contact'?'phone':active==='resume'?'folio':active==='experience'?'notebook':'monitor';
  };
  function render(){
    if(disposed)return;
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    renderer.render(scene,camera);
    renderer.domElement.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(3)).join(',');
    renderer.domElement.dataset.cameraRotation=camera.quaternion.toArray().map(n=>n.toFixed(3)).join(',');
    renderer.domElement.dataset.fov=String(camera.fov);
    renderer.domElement.dataset.objectPositions=JSON.stringify(Object.fromEntries(Object.entries(objects).map(([key,o])=>[key,o.root.position.toArray().map(n=>Number(n.toFixed(4)))])));
    projectSurface();
    for(const point of points){
      const o=objects[point.dataset.studioRoute];
      const p=project(o.face.getWorldPosition(new THREE.Vector3()));
      point.style.left=`${p.x}px`;point.style.top=`${p.y}px`;
      const inView=active==='overview' && !tween && p.z<1 && p.z>-1 && p.x>28 && p.x<width-28 && p.y>28 && p.y<height-115;
      point.dataset.inView=String(inView);point.tabIndex=inView?0:-1;
      const label=point.querySelector('.studio-label').getBoundingClientRect();const bounds=host.getBoundingClientRect();
      point.dataset.labelVisible=String(inView && label.left>=bounds.left+4 && label.right<=bounds.right-4 && label.bottom<=bounds.bottom-4);
    }
  }
  function stop(){
    cancelAnimationFrame(frame);frame=0;
    if(tween){const previous=tween;tween=null;previous.resolve(false);}
  }
  const animate=(duration,update)=>new Promise(resolve=>{
    stop();
    if(!motion || duration===0){update(1);render();resolve(true);return;}
    tween={start:performance.now(),duration,update,resolve};
    const step=(now)=>{
      if(!tween)return;
      const current=tween;
      const t=THREE.MathUtils.clamp((now-current.start)/current.duration,0,1);
      current.update(smooth(t));render();
      if(t<1)frame=requestAnimationFrame(step);
      else {tween=null;frame=0;current.resolve(true);render();}
    };
    frame=requestAnimationFrame(step);
  });
  const putDown=async(immediate)=>{
    if(!held)return true;
    const route=held;inspecting=false;
    const o=objects[route];const position=o.root.position.clone(),rotation=o.root.quaternion.clone();
    const result=await animate(immediate?0:430,t=>{o.root.position.lerpVectors(position,o.home,t);o.root.quaternion.slerpQuaternions(rotation,o.rotation,t);});
    if(result && held===route)held=null;
    return result;
  };
  const travel=async(route,{immediate=false}={})=>{
    const id=++sequence;stop();
    if(!await putDown(immediate) || id!==sequence)return false;
    active=route;inspecting=false;yaw=0;
    const start=camera.position.clone();const finish=endPosition(route);
    const points=[start];
    if(start.distanceTo(finish)>1.25){
      if(start.z<1.4){
        const aisle=start.x<-.8?-1.7:start.x>.8?1.5:.1;
        if(start.x< -2)points.push(vec(aisle,1.65,start.z));
        points.push(vec(aisle,1.65,1.75));
      }
      if(route!=='overview' || start.z<3.55)points.push(vec(...waypoint[route]));
    }
    if(route==='work' && start.distanceTo(finish)>1.25)points.push(vec(-1.7,1.48,finish.z));
    points.push(finish);
    const filtered=points.filter((p,i)=>i===0 || p.distanceTo(points[i-1])>.03);
    const curve=filtered.length>1?new THREE.CatmullRomCurve3(filtered,false,'centripetal'):null;
    const rotation=camera.quaternion.clone();
    const dummy=new THREE.PerspectiveCamera();dummy.position.copy(finish);dummy.lookAt(vec(...targets[route]));
    // A walker faces their path with a level gaze, then turns toward the object on
    // arrival. Short repositioning keeps a single direct turn.
    const walking=curve && curve.getLength()>1.5;
    const gaze=new THREE.PerspectiveCamera(),ahead=new THREE.Vector3(),heading=rotation.clone();
    const result=await animate(immediate?0:Math.min(2600,1250+(curve?.getLength()||0)*220),t=>{
      camera.position.copy(curve?curve.getPointAt(t):finish);
      if(!walking){camera.quaternion.slerpQuaternions(rotation,dummy.quaternion,t);}
      else {
        curve.getPointAt(Math.min(1,t+.15),ahead);ahead.y=camera.position.y-.12;
        gaze.position.copy(camera.position);
        if(ahead.distanceToSquared(gaze.position)>.0004){gaze.lookAt(ahead);heading.copy(gaze.quaternion);}
        camera.quaternion.slerpQuaternions(rotation,heading,THREE.MathUtils.smoothstep(t,0,.22));
        camera.quaternion.slerp(dummy.quaternion,THREE.MathUtils.smoothstep(t,.55,1));
      }
      if(motion && curve && t>0 && t<1)camera.position.y+=Math.sin(t*Math.PI*8)*.012*Math.sin(t*Math.PI);
    });
    return result && id===sequence;
  };
  const inspect=async(route,{immediate=false}={})=>{
    active=route;inspecting=true;
    if(route==='work'){
      const start=camera.quaternion.clone(),target=new THREE.PerspectiveCamera();
      target.position.copy(camera.position);target.lookAt(vec(...targets.work));
      return animate(immediate?0:400,t=>camera.quaternion.slerpQuaternions(start,target.quaternion,t));
    }
    const o=objects[route];const start=o.root.position.clone(),rotation=o.root.quaternion.clone();
    held=route;
    return animate(immediate?0:760,t=>{
      const pose=heldPose(route);
      o.root.position.lerpVectors(start,pose.position,t);
      o.root.quaternion.slerpQuaternions(rotation,pose.rotation,t);
    });
  };
  const resize=()=>{
    width=Math.max(1,host.clientWidth);height=Math.max(1,host.clientHeight);
    renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
    if(!tween && active==='work'){camera.position.copy(endPosition(active));camera.lookAt(vec(...targets[active]));}
    if(held && !tween){const pose=heldPose(held);objects[held].root.position.copy(pose.position);objects[held].root.quaternion.copy(pose.rotation);}
    render();
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  host.addEventListener('pointerdown',event=>{
    if(inspecting || tween || event.target.closest('a,button'))return;
    drag={x:event.clientX,yaw,rotation:camera.quaternion.clone()};host.setPointerCapture(event.pointerId);
  },{signal:events.signal});
  host.addEventListener('pointermove',event=>{
    if(!drag || inspecting || tween)return;
    yaw=THREE.MathUtils.clamp(drag.yaw+(event.clientX-drag.x)/width*.9,-.65,.65);
    camera.quaternion.copy(drag.rotation).premultiply(new THREE.Quaternion().setFromAxisAngle(vec(0,1,0),-(yaw-drag.yaw)));render();
  },{signal:events.signal});
  host.addEventListener('pointerup',()=>{drag=null;},{signal:events.signal});host.addEventListener('pointercancel',()=>{drag=null;},{signal:events.signal});
  return {
    travel,inspect,putDown,
    setMotion(value){motion=value;if(!motion && tween){const current=tween;cancelAnimationFrame(frame);tween=null;frame=0;current.update(1);render();current.resolve(true);}},
    look(){inspecting=false;return putDown(false);},
    dispose(){disposed=true;++sequence;stop();events.abort();observer.disconnect();resources.forEach(resource=>resource.dispose());renderer.dispose();renderer.domElement.remove();},
  };
}
