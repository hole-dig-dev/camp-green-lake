"""art/blender/dressing.py : the lake's scatter, its landmarks and the camp-yard props, from free CC0 models.

Sources: Poly Pizza downloads (Quaternius, Kay Lousberg, iPoly3D; all CC0), kept as downloaded in
art/blender/sources/dressing/. Every one is listed with its page in CREDITS.md at the top of the repo.

What it does, for every asset in the list at the bottom:
  - imports one or more source models and lays them out (a landmark is several models composed into one scene),
  - throws away their materials and textures and paints each face into the camp's palette instead, as a vertex
    colour: weathered wood browns, faded olive, teal-green steel, rust, bleached bone. One material per asset, so
    the game draws a whole landmark (or every copy of a scattered shrub) in a single call. Colours are typed as
    sRGB hex and stored as linear light; the game's loader (23-models.js) converts them back.
  - scales to the game's people (a camper is about 1.75 m), origin on the ground at the middle, flat shading,
  - exports public/models/<Name>.glb (glTF +Y up; Blender -Y is the game's +z).
For each landmark it prints the boxes of its solid pieces as `[x, z, w, d]` in the game's coordinates relative to
the landmark's origin; public/js/47-dressing.js carries a copy (LANDMARKS[].solids). Re-copy them if a layout changes.

Run:      ~/blender/blender -b --factory-startup --python art/blender/dressing.py
Preview:  ... --python art/blender/dressing.py -- --preview /tmp/some-dir     (also renders a PNG of each asset)
"""
import bpy, os, sys, math, random, json, struct
from mathutils import Vector, Matrix, Euler
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sources', 'dressing')
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'public', 'models'))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW = ARGS[ARGS.index('--preview') + 1] if '--preview' in ARGS else None
ONLY = ARGS[ARGS.index('--only') + 1].split(',') if '--only' in ARGS else None

# ---- the palette (sRGB hex) ----
WOOD, WOOD_D, WOOD_L = 0x8f6f4c, 0x6a4f38, 0xb39669       # weathered boards, their shadowed side, sun-bleached
DEAD_D, DEAD_L = 0x5e4a3a, 0x9c856a                       # dead branches: grey-brown, silvered where the sun hits
OLIVE, OLIVE_D, OLIVE_L = 0x6f7a4c, 0x566240, 0x8a9160    # cactus flesh (the camp's faded olive)
STRAW_D, STRAW_L = 0x6f6638, 0xb9a257                     # dry grass, root to tip
STEEL, STEEL_D = 0x3d5a55, 0x2f4541                       # teal-green steel
RUST, RUST_D, RUST_L = 0xa8502c, 0x7a3d26, 0xc4703c
BONE, BONE_D = 0xece0c4, 0xcdbd9b
STONE, STONE_D, STONE_L = 0x9c8a74, 0x7d6c5a, 0xb8a78c
CANVAS, CANVAS_D = 0xb59a68, 0x94794e
CHAR = 0x3a3530
CREAM = 0xffe9b0
NAMED = {   # what a source material's name becomes when a piece gives no palette of its own
    'Wood': WOOD, 'DarkWood': WOOD_D, 'LightWood': WOOD_L, 'Wood_Light': WOOD_L, 'Dark Wood': WOOD_D, 'Light Wood': WOOD_L,
    'WoodSide': WOOD_L, 'String': CANVAS, 'Metal': STEEL, 'DarkMetal': STEEL_D, 'Steel': STEEL, 'Grey': STEEL, 'Black': CHAR,
    'Rust': RUST, 'Rust2': RUST_D, 'Beige': BONE, 'Stone': STONE, 'Stone_Dark': STONE_D, 'Stone_Light': STONE_L, 'Rocks': STONE,
    'Green': OLIVE, 'LightGreen': CANVAS, 'Pink': 0xd9825a, 'Fabric': CANVAS, 'Sail': CANVAS, 'Main': RUST, 'Herbs': STRAW_L,
    'Red': RUST, 'Blue': STEEL, 'BrightYellow': WOOD_L,
}

def lin(c): return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
def unlin(c): return 1.055 * c ** (1 / 2.4) - 0.055 if c > 0.0031308 else c * 12.92
def rgb(h): return Vector((((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255))   # sRGB 0..1
def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]

def wipe():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for b in list(blk):
            if not b.users: blk.remove(b)

_px = {}
def texel(img, u, v):   # the sRGB colour of a texture at (u, v): palette-atlas models keep their colours there
    if img.name not in _px:
        buf = [0.0] * (img.size[0] * img.size[1] * 4); img.pixels.foreach_get(buf); _px[img.name] = (img.size[0], img.size[1], buf)
    W, H, buf = _px[img.name]; i = ((int((v % 1) * H) % H) * W + int((u % 1) * W) % W) * 4
    return Vector(buf[i:i + 3])

PIECES = []      # the objects of the asset being built
SOLIDS = []      # its solid boxes, game coordinates
RNG = random.Random(7)

def paint(ob, cols):   # cols: one sRGB Vector per polygon -> a linear face-corner colour attribute
    me = ob.data
    for a in list(me.color_attributes): me.color_attributes.remove(a)
    at = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for p, c in zip(me.polygons, cols):
        v = (lin(c[0]), lin(c[1]), lin(c[2]), 1)
        for li in p.loop_indices: at.data[li].color = v
    me.color_attributes.active_color = at
    me.materials.clear()

def place(ob, at, rot, sink, ground, solid, pad=0.0):
    me = ob.data
    if rot != (0, 0, 0): me.transform(Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4())
    if ground: me.transform(Matrix.Translation((0, 0, -min(v.co.z for v in me.vertices))))
    me.transform(Matrix.Translation((at[0], at[1], at[2] - sink)))
    if solid:
        xs = [v.co.x for v in me.vertices if v.co.z < 2.0]; ys = [v.co.y for v in me.vertices if v.co.z < 2.0]   # what a walker can bump into
        if solid is True: SOLIDS.append(((min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, max(0.3, max(xs) - min(xs) - pad), max(0.3, max(ys) - min(ys) - pad)))
        else: SOLIDS.append((at[0] + solid[0], -(at[1] + solid[1]), solid[2], solid[3]))
    PIECES.append(ob); return ob

def piece(src, at=(0, 0, 0), rot=(0, 0, 0), h=None, l=None, s=None, thin=1, pal=None, ramp=None, grad=None, fn=None, sink=0.04, ground=True, solid=False, pad=0.0):
    """One source model into the current asset. Size by h (height), l (longest side on the ground) or s (plain scale).
    Colour: pal {source material: hex} > fn(sampled sRGB colour, face centre) > ramp (dark, light) by the source's own
    brightness > grad (bottom, top) by height > NAMED by material name > the source colour."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, src + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = Matrix(); o.data.transform(mw)
    for o in new:
        if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    # 1) each face's source colour (flat material colour, or its texel) and material name
    info = []
    for o in meshes:
        me = o.data; uv = me.uv_layers.active.data if me.uv_layers.active else None; rows = []
        for p in me.polygons:
            m = me.materials[p.material_index] if me.materials else None; c = Vector((0.5, 0.5, 0.5)); name = m.name.split('.')[0] if m else ''
            if m and m.use_nodes:
                b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                if b:
                    L = b.inputs['Base Color'].links
                    if L and L[0].from_node.type == 'TEX_IMAGE' and L[0].from_node.image and uv:
                        c = texel(L[0].from_node.image, sum(uv[i].uv.x for i in p.loop_indices) / p.loop_total, sum(uv[i].uv.y for i in p.loop_indices) / p.loop_total)
                    elif not L: c = Vector([unlin(x) for x in b.inputs['Base Color'].default_value[:3]])
            rows.append((name, c))
        info.append(rows)
    # 2) one object, centred, on the ground, to size
    for x in bpy.context.selected_objects: x.select_set(False)
    polys = [r for rows in info for r in rows]
    ob = meshes[0]
    if len(meshes) > 1:
        for o in meshes: o.select_set(True)
        bpy.context.view_layer.objects.active = ob; bpy.ops.object.join()
    me = ob.data; assert len(me.polygons) == len(polys), src
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    me.transform(Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))))
    k = s or (h / (max(zs) - min(zs)) if h else l / max(max(xs) - min(xs), max(ys) - min(ys)) if l else 1)
    me.transform(Matrix.Diagonal((k * thin, k * thin, k, 1)))   # thin: squeeze its footprint (standing stones)
    # 3) paint
    top = max(v.co.z for v in me.vertices) or 1; ls = [lum(c) for _, c in polys]; l0, l1 = min(ls), max(ls); cols = []
    for p, (name, c) in zip(me.polygons, polys):
        if pal and name in pal: c = rgb(pal[name])
        elif fn: c = rgb(fn(c, p.center))
        elif ramp: c = rgb(ramp[0]).lerp(rgb(ramp[1]), (lum(c) - l0) / (l1 - l0) if l1 > l0 + 1e-4 else 0.5 + 0.5 * max(-1, min(1, p.normal.z)))
        elif grad: c = rgb(grad[0]).lerp(rgb(grad[1]), max(0, min(1, p.center.z / top)))
        elif name in NAMED: c = rgb(NAMED[name])
        cols.append(c)
    paint(ob, cols)
    return place(ob, at, rot, sink, ground, solid, pad)

def feet(ob, size=0.45):   # a piece on legs (the pier): each post that reaches the ground is solid, the deck above is not
    posts = []                                    # [sum x, sum y, count] of the low vertices, gathered into posts
    for v in ob.data.vertices:
        if v.co.z > 0.3: continue
        for q in posts:
            if abs(q[0] / q[2] - v.co.x) < 0.9 and abs(q[1] / q[2] - v.co.y) < 0.9: q[0] += v.co.x; q[1] += v.co.y; q[2] += 1; break
        else: posts.append([v.co.x, v.co.y, 1])
    for q in posts: SOLIDS.append((q[0] / q[2], -q[1] / q[2], size, size))
    return ob

def box(size, at=(0, 0, 0), rot=(0, 0, 0), col=WOOD, sink=0.0, ground=False, solid=False):   # a plain board/post; `at` is its centre
    bpy.ops.mesh.primitive_cube_add(size=1); ob = bpy.context.active_object; ob.data.transform(Matrix.Diagonal((size[0], size[1], size[2], 1)))
    paint(ob, [rgb(col)] * len(ob.data.polygons)); return place(ob, at, rot, sink, ground, solid)
def pole(r, length, at=(0, 0, 0), rot=(0, 0, 0), col=WOOD, seg=6, solid=False):               # a post standing on `at`, or tipped by rot
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=length); ob = bpy.context.active_object; ob.data.transform(Matrix.Translation((0, 0, length / 2)))
    paint(ob, [rgb(col)] * len(ob.data.polygons)); return place(ob, at, rot, 0, False, solid)

def asset(name):
    global RNG
    wipe(); PIECES.clear(); SOLIDS.clear(); RNG = random.Random(sum(map(ord, name)))
    return name

def done(name, dec=None):
    for x in bpy.context.selected_objects: x.select_set(False)
    for o in PIECES: o.select_set(True)
    ob = PIECES[0]; bpy.context.view_layer.objects.active = ob
    if len(PIECES) > 1: bpy.ops.object.join()
    if dec:   # thin out a model that is drawn many times (the colours ride along)
        m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = dec; bpy.ops.object.modifier_apply(modifier='dec')
    ob.name = name; me = ob.data; me.name = name
    for p in me.polygons: p.use_smooth = False
    m = bpy.data.materials.new('cgl_dress_' + name); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    a = m.node_tree.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'; m.node_tree.links.new(a.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.95; b.inputs['Metallic'].default_value = 0.0
    me.materials.clear(); me.materials.append(m)
    for l in list(me.uv_layers): me.uv_layers.remove(l)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=False,
                              export_texcoords=False, export_normals=False, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_draco_mesh_compression_enable=False)
    shrink(path)
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    print('DRESS %-18s %5d tris %7d bytes  size x %.1f z %.1f tall %.1f' % (name, tris, os.path.getsize(path), max(xs) - min(xs), max(ys) - min(ys), max(zs)))
    if SOLIDS: print('DRESS   solids ' + ','.join('[%.1f,%.1f,%.1f,%.1f]' % s for s in SOLIDS))
    if PREVIEW: shot(ob, name)

def shrink(path):
    """Rewrite the exported GLB small: Blender writes three loose vertices per triangle with float colours (~80 bytes a
    triangle). Corners that share a position and a colour become one vertex, colours become bytes, and the game shades
    flat without normals, so a triangle ends up around 20 bytes."""
    f = open(path, 'rb').read(); n = struct.unpack('<I', f[12:16])[0]; J = json.loads(f[20:20 + n]); B = f[28 + n:]
    prim = J['meshes'][0]['primitives'][0]
    def acc(i, fmt, size):
        a = J['accessors'][i]; v = J['bufferViews'][a['bufferView']]; o = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from(fmt, B, o + k * size) for k in range(a['count'])]
    ia = J['accessors'][prim['indices']]; idx = [x[0] for x in acc(prim['indices'], {5123: '<H', 5125: '<I'}[ia['componentType']], {5123: 2, 5125: 4}[ia['componentType']])]
    pos = acc(prim['attributes']['POSITION'], '<3f', 12)
    ca = J['accessors'][prim['attributes']['COLOR_0']]; nc = 3 if ca['type'] == 'VEC3' else 4
    if ca['componentType'] == 5126: col = [tuple(min(255, max(0, round(c * 255))) for c in x[:3]) for x in acc(prim['attributes']['COLOR_0'], '<%df' % nc, 4 * nc)]
    else: col = [tuple(c >> 8 for c in x[:3]) for x in acc(prim['attributes']['COLOR_0'], '<%dH' % nc, 2 * nc)]
    seen = {}; P = []; C = []; I = []
    for i in idx:
        key = (tuple(round(c, 4) for c in pos[i]), col[i]); j = seen.get(key)
        if j is None: j = seen[key] = len(P); P.append(pos[i]); C.append(col[i])
        I.append(j)
    wide = len(P) > 65535
    bp = b''.join(struct.pack('<3f', *p) for p in P); bc = b''.join(struct.pack('<4B', c[0], c[1], c[2], 255) for c in C)
    bi = b''.join(struct.pack('<I' if wide else '<H', i) for i in I); bi += b'\0' * (-len(bi) % 4)
    J['buffers'] = [{'byteLength': len(bp) + len(bc) + len(bi)}]
    J['bufferViews'] = [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(bp), 'target': 34962}, {'buffer': 0, 'byteOffset': len(bp), 'byteLength': len(bc), 'target': 34962},
                        {'buffer': 0, 'byteOffset': len(bp) + len(bc), 'byteLength': len(I) * (4 if wide else 2), 'target': 34963}]
    J['accessors'] = [{'bufferView': 0, 'componentType': 5126, 'count': len(P), 'type': 'VEC3', 'min': [min(p[k] for p in P) for k in range(3)], 'max': [max(p[k] for p in P) for k in range(3)]},
                      {'bufferView': 1, 'componentType': 5121, 'normalized': True, 'count': len(P), 'type': 'VEC4'},
                      {'bufferView': 2, 'componentType': 5125 if wide else 5123, 'count': len(I), 'type': 'SCALAR'}]
    prim['attributes'] = {'POSITION': 0, 'COLOR_0': 1}; prim['indices'] = 2
    js = json.dumps(J, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4); bin_ = bp + bc + bi
    open(path, 'wb').write(struct.pack('<4sII', b'glTF', 2, 28 + len(js) + len(bin_)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(bin_), b'BIN\0') + bin_)

def shot(ob, name):   # a quick sunlit render of the finished asset on sand, with a camper-height pole (1.75 m) for scale
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'VERTEX'
    sc.display.shading.show_shadows = True; sc.display.shading.show_cavity = True; sc.render.resolution_x = 640; sc.render.resolution_y = 420
    sc.render.film_transparent = False; sc.view_settings.view_transform = 'Standard'
    if sc.world is None: sc.world = bpy.data.worlds.new('w')
    sc.world.color = (0.6, 0.72, 0.85)
    me = ob.data; xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; top = max(v.co.z for v in me.vertices)
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2; R = max(max(xs) - min(xs), max(ys) - min(ys), top) * 0.5 + 0.5
    bpy.ops.mesh.primitive_plane_add(size=R * 12, location=(cx, cy, 0)); g = bpy.context.active_object; paint(g, [rgb(0xdcab6e)])
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.2, depth=1.75, location=(max(xs) + 0.6, min(ys) - 0.3, 0.875)); pl = bpy.context.active_object; paint(pl, [rgb(0xd04a3a)] * len(pl.data.polygons))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 40
    d = Vector((0.75, -1.0, 0.42)).normalized() * R * 3.6; cam.location = Vector((cx, cy, top * 0.4)) + d
    cam.rotation_euler = (Vector((cx, cy, top * 0.4)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(PREVIEW, name + '.png'); bpy.ops.render.render(write_still=True)

def build(name, fn, dec=None):
    if ONLY and name not in ONLY: return
    asset(name); fn(); done(name, dec)

# =====================================================================================================================
# scatter: one small model each, instanced a few hundred times by 47-dressing.js
# =====================================================================================================================
build('DressCactusTall', lambda: piece('cactus-tall', h=2.7, grad=(OLIVE_D, OLIVE_L), sink=0.08))
build('DressCactusPear', lambda: piece('cactus-pear', h=1.15, pal={'Pink': 0xd9825a}, grad=(OLIVE_D, OLIVE_L), sink=0.05), dec=0.55)
build('DressCactusBarrel', lambda: piece('cactus-barrel', h=0.7, ramp=(OLIVE_D, OLIVE_L), sink=0.05))
build('DressShrub', lambda: piece('dead-bush', h=0.95, grad=(DEAD_D, DEAD_L), sink=0.05))
build('DressGrass', lambda: piece('grass-wispy', h=0.5, grad=(STRAW_D, STRAW_L), sink=0.04), dec=0.5)
build('DressDeadTreeA', lambda: piece('dead-tree-a', h=5.2, grad=(DEAD_D, DEAD_L), sink=0.15))
build('DressDeadTreeB', lambda: piece('dead-tree-c', h=6.0, grad=(DEAD_D, DEAD_L), sink=0.15))
def bones():
    piece('ribs', l=1.7, ramp=(BONE_D, BONE), sink=0.12)
    piece('bone', at=(1.1, 0.5, 0), rot=(90, 0, 35), l=0.6, ramp=(BONE_D, BONE), sink=0.03)
    piece('bone', at=(-0.9, -0.8, 0), rot=(90, 0, -60), l=0.5, ramp=(BONE_D, BONE), sink=0.03)
build('DressBones', bones, dec=0.45)
build('DressFishBone', lambda: piece('fish-bone', l=1.1, ramp=(BONE_D, BONE), sink=0.02), dec=0.6)

# =====================================================================================================================
# camp yard props
# =====================================================================================================================
build('DressBarrel', lambda: piece('barrel', h=1.05, sink=0.0))
build('DressCrate', lambda: piece('crate', h=0.8, sink=0.0))
def lamp_col(c, p): return CREAM if c[0] > 0.85 and c[2] < 0.75 else STEEL_D if lum(c) < 0.62 else STEEL
build('DressLantern', lambda: piece('lantern', h=0.42, fn=lamp_col, sink=0.0))
build('DressBucket', lambda: piece('bucket', h=0.42, sink=0.0))
def tool_rack():   # an A-frame rail with the day's shovels leaning on it
    for x in (-0.95, 0.95): pole(0.05, 1.25, at=(x, 0, 0), col=WOOD_D)
    box((2.1, 0.07, 0.09), at=(0, 0, 1.15), col=WOOD); box((2.1, 0.05, 0.07), at=(0, 0, 0.35), col=WOOD)
    for i, x in enumerate((-0.6, -0.15, 0.3, 0.7)):
        piece('shovel', at=(x, -0.3, 0), rot=(-13 - i * 2, 0, 0), h=1.5, fn=lambda c, p: STEEL if p.z < 0.45 else WOOD_L, sink=0.0)
build('DressToolRack', tool_rack)
def wash_line():   # two posts, a sagging line, the crew's laundry
    for x in (-2.6, 2.6):
        pole(0.06, 2.1, at=(x, 0, 0), col=WOOD_D); box((0.7, 0.06, 0.06), at=(x, 0, 2.0), col=WOOD_D)
    n = 12
    for i in range(n):
        x0, x1 = -2.6 + 5.2 * i / n, -2.6 + 5.2 * (i + 1) / n; sag = lambda x: 2.0 - 0.22 * (1 - (x / 2.6) ** 2)
        ang = math.degrees(math.atan2(sag(x1) - sag(x0), x1 - x0))
        box((x1 - x0 + 0.02, 0.025, 0.025), at=((x0 + x1) / 2, 0, (sag(x0) + sag(x1)) / 2), rot=(0, -ang, 0), col=CANVAS_D)
    for x, w, hh, col in ((-1.7, 0.55, 0.7, 0xc96a3a), (-0.9, 0.5, 0.62, 0xd9cdb0), (-0.1, 0.75, 0.5, 0xc96a3a), (0.9, 0.5, 0.7, 0xb7ab8c), (1.75, 0.42, 0.42, 0xd9cdb0)):
        box((w, 0.03, hh), at=(x, 0, 2.0 - 0.22 * (1 - (x / 2.6) ** 2) - hh / 2), rot=(RNG.uniform(-7, 7), 0, 0), col=col)
build('DressWashLine', wash_line)

# =====================================================================================================================
# landmarks: each a composed scene, one mesh. Laid out in Blender's top view: +x east, +y north (the game's -z).
# =====================================================================================================================
def tree_col(c, p): return DEAD_D
def lm_wreck():   # a fishing boat that never left: heeled over on its keel, mast still up, a rowboat and its oar beside it
    piece('sail-boat', l=11, rot=(0, 17, 25), pal={'Sail': CANVAS, 'DarkWood': WOOD_D, 'LightWood': WOOD, 'Steel': STEEL}, sink=0.55, solid=True, pad=1.2)
    piece('boat', at=(6.5, -3.5, 0), rot=(0, 164, 70), l=4.2, sink=0.1, solid=True, pad=0.4)
    piece('paddle', at=(4.2, -5.6, 0), rot=(0, 0, 20), l=2.3, pal={'Blue': WOOD_D, 'BrightYellow': WOOD_L}, sink=0.02)
    piece('fish-bone', at=(-4.5, -4.5, 0), rot=(0, 0, 40), l=1.3, ramp=(BONE_D, BONE), sink=0.02)
    piece('barrel', at=(-5.5, 2.5, 0), rot=(84, 0, 30), h=1.05, sink=0.2, solid=True)
    piece('dead-bush', at=(5.5, 4.0, 0), h=1.0, grad=(DEAD_D, DEAD_L))
build('LmWreck', lm_wreck)
def lm_pier():   # the pier still walks out to where the water was
    for i in range(3): feet(piece('dock-long', at=(0, -8 + i * 8.6, 0), l=8.8, sink=0.25))
    feet(piece('dock-broken', at=(0.3, 20.5, 0), l=3.6, ramp=(WOOD_D, WOOD_L), sink=0.5))
    piece('boat', at=(4.6, 9, 0), rot=(0, 8, -20), l=4.4, sink=0.22, solid=True, pad=0.4)
    pole(0.14, 8.0, at=(1.9, 23.2, -0.3), rot=(-4, 3, 0), col=WOOD_D, seg=7, solid=(0, 0, 0.5, 0.5))   # the harbour light's mast, so the pier shows from far off
    box((1.5, 0.12, 0.12), at=(1.9 + 0.95, 23.75, 7.2), rot=(-4, 3, 0), col=WOOD_D); box((0.34, 0.34, 0.5), at=(3.75, 23.8, 6.8), col=STEEL_D); box((0.26, 0.26, 0.3), at=(3.75, 23.8, 6.8), col=CREAM)
    piece('sign', at=(-3.0, -13.5, 0), rot=(0, 0, 160), h=2.3, pal={'Herbs': STRAW_D}, solid=(0, 0, 0.4, 0.4))
    piece('barrel', at=(2.6, -13.0, 0), h=1.05, solid=True)
    piece('grass-wispy', at=(-2.4, 3, 0), h=0.6, grad=(STRAW_D, STRAW_L)); piece('grass-wispy', at=(2.7, 16, 0), h=0.5, grad=(STRAW_D, STRAW_L))
build('LmPier', lm_pier)
def lm_car():   # somebody drove out here once
    piece('broken-car', rot=(-9, 6, 30), l=4.6, pal={'Rust': RUST, 'Rust2': RUST_D, 'Grey': STEEL, 'Black': CHAR}, sink=0.42, solid=True, pad=0.5)
    piece('rock-large', at=(-3.4, 1.6, 0), l=2.6, ramp=(STONE_D, STONE_L), sink=0.2, solid=True, pad=0.5)
    piece('cactus-tall', at=(3.3, 2.2, 0), h=3.4, grad=(OLIVE_D, OLIVE_L), sink=0.08, solid=(0, 0, 0.5, 0.5))
    piece('dead-bush', at=(-2.2, -2.6, 0), h=0.9, grad=(DEAD_D, DEAD_L)); piece('grass-wispy', at=(1.6, -2.4, 0), h=0.5, grad=(STRAW_D, STRAW_L))
    piece('bone', at=(2.8, -1.2, 0), rot=(90, 0, 50), l=0.6, ramp=(BONE_D, BONE), sink=0.03)
    # the telegraph pole it found, the only thing to hit for a mile: leaning, wires long gone. It is what shows from far off.
    pole(0.16, 9.0, at=(-1.2, 3.4, -0.4), rot=(7, -9, 0), col=WOOD_D, seg=7, solid=(0, 0, 0.5, 0.5))
    box((2.6, 0.14, 0.16), at=(-2.55, 2.4, 7.9), rot=(7, -9, 12), col=WOOD_D); box((1.8, 0.12, 0.14), at=(-2.4, 2.48, 7.2), rot=(7, -9, 12), col=WOOD_D)
build('LmCar', lm_car)
def lm_windmill():   # a wind pump over a dry trough
    piece('windmill', h=10.5, pal={'Wood': 0xa07c52, 'Wood_Light': 0xc4a574, 'Main': RUST, 'Fabric': 0xcdb586}, sink=0.1, solid=True, pad=0.6)
    box((3.2, 1.1, 0.12), at=(4.2, -1.0, 0.06), col=STEEL_D); box((3.2, 0.1, 0.6), at=(4.2, -0.5, 0.3), col=STEEL); box((3.2, 0.1, 0.6), at=(4.2, -1.5, 0.3), col=STEEL)
    box((0.1, 1.1, 0.6), at=(2.65, -1.0, 0.3), col=STEEL); box((0.1, 1.1, 0.6), at=(5.75, -1.0, 0.3), col=STEEL, solid=(-1.55, 0, 3.2, 1.1))
    for i, (x, y, r) in enumerate(((-4.5, -3.5, 0), (-6.9, -3.4, 4), (-9.3, -3.7, -12), (-4.6, 3.4, 90))):
        piece('broken-fence', at=(x, y, 0), rot=(0, 0, r), l=2.4, pal={'Wood': WOOD_L if i % 2 else WOOD}, sink=0.05)
    piece('bucket', at=(2.0, -2.2, 0), rot=(80, 0, 40), h=0.45, sink=0.05); piece('dead-bush', at=(-3.0, 2.2, 0), h=1.1, grad=(DEAD_D, DEAD_L))
build('LmWindmill', lm_windmill)
def lm_tree():   # one enormous dead tree, and a chair somebody carried all the way out to sit under it
    piece('dead-tree-a', h=15, grad=(DEAD_D, DEAD_L), sink=0.3, solid=(0, 0, 1.6, 1.6))
    piece('chair', at=(2.6, -2.2, 0), rot=(0, 0, 150), h=1.0, pal={'Wood': WOOD_L}, sink=0.02, solid=True)
    piece('bucket', at=(3.6, -1.6, 0), h=0.42); piece('ribs', at=(-3.8, 2.6, 0), rot=(0, 0, 70), l=1.8, ramp=(BONE_D, BONE), sink=0.12)
    piece('rock-large', at=(-2.4, -2.8, 0), l=1.5, ramp=(STONE_D, STONE_L), sink=0.15, solid=True, pad=0.3)
build('LmTree', lm_tree)
def lm_stones():   # a ring of standing stones around a ring of ash; one has fallen
    n = 8; R = 8.0
    for i in range(n):
        a = i / n * math.tau + 0.2; hh = (5.6, 4.2, 6.6, 4.6, 5.2, 6.0, 4.4, 7.2)[i]
        if i == 5: piece('tall-rock', at=(math.cos(a) * (R + 2.4), math.sin(a) * (R + 2.4), 0), rot=(78, 0, math.degrees(a) + 90), h=6.0, thin=0.55, ramp=(STONE_D, STONE_L), sink=0.5, solid=True, pad=0.4)
        else: piece('tall-rock', at=(math.cos(a) * R, math.sin(a) * R, 0), rot=(RNG.uniform(-5, 5), RNG.uniform(-5, 5), math.degrees(a) + RNG.uniform(-30, 30)), h=hh, thin=0.55, ramp=(STONE_D, STONE_L), sink=0.3, solid=True, pad=0.2)
    piece('bonfire', l=2.2, pal={'Wood': CHAR, 'WoodSide': 0x5a5048, 'Stone_Dark': STONE_D, 'Stone_Light': STONE}, sink=0.03)
build('LmStones', lm_stones)
def lm_camp():   # a prospector's camp, long cold
    piece('tent', at=(-1.5, 2.2, 0), rot=(0, 0, 25), l=6.6, pal={'DarkWood': WOOD_D, 'Black': CHAR, 'Green': CANVAS_D, 'LightGreen': CANVAS}, sink=0.05, solid=True, pad=0.6)
    piece('bonfire', at=(1.6, -1.6, 0), l=1.5, pal={'Wood': CHAR, 'WoodSide': 0x5a5048, 'Stone_Dark': STONE_D, 'Stone_Light': STONE}, sink=0.03)
    piece('log', at=(1.9, -3.6, 0), rot=(0, 0, 8), l=2.0, sink=0.08, solid=True, pad=0.2)
    piece('crate', at=(3.9, 0.6, 0), rot=(0, 0, 20), h=0.75, solid=True); piece('crate', at=(4.1, 1.5, 0), rot=(0, 0, -10), h=0.6)
    piece('lantern', at=(3.9, 0.6, 0.75), h=0.45, fn=lamp_col, sink=0.0, ground=True)
    piece('barrel', at=(-4.6, -0.4, 0), h=1.05, solid=True)
    piece('broken-cart', at=(-3.4, -4.6, 0), rot=(0, 0, -30), l=3.4, sink=0.08, solid=True, pad=0.6)
    piece('shovel', at=(0.2, -4.4, 0), rot=(8, 6, 0), h=1.5, fn=lambda c, p: STEEL if p.z < 0.45 else WOOD_L, sink=0.24)
    pole(0.09, 8.5, at=(5.6, 3.2, 0), rot=(0, 3, 0), col=WOOD_D, solid=(0, 0, 0.4, 0.4)); box((2.3, 0.05, 1.3), at=(7.15, 3.2, 7.7), rot=(0, 3, 0), col=RUST)   # a claim flag, so the camp shows from far off
build('LmCamp', lm_camp)
def lm_fence():   # a fence that keeps nothing in, and the gate nobody shuts
    xs = (-15.5, -12.6, -9.8, -6.9, -1.2, 1.7, 4.6, 10.4, 13.2)
    for i, x in enumerate(xs):
        piece('broken-fence', at=(x, math.sin(x * 0.3) * 0.5, 0), rot=(RNG.uniform(-6, 6), 0, RNG.uniform(-7, 7)), l=2.9, pal={'Wood': (WOOD, WOOD_L, WOOD_D)[i % 3]}, sink=0.06, solid=True)
    for x in (-5.3, -2.7): pole(0.15, 5.4, at=(x, 0, 0), col=WOOD_D, solid=(0, 0, 0.4, 0.4))
    box((3.6, 0.2, 0.24), at=(-4.0, 0, 5.2), col=WOOD_D); box((2.0, 0.06, 0.7), at=(-4.0, 0, 4.6), rot=(0, 6, 0), col=WOOD_L)
    piece('dead-tree-c', at=(16.6, 1.2, 0), h=11, grad=(DEAD_D, DEAD_L), sink=0.2, solid=(0, 0, 0.9, 0.9))
    piece('ribs', at=(6.9, -1.6, 0), rot=(0, 0, 20), l=1.8, ramp=(BONE_D, BONE), sink=0.12)
    piece('grass-wispy', at=(-11, 0.5, 0), h=0.55, grad=(STRAW_D, STRAW_L)); piece('grass-wispy', at=(2.5, -0.5, 0), h=0.5, grad=(STRAW_D, STRAW_L)); piece('dead-bush', at=(9.0, 0.8, 0), h=1.0, grad=(DEAD_D, DEAD_L))
build('LmFence', lm_fence)
