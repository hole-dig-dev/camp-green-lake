# blend: buildings.blend
# Rebuild just the Wreck Room (the cabin with the serving window, from buildings.py) and export glb/WreckRoom.glb,
# without re-running the tents, towers and the rest. Run with art/blender/buildings.blend open (bx.py opens it for you):
#   python3 bx.py wreckroom.py        then copy glb/WreckRoom.glb to public/models/
import bpy,os,re
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'buildings.py')   # so cgl_blender.py's ART/RENDERS point at this checkout
b=open(os.path.join(HERE,'buildings.py')).read()
b=re.sub(r"open\('[^']*/([\w.]+)'\)\.read\(\)",lambda m:f"open(os.path.join(HERE,'{m.group(1)}')).read()",b)
head=b.split('# ================= canvas tent')[0]
cab=b.split('# ---- the Wreck Room')[1].split("cabin('WardenHouse'")[0]
exec(head);exec('# ---- the Wreck Room'+cab)   # defines shop_front + cabin, then builds WreckRoom (and renders its preview)
print(export_glb(os.path.join(ART,'glb','WreckRoom.glb')))
bpy.ops.wm.save_mainfile()
