# Carried finds: the middle tier of loot, too big for the sack (public/js/45-state.js turns about 1 in 3 finds into
# one of these; more from deeper holes). Grabbed and hauled like the safe (84-grab.js), and they chip when dropped:
#   LootCrate   a slatted crate of spiced-peach jars in straw   ~30 kg, glass: chips easily
#   LootTools   a bundle of old tools roped together            ~28 kg, iron: hard to hurt
#   LootJug     a big stoneware jug of Sploosh                  ~18 kg, pottery: the most fragile
# Run inside Blender with the checkout's camp-green-lake-art.blend open:  python3 bx.py carryloot.py
# One scene per asset, origin on the ground at the middle, front facing -Y; exports to glb/Loot*.glb for public/models/.
import bpy,os,re,math
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'carryloot.py')   # so cgl_blender.py's ART/RENDERS point at this checkout
def src(f,stop=None):
    s=open(os.path.join(HERE,f)).read()
    if stop:s=s.split(stop)[0]
    return re.sub(r"open\('[^']*/([\w.]+)'\)\.read\(\)",lambda m:f"src('{m.group(1)}')",s)
exec(src('creatures.py','# ================== yellow'))   # toolkit (via finds.py): M_ materials, tube(), finish(), blob(), cone()
OUT=os.path.join(ART,'glb')
def glassy(o,a):
    m=o.data.materials[0];b=m.node_tree.nodes['Principled BSDF'];b.inputs['Alpha'].default_value=a
    try:m.surface_render_method='BLENDED'
    except Exception:m.blend_method='BLEND'
    return o
PLANK=M_('l_plank',(0x9a,0x74,0x48),0.9);PLANK2=M_('l_plank_dk',(0x7a,0x58,0x36),0.92);STRAW=M_('l_straw',(0xd8,0xb8,0x6a),0.95)
NAIL=M_('l_nail',(0x4a,0x44,0x3e),0.6,0.3);STENCIL=M_('l_stencil',(0x3a,0x2a,0x1c),0.9)
JAR=M_('l_jarglass',(0xc8,0xe0,0xd0),0.1);PEACH2=M_('l_peach',(0xe8,0x8a,0x2a),0.6);LID=M_('l_lid',(0xb0,0xb0,0xa8),0.45,0.5)

# ======================= LootCrate =======================
n='LootCrate';scene(n);r=root(n);W,D,H=0.58,0.4,0.3
box('floor',(W,D,0.02),(0,0,0.03),PLANK2,bevel=0.004,parent=r)
for s in (-1,1):   # four corner posts, slats on every side with gaps between
    for t in (-1,1):box(f'post{s}{t}',(0.04,0.04,H),(s*(W/2-0.02),t*(D/2-0.02),H/2+0.02),PLANK2,bevel=0.004,parent=r)
for k,z in enumerate((0.07,0.17,0.27)):
    for s in (-1,1):
        box(f'slatx{k}{s}',(W,0.018,0.06),(0,s*(D/2),z),PLANK,bevel=0.004,parent=r)
        box(f'slaty{k}{s}',(0.018,D,0.06),(s*(W/2),0,z),PLANK,bevel=0.004,parent=r)
for s in (-1,1):box(f'grip{s}',(0.02,0.14,0.035),(s*(W/2+0.011),0,0.24),PLANK2,bevel=0.003,parent=r)   # hand holds
for i,(x,z) in enumerate(((-0.1,0.17),(0.1,0.17))):box(f'stamp{i}',(0.07,0.004,0.035),(x,-D/2-0.011,z),STENCIL,bevel=0,parent=r)   # a burned-in stamp
for i in range(3):   # nail heads on the front slats
    for s in (-1,1):cyl(f'nail{i}{s}',0.005,0.004,(s*(W/2-0.03),-D/2-0.011,0.07+i*0.1),NAIL,verts=6,bevel=0,rot=(math.pi/2,0,0),parent=r)
box('straw',(W-0.05,D-0.05,0.07),(0,0,0.25),STRAW,bevel=0.02,parent=r)
for i in range(14):   # loose straw sticking up
    a=i*2.4;x=math.cos(a)*0.2*((i%3)/3+0.4);y=math.sin(a)*0.13*((i%4)/4+0.4)
    cone(f'wisp{i}',(x,y,0.28),(x+0.03*math.cos(a*3),y+0.02*math.sin(a*2),0.34),0.006,0.001,STRAW,r,verts=4)
for i,x in enumerate((-0.18,0,0.18)):   # six jars of peaches standing in the straw
    for j,y in enumerate((-0.08,0.08)):
        glassy(cyl(f'jar{i}{j}',0.055,0.14,(x,y,0.24),JAR,verts=14,bevel=0.006,parent=r),0.35)
        cyl(f'peach{i}{j}',0.05,0.1,(x,y,0.23),PEACH2,verts=12,bevel=0.01,parent=r)
        cyl(f'lid{i}{j}',0.047,0.02,(x,y,0.32),LID,verts=14,bevel=0.004,parent=r)
finish(n,elev=26,azim=-32,margin=1.2)
print(export_glb(os.path.join(OUT,n+'.glb')))

# ======================= LootTools =======================
IRONR=M_('l_iron',(0x5a,0x52,0x4a),0.6,0.3);RUSTL=M_('l_rust',(0x8a,0x4b,0x2a),0.9,0.1);HAND=M_('l_handle',(0x8a,0x62,0x3a),0.9)
ROPE=M_('l_rope',(0xc0,0xa0,0x6a),0.95);BRASS=M_('l_brass',(0xb0,0x8a,0x3a),0.4,0.4);GLS=M_('l_lampglass',(0xd8,0xe8,0xe0),0.1)
n='LootTools';scene(n);r=root(n)
# pickaxe lying along X, with a saw and a crowbar alongside, roped together in two places; a lantern tied on top
tube('pick_handle',(-0.5,0,0.05),(0.42,0,0.06),0.022,HAND,r)
tube('pick_head1',(0.4,-0.24,0.07),(0.4,0,0.07),0.02,IRONR,r);cone('pick_tip1',(0.4,-0.24,0.07),(0.37,-0.34,0.06),0.02,0.004,IRONR,r,verts=6)
tube('pick_head2',(0.4,0,0.07),(0.4,0.22,0.07),0.02,RUSTL,r);box('pick_adze',(0.02,0.05,0.07),(0.4,0.24,0.07),RUSTL,bevel=0.004,parent=r)
SAWS=M_('l_sawsteel',(0xb8,0xb8,0xb0),0.35,0.5)
box('saw_blade',(0.6,0.13,0.006),(-0.02,0.07,0.1),SAWS,bevel=0.002,parent=r);box('saw_handle',(0.13,0.11,0.035),(-0.38,0.07,0.1),HAND,bevel=0.01,parent=r)   # lying flat on top
for k in range(12):cone(f'tooth{k}',(-0.3+k*0.05,0.135,0.1),(-0.3+k*0.05+0.012,0.155,0.1),0.009,0.001,SAWS,r,verts=3)
tube('crowbar',(-0.46,-0.07,0.03),(0.3,-0.07,0.04),0.012,RUSTL,r);cone('crow_claw',(0.3,-0.07,0.04),(0.36,-0.07,0.09),0.012,0.004,RUSTL,r,verts=6)
for x in (-0.25,0.2):   # two rope lashings
    bpy.ops.mesh.primitive_torus_add(major_radius=0.1,minor_radius=0.011,major_segments=14,minor_segments=5,location=(x,0.01,0.07),rotation=(0,math.pi/2,0))
    o=bpy.context.active_object;o.name=f'lash{x}';o.scale=(1,1.2,0.8);_finish(o,ROPE,0,r)
# the lantern, lashed on top
cyl('lamp_base',0.05,0.03,(-0.05,0.0,0.16),BRASS,verts=10,bevel=0.004,parent=r)
glassy(cyl('lamp_glass',0.04,0.09,(-0.05,0.0,0.225),GLS,verts=10,bevel=0,parent=r),0.4)
cyl('lamp_top',0.045,0.03,(-0.05,0.0,0.285),BRASS,verts=10,r2=0.02,bevel=0.003,parent=r)
for s in (-1,1):tube(f'lamp_wire{s}',(-0.05+s*0.04,0,0.17),(-0.05+s*0.04,0,0.28),0.003,BRASS,r)
bpy.ops.mesh.primitive_torus_add(major_radius=0.035,minor_radius=0.004,major_segments=10,minor_segments=4,location=(-0.05,0,0.32),rotation=(math.pi/2,0,0));o=bpy.context.active_object;o.name='lamp_bail';_finish(o,BRASS,0,r)
finish(n,elev=30,azim=-28,margin=1.2)
print(export_glb(os.path.join(OUT,n+'.glb')))

# ======================= LootJug =======================
GLAZE=M_('l_glaze',(0xe6,0xd8,0xb4),0.5);CLAY=M_('l_clay',(0x8a,0x5a,0x34),0.8);CORKL=M_('l_cork',(0xb8,0x8a,0x58),0.95)
TAG=M_('l_tag',(0xe2,0xcc,0x98),0.95);INKL=M_('l_ink',(0x6a,0x1e,0x16),0.8)
n='LootJug';scene(n);r=root(n)
cyl('body_lo',0.16,0.16,(0,0,0.08),CLAY,verts=18,r2=0.17,bevel=0.01,parent=r)          # brown bottom half
cyl('body_hi',0.17,0.12,(0,0,0.22),GLAZE,verts=18,bevel=0,parent=r)                    # cream-glazed top half
cyl('shoulder',0.17,0.08,(0,0,0.32),GLAZE,verts=18,r2=0.06,bevel=0,parent=r)
cyl('neck',0.05,0.06,(0,0,0.39),GLAZE,verts=14,bevel=0.004,parent=r)
cyl('lip',0.058,0.015,(0,0,0.42),GLAZE,verts=14,bevel=0.004,parent=r)
cyl('cork',0.043,0.05,(0,0,0.445),CORKL,verts=12,r2=0.047,bevel=0.004,parent=r)
bpy.ops.mesh.primitive_torus_add(major_radius=0.075,minor_radius=0.017,major_segments=14,minor_segments=6,location=(0.1,0,0.35),rotation=(math.pi/2,0,0))
o=bpy.context.active_object;o.name='handle';o.scale=(0.9,1,1.2);_finish(o,GLAZE,0,r)
for k in range(3):   # "XXX" painted on the front: two crossed strokes each
    for a in (0.6,-0.6):box(f'xxx{k}{a}',(0.008,0.004,0.055),(-0.05+k*0.05,-0.171,0.22),INKL,bevel=0,rot=(0,a,0),parent=r)
box('tag',(0.07,0.004,0.05),(0.05,-0.075,0.36),TAG,bevel=0.002,rot=(0.3,0,0.4),parent=r);tube('twine',(0.0,-0.05,0.4),(0.05,-0.075,0.385),0.002,ROPE,r)
finish(n,elev=18,azim=-30,margin=1.3)
print(export_glb(os.path.join(OUT,n+'.glb')))
bpy.ops.wm.save_mainfile()
