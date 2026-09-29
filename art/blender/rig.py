for a in list(bpy.data.actions):
    if a.name.split('_')[0] in ('Lizard','Javelina','Lion','Vulture') or a.name in ('Walk','Run','Idle','Trot','Glide','Flap') or a.name[:4] in ('Walk','Run.','Idle','Trot','Glid','Flap'):bpy.data.actions.remove(a)
# run after beasts.py (same namespace): SKEL/ARMS hold each body's skeleton
from mathutils import Quaternion
def bake_and_join(sc_name,body_name):
    sc=bpy.data.scenes[sc_name];bpy.context.window.scene=sc
    meshes=[o for o in coll('Asset').all_objects if o.type=='MESH']
    for x in bpy.context.selected_objects:x.select_set(False)
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.convert(target='MESH')
    meshes=[o for o in coll('Asset').all_objects if o.type=='MESH']
    for o in meshes:
        me=o.data
        if 'Col' not in me.color_attributes:
            m=me.materials[0] if me.materials else None
            c=m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value if m and m.use_nodes else (0.5,0.5,0.5,1)
            ca=me.color_attributes.new('Col','FLOAT_COLOR','CORNER')
            for d in ca.data:d.color=(c[0],c[1],c[2],1)
        elif me.color_attributes['Col'].domain!='CORNER' or me.color_attributes['Col'].data_type!='FLOAT_COLOR':
            pass
        me.color_attributes.active_color=me.color_attributes['Col']
    body=next(o for o in meshes if o.name==body_name)
    for x in bpy.context.selected_objects:x.select_set(False)
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
    body=bpy.context.active_object;body.parent=None
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    body.data.materials.clear();body.data.materials.append(vcol_mat('beast_vcol',0.85))
    for p in body.data.polygons:p.material_index=0
    for o in list(coll('Asset').all_objects):
        if o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
    return body
def build_armature(name,nodes,edges,root_i,extra=()):
    arm_data=bpy.data.armatures.new(name+'_rig');arm=bpy.data.objects.new(name+'_rig',arm_data);coll('Asset').objects.link(arm)
    bpy.context.view_layer.objects.active=arm
    for x in bpy.context.selected_objects:x.select_set(False)
    arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    eb=arm_data.edit_bones;P=[Vector(n[:3]) for n in nodes]
    rb=eb.new('root');rb.head=P[root_i];rb.tail=P[root_i]+Vector((0,0,0.08))
    adj={}
    for a,b in edges:adj.setdefault(a,[]).append(b);adj.setdefault(b,[]).append(a)
    seen={root_i};q=[root_i];bone_of={root_i:'root'}
    while q:
        a=q.pop(0)
        for b in adj.get(a,[]):
            if b in seen:continue
            seen.add(b);q.append(b);bn=eb.new(f'b{b}');bn.head=P[a];bn.tail=P[b];bn.parent=eb[bone_of[a]];bn.use_connect=False;bone_of[b]=f'b{b}'
    for nm,h,t,par in extra:
        bn=eb.new(nm);bn.head=Vector(h);bn.tail=Vector(t);bn.parent=eb[par]
    for b in eb:
        d=(b.tail-b.head).normalized();b.align_roll(Vector((0,0,1)) if abs(d.z)<0.7 else Vector((0,-1,0)))
    bpy.ops.object.mode_set(mode='OBJECT');return arm
def weight(mesh,arm,allow=None,power=2,top=3,smooth=4):
    bones=[b for b in arm.data.bones if b.name!='root'];segs=[(b.name,b.head_local.copy(),b.tail_local.copy()) for b in bones]
    groups={n:mesh.vertex_groups.new(name=n) for n,_,_ in segs}
    for v in mesh.data.vertices:
        p=v.co;ds=[]
        for n,h,t in segs:
            if allow and not allow(n,p):continue
            d=t-h;L2=d.length_squared or 1e-9;u=max(0,min(1,(p-h).dot(d)/L2));ds.append(((p-(h+d*u)).length,n))
        ds.sort();tp=ds[:top];ws=[1/((dd+1e-3)**power) for dd,_ in tp];S_=sum(ws)
        for (dd,n),w in zip(tp,ws):groups[n].add([v.index],w/S_,'REPLACE')
    # smooth the weights across neighbouring vertices so joints bend instead of tearing at a seam
    bpy.context.view_layer.objects.active=mesh
    for x in bpy.context.selected_objects:x.select_set(False)
    mesh.select_set(True);bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL',factor=0.6,repeat=smooth)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    m=mesh.modifiers.new('arm','ARMATURE');m.object=arm;mesh.parent=arm
def clip(arm,name,frames,fn,loc_fn=None):
    """fn(phase 0..1) -> {bone: [(world_axis, degrees), ...]}; keyed every 2 frames over one loop."""
    name=arm.name.replace('_rig','')+'_'+name   # prefixed: the exporter can pull in same-boned clips from other creatures
    ad=arm.animation_data or arm.animation_data_create();act=bpy.data.actions.new(name);ad.action=act
    pbs=arm.pose.bones
    for pb in pbs:pb.rotation_mode='QUATERNION'
    for f in list(range(0,frames,2))+[frames]:
        ph=f/frames;rot=fn(ph)
        for pb in pbs:
            q=Quaternion()
            for ax,deg in rot.get(pb.name,[]):
                la=(pb.bone.matrix_local.to_3x3().inverted()@Vector(ax)).normalized();q=q@Quaternion(la,math.radians(deg))
            pb.rotation_quaternion=q;pb.keyframe_insert('rotation_quaternion',frame=f+1)
            pb.location=Vector((0,0,0))
            if loc_fn and pb.name=='root':pb.location=Vector(loc_fn(ph));pb.keyframe_insert('location',frame=f+1)
    tr=ad.nla_tracks.new();tr.name=name;tr.strips.new(name,1,act);ad.action=None
S2=math.sin;TAU=2*math.pi;X,Y,Zax=(1,0,0),(0,1,0),(0,0,1)
def export_rig(sc_name,path):
    sc=bpy.data.scenes[sc_name];bpy.context.window.scene=sc
    lc=bpy.context.view_layer.layer_collection.children[sc.name+'.Asset'];bpy.context.view_layer.active_layer_collection=lc
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_active_scene=True,use_active_collection=True,use_selection=False,export_apply=False,export_animations=True,export_skins=True,export_yup=True,
        export_vertex_color='ACTIVE',export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_def_bones=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
    return os.path.getsize(path)

# ---------------- LIZARD ----------------
b=bake_and_join('Lizard','liz');N,E=SKEL['liz'];arm=build_armature('Lizard',N,E,5)
weight(b,arm,allow=lambda n,p:(int(n[1:])<7 or int(n[1:])>11 or p.y>0.16) and (int(n[1:])<12 or abs(p.x)>0.05))
LEG={'FL':(12,-1,0.0),'BR':(24,1,0.0),'FR':(20,1,0.5),'BL':(16,-1,0.5)}
def liz_gait(amp,body):
    def fn(ph):
        p=ph*TAU;R={}
        R['b4']=[(Zax,body*S2(p))];R['b3']=[(Zax,-body*0.6*S2(p))];R['b2']=[(Zax,-body*0.5*S2(p))]
        R['b6']=[(Zax,-body*S2(p))]
        for k,i in enumerate(range(7,12)):R[f'b{i}']=[(Zax,-(body*1.3+k*2)*S2(p-0.6*(k+1)))]
        for nm,(i,s,off) in LEG.items():
            q=p+off*TAU;R[f'b{i}']=[(Zax,-s*amp*S2(q)),(Y,-s*amp*0.7*max(0,math.cos(q)))]
            R[f'b{i+1}']=[(Y,s*amp*0.4*max(0,math.cos(q)))]
        return R
    return fn
clip(arm,'Walk',24,liz_gait(28,9))
clip(arm,'Run',12,liz_gait(38,13))
clip(arm,'Idle',48,lambda ph:{'b2':[(Zax,12*S2(ph*TAU))],'b1':[(X,4*S2(ph*TAU*2))],**{f'b{i}':[(Zax,6*S2(ph*TAU-0.5*k))] for k,i in enumerate(range(7,12))}},
     loc_fn=lambda ph:(0,0,0.003*S2(ph*TAU*2)))
print('lizard exported',export_rig('Lizard','/home/botuser/camp-green-lake-blockbench/art/blender/glb/CreatureLizard.glb'))

# ---------------- JAVELINA ----------------
b=bake_and_join('Javelina','jav');N,E=SKEL['jav'];arm=build_armature('Javelina',N,E,4)
weight(b,arm,allow=lambda n,p:(not(10<=int(n[1:])<=25) or p.z<0.3) and (int(n[1:])!=26 or p.y>0.48))
JL={'FL':(10,0.0),'BR':(22,0.0),'FR':(18,0.5),'BL':(14,0.5)}
def jav_gait(amp,bob,head):
    def fn(ph):
        p=ph*TAU;R={}
        for nm,(i,off) in JL.items():
            q=p+off*TAU;R[f'b{i+1}']=[(X,-amp*S2(q))];R[f'b{i+2}']=[(X,amp*0.6*max(0,math.cos(q)))]   # b{i} is the spine-to-hip stub: leave it
        R['b6']=[(X,head*S2(p*2))];R['b26']=[(Zax,25*S2(p*2))]
        return R
    return fn
clip(arm,'Trot',16,jav_gait(26,0.02,3),loc_fn=lambda ph:(0,0,0.02*abs(S2(ph*TAU))))
clip(arm,'Run',10,jav_gait(40,0.035,5),loc_fn=lambda ph:(0,0,0.035*abs(S2(ph*TAU))))
clip(arm,'Idle',48,lambda ph:{'b6':[(X,-10+8*S2(ph*TAU))],'b7':[(X,-6*S2(ph*TAU))],'b26':[(Zax,20*S2(ph*TAU*3))]},loc_fn=lambda ph:(0,0,0.006*S2(ph*TAU*2)))
print('javelina exported',export_rig('Javelina','/home/botuser/camp-green-lake-blockbench/art/blender/glb/CreatureJavelina.glb'))

# ---------------- LION ----------------
b=bake_and_join('Lion','lion');N,E=SKEL['lion'];arm=build_armature('Lion',N,E,3)
weight(b,arm,allow=lambda n,p:(not(10<=int(n[1:])<=14) or p.y>0.62) and (not(15<=int(n[1:])<=30) or p.z<0.62),smooth=8)
LL={'BL':(19,0.0),'FL':(15,0.25),'BR':(27,0.5),'FR':(23,0.75)}
def lion_walk(amp):
    def fn(ph):
        p=ph*TAU;R={}
        for nm,(i,off) in LL.items():
            q=p+off*TAU;R[f'b{i+1}']=[(X,-amp*S2(q))];R[f'b{i+2}']=[(X,amp*0.7*max(0,math.cos(q)))];R[f'b{i+3}']=[(X,-amp*0.4*max(0,math.cos(q)))]
        R['b5']=[(Zax,3*S2(p))]
        for k,i in enumerate(range(10,15)):R[f'b{i}']=[(Zax,(6+k*3)*S2(p-0.7*k)),(X,-4)]
        return R
    return fn
def lion_run(ph):
    p=ph*TAU;R={}
    for nm,(i,off) in {'FL':(15,0.0),'FR':(23,0.08),'BL':(19,0.5),'BR':(27,0.58)}.items():
        hind=i in (19,27);up=34 if hind else 40   # hind thighs swing less (they're wrapped in the hip); the lower leg does more of the reach
        q=p+off*TAU;R[f'b{i+1}']=[(X,-up*S2(q))];R[f'b{i+2}']=[(X,(45 if hind else 35)*max(0,math.cos(q)))];R[f'b{i+3}']=[(X,-(30 if hind else 20)*max(0,math.cos(q)))]
    R['b2']=[(X,10*S2(p))];R['b4']=[(X,-8*S2(p))];R['b5']=[(X,6*S2(p))]
    for k,i in enumerate(range(10,15)):R[f'b{i}']=[(X,-10+(5+k*3)*S2(p-0.6*k))]
    return R
clip(arm,'Walk',30,lion_walk(22),loc_fn=lambda ph:(0,0,0.015*abs(S2(ph*TAU*2))))
clip(arm,'Run',14,lion_run,loc_fn=lambda ph:(0,0,0.06*S2(ph*TAU)))
clip(arm,'Idle',60,lambda ph:{'b6':[(Zax,10*S2(ph*TAU))],**{f'b{i}':[(Zax,(4+k*4)*S2(ph*TAU*2-0.8*k))] for k,i in enumerate(range(10,15))}},loc_fn=lambda ph:(0,0,0.008*S2(ph*TAU*2)))
print('lion exported',export_rig('Lion','/home/botuser/camp-green-lake-blockbench/art/blender/glb/CreatureLion.glb'))

# ---------------- VULTURE: now in vulture.py ----------------
bpy.context.window.scene=bpy.data.scenes['ARCHIVED_Camper_minipc'];bpy.ops.wm.save_mainfile()
