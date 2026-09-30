# blend: buildings.blend
exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
rnd=random.Random(31)
MET=('steel','steel',0.55,0.6);DARK=('gate_steel',(0x3a,0x44,0x43),0.55,0.6)
def tube(name,a,b,r=0.03,m=MET,parent=None,verts=8,sq=False):
    a,b=Vector(a),Vector(b);d=b-a
    o=box(name,(r*2,r*2,d.length),(a+b)/2,m,bevel=0.005,parent=parent) if sq else cyl(name,r,d.length,(a+b)/2,m,verts=verts,bevel=0,parent=parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def chain_panel(name,w,h,center,parent,axis='x'):
    """A chain-link sheet (the FenceSpan material) w wide, h tall, facing Y."""
    bpy.ops.mesh.primitive_plane_add(size=1,location=center,rotation=(math.pi/2,0,0));p=bpy.context.active_object;p.name=name
    p.scale=(w,h,1);bpy.ops.object.transform_apply(scale=True);_link(p);p.parent=parent
    p.data.materials.append(bpy.data.materials['cgl_chainlink'])
    uv=p.data.uv_layers.active.data
    for lp in p.data.loops:
        co=p.data.vertices[lp.vertex_index].co;uv[lp.index].uv=((co.x+w/2)/0.6,(co.z+h/2)/0.6)
    return p
def leaf(name,w,h,parent,x0,y,flip=1):
    """A swinging/sliding chain-link gate leaf: tube frame, mid rail, diagonal brace, mesh, barbed top, wheel."""
    g=root(name);g.parent=parent;g.location=(x0,y,0)
    for x in (0,flip*w):tube(f'{name}_stile{x}',(x,0,0.15),(x,0,0.15+h),0.04,parent=g)
    for z in (0.15,0.15+h/2,0.15+h):tube(f'{name}_rail{z}',(0,0,z),(flip*w,0,z),0.035,parent=g)
    tube(f'{name}_brace',(0,0,0.15),(flip*w,0,0.15+h/2),0.025,parent=g)
    chain_panel(f'{name}_mesh',w,h,(flip*w/2,0,0.15+h/2),g)
    for k,dz in enumerate((0.2,0.35,0.5)):tube(f'{name}_barb{k}',(0,0,0.15+h+dz),(flip*w,0,0.15+h+dz),0.008,m=('wire','wire',0.5,0.8),parent=g)
    for x in (0,flip*w):tube(f'{name}_barbpost{x}',(x,0,0.15+h),(x,0,0.15+h+0.55),0.02,parent=g)
    cyl(f'{name}_wheel',0.12,0.06,(flip*(w-0.15),0,0.12),('rubber',(0x22,0x22,0x22),0.9),verts=12,rot=(0,math.pi/2,0),bevel=0,parent=g)
    return g
def sign_board(name,w,h,z,texts,parent,y=0,board='paint_white',ink='ink',font='BigShouldersStencilDisplay'):
    box(name,(w,0.08,h),(0,y,z),(board,board,0.8),bevel=0.02,parent=parent)
    box(name+'_frame',(w+0.12,0.06,h+0.12),(0,y,z),DARK,bevel=0.01,parent=parent)
    for side,(txt,size) in zip((-1,1),texts):
        text(f'{name}_t{side}',txt,(0,y+side*0.05,z),size,(ink,ink,0.85),fontname=font,rot=(math.pi/2,0,0 if side<0 else math.pi),parent=parent)

# ================= MainGate: 12 m opening along X at the fence line (y=0). Outside (the lake) is +Y. =================
scene('MainGate');r=root('MainGate')
for s in (-1,1):
    x=s*6.18
    box(f'footing{s}',(0.9,0.9,0.35),(x,0,0.17),('concrete','concrete',0.95),bevel=0.04,parent=r)
    box(f'column{s}',(0.38,0.38,5.3),(x,0,0.35+2.65),DARK,bevel=0.02,parent=r)
    box(f'cap{s}',(0.5,0.5,0.12),(x,0,5.71),DARK,bevel=0.02,parent=r)
    for k,z in enumerate((1.0,2.2,3.4)):box(f'hinge{s}{k}',(0.12,0.18,0.14),(x-s*0.24,0.12,z),MET,bevel=0.01,parent=r)
    # floodlight on each column, aimed down at the opening
    box(f'lamparm{s}',(0.08,0.6,0.08),(x,-0.3,5.2),DARK,bevel=0,parent=r)
    cyl(f'lamp{s}',0.17,0.3,(x,-0.62,5.1),DARK,verts=12,rot=(math.radians(120),0,0),bevel=0.01,parent=r)
    cyl(f'lens{s}',0.14,0.02,(x,-0.72,4.96),('lantern',(0xff,0xd4,0x8a),0.3),verts=12,rot=(math.radians(120),0,0),bevel=0,parent=r)
# overhead truss between the columns
for z in (4.55,5.35):tube(f'chord{z}',(-6.0,0,z),(6.0,0,z),0.07,m=DARK,parent=r,sq=True)
n=12
for k in range(n):
    x0=-6+k*1.0;tube(f'web{k}',(x0,0,4.55 if k%2==0 else 5.35),(x0+1.0,0,5.35 if k%2==0 else 4.55),0.035,m=DARK,parent=r,sq=True)
# arch sign above the truss: CAMP GREEN LAKE to the lake side, LAKE ACCESS to the camp side
for x in (-2.6,2.6):tube(f'signpost{x}',(x,0,5.35),(x,0,5.75),0.05,m=DARK,parent=r,sq=True)
sign_board('arch',6.6,1.15,6.3,[('LAKE ACCESS',0.55),('CAMP GREEN LAKE',0.62)],r)
# gate leaves swung all the way open, lying flat against the outside of the fence
leaf('leafL',5.8,2.75,r,-6.0,0.45,flip=-1);leaf('leafR',5.8,2.75,r,6.0,0.45,flip=1)
for s in (-1,1):   # drop-rod keepers that hold the open leaves
    cyl(f'keeper{s}',0.06,0.25,(s*11.6,0.45,0.12),MET,verts=8,bevel=0,parent=r)
# concrete threshold with a painted stop line, and a guard's STOP sign on the camp side
box('threshold',(12.0,1.6,0.06),(0,0,0.03),('concrete','concrete',0.95),bevel=0.01,parent=r)
box('stopline',(12.0,0.25,0.012),(0,-0.55,0.065),('paint_white','paint_white',0.8),bevel=0,parent=r)
tube('stoppost',(6.9,-0.9,0),(6.9,-0.9,2.2),0.04,parent=r)
cyl('stopsign',0.34,0.03,(6.9,-0.94,2.1),('paint_red','paint_red',0.7),verts=8,rot=(math.pi/2,0,0),bevel=0.005,parent=r)
text('stoptxt','STOP',(6.9,-0.96,2.1),0.17,('paint_white','paint_white',0.8),parent=r)
studio(elev=14,azim=-150,lens=40);frame(margin=1.05);print('main gate',tris());render()

# ================= ServiceGate: 6 m opening along X, a sliding gate parked outside to the right =================
scene('ServiceGate');r=root('ServiceGate')
for s in (-1,1):
    x=s*3.15
    box(f'footing{s}',(0.7,0.7,0.3),(x,0,0.15),('concrete','concrete',0.95),bevel=0.03,parent=r)
    box(f'column{s}',(0.3,0.3,4.6),(x,0,0.3+2.3),DARK,bevel=0.015,parent=r)
    box(f'cap{s}',(0.4,0.4,0.1),(x,0,4.95),DARK,bevel=0.015,parent=r)
tube('topbar',(-3.15,0,4.25),(3.15,0,4.25),0.08,m=DARK,parent=r,sq=True)
for s in (-1,1):tube(f'knee{s}',(s*3.15,0,3.6),(s*2.4,0,4.25),0.04,m=DARK,parent=r,sq=True)
sign_board('svc',3.4,0.75,4.95,[('SERVICE GATE',0.36),('DELIVERIES ONLY',0.3)],r,board='paint_white')
for x in (-1.2,1.2):tube(f'svcpost{x}',(x,0,4.33),(x,0,4.6),0.04,m=DARK,parent=r,sq=True)
# the rolling gate slid open along the outside, on a ground track with guide rollers
leaf('slider',6.2,2.75,r,3.2,0.45,flip=1)
box('track',(9.8,0.12,0.06),(4.9,0.45,0.03),MET,bevel=0.005,parent=r)
for x in (3.5,9.2):
    box(f'guidepost{x}',(0.14,0.14,3.2),(x,0.7,1.6),DARK,bevel=0.01,parent=r)
    cyl(f'roller{x}',0.07,0.1,(x,0.56,2.95),('rubber',(0x22,0x22,0x22),0.9),verts=10,bevel=0,parent=r)
cyl('padlock',0.07,0.05,(3.2,0.4,1.4),('brass','brass',0.4,0.8),verts=10,rot=(math.pi/2,0,0),bevel=0.004,parent=r)
for k in range(5):cyl(f'chain{k}',0.03,0.05,(3.2,0.4,1.5+k*0.06),MET,verts=6,bevel=0,parent=r)
# tyre ruts and a speed sign for the supply truck
for x in (-0.9,0.9):box(f'rut{x}',(0.4,4.0,0.02),(x,0,0.01),('rut',(0xb5,0x9a,0x70),0.95),bevel=0,parent=r)
tube('mphpost',(-3.9,-0.8,0),(-3.9,-0.8,2.0),0.035,parent=r)
box('mph',(0.5,0.03,0.62),(-3.9,-0.83,1.75),('paint_white','paint_white',0.7),bevel=0.005,parent=r)
text('mph1','SPEED',(-3.9,-0.85,1.9),0.09,('ink','ink',0.85),parent=r);text('mph2','5',(-3.9,-0.85,1.7),0.24,('ink','ink',0.85),parent=r)
studio(elev=16,azim=-150,lens=40);frame(margin=1.05);print('service gate',tris());render()
bpy.ops.wm.save_mainfile()
