"""Clothed, articulated CC0 human source. No anatomical torso/lower-body mesh is exported.
Blender -b --factory-startup --python art/outdoor/build_character.py -- OUT [--preview].
"""
import sys,math,json
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE))
import geometry as g
import character_data as data
ARGS=sys.argv[sys.argv.index('--')+1:]
OUT=Path(ARGS[0]).resolve();OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
base=HERE/'.cache/models/human';system=base/'system'
mesh=data.read_obj(base/'base.obj')
morphed=data.apply_targets(mesh['vertices'],[base/'adult-male.target',base/'body-shape.target'])
body_indices={i for group,face in mesh['faces'] if group=='body' for i,_ in face}
bottom=min(morphed[i][1] for i in body_indices);top=max(morphed[i][1] for i in body_indices)
scale=1.79/(top-bottom)
def position(v):return Vector((v[0]*scale,-v[2]*scale,(v[1]-bottom)*scale))
joints={name:position(v) for name,v in data.joint_centres(mesh,morphed).items()}
pelvis=joints['joint-pelvis'];neck=joints['joint-neck'];head=joints['joint-head']
bone_specs=[('hips',pelvis,pelvis+Vector((0,0,.16)),None),
            ('spine',pelvis+Vector((0,0,.16)),neck,'hips'),
            ('head',neck,head+Vector((0,0,.08)),'spine')]
for side,label in [(-1,'r'),(1,'l')]:
    shoulder=joints['joint-'+label+'-shoulder'];elbow=joints['joint-'+label+'-elbow']
    hand=joints['joint-'+label+'-hand'];knee=joints['joint-'+label+'-knee']
    ankle=joints['joint-'+label+'-ankle'];hip=pelvis+Vector((side*.105,0,-.035))
    bone_specs.extend([
        ('arm_'+label,shoulder,elbow,'spine'),
        ('forearm_'+label,elbow,hand,'arm_'+label),
        ('hand_'+label,hand,hand+Vector((0,-.075,0)),'forearm_'+label),
        ('leg_'+label,hip,knee,'hips'),('shin_'+label,knee,ankle,'leg_'+label),
        ('foot_'+label,ankle,ankle+Vector((0,-.17,-.015)),'shin_'+label)])
arm_data=bpy.data.armatures.new('person_skeleton');arm=g.link(bpy.data.objects.new('person_rig',arm_data))
g.select_only(arm);bpy.ops.object.mode_set(mode='EDIT')
for name,start,end,parent in bone_specs:
    bone=arm_data.edit_bones.new(name);bone.head=start;bone.tail=end
    if parent:bone.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
skin=g.principled('person_skin',g.srgb('#bd947b'),roughness=.62)
shirt=g.principled('person_shirt',g.srgb('#293b3b'),roughness=.87)
pants=g.principled('person_trousers',g.srgb('#7c7466'),roughness=.92)
coat=g.principled('person_winter_coat',g.srgb('#354443'),roughness=.8)
shoe=g.principled('person_shoes',g.srgb('#d9d5c7'),roughness=.72)
hair=g.principled('person_hair',g.srgb('#352c27'),roughness=.95)
eye=g.principled('person_eyes',g.srgb('#746b5d'),roughness=.25)

def distance_segment(point,start,end):
    delta=end-start;t=max(0,min(1,(point-start).dot(delta)/delta.length_squared))
    return (point-start-delta*t).length

def weights(point):
    x,_,height=point;side='l' if x>=0 else 'r'
    if height>1.50 and abs(x)<.23:return [('head',1)]
    if abs(x)>.23 and height>pelvis.z+.04:
        choices=['arm_'+side,'forearm_'+side,'hand_'+side]
    elif height<pelvis.z+.06:choices=['leg_'+side,'shin_'+side,'foot_'+side,'hips']
    else:choices=['hips','spine','head']
    scored=[(name,1/max(.012,distance_segment(point,a,b))**3)
            for name,a,b,parent in bone_specs if name in choices]
    scored.sort(key=lambda item:-item[1]);scored=scored[:3];total=sum(v for _,v in scored)
    return [(name,value/total) for name,value in scored]

def make_mesh(name,source,coordinates,materials,select=None,choose=None,head_only=False):
    faces=[corners for group,corners in source['faces'] if (select is None or select(group,corners))]
    used=sorted({i for face in faces for i,_ in face});mapping={old:i for i,old in enumerate(used)}
    vertices=[position(coordinates[i]) for i in used]
    polygons=[[mapping[i] for i,_ in face] for face in faces]
    geometry=bpy.data.meshes.new(name);geometry.from_pydata(vertices,[],polygons);geometry.update()
    obj=g.link(bpy.data.objects.new(name,geometry));obj.parent=arm
    for material in materials:geometry.materials.append(material)
    uv=geometry.uv_layers.new(name='UVMap')
    for polygon,face in zip(geometry.polygons,faces):
        if choose:polygon.material_index=choose(sum(vertices[i].z for i in polygon.vertices)/len(polygon.vertices))
        for loop,(_,u) in zip(polygon.loop_indices,face):
            if u>=0:uv.data[loop].uv=source['uv'][u]
    groups={name:obj.vertex_groups.new(name=name) for name,_,_,_ in bone_specs}
    for i,vertex in enumerate(vertices):
        for bone,weight in ([('head',1)] if head_only else weights(vertex)):
            groups[bone].add([i],weight,'REPLACE')
    modifier=obj.modifiers.new('skeletal_deformation','ARMATURE');modifier.object=arm
    g.shade_smooth(obj,math.pi)
    return obj

def visible_skin(group,face):
    if group!='body':return False
    points=[position(morphed[i]) for i,_ in face];centre=sum(points,Vector())/len(points)
    return (centre.z>1.44 and abs(centre.x)<.22) or (abs(centre.x)>.23 and centre.z>1.03)
skin_obj=make_mesh('visible_head_and_arms',mesh,morphed,[skin],select=visible_skin)
components={}
for name in ['male_casualsuit04','male_casualsuit05','shoes01']:
    folder=system/'clothes'/name
    source=data.read_obj(folder/(name+'.obj'))
    coords=data.fit_clothing(source,folder/(name+'.mhclo'),morphed)
    materials=[pants,shirt] if name.endswith('04') else [pants,coat] if name.endswith('05') else [shoe]
    choose=(lambda z:1 if z>1.01 else 0) if len(materials)>1 else None
    obj=make_mesh(name,source,coords,materials,choose=choose);components[name]=obj
    obj['wardrobe']='winter' if name.endswith('05') else 'coast' if name.endswith('04') else 'shared'
for folder_name,filename,material in [('hair/short01','short01',hair),('eyes/low-poly','low-poly',eye)]:
    folder=system/folder_name
    source=data.read_obj(folder/(filename+'.obj'))
    coords=data.fit_clothing(source,folder/(filename+'.mhclo'),morphed)
    make_mesh(filename,source,coords,[material],head_only=True)
# Both wardrobe meshes export; the runtime selects one. Hide winter for this render.
components['male_casualsuit05'].hide_render=True
arm['hips_height']=pelvis.z;arm['height']=1.79
# Rest-pose action validates smooth bone deformation before runtime integration.
scene.frame_start=1;scene.frame_end=25
for frame in [1,7,13,19,25]:
    t=(frame-1)/24*math.tau
    for side,label in [(-1,'r'),(1,'l')]:
        for part,angle in [('arm',math.sin(t)*.32*side),('leg',-math.sin(t)*.45*side)]:
            bone=arm.pose.bones[part+'_'+label];bone.rotation_mode='XYZ'
            bone.rotation_euler.x=angle;bone.keyframe_insert('rotation_euler',frame=frame)
scene.frame_set(1)
for obj in scene.objects:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'person.glb'),export_format='GLB',export_yup=True,
    export_apply=True,export_extras=True,export_animations=True,export_animation_mode='ACTIONS',export_lights=False,export_cameras=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'person-source.blend'))
if '--preview' in ARGS:
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    world=bpy.data.worlds.new('person_preview');scene.world=world
    world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.5,.6,.65,1)
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.7
    floor=g.box('author_floor',(-3,-3,-.06),(3,3,-.02),g.principled('preview_floor',(.25,.27,.23),roughness=.9))
    lamp_data=bpy.data.lights.new('author_key','AREA');lamp_data.energy=450;lamp_data.size=3
    lamp=g.link(bpy.data.objects.new('author_key',lamp_data));lamp.location=(2,-3,4)
    lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
    cam_data=bpy.data.cameras.new('author_camera');cam=g.link(bpy.data.objects.new('author_camera',cam_data))
    cam.location=(2.8,-4.5,2.4);cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam_data.lens=55;scene.camera=cam
    scene.render.resolution_x=600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(OUT/'person-preview.png')
    bpy.ops.render.render(write_still=True)
print('CHARACTER_SOURCE',json.dumps({'height':1.79,'hips':pelvis.z,'bytes':(OUT/'person.glb').stat().st_size}),flush=True)
