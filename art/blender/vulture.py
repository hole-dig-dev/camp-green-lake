# blend: creatures.blend
# The vulture: modelled, rigged, animated and exported in one go (moved here from beasts.py + rig.py so it can be
# rebuilt on its own without touching the other creatures).
# Run inside Blender with art/blender/creatures.blend open (bx.py opens it for you):  python3 bx.py vulture.py
# Writes the Vulture scene, glb/CreatureVulture.glb and renders/Vulture*.png; copy the GLB to public/models/.
#
# Legs (added for the carry): feathered thighs, bare shanks, three front toes and a hind toe with hooked talons,
# each part rigid on its own bone. The rest pose has the legs hanging straight down; the clips pose them:
#   Glide / Flap  legs tucked back under the tail, toes loosely curled (flying about)
#   Reach         legs thrust forward, toes spread (the dive, just before it grabs you)
#   Carry         legs down, toes clenched shut, wings beating hard (it has you)
# `gripR` is a non-deforming bone inside the right foot's clenched toes: the game pins the carried camper's hand to
# it (public/js/26-ragdoll.js via vTalonOf() in 83-vultures.js).
import bpy,os,re,math
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'vulture.py')   # so cgl_blender.py's ART/RENDERS point at this checkout
def src(f,stop=None):
    """A sibling build script's source, up to `stop`, with its exec(open('/any/path/x.py')) lines pointed at this folder."""
    s=open(os.path.join(HERE,f)).read()
    if stop:s=s.split(stop)[0]
    return re.sub(r"open\('[^']*/([\w.]+)'\)\.read\(\)",lambda m:f"src('{m.group(1)}')",s)
exec(src('beasts.py','# ======================= LIZARD'))                       # toolkit + skin(), paintfn(), eye2(), nostril()...
exec(src('rig.py','# ---------------- LIZARD').split('# run after beasts.py')[1].split('\n',1)[1])   # bake_and_join(), build_armature(), weight(), clip(), export_rig()
for a in list(bpy.data.actions):
    if a.name.startswith('Vulture_'):bpy.data.actions.remove(a)

# ======================= MODEL (theme #5: dark, red head, wings half-tucked) =======================
scene('Vulture');r=root('Vulture');Z=1.2
N=[(0,0.46,Z,0.09,0.02),(0,0.28,Z+0.01,0.12,0.08),(0,0.05,Z+0.02,0.16,0.12),(0,-0.17,Z+0.04,0.15,0.12),(0,-0.29,Z+0.07,0.05,0.05),(0,-0.35,Z+0.085,0.026,0.026),(0,-0.41,Z+0.095,0.047,0.044),(0,-0.46,Z+0.09,0.026,0.024),(0,-0.495,Z+0.08,0.015,0.017),(0,-0.51,Z+0.062,0.007,0.008)]
E=[(i,i+1) for i in range(len(N)-1)]
body=skin('vul',N,E,r,vox=0.008)
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
    ARMS[s]=arm
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

# ---- legs: hip -> knee (feathered "trousers") -> ankle (bare, scaly) -> toes + talons. Rest pose: hanging down. ----
SHANK=M_('c_vshank',(0xb8,0xa8,0x98),0.75);TOE=M_('c_vtoe',(0xa8,0x98,0x88),0.7);TALON=M_('c_vtalon',(0x1a,0x16,0x14),0.35)
LEGJ={}      # side -> {'hip','knee','ankle'} joint positions (the bones run between them)
RIGID={}     # part object name -> the bone it rides on (the whole part moves rigidly with it)
def part(o,bone):RIGID[o.name]=bone;return o
TOE_L=0.07;HALLUX_L=0.045
for s,sd in ((-1,'L'),(1,'R')):
    hip=Vector((s*0.055,0.07,Z-0.06));knee=Vector((s*0.065,0.075,Z-0.16));ank=Vector((s*0.065,0.06,Z-0.30))
    LEGJ[sd]={'hip':hip,'knee':knee,'ankle':ank}
    part(blob(f'thigh{sd}',(hip+knee)/2,(0.042,0.046,0.075),COVERT,r,seg=8,rings=6,jit=0.12,seed=11+s),f'leg{sd}0')   # shaggy feathered thigh
    part(cone(f'shank{sd}',knee,ank,0.017,0.014,SHANK,r,verts=7),f'leg{sd}1')
    for k in range(4):   # scutes: a few rings down the shank so it reads as scaly, not a stick
        t=0.2+k*0.2;part(cyl(f'scute{sd}{k}',0.0175-k*0.0008,0.012,knee.lerp(ank,t),SHANK,verts=7,bevel=0,parent=r),f'leg{sd}1')
    part(blob(f'ankle{sd}',ank,(0.02,0.02,0.018),SHANK,r,seg=7,rings=5),f'leg{sd}1')
    for k,a in enumerate((-28,0,28)):   # three front toes, fanned
        d=Vector((math.sin(math.radians(a)),-math.cos(math.radians(a)),-0.22)).normalized();tip=ank+d*TOE_L*(1.1 if a==0 else 1.0)
        part(cone(f'toe{sd}{k}',ank,tip,0.011,0.008,TOE,r,verts=6),f'toes{sd}')
        part(blob(f'pad{sd}{k}',ank.lerp(tip,0.55),(0.011,0.013,0.009),TOE,r,seg=6,rings=4),f'toes{sd}')
        hook=Vector((d.x*0.5,d.y*0.5,-1)).normalized()   # talons hook down off the toe tip
        part(cone(f'talon{sd}{k}',tip,tip+hook*0.032,0.008,0.001,TALON,r,verts=6),f'toes{sd}')
    d=Vector((0,1,-0.2)).normalized();tip=ank+d*HALLUX_L   # the hind toe (hallux), opposing the front three
    part(cone(f'hallux{sd}',ank,tip,0.011,0.008,TOE,r,verts=6),f'hall{sd}')
    part(cone(f'talonh{sd}',tip,tip+Vector((0,0.4,-1)).normalized()*0.03,0.008,0.001,TALON,r,verts=6),f'hall{sd}')
shot('Vulture',elev=20,azim=-60,margin=1.1)

# ======================= RIG =======================
# tag each leg part's vertices before the join, so they can be bound rigidly to their bone afterwards
for o in coll('Asset').all_objects:
    if o.name in RIGID:vg=o.vertex_groups.new(name='tag_'+RIGID[o.name]);vg.add(list(range(len(o.data.vertices))),1.0,'REPLACE')
b=bake_and_join('Vulture','vul');N,E=SKEL['vul']
extra=[]
for s,sd in ((-1,'L'),(1,'R')):
    a=ARMS[s];extra+=[(f'w{sd}0',a[0],a[1],'b3'),(f'w{sd}1',a[1],a[2],f'w{sd}0'),(f'w{sd}2',a[2],a[3],f'w{sd}1')]
    J=LEGJ[sd];ank=J['ankle']
    extra+=[(f'leg{sd}0',J['hip'],J['knee'],'root'),(f'leg{sd}1',J['knee'],ank,f'leg{sd}0'),
            (f'toes{sd}',ank,ank+Vector((0,-TOE_L,-0.015)),f'leg{sd}1'),(f'hall{sd}',ank,ank+Vector((0,HALLUX_L,-0.01)),f'leg{sd}1'),
            (f'grip{sd}',ank+Vector((0,-0.035,-0.05)),ank+Vector((0,-0.035,-0.08)),f'leg{sd}1')]   # where the clenched toes close
arm=build_armature('Vulture',N,E,2,extra)
for bn in arm.data.bones:
    if bn.name.startswith('grip'):bn.use_deform=False
tagged={}
for g in list(b.vertex_groups):
    if g.name.startswith('tag_'):
        for v in b.data.vertices:
            if any(e.group==g.index and e.weight>0.5 for e in v.groups):tagged[v.index]=g.name[4:]
        b.vertex_groups.remove(g)
LEGB=('leg','toes','hall','grip')
def vallow(n,p):
    if n.startswith(LEGB):return False
    if abs(p.x)>0.13:return n.startswith('wR' if p.x>0 else 'wL')
    return not n.startswith('w')
weight(b,arm,allow=vallow,power=3)
for g in list(b.vertex_groups):
    if g.name.startswith('grip'):b.vertex_groups.remove(g)
for vi,bone in tagged.items():   # leg parts: all their weight on their own bone
    for g in b.vertex_groups:g.remove([vi])
    b.vertex_groups[bone].add([vi],1.0,'REPLACE')

def legs(R,hip,knee,toes,hall,swing=0.0):
    """hip/knee: degrees about X (+ swings the foot back toward the tail, - forward); toes/hall: + curls them shut."""
    for sd,ph in (('L',0.0),('R',math.pi)):
        w=swing*S2(ph)
        R[f'leg{sd}0']=[(X,hip+w)];R[f'leg{sd}1']=[(X,knee)];R[f'toes{sd}']=[(X,toes)];R[f'hall{sd}']=[(X,-hall)]
    return R
def vpose(ph,flap):
    p=ph*TAU;R={}
    for s,sd in ((-1,'L'),(1,'R')):
        up=flap*S2(p) if flap else 3*S2(p)
        R[f'w{sd}0']=[(Zax,-s*12),(Y,-s*up)]
        R[f'w{sd}1']=[(Zax,-s*30),(Y,-s*up*0.5*(1 if not flap else math.cos(p-0.6)))]
        R[f'w{sd}2']=[(Zax,-s*28),(Y,-s*up*0.4)]
    R['b0']=[(X,4*S2(p))]
    return R
TUCK=dict(hip=78,knee=20,toes=45,hall=40)   # flying about: feet up under the tail feathers
clip(arm,'Glide',48,lambda ph:legs(vpose(ph,0),**TUCK),loc_fn=lambda ph:(0,0,0.02*S2(ph*TAU)))
clip(arm,'Flap',16,lambda ph:legs(vpose(ph,38),**TUCK),loc_fn=lambda ph:(0,0,-0.05*S2(ph*TAU)))
# the dive: wings half back, both feet thrown forward with the toes spread wide
clip(arm,'Reach',24,lambda ph:legs(vpose(ph,10),hip=-58,knee=-18,toes=-22,hall=-25,swing=4*S2(ph*TAU)),loc_fn=lambda ph:(0,0,0.01*S2(ph*TAU)))
# carrying: labouring wingbeats, feet down and clenched (the right one around the camper's hand), a little kick
def carry(ph):
    R=legs(vpose(ph,44),hip=-8,knee=4,toes=112,hall=105,swing=6*S2(ph*TAU))
    R['b0']=[(X,-6+4*S2(ph*TAU))]   # head tucked down, looking at what it's got
    return R
clip(arm,'Carry',14,carry,loc_fn=lambda ph:(0,0,-0.06*S2(ph*TAU)))
# move grip<side> to where the clenched Carry toes actually close: halfway between the front and hind toe tips,
# measured in the Carry pose and carried back into the shank's rest frame (the grip bone rides the shank)
sc=bpy.context.window.scene;ad=arm.animation_data
for tr in ad.nla_tracks:tr.mute=True
ad.action=bpy.data.actions['Vulture_Carry'];sc.frame_set(1);bpy.context.view_layer.update()
GRIP={}
for sd in 'LR':
    pb=arm.pose.bones;sh=pb[f'leg{sd}1'];tip=(pb[f'toes{sd}'].tail+pb[f'hall{sd}'].tail)/2
    GRIP[sd]=sh.bone.matrix_local@sh.matrix.inverted()@tip
ad.action=None
for tr in ad.nla_tracks:tr.mute=False
bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
for sd,g in GRIP.items():eb=arm.data.edit_bones[f'grip{sd}'];eb.head=g;eb.tail=g+Vector((0,0,-0.03))
bpy.ops.object.mode_set(mode='OBJECT')
print('vulture exported',export_rig('Vulture',os.path.join(ART,'glb','CreatureVulture.glb')))

# preview renders of each clip, side-on, for checking the legs (renders/Vulture_<clip>.png)
sc=bpy.context.window.scene;ad=arm.animation_data
for tr in ad.nla_tracks:tr.mute=True
for nm in ('Glide','Reach','Carry'):
    ad.action=bpy.data.actions['Vulture_'+nm];sc.frame_set(3)
    cam=sc.camera;cam.location=Vector((1.9,-0.35,Z-0.05));cam.rotation_euler=(Vector((0,0,Z-0.1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=50
    render('Vulture_'+nm,res=(512,512),samples=24)
ad.action=None
for tr in ad.nla_tracks:tr.mute=False
bpy.ops.wm.save_mainfile()
