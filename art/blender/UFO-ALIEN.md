# UFO and alien head — asset report

Completed 2026-10-02 on `feature/sol-ufo`, in this checkout.

`UFO.glb` is a 1950s saucer with a brushed aluminium disc, machined concentric seams,
transparent cyan glass dome, green pilot, console, and 24 alternating emerald/lime/leaf-green
rim lights and a green underside tractor emitter. Its diameter including lamps is
6.118 m; its height is 1.800 m. The disc lies in game XZ, and its identity origin is the
centre of the underside emitter at game Y=0. There is no geometry below that plane.
The export contains 35,660 triangles and ten material primitives.

`AlienHead.glb` has a bulbous saturated green cranium, raised sockets around glossy black
almond eyes, tiny nostrils, a slit mouth and a thin upper neck. It contains 6,172
triangles and five material primitives. Both GLBs are self-contained, texture-free
rigid meshes; the authoring and public copies are byte-identical.

JT's green revision matches the head and pilot skin to the game's `#5fd04a` body
tint, with cranium roughness 0.4 for a shinier surface. Eye sockets are darker green;
the glossy black almond eyes are unchanged. The UFO's four emissive materials are
all green. Both assets were rebuilt in Blender, re-exported, re-rendered and
re-checked in game. Exported triangle coordinates are identical to the prior
version, preserving geometry, fit and origins.

| Asset | Export and game copy (bytes each) | Game-space dimensions |
| --- | ---: | --- |
| UFO.glb | 943,368 | 6.118 × 1.800 × 6.118 m (X/Y/Z) |
| AlienHead.glb | 147,188 | 0.796 × 1.085 × 0.698 m (X/Y/Z) |

The alien attaches to the existing camper `head` bone with local position `(0,0,0)`,
identity rotation and scale `(1,1,1)`, exactly like the Wardrobe hats and faces.
Blender -Y exports to game +Z: the eyes face forward. The replacement spans local
game Y=-0.105..0.980 m. Its lower sleeve covers the real camper's retained neck
(local Y=-0.100..0.060 m), ending inside the jumpsuit at the shoulders; above the
sleeve it narrows to a 0.188 m diameter neck before the jaw. The sleeve clears the
neck vertices with the average, slim, stocky, tall and short body width/depth factors.
Front, true side and full-body views were inspected using the existing face lab and
the actual `public/models/camper.glb`. There is no neck gap or original-face leakage.
Idle, Walk and Dig retain the attachment and finite transforms.

Hide the camper's original Head, Nose, Eye, Brow, Mouth, Teeth, Hair, Bucket, Cowboy,
DesertCap and Shades meshes, plus any attached Wardrobe head cosmetics. Retain the
neck, body, rig and animations. Attach at scale one in **model metres**; the camper's
existing outer model scale (normally 0.68) applies to the alien too. Load the head
through the Wardrobe material path to retain its glossy eyes. Load the saucer through
the prop path; the current `gameMat` adapter preserves all four emissive materials.
The game screenshots are locally staged asset reviews on the real D Tent camper
Randy. Runtime abduction/next-day replacement/dialogue integration remains for the
game feature; this delivery follows the brief's asset scope and restriction on runtime JS.

The UFO's emissive material names are:

- `cgl_ufo_rim_emerald_green`
- `cgl_ufo_rim_lime_green`
- `cgl_ufo_rim_leaf_green`
- `cgl_ufo_tractor_emitter`

These use core glTF `emissiveFactor` at strength one, compatible with the game's
Three.js r128 loader. The dome uses alpha BLEND at 0.26 opacity. In-game validation
confirmed nonzero emission after the game's material conversion for all four names.

Rebuild both assets and the four Blender stills from the checkout root:

```bash
mkdir -p .ufo-tmp
env -u DISPLAY TMPDIR="$PWD/.ufo-tmp" blender -b --factory-startup \
  --gpu-backend vulkan --threads 4 --python-exit-code 1 \
  --python art/blender/ufo_alien.py
```

Capture the camper fit views and staged in-game screenshots:

```bash
node /home/botuser/personal-assistant/scripts/gpu-preflight.mjs
TMPDIR="$PWD/.ufo-tmp" node scripts/preview-ufo-alien.mjs
```

The capture script starts its own local server, uses scratch data inside this
checkout, and closes the server and browser when finished. It uses ANGLE Vulkan
with the required Vulkan feature flags and asserts AMD RADV hardware rendering.
`UFO-AlienHead-validation.json` contains attachment, neck coverage, animation and
in-game emissive checks. GPU preflight and both viewers reported the Radeon 760M
via RADV. Background Blender used its Vulkan backend for all still renders.

`npm test` passed, including the browser smoke suite. `bash scripts/check-globals.sh`
passed: no duplicate declarations across 74 scripts. No `public/js/*.js` changes.

[Game overview](renders/UFO-AlienHead-game.png) ·
[Alien in game](renders/AlienHead-game.png) ·
[UFO at 60 m](renders/UFO-game-60m.png) ·
[Front fit](renders/AlienHead-fit-front.png) ·
[Side fit](renders/AlienHead-fit-side.png) ·
[Full-body fit](renders/AlienHead-fit-body.png) ·
[UFO render](renders/UFO.png) ·
[Emitter underside](renders/UFO-underside.png) ·
[Alien render](renders/AlienHead.png) ·
[Alien side render](renders/AlienHead-side.png).

Delivered file sizes (the report itself is excluded from the table):

| File | Bytes |
| --- | ---: |
| `art/blender/ufo_alien.py` | 9,838 |
| `art/blender/ufo-alien.blend` | 338,431 |
| `scripts/preview-ufo-alien.mjs` | 9,667 |
| `art/blender/glb/UFO.glb` | 943,368 |
| `art/blender/glb/AlienHead.glb` | 147,188 |
| `public/models/UFO.glb` | 943,368 |
| `public/models/AlienHead.glb` | 147,188 |
| `art/blender/renders/AlienHead-asset.json` | 528 |
| `art/blender/renders/AlienHead-fit-body.png` | 33,213 |
| `art/blender/renders/AlienHead-fit-front.png` | 60,668 |
| `art/blender/renders/AlienHead-fit-side.png` | 51,518 |
| `art/blender/renders/AlienHead-game.png` | 404,721 |
| `art/blender/renders/AlienHead-side.png` | 1,009,973 |
| `art/blender/renders/AlienHead.png` | 1,010,598 |
| `art/blender/renders/UFO-AlienHead-game.png` | 515,030 |
| `art/blender/renders/UFO-AlienHead-validation.json` | 3,097 |
| `art/blender/renders/UFO-asset.json` | 461 |
| `art/blender/renders/UFO-game-60m.png` | 494,385 |
| `art/blender/renders/UFO-underside.png` | 1,415,721 |
| `art/blender/renders/UFO.png` | 1,452,368 |
