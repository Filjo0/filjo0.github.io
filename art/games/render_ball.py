"""Original ball geometry; called in the same Blender session after the athlete."""
import bpy,math
from pathlib import Path
from mathutils import Vector
def render_ball(scene,cache):
    for o in scene.objects:
        if o.type in {'MESH','ARMATURE'}:o.hide_render=True
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
    ico=bpy.context.object
    vertices=[v.co.copy() for v in ico.data.vertices];triangles=[list(p.vertices) for p in ico.data.polygons]
    bpy.data.objects.remove(ico,do_unlink=True)
    edges=sorted({(i,j) for face in triangles for i in face for j in face if i!=j})
    points={(i,j):(2*vertices[i]+vertices[j])/3 for i,j in edges};keys=list(points);index={k:i for i,k in enumerate(keys)}
    faces=[]
    for i,v in enumerate(vertices):
        neighbors=[k for k in keys if k[0]==i];axis=v.normalized();basis=axis.cross(Vector((0,0,1)))
        if basis.length<.01:basis=axis.cross(Vector((0,1,0)))
        basis.normalize();other=axis.cross(basis)
        neighbors.sort(key=lambda k:math.atan2((points[k]-v).dot(other),(points[k]-v).dot(basis)))
        faces.append([index[k] for k in neighbors])
    for a,b,c in triangles:faces.append([index[k] for k in [(a,b),(b,a),(b,c),(c,b),(c,a),(a,c)]])
    data=bpy.data.meshes.new('Soccer ball panels');data.from_pydata(list(points.values()),[],faces);data.update()
    ball=bpy.data.objects.new('Soccer ball',data);scene.collection.objects.link(ball)
    for name,color in [('Black leather',(.012,.018,.015)),('Ivory leather',(.82,.80,.71))]:
        m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.6;data.materials.append(m)
    for p in data.polygons:p.material_index=0 if len(p.vertices)==5 else 1;p.use_smooth=True
    sub=ball.modifiers.new('Rounded ball','SUBSURF');sub.levels=2;sub.render_levels=2
    cast=ball.modifiers.new('Spherical leather','CAST');cast.factor=1
    ball.rotation_euler=(.4,.2,.35)
    camera=scene.camera;camera.location=(2,-5,2)
    camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=2.1
    scene.render.resolution_x=128;scene.render.resolution_y=128
    scene.render.filepath=str(cache/'ball.png');bpy.ops.render.render(write_still=True)