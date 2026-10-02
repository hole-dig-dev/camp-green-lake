"""Blender-only hollow fittings. Exec after cgl_blender.py; dimensions are metres.
Core glTF alpha BLEND works with the game's r128 adapter. Both wall surfaces and
annular end rims are geometry; no end caps obstruct the bore, no transmission.
"""
from mathutils import Vector
PIPE_RADIUS, PIPE_BORE, PIPE_AXIS = 0.12, 0.108, 0.24
CLEAR = ('pipe_clear', (172, 211, 216), 0.22, 0.0)
EDGE = ('pipe_edge', (126, 177, 183), 0.38, 0.0)


def pipeline_export(path, origin):
    """Reserve the exact asset name for the exported mesh, then restore its root.
    Otherwise Blender appends .001 because the authoring empty owns that name.
    """
    name = origin.name
    origin.name = name + '_authoring_origin'
    try: return export_glb(path)
    finally: origin.name = name


def pipe_material(spec, alpha):
    m = mat(*spec)
    m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = alpha
    m.diffuse_color = (*m.diffuse_color[:3], alpha)
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = True
    return m


def pipe_mesh(name, verts, faces, material, parent=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    _link(o)
    if parent: o.parent = parent
    me.materials.append(material)
    return o


def hollow_path(name, points, outer=PIPE_RADIUS, inner=PIPE_BORE,
                material=None, parent=None, sides=20, ragged=None):
    """Parallel-transported shell with open rims. ragged offsets the last end."""
    pts = [Vector(p) for p in points]
    verts, faces, previous = [], [], None
    for i, p in enumerate(pts):
        tangent = (pts[min(i+1, len(pts)-1)] - pts[max(0, i-1)]).normalized()
        if previous is None:
            seed = Vector((0, 1, 0)) if abs(tangent.y) < 0.9 else Vector((1, 0, 0))
            u = (seed - tangent * seed.dot(tangent)).normalized()
        else: u = (previous - tangent * previous.dot(tangent)).normalized()
        v = tangent.cross(u).normalized()
        previous = u
        for radius in (outer, inner):
            for k in range(sides):
                a = math.tau*k/sides
                q = p + radius*(u*math.cos(a) + v*math.sin(a))
                if ragged is not None and i == len(pts)-1: q.x += ragged[k]
                verts.append(q)
    stride = sides*2
    for i in range(len(pts)-1):
        for k in range(sides):
            j, a, b = (k+1)%sides, i*stride, (i+1)*stride
            faces.append((a+k, a+j, b+j, b+k))
            faces.append((a+sides+j, a+sides+k, b+sides+k, b+sides+j))
    for k in range(sides):
        j, a = (k+1)%sides, (len(pts)-1)*stride
        faces.append((k+sides, j+sides, j, k))
        faces.append((a+k, a+j, a+sides+j, a+sides+k))
    return pipe_mesh(name, verts, faces, material or pipe_material(CLEAR, 0.16), parent)


def ring_x(name, x, width, radius, bore, material, parent=None, y=0, z=PIPE_AXIS):
    return hollow_path(name, [(x-width/2, y, z), (x+width/2, y, z)],
                       radius, bore, mat(*material), parent, sides=20)


def inlet_points():
    """Socket -> upright -> overhead elbow -> outlet, Blender frame."""
    pts = [(-1.9, 0, PIPE_AXIS), (-1.88, 0, PIPE_AXIS)]
    for k in range(1, 9):
        a = -math.pi/2 + k*math.pi/16
        pts.append((-1.88+0.28*math.cos(a), 0, 0.52+0.28*math.sin(a)))
    pts.append((-1.6, 0, 1.96))
    for k in range(1, 9):
        a = math.pi - k*math.pi/16
        pts.append((-1.32+0.28*math.cos(a), 0, 1.96+0.28*math.sin(a)))
    pts.append((-1.13, 0, 2.24))
    for k in range(1, 9):
        a = math.pi/2 - k*math.pi/16
        pts.append((-1.13+0.28*math.cos(a), 0, 1.96+0.28*math.sin(a)))
    pts.append((-0.85, 0, 1.9))
    return pts
