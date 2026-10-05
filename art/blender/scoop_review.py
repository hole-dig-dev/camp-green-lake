"""Render Scoop without changing characters.blend.

VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json ~/blender/blender \
    -b --gpu-backend vulkan art/blender/characters.blend \
    --python-exit-code 1 --python art/blender/scoop_review.py -- --output /tmp/sol-scoop/render [--preview]
See scoop_assemble.py for contact sheet and video assembly.
"""
import argparse
import sys
from pathlib import Path
import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--output', default='/tmp/sol-scoop/render')
args.add_argument('--preview', action='store_true')
args.add_argument('--audit', action='store_true', help='also render left-side and rear clearance views')
args = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
repo = Path(__file__).resolve().parents[2]
# A separate scene leaves the saved Camper studio and existing previews alone.
sc = bpy.data.scenes.new('ScoopReview')
bpy.context.window.scene = sc
rig_source = (repo / 'blender/cgl_rig.py').read_text().replace(
    r'C:\Users\jthol\Projects\camp-green-lake\blender\cgl_helpers.py',
    str(repo / 'blender/cgl_helpers.py'))
exec(compile(rig_source, str(repo / 'blender/cgl_rig.py'), 'exec'))
use_collection('ScoopReview.Asset')
rig = rig_camper('ScoopReview')
sc.render.fps = FPS
sc.frame_start = 0
sc.frame_end = 45
rig.animation_data.action = anim_scoop(rig)

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = 32
sc.render.resolution_x = 640
sc.render.resolution_y = 640
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.world = bpy.data.worlds.new('ScoopReview.World')
sc.world.use_nodes = True
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.15, .18, .23, 1)
sc.world.node_tree.nodes['Background'].inputs[1].default_value = .5
sc.view_settings.view_transform = 'AgX'

bpy.ops.mesh.primitive_plane_add(size=200)
floor = bpy.context.object
floor.name = 'ScoopReview.Floor'
floor.data.materials.append(mat('ScoopReview.Ground', '#AE9774'))

# A small patch provides a ground reference for the blade; no dirt load hides its angle.
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=.38, fill_type='NGON', location=(-.57, -1.55, .003))
patch = bpy.context.object
patch.name = 'ScoopReview.DigPatch'
patch.scale.y = .7
patch.data.materials.append(mat('ScoopReview.LooseEarth', '#806A4C'))

def aim(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()

for name, loc, energy, size in (
        ('Key', (3, -4, 6), 650, 5), ('Fill', (-3, -2, 4), 450, 4), ('Rim', (1, 3, 5), 800, 3)):
    data = bpy.data.lights.new('ScoopReview.' + name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    light = bpy.data.objects.new(data.name, data)
    sc.collection.objects.link(light)
    light.location = loc
    aim(light, (0, -.3, 1.2))
cam_data = bpy.data.cameras.new('ScoopReview.Camera')
cam = bpy.data.objects.new(cam_data.name, cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 3.45

views = {'side': (5, -.25, 2.2), 'front': (4, -6, 3.2)}
if args.audit:
    views.update({'left': (-5, -.25, 2.2), 'rear': (-4, 6, 3.2)})
for view, loc in views.items():
    cam.location = loc
    aim(cam, (0, -.5, 1.22))
    for phase, frame in zip(('ready', 'planted', 'levered', 'loaded', 'tossed', 'recover'), (0, 8, 16, 25, 35, 45)):
        sc.frame_set(frame)
        sc.render.filepath = str(out / f'{view}-{phase}.png')
        bpy.ops.render.render(write_still=True)
if args.preview:
    cam.location = views['side']
    aim(cam, (0, -.5, 1.22))
    # 45 frames per cycle; frame 45 duplicates frame 0.
    for frame in range(45):
        sc.frame_set(frame)
        sc.render.filepath = str(out / f'loop-{frame:03}.png')
        bpy.ops.render.render(write_still=True)
print('Scoop review renders:', out)
