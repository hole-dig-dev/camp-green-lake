"""Camera-space first-person Scoop. Reuse camper meshes; never rebuild its GLB.

Loaded by art/blender/camper_fp_export.py / scoopfp_review.py inside Blender.
Authored in the camper's -Y-forward space, then mirrored into +Y-forward for
Blender's Y-up glTF conversion: +X screen right, +Y up, -Z camera forward.
"""
from pathlib import Path
from mathutils import Euler, Vector

_RIG = Path(__file__).resolve().with_name('cgl_rig.py')
exec(compile(_RIG.read_text().replace(
    r'C:\Users\jthol\Projects\camp-green-lake\blender\cgl_helpers.py',
    str(_RIG.with_name('cgl_helpers.py'))), str(_RIG), 'exec'))

FP_EYE = 2.44
FP_FOV = 76
FP_NEAR = .045
FP_ASPECT = 16 / 9
FP_GRIP = .47  # front grip leaves the blade/socket clear in the eye view
FP_REAR_GRIP = .74  # near the handle end; 27cm above the front grip
FP_FRAMES = tuple(round(t * FPS) for t in (0, *SCOOP_TIMES.values()))


def build_scoopfp():
    """An isolated FP asset; original camper geometry and materials, no body meshes."""
    use_collection('ScoopFP.Asset')
    rig = rig_camper('CGLCamper')
    keep = ('L_Sleeve', 'R_Sleeve', 'L_Hand', 'R_Hand')
    for obj in list(rig.children):
        short = obj.name.removeprefix('CGLCamper_')
        if short not in keep and not short.startswith('R_Shovel'):
            bpy.data.objects.remove(obj, do_unlink=True)
    # FP needs independent wrists: the original forearm mount forces the elbow
    # up into the lens when the blade points down. Keep the same shovel meshes,
    # but let a dedicated prop bone carry them while both arms solve to its shaft.
    shovel_parts = [obj for obj in rig.children if obj.name.startswith('CGLCamper_R_Shovel')]
    worlds = {obj: obj.matrix_world.copy() for obj in shovel_parts}
    _mode(rig, 'EDIT')
    prop = rig.data.edit_bones.new('shovel')
    rear = _part(rig, '_R_ShovelShaft').matrix_world @ Vector((0, 0, FP_REAR_GRIP))
    prop.head = rear
    prop.tail = rear + Vector((0, 0, .5))
    prop.parent = rig.data.edit_bones['root']
    _mode(rig, 'OBJECT')
    for obj in shovel_parts:
        obj.parent_bone = 'shovel'
        bpy.context.view_layer.update()
        obj.matrix_world = worlds[obj]
    rig.pose.bones['shovel'].rotation_mode = 'XYZ'
    if 'shovel' not in BONES:
        BONES.append('shovel')
    anim_scoopfp(rig)
    # Reflect forward only (not X): the camper's R arm remains on screen right.
    # glTF carries this as an intentional camera-forward reflection at the rig root.
    rig.scale.y = -1
    rig.location.z = -FP_EYE
    bpy.context.view_layer.update()
    return rig


def anim_scoopfp(rig):
    """Same Scoop timing, authored for visibility rather than eye-level TPS poses."""
    if rig.animation_data:
        rig.animation_data.action = None
    key_pose(rig, 0, {})
    bpy.context.view_layer.update()
    blade = _part(rig, '_R_ShovelBlade')
    shaft = _part(rig, '_R_ShovelShaft')
    prop = rig.pose.bones['shovel']
    prop_to_shaft = prop.matrix.inverted() @ shaft.matrix_world
    previous = {}

    def orient(name, rotation, pose):
        bone = rig.pose.bones[name]
        inherited = bone.parent.matrix @ bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
        euler = (inherited.to_3x3().inverted() @ rotation).to_euler('XYZ', previous.get(name, Euler()))
        previous[name] = euler.copy()
        bone.rotation_euler = euler
        pose[name] = tuple(euler)
        bpy.context.view_layer.update()

    def point(name, direction, pose):
        bone = rig.pose.bones[name]
        inherited = bone.parent.matrix @ bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
        rotation = inherited.to_3x3()
        swing = (rotation @ Vector((0, 1, 0))).rotation_difference(direction.normalized())
        orient(name, swing.to_matrix() @ rotation, pose)

    def shoulder(side, target, pose):
        bone = rig.pose.bones['arm.' + side]
        inherited = bone.parent.matrix @ bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
        loc = inherited.inverted() @ target
        bone.location = loc
        pose['arm.' + side + '@loc'] = tuple(loc)
        bpy.context.view_layer.update()

    # Rear-hand positions are eye-relative; pitch/roll/yaw/bank control the blade.
    # Dense solves below preserve both hands during the lever and lateral dump.
    phases = [
        (0,  (.28, -.76, -.30), (-78, 0, -25, 0)),
        (8,  (.32, -1.13, -.41), (-55, 0, -35, 0)),
        (16, (.28, -.78, -.60), (-80, 0, -16, 0)),
        (25, (.28, -.90, -.55), (-90, 0, -16, 0)),
        (28, (.28, -.90, -.55), (-90, 0, -16, 0)),
        (32, (.38, -.69, -.32), (-90, 0, 16, 5)),
        (35, (.48, -.75, -.33), (-93, 0, 45, 90)),
        (39, (.34, -.76, -.39), (-85, 0, 8, 25)),
        (45, (.28, -.76, -.30), (-78, 0, -25, 0)),
    ]
    keys = []
    errors = []
    for frame in range(46):
        a, b = next((a, b) for a, b in zip(phases, phases[1:]) if a[0] <= frame <= b[0])
        t = (frame - a[0]) / (b[0] - a[0]); t = t*t*(3-2*t)
        mix = lambda x, y: x + (y-x)*t
        hand = Vector(tuple(mix(x, y) for x, y in zip(a[1], b[1]))) + Vector((0, 0, FP_EYE))
        pitch, roll, yaw, bank = (D(mix(x, y)) for x, y in zip(a[2], b[2]))
        desired_blade = Euler((pitch, roll, yaw), 'XYZ').to_matrix() @ Euler((0, 0, bank), 'XYZ').to_matrix()
        pose = {}
        key_pose(rig, frame, pose)
        bpy.context.view_layer.update()
        # Place the shovel independently of the wrists. Its shaft base and
        # original local mesh axes are preserved, including the named blade.
        shaft_matrix = desired_blade.to_4x4()
        shaft_matrix.translation = hand - desired_blade @ Vector((0, 0, FP_REAR_GRIP))
        prop_matrix = shaft_matrix @ prop_to_shaft.inverted()
        inherited = prop.parent.matrix @ prop.parent.bone.matrix_local.inverted() @ prop.bone.matrix_local
        basis = inherited.inverted() @ prop_matrix
        orient('shovel', prop_matrix.to_3x3(), pose)
        prop.location = basis.translation
        pose['shovel@loc'] = tuple(prop.location)
        bpy.context.view_layer.update()
        # Shoulders start below the frame; the two forearms enter from opposite
        # bottom corners. The hidden roots follow the prop during the side toss.
        for side, grip, offset, guide in (
                ('R', FP_REAR_GRIP, (.30, .32, -.42), (.7, .2, -.3)),
                ('L', FP_GRIP, (-.26, .43, -.30), (-.7, .2, -.5))):
            target = shaft.matrix_world @ Vector((0, 0, grip))
            start = target + Vector(offset)
            shoulder(side, start, pose)
            delta = target - start
            axis = delta.normalized(); length = min(delta.length, .65 - .0001)
            along = (.30**2 - .35**2 + length**2) / (2*length)
            bend = math.sqrt(max(0, .30**2 - along**2))
            pole = Vector(guide); pole = (pole-axis*pole.dot(axis)).normalized()
            elbow = start + axis*along + pole*bend
            point('arm.' + side, elbow-start, pose)
            point('forearm.' + side, target-rig.pose.bones['forearm.' + side].head, pose)
        error = (_center(_part(rig, '_L_Hand')) - target).length
        errors.append(error)
        keys.append((frame, pose))
        if frame in FP_FRAMES:
            tip = blade.matrix_world @ Vector((0, 0, -SHOVEL['h']))
            print('ScoopFP', frame, 'grip error', round(error, 4), 'tip (eye space)', tuple(round(v, 3) for v in (tip-Vector((0,0,FP_EYE)))))
    keys[-1] = (45, dict(keys[0][1]))
    action = make_action(rig, 'ScoopFP', keys)
    for frame, pose in keys:
        prop.location = pose['shovel@loc']
        prop.keyframe_insert('location', frame=frame)
    assert max(errors) < .02, 'ScoopFP front hand lost its shaft grip'
    for curve in fcurves_of(action):
        if not any(mod.type == 'CYCLES' for mod in curve.modifiers):
            curve.modifiers.new('CYCLES')
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    print('ScoopFP maximum grip error:', max(errors))
    return action


def export_scoopfp(rig, path):
    """Only the isolated FP rig; no animations or meshes from the TPS asset."""
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    rig.select_set(True)
    for obj in rig.children:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    for action in list(bpy.data.actions):
        if action.name != 'ScoopFP':
            bpy.data.actions.remove(action)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_yup=True, export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=True, export_materials='EXPORT')
