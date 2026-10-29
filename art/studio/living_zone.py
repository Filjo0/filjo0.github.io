"""Original full-room finish and personal details, sharing the existing Cycles palette.
Run: blender -b --factory-startup --python art/studio/living_zone.py -- <out_dir> --gpu
Live notebook, reading book, Fibonacci sketch, window and watering can stay in room.js.
"""
import sys
import math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from studio_art import *
from surface_bake import add_woven_surface

floor_mat, wall_mat = room_proxies()
room_lights()
bpy.data.objects.remove(bpy.data.objects['proxy_coffee_table'], do_unlink=True)
wood = oak('living_oak')
# Warm grey stone reflects the original render's restrained polished floor.
floor_wood = textured('polished_stone',srgb('#605b52'),3.5,.12,.42,.4)
bsdf=floor_wood.node_tree.nodes.get('Principled BSDF')
for n in floor_wood.node_tree.nodes:
    if n.bl_idname=='ShaderNodeBump':n.inputs['Distance'].default_value=.0005
walnut = oak('living_walnut')
cloth = textured('woven_linen', srgb('#3f493e'), 5, .15, .95, .25)
add_woven_surface(cloth,.009)
plaster = textured('warm_plaster', srgb('#65625d'), 5, .16, .95, .38)
for n in plaster.node_tree.nodes:
    if n.bl_idname=='ShaderNodeBump':n.inputs['Distance'].default_value=.002
charcoal = principled('soft_black', srgb('#242827'), .65)
paper = principled('paper', srgb('#e7dbc3'), .9)
ceramic = textured('ceramic', srgb('#395248'), 120, .05, .5, .06)

# Large, lightly staggered slabs: fine joints instead of high-contrast striped boards.
boards=[]
for i in range(8):
    x=-4+i
    for j in range(10):
        y=-6.4+j*.98+(i%2)*.49
        boards.append(rounded_box('slab',(x+.0004,y+.0004,.008),(x+.9996,y+.9796,.014),.0004,0,floor_wood,1))
floor=join('oak_floor',boards)
# Matched architecture uses the existing window aperture and wall coordinates.
walls = []
for obj in list(scene.objects):
    if obj.name.startswith('proxy_wall') or obj.name == 'proxy_ceiling':
        obj.data.materials.clear(); obj.data.materials.append(plaster)
        walls.append(obj)
architecture = join('plaster_shell', walls)
trim = []
for x in (-3.958, 3.958):
    trim.append(rounded_box('skirting', (x-.009, -5.85, .014), (x+.009, 2.72, .105), .003, 0, wood, 2))
trim.append(rounded_box('sill', (-2.03, 2.59, .675), (2.03, 2.84, .704), .006, 0, wood, 3))
for xa, xb in ((-3.97,-2.03),(2.03,3.97)):
    trim.append(rounded_box('skirting_back', (xa, 2.699, .014), (xb, 2.722, .105), .003, 0, wood, 2))
trim = join('oak_trim', trim)

# Low table, softly crowned linen ottoman, woven rug with bound edge and fringe.
parts = [rounded_box('tabletop', (-.86,-.51,.381), (.86,.51,.4475), .012, 0, wood, 4)]
for x in (-.7,.7):
    for y in (-.36,.36):
        parts.append(rounded_box('leg',(x-.027,y-.027,.014),(x+.027,y+.027,.397),.005,0,walnut,3))
for x in (-.7,.7):
    parts.append(rounded_box('apron',(x-.021,-.39,.328),(x+.021,.39,.387),.003,0,walnut,2))
table=join('coffee_table',parts)
rugmat=textured('rug_wool',srgb('#92785b'),4,.2,1,.25)
add_woven_surface(rugmat,.018,.0012)
rugparts=[rounded_box('rug',(-1.5,-1.95,.014),(1.5,.63,.026),.008,0,rugmat,2)]
for x in (-1.485,1.485):
    rugparts.append(rounded_box('binding',(x-.01,-1.94,.026),(x+.01,.62,.029),.002,0,cloth,2))
for y in (-1.95,.63):
    for i in range(88):
        x=-1.46+i*.033
        rugparts.append(rounded_box('fringe',(x-.003,y-.045,.016),(x+.003,y+.045,.02),.001,0,rugmat,1))
rug=join('woven_rug',rugparts)
ottoman=lathe('linen_ottoman',[(0,.03),(.36,.03),(.43,.06),(.455,.11),(.463,.29),(.45,.36),(.39,.39),(.2,.398),(0,.40)],64)
ottoman.location=(.9,-1.18,.014);ottoman.data.materials.append(cloth)
# Stitching follows the top, with a narrow fabric welt.
bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=8,location=(.9,-1.18,.37),major_radius=.437,minor_radius=.003)
welt=bpy.context.active_object;welt.data.materials.append(cloth)
ottoman=join('linen_ottoman',[ottoman,welt])

# Actual hollow mug with visible tea, coaster, book spines and a linen napkin.
props=[]
mug=lathe('tea_mug',[(0,0),(.035,0),(.039,.004),(.041,.073),(.04,.079),(.036,.08),(.035,.073),(.033,.009),(0,.009)],48)
mug.location=(.53,.15,.453);mug.data.materials.append(ceramic);props.append(mug)
bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,major_radius=.021,minor_radius=.005,location=(.57,.15,.495),rotation=(math.pi/2,0,0))
handle=bpy.context.active_object;handle.data.materials.append(ceramic);props.append(handle)
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.034,depth=.001,location=(.53,.15,.509))
tea=bpy.context.active_object;tea.data.materials.append(principled('tea',srgb('#4d2d14'),.16));props.append(tea)
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.057,depth=.003,location=(.53,.15,.449))
coaster=bpy.context.active_object;coaster.data.materials.append(textured('cork',srgb('#846549'),140,.25,.9,.2));props.append(coaster)
for i,c in enumerate(('#485d50','#b18c69','#c8b89b')):
    z=.449+i*.031
    cover=principled('cover_'+str(i),srgb(c),.7)
    props += [rounded_box('cover',(-.65,.17,z),(-.34,.40,z+.004),.002,0,cover,2),
              rounded_box('pages',(-.646,.174,z+.004),(-.344,.396,z+.026),.001,0,paper,2),
              rounded_box('cover',(-.65,.17,z+.026),(-.34,.40,z+.03),.002,0,cover,2)]
props.append(rounded_box('napkin',(.32,-.38,.449),(.58,-.22,.451),.008,0,cloth,2))
props=join('table_details',props)

# Cables and headphones make the desk occupied without blocking its live surfaces.
def cable(name,points,radius,mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=2
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points):
        p.co=co;p.handle_left_type=p.handle_right_type='AUTO'
    obj=link(bpy.data.objects.new(name,curve));obj.data.materials.append(mat)
    select_only(obj);bpy.ops.object.convert(target='MESH');return bpy.context.active_object
personal=[]
personal.append(cable('monitor_cable',[(-2.68,2.17,1.1),(-2.7,2.20,.75),(-2.9,2.22,.34),(-3.18,2.25,.04),(-3.7,2.4,.035)],.004,charcoal))
personal.append(cable('headband',[(-3.43,1.58,.855),(-3.48,1.63,.91),(-3.56,1.63,.92),(-3.61,1.58,.855)],.011,charcoal))
for x in (-3.43,-3.61):
    personal.append(rounded_box('earpad',(x-.025,1.53,.84),(x+.025,1.60,.865),.012,1,charcoal))
# A folded cardigan drapes across the chair back, with folds in a real cloth mesh.
bm=bmesh.new();grid=[]
for r in range(25):
    v=r/24
    row=[]
    for c in range(17):
        u=c/16
        x=-2.91+u*.34
        y=.33+.18*math.sin(v*math.pi)
        z=1.215-v*.47+.012*math.sin(u*math.pi*8)*(math.sin(v*math.pi)**.5)
        row.append(bm.verts.new((x,y,z)))
    grid.append(row)
for r in range(24):
    for c in range(16):bm.faces.new((grid[r][c],grid[r][c+1],grid[r+1][c+1],grid[r+1][c]))
jacket=mesh_object('cardigan',bm);cardigan=textured('cardigan_fabric',srgb('#514f46'),5,.2,.95,.2);add_woven_surface(cardigan,.006)
jacket.data.materials.append(cardigan);smooth(jacket,math.pi)
solid=jacket.modifiers.new('cloth_thickness','SOLIDIFY');solid.thickness=.002;apply_modifiers(jacket);personal.append(jacket)
# A throw follows the sofa arm, avoiding the walking aisle.
throw=rounded_box('folded_throw',(2.83,-.78,.70),(3.32,-.37,.73),.015,1,cloth);personal.append(throw)
# Left wall frame: an original geometric print, plus a small floating shelf.
personal.append(rounded_box('wall_frame',(-3.953,.35,1.60),(-3.914,1.10,2.18),.004,0,walnut,2))
personal.append(rounded_box('print',(-3.91,.38,1.63),(-3.908,1.07,2.15),.001,0,paper,1))
for i,c in enumerate(('#55695c','#b57d56','#8f9a87')):
    personal.append(rounded_box('print_block',(-3.906,.48+i*.15,1.70),(-3.904,.60+i*.15,2.04-i*.06),.001,0,principled('print_'+str(i),srgb(c),.9),1))
personal.append(rounded_box('wall_shelf',(-3.95,-.05,1.30),(-3.72,1.25,1.335),.004,0,wood,2))
personal=join('personal_details',personal)

# Nearby proxy furniture casts believable floor shadows and is never exported.
for name,lo,hi in [('desk',(-3.725,1.27,.76),(-1.375,2.17,.838)),('sofa',(2.72,-1.15,.1),(3.74,1.25,.88)),('side_table',(1.79,1.03,.64),(2.65,1.89,.718))]:
    rounded_box('occluder_'+name,lo,hi,.01,0,wood,2)
baked=[(floor,2048,224),(architecture,1536,224),(trim,512,192),(table,1024,256),(rug,1024,192),(ottoman,512,224),(props,768,224),(personal,1024,224)]
if '--inspect' in ARGS:
    inspect([o for o,_,_ in baked]);sys.exit(0)
if PREVIEW:
    preview((('room',three(0,1.65,3.55),three(0,1,-.85)),));sys.exit(0)
bake_and_export('living-zone.glb',baked,[],[],[],floor_mat,wall_mat)
