# Onion Mountain: a Peak-style climb that's hard but always possible

Proposed by Greg on September 30, 2026. Designed with Greg's Claude. **JT has the onion fields on hold, so this
stays on `feature/onion-mountain` until JT says yes.** Follows `2026-09-28-repo-to-peak-design.md` (Act 2).

## Goal

The next Act 2 map after the Dry Canyon. It should play like *Peak*: getting from the bottom to the campfire is the
whole game. Four tests, in Greg's words: **difficult but possible**, working together, not boring, replayable.

"Possible" matters more than usual because failing Act 2 ends the whole game. Every rule in the "always possible"
section below exists so a crew that plays well can always get through, even on its worst layout.

## The map

A ridiculous mountain shaped like a **giant half-buried onion** (Sam's onions got out of hand), past the lake with
Big Thumb behind it. About 300 m across and 90 m tall. The crew starts at the roots and climbs to the green sprout on
top, where the campfire is.

- **5 layers.** Each onion layer is a ring-shaped terrace. Between rings is a steep **layer wall**. The route spirals
  up, one section per layer.
- **Onion rows** on the lower terraces: the onion fields, on the mountain. Dig in a row with the shovel to get an
  onion. Digging is noisy and draws lizards.
- **Height map, not a 3D model** (option 1). The ground is a height formula, like the canyon's, so JT's zones,
  networking, monsters, hazards and ragdolls work unchanged. The shoots, skin flaps, loose onions and crates are
  Blender models (JT's rule: model changes go through `art/blender/`) with simple box colliders.

## The new move: climbing

The canyon only has leg-ups and ropes. This map needs *Peak* climbing, and it's the plan's `feature/climb`.

| Input | What happens |
|---|---|
| Walk into a steep face, hold Space | Grab the wall. Holding drains stamina; moving drains it faster. At 0 you let go. |
| Tap Space while climbing | Lunge about 1 m up. Fast, and costs a lot of stamina. |
| Reach the top edge | Mantle: pull yourself over automatically. |
| Friend at the top holds F | Pulls you up (the buried town's "hand from the rim", pos flag 256). |
| Friend at the bottom holds F | Boost: you start about 2 m up. Replaces the canyon's jump-speed leg-up. |
| Rope (dropped by whoever got up first) | Same climbing state, slower, costs stamina. |

Stamina can't exceed health (`70-player.js`), so a hurt camper climbs worse. That is the point.

## The sections

Bottom to top. The Roots are always first and the Peel Gate always last. The middle four are shuffled each run, and
each has 2 or 3 versions.

For each obstacle: how it works, how it warns you, the crew way, the solo way, and what a mistake costs.

### 1. The Roots (always first: the tutorial)
Root ramps and low walls of 1 to 2 m. Teaches climbing, boosting and dropping a rope. Falls here barely hurt.

### 2. Skin Walls (a 6 to 8 m layer wall)
- **Works:** the face is slick onion flesh you can't hold, with dry skin patches you can. A patch **tears 3 s after
  you grab it**, so you keep moving patch to patch.
- **Warns:** a patch curls and crackles at 1.5 s.
- **Crew:** boost the first climber; they drop the rope and pull the rest over the top.
- **Solo:** a longer diagonal line of patches with a rest ledge halfway.
- **Mistake:** you land on the terrace below, hurt. Torn patches grow back after 20 s.
- **Versions:** straight, zigzag, chimney (two walls close together).

### 3. Scree Slopes (about 25 m of loose onions)
- **Works:** stop moving and you slide back. Each step can knock an onion loose; it rolls down and knocks over
  whoever it hits (JT's ragdoll tumble, a little damage). A spilled crate at the top pours an avalanche on a rhythm.
- **Warns:** a loose onion wobbles and rumbles for 1 s before it goes. The crate creaks before an avalanche.
- **Cover:** onion "ribs" stick out of the slope. Stand behind one and avalanches pass you.
- **Crew:** climb in separate lanes so nobody is under anybody, or the first one up ties a rope (X) to a stake.
- **Solo:** zigzag rib to rib. Longer, covered.
- **Versions:** straight run, dog-leg, two crates.

### 4. The Fume Crack (a slot about 35 m long, cut into the onion)
- **Works:** the fumes make you cry. The screen blurs more and more, stamina stops coming back, and after about 20 s
  in the fumes you take damage. Fresh-air shafts along the crack clear your eyes. Fume waves pulse down it.
- **Warns:** each wave is a visible green haze, so you time dashes between air shafts.
- **Water:** splashing your canteen on your face clears your eyes, and costs water.
- **Crew:** someone who can still see drags a blinded friend (grab), and you call the next shaft over voice.
- **Solo:** a longer side route with more air shafts.
- **Versions:** straight, forked (one fork is a dead end), with a low climb in the middle.

### 5. Shoot Garden (a 10 to 14 m gap, too far to jump)
- **Works:** giant green shoots grow at the edge. One camper grabs a tip (R) and walks back to bend it; another
  stands on the tip; letting go **flings** the rider across.
- **Warns:** the shoot creaks as it bends, so you hear how hard it's loaded.
- **Crew:** bend and fling. **The last camper** has nobody to bend for them: the crew across throws a rope back.
- **Solo:** a self-leaning shoot. Run up the stalk and jump off the tip at the right moment of its bounce.
- **Mistake:** you fall to the terrace below and climb back up through its roots.
- **Versions:** one wide gap, two shorter gaps, a gap with a landing ledge halfway.

### 6. The Peel Gate (always last)
- **Works:** a huge skin flap blocks the ramp to the sprout. It takes **more than one person's pull**: one camper
  pulls 700 N (`GRAB.FMAX` in `84-grab.js`), the flap needs 1,000 N. Two campers, or one plus a rope. Let go halfway
  and it springs shut. Fully peeled, it stays open for everyone (a crew-wide flag, like the canyon's `rope0`).
- **Solo:** climb over the top of the flap. A long skin climb with no rest ledge.

### Across every layer
- **Lizards** in the onion rows. Eating an onion (Q) keeps them off for 45 s, as it does now.
- **Digging** in a row gets you an onion; the noise draws lizards.

## Always possible: the rules

1. **Every obstacle has a crew way and a harder solo way** (listed above).
2. **Only one camper has to make each layer wall.** Whoever gets up first can drop that layer's rope (the canyon's
   rope system: one anchor per layer, shared by the crew).
3. **Nothing stays broken.** Skin grows back (20 s), rolled onions pile back up at the top, a half-peeled flap
   springs shut rather than jamming. A mistake can't lock the crew out.
4. **Falls are capped at one layer.** The terrace below catches you: at most about 8 m. Fall damage is tuned so a
   camper at full health lands hurt but standing.
5. **Every climb fits the stamina bar,** with a rest ledge partway up any long one. Hurt campers need onions and water.
6. **A checker proves it for every layout.** `tests/onion-layout.mjs` builds the mountain from 100 seeds and checks
   each climb height, gap and stamina cost against what a camper can do (with the same constants the game uses).
   A failing seed blocks the push.
7. **The run only fails if the whole crew is down at once.** A downed camper can be carried and revived.

## Replayable (Greg: check this part)

- **The same mountain for the whole crew:** the server picks the run's seed and the layout comes from
  `SIM.onionLayout(seed)` in `sim.js`, like `SIM.townLayout`. Server and clients build the same thing.
- **Shuffled sections:** the middle four layers come in a different order each run, each with 2 or 3 versions.
  That's 24 orders times about 3^4 versions: you learn the rules, never the route.
- **One daily twist**, shown on the title card:
  - **Windy:** skin tears in 2 s instead of 3; flings drift sideways.
  - **Harvest:** twice the onions in the rows, twice the lizards.
  - **Fog:** you see about half as far; the fume waves are harder to spot.
  - **Scorcher:** water drains faster; the air shafts are fewer.
  - **Calm:** no twist (about 1 day in 5).

## How the code fits JT's game (Greg: check this part)

| File | What |
|---|---|
| `public/js/88-climb.js` (new) | The climbing state: grab, drain, lunge, mantle, pull-up, boost, ropes. Used by every map. |
| `public/js/89-zone-onion.js` (new) | The map: height, tint, minimap, build, items, `ZONES.onion`. Skin patches, scree, fumes, shoots, the flap. |
| `public/sim.js` | `onionLayout(seed)`: section order, versions, twist, and every obstacle's position and size. Shared with the server and the checker. |
| `server.js` | `ZONE_ORDER` gets `'onion'` after `'canyon'`. Crew-wide events (a patch torn, an avalanche, the flap open) go through the existing `zev` messages. |
| `art/blender/onion.py` (new) | Shoot, skin patch, skin flap, loose onion, onion crate, sprout. Exported to `public/models/`. |
| `tests/onion-layout.mjs` (new) | The 100-seed checker (plain Node, no browser). |
| `tests/onion.mjs` (new) | Browser test, like `tests/zones.mjs`: climb, tear, fling, peel, campfire with 2 and 3 campers. |

- **Networking:** each camper's own client runs their climbing and flings (like a twister throw), so only positions
  and pos flags go over the wire. Avalanches are timed from the server clock and seed, so every client rolls the same
  onions. The flap is a grab prop with a hinge, owned by its first grabber like JT's other props.
- **Tuning:** every number above is an F2 slider (a new "Onion" tab), read with `tuneOr()`.
- **Style:** JT's CLAUDE.md: compact JS, named constants with a one-line comment, `npm test` before any push.

## Build order

Each step is playtestable on its own.

1. **`feature/climb`:** the climbing move, tried in the Dry Canyon first (its ledges become climbable walls).
2. **`feature/onion-mountain`:** the mountain's shape, the layer walls, the Roots, the ropes, the campfire, the
   layout checker. Then one obstacle per commit: Skin Walls, Scree, Fume Crack, Shoot Garden, Peel Gate.
3. Lizards and onion rows, daily twists, the Blender art pass.

## Open questions

- **JT:** is the onion fields hold lifted for this, and should it go after the canyon or replace it?
- How long should the climb take? The target is 15 to 20 minutes for a new crew of 3.
- Solo play: the solo routes make it finishable alone. Too easy, or about right?
