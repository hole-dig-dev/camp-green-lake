"""Blender geometry for a foot-centred late-game hoverboard.

Rebuild from the checkout root (Eevee uses the Radeon via Vulkan):
  env -u DISPLAY TMPDIR="$PWD/.hoverboard-tmp" blender -b --factory-startup \
    --gpu-backend vulkan --threads 4 --python-exit-code 1 --python art/blender/hoverboard.py
Blender +Z is game +Y; the nose is Blender -Y / game +Z.
"""
from pathlib import Path
import bpy, math, shutil, json
from mathutils import Vector

HERE = Path(__file__).resolve().parent
exec((HERE / 'cgl_blender.py').read_text())
exec((HERE / 'pipeline_common.py').read_text())

scene('Hoverboard')
ROOT = root('Hoverboard')
SHELL = ('hover_shell_midnight', (24, 46, 68), .22, .32)
TRIM = ('hover_titanium', (164, 188, 201), .29, .48)
GRIP = ('hover_grip', (28, 33, 38), .97, 0)
RIB = ('hover_grip_ribs', (49, 56, 61), .97, 0)
BASE = ('hover_underbody', (17, 25, 34), .55, .15)
EDGE = ('hover_edge_cyan', (68, 222, 255), .3, 0)
PAD = ('hover_thruster_cyan', (35, 187, 255), .25, 0)
CORE = ('hover_pad_bluewhite', (181, 238, 255), .3, 0)
GLOW = ('hover_glow_disc', (112, 210, 255), .6, 0)

# Core glTF emission, strength <= 1: supported by the game's r128 loader without
# relying on KHR_materials_emissive_strength. Disc opacity also survives gameMat.
for spec, strength in [(EDGE, 1), (PAD, 1), (CORE, 1), (GLOW, .7)]:
    bsdf = mat(*spec).node_tree.nodes['Principled BSDF']
    bsdf.inputs['Emission Color'].default_value = srgb(spec[1])
    bsdf.inputs['Emission Strength'].default_value = strength
glow = mat(*GLOW)
glow.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .11
glow.surface_render_method = 'BLENDED'
glow.diffuse_color = (*glow.diffuse_color[:3], .11)

def mesh(name, verts, faces, spec):
    return pipe_mesh(name, verts, faces, mat(*spec), ROOT)

def outline(rx, ry, count=64):
    """Rounded touring silhouette with a slightly narrower forward shoulder."""
    pts = []
    for i in range(count):
        a = math.tau*i/count
        c, s = math.cos(a), math.sin(a)
        x = math.copysign(abs(c)**(2/3), c)*rx
        y = math.copysign(abs(s)**(2/3), s)*ry
        x *= 1 - .1*max(0, -y/ry)
        pts.append((x, y))
    return pts

def hull(name, layers, spec, caps=True):
    verts = [(x, y, z) for rx, ry, z in layers for x, y in outline(rx, ry)]
    n = 64
    faces = [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
             for j in range(len(layers)-1) for i in range(n)]
    if caps:
        faces += [tuple(reversed(range(n))), tuple(range((len(layers)-1)*n, len(layers)*n))]
    return mesh(name, verts, faces, spec)

def annulus(name, y, outer, inner, z, spec, count=48):
    verts = [(r*math.cos(math.tau*i/count), y+r*math.sin(math.tau*i/count), z)
             for r in (outer, inner) for i in range(count)]
    # Downward-facing rings on the underside.
    faces = [(i, count+i, count+(i+1)%count, (i+1)%count) for i in range(count)]
    obj = mesh(name, verts, faces, spec)
    obj.data.materials[0].use_backface_culling = False
    return obj

# A .95 x .32 m deck, .04 m shell; layered bevels are actual mesh geometry.
hull('lower_chassis', [(.143,.452,-.042),(.153,.469,-.035),(.158,.473,-.028)], BASE)
hull('continuous_edge_light', [(.158,.473,-.028),(.160,.475,-.025),(.160,.475,-.018)], EDGE)
hull('gloss_shell', [(.160,.475,-.018),(.157,.471,-.008),(.145,.457,-.002)], SHELL)
hull('top_pinstripe', [(.145,.457,-.002),(.142,.453,-.0018)], TRIM, caps=False)

# Two foot zones with discrete raised grip ribs. Highest points are exactly Z=0;
# there is no positive-Z geometry and no artificial origin offset on export.
for y in (-.205,.205):
    zone = hull('grip_zone',[(.107,.147,-.0018),(.107,.147,-.0004)],GRIP)
    zone.location.y = y
    for i in range(11):
        box('traction_rib', (.174,.006,.0004), (0,y+(i-5)*.023,-.0002), RIB,
            bevel=0, parent=ROOT)
    for x in (-.12,.12):
        for d in (-.09,.09):
            cyl('flush_deck_fastener', .005,.001,(x,y+d,-.001),TRIM,
                verts=8,bevel=0,parent=ROOT)

# Forward chevrons and central exposed spine distinguish nose and tail.
for y in (-.395,-.413):
    for x, angle in [(-.028,-.43),(.028,.43)]:
        box('nose_direction_chevron',(.057,.008,.0008),(x,y,-.0014),CORE,
            rot=(0,0,angle),bevel=0,parent=ROOT)
box('spine_inlay',(.024,.103,.0008),(0,0,-.0014),TRIM,bevel=.0003,parent=ROOT)
for y in (-.025,0,.025):
    box('power_status',(.012,.008,.0006),(0,y,-.0007),EDGE,bevel=0,parent=ROOT)
for x in (-.055,.055):
    box('tail_marker',(.042,.009,.0008),(x,.412,-.0014),TRIM,bevel=0,parent=ROOT)

# Two large downward hover pads: armoured housings, cyan induction rings,
# blue-white emitters and faint translucent discs below the solid machinery.
for index,y in enumerate((-.26,.26)):
    cyl('thruster_housing_'+str(index),.115,.025,(0,y,-.0495),BASE,
        verts=48,bevel=.003,parent=ROOT)
    cyl('thruster_rim_'+str(index),.109,.008,(0,y,-.065),TRIM,
        verts=48,bevel=.001,parent=ROOT)
    cyl('thruster_recess_'+str(index),.098,.009,(0,y,-.0655),BASE,
        verts=48,bevel=0,parent=ROOT)
    annulus('induction_ring_'+str(index),y,.102,.085,-.0705,PAD)
    cyl('bluewhite_pad_'+str(index),.076,.001,(0,y,-.071),CORE,
        verts=48,bevel=0,parent=ROOT)
    # Sparse radial spokes read as machinery from below without occluding glow.
    for k in range(6):
        a = math.tau*k/6
        box('pad_spoke',(.027,.006,.001),(.09*math.cos(a),y+.09*math.sin(a),-.071),BASE,
            rot=(0,0,a),bevel=0,parent=ROOT)
    cyl('faint_hover_disc_'+str(index),.126,.0004,(0,y,-.0818),GLOW,
        verts=48,bevel=0,parent=ROOT)
    annulus('disc_outer_halo_'+str(index),y,.135,.128,-.082,GLOW)
for x in (-.1,.1):
    box('underside_power_rail',(.014,.39,.012),(x,0,-.046),TRIM,bevel=.002,parent=ROOT)

bpy.context.view_layer.update()
out = HERE / 'glb/Hoverboard.glb'
info = pipeline_export(str(out), ROOT)
shutil.copy2(out, HERE.parents[1] / 'public/models/Hoverboard.glb')
dg = bpy.context.evaluated_depsgraph_get()
pts = [o.matrix_world @ Vector(p) for o in coll('Asset').all_objects if o.type == 'MESH'
       for p in o.evaluated_get(dg).bound_box]
lo = [min(p[i] for p in pts) for i in range(3)]
hi = [max(p[i] for p in pts) for i in range(3)]
assert abs(hi[2]) < 1e-7, 'feet surface must be at the origin'
audit = {'file':'Hoverboard.glb','bytes':info[1],'triangles':tris(),
         'blender_bounds':[lo,hi], 'game_dimensions_m':{'width':hi[0]-lo[0],
         'length':hi[1]-lo[1],'total_depth':hi[2]-lo[2]}, 'shell_depth_m':.04,
         'origin':'centre of deck top / feet at game Y=0','nose':'Blender -Y / game +Z',
         'emissive_materials':['cgl_'+s[0] for s in (EDGE,PAD,CORE,GLOW)],
         'solid_bottom_game_y':-.0715, 'suggested_top_y_above_ground_m':.0969}
(HERE/'renders/Hoverboard-asset.json').write_text(json.dumps(audit,indent=2)+'\n')

# Studio floor sits one inch below the solid thrusters; no studio geometry exports.
cam = studio(target=(0,0,-.03),elev=26,azim=44,lens=55,floor=True)
floor = bpy.data.objects['Hoverboard.floor']
floor.location.z = -.0969
floor.data.materials.clear()
floor.data.materials.append(mat('hover_studio_floor',(64,77,90),.9))
bpy.context.scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
bpy.context.scene.use_nodes = True
nt = bpy.context.scene.node_tree
nt.nodes.clear()
rl = nt.nodes.new('CompositorNodeRLayers')
glare = nt.nodes.new('CompositorNodeGlare'); glare.glare_type = 'FOG_GLOW'
glare.quality = 'HIGH'; glare.threshold = 1.2; glare.mix = -.92
comp = nt.nodes.new('CompositorNodeComposite')
nt.links.new(rl.outputs['Image'],glare.inputs['Image']); nt.links.new(glare.outputs['Image'],comp.inputs['Image'])
bpy.context.view_layer.update()
frame(margin=1.3)
render('Hoverboard',res=(1400,1000),samples=48)
floor.hide_render = True
cam.location = (1.1,-1.45,-1.1)
cam.rotation_euler = (Vector((0,0,-.04))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update()
frame(margin=1.3)
render('Hoverboard-underside',res=(1400,1000),samples=48)
floor.hide_render = False
cam.location = (1.1,-1.45,.8)
cam.rotation_euler = (Vector((0,0,-.03))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update(); frame(margin=1.3)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'hoverboard.blend'),compress=True)
print('HOVERBOARD_ASSET',json.dumps(audit))
