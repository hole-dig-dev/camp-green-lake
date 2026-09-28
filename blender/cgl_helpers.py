# Shared helpers for building the Camp Green Lake character in Blender.
# Load inside Blender with: exec(open(r"C:\Users\jthol\Projects\camp-green-lake\blender\cgl_helpers.py").read())
import bpy, bmesh, math
from mathutils import Euler, Vector

D = math.radians
COL = None


def use_collection(name, clear=True):
    global COL
    scene = bpy.context.scene
    COL = bpy.data.collections.get(name)
    if COL is None:
        COL = bpy.data.collections.new(name)
        scene.collection.children.link(COL)
    elif clear:
        for o in list(COL.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    COL.hide_viewport = False
    return COL


def hide_collection(name):
    c = bpy.data.collections.get(name)
    if c:
        c.hide_viewport = True


def lin(hx):
    hx = hx.lstrip('#')
    c = [int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mat(name, hexc, rough=0.85):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    rgb = lin(hexc)
    m.diffuse_color = (*rgb, 1.0)
    try:
        if not m.use_nodes:
            m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    if nt:
        b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b is None:
            b = nt.nodes.new('ShaderNodeBsdfPrincipled')
            out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
            nt.links.new(b.outputs[0], out.inputs[0])
        for s in b.inputs:
            if s.identifier == 'Base Color':
                s.default_value = (*rgb, 1.0)
            elif s.identifier == 'Roughness':
                s.default_value = rough
    return m


OR = mat("CGL_Jumpsuit", "#E8742A")
ZIP = mat("CGL_Zipper", "#3B3B3B", 0.5)
PAT = mat("CGL_Patch", "#F1ECDD")
SKIN = mat("CGL_Skin", "#C68A5E", 0.7)
TXT = mat("CGL_Label", "#222222")
EYE = mat("CGL_Eye", "#1C1816", 0.25)
EYEW = mat("CGL_EyeWhite", "#F7F4EE", 0.35)
MOUTH = mat("CGL_Mouth", "#5A2620", 0.6)
BROW = mat("CGL_Brow", "#3A2517", 0.8)
TOOTH = mat("CGL_Tooth", "#FFFDF4", 0.4)


def bm_box(sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
    return bm


def ico(r=1.0, sub=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    return bm


def profile(h, r_fn, p=1.0, n=16):
    pts = []
    for i in range(n + 1):
        th = -math.pi / 2 + math.pi * i / n
        z = h * (math.sin(th) + 1) / 2
        c = max(0.0, math.cos(th))
        pts.append((0.0 if i in (0, n) else r_fn(z / h) * (c ** p), z))
    return pts


def lathe(pts, seg=20, sx=1.0, sy=1.0):
    bm = bmesh.new()
    rings = []
    angs = [2 * math.pi * j / seg - math.pi / 2 for j in range(seg)]
    for r, z in pts:
        rings.append(bm.verts.new((0, 0, z)) if r < 1e-6 else
                     [bm.verts.new((r * math.cos(a) * sx, r * math.sin(a) * sy, z)) for a in angs])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for j in range(seg):
            k = (j + 1) % seg
            if isinstance(A, list) and isinstance(B, list):
                bm.faces.new((A[j], A[k], B[k], B[j]))
            elif isinstance(B, list):
                bm.faces.new((A, B[k], B[j]))
            else:
                bm.faces.new((A[j], A[k], B))
    return bm


def arc_tube(R, t, a0, a1, n=12, rseg=6):
    """Curved tube in the XZ plane, centered on its bounding box. 180-360 deg = smile, 0-180 = frown."""
    bm = bmesh.new()
    rings = []
    for i in range(n + 1):
        a = D(a0 + (a1 - a0) * i / n)
        u = Vector((math.cos(a), 0, math.sin(a)))
        c = u * R
        rings.append([bm.verts.new(c + t * (math.cos(b) * u + math.sin(b) * Vector((0, 1, 0))))
                      for b in [2 * math.pi * k / rseg for k in range(rseg)]])
    for i in range(n):
        for k in range(rseg):
            bm.faces.new((rings[i][k], rings[i + 1][k], rings[i + 1][(k + 1) % rseg], rings[i][(k + 1) % rseg]))
    bm.faces.new(rings[0]); bm.faces.new(rings[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    zs = [v.co.z for v in bm.verts]; xs = [v.co.x for v in bm.verts]
    off = Vector(((max(xs) + min(xs)) / 2, 0, (max(zs) + min(zs)) / 2))
    for v in bm.verts:
        v.co -= off
    return bm


def mk(name, bm, m, parent, loc=(0, 0, 0), smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    o = bpy.data.objects.new(name, me)
    me.materials.append(m)
    COL.objects.link(o)
    o.parent = parent
    o.location = loc
    return o


def bevel(o, w, seg=4):
    b = o.modifiers.new("Bevel", 'BEVEL')
    b.width = w; b.segments = seg
    try:
        b.harden_normals = True
    except Exception:
        pass


def stick(name, bm, m, parent, body, x, z, thick, bev=0.0, extra=0.0, scale=None, roll=0.0):
    """Place a part on the front surface of `body` at (x, z) in parent space, facing along the surface normal."""
    bpy.context.view_layer.update()
    ML = body.matrix_local
    ok, loc, n, _ = body.ray_cast(ML.inverted() @ Vector((x, -5, z)), Vector((0, 1, 0)))
    loc = ML @ loc
    n = (ML.to_3x3() @ n).normalized()
    o = mk(name, bm, m, parent, loc + n * (thick / 2 - 0.004 + extra))
    q = n.to_track_quat('-Y', 'Z')
    if roll:
        q = q @ Euler((0, D(roll), 0)).to_quaternion()
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = q
    if scale:
        o.scale = scale
    if bev:
        bevel(o, bev, 2)
    return o


def root(name, x, y=0.0):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 0.3
    COL.objects.link(e)
    e.location = (x, y, 0)
    return e


def label(txt, x, y=0.0, prefix="Label_"):
    cu = bpy.data.curves.new(prefix + txt, 'FONT')
    cu.body = txt; cu.align_x = 'CENTER'; cu.size = 0.3; cu.extrude = 0.02
    cu.materials.append(TXT)
    o = bpy.data.objects.new(prefix + txt, cu)
    COL.objects.link(o)
    o.location = (x, y - 0.6, -0.45); o.rotation_euler = (D(90), 0, 0)
    return o


# ---- chosen torso: #14 (no collar flaps) ----
TW, TD, TH, TBX, TBEV = 0.71, 0.43, 1.08, 0.83, 0.125
HB = TH - 0.03 + 0.16 - 0.06  # head bottom


def torso(pre, r):
    bm = bm_box(TW, TD, TH)
    for v in bm.verts:
        if v.co.z < 0:
            v.co.x *= TBX
        v.co.z += TH / 2
    body = mk(pre + "Torso", bm, OR, r)
    bevel(body, TBEV, 5)
    s = TW / 0.9
    stick(pre + "Zipper", bm_box(0.035, 0.025, 0.6 * TH), ZIP, r, body, 0, 0.45 * TH, 0.025, 0.008)
    stick(pre + "Patch", bm_box(0.2 * s, 0.025, 0.13), PAT, r, body, 0.245 * TW, TH - 0.3, 0.025, 0.008)
    nr = 0.14 * (0.85 + 0.15 * s)
    mk(pre + "Neck", lathe([(0, 0), (nr, 0), (nr, 0.16), (0, 0.16)], seg=14), SKIN, r, (0, 0, TH - 0.03))
    return body


# ---- chosen head: H10 (tall rounded pill) ----
HEAD_H, HEAD_R, HEAD_P, HEAD_SY = 0.70, 0.30, 0.70, 0.90
EYE_Z = HB + HEAD_H * 0.56  # eye line


def head(pre, r):
    return mk(pre + "Head", lathe(profile(HEAD_H, lambda t: HEAD_R, p=HEAD_P), sy=HEAD_SY), SKIN, r, (0, 0, HB))


def button_nose(pre, r, h, scale=1.0, z=-0.10):
    """H10's nose: a short cone whose rounded base peeks out as a button."""
    nose = stick(pre + "Nose", lathe(profile(0.16, lambda t: 0.045 + 0.02 * t, p=0.8, n=10), seg=12), SKIN, r, h, 0, EYE_Z + z, 0.02)
    nose.rotation_quaternion = nose.rotation_quaternion @ Euler((D(-80), 0, 0)).to_quaternion()
    nose.scale = (scale,) * 3
    return nose


# ---- face library (chosen from the H10 face variants; numbers = original variant numbers) ----
FACE_BASE = dict(ex=0.09, ew=0.05, eh=0.06, bw=0.08, bt=0.022, bx=0.10, bz=0.07, broll=10,
                 mouth="arc", mR=0.06, mt=0.012, ma=(215, 325), mz=-0.20)
FACES = {
    "Original":        {},                                   # 1 (default)
    "TinyEyes":        dict(ew=0.035, eh=0.042),             # 5
    "TallOvalEyes":    dict(ew=0.045, eh=0.085),             # 6
    "ThickLongBrows":  dict(bw=0.12, bt=0.038, bx=0.105),    # 7
    "ThinShortBrows":  dict(bw=0.05, bt=0.013),              # 8
    "ThickShortBrows": dict(bw=0.065, bt=0.04),              # 9
    "ThinLongWorried": dict(bw=0.11, bt=0.014, broll=-12),   # 10
    "SmallMouth":      dict(mR=0.04, ma=(220, 320)),         # 11
    "BigMouth":        dict(mR=0.09, ma=(205, 335)),         # 12
    "ThickSmile":      dict(mt=0.02),                        # 13
    "FlatMouth":       dict(mR=0.2, ma=(256, 284)),          # 14
    "OpenGrin":        dict(mouth="open"),                   # 15
}


def face(pre, r, h, name="Original"):
    p = dict(FACE_BASE); p.update(FACES[name])
    cz = EYE_Z
    for s in (-1, 1):
        stick(f"{pre}Eye{s}", ico(), EYE, r, h, s * p["ex"], cz, 0.05, scale=(p["ew"] / 2, 0.025, p["eh"] / 2))
        stick(f"{pre}Brow{s}", bm_box(p["bw"], 0.02, p["bt"]), BROW, r, h, s * p["bx"], cz + p["bz"], 0.02,
              bev=min(0.006, p["bt"] * 0.4), roll=s * p["broll"])
    button_nose(pre, r, h)
    if p["mouth"] == "arc":
        stick(pre + "Mouth", arc_tube(p["mR"], p["mt"], *p["ma"]), MOUTH, r, h, 0, cz + p["mz"], 2 * p["mt"])
    else:
        stick(pre + "Mouth", ico(), MOUTH, r, h, 0, cz + p["mz"], 0.02, scale=(0.06, 0.01, 0.032))
        stick(pre + "Teeth", bm_box(0.085, 0.02, 0.018), TOOTH, r, h, 0, cz + p["mz"] + 0.014, 0.02, extra=0.004, bev=0.005)


def capsule(r_top, r_bot, length, seg=14, p=0.5, sy=1.0):
    """Capsule hanging DOWN from z=0 to z=-length (radius r_top at the top, r_bot at the bottom)."""
    bm = lathe(profile(length, lambda t: r_bot + (r_top - r_bot) * t, p=p, n=12), seg=seg, sy=sy)
    for v in bm.verts:
        v.co.z -= length
    return bm


def torus(R, r, seg=20, rseg=8):
    bm = bmesh.new(); g = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        g.append([bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
                  for b in [2 * math.pi * k / rseg for k in range(rseg)]])
    for i in range(seg):
        for k in range(rseg):
            bm.faces.new((g[i][k], g[(i + 1) % seg][k], g[(i + 1) % seg][(k + 1) % rseg], g[i][(k + 1) % rseg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def empty(name, parent, loc=(0, 0, 0), rot=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'; e.empty_display_size = 0.08
    COL.objects.link(e)
    e.parent = parent; e.location = loc; e.rotation_euler = [D(a) for a in rot]
    return e


# ---- chosen arms: A4 variant 10 (chunky full sleeve, longer, no cuff, ball hand, no thumb) ----
ARM = dict(rt=0.11, rb=0.10, L=0.72, hr=0.085, hl=0.18, splay=12, off=0.04, elbow=0.30)
SH_Z = TH - 0.17


def arms(pre, r):
    """Sleeve is split at the elbow (upper Sleeve + Forearm + a hidden Elbow ball) so the rig can bend it.
    Straight, it looks like one continuous chunky sleeve."""
    p = ARM
    e = p["elbow"]
    rm = (p["rt"] + p["rb"]) / 2
    for s in (-1, 1):
        sd = pre + ("L_" if s < 0 else "R_")
        sh = empty(sd + "Shoulder", r, (s * (TW / 2 + p["off"]), 0, SH_Z), (0, -s * p["splay"], 0))
        mk(sd + "Sleeve", capsule(p["rt"], rm, 0.07 + e + 0.07), OR, sh, (0, 0, 0.07))
        mk(sd + "Elbow", ico(rm * 0.98), OR, sh, (0, 0, -e))
        mk(sd + "Forearm", capsule(rm, p["rb"], p["L"] - 0.07 - e + 0.07), OR, sh, (0, 0, -e + 0.07))
        end = 0.07 - p["L"]
        mk(sd + "Hand", capsule(p["hr"] * 0.9, p["hr"], p["hl"], sy=0.7, p=0.6), SKIN, sh, (0, 0, end + p["rb"] * 0.9))


# ---- chosen legs: long-legs #6 -> variant 3 (longer tapered legs, white sneakers) ----
LEG = dict(H=0.97, rt=0.13, rb=0.085, hipx=0.15, ss=1.0, sh=0.1, st=0.035)
SNEAK = mat("CGL_Sneaker", "#E9E6DF", 0.6)
SNEAKSOLE = mat("CGL_SneakerSole", "#8E8A84", 0.8)


def legs(pre, r, upper=None, sole=None):
    """Adds legs + sneakers below the torso. Lifts the root so the soles sit on z=0 (root z = LEG['H'] - 0.1)."""
    p = LEG
    upper = upper or SNEAK; sole = sole or SNEAKSOLE
    H, k, st, sh = p["H"], p["ss"], p["st"], p["sh"]
    for s in (-1, 1):
        sd = pre + ("L_" if s < 0 else "R_")
        hip = empty(sd + "Hip", r, (s * p["hipx"], 0, 0.1))
        shoe = mk(sd + "Shoe", bm_box(0.17 * k, 0.29 * k, sh), upper, hip, (0, -0.045 * k, -H + st - 0.005 + sh / 2))
        bevel(shoe, min(0.045, sh * 0.45))
        so = mk(sd + "Sole", bm_box(0.17 * k + 0.01, 0.29 * k + 0.01, st), sole, hip, (0, -0.045 * k, -H + st / 2))
        bevel(so, min(0.012, st * 0.3))
        Lg = H - (st + sh) * 0.6 + 0.05
        mk(sd + "Leg", capsule(p["rt"], p["rb"], Lg), OR, hip, (0, 0, 0.05))
    r.location.z = H - 0.1


def camper(name="Camper", x=0.0, face_name="Original", hat=None):
    r = root(name, x)
    pre = name + "_"
    torso(pre, r); h = head(pre, r); face(pre, r, h, face_name); arms(pre, r); legs(pre, r)
    if hat:
        HATS[hat](pre, r)
    return r


# ---- hat library (JT picked Bucket, Cowboy, DesertCap) ----
KHAKI = mat("CGL_Khaki", "#C8B48A", 0.9)
COWB = mat("CGL_CowboyBrown", "#8A6440", 0.8)
BAND = mat("CGL_HatBand", "#3A2A1E", 0.8)


def head_r(zf):
    """Head radius at a fraction (0-1) of head height."""
    s = 2 * zf - 1
    c = math.sqrt(max(0.0, 1 - s * s))
    return HEAD_R * (c ** HEAD_P)


def _crown(scale, zf, lift=0.0, n=40):
    pts = profile(HEAD_H, lambda t: HEAD_R, p=HEAD_P, n=n)
    zc = HEAD_H * zf
    out = [(head_r(zf) * scale, 0.0)]
    for rr, z in pts:
        if z > zc:
            out.append((rr * scale, (z - zc) * scale + lift * ((z - zc) / (HEAD_H - zc))))
    return lathe(out, seg=28, sy=HEAD_SY), HB + zc


def _annulus(r_in, r_out, drop, thick, seg=28):
    return lathe([(r_in, 0), (r_out, -drop), (r_out, -drop - thick), (r_in, -thick), (r_in, 0)], seg=seg, sy=HEAD_SY)


def _bill(pre, parent, m, zabs, zf, length=0.17, tilt=10):
    front = head_r(zf) * HEAD_SY
    b = mk(pre + "Bill", lathe([(0, 0), (0.17, 0), (0.17, 0.02), (0, 0.02)]), m, parent, (0, -front - length * 0.35, zabs - 0.02))
    b.scale = (1.0, length / 0.17 * 0.8, 1.0)
    b.rotation_euler = (D(tilt), 0, 0)


def hat_bucket(pre, r):
    bm, z0 = _crown(1.09, 0.72, lift=0.02)
    mk(pre + "HatCrown", bm, KHAKI, r, (0, 0, z0))
    rc = head_r(0.72) * 1.09
    mk(pre + "HatBrim", _annulus(rc * 0.95, rc + 0.13, 0.07, 0.018), KHAKI, r, (0, 0, z0 + 0.01))
    t = mk(pre + "HatBand", torus(rc, 0.014), BAND, r, (0, 0, z0 + 0.035)); t.scale = (1, HEAD_SY, 1)


def hat_cowboy(pre, r):
    zf = 0.72
    z0 = HB + HEAD_H * zf
    rc = head_r(zf) * 1.08
    top = HEAD_H * (1 - zf) + 0.07
    pts = [(rc, 0), (rc * 1.02, top * 0.7), (rc * 0.9, top), (rc * 0.55, top + 0.01), (rc * 0.3, top - 0.03), (0, top - 0.035)]
    mk(pre + "HatCrown", lathe(pts, seg=28, sy=HEAD_SY), COWB, r, (0, 0, z0))
    bm = _annulus(rc * 0.9, rc + 0.22, 0.0, 0.02)
    for v in bm.verts:
        ex = max(0.0, abs(v.co.x) - rc * 0.8)
        v.co.z += 1.6 * ex * ex
    mk(pre + "HatBrim", bm, COWB, r, (0, 0, z0 + 0.01))
    t = mk(pre + "HatBand", torus(rc * 1.01, 0.02), BAND, r, (0, 0, z0 + 0.04)); t.scale = (1, HEAD_SY, 1)


def hat_desert(pre, r):
    zf = 0.66
    bm, z0 = _crown(1.06, zf)
    mk(pre + "HatCrown", bm, KHAKI, r, (0, 0, z0))
    _bill(pre, r, KHAKI, z0, zf)
    rc = head_r(zf) * 1.08
    bm = bmesh.new(); rows = []
    for zz, rr in ((0.0, rc), (-0.22, rc * 1.15)):
        rows.append([bm.verts.new((rr * math.cos(D(a)), rr * math.sin(D(a)) * HEAD_SY * 1.05, zz)) for a in range(10, 171, 10)])
    for j in range(len(rows[0]) - 1):
        bm.faces.new((rows[0][j], rows[0][j + 1], rows[1][j + 1], rows[1][j]))
    flap = mk(pre + "HatNeckFlap", bm, KHAKI, r, (0, 0, z0 + 0.01))
    so = flap.modifiers.new("Thick", 'SOLIDIFY'); so.thickness = 0.014


HATS = {"Bucket": hat_bucket, "Cowboy": hat_cowboy, "DesertCap": hat_desert}

HAIR = mat("CGL_Hair", "#2B1D14", 0.9)
SHADES = mat("CGL_Shades", "#141414", 0.3)


def hair(pre, r):
    """Short hair cap (the game recolors it per camper)."""
    bm, z0 = _crown(1.04, 0.58, lift=0.015)
    mk(pre + "HairCap", bm, HAIR, r, (0, 0, z0))


def shades(pre, r, h):
    """Mr. Sir's sunglasses: one dark bar across the eye line."""
    stick(pre + "ShadesBar", bm_box(0.3, 0.03, 0.075), SHADES, r, h, 0, EYE_Z + 0.005, 0.03, bev=0.012)


# ---- chosen shovel: faceted #9 (V-folded blade, cone socket + back ridge, 8-sided peach handle, plain end) ----
SHOVEL = dict(w=0.26, h=0.36, side=0.6, cz=0.86, cw=0.3, tw=0.1, fold=0.3, sr=0.026, L=1.05, sock=0.2, ridge=0.55)
SH_STEEL = mat("CGL_SteelBlue", "#A9B3C1", 0.35)
SH_WOOD = mat("CGL_WoodPeach", "#D99A6C", 0.8)


def _flat(o):
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    return o


def shovel_parts(pre, parent, z_off=0.0):
    """Upright shovel, blade tip at z=z_off, handle up +Z, scoop (concave) side facing -Y. Returns total length."""
    p = SHOVEL
    w, h, fold, sr = p["w"], p["h"], p["fold"], p["sr"]
    rows = [(0.0, w / 2), (-p["side"] * h, w / 2), (-p["cz"] * h, p["cw"] * w), (-h, p["tw"] * w)]
    bm = bmesh.new(); grid = []
    for z, hw in rows:
        grid.append([bm.verts.new((x, -fold * abs(x), z)) for x in (-hw, 0.0, hw)])
    for k in range(len(rows) - 1):
        a, b = grid[k], grid[k + 1]
        bm.faces.new((a[0], b[0], b[1], a[1])); bm.faces.new((a[1], b[1], b[2], a[2]))
    bl = _flat(mk(pre + "Blade", bm, SH_STEEL, parent, (0, 0, z_off + h), smooth=False))
    so = bl.modifiers.new("Thick", 'SOLIDIFY'); so.thickness = 0.018; so.offset = 0.0; so.use_even_offset = True
    sl = p["sock"]
    sock = _flat(mk(pre + "Socket", lathe([(0, 0), (0.05, 0), (sr * 1.15, sl), (0, sl)], seg=8), SH_STEEL, parent,
                    (0, 0.012, z_off + h - 0.07), smooth=False))
    sock.scale = (1.0, 0.7, 1.0)
    rl = h * p["ridge"]
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=4, radius1=0.004, radius2=0.026, depth=rl)
    rg = _flat(mk(pre + "Ridge", bm, SH_STEEL, parent, (0, 0.016, z_off + h - 0.06 - rl / 2), smooth=False))
    rg.rotation_euler = (0, 0, D(45)); rg.scale = (0.7, 0.7, 1.0)
    z0 = z_off + h - 0.07 + sl - 0.02
    _flat(mk(pre + "Shaft", lathe([(0, 0), (sr, 0), (sr, p["L"]), (0, p["L"])], seg=8), SH_WOOD, parent, (0, 0, z0), smooth=False))
    _flat(mk(pre + "Cap", lathe([(0, 0), (sr, 0), (sr * 0.7, 0.025), (0, 0.025)], seg=8), SH_WOOD, parent, (0, 0, z0 + p["L"]), smooth=False))
    return z0 + p["L"] + 0.025 - z_off


def frame_view(loc, dist):
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == 'VIEW_3D':
                r3 = area.spaces.active.region_3d
                r3.view_location = loc; r3.view_distance = dist
                area.tag_redraw()
