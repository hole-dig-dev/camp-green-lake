exec(open('/home/botuser/camp-green-lake-blockbench/art/blender/cgl_blender.py').read())
import numpy as np
if bpy.data.scenes.get('RenderTest'):
    for o in list(bpy.data.scenes['RenderTest'].objects): bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.scenes.remove(bpy.data.scenes['RenderTest'])

# ---------- chain-link texture: diamond wire on transparent, 256 px, packed into the .blend/GLB ----------
def chainlink():
    im=bpy.data.images.get('chainlink.png')
    if im: bpy.data.images.remove(im)
    N=256;y,x=np.mgrid[0:N,0:N]/N
    cell=8;u=(x+y)*cell%1;v=(x-y)*cell%1
    d=np.minimum(np.minimum(u,1-u),np.minimum(v,1-v))
    a=np.clip(1-(d-0.05)/0.03,0,1)          # wire ~6% of a diamond wide, soft edge
    shade=0.78+0.22*np.sin((x+y)*cell*np.pi*2)  # a little twist highlight along each wire
    rgba=np.zeros((N,N,4),np.float32);rgba[...,0]=0.42*shade;rgba[...,1]=0.46*shade;rgba[...,2]=0.45*shade;rgba[...,3]=a
    im=bpy.data.images.new('chainlink.png',N,N,alpha=True);im.pixels.foreach_set(rgba.ravel());im.file_format='PNG';im.pack()
    return im
def chainlink_mat():
    m=bpy.data.materials.get('cgl_chainlink')
    if m: bpy.data.materials.remove(m)
    m=bpy.data.materials.new('cgl_chainlink');m.use_nodes=True;nt=m.node_tree;b=nt.nodes['Principled BSDF']
    t=nt.nodes.new('ShaderNodeTexImage');t.image=chainlink();t.interpolation='Linear'
    nt.links.new(t.outputs['Color'],b.inputs['Base Color']);nt.links.new(t.outputs['Alpha'],b.inputs['Alpha'])
    b.inputs['Metallic'].default_value=0.6;b.inputs['Roughness'].default_value=0.55
    m.blend_method='CLIP' if hasattr(m,'blend_method') else None;m.alpha_threshold=0.5
    try: m.surface_render_method='DITHERED'
    except Exception: pass
    return m

# ---------- FencePost ----------
sc=scene('FencePost');r=root('FencePost')
box('footing',(0.46,0.46,0.26),(0,0,0.11),('concrete','concrete',0.95),bevel=0.03,parent=r)
cyl('pole',0.07,3.5,(0,0,1.75),('steel','steel',0.5,0.7),verts=12,parent=r)
cyl('cap',0.095,0.1,(0,0,3.53),('steel','steel',0.5,0.7),verts=12,r2=0.05,parent=r)
# outward-leaning barbed-wire arm (the classic prison "V" top, tilted toward the lake)
# arm leans outward (-Y, toward the lake) from the top of the pole; wires run along it
ARM_DIR=Vector((0,-math.sin(math.radians(35)),math.cos(math.radians(35))));ARM_BASE=Vector((0,0,3.46));ARM_LEN=0.8
box('arm',(0.06,0.06,ARM_LEN),ARM_BASE+ARM_DIR*(ARM_LEN/2),('steel','steel',0.5,0.7),rot=(math.radians(35),0,0),bevel=0.006,parent=r)
def arm_pt(t):return ARM_BASE+ARM_DIR*(t*ARM_LEN)+Vector((0,0.0,0.045))   # just above the arm's top face
for i,t in enumerate((0.3,0.6,0.9)):
    cyl(f'insulator{i}',0.028,0.07,arm_pt(t),('ink','ink',0.6),verts=6,bevel=0,parent=r)
for i,z in enumerate((0.45,2.95,3.35)):   # rail clamps
    box(f'clamp{i}',(0.2,0.12,0.08),(0,0,z),('steel','steel',0.5,0.7),bevel=0.01,parent=r)
studio(elev=14,lens=55);frame();print('post tris',tris());render()

# ---------- FenceSpan: 2.5 m of rails + chain link + three barbed strands, between two posts ----------
sc=scene('FenceSpan');r=root('FenceSpan');W=2.5
for i,z in enumerate((0.45,2.95,3.35)):
    cyl(f'rail{i}',0.035,W,(0,0,z),('steel','steel',0.5,0.7),verts=8,rot=(0,math.pi/2,0),parent=r)
bpy.ops.mesh.primitive_plane_add(size=1,location=(0,0,1.9),rotation=(math.pi/2,0,0));p=bpy.context.active_object;p.name='chainlink'
p.scale=(W,2.9,1);bpy.ops.object.transform_apply(scale=True);_link(p);p.parent=r
p.data.materials.append(chainlink_mat())
uv=p.data.uv_layers.active.data
for lp in p.data.loops:   # tile the diamond texture ~1 repeat per 0.6 m so the mesh reads at game scale
    co=p.data.vertices[lp.vertex_index].co;uv[lp.index].uv=((co.x+W/2)/0.6,(co.z+1.45)/0.6)
# barbed strands along the arm line: slightly sagging, with little barbs
ARM_DIR=Vector((0,-math.sin(math.radians(35)),math.cos(math.radians(35))));ARM_BASE=Vector((0,0,3.46));ARM_LEN=0.8
for k,t in enumerate((0.3,0.6,0.9)):
    pt=ARM_BASE+ARM_DIR*(t*ARM_LEN)+Vector((0,0,0.075))   # resting on the post's insulators
    cyl(f'barb{k}',0.009,W,(0,pt.y,pt.z),('wire','wire',0.5,0.8),verts=5,rot=(0,math.pi/2,0),bevel=0,parent=r)
    for j in range(8):
        x=-W/2+0.16+j*0.31;box(f'barb{k}_{j}',(0.012,0.09,0.012),(x,pt.y,pt.z),('wire','wire',0.5,0.8),rot=(math.radians(45),0,math.radians(30)),bevel=0,parent=r)
studio(elev=14,azim=-32,lens=45)
posts=[instance('postL','FencePost',(-W/2,0,0)),instance('postR','FencePost',(W/2,0,0))]
frame(extra=posts);print('span tris',tris());render()
bpy.ops.wm.save_mainfile()
