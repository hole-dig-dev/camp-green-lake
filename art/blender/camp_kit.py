"""art/blender/camp_kit.py : a small headless modelling kit for the camp's buildings and rooms (camp.py uses it).

Everything is written in the GAME's coordinates (x: east, y: up, z: south/toward the back wall of a room, metres, the
asset's origin on the floor at its centre) and turned into Blender's (x, -z, y) here, so the numbers in camp.py can be
read straight against public/js (20-world.js TENTS, the room layouts in 20-world.js). The glTF export (+Y up) turns
them back. One bmesh per asset, one material slot per named colour, flat shaded, no textures, no normals (the game shades every model flat from its faces: gameMat flatShading).
Colours are sRGB hex, stored as linear factors (the game's loader, 23-models.js gameMat, converts them back).
Materials whose name starts with cgl_daylight / cgl_lampglow / cgl_stoveglow / cgl_winlit are lit by the game
(public/js/47-camplight.js): keep those names.
"""
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'public', 'models'))
FONTS = os.path.abspath(os.path.join(HERE, '..', 'fonts'))

def lin(c): return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
def hex_lin(h): return tuple(lin(((h >> s) & 255) / 255) for s in (16, 8, 0)) + (1.0,)

_MATS = {}; _HEX = {}
def mat(name, hexc, rough=0.85):
    """one material per name (the name is what the game sees, with a cgl_ prefix)"""
    key = 'cgl_' + name
    if key in _MATS: return _MATS[key]
    m = bpy.data.materials.get(key) or bpy.data.materials.new(key); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = hex_lin(hexc); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = 0.0
    _MATS[key] = m; _HEX[key] = hexc; return m

def P(x, y, z): return Vector((x, -z, y))   # game -> Blender

def wipe():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.curves):
        for b in list(blk):
            if not b.users: blk.remove(b)

class Asset:
    """one exported model: a bmesh in game coordinates plus its materials"""
    def __init__(self, name):
        self.name = name; self.bm = bmesh.new(); self.mats = []; self.xf = Matrix.Identity(4)
    def mi(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)
    def _v(self, g): return self.bm.verts.new(P(*(self.xf @ Vector(g))))
    def quad(self, pts, m):
        vs = [self._v(p) for p in pts]; f = self.bm.faces.new(vs); f.material_index = self.mi(m); return f
    def prism(self, pts, axis, a0, a1, m):
        """a 2D outline extruded along a game axis. axis 'x': pts are (z, y); 'y': (x, z); 'z': (x, y)"""
        def G(u, v, a): return (a, v, u) if axis == 'x' else (u, a, v) if axis == 'y' else (u, v, a)
        lo = [self._v(G(u, v, a0)) for u, v in pts]; hi = [self._v(G(u, v, a1)) for u, v in pts]; k = self.mi(m); fs = []
        fs.append(self.bm.faces.new(lo)); fs.append(self.bm.faces.new(hi[::-1]))
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n; fs.append(self.bm.faces.new((lo[i], hi[i], hi[j], lo[j])))
        for f in fs: f.material_index = k
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs
    def box(self, x0, x1, y0, y1, z0, z1, m):
        return self.prism([(z0, y0), (z1, y0), (z1, y1), (z0, y1)], 'x', min(x0, x1), max(x0, x1), m)
    def boxc(self, cx, cy, cz, w, h, d, m, ry=0.0, rx=0.0, rz=0.0):
        """a box by centre and size (w along x, h along y, d along z), turned about its centre"""
        old = self.xf
        self.xf = old @ Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(rz, 4, 'Z')
        r = self.box(-w / 2, w / 2, -h / 2, h / 2, -d / 2, d / 2, m); self.xf = old; return r
    def cyl(self, axis, cu, cv, r, a0, a1, m, n=10, rv=None):
        """a cylinder along a game axis, its middle at (cu, cv) in that axis' outline plane ('y': (x, z))"""
        rv = rv or r
        pts = [(cu + r * math.cos(2 * math.pi * i / n + math.pi / n), cv + rv * math.sin(2 * math.pi * i / n + math.pi / n)) for i in range(n)]
        return self.prism(pts, axis, a0, a1, m)
    def cone(self, x, z, r0, r1, y0, y1, m, n=10):
        """a frustum standing on y0 (radius r0) up to y1 (radius r1)"""
        lo = [self._v((x + r0 * math.cos(2 * math.pi * i / n), y0, z + r0 * math.sin(2 * math.pi * i / n))) for i in range(n)]
        hi = [self._v((x + r1 * math.cos(2 * math.pi * i / n), y1, z + r1 * math.sin(2 * math.pi * i / n))) for i in range(n)]
        k = self.mi(m); fs = [self.bm.faces.new(lo[::-1])]
        if r1 > 0.001: fs.append(self.bm.faces.new(hi))
        for i in range(n):
            j = (i + 1) % n; fs.append(self.bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
        for f in fs: f.material_index = k
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
    def tube(self, a, b, r, m, n=6):
        """a round bar from point a to point b (game coords)"""
        a, b = Vector(a), Vector(b); d = b - a; L = d.length
        q = Vector((0, 1, 0)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        old = self.xf; self.xf = old @ Matrix.Translation(a) @ q
        self.cyl('y', 0, 0, r, 0, L, m, n); self.xf = old
    def text(self, s, x, y, z, size, m, face='-z', font='Anton', depth=0.0, align='CENTER'):
        """lettering whose front faces `face` (the side the reader stands on), centred on (x, y, z)"""
        cu = bpy.data.curves.new('t', 'FONT'); cu.body = s; cu.size = size; cu.align_x = align; cu.align_y = 'CENTER'
        cu.font = bpy.data.fonts.get(font) or bpy.data.fonts.load(os.path.join(FONTS, font + '.ttf')); cu.font.name = font
        cu.extrude = depth; cu.resolution_u = 2
        ob = bpy.data.objects.new('t', cu); bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        n = {'-z': Vector((0, 0, -1)), '+z': Vector((0, 0, 1)), '-x': Vector((-1, 0, 0)), '+x': Vector((1, 0, 0))}[face]
        up = Vector((0, 1, 0)); right = (-n).cross(up)
        tmp = bmesh.new(); tmp.from_mesh(me); k = self.mi(m); vmap = {}
        for v in tmp.verts:
            g = Vector((x, y, z)) + right * v.co.x + up * v.co.y + n * v.co.z
            vmap[v] = self._v(g)
        for f in tmp.faces:
            try: nf = self.bm.faces.new([vmap[v] for v in f.verts]); nf.material_index = k
            except ValueError: pass
        tmp.free(); bpy.data.objects.remove(ob); bpy.data.meshes.remove(me); bpy.data.curves.remove(cu)
    def export(self, extra_print='', keep=('cgl_daylight', 'cgl_lampglow', 'cgl_stoveglow', 'cgl_winlit', 'cgl_slate')):
        """Paint: every face's colour goes into a vertex colour and all of them share ONE material (one draw call for the
        whole building), except the materials the game lights (keep), which stay their own."""
        me = bpy.data.meshes.new(self.name + 'Mesh')
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=0.0005)
        paint = mat('paint_' + self.name.lower(), 0xffffff, 0.85)
        kept = [m for m in self.mats if any(m.name.startswith(k) for k in keep)]
        final = [paint] + kept; idx = {m: (final.index(m) if m in kept else 0) for m in self.mats}
        cl = self.bm.loops.layers.float_color.new('Col')
        for f in self.bm.faces:
            m = self.mats[f.material_index]; c = hex_lin(_HEX.get(m.name, 0xffffff)) if m not in kept else (1, 1, 1, 1)
            for l in f.loops: l[cl] = c
            f.material_index = idx[m]
        self.bm.to_mesh(me); self.bm.free(); self.mats = final
        if me.color_attributes.get('Col'): me.color_attributes.active_color = me.color_attributes['Col']; me.color_attributes.render_color_index = me.color_attributes.active_color_index
        for m in self.mats: me.materials.append(m)
        for p in me.polygons: p.use_smooth = False
        ob = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(ob)
        for o in bpy.context.scene.objects: o.select_set(o is ob)
        bpy.context.view_layer.objects.active = ob
        path = os.path.join(OUT, self.name + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                                  export_animations=False, export_normals=False, export_texcoords=False, export_materials='EXPORT',
                                  export_vertex_color='ACTIVE')
        print('EXPORT %-16s %6d tris %3d mats %7d bytes %s' % (self.name, sum(len(p.vertices) - 2 for p in me.polygons), len(self.mats), os.path.getsize(path), extra_print))
        bpy.data.objects.remove(ob); return path
