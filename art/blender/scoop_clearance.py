"""Check the saved Scoop's actual deformed meshes, including between-frame poses.

~/blender/blender -b art/blender/characters.blend --python-exit-code 1 \
    --python art/blender/scoop_clearance.py
Checks every quarter-frame, including the matching loop endpoint. No drawing.
"""
import json
import math
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

bpy.context.window.scene = bpy.data.scenes['Camper']
bpy.data.collections['Export'].hide_viewport = False
rig = bpy.data.objects['CGLCamper_Rig']
rig.animation_data.action = bpy.data.actions['Scoop']
rig.animation_data.action_slot = bpy.data.actions['Scoop'].slots[0]
torso = bpy.data.objects['CGLCamper_Torso']
parts = [bpy.data.objects['CGLCamper_L_Sleeve'], bpy.data.objects['CGLCamper_L_Hand']]

def mesh_data(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    triangles = [tuple(triangle.vertices) for triangle in mesh.loop_triangles]
    # Include triangulation diagonals: they are part of the mesh surface too.
    edges = sorted({tuple(sorted((triangle[i], triangle[(i + 1) % 3])))
                    for triangle in triangles for i in range(3)})
    evaluated.to_mesh_clear()
    return vertices, triangles, edges

def surface_distance(av, at, ae, bv, bt, be):
    """Exact disjoint triangle-mesh distance: vertex/face and edge/edge candidates.

    Vertex/face distances use Blender's BVH. Vectorized segment/segment distances
    also catch minima inside two edges rather than at a sampled mesh vertex.
    """
    a_tree = BVHTree.FromPolygons(av, at, all_triangles=True)
    b_tree = BVHTree.FromPolygons(bv, bt, all_triangles=True)
    overlaps = len(a_tree.overlap(b_tree))
    inside = 0
    minimum = float('inf')
    for vertex in av:
        point, normal, _, distance = b_tree.find_nearest(vertex)
        inside += (vertex - point).dot(normal) < -1e-7
        minimum = min(minimum, distance)
    for vertex in bv:
        minimum = min(minimum, a_tree.find_nearest(vertex)[3])
    assert not overlaps and not inside, f'{overlaps} triangle intersections, {inside} vertices inside torso'
    a_vertices = np.asarray(av, dtype=np.float64)
    b_vertices = np.asarray(bv, dtype=np.float64)
    a_edges = a_vertices[np.asarray(ae)]
    b_edges = b_vertices[np.asarray(be)]
    a_edges = a_edges[np.sum((a_edges[:, 1] - a_edges[:, 0]) ** 2, axis=1) > 1e-20]
    b_edges = b_edges[np.sum((b_edges[:, 1] - b_edges[:, 0]) ** 2, axis=1) > 1e-20]
    b_start = b_edges[None, :, 0, :]
    b_direction = (b_edges[:, 1] - b_edges[:, 0])[None, :, :]
    dot = lambda a, b: np.einsum('...i,...i->...', a, b)
    e = dot(b_direction, b_direction)
    for offset in range(0, len(a_edges), 64):
        chunk = a_edges[offset:offset + 64]
        start = chunk[:, None, 0, :]
        direction = (chunk[:, 1] - chunk[:, 0])[:, None, :]
        r = start - b_start
        a = dot(direction, direction)
        b = dot(direction, b_direction)
        c = dot(direction, r)
        f = dot(b_direction, r)
        denominator = a * e - b * b
        s = np.clip(np.divide(b * f - c * e, denominator,
                             out=np.zeros_like(denominator), where=denominator > 1e-20), 0, 1)
        t = (b * s + f) / e
        s = np.where(t < 0, np.clip(-c / a, 0, 1), s)
        s = np.where(t > 1, np.clip((b - c) / a, 0, 1), s)
        t = np.clip(t, 0, 1)
        separation = r + s[..., None] * direction - t[..., None] * b_direction
        minimum = min(minimum, math.sqrt(float(np.min(dot(separation, separation)))))
    return minimum

worst = {part.name: {'clearance_m': float('inf')} for part in parts}
max_grip_error = 0.0
for sample in range(181):
    frame = sample / 4
    bpy.context.scene.frame_set(int(frame), subframe=frame % 1)
    bpy.context.view_layer.update()
    torso_mesh = mesh_data(torso)
    for part in parts:
        try:
            clearance = surface_distance(*mesh_data(part), *torso_mesh)
        except AssertionError as error:
            raise AssertionError(f'frame {frame}, {part.name}: {error}') from error
        if clearance < worst[part.name]['clearance_m']:
            worst[part.name] = {'clearance_m': clearance, 'frame': frame}
        assert clearance > .01, f'frame {frame}, {part.name}: clearance {clearance}m < 1cm'
    hand = parts[1]
    # The grip target is unchanged: Blender local shaft z=.27 (glTF local y=.27).
    hand_center = hand.matrix_world @ (sum((Vector(v) for v in hand.bound_box), Vector()) / 8)
    grip = bpy.data.objects['CGLCamper_R_ShovelShaft'].matrix_world @ Vector((0, 0, .27))
    max_grip_error = max(max_grip_error, (hand_center - grip).length)
assert max_grip_error < .02, f'left grip error {max_grip_error}m exceeds 2cm'
print('SCOOP_CLEARANCE', json.dumps({'samples': 181, 'triangle_intersections': 0,
    'contained_vertices': 0, 'worst': worst, 'max_grip_error_m': max_grip_error}, sort_keys=True))
