# blend: props.blend
# The end of Act 1 at the lake's north edge (public/js/10-core.js NORTH, 88-north.js): the jump ramp, rock faces for the
# trench's sheer sides and the wall's ledges, and the signs. The ground itself has the shapes (the trench, the ramp's
# wedge, the ledges); these sit on it. Exported to glb/*.glb for public/models/.
#   NorthRamp      a wooden jump ramp, 5 m wide, 12 m long, 3.2 m up at its lip. Low end at the origin, rising toward
#                  Blender +Y (= game -z, toward the trench when placed with ry 0)
#   NorthCliff5    a 10 m stretch of rock face, 5.2 m tall, for the trench sides: origin at the top of the face, the face
#                  toward Blender -Y (= game +z)
#   NorthCliff2    the same, 2.2 m tall, for the wall's ledges
#   SignTrench     a warning sign by the ramp;  SignBigThumb  the old boundary marker on top of the wall
# Run with the live Blender:  python3 bx.py north.py   (bx.py opens props.blend)
import bpy,os,math,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'north.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
from mathutils import Vector
OUT=os.path.join(ART,'glb');rnd=random.Random(1885)
def J(a=1.0):return rnd.uniform(-a,a)
def M_(n,c,r=0.9,m=0.0):return ('n_'+n,c,r,m)
ROCK=[M_('rock1',(0x8a,0x6e,0x52),0.95),M_('rock2',(0x7a,0x60,0x48),0.95),M_('rock3',(0x9a,0x7c,0x5c),0.95)]
WOOD=[M_('plank1',(0x7a,0x5c,0x3e)),M_('plank2',(0x6a,0x50,0x36)),M_('plank3',(0x5e,0x4a,0x34))]
IRON=M_('iron',(0x4a,0x46,0x42),0.6,0.5);RUST=M_('rust',(0x7a,0x44,0x28),0.8,0.3);SAND=M_('sand',(0xb0,0x94,0x6a),0.97)
def B(n,size,loc,m,rot=(0,0,0),p=None,bv=0):return box(n,size,loc,m,rot=rot,bevel=bv,parent=p)
def tube(n,a,b,r,m,p,v=6):
    a,b=Vector(a),Vector(b);d=b-a;o=cyl(n,r,d.length,(a+b)/2,m,verts=v,bevel=0,parent=p);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def rock(n,loc,scale,p):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc);o=bpy.context.active_object;o.name=n;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for v in o.data.vertices:v.co.x+=J(0.18)*scale[0];v.co.y+=J(0.12)*scale[1];v.co.z+=J(0.15)*scale[2]
    o.rotation_euler=(J(0.3),J(0.3),J(3));return _finish(o,rnd.choice(ROCK),0,p)
def export(n,elev=22,azim=-35):
    studio(elev=elev,azim=azim,lens=40,floor=False);frame(margin=1.1);render(res=(900,600),samples=16)
    p=export_glb(os.path.join(OUT,n+'.glb'));print(n,p[1],p[2])

# ---- the ramp ----
scene('NorthRamp');r=root('NorthRamp');L,W,H=12.0,5.0,3.2;ang=math.atan2(H,L);sl=math.hypot(L,H)
deck=grp=bpy.data.objects.new('deck',None);_link(deck);deck.parent=r;deck.location=(0,L/2,H/2+0.06);deck.rotation_euler=(ang,0,0)
for i in range(int(W/0.3)):B(f'plank{i}',(0.28,sl,0.06),(-W/2+0.15+i*0.3,0,0),rnd.choice(WOOD),rot=(0,0,J(0.004)),p=deck)
for k in range(9):B(f'cross{k}',(W,0.12,0.06),(0,-sl/2+0.4+k*sl/8.6,0.06),rnd.choice(WOOD),p=deck)
for s in (-1,1):B(f'curb{s}',(0.2,sl,0.25),(s*(W/2-0.1),0,0.14),WOOD[2],p=deck)
B('lipplate',(W,0.5,0.03),(0,sl/2-0.25,0.05),IRON,p=deck)
for s in (-1,1):   # the trestle under the high end, sticking out past the ground's wedge
    tube(f'leg{s}',(s*(W/2-0.3),L-0.2,0),(s*(W/2-0.3),L-0.2,H),0.12,WOOD[1],r)
    tube(f'brace{s}',(s*(W/2-0.3),L-2.5,0),(s*(W/2-0.3),L-0.2,H-0.3),0.08,WOOD[2],r)
B('lipbeam',(W+0.4,0.3,0.3),(0,L-0.1,H-0.1),WOOD[1],p=r)
for k in range(4):cyl(f'tyre{k}',0.38,0.26,(J(2),-0.8+J(0.4),0.15),M_('tyre',(0x22,0x22,0x20),0.9),verts=12,rot=(0,math.pi/2,J(3)),bevel=0,parent=r)
for k in range(5):B(f'sandbag{k}',(0.6,0.35,0.25),(-2+k*1.0,0.2,0.12),SAND,rot=(0,0,J(0.3)),p=r)
export('NorthRamp',elev=18,azim=-60)

# ---- rock faces ----
def cliff(n,Hh,k):
    scene(n);r=root(n)
    B('backing',(10.4,1.2,Hh),(0,0.7,-Hh/2+0.05),ROCK[1],p=r)   # a solid core so nothing shows through the gaps
    for i in range(k):
        x=-5+10*(i+0.5)/k+J(0.3)
        for j in range(max(1,int(Hh/1.6))):
            z=-Hh+0.6+j*1.5+J(0.2)
            if z>-0.2:continue
            rock(f'r{i}_{j}',(x,0.1+J(0.15),z),(rnd.uniform(0.9,1.4),rnd.uniform(0.45,0.7),rnd.uniform(0.7,1.0)),r)
    for i in range(k):rock(f'cap{i}',(-5+10*(i+0.5)/k,0.35,-0.15),(rnd.uniform(0.8,1.2),0.5,0.3),r)   # the lip
    export(n)
cliff('NorthCliff5',5.2,6);cliff('NorthCliff2',2.2,6)

# ---- signs ----
scene('SignTrench');r=root('SignTrench')
for s in (-1,1):B(f'post{s}',(0.12,0.12,2.2),(s*0.7,0,1.1),WOOD[1],p=r)
B('board',(1.9,0.06,0.9),(0,-0.05,1.75),M_('paint_white',(0xd8,0xd0,0xb8),0.8),rot=(0,0.05,0),p=r)
B('band',(1.9,0.07,0.22),(0,-0.06,2.08),M_('paint_red',(0xa0,0x2c,0x1c),0.7),rot=(0,0.05,0),p=r)
text('warn','DANGER',(0,-0.1,2.08),0.17,M_('paint_white',(0xd8,0xd0,0xb8),0.8),parent=r)
text('l1','TRENCH AHEAD',(0,-0.1,1.8),0.15,('ink','ink',0.8),parent=r)
text('l2','NO VEHICLES',(0,-0.1,1.58),0.12,('ink','ink',0.8),parent=r)
export('SignTrench')
scene('SignBigThumb');r=root('SignBigThumb')
cyl('pole',0.08,4.2,(0,0,2.1),IRON,verts=8,bevel=0,parent=r)
B('flag',(1.2,0.02,0.7),(0.62,0,3.75),M_('flag_orange',(0xd0,0x6a,0x2a),0.9),rot=(0,0,0.08),p=r)
B('rip',(0.3,0.03,0.25),(1.1,0,3.55),M_('void',(0x10,0x0c,0x08),1.0),p=r)
B('plaque',(1.4,0.08,0.6),(0,-0.1,1.5),RUST,p=r)
text('p1','CAMP GREEN LAKE',(0,-0.15,1.62),0.12,M_('paint_white',(0xd8,0xd0,0xb8),0.8),parent=r)
text('p2','PROPERTY LINE',(0,-0.15,1.42),0.12,M_('paint_white',(0xd8,0xd0,0xb8),0.8),parent=r)
for k in range(5):rock(f'cairn{k}',(J(0.4),J(0.4),0.2+k*0.12),(0.35-k*0.04,0.3-k*0.03,0.2),r)
export('SignBigThumb',elev=15,azim=-30)
bpy.ops.wm.save_mainfile()
