# Employee of the Day board

`glb/EmployeeBoard.glb` and `../../public/models/EmployeeBoard.glb` are identical,
**338,440 bytes each (330.5 KiB)**. Source: `employee-board.blend`; deterministic
builder: `employee_board.py`. All asset geometry is authored in Blender.

The board measures **3.200 m wide × 0.437 m deep × 2.600 m tall**, including the
rear braces. Its `EmployeeBoard` root is at ground level at the board's centre.
Front faces **Blender −Y / game +Z**, with Blender +Z / game +Y up. The main body,
`EmployeeBoardBody`, includes weathered planks, two posts, iron shoes, rear
bracing, the stencil header, nails, a stamp and a bird dropping.

| Slot, left to right from the front | Frame | Portrait / material | Plaque / material | Intended title |
| --- | --- | --- | --- | --- |
| 1 | Gold with corner rosettes | `Photo1` / `photo1` | `Plaque1` / `plaque1` | Most gold found |
| 2 | Tarnished brass | `Photo2` / `photo2` | `Plaque2` / `plaque2` | Most times thrown around |
| 3 | Cheap riveted tin, rusty rebate | `Photo3` / `photo3` | `Plaque3` / `plaque3` | Least Valuable Person |
| 4 | Split wooden moulding | `Photo4` / `photo4` | `Plaque4` / `plaque4` | Big Spender |

Each portrait is **0.48 × 0.64 m (3:4)**; each plaque is **0.60 × 0.15 m (4:1)**.
Each is a separate four-vertex, one-face Blender mesh with its own material.
glTF triangulates each quad into two triangles without adding vertices. The
static body is joined separately; the GLB has nine meshes, 22 material
primitives and 6,531 triangles overall. The blank canvases are ready for the
game to supply pictures, titles and names.

## UV and canvas convention

In Blender, all eight surfaces use the entire 0..1 UV square:

- **U increases left → right** as viewed from the front.
- **V increases bottom → top**, with bottom-left (0,0), bottom-right (1,0),
  top-right (1,1), top-left (0,1).

The Blender glTF exporter converts V to glTF's top-origin convention. In the
exported GLB, top-left is (0,0) and bottom-left is (0,1). Follow GLTFLoader's
texture convention when replacing the material map:

```js
const photo = gltf.scene.getObjectByName('Photo1');
const texture = new THREE.CanvasTexture(canvas);
texture.flipY = false;
photo.material = photo.material.clone();
photo.material.color.set(0xffffff);
photo.material.map = texture;
photo.material.needsUpdate = true;
```

Apply the same convention to `Plaque1`…`Plaque4`. Encoding should match the
game's existing canvas material convention. The review uses r128's
`LinearEncoding`. Front normals are game +Z and all canvas materials are unique.
`canvasTextureFlipY: false` is also exported as node metadata.

## Visual review and checks

- [Blender preview](renders/EmployeeBoard.png): Eevee on Radeon 760M Vulkan;
  inspected for header readability, frame construction, weathering and posts.
- [In-game canvas review](renders/employee-board-game/front-uv.png): actual game
  avatar portraits (player, Randy, Stan and Mr. Sir), category/name plaques,
  TOP/LEFT/RIGHT labels and four distinct corner colours on every canvas.
- [10 m yard view](renders/employee-board-game/yard-10m.png): full-size placement,
  header and all four frame silhouettes remain readable at 10 m.
- [GPU/pixel audit](renders/employee-board-game/audit.json): Radeon 760M RADV;
  all **32 rendered corner samples** match the expected canvas colours. This
  checks the actual texture upload, shader, exported UVs and camera projection.
- `npm test` passes, including `employee-board-assets.mjs` (sizes, hierarchy,
  unique materials, UV corners, winding, normals and matching public export).
- `bash scripts/check-globals.sh` passes. No `public/js/*.js` changes.

Rebuild and review from the worktree (keep temporary files within it):

```bash
mkdir -p .employee-board-tmp
env -u DISPLAY TMPDIR="$PWD/.employee-board-tmp" ~/blender/blender \
  -b --factory-startup --gpu-backend vulkan --python art/blender/employee_board.py
TMPDIR="$PWD/.employee-board-tmp" node /home/botuser/personal-assistant/scripts/gpu-preflight.mjs
TMPDIR="$PWD/.employee-board-tmp" node tests/employee-board-review.cjs
TMPDIR="$PWD/.employee-board-tmp" npm test
TMPDIR="$PWD/.employee-board-tmp" bash scripts/check-globals.sh
```

The review starts its own temporary server, injects the board into the live game,
and cleans up its server data. Persistent gameplay placement and award logic
can use the supplied named surfaces; this asset delivery leaves the game client
source unchanged.
