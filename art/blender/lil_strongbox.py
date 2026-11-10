"""art/blender/lil_strongbox.py : Lil's strongbox, the prize "Lucky" Lil Marlow sank in the lake in 1887 (docs/STORY.md).

An iron-bound oak chest with a half-round lid: three iron straps riveted over the lid and down the front, an iron
rail at the lid seam, corner irons, a brass padlock on a hasp, ring handles on the ends and a brass L and M either
side of the lock. It is the find that wins the game, so it must not be mistaken for the ordinary bank cashbox
(FindStrongbox.glb, flat-topped with leather straps).

Self-contained (no shared toolkit, nothing read from /tmp): builds the model from scratch and writes
public/models/FindLilStrongbox.glb plus the copy in art/blender/glb/. Origin on the ground under the middle of the
chest, front toward glTF +Z, 0.70 m wide like the find it replaced, so the game's 1.15 scale
(public/js/23-models.js ITEM_MODEL_LIST) still fits.

Run:  blender -b --factory-startup --python art/blender/lil_strongbox.py
"""
import bpy, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'fonts', 'Anton.ttf')
NAME = 'FindLilStrongbox'
OUTS = [os.path.join(HERE, '..', '..', 'public', 'models', NAME + '.glb'), os.path.join(HERE, 'glb', NAME + '.glb')]
W, D, HB = 0.70, 0.40, 0.32            # width, depth, height of the box under the lid
LID = 0.13                             # rise of the half-round lid
STRAPS = (-0.24, 0.0, 0.24)

def lin(c): return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
def mat(name, hexcol, rough, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = tuple(lin(((hexcol >> s) & 255) / 255) for s in (16, 8, 0)) + (1.0,)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m
def only(o):
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
parts = []
def keep(o, m):
    o.data.materials.append(m); parts.append(o); return o
def box(name, size, loc, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 1; mod.limit_method = 'ANGLE'
        only(o); bpy.ops.object.modifier_apply(modifier='bevel')
    return keep(o, m)
def cyl(name, r, depth, loc, m, rot=(0, 0, 0), verts=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; return keep(o, m)
def torus(name, R, r, loc, m, rot=(0, 0, 0), seg=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=6, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; return keep(o, m)
def half_round(name, radius, length, x, m, verts=20):
    """A half cylinder lying along X with its flat side down at z = HB, squashed to the lid's rise."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=length, location=(x, 0, 0), rotation=(0, math.pi / 2, 0))
    o = bpy.context.active_object; o.name = name; bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    for v in o.data.vertices: v.co.z = max(v.co.z, 0.0) * (LID / (D / 2))
    o.location.z = HB; return keep(o, m)
def text(name, s, loc, size, m, extrude):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = s; cu.font = bpy.data.fonts.load(FONT, check_existing=True); cu.size = size
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = extrude; cu.resolution_u = 2
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (math.pi / 2, 0, 0)
    only(o); bpy.ops.object.convert(target='MESH'); o = bpy.context.active_object; o.name = name
    return keep(o, m)

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
OAK = mat('lil_oak', 0x6b4528, 0.85); OAK_D = mat('lil_oak_dark', 0x4a2e18, 0.9); OAK_L = mat('lil_oak_lid', 0x7a5230, 0.85)
IRON = mat('lil_iron', 0x34363a, 0.55, 0.6); IRON_L = mat('lil_iron_worn', 0x565a5e, 0.5, 0.6); BRASS = mat('lil_brass', 0xc89b3c, 0.4, 0.5)

box('chest', (W, D, HB), (0, 0, HB / 2), OAK, bevel=0.008)
for z in (0.11, 0.215): box('plankgap%.2f' % z, (W + 0.002, D + 0.002, 0.006), (0, 0, z), OAK_D)     # the gaps between the boards
half_round('lid', D / 2, W, 0, OAK_L)
box('rail', (W + 0.02, D + 0.02, 0.03), (0, 0, HB), IRON, bevel=0.004)                              # iron rail at the lid seam
for x in STRAPS:
    box('strap%+.2f' % x, (0.06, D + 0.016, HB), (x, 0, HB / 2), IRON, bevel=0.003)
    hoop = half_round('hoop%+.2f' % x, D / 2 + 0.008, 0.06, x, IRON)
    for z in (0.05, 0.16, 0.27): cyl('rivet%+.2f_%.2f' % (x, z), 0.011, 0.008, (x, -D / 2 - 0.009, z), IRON_L, rot=(math.pi / 2, 0, 0), verts=8)
for sx in (-1, 1):
    for sy in (-1, 1): box('corner%d%d' % (sx, sy), (0.07, 0.07, 0.09), (sx * (W / 2 - 0.03), sy * (D / 2 - 0.03), 0.045), IRON, bevel=0.004)
    torus('ring%d' % sx, 0.05, 0.009, (sx * (W / 2 + 0.012), 0, 0.2), IRON_L, rot=(0, math.pi / 2, 0))
    box('ringplate%d' % sx, (0.012, 0.09, 0.05), (sx * (W / 2 + 0.004), 0, 0.245), IRON, bevel=0.002)
# hasp and padlock on the middle strap
box('hasp', (0.05, 0.012, 0.11), (0, -D / 2 - 0.016, HB - 0.02), IRON_L, bevel=0.003)
box('lock', (0.085, 0.03, 0.075), (0, -D / 2 - 0.03, HB - 0.115), BRASS, bevel=0.008)
torus('shackle', 0.026, 0.007, (0, -D / 2 - 0.03, HB - 0.072), IRON_L, rot=(math.pi / 2, 0, 0), seg=12)
cyl('keyhole', 0.009, 0.004, (0, -D / 2 - 0.046, HB - 0.118), IRON, rot=(math.pi / 2, 0, 0), verts=8)
# her initials in brass, one each side of the lock
text('L', 'L', (-0.12, -D / 2 - 0.001, 0.165), 0.13, BRASS, 0.004)
text('M', 'M', (0.12, -D / 2 - 0.001, 0.165), 0.13, BRASS, 0.004)

for x in bpy.context.selected_objects: x.select_set(False)
for p in parts: p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join()
ob = bpy.context.active_object; ob.name = NAME; ob.data.name = NAME
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for p in ob.data.polygons: p.use_smooth = False
for out in OUTS:
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=False)
xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
print('LILSTRONGBOX size: wide %.3f  deep %.3f  tall %.3f  base z %.4f  tris %d' % (max(xs) - min(xs), max(ys) - min(ys), max(zs), min(zs), sum(len(p.vertices) - 2 for p in ob.data.polygons)))
