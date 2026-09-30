# blend: town.blend
# The buried town of Green Lake: a hundred-odd years under the lake bed. public/sim.js (townLayout) picks the day's
# layout: Main Street, a buried street cavern with three big buildings on each side, and seven more buildings off it,
# reached by timber-shored tunnels. public/js/89-town.js puts these pieces where the layout says and digs the tunnels
# (their cave walls are generated there along each day's path; the timber sets and debris in them come from here).
#
# Scenes, all exported to glb/Town*.glb for public/models/:
#   TownStreet          Main Street, x -34..34, z -7.5..7.5 (game), ceiling 5.5 m: boardwalks and porches in front of
#                       the six building slots, earth between them, the collapsed stairwell at the west end (the way out)
#                       and a tunnel mouth at the east end
#   TownBldg_<key>      one per building (sizes from SIM TOWN_SIZE: L 14 x 12, M 11 x 10, S 9 x 8): its walls with a
#                       doorway in the middle of every side, floor, ceiling, false front and sign on the front (local -z,
#                       the street side), and its furnishings, kept out of the 2.6 m cross that joins the four doors
#   TownDoorPlug        a doorway that leads nowhere today: boarded over, with dirt pushing through
#   TownMouthPlug       the street's east tunnel mouth when it's caved in
#   TownShoring         a timber set for the tunnels (posts and cap, 2.6 m wide, 2.6 m high)
#   TownJunkA/B/C       debris left along the tunnels
# Furniture you'd walk into is recorded as colliders in glb/TownColliders.json (game metres from the piece's centre,
# [dx, dz, w, d]); copy it to public/data/ with the GLBs.
#
# Blender (x, y, z) = game (dx, -dz, y) from the piece's centre: a building's front (game local -z) is Blender +Y.
# Run with the live Blender:  python3 bx.py town.py   (bx.py opens town.blend first)
import bpy,os,re,math,json,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'town.py')   # so cgl_blender.py's ART/RENDERS point at this checkout
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
from mathutils import Vector
OUT=os.path.join(ART,'glb')
H,TH,DW,DH=3.6,0.3,1.8,2.4   # building height (SIM.TOWN.H), wall thickness, door width and height
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

# ================= building shells =================
def wall_detail(n,L,p,h,inside_only=False):
    """One wall along local X (-L/2..L/2), thickness TH, height h: brick where the plaster fell off, a flood stain, cracks,
    timber posts through it, sand against the foot. Both faces (the outside shows where tunnels reach the doors)."""
    for s in ((1,) if inside_only else (-1,1)):
        y=s*(TH/2+0.012)
        for k in range(max(1,int(L/3.4))):
            w=rnd.uniform(0.7,1.3);hh=rnd.uniform(0.5,0.9);cx=rnd.uniform(-L/2+w/2+0.2,L/2-w/2-0.2);cz=rnd.uniform(0.9,h-hh/2-0.3)
            B(f'{n}br{s}{k}',(w,0.02,hh),(cx,y,cz),mMORT,p=p)
            for rr in range(int(hh/0.15)):
                for cc in range(int(w/0.27)):
                    if rnd.random()<0.15:continue
                    B(f'{n}bk{s}{k}{rr}{cc}',(0.24,0.05,0.12),(cx-w/2+0.14+0.13*(rr%2)+cc*0.27,y+s*0.012,cz-hh/2+0.08+rr*0.15),mBRICK if (rr+cc)%3 else mADOBE2,p=p)
        B(f'{n}stain{s}',(L,0.02,0.3),(0,y,0.5),mSTAIN,p=p)
        for k in range(max(1,int(L/4))):
            B(f'{n}cr{s}{k}',(0.03,0.02,rnd.uniform(0.4,0.9)),(rnd.uniform(-L/2+0.3,L/2-0.3),y+s*0.004,rnd.uniform(0.8,h-0.5)),mDARK,rot=(0,J(0.6),0),p=p)
        drift(f'{n}dr{s}',rnd.uniform(-L/3,L/3),s*(TH/2+0.3),rnd.uniform(0.8,1.4),0.5,rnd.uniform(0.25,0.45),p)
def shell(W,D,r,style='adobe',h=H):
    """Four walls with a doorway in the middle of each, floor, ceiling. style: adobe | timber | stone | cave."""
    wm={'adobe':mADOBE,'timber':mGREY,'stone':mSTONE2,'cave':mDIRT}[style]
    for side,(cx,cy,rz,L) in {'f':(0,D/2,0,W),'b':(0,-D/2,math.pi,W),'l':(-W/2,0,math.pi/2,D),'r':(W/2,0,-math.pi/2,D)}.items():
        g=grp('wall_'+side,(cx,cy,0),(0,0,rz),r);seg=(L-DW)/2
        for s in (-1,1):
            x=s*(DW/2+seg/2)
            if style=='cave':blob(f'{side}rock{s}',(x,0,h/2),(seg/2+0.2,0.6,h/2+0.3),mDIRT,g,seg=10,rings=6)
            else:
                B(f'{side}core{s}',(seg,TH,h),(x,0,h/2),wm,p=g)
                sg=grp(f'{side}seg{s}',(x,0,0),(0,0,0),g)
                if style=='adobe':wall_detail(f'{side}{s}',seg,sg,h)
                elif style=='timber':
                    for k in range(int(seg/0.3)):B(f'{side}bd{s}{k}',(0.26,TH+0.04,h-rnd.uniform(0,0.5) if rnd.random()<0.12 else h),(x-seg/2+0.15+k*0.3,0,h/2),rnd.choice(WOODS),p=g)
                    drift(f'{side}sd{s}',x,-(TH/2+0.3),seg*0.4,0.5,0.35,g)
                else:
                    for k in range(int(h/0.4)):B(f'{side}course{s}{k}',(seg+0.02,TH+0.04,0.05),(x,0,0.4+k*0.4),mMORT,p=g)
                    drift(f'{side}sd{s}',x,-(TH/2+0.3),seg*0.4,0.5,0.3,g)
        if style!='cave':
            B(f'{side}over',(DW,TH,h-DH),(0,0,DH+(h-DH)/2),wm,p=g)
            B(f'{side}lintel',(DW+0.5,TH+0.08,0.2),(0,0,DH+0.1),mTIM,rot=(0,J(0.03),0),p=g)
            for s in (-1,1):B(f'{side}jamb{s}',(0.16,TH+0.1,DH),(s*(DW/2+0.08),0,DH/2),mTIM2,p=g)
        else:
            B(f'{side}lintel',(DW+0.8,0.3,0.26),(0,0,DH+0.15),mTIM,p=g)
            for s in (-1,1):B(f'{side}post{s}',(0.22,0.22,DH+0.15),(s*(DW/2+0.15),0,(DH+0.15)/2),mTIM,p=g)
    for sx in (-1,1):
        for sy in (-1,1):
            if style!='cave':B(f'corner{sx}{sy}',(0.26,0.26,h),(sx*W/2,sy*D/2,h/2),mTIM,p=r)
    # floor
    if style=='stone' or style=='cave':
        B('bed',(W,D,0.1),(0,0,-0.06),mDIRT,p=r)
        if style=='stone':
            for i in range(int(W/1.1)):
                for j in range(int(D/1.1)):B(f'fs{i}_{j}',(1.0-abs(J(0.06)),1.0-abs(J(0.06)),0.07),(-W/2+0.55+i*1.1+J(0.03),-D/2+0.55+j*1.1+J(0.03),-0.02),[mSTONE,mSTONE2][(i+j)%2],rot=(J(0.01),J(0.01),J(0.03)),p=r)
    else:
        B('under',(W,D,0.1),(0,0,-0.12),mDARK,p=r)
        for i in range(int(W/0.32)):
            if rnd.random()<0.04:continue
            B(f'pl{i}',(0.3,D-0.05,0.06),(-W/2+0.16+i*0.32,0,-0.03+J(0.006)),[mGREY,mGREY2,mTIM,mGREY][rnd.randrange(4)],p=r)
    for i in range(3):blob(f'sheet{i}',(rnd.uniform(-W/3,W/3),rnd.uniform(-D/3,D/3),-0.02),(rnd.uniform(0.8,1.6),rnd.uniform(0.6,1.2),rnd.uniform(0.05,0.1)),[mSAND,mSAND2][i%2],r,seg=10,rings=4)
    for i,(sx,sy) in enumerate(((-1,-1),(1,-1),(-1,1),(1,1))):drift(f'cd{i}',sx*(W/2-0.8),sy*(D/2-0.8),rnd.uniform(0.9,1.4),rnd.uniform(0.9,1.4),rnd.uniform(0.25,0.45),r)
    # ceiling
    if style=='cave':blob('roof',(0,0,h+0.4),(W/2+0.3,D/2+0.3,1.2),mDIRT,r,seg=14,rings=7)
    else:
        B('earth',(W+0.3,D+0.3,0.3),(0,0,h+0.35),mDIRT,p=r)
        for i in range(int(W/0.3)):
            if rnd.random()<0.08:continue
            B(f'cl{i}',(0.27,D,0.05),(-W/2+0.15+i*0.3,0,h+0.17),[mGREY2,mTIM2,mGREY][i%3],p=r)
        for k in range(max(2,int(D/4))):
            y=-D/2+D*(k+0.5)/max(2,int(D/4))
            if k==1:
                for s in (-1,1):B(f'bm{k}{s}',(W/2+0.1,0.24,0.24),(s*W/4,y,h-0.14-0.2),mTIM,rot=(0,-s*0.07,0),p=r)
            else:B(f'bm{k}',(W,0.24,0.24),(0,y,h-0.12),mTIM,p=r)
    for k in range(int(W*D/30)+1):roots(f'rt{k}',rnd.uniform(-W/2+1,W/2-1),rnd.uniform(-D/2+1,D/2-1),h+0.1,r,k=rnd.randint(2,4),L=rnd.uniform(0.5,1.2))
def front(W,D,r,name,main=True,style='adobe'):
    """The street face: a false front rising above the roof line with the name painted on it (Main Street buildings),
    or a plain board over the door (buildings off Main, whose fronts face a tunnel)."""
    y=D/2+TH/2+0.02
    if main:
        B('falsefront',(W,0.12,1.7),(0,y,H+0.85),mGREY,p=r);B('ffcap',(W+0.2,0.2,0.12),(0,y,H+1.72),mTIM,p=r)
        for k in range(int(W/0.3)):B(f'ffbd{k}',(0.02,0.14,1.7),(-W/2+0.15+k*0.3,y+0.005,H+0.85),mGREY2,p=r)
        g=grp('frontsign',(0,y+0.1,H+0.8),(0,0,math.pi),r);sw=min(W-1.5,0.36*len(name)+1.0)
        B('signbd',(sw,0.06,0.7),(0,0,0),M_('signpaint',(0xb8,0xa8,0x80)),p=g)
        text('signtxt',name.upper(),(0,-0.04,0),0.34,M_('signink',(0x3a,0x22,0x16)),parent=g,rot=(math.pi/2,0,0))
        for s in (-1,1):   # windows either side of the door, boarded or broken
            wx=s*W/3.4
            B(f'win{s}',(1.4,0.06,1.2),(wx,y,1.7),mDARK,p=r);B(f'winframe{s}',(1.6,0.08,1.4),(wx,y-0.01,1.7),mTIM,p=r)
            for k in range(3 if s<0 else 2):B(f'board{s}{k}',(1.7,0.05,0.18),(wx,y+0.04,1.3+k*0.35),rnd.choice(WOODS),rot=(0,J(0.2),0),p=r)
    else:
        g=grp('doorsign',(0,y+0.05,DH+0.45),(0,0,math.pi),r);sw=min(W-1.0,0.2*len(name)+0.6)
        B('dsbd',(sw,0.05,0.4),(0,0,0),mGREY,rot=(0,J(0.08),0),p=g)
        text('dstxt',name.upper(),(0,-0.03,0),0.2,M_('signink',(0x3a,0x22,0x16)),parent=g,rot=(math.pi/2,0,0))

# ================= the buildings =================
SIZE={'L':(14,12),'M':(11,10),'S':(9,8)}
BLDGS={}
def bldg(key,name,size,style='adobe'):
    def deco(f):BLDGS[key]=(name,size,style,f);return f
    return deco
# anchors inside a W x D building (Blender coords, front = +y): quarter centres and the inside faces of the walls
def A(W,D):
    hw,hd=W/2-TH/2,D/2-TH/2;qx,qy=(hw+1.3)/2,(hd+1.3)/2
    return hw,hd,qx,qy

@bldg('saloon','Saloon','L')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    counter('bar',-qx,-hd+1.6,0,r,w=hw-1.6,h=1.1);col(k,-qx,-hd+1.6,hw-1.6,0.8)
    shelf('backbar',-qx,-hd+0.3,math.pi,r,w=hw-1.9,h=2.2,rows=4,fill=bottles);col(k,-qx,-hd+0.3,hw-1.9,0.5)
    B('mirror',(3.0,0.03,0.9),(-qx,-hd+0.06,2.55),M_('mirror',(0x5a,0x6a,0x6a),0.1,0.6),p=r);B('mcrack',(0.03,0.04,0.9),(-qx+0.5,-hd+0.08,2.55),mDARK,rot=(0,0.5,0),p=r)
    for i,(x,y) in enumerate(((qx,qy),(-qx,qy),(qx,-qy))):
        Cy(f'rt{i}',0.6,0.05,(x,y,0.76),rnd.choice(WOODS),v=12,p=r);Cy(f'rtleg{i}',0.06,0.74,(x,y,0.37),mTIM2,p=r);Cy(f'rtfoot{i}',0.3,0.05,(x,y,0.03),mTIM2,v=8,p=r);col(k,x,y,1.2,1.2)
        for j in range(3):a=j*2.1+J(0.3);chair(f'sc{i}{j}',x+math.cos(a)*0.95,y+math.sin(a)*0.95,a+math.pi/2,r,fallen=rnd.random()<0.4)
        Cy(f'glass{i}',0.04,0.1,(x+0.2,y,0.84),mGLASS,v=6,p=r);B(f'cards{i}',(0.3,0.2,0.01),(x-0.2,y+0.1,0.79),mPAPER,rot=(0,0,J(2)),p=r)
    g=grp('piano',(hw-0.45,qy,0),(0,0,math.pi/2),r);B('pbody',(1.6,0.7,1.3),(0,0,0.65),M_('piano',(0x3a,0x26,0x1c)),p=g);B('pkeys',(1.4,0.25,0.06),(0,-0.45,0.75),mBONE,p=g);col(k,hw-0.45,qy,0.8,1.6)
    for j in range(8):Cy(f'bottle{j}',0.04,0.28,(rnd.uniform(-hw+1,-1.6),rnd.uniform(-hd+2.3,-1.5),0.04),M_('bottle',(0x3a,0x5a,0x3a),0.2),v=6,rot=(math.pi/2,0,J(3)),p=r)
    for j in range(2):B(f'swing{j}',(0.6,0.05,1.0),((j*2-1)*0.45,hd-0.3,1.3),mGREY,rot=(0,0,(j*2-1)*0.9),p=r)   # batwing doors hanging open
@bldg('church','Church','L')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    for i in range(4):
        for s in (-1,1):
            y=hd-1.8-i*1.35
            if y<-hd+2.2:continue
            pew(f'pew{i}{s}',s*(qx+0.2),y,0,r,w=hw-1.9,tip=rnd.random()<0.25);col(k,s*(qx+0.2),y,hw-1.9,0.6)
    B('altarstep',(4.4,1.4,0.25),(0,-hd+0.8,0.12),mSTONE,p=r)
    g=grp('pulpit',(-2.6,-hd+1.1,0.25),(0,0.2,0),r);B('pul',(1.0,0.8,1.2),(0,0,0.6),mTIM,p=g);B('pultop',(1.1,0.9,0.06),(0,0,1.22),mTIM2,rot=(0.3,0,0),p=g);col(k,-2.6,-hd+1.1,1.0,0.8)
    g=grp('cross',(2.8,-hd+1.3,0.05),(0,0,0.3),r);B('crossv',(0.16,2.2,0.12),(0,0,0.06),mTIM,p=g);B('crossh',(1.2,0.16,0.12),(0,0.45,0.08),mTIM,p=g)
    B('crossmark',(0.16,0.02,1.9),(2.8,-hd+0.02,2.0),mSTAIN,p=r);B('crossmarkh',(1.1,0.02,0.16),(2.8,-hd+0.02,2.4),mSTAIN,p=r)
    Cy('bell',0.55,0.7,(hw-1.0,-hd+1.2,0.35),mBRASS,v=14,r2=0.3,rot=(1.4,0,0.8),p=r);col(k,hw-1.0,-hd+1.2,1.2,1.2)
    for j in range(6):B(f'hymn{j}',(0.14,0.2,0.03),(rnd.uniform(-hw+1,hw-1),rnd.uniform(1.4,hd-1),0.02),M_('hymnal',(0x3a,0x2a,0x22)),rot=(0,0,J(3)),p=r)
    for j in range(5):Cy(f'candle{j}',0.03,rnd.uniform(0.1,0.3),(-1.2+j*0.3,-hd+0.5,0.38),M_('wax',(0xd8,0xcc,0xa8)),v=6,p=r)
@bldg('hotel','Hotel','L')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    counter('desk',-qx,qy-1.0,math.pi,r,w=3.6);col(k,-qx,qy-1.0,3.6,0.8)
    g=grp('keyboard',(-qx,hd-0.05,1.8),(0,0,math.pi),r);B('kb',(1.8,0.05,0.9),(0,0,0),mTIM,p=g)
    for i in range(6):
        for j in range(2):
            if rnd.random()<0.5:B(f'fob{i}{j}',(0.05,0.02,0.12),(-0.75+i*0.3,-0.07,0.1-j*0.4),mBRASS,p=g)
    Cy('deskbell',0.07,0.06,(-qx+1.2,qy-1.0,1.12),mBRASS,v=10,r2=0.02,p=r)
    for j in range(5):B(f'st{j}',(1.4,0.35,0.22),(hw-0.8,-hd+0.6+j*0.36,0.11+j*0.22),mTIM,p=r)   # the stair to the rooms upstairs, into the dirt
    for j in range(5,8):B(f'stb{j}',(1.4,0.35,0.22),(hw-0.8+J(0.2),-hd+0.6+j*0.36,0.11+j*0.22-0.1*(j-4)),mGREY2,rot=(J(0.3),J(0.3),J(0.3)),p=r)
    blob('stairdirt',(hw-0.8,-hd+3.2,1.7),(0.9,1.2,1.3),mDIRT,r,seg=8,rings=5);col(k,hw-0.8,-hd+1.8,1.5,3.2)
    g=grp('sofa',(-qx,-qy,0),(0,0,0.3),r)
    for nm,sz,lc in (('seat',(2.0,0.8,0.45),(0,0,0.25)),('back',(2.0,0.2,0.6),(0,-0.35,0.7))):B('sofa'+nm,sz,lc,M_('velvet2',(0x5a,0x2a,0x2a)),p=g)
    B('stuffing',(0.4,0.3,0.1),(0.4,0.1,0.5),M_('stuffing',(0xb8,0xa8,0x88)),p=g);col(k,-qx,-qy,2.2,1.0)
    B('rug',(2.8,1.8,0.01),(-qx,-qy+0.4,0.005),M_('rug',(0x7a,0x3a,0x2a)),p=r)
    table('lobby',qx,qy,0.2,r,w=1.2,d=0.8,h=0.5);chair('lc1',qx-1,qy,1.2,r);chair('lc2',qx+0.9,qy-0.6,-0.8,r,fallen=True);col(k,qx,qy,1.2,0.8)
    Cy('spittoon',0.15,0.2,(qx+1.5,qy+1.2,0.1),mBRASS,v=10,r2=0.1,p=r)
@bldg('store','General store','L')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    counter('counter',-qx,-qy+0.9,0,r,w=hw-1.8);col(k,-qx,-qy+0.9,hw-1.8,0.8)
    shelf('shelf1',-qx,-hd+0.3,math.pi,r,w=hw-1.8,h=2.4,rows=5,fill=jars);col(k,-qx,-hd+0.3,hw-1.8,0.5)
    shelf('shelf2',qx,-hd+0.3,math.pi,r,w=hw-1.8,h=2.4,rows=5,fill=bottles,lean=-0.08);col(k,qx,-hd+0.3,hw-1.8,0.5)
    Cy('scale',0.2,0.04,(-qx-1,-qy+0.9,1.1),mBRASS,v=10,p=r);B('till',(0.45,0.35,0.3),(-qx+1,-qy+0.9,1.23),mBRASS,p=r)
    for i,(x,y) in enumerate([(qx-0.8,qy-0.6),(qx,qy+0.4),(qx+0.9,qy-0.4),(qx+0.3,qy-1.5)]):barrel(f'bar{i}',x,y,r,fallen=(i==2),rz=J(3));col(k,x,y,0.65,0.65)
    for i in range(5):sack(f'flour{i}',-hw+0.6+i*0.55,qy+J(0.3),r,m=M_('flour',(0xb8,0xa8,0x8a)))
    col(k,-hw+1.7,qy,2.8,0.8);crate('crateA',qx,-qy+1.2,0.2,r,broken=True)
    for j in range(8):Cy(f'can{j}',0.05,0.1,(rnd.uniform(1.6,hw-0.5),rnd.uniform(-1.3,-0.6),0.05),mRUST,v=8,rot=(math.pi/2,0,J(3)),p=r)
@bldg('bank','Bank','L','stone')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    counter('teller',-qx,-0.1-1.6,0,r,w=hw-1.7,h=1.1);col(k,-qx,-1.7,hw-1.7,0.8)
    bars('cage',-qx,-1.7,0,r,w=hw-1.7,h=1.1,door=False).location.z=1.15
    g=grp('safe',(qx+0.6,-hd+0.7,0),(0,0,math.pi),r)
    B('safebody',(1.4,1.0,1.6),(0,0,0.8),M_('safegreen',(0x2f,0x46,0x3a),0.55,0.3),p=g);B('safein',(1.1,0.1,1.3),(0,-0.46,0.8),mDARK,p=g)
    d=grp('safedoor',(-0.7,-0.5,0),(0,0,-1.9),g);B('sdoor',(1.3,0.18,1.5),(0.65,-0.09,0.8),M_('safegreen',(0x2f,0x46,0x3a),0.55,0.3),p=d);Cy('sdial',0.1,0.05,(0.65,-0.2,1.0),mBRASS,v=12,rot=(math.pi/2,0,0),p=d)
    col(k,qx+0.6,-hd+0.7,1.4,1.0)
    table('manager',qx,qy,0.2,r,w=1.8,d=0.9);chair('mchair',qx,qy-0.9,0.1,r);col(k,qx,qy,1.8,0.9)
    for j in range(20):B(f'note{j}',(0.15,0.07,0.004),(rnd.uniform(1.5,hw-0.5),rnd.uniform(-hd+1.5,-1.4),0.01),M_('banknote',(0x7a,0x8a,0x6a)),rot=(0,0,J(3)),p=r)
    for j in range(4):B(f'lockbox{j}',(0.4,0.25,0.18),(rnd.uniform(-hw+0.8,-1.8),rnd.uniform(1.6,hd-0.8),0.09),mRUST,rot=(0,0,J(3)),p=r)
@bldg('stable','Stable','L','timber')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    for i,x in enumerate((-hw+2.2,-hw+4.4)):B(f'stall{i}',(0.12,hd-1.5,1.4),(x,-hd/2-0.6,0.7),mGREY,rot=(0,0,J(0.03)),p=r);col(k,x,-hd/2-0.6,0.2,hd-1.5)
    for i,x in enumerate((hw-2.2,)):B(f'stallE{i}',(0.12,hd-1.5,1.4),(x,-hd/2-0.6,0.7),mGREY2,p=r);col(k,x,-hd/2-0.6,0.2,hd-1.5)
    for j in range(8):blob(f'hay{j}',(rnd.choice((-1,1))*rnd.uniform(2,hw-0.6),rnd.uniform(-hd+0.6,-1.8),0.1),(rnd.uniform(0.5,0.9),rnd.uniform(0.4,0.7),0.25),M_('hay',(0xb0,0x98,0x5a)),r,seg=8,rings=4)
    B('trough',(2.4,0.6,0.5),(qx,qy+0.6,0.25),mTIM,p=r);B('troughin',(2.2,0.45,0.1),(qx,qy+0.6,0.45),mDARK,p=r);col(k,qx,qy+0.6,2.4,0.6)
    g=grp('wheel',(-hw+0.25,qy,0.9),(math.radians(80),0,math.pi/2),r)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.8,minor_radius=0.05,major_segments=18,minor_segments=4,location=(0,0,0));o=bpy.context.active_object;o.name='rim';_finish(o,mTIM,0,g)
    for j in range(8):a=j*0.785;tube(f'spoke{j}',(0,0,0),(math.cos(a)*0.78,math.sin(a)*0.78,0),0.025,mTIM2,g,v=4)
    g=grp('saddle',(-qx,qy,0),(0,0,0.5),r);B('sadstand',(0.2,0.8,0.9),(0,0,0.45),mTIM,p=g);blob('saddleb',(0,0,0.95),(0.3,0.45,0.18),M_('leather',(0x5a,0x2a,0x1c)),g,seg=8,rings=5);col(k,-qx,qy,0.6,0.9)
    for j in range(3):tube(f'harness{j}',(hw-0.1,-hd+1+j*0.7,2.4),(hw-0.1,-hd+0.8+j*0.7,1.2),0.02,M_('leather',(0x5a,0x2a,0x1c)),r,v=4)
    skeleton('horse',-hw+1.1,-hd+1.5,0.4,r)
@bldg('school','Schoolhouse','L')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    for i,(x,y) in enumerate([(sx*a,-b) for sx in (-1,1) for a in (qx-1,qx+1) for b in (qy-0.9,qy+0.9)]):
        g=grp(f'desk{i}',(x,y,0),(0,0,0),r);tip=rnd.random()<0.3;t=grp(f'dt{i}',(0,0,0.3 if tip else 0),(math.radians(85) if tip else 0,0,0),g)
        B(f'dtop{i}',(1.0,0.55,0.04),(0,0,0.68),rnd.choice(WOODS),rot=(-0.12,0,0),p=t)
        for s in (-1,1):B(f'dleg{i}{s}',(0.05,0.5,0.66),(s*0.42,0,0.33),mIRON,p=t)
        col(k,x,y,1.0,0.6)
    B('board',(4.0,0.06,1.3),(-qx+0.3,-hd+0.05,1.8),M_('chalkboard',(0x2a,0x34,0x2e),0.95),p=r);B('boardframe',(4.2,0.08,1.5),(-qx+0.3,-hd+0.02,1.8),mTIM,p=r)
    text('chalk','A B C  1882',(-qx+0.3,-hd+0.1,2.1),0.26,M_('chalk',(0xb8,0xb4,0xa8)),parent=r,rot=(math.pi/2,0,math.pi))
    text('chalk2','K. BARLOW',(-qx+0.3,-hd+0.1,1.65),0.2,M_('chalk',(0xb8,0xb4,0xa8)),parent=r,rot=(math.pi/2,0,math.pi))
    table('teacher',qx,qy,0,r,w=1.8,d=0.9);col(k,qx,qy,1.8,0.9);chair('tchair',qx,qy-0.8,0,r)
    Cy('apple',0.05,0.08,(qx-0.4,qy,0.83),M_('apple_old',(0x6a,0x2a,0x1c)),p=r)
    shelf('bookshelf',-hw+0.3,qy,math.pi/2,r,w=1.6,rows=4,fill=books,lean=0.05);col(k,-hw+0.3,qy,0.5,1.6)
    Cy('globestand',0.03,0.8,(-qx,qy+0.5,0.4),mBRASS,p=r);blob('globeball',(-qx,qy+0.5,0.95),(0.2,0.2,0.2),M_('globe',(0x5a,0x6a,0x5a)),r)
    for j in range(6):B(f'paper{j}',(0.21,0.28,0.004),(rnd.uniform(-hw+1,-1.6),rnd.uniform(-hd+1,-1.6),0.01),mPAPER,rot=(0,0,J(3)),p=r)
@bldg('sheriff',"Sheriff's office",'M')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    table('desk',qx,qy-0.3,0.1,r,w=2.0,d=1.0);col(k,qx,qy-0.3,2.0,1.0);chair('dchair',qx,qy-1.2,0,r,fallen=True)
    B('ledger',(0.4,0.3,0.05),(qx-0.2,qy-0.3,0.83),M_('ledger',(0x4a,0x2a,0x1c)),rot=(0,0,0.3),p=r);B('star',(0.1,0.02,0.1),(qx+0.5,qy-0.2,0.83),mBRASS,rot=(0,0,0.785),p=r)
    g=grp('gunrack',(-hw+0.1,-qy,1.8),(0,0,math.pi/2),r);B('rackback',(1.6,0.05,1.0),(0,0,0),mTIM,p=g)
    for j in range(3):tube(f'rifle{j}',(-0.5+j*0.5,-0.08,-0.6),(-0.45+j*0.5,-0.08,0.6),0.025,mIRON,g,v=5)
    for j in range(4):poster(f'wanted{j}',(-qx-0.6+j*0.8) if j<2 else (qx-0.8+(j-2)*0.8),-hd+0.02,1.7,math.pi,r)
    B('cabinet',(0.8,0.6,1.3),(-qx,qy+0.2,0.65),mIRON,p=r);col(k,-qx,qy+0.2,0.8,0.6);B('drawerout',(0.7,0.55,0.3),(-qx,qy-0.4,0.8),mRUST,p=r)
    for j in range(10):B(f'file{j}',(0.22,0.3,0.004),(rnd.uniform(-hw+0.6,-1.5),rnd.uniform(1.5,hd-0.5),0.01),mPAPER,rot=(0,0,J(3)),p=r)
    Cy('spittoon',0.15,0.2,(qx+1,-qy,0.1),mBRASS,v=10,r2=0.1,p=r);skeleton('skel',qx,-qy,0.6,r)
@bldg('jail','Jail','M','stone')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    for s in (-1,1):
        bars(f'cell{s}',s*qx,-1.6,0,r,w=hw-1.5,h=3.0,door=(s<0));col(k,s*qx,-1.6,hw-1.5,0.2)
        B(f'cot{s}',(0.8,1.8,0.08),(s*(hw-0.6),-hd+1.1,0.45),mCLOTH,p=r)
        Cy(f'bucket{s}',0.16,0.3,(s*1.9,-hd+0.4,0.15),mRUST,v=10,r2=0.19,p=r)
    skeleton('prisoner',qx,-hd+1.3,2.6,r)
    for j in range(4):B(f'tally{j}',(0.3,0.01,0.25),(-qx-0.6+j*0.4,-hd+0.02,1.4),mDARK,p=r)
    table('jailerdesk',-qx,qy,0,r,w=1.4,d=0.8);col(k,-qx,qy,1.4,0.8);chair('jchair',-qx,qy+0.8,math.pi,r)
    Cy('keyring',0.08,0.015,(-qx+0.2,qy,0.8),mRUST,v=10,p=r);barrel('water',qx,qy,r);col(k,qx,qy,0.7,0.7)
@bldg('post','Post office','M')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    counter('pcounter',-qx,-qy+1.0,0,r,w=hw-1.6);col(k,-qx,-qy+1.0,hw-1.6,0.8)
    g=grp('cubbies',(-qx,-hd+0.2,0),(0,0,math.pi),r);w=hw-1.7
    B('cubback',(w,0.05,2.0),(0,0.18,1.6),mTIM2,p=g)
    for i in range(int(w/0.5)+1):B(f'cv{i}',(0.03,0.35,2.0),(-w/2+i*0.5,0,1.6),mTIM,p=g)
    for j in range(6):B(f'ch{j}',(w,0.35,0.03),(0,0,0.6+j*0.4),mTIM,p=g)
    for i in range(int(w/0.5)):
        for j in range(5):
            if rnd.random()<0.4:B(f'letter{i}{j}',(0.28,0.25,0.06),(-w/2+0.25+i*0.5,0,0.72+j*0.4),mPAPER,rot=(0,0,J(0.2)),p=g)
    col(k,-qx,-hd+0.2,w,0.4)
    for i,(x,y) in enumerate([(qx,qy),(qx+0.8,qy-0.6),(qx-0.6,qy+0.6)]):sack(f'mail{i}',x,y,r,s=0.42,m=M_('mailsack',(0x7a,0x6a,0x4a)))
    col(k,qx,qy,2.0,1.8)
    for j in range(20):B(f'lt{j}',(0.2,0.12,0.004),(rnd.uniform(1.5,hw-0.3),rnd.uniform(-hd+0.3,hd-0.3),0.01),mPAPER,rot=(0,0,J(3)),p=r)
    B('stove',(0.7,0.7,0.9),(qx,-qy,0.45),mIRON,p=r);tube('stovepipe',(qx,-qy,0.9),(qx,-qy,H),0.08,mIRON,r,v=8);col(k,qx,-qy,0.8,0.8)
@bldg('boatshed',"Sam's boat shed",'M','timber')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    g=grp('boat',(-qx,-qy+0.3,0.55),(0,math.pi,0.2),r)   # the Mary Lou, upside down on sawhorses
    blob('hull',(0,0,0),(0.85,2.2,0.5),M_('hull',(0x6a,0x7a,0x7a),0.9),g,seg=12,rings=6);B('keel',(0.08,4.2,0.1),(0,0,0.5),mTIM,p=g)
    col(k,-qx,-qy+0.3,2.0,4.2)
    text('maryloutxt','MARY LOU',(-qx+0.9,-qy+0.3,0.35),0.18,M_('paintred',(0x8a,0x2a,0x1c)),rot=(math.pi/2,0,math.pi/2+0.2),parent=r)
    for j in range(2):tube(f'oar{j}',(hw-0.3,-qy+j*0.4,0.1),(hw-0.4,-qy+j*0.5,2.6),0.03,mGREY,r,v=5)
    for j in range(4):
        x,y=qx+(j%2)*0.75-0.4,qy+(j//2)*0.75-0.4;crate(f'onc{j}',x,y,J(0.2),r,s=0.65)
        for i in range(4):blob(f'onion{j}{i}',(x+J(0.2),y+J(0.2),0.7),(0.07,0.07,0.06),M_('onion',(0xb8,0x8a,0x4a)),r,seg=6,rings=4)
    col(k,qx,qy,1.5,1.5)
    B('workbench',(2.2,0.7,0.85),(-qx,hd-0.5,0.42),mTIM,p=r);col(k,-qx,hd-0.5,2.2,0.7)
    for j in range(6):Cy(f'peach{j}',0.05,0.14,(qx+J(0.4),-qy+j*0.18-0.4,0.07),M_('peachjar',(0xc8,0x8a,0x3a),0.3),v=8,p=r)
@bldg('doctor',"Doctor's office",'M')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    g=grp('extable',(-qx,-qy,0),(0,0,0.1),r);B('ext',(0.8,2.0,0.08),(0,0,0.85),mTIM,p=g);B('expad',(0.75,1.9,0.08),(0,0,0.93),M_('leather',(0x4a,0x3a,0x2a)),p=g)
    for sx in (-1,1):
        for sy in (-1,1):B(f'exl{sx}{sy}',(0.06,0.06,0.85),(sx*0.34,sy*0.9,0.42),mTIM2,p=g)
    col(k,-qx,-qy,0.9,2.1)
    shelf('medicine',qx,-hd+0.25,math.pi,r,w=hw-1.8,h=2.2,rows=5,fill=bottles);col(k,qx,-hd+0.25,hw-1.8,0.5)
    table('ddesk',qx,qy,-0.2,r,w=1.6,d=0.8);chair('dchair',qx,qy+0.8,math.pi,r,fallen=True);col(k,qx,qy,1.6,0.8)
    B('bag',(0.45,0.25,0.3),(qx-0.2,qy,0.93),M_('doctorbag',(0x2a,0x1a,0x14)),p=r)
    g=grp('screen',(-qx,qy,0),(0,0,0.6),r)
    for j in range(3):B(f'scr{j}',(0.7,0.04,1.7),(j*0.7-0.7,J(0.1),0.85),M_('screencloth',(0xa8,0x9a,0x80)),rot=(0,0,(j-1)*0.4),p=g)
    col(k,-qx,qy,2.0,0.6)
    for j in range(5):Cy(f'vial{j}',0.03,0.1,(rnd.uniform(1.6,hw-0.5),rnd.uniform(-1.3,-0.6),0.03),mGLASS,v=6,rot=(math.pi/2,0,J(3)),p=r)
@bldg('barber','Barbershop','S','timber')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    for i,x in enumerate((-qx,qx)):
        g=grp(f'bchair{i}',(x,-qy+0.4,0),(0,0,J(0.4)),r)
        Cy(f'bbase{i}',0.3,0.3,(0,0,0.15),mIRON,v=10,p=g);B(f'bseat{i}',(0.6,0.6,0.15),(0,0,0.55),M_('leather',(0x5a,0x2a,0x1c)),p=g)
        B(f'bback{i}',(0.6,0.12,0.8),(0,-0.3,1.0),M_('leather',(0x5a,0x2a,0x1c)),rot=(-0.2,0,0),p=g);col(k,x,-qy+0.4,0.8,0.8)
    for s in (-1,1):
        B(f'counter{s}',(hw-1.6,0.5,0.9),(s*qx,-hd+0.3,0.45),mTIM,p=r);col(k,s*qx,-hd+0.3,hw-1.6,0.5)
        B(f'bmirror{s}',(hw-1.7,0.03,1.1),(s*qx,-hd+0.03,1.8),M_('mirror',(0x5a,0x6a,0x6a),0.1,0.6),p=r)
        B(f'bmcrack{s}',(0.03,0.04,0.9),(s*qx+J(0.5),-hd+0.05,1.8),mDARK,rot=(0,J(0.7),0),p=r)
        for j in range(3):Cy(f'tonic{s}{j}',0.04,0.16,(s*qx-0.5+j*0.4,-hd+0.35,0.98),mGLASS,v=6,p=r)
    g=grp('pole',(hw-0.4,hd-0.4,0),(0.3,0,0.8),r);Cy('polebody',0.1,1.4,(0,0,0.9),M_('polewhite',(0xd8,0xd0,0xc0)),v=10,p=g)
    for j in range(4):Cy(f'stripe{j}',0.102,0.1,(0,0,0.35+j*0.35),M_('polered',(0x8a,0x2a,0x1c)),v=10,rot=(0.3,0,0),p=g)
    chair('wchair1',-qx,qy,math.pi,r);chair('wchair2',-qx+0.8,qy,math.pi,r,fallen=True)
    for j in range(8):blob(f'hair{j}',(rnd.uniform(-hw+0.5,hw-0.5),rnd.uniform(-hd+0.8,-1.4),0.02),(0.12,0.08,0.02),M_('hair',(0x3a,0x2a,0x1e)),r,seg=6,rings=3)
@bldg('kate',"Kate's house",'S')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    bed('bed',-qx,-qy+0.2,0,r);col(k,-qx,-qy+0.2,1.2,2.2)
    g=grp('dresser',(qx,-hd+0.35,0),(0,0,math.pi),r);B('dres',(1.6,0.5,1.0),(0,0,0.5),mTIM,p=g)
    for j in range(3):B(f'dd{j}',(1.5,0.04,0.26),(0,-0.26,0.2+j*0.3),mTIM2,p=g)
    B('dmirror',(0.9,0.04,1.1),(0,0.1,1.6),M_('mirror',(0x5a,0x6a,0x6a),0.1,0.6),rot=(0.08,0,0),p=g);col(k,qx,-hd+0.35,1.6,0.5)
    B('lipstickbox',(0.2,0.14,0.08),(qx+0.3,-hd+0.4,1.04),M_('velvet',(0x6a,0x1a,0x2a)),p=r)
    g=grp('rocker',(qx,qy,0),(0,0,2.4),r)
    for s in (-1,1):tube(f'rock{s}',(s*0.22,-0.45,0.08),(s*0.22,0.45,0.02),0.03,mTIM,g,v=5)
    chair('rockchair',0,0,0,g);col(k,qx,qy,0.8,0.9)
    shelf('peaches',-hw+0.3,qy,math.pi/2,r,w=1.6,h=1.8,rows=4,fill=lambda n_,g_,w_,z_,d_:jars(n_,g_,w_,z_,d_,m=M_('peachjar',(0xc8,0x8a,0x3a),0.3)));col(k,-hw+0.3,qy,0.5,1.6)
    B('rug',(2.0,1.4,0.01),(qx,qy,0.005),M_('rug',(0x7a,0x3a,0x2a)),rot=(0,0,0.2),p=r)
    for j in range(5):Cy(f'fjar{j}',0.05,0.14,(rnd.uniform(-hw+0.8,-1.5),rnd.uniform(1.5,hd-0.6),0.05),M_('peachjar',(0xc8,0x8a,0x3a),0.3),v=8,rot=(math.pi/2,0,J(3)),p=r)
    text('heart','K + S',(-qx,-hd+0.04,2.3),0.2,M_('carved',(0x3a,0x2a,0x1e)),parent=r,rot=(math.pi/2,0,math.pi))
@bldg('cellar','Onion cellar','S','stone')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    for i,(x,y) in enumerate(((-qx,-qy),(qx,-qy),(-qx,qy),(qx,qy))):
        g=grp(f'bin{i}',(x,y,0),(0,0,0),r);bw,bd=hw-1.6,hd-1.6
        for s in (-1,1):B(f'bw{i}{s}',(bw,0.06,0.8),(0,s*bd/2,0.4),rnd.choice(WOODS),p=g);B(f'bs{i}{s}',(0.06,bd,0.8),(s*bw/2,0,0.4),rnd.choice(WOODS),p=g)
        blob(f'pile{i}',(0,0,0.35),(bw/2-0.1,bd/2-0.1,0.5),M_('husk',(0x9a,0x7a,0x4a)),g,seg=10,rings=5)
        for j in range(8):blob(f'on{i}{j}',(J(bw/2-0.2),J(bd/2-0.2),0.72+J(0.08)),(0.08,0.08,0.07),M_('onion',(0xb8,0x8a,0x4a)),g,seg=6,rings=4)
        col(k,x,y,bw+0.1,bd+0.1)
    for j in range(4):tube(f'hang{j}',(J(hw-1),J(hd-1),H),(J(hw-1),J(hd-1),H-0.6),0.01,mROOT,r,v=4)
@bldg('vault',"Kate's vault",'S','stone')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    g=grp('vaultdoor',(-hw+0.3,-1.0,0),(0,0,1.9),r)   # the round vault door, swung open against the wall
    Cy('vdoor',1.1,0.3,(0,0,1.25),M_('vaultsteel',(0x4a,0x4e,0x52),0.45,0.7),v=20,rot=(math.pi/2,0,0),p=g);Cy('vwheel',0.3,0.08,(0,-0.2,1.25),mBRASS,v=12,rot=(math.pi/2,0,0),p=g)
    for j in range(4):B(f'vspoke{j}',(0.6,0.04,0.04),(0,-0.23,1.25),mBRASS,rot=(0,j*0.785,0),p=g)
    col(k,-hw+0.5,-1.0,0.6,2.2)
    for i in range(3):
        for j in range(3-i):
            for m in range(2):B(f'gb{i}{j}{m}',(0.3,0.14,0.09),(qx-0.4+j*0.33+i*0.16,-qy+m*0.18,0.1+i*0.09),mGOLD,p=r)
    col(k,qx,-qy,1.4,0.6)
    for j in range(3):B(f'strongbox{j}',(0.5,0.35,0.3),(qx,qy-0.4+j*0.5,0.15),mRUST,rot=(0,0,J(0.3)),p=r)
    col(k,qx,qy,0.7,1.6)
    Cy('lamp',0.12,0.35,(-qx,qy,0.18),mGLASS,v=8,p=r);text('kb','KB',(0,-hd+0.04,2.3),0.5,mGOLD,parent=r,rot=(math.pi/2,0,math.pi))
    skeleton('digger',-qx,-qy,J(3),r)
    for j in range(4):B(f'pick{j}',(0.9,0.05,0.05),(rnd.uniform(-hw+0.6,hw-0.6),rnd.uniform(1.4,hd-0.4),0.03),mTIM,rot=(0,0,J(3)),p=r)
@bldg('well','Old well','S','cave')
def _(r,k,W,D):
    hw,hd,qx,qy=A(W,D)
    for i in range(16):a=i*2*math.pi/16;B(f'wstone{i}',(0.4,0.28,0.85),(math.cos(a)*0.95,math.sin(a)*0.95,0.42),mSTONE if i%2 else mSTONE2,rot=(0,0,a+math.pi/2),p=r)
    Cy('wdark',0.8,0.05,(0,0,0.5),mDARK,v=16,p=r)
    for s in (-1,1):B(f'wpost{s}',(0.15,0.15,2.0),(s*1.15,0,1.0),mTIM,p=r)
    Cy('windlass',0.1,2.5,(0,0,1.9),mTIM2,v=8,rot=(0,math.pi/2,0),p=r);tube('wrope',(0.2,0,1.9),(0.2,0,0.4),0.02,M_('rope',(0xa8,0x8a,0x5a)),r,v=4)
    Cy('wbucket',0.16,0.25,(-qx,qy,0.13),mTIM,v=10,r2=0.19,rot=(1.4,0,0.5),p=r)
    col(k,0,0,2.5,2.5)
    for i,(x,y) in enumerate(((-qx,-qy),(qx,-qy),(qx,qy))):
        if i%2==0:barrel(f'wbarrel{i}',x,y,r);col(k,x,y,0.65,0.65)
        else:crate(f'wcrate{i}',x,y,J(0.5),r,s=0.7,broken=True)
    B('shaftrim',(2.4,2.4,0.3),(0,0,H+1.3),mDARK,p=r)   # the well shaft goes up through the roof of the cave

for key,(name,size,style,f) in BLDGS.items():
    n='TownBldg_'+key;W,D=SIZE[size];scene(n);r=root(n)
    shell(W,D,r,style=style);front(W,D,r,name,main=(size=='L'),style=style);f(r,key,W,D)
    export(n,rend=True)

# ================= door plugs, tunnel timber and debris =================
scene('TownDoorPlug');r=root('TownDoorPlug')   # centred on the doorway in the wall plane; tunnel side is Blender +y
for k in range(6):B(f'plank{k}',(DW+0.5,0.05,0.2),(J(0.05),0.22+J(0.02),0.3+k*0.4),rnd.choice(WOODS),rot=(0,J(0.12),0),p=r)
B('fill',(DW,0.1,DH),(0,0.05,DH/2),mDIRT,p=r)
blob('push',(0.2,0.5,0.4),(0.8,0.6,0.7),mDIRT,r,seg=8,rings=5);rubble('prub',0,-0.5,0.5,6,r,big=0.25)
export('TownDoorPlug')
scene('TownMouthPlug');r=root('TownMouthPlug')   # a caved-in tunnel mouth, 3.4 m wide, facing Blender -y
blob('heap',(0,0,1.2),(1.9,1.4,1.6),mDIRT,r,seg=12,rings=6);blob('heap2',(0.3,-0.6,0.3),(1.6,1.0,0.6),mSAND2,r,seg=10,rings=5)
for k in range(4):B(f'beam{k}',(2.6,0.24,0.24),(J(0.6),J(0.4),rnd.uniform(0.4,2.4)),mTIM,rot=(J(0.8),J(0.8),J(0.6)),p=r)
rubble('mrub',0,-1.2,1.0,10,r,big=0.35);export('TownMouthPlug')
scene('TownShoring');r=root('TownShoring')   # one timber set across a tunnel running along Blender Y
for s in (-1,1):B(f'post{s}',(0.2,0.2,2.25),(s*1.1,0,1.12),rnd.choice(WOODS),rot=(0,s*0.06,0),p=r)
B('cap',(2.6,0.24,0.24),(0,0,2.3),mTIM,rot=(0,J(0.04),0),p=r)
for s in (-1,1):B(f'knee{s}',(0.1,0.1,0.6),(s*0.85,0,2.05),mTIM2,rot=(0,s*0.8,0),p=r)
for k in range(5):B(f'lag{k}',(0.12,1.2,0.05),(-1.0+k*0.5,0,2.45),mGREY2,p=r)
export('TownShoring')
for key in 'ABC':
    scene('TownJunk'+key);r=root('TownJunk'+key)
    if key=='A':rubble('ja',0,0,0.6,10,r,big=0.3);B('pickhandle',(0.9,0.05,0.05),(0.2,0.3,0.03),mTIM,rot=(0,0,0.6),p=r);B('pickhead',(0.08,0.4,0.05),(0.6,0.55,0.03),mRUST,rot=(0,0,0.6),p=r)
    if key=='B':
        Cy('lantern',0.1,0.28,(0.1,0,0.14),mGLASS,v=8,rot=(1.4,0,0.3),p=r);Cy('lanterntop',0.08,0.08,(0.3,0.05,0.12),mRUST,v=8,rot=(1.4,0,0.3),p=r)
        for k in range(3):B(f'jb{k}',(rnd.uniform(0.8,1.4),0.14,0.04),(J(0.4),J(0.4),0.03+k*0.04),rnd.choice(WOODS),rot=(0,0,J(3)),p=r)
    if key=='C':skeleton('jc',0,0,J(3),r);drift('jcd',0.3,0.2,0.8,0.6,0.25,r)
    export('TownJunk'+key)

# ================= Main Street =================
# game (x, z) -> Blender (x, -z); the street runs x -34..34, z -7.5..7.5; building fronts stand on z = +-7.5
scene('TownStreet');r=root('TownStreet');SX,SZ,SH=34,7.5,5.5;k='street'
B('ground',(2*SX,2*SZ,0.1),(0,0,-0.05),mDIRT,p=r)
for s in (-1,1):B(f'rut{s}',(2*SX-2,0.45,0.01),(0,s*1.3,0.005),mSTAIN,p=r)
for i in range(10):blob(f'sheet{i}',(rnd.uniform(-30,30),rnd.uniform(-4.5,4.5),-0.02),(rnd.uniform(1.5,3.5),rnd.uniform(1.0,2.2),rnd.uniform(0.06,0.12)),[mSAND,mSAND2][i%2],r,seg=10,rings=4)
for i in range(18):B(f'stone{i}',(rnd.uniform(0.15,0.35),rnd.uniform(0.12,0.3),0.1),(rnd.uniform(-32,32),rnd.uniform(-5,5),0.04),[mSTONE,mSTONE2][i%2],rot=(J(0.3),J(0.3),J(3)),p=r)
for x in (-22,0,22):
    for s in (-1,1):   # boardwalk and porch in front of each building
        y=s*(SZ-0.75)
        for j in range(int(14/0.3)):
            if rnd.random()<0.06:continue
            B(f'bw{x}{s}{j}',(0.28,1.5,0.06),(x-7+0.15+j*0.3,y,0.1+J(0.01)),rnd.choice(WOODS),rot=(J(0.02),0,0),p=r)
        B(f'bwedge{x}{s}',(14,0.12,0.14),(x,s*(SZ-1.5),0.07),mTIM2,p=r)
        for px in (-6.6,-2.3,2.3,6.6):
            B(f'post{x}{s}{px}',(0.16,0.16,3.0),(x+px,s*(SZ-1.4),1.5),mTIM,rot=(J(0.04),J(0.04),0),p=r);col(k,x+px,s*(SZ-1.4),0.3,0.3)
        sag=rnd.random()<0.4   # a porch roof, one end come down on some
        B(f'awning{x}{s}',(14.2,1.9,0.08),(x,s*(SZ-0.7),3.05 if not sag else 2.6),rnd.choice([mGREY,mGREY2]),rot=(s*0.12,0.1 if sag else 0,0),p=r)
        if rnd.random()<0.6:
            for px in (-4.5,4.5):B(f'hitch{x}{s}{px}',(2.2,0.1,0.1),(x+px,s*(SZ-2.2),0.9),mTIM2,p=r);[B(f'hp{x}{s}{px}{q}',(0.1,0.1,0.9),(x+px+q,s*(SZ-2.2),0.45),mTIM2,p=r) for q in (-1,1)]
            col(k,x-4.5,s*(SZ-2.2),2.2,0.25);col(k,x+4.5,s*(SZ-2.2),2.2,0.25)
# earth between the buildings and at the ends, up to the ceiling; the east end has a tunnel mouth, the west end the stairwell
for (xa,xb) in ((-34,-29),(-15,-7),(7,15),(29,34)):
    for s in (-1,1):
        blob(f'earth{xa}{s}',((xa+xb)/2,s*(SZ+0.6),2.7),((xb-xa)/2+0.5,1.4,3.2),mDIRT,r,seg=12,rings=7)
        for j in range(2):B(f'crib{xa}{s}{j}',(xb-xa,0.2,0.22),((xa+xb)/2,s*(SZ-0.1),0.6+j*1.6),mTIM,rot=(0,J(0.05),0),p=r)
        drift(f'ed{xa}{s}',(xa+xb)/2,s*(SZ-0.8),(xb-xa)/2,0.8,0.5,r)
for s in (-1,1):
    blob(f'eastwall{s}',(SX+0.8,s*4.8,2.7),(1.4,3.4,3.2),mDIRT,r,seg=12,rings=7);blob(f'westwall{s}',(-SX-0.8,s*4.8,2.7),(1.4,3.4,3.2),mDIRT,r,seg=12,rings=7)
    B(f'mouthpost{s}',(0.24,0.24,2.7),(SX-0.1,s*1.55,1.35),mTIM,p=r)
B('mouthcap',(0.3,3.6,0.28),(SX-0.1,0,2.75),mTIM,p=r);blob('mouthtop',(SX+0.6,0,4.3),(1.2,2.2,1.6),mDIRT,r,seg=10,rings=6)
for j in range(9):B(f'step{j}',(0.45,3.0,0.26*(j+1)),(-SX+2.8-j*0.45,0,0.13*(j+1)),mSTONE if j%2 else mSTONE2,p=r)   # the stairwell up and out
for s in (-1,1):B(f'stairwall{s}',(4.4,0.3,3.2),(-SX+0.8,s*1.65,1.6),mADOBE2,p=r);col(k,-SX+0.8,s*1.65,4.4,0.3)
blob('stairfall',(-SX-0.2,0,3.4),(1.6,1.6,1.4),mSAND2,r,seg=10,rings=6)
for j in range(4):B(f'stairbeam{j}',(2.4,0.24,0.24),(-SX+0.4+J(0.5),J(0.8),3.0+j*0.3),mTIM,rot=(J(0.5),J(0.6),J(0.6)),p=r)
# ceiling: the lake bed sagging over the street, old timbers across, roots
B('ceiling',(2*SX+3,2*SZ+3,0.4),(0,0,SH+0.2),mDIRT,p=r)
for i in range(9):blob(f'sagc{i}',(-30+i*7.5+J(2),J(3),SH),(rnd.uniform(1.5,3),rnd.uniform(1.2,2.4),rnd.uniform(0.5,1.0)),mDIRT,r,seg=10,rings=5)
for i in range(7):B(f'xbeam{i}',(0.26,2*SZ+1,0.26),(-30+i*10+J(2),0,SH-0.25),mTIM,rot=(J(0.05),0,J(0.1)),p=r)
for i in range(14):roots(f'sroot{i}',rnd.uniform(-32,32),rnd.uniform(-5,5),SH,r,k=rnd.randint(2,5),L=rnd.uniform(0.8,2.0))
# what was left in the street: a wagon on its side, a trough, a leaning lamp post, barrels, crates
g=grp('wagon',(-10,2.4,0),(0,0,0.25),r);B('wbed',(3.2,0.12,1.2),(0,0,0.65),mGREY,rot=(math.radians(80),0,0),p=g);B('wside',(3.2,0.8,0.08),(0,0.4,1.25),mGREY2,p=g)
for sx in (-1,1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.55,minor_radius=0.05,major_segments=16,minor_segments=4,location=(sx*1.2,-0.1,0.55),rotation=(math.pi/2,0,0));o=bpy.context.active_object;o.name=f'wheel{sx}';_finish(o,mTIM,0,g)
col(k,-10,-2.4,3.4,1.4)
B('trough',(2.4,0.6,0.5),(12,-4.2,0.25),mTIM,p=r);B('troughin',(2.2,0.45,0.1),(12,-4.2,0.45),mDARK,p=r);col(k,12,4.2,2.4,0.6)
tube('lamppost',(24,-4.6,0),(24.8,-4.0,3.4),0.07,mIRON,r,v=6);Cy('lampglass',0.18,0.35,(24.85,-3.95,3.55),mGLASS,v=8,p=r);col(k,24,4.6,0.4,0.4)
for i,(x,y) in enumerate(((-26,4.3),(-25.2,4.6),(5,-4.4),(-4,4.8))):barrel(f'sb{i}',x,y,r,fallen=(i==1),rz=J(3));col(k,x,-y,0.7,0.7)
crate('sc1',18,4.4,0.3,r);crate('sc2',18.6,4.8,0.1,r,broken=True);col(k,18.2,-4.5,1.2,1.0)
skeleton('streetbones',30,-2,1.2,r)
export('TownStreet',rend=True)
json.dump({'cols':COLS},open(os.path.join(OUT,'TownColliders.json'),'w'),separators=(',',':'))
print('pieces',len(BLDGS)+7,'colliders',sum(len(v) for v in COLS.values()))
bpy.ops.wm.save_mainfile()
