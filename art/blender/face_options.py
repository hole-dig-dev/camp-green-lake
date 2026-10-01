# blend: faces.blend
# Twenty cosmetic face sets. The approved head and nose are fit references, never exported or edited.
import bpy,bmesh,math,os,json
from mathutils import Matrix,Vector
REPO=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
exec(compile(open(os.path.join(REPO,'blender/cgl_helpers.py')).read(),'cgl_helpers.py','exec'))
OUT=os.path.join(REPO,'public/models/faces');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for s in list(bpy.data.scenes):
    if s!=bpy.context.scene:bpy.data.scenes.remove(s)
FACE_INK=mat('CGL_FaceInk','#35231E');FRECKLE=mat('CGL_FaceFreckle','#8E5239');BLUSH=mat('CGL_FaceBlush','#CC7E68')
HAIR=mat('CGL_FaceHair','#493125');SCAR=mat('CGL_FaceLine','#916044')
REF=None;HEAD=None;PRE='';PARTS=[]

def detail(label,bm,m,x,z,thick=.018,scale=None,roll=0,extra=0,bev=0):
    o=stick(PRE+label,bm,m,REF,HEAD,x,HB+z,thick,scale=scale,roll=roll,extra=extra,bev=bev)
    PARTS.append(o);return o

def eye(s,kind='dot',w=.05,h=.06,z=.392,glint=False):
    x=s*.09
    if kind=='closed':detail('EyeClosed'+str(s),arc_tube(.033,.008,20,160),EYE,x,z,.016)
    elif kind=='wink':detail('EyeWink'+str(s),arc_tube(.034,.007,200,340),EYE,x,z,.014)
    elif kind=='lid':
        detail('Eye'+str(s),ico(1,2),EYE,x,z-.008,.04,scale=(w/2,.024,h/2))
        detail('Eyelid'+str(s),bm_box(w+.012,.020,.010),FACE_INK,x,z+h*.24,.022,bev=.003,extra=.008)
    elif kind=='white':
        detail('EyeWhite'+str(s),ico(1,2),EYEW,x,z,.032,scale=(w*.7,.020,h*.65))
        detail('Pupil'+str(s),ico(1,2),EYE,x,z,.040,scale=(w*.34,.023,h*.38),extra=.008)
    else:detail('Eye'+str(s),ico(1,2),EYE,x,z,.05,scale=(w/2,.025,h/2))
    if glint:detail('EyeGlint'+str(s),ico(1,1),TOOTH,x-.008,z+.012,.008,scale=(.004,.004,.005),extra=.036)

def brows(left=-10,right=10,width=.08,thick=.022,z=.462,offset=0):
    for s,roll in ((-1,left),(1,right)):
        detail('Brow'+str(s),bm_box(width,.02,thick),BROW,s*.10,z+(offset if s<0 else 0),.022,bev=min(.006,thick*.4),roll=roll)

def smile(r=.06,thick=.012,angles=(215,325),x=0,z=.192,roll=0):
    return detail('Mouth',arc_tube(r,thick,*angles),MOUTH,x,z,thick*2,roll=roll)

def flat(w=.10,z=.195,roll=0):return detail('Mouth',bm_box(w,.018,.012),MOUTH,0,z,.020,bev=.004,roll=roll)

def opened(w=.13,h=.063,teeth='strip',z=.192):
    detail('MouthOpen',ico(1,2),MOUTH,0,z,.022,scale=(w/2,.014,h/2))
    if teeth=='strip':detail('Teeth',bm_box(w*.69,.015,h*.21),TOOTH,0,z+h*.18,.016,bev=.003,extra=.011)
    if teeth in ('gap','buck'):
        for s in(-1,1):detail('Tooth'+str(s),bm_box(w*.23,.014,h*(.27 if teeth=='gap' else .54)),TOOTH,s*w*.16,z+h*.1,.016,bev=.003,extra=.012)

def dots(kind='freckles'):
    m=FRECKLE if kind=='freckles' else FACE_INK
    for s in(-1,1):
        for i,(x,z) in enumerate(((.127,.28),(.157,.303),(.18,.272))):
            detail(kind+str(s)+str(i),ico(1,1),m,s*x,z,.008,scale=(.007,.004,.006),extra=.002)

def cheeks():
    for s in(-1,1):detail('Cheek'+str(s),ico(1,2),BLUSH,s*.157,.281,.010,scale=(.034,.005,.016))

def dimples():
    for s in(-1,1):detail('Dimple'+str(s),arc_tube(.016,.005,200,340),FRECKLE,s*.098,.207,.010,roll=s*30)

def mustache():
    for s in(-1,1):
        detail('Mustache'+str(s),arc_tube(.040,.012,25,160),HAIR,s*.037,.252,.025,roll=s*8)
        detail('Tip'+str(s),arc_tube(.018,.007,180,310),HAIR,s*.083,.248,.014,roll=s*25)

def stubble():
    for s in(-1,1):
        for i,(x,z) in enumerate(((.112,.20),(.102,.162),(.078,.127),(.045,.103),(.148,.233))):
            detail('Stubble'+str(s)+str(i),bm_box(.008,.012,.018),HAIR,s*x,z,.012,roll=s*18,bev=.002)
    detail('ChinStubble',bm_box(.025,.012,.009),HAIR,0,.087,.012,bev=.003)

def weather():
    for s in(-1,1):
        for i,z in enumerate((.31,.28)):detail('SmileLine'+str(s)+str(i),bm_box(.030,.010,.006),SCAR,s*.156,z,.008,roll=-s*15,bev=.002)

def pair(kind='dot',w=.05,h=.06,glint=False):
    for s in(-1,1):eye(s,kind,w,h,glint=glint)

DEFS=[
('01-classic','Classic','Your familiar button eyes, gentle brows and small smile.','Familiar',lambda:(pair(),brows(),smile())),
('02-friendly','Friendly','Bright taller eyes, soft brows and a wider welcoming smile.','Warm',lambda:(pair(w=.048,h=.075,glint=True),brows(7,-7,width=.072,thick=.018),smile(.081,.011))),
('03-tiny-trouble','Tiny Trouble','Small dot eyes, one cocked brow and a crooked little grin.','Playful',lambda:(pair(w=.031,h=.038),brows(22,0,width=.068,offset=.018),smile(.055,.009,angles=(225,320),x=.01,roll=-8))),
('04-deadpan','Deadpan','Even brows and a neat straight mouth: totally unimpressed.','Dry',lambda:(pair(w=.042,h=.048),brows(0,0,width=.082,thick=.017),flat(.091))),
('05-sleepy','Sleepy','Half-lidded eyes, relaxed brows and a sleepy small mouth.','Chill',lambda:(pair('lid',.054,.043),brows(0,0,width=.08,thick=.017,z=.449),smile(.044,.009,angles=(250,290)))),
('06-skeptic','Skeptic','A raised eyebrow, a heavy lid and an off-center smirk.','Dry',lambda:(eye(-1,'dot',.047,.066),eye(1,'lid',.046,.036),brows(20,0,width=.089,offset=.026),smile(.06,.010,angles=(235,320),x=.01,roll=-12))),
('07-focused','Focused','Bold inward brows and a compact determined mouth.','Serious',lambda:(pair(w=.041,h=.052),brows(22,-22,width=.10,thick=.028,z=.447),flat(.078))),
('08-worried','Worried','Brows lifted toward the middle and a small upside-down smile.','Soft',lambda:(pair(w=.041,h=.061),brows(-23,23,width=.09,thick=.017),smile(.059,.010,angles=(35,145)))),
('09-sunshine','Sunshine','Happy closed eyes and a generous open grin.','Warm',lambda:(pair('closed'),brows(5,-5,width=.065,thick=.014,z=.472),opened(.145,.066))),
('10-wink','Wink','One bright eye, one curved wink and a jaunty grin.','Playful',lambda:(eye(-1,'dot',.05,.065,glint=True),eye(1,'wink'),brows(14,0,width=.077),smile(.069,.010,roll=-7))),
('11-surprised','Surprised','Wide oval eyes, lifted brows and a little O-shaped mouth.','Expressive',lambda:(pair(w=.051,h=.087),brows(-5,5,width=.068,z=.490),opened(.050,.070,teeth=None))),
('12-freckle-friend','Freckle Friend','Six scattered freckles, warm eyes and a simple smile.','Detail',lambda:(pair(w=.043,h=.061),brows(8,-8,width=.071,thick=.019),smile(.072,.010),dots())),
('13-dimple-grin','Dimple Grin','Rounded eyes, a toothy grin and small curved dimples.','Warm',lambda:(pair(w=.057,h=.061,glint=True),brows(8,-8,width=.079),opened(.149,.066),dimples())),
('14-gap-tooth','Gap Tooth','Small eye whites and an open grin with two separated front teeth.','Playful',lambda:(pair('white',.043,.057),brows(10,-10,width=.074),opened(.126,.062,'gap'))),
('15-goofball','Goofball','Tiny eyes, raised brows and two large cartoon front teeth.','Playful',lambda:(pair(w=.035,h=.047),brows(18,-18,width=.069,z=.477),opened(.105,.085,'buck'))),
('16-scruffy','Scruffy','Calm eyes, a crooked smile and little chin stubble marks.','Detail',lambda:(pair(w=.042,h=.056),brows(12,-6,width=.086,thick=.025),smile(.060,.010,roll=-5),stubble())),
('17-old-pal','Old Pal','A curled brown mustache, kind eyes and a small smile underneath.','Detail',lambda:(pair(w=.042,h=.052),brows(9,-9,width=.098,thick=.025),smile(.061,.009,z=.164),mustache())),
('18-rosy','Rosy','Soft cheek color, happy crescent eyes and a quiet smile.','Soft',lambda:(pair('closed'),brows(8,-8,width=.062,thick=.015),smile(.068,.010),cheeks())),
('19-seasoned','Seasoned','Short smile lines, thicker brows and a slightly uneven grin.','Detail',lambda:(pair('lid',.047,.048),brows(8,-12,width=.10,thick=.026),smile(.074,.011,roll=5),weather())),
('20-swagger','Swagger','A bold brow, one narrowed eye and a confident asymmetric smile.','Expressive',lambda:(eye(-1,'lid',.049,.042),eye(1,'dot',.046,.061),brows(0,-19,width=.091,thick=.026,offset=.026),smile(.08,.012,angles=(238,327),x=.012,roll=9)))
]
manifest=[]
for i,(slug,name,description,group,build) in enumerate(DEFS):
    scene=bpy.context.scene if i==0 else bpy.data.scenes.new('Face_'+slug)
    scene.name='Face_'+slug;bpy.context.window.scene=scene;use_collection('Face_'+slug)
    REF=empty('FitReference',None);HEAD=head('FitReference_',REF);button_nose('FitReference_',REF,HEAD)
    ROOT=empty('FaceRoot',None);ROOT['attachment']='head';PRE='Face%02d_'%(i+1);PARTS=[]
    bpy.context.view_layer.update();build();bpy.context.view_layer.update()
    offset=Matrix.Translation((0,0,-HB))
    for o in PARTS:
        mw=offset@o.matrix_world.copy();o.parent=ROOT;o.matrix_world=mw
    REF.location.z=-HB;bpy.context.view_layer.update()
    for o in bpy.context.view_layer.objects:o.select_set(False)
    for o in [ROOT]+PARTS:o.select_set(True)
    bpy.context.view_layer.objects.active=ROOT
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,slug+'.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_yup=True)
    scene['name']=name;scene['description']=description
    manifest.append(dict(id=i+1,slug=slug,name=name,description=description,group=group,file='../models/faces/'+slug+'.glb',head='unchanged',nose='original',cosmeticOnly=True,approved=True))
bpy.context.window.scene=bpy.data.scenes['Face_01-classic']
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REPO,'art/blender/faces.blend'),compress=True)
with open(os.path.join(REPO,'public/face-lab/manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
print('FACE LAB: exported 20 cosmetic face sets; the original head and nose are fit references only.')
