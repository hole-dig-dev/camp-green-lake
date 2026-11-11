"""art/blender/bunk_board.py : re-letter the rules board inside Bunk D (public/models/TentRoomCrew.glb).

The crew bunk's scene in buildings.blend no longer matches the shipped model (the room was reworked after the last
save), so the board cannot be re-exported from there. This patches the shipped GLB instead: it imports it, removes
only the old lettering on the board by the door (the ink-coloured faces lying on the paper), sets the new lines in
the same place with the same font and ink, and exports the room again as one mesh. Everything else in the room is
left exactly as it was; the script prints each material's triangle count before and after so that can be checked.
The lines are the ones art/blender/interiors.py now carries, so a full rebuild would read the same.

Run:  blender -b --factory-startup --python art/blender/bunk_board.py
"""
import bpy, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'fonts', 'Anton.ttf')
NAME = 'TentRoomCrew'
SRC = os.path.join(HERE, '..', '..', 'public', 'models', NAME + '.glb')
OUTS = [SRC, os.path.join(HERE, 'glb', NAME + '.glb')]
TITLE = 'CAMP RULES'
RULES = ('1. DIG', '2. THE COMPANY THANKS YOU', '3. NO ONE LEAVES CAMP')
BX, RY = 3.1, 8.30                     # the board's centre along the door wall, and the paper's plane (interiors.py tent_room: ry)
BOARD = ((2.6, 3.6), (8.26, 8.30), (1.3, 2.0))   # x, y, z box (Blender axes) that holds the lettering and nothing else

def tri_counts(me):
    n = {}
    for p in me.polygons: n[me.materials[p.material_index].name] = n.get(me.materials[p.material_index].name, 0) + len(p.vertices) - 2
    return n
def only(o):
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
def text(name, s, loc, size, m):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = s; cu.font = bpy.data.fonts.load(FONT, check_existing=True); cu.size = size
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = 0.006; cu.resolution_u = 2
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (math.pi / 2, 0, 0)             # standing on the door wall, facing into the room (-y; a z turn of pi faced it into the wall and the room saw it mirrored)
    only(o); bpy.ops.object.convert(target='MESH'); o = bpy.context.active_object; o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = False
    return o

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=SRC)
room = next(o for o in bpy.data.objects if o.type == 'MESH')
mw = room.matrix_world.copy(); room.parent = None; room.matrix_world = mw
for o in list(bpy.data.objects):
    if o is not room: bpy.data.objects.remove(o, do_unlink=True)
only(room); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = room.data; before = tri_counts(me)
ink_i = next(i for i, m in enumerate(me.materials) if m.name.split('.')[0].endswith('_ink')); INK = me.materials[ink_i]
inside = lambda co: all(lo <= co[i] <= hi for i, (lo, hi) in enumerate(BOARD))
import bmesh
bm = bmesh.new(); bm.from_mesh(me)
old = [f for f in bm.faces if f.material_index == ink_i and all(inside(v.co) for v in f.verts)]
xs = [v.co.x for f in old for v in f.verts]; zs = [v.co.z for f in old for v in f.verts]
print('BOARD old lettering: %d faces, x %.3f..%.3f  z %.3f..%.3f' % (len(old), min(xs), max(xs), min(zs), max(zs)))
bmesh.ops.delete(bm, geom=old, context='FACES'); bm.to_mesh(me); bm.free()
new = [text('rulestitle', TITLE, (BX, RY - 0.02, 1.9), 0.1, INK)]
new += [text('rule%d' % k, l, (BX, RY - 0.02, 1.72 - k * 0.12), 0.05, INK) for k, l in enumerate(RULES)]
for o in new:
    w = [(o.matrix_world @ v.co).x for v in o.data.vertices]; print('BOARD line %-28r x %.3f..%.3f (paper is %.2f..%.2f)' % (o.name, min(w), max(w), BX - 0.45, BX + 0.45))
for x in bpy.context.selected_objects: x.select_set(False)
for o in new: o.select_set(True)
room.select_set(True); bpy.context.view_layer.objects.active = room; bpy.ops.object.join()
room = bpy.context.active_object; room.name = NAME; room.data.name = NAME
after = tri_counts(room.data)
for k in sorted(set(before) | set(after)):
    if before.get(k) != after.get(k): print('BOARD changed material %s: %s -> %s tris' % (k, before.get(k), after.get(k)))
print('BOARD materials unchanged: %d of %d' % (sum(1 for k in before if before[k] == after.get(k)), len(before)))
for out in OUTS:
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=False,
                              export_normals=True, export_materials='EXPORT', export_texcoords=True)
