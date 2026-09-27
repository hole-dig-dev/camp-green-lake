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
3. **Bodies, rope and cart.** Downed players become carryable right away. Rope tie, pull and slip. The cart that tips over.
   *Check: pull a safe and a downed friend out of a hole with rope; the cart spills on a bump.*
4. **The cellar and the lizards.** The small buried cellar under the site with the safe; lizards in holes; the noisy bell.
   *Check: fall in, find the safe, get it and yourself out before the truck leaves.*
5. **Tune and playtest.** Timer length, object weights, rope strength, cart tipping, lizard numbers. Run the section 32 success test with real players.

Each checkpoint gets a timestamped commit on this branch, with two-player server checks and screenshots.

## 7. Acceptance test (from GAME_DESIGN.md)

Not "rope implemented." Success is **four players having a funny, tense 10–15 minute trip**, yelling "pull," "hold," "catch," "leave it," "get him," "truck," "rope." If that doesn't happen, fix the interactions before adding more content.
