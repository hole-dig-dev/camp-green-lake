"""art/blender/deholes_blend.py : bring the names INSIDE the .blend files in line with the DRYWATER setting (docs/STORY.md).

The game's models were renamed (WardenHouse.glb -> SuptHouse.glb and so on) and the build scripts with them. The
.blend files still carried the old scene, object and material names, and finds.blend still held variant scenes of
things that no longer exist. Run on one .blend at a time, this:
  - renames every datablock whose name contains an old name (scenes, their Asset/Studio collections, objects,
    meshes, materials, worlds, cameras, lights), using RENAMES below;
  - renames the three lettering objects that were simply called "kb" by what they are in their scene;
  - finds.blend only: deletes the scenes of the lipstick tube (KBTube, KB_v01..10), the silver lipstick (Lip_1..5)
    and the suitcase (Case_1..5), which lm_case.py, match_safe.py and lil_strongbox.py replace, and re-letters the
    three unshipped variants that still read SPICED / SPLOOSH / KB;
  - prints what it did and any old name still present, then saves (the files stay compressed).
Nothing is exported: the shipped GLBs' inner names are handled by glb_rename.py. Safe to run again.

Run, once per file:
  blender -b art/blender/<file>.blend --factory-startup --python art/blender/deholes_blend.py
"""
import bpy, os, re, math
HERE = os.path.dirname(os.path.abspath(bpy.data.filepath)); FILE = os.path.basename(bpy.data.filepath)
FONT = os.path.join(HERE, '..', 'fonts', 'Anton.ttf')
RENAMES = [('WardenHouse', 'SuptHouse'), ('WardenRoom', 'SuptRoom'), ('WardenDesk', 'SuptDesk'), ('WardenNote', 'SuptNote'),
           ('MrSirTruck', 'DutchJeep'), ('WreckRoom', 'CompanyStore'), ('SignBigThumb', 'SignChimney'),
           ('TownBldg_kate', 'TownBldg_lil'), ('TownBldg_sheriff', 'TownBldg_marshal'), ('Sploosh_', 'Shine_'),
           ('kb_sand', 'find_sand'), ('onion', 'bitterroot'), ('polishcap', 'inkcap'), ('cgl_polish', 'cgl_redink'), ('polish', 'inkbottle'),
           ('kate1', 'lil1'), ('kate2', 'lil2'), ('brand_green_lake', 'brand_drywater'), ('maryloutxt', 'boattxt'), ('lipstickbox', 'velvetbox')]
DROP_SCENES = re.compile(r'^(KBTube|KB_v\d+|Lip_\d|Case_\d)$') if FILE == 'finds.blend' else None
RETEXT = {'finds.blend': [('Jar_2', r'_lt1(\.\d+)?$', 'BRANDIED', 0.009, 0.0003), ('Shine_3', r'^lbl(\.\d+)?$', 'PEACH SHINE', 0.0065, 0.0003), ('Locket_3', r'^eng(\.\d+)?$', 'LM', 0.012, 0.0004)]}
OLD = re.compile(r'(?i)warden|mrsir|kate|sheriff|zeroni|bigthumb|wreckroom|sploosh|onion|(^|_)kb(_|\.|$)|lipstick|suitcase|green.?lake|stanley|yelnats|marylou|polish|curse|pendanski|xray|armpit|squid|zigzag|caveman')
def blocks():
    for coll in (bpy.data.scenes, bpy.data.collections, bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.worlds, bpy.data.cameras,
                 bpy.data.lights, bpy.data.curves, bpy.data.images, bpy.data.actions, bpy.data.armatures, bpy.data.node_groups, bpy.data.texts):
        for b in coll: yield b
changed = 0
# 1. scenes that go
if DROP_SCENES:
    for sc in [s for s in bpy.data.scenes if DROP_SCENES.match(s.name)]:
        name = sc.name
        for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
        for c in list(sc.collection.children): bpy.data.collections.remove(c)
        w = sc.world; bpy.data.scenes.remove(sc)
        if w and w.users == 0: bpy.data.worlds.remove(w)
        print('DEHOLES drop scene', name); changed += 1
    for coll in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights, bpy.data.curves, bpy.data.materials):
        for b in [b for b in coll if b.users == 0]: coll.remove(b)
# 2. the three objects that were just called "kb"
for sc in bpy.data.scenes:
    for o in sc.objects:
        if re.match(r'^kb(\.\d+)?$', o.name):
            new = 'lmtxt' if sc.name.startswith('TownBldg_vault') else 'banktxt' if sc.name.startswith('Box_') else 'keys'
            print('DEHOLES object %s/%s -> %s' % (sc.name, o.name, new)); o.name = new
            if o.data and re.match(r'^kb(\.\d+)?$', o.data.name): o.data.name = new
            changed += 1
# 3. names
for b in list(blocks()):
    new = b.name
    for a, r in RENAMES: new = new.replace(a, r)
    if new != b.name: print('DEHOLES %s %s -> %s' % (type(b).__name__, b.name, new)); b.name = new; changed += 1
# 4. lettering on unshipped variants (same place, font, depth and material; shrunk to the old width if longer)
def retext(sc, old, s, size, extrude):
    vl = sc.view_layers[0]; xs = [v.co.x for v in old.data.vertices]; oldw = (max(xs) - min(xs)) * old.scale.x
    cu = bpy.data.curves.new(old.name, 'FONT'); cu.body = s; cu.font = bpy.data.fonts.load(FONT, check_existing=True); cu.size = size
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = extrude; cu.resolution_u = 2
    o = bpy.data.objects.new(old.name + '.new', cu)
    for c in old.users_collection: c.objects.link(o)
    o.parent = old.parent; o.matrix_parent_inverse = old.matrix_parent_inverse.copy(); o.location = old.location; o.rotation_euler = old.rotation_euler
    with bpy.context.temp_override(window=bpy.context.window, scene=sc, view_layer=vl, active_object=o, object=o, selected_objects=[o], selected_editable_objects=[o]):
        bpy.ops.object.convert(target='MESH')
    o = sc.objects[old.name + '.new']; o.data.materials.clear()
    for m in old.data.materials: o.data.materials.append(m)
    xs = [v.co.x for v in o.data.vertices]; k = min(1.0, oldw / (max(xs) - min(xs))); o.scale = (k, k, k)
    name = old.name; me = old.data; bpy.data.objects.remove(old, do_unlink=True)
    if me.users == 0: bpy.data.meshes.remove(me)
    o.name = name; o['lettering'] = s
for scn, pat, s, size, extrude in RETEXT.get(FILE, []):
    sc = bpy.data.scenes.get(scn)
    if not sc: print('DEHOLES retext: no scene', scn); continue
    for o in [o for o in sc.objects if re.search(pat, o.name) and o.type == 'MESH' and o.get('lettering') != s]:
        was = o.name; bpy.context.window.scene = sc; retext(sc, o, s, size, extrude); print('DEHOLES retext %s/%s -> %r' % (scn, was, s)); changed += 1
left = sorted(set('%s %s' % (type(b).__name__, b.name) for b in blocks() if OLD.search(b.name)))
print('DEHOLES %s: %d changes; old names left: %s' % (FILE, changed, left or 'none'))
if changed: bpy.ops.wm.save_mainfile()
