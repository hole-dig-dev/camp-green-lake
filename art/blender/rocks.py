exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
import bmesh
from mathutils import noise
def srgb_lin(c):return srgb(c)
def paint(o,base,band,top,seed,band_freq=7.0,band_amt=0.5,top_amt=0.6,speck=0.12):
    """Vertex-colour a rock: strata bands by height (wobbled by noise), sun-bleached top faces, a few dark specks."""
    me=o.data
    if 'Col' not in me.color_attributes:me.color_attributes.new('Col','FLOAT_COLOR','CORNER')
    col=me.color_attributes['Col'];rr=random.Random(seed)
    B,N,Tp=Vector(srgb(base)[:3]),Vector(srgb(band)[:3]),Vector(srgb(top)[:3])
    for poly in me.polygons:
        c=poly.center;n=poly.normal
        wob=noise.noise(c*2.3+Vector((seed,0,0)))*0.35
        t=(math.sin((c.z+wob)*band_freq)*0.5+0.5)**3*band_amt
        v=B.lerp(N,t)
        v=v.lerp(Tp,max(0,n.z)**2*top_amt)
        if rr.random()<speck:v=v*0.7
        v=v*(0.92+rr.random()*0.16)
        for li in poly.loop_indices:col.data[li].color=(v.x,v.y,v.z,1)
    me.color_attributes.active_color=col
def rock(name,seed,sub=3,scale=(1,1,1),disp=0.35,noise_size=0.6,decimate=0.25,flat=None,parent=None,material=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=(0,0,0));o=bpy.context.active_object;o.name=name
    tex=bpy.data.textures.new(name+'_tex','VORONOI');tex.noise_scale=noise_size;tex.distance_metric='DISTANCE'
    d=o.modifiers.new('disp','DISPLACE');d.texture=tex;d.strength=disp;d.mid_level=0.5;d.texture_coords='GLOBAL'
    tex2=bpy.data.textures.new(name+'_tex2','CLOUDS');tex2.noise_scale=0.35;d2=o.modifiers.new('disp2','DISPLACE');d2.texture=tex2;d2.strength=disp*0.5;d2.texture_coords='GLOBAL'
    o.location=(seed*3.1,seed*1.7,0)   # offset in the noise field so each rock differs, then bring it home
    bpy.ops.object.modifier_apply(modifier='disp');bpy.ops.object.modifier_apply(modifier='disp2');o.location=(0,0,0)
    dec=o.modifiers.new('dec','DECIMATE');dec.ratio=decimate;bpy.ops.object.modifier_apply(modifier='dec')
    o.scale=scale;bpy.ops.object.transform_apply(scale=True)
    if flat is not None:   # cut a flat base so it sits on the ground
        bm=bmesh.new();bm.from_mesh(o.data)
        for v in bm.verts:
            if v.co.z<flat:v.co.z=flat
        bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=0.02);bm.to_mesh(o.data);bm.free()
    # normalise: boulders to radius ~1 around the origin (the landslide scales them by each rock's radius)
    vs=[v.co.copy() for v in o.data.vertices];c=sum(vs,Vector())/len(vs)
    for v in o.data.vertices:v.co-=Vector((c.x,c.y,0 if flat is not None else c.z))
    for p in o.data.polygons:p.use_smooth=False
    _link(o);o.data.materials.append(material or vcol_mat('rock'))
    if parent:o.parent=parent
    return o
def normalise(o,target=1.0):
    m=max(v.co.length for v in o.data.vertices)
    for v in o.data.vertices:v.co*=target/m

# ================= boulders (unit radius, centred: the landslide positions/scales/rolls them) =================
scene('BoulderA');r=root('BoulderA')
o=rock('granite',2,sub=3,scale=(1,0.92,0.86),disp=0.55,noise_size=0.55,decimate=0.3,parent=r);normalise(o,1.08)
paint(o,(0x8a,0x7c,0x6a),(0x74,0x68,0x58),(0xb8,0xab,0x93),2,band_freq=4,band_amt=0.25)
studio(elev=18,azim=-30,lens=50,target=(0,0,0));frame(margin=1.3);bpy.data.objects['BoulderA.floor'].location.z=-1.0;print('A',tris());render()
scene('BoulderB');r=root('BoulderB')
o=rock('sandstone',7,sub=3,scale=(1.1,0.9,0.8),disp=0.45,noise_size=0.8,decimate=0.25,parent=r);normalise(o,1.08)
paint(o,(0x9c,0x6e,0x4c),(0x7a,0x52,0x38),(0xc9,0x9e,0x72),7,band_freq=9,band_amt=0.7)
studio(elev=18,azim=-30,lens=50,target=(0,0,0));frame(margin=1.3);bpy.data.objects['BoulderB.floor'].location.z=-1.0;print('B',tris());render()

# ================= small lakebed rocks (origin at the ground, ~0.5 m) =================
for k,(sc,seed,base,band,top) in enumerate((((0.5,0.4,0.28),11,(0x9c,0x75,0x52),(0x86,0x62,0x44),(0xc4,0x9f,0x75)),((0.45,0.5,0.35),13,(0x8a,0x7c,0x6a),(0x74,0x68,0x58),(0xb3,0xa6,0x8e)),((0.7,0.35,0.22),17,(0xa8,0x7a,0x55),(0x8a,0x5c,0x3e),(0xcf,0xa6,0x7a)))):
    n='Rock%s'%'ABC'[k];scene(n);r=root(n)
    o=rock(n.lower(),seed,sub=3,scale=sc,disp=0.4,noise_size=0.6,decimate=0.2,flat=-0.1*sc[2]/0.3,parent=r)
    for v in o.data.vertices:v.co.z-=min(w.co.z for w in o.data.vertices) if False else 0
    zmin=min(v.co.z for v in o.data.vertices)
    for v in o.data.vertices:v.co.z-=zmin+0.04   # sink a little into the sand
    paint(o,base,band,top,seed,band_freq=14,band_amt=0.5)
    studio(elev=25,azim=-30,lens=60);frame(margin=1.4);print(n,tris());render()

# ================= Tumbleweed: a dense tangle of curling branches around a dark core (unit radius) =================
scene('Tumbleweed');r=root('Tumbleweed');rr=random.Random(99)
LIGHT=mat('tw_light',(0xc4,0x9a,0x5c),0.95);DARK=mat('tw_dark',(0x7a,0x58,0x32),0.95)
def branch(i,thick,mat_):
    """One stem: a random walk that hugs the ball's shell and curls, as a thin bevelled curve (-> mesh)."""
    cu=bpy.data.curves.new(f'br{i}','CURVE');cu.dimensions='3D';cu.bevel_depth=thick;cu.bevel_resolution=0;cu.resolution_u=2;cu.use_fill_caps=True
    sp=cu.splines.new('BEZIER');n=rr.randint(5,8);sp.bezier_points.add(n-1)
    d=Vector((rr.uniform(-1,1),rr.uniform(-1,1),rr.uniform(-1,1))).normalized();rad=rr.uniform(0.55,0.98)
    axis=Vector((rr.uniform(-1,1),rr.uniform(-1,1),rr.uniform(-1,1))).normalized();step=rr.uniform(0.35,0.6)
    from mathutils import Quaternion
    for k,bp in enumerate(sp.bezier_points):
        p=d*rad*(1+0.08*math.sin(k*1.7));bp.co=p;bp.handle_left_type=bp.handle_right_type='AUTO'
        d=Quaternion(axis,step)@d;axis=Quaternion(d,rr.uniform(-0.6,0.6))@axis;rad=min(1.0,max(0.45,rad+rr.uniform(-0.12,0.12)))
    o=bpy.data.objects.new(f'br{i}',cu);bpy.context.window.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o
    for x in bpy.context.selected_objects:x.select_set(False)
    o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.active_object
    _link(o);o.data.materials.append(mat_);o.parent=r
    for p in o.data.polygons:p.use_smooth=False
    return o
for i in range(120):branch(i,rr.uniform(0.028,0.046),LIGHT if rr.random()<0.62 else DARK)
CORE=mat('tw_core',(0x9c,0x78,0x48),0.95)
core=rock('core',23,sub=2,scale=(1,1,1),disp=0.25,noise_size=0.5,decimate=0.5,parent=r,material=CORE);normalise(core,0.74)   # a packed middle that fills the gaps between stems
# join the stems into two meshes (one per shade) so the weed is two draws, not 110
for m_ in (LIGHT,DARK):
    objs=[o for o in coll('Asset').objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m_]
    for x in bpy.context.selected_objects:x.select_set(False)
    for o in objs:o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join()
studio(elev=12,azim=-30,lens=50,target=(0,0,0));frame(margin=1.25);bpy.data.objects['Tumbleweed.floor'].location.z=-1.0;print('tumbleweed',tris());render()
bpy.context.window.scene=bpy.data.scenes['ARCHIVED_Camper_minipc'];bpy.ops.wm.save_mainfile()
