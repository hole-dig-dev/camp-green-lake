# Sand pipeline asset handoff

Five rebuilt Blender assets, plus a permanent clear inlet in `Sifter.glb`.
Authoring sources are `gear.blend`, `props.blend`, `pipe.py`, `sifter.py`, and
`pipeline_common.py`. Every GLB is in `art/blender/glb/` and `public/models/`.
The six previews are in `renders/`; `renders/pipe-sheet.png` is the contact sheet.
`renders/pipe-game-sifter.png`, `pipe-game-run.png` and `pipe-game-crack-20m.png`
record the in-game review.

All coordinates below use the **game frame**: X along the pipe, Y up,
Z = minus Blender Y. Origins are at ground level, with an axis at Y=0.24.

| Asset | Dimensions and placement |
| --- | --- |
| `PipeSection` | X=0..1 m, outer radius 0.120 m, bore radius 0.108 m. Hollow/open ends. Stretch only X to the run length; longitudinal seams keep their width. 184 triangles. |
| `PipeJoint` | Centred at node; clear sleeve X=-0.13..0.13 m, clamp bands, wooden saddle and pins. Footprint 0.32 × 0.48 m; top Y=0.41. 780 triangles. |
| `PipeCrack` | X=-0.5..0.5 m; jagged clear halves, splinters and a sand spill. Two-sided yellow/red FIX board, top Y=0.92. Replace a 1 m portion of the intact run with this asset so the gap is visible. 1,828 triangles. |
| `PipeSlug` | X=-0.45..0.45 m, asymmetric granular surface and tapered ends. Maximum radius from the Y=0.24 axis is 0.103 m, inside the 0.108 m bore. 1,160 triangles. |
| `PipeIntake` | Open clear hopper with sparse bucket rests. Rim Y=1.23; SAND IN board above it. Footprint about 0.98 × 0.98 m. Socket **(-0.35, 0.24, 0)**, facing -X. 2,784 triangles. |

The sifter socket is **(-1.9, 0.24, 0)**, facing -X, in the sifter's local
frame. The inlet is already included in `Sifter.glb`; no separate riser needs
placing. Its stay and clamps leave the moving sand visible. Existing hopper,
tray and crank frames are preserved. `SifterTray` positions and normals match
the previous export exactly; `SifterCrank.glb` is unchanged.

`public/models/PipeInletPath.json` contains the 29-point **centreline**, generated
from the same Blender points as the fitting, total length approximately 3.027 m.
It starts at the socket, curves to **(-1.6, 0.52, 0)**, rises to
**(-1.6, 1.96, 0)**, curves across the hopper at Y=2.24, and finishes pointing
down at **(-0.85, 1.90, 0)** above the hopper grille. Elbow centreline radii are
0.28 m. The server explicitly serves this JSON URL with `application/json`;
other model JSON URLs remain blocked.

When following the inlet centreline, offset the slug by **(0, -0.24, 0)** in a
parent pivot, then rotate the pivot's +X to the path tangent and place the pivot
at the centreline point. A rigid 0.9 m slug cannot fit the tight elbows intact;
shorten its X scale to about 0.25 there, or use several shorter plugs spaced
along the path. Straight runs retain the full 0.9 m plug. Transparent walls use
core glTF alpha BLEND (0.16), compatible with the existing game material loader.

Rebuild from the repository root (Radeon Vulkan backend):

```sh
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json ~/blender/blender -b art/blender/gear.blend --gpu-backend vulkan --python-exit-code 1 --python art/blender/pipe.py
SIFTER_ONLY=1 VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json ~/blender/blender -b art/blender/props.blend --gpu-backend vulkan --python-exit-code 1 --python art/blender/sifter.py
python3 art/blender/pipe_sheet.py
```

Verification: inspected all six Blender previews, the contact sheet, the in-game
connector/connected pipe/sand plug/crack, and the repair marker at >20 m. Blender
and Chromium both rendered on the Radeon 760M. `npm test`, globals check, sift
capture, gold animation contract checks, and `pipeshots.cjs` passed. The latter
also checks JSON endpoints, transparent game materials and blocked URLs.
No `public/js/*.js` changes were needed. Raw captures and logs stay local under
the ignored `tests/goldfx/out/pipe/` directory.

Reproduce browser review after GPU preflight:

```sh
node /home/botuser/personal-assistant/scripts/gpu-preflight.mjs
bash tests/goldfx/run.sh 4821 tests/goldfx/fxshots.cjs 4821 tests/goldfx/out/pipe/sift sift
bash tests/goldfx/run.sh 4822 tests/goldfx/pipeshots.cjs 4822 tests/goldfx/out/pipe/game
bash tests/goldfx/run.sh 4823 tests/goldfx/verify.cjs 4823
npm test
bash scripts/check-globals.sh
```
