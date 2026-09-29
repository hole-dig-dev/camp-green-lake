# Camp Green Lake Blender art

`camp-green-lake-art.blend` holds every 3D asset, **one scene per asset** (plus `ARCHIVED_Camper_minipc`, the archived minipc camper scene
from the character work). In each scene the `<Name>.Asset` collection is the model and
`<Name>.Studio` is the preview camera, lights and floor.

Built live in Blender through the blender-mcp socket (`bx.py` runs a Python file inside the running
Blender). `cgl_blender.py` is the shared toolkit (palette, materials, bevelled boxes/cylinders, 3D
text, studio, auto-framing, preview render, and a GLB export that bakes each asset into one mesh).
The build scripts recreate their scenes from scratch:

| Script | Scenes |
| --- | --- |
| `fence.py` | FencePost, FenceSpan (2.5 m, chain-link texture, barbed-wire arm) |
| `signs.py` | SignCampEntrance, SignWreckRoom, SignLizardWarning, SignDirections |
| `furniture.py` | BunkBed, Cot, Footlocker, CardTable, Stool, WardenDesk, SupplyCrate, WaterDrum, Bench |
| `buildings.py` | TentSmall, TentCrew, WreckRoom, WardenHouse, Watchtower, WaterTower |
| `beasts.py` + `rig.py` | Lizard, Javelina, Lion: modelled, then rigged, animated and exported to `glb/Creature*.glb` |
| `vulture.py` | Vulture, standalone: model with rigged legs and talons, Glide/Flap/Reach/Carry clips, a `gripR` bone the game hangs a carried camper from; run it with the checkout's .blend open, then copy the GLB to `public/models/` |

Sizes match the game's current layout (bunk 1.3 x 2.35 with mattress tops at 0.56/1.72, fence posts
3.5 m every 2.5 m, tower lamp at 8.55 m, etc.). Origins sit on the ground at the footprint centre;
fronts face Blender -Y (= +Z in the game after glTF's Y-up conversion).

`glb/` has the exports (~2 MB for all 21), `renders/` the previews. Fonts: Anton and Big Shoulders
Stencil Display (SIL OFL, Google Fonts) in `../fonts/`.

The build scripts share helpers by exec-ing each other's top halves (`beasts.py` <- `creatures.py` <- `finds2.py` <- `finds.py` <- `cgl_blender.py`). Older scripts point those at `/tmp` copies; `vulture.py` loads them from this folder instead.
