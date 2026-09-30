# Rebuild the signs (signs.py) and export the ones listed in EXPORT to glb/.
# Run with the checkout's camp-green-lake-art.blend open:  python3 bx.py signs_export.py   then copy the GLBs to public/models/
EXPORT=['SignWreckRoom','SignDirections']
import bpy,os,re
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'signs.py')   # so cgl_blender.py's ART/RENDERS point at this checkout
s=open(os.path.join(HERE,'signs.py')).read()
exec(re.sub(r"open\('[^']*/([\w.]+)'\)\.read\(\)",lambda m:f"open(os.path.join(HERE,'{m.group(1)}')).read()",s))
for n in EXPORT:
    bpy.context.window.scene=bpy.data.scenes[n];print(export_glb(os.path.join(ART,'glb',n+'.glb')))
bpy.context.window.scene=bpy.data.scenes['ARCHIVED_Camper_minipc'];bpy.ops.wm.save_mainfile()
