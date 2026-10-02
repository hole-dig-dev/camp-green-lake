# Upgrade assets handoff

Twelve Blender-authored exports for `feature/sol-upgrade-assets`. Public paths below are relative to
`public/models/`; identical authoring exports are in `art/blender/glb/<AssetName>.glb` (including
`GravityBoots.glb`). Dimensions are metres, in game X × Y-height × Z-depth, measured in the bind pose.

| Asset / public file | Bytes | Dimensions | Origin / grip |
| --- | ---: | --- | --- |
| `Dynamite.glb` | 60,500 | .146 × .249 × .146 | Ground centre |
| `DynamiteHeld.glb` | 60,528 | .146 × .249 × .146 | Grip at zero; standing GRIP .100 |
| `LooseSand.glb` | 64,792 | 3.163 × .450 × 3.138 | Ground centre; ~1.6 m radius |
| `Scarecrow.glb` | 157,572 | 1.615 × 2.199 × .540 | Ground at post |
| `Dog.glb` | 476,700 | .325 × .587 × .912 | Ground between feet; length includes tail |
| `DisarmKit.glb` | 26,952 | .321 × .075 × .180 | Grip at zero; standing GRIP .055 |
| `footwear/gravity-boots.glb` | 276,900 | .588 × .365 × .356 | Original camper bind space, both feet |
| `GrappleHook.glb` | 131,388 | .157 × .359 × .386 | Grip at zero; standing GRIP .105 |
| `GrappleHookHead.glb` | 32,716 | .265 × .277 × .246 | Rope-eye centre, shaft points +X |
| `GoldScale.glb` | 68,988 | .716 × 1.053 × .500 | Sifter origin; table centre (1.6, 0, -.7) |
| `PipePump.glb` | 103,928 | .650 × .624 × .538 | Sifter origin; pump at X -2.29 |
| `PipeSectionSteel.glb` | 29,784 | 1.000 × .240 × .240 | Ground origin, x=0 start; axis Y .24 |

All exports are game +Y up. Dog and launcher face game +Z (Blender -Y). For the three held tools,
`GRIP` records the grip height of the standing authoring geometry, following the supplies convention;
the exported vertices already have that height subtracted. Their runtime `HELD_GRIP` is **0**.
Attach the origin at the fist, as in `86-walkie.js`, and use its world-orientation correction.
`Dynamite` and `DynamiteHeld` are identical geometry separated by exactly .100 m in game Y.

Dog has 14 deform bones and six exact, in-place clips:

| Clip | Seconds |
| --- | ---: |
| `Idle` | 2.0 |
| `Walk` | 1.0 |
| `Run` | .5 |
| `Sniff` | 2.0 |
| `Bark` | 1.0 |
| `Sit` | 2.0 |

Load Dog with `THREE.GLTFLoader`, clone with `SkeletonUtils.clone`, and play the clips with an
`AnimationMixer` on each clone. The static `loadModel`/`modelParts` path flattens meshes and discards
rigs/clips. Preserve skinning when adapting materials. `Sit` is a seated idle loop; crossfade into it.
`Sniff` lowers the nose and wags the tail. Clips do not move the dog horizontally; move the root in game.

Gravity boots use the original camper skeleton, mesh extras `slot="footwear"` and `side="L"/"R"`.
Every vertex is weighted 100% to `shin.L` or `shin.R` (Three.js sanitizes these to `shinL`/`shinR`).
Rebind to the camper's own bones, inverse matrices and bind matrix exactly as
[`footwear-lab/viewer.js`](../../public/footwear-lab/viewer.js) does. Hide exactly
`CGLCamper_L_Shoe`, `CGLCamper_R_Shoe`, `CGLCamper_L_Sole`, `CGLCamper_R_Sole`.
There are no new animations/ankles. Keep the GLTF material's emissive colour/strength for the glowing
soles and coils; the generic game's `gameMat` adapter does not preserve emission. Source camper hash
is recorded in `art/blender/glb/GravityBoots.json`.

Place GoldScale and PipePump at the **same translation and rotation as Sifter**, with no additional
offset. Their offsets are in the vertices. Scale table sits away from the catch pan; pump bore runs
X -2.58 to -1.96, outside the -1.9 socket. Steel pipe keeps the original .12 outer radius/.108 bore,
1 m +X span and .24 axis, with alpha-BLEND clear walls and open ends. Stretch X only; .012 m end bands
become .066 m at 5.5×. LooseSand remains readable at .2 Y scale.

Sources and native scenes: `art/blender/upgrades_{props,dog,boots}.py`, shared
`upgrades_common.py`, and `upgrades-{props,dog,boots}.blend`. Rebuild:

```sh
~/blender/blender -b art/blender/props.blend --python-exit-code 1 --python art/blender/upgrades_props.py
~/blender/blender -b --python-exit-code 1 --python art/blender/upgrades_dog.py
~/blender/blender -b --python-exit-code 1 --python art/blender/upgrades_boots.py
python3 art/blender/upgrades_sheet.py
node tests/upgrades-assets.mjs
bash tests/run-upgrades-review.sh
```

Visually reviewed each Blender render and game screenshots, including six dog poses, boot Walk
deformation, all held tools, the clear stretched steel pipe, and sand flattened to 20%.
Contact sheets: [assets](../../art/blender/renders/upgrades-sheet.png),
[motion/scaling](../../art/blender/renders/upgrades-motion-sheet.png),
[in game](../../art/blender/renders/upgrades-game-sheet.png).
Browser audit is `art/blender/renders/upgrades-game/audit.json`: AMD Radeon 760M / RADV Vulkan,
all six mixer clips moved, boots share the target bones and move their skinned vertices, originals hidden.
`npm test`, `bash scripts/check-globals.sh`, and the upgrade contract checks passed.
No gameplay scripts changed; no push or merge.
