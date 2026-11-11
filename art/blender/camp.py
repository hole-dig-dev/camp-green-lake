"""art/blender/camp.py : the camp's rooms (2026-11-11). Built from scratch, headless, straight to GLB.

  BunkRoomA, BunkRoomB, BunkRoomC  the three small bunkhouses, 6.0 x 7.7 m inside: four cots, a stove, a crate table,
                                    a washing line, the rules by the door. Same shell, three different crews:
                                    A keeps it squared away, B is a mess, C collects the lake's junk.
  BunkRoomD                         the player's crew, 7.2 x 10.2 m: three bunk beds with the crew's names on them,
                                    the card table, the shovel rack, a stove with the coffee on. Home.
  SuptRoom2                         the Superintendent's house inside, 8 x 6 m: the one comfortable room in camp.
The furniture that the game also uses as models (cots, bunk beds, footlockers, the card table and stools, her desk)
is placed by public/js/20-world.js; these rooms are the shell and everything else. Every number here is the game's
room-local coordinates (camp_kit.py): x east, y up, z toward the back wall, the door wall at z = -D.
The sizes and every solid thing's footprint must match ROOM_LAYOUT in public/js/20-world.js.

Run:  ~/blender/blender -b --factory-startup --python art/blender/camp.py [-- --only BunkRoomD,SuptRoom2]
"""
import bpy, sys, os, math, random
sys.dont_write_bytecode = True   # no __pycache__ next to the scripts
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from camp_kit import Asset, mat, wipe

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = ARGS[ARGS.index('--only') + 1].split(',') if '--only' in ARGS else None

# ---- palette (sRGB hex) ----
def palette():
    g = {}
    g['floor'] = mat('floorboard', 0x7d6446, 0.9); g['floor2'] = mat('floorboard_old', 0x6a5238, 0.9); g['gap'] = mat('floorgap', 0x3e3022, 1.0)
    g['timber'] = mat('timber', 0x6b4f33, 0.85); g['timberd'] = mat('timber_dark', 0x4b392b, 0.85); g['board'] = mat('wallboard', 0x8a6a48, 0.9)
    g['canvas'] = mat('canvas_in', 0xbaa57a, 0.95); g['canvasd'] = mat('canvas_roof_in', 0x9c8b63, 0.95)
    g['day'] = mat('daylight', 0x3a4250, 1.0); g['lamp'] = mat('lampglow', 0xffd890, 0.4); g['stove'] = mat('stoveglow', 0xff8a3a, 0.6)
    # daylight: dark glass the game lights (bright by day, a faint blue at night); lampglow / stoveglow: lit by the game too
    g['iron'] = mat('stove_iron', 0x2c2a28, 0.7); g['tin'] = mat('tin', 0x8d8a80, 0.6); g['steel'] = mat('steel_dark', 0x4d5450, 0.7)
    g['paper'] = mat('paper', 0xeee0bc, 0.95); g['paper2'] = mat('paper_old', 0xd8c497, 0.95); g['ink'] = mat('ink', 0x2b1d12, 0.9)
    g['red'] = mat('paint_red', 0xa6442e, 0.8); g['cork'] = mat('cork', 0xb88f5c, 0.95); g['brass'] = mat('brass', 0xc89b3c, 0.5)
    g['denim'] = mat('cloth_denim', 0x4a5a78, 0.95); g['khaki'] = mat('cloth_khaki', 0xb9a47a, 0.95); g['flannel'] = mat('cloth_flannel', 0x9a3a2a, 0.95)
    g['white'] = mat('cloth_white', 0xe6dcc6, 0.95); g['olive'] = mat('cloth_olive', 0x6f7a4c, 0.95); g['leather'] = mat('leather', 0x5a3b24, 0.8)
    g['rope'] = mat('rope', 0xb29c72, 0.95); g['glass'] = mat('bottle_glass', 0x7aa38a, 0.3); g['amber'] = mat('bottle_amber', 0x9a5a22, 0.3)
    g['sack'] = mat('sacking', 0xa18b63, 0.95); g['green'] = mat('felt_green', 0x3f6a48, 0.95); g['cactus'] = mat('cactus', 0x6f7a4c, 0.9)
    g['pebble'] = mat('pebble', 0xb8a78c, 0.9); g['water'] = mat('water_blue', 0x6f9fbf, 0.3); g['blade'] = mat('shovel_blade', 0x70746f, 0.6)
    g['handle'] = mat('shovel_handle', 0x8a6a44, 0.85)
    return g
C = None

# ======================================================================================================================
# shared room parts
def floor(a, W, D, board=0.32):
    a.box(-W, W, -0.06, 0.0, -D, D, C['gap'])
    x = -W; i = 0; rnd = random.Random(int(W * 100 + D))
    while x < W - 0.01:
        w = min(board, W - x); a.box(x + 0.01, x + w - 0.01, -0.05, 0.005, -D, D, C['floor2'] if rnd.random() < 0.18 else C['floor']); x += w; i += 1

def canvas_shell(a, W, D, H=2.45, R=3.55, door=1.1, posts=None):
    """timber-framed canvas bunkhouse: board wainscot to 0.95 m, canvas above, posts, eaves at H, ridge at R"""
    posts = posts or [-D, D]
    T = 0.08
    for s in (-1, 1):   # side walls
        a.box(s * W, s * (W + T), 0, 0.95, -D, D, C['board']); a.box(s * W, s * (W + T), 0.95, H, -D, D, C['canvas'])
        a.box(s * (W - 0.04), s * W, 0.93, 0.99, -D, D, C['timberd'])          # cap rail on the wainscot
        a.box(s * (W - 0.12), s * W, H - 0.14, H, -D, D, C['timber'])          # top plate
        for z in posts: a.box(s * (W - 0.14), s * W, 0, H, z - 0.07, z + 0.07, C['timber'])
    for zs, zw in ((D, D + T),):    # back wall
        a.box(-W, W, 0, 0.95, zs, zw, C['board']); a.box(-W, W, 0.95, H, zs, zw, C['canvas']); a.box(-W, W, 0.93, 0.99, zs - 0.04, zs, C['timberd'])
    # door wall, with a doorway `door` wide and 2.1 high, and the door shut in it
    z0, z1 = -D - T, -D
    for s in (-1, 1):
        a.box(s * door / 2, s * W, 0, 0.95, z0, z1, C['board']); a.box(s * door / 2, s * W, 0.95, H, z0, z1, C['canvas'])
        a.box(s * door / 2, s * (door / 2 + 0.1), 0, 2.2, z0 - 0.01, z1 + 0.04, C['timber'])   # jambs
    a.box(-door / 2, door / 2, 2.1, H, z0, z1, C['canvas']); a.box(-door / 2 - 0.1, door / 2 + 0.1, 2.1, 2.22, z0 - 0.01, z1 + 0.04, C['timber'])
    a.box(-door / 2, door / 2, 0, 2.1, z0 + 0.01, z1 - 0.01, C['timberd'])                       # the door
    for y in (0.45, 1.1, 1.75): a.box(-door / 2 + 0.06, door / 2 - 0.06, y, y + 0.12, z1 - 0.01, z1 + 0.02, C['timber'])
    a.box(door / 2 - 0.2, door / 2 - 0.12, 1.0, 1.08, z1, z1 + 0.06, C['brass'])
    # gables, roof canvas, rafters and ridge (pitch rises from the eaves at H to the ridge at R)
    for zz in (D + 0.04, -D - 0.04):
        a.prism([(-W, H), (W, H), (0, R)], 'z', zz - 0.04, zz + 0.04, C['canvasd'])
    run = math.hypot(W, R - H); ang = math.atan2(R - H, W)
    for s in (-1, 1):
        a.boxc(s * W / 2, (H + R) / 2 + 0.05, 0, run + 0.15, 0.05, 2 * D + 0.1, C['canvasd'], rz=-s * ang)
        for z in posts[1:-1] if len(posts) > 2 else []:
            a.tube((s * (W - 0.1), H - 0.05, z), (0, R - 0.08, z), 0.06, C['timber'], 4)
    a.box(-0.1, 0.1, R - 0.24, R - 0.04, -D, D, C['timber'])
    for z in posts[1:-1]: a.box(-W * 0.6, W * 0.6, H + 0.25, H + 0.35, z - 0.05, z + 0.05, C['timber'])   # collar ties

def window(a, side, W, z, w=1.0, y0=1.2, y1=1.9):
    """a screened window in a side wall (side -1 west, +1 east): daylight pane, frame, cross bar, the canvas flap rolled up"""
    x = side * (W - 0.005)
    a.box(x - side * 0.01, x + side * 0.02, y0, y1, z - w / 2, z + w / 2, C['day'])
    for zz in (z - w / 2, z + w / 2): a.box(x - side * 0.08, x, y0 - 0.05, y1 + 0.05, zz - 0.04, zz + 0.04, C['timber'])
    for yy in (y0, y1): a.box(x - side * 0.08, x, yy - 0.04, yy + 0.04, z - w / 2, z + w / 2, C['timber'])
    a.box(x - side * 0.05, x, y0, y1, z - 0.02, z + 0.02, C['timberd']); a.box(x - side * 0.05, x, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, z - w / 2, z + w / 2, C['timberd'])
    a.cyl('z', x - side * 0.1, y1 + 0.14, 0.09, z - w / 2 - 0.05, z + w / 2 + 0.05, C['canvasd'], 8)
    for zz in (z - w / 2 + 0.1, z + w / 2 - 0.1): a.box(x - side * 0.2, x - side * 0.16, y1 + 0.02, y1 + 0.3, zz - 0.01, zz + 0.01, C['rope'])

def lantern(a, x, y, z, hang=None):
    """a hurricane lantern (glowing glass) hanging from y+hang"""
    a.cyl('y', x, z, 0.1, y - 0.16, y - 0.12, C['tin'], 8); a.cyl('y', x, z, 0.075, y - 0.12, y + 0.08, C['lamp'], 8)
    a.cone(x, z, 0.1, 0.03, y + 0.08, y + 0.2, C['tin'], 8)
    if hang: a.tube((x, y + 0.2, z), (x, y + hang, z), 0.008, C['ink'], 4)

def stove(a, x, z, top):
    """a pot-belly stove with its pipe up through the roof (top: the roof height above it); the fire shows in its door"""
    a.box(x - 0.36, x + 0.36, 0.0, 0.05, z - 0.36, z + 0.36, C['tin'])                     # tin floor plate
    a.cyl('y', x, z, 0.26, 0.12, 0.85, C['iron'], 10); a.cyl('y', x, z, 0.3, 0.5, 0.62, C['iron'], 10)
    for dx in (-0.18, 0.18):
        for dz in (-0.18, 0.18): a.box(x + dx - 0.03, x + dx + 0.03, 0.0, 0.14, z + dz - 0.03, z + dz + 0.03, C['iron'])
    a.box(x - 0.13, x + 0.13, 0.28, 0.46, z - 0.27, z - 0.23, C['stove'])                 # the fire through the door (faces -z)
    a.cyl('y', x, z, 0.29, 0.85, 0.9, C['iron'], 10)
    a.cyl('y', x, z + 0.05, 0.075, 0.9, top + 0.3, C['iron'], 8)
    a.cyl('y', x, z + 0.05, 0.11, top - 0.1, top + 0.02, C['tin'], 8)                     # the collar where it goes through
    # coffee pot / kettle
    a.cyl('y', x + 0.12, z - 0.08, 0.07, 0.9, 1.08, C['tin'], 8); a.cone(x + 0.12, z - 0.08, 0.07, 0.02, 1.08, 1.14, C['tin'], 8)

def notice(a, x, y, z, w, h, lines, face='-z', big=0.08, small=0.05, pm=None, pins=True):
    """a paper notice pinned to a wall, facing `face`; lines[0] big, the rest small"""
    n = {'-z': (0, 0, -1), '+z': (0, 0, 1), '-x': (-1, 0, 0), '+x': (1, 0, 0)}[face]
    if face in ('-z', '+z'): a.box(x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - 0.006, z + 0.006, pm or C['paper'])
    else: a.box(x - 0.006, x + 0.006, y - h / 2, y + h / 2, z - w / 2, z + w / 2, pm or C['paper'])
    ox, oz = n[0] * 0.008, n[2] * 0.008
    ty = y + h / 2 - big * 0.9
    for i, l in enumerate(lines):
        sz = big if i == 0 else small
        a.text(l, x + ox, ty, z + oz, sz, C['ink'] if i != 0 or not l.isupper() else C['ink'], face=face)
        ty -= sz * (1.25 if i == 0 else 1.35)
    if pins:
        for dx in (-w / 2 + 0.04, w / 2 - 0.04):
            px, pz = (x + dx, z + n[2] * 0.012) if face in ('-z', '+z') else (x + n[0] * 0.012, z + dx)
            a.box(px - 0.012, px + 0.012, y + h / 2 - 0.05, y + h / 2 - 0.026, pz - 0.012, pz + 0.012, C['red'])

def rules_board(a, x, z, face='+z'):
    """the Company's rules, by the door"""
    a.box(x - 0.6, x + 0.6, 1.2, 2.1, z, z + 0.04, C['cork']) if face == '+z' else None
    notice(a, x - 0.22, 1.66, z + 0.05, 0.62, 0.78, ['CAMP RULES', '1. DIG', '2. THE COMPANY', '   THANKS YOU', '3. NO ONE LEAVES', '   CAMP', '4. LIGHTS-OUT 20:00'], face='+z', big=0.075, small=0.045)
    notice(a, x + 0.33, 1.78, z + 0.05, 0.42, 0.5, ['NOTICE', 'THE CUT IS TAKEN', 'AT LIGHTS-OUT.', 'EVERY NIGHT.'], face='+z', big=0.06, small=0.035, pm=C['paper2'])

def shovel_rack(a, x0, n, z, step=0.55, shovels=True):
    """a board on the door wall with pegs; shovels hang off it (the crew's hang there in Bunk D, drawn by the game)"""
    a.box(x0 - 0.2, x0 + (n - 1) * step + 0.2, 1.5, 1.62, z, z + 0.05, C['timber'])
    for k in range(n):
        x = x0 + k * step; a.box(x - 0.02, x + 0.02, 1.52, 1.58, z + 0.05, z + 0.14, C['timberd'])
        if shovels:
            a.tube((x, 1.6, z + 0.1), (x + 0.05, 0.35, z + 0.28), 0.025, C['handle'], 6)
            a.boxc(x + 0.06, 0.2, z + 0.3, 0.26, 0.34, 0.04, C['blade'], rx=-0.35)

def boots(a, x, z, ry=0.0, m=None):
    """a pair of work boots"""
    m = m or C['leather']
    for s in (-0.07, 0.07):
        a.boxc(x + s * math.cos(ry), 0.06, z - s * math.sin(ry), 0.11, 0.12, 0.28, m, ry=ry)
        a.boxc(x + s * math.cos(ry) - 0.06 * math.sin(ry), 0.2, z - 0.06 * math.cos(ry) - s * math.sin(ry), 0.1, 0.2, 0.12, m, ry=ry)

def washing_line(a, x0, x1, z, y, items):
    """a line strung across, with clothes pegged on it (items: material per garment)"""
    a.tube((x0, y, z), (x1, y - 0.04, z), 0.008, C['rope'], 4)
    n = len(items)
    for i, (m, kind) in enumerate(items):
        x = x0 + (x1 - x0) * (i + 0.7) / (n + 0.4); yy = y - 0.02
        if kind == 'shirt': a.box(x - 0.24, x + 0.24, yy - 0.5, yy, z - 0.012, z + 0.012, m); a.box(x - 0.36, x + 0.36, yy - 0.18, yy, z - 0.01, z + 0.01, m)
        elif kind == 'pants': a.box(x - 0.2, x + 0.2, yy - 0.22, yy, z - 0.012, z + 0.012, m); [a.box(x + s - 0.085, x + s + 0.085, yy - 0.62, yy - 0.2, z - 0.012, z + 0.012, m) for s in (-0.1, 0.1)]
        elif kind == 'sock': a.box(x - 0.05, x + 0.05, yy - 0.3, yy, z - 0.01, z + 0.01, m); a.box(x - 0.05, x + 0.1, yy - 0.34, yy - 0.26, z - 0.01, z + 0.01, m)
        elif kind == 'towel': a.box(x - 0.3, x + 0.3, yy - 0.6, yy, z - 0.008, z + 0.008, m)
        a.box(x - 0.015, x + 0.015, yy - 0.04, yy + 0.04, z - 0.02, z + 0.02, C['timber'])

def shelf(a, side, W, z, w=1.2, y=1.55):
    """a plank shelf on a side wall above a cot"""
    x = side * W
    a.box(x - side * 0.26, x, y - 0.03, y, z - w / 2, z + w / 2, C['timber'])
    for zz in (z - w / 2 + 0.1, z + w / 2 - 0.1): a.box(x - side * 0.2, x, y - 0.2, y - 0.03, zz - 0.02, zz + 0.02, C['timberd'])
    return x - side * 0.13, y

def can(a, x, y, z, m=None, h=0.12, r=0.04): a.cyl('y', x, z, r, y, y + h, m or C['tin'], 8)
def bottle(a, x, y, z, m=None): a.cyl('y', x, z, 0.035, y, y + 0.17, m or C['glass'], 6); a.cyl('y', x, z, 0.014, y + 0.17, y + 0.25, m or C['glass'], 6)
def book(a, x, y, z, m, ry=0.0, flat=False):
    if flat: a.boxc(x, y + 0.02, z, 0.16, 0.04, 0.22, m, ry=ry)
    else: a.boxc(x, y + 0.11, z, 0.04, 0.22, 0.16, m, ry=ry)
def photo(a, x, y, z, face, m=None):
    """a little framed snapshot on a wall"""
    if face in ('+x', '-x'): a.box(x - 0.01, x + 0.01, y - 0.09, y + 0.09, z - 0.07, z + 0.07, C['white']); a.box(x - 0.012 if face == '+x' else x - 0.008, x + 0.008 if face == '+x' else x + 0.012, y - 0.07, y + 0.06, z - 0.055, z + 0.055, m or C['water'])
    else: a.box(x - 0.07, x + 0.07, y - 0.09, y + 0.09, z - 0.01, z + 0.01, C['white']); a.box(x - 0.055, x + 0.055, y - 0.07, y + 0.06, z - 0.012, z + 0.012, m or C['water'])

def calendar(a, x, z, face='+z', crossed=9):
    """the Company calendar, the days crossed off"""
    notice(a, x, 1.62, z, 0.36, 0.46, ['DRYWATER', 'RECLAMATION CO.'], face=face, big=0.045, small=0.03)
    n = 1 if face == '+z' else -1
    for k in range(20):
        cx = x - 0.13 + (k % 5) * 0.065; cy = 1.5 - (k // 5) * 0.055
        a.box(cx - 0.024, cx + 0.024, cy - 0.018, cy + 0.018, z + n * 0.007, z + n * 0.009, C['paper2'])
        if k < crossed: a.boxc(cx, cy, z + n * 0.011, 0.05, 0.008, 0.003, C['red'], rz=0.6); a.boxc(cx, cy, z + n * 0.011, 0.05, 0.008, 0.003, C['red'], rz=-0.6)

# ======================================================================================================================
# the small bunkhouses: four cots (two a side, heads toward the door), a stove at the back, a crate table in the aisle
SMALL_W, SMALL_D = 3.0, 3.85
COTS_SMALL = [(-2.25, -1.8), (-2.25, 1.55), (2.25, -1.8), (2.25, 1.55)]   # 20-world.js ROOM_LAYOUT.small.cots

def bunk_small(letter):
    W, D = SMALL_W, SMALL_D
    a = Asset('BunkRoom' + letter)
    floor(a, W, D); canvas_shell(a, W, D, posts=[-D, -D + 1.92, 0.0, D - 1.92, D])
    for s in (-1, 1):
        for z in (-1.8, 1.55): window(a, s, W, z)
    stove(a, 0, D - 0.65, 3.4)
    a.box(-0.35, 0.35, 0.0, 0.03, D - 1.2, D - 1.1, C['tin'])
    # crate table and two upturned buckets for seats (solid: 0.8 x 0.8 at (0, 0.55))
    a.box(-0.36, 0.36, 0, 0.62, 0.2, 0.9, C['board']); a.box(-0.38, 0.38, 0.62, 0.66, 0.18, 0.92, C['timber'])
    a.text('DRC', 0, 0.36, 0.195, 0.12, C['ink'], face='-z', font='BigShouldersStencilDisplay')
    for x in (-0.7, 0.7): a.cyl('y', x, 0.55, 0.15, 0, 0.42, C['tin'], 8)
    lantern(a, 0, 2.15, 0.0, hang=1.3)
    shovel_rack(a, -2.6, 4, -D + 0.02, step=0.42)
    rules_board(a, 1.7, -D + 0.01)
    if letter == 'A':
        # A: squared away. Boots in a row, a checkers game set out, a cactus in a can on the sill, the calendar kept.
        for k, x in enumerate((0.85, 1.25, 1.65, 2.05)): boots(a, x, -D + 0.3)
        for k in range(8):
            for j in range(8):
                if (k + j) % 2: a.box(-0.32 + k * 0.08, -0.32 + k * 0.08 + 0.08, 0.661, 0.664, 0.23 + j * 0.08, 0.31 + j * 0.08, C['red'])
        for k in range(6): a.cyl('y', -0.28 + (k % 3) * 0.16, 0.36 + (k // 3) * 0.4, 0.028, 0.664, 0.68, C['ink'] if k < 3 else C['white'], 8)
        can(a, 2.8, 1.21, -1.5, C['red'], 0.1, 0.05); a.cyl('y', 2.8, -1.5, 0.035, 1.31, 1.48, C['cactus'], 6)
        calendar(a, -1.6, D - 0.01, face='-z', crossed=11)
        for s in (-1, 1):
            for z in (-1.8, 1.55):
                x, y = shelf(a, s, W, z + 0.2, 0.9)
                book(a, x, y, z - 0.05, C['denim']); book(a, x, y, z + 0.0, C['flannel']); can(a, x, y, z + 0.3); a.boxc(x, y + 0.04, z + 0.5, 0.18, 0.08, 0.14, C['white'])
        washing_line(a, -1.6, 1.6, D - 1.5, 2.4, [(C['white'], 'shirt'), (C['khaki'], 'pants'), (C['white'], 'sock'), (C['white'], 'sock')])
        notice(a, -W + 0.02, 1.45, 0.2, 0.3, 0.38, ['INSPECTED'], face='+x', big=0.05, pm=C['paper2'])
    elif letter == 'B':
        # B: a mess. Laundry on every line, cards all over the table, soda bottles, a guitar, a dartboard by the stove.
        for k, (x, z, r) in enumerate(((0.9, -D + 0.5, 0.4), (1.6, -D + 0.9, 2.2), (-0.6, -1.2, 1.0), (2.1, -D + 0.35, -0.3))): boots(a, x, z, r)
        rnd = random.Random(5)
        for k in range(14): a.boxc(rnd.uniform(-0.3, 0.3), 0.666 + k * 0.001, rnd.uniform(0.25, 0.85), 0.06, 0.004, 0.09, C['white'] if k % 3 else C['red'], ry=rnd.uniform(0, 3))
        for k in range(5): bottle(a, rnd.uniform(-1.2, 1.2) if k < 3 else 0.2 + k * 0.05, 0 if k < 3 else 0.66, rnd.uniform(-0.6, 2.4) if k < 3 else 0.7, C['amber'] if k % 2 else C['glass'])
        a.boxc(-1.0, 0.06, 2.5, 0.06, 0.12, 0.25, C['amber'], rx=1.57)      # a bottle rolled under a cot
        washing_line(a, -2.8, 2.8, -0.15, 2.4, [(C['flannel'], 'shirt'), (C['denim'], 'pants'), (C['white'], 'sock'), (C['olive'], 'towel'), (C['khaki'], 'shirt'), (C['white'], 'sock'), (C['denim'], 'pants')])
        washing_line(a, -2.8, 2.8, D - 1.3, 2.4, [(C['white'], 'towel'), (C['flannel'], 'sock'), (C['khaki'], 'pants')])
        # guitar against the back wall
        a.boxc(-1.25, 0.32, D - 0.12, 0.36, 0.44, 0.1, C['amber'], rz=0.15); a.boxc(-1.21, 0.5, D - 0.17, 0.11, 0.11, 0.02, C['ink'], rz=0.15)
        a.boxc(-1.33, 0.85, D - 0.12, 0.06, 0.62, 0.05, C['leather'], rz=0.15)
        # dartboard and darts
        a.cyl('z', 1.3, 1.65, 0.24, D - 0.03, D, C['ink'], 12); a.cyl('z', 1.3, 1.65, 0.17, D - 0.04, D - 0.03, C['cork'], 12); a.cyl('z', 1.3, 1.65, 0.04, D - 0.05, D - 0.04, C['red'], 8)
        for dx, dy in ((0.05, 0.08), (-0.1, -0.04), (0.6, 0.3)): a.tube((1.3 + dx, 1.65 + dy, D - 0.04), (1.3 + dx, 1.65 + dy, D - 0.16), 0.008, C['brass'], 4)
        for s in (-1, 1):
            x, y = shelf(a, s, W, 1.75, 0.9)
            for k in range(3): bottle(a, x, y, 1.45 + k * 0.18, C['amber'] if k else C['glass'])
        a.box(1.8, 2.6, 0.0, 0.18, 0.35, 0.9, C['flannel'])       # a heap of clothes on the floor
        notice(a, W - 0.02, 1.45, -0.2, 0.34, 0.42, ['WHO TOOK', 'MY SOAP'], face='-x', big=0.05, small=0.05, pm=C['paper2'])
    else:
        # C: the collectors. Jars of the lake's pebbles and bottle caps, an oar for a lake that isn't there, an old photo of
        # the water, a "map" of where the good stuff is.
        for k, x in enumerate((0.85, 1.4, 2.0)): boots(a, x, -D + 0.32, 0.2 * k)
        for s in (-1, 1):
            for z in (-1.8, 1.55):
                x, y = shelf(a, s, W, z + 0.15, 1.1)
                for k in range(4):
                    jz = z - 0.3 + k * 0.22; a.cyl('y', x, jz, 0.05, y, y + 0.15, C['glass'], 6)
                    a.cyl('y', x, jz, 0.04, y + 0.005, y + 0.09, C['pebble'] if k % 2 else C['brass'], 6)
        a.boxc(W - 0.1, 1.6, 0.0, 0.08, 0.12, 2.6, C['timber'], rx=0.0)         # an oar on the wall
        a.boxc(W - 0.1, 1.6, 1.4, 0.06, 0.3, 0.5, C['timber'])
        photo(a, -W + 0.02, 1.7, 0.0, '+x'); photo(a, -W + 0.02, 1.62, 0.25, '+x', C['day'])
        notice(a, -0.9, 1.65, D - 0.01, 0.62, 0.48, ['THE GOOD SPOTS', 'X  X    X', '   X  ?'], face='-z', big=0.055, small=0.06, pm=C['paper2'])
        for k in range(24):
            cx = 0.9 + (k % 6) * 0.09; cy = 1.85 - (k // 6) * 0.09
            a.cyl('z', cx, cy, 0.03, D - 0.02, D, C['brass'] if k % 3 else C['red'], 8)
        washing_line(a, -1.6, 1.6, D - 1.5, 2.4, [(C['olive'], 'shirt'), (C['white'], 'sock'), (C['khaki'], 'pants')])
        a.cyl('y', 0.15, 0.55, 0.05, 0.66, 0.8, C['glass'], 6); a.cyl('y', 0.15, 0.55, 0.04, 0.665, 0.74, C['pebble'], 6)
    a.export()

# ======================================================================================================================
# Bunk D: the player's crew. Three bunk beds down the west wall (the crew's names on them), the card table, the rack.
DW, DD = 3.6, 5.1
CREW = [('RANDY', 'STAN'), ('PETE', 'LARRY'), ('ZACH', 'JIM BOB')]   # lower, upper berth of each bed (30-npcs.js BOT_BUNK)
BEDS_D = [-3.1, -0.2, 2.7]                                           # bunk bed z (x = -2.85)

def bunk_d():
    W, D = DW, DD
    a = Asset('BunkRoomD')
    floor(a, W, D); canvas_shell(a, W, D, posts=[-D, -D + 2.55, 0.0, D - 2.55, D])
    for z in (-1.65, 1.25): window(a, -1, W, z, 0.8, 1.35, 1.95)
    for z in (-2.4, 0.4, 3.2): window(a, 1, W, z)
    stove(a, 2.5, D - 0.75, 3.35)
    a.box(2.1, 2.9, 0.0, 0.03, D - 1.3, D - 1.2, C['tin'])
    # the crew's name boards on the bunk ends (facing the aisle) and a little of each man above his berth
    for (lo, hi), z in zip(CREW, BEDS_D):
        for nm, y in ((lo, 0.78), (hi, 1.95)):
            a.box(-2.17, -2.15, y - 0.08, y + 0.08, z - 0.4, z + 0.4, C['paper2'])
            a.text(nm, -2.145, y, z, 0.1, C['ink'], face='+x')
    # Jim Bob (top of the back bed): reading glasses on the contract.  Randy (bottom, front): a hot-water bottle for his back.
    a.box(-3.55, -3.0, 1.9, 1.902, 2.4, 2.75, C['paper']); a.text('CONTRACT', -3.27, 1.903, 2.57, 0.045, C['ink'], face='+x')
    for s in (-0.05, 0.05): a.cyl('x', 2.57 + s, 1.91, 0.025, -3.3, -3.29, C['ink'], 8)
    a.boxc(-2.7, 0.66, -3.6, 0.22, 0.06, 0.3, C['red'])
    # Stan (top, front): a photo of the lake with water in it.  Pete (bottom, middle): a jar of dirt with a label.
    photo(a, -3.58, 2.1, -3.0, '+x'); photo(a, -3.58, 2.1, -2.75, '+x', C['day'])
    a.cyl('y', -3.3, -0.55, 0.06, 0.64, 0.82, C['glass'], 6); a.cyl('y', -3.3, -0.55, 0.05, 0.645, 0.76, C['leather'], 6)
    # Larry (top, middle): a coffee can of things he found.  Zach (bottom, back): his own shovel, clean, by the bed.
    can(a, -3.3, 1.67, 0.3, C['red'], 0.16, 0.07); a.boxc(-3.3, 1.86, 0.3, 0.1, 0.04, 0.06, C['brass'])
    a.tube((-2.2, 1.1, 3.95), (-2.15, 0.25, 4.15), 0.025, C['handle'], 6); a.boxc(-2.14, 0.12, 4.2, 0.24, 0.3, 0.04, C['blade'], rx=-0.3)
    # the shovel rack on the door wall, left of the door: six pegs, empty (the crew's shovels are the game's, 30-npcs.js)
    shovel_rack(a, -3.3, 6, -D + 0.02, step=0.45, shovels=False)
    rules_board(a, 1.6, -D + 0.01)
    calendar(a, 2.75, -D + 0.01, face='+z', crossed=13)
    # boots by the door, six pairs
    for k in range(6): boots(a, 0.8 + k * 0.42, -D + 0.32, (k % 3 - 1) * 0.15)
    # the crew's water barrel by the door (30-npcs.js: the tent's water cooler)
    a.cyl('y', 3.05, -3.7, 0.3, 0, 0.9, C['steel'], 10); a.cyl('y', 3.05, -3.7, 0.32, 0.86, 0.92, C['tin'], 10); a.cyl('y', 3.05, -3.7, 0.04, 0.92, 1.0, C['tin'], 6)
    a.box(2.72, 2.76, 0.5, 0.54, -3.75, -3.65, C['brass'])
    for k in range(3): a.cyl('y', 3.25 - k * 0.12, -3.35, 0.035, 0.92, 1.02, C['tin'], 6)
    # a feed-sack rug under the card table, a shelf of tin mugs, a radio
    a.box(-0.1, 2.9, 0.005, 0.012, -1.2, 1.8, C['sack'])
    for x in (0.1, 2.7): a.box(x - 0.04, x + 0.04, 0.012, 0.016, -1.2, 1.8, C['flannel'])
    a.box(DW - 0.26, DW, 1.47, 1.5, -1.45, 0.1, C['timber'])
    for k in range(4): a.cyl('y', DW - 0.13, -1.3 + k * 0.17, 0.045, 1.5, 1.6, C['tin'], 8)
    a.box(DW - 0.24, DW - 0.04, 1.5, 1.72, -0.35, 0.05, C['leather']); a.cyl('x', -0.25, 1.62, 0.05, DW - 0.25, DW - 0.24, C['tin'], 8)
    a.tube((DW - 0.14, 1.72, -0.05), (DW - 0.14, 1.95, 0.05), 0.006, C['ink'], 4)
    # a hand-painted sign over the door, the crew's own
    a.box(-0.75, 0.75, 2.25, 2.55, -D + 0.01, -D + 0.04, C['board'])
    a.text('BUNK D', 0, 2.42, -D + 0.045, 0.13, C['paper'], face='+z', font='BigShouldersStencilDisplay')
    a.text('wipe your boots', 0, 2.31, -D + 0.045, 0.055, C['paper'], face='+z')
    # washing line across the back, socks for six
    washing_line(a, -1.6, 1.6, D - 1.3, 2.4, [(C['white'], 'sock'), (C['flannel'], 'shirt'), (C['white'], 'sock'), (C['denim'], 'pants'), (C['white'], 'sock'), (C['olive'], 'towel'), (C['white'], 'sock')])
    lantern(a, 1.4, 2.0, 0.3, hang=1.45)      # over the card table
    lantern(a, -1.0, 2.15, -2.6, hang=1.3)    # over the aisle by the door
    # pinned up by the table: the Employee of the Day clipping (Jim Bob's idea of a joke), a hand of cards
    notice(a, DW - 0.02, 1.55, 1.6, 0.36, 0.44, ['EMPLOYEE', 'OF THE DAY', '(not us)'], face='-x', big=0.05, small=0.045, pm=C['paper2'])
    a.box(DW - 0.025, DW - 0.015, 1.25, 1.42, 2.1, 2.22, C['white']); a.box(DW - 0.03, DW - 0.02, 1.27, 1.4, 2.13, 2.19, C['red'])
    a.export()

# ======================================================================================================================
# the Superintendent's house: plaster and dark panelling, a rug, her desk (the game's SuptDesk model), the fireplace,
# a locked cabinet of ledgers, a framed map of the lake, an armchair by the fire, a ceiling fan, the air conditioner.
SW, SD, SH = 4.0, 3.0, 3.0

def supt_room():
    W, D, H = SW, SD, SH
    a = Asset('SuptRoom2')
    plaster = mat('plaster', 0x9bab88, 0.95); wain = mat('wainscot', 0x5a3a24, 0.7); trim = mat('trim_dark', 0x3a2618, 0.7)
    hard = mat('hardwood', 0x6e4a2e, 0.6); hard2 = mat('hardwood2', 0x5e3f28, 0.6); rug = mat('rug_red', 0x8a2e24, 0.95); rugb = mat('rug_gold', 0xc9a05a, 0.95)
    ceil = mat('ceiling', 0xe6dcc4, 0.95); stone = mat('stone', 0x7d6e5e, 0.95); soot = mat('soot', 0x1e1916, 1.0); velvet = mat('velvet', 0x5a2a2e, 0.9)
    green = mat('bankers_green', 0x2f5a3a, 0.4)
    # floor: narrow polished boards
    a.box(-W, W, -0.06, 0, -D, D, C['gap']); x = -W; k = 0
    while x < W - 0.01: a.box(x + 0.008, x + 0.2 - 0.008, -0.05, 0.004, -D, D, hard if k % 3 else hard2); x += 0.2; k += 1
    # walls: plaster over a panelled dado, picture rail, crown; the door in the middle of the front (-z) wall
    def dado(x0, x1, z0, z1, d=0.05):
        """panelling to 1 m, a chair rail, skirting, a picture rail and crown, on the inner strip x0..x1, z0..z1"""
        a.box(x0, x1, 0, 1.0, z0, z1, wain)
        gx = (x1 - x0) > (z1 - z0)
        for y, h in ((1.0, 0.07), (0.0, 0.16), (2.25, 0.04), (H - 0.12, 0.12)):
            if gx: a.box(x0, x1, y, y + h, z0 - (0.03 if z0 > 0 else 0), z1 + (0.03 if z1 < 0 else 0), trim)
            else: a.box(x0 - (0.03 if x0 > 0 else 0), x1 + (0.03 if x1 < 0 else 0), y, y + h, z0, z1, trim)
    a.box(-W - 0.1, W + 0.1, 0, H, D, D + 0.1, plaster); dado(-W, W, D - 0.05, D)
    a.box(-W - 0.1, -W, 0, H, -D, D, plaster); dado(-W, -W + 0.05, -D, D)
    a.box(W, W + 0.1, 0, H, -D, D, plaster); dado(W - 0.05, W, -D, D)
    dw = 0.6
    for s in (-1, 1):
        x0, x1 = sorted((s * dw, s * (W + 0.1)))
        a.box(x0, x1, 0, H, -D - 0.1, -D, plaster)
        a.box(x0, x1, 0, 1.0, -D, -D + 0.05, wain)
        for y, h in ((1.0, 0.07), (0.0, 0.16), (2.25, 0.04), (H - 0.12, 0.12)): a.box(x0, x1, y, y + h, -D, -D + 0.08, trim)
    a.box(-dw, dw, 2.2, H, -D - 0.1, -D, plaster)
    a.box(-dw, dw, 0, 2.2, -D - 0.06, -D - 0.02, mat('door_oak', 0x5a3b24, 0.7))
    for y in (0.35, 1.25): a.box(-dw + 0.1, dw - 0.1, y, y + 0.7, -D - 0.02, -D - 0.005, trim)
    a.box(-dw - 0.1, dw + 0.1, 2.2, 2.32, -D - 0.02, -D + 0.04, trim)
    for s in (-1, 1): a.box(s * dw - 0.06, s * dw + 0.06, 0, 2.2, -D - 0.02, -D + 0.04, trim)
    a.cyl('z', dw - 0.15, 1.05, 0.04, -D - 0.005, -D + 0.04, C['brass'], 8)
    a.box(-W, W, H, H + 0.08, -D, D, ceil)
    for z in (-1.9, 0.0, 1.9): a.box(-W, W, H - 0.16, H, z - 0.09, z + 0.09, trim)
    # windows: two in the front wall (the yard view, matching the house's front windows), one in each side wall
    def win(x, z, face, w=0.95, y0=1.05, y1=2.05, blinds=True):
        if face in ('+z',):
            a.box(x - w / 2, x + w / 2, y0, y1, z - 0.02, z, C['day'])
            for xx in (x - w / 2, x + w / 2): a.box(xx - 0.05, xx + 0.05, y0 - 0.05, y1 + 0.05, z, z + 0.07, trim)
            for yy in (y0, y1): a.box(x - w / 2, x + w / 2, yy - 0.05, yy + 0.05, z, z + 0.07 if yy == y1 else 0.14 + z, trim)
            a.box(x - 0.02, x + 0.02, y0, y1, z, z + 0.03, trim); a.box(x - w / 2, x + w / 2, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, z, z + 0.03, trim)
            if blinds:
                for k in range(5): a.boxc(x, y1 - 0.06 - k * 0.05, z + 0.06, w - 0.04, 0.035, 0.004, mat('blind', 0xe8dfc8, 0.8), rx=0.5)
            for s in (-1, 1): a.box(x + s * (w / 2 + 0.05), x + s * (w / 2 + 0.3), y0 - 0.1, y1 + 0.15, z + 0.03, z + 0.06, velvet)   # curtains
        else:
            s = 1 if face == '-x' else -1      # +1: east wall (faces -x)
            xw = s * W
            a.box(min(xw, xw + s * 0.02), max(xw, xw + s * 0.02), y0, y1, z - w / 2, z + w / 2, C['day'])
            for zz in (z - w / 2, z + w / 2): a.box(min(xw, xw - s * 0.07), max(xw, xw - s * 0.07), y0 - 0.05, y1 + 0.05, zz - 0.05, zz + 0.05, trim)
            for yy in (y0, y1): a.box(min(xw, xw - s * 0.07), max(xw, xw - s * 0.07), yy - 0.05, yy + 0.05, z - w / 2, z + w / 2, trim)
            for zz in (z - w / 2 - 0.3, z + w / 2 + 0.05): a.box(min(xw - s * 0.03, xw - s * 0.06), max(xw - s * 0.03, xw - s * 0.06), y0 - 0.1, y1 + 0.15, zz, zz + 0.25, velvet)
    for x in (-2.4, 2.4): win(x, -D, '+z')
    win(-W, 0.4, '+x'); win(W, 0.4, '-x', blinds=False)
    # the air conditioner in the east window (she keeps it cold)
    a.box(W - 0.45, W, 1.05, 1.55, 0.1, 0.7, mat('ac', 0xd8d2c2, 0.7))
    for k in range(6): a.box(W - 0.47, W - 0.45, 1.12 + k * 0.06, 1.15 + k * 0.06, 0.15, 0.65, trim)
    # the rug and the desk area (the desk itself is the game's SuptDesk at (1.8, 1.0))
    a.box(-0.3, 3.7, 0.004, 0.012, -1.0, 2.6, rug); a.box(-0.15, 3.55, 0.012, 0.016, -0.85, 2.45, rugb); a.box(0.0, 3.4, 0.016, 0.02, -0.7, 2.3, rug)
    # on the desk (top at 0.845): the ledger open, a banker's lamp, a desk fan, an ink stand
    led = mat('ledger', 0x2a3a2a, 0.8)
    a.boxc(1.0, 0.86, 0.85, 0.62, 0.025, 0.44, led, ry=0.1); a.boxc(1.0, 0.875, 0.85, 0.58, 0.008, 0.4, C['paper'], ry=0.1)
    a.boxc(1.0, 0.88, 0.85, 0.01, 0.006, 0.4, C['ink'], ry=0.1)
    for k in range(6): a.boxc(0.82, 0.88, 0.7 + k * 0.06, 0.2, 0.002, 0.008, C['red'] if k == 5 else C['ink'], ry=0.1)
    a.cyl('y', 2.7, 1.25, 0.09, 0.845, 0.87, C['brass'], 8); a.tube((2.7, 0.87, 1.25), (2.7, 1.15, 1.25), 0.012, C['brass'], 6)
    a.cyl('x', 1.2, 1.2, 0.08, 2.5, 2.9, green, 10); a.cyl('x', 1.25 - 0.05, 1.17, 0.055, 2.55, 2.85, C['lamp'], 8)   # the green shade, lit underneath
    a.cyl('y', 3.05, 0.55, 0.1, 0.845, 0.87, C['iron'], 8); a.tube((3.05, 0.87, 0.55), (3.05, 1.1, 0.55), 0.015, C['iron'], 6)
    a.cyl('z', 3.05, 1.2, 0.16, 0.5, 0.56, C['tin'], 12)
    for k in range(3):
        ang = k * 2.094; a.boxc(3.05 + 0.1 * math.cos(ang), 1.2 + 0.1 * math.sin(ang), 0.48, 0.07, 0.17, 0.008, C['brass'], rz=ang)
    a.box(2.1, 2.3, 0.845, 0.88, 0.25, 0.4, C['brass']); a.cyl('y', 2.15, 0.33, 0.03, 0.88, 0.95, C['ink'], 6); a.tube((2.25, 0.9, 0.33), (2.32, 1.08, 0.36), 0.006, mat('quill', 0xe8e0cc, 0.8), 4)
    # the fireplace on the back wall, west half; a log fire
    fx = -2.3
    a.box(fx - 0.95, fx + 0.95, 0, 0.1, D - 0.85, D, stone)
    rnd = random.Random(3)
    for r in range(7):
        for c in range(4):
            w = rnd.uniform(0.38, 0.5); x0 = fx - 0.95 + c * 0.475 + (0.12 if r % 2 else 0)
            if x0 + w > fx + 0.95: w = fx + 0.95 - x0
            if w > 0.05: a.box(x0, x0 + w - 0.02, 0.1 + r * 0.3, 0.38 + r * 0.3, D - 0.4, D, mat('stone_%d' % (r % 3), [0x7d6e5e, 0x8a7a68, 0x6e604f][r % 3], 0.95))
    a.box(fx - 0.5, fx + 0.5, 0.1, 0.85, D - 0.42, D - 0.39, soot)
    a.box(fx - 1.05, fx + 1.05, 1.25, 1.36, D - 0.55, D - 0.3, trim)
    for k in range(3): a.cyl('x', D - 0.6 + k * 0.08, 0.2 + k * 0.03, 0.06, fx - 0.3, fx + 0.3, mat('log', 0x4a3322, 0.9), 6)
    a.box(fx - 0.28, fx + 0.28, 0.12, 0.38, D - 0.62, D - 0.58, C['stove'])
    a.cyl('z', fx + 0.6, 1.5, 0.12, D - 0.5, D - 0.42, C['brass'], 12); a.cyl('z', fx + 0.6, 1.5, 0.1, D - 0.51, D - 0.5, C['paper'], 12)   # mantel clock
    a.box(fx - 0.7, fx - 0.5, 1.36, 1.62, D - 0.45, D - 0.35, C['lamp'])                                                           # a candle lamp
    for k in range(2): bottle(a, fx + 0.1 + k * 0.15, 1.36, D - 0.42, C['amber'])
    # the framed map of the lake on the back wall, east of the fire: Lake Drywater, the grid, red pins where she's looking
    mx = 0.2
    a.box(mx - 0.85, mx + 0.85, 1.25, 2.3, D - 0.06, D, trim); a.box(mx - 0.78, mx + 0.78, 1.32, 2.23, D - 0.07, D - 0.06, C['paper2'])
    a.box(mx - 0.6, mx + 0.62, 1.42, 2.02, D - 0.075, D - 0.07, mat('lakebed', 0xc9a26a, 0.95))
    a.cyl('z', mx + 0.1, 1.72, 0.38, D - 0.08, D - 0.075, C['water'], 14, rv=0.24)
    for k in range(7): a.box(mx - 0.6 + k * 0.2, mx - 0.6 + k * 0.2 + 0.006, 1.42, 2.02, D - 0.085, D - 0.08, C['ink'])
    for k in range(4): a.box(mx - 0.6, mx + 0.62, 1.42 + k * 0.2, 1.42 + k * 0.2 + 0.006, D - 0.085, D - 0.08, C['ink'])
    for k in range(6): a.cyl('z', mx - 0.45 + rnd.uniform(0, 0.95), 1.5 + rnd.uniform(0, 0.45), 0.018, D - 0.11, D - 0.08, C['red'], 6)
    a.text('LAKE DRYWATER', mx, 2.13, D - 0.08, 0.07, C['ink'], face='-z')
    # the locked cabinet on the west wall: glass doors, the ledgers behind, a padlock and chain
    cx, cz = -W + 0.24, 0.3
    a.box(cx - 0.22, cx + 0.22, 0, 2.05, cz - 0.7, cz + 0.7, wain)
    a.box(cx + 0.22, cx + 0.23, 0.95, 1.95, cz - 0.62, cz + 0.62, mat('cabinet_glass', 0x8fa8a8, 0.2))
    for k in range(3):
        y = 1.0 + k * 0.32; a.box(cx - 0.2, cx + 0.2, y - 0.02, y, cz - 0.65, cz + 0.65, trim)
        z = cz - 0.6
        while z < cz + 0.55:
            w = rnd.uniform(0.05, 0.09); a.box(cx - 0.15, cx + 0.12, y, y + rnd.uniform(0.22, 0.28), z, z + w, [led, mat('ledger2', 0x5a2a22, 0.8), mat('ledger3', 0x2a3555, 0.8)][rnd.randint(0, 2)]); z += w + 0.01
    a.box(cx + 0.22, cx + 0.24, 0.1, 0.85, cz - 0.62, cz + 0.62, trim)
    a.box(cx + 0.24, cx + 0.3, 1.38, 1.52, cz - 0.04, cz + 0.04, C['brass']); a.tube((cx + 0.27, 1.52, cz - 0.03), (cx + 0.27, 1.6, cz + 0.03), 0.01, C['steel'], 4)
    for k in range(5): a.boxc(cx + 0.26, 1.45 + (k - 2) * 0.05, cz + (k - 2) * 0.06, 0.02, 0.05, 0.03, C['steel'], rx=0.5)
    a.text('PRIVATE', cx + 0.24, 1.98, cz, 0.05, C['brass'], face='+x')
    # armchair, side table and standing lamp by the fire (south-west); her hat on the coat rack by the door
    ax_, az = -2.9, -1.55
    a.box(ax_ - 0.45, ax_ + 0.45, 0.12, 0.45, az - 0.42, az + 0.42, velvet); a.box(ax_ - 0.45, ax_ + 0.45, 0.3, 1.05, az - 0.42, az - 0.22, velvet)
    for s in (-1, 1): a.box(ax_ + s * 0.45 - 0.1, ax_ + s * 0.45 + 0.1, 0.12, 0.68, az - 0.42, az + 0.42, velvet)
    for dx in (-0.38, 0.38):
        for dz in (-0.35, 0.35): a.box(ax_ + dx - 0.03, ax_ + dx + 0.03, 0, 0.12, az + dz - 0.03, az + dz + 0.03, trim)
    a.cyl('y', -3.55, -0.6, 0.22, 0.6, 0.64, trim, 10); a.cyl('y', -3.55, -0.6, 0.03, 0, 0.6, trim, 6)
    a.cyl('y', -3.6, -0.55, 0.035, 0.64, 0.75, mat('glass_cut', 0xc8d8d0, 0.2), 8); a.cyl('y', -3.48, -0.65, 0.05, 0.64, 0.86, C['amber'], 8)
    a.cyl('y', -3.55, -2.45, 0.14, 0, 0.03, C['brass'], 8); a.tube((-3.55, 0.03, -2.45), (-3.55, 1.5, -2.45), 0.015, C['brass'], 6)
    a.cone(-3.55, -2.45, 0.24, 0.13, 1.42, 1.72, mat('shade_silk', 0xe8c890, 0.8), 10); a.cyl('y', -3.55, -2.45, 0.05, 1.44, 1.55, C['lamp'], 6)
    rx_, rz_ = -1.2, -2.6
    a.tube((rx_, 0.03, rz_), (rx_, 1.85, rz_), 0.025, trim, 6)
    for k in range(3): a.tube((rx_, 0.25, rz_), (rx_ + 0.28 * math.cos(k * 2.09), 0.02, rz_ + 0.28 * math.sin(k * 2.09)), 0.018, trim, 4)
    a.cyl('y', rx_ + 0.12, rz_, 0.17, 1.72, 1.86, mat('hatfelt', 0x2c2c2c, 0.9), 10); a.cyl('y', rx_ + 0.12, rz_, 0.27, 1.71, 1.73, mat('hatfelt', 0x2c2c2c, 0.9), 12)
    a.cyl('y', rx_ + 0.12, rz_, 0.175, 1.73, 1.77, mat('hatband', 0x8a3a1c, 0.8), 10)
    # filing cabinets (north-east corner) and the water cooler (east wall, by the front)
    for k in range(2):
        fz = 2.1 + k * 0.5; a.box(W - 0.6, W, 0, 1.3, fz - 0.24, fz + 0.24, mat('filing', 0x6b7066, 0.6))
        for j in range(4): a.box(W - 0.62, W - 0.6, 0.12 + j * 0.3, 0.38 + j * 0.3, fz - 0.2, fz + 0.2, mat('filing_d', 0x5d6258, 0.6)); a.box(W - 0.64, W - 0.62, 0.3 + j * 0.3, 0.33 + j * 0.3, fz - 0.06, fz + 0.06, C['brass'])
    a.box(W - 0.5, W - 0.1, 0, 0.95, -2.0, -1.6, mat('ac', 0xd8d2c2, 0.7)); a.cyl('y', W - 0.3, -1.8, 0.16, 0.95, 1.4, C['water'], 12)
    for k in range(3): a.cyl('y', W - 0.2 - k * 0.0, -1.45 + k * 0.0, 0.03, 0.95 + k * 0.05, 1.02 + k * 0.05, C['white'], 6)
    # pictures: the Company certificate, a portrait of a man in a hat (the founder? nobody asks), a clock
    a.box(-1.0, -0.2, 1.5, 2.1, D - 0.03, D, trim); a.box(-0.95, -0.25, 1.55, 2.05, D - 0.035, D - 0.03, C['paper'])
    a.text('DRC', -0.6, 1.92, D - 0.04, 0.09, C['brass'], face='-z', depth=0.001, font='BigShouldersStencilDisplay')
    a.text('25 YEARS', -0.6, 1.72, D - 0.04, 0.06, C['ink'], face='-z')
    a.box(W - 0.03, W, 1.35, 2.15, -0.9, -0.3, trim); a.box(W - 0.035, W - 0.03, 1.42, 2.08, -0.84, -0.36, mat('portrait', 0x6a5544, 0.9))
    a.cyl('x', -0.6, 1.8, 0.1, W - 0.04, W - 0.035, mat('portrait_face', 0xd6a077, 0.9), 8)
    a.cyl('z', -2.9, 2.55, 0.17, -D, -D + 0.05, trim, 12); a.cyl('z', -2.9, 2.55, 0.14, -D + 0.05, -D + 0.055, C['paper'], 12)
    a.box(-2.91, -2.89, 2.5, 2.62, -D + 0.055, -D + 0.06, C['ink']); a.box(-2.9, -2.82, 2.54, 2.56, -D + 0.055, -D + 0.06, C['ink'])
    # a potted cactus (the only plant in camp anyone waters) and the ceiling fan over the desk
    a.cone(-3.6, 2.6, 0.17, 0.2, 0, 0.32, mat('terracotta', 0xb0603c, 0.9), 10); a.cyl('y', -3.6, 2.6, 0.08, 0.32, 0.95, C['cactus'], 8)
    a.cyl('y', -3.48, 2.6, 0.045, 0.55, 0.8, C['cactus'], 6)
    fxx, fzz = 1.8, 0.9
    a.tube((fxx, H, fzz), (fxx, H - 0.45, fzz), 0.02, C['brass'], 6); a.cyl('y', fxx, fzz, 0.13, H - 0.6, H - 0.45, C['brass'], 10)
    for k in range(4): a.boxc(fxx + 0.48 * math.cos(k * 1.571 + 0.4), H - 0.55, fzz + 0.48 * math.sin(k * 1.571 + 0.4), 0.75, 0.015, 0.16, mat('fanblade', 0x5a3b24, 0.7), ry=-(k * 1.571 + 0.4))
    a.cyl('y', fxx, fzz, 0.09, H - 0.7, H - 0.6, C['lamp'], 8)
    a.export()

if __name__ == '__main__':
    wipe(); C = palette()
    for name, fn in (('BunkRoomA', lambda: bunk_small('A')), ('BunkRoomB', lambda: bunk_small('B')), ('BunkRoomC', lambda: bunk_small('C')),
                     ('BunkRoomD', bunk_d), ('SuptRoom2', supt_room)):
        if ONLY and name not in ONLY: continue
        fn()
