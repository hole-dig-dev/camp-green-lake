"""art/blender/machines.py : the Company's machines, the excavator and the dump truck (public/js/87-excavator.js).

Modelled here from scratch, in the camp's chunky flat-shaded style (2026-11-10). Poly Pizza has no excavator (its one
dump truck is CC-BY but a single mesh); the game has to swing the turret, raise the boom, fold the stick, curl the bucket
and tip the bed, so every moving part here is its own node with its origin on its hinge:

  Excavator  Hull (tracks, rollers, slew ring) > Upper (turret: deck, engine, counterweight; turns about Y)
               > Cab (hidden from the cab view), Boom (pivots at the shoulder) > Stick (at the elbow) > Bucket (at the
               wrist) > BucketFill; BoomRamA / StickRamA (cylinder barrels) and BoomRamB / StickRamB (their rods), which
               the game turns to meet each other.
  DumpTruck  Body (chassis, cab) > WheelF_L/R, WheelR1_L/R, WheelR2_L/R (origins on the axles), Bed (pivots at the rear
               hinge) > BedFill.
Every node has no rotation of its own at rest: the arm lies straight out along the machine's forward, the bed down.
The game sets rotation.x / rotation.y on them; the numbers it needs (pivots, lengths, the teeth) are printed at the end
and copied into 87-excavator.js (EXC_* and DUMP_* constants).

Coordinates below are the GAME's (x: the machine's left, y: up, z: forward, metres, origin on the ground under its
middle); P() turns them into Blender's (x, -z, y), and the glTF export (+Y up) turns that back into the game's.
Colours are sRGB hex, written as linear factors (the game's loader converts back). Flat shaded, no textures.
Palette: Company machinery in worn yellow-orange 0xd9902a, dark steel 0x3a3833, warm charcoal tracks and tyres
0x2b2724, pale glass, rust accents.

Run:  ~/blender/blender -b --factory-startup --python art/blender/machines.py
"""
import bpy, bmesh, os, math
from mathutils import Vector, Matrix
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'public', 'models')

def lin(c): return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
def hex_lin(h): return tuple(lin(((h >> s) & 255) / 255) for s in (16, 8, 0)) + (1.0,)
MATS = {}
def mat(name, hexc, rough=0.85):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new('cgl_mach_' + name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = hex_lin(hexc); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0.0
    MATS[name] = m; return m
YEL = 'yellow'; STEEL = 'steel'; TRACK = 'track'; GLASS = 'glass'; RUST = 'rust'; SAND = 'sand'; LAMP = 'lamp'; PIN = 'pin'; AMBER = 'amber'; YEL2 = 'yellow2'
def palette():
    mat(YEL, 0xd9902a, 0.8); mat(YEL2, 0xc27c22, 0.85); mat(STEEL, 0x3a3833, 0.7); mat(TRACK, 0x2b2724, 0.95); mat(GLASS, 0xbfd6dc, 0.25)
    mat(RUST, 0x8a4a2a, 0.9); mat(SAND, 0xd2a064, 0.97); mat(LAMP, 0xfff0c4, 0.4); mat(PIN, 0x8d8a80, 0.55); mat(AMBER, 0xd97a2a, 0.6)

def P(x, y, z): return (x, -z, y)   # game -> Blender

class Node:
    """one moving part: a bmesh built in game coordinates, its pivot, its materials"""
    def __init__(self, name, pivot=(0, 0, 0)):
        self.name = name; self.pivot = Vector(pivot); self.bm = bmesh.new(); self.mats = []
    def mi(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)
    def prism(self, pts, axis, a0, a1, m):
        """a 2D outline extruded along a game axis. axis 'x': pts are (z, y); 'y': (x, z); 'z': (x, y)"""
        def V(u, v, a):
            g = (a, v, u) if axis == 'x' else (u, a, v) if axis == 'y' else (u, v, a)
            return self.bm.verts.new(P(*g))
        lo = [V(u, v, a0) for u, v in pts]; hi = [V(u, v, a1) for u, v in pts]; k = self.mi(m); fs = []
        fs.append(self.bm.faces.new(lo)); fs.append(self.bm.faces.new(hi[::-1]))
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n; fs.append(self.bm.faces.new((lo[i], hi[i], hi[j], lo[j])))
        for f in fs: f.material_index = k
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs
    def box(self, x0, x1, y0, y1, z0, z1, m, ch=0.0):
        """an axis-aligned box (game coords); ch chamfers its four edges along x"""
        c = min(ch, (y1 - y0) / 3, (z1 - z0) / 3)
        pts = [(z0, y0), (z1, y0), (z1, y1), (z0, y1)] if c <= 0 else \
            [(z0 + c, y0), (z1 - c, y0), (z1, y0 + c), (z1, y1 - c), (z1 - c, y1), (z0 + c, y1), (z0, y1 - c), (z0, y0 + c)]
        return self.prism(pts, 'x', x0, x1, m)
    def cyl(self, axis, cu, cv, r, a0, a1, m, n=10, rv=None):
        """a cylinder along a game axis, its middle at (cu, cv) in that axis' outline plane"""
        rv = rv or r
        pts = [(cu + r * math.cos(2 * math.pi * i / n + math.pi / n), cv + rv * math.sin(2 * math.pi * i / n + math.pi / n)) for i in range(n)]
        return self.prism(pts, axis, a0, a1, m)
    def build(self, parent=None):
        me = bpy.data.meshes.new(self.name + 'Mesh')   # not the node's own name: three's loader would rename the node to keep names unique
        piv = Vector(P(*self.pivot))
        for v in self.bm.verts: v.co -= piv
        self.bm.to_mesh(me); self.bm.free()
        for m in self.mats: me.materials.append(MATS[m])
        for p in me.polygons: p.use_smooth = False
        ob = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(ob)
        ob.location = piv - (Vector(P(*parent.pivot_world)) if parent else Vector((0, 0, 0)))
        if parent: ob.parent = parent.ob
        self.ob = ob; self.pivot_world = tuple(self.pivot)
        return self

def stadium(z0, z1, y0, y1, n=6):
    r = (y1 - y0) / 2; cy = (y0 + y1) / 2; pts = []
    for i in range(n + 1): a = -math.pi / 2 + math.pi * i / n; pts.append((z1 - r + r * math.cos(a), cy + r * math.sin(a)))
    for i in range(n + 1): a = math.pi / 2 + math.pi * i / n; pts.append((z0 + r + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def ram_pair(name_a, name_b, piv_a, piv_b, xs, r_barrel, r_rod, length):
    """a hydraulic cylinder in two nodes: the barrel (origin on its pin, pointing +z) and the rod (origin on its pin,
    pointing -z, back at the barrel). The game turns each to face the other's pin."""
    A = Node(name_a, piv_a); B = Node(name_b, piv_b)
    for x in xs:
        A.cyl('z', piv_a[0] + x, piv_a[1], r_barrel, piv_a[2] - 0.08, piv_a[2] + length, YEL2, n=8)
        A.cyl('x', piv_a[2], piv_a[1], r_barrel * 0.9, piv_a[0] + x - r_barrel - 0.02, piv_a[0] + x + r_barrel + 0.02, STEEL, n=8)   # the pin's eye
        B.cyl('z', piv_b[0] + x, piv_b[1], r_rod, piv_b[2] - length, piv_b[2] + 0.06, PIN, n=8)
        B.cyl('x', piv_b[2], piv_b[1], r_rod * 1.5, piv_b[0] + x - r_rod * 1.5, piv_b[0] + x + r_rod * 1.5, STEEL, n=8)
    return A, B

# ======================================================================================================== excavator
# the numbers the game copies (87-excavator.js)
SHOULDER = (-0.3, 1.55, 0.95)          # the boom's foot pin, on the turret (relative to the machine's origin)
SLEW_Y = 1.0                           # the top of the slew ring: the turret's origin
BOOM_L, STICK_L, TEETH = 3.9, 2.4, 1.12
BOOM_RAM = ((-0.3, 1.15, 1.18), (0, -0.14, 1.7), 0.28)  # barrel pin on the turret, rod pin on the boom (boom-local y, z), x spread
STICK_RAM = ((0, 0.86, 2.0), (0, 0.85, -0.15))          # barrel pin on the boom (boom-local), rod pin on the stick's heel (stick-local)
CAB_SEAT, CAB_EYE = (0.68, 1.78, 0.42), (0.68, 2.45, 0.55)

def excavator():
    root = bpy.data.objects.new('Excavator', None); bpy.context.scene.collection.objects.link(root)
    class R: pivot_world = (0, 0, 0); ob = root
    # ---- Hull: two track loops, rollers and sprockets on their outer faces, the frame between, the slew ring
    H = Node('Hull')
    for s in (1, -1):
        x0, x1 = sorted((s * 0.6, s * 1.24))
        H.prism(stadium(-1.9, 1.9, 0.04, 0.86, 7), 'x', x0, x1, TRACK)
        for k in range(15): z = -1.42 + k * 0.2; H.box(x0 + 0.02, x1 - 0.02, 0.85, 0.9, z - 0.05, z + 0.05, TRACK)   # grousers on the top run
        xo = s * 1.24; xa, xb = sorted((xo, xo + s * 0.04))
        for z in (-1.0, -0.5, 0.0, 0.5, 1.0): H.cyl('x', z, 0.28, 0.14, xa, xb, STEEL, n=8)
        H.cyl('x', -1.48, 0.45, 0.34, xa, xb, STEEL, n=10); H.cyl('x', -1.48, 0.45, 0.12, xb - s * 0.0 if s > 0 else xa, xb + 0.03 if s > 0 else xa - 0.03, RUST, n=6)   # sprocket
        H.cyl('x', 1.5, 0.45, 0.31, xa, xb, STEEL, n=10)   # idler
        xi0, xi1 = sorted((s * 0.58, s * 0.62)); H.box(xi0, xi1, 0.32, 0.62, -1.25, 1.25, STEEL)
    H.box(-0.6, 0.6, 0.3, 0.72, -1.15, 1.15, STEEL, ch=0.08)
    H.cyl('y', 0, 0, 0.82, 0.72, SLEW_Y, STEEL, n=14)
    H.build(R)
    # ---- Upper (the turret): deck, counterweight, engine house, toolbox, boom foot brackets
    U = Node('Upper', (0, SLEW_Y, 0))
    U.box(-1.2, 1.2, 1.0, 1.3, -1.35, 1.0, YEL, ch=0.06)
    U.prism([(-1.15, 1.0), (-1.55, 1.0), (-1.72, 1.25), (-1.72, 1.78), (-1.55, 2.02), (-1.15, 2.06)], 'x', -1.2, 1.2, YEL)   # counterweight
    U.box(-1.21, 1.21, 1.34, 1.42, -1.73, -1.5, RUST)   # a worn band round the counterweight
    U.prism([(-1.2, 1.3), (0.0, 1.3), (0.0, 1.86), (-0.15, 2.02), (-1.05, 2.02), (-1.2, 1.86)], 'x', -1.15, 0.12, YEL)   # engine house
    U.box(-1.17, -1.15, 1.45, 1.86, -1.0, -0.3, STEEL)   # its vents
    for k in range(4): z = -0.92 + k * 0.18; U.box(-1.18, -1.16, 1.5, 1.82, z, z + 0.06, YEL2)
    U.cyl('y', -0.75, -0.55, 0.065, 2.0, 2.5, STEEL, n=8); U.cyl('y', -0.75, -0.55, 0.08, 2.5, 2.56, RUST, n=8)   # exhaust stack
    U.box(-1.15, -0.62, 1.3, 1.78, 0.12, 0.95, YEL, ch=0.04)   # toolbox, right front
    U.box(-1.0, -0.75, 1.78, 1.82, 0.3, 0.8, STEEL)
    for x in (-0.55, -0.1): U.prism([(0.45, 1.3), (1.12, 1.3), (1.12, 1.62), (0.82, 1.82)], 'x', x, x + 0.05, STEEL)   # boom foot brackets
    U.box(-0.66, 0.06, 1.04, 1.28, 0.92, 1.3, STEEL, ch=0.04)   # boom ram lugs
    U.cyl('x', SHOULDER[2], SHOULDER[1], 0.11, -0.6, 0.0, PIN, n=8)   # the shoulder pin
    for x in (-1.12, 1.12):
        xa, xb = sorted((x, x + (0.06 if x > 0 else -0.06)))
        U.box(xa, xb, 1.3, 1.36, -1.3, 0.95, STEEL)   # deck edge trim
    U.build(H)
    # ---- Cab (left front): lower panel, glass, pillars, roof, work lamps. Hidden while you look out of it.
    C = Node('Cab', (0.68, 1.3, 0.45))
    C.box(0.2, 1.16, 1.3, 1.72, -0.06, 1.04, YEL, ch=0.03)
    C.prism([(0.0, 1.72), (1.0, 1.72), (0.9, 2.82), (0.0, 2.82)], 'x', 0.25, 1.11, GLASS)
    for x0, x1 in ((0.2, 0.27), (1.09, 1.16)):
        C.prism([(0.96, 1.72), (1.04, 1.72), (0.95, 2.85), (0.87, 2.85)], 'x', x0, x1, STEEL)   # front pillars, raked
        C.box(x0, x1, 1.72, 2.85, -0.06, 0.02, STEEL)                                           # back pillars
        C.box(x0, x1, 1.72, 2.85, 0.36, 0.42, STEEL)                                            # door pillar
        C.box(x0, x1, 2.05, 2.1, -0.06, 0.98, STEEL)                                            # window bar
    C.box(0.16, 1.2, 2.82, 2.96, -0.1, 1.02, YEL, ch=0.03)   # roof
    for x in (0.35, 1.0): C.box(x - 0.07, x + 0.07, 2.96, 3.06, 0.86, 0.98, LAMP)   # work lamps
    C.box(0.95, 1.05, 2.96, 3.1, 0.0, 0.1, AMBER)   # beacon
    C.box(0.5, 0.86, 1.72, 2.0, 0.05, 0.4, STEEL)   # the seat back (seen through the glass)
    C.build(U)
    # ---- Boom: a banana from the shoulder to the elbow, lugs for its rams
    B = Node('Boom', SHOULDER); sx, sy, sz = SHOULDER
    prof = [(-0.22, -0.16), (0.55, -0.27), (2.1, 0.12), (3.75, -0.18), (4.08, -0.08), (4.08, 0.12), (3.6, 0.24), (2.25, 0.62), (0.5, 0.27), (-0.22, 0.18)]
    B.prism([(sz + u, sy + v) for u, v in prof], 'x', sx - 0.2, sx + 0.2, YEL)
    B.box(sx - 0.21, sx + 0.21, sy + 0.3, sy + 0.42, sz + 1.0, sz + 1.6, RUST)   # paint worn off along the top
    (bx0, by0, bz0), (_, bry, brz), spread = BOOM_RAM
    for x in (-1, 1): xa, xb = sorted((sx + x * (spread - 0.07), sx + x * (spread + 0.07))); B.box(xa, xb, sy + bry - 0.1, sy + bry + 0.18, sz + brz - 0.16, sz + brz + 0.16, STEEL)
    _, sry, srz = STICK_RAM[0]; B.box(sx - 0.13, sx + 0.13, sy + 0.5, sy + sry + 0.08, sz + srz - 0.18, sz + srz + 0.18, STEEL)
    B.cyl('x', sz, sy, 0.21, sx - 0.24, sx + 0.24, STEEL, n=10); B.cyl('x', sz + BOOM_L, sy, 0.19, sx - 0.24, sx + 0.24, STEEL, n=10)
    B.build(U)
    # ---- Stick: from the elbow out, its heel up where the stick ram pulls
    S = Node('Stick', (sx, sy, sz + BOOM_L)); ex, ey, ez = S.pivot
    _, hy, hz = STICK_RAM[1]
    prof = [(-0.3, -0.2), (STICK_L + 0.05, -0.13), (STICK_L + 0.05, 0.13), (0.45, 0.22), (hz + 0.12, hy + 0.08), (hz - 0.14, hy + 0.06), (-0.38, 0.1)]
    S.prism([(ez + u, ey + v) for u, v in prof], 'x', ex - 0.16, ex + 0.16, YEL)
    S.box(ex - 0.17, ex + 0.17, ey - 0.2, ey - 0.12, ez + 0.6, ez + 1.9, RUST)
    S.cyl('x', ez + STICK_L, ey, 0.15, ex - 0.2, ex + 0.2, STEEL, n=10)
    S.cyl('x', ez + hz, ey + hy, 0.1, ex - 0.18, ex + 0.18, STEEL, n=8)
    S.build(B)
    # ---- Bucket: pivot at the wrist, teeth TEETH out along +z; the shell bulges up (+y) of the pivot-teeth line, the
    #      open mouth is that line (facing -y): curled in, the mouth faces the sky and holds the load
    K = Node('Bucket', (ex, ey, ez + STICK_L)); kx, ky, kz = K.pivot
    arc = [(0.02, 0.2), (0.18, 0.46), (0.5, 0.6), (0.82, 0.46), (0.98, 0.14), (1.02, 0.02)]
    side = [(0.0, -0.04)] + arc + [(1.0, -0.04)]
    for x in (-0.47, 0.44): K.prism([(kz + u, ky + v) for u, v in side], 'x', kx + x, kx + x + 0.03, YEL)
    for i in range(len(arc) - 1):
        (u0, v0), (u1, v1) = arc[i], arc[i + 1]; d = math.hypot(u1 - u0, v1 - v0); nu, nv = -(v1 - v0) / d * 0.05, (u1 - u0) / d * 0.05
        K.prism([(kz + u0, ky + v0), (kz + u1, ky + v1), (kz + u1 + nu, ky + v1 + nv), (kz + u0 + nu, ky + v0 + nv)], 'x', kx - 0.45, kx + 0.45, YEL)   # the shell
        K.prism([(kz + u0, ky + v0), (kz + u1, ky + v1), (kz + u1 - nu * 0.5, ky + v1 - nv * 0.5), (kz + u0 - nu * 0.5, ky + v0 - nv * 0.5)], 'x', kx - 0.44, kx + 0.44, RUST)   # worn inside
    K.box(kx - 0.48, kx + 0.48, ky - 0.05, ky + 0.07, kz + 0.86, kz + 1.03, STEEL)   # cutting edge
    for i in range(5):
        x = kx - 0.36 + i * 0.18
        K.prism([(kz + 0.98, ky - 0.04), (kz + TEETH, ky + 0.0), (kz + 0.98, ky + 0.07)], 'x', x - 0.05, x + 0.05, STEEL)
    for x in (-0.12, 0.09): K.prism([(kz - 0.12, ky - 0.1), (kz + 0.2, ky + 0.0), (kz + 0.25, ky + 0.35), (kz - 0.05, ky + 0.25)], 'x', kx + x, kx + x + 0.03, STEEL)   # linkage ears
    K.build(S)
    F = Node('BucketFill', (kx, ky + 0.16, kz + 0.52))
    F.cyl('x', kz + 0.52, ky + 0.16, 0.42, kx - 0.4, kx + 0.4, SAND, n=7, rv=0.3)
    F.build(K)
    # ---- the rams
    A, Rb = ram_pair('BoomRamA', 'BoomRamB', BOOM_RAM[0], (sx, sy + BOOM_RAM[1][1], sz + BOOM_RAM[1][2]), (-spread, spread), 0.1, 0.055, 1.25)
    A.build(U); Rb.build(B)
    A2, R2 = ram_pair('StickRamA', 'StickRamB', (sx, sy + STICK_RAM[0][1], sz + STICK_RAM[0][2]), (ex, ey + hy, ez + hz), (0,), 0.09, 0.05, 1.5)
    A2.build(B); R2.build(S)
    return root

# ======================================================================================================== dump truck
WHEEL_R = 0.55
WHEELS = {'WheelF_L': (1.02, 2.75, 0.36), 'WheelF_R': (-1.02, 2.75, 0.36), 'WheelR1_L': (0.98, -1.2, 0.5), 'WheelR1_R': (-0.98, -1.2, 0.5),
          'WheelR2_L': (0.98, -2.42, 0.5), 'WheelR2_R': (-0.98, -2.42, 0.5)}   # x, z, tyre width
BED_HINGE = (0, 1.32, -3.2)
BED_Z0, BED_Z1, BED_WALL = -0.25, 5.05, 1.15   # the bed in its own frame (from the hinge, forward) and its walls' height

def dumptruck():
    root = bpy.data.objects.new('DumpTruck', None); bpy.context.scene.collection.objects.link(root)
    class R: pivot_world = (0, 0, 0); ob = root
    D = Node('Body')
    for x in (-0.62, 0.44): D.box(x, x + 0.18, 0.72, 1.05, -3.45, 3.4, STEEL)   # chassis rails
    D.box(-0.6, 0.6, 1.05, 1.28, -3.25, 1.95, STEEL)   # sub-frame under the bed
    for x in (-0.55, 0.4): D.box(x, x + 0.15, 1.0, 1.36, -3.35, -3.05, STEEL)   # the bed's hinge brackets
    D.box(-1.25, 1.25, 0.5, 0.86, 3.72, 3.98, STEEL, ch=0.05)   # front bumper
    D.prism([(1.98, 1.2), (3.74, 1.2), (3.8, 1.95), (3.62, 2.9), (3.42, 3.05), (1.98, 3.05)], 'x', -1.2, 1.2, YEL)   # cab
    D.prism([(3.66, 2.04), (3.76, 2.04), (3.6, 2.82), (3.5, 2.82)], 'x', -1.04, 1.04, GLASS)   # windscreen
    for x0 in (-1.23, 1.2): D.box(x0, x0 + 0.03, 2.1, 2.84, 2.35, 3.38, GLASS)   # side windows
    D.box(-0.82, 0.82, 1.25, 1.78, 3.76, 3.84, STEEL)   # grille
    for x in (-0.95, 0.95): D.box(x - 0.16, x + 0.16, 1.45, 1.66, 3.78, 3.86, LAMP)   # headlamps
    D.box(-0.18, 0.18, 3.05, 3.2, 2.5, 2.75, AMBER)   # roof beacon
    D.box(-1.21, 1.21, 1.62, 1.72, 1.98, 3.78, RUST)   # a worn band round the cab
    for x in (1.0, -1.0):
        xa, xb = sorted((x * 0.85, x * 1.32)); D.box(xa, xb, 1.12, 1.24, 2.05, 3.45, STEEL)   # front wings
        xa, xb = sorted((x * 0.75, x * 1.28)); D.box(xa, xb, 1.12, 1.2, -2.95, -0.65, STEEL)  # rear wings
        xa, xb = sorted((x * 0.8, x * 1.25)); D.box(xa, xb, 0.25, 1.1, -3.12, -3.06, TRACK)  # mud flaps
    D.cyl('z', -0.92, 0.78, 0.26, 0.55, 1.65, STEEL, n=10)   # fuel tank
    D.box(0.7, 1.15, 0.6, 1.05, 0.6, 1.5, YEL, ch=0.04)       # tool box
    D.cyl('y', 1.02, 1.82, 0.07, 1.2, 3.3, STEEL, n=8); D.cyl('y', 1.02, 1.82, 0.085, 3.3, 3.36, RUST, n=8)   # exhaust stack
    D.build(R)
    for name, (x, z, w) in WHEELS.items():
        W = Node(name, (x, WHEEL_R, z)); xa, xb = sorted((x - w / 2, x + w / 2)); out = 1 if x > 0 else -1
        W.cyl('x', z, WHEEL_R, WHEEL_R, xa, xb, TRACK, n=12)
        ha, hb = sorted((x + out * w / 2, x + out * (w / 2 + 0.03))); W.cyl('x', z, WHEEL_R, 0.27, ha, hb, STEEL, n=8)
        ha, hb = sorted((x + out * (w / 2 + 0.03), x + out * (w / 2 + 0.06))); W.cyl('x', z, WHEEL_R, 0.1, ha, hb, RUST, n=6)
        W.build(D)
    hx, hy, hz = BED_HINGE; Bd = Node('Bed', BED_HINGE)
    Bd.box(-1.22, 1.22, hy - 0.06, hy + 0.1, hz + BED_Z0, hz + BED_Z1, STEEL)   # floor
    for s in (1, -1):
        xa, xb = sorted((s * 1.1, s * 1.24)); Bd.box(xa, xb, hy + 0.1, hy + BED_WALL, hz + BED_Z0, hz + BED_Z1, YEL)   # side walls
        xa, xb = sorted((s * 1.24, s * 1.3)); Bd.box(xa, xb, hy + BED_WALL - 0.12, hy + BED_WALL, hz + BED_Z0, hz + BED_Z1, YEL2)   # top rail
        for k in range(5): z = hz + BED_Z0 + 0.35 + k * 1.15; Bd.box(xa, xb, hy + 0.1, hy + BED_WALL - 0.12, z - 0.06, z + 0.06, YEL2)   # ribs
        xa, xb = sorted((s * 1.245, s * 1.255)); Bd.box(xa, xb, hy + 0.2, hy + 0.36, hz + 0.6, hz + 3.6, RUST)
    Bd.box(-1.24, 1.24, hy + 0.1, hy + BED_WALL + 0.35, hz + BED_Z1 - 0.14, hz + BED_Z1, YEL)   # headboard
    Bd.box(-1.24, 1.24, hy + BED_WALL + 0.25, hy + BED_WALL + 0.35, hz + BED_Z1, hz + BED_Z1 + 0.45, YEL2)   # its lip
    Bd.box(-1.1, 1.1, hy + 0.1, hy + BED_WALL - 0.05, hz + BED_Z0, hz + BED_Z0 + 0.1, YEL2)   # tailgate
    Bd.build(D)
    Fz = hz + (BED_Z0 + BED_Z1) / 2
    Fl = Node('BedFill', (0, hy + 0.1, Fz))
    Fl.prism([(Fz - 2.5, hy + 0.1), (Fz + 2.5, hy + 0.1), (Fz + 1.9, hy + 0.75), (Fz + 0.7, hy + 1.05), (Fz - 0.7, hy + 1.05), (Fz - 1.9, hy + 0.75)], 'x', -1.08, 1.08, SAND)
    Fl.build(Bd)
    return root

def export(root, name):
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for c in o.children: sel(c)
    sel(root); bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(os.path.join(OUT, name + '.glb')), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_animations=False)

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
palette()
ex = excavator(); export(ex, 'Excavator')
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
dt = dumptruck(); export(dt, 'DumpTruck')
print('EXC shoulder', SHOULDER, 'boom', BOOM_L, 'stick', STICK_L, 'teeth', TEETH, 'boomRam', BOOM_RAM, 'stickRam', STICK_RAM, 'seat', CAB_SEAT, 'eye', CAB_EYE)
print('DUMP hinge', BED_HINGE, 'bed z', BED_HINGE[2] + BED_Z0, '..', BED_HINGE[2] + BED_Z1, 'top', BED_HINGE[1] + BED_WALL, 'wheels', WHEELS, 'r', WHEEL_R)
