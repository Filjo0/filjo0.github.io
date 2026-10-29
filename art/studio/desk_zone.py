"""Original desk-zone artwork: oak desk, monitor housing, keyboard, office chair, lamp, plants, ball.

Run headless:  blender -b --factory-startup --python art/studio/desk_zone.py -- <out_dir> [--preview|--fast|--gpu|--inspect]

The monitor's screen and the resume folio stay live in room.js (projected HTML and
pickup); this zone supplies the static furniture around them, baked with the contact
corner's lights and exposure (see studio_art.py).
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from studio_art import *  # noqa: E402,F401,F403  (resets Blender to an empty Cycles scene)

rng = np.random.default_rng(11)
floor_mat, wall_mat = room_proxies()
room_lights()

TOP = 0.838  # desk surface; the live folio rests on it
X0, X1, Y0, Y1 = -3.725, -1.375, 1.27, 2.17

# --- Desk: oak slab on a powder-coated steel trestle frame. ----------------------------
steel = principled('steel', srgb('#1f2122'), 0.55)
desk_parts = [rounded_box('top', (X0, Y0, TOP - 0.035), (X1, Y1, TOP), 0.006, 0, oak('oak_desk'), 3)]
for x in (X0 + 0.1, X1 - 0.1):
    for y in (Y0 + 0.08, Y1 - 0.08):
        desk_parts.append(rounded_box('leg', (x - 0.02, y - 0.02, 0.0075), (x + 0.02, y + 0.02, TOP - 0.035), 0.004, 0, steel, 2))
    desk_parts.append(rounded_box('rail', (x - 0.02, Y0 + 0.06, TOP - 0.075), (x + 0.02, Y1 - 0.06, TOP - 0.035), 0.004, 0, steel, 2))
    desk_parts.append(rounded_box('foot', (x - 0.02, Y0 + 0.06, 0.0075), (x + 0.02, Y1 - 0.06, 0.045), 0.004, 0, steel, 2))
desk_parts.append(rounded_box('stretcher', (X0 + 0.1, Y1 - 0.1, 0.68), (X1 - 0.1, Y1 - 0.06, 0.72), 0.004, 0, steel, 2))

# Felt mat, low-profile keyboard and mouse in front of the monitor.
felt = textured('felt', srgb('#3a3b3a'), 700, 0.25, 1.0, 0.1)
desk_parts.append(rounded_box('mat', (-3.10, 1.36, TOP), (-2.30, 1.70, TOP + 0.003), 0.012, 0, felt, 2))
KB_X, KB_Y, KB_Z = -2.80, 1.545, TOP + 0.003
case = principled('keyboard_case', srgb('#2b2d2f'), 0.45)
caps = principled('keycaps', srgb('#3a3c3f'), 0.6)
light_caps = principled('keycaps_light', srgb('#c9c3b6'), 0.6)
keyboard = [rounded_box('case', (KB_X - 0.215, KB_Y - 0.065, KB_Z), (KB_X + 0.215, KB_Y + 0.065, KB_Z + 0.014), 0.006, 0, case, 2)]
for row in range(5):
    col = 0
    while col < 15:
        width = 7 if (row == 0 and col == 4) else 1
        x = KB_X - 0.2 + col * 0.0268
        y = KB_Y - 0.052 + row * 0.0255
        keyboard.append(rounded_box('key', (x, y, KB_Z + 0.014), (x + 0.0268 * width - 0.004, y + 0.0215, KB_Z + 0.022),
                                    0.003, 0, light_caps if (row == 4 and col in (0, 14)) else caps, 2))
        col += width
keyboard_obj = join('keyboard', keyboard)
keyboard_obj.data.transform(Matrix.Translation(Vector((0, KB_Y + 0.065, KB_Z))) @ Matrix.Rotation(0.05, 4, 'X')
                            @ Matrix.Translation(-Vector((0, KB_Y + 0.065, KB_Z))))
desk_parts.append(keyboard_obj)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(-2.43, 1.53, TOP + 0.003))
mouse = bpy.context.active_object
mouse.scale = (0.032, 0.056, 0.018)
select_only(mouse)
bpy.ops.object.transform_apply(scale=True)
for vertex in mouse.data.vertices:
    vertex.co.z = max(vertex.co.z, 0.0) + (0.004 if vertex.co.z > 0 else 0)
mouse.data.materials.append(case)
smooth(mouse, math.pi)
desk_parts.append(mouse)

# Monitor housing and stand. The live screen plane sits 4.5 mm in front of the bezel.
M_X, M_Z, M_FRONT = -2.68, 1.35, 2.0875
bezel = principled('bezel', srgb('#141617'), 0.35)
aluminium = principled('aluminium', srgb('#8f9294'), 0.4)
desk_parts.append(rounded_box('bezel', (M_X - 0.68, M_FRONT, M_Z - 0.395), (M_X + 0.68, M_FRONT + 0.018, M_Z + 0.395), 0.008, 0, bezel, 3))
desk_parts.append(rounded_box('housing', (M_X - 0.56, M_FRONT + 0.018, M_Z - 0.3), (M_X + 0.56, M_FRONT + 0.05, M_Z + 0.26), 0.03, 1, bezel))
desk_parts.append(rounded_box('neck', (M_X - 0.03, M_FRONT + 0.05, TOP + 0.008), (M_X + 0.03, M_FRONT + 0.072, M_Z - 0.05), 0.008, 0, aluminium, 3))
desk_parts.append(rounded_box('base', (M_X - 0.13, M_FRONT - 0.06, TOP), (M_X + 0.13, M_FRONT + 0.11, TOP + 0.008), 0.004, 0, aluminium, 3))
desk = join('desk', desk_parts)

# Screen glow: an emissive stand-in for the live code screen lights the keys and desk.
bpy.ops.mesh.primitive_plane_add(size=1, location=(M_X, M_FRONT - 0.0045, M_Z), rotation=(math.radians(90), 0, 0))
screen = bpy.context.active_object
screen.scale = (1.32, 0.75, 1)
glow = principled('screen_glow', srgb('#16302f'), 0.2)
glow_bsdf = nodes(glow)[0].get('Principled BSDF')
glow_bsdf.inputs['Emission Color'].default_value = (0.18, 0.36, 0.38, 1)
glow_bsdf.inputs['Emission Strength'].default_value = 2.2
screen.data.materials.append(glow)

# --- Office chair: five-star base on casters, gas lift, seat, mesh back and arms. -------
C_X, C_Y = -2.65, 0.64
plastic = principled('chair_plastic', srgb('#1c1d1f'), 0.5)
steel_light = principled('chair_steel', srgb('#8a8c8e'), 0.35)
seat_fabric = textured('chair_fabric', srgb('#2e3032'), 900, 0.3, 1.0, 0.12)
mesh_fabric = textured('chair_mesh', srgb('#26282a'), 1400, 0.45, 1.0, 0.2)
chair_parts = []
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.045, depth=0.05, location=(C_X, C_Y, 0.115))
chair_parts.append(bpy.context.active_object)
chair_parts[-1].data.materials.append(plastic)
for k in range(5):
    angle = k * math.tau / 5 + 0.3
    leg = rounded_box('star', (0.0, -0.022, -0.016), (0.30, 0.022, 0.016), 0.008, 0, plastic, 3)
    leg.matrix_world=Matrix.Translation(Vector((C_X, C_Y, 0.11))) @ Matrix.Rotation(angle, 4, 'Z') @ Matrix.Rotation(0.12, 4, 'Y') @ leg.matrix_world
    chair_parts.append(leg)
    tip = Vector((C_X + math.cos(angle) * 0.29, C_Y + math.sin(angle) * 0.29, 0.0))
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.026, depth=0.032, location=tip + Vector((0, 0, 0.034)),
                                        rotation=(0, math.radians(90), angle + math.pi / 2))
    chair_parts.append(bpy.context.active_object)
    chair_parts[-1].data.materials.append(plastic)
    chair_parts.append(rounded_box('fork', tip + Vector((-0.012, -0.012, 0.045)), tip + Vector((0.012, 0.012, 0.075)), 0.004, 0, plastic, 2))
for radius, z0, z1, mat in ((0.022, 0.13, 0.36, steel_light), (0.03, 0.34, 0.44, plastic)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=z1 - z0, location=(C_X, C_Y, (z0 + z1) / 2))
    chair_parts.append(bpy.context.active_object)
    chair_parts[-1].data.materials.append(mat)
chair_parts.append(rounded_box('mechanism', (C_X - 0.11, C_Y - 0.1, 0.43), (C_X + 0.11, C_Y + 0.1, 0.47), 0.01, 0, plastic, 3))


def cushion(name, lo, hi, radius, mat, sag):
    obj = rounded_box(name, lo, hi, radius, 1, mat)
    # The bounds and rotation pivots below are world coordinates.
    obj.data.transform(obj.matrix_world);obj.matrix_world.identity()
    lo, hi = Vector(lo), Vector(hi)
    centre, half = (lo + hi) / 2, (hi - lo) / 2
    for vertex in obj.data.vertices:
        p = vertex.co
        fall = max(0.0, 1 - ((p.x - centre.x) / half.x) ** 2) * max(0.0, 1 - ((p.y - centre.y) / half.y) ** 2)
        if p.z > centre.z:
            p.z -= sag * fall * (p.z - centre.z) / half.z
    return obj


chair_parts.append(cushion('seat', (C_X - 0.25, C_Y - 0.23, 0.47), (C_X + 0.25, C_Y + 0.25, 0.545), 0.035, seat_fabric, 0.012))
# Actual open mesh rather than an opaque black rectangle.
back=[]
for i in range(61):
    x=C_X-.205+i*.0068333
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.00055,depth=.525,location=(x,.377,.915))
    strand=bpy.context.active_object;strand.data.materials.append(mesh_fabric);back.append(strand)
for i in range(77):
    z=.65+i*.0069
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.00055,depth=.42,location=(C_X,.378,z),rotation=(0,math.pi/2,0))
    strand=bpy.context.active_object;strand.data.materials.append(mesh_fabric);back.append(strand)
for lo, hi in (((C_X - 0.245, 0.36, 0.62), (C_X - 0.215, 0.395, 1.2)), ((C_X + 0.215, 0.36, 0.62), (C_X + 0.245, 0.395, 1.2)),
               ((C_X - 0.245, 0.36, 1.17), (C_X + 0.245, 0.395, 1.205)), ((C_X - 0.245, 0.36, 0.615), (C_X + 0.245, 0.395, 0.65))):
    back.append(rounded_box('back_frame', lo, hi, 0.012, 0, plastic, 3))
back.append(rounded_box('spine', (C_X - 0.025, 0.38, 0.45), (C_X + 0.025, 0.41, 0.66), 0.008, 0, plastic, 2))
for part in back:
    part.matrix_world=Matrix.Translation(Vector((C_X, 0.4, 0.55))) @ Matrix.Rotation(0.13, 4, 'X') @ Matrix.Translation(-Vector((C_X, 0.4, 0.55))) @ part.matrix_world
chair_parts += back
for x in (C_X - 0.27, C_X + 0.27):
    chair_parts.append(rounded_box('arm_post', (x - 0.015, C_Y - 0.03, 0.47), (x + 0.015, C_Y + 0.03, 0.68), 0.008, 0, plastic, 2))
    chair_parts.append(rounded_box('arm_pad', (x - 0.035, C_Y - 0.13, 0.68), (x + 0.035, C_Y + 0.11, 0.705), 0.01, 0, plastic, 3))
for part in chair_parts:
    smooth(part, 0.7)
chair = join('chair', chair_parts)

# --- Desk lamp, desk pothos, window-side floor plant and a futsal ball. -----------------
lamp_body, lamp_shade, bulb = dome_lamp(Vector((-3.55, 1.95, TOP)), energy=34)
leaf_mats = [textured(f'leaf_{i}', srgb(c), 35, 0.02, 0.5, 0.08) for i, c in enumerate(('#2f5b2e', '#3d6b35', '#4d7a3c'))]
for mat in leaf_mats:add_leaf_surface(mat)
stem_mat = principled('stem', srgb('#4f6a37'), 0.6)


def stem(base, tip, handle_start, handle_end, depth):
    curve = bpy.data.curves.new('stem', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = depth
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(1)
    for point, position, handle in ((spline.bezier_points[0], base, handle_start), (spline.bezier_points[1], tip, handle_end)):
        point.co, point.handle_left, point.handle_right = position, position - handle, position + handle
    obj = link(bpy.data.objects.new('stem', curve))
    obj.data.materials.append(stem_mat)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.active_object


def add_leaf(at, yaw, size, droop, mats, index):
    leaf = link(bpy.data.objects.new('leaf', leaf_mesh(size, size * 0.25)))
    leaf.matrix_world = (Matrix.Translation(at) @ Matrix.Rotation(yaw - math.pi / 2, 4, 'Z')
                         @ Matrix.Rotation(-droop, 4, 'X') @ Matrix.Rotation(rng.uniform(-0.5, 0.5), 4, 'Y'))
    leaf.data.materials.append(mats[index % 3])
    smooth(leaf, math.pi)
    return leaf


POT = Vector((-3.55, 1.42, TOP))
pot = lathe('pot', [(0.0, 0.004), (0.046, 0.0), (0.05, 0.004), (0.06, 0.06), (0.067, 0.116), (0.071, 0.122),
                    (0.07, 0.127), (0.064, 0.126), (0.06, 0.118), (0.054, 0.06), (0.04, 0.03)])
pot.location = POT
pot.data.materials.append(textured('ceramic', srgb('#3c4a46'), 90, 0.05, 0.6, 0.06))
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.061, depth=0.004, location=POT + Vector((0, 0, 0.108)))
soil = bpy.context.active_object
soil_mat = textured('soil', srgb('#2e2219'), 260, 0.5, 1.0, 0.3)
soil.data.materials.append(soil_mat)
plant_parts = [pot, soil]
for i in range(26):
    yaw = i * 2.39996 + rng.uniform(-0.2, 0.2)
    reach = rng.uniform(0.03, 0.12)
    rise = rng.uniform(0.02, 0.13) - (0.11 if reach > 0.095 else 0)
    base = POT + Vector((rng.uniform(-0.02, 0.02), rng.uniform(-0.02, 0.02), 0.11))
    tip = base + Vector((math.cos(yaw) * reach, math.sin(yaw) * reach, rise))
    plant_parts.append(stem(base, tip, Vector((0, 0, 0.06)), Vector((math.cos(yaw), math.sin(yaw), -0.3)) * 0.05, 0.0012))
    plant_parts.append(add_leaf(tip, yaw, rng.uniform(0.065, 0.1), rng.uniform(0.35, 0.95), leaf_mats, i))
desk_plant = join('desk_plant', plant_parts)

PLANTER = Vector((-1.65, 2.45, 0.0075))
planter = lathe('planter', [(0.0, 0.004), (0.17, 0.0), (0.18, 0.012), (0.235, 0.43), (0.25, 0.445), (0.247, 0.455),
                            (0.232, 0.452), (0.222, 0.43), (0.16, 0.06)])
planter.location = PLANTER
planter.data.materials.append(textured('planter', srgb('#b3aa9a'), 60, 0.12, 0.85, 0.08))
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.222, depth=0.006, location=PLANTER + Vector((0, 0, 0.405)))
planter_soil = bpy.context.active_object
planter_soil.data.materials.append(soil_mat)
big_leaf = [textured(f'big_leaf_{i}', srgb(c), 18, 0.03, 0.45, 0.07) for i, c in enumerate(('#2c4f2a', '#355c30', '#41683a'))]
big_parts = [planter, planter_soil]
for mat in big_leaf:add_leaf_surface(mat)
for s_index in range(8):
    yaw = s_index * 0.8 + rng.uniform(-0.25, 0.25)
    lean = rng.uniform(0.06, 0.26)
    height = rng.uniform(0.85, 1.55)
    base = PLANTER + Vector((math.cos(yaw) * 0.05, math.sin(yaw) * 0.05, 0.41))
    tip = base + Vector((math.cos(yaw) * height * lean, math.sin(yaw) * height * lean, height))
    big_parts.append(stem(base, tip, Vector((0, 0, height * 0.3)), (tip - base).normalized() * height * 0.25, 0.006))
    for k in range(8):
        t = 0.3 + k * 0.1
        big_parts.append(add_leaf(base.lerp(tip, t), yaw + rng.uniform(-1.6, 1.6), rng.uniform(0.22, 0.33) * (1.15 - 0.3 * t),
                                  rng.uniform(0.5, 1.4), big_leaf, s_index + k))
floor_plant = join('floor_plant_left', big_parts)

# Futsal ball: low-bounce size-4 ball with stitched panels and a few rust panels.
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.099, location=(-3.15, -0.05, 0.1065))
ball = bpy.context.active_object
ball.name = 'futsal_ball'
smooth(ball, math.pi)
ball_mat = principled('ball', srgb('#e4e0d6'), 0.5)
tree, links = nodes(ball_mat)
bsdf = tree.get('Principled BSDF')
coord = tree.new('ShaderNodeTexCoord')
cells = tree.new('ShaderNodeTexVoronoi')
cells.inputs['Scale'].default_value = 3.2
edges = tree.new('ShaderNodeTexVoronoi')
edges.feature = 'DISTANCE_TO_EDGE'
edges.inputs['Scale'].default_value = 3.2
seam = tree.new('ShaderNodeMapRange')
seam.inputs['From Min'].default_value = 0.0
seam.inputs['From Max'].default_value = 0.035
pick = tree.new('ShaderNodeSeparateColor')
accent = tree.new('ShaderNodeMath')
accent.operation = 'GREATER_THAN'
accent.inputs[1].default_value = 0.72
panel = tree.new('ShaderNodeMix')
panel.data_type = 'RGBA'
panel.inputs['A'].default_value = (*srgb('#e4e0d6'), 1)
panel.inputs['B'].default_value = (*srgb('#b0532c'), 1)
stitched = tree.new('ShaderNodeMix')
stitched.data_type = 'RGBA'
stitched.blend_type = 'MULTIPLY'
stitched.inputs['Factor'].default_value = 1.0
bump = tree.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.4
for a, b in ((coord.outputs['Object'], cells.inputs['Vector']), (coord.outputs['Object'], edges.inputs['Vector']),
             (edges.outputs['Distance'], seam.inputs['Value']), (cells.outputs['Color'], pick.inputs['Color']),
             (pick.outputs['Red'], accent.inputs[0]), (accent.outputs['Value'], panel.inputs['Factor']),
             (panel.outputs['Result'], stitched.inputs['A']), (seam.outputs['Result'], stitched.inputs['B']),
             (stitched.outputs['Result'], bsdf.inputs['Base Color']), (seam.outputs['Result'], bump.inputs['Height']),
             (bump.outputs['Normal'], bsdf.inputs['Normal'])):
    links.new(a, b)
ball.data.materials.append(ball_mat)

baked_objects = [(desk, 1536, 256), (chair, 1024, 256), (desk_plant, 512, 256), (floor_plant, 1024, 224), (ball, 512, 256)]

if '--inspect' in ARGS:
    inspect([obj for obj, _, _ in baked_objects] + [lamp_body, lamp_shade])
    sys.exit(0)

if PREVIEW:
    preview((('desk', three(-2.68, 1.36, -0.95), three(-2.68, 1.0, -2.12)),
             ('room', three(0, 1.65, 3.55), three(-2.2, 0.8, -1.4))))
    sys.exit(0)

lamp = join('lamp_copper', [lamp_body, lamp_shade])
occluders = [obj for obj, _, _ in baked_objects] + [lamp, bulb]
decal_specs = [
    ('desk_floor_shadow', [(-3.965, -0.55, 0.0095), (-1.1, -0.55, 0.0095), (-1.1, 2.72, 0.0095), (-3.965, 2.72, 0.0095)]),
    ('wall_left_shadow', [(-3.968, -0.55, 0.0), (-3.968, 2.72, 0.0), (-3.968, 2.72, 3.18), (-3.968, -0.55, 3.18)]),
    ('wall_back_left_shadow', [(-3.965, 2.723, 0.0), (-2.05, 2.723, 0.0), (-2.05, 2.723, 3.18), (-3.965, 2.723, 3.18)]),
]
bake_and_export('desk-zone.glb', baked_objects, occluders, decal_specs, [lamp, bulb], floor_mat, wall_mat)
