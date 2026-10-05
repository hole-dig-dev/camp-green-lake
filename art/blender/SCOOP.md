# Camper Scoop

`Scoop` is authored in `blender/cgl_rig.py` and registered in `ANIMS`. The rig,
wardrobe and all 14 clips are saved in `characters.blend` and exported to
`public/models/camper.glb`. `Dig` and all other existing clip functions are unchanged.

| Phase | Frame | Seconds into Scoop |
| --- | ---: | ---: |
| Ready | 0 | 0.000 |
| Planted | 8 | 0.267 |
| Levered | 16 | 0.533 |
| Loaded | 25 | 0.833 |
| Tossed | 35 | 1.167 |
| Recover / end | 45 | 1.500 |

30 fps; 46 keyed poses, including the identical endpoint, give 45 frame intervals
and a 1.5-second clip. The loaded pose holds from frame 25 through 28
(0.833–0.933 seconds). `SCOOP_TIMES` records the phase times beside the function.

The camper crouches onto a staggered stance, drives the blade forward/down, then
pushes the rear grip down/back to tip the blade upward near the planting point.
The legs straighten into a level, concave-side-up carry pose. A torso turn toward
the camper's right and a blade roll dump the load before returning to Ready.
Both arms are solved in Blender and baked as ordinary Euler tracks each frame;
the shovel remains on the original right forearm. The left hand grips the lower
shaft at a fixed point, roughly 36 cm below the rear grip. Quarter-frame checks of
the exported animation find a maximum left-hand grip error of 1.76 cm.

The [phase sheet](renders/scoop-sheet.png) shows all six phases from the side and
3/4 front. The [preview](renders/scoop-preview.mp4) repeats the side view three
times: 135 frames at 30 fps, 4.5 seconds, 640×640 H.264, approximately 442 KB.
EEVEE rendered through Vulkan on the Radeon 760M / RADV; VA-API encoded the video.
I inspected successive sheet revisions, additional left-side/rear views, and
decoded frames of the finished video.
The downward rear-grip lever, upward blade tip, level hold and sideways dump make
the motion read as a scoop. The exaggerated crouch and raised rear heel suit the
rig; the rear arm is partly occluded by the torso during the toss, especially in
the 3/4 view. There is no added dirt payload hiding the blade's orientation.

Verification: `node tests/camper-rig.mjs` checks all 14 clips and the existing
continuous skins. `node tests/camper-scoop.cjs` loads the actual GLB through the
repository's three.js `GLTFLoader`, checks the 1.5-second duration, contact during
interpolation, the plant/lever, level loaded hold, rightward dump and matching
loop endpoints. Providing the pre-change GLB as its argument additionally checks
that every track and time in all 13 legacy clips matches within 1e-5; this passed,
including `Dig`.

To rebuild:

```sh
~/blender/blender -b art/blender/characters.blend --python-exit-code 1 \
  --python art/blender/camper_export.py
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json ~/blender/blender \
  -b --gpu-backend vulkan art/blender/characters.blend --python-exit-code 1 \
  --python art/blender/scoop_review.py -- --output /tmp/sol-scoop/render --preview
python3 art/blender/scoop_assemble.py --frames /tmp/sol-scoop/render \
  --ffmpeg /path/to/ffmpeg-with-h264_vaapi
node tests/camper-rig.mjs
node tests/camper-scoop.cjs
~/blender/blender -b art/blender/characters.blend --python-exit-code 1 \
  --python art/blender/scoop_clearance.py
```

The assembly script requires Pillow and an FFmpeg build with `h264_vaapi`.

## Left-arm clearance revision

JT's review identified the left sleeve passing into the torso. The previous
world-space elbow guide failed to follow the torso's turn; the sleeve reached
9.56 cm inside the body at the toss. The revised guide is outward/front/down in
torso space. The left shoulder is shifted approximately 8 cm outward and 5 cm
farther forward than before so the full sleeve, including its rounded shoulder
cap, clears the body. The left grip point remains unchanged on the shaft.

Only `arm.L` / `forearm.L` pose tracks changed. The re-exported GLB's other Scoop
tracks and all 13 legacy clips match the reviewed GLB within 1e-5, including
sampling times. `SCOOP_TIMES`, the shovel path, torso/head/legs, the level hold,
dump and loop endpoints are unchanged.

`art/blender/scoop_clearance.py` checks the saved animation's evaluated sleeve
(the continuous mesh includes both upper arm and forearm) and hand against the
actual bevelled torso mesh at all 46 frames and three additional samples between
each frame: **181 samples total**. It checks triangle intersections and contained
vertices, then computes minimum surface distance from vertex/face and edge/edge
candidates. Results: **zero intersections or contained vertices**; minimum sleeve
clearance **0.020297 m (2.03 cm)** at frame 25 (loaded); minimum hand clearance
**0.126887 m (12.69 cm)** at frame 32. Maximum interpolated grip error in Blender
is **0.018370 m (1.84 cm)**.

The three.js test also deforms the actual exported skin at all 181 quarter-frame
samples. Every sleeve/hand triangle has a separating plane from a conservative
convex envelope containing the torso, with a minimum guaranteed gap of **2.03 cm**.
Exported grip error is at most **1.76 cm**. The 1.5-second clip and all previous
plant/lever/hold/dump checks still pass.

The updated sheet and 135-frame, 4.5-second preview use the original paths.
The review script's optional `--audit` flag renders additional left-side and rear
views into the temporary render directory to inspect clearance from behind.
