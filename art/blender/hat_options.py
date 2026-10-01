# blend: hats.blend
# Twenty original hat candidates for JT's approved camper. Build with Blender --background --python this_file.
import bpy, bmesh, math, os, json
from mathutils import Vector
REPO=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
exec(compile(open(os.path.join(REPO,'blender/cgl_helpers.py')).read(),'cgl_helpers.py','exec'))
OUT=os.path.join(REPO,'public/models/hats');os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for s in list(bpy.data.scenes):
    if s!=bpy.context.scene:bpy.data.scenes.remove(s)
COLORS={'sand':'#D4BB8E','cream':'#EFE1BA','olive':'#68754B','forest':'#344F42','navy':'#34465E','blue':'#55768C',
        'rust':'#B5623B','brown':'#704A31','leather':'#A8794E','gold':'#D9AF56','orange':'#DE863C','mustard':'#C6A043',
        'wine':'#834653','coal':'#414548','red':'#B35B4B','white':'#E8E6D9','black':'#272A2B','fur':'#CAB69B','glass':'#56777B'}
M={k:mat('HatLab_'+k,v,.88 if k!='glass' else .3) for k,v in COLORS.items()}
ROOT=None;PREFIX='';PART=0

def obj(label,bm,col,loc=(0,0,0),scale=None):
    global PART
    PART+=1;o=mk(PREFIX+label+str(PART),bm,M[col],ROOT,loc)
    if scale:o.scale=scale
    return o

def crown(col='sand',h=.80,rb=.30,rt=.285,shape='flat',lean=0):
    if shape=='dome':pts=[(rb,.505),(rb*1.01,.57),(rb*.96,.65),(rb*.82,.73),(rb*.52,h-.02),(0,h)]
    elif shape=='pinch':pts=[(rb,.505),(rb*.98,.60),(rt,.78),(rt*.88,h),(rt*.58,h+.012),(rt*.25,h-.035),(0,h-.045)]
    else:pts=[(rb,.505),(rb*1.01,.55),(rt,h-.025),(rt*.92,h),(0,h)]
    bm=lathe(pts,seg=40,sy=.93)
    for v in bm.verts:
        v.co.x+=lean*max(0,v.co.z-.54)/max(.05,h-.54)
    return obj('Crown',bm,col)

def band(col='brown',r=.308,z=.55,w=.045):
    return obj('Band',lathe([(r,z-w/2),(r,z+w/2),(r-.012,z+w/2),(r-.012,z-w/2),(r,z-w/2)],seg=48,sy=.93),col)

def brim(col='sand',r=.44,z=.54,drop=.018,curl=0,ellipse=1):
    bm=lathe([(.282,z),(.34,z-.004),(r,z-drop),(r,z-drop-.024),(.34,z-.028),(.282,z-.024),(.282,z)],seg=48,sy=.93*ellipse)
    for v in bm.verts:
        if curl:v.co.z+=curl*max(0,abs(v.co.x)-.31)**2
    return obj('Brim',bm,col)

def tor(col='gold',r=.30,z=.56,t=.008,sy=.93):return obj('Piping',torus(r,t,seg=48,rseg=8),col,(0,0,z),(1,sy,1))

def boxpart(col,loc,size,bev=.012,label='Detail'):
    o=obj(label,bm_box(*size),col,loc);bevel(o,bev,3);return o

def ball(col,loc,scale):return obj('RoundDetail',ico(1,2 if max(scale)>.035 else 1),col,loc,scale)

def bill(col='navy',length=.22,z=.525):
    # A separate solid curved visor; its lowest point is comfortably above the brow.
    bm=bmesh.new();rings=[]
    for zz in (z,z+.025):
        ring=[]
        for i in range(33):
            a=2*math.pi*i/32
            x=.265*math.cos(a);y=-.29+length*.62*math.sin(a)
            ring.append(bm.verts.new((x,y,zz+.05*(x/.265)**2)))
        rings.append(ring[:-1])
    for i in range(32):j=(i+1)%32;bm.faces.new((rings[0][i],rings[0][j],rings[1][j],rings[1][i]))
    bm.faces.new(rings[0][::-1]);bm.faces.new(rings[1]);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    return obj('Visor',bm,col)

def seam(col='cream',theta=0):
    a=math.radians(theta)
    for i in range(9):
        t=i/10;z=.565+t*.22;rr=.306*math.sqrt(max(.08,1-(t*.85)**2))
        ball(col,(rr*math.sin(a),-rr*.93*math.cos(a),z),(.004,.004,.008))

def badge(col='gold',z=.635,shape='shield'):
    o=boxpart(col,(0,-.290,z),(.075,.022,.08),.015,'Badge')
    if shape=='shield':o.rotation_euler.y=math.radians(45);o.scale.x=.85
    boxpart('cream',(0,-.305,z),(.024,.008,.034),.005,'BadgeMark')

def vents(col='brown',z=.635):
    for s in (-1,1):
        for y in (-.08,.045):ball(col,(s*.302,y,z),(.006,.016,.010))

def flap(col='sand',side=False):
    if side:
        for s in(-1,1):
            o=boxpart(col,(s*.288,.065,.38),(.065,.24,.27),.04,'EarFlap');o.rotation_euler.y=s*math.radians(-10)
        return
    bm=bmesh.new();rows=[]
    for z,rr in ((.565,.296),(.49,.31),(.34,.328)):
        rows.append([bm.verts.new((rr*math.cos(math.radians(a)),rr*.94*math.sin(math.radians(a)),z)) for a in range(12,169,6)])
    for row,nextrow in zip(rows,rows[1:]):
        for i in range(len(row)-1):bm.faces.new((row[i],row[i+1],nextrow[i+1],nextrow[i]))
    o=obj('NeckFlap',bm,col);m=o.modifiers.new('Fabric thickness','SOLIDIFY');m.thickness=.022

def weave(col='cream'):
    for z in (.60,.63,.66,.69,.72,.75):tor(col,.306-(z-.6)*.07,z,.0035)

def ribbed(col,z0=.58,z1=.81,r=.30,lean=0,h=.90):
    # Continuous raised knit ribs follow the shell instead of dotted studs.
    profile_pts=[(r,.505),(r*1.01,.57),(r*.96,.65),(r*.82,.73),(r*.52,h-.02),(0,h)]
    for angle in range(0,360,20):
        a=math.radians(angle);centers=[]
        for i in range(17):
            z=z0+(z1-z0)*i/16;rr=0
            for (ra,za),(rb,zb) in zip(profile_pts,profile_pts[1:]):
                if za<=z<=zb:rr=ra+(rb-ra)*(z-za)/(zb-za);break
            centers.append(Vector((rr*math.cos(a)+lean*max(0,z-.54)/(h-.54),rr*.93*math.sin(a),z)))
        bm=bmesh.new();rings=[]
        for i,c in enumerate(centers):
            t=(centers[min(i+1,len(centers)-1)]-centers[max(i-1,0)]).normalized()
            u=t.cross(Vector((0,0,1)))
            if u.length<.01:u=t.cross(Vector((1,0,0)))
            u.normalize();v=t.cross(u).normalized()
            rings.append([bm.verts.new(c+.0045*(math.cos(k*math.pi/3)*u+math.sin(k*math.pi/3)*v)) for k in range(6)])
        for left,right in zip(rings,rings[1:]):
            for k in range(6):bm.faces.new((left[k],left[(k+1)%6],right[(k+1)%6],right[k]))
        bm.faces.new(rings[0][::-1]);bm.faces.new(rings[-1]);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        obj('KnitRib',bm,col)

def beret():
    bm=lathe([(.29,.512),(.335,.545),(.38,.60),(.38,.655),(.345,.72),(.26,.765),(0,.782)],seg=40,sy=.90)
    for v in bm.verts:v.co.x+=.085*max(0,v.co.z-.53)/.252
    obj('WoolCrown',bm,'red');band('brown',.307,.532,.033)
    ball('red',(.085,0,.795),(.012,.012,.028));badge('gold',.575)


def ridge(col='gold',z=.79):
    o=boxpart(col,(0,0,z),(.06,.40,.055),.025,'TopRidge')
    for s in(-1,1):o=boxpart(col,(s*.17,0,z-.035),(.035,.33,.035),.015,'ShellRib')

def goggles():
    for s in(-1,1):
        o=obj('GoggleFrame',torus(.056,.014,seg=28,rseg=8),'gold',(s*.078,-.279,.66));o.rotation_euler.x=math.pi/2
        ball('glass',(s*.078,-.284,.66),(.047,.011,.047))
    boxpart('leather',(0,-.284,.66),(.038,.022,.026),.01,'GoggleBridge')
    band('brown',.315,.66,.028)

DEFS=[
('01-sunbreak-bucket','Sunbreak Bucket','Canvas bucket with a proper crown and a thick, gently flared brim.','Everyday',lambda:(crown('sand',.79),brim('sand',.415,drop=.025),band('olive'),tor('cream',.30,.74),vents())),
('02-trail-boonie','Trail Boonie','Low olive field hat, broad soft brim, brass eyelets and a cord band.','Everyday',lambda:(crown('olive',.765),brim('olive',.47,drop=.022,curl=1),band('brown',w=.026),vents('gold'),tor('sand',.31,.57,.006))),
('03-blue-hour-cap','Blue Hour Cap','Faded blue baseball cap with an elevated curved visor and cream stitching.','Everyday',lambda:(crown('blue',.82,shape='dome'),bill('blue'),band('blue',w=.028),seam(theta=0),seam(theta=50),seam(theta=-50),badge('cream',.64))),
('04-dust-road-trucker','Dust Road Trucker','Rust visor and front, cream crown, chunky contrasting trim.','Everyday',lambda:(crown('cream',.80,shape='dome'),bill('rust'),band('rust',w=.036),boxpart('rust',(0,-.269,.65),(.21,.028,.14),.03,'FrontPanel'),badge('sand',.65),seam('brown',110),seam('brown',-110))),
('05-switchback-five-panel','Switchback Five Panel','Compact sage cap with a flat visor and raised front patch.','Everyday',lambda:(crown('olive',.755,rb=.307,rt=.255),bill('olive',.21),band('forest',w=.025),boxpart('sand',(0,-.289,.65),(.135,.027,.071),.012,'Patch'),seam('sand',70),seam('sand',-70))),
('06-pine-ranger','Pine Ranger','Tall forest crown, crisp brim and a warm brass diamond badge.','Trail',lambda:(crown('forest',.925,rt=.265,shape='pinch'),brim('forest',.475,drop=.003),band('brown',w=.055),badge('gold',.675))),
('07-dry-creek-cowboy','Dry Creek Cowboy','Sculpted leather-brown crown and visibly rolled western brim.','Trail',lambda:(crown('brown',.92,rt=.274,shape='pinch'),brim('brown',.525,curl=2.8,ellipse=.94),band('leather',w=.054),tor('gold',.31,.577,.006),badge('gold',.62))),
('08-high-noon-straw','High Noon Straw','Pale woven western hat with a dark band and warm raised edges.','Trail',lambda:(crown('sand',.88,rt=.28,shape='pinch'),brim('cream',.535,curl=2.1),band('brown',w=.056),weave(),tor('gold',.535,.525,.006))),
('09-dune-pith','Dune Pith','Domed cream expedition helmet with a separate brim and crown ridge.','Trail',lambda:(crown('cream',.87,rb=.314,shape='dome'),brim('sand',.43,drop=.018),band('sand',r=.324,w=.028),ridge('sand',.855),vents('brown',.61))),
('10-neck-shade-cap','Neck Shade Cap','Stone canvas cap with a high visor and an actual draped neck flap.','Trail',lambda:(crown('sand',.81,shape='dome'),bill('sand',.22),flap('sand'),band('olive',w=.029),vents('brown'))),
('11-shift-hardhat','Shift Hardhat','Rounded safety-orange shell with ribs, thick rim and a work badge.','Work',lambda:(crown('orange',.845,rb=.322,shape='dome'),brim('orange',.372,drop=0),ridge('gold',.83),band('orange',r=.331,w=.031),badge('cream',.63))),
('12-night-shift-miner','Night Shift Miner','Blue work helmet with a real metal lamp housing above the eyes.','Work',lambda:(crown('blue',.85,rb=.322,shape='dome'),brim('blue',.38,drop=0),ridge('navy',.835),boxpart('coal',(0,-.315,.685),(.145,.082,.14),.025,'LampHousing'),ball('cream',(0,-.363,.685),(.055,.012,.055)),vents('gold',.61))),
('13-golden-hour-knit','Golden Hour Knit','Mustard beanie with a thick folded cuff and raised knit ribs.','Cold',lambda:(crown('mustard',.90,rb=.31,shape='dome'),band('gold',.322,.57,.105),ribbed('gold',.64,.885,.31,h=.90),ball('mustard',(0,0,.903),(.047,.047,.041)))),
('14-campfire-slouch','Campfire Slouch','Soft berry knit with a folded cuff and a relaxed sideways crown.','Cold',lambda:(crown('wine',.98,rb=.31,rt=.19,shape='dome',lean=.14),band('wine',.325,.56,.093),ribbed('red',.64,.965,.31,.14,h=.98))),
('15-harbor-docker','Harbor Docker','Short charcoal watch cap with a substantial cuff and a tiny stitched label.','Cold',lambda:(crown('coal',.775,rb=.312,shape='dome'),band('navy',.326,.57,.097),ribbed('navy',.635,.755,.312,h=.775),boxpart('cream',(.17,-.252,.57),(.047,.02,.038),.007,'Label'))),
('16-embers-beret','Embers Beret','Asymmetric rust-red wool crown over a narrow dark leather band.','Character',beret),
('17-frostline-trapper','Frostline Trapper','Deep forest cap, upturned fur front and side ear flaps with a clear face.','Cold',lambda:(crown('forest',.85,rb=.31,shape='dome'),flap('forest',True),boxpart('fur',(0,-.274,.615),(.43,.075,.13),.043,'FoldedFurBrim'),band('fur',.32,.55,.045))),
('18-sky-road-aviator','Sky Road Aviator','Leather flight cap with raised goggles and side protection.','Character',lambda:(crown('leather',.80,rb=.306,shape='dome'),flap('brown',True),band('brown',.319,.55,.033),goggles(),seam('cream',55),seam('cream',-55))),
('19-storm-slicker','Storm Slicker','Navy waxed rain hat with a broad rolled brim and bright lining.','Weather',lambda:(crown('navy',.80,rb=.31,rt=.285),brim('gold',.473,z=.53,drop=.019,curl=1.0),brim('navy',.477,z=.554,drop=.019,curl=1.0),band('blue',.32,.565,.04),tor('gold',.29,.77,.005))),
('20-lake-captain','Lake Captain','Cream skipper cap, navy visor, gold rope trim and a raised front badge.','Character',lambda:(crown('cream',.785,rb=.318,rt=.342),band('navy',.333,.55,.065),bill('navy',.20),tor('gold',.338,.584,.009),badge('gold',.66)))
]
manifest=[]
for i,(slug,name,desc,group,build) in enumerate(DEFS):
    scene=bpy.context.scene if i==0 else bpy.data.scenes.new('Hat_'+slug)
    scene.name='Hat_'+slug;bpy.context.window.scene=scene
    use_collection('Hat_'+slug)
    ROOT=empty('HatRoot',None);ROOT['attachment']='head';ROOT['eye_line']=.392;PREFIX=f'Hat{i+1:02}_';PART=0
    build();bpy.context.view_layer.update()
    # Hat-only selection. Export in head-local metres, Z-up Blender -> Y-up glTF.
    for o in bpy.context.view_layer.objects:o.select_set(False)
    pieces=list(ROOT.children_recursive)
    for o in pieces+[ROOT]:o.select_set(True)
    bpy.context.view_layer.objects.active=ROOT
    # Validate physical clearance at the front where the eyes are; flaps are restricted to sides/back.
    lowest=10
    for o in pieces:
        if o.type!='MESH':continue
        for v in o.data.vertices:
            p=o.matrix_world@v.co
            if abs(p.x)<.19 and p.y<-.12:lowest=min(lowest,p.z)
    assert lowest>.465,(slug,'front too low',lowest)
    path=os.path.join(OUT,slug+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_yup=True)
    manifest.append(dict(id=i+1,slug=slug,name=name,description=desc,group=group,file='../models/hats/'+slug+'.glb',frontMinHeight=round(lowest,4),eyeLine=.392))
    # Native preview uses the exact authored head and face, separate from the exported hat selection.
    reference=camper('FitReference',0,'Original',None)
    for o in list(reference.children_recursive):
        if o.type=='MESH' and not any(k in o.name for k in ('Head','Eye','Mouth','Nose','Brow','Teeth')):o.hide_set(True)
    # Camper helper lifts the root by .87; bring the head bottom to the hat's attachment origin.
    reference.location.z=-HB
    scene['hat_name']=name;scene['description']=desc
bpy.context.window.scene=bpy.data.scenes['Hat_01-sunbreak-bucket']
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(REPO,'art/blender/hats.blend'),compress=True)
with open(os.path.join(REPO,'public/hat-lab/manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
print('HAT LAB: built and exported',len(manifest),'original hats; all front edges clear the eyes by > .073 m.')
