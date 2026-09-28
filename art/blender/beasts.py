exec(open('/tmp/claude-1001/bl/creatures.py').read().split("# ================== yellow-spotted lizard")[0])
from mathutils import noise
def skin(name,nodes,edges,parent,sub=2,dec=0.35,seed=0):
    """nodes: [(x,y,z,rx,rz)]; a Skin-modifier body, subdivided, then decimated back to crisp low-poly facets."""
    me=bpy.data.meshes.new(name);me.from_pydata([n[:3] for n in nodes],edges,[]);o=bpy.data.objects.new(name,me);bpy.context.window.scene.collection.objects.link(o)
    o.modifiers.new('skin','SKIN')
    for i,n in enumerate(nodes):me.skin_vertices[0].data[i].radius=(n[3],n[4])
    me.skin_vertices[0].data[0].use_root=True
    ss=o.modifiers.new('sub','SUBSURF');ss.levels=sub;ss.render_levels=sub
    d=o.modifiers.new('dec','DECIMATE');d.ratio=dec
    bpy.context.view_layer.objects.active=o
    for x in bpy.context.selected_objects:x.select_set(False)
    o.select_set(True)
    for m in ('skin','sub','dec'):bpy.ops.object.modifier_apply(modifier=m)
    for p in o.data.polygons:p.use_smooth=False
    _link(o);o.parent=parent;return o
def paintfn(o,fn):
    me=o.data
    if 'Col' in me.color_attributes:me.color_attributes.remove(me.color_attributes['Col'])
    ca=me.color_attributes.new('Col','FLOAT_COLOR','CORNER');me.color_attributes.active_color=ca
    for poly in me.polygons:
        c=Vector(fn(poly.center,poly.normal))
        for li in poly.loop_indices:ca.data[li].color=(c.x,c.y,c.z,1)
    o.data.materials.clear();o.data.materials.append(vcol_mat('beast_vcol',0.85))
def lin(c):return Vector(srgb(c)[:3])
def mix(a,b,t):return a.lerp(b,max(0,min(1,t)))
def claws(prefix,paw,dirv,parent,n=4,spread=0.018,L=0.03,r=0.006,m=None):
    m=m or M_('c_claw',(0x2a,0x24,0x1e),0.5)
    for k in range(n):
        o=(k-(n-1)/2)*spread;a=Vector(paw[:3])+Vector((o,0,0));cone(f'{prefix}{k}',a,a+Vector(dirv)*L,r,r*0.25,m,parent,verts=5)


def surf(body,origin,direction):
    """Where a ray from origin along direction first hits the body: (point, normal). Features get placed on this."""
    d=Vector(direction).normalized();o=Vector(origin)+d*1.0   # start outside, on the side the feature faces, and cast back in
    hit,loc,nrm,_=body.ray_cast(o,-d)
    if not hit:raise RuntimeError('no surface hit for %s'%(origin,))
    return loc,nrm
def eye2(tag,body,origin,direction,r,parent,iris,sink=0.45,slit=False):
    p,n=surf(body,origin,direction);c=p-n*r*sink
    blob(tag,c,(r,r,r),M_('c_eyeball_'+bpy.context.window.scene.name+tag,iris,0.12),parent,seg=10,rings=6)
    q=c+n*r*0.97;pu=blob(tag+'p',q,(r*0.45 if not slit else r*0.16,r*0.45,r*0.12),M_('c_pupil',(0x0c,0x0a,0x08),0.1),parent,seg=8,rings=4)
    pu.rotation_euler=n.to_track_quat('Z','Y').to_euler()
    blob(tag+'hl',c+n*r*0.9+Vector((0,0,r*0.35)),(r*0.14,)*3,M_('c_eyehl',(0xff,0xff,0xff),0.05),parent,seg=6,rings=4)
    return p,n
def nostril(tag,body,origin,direction,r,parent):
    p,n=surf(body,origin,direction);o=blob(tag,p-n*r*0.3,(r,r,r*0.4),M_('c_nost',(0x10,0x0c,0x0a),0.6),parent,seg=8,rings=4);o.rotation_euler=n.to_track_quat('Z','Y').to_euler()
def patch(tag,body,origin,direction,sx,sy,m,parent,thick=0.006):
    """a flat marking stuck onto the surface (nose pad, snout disc)."""
    p,n=surf(body,origin,direction);o=blob(tag,p+n*thick*0.3,(sx,sy,thick),m,parent,seg=10,rings=5);o.rotation_euler=n.to_track_quat('Z','Y').to_euler();return p,n

# ======================= LIZARD (theme #1: green, yellow spots) =======================
scene('Lizard');r=root('Lizard')
N=[(0,-0.37,0.055,0.022,0.016),(0,-0.31,0.07,0.042,0.03),(0,-0.25,0.075,0.05,0.036),(0,-0.19,0.07,0.044,0.032),
   (0,-0.1,0.07,0.068,0.04),(0,0.02,0.072,0.076,0.042),(0,0.13,0.066,0.062,0.036),
   (0.01,0.24,0.055,0.045,0.03),(0.025,0.36,0.042,0.032,0.022),(0.02,0.48,0.03,0.02,0.015),(-0.01,0.6,0.02,0.011,0.009),(-0.035,0.7,0.014,0.004,0.004)]
E=[(i,i+1) for i in range(len(N)-1)]
def leg(root_i,side,base,front):
    sx=side;y=base[1]
    pts=[(sx*0.07,y,0.065,0.024,0.02),(sx*0.13,y+(-0.02 if front else 0.02),0.06,0.019,0.016),(sx*0.16,y+(-0.045 if front else 0.04),0.02,0.013,0.011),(sx*0.175,y+(-0.07 if front else 0.07),0.008,0.012,0.006)]
    i0=len(N);N.extend(pts);E.append((root_i,i0));E.extend([(i0+k,i0+k+1) for k in range(3)]);return pts[-1]
paws=[]
for s in (-1,1):paws.append((leg(4,s,N[4],True),s,True));paws.append((leg(6,s,N[6],False),s,False))
body=skin('liz',N,E,r,sub=2,dec=0.75)
GREEN=lin((0x6a,0x7a,0x2a));DARK=lin((0x3e,0x4a,0x1c));BELLY=lin((0xc8,0xb8,0x6a));YEL=lin((0xf0,0xcc,0x1a))
def lizpaint(c,n):
    t=mix(BELLY,GREEN,(n.z+0.4)/0.8);t=mix(t,DARK,max(0,noise.noise(c*18)*0.8))
    if n.z>0.2 and c.y<0.5:
        sp=noise.noise(c*Vector((34,34,34))+Vector((3,1,2)))
        if sp>0.32:t=YEL
    return t
paintfn(body,lizpaint)
for s in (-1,1):
    p,n=eye2(f'eye{s}',body,(s*0.02,-0.275,0.085),(s,-0.25,0.35),0.013,r,(0xd9,0xa0,0x1a),sink=0.35,slit=True)
    lid=blob(f'lid{s}',p-n*0.006+Vector((0,0.004,0.008)),(0.012,0.015,0.004),M_('c_lz_lid',(0x5a,0x6a,0x22),0.7),r,seg=8,rings=4)   # brow ridge over the eye, touching the head
    nostril(f'nost{s}',body,(s*0.01,-0.36,0.06),(s*0.4,-1,0.3),0.0045,r)
for (p,s,front) in paws:claws(f'toe{s}{front}',p,(s*0.5,-0.9 if front else 0.2,-0.1) if front else (s*0.6,0.7,-0.1),r,n=4,spread=0.014,L=0.035,r=0.005,m=M_('c_lztoe',(0x4e,0x5a,0x22),0.7))

shot('Lizard',elev=30,azim=-35,margin=1.18)

# ======================= JAVELINA (theme #1: dark, bristly, tusks, pale collar) =======================
scene('Javelina');r=root('Javelina')
N=[(0,0.5,0.4,0.05,0.055),(0,0.45,0.41,0.12,0.13),(0,0.36,0.42,0.17,0.18),(0,0.18,0.44,0.2,0.21),(0,-0.05,0.46,0.21,0.23),(0,-0.22,0.47,0.2,0.23),(0,-0.36,0.43,0.15,0.17),(0,-0.47,0.38,0.12,0.12),(0,-0.58,0.32,0.08,0.075),(0,-0.67,0.29,0.058,0.055)]
E=[(i,i+1) for i in range(len(N)-1)]
feet=[]
for s in (-1,1):
    for ri,y in ((5,-0.22),(3,0.24)):
        pts=[(s*0.1,y,0.36,0.07,0.08),(s*0.11,y+0.02,0.2,0.042,0.045),(s*0.11,y-0.01,0.07,0.032,0.032),(s*0.11,y-0.02,0.02,0.035,0.028)]
        i0=len(N);N.extend(pts);E.append((ri,i0));E.extend([(i0+k,i0+k+1) for k in range(3)]);feet.append(pts[-1])
N.append((0,0.55,0.42,0.015,0.015));E.append((0,len(N)-1))
body=skin('jav',N,E,r,dec=0.4)
COAT=lin((0x3a,0x34,0x2e));GRIZ=lin((0x7a,0x70,0x62));COLL=lin((0xc8,0xb8,0x98));SNOUT=lin((0x4a,0x36,0x30))
def javpaint(c,n):
    t=mix(COAT,GRIZ,max(0,noise.noise(c*22))*0.9)
    if -0.2<c.y<-0.11 and c.z>0.28:t=mix(t,COLL,0.85)
    if c.y<-0.6:t=SNOUT
    return t
paintfn(body,javpaint)
rr=random.Random(5)
dp,dn=patch('disc',body,(0,-0.66,0.29),(0,-1,0),0.05,0.045,M_('c_jvs2',(0x5a,0x40,0x3a),0.6),r,thick=0.012)
for s in (-1,1):
    nostril(f'nost{s}',body,(s*0.018,-0.66,0.29),(0,-1,0),0.011,r)
    eye2(f'eye{s}',body,(s*0.05,-0.48,0.42),(s,-0.35,0.2),0.016,r,(0x2a,0x1a,0x12),sink=0.5)
    ep,en_=surf(body,(s*0.06,-0.38,0.45),(s*0.5,0,1));cone(f'ear{s}',ep-en_*0.01,ep+Vector((s*0.035,0.02,0.1)),0.042,0.006,M_('c_jvear',(0x2e,0x28,0x24),0.9),r,verts=6)
    tp,tn=surf(body,(s*0.03,-0.6,0.27),(s,0,-0.2));cone(f'tusk{s}',tp-tn*0.01,tp+Vector((s*0.012,-0.012,0.06)),0.011,0.002,M_('c_tusk',(0xf0,0xe8,0xd0),0.4),r,verts=5)
for k in range(34):   # bristly mane along the spine, raised and tousled
    y=-0.38+k*0.022;z=0.66-abs(y+0.05)*0.25;a=Vector((0,y,z));b=a+Vector((rr.uniform(-0.05,0.05),rr.uniform(0.0,0.06),rr.uniform(0.07,0.13)))
    cone(f'bristle{k}',a-Vector((0,0,0.04)),b,0.022,0.002,M_('c_jvbr',(0x26,0x22,0x1e) if k%3 else (0x6a,0x60,0x52),0.95),r,verts=4)
for f in feet:cone('hoof'+str(f[0])+str(f[1]),(f[0],f[1]-0.01,0.03),(f[0],f[1]-0.04,0.0),0.03,0.022,M_('c_hoof',(0x1c,0x18,0x16),0.6),r,verts=6)
shot('Javelina',elev=20,azim=-40,margin=1.15)

# ======================= MOUNTAIN LION (theme #4: heavy, dark points) =======================
scene('Lion');r=root('Lion')
N=[(0,0.56,0.64,0.12,0.14),(0,0.44,0.66,0.2,0.22),(0,0.18,0.64,0.18,0.2),(0,-0.1,0.66,0.19,0.22),(0,-0.36,0.69,0.21,0.25),(0,-0.56,0.79,0.13,0.15),(0,-0.72,0.87,0.155,0.145),(0,-0.82,0.845,0.12,0.11),(0,-0.88,0.815,0.09,0.075),(0,-0.915,0.8,0.058,0.05)]
E=[(i,i+1) for i in range(len(N)-1)]
tail=[(0,0.64,0.63,0.06,0.06),(0,0.9,0.46,0.048,0.048),(0.05,1.15,0.3,0.042,0.042),(0.12,1.38,0.32,0.045,0.045),(0.16,1.5,0.42,0.05,0.05)]
i0=len(N);N.extend(tail);E.append((0,i0));E.extend([(i0+k,i0+k+1) for k in range(len(tail)-1)])
lpaws=[]
for s in (-1,1):
    fl=[(s*0.13,-0.37,0.58,0.09,0.1),(s*0.14,-0.34,0.36,0.07,0.075),(s*0.14,-0.38,0.12,0.052,0.052),(s*0.14,-0.44,0.045,0.065,0.045)]
    bl=[(s*0.13,0.42,0.6,0.15,0.17),(s*0.15,0.32,0.4,0.11,0.12),(s*0.145,0.48,0.2,0.065,0.065),(s*0.14,0.43,0.05,0.07,0.05)]
    for ri,pts in ((4,fl),(1,bl)):
        i0=len(N);N.extend(pts);E.append((ri,i0));E.extend([(i0+k,i0+k+1) for k in range(3)]);lpaws.append(pts[-1])
body=skin('lion',N,E,r,dec=0.38)
FUR=lin((0x9a,0x6a,0x3e));CREAM=lin((0xe6,0xd2,0xa6));DARKP=lin((0x2a,0x1c,0x14));SHADE=lin((0x7a,0x52,0x2e))
def lionpaint(c,n):
    t=mix(FUR,SHADE,max(0,noise.noise(c*9))*0.7)
    if n.z<-0.3 and c.z<0.7 and -0.5<c.y<0.6:t=mix(t,CREAM,0.8)                 # belly
    if c.y<-0.85 and c.z<0.83:t=mix(t,CREAM,0.9)                                 # muzzle and chin
    if c.y<-0.84 and c.z<0.78:t=mix(t,CREAM,1.0)
    if c.y>1.36:t=DARKP                                                          # tail tip
    if -0.9<c.y<-0.84 and 0.05<abs(c.x)<0.085 and 0.8<c.z<0.84:t=mix(t,DARKP,0.75)  # dark whisker pads
    if c.z<0.12:t=mix(t,SHADE,0.5)                                               # paws
    return t
paintfn(body,lionpaint)
patch('nosepad',body,(0,-0.915,0.815),(0,-1,0.5),0.03,0.022,M_('c_lnnose',(0xb0,0x70,0x6a),0.6),r,thick=0.012)
for s in (-1,1):
    eye2(f'eye{s}',body,(s*0.04,-0.8,0.9),(s*0.28,-1,0.12),0.025,r,(0xd8,0xb0,0x30),sink=0.5,slit=True)
    nostril(f'nost{s}',body,(s*0.012,-0.915,0.805),(s*0.2,-1,0.2),0.006,r)
    ep,en_=surf(body,(s*0.08,-0.7,0.95),(s*0.4,0.15,1))
    tip=ep+Vector((s*0.04,0.01,0.085))
    cone(f'ear{s}',ep-en_*0.012,tip,0.055,0.014,M_('c_lnear',(0x7a,0x52,0x2e),0.8),r,verts=8)                               # short, round-tipped cat ear
    cone(f'earin{s}',ep-en_*0.006+Vector((0,-0.018,0.004)),tip+Vector((0,-0.016,-0.018)),0.035,0.008,M_('c_lnearin',(0xe0,0xc8,0xa8),0.8),r,verts=8)
    cone(f'eartip{s}',tip-Vector((s*0.012,-0.004,0.03)),tip+Vector((0,0.004,0.006)),0.024,0.008,M_('c_lnear2',(0x2a,0x1c,0x14),0.8),r,verts=8)
    p,n=surf(body,(s*0.04,-0.8,0.9),(s*0.28,-1,0.12))
    rim=blob(f'rim{s}',p-n*0.006,(0.03,0.03,0.008),M_('c_lnrim',(0x2a,0x1c,0x14),0.6),r,seg=10,rings=5);rim.rotation_euler=n.to_track_quat('Z','Y').to_euler()   # dark eyeliner
    wp,wn=surf(body,(s*0.035,-0.9,0.8),(s*0.4,-1,-0.1))
    blob(f'wpad{s}',wp-wn*0.01,(0.035,0.03,0.028),M_('c_lnpad',(0xee,0xe0,0xc4),0.9),r,seg=10,rings=6)                   # puffy whisker pad
    for k in range(3):cyl(f'wdot{s}{k}',0.003,0.004,wp+wn*0.016+Vector((s*0.01*k,0,0.008-k*0.006)),M_('c_lnrim',(0x2a,0x1c,0x14),0.6),verts=5,bevel=0,parent=r)
for k,p in []:claws(f'claw{k}',(p[0],p[1]-0.05,0.02),(0,-1,-0.4),r,n=4,spread=0.024,L=0.025,r=0.007,m=M_('c_claw_l',(0xe0,0xd8,0xc8),0.5))
shot('Lion',elev=16,azim=-52,margin=1.12)

# ======================= VULTURE (theme #5: dark, red head, wings half-tucked) =======================
scene('Vulture');r=root('Vulture');Z=1.2
N=[(0,0.46,Z,0.09,0.02),(0,0.28,Z+0.01,0.12,0.08),(0,0.05,Z+0.02,0.16,0.12),(0,-0.17,Z+0.04,0.15,0.12),(0,-0.29,Z+0.07,0.05,0.05),(0,-0.35,Z+0.085,0.026,0.026),(0,-0.41,Z+0.095,0.047,0.044),(0,-0.46,Z+0.09,0.026,0.024),(0,-0.495,Z+0.08,0.015,0.017),(0,-0.51,Z+0.062,0.007,0.008)]
E=[(i,i+1) for i in range(len(N)-1)]
body=skin('vul',N,E,r,dec=0.45)
BLK=lin((0x24,0x20,0x1e));BRN=lin((0x3a,0x30,0x28));RED=lin((0x9a,0x26,0x22));IVORY=lin((0xe8,0xdc,0xb8));PINK=lin((0xc0,0x50,0x48))
def vulpaint(c,n):
    if c.y<-0.455:return IVORY
    if c.y<-0.33:return mix(RED,PINK,max(0,noise.noise(c*60)))
    return mix(BLK,BRN,max(0,noise.noise(c*14))*0.8)
paintfn(body,vulpaint)
blob('ruff',(0,-0.26,Z+0.06),(0.095,0.07,0.085),M_('c_vruff',(0x2e,0x28,0x24),0.95),r,seg=10,rings=6,jit=0.15,seed=3)
for s in (-1,1):
    eye2(f'eye{s}',body,(s*0.025,-0.42,Z+0.1),(s,-0.3,0.25),0.009,r,(0x4a,0x18,0x12),sink=0.5)
    nostril(f'nost{s}',body,(s*0.008,-0.47,Z+0.095),(s,-0.2,0.4),0.004,r)
# a feathered wing: arm bones (shoulder-elbow-wrist-hand) swept back for the half-tucked dive, feathers along it
FEAT=M_('c_vfeat',(0x1e,0x1c,0x1a),0.85);UNDER=M_('c_vfeat_u',(0x8a,0x86,0x80),0.7);COVERT=M_('c_vcov',(0x30,0x28,0x22),0.9)
def feather(name,base,dirv,L,W,m,parent,roll=0.0):
    d=Vector(dirv).normalized();o=box(name,(W,L,0.008),Vector(base)+d*(L/2),m,bevel=0.003,parent=parent)
    o.rotation_euler=d.to_track_quat('Y','Z').to_euler();o.rotation_euler.rotate_axis('Y',roll)
    for v in o.data.vertices:v.co.x*=0.55+0.45*(0.5-v.co.y/L)   # taper toward the tip
    return o
for s in (-1,1):
    arm=[(s*0.1,-0.08,Z+0.07),(s*0.38,0.02,Z+0.14),(s*0.62,0.14,Z+0.13),(s*0.8,0.3,Z+0.1)]
    for k,(a,b) in enumerate(zip(arm,arm[1:])):
        cone(f'arm{s}{k}',a,b,0.045-k*0.01,0.035-k*0.01,COVERT,r,verts=7)
    for k in range(10):   # secondaries along the forearm, pointing back
        t=k/9;base=Vector(arm[0]).lerp(Vector(arm[2]),t)
        feather(f'sec{s}{k}',base+Vector((0,0.02,0.0)),(s*0.08,1,-0.05),0.3-0.04*t,0.11,FEAT,r,roll=s*0.1)
        feather(f'secu{s}{k}',base+Vector((0,0.03,-0.012)),(s*0.08,1,-0.05),0.27-0.04*t,0.1,UNDER,r,roll=s*0.1)
    for k in range(7):    # primaries fan from the hand, splayed "fingers"
        a=0.25+k*0.13;base=Vector(arm[2]).lerp(Vector(arm[3]),min(1,k/5))
        feather(f'pri{s}{k}',base,(s*math.cos(a)*0.8,math.sin(a)+0.5,-0.08),0.36+0.02*k,0.075,FEAT,r,roll=s*0.15)
        feather(f'priu{s}{k}',base+Vector((0,0.01,-0.012)),(s*math.cos(a)*0.8,math.sin(a)+0.5,-0.08),0.32+0.02*k,0.065,UNDER,r,roll=s*0.15)
    for k in range(6):    # covert feathers over the joints, so the wing reads as one surface
        t=k/5;base=Vector(arm[0]).lerp(Vector(arm[3]),t);feather(f'cov{s}{k}',base+Vector((0,0,0.015)),(s*0.1,1,0),0.17,0.14,COVERT,r)
for k in range(9):feather(f'tail{k}',(0,0.36,Z-0.01),((k-4)*0.09,1,0),0.26,0.07,FEAT,r)
for s in (-1,1):limb(f'leg{s}',[(s*0.05,0.12,Z-0.06),(s*0.06,0.26,Z-0.1),(s*0.06,0.36,Z-0.1)],0.018,M_('c_vfoot',(0xc8,0xb8,0xa8),0.7),r)
shot('Vulture',elev=48,azim=-25,margin=1.1)
bpy.context.window.scene=bpy.data.scenes['Camper'];bpy.ops.wm.save_mainfile()
