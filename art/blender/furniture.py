exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
rnd=random.Random(11)
MET=('steel','steel',0.55,0.6)
def tube(name,a,b,r=0.022,m=MET,parent=None,verts=8):
    """A round tube from point a to point b (bed frames, ladder rails, chair legs)."""
    a,b=Vector(a),Vector(b);d=b-a
    o=cyl(name,r,d.length,(a+b)/2,m,verts=verts,bevel=0,parent=parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def mattress(name,w,l,z,parent,blanket='blanket'):
    box(name,(w,l,0.14),(0,0,z+0.07),('mattress','mattress',0.95),bevel=0.035,parent=parent)
    box(name+'_blanket',(w+0.02,l*0.72,0.05),(0,l*0.14,z+0.15),(blanket,blanket,0.95),bevel=0.02,parent=parent)
    box(name+'_fold',(w+0.03,0.16,0.07),(0,l*0.14-l*0.36,z+0.17),(blanket,blanket,0.95),bevel=0.03,parent=parent)
    box(name+'_pillow',(w*0.7,0.36,0.1),(0,-l/2+0.26,z+0.19),('paint_white','paint_white',0.95),bevel=0.045,parent=parent)

# ---------- BunkBed: steel double bunk, 1.3 x 2.35 footprint, mattress tops at 0.56 and 1.72 (matches BUNKS) ----------
scene('BunkBed');r=root('BunkBed');W,L=1.3,2.35
for x in (-W/2+0.04,W/2-0.04):
    for y in (-L/2+0.04,L/2-0.04):tube(f'leg{x}{y}',(x,y,0),(x,y,1.95),0.028,parent=r)
for z in (0.42,1.58):   # the two frames: side rails, end rails and a spring deck
    for x in (-W/2+0.04,W/2-0.04):tube(f'side{x}{z}',(x,-L/2,z),(x,L/2,z),parent=r)
    for y in (-L/2+0.04,L/2-0.04):tube(f'end{y}{z}',(-W/2,y,z),(W/2,y,z),parent=r)
    box(f'deck{z}',(W-0.1,L-0.1,0.02),(0,0,z),('mesh','mesh',0.7,0.5),bevel=0,parent=r)
for y in (-L/2+0.04,L/2-0.04):   # head/foot bars
    for z in (0.75,1.9):tube(f'bar{y}{z}',(-W/2,y,z),(W/2,y,z),parent=r)
tube('guard',(W/2-0.04,-L/2+0.3,1.95),(W/2-0.04,0.2,1.95),parent=r)
for i,z in enumerate((0.75,1.05,1.35)):tube(f'rung{i}',(W/2-0.04,L/2-0.04,z),(W/2-0.04,L/2-0.45,z),0.018,parent=r)
tube('ladder',(W/2-0.04,L/2-0.45,0.42),(W/2-0.04,L/2-0.45,1.58),parent=r)
mattress('low',W-0.1,L-0.12,0.42,r);mattress('high',W-0.1,L-0.12,1.58,r)
studio(elev=18,azim=-40,lens=45);frame(margin=1.1);print('bunk',tris());render()

# ---------- Cot: single army cot, same footprint as a single bunk ----------
scene('Cot');r=root('Cot')
for x in (-W/2+0.06,W/2-0.06):tube(f'rail{x}',(x,-L/2,0.42),(x,L/2,0.42),0.025,m=('wood','wood',0.85),parent=r)
for y in (-L/2+0.25,0,L/2-0.25):
    tube(f'x1{y}',(-W/2+0.06,y,0.42),(W/2-0.06,y,0.02),0.02,parent=r);tube(f'x2{y}',(W/2-0.06,y,0.42),(-W/2+0.06,y,0.02),0.02,parent=r)
box('canvas',(W-0.1,L,0.03),(0,0,0.43),('olive','olive',0.95),bevel=0.01,parent=r)
mattress('pad',W-0.16,L-0.2,0.42,r)
studio(elev=22,azim=-40,lens=45);frame(margin=1.1);print('cot',tris());render()

# ---------- Footlocker: olive trunk with brass corners and a padlock ----------
scene('Footlocker');r=root('Footlocker')
box('body',(0.8,0.45,0.36),(0,0,0.2),('paint_green','paint_green',0.8),bevel=0.02,parent=r)
box('lid',(0.82,0.47,0.1),(0,0,0.43),('paint_green','paint_green',0.8),bevel=0.025,parent=r)
for x in (-0.4,0.4):
    for y in (-0.225,0.225):box(f'corner{x}{y}',(0.07,0.07,0.5),(x,y,0.25),('brass','brass',0.5,0.8),bevel=0.01,parent=r)
for x in (-0.25,0.25):box(f'strap{x}',(0.05,0.48,0.47),(x,0,0.24),('wood_dark','wood_dark',0.9),bevel=0.005,parent=r)
box('hasp',(0.08,0.02,0.1),(0,-0.24,0.37),('brass','brass',0.5,0.8),bevel=0.004,parent=r)
cyl('lock',0.035,0.03,(0,-0.26,0.3),('brass','brass',0.4,0.8),verts=8,rot=(math.pi/2,0,0),bevel=0.004,parent=r)
for x in (-0.47,0.47):box(f'handle{x}',(0.03,0.16,0.04),(x,0,0.27),('steel','steel',0.5,0.7),bevel=0.005,parent=r)
studio(elev=25,azim=-35,lens=50);frame(margin=1.2);print('locker',tris());render()

# ---------- CardTable: D Tent's square wooden table (2.3 m, top at 0.8) with a felt inset ----------
scene('CardTable');r=root('CardTable');S=2.3
box('top',(S,S,0.08),(0,0,0.78),('wood','wood',0.8),bevel=0.02,parent=r)
box('felt',(S-0.5,S-0.5,0.012),(0,0,0.825),((0x3f,0x5a,0x3a),(0x3f,0x5a,0x3a),0.95),bevel=0,parent=r)
box('apron',(S-0.2,S-0.2,0.14),(0,0,0.67),('wood_dark','wood_dark',0.85),bevel=0.01,parent=r)
for x in (-S/2+0.18,S/2-0.18):
    for y in (-S/2+0.18,S/2-0.18):box(f'leg{x}{y}',(0.1,0.1,0.74),(x,y,0.37),('wood_dark','wood_dark',0.85),bevel=0.012,parent=r)
for i in range(5):   # a few cards and a seed pile on the felt
    a=rnd.uniform(-0.6,0.6);box(f'card{i}',(0.09,0.13,0.004),(rnd.uniform(-0.4,0.4),rnd.uniform(-0.4,0.4),0.834),('paint_white','paint_white',0.7),rot=(0,0,a),bevel=0,parent=r)
for i in range(14):
    cyl(f'seed{i}',0.012,0.01,(0.45+rnd.uniform(-0.08,0.08),-0.4+rnd.uniform(-0.08,0.08),0.836),(( 0x3a,0x33,0x2a),(0x3a,0x33,0x2a),0.9),verts=5,bevel=0,parent=r)
studio(elev=28,azim=-35,lens=45);frame(margin=1.1);print('cardtable',tris());render()

# ---------- Stool: wooden camp stool (0.46 tall, as in D Tent) ----------
scene('Stool');r=root('Stool')
cyl('seat',0.24,0.06,(0,0,0.43),('wood','wood',0.85),verts=12,bevel=0.012,parent=r)
for k in range(3):
    a=k*2*math.pi/3;tube(f'leg{k}',(math.cos(a)*0.17,math.sin(a)*0.17,0.41),(math.cos(a)*0.24,math.sin(a)*0.24,0),0.025,m=('wood_dark','wood_dark',0.85),parent=r)
    b=a+math.pi/3;tube(f'brace{k}',(math.cos(a)*0.215,math.sin(a)*0.215,0.16),(math.cos(a+2*math.pi/3)*0.215,math.sin(a+2*math.pi/3)*0.215,0.16),0.012,m=('wood_dark','wood_dark',0.85),parent=r)
studio(elev=22,azim=-35,lens=50);frame(margin=1.3);print('stool',tris());render()

# ---------- WardenDesk: heavy desk (3.1 x 1.7, top 0.83) with lamp, papers, ashtray and a chair ----------
scene('WardenDesk');r=root('WardenDesk')
box('top',(3.1,1.7,0.08),(0,0,0.8),('wood_dark','wood_dark',0.6),bevel=0.02,parent=r)
for x in (-1.1,1.1):box(f'pedestal{x}',(0.8,1.5,0.76),(x,0,0.38),('wood_dark','wood_dark',0.7),bevel=0.015,parent=r)
for x in (-1.1,1.1):
    for k,z in enumerate((0.2,0.45,0.66)):
        box(f'drawer{x}{k}',(0.7,0.02,0.2),(x,-0.76,z),('wood','wood',0.7),bevel=0.008,parent=r)
        box(f'pull{x}{k}',(0.12,0.03,0.025),(x,-0.78,z),('brass','brass',0.4,0.8),bevel=0.004,parent=r)
box('blotter',(0.85,0.6,0.01),(-0.3,0.05,0.845),((0x3f,0x5a,0x3a),(0x3f,0x5a,0x3a),0.9),bevel=0,parent=r)
for i in range(4):box(f'paper{i}',(0.21,0.29,0.003),(-0.3+rnd.uniform(-0.2,0.2),rnd.uniform(-0.1,0.2),0.852+i*0.003),('paint_white','paint_white',0.8),rot=(0,0,rnd.uniform(-0.4,0.4)),bevel=0,parent=r)
cyl('lampbase',0.09,0.03,(1.0,0.35,0.855),('brass','brass',0.4,0.8),verts=12,bevel=0,parent=r)
tube('lamparm',(1.0,0.35,0.86),(0.95,0.25,1.25),0.012,m=('brass','brass',0.4,0.8),parent=r)
cyl('lampshade',0.06,0.18,(0.9,0.18,1.22),('paint_green','paint_green',0.6,0.3),verts=12,r2=0.14,rot=(math.radians(-60),0,0),bevel=0,parent=r)
cyl('ashtray',0.07,0.025,(0.55,-0.35,0.855),('steel','steel',0.4,0.7),verts=10,bevel=0.005,parent=r)
# swivel chair behind the desk (+Y side is the Warden's)
c=root('chair');c.parent=r;c.location=(0,1.25,0);c.rotation_euler=(0,0,math.pi)
cyl('cbase',0.05,0.4,(0,0,0.25),MET,verts=8,parent=c)
for k in range(5):
    a=k*2*math.pi/5;tube(f'foot{k}',(0,0,0.06),(math.cos(a)*0.3,math.sin(a)*0.3,0.03),0.02,parent=c)
box('cseat',(0.55,0.5,0.1),(0,0,0.5),((0x6b,0x3a,0x2a),(0x6b,0x3a,0x2a),0.6),bevel=0.035,parent=c)
box('cback',(0.52,0.1,0.6),(0,0.24,0.85),((0x6b,0x3a,0x2a),(0x6b,0x3a,0x2a),0.6),bevel=0.04,parent=c)
studio(elev=24,azim=-30,lens=45);frame(margin=1.1);print('desk',tris());render()

# ---------- SupplyCrate: slatted wooden crate with stencilled letters ----------
scene('SupplyCrate');r=root('SupplyCrate');C=0.9
box('core',(C-0.06,C-0.06,C-0.06),(0,0,C/2),('wood_dark','wood_dark',0.9),bevel=0,parent=r)
for face,(ax,sgn) in enumerate(((0,-1),(0,1),(1,-1),(1,1))):
    for k in range(3):
        z=0.16+k*0.29;loc=[0,0,z];loc[ax]=sgn*(C/2-0.02);size=[C,C,0.22];size[ax]=0.04
        box(f'slat{face}{k}',tuple(size),tuple(loc),('wood_pale','wood_pale',0.9),bevel=0.008,parent=r)
box('lid',(C,C,0.05),(0,0,C-0.02),('wood_pale','wood_pale',0.9),bevel=0.01,parent=r)
for ax in (0,1):
    for sgn in (-1,1):
        for x in (-1,1):
            loc=[x*(C/2-0.05),x*(C/2-0.05),C/2];loc[ax]=sgn*(C/2);size=[0.07,0.07,C];size[ax]=0.05
            box(f'post{ax}{sgn}{x}',tuple(size),tuple(loc),('wood','wood',0.9),bevel=0.008,parent=r)
text('stencil','CGL',(0,-C/2-0.005,0.5),0.22,('ink','ink',0.9),fontname='BigShouldersStencilDisplay',extrude=0.002,parent=r)
studio(elev=22,azim=-35,lens=50);frame(margin=1.25);print('crate',tris());render()

# ---------- WaterDrum: 55-gallon steel drum with ribs and a bung ----------
scene('WaterDrum');r=root('WaterDrum')
cyl('drum',0.29,0.88,(0,0,0.44),((0x3f,0x5a,0x6a),(0x3f,0x5a,0x6a),0.6,0.5),verts=20,bevel=0.01,parent=r)
for z in (0.02,0.3,0.58,0.86):cyl(f'rib{z}',0.3,0.03,(0,0,z),((0x36,0x4d,0x5b),(0x36,0x4d,0x5b),0.6,0.5),verts=20,bevel=0.004,parent=r)
cyl('bung',0.035,0.02,(0.15,0.05,0.885),MET,verts=8,bevel=0,parent=r)
box('label',(0.3,0.02,0.18),(0,-0.29,0.5),('paint_white','paint_white',0.8),rot=(0,0,0),bevel=0,parent=r)
text('lbl','H2O',(0,-0.302,0.5),0.1,('ink','ink',0.8),parent=r)
studio(elev=20,azim=-30,lens=50);frame(margin=1.3);print('drum',tris());render()

# ---------- Bench: outdoor plank bench ----------
scene('Bench');r=root('Bench')
for i,y in enumerate((-0.12,0.0,0.12)):box(f'plank{i}',(1.9,0.11,0.05),(0,y,0.45),(f'wood_{i}',tuple(min(255,v+i*8) for v in PAL['wood_pale']),0.9),bevel=0.01,parent=r)
for x in (-0.75,0.75):
    box(f'legA{x}',(0.07,0.07,0.43),(x,-0.13,0.215),'wood_dark',parent=r);box(f'legB{x}',(0.07,0.07,0.43),(x,0.13,0.215),'wood_dark',parent=r)
    box(f'cross{x}',(0.06,0.36,0.06),(x,0,0.38),'wood_dark',parent=r)
box('stretch',(1.5,0.05,0.06),(0,0,0.15),'wood_dark',parent=r)
studio(elev=22,azim=-30,lens=50);frame(margin=1.2);print('bench',tris());render()

bpy.context.window.scene=bpy.data.scenes['ARCHIVED_Camper_minipc'];bpy.ops.wm.save_mainfile()
