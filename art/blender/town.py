# blend: town.blend
# The buried town of Green Lake: the ruins under the lake bed (public/js/89-town.js lays them out, public/sim.js picks
# the day's maze). A hundred-odd years under the sand: cracked adobe with the plaster fallen off the brick, sagging
# timbers, roots through the ceiling, sand drifted into every corner, furniture tipped over where it was left.
#
# Two kinds of scene, all exported to glb/Town*.glb for public/models/:
#   kit     one piece per cell side / floor / ceiling, sized to the game's grid (SIM.TOWN: C 14 m cells, H 4 m, 0.4 m walls)
#           TownWall, TownWallDoor (2.4 m doorway), TownWallCrawl (collapsed to a 1.1 m crawl gap),
#           TownFloorPlank, TownFloorStone, TownFloorRot, TownCeiling, TownCeilingCaved
#   rooms   the furnishings for each room type (TownRoom_<key>), inside one 14 x 14 m cell. Everything stays out of the
#           3.2 m cross through the middle so the doorways (at the middle of each side) always join up.
# Big pieces you'd walk into are recorded as colliders and written to glb/TownColliders.json (game coordinates, metres
# from the cell centre: [dx, dz, w, d]); copy it to public/data/ with the GLBs. 89-town.js adds them to the room's walls.
#
# Blender (x, y, z) = game (dx, -dz, y) from the cell centre; floor top at z 0, ceiling at z 4. Walls run along Blender X.
# Run with the live Blender:  python3 bx.py town.py   (bx.py opens town.blend first)
import bpy,os,re,math,json,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'town.py')   # so cgl_blender.py's ART/RENDERS point at this checkout
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
from mathutils import Vector
OUT=os.path.join(ART,'glb')
C,H,TH,GAP,CRAWL=14.0,4.0,0.4,2.4,1.1
HALF=C/2;INNER=HALF-TH/2
rnd=random.Random(1882)
def sh(c,d):return tuple(max(0,min(255,int(v+d))) for v in c)
def J(a=1.0):return rnd.uniform(-a,a)

# ---- palette: sun-bleached town gone dark under the sand ----
ADOBE=(0x8a,0x72,0x58);BRICK=(0x84,0x4c,0x36);MORTAR=(0x4a,0x3a,0x2e);TIMBER=(0x4e,0x3a,0x2a);GREYWOOD=(0x64,0x5a,0x4c)
SAND=(0xa8,0x8c,0x64);DIRT=(0x6a,0x52,0x3a);ROOT=(0x4e,0x38,0x28);STAIN=(0x4a,0x3e,0x34);RUST=(0x7a,0x44,0x28)
IRON=(0x3a,0x38,0x36);GLASS=(0x7a,0x92,0x84);CLOTH=(0x7a,0x5a,0x48);PAPER=(0xc8,0xb8,0x94);BONE=(0xd8,0xcc,0xb0)
def M_(n,c,r=0.9,m=0.0):return ('t_'+n,c,r,m)
mADOBE=M_('adobe',ADOBE,0.95);mADOBE2=M_('adobe2',sh(ADOBE,-14),0.95);mBRICK=M_('brick',BRICK,0.9);mMORT=M_('mortar',MORTAR,0.95)
mTIM=M_('timber',TIMBER);mTIM2=M_('timber2',sh(TIMBER,-12));mGREY=M_('greywood',GREYWOOD);mGREY2=M_('greywood2',sh(GREYWOOD,-16))
mSAND=M_('sand',SAND,0.97);mSAND2=M_('sand2',sh(SAND,-18),0.97);mDIRT=M_('dirt',DIRT,0.97);mROOT=M_('root',ROOT);mSTAIN=M_('stain',STAIN,0.97)
mRUST=M_('rust',RUST,0.8,0.3);mIRON=M_('iron',IRON,0.6,0.5);mGLASS=M_('glass',GLASS,0.2);mCLOTH=M_('cloth',CLOTH,0.95)
mPAPER=M_('paper',PAPER,0.95);mBONE=M_('bone',BONE,0.8);mDARK=M_('void',(0x12,0x0e,0x0a),1.0);mBRASS=M_('brass',(0x9a,0x7a,0x3a),0.5,0.6)
mGOLD=M_('gold',(0xd4,0xaf,0x37),0.35,0.8);mSTONE=M_('stone',(0x7e,0x74,0x66),0.95);mSTONE2=M_('stone2',(0x6a,0x60,0x54),0.95)
WOODS=[mTIM,mTIM2,mGREY,mGREY2]

# ---- helpers ----
def grp(name,loc=(0,0,0),rot=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);_link(o);o.location=loc;o.rotation_euler=rot
    if parent:o.parent=parent
    return o
def B(n,size,loc,m,rot=(0,0,0),p=None,bv=0):return box(n,size,loc,m,rot=rot,bevel=bv,parent=p)
def Cy(n,r,d,loc,m,v=8,rot=(0,0,0),p=None,r2=None):return cyl(n,r,d,loc,m,verts=v,rot=rot,bevel=0,r2=r2,parent=p)
def tube(n,a,b,r,m,p,v=6,r2=None):
    a,b=Vector(a),Vector(b);d=b-a
    o=cyl(n,r,d.length,(a+b)/2,m,verts=v,bevel=0,r2=r2,parent=p);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def blob(n,loc,scale,m,p,seg=8,rings=5):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=loc);o=bpy.context.active_object;o.name=n;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for v in o.data.vertices:v.co.x+=J(0.08)*scale[0];v.co.y+=J(0.08)*scale[1]
    return _finish(o,m,0,p)
def drift(n,x,y,lx,ly,h,p,rz=0,m=None):   # a low sand drift: a squashed dome sunk into the floor
    o=blob(n,(x,y,0),(lx,ly,h),m or mSAND,p,seg=10,rings=5);o.rotation_euler=(0,0,rz);o.location.z=-h*0.35;return o
def rubble(n,x,y,r,k,p,mats=None,big=0.3):
    mats=mats or [mADOBE,mADOBE2,mBRICK,mBRICK]
    for i in range(k):
        a=rnd.uniform(0,6.283);d=r*math.sqrt(rnd.random());s=rnd.uniform(0.08,big)
        B(f'{n}{i}',(s*rnd.uniform(0.8,1.6),s*rnd.uniform(0.6,1.2),s*rnd.uniform(0.4,0.8)),(x+math.cos(a)*d,y+math.sin(a)*d,s*0.25),mats[i%len(mats)],rot=(J(0.5),J(0.5),J(3)),p=p)
def roots(n,x,y,ztop,p,k=4,L=1.2):   # thin roots hanging through the ceiling, each in two bent pieces
    for i in range(k):
        a=(x+J(0.4),y+J(0.4),ztop);l=L*rnd.uniform(0.4,1.1);m=(a[0]+J(0.15),a[1]+J(0.15),ztop-l*0.55);b=(m[0]+J(0.2),m[1]+J(0.2),ztop-l)
        tube(f'{n}{i}a',a,m,0.025,mROOT,p,v=5,r2=0.016);tube(f'{n}{i}b',m,b,0.016,mROOT,p,v=4,r2=0.004)
COLS={}
def col(room,x,y,w,d):COLS.setdefault(room,[]).append([round(x,2),round(-y,2),round(w,2),round(d,2)])
def export(n,rend=False):
    finish_scene()
    if rend:render(res=(960,640),samples=16)
    p=export_glb(os.path.join(OUT,n+'.glb'));print(n,p[1],p[2]);return p
PREV={}
def finish_scene(elev=34,azim=-35,margin=1.08,target=None):
    studio(elev=elev,azim=azim,lens=40,floor=False);frame(margin=margin)

# ================= wall kit =================
def wall_face_detail(n,x0,x1,p,z0=0.0,z1=H,seed=0):
    """Both faces of a wall stretch from x0 to x1: brick where the plaster's fallen off, a water line, cracks, sand drifted
    against the foot, timber posts every ~3.5 m. The core wall itself is made by the caller."""
    L=x1-x0
    for s in (-1,1):
        y=s*(TH/2+0.012)
        for k in range(max(1,int(L/3.2))):   # patches of bare brick, with mortar lines
            w=rnd.uniform(0.8,1.6);h=rnd.uniform(0.6,1.2);cx=x0+rnd.uniform(w/2+0.2,max(w/2+0.21,L-w/2-0.2));cz=rnd.uniform(max(z0,0)+h/2+0.4,z1-h/2-0.3)
            if cz-h/2<z0:continue
            B(f'{n}br{s}{k}',(w,0.02,h),(cx,y,cz),mMORT,p=p)
            for rr in range(int(h/0.15)):
                off=0.13*(rr%2)
                for cc in range(int(w/0.27)):
                    if rnd.random()<0.12:continue
                    B(f'{n}bk{s}{k}{rr}{cc}',(0.24,0.05,0.12),(cx-w/2+0.14+off+cc*0.27,y+s*0.012,cz-h/2+0.08+rr*0.15),mBRICK if (rr+cc)%3 else mADOBE2,rot=(J(0.04),0,J(0.04)),p=p)
            for e in range(4):B(f'{n}pe{s}{k}{e}',(rnd.uniform(0.15,0.4),0.04,rnd.uniform(0.1,0.25)),(cx+J(w/2),y+s*0.01,cz+math.copysign(h/2,J())),mADOBE2,rot=(0,J(0.5),0),p=p)
            if z0<=0.1:rubble(f'{n}pc{s}{k}',cx,s*(TH/2+0.25),0.35,5,p,mats=[mADOBE,mADOBE2],big=0.18)
        if z0<=0.1:
            B(f'{n}stain{s}',(L,0.02,0.35),((x0+x1)/2,y,0.55+J(0.05)),mSTAIN,p=p)   # the old flood line
            for k in range(max(1,int(L/4))):drift(f'{n}dr{s}{k}',x0+rnd.uniform(0.5,L-0.5),s*(TH/2+0.25),rnd.uniform(0.8,1.6),0.45,0.28,p)
        for k in range(max(1,int(L/5))):   # cracks
            cx=x0+rnd.uniform(0.4,L-0.4);cz=rnd.uniform(max(z0,0)+0.6,z1-0.5)
            B(f'{n}cr{s}{k}',(0.03,0.02,rnd.uniform(0.5,1.1)),(cx,y+s*0.004,cz),mDARK,rot=(0,J(0.6),0),p=p)
    n_posts=max(2,int(L/3.5)+1)
    for k in range(n_posts):   # timber posts right through the wall, showing on both faces
        x=x0+0.15+k*(L-0.3)/(n_posts-1)
        B(f'{n}post{k}',(0.22,TH+0.08,z1-z0),(x,0,(z0+z1)/2),WOODS[k%4],rot=(0,J(0.03),0),p=p)
    B(f'{n}plate',(L,TH+0.1,0.22),((x0+x1)/2,0,H-0.11),mTIM2,rot=(0,J(0.01),0),p=p)   # top plate under the ceiling
def wall_run(n,x0,x1,p):
    B(f'{n}core',(x1-x0,TH,H),((x0+x1)/2,0,H/2),mADOBE,p=p);wall_face_detail(n,x0,x1,p)
    for s in (-1,1):drift(f'{n}heap{s}',x0+rnd.uniform(0.6,x1-x0-0.6),s*(TH/2+0.45),rnd.uniform(1.2,2.2),0.8,rnd.uniform(0.5,0.9),p)   # sand banked up the wall

scene('TownWall');r=root('TownWall');wall_run('w',-HALF,HALF,r);roots('wr',J(3),0,H-0.2,r,k=3,L=0.8);export('TownWall')

# B: the top of the wall broke off in the middle and the earth above slumped in through the gap, down both faces
scene('TownWallB');r=root('TownWallB');nx=rnd.uniform(-2.5,2.5);nw=3.2
B('coreL',(nx-nw/2+HALF,TH,H),((-HALF+nx-nw/2)/2,0,H/2),mADOBE,p=r);B('coreR',(HALF-nx-nw/2,TH,H),((HALF+nx+nw/2)/2,0,H/2),mADOBE,p=r)
B('coreLow',(nw,TH,1.6),(nx,0,0.8),mADOBE2,p=r)
for k in range(6):B(f'break{k}',(0.5,TH+0.05,0.45),(nx-nw/2+0.3+k*(nw-0.6)/5,J(0.04),1.6+abs(J(0.35))),[mADOBE,mBRICK,mADOBE2][k%3],rot=(J(0.3),J(0.3),J(0.5)),p=r)
wall_face_detail('wb',-HALF,HALF,r)
blob('slump',(nx,0,2.4),(nw/2+0.2,0.9,1.8),mDIRT,r,seg=10,rings=6)
for s in (-1,1):blob(f'slumpfoot{s}',(nx+J(0.4),s*1.1,0.2),(1.8,1.2,0.9),mDIRT,r,seg=10,rings=5);rubble(f'wbr{s}',nx,s*1.5,1.2,10,r,big=0.35)
roots('wbroot',nx,0,H,r,k=6,L=1.8);export('TownWallB')

# C: the wall bowed out and cracked corner to corner; someone propped it with a timber that's still there
scene('TownWallC');r=root('TownWallC')
c=B('core',(C,TH,H),(0,0,H/2),mADOBE,rot=(0.04,0,0),p=r);wall_face_detail('wc',-HALF,HALF,r)
for k in range(9):B(f'bigcrack{k}',(0.8,0.05,0.05),(-3.2+k*0.8,-(TH/2+0.02),0.6+k*0.35+J(0.1)),mDARK,rot=(0,-0.45+J(0.3),0),p=r)
for k in range(9):B(f'bigcrackb{k}',(0.8,0.05,0.05),(-3.2+k*0.8,(TH/2+0.02),0.6+k*0.35+J(0.1)),mDARK,rot=(0,-0.45+J(0.3),0),p=r)
tube('brace',(-2.0,-(TH/2+1.9),0.05),(-2.0,-(TH/2+0.1),3.0),0.12,mTIM,r,v=6);B('bracefoot',(0.4,0.3,0.15),(-2.0,-(TH/2+1.9),0.07),mTIM2,p=r)
drift('wch',2.5,-(TH/2+0.6),2.4,1.0,0.8,r);drift('wch2',-3.5,(TH/2+0.6),2.0,0.9,0.7,r)
col('TownWallC',-2.0,-(TH/2+1.9),0.5,0.5)
export('TownWallC')

scene('TownWallDoor');r=root('TownWallDoor');g=GAP/2
wall_run('wl',-HALF,-g,r);wall_run('wr',g,HALF,r)
B('lintelwall',(GAP,TH,H-2.75),(0,0,2.75+(H-2.75)/2),mADOBE2,p=r)
B('lintel',(GAP+0.7,TH+0.1,0.24),(0,0,2.63),mTIM,rot=(0,0.035,0),p=r)            # sagging
for s in (-1,1):B(f'jamb{s}',(0.2,TH+0.12,2.7),(s*(g-0.1),0,1.35),mTIM2,rot=(0,s*0.02,0),p=r)
# the door that used to hang here, fallen against the wall beside the opening (one face only, out of the way)
d=grp('doorleaf',(g+0.9,-(TH/2+0.25),0),(math.radians(-12),0,0),r)
B('leaf',(1.05,0.06,2.1),(0,0,1.05),mGREY,p=d)
for zz in (0.4,1.1,1.8):B(f'leafrail{zz}',(1.05,0.08,0.12),(0,-0.01,zz),mGREY2,p=d)
B('leafz',(0.1,0.08,1.6),(0,-0.02,1.05),mGREY2,rot=(0,0.62,0),p=d)
Cy('hinge',0.03,0.18,(-0.5,-0.05,1.7),mRUST,rot=(0,0,0),p=d)
rubble('drub',g+0.4,TH/2+0.35,0.35,5,r)
export('TownWallDoor')

scene('TownWallCrawl');r=root('TownWallCrawl')
wall_run('wl',-HALF,-g,r);wall_run('wr',g,HALF,r)
# the top of the doorway came down: a slumped mass of adobe and brick with a ragged underside, 1.1 m clear below
B('slump',(GAP+0.2,TH+0.2,H-CRAWL-0.3),(0,0,CRAWL+0.3+(H-CRAWL-0.3)/2),mADOBE2,p=r)
for k in range(7):
    x=-g+0.2+k*(GAP-0.4)/6;hz=CRAWL+0.05+abs(J(0.18))
    B(f'jag{k}',(0.42,TH+0.24,0.5),(x,J(0.05),hz+0.25),[mADOBE,mBRICK,mADOBE2][k%3],rot=(J(0.25),J(0.25),J(0.3)),p=r)
B('brokenlintel',(GAP+1.0,0.24,0.24),(0.1,-(TH/2+0.05),CRAWL+0.55),mTIM,rot=(0,0.32,0.08),p=r)
for s in (-1,1):
    rubble(f'rub{s}a',s*(g+0.55),-(TH/2+0.5),0.5,8,r,big=0.35);rubble(f'rub{s}b',s*(g+0.55),(TH/2+0.5),0.5,8,r,big=0.35)
    drift(f'rubdrift{s}a',s*(g+0.6),-(TH/2+0.45),0.7,0.55,0.4,r,m=mDIRT);drift(f'rubdrift{s}b',s*(g+0.6),(TH/2+0.45),0.7,0.55,0.4,r,m=mDIRT)
roots('cr',0,0,CRAWL+0.3,r,k=3,L=0.5)
export('TownWallCrawl')

# ================= floors (top at z 0, 14 x 14) =================
def plank_floor(n,p,hole=None):
    B(f'{n}under',(C,C,0.1),(0,0,-0.2),mDARK,p=p)
    bw=0.32;k=int(C/bw)
    for i in range(k):
        x=-HALF+bw/2+i*bw;m=[mGREY,mGREY2,mTIM,mGREY][rnd.randrange(4)]
        if rnd.random()<0.04:continue   # a board gone: the dark shows through
        segs=[(-HALF,HALF)]
        if hole:
            hx,hy,hr=hole
            if abs(x-hx)<hr:
                c=math.sqrt(hr*hr-(x-hx)**2);segs=[(-HALF,hy-c-rnd.uniform(0,0.3)),(hy+c+rnd.uniform(0,0.3),HALF)]
        for j,(a,b) in enumerate(segs):
            if b-a<0.1:continue
            B(f'{n}{i}_{j}',(bw-0.02,b-a,0.06),(x,(a+b)/2,-0.03+J(0.008)),m,rot=(J(0.006),0,0),p=p)
    for k in range(5):B(f'{n}joist{k}',(C,0.2,0.2),(0,-HALF+1.4+k*2.8,-0.17),mTIM2,p=p)
def corner_drifts(n,p,k=4):
    for i,(sx,sy) in enumerate(((-1,-1),(1,-1),(-1,1),(1,1))[:k]):
        drift(f'{n}cd{i}',sx*(INNER-0.9),sy*(INNER-0.9),rnd.uniform(1.4,2.2),rnd.uniform(1.4,2.2),rnd.uniform(0.3,0.55),p,rz=J(1))
def debris(n,p,k=10):
    for i in range(k):
        x,y=rnd.uniform(-6,6),rnd.uniform(-6,6)
        if abs(x)<1.6 or abs(y)<1.6:x+=math.copysign(1.8,x or 1)
        if rnd.random()<0.5:B(f'{n}bd{i}',(rnd.uniform(0.6,1.4),0.12,0.03),(x,y,0.02),WOODS[i%4],rot=(0,0,J(3)),p=p)
        else:B(f'{n}ch{i}',(0.14,0.1,0.07),(x,y,0.035),[mADOBE,mBRICK][i%2],rot=(J(0.4),J(0.4),J(3)),p=p)

def sand_sheets(n,p,k=4):   # sand blown in across the floor: wide, thin, burying boards
    for i in range(k):blob(f'{n}ss{i}',(rnd.uniform(-5,5),rnd.uniform(-5,5),-0.02),(rnd.uniform(1.5,3.2),rnd.uniform(1.2,2.6),rnd.uniform(0.07,0.14)),[mSAND,mSAND2][i%2],p,seg=12,rings=4)
scene('TownFloorPlank');r=root('TownFloorPlank');plank_floor('pf',r);corner_drifts('pf',r);sand_sheets('pf',r);debris('pf',r);export('TownFloorPlank')

scene('TownFloorStone');r=root('TownFloorStone')
B('bed',(C,C,0.1),(0,0,-0.08),mDIRT,p=r);s=1.4
for i in range(10):
    for j in range(10):
        if rnd.random()<0.05:continue
        w=s-0.08-abs(J(0.08));B(f'fs{i}_{j}',(w,s-0.08-abs(J(0.08)),0.08),(-HALF+s/2+i*s+J(0.03),-HALF+s/2+j*s+J(0.03),-0.03+J(0.012)),[mSTONE,mSTONE2][(i*3+j)%2],rot=(J(0.012),J(0.012),J(0.03)),p=r)
corner_drifts('sf',r);sand_sheets('sf',r,5);debris('sf',r,8);export('TownFloorStone')

scene('TownFloorRot');r=root('TownFloorRot')
hx,hy=rnd.choice((-1,1))*3.8,rnd.choice((-1,1))*3.8   # the rotten patch sits in a quarter, off the paths
plank_floor('rf',r,hole=(hx,hy,1.5))
B('pit',(3.2,3.2,0.05),(hx,hy,-1.2),mDARK,p=r)
for k in range(10):   # splintered board ends hanging into the hole
    a=k*0.63;x=hx+math.cos(a)*1.45;y=hy+math.sin(a)*1.45
    B(f'splinter{k}',(0.26,0.5,0.04),(x,y,-0.2),mGREY2,rot=(math.cos(a)*0.7,-math.sin(a)*0.7,a),p=r)
corner_drifts('rf',r,3);sand_sheets('rf',r,2);debris('rf',r,6);export('TownFloorRot')

# ================= ceilings (underside at z 4) =================
def ceiling(n,p,caved=False):
    B(f'{n}earth',(C,C,0.3),(0,0,H+0.35),mDIRT,p=p)
    bw=0.3
    for i in range(int(C/bw)):
        if rnd.random()<0.08:continue
        B(f'{n}pl{i}',(bw-0.03,C,0.05),(-HALF+bw/2+i*bw,0,H+0.17),[mGREY2,mTIM2,mGREY][i%3],rot=(J(0.01),0,0),p=p)
    for k in range(3):
        y=-HALF+2.2+k*4.8
        if k==1 and not caved:   # the middle beam cracked and sags in the middle
            for s in (-1,1):B(f'{n}bm{k}{s}',(C/2+0.1,0.28,0.28),(s*C/4,y,H-0.14-0.28),mTIM,rot=(0,-s*0.08,0),p=p)
        else:B(f'{n}bm{k}',(C,0.28,0.28),(0,y,H-0.14+J(0.02)),mTIM,p=p)
    for k in range(6):roots(f'{n}rt{k}',rnd.uniform(-6,6),rnd.uniform(-6,6),H+0.1,p,k=rnd.randint(2,5),L=rnd.uniform(0.6,1.6))
    for k in range(3):   # dirt bulging through gaps
        blob(f'{n}bulge{k}',(rnd.uniform(-5,5),rnd.uniform(-5,5),H+0.1),(rnd.uniform(0.4,0.9),rnd.uniform(0.4,0.9),0.25),mDIRT,p)
    if caved:   # one corner came down: a heap of earth and broken ceiling reaching up to the hole
        sx,sy=rnd.choice((-1,1)),rnd.choice((-1,1));cx,cy=sx*(HALF-2.3),sy*(HALF-2.3)
        B(f'{n}hole',(3.6,3.6,0.5),(cx,cy,H+0.1),mDARK,p=p)
        blob(f'{n}heap',(cx,cy,0),(2.6,2.6,2.3),mDIRT,p,seg=12,rings=6)
        blob(f'{n}heap2',(cx+sx*0.3,cy+sy*0.3,1.0),(1.8,1.8,2.2),mSAND2,p,seg=10,rings=6)
        for k in range(6):B(f'{n}fall{k}',(rnd.uniform(1.2,2.6),0.26,0.06),(cx+J(1.2),cy+J(1.2),rnd.uniform(0.8,2.6)),[mGREY2,mTIM2][k%2],rot=(J(0.9),J(0.9),J(3)),p=p)
        rubble(f'{n}rub',cx-sx*1.4,cy-sy*1.4,1.0,14,p,big=0.4)
        col('TownCeilingCaved',cx,cy,4.0,4.0)
scene('TownCeiling');r=root('TownCeiling');ceiling('c',r);export('TownCeiling')
scene('TownCeilingCaved');r=root('TownCeilingCaved');ceiling('cc',r,caved=True);export('TownCeilingCaved')

# ================= furniture =================
def table(n,x,y,rz,p,w=1.6,d=0.9,h=0.78,tip=0,m=None):
    m=m or rnd.choice(WOODS);g=grp(n,(x,y,0),(0,0,rz),p)
    if tip:   # on its side: top standing up, legs sticking out
        t=grp(n+'t',(0,0,d/2),(math.radians(88),0,0),g);B(n+'top',(w,d,0.05),(0,0,h),m,p=t)
        for sx in (-1,1):
            for sy in (-1,1):B(f'{n}leg{sx}{sy}',(0.07,0.07,h),(sx*(w/2-0.08),sy*(d/2-0.08),h/2),m,p=t)
    else:
        B(n+'top',(w,d,0.05),(0,0,h),m,p=g)
        for i,(sx,sy) in enumerate(((-1,-1),(1,-1),(-1,1),(1,1))):
            if i==3 and rnd.random()<0.4:B(f'{n}legoff',(0.07,h,0.07),(sx*0.4,sy*(d/2+0.3),0.04),m,rot=(0,0,0.5),p=g);continue
            B(f'{n}leg{i}',(0.07,0.07,h),(sx*(w/2-0.08),sy*(d/2-0.08),h/2),m,p=g)
    return g
def chair(n,x,y,rz,p,fallen=False,m=None):
    m=m or rnd.choice(WOODS);g=grp(n,(x,y,0),(0,0,rz),p)
    t=grp(n+'t',(0,0,0.24 if fallen else 0),(math.radians(92) if fallen else 0,0,0),g)
    B(n+'seat',(0.45,0.45,0.05),(0,0,0.46),m,p=t)
    for sx in (-1,1):
        for sy in (-1,1):B(f'{n}l{sx}{sy}',(0.045,0.045,0.46),(sx*0.19,sy*0.19,0.23),m,p=t)
        B(f'{n}back{sx}',(0.045,0.045,0.5),(sx*0.19,0.2,0.72),m,p=t)
    for k in range(2):B(f'{n}slat{k}',(0.4,0.03,0.07),(0,0.2,0.66+k*0.2),m,p=t)
    return g
def crate(n,x,y,rz,p,s=0.6,broken=False):
    g=grp(n,(x,y,0),(0,0,rz),p);m=rnd.choice(WOODS)
    if broken:
        B(n+'base',(s,s,0.03),(0,0,0.015),m,p=g)
        for k,(dx,dy) in enumerate(((0,-1),(1,0))):B(f'{n}side{k}',(s if dy else 0.03,0.03 if dy else s,s),(dx*s/2,dy*s/2,s/2),m,p=g)
        B(n+'flat',(s,s,0.03),(s*0.9,-s*0.2,0.02),m,rot=(0,0,0.4),p=g)
    else:
        B(n+'box',(s,s,s),(0,0,s/2),m,p=g)
        for k in (-1,1):B(f'{n}band{k}',(s+0.02,s+0.02,0.06),(0,0,s/2+k*s*0.3),rnd.choice(WOODS),p=g)
    return g
def barrel(n,x,y,p,h=0.9,r=0.3,fallen=False,rz=0):
    g=grp(n,(x,y,r if fallen else 0),(math.radians(90) if fallen else 0,0,rz),p)
    Cy(n+'body',r,h,(0,0,h/2 if not fallen else 0),rnd.choice(WOODS),v=12,p=g)
    for zz in (0.12,0.5,0.88):Cy(f'{n}hoop{zz}',r+0.015,0.04,(0,0,(h*zz if not fallen else h*(zz-0.5))),mRUST,v=12,p=g)
    return g
def sack(n,x,y,p,s=0.35,m=None):return blob(n,(x,y,s*0.7),(s,s*0.8,s*0.75),m or mCLOTH,p,seg=8,rings=5)
def shelf(n,x,y,rz,p,w=1.8,h=2.0,d=0.4,rows=4,fill=None,lean=0):
    g=grp(n,(x,y,0),(lean,0,rz),p);m=rnd.choice(WOODS)
    for s in (-1,1):B(f'{n}side{s}',(0.05,d,h),(s*w/2,0,h/2),m,p=g)
    B(n+'back',(w,0.03,h),(0,d/2,h/2),mTIM2,p=g)
    for k in range(rows):
        z=0.1+k*(h-0.15)/(rows-1)
        if k>0 and rnd.random()<0.2:B(f'{n}sh{k}',(w,d,0.035),(0,0,z-0.15),m,rot=(0,0.18*rnd.choice((-1,1)),0),p=g);continue
        B(f'{n}sh{k}',(w,d,0.035),(0,0,z),m,p=g)
        if fill and k>0:fill(f'{n}f{k}',g,w,z,d)
    return g
def jars(n,g,w,z,d,m=None):
    for i in range(int(w/0.16)):
        if rnd.random()<0.35:continue
        x=-w/2+0.1+i*0.16
        if rnd.random()<0.15:Cy(f'{n}{i}',0.05,0.14,(x,-0.05,z+0.07),m or mGLASS,v=8,rot=(math.pi/2,0,J(1)),p=g);continue
        Cy(f'{n}{i}',0.05,0.14,(x,0,z+0.09),m or mGLASS,v=8,p=g)
def books(n,g,w,z,d):
    x=-w/2+0.06
    while x<w/2-0.1:
        t=rnd.uniform(0.03,0.07);hh=rnd.uniform(0.18,0.28)
        if rnd.random()<0.2:x+=0.1;continue
        B(f'{n}{x:.2f}',(t,0.2,hh),(x,0,z+hh/2),M_('book'+str(int(x*10)%4),sh((0x6a,0x3a,0x2a),rnd.randint(-20,20))),rot=(0,rnd.choice((0,0,0.3)),0),p=g);x+=t+0.01
def bottles(n,g,w,z,d):jars(n,g,w,z,d,m=M_('bottle',(0x3a,0x5a,0x3a),0.2))
def bed(n,x,y,rz,p):
    g=grp(n,(x,y,0),(0,0,rz),p);m=rnd.choice(WOODS)
    for s in (-1,1):
        B(f'{n}rail{s}',(0.06,2.0,0.25),(s*0.5,0,0.35),m,p=g)
        B(f'{n}head{s}',(1.1,0.06,0.9 if s<0 else 0.6),(0,s*1.0,(0.45 if s<0 else 0.3)),m,p=g)
    B(n+'mat',(0.95,1.9,0.16),(0,0,0.45),mCLOTH,rot=(0.04,0.03,0),p=g)
    B(n+'blank',(1.0,1.1,0.05),(0.05,0.35,0.55),M_('blanket',(0x6a,0x4a,0x5a)),rot=(0.02,0.08,0.05),p=g)
    return g
def counter(n,x,y,rz,p,w=4.0,h=1.05,d=0.7):
    g=grp(n,(x,y,0),(0,0,rz),p)
    B(n+'front',(w,0.06,h-0.05),(0,-d/2,(h-0.05)/2),rnd.choice(WOODS),p=g)
    for k in range(int(w/0.6)):B(f'{n}pan{k}',(0.5,0.02,0.6),(-w/2+0.35+k*0.6,-d/2-0.03,0.5),mTIM2,p=g)
    B(n+'top',(w+0.1,d+0.1,0.06),(0,0,h),mTIM,rot=(0,0.015,0),p=g)
    for s in (-1,1):B(f'{n}end{s}',(0.06,d,h),(s*w/2,0,h/2),mTIM2,p=g)
    return g
def bars(n,x,y,rz,p,w=6.0,h=3.0,door=True):
    g=grp(n,(x,y,0),(0,0,rz),p)
    for s in (0,1):B(f'{n}rail{s}',(w,0.06,0.06),(0,0,0.1+s*(h-0.2)),mRUST,p=g)
    k=int(w/0.2)
    for i in range(k):
        xx=-w/2+0.1+i*0.2
        if door and 0.6<xx<1.6:continue
        if rnd.random()<0.06:tube(f'{n}b{i}',(xx,0,0.1),(xx+0.25,-0.1,h*0.6),0.018,mRUST,g);continue   # bent
        Cy(f'{n}b{i}',0.018,h,(xx,0,h/2),mRUST,v=5,p=g)
    if door:   # the cell door hangs open on one hinge
        dg=grp(n+'door',(0.6,0,0),(0,0,-1.1),g)
        for s in (0,1):B(f'{n}drail{s}',(1.0,0.05,0.05),(0.5,0,0.2+s*(h-0.5)),mRUST,p=dg)
        for i in range(5):Cy(f'{n}db{i}',0.018,h-0.3,(0.1+i*0.2,0,(h-0.3)/2+0.1),mRUST,v=5,p=dg)
    return g
def pew(n,x,y,rz,p,w=3.0,tip=False):
    g=grp(n,(x,y,0 if not tip else 0.3),(0,math.radians(80) if tip else 0,rz),p);m=rnd.choice(WOODS)
    B(n+'seat',(w,0.45,0.06),(0,0,0.45),m,p=g);B(n+'back',(w,0.06,0.55),(0,0.22,0.8),m,p=g)
    for s in (-1,1):B(f'{n}end{s}',(0.07,0.55,0.95),(s*w/2,0.05,0.47),mTIM2,p=g)
    return g
def skeleton(n,x,y,rz,p):   # an old skeleton slumped on the floor (someone didn't get out)
    g=grp(n,(x,y,0),(0,0,rz),p)
    blob(n+'skull',(0,0.55,0.12),(0.11,0.13,0.1),mBONE,g,seg=8,rings=5)
    for k in range(6):B(f'{n}rib{k}',(0.3,0.025,0.025),(0,0.25-k*0.06,0.08),mBONE,rot=(0,0,J(0.1)),p=g)
    B(n+'spine',(0.03,0.5,0.03),(0,0.12,0.05),mBONE,p=g)
    for s in (-1,1):
        tube(f'{n}arm{s}',(s*0.18,0.28,0.05),(s*0.4,0.0,0.03),0.02,mBONE,g,v=4);tube(f'{n}leg{s}',(s*0.1,-0.15,0.04),(s*0.18,-0.75,0.03),0.025,mBONE,g,v=4)
    return g
def sign_board(n,x,y,z,rz,w,h,txt,p,tilt=0.0,size=0.22):
    g=grp(n,(x,y,z),(0,tilt,rz),p);B(n+'b',(w,0.05,h),(0,0,0),mGREY,p=g)
    text(n+'t',txt,(0,-0.03,0),size,('t_paint',(0xd8,0xcc,0xb0),0.9),parent=g)
    return g
def poster(n,x,y,z,rz,p,w=0.45,h=0.6):
    g=grp(n,(x,y,z),(0,J(0.1),rz),p);B(n+'b',(w,0.01,h),(0,0,0),mPAPER,p=g)
    for k in range(4):B(f'{n}l{k}',(w*0.7,0.012,0.03),(0,-0.005,h/2-0.12-k*0.1),mDARK,p=g)
    return g
def wall_side(side,t=0.25):   # a spot against one of the four walls: (x, y, rz facing into the room)
    return {'n':(0,INNER-t,0),'s':(0,-(INNER-t),math.pi),'e':(INNER-t,0,-math.pi/2),'w':(-(INNER-t),0,math.pi/2)}[side]
# the four free quarters of a room (keep out of the 3.2 m cross): centres at +-4.4
Q=[(-4.4,-4.4),(4.4,-4.4),(-4.4,4.4),(4.4,4.4)]

ROOMS={}
def room(key,title):
    def deco(f):ROOMS[key]=(title,f);return f
    return deco

@room('school','Schoolhouse')
def _(r,n):
    for i,(x,y) in enumerate([(-5.4,-3.0),(-3.4,-3.0),(-5.4,-5.0),(-3.4,-5.0),(3.4,-3.0),(5.4,-3.0),(3.4,-5.0),(5.4,-5.0)]):   # rows of small desks facing the board
        g=grp(f'desk{i}',(x,y,0),(0,0,0),r);tip=rnd.random()<0.3;t=grp(f'dt{i}',(0,0,0.3 if tip else 0),(math.radians(85) if tip else 0,0,0),g)
        B(f'dtop{i}',(1.0,0.55,0.04),(0,0,0.68),rnd.choice(WOODS),rot=(0.12,0,0),p=t)
        for s in (-1,1):B(f'dleg{i}{s}',(0.05,0.5,0.66),(s*0.42,0,0.33),mIRON,p=t)
        B(f'slate{i}',(0.28,0.2,0.015),(0.2,0,0.71),mDARK,rot=(0.12,0,0.2),p=t)
        col('school',x,y,1.0,0.6)
    x,y,rz=wall_side('n',0.12)
    B('board',(4.0,0.06,1.4),(-4.2,y,1.9),M_('chalkboard',(0x2a,0x34,0x2e),0.95),p=r);B('boardframe',(4.2,0.08,1.6),(-4.2,y+0.02,1.9),mTIM,p=r)
    text('chalk','A B C  1882',(-4.4,y-0.04,2.2),0.28,M_('chalk',(0xb8,0xb4,0xa8)),parent=r)
    text('chalk2','K. BARLOW',(-4.2,y-0.04,1.75),0.22,M_('chalk',(0xb8,0xb4,0xa8)),parent=r)
    table('teacher',4.6,5.2,0,r,w=1.8,d=0.9);col('school',4.6,5.2,1.8,0.9);chair('tchair',4.6,5.9,math.pi,r)
    Cy('apple',0.05,0.08,(4.2,5.1,0.83),M_('apple_old',(0x6a,0x2a,0x1c)),p=r)
    shelf('bookshelf',-6.3,4.6,math.pi/2,r,w=1.6,rows=4,fill=books,lean=0.05);col('school',-6.3,4.6,0.5,1.6)
    Cy('globestand',0.03,0.8,(5.8,-6.0,0.4),mBRASS,p=r);blob('globeball',(5.8,-6.0,0.95),(0.2,0.2,0.2),M_('globe',(0x5a,0x6a,0x5a)),r)
    for k in range(6):B(f'paper{k}',(0.21,0.28,0.004),(rnd.uniform(-6,-2),rnd.uniform(-6,-2),0.01),mPAPER,rot=(0,0,J(3)),p=r)
    Cy('bell',0.14,0.2,(-2.6,5.8,0.1),mBRASS,v=10,r2=0.07,rot=(1.2,0,0.4),p=r)

@room('sheriff',"Sheriff's office")
def _(r,n):
    table('desk',4.4,4.6,0.1,r,w=2.0,d=1.0);col('sheriff',4.4,4.6,2.0,1.0);chair('dchair',4.4,5.5,math.pi,r,fallen=True)
    B('ledger',(0.4,0.3,0.05),(4.2,4.5,0.83),M_('ledger',(0x4a,0x2a,0x1c)),rot=(0,0,0.3),p=r)
    Cy('lamp',0.1,0.3,(5.0,4.3,0.95),mGLASS,v=8,p=r)
    x,y,rz=wall_side('w',0.15)
    g=grp('gunrack',(x,-4.5,1.8),(0,0,rz),r);B('rackback',(1.6,0.05,1.0),(0,0,0),mTIM,p=g)
    for k in range(3):tube(f'rifle{k}',(-0.5+k*0.5,-0.08,-0.6),(-0.45+k*0.5,-0.08,0.6),0.025,mIRON,g,v=5)
    for k in range(4):poster(f'wanted{k}',-2.5-k*0.9 if k<2 else 2.5+(k-2)*0.9,INNER-0.02,1.7,0,r)
    text('wantedhdr','WANTED',(-2.95,INNER-0.05,2.1),0.12,mDARK,parent=r)
    B('cabinet',(0.8,0.6,1.3),(-5.8,5.8,0.65),mIRON,p=r);col('sheriff',-5.8,5.8,0.8,0.6)
    for k in range(3):B(f'drawer{k}',(0.7,0.04,0.35),(-5.8,5.49,0.25+k*0.42),mRUST,p=r)
    B('drawerout',(0.7,0.55,0.3),(-5.8,5.0,0.8),mRUST,p=r)
    for k in range(10):B(f'file{k}',(0.22,0.3,0.004),(rnd.uniform(-6,-3),rnd.uniform(3,6),0.01),mPAPER,rot=(0,0,J(3)),p=r)
    Cy('spittoon',0.15,0.2,(3.2,-5.8,0.1),mBRASS,v=10,r2=0.1,p=r)
    B('star',(0.1,0.02,0.1),(4.9,4.8,0.83),mBRASS,rot=(0,0,0.785),p=r)
    skeleton('skel',-4.6,-4.8,0.6,r)

@room('jail','Jail')
def _(r,n):
    bars('cellA',-4.2,2.2,0,r,w=5.6,h=3.2);col('jail',-4.2,2.2,5.6,0.2)
    bars('cellB',4.2,2.2,0,r,w=5.6,h=3.2,door=False);col('jail',4.2,2.2,5.6,0.2)
    for s in (-1,1):
        B(f'cot{s}',(0.8,1.9,0.08),(s*5.8,4.8,0.45),mCLOTH,p=r)
        for k in (-1,1):B(f'cotleg{s}{k}',(0.8,0.05,0.45),(s*5.8,4.8+k*0.85,0.22),mIRON,p=r)
        Cy(f'bucket{s}',0.16,0.3,(s*2.8,5.8,0.15),mRUST,v=10,r2=0.19,p=r)
    skeleton('prisoner',5.2,4.4,2.6,r)
    for k in range(4):B(f'tally{k}',(0.3,0.01,0.25),(-4.8+k*0.5,INNER-0.02,1.4),mDARK,p=r)   # scratched tally marks
    table('jailerdesk',-4.6,-4.8,0,r,w=1.4,d=0.8);col('jail',-4.6,-4.8,1.4,0.8);chair('jchair',-4.6,-5.6,0,r)
    Cy('keyring',0.08,0.015,(-4.5,-4.8,0.8),mRUST,v=10,p=r);B('key',(0.02,0.14,0.01),(-4.42,-4.72,0.81),mRUST,p=r)
    barrel('water',5.6,-5.6,r);col('jail',5.6,-5.6,0.7,0.7)

@room('store','General store')
def _(r,n):
    counter('counter',-4.2,3.4,0,r,w=4.2);col('store',-4.2,3.4,4.2,0.8)
    shelf('shelf1',-4.4,INNER-0.3,0,r,w=4.0,h=2.4,rows=5,fill=jars);col('store',-4.4,INNER-0.3,4.0,0.5)
    shelf('shelf2',4.4,INNER-0.3,0,r,w=4.0,h=2.4,rows=5,fill=bottles,lean=-0.08);col('store',4.4,INNER-0.3,4.0,0.5)
    Cy('scale',0.2,0.04,(-5.4,3.4,1.1),mBRASS,v=10,p=r);Cy('scalepost',0.03,0.35,(-5.4,3.4,1.28),mBRASS,p=r)
    B('till',(0.45,0.35,0.3),(-3.2,3.4,1.23),mBRASS,p=r)
    for i,(x,y) in enumerate([(3.6,-3.4),(4.4,-4.2),(5.4,-3.6),(3.8,-5.4),(5.6,-5.4)]):barrel(f'bar{i}',x,y,r,fallen=(i==2),rz=J(3));col('store',x,y,0.65,0.65)
    for i in range(5):sack(f'flour{i}',-5.6+i*0.55,-5.4+J(0.3),r,m=M_('flour',(0xb8,0xa8,0x8a)))
    col('store',-4.5,-5.4,3.0,0.8)
    crate('crateA',-2.6,-3.0,0.2,r,broken=True)
    for k in range(8):Cy(f'can{k}',0.05,0.1,(rnd.uniform(1.8,6),rnd.uniform(-2.5,-1.8),0.05),mRUST,v=8,rot=(math.pi/2,0,J(3)),p=r)
    sign_board('storesign',-4.2,INNER-0.08,3.2,0,3.0,0.5,'DRY GOODS',r,tilt=0.06)

@room('church','Church')
def _(r,n):
    for k in range(4):
        for s in (-1,1):
            tip=rnd.random()<0.25;x=s*4.3;y=-5.2+k*1.5
            if k==3:continue
            pew(f'pew{k}{s}',x,y,0,r,w=3.6,tip=tip);col('church',x,y,3.6,0.6)
    B('altarstep',(5.0,1.6,0.25),(0,INNER-0.9,0.12),mSTONE,p=r)
    g=grp('pulpit',(-3.4,5.2,0.25),(0,0.25,0),r);B('pul',(1.0,0.8,1.2),(0,0,0.6),mTIM,p=g);B('pultop',(1.1,0.9,0.06),(0,0,1.22),mTIM2,rot=(0.3,0,0),p=g);col('church',-3.4,5.2,1.0,0.8)
    g=grp('cross',(3.6,5.6,0.05),(0,0,0.3),r)   # the cross fell off the wall
    B('crossv',(0.16,2.2,0.12),(0,0,0.06),mTIM,p=g);B('crossh',(1.2,0.16,0.12),(0,0.45,0.08),mTIM,p=g)
    B('crossmark',(0.16,0.02,1.9),(3.6,INNER-0.02,2.2),mSTAIN,p=r);B('crossmarkh',(1.1,0.02,0.16),(3.6,INNER-0.02,2.6),mSTAIN,p=r)
    Cy('bell',0.55,0.7,(5.4,-5.6,0.35),mBRASS,v=14,r2=0.3,rot=(1.4,0,0.8),p=r);col('church',5.4,-5.6,1.2,1.2)
    B('bellbeam',(2.6,0.3,0.3),(4.4,-4.8,0.15),mTIM,rot=(0,0,0.6),p=r)
    for k in range(6):B(f'hymn{k}',(0.14,0.2,0.03),(rnd.uniform(-6,6),rnd.uniform(-6,-2),0.02),M_('hymnal',(0x3a,0x2a,0x22)),rot=(0,0,J(3)),p=r)
    for k in range(5):Cy(f'candle{k}',0.03,rnd.uniform(0.1,0.3),(-1.9+k*0.3,INNER-0.5,0.38),M_('wax',(0xd8,0xcc,0xa8)),v=6,p=r)

@room('boatshed',"Sam's boat shed")
def _(r,n):
    g=grp('boat',(-4.2,-4.0,0.55),(0,math.pi,0.5),r)   # Mary Lou, upside down on sawhorses
    blob('hull',(0,0,0),(0.9,2.6,0.55),M_('hull',(0x6a,0x7a,0x7a),0.9),g,seg=12,rings=6)
    B('keel',(0.08,5.0,0.1),(0,0,0.55),mTIM,p=g)
    for k in range(5):B(f'rib{k}',(1.7,0.05,0.04),(0,-2+k,0.3),mTIM2,p=g)
    col('boatshed',-4.2,-4.0,2.6,4.6)
    for s in (-1,1):
        h=grp(f'horse{s}',(-4.2+s*0.9,-4.0-s*1.1,0),(0,0,0.5),r)
        B(f'hbeam{s}',(1.4,0.1,0.1),(0,0,0.6),mTIM,p=h)
        for k in (-1,1):B(f'hleg{s}{k}',(0.08,0.08,0.65),(k*0.55,0,0.3),mTIM2,rot=(0,k*0.2,0),p=h)
    text('maryloutxt','MARY LOU',(-4.2,-6.35,0.3),0.2,M_('paintred',(0x8a,0x2a,0x1c)),rot=(math.pi/2,0,0.5),parent=r)
    for k in range(2):tube(f'oar{k}',(4.6+k*0.4,INNER-0.3,0.1),(4.9+k*0.5,INNER-0.4,2.6),0.03,mGREY,r,v=5)
    for k in range(4):   # crates of onions
        x,y=2.6+(k%2)*0.75,4.2+(k//2)*0.75;crate(f'onc{k}',x,y,J(0.2),r,s=0.65)
        for j in range(4):blob(f'onion{k}{j}',(x+J(0.2),y+J(0.2),0.7),(0.07,0.07,0.06),M_('onion',(0xb8,0x8a,0x4a)),r,seg=6,rings=4)
    col('boatshed',3.0,4.6,1.5,1.5)
    for k in range(3):tube(f'net{k}',(-6.6,2.4+k*0.6,2.6),(-6.6,2.0+k*0.8,0.3),0.04,M_('net',(0x8a,0x7a,0x5a)),r,v=4)
    B('workbench',(2.4,0.7,0.85),(-4.6,5.6,0.42),mTIM,p=r);col('boatshed',-4.6,5.6,2.4,0.7)
    for k in range(3):B(f'tool{k}',(0.4,0.06,0.03),(-5.2+k*0.5,5.5,0.87),mRUST,rot=(0,0,J(0.6)),p=r)
    for k in range(6):Cy(f'peach{k}',0.05,0.14,(5.6+J(0.3),-5.6+k*0.18,0.07),M_('peachjar',(0xc8,0x8a,0x3a),0.3),v=8,p=r)

@room('saloon','Saloon')
def _(r,n):
    counter('bar',-3.8,4.6,0,r,w=5.4,h=1.1);col('saloon',-3.8,4.6,5.4,0.8)
    shelf('backbar',-3.8,INNER-0.25,0,r,w=5.0,h=2.2,rows=4,fill=bottles);col('saloon',-3.8,INNER-0.25,5.0,0.5)
    B('mirror',(3.0,0.03,1.0),(-3.8,INNER-0.05,2.6),M_('mirror',(0x5a,0x6a,0x6a),0.1,0.6),p=r);B('mcrack',(0.03,0.04,1.0),(-3.4,INNER-0.07,2.6),mDARK,rot=(0,0.5,0),p=r)
    for i,(x,y) in enumerate(Q[:2]+[(4.6,4.2)]):   # round tables, chairs around, some knocked over
        Cy(f'rt{i}',0.6,0.05,(x,y,0.76),rnd.choice(WOODS),v=12,p=r);Cy(f'rtleg{i}',0.06,0.74,(x,y,0.37),mTIM2,p=r);Cy(f'rtfoot{i}',0.3,0.05,(x,y,0.03),mTIM2,v=8,p=r)
        col('saloon',x,y,1.2,1.2)
        for k in range(3):a=k*2.1+J(0.3);chair(f'sc{i}{k}',x+math.cos(a)*1.0,y+math.sin(a)*1.0,a+math.pi/2,r,fallen=rnd.random()<0.4)
        Cy(f'glass{i}',0.04,0.1,(x+0.2,y,0.84),mGLASS,v=6,p=r);B(f'cards{i}',(0.3,0.2,0.01),(x-0.2,y+0.1,0.79),mPAPER,rot=(0,0,J(2)),p=r)
    g=grp('piano',(5.2,-5.4,0),(0,0,0),r);B('pbody',(1.6,0.7,1.3),(0,0,0.65),M_('piano',(0x3a,0x26,0x1c)),p=g);B('pkeys',(1.4,0.25,0.06),(0,-0.45,0.75),mBONE,p=g)
    for k in range(6):B(f'pkey{k}',(0.04,0.18,0.03),(-0.6+k*0.25,-0.47,0.79),mDARK,p=g)
    col('saloon',5.2,-5.4,1.6,0.8)
    for k in range(8):Cy(f'bottle{k}',0.04,0.28,(rnd.uniform(-6,-2),rnd.uniform(2,3.8),0.04),M_('bottle',(0x3a,0x5a,0x3a),0.2),v=6,rot=(math.pi/2,0,J(3)),p=r)
    sign_board('saloonsign',-3.8,INNER-0.08,3.35,0,2.4,0.45,'SALOON',r,tilt=-0.08)

@room('post','Post office')
def _(r,n):
    counter('pcounter',-4.0,3.6,0,r,w=4.4);col('post',-4.0,3.6,4.4,0.8)
    g=grp('cubbies',(-4.0,INNER-0.2,0),(0,0,0),r)   # the wall of pigeonholes
    B('cubback',(4.2,0.05,2.0),(0,0.18,1.6),mTIM2,p=g)
    for i in range(9):B(f'cv{i}',(0.03,0.35,2.0),(-2.1+i*0.525,0,1.6),mTIM,p=g)
    for j in range(6):B(f'ch{j}',(4.2,0.35,0.03),(0,0,0.6+j*0.4),mTIM,p=g)
    for i in range(8):
        for j in range(5):
            if rnd.random()<0.4:B(f'letter{i}{j}',(0.28,0.25,0.06),(-1.85+i*0.525,0,0.72+j*0.4),mPAPER,rot=(0,0,J(0.2)),p=g)
    col('post',-4.0,INNER-0.2,4.2,0.4)
    for i,(x,y) in enumerate([(4.0,-4.4),(4.9,-5.2),(5.4,-3.8),(3.4,-5.6)]):sack(f'mail{i}',x,y,r,s=0.42,m=M_('mailsack',(0x7a,0x6a,0x4a)))
    col('post',4.4,-4.6,2.4,2.2)
    for k in range(24):B(f'lt{k}',(0.2,0.12,0.004),(rnd.uniform(1.8,6.4),rnd.uniform(-6.4,-1.8),0.01),mPAPER,rot=(0,0,J(3)),p=r)
    B('scale',(0.5,0.4,0.2),(-5.4,3.6,1.15),mBRASS,p=r)
    B('stove',(0.7,0.7,0.9),(5.4,5.4,0.45),mIRON,p=r);tube('stovepipe',(5.4,5.4,0.9),(5.4,5.4,3.9),0.08,mIRON,r,v=8);col('post',5.4,5.4,0.8,0.8)
    sign_board('postsign',-4.0,INNER-0.08,3.4,0,2.8,0.42,'POST OFFICE',r,size=0.18)

@room('kate',"Kate's house")
def _(r,n):
    bed('bed',-4.8,4.6,0,r);col('kate',-4.8,4.6,1.2,2.2)
    g=grp('dresser',(4.6,INNER-0.35,0),(0,0,0),r);B('dres',(1.6,0.5,1.0),(0,0,0.5),mTIM,p=g)
    for k in range(3):B(f'dd{k}',(1.5,0.04,0.26),(0,-0.26,0.2+k*0.3),mTIM2,p=g)
    B('dmirror',(0.9,0.04,1.1),(0,0.1,1.6),M_('mirror',(0x5a,0x6a,0x6a),0.1,0.6),rot=(0.08,0,0),p=g);col('kate',4.6,INNER-0.35,1.6,0.5)
    g=grp('rocker',(4.4,-4.4,0),(0,0,2.4),r)   # the rocking chair
    for s in (-1,1):tube(f'rock{s}',(s*0.22,-0.45,0.08),(s*0.22,0.45,0.02),0.03,mTIM,g,v=5)
    chair('rockchair',0,0,0,g);col('kate',4.4,-4.4,0.8,0.9)
    shelf('peaches',-5.6,-4.4,math.pi/2,r,w=2.0,h=1.8,rows=4,fill=lambda n_,g_,w_,z_,d_:jars(n_,g_,w_,z_,d_,m=M_('peachjar',(0xc8,0x8a,0x3a),0.3)));col('kate',-5.6,-4.4,0.5,2.0)
    B('rug',(2.6,1.8,0.01),(-4.0,-4.0,0.005),M_('rug',(0x7a,0x3a,0x2a)),rot=(0,0,0.2),p=r)
    for k in range(6):Cy(f'fjar{k}',0.05,0.14,(rnd.uniform(-5,-3),rnd.uniform(-5,-3),0.05),M_('peachjar',(0xc8,0x8a,0x3a),0.3),v=8,rot=(math.pi/2,0,J(3)),p=r)
    B('photo',(0.3,0.02,0.4),(-2.6,INNER-0.02,1.8),mPAPER,rot=(0,0.1,0),p=r);B('photoframe',(0.36,0.02,0.46),(-2.6,INNER-0.01,1.8),mBRASS,rot=(0,0.1,0),p=r)
    text('heart','K + S',(-4.8,INNER-0.03,2.4),0.2,M_('carved',(0x3a,0x2a,0x1e)),parent=r)
    B('lipstickbox',(0.2,0.14,0.08),(4.3,INNER-0.4,1.04),M_('velvet',(0x6a,0x1a,0x2a)),p=r)

@room('barber','Barbershop')
def _(r,n):
    for i,x in enumerate((-5.2,-3.2)):
        g=grp(f'bchair{i}',(x,4.6,0),(0,0,math.pi+J(0.4)),r)
        Cy(f'bbase{i}',0.3,0.3,(0,0,0.15),mIRON,v=10,p=g);B(f'bseat{i}',(0.6,0.6,0.15),(0,0,0.55),M_('leather',(0x5a,0x2a,0x1c)),p=g)
        B(f'bback{i}',(0.6,0.12,0.8),(0,-0.3,1.0),M_('leather',(0x5a,0x2a,0x1c)),rot=(-0.2,0,0),p=g)
        for s in (-1,1):B(f'barm{i}{s}',(0.08,0.55,0.08),(s*0.32,0,0.8),mBRASS,p=g)
        col('barber',x,4.6,0.8,0.8)
    B('counter',(4.2,0.5,0.9),(-4.2,INNER-0.3,0.45),mTIM,p=r);col('barber',-4.2,INNER-0.3,4.2,0.5)
    B('bmirror',(4.0,0.03,1.2),(-4.2,INNER-0.03,1.9),M_('mirror',(0x5a,0x6a,0x6a),0.1,0.6),p=r)
    for k in range(3):B(f'bmcrack{k}',(0.03,0.04,rnd.uniform(0.5,1.1)),(-5.4+k*1.2,INNER-0.05,1.9),mDARK,rot=(0,J(0.7),0),p=r)
    for k in range(5):Cy(f'tonic{k}',0.04,0.16,(-5.6+k*0.4,INNER-0.35,0.98),mGLASS,v=6,p=r)
    Cy('basin',0.25,0.15,(-2.4,INNER-0.3,0.98),M_('enamel',(0xc8,0xc4,0xb8),0.4),v=12,p=r)
    g=grp('pole',(6.2,-6.2,0),(0.3,0,0.8),r)   # the striped pole, fallen against the corner
    Cy('polebody',0.1,1.4,(0,0,0.9),M_('polewhite',(0xd8,0xd0,0xc0)),v=10,p=g)
    for k in range(4):Cy(f'stripe{k}',0.102,0.1,(0,0,0.35+k*0.35),M_('polered',(0x8a,0x2a,0x1c)),v=10,rot=(0.3,0,0),p=g)
    table('wait',4.4,-4.2,0.3,r,w=1.2,d=0.6,h=0.5);chair('wchair1',3.4,-5.2,0.2,r);chair('wchair2',5.4,-5.2,-0.2,r,fallen=True)
    for k in range(8):blob(f'hair{k}',(rnd.uniform(-6,-2.5),rnd.uniform(3.4,5.8),0.02),(0.12,0.08,0.02),M_('hair',(0x3a,0x2a,0x1e)),r,seg=6,rings=3)

@room('stable','Stable')
def _(r,n):
    for i,y in enumerate((2.6,4.6)):   # stalls along the west side
        B(f'stallwall{i}',(3.6,0.1,1.4),(-5.0,y,0.7),mGREY,rot=(0,0,J(0.03)),p=r)
        col('stable',-5.0,y,3.6,0.15)
    B('stallend',(0.12,4.2,1.4),(-3.2,4.4,0.7),mGREY2,rot=(0,0.1,0),p=r);col('stable',-3.2,4.6,0.2,2.6)
    for k in range(6):blob(f'hay{k}',(rnd.uniform(-6.5,-3.6),rnd.uniform(2.9,6.2),0.1),(rnd.uniform(0.5,0.9),rnd.uniform(0.4,0.7),0.25),M_('hay',(0xb0,0x98,0x5a)),r,seg=8,rings=4)
    B('trough',(2.4,0.6,0.5),(4.6,5.6,0.25),mTIM,p=r);B('troughin',(2.2,0.45,0.1),(4.6,5.6,0.45),mDARK,p=r);col('stable',4.6,5.6,2.4,0.6)
    g=grp('wheel',(5.8,-3.0,0.9),(math.radians(80),0,1.5),r)   # a wagon wheel leaning on the wall
    bpy.ops.mesh.primitive_torus_add(major_radius=0.8,minor_radius=0.05,major_segments=18,minor_segments=4,location=(0,0,0));o=bpy.context.active_object;o.name='rim';_finish(o,mTIM,0,g)
    for k in range(8):a=k*0.785;tube(f'spoke{k}',(0,0,0),(math.cos(a)*0.78,math.sin(a)*0.78,0),0.025,mTIM2,g,v=4)
    Cy('hub',0.12,0.2,(0,0,0),mRUST,v=8,p=g)
    g=grp('saddle',(4.2,-4.6,0),(0,0,0.5),r);B('sadstand',(0.2,0.8,0.9),(0,0,0.45),mTIM,p=g);blob('saddleb',(0,0,0.95),(0.3,0.45,0.18),M_('leather',(0x5a,0x2a,0x1c)),g,seg=8,rings=5)
    col('stable',4.2,-4.6,0.6,0.9)
    for k in range(3):tube(f'harness{k}',(-6.6,-3+k*0.7,2.4),(-6.6,-3.2+k*0.7,1.2),0.02,M_('leather',(0x5a,0x2a,0x1c)),r,v=4)
    for k in range(3):B(f'shoe{k}',(0.12,0.12,0.02),(rnd.uniform(2,6),rnd.uniform(-6,-2),0.01),mRUST,rot=(0,0,J(3)),p=r)
    skeleton('horse',-4.8,-4.8,0.4,r)   # small, but it reads as something that died in here

@room('bank','Bank')
def _(r,n):
    counter('teller',-3.6,3.0,0,r,w=5.0,h=1.1);col('bank',-3.6,3.0,5.0,0.8)
    bars('cage',-3.6,3.0,0,r,w=5.0,h=1.1,door=False).location.z=1.15
    g=grp('safe',(4.8,INNER-0.7,0),(0,0,0),r)   # the big safe, door blown open
    B('safebody',(1.4,1.0,1.6),(0,0,0.8),M_('safegreen',(0x2f,0x46,0x3a),0.55,0.3),p=g);B('safein',(1.1,0.1,1.3),(0,-0.46,0.8),mDARK,p=g)
    d=grp('safedoor',(-0.7,-0.5,0),(0,0,-1.9),g);B('sdoor',(1.3,0.18,1.5),(0.65,-0.09,0.8),M_('safegreen',(0x2f,0x46,0x3a),0.55,0.3),p=d);Cy('sdial',0.1,0.05,(0.65,-0.2,1.0),mBRASS,v=12,rot=(math.pi/2,0,0),p=d)
    col('bank',4.8,INNER-0.7,1.4,1.0)
    table('manager',4.4,-4.4,0.2,r,w=1.8,d=0.9);chair('mchair',4.4,-5.3,0.1,r)
    col('bank',4.4,-4.4,1.8,0.9)
    for k in range(20):B(f'note{k}',(0.15,0.07,0.004),(rnd.uniform(2.8,6.2),rnd.uniform(2.8,5.4),0.01),M_('banknote',(0x7a,0x8a,0x6a)),rot=(0,0,J(3)),p=r)
    for k in range(4):B(f'lockbox{k}',(0.4,0.25,0.18),(rnd.uniform(-6,-2.5),rnd.uniform(-6,-2.5),0.09),mRUST,rot=(0,0,J(3)),p=r)
    sign_board('banksign',-3.6,INNER-0.08,3.2,0,3.4,0.5,'GREEN LAKE BANK',r,size=0.18)

@room('cellar','Onion cellar')
def _(r,n):
    for i,(x,y) in enumerate(Q):   # slatted bins heaped with onions gone to husk
        g=grp(f'bin{i}',(x,y,0),(0,0,0),r)
        for s in (-1,1):
            B(f'bw{i}{s}',(2.6,0.06,0.8),(0,s*1.2,0.4),rnd.choice(WOODS),p=g);B(f'bs{i}{s}',(0.06,2.4,0.8),(s*1.3,0,0.4),rnd.choice(WOODS),p=g)
        blob(f'pile{i}',(0,0,0.35),(1.2,1.1,0.55),M_('husk',(0x9a,0x7a,0x4a)),g,seg=10,rings=5)
        for k in range(10):blob(f'on{i}{k}',(J(1.0),J(0.9),0.75+J(0.1)),(0.08,0.08,0.07),M_('onion',(0xb8,0x8a,0x4a)),g,seg=6,rings=4)
        col('cellar',x,y,2.7,2.5)
    for k in range(6):sack(f'osack{k}',rnd.choice((-1,1))*rnd.uniform(1.8,2.4),rnd.uniform(-6,6),r,m=M_('burlap',(0x8a,0x72,0x4a)))
    for k in range(4):tube(f'hang{k}',(-6+k*4,J(1),H),(-6+k*4,J(1),H-0.6),0.01,mROOT,r,v=4)
    for k in range(4):blob(f'braid{k}',(-6+k*4,0,H-0.8),(0.15,0.15,0.25),M_('onion',(0xb8,0x8a,0x4a)),r,seg=6,rings=4)

@room('doctor',"Doctor's office")
def _(r,n):
    g=grp('extable',(-4.4,4.2,0),(0,0,0.1),r);B('ext',(0.8,2.0,0.08),(0,0,0.85),mTIM,p=g);B('expad',(0.75,1.9,0.08),(0,0,0.93),M_('leather',(0x4a,0x3a,0x2a)),p=g)
    for sx in (-1,1):
        for sy in (-1,1):B(f'exl{sx}{sy}',(0.06,0.06,0.85),(sx*0.34,sy*0.9,0.42),mTIM2,p=g)
    col('doctor',-4.4,4.2,0.9,2.1)
    shelf('medicine',4.4,INNER-0.25,0,r,w=3.2,h=2.2,rows=5,fill=bottles);col('doctor',4.4,INNER-0.25,3.2,0.5)
    table('ddesk',4.2,-4.4,-0.2,r,w=1.6,d=0.8);chair('dchair',4.2,-5.2,0.1,r,fallen=True);col('doctor',4.2,-4.4,1.6,0.8)
    B('bag',(0.45,0.25,0.3),(4.0,-4.3,0.93),M_('doctorbag',(0x2a,0x1a,0x14)),p=r)
    for k in range(5):Cy(f'vial{k}',0.03,0.1,(rnd.uniform(3,5.5),rnd.uniform(-4,-3),0.03),mGLASS,v=6,rot=(math.pi/2,0,J(3)),p=r)
    g=grp('screen',(-5.6,-4.2,0),(0,0,0.6),r)   # a folding screen, one panel down
    for k in range(3):B(f'scr{k}',(0.7,0.04,1.7),(k*0.7-0.7,J(0.1),0.85),M_('screencloth',(0xa8,0x9a,0x80)),rot=(0,0,(k-1)*0.4),p=g)
    col('doctor',-5.6,-4.2,2.0,0.6)
    Cy('stool',0.2,0.6,(-3.2,3.4,0.3),mIRON,v=8,p=r)
    B('chart',(0.5,0.02,0.7),(-4.4,INNER-0.02,1.8),mPAPER,p=r);blob('chartskull',(-4.4,INNER-0.04,1.95),(0.08,0.01,0.1),mDARK,r,seg=6,rings=4)

@room('hotel','Hotel')
def _(r,n):
    counter('desk',-4.2,3.6,0,r,w=3.6);col('hotel',-4.2,3.6,3.6,0.8)
    g=grp('keyboard',(-4.2,INNER-0.05,1.8),(0,0,0),r);B('kb',(1.8,0.05,0.9),(0,0,0),mTIM,p=g)
    for i in range(6):
        for j in range(2):
            Cy(f'hook{i}{j}',0.015,0.06,(-0.75+i*0.3,-0.05,0.2-j*0.4),mBRASS,v=4,rot=(math.pi/2,0,0),p=g)
            if rnd.random()<0.5:B(f'fob{i}{j}',(0.05,0.02,0.12),(-0.75+i*0.3,-0.07,0.1-j*0.4),mBRASS,p=g)
    Cy('deskbell',0.07,0.06,(-3.0,3.6,1.12),mBRASS,v=10,r2=0.02,p=r)
    B('register',(0.6,0.4,0.06),(-4.6,3.5,1.1),M_('ledger',(0x4a,0x2a,0x1c)),rot=(0,0,0.1),p=r)
    for k in range(5):   # the stair to the rooms upstairs, going up into the dirt
        B(f'st{k}',(1.4,0.35,0.22),(5.6,-5.8+k*0.36,0.11+k*0.22),mTIM,p=r)
    for k in range(5,9):B(f'stb{k}',(1.4,0.35,0.22),(5.6+J(0.2),-5.8+k*0.36,0.11+k*0.22-0.1*(k-4)),mGREY2,rot=(J(0.3),J(0.3),J(0.3)),p=r)
    blob('stairdirt',(5.6,-2.8,1.8),(1.0,1.4,1.4),mDIRT,r,seg=8,rings=5)
    B('banister',(0.06,3.4,0.06),(4.85,-4.4,1.6),mTIM2,rot=(0.55,0,0),p=r)
    col('hotel',5.6,-4.2,1.5,3.4)
    g=grp('sofa',(-4.6,-4.6,0),(0,0,0.3),r)
    B('sofaseat',(2.0,0.8,0.45),(0,0,0.25),M_('velvet2',(0x5a,0x2a,0x2a)),p=g);B('sofaback',(2.0,0.2,0.6),(0,0.35,0.7),M_('velvet2',(0x5a,0x2a,0x2a)),p=g)
    for s in (-1,1):B(f'sofaarm{s}',(0.2,0.8,0.65),(s*1.0,0,0.32),M_('velvet2',(0x5a,0x2a,0x2a)),p=g)
    B('stuffing',(0.4,0.3,0.1),(0.4,-0.1,0.5),M_('stuffing',(0xb8,0xa8,0x88)),p=g);col('hotel',-4.6,-4.6,2.2,1.0)
    Cy('spittoon',0.15,0.2,(-2.4,-5.6,0.1),mBRASS,v=10,r2=0.1,p=r)
    B('rug',(3.0,2.0,0.01),(-4.4,-4.2,0.005),M_('rug',(0x7a,0x3a,0x2a)),p=r)
    sign_board('hotelsign',-4.2,INNER-0.08,3.45,0,2.4,0.4,'HOTEL',r,tilt=0.1)

@room('vault',"Kate's vault")
def _(r,n):
    B('vaultfloor',(6.0,4.0,0.06),(0,5.0,0.03),mSTONE,p=r)
    for s in (-1,1):B(f'vwall{s}',(0.5,3.6,3.2),(s*3.0,5.2,1.6),mSTONE2,p=r);col('vault',s*3.0,5.2,0.5,3.6)
    B('vtop',(6.5,3.8,0.5),(0,5.2,3.35),mSTONE2,p=r)
    g=grp('vaultdoor',(-2.6,3.3,0),(0,0,-1.3),r)   # the round vault door, swung open
    Cy('vdoor',1.3,0.35,(1.35,0,1.45),M_('vaultsteel',(0x4a,0x4e,0x52),0.45,0.7),v=20,rot=(math.pi/2,0,0),p=g)
    Cy('vwheel',0.35,0.08,(1.35,-0.22,1.45),mBRASS,v=12,rot=(math.pi/2,0,0),p=g)
    for k in range(4):a=k*0.785;B(f'vspoke{k}',(0.7,0.04,0.04),(1.35,-0.25,1.45),mBRASS,rot=(0,a,0),p=g)
    for i in range(3):   # stacks of gold bars on the vault floor
        for j in range(3-i):
            for k in range(2):B(f'gb{i}{j}{k}',(0.3,0.14,0.09),(-0.5+j*0.33+i*0.16,5.6+k*0.18,0.1+i*0.09),mGOLD,p=r)
    col('vault',0,5.6,1.4,0.6)
    for k in range(3):B(f'strongbox{k}',(0.5,0.35,0.3),(1.6,4.4+k*0.5,0.15),mRUST,rot=(0,0,J(0.3)),p=r)
    Cy('lamp',0.12,0.35,(-1.8,6.4,0.18),mGLASS,v=8,p=r)
    text('kb','KB',(0,6.99,2.4),0.5,mGOLD,parent=r)
    for k in range(4):skeleton(f'digger{k}',rnd.choice((-1,1))*rnd.uniform(3,5.5),rnd.uniform(-6,-2),J(3),r) if k<2 else None
    for k in range(6):B(f'pick{k}',(0.9,0.05,0.05),(rnd.uniform(-6,6),rnd.uniform(-6,-2),0.03),mTIM,rot=(0,0,J(3)),p=r)

@room('stair','Collapsed stairwell')
def _(r,n):
    # stone steps climbing north out of the town until the roof comes down on them; daylight leaks through
    for k in range(8):B(f'step{k}',(3.0,0.6,0.3*(k+1)),(0,-1.8+k*0.6,0.15*(k+1)),mSTONE if k%2 else mSTONE2,p=r)
    for s in (-1,1):B(f'swall{s}',(0.4,5.0,3.6),(s*1.8,0.4,1.8),mADOBE2,p=r)
    blob('cavein',(0,3.6,2.4),(2.0,1.6,1.8),mDIRT,r,seg=10,rings=6);blob('cavein2',(0.4,3.2,3.3),(1.4,1.2,1.0),mSAND2,r,seg=8,rings=5)
    for k in range(5):B(f'fallbeam{k}',(2.6,0.25,0.25),(J(0.6),2.2+k*0.3,2.4+k*0.25),mTIM,rot=(J(0.4),J(0.5),J(0.6)),p=r)
    for s in (-1,1):col('stair',s*1.8,0.4,0.4,5.0)
    rubble('srub',0,-2.8,1.2,10,r,big=0.35)
    for k in range(3):roots(f'sroot{k}',J(1.2),J(2),H,r,k=3,L=1.4)

@room('well','Old well')
def _(r,n):
    k=16
    for i in range(k):   # the round stone well in the middle of the room, 1.1 m radius (the game's climb spot)
        a=i*2*math.pi/k;B(f'wstone{i}',(0.45,0.3,0.9),(math.cos(a)*1.0,math.sin(a)*1.0,0.45),mSTONE if i%2 else mSTONE2,rot=(0,0,a+math.pi/2),p=r)
    Cy('wdark',0.85,0.05,(0,0,0.5),mDARK,v=16,p=r)
    for s in (-1,1):B(f'wpost{s}',(0.15,0.15,2.0),(s*1.2,0,1.0),mTIM,p=r)
    Cy('windlass',0.1,2.6,(0,0,1.9),mTIM2,v=8,rot=(0,math.pi/2,0),p=r)
    tube('wrope',(0.2,0,1.9),(0.2,0,0.4),0.02,M_('rope',(0xa8,0x8a,0x5a)),r,v=4)
    Cy('wbucket',0.16,0.25,(-1.5,0.9,0.13),mTIM,v=10,r2=0.19,rot=(1.4,0,0.5),p=r)
    B('wroof',(3.0,1.4,0.08),(0,0.4,2.2),mGREY2,rot=(0.5,0,0),p=r);B('wroof2',(3.0,1.4,0.08),(0,-0.4,2.35),mGREY2,rot=(-0.5,0,0.05),p=r)
    for i,(x,y) in enumerate(Q):
        if i%2==0:barrel(f'wbarrel{i}',x,y,r);col('well',x,y,0.65,0.65)
        else:crate(f'wcrate{i}',x,y,J(0.5),r,s=0.7,broken=True)
    drift('wdrift',0,0,2.2,2.2,0.25,r)
    col('well',0,0,2.6,2.6)

# ================= build the rooms =================
KEYMAP={}
for key,(title,f) in ROOMS.items():
    n='TownRoom_'+key;scene(n);r=root(n);f(r,n);KEYMAP[title]=key
    # every room gets a bit of wreckage in the free quarters too
    qx,qy=rnd.choice(Q)
    rubble(n+'rub',qx+J(1),qy+J(1),0.8,8,r)
    if key not in ('stair','vault','well'):
        bx,by=rnd.choice(Q);sx,sy=math.copysign(1,bx),math.copysign(1,by)   # a ceiling beam came down: one end on the floor, one still up
        tube(n+'fallbeam',(bx-sx*1.2,by+J(1.5),0.12),(bx+sx*1.4,by+J(1.5),H-0.2),0.14,mTIM,r,v=6);col(key,bx-sx*1.2,by,0.6,0.6)
        for i in range(3):B(f'{n}junk{i}',(rnd.uniform(0.8,1.6),0.14,0.04),(bx+J(1.5),by+J(1.5),0.03),rnd.choice(WOODS),rot=(0,0,J(3)),p=r)
    for i in range(2):drift(n+f'heap{i}',rnd.choice((-1,1))*rnd.uniform(2.5,5.5),rnd.choice((-1,1))*rnd.uniform(2.5,5.5),rnd.uniform(0.8,1.4),rnd.uniform(0.7,1.2),rnd.uniform(0.25,0.45),r)
    export(n,rend=True)
json.dump({'cols':COLS,'rooms':KEYMAP},open(os.path.join(OUT,'TownColliders.json'),'w'),separators=(',',':'))
print('rooms',len(ROOMS),'colliders',sum(len(v) for v in COLS.values()))
bpy.ops.wm.save_mainfile()
