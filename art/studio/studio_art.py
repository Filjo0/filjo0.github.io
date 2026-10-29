"""Shared Blender helpers for the studio's authored, Cycles-baked room zones.

Imported by zone scripts run headless with Blender 5.2, for example:
  blender -b --factory-startup --python art/studio/desk_zone.py -- <out_dir> [--preview|--fast|--gpu|--inspect]

Importing resets Blender to an empty Cycles scene. Coordinates: a Three.js point (x, y, z) is
Blender (x, -z, y); the glTF exporter converts back to the room's world coordinates.
The helpers are copied from contact_zone.py (which predates this module) so both zones share
materials, lighting and bake conventions.
"""
import math
import sys
from pathlib import Path

from surface_bake import organic_leaf_mesh, add_leaf_surface, prepare_lightmap_uv, capture_surface_maps, attach_surface_maps

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = Path(ARGS[0] if ARGS else '.').resolve()
PREVIEW = '--preview' in ARGS
SAMPLES = 64 if '--fast' in ARGS else 384
OUT.mkdir(parents=True, exist_ok=True)

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



def leaf_mesh(length, width):
    return organic_leaf_mesh(length,width)



def room_proxies():
    """Floor, ceiling and walls with the window opening: bounce light and occlusion only."""
    floor = principled('proxy_floor', srgb('#7c5d42'), 0.55)
    wall = principled('proxy_wall', srgb('#4b4740'), 0.95)
    for name, lo, hi, mat in [
        ('floor', (-4, -5.9, -0.1), (4, 2.73, 0.0075), floor),
        ('ceiling', (-4, -5.9, 3.18), (4, 2.73, 3.3), wall),
        ('wall_right', (3.97, -5.9, 0), (4.1, 2.8, 3.2), wall),
        ('wall_left', (-4.1, -5.9, 0), (-3.97, 2.8, 3.2), wall),
        ('wall_back_left', (-4, 2.725, 0), (-2, 2.85, 3.2), wall),
        ('wall_back_right', (2, 2.725, 0), (4, 2.85, 3.2), wall),
        ('wall_back_sill', (-2, 2.725, 0), (2, 2.85, 0.7), wall),
        ('wall_back_head', (-2, 2.725, 2.98), (2, 2.85, 3.2), wall),
        ('coffee_table', (-0.86, -0.51, 0), (0.86, 0.51, 0.4475), principled('proxy_coffee', srgb('#9a7552'), 0.6)),
    ]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(Vector(lo) + Vector(hi)) / 2)
        obj = bpy.context.active_object
        obj.name = 'proxy_' + name
        obj.scale = Vector(hi) - Vector(lo)
        obj.data.materials.append(mat)
    return floor, wall


def room_lights():
    """Cool dusk window and warm ceiling wash, matching the contact corner's bake."""
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
    link(bpy.data.objects.new('ceiling_light', ceiling)).location = (-0.6, 0.2, 3.1)


def dome_lamp(location, energy=38):
    """Copper dome lamp (the side-table lamp's profile) with a warm bulb light."""
    profile = [(0.0, 0.0), (0.072, 0.0), (0.076, 0.004), (0.076, 0.011), (0.07, 0.016), (0.012, 0.02),
               (0.0075, 0.03), (0.0075, 0.235), (0.011, 0.245), (0.011, 0.255), (0.0, 0.258)]
    body = lathe('lamp_body', profile)
    body.location = location
    shade_profile = [(0.0, 0.392)] + [(0.128 * math.sin(t), 0.25 + 0.142 * math.cos(t))
                                      for t in np.linspace(0.08, math.pi / 2, 18)] + [(0.13, 0.248), (0.126, 0.246)] + [
        (0.124 * math.sin(t), 0.25 + 0.138 * math.cos(t)) for t in np.linspace(math.pi / 2, 0.1, 14)] + [(0.0, 0.387)]
    shade = lathe('lamp_shade', shade_profile)
    shade.location = location
    copper = principled('copper', srgb('#b8774a'), 0.32, 1.0)
    for obj in (body, shade):
        obj.data.materials.append(copper)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.028, location=location + Vector((0, 0, 0.29)))
    bulb = bpy.context.active_object
    bulb.name = 'lamp_bulb'
    mat = principled('bulb', (1, 0.86, 0.66), 0.5)
    bsdf = nodes(mat)[0].get('Principled BSDF')
    bsdf.inputs['Emission Color'].default_value = (1, 0.78, 0.5, 1)
    bsdf.inputs['Emission Strength'].default_value = 6.0
    bulb.data.materials.append(mat)
    smooth(bulb, math.pi)
    light = bpy.data.lights.new('lamp', 'POINT')
    light.energy = energy
    light.color = (1.0, 0.72, 0.43)
    light.shadow_soft_size = 0.025
    link(bpy.data.objects.new('lamp_light', light)).location = location + Vector((0, 0, 0.29))
    return body, shade, bulb


def preview(views):
    camera = link(bpy.data.objects.new('camera', bpy.data.cameras.new('camera')))
    camera.data.sensor_fit = 'VERTICAL'
    camera.data.angle = math.radians(52)
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    for label, eye, target in views:
        camera.location = eye
        camera.rotation_euler = (target - eye).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(OUT / f'preview-{label}.png')
        bpy.ops.render.render(write_still=True)


def inspect(objects):
    for obj in objects:
        obj.data.calc_loop_triangles()
        print('GEOMETRY', obj.name, 'vertices', len(obj.data.vertices),
              'triangles', len(obj.data.loop_triangles), flush=True)


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


def save(name, rgb):
    size = rgb.shape[0]
    image = bpy.data.images.new(name, size, size, alpha=False)
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[..., :3] = rgb
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(OUT / f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    return image


def image_material(name, image):
    mat = principled(name, (1, 1, 1), 1.0)
    tree, links = nodes(mat)
    node = tree.new('ShaderNodeTexImage')
    node.image = image
    links.new(node.outputs['Color'], tree.get('Principled BSDF').inputs['Base Color'])
    return mat


EXPOSURE = 4.0  # The contact corner's fixed exposure, so zones match at runtime.


def bake_and_export(glb_name, baked_objects, occluders, decal_specs, live_objects, floor_mat, wall_mat):
    """Bake lightmaps and shadow-ratio decals, then export baked and live meshes as one GLB.

    decal_specs: (name, corners), four Blender points ordered counter-clockwise as seen
    from the room, so each decal faces into it.
    """
    scene.cycles.use_denoising = False
    scene.render.bake.margin = 6
    scene.render.bake.use_clear = True
    baked = {}
    surfaces = {}
    for obj, size, samples in baked_objects:
        print('BAKING', obj.name, size, samples, flush=True)
        lightmap_uv(obj, 0.003 if size > 1024 else 0.004)
        baked[obj.name] = bake(obj, size, {'DIRECT', 'INDIRECT', 'COLOR'}, samples)[..., :3]
        surfaces[obj.name]=capture_surface_maps(obj,OUT,256)
    decals = []
    for name, corners in decal_specs:
        print('BAKING', name, flush=True)
        bm = bmesh.new()
        face = bm.faces.new([bm.verts.new(c) for c in corners])
        uv = bm.loops.layers.uv.new('bake')
        for loop, coord in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = coord
        on_floor = abs(face.normal.z) > 0.5
        decal = mesh_object(name, bm)
        decal.data.materials.append(floor_mat if on_floor else wall_mat)
        with_furniture = bake(decal, 512, {'DIRECT', 'INDIRECT'})[..., :3].mean(axis=2)
        for obj in occluders:
            obj.hide_render = True
        without = bake(decal, 512, {'DIRECT', 'INDIRECT'})[..., :3].mean(axis=2)
        for obj in occluders:
            obj.hide_render = False
        lit, unlit = blur(with_furniture, 3), blur(without, 3)
        # Surfaces dark in both passes are not furniture shadow.
        ratio = np.where(unlit > 1e-3, np.clip(lit / np.maximum(unlit, 1e-4), 0, 1), 1.0)
        # Black-with-alpha decal: framebuffer blending happens on sRGB-encoded values.
        alpha = 1 - np.power(ratio, 1 / 2.2)
        # Feather the border so the decal never leaves an edge on the live surface.
        ramp = np.clip(np.minimum(np.arange(512), np.arange(512)[::-1]) / 28.0, 0, 1)
        alpha *= np.minimum.outer(ramp, ramp)
        decal.data.materials.clear()
        decal.data.materials.append(image_material('decal_' + name, save(name, np.repeat(alpha[..., None], 3, axis=2))))
        decals.append(decal)
    for obj, _, _ in baked_objects:
        image = save(obj.name, encode(baked[obj.name] * EXPOSURE))
        obj.data.materials.clear()
        mat=image_material('baked_' + obj.name, image)
        attach_surface_maps(obj,mat,surfaces[obj.name])
        obj.data.materials.append(mat)
    exported = [obj for obj, _, _ in baked_objects] + list(live_objects) + decals
    for obj in scene.objects:
        obj.select_set(obj in exported)
    bpy.ops.export_scene.gltf(filepath=str(OUT / glb_name), export_format='GLB', use_selection=True,
                              export_image_format='WEBP', export_yup=True, export_apply=True,
                              export_lights=False, export_cameras=False)
    print('EXPORTED', OUT / glb_name, flush=True)
