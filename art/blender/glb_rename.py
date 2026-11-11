"""art/blender/glb_rename.py : rename the node, mesh and material names INSIDE shipped GLBs (no Blender needed).

When the model files were renamed for the DRYWATER setting (docs/STORY.md), the names stored inside each file still
said what the .blend scene was called when it was exported (a node "WardenHouse.001", a material
"cgl_wall_WardenHouse"). The game never reads those names for these static models (it loads by file name and draws
whatever meshes are inside), so this only tidies them: it rewrites the JSON chunk of each listed GLB, leaving the
binary chunk (geometry, colours) byte for byte as it was, and prints what it changed. Safe to run again.

Not touched: the camper, wardrobe and creature models, whose bone, clip and material names the game does read.

Run:  python3 art/blender/glb_rename.py
"""
import json, os, re, struct
HERE = os.path.dirname(os.path.abspath(__file__))
DIRS = [os.path.join(HERE, '..', '..', 'public', 'models'), os.path.join(HERE, 'glb')]
# file -> [(pattern in a name, replacement)]
JOBS = {
    'SuptHouse.glb': [('WardenHouse', 'SuptHouse')], 'SuptRoom.glb': [('WardenRoom', 'SuptRoom'), ('cgl_polish', 'cgl_redink')],
    'SuptDesk.glb': [('WardenDesk', 'SuptDesk')], 'SuptNote.glb': [('WardenNote', 'SuptNote')],
    'DutchJeep.glb': [('MrSirTruck', 'DutchJeep')],
    'CompanyStore.glb': [('WreckRoom', 'CompanyStore'), ('cgl_onion', 'cgl_bitterroot')],
    'SignCompanyStore.glb': [('SignWreckRoom', 'SignCompanyStore')], 'SignChimney.glb': [('SignBigThumb', 'SignChimney')],
    'TownBldg_lil.glb': [('TownBldg_kate', 'TownBldg_lil')], 'TownBldg_marshal.glb': [('TownBldg_sheriff', 'TownBldg_marshal')],
    'TownBldg_boatshed.glb': [('cgl_t_onion', 'cgl_t_bitterroot')], 'TownBldg_cellar.glb': [('cgl_t_onion', 'cgl_t_bitterroot')],
    'FindShine.glb': [('Sploosh_1', 'FindShine')], 'SupplyTonic.glb': [('cgl_s_onion', 'cgl_s_bitterroot')],
}
def patch(path, subs):
    b = open(path, 'rb').read()
    magic, ver, total = struct.unpack_from('<4sII', b, 0); jlen, jtype = struct.unpack_from('<I4s', b, 12)
    assert magic == b'glTF' and jtype == b'JSON', path
    j = json.loads(b[20:20 + jlen]); rest = b[20 + jlen:]; changed = []
    for kind in ('nodes', 'meshes', 'materials', 'scenes'):
        for o in j.get(kind, []):
            old = o.get('name')
            if not isinstance(old, str): continue
            new = old
            for a, r in subs: new = new.replace(a, r)
            if new != old: o['name'] = new; changed.append('%s -> %s' % (old, new))
    if not changed: return []
    js = json.dumps(j, separators=(',', ':')).encode('utf-8'); js += b' ' * (-len(js) % 4)
    out = struct.pack('<4sII', magic, ver, 12 + 8 + len(js) + len(rest)) + struct.pack('<I4s', len(js), b'JSON') + js + rest
    open(path, 'wb').write(out); return changed
for d in DIRS:
    for name, subs in sorted(JOBS.items()):
        p = os.path.join(d, name)
        if not os.path.exists(p): print('missing', os.path.relpath(p, HERE)); continue
        for c in patch(p, subs): print(os.path.relpath(p, os.path.join(HERE, '..', '..')), c)
