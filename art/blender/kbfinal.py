exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
import bmesh,re
exec(open('/tmp/claude-1001/bl/kb.py').read().split("R=0.02;L=0.085")[0].split("exec(open(")[1].split("\n",1)[1])   # reuse kb.py's materials + engrave()/ob()/finish()
R=0.02;L=0.085
# KB tube: #4's design with the cap on -- KB engraved on the base, a thin collar showing, the lipstick hidden inside
n='KBTube';scene(n);r=root(n)
cyl('base',R,L*0.55,(0,0,L*0.275),GOLD,verts=24,bevel=0.002,parent=r)
cyl('collar',R*0.9,0.006,(0,0,L*0.55+0.003),GOLD2,verts=24,bevel=0,parent=r)
cyl('bullet',R*0.62,0.03,(0,0,L*0.55+0.02),RED,verts=16,bevel=0,parent=r)
cyl('cap',R*1.04,L*0.45,(0,0,L*0.55+0.004+L*0.225),GOLD,verts=24,bevel=0.003,parent=r)
cyl('capend',R*0.96,0.003,(0,0,L*0.55+0.004+L*0.45+0.0015),PALE,verts=24,bevel=0,parent=r)
engrave(ob('base'),'KB',L*0.3,0.02,r=R)
finish(n,margin=1.15)
bpy.context.window.scene=bpy.data.scenes['Camper'];bpy.ops.wm.save_mainfile()
