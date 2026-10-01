# blend: props.blend
# The sifter (the gold rush, JT 2026-09-30): a desert dry washer in the camp yard. You tip your bucket of sand into the
# hopper, the blower puffs the light sand away down the riffle tray and the gold stays in the riffles and the catch pan
# (public/js/45-state.js siftBucket, public/sim.js GOLD.SIFTER). Exported to glb/Sifter.glb for public/models/.
#   Sifter   about 2.6 m long and 1.3 m wide; origin on the ground at its middle. The tray runs along Blender X, falling
#            from the hopper (-X, ~1.5 m up) to the catch pan (+X). The blower sits on the -Y side (= game +z).
# Run with the live Blender:  python3 bx.py sifter.py   (bx.py opens props.blend)
import bpy,os,math,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'sifter.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
from mathutils import Vector
OUT=os.path.join(ART,'glb');rnd=random.Random(1849)
def J(a=1.0):return rnd.uniform(-a,a)
def M_(n,c,r=0.9,m=0.0):return ('s_'+n,c,r,m)
WOOD=[M_('wood1',(0x8a,0x68,0x46)),M_('wood2',(0x74,0x56,0x3a)),M_('wood3',(0x66,0x4c,0x34))]
IRON=M_('iron',(0x4a,0x46,0x42),0.55,0.6);RUST=M_('rust',(0x8a,0x4a,0x2a),0.8,0.3);TIN=M_('tin',(0xa8,0xa4,0x9c),0.4,0.8)
CANVAS=M_('canvas',(0xb8,0xa8,0x84),0.95);SAND=M_('sand',(0xc9,0xa8,0x72),0.97);GOLD=M_('gold',(0xe8,0xb8,0x3a),0.25,1.0)
RED=M_('paint_red',(0xa0,0x2c,0x1c),0.7);BLACK=M_('rubber',(0x22,0x20,0x1e),0.9)
def B(n,size,loc,m,rot=(0,0,0),p=None,bv=0.01):return box(n,size,loc,m,rot=rot,bevel=bv,parent=p)
def tube(n,a,b,r,m,p,v=8):
    a,b=Vector(a),Vector(b);d=b-a;o=cyl(n,r,d.length,(a+b)/2,m,verts=v,bevel=0,parent=p);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o

scene('Sifter');r=root('Sifter')
L,W=2.2,0.62                       # the riffle tray
X0,X1,Z0,Z1=-1.05,1.05,1.32,0.78   # its high (hopper) end and low (pan) end, tray floor heights
ang=math.atan2(Z0-Z1,X1-X0)
tray=bpy.data.objects.new('tray',None);_link(tray);tray.parent=r;tray.location=((X0+X1)/2,0,(Z0+Z1)/2);tray.rotation_euler=(0,ang,0)
sl=math.hypot(X1-X0,Z0-Z1)
B('floor',(sl,W,0.03),(0,0,0),WOOD[0],p=tray)
for s in(-1,1):B(f'side{s}',(sl,0.04,0.2),(0,s*(W/2+0.02),0.09),WOOD[1],p=tray)
for k in range(9):B(f'riffle{k}',(0.03,W,0.04),(-sl/2+0.35+k*0.2,0,0.035),TIN if k%2 else IRON,p=tray,bv=0.003)   # the riffles: the gold catches behind them
for k in range(7):B(f'cloth{k}',(0.16,W-0.02,0.005),(-sl/2+0.45+k*0.26,0,0.018),CANVAS,p=tray,bv=0)               # the cloth under them
for k in range(14):B(f'sand{k}',(0.12+J(0.04),0.14+J(0.05),0.02),(-sl/2+0.3+k*0.13+J(0.03),J(0.18),0.06),SAND,p=tray,bv=0.008)
for k in range(5):cyl(f'fleck{k}',0.012,0.006,(-sl/2+0.5+k*0.33,J(0.2),0.06),GOLD,verts=6,bevel=0,parent=tray)
# legs: tall at the hopper end, short at the pan end, cross-braced
for x,h in((X0+0.08,Z0),(X1-0.08,Z1)):
    for s in(-1,1):B(f'leg{x:.1f}{s}',(0.07,0.07,h),(x,s*(W/2+0.05),h/2),WOOD[2],p=r)
for s in(-1,1):tube(f'brace{s}',(X0+0.08,s*(W/2+0.05),0.15),(X1-0.08,s*(W/2+0.05),Z1-0.1),0.025,WOOD[1],r)
B('crossbar',(0.06,W+0.16,0.06),(X0+0.08,0,0.45),WOOD[1],p=r)
# the hopper over the high end, with the grizzly (iron bars) on top: you tip your bucket in here
hx,hz=X0+0.2,Z0+0.32
for s in(-1,1):
    B(f'hopS{s}',(0.62,0.04,0.42),(hx,s*0.33,hz),WOOD[0],rot=(-s*0.25,0,0),p=r)   # flared: wider at the top
    B(f'hopE{s}',(0.04,0.66,0.42),(hx+s*0.3,0,hz),WOOD[0],rot=(0,s*0.25,0),p=r)
for k in range(7):tube(f'bar{k}',(hx-0.36,-0.33+k*0.11,hz+0.22),(hx+0.36,-0.33+k*0.11,hz+0.22),0.012,IRON,r,v=6)
B('hopsand',(0.5,0.5,0.06),(hx,0,hz-0.05),SAND,p=r,bv=0.02)
# the blower: a drum and crank on the -Y side, a canvas hose up under the tray
bx_,by_=-0.35,-0.75
cyl('drum',0.26,0.34,(bx_,by_,0.42),RED,verts=16,rot=(math.pi/2,0,0),bevel=0.01,parent=r)
cyl('drumcap',0.27,0.03,(bx_,by_-0.18,0.42),IRON,verts=16,rot=(math.pi/2,0,0),bevel=0,parent=r)
for s in(-1,1):B(f'drumleg{s}',(0.05,0.05,0.2),(bx_+s*0.18,by_,0.1),IRON,p=r)
B('drumbase',(0.5,0.3,0.04),(bx_,by_,0.02),WOOD[2],p=r)
tube('crank',(bx_,by_-0.2,0.42),(bx_,by_-0.34,0.42),0.02,IRON,r)
tube('crankarm',(bx_,by_-0.34,0.42),(bx_+0.18,by_-0.34,0.56),0.018,IRON,r)
tube('handle',(bx_+0.18,by_-0.34,0.56),(bx_+0.18,by_-0.46,0.56),0.025,WOOD[1],r)
pts=[(bx_,by_+0.1,0.62),(bx_+0.15,-0.35,0.85),(0.0,-0.05,1.0)]   # drum to the tray's underside
for i in range(len(pts)-1):tube(f'hose{i}',pts[i],pts[i+1],0.07,CANVAS,r,v=10)
# the catch pan at the low end, and a tailings pile
cyl('pan',0.3,0.06,(X1+0.32,0,0.04),TIN,verts=20,r2=0.22,bevel=0.004,parent=r)
cyl('pansand',0.2,0.02,(X1+0.32,0,0.06),SAND,verts=16,bevel=0,parent=r)
for k in range(6):cyl(f'nug{k}',0.018+J(0.006),0.012,(X1+0.32+J(0.12),J(0.12),0.075),GOLD,verts=6,bevel=0,parent=r)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(X1+0.1,0.62,0));o=bpy.context.active_object;o.name='tailings';o.scale=(0.55,0.4,0.22)
bpy.ops.object.transform_apply(scale=True);_finish(o,SAND,0,r)
# a bucket waiting by the hopper, and the sign
cyl('bucket',0.17,0.3,(X0-0.25,0.45,0.15),TIN,verts=14,r2=0.14,bevel=0.004,parent=r)
cyl('bucketsand',0.16,0.02,(X0-0.25,0.45,0.29),SAND,verts=14,bevel=0,parent=r)
tube('bail',(X0-0.42,0.45,0.28),(X0-0.25,0.45,0.42),0.008,IRON,r,v=5);tube('bail2',(X0-0.25,0.45,0.42),(X0-0.08,0.45,0.28),0.008,IRON,r,v=5)
B('signpost',(0.06,0.06,1.6),(X1-0.25,0.47,0.8),WOOD[2],p=r)   # behind the board
B('signboard',(0.9,0.04,0.32),(X1-0.25,0.52,1.5),WOOD[0],p=r)
text('signtxt','SIFTER',(X1-0.25,0.545,1.52),0.2,('ink','ink',0.8),rot=(math.pi/2,0,math.pi),parent=r)   # on the +Y face: the yard side (game -z)
text('signtxt2','SAND IN · GOLD OUT',(X1-0.25,0.545,1.39),0.07,('ink','ink',0.8),rot=(math.pi/2,0,math.pi),parent=r)
studio(elev=24,azim=-40,lens=40,floor=False);frame(margin=1.1);render(res=(900,600),samples=16)
p=export_glb(os.path.join(OUT,'Sifter.glb'));print('Sifter',p[1],p[2])

# ---- the crew's bucket (public/js/30-npcs.js): each D Tent camper fills one digging, carries it by the bail to the
#   sifter (86-walkie.js holds it like the first-aid kit). Origin at the bottom; the bail's top (the grip) at 0.40 m.
scene('CampBucket');r=root('CampBucket')
cyl('pail',0.15,0.28,(0,0,0.14),TIN,verts=16,r2=0.12,bevel=0.004,parent=r)
cyl('sand',0.146,0.03,(0,0,0.285),SAND,verts=16,bevel=0,parent=r)   # heaped to the brim
for k in range(3):B(f'clod{k}',(0.06,0.05,0.03),(J(0.06),J(0.06),0.305),SAND,p=r,bv=0.01)
for s_ in(-1,1):cyl(f'lug{s_}',0.02,0.02,(s_*0.15,0,0.25),IRON,verts=6,rot=(0,math.pi/2,0),bevel=0,parent=r)
tube('bailL',(-0.15,0,0.25),(-0.08,0,0.39),0.007,IRON,r,v=5);tube('bailT',(-0.08,0,0.39),(0.08,0,0.39),0.007,IRON,r,v=5);tube('bailR',(0.08,0,0.39),(0.15,0,0.25),0.007,IRON,r,v=5)
cyl('grip',0.014,0.1,(0,0,0.395),WOOD[1],verts=8,rot=(0,math.pi/2,0),bevel=0,parent=r)
studio(elev=24,azim=-40,lens=50,floor=False);frame(margin=1.2);render(res=(600,600),samples=16)
p=export_glb(os.path.join(OUT,'CampBucket.glb'));print('CampBucket',p[1],p[2])
bpy.ops.wm.save_mainfile()
