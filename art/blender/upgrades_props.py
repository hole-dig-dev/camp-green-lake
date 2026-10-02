"""Rebuild static upgrade props; run with background Blender on props.blend.
Exports held tools at their actual grip origin, unlike floor-standing supplies.
GRIP gives the equivalent standing grip height; do NOT subtract it again at runtime.
Sifter-framed geometry is authored directly in the existing sifter's world frame.
"""
from pathlib import Path
import bpy, math, random
HERE = Path(__file__).resolve().parent
exec((HERE/'upgrades_common.py').read_text())
GRIP = {'DynamiteHeld': .10, 'DisarmKit': .055, 'GrappleHook': .105}
rnd = random.Random(100126)

def dynamite(name, held=False):
    r = begin(name)
    for i,(x,y) in enumerate(((-.034,-.021),(.034,-.021),(0,.038))):
        cyl('red_stick_'+str(i), .035, .195, (x,y,.0975), RED, verts=12, bevel=.003, parent=r)
        cyl('paper_end_'+str(i), .030, .003, (x,y,.197), CREAM, verts=12, bevel=0, parent=r)
    for z in (.055,.142):
        # Wide tape wraps the silhouette of all three sticks.
        torus('tape', (0,0,z), .064, .009, DARK, r)
        box('tape_front', (.11,.012,.025), (0,-.05,z), DARK, bevel=.003, parent=r)
    pts=[(0,.038,.199),(0,.038,.221),(.017,.034,.24),(.033,.026,.245)]
    for a,b in zip(pts,pts[1:]):tube('braided_fuse',a,b,.004,STRAW,r,sides=6)
    if held:r.location.z=-GRIP[name]
    finish(name,r,floor=not held)

dynamite('Dynamite')
dynamite('DynamiteHeld',True)

r=begin('LooseSand')
sands=[('fresh_sand_'+str(i),c,.98,0) for i,c in enumerate(((193,155,100),(208,170,116),(180,141,88),(219,182,126)))]
# Concentric irregular rings form a continuous pile, with a broad silhouette at 20% height.
verts=[(0,0,.45)];N=32
for radius,z in ((.42,.38),(.94,.23),(1.32,.09),(1.60,0)):
    for k in range(N):
        a=k*math.tau/N;rr=radius*rnd.uniform(.94,1.0)
        verts.append((math.cos(a)*rr,math.sin(a)*rr,max(0,z+rnd.uniform(-.022,.022)) if z else 0))
faces=[(0,1+k,1+(k+1)%N) for k in range(N)]
for ring in range(3):
    for k in range(N):
        a=1+ring*N+k;b=1+ring*N+(k+1)%N;c=b+N;d=a+N
        faces.extend(((a,d,b),(b,d,c)))
faces.append(tuple(reversed(range(1+3*N,1+4*N))))
o=pipe_mesh('continuous_loose_pile',verts,faces,mat(*sands[0]),r)
for m in sands[1:]:o.data.materials.append(mat(*m))
for p in o.data.polygons:p.material_index=rnd.choices(range(4),[8,2,1,1])[0]
for k in range(18):
    a=rnd.random()*math.tau;rr=rnd.uniform(.85,1.4)
    lump('loose_clod',(math.cos(a)*rr,math.sin(a)*rr,.07),(.11,.09,.07),rnd.choice(sands),r)
finish('LooseSand',r,elev=27)
r.scale.z=.2;preview('LooseSand-flat',elev=18);r.scale.z=1

r=begin('Scarecrow')
SHIRT=('scarecrow_faded_blue',(77,117,137),.96,0)
PATCH=('scarecrow_patch',(187,78,44),.96,0)
box('post',(.09,.09,2.10),(0,0,1.05),WOOD,bevel=.006,parent=r)
tube('crossbar',(-.73,0,1.54),(.73,0,1.54),.042,WOOD,r)
box('shirt_body',(.47,.25,.64),(0,-.012,1.36),SHIRT,bevel=.055,parent=r)
for s in (-1,1):
    tube('sleeve',(s*.20,0,1.55),(s*.62,0,1.53),.115,SHIRT,r,tip=.087)
    for k in range(6):
        tube('hand_straw',(s*.61,rnd.uniform(-.05,.05),1.55+rnd.uniform(-.05,.05)),
             (s*rnd.uniform(.72,.82),rnd.uniform(-.06,.06),1.50+rnd.uniform(-.08,.08)),.009,STRAW,r,tip=.002)
    tube('rattle_string',(s*.69,0,1.53),(s*.69,0,1.20),.003,CREAM,r)
    cyl('rattle_can',.048,.095,(s*.69,0,1.16),STEEL,verts=10,bevel=.004,parent=r)
    for z in (1.122,1.195):torus('can_rim',(s*.69,0,z),.049,.004,DARK,r)
lump('stuffed_burlap_head',(0,-.005,1.86),(.175,.14,.21),STRAW,r,2)
for x in (-.055,.055):box('stitched_eye',(.027,.015,.018),(x,-.143,1.89),DARK,rot=(0,0,.15),bevel=0,parent=r)
tube('stitched_grin',(-.07,-.142,1.80),(0,-.156,1.77),.006,DARK,r)
tube('stitched_grin',(0,-.156,1.77),(.07,-.142,1.80),.006,DARK,r)
cyl('hat_brim',.27,.035,(0,0,2.038),WOOD,verts=12,bevel=.004,parent=r)
cyl('hat_crown',.16,.15,(0,0,2.124),WOOD,verts=12,r2=.12,bevel=.007,parent=r)
cyl('hat_band',.161,.035,(0,0,2.072),DARK,verts=12,bevel=0,parent=r)
for x,z in ((-.115,1.24),(.11,1.49)):
    box('shirt_patch',(.12,.012,.13),(x,-.143,z),PATCH,rot=(0,.12,0),bevel=.003,parent=r)
    for k in (-1,0,1):box('patch_stitch',(.026,.005,.006),(x+k*.034,-.154,z-.058),CREAM,bevel=0,parent=r)
for k in range(10):tube('hem_straw',(rnd.uniform(-.20,.20),0,1.06),(rnd.uniform(-.22,.22),-.02,.93),.009,STRAW,r,tip=.002)
finish('Scarecrow',r)

r=begin('DisarmKit')
box('canvas_roll',(.27,.13,.026),(0,0,.035),CANVAS,bevel=.012,parent=r)
for x in (-.13,.13):cyl('rolled_edge',.032,.135,(x,0,.034),CANVAS,verts=10,rot=(math.pi/2,0,0),bevel=0,parent=r)
for x in (-.075,.075):box('roll_strap',(.025,.14,.012),(x,0,.055),DARK,bevel=.003,parent=r)
tube('probe_handle',(-.10,-.026,.062),(.012,-.026,.062),.015,WOOD,r)
tube('probe',(.012,-.026,.062),(.15,-.026,.062),.004,STEEL,r,tip=.001)
for s in (-1,1):
    tube('cutter_grip',(s*.030,.035,.065),(s*.064,.105,.065),.012,RED,r)
    tube('cutter_jaw',(s*.030,.035,.065),(-s*.013,-.021,.065),.008,STEEL,r)
cyl('pivot',.012,.012,(0,.011,.065),BRASS,verts=8,bevel=0,parent=r)
r.location.z=-GRIP['DisarmKit'];finish('DisarmKit',r,elev=42,floor=False)

def hook(r,start=(0,0,0),size=1):
    def p(x,y,z):return tuple(start[i]+size*v for i,v in enumerate((x,y,z)))
    torus('rope_eye',p(.008,0,0),.025*size,.008*size,STEEL,r,rot=(0,math.pi/2,0))
    tube('hook_shank',p(.025,0,0),p(.19,0,0),.018*size,STEEL,r)
    for k in range(3):
        a=k*math.tau/3;dy,dz=math.cos(a),math.sin(a)
        pts=[p(.17,0,0),p(.25,.10*dy,.10*dz),p(.23,.145*dy,.145*dz),p(.16,.13*dy,.13*dz)]
        for i,(u,v) in enumerate(zip(pts,pts[1:])):tube('forged_prong',u,v,(.018 if i<2 else .013)*size,STEEL,r,tip=.004*size if i==2 else None)
r=begin('GrappleHookHead');hook(r);finish('GrappleHookHead',r,floor=False)
r=begin('GrappleHook')
# Compact launcher, trigger guard, rope drum; forward barrel points Blender -Y.
box('wood_grip',(.055,.065,.15),(0,.03,.075),WOOD,rot=(.18,0,0),bevel=.008,parent=r)
box('launcher_body',(.12,.23,.10),(0,-.035,.18),CANVAS,bevel=.018,parent=r)
tube('barrel',(0,-.05,.18),(0,-.24,.18),.035,STEEL,r)
torus('trigger_guard',(0,-.047,.095),.031,.006,STEEL,r,rot=(0,math.pi/2,0))
cyl('rope_spool',.079,.14,(0,.067,.22),WOOD,verts=12,rot=(0,math.pi/2,0),bevel=.003,parent=r)
for x in (-.045,-.022,0,.022,.045):torus('wound_rope',(x,.067,.22),.066,.011,STRAW,r,rot=(0,math.pi/2,0))
# The head is stowed above the launcher, pointed along its barrel.
hr=root('stowed_hook');hr.parent=r;hook(hr,size=.55);hr.rotation_euler.z=-math.pi/2;hr.location=(0,-.08,.28)
r.location.z=-GRIP['GrappleHook'];finish('GrappleHook',r,floor=False)

r=begin('GoldScale');X,Y=1.60,.70
for dx in (-.23,.23):
    for dy in (-.18,.18):box('table_leg',(.052,.052,.48),(X+dx,Y+dy,.24),WOOD,bevel=.004,parent=r)
box('tabletop',(.62,.50,.045),(X,Y,.5025),WOOD,bevel=.007,parent=r)
box('scale_base',(.29,.23,.048),(X,Y,.55),DARK,bevel=.012,parent=r)
cyl('brass_mast',.025,.42,(X,Y,.775),BRASS,verts=10,bevel=.004,parent=r)
lump('finial',(X,Y,1.008),(.045,.035,.045),BRASS,r)
tube('balance_beam',(X-.25,Y,.972),(X+.25,Y,.972),.018,BRASS,r)
tube('pointer',(X,Y-.027,.97),(X,Y-.027,.84),.006,RED,r,tip=.001)
for s in (-1,1):
    cx=X+s*.24
    # Open bowls with annular walls, no opaque caps across their mouth.
    cyl('pan_bottom',.073,.008,(cx,Y,.728),BRASS,verts=16,bevel=0,parent=r)
    vs=[(cx+rr*math.cos(k*math.tau/16),Y+rr*math.sin(k*math.tau/16),z) for rr,z in ((.073,.731),(.118,.77)) for k in range(16)]
    fs=[(k,(k+1)%16,16+(k+1)%16,16+k) for k in range(16)]
    o=pipe_mesh('balance_bowl',vs,fs,mat(*BRASS),r);o.modifiers.new('bowl_thickness','SOLIDIFY').thickness=.003
    for k in range(3):
        a=k*math.tau/3;tube('pan_chain',(cx,Y,.97),(cx+.112*math.cos(a),Y+.112*math.sin(a),.772),.0035,DARK,r,sides=5)
for k in range(3):cyl('scale_weight',.018+.008*k,.045,(X-.08+k*.07,Y-.18,.548),BRASS,verts=8,bevel=.003,parent=r)
finish('GoldScale',r,elev=24,azim=-20)

r=begin('PipePump')
# First run outside the -1.9 socket; a continuous, unobstructed clear bore.
hollow_path('pump_clear_bore',[(-2.58,0,.24),(-1.96,0,.24)],parent=r)
for x in (-2.47,-2.12):ring_x('pump_housing',x,.07,.176,.121,STEEL,r)
box('pump_mount',(.64,.49,.06),(-2.29,.075,.03),DARK,bevel=.01,parent=r)
box('motor_pedestal',(.27,.13,.13),(-2.29,.24,.115),STEEL,bevel=.008,parent=r)
cyl('olive_motor',.10,.32,(-2.29,.25,.26),CANVAS,verts=12,rot=(0,math.pi/2,0),bevel=.006,parent=r)
for x in (-2.39,-2.34,-2.29,-2.24,-2.19):ring_x('cooling_fin',x,.012,.112,.097,DARK,r,y=.25,z=.26)
box('drive_link',(.12,.21,.075),(-2.29,.12,.25),STEEL,bevel=.006,parent=r)
tube('gauge_stem',(-2.12,0,.40),(-2.12,0,.52),.014,BRASS,r)
cyl('gauge_case',.074,.04,(-2.12,-.013,.55),STEEL,verts=16,rot=(math.pi/2,0,0),bevel=.003,parent=r)
cyl('gauge_face',.064,.006,(-2.12,-.036,.55),CREAM,verts=16,rot=(math.pi/2,0,0),bevel=0,parent=r)
for k in range(7):
    a=-.1+k*math.pi/6;dx,dz=.051*math.cos(a),.051*math.sin(a)
    tube('gauge_tick',(-2.12+dx,-.041,.55+dz),(-2.12+dx*.82,-.041,.55+dz*.82),.002,DARK,r,sides=4)
tube('pressure_needle',(-2.12,-.044,.55),(-2.149,-.044,.581),.003,RED,r)
finish('PipePump',r,elev=28)

r=begin('PipeSectionSteel')
hollow_path('reinforced_clear_wall',[(0,0,.24),(1,0,.24)],parent=r)
# End bands remain only 6.6 cm long even at maximum 5.5x stretch. Exact outer radius .12.
for x in (.006,.994):ring_x('steel_end_band',x,.012,.12,.108,STEEL,r)
for a in (0,math.pi):
    # Thin longitudinal ribs preserve proportions across X stretching.
    y=.117*math.cos(a);z=.24+.117*math.sin(a)
    box('steel_longitudinal_rib',(1,.006,.006),(.5,y,z),STEEL,bevel=0,parent=r)
finish('PipeSectionSteel',r)
r.scale.x=5.5;preview('PipeSectionSteel-stretched');r.scale.x=1
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'upgrades-props.blend'),compress=True)
