"""Original surface detail for the authored room. No scene reset on import."""
import math
from pathlib import Path
import bpy
import bmesh


def organic_leaf_mesh(length, width):
    bm=bmesh.new();rows,cols=12,4;grid=[]
    for r in range(rows+1):
        u=r/rows
        half=width*(math.sin(math.pi*u)**.8)*(1-.18*u)*(1+.045*math.sin(u*17))+1e-5
        row=[]
        for c in range(cols+1):
            v=c/cols*2-1;x=v*half
            z=.10*abs(x)+.09*length*math.sin(u*math.pi)-.06*length*u*u+.012*length*math.sin(u*18+v*2)*abs(v)
            row.append(bm.verts.new((x,length*u,z)))
        grid.append(row)
    uv=bm.loops.layers.uv.new('leaf')
    for r in range(rows):
        for c in range(cols):
            f=bm.faces.new((grid[r][c],grid[r][c+1],grid[r+1][c+1],grid[r+1][c]))
            for loop,co in zip(f.loops,((c/cols,r/rows),((c+1)/cols,r/rows),((c+1)/cols,(r+1)/rows),(c/cols,(r+1)/rows))):loop[uv].uv=co
    mesh=bpy.data.meshes.new('organic_leaf');bm.to_mesh(mesh);bm.free();return mesh


def add_leaf_surface(mat):
    tree=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=tree.get('Principled BSDF')
    uv=tree.new('ShaderNodeUVMap');uv.uv_map='leaf'
    separate=tree.new('ShaderNodeSeparateXYZ');links.new(uv.outputs['UV'],separate.inputs[0])
    def math_node(op,a,b=None):
        n=tree.new('ShaderNodeMath');n.operation=op
        if hasattr(a,'is_output'):links.new(a,n.inputs[0])
        else:n.inputs[0].default_value=a
        if b is not None:
            if hasattr(b,'is_output'):links.new(b,n.inputs[1])
            else:n.inputs[1].default_value=b
        return n.outputs[0]
    centre=math_node('ABSOLUTE',math_node('SUBTRACT',separate.outputs['X'],.5))
    midrib=math_node('LESS_THAN',centre,.018)
    diagonal=math_node('FRACT',math_node('ADD',math_node('MULTIPLY',separate.outputs['Y'],8),math_node('MULTIPLY',centre,2.8)))
    ribs=math_node('MULTIPLY',math_node('LESS_THAN',diagonal,.038),.28)
    vein=math_node('MAXIMUM',midrib,ribs)
    base=next((l.from_socket for l in list(links) if l.to_socket==bsdf.inputs['Base Color']),None)
    if base:
        mix=tree.new('ShaderNodeMixRGB');mix.blend_type='SCREEN';mix.inputs[2].default_value=(.08,.14,.025,1)
        links.new(math_node('MULTIPLY',vein,.55),mix.inputs[0]);links.new(base,mix.inputs[1]);links.new(mix.outputs[0],bsdf.inputs['Base Color'])
    bump=tree.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.32;bump.inputs['Distance'].default_value=.0006
    links.new(vein,bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value=.48


def prepare_lightmap_uv(obj, select_only, margin):
    select_only(obj)
    for layer in list(obj.data.uv_layers):
        if layer.name!='leaf':obj.data.uv_layers.remove(layer)
    obj.data.uv_layers.new(name='bake');obj.data.uv_layers.active_index=len(obj.data.uv_layers)-1
    obj.data.uv_layers.active.active_render=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60),island_margin=margin);bpy.ops.object.mode_set(mode='OBJECT')


def capture_surface_maps(obj, out, size=256):
    """Bake the source shader's normal/roughness before replacing its colour material."""
    out=Path(out);result={}
    for name,kind in [('normal','NORMAL'),('roughness','ROUGHNESS')]:
        image=bpy.data.images.new(obj.name+'_'+name,size,size,alpha=False,float_buffer=True)
        image.colorspace_settings.name='Non-Color'
        active=[]
        for slot in obj.material_slots:
            node=slot.material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
            slot.material.node_tree.nodes.active=node;active.append((slot.material,node))
        bpy.ops.object.bake(type=kind,margin=8,use_clear=True)
        for mat,node in active:mat.node_tree.nodes.remove(node)
        image.filepath_raw=str(out/(obj.name+'_'+name+'.png'));image.file_format='PNG';image.save()
        result[name]=image
    return result


def attach_surface_maps(obj, mat, maps):
    tree=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=tree.get('Principled BSDF')
    normal=tree.new('ShaderNodeTexImage');normal.image=maps['normal']
    normal_map=tree.new('ShaderNodeNormalMap');normal_map.inputs['Strength'].default_value=.65
    links.new(normal.outputs['Color'],normal_map.inputs['Color']);links.new(normal_map.outputs['Normal'],bsdf.inputs['Normal'])
    rough=tree.new('ShaderNodeTexImage');rough.image=maps['roughness'];links.new(rough.outputs['Color'],bsdf.inputs['Roughness'])
    # Authoring UVs served their purpose; only the compact baked UVs ship.
    for uv in list(obj.data.uv_layers):
        if uv.name!='bake':obj.data.uv_layers.remove(uv)
    obj.data.uv_layers.active_index=0


def add_woven_surface(mat, spacing=.012, depth=.0007):
    """Visible crossed fibres, with slow dye variation; all authored locally."""
    tree=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=tree.get('Principled BSDF')
    base=next((l.from_socket for l in list(links) if l.to_socket==bsdf.inputs['Base Color']),None)
    colour=tuple(bsdf.inputs['Base Color'].default_value)
    coord=tree.new('ShaderNodeTexCoord');separate=tree.new('ShaderNodeSeparateXYZ');links.new(coord.outputs['Object'],separate.inputs[0])
    def wave(axis):
        scale=tree.new('ShaderNodeMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=math.tau/spacing;links.new(separate.outputs[axis],scale.inputs[0])
        sine=tree.new('ShaderNodeMath');sine.operation='SINE';links.new(scale.outputs[0],sine.inputs[0])
        absolute=tree.new('ShaderNodeMath');absolute.operation='ABSOLUTE';links.new(sine.outputs[0],absolute.inputs[0]);return absolute.outputs[0]
    fibres={axis:wave(axis) for axis in ('X','Y','Z')}
    geometry=tree.new('ShaderNodeNewGeometry');normals=tree.new('ShaderNodeSeparateXYZ');links.new(geometry.outputs['Normal'],normals.inputs[0])
    def calc(op,a,b=None):
        node=tree.new('ShaderNodeMath');node.operation=op;links.new(a,node.inputs[0])
        if b is not None:links.new(b,node.inputs[1])
        return node.outputs[0]
    weights=[calc('ABSOLUTE',normals.outputs[axis]) for axis in ('X','Y','Z')]
    pairs=[calc('MULTIPLY',fibres[a],fibres[b]) for a,b in [('Y','Z'),('X','Z'),('X','Y')]]
    weighted=[calc('MULTIPLY',pairs[i],weights[i]) for i in range(3)]
    total=calc('ADD',calc('ADD',weighted[0],weighted[1]),weighted[2])
    weight_sum=calc('ADD',calc('ADD',weights[0],weights[1]),weights[2])
    weave=calc('DIVIDE',total,weight_sum)
    ramp=tree.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.45,.42,.38,1);ramp.color_ramp.elements[1].color=(1.15,1.12,1.08,1);links.new(weave,ramp.inputs[0])
    mix=tree.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.8 if spacing>=.015 else .35;mix.inputs[1].default_value=colour
    if base:links.new(base,mix.inputs[1])
    links.new(ramp.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],bsdf.inputs['Base Color'])
    bump=tree.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.35 if spacing>=.015 else .12;bump.inputs['Distance'].default_value=depth if spacing>=.015 else min(depth,.0003)
    links.new(weave,bump.inputs['Height']);links.new(bump.outputs[0],bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value=.92
