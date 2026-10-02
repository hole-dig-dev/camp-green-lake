# Hoverboard

Delivered [glb/Hoverboard.glb](glb/Hoverboard.glb) and an identical
[`public/models/Hoverboard.glb`](../../public/models/Hoverboard.glb):
**315,680 bytes each (308.3 KiB)**. All geometry is built in background Blender
by [hoverboard.py](hoverboard.py); the editable source is
[hoverboard.blend](hoverboard.blend).

The deck is **0.950 m long × 0.320 m wide**, with a **0.040 m shell**.
The complete asset is **0.082 m deep**, including the downward thruster pads
and translucent glow discs. It exports as one mesh with nine material
primitives, **5,676 triangles**, and no textures, cameras, lights or animations.

The origin is the **centre of the standing surface**, at game **Y = 0**.
All geometry is at or below that surface. Length runs along game **Z**;
the nose chevrons point game **+Z**, authored along Blender **−Y**.
Exported bounds are X ±0.160, Y −0.082…0, Z ±0.475 metres.
The two rounded grip zones support a camper in a skate-style stance.

Emissive material names:

| Material | Purpose |
| --- | --- |
| `cgl_hover_edge_cyan` | Continuous perimeter light and power indicators |
| `cgl_hover_thruster_cyan` | Two downward induction rings |
| `cgl_hover_pad_bluewhite` | Two pad cores and forward chevrons |
| `cgl_hover_glow_disc` | Faint blue-white discs and halos, opacity 0.11 |

Emission uses core glTF `emissiveFactor`; it survives the existing GLTFLoader
and `gameMat` adapter. The shell has metallic 0.32 / roughness 0.22 in the GLB;
the game applies its usual material styling. Glow discs use alpha blending.
For **one inch (0.0254 m) of clearance below the solid pads**, place the deck
origin **0.0969 m above the local ground plane**. The faint discs extend to
0.0149 m above that plane. Maintain the supporting ground height over a hole
when integrating movement.

Inspected previews:

- [Blender top view](renders/Hoverboard.png) and
  [underside](renders/Hoverboard-underside.png), Eevee/Vulkan.
- [Camper standing on the deck](renders/hoverboard-game/camper.png).
- [Ground clearance](renders/hoverboard-game/deck-clearance.png).
- [Actual 15 m yard view](renders/hoverboard-game/yard-15m.png).
- [Over a dug hole](renders/hoverboard-game/over-dug-hole.png),
  [thrusters seen from the hole](renders/hoverboard-game/thrusters-over-hole.png),
  and [night view](renders/hoverboard-game/night-hover.png).
- [Asset measurements](renders/Hoverboard-asset.json) and
  [game audit](renders/hoverboard-game/audit.json).

The game review uses temporary placement in the actual game scene. It verifies
Radeon 760M/RADV rendering, all four emissive materials, origin and dimensions,
sneaker bounds fitting the deck, soles meeting its top, one-inch solid-pad
clearance and a visible board footprint at 15 m. Gameplay movement and purchase
integration are separate from this asset delivery. No `public/js/*.js` changes.

Validation: `npm test` passed (all asset checks and 19 smoke checks);
`bash scripts/check-globals.sh` passed; the two GLB copies match byte for byte.

Rebuild and reproduce screenshots from this checkout:

```bash
mkdir -p .hoverboard-tmp
env -u DISPLAY TMPDIR="$PWD/.hoverboard-tmp" \
  VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.json \
  blender -b --factory-startup --gpu-backend vulkan --threads 4 \
  --python-exit-code 1 --python art/blender/hoverboard.py
TMPDIR="$PWD/.hoverboard-tmp" node /home/botuser/personal-assistant/scripts/gpu-preflight.mjs
TMPDIR="$PWD/.hoverboard-tmp" node tests/hoverboard-review.cjs
TMPDIR="$PWD/.hoverboard-tmp" npm test
TMPDIR="$PWD/.hoverboard-tmp" bash scripts/check-globals.sh
```

The review starts and stops its own server, with disposable data inside this
checkout. Its Chromium launch passes ANGLE/Vulkan GPU flags.
