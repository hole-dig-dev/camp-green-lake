# blend: clothes.blend
# Real garment geometry over JT's existing continuous skins. No edits to camper.glb.
import bpy,bmesh,math,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/models/clothes';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/camper.glb'))
base=bpy.context.scene;base.name='SourceReference'
source=next(o for o in base.objects if o.type=='ARMATURE')
source.animation_data_clear()
for p in source.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
sources={s:base.objects['CGLCamper_'+s] for s in ['Torso','L_Sleeve','R_Sleeve','L_Leg','R_Leg']}
source_hash=hashlib.sha256((ROOT/'public/models/camper.glb').read_bytes()).hexdigest()
PALETTE={'orange':'E8742A','sand':'C7AD7B','olive':'52674E','denim':'476B8A','cream':'F5E5C5','navy':'283B51','red':'AD3E37','sage':'80A28E','black':'343239','yellow':'E9BF43','teal':'347F83','purple':'8965A5','pink':'DD879E','brown':'785447','white':'EEEDE2','mint':'AAD2B5','peach':'E1A17F','coral':'CF6959','plum':'79526F','gold':'DDB454','blue':'547AA0'}
def linear(c):
 vals=[int(c[i:i+2],16)/255 for i in (0,2,4)];return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals)
def mat(k):
 name='Cloth_'+k;m=bpy.data.materials.get(name)
 if m:return m
 m=bpy.data.materials.new(name);m.use_nodes=True;rgb=linear(PALETTE[k]);m.diffuse_color=(*rgb,1)
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.82
 return m
skin=bpy.data.materials['CGL_Skin']
STYLES=[
('camp-classic','Camp Classic','orange','orange','orange','long','long','zip','Familiar orange workwear with a proper zipper, chest badge and utility pockets.'),
('desert-scout','Desert Scout','sand','sand','olive','rolled','short','scout','Sand button shirt, rolled sleeves and forest-green shorts.'),
('denim-day','Denim Day','denim','denim','denim','long','long','denim','Denim jacket with cream inset, chest pockets and turned-up jeans.'),
('red-flannel','Red Flannel','red','red','navy','long','long','plaid','Raised plaid shirt panels, button placket and dark jeans.'),
('college-varsity','College Varsity','navy','cream','navy','long','long','varsity','Navy varsity jacket, cream sleeves, red ribbing and a letter patch.'),
('trail-hoodie','Trail Hoodie','sage','sage','black','long','long','hoodie','Sage hood, drawstrings, kangaroo pocket and black joggers.'),
('rain-patrol','Rain Patrol','yellow','yellow','teal','long','long','rain','Yellow storm coat with folded hood, storm flap and teal trousers.'),
('garage-mechanic','Garage Mechanic','blue','blue','blue','rolled','long','mechanic','Blue coveralls with tool pockets, name tag and reinforced thighs.'),
('prison-stripes','Prison Stripes','cream','cream','cream','long','long','stripes','Graphic black-and-cream stripes across shirt, sleeves and trousers.'),
('sunset-surfer','Sunset Surfer','teal','teal','pink','short','short','sun','Teal sun tee with peach emblem and bright pink shorts.'),
('night-runner','Night Runner','purple','purple','black','long','long','track','Purple track jacket with cream racing stripes and matching side-striped pants.'),
('patchwork-pal','Patchwork Pal','peach','mint','brown','long','long','patchwork','Peach-and-mint sewn panels, contrast sleeves and stitched brown trousers.'),
('lake-sailor','Lake Sailor','cream','cream','navy','short','short','sailor','Breton stripes, a red neckerchief and navy deck shorts.'),
('utility-cargo','Utility Cargo','olive','olive','sand','short','long','cargo','Dark utility vest over an olive tee, with generous cargo pockets.'),
('retro-sport','Retro Sport','coral','coral','cream','short','short','sport','Coral sports jersey, cream arm bands and retro athletic shorts.'),
('diner-cook','Diner Cook','white','white','black','rolled','long','cook','White chef shirt, sage apron and check-patterned trousers.'),
('garden-overalls','Garden Overalls','yellow','yellow','denim','short','long','overalls','Mustard tee under blue bib overalls, shoulder straps and metal buttons.'),
('winter-puffer','Winter Puffer','plum','plum','navy','long','long','puffer','Sculpted plum puffer panels, cream scarf and warm navy trousers.'),
('party-suit','Party Suit','purple','purple','black','long','long','suit','Purple dinner jacket, cream shirt insert, gold bow tie and pinstripe pants.'),
('cosmic-kid','Cosmic Kid','navy','navy','navy','long','long','cosmic','Playful space workwear with teal harness, pink panels and a star badge.')]
manifest=[]
for idx,(slug,name,top,arm,pants,sleeve,length,style,desc) in enumerate(STYLES,1):
 scene=bpy.data.scenes.new('Clothes_%02d_%s'%(idx,slug));bpy.context.window.scene=scene
 rig=source.copy();rig.data=source.data.copy();rig.name='ClothingRig_%02d'%idx;rig.animation_data_clear();scene.collection.objects.link(rig)
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
 objects=[]
 def own(o,slot,bone=None):
  scene.collection.objects.link(o);o['slot']=slot;o['cosmeticOnly']=True;objects.append(o)
  o.parent=rig;o.parent_type='OBJECT';o.matrix_world=Matrix.Identity(4)
  if bone:
   vg=o.vertex_groups.new(name=bone);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
   mod=o.modifiers.new('Existing camper skin','ARMATURE');mod.object=rig
  else:
   for mod in o.modifiers:
    if mod.type=='ARMATURE':mod.object=rig
  return o
 def mesh(tag,verts,faces,col,slot='torso',bone='spine'):
  me=bpy.data.meshes.new(tag);me.from_pydata(verts,[],faces);me.materials.append(mat(col));me.update()
  return own(bpy.data.objects.new('Garment_%02d_%s_%s'%(idx,slot,tag),me),slot,bone)
 def box(tag,pos,size,col,slot='torso',bone='spine',bevel=.008):
  bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
  for v in bm.verts:v.co=Vector(pos)+Vector((v.co.x*size[0],v.co.y*size[1],v.co.z*size[2]))
  if bevel:bmesh.ops.bevel(bm,geom=list(bm.edges),offset=bevel,segments=2,affect='EDGES')
  bmesh.ops.recalc_face_normals(bm,faces=bm.faces);me=bpy.data.meshes.new(tag);bm.to_mesh(me);bm.free();me.materials.append(mat(col))
  return own(bpy.data.objects.new('Garment_%02d_%s_%s'%(idx,slot,tag),me),slot,bone)
 def patch(tag,x,z,w,h,col):return box(tag,(x,-.235,z),(w,.028,h),col)
 def button(x,z,col='gold'):return box('Button',(x,-.267,z),(.027,.016,.027),col,bevel=.012)
 def collar(col):
  for s in [-1,1]:mesh('Collar',[(s*.025,-.224,1.91),(s*.185,-.20,1.91),(s*.10,-.25,1.76)],[(0,1,2)],col)
 def pocket(x,z,col,w=.14,h=.17):
  patch('Pocket',x,z,w,h,col);patch('PocketFlap',x,z+h/2,w+.01,.034,'cream' if style=='cargo' else col)
 def zipper(col='cream'):patch('Zip',0,1.40,.023,.72,col)
 def hood(col):
  # Folded hood behind the neck, below the head, with a real rounded rim.
  for j in range(12):
   a=math.pi*j/11;box('HoodFold',(.205*math.cos(a),.08+.125*math.sin(a),1.985),(.095,.072,.135),col)
 def stripe_torso(col,gap=.14):
  for z in [1.09+i*gap for i in range(int(.70/gap)+1)]:
   patch('BretonStripe',0,z,.58,.038,col);box('BackStripe',(0,.220,z),(.58,.022,.038),col)
 for short,src in sources.items():
  slot='torso' if short=='Torso' else 'arms' if 'Sleeve' in short else 'legs'
  o=src.copy();o.data=src.data.copy();o.name='Garment_%02d_%s_%s'%(idx,slot,short);o.data.name=o.name;o['surface']=short
  if slot=='torso':
   mw=src.matrix_world.copy()
   for v in o.data.vertices:v.co=mw@v.co
   o.modifiers.clear();o.vertex_groups.clear();own(o,slot,'spine')
  else:own(o,slot)
  o.data.materials.clear();o.data.materials.append(mat(top if slot=='torso' else arm if slot=='arms' else pants));o.data.materials.append(skin)
  accent={'stripes':'black','plaid':'navy','varsity':'red','rain':'yellow','hoodie':'sage','sailor':'red','sport':'coral','overalls':'navy','puffer':'plum','cosmic':'teal','mechanic':'denim'}.get(style,'cream')
  o.data.materials.append(mat(accent))
  if slot!='torso':
   for p in o.data.polygons:
    c=sum((o.data.vertices[v].co for v in p.vertices),Vector())/len(p.vertices)
    if slot=='arms':
     d=(1.78-c.z)/math.cos(math.radians(12))
     end=.20 if sleeve=='short' else .39 if sleeve=='rolled' else .69
     if d>end:p.material_index=1
     elif style in ['stripes','plaid'] and int(d/.065)%2:p.material_index=2
     elif style in ['varsity','sport','track'] and (d>.63 or .12<d<.17):p.material_index=2
     elif style in ['scout','denim','mechanic','cook'] and d>end-.055:p.material_index=2
     elif style=='rain' and .45<d<.50:p.material_index=2
    else:
     if length=='short' and c.z<.64:p.material_index=1
     elif style=='stripes' and int(c.z/.075)%2:p.material_index=2
     elif style=='cook' and (int(c.z/.10)+int((c.x+.4)/.075))%2:p.material_index=2
     elif style in ['track','cosmic','patchwork'] and abs(c.x)>.215:p.material_index=2
     elif style=='denim' and c.z<.22:p.material_index=2
     elif style=='varsity' and (c.z<.23 or abs(c.x)>.22):p.material_index=2
     elif style=='rain' and .25<c.z<.32:p.material_index=2
     elif style=='hoodie' and c.z<.20:p.material_index=2
     elif style in ['sun','sailor','sport'] and .64<c.z<.71:p.material_index=2
     elif style=='overalls' and .55<c.z<.69 and c.y<-.025:p.material_index=2
     elif style=='puffer' and (c.z<.21 or abs(c.x)>.215):p.material_index=2
     elif style=='mechanic' and .55<c.z<.68 and c.y<-.025:p.material_index=2
   # Widen cloth slightly at forearms or trouser thighs, preserving imported weights/topology.
   if slot=='legs' and style in ['cargo','overalls','mechanic','puffer']:
    for v in o.data.vertices:
     side=-1 if v.co.x<0 else 1;v.co.x=side*.15+(v.co.x-side*.15)*1.07
   if slot=='arms' and style in ['hoodie','puffer','rain']:
    for v in o.data.vertices:v.co.y*=1.08
 if style=='zip':
  zipper('black');patch('CampBadge',.17,1.67,.14,.10,'cream');pocket(-.17,1.25,'orange')
 elif style in ['scout','denim','mechanic']:
  collar(top);zipper('cream' if style=='denim' else top)
  for x in [-.17,.17]:pocket(x,1.58,top)
  for z in [1.13,1.35,1.56,1.77]:button(0,z)
  if style=='denim':patch('TeeInsert',0,1.78,.13,.17,'cream')
  if style=='mechanic':patch('NameTag',-.17,1.73,.16,.045,'cream')
 elif style=='plaid':
  collar('red');stripe_torso('navy',.13)
  for x in [-.22,-.11,0,.11,.22]:patch('PlaidWarp',x,1.40,.025,.70,'navy')
  zipper('red')
  for z in [1.12,1.35,1.56,1.78]:button(0,z,'cream')
 elif style=='varsity':
  patch('RibHem',0,1.03,.53,.065,'red');zipper();collar('red');patch('LetterBacking',-.17,1.61,.15,.18,'red')
  patch('LetterStem',-.21,1.61,.026,.12,'cream');patch('LetterFoot',-.17,1.56,.10,.025,'cream')
  for x in [-.17,.17]:pocket(x,1.25,'navy',.11,.045)
 elif style=='hoodie':
  hood('sage');patch('KangarooPocket',0,1.23,.39,.21,'olive');patch('PocketLip',0,1.33,.39,.03,'sage')
  for x in [-.085,.085]:patch('Drawstring',x,1.69,.015,.27,'cream')
 elif style=='rain':
  hood('yellow');patch('StormFlap',.015,1.41,.06,.76,'gold')
  for z in [1.12,1.35,1.56,1.78]:button(.015,z,'navy')
  for x in [-.17,.17]:pocket(x,1.23,'yellow')
 elif style=='stripes':stripe_torso('black',.15);patch('NumberBadge',-.16,1.67,.17,.10,'white')
 elif style=='sun':
  # Extruded faceted sun emblem and physical rays.
  verts=[(.072*math.cos(i*math.tau/12),-.248,1.56+.072*math.sin(i*math.tau/12)) for i in range(12)]
  mesh('SunDisk',verts,[tuple(range(12))],'peach')
  for i in range(8):
   a=i*math.tau/8;patch('SunRay',.112*math.cos(a),1.56+.112*math.sin(a),.026,.035,'gold')
 elif style=='track':
  zipper();collar('purple')
  for x in [-.255,.255]:patch('RaceStripe',x,1.42,.037,.63,'cream')
  for x in [-.17,.17]:pocket(x,1.20,'purple',.12,.05)
 elif style=='patchwork':
  patch('MintPanel',-.16,1.55,.26,.43,'mint');patch('CreamPanel',.15,1.28,.25,.34,'cream');patch('NavyPocket',.15,1.69,.13,.17,'navy')
  for z in [1.16+i*.08 for i in range(8)]:patch('Stitch',-.01,z,.024,.008,'brown')
 elif style=='sailor':
  stripe_torso('navy',.13)
  for s in [-1,1]:mesh('Neckerchief',[(s*.15,-.24,1.90),(0,-.28,1.68),(s*.055,-.28,1.69)],[(0,1,2)],'red')
  button(0,1.72,'red')
 elif style=='cargo':
  for x in [-.18,.18]:patch('VestPanel',x,1.44,.29,.77,'black')
  for x in [-.18,.18]:pocket(x,1.53,'olive');pocket(x,1.21,'black')
  zipper('gold')
 elif style=='sport':
  patch('ChestBand',0,1.61,.59,.12,'cream');patch('NumberStem',-.027,1.36,.045,.18,'navy');patch('NumberTop',.02,1.43,.13,.035,'navy')
 elif style=='cook':
  collar('white');patch('Apron',0,1.28,.46,.43,'sage');patch('ApronBib',0,1.61,.31,.32,'sage')
  for x in [-.115,.115]:patch('ApronStrap',x,1.81,.035,.15,'sage')
  pocket(0,1.27,'olive',.25,.12)
 elif style=='overalls':
  patch('Bib',0,1.47,.40,.47,'denim');patch('OverallsWaist',0,1.07,.52,.12,'denim')
  for x in [-.14,.14]:patch('ShoulderStrap',x,1.79,.065,.26,'denim');button(x,1.69)
  pocket(0,1.48,'blue',.22,.15);box('BackBib',(0,.228,1.49),(.4,.027,.46),'denim')
 elif style=='puffer':
  for z in [1.10+i*.155 for i in range(5)]:
   for x in [-.15,.15]:patch('PufferBaffle',x,z,.27,.13,'plum');box('BackBaffle',(x,.245,z),(.27,.08,.13),'plum',bevel=.035)
  zipper('black');box('ScarfWrap',(0,-.035,1.96),(.34,.39,.13),'cream',bevel=.035);patch('ScarfTail',.16,1.72,.11,.33,'cream')
 elif style=='suit':
  patch('ShirtInset',0,1.65,.23,.48,'cream')
  for s in [-1,1]:mesh('Lapel',[(s*.23,-.246,1.91),(s*.05,-.265,1.47),(s*.035,-.265,1.77)],[(0,1,2)],'navy');patch('BowWing',s*.055,1.85,.09,.06,'gold')
  zipper('purple');button(0,1.35);pocket(.18,1.60,'cream',.12,.035)
 elif style=='cosmic':
  for x in [-.18,.18]:patch('Harness',x,1.48,.048,.79,'teal')
  patch('HarnessBelt',0,1.09,.53,.06,'teal');patch('ChestPanel',0,1.52,.23,.26,'blue')
  for x in [-.23,.23]:patch('ShoulderPad',x,1.81,.14,.12,'pink')
  pts=[]
  for i in range(10):
   a=math.pi/2+i*math.pi/5;r=.065 if i%2==0 else .029;pts.append((r*math.cos(a),-.27,1.58+r*math.sin(a)))
  mesh('StarBadge',pts,[tuple(range(10))],'gold')
 # Raised side pockets and seams are weighted to their existing thigh bones, away from the knee.
 if style in ['scout','cargo','mechanic','overalls','patchwork']:
  for s,sd in [(-1,'L'),(1,'R')]:
   box('CargoPocket',(s*.253,-.055,.78),(.07,.17,.17),pants,'legs','leg.'+sd)
 if style in ['zip','plaid','suit','track']:
  for s,sd in [(-1,'L'),(1,'R')]:
   box('UpperSideSeam',(s*.26,-.012,.80),(.014,.024,.28),'red' if style=='plaid' else 'black' if style=='zip' else 'cream','legs','leg.'+sd)
 if style in ['varsity','cosmic']:
  for s,sd in [(-1,'L'),(1,'R')]:box('SleeveBadge',(s*.424,-.112,1.65),(.065,.025,.064),'red' if style=='varsity' else 'pink','arms','arm.'+sd)
 bpy.context.view_layer.update()
 bpy.ops.object.select_all(action='DESELECT')
 for o in [rig]+objects:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 filename='%02d-%s.glb'%(idx,slug)
 bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_extras=True,export_skins=True,export_apply=False)
 manifest.append(dict(id=idx,slug='%02d-%s'%(idx,slug),name=name,description=desc,file='../models/clothes/'+filename,slots=['torso','arms','legs'],head='unchanged',continuousSkinning=True,sourceCamperSHA256=source_hash,cosmeticOnly=True))
 # Native fit reference is linked after export, never included in wardrobe GLBs.
 ref=bpy.data.collections.new('FitReference_%02d'%idx);scene.collection.children.link(ref)
 for o in base.objects:
  if o.name.startswith('CGLCamper_') and o not in sources.values() and o.type=='MESH' and not any(k in o.name for k in ['Shovel','Hair','Bucket','Cowboy','DesertCap','Shades','Patch','Zipper']):ref.objects.link(o)
 ref.objects.link(source)
 print('CLOTHES',idx,name,len(objects))
(ROOT/'public/clothes-lab').mkdir(exist_ok=True)
(ROOT/'public/clothes-lab/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
bpy.context.window.scene=bpy.data.scenes['Clothes_01_camp-classic']
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/clothes.blend'),compress=True)
print('CLOTHES LAB: 20 modular outfits; original continuous sleeves/trousers and weight assignments preserved.')
