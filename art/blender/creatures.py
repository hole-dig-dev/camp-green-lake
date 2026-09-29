exec(open('/tmp/claude-1001/bl/finds2.py').read().split("# ---------------- cans, round 2")[0])
from mathutils import Vector
def blob(name,loc,scale,m,parent,seg=10,rings=6,rot=(0,0,0),jit=0.0,seed=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,radius=1,location=loc,rotation=rot);o=bpy.context.active_object;o.name=name
    if jit:
        rr=random.Random(seed)
        for v in o.data.vertices:v.co*=1+rr.uniform(-jit,jit)
    o.scale=scale;return _finish(o,m,0,parent)
def cone(name,a,b,r1,r2,m,parent,verts=7):
    a,b=Vector(a),Vector(b);d=b-a;o=cyl(name,r1,d.length,(a+b)/2,m,verts=verts,r2=r2,bevel=0,parent=parent);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def limb(name,pts,r,m,parent,taper=0.8):
    for k,(a,b) in enumerate(zip(pts,pts[1:])):cone(f'{name}{k}',a,b,r*(taper**k),r*(taper**(k+1)),m,parent)
    for k,p in enumerate(pts[1:-1]):blob(f'{name}j{k}',p,(r*taper**(k+1),)*3,m,parent,seg=6,rings=4)
def eye(name,loc,r,parent,iris=(0x1a,0x14,0x10),white=None):
    if white:blob(name+'w',loc,(r*1.3,)*3,M_('c_eyewhite',white,0.3),parent,seg=8,rings=5)
    blob(name,loc,(r,)*3,M_('c_eye_'+name,iris,0.15),parent,seg=8,rings=5)
def shot(n,elev=22,azim=-38,margin=1.25):
    studio(elev=elev,azim=azim,lens=60);frame(margin=margin);f=ob(n+'.floor');f.data.materials.clear();f.data.materials.append(mat('kb_sand',(0xe3,0xbf,0x86),0.95))
    render(n,res=(512,512),samples=40);print(n,tris())

# ================== yellow-spotted lizard (~0.7 m nose to tail; faces -Y) ==================
def lizard(n,body,spot,belly,spots='round',frill=False,chunky=1.0,tail=1.0,eyes=(0xd9,0x9a,0x1a),crest=False):
    scene(n);r=root(n);B=M_('c_lz_'+n,body,0.7);S=M_('c_lzs_'+n,spot,0.5);Bl=M_('c_lzb_'+n,belly,0.8)
    blob('body',(0,0,0.07),(0.075*chunky,0.19,0.05*chunky),B,r,seg=12,rings=8)
    blob('belly',(0,0,0.045),(0.065*chunky,0.17,0.03),Bl,r,seg=10,rings=6)
    blob('head',(0,-0.24,0.08),(0.06*chunky,0.08,0.042),B,r,seg=10,rings=6)
    blob('snout',(0,-0.31,0.073),(0.04,0.045,0.03),B,r,seg=8,rings=5)
    for s in (-1,1):
        eye(f'eye{s}',(s*0.045,-0.26,0.105),0.013,r,iris=eyes)
        for fy,sg in ((-0.11,1),(0.12,-1)):
            limb(f'leg{s}{fy}',[(s*0.06*chunky,fy,0.06),(s*0.13,fy-0.02*sg,0.06),(s*0.15,fy-0.05*sg,0.0)],0.018*chunky,B,r)
            for t in (-1,0,1):cone(f'toe{s}{fy}{t}',(s*0.15,fy-0.05*sg,0.005),(s*(0.15+0.03),fy-0.05*sg+t*0.025,0.0),0.006,0.002,B,r,verts=4)
    pts=[(0,0.17,0.06),(0.02,0.3,0.05),(-0.02,0.45,0.035),(0.03,0.58,0.02)];pts=[(x,0.17+(y-0.17)*tail,z) for x,y,z in pts]
    limb('tail',pts,0.042*chunky,B,r,taper=0.62)
    rr=random.Random(len(n))
    for k in range(16):
        y=rr.uniform(-0.28,0.33*tail);x=rr.uniform(-0.05,0.05)*chunky*(1-max(0,y-0.17)*1.5);z=0.07+0.045*chunky*(1-(x/0.075)**2)**0.5 if abs(x)<0.07 else 0.07
        if y>0.17:z=0.055-0.03*(y-0.17)
        if y<-0.2:z=0.11
        if spots=='round':blob(f'spot{k}',(x,y,z),(0.014,0.014,0.006),S,r,seg=8,rings=4)
        elif spots=='bands' and k<7:box(f'band{k}',(0.16*chunky,0.02,0.01),(0,-0.15+k*0.07*tail,0.1 if k<5 else 0.06),S,bevel=0.004,parent=r)
        elif spots=='dots':blob(f'spot{k}',(x,y,z),(0.008,0.008,0.004),S,r,seg=6,rings=3)
    if frill:
        for s in (-1,1):cone(f'frill{s}',(s*0.05,-0.19,0.1),(s*0.11,-0.17,0.13),0.03,0.005,S,r,verts=5)
    if crest:
        for k in range(9):cone(f'crest{k}',(0,-0.18+k*0.05,0.11-k*0.006),(0,-0.18+k*0.05,0.14-k*0.008),0.008,0.001,S,r,verts=4)
    shot(n,elev=28)
lizard('Liz_1',(0x6a,0x7a,0x2a),(0xe8,0xc8,0x1a),(0xb8,0xa8,0x5a))
lizard('Liz_2',(0x4a,0x44,0x2e),(0xf0,0xd0,0x20),(0x9a,0x8a,0x5a),chunky=1.25,tail=0.8)            # gila-monster chunky
lizard('Liz_3',(0x7a,0x8a,0x3a),(0xf0,0xd8,0x30),(0xc8,0xb8,0x6a),frill=True,eyes=(0xc0,0x20,0x20)) # frilled, red eyes
lizard('Liz_4',(0x3a,0x3a,0x30),(0xe8,0xc0,0x1a),(0x8a,0x7a,0x4a),spots='bands',crest=True)       # dark, banded, spiky crest
lizard('Liz_5',(0x9a,0x8a,0x4a),(0xe8,0xd0,0x2a),(0xd0,0xc0,0x8a),spots='dots',tail=1.3,chunky=0.85) # sleek desert runner

# ================== javelina (~0.9 m long; faces -Y) ==================
def javelina(n,coat,collar,snout,hair=True,tusks=True,chunky=1.0,ears='pointy',mane=False):
    scene(n);r=root(n);C=M_('c_jv_'+n,coat,0.95);K=M_('c_jvc_'+n,collar,0.95);Sn=M_('c_jvs_'+n,snout,0.7)
    blob('body',(0,0,0.36),(0.19*chunky,0.36,0.2*chunky),C,r,seg=12,rings=8,jit=0.05,seed=1)
    blob('shoulder',(0,-0.2,0.4),(0.18*chunky,0.16,0.21*chunky),C,r,seg=10,rings=6)
    cyl('collar',0.19*chunky,0.05,(0,-0.12,0.38),K,verts=14,rot=(math.pi/2,0,0),bevel=0,parent=r).scale=(1,1.12,1)
    blob('head',(0,-0.42,0.36),(0.12,0.16,0.12),C,r,seg=10,rings=6)
    cone('snoutc',(0,-0.5,0.33),(0,-0.66,0.28),0.075,0.05,C,r,verts=10)
    cyl('disc',0.05,0.02,(0,-0.665,0.28),Sn,verts=10,rot=(math.pi/2,0,0),bevel=0,parent=r)
    for s in (-1,1):
        cyl(f'nost{s}',0.012,0.01,(s*0.02,-0.676,0.285),INK,verts=6,rot=(math.pi/2,0,0),bevel=0,parent=r)
        eye(f'eye{s}',(s*0.075,-0.5,0.42),0.016,r)
        if ears=='pointy':cone(f'ear{s}',(s*0.07,-0.36,0.46),(s*0.1,-0.33,0.56),0.035,0.004,C,r,verts=5)
        else:blob(f'ear{s}',(s*0.09,-0.36,0.48),(0.03,0.02,0.045),C,r,seg=6,rings=4)
        if tusks:cone(f'tusk{s}',(s*0.04,-0.6,0.27),(s*0.06,-0.62,0.33),0.01,0.002,M_('c_tusk',(0xf0,0xe8,0xd0),0.4),r,verts=5)
        for fy in (-0.24,0.24):limb(f'leg{s}{fy}',[(s*0.11*chunky,fy,0.28),(s*0.12*chunky,fy,0.12),(s*0.12*chunky,fy+0.01,0.0)],0.04,C,r,taper=0.7)
    if hair or mane:
        rr=random.Random(3)
        for k in range(22 if mane else 12):
            y=-0.35+k*(0.7/(22 if mane else 12));cone(f'bristle{k}',(rr.uniform(-0.02,0.02),y,0.52+0.04*math.sin(k)),(rr.uniform(-0.03,0.03),y+0.02,0.62 if mane else 0.58),0.025,0.002,C,r,verts=4)
    cone('tail',(0,0.35,0.42),(0,0.42,0.36),0.02,0.005,C,r,verts=5)
    shot(n)
javelina('Jav_1',(0x3a,0x34,0x2e),(0xc8,0xb8,0x98),(0x5a,0x40,0x3a))
javelina('Jav_2',(0x5a,0x4c,0x3e),(0xd8,0xcc,0xa8),(0x6a,0x4a,0x40),mane=True,chunky=1.15)
javelina('Jav_3',(0x2a,0x28,0x26),(0xe0,0xd4,0xb8),(0x4a,0x34,0x2e),tusks=True,ears='round')
javelina('Jav_4',(0x6a,0x58,0x46),(0xb8,0xa8,0x88),(0x7a,0x5a,0x4a),hair=False,chunky=0.9)
javelina('Jav_5',(0x44,0x3a,0x30),(0xf0,0xe8,0xd0),(0x5a,0x3a,0x34),mane=True,chunky=1.3,ears='round')

# ================== mountain lion (~2 m nose to tail; faces -Y) ==================
def lion(n,fur,dark,belly,crouch=0.0,lean=1.0,muzzle=(0xf0,0xe4,0xc8),tail=1.0):
    scene(n);r=root(n);F=M_('c_ln_'+n,fur,0.85);D=M_('c_lnd_'+n,dark,0.85);Bl=M_('c_lnb_'+n,belly,0.9);Mz=M_('c_lnm_'+n,muzzle,0.9)
    h=0.72-crouch
    blob('chest',(0,-0.35,h+0.05),(0.22*lean,0.32,0.25),F,r,seg=12,rings=8)
    blob('hips',(0,0.35,h),(0.2*lean,0.34,0.22),F,r,seg=12,rings=8)
    blob('belly',(0,0,h-0.12),(0.16*lean,0.45,0.1),Bl,r,seg=10,rings=6)
    blob('neck',(0,-0.62,h+0.14-crouch*0.4),(0.13,0.16,0.14),F,r,seg=10,rings=6)
    hz=h+0.2-crouch*0.6
    blob('head',(0,-0.8,hz),(0.15,0.16,0.13),F,r,seg=12,rings=8)
    blob('muzzle',(0,-0.94,hz-0.04),(0.08,0.07,0.06),Mz,r,seg=10,rings=6)
    blob('nose',(0,-1.0,hz-0.01),(0.03,0.02,0.02),M_('c_lnnose',(0xb0,0x70,0x6a),0.6),r,seg=6,rings=4)
    for s in (-1,1):
        eye(f'eye{s}',(s*0.07,-0.93,hz+0.05),0.02,r,iris=(0xd8,0xb0,0x30))
        blob(f'pupil{s}',(s*0.07,-0.948,hz+0.05),(0.006,0.004,0.014),M_('c_black',(0x10,0x10,0x10),0.3),r,seg=6,rings=4)
        cone(f'ear{s}',(s*0.09,-0.76,hz+0.1),(s*0.11,-0.74,hz+0.21),0.05,0.012,F,r,verts=6)
        blob(f'earin{s}',(s*0.1,-0.78,hz+0.14),(0.02,0.01,0.04),D,r,seg=6,rings=4)
        blob(f'tear{s}',(s*0.05,-0.96,hz+0.0),(0.012,0.006,0.04),D,r,seg=6,rings=4)
        fy=-0.4;limb(f'fleg{s}',[(s*0.13*lean,fy,h-0.05),(s*0.14*lean,fy-0.02,h*0.45),(s*0.14*lean,fy-0.04,0.05)],0.075,F,r,taper=0.78)
        blob(f'fpaw{s}',(s*0.14*lean,fy-0.08,0.04),(0.07,0.09,0.045),F,r,seg=8,rings=5)
        by=0.42;limb(f'bleg{s}',[(s*0.13*lean,by,h-0.05),(s*0.15*lean,by+0.12,h*0.5),(s*0.14*lean,by+0.05,0.18),(s*0.14*lean,by+0.02,0.04)],0.085,F,r,taper=0.78)
        blob(f'bpaw{s}',(s*0.14*lean,by-0.04,0.04),(0.07,0.09,0.045),F,r,seg=8,rings=5)
    pts=[(0,0.68,h),(0.0,0.95,h-0.25),(0.05,1.2*tail,h-0.35),(0.1,1.45*tail,h-0.2)]
    limb('tail',pts,0.05,F,r,taper=0.9);blob('tailtip',pts[-1],(0.055,0.07,0.055),D,r,seg=8,rings=5)
    shot(n,elev=18,azim=-50)
lion('Lion_1',(0xb9,0x82,0x4c),(0x5a,0x3a,0x22),(0xe4,0xcd,0x9e))
lion('Lion_2',(0xa8,0x70,0x3e),(0x3a,0x26,0x18),(0xd8,0xc0,0x90),crouch=0.22)            # stalking low
lion('Lion_3',(0xc8,0x98,0x62),(0x6a,0x46,0x28),(0xf0,0xe0,0xb8),lean=0.85,tail=1.2)       # lean, long-tailed
lion('Lion_4',(0x9a,0x6a,0x3e),(0x2a,0x1c,0x14),(0xd0,0xb4,0x84),lean=1.15)                # heavy, dark points
lion('Lion_5',(0xc0,0x8c,0x52),(0x4a,0x30,0x1e),(0xea,0xd6,0xa8),crouch=0.1,lean=0.95,muzzle=(0xfa,0xf0,0xde))

# ================== vulture (~1.8 m wingspan, soaring; faces -Y) ==================
def vulture(n,body,head,wing_under,span=1.0,ruff=(0xe8,0xe0,0xd0),bald=True,fingers=6,wingup=0.12):
    scene(n);r=root(n);B=M_('c_vb_'+n,body,0.85);H=M_('c_vh_'+n,head,0.7);W=M_('c_vw_'+n,wing_under,0.85)
    z=1.2
    blob('body',(0,0,z),(0.14,0.34,0.12),B,r,seg=12,rings=8)
    blob('ruff',(0,-0.26,z+0.03),(0.1,0.07,0.09),M_('c_vruff_'+n,ruff,0.95),r,seg=10,rings=6,jit=0.12,seed=2)
    cone('neck',(0,-0.3,z+0.04),(0,-0.42,z+0.06),0.035,0.03,H if bald else B,r,verts=8)
    blob('head',(0,-0.47,z+0.07),(0.045,0.06,0.045),H,r,seg=10,rings=6)
    cone('beak',(0,-0.52,z+0.07),(0,-0.6,z+0.04),0.025,0.006,M_('c_vbeak',(0xe8,0xdc,0xb8),0.5),r,verts=6)
    for s in (-1,1):
        eye(f'eye{s}',(s*0.03,-0.5,z+0.09),0.008,r,iris=(0x6a,0x1a,0x10))
        # wing: a broad plank angled up (dihedral) with separated primary "fingers" at the tip
        L=0.85*span
        w=box(f'wing{s}',(L,0.32,0.02),(s*(0.12+L/2),-0.02,z+0.04+L/2*wingup),B,rot=(0,-s*wingup,0),bevel=0.01,parent=r)
        box(f'wingu{s}',(L*0.92,0.2,0.012),(s*(0.12+L/2),0.04,z+0.03+L/2*wingup),W,rot=(0,-s*wingup,0),bevel=0.004,parent=r)
        for k in range(fingers):
            a=-0.35+k*0.14;x0=s*(0.12+L);zz=z+0.04+L*wingup
            box(f'fing{s}{k}',(0.22,0.04,0.012),(x0+s*0.1*math.cos(a),-0.02+0.25*a,zz),B,rot=(0,-s*wingup,s*a),bevel=0.003,parent=r)
    box('tail',(0.22,0.2,0.02),(0,0.42,z-0.01),B,bevel=0.01,parent=r)
    for s in (-1,1):cone(f'foot{s}',(s*0.05,0.2,z-0.08),(s*0.05,0.3,z-0.1),0.015,0.01,M_('c_vfoot',(0xc8,0xb8,0xa8),0.7),r,verts=5)
    shot(n,elev=35,azim=-25,margin=1.15)
vulture('Vult_1',(0x22,0x1e,0x1c),(0xb0,0x2a,0x22),(0x8a,0x86,0x80))                   # turkey vulture: red head, silver flight feathers
vulture('Vult_2',(0x18,0x18,0x18),(0x5a,0x5a,0x58),(0xd8,0xd4,0xcc),span=1.1)           # black vulture: grey head, white wingtips
vulture('Vult_3',(0x2e,0x26,0x20),(0xc8,0x3a,0x2a),(0x6a,0x60,0x56),span=1.2,fingers=7,wingup=0.2)  # big, strong dihedral
vulture('Vult_4',(0x3a,0x30,0x28),(0xe0,0x9a,0x80),(0xa8,0xa0,0x90),ruff=(0xf4,0xf0,0xe6))          # ragged, pale ruff
vulture('Vult_5',(0x24,0x20,0x1e),(0x8a,0x2a,0x28),(0x9a,0x96,0x8e),span=0.95,wingup=0.05,fingers=5)  # flatter glide
bpy.context.window.scene=bpy.data.scenes['ARCHIVED_Camper_minipc'];bpy.ops.wm.save_mainfile()
