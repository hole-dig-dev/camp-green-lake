# Alien face on the original camper

`AlienFace.glb` is the current alien treatment. It is a face-only Wardrobe attachment:
two large glossy black almond eyes, two small eye glints, two tiny nostril dots and
a thin slit mouth. The eyes follow the exact approved camper head surface and wrap
to about 70 degrees around either temple. There is no replacement head, neck, nose,
skin shell or cranium ridge. The camper's original silhouette and proportions remain.

Attach the loaded GLB scene to the existing `head` bone at position `(0,0,0)`, identity
rotation and scale `(1,1,1)`, in model metres just like `face_options.py` exports.
Blender -Y becomes game +Z forward. The seven independent face meshes share three
materials; there are 5,996 triangles and no skeleton, animation or texture dependency.
The authoring and public exports are byte-identical, 128,600 bytes each:

- `art/blender/glb/AlienFace.glb`
- `public/models/AlienFace.glb`

Keep `CGLCamper_Head` and `CGLCamper_Neck` visible. Tint the existing `CGL_Skin`
material to `#5fd04a`, including the head, neck and hands. Hide original eyes, brows,
mouth, teeth and nose, plus hair, hats, glasses and any existing attached head
cosmetics. Use the Wardrobe face material conversion, preserving the black eyes'
roughness of 0.12. No scaling, enlargement or lifting of the camper head is needed.

`AlienHead.glb` and its earlier source/previews are retained as **unused legacy
assets**. Use `AlienFace.glb` for the feature. The green UFO is unchanged.

Source: [alien_face.py](alien_face.py) and [alien-face.blend](alien-face.blend).
The Blender script reads the exact head vertices from `public/models/camper.glb`
and uses them as a ray-cast fit reference. The native scene retains this reference
in its Studio collection; only the selected face root and pieces export, matching
the Wardrobe face export contract.

Rebuild and capture from the checkout root:

```bash
mkdir -p .ufo-tmp
env -u DISPLAY TMPDIR="$PWD/.ufo-tmp" blender -b --factory-startup \
  --gpu-backend vulkan --threads 4 --python-exit-code 1 \
  --python art/blender/alien_face.py
node /home/botuser/personal-assistant/scripts/gpu-preflight.mjs
TMPDIR="$PWD/.ufo-tmp" node scripts/preview-alien-face.mjs
```

The existing face lab loads the real camper, tints its original skin green and
attaches the face. The preview script checks that original head/neck vertices,
indices, positions, rotations and scales remain unchanged and both meshes stay
visible. It verifies identity attachment, the exported reference hash, face-only
content, matching exports and attachment during Idle, Walk and Dig. It starts its
own local server with scratch data inside this checkout and closes it afterward.

Front, true side and full-body views were inspected on Radeon 760M / RADV with
ANGLE Vulkan. The black eyes sit on the original skin without eye clipping, and
the tiny nostrils and mouth face +Z. Background Blender rendered both stills using
Vulkan. `npm test` and `bash scripts/check-globals.sh` passed. The camper GLB,
approved Wardrobe face library and runtime `public/js/*.js` remain unchanged.

[Front fit](renders/AlienFace-fit-front.png) ·
[Side fit](renders/AlienFace-fit-side.png) ·
[Body fit](renders/AlienFace-fit-body.png) ·
[Blender front render](renders/AlienFace.png) ·
[Blender side render](renders/AlienFace-side.png) ·
[Validation](renders/AlienFace-validation.json).
