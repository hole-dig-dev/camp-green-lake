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

# ================= cabins: board-and-batten walls, gable roof with overhang, framed windows, porch =================
def cabin(name,W,D,H,wall,roof,warden=False):
    scene(name);r=root(name)
    WALL=('wall_'+name,wall,0.9);TRIM=('trim',(0x4a,0x35,0x25),0.85);ROOF=('roof_'+name,roof,0.9)
    box('foundation',(W+0.2,D+0.2,0.3),(0,0,0.15),('concrete','concrete',0.95),bevel=0.02,parent=r)
    box('walls',(W,D,H),(0,0,0.3+H/2),WALL,bevel=0.01,parent=r)
    # battens every 0.45 m on all four walls
    for y,rx in ((-D/2-0.012,0),(D/2+0.012,0)):
        for k in range(int(W/0.45)+1):
            x=-W/2+0.1+k*0.45
            if x>W/2-0.05:break
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
    # front (-Y): door + two windows with frames, sills and shutters
    fy=-D/2-0.02
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
        box('stoop',(2.2,1.0,0.18),(0,-D/2-0.5,0.09),('step',(0x87,0x72,0x57),0.9),bevel=0.015,parent=r)
    studio(elev=18,azim=-33,lens=40);frame(margin=1.08);print(name,tris());render()
cabin('WreckRoom',7,5,3.2,(0x9b,0x7b,0x58),(0x6d,0x5a,0x44))
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

bpy.context.window.scene=bpy.data.scenes['Camper'];bpy.ops.wm.save_mainfile()
