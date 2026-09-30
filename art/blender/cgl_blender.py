"""Camp Green Lake asset toolkit for the live Blender (run through the blender-mcp socket).

Every asset gets its OWN SCENE in its group's .blend (buildings/props/finds/creatures/characters.blend, see README):
  - collection "Asset"  : the model itself (the only thing exported to GLB)
  - collection "Studio" : camera, key/fill lights and a shadow-catching floor, for preview renders
Units are metres, +Z up in Blender (the glTF exporter converts to the game's +Y up). An asset's
origin sits on the ground at its footprint centre, so the game can drop it at (x, groundAt(x,z), z).

Style: chunky low-poly, flat colours per part, small bevels so edges catch the desert sun, a touch
of per-part colour variation for wear. Keep props under ~3k triangles.
"""
import bpy, bmesh, math, random, os
from mathutils import Vector

ART = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else '/home/botuser/camp-green-lake-blockbench/art/blender'
RENDERS = os.path.join(ART, 'renders')
os.makedirs(RENDERS, exist_ok=True)

# ---- palette: pulled from the game's existing colours (20-world.js, 22-security.js, game.css) ----
PAL = {
    'steel': (0x4d, 0x5a, 0x58), 'mesh': (0x75, 0x81, 0x7a), 'concrete': (0x91, 0x84, 0x6e), 'wire': (0xb2, 0xa9, 0x9a),
    'wood': (0x7a, 0x5a, 0x3a), 'wood_dark': (0x5a, 0x3f, 0x28), 'wood_pale': (0xa8, 0x86, 0x5c), 'canvas': (0xc9, 0xb2, 0x86),
    'olive': (0x6b, 0x6a, 0x45), 'rust': (0x8a, 0x4b, 0x2a), 'paint_white': (0xee, 0xe0, 0xbc), 'paint_red': (0xa6, 0x44, 0x2e),
    'paint_green': (0x3f, 0x5a, 0x3a), 'ink': (0x2b, 0x1d, 0x12), 'brass': (0xc8, 0x9b, 0x3c), 'mattress': (0x8e, 0x8a, 0x6e),
    'blanket': (0x5b, 0x63, 0x4a), 'sand': (0xe3, 0xbf, 0x86),
}
def srgb(c):
    """0-255 sRGB triple -> linear floats for Blender material colours."""
    f = lambda v: (v / 255) / 12.92 if v / 255 <= 0.04045 else (((v / 255) + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)

def mat(name, col, rough=0.85, metal=0.0):
    """One Principled material per name, reused across scenes (glTF exports base colour/rough/metal)."""
    if not isinstance(name, str): name = 'c' + ''.join('%02x' % int(v) for v in name)   # a raw colour triple names itself
    m = bpy.data.materials.get('cgl_' + name)
    if not m:
        m = bpy.data.materials.new('cgl_' + name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = srgb(PAL[col] if isinstance(col, str) else col)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    m.diffuse_color = b.inputs['Base Color'].default_value
    return m

# ---- scenes ----
def scene(name, fresh=True):
    """Switch to (and by default wipe) the scene for one asset, with Asset + Studio collections."""
    sc = bpy.data.scenes.get(name)
    if sc and fresh:
        for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
        for c in list(sc.collection.children): bpy.data.collections.remove(c)
    if not sc: sc = bpy.data.scenes.new(name)
    bpy.context.window.scene = sc
    for cname in ('Asset', 'Studio'):
        if not sc.collection.children.get(name + '.' + cname):
            sc.collection.children.link(bpy.data.collections.new(name + '.' + cname))
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.unit_settings.system = 'METRIC'
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    if not sc.world: sc.world = bpy.data.worlds.new(name + '.World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.55, 0.62, 0.72, 1); bg.inputs['Strength'].default_value = 0.6   # desert sky fill
    return sc

def coll(kind='Asset'):
    sc = bpy.context.window.scene
    return sc.collection.children[sc.name + '.' + kind]

def _link(o, kind='Asset'):
    for c in o.users_collection: c.objects.unlink(o)
    coll(kind).objects.link(o); return o

# ---- modelling helpers (all return the object; sizes are full extents in metres) ----
def box(name, size, loc, material, rot=(0, 0, 0), bevel=0.012, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, material, bevel, parent)

def cyl(name, r, depth, loc, material, verts=10, rot=(0, 0, 0), bevel=0.008, r2=None, parent=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    return _finish(o, material, bevel, parent)

def _finish(o, material, bevel, parent):
    _link(o)
    o.data.materials.clear(); o.data.materials.append(mat(*material) if isinstance(material, tuple) else mat(material, material))
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = 1; m.limit_method = 'ANGLE'; m.harden_normals = True
    for p in o.data.polygons: p.use_smooth = False
    if parent: o.parent = parent
    return o

def root(name):
    """An empty at the origin that every part of the asset hangs off (becomes the glTF root node)."""
    o = bpy.data.objects.new(name, None); o.empty_display_type = 'PLAIN_AXES'; _link(o); return o

# ---- studio + preview ----
def studio(target=(0, 0, 1), dist=6, elev=22, azim=-38, lens=50, floor=True):
    """3/4 view camera looking at `target`, warm sun key, cool fill, and a sand floor that catches shadows."""
    sc = bpy.context.window.scene
    t = Vector(target); a, e = math.radians(azim), math.radians(elev)
    cam = bpy.data.objects.new(sc.name + '.cam', bpy.data.cameras.new(sc.name + '.cam')); _link(cam, 'Studio')
    cam.location = t + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens; sc.camera = cam
    sun = bpy.data.objects.new(sc.name + '.sun', bpy.data.lights.new(sc.name + '.sun', 'SUN')); _link(sun, 'Studio')
    sun.data.energy = 4.2; sun.data.color = (1.0, 0.93, 0.8); sun.data.angle = math.radians(2.5)
    sun.rotation_euler = (math.radians(50), 0, math.radians(azim - 55))
    fill = bpy.data.objects.new(sc.name + '.fill', bpy.data.lights.new(sc.name + '.fill', 'AREA')); _link(fill, 'Studio')
    fill.data.energy = 350; fill.data.size = 6; fill.data.color = (0.75, 0.85, 1.0)
    fill.location = t + Vector((-math.sin(a) * 5, math.cos(a) * 5, 3)); fill.rotation_euler = (t - fill.location).to_track_quat('-Z', 'Y').to_euler()
    if floor:
        bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); f = bpy.context.active_object; f.name = sc.name + '.floor'
        _link(f, 'Studio'); f.data.materials.append(mat('sand', 'sand', 0.95))
    return cam

def frame(margin=1.12, extra=()):
    """Aim the studio camera (keeping its angle) so the whole asset, plus any `extra` objects, fills the shot."""
    sc = bpy.context.window.scene; cam = sc.camera; dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in list(coll('Asset').all_objects) + list(extra):
        if o.type in ('MESH', 'EMPTY') and o.type == 'MESH' or o.instance_type == 'COLLECTION':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    if not pts: return
    ctr = sum(pts, Vector()) / len(pts); fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    cam.location = ctr - fwd * 50
    bpy.context.view_layer.update()
    flat = [c for p in pts for c in p]
    loc, scale = cam.camera_fit_coords(dg, flat)
    cam.location = ctr + (Vector(loc) - ctr) * margin

def instance(name, scene_name, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Place another asset (its Asset collection) into this scene's Studio as a preview-only neighbour."""
    o = bpy.data.objects.new(name, None); o.instance_type = 'COLLECTION'
    o.instance_collection = bpy.data.collections[scene_name + '.Asset']; o.location = loc; o.rotation_euler = rot
    _link(o, 'Studio'); return o

def render(name=None, res=(1024, 768), samples=48):
    sc = bpy.context.window.scene
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.eevee.taa_render_samples = samples
    try: sc.eevee.use_shadows = True
    except Exception: pass
    sc.render.filepath = os.path.join(RENDERS, (name or sc.name) + '.png')
    bpy.ops.render.render(write_still=True)
    return sc.render.filepath

def tris():
    dg = bpy.context.evaluated_depsgraph_get(); n = 0
    for o in coll('Asset').all_objects:
        if o.type == 'MESH':
            m = o.evaluated_get(dg).to_mesh(); n += sum(len(p.vertices) - 2 for p in m.polygons); o.evaluated_get(dg).to_mesh_clear()
    return n

def export_glb(path, vcol=False):
    """Export ONLY this scene's Asset, baked into ONE mesh (modifiers + transforms applied, one
    material slot per material) so the game draws each asset in a handful of calls. +Y up."""
    sc = bpy.context.window.scene; dg = bpy.context.evaluated_depsgraph_get()
    tmpc = bpy.data.collections.new(sc.name + '.Export'); sc.collection.children.link(tmpc)
    parts = []
    for o in coll('Asset').all_objects:
        if o.type != 'MESH': continue
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        me.transform(o.matrix_world)
        t = bpy.data.objects.new(o.name + '.x', me); tmpc.objects.link(t); parts.append(t)
    for x in bpy.context.selected_objects: x.select_set(False)
    for t in parts: t.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join(); j = bpy.context.active_object; j.name = sc.name; j.data.name = sc.name
    bpy.ops.object.material_slot_remove_unused()
    lc = bpy.context.view_layer.layer_collection.children[tmpc.name]
    bpy.context.view_layer.active_layer_collection = lc
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_active_scene=True, use_active_collection=True,
                              export_apply=True, export_yup=True, export_normals=True, export_materials='EXPORT',
                              export_extras=False, export_cameras=False, export_lights=False, export_texcoords=True,
                              **({'export_vertex_color': 'ACTIVE'} if vcol else {}))   # vcol: rocks/tumbleweed carry their paint as vertex colours
    info = (len(j.data.polygons), len(j.material_slots))
    me = j.data; bpy.data.objects.remove(j, do_unlink=True); bpy.data.meshes.remove(me); bpy.data.collections.remove(tmpc)
    return path, os.path.getsize(path), info

# ---- text (painted/raised lettering), converted to mesh so it exports cleanly ----
FONTS = os.path.join(os.path.dirname(ART), 'fonts')
def font(name):
    f = bpy.data.fonts.get(name)
    return f or bpy.data.fonts.load(os.path.join(FONTS, name + '.ttf'))

def text(name, s, loc, size, material, fontname='Anton', extrude=0.006, rot=(math.pi / 2, 0, 0), parent=None, align='CENTER', space=1.0):
    """Lettering standing in the XZ plane facing -Y (the sign's front), centred on `loc`."""
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = s; cu.font = font(fontname); cu.size = size
    cu.align_x = align; cu.align_y = 'CENTER'; cu.extrude = extrude; cu.space_character = space; cu.resolution_u = 2
    o = bpy.data.objects.new(name, cu); bpy.context.window.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = rot
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True); bpy.ops.object.convert(target='MESH')
    o = bpy.context.active_object; o.name = name
    return _finish(o, material, 0, parent)

def vcol_mat(name, rough=1.0):
    """A material that shows the mesh's colour attribute (what vertex-painted rocks export as COLOR_0)."""
    m = bpy.data.materials.get('cgl_' + name)
    if m: return m
    m = bpy.data.materials.new('cgl_' + name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
    nt.links.new(a.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = rough
    return m
