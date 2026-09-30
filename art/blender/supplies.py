# blend: props.blend
# Wreck Room supplies ported from Greg's branch: Sam's onion tonic, the first-aid kit and the walkie-talkie.
# Modelled to match their painted store icons (public/icons/gear/{tonic,medkit,walkie}.png; the raw sheet is
# docs/art/supplies-icons-chatgpt-sheet.png). One scene per asset, exported to glb/Supply*.glb for public/models/.
# Run inside Blender with art/blender/props.blend open (bx.py opens it for you):  python3 bx.py supplies.py
#
# Real-world sizes, origin on the ground under the middle (like every asset), front facing Blender -Y (= +Z in the
# game). Each is modelled around its grip point and then stood on the floor; GRIP is how far above the origin the
# hand holds it (public/js/86-walkie.js uses the same numbers):
#   SupplyWalkie  12 cm radio + 7 cm antenna; grip: the middle of the body, 5.9 cm up
#   SupplyTonic   11 cm corked medicine bottle; grip: the middle of the bottle, 5.5 cm up
#   SupplyMedkit  24 x 15 x 12 cm tin box; grip: the middle of the handle, 15.5 cm up (carried by it)
GRIP={'SupplyWalkie':0.059,'SupplyTonic':0.055,'SupplyMedkit':0.155}
import bpy,os,re
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'supplies.py')   # so cgl_blender.py's ART/RENDERS point at this checkout
def src(f,stop=None):
    s=open(os.path.join(HERE,f)).read()
    if stop:s=s.split(stop)[0]
    return re.sub(r"open\('[^']*/([\w.]+)'\)\.read\(\)",lambda m:f"src('{m.group(1)}')",s)
exec(src('creatures.py','# ================== yellow'))   # toolkit (via finds.py), M_ materials, tube(), finish(), blob(), cone()

OUT=os.path.join(ART,'glb')

# ======================= walkie-talkie: a chunky 1990s handheld, dark grey-black, red talk button =======================
PLAS=M_('s_radio',(0x3a,0x38,0x36),0.7);PLAS2=M_('s_radio_dk',(0x24,0x22,0x21),0.75);RUBBER=M_('s_rubber',(0x1c,0x1b,0x1a),0.95)
RADRED=M_('s_radio_red',(0xc0,0x3a,0x2a),0.5);LED=M_('s_led',(0xff,0x40,0x30),0.3);SCUFF=M_('s_scuff',(0x6e,0x5a,0x44),0.9)
n='SupplyWalkie';scene(n);r=root(n)
W,D,H=0.062,0.036,0.118
box('body',(W,D,H),(0,0,0),PLAS,bevel=0.008,parent=r)
box('back',(W-0.006,0.008,H-0.012),(0,D/2+0.002,-0.004),PLAS2,bevel=0.003,parent=r)              # battery door
box('grille',(W-0.016,0.004,0.05),(0,-D/2-0.001,0.022),PLAS2,bevel=0.002,parent=r)               # speaker panel
for k in range(5):box(f'slot{k}',(W-0.026,0.003,0.004),(0,-D/2-0.003,0.04-k*0.009),RUBBER,bevel=0,parent=r)
box('panel',(W-0.016,0.003,0.034),(0,-D/2-0.001,-0.034),PLAS2,bevel=0.002,parent=r)                # lower face plate
for i,(x,z) in enumerate(((-0.018,-0.052),(0.018,-0.052),(-0.018,0.052),(0.02,-0.018))):          # screws + a scuff
    cyl(f'screw{i}',0.0022,0.002,(x,-D/2-0.003,z),IRON,verts=6,bevel=0,rot=(math.pi/2,0,0),parent=r)
box('scuff',(0.012,0.002,0.008),(0.012,-D/2-0.0035,-0.04),SCUFF,bevel=0,parent=r)
cyl('led',0.004,0.004,(-0.017,-D/2-0.003,0.05),LED,verts=8,bevel=0,rot=(math.pi/2,0,0),parent=r)  # the little red light
box('ptt',(0.008,0.02,0.034),(-W/2-0.003,0,0.012),RADRED,bevel=0.003,parent=r)                    # push-to-talk on the left side
for k in range(3):box(f'rib{k}',(0.005,0.014,0.004),(-W/2-0.002,0,-0.02-k*0.008),RUBBER,bevel=0,parent=r)
# top: stubby rubber antenna (left), two knobs (volume, channel)
cyl('ant_base',0.008,0.014,(-0.017,0,H/2+0.007),RUBBER,verts=10,bevel=0.002,parent=r)
cyl('antenna',0.0065,0.07,(-0.017,0,H/2+0.049),RUBBER,verts=10,r2=0.0045,bevel=0.002,parent=r)
cyl('ant_tip',0.0048,0.006,(-0.017,0,H/2+0.087),RUBBER,verts=10,bevel=0.002,parent=r)
cyl('knob1',0.0075,0.014,(0.004,0,H/2+0.007),PLAS2,verts=10,bevel=0.002,parent=r)
cyl('knob2',0.0055,0.01,(0.02,0,H/2+0.005),PLAS2,verts=10,bevel=0.002,parent=r)
r.location.z=GRIP[n];bpy.context.view_layer.update();finish(n,elev=12,azim=-32,margin=1.3)
print(export_glb(os.path.join(OUT,n+'.glb')))

# ======================= Sam's onion tonic: corked amber bottle, paper label with an onion on it =======================
AMBER=M_('s_amber',(0xb0,0x62,0x1c),0.15);TONIC=M_('s_tonic',(0x9a,0x4a,0x12),0.2);CORK=M_('s_cork',(0xb8,0x8a,0x58),0.95)
PAPER=M_('s_paper',(0xe2,0xcc,0x98),0.95);ONI=M_('s_onion',(0xf0,0xe2,0xc4),0.7);ONI2=M_('s_onion_sk',(0xc8,0x98,0x5a),0.8);SPROUT=M_('s_sprout',(0x6a,0x9a,0x3a),0.8)
n='SupplyTonic';scene(n);r=root(n);Z0=-0.055   # bottle bottom (origin mid-bottle)
def glassy(o,a):   # see-through amber (same trick as the finds' jars)
    m=o.data.materials[0];b=m.node_tree.nodes['Principled BSDF'];b.inputs['Alpha'].default_value=a
    try:m.surface_render_method='BLENDED'
    except Exception:m.blend_method='BLEND'
glassy(cyl('glass',0.033,0.066,(0,0,Z0+0.033),AMBER,verts=18,bevel=0.005,parent=r),0.55)
glassy(cyl('shoulder',0.031,0.02,(0,0,Z0+0.076),AMBER,verts=18,r2=0.013,bevel=0,parent=r),0.55)
glassy(cyl('neck',0.012,0.014,(0,0,Z0+0.093),AMBER,verts=14,bevel=0,parent=r),0.55)
glassy(cyl('lip',0.0145,0.005,(0,0,Z0+0.1),AMBER,verts=14,bevel=0.0015,parent=r),0.55)
glassy(cyl('liquid',0.03,0.056,(0,0,Z0+0.032),TONIC,verts=18,bevel=0,parent=r),0.85)
cyl('cork',0.0115,0.022,(0,0,Z0+0.104),CORK,verts=12,r2=0.0125,bevel=0.002,parent=r)
cyl('label',0.0338,0.04,(0,0,Z0+0.033),PAPER,verts=18,bevel=0,parent=r)
# the onion drawing on the label front (-Y): a flattened bulb, its papery skin, a sprout and roots
blob('lab_onion',(0,-0.0335,Z0+0.03),(0.009,0.002,0.0095),ONI,r,seg=10,rings=6)
blob('lab_skin',(0.003,-0.0338,Z0+0.028),(0.004,0.0012,0.007),ONI2,r,seg=8,rings=5)
cone('lab_sprout',(0,-0.0336,Z0+0.038),(0.002,-0.0336,Z0+0.05),0.0022,0.0006,SPROUT,r,verts=5)
cone('lab_sprout2',(0,-0.0336,Z0+0.038),(-0.004,-0.0336,Z0+0.047),0.0018,0.0005,SPROUT,r,verts=5)
for k in range(3):cone(f'lab_root{k}',(0,-0.0336,Z0+0.021),((k-1)*0.004,-0.0336,Z0+0.016),0.0008,0.0003,ONI2,r,verts=4)
r.location.z=GRIP[n];bpy.context.view_layer.update();finish(n,elev=12,azim=-30,margin=1.4)
print(export_glb(os.path.join(OUT,n+'.glb')))

# ======================= first-aid kit: dented olive tin, cream square with a red cross, latch, handle =======================
OLIVE=M_('s_olive',(0x6a,0x7a,0x44),0.75);OLIVE2=M_('s_olive_dk',(0x55,0x63,0x36),0.8);CREAM=M_('s_cream',(0xe8,0xdc,0xb8),0.9)
CROSS=M_('s_cross',(0xc0,0x38,0x2a),0.7);RUSTP=M_('s_rustspot',(0x8a,0x5a,0x30),0.95);STEEL=M_('s_handle',(0x6e,0x6a,0x62),0.5,0.4)
n='SupplyMedkit';scene(n);r=root(n)
BW,BD,BH=0.24,0.15,0.12;TOP=-0.035          # box top sits 3.5 cm under the origin (the handle's middle)
box('base',(BW,BD,BH*0.66),(0,0,TOP-BH+BH*0.33),OLIVE,bevel=0.012,parent=r)
box('lid',(BW+0.006,BD+0.006,BH*0.36),(0,0,TOP-BH*0.18),OLIVE,bevel=0.014,parent=r)
box('seam',(BW+0.008,BD+0.008,0.006),(0,0,TOP-BH*0.36),OLIVE2,bevel=0.002,parent=r)                  # the lid's lip
box('patch',(0.1,0.075,0.004),(0,-0.004,TOP+0.001),CREAM,bevel=0.004,parent=r)                       # cross on the lid's top
box('cross_a',(0.056,0.017,0.003),(0,-0.004,TOP+0.004),CROSS,bevel=0,parent=r)
box('cross_b',(0.017,0.052,0.003),(0,-0.004,TOP+0.004),CROSS,bevel=0,parent=r)
box('latch',(0.036,0.008,0.05),(0,-BD/2-0.006,TOP-BH*0.36),STEEL,bevel=0.003,parent=r)                # front latch over the seam
box('latch_eye',(0.014,0.006,0.014),(0,-BD/2-0.011,TOP-BH*0.42),IRON,bevel=0.002,parent=r)
for s in (-1,1):                                                                                       # handle: two lugs and a bar
    box(f'lug{s}',(0.014,0.02,0.012),(s*0.05,0,TOP+0.004),STEEL,bevel=0.003,parent=r)
    tube(f'post{s}',(s*0.05,0,TOP+0.008),(s*0.045,0,TOP+0.035),0.0045,STEEL,r)
tube('bar',(-0.045,0,0.0),(0.045,0,0.0),0.0055,STEEL,r)
for i,(x,y,z,s) in enumerate(((0.1,-0.076,-0.12,0.02),(0.06,0.077,-0.14,0.018),(-0.08,-0.077,-0.13,0.014))):   # chipped paint / rust
    box(f'rust{i}',(s,0.003 if abs(y)>0.07 else s*0.8,s*0.7),(x,y if abs(y)<0.07 else y-0.001*(1 if y<0 else -1),z),RUSTP,bevel=0,parent=r)
r.location.z=GRIP[n];bpy.context.view_layer.update();finish(n,elev=24,azim=-30,margin=1.25)
print(export_glb(os.path.join(OUT,n+'.glb')))
bpy.ops.wm.save_mainfile()
