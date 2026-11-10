"""art/blender/gila_colors.py : repaint the gila's spots in the shipped model (no Blender needed).

The gold-eyed gila (docs/STORY.md) was first painted olive with bright yellow spots. Its spots are orange now, the
colour of a real gila's beading, so nothing about it is the old setting's lizard. The paint is stored as vertex
colours, so this edits those numbers in place in public/models/CreatureLizard.glb and the copy in art/blender/glb/:
every vertex painted the old spot yellow gets the same shade of orange (lighter and darker spots keep their
difference). Shape, rig, clips and every other colour are untouched; the file's size and layout do not change.
art/blender/beasts.py paints the same orange (YEL there), so a rebuild matches. Safe to run again: once there is no
yellow left it changes nothing.

Run:  python3 art/blender/gila_colors.py
"""
import json, os, struct
HERE = os.path.dirname(os.path.abspath(__file__))
FILES = [os.path.join(HERE, '..', '..', 'public', 'models', 'CreatureLizard.glb'), os.path.join(HERE, 'glb', 'CreatureLizard.glb')]
SPOT = (0xe8, 0x78, 0x38)             # the new spot colour (sRGB), for a vertex that was the brightest yellow (red channel 0xf0)
def to_srgb(v): return v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
def to_lin(v): return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
for path in FILES:
    b = bytearray(open(path, 'rb').read()); jlen = struct.unpack_from('<I', b, 12)[0]; j = json.loads(bytes(b[20:20 + jlen])); bin0 = 20 + jlen + 8
    n = 0
    for mesh in j['meshes']:
        for prim in mesh['primitives']:
            if 'COLOR_0' not in prim['attributes']: continue
            a = j['accessors'][prim['attributes']['COLOR_0']]; bv = j['bufferViews'][a['bufferView']]
            assert a['componentType'] == 5126, 'expected float vertex colours'
            width = 4 if a['type'] == 'VEC4' else 3; stride = bv.get('byteStride', 4 * width); off = bin0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
            for i in range(a['count']):
                r, g, bl = (to_srgb(v) for v in struct.unpack_from('<3f', b, off + i * stride))
                if r > 0.75 and g > 0.55 and bl < 0.3:                      # the old spot yellow, light or dark
                    k = r / (0xf0 / 255)
                    struct.pack_into('<3f', b, off + i * stride, *(to_lin(min(1.0, c / 255 * k)) for c in SPOT)); n += 1
    if n: open(path, 'wb').write(b)
    print('GILA %s: %d spot vertices repainted' % (os.path.relpath(path, os.path.join(HERE, '..', '..')), n))
