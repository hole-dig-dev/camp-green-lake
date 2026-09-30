# The buried town is now Main Street plus tunnels (it replaces the 6 x 6 grid)
Answers: nothing new from you (checked every branch). Our 2026-09-29 20:30 questions are still open. This replaces my 15:30
note's grid ruins.
Branch: `jt/next`

JT's Claude here. JT saw the dressed 6 x 6 grid and said it read "more like a grid than an actual underground area". He
asked for "6 buildings on Main, and interweaving tunnels for buildings off main street", and then "no reshuffle": the
town is the same every day.

## What changed in `public/sim.js` (your town section, rewritten)
- **The layout:**
  - `TOWN` now has `STREET` (x -34..34, z -7.5..7.5, 5.5 m high), `TUN_R` 1.3 and `TUN_H` 2.6.
  - `N`, `C` and the cell functions (`townCellAt`, `townCellCenter`, `townBreachCell`) are gone.
  - Coordinates are town-relative (add `TOWN.X` / `TOWN.Z`).
- **Buildings:**
  - `TOWN_BLDGS` lists 17 buildings with a size each (L 14 x 12, M 11 x 10, S 9 x 8).
  - `TOWN_SPOTS` holds 6 Main Street spots and 7 off it.
  - `TOWN_PLAN` fixes who stands where. On Main: saloon, store and hotel on one side; church, school and bank on the
    other. Off Main: sheriff, jail, boat shed, Kate's house, well, onion cellar, and Kate's vault off the east tunnel.
    The stable, doctor, barber and post office are built but not placed.
- **Tunnels:**
  - `TOWN_EDGES` lists the tunnels that can exist, with waypoints drawn so they never cross.
  - `townLayout(day, seed = TOWN_SEED)` builds from one fixed seed: a spanning tree, so everything is reachable, plus
    loops, with about 1 in 4 as crawlspaces.
  - Only the loot uses `day`.
  - `townDoor(b, side)`, `townAlong(pts, t)` and `townBreachSpot(x, z, lay)` replace `townBreachCell`.
- **New test:** `tests/town-layout.mjs` (now part of `npm test`) checks the fixed seed and 400 others: everything is
  reachable, and no tunnel runs through a building, the street, or near another tunnel.

## What changed in `89-town.js`
- **Rendering:**
  - It places `TownStreet`, `TownBldg_<key>`, `TownDoorPlug` (on doors with no tunnel), `TownMouthPlug`, and
    `TownShoring` every 3 m, plus debris (all from `art/blender/town.py`).
  - Each tunnel's cave wall is a generated arched mesh along its path, lower through a crawlspace.
- **Movement:**
  - You can walk where the street, a building's interior, an open doorway or a tunnel is (`TWALK`, `townWhere`,
    `townWalk`), minus the furniture colliders.
  - `TOWNCOL` is gone.
- **Unchanged:** breaches, shafts, climbing help, the stairwell exit (now at the west end of Main Street), the well,
  loot pickup and the network messages.
- **Dropped:** flooded cells and rotten floors (the old framework markers).
