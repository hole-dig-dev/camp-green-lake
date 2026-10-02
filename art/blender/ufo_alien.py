"""Two Easter egg assets. All geometry is authored here in background Blender.

Rebuild from the checkout root (RADV, no software rendering):
  env -u DISPLAY TMPDIR="$PWD/.ufo-tmp" blender -b --factory-startup \
    --gpu-backend vulkan --threads 4 --python-exit-code 1 --python art/blender/ufo_alien.py
Blender +Z becomes game +Y; Blender -Y is the face's game +Z forward.
"""
from pathlib import Path
import bpy, math, shutil, json
from mathutils import Vector

HERE = Path(__file__).resolve().parent
exec((HERE / 'cgl_blender.py').read_text())
exec((HERE / 'pipeline_common.py').read_text())

STEEL = ('ufo_brushed_aluminium', (162, 179, 185), .38, .62)
LIGHT_STEEL = ('ufo_machined_edges', (212, 224, 224), .29, .48)
DARK = ('ufo_recesses', (36, 55, 62), .62, .25)
GLASS = ('ufo_dome_glass', (148, 214, 219), .15, .0)
GREEN = ('ufo_rim_emerald_green', (36, 230, 77), .28, .0)
LIME = ('ufo_rim_lime_green', (153, 255, 54), .28, .0)
LEAF = ('ufo_rim_leaf_green', (73, 210, 55), .28, .0)
EMITTER = ('ufo_tractor_emitter', (104, 255, 87), .25, .0)
SKIN = ('alien_green', (95, 208, 74), .4, .0) # #5fd04a, matching game body skin
LIDS = ('alien_eye_socket', (42, 137, 38), .48, .0)
BLACK = ('alien_glossy_black_eyes', (8, 13, 15), .12, .0)
INK = ('alien_nostrils_mouth', (16, 63, 20), .85, .0)
GLINT = ('alien_eye_glints', (203, 232, 223), .16, .0)

def smooth(o):
    for p in o.data.polygons: p.use_smooth = True
    return o

def lathe(name, profile, spec, sy=1, seg=96):
    verts = [(r*math.cos(math.tau*k/seg), r*sy*math.sin(math.tau*k/seg), z)
             for r,z in profile for k in range(seg)]
    faces = [(j*seg+k,j*seg+(k+1)%seg,(j+1)*seg+(k+1)%seg,(j+1)*seg+k)
             for j in range(len(profile)-1) for k in range(seg)]
    return smooth(pipe_mesh(name, verts, faces, mat(*spec), ROOT))

def ball(name, loc, scale, spec, seg=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    _finish(o, spec, 0, ROOT)
    return smooth(o)

def tor(name,r,z,t,spec,seg=96):
    bpy.ops.mesh.primitive_torus_add(major_segments=seg,minor_segments=8,
                                   major_radius=r,minor_radius=t,location=(0,0,z))
    o=bpy.context.object; o.name=name; _finish(o,spec,0,ROOT)
    return smooth(o)

def export(name, notes):
    bpy.context.view_layer.update()
    count=tris()
    pts=[o.matrix_world @ v.co for o in coll().all_objects if o.type=='MESH' for v in o.data.vertices]
    bounds=[[min(v[i] for v in pts) for i in range(3)], [max(v[i] for v in pts) for i in range(3)]]
    out=HERE/'glb'/f'{name}.glb'
    info=pipeline_export(str(out),ROOT)
    shutil.copy2(out,HERE.parents[1]/'public/models'/out.name)
    audit={'file':out.name,'bytes':info[1],'triangles':count,'blender_bounds':bounds,**notes}
    (HERE/'renders'/f'{name}-asset.json').write_text(json.dumps(audit,indent=2)+'\n')
    return audit

def glow():
    sc=bpy.context.scene; sc.use_nodes=True; nt=sc.node_tree; nt.nodes.clear()
    rl=nt.nodes.new('CompositorNodeRLayers'); g=nt.nodes.new('CompositorNodeGlare')
    g.glare_type='FOG_GLOW';g.threshold=1.2;g.quality='HIGH';g.mix=-.9
    c=nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'],g.inputs['Image']);nt.links.new(g.outputs['Image'],c.inputs['Image'])

scene('UFO'); ROOT=root('UFO')
for spec in (GREEN,LIME,LEAF,EMITTER):
    bs=mat(*spec).node_tree.nodes['Principled BSDF']
    bs.inputs['Emission Color'].default_value=srgb(spec[1])
    bs.inputs['Emission Strength'].default_value=1 # core glTF, compatible with r128
glass=mat(*GLASS); bs=glass.node_tree.nodes['Principled BSDF']
bs.inputs['Alpha'].default_value=.26
glass.diffuse_color=(*glass.diffuse_color[:3],.26)
glass.surface_render_method='BLENDED';glass.use_backface_culling=True

# A classic double-convex disc, with a broad, chunky rim and readable seams.
lathe('saucer_shell',[(0,.08),(.70,.08),(1.15,.18),(2.1,.31),(2.83,.46),
                    (3,.55),(3,.65),(2.89,.72),(2.45,.84),(1.65,.97),
                    (1.05,1.02),(0,1.02)],STEEL)
lathe('rim_belt',[(2.99,.54),(3,.56),(3,.65),(2.99,.67)],DARK)
for z in (.53,.68):tor('rolled_rim_edge',2.975,z,.025,LIGHT_STEEL)
for r,z in [(1.43,.997),(1.80,.95),(2.18,.89),(2.56,.81)]:
    tor('concentric_machining',r,z,.006,LIGHT_STEEL)
tor('canopy_seal',1.035,1.025,.05,DARK)
tor('canopy_chrome',1.045,1.062,.022,LIGHT_STEEL)
# Transparent cyan shell, no transmission-only shader or texture dependency.
lathe('glass_canopy',[(1.02,1.055),(1.006,1.19),(.94,1.37),(.79,1.56),
                     (.59,1.71),(.33,1.78),(0,1.80)],GLASS)
cyl('cockpit_deck',.98,.035,(0,0,1.045),DARK,verts=64,bevel=0,parent=ROOT)
ball('pilot_cranium',(0,.16,1.44),(.20,.16,.25),SKIN)
ball('pilot_body',(0,.20,1.16),(.17,.12,.16),SKIN)
for s in (-1,1):
    eye=ball('pilot_eye',(s*.085,.007,1.44),(.075,.028,.09),BLACK,24,12)
    eye.rotation_euler.y=s*-.3
box('pilot_console',(.58,.24,.15),(0,-.25,1.15),DARK,bevel=.025,parent=ROOT)
for x in (-.16,0,.16):ball('console_lamp',(x,-.25,1.23),(.025,.025,.01),GREEN,12,8)
for i in range(24):
    a=math.tau*i/24; spec=(GREEN,LIME,LEAF)[i%3]
    # Lights stand proud of the dark belt, facing outwards.
    socket=ball('rim_lamp_socket', (2.985*math.cos(a),2.985*math.sin(a),.60),(.035,.105,.079),DARK,16,8)
    socket.rotation_euler.z=a
    lamp=ball('rim_lamp', (3.018*math.cos(a),3.018*math.sin(a),.605),(.041,.078,.057),spec,16,8)
    lamp.rotation_euler.z=a
# The emitter's bottom centre is exactly the root origin.
cyl('emitter_armour',.73,.11,(0,0,.085),DARK,verts=64,bevel=.016,parent=ROOT)
tor('emitter_chrome',.68,.028,.028,LIGHT_STEEL)
lathe('tractor_emitter',[(0,0),(.62,0),(.62,.014),(0,.014)],EMITTER,seg=64)
for r in (.23,.43):tor('emitter_induction_ring',r,.009,.009,GREEN,64)
for i in range(12):
    a=math.tau*i/12
    box('underside_radial_vent',(.34,.06,.025),(1.27*math.cos(a),1.27*math.sin(a),.202),DARK,
        rot=(0,0,a),bevel=.008,parent=ROOT)
ufo=export('UFO',{'origin':'centre of underside emitter; game (0,0,0)',
                  'emissive_materials':['cgl_'+s[0] for s in (GREEN,LIME,LEAF,EMITTER)]})
cam=studio(target=(0,0,.8),elev=20,azim=32,floor=False)
glow();bpy.context.view_layer.update();frame(1.20)
render('UFO',res=(1400,1000),samples=48)
cam.location=(5,-7,-4);cam.rotation_euler=(Vector((0,0,.55))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update();frame(1.20);render('UFO-underside',res=(1400,1000),samples=48)

scene('AlienHead'); ROOT=root('AlienHead')
# Head bone begins at the old head's bottom. The retained camper neck occupies
# head-local Z=-.10..+.06; this closed sleeve covers it and tapers to a thin neck.
PROFILE=[(0,-.105),(.182,-.105),(.182,.065),(.094,.115),
         (.094,.13),(.15,.18),(.205,.24),(.268,.32),(.337,.43),
         (.382,.55),(.398,.65),(.373,.75),(.30,.83),(.18,.885),(0,.91)]
# A short exposed thin neck above the sleeve; keep all facial landmarks together.
FACE_LIFT=.07
PROFILE=[(r,z+FACE_LIFT if z>=.13 else z) for r,z in PROFILE]
lathe('neck_jaw_cranium',PROFILE,SKIN,sy=.87,seg=64)

def front_y(x,z):
    for (ra,za),(rb,zb) in zip(PROFILE,PROFILE[1:]):
        if za<=z<=zb:
            r=ra+(rb-ra)*(z-za)/(zb-za)
            return -.87*math.sqrt(max(0,r*r-x*x))
    raise ValueError(z)

def almond(name,s,spec,w,h,bulge,offset):
    # Pointed almond outline with a convex lens surface, conformed to cranium.
    n=40;verts=[];cx=s*.163;cz=.465+FACE_LIFT;roll=s*.30
    for j in range(9):
        r=j/8
        for k in range(n):
            a=math.tau*k/n
            xx=w*math.cos(a)*r;zz=h*math.sin(a)*abs(math.sin(a))**.3*r
            x=cx+xx*math.cos(roll)-zz*math.sin(roll)
            z=cz+xx*math.sin(roll)+zz*math.cos(roll)
            verts.append((x,front_y(x,z)-offset-bulge*(1-r*r),z))
    faces=[(j*n+k,(j+1)*n+k,(j+1)*n+(k+1)%n,j*n+(k+1)%n)
           for j in range(8) for k in range(n)]
    return smooth(pipe_mesh(name,verts,faces,mat(*spec),ROOT))

for s in (-1,1):
    almond('raised_eye_socket',s,LIDS,.145,.096,.034,.003)
    almond('huge_almond_eye',s,BLACK,.134,.085,.044,.009)
    x=s*.135;z=.495+FACE_LIFT
    ball('eye_catchlight',(x,front_y(x,z)-.055,z),(.021,.005,.009),GLINT,16,8)
    x=s*.021;z=.292+FACE_LIFT
    ball('nostril',(x,front_y(x,z)-.009,z),(.008,.005,.011),INK,16,8)
ball('small_nose_bridge',(0,front_y(0,.315+FACE_LIFT)-.002,.318+FACE_LIFT),(.025,.023,.036),SKIN,24,12)
# Quiet slit mouth: geometric curve with rounded ends, never a decal.
verts=[];faces=[]
for i in range(25):
    x=-.052+.104*i/24;z=.234+FACE_LIFT+.005*(x/.052)**2
    for k in range(8):
        a=math.tau*k/8
        verts.append((x,front_y(x,z)-.006+.003*math.cos(a),z+.003*math.sin(a)))
for i in range(24):
    for k in range(8):faces.append((i*8+k,i*8+(k+1)%8,(i+1)*8+(k+1)%8,(i+1)*8+k))
faces.extend([tuple(reversed(range(8))),tuple(range(24*8,25*8))])
smooth(pipe_mesh('slit_mouth',verts,faces,mat(*INK),ROOT))
alien=export('AlienHead',{'attachment':'head bone, identity local transform, scale 1',
                        'forward':'Blender -Y / game +Z',
                        'neck_sleeve_local_y_m':[-.105,.20],
                        'hide':'Head, Nose, Eye, Brow, Mouth, Teeth, Hair, hats, glasses; retain body and rig'})
cam=studio(target=(0,0,.4),elev=4,azim=0,floor=False)
bpy.context.view_layer.update();frame(1.20)
render('AlienHead',res=(1000,1000),samples=48)
cam.location=(3,-.01,.6);cam.rotation_euler=(Vector((0,0,.4))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update();frame(1.20);render('AlienHead-side',res=(1000,1000),samples=48)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'ufo-alien.blend'),compress=True)
print('UFO_ALIEN_ASSETS',json.dumps([ufo,alien]))
