# blend: buildings.blend
exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
rnd=random.Random(51)
MET=('steel','steel',0.55,0.6)
def tube(name,a,b,r=0.03,m=MET,parent=None,verts=8,sq=False):
    a,b=Vector(a),Vector(b);d=b-a
    o=box(name,(r*2,r*2,d.length),(a+b)/2,m,bevel=0.004,parent=parent) if sq else cyl(name,r,d.length,(a+b)/2,m,verts=verts,bevel=0,parent=parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
def shade(c,d):return tuple(max(0,min(255,v+d)) for v in c)
def ico(name,r,loc,material,parent,sub=1,jitter=0.18,seed=0,squash=(1,1,1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=r,location=loc);o=bpy.context.active_object;o.name=name
    rr=random.Random(seed)
    for v in o.data.vertices:v.co*=1+rr.uniform(-jitter,jitter)
    o.scale=squash;bpy.ops.object.transform_apply(scale=True)
    return _finish(o,material,0,parent)
def wheel(name,x,y,r,parent):
    cyl(name,r,0.32,(x,y,r),('tyre',(0x22,0x22,0x22),0.9),verts=14,rot=(0,math.pi/2,0),bevel=0.02,parent=parent)
    cyl(name+'_hub',r*0.5,0.34,(x,y,r),('hub',(0x9a,0x9a,0x92),0.5,0.4),verts=10,rot=(0,math.pi/2,0),bevel=0.01,parent=parent)
    cyl(name+'_nut',r*0.18,0.36,(x,y,r),MET,verts=6,rot=(0,math.pi/2,0),bevel=0,parent=parent)

# ============ WaterTruck: cab at -Y (front), tank behind; tap on the +X side at the back. ~6.3 m long ============
scene('WaterTruck');r=root('WaterTruck')
CAB=('truck_cab',(0xd8,0xd2,0xc2),0.7,0.2);CAB2=('truck_trim',(0xa9,0xa2,0x90),0.7,0.2);TANK=('truck_tank',(0xb9,0xb4,0xa6),0.6,0.4)
box('chassis',(1.3,6.0,0.25),(0,0,0.72),('chassis',(0x2e,0x2e,0x2c),0.8,0.3),bevel=0.01,parent=r)
for y in (-2.25,1.2,2.25):
    for s in (-1,1):wheel(f'w{y}{s}',s*0.98,y,0.47,r)
box('cabbox',(2.1,1.7,1.35),(0,-1.75,1.55),CAB,bevel=0.08,parent=r)
box('cabroof',(1.95,1.55,0.12),(0,-1.75,2.28),CAB,bevel=0.05,parent=r)
box('hood',(1.8,1.15,0.75),(0,-3.1,1.25),CAB,bevel=0.07,parent=r)
box('grille',(1.4,0.08,0.55),(0,-3.69,1.2),CAB2,bevel=0.01,parent=r)
for k in range(6):box(f'grbar{k}',(1.3,0.1,0.03),(0,-3.72,0.98+k*0.09),('chrome',(0x8a,0x8a,0x86),0.4,0.6),bevel=0,parent=r)
box('bumper',(2.1,0.18,0.2),(0,-3.74,0.8),('chrome',(0x8a,0x8a,0x86),0.4,0.6),bevel=0.03,parent=r)
for s in (-1,1):
    cyl(f'headlight{s}',0.15,0.1,(s*0.72,-3.66,1.38),('lantern',(0xff,0xe8,0xb0),0.3),verts=12,rot=(math.pi/2,0,0),bevel=0.01,parent=r)
    box(f'fender{s}',(0.46,1.25,0.09),(s*0.98,-2.25,1.0),CAB,bevel=0.03,parent=r)   # flat fender over the front wheel
    box(f'fenderlip{s}',(0.46,0.09,0.3),(s*0.98,-2.85,0.88),CAB,bevel=0.02,parent=r)
    box(f'step{s}',(0.3,0.7,0.06),(s*1.05,-1.6,0.62),('chassis',(0x2e,0x2e,0x2c),0.8,0.3),bevel=0.01,parent=r)
    box(f'door{s}',(0.04,1.0,0.9),(s*1.06,-1.7,1.55),CAB2,bevel=0.01,parent=r)
    box(f'sidewin{s}',(0.03,0.8,0.5),(s*1.075,-1.75,1.95),('glass',(0x2f,0x3a,0x44),0.15,0.2),bevel=0,parent=r)
    tube(f'mirrorarm{s}',(s*1.05,-2.35,1.9),(s*1.35,-2.45,1.95),0.02,parent=r)
    box(f'mirror{s}',(0.06,0.18,0.3),(s*1.38,-2.45,1.95),('chassis',(0x2e,0x2e,0x2c),0.6,0.3),bevel=0.01,parent=r)
box('windshield',(1.8,0.05,0.62),(0,-2.62,1.93),('glass',(0x2f,0x3a,0x44),0.15,0.2),rot=(math.radians(-10),0,0),bevel=0,parent=r)
box('bed',(2.1,4.1,0.18),(0,1.0,0.94),('chassis',(0x3a,0x3a,0x38),0.8,0.3),bevel=0.01,parent=r)
cyl('tank',1.02,3.9,(0,1.05,2.05),TANK,verts=22,rot=(math.pi/2,0,0),bevel=0.03,parent=r)
for y in (-0.6,0.4,1.4,2.4):cyl(f'band{y}',1.05,0.1,(0,y+0.25,2.05),('tank_band',(0x8a,0x86,0x7a),0.6,0.4),verts=22,rot=(math.pi/2,0,0),bevel=0,parent=r)
for y,s in ((-0.93,-1),(3.02,1)):cyl(f'cap{s}',0.98,0.12,(0,y,2.05),('tank_band',(0x8a,0x86,0x7a),0.6,0.4),verts=22,rot=(math.pi/2,0,0),bevel=0.02,parent=r)
cyl('hatch',0.32,0.14,(0,0.6,3.1),('tank_band',(0x8a,0x86,0x7a),0.6,0.4),verts=14,bevel=0.01,parent=r)
for k in range(5):box(f'lrung{k}',(0.5,0.05,0.04),(0,3.12,1.1+k*0.38),MET,bevel=0,parent=r)
for s in (-0.25,0.25):box(f'lrail{s}',(0.05,0.05,2.0),(s,3.12,1.9),MET,bevel=0,parent=r)
for s in (-1,1):box(f'saddle{s}',(1.9,0.2,0.35),(0,1.05+s*1.3,1.1),('chassis',(0x3a,0x3a,0x38),0.8,0.3),bevel=0.01,parent=r)
text('tanktxt','WATER',(1.035,1.05,2.1),0.42,('ink','ink',0.85),fontname='BigShouldersStencilDisplay',rot=(math.pi/2,0,math.pi/2),extrude=0.004,parent=r)
text('tanktxt2','WATER',(-1.035,1.05,2.1),0.42,('ink','ink',0.85),fontname='BigShouldersStencilDisplay',rot=(math.pi/2,0,-math.pi/2),extrude=0.004,parent=r)
# the tap campers fill their canteens at: +X side, at the back
tube('pipe',(0.6,2.7,1.2),(1.25,2.7,1.2),0.06,m=('pipe',(0x4f,0x8f,0xb8),0.5,0.3),parent=r)
cyl('valve',0.12,0.04,(1.1,2.7,1.36),('paint_red','paint_red',0.6),verts=10,bevel=0,parent=r)
tube('spout',(1.25,2.7,1.2),(1.25,2.7,1.0),0.05,m=('pipe',(0x4f,0x8f,0xb8),0.5,0.3),parent=r)
box('drip',(0.4,0.4,0.01),(1.3,2.7,0.005),('wetsand',(0xa8,0x86,0x55),0.95),bevel=0,parent=r)
studio(elev=16,azim=-55,lens=40);frame(margin=1.08);print('truck',tris());render()

# ============ MessTable: picnic table with attached benches under a canvas shade (3.1 x 0.95 top at 0.75) ============
scene('MessTable');r=root('MessTable');WD=('wood_pale','wood_pale',0.9)
for k in range(4):box(f'top{k}',(3.1,0.22,0.05),(0,-0.36+k*0.24,0.75),(f'plank_{k}',shade(PAL['wood_pale'],rnd.randint(-10,10)),0.9),bevel=0.008,parent=r)
for s in (-1,1):
    for k in range(2):box(f'bench{s}{k}',(3.1,0.14,0.05),(0,s*(0.72+k*0.15),0.45),(f'plank_{k}',shade(PAL['wood_pale'],rnd.randint(-10,10)),0.9),bevel=0.008,parent=r)
for x in (-1.2,1.2):
    tube(f'legA{x}',(x,-0.95,0),(x,0.25,0.74),0.05,m=('wood','wood',0.9),parent=r,sq=True);tube(f'legB{x}',(x,0.95,0),(x,-0.25,0.74),0.05,m=('wood','wood',0.9),parent=r,sq=True)
    box(f'cross{x}',(0.08,2.0,0.08),(x,0,0.4),('wood','wood',0.9),bevel=0.005,parent=r)
for x in (-1.75,1.75):
    for y in (-1.3,1.3):tube(f'pole{x}{y}',(x,y,0),(x,y,2.45),0.04,m=('wood_dark','wood_dark',0.9),parent=r)
me=bpy.data.meshes.new('canopy');vs=[];fs=[]
for j in range(7):
    for i in range(2):
        x=-1.9+3.8*i;y=-1.45+j*2.9/6;vs.append((x,y,2.45-0.06*math.sin(math.pi*j/6)))
for j in range(6):fs.append((j*2,j*2+1,j*2+3,j*2+2))
me.from_pydata(vs,[],fs);o=bpy.data.objects.new('canopy',me);bpy.context.window.scene.collection.objects.link(o);_finish(o,('canvas_shade',(0xc9,0xb2,0x86),0.95),0,r);o.modifiers.new('s','SOLIDIFY').thickness=0.03
for x in (-1.9,1.9):
    for k in range(7):box(f'scallop{x}{k}',(0.02,0.4,0.16),(x,-1.2+k*0.4,2.37),('canvas_stripe',(0xa6,0x44,0x2e),0.95),bevel=0,parent=r)
for k in range(3):
    box(f'tray{k}',(0.35,0.25,0.03),(-0.9+k*0.9,0.05,0.79),('tray',(0x9a,0x9a,0x92),0.5,0.4),bevel=0.005,parent=r)
    cyl(f'cup{k}',0.04,0.1,(-0.7+k*0.9,-0.2,0.83),('cup',(0xee,0xe0,0xbc),0.8),verts=8,bevel=0,parent=r)
studio(elev=22,azim=-35,lens=45);frame(margin=1.1);print('mess',tris());render()

# ============ FlagPole: 7.2 m pole, finial, halyard, cleat, a waving camp flag ============
scene('FlagPole');r=root('FlagPole')
box('base',(0.7,0.7,0.3),(0,0,0.15),('concrete','concrete',0.95),bevel=0.04,parent=r)
cyl('pole',0.09,7.2,(0,0,3.6),('pole',(0xcf,0xcf,0xcf),0.5,0.5),verts=12,r2=0.055,bevel=0,parent=r)
ico('finial',0.13,(0,0,7.28),('brass','brass',0.4,0.8),r,sub=1,jitter=0)
box('cleat',(0.04,0.06,0.2),(0.09,0,1.3),MET,bevel=0,parent=r)
tube('halyard',(0.08,0,1.3),(0.08,0,7.1),0.008,m=('rope',(0xe6,0xe0,0xd0),0.9),parent=r)
# flag: subdivided sheet with a sine ripple; green field, cream stripe
nx,nz,FW,FH=10,6,1.8,1.1;vs=[];fs=[]
for j in range(nz+1):
    for i in range(nx+1):
        x=0.1+FW*i/nx;z=7.05-FH*j/nz;y=0.12*math.sin(i/nx*math.pi*1.6)*(i/nx);vs.append((x,y,z))
for j in range(nz):
    for i in range(nx):a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
me=bpy.data.meshes.new('flag');me.from_pydata(vs,[],fs);o=bpy.data.objects.new('flag',me);bpy.context.window.scene.collection.objects.link(o)
_finish(o,('flag_green',(0x3f,0x6a,0x3a),0.9),0,r);o.modifiers.new('s','SOLIDIFY').thickness=0.015
o.data.materials.append(mat('flag_cream',(0xee,0xe0,0xbc),0.9))
for p in o.data.polygons:
    zc=sum(o.data.vertices[v].co.z for v in p.vertices)/4
    if 6.45<zc<6.65:p.material_index=1
studio(elev=10,azim=-40,lens=50);frame(margin=1.1);print('flag',tris());render()

# ============ LampPost: wooden pole, crossarm, enamel shade and a warm bulb (lamp at ~2.55 like the old ones) ============
scene('LampPost');r=root('LampPost')
cyl('pole',0.09,2.9,(0,0,1.45),('wood_dark','wood_dark',0.9),verts=8,r2=0.075,bevel=0,parent=r)
box('arm',(0.08,0.6,0.08),(0,-0.25,2.75),('wood_dark','wood_dark',0.9),bevel=0.005,parent=r)
tube('brace',(0,-0.02,2.45),(0,-0.4,2.72),0.025,m=('wood_dark','wood_dark',0.9),parent=r,sq=True)
tube('drop',(0,-0.5,2.75),(0,-0.5,2.62),0.015,m=MET,parent=r)
cyl('shade',0.05,0.16,(0,-0.5,2.56),('enamel',(0x3f,0x5a,0x3a),0.5,0.2),verts=14,r2=0.24,bevel=0,parent=r)
ico('bulb',0.08,(0,-0.5,2.47),('bulb',(0xff,0xe8,0xb0),0.3),r,sub=1,jitter=0)
tube('wire',(0,0.05,2.8),(0,0.05,2.2),0.012,m=('cord',(0x22,0x22,0x22),0.9),parent=r)
box('junction',(0.12,0.08,0.16),(0,0.1,2.1),MET,bevel=0.01,parent=r)
studio(elev=12,azim=-50,lens=50);frame(margin=1.3);print('lamp',tris());render()

# ============ OakTree: gnarled trunk, three limbs, clustered low-poly canopy (scale 1 ~ 6.5 m tall) ============
scene('OakTree');r=root('OakTree');BARK=('bark',(0x5a,0x3f,0x28),0.95);LEAF=[('leaf%d'%k,c,0.9) for k,c in enumerate([(0x5f,0x7a,0x3a),(0x55,0x70,0x34),(0x6a,0x84,0x42)])]
cyl('trunk',0.34,3.0,(0,0,1.5),BARK,verts=9,r2=0.26,bevel=0,parent=r)
for k in range(4):
    a=k*math.pi/2+0.4;tube(f'root{k}',(0,0,0.35),(math.cos(a)*0.75,math.sin(a)*0.75,0.0),0.12,m=BARK,parent=r)
limbs=[((0,0,2.7),(1.4,0.4,4.1)),((0,0,2.6),(-1.2,-0.5,4.0)),((0,0,2.9),(0.1,-0.6,4.7))]
for k,(a,b) in enumerate(limbs):tube(f'limb{k}',a,b,0.16,m=BARK,parent=r,verts=7)
clusters=[(0,0,4.8,1.9),(1.5,0.5,4.3,1.5),(-1.4,-0.4,4.2,1.5),(0.2,-1.0,5.2,1.3),(-0.6,1.0,4.9,1.3),(1.0,-0.7,5.4,1.1),(-1.0,0.2,5.5,1.0)]
for k,(x,y,z,s) in enumerate(clusters):ico(f'leaves{k}',s,(x,y,z),LEAF[k%3],r,sub=1,jitter=0.2,seed=k,squash=(1,1,0.78))
studio(elev=10,azim=-40,lens=45);frame(margin=1.08);print('oak',tris());render()

# ============ Hammock: striped canvas slung between an A-frame stand (3.6 m) ============
scene('Hammock');r=root('Hammock')
for s in (-1,1):
    for t in (-1,1):tube(f'leg{s}{t}',(s*1.9,t*0.55,0),(s*1.75,0,1.45),0.05,m=('wood','wood',0.9),parent=r,sq=True)
    box(f'foot{s}',(0.1,1.3,0.08),(s*1.9,0,0.04),('wood','wood',0.9),bevel=0.005,parent=r)
box('base',(3.9,0.1,0.08),(0,0,0.04),('wood','wood',0.9),bevel=0.005,parent=r)
nx,ny=12,4;vs=[];fs=[]
for j in range(ny+1):
    for i in range(nx+1):
        u=i/nx;x=-1.3+2.6*u;y=-0.45+0.9*j/ny;z=0.95-0.35*math.sin(math.pi*u)-0.08*math.sin(math.pi*j/ny);vs.append((x,y,z))
for j in range(ny):
    for i in range(nx):a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
me=bpy.data.meshes.new('bed');me.from_pydata(vs,[],fs);o=bpy.data.objects.new('bed',me);bpy.context.window.scene.collection.objects.link(o)
_finish(o,('hammock_a',(0xd9,0xcb,0xa6),0.95),0,r);o.modifiers.new('s','SOLIDIFY').thickness=0.02
o.data.materials.append(mat('hammock_b',(0xa6,0x44,0x2e),0.95))
for p in o.data.polygons:
    if (p.index%nx)//2%2==0:p.material_index=1
for s in (-1,1):
    for t in (-0.4,0,0.4):tube(f'cord{s}{t}',(s*1.3,t,0.95),(s*1.72,0,1.4),0.01,m=('rope',(0xe6,0xe0,0xd0),0.9),parent=r)
box('pillow',(0.4,0.6,0.1),(-1.0,0,0.78),('paint_white','paint_white',0.9),bevel=0.04,parent=r)
studio(elev=18,azim=-30,lens=45);frame(margin=1.12);print('hammock',tris());render()

# ============ ShowerBlock: 4 plank stalls with half doors, a roof tank and pipes, "4 MINUTES" sign; front -Y ============
scene('ShowerBlock');r=root('ShowerBlock');W,D,H=5.2,2.2,2.3;WD=('wood','wood',0.9)
box('pad',(W+0.6,D+0.8,0.12),(0,-0.2,0.06),('concrete','concrete',0.95),bevel=0.02,parent=r)
box('backwall',(W,0.08,H),(0,D/2,0.12+H/2),WD,bevel=0.005,parent=r)
for k in range(5):box(f'div{k}',(0.08,D,H),(-W/2+k*W/4,0,0.12+H/2),WD,bevel=0.005,parent=r)
for k in range(4):
    x=-W/2+W/8+k*W/4
    box(f'door{k}',(W/4-0.2,0.05,1.2),(x+0.05,-D/2,0.6+0.3),(f'door_{k%2}',shade(PAL['wood_pale'],rnd.randint(-12,12)),0.9),rot=(0,0,rnd.uniform(-0.25,0.05)),bevel=0.008,parent=r)
    tube(f'pipe{k}',(x,D/2-0.12,H+0.1),(x,D/2-0.12,1.9),0.03,m=MET,parent=r)
    cyl(f'head{k}',0.09,0.05,(x,D/2-0.25,1.9),MET,verts=10,rot=(math.radians(60),0,0),bevel=0,parent=r)
box('roof',(W+0.4,D+0.5,0.1),(0,0,0.12+H+0.1),('tin',(0x8a,0x86,0x7a),0.6,0.3),rot=(math.radians(-5),0,0),bevel=0.01,parent=r)
for k in range(12):box(f'rib{k}',(0.03,D+0.5,0.04),(-W/2-0.1+k*0.48,0,0.12+H+0.17),('tin',(0x8a,0x86,0x7a),0.6,0.3),rot=(math.radians(-5),0,0),bevel=0,parent=r)
for x in (-1.6,1.6):
    for y in (-0.4,0.4):tube(f'tankleg{x}{y}',(x*0.6+ (0.3 if y>0 else -0.3),y+0.4,H+0.3),(x*0.6+(0.3 if y>0 else -0.3),y+0.4,H+0.9),0.04,parent=r,sq=True)
cyl('tank',0.7,1.9,(0,0.4,H+1.45),('tank_black',(0x2e,0x2e,0x2c),0.7,0.3),verts=16,rot=(0,math.pi/2,0),bevel=0.02,parent=r)
tube('feed',(0.95,0.4,H+1.3),(W/2-0.2,D/2-0.12,H+0.12),0.04,m=MET,parent=r)
box('sign',(1.8,0.05,0.5),(0,-D/2-0.05,H+0.35),('paint_white','paint_white',0.8),bevel=0.01,parent=r)
text('signtxt','SHOWERS - 4 MIN',(0,-D/2-0.08,H+0.35),0.16,('ink','ink',0.85),parent=r)
box('duckboard',(W-0.2,0.8,0.05),(0,-D/2-0.55,0.15),('wood_pale','wood_pale',0.9),bevel=0.005,parent=r)
studio(elev=16,azim=-35,lens=40);frame(margin=1.08);print('shower',tris());render()

# ============ Outhouse: classic plank privy with a crescent moon, vent pipe; door -Y ============
scene('Outhouse');r=root('Outhouse')
box('floor',(1.4,1.4,0.1),(0,0,0.05),('wood_dark','wood_dark',0.9),bevel=0.01,parent=r)
for s in (-1,1):box(f'side{s}',(0.06,1.3,2.2),(s*0.65,0,1.2),('wood','wood',0.9),bevel=0.005,parent=r)
box('back',(1.3,0.06,2.3),(0,0.65,1.25),('wood','wood',0.9),bevel=0.005,parent=r)
for k in range(5):box(f'plank{k}',(0.25,0.05,2.1),(-0.52+k*0.26,-0.66,1.15),(f'door_{k%2}',shade(PAL['wood_pale'],rnd.randint(-15,15)),0.9),bevel=0.004,parent=r)
box('roof',(1.6,1.7,0.08),(0,0,2.42),('tin',(0x8a,0x86,0x7a),0.6,0.3),rot=(math.radians(-10),0,0),bevel=0.01,parent=r)
cyl('moon',0.14,0.07,(0,-0.69,1.85),('soot',(0x1e,0x19,0x16),1.0),verts=16,rot=(math.pi/2,0,0),bevel=0,parent=r)
cyl('moonbite',0.12,0.075,(0.07,-0.7,1.88),('door_0',shade(PAL['wood_pale'],-5),0.9),verts=16,rot=(math.pi/2,0,0),bevel=0,parent=r)
box('handle',(0.04,0.06,0.2),(0.4,-0.71,1.1),MET,bevel=0,parent=r)
for z in (0.4,1.8):box(f'hinge{z}',(0.2,0.03,0.05),(-0.55,-0.7,z),MET,bevel=0,parent=r)
tube('vent',(0.4,0.4,2.3),(0.4,0.4,2.9),0.05,m=MET,parent=r)
studio(elev=14,azim=-35,lens=50);frame(margin=1.2);print('outhouse',tris());render()
bpy.ops.wm.save_mainfile()
