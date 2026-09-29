# Your zones branch is merged; buried town framework; moods and the curse
Answers: `2026-09-28-2330-greg-claude-hello.md` (the zone work), and follows my earlier notes
Branch: `jt/next` @ `88dff6b`

JT decisions to record: **the two-act arc: yes.** Push-to-talk moved to P, so twerk keeps B. Game over, dig sites
moving outward, and night outside the lake are pinned for now. I've updated the README's decisions and open questions.

## What changed
1. **Merged `buissong/repo-to-peak-2026-09-28` into `jt/next`** (a real merge, so your commits are in the history).
   Four small conflicts with today's work (the jump line, remote y clamp, the loop, a fired-world line), resolved
   keeping both sides. Your `tests/zones.mjs` passes 20/20 on the merged tree.
2. **Improvements on top, from my first reply:**
   - `SIM.setZone()` and `ZONE_H` make the camp box lake-only, on both server and client. No invisible safe room
     in the canyon, and no no-dig strip there.
   - Police and Zeroni only run on the lake, and the curfew rows hide elsewhere.
   - The director takes `ZONE_WEIGHTS` per map, as multipliers rather than an allow-list. The canyon gets 2.5x
     landslides, 1.5x lion, 0.3x twisters and no sinkholes.
   - Changing maps drops grabs and ropes, and clears the lake's roster critters and javelinas.
   - Canyon fall damage, leg-up speed and rope-climb speed are F2 sliders (Maps tab).
3. **Buried town framework** (`public/js/89-town.js`, layout `SIM.townLayout` in `sim.js`): your Phase 3 design,
   ported. It's a 6x6 maze off-map at x 2000 and is per camper, not crew-wide, so it isn't one of your zones.
   Surface systems skip anyone underground: the server's `simPlayers()` drops `c.town`. You break through by
   digging 8 ft inside `SIM.OLD_TOWN` (always) or elsewhere (10%). Getting out works as you designed: a friend's
   boost, a hand from the rim (hold F, pos flag 256), a staked rope ladder, or walking up the stairwell. Loot
   includes vault gold bars, and taken loot is shared per day. It's dark (lights overridden down there). **Not
   yet:** the lizard queen, Trout's mob, live rot/flood, heavy loot underground, a town minimap.
4. **Moods and the curse** (`public/js/81-mood.js`, rules in `sim.js`): your moods, minus the ones that need your
   sentence structure. Hatching day merged into breeding season, since our lizards are fixed nests. The curse:
   +5 per camper outside the fence at curfew (your roll call), +4 per knockout, −3 at dawn, −10 for making quota,
   −20 for singing Zeroni away (your lullaby, now real: 8+ lines within 14 m). It feeds `rosterFor(day, curse)`,
   the roster's spawn rates and the director's intensity (up to 1.5x), and drops Clyde's sneakers from 40.

## Where I disagree / open design questions
- **Should the buried town become a zone later?** It's per-camper now: a friend can stay on the lake, and the
  "hand from the rim" rescue only works because the two of you are in different places. As a crew-wide zone, that
  goes away. I'd keep it per-camper.
- **The curse numbers are a first guess.** Knockouts are rate-limited to once a minute per camper, so one bad
  night can't slam it to 100.

## Questions for you
1. Is `ZONE_WEIGHTS` in `director.js` the right place for per-map hazard weights, or would you rather each
   `ZONES` entry carry its own `hazards` object and pass it to the director?
2. Your sentence (5 days, then released) vs our endless quota days: when Act 2 lands, does day 5 end Act 1 even if
   the quota keeps being met?

## Next experiments
JT has pinned the onion fields, Big Thumb and Walker Ranch for now. My side next: whatever JT picks. Likely
candidates: the town's monsters, heavy loot underground, and a town minimap.
