"""Blender helpers reused for the coastal reconstruction: CC0 PBR materials, model import,
primitives. Requires the cache filled by fetch_assets.py."""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

CACHE = Path(__file__).resolve().parent / '.cache'


def srgb(hex_value):
    value = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in value)


def link(obj, collection=None):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def select_only(obj):
    for other in bpy.context.selected_objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifiers(obj):
    select_only(obj)
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def shade_smooth(obj, angle=math.radians(40)):
    """Smooth shading, keeping edges sharper than angle (fast mesh API, no operator)."""
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if angle < math.pi - 1e-3:
        obj.data.set_sharp_from_angle(angle=angle)


def mix_rgba(tree, blend='MIX', factor=1.0):
    """Colour Mix node; returns (node, A, B, Result) colour sockets (names are shared with float sockets)."""
    node = tree.new('ShaderNodeMix')
    node.data_type = 'RGBA'
    node.blend_type = blend
    node.inputs['Factor'].default_value = factor
    a, b = [s for s in node.inputs if s.type == 'RGBA']
    result = next(s for s in node.outputs if s.type == 'RGBA')
    return node, a, b, result


def principled(name, color=(0.5, 0.5, 0.5), roughness=0.6, metallic=0.0, **inputs):
    mat = bpy.data.materials.new(name)
    tree = mat.node_tree
    bsdf = tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    for key, value in inputs.items():
        bsdf.inputs[key.replace('_', ' ')].default_value = value
    return mat


def emissive(name, color, strength):
    mat = principled(name, (0, 0, 0), 1.0)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Emission Color'].default_value = (*color, 1)
    bsdf.inputs['Emission Strength'].default_value = strength
    return mat


def pbr(name, texture, scale=1.0, tint=(1, 1, 1), tint_mix=0.0, roughness=None, roughness_scale=1.0,
        normal=1.0, mapping='BOX', rotation=0.0, recolor=False, **inputs):
    """CC0 texture set as a box-projected PBR material; scale is metres per texture tile."""
    folder = CACHE / 'textures' / texture
    mat = principled(name, **{k: v for k, v in inputs.items()})
    tree, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = tree.get('Principled BSDF')
    coord = tree.new('ShaderNodeTexCoord')
    mapper = tree.new('ShaderNodeMapping')
    mapper.inputs['Scale'].default_value = (1 / scale, 1 / scale, 1 / scale)
    mapper.inputs['Rotation'].default_value = (0, 0, rotation)
    links.new(coord.outputs['Object' if mapping == 'BOX' else 'UV'], mapper.inputs['Vector'])

    def image(file, colorspace):
        node = tree.new('ShaderNodeTexImage')
        node.image = bpy.data.images.load(str(next(folder.glob(file + '.*'))), check_existing=True)
        node.image.colorspace_settings.name = colorspace
        if mapping == 'BOX':
            node.projection = 'BOX'
            node.projection_blend = 0.25
        links.new(mapper.outputs['Vector'], node.inputs['Vector'])
        return node

    diffuse = image('diffuse', 'sRGB')
    if recolor:
        # Keep the texture's light/dark structure but replace its hue with tint.
        grey = tree.new('ShaderNodeRGBToBW')
        gain = tree.new('ShaderNodeMath')
        gain.operation = 'MULTIPLY_ADD'
        gain.inputs[1].default_value = 1.2
        gain.inputs[2].default_value = 0.5
        _, a, b, result = mix_rgba(tree, 'MULTIPLY')
        b.default_value = (*tint, 1)
        links.new(diffuse.outputs['Color'], grey.inputs['Color'])
        links.new(grey.outputs['Val'], gain.inputs[0])
        links.new(gain.outputs['Value'], a)
        links.new(result, bsdf.inputs['Base Color'])
    elif tint_mix:
        _, a, b, result = mix_rgba(tree, 'MULTIPLY', tint_mix)
        b.default_value = (*tint, 1)
        links.new(diffuse.outputs['Color'], a)
        links.new(result, bsdf.inputs['Base Color'])
    else:
        links.new(diffuse.outputs['Color'], bsdf.inputs['Base Color'])
    if roughness is None:
        rough = image('rough', 'Non-Color')
        if roughness_scale != 1.0:
            math_node = tree.new('ShaderNodeMath')
            math_node.operation = 'MULTIPLY'
            math_node.inputs[1].default_value = roughness_scale
            links.new(rough.outputs['Color'], math_node.inputs[0])
            links.new(math_node.outputs['Value'], bsdf.inputs['Roughness'])
        else:
            links.new(rough.outputs['Color'], bsdf.inputs['Roughness'])
    else:
        bsdf.inputs['Roughness'].default_value = roughness
    if normal:
        normal_map = tree.new('ShaderNodeNormalMap')
        normal_map.inputs['Strength'].default_value = normal
        normal_image = image('normal', 'Non-Color')
        links.new(normal_image.outputs['Color'], normal_map.inputs['Color'])
        links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def box(name, lo, hi, mat=None, bevel=0.0, segments=3, subdivide=0):
    lo, hi = Vector(lo), Vector(hi)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(lo + hi) / 2)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = hi - lo
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('bevel', 'BEVEL')
        modifier.width, modifier.segments, modifier.limit_method = bevel, segments, 'NONE'
    if subdivide:
        modifier = obj.modifiers.new('soft', 'SUBSURF')
        modifier.levels = modifier.render_levels = subdivide
    if bevel or subdivide:
        apply_modifiers(obj)
        shade_smooth(obj, math.pi if subdivide else math.radians(40))
    if mat:
        obj.data.materials.append(mat)
    return obj


def cylinder(name, centre, radius, z0, z1, mat=None, vertices=64, radius_top=None, bevel=0.0):
    if radius_top is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=z1 - z0,
                                            location=(centre[0], centre[1], (z0 + z1) / 2))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius_top, depth=z1 - z0,
                                        location=(centre[0], centre[1], (z0 + z1) / 2))
    obj = bpy.context.active_object
    obj.name = name
    if bevel:
        modifier = obj.modifiers.new('bevel', 'BEVEL')
        modifier.width, modifier.segments, modifier.limit_method = bevel, 3, 'ANGLE'
        apply_modifiers(obj)
    shade_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def lathe(name, profile, location, mat=None, steps=72):
    """Spin (radius, height) points around Z."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    obj = link(bpy.data.objects.new(name, data))
    obj.location = location
    shade_smooth(obj, math.radians(60))
    if mat:
        obj.data.materials.append(mat)
    return obj


def pose(obj, matrix):
    """Apply matrix to a part modelled in local building coordinates (around the origin)."""
    obj.data.transform(Matrix.Translation(obj.location))
    obj.location = (0, 0, 0)
    obj.data.transform(matrix)
    return obj


def import_model(asset):
    """Import a cached CC0 model; returns its top-level objects parented to one empty."""
    folder = CACHE / 'models' / asset
    before = set(bpy.data.objects)
    gltf = folder / f'{asset}.gltf'
    if gltf.exists():
        bpy.ops.import_scene.gltf(filepath=str(gltf))
    else:
        with bpy.data.libraries.load(str(folder / f'{asset}.blend'), link=False) as (source, target):
            target.objects = list(source.objects)
        for obj in target.objects:
            if obj is not None and obj.type in {'MESH', 'EMPTY'}:
                link(obj)
    new = [obj for obj in bpy.data.objects if obj not in before]
    root = link(bpy.data.objects.new(asset, None))
    for obj in new:
        if obj.parent is None and obj is not root:
            obj.parent = root
    return root, [obj for obj in new if obj.type == 'MESH']


def bounds(objects):
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return lo, hi


def place(root, meshes, location, rotation_z=0.0, height=None, width=None):
    """Scale a model to a target height or width, rotate it and stand it on location."""
    bpy.context.view_layer.update()
    lo, hi = bounds(meshes)
    size = hi - lo
    factor = height / size.z if height else (width / max(size.x, size.y) if width else 1.0)
    root.scale = (root.scale.x * factor,) * 3
    root.rotation_euler.z += rotation_z
    bpy.context.view_layer.update()
    lo, hi = bounds(meshes)
    centre = (lo + hi) / 2
    root.location += Vector((location[0] - centre.x, location[1] - centre.y, location[2] - lo.z))
    bpy.context.view_layer.update()
    return root


def set_material(meshes, mat, only=None):
    for obj in meshes:
        for slot in obj.material_slots:
            if only is None or only(slot.material):
                slot.material = mat


def braided_jute():
    """Rows of knobbly braided loops (about 2 cm), with fibre noise and colour variation."""
    mat = principled('jute', srgb('#8f5e30'), 0.95)
    tree, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = tree.get('Principled BSDF')
    coord = tree.new('ShaderNodeTexCoord')
    stretch = tree.new('ShaderNodeMapping')
    stretch.inputs['Scale'].default_value = (36.0, 22.0, 36.0)
    loops = tree.new('ShaderNodeTexVoronoi')
    loops.feature = 'F1'
    loops.inputs['Randomness'].default_value = 0.35
    fibre = tree.new('ShaderNodeTexNoise')
    fibre.inputs['Scale'].default_value = 900.0
    fibre.inputs['Detail'].default_value = 6.0
    loop_height = tree.new('ShaderNodeMath')
    loop_height.operation = 'MULTIPLY'
    loop_height.inputs[1].default_value = 2.2
    loop_height.use_clamp = True
    fibre_weight = tree.new('ShaderNodeMath')
    fibre_weight.operation = 'MULTIPLY'
    fibre_weight.inputs[1].default_value = 0.3
    height = tree.new('ShaderNodeMath')
    height.operation = 'ADD'
    ramp = tree.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*srgb('#3f2512'), 1)
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (*srgb('#b07a45'), 1)
    bump = tree.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.9
    bump.inputs['Distance'].default_value = 0.01
    links.new(coord.outputs['Object'], stretch.inputs['Vector'])
    links.new(stretch.outputs['Vector'], loops.inputs['Vector'])
    links.new(coord.outputs['Object'], fibre.inputs['Vector'])
    links.new(loops.outputs['Distance'], loop_height.inputs[0])
    links.new(fibre.outputs['Fac'], fibre_weight.inputs[0])
    links.new(loop_height.outputs['Value'], height.inputs[0])
    links.new(fibre_weight.outputs['Value'], height.inputs[1])
    links.new(height.outputs['Value'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(height.outputs['Value'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


class BookPool:
    """Linked copies of the CC0 decorative book set (thickness along X, spine toward -Y, height Z)."""

    def __init__(self, rng):
        self.rng = rng
        root, meshes = import_model('decorative_book_set_01')
        bpy.context.view_layer.update()
        self.books = []
        for mesh in meshes:
            lo, hi = bounds([mesh])
            size = hi - lo
            if not 0.15 < size.z < 0.33 or size.x > 0.06:
                continue                              # keep upright hardcovers and paperbacks
            anchor = Vector((lo.x, (lo.y + hi.y) / 2, lo.z))
            self.books.append((mesh, anchor, size))
            mesh.hide_render = True
        root.hide_render = True

    def place(self, mesh, anchor, target, yaw, tilt=0.0, lying=False):
        book = mesh.copy()
        book.parent = None
        book.hide_render = False
        link(book)
        turn = Matrix.Rotation(yaw, 4, 'Z')
        pose_matrix = Matrix.Translation(target) @ turn
        if lying:
            pose_matrix = pose_matrix @ Matrix.Rotation(math.radians(-90), 4, 'Y')
        elif tilt:
            pose_matrix = pose_matrix @ Matrix.Rotation(tilt, 4, 'Y')
        book.matrix_world = pose_matrix @ Matrix.Translation(-anchor) @ mesh.matrix_world
        return book

    def fill(self, start, yaw, length, gap_chance=0.12):
        """Stand books along a shelf from start, stacking in the yaw-rotated +X direction."""
        along = Matrix.Rotation(yaw, 4, 'Z') @ Vector((1, 0, 0))
        offset = 0.0
        while offset < length - 0.05:
            r = self.rng.random()
            if r < gap_chance:
                offset += self.rng.uniform(0.04, 0.12)
                continue
            mesh, anchor, size = self.books[int(self.rng.integers(len(self.books)))]
            if r < gap_chance + 0.06 and offset < length - 0.3:
                for k in range(int(self.rng.integers(2, 5))):     # a small flat stack
                    m, a, s = self.books[int(self.rng.integers(len(self.books)))]
                    self.place(m, a, start + along * (offset + 0.24) + Vector((0, 0, k * s.x)), yaw + math.pi / 2, lying=True)
                offset += 0.28
                continue
            self.place(mesh, anchor, start + along * offset, yaw)
            offset += size.x + 0.002
