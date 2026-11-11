"""Bare-hand digging clips (2026-11-11), exported as animation-only GLBs so the approved camper.glb and
camper-fp.glb are never rebuilt:

  public/models/anim-handdig.glb   'HandDig'  third person: crouch, both hands rake sand in toward the knees,
                                              cup it, and fling it off to the right (where the Scoop tosses)
  public/models/anim-handsfp.glb   'HandsFP'  first person: the same, posed for the eye like ScoopFP

Both clips use the Scoop's 45-frame timing (blender/cgl_rig.py SCOOP_TIMES: planted 8, levered 16, loaded 25,
tossed 35), so the game drives them with the same scoopTime() as the shovel. Only the armature is exported:
the tracks name the same bones as the camper (and the FP arms), and three.js binds them by name.

~/blender/blender -b --factory-startup --python-exit-code 1 --python art/blender/hands_dig_export.py
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector, Euler

repo = Path(__file__).resolve().parents[2]
source = repo / 'blender/cgl_scoopfp.py'
ns = {'__file__': str(source)}
exec(compile(source.read_text(), str(source), 'exec'), ns)
g = ns   # the rig helpers (cgl_rig.py via cgl_scoopfp.py)
FRAMES = 45


def clear():
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)


def smooth_keys(phases, frame):
    a, b = next((a, b) for a, b in zip(phases, phases[1:]) if a[0] <= frame <= b[0])
    t = (frame - a[0]) / (b[0] - a[0])
    t = t * t * (3 - 2 * t)
    return a, b, (lambda x, y: x + (y - x) * t)


def make_helpers(rig, previous):
    def orient(name, world_rotation, pose):
        pb = rig.pose.bones[name]
        inherited = pb.parent.matrix @ pb.parent.bone.matrix_local.inverted() @ pb.bone.matrix_local
        rot = (inherited.to_3x3().inverted() @ world_rotation).to_euler('XYZ', previous.get(name, Euler()))
        previous[name] = rot.copy()
        pose[name] = tuple(rot)
        pb.rotation_euler = rot
        bpy.context.view_layer.update()

    def point(name, direction, pose):
        pb = rig.pose.bones[name]
        inherited = pb.parent.matrix @ pb.parent.bone.matrix_local.inverted() @ pb.bone.matrix_local
        rotation = inherited.to_3x3()
        swing = (rotation @ Vector((0, 1, 0))).rotation_difference(direction.normalized())
        orient(name, swing.to_matrix() @ rotation, pose)

    def two_bone(side, target, pole, pose, u=None, v=.35):
        """the arm from its shoulder to put the hand centre on target, the elbow toward pole"""
        u = u or g['ARM']['elbow']
        shoulder = rig.pose.bones['arm.' + side].head.copy()
        delta = target - shoulder
        d = min(delta.length, u + v - .0001)
        axis = delta.normalized()
        along = (u * u - v * v + d * d) / (2 * d)
        h = math.sqrt(max(0, u * u - along * along))
        p = (pole - axis * pole.dot(axis)).normalized()
        elbow = shoulder + axis * along + p * h
        point('arm.' + side, elbow - shoulder, pose)
        point('forearm.' + side, target - rig.pose.bones['forearm.' + side].head, pose)

    return orient, point, two_bone


HANDDIG_FWD = .40   # the body kneels this far forward of where the digger stands (rig units; ~0.27 m in game), at the scrape


def anim_handdig(rig):
    """Third person: down on both knees, bent right over, both hands dig in ahead, rake the sand back under the
    chest, cup it, sit up a little and fling it off to the right (where the Scoop tosses)."""
    if rig.animation_data:
        rig.animation_data.action = None
    g['key_pose'](rig, 0, {})
    bpy.context.view_layer.update()
    previous = {}
    orient, point, two_bone = make_helpers(rig, previous)
    hip0 = rig.pose.bones['leg.L'].head.z   # hip joint height standing
    u = rig.pose.bones['leg.L'].bone.length; v = rig.pose.bones['shin.L'].bone.length
    thigh = Vector((0, -.32, -1)).normalized()       # thighs down and a little forward
    kneel_bob = .09 - (hip0 + thigh.z * u)            # hips drop until the knees touch the sand
    # frame, spine lean, extra hip drop, head (- looks up), twist (+ to the right), right hand, left hand
    # (x right, -y forward, z up; before the kneel-forward shift)
    phases = [
        (0,  .95, .00, -.55, .05,  (.20, -.62, .34), (-.18, -.60, .32)),
        (8,  1.28, -.02, -.70, 0,  (.17, -.86, .12), (-.17, -.84, .12)),
        (16, 1.22, -.02, -.66, 0,  (.12, -.58, .10), (-.12, -.57, .10)),
        (25, 1.10, -.01, -.60, 0,  (.07, -.62, .28), (-.06, -.62, .28)),
        (28, 1.06, .00, -.58, .05, (.08, -.62, .32), (-.05, -.62, .32)),
        (32, .88, .02, -.48, .40,  (.30, -.52, .44), (.10, -.58, .42)),
        (35, .78, .03, -.40, .66,  (.56, -.36, .56), (.32, -.50, .54)),
        (39, .86, .02, -.50, .32,  (.36, -.58, .42), (-.06, -.62, .38)),
        (45, .95, .00, -.55, .05,  (.20, -.62, .34), (-.18, -.60, .32)),
    ]
    keys, errors = [], []
    for frame in range(FRAMES + 1):
        a, b, mix = smooth_keys(phases, frame)
        lean, drop, dip, twist = [mix(a[i], b[i]) for i in range(1, 5)]
        pose = {'spine': (lean, twist, 0), 'bob': kneel_bob + drop, 'head': (dip, -.3 * twist, 0),
                'arm.L@loc': (0, 0, .06), 'arm.R@loc': (0, 0, .06)}
        g['key_pose'](rig, frame, pose)
        rig.pose.bones['root'].location = (0, 0, HANDDIG_FWD)   # root local +Z is the body's forward (-Y)
        bpy.context.view_layer.update()
        for side in ('L', 'R'):   # knees on the sand a hand apart, shins flat behind
            upper, lower = rig.pose.bones['leg.' + side], rig.pose.bones['shin.' + side]
            hip = upper.head.copy()
            knee = hip + Vector((.04 if side == 'R' else -.04, thigh.y, thigh.z)).normalized() * u
            ankle = knee + Vector((0, 1, -.08)).normalized() * v
            point(upper.name, knee - hip, pose)
            point(lower.name, ankle - lower.head, pose)
        spine = rig.pose.bones['spine'].matrix.to_3x3()
        for side, hand in (('R', 5), ('L', 6)):
            target = Vector(tuple(mix(p, q) for p, q in zip(a[hand], b[hand]))) - Vector((0, HANDDIG_FWD, 0))
            s = 1 if side == 'R' else -1
            two_bone(side, target, spine @ Vector((s * 1, .3, .6)), pose)
            errors.append((g['_center'](g['_part'](rig, '_%s_Hand' % side)) - target).length)
        keys.append((frame, pose))
    keys[-1] = (FRAMES, dict(keys[0][1]))
    action = g['make_action'](rig, 'HandDig', keys)
    for frame, _ in keys:   # make_action keys the root from the pose dicts: put the kneel-forward back on every key
        rig.pose.bones['root'].location = (0, 0, HANDDIG_FWD)
        rig.pose.bones['root'].keyframe_insert('location', frame=frame)
    for fc in g['fcurves_of'](action):
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'
    print('HandDig hand error (m): max', round(max(errors), 4), 'by frame', [round(e, 2) for e in errors[::8]])
    return action


def anim_handsfp(rig):
    """First person: the arms enter from the bottom corners, both hands dig in ahead, rake back, cup, fling right."""
    if rig.animation_data:
        rig.animation_data.action = None
    g['key_pose'](rig, 0, {})
    bpy.context.view_layer.update()
    previous = {}
    orient, point, two_bone = make_helpers(rig, previous)

    def shoulder(side, target, pose):
        bone = rig.pose.bones['arm.' + side]
        inherited = bone.parent.matrix @ bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
        loc = inherited.inverted() @ target
        bone.location = loc
        pose['arm.' + side + '@loc'] = tuple(loc)
        bpy.context.view_layer.update()

    eye = g['FP_EYE']
    # frame, right hand, left hand: eye-relative (x right, -y forward, z up)
    phases = [
        (0,  (.26, -.78, -.32), (-.26, -.78, -.32)),
        (8,  (.17, -.98, -.42), (-.17, -.96, -.42)),
        (16, (.12, -.76, -.40), (-.12, -.74, -.40)),
        (25, (.06, -.70, -.32), (-.06, -.70, -.32)),
        (28, (.07, -.70, -.30), (-.05, -.70, -.30)),
        (32, (.30, -.70, -.24), (.08, -.72, -.28)),
        (35, (.62, -.64, -.16), (.36, -.70, -.22)),
        (39, (.38, -.76, -.28), (-.12, -.78, -.32)),
        (45, (.26, -.78, -.32), (-.26, -.78, -.32)),
    ]
    keys = []
    for frame in range(FRAMES + 1):
        a, b, mix = smooth_keys(phases, frame)
        pose = {}
        g['key_pose'](rig, frame, pose)
        bpy.context.view_layer.update()
        for side, i, offset, guide in (('R', 1, (.28, .40, -.42), (.7, .2, -.3)), ('L', 2, (-.28, .40, -.42), (-.7, .2, -.3))):
            target = Vector(tuple(mix(p, q) for p, q in zip(a[i], b[i]))) + Vector((0, 0, eye))
            start = target + Vector(offset)
            shoulder(side, start, pose)
            delta = target - start
            axis = delta.normalized(); length = min(delta.length, .65 - .0001)
            along = (.30 ** 2 - .35 ** 2 + length ** 2) / (2 * length)
            bend = math.sqrt(max(0, .30 ** 2 - along ** 2))
            pole = Vector(guide); pole = (pole - axis * pole.dot(axis)).normalized()
            elbow = start + axis * along + pole * bend
            point('arm.' + side, elbow - start, pose)
            point('forearm.' + side, target - rig.pose.bones['forearm.' + side].head, pose)
        keys.append((frame, pose))
    keys[-1] = (FRAMES, dict(keys[0][1]))
    action = g['make_action'](rig, 'HandsFP', keys)
    for fc in g['fcurves_of'](action):
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'
    return action


def export_armature(rig, name, path):
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    for a in list(bpy.data.actions):
        if a.name != name:
            bpy.data.actions.remove(a)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_yup=True, export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=True, export_materials='NONE')
    print('exported', path)


bpy.context.scene.render.fps = g['FPS']
clear()
g['use_collection']('HandDig.Asset')
rig = g['rig_camper']('CGLCamper', with_shovel=False)
anim_handdig(rig)
export_armature(rig, 'HandDig', repo / 'public/models/anim-handdig.glb')

clear()
g['use_collection']('HandsFP.Asset')
rig = g['rig_camper']('CGLCamper')
keep = ('L_Sleeve', 'R_Sleeve', 'L_Hand', 'R_Hand')
for obj in list(rig.children):
    if obj.name.removeprefix('CGLCamper_') not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)
anim_handsfp(rig)
rig.scale.y = -1
rig.location.z = -g['FP_EYE']
bpy.context.view_layer.update()
export_armature(rig, 'HandsFP', repo / 'public/models/anim-handsfp.glb')
