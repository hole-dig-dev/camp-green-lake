# blend: town.blend
# Preview only (not exported): a 2 x 2 block of the buried town put together from the kit and four rooms, the way
# public/js/89-town.js lays it out, lit by a couple of lamps. Renders renders/TownPreview*.png.
import bpy,os,math
HERE=os.path.dirname(bpy.data.filepath)
globals()['__file__']=os.path.join(HERE,'town_preview.py')
exec(open(os.path.join(HERE,'cgl_blender.py')).read())
from mathutils import Vector
C=14.0
scene('TownPreview');r=root('TownPreview')
cells=[('saloon',-7,7),('jail',7,7),('store',-7,-7),('kate',7,-7)]
for k,(room,x,y) in enumerate(cells):
    instance(f'floor{k}',['TownFloorPlank','TownFloorStone','TownFloorRot','TownFloorPlank'][k],(x,y,0))
    instance(f'room{k}','TownRoom_'+room,(x,y,0))
# inner walls: a doorway between the top pair, a crawl gap between the bottom pair, doors north-south
instance('w1','TownWallDoor',(0,7,0),(0,0,math.pi/2));instance('w2','TownWallCrawl',(0,-7,0),(0,0,math.pi/2))
instance('w3','TownWallDoor',(-7,0,0));instance('w4','TownWallB',(7,0,0))
for x in (-7,7):instance(f'n{x}','TownWall',(x,14,0));instance(f's{x}','TownWall',(x,-14,0))
for y in (-7,7):instance(f'e{y}','TownWallC',(14,y,0),(0,0,math.pi/2));instance(f'w{y}','TownWall',(-14,y,0),(0,0,math.pi/2))
bpy.ops.mesh.primitive_cube_add(size=0.01);bpy.context.active_object.name='anchor'
sc=bpy.context.window.scene
def cam(name,loc,target,lens=24):
    c=bpy.data.objects.new(name,bpy.data.cameras.new(name));_link(c,'Studio');c.location=loc;c.data.lens=lens
    c.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler();return c
def lamp(name,loc,e=900,col=(1,0.8,0.55),size=0.3):
    l=bpy.data.objects.new(name,bpy.data.lights.new(name,'POINT'));_link(l,'Studio');l.location=loc;l.data.energy=e;l.data.color=col;l.data.shadow_soft_size=size;return l
for k,(room,x,y) in enumerate(cells):lamp(f'lamp{k}',(x+1,y-1,3.2),e=1400)
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.08
sc.render.resolution_x,sc.render.resolution_y=1280,800;sc.eevee.taa_render_samples=24
def ceil(on):
    for k,(room,x,y) in enumerate(cells):
        o=bpy.data.objects.get(f'ceil{k}')
        if on and not o:instance(f'ceil{k}',['TownCeiling','TownCeilingCaved','TownCeiling','TownCeiling'][k],(x,y,0))
        if not on and o:bpy.data.objects.remove(o)
for nm,loc,tg,lens in (('top',(0,-20,34),(0,0,0),22),('in_saloon',(-2.2,1.8,1.5),(-8,9,1.0),20),('in_store',(-1.5,-1.5,1.6),(-8,-9,0.8),20)):
    ceil(nm!='top');sc.camera=cam('cam_'+nm,loc,tg,lens);sc.render.filepath=os.path.join(RENDERS,'TownPreview_'+nm+'.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_mainfile();print('ok')
