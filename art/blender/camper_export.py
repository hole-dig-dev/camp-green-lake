# blend: characters.blend
# Rebuild the camper (scene Camper: rig, wardrobe and every animation clip, blender/cgl_rig.py) and export it straight
# to public/models/camper.glb. Run with the live Blender:  python3 bx.py camper_export.py   (bx.py opens characters.blend)
import bpy,os
HERE=os.path.dirname(bpy.data.filepath);REPO=os.path.dirname(os.path.dirname(HERE));R=os.path.join(REPO,'blender')+os.sep
bpy.context.window.scene=bpy.data.scenes['Camper']
src=open(R+'cgl_rig.py').read().replace(r'C:\Users\jthol\Projects\camp-green-lake\blender\cgl_helpers.py',R+'cgl_helpers.py')
exec(src)
export_camper(os.path.join(REPO,'public','models','camper.glb'))
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
print('clips',sorted(a.name for a in bpy.data.actions if a.name in ANIMS))
