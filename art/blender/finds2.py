exec(open('/tmp/claude-1001/bl/finds.py').read().split("# ---------------- bottle cap")[0])
import bmesh
from mathutils import noise
def vpaint(o,stops,freq=40,seed=0,bias=None,octaves=3):
    """Per-vertex colour from layered noise: stops = [(threshold, (r,g,b)), ...] ascending; bias(co)->extra amount.
    Smooth blotchy rust/patina instead of per-face squares (exports as COLOR_0)."""
    me=o.data
    if 'Col' in me.color_attributes:me.color_attributes.remove(me.color_attributes['Col'])
    ca=me.color_attributes.new('Col','FLOAT_COLOR','POINT');me.color_attributes.active_color=ca
    cols=[(t,Vector(srgb(c)[:3])) for t,c in stops];off=Vector((seed*7.3,seed*3.1,seed*5.7))
    for v in me.vertices:
        p=o.matrix_world@v.co;x=0;a=1;f=freq
        for _ in range(octaves):x+=a*noise.noise(p*f+off);a*=0.5;f*=2.1
        x=x*0.5+0.5+(bias(p) if bias else 0)
        c=cols[0][1]
        for (t0,c0),(t1,c1) in zip(cols,cols[1:]):
            if x>=t0:c=c0.lerp(c1,min(1,max(0,(x-t0)/max(1e-4,t1-t0))))
        ca.data[v.index].color=(c.x,c.y,c.z,1)
    o.data.materials.clear();o.data.materials.append(vcol_mat('vcol_metal',0.7))
def dense_cyl(name,r,h,loc,verts=32,cuts=16,parent=None,r2=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=h,location=loc);o=bpy.context.active_object;o.name=name
    bm=bmesh.new();bm.from_mesh(o.data)
    vert_edges=[e for e in bm.edges if abs(e.verts[0].co.z-e.verts[1].co.z)>h*0.9]
    bmesh.ops.subdivide_edges(bm,edges=vert_edges,cuts=cuts,use_grid_fill=True);bm.to_mesh(o.data);bm.free()
    for p in o.data.polygons:p.use_smooth=False
    _link(o);o.parent=parent;return o
TIN_C=(0xb4,0xb4,0xac);RUST_A=(0xb0,0x5a,0x2a);RUST_B=(0x7a,0x3a,0x1e);RUST_C=(0x4e,0x28,0x16)
def rustcan(name,parent,h=0.12,r=0.037,amount=0.0,seed=0,label=False,lidopen=False):
    b=dense_cyl(name,r,h,(0,0,h/2),parent=parent)
    for k,z in enumerate((0.004,h-0.004)):dense_cyl(name+f'_rim{k}',r*1.045,0.006,(0,0,z),parent=parent,cuts=1)
    for k in range(4):dense_cyl(name+f'_rib{k}',r*1.012,0.004,(0,0,h*0.25+k*h*0.17),parent=parent,cuts=1)
    edge=lambda p:0.18*max(0,1-p.z/0.03)+0.1*max(0,(p.z-(h-0.015))/0.015)   # rust creeps from the bottom and the rim
    stops=[(0.0,TIN_C),(0.52-amount,TIN_C),(0.58-amount,RUST_A),(0.7-amount,RUST_B),(0.85-amount,RUST_C)]
    for o in [x for x in coll('Asset').all_objects if x.type=='MESH' and x.name.startswith(name)]:vpaint(o,stops,freq=38,seed=seed,bias=edge)
    if label:
        lb=dense_cyl(name+'_label',r*1.004,0.07,(0,0,0.06),parent=parent,cuts=8)
        vpaint(lb,[(0,(0xe0,0xcf,0xa3)),(0.55-amount,(0xe0,0xcf,0xa3)),(0.66-amount,(0xc0,0x9a,0x62)),(0.8-amount,RUST_B)],freq=45,seed=seed+1)
        text(name+'_beans','BEANS',(0,-r*1.005-0.0004,0.061),0.013,RED,extrude=0.0004,parent=parent)
    if lidopen:
        lid=dense_cyl(name+'_lid',r*0.97,0.002,(0.03,0,h+0.005),parent=parent,cuts=1);lid.rotation_euler=(0,math.radians(-70),0);vpaint(lid,stops,freq=38,seed=seed+2)
# ---------------- cans, round 2: fine-grained rust ----------------
n='Can2_1';scene(n);r=root(n);rustcan('can',r,amount=0.0,seed=1);finish(n,elev=22)
n='Can2_2';scene(n);r=root(n);rustcan('can',r,amount=0.14,seed=2);finish(n,elev=22)
n='Can2_3';scene(n);r=root(n);rustcan('can',r,amount=0.08,seed=3,lidopen=True);finish(n,elev=32)
n='Can2_4';scene(n);r=root(n);rustcan('can',r,amount=0.05,seed=4,label=True);finish(n,elev=18)
n='Can2_5';scene(n);r=root(n);g=root('g');g.parent=r;g.rotation_euler=(math.pi/2,0,0.4);g.location=(0,0,0.037);rustcan('can',g,amount=0.2,seed=5);clump(r,7,0.004,0.009,rad=(0.03,0.07),seed=5);finish(n)

# ---------------- bottle caps, round 2: like #1, no cream top ----------------
def crimp2(name,parent,top,side,r=0.013,h=0.006,teeth=21,dent=0.0,tips=None):
    t=cyl(name+'_top',r,0.0012,(0,0,h),top,verts=teeth*2,bevel=0,parent=parent)
    vs=[];fs=[];N=teeth*2
    for i in range(N):
        a=i/N*6.2832;rr=r*(1.08 if i%2 else 0.98)
        vs+=[(math.cos(a)*r,math.sin(a)*r,h),(math.cos(a)*rr*1.05,math.sin(a)*rr*1.05,0)]
    for i in range(N):j=(i+1)%N;fs.append((2*i,2*j,2*j+1,2*i+1))
    s=meshobj(name+'_skirt',vs,fs,side,parent,solid=0.0008)
    if tips:   # paint worn off the crimp tips: bare tin shows
        s.data.materials.append(mat(*tips))
        for p in s.data.polygons:
            if p.index%2==1:p.material_index=1
    if dent:
        for o in (t,s):bend(o,lambda c:Vector((c.x,c.y,c.z-dent*max(0,0.004-((c.x-0.004)**2+c.y**2)**0.5)*60)))
    return t,s
DEEP=M_('f_capred_deep',(0x98,0x22,0x1e),0.55,0.2)
n='Cap2_1';scene(n);r=root(n);crimp2('c',r,RED,RED);finish(n,elev=40)
n='Cap2_2';scene(n);r=root(n);crimp2('c',r,RED,RED,dent=1.0);cyl('ringemb',0.009,0.0006,(0,0,0.0068),RED,verts=32,bevel=0,parent=r);finish(n,elev=40)
n='Cap2_3';scene(n);r=root(n);crimp2('c',r,RED,RED,tips=TIN);finish(n,elev=35)
n='Cap2_4';scene(n);r=root(n);t,s=crimp2('c',r,RED,RED)
for o in (t,s):
    if o.type=='MESH':pass
rr=random.Random(4)
for k in range(9):a=rr.uniform(0,6.28);d=rr.uniform(0.002,0.012);cyl(f'speck{k}',rr.uniform(0.0008,0.0018),0.0003,(math.cos(a)*d,math.sin(a)*d,0.0068),RUST,verts=6,bevel=0,parent=r)
finish(n,elev=40)
n='Cap2_5';scene(n);r=root(n);crimp2('c',r,DEEP,DEEP,tips=TIN);box('scratch',(0.014,0.0008,0.0003),(0.001,0.002,0.0068),TIN,rot=(0,0,0.5),bevel=0,parent=r);finish(n,elev=40)

# ---------------- spoons, round 2: like #1 (plain, tarnished) ----------------
def spoon2(name,parent,L=0.17,bowl=(0.02,0.03),seed=0,patina=0.0,bentv=0.0,fiddle=False,handle_w=0.009):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=(0,-L*0.36,0.006));b=bpy.context.active_object;b.name=name+'_bowl'
    b.scale=(bowl[0],bowl[1],0.006);bpy.ops.object.transform_apply(scale=True);_finish(b,TARN,0,parent)
    h=box(name+'_handle',(handle_w,L*0.62,0.003),(0,L*0.12,0.008),TARN,bevel=0.0015,parent=parent)
    bm=bmesh.new();bm.from_mesh(h.data);bmesh.ops.subdivide_edges(bm,edges=[e for e in bm.edges if abs(e.verts[0].co.y-e.verts[1].co.y)>0.05],cuts=10,use_grid_fill=True);bm.to_mesh(h.data);bm.free()
    for v in h.data.vertices:v.co.x*=1+max(0,(v.co.y-L*0.3))*18   # handle widens toward the end, like a real spoon
    parts=[b,h]
    if fiddle:e=cyl(name+'_end',0.008,0.003,(0,L*0.43,0.008),TARN,verts=14,bevel=0.001,parent=parent);parts.append(e)
    if bentv:
        for o in parts:bend(o,lambda c:Vector((c.x+max(0,c.y-0.02)*bentv*0.3,c.y,c.z+max(0,c.y-0.02)*bentv)))
    for o in parts:vpaint(o,[(0,(0x8a,0x86,0x78)),(0.5-patina,(0x8a,0x86,0x78)),(0.62-patina,(0x6a,0x62,0x4e)),(0.8-patina,(0x4a,0x40,0x30))],freq=90,seed=seed)
n='Spoon2_1';scene(n);r=root(n);spoon2('s',r,seed=1);finish(n,elev=40)
n='Spoon2_2';scene(n);r=root(n);spoon2('s',r,seed=2,patina=0.15);finish(n,elev=40)
n='Spoon2_3';scene(n);r=root(n);spoon2('s',r,seed=3,bentv=0.35);finish(n,elev=32)
n='Spoon2_4';scene(n);r=root(n);spoon2('s',r,seed=4,fiddle=True,patina=0.05);finish(n,elev=40)
n='Spoon2_5';scene(n);r=root(n);spoon2('s',r,seed=5,L=0.13,bowl=(0.016,0.024),handle_w=0.007);finish(n,elev=40)
bpy.context.window.scene=bpy.data.scenes['Camper'];bpy.ops.wm.save_mainfile()
