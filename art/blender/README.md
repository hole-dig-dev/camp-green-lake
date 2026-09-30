# Camp Green Lake Blender art

The 3D assets live in six `.blend` files, grouped so an edit only touches (and commits) its own group. **One scene
per asset.** In each scene the `<Name>.Asset` collection is the model and `<Name>.Studio` is the preview camera,
lights and floor.

| File | Scenes | Build scripts |
| --- | --- | --- |
| `buildings.blend` | tents, tent rooms, Warden's house and office, Wreck Room (Supply Depot), watchtower, water tower, fence, gates, yard (flag pole, hammock, lamp post, mess table, oak, outhouse, shower block, water truck) | `buildings.py`, `interiors.py`, `fence.py`, `gates.py`, `yard.py`, `wreckroom.py` |
| `props.blend` | signs, furniture, supplies, carried loot, Mr. Sir's truck, rocks, boulders, tumbleweed | `signs.py`, `signs_export.py`, `furniture.py`, `supplies.py`, `carryloot.py`, `rocks.py` |
| `finds.blend` | the dig-up finds, including the five-way variant scenes (`Can_1`..`Can_5`, `KB_v01`..`KB_v10`, ...) the final finds were picked from | `finds.py`, `finds2.py`, `finds3.py`, `heavy.py`, `kb.py`, `kbfinal.py` |
| `creatures.blend` | lizard, javelina, mountain lion, vulture (rigged, with clips), plus their first-round variants (`Liz_1`..) | `creatures.py`, `beasts.py`, `rig.py`, `vulture.py` |
| `town.blend` | the buried town's ruins: wall, floor and ceiling kit sized to the game's grid, plus the furnishings of each room type (`TownRoom_*`); colliders go to `glb/TownColliders.json` -> `public/data/`. `town_preview.py` renders a lit 2 x 2 block for review | `town.py`, `town_preview.py` |
| `characters.blend` | `Camper`: the player/crew/staff camper (from JT's PC, rigged by `/blender/cgl_rig.py`, exported to `public/models/camper.glb`); `ARCHIVED_Camper_minipc`: the superseded minipc camper | `/blender/cgl_rig.py` |

Each build script's first line names its file (`# blend: buildings.blend`) and `bx.py` opens that file before running
it. The files are saved **compressed** (Blender keeps compression on every later save): the old single
`camp-green-lake-art.blend` was 53 MB uncompressed and grew the repo by that much on every commit; the files together are
about 6 MB. Split on 2026-09-30; every scene's meshes were checked against the old file.

Built live in Blender through the blender-mcp socket (`bx.py` runs a Python file inside the running
Blender). `cgl_blender.py` is the shared toolkit (palette, materials, bevelled boxes/cylinders, 3D
text, studio, auto-framing, preview render, and a GLB export that bakes each asset into one mesh).
The build scripts recreate their scenes from scratch:

| Script | Scenes |
| --- | --- |
| `fence.py` | FencePost, FenceSpan (2.5 m, chain-link texture, barbed-wire arm) |
| `signs.py` (+ `signs_export.py`) | SignCampEntrance, SignWreckRoom (reads SUPPLY DEPOT), SignLizardWarning, SignDirections |
| `furniture.py` | BunkBed, Cot, Footlocker, CardTable, Stool, WardenDesk, SupplyCrate, WaterDrum, Bench |
| `buildings.py` | TentSmall, TentCrew, WreckRoom (the Supply Depot: serving window + booth, `shop_front`), WardenHouse, Watchtower, WaterTower |
| `wreckroom.py` | Rebuilds only WreckRoom from `buildings.py` and exports `glb/WreckRoom.glb` |
| `beasts.py` + `rig.py` | Lizard, Javelina, Lion: modelled, then rigged, animated and exported to `glb/Creature*.glb` |
| `carryloot.py` | LootCrate, LootTools, LootJug: carried finds (the middle loot tier, too big for the sack), grabbed and hauled like the safe |
| `supplies.py` | SupplyWalkie, SupplyTonic, SupplyMedkit: the Wreck Room supplies, matched to their painted store icons, stood on their base with the grip height recorded for the game's hand props (`public/js/86-walkie.js`) |
| `vulture.py` | Vulture, standalone: model with rigged legs and talons, Glide/Flap/Reach/Carry clips, a `gripR` bone the game hangs a carried camper from; run it with the checkout's .blend open, then copy the GLB to `public/models/` |

Sizes match the game's current layout (bunk 1.3 x 2.35 with mattress tops at 0.56/1.72, fence posts
3.5 m every 2.5 m, tower lamp at 8.55 m, etc.). Origins sit on the ground at the footprint centre;
fronts face Blender -Y (= +Z in the game after glTF's Y-up conversion).

`glb/` has the exports, `renders/` the previews. Fonts: Anton and Big Shoulders
Stencil Display (SIL OFL, Google Fonts) in `../fonts/`.

The build scripts share helpers by exec-ing each other's top halves (`beasts.py` <- `creatures.py` <- `finds2.py` <- `finds.py` <- `cgl_blender.py`). Older scripts point those at `/tmp` copies; `vulture.py` loads them from this folder instead.
