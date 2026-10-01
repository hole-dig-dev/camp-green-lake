# blend: props.blend
"""Opaque sediment cover for the existing sifter motion; no changes to the machine or grips.

A unit bay: game X/Z -0.5..0.5, Y 0..1. The client scales its depth from the
actual sand population in that bay. Fixed-size gold sits below this surface.
Run: cd art/blender && python3 bx.py goldfx_sediment.py
"""
import bpy, os, math, shutil
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'goldfx_sediment.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
scene('GoldFxRiffleSand');r=root('GoldFxRiffleSand')
verts=[];faces=[];NX,NZ=10,12
for i in range(NX+1):
    x=i/NX-.5
    for j in range(NZ+1):
        z=j/NZ-.5
        h=(.72+.22*(x+.5))*(.78+.22*math.cos(math.pi*z))+.018*math.sin(i*2+j*1.7)
        verts.append((x,-z,h))
for i in range(NX):
    for j in range(NZ):
        a=i*(NZ+1)+j;b=a+NZ+1
        faces.append((a,a+1,b+1,b))
# Close the edges so oblique views cannot look through the sediment from below.
edge=list(range(NZ+1))+[i*(NZ+1)+NZ for i in range(1,NX+1)]+[NX*(NZ+1)+j for j in range(NZ-1,-1,-1)]+[i*(NZ+1) for i in range(NX-1,0,-1)]
base=len(verts)
for k in edge:verts.append((verts[k][0],verts[k][1],0))
for i,k in enumerate(edge):
    q=(i+1)%len(edge);faces.append((k,edge[q],base+q,base+i))
faces.append(tuple(reversed(range(base,len(verts)))))
me=bpy.data.meshes.new('riffle_sediment');me.from_pydata(verts,[],faces);me.update()
o=bpy.data.objects.new('riffle_sediment',me);_link(o);_finish(o,('gfx_riffle_sand',(185,148,94),1,0),0,r)
path=os.path.join(HERE,'glb','GoldFxRiffleSand.glb');export_glb(path)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'props.blend'),compress=True)
shutil.copyfile(path,os.path.abspath(os.path.join(HERE,'..','..','public','models','GoldFxRiffleSand.glb')))
print('Exported opaque riffle sediment:',path)
