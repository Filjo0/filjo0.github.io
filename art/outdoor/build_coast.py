"""Original coastal entry scene, PBR export and matched-camera preview.
Run Blender 5.2 -b --factory-startup --python art/outdoor/build_coast.py -- assets/outdoor [--preview] [--gpu].
CC0 inputs and hashes: assets.json. Cache is local and ignored; no private app data is consumed.
"""
import sys, math, random, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector, Matrix
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import geometry as g
from export_scene import export_web
from sky import export_panorama
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUT = Path(ARGS[0] if ARGS else 'assets/outdoor').resolve()
OUT.mkdir(parents=True, exist_ok=True)
random.seed(710)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
if '--gpu' in ARGS:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    devices = prefs.get_devices_for_type('CUDA')
    for d in devices: d.use = d.type == 'CUDA'
    if any(d.type == 'CUDA' for d in devices): scene.cycles.device = 'GPU'
scene.view_settings.view_transform = 'AgX'
def point(x,y,z): return Vector((x,-z,y))
def cube(name, xyz, dims, mat, bevel=.012):
    c=point(*xyz); d=Vector((dims[0],dims[2],dims[1]))
    o=g.box(name,c-d/2,c+d/2,mat,bevel=bevel)
    return o
def sphere(name, xyz, dims, mat, detail=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=detail, radius=1, location=point(*xyz))
    o=bpy.context.object;o.name=name;o.scale=(dims[0],dims[2],dims[1]);o.data.materials.append(mat)
    g.shade_smooth(o,math.pi);return o
def path(name, coordinates, radius, mat):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=8
    data.bevel_depth=radius;data.bevel_resolution=2
    spline=data.splines.new('POLY');spline.points.add(len(coordinates)-1)
    for p,xyz in zip(spline.points,coordinates):p.co=(*point(*xyz),1)
    o=g.link(bpy.data.objects.new(name,data));o.data.materials.append(mat)
    g.select_only(o);bpy.ops.object.convert(target='MESH');return bpy.context.object
def uv_world(o):
    if o.type!='MESH' or o.data.uv_layers: return
    uv=o.data.uv_layers.new(name='UVMap')
    for poly in o.data.polygons:
        normal=poly.normal;axis=max(range(3),key=lambda a:abs(normal[a]))
        for i in poly.loop_indices:
            v=o.matrix_world @ o.data.vertices[o.data.loops[i].vertex_index].co
            uv.data[i].uv=(v[0],v[1]) if axis==2 else (v[0],v[2]) if axis==1 else (v[1],v[2])
def material(name, hex, rough=.7, metal=0):
    return g.principled(name,g.srgb(hex),roughness=rough,metallic=metal)
oak=g.pbr('coast_oak','oak_veneer_01',scale=.65,mapping='UV')
walnut=g.pbr('coast_walnut','walnut_veneer',scale=.45,mapping='UV')
plaster=g.pbr('coast_plaster','grey_plaster_02',scale=.35,mapping='UV',normal=.15)
plaster_bsdf=plaster.node_tree.nodes.get('Principled BSDF')
for link in list(plaster_bsdf.inputs['Base Color'].links):plaster.node_tree.links.remove(link)
plaster_bsdf.inputs['Base Color'].default_value=(*g.srgb('#d0c5af'),1)
cloth=g.pbr('coast_linen','rough_linen',scale=.3,mapping='UV')
rockmat=g.pbr('coast_rock','rock_face_03',scale=2.2,mapping='UV')
sand=g.pbr('dune_sand','coast_sand_01',scale=3,mapping='UV')
earth=g.pbr('coastal_ground','coast_sand_01',scale=.55,mapping='UV',normal=.25)
steel=material('graphite_steel','#242b2c',.35,.65)
copper=material('copper','#bd794e',.24,.85)
paper=material('ivory_paper','#e9e2cd',.86)
leaf_mats=[material('foliage_'+str(i),c,.75) for i,c in enumerate(['#626a39','#737244','#858250','#4a5a37'])]
grass_mats=[material('dune_grass_'+str(i),c,.87) for i,c in enumerate(['#8e8258','#968760','#70764d','#a49768'])]
warm=g.emissive('lamp_glow',g.srgb('#ffe0a0'),4)
# Land is sculpted gently at its edge; all live activity footprints remain level.
verts=[];faces=[];nx,nz=66,72
for j in range(nz+1):
    z=-25+j*.75
    for i in range(nx+1):
        x=-31+i
        edge=max(0,(x-17)/13)
        hill=0
        h=-.028-min(.7,edge*.14)+hill
        verts.append(point(x,h,z))
for j in range(nz):
    for i in range(nx):
        a=j*(nx+1)+i;faces.append((a,a+nx+1,a+nx+2,a+1))
data=bpy.data.meshes.new('coast_terrain');data.from_pydata(verts,[],faces);data.update()
terrain=g.link(bpy.data.objects.new('coast_terrain',data));terrain.data.materials.append(earth);g.shade_smooth(terrain)
# A believable wide coastal sand strip.
cube('coast_sand',(18,-.055,-7),(14,.035,71),sand,0)
# Timber boardwalk, with individual rounded planks, variation and physical seams.
for i in range(118):
    z=22-i*.29
    x=-2.3-1.0*math.exp(-((z-3)/6)**2)+.6*math.sin(z*.075)
    plank=cube('boardwalk_plank',(x,.015,z),(3.25,.09,.272),oak,.012)
    plank.rotation_euler.z=.025*math.cos(z*.075)
# Pavilion: thick beams, bevels, underside rafters and weathered floorboards.
for x in [-9.7,-4.7]:
    for z in [-3.2,4.0]:
        # The corner is cantilevered so the entry sightline stays clear.
        if x>-5 and z>0:continue
        cube('pavilion_post',(x,1.48,z),(.19,2.96,.19),oak,.018)
cube('pavilion_roof',(-7.2,3.02,.45),(5.55,.18,8.2),walnut,.025)
for x in [-9.25,-8.25,-7.25,-6.25,-5.25]:
    cube('pavilion_rafter',(x,2.85,.45),(.13,.18,7.95),oak,.01)
cube('pavilion_back_wall',(-7.2,1.45,-3.28),(5.1,2.9,.13),plaster,.02)
for i in range(33):
    cube('pavilion_floorboard',(-9.7+i*.155,.01,.45),(.145,.12,7.55),oak,.007)
# Workbench has edge grain, joinery and legs; live objects go on its clear top.
cube('workbench_top',(-7.25,1,-.92),(4.25,.075,1.28),oak,.016)
for x in [-9.1,-5.4]:
    for z in [-1.35,-.5]:cube('workbench_leg',(x,.49,z),(.095,.96,.095),oak,.009)
cube('workbench_stretcher',(-7.25,.24,-1.3),(3.8,.09,.09),oak,.008)
# A truly modelled fabric chair; source licence/provenance recorded separately.
chair,chair_meshes=g.import_model('modern_arm_chair_01')
g.place(chair,chair_meshes,point(-6.8,.075,1.5),rotation_z=.14,width=.75)
# Personal bench, including a shelter-facing back.
for i in range(6):cube('reading_bench_slat',(-5,.63,2.95+i*.17),(2.8,.075,.155),oak,.012)
for x in [-6.15,-3.85]:cube('reading_bench_leg',(x,.32,3.12),(.075,.6,.43),steel,.007)
for h in [.83,1.01]:cube('reading_bench_back',(-5,h,2.72),(2.8,.12,.075),oak,.012)
# Modelled upholstery with real seams and folds.
sofa,sofa_parts=g.import_model('sofa_03')
g.place(sofa,sofa_parts,point(-7.9,.06,-2.35),rotation_z=0,width=2.85)
# Pendant, cable and nested shade profile.
g.lathe('pendant_shade',[(.025,.24),(.11,.19),(.18,.1),(.25,0),(.25,-.018),(.21,-.02)],
        point(-8.5,2.25,-.9),copper,72)
path('pendant_cable',[(-8.5,2.5,-.9),(-8.5,2.94,-.9)],.006,steel)
sphere('pendant_bulb',(-8.5,2.23,-.9),(.046,.065,.046),warm,2)
lamp=bpy.data.lights.new('pendant_light','AREA');lamp.energy=24;lamp.color=(1,.65,.32);lamp.shape='DISK';lamp.size=.45
obj=g.link(bpy.data.objects.new('pendant_light',lamp));obj.location=point(-8.5,2.18,-.9)
# Lush detailed CC0 potted plants rather than flat green silhouettes.
for asset,location,height in [('potted_plant_04',(-9,1.04,-.92),.4),
                              ('potted_plant_04',(-9.1,.075,-2.5),1.8)]:
    root,meshes=g.import_model(asset);g.place(root,meshes,point(*location),height=height)
    if height<1:root.name='coast_table_plant'
# Books, an open unlettered sketchbook and a ceramic mug.
for i in range(3):
    o=cube('book_on_desk',(-8.7,1.08+i*.05,-.52),(.3,.045,.22),[walnut,paper,steel][i],.008)
    o.rotation_euler.z=.1-i*.055
cube('open_sketchbook',(-7.8,1.044,-.48),(.37,.012,.25),paper,.003)
path('fibonacci_sketch',[
    (-7.8+.095*math.exp(-t*.18)*math.cos(t),1.052,-.48+.095*math.exp(-t*.18)*math.sin(t))
    for t in [i*.1 for i in range(110)]],.0015,steel)
g.lathe('ceramic_mug',[(0,0),(.045,0),(.05,.02),(.05,.1),(.045,.11),(.037,.11),(.038,.02),(0,.02)],
        point(-5.8,1.04,-1.1),material('glazed_clay','#8c7858',.25),48)
path('mug_handle',[(-5.75,1.07,-1.1),(-5.71,1.08,-1.1),(-5.71,1.12,-1.1),(-5.75,1.135,-1.1)],.009,copper)
# Coaching reference: blank training clipboard, marker, whistle, four small cones.
cube('coaching_clipboard',(-4.65,.69,3.1),(.22,.02,.3),walnut,.009)
cube('coaching_paper',(-4.65,.707,3.1),(.2,.003,.26),paper,.002)
for x in [-4.725,-4.575]:path('tactics_pitch_line',[(x,.71,2.99),(x,.71,3.21)],.0009,steel)
for z in [2.99,3.1,3.21]:path('tactics_pitch_line',[(-4.725,.71,z),(-4.575,.71,z)],.0009,steel)
for i in range(4):
    g.cylinder('training_cone',(-4.25+i*.11,-3.1),.047,.67,.76,
               material('cone_orange_'+str(i),'#b96935',.7),vertices=20,radius_top=.012)
# Tennis Easter egg: racket, string bed and one felt-like ball. No invented matches.
racket_path=[(-6.1+.145*math.cos(t),.76,3.45+.19*math.sin(t)) for t in [i*math.tau/48 for i in range(49)]]
path('tennis_racket_head',racket_path,.007,steel)
path('tennis_racket_handle',[(-6.1,.76,3.64),(-6.1,.76,3.86)],.013,steel)
for i in range(-4,5):
    x=-6.1+i*.027
    span=.19*math.sqrt(max(0,1-((x+6.1)/.145)**2))
    path('racket_strings',[(x,.76,3.45-span),(x,.76,3.45+span)],.0008,paper)
sphere('tennis_ball',(-6.42,.72,3.3),(.033,.033,.033),material('tennis_felt','#b3bb58',.95),3)
# Receipt-tracker Easter egg is an anonymous blank strip, not financial data.
cube('receipt_strip',(-5.75,1.042,-.56),(.057,.002,.16),paper,.001)
for i in range(7):cube('receipt_abstract_line',(-5.75,1.044,-.61+i*.014),(.039,.001,.001),steel,0)
# Delicate globe: detailed small house, pine, glass shell and wooden base.
globe=point(-6.15,1.05,-.55)
g.lathe('snowglobe_base',[(0,0),(.078,0),(.078,.018),(.07,.025),(.065,.03),(0,.03)],globe,walnut,64)
cube('globe_house',(-6.15,1.097,-.55),(.035,.04,.032),oak,.002)
roof=cube('globe_house_roof',(-6.15,1.12,-.55),(.047,.008,.04),paper,.002)
roof.rotation_euler.y=.38
glass=g.principled('snowglobe_glass',(.9,.96,1),roughness=.045,Transmission_Weight=1.0,IOR=1.46)
sphere('snowglobe_shell',(-6.15,1.145,-.55),(.075,.075,.075),glass,4)
for i in range(28):
    a=random.random()*math.tau;r=random.uniform(.02,.063)
    sphere('globe_snow',(-6.15+math.cos(a)*r,1.105+random.random()*.08,-.55+math.sin(a)*r),
           (.001,.001,.001),paper,1)
# Place the working objects within reach in the approved foreground composition.
foreground_prefixes=('workbench_','book_on_desk','open_sketch','fibonacci_','ceramic_mug','mug','snowglobe_','globe_','receipt_')
for obj in list(scene.objects):
    if obj.name.startswith(foreground_prefixes):obj.location.y-=4.3
    if obj.name.startswith(('snowglobe_','globe_')):obj.location.x+=.85
    if obj.name.startswith(('open_sketch','fibonacci_')):obj.location.x+=2.25
    if obj.name.startswith('book_on_desk'):obj.location.x+=2.0
    if obj.name.startswith('coast_table_plant') and obj.type=='EMPTY':
        obj.location.x+=3;obj.location.y-=4.3
# A slim, normal-sized laptop, with modelled keys and hinge.
cube('laptop_base',(-5.8,1.055,3.0),(.34,.014,.24),steel,.006)
for row in range(5):
    for column in range(12):
        cube('laptop_key',(-5.947+column*.026,1.065,2.935+row*.024),(.022,.003,.019),steel,.002)
cube('laptop_trackpad',(-5.8,1.063,3.09),(.10,.002,.06),material('trackpad','#323638',.45),.005)
screen=cube('laptop_display',(-5.8,1.178,2.885),(.34,.225,.011),steel,.006)
screen.rotation_euler.x=math.radians(13)
panel=cube('laptop_glass',(-5.8,1.179,2.893),(.318,.197,.0018),
           material('laptop_dark_glass','#16302c',.16,.12),.002)
panel.rotation_euler.x=math.radians(13)
# Simple graphite phone beside the souvenir; runtime owns its live screen.
cube('contact_phone',(-5.3,1.05,3.45),(.073,.008,.147),steel,.01)
cube('contact_phone_glass',(-5.3,1.055,3.45),(.066,.001,.137),
     material('phone_glass','#172a27',.14,.15),.004)
# Real scanned vegetation; source models are decimated once and shared by all copies.
instance_buckets={}
def prototype(asset, target_width=None, target_height=None, budget=15000):
    root, parts=g.import_model(asset)
    separated=[]
    for obj in parts:
        if len(obj.data.materials)>1:
            g.select_only(obj)
            before=set(bpy.data.objects)
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.separate(type='MATERIAL')
            bpy.ops.object.mode_set(mode='OBJECT')
            separated.append(obj)
            separated.extend(o for o in set(bpy.data.objects)-before if o.type=='MESH')
        else:separated.append(obj)
    for obj in separated:
        mats=[m for m in obj.data.materials if m]
        foliage=any('leaf' in m.name.lower() or 'leaves' in m.name.lower() or
                    bool(m.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].links)
                    for m in mats if m.use_nodes and m.node_tree.nodes.get('Principled BSDF'))
        limit=(30000 if asset=='island_tree_01' else 22000) if foliage else budget
        if len(obj.data.polygons)>limit:
            mod=obj.modifiers.new('web_geometry_budget','DECIMATE')
            mod.ratio=min(1,limit/len(obj.data.polygons))
            g.apply_modifiers(obj)
        # Masked leaves retain depth/shadows with fewer transparent passes.
        if foliage:
            for material in mats:
                material.surface_render_method='DITHERED'
                bsdf=material.node_tree.nodes.get('Principled BSDF')
                alpha=bsdf.inputs['Alpha']
                if alpha.links:
                    source=alpha.links[0].from_socket
                    cut=material.node_tree.nodes.new('ShaderNodeMath');cut.operation='GREATER_THAN'
                    cut.inputs[1].default_value=.4
                    material.node_tree.links.new(source,cut.inputs[0])
                    material.node_tree.links.new(cut.outputs[0],alpha)
                material.use_backface_culling=False
    g.place(root,separated,Vector((0,0,0)),width=target_width,height=target_height)
    return root,separated

def instance(proto, name, xyz, scale=1, yaw=0):
    root,parts=proto
    transform=Matrix.Translation(point(*xyz)) @ Matrix.Rotation(yaw,4,'Z') @ Matrix.Scale(scale,4)
    result=[]
    for original in parts:
        key=original.data.name
        if key not in instance_buckets:
            instance_buckets[key]=g.link(bpy.data.objects.new('instances_'+key,None))
        obj=g.link(bpy.data.objects.new(name,original.data))
        obj.parent=instance_buckets[key]
        obj.matrix_world=transform @ original.matrix_world
        result.append(obj)
    return result

shrub=prototype('shrub_03',target_width=1.4,budget=6500)
sorrel=prototype('shrub_sorrel_01',target_width=.9,budget=4000)
fern=prototype('fern_02',target_height=.85,budget=4000)
tuft=prototype('grass_bermuda_01',target_height=.65,budget=2500)
tree=prototype('island_tree_01',target_height=6.5,budget=18000)
rocks=prototype('coast_rocks_02',target_width=3.8,budget=9000)
# Deliberately planted margins, leaving the path and all activity footprints clear.
beds=[(1,2),(3,0),(9,-2),(10,-5),(13,-6),(-11,4),(-10,1),(-10,-4),(-3,4),(2.8,7),(4.5,9),(8,7),(12,4),
      (-3,-4),(12,-10),(13,-16),(-9,-23),(-17,-25)]
for bx,bz in beds:
    for j in range(12):
        x=bx+random.uniform(-1.9,1.9);z=bz+random.uniform(-1.7,1.7)
        # Never occlude the centre walk or playable court/pool.
        if abs(x+2.5)<2 or (-24<x<-9 and -21<z<2) or (1<x<9 and -19<z<-3):continue
        if -10<x<-4.4 and -3.5<z<4.5:continue
        instance([shrub,sorrel,fern,tuft][j%4],'planted_margin',(x,.015,z),
                 random.uniform(.65,1.35),random.random()*math.tau)
for x,z,height in [(-10,1,1),(-11,8,.95)]:
    instance(tree,'coastal_tree',(x,0,z),height,random.random()*math.tau)
# Small sculpted foreground rocks retain depth; far geology belongs to the panorama.
for i in range(9):
    x=random.uniform(13,20);z=random.uniform(-23,17);size=random.uniform(.25,.65)
    instance(rocks,'coastal_rock',(x,-.04,z),size,random.random()*math.tau)
# Remove originals, keeping linked mesh datablocks alive in their copies.
for root,parts in (shrub,sorrel,fern,tuft,tree,rocks):
    for obj in parts:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.objects.remove(root,do_unlink=True)
# Railings follow the shoreline with real timber posts and rope.
for z in range(-19,19,2):
    cube('shore_post',(15.5,.55,z),(.09,1.1,.09),oak,.015)
path('shore_rope',[(15.5,.67,z) for z in range(-19,19)],.014,material('rope','#a49474',.94))
# Lighting and sky for a matched-camera Cycles preview; runtime owns live light/water/props.
world=bpy.data.worlds.new('coastal_dusk');scene.world=world
environment=world.node_tree.nodes.new('ShaderNodeTexEnvironment')
environment.image=bpy.data.images.load(str(Path('assets/outdoor/coast-landscape.webp').resolve()))
mapping=world.node_tree.nodes.new('ShaderNodeMapping');mapping.inputs['Rotation'].default_value[2]=math.pi
coordinates=world.node_tree.nodes.new('ShaderNodeTexCoord')
world.node_tree.links.new(coordinates.outputs['Generated'],mapping.inputs['Vector'])
world.node_tree.links.new(mapping.outputs['Vector'],environment.inputs['Vector'])
world.node_tree.links.new(environment.outputs['Color'],world.node_tree.nodes.get('Background').inputs['Color'])
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.65
sun_data=bpy.data.lights.new('coastal_sun','SUN');sun_data.energy=1.6;sun_data.angle=.15;sun_data.color=(1,.88,.73)
sun_obj=g.link(bpy.data.objects.new('coastal_sun',sun_data));sun_obj.rotation_euler=(1.25,-.85,-1.1)
# Preview water is replaced by the live shader in the browser export.
water=g.principled('author_water',(.035,.16,.19),roughness=.16,metallic=.1,Transmission_Weight=.3)
water_nodes=water.node_tree.nodes;water_links=water.node_tree.links
noise=water_nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1.8
coord=water_nodes.new('ShaderNodeTexCoord');mapnode=water_nodes.new('ShaderNodeMapping')
mapnode.inputs['Scale'].default_value=(.5,5,1)
bump=water_nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.3;bump.inputs['Distance'].default_value=.12
water_links.new(coord.outputs['Object'],mapnode.inputs['Vector']);water_links.new(mapnode.outputs['Vector'],noise.inputs['Vector'])
water_links.new(noise.outputs['Fac'],bump.inputs['Height']);water_links.new(bump.outputs['Normal'],water_nodes.get('Principled BSDF').inputs['Normal'])
ocean=cube('author_ocean',(60,-.12,-12),(75,.05,180),water,0)
for o in list(scene.objects):
    if o.type=='MESH':uv_world(o)
# Repeated joinery uses shared geometry; preserve each object's world transform.
templates={};buckets={}
for obj in list(scene.objects):
    if obj.type!='MESH' or not obj.name.startswith(('boardwalk_plank','pavilion_floorboard','pavilion_post','shore_post')):
        continue
    key=(obj.name.split('.')[0],tuple(round(v,5) for p in obj.data.vertices for v in p.co))
    if key not in templates:
        templates[key]=obj.data
        buckets[key]=g.link(bpy.data.objects.new('joinery_instances_'+obj.name,None))
    matrix=obj.matrix_world.copy()
    obj.data=templates[key];obj.parent=buckets[key];obj.matrix_world=matrix
# Resize only source texture resolution for the web export; original cached files stay unchanged.
for image in bpy.data.images:
    if image.size[0]>1024 or image.size[1]>1024:
        image.scale(min(1024,image.size[0]),min(1024,image.size[1]));image.pack()
camera_data=bpy.data.cameras.new('coastal_reference_camera')
camera=g.link(bpy.data.objects.new('coastal_reference_camera',camera_data))
camera.location=point(-4.1,2.8,6.8)
look=point(-1.5,1.1,-8.5)
camera.rotation_euler=(look-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.lens=21;scene.camera=camera
scene.view_settings.exposure=.5
scene.render.resolution_x=1440;scene.render.resolution_y=810;scene.render.resolution_percentage=100
person_file=Path('validation-artifacts/coastal-rebuild/character/person.glb').resolve()
if person_file.exists():
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(person_file))
    parts=list(set(bpy.data.objects)-before)
    hero=g.link(bpy.data.objects.new('author_person',None));hero.location=point(-2.0,0,-4)
    hero.rotation_euler.z=math.pi
    for obj in parts:
        obj.name='author_person_'+obj.name
        if obj.parent is None:obj.parent=hero
        if 'male_casualsuit05' in obj.name:obj.hide_render=True
        if obj.type=='ARMATURE':
            obj.animation_data_clear()
            for side,label in [(-1,'r'),(1,'l')]:
                bone=obj.pose.bones.get('arm_'+label)
                if bone:
                    pivot=bone.bone.head_local
                    bone.matrix=Matrix.Translation(pivot) @ Matrix.Rotation(side*.65,4,'Y') @ Matrix.Translation(-pivot) @ bone.bone.matrix_local
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'coast-source.blend'))
export_web(scene, OUT/'coast.glb')
if '--preview' in ARGS:
    scene.render.filepath=str(OUT/'coast-author-preview.png');bpy.ops.render.render(write_still=True)
stats={'objects':len([o for o in scene.objects if o.type=='MESH']),
       'source_polygons':sum(len(o.data.polygons) for o in scene.objects if o.type=='MESH'),
       'glb_bytes':(OUT/'coast.glb').stat().st_size}
(OUT/'author-report.json').write_text(json.dumps(stats,indent=2)+'\n')
export_panorama(scene,OUT/'sky.jpg')
print('COAST_EXPORT',json.dumps(stats),flush=True)
