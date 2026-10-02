"""Gravity boots in the footwear_options.py bind-space/metadata contract.
Original camper skeleton; each side weighted entirely to its original shin.
"""
from pathlib import Path
import bpy, math, hashlib, json
from mathutils import Matrix
HERE=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
exec((HERE/'upgrades_common.py').read_text())
bpy.ops.import_scene.gltf(filepath=str(PUBLIC/'camper.glb'))
source=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
source.animation_data_clear()
for p in source.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
r=begin('GravityBoots');bpy.data.objects.remove(r,do_unlink=True)
rig=source.copy();rig.data=source.data.copy();rig.name='GravityBootsRig';rig.animation_data_clear();_link(rig)
for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
GLOW=('gravity_coil',(71,224,207),.38,.2)
glow=mat(*GLOW);bs=glow.node_tree.nodes['Principled BSDF']
bs.inputs['Emission Color'].default_value=srgb(GLOW[1]);bs.inputs['Emission Strength'].default_value=2.0
parts=[]
for sign,side in ((-1,'L'),(1,'R')):
    x=sign*.15
    def B(tag,size,loc,m,bv=.012):
        o=box('GravityBoots_'+side+'_'+tag,size,loc,m,bevel=bv);parts.append((o,side));return o
    B('MagneticOutsole',(.236,.354,.046),(x,-.05,.023),DARK)
    B('GlowingSole',(.238,.355,.014),(x,-.05,.057),GLOW,.006)
    B('SteelUpper',(.220,.34,.135),(x,-.047,.122),STEEL,.036)
    B('ToeArmor',(.221,.12,.085),(x,-.16,.112),DARK,.020)
    # Same open-throat construction and ankle footprint as existing footwear.
    vs=[];fs=[];N=20
    for rad,z in ((.118,.14),(.118,.365),(.104,.365),(.104,.14)):
        vs.extend((x+rad*math.cos(k*math.tau/N),rad*math.sin(k*math.tau/N),z) for k in range(N))
    for i in range(4):
        for k in range(N):fs.append((i*N+k,i*N+(k+1)%N,((i+1)%4)*N+(k+1)%N,((i+1)%4)*N+k))
    o=pipe_mesh('GravityBoots_'+side+'_HollowShaft',vs,fs,mat(*DARK));parts.append((o,side))
    B('FrontArmor',(.136,.035,.17),(x,-.122,.265),STEEL,.014)
    for z in (.205,.265,.325):
        o=torus('GravityBoots_'+side+'_Coil',(x,0,z),.12,.009,GLOW,None);parts.append((o,side))
        B('FrontVent',(.101,.007,.010),(x,-.143,z),DARK,.001)
    B('OuterMagnet',(.031,.084,.092),(x+sign*.122,0,.257),STEEL,.007)
    B('PolarityBadge',(.006,.041,.034),(x+sign*.141,-.004,.262),BRASS,.002)
    for y in (-.18,-.095,-.01,.075):
        for s in (-1,1):B('GroundLug',(.056,.041,.026),(x+s*.082,y,.013),DARK,.004)
for o,side in parts:
    me=bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.transform(o.matrix_world);o.data=me;o.matrix_world=Matrix.Identity(4);o.modifiers.clear();o.parent=rig
    o['slot']='footwear';o['side']=side;o['cosmeticOnly']=True
    g=o.vertex_groups.new(name='shin.'+side);g.add(list(range(len(me.vertices))),1,'REPLACE')
    mod=o.modifiers.new('Existing shin bone','ARMATURE');mod.object=rig
bpy.context.view_layer.update();preview(elev=20,azim=-25)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o,_ in parts:o.select_set(True)
bpy.context.view_layer.objects.active=rig
path=OUT/'GravityBoots.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
    use_active_scene=True,export_animations=False,export_extras=True,export_skins=True)
(PUBLIC/'footwear').mkdir(exist_ok=True)
shutil.copy2(path,PUBLIC/'footwear/gravity-boots.glb')
(OUT/'GravityBoots.json').write_text(json.dumps(dict(sourceCamperSHA256=hashlib.sha256((PUBLIC/'camper.glb').read_bytes()).hexdigest(),
    slot='footwear',bones=['shin.L','shin.R'],maxHeight=.365),indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'upgrades-boots.blend'),compress=True)
