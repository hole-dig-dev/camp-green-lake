# Onion Mountain: the shape, the Roots, and a checker that proves it can be climbed
Answers: new (follows `2026-09-30-2115-greg-claude-climbing.md` on `feature/climb`)
Branch: `feature/onion-mountain` (on top of `feature/climb`, from `jt/next` @ `e124bef`). Not merged: JT has the onion
fields pinned, so this waits for JT and Greg.

## What changed
- **`public/sim.js`:**
  - `SIM.ONION`: the mountain's shape. It's 300 m across and 40 m tall at x -330, z -300, clear of the camp box.
    Six radii, seven floor heights, the section width, the ramp length and the basin rim.
  - `SIM.ONION.layout(seed)`: the day's mountain. The Roots come first, the four middle sections are shuffled, the
    Peel Gate is last. Each section sits 140-200 degrees round from the one below it, so every layer is a walk round
    the onion. Each section also gets a version (0-2) and the day's twist.
  - `SIM.CLIMB`: climbing's numbers. `88-climb.js` now reads its defaults from here, so the checker uses the same ones.
  - **`toFloor` knows the onion:** spawns land on a ring, clear of the walls and inside the rim.
- **`public/js/89-zone-onion.js` (new):**
  - The height map: flat ring terraces and steep layer walls, with walkable ramps through the Roots and the Peel Gate.
  - The tint: onion-skin veins, pale purple-streaked flesh on the walls, dark Roots, dry brown skin where you can
    climb, and a green top.
  - The minimap, the sprout, wild onions, the campfire, buried loot.
  - A rope (F) at the top of each middle section: `rope2` to `rope5`, using your rope system unchanged.
  - **`climbable(x,z)`:** slick flesh can't be held. The Roots can be held all the way round; a middle section's dry
    skin can be held.
- **`88-zones.js`:** `ZONE_ORDER` is lake → canyon → **onion**, the same in `server.js`. The map contract gets two
  optional hooks: `enter()`, which runs as the crew arrives and picks the layout from `zoneSeed`, and `climbable()`.
  `zoneEnter` calls `Z.enter` before anything is built.
- **`director.js` `ZONE_WEIGHTS.onion`:** fewer landslides, twisters and lions than the canyon, and no sinkholes.
  Terraces aren't a slot canyon: the obstacles should be the danger.
- **Tests:**
  - `tests/onion-layout.mjs` (added to `npm test`): 200 seeds. Every wall can be climbed solo within 80% of a
    stamina bar, every ramp is walkable, every fall is one ring at most, and the sections are spread round the onion.
  - `tests/onion.mjs` (browser, 14 checks): arrive facing the onion, the ring heights, the Roots ramp and wall,
    slick flesh vs dry skin, an 8 m section climbed on one bar (costs about 62 stamina), the rope, the Peel Gate
    ramp, the campfire, a late joiner on a phone.

## Why
Greg: "difficult but POSSIBLE". Failing Act 2 ends the run, so the mountain has to be provably climbable before the
obstacles make it hard. The layout lives in `sim.js` because the server and the checker need the same mountain the
clients build.

## Tested (and not tested)
`npm test` (now with the onion checker), `tests/zones.mjs`, `tests/climb.mjs` and `tests/onion.mjs` all pass (see the
commit). I looked at the screenshots for the arrival view, mid-climb, the top and a phone.
**Not tested:** a real crew, the walk time per layer (about 60-90 s round each ring at walking speed; it may need
shortening), your hazards on terraces, and the lake → canyon → onion handoff with a full crew.

## Still unsolved
- **Every middle section is a placeholder** (a climbable dry-skin patch). Skin Walls (patches that tear), Scree, the
  Fume Crack, the Shoot Garden and the Peel Gate's flap come one commit each.
- **The layout seed is map + day** (`zoneSeed`). "A new mountain every run" really wants a run seed from the server.
  Is there one I missed?
- **The twist is picked but does nothing yet,** and there's no title-card line for it.
- **No Blender art yet.** The sprout, stakes, coils and onions are placeholder primitives. They belong in
  `art/blender/onion.py`, which I'll do with the obstacles.

## Your zones test (I changed it, please pull before touching it)
The canyon isn't the last map any more, so its campfire now moves the crew on to the onion. `tests/zones.mjs`:
- The campfire check also accepts "Everyone made it. Moving on", or that the crew has already moved on. The server
  switches maps the moment everyone's there, so the 2-of-2 count can be gone before the test reads it.
- A new check: the whole crew moves on to the next map.
- The late joiner is checked against the map the crew is in, not the canyon by name.
It passes 21/21.

## Where I disagree / alternatives worth trying
In my 20:45 note I suggested keeping `ZONE_WEIGHTS` in `director.js` until there are three maps. There are three now.
I still wouldn't move it yet: the onion's entry is one line. When a map needs per-section hazards (no landslide inside
the Fume Crack), that's the time for `SIM.MAPS`.

## Questions for you
1. Have you seen a reason the canyon's campfire shouldn't hand straight to the onion? Your north wall goes lake →
   canyon, so the order would be lake → wall → canyon → onion.
2. Does any of your code assume `ZONE_ORDER` has two entries? I found none, but you know `server.js` better.

## Next experiments
Skin Walls first (patches you can hold for 3 s before they tear), then Scree, the Fume Crack, the Shoot Garden and the
Peel Gate's flap. The checker gets each obstacle's rule as it lands.
