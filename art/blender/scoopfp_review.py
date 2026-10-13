"""Render the saved FP viewmodel as a child of the actual 76-degree FP camera.

VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json ~/blender/blender \
    -b --gpu-backend vulkan art/blender/camper-fp.blend --python-exit-code 1 \
    --python art/blender/scoopfp_review.py -- --output /tmp/sol-scoopfp/render [--preview]
"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=Path('/tmp/sol-scoopfp/render'))
parser.add_argument('--preview', action='store_true')
parser.add_argument('--metrics', action='store_true', help='GPU-render masks for arm coverage and blade occlusion')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
args.output.mkdir(parents=True, exist_ok=True)
sc = bpy.context.scene
rig = bpy.data.objects['CGLCamper_Rig']
sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.eevee.taa_render_samples = 32
sc.render.resolution_x = 960
sc.render.resolution_y = 540
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.render.fps = 30
sc.world = bpy.data.worlds.new('ScoopFP.World')
sc.world.use_nodes = True
sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.30,.39,.52,1)
sc.world.node_tree.nodes['Background'].inputs[1].default_value = .7
sc.view_settings.view_transform = 'AgX'

def material(name, color):
    mat = bpy.data.materials.new(name);mat.diffuse_color=(*color,1);return mat

# Align the review ground with the actual -30deg plant, roughly 1.1m ahead.
# This environment is not part of the camera-child asset.
sc.frame_set(8)
bpy.context.view_layer.update()
blade=bpy.data.objects['CGLCamper_R_ShovelBlade']
plant=Matrix.Rotation(math.radians(-30),4,'X') @ (blade.matrix_world @ Vector((0,0,-.36)))
ground_z=plant.z-.02
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,ground_z))
floor = bpy.context.object;floor.name='ScoopFP.ReviewGround'
floor.data.materials.append(material('ScoopFP.Earth', (.40,.29,.17)))
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=.38, fill_type='NGON', location=(plant.x,plant.y,ground_z+.002))
patch=bpy.context.object;patch.name='ScoopFP.DigPatch'
patch.scale.y=.75;patch.data.materials.append(material('ScoopFP.LooseDirt',(.25,.16,.08)))
# A review-only payload demonstrates the carry and dump. Game code supplies its
# own dirt on the named blade; no payload is included in camper-fp.glb.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
dirt=bpy.context.object;dirt.name='ScoopFP.ReviewPayload';dirt.parent=blade
# Clear the creation transform before assigning the blade-local pose.
dirt.location=(0,-.037,-.17);dirt.scale=(.085,.032,.115)
dirt.data.materials.append(material('ScoopFP.Payload',(.18,.09,.035)))
for frame,hidden in ((0,True),(16,False),(35,True),(45,True)):
    dirt.hide_render=hidden;dirt.keyframe_insert('hide_render',frame=frame)
# Grid lines are a world orientation cue, not part of the exported viewmodel.
for y in (2,4,8,12):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,y,ground_z+.004))
    line=bpy.context.object;line.name='ScoopFP.GroundReference';line.scale=(12,.007,.002)
    line.data.materials.append(material('ScoopFP.Grid'+str(y),(.33,.23,.12)))
for name,loc,energy,size in (('Key',(3,-2,5),750,4),('Fill',(-3,1,3),600,5),('Rim',(0,5,5),800,3)):
    data=bpy.data.lights.new('ScoopFP.'+name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    light=bpy.data.objects.new(data.name,data);sc.collection.objects.link(light);light.location=loc
    light.rotation_euler=(Vector((0,1,-.5))-light.location).to_track_quat('-Z','Y').to_euler()
cam_data=bpy.data.cameras.new('ScoopFP.Camera');cam=bpy.data.objects.new(cam_data.name,cam_data);sc.collection.objects.link(cam)
sc.camera=cam
cam_data.type='PERSP'
cam_data.sensor_fit='VERTICAL'
cam_data.sensor_height=24
cam_data.lens=cam_data.sensor_height/(2*math.tan(math.radians(76)/2))
cam_data.clip_start=.045
cam_data.clip_end=200
# Keep the rig in camera space: rotate its entire authored eye-relative asset
# with the pitch. Translation starts at the eye (origin), not at the floor.
base_rig = rig.matrix_world.copy()
base_camera = Vector((0,1,0)).to_track_quat('-Z','Y').to_matrix().to_4x4()

def view(pitch):
    rotation=Matrix.Rotation(math.radians(pitch),4,'X')
    cam.matrix_world=rotation@base_camera
    rig.matrix_world=rotation@base_rig

for name,pitch in (('level',0),('down',-30)):
    view(pitch)
    for phase,frame in zip(('ready','planted','levered','loaded','tossed','recover'),(0,8,16,25,35,45)):
        sc.frame_set(frame)
        sc.render.filepath=str(args.output/f'{name}-{phase}.png')
        bpy.ops.render.render(write_still=True)
if args.preview:
    view(-30)
    for frame in range(45):
        sc.frame_set(frame);sc.render.filepath=str(args.output/f'loop-{frame:03}.png');bpy.ops.render.render(write_still=True)
print('ScoopFP camera: vertical FOV 76deg, aspect 16:9, near=.045; camera-child framing at 0/-30deg')

if args.metrics:
    # Data-only masks are rendered on EEVEE/Vulkan as well. No CPU rasterizer.
    sc.view_settings.view_transform = 'Standard'
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0
    sc.eevee.taa_render_samples = 8
    sc.render.film_transparent = False
    for obj in sc.objects:
        if obj.type == 'MESH' and not obj.name.startswith('CGLCamper_'):
            obj.hide_render = True
    def emission(name, color):
        mat = bpy.data.materials.new(name);mat.use_nodes=True
        nodes=mat.node_tree.nodes;nodes.clear()
        emit=nodes.new('ShaderNodeEmission');emit.inputs[0].default_value=(*color,1)
        output=nodes.new('ShaderNodeOutputMaterial')
        mat.node_tree.links.new(emit.outputs[0], output.inputs[0]);return mat
    colors={
        'arms': emission('ScoopFP.MaskArms',(0,1,0)),
        'blade': emission('ScoopFP.MaskBlade',(1,0,0)),
        'shaft': emission('ScoopFP.MaskShaft',(0,0,1))}
    meshes=[o for o in rig.children if o.type == 'MESH']
    for obj in meshes:
        kind = 'blade' if obj.name.endswith('ShovelBlade') else ('arms' if obj.name.endswith(('Sleeve','Hand')) else 'shaft')
        for slot in obj.material_slots:
            slot.material=colors[kind]
    view(-30)
    for frame in range(46):
        sc.frame_set(frame)
        dirt.hide_render=True
        for obj in meshes: obj.hide_render=False
        sc.render.filepath=str(args.output/f'mask-full-{frame:03}.png')
        bpy.ops.render.render(write_still=True)
        for obj in meshes: obj.hide_render=not obj.name.endswith('ShovelBlade')
        sc.render.filepath=str(args.output/f'mask-blade-{frame:03}.png')
        bpy.ops.render.render(write_still=True)
