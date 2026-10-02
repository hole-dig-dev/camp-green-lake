# blend: gear.blend
# The clear backsack (JT 2026-10-01): a possible later stand-in for the bucket, behind the F2 flag gear.backsack.
# Three tiers, comically large (JT: "make them comically large on the backs of people"): 5, 10 and 20 holes of sand.
#   Backsack1..3       the pack: canvas frame and edges, clear panels, a top flap with a buckle, shoulder straps.
#                      Tier 2 adds side pockets and a bedroll; tier 3 is a towering expedition pack on a pole frame,
#                      with a rolled tarp, a dangling pot and a lantern. Origin at the bottom of the side that sits
#                      against your back; up +Z, out from your back -Y (public/js/86-backsack.js turns it to fit).
#   BacksackSand1..3   the sand inside, full: the game scales it up from the bottom as it fills (origin at its bottom)
# Built in background Blender (another session may hold the live one):
#   ~/blender/blender -b art/blender/gear.blend --python art/blender/backsack.py
import bpy,os,math,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'backsack.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
OUT=os.path.join(ART,'glb')
def M_(n,c,r=0.9,m=0.0):return ('k_'+n,c,r,m)
def B(n,size,loc,m,rot=(0,0,0),bv=0.006):return box(n,size,loc,m,rot=rot,bevel=bv)
CANVAS=M_('canvas',(0x8a,0x7a,0x55),0.95);LEATHER=M_('leather',(0x5a,0x3a,0x22),0.7);BRASS=M_('brass',(0xb8,0x8a,0x3a),0.4,0.6)
SAND=M_('sand',(0xc9,0xa8,0x72),0.97);CLEAR=M_('clear',(0xdc,0xe6,0xe8),0.15,0)
BEDROLL=M_('bedroll',(0x4f,0x6b,0x45),0.95);TARP=M_('tarp',(0x7d,0x5c,0x3c),0.95);TIN=M_('tin',(0x8c,0x90,0x94),0.45,0.7)
POLE=M_('pole',(0x6b,0x4a,0x2a),0.8)
def glassify(o,alpha=0.22):
    m=o.data.materials[0];b=m.node_tree.nodes['Principled BSDF'];b.inputs['Alpha'].default_value=alpha
    try:m.surface_render_method='BLENDED'
    except Exception:m.blend_method='BLEND'
# outside size per tier: wide, deep (off your back), tall. A camper's back is ~0.46 m wide; tier 3 towers over the head.
TIERS={1:(0.5,0.28,0.72),2:(0.72,0.4,1.12),3:(0.98,0.56,1.72)}
def pack(t):
    W,D,H=TIERS[t];e=0.028*(1+0.35*(t-1));cy=-D/2
    scene(f'Backsack{t}');root(f'Backsack{t}')
    # the clear body: front, back and sides
    for nm,y in(('clear_front',-D+0.006),('clear_back',-0.006)):glassify(B(nm,(W-0.03,0.008,H-0.03),(0,y,H/2),CLEAR,bv=0))
    for s in(-1,1):glassify(B(f'clear_side{s}',(0.008,D-0.03,H-0.03),(s*(W/2-0.006),cy,H/2),CLEAR,bv=0))
    # the canvas frame: posts, top edges, a bottom; bigger packs get bands round the middle
    for s in(-1,1):
        for y in(-D+e/2,-e/2):B(f'post{s}{y:.2f}',(e,e,H),(s*(W/2-e/2),y,H/2),CANVAS)
        B(f'topedge{s}',(W,e,e),(0,-D+e/2 if s<0 else -e/2,H-e/2),CANVAS)
        B(f'sideedge{s}',(e,D,e),(s*(W/2-e/2),cy,H-e/2),CANVAS)
    B('bottom',(W,D,0.03+0.01*t),(0,cy,0.015+0.005*t),CANVAS)
    for k in range(1,t):   # bands: tier 2 one, tier 3 two
        z=H*k/t;B(f'bandF{k}',(W,0.012,e*0.8),(0,-D-0.003,z),CANVAS);B(f'bandB{k}',(W,0.012,e*0.8),(0,0.003,z),CANVAS)
        for s in(-1,1):B(f'bandS{k}{s}',(0.012,D,e*0.8),(s*(W/2+0.003),cy,z),CANVAS)
    # a top flap, buckled down at the front
    B('flap',(W+0.01,D+0.02,0.035*(1+0.3*t)),(0,cy,H+0.012),CANVAS,rot=(0.06,0,0))
    B('flapstrap',(0.05*(1+0.3*t),0.006,0.12*(1+0.3*t)),(0,-D-0.004,H-0.05*t),LEATHER)
    B('buckle',(0.055*(1+0.3*t),0.012,0.04*(1+0.3*t)),(0,-D-0.008,H-0.1*(1+0.3*t)),BRASS,bv=0.003)
    # shoulder straps on the side against your back (sized for the camper, whatever the pack), and a grab handle
    for s in(-1,1):
        B(f'strap{s}',(0.045,0.012,0.42),(s*0.09,0.01,0.25),LEATHER)
        B(f'strapcurl{s}',(0.045,0.07,0.012),(s*0.09,0.045,0.45),LEATHER)
    B('handle',(0.1+0.04*t,0.02,0.015),(0,0.0,H+0.04+0.01*t),LEATHER)
    if t>=2:   # side pockets (canvas) and a bedroll strapped across the top
        for s in(-1,1):B(f'pocket{s}',(0.09,D*0.6,H*0.28),(s*(W/2+0.045),cy,H*0.24),CANVAS,bv=0.012)
        cyl('bedroll',0.11+0.03*(t-2),W*1.1,(0,cy,H+0.13+0.03*(t-2)),BEDROLL,verts=14,rot=(0,math.pi/2,0))
        for s in(-1,1):B(f'bedstrap{s}',(0.035,D*0.75,0.03),(s*W*0.3,cy,H+0.24+0.06*(t-2)),LEATHER)
    if t>=3:   # the expedition frame: poles up the back corners past the top, a crossbar, a tarp roll, a pot and lantern
        for s in(-1,1):
            cyl(f'pole{s}',0.022,H+0.55,(s*(W/2+0.03),0.03,(H+0.55)/2),POLE,verts=8)
            cyl(f'polecap{s}',0.03,0.04,(s*(W/2+0.03),0.03,H+0.56),BRASS,verts=8)
        cyl('crossbar',0.02,W+0.1,(0,0.03,H+0.5),POLE,verts=8,rot=(0,math.pi/2,0))
        cyl('tarp',0.1,W*0.95,(0,cy,0.12),TARP,verts=12,rot=(0,math.pi/2,0))
        cyl('pot',0.1,0.12,(W/2+0.13,cy,H*0.62),TIN,verts=12)
        B('pothook',(0.012,0.012,0.14),(W/2+0.08,cy,H*0.62+0.12),TIN,bv=0)
        cyl('lantern',0.05,0.14,(-W/2-0.1,cy-0.05,H*0.7),BRASS,verts=8)
        cyl('lanternglass',0.04,0.09,(-W/2-0.1,cy-0.05,H*0.7),M_('lglass',(0xff,0xe0,0x90),0.2),verts=8)
    studio(elev=15,azim=-140,lens=50,floor=False);frame(margin=1.3);render(res=(500,500),samples=12)
    p=export_glb(os.path.join(OUT,f'Backsack{t}.glb'));print(f'Backsack{t}',p[1],p[2])
    # the sand inside, full (origin at its bottom): a lumpy top
    rnd=random.Random(2026+t);scene(f'BacksackSand{t}');root(f'BacksackSand{t}')
    bot=0.03+0.01*t;sh=H-bot-e*1.6
    B('sandbody',(W-2*e-0.01,D-2*e-0.01,sh),(0,cy,bot+sh/2),SAND,bv=0.01)
    for k in range(6+3*t):B(f'lump{k}',(0.06*t+rnd.random()*0.05*t,0.05*t+rnd.random()*0.04*t,0.025*t),((rnd.random()-0.5)*(W-2*e-0.08),cy+(rnd.random()-0.5)*(D-2*e-0.06),bot+sh),SAND,rot=(0,0,rnd.random()*3),bv=0.008)
    studio(elev=15,azim=-140,lens=50,floor=False);frame(margin=1.3);render(res=(400,400),samples=8)
    p=export_glb(os.path.join(OUT,f'BacksackSand{t}.glb'));print(f'BacksackSand{t}',p[1],p[2])
for t in(1,2,3):pack(t)
for n in('Backsack','BacksackSand'):   # the first single-size pack (superseded by the tiers)
    s=bpy.data.scenes.get(n)
    if s:bpy.data.scenes.remove(s)
bpy.ops.wm.save_mainfile()
