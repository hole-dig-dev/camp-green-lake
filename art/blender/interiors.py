exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
rnd=random.Random(41)
MET=('steel','steel',0.55,0.6)
# Room coordinates: Blender (x, y) = game (dx, -dz) from the room centre; the door wall (game -z) is Blender +Y.
def tube(name,a,b,r=0.03,m=MET,parent=None,verts=8,sq=False):
    a,b=Vector(a),Vector(b);d=b-a
    o=box(name,(r*2,r*2,d.length),(a+b)/2,m,bevel=0.004,parent=parent) if sq else cyl(name,r,d.length,(a+b)/2,m,verts=verts,bevel=0,parent=parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def shade(c,d):return tuple(max(0,min(255,v+d)) for v in c)
def planks(W,D,base,board=0.3,parent=None,along='y',tag='floor'):
    """Floor boards across the whole room, each a slightly different shade; a few use a darker 'old board'."""
    n=int((2*W)/board)
    box(tag+"_sub",(2*W,2*D,0.04),(0,0,-0.07),(tag+"_sub",shade(base,-45),0.95),bevel=0,parent=parent)   # dark underlay: the gaps between boards read as shadow
    for i in range(n):
        x=-W+board/2+i*board;c=shade(base,rnd.randint(-12,12))
        box(f'{tag}{i}',(board-0.012,2*D,0.06),(x,0,-0.03),(f'{tag}_{i%5}',c,0.9),bevel=0.004,parent=parent)
def door_wall(W,D,H,wallmat,parent,leaf=(0x6d,0x64,0x48),trim=(0x4b,0x45,0x33),gap=1.3,DH=2.3):
    y=D-0.06
    for s in (-1,1):box(f'dwall{s}',(W-gap,0.12,H),(s*(W+gap)/2,y,H/2),wallmat,bevel=0,parent=parent)
    box('lintel',(gap*2,0.12,H-DH),(0,y,DH+(H-DH)/2),wallmat,bevel=0,parent=parent)
    for s in (-1,1):
        box(f'leaf{s}',(gap-0.06,0.08,DH),(s*gap/2,y-0.02,DH/2),('doorleaf',leaf,0.85),bevel=0.01,parent=parent)
        for zz in (0.6,1.55):box(f'panel{s}{zz}',(gap-0.35,0.02,0.7),(s*gap/2,y-0.07,zz),('doorpanel',shade(leaf,-14),0.85),bevel=0.004,parent=parent)
        box(f'jamb{s}',(0.12,0.16,DH+0.12),(s*(gap-0.02),y-0.03,(DH+0.12)/2),('doortrim',trim,0.85),bevel=0.01,parent=parent)
        cyl(f'handle{s}',0.035,0.12,(s*0.24,y-0.1,1.1),('brass','brass',0.4,0.8),verts=8,rot=(0,0,0),bevel=0,parent=parent)
    box('doorhead',(gap*2+0.24,0.16,0.14),(0,y-0.03,DH+0.07),('doortrim',trim,0.85),bevel=0.01,parent=parent)
    box('seam',(0.05,0.1,DH),(0,y-0.05,DH/2),('doortrim',trim,0.85),bevel=0,parent=parent)
def window(name,x,y,z,w,h,face,parent,frame=(0x5a,0x3f,0x28),outside=(0xf6,0xe2,0xb4),blinds=False,flap=None):
    """A window on a side wall (face=+1 east wall, -1 west): bright daylight panel, frame, mullions, optional blinds/flap."""
    box(name+'_light',(0.03,w,h),(x,y,z),('daylight',outside,1.0),bevel=0,parent=parent)
    for dz in (-h/2,h/2):box(f'{name}_fh{dz}',(0.1,w+0.12,0.08),(x-face*0.03,y,z+dz),('winframe',frame,0.85),bevel=0.005,parent=parent)
    for dy in (-w/2,w/2):box(f'{name}_fv{dy}',(0.1,0.08,h+0.12),(x-face*0.03,y+dy,z),('winframe',frame,0.85),bevel=0.005,parent=parent)
    box(name+'_mull',(0.05,0.04,h),(x-face*0.04,y,z),('winframe',frame,0.85),bevel=0,parent=parent)
    box(name+'_sill',(0.18,w+0.2,0.05),(x-face*0.08,y,z-h/2-0.04),('winframe',frame,0.85),bevel=0.005,parent=parent)
    if blinds:
        for k in range(9):box(f'{name}_slat{k}',(0.025,w-0.04,0.05),(x-face*0.06,y,z+h/2-0.08-k*0.06),('blind',(0xe8,0xdf,0xc8),0.8),rot=(0.4*face,0,0),bevel=0,parent=parent)
    if flap:cyl(name+'_flap',0.1,w+0.1,(x-face*0.1,y,z+h/2+0.12),('flap',flap,0.95),verts=8,rot=(math.pi/2,0,0),bevel=0,parent=parent)

# ======================= tent rooms (A/B/C and the bigger D Tent) =======================
def tent_room(name,W,D,crew=False):
    scene(name);r=root(name);H=2.5
    CAN=('canvas_in',(0xb8,0xa5,0x7a),0.95);CAN2=('canvas_in_dark',(0x9c,0x8b,0x63),0.95);WOOD=('frame_wood',(0x6b,0x4f,0x33),0.85)
    planks(W,D,(0x7a,0x62,0x44),parent=r)
    box('runner',(1.3,2*D-2.5,0.012),(0 if not crew else 0.4,-0.6,0.006),('runner',(0x7d,0x4a,0x33),0.95),bevel=0,parent=r)
    for s in (-1,1):box(f'runnerstripe{s}',(0.08,2*D-2.5,0.014),((0 if not crew else 0.4)+s*0.5,-0.6,0.007),('runner_s',(0xc9,0xa8,0x6e),0.95),bevel=0,parent=r)
    # walls: canvas skin inside a timber frame (posts every ~2 m, top plate, baseboard)
    for s in (-1,1):
        box(f'wall{s}',(0.1,2*D,H),(s*W,0,H/2),CAN,bevel=0,parent=r)
        box(f'plate{s}',(0.16,2*D,0.14),(s*(W-0.08),0,H),WOOD,bevel=0.01,parent=r)
        box(f'base{s}',(0.1,2*D,0.14),(s*(W-0.07),0,0.07),WOOD,bevel=0.005,parent=r)
    box('backwall',(2*W,0.1,H),(0,-D,H/2),CAN,bevel=0,parent=r)
    box('backplate',(2*W,0.16,0.14),(0,-D+0.08,H),WOOD,bevel=0.01,parent=r)
    door_wall(W,D,H,CAN,r)
    posts=[y for y in [-D+0.08]+[-D+2*k for k in range(1,int(D))]+[D-0.08]]
    for s in (-1,1):
        for y in posts:box(f'post{s}{y}',(0.16,0.16,H),(s*(W-0.08),y,H/2),WOOD,bevel=0.01,parent=r)
    # pitched canvas roof, rafters and a ridge beam (rises well above the camera's 2.7 m limit: look up to see it)
    pitch=math.radians(24);run=W/math.cos(pitch);rise=math.tan(pitch)*W
    for s in (-1,1):
        box(f'roof{s}',(run+0.1,2*D,0.06),(s*W/2,0,H+rise/2),CAN2,rot=(0,s*pitch,0),bevel=0,parent=r)
        for y in posts:tube(f'rafter{s}{y}',(s*(W-0.1),y,H+0.05),(0,y,H+rise-0.05),0.07,m=WOOD,parent=r,sq=True)
    box('ridge',(0.2,2*D,0.22),(0,0,H+rise-0.08),WOOD,bevel=0.01,parent=r)
    for y in posts[1:-1]:tube(f'collar{y}',(-W*0.55,y,H+rise*0.45),(W*0.55,y,H+rise*0.45),0.05,m=WOOD,parent=r,sq=True)
    # gable ends: canvas triangles over the door and back walls
    for y,nm in ((D-0.06,'gfront'),(-D,'gback')):
        me=bpy.data.meshes.new(nm);me.from_pydata([(-W,y,H),(W,y,H),(0,y,H+rise)],[],[(0,1,2)]);o=bpy.data.objects.new(nm,me);bpy.context.window.scene.collection.objects.link(o);_finish(o,CAN2,0,r)
        o.modifiers.new('solid','SOLIDIFY').thickness=0.06
    # windows between the posts, flaps rolled up above them
    for s in (-1,1):
        for k,y in enumerate(posts[1:-1]):
            if k%2==0:window(f'win{s}{k}',s*(W-0.02),y+1.0,1.75,1.3,0.75,s,r,frame=(0x6b,0x4f,0x33),flap=(0x77,0x7f,0x65))
    # pendant lamp from the ridge (the game's point light sits at 2.65 m)
    tube('cord',(0,0,H+rise-0.2),(0,0,3.05),0.012,m=('cord',(0x22,0x22,0x22),0.9),parent=r)
    cyl('shade',0.08,0.22,(0,0,2.98),('lampshade',(0x3f,0x5a,0x3a),0.6),verts=12,r2=0.26,bevel=0,parent=r)
    cyl('bulb',0.07,0.1,(0,0,2.88),('bulb',(0xff,0xe8,0xb0),0.3),verts=8,bevel=0,parent=r)
    # by the door: shovel rack and the rules board (door wall is +Y; doorway spans x -1.3..1.3)
    ry=D-0.2
    # D Tent's rack is empty and six slots wide: the crew's own shovels hang here at night (the game draws them,
    # one per camper, see RACK in public/js/30-npcs.js). The small tents keep four shovels baked in.
    if crew:box('rackboard',(2.6,0.06,0.14),(-2.875,ry,1.55),WOOD,bevel=0.01,parent=r)
    else:box('rackboard',(2.2,0.06,0.14),(-3.2,ry,1.55),WOOD,bevel=0.01,parent=r)
    for k in range(0 if crew else 4):
        x=-4.0+k*0.55;tube(f'handle{k}',(x,ry-0.08,1.6),(x+0.05,ry-0.28,0.35),0.025,m=('shovelhandle',(0x8a,0x6a,0x44),0.85),parent=r)
        box(f'blade{k}',(0.26,0.04,0.34),(x+0.06,ry-0.3,0.2),('shovelblade',(0x70,0x74,0x72),0.6),rot=(math.radians(-20),0,0),bevel=0.01,parent=r)
    box('rules',(1.2,0.04,0.9),(3.1,ry+0.05,1.65),('corkboard',(0xb8,0x8f,0x5c),0.95),bevel=0.01,parent=r)
    box('rulespaper',(0.9,0.02,0.66),(3.1,ry,1.65),('paint_white','paint_white',0.85),bevel=0,parent=r)
    text('rulestitle','CAMP RULES',(3.1,ry-0.02,1.9),0.1,('ink','ink',0.85),rot=(math.pi/2,0,math.pi),parent=r)
    for k,l in enumerate(('1. DIG ONE HOLE A DAY','2. REPORT ANYTHING FOUND','3. NO ONE LEAVES CAMP')):
        text(f'rule{k}',l,(3.1,ry-0.02,1.72-k*0.12),0.05,('ink','ink',0.85),rot=(math.pi/2,0,math.pi),parent=r)
    # orange jumpsuits and caps on hooks along the back wall
    for k in range(4 if not crew else 6):
        x=-W+1.2+k*(2*W-2.4)/((4 if not crew else 6)-1)
        box(f'hook{k}',(0.05,0.12,0.05),(x,-D+0.1,1.95),MET,bevel=0,parent=r)
        box(f'suit{k}',(0.5,0.05,0.8),(x,-D+0.12,1.5),('jumpsuit',(0xd2,0x6a,0x2a),0.9),bevel=0.015,parent=r)
        box(f'suitlegs{k}',(0.42,0.05,0.35),(x,-D+0.12,0.95),('jumpsuit',(0xd2,0x6a,0x2a),0.9),bevel=0.01,parent=r)
        cyl(f'cap{k}',0.15,0.08,(x,-D+0.16,2.02),('capcloth',(0xc9,0xb2,0x86),0.9),verts=10,rot=(math.pi/2,0,0),bevel=0.01,parent=r)
    # supply corner where the chest collider is (game (W-1.25, D-1.5) -> Blender (W-1.25, -(D-1.5)); 1.5 x 1 footprint)
    cx,cy=W-1.25,-(D-1.5)
    box('crate1',(0.72,0.72,0.72),(cx-0.36,cy,0.36),('wood_pale','wood_pale',0.9),bevel=0.02,parent=r)
    box('crate2',(0.66,0.66,0.6),(cx+0.36,cy+0.05,0.3),('wood','wood',0.9),bevel=0.02,parent=r)
    box('crate3',(0.55,0.55,0.45),(cx-0.3,cy+0.05,0.95),('wood','wood',0.9),rot=(0,0,0.3),bevel=0.02,parent=r)
    for k in range(3):box(f'sack{k}',(0.5,0.35,0.3),(cx+0.35,cy-0.05,0.75+k*0.25),('sandbag',(0xa1,0x8b,0x63),0.95),rot=(0,0,rnd.uniform(-0.3,0.3)),bevel=0.08,parent=r)
    text('cratelbl','WATER',(cx-0.36,cy+0.37,0.4),0.1,('ink','ink',0.9),fontname='BigShouldersStencilDisplay',extrude=0.002,rot=(math.pi/2,0,math.pi),parent=r)
    studio(target=(0,0,1.4),elev=34,azim=-160,lens=24,floor=False);cam=bpy.context.window.scene.camera
    cam.location=(W*0.5,D*0.85,2.3);cam.rotation_euler=(Vector((-W*0.3,-D*0.5,1.5))-cam.location).to_track_quat('-Z','Y').to_euler()
    # studio sun can't reach inside: add the room's lamp as a warm point light for the preview
    L=bpy.data.objects.new(name+'.lamp',bpy.data.lights.new(name+'.lamp','POINT'));_link(L,'Studio');L.location=(0,0,2.6);L.data.energy=2500;L.data.color=(1,0.88,0.7);L.data.shadow_soft_size=0.3
    for o in coll('Studio').objects:
        if o.type=='LIGHT' and o.data.type=='SUN':o.data.energy=0
    print(name,tris());render()
tent_room('TentRoomSmall',7,8)
tent_room('TentRoomCrew',9,8.5,crew=True)

# ======================= the Warden's office =======================
scene('WardenRoom');r=root('WardenRoom');W,D,H=8,8,3.4
WAIN=('wainscot',(0x5a,0x3a,0x24),0.7);PLASTER=('plaster',(0x9b,0xa5,0x86),0.95);TRIM=('trim_dark',(0x3a,0x26,0x18),0.7)
planks(W,D,(0x5e,0x40,0x2a),board=0.22,parent=r,tag='hard')
# rug under the desk (desk at game (+2,+1) -> Blender (2,-1))
box('rug',(5.2,3.8,0.014),(2,-1,0.007),('rug',(0x8a,0x2e,0x24),0.95),bevel=0,parent=r)
box('rugborder',(4.6,3.2,0.016),(2,-1,0.008),('rugborder',(0xc9,0xa0,0x5a),0.95),bevel=0,parent=r)
box('ruginner',(4.3,2.9,0.018),(2,-1,0.009),('rug',(0x8a,0x2e,0x24),0.95),bevel=0,parent=r)
box('rugmedal',(1.2,1.2,0.02),(2,-1,0.01),('rugborder',(0xc9,0xa0,0x5a),0.95),rot=(0,0,math.pi/4),bevel=0,parent=r)
def panelled(name,length,pos,rotz):
    g=root(name);g.parent=r;g.location=pos;g.rotation_euler=(0,0,rotz)
    box('plaster',(length,0.1,H),(0,0,H/2),PLASTER,bevel=0,parent=g)
    box('wain',(length,0.14,1.05),(0,-0.03,0.525),WAIN,bevel=0,parent=g)
    box('chair_rail',(length,0.2,0.07),(0,-0.05,1.08),TRIM,bevel=0.01,parent=g)
    box('baseboard',(length,0.18,0.16),(0,-0.05,0.08),TRIM,bevel=0.01,parent=g)
    box('crown',(length,0.22,0.12),(0,-0.06,H-0.06),TRIM,bevel=0.015,parent=g)
    for k in range(int(length/1.0)):box(f'stile{k}',(0.06,0.17,0.9),(-length/2+0.5+k*1.0,-0.05,0.55),TRIM,bevel=0.005,parent=g)
    return g
panelled('west',2*D,(-W,0,0),-math.pi/2);panelled('east',2*D,(W,0,0),math.pi/2);panelled('back',2*W,(0,-D,0),0)
door_wall(W,D,H,PLASTER,r,leaf=(0x5a,0x3b,0x24),trim=(0x3a,0x26,0x18))
box('doorwain',(2*W,0.14,1.05),(0,D-0.13,0.525),WAIN,bevel=0,parent=r)   # (the doorway itself is cut by the door leaves in front)
box('ceiling',(2*W,2*D,0.1),(0,0,H+0.05),('ceiling',(0xe6,0xdc,0xc4),0.95),bevel=0,parent=r)
for k in range(-3,4):box(f'beam{k}',(2*W,0.2,0.18),(0,k*2.2,H-0.09),TRIM,bevel=0.01,parent=r)
# ceiling fan over the rug
cyl('fanrod',0.02,0.4,(2,-1,H-0.2),TRIM,verts=6,bevel=0,parent=r)
cyl('fanmotor',0.16,0.18,(2,-1,H-0.46),('brass','brass',0.4,0.8),verts=12,bevel=0.01,parent=r)
for k in range(4):
    a=k*math.pi/2;box(f'blade{k}',(0.9,0.2,0.02),(2+math.cos(a)*0.55,-1+math.sin(a)*0.55,H-0.5),('fanblade',(0x5a,0x3b,0x24),0.7),rot=(0.08,0,a),bevel=0.005,parent=r)
cyl('fanlight',0.12,0.1,(2,-1,H-0.6),('bulb',(0xff,0xe8,0xb0),0.3),verts=10,bevel=0,parent=r)
# windows with blinds; an air conditioner in one (the Warden keeps her cabin cold)
for s in (-1,1):
    for y in (-3.5,2.5):window(f'win{s}{y}',s*(W-0.02),y,1.85,1.5,1.1,s,r,frame=(0x3a,0x26,0x18),blinds=True)
box('ac',(0.6,0.9,0.5),(W-0.25,2.5,1.55),('ac',(0xd8,0xd2,0xc2),0.7),bevel=0.03,parent=r)
for k in range(6):box(f'acgrille{k}',(0.02,0.7,0.03),(W-0.56,2.5,1.4+k*0.05),TRIM,bevel=0,parent=r)
# stone fireplace on the back wall
fx=-2.0
box('hearth',(2.6,0.9,0.12),(fx,-D+0.5,0.06),('stone',(0x7a,0x6d,0x60),0.95),bevel=0.02,parent=r)
for k in range(10):
    for j in range(5):
        w=rnd.uniform(0.35,0.55);box(f'stone{k}{j}',(w,0.3,0.28),(fx-1.1+j*0.52+rnd.uniform(-0.05,0.05),-D+0.2,0.3+k*0.3),('stone_%d'%(k%3),shade((0x7d,0x6e,0x5e),rnd.randint(-15,15)),0.95),bevel=0.03,parent=r)
box('firebox',(1.2,0.1,0.9),(fx,-D+0.36,0.6),('soot',(0x1e,0x19,0x16),1.0),bevel=0,parent=r)
box('mantel',(2.8,0.45,0.14),(fx,-D+0.35,1.4),TRIM,bevel=0.02,parent=r)
for k in range(3):cyl(f'log{k}',0.08,0.8,(fx-0.2+k*0.15,-D+0.55,0.25+k*0.02),('log',(0x4a,0x33,0x22),0.9),verts=8,rot=(0,math.pi/2,0.3*k),bevel=0,parent=r)
cyl('mantelclock',0.13,0.08,(fx+0.8,-D+0.3,1.62),('brass','brass',0.4,0.8),verts=14,rot=(math.pi/2,0,0),bevel=0.01,parent=r)
box('mantellamp',(0.18,0.18,0.3),(fx-0.9,-D+0.3,1.62),('lantern',(0xff,0xd4,0x8a),0.4),bevel=0.02,parent=r)
# bookcase where the cabinet collider is (game (-5.4,-2) -> Blender (-5.4, 2); 1.6 wide, 0.45 deep)
bx,by=-5.4,2.0
box('bookcase',(1.6,0.45,2.1),(bx,by,1.05),WAIN,bevel=0.015,parent=r)
for k in range(4):
    z=0.12+k*0.5;box(f'shelf{k}',(1.5,0.4,0.03),(bx,by-0.03,z),TRIM,bevel=0,parent=r)
    x=bx-0.7
    while x<bx+0.65:
        bw=rnd.uniform(0.05,0.1);bh=rnd.uniform(0.3,0.42)
        box(f'book{k}{x:.2f}',(bw,0.3,bh),(x+bw/2,by-0.06,z+0.015+bh/2),('book%d'%rnd.randint(0,5),rnd.choice([(0x7a,0x2a,0x22),(0x2f,0x4a,0x3a),(0x2a,0x35,0x55),(0xb0,0x8a,0x3c),(0x5a,0x3b,0x24),(0xd8,0xcc,0xaa)]),0.8),bevel=0,parent=r)
        x+=bw+0.012
# lake map on a stand (game (-3.2,+4) -> Blender (-3.2,-4)): the search grid with red pins
mx,my=-3.2,-4.0
for s in (-1,1):tube(f'easel{s}',(mx+s*1.4,my,0),(mx+s*1.4,my,2.45),0.05,m=TRIM,parent=r,sq=True)
box('mapboard',(3.2,0.08,1.6),(mx,my,1.6),TRIM,bevel=0.015,parent=r)
box('map',(3.0,0.02,1.42),(mx,my+0.05,1.6),('map',(0xd9,0xc3,0x96),0.95),bevel=0,parent=r)
box('lake',(2.2,0.022,1.0),(mx+0.1,my+0.052,1.58),('lakebed',(0xc9,0xa2,0x6a),0.95),bevel=0,parent=r)
for k in range(9):box(f'gridv{k}',(0.012,0.024,1.0),(mx-1.0+k*0.25,my+0.054,1.58),('ink','ink',0.9),bevel=0,parent=r)
for k in range(5):box(f'gridh{k}',(2.2,0.024,0.012),(mx+0.1,my+0.054,1.08+k*0.25),('ink','ink',0.9),bevel=0,parent=r)
for k in range(7):cyl(f'pin{k}',0.025,0.04,(mx-0.8+rnd.uniform(0,1.8),my+0.07,1.15+rnd.uniform(0,0.85)),('paint_red','paint_red',0.6),verts=6,rot=(math.pi/2,0,0),bevel=0,parent=r)
text('maptitle','GREEN LAKE - SEARCH GRID',(mx,my+0.06,2.24),0.1,('ink','ink',0.85),rot=(math.pi/2,0,math.pi),parent=r)
# east wall: filing cabinets, a water cooler, the WANTED poster; by the door: a coat rack
for k in range(2):
    fy=-5.8+k*0.62;box(f'filing{k}',(0.6,0.55,1.35),(W-0.35,fy,0.675),('filing',(0x6b,0x70,0x66),0.6),bevel=0.015,parent=r)
    for j in range(4):box(f'drawer{k}{j}',(0.02,0.45,0.26),(W-0.66,fy,0.2+j*0.32),('filing_d',(0x5d,0x62,0x58),0.6),bevel=0.004,parent=r);box(f'pull{k}{j}',(0.04,0.14,0.03),(W-0.68,fy,0.26+j*0.32),('brass','brass',0.4,0.8),bevel=0,parent=r)
box('coolerbase',(0.45,0.45,0.95),(W-0.35,-0.6,0.475),('ac',(0xd8,0xd2,0xc2),0.7),bevel=0.02,parent=r)
cyl('bottle',0.17,0.45,(W-0.35,-0.6,1.18),('water_blue',(0x6f,0xa3,0xc4),0.2),verts=14,bevel=0.01,parent=r)
box('poster',(0.03,0.75,1.0),(W-0.07,0.6,1.9),('poster',(0xe0,0xcf,0xa3),0.95),bevel=0,parent=r)
text('wanted','WANTED',(W-0.1,0.6,2.25),0.14,('ink','ink',0.85),rot=(math.pi/2,0,math.pi/2),parent=r)
box('mugshot',(0.02,0.4,0.36),(W-0.1,0.6,1.93),('mugshot',(0x6a,0x55,0x44),0.9),bevel=0,parent=r)
text('kate1',"KISSIN' KATE",(W-0.1,0.6,1.66),0.07,('ink','ink',0.85),rot=(math.pi/2,0,math.pi/2),parent=r)
text('kate2','BARLOW',(W-0.1,0.6,1.56),0.08,('paint_red','paint_red',0.8),rot=(math.pi/2,0,math.pi/2),parent=r)
rx,ryy=-3.0,D-0.5
tube('coatpole',(rx,ryy,0.05),(rx,ryy,1.9),0.03,m=TRIM,parent=r)
for k in range(3):
    a=k*2*math.pi/3;tube(f'coatfoot{k}',(rx,ryy,0.25),(rx+math.cos(a)*0.3,ryy+math.sin(a)*0.3,0.02),0.02,m=TRIM,parent=r)
cyl('hat',0.2,0.1,(rx+0.12,ryy,1.85),('capcloth',(0xc9,0xb2,0x86),0.9),verts=12,bevel=0.01,parent=r)
cyl('brim',0.3,0.02,(rx+0.12,ryy,1.8),('capcloth',(0xc9,0xb2,0x86),0.9),verts=12,bevel=0,parent=r)
# a little table with her nail polish (rattlesnake venom, as the story goes)
box('sidetable',(0.6,0.45,0.05),(W-0.4,4.5,0.7),TRIM,bevel=0.01,parent=r)
for s in (-1,1):box(f'stleg{s}',(0.05,0.4,0.68),(W-0.4+s*0.25,4.5,0.34),TRIM,bevel=0,parent=r)
for k in range(4):cyl(f'polish{k}',0.03,0.09,(W-0.55+k*0.1,4.5,0.77),('polish',(0x9a,0x1c,0x2c),0.2),verts=8,bevel=0,parent=r);cyl(f'polishcap{k}',0.015,0.06,(W-0.55+k*0.1,4.5,0.84),('ink','ink',0.5),verts=6,bevel=0,parent=r)
studio(floor=False);cam=bpy.context.window.scene.camera;cam.data.lens=22
cam.location=(W*0.45,D*0.9,2.6);cam.rotation_euler=(Vector((-W*0.2,-D*0.35,1.1))-cam.location).to_track_quat('-Z','Y').to_euler()
L=bpy.data.objects.new('WardenRoom.lamp',bpy.data.lights.new('WardenRoom.lamp','POINT'));_link(L,'Studio');L.location=(0,0,2.65);L.data.energy=3000;L.data.color=(1,0.9,0.75)
for o in coll('Studio').objects:
    if o.type=='LIGHT' and o.data.type=='SUN':o.data.energy=0
print('warden room',tris());render()
bpy.context.window.scene=bpy.data.scenes['ARCHIVED_Camper_minipc'];bpy.ops.wm.save_mainfile()
