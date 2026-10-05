"""Build/export the isolated FP model without opening or saving characters.blend.

~/blender/blender -b --factory-startup --python-exit-code 1 \
    --python art/blender/camper_fp_export.py
"""
from pathlib import Path
import bpy
repo = Path(__file__).resolve().parents[2]
source = repo / 'blender/cgl_scoopfp.py'
# __file__ belongs to the script being executed: give the authoring module its path.
namespace = {'__file__': str(source)}
exec(compile(source.read_text(), str(source), 'exec'), namespace)
for obj in list(bpy.context.scene.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
rig = namespace['build_scoopfp']()
bpy.context.scene.name = 'ScoopFP'
bpy.context.scene.render.fps = namespace['FPS']
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 45
bpy.context.scene.frame_set(0)
namespace['export_scoopfp'](rig, repo / 'public/models/camper-fp.glb')
bpy.ops.wm.save_as_mainfile(filepath=str(repo / 'art/blender/camper-fp.blend'), compress=True)
