# Camp Green Lake Blender art

The 3D assets live in separate `.blend` files, grouped so an edit only touches (and commits) its own group. **One scene
per asset.** In each scene the `<Name>.Asset` collection is the model and `<Name>.Studio` is the preview camera,
lights and floor.

| File | Scenes | Build scripts |
| --- | --- | --- |
| `buildings.blend` | tents, tent rooms, Warden's house and office, Wreck Room (Supply Depot), watchtower, water tower, fence, gates, yard (flag pole, hammock, lamp post, mess table, oak, outhouse, shower block, water truck) | `buildings.py`, `interiors.py`, `fence.py`, `gates.py`, `yard.py`, `wreckroom.py` |
| `props.blend` | signs, furniture, supplies, carried loot, Mr. Sir's truck, rocks, boulders, tumbleweed | `signs.py`, `signs_export.py`, `furniture.py`, `supplies.py`, `carryloot.py`, `rocks.py` |
| `finds.blend` | the dig-up finds, including the five-way variant scenes (`Can_1`..`Can_5`, `KB_v01`..`KB_v10`, ...) the final finds were picked from | `finds.py`, `finds2.py`, `finds3.py`, `heavy.py`, `kb.py`, `kbfinal.py` |
| `creatures.blend` | lizard, javelina, mountain lion, vulture (rigged, with clips), plus their first-round variants (`Liz_1`..) | `creatures.py`, `beasts.py`, `rig.py`, `vulture.py` |
| `town.blend` | the buried town: `TownStreet` (Main Street), `TownBldg_<key>` for 17 buildings at their real sizes with a doorway on every side, `TownDoorPlug`, `TownMouthPlug`, `TownShoring` and `TownJunkA/B/C` for the tunnels (whose cave walls the game digs along each path); colliders go to `glb/TownColliders.json` -> `public/data/` | `town.py` |
| `characters.blend` | `Camper`: the player/crew/staff camper (from JT's PC, rigged by `/blender/cgl_rig.py`, exported to `public/models/camper.glb`); `ARCHIVED_Camper_minipc`: the superseded minipc camper | `/blender/cgl_rig.py` |
| `hats.blend` | Twenty original hat candidates, one scene per hat with the authored camper head as a fit reference; hat-only exports to `public/models/hats/` | `hat_options.py` |
| `faces.blend` | Twenty cosmetic face sets on the same authored head and nose; reference head/nose excluded from face-only exports in `public/models/faces/` | `face_options.py` |

| `glasses.blend` | Twenty eyewear pairs, with fit references excluded from eyewear-only exports in `public/models/glasses/` | `glasses_options.py` |

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
| `camper_export.py` | Rebuilds the camper from `characters.blend` (rig, wardrobe, every clip in `/blender/cgl_rig.py`, now including Sit and SitEdge) and writes `public/models/camper.glb` |
| `beasts.py` + `rig.py` | Lizard, Javelina, Lion: modelled, then rigged, animated and exported to `glb/Creature*.glb` |
| `wardennote.py` | WardenNote: the note on the Warden's desk with the old town's X/Y (the town's only way in) |
| `north.py` | NorthRamp, NorthCliff5, NorthCliff2, SignTrench, SignBigThumb: the end of Act 1 at the lake's north edge (the jump ramp, rock faces for the trench and the wall's ledges, the signs); the shapes are in the ground (`public/js/10-core.js` NORTH) |
| `carryloot.py` | LootCrate, LootTools, LootJug: carried finds (the middle loot tier, too big for the sack), grabbed and hauled like the safe |
| `supplies.py` | SupplyWalkie, SupplyTonic, SupplyMedkit: the Wreck Room supplies, matched to their painted store icons, stood on their base with the grip height recorded for the game's hand props (`public/js/86-walkie.js`) |
| `vulture.py` | Vulture, standalone: model with rigged legs and talons, Glide/Flap/Reach/Carry clips, a `gripR` bone the game hangs a carried camper from; run it with the checkout's .blend open, then copy the GLB to `public/models/` |

Sizes match the game's current layout (bunk 1.3 x 2.35 with mattress tops at 0.56/1.72, fence posts
3.5 m every 2.5 m, tower lamp at 8.55 m, etc.). Origins sit on the ground at the footprint centre;
fronts face Blender -Y (= +Z in the game after glTF's Y-up conversion).

`glb/` has the exports, `renders/` the previews. Fonts: Anton and Big Shoulders
Stencil Display (SIL OFL, Google Fonts) in `../fonts/`.

The build scripts share helpers by exec-ing each other's top halves (`beasts.py` <- `creatures.py` <- `finds2.py` <- `finds.py` <- `cgl_blender.py`). Older scripts point those at `/tmp` copies; `vulture.py` loads them from this folder instead.
