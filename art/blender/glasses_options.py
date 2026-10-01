# blend: glasses.blend
# Twenty cosmetic eyewear sets fitted to the approved camper head; no head/rig changes.
import bpy,bmesh,math,os,json
from mathutils import Vector
REPO=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
exec(compile(open(os.path.join(REPO,'blender/cgl_helpers.py')).read(),'cgl_helpers.py','exec'))
OUT=os.path.join(REPO,'public/models/glasses');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for s in list(bpy.data.scenes):
    if s!=bpy.context.scene:bpy.data.scenes.remove(s)
PAL={'black':'#2C3035','navy':'#314352','gold':'#D5AB5F','copper':'#AE714D','brown':'#704A35','amber':'#B77D40',
     'cherry':'#A64D52','purple':'#71557F','white':'#EFE8D7','pink':'#DD6E91','lime':'#A4C850','orange':'#E78A45',
     'teal':'#3F8F94','clear':'#DED7C7','cream':'#F0DFBA'}
M={k:mat('Glasses_'+k,v,.38) for k,v in PAL.items()}

def lensmat(name,color,alpha=1,metal=0):
    m=mat('Lens_'+name,color,.19);m.diffuse_color=(*lin(color),alpha)
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*lin(color),alpha);b.inputs['Alpha'].default_value=alpha;b.inputs['Metallic'].default_value=metal
    if alpha<1:m.surface_render_method='BLENDED'
    return m
L={'clear':lensmat('Clear','#B0CCCA',.10),'smoke':lensmat('Smoke','#252D35'),
   'blue':lensmat('BlueMirror','#557FA8',1,.25),'amber':lensmat('Amber','#8E653B',.85),
   'green':lensmat('Green','#3E625D'),'rose':lensmat('Rose','#AA5F7C'),
   'violet':lensmat('Violet','#73658F'),'white':lensmat('Cream','#F0E8CE')}
ROOT=None;PRE='';PART=0;Z=.392

def put(label,bm,material):
    global PART
    PART+=1;return mk(PRE+label+str(PART),bm,material,ROOT)

def front(x):return -.342+.46*x*x

def tube(label,points,col='black',r=.006,closed=False):
    pts=[Vector(p) for p in points];bm=bmesh.new();rings=[]
    for i,c in enumerate(pts):
        t=(pts[(i+1)%len(pts)]-pts[i-1] if closed else pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        u=t.cross(Vector((0,1,0)))
        if u.length<.01:u=t.cross(Vector((0,0,1)))
        u.normalize();v=t.cross(u).normalized()
        rings.append([bm.verts.new(c+r*(math.cos(k*math.pi/4)*u+math.sin(k*math.pi/4)*v)) for k in range(8)])
    for i in range(len(rings) if closed else len(rings)-1):
        A,B=rings[i],rings[(i+1)%len(rings)]
        for k in range(8):bm.faces.new((A[k],A[(k+1)%8],B[(k+1)%8],B[k]))
    if not closed:bm.faces.new(rings[0][::-1]);bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces);return put(label,bm,M[col])

def ellipse(w,h,n=48):return [(w/2*math.cos(2*math.pi*i/n),h/2*math.sin(2*math.pi*i/n)) for i in range(n)]

def rounded(w,h,p=.5,n=48):
    return [(w/2*math.copysign(abs(math.cos(2*math.pi*i/n))**p,math.cos(2*math.pi*i/n)),h/2*math.copysign(abs(math.sin(2*math.pi*i/n))**p,math.sin(2*math.pi*i/n))) for i in range(n)]

def star(w=.18,h=.17):return [(math.sin(2*math.pi*i/10)*w/2*(1 if i%2==0 else .48),math.cos(2*math.pi*i/10)*h/2*(1 if i%2==0 else .48)) for i in range(10)]

def heart(w=.18,h=.155):
    raw=[(16*math.sin(2*math.pi*i/64)**3,13*math.cos(2*math.pi*i/64)-5*math.cos(4*math.pi*i/64)-2*math.cos(6*math.pi*i/64)-math.cos(8*math.pi*i/64)) for i in range(64)]
    lo=min(z for _,z in raw);hi=max(z for _,z in raw)
    return [(x/32*w,(z-(hi+lo)/2)/(hi-lo)*h) for x,z in raw]

def pixel(w=.18,h=.13):
    return [(x*w/2,z*h/2) for x,z in [(-1,-.55),(-.7,-.55),(-.7,-1),(.65,-1),(.65,-.55),(1,-.55),(1,.55),(.7,.55),(.7,1),(-.7,1),(-.7,.55),(-1,.55)]]

def teardrop(w=.17,h=.157):
    return [(w/2*math.cos(2*math.pi*i/48)*(1+.13*math.sin(2*math.pi*i/48)),h/2*math.sin(2*math.pi*i/48)) for i in range(48)]

def cat(w=.17,h=.12):
    pts=rounded(w,h,.55)
    return [(x,z+max(0,x/w)*.032) for x,z in pts]

def lenses(shape,col='black',lens='clear',r=.006,center=.105,double=False):
    for s in(-1,1):
        coords=[(s*(center+x),Z+z) for x,z in shape]
        tube('Rim'+str(s),[(x,front(x),z) for x,z in coords],col,r,True)
        if lens:
            bm=bmesh.new();vs=[bm.verts.new((x,front(x)+.004,z)) for x,z in coords];bm.faces.new(vs)
            bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
            o=put('Lens'+str(s),bm,L[lens]);m=o.modifiers.new('Lens thickness','SOLIDIFY');m.thickness=.003
    tube('Bridge',[(-.030,front(0),Z+.008),(-.015,front(0)-.006,Z+.016),(.015,front(0)-.006,Z+.016),(.030,front(0),Z+.008)],col,r*.85)
    if double:tube('UpperBridge',[(-.070,front(0),Z+.056),(0,front(0)-.008,Z+.055),(.07,front(0),Z+.056)],col,r*.7)
    temples(col,center+max(x for x,_ in shape),r)

def temples(col,edge,r):
    for s in(-1,1):
        tube('Temple'+str(s),[(s*edge,front(edge),Z+.01),(s*.268,-.235,Z+.015),(s*.308,-.08,Z+.016),(s*.312,.115,Z+.008),(s*.304,.15,Z-.022)],col,max(.004,r*.75))
        bm=ico(.008,1)
        for v in bm.verts:v.co+=Vector((s*(edge+.002),front(edge)-.004,Z+.015))
        put('Hinge'+str(s),bm,M['gold' if col in ('black','brown','navy') else col])

def browline():
    shape=rounded(.172,.121,.55);lenses(shape,'gold','clear',.004)
    for s in(-1,1):tube('HeavyBrow'+str(s),[(s*(.105+x),front(.105+x)-.002,Z+z) for x,z in shape if z>=.025],'black',.011)

def tortoise():
    shape=rounded(.164,.124,.6);lenses(shape,'brown','clear',.010)
    for s in(-1,1):
        for i in (3,8,15,21,29,36,43):
            x,z=shape[i];x=s*(.105+x);bm=ico(.006,1)
            for v in bm.verts:v.co+=Vector((x,front(x)-.009,Z+z))
            put('TortoiseFleck',bm,M['amber'])

def wrap():
    shape=rounded(.40,.137,.45);coords=[(x,Z+z) for x,z in shape]
    tube('VisorRim',[(x,front(x),z) for x,z in coords],'navy',.009,True)
    bm=bmesh.new();vs=[bm.verts.new((x,front(x)+.005,z)) for x,z in coords];bm.faces.new(vs);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    o=put('WrapLens',bm,L['blue']);mod=o.modifiers.new('Visor thickness','SOLIDIFY');mod.thickness=.005
    temples('navy',.20,.009)

def shutter():
    shape=rounded(.176,.132,.4);lenses(shape,'lime',None,.009)
    for s in(-1,1):
        for z in (-.042,-.014,.014,.042):tube('Shutter',[(s*.105-.074,front(s*.105)-.003,Z+z),(s*.105+.074,front(s*.105)-.003,Z+z)],'lime',.006)

def spiral():
    lenses(ellipse(.161,.161),'pink','white',.009)
    for s in(-1,1):
        points=[]
        for i in range(150):
            a=i/149*math.pi*4.6;rr=.004+.057*i/149;x=s*.105+rr*math.cos(a);points.append((x,front(x)-.004,Z+rr*math.sin(a)))
        tube('HypnoSpiral',points,'purple',.0035)

def steam():
    lenses(ellipse(.143,.143),'copper','green',.011,double=True)
    for s in(-1,1):
        for i in range(12):
            a=2*math.pi*i/12;x=s*.105+.082*math.cos(a);z=Z+.082*math.sin(a)
            bm=bm_box(.012,.013,.012)
            for v in bm.verts:v.co+=Vector((x,front(x),z))
            put('GearTooth',bm,M['copper'])
    points=[(.315*math.cos(math.radians(a)),.30*math.sin(math.radians(a)),Z) for a in range(-25,206,5)]
    tube('LeatherStrap',points,'brown',.014)

DEFS=[
('01-round-wire','Round Wire','Fine gold circular frames with transparent lenses.','Regular',lambda:lenses(ellipse(.151,.143),'gold','clear',.0045)),
('02-library-square','Library Square','Rounded black acetate frames, crisp and everyday.','Regular',lambda:lenses(rounded(.174,.125),'black','clear',.009)),
('03-tortoise-club','Tortoise Club','Warm brown frames with actual amber flecks.','Regular',tortoise),
('04-clear-day','Clear Day','Pale champagne frames around barely tinted lenses.','Regular',lambda:lenses(rounded(.172,.130,.62),'clear','clear',.009)),
('05-browline','Browline','Black upper rims and delicate gold lower frames.','Regular',browline),
('06-cherry-cat-eye','Cherry Cat Eye','Upswept cherry-red frames with clear lenses.','Regular',lambda:lenses(cat(),'cherry','clear',.0085)),
('07-tiny-oval','Tiny Oval','Slim purple oval frames for a quieter look.','Regular',lambda:lenses(ellipse(.141,.094),'purple','clear',.006)),
('08-camp-classics','Camp Classics','Chunky black sunglasses with dark square lenses.','Sunglasses',lambda:lenses(rounded(.178,.133,.48),'black','smoke',.011)),
('09-highway-aviator','Highway Aviator','Gold teardrop aviators, blue mirror lenses and a double bridge.','Sunglasses',lambda:lenses(teardrop(),'gold','blue',.0055,double=True)),
('10-amber-sunset','Amber Sunset','Round copper frames with warm amber-tinted lenses.','Sunglasses',lambda:lenses(ellipse(.160,.150),'copper','amber',.007)),
('11-glacier-wrap','Glacier Wrap','A wide blue mirrored shield and navy arms.','Sunglasses',wrap),
('12-neon-runner','Neon Runner','Sporty orange frames and slim dark lenses.','Sunglasses',lambda:lenses(teardrop(.185,.108),'orange','smoke',.008)),
('13-midnight-slit','Midnight Slit','Narrow black shades with a tiny straight bridge.','Sunglasses',lambda:lenses(rounded(.176,.076,.42),'black','smoke',.009)),
('14-white-glam','White Glam','Bold cream-white acetate with rose-tinted lenses.','Sunglasses',lambda:lenses(rounded(.181,.139,.7),'white','rose',.012)),
('15-heartbreaker','Heartbreaker','Hot pink heart frames with violet lenses.','Crazy',lambda:lenses(heart(),'pink','violet',.009,center=.113)),
('16-star-power','Star Power','Gold star-shaped rims and purple-tinted lenses.','Crazy',lambda:lenses(star(),'gold','violet',.008,center=.11)),
('17-pixel-punk','Pixel Punk','Stepped black pixel frames with dark lenses.','Crazy',lambda:lenses(pixel(),'black','smoke',.010,center=.11)),
('18-lime-shutters','Lime Shutters','Loud green shutter shades with open slats.','Crazy',shutter),
('19-hypno-club','Hypno Club','Pink goggles with cream lenses and raised purple spirals.','Crazy',spiral),
('20-brass-goggles','Brass Goggles','Copper gear rims, green lenses and a rear leather strap.','Crazy',steam)
]
manifest=[]
for i,(slug,name,description,group,build)in enumerate(DEFS):
    scene=bpy.context.scene if i==0 else bpy.data.scenes.new('Glasses_'+slug)
    scene.name='Glasses_'+slug;bpy.context.window.scene=scene;use_collection('Glasses_'+slug)
    ROOT=empty('GlassesRoot',None);PRE='Glasses%02d_'%(i+1);PART=0;build();bpy.context.view_layer.update()
    pieces=list(ROOT.children_recursive)
    maxfront=max((o.matrix_world@v.co).z for o in pieces if o.type=='MESH' for v in o.data.vertices if (o.matrix_world@v.co).y<-.23)
    assert maxfront<.489,(slug,'front too tall for the approved hats',maxfront)
    for o in bpy.context.view_layer.objects:o.select_set(False)
    for o in [ROOT]+pieces:o.select_set(True)
    bpy.context.view_layer.objects.active=ROOT
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,slug+'.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_yup=True)
    ref=empty('FitReference',None);h=head('FitReference_',ref);face('FitReference_',ref,h);ref.location.z=-HB
    scene['name']=name;scene['description']=description
    manifest.append(dict(id=i+1,slug=slug,name=name,description=description,group=group,file='../models/glasses/'+slug+'.glb',head='unchanged',cosmeticOnly=True,clearLenses=group=='Regular',frontMaxHeight=round(maxfront,4)))
bpy.context.window.scene=bpy.data.scenes['Glasses_01-round-wire']
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REPO,'art/blender/glasses.blend'),compress=True)
with open(os.path.join(REPO,'public/glasses-lab/manifest.json'),'w')as f:json.dump(manifest,f,indent=2)
print('GLASSES LAB: 20 head-local eyewear sets, 7 regular + 7 sunglasses + 6 crazy; original head unchanged.')
