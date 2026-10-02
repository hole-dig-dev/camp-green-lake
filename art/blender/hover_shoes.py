"""Hover sneakers: original camper bind space, one material-grouped mesh per shin.

Rebuild: env -u DISPLAY VK_DRIVER_FILES=/usr/share/vulkan/icd.d/radeon_icd.json
  blender -b --factory-startup --gpu-backend vulkan
  --python-exit-code 1 --python art/blender/hover_shoes.py
Pass -- --no-render for geometry/export only. All authored geometry is Blender mesh.
"""
from pathlib import Path
import bpy, bmesh, math, hashlib, json, shutil, sys, os, subprocess
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
exec((HERE / 'upgrades_common.py').read_text())
bpy.ops.import_scene.gltf(filepath=str(PUBLIC / 'camper.glb'))
source = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
source.animation_data_clear()
for p in source.pose.bones:
    p.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()
scene('HoverShoes')
rig = source.copy()
rig.data = source.data.copy()
rig.name = 'HoverShoesRig'
rig.animation_data_clear()
_link(rig)
for p in rig.pose.bones:
    p.matrix_basis = Matrix.Identity(4)

SHELL = ('hover_pearl_shell', (224, 231, 221), .56, .08)
NAVY = ('hover_midnight_mesh', (35, 58, 73), .85, 0)
RUBBER = ('hover_graphite_outsole', (34, 43, 49), .77, .04)
TRIM = ('hover_silver_support', (142, 169, 177), .4, .3)
ORANGE = ('hover_tangerine_tab', (232, 129, 66), .63, 0)
SOLE = ('hover_sole_cyan', (39, 226, 245), .36, .1)
VENT = ('hover_thruster_cyan', (112, 244, 255), .33, .15)
for spec, strength in ((SOLE, 3.0), (VENT, 2.2)):
    shader = mat(*spec).node_tree.nodes['Principled BSDF']
    shader.inputs['Emission Color'].default_value = srgb(spec[1])
    shader.inputs['Emission Strength'].default_value = strength

parts = []
for sign, side in ((-1, 'L'), (1, 'R')):
    x = sign * .15
    local = []

    def B(tag, size, loc, material, bevel=.006, rot=(0, 0, 0)):
        o = box('HoverShoes_' + side + '_' + tag, size, loc, material, bevel=bevel, rot=rot)
        local.append(o)
        return o

    def profile(tag, levels, material, bevel=.005):
        # Tapered heel, wide forefoot, faceted round toe. Each ring is real mesh.
        outline = [(-.072, .126), (-.103, .087), (-.111, -.092),
                   (-.095, -.179), (-.055, -.215), (.055, -.215),
                   (.095, -.179), (.111, -.092), (.103, .087), (.072, .126)]
        vs = [(x + u * scale, v * length, z + toe_rise * max(0, -v / .215))
              for z, scale, length, toe_rise in levels for u, v in outline]
        n = len(outline)
        fs = [tuple(range(n - 1, -1, -1)), tuple(range((len(levels) - 1) * n, len(levels) * n))]
        for j in range(len(levels) - 1):
            for k in range(n):
                fs.append((j*n+k, j*n+(k+1)%n, (j+1)*n+(k+1)%n, (j+1)*n+k))
        me = bpy.data.meshes.new(tag)
        me.from_pydata(vs, [], fs)
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('HoverShoes_' + side + '_' + tag, me)
        _link(o); _finish(o, material, bevel, None); local.append(o)
        return o

    profile('FloatingChassis', [(0, 1, 1, .010), (.026, 1.04, 1.015, .014)], RUBBER)
    profile('LowerLightRail', [(.026, 1.045, 1.015, .014), (.044, 1.045, 1.015, .014)], SOLE, .003)
    profile('PearlMidsole', [(.044, 1.04, 1.01, .014), (.073, 1.0, 1, .017)], SHELL)
    profile('UpperLightRail', [(.075, 1.007, 1, .012), (.082, 1.007, 1, .012)], SOLE, .002)
    profile('RunnerUpper', [(.082, .96, .98, .012), (.127, .95, .97, -.004),
                            (.185, .72, .77, -.029)], NAVY, .012)
    B('ToeShell', (.189, .099, .062), (x, -.156, .128), SHELL, .024,
      rot=(math.radians(12), 0, 0))
    B('Tongue', (.092, .132, .025), (x, -.031, .183), NAVY, .010,
      rot=(math.radians(14), 0, 0))
    # Low open collar: trouser leg enters a real bore, no cap through the leg.
    vs = []; fs = []; n = 24
    for rad, z in ((.111, .133), (.111, .225), (.096, .229), (.096, .133)):
        vs.extend((x + rad * math.cos(k*math.tau/n), .016 + rad*.86*math.sin(k*math.tau/n), z)
                  for k in range(n))
    for j in range(4):
        for k in range(n):
            fs.append((j*n+k, j*n+(k+1)%n, ((j+1)%4)*n+(k+1)%n, ((j+1)%4)*n+k))
    o = pipe_mesh('HoverShoes_' + side + '_OpenCollar', vs, fs, mat(*SHELL))
    local.append(o)
    # Swept side panels and small illuminated chevrons emphasize forward motion.
    for s in (-1, 1):
        for j in range(2):
            B('SweptSupport', (.012, .106, .030), (x+s*.101, -.024+j*.035, .138+j*.022),
              SHELL, .004, rot=(math.radians(-28), 0, 0))
        B('SideLight', (.014, .070, .008), (x+s*.110, -.058, .113), SOLE, .002,
          rot=(math.radians(-18), 0, 0))
    for j in range(4):
        B('LaceBridge', (.088-j*.004, .009, .010), (x, -.094+j*.026, .178+j*.006), SHELL, .003)
    B('TongueTab', (.040, .027, .012), (x, .024, .206), ORANGE, .003)
    B('HeelPull', (.035, .020, .055), (x, .111, .211), ORANGE, .004)
    # Three recessed thrusters in a heel block, with separate raised dividing ribs.
    B('HeelThrusterHousing', (.172, .044, .065), (x, .122, .108), TRIM, .012)
    B('HeelVentRecess', (.141, .007, .037), (x, .147, .110), RUBBER, .004)
    for j in (-1, 0, 1):
        B('ThrusterCore', (.031, .009, .018), (x+j*.043, .152, .109), VENT, .004)
    for j in (-.5, .5):
        B('VentDivider', (.006, .012, .030), (x+j*.043, .154, .110), TRIM, .001)
    # Discrete underside field pads; no baked beam or separate particle geometry.
    for y in (-.14, .051):
        B('UnderfootEmitter', (.135, .066, .008), (x, y, .009), SOLE, .008)

    # Bake authored world transforms and bevels, then group materials into one mesh per foot.
    dg = bpy.context.evaluated_depsgraph_get()
    for o in local:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        o.data = me; o.matrix_world = Matrix.Identity(4); o.modifiers.clear()
    bpy.ops.object.select_all(action='DESELECT')
    for o in local: o.select_set(True)
    bpy.context.view_layer.objects.active = local[0]
    bpy.ops.object.join()
    o = bpy.context.object; o.name = 'HoverShoes_' + side; o.data.name = o.name
    o.parent = rig
    o['slot'] = 'footwear'; o['side'] = side; o['cosmeticOnly'] = True
    g = o.vertex_groups.new(name='shin.' + side)
    g.add(list(range(len(o.data.vertices))), 1, 'REPLACE')
    mod = o.modifiers.new('Existing shin bone', 'ARMATURE'); mod.object = rig
    parts.append(o)

bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in [rig] + parts: o.select_set(True)
bpy.context.view_layer.objects.active = rig
path = OUT / 'hover-shoes.glb'
bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
    use_active_scene=True, export_animations=False, export_extras=True, export_skins=True,
    export_cameras=False, export_lights=False)
shutil.copy2(path, PUBLIC / 'footwear/hover-shoes.glb')
(OUT / 'hover-shoes.json').write_text(json.dumps(dict(
    sourceCamperSHA256=hashlib.sha256((PUBLIC / 'camper.glb').read_bytes()).hexdigest(),
    slot='footwear', bones=['shin.L', 'shin.R'], maxHeight=.2385,
    emissiveMaterials=[mat(*SOLE).name, mat(*VENT).name],
    units='metres', bindSpace='original camper',
    gameplayIntent='Hover 0.0254 m over terrain and holes; disable hover while digging.'), indent=2) + '\n')

studio(target=(0, -.03, .12), elev=24, azim=-32)
bpy.context.scene.camera.data.type = 'ORTHO'
bpy.context.scene.camera.data.ortho_scale = .84
bpy.context.scene.camera.location = Vector((-.65, -1.12, .58))
bpy.context.scene.camera.rotation_euler = (Vector((0, -.025, .12)) - bpy.context.scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
# Eevee Vulkan render, with a restrained compositor glow around the emissive sole rails.
sc = bpy.context.scene
sc.use_nodes = True
nt = sc.node_tree; nt.nodes.clear()
layers = nt.nodes.new('CompositorNodeRLayers')
glow = nt.nodes.new('CompositorNodeGlare'); glow.glare_type = 'FOG_GLOW'; glow.quality = 'HIGH'
glow.threshold = 1.2
out = nt.nodes.new('CompositorNodeComposite')
nt.links.new(layers.outputs['Image'], glow.inputs['Image']); nt.links.new(glow.outputs['Image'], out.inputs['Image'])
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'hover-shoes.blend'), compress=True)
if '--no-render' not in sys.argv:
    # gpu.platform is unavailable in background Blender; restrict Vulkan to RADV
    # and prove that the only exposed device is the hardware iGPU before rendering.
    if '--gpu-backend' not in sys.argv or sys.argv[sys.argv.index('--gpu-backend') + 1] != 'vulkan':
        raise RuntimeError('Use --gpu-backend vulkan for the hardware render')
    if os.environ.get('VK_DRIVER_FILES') != '/usr/share/vulkan/icd.d/radeon_icd.json':
        raise RuntimeError('Set VK_DRIVER_FILES to the Radeon ICD to exclude software devices')
    info = subprocess.run(['vulkaninfo', '--summary'], check=True, capture_output=True, text=True).stdout
    devices = [line.strip() for line in info.splitlines() if 'deviceName' in line]
    if len(devices) != 1 or 'AMD Radeon 760M' not in devices[0] or 'RADV' not in devices[0]:
        raise RuntimeError('Expected only the Radeon 760M / RADV: ' + repr(devices))
    print('BLENDER_GPU Vulkan', devices[0], flush=True)
    render(name='hover-shoes', res=(1100, 760), samples=32)
    cam = sc.camera
    cam.location = Vector((.58, 1.02, .48))
    cam.rotation_euler = (Vector((0, .012, .12)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    render(name='hover-shoes-heel', res=(1100, 760), samples=32)
