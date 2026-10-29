"""Original contact-zone artwork for the studio room (side table, lamp, plant, sofa).

Run headless:  blender -b --factory-startup --python art/studio/contact_zone.py -- <out_dir> [--preview]

Coordinates: Blender is Z-up, so a Three.js point (x, y, z) is Blender (x, -z, y). The glTF
exporter converts back, so exported meshes sit at the room's existing world coordinates.
Static furniture receives a full Cycles diffuse bake (direct + indirect + albedo) that the
runtime retains alongside normal/roughness maps and live specular. Floor/wall decals store how much the furniture darkens the existing
procedural surfaces. The copper lamp stays a live PBR material for reflections.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
from surface_bake import organic_leaf_mesh, add_leaf_surface, prepare_lightmap_uv, capture_surface_maps, attach_surface_maps, add_woven_surface

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = Path(ARGS[0] if ARGS else '.').resolve()
PREVIEW = '--preview' in ARGS
SAMPLES = 64 if '--fast' in ARGS else 384
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
if '--gpu' in ARGS:
    preferences = bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type = 'CUDA'
    devices = preferences.get_devices_for_type('CUDA')
    if not any(device.type == 'CUDA' for device in devices):
        raise RuntimeError('--gpu requires an available CUDA device; omit it for CPU baking.')
    for device in devices:
        device.use = device.type == 'CUDA'
    scene.cycles.device = 'GPU'
    print('BAKE_DEVICE CUDA', flush=True)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('dusk')
scene.world = world
world.color = (0.012, 0.016, 0.026)
try:
    world.use_nodes = True
except AttributeError:
    pass
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (0.010, 0.014, 0.024, 1)
background.inputs['Strength'].default_value = 1.0


def three(x, y, z):
    return Vector((x, -z, y))


def link(obj):
    scene.collection.objects.link(obj)
    return obj


def mesh_object(name, bm):
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    return link(bpy.data.objects.new(name, data))


def select_only(obj):
    for other in scene.objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifiers(obj):
    select_only(obj)
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def smooth(obj, angle=0.6):
    for poly in obj.data.polygons:
        poly.use_smooth = True
    try:
        select_only(obj)
        bpy.ops.object.shade_auto_smooth(angle=angle)
        apply_modifiers(obj)
    except Exception:
        pass


def rounded_box(name, lo, hi, radius, subdivide=1, mat=None, bevel_segments=4):
    lo, hi = Vector(lo), Vector(hi)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(lo + hi) / 2)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = hi - lo
    select_only(obj)
    bpy.ops.object.transform_apply(scale=True)
    bevel = obj.modifiers.new('bevel', 'BEVEL')
    bevel.width = radius
    bevel.segments = bevel_segments
    bevel.limit_method = 'NONE'
    if subdivide:
        sub = obj.modifiers.new('soft', 'SUBSURF')
        sub.levels = sub.render_levels = subdivide
    apply_modifiers(obj)
    smooth(obj, math.pi)
    if mat:
        obj.data.materials.append(mat)
    return obj


def join(name, objects):
    select_only(objects[0])
    for obj in objects[1:]:
        obj.select_set(True)
    bpy.ops.object.join()
    result = bpy.context.active_object
    result.name = name
    return result


def nodes(mat):
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    return mat.node_tree.nodes, mat.node_tree.links


def principled(name, color, roughness=0.7, metallic=0.0):
    mat = bpy.data.materials.new(name)
    tree, _ = nodes(mat)
    bsdf = tree.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return mat


def srgb(hex_value):
    value = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in value)


def oak(name):
    """Irregular long oak fibres; subdued colour and microscopic surface relief."""
    mat = principled(name, srgb('#9a7552'), 0.45)
    tree, links = nodes(mat)
    bsdf = tree.get('Principled BSDF')
    coord = tree.new('ShaderNodeTexCoord')
    mapping = tree.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1.5, 32.0, 4.0)
    warp = tree.new('ShaderNodeTexNoise')
    warp.inputs['Scale'].default_value = 1.8
    warp.inputs['Detail'].default_value = 2.0
    warp_scale = tree.new('ShaderNodeVectorMath')
    warp_scale.operation = 'SCALE'
    warp_scale.inputs['Scale'].default_value = 0.22
    distorted = tree.new('ShaderNodeVectorMath')
    distorted.operation = 'ADD'
    grain = tree.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 2.3
    grain.inputs['Detail'].default_value = 3.8
    grain.inputs['Roughness'].default_value = 0.65
    pores_mapping = tree.new('ShaderNodeMapping')
    pores_mapping.inputs['Scale'].default_value = (2.0, 170.0, 5.0)
    fine = tree.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = 2.0
    fine.inputs['Detail'].default_value = 2.0
    ramp = tree.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*srgb('#806448'), 1)
    ramp.color_ramp.elements[1].color = (*srgb('#a08361'), 1)
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[1].position = 0.72
    mix = tree.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'OVERLAY'
    mix.inputs['Factor'].default_value = 0.08
    bump = tree.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.075
    bump.inputs['Distance'].default_value = 0.0005
    links.new(coord.outputs['Object'], mapping.inputs['Vector'])
    links.new(coord.outputs['Object'], warp.inputs['Vector'])
    links.new(warp.outputs['Color'], warp_scale.inputs[0])
    links.new(mapping.outputs['Vector'], distorted.inputs[0])
    links.new(warp_scale.outputs['Vector'], distorted.inputs[1])
    links.new(distorted.outputs['Vector'], grain.inputs['Vector'])
    links.new(coord.outputs['Object'], pores_mapping.inputs['Vector'])
    links.new(pores_mapping.outputs['Vector'], fine.inputs['Vector'])
    links.new(grain.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], mix.inputs['A'])
    links.new(fine.outputs['Color'], mix.inputs['B'])
    links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    links.new(fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def textured(name, color, scale, strength, roughness=0.9, variation=0.12):
    """Matte material with fine noise colour variation and bump (fabric, ceramic, soil)."""
    mat = principled(name, color, roughness)
    tree, links = nodes(mat)
    bsdf = tree.get('Principled BSDF')
    coord = tree.new('ShaderNodeTexCoord')
    noise = tree.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.7
    ramp = tree.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*[c * (1 - variation) for c in color], 1)
    ramp.color_ramp.elements[1].color = (*[min(1, c * (1 + variation)) for c in color], 1)
    bump = tree.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    links.new(coord.outputs['Object'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def lathe(name, profile, steps=64):
    """Spin a (radius, height) profile around Z."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=steps, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_object(name, bm)
    smooth(obj, 0.9)
    return obj


# --- Room proxies: they shape bounce light and occlusion but are not exported. -----------
proxy_floor = principled('proxy_floor', srgb('#7c5d42'), 0.55)
proxy_wall = principled('proxy_wall', srgb('#4b4740'), 0.95)
proxies = []
for name, lo, hi, mat in [
    ('floor', (-4, -5.9, -0.1), (4, 2.73, 0.0075), proxy_floor),
    ('ceiling', (-4, -5.9, 3.18), (4, 2.73, 3.3), proxy_wall),
    ('wall_right', (3.97, -5.9, 0), (4.1, 2.8, 3.2), proxy_wall),
    ('wall_left', (-4.1, -5.9, 0), (-3.97, 2.8, 3.2), proxy_wall),
    ('wall_back_left', (-4, 2.725, 0), (-2, 2.85, 3.2), proxy_wall),
    ('wall_back_right', (2, 2.725, 0), (4, 2.85, 3.2), proxy_wall),
    ('wall_back_sill', (-2, 2.725, 0), (2, 2.85, 0.7), proxy_wall),
    ('wall_back_head', (-2, 2.725, 2.98), (2, 2.85, 3.2), proxy_wall),
    ('coffee_table', (-0.86, -0.51, 0), (0.86, 0.51, 0.4475), principled('proxy_coffee', srgb('#9a7552'), 0.6)),
]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(Vector(lo) + Vector(hi)) / 2)
    obj = bpy.context.active_object
    obj.name = 'proxy_' + name
    obj.scale = Vector(hi) - Vector(lo)
    obj.data.materials.append(mat)
    proxies.append(obj)

# --- Side table: bevelled oak top, apron and three tapered splayed legs. --------------
TABLE = three(2.22, 0, -1.46)
TOP = 0.726
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.42, depth=0.03, location=(TABLE.x, TABLE.y, TOP - 0.015))
top = bpy.context.active_object
bevel = top.modifiers.new('bevel', 'BEVEL'); bevel.width = 0.009; bevel.segments = 5; bevel.limit_method = 'ANGLE'
apply_modifiers(top)
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.335, depth=0.055, location=(TABLE.x, TABLE.y, TOP - 0.03 - 0.0275))
apron = bpy.context.active_object
bevel = apron.modifiers.new('bevel', 'BEVEL'); bevel.width = 0.004; bevel.segments = 3; bevel.limit_method = 'ANGLE'
apply_modifiers(apron)
parts = [top, apron]
for i in range(3):
    angle = math.radians(90 + i * 120)
    tilt = 0.075
    length = 0.655
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.012, radius2=0.017, depth=length)
    leg = bpy.context.active_object
    tangent = Vector((-math.sin(angle), math.cos(angle), 0))
    radial = Vector((math.cos(angle), math.sin(angle), 0))
    leg.matrix_world = Matrix.Translation(Vector((TABLE.x, TABLE.y, 0)) + radial * 0.29 + Vector((0, 0, length / 2 + 0.004))) @ Matrix.Rotation(-tilt, 4, tangent)
    parts.append(leg)
for part in parts:
    smooth(part, 0.7)
table = join('side_table', parts)
table.data.materials.clear()
table.data.materials.append(oak('oak_table'))

# --- Table lamp: copper dome on a slim stem; the bulb lights the table from under the shade.
LAMP = three(2.37, 0.726, -1.59)
lamp_profile = [(0.0, 0.0), (0.072, 0.0), (0.076, 0.004), (0.076, 0.011), (0.07, 0.016), (0.012, 0.02),
                (0.0075, 0.03), (0.0075, 0.235), (0.011, 0.245), (0.011, 0.255), (0.0, 0.258)]
lamp_body = lathe('lamp_body', lamp_profile)
lamp_body.location = LAMP
shade_profile = [(0.0, 0.392)] + [(0.128 * math.sin(t), 0.25 + 0.142 * math.cos(t))
                                  for t in np.linspace(0.08, math.pi / 2, 18)] + [(0.13, 0.248), (0.126, 0.246)] + [
    (0.124 * math.sin(t), 0.25 + 0.138 * math.cos(t)) for t in np.linspace(math.pi / 2, 0.1, 14)] + [(0.0, 0.387)]
lamp_shade = lathe('lamp_shade', shade_profile)
lamp_shade.location = LAMP
copper = principled('copper', srgb('#b8774a'), 0.32, 1.0)
for obj in (lamp_body, lamp_shade):
    obj.data.materials.append(copper)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.028, location=LAMP + Vector((0, 0, 0.29)))
bulb = bpy.context.active_object
bulb.name = 'lamp_bulb'
bulb_mat = principled('bulb', (1, 0.86, 0.66), 0.5)
bulb_tree, _ = nodes(bulb_mat)
bulb_bsdf = bulb_tree.get('Principled BSDF')
bulb_bsdf.inputs['Emission Color'].default_value = (1, 0.78, 0.5, 1)
bulb_bsdf.inputs['Emission Strength'].default_value = 6.0
bulb.data.materials.append(bulb_mat)
smooth(bulb, math.pi)
lamp_light = bpy.data.lights.new('lamp', 'POINT')
lamp_light.energy = 38
lamp_light.color = (1.0, 0.72, 0.43)
lamp_light.shadow_soft_size = 0.025
link(bpy.data.objects.new('lamp_light', lamp_light)).location = LAMP + Vector((0, 0, 0.29))

# --- Plant: thrown ceramic pot, soil and arching pothos leaves on stems. ----------------
POT = three(2.43, 0.726, -1.30)
pot_profile = [(0.0, 0.004), (0.046, 0.0), (0.05, 0.004), (0.06, 0.06), (0.067, 0.116), (0.071, 0.122),
               (0.07, 0.127), (0.064, 0.126), (0.06, 0.118), (0.054, 0.06), (0.04, 0.03)]
pot = lathe('pot', pot_profile)
pot.location = POT
pot.data.materials.append(textured('ceramic', srgb('#b9ad98'), 90, 0.05, 0.6, 0.06))
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.061, depth=0.004, location=POT + Vector((0, 0, 0.108)))
soil = bpy.context.active_object
soil.data.materials.append(textured('soil', srgb('#2e2219'), 260, 0.5, 1.0, 0.3))
plant_parts = [pot, soil]
leaf_mats = [textured(f'leaf_{i}', srgb(c), 35, 0.02, 0.5, 0.08) for i, c in enumerate(('#2f5b2e', '#3d6b35', '#4d7a3c'))]
stem_mat = principled('stem', srgb('#4f6a37'), 0.6)


def leaf_mesh(length, width):
    return organic_leaf_mesh(length,width)



for i in range(30):
    yaw = i * 2.39996 + rng.uniform(-0.2, 0.2)
    reach = rng.uniform(0.03, 0.12)
    rise = rng.uniform(0.02, 0.12) - (0.09 if reach > 0.095 else 0)
    base = POT + Vector((rng.uniform(-0.02, 0.02), rng.uniform(-0.02, 0.02), 0.11))
    tip = base + Vector((math.cos(yaw) * reach, math.sin(yaw) * reach, rise))
    curve = bpy.data.curves.new('stem', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.0012
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(1)
    for point, position, handle in ((spline.bezier_points[0], base, Vector((0, 0, 0.06))),
                                    (spline.bezier_points[1], tip, Vector((math.cos(yaw), math.sin(yaw), -0.3)) * 0.05)):
        point.co = position
        point.handle_left = position - handle
        point.handle_right = position + handle
    stem = link(bpy.data.objects.new('stem', curve))
    stem.data.materials.append(stem_mat)
    select_only(stem)
    bpy.ops.object.convert(target='MESH')
    plant_parts.append(bpy.context.active_object)
    size = rng.uniform(0.07, 0.105)
    leaf = link(bpy.data.objects.new('leaf', leaf_mesh(size, size * 0.25)))
    droop = rng.uniform(0.35, 0.95)
    leaf.matrix_world = (Matrix.Translation(tip) @ Matrix.Rotation(yaw - math.pi / 2, 4, 'Z')
                         @ Matrix.Rotation(-droop, 4, 'X') @ Matrix.Rotation(rng.uniform(-0.4, 0.4), 4, 'Y'))
    leaf.data.materials.append(leaf_mats[i % 3])
    smooth(leaf, math.pi)
    plant_parts.append(leaf)
plant = join('plant', plant_parts)

# --- Floor plant by the window: tapered stone planter and a tall broad-leaf plant. -------
PLANTER = three(1.65, 0.0075, -2.45)
planter = lathe('planter', [(0.0, 0.004), (0.17, 0.0), (0.18, 0.012), (0.235, 0.43), (0.25, 0.445), (0.247, 0.455),
                            (0.232, 0.452), (0.222, 0.43), (0.16, 0.06)])
planter.location = PLANTER
planter.data.materials.append(textured('planter', srgb('#b3aa9a'), 60, 0.12, 0.85, 0.08))
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.222, depth=0.006, location=PLANTER + Vector((0, 0, 0.405)))
planter_soil = bpy.context.active_object
planter_soil.data.materials.append(textured('planter_soil', srgb('#2b2018'), 200, 0.6, 1.0, 0.3))
big_parts = [planter, planter_soil]
for mat in leaf_mats:add_leaf_surface(mat)
big_leaf = [textured(f'big_leaf_{i}', srgb(c), 18, 0.03, 0.45, 0.07) for i, c in enumerate(('#2c4f2a', '#355c30', '#41683a'))]
for mat in big_leaf:add_leaf_surface(mat)
for s_index in range(7):
    yaw = s_index * 0.9 + rng.uniform(-0.25, 0.25)
    lean = rng.uniform(0.08, 0.28)
    height = rng.uniform(0.7, 1.3)
    base = PLANTER + Vector((math.cos(yaw) * 0.05, math.sin(yaw) * 0.05, 0.41))
    tip = base + Vector((math.cos(yaw) * height * lean, math.sin(yaw) * height * lean, height))
    curve = bpy.data.curves.new('trunk', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.006
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(1)
    for point, position, handle in ((spline.bezier_points[0], base, Vector((0, 0, height * 0.3))),
                                    (spline.bezier_points[1], tip, (tip - base).normalized() * height * 0.25)):
        point.co, point.handle_left, point.handle_right = position, position - handle, position + handle
    trunk = link(bpy.data.objects.new('trunk', curve))
    trunk.data.materials.append(stem_mat)
    select_only(trunk)
    bpy.ops.object.convert(target='MESH')
    big_parts.append(bpy.context.active_object)
    for k in range(8):
        t = 0.3 + k * 0.1
        at = base.lerp(tip, t) + Vector((0, 0, 0.0))
        leaf_yaw = yaw + rng.uniform(-1.6, 1.6)
        size = rng.uniform(0.22, 0.33) * (1.15 - 0.3 * t)
        leaf = link(bpy.data.objects.new('big_leaf', leaf_mesh(size, size * 0.25)))
        leaf.matrix_world = (Matrix.Translation(at) @ Matrix.Rotation(leaf_yaw - math.pi / 2, 4, 'Z')
                             @ Matrix.Rotation(-rng.uniform(0.5, 1.4), 4, 'X') @ Matrix.Rotation(rng.uniform(-0.6, 0.6), 4, 'Y'))
        leaf.data.materials.append(big_leaf[(s_index + k) % 3])
        smooth(leaf, math.pi)
        big_parts.append(leaf)
floor_plant = join('floor_plant', big_parts)

# --- Bookshelf: walnut frame with cloth-bound books, a vase and a box. ----------------
walnut = oak('walnut_shelf')
walnut_tree, _ = nodes(walnut)
ramp_node = next(n for n in walnut_tree if n.type == 'VALTORGB')
ramp_node.color_ramp.elements[0].color = (*srgb('#3b2618'), 1)
ramp_node.color_ramp.elements[1].color = (*srgb('#5c3d27'), 1)
SX0, SX1, SY0, SY1 = 3.50, 3.86, 1.84, 2.64
shelf_parts = [rounded_box('side', (SX0, y0, 0.0075), (SX1, y1, 2.8), 0.004, 0, walnut)
               for y0, y1 in ((SY0, SY0 + 0.028), (SY1 - 0.028, SY1))]
shelf_parts.append(rounded_box('kick', (SX0 + 0.02, SY0 + 0.028, 0.0075), (SX0 + 0.04, SY1 - 0.028, 0.09), 0.003, 0, walnut))
cloth = [textured(f'book_{i}', srgb(c), 300, 0.08, 0.8, 0.1) for i, c in enumerate(
    ('#2f4a3c', '#7a3b2a', '#26364f', '#c9bea4', '#6b6b63', '#a07a3c', '#4a2f2a', '#d8d0bd'))]
levels = [0.09 + i * 0.45 for i in range(6)] + [2.772]
for index, z in enumerate(levels):
    shelf_parts.append(rounded_box('board', (SX0, SY0 + 0.028, z), (SX1, SY1 - 0.028, z + 0.028), 0.003, 0, walnut))
    if index >= 6:
        continue
    y = SY0 + 0.04 + rng.uniform(0, 0.06)
    end = SY1 - 0.04 - rng.uniform(0.05, 0.22)
    while y < end:
        if rng.random() < 0.08 and y < end - 0.14:
            vase = lathe('vase', [(0.0, 0.0), (0.04, 0.0), (0.055, 0.06), (0.05, 0.13), (0.028, 0.17), (0.03, 0.19), (0.0, 0.19)], 32)
            vase.location = (SX0 + 0.17, y + 0.06, z + 0.028)
            vase.data.materials.append(textured('vase', srgb('#a9a397'), 120, 0.03, 0.4, 0.05))
            shelf_parts.append(vase)
            y += 0.14
            continue
        thick, tall, deep = rng.uniform(0.018, 0.05), rng.uniform(0.19, 0.31), rng.uniform(0.15, 0.23)
        lean = rng.uniform(-0.04, 0.04) if rng.random() < 0.8 else 0.18
        book = rounded_box('book', (SX0 + 0.03, y, z + 0.028), (SX0 + 0.03 + deep, y + thick, z + 0.028 + tall), 0.0025, 0,
                           cloth[int(rng.integers(len(cloth)))], bevel_segments=1)
        pivot = Vector((SX0 + 0.03, y, z + 0.028))
        book.data.transform(Matrix.Translation(pivot) @ Matrix.Rotation(lean, 4, 'X') @ Matrix.Translation(-pivot))
        shelf_parts.append(book)
        y += thick + 0.002 + (tall * math.sin(lean) if lean > 0.1 else 0)
bookshelf = join('bookshelf', shelf_parts)

# --- Sofa: plinth on oak feet, rounded arms/back, sagging seat and back cushions. ------
fabric = textured('fabric', srgb('#42463d'), 5, 0.18, 1.0, 0.25)
add_woven_surface(fabric,.009)
accent = textured('cushion', srgb('#697057'), 5, 0.2, 1.0, 0.2)
add_woven_surface(accent,.009)
feet = principled('sofa_feet', srgb('#4b3220'), 0.5)
X0, X1, Y0, Y1 = 2.79, 3.69, -1.35, 1.05
sofa_parts = []
for x in (X0 + 0.07, X1 - 0.07):
    for y in (Y0 + 0.07, Y1 - 0.07):
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.018, radius2=0.025, depth=0.1, location=(x, y, 0.0575))
        foot = bpy.context.active_object
        foot.data.materials.append(feet)
        smooth(foot)
        sofa_parts.append(foot)
sofa_parts.append(rounded_box('plinth', (X0 + 0.02, Y0 + 0.02, 0.1), (X1 - 0.01, Y1 - 0.02, 0.31), 0.03, 1, fabric))
for y0, y1 in ((Y0, Y0 + 0.19), (Y1 - 0.19, Y1)):
    sofa_parts.append(rounded_box('arm', (X0, y0, 0.1), (X1, y1, 0.64), 0.07, 1, fabric))
sofa_parts.append(rounded_box('back', (X1 - 0.21, Y0 + 0.17, 0.28), (X1, Y1 - 0.17, 0.84), 0.07, 1, fabric))


def cushion(name, lo, hi, radius, mat, sag=0.0, lean=0.0):
    obj = rounded_box(name, lo, hi, radius, 1, mat)
    # The bounds and rotation pivots below are world coordinates.
    obj.data.transform(obj.matrix_world);obj.matrix_world.identity()
    lo, hi = Vector(lo), Vector(hi)
    centre, half = (lo + hi) / 2, (hi - lo) / 2
    for vertex in obj.data.vertices:
        p = vertex.co
        fx, fy = (p.x - centre.x) / half.x, (p.y - centre.y) / half.y
        fall = max(0.0, 1 - fx * fx) * max(0.0, 1 - fy * fy)
        if p.z > centre.z:
            p.z -= sag * fall * (p.z - centre.z) / half.z
        p.x += 0.006 * math.sin(fy * 9.0 + fx * 2.0) * max(0.0, 1 - abs(fy))  # gentle creasing
    if lean:
        obj.data.transform(Matrix.Translation(Vector((hi.x, centre.y, lo.z))) @ Matrix.Rotation(lean, 4, 'Y')
                           @ Matrix.Translation(-Vector((hi.x, centre.y, lo.z))))
    return obj


seat_split = (Y0 + 0.19 + Y1 - 0.19) / 2
for y0, y1 in ((Y0 + 0.19, seat_split - 0.004), (seat_split + 0.004, Y1 - 0.19)):
    sofa_parts.append(cushion('seat', (X0 + 0.03, y0, 0.31), (X1 - 0.2, y1, 0.48), 0.06, fabric, sag=0.022))
    sofa_parts.append(cushion('back_cushion', (X1 - 0.42, y0 + 0.01, 0.47), (X1 - 0.2, y1 - 0.01, 0.95), 0.08, fabric, sag=0.0, lean=-0.17))
pillow = cushion('pillow', (3.2, 0.62, 0.47), (3.33, 1.06, 0.88), 0.08, accent, sag=0.0)
pillow.data.transform(Matrix.Translation(Vector((3.27, 0.84, 0.47))) @ Matrix.Rotation(-0.35, 4, 'Y')
                      @ Matrix.Rotation(0.3, 4, 'Z') @ Matrix.Translation(-Vector((3.27, 0.84, 0.47))))
pillow.location += Vector((0.0, -0.06, 0.0))
sofa_parts.append(pillow)
sofa = join('sofa', sofa_parts)

# --- Lighting: warm lamp, cool dusk window and a soft warm ceiling wash. --------------
window = bpy.data.lights.new('window', 'AREA')
window.shape = 'RECTANGLE'
window.size, window.size_y = 4.0, 2.2
window.energy = 70
window.color = (0.42, 0.52, 0.78)
window_obj = link(bpy.data.objects.new('window_light', window))
window_obj.location = (0, 2.70, 1.84)
window_obj.rotation_euler = (math.radians(90), 0, 0)
ceiling = bpy.data.lights.new('ceiling', 'AREA')
ceiling.size = 2.6
ceiling.energy = 95
ceiling.color = (1.0, 0.82, 0.62)
ceiling_obj = link(bpy.data.objects.new('ceiling_light', ceiling))
ceiling_obj.location = (-0.6, 0.2, 3.1)

if '--inspect' in ARGS:
    for obj in (table, plant, floor_plant, bookshelf, sofa, lamp_body, lamp_shade):
        obj.data.calc_loop_triangles()
        print('GEOMETRY', obj.name, 'vertices', len(obj.data.vertices),
              'triangles', len(obj.data.loop_triangles), flush=True)
    sys.exit(0)

if PREVIEW:
    camera = link(bpy.data.objects.new('camera', bpy.data.cameras.new('camera')))
    camera.data.sensor_fit = 'VERTICAL'
    camera.data.angle = math.radians(52)
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    for label, eye, target in (('contact', three(1.37, 1.47, -0.65), three(2.15, 0.73, -1.34)),
                               ('room', three(0, 1.65, 3.55), three(1.6, 0.8, -1.2))):
        camera.location = eye
        camera.rotation_euler = (target - eye).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(OUT / f'preview-{label}.png')
        bpy.ops.render.render(write_still=True)
    sys.exit(0)

# --- Bake ----------------------------------------------------------------------------
scene.cycles.use_denoising = False
scene.render.bake.margin = 6
scene.render.bake.use_clear = True


def lightmap_uv(obj, margin=0.004):
    prepare_lightmap_uv(obj,select_only,margin)


def bake(obj, size, passes, samples=256):
    scene.cycles.samples = 48 if '--fast' in ARGS else samples
    image = bpy.data.images.new(obj.name + '_bake', size, size, float_buffer=True)
    for slot in obj.material_slots:
        tree, _ = nodes(slot.material)
        node = tree.new('ShaderNodeTexImage')
        node.image = image
        tree.active = node
    select_only(obj)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter=passes, margin=6, use_clear=True)
    for slot in obj.material_slots:
        tree, _ = nodes(slot.material)
        tree.remove(tree.active)
    return np.array(image.pixels[:], dtype=np.float32).reshape(size, size, 4)


def blur(values, radius=2):
    out = values.copy()
    for axis in (0, 1):
        out = sum(np.roll(out, shift, axis=axis) for shift in range(-radius, radius + 1)) / (2 * radius + 1)
    return out


def encode(linear):
    linear = np.clip(linear, 0, 1)
    return np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - 0.055)


def save(name, rgb, alpha=None):
    size = rgb.shape[0]
    image = bpy.data.images.new(name, size, size, alpha=False)
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[..., :3] = rgb
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(OUT / f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    return image


baked = {}
surfaces = {}
for obj, size, samples in ((table, 1024, 320), (plant, 1024, 256), (floor_plant, 1024, 224), (bookshelf, 1536, 160), (sofa, 1536, 192)):
    print('BAKING', obj.name, size, samples, flush=True)
    lightmap_uv(obj, 0.003 if obj is sofa else 0.004)
    baked[obj.name] = bake(obj, size, {'DIRECT', 'INDIRECT', 'COLOR'}, samples)[..., :3]
    surfaces[obj.name]=capture_surface_maps(obj,OUT,256)
EXPOSURE = 4.0
print('BAKE exposure', EXPOSURE)

# Shadow ratio decals: furniture's darkening of floor/walls, applied over the live room.
furniture = [table, plant, floor_plant, bookshelf, sofa, lamp_body, lamp_shade, bulb]
decals = []
for name, lo, hi, axis in (('floor_shadow', (1.2, -1.6), (3.965, 2.72), 'z'),
                           ('wall_right_shadow', (-1.6, 0.0), (2.72, 3.18), 'x'),
                           ('wall_back_shadow', (2.05, 0.0), (3.965, 3.18), 'y')):
    (a0, b0), (a1, b1) = lo, hi
    bm = bmesh.new()
    if axis == 'z':
        corners = [(a0, b0, 0.0095), (a1, b0, 0.0095), (a1, b1, 0.0095), (a0, b1, 0.0095)]
    elif axis == 'x':
        corners = [(3.968, a0, b0), (3.968, a1, b0), (3.968, a1, b1), (3.968, a0, b1)][::-1]
    else:
        corners = [(a0, 2.723, b0), (a1, 2.723, b0), (a1, 2.723, b1), (a0, 2.723, b1)]
    face = bm.faces.new([bm.verts.new(c) for c in corners])
    uv = bm.loops.layers.uv.new('bake')
    for loop, coord in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = coord
    decal = mesh_object(name, bm)
    decal.data.materials.append(proxy_floor if axis == 'z' else proxy_wall)
    with_furniture = bake(decal, 512, {'DIRECT', 'INDIRECT'})[..., :3].mean(axis=2)
    for obj in furniture:
        obj.hide_render = True
    without = bake(decal, 512, {'DIRECT', 'INDIRECT'})[..., :3].mean(axis=2)
    for obj in furniture:
        obj.hide_render = False
    lit, unlit = blur(with_furniture, 3), blur(without, 3)
    # Surfaces dark in both passes (e.g. under the bookshelf proxy) are not furniture shadow.
    ratio = np.where(unlit > 1e-3, np.clip(lit / np.maximum(unlit, 1e-4), 0, 1), 1.0)
    # Stored as black-with-alpha: framebuffer blending happens on sRGB-encoded values.
    alpha = 1 - np.power(ratio, 1 / 2.2)
    # Feather the decal border so it never leaves a visible edge on the live surface.
    ramp = np.clip(np.minimum(np.arange(512), np.arange(512)[::-1]) / 28.0, 0, 1)
    alpha *= np.minimum.outer(ramp, ramp)
    decals.append((decal, save(name, np.repeat(alpha[..., None], 3, axis=2))))
    decal.data.materials.clear()

# --- Export ---------------------------------------------------------------------------
for obj in (table, plant, floor_plant, bookshelf, sofa):
    image = save(obj.name, encode(baked[obj.name] * EXPOSURE))
    obj.data.materials.clear()
    mat = principled('baked_' + obj.name, (1, 1, 1), 1.0)
    tree, links = nodes(mat)
    node = tree.new('ShaderNodeTexImage')
    node.image = image
    links.new(node.outputs['Color'], tree.get('Principled BSDF').inputs['Base Color'])
    attach_surface_maps(obj,mat,surfaces[obj.name])
    obj.data.materials.append(mat)
for decal, image in decals:
    mat = principled('decal_' + decal.name, (1, 1, 1), 1.0)
    tree, links = nodes(mat)
    node = tree.new('ShaderNodeTexImage')
    node.image = image
    links.new(node.outputs['Color'], tree.get('Principled BSDF').inputs['Base Color'])
    decal.data.materials.append(mat)
lamp = join('lamp_copper', [lamp_body, lamp_shade])
for obj in scene.objects:
    obj.select_set(obj in (table, plant, floor_plant, bookshelf, sofa, lamp, bulb, *[d for d, _ in decals]))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'contact-zone.glb'), export_format='GLB', use_selection=True,
                          export_image_format='WEBP', export_yup=True, export_apply=True,
                          export_lights=False, export_cameras=False)
print('EXPORTED', OUT / 'contact-zone.glb')
