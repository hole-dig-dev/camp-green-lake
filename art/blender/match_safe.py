"""art/blender/match_safe.py : the silver match safe, one of "Lucky" Lil Marlow's pocket things (docs/STORY.md).

A small flat silver box for matches, the kind a riverboat gambler carried: rounded corners, a hinged lid with a
thumb lip, a ribbed striker across the bottom of the face, a raised oval for a monogram nobody filled in, and a
ring on the corner for a chain. One of the three finds the Marshal's ghost wants back.

Self-contained (no shared toolkit, nothing read from /tmp): builds the model from scratch and writes
public/models/FindMatchSafe.glb plus the copy in art/blender/glb/. 7.4 cm tall with the origin on the ground under
the middle of the base and the face toward glTF +Z, the same size class as the find it replaced, so the game's x3
scale (public/js/23-models.js ITEM_MODEL_LIST) still fits.

Run:  blender -b --factory-startup --python art/blender/match_safe.py
"""
import bpy, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
NAME = 'FindMatchSafe'
OUTS = [os.path.join(HERE, '..', '..', 'public', 'models', NAME + '.glb'), os.path.join(HERE, 'glb', NAME + '.glb')]
W, D, H = 0.044, 0.014, 0.072          # width, thickness, height (metres)
SEAM = 0.054                           # the lid starts here

def lin(c): return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
def mat(name, hexcol, rough, metal):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = tuple(lin(((hexcol >> s) & 255) / 255) for s in (16, 8, 0)) + (1.0,)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m
def only(o):
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
parts = []
def box(name, size, loc, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 2; mod.limit_method = 'ANGLE'
        only(o); bpy.ops.object.modifier_apply(modifier='bevel')
    o.data.materials.append(m); parts.append(o); return o
def cyl(name, r, depth, loc, m, rot=(0, 0, 0), verts=12, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = scale; o.data.materials.append(m); parts.append(o); return o

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
SILVER = mat('ms_silver', 0xd0d0c8, 0.25, 0.6); DARK = mat('ms_silver_dark', 0x94948a, 0.3, 0.6); TARN = mat('ms_tarnish', 0x5c5a50, 0.6, 0.4)

box('body', (W, D, H), (0, 0, H / 2), SILVER, bevel=0.004)
box('seam', (W + 0.001, D + 0.001, 0.0014), (0, 0, SEAM), TARN)
box('lip', (0.014, 0.003, 0.004), (0, -D / 2 - 0.001, SEAM + 0.003), DARK, bevel=0.001)                 # thumb lip on the lid
for k in range(7): box('striker%d' % k, (W - 0.012, 0.0012, 0.0011), (0, -D / 2, 0.006 + k * 0.0022), TARN)   # the ribbed striker
cyl('oval', 0.011, 0.001, (0, -D / 2, 0.036), DARK, rot=(math.pi / 2, 0, 0), verts=20, scale=(1, 1, 1.25))    # monogram oval (rotated: local z is world -y, local y is world z)
cyl('ovalface', 0.0092, 0.0014, (0, -D / 2, 0.036), SILVER, rot=(math.pi / 2, 0, 0), verts=20, scale=(1, 1, 1.25))
for x in (-0.012, 0.012): cyl('hinge%+.3f' % x, 0.0018, 0.01, (x, D / 2 + 0.001, SEAM), DARK, rot=(0, math.pi / 2, 0), verts=8)
bpy.ops.mesh.primitive_torus_add(major_radius=0.005, minor_radius=0.0011, major_segments=12, minor_segments=6, location=(W / 2 + 0.003, 0, H - 0.008), rotation=(math.pi / 2, 0, 0))
ring = bpy.context.active_object; ring.name = 'ring'; ring.data.materials.append(DARK); parts.append(ring)

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
print('MATCHSAFE size: wide %.3f  thick %.3f  tall %.3f  base z %.4f  tris %d' % (max(xs) - min(xs), max(ys) - min(ys), max(zs), min(zs), sum(len(p.vertices) - 2 for p in ob.data.polygons)))
