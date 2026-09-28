exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
import bmesh,re
rnd=random.Random(5)
GOLD=('kb_gold',(0xd4,0xaf,0x37),0.35,0.45);GOLD2=('kb_gold_deep',(0xb8,0x8a,0x22),0.4,0.45);PALE=('kb_gold_pale',(0xe8,0xcc,0x6a),0.3,0.45)
TARN=('kb_tarnish',(0x6e,0x5a,0x2a),0.8,0.2);SILV=('kb_silver',(0xc8,0xc8,0xc0),0.3,0.5);RED=('kb_red',(0xa8,0x1c,0x2c),0.4,0);DIRT=('kb_dirt',(0x9a,0x72,0x48),0.95,0)
GEM=('kb_gem',(0xc0,0x10,0x30),0.1,0.2);INK=('kb_engrave',(0x5a,0x40,0x14),0.6,0.3)
def engrave(target,txt,z,size,depth=0.004,font='Anton',raised=False,mat_=None,parent=None,around=0.0,r=0.02):
    """KB letters on the tube's front (-Y): raised letters stand proud; engraved ones are cut in with a boolean."""
    y=-r-(0.001 if raised else -depth*0.5)
    t=text(target.name+'_kb',txt,(0,y,z),size,mat_ or INK,fontname=font,extrude=depth,parent=parent)
    if not raised:
        b=target.modifiers.new('engrave','BOOLEAN');b.operation='DIFFERENCE';b.object=t;b.solver='EXACT'
        bpy.context.view_layer.objects.active=target
        for x in bpy.context.selected_objects:x.select_set(False)
        target.select_set(True);bpy.ops.object.modifier_apply(modifier='engrave')
        bpy.data.objects.remove(t,do_unlink=True)
        return None
    return t
def ob(name):
    sc=bpy.context.window.scene
    return next(o for o in sc.objects if o.name==name or re.match(re.escape(name)+r'\.\d+$',o.name))
def finish(n,elev=18,azim=-28,margin=1.35):
    studio(elev=elev,azim=azim,lens=85);frame(margin=margin)
    f=ob(n+'.floor');f.data.materials.clear();f.data.materials.append(mat('kb_sand',(0xe3,0xbf,0x86),0.95))
    render(n,res=(768,768),samples=64);print(n,tris())

R=0.02;L=0.085
# v01 classic: polished cap + base with a seam ring, engraved KB
n='KB_v01';scene(n);r=root(n)
b=cyl('base',R,L*0.55,(0,0,L*0.275),GOLD,verts=24,bevel=0.002,parent=r)
cyl('cap',R*1.04,L*0.5,(0,0,L*0.55+L*0.25),GOLD,verts=24,bevel=0.003,parent=r)
cyl('ring',R*1.08,0.004,(0,0,L*0.55),GOLD2,verts=24,bevel=0.001,parent=r)
c=ob('cap');engrave(c,'KB',L*0.8,0.022,r=R*1.04);finish(n)
# v02 dented + tarnished, raised letters, lying on its side
n='KB_v02';scene(n);r=root(n);g=root('tube');g.parent=r;g.rotation_euler=(math.pi/2,0,0.5);g.location=(0,0,R)
cyl('body',R,L,(0,0,0),GOLD2,verts=16,bevel=0.002,parent=g)
for k in range(5):ico_=bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=R*rnd.uniform(0.35,0.6),location=(R*0.75*math.cos(k*1.3),R*0.75*math.sin(k*1.3),rnd.uniform(-L*0.4,L*0.4)));o=bpy.context.active_object;o.name=f'tarnish{k}';o.scale=(1,1,0.4);_finish(o,TARN,0,g)
cyl('dent',R*0.5,0.004,(R*0.95,0,L*0.1),GOLD2,verts=8,rot=(0,math.pi/2,0),bevel=0,parent=g)
engrave(ob('body'),'KB',0.012,0.024,raised=True,mat_=PALE,parent=g,r=R);finish(n,elev=28)
# v03 art deco: fluted cap, stepped base, deco band
n='KB_v03';scene(n);r=root(n)
for k,(h,rr) in enumerate(((0.008,R*1.12),(0.006,R*1.06))):cyl(f'step{k}',rr,h,(0,0,0.004+k*0.007),GOLD2,verts=24,bevel=0.001,parent=r)
cyl('body',R,L*0.5,(0,0,0.013+L*0.25),GOLD,verts=24,bevel=0.002,parent=r)
cyl('cap',R*1.05,L*0.45,(0,0,0.013+L*0.5+L*0.225),GOLD,verts=24,bevel=0.003,parent=r)
for k in range(12):
    a=k*2*math.pi/12;box(f'flute{k}',(0.0035,0.0035,L*0.4),(math.cos(a)*R*1.07,math.sin(a)*R*1.07,0.013+L*0.5+L*0.225),GOLD2,rot=(0,0,a),bevel=0,parent=r)
cyl('band',R*1.03,0.008,(0,0,0.013+L*0.36),('kb_black',(0x1e,0x19,0x16),0.4,0.2),verts=24,bevel=0,parent=r)
engrave(ob('body'),'KB',0.013+L*0.2,0.02,raised=True,mat_=GOLD2,parent=r,r=R);finish(n)
# v04 cap off: red lipstick bullet showing, cap lying next to it
n='KB_v04';scene(n);r=root(n)
cyl('base',R,L*0.55,(0,0,L*0.275),GOLD,verts=24,bevel=0.002,parent=r)
cyl('inner',R*0.8,0.012,(0,0,L*0.55+0.006),GOLD2,verts=24,bevel=0,parent=r)
o=cyl('bullet',R*0.62,0.03,(0,0,L*0.55+0.012+0.015),RED,verts=20,bevel=0,parent=r)
bm=bmesh.new();bm.from_mesh(o.data)
for v in bm.verts:
    if v.co.z>0.012:v.co.z+= -v.co.y*0.9   # slanted tip, like a used lipstick
bm.to_mesh(o.data);bm.free()
cap=cyl('cap',R*1.04,L*0.45,(0.055,0.01,R*1.04),GOLD,verts=24,rot=(math.pi/2,0,0.6),bevel=0.003,parent=r)
engrave(ob('base'),'KB',L*0.3,0.02,r=R);finish(n,elev=24,margin=1.25)
# v05 hexagonal stamped body
n='KB_v05';scene(n);r=root(n)
cyl('body',R*1.05,L,(0,0,L/2),GOLD,verts=6,bevel=0.0015,parent=r)
cyl('top',R*0.95,0.006,(0,0,L+0.003),GOLD2,verts=6,bevel=0.001,parent=r)
b=ob('body');b.rotation_euler=(0,0,math.pi/6)
bpy.context.view_layer.objects.active=b;b.select_set(True);bpy.ops.object.transform_apply(rotation=True)
engrave(b,'KB',L*0.6,0.024,r=R*0.91);finish(n)
# v06 bullet shape with dirt crusted on the bottom
n='KB_v06';scene(n);r=root(n)
cyl('body',R,L*0.75,(0,0,L*0.375),GOLD,verts=20,bevel=0.002,parent=r)
cyl('nose',R,L*0.28,(0,0,L*0.75+L*0.14),GOLD,verts=20,r2=R*0.35,bevel=0.002,parent=r)
for k in range(9):
    a=rnd.uniform(0,6.28);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=rnd.uniform(0.006,0.011),location=(math.cos(a)*R,math.sin(a)*R,rnd.uniform(0.002,0.022)));o=bpy.context.active_object;o.name=f'dirt{k}';_finish(o,DIRT,0,r)
engrave(ob('body'),'KB',L*0.45,0.024,r=R);finish(n)
# v07 short and chunky with a ruby set in the cap
n='KB_v07';scene(n);r=root(n);R7=R*1.35
cyl('body',R7,L*0.42,(0,0,L*0.21),GOLD,verts=24,bevel=0.003,parent=r)
cyl('cap',R7*1.03,L*0.32,(0,0,L*0.42+L*0.16),GOLD,verts=24,bevel=0.004,parent=r)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=0.009,location=(0,0,L*0.74+0.004));o=bpy.context.active_object;o.name='ruby';o.scale=(1,1,0.6);_finish(o,GEM,0,r)
cyl('setting',0.011,0.004,(0,0,L*0.74),GOLD2,verts=12,bevel=0,parent=r)
engrave(ob('body'),'KB',L*0.21,0.026,r=R7);finish(n)
# v08 two-tone: gold body, silver cap, KB monogram in a shield plate
n='KB_v08';scene(n);r=root(n)
cyl('body',R,L*0.55,(0,0,L*0.275),GOLD,verts=24,bevel=0.002,parent=r)
cyl('cap',R*1.04,L*0.48,(0,0,L*0.55+L*0.24),SILV,verts=24,bevel=0.003,parent=r)
box('shield',(0.024,0.004,0.028),(0,-R-0.001,L*0.28),PALE,bevel=0.002,parent=r)
engrave(ob('body'),'KB',L*0.28,0.016,raised=True,mat_=GOLD2,parent=r,r=R+0.003);finish(n)
# v09 game-style chunky low-poly: 8 sides, flat shaded, oversized raised KB
n='KB_v09';scene(n);r=root(n)
cyl('body',R*1.15,L,(0,0,L/2),GOLD,verts=8,bevel=0,parent=r)
cyl('capline',R*1.2,0.006,(0,0,L*0.55),GOLD2,verts=8,bevel=0,parent=r)
cyl('top',R*1.0,0.008,(0,0,L+0.004),PALE,verts=8,bevel=0,parent=r)
engrave(ob('body'),'KB',L*0.3,0.03,raised=True,mat_=GOLD2,parent=r,r=R*1.1,depth=0.005);finish(n)
# v10 half-buried in a little sand mound, just dug up
n='KB_v10';scene(n);r=root(n);g=root('tube');g.parent=r;g.rotation_euler=(math.radians(58),0,0.4);g.location=(0,0,0.01)
cyl('base',R,L*0.55,(0,0,L*0.275),GOLD,verts=24,bevel=0.002,parent=g)
cyl('cap',R*1.04,L*0.5,(0,0,L*0.55+L*0.25),GOLD,verts=24,bevel=0.003,parent=g)
engrave(ob('cap'),'KB',L*0.8,0.022,r=R*1.04)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=0.06,location=(0,0.01,-0.03));o=bpy.context.active_object;o.name='mound';o.scale=(1.3,1.1,0.55);_finish(o,('kb_sand_mound',(0xd4,0xae,0x78),0.95,0),0,r)
for k in range(8):
    a=rnd.uniform(0,6.28);d=rnd.uniform(0.06,0.1);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=rnd.uniform(0.006,0.012),location=(math.cos(a)*d,math.sin(a)*d,0.004));o=bpy.context.active_object;o.name=f'clump{k}';_finish(o,DIRT,0,r)
finish(n,elev=30,margin=1.2)
bpy.context.window.scene=bpy.data.scenes['Camper'];bpy.ops.wm.save_mainfile()
