# blend: gear.blend
"""Sand pipeline art; background Blender; exports are +Y-up GLB.
Only PipeSection stretches X. Origins sit at ground Z=0, including PipeSlug;
the sand's axis is Z=0.24. The sifter inlet is built in sifter.py.
"""
import bpy, os, math, random, shutil
HERE = os.path.dirname(bpy.data.filepath)
globals()['__file__'] = os.path.join(HERE, 'pipe.py')
exec(open(os.path.join(HERE, 'cgl_blender.py')).read())
exec(open(os.path.join(HERE, 'pipeline_common.py')).read())
OUT = os.path.join(ART, 'glb')
PUBLIC = os.path.abspath(os.path.join(ART, '../../public/models'))
rnd = random.Random(51249)
IRON = ('pipe_iron', (64, 70, 67), 0.65, 0.3)
BOLT = ('pipe_bolt', (169, 158, 131), 0.6, 0.35)
WOOD = ('pipe_wood', (138, 104, 70), 0.88, 0)
DARKWOOD = ('pipe_darkwood', (93, 68, 45), 0.9, 0)
YELLOW = ('pipe_warning', (244, 190, 47), 0.75, 0)
RED = ('pipe_break_red', (191, 53, 32), 0.8, 0)
INK = ('pipe_ink', (36, 30, 24), 0.85, 0)
SEAM = ('pipe_seam', (126, 177, 183), 0.38, 0)
SHARD = ('pipe_shard', (126, 177, 183), 0.38, 0)
SANDS = [('pipe_sand'+str(i), c, 0.96, 0) for i, c in enumerate(
    [(201, 168, 114), (218, 186, 136), (177, 143, 94), (231, 201, 151)])]


def B(n, size, loc, m, rot=(0, 0, 0), bv=0.007):
    return box(n, size, loc, m, rot=rot, bevel=bv, parent=ROOT)


def lump(n, loc, scale, material, subdiv=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1, location=loc)
    o = bpy.context.active_object
    o.name, o.scale = n, scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, material, 0, ROOT)


def begin(name):
    global ROOT
    scene(name)
    ROOT = root(name)


def finish(name, elev=24, azim=-48):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = 720, 600
    studio(elev=elev, azim=azim, lens=52, floor=True)
    bpy.context.view_layer.update()
    frame(margin=1.25)
    render(res=(720, 600), samples=32)
    p = pipeline_export(os.path.join(OUT, name+'.glb'), ROOT)
    shutil.copy2(p[0], PUBLIC)
    print(name, 'bytes/materials:', p[1:])


begin('PipeSection')
hollow_path('clear_wall', [(0, 0, PIPE_AXIS), (1, 0, PIPE_AXIS)], parent=ROOT)
# Longitudinal seams stay thin when X stretches to 5.5 m. No end bands.
for a in (math.pi*0.27, math.pi*1.27):
    y, z = math.cos(a)*0.1203, PIPE_AXIS+math.sin(a)*0.1203
    B('extrusion_seam', (1, 0.002, 0.002), (0.5, y, z), SEAM, bv=0)
finish('PipeSection')

begin('PipeJoint')
hollow_path('clear_sleeve', [(-0.13, 0, PIPE_AXIS), (0.13, 0, PIPE_AXIS)],
            0.129, PIPE_BORE, parent=ROOT)
for x in (-0.095, 0.095):
    ring_x('clamp_band', x, 0.025, 0.141, 0.127, IRON, ROOT)
    B('clamp_ear', (0.035, 0.07, 0.026), (x, 0, 0.396), IRON)
    cyl('clamp_bolt', 0.012, 0.088, (x, 0, 0.398), BOLT,
        verts=6, rot=(math.pi/2, 0, 0), bevel=0, parent=ROOT)
B('ground_sleeper', (0.32, 0.48, 0.065), (0, 0, 0.0325), DARKWOOD)
for y in (-0.11, 0.11):
    B('saddle_cheek', (0.23, 0.055, 0.08), (0, y, 0.10), WOOD,
      rot=(0.25 if y>0 else -0.25, 0, 0))
for y in (-0.195, 0.195):
    cyl('ground_pin', 0.018, 0.09, (0, y, 0.055), BOLT, verts=6, bevel=0, parent=ROOT)
finish('PipeJoint')

begin('PipeCrack')
for s in (-1, 1):
    offsets = [rnd.uniform(-0.05, 0.04) for _ in range(20)]
    hollow_path('shattered_half', [(s*0.50, 0, PIPE_AXIS), (s*0.105, 0, PIPE_AXIS)],
                parent=ROOT, ragged=offsets)
    ring_x('loose_clamp', s*0.35, 0.025, 0.139, 0.122, IRON, ROOT)
    for k in range(4):
        a = k*1.65+s*0.3
        y, z = math.cos(a)*0.11, PIPE_AXIS+math.sin(a)*0.11
        v = [(s*0.12, y-0.018, z), (s*0.15, y+0.021, z+0.012),
             (s*0.015, y+0.012, z+0.045), (s*0.12, y, z+0.007)]
        pipe_mesh('glass_splinter', v, [(0,1,2),(0,3,1),(1,3,2),(2,3,0)],
                  pipe_material(SHARD, 0.55), ROOT)
lump('spill_heap', (0, -0.08, 0.035), (0.46, 0.40, 0.095), SANDS[0], 2)
for k in range(32):
    a, d = rnd.random()*math.tau, rnd.uniform(0.03, 0.52)
    lump('spilled_clod', (math.cos(a)*d, math.sin(a)*d-0.08, 0.024),
         (rnd.uniform(0.025, 0.075), rnd.uniform(0.02, 0.05), rnd.uniform(0.018, 0.038)), rnd.choice(SANDS))
for k in range(7):
    lump('falling_sand', (rnd.uniform(-0.06,0.06), rnd.uniform(-0.035,0.035), 0.10+k*0.021),
         (0.022, 0.023, 0.019), rnd.choice(SANDS))
# Yellow/red pennant reads above the low pipe at crew distances.
B('repair_stake', (0.035, 0.035, 0.78), (0.10, 0.24, 0.39), DARKWOOD)
B('warning_board', (0.50, 0.035, 0.36), (0.10, 0.24, 0.74), YELLOW)
for y, rot in ((0.217, (math.pi/2,0,0)), (0.263, (math.pi/2,0,math.pi))):
    text('repair_label', 'FIX', (0.10,y,0.74), 0.24, RED, rot=rot, parent=ROOT)
for x in (-0.105, 0.305):
    B('hazard_stripe', (0.025, 0.042, 0.32), (x,0.24,0.74), INK, rot=(0,0.23,0), bv=0)
finish('PipeCrack')

begin('PipeSlug')
# Uneven, sloped noses at both ends, usable travelling in either X direction.
xs = [-0.45, -0.34, -0.26, -0.18, -0.10, -0.02, 0.08, 0.17, 0.26, 0.36, 0.45]
radii = [0.012, 0.055, 0.082, 0.060, 0.092, 0.073, 0.090, 0.061, 0.078, 0.042, 0.012]
verts, faces, N = [], [], 12
for x, rr in zip(xs, radii):
    for k in range(N):
        a, r = k*math.tau/N, rr*rnd.uniform(0.78, 1.0)
        verts.append((x, math.cos(a)*r, PIPE_AXIS+math.sin(a)*r-0.006))
for i in range(len(xs)-1):
    for k in range(N):
        j = (k+1)%N
        faces.append((i*N+k, i*N+j, (i+1)*N+j, (i+1)*N+k))
faces += [tuple(reversed(range(N))), tuple((len(xs)-1)*N+k for k in range(N))]
o = pipe_mesh('loose_sand_core', verts, faces, mat(*SANDS[0]), ROOT)
for m in SANDS[1:]: o.data.materials.append(mat(*m))
for p in o.data.polygons: p.material_index = rnd.choices(range(4), [6,2,2,1])[0]
for k in range(45):
    x, a, rr = rnd.uniform(-0.32, 0.32), rnd.random()*math.tau, 0.085
    lump('sand_granule', (x, math.cos(a)*rr, PIPE_AXIS+math.sin(a)*rr-0.006),
         (rnd.uniform(0.013,0.026), 0.010, 0.012), rnd.choice(SANDS))
finish('PipeSlug')

begin('PipeIntake')
# Four flared walls, open top and throat, clear lower hopper.
def hopper(name, bottom, top, z0, z1, material):
    verts = [(x*s,y*s,z) for s,z in ((bottom,z0),(top,z1),(bottom-0.012,z0),(top-0.012,z1))
             for x,y in ((-1,-1),(1,-1),(1,1),(-1,1))]
    faces = []
    for k in range(4):
        j = (k+1)%4
        faces += [(k,j,4+j,4+k),(8+j,8+k,12+k,12+j),
                  (4+k,4+j,12+j,12+k),(j,k,8+k,8+j)]
    pipe_mesh(name, verts, faces, material, ROOT)
hopper('clear_hopper', 0.112, 0.42, 0.58, 1.13, pipe_material(CLEAR,0.16))
hopper('galvanized_lip', 0.42, 0.47, 1.13, 1.22, mat(*BOLT))
for y in (-0.47,0.47): B('rim_rail', (0.98,0.032,0.032), (0,y,1.23), IRON)
for x in (-0.47,0.47): B('rim_rail', (0.032,0.91,0.032), (x,0,1.23), IRON)
for y in (-0.21,0.21): B('bucket_rest', (0.92,0.018,0.018), (0,y,1.235), IRON, bv=0.003)
# Exact socket (-0.35,0,0.24), leaving toward -X.
pts = [(-0.35,0,PIPE_AXIS),(-0.22,0,PIPE_AXIS)]
for k in range(1,9):
    a = -math.pi/2+k*math.pi/16
    pts.append((-0.22+0.22*math.cos(a),0,0.46+0.22*math.sin(a)))
pts.append((0,0,0.59))
hollow_path('clear_intake_elbow', pts, parent=ROOT)
ring_x('socket_clamp', -0.32, 0.04, 0.139, 0.121, IRON, ROOT)
for x in (-0.38,0.38):
    for y in (-0.38,0.38):
        B('leg', (0.055,0.055,1.08), (x,y,0.54), DARKWOOD)
        B('foot', (0.15,0.13,0.035), (x,y,0.0175), WOOD)
for y in (-0.38,0.38):
    B('cross_brace', (0.84,0.035,0.05), (0,y,0.38), WOOD, rot=(0,0.28 if y>0 else -0.28,0))
B('signpost', (0.045,0.045,0.36), (0.36,0.45,1.35), DARKWOOD)
B('sand_in_board', (0.74,0.038,0.23), (0,0.45,1.50), WOOD)
for y,rot in ((0.423,(math.pi/2,0,0)),(0.477,(math.pi/2,0,math.pi))):
    text('sand_in_letters','SAND IN',(0,y,1.5),0.15,INK,rot=rot,parent=ROOT)
finish('PipeIntake',elev=30)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
