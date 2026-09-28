exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
rnd=random.Random(7)
def planks(prefix,w,h,n,y,zc,material='wood',parent=None,gap=0.018,depth=0.05):
    """A board of n horizontal planks, each a little off in shade and length, like weathered boards."""
    ph=(h-gap*(n-1))/n
    for i in range(n):
        z=zc-h/2+ph/2+i*(ph+gap);sh=rnd.uniform(-10,10)
        c=tuple(max(0,min(255,v+sh)) for v in PAL[material])
        box(f'{prefix}{i}',(w+rnd.uniform(-0.04,0.04),depth,ph),(rnd.uniform(-0.02,0.02),y,z),(f'{material}_{i%3}',c,0.9),bevel=0.01,parent=parent)

# ---------- SignCampEntrance: big painted board on two log posts, for outside the main gate ----------
scene('SignCampEntrance');r=root('SignCampEntrance')
for x in (-2.35,2.35):
    cyl(f'post{x}',0.13,4.4,(x,0,2.2),'wood_dark',verts=8,parent=r)
    cyl(f'postcap{x}',0.14,0.08,(x,0,4.42),'wood_dark',verts=8,r2=0.02,parent=r)
planks('board',4.5,1.5,4,-0.1,3.35,parent=r)
box('backing',(4.45,0.03,1.46),(0,-0.06,3.35),'wood_dark',bevel=0,parent=r)   # dark boards behind the plank gaps
box('trimtop',(4.7,0.09,0.1),(0,-0.11,4.14),'wood_dark',parent=r);box('trimbot',(4.7,0.09,0.1),(0,-0.11,2.56),'wood_dark',parent=r)
text('title','CAMP GREEN LAKE',(0,-0.14,3.52),0.62,('paint_white','paint_white',0.8),space=1.05,parent=r)
text('sub','JUVENILE CORRECTIONAL FACILITY',(0,-0.14,2.9),0.27,('paint_white','paint_white',0.8),space=1.1,parent=r)
for x in (-2.0,2.0):   # bolts
    for z in (2.72,3.98):cyl(f'bolt{x}{z}',0.03,0.03,(x,-0.13,z),('steel','steel',0.4,0.8),verts=6,rot=(math.pi/2,0,0),bevel=0,parent=r)
studio(elev=10,azim=-24,lens=45);frame();print('entrance tris',tris());render()

# ---------- SignWreckRoom: plank sign hung from a wall bracket by two chains ----------
scene('SignWreckRoom');r=root('SignWreckRoom')
box('wallplate',(0.12,0.04,0.3),(0,0.02,2.9),('steel','steel',0.5,0.7),parent=r)
box('bracket',(0.05,0.9,0.05),(0,-0.43,3.0),('steel','steel',0.5,0.7),parent=r)
box('brace',(0.04,0.55,0.04),(0,-0.25,2.85),('steel','steel',0.5,0.7),rot=(math.radians(-35),0,0),parent=r)
for y in (-0.18,-0.78):
    for k in range(3):cyl(f'chain{y}{k}',0.02,0.08,(0,y,2.93-k*0.09),('steel','steel',0.5,0.8),verts=6,bevel=0,rot=(0,0,0),r2=0.02,parent=r)
brd=box('board',(0.05,0.95,0.42),(0,-0.48,2.52),('wood_pale','wood_pale',0.9),bevel=0.015,parent=r)
for sx,rx in ((-0.03,-math.pi/2),(0.03,math.pi/2)):   # lettering on both faces
    text(f'txt{sx}','WRECK ROOM',(sx,-0.48,2.52),0.2,('ink','ink',0.8),rot=(math.pi/2,0,rx),parent=r)
studio(elev=12,azim=-65,lens=50,target=(0,-0.4,2.6));frame(margin=1.3);print('wreck tris',tris());render()

# ---------- SignLizardWarning: dented tin sign on a steel post ----------
scene('SignLizardWarning');r=root('SignLizardWarning')
cyl('post',0.04,2.3,(0,0.03,1.15),('steel','steel',0.5,0.7),verts=8,parent=r)
box('tin',(1.1,0.02,0.8),(0,-0.02,1.9),('paint_white','paint_white',0.7,0.3),bevel=0.01,parent=r)
box('band',(1.1,0.024,0.24),(0,-0.021,2.18),('paint_red','paint_red',0.7,0.3),bevel=0,parent=r)
text('warn','WARNING',(0,-0.035,2.18),0.17,('paint_white','paint_white',0.8),parent=r)
text('l1','YELLOW-SPOTTED',(0,-0.035,1.96),0.15,('ink','ink',0.8),parent=r)
text('l2','LIZARDS',(0,-0.035,1.79),0.2,('ink','ink',0.8),parent=r)
text('l3','KEEP OUT AFTER DARK',(0,-0.035,1.62),0.1,('ink','ink',0.8),parent=r)
for x in (-0.5,0.5):
    for z in (1.55,2.25):cyl(f'rivet{x}{z}',0.015,0.02,(x,-0.035,z),('rust','rust',0.8,0.4),verts=6,rot=(math.pi/2,0,0),bevel=0,parent=r)
studio(elev=8,azim=-22,lens=50);frame(margin=1.2);print('warn tris',tris());render()

# ---------- SignDirections: a post with pointing arrow boards ----------
scene('SignDirections');r=root('SignDirections')
cyl('post',0.07,3.0,(0,0,1.5),'wood_dark',verts=8,parent=r)
cyl('cap',0.075,0.1,(0,0,3.03),'wood_dark',verts=8,r2=0.02,parent=r)
arrows=[('MESS HALL',35,2.65,'wood_pale'),('WRECK ROOM',-20,2.3,'wood'),('D TENT',160,1.95,'wood_pale'),('THE LAKE',-150,1.6,'wood')]
for label,ang,z,m in arrows:
    g=root('arrow_'+label.replace(' ','_'));g.parent=r;g.location=(0,0,z);g.rotation_euler=(0,0,math.radians(ang))
    L=0.2+0.105*len(label);box('board',(L,0.045,0.3),(L/2+0.02,0,0),(m,m,0.9),bevel=0.01,parent=g)
    tip=cyl('tip',0.21,0.045,(L+0.02,0,0),(m,m,0.9),verts=3,rot=(math.pi/2,0,0),bevel=0.008,parent=g);tip.rotation_euler=(math.pi/2,0,0);tip.scale=(0.9,1,1)
    for side,ry in ((-0.03,0),(0.03,math.pi)):
        text('t',label,(L/2+0.02,side,0),0.19,('ink','ink',0.8),rot=(math.pi/2,0,ry),parent=g)
studio(elev=14,azim=-35,lens=45);frame(margin=1.15);print('dir tris',tris());render()
bpy.context.window.scene=bpy.data.scenes['Camper'];bpy.ops.wm.save_mainfile()
