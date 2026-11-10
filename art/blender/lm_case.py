"""art/blender/lm_case.py : the LM card case, "Lucky" Lil Marlow's gold playing-card case (docs/STORY.md).

The find the Superintendent is really after. A flat gold case the size of a deck of cards, standing on its short
edge: a hinged lid with a seam and a thumb catch, a ruled border on the face, and LM cut into the front.

Self-contained (no shared toolkit, nothing read from /tmp): builds the model from scratch and writes
public/models/LMCase.glb plus the copy in art/blender/glb/. Same size class and origin as the find it replaced
(9.2 cm tall, origin on the ground under the middle of the base, face toward glTF +Z), so the game's placement
and its x5 scale (public/js/23-models.js ITEM_MODEL_LIST) still fit.

Run:  blender -b --factory-startup --python art/blender/lm_case.py
"""
import bpy, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'fonts', 'Anton.ttf')
NAME = 'LMCase'
OUTS = [os.path.join(HERE, '..', '..', 'public', 'models', NAME + '.glb'), os.path.join(HERE, 'glb', NAME + '.glb')]
W, D, H = 0.062, 0.018, 0.092          # width, thickness, height (metres): a deck of cards in a metal sleeve
SEAM = 0.066                           # the lid starts here
CUT = 0.0016                           # how deep the letters are cut

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
def box(name, size, loc, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL'); mod.width = bevel; mod.segments = 2; mod.limit_method = 'ANGLE'
        only(o); bpy.ops.object.modifier_apply(modifier='bevel')
    o.data.materials.append(m); return o
def cyl(name, r, depth, loc, m, rot=(0, 0, 0), verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(m); return o
def text(name, s, loc, size, m, extrude):
    """Lettering standing in the XZ plane facing -Y (the front), centred on loc, as a closed mesh."""
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = s; cu.font = bpy.data.fonts.load(FONT, check_existing=True); cu.size = size
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = extrude; cu.space_character = 1.08; cu.resolution_u = 3
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (math.pi / 2, 0, 0)
    only(o); bpy.ops.object.convert(target='MESH'); o = bpy.context.active_object; o.name = name
    o.data.materials.append(m); return o

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
GOLD = mat('lm_gold', 0xd4af37, 0.35, 0.45); DEEP = mat('lm_gold_deep', 0xb88a22, 0.4, 0.45)
PALE = mat('lm_gold_pale', 0xe8cc6a, 0.3, 0.45); INK = mat('lm_engrave', 0x4a3410, 0.7, 0.2)

body = box('body', (W, D, H), (0, 0, H / 2), GOLD, bevel=0.003)
# LM, cut into the front of the lower half, with a dark floor to the cut so it reads at game distance
LZ = 0.036
cutter = text('cutter', 'LM', (0, -D / 2, LZ), 0.03, INK, CUT)
b = body.modifiers.new('engrave', 'BOOLEAN'); b.operation = 'DIFFERENCE'; b.object = cutter; b.solver = 'EXACT'
only(body); bpy.ops.object.modifier_apply(modifier='engrave'); bpy.data.objects.remove(cutter, do_unlink=True)
parts = [body, text('inlay', 'LM', (0, -D / 2 + CUT, LZ), 0.03, INK, 0.0003)]
# the lid: a seam all the way round, hinge knuckles on the back, a thumb catch on the front
parts.append(box('seam', (W + 0.0012, D + 0.0012, 0.0016), (0, 0, SEAM), DEEP))
for x in (-0.018, 0, 0.018):
    parts.append(cyl('hinge%+.3f' % x, 0.0022, 0.012, (x, D / 2 + 0.0012, SEAM), DEEP, rot=(0, math.pi / 2, 0), verts=8))
parts.append(box('catch', (0.012, 0.003, 0.007), (0, -D / 2 - 0.0012, SEAM + 0.001), PALE, bevel=0.001))
# a ruled border on the face (four thin raised rules) and a small diamond pip on the lid
bx, bz0, bz1, t = W / 2 - 0.006, 0.008, SEAM - 0.006, 0.0012
for name, size, loc in (('rule_l', (t, 0.0008, bz1 - bz0), (-bx, -D / 2, (bz0 + bz1) / 2)), ('rule_r', (t, 0.0008, bz1 - bz0), (bx, -D / 2, (bz0 + bz1) / 2)),
                        ('rule_b', (2 * bx + t, 0.0008, t), (0, -D / 2, bz0)), ('rule_t', (2 * bx + t, 0.0008, t), (0, -D / 2, bz1))):
    parts.append(box(name, size, loc, DEEP))
pip = box('pip', (0.009, 0.0008, 0.009), (0, -D / 2, (SEAM + H) / 2 + 0.001), DEEP); pip.rotation_euler = (0, math.pi / 4, 0); pip.scale = (0.8, 1, 1.25); parts.append(pip)

for x in bpy.context.selected_objects: x.select_set(False)
for p in parts: p.select_set(True)
bpy.context.view_layer.objects.active = body; bpy.ops.object.join()
ob = bpy.context.active_object; ob.name = NAME; ob.data.name = NAME
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for p in ob.data.polygons: p.use_smooth = False
for out in OUTS:
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=False)
xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
print('LMCASE size: wide %.3f  thick %.3f  tall %.3f  base z %.4f  tris %d' % (max(xs) - min(xs), max(ys) - min(ys), max(zs), min(zs), sum(len(p.vertices) - 2 for p in ob.data.polygons)))
