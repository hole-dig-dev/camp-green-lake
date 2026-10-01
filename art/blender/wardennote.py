# blend: props.blend
# WardenNote: a sheet of the Warden's notepaper left on her desk (public/js/89-town.js places it and makes it readable):
# where the old town lies under the lake, the X/Y the game's map readout shows, and how deep to dig. A rough sketch of
# the old street, the X marked. Drawn at 30 x 22 cm, then scaled up SCALE times so it reads from the desk (JT: three
# times bigger), flat, front edge toward Blender -Y (= game +z). Matches SIM.OLD_TOWN.
import bpy,os,math,random
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'wardennote.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
OUT=os.path.join(ART,'glb');rnd=random.Random(9)
PAPER=('wn_paper',(0xe6,0xd8,0xb0),0.95);INK=('wn_ink',(0x2a,0x22,0x3a),0.8);RED=('wn_red',(0x9a,0x22,0x18),0.8);STAIN=('wn_stain',(0xc8,0xa8,0x70),0.95)
SCALE=3
scene('WardenNote');r=root('WardenNote');W,D=0.30,0.22
box('paper',(W,D,0.002),(0,0,0.001),PAPER,bevel=0,parent=r)
box('coffee',(0.06,0.06,0.0005),(0.1,0.06,0.0024),STAIN,rot=(0,0,0.4),bevel=0,parent=r)   # a coffee ring
for k in range(3):box(f'fold{k}',(W,0.0015,0.0006),(0,-D/2+D*(k+1)/4,0.0023),STAIN,bevel=0,parent=r)
def t(n,s,x,y,size,m=INK):text(n,s,(x,y,0.0026),size,m,rot=(0,0,0),extrude=0.0004,parent=r)
t('t1','OLD TOWN',-0.06,0.075,0.022)
t('t2','X -230   Y 250',-0.06,0.035,0.02)
t('t3','DIG 5 FT. FLOOR GIVES.',-0.06,-0.0,0.012)
t('t4','DON\'T TELL MR. SIR',-0.06,-0.08,0.011)
# the sketch: the old street and its buildings, the X where to dig
box('street',(0.008,0.12,0.0005),(0.085,-0.01,0.0025),INK,bevel=0,parent=r)
for k in range(3):
    for s in (-1,1):box(f'bldg{k}{s}',(0.018,0.022,0.0005),(0.085+s*0.022,0.03-k*0.035,0.0025),INK,bevel=0,parent=r)
for a in (0.785,-0.785):box(f'x{a}',(0.03,0.004,0.0006),(0.085,-0.075,0.0027),RED,rot=(0,0,a),bevel=0,parent=r)
r.scale=(SCALE,SCALE,SCALE)   # the export bakes it in
studio(target=(0,0,0),elev=70,azim=0,lens=60,floor=False);frame(margin=1.15);render(res=(800,600),samples=16)
p=export_glb(os.path.join(OUT,'WardenNote.glb'));print('WardenNote',p[1],p[2])
bpy.ops.wm.save_mainfile()
