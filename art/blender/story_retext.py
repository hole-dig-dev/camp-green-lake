# story_retext.py -- swap the lettering baked into existing assets for the DRYWATER setting (docs/STORY.md),
# without rebuilding the assets. Each asset's lettering is its own mesh object in its scene (cgl_blender.text() makes it
# and export_glb() bakes it in), so this deletes the old lettering object, makes a new one in its place (same parent,
# position, rotation and material; shrunk to the old one's width if longer), re-exports that scene's GLB to glb/ and
# public/models/, and saves the .blend. The build scripts carry the same new strings, so a full rebuild matches.
# Run once per file, headless:
#   ~/blender/blender -b art/blender/props.blend --factory-startup --python art/blender/story_retext.py
#   (also buildings.blend, town.blend, gear.blend, finds.blend).  Not done here: TentRoomCrew (its .blend scene no longer
#   matches the shipped GLB; see bunk_board.py) and EmployeeBoard (lettering merged into the body: it needs its build script).  Add "-- --asis" to export unchanged into /tmp
#   (to check the .blend still matches the shipped GLB before touching it).
import bpy, os, sys, math, shutil
HERE = os.path.dirname(os.path.abspath(bpy.data.filepath)); globals()['__file__'] = os.path.join(HERE, 'story_retext.py')
exec(open(os.path.join(HERE, 'cgl_blender.py')).read())
ASIS = '--asis' in sys.argv
STENCIL = 'BigShouldersStencilDisplay'
# scene: (glb name or None for "scene name", [(object, new text, size, font, extrude, space, fit)...]); fit = widest it may be, as a share of the old lettering's width
JOBS = {
 'props.blend': {
  'SignCampEntrance': (None, [('title', 'CAMP DRYWATER', 0.62, 'Anton', 0.006, 1.05, 1.0), ('sub', 'DRYWATER RECLAMATION COMPANY', 0.27, 'Anton', 0.006, 1.1, 1.0)]),
  'SignCompanyStore': (None, [('txt-0.03', 'COMPANY STORE', 0.19, 'Anton', 0.006, 1.0, 1.0), ('txt0.03', 'COMPANY STORE', 0.19, 'Anton', 0.006, 1.0, 1.0)]),
  'SignLizardWarning': (None, [('l1', 'GOLD-EYED', 0.15, 'Anton', 0.006, 1.0, 1.0), ('l2', 'GILAS', 0.2, 'Anton', 0.006, 1.0, 1.0)]),
  'SignDirections': (None, [('t.002', 'COMPANY STORE', 0.19, 'Anton', 0.006, 1.0, 1.0), ('t.003', 'COMPANY STORE', 0.19, 'Anton', 0.006, 1.0, 1.0),
                            ('t.004', 'BUNK D', 0.19, 'Anton', 0.006, 1.0, 1.05), ('t.005', 'BUNK D', 0.19, 'Anton', 0.006, 1.0, 1.05)]),
  'SignChimney': (None, [('p1', 'CAMP DRYWATER', 0.12, 'Anton', 0.006, 1.0, 1.0)]),
  'SupplyCrate': (None, [('stencil', 'DRC', 0.22, STENCIL, 0.002, 1.0, 1.1)]),
  'SuptNote': (None, [('t4', "DON'T TELL DUTCH", 0.011, 'Anton', 0.0004, 1.0, 1.0)]),
 },
 'buildings.blend': {
  'MainGate': (None, [('arch_t1', 'CAMP DRYWATER', 0.62, STENCIL, 0.006, 1.0, 1.0)]),
  'SuptHouse': (None, [('plaquetxt', 'SUPERINTENDENT', 0.28, 'Anton', 0.006, 1.0, 1.15)]),
  'SuptRoom': (None, [('maptitle', 'LAKE DRYWATER - SEARCH GRID', 0.1, 'Anton', 0.006, 1.0, 1.0), ('lil1', '"LUCKY" LIL', 0.07, 'Anton', 0.006, 1.0, 1.0), ('lil2', 'MARLOW', 0.08, 'Anton', 0.006, 1.0, 1.0)]),
  'WaterTower': (None, [('tanktxt', 'DRC', 0.8, STENCIL, 0.01, 1.0, 1.1)]),
  'CompanyStore': (None, [('menu0', 'WATER  BITTERROOT', 0.13, 'Anton', 0.006, 1.0, 1.25), ('menu_s', 'GOLD ONLY', 0.12, 'Anton', 0.006, 1.0, 1.0)]),
  'TentRoomSmall': (None, [('rule0', '1. DIG', 0.05, 'Anton', 0.006, 1.0, 1.0), ('rule1', '2. THE COMPANY THANKS YOU', 0.05, 'Anton', 0.006, 1.0, 1.0)]),
  'ShowerBlock': (None, [('signtxt', 'SHOWERS - 10 CENTS', 0.16, 'Anton', 0.006, 1.0, 1.0)]),
 },
 'town.blend': {},   # done; town.py now builds the new lettering itself (door name boards since 2026-11-11, so the old objects are gone)
 'gear.blend': {
  'SodaMachine': (None, [('brand_drywater', 'DRYWATER', 0.113, 'Anton', 0, 1.0, 1.0)]),
 },
 'finds.blend': {
  'Safe_1': ('FindSafe', [('co', 'MARLOW BANK', 0.06, 'Anton', 0.003, 1.0, 1.0)]),
 },
}
def export_scene(sc, path):
    """cgl_blender.export_glb(), but placing each part by its EVALUATED world matrix: headless Blender only keeps the
    open scene's matrices up to date, so the original objects in every other scene still sit at the origin."""
    vl = sc.view_layers[0]
    with bpy.context.temp_override(window=bpy.context.window, scene=sc, view_layer=vl): dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    tmpc = bpy.data.collections.new(sc.name + '.Export'); sc.collection.children.link(tmpc); parts = []
    for o in sc.collection.children[sc.name + '.Asset'].all_objects:
        if o.type != 'MESH': continue
        eo = o.evaluated_get(dg); me = bpy.data.meshes.new_from_object(eo, preserve_all_data_layers=True, depsgraph=dg)
        me.transform(eo.matrix_world); t = bpy.data.objects.new(o.name + '.x', me); tmpc.objects.link(t); parts.append(t)
    with bpy.context.temp_override(window=bpy.context.window, scene=sc, view_layer=vl, active_object=parts[0], object=parts[0], selected_objects=parts, selected_editable_objects=parts):
        bpy.ops.object.join()
    j = parts[0]; j.name = sc.name; j.data.name = sc.name
    with bpy.context.temp_override(window=bpy.context.window, scene=sc, view_layer=vl, active_object=j, object=j):
        bpy.ops.object.material_slot_remove_unused()
    vl.active_layer_collection = vl.layer_collection.children[tmpc.name]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with bpy.context.temp_override(window=bpy.context.window, scene=sc, view_layer=vl):
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_active_scene=True, use_active_collection=True, export_apply=True, export_yup=True,
                                  export_normals=True, export_materials='EXPORT', export_extras=False, export_cameras=False, export_lights=False, export_texcoords=True)
    n = len(j.data.polygons); me = j.data; bpy.data.objects.remove(j, do_unlink=True); bpy.data.meshes.remove(me); bpy.data.collections.remove(tmpc)
    return n
def retext(sc, name, s, size, fontname, extrude, space, fit):
    old = sc.objects[name]; vl = sc.view_layers[0]
    xs = [v.co.x for v in old.data.vertices]; oldw = (max(xs) - min(xs)) * old.scale.x; oldc = (max(xs) + min(xs)) / 2
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = s; cu.font = font(fontname); cu.size = size
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = extrude; cu.space_character = space; cu.resolution_u = 2
    o = bpy.data.objects.new(name + '.new', cu)
    for c in old.users_collection: c.objects.link(o)
    o.parent = old.parent; o.matrix_parent_inverse = old.matrix_parent_inverse.copy()
    o.location = old.location; o.rotation_euler = old.rotation_euler; o.scale = (1, 1, 1)
    with bpy.context.temp_override(window=bpy.context.window, scene=sc, view_layer=vl, active_object=o, object=o, selected_objects=[o], selected_editable_objects=[o]):
        bpy.ops.object.convert(target='MESH')
    o = sc.objects[name + '.new']; o.data.materials.clear()
    for m in old.data.materials: o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = False
    xs = [v.co.x for v in o.data.vertices]; w = max(xs) - min(xs); k = min(1.0, oldw * fit / w)
    o.scale = (k, k, k)                                            # uniform, so the letters keep their shape
    me = old.data; bpy.data.objects.remove(old, do_unlink=True)
    if me.users == 0: bpy.data.meshes.remove(me)
    o.name = name
    return '%s -> %r (old width %.3f, new %.3f, scale %.2f)' % (name, s, oldw, w * k, k)
jobs = JOBS.get(os.path.basename(bpy.data.filepath), {})
for scn, (glb, edits) in jobs.items():
    sc = bpy.data.scenes[scn]; glb = glb or scn; bpy.context.window.scene = sc
    if ASIS:
        print('ASIS', scn, export_scene(sc, '/tmp/cgl-fable-story-shots/bl/asis/' + glb + '.glb')); continue
    for e in edits: print('RETEXT', scn, retext(sc, *e))
    out = os.path.join(HERE, 'glb', glb + '.glb'); print('EXPORT', scn, export_scene(sc, out), 'tris')
    shutil.copy2(out, os.path.join(HERE, '..', '..', 'public', 'models', glb + '.glb'))
if jobs and not ASIS: bpy.ops.wm.save_mainfile()
