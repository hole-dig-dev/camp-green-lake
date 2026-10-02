# blend: props.blend
# The sifter (the gold rush, JT 2026-09-30): a desert dry washer in the camp yard. You tip your bucket of sand into the
# hopper, the blower puffs the light sand away down the riffle tray and the gold stays in the riffles and the catch pan
# (public/js/45-state.js siftBucket, public/sim.js GOLD.SIFTER). Exported to glb/Sifter.glb for public/models/.
#   Sifter   about 2.6 m long and 1.3 m wide; origin on the ground at its middle. The tray runs along Blender X, falling
#            from the hopper (-X, ~1.5 m up) to the catch pan (+X). The blower sits on the -Y side (= game +z).
# Run with the live Blender:  python3 bx.py sifter.py   (bx.py opens props.blend)
import bpy,os,math,random,json,shutil
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'sifter.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
exec(open(os.path.join(HERE,'pipeline_common.py')).read())
from mathutils import Vector
OUT=os.path.join(ART,'glb');rnd=random.Random(1849)
PREVIEW=globals().get('SIFTER_PREVIEW',True)
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
# Sand is animated in 89-goldfx.js; keep the later assets' seeded variation stable.
for _ in range(61):rnd.random()

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
# The hopper fills and drains during the pour.
# the blower: a drum and crank on the -Y side, a canvas hose up under the tray
bx_,by_=-0.35,-0.75
cyl('drum',0.26,0.34,(bx_,by_,0.42),RED,verts=16,rot=(math.pi/2,0,0),bevel=0.01,parent=r)
cyl('drumcap',0.27,0.03,(bx_,by_-0.18,0.42),IRON,verts=16,rot=(math.pi/2,0,0),bevel=0,parent=r)
for s in(-1,1):B(f'drumleg{s}',(0.05,0.05,0.2),(bx_+s*0.18,by_,0.1),IRON,p=r)
B('drumbase',(0.5,0.3,0.04),(bx_,by_,0.02),WOOD[2],p=r)
tube('crank',(bx_,by_-0.2,0.42),(bx_,by_-0.34,0.42),0.02,IRON,r)   # the axle stub; the arm and handle are SifterCrank (below), which the game turns
CRANK_AT=(bx_,by_-0.34,0.42)   # where SifterCrank's origin sits, in the sifter's frame (the game: public/js/91-goldfx.js)
pts=[(bx_,by_+0.1,0.62),(bx_+0.15,-0.35,0.85),(0.0,-0.05,1.0)]   # drum to the tray's underside
for i in range(len(pts)-1):tube(f'hose{i}',pts[i],pts[i+1],0.07,CANVAS,r,v=10)
# the catch pan at the low end, and a tailings pile
cyl('pan',0.3,0.06,(X1+0.32,0,0.04),TIN,verts=20,r2=0.22,bevel=0.004,parent=r)
cyl('pansand',0.2,0.02,(X1+0.32,0,0.06),SAND,verts=16,bevel=0,parent=r)
# No decorative gold: the batch only reveals gold after it reaches the catch pan.
for _ in range(18):rnd.random()
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
# Permanent clear pipeline fitting. Keep all existing tray/crank frames unchanged.
# Centreline is the single source of truth for both mesh and game inlet animation.
inlet=inlet_points()
hollow_path('pipeline_inlet',inlet,parent=r)
ring_x('inlet_socket_band',-1.87,0.04,0.14,0.121,IRON,r)
B('inlet_sleeper',(0.34,0.43,0.06),(-1.73,0,0.03),WOOD[2],p=r)
B('inlet_saddle',(0.15,0.14,0.08),(-1.84,0,0.10),WOOD[1],p=r)
B('inlet_stay',(0.04,0.04,1.92),(-1.6,0.19,0.96),IRON,p=r)
for z in (0.72,1.65):
    B('inlet_stay_tie',(0.04,0.22,0.035),(-1.6,0.11,z),IRON,p=r)
    # Small bands on the upright keep a mostly clear view of sand ascending.
    hollow_path('inlet_riser_band',[(-1.6,0,z-0.012),(-1.6,0,z+0.012)],
                outer=0.137,inner=0.121,material=mat(*IRON),parent=r)
game_path={'points':[[round(x,6),round(z,6),round(-y,6)] for x,y,z in inlet]}
with open(os.path.join(OUT,'PipeInletPath.json'),'w') as f:json.dump(game_path,f,separators=(',',':'));f.write('\n')
shutil.copy2(os.path.join(OUT,'PipeInletPath.json'),os.path.join(ART,'../../public/models/PipeInletPath.json'))
# Export the moving tray separately, in the same origin/frame as Sifter.
bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
tray_parts=[(o.name,bpy.data.meshes.new_from_object(o.evaluated_get(dg)),o.matrix_world.copy()) for o in tray.children if o.type=='MESH']
for o in list(tray.children):bpy.data.objects.remove(o,do_unlink=True)
bpy.data.objects.remove(tray,do_unlink=True)
scene('SifterTray');tr=root('SifterTray')
for n,me,mw in tray_parts:
    me.transform(mw);o=bpy.data.objects.new(n,me);_link(o);o.parent=tr
p=pipeline_export(os.path.join(OUT,'SifterTray.glb'),tr);print('SifterTray',p[1],p[2])
scene('Sifter',fresh=False)
instance('tray_preview','SifterTray')
studio(elev=24,azim=-40,lens=40,floor=False);frame(margin=1.1)
if PREVIEW:render(res=(900,600),samples=16)
p=pipeline_export(os.path.join(OUT,'Sifter.glb'),r);print('Sifter',p[1],p[2])
for name in ('Sifter','SifterTray'):
    shutil.copy2(os.path.join(OUT,name+'.glb'),os.path.join(ART,'../../public/models'))
# Inlet-only rebuild preserves all other prop scenes and their authored materials.
# SifterCrank already has the same axle frame; it needs no rebuild for this fitting.
if os.environ.get('SIFTER_ONLY')=='1':
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath,compress=True)
    raise SystemExit(0)

# ---- the crew's bucket (public/js/30-npcs.js): each D Tent camper fills one digging, carries it by the bail to the
#   sifter (86-walkie.js holds it like the first-aid kit). Origin at the bottom; the bail's top (the grip) at 0.40 m.
scene('CampBucket');r=root('CampBucket')
cyl('pail',0.15,0.28,(0,0,0.14),TIN,verts=16,r2=0.12,bevel=0.004,parent=r)
cyl('sand',0.146,0.03,(0,0,0.285),SAND,verts=16,bevel=0,parent=r)   # heaped to the brim
for k in range(3):B(f'clod{k}',(0.06,0.05,0.03),(J(0.06),J(0.06),0.305),SAND,p=r,bv=0.01)
for s_ in(-1,1):cyl(f'lug{s_}',0.02,0.02,(s_*0.15,0,0.25),IRON,verts=6,rot=(0,math.pi/2,0),bevel=0,parent=r)
tube('bailL',(-0.15,0,0.25),(-0.08,0,0.39),0.007,IRON,r,v=5);tube('bailT',(-0.08,0,0.39),(0.08,0,0.39),0.007,IRON,r,v=5);tube('bailR',(0.08,0,0.39),(0.15,0,0.25),0.007,IRON,r,v=5)
cyl('grip',0.014,0.1,(0,0,0.395),WOOD[1],verts=8,rot=(0,math.pi/2,0),bevel=0,parent=r)
studio(elev=24,azim=-40,lens=50,floor=False);frame(margin=1.2)
if PREVIEW:render(res=(600,600),samples=16)
p=export_glb(os.path.join(OUT,'CampBucket.glb'));print('CampBucket',p[1],p[2])

# ---- the sifter's crank (arm + handle), on its own so the game can turn it while the blower runs. Origin on the axle;
#   it turns about Blender Y (the drum's axis).
scene('SifterCrank');r=root('SifterCrank')
tube('crankarm',(0,0,0),(0.18,0,0.14),0.018,IRON,r)
tube('handle',(0.18,0,0.14),(0.18,-0.12,0.14),0.025,WOOD[1],r)
cyl('hub',0.035,0.03,(0,0,0),IRON,verts=10,rot=(math.pi/2,0,0),bevel=0,parent=r)
studio(elev=20,azim=-40,lens=60,floor=False);frame(margin=1.4)
if PREVIEW:render(res=(400,400),samples=8)
p=pipeline_export(os.path.join(OUT,'SifterCrank.glb'),r);print('SifterCrank',p[1],p[2])
shutil.copy2(p[0],os.path.join(ART,'../../public/models'))

# ---- the gold pan (the store's first tool; panning at the wash tub, 91-goldfx.js). A shallow, wide steel pan with
#   riffles on one side of the wall to trap the gold. Origin at the bottom's centre; rim up +Z, 0.07 m tall, 0.2 m radius.
scene('GoldPan');r=root('GoldPan')
PANSTEEL=M_('pan_steel',(0x3a,0x3c,0x40),0.45,0.75)
cyl('panbase',0.115,0.012,(0,0,0.006),PANSTEEL,verts=24,bevel=0.002,parent=r)
import bmesh
bm=bmesh.new();N=28;lo=[bm.verts.new((math.cos(k/N*math.tau)*0.115,math.sin(k/N*math.tau)*0.115,0.012)) for k in range(N)];hi=[bm.verts.new((math.cos(k/N*math.tau)*0.2,math.sin(k/N*math.tau)*0.2,0.07)) for k in range(N)]
for k in range(N):bm.faces.new((lo[k],lo[(k+1)%N],hi[(k+1)%N],hi[k]))   # the sloping wall, open at the top
me=bpy.data.meshes.new('panwall');bm.to_mesh(me);bm.free();o=bpy.data.objects.new('panwall',me);_link(o)
so=o.modifiers.new('Thick','SOLIDIFY');so.thickness=0.006;_finish(o,PANSTEEL,0,r)
bpy.ops.mesh.primitive_torus_add(major_radius=0.2,minor_radius=0.006,major_segments=28,minor_segments=6,location=(0,0,0.071));o=bpy.context.active_object;o.name='rim';_finish(o,PANSTEEL,0,r)   # a rolled rim (a ring, not a lid)
for k in range(3):   # the riffles: three ridges round one side of the wall
    z=0.026+k*0.014;rr=0.13+k*0.025
    for j in range(7):a=math.pi*0.55+j*0.13;B(f'riffle{k}_{j}',(0.03,0.006,0.005),(math.cos(a)*rr,math.sin(a)*rr,z),PANSTEEL,rot=(0.5,0,a+math.pi/2),p=r,bv=0)
studio(elev=40,azim=-30,lens=60,floor=False);frame(margin=1.3)
if PREVIEW:render(res=(500,500),samples=12)
p=export_glb(os.path.join(OUT,'GoldPan.glb'));print('GoldPan',p[1],p[2])

# ---- the wash tub by the water drums: a half barrel of muddy water you pan in. Origin at the bottom's centre; water at 0.4 m.
scene('WashTub');r=root('WashTub')
TUBWATER=M_('tub_water',(0x5e,0x58,0x3a),0.12,0.0)   # muddy, greenish
for k in range(16):   # staves
    a=k/16*math.tau;B(f'stave{k}',(0.17,0.04,0.48),(math.cos(a)*0.43,math.sin(a)*0.43,0.24),rnd.choice(WOOD),rot=(0,0,a+math.pi/2),p=r,bv=0.005)
for z in(0.08,0.4):cyl(f'hoop{z}',0.455,0.035,(0,0,z),IRON,verts=24,bevel=0,parent=r)
cyl('tubfloor',0.42,0.03,(0,0,0.03),WOOD[2],verts=20,bevel=0,parent=r)
cyl('water',0.415,0.02,(0,0,0.4),TUBWATER,verts=24,bevel=0,parent=r)
for k in range(4):B(f'slop{k}',(0.25+J(0.1),0.2+J(0.08),0.01),(J(0.6)+0.55,J(0.6),0.006),SAND,rot=(0,0,J(3)),p=r,bv=0.004)   # spilled sand round the foot
studio(elev=30,azim=-30,lens=50,floor=False);frame(margin=1.2)
if PREVIEW:render(res=(500,500),samples=12)
p=export_glb(os.path.join(OUT,'WashTub.glb'));print('WashTub',p[1],p[2])
bpy.ops.wm.save_mainfile()
