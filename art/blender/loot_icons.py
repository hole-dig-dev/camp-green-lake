"""art/blender/loot_icons.py : inventory and store icons made from the game's own models.

The first icons were cut from painted sheets (docs/art/*-chatgpt-sheet.png: bold cartoon objects with a thick dark
brown outline, 128 px cut-outs). The items that changed with the DRYWATER setting (docs/STORY.md) are drawn here
instead, from the same GLB the game shows when you dig the thing up, in that look: a three-quarter view, warm key
light, flat chunky shading, then a dark brown outline and a 128 px cut-out.

Two steps, one file:
  1. blender -b --factory-startup --python art/blender/loot_icons.py     renders 512 px cut-outs to art/blender/renders/icons/
  2. python3 art/blender/loot_icons.py                                    (needs Pillow) outlines, squares and scales them
                                                                          into public/icons/<folder>/<key>.png
Add an icon: one line in ICONS. 'model' is a GLB in public/models, or 'bitterroot' for the plant built below (the
store's bitterroot has no model in the game).
"""
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'renders', 'icons')
PUB = os.path.join(HERE, '..', '..', 'public')
# out (under public/icons), model, azimuth and elevation of the camera (degrees), roll of the object (degrees, 0 = upright)
ICONS = [
    ('loot/kb.png',          'LMCase',           -30, 14, -14),
    ('loot/suitcase.png', 'FindLilStrongbox', -32, 20, 0),
    ('loot/lipstick.png',   'FindMatchSafe',    -30, 14, 16),
    ('gear/onion.png',       'bitterroot',       -20, 12, 0),
]
OUTLINE = (58, 34, 18)                 # the sheets' dark brown
SIZE = 128

try: import bpy
except ImportError: bpy = None

if bpy:
    from mathutils import Vector, Matrix
    def lin(c): return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92
    def mat(name, hexcol, rough=0.7, metal=0.0):
        m = bpy.data.materials.new(name); m.use_nodes = True
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = tuple(lin(((hexcol >> s) & 255) / 255) for s in (16, 8, 0)) + (1.0,)
        b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
        return m
    def blob(name, loc, scale, m, rot=(0, 0, 0), sub=2):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=loc, rotation=rot)
        o = bpy.context.active_object; o.name = name; o.scale = scale; o.data.materials.append(m); return o
    def cone(name, r1, r2, length, top, tilt, m):
        """A tapering root hanging from `top`, leaning `tilt` radians from straight down (about Y)."""
        bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=r2, radius2=r1, depth=length)
        o = bpy.context.active_object; o.name = name; o.data.materials.append(m)
        o.matrix_world = Matrix.Translation(Vector(top)) @ Matrix.Rotation(tilt, 4, 'Y') @ Matrix.Translation((0, 0, -length / 2)); return o
    def bitterroot():
        """A dug-up bitterroot: a pale forked taproot, a rosette of thin fleshy leaves and one pink flower."""
        ROOT = mat('br_root', 0xdcb98c); ROOT_D = mat('br_root_dark', 0xa97c50); LEAF = mat('br_leaf', 0x6f9a3a); PETAL = mat('br_petal', 0xe77fa8); EYE = mat('br_eye', 0xf2d24a)
        cone('tap', 0.016, 0.003, 0.085, (0, 0, 0.09), 0.0, ROOT)
        cone('fork_l', 0.010, 0.002, 0.07, (-0.004, 0, 0.06), 0.55, ROOT); cone('fork_r', 0.009, 0.002, 0.06, (0.004, 0, 0.066), -0.6, ROOT)
        cone('hair_l', 0.004, 0.001, 0.035, (-0.02, 0, 0.03), 0.2, ROOT_D); cone('hair_r', 0.004, 0.001, 0.03, (0.006, 0.002, 0.035), -0.25, ROOT_D)
        blob('crown', (0, 0, 0.092), (0.018, 0.018, 0.012), ROOT_D)
        for k in range(9):
            a = k * 2 * math.pi / 9; d = 0.03
            blob('leaf%d' % k, (math.cos(a) * d, math.sin(a) * d, 0.104), (0.026, 0.0055, 0.0045), LEAF, rot=(0, -0.45, a), sub=1)
        for k in range(8):
            a = k * 2 * math.pi / 8 + 0.2; d = 0.019
            blob('petal%d' % k, (math.cos(a) * d, math.sin(a) * d, 0.128), (0.017, 0.008, 0.003), PETAL, rot=(0, -0.5, a), sub=1)
        blob('eye', (0, 0, 0.127), (0.007, 0.007, 0.005), EYE, sub=1)
    def shot(out, model, azim, elev, roll):
        for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
        if model == 'bitterroot': bitterroot()
        else: bpy.ops.import_scene.gltf(filepath=os.path.join(PUB, 'models', model + '.glb'))
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        for o in meshes:
            for p in o.data.polygons: p.use_smooth = False
        if roll:
            R = Matrix.Rotation(math.radians(roll), 4, 'Y')
            for o in meshes: o.matrix_world = R @ o.matrix_world
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
        lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
        ctr = (lo + hi) / 2; size = (hi - lo).length
        sc = bpy.context.scene; a, e = math.radians(azim), math.radians(elev)
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.08; cam.data.clip_start = size * 0.01; cam.data.clip_end = size * 20
        cam.location = ctr + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * size * 4
        cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
        for name, energy, col, rot in (('key', 4.0, (1.0, 0.93, 0.8), (50, 0, azim - 50)), ('fill', 1.2, (0.8, 0.88, 1.0), (60, 0, azim + 110))):
            l = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN')); sc.collection.objects.link(l)
            l.data.energy = energy; l.data.color = col; l.data.angle = math.radians(6); l.rotation_euler = tuple(math.radians(v) for v in rot)
        if not sc.world: sc.world = bpy.data.worlds.new('w')
        sc.world.use_nodes = True; bg = next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND')
        bg.inputs[0].default_value = (0.85, 0.8, 0.72, 1); bg.inputs[1].default_value = 0.9
        sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48; sc.cycles.use_denoising = False
        sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = 512; sc.render.resolution_percentage = 100
        sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
        sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
        sc.render.filepath = os.path.join(RAW, out.replace('/', '_')); os.makedirs(RAW, exist_ok=True)
        bpy.ops.render.render(write_still=True); print('ICON raw', sc.render.filepath)
    for job in ICONS: shot(*job)
else:
    from PIL import Image, ImageFilter, ImageEnhance, ImageChops
    for out, model, *_ in ICONS:
        im = Image.open(os.path.join(RAW, out.replace('/', '_'))).convert('RGBA')
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
        k = max(im.size); pad = int(k * 0.07)                       # room for the outline
        sq = Image.new('RGBA', (k + 2 * pad, k + 2 * pad), (0, 0, 0, 0)); sq.paste(im, (pad + (k - im.width) // 2, pad + (k - im.height) // 2)); im = sq
        rgb = ImageEnhance.Color(ImageEnhance.Contrast(im.convert('RGB')).enhance(1.15)).enhance(1.25)
        # the cartoon look: darken the creases (edges of the shaded picture), then a thick outline round the silhouette
        edges = rgb.convert('L').filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 - min(255, int(v * 2.2)))
        rgb = ImageChops.multiply(rgb, Image.merge('RGB', (edges, edges, edges)))
        a = im.getchannel('A'); w = max(3, int(im.width * 0.022) | 1)
        ring = a.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(2 * w + 1)).filter(ImageFilter.GaussianBlur(1))
        base = Image.new('RGBA', im.size, OUTLINE + (0,)); base.putalpha(ring)
        base.alpha_composite(Image.merge('RGBA', (*rgb.split(), a)))
        dst = os.path.join(PUB, 'icons', out); base.resize((SIZE, SIZE), Image.LANCZOS).save(dst, optimize=True); print('ICON', dst)
