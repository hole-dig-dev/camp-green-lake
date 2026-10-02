# GREEN LAKE FIZZ soda machine

Chunky faded red cabinet with a cream illuminated panel, original cartoon bottle
and lightning logo, coin slot/return, three selection buttons, hinged delivery
flap, side branding, dented steel, paint chips and a sun-bleached roof.
All geometry and lettering are authored in Blender.

| File | Size / dimensions |
| --- | --- |
| [glb/SodaMachine.glb](glb/SodaMachine.glb) | **148,364 bytes** (144.9 KiB); **0.900 m wide × 0.759 m deep × 1.900 m tall** |
| [../../public/models/SodaMachine.glb](../../public/models/SodaMachine.glb) | Identical public copy |
| [gear.blend](gear.blend) | `SodaMachine` scene; `SodaMachine.Asset` and `SodaMachine.Studio` collections |
| [soda_machine.py](soda_machine.py) | Rebuild, preview, export and public copy script |

One baked mesh, 2,813 triangles, eight materials, no textures or external resources.
Origin `(0, 0, 0)` is on the ground at the footprint centre. The front faces
Blender **−Y**, exported game **+Z**. Feet contact Z=0 in Blender / Y=0 in glTF.

Reviewed the [Blender render](renders/SodaMachine.png),
[in-game overview beside the water drums](renders/SodaMachine-game.png),
[in-game detail](renders/SodaMachine-game-detail.png), and
[15 m view](renders/SodaMachine-game-15m.png).
The review uses the actual game loader and material adapter at
`{ x: 5.6, y: baseH(5.6, 34.2), z: 34.2, ry: Math.PI }`.
The raised 15 m camera clears the parked pickup and gate; the red cabinet,
side FIZZ word and cream bottle panel remain distinguishable. Review renderer: AMD Radeon 760M / RADV,
ANGLE Vulkan. Bounds and renderer evidence are in
[the asset audit](renders/SodaMachine-asset.json) and
[the game audit](renders/SodaMachine-game.json).

The GLB contains a core glTF emissive cream panel. The current `gameMat` adapter
discards emissive properties, so game screenshots show its cream base colour.
Future upgrade integration can preserve that panel's emission for a night glow.
The review places the machine at runtime; permanent placement and crew morale
behavior belong to the gameplay integration. `public/js/*.js` is unchanged.

Rebuild and reproduce the review from this worktree:

```sh
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json blender -b art/blender/gear.blend --gpu-backend vulkan --threads 4 --python-exit-code 1 --python art/blender/soda_machine.py
node /home/botuser/personal-assistant/scripts/gpu-preflight.mjs
node tests/soda-review.cjs
mkdir -p tests/out/soda-temp
TMPDIR="$PWD/tests/out/soda-temp" npm test
bash scripts/check-globals.sh
```

Validation passed: GPU preflight, public/source byte equality, ground contact,
game bounds, exported emission, game load without page errors, `npm test`, and
globals check. Review servers use scratch data inside this worktree and clean
up on exit. No videos, logs or dependencies are included in the commit.
