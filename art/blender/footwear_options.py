# blend: footwear.blend
# Twenty original pairs. Native world-space geometry, weighted to existing shin bones.
import bpy,bmesh,math,json,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/models/footwear';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/camper.glb'))
base=bpy.context.scene;base.name='SourceReference';source=next(o for o in base.objects if o.type=='ARMATURE');source.animation_data_clear()
for p in source.pose.bones:p.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
COLORS={'cream':'F3E8CE','white':'E8E7DE','navy':'293F58','coral':'D77765','red':'A8473D','black':'303036','teal':'398D8C','sage':'8A9D75','gold':'D6AD61','blue':'688CBA','brown':'7D5137','tan':'BA8A58','purple':'876CBA','pink':'D98AAE','yellow':'E9C549','plum':'785777','gray':'B1B8B7','orange':'DD8644','silver':'B9C2C3','rubber':'514846'}
def mat(k):
 m=bpy.data.materials.get('Footwear_'+k)
 if m:return m
 c=COLORS[k];rgb=[int(c[i:i+2],16)/255 for i in [0,2,4]];rgb=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)
 m=bpy.data.materials.new('Footwear_'+k);m.use_nodes=True;m.diffuse_color=(*rgb,1);bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.7
 if k in ['gold','silver']:bs.inputs['Metallic'].default_value=.55;bs.inputs['Roughness'].default_value=.35
 return m
STYLES=[
('camp-canvas','Camp Canvas','Shoes','cream','rubber',.19,'canvas','Cream canvas lace-ups with a dark sole stripe and rounded rubber toe.'),
('court-low','Court Low','Shoes','navy','white',.20,'court','Navy court shoes with white toe panels and heel tabs.'),
('sunset-runner','Sunset Runner','Shoes','coral','cream',.22,'runner','Coral runners with sculpted chunky soles and navy support panels.'),
('skate-brick','Skate Brick','Shoes','red','white',.20,'skate','Broad red skate shoes with black tongues and a white foxing stripe.'),
('retro-high-top','Retro High Top','Shoes','teal','cream',.29,'high','Teal high-tops with cream ankle bands and raised lace rows.'),
('trail-sprint','Trail Sprint','Shoes','sage','rubber',.23,'trail','Sage trail runners, gold toe guards and real outsole lugs.'),
('slipstream','Slipstream','Shoes','blue','cream',.19,'slip','Blue slip-ons with a cream vamp strap and elastic side insets.'),
('penny-loafer','Penny Loafer','Shoes','brown','rubber',.19,'loafer','Brown loafers with a penny strap, stitched apron and separate heel.'),
('sunday-oxford','Sunday Oxford','Shoes','black','brown',.20,'oxford','Black dress shoes with gold eyelets and a brown welt.'),
('cosmic-sneaker','Cosmic Sneaker','Shoes','purple','pink',.24,'cosmic','Purple sneakers with pink midsoles and a raised gold star.'),
('quarry-workboot','Quarry Workboot','Boots','tan','rubber',.33,'work','Tan work boots with reinforced toe caps, padded collars and lug soles.'),
('timber-hiker','Timber Hiker','Boots','brown','rubber',.34,'hiker','Brown hiking boots with orange laces, metal hooks and deep tread.'),
('storm-gumboot','Storm Gumboot','Boots','yellow','black',.46,'gum','Tall yellow rain boots with black rims, toe bumpers and heel blocks.'),
('lake-wader','Lake Wader','Boots','teal','cream',.46,'wader','Tall teal waterproof boots with cream safety bands and side handles.'),
('dusty-cowboy','Dusty Cowboy','Boots','brown','tan',.41,'cowboy','Tapered Western toes, flared shafts, pull loops and cream chevron stitching.'),
('night-chelsea','Night Chelsea','Boots','black','plum',.31,'chelsea','Black Chelsea boots with plum elastic panels and pull tabs.'),
('frost-boot','Frost Boot','Boots','white','plum',.39,'frost','White winter boots with plush cream cuffs and plum wrap straps.'),
('buckle-biker','Buckle Biker','Boots','black','rubber',.38,'biker','Black biker boots with two wrap straps and actual silver buckles.'),
('moon-ranger','Moon Ranger','Boots','gray','teal',.41,'moon','Gray space boots with teal bands, molded front plates and segmented soles.'),
('festival-boot','Festival Boot','Boots','pink','purple',.37,'festival','Pink lace-up boots with yellow laces and violet heart patches.')]
manifest=[]
for idx,(slug,name,group,upper,sole,height,style,desc) in enumerate(STYLES,1):
 scene=bpy.data.scenes.new('Footwear_%02d_%s'%(idx,slug));bpy.context.window.scene=scene
 rig=source.copy();rig.data=source.data.copy();rig.name='FootwearRig_%02d'%idx;rig.animation_data_clear();scene.collection.objects.link(rig)
 for p in rig.pose.bones:p.matrix_basis=Matrix.Identity(4)
 objects=[]
 def own(tag,me,col,side):
  me.materials.append(mat(col));o=bpy.data.objects.new('Footwear_%02d_%s_%s'%(idx,side,tag),me);scene.collection.objects.link(o);o.parent=rig;o['slot']='footwear';o['side']=side;o['cosmeticOnly']=True
  g=o.vertex_groups.new(name='shin.'+side);g.add(list(range(len(me.vertices))),1,'REPLACE');mod=o.modifiers.new('Existing shin bone','ARMATURE');mod.object=rig;objects.append(o);return o
 def box(tag,pos,size,col,side,bev=.012,slope=False):
  bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
  for v in bm.verts:
   v.co=Vector(pos)+Vector((v.co.x*size[0],v.co.y*size[1],v.co.z*size[2]))
   if slope and v.co.z>pos[2] and v.co.y<pos[1]:v.co.z-=.04
  if bev:bmesh.ops.bevel(bm,geom=list(bm.edges),offset=bev,segments=3,affect='EDGES')
  bmesh.ops.recalc_face_normals(bm,faces=bm.faces);me=bpy.data.meshes.new(tag);bm.to_mesh(me);bm.free();return own(tag,me,col,side)
 def tube(tag,points,r,col,side,closed=False):
  points=[Vector(p) for p in points];bm=bmesh.new();rings=[]
  for i,p in enumerate(points):
   tangent=(points[(i+1)%len(points)]-points[(i-1)%len(points)] if closed else points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized();u=tangent.cross(Vector((0,0,1)))
   if u.length<.01:u=tangent.cross(Vector((0,1,0)))
   u.normalize();v=tangent.cross(u).normalized();rings.append([bm.verts.new(p+r*(math.cos(j*math.tau/8)*u+math.sin(j*math.tau/8)*v)) for j in range(8)])
  for i in range(len(points) if closed else len(points)-1):
   a,b=rings[i],rings[(i+1)%len(points)]
   for j in range(8):bm.faces.new((a[j],a[(j+1)%8],b[(j+1)%8],b[j]))
  if not closed:bm.faces.new(rings[0][::-1]);bm.faces.new(rings[-1])
  bmesh.ops.recalc_face_normals(bm,faces=bm.faces);me=bpy.data.meshes.new(tag);bm.to_mesh(me);bm.free()
  for p in me.polygons:p.use_smooth=True
  return own(tag,me,col,side)
 def shaft(x,side,col,top,bottom=.13,r=.118,flare=1.0):
  # A real open throat with a thick rim. The original trouser leg fits inside.
  profile=[(r,bottom),(r,top-.025),(r*flare,top),(r*flare-.014,top),(r-.014,top-.025),(r-.014,bottom)]
  bm=bmesh.new();rows=[]
  for rad,z in profile:rows.append([bm.verts.new((x+rad*math.cos(j*math.tau/20),rad*math.sin(j*math.tau/20),z)) for j in range(20)])
  for a,b in zip(rows,rows[1:]+rows[:1]):
   for j in range(20):bm.faces.new((a[j],a[(j+1)%20],b[(j+1)%20],b[j]))
  bmesh.ops.recalc_face_normals(bm,faces=bm.faces);me=bpy.data.meshes.new('Shaft');bm.to_mesh(me);bm.free()
  for p in me.polygons:p.use_smooth=True
  return own('Shaft',me,col,side)
 def band(x,side,z,col,r=.121,t=.012):tube('Cuff',[(x+r*math.cos(j*math.tau/24),r*math.sin(j*math.tau/24),z) for j in range(24)],t,col,side,True)
 for sign,side in [(-1,'L'),(1,'R')]:
  x=sign*.15;boot=group=='Boots';w=.22 if boot else .205;l=.34 if boot else .32
  chunky=style in ['runner','trail','work','hiker','moon','cosmic'];sh=.055 if chunky else .04
  box('Outsole',(x,-.05,sh/2),(w+.012,l+.018,sh),sole,side,bev=.013)
  box('Upper',(x,-.047,sh+.064),(w,l,.135),upper,side,bev=.044,slope=True)
  if style in ['canvas','court','skate','high','cosmic','runner']:
   box('Midsole',(x,-.05,sh+.008),(w+.015,l+.018,.018),'cream' if style!='cosmic' else 'pink',side)
  if boot or height>.23:shaft(x,side,upper,height,flare=1.08 if style=='cowboy' else 1.0)
  else:band(x,side,.177,'black' if style in ['oxford','loafer'] else upper,r=.085,t=.008)
  if style not in ['slip','loafer','gum','wader','cowboy','chelsea','frost','biker','moon']:
   lace='orange' if style=='hiker' else 'yellow' if style=='festival' else 'cream'
   box('Tongue',(x,-.015,.167),(.105,.12,.038),'black' if style=='skate' else upper,side)
   for i in range(4):
    y=-.104+i*.035;tube('Lace',[(x-.049,y,.176),(x,y+.016,.180),(x+.049,y,.176)],.0045,lace,side)
   if boot or style=='high':
    for i in range(3):
     z=.21+i*(height-.24)/3
     for s in [-1,1]:box('Eyelet',(x+s*.055,-.107,z),(.018,.018,.018),'silver',side,bev=.007)
     tube('BootLace',[(x-.051,-.117,z),(x,-.13,z+.014),(x+.051,-.117,z)],.0045,lace,side)
  if chunky:
   for y in [-.18,-.095,-.01,.075]:
    for s in [-1,1]:box('TreadLug',(x+s*w*.40,y,.014),(.057,.041,.026),sole,side,bev=.004)
  if style in ['canvas','court','work','trail']:
   box('ToeGuard',(x,-.155,sh+.058),(w*.94,.108,.094),'white' if style in ['canvas','court'] else 'gold' if style=='trail' else 'brown',side,bev=.032)
  if style in ['court','runner','skate','high','trail','cosmic']:
   for s in [-1,1]:box('SidePanel',(x+s*(w/2+.004),-.022,.126),(.017,.137,.057),'cream' if style in ['court','high'] else 'navy' if style=='runner' else 'gold' if style=='trail' else upper,side)
   box('HeelTab',(x,.108,.178),(.10,.025,.057),'cream' if style!='cosmic' else 'pink',side)
  if style in ['high','work','hiker']:band(x,side,height-.013,'cream' if style=='high' else 'brown' if style=='work' else 'orange',t=.014)
  if style in ['slip','loafer']:
   box('VampStrap',(x,-.073,.176),(.164,.050,.021),'cream' if style=='slip' else 'tan',side)
   for s in [-1,1]:box('ElasticInset',(x+s*.102,.01,.136),(.015,.046,.039),'navy' if style=='slip' else 'brown',side)
   if style=='loafer':box('PennySlot',(x,-.075,.19),(.036,.012,.012),'brown',side,bev=.004)
  if style in ['loafer','oxford','cowboy','chelsea','biker']:
   box('Heel',(x,.072,.032),(w*.9,.09,.064),sole,side)
   tube('Welt',[(x+(w/2+.005)*math.cos(j*math.tau/24),-.05+(l/2+.004)*math.sin(j*math.tau/24),.064) for j in range(24)],.005,'gold' if style=='oxford' else 'tan',side,True)
  if style in ['gum','wader']:
   band(x,side,height-.012,'black' if style=='gum' else 'cream',t=.014);band(x,side,.15,'black' if style=='gum' else 'cream',t=.010)
   box('ToeBumper',(x,-.19,.096),(w,.036,.083),sole,side,bev=.017)
   for s in [-1,1]:tube('PullHandle',[(x+s*.12,.025,height-.07),(x+s*.14,.025,height+.015),(x+s*.12,.025,height-.01)],.008,upper,side)
   if style=='wader':band(x,side,.31,'cream',t=.017)
  if style=='cowboy':
   box('WesternToe',(x,-.178,.09),(.17,.10,.105),'brown',side,bev=.035)
   for z in [.23,.31]:tube('Chevron',[(x-.064,-.105,z+.035),(x,-.126,z),(x+.064,-.105,z+.035)],.0045,'cream',side)
   for s in [-1,1]:tube('PullLoop',[(x+s*.118,0,height-.06),(x+s*.143,0,height+.02),(x+s*.126,0,height-.015)],.007,'tan',side)
  if style=='chelsea':
   for s in [-1,1]:box('ElasticPanel',(x+s*.118,.005,.23),(.018,.12,.13),'plum',side,bev=.015)
   box('PullTab',(x,.12,.32),(.052,.025,.065),'plum',side)
  if style=='frost':
   band(x,side,height-.01,'cream',t=.026)
   for j in range(16):
    a=j*math.tau/16;box('FleeceTuft',(x+.12*math.cos(a),.12*math.sin(a),height),(.035,.035,.035),'cream',side,bev=.016)
   for z in [.22,.30]:band(x,side,z,'plum',t=.014)
  if style=='biker':
   for z in [.21,.31]:
    band(x,side,z,'brown',t=.011);box('Buckle',(x+sign*.126,-.045,z),(.025,.053,.043),'silver',side,bev=.006);box('BuckleInset',(x+sign*.140,-.045,z),(.008,.027,.021),'black',side,bev=.003)
  if style=='moon':
   for z in [.20,.31]:band(x,side,z,'teal',t=.017)
   box('FrontArmor',(x,-.13,.27),(.125,.038,.17),'white',side,bev=.024)
   for z in [.23,.28,.33]:box('ArmorGroove',(x,-.153,z),(.103,.01,.010),'teal',side,bev=.002)
  if style in ['cosmic','festival']:
   # Raised symbol on the outside of each ankle; original, unbranded.
   pts=[]
   if style=='cosmic':
    for j in range(10):
     a=math.pi/2+j*math.pi/5;r=.034 if j%2==0 else .015;pts.append((x+sign*.122,r*math.cos(a),.201+r*math.sin(a)))
   else:
    for j in range(24):
     a=j*math.tau/24;pts.append((x+sign*.124,.035*math.sin(a)**3,.28+.0022*(13*math.cos(a)-5*math.cos(2*a)-2*math.cos(3*a)-math.cos(4*a))))
   me=bpy.data.meshes.new('Badge');me.from_pydata(pts,[],[tuple(range(len(pts)))]);own('StarBadge' if style=='cosmic' else 'HeartBadge',me,'gold' if style=='cosmic' else 'purple',side)
 bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
 for o in [rig]+objects:o.select_set(True)
 bpy.context.view_layer.objects.active=rig;file='%02d-%s.glb'%(idx,slug)
 bpy.ops.export_scene.gltf(filepath=str(OUT/file),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_extras=True,export_skins=True)
 manifest.append(dict(id=idx,slug='%02d-%s'%(idx,slug),name=name,group=group,description=desc,file='../models/footwear/'+file,slot='footwear',attachment='existing shin bones',maxHeight=height,cosmeticOnly=True,sourceCamperSHA256=hashlib.sha256((ROOT/'public/models/camper.glb').read_bytes()).hexdigest()))
 ref=bpy.data.collections.new('FitReference_%02d'%idx);scene.collection.children.link(ref);ref.objects.link(source)
 for o in base.objects:
  if o.type=='MESH' and not any(k in o.name for k in ['Shovel','Hair','Bucket','Cowboy','DesertCap','Shades','Shoe','Sole']):ref.objects.link(o)
 print('FOOTWEAR',idx,name,len(objects))
(ROOT/'public/footwear-lab').mkdir(exist_ok=True);(ROOT/'public/footwear-lab/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
bpy.context.window.scene=bpy.data.scenes['Footwear_01_camp-canvas'];bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/footwear.blend'),compress=True)
print('FOOTWEAR LAB: ten shoes + ten boots; paired skins on existing shins; knee clearance retained.')
