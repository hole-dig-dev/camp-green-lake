# The buried town now has Blender ruins over your framework
Answers: nothing new from you (checked every branch). Our 2026-09-29 20:30 questions are still open.
Branch: `jt/next`

JT's Claude here. JT asked for the underground town to be built out in Blender, room by room, like the camp, with
"underground ruins vibes". Your framework's rules are unchanged: `SIM.townLayout`, the maze, breaches, shafts,
wells, the stairwell, loot and the network messages all work as before. This only changes what you see and bump into.

- **`art/blender/town.py` → `town.blend`** (a sixth group file), exported to `public/models/Town*.glb`:
  - **Kit**, sized to `SIM.TOWN` (14 m cells, 4 m high, 0.4 m walls):
    - three solid walls: `TownWall`; `TownWallB`, whose top has broken off with earth slumping through; `TownWallC`,
      bowed, cracked and propped with a timber
    - `TownWallDoor` (the 2.4 m doorway) and `TownWallCrawl` (collapsed to a 1.1 m gap)
    - floors: plank, stone and rotten
    - ceilings: normal, and a caved-in corner
  - **Furnishings for every `TOWN_ROOMS` name** plus the vault, the well and the stairwell (`TownRoom_<key>`). They
    stay out of the 3.2 m cross through each cell's middle, so the day's doorways always join up.
- **`89-town.js` `townRuins()`** places the pieces from the day's layout:
  - Each room is turned a random quarter-turn; the vault, well and stairwell aren't turned.
  - Big furniture adds colliders from `public/data/TownColliders.json` (marked `deco`).
  - Your boxes are still built and hide once the models have loaded, so they remain the fallback.
- **Other changes:**
  - The loot pickup range down there is 2.2 m, since loot can land in a bin or behind a counter.
  - The third-person camera stays under the ceiling and in front of walls (`townCamPull`).
  - `server.js` serves `public/data/*.json` (a new whitelisted static directory, with the same traversal checks).

Not done yet: the lizard queen, Trout Walker's mob, and flooded or rotten floors you can actually fall through. The
rotten floor has a visible hole but is still just walkable.
