# blend: pines.blend
"""Original Gold Fever pines. Blender 4.5+, no downloaded geometry or textures.

Run: ~/blender/blender -b --python gold-fever/art/blender/pines.py
Ten scenes, each with origin-centred Near/Far asset collections and a Studio.
The default command re-execs with Vulkan before any GPU context is created.
-- --no-render rebuilds/export only; -- --only 05,06 renders selected previews.
"""
import os
import sys
from pathlib import Path
import bpy

if '--gpu-backend' not in sys.argv or sys.argv[sys.argv.index('--gpu-backend') + 1] != 'vulkan':
    os.execv(bpy.app.binary_path, [bpy.app.binary_path, '-b', '--factory-startup', '--gpu-backend', 'vulkan', '--python-exit-code', '1',
                             '--python', str(Path(__file__).resolve()), '--',
                             *(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])])

import gpu
import math
import random
import json
import struct
import subprocess
from mathutils import Vector

ART = Path(__file__).resolve().parent
OUT = ART.parents[1] / 'public/assets/trees'
RENDERS = ART / 'renders'
OUT.mkdir(parents=True, exist_ok=True)
RENDERS.mkdir(parents=True, exist_ok=True)
NAMES = ['Ponderosa', 'Lodgepole', 'Young pine', 'Dense mountain pine', 'Windswept',
         'Old twin', 'Half-dead', 'Dead snag', 'Pinyon', 'Lightning-struck']
HEIGHTS = [12, 11, 4, 8, 7, 9, 9, 8, 5, 7]


def linear(rgb):
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb)


def material(name, painted=False, color=(1, 1, 1), emission=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*linear(color), 1)
    b.inputs['Roughness'].default_value = .94
    if painted:
        c = m.node_tree.nodes.new('ShaderNodeVertexColor')
        c.layer_name = 'Color'
        m.node_tree.links.new(c.outputs['Color'], b.inputs['Base Color'])
    return m


class Design:
    def __init__(self, number):
        self.number = number
        self.rng = random.Random(9700 + number)
        self.wood = []
        self.needles = []
        self.cores = []
        self.bark = (.52, .29, .14) if number == 1 else (.37, .245, .135)
        if number == 8:
            self.bark = (.49, .46, .39)
        self.green = {1: (.255, .37, .17), 2: (.21, .32, .19), 3: (.29, .40, .18),
                      4: (.14, .255, .17), 5: (.25, .35, .21), 6: (.24, .32, .16),
                      7: (.31, .36, .18), 9: (.32, .38, .22), 10: (.22, .33, .17)}.get(number)

    def tube(self, points, radii, color=None, main=False, dead=False):
        self.wood.append((list(map(Vector, points)), radii, color or self.bark, main, dead))

    def clump(self, center, size, angle=0, shade=1):
        self.needles.append((Vector(center), Vector(size), angle, shade, self.rng.randrange(100000)))

    def limb(self, center, angle, reach, thick, lush=True, swept=0):
        c = Vector(center)
        d = Vector((math.cos(angle), math.sin(angle), 0))
        p = c + d * reach * .5 + Vector((swept * .35, 0, -.16 * reach))
        q = c + d * reach + Vector((swept, 0, .04 * reach))
        self.tube([c, p, q], [thick, thick * .58, .018 if lush else thick * .25], dead=not lush)
        if lush:
            shade = self.rng.uniform(.9, 1.11)
            self.clump(p + Vector((0, 0, .2 * reach)), (reach * .73, reach * .43, reach * .62), angle, shade)
            self.clump(q + Vector((0, 0, .08 * reach)), (reach * .54, reach * .32, reach * .50), angle, shade * 1.06)
            # Secondary woody fork, visible at close range, omitted in the far mesh.
            side = Vector((-d.y, d.x, .13))
            self.tube([p, p + side * reach * .4], [thick * .42, .009], main=False)
        else:
            fork = p + Vector((-d.y, d.x, .5)) * reach * .32
            self.tube([p, fork], [thick * .45, thick * .20], dead=True)

    def tiers(self, trunk, layers, swept=0):
        for k, (z, reach, count) in enumerate(layers):
            c = trunk(z)
            for j in range(count):
                a = j * math.tau / count + k * 1.63 + self.rng.uniform(-.18, .18)
                self.limb(c + Vector((0, 0, self.rng.uniform(-.32, .32) * reach)), a,
                          reach * self.rng.uniform(.76, 1.13), max(.04, reach * .065), swept=swept)

    def terminal(self, center, size):
        self.clump(center, size)
        for sign in (-1, 1):
            self.clump(Vector(center) + Vector((size[0] * sign * .6, size[1] * .2, -size[2] * .37)),
                       (size[0] * .90, size[1] * .8, size[2] * .50), sign * .8)

    def core(self, path, profile, breadth=1):
        self.cores.append((list(map(Vector, path)), profile, breadth))


def design(number):
    d = Design(number)
    h = HEIGHTS[number - 1]
    radius = {1: .37, 2: .21, 3: .15, 4: .29, 5: .28, 6: .48, 7: .32, 8: .35, 9: .30, 10: .38}[number]

    def trunk(z):
        t = z / h
        if number == 5:
            return Vector((1.6 * t ** 1.35, -.18 * t, z))
        if number in (6, 9):
            return Vector((.25 * math.sin(t * 6), .18 * math.sin(t * 4), z))
        if number == 8:
            return Vector((.48 * t + .14 * math.sin(t * 7), .12 * t, z))
        return Vector((.055 * math.sin(t * 9), .04 * math.sin(t * 5), z))

    top = {6: 4.4, 9: 2.6, 10: 6.0}.get(number, h * .96)
    levels = [top * i / 14 for i in range(15)]
    d.tube([trunk(z) for z in levels], [radius * (1 - .88 * z / h) for z in levels], main=True)
    # Grounded, modest root flare. Nothing below the ground plane.
    for j in range(5):
        a = j * math.tau / 5 + .3
        end = Vector((math.cos(a), math.sin(a), 0)) * radius * 2.25
        end.z = .035
        d.tube([Vector((0, 0, .36)), end], [radius * .40, .018], main=True)

    if number == 1:
        zs = [5.7, 6.8, 8.0, 9.3, 10.3, 11.5]
        d.core([trunk(z) for z in zs], [.40, .95, 1.1, .8, .5, .06])
        d.tiers(trunk, [(6.0, 1.8, 4), (7.0, 2.15, 5), (8.2, 2.05, 4), (9.25, 1.45, 4), (10.35, .85, 3)])
        for a in (0.4, 2.8, 4.5):
            d.limb(trunk(4.2), a, 1, .08, False)
        d.terminal(trunk(11.1), (.65, .50, 1.1))
    elif number == 2:
        zs = [7.0, 8.0, 9.1, 10.0, 10.9]
        d.core([trunk(z) for z in zs], [.35, .59, .48, .32, .025])
        d.tiers(trunk, [(7.1, 1.15, 4), (8.0, 1.18, 4), (8.9, .96, 4), (9.7, .65, 3)])
        d.terminal(trunk(10.4), (.43, .37, .9))
        d.limb(trunk(5.5), 1.4, .55, .04, False)
    elif number == 3:
        zs = [.18, 1.0, 1.8, 2.6, 3.25, 3.9]
        d.core([trunk(z) for z in zs], [.68, .92, .76, .56, .29, .02])
        d.tiers(trunk, [(.55, 1.15, 4), (1.2, 1.16, 4), (1.95, .98, 4), (2.65, .7, 4), (3.2, .42, 3)])
        d.terminal(trunk(3.65), (.35, .32, .62))
    elif number == 4:
        zs = [.70, 1.7, 2.9, 4.1, 5.3, 6.45, 7.8]
        d.core([trunk(z) for z in zs], [1.15, 1.4, 1.30, 1.10, .85, .50, .02])
        d.tiers(trunk, [(1.15, 2.0, 4), (2.25, 1.9, 4), (3.4, 1.7, 4), (4.5, 1.4, 4), (5.6, 1.03, 4), (6.7, .63, 3)])
        d.terminal(trunk(7.4), (.42, .37, .8))
    elif number == 5:
        zs = [2.5, 3.6, 4.8, 5.7, 6.65]
        d.core([trunk(z) + Vector((.48, 0, 0)) for z in zs], [.70, .94, .85, .53, .06], .83)
        d.tiers(trunk, [(2.7, 1.35, 4), (3.8, 1.4, 4), (4.9, 1.15, 4), (5.8, .8, 3)], swept=.85)
        d.terminal(trunk(6.45) + Vector((.48, 0, 0)), (.70, .48, .85))
        d.limb(trunk(1.7), 3.4, 1.0, .08, False)
    elif number == 6:
        for sign, leader_h in ((-1, 8.4), (1, 9.0)):
            start = trunk(3.7)
            def leader(z):
                t = (z - 3.7) / (leader_h - 3.7)
                return start + Vector((sign * (.3 + 1.05 * t), sign * .18 * t, z - 3.7))
            zs = [3.7 + (leader_h - 3.7) * i / 10 for i in range(11)]
            d.tube([start] + [leader(z) for z in zs[1:]], [.29] + [.27 * (1 - .9 * i / 10) for i in range(1, 11)], main=True)
            zs = [4.4, 5.5, 6.65, 7.6, leader_h - .15]
            d.core([leader(z) for z in zs], [.43, .62, .53, .36, .03])
            d.tiers(leader, [(4.6, 1.3, 3), (5.9, 1.2, 3), (7.1, .82, 3)])
            d.terminal(leader(leader_h - .4), (.55, .48, .8))
        d.limb(trunk(2.8), 2.4, 1.1, .13, False)
    elif number == 7:
        for k, z in enumerate((1.8, 3.0, 4.3, 5.4)):
            for j in range(3):
                d.limb(trunk(z), j * math.tau / 3 + k * 1.4, 1.5 - k * .14, .09, False)
        d.tiers(trunk, [(6.3, 1.1, 3), (7.4, .95, 3), (8.2, .55, 3)])
        d.terminal(trunk(8.55), (.32, .29, .65))
    elif number == 8:
        for k, z in enumerate((1.7, 3.1, 4.4, 5.6, 6.7)):
            for j in range(3):
                d.limb(trunk(z), j * math.tau / 3 + k * 1.8, 1.55 - k * .22, .10, False)
        d.tube([trunk(7.5), trunk(8) + Vector((.2, 0, 0))], [.10, .015], (.64, .58, .44), main=True, dead=True)
    elif number == 9:
        d.core([trunk(z) for z in (2.5, 3.25, 3.85, 4.5)], [.78, 1.45, 1.25, .16])
        for j in range(4):
            a = j * math.tau / 4 + .3
            c = trunk(1.2)
            q = c + Vector((math.cos(a) * 1.75, math.sin(a) * 1.75, 1.8))
            d.tube([c, c.lerp(q, .45) + Vector((0, 0, -.2)), q], [.19, .13, .045], main=True)
            d.tiers(lambda z, q=q: q + Vector((0, 0, z - 3)), [(2.8, 1.1, 3), (3.5, .72, 3)])
            d.clump(q + Vector((0, 0, 1.0)), (.85, .78, 1.0), a)
        d.limb(trunk(1.0), 4.1, 1.1, .10, False)
    elif number == 10:
        zs = [1.9, 2.9, 3.9, 4.75]
        d.core([trunk(z) for z in zs], [.80, .98, .83, .1])
        d.tiers(trunk, [(2.1, 1.7, 4), (3.25, 1.6, 4), (4.3, 1.10, 4)])
        char = (.12, .105, .085)
        d.tube([trunk(4.6), Vector((.15, 0, 6.35)), Vector((.06, .08, 7))], [.28, .19, .008], char, True, True)
        d.tube([trunk(5.5), Vector((-.36, .08, 6.75)), Vector((-.55, .13, 6.95))], [.14, .065, .006], char, True, True)
        d.limb(trunk(5.45), 0.2, .83, .1, False)
    return d


class Geometry:
    def __init__(self):
        self.vertices, self.faces, self.colors, self.materials = [], [], [], []
        self.normals = []

    def vertex(self, p):
        self.vertices.append(tuple(p))
        return len(self.vertices) - 1

    def face(self, ids, rgb, mat, normal=None):
        self.faces.append(ids)
        self.colors.append((*linear(tuple(max(.015, min(.95, v)) for v in rgb)), 1))
        self.materials.append(mat)
        self.normals.append(normal)

    def tube(self, points, radii, rgb, sides, seed):
        rng = random.Random(seed)
        rings = []
        for i, (p, radius) in enumerate(zip(points, radii)):
            axis = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
            u = axis.cross(Vector((0, 1, 0))).normalized()
            v = axis.cross(u).normalized()
            rings.append([self.vertex(p + radius * (1 + .035 * math.sin(j * 3 + i * .9)) *
                                      (u * math.cos(j * math.tau / sides) + v * math.sin(j * math.tau / sides))) for j in range(sides)])
        for i in range(len(rings) - 1):
            for j in range(sides):
                # Staggered ochre plates and dark fissures; actual COLOR_0 data.
                shade = rng.uniform(.78, 1.24) * (1.08 if j % 3 == 0 else .94)
                self.face([rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j]], tuple(c * shade for c in rgb), 0)
                if sides == 10 and len(points) > 5 and i % 2 == j % 2:
                    # Raised, irregular bark plates with dark seams behind them.
                    corners = [Vector(self.vertices[k]) for k in
                               (rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j])]
                    outward = (corners[1] - corners[0]).cross(corners[3] - corners[0]).normalized()
                    plaque = []
                    for u0, v0 in ((.13, .18), (.82, .11), (.88, .65), (.54, .92), (.12, .78)):
                        p0 = corners[0].lerp(corners[1], u0).lerp(corners[3].lerp(corners[2], u0), v0)
                        plaque.append(self.vertex(p0 + outward * min(.026, radii[i] * .065)))
                    self.face(plaque, tuple(c * min(1.28, shade + .12) for c in rgb), 0)
        self.face(list(reversed(rings[0])), tuple(c * .73 for c in rgb), 0)
        self.face(rings[-1], tuple(c * 1.2 for c in rgb), 0)

    def clump(self, center, size, angle, shade, seed, rgb, far):
        rng = random.Random(seed)
        sides = 5 if far else 10
        def point(x, y, z):
            return center + Vector(((x * math.cos(angle) - y * math.sin(angle)),
                                    (x * math.sin(angle) + y * math.cos(angle)), z))
        rings = []
        levels = [(0, 1)] if far else [(0, 1), (.38, .52)]
        for z, r in levels:
            ring = []
            for j in range(sides):
                a = math.tau * j / sides
                wobble = 1 + .12 * math.sin(a * 3 + seed)
                # Five pointed fingers with recessed valleys: solid needle boughs.
                if not far and r == 1 and j % 2:
                    wobble *= .66
                ring.append(self.vertex(point(math.cos(a) * size.x * r * wobble,
                                               math.sin(a) * size.y * r * wobble,
                                               size.z * (z + .10 * math.sin(a * 2 + seed) - .10 * math.cos(a)))))
            rings.append(ring)
        bottom = self.vertex(point(-.08 * size.x, 0, -.31 * size.z))
        tall = size.z > size.x * 1.2
        tip = self.vertex(point(-.26 * size.x, .06 * size.y, (.8 if tall else .67) * size.z))
        def upper_face(ids, color):
            # Common bough normals stabilize colour across LOD triangulations;
            # geometric facets still contribute, with dark solid undersides.
            ps = [Vector(self.vertices[k]) for k in ids]
            offset = sum(ps, Vector()) / len(ps) - center
            local = Vector((offset.x * math.cos(angle) + offset.y * math.sin(angle),
                            -offset.x * math.sin(angle) + offset.y * math.cos(angle), offset.z))
            local = Vector((local.x / size.x ** 2 * .55, local.y / size.y ** 2 * .55, 1 / size.z))
            proxy = Vector((local.x * math.cos(angle) - local.y * math.sin(angle),
                            local.x * math.sin(angle) + local.y * math.cos(angle), local.z)).normalized()
            actual = (ps[1] - ps[0]).cross(ps[2] - ps[0]).normalized()
            self.face(ids, color, 1, (actual * .3 + proxy * .7).normalized())
        for j in range(sides):
            nj = (j + 1) % sides
            self.face([bottom, rings[0][nj], rings[0][j]], tuple(c * shade * .70 for c in rgb), 1)
            for k in range(len(rings) - 1):
                s = shade * (.91 + .07 * k + .07 * math.sin(j * 2 + seed))
                upper_face([rings[k][j], rings[k][nj], rings[k + 1][nj], rings[k + 1][j]], tuple(c * s for c in rgb))
            s = shade * (1.09 + .05 * math.sin(j + seed))
            upper_face([rings[-1][j], rings[-1][nj], tip], tuple(c * s for c in rgb))

    def core(self, path, profile, breadth, rgb, far, seed):
        # Overlapping inner tufts, rather than a continuous cone: the crown
        # remains made of boughs even where it is dense around the leader.
        for i, (p, r) in enumerate(zip(path[:-1], profile[:-1])):
            gap = path[i + 1].z - p.z
            center = p + Vector((.14 * r * math.sin(i + seed), .1 * r * math.cos(i + seed), 0))
            self.clump(center, Vector((r * 1.18, r * breadth, gap * 1.5)),
                       seed + i * 1.6, .97, seed * 731 + i * 51, rgb, far)

    def object(self, name, collection, zscale):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([(x, y, max(0, z) * zscale) for x, y, z in self.vertices], [], self.faces)
        mesh.materials.append(BARK)
        if 1 in self.materials:
            mesh.materials.append(NEEDLES)
        attr = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        for p, col, mat in zip(mesh.polygons, self.colors, self.materials):
            p.material_index = mat
            for li in p.loop_indices:
                attr.data[li].color = col
        mesh.color_attributes.active_color = attr
        mesh.update()
        custom = []
        for p, normal in zip(mesh.polygons, self.normals):
            p.use_smooth = True
            n = Vector(normal) if normal is not None else p.normal.copy()
            # Transform authored normals by the inverse height correction.
            if normal is not None:
                n.z /= zscale
                n.normalize()
            custom.extend([tuple(n)] * p.loop_total)
        mesh.normals_split_custom_set(custom)
        ob = bpy.data.objects.new(name, mesh)
        collection.objects.link(ob)
        return ob


def geometry(d, far):
    g = Geometry()
    live_index = 0
    for i, (points, radii, color, main, dead) in enumerate(d.wood):
        if far:
            if not main and not dead and len(points) == 3:
                live_index += 1
                if d.number == 9 or (d.number == 1 and live_index > 17) or (d.number in (4, 6) and live_index % 2 == 0):
                    continue  # Omit only enclosed limbs, preserve exposed supports.
            # Tiny hidden live forks are unnecessary at distance. Bare forks remain.
            if not main and not dead and len(points) == 2:
                continue
            if main and len(points) > 5:
                keep = sorted(set([0, len(points) // 3, 2 * len(points) // 3, len(points) - 1]))
                points, radii = [points[k] for k in keep], [radii[k] for k in keep]
            elif not main and not dead and len(points) == 3:
                points, radii = [points[0], points[-1]], [radii[0], radii[-1]]
        g.tube(points, radii, color, (5 if main else 3) if far else (10 if main else 6), i + 100)
    for c in d.needles:
        g.clump(*c, d.green, far)
    for i, core in enumerate(d.cores):
        g.core(*core, d.green, far, i + d.number)
    return g


def export(ob, path):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.hide_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                             export_yup=True, export_normals=True, export_texcoords=False,
                             export_materials='EXPORT', export_vertex_color='ACTIVE',
                             export_all_vertex_colors=False, export_cameras=False,
                             export_lights=False, export_extras=True)
    ob.select_set(False)
    ob.hide_set(True)


def studio(scene, near, far, height):
    col = bpy.data.collections.new(scene.name + '.Studio')
    scene.collection.children.link(col)
    xmin, xmax = min(p.co.x for p in near.data.vertices), max(p.co.x for p in near.data.vertices)
    width = xmax - xmin
    spacing = max(width * 1.25, height * .53)
    for ob, sign in ((near, -1), (far, 1)):
        copy = bpy.data.objects.new(ob.name + '.Preview', ob.data)
        copy.location.x = sign * spacing * .5
        col.objects.link(copy)
    camera = bpy.data.objects.new('PreviewCamera', bpy.data.cameras.new('PreviewCamera'))
    col.objects.link(camera)
    # Near/frontal view keeps sideways wind and fork silhouettes easy to judge.
    target = Vector(((xmin + xmax) * .5, 0, height * .49))
    camera.location = target + Vector((.075, -1, .20)) * max(height, width) * 7
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    # Frame the actual projected pair, including off-centre leaning crowns.
    rotation = camera.rotation_euler.to_quaternion()
    inverse = rotation.inverted()
    projected = [inverse @ (p.co + Vector((sign * spacing * .5, 0, 0)) - target)
                 for ob, sign in ((near, -1), (far, 1)) for p in ob.data.vertices]
    xs, ys = [p.x for p in projected], [p.y for p in projected]
    target += rotation @ Vector(((min(xs) + max(xs)) * .5, (min(ys) + max(ys)) * .5, 0))
    camera.location = target + Vector((.075, -1, .20)) * max(height, width) * 7
    camera.data.ortho_scale = max(max(xs) - min(xs), (max(ys) - min(ys)) * 1000 / 850) * 1.17
    scene.camera = camera
    sun = bpy.data.objects.new('WarmSun', bpy.data.lights.new('WarmSun', 'SUN'))
    col.objects.link(sun)
    sun.data.energy = 2.3
    sun.data.angle = .08
    sun.data.color = (1, .86, .65)
    sun.rotation_euler = (.55, -.5, -.6)
    fill = bpy.data.objects.new('SkyFill', bpy.data.lights.new('SkyFill', 'AREA'))
    col.objects.link(fill)
    fill.location = (-height, -height * .4, height)
    fill.rotation_euler = (target - fill.location).to_track_quat('-Z', 'Y').to_euler()
    fill.data.energy = height * height * 16
    fill.data.size = height
    fill.data.color = (.72, .82, 1)
    mesh = bpy.data.meshes.new('StudioGround')
    mesh.from_pydata([(-100, -100, -.018), (100, -100, -.018), (100, 100, -.018), (-100, 100, -.018)], [], [(0, 1, 2, 3)])
    mesh.materials.append(GROUND)
    col.objects.link(bpy.data.objects.new('StudioGround', mesh))
    scene.world = bpy.data.worlds.new(scene.name + '.Sky')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (.32, .40, .48, 1)
    bg.inputs['Strength'].default_value = .65
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.eevee.taa_render_samples = 48
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 850
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(RENDERS / (scene.name + '.png'))


def inspect_glb(path, height, far):
    data = path.read_bytes()
    length, kind = struct.unpack_from('<II', data, 12)
    doc = json.loads(data[20:20 + length])
    assert kind == 0x4e4f534a
    primitives = [p for m in doc['meshes'] for p in m['primitives']]
    count = sum(doc['accessors'][p['indices']]['count'] // 3 for p in primitives)
    assert count <= (800 if far else 5000), (path.name, count)
    assert len(doc['materials']) <= 2
    assert {m['name'] for m in doc['materials']} <= {'PineBark', 'PineNeedles'}
    assert all(m.get('alphaMode', 'OPAQUE') == 'OPAQUE' for m in doc['materials'])
    assert all('COLOR_0' in p['attributes'] for p in primitives)
    lo = min(doc['accessors'][p['attributes']['POSITION']]['min'][1] for p in primitives)
    hi = max(doc['accessors'][p['attributes']['POSITION']]['max'][1] for p in primitives)
    assert abs(lo) < .0001 and abs(hi - height) < .0001, (path.name, lo, hi)
    assert len(doc['nodes']) == 1 and not any(k in doc['nodes'][0] for k in ('translation', 'rotation', 'scale', 'matrix'))
    return {'file': path.name, 'triangles': count, 'bytes': len(data), 'height_m': height,
            'materials': [m['name'] for m in doc['materials']]}


def contact_sheet(stats):
    # Pillow is used only for assembling/labeling Blender renders, never modeling.
    code = r'''
import sys, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(sys.argv[1]); names = json.loads(sys.argv[2]); heights = json.loads(sys.argv[3]); stats=json.loads(sys.argv[4])
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(fontpath,22); small=ImageFont.truetype(fontpath,17); title=ImageFont.truetype(fontpath,36)
w,h=600,595
sheet=Image.new('RGB',(w*5,h*2+105),'#e8dec9'); draw=ImageDraw.Draw(sheet)
draw.text((28,17),'GOLD FEVER / TEN ORIGINAL PINES',font=title,fill='#3d4634')
draw.text((30,65),'Blender procedural models  /  near left · far right  /  metres  /  solid needle geometry',font=small,fill='#5a604d')
for i,name in enumerate(names):
    x=(i%5)*w; y=105+(i//5)*h
    im=Image.open(root/f'pine-{i+1:02}.png').convert('RGB'); im.thumbnail((w-16,497))
    sheet.paste(im,(x+(w-im.width)//2,y+58))
    draw.text((x+20,y+8),f'{i+1:02}  {name}',font=font,fill='#333c2f')
    draw.text((x+20,y+37),f'{heights[i]} m  /  {stats[i*2]["triangles"]:,} near · {stats[i*2+1]["triangles"]:,} far tris',font=small,fill='#596149')
    draw.text((x+85,y+h-30),'NEAR',font=small,fill='#515c45'); draw.text((x+400,y+h-30),'FAR',font=small,fill='#515c45')
sheet.save(root/'pines-sheet.png',optimize=True)
'''
    subprocess.run(['/usr/bin/python3', '-c', code, str(RENDERS), json.dumps(NAMES),
                    json.dumps(HEIGHTS), json.dumps(stats)], check=True)


# Build everything from a clean datablock set. Never contact the live Blender.
bpy.ops.wm.read_factory_settings(use_empty=True)
BARK = material('PineBark', painted=True)
NEEDLES = material('PineNeedles', painted=True)
GROUND = material('StudioOchre', color=(.67, .57, .41))
stats = []
selected = None
if '--only' in sys.argv:
    selected = set(int(n) for n in sys.argv[sys.argv.index('--only') + 1].split(','))
for number in range(1, 11):
    sc = bpy.data.scenes.new(f'pine-{number:02}')
    bpy.context.window.scene = sc
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1
    d = design(number)
    gn, gf = geometry(d, False), geometry(d, True)
    # Shared height correction for both LODs; their tips remain identical.
    zscale = HEIGHTS[number - 1] / max(p[2] for p in gn.vertices)
    lods = []
    for g, far in ((gn, False), (gf, True)):
        name = sc.name + ('-far' if far else '')
        col = bpy.data.collections.new(sc.name + ('.Far' if far else '.Near'))
        sc.collection.children.link(col)
        ob = g.object(name, col, zscale)
        ob['height_m'] = HEIGHTS[number - 1]
        ob['species'] = NAMES[number - 1]
        ob['lod'] = 'far' if far else 'near'
        ob.hide_render = True
        export(ob, OUT / (name + '.glb'))
        stats.append(inspect_glb(OUT / (name + '.glb'), HEIGHTS[number - 1], far))
        lods.append(ob)
    studio(sc, *lods, HEIGHTS[number - 1])
    if '--no-render' not in sys.argv and (selected is None or number in selected):
        bpy.ops.render.render(write_still=True)
        renderer = gpu.platform.renderer_get()
        if 'AMD' not in renderer or gpu.platform.backend_type_get() != 'VULKAN':
            raise RuntimeError('Hardware rendering required: ' + renderer)
        print('Verified GPU:', renderer, flush=True)
    print('PINE_AUDIT', json.dumps(stats[-2:]), flush=True)
for sc in list(bpy.data.scenes):
    if sc.name == 'Scene':
        bpy.data.scenes.remove(sc)
bpy.context.window.scene = bpy.data.scenes['pine-01']
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'pines.blend'), compress=True)
(ART / 'pines-manifest.json').write_text(json.dumps(stats, indent=2) + '\n')
if '--no-render' not in sys.argv:
    contact_sheet(stats)
print('FINISHED: ten scenes, twenty audited exports, pines.blend and previews.', flush=True)
