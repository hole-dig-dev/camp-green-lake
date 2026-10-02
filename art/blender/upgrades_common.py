"""Shared Blender modelling/export helpers for the upgrade batch (metres)."""
from pathlib import Path
import bpy, math, random, shutil
from mathutils import Vector

HERE = Path(__file__).resolve().parent
exec((HERE / 'cgl_blender.py').read_text())
exec((HERE / 'pipeline_common.py').read_text())
OUT = HERE / 'glb'
PUBLIC = HERE.parents[1] / 'public/models'
STEEL = ('upgrade_steel', (98, 112, 110), .46, .65)
DARK = ('upgrade_dark', (43, 49, 46), .8, .15)
BRASS = ('upgrade_brass', (216, 168, 66), .38, .65)
RED = ('upgrade_red', (185, 49, 35), .8, 0)
WOOD = ('upgrade_wood', (129, 90, 54), .9, 0)
STRAW = ('upgrade_straw', (222, 184, 106), .95, 0)
CANVAS = ('upgrade_canvas', (148, 139, 88), .94, 0)
CREAM = ('upgrade_cream', (237, 217, 173), .9, 0)

def begin(name):
    scene(name)
    return root(name)

def tube(name, a, b, radius, material, parent, sides=8, tip=None):
    a, b = Vector(a), Vector(b)
    o = cyl(name, radius, (b-a).length, (a+b)/2, material,
            verts=sides, bevel=0, r2=tip, parent=parent)
    o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return o

def lump(name, loc, scale, material, parent, subdiv=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1, location=loc)
    o = bpy.context.object
    o.name, o.scale = name, scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, material, 0, parent)

def torus(name, loc, radius, thickness, material, parent, rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=thickness,
        major_segments=20, minor_segments=6, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    return _finish(o, material, 0, parent)

def preview(name=None, elev=25, azim=-38, floor=True):
    studio(elev=elev, azim=azim, floor=floor)
    bpy.context.view_layer.update()
    frame(margin=1.24)
    return render(name=name, res=(640, 520), samples=24)

def finish(name, origin, **kwargs):
    preview(**kwargs)
    p = pipeline_export(str(OUT / (name+'.glb')), origin)
    shutil.copy2(p[0], PUBLIC / (name+'.glb'))
    print('UPGRADE', name, p[1:])
