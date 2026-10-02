# blend: gear.blend
# Sifter hopper upgrades (JT 2026-10-01: "add upgrades to sifter, sifts over time, holds volumes of sand to dump so
# player can keep digging"). You dump your bucket into the hopper and go back to digging; the sifter works through it
# on its own (public/js/86-hopper.js). Three tiers, bought at the Supply Depot:
#   HopperSand1..3   the sand in the hopper, full (origin at its bottom, centred on the hopper; the game scales it up
#                    as it fills). Tier 1 fits the sifter's own hopper; 2 and 3 rise into the add-ons below.
#   HopperExt2       tier 2: a plank collar on top of the hopper (50 holes)
#   HopperExt3       tier 3: a towering galvanised bin on timber legs, and a little gas motor driving the blower,
#                    with an exhaust stack (120 holes)
# HopperExt* are in the sifter's own frame (art/blender/sifter.py: origin on the ground at its middle, tray along X,
# hopper at X -0.85, blower on -Y), so the game puts them exactly where the Sifter is.
# Built in background Blender:  ~/blender/blender -b art/blender/gear.blend --python art/blender/hopper.py
import bpy,os,math,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'hopper.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
OUT=os.path.join(ART,'glb');rnd=random.Random(1850)
def M_(n,c,r=0.9,m=0.0):return ('h_'+n,c,r,m)
def B(n,size,loc,m,rot=(0,0,0),bv=0.01):return box(n,size,loc,m,rot=rot,bevel=bv)
WOOD=M_('wood',(0x8a,0x68,0x46));WOOD2=M_('wood2',(0x66,0x4c,0x34));IRON=M_('iron',(0x3a,0x3a,0x3c),0.6,0.6)
GALV=M_('galv',(0xa4,0xaa,0xae),0.45,0.75);RED=M_('red',(0xa8,0x3a,0x2a),0.6);SAND=M_('sand',(0xc9,0xa8,0x72),0.97)
BLACK=M_('black',(0x22,0x22,0x22),0.7)
HX,HZ0,HTOP=-0.85,1.45,1.85     # the hopper: centre X, its floor, the grizzly bars on top (sifter.py hx, hz)
C2=2.35                         # tier 2 collar top
B3,T3=2.0,3.15                  # tier 3 bin: bottom, top
def view(n,res=(500,500)):studio(elev=18,azim=-40,lens=45,floor=False);frame(margin=1.25);render(res=res,samples=10)
def lumps(n,w,d,z,k):
    for i in range(n):B(f'lump{i}',(0.08+rnd.random()*0.08,0.07+rnd.random()*0.07,0.04),((rnd.random()-0.5)*(w-0.12),(rnd.random()-0.5)*(d-0.12),z),SAND,rot=(0,0,rnd.random()*3),bv=0.015)
# ---- tier 2: the plank collar (boards on edge, corner posts down to the hopper rim)
scene('HopperExt2');root('HopperExt2')
iw,id_=0.74,0.8
for s in(-1,1):
    for k in range(3):
        z=HTOP+0.02+0.08+k*0.165
        B(f'boardY{s}{k}',(iw+0.08,0.035,0.15),(HX,s*(id_/2+0.02),z),WOOD if k%2 else WOOD2)
        B(f'boardX{s}{k}',(0.035,id_+0.04,0.15),(HX+s*(iw/2+0.02),0,z),WOOD2 if k%2 else WOOD)
    for t in(-1,1):B(f'post{s}{t}',(0.06,0.06,C2-HTOP+0.25),(HX+s*(iw/2+0.03),t*(id_/2+0.03),HTOP-0.1+(C2-HTOP+0.25)/2),WOOD2)
B('stencil',(0.3,0.005,0.08),(HX,-(id_/2+0.04),HTOP+0.27),M_('ink',(0x22,0x1c,0x16),0.8),bv=0)
view('HopperExt2');p=export_glb(os.path.join(OUT,'HopperExt2.glb'));print('HopperExt2',p[1],p[2])
# ---- tier 3: the big bin on legs, and the motor
scene('HopperExt3');root('HopperExt3')
hb,ht=0.42,0.78   # the bin's half-width at its bottom and top
h=T3-B3;a=math.atan2(ht-hb,h);mid=(hb+ht)/2
for s in(-1,1):
    B(f'wallY{s}',(2*mid+0.06,0.03,h/math.cos(a)),(HX,s*mid,B3+h/2),GALV,rot=(-s*a,0,0),bv=0.004)
    B(f'wallX{s}',(0.03,2*mid+0.06,h/math.cos(a)),(HX+s*mid,0,B3+h/2),GALV,rot=(0,s*a,0),bv=0.004)
    for t in(-1,1):B(f'rib{s}{t}',(0.05,0.05,h/math.cos(a)),(HX+s*mid,t*mid,B3+h/2),IRON,rot=(-t*a,s*a,0),bv=0.004)
B('rimY1',(2*ht+0.1,0.06,0.05),(HX,ht,T3),IRON,bv=0.004);B('rimY0',(2*ht+0.1,0.06,0.05),(HX,-ht,T3),IRON,bv=0.004)
B('rimX1',(0.06,2*ht+0.1,0.05),(HX+ht,0,T3),IRON,bv=0.004);B('rimX0',(0.06,2*ht+0.1,0.05),(HX-ht,0,T3),IRON,bv=0.004)
B('chute',(0.5,0.5,B3-HTOP+0.06),(HX,0,(B3+HTOP)/2),GALV,bv=0.004)   # down into the old hopper
for s in(-1,1):
    for t in(-1,1):
        B(f'leg{s}{t}',(0.09,0.09,B3+0.05),(HX+s*(hb+0.25),t*(hb+0.25),(B3+0.05)/2),WOOD2)
        B(f'arm{s}{t}',(0.06,0.06,0.42),(HX+s*(hb+0.12),t*(hb+0.12),B3+0.02),WOOD2,rot=(t*0.75,-s*0.75,0))
    B(f'braceY{s}',(2*(hb+0.25),0.05,0.08),(HX,s*(hb+0.25),0.7),WOOD)
B('bigsign',(0.62,0.01,0.2),(HX,-(mid+0.03),B3+0.55),M_('signred',(0xc0,0x40,0x30),0.7),rot=(a,0,0),bv=0)
# the motor: on the ground by the blower (sifter.py: drum at -0.35, -0.75), belt to the drum, exhaust stack
mx,my=0.25,-0.85
B('motor',(0.42,0.3,0.3),(mx,my,0.2),RED,bv=0.03);B('motorbase',(0.55,0.4,0.05),(mx,my,0.025),WOOD2)
B('tank',(0.24,0.2,0.12),(mx-0.05,my,0.41),RED,bv=0.04);cyl('cap',0.03,0.04,(mx-0.05,my,0.49),BLACK,verts=8)
cyl('flywheel',0.14,0.05,(mx-0.24,my,0.24),BLACK,verts=14,rot=(0,math.pi/2,0))
B('belt',(0.6,0.03,0.04),(mx-0.3,my,0.34),BLACK,rot=(0,0.25,0),bv=0)
cyl('exhaust',0.03,0.75,(mx+0.15,my,0.7),IRON,verts=8);cyl('exhaustcap',0.05,0.05,(mx+0.15,my,1.08),IRON,verts=8)
view('HopperExt3',(600,600));p=export_glb(os.path.join(OUT,'HopperExt3.glb'));print('HopperExt3',p[1],p[2])
# ---- the sand, full, one per tier (origin at the hopper floor: the game scales it up from there)
def sand(t):
    scene(f'HopperSand{t}');root(f'HopperSand{t}')
    B('lower',(0.5,0.54,HTOP-0.04-HZ0),(0,0,(HTOP-0.04-HZ0)/2),SAND,bv=0.02);top=HTOP-0.04-HZ0
    if t==2:B('collar',(iw-0.02,id_-0.02,C2-0.06-HTOP),(0,0,top+(C2-0.06-HTOP)/2),SAND,bv=0.02);top=C2-0.06-HZ0;lumps(8,iw,id_,top,t)
    elif t==3:
        B('chute',(0.46,0.46,B3-HTOP),(0,0,top+(B3-HTOP)/2),SAND,bv=0.01)
        cyl('bin',hb*math.sqrt(2)-0.03,T3-0.08-B3,(0,0,B3-HZ0+(T3-0.08-B3)/2),SAND,verts=4,rot=(0,0,math.pi/4),r2=(hb+(ht-hb)*(T3-0.08-B3)/h)*math.sqrt(2)-0.03,bevel=0)
        top=T3-0.08-HZ0;lumps(12,2*ht-0.1,2*ht-0.1,top,t)
    else:lumps(5,0.5,0.54,top,t)
    view(f'HopperSand{t}',(400,400));p=export_glb(os.path.join(OUT,f'HopperSand{t}.glb'));print(f'HopperSand{t}',p[1],p[2])
for t in(1,2,3):sand(t)
bpy.ops.wm.save_mainfile()
