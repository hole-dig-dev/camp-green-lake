# blend: employee-board.blend
"""Employee of the Day yard board, metres, front Blender -Y / game +Z.

Rebuild independently (does not edit gear.blend or props.blend):
  env -u DISPLAY ~/blender/blender -b --factory-startup --gpu-backend vulkan \
    --python art/blender/employee_board.py
Use -- --no-render to export without a preview. Eight canvas surfaces remain
separate single quads; only the static wood, hardware and lettering are joined.
"""
from pathlib import Path
import bpy
import math
import random
import shutil
import sys

HERE = Path(__file__).resolve().parent
exec((HERE / 'cgl_blender.py').read_text())
OUT = HERE / 'glb' / 'EmployeeBoard.glb'
PUBLIC = HERE.parents[1] / 'public' / 'models' / OUT.name
rnd = random.Random(100226)

# No imported geometry; all modelling happens in Blender.
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
sc = scene('EmployeeBoard')
r = root('EmployeeBoard')
WOOD = [('eotd_plank_' + str(i), c, .96, 0) for i, c in enumerate(
    ((119, 99, 70), (139, 118, 85), (130, 109, 80), (148, 126, 94)))]
EDGE = ('eotd_endgrain', (84, 66, 44), .95, 0)
GRAIN = ('eotd_grain', (92, 76, 53), .98, 0)
FADED = ('eotd_worn_edges', (170, 147, 109), .97, 0)
INK = ('eotd_ink', (40, 34, 23), .94, 0)
CREAM = ('eotd_cream', (244, 225, 184), .9, 0)
GOLD = ('eotd_winner_gold', (221, 171, 48), .36, .72)
BRASS = ('eotd_tarnished_brass', (150, 113, 49), .52, .6)
TIN = ('eotd_cheap_tin', (134, 148, 142), .69, .45)
IRON = ('eotd_iron', (52, 55, 49), .7, .55)
RUST = ('eotd_rust', (126, 63, 35), .91, .18)
RED = ('eotd_stamp', (141, 48, 32), .93, 0)

def B(name, size, loc, material, bevel=.008, rot=(0, 0, 0)):
    return box(name, size, loc, material, bevel=bevel, rot=rot, parent=r)

def pin(name, x, y, z, material=IRON, radius=.014):
    return cyl(name, radius, .008, (x, y, z), material, verts=8,
               rot=(math.pi / 2, 0, 0), bevel=0, parent=r)

def lettering(name, words, loc, size, material, max_width=None, **kwargs):
    obj = text(name, words, loc, size, material, parent=r,
               fontname='BigShouldersStencilDisplay', extrude=0, **kwargs)
    bpy.context.view_layer.update()
    if max_width and obj.dimensions.x > max_width:
        obj.scale *= max_width / obj.dimensions.x
    return obj

# Two squared posts, with iron straps, exposed lower wear and rear cross braces.
for side in (-1, 1):
    x = side * 1.29
    B('post', (.16, .19, 2.5), (x, .065, 1.25), EDGE)
    B('sunbleached_post_face', (.13, .007, .78), (x, -.034, .4), WOOD[2], .002)
    for z in (.20, .53):
        B('post_split', (.008, .004, .19), (x + side * .029, -.04, z), GRAIN, 0)
    B('iron_post_shoe', (.174, .202, .14), (x, .065, .07), IRON, .004)
    B('back_brace', (.07, .09, 1.05), (side * .93, .19, 1.48), EDGE,
      rot=(0, side * .58, 0))
    for z in (1.02, 2.17):
        B('rear_mount_strap', (.23, .025, .15), (x, .173, z), IRON, .004)

# Individually weathered horizontal boards. Gaps expose real separation.
for k in range(6):
    z = 1.015 + k * .21
    B('backing_plank', (3.14, .09, .202), (0, 0, z), WOOD[k % 4], .004)
    for j in range(5):
        x = rnd.uniform(-1.43, 1.43)
        B('wood_fissure', (rnd.uniform(.07, .33), .002, rnd.uniform(.002, .005)),
          (x, -.0465, z + rnd.uniform(-.08, .08)), GRAIN, 0)
    for x in (-1.47, 1.47):
        pin('plank_nail', x, -.052, z)
    if k in (0, 4):
        knot = pin('wood_knot', -1.46 if k == 4 else .22, -.051, z, GRAIN, .025)
        knot.scale.x = 1.8

B('lower_sill', (3.2, .17, .075), (0, -.004, .9075), EDGE)
B('upper_sill', (3.2, .15, .07), (0, -.005, 2.245), EDGE)
for x in (-1.575, 1.575):
    B('edge_batten', (.05, .13, 1.4), (x, -.012, 1.575), EDGE, .004)

# Big stencilled camp sign, with cream paint abraded at the edges.
B('header_sign', (3.18, .12, .30), (0, -.016, 2.43), EDGE)
B('header_paint', (3.07, .008, .24), (0, -.081, 2.43), CREAM, .004)
B('rain_cap', (3.2, .22, .04), (0, -.005, 2.58), WOOD[0], .006)
header = lettering('header_letters', 'EMPLOYEE OF THE DAY', (0, -.090, 2.43), .30, INK, 2.82)
header.scale.x *= 2.70 / header.dimensions.x
for x in (-1.48, 1.48):
    pin('header_bolt', x, -.090, 2.43, IRON, .019)
for k in range(10):
    B('paint_chip', (rnd.uniform(.015, .06), .002, .009),
      (rnd.uniform(-1.36, 1.36), -.086, 2.315 if k % 2 else 2.545), EDGE, 0)

def surface(name, material_name, x, y, z, w, h, col):
    """One four-vertex face: front normal -Y, UVs BL, BR, TR, TL.

    glTF converts Z-up to Y-up and flips V in TEXCOORD_0. At runtime use
    CanvasTexture.flipY=false (matching GLTFLoader) to retain this orientation.
    """
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2),
                   (w / 2, 0, h / 2), (-w / 2, 0, h / 2)], [], [(0, 1, 2, 3)])
    me.update()
    uv = me.uv_layers.new(name='UVMap')
    for loop, value in zip(uv.data, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop.uv = value
    obj = bpy.data.objects.new(name, me)
    _link(obj)
    obj.parent = r
    obj.location = (x, y, z)
    material = mat(material_name, col, .92, 0)
    material.name = material_name
    material.use_backface_culling = True
    me.materials.append(material)
    obj['canvasTextureFlipY'] = False
    return obj

surfaces = []
for slot, x in enumerate((-1.11, -.37, .37, 1.11), 1):
    metal = (GOLD, BRASS, TIN, WOOD[0])[slot - 1]
    w = (.073, .063, .048, .075)[slot - 1]
    # Matting and rebates separate the photo from the heavy frame silhouette.
    B('frame_shadow', (.65, .065, .81), (x, -.092, 1.735), INK, .005)
    B('ivory_mat', (.524, .022, .684), (x, -.128, 1.735), CREAM, .002)
    for side in (-1, 1):
        B('frame_upright_' + str(slot), (w, .066, .64 + 2 * w),
          (x + side * (.24 + w / 2 + .018), -.15, 1.735), metal, .008)
        B('frame_crosspiece_' + str(slot), (.516, .066, w),
          (x, -.15, 1.735 + side * (.32 + w / 2 + .018)), metal, .008)
        # Raised inner rim: tarnished brass on the winner, rusty tin on LVP.
        trim = BRASS if slot == 1 else (RUST if slot == 3 else EDGE)
        B('inner_frame_bead', (.010, .016, .672),
          (x + side * .249, -.187, 1.735), trim, .002)
        B('inner_frame_bead', (.508, .016, .010),
          (x, -.187, 1.735 + side * .329), trim, .002)
    if slot == 1:
        # Four embossed brass rosettes: a slightly over-important winner frame.
        for dx in (-.294, .294):
            for dz in (-.374, .374):
                pin('winner_rosette', x + dx, -.190, 1.735 + dz, BRASS, .024)
                pin('rosette_center', x + dx, -.198, 1.735 + dz, GOLD, .010)
    elif slot == 3:
        for dx in (-.28, .28):
            for dz in (-.36, .36):
                pin('tin_rivet', x + dx, -.189, 1.735 + dz, IRON, .009)
        B('tin_dent', (.038, .006, .009), (x + .274, -.187, 1.86), RUST, 0,
          rot=(0, -.4, 0))
    elif slot == 4:
        for dx in (-.295, .295):
            B('frame_wood_split', (.006, .003, .19),
              (x + dx, -.185, 1.80), GRAIN, 0)
    pin('frame_hanging_tack', x, -.060, 2.203, BRASS, .011)
    lettering('slot_number', str(slot).zfill(2), (x, -.068, 2.187), .038, CREAM)
    surfaces.append(surface('Photo' + str(slot), 'photo' + str(slot),
                            x, -.153, 1.735, .48, .64, (225, 214, 186)))
    B('plaque_rebate', (.65, .055, .197), (x, -.092, 1.205), EDGE, .006)
    surfaces.append(surface('Plaque' + str(slot), 'plaque' + str(slot),
                            x, -.125, 1.205, .60, .15, (236, 216, 172)))
    for dx in (-.312, .312):
        pin('plaque_screw', x + dx, -.125, 1.205, metal, .009)

# A petty official approval stamp along the lower board, and a bird's review.
lettering('approval_stamp', 'MR. SIR APPROVED', (.82, -.053, .995), .06, RED, 1.02)
for z in (.95, 1.04):
    B('stamp_rule', (1.10, .002, .003), (.82, -.052, z), RED, 0)
lettering('camp_footer', 'CAMP GREEN LAKE  /  NO RAISES', (-.69, -.053, .995), .047, INK, 1.35)
for x, z, radius in ((1.27, 2.573, .024), (1.30, 2.535, .016), (1.295, 2.509, .010)):
    drop = pin('bird_review', x, -.091, z, CREAM, radius)
    drop.scale.z = 1.3

# Bake modifiers on decorative pieces and join them into one static body.
# Photo*/Plaque* are deliberately excluded: do not use export_glb(), which
# collapses all the meshes and loses the runtime texture-swapping contract.
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
pieces = []
for obj in list(coll('Asset').all_objects):
    if obj.type != 'MESH' or obj in surfaces:
        continue
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg),
                                        preserve_all_data_layers=True, depsgraph=dg)
    me.transform(obj.matrix_world)
    baked = bpy.data.objects.new(obj.name + '_baked', me)
    _link(baked)
    pieces.append(baked)
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in pieces:
    obj.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'EmployeeBoardBody'
body.data.name = body.name
body.parent = r
bpy.ops.object.material_slot_remove_unused()

for obj in surfaces:
    assert len(obj.data.vertices) == 4 and len(obj.data.polygons) == 1
    assert obj.data.polygons[0].normal.y < -.99
    assert len(obj.data.materials) == 1

OUT.parent.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in coll('Asset').all_objects:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True, use_active_scene=True,
    export_apply=True, export_yup=True, export_normals=True,
    export_materials='EXPORT', export_texcoords=True, export_extras=True,
    export_cameras=False, export_lights=False)
shutil.copy2(OUT, PUBLIC)

studio(elev=9, azim=-12, lens=48)
sc.render.resolution_x, sc.render.resolution_y = 1200, 1000
bpy.context.view_layer.update()
frame(margin=1.16)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'employee-board.blend'), compress=True)
if '--no-render' not in sys.argv:
    render(name='EmployeeBoard', res=(1200, 1000), samples=32)
print('EMPLOYEE_BOARD', OUT, OUT.stat().st_size, 'bytes; body tris:', tris() - 16)
