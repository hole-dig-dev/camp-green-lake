# blend: finds.blend
exec(open('/tmp/claude-1001/bl/finds2.py').read().split("# ---------------- cans, round 2")[0])
rnd=random.Random(606)
GRN=M_('h_safe_green',(0x2f,0x46,0x3a),0.55,0.3);BLK=M_('h_black',(0x22,0x24,0x26),0.5,0.3);GOLDT=M_('h_gold',(0xd4,0xaf,0x37),0.35,0.5);BRASS=M_('h_brass',(0xc8,0x9b,0x3c),0.4,0.5)
IRONd=M_('h_iron',(0x4a,0x4c,0x4e),0.6,0.4);CHROME=M_('h_chrome',(0xb8,0xb8,0xb0),0.3,0.6);OAK=M_('h_oak',(0x6a,0x46,0x28),0.85);OAK2=M_('h_oak2',(0x7e,0x56,0x34),0.85)
LEATH=M_('h_leather',(0x6b,0x3e,0x22),0.7);LEATH2=M_('h_leather2',(0x8a,0x5a,0x34),0.7);CANV=M_('h_canvas',(0xb8,0xa0,0x74),0.95);TAG=M_('h_tag',(0xe8,0xdc,0xb8),0.8)
def rivets(prefix,parent,pts,m=GOLDT,r=0.018,axis='y',sign=-1):
    for k,p in enumerate(pts):
        rot=(math.pi/2,0,0) if axis=='y' else (0,math.pi/2,0)
        cyl(f'{prefix}{k}',r,0.01,p,m,verts=8,rot=rot,bevel=0,parent=parent)
def rust_over(objs,amount=0.1,seed=0,base=(0x4a,0x4c,0x4e)):
    for o in objs:vpaint(o,[(0,base),(0.5-amount,base),(0.6-amount,(0x8a,0x4b,0x2a)),(0.78-amount,(0x5a,0x30,0x1a))],freq=6,seed=seed)
def dense_box(name,size,loc,parent,cuts=6):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.active_object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(scale=True)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.subdivide_edges(bm,edges=bm.edges[:],cuts=cuts,use_grid_fill=True);bm.to_mesh(o.data);bm.free()
    for p in o.data.polygons:p.use_smooth=False
    _link(o);o.parent=parent;return o
def heavy_finish(n,elev=18,azim=-32):
    studio(elev=elev,azim=azim,lens=50);frame(margin=1.2);f=ob(n+'.floor');f.data.materials.clear();f.data.materials.append(mat('kb_sand',(0xe3,0xbf,0x86),0.95))
    render(n,res=(512,512),samples=48);print(n,tris())

# ======================= Mr. Sir's pickup (cab at -Y, tailgate at +Y) =======================
scene('MrSirTruck');r=root('MrSirTruck')
PAINT=(0x5f,0x8a,0x7a);RUSTY=[(0,PAINT),(0.68,PAINT),(0.74,(0x8a,0x4b,0x2a)),(0.86,(0x5a,0x30,0x1a))]   # mostly paint, rust at the edges of patches
def painted(o,seed):vpaint(o,RUSTY,freq=5,seed=seed)
box('chassis',(1.5,4.6,0.2),(0,0,0.55),M_('h_chassis',(0x26,0x26,0x24),0.8,0.3),bevel=0.02,parent=r)
for y in (-1.45,1.35):
    for s in (-1,1):
        cyl(f'tyre{y}{s}',0.38,0.26,(s*0.86,y,0.38),M_('h_tyre',(0x1e,0x1e,0x1c),0.9),verts=16,rot=(0,math.pi/2,0),bevel=0.03,parent=r)
        cyl(f'hub{y}{s}',0.2,0.28,(s*0.86,y,0.38),CHROME,verts=12,rot=(0,math.pi/2,0),bevel=0.01,parent=r)
cab=dense_box('cab',(1.7,1.3,1.05),(0,-0.55,1.35),r,cuts=4);painted(cab,1);cab.modifiers.new('b','BEVEL').width=0.1
roof=dense_box('roof',(1.6,1.15,0.12),(0,-0.55,1.9),r,cuts=3);painted(roof,2);roof.modifiers.new('b','BEVEL').width=0.05
hood=dense_box('hood',(1.3,1.3,0.55),(0,-1.85,1.05),r,cuts=4);painted(hood,3);hood.modifiers.new('b','BEVEL').width=0.12
for s in (-1,1):
    f=dense_box(f'fender{s}',(0.42,1.2,0.35),(s*0.83,-1.55,0.88),r,cuts=3);painted(f,4+s);f.modifiers.new('b','BEVEL').width=0.14
    f2=dense_box(f'rfender{s}',(0.36,1.0,0.3),(s*0.86,1.35,0.88),r,cuts=3);painted(f2,6+s);f2.modifiers.new('b','BEVEL').width=0.12
    cyl(f'headlight{s}',0.12,0.1,(s*0.78,-2.15,1.1),CHROME,verts=12,rot=(math.pi/2,0,0),bevel=0.01,parent=r)
    cyl(f'lens{s}',0.1,0.02,(s*0.78,-2.21,1.1),M_('h_lens',(0xff,0xe8,0xb0),0.3),verts=12,rot=(math.pi/2,0,0),bevel=0,parent=r)
    box(f'board{s}',(0.25,1.3,0.05),(s*0.92,-0.3,0.66),M_('h_chassis',(0x26,0x26,0x24),0.8,0.3),bevel=0.01,parent=r)
    box(f'sidewin{s}',(0.02,0.7,0.42),(s*0.855,-0.5,1.55),M_('glass',(0x2f,0x3a,0x44),0.15,0.2),bevel=0,parent=r)
    box(f'mirror{s}',(0.05,0.14,0.2),(s*0.98,-1.05,1.6),CHROME,bevel=0.01,parent=r)
box('windshield',(1.45,0.04,0.45),(0,-1.22,1.58),M_('glass',(0x2f,0x3a,0x44),0.15,0.2),rot=(math.radians(-12),0,0),bevel=0,parent=r)
box('backwin',(1.1,0.03,0.35),(0,0.11,1.6),M_('glass',(0x2f,0x3a,0x44),0.15,0.2),bevel=0,parent=r)
box('grille',(1.0,0.06,0.45),(0,-2.5,0.95),CHROME,bevel=0.02,parent=r)
for k in range(7):box(f'gbar{k}',(0.04,0.08,0.42),(-0.42+k*0.14,-2.53,0.95),M_('h_dark',(0x22,0x22,0x22),0.5,0.3),bevel=0,parent=r)
box('bumper',(1.8,0.14,0.16),(0,-2.62,0.62),CHROME,bevel=0.04,parent=r);box('rbumper',(1.7,0.12,0.14),(0,2.35,0.62),CHROME,bevel=0.03,parent=r)
# the bed: floor, sides, headboard and the tailgate (dropped open, toward Mr. Sir)
box('bedfloor',(1.55,2.2,0.08),(0,1.2,0.78),M_('h_bedwood',(0x7a,0x5a,0x3a),0.9),bevel=0.01,parent=r)
for s in (-1,1):
    w=dense_box(f'bedside{s}',(0.08,2.2,0.55),(s*0.75,1.2,1.07),r,cuts=4);painted(w,10+s)
hb=dense_box('headboard',(1.55,0.08,0.55),(0,0.12,1.07),r,cuts=4);painted(hb,12)
tg=dense_box('tailgate',(1.5,0.5,0.06),(0,2.55,0.78),r,cuts=4);painted(tg,13)   # dropped flat, hinged at the end of the bed
text('tgtxt','CGL',(0,2.55,0.815),0.22,M_('h_white',(0xee,0xe0,0xbc),0.8),fontname='BigShouldersStencilDisplay',rot=(0,0,math.pi),extrude=0.004,parent=r)
for s in (-1,1):tube(f'tgchain{s}',(s*0.72,2.3,1.3),(s*0.72,2.78,0.82),0.01,IRON,r)
# in the bed: shovel, jerry can, and his sack of sunflower seeds
tube('shovelh',(-0.5,0.4,0.85),(0.2,2.0,0.9),0.025,M_('h_handle',(0x8a,0x6a,0x44),0.85),r)
box('shovelb',(0.26,0.34,0.03),(0.3,2.2,0.9),M_('h_blade',(0x70,0x74,0x72),0.6,0.3),rot=(0,0,-0.4),bevel=0.01,parent=r)
box('jerry',(0.18,0.34,0.44),(0.5,0.45,1.04),M_('h_red',(0x9a,0x2e,0x22),0.6,0.2),bevel=0.03,parent=r)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=0.3,location=(-0.35,1.4,1.0));o=bpy.context.active_object;o.name='seedsack';o.scale=(1,0.85,1.1);_finish(o,M_('h_burlap',(0xb8,0x94,0x62),0.95),0,r)
text('seeds','SEEDS',(-0.35,1.14,1.02),0.1,INK,rot=(math.pi/2,0,0),extrude=0.003,parent=r)
heavy_finish('MrSirTruck',elev=20,azim=-140)

# ======================= Old iron safe x5 (1.1 wide, 1.0 deep, 1.1 tall; door faces -Y) =======================
def safe_body(parent,paint,W=1.1,D=1.0,H=1.05,seed=0,rust=None):
    b=dense_box('body',(W,D,H),(0,0,0.12+H/2),parent,cuts=5)
    if rust is None:b.data.materials.append(mat(*paint))
    else:rust_over([b],rust,seed,base=paint[1])
    for s in (-1,1):
        for t in (-1,1):cyl(f'foot{s}{t}',0.07,0.12,(s*(W/2-0.1),t*(D/2-0.1),0.06),BLK,verts=8,bevel=0.01,parent=parent)
    return b
def dial(parent,y,z,x=0.0,r=0.13):
    cyl('dialring',r*1.2,0.02,(x,y-0.01,z),GOLDT,verts=20,rot=(math.pi/2,0,0),bevel=0.004,parent=parent)
    cyl('dial',r,0.05,(x,y-0.03,z),BLK,verts=20,rot=(math.pi/2,0,0),bevel=0.006,parent=parent)
    cyl('knob',r*0.35,0.05,(x,y-0.07,z),GOLDT,verts=12,rot=(math.pi/2,0,0),bevel=0.004,parent=parent)
def handle(parent,y,z,x=0.3):
    for dz in (-0.12,0.12):cyl(f'hb{dz}',0.025,0.08,(x,y-0.04,z+dz),GOLDT,verts=8,rot=(math.pi/2,0,0),bevel=0,parent=parent)
    cyl('hbar',0.022,0.3,(x,y-0.08,z),GOLDT,verts=8,bevel=0,parent=parent)
n='Safe_1';scene(n);r=root(n);safe_body(r,GRN);y=-0.5
box('door',(0.86,0.03,0.82),(0,y-0.015,0.65),GRN,bevel=0.01,parent=r);box('trim',(0.9,0.02,0.86),(0,y-0.005,0.65),GOLDT,bevel=0,parent=r)
dial(r,y-0.03,0.78);handle(r,y-0.03,0.5);text('co','CAMP GREEN LAKE',(0,y-0.035,1.0),0.06,GOLDT,extrude=0.003,parent=r);heavy_finish(n)
n='Safe_2';scene(n);r=root(n);safe_body(r,('h_iron',(0x4a,0x4c,0x4e),0.6,0.4),seed=2,rust=0.18);y=-0.5
box('door',(0.86,0.03,0.82),(0,y-0.015,0.65),IRONd,bevel=0.01,parent=r);dial(r,y-0.03,0.78);handle(r,y-0.03,0.5)
clump(r,14,0.04,0.09,rad=(0.6,0.9),seed=2);heavy_finish(n)
n='Safe_3';scene(n);r=root(n);safe_body(r,BLK,W=1.0,H=1.35);y=-0.5
for s in (-1,1):box(f'door{s}',(0.4,0.03,1.1),(s*0.21,y-0.015,0.8),BLK,bevel=0.01,parent=r);box(f'dtrim{s}',(0.36,0.02,1.04),(s*0.21,y-0.03,0.8),GOLDT,bevel=0,parent=r);box(f'dinner{s}',(0.3,0.022,0.98),(s*0.21,y-0.032,0.8),BLK,bevel=0,parent=r)
bpy.ops.mesh.primitive_torus_add(major_radius=0.14,minor_radius=0.02,major_segments=16,minor_segments=6,location=(0,y-0.09,0.85));o=bpy.context.active_object;o.name='wheel';o.rotation_euler=(math.pi/2,0,0);_finish(o,GOLDT,0,r)
for k in range(4):a=k*math.pi/4;box(f'spoke{k}',(0.26,0.02,0.02),(0,y-0.09,0.85),GOLDT,rot=(0,a,0),bevel=0,parent=r)
heavy_finish(n)
n='Safe_4';scene(n);r=root(n);safe_body(r,M_('h_safe_red',(0x6a,0x1e,0x1a),0.5,0.3),W=1.2,H=0.95);y=-0.5
box('panel',(0.9,0.03,0.6),(0,y-0.015,0.62),M_('h_safe_red',(0x6a,0x1e,0x1a),0.5,0.3),bevel=0.01,parent=r)
for s in (-1,1):box(f'scroll{s}',(0.3,0.02,0.04),(s*0.25,y-0.03,0.95),GOLDT,rot=(0,s*0.3,0),bevel=0,parent=r)
text('wells','WELLS & CO.',(0,y-0.035,0.4),0.07,GOLDT,extrude=0.003,parent=r);dial(r,y-0.03,0.68,x=-0.18,r=0.1);handle(r,y-0.03,0.68,x=0.25);heavy_finish(n)
n='Safe_5';scene(n);r=root(n);safe_body(r,GRN);y=-0.5;dial(r,y-0.03,0.78);handle(r,y-0.03,0.5)
for z in (0.45,0.9):
    for s in (-1,1):
        for k in range(10):
            p=(s*0.56 if k<3 or k>6 else -0.5+k*0.11, (-0.52+k*0.11) if (k<3 or k>6) else -0.53, z)
        box(f'chainband{z}{s}',(1.16,1.06,0.05),(0,0,z),IRONd,bevel=0.01,parent=r)
cyl('padlock',0.09,0.05,(0,-0.56,0.6),BRASS,verts=12,rot=(math.pi/2,0,0),bevel=0.01,parent=r)
bpy.ops.mesh.primitive_torus_add(major_radius=0.06,minor_radius=0.012,location=(0,-0.56,0.68));o=bpy.context.active_object;o.name='shackle';o.rotation_euler=(math.pi/2,0,0);_finish(o,CHROME,0,r)
heavy_finish(n)

# ======================= Kate's strongbox x5 (1.2 x 0.8 x 0.7) =======================
n='Box_1';scene(n);r=root(n);b=dense_box('chest',(1.2,0.8,0.62),(0,0,0.31),r,cuts=5);vpaint(b,[(0,(0x6a,0x46,0x28)),(0.5,(0x7e,0x56,0x34)),(1,(0x5a,0x3a,0x22))],freq=3,seed=1)
for x in (-0.4,0.4):box(f'band{x}',(0.1,0.84,0.66),(x,0,0.33),IRONd,bevel=0.01,parent=r)
box('lidline',(1.24,0.84,0.04),(0,0,0.5),IRONd,bevel=0.005,parent=r);box('hasp',(0.12,0.04,0.18),(0,-0.42,0.45),IRONd,bevel=0.01,parent=r);cyl('lock',0.07,0.05,(0,-0.45,0.36),BRASS,verts=12,rot=(math.pi/2,0,0),bevel=0.01,parent=r)
for s in (-1,1):bpy.ops.mesh.primitive_torus_add(major_radius=0.08,minor_radius=0.015,location=(s*0.62,0,0.4));o=bpy.context.active_object;o.name=f'ring{s}';o.rotation_euler=(0,math.pi/2,0);_finish(o,IRONd,0,r)
heavy_finish(n)
n='Box_2';scene(n);r=root(n);b=dense_box('box',(1.2,0.8,0.6),(0,0,0.3),r,cuts=5);b.data.materials.append(mat(*M_('h_green_box',(0x3a,0x4a,0x3a),0.6,0.3)))
for sx in (-1,1):
    for sy in (-1,1):
        for sz in (0,1):box(f'corner{sx}{sy}{sz}',(0.14,0.14,0.14),(sx*0.56,sy*0.36,0.06+sz*0.48),BRASS,bevel=0.01,parent=r)
    box(f'handle{sx}',(0.04,0.3,0.05),(sx*0.63,0,0.4),BRASS,bevel=0.01,parent=r)
box('lidseam',(1.22,0.82,0.02),(0,0,0.46),BRASS,bevel=0,parent=r);cyl('lock',0.06,0.04,(0,-0.42,0.38),BRASS,verts=12,rot=(math.pi/2,0,0),bevel=0.01,parent=r);heavy_finish(n)
n='Box_3';scene(n);r=root(n);b=dense_box('base',(1.2,0.8,0.45),(0,0,0.225),r,cuts=5);b.data.materials.append(mat(*OAK))
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=0.4,depth=1.2,location=(0,0,0.45),rotation=(0,math.pi/2,0));o=bpy.context.active_object;o.name='dome'
bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
bm=bmesh.new();bm.from_mesh(o.data)
for v in bm.verts:
    if v.co.z<0:v.co.z=0   # flatten the lower half: a half-round lid
    v.co.z*=0.6
bm.to_mesh(o.data);bm.free();_finish(o,OAK2,0,r)
for x in (-0.45,0,0.45):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.41,minor_radius=0.025,major_segments=24,minor_segments=4,location=(x,0,0.45),rotation=(0,math.pi/2,0));o=bpy.context.active_object;o.name=f'hoop{x}';bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    for v in o.data.vertices:
        v.co.z=max(v.co.z,-0.02)*0.6
    _finish(o,IRONd,0,r)
text('kb','K.B.',(0,-0.405,0.26),0.14,GOLDT,extrude=0.006,parent=r);cyl('lock',0.06,0.04,(0,-0.42,0.42),BRASS,verts=12,rot=(math.pi/2,0,0),bevel=0.01,parent=r);heavy_finish(n)
n='Box_4';scene(n);r=root(n);b=dense_box('box',(1.2,0.8,0.62),(0,0,0.31),r,cuts=6);rust_over([b],0.12,4)
pts=[(x,-0.405,z) for x in (-0.55,-0.3,-0.05,0.2,0.45) for z in (0.08,0.54)]+[(x,-0.405,z) for x in (-0.55,0.55) for z in (0.23,0.38)]
rivets('rv',r,pts,m=IRONd,r=0.022);box('lidseam',(1.22,0.82,0.03),(0,0,0.48),IRONd,bevel=0,parent=r);heavy_finish(n)
n='Box_5';scene(n);r=root(n);b=dense_box('box',(1.2,0.8,0.6),(0,0,0.3),r,cuts=5);vpaint(b,[(0,(0x6b,0x3e,0x22)),(0.5,(0x7a,0x48,0x28)),(0.7,(0x4a,0x2a,0x16))],freq=5,seed=5)
pts=[(x,-0.405,z) for x in [i*0.1-0.55 for i in range(12)] for z in (0.05,0.55)]
rivets('stud',r,pts,m=BRASS,r=0.015)
for x in (-0.3,0.3):box(f'strap{x}',(0.1,0.84,0.64),(x,0,0.31),LEATH2,bevel=0.01,parent=r);box(f'buckle{x}',(0.12,0.03,0.1),(x,-0.43,0.4),BRASS,bevel=0.005,parent=r)
heavy_finish(n)

# ======================= Stanley Yelnats' suitcase x5 (~0.7 x 0.22 x 0.48) =======================
def case(parent,m,W=0.7,D=0.22,H=0.48,seed=0,paint=None):
    b=dense_box('case',(W,D,H),(0,0,H/2),parent,cuts=5)
    if paint:vpaint(b,paint,freq=6,seed=seed)
    else:b.data.materials.append(mat(*m))
    bev=b.modifiers.new('b','BEVEL');bev.width=0.03;bev.segments=2
    tube('handle1',(-0.1,0,H+0.005),(-0.08,0,H+0.07),0.015,LEATH,parent);tube('handle2',(0.08,0,H+0.07),(0.1,0,H+0.005),0.015,LEATH,parent);tube('handle3',(-0.08,0,H+0.07),(0.08,0,H+0.07),0.016,LEATH,parent)
    return b
def nametag(parent,x,z,D=0.22):
    box('tag',(0.14,0.006,0.08),(x,-D/2-0.012,z),TAG,rot=(0,0,0),bevel=0.002,parent=parent)
    text('tag1','STANLEY',(x,-D/2-0.016,z+0.015),0.022,INK,extrude=0.0008,parent=parent);text('tag2','YELNATS',(x,-D/2-0.016,z-0.015),0.022,INK,extrude=0.0008,parent=parent)
n='Case_1';scene(n);r=root(n);case(r,LEATH)
for x in (-0.2,0.2):box(f'strap{x}',(0.05,0.235,0.49),(x,0,0.245),LEATH2,bevel=0.004,parent=r);box(f'buck{x}',(0.06,0.02,0.05),(x,-0.12,0.33),BRASS,bevel=0.003,parent=r)
nametag(r,0.0,0.18);heavy_finish(n,elev=15)
n='Case_2';scene(n);r=root(n);case(r,LEATH2)
for k,(x,z,c) in enumerate(((-0.22,0.33,(0xc8,0x3a,0x2a)),(0.18,0.12,(0x2f,0x5f,0x8a)),(0.22,0.35,(0xd9,0xa2,0x1a)),(-0.18,0.12,(0x3f,0x6a,0x3a)))):
    cyl(f'sticker{k}',0.07,0.004,(x,-0.113,z),M_(f'h_st{k}',c,0.8),verts=12,rot=(math.pi/2,0,rnd.uniform(0,1)),bevel=0,parent=r)
nametag(r,0.0,0.24);heavy_finish(n,elev=15)
n='Case_3';scene(n);r=root(n);case(r,None,paint=[(0,(0x5a,0x3a,0x22)),(0.45,(0x6a,0x46,0x28)),(0.6,(0xa0,0x80,0x55)),(0.8,(0xc4,0xa2,0x70))],seed=3)
for x in (-0.22,0.22):box(f'latch{x}',(0.07,0.02,0.05),(x,-0.115,0.44),BRASS,bevel=0.003,parent=r)
for sx in (-1,1):
    for sz in (0,1):box(f'corner{sx}{sz}',(0.07,0.24,0.07),(sx*0.33,0,0.035+sz*0.41),BRASS,bevel=0.008,parent=r)
clump(r,8,0.02,0.04,rad=(0.35,0.5),seed=3);nametag(r,0.0,0.22);heavy_finish(n,elev=15)
n='Case_4';scene(n);r=root(n);case(r,CANV)
for sx in (-1,1):
    for sz in (0,1):box(f'lcorner{sx}{sz}',(0.09,0.235,0.09),(sx*0.32,0,0.045+sz*0.39),LEATH,bevel=0.01,parent=r)
box('trim',(0.71,0.235,0.03),(0,0,0.3),LEATH,bevel=0.004,parent=r);nametag(r,0.0,0.16);heavy_finish(n,elev=15)
n='Case_5';scene(n);r=root(n);b=dense_box('trunk',(0.72,0.36,0.42),(0,0,0.21),r,cuts=4);b.data.materials.append(mat(*OAK))
for x in (-0.24,0.24):box(f'band{x}',(0.05,0.38,0.44),(x,0,0.22),BRASS,bevel=0.004,parent=r)
box('lid',(0.74,0.38,0.04),(0,0,0.36),LEATH,bevel=0.005,parent=r);cyl('lock',0.035,0.02,(0,-0.19,0.33),BRASS,verts=10,rot=(math.pi/2,0,0),bevel=0.004,parent=r)
nametag(r,0.0,0.15,D=0.36);heavy_finish(n,elev=15)
bpy.ops.wm.save_mainfile()
