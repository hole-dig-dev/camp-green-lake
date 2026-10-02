"""Original scruffy mine dog: 14 deform bones, six in-place NLA clips.
Run background Blender with --python-exit-code 1 --python this script.
Blender -Y faces game +Z. Bind-pose soles touch Z=0.
"""
from pathlib import Path
import bpy, math
from mathutils import Vector, Quaternion, Matrix
HERE=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
exec((HERE/'upgrades_common.py').read_text())
r=begin('Dog')
FUR=('dog_sandy_fur',(174,129,79),.95,0)
LIGHT=('dog_muzzle',(225,195,143),.96,0)
SCRUFF=('dog_scruff',(145,105,65),.97,0)
VEST=('dog_safety_vest',(190,128,39),.93,0)
parts=[]
def fur(name,loc,scale,material,bone,sub=1):
    o=lump(name,loc,scale,material,r,sub);parts.append((o,bone));return o
def bar(name,a,b,rr,material,bone,tip=None):
    o=tube(name,a,b,rr,material,r,tip=tip);parts.append((o,bone));return o
fur('scruffy_body',(0,.02,.35),(.13,.255,.145),FUR,'root',2)
fur('chest',(0,-.16,.35),(.12,.105,.15),LIGHT,'root',2)
fur('vest_back',(0,.045,.445),(.137,.17,.052),VEST,'root',2)
for s in (-1,1):
    fur('vest_side',(s*.116,.065,.355),(.019,.145,.085),VEST,'root',2)
    for y in (-.07,.16):bar('vest_strap',(s*.133,y,.32),(s*.133,y,.42),.009,DARK,'root')
    fur('vest_buckle',(s*.139,-.065,.365),(.011,.021,.025),BRASS,'root')
fur('neck',(0,-.225,.43),(.102,.10,.13),FUR,'head',2)
fur('head',(0,-.30,.46),(.12,.118,.12),FUR,'head',2)
fur('muzzle',(0,-.405,.423),(.080,.080,.057),LIGHT,'head',2)
fur('wet_nose',(0,-.470,.438),(.047,.026,.031),DARK,'head',2)
fur('lower_jaw',(0,-.396,.394),(.061,.067,.021),SCRUFF,'jaw',2)
fur('tongue',(0,-.435,.398),(.028,.039,.006),('dog_tongue',(205,114,104),.85,0),'jaw')
for s in (-1,1):
    fur('eye',(s*.078,-.376,.488),(.016,.013,.019),DARK,'head',2)
    fur('eye_glint',(s*.079,-.387,.495),(.005,.004,.005),CREAM,'head')
    bar('eyebrow',(s*.055,-.37,.513),(s*.098,-.351,.516),.014,SCRUFF,'head')
    fur('floppy_ear',(s*.119,-.265,.476),(.046,.058,.111),SCRUFF,'ear.'+('L' if s<0 else 'R'),2)
    for y,z in ((-.2,.29),(.20,.31),(-.285,.54)):
        bar('fur_tuft',(s*.09,y,z),(s*.155,y+.045,z+.033),.027,FUR,'head' if y<-.25 else 'root',tip=.002)
bar('tail',(0,.235,.40),(0,.38,.49),.034,FUR,'tail',tip=.012)
bar('tail_scruff',(0,.35,.466),(.025,.415,.487),.023,LIGHT,'tail',tip=.003)
legs={}
for s,side in ((-1,'L'),(1,'R')):
    for end,y in (('F',-.155),('H',.185)):
        x=s*.091;hip=(x,y,.34);knee=(x,y+(.026 if end=='H' else 0),.17);foot=(x,y-.018,.038)
        upper=end+'Upper.'+side;lower=end+'Lower.'+side
        legs[upper]=(hip,knee,'root');legs[lower]=(knee,foot,upper)
        fur('haunch' if end=='H' else 'shoulder',hip,(.065,.074,.085),FUR,upper,2)
        bar('upper_leg',hip,knee,.043,FUR,upper,tip=.033)
        fur('knee',knee,(.038,.044,.042),FUR,lower)
        bar('lower_leg',knee,foot,.027,LIGHT,lower,tip=.025)
        fur('paw',(x,y-.04,.037),(.045,.070,.037),LIGHT,lower,2)
        for dx in (-.02,0,.02):bar('toe_mark',(x+dx,y-.095,.038),(x+dx,y-.077,.036),.0025,SCRUFF,lower)

ad=bpy.data.armatures.new('DogSkeleton');arm=bpy.data.objects.new('DogRig',ad);_link(arm)
bpy.context.view_layer.objects.active=arm;arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
spec={'root':((0,0,.35),(0,0,.45),None),
      'head':((0,-.20,.43),(0,-.33,.46),'root'),
      'jaw':((0,-.35,.404),(0,-.435,.397),'head'),
      'tail':((0,.235,.40),(0,.38,.49),'root'),
      'ear.L':((-.104,-.263,.535),(-.124,-.263,.43),'head'),
      'ear.R':((.104,-.263,.535),(.124,-.263,.43),'head'),**legs}
for name,(h,t,parent) in spec.items():
    b=ad.edit_bones.new(name);b.head=h;b.tail=t
    if parent:b.parent=ad.edit_bones[parent]
    direction=(Vector(t)-Vector(h)).normalized()
    b.align_roll(Vector((0,0,1)) if abs(direction.z)<.8 else Vector((0,-1,0)))
bpy.ops.object.mode_set(mode='OBJECT')
# Bake primitive bevels/transforms, then join pieces while retaining intentional rigid weights.
for o,bone in parts:
    me=bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    me.transform(o.matrix_world);o.data=me;o.parent=None;o.matrix_world=Matrix.Identity(4)
    o.modifiers.clear();g=o.vertex_groups.new(name=bone);g.add(list(range(len(me.vertices))),1,'REPLACE')
bpy.ops.object.select_all(action='DESELECT')
for o,_ in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0][0];bpy.ops.object.join();body=bpy.context.object;body.name='DogBody'
body.parent=arm;mod=body.modifiers.new('Dog skin','ARMATURE');mod.object=arm
bpy.data.objects.remove(r,do_unlink=True)
anim=arm.animation_data_create();bpy.context.scene.render.fps=24
X,Z=Vector((1,0,0)),Vector((0,0,1))
lengths={'Idle':2.0,'Walk':1.0,'Run':.5,'Sniff':2.0,'Bark':1.0,'Sit':2.0}
def pose(name,p):
    w=math.sin(p*math.tau);rot={};height=0
    rot['tail']=[(Z,18*math.sin(p*math.tau*2))]
    if name=='Idle':
        rot['head']=[(Z,4*w),(X,2*math.sin(p*math.tau*2))];height=.003*math.sin(p*math.tau*2)
    if name in ('Walk','Run'):
        amp=23 if name=='Walk' else 38
        for side in ('L','R'):
            for end in ('F','H'):
                phase=p*math.tau+(math.pi if (side=='R')!=(end=='H') else 0)
                if name=='Run':phase=p*math.tau+(0 if end=='F' else math.pi)+(.22 if side=='R' else 0)
                rot[end+'Upper.'+side]=[(X,amp*math.sin(phase))]
                rot[end+'Lower.'+side]=[(X,amp*.65*max(0,math.cos(phase)))]
        rot['head']=[(X,3*w)];rot['ear.L']=[(X,9*w)];rot['ear.R']=[(X,9*w)]
        height=(.008 if name=='Walk' else .025)*(1-math.cos(p*math.tau*2))
    if name=='Sniff':
        rot['root']=[(X,12)];rot['head']=[(X,54+3*math.sin(p*math.tau*3)),(Z,5*w)]
        height=-.013
        for side in ('L','R'):
            rot['FUpper.'+side]=[(X,-60)];rot['FLower.'+side]=[(X,78)]
        rot['tail']=[(Z,32*math.sin(p*math.tau*4))]
    if name=='Bark':
        pulse=max(0,math.sin(p*math.tau*2))
        rot['head']=[(X,-9-8*pulse)];rot['jaw']=[(X,24*pulse)]
        rot['ear.L']=[(X,12*pulse)];rot['ear.R']=[(X,12*pulse)]
    if name=='Sit':
        # A seated idle loop: switch/crossfade into this pose using the mixer.
        rot['root']=[(X,-22)];height=-.09
        rot['head']=[(X,22),(Z,3*w)]
        for side in ('L','R'):
            rot['HUpper.'+side]=[(X,-65)];rot['HLower.'+side]=[(X,90)]
            rot['FUpper.'+side]=[(X,22)];rot['FLower.'+side]=[(X,-12)]
    return rot,height
for name,duration in lengths.items():
    act=bpy.data.actions.new(name);anim.action=act;frames=round(duration*24)
    for frame_no in range(frames+1):
        rot,height=pose(name,frame_no/frames)
        for pb in arm.pose.bones:
            pb.rotation_mode='QUATERNION';q=Quaternion()
            for axis,deg in rot.get(pb.name,[]):
                local=pb.bone.matrix_local.to_3x3().inverted()@axis
                q=q@Quaternion(local.normalized(),math.radians(deg))
            pb.rotation_quaternion=q;pb.location=(0,height,0) if pb.name=='root' else (0,0,0)
            pb.keyframe_insert('rotation_quaternion',frame=frame_no)
            pb.keyframe_insert('location',frame=frame_no)
    tr=anim.nla_tracks.new();tr.name=name;tr.strips.new(name,0,act);tr.mute=True;anim.action=None
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.scene.frame_set(1);preview(elev=20)
# Preserve only one rig in the asset export and export each NLA track by its exact name.
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);body.select_set(True)
for tr in anim.nla_tracks:tr.mute=False
bpy.ops.export_scene.gltf(filepath=str(OUT/'Dog.glb'),export_format='GLB',use_selection=True,use_active_scene=True,
    export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,
    export_skins=True,export_yup=True,export_cameras=False,export_lights=False)
shutil.copy2(OUT/'Dog.glb',PUBLIC/'Dog.glb')
for tr in anim.nla_tracks:tr.mute=True
for name in lengths:
    anim.action=bpy.data.actions[name];bpy.context.scene.frame_set(4 if name=='Bark' else 8)
    for o in list(coll('Studio').objects):bpy.data.objects.remove(o,do_unlink=True)
    preview('Dog-'+name,elev=18)
anim.action=None
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'upgrades-dog.blend'),compress=True)
