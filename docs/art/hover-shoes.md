# Hover shoes handoff

Pearl and navy futuristic runners with two continuous cyan sole rails, underfoot emitters,
swept side supports, orange pull tabs and three recessed cyan thruster vents per heel.
All geometry was authored in background Blender. The low hollow collars accept the original camper's
trouser legs; the pair is lighter and lower than the iron gravity boots.

| File | Bytes | Weighted bones | Emissive materials |
| --- | ---: | --- | --- |
| `public/models/footwear/hover-shoes.glb` | 258,144 | `shin.L`, `shin.R` | `cgl_hover_sole_cyan`, `cgl_hover_thruster_cyan` |
| `art/blender/glb/hover-shoes.glb` | 258,144 | Same | Same |

The two files are identical. There are 3,592 triangles, two mesh nodes and seven material primitives
per foot. Game-space bounds are X −.267…+.267 m, Y 0….2385 m, Z −.160…+.218225 m.
Every vertex is weighted 100% to the matching shin. Mesh extras are `slot="footwear"`, `side="L"`
or `"R"`, and `cosmeticOnly=true`. No replacement camper mesh, camera, light or animation is exported.
The retained original joint names are `root`, `hips`, `spine`, `head`, `arm.L`, `forearm.L`, `arm.R`,
`forearm.R`, `leg.L`, `shin.L`, `leg.R`, `shin.R`; only the two shins carry shoe weights.

Use the binding contract in [footwear-20.md](footwear-20.md) and the actual
[footwear viewer](../../public/footwear-lab/viewer.js): map imported joint names to the camper's
own bone objects, original inverse matrices and bind matrix. Three.js sanitizes the shins to
`shinL` / `shinR`. Hide `CGLCamper_L_Shoe`, `CGLCamper_R_Shoe`, `CGLCamper_L_Sole` and
`CGLCamper_R_Sole` while the replacements are worn. Preserve the glTF emissive colour.
The asset includes `KHR_materials_emissive_strength`; the older lab loader displays its nonzero
emissive factors with intensity 1, while current loaders can also use the authored strength.

The mesh stays on the original floor in bind space. Gameplay integration should raise the camper
by .0254 m (one inch), let holes/sinkholes pass beneath it, and quietly turn hover off during digging
so the camper settles into the hole. This delivery is the footwear asset; those mechanics are not
implemented here. No `public/js/*.js` files or wardrobe catalogs were changed.

The compressed native source is [hover-shoes.blend](../../art/blender/hover-shoes.blend).
[hover_shoes.py](../../art/blender/hover_shoes.py) rebuilds the geometry, exports both copies and
renders two views with Eevee on Vulkan. Its render check exposes only the Radeon ICD and requires
the AMD Radeon 760M / RADV device. Rebuild from the repository root:

```sh
env -u DISPLAY VK_DRIVER_FILES=/usr/share/vulkan/icd.d/radeon_icd.json \
  blender -b --factory-startup --gpu-backend vulkan --python-exit-code 1 \
  --python art/blender/hover_shoes.py
node scripts/preview-hover-shoes.mjs
npm test
bash scripts/check-globals.sh
```

Add `-- --no-render` to the Blender command for exports only. The browser review runs GPU preflight,
uses all required Vulkan Chromium flags and intercepts only the lab's manifest to review this pair
through the existing binder. It checks actual shared camper bones, hidden original footwear,
nonzero cyan emission, and both feet moving in Walk, Run, Sit and Dig.
[audit.json](../../art/blender/renders/hover-shoes-bound/audit.json) records the Radeon renderer,
material names and vertex movement measurements. The asset contract is covered by
[hover-shoes-assets.mjs](../../tests/hover-shoes-assets.mjs) in `npm test`.

Visually reviewed previews:

- [Blender front](../../art/blender/renders/hover-shoes.png) and [heel](../../art/blender/renders/hover-shoes-heel.png).
- [Bound close-up](../../art/blender/renders/hover-shoes-bound/standing-close.png) and [heel vents](../../art/blender/renders/hover-shoes-bound/heel-close.png).
- Camper [standing](../../art/blender/renders/hover-shoes-bound/camper-standing.png), [walking](../../art/blender/renders/hover-shoes-bound/camper-walk.png) and [sitting](../../art/blender/renders/hover-shoes-bound/camper-sit.png).

Validation: `npm test`, `bash scripts/check-globals.sh`, `git diff --check` and the bound-camper review
passed. An initial smoke navigation timed out; the standalone retry and subsequent full suite passed.
Blender and Chromium renders used the Radeon 760M / RADV. Work is committed on
`feature/sol-hover-shoes`; nothing was pushed or merged.
