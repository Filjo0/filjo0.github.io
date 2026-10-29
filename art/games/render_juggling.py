"""Render CC0 Quaternius rig as warm-lit sprites. Blender 5.2:
blender -b --python art/games/render_juggling.py -- --gpu [--preview]
Then: python art/games/pack_juggling.py
Downloaded model and intermediate PNGs stay in .cache; no runtime 3D dependency.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'.cache'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(CACHE/'AnimationLibrary_Godot_Standard.glb'))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
body=next(o for o in scene.objects if o.type=='MESH')
rig.animation_data_clear()
body.hide_render=True
existing=set(scene.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT.parents[1]/'assets/outdoor/person.glb'))
human=next(o for o in scene.objects if o not in existing and o.type=='ARMATURE')
human.animation_data_clear()
bone_names={'hips':'DEF-hips','spine':'DEF-spine.001','head':'DEF-head'}
for side in ['l','r']:
    for part,target in [('arm','upper_arm'),('forearm','forearm'),('hand','hand'),
                        ('leg','thigh'),('shin','shin'),('foot','foot')]:
        bone_names[part+'_'+side]='DEF-'+target+'.'+side.upper()
# Retarget the CC0 animation skeleton to the existing CC0 human's rest proportions.
# Only weighted body bones are needed by these three original authored clips.
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for bone in list(rig.data.edit_bones):
    if bone.name not in bone_names.values():rig.data.edit_bones.remove(bone)
transform=rig.matrix_world.inverted()@human.matrix_world
for old,new in bone_names.items():
    source=human.data.bones[old];bone=rig.data.edit_bones[new]
    bone.use_connect=False;bone.matrix=transform@source.matrix_local;bone.length=source.length
for old,new in bone_names.items():
    source=human.data.bones[old]
    rig.data.edit_bones[new].parent=rig.data.edit_bones[bone_names[source.parent.name]] if source.parent else None
bpy.ops.object.mode_set(mode='OBJECT')
for obj in [o for o in scene.objects if o not in existing and o.type=='MESH']:
    bpy.context.view_layer.update();world=obj.matrix_world.copy();obj.parent=rig;obj.matrix_world=world
    for modifier in obj.modifiers:
        if modifier.type=='ARMATURE':modifier.object=rig
    for group in obj.vertex_groups:
        if group.name in bone_names:group.name=bone_names[group.name]
    if obj.get('wardrobe')=='winter':obj.hide_render=True
bpy.data.objects.remove(human,do_unlink=True)
sys.path.insert(0,str(ROOT))
from futsal_kit import dress_player
dress_player(rig,bone_names)
# Anchor to visible footwear, not the rig's longer forward-pointing toe bones.
shoe=next(o for o in scene.objects if o.type=='MESH' and o.name.startswith('shoes01') and not o.hide_render)
rest={v.index:shoe.matrix_world@v.co for v in shoe.data.vertices}
right=[i for i,v in rest.items() if v.x<0];left=[i for i,v in rest.items() if v.x>0]
front=min(rest[i].y for i in right)
toe_index=max([i for i in right if rest[i].y<front+.018],key=lambda i:rest[i].z)
low=min(rest[i].z for i in left)
plant_index=min([i for i in left if rest[i].z<low+.003],key=lambda i:rest[i].y)
def shoe_point(index):
    evaluated=shoe.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return evaluated.matrix_world@evaluated.data.vertices[index].co
for bone in rig.pose.bones:bone.rotation_mode='QUATERNION'
def material(name,color,rough=.65):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough
    return m
def light(name,pos,power,color,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos
    o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
# Back-left sun in camera space; the cast shadow travels toward camera-right.
sun_data=bpy.data.lights.new('Low coastal sunset','SUN');sun_data.energy=2.5
sun_data.color=(1,.49,.20);sun_data.angle=math.radians(9)
sun=bpy.data.objects.new('Low coastal sunset',sun_data);scene.collection.objects.link(sun)
sun.location=(-5,1.5,3.3);sun.rotation_euler=(Vector((0,0,0))-sun.location).to_track_quat('-Z','Y').to_euler()
light('Cool open sky',(1,-3,4),75,(.56,.71,1),5)
light('Court warm bounce',(-2,-3,.8),22,(1,.68,.40),4)
scene.world=bpy.data.worlds.new('Dusk fill');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.21,.26,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.22
bpy.ops.object.camera_add(location=(3.8,-7,1.65))
camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=2.5
camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.film_transparent=True;scene.render.resolution_x=480;scene.render.resolution_y=720
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA';scene.view_settings.view_transform='AgX'
if '--gpu' in sys.argv:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    for backend in ['OPTIX','CUDA','HIP']:
        try:
            prefs.compute_device_type=backend;prefs.get_devices()
            gpu=[d for d in prefs.devices if d.type!='CPU']
            if gpu:
                for d in prefs.devices:d.use=d.type==backend
                scene.cycles.device='GPU';print('GPU',[(d.name,d.type) for d in gpu],flush=True);break
        except (TypeError,RuntimeError):pass
def rotate(name,angles):
    b=rig.pose.bones[name];b.rotation_quaternion=Quaternion()
    b.rotation_quaternion.rotate(__import__('mathutils').Euler(angles,'XYZ'))
def pose(kind,t):
    for b in rig.pose.bones:
        b.rotation_quaternion=Quaternion();b.location=(0,0,0)
    # Lower the source's T-pose arms and soften knees into an athletic stance.
    rotate('DEF-upper_arm.L',(0,0,.12))
    rotate('DEF-upper_arm.R',(0,0,-.12))
    rotate('DEF-forearm.L',(-.2,0,0));rotate('DEF-forearm.R',(-.2,0,0))
    if kind=='idle':
        rotate('DEF-spine.001',(.025*math.sin(t*2*math.pi),0,0))
    elif kind=='kick':
        lift=t
        rotate('DEF-thigh.R',(-1.45*lift,0,0))
        rotate('DEF-shin.R',(.42*lift,0,0))
        rotate('DEF-foot.R',(-.35*lift,0,0))
        rotate('DEF-upper_arm.L',(-.2*lift,0,.22))
        rotate('DEF-spine.001',(.12*lift,0,.06*lift))
    elif kind=='miss':
        s=math.sin(t*math.pi/2)
        rotate('DEF-spine.001',(.22*s,0,0));rotate('DEF-head',(.28*s,0,0))
        rotate('DEF-upper_arm.L',(-.20*s,0,.12+.18*s))
        rotate('DEF-upper_arm.R',(-.20*s,0,-.12-.18*s))
    bpy.context.view_layer.update()
frames=CACHE/'frames-v2';frames.mkdir(exist_ok=True)
clips={'idle':12,'kick':12,'miss':12}
if '--preview' in sys.argv:clips={'idle':1,'kick':1}
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.016))
catcher=bpy.context.object;catcher.name='Cycles court shadow catcher';catcher.is_shadow_catcher=True;catcher.hide_render=True
people=[o for o in scene.objects if o.type=='MESH' and not o.hide_render]
metadata={'size':[480,720],'fps':24,'camera':list(camera.location),'clips':{},'samples':32,'anchors':{'source':'evaluated shoe mesh vertices','toe_vertex':toe_index,'plant_vertex':plant_index}}
for kind,count in clips.items():
    metadata['clips'][kind]=[]
    for i in range(count):
        t=1 if count==1 and kind=='kick' else i/max(1,count-1);pose(kind,t)
        file=frames/f'{kind}-{i:02}.png';scene.render.filepath=str(file)
        catcher.hide_render=True
        for obj in people:obj.visible_camera=True
        scene.render.resolution_x=480;camera.data.ortho_scale=2.5;scene.render.use_border=False
        if '--markers-only' not in sys.argv:bpy.ops.render.render(write_still=True)
        else:assert file.exists()
        point=shoe_point(toe_index)
        from bpy_extras.object_utils import world_to_camera_view
        uv=world_to_camera_view(scene,camera,point)
        plant=world_to_camera_view(scene,camera,shoe_point(plant_index))
        record={'file':file.name,'toe':[uv.x*480,(1-uv.y)*720],'plant':[plant.x*480,(1-plant.y)*720]}
        # Separate real ray-traced shadow, wider than the figure and cropped to the court.
        catcher.hide_render=False
        for obj in people:obj.visible_camera=False
        scene.render.resolution_x=1280;camera.data.ortho_scale=2.5*1280/720
        scene.render.use_border=True;scene.render.use_crop_to_border=True
        scene.render.border_min_x=0;scene.render.border_max_x=1;scene.render.border_min_y=0;scene.render.border_max_y=.35
        shadow_file=frames/f'{kind}-{i:02}-shadow.png';scene.render.filepath=str(shadow_file)
        if '--markers-only' not in sys.argv:bpy.ops.render.render(write_still=True)
        else:assert shadow_file.exists()
        shadow_plant=world_to_camera_view(scene,camera,shoe_point(plant_index))
        record['shadowFile']=shadow_file.name;record['shadowPlant']=[shadow_plant.x*1280,(1-shadow_plant.y)*720-468]
        metadata['clips'][kind].append(record)
    print('CLIP_DONE',kind,count,flush=True)
(CACHE/'render-v2.json').write_text(json.dumps(metadata,indent=2))
sys.path.insert(0,str(ROOT))
from render_ball import render_ball
if '--preview' not in sys.argv and '--markers-only' not in sys.argv:
    scene.render.use_border=False
    render_ball(scene,CACHE)
