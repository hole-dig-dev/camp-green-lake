# Rig + animation helpers for the Camp Green Lake camper.
# The camper's .blend is now scene `Camper` in art/blender/characters.blend (was blender/camper.blend until 2026-09-30).
# Load inside Blender with: exec(open(r"C:\Users\jthol\Projects\camp-green-lake\blender\cgl_rig.py").read())
# (it loads cgl_helpers.py itself)
exec(open(r"C:\Users\jthol\Projects\camp-green-lake\blender\cgl_helpers.py").read())

FPS = 30
LIFT = LEG["H"] - 0.1          # camper root height (torso bottom above the ground)

BONES = ["root", "hips", "spine", "head", "arm.L", "arm.R", "forearm.L", "forearm.R", "leg.L", "leg.R"]


def _ctx():
    win = bpy.context.window_manager.windows[0]
    area = next(a for a in win.screen.areas if a.type == 'VIEW_3D')
    region = next(rg for rg in area.regions if rg.type == 'WINDOW')
    return win, area, region


def _mode(obj, mode):
    win, area, region = _ctx()
    bpy.context.view_layer.objects.active = obj
    with bpy.context.temp_override(window=win, area=area, region=region, active_object=obj, object=obj,
                                   selected_objects=[obj], selected_editable_objects=[obj]):
        bpy.ops.object.mode_set(mode=mode)


def _bone_part(short):
    """Which bone a camper part (name without the camper prefix) rides on."""
    if short.startswith(("L_", "R_")):
        side = short[0]
        if any(k in short for k in ("Forearm", "Elbow", "Hand", "Shovel")):
            return "forearm." + side
        return ("arm." if "Sleeve" in short else "leg.") + side
    if short in ("Torso", "Zipper", "Patch", "Neck"):
        return "spine"
    return "head"


SHOVEL_HOLD = 1.1   # how far up the shovel (from the blade tip) the right hand grips it
SHOVEL_TILT = 26    # degrees the shovel leans forward in the hand


def shovel(pre, parent):
    """The chosen faceted shovel (#9) held in the right hand, tip forward/down, scoop facing forward."""
    sx = TW / 2 + ARM["off"] + math.sin(D(ARM["splay"])) * 0.72
    hz = SH_Z - math.cos(D(ARM["splay"])) * 0.72
    mount = empty(pre + "R_ShovelMount", parent, (sx, 0, hz), (-SHOVEL_TILT, 0, 0))
    shovel_parts(pre + "R_Shovel", mount, z_off=-SHOVEL_HOLD)


def rig_camper(name, x=0.0, face_name="Original", hat=None, with_shovel=True, wardrobe=False):
    """Build a camper, add an armature, and hang every part on a bone (rigid parenting, no skin weights).
    Bone convention: every bone's local +X rotation = swing/lean FORWARD. Pose-bone location Y = along the bone.
    wardrobe=True adds every hat + hair + shades (named <name>_<Piece>_...) so the game can toggle them."""
    r = camper(name, x, face_name, hat)
    pre = name + "_"
    if with_shovel:
        shovel(pre, r)
    if wardrobe:
        for hn, fn in HATS.items():
            fn(pre + hn + "_", r)
        hair(pre + "Hair_", r)
        shades(pre + "Shades_", r, next(o for o in r.children if o.name == pre + "Head"))
    arm_d = bpy.data.armatures.new(name + "_RigData")
    rig = bpy.data.objects.new(name + "_Rig", arm_d)
    COL.objects.link(rig)
    rig.location = (x, 0, 0)
    rig.show_in_front = False
    arm_d.display_type = 'STICK'

    _mode(rig, 'EDIT')
    eb = arm_d.edit_bones
    fwd = Vector((0, -1, 0))

    def bone(n, head, tail, parent=None):
        b = eb.new(n); b.head = head; b.tail = tail
        b.align_roll(fwd)
        if parent:
            b.parent = eb[parent]
        return b

    hb = LIFT + HB
    bone("root", (0, 0, 0), (0, 0, 0.3))
    bone("hips", (0, 0, LIFT), (0, 0, LIFT + 0.3), "root")
    bone("spine", (0, 0, LIFT + 0.02), (0, 0, LIFT + TH), "hips")
    bone("head", (0, 0, hb), (0, 0, hb + HEAD_H), "spine")
    for s, sd in ((-1, "L"), (1, "R")):
        sh = Vector((s * (TW / 2 + ARM["off"]), 0, LIFT + SH_Z))
        dirv = Vector((s * math.sin(D(ARM["splay"])), 0, -math.cos(D(ARM["splay"]))))
        elbow = sh + dirv * (ARM["elbow"])
        bone("arm." + sd, sh, elbow, "spine")
        bone("forearm." + sd, elbow, sh + dirv * 0.8, "arm." + sd)
        hip = Vector((s * LEG["hipx"], 0, LIFT + 0.1))
        bone("leg." + sd, hip, Vector((hip.x, 0, 0.06)), "hips")
    _mode(rig, 'OBJECT')

    bpy.context.view_layer.update()
    parts = [o for o in r.children_recursive if o.type == 'MESH']
    for o in parts:
        mw = o.matrix_world.copy()
        o.parent = rig
        o.parent_type = 'BONE'
        o.parent_bone = _bone_part(o.name[len(pre):])
        bpy.context.view_layer.update()
        o.matrix_world = mw
    for o in [r] + [c for c in r.children_recursive]:
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o, do_unlink=True)
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
    return rig


# ---------------- animation ----------------
def fcurves_of(action):
    try:
        return list(action.fcurves)
    except Exception:
        pass
    out = []
    for layer in action.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                out += list(cb.fcurves)
    return out


def key_pose(rig, frame, pose):
    """pose: {bone: (rx, ry, rz)}; optional 'bob' (hips up/down), 'root_rot', 'root_up'. Unlisted bones go to rest."""
    for n in BONES:
        pb = rig.pose.bones[n]
        if n == "root":
            pb.rotation_euler = pose.get("root_rot", (0, 0, 0))
            pb.location = (0, pose.get("root_up", 0.0), 0)
            pb.keyframe_insert("location", frame=frame)
        else:
            pb.rotation_euler = pose.get(n, (0, 0, 0))
        if n == "hips":
            pb.location = (0, pose.get("bob", 0.0), 0)
            pb.keyframe_insert("location", frame=frame)
        if n.startswith("arm."):
            pb.location = pose.get(n + "@loc", (0, 0, 0))   # shrug: local -Y = up, +Z = forward
            pb.keyframe_insert("location", frame=frame)
        pb.keyframe_insert("rotation_euler", frame=frame)


def make_action(rig, name, keys, loop=True):
    """keys: list of (frame, pose). Creates/replaces the rig's action and names it."""
    if rig.animation_data and rig.animation_data.action:
        rig.animation_data.action = None
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    for f, pose in keys:
        key_pose(rig, f, pose)
    act = rig.animation_data.action
    act.name = name
    act.use_fake_user = True
    if loop:
        for fc in fcurves_of(act):
            if not any(m.type == 'CYCLES' for m in fc.modifiers):
                fc.modifiers.new('CYCLES')
    return act


def _s(side):
    return -1 if side == "L" else 1


# game dig keys: [phase, lean, twist, right arm, left arm] (game arm angles are negative-forward)
DIGK = [[0, 0.15, 0, -0.5, -0.6], [0.3, 0.55, 0, -0.95, -0.8], [0.5, 0.25, 0.1, -1.6, -1.25],
        [0.72, 0.08, 0.7, -1.9, -1.5], [1, 0.15, 0, -0.5, -0.6]]


def anim_idle(rig):
    return make_action(rig, "Idle", [
        (1,  {"spine": (0.0, 0, 0), "head": (0.0, 0, 0), "arm.L": (0.02, 0, -0.04), "arm.R": (0.02, 0, 0.04)}),
        (30, {"spine": (0.035, 0, 0), "head": (-0.04, 0, 0.02), "arm.L": (-0.03, 0, -0.06), "arm.R": (-0.03, 0, 0.06)}),
        (60, {"spine": (0.0, 0, 0), "head": (0.0, 0, 0), "arm.L": (0.02, 0, -0.04), "arm.R": (0.02, 0, 0.04)}),
    ])


def _gait(rig, name, n, leg, arm, lean, bob):
    def p(sw, b):
        return {"leg.L": (sw * leg, 0, 0), "leg.R": (-sw * leg, 0, 0),
                "arm.L": (-sw * arm, 0, -0.05), "arm.R": (sw * arm, 0, 0.05),
                "spine": (lean, sw * 0.08, 0), "head": (-lean * 0.5, -sw * 0.06, 0), "bob": b}
    q = n // 4
    return make_action(rig, name, [(1, p(1, -bob)), (1 + q, p(0, bob)), (1 + 2 * q, p(-1, -bob)),
                                   (1 + 3 * q, p(0, bob)), (1 + n, p(1, -bob))])


def anim_walk(rig):
    return _gait(rig, "Walk", 24, 0.6, 0.5, 0.05, 0.03)


def anim_run(rig):
    return _gait(rig, "Run", 16, 0.95, 0.95, 0.2, 0.06)


def anim_dig(rig, frames=36):
    keys = []
    for ph, lean, twist, ar, al in DIGK:
        keys.append((1 + round(ph * frames), {
            "spine": (lean, -twist, 0), "head": (-lean * 0.4, twist * 0.3, 0),
            "arm.R": (-ar, 0, -0.25), "arm.L": (-al, 0, 0.35),
            "leg.L": (lean * 0.5, 0, 0), "leg.R": (-lean * 0.3, 0, 0)}))
    return make_action(rig, "Dig", keys)


def anim_jump(rig):
    up = {"arm.L": (2.0, 0, -0.75), "arm.R": (2.0, 0, 0.75), "leg.L": (0.35, 0, -0.08), "leg.R": (-0.15, 0, 0.08),
          "spine": (-0.08, 0, 0), "head": (-0.15, 0, 0)}
    return make_action(rig, "Jump", [
        (1,  {"spine": (0.15, 0, 0), "arm.L": (-0.4, 0, 0), "arm.R": (-0.4, 0, 0)}),
        (7,  up), (22, up),
        (30, {}),
    ], loop=False)


def anim_ko(rig):
    flop = {"root_rot": (-math.pi / 2, 0, 0), "root_up": 0.33, "arm.L": (0.3, 0, -1.2), "arm.R": (0.3, 0, 1.2),
            "leg.L": (0, 0, -0.25), "leg.R": (0, 0, 0.25), "head": (0.3, 0.3, 0)}
    return make_action(rig, "KO", [
        (1, {}),
        (10, {"root_rot": (-0.9, 0, 0), "root_up": 0.08, "arm.L": (1.2, 0, -0.6), "arm.R": (1.2, 0, 0.6)}),
        (18, flop), (40, flop),
    ], loop=False)


# ---------- reach solver: find arm + elbow angles that put a hand on a target ----------
def _part(rig, suffix):
    return next(o for o in rig.children if o.name.endswith(suffix))


def _center(o):
    c = sum((Vector(v) for v in o.bound_box), Vector()) / 8
    return o.matrix_world @ c


def _apply(rig, pose):
    for n in BONES:
        if n != "root":
            rig.pose.bones[n].rotation_euler = pose.get(n, (0, 0, 0))
        if n.startswith("arm."):
            rig.pose.bones[n].location = pose.get(n + "@loc", (0, 0, 0))
    bpy.context.view_layer.update()


def head_forward(rig):
    pb = rig.pose.bones["head"]
    return (rig.matrix_world.to_3x3() @ pb.matrix.to_3x3() @ Vector((0, 0, 1))).normalized()


def reach(rig, side, target, base, init=(1.2, 0.0, 0.3, 1.8)):
    """Coordinate-descent 'IK': returns base pose + arm/forearm angles putting the hand center on `target`."""
    if rig.animation_data:
        rig.animation_data.action = None
    s = -1 if side == "L" else 1
    arm, fore = "arm." + side, "forearm." + side
    hand = _part(rig, f"_{side}_Hand")
    head = _part(rig, "_Head")
    lim = [(-1.0, 3.0), (-1.5, 1.5), (-1.6, 1.6), (0.0, 2.7)]
    x = list(init)

    def cost(v):
        pose = dict(base); pose[arm] = (v[0], v[1], v[2]); pose[fore] = (v[3], 0, 0)
        _apply(rig, pose)
        h = _center(hand)
        c = (h - target).length_squared * 100
        el = rig.matrix_world @ rig.pose.bones[fore].head
        sh = rig.matrix_world @ rig.pose.bones[arm].head
        c += 4 * max(0.0, s * (sh.x - el.x) + 0.02) ** 2        # elbow stays out to the side
        c += 2 * max(0.0, el.z - h.z) ** 2                      # elbow below the hand
        dh = (h - _center(head)).length
        c += 30 * max(0.0, 0.36 - dh) ** 2                      # don't push the hand into the head
        return c

    def descend(x):
        best = cost(x); step = 0.4
        while step > 0.004:
            improved = False
            for i in range(4):
                for d in (step, -step):
                    y = list(x); y[i] = min(lim[i][1], max(lim[i][0], y[i] + d))
                    c = cost(y)
                    if c < best:
                        best, x, improved = c, y, True
            if not improved:
                step *= 0.5
        return best, x

    # a few starting guesses so the result doesn't depend on whatever pose the rig was left in
    starts = [x, [0.8, 0.0, 0.6, 2.2], [1.6, 0.0, 0.0, 1.4], [0.5, 0.0, -1.0, 1.6]]
    best, x = min((descend(list(s0)) for s0 in starts), key=lambda t: t[0])
    pose = dict(base); pose[arm] = (x[0], x[1], x[2]); pose[fore] = (x[3], 0, 0)
    _apply(rig, pose)
    return pose, (_center(hand) - target).length


def anim_drink(rig):
    """Left hand comes up to the mouth (the right hand holds the shovel), head tips back."""
    out = []
    for f, tilt in ((12, -0.3), (38, -0.42)):
        base = {"head": (tilt, 0, 0), "spine": (-0.1, 0, 0), "arm.R": (0.1, 0, 0.05)}
        _apply(rig, base)
        mouth = _center(_part(rig, "_Mouth"))
        tgt = mouth + head_forward(rig) * 0.1 - Vector((0, 0, 0.02))
        pose, err = reach(rig, "L", tgt, base)
        out.append((f, pose)); print("drink frame", f, "hand error", round(err, 3))
    return make_action(rig, "Drink", [(1, {})] + out + [(50, {})], loop=False)


def anim_wipe(rig):
    """Left hand wipes across the brow; head dips and turns into the hand, shoulder shrugs up."""
    base = {"head": (0.5, -0.1, 0.25), "spine": (0.12, -0.25, 0.05), "arm.R": (0.1, 0, 0.05),
            "arm.L@loc": (0, -0.1, 0.08)}
    _apply(rig, base)
    brows = [_center(o) for o in rig.children if "_Brow" in o.name]
    mid = sum(brows, Vector()) / len(brows)
    fwd = head_forward(rig)
    poses = {}
    for key, dx in (("A", -0.14), ("B", -0.02)):
        tgt = mid + fwd * 0.07 + Vector((dx, 0, 0.0))
        pose, err = reach(rig, "L", tgt, base)
        poses[key] = pose; print("wipe", key, "hand error", round(err, 3))
    A, B = poses["A"], poses["B"]
    return make_action(rig, "WipeSweat", [(1, {}), (9, A), (15, B), (21, A), (27, B), (38, {})], loop=False)


def anim_wave(rig):
    """Friendly wave with the free (left) hand: hand up beside the head, swaying side to side."""
    base = {"head": (-0.05, -0.1, 0.08), "spine": (-0.04, -0.08, 0), "arm.R": (0.1, 0, 0.05)}
    _apply(rig, base)
    sh = rig.matrix_world @ rig.pose.bones["arm.L"].head
    poses = {}
    for key, dx in (("A", -0.07), ("B", 0.09)):
        tgt = sh + Vector((-0.34 + dx, -0.12, 0.5))
        pose, err = reach(rig, "L", tgt, base, init=(0.4, 0.0, -1.2, 1.4))
        poses[key] = pose; print("wave", key, "hand error", round(err, 3))
    A, B = poses["A"], poses["B"]
    return make_action(rig, "Wave", [(1, {}), (8, A), (14, B), (20, A), (26, B), (32, A), (42, {})], loop=False)


def anim_dance(rig):
    def p(sw, b):
        return {"arm.L": (0.3, 0, -2.3 - 0.4 * sw), "arm.R": (0.3, 0, 2.3 - 0.4 * sw), "spine": (0, 0.3 * sw, 0.08 * sw),
                "head": (0.1, -0.2 * sw, 0), "leg.L": (0.15 * sw, 0, 0), "leg.R": (-0.15 * sw, 0, 0), "bob": b}
    return make_action(rig, "Dance", [(1, p(1, 0.0)), (9, p(0, 0.08)), (17, p(-1, 0.0)), (25, p(0, 0.08)), (33, p(1, 0.0))])


def anim_radio(rig):
    """Talking into the walkie-talkie: the left hand holds it up beside the mouth (the right keeps the shovel), head tipped
    toward it, a small nod while talking. Looping. The game lays only arm.L, forearm.L and head from this clip over
    whatever the body is doing, so you can walk and talk (public/js/86-walkie.js)."""
    out = []
    for f, nod in ((1, 0.0), (12, 0.06), (24, 0.0)):
        base = {"head": (0.08 + nod, 0.18, -0.06), "arm.R": (0.1, 0, 0.05)}
        _apply(rig, base)
        mouth = _center(_part(rig, "_Mouth"))
        tgt = mouth + head_forward(rig) * 0.1 + Vector((-0.07, 0, -0.03))   # just in front of the mouth, off to the left
        pose, err = reach(rig, "L", tgt, base, init=(1.4, 0.0, 0.2, 2.2))
        out.append((f, pose)); print("radio frame", f, "hand error", round(err, 3))
    return make_action(rig, "Radio", out, loop=True)


ANIMS = {"Idle": anim_idle, "Walk": anim_walk, "Run": anim_run, "Dig": anim_dig, "Jump": anim_jump,
         "KO": anim_ko, "Drink": anim_drink, "WipeSweat": anim_wipe, "Dance": anim_dance, "Wave": anim_wave,
         "Radio": anim_radio}


GLB_PATH = r"C:\Users\jthol\Projects\camp-green-lake\public\models\camper.glb"


def export_camper(path=GLB_PATH):
    """Rebuild the game camper (with the full wardrobe) + all animations and write the GLB.
    Keeps the export collection visible while solving (hidden objects don't update their matrices)."""
    use_collection("Export")
    for coll in (bpy.data.armatures, bpy.data.meshes, bpy.data.curves):
        for d in [d for d in coll if d.users == 0]:
            coll.remove(d)
    rig = rig_camper("CGLCamper", 0.0, wardrobe=True)
    for fn in ANIMS.values():
        fn(rig)
    rig.animation_data.action = None
    _apply(rig, {})
    # preview rigs follow the freshly generated actions (glTF 'ACTIONS' mode exports every matching action,
    # so there must be exactly one action per animation name)
    for o in bpy.data.objects:
        if o.type == 'ARMATURE' and o != rig and o.animation_data:
            nm = o.name.split("_")[1] if o.name.startswith("Anim") else None
            if nm in ANIMS:
                o.animation_data.action = bpy.data.actions[nm]
                try:
                    if o.animation_data.action_slot is None and len(bpy.data.actions[nm].slots):
                        o.animation_data.action_slot = bpy.data.actions[nm].slots[0]
                except AttributeError:
                    pass
    stray = [a.name for a in bpy.data.actions if a.name not in ANIMS]
    for n in stray:
        bpy.data.actions.remove(bpy.data.actions[n])
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    rig.select_set(True)
    for c in rig.children:
        c.select_set(True)
    bpy.context.view_layer.objects.active = rig
    win, area, region = _ctx()
    with bpy.context.temp_override(window=win, area=area, region=region, active_object=rig,
                                   selected_objects=[rig] + list(rig.children)):
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                                  export_yup=True, export_animations=True, export_animation_mode='ACTIONS',
                                  export_force_sampling=True, export_materials='EXPORT')
    COL.hide_viewport = True
    return rig
