# blend: gear.blend
"""GREEN LAKE FIZZ: a ground-centred, Blender -Y-facing camp soda machine.

Rebuild from the repository root:
  VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json blender -b art/blender/gear.blend --gpu-backend vulkan --threads 4 --python-exit-code 1 --python art/blender/soda_machine.py
All art (including the bottle illustration and lettering) is Blender geometry.
"""
from pathlib import Path
import bpy, math, shutil, json
from mathutils import Vector

HERE = Path(__file__).resolve().parent
exec((HERE / 'cgl_blender.py').read_text())
exec((HERE / 'pipeline_common.py').read_text())

RED = ('soda_red', (169, 65, 49), .85, 0)
FADE = ('soda_sun_bleach', (199, 105, 80), .9, 0)
CREAM = ('soda_cream', (245, 227, 179), .64, 0)
LIT = ('soda_lit_panel', (245, 227, 179), .64, 0)
TEAL = ('soda_teal', (42, 111, 101), .75, 0)
DARK = ('soda_shadow', (40, 47, 44), .85, 0)
STEEL = ('soda_trim', (156, 163, 147), .55, .25)
RUST = ('soda_rust', (109, 68, 43), .94, 0)
# Reset the shared painted cream when rebuilding in an existing authoring file.
mat(*CREAM).node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0

scene('SodaMachine')
ROOT = root('SodaMachine')

def B(name, size, loc, material, bevel=.006, rot=(0, 0, 0)):
    return box(name, size, loc, material, rot=rot, bevel=bevel, parent=ROOT)

def face(name, points, y, material):
    """An XZ silhouette facing the front, always authored as a Blender mesh."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, y, z) for x, z in points], [], [tuple(range(len(points)))])
    me.update()
    obj = bpy.data.objects.new(name, me)
    _link(obj)
    obj.parent = ROOT
    me.materials.append(mat(*material))
    return obj

def label(name, words, x, y, z, size, width, material, rot=(math.pi/2, 0, 0)):
    obj = text(name, words, (x, y, z), size, material, extrude=0,
               rot=rot, parent=ROOT)
    bpy.context.view_layer.update()
    # Scale in text's local horizontal axis, retaining chunky, legible capitals.
    local_width = max(v.co.x for v in obj.data.vertices)-min(v.co.x for v in obj.data.vertices)
    if local_width > width:
        obj.scale.x = width/local_width
    return obj

# Feet, plinth and folded steel cabinet. Ground contact at Z=0.
for x in (-.32, .32):
    for y in (-.24, .24):
        B('rubber_foot', (.105, .11, .08), (x, y, .04), DARK, .008)
B('kick_plinth', (.84, .66, .09), (0, .01, .09), DARK, .012)
B('cabinet', (.90, .73, 1.77), (0, .01, 1.015), RED, .035)
B('bleached_roof', (.88, .71, .055), (0, .01, 1.8725), FADE, .02)
B('door_seal', (.834, .018, 1.64), (0, -.351, 1.035), DARK, .019)
B('front_door', (.812, .018, 1.614), (0, -.36, 1.038), RED, .024)

# A luminous cream face and large original bottle mark. Core glTF emission survives
# export; the existing gameMat adapter uses its bright base colour for daytime review.
B('panel_gasket', (.63, .013, 1.12), (-.09, -.368, 1.275), DARK, .026)
B('panel_trim', (.604, .010, 1.095), (-.09, -.37, 1.275), STEEL, .022)
panel = B('lit_panel', (.576, .008, 1.066), (-.09, -.371, 1.275), LIT, .019)
bsdf = panel.data.materials[0].node_tree.nodes['Principled BSDF']
bsdf.inputs['Emission Color'].default_value = srgb((245, 227, 179))
bsdf.inputs['Emission Strength'].default_value = .65
label('brand_green_lake', 'GREEN LAKE', -.09, -.376, 1.699, .113, .505, TEAL)
label('brand_fizz', 'FIZZ', -.09, -.376, 1.484, .305, .48, RED)

# Flat cartoon bottle silhouette: broad shoulders, skinny neck, crown cap,
# cream label and a lightning bolt. Simple shapes read at yard distance.
cx = -.09
bottle = [(-.086,.84),(.086,.84),(.104,.864),(.104,1.119),
          (.091,1.166),(.043,1.218),(.043,1.282),(-.043,1.282),
          (-.043,1.218),(-.091,1.166),(-.104,1.119),(-.104,.864)]
face('cartoon_bottle', [(cx+x,z) for x,z in bottle], -.376, TEAL)
B('cartoon_cap', (.111, .002, .031), (cx, -.377, 1.286), RED, .002)
face('bottle_paper_label', [(cx-.099,.955),(cx+.099,.955),
                           (cx+.099,1.076),(cx-.099,1.076)], -.377, CREAM)
face('bottle_lightning', [(cx+.015,1.103),(cx-.048,1.01),
                         (cx-.008,1.01),(cx-.027,.925),
                         (cx+.052,1.041),(cx+.01,1.041)], -.378, RED)
for i,(x,z,r) in enumerate([(-.257,1.209,.023),(.081,1.122,.026),
                          (.079,1.282,.018),(-.246,.946,.016)]):
    cyl('fizz_bubble_'+str(i), r, .002, (x,-.377,z), TEAL,
        verts=10, rot=(math.pi/2,0,0), bevel=0, parent=ROOT)
for x,z,a in [(-.29,1.12,-.3),(.106,.98,.3),(-.26,1.32,.3)]:
    B('burst_ray', (.053,.002,.012), (x,-.377,z), RED, 0, (0,a,0))
label('cold_soda', 'COLD SODA', -.09, -.376, .787, .071, .40, TEAL)

# Coin mechanism and broad tactile selection buttons.
B('control_surround', (.143,.01,.90), (.29,-.367,1.215), DARK, .016)
B('control_plate', (.126,.006,.882), (.29,-.371,1.215), STEEL, .013)
label('coin_price', '25c', .29,-.375,1.578,.082,.106,DARK)
B('coin_slot', (.066,.003,.014), (.29,-.373,1.466), DARK, .002)
for z in (1.293,1.128,.963):
    B('selector_socket', (.096,.004,.109), (.29,-.373,z), DARK,.012)
    B('cream_selector', (.077,.003,.077), (.29,-.376,z+.008), CREAM,.012)
    B('selector_mark', (.045,.001,.012), (.29,-.378,z+.008), TEAL,.003)
B('coin_return_hole', (.072,.003,.032), (.29,-.373,.826), DARK,.005)

# Recessed bottle bay and a visibly hinged, sloping delivery flap.
B('delivery_bay', (.565,.006,.248), (-.037,-.372,.425), DARK,.019)
B('delivery_flap', (.517,.005,.149), (-.037,-.374,.469), STEEL,.001,
  rot=(math.radians(4),0,0))
B('flap_hinge', (.524,.005,.015), (-.037,-.377,.544), CREAM,.002)
B('bay_lower_lip', (.569,.015,.023), (-.037,-.367,.306), STEEL,.006)
label('take_bottle', 'TAKE A BREATHER', -.037,-.375,.619,.058,.54,CREAM)
for z in (.86,1.61):
    B('door_hinge', (.035,.009,.08), (-.39,-.369,z), STEEL,.005)
cyl('door_lock', .018,.005,(.343,-.372,.624), STEEL,verts=10,
    rot=(math.pi/2,0,0),bevel=0,parent=ROOT)
B('lock_keyhole', (.003,.001,.013), (.343,-.375,.624), DARK,0)

# Side recess: a shallow deformed steel panel above the base cabinet's side,
# with a dent depressed relative to its own rim (no hidden fake texture).
ys = [-.29,-.15,.04,.21,.31]
zs = [.29,.53,.78,1.03,1.67]
verts=[]
for j,z in enumerate(zs):
    for i,y in enumerate(ys):
        depth = .018 if (i,j)==(2,2) else .009 if (i,j) in [(1,2),(2,1),(3,2),(2,3)] else 0
        verts.append((.449-depth,y,z))
faces=[]
for j in range(4):
    for i in range(4):
        a=j*5+i
        faces.append((a,a+1,a+6,a+5))
# Sink the underlying cabinet side locally so the dent is actual visible geometry.
cab = bpy.data.objects['cabinet']
for v in cab.data.vertices:
    if v.co.x > 0: v.co.x -= .026
me=bpy.data.meshes.new('dented_side');me.from_pydata(verts,[],faces);me.update()
obj=bpy.data.objects.new('dented_side',me);_link(obj);obj.parent=ROOT;me.materials.append(mat(*RED))
for y in (-.295,.315):
    B('side_fold', (.026,.028,1.68),(.437,y,.985),RED,.008)
# Side branding faces +X (a 90-degree turn from the front).
label('side_fizz', 'FIZZ', .450,.014,1.43,.31,.51,CREAM,
      rot=(math.pi/2,0,math.pi/2))
for z in (1.20,1.15):
    B('side_cream_pinstripe',(.001,.51,.014),(.4495,.015,z),CREAM,0)
for z in (.36,.405,.45,.495):
    B('vent_louvre',(.003,.23,.014),(.4485,.015,z),DARK,.002)

# Sun-bleached corners and a few broad paint chips rather than visual noise.
face('bleached_front_shoulder',[(-.379,1.81),(.38,1.81),(.38,1.771),
                               (.15,1.779),(-.19,1.786),(-.379,1.77)],-.370,FADE)
for i,(x,z,w,h) in enumerate([(-.366,.25,.061,.025),(.32,.238,.069,.018),
                              (-.372,1.52,.023,.059),(.362,1.75,.035,.021)]):
    face('paint_chip_'+str(i),[(x-w/2,z),(x+w/2,z+h*.2),
                             (x+w*.3,z+h),(x-w*.3,z+h*.8)],-.370,RUST)
B('back_access_panel',(.67,.003,1.32),(0,.374,1.04),DARK,.012)
for z in (.42,.47,.52):
    B('back_vent',(.44,.002,.019),(0,.376,z),STEEL,0)

bpy.context.view_layer.update()
# Centre the entire footprint (including the sloped flap), retaining ground Z=0.
dg = bpy.context.evaluated_depsgraph_get()
parts = [o for o in coll('Asset').all_objects if o.type=='MESH']
pts = [o.matrix_world @ Vector(p) for o in parts for p in o.evaluated_get(dg).bound_box]
offset = Vector((-(min(p.x for p in pts)+max(p.x for p in pts))/2,
                 -(min(p.y for p in pts)+max(p.y for p in pts))/2, 0))
for obj in parts:
    obj.location += offset
bpy.context.view_layer.update()
bpy.context.scene.render.resolution_x = 1000
bpy.context.scene.render.resolution_y = 1000
studio(elev=16,azim=32,lens=55,floor=True)
bpy.context.view_layer.update()
frame(margin=1.22)
render(res=(1000,1000),samples=32)

# Export the named, baked mesh with identity transforms and a ground-centred origin.
out = HERE / 'glb/SodaMachine.glb'
info = pipeline_export(str(out),ROOT)
shutil.copy2(out,HERE.parents[1]/'public/models/SodaMachine.glb')
dg = bpy.context.evaluated_depsgraph_get()
pts = [o.matrix_world @ Vector(p) for o in coll('Asset').all_objects
       if o.type=='MESH' for p in o.evaluated_get(dg).bound_box]
lo=[min(p[i] for p in pts) for i in range(3)]
hi=[max(p[i] for p in pts) for i in range(3)]
audit={'file':'SodaMachine.glb','bytes':info[1],'triangles':tris(),
       'materials':info[2][1], 'blender_bounds':[lo,hi],
       'game_dimensions_m':{'width':hi[0]-lo[0],'depth':hi[1]-lo[1],'height':hi[2]-lo[2]},
       'front':'Blender -Y / game +Z','origin':[0,0,0]}
(HERE/'renders/SodaMachine-asset.json').write_text(json.dumps(audit,indent=2)+'\n')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'gear.blend'),compress=True)
print('SODA_ASSET',json.dumps(audit))
