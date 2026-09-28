exec(open('/tmp/claude-1001/bl/finds2.py').read().split("# ---------------- cans, round 2")[0])
rnd=random.Random(303)
def glassify(m,alpha=0.3):
    b=m.node_tree.nodes['Principled BSDF'];b.inputs['Alpha'].default_value=alpha
    try:m.surface_render_method='BLENDED'
    except Exception:m.blend_method='BLEND'
    return m
SILVER=M_('r_silver',(0xd0,0xd0,0xc8),0.25,0.6);SILV_D=M_('r_silver_d',(0x9a,0x9a,0x92),0.3,0.6);PINK=M_('r_pink',(0xc8,0x3a,0x5a),0.4)
GOLDM=M_('r_gold',(0xd4,0xaf,0x37),0.3,0.5);GOLD_D=M_('r_gold_d',(0xa8,0x82,0x28),0.35,0.5);RUBY=M_('r_ruby',(0xc0,0x10,0x30),0.1,0.2)
GOO=M_('r_goo',(0xc8,0x6a,0x1e),0.25);GOO_D=M_('r_goo_d',(0x7a,0x3a,0x14),0.3);WAX=M_('r_wax',(0x8a,0x1c,0x1c),0.5);CROCK=M_('r_crock',(0xd8,0xc8,0xa8),0.6);CROCK_B=M_('r_crock_b',(0x5a,0x42,0x2a),0.6)
STEEL=M_('r_steel',(0x4a,0x4a,0x48),0.45,0.5);BLUED=M_('r_blued',(0x2e,0x33,0x3a),0.35,0.5);WALNUT=M_('r_walnut',(0x6a,0x3e,0x22),0.6);PEARL=M_('r_pearl',(0xf0,0xea,0xdc),0.25)
PHOTO=M_('r_photo',(0xa8,0x98,0x78),0.9);RUSTY=M_('r_rusty',(0x7a,0x42,0x24),0.9)
def chain(name,parent,pts,link=0.004,m=GOLDM):
    """A chain of little rings along a polyline."""
    k=0
    for a,b in zip(pts,pts[1:]):
        a,b=Vector(a),Vector(b);n=max(1,int((b-a).length/(link*1.6)))
        for i in range(n):
            p=a.lerp(b,(i+0.5)/n);bpy.ops.mesh.primitive_torus_add(major_radius=link,minor_radius=link*0.28,major_segments=8,minor_segments=4,location=p)
            o=bpy.context.active_object;o.name=f'{name}{k}';d=(b-a).normalized();o.rotation_euler=d.to_track_quat('X','Z').to_euler();o.rotation_euler.rotate_axis('X',(k%2)*math.pi/2);_finish(o,m,0,parent);k+=1
def heart(name,parent,m,s=0.022,t=0.007,loc=(0,0,0)):
    pts=[]
    for i in range(40):
        a=i/40*6.2832;x=16*math.sin(a)**3;y=13*math.cos(a)-5*math.cos(2*a)-2*math.cos(3*a)-math.cos(4*a);pts.append((x/17*s,y/17*s))
    vs=[(x,y,0) for x,y in pts]+[(x,y,t) for x,y in pts]+[(0,0,0),(0,0,t)];n=len(pts)
    fs=[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]+[((i+1)%n,i,2*n) for i in range(n)]+[(n+i,n+(i+1)%n,2*n+1) for i in range(n)]
    o=meshobj(name,vs,fs,m,parent);o.location=loc;return o

# ---------------- silver lipstick tube (7.5 cm) ----------------
R=0.011
n='Lip_1';scene(n);r=root(n);cyl('base',R,0.04,(0,0,0.02),SILVER,verts=20,bevel=0.0015,parent=r);cyl('cap',R*1.05,0.035,(0,0,0.0425+0.0175),SILVER,verts=20,bevel=0.002,parent=r);cyl('seam',R*1.08,0.0025,(0,0,0.041),SILV_D,verts=20,bevel=0,parent=r);finish(n,elev=20)
n='Lip_2';scene(n);r=root(n);cyl('base',R,0.04,(0,0,0.02),SILVER,verts=20,bevel=0.0015,parent=r);cyl('collar',R*0.85,0.006,(0,0,0.043),SILV_D,verts=20,bevel=0,parent=r)
o=cyl('bullet',R*0.62,0.018,(0,0,0.055),PINK,verts=16,bevel=0,parent=r);bend(o,lambda c:Vector((c.x,c.y,c.z-c.y*0.8 if c.z>0.004 else c.z)))
cyl('cap',R*1.05,0.035,(0.028,0.006,R*1.05),SILVER,verts=20,rot=(math.pi/2,0,0.5),bevel=0.002,parent=r);finish(n,elev=24)
n='Lip_3';scene(n);r=root(n);cyl('base',R,0.04,(0,0,0.02),SILVER,verts=20,bevel=0.0015,parent=r);cyl('cap',R*1.05,0.035,(0,0,0.06),SILVER,verts=20,bevel=0.002,parent=r)
for k in range(14):a=k/14*6.2832;box(f'rib{k}',(0.0018,0.0018,0.03),(math.cos(a)*R*1.08,math.sin(a)*R*1.08,0.06),SILV_D,rot=(0,0,a),bevel=0,parent=r)
cyl('band',R*1.06,0.004,(0,0,0.03),M_('r_black',(0x1e,0x19,0x16),0.4,0.2),verts=20,bevel=0,parent=r);finish(n,elev=20)
n='Lip_4';scene(n);r=root(n);b=dense_cyl('base',R,0.04,(0,0,0.02),parent=r,verts=20,cuts=8);c=dense_cyl('cap',R*1.05,0.035,(0,0,0.0605),parent=r,verts=20,cuts=8)
for o in (b,c):vpaint(o,[(0,(0xc8,0xc8,0xc0)),(0.45,(0xb0,0xb0,0xa6)),(0.6,(0x6a,0x66,0x58)),(0.8,(0x3a,0x36,0x2e))],freq=120,seed=4)
finish(n,elev=20)
n='Lip_5';scene(n);r=root(n);cyl('base',R*0.85,0.045,(0,0,0.0225),SILVER,verts=20,bevel=0.0015,parent=r);cyl('cap',R*0.88,0.03,(0,0,0.06),SILVER,verts=20,bevel=0.0015,parent=r);cyl('nose',R*0.88,0.012,(0,0,0.081),SILVER,verts=20,r2=R*0.35,bevel=0,parent=r)
for k in range(5):a=k/5*6.2832;bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=0.0025,location=(math.cos(a)*0.0035,-R*0.85-0.0003,0.022+math.sin(a)*0.0035));o=bpy.context.active_object;o.name=f'petal{k}';o.scale=(1,0.3,1);_finish(o,SILV_D,0,r)
finish(n,elev=18)

# ---------------- old jar of Sploosh (murky, 110-year-old peaches) ----------------
def murky(name,parent,h=0.09,r=0.032,level=0.75,glass_a=0.45,cloudy=(0x9a,0x8a,0x60)):
    g=cyl(name+'_glass',r,h,(0,0,h/2),M_('r_glass_old',cloudy,0.4,0),verts=18,bevel=0.004,parent=parent);glassify(g.data.materials[0],glass_a)
    goo=dense_cyl(name+'_goo',r*0.92,h*level,(0,0,h*level/2+0.002),parent=parent,verts=18,cuts=6)
    vpaint(goo,[(0,(0xc8,0x6a,0x1e)),(0.45,(0xb0,0x58,0x18)),(0.62,(0x7a,0x3a,0x14)),(0.85,(0x4a,0x24,0x0e))],freq=70,seed=len(name),bias=lambda p:0.35*max(0,1-p.z/0.03))   # sediment darkens at the bottom
    return g
n='Sploosh_1';scene(n);r=root(n);murky('j',r);cyl('neck',0.024,0.012,(0,0,0.096),M_('r_glass_old',(0x9a,0x8a,0x60),0.4,0),verts=18,bevel=0,parent=r);cyl('cork',0.021,0.018,(0,0,0.108),CORK,verts=12,r2=0.023,bevel=0.002,parent=r);finish(n,elev=18)
n='Sploosh_2';scene(n);r=root(n);murky('j',r);cyl('wax',0.03,0.014,(0,0,0.097),WAX,verts=16,bevel=0.004,parent=r)
for k in range(5):a=k*1.25;box(f'drip{k}',(0.005,0.002,rnd.uniform(0.008,0.02)),(math.cos(a)*0.031,math.sin(a)*0.031,0.086),WAX,rot=(0,0,a),bevel=0.001,parent=r)
for k in range(3):box(f'crack{k}',(0.0006,0.0006,0.03),(0.03*math.cos(2+k*0.2),0.03*math.sin(2+k*0.2),0.045),M_('r_crack',(0xee,0xee,0xe0),0.2),rot=(0.3*k,0.2,2+k*0.2),bevel=0,parent=r)
finish(n,elev=20)
n='Sploosh_3';scene(n);r=root(n);c=dense_cyl('crock',0.036,0.095,(0,0,0.0475),parent=r,verts=18,cuts=8)
vpaint(c,[(0,(0xd8,0xc8,0xa8)),(0.55,(0xd8,0xc8,0xa8)),(0.62,(0x5a,0x42,0x2a)),(1,(0x5a,0x42,0x2a))],freq=4,seed=1,bias=lambda p:0.6*max(0,(p.z-0.07)/0.03))   # brown-dipped top like an old crock
cyl('lid',0.028,0.01,(0,0,0.1),CROCK_B,verts=16,bevel=0.003,parent=r);box('label',(0.03,0.001,0.03),(0,-0.0362,0.045),LABEL,bevel=0,parent=r);text('lbl','SPLOOSH',(0,-0.0374,0.045),0.0065,INK,extrude=0.0003,parent=r);finish(n,elev=18)
n='Sploosh_4';scene(n);r=root(n);murky('j',r,h=0.11,r=0.028,level=0.55,glass_a=0.35)
for k,(z,c_) in enumerate(((0.012,(0x4a,0x24,0x0e)),(0.028,(0x8a,0x44,0x16)),(0.05,(0xd8,0x7a,0x2a)))):cyl(f'layer{k}',0.0262,0.004,(0,0,z),M_(f'r_layer{k}',c_,0.3),verts=18,bevel=0,parent=r)
cyl('lidglass',0.025,0.01,(0,0,0.117),M_('r_glass_old',(0x9a,0x8a,0x60),0.4,0),verts=18,bevel=0.002,parent=r);tube('wire1',(-0.027,0,0.1),(0,0,0.124),0.0012,IRON,r);tube('wire2',(0,0,0.124),(0.027,0,0.1),0.0012,IRON,r);finish(n,elev=18)
n='Sploosh_5';scene(n);r=root(n);g=root('g');g.parent=r;g.rotation_euler=(math.radians(70),0,0.5);g.location=(0,0,0.02);murky('j',g,level=0.6);cyl('cork',0.021,0.016,(0,0,0.1),CORK,verts=12,bevel=0.002,parent=g)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=0.03,location=(0.06,-0.02,0));o=bpy.context.active_object;o.name='puddle';o.scale=(1.6,1.1,0.08);_finish(o,GOO,0,r);clump(r,8,0.004,0.009,rad=(0.05,0.09),seed=5);finish(n,elev=32)

# ---------------- gold locket ----------------
n='Locket_1';scene(n);r=root(n);heart('h',r,GOLDM,loc=(0,0,0));cyl('bail',0.003,0.004,(0,0.021,0.0035),GOLD_D,verts=8,rot=(0,math.pi/2,0),bevel=0,parent=r);chain('c',r,[(0,0.024,0.003),(0.02,0.05,0.002),(0.05,0.06,0.001),(0.08,0.05,0.001)]);finish(n,elev=55)
n='Locket_2';scene(n);r=root(n);heart('back',r,GOLDM);heart('photo',r,PHOTO,s=0.018,t=0.0012,loc=(0,0.0006,0.007))
lid=heart('lid',r,GOLDM,t=0.004,loc=(-0.042,0,0));box('hinge',(0.006,0.004,0.004),(-0.021,0.002,0.003),GOLD_D,bevel=0,parent=r);chain('c',r,[(0,0.024,0.003),(0.03,0.05,0.002),(0.06,0.05,0.001)]);finish(n,elev=55)
n='Locket_3';scene(n);r=root(n);bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=1,depth=1,location=(0,0,0.0035));o=bpy.context.active_object;o.name='oval';o.scale=(0.016,0.021,0.007);bpy.ops.object.transform_apply(scale=True);_finish(o,GOLDM,0.002,r)
text('eng','KB',(0,0,0.0072),0.012,GOLD_D,rot=(0,0,0),extrude=0.0004,parent=r);cyl('rim',0.017,0.0015,(0,0,0.007),GOLD_D,verts=24,bevel=0,parent=r).scale=(1,1.3,1);chain('c',r,[(0,0.023,0.003),(-0.02,0.05,0.002),(-0.05,0.055,0.001)]);finish(n,elev=60)
n='Locket_4';scene(n);r=root(n);c=dense_cyl('round',0.018,0.007,(0,0,0.0035),parent=r,verts=24,cuts=2);vpaint(c,[(0,(0xd4,0xaf,0x37)),(0.5,(0xb8,0x94,0x30)),(0.65,(0x6a,0x5a,0x2a)),(0.85,(0x3a,0x30,0x1a))],freq=200,seed=7)
cyl('boss',0.008,0.002,(0,0,0.0075),GOLD_D,verts=16,bevel=0,parent=r);chain('c',r,[(0,0.02,0.003),(0.01,0.045,0.002),(0.04,0.055,0.001)]);finish(n,elev=55)
n='Locket_5';scene(n);r=root(n);heart('h',r,GOLDM,s=0.024,t=0.008)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=0.005,location=(0,0.001,0.0095));o=bpy.context.active_object;o.name='ruby';o.scale=(1,1,0.6);_finish(o,RUBY,0,r)
for k in range(16):a=k/16*6.2832;bpy.ops.mesh.primitive_uv_sphere_add(segments=6,ring_count=3,radius=0.0013,location=(math.sin(a)*0.012,0.002+math.cos(a)*0.011,0.0085));o=bpy.context.active_object;o.name=f'bead{k}';_finish(o,GOLD_D,0,r)
chain('c',r,[(0,0.026,0.003),(0.02,0.05,0.002),(0.05,0.06,0.001)]);finish(n,elev=55)

# ---------------- Kate's old pistol (revolver ~28 cm) ----------------
def revolver(name,parent,metal=STEEL,grip=WALNUT,drum=None,barrel=0.14,derringer=False,accents=None):
    g=root(name);g.parent=parent;g.location=(0,0,0.02)
    if derringer:
        box(name+'_frame',(0.06,0.018,0.03),(0,0,0.02),metal,bevel=0.003,parent=g)
        for s in (-1,1):cyl(name+f'_bbl{s}',0.006,0.07,(0.05,0,0.025+s*0.006),metal,verts=10,rot=(0,math.pi/2,0),bevel=0.001,parent=g)
        o=box(name+'_grip',(0.022,0.016,0.045),(-0.03,0,0.0),grip,rot=(0,math.radians(-25),0),bevel=0.004,parent=g)
        return g
    box(name+'_frame',(0.07,0.022,0.04),(0,0,0.025),metal,bevel=0.003,parent=g)
    cyl(name+'_barrel',0.0075,barrel,(0.035+barrel/2,0,0.035),metal,verts=12,rot=(0,math.pi/2,0),bevel=0.001,parent=g)
    cyl(name+'_rod',0.004,barrel*0.6,(0.035+barrel*0.3,0,0.024),metal,verts=8,rot=(0,math.pi/2,0),bevel=0,parent=g)
    box(name+'_sight',(0.006,0.002,0.005),(0.035+barrel-0.005,0,0.044),metal,bevel=0,parent=g)
    d=cyl(name+'_drum',0.019,0.036,(0.012,0,0.03),drum or metal,verts=12,rot=(0,math.pi/2,0),bevel=0.002,parent=g)
    for k in range(6):a=k/6*6.2832;box(name+f'_flute{k}',(0.03,0.004,0.004),(0.012,math.cos(a)*0.019,0.03+math.sin(a)*0.019),M_('r_dark',(0x22,0x22,0x22),0.5,0.3),rot=(a,0,0),bevel=0,parent=g)
    box(name+'_hammer',(0.012,0.008,0.016),(-0.03,0,0.05),metal,rot=(0,math.radians(30),0),bevel=0.002,parent=g)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.012,minor_radius=0.002,major_segments=12,minor_segments=4,location=(-0.005,0,0.0));o=bpy.context.active_object;o.name=name+'_guard';o.rotation_euler=(math.pi/2,0,0);_finish(o,accents or metal,0,g)
    box(name+'_trigger',(0.003,0.004,0.012),(-0.004,0,0.004),metal,rot=(0,0.3,0),bevel=0,parent=g)
    box(name+'_grip',(0.028,0.02,0.07),(-0.036,0,-0.004),grip,rot=(0,math.radians(-18),0),bevel=0.006,parent=g)   # tucked under the back of the frame
    box(name+'_butt',(0.03,0.022,0.006),(-0.047,0,-0.038),accents or metal,rot=(0,math.radians(-18),0),bevel=0.002,parent=g)
    return g
n='Pistol_1';scene(n);r=root(n);revolver('p',r);finish(n,elev=25,azim=-10)
n='Pistol_2';scene(n);r=root(n);g=revolver('p',r)
for o in [x for x in coll('Asset').all_objects if x.type=='MESH' and not x.name.endswith('_grip')]:
    o.data.materials.clear();o.data.materials.append(mat(*RUSTY))
clump(r,8,0.005,0.01,rad=(0.04,0.1),seed=2);finish(n,elev=25,azim=-10)
n='Pistol_3';scene(n);r=root(n);revolver('p',r,metal=SILVER,grip=PEARL);finish(n,elev=25,azim=-10)
n='Pistol_4';scene(n);r=root(n);revolver('p',r,metal=SILVER,grip=PEARL,derringer=True);finish(n,elev=25,azim=-10)
n='Pistol_5';scene(n);r=root(n);revolver('p',r,metal=BLUED,grip=WALNUT,accents=GOLDM,drum=BLUED)
for k in range(6):box(f'scroll{k}',(0.012,0.0005,0.0015),(0.06+k*0.014,-0.0078,0.035+0.002*math.sin(k)),GOLDM,rot=(0,0,0),bevel=0,parent=r)
finish(n,elev=25,azim=-10)
bpy.context.window.scene=bpy.data.scenes['Camper'];bpy.ops.wm.save_mainfile()
