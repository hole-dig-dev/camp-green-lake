# Intense change #1: gap analysis and Phase 1 plan

Branch: `claude/intense-change-1-test-2026-09-27-1829`, built from `claude/holes-slop-2026-09-27-1338`. Read `GAME_DESIGN.md` first; this document answers its section 33.

Code today:
- `public/index.html`: the client, about 2,800 lines.
- `public/sim.js`: shared rules run by both the server and solo play.
- `server.js`: WebSocket server that runs `sim.js` 10 times a second.

---

## 1. What already exists and can be reused

| System | Where | How Phase 1 uses it |
|---|---|---|
| Multiplayer, shared rules, host-only admin | `server.js`, `sim.js` | As-is. The mission state becomes more server state. |
| Heavy loot as world objects (`PROPS`, `SIM.stepProps`) | `sim.js`, index.html "heavy loot" | Becomes the physical loot system. Already does 1 player drags slowly / 2 carry / wheelbarrow counts as help, which is exactly GAME_DESIGN section 20. Needs real physics added (see gaps). |
| Truck: model, driving, cargo bed, stuck-in-hole, push/dig-out | index.html "water truck", server `truck*` messages | Becomes the extraction truck. Mr. Sir drives it; loot counts only in the bed zone; players board it. |
| Downed → revive → out cold → body you carry home | `knockOut`, `downed`, `goOut`, `type:'body'` props | Matches Healthy → Downed → Lost. Change: a downed player is carryable immediately, not only after going out cold. |
| Stamina and afflictions | `updateStamina`, `AFF` | As-is. Carrying, pulling and climbing already cost stamina. |
| Digging, holes, cave-ins, stuck in deep holes, boost/pull-up | `scoop`, `addHole`, `caveIn`, `isTrapped`, `popOut` | As-is for basic digging. Pull-up becomes a rope action. |
| Buried town (rooms, shafts, human-ladder exits, rotten floors, floods) | `townLayout`, `enterTown`, `tryClimb` | The "one shallow underground area" for Phase 1 (a small cellar), and the base for Phase 2. |
| Monsters (shared roster, noise and loner targeting) | `stepMobs`, `stepZeroni` | Phase 1 needs one: lizards in holes (the "hole creature"). Others off in mission mode. |
| Quota, shared crew seeds, shop | `RUN`, `soloEndOfDay`, `SHOP` | Kept but simplified in Phase 1: mission payout goes into crew seeds. Quota cycles come in Phase 3. |
| Curse, moods, dig sites, lookout, badges, jumpsuits | various | Left running quietly or disabled in mission mode; revisited in Phases 3 and 5. |
| Onion fields, Big Thumb climb and finale | phase 4 code | Untouched until Phases 4 and 6. |
| Tests | scratchpad `mptest*.js` (67 checks), CDP screenshots | Extend with mission checks. |

## 2. What conflicts with the design

1. **One giant persistent open lake, dig anywhere** (the "Minecraft" problem, sections 15 and 31). Missions need a bounded site per trip, with a fresh state per trip.
2. **The shared real-time day/night clock drives everything** (curfew, 5-day sentence, earlier curfew each day). Missions need their own timer and the truck horn schedule (section 6) instead.
3. **Most loot goes into an inventory sack** ("pick up → +money", section 19). Only safes and strongboxes are physical. Phase 1 needs most valuable loot to be physical objects with weight, fragility and awkward shapes.
4. **No physics on objects.** Props slide toward carriers. They can't be dropped, thrown, caught, rolled into holes, broken or lifted by rope. This is the biggest gap: the comedy in sections 2 and 29 needs it.
5. **Selling happens at Mr. Sir's counter in camp.** In the design, loot counts only if it's on the truck when it leaves.
6. **The truck is player-rented and driven, with police chases.** In the design it's the extraction vehicle Mr. Sir parks at the site and drives away when time's up. The driving code stays (useful for later), but in mission mode the truck is NPC-driven.
7. **Personal levels give power perks** (dig speed, water, sack slots), against section 28. Leave for now; revisit in Phase 3.
8. **Failure is "missed daily quota → fired."** The design's key failure is **team wipe → sentence fails** (section 8). Phase 1 needs mission success and failure; the full sentence reset comes in Phase 3.
9. **Monsters mostly chase and knock you down.** That fits "disrupt logistics", but Phase 1 should use just one, tied to holes.
10. **About 20 keys and a big HUD.** Mission mode should show only what matters: the truck timer, loot on the truck, what you're holding.

## 3. Smallest viable Phase 1

**Hub**
- Camp stays the hub, with no digging and no monsters.
- A "Start mission" board at the Truck Yard (next to Mr. Sir's truck). The only site is **Lake Flats**.

**Trip**
- The crew boards; a short ride; the truck parks at a drop-off on a bounded site (about 150 × 150 m of the lake, marked with flags).
- Leaving the boundary shows a warning.
- The site gets a fresh set of holes each trip, from a mission seed.

**Timer (section 6)**
- About 8–10 minutes on the site.
- Distant horn at 3:00, engine starts at 1:00, repeated horn at 0:30, truck rolls slowly at 0:10, then it leaves.

**Physical loot**
- About 15 objects, mostly physical. A few small ones still go in pockets.

| Object | Weight | What makes it awkward | Value |
|---|---|---|---|
| Jar of Sploosh | Light, throwable | Fragile: breaks on hard landings | Low |
| Old bell | Medium | Rings while carried (noise draws lizards) | Medium |
| Antique mirror | Medium | Very fragile | High |
| Giant fossil | Heavy | Long: two carriers must line up | High |
| Kate's safe | Very heavy | 1 drags very slowly, 2 carry, 3 move quickly | Most of the payout |

**Physics (new, in `sim.js` so it works the same everywhere)**
- Objects have position, velocity, gravity, ground and hole collision, bounce and friction.
- **Drop:** a released object falls and settles, and can roll into holes.
- **Throw:** a carried light or medium object flies in an arc. With 2+ carriers, heavy objects can be heaved a short distance.
- **Catch:** a player near where a thrown object lands, facing it, catches it automatically.
- **Fragile:** a hard landing breaks the object (it loses most of its value, with a comic smash).
- **Hitting people:** a heavy object that lands on or rolls into a player knocks them down. ("The safe knocks someone unconscious.")

**Digging**
- Existing digging.
- Clue signs mark where treasure is (cracks, dirt mounds, the detector), not glowing markers.

**One shallow underground area**
- A small buried cellar (2–3 rooms, reusing the buried-town builder) under a cracked patch of the site.
- Dig through its roof and fall in. The best object (the safe) is down there.
- The only ways out are rope, a boost, or digging a ramp.

**Rope (a carried tool, 1 per crew to start)**
- Tie one end to an object or a downed player, and hold the other end.
- Walking away pulls it. Pulling from above lifts it up a hole wall.
- More pullers means faster and less chance of slipping.
- **Slips** when pullers run out of stamina or too few people are pulling something heavy: the load slides back down.

**Cart (the wheelbarrow, reworked as a physical object)**
- Holds 1–2 objects or a downed friend.
- One player pushes it. It **tips over** on bumps and at hole edges and spills everything.

**Players**
- A downed friend is immediately a carryable body (drag, carry, cart, rope, or throw onto the truck bed).
- If nobody gets them aboard, they're **lost** for this trip and come back next trip.

**Extraction**
- Loot counts only if it's **in the truck bed zone when the truck leaves**.
- Players count if they're aboard. Boarding means climbing up (F near the bed), or a friend pulling you aboard while it's rolling.

**One enemy**
- Yellow-spotted lizards in holes (the hole creature). Digging into a nest releases them.
- The ringing bell and loud players draw them.

**Result**
- A results card: loot extracted and its value (paid into crew seeds), who made it, who was lost.
- **Mission failed** if nobody made it aboard.
- Back at the hub.

## 4. Files needing major changes

| File | Changes |
|---|---|
| `public/sim.js` | Object physics step, rope constraints, cart, mission timer and horn schedule, extraction check, mission loot generation |
| `server.js` | Mission state machine (hub → trip → results), per-trip world (holes and props reset), physics authority, new messages (grab, throw, rope, board) |
| `public/index.html` | Hub/mission modes, mission HUD, physics prop rendering and interpolation, throw and catch input, rope drawing, cart, boarding, results card; a mission-mode switch that turns off systems not used yet |
| `GAME_DESIGN.md`, `docs/PHASE1_PLAN.md` | Design reference and this plan |

## 5. Don't touch yet

- Quota cycles, the 5-day sentence, sentence reset and site unlocking (Phase 3). The existing sentence code stays but is bypassed in mission mode.
- Ghost Town, Onion Canyon, the Big Thumb finale (Phases 4 and 6).
- The curse, moods, the full monster roster, the lookout (Phase 5; off in mission mode).
- The shop and levels overhaul (Phase 3).
- The police chase and player-driven truck (kept in code, not used in missions).
- Combining with jt's `jt/next` (the planned get-together).

## 6. Implementation plan (playable checkpoints)

1. ✅ **Done (checkpoint 1).** **Mission loop, no new physics yet.** Hub board → board the truck → Lake Flats site with a boundary → timer and horn schedule → truck leaves → results → back to hub. Existing loot and props; payout counts only for what's in the truck bed.
   *Check: a full trip works solo and with 2 test players; left-behind players are lost; nobody aboard = mission failed.*
2. ✅ **Done (checkpoint 2).** **Physical loot.** The physics step in `sim.js`; drop, throw, catch, fragile breaks, heavy objects knocking players down; the 5 object types.
   *Check: throw a jar to a friend, a missed catch smashes it, a dropped safe rolls into a hole.*
3. ✅ **Done (checkpoint 3).** **Bodies, rope and cart.** Downed players become carryable right away. Rope tie, pull and slip. The cart that tips over.
   *Check: pull a safe and a downed friend out of a hole with rope; the cart spills on a bump.*
4. ✅ **Done (checkpoint 4, at Walker Ranch).** **The cellar and the lizards.** The small buried cellar under the site with the safe; lizards in holes; the noisy bell.
   *Check: fall in, find the safe, get it and yourself out before the truck leaves.*
5. **Tune and playtest.** Timer length, object weights, rope strength, cart tipping, lizard numbers. Run the section 32 success test with real players.

Each checkpoint gets a timestamped commit on this branch, with two-player server checks and screenshots.

## 7. Acceptance test (from GAME_DESIGN.md)

Not "rope implemented." Success is **four players having a funny, tense 10–15 minute trip**, yelling "pull," "hold," "catch," "leave it," "get him," "truck," "rope." If that doesn't happen, fix the interactions before adding more content.

## Physics feel test (2026-09-27) ✅
After playtest feedback (carrying felt clunky, trips felt empty), trips now go to one small, dense site: **Walker Ranch** (x=3000, off the lake map).
- `public/phys.js`: shared cannon-es world (house with a narrow inner doorway, furniture, a yard, and a truck with a flat bed). It has 12 valuables with mass, value and fragility.
- **Grabbing (R.E.P.O. style):** aim with the crosshair and hold the left button. The object hangs from your hand on a spring (FMAX 700 N per camper). The scroll wheel moves it closer or farther; right-click throws.
  - The 120 kg safe needs 2 campers to lift; the 190 kg piano needs 3. Alone you can only drag them.
- **Damage:** every hard bump costs value, shown as a red "-N" popup.
- **Payout:** what's resting in the truck bed when it leaves is paid out.
- **Solo vs. online:**
  - Solo runs the physics in the page (cannon-es from the CDN).
  - Online, the server runs it at 60 Hz and sends snapshots at 20 Hz (`pw`, `pwinit`, `pwend`, `pdmg`, `pring`, `pslip`, `pheld`).
  - Clients send `pgrab`, `phold`, `prelease` and `pyeet`.
- **Other changes:** trips are 6 minutes, and the ranch is first person.

**Known gaps:**
- The minimap still shows camp.
- The key hint bar still mentions digging.
- The camp hub is still open lake.

## Missions only (2026-09-27) ✅
The open lake is no longer part of the game. Camp is a small fenced hub (x -40..30, z 27..56) with no digging, and the only way out is the truck (TRIP BOARD). Digging now happens on the trips: 6 dirt mounds in the ranch yard (seeded, different every trip) each hide a valuable (tin of coins, fossil, gold KB tube, 45 kg buried chest). Hold click or E at a mound for 4 shovelfuls and it pops out as a physics object (`pdig` / `pdug`). The minimap switches to a ranch close-up (house, truck, mounds, loot), and the key hints change at the ranch.

## Guard dogs, the barn, more loot (2026-09-27) ✅
- **Barn** (12 x 14 m, west of the house): wide door facing the house, packed hay under a hayloft (2.7 m up), a railed ramp up the north wall. `PHYS.floorAt` gives the walkable height; ranch colliders carry a `top` so you can walk over the hay once you are up there. Dogs cannot climb the ramp (the loft is a refuge, but loot up there has to come down).
- **Loot:** 23 pieces (was 12). House: china, painting. Barn: saddle, lantern, anvil (95 kg, 2 campers), 2 milk cans. Loft: eggs (very fragile), jackalope trophy, gramophone, hope chest (40 kg).
- **Guard dogs** (`stepDogs` in phys.js; 1 solo, 2 for a crew): asleep at first (snoring). Noise wakes them (bumps and breakage, the bell, digging, sprinting). They route through doors (yard, house rooms, barn), chase at 5.8 m/s (sprint is faster, carrying is slower), bite (drop your grab, stun, knockback; 3 bites in 40 s = knocked out), then back off. **Fetch:** throw something near a dog and it chases it; light things (6 kg or less) get carried back to its bed. Crouching shrinks what they notice. Messages: `pbite`, `pbark`, dogs in `pw.d`.

## Checkpoint 4: the storm cellar and the lizards (2026-09-28) ✅
The Lake Flats cellar from section 3, rebuilt for Walker Ranch.
- **Storm cellar** (`PHYS.CELLAR`: 6 x 6.5 m, 3 m down, in the yard east of the house at ranch x 13..19, z -15.5..-9). The yard ground is now 4 slabs around a 2.4 x 3.6 m opening; the old infinite ground plane sits at the cellar floor.
  - **The clue:** boards half-buried under the dirt, with cracks around them.
  - **Opening it:** 6 shovelfuls through the boards and they give way (`pcel {a:'open'}`). Anyone standing on them drops in; loot sitting on them falls and takes damage.
- **Down there:** Kate Barlow's safe (100 kg, 450 seeds, needs 2 campers to lift), 2 jars of spiced peaches on a shelf, a lantern, and a lizard nest (2 lizards, asleep).
- **Getting out:**
  - **Pulled up:** a friend at the edge presses F (`pull`). You have to be standing under the opening.
  - **Dirt ramp:** dig 14 shovelfuls under the opening (`pcel {a:'ramp'}`, all diggers' shovelfuls add up). When it's done there's a walkable, physical 40° ramp.
  - No climbing out with Space here. After falling in you have to let go of dig before you can start the ramp, so you don't start digging by accident.
- **Getting loot out:** 2 campers below heave the safe up through the opening (1 can't), and the ones up top grab it. Or finish the ramp and drag it up (2 campers; 3 is easy).
- **Yellow-spotted lizards** (`stepLiz` in phys.js):
  - **Where:** the cellar nest, plus one of the 7 dirt mounds, which is a nest (little burrow holes are the clue). Digging that mound releases 2 lizards instead of treasure.
  - **Waking and hunting:** asleep until noise wakes them, then they go and find it. Sleeping cellar lizards only wake for noise down there, or for the bell through the opening.
  - **Chasing and biting:** they chase what they see at 4.9 m/s (faster than walking, slower than sprinting). One bite knocks you out, then the lizard goes back to its nest.
  - **Climbing:** they climb in and out through the opening.
  - **Stunning:** hit one with something thrown or dropped (over 2.2 m/s) and it's stunned for 6 s.
  - **Messages:** `plbite`, `phiss`, `pstun`, `pnest`; lizards in `pw.l`.
- **Noise rules:**
  - **Digging:** crouched digging is quiet (radius 5 instead of 13). That's the solo way out of the cellar: crouch and dig the ramp without waking the nest.
  - **The bell:** it rings while it's being carried around (radius 40), not only when it bumps into things.
- **Dogs:** they don't go into the cellar, don't see or bite through the ground, and walk around the open hole.
- **Known gaps:**
  - A body carried under the cellar ceiling looks like it's on the ground above to people up top.
  - The ramp can be stepped onto from its side under the ceiling.
