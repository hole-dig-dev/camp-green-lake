# blend: buildings.blend
exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
rnd=random.Random(21)
MET=('steel','steel',0.55,0.6)
def tube(name,a,b,r=0.022,m=MET,parent=None,verts=8,box_=False):
    a,b=Vector(a),Vector(b);d=b-a
    if box_:o=box(name,(r*2,r*2,d.length),(a+b)/2,m,bevel=0.006,parent=parent)
    else:o=cyl(name,r,d.length,(a+b)/2,m,verts=verts,bevel=0,parent=parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def mesh_obj(name,verts,faces,material,parent=None,bevel=0):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.window.scene.collection.objects.link(o);return _finish(o,material,bevel,parent)

# ================= canvas tent (fronts face -Y; the game rotates the door to face the yard) =================
def tent(name,W,D,H,crew=False):
    scene(name);r=root(name)
    CAN=('canvas_tent',(0x77,0x7f,0x65),0.95);EDGE=('canvas_edge',(0x44,0x4b,0x39),0.95)
    nx,ny=2,8;verts=[];faces=[]
    # roof: two sloped sheets, subdivided along the length so they can sag between the poles
    for side in (-1,1):
        base=len(verts)
        for j in range(ny+1):
            y=-D/2-0.15+j*(D+0.3)/ny;sag=0.09*math.sin(math.pi*(j%4)/4)  # dips between pole bays
            for i in range(nx+1):
                t=i/nx;x=side*(W/2+0.25)*(1-t);z=0.55+(H-0.55)*t-sag*(1-abs(2*t-1))*1.5
                verts.append((x,y,z))
        for j in range(ny):
            for i in range(nx):
                a=base+j*(nx+1)+i;q=(a,a+1,a+nx+2,a+nx+1);faces.append(q if side>0 else q[::-1])
    roof=mesh_obj('roof',verts,faces,CAN,parent=r)
    m=roof.modifiers.new('solid','SOLIDIFY');m.thickness=0.05
    # short side walls (the canvas skirt below the roof eaves)
    for side in (-1,1):box(f'wall{side}',(0.05,D,0.6),(side*(W/2+0.1),0,0.3),CAN,bevel=0,parent=r)
    # end walls: back closed, front with a dark doorway and the flaps tied back
    for y,front in ((-D/2,True),(D/2,False)):
        tri=mesh_obj(f'end{y}',[(-W/2-0.1,y,0),(W/2+0.1,y,0),(W/2+0.1,y,0.55),(0,y,H),(-W/2-0.1,y,0.55)],[(0,1,2,3,4) if front else (4,3,2,1,0)],CAN,parent=r)
        tri.modifiers.new('solid','SOLIDIFY').thickness=0.04
        if front:
            box('doorway',(1.4,0.05,1.9),(0,y-0.03,0.95),((0x25,0x25,0x1d),(0x25,0x25,0x1d),1.0),bevel=0,parent=r)
            for s in (-1,1):
                cyl(f'flap{s}',0.13,1.9,(s*0.85,y-0.1,1.0),EDGE,verts=8,bevel=0,parent=r)   # rolled-up door flap
                box(f'tie{s}',(0.3,0.03,0.04),(s*0.85,y-0.24,1.3),('wire','wire',0.9),bevel=0,parent=r)
    # ridge pole, uprights, guy ropes, stakes, sandbags along the skirt
    tube('ridge',(0,-D/2-0.45,H+0.02),(0,D/2+0.45,H+0.02),0.06,m=('wood_dark','wood_dark',0.9),parent=r)
    for y in (-D/2-0.1,D/2+0.1):tube(f'upright{y}',(0,y,0),(0,y,H),0.06,m=('wood_dark','wood_dark',0.9),parent=r)
    for y in (-D/2+0.2,0,D/2-0.2):
        for s in (-1,1):
            eave=(s*(W/2+0.25),y,0.55);stake=(s*(W/2+1.5),y,0.05)
            tube(f'rope{y}{s}',eave,stake,0.012,m=('rope',(0xb2,0x9c,0x72),0.95),parent=r)
            tube(f'stake{y}{s}',(stake[0],stake[1],-0.05),(stake[0]+s*0.05,stake[1],0.35),0.025,m=('wood','wood',0.9),parent=r)
    for s in (-1,1):
        for k in range(int(D/0.7)):
            y=-D/2+0.35+k*0.7;box(f'sand{s}{k}',(0.4,0.62,0.22),(s*(W/2+0.33),y,0.11),('sandbag',(0xa1,0x8b,0x63),0.95),rot=(0,0,rnd.uniform(-0.1,0.1)),bevel=0.07,parent=r)
    if crew:
        box('lettering_board',(1.3,0.04,0.5),(0,-D/2-0.07,H-0.9),('wood_pale','wood_pale',0.9),bevel=0.01,parent=r)
        text('letter','D',(0,-D/2-0.1,H-0.9),0.38,('ink','ink',0.9),fontname='BigShouldersStencilDisplay',parent=r)
    studio(elev=18,azim=-35,lens=40);frame(margin=1.08);print(name,tris());render()
tent('TentSmall',6.0,7.2,3.0)
tent('TentCrew',7.2,10.4,3.5,crew=True)

# ---- the Wreck Room's serving window: a concession stand cut into the front wall, clerk inside (public/js/30-npcs.js) ----
# The front wall gets a 2.2 m opening over a plank counter at 0.95 m (chest height for a camper), a booth behind it
# with stocked shelves, and a top-hinged shutter propped up as an awning. Game side: the store spot is in front of the
# counter, and the clerk stands in the booth at Blender (0, SHOP_CLERK_Y).
SHOP_W,SHOP_Z0,SHOP_Z1,SHOP_BOOTH,SHOP_CLERK_Y=2.2,0.95,2.3,1.9,-1.85   # clerk: game z 45-1.85 = 43.15 (CLERK_AT)
def shop_front(r,walls,W,D,H,WALL,TRIM,ROOF):
    fy=-D/2-0.02
    def cutter(nm,size,loc):   # boolean operand: kept out of the Asset collection so the export skips it
        bpy.ops.mesh.primitive_cube_add(size=1,location=loc);c=bpy.context.active_object;c.name=nm;c.scale=size
        for cl in list(c.users_collection):cl.objects.unlink(c)
        bpy.context.window.scene.collection.objects.link(c);c.hide_render=True;c.display_type='WIRE'
        m=walls.modifiers.new(nm,'BOOLEAN');m.operation='DIFFERENCE';m.object=c;m.solver='EXACT';return c
    cutter('cut_window',(SHOP_W,0.6,SHOP_Z1-SHOP_Z0),(0,-D/2,(SHOP_Z0+SHOP_Z1)/2))
    cutter('cut_booth',(SHOP_W+0.8,SHOP_BOOTH,2.45),(0,-D/2+0.1+SHOP_BOOTH/2,0.3+2.45/2-0.01))
    PLANKD=('booth_plank',(0x6a,0x50,0x36),0.9);SHELF=('shelf',(0x8a,0x6a,0x46),0.9)
    by=-D/2+0.1+SHOP_BOOTH   # back wall of the booth
    # booth lining: floorboards, plank back wall and sides, ceiling, a bare bulb
    box('booth_floor',(SHOP_W+0.8,SHOP_BOOTH,0.04),(0,by-SHOP_BOOTH/2,0.32),PLANKD,bevel=0,parent=r)
    box('booth_back',(SHOP_W+0.8,0.03,2.45),(0,by-0.02,0.3+1.22),PLANKD,bevel=0,parent=r)
    for s_ in (-1,1):box(f'booth_side{s_}',(0.03,SHOP_BOOTH,2.45),(s_*(SHOP_W/2+0.38),by-SHOP_BOOTH/2,0.3+1.22),PLANKD,bevel=0,parent=r)
    box('booth_ceiling',(SHOP_W+0.8,SHOP_BOOTH,0.03),(0,by-SHOP_BOOTH/2,0.3+2.43),PLANKD,bevel=0,parent=r)
    tube('bulb_cord',(0,by-0.9,2.72),(0,by-0.9,2.35),0.006,('cord',(0x20,0x1c,0x18),0.8),r)
    cyl('bulb',0.045,0.1,(0,by-0.9,2.3),('bulb',(0xff,0xe8,0xa0),0.3),verts=10,bevel=0.02,parent=r)
    # shelves on the back wall, stocked with what the store sells
    for k,z in enumerate((0.9,1.4,1.9)):
        box(f'shelf{k}',(SHOP_W+0.6,0.34,0.04),(0,by-0.2,z),SHELF,bevel=0.004,parent=r)
    JUG=('water_jug',(0x5a,0x8a,0xb8),0.35);CAN=('can_red',(0xb8,0x3a,0x2a),0.5,0.4);CAN2=('can_grn',(0x4a,0x7a,0x3a),0.5,0.4)
    SACK=('onion_sack',(0xc8,0xa8,0x6a),0.95);ONION=('onion',(0xc8,0x8a,0x4a),0.6);BATT=('batt_box',(0xe0,0x8a,0x1e),0.7)
    TONIC=('tonic',(0x7a,0x4a,0x22),0.3);KIT=('kit',(0xd8,0xd4,0xc8),0.6);CROSS=('kit_cross',(0xc0,0x28,0x20),0.6)
    for i,x in enumerate((-1.2,-0.95,-0.7)):   # top shelf: water jugs
        cyl(f'jug{i}',0.1,0.26,(x,by-0.2,1.92+0.13),JUG,verts=12,bevel=0.02,parent=r);cyl(f'jugcap{i}',0.035,0.04,(x,by-0.2,2.2),('cap',(0xe8,0xe8,0xe0),0.6),verts=8,bevel=0,parent=r)
    for i in range(6):cyl(f'can{i}',0.045,0.11,(-0.35+i*0.1,by-0.2,1.92+0.055),CAN if i%2 else CAN2,verts=10,bevel=0.004,parent=r)
    for i in range(3):box(f'kit{i}',(0.22,0.14,0.12),(0.55+i*0.26,by-0.2,1.92+0.06),KIT,bevel=0.01,parent=r);box(f'kitx{i}',(0.07,0.005,0.07),(0.55+i*0.26,by-0.2-0.071,1.92+0.06),CROSS,bevel=0,parent=r)
    for i in range(7):box(f'batt{i}',(0.09,0.05,0.13),(-1.2+i*0.11,by-0.2,1.42+0.065),BATT,bevel=0.004,parent=r)   # middle shelf: batteries, tonic
    for i in range(5):cyl(f'tonic{i}',0.035,0.12,(-0.25+i*0.1,by-0.2,1.42+0.06),TONIC,verts=10,bevel=0.004,parent=r);cyl(f'cork{i}',0.02,0.03,(-0.25+i*0.1,by-0.2,1.42+0.135),('cork',(0xb8,0x8a,0x58),0.95),verts=6,bevel=0,parent=r)
    for i in range(2):   # walkies
        box(f'walkie{i}',(0.07,0.04,0.13),(0.5+i*0.13,by-0.2,1.42+0.065),('walkie',(0x2a,0x2c,0x2e),0.6),bevel=0.01,parent=r)
        tube(f'ant{i}',(0.52+i*0.13,by-0.2,1.49),(0.52+i*0.13,by-0.2,1.58),0.006,('walkie',(0x2a,0x2c,0x2e),0.6),r)
    for i,x in enumerate((-1.1,-0.6)):   # bottom shelf: onion sacks
        cyl(f'sack{i}',0.2,0.3,(x,by-0.2,0.92+0.15),SACK,verts=12,r2=0.12,bevel=0.05,parent=r)
        for j in range(3):bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05,segments=10,ring_count=6,location=(x-0.05+j*0.05,by-0.3,0.92+0.31));o=bpy.context.active_object;o.name=f'onion{i}{j}';_finish(o,ONION,0,r)
    for i in range(3):   # shovels leaning in the corner (the long-handled one for sale among them)
        x=1.15-i*0.14;tube(f'shovel{i}',(x,by-0.12,0.35),(x-0.08,by-0.3,1.75+i*0.12),0.018,('handle',(0x8a,0x62,0x3a),0.9),r)
        box(f'blade{i}',(0.2,0.03,0.26),(x+0.01,by-0.1,0.48),('steel','steel',0.5,0.6),bevel=0.01,parent=r)
    # the counter: plank top across the opening, out past the wall, on two brackets; a bell and the cash tin on it
    box('counter',(SHOP_W+0.3,0.62,0.06),(0,fy-0.08,SHOP_Z0),TRIM,bevel=0.01,parent=r)
    for s_ in (-1,1):
        mesh_obj(f'bracket{s_}',[(s_*0.95,fy,SHOP_Z0-0.03),(s_*0.95,fy-0.36,SHOP_Z0-0.03),(s_*0.95,fy,SHOP_Z0-0.4)],[(0,1,2)],TRIM,parent=r).modifiers.new('solid','SOLIDIFY').thickness=0.05
    for s_ in (-1,1):box(f'jamb{s_}',(0.1,0.1,SHOP_Z1-SHOP_Z0+0.1),(s_*(SHOP_W/2+0.05),fy-0.03,(SHOP_Z0+SHOP_Z1)/2),TRIM,bevel=0.01,parent=r)
    box('header',(SHOP_W+0.3,0.12,0.12),(0,fy-0.03,SHOP_Z1+0.05),TRIM,bevel=0.01,parent=r)
    cyl('bell_base',0.05,0.015,(0.7,fy-0.2,SHOP_Z0+0.035),('brass','brass',0.4,0.8),verts=12,bevel=0.003,parent=r)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.045,segments=12,ring_count=6,location=(0.7,fy-0.2,SHOP_Z0+0.045));o=bpy.context.active_object;o.name='bell';o.scale=(1,1,0.8);_finish(o,('brass','brass',0.4,0.8),0,r)
    box('cashtin',(0.26,0.18,0.1),(-0.75,fy+0.05,SHOP_Z0+0.08),('cashtin',(0x3a,0x5a,0x4a),0.5,0.4),bevel=0.01,parent=r)
    cyl('seedjar',0.07,0.18,(-0.35,fy-0.15,SHOP_Z0+0.12),('jarglass',(0xc8,0xe0,0xd0),0.1),verts=12,bevel=0.01,parent=r)
    cyl('seeds',0.064,0.12,(-0.35,fy-0.15,SHOP_Z0+0.09),('seeds',(0x3a,0x34,0x2a),0.9),verts=12,bevel=0,parent=r)
    # the shutter, hinged at the top and propped up as an awning on two sticks
    a=math.radians(105);L=SHOP_Z1-SHOP_Z0+0.2;hz=SHOP_Z1+0.1
    box('shutter',(SHOP_W+0.3,0.05,L),(0,fy-0.04-L/2*math.sin(a),hz-L/2*math.cos(a)),('shutter_store',(0x6d,0x5a,0x44),0.85),rot=(-a,0,0),bevel=0.01,parent=r)
    for k in range(4):box(f'shutterbatten{k}',(SHOP_W+0.32,0.02,0.07),(0,fy-0.04-(0.15+k*0.35)*math.sin(a)+0.03*math.cos(a),hz-(0.15+k*0.35)*math.cos(a)+0.03*math.sin(a)),TRIM,rot=(-a,0,0),bevel=0,parent=r)
    ex,ez=fy-0.04-L*math.sin(a),hz-L*math.cos(a)
    for s_ in (-1,1):tube(f'prop{s_}',(s_*1.15,fy-0.33,SHOP_Z0+0.03),(s_*1.15,ex+0.1,ez-0.02),0.022,TRIM,r)
    # menu board on the left, painted in chalk
    CHALK=('chalk',(0xe8,0xe4,0xd8),0.9);BOARD=('chalkboard',(0x2a,0x3a,0x30),0.95)
    box('menuframe',(1.45,0.06,1.15),(-2.25,fy-0.03,1.85),TRIM,bevel=0.01,parent=r);box('menu',(1.3,0.05,1.0),(-2.25,fy-0.06,1.85),BOARD,bevel=0,parent=r)
    text('menu_t','SUPPLIES',(-2.25,fy-0.09,2.18),0.2,CHALK,parent=r)
    for k,t in enumerate(('WATER  ONIONS','BATTERIES  TONIC','SHOVELS  WALKIES')):text(f'menu{k}',t,(-2.25,fy-0.09,1.95-k*0.19),0.13,CHALK,parent=r)
    text('menu_s','SEEDS ONLY',(-2.25,fy-0.09,1.44),0.12,('chalk_red',(0xd8,0x6a,0x50),0.9),parent=r)
    # right: the old window, with an OPEN card hung in it
    wx,wz=2.25,1.9
    box('winframeR',(1.15,0.08,0.95),(wx,fy-0.02,wz),TRIM,bevel=0.01,parent=r)
    box('glassR',(0.95,0.04,0.75),(wx,fy-0.05,wz),('glass',(0x2f,0x3a,0x44),0.15,0.2),bevel=0,parent=r)
    box('sillR',(1.3,0.18,0.07),(wx,fy-0.1,wz-0.5),TRIM,bevel=0.01,parent=r)
    box('opencard',(0.5,0.02,0.22),(wx,fy-0.08,wz-0.05),('card',(0xe2,0xcc,0x98),0.95),bevel=0.004,parent=r)
    text('opentxt','OPEN',(wx,fy-0.1,wz-0.05),0.14,('ink_red',(0xa0,0x28,0x1c),0.8),parent=r)
    tube('cardstring',(wx-0.2,fy-0.08,wz+0.07),(wx,fy-0.08,wz+0.3),0.004,('cord',(0x20,0x1c,0x18),0.8),r);tube('cardstring2',(wx+0.2,fy-0.08,wz+0.07),(wx,fy-0.08,wz+0.3),0.004,('cord',(0x20,0x1c,0x18),0.8),r)

# ================= cabins: board-and-batten walls, gable roof with overhang, framed windows, porch =================
def cabin(name,W,D,H,wall,roof,warden=False,shop=False):
    scene(name);r=root(name)
    WALL=('wall_'+name,wall,0.9);TRIM=('trim',(0x4a,0x35,0x25),0.85);ROOF=('roof_'+name,roof,0.9)
    box('foundation',(W+0.2,D+0.2,0.3),(0,0,0.15),('concrete','concrete',0.95),bevel=0.02,parent=r)
    walls=box('walls',(W,D,H),(0,0,0.3+H/2),WALL,bevel=0.01,parent=r)
    # battens every 0.45 m on all four walls
    for y,rx in ((-D/2-0.012,0),(D/2+0.012,0)):
        for k in range(int(W/0.45)+1):
            x=-W/2+0.1+k*0.45
            if x>W/2-0.05:break
            if shop and y<0 and abs(x)<SHOP_W/2+0.1:   # the serving window: batten below the counter and above the opening only
                box(f'batten{y}{k}lo',(0.05,0.03,SHOP_Z0-0.32),(x,y,(0.3+SHOP_Z0-0.02)/2),WALL,bevel=0,parent=r)
                box(f'batten{y}{k}hi',(0.05,0.03,0.3+H-SHOP_Z1-0.02),(x,y,(SHOP_Z1+0.02+0.3+H)/2),WALL,bevel=0,parent=r)
                continue
            box(f'batten{y}{k}',(0.05,0.03,H),(x,y,0.3+H/2),WALL,bevel=0,parent=r)
    for x in (-W/2-0.012,W/2+0.012):
        for k in range(int(D/0.45)+1):
            y=-D/2+0.1+k*0.45
            if y>D/2-0.05:break
            box(f'battenS{x}{k}',(0.03,0.05,H),(x,y,0.3+H/2),WALL,bevel=0,parent=r)
    for x in (-W/2,W/2):
        for y in (-D/2,D/2):box(f'corner{x}{y}',(0.14,0.14,H+0.05),(x,y,0.3+H/2),TRIM,bevel=0.01,parent=r)
    # gable roof: two slabs + gable end triangles + ridge cap, overhanging 0.45 m
    pitch=math.radians(30);half=(D/2+0.45);slab=half/math.cos(pitch);rise=math.tan(pitch)*(D/2);top=0.3+H
    for s in (-1,1):
        box(f'roofslab{s}',(W+0.9,slab+0.05,0.12),(0,s*half/2,top+rise/2-0.02),ROOF,rot=(s*pitch*-1,0,0),bevel=0.02,parent=r)
        for k in range(5):   # shingle courses
            f=(k+0.5)/5;box(f'course{s}{k}',(W+0.92,0.04,0.03),(0,s*half*f,top+rise*(1-f)+0.05+0.02),ROOF,rot=(s*pitch*-1,0,0),bevel=0,parent=r)
    for x in (-W/2,W/2):
        g=mesh_obj(f'gable{x}',[(x,-D/2,top),(x,D/2,top),(x,0,top+rise)],[(0,1,2) if x>0 else (2,1,0)],WALL,parent=r)
        g.modifiers.new('solid','SOLIDIFY').thickness=0.08
    box('ridgecap',(W+0.95,0.22,0.1),(0,0,top+rise+0.06),TRIM,bevel=0.02,parent=r)
    # front (-Y): door + two windows with frames, sills and shutters (the Wreck Room: a serving window instead, below)
    fy=-D/2-0.02
    if shop:shop_front(r,walls,W,D,H,WALL,TRIM,ROOF)
    else:
     box('doorframe',(1.3,0.08,2.25),(0,fy-0.02,0.3+1.12),TRIM,bevel=0.01,parent=r)
     box('door',(1.05,0.06,2.05),(0,fy-0.05,0.3+1.03),('door',(0x5a,0x3f,0x28),0.85),bevel=0.01,parent=r)
     for zz in (0.55,1.5):box(f'doorpanel{zz}',(0.8,0.02,0.6),(0,fy-0.085,0.3+zz),('door_panel',(0x4a,0x33,0x22),0.85),bevel=0.005,parent=r)
     cyl('knob',0.04,0.05,(0.38,fy-0.11,0.3+1.0),('brass','brass',0.4,0.8),verts=8,rot=(math.pi/2,0,0),bevel=0,parent=r)
     for s in (-1,1):
         wx=s*W*0.3;wz=0.3+1.6
         box(f'winframe{s}',(1.15,0.08,0.95),(wx,fy-0.02,wz),TRIM,bevel=0.01,parent=r)
         box(f'glass{s}',(0.95,0.04,0.75),(wx,fy-0.05,wz),('glass',(0x2f,0x3a,0x44),0.15,0.2),bevel=0,parent=r)
         box(f'mullionV{s}',(0.05,0.03,0.75),(wx,fy-0.07,wz),TRIM,bevel=0,parent=r);box(f'mullionH{s}',(0.95,0.03,0.05),(wx,fy-0.07,wz),TRIM,bevel=0,parent=r)
         box(f'sill{s}',(1.3,0.18,0.07),(wx,fy-0.1,wz-0.5),TRIM,bevel=0.01,parent=r)
         for t in (-1,1):box(f'shutter{s}{t}',(0.45,0.05,0.95),(wx+t*0.82,fy-0.04,wz),('shutter_'+name,roof,0.85),bevel=0.01,parent=r)
    # side windows
    for x in (-W/2-0.02,W/2+0.02):
        box(f'swin{x}',(0.08,0.95,0.8),(x,0.4,0.3+1.6),TRIM,bevel=0.01,parent=r);box(f'sglass{x}',(0.1,0.78,0.62),(x,0.4,0.3+1.6),('glass',(0x2f,0x3a,0x44),0.15,0.2),bevel=0,parent=r)
    if warden:
        # porch across the front: deck, steps, posts, rail, awning roof, lanterns, plaque, chimney
        box('porch',(W,2.2,0.2),(0,-D/2-1.1,0.2),('porch',(0x7a,0x5a,0x3a),0.9),bevel=0.015,parent=r)
        for k in range(int(W/0.25)):box(f'deckboard{k}',(0.02,2.2,0.005),(-W/2+0.25*(k+1),-D/2-1.1,0.303),TRIM,bevel=0,parent=r)
        for k in range(2):box(f'step{k}',(3,0.35,0.15),(0,-D/2-2.35-k*0.3,0.225-k*0.15),('step',(0x87,0x72,0x57),0.9),bevel=0.015,parent=r)
        for x in (-W/2+0.15,-1.6,1.6,W/2-0.15):box(f'pillar{x}',(0.2,0.2,2.6),(x,-D/2-2.05,0.3+1.3),TRIM,bevel=0.015,parent=r)
        box('awning',(W+0.4,2.6,0.14),(0,-D/2-1.2,0.3+2.72),ROOF,rot=(math.radians(8),0,0),bevel=0.02,parent=r)
        for x in (-W/2+0.15,W/2-0.15):
            box(f'railtop{x}',(abs(x)-1.6-0.05,0.08,0.08),((x+math.copysign(1.6,x))/2,-D/2-2.05,0.3+0.95),TRIM,bevel=0.005,parent=r)
            for k in range(6):
                bx=math.copysign(1.75,x)+math.copysign(k*0.36,x)
                if abs(bx)>=W/2-0.2:break
                box(f'baluster{x}{k}',(0.05,0.05,0.65),(bx,-D/2-2.05,0.3+0.62),TRIM,bevel=0,parent=r)
        for s in (-1,1):
            box(f'lantern{s}',(0.24,0.24,0.34),(s*1.25,-D/2-0.12,0.3+2.25),('lantern',(0xff,0xd4,0x8a),0.4),bevel=0.02,parent=r)
            box(f'lanterncap{s}',(0.3,0.3,0.06),(s*1.25,-D/2-0.12,0.3+2.45),TRIM,bevel=0.01,parent=r)
        box('plaque',(2.6,0.06,0.45),(0,-D/2-0.06,0.3+2.45),('plaque',(0xd9,0xc3,0x96),0.85),bevel=0.015,parent=r)
        text('plaquetxt','THE WARDEN',(0,-D/2-0.1,0.3+2.45),0.28,('ink','ink',0.8),parent=r)
        box('chimney',(0.9,0.9,H*0.9+1.4),(W*0.3,D*0.15,0.3+H*0.45+0.7+rise*0.4),('stone',(0x6d,0x59,0x48),0.95),bevel=0.03,parent=r)
        box('chimneycap',(1.05,1.05,0.12),(W*0.3,D*0.15,0.3+H*0.9+1.4+rise*0.4),TRIM,bevel=0.02,parent=r)
    else:
        # Wreck Room: stovepipe, a bench and crates by the door, the swinging sign's spot
        cyl('stovepipe',0.12,1.6,(W*0.3,D*0.2,top+rise*0.6+0.4),('steel','steel',0.5,0.6),verts=10,bevel=0,parent=r)
        cyl('stovecap',0.2,0.16,(W*0.3,D*0.2,top+rise*0.6+1.25),('steel','steel',0.5,0.6),verts=10,r2=0.05,bevel=0,parent=r)
        if not shop:box('stoop',(2.2,1.0,0.18),(0,-D/2-0.5,0.09),('step',(0x87,0x72,0x57),0.9),bevel=0.015,parent=r)
    studio(elev=18,azim=-33,lens=40);frame(margin=1.08);print(name,tris());render()
cabin('WreckRoom',7,5,3.2,(0x9b,0x7b,0x58),(0x6d,0x5a,0x44),shop=True)
cabin('WardenHouse',8,6,3.4,(0xb0,0x76,0x50),(0x5a,0x3a,0x2a),warden=True)

# ================= watchtower (2.1 m leg square, deck at 7.25, cab rail 8.08, roof 8.94, lamp 8.55) =================
scene('Watchtower');r=root('Watchtower');M2=('tower_steel',(0x3f,0x46,0x45),0.6,0.6)
for dx in (-1.05,1.05):
    for dy in (-1.05,1.05):tube(f'leg{dx}{dy}',(dx*1.15,dy*1.15,0),(dx,dy,7.2),0.1,m=M2,parent=r,box_=True)
levels=(0.2,2.6,5.0,7.1)
for a,b in zip(levels,levels[1:]):   # X-bracing on every face, every storey
    for s in (-1,1):
        tube(f'bx{a}{s}a',(-1.05,s*1.05,a),(1.05,s*1.05,b),0.04,m=M2,parent=r,box_=True);tube(f'bx{a}{s}b',(1.05,s*1.05,a),(-1.05,s*1.05,b),0.04,m=M2,parent=r,box_=True)
        tube(f'by{a}{s}a',(s*1.05,-1.05,a),(s*1.05,1.05,b),0.04,m=M2,parent=r,box_=True);tube(f'by{a}{s}b',(s*1.05,1.05,a),(s*1.05,-1.05,b),0.04,m=M2,parent=r,box_=True)
for z in levels[1:]:
    for s in (-1,1):box(f'ringx{z}{s}',(2.2,0.1,0.12),(0,s*1.05,z),M2,parent=r);box(f'ringy{z}{s}',(0.1,2.2,0.12),(s*1.05,0,z),M2,parent=r)
for dx in (-1.05,1.05):
    for dy in (-1.05,1.05):box(f'foot{dx}{dy}',(0.45,0.45,0.25),(dx*1.15,dy*1.15,0.12),('concrete','concrete',0.95),bevel=0.02,parent=r)
box('deck',(3.2,3.2,0.25),(0,0,7.25),('deck',(0x5a,0x4a,0x3a),0.9),bevel=0.02,parent=r)
for s in (-1,1):   # cab: half walls, corner posts, glazing
    box(f'wallx{s}',(2.9,0.08,1.0),(0,s*1.42,7.87),('tower_wall',(0x8a,0x7a,0x5e),0.9),bevel=0.01,parent=r)
    box(f'wally{s}',(0.08,2.9,1.0),(s*1.42,0,7.87),('tower_wall',(0x8a,0x7a,0x5e),0.9),bevel=0.01,parent=r)
for dx in (-1.42,1.42):
    for dy in (-1.42,1.42):box(f'cabpost{dx}{dy}',(0.12,0.12,1.7),(dx,dy,8.2),M2,parent=r)
for s in (-1,1):
    box(f'gx{s}',(2.7,0.03,0.55),(0,s*1.42,8.65),('glass',(0x2f,0x3a,0x44),0.15,0.2),bevel=0,parent=r)
    box(f'gy{s}',(0.03,2.7,0.55),(s*1.42,0,8.65),('glass',(0x2f,0x3a,0x44),0.15,0.2),bevel=0,parent=r)
cone=cyl('roof',2.55,0.9,(0,0,9.5),('roof_tower',(0x4a,0x3a,0x2e),0.9),verts=4,r2=0.08,bevel=0.02,parent=r);cone.rotation_euler=(0,0,math.pi/4)
box('eave',(3.5,3.5,0.12),(0,0,9.03),M2,bevel=0.02,parent=r)
# searchlight on a yoke at the front rail (the game's beam comes out of here)
box('yoke',(0.5,0.08,0.4),(0,-1.25,8.55),M2,parent=r)
cyl('lamp',0.26,0.5,(0,-1.45,8.6),M2,verts=14,rot=(math.pi/2+0.35,0,0),bevel=0.01,parent=r)
cyl('lens',0.23,0.03,(0,-1.7,8.51),('lantern',(0xff,0xd4,0x8a),0.3),verts=14,rot=(math.pi/2+0.35,0,0),bevel=0,parent=r)
for k in range(15):   # ladder up the west side
    z=0.5+k*0.46;box(f'rung{k}',(0.08,0.85,0.06),(-1.42,0,z),M2,bevel=0,parent=r)
for s in (-0.43,0.43):box(f'rail{s}',(0.08,0.08,7.0),(-1.42,s,3.5),M2,bevel=0,parent=r)
studio(elev=14,azim=-35,lens=40);frame(margin=1.06);print('tower',tris());render()

# ================= water tower (legs +/-1.3, tank r2.1 x 3.2 on 5.4 m legs, cone roof) =================
scene('WaterTower');r=root('WaterTower');WD=('wood','wood',0.9)
for dx in (-1.3,1.3):
    for dy in (-1.3,1.3):
        tube(f'leg{dx}{dy}',(dx*1.2,dy*1.2,0),(dx,dy,5.4),0.13,m=('wood_dark','wood_dark',0.9),parent=r,box_=True)
        box(f'foot{dx}{dy}',(0.5,0.5,0.25),(dx*1.2,dy*1.2,0.12),('concrete','concrete',0.95),bevel=0.02,parent=r)
for a,b in ((0.3,2.8),(2.8,5.3)):
    for s in (-1,1):
        tube(f'x{a}{s}',(-1.3,s*1.3,a),(1.3,s*1.3,b),0.03,m=MET,parent=r);tube(f'y{a}{s}',(s*1.3,-1.3,a),(s*1.3,1.3,b),0.03,m=MET,parent=r)
box('platform',(3.6,3.6,0.2),(0,0,5.4),('deck',(0x5a,0x4a,0x3a),0.9),bevel=0.02,parent=r)
cyl('tank',2.1,3.2,(0,0,5.5+1.6),('tank',(0xb9,0xb4,0xa6),0.75,0.2),verts=24,bevel=0.01,parent=r)
for k in range(24):   # vertical staves
    a=k*2*math.pi/24;box(f'stave{k}',(0.03,0.05,3.2),(math.cos(a)*2.11,math.sin(a)*2.11,7.1),('tank_dark',(0xa5,0xa0,0x92),0.8),rot=(0,0,a),bevel=0,parent=r)
for z in (5.8,6.6,7.4,8.2):cyl(f'hoop{z}',2.14,0.06,(0,0,z),MET,verts=24,bevel=0,parent=r)
cyl('roof',2.35,1.4,(0,0,8.7+0.7),('roof_tank',(0x6d,0x5a,0x44),0.9),verts=24,r2=0.06,bevel=0.01,parent=r)
text('tanktxt','CGL',(0,-2.14,7.3),0.8,('ink','ink',0.85),fontname='BigShouldersStencilDisplay',extrude=0.01,parent=r)
for k in range(11):box(f'lrung{k}',(0.6,0.05,0.05),(0,-1.55,0.5+k*0.47),MET,bevel=0,parent=r)
for s in (-0.28,0.28):box(f'lrail{s}',(0.06,0.06,5.2),(s,-1.55,2.8),MET,bevel=0,parent=r)
studio(elev=14,azim=-30,lens=40);frame(margin=1.06);print('watertower',tris());render()

bpy.ops.wm.save_mainfile()
