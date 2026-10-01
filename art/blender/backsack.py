# blend: gear.blend
# The clear backsack (JT 2026-10-01, an alternative to the bucket, behind the F2 flag gear.backsack): a canvas-framed
# pack with clear front and back panels, worn on your back, so everyone can see the sand rise in it as you dig.
#   Backsack       the pack: canvas frame and edges, clear panels, a top flap with a buckle, shoulder straps. Origin at
#                  the bottom of the side that sits against your back; up +Z, out from your back -Y (game +z when worn
#                  facing -z... the game turns it to fit, public/js/45-state.js backsackLook)
#   BacksackSand   the sand inside, full: the game scales it up from the bottom as it fills (origin at its bottom)
# Built in background Blender (another session holds the live one):
#   ~/blender/blender -b art/blender/gear.blend --python art/blender/backsack.py
import bpy,os,math,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'backsack.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
OUT=os.path.join(ART,'glb');rnd=random.Random(2026)
def M_(n,c,r=0.9,m=0.0):return ('k_'+n,c,r,m)
def B(n,size,loc,m,rot=(0,0,0),p=None,bv=0.006):return box(n,size,loc,m,rot=rot,bevel=bv,parent=p)
CANVAS=M_('canvas',(0x8a,0x7a,0x55),0.95);LEATHER=M_('leather',(0x5a,0x3a,0x22),0.7);BRASS=M_('brass',(0xb8,0x8a,0x3a),0.4,0.6)
SAND=M_('sand',(0xc9,0xa8,0x72),0.97)
def glassify(o,alpha=0.22):
    m=o.data.materials[0];b=m.node_tree.nodes['Principled BSDF'];b.inputs['Alpha'].default_value=alpha
    try:m.surface_render_method='BLENDED'
    except Exception:m.blend_method='BLEND'
W,D,H=0.34,0.19,0.46   # outside: wide, deep (off your back), tall
scene('Backsack');r=root('Backsack')
cy=-D/2   # the pack's middle, out from your back
# the clear body: front and back panels, sides
for nm,y in(('clear_front',-D+0.006),('clear_back',-0.006)):
    o=B(nm,(W-0.03,0.008,H-0.03),(0,y,H/2),M_('clear',(0xdc,0xe6,0xe8),0.15,0),bv=0);glassify(o)
for s in(-1,1):o=B(f'clear_side{s}',(0.008,D-0.03,H-0.03),(s*(W/2-0.006),cy,H/2),M_('clear',(0xdc,0xe6,0xe8),0.15,0),bv=0);glassify(o)
# the canvas frame: edges all round, a bottom
for s in(-1,1):
    for y in(-D+0.012,-0.012):B(f'post{s}{y:.2f}',(0.028,0.028,H),(s*(W/2-0.012),y,H/2),CANVAS)
    B(f'topedge{s}',(W,0.028,0.028),(0,-D+0.012 if s<0 else -0.012,H-0.012),CANVAS)
    B(f'sideedge{s}',(0.028,D,0.028),(s*(W/2-0.012),cy,H-0.012),CANVAS)
B('bottom',(W,D,0.03),(0,cy,0.015),CANVAS)
# a top flap, buckled down at the front
B('flap',(W+0.01,D+0.02,0.035),(0,cy,H+0.012),CANVAS,rot=(0.06,0,0))
B('flapstrap',(0.05,0.006,0.12),(0,-D-0.004,H-0.04),LEATHER)
B('buckle',(0.055,0.012,0.04),(0,-D-0.008,H-0.1),BRASS,bv=0.003)
# the shoulder straps, on the side against your back, and a grab handle
for s in(-1,1):
    B(f'strap{s}',(0.045,0.012,H*0.9),(s*0.09,0.01,H*0.5),LEATHER,rot=(0,0,0))
    B(f'strapcurl{s}',(0.045,0.07,0.012),(s*0.09,0.045,H*0.95),LEATHER)
B('handle',(0.1,0.02,0.015),(0,0.0,H+0.04),LEATHER)
studio(elev=15,azim=-140,lens=50,floor=False);frame(margin=1.3);render(res=(500,500),samples=12)
p=export_glb(os.path.join(OUT,'Backsack.glb'));print('Backsack',p[1],p[2])
# the sand inside, full (origin at its bottom): lumpy top
scene('BacksackSand');r=root('BacksackSand')
B('sandbody',(W-0.045,D-0.045,H-0.075),(0,cy,(H-0.075)/2+0.03),SAND,bv=0.01)
for k in range(9):B(f'lump{k}',(0.06+rnd.random()*0.05,0.05+rnd.random()*0.04,0.025),((rnd.random()-0.5)*(W-0.1),cy+(rnd.random()-0.5)*(D-0.08),H-0.045),SAND,rot=(0,0,rnd.random()*3),bv=0.008)
studio(elev=15,azim=-140,lens=50,floor=False);frame(margin=1.3);render(res=(400,400),samples=8)
p=export_glb(os.path.join(OUT,'BacksackSand.glb'));print('BacksackSand',p[1],p[2])
bpy.ops.wm.save_mainfile()
