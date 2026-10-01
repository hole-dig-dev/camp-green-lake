# blend: props.blend
"""First-person gold work: open bucket, contact grips, sediment and water.

Run: cd art/blender && python3 bx.py goldfx.py
Rebuilds the sifter sources first (no studio renders), then these additional assets.
All geometry lives here; the client only poses/scales the exported meshes.
Hands share the camper's runtime skin colour. Wrist sockets below are in game coordinates.
"""
import bpy, os, math, shutil
from mathutils import Vector
HERE=os.path.dirname(bpy.data.filepath)
SIFTER_PREVIEW=False
exec(open(os.path.join(HERE,'sifter.py')).read())
SKIN=('gfx_skin',(190,145,104),0.83,0)
SLEEVE=('gfx_sleeve',(204,101,49),0.95,0)
CUFF=('gfx_cuff',(172,78,36),0.92,0)
WET=('gfx_wet_sand',(126,102,65),0.92,0)
HEAVY=('gfx_black_sand',(47,43,34),0.86,0)
WATER=('gfx_water',(118,166,161),0.16,0)
PALE=('gfx_water_edge',(187,216,198),0.2,0)

def g(v):return Vector((v[0],-v[2],v[1]))
def segment(n,a,b,ra,rb,m,p):
    a,b=g(a),g(b);d=b-a
    o=cyl(n,ra,d.length,(a+b)/2,m,verts=10,r2=rb,bevel=0.003,parent=p)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def block(n,size,at,m,p,bv=0.006):
    return box(n,(size[0],size[2],size[1]),g(at),m,bevel=bv,parent=p)
def emit(n):
    p=export_glb(os.path.join(OUT,n+'.glb'));print(n,p[1],p[2])
def surface(n,r,z,m,dome=0):
    """An irregular concentric sediment surface, not a solid cylinder lid."""
    sc=scene(n);r0=root(n);verts=[(0,0,z+dome)];faces=[];N=48
    for ring in range(1,5):
        for k in range(N):
            a=k/N*math.tau;rr=r*ring/4
            height=z+dome*(1-(ring/4)**2)+(.0006*math.sin(a*3+ring*.5) if dome else 0)
            verts.append((math.cos(a)*rr,math.sin(a)*rr,height))
    for k in range(N):faces.append((0,1+k,1+(k+1)%N))
    for ring in range(3):
        a=1+ring*N;b=a+N
        for k in range(N):faces.append((a+k,b+k,b+(k+1)%N,a+(k+1)%N))
    me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(n,me);_link(o);_finish(o,m,0,r0)
    if n in ('GoldFxSediment','GoldFxBlackSand'):
        rnd2=random.Random(31)
        for i in range(75):
            a=rnd2.uniform(0,math.tau);rr=r*math.sqrt(rnd2.random())*.94
            zz=z+dome*(1-(rr/r)**2)+.001
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=rnd2.uniform(.0017,.0038),location=(math.cos(a)*rr,math.sin(a)*rr,zz))
            peb=bpy.context.active_object;peb.name='grain'+str(i);peb.scale.z=.5;_finish(peb,m,0,r0)
    emit(n)

# An actual open pail for tipping. The carrying model retains its full load.
scene('CampBucketEmpty');r=root('CampBucketEmpty')
N=32;verts=[];faces=[]
for rad,z in ((.12,.007),(.15,.28),(.145,.28),(.115,.016)):
    for k in range(N):a=k/N*math.tau;verts.append((rad*math.cos(a),rad*math.sin(a),z))
for j in range(3):
    for k in range(N):faces.append((j*N+k,j*N+(k+1)%N,(j+1)*N+(k+1)%N,(j+1)*N+k))
me=bpy.data.meshes.new('open_pail');me.from_pydata(verts,[],faces);me.update()
o=bpy.data.objects.new('open_pail',me);_link(o);_finish(o,TIN,0,r)
cyl('bottom',.118,.012,(0,0,.01),TIN,verts=N,bevel=.002,parent=r)
for s in (-1,1):
    cyl('lug'+str(s),.02,.02,(s*.15,0,.25),IRON,verts=8,rot=(0,math.pi/2,0),parent=r)
emit('CampBucketEmpty')
scene('CampBucketBail');r=root('CampBucketBail')
for s in (-1,1):tube('bail'+str(s),(s*.15,0,0),(s*.08,0,.14),.007,IRON,r)
tube('bail_top',(-.08,0,.14),(.08,0,.14),.007,IRON,r)
cyl('wood_grip',.014,.10,(0,0,.145),WOOD[1],verts=10,rot=(0,math.pi/2,0),parent=r)
emit('CampBucketBail')
surface('GoldFxBucketSand',.144,.26,SAND,.033)
surface('GoldFxSediment',.137,.019,WET,.027)
surface('GoldFxBlackSand',.084,.017,HEAVY,.002)
surface('GoldFxWater',.148,.045,WATER)

# Rolled-rim contact: palms outside, four fingers tucked under, thumbs over the rim.
scene('GoldFxPanHands');r=root('GoldFxPanHands')
for side in (-1,1):
    block('palm'+str(side),(.055,.038,.086),(side*.228,.064,.016),SKIN,r)
    segment('wrist'+str(side),(side*.25,.058,.047),(side*.282,.052,.078),.024,.029,SKIN,r)
    for j in range(4):
        z=-.018+j*.021
        a=(side*.237,.052,z);b=(side*.213,.032,z);c=(side*.187,.037,z)
        segment('fingerA'+str(side)+str(j),a,b,.009,.009,SKIN,r)
        segment('fingerB'+str(side)+str(j),b,c,.009,.007,SKIN,r)
    segment('thumbA'+str(side),(side*.224,.082,-.024),(side*.202,.09,-.042),.012,.011,SKIN,r)
    segment('thumbB'+str(side),(side*.202,.09,-.042),(side*.18,.079,-.034),.011,.008,SKIN,r)
emit('GoldFxPanHands')

# Left fist holds the bail, right palm braces the bottom. Coordinates include the 1.35x pail scale.
scene('GoldFxBucketHands');r=root('GoldFxBucketHands')
block('bail_palm',(.078,.037,.061),(-.04,.561,.018),SKIN,r)
segment('bail_wrist',(-.063,.56,.04),(-.095,.559,.085),.025,.029,SKIN,r)
for j in range(4):
    x=-.072+j*.018
    segment('bail_fingerA'+str(j),(x,.555,-.009),(x,.528,-.02),.01,.009,SKIN,r)
    segment('bail_fingerB'+str(j),(x,.528,-.02),(x,.525,.009),.009,.008,SKIN,r)
segment('bail_thumb',(-.007,.57,.018),(.018,.547,.003),.013,.009,SKIN,r)
block('support_palm',(.061,.034,.084),(.178,.035,.01),SKIN,r)
segment('support_wrist',(.202,.035,.04),(.231,.028,.081),.025,.029,SKIN,r)
for j in range(4):
    z=-.018+j*.019
    segment('support_fingerA'+str(j),(.173,.034,z),(.145,.013,z),.009,.009,SKIN,r)
    segment('support_fingerB'+str(j),(.145,.013,z),(.12,.017,z),.009,.007,SKIN,r)
segment('support_thumb',(.189,.057,-.025),(.184,.08,-.05),.012,.009,SKIN,r)
# Export each contact separately: the left fist follows the swinging bail, the right the pail.
bpy.context.view_layer.update()
parts=[(o.name,bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get())),o.matrix_world.copy()) for o in coll('Asset').all_objects if o.type=='MESH']
from mathutils import Matrix
for side,prefix in (('L','bail_'),('R','support_')):
    n='GoldFxBucketHand'+side;scene(n);rr=root(n)
    for name,me,mw in parts:
        if not name.startswith(prefix):continue
        data=me.copy();data.transform(mw)
        if side=='L':data.transform(Matrix.Translation((0,0,-.3375)))
        o=bpy.data.objects.new(name,data);_link(o);o.parent=rr
    emit(n)


# A tapered forearm from wrist (game y=0) toward elbow (y=1); client aims it at the lower view edge.
scene('GoldFxArm');r=root('GoldFxArm')
segment('forearm',(0,0,0),(0,.42,0),.029,.047,SKIN,r)
segment('rolled_cuff',(0,.4,0),(0,.5,0),.052,.055,CUFF,r)
segment('sleeve',(0,.47,0),(0,1,0),.053,.071,SLEEVE,r)
emit('GoldFxArm')

# Unit stream and thin spill sheet, oriented along +Y in game space; only transforms animate them.
scene('GoldFxStream');r=root('GoldFxStream')
segment('stream',(0,0,0),(0,1,0),.035,.052,SAND,r);emit('GoldFxStream')
scene('GoldFxSpill');r=root('GoldFxSpill')
block('wash_sheet',(.12,1,.002),(0,.5,0),WATER,r,bv=0);emit('GoldFxSpill')
scene('GoldFxRipple');r=root('GoldFxRipple')
bpy.ops.mesh.primitive_torus_add(major_radius=.20,minor_radius=.002,major_segments=48,minor_segments=5)
o=bpy.context.active_object;_finish(o,PALE,0,r);emit('GoldFxRipple')

# Keep the pan's steel readable and give its working riffles a separate finish.
scene('GoldPan',fresh=False)
for o in coll('Asset').all_objects:
    if o.type!='MESH':continue
    o.data.materials.clear()
    o.data.materials.append(mat('gfx_pan',(64,83,75),.62,.25) if not o.name.startswith('rim') else mat('gfx_pan_rim',(142,153,139),.45,.5))
emit('GoldPan')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'props.blend'),compress=True)
PUBLIC=os.path.abspath(os.path.join(HERE,'..','..','public','models'))
for n in ['Sifter','SifterTray','CampBucketEmpty','CampBucketBail','GoldPan','GoldFxBucketSand','GoldFxSediment','GoldFxBlackSand','GoldFxWater','GoldFxPanHands','GoldFxBucketHandL','GoldFxBucketHandR','GoldFxArm','GoldFxStream','GoldFxSpill','GoldFxRipple']:
    shutil.copyfile(os.path.join(OUT,n+'.glb'),os.path.join(PUBLIC,n+'.glb'))
print('Copied gold-work assets to',PUBLIC)
