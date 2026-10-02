# blend: gear.blend
# The sand pipeline (JT 2026-10-01): build a pipe out from the sifter into the lake; dump your bucket at its far end and
# the sand rides down the pipe to the sifter (public/js/88-pipeline.js). It can't be destroyed, but rocks, sinkholes
# and mines crack it; hold F on the crack to fix it.
#   PipeSection  1 m of clear pipe along +X, its axis 0.24 m up (the game stretches it to each 5 m run and tilts it)
#   PipeJoint    at every node: a bolted flange collar on a wooden saddle (origin on the ground)
#   PipeCrack    a split collar with a jagged gap and sand spilling out, laid over a broken run's middle (axis +X)
#   PipeSlug     a plug of sand riding inside the clear pipe (0.9 m, axis +X)
#   PipeIntake   the far end: a funnel hopper on legs with a SAND IN board; the pipe leaves its foot along -X
#   PipeRiser    in the sifter's own frame (art/blender/sifter.py): from the first node (X -1.9) up and over into the hopper
# Built in background Blender:  ~/blender/blender -b art/blender/gear.blend --python art/blender/pipe.py
import bpy,os,math,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'pipe.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
OUT=os.path.join(ART,'glb');rnd=random.Random(5)
def M_(n,c,r=0.9,m=0.0):return ('p_'+n,c,r,m)
def B(n,size,loc,m,rot=(0,0,0),bv=0.008):return box(n,size,loc,m,rot=rot,bevel=bv)
PIPE=M_('clearpipe',(0xdc,0xe6,0xe8),0.12,0);RUST=M_('rust',(0x8a,0x4a,0x28),0.8,0.3);IRON=M_('iron',(0x3a,0x3a,0x3c),0.6,0.6)
WOOD=M_('wood',(0x8a,0x68,0x46));WOOD2=M_('wood2',(0x66,0x4c,0x34));SAND=M_('sand',(0xc9,0xa8,0x72),0.97)
GALV=M_('galv',(0xa4,0xaa,0xae),0.45,0.75);INK=M_('ink',(0x22,0x1c,0x16),0.8);RED=M_('red',(0xb8,0x3a,0x2a),0.6)
R,AX=0.12,0.24
def glassify(o,alpha=0.25):
    m=o.data.materials[0];b=m.node_tree.nodes['Principled BSDF'];b.inputs['Alpha'].default_value=alpha
    try:m.surface_render_method='BLENDED'
    except Exception:m.blend_method='BLEND'
    return o
X90=(0,math.pi/2,0)
def view(res=(400,400)):studio(elev=22,azim=-40,lens=50,floor=False);frame(margin=1.3);render(res=res,samples=10)
def out(n):p=export_glb(os.path.join(OUT,n+'.glb'));print(n,p[1],p[2])
scene('PipeSection');root('PipeSection')
glassify(cyl('tube',R,1.0,(0.5,0,AX),PIPE,verts=14,rot=X90,bevel=0))   # clear (JT: "so you can see the sand move through")
view();out('PipeSection')
scene('PipeJoint');root('PipeJoint')
cyl('flange',R+0.045,0.08,(0,0,AX),IRON,verts=16,rot=X90,bevel=0.004)
for k in range(6):a=k/6*math.tau;cyl(f'bolt{k}',0.014,0.11,(0,math.cos(a)*(R+0.03),AX+math.sin(a)*(R+0.03)),RUST,verts=6,rot=X90,bevel=0)
B('saddle',(0.16,0.42,0.1),(0,0,0.05),WOOD2);B('saddletop',(0.14,0.34,0.04),(0,0,AX-R-0.02),WOOD)
view();out('PipeJoint')
scene('PipeCrack');root('PipeCrack')
for s in(-1,1):
    cyl(f'half{s}',R+0.012,0.34,(s*0.24,0,AX),RUST,verts=14,rot=X90,bevel=0)
    for k in range(5):B(f'shard{s}{k}',(0.06,0.04,0.05),(s*0.07,math.cos(k*1.3)*(R+0.01),AX+math.sin(k*1.3)*(R+0.01)),RUST,rot=(k,0.5*s,k*0.7),bv=0)
B('gapsand',(0.1,0.18,0.14),(0,0,AX-0.04),SAND,bv=0.03)
for k in range(7):a=rnd.random()*math.tau;d=0.12+rnd.random()*0.35;B(f'spill{k}',(0.12+rnd.random()*0.1,0.1+rnd.random()*0.1,0.05),(math.cos(a)*d*0.6,math.sin(a)*d,0.025),SAND,rot=(0,0,a),bv=0.015)
B('tape',(0.05,0.008,0.2),(0.12,R+0.015,AX),M_('tape',(0xd8,0xc0,0x40),0.7),rot=(0.4,0,0),bv=0)   # warning-yellow tag so it reads from afar
view();out('PipeCrack')
scene('PipeSlug');root('PipeSlug')
cyl('slug',R-0.025,0.9,(0,0,AX-0.012),SAND,verts=12,rot=X90,bevel=0.04)   # inside the clear pipe
view();out('PipeSlug')
scene('PipeIntake');root('PipeIntake')
TOP,BOT=1.25,0.55
cyl('funnel',0.6,TOP-BOT,(0,0,(TOP+BOT)/2),GALV,verts=4,rot=(0,0,math.pi/4),r2=0.2,bevel=0.004)   # upside-down: wide at the top
o=bpy.context.active_object;o.rotation_euler=(math.pi,0,math.pi/4)
cyl('rim',0.62,0.05,(0,0,TOP),IRON,verts=4,rot=(0,0,math.pi/4),bevel=0.004)
for k in range(5):B(f'grate{k}',(0.82,0.02,0.02),(0,-0.32+k*0.16,TOP+0.03),IRON,bv=0)
glassify(cyl('neck',R+0.02,BOT-AX+0.05,(0,0,(BOT+AX)/2),PIPE,verts=14,bevel=0))
cyl('elbow',R+0.03,0.3,(-0.15,0,AX),IRON,verts=14,rot=X90,bevel=0)
for s in(-1,1):
    for t in(-1,1):B(f'leg{s}{t}',(0.07,0.07,TOP+0.05),(s*0.38,t*0.38,(TOP+0.05)/2),WOOD2)
    B(f'brace{s}',(0.8,0.04,0.06),(0,s*0.38,0.5),WOOD)
B('sign',(0.6,0.03,0.26),(0.4,0,TOP+0.25),WOOD,rot=(0,0,math.pi/2))
text('signtxt','SAND IN',(0.418,0,TOP+0.26),0.11,INK,rot=(math.pi/2,0,math.pi/2))
B('signpost',(0.05,0.05,0.6),(0.42,0,TOP-0.05),WOOD2)
view((500,500));out('PipeIntake')
scene('PipeRiser');root('PipeRiser')
X0,HX,HTOP=-1.9,-0.85,2.15
glassify(cyl('up',R,HTOP-AX,(X0,0,(AX+HTOP)/2),PIPE,verts=14,bevel=0))
cyl('elbowball',R+0.03,0.2,(X0,0,HTOP),IRON,verts=14,rot=X90,bevel=0.01)
glassify(cyl('over',R,HX-X0,((X0+HX)/2,0,HTOP),PIPE,verts=14,rot=X90,bevel=0))
cyl('spout',R+0.02,0.25,(HX,0,HTOP-0.12),IRON,verts=14,bevel=0.004)
B('stay',(0.05,0.05,HTOP),(X0-0.18,0,HTOP/2),WOOD2);B('stayclamp',(0.22,0.08,0.06),(X0-0.08,0,HTOP-0.4),IRON)
view((500,500));out('PipeRiser')
bpy.ops.wm.save_mainfile()
