# sign_fixes.py -- move lettering that a model had buried inside its own geometry (2026-11-11 signs audit), without
# rebuilding the whole .blend: it moves the named objects in their scene, re-exports that scene's GLB to glb/ and
# public/models/ (story_retext.py's export_scene, which places every part by its evaluated world matrix) and saves the
# .blend. The build scripts carry the same numbers, so a full rebuild matches.
#   ShowerBlock (buildings.blend, yard.py): SHOWERS - 10 CENTS sat at the height of the tin roof, whose front edge runs
#   0.2 m further out than the sign, so the roof slab went straight through the lettering. The sign now hangs on the
#   roof's front edge instead.
# Run headless:  ~/blender/blender -b art/blender/buildings.blend --factory-startup --python art/blender/sign_fixes.py
#   Add "-- --asis" to export unchanged into the scratch folder first (to check the .blend still matches the shipped GLB).
import bpy, os, sys, shutil
HERE = os.path.dirname(os.path.abspath(bpy.data.filepath)); globals()['__file__'] = os.path.join(HERE, 'sign_fixes.py')
src = open(os.path.join(HERE, 'story_retext.py')).read()
exec(src[:src.index('def retext(')].replace("ASIS = '--asis' in sys.argv", "ASIS = False"))   # cgl_blender.py + export_scene()
ASIS = '--asis' in sys.argv
OUT_ASIS = os.environ.get('SIGN_FIXES_ASIS', '/tmp/sign-fixes-asis')
# scene: [(object, new location (Blender, parent space))]
MOVES = {
 'buildings.blend': {
  'ShowerBlock': [('sign', (0, -1.40, 2.65)), ('signtxt', (0, -1.43, 2.65))],
 },
}
for scn, moves in MOVES.get(os.path.basename(bpy.data.filepath), {}).items():
    sc = bpy.data.scenes[scn]; bpy.context.window.scene = sc
    if ASIS:
        print('ASIS', scn, export_scene(sc, os.path.join(OUT_ASIS, scn + '.glb'))); continue
    for name, loc in moves:
        o = sc.objects[name]; print('MOVE', scn, name, tuple(round(v, 3) for v in o.location), '->', loc); o.location = loc
    out = os.path.join(HERE, 'glb', scn + '.glb'); print('EXPORT', scn, export_scene(sc, out), 'tris')
    shutil.copy2(out, os.path.join(HERE, '..', '..', 'public', 'models', scn + '.glb'))
if not ASIS: bpy.ops.wm.save_mainfile()
