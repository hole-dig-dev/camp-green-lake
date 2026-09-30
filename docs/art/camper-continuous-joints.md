The chosen camper now has continuous sleeves and trouser legs that deform across weighted elbows and knees.
The head, face, torso, wardrobe, hands and sneakers retain their original authored meshes. The sleeve surface
now tapers smoothly from shoulder to cuff, with no elbow ball or overlapping capsule ridges; trouser rings
subdivide the original profile. Twelve bones drive the rig, including the new `shin.L` and `shin.R` bones.

![The actual game camper standing, sitting with bent knees and waving](camper-continuous-joints.png)

All thirteen named animation clips remain. Walk and Run lift each trailing foot by bending its knee; Jump tucks
the knees and Sit bends them to let the lower legs hang. SitEdge retains the chosen straight-out tailgate pose.
Dig and movement clips also bend the elbows. Drink, Wave, WipeSweat and Radio keep their existing hand-target
solvers. The ragdoll now has fifteen points, with a knee on each leg, and resets those bones when recovering.

Body variants size skinned vertices perpendicular to the limb's rest bone in bind space. Scaling the skinned
object itself would move the sleeve or trousers away from the skeleton. Each variant gets its own geometry;
shared geometry and skeletons remain independent between campers. Hats, skin/clothing tints and held props
still use their existing named parts.

Rebuild the native Blender asset and export (saved compressed):

```sh
/path/to/blender -b art/blender/characters.blend --python-exit-code 1 --python art/blender/camper_export.py
```

`npm test` checks the exported GLB for four closed, connected surfaces, normalized blended weights across both
joint types, animated knees and the complete clip list, then runs the game smoke test. For the detailed runtime
check, first run the machine's GPU preflight, start a local DEV_MODE game with a scratch DATA_DIR, then:

```sh
CAMPER_URL=http://127.0.0.1:PORT/#dbg node scripts/verify-camper-joints.mjs
```

This uses the actual game loader and `makePerson`, checks all five body types, staff skins, a radio attachment,
ragdoll stability and knee recovery, and saves desktop/phone previews in `tests/out/camper-joints`.
