"""art/blender/jeep.py : Foreman Dutch's ride, from a free model instead of our scratch-built pickup.

Source: "Jeep" by Zsky on Poly Pizza (https://poly.pizza/m/AcSdGGrgYP), CC-BY 3.0. Kept as downloaded in
art/blender/sources/jeep-zsky.glb; this script turns it into public/models/MrSirTruck.glb (the game still loads the
truck by that name). Credit is in CREDITS.md at the top of the repo.

What it does:
  - recolours the eight flat materials into the camp's palette (sun-faded olive body, tan canvas seats, warm dark
    tyres, pale glass, amber and red lamps). Colours here are sRGB hex, written as linear glTF factors; the game's
    loader (23-models.js) converts them back, so what you type is what you see.
  - scales it to the game's people (0.88: about 4.0 m long, 1.8 m wide, windscreen top just under 2 m),
  - puts the origin on the ground under the middle of the body, nose toward glTF +Z (the game's "forward"),
  - exports one flat-shaded mesh, no textures.
The numbers 87-truck.js needs (axles, track, seats) are printed at the end; copy them over if the scale changes.

Run:  blender -b --factory-startup --python art/blender/jeep.py
"""
import bpy, os
from mathutils import Vector, Matrix
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sources', 'jeep-zsky.glb')
OUT = os.path.join(HERE, '..', '..', 'public', 'models', 'MrSirTruck.glb')
SCALE = 0.88
PALETTE = {                      # source material -> (sRGB hex, roughness)
    'DarkGreen_Jeep':  (0x6f7a4c, 0.85),   # body: sun-faded army olive
    'LightGreen_Jeep': (0xb59a68, 0.95),   # seats: tan canvas
    'Black_Jeep':      (0x3a3833, 0.80),   # frame, bumper, roll bar, steering wheel
    'DarkBlue_Jeep':   (0x2b2724, 0.95),   # tyres: warm charcoal
    'White_Jeep':      (0xfff0c4, 0.40),   # headlamps
    'Windows_Jeep':    (0xbfd6dc, 0.25),   # windscreen
    'Orange_Jeep':     (0xd97a2a, 0.60),   # indicators
    'GasTank_Jeep':    (0xa8402c, 0.80),   # jerry can
}
def lin(c): return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
def hex_lin(h): return tuple(lin(((h >> s) & 255) / 255) for s in (16, 8, 0)) + (1.0,)

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ob = next(o for o in bpy.data.objects if o.type == 'MESH')
# bake the import's parent transform, then drop the empty
mw = ob.matrix_world.copy(); ob.parent = None; ob.matrix_world = mw
for o in list(bpy.data.objects):
    if o is not ob: bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
shift = Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs)))
me.transform(Matrix.Translation(shift)); me.transform(Matrix.Scale(SCALE, 4))
for m in me.materials:
    col, rough = PALETTE[m.name]
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = hex_lin(col); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0.0
    m.name = 'cgl_jeep_' + m.name.replace('_Jeep', '').lower()
for p in me.polygons: p.use_smooth = False
ob.name = 'MrSirTruck'; me.name = 'MrSirTruck'
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=False)

# ---- the numbers 87-truck.js needs, in the game's truck coordinates (x: its left, z: forward, y: up) ----
def box(mat, cond=lambda v: True):
    k = [i for i, m in enumerate(me.materials) if m.name.endswith(mat)][0]
    vs = [me.vertices[v].co for p in me.polygons if p.material_index == k for v in p.vertices]
    vs = [v for v in vs if cond(v)]
    return [min(v[i] for v in vs) for i in range(3)], [max(v[i] for v in vs) for i in range(3)]
# Blender (x, y, z) -> game (x, z = -y, y = z)
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
print('JEEP size: wide %.2f  long %.2f  tall %.2f' % (max(xs) - min(xs), max(ys) - min(ys), max(zs)))
for name, cond in (('front', lambda v: v.y < 0 and v.z < 0.95), ('rear', lambda v: 0 < v.y < 1.25 * SCALE + 0.3 and v.z < 0.95)):
    lo, hi = box('darkblue', cond)
    print('JEEP %s axle: z %.2f  track(half) %.2f  wheel radius %.2f' % (name, -(lo[1] + hi[1]) / 2, (hi[0] - lo[0]) / 2 - (hi[0] - lo[0]) * 0.09, (hi[2] - lo[2]) / 2))
lo, hi = box('lightgreen'); print('JEEP seats: x %.2f..%.2f  z %.2f..%.2f  top %.2f' % (lo[0], hi[0], -hi[1], -lo[1], hi[2]))
lo, hi = box('darkgreen'); print('JEEP body: z %.2f..%.2f  top %.2f' % (-hi[1], -lo[1], hi[2]))
