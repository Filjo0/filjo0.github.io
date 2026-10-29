"""Original futsal kit adapted from the CC0 MakeHuman system mesh; render-only."""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'outdoor'))
import character_data as data

def dress_player(rig,names):
    base=HERE.parent/'outdoor/.cache/models/human'
    source=data.read_obj(base/'base.obj')
    morph=data.apply_targets(source['vertices'],[base/'adult-male.target',base/'body-shape.target'])
    body={i for group,face in source['faces'] if group=='body' for i,_ in face}
    bottom=min(morph[i][1] for i in body);scale=1.79/(max(morph[i][1] for i in body)-bottom)
    def pos(v):return Vector((v[0]*scale,-v[2]*scale,(v[1]-bottom)*scale))
    specs={old:(rig.matrix_world@rig.data.bones[new].head_local,rig.matrix_world@rig.data.bones[new].tail_local) for old,new in names.items()}
    def weights(point):
        x,_,z=point;side='l' if x>=0 else 'r'
        choices=['head'] if z>1.5 and abs(x)<.23 else ['arm_'+side,'forearm_'+side,'hand_'+side] if abs(x)>.23 and z>1.03 else ['leg_'+side,'shin_'+side,'foot_'+side,'hips'] if z<1.05 else ['hips','spine','head']
        scores=[]
        for name in choices:
            a,b=specs[name];delta=b-a;t=max(0,min(1,(point-a).dot(delta)/delta.length_squared))
            scores.append((names[name],1/max(.012,(point-a-t*delta).length)**3))
        scores=sorted(scores,key=lambda n:-n[1])[:3];total=sum(v for _,v in scores)
        return [(n,v/total) for n,v in scores]
    def material(name,color,rough):
        m=bpy.data.materials.new(name);m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
        return m,bs
    skin,bs=material('Textured skin with soft subsurface',(.45,.25,.17),.54)
    bs.inputs['Subsurface Weight'].default_value=.12;bs.inputs['Subsurface Radius'].default_value=(1,.45,.22)
    tex=skin.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(HERE/'.cache/system/skins/young_caucasian_male/young_lightskinned_male_diffuse.png'))
    skin.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    def grain(m,bs,scale,strength):
        nodes=m.node_tree.nodes;links=m.node_tree.links
        noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=2
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.001
        links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])
        ramp=nodes.new('ShaderNodeMapRange');ramp.inputs['To Min'].default_value=.42;ramp.inputs['To Max'].default_value=.64
        links.new(noise.outputs['Fac'],ramp.inputs['Value']);links.new(ramp.outputs['Result'],bs.inputs['Roughness'])
    grain(skin,bs,190,.15)
    jersey,jbs=material('Deep coastal teal jersey',(.018,.095,.10),.8);grain(jersey,jbs,240,.2)
    shorts,sbs=material('Navy futsal shorts',(.012,.021,.028),.85);grain(shorts,sbs,240,.12)
    trim,tbs=material('Warm ivory kit trim',(.72,.68,.53),.8)
    sock,kbs=material('Ivory knit knee socks',(.67,.65,.55),.86);grain(sock,kbs,300,.22)
    def mesh(name,src,coords,select,materials,choose=None,expand=1):
        faces=[f for g,f in src['faces'] if select(g,[pos(coords[i]) for i,_ in f])]
        used=sorted({i for f in faces for i,_ in f});mapping={old:i for i,old in enumerate(used)}
        verts=[pos(coords[i]) for i in used]
        for v in verts:v.x*=expand;v.y*=expand
        me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[[mapping[i] for i,_ in f] for f in faces]);me.update()
        obj=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(obj)
        world=obj.matrix_world.copy();obj.parent=rig;obj.matrix_world=world
        for m in materials:me.materials.append(m)
        uv=me.uv_layers.new()
        for poly,face in zip(me.polygons,faces):
            poly.use_smooth=True
            if choose:poly.material_index=choose(sum(verts[i].z for i in poly.vertices)/len(poly.vertices))
            for loop,(_,u) in zip(poly.loop_indices,face):
                if u>=0:uv.data[loop].uv=src['uv'][u]
        groups={n:obj.vertex_groups.new(name=n) for n in names.values()}
        for i,v in enumerate(verts):
            for n,w in weights(v):groups[n].add([i],w,'REPLACE')
        sub=obj.modifiers.new('Smooth silhouette','SUBSURF');sub.levels=1
        mod=obj.modifiers.new('Futsal rig','ARMATURE');mod.object=rig
        return obj
    # Remove chinos and flat exposed skin; keep the licensed face, eyes and hair topology.
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH' or o.hide_render:continue
        if o.name.startswith(('male_casualsuit04','visible_head_and_arms')):o.hide_render=True
    mesh('Textured face arms and uncovered knees',source,morph,lambda g,ps:g=='body' and ((sum(p.z for p in ps)/len(ps)>1.44 and max(abs(p.x) for p in ps)<.24) or (sum(abs(p.x) for p in ps)/len(ps)>.23 and min(p.z for p in ps)>1.03) or (.34<sum(p.z for p in ps)/len(ps)<.85)),[skin])
    folder=base/'system/clothes/male_casualsuit04';clothes=data.read_obj(folder/'male_casualsuit04.obj')
    fitted=data.fit_clothing(clothes,folder/'male_casualsuit04.mhclo',morph)
    mesh('Short sleeved jersey and tailored shorts',clothes,fitted,lambda g,ps:sum(p.z for p in ps)/len(ps)>.76,[shorts,jersey,trim],lambda z:1 if z>1.01 else 0)
    mesh('Knee high futsal socks',source,morph,lambda g,ps:g=='body' and .07<sum(p.z for p in ps)/len(ps)<.40,[sock],None,1.025)
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or o.hide_render:continue
        if o.name.startswith('short01'):
            m,hbs=material('Textured short hair',(.025,.015,.01),.65)
            t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(HERE/'.cache/system/hair/short01/short01_diffuse.png'))
            m.node_tree.links.new(t.outputs['Color'],hbs.inputs['Base Color']);m.node_tree.links.new(t.outputs['Alpha'],hbs.inputs['Alpha'])
            grain(m,hbs,350,.28);o.data.materials.clear();o.data.materials.append(m)
        if o.name.startswith('shoes01'):
            # Adapt the licensed shoe mesh into low indoor trainers; remove the tall casual cuff.
            bm=bmesh.new();bm.from_mesh(o.data);inverse=o.matrix_world.inverted()
            plane=inverse@Vector((0,0,.125));normal=(o.matrix_world.to_3x3().transposed()@Vector((0,0,1))).normalized()
            cut=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0001,
                plane_co=plane,plane_no=normal,clear_outer=True,clear_inner=False)
            boundary=[e for e in cut['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
            if boundary:bmesh.ops.holes_fill(bm,edges=boundary)
            bm.to_mesh(o.data);bm.free()
            m,sh=material('Ivory indoor trainer upper',(.62,.64,.58),.72);grain(m,sh,260,.12)
            sole,sl=material('Gum rubber indoor sole',(.23,.13,.064),.85)
            o.data.materials.clear();o.data.materials.append(m);o.data.materials.append(sole)
            for polygon in o.data.polygons:
                z=sum((o.matrix_world@o.data.vertices[i].co).z for i in polygon.vertices)/len(polygon.vertices)
                polygon.material_index=1 if z<.035 else 0
    # Small kit number and boot laces are original geometry, attached to the same pose rig.
    def attached(obj,bone):
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        if obj.type!='MESH':bpy.ops.object.convert(target='MESH');obj=bpy.context.object
        world=obj.matrix_world.copy();obj.parent=rig;obj.matrix_world=world
        group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
        mod=obj.modifiers.new('Follow athlete','ARMATURE');mod.object=rig;obj.select_set(False)
    bpy.ops.object.text_add(location=(-.055,-.157,1.29),rotation=(math.pi/2,0,0))
    number=bpy.context.object;number.name='Original jersey number 7';number.data.body='7';number.data.size=.105
    number.data.extrude=.0003;number.data.materials.append(trim);attached(number,names['spine'])
    for side in ['l','r']:
        foot=specs['foot_'+side];x=foot[0].x
        for i in range(3):
            curve=bpy.data.curves.new('Trainer lace','CURVE');curve.dimensions='3D';curve.bevel_depth=.0025;curve.bevel_resolution=2
            spline=curve.splines.new('POLY');spline.points.add(1)
            for point,xx in zip(spline.points,[x-.025,x+.025]):point.co=(xx,foot[0].y-.04-i*.019,.104-i*.004,1)
            lace=bpy.data.objects.new('Ivory trainer lace',curve);bpy.context.scene.collection.objects.link(lace)
            lace.data.materials.append(trim);attached(lace,names['foot_'+side])
