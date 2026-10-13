# ScoopFP delivery

A camera-space, two-handed scoop using the original camper sleeves, hands and five camp-shovel meshes/materials. The independent shovel bone and baked arm poses keep both grips on the shaft while the blade plants, levers up, carries level and dumps toward screen right. The ready pose is composed lower and flatter for first-person viewing. The third-person asset and its clips are unchanged.

## Timing

`ScoopFP` lasts **1.5 seconds**, authored at 30 fps, matching `SCOOP_TIMES` from `blender/cgl_rig.py`.

| Phase | Frame | Seconds |
| --- | ---: | ---: |
| Ready / idle | 0 | 0 |
| Planted | 8 | 0.266667 |
| Levered | 16 | 0.533333 |
| Loaded / carry | 25 | 0.833333 |
| Tossed | 35 | 1.166667 |
| Return to ready | 45 | 1.5 |

Loaded holds through frame 28 before the rightward throw. Endpoint matches ready; the preview repeats three cycles in 4.5 seconds (960×540, 30 fps).

## Game integration

Load `public/models/camper-fp.glb` and parent its **whole imported scene directly to the camera**, at position zero and unit scale. The scene origin is the eye; glTF **+X is screen right, +Y is up, −Z is forward**. Preserve imported child transforms: the rig includes the authored eye offset and forward reflection. Do not apply the third-person scale, an additional eye offset, or a 180° facing rotation.

Evaluate `ScoopFP` at time zero for idle (including an initial mixer update). Drive its time with the same phase clock as `Scoop`; freeze at 25/30 seconds for carry if needed. No runtime IK is required. Front and rear grip coordinates on the shaft are 0.47 m and 0.74 m, respectively, in its original longitudinal coordinates.

The exported asset contains nine visible meshes, no torso/head/legs, and only `ScoopFP`. `CGLCamper_R_ShovelBlade` is retained for attaching game dirt. The rendered dirt payload and ground are review-only, absent from the GLB. The viewmodel follows camera pitch; world digging/contact and the third-person animation remain authoritative. At −30° the review ground meets the planted tip approximately 1.1 m ahead.

## Review and verification

Inspected both pitch rows and decoded frames from the encoded loop after iterating blade placement, grip spacing, arm paths and the prop pivot. The plant stays low, the lever raises the tip, the loaded blade rests in the lower third, and the toss rolls the blade toward the right edge. The arms retain identical camera-relative framing at pitch 0° and −30°.

- EEVEE/Vulkan visibility masks at all 46 integer frames: maximum sleeves/hands coverage **7.19%**; minimum visible blade fraction **65.74%** of its isolated silhouette, at plant. The front sleeve partially overlaps the blade there; the blade remains readable and never disappears. Minimum visible metal area is 401 pixels at 960×540.
- Exported three.js geometry sampled at 181 quarter-frame times at both pitches: maximum hand-to-shaft grip error **0.62 cm**; nearest vertex **0.286 m** from the eye, giving **0.241 m clearance beyond the 0.045 m near plane**. Every blade vertex stays in frame (maximum absolute NDC coordinate 0.728).
- Three.js verifies the exact clip name, 1.5 s duration, blade node, mesh count, phase behavior, loaded hold and seamless endpoint. Existing camper tests pass and `camper.glb` is byte-for-byte unchanged.
- Rendering used AMD RADV/Vulkan; preview encoding/decoding used VAAPI. No software 3D rendering or game JS changes.

## Files and reproduction

Authoring: `blender/cgl_scoopfp.py`; isolated editable scene: `art/blender/camper-fp.blend`.

```sh
~/blender/blender -b --factory-startup --python-exit-code 1 --python art/blender/camper_fp_export.py
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json ~/blender/blender -b --gpu-backend vulkan art/blender/camper-fp.blend --python-exit-code 1 --python art/blender/scoopfp_review.py -- --output /tmp/sol-scoopfp/render --preview --metrics
python3 art/blender/scoopfp_assemble.py --ffmpeg /path/to/ffmpeg-with-h264_vaapi
node tests/camper-scoopfp.cjs
```

Review artifacts: `art/blender/renders/scoopfp-sheet.png` and `art/blender/renders/scoopfp-preview.mp4`.
