# blend: gear.blend
# Landmines (JT 2026-10-01: "randomly spawning landmines that are hard to see unless you're really close, that throw you
# comically far (and NPCs)"). public/js/88-mines.js puts them on the lakebed and fades them in only when you're close.
#   Landmine   a squat dusty-olive pressure mine, mostly buried: only the lid, the pressure plate and the prong show
#              above a ring of loose sand. Origin on the ground at its centre.
# Built in background Blender:  ~/blender/blender -b art/blender/gear.blend --python art/blender/landmine.py
import bpy,os,math,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'landmine.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
OUT=os.path.join(ART,'glb');rnd=random.Random(77)
def M_(n,c,r=0.9,m=0.0):return ('m_'+n,c,r,m)
OLIVE=M_('olive',(0x7a,0x74,0x52),0.85,0.2);DARK=M_('dark',(0x4a,0x46,0x36),0.7,0.4);SAND=M_('sand',(0xc9,0xa8,0x72),0.97)
scene('Landmine');root('Landmine')
cyl('body',0.15,0.08,(0,0,-0.015),OLIVE,verts=16,bevel=0.01)                 # mostly below the ground
cyl('lid',0.13,0.02,(0,0,0.03),OLIVE,verts=16,r2=0.11,bevel=0.004)
cyl('plate',0.06,0.018,(0,0,0.045),DARK,verts=12,bevel=0.003)
cyl('prong',0.008,0.05,(0,0,0.075),DARK,verts=6,bevel=0)
cyl('ring',0.024,0.012,(0.07,0.03,0.042),DARK,verts=8,rot=(math.pi/2,0,0.4),bevel=0)   # the safety pin's ring (nobody pulled it back in)
for k in range(10):   # loose sand kicked over its edge
    a=k/10*math.tau+rnd.random()*0.4;d=0.14+rnd.random()*0.05
    box(f'sand{k}',(0.07+rnd.random()*0.05,0.05+rnd.random()*0.04,0.02+rnd.random()*0.02),(math.cos(a)*d,math.sin(a)*d,0.01),SAND,rot=(0,0,a),bevel=0.008)
studio(elev=35,azim=-40,lens=60,floor=False);frame(margin=1.5);render(res=(400,400),samples=10)
p=export_glb(os.path.join(OUT,'Landmine.glb'));print('Landmine',p[1],p[2])
bpy.ops.wm.save_mainfile()
