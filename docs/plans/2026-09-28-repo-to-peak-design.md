# From R.E.P.O. to Peak: a two-act sentence

Proposed by Greg on September 28, 2026. **Not approved by JT yet.**

## Goal

A run should feel like *R.E.P.O.* first (dig and haul loot for the Warden's quota) and then turn into *Peak* (a one-way escape across the lake to Big Thumb). It follows the book: Stanley digs for the Warden, then Zero runs off and Stanley follows him to Big Thumb.

The rule for all of this: **add, don't replace.** Everything on `jt/next` keeps working, and anything JT adds later (a new mob, a new hazard) shows up in the new parts automatically.

## Today

`jt/next` is already most of Act 1: the camp, the 1.2 km lake, the daily seed quota (miss it and the crew is fired and restarts), heavy loot and sacks (`84-coop.js`), curfew police and Madame Zeroni (`82-patrol.js`, `sim.js`), and the event director's hazards and monsters (`director.js`). What's missing is the escape: nothing takes you past the lake's edge, and nothing makes getting from A to B hard.

## Design

**Act 1: R.E.P.O., days 1 to 4 (short days)**

- JT's day loop as it is: dig, hit the quota, get back inside the fence before curfew.
- Dig sites reach farther out each day (the lake, then its edge, then Walker Ranch), so the crew has seen the edges of the world before Act 2 takes them past it.
- The fun is in the hauling: heavy, fragile loot that takes two people to carry and breaks if dropped. Greg's physics grab (the `claude/intense-change-1-test-2026-09-27-1829` branch) gets added onto JT's heavy loot, not built as a second loot system.
- Money from Act 1 buys Act 2 gear between days: canteens, rope, peaches.

**The turn: Zero runs away (day 5)**

Zero takes off across the lake and the crew follows. From here there's no going back to camp.

**Act 2: Peak, one run on day 5**

- Zones in a fixed order, some with a daily variant: 1. the lake's edge, 2. Walker Ranch or the ruins of old Green Lake, 3. onion fields or a dry canyon, 4. Big Thumb.
- **Getting there is the game.** The heat burns stamina and water. Things that go wrong (sunburn, thirst, a lizard bite, a twister) cut into your stamina bar until they're treated. You recover in the shade of a dug hole or with water, peaches or onions. Some obstacles need two people: human ladders, rope, a boost, a dug ramp or tunnel. Heavy loot slows you down and makes you thirsty.
- **Checkpoints, like *Peak*'s campfires:** the next zone only opens once the whole crew is there. That's where you rest, share food and water, and bring back friends who went down.
- **The danger from behind:** the Warden's search party, made up of JT's police, dogs and haboob.
- **Finale:** carry Zero up Big Thumb before the flood. The rain breaks the curse.
- **Ending:** go back to the lake at night and dig up Kate's suitcase, one last big grab with the Warden closing in.
- **Failing Act 2 ends the game.** The crew is caught and the sentence restarts from day 1.

**How the code fits JT's game**

- **A zone list** (`ZONES`), in the same style as `ENV` and the director's `REGISTRY`. Each zone says how to build it, where the crew arrives, where the exit is, and what's switched off there. JT's lake is the first entry, unchanged.
- **The whole crew is always in one zone.** The server holds one current zone. That's why JT's monsters, hazards, voice chat and networking need no changes: they just run on whichever map is loaded. Each zone reuses the same ±600 m local coordinates, so the edge limits in `sim.js` and `server.js` stay as they are.
- **JT's systems are on in every zone by default.** A zone can only switch things off (for example, no curfew police at the ranch). The one change to JT's code: an optional `zones` field on director entries, which defaults to "everywhere".
- **Only one zone is loaded at a time.** When the crew moves on, the old zone is cleared out of memory. The existing terrain streaming (full detail near you, less far away) carries over. Big Thumb stays on the horizon as the goal, and a cheap outline of the camp stays behind you.

## Build order

Each step is its own `feature/<name>` branch off `jt/next`, and each gets `npm test` before it's merged.

**Updated September 29.** JT's Claude ported grabbing, rope, the wheelbarrow, carrying downed friends and the
*Peak*-style stamina bar onto `jt/next`, so Act 1 now has its co-op verbs. What's left is the turn and Act 2:

1. ~~`feature/zones`~~: done (the zone list, campfire checkpoints, the Dry Canyon). Camp and curfew are lake-only as of `buissong/repo-to-peak-2026-09-29`.
2. **`feature/two-acts` (next, and the most important):** Zero runs and the escape starts. The sentence length is a lobby setting (2, 3 or 5 days, 2 for playtests), and Zero also runs early if the crew makes quota early, so every session reaches Act 2. A failed escape means game over and a restart.
3. **`feature/climb`:** the mantle (hang on a ledge, pull yourself up, stamina drains) and a booster who holds F. It replaces the jump-boost leg-up, and ropes share the same climbing state.
4. **What night means in Act 2:** reach the campfire before dark, with the search party behind you. JT decides.
5. `feature/zone-ranch`: Walker Ranch moved over from Greg's branch, using JT's grab physics.
6. `feature/zone-onions` and `feature/zone-thumb`, then the suitcase ending.
7. ~~`feature/grab-physics`~~ and ~~`feature/heat-stamina`~~: done by JT's Claude (`84-grab.js`, `70-player.js`).

## Open questions for JT

- What stays after a game over? Today, player levels survive a firing.
- ~~Where does the twerk emote go?~~ Solved: push-to-talk moved to P.
- What does night mean once the crew has left the lake?
- The "dig sites move outward" idea in Act 1 changes where people dig on the lake. Is that OK?
