"""Alien face-only Wardrobe attachment on the unchanged, actual camper head.

env -u DISPLAY TMPDIR="$PWD/.ufo-tmp" blender -b --factory-startup \
  --gpu-backend vulkan --threads 4 --python-exit-code 1 --python art/blender/alien_face.py
All exported pieces are in head-local metres. Blender -Y -> game +Z forward.
The exact camper head is read as a fit reference, excluded from the GLB.
"""
from pathlib import Path
import bpy, math, json, struct, shutil, hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[1]
exec((HERE/'cgl_blender.py').read_text())
scene('AlienFace');ROOT=root('AlienFaceRoot')
ROOT['attachment']='head';ROOT['cosmeticOnly']=True;ROOT['head']='unchanged'
EYES=('alien_face_black_eyes',(8,13,15),.12,0)
INK=('alien_face_nostrils_mouth',(12,35,15),.8,0)
GLINT=('alien_face_eye_glints',(203,232,223),.16,0)
GREEN=('alien_face_fit_reference',(95,208,74),.7,0)

# Extract the reference from the approved GLB, never rebuild or enlarge its head.
source=(REPO/'public/models/camper.glb').read_bytes()
size=struct.unpack_from('<I',source,12)[0]
gltf=json.loads(source[20:20+size]);binary=source[28+size:]
def read(index):
    a=gltf['accessors'][index];v=gltf['bufferViews'][a['bufferView']]
    fmt={5126:'f',5123:'H',5125:'I'}[a['componentType']]
    width={'SCALAR':1,'VEC3':3}[a['type']];stride=struct.calcsize(fmt)*width
    return [struct.unpack_from('<'+fmt*width,binary,v.get('byteOffset',0)+a.get('byteOffset',0)+i*v.get('byteStride',stride))
            for i in range(a['count'])]
node=next(n for n in gltf['nodes'] if n.get('name')=='CGLCamper_Head')
primitive=gltf['meshes'][node['mesh']]['primitives'][0]
vertices=[Vector((x,-z,y)) for x,y,z in read(primitive['attributes']['POSITION'])]
indices=[i[0] for i in read(primitive['indices'])]
polygons=[tuple(indices[i:i+3]) for i in range(0,len(indices),3)]
bvh=BVHTree.FromPolygons(vertices,polygons,all_triangles=True)
ref_mesh=bpy.data.meshes.new('OriginalCamperHeadReference')
ref_mesh.from_pydata(vertices,[],polygons);ref_mesh.update()
reference=bpy.data.objects.new('OriginalCamperHeadReference',ref_mesh)
coll('Studio').objects.link(reference);ref_mesh.materials.append(mat(*GREEN))
for p in ref_mesh.polygons:p.use_smooth=True

def surface(phi,z):
    direction=Vector((math.sin(phi),-.90*math.cos(phi),0)).normalized()
    hit,normal,_,_=bvh.ray_cast(Vector((0,0,z))+direction*2,-direction,4)
    assert hit is not None,('eye off original head',phi,z)
    # Smooth radial normal makes the glossy lens continuous across head facets.
    smooth=Vector((math.sin(phi),-math.cos(phi)/.9,0)).normalized()
    return hit,smooth

def mesh(name,vs,faces,spec):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],faces);me.update()
    obj=bpy.data.objects.new(name,me);coll().objects.link(obj);obj.parent=ROOT
    me.materials.append(mat(*spec))
    for p in me.polygons:p.use_smooth=True
    return obj

def eye(s):
    # Wide almond patches follow the ORIGINAL head surface out to 70 degrees
    # around either temple. No cranium, jaw, neck, nose or replacement skin.
    n=48;steps=10;vs=[];faces=[]
    def point(r,a,back=False):
        u=.57*math.cos(a)*r
        v=.092*math.sin(a)*abs(math.sin(a))**.3*r
        z=.398+v+.046*(u/.57)
        phi=s*(.65+u)
        hit,normal=surface(phi,z)
        depth=.002 if back else .006+.023*(1-r*r)
        return hit+normal*depth
    # Two centre vertices and concentric rings give a closed, shallow lens.
    for back in (False,True):
        base=len(vs);vs.append(point(0,0,back))
        for j in range(1,steps+1):
            for k in range(n):vs.append(point(j/steps,math.tau*k/n,back))
        for k in range(n):faces.append((base,base+1+k,base+1+(k+1)%n))
        for j in range(steps-1):
            for k in range(n):
                a=base+1+j*n+k;b=base+1+j*n+(k+1)%n
                faces.append((a,a+n,b+n,b))
    stride=1+steps*n
    # Wind front/back consistently for both sides, then recalc actual normals.
    faces=[tuple(reversed(f)) if i>=n+(steps-1)*n else f for i,f in enumerate(faces)]
    for k in range(n):
        a=1+(steps-1)*n+k;b=1+(steps-1)*n+(k+1)%n
        faces.append((a,b,b+stride,a+stride))
    o=mesh('AlienFace_Eye'+str(s),vs,faces,EYES)
    import bmesh
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    return o

def ball(name,loc,scale,spec):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    _finish(o,spec,0,ROOT)
    for p in o.data.polygons:p.use_smooth=True
    return o

def front(x,z):
    hit,normal,_,_=bvh.ray_cast(Vector((x,-2,z)),Vector((0,1,0)),4)
    assert hit is not None
    return hit,normal

for s in (-1,1):
    eye(s)
    hit,normal=surface(s*.65,.424)
    o=ball('AlienFace_EyeGlint'+str(s),hit+normal*.030,(.015,.003,.006),GLINT)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=normal.to_track_quat('-Y','Z')
    hit,normal=front(s*.022,.283)
    o=ball('AlienFace_NostrilDot'+str(s),hit+normal*.005,(.006,.003,.008),INK)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=normal.to_track_quat('-Y','Z')
vs=[];faces=[]
for i in range(25):
    x=-.055+.11*i/24;z=.192+.0015*(x/.055)**2
    hit,normal=front(x,z);centre=hit+normal*.005
    for k in range(8):
        a=math.tau*k/8;vs.append(centre+Vector((0,.0025*math.cos(a),.0025*math.sin(a))))
for i in range(24):
    for k in range(8):faces.append((i*8+k,i*8+(k+1)%8,(i+1)*8+(k+1)%8,(i+1)*8+k))
faces.extend([tuple(reversed(range(8))),tuple(range(24*8,25*8))])
mesh('AlienFace_SlitMouth',vs,faces,INK)

# Exactly the Wardrobe face export contract: selected root + independent parts,
# no fit reference, head, neck, body, skeleton, animation, camera or lights.
bpy.context.view_layer.update()
for o in bpy.context.view_layer.objects:o.select_set(False)
for o in [ROOT,*ROOT.children_recursive]:o.select_set(True)
bpy.context.view_layer.objects.active=ROOT
out=HERE/'glb/AlienFace.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,
    use_active_scene=True,export_apply=True,export_animations=False,export_yup=True)
shutil.copy2(out,REPO/'public/models/AlienFace.glb')
pts=[o.matrix_world@v.co for o in ROOT.children_recursive if o.type=='MESH' for v in o.data.vertices]
audit={'file':'AlienFace.glb','bytes':out.stat().st_size,'triangles':tris(),
       'attachment':'head; local position zero, identity rotation, scale one',
       'head':'original camper head and neck retained unchanged; no ridge',
       'skin_tint':'#5fd04a supplied by game, not exported',
       'forward':'Blender -Y / game +Z',
       'blender_bounds':[[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]],
       'source_camper_sha256':hashlib.sha256(source).hexdigest()}
(HERE/'renders/AlienFace-asset.json').write_text(json.dumps(audit,indent=2)+'\n')
cam=studio(target=(0,0,.35),elev=0,azim=0,floor=False)
bpy.context.view_layer.update();frame(margin=1.15,extra=[reference])
render('AlienFace',res=(1000,1000),samples=48)
cam.location=(3,-.02,.38);cam.rotation_euler=(Vector((0,0,.35))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.context.view_layer.update();frame(margin=1.15,extra=[reference])
render('AlienFace-side',res=(1000,1000),samples=48)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'alien-face.blend'),compress=True)
print('ALIEN_FACE',json.dumps(audit))
