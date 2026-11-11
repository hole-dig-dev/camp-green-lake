# sign_fixes.py -- move lettering that a model had buried inside its own geometry (2026-11-11 signs audit), without
# rebuilding the whole .blend: it moves the named objects in their scene, re-exports that scene's GLB to glb/ and
# public/models/ (story_retext.py's export_scene, which places every part by its evaluated world matrix) and saves the
# .blend. The build scripts carry the same numbers, so a full rebuild matches.
#   ShowerBlock (buildings.blend, yard.py): SHOWERS - 10 CENTS sat at the height of the tin roof, whose front edge runs
#   0.2 m further out than the sign, so the roof slab went straight through the lettering. The sign now hangs on the
#   roof's front edge instead.
#   SignDirections (props.blend, signs.py): every arrow turned to point at what it names from where the post stands
#   (public/js/23-models.js CAMP_PROPS, moved to (-8.2, 33.6) so THE LAKE clears the Employee of the Day board).
#   SupplyCrate (props.blend, furniture.py): DRC stencilled on the back face too, so a stacked crate reads either way.
# Run headless:  ~/blender/blender -b art/blender/buildings.blend --factory-startup --python art/blender/sign_fixes.py
#   Add "-- --asis" to export unchanged into the scratch folder first (to check the .blend still matches the shipped GLB).
import bpy, os, sys, shutil, math
HERE = os.path.dirname(os.path.abspath(bpy.data.filepath)); globals()['__file__'] = os.path.join(HERE, 'sign_fixes.py')
src = open(os.path.join(HERE, 'story_retext.py')).read()
exec(src[:src.index('def retext(')].replace("ASIS = '--asis' in sys.argv", "ASIS = False"))   # cgl_blender.py + export_scene()
ASIS = '--asis' in sys.argv
OUT_ASIS = os.environ.get('SIGN_FIXES_ASIS', '/tmp/sign-fixes-asis')
# scene: [(object, new location (Blender, parent space) or None, new rotation in degrees or None, copy as this name or None)]
MOVES = {
 'buildings.blend': {
  'ShowerBlock': [('sign', (0, -1.40, 2.65), None, None), ('signtxt', (0, -1.43, 2.65), None, None)],
 },
 'props.blend': {   # arrow angles: atan2(-dz, dx) from the post to the target, game metres (Blender y = game -z)
  'SignDirections': [('arrow_MESS_HALL', None, (0, 0, 3.8), None),      # mess tables (16, 32)
                     ('arrow_SUPPLY_DEPOT', None, (0, 0, -20.1), None),  # COMPANY STORE: its window (16, 42.47)
                     ('arrow_D_TENT', None, (0, 0, -45.1), None),        # BUNK D: its door (0, 41.82)
                     ('arrow_THE_LAKE', None, (0, 0, 38.0), None)],      # the main gate (0, 27.2)
  'SupplyCrate': [('stencil', (0, 0.455, 0.5), (90, 0, 180), 'stencil_back')],
 },
}
for scn, moves in MOVES.get(os.path.basename(bpy.data.filepath), {}).items():
    sc = bpy.data.scenes[scn]; bpy.context.window.scene = sc
    if ASIS:
        print('ASIS', scn, export_scene(sc, os.path.join(OUT_ASIS, scn + '.glb'))); continue
    for name, loc, rot, copy in moves:
        o = sc.objects[name]
        if copy:
            if copy in sc.objects: print('SKIP', scn, copy, 'already there'); continue
            c = o.copy(); c.data = o.data.copy(); c.name = copy
            for col in o.users_collection: col.objects.link(c)
            o = c
        print('MOVE', scn, o.name, tuple(round(v, 3) for v in o.location), tuple(round(math.degrees(v), 1) for v in o.rotation_euler), '->', loc, rot)
        if loc: o.location = loc
        if rot: o.rotation_euler = tuple(math.radians(v) for v in rot)
    out = os.path.join(HERE, 'glb', scn + '.glb'); print('EXPORT', scn, export_scene(sc, out), 'tris')
    shutil.copy2(out, os.path.join(HERE, '..', '..', 'public', 'models', scn + '.glb'))
if not ASIS: bpy.ops.wm.save_mainfile()
