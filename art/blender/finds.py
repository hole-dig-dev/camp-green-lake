# blend: finds.blend
exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
import bmesh,re
rnd=random.Random(77)
def ob(name):
    sc=bpy.context.window.scene
    return next(o for o in sc.objects if o.name==name or re.match(re.escape(name)+r'\.\d+$',o.name))
def M_(n,c,r=0.8,m=0.0):return (n,c,r,m)
RUST=M_('f_rust',(0x8a,0x4b,0x2a),0.9,0.1);RUST2=M_('f_rust2',(0x6e,0x3a,0x22),0.95,0.1);TIN=M_('f_tin',(0xb0,0xb0,0xa8),0.45,0.5)
RED=M_('f_capred',(0xb8,0x30,0x28),0.5,0.2);CREAM=M_('f_cream',(0xee,0xe0,0xbc),0.6,0.1);CORK=M_('f_cork',(0xb8,0x94,0x62),0.95)
SILV=M_('f_silver',(0xc8,0xc8,0xc0),0.35,0.5);TARN=M_('f_tarnish',(0x7a,0x74,0x62),0.7,0.3);IRON=M_('f_iron',(0x5f,0x5f,0x5a),0.7,0.4)
FLINT=M_('f_flint',(0x8a,0x80,0x72),0.6);OBS=M_('f_obsidian',(0x1c,0x1a,0x1e),0.15,0.1);JASP=M_('f_jasper',(0xa0,0x3c,0x28),0.5)
WOOD=M_('f_wood',(0x7a,0x5a,0x3a),0.9);SINEW=M_('f_sinew',(0xc9,0xb2,0x86),0.95);GLASS=M_('f_glass',(0xc8,0xe0,0xd0),0.1,0)
PEACH=M_('f_peach',(0xe8,0x8a,0x2a),0.6);SYRUP=M_('f_syrup',(0xe8,0xa8,0x50),0.2);LABEL=M_('f_label',(0xe0,0xcf,0xa3),0.9);CLOTH=M_('f_cloth',(0xa6,0x44,0x2e),0.95)
STONE=M_('f_stone',(0xd8,0xcc,0xb0),0.95);STONE2=M_('f_stone2',(0xb8,0xa8,0x88),0.95);BONE=M_('f_bone',(0x8a,0x78,0x5c),0.9);DIRT=M_('f_dirt',(0x9a,0x72,0x48),0.95)
INK=M_('f_ink',(0x2b,0x1d,0x12),0.8)
def tube(name,a,b,r,m,parent,verts=8):
    a,b=Vector(a),Vector(b);d=b-a;o=cyl(name,r,d.length,(a+b)/2,m,verts=verts,bevel=0,parent=parent);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def meshobj(name,vs,fs,m,parent,solid=0):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.window.scene.collection.objects.link(o);o=_finish(o,m,0,parent)
    if solid:o.modifiers.new('s','SOLIDIFY').thickness=solid
    return o
def bend(o,fn):
    for v in o.data.vertices:v.co=fn(v.co.copy())
def clump(parent,n,r0,r1,zmax=0.01,rad=(0.03,0.06),seed=0):
    rr=random.Random(seed)
    for k in range(n):
        a=rr.uniform(0,6.28);d=rr.uniform(*rad);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=rr.uniform(r0,r1),location=(math.cos(a)*d,math.sin(a)*d,rr.uniform(0,zmax)));o=bpy.context.active_object;o.name=f'dirt{k}';_finish(o,DIRT,0,parent)
def finish(n,elev=28,azim=-28,margin=1.35):
    studio(elev=elev,azim=azim,lens=85);frame(margin=margin)
    f=ob(n+'.floor');f.data.materials.clear();f.data.materials.append(mat('kb_sand',(0xe3,0xbf,0x86),0.95))
    render(n,res=(512,512),samples=48);print(n,tris())

# ---------------- bottle cap (2.6 cm) ----------------
def crimped(name,parent,top,side,r=0.013,h=0.006,teeth=21,squash=None):
    cyl(name+'_top',r,0.0012,(0,0,h),top,verts=teeth*2,bevel=0,parent=parent)
    vs=[];fs=[];N=teeth*2
    for i in range(N):
        a=i/N*6.2832;rr=r*(1.08 if i%2 else 0.98)
        vs+= [(math.cos(a)*r,math.sin(a)*r,h),(math.cos(a)*rr*1.05,math.sin(a)*rr*1.05,0)]
    for i in range(N):j=(i+1)%N;fs.append((2*i,2*j,2*j+1,2*i+1))
    return meshobj(name+'_skirt',vs,fs,side,parent,solid=0.0008)
n='Cap_1';scene(n);r=root(n);crimped('c',r,RED,RED);cyl('ring',0.009,0.0014,(0,0,0.0068),CREAM,verts=24,bevel=0,parent=r);finish(n)
n='Cap_2';scene(n);r=root(n);g=root('g');g.parent=r;crimped('c',g,RUST,RUST2)
for o in list(coll('Asset').all_objects):
    if o.type=='MESH':bend(o,lambda c:Vector((c.x,c.y,c.z+abs(c.x)*0.9)))   # folded like it was stepped on
g.rotation_euler=(0,0,0.5);finish(n)
n='Cap_3';scene(n);r=root(n);crimped('c',r,CREAM,RED);text('star','*',(0,0,0.0075),0.02,RED,rot=(0,0,0),extrude=0.0005,parent=r);finish(n,elev=45)
n='Cap_4';scene(n);r=root(n);crimped('c',r,RUST,RUST2,teeth=19);clump(r,6,0.002,0.004,rad=(0.012,0.02),seed=4)
for o in [x for x in coll('Asset').all_objects if x.type=='MESH' and x.name.startswith('c_')]:bend(o,lambda c:Vector((c.x,c.y,c.z*0.5+0.002*math.sin(c.x*300))))
finish(n)
n='Cap_5';scene(n);r=root(n);g=root('g');g.parent=r;crimped('c',g,TIN,TIN);cyl('cork',0.0115,0.0015,(0,0,0.0045),CORK,verts=24,bevel=0,parent=g);g.rotation_euler=(math.pi,0,0);g.location=(0,0,0.0075);finish(n,elev=40)

# ---------------- rusty can (12 cm) ----------------
def can(name,parent,h=0.12,r=0.037,ribs=True,m=TIN,rustn=10,seed=0):
    rr=random.Random(seed);segs=8
    for k in range(segs):
        o=cyl(name+f'_seg{k}',r,h/segs,(0,0,h/segs*(k+0.5)),m,verts=20,bevel=0,parent=parent)
        o.data.materials.append(mat(*RUST));o.data.materials.append(mat(*RUST2))
        for p in o.data.polygons:
            if len(p.vertices)==4 and rr.random()<rustn/40:p.material_index=1 if rr.random()<0.6 else 2
    b=o
    for z in (0.004,h-0.004):cyl(name+f'_rim{z}',r*1.04,0.006,(0,0,z),m,verts=20,bevel=0,parent=parent)
    if ribs:
        for k in range(4):cyl(name+f'_rib{k}',r*1.012,0.004,(0,0,h*0.25+k*h*0.17),m,verts=20,bevel=0,parent=parent)
    return b
n='Can_1';scene(n);r=root(n);can('can',r,seed=1);finish(n,elev=22)
n='Can_2';scene(n);r=root(n);can('can',r,seed=2,rustn=14)
for o in [x for x in coll('Asset').all_objects if x.type=='MESH']:bend(o,lambda c:Vector((c.x*(1+0.25*math.sin(c.z*50)),c.y*(0.6+0.25*abs(math.sin(c.z*35))),c.z*0.7)))   # crushed
finish(n,elev=30)
n='Can_3';scene(n);r=root(n);can('can',r,seed=3,rustn=12)
lid=cyl('lid',0.036,0.002,(0.03,0,0.125),TIN,verts=20,rot=(0,math.radians(-70),0),bevel=0,parent=r)   # lid peeled back
for k in range(8):box(f'jag{k}',(0.006,0.004,0.006),(math.cos(k*0.8)*0.035,math.sin(k*0.8)*0.035,0.123),TIN,rot=(rnd.uniform(-0.5,0.5),rnd.uniform(-0.5,0.5),k),bevel=0,parent=r)
finish(n,elev=35)
n='Can_4';scene(n);r=root(n);can('can',r,seed=4,rustn=6,ribs=False);cyl('label',0.0378,0.07,(0,0,0.06),LABEL,verts=20,bevel=0,parent=r);cyl('stripe',0.038,0.018,(0,0,0.06),RED,verts=20,bevel=0,parent=r)
text('beans','BEANS',(0,-0.0385,0.061),0.013,CREAM,extrude=0.0004,parent=r);finish(n,elev=18)
n='Can_5';scene(n);r=root(n);g=root('g');g.parent=r;g.rotation_euler=(math.pi/2,0,0.4);g.location=(0,0,0.037);can('can',g,seed=5,rustn=16)
for k in range(4):cyl(f'hole{k}',0.004,0.003,(0.0372*math.cos(k*0.5-0.8),-0.0372*math.sin(k*0.5-0.8)*0,0.03+k*0.018),INK,verts=8,rot=(0,math.pi/2,0),bevel=0,parent=g)
clump(r,7,0.004,0.009,rad=(0.03,0.07),seed=5);finish(n)

# ---------------- old spoon (17 cm) ----------------
def spoon(name,parent,m,bowl=(0.02,0.03),L=0.17,ornate=False,bent=0.0,wood=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(0,-L*0.36,0.006));b=bpy.context.active_object;b.name=name+'_bowl'
    b.scale=(bowl[0],bowl[1],0.006);bpy.ops.object.transform_apply(scale=True);_finish(b,m,0,parent)
    h=box(name+'_handle',(0.009 if not wood else 0.012,L*0.62,0.003 if not wood else 0.006),(0,L*0.12,0.008),m,bevel=0.0015,parent=parent)
    if ornate:
        cyl(name+'_end',0.009,0.004,(0,L*0.43,0.008),m,verts=12,bevel=0.001,parent=parent)
        for k in range(3):box(name+f'_orn{k}',(0.011,0.003,0.004),(0,L*0.34+k*0.008,0.009),m,bevel=0,parent=parent)
    if bent:
        for o in (b,h):bend(o,lambda c:Vector((c.x,c.y,c.z+max(0,c.y)*bent)))
n='Spoon_1';scene(n);r=root(n);spoon('s',r,TARN);finish(n,elev=40)
n='Spoon_2';scene(n);r=root(n);spoon('s',r,SILV,ornate=True);finish(n,elev=40)
n='Spoon_3';scene(n);r=root(n);spoon('s',r,TARN,bent=0.6);finish(n,elev=25)
n='Spoon_4';scene(n);r=root(n);spoon('s',r,SILV);text('init','SY',(0,0.06,0.0098),0.01,TARN,rot=(0,0,math.pi/2),extrude=0.0004,parent=r);finish(n,elev=40)
n='Spoon_5';scene(n);r=root(n);spoon('s',r,WOOD,bowl=(0.022,0.028),wood=True);finish(n,elev=40)

# ---------------- horseshoe (13 cm) ----------------
def shoe(name,parent,m,thick=0.022,width=0.012,nails=False,holes=True):
    vs=[];fs=[];N=18
    for i in range(N+1):
        a=math.radians(-35)+i/N*math.radians(250);ro,ri=0.065,0.065-thick
        for (rr,z) in ((ro,0),(ri,0),(ri,width),(ro,width)):vs.append((math.cos(a)*rr,math.sin(a)*rr,z))
    for i in range(N):
        a=i*4;b=a+4
        for k in range(4):fs.append((a+k,a+(k+1)%4,b+(k+1)%4,b+k))
    fs.append((0,1,2,3));fs.append((N*4+3,N*4+2,N*4+1,N*4))
    o=meshobj(name,vs,fs,m,parent)
    if holes:
        for k in range(6):
            a=math.radians(-15+k*40+ (20 if k>2 else 0));cyl(name+f'_hole{k}',0.003,0.003,(math.cos(a)*0.054,math.sin(a)*0.054,width+0.0005),INK,verts=6,bevel=0,parent=parent)
            if nails and k%2==0:box(name+f'_nail{k}',(0.004,0.004,0.012),(math.cos(a)*0.054,math.sin(a)*0.054,width+0.006),IRON,rot=(0.3,0.2,a),bevel=0,parent=parent)
    return o
n='Shoe_1';scene(n);r=root(n);shoe('h',r,RUST);finish(n,elev=45)
n='Shoe_2';scene(n);r=root(n);shoe('h',r,IRON,nails=True);finish(n,elev=40)
n='Shoe_3';scene(n);r=root(n);shoe('h',r,RUST2,thick=0.015,width=0.008);finish(n,elev=45)
n='Shoe_4';scene(n);r=root(n);shoe('h',r,IRON,thick=0.03,width=0.016);finish(n,elev=40)
n='Shoe_5';scene(n);r=root(n);shoe('h',r,RUST);clump(r,10,0.005,0.01,rad=(0.03,0.07),seed=9);finish(n,elev=45)

# ---------------- arrowhead (6 cm) ----------------
def point(name,parent,m,L=0.06,W=0.028,notch=True,facets=7,seed=0):
    """A knapped point: tip, straight edges to the shoulders, barbs, notches and a short stem; a raised centre ridge
    and chipped facets (each edge vertex nudged) so it reads as worked stone."""
    rr=random.Random(seed);j=lambda v:v*(1+rr.uniform(-0.08,0.08))
    right=[(j(W*0.18),L*0.28),(j(W*0.33),L*0.02),(W/2,-L*0.2)]
    if notch:right+=[(W*0.44,-L*0.3),(W*0.16,-L*0.24),(W*0.16,-L*0.46)]
    else:right+=[(W*0.3,-L*0.42)]
    ring=[(0,L/2)]+right+[(0,-L/2 if notch else -L*0.42)]+[(-x*(1+rr.uniform(-0.06,0.06)),y) for x,y in reversed(right)]
    n=len(ring);verts=[(x,y,0) for x,y in ring]+[(0,-L*0.05,0.006),(0,-L*0.05,-0.006)]
    fs=[(i,(i+1)%n,n) for i in range(n)]+[((i+1)%n,i,n+1) for i in range(n)]
    return meshobj(name,verts,fs,m,parent)
n='Arrow_1';scene(n);r=root(n);point('a',r,FLINT,seed=1);finish(n,elev=50)
n='Arrow_2';scene(n);r=root(n);point('a',r,OBS,seed=2,W=0.024);finish(n,elev=50)
n='Arrow_3';scene(n);r=root(n);point('a',r,JASP,seed=3,notch=False);finish(n,elev=50)
n='Arrow_4';scene(n);r=root(n);point('a',r,FLINT,seed=4);tube('shaft',(0,-0.03,0),(0,-0.13,0.004),0.004,WOOD,r)
for k in range(5):cyl(f'wrap{k}',0.0048,0.002,(0,-0.032-k*0.0025,0),SINEW,verts=8,rot=(math.pi/2,0,0),bevel=0,parent=r)
finish(n,elev=45)
n='Arrow_5';scene(n);r=root(n);point('a',r,STONE2,seed=5,L=0.05,W=0.036,facets=5);finish(n,elev=50)

# ---------------- jar of spiced peaches (12 cm) ----------------
def glassify(m,alpha=0.3):
    b=m.node_tree.nodes['Principled BSDF'];b.inputs['Alpha'].default_value=alpha
    try:m.surface_render_method='BLENDED'
    except Exception:m.blend_method='BLEND'
    return m
def jar(name,parent,lid=TIN,fill=0.8,label=False,cloth=False,bail=False,dusty=False):
    g=GLASS if not dusty else M_('f_glass_dusty',(0xb8,0xb0,0x98),0.6,0)
    body=cyl(name+'_glass',0.035,0.1,(0,0,0.05),g,verts=20,bevel=0.004,parent=parent);glassify(body.data.materials[0],0.28 if not dusty else 0.6)
    glassify(cyl(name+'_neck',0.028,0.012,(0,0,0.106),g,verts=20,bevel=0,parent=parent).data.materials[0],0.28 if not dusty else 0.6)
    glassify(cyl(name+'_syrup',0.032,0.095*fill,(0,0,0.003+0.095*fill/2),SYRUP,verts=20,bevel=0,parent=parent).data.materials[0],0.35)
    rr=random.Random(3)
    for k in range(int(6*fill)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=0.02,location=(rr.uniform(-0.01,0.01),rr.uniform(-0.01,0.01),0.013+k*0.013));o=bpy.context.active_object;o.name=f'{name}_peach{k}';o.scale=(1,1,0.5);o.rotation_euler=(rr.uniform(-0.4,0.4),rr.uniform(-0.4,0.4),0);_finish(o,PEACH,0,parent)
    if cloth:
        cyl(name+'_cloth',0.036,0.02,(0,0,0.113),CLOTH,verts=12,r2=0.03,bevel=0.004,parent=parent);cyl(name+'_tie',0.03,0.004,(0,0,0.106),SINEW,verts=12,bevel=0,parent=parent)
    elif bail:
        cyl(name+'_lidglass',0.03,0.012,(0,0,0.118),g,verts=20,bevel=0.003,parent=parent)
        tube(name+'_wire1',(-0.03,0,0.105),(0,0,0.126),0.0015,IRON,parent);tube(name+'_wire2',(0,0,0.126),(0.03,0,0.105),0.0015,IRON,parent)
    else:cyl(name+'_lid',0.031,0.012,(0,0,0.118),lid,verts=20,bevel=0.002,parent=parent)
    if label:
        cyl(name+'_label',0.0355,0.045,(0,0,0.05),LABEL,verts=20,bevel=0,parent=parent)
        text(name+'_lt1','SPICED',(0,-0.036,0.058),0.009,INK,extrude=0.0003,parent=parent);text(name+'_lt2','PEACHES',(0,-0.036,0.045),0.009,RED,extrude=0.0003,parent=parent)
n='Jar_1';scene(n);r=root(n);jar('j',r);finish(n,elev=20)
n='Jar_2';scene(n);r=root(n);jar('j',r,label=True);finish(n,elev=18)
n='Jar_3';scene(n);r=root(n);jar('j',r,bail=True);finish(n,elev=20)
n='Jar_4';scene(n);r=root(n);jar('j',r,fill=0.45,dusty=True,lid=RUST);clump(r,6,0.004,0.008,rad=(0.04,0.06),seed=6);finish(n,elev=22)
n='Jar_5';scene(n);r=root(n);jar('j',r,cloth=True);finish(n,elev=20)

# ---------------- fossil fish (20 cm slab) ----------------
def slab(name,parent,m,sx=0.2,sy=0.13,t=0.03,seed=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=9,radius=1,depth=1,location=(0,0,t/2));o=bpy.context.active_object;o.name=name
    rr=random.Random(seed)
    for v in o.data.vertices:
        if abs(v.co.z)>0.01:v.co.x*=1+rr.uniform(-0.15,0.1);v.co.y*=1+rr.uniform(-0.15,0.1)
    o.scale=(sx/2,sy/2,t);bpy.ops.object.transform_apply(scale=True);return _finish(o,m,0.004,parent)
def fish(name,parent,m,z,scale=1.0,x0=0,y0=0,rot=0,raised=True):
    g=root(name);g.parent=parent;g.location=(x0,y0,z);g.rotation_euler=(0,0,rot);g.scale=(scale,scale,scale)
    tube(name+'_spine',(-0.07,0,0),(0.06,0,0),0.0025,m,g)
    for k in range(9):
        x=-0.05+k*0.012;h=0.022*math.sin((k+1)/10*math.pi)+0.006
        tube(name+f'_rib{k}a',(x,0,0),(x-0.006,h,0),0.0015,m,g);tube(name+f'_rib{k}b',(x,0,0),(x-0.006,-h,0),0.0015,m,g)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=0.014,location=(0.068,0,0));o=bpy.context.active_object;o.name=name+'_skull';o.scale=(1.3,0.85,0.35);_finish(o,m,0,g)
    for s in (1,-1):tube(name+f'_tail{s}',(-0.07,0,0),(-0.095,s*0.022,0),0.002,m,g)
    cyl(name+'_eye',0.004,0.002,(0.075,0.004,0.004),INK,verts=8,bevel=0,parent=g)
n='Fossil_1';scene(n);r=root(n);slab('slab',r,STONE,seed=1);fish('f',r,BONE,0.031);finish(n,elev=50)
n='Fossil_2';scene(n);r=root(n);slab('a',r,STONE2,sx=0.12,seed=2).location=(-0.05,0,0);fish('f',r,BONE,0.031,x0=-0.05,scale=0.7)
o=slab('b',r,STONE2,sx=0.12,seed=3);o.location=(0.09,0.02,0);o.rotation_euler=(0,0,0.3);finish(n,elev=45)
n='Fossil_3';scene(n);r=root(n);slab('slab',r,STONE,sx=0.24,sy=0.16,seed=4)
for k,(x,y,s,a) in enumerate(((-0.05,0.03,0.45,0.2),(0.04,-0.03,0.5,-0.3),(0.01,0.045,0.35,3.0))):fish(f'f{k}',r,BONE,0.031,scale=s,x0=x,y0=y,rot=a)
finish(n,elev=50)
n='Fossil_4';scene(n);r=root(n);bpy.ops.mesh.primitive_uv_sphere_add(segments=14,ring_count=8,radius=1,location=(0,0,0.03));o=bpy.context.active_object;o.name='nodule';o.scale=(0.11,0.075,0.04);bpy.ops.object.transform_apply(scale=True);_finish(o,STONE2,0,r)
fish('f',r,BONE,0.066,scale=0.85);finish(n,elev=45)
n='Fossil_5';scene(n);r=root(n);slab('slab',r,M_('f_stone_dark',(0x6a,0x60,0x52),0.95),seed=5);fish('f',r,M_('f_bone_pale',(0xd8,0xcc,0xa8),0.9),0.031);finish(n,elev=50)
bpy.ops.wm.save_mainfile()
