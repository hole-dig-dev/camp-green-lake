# Ported four of your systems onto jt/next
Answers: new (JT asked for these after playing your branches)
Branch: `jt/next` @ `1b31a7d`

JT played both your branches and wants a lot of it. First batch, the systems that don't need maps, is on `jt/next`
now. Credit to your branch in every file header. Where I changed your design, I say why, so push back.

## What changed
1. **Emotes** (`public/js/73-emotes.js`): twerk (B, fart + green cloud) and sing the lullaby (hold H). Posed on the
   Blender camper's bones on top of its animation clip. Server relays `emote`. **Push-to-talk moved from B to P** (JT's call).
2. **Stamina and afflictions** (`public/js/70-player.js`): your model (injury, heat, sunburn, poison, hunger eating
   the bar's max) folded into our health: `S.hp = 100 − afflictions`, so everything built on `S.hp` (vultures,
   reviving, the damage sliders) kept working. One Peak-style bar replaces the health bar. Sprint/jump/haul cost
   stamina. Peaches and Sploosh from your sack cure hunger (Eat button in the inventory); an onion helps a bit.
   Your rates are the defaults; every one is an F2 slider.
3. **The monster roster** (`stepRoster` in `public/sim.js`, drawn by `public/js/83-roster.js`): hatchlings,
   rattlesnakes, scorpions, Mr. Sir (takes an idle camper's sack), the Warden (KOs an idle camper), the Sheriff's
   ghost (hunts Kate's loot near curfew), Kate's ghost (only moves while nobody looks). **Your roster logic, but
   seeded by day only** (we don't have the curse or moods yet), and **our vultures replace yours** (ours dive, grab
   and carry). The dig swing squashes the small ones. Console: `roster [all|off|today|<kind>]`.
4. **Grabbing** (`public/js/84-grab.js`): your spring grab and constants (K 1400, damp 70, FMAX 700, snap 4.2,
   throw 7.5, damage MIN/RATE/COOL) on our safe (120 kg) and strongbox (60 kg). **Not cannon-es**: see below.

## Why no cannon-es
The lake is a heightfield with dug holes that only the clients can compute (`groundAt`), and the server never needed
the terrain. So I wrote point-mass physics against `groundAt` (gravity, springs, ground contact, friction, camp
colliders) and made it **owner-simulated**: the first grabber's page runs it and reports `pst` at 10 Hz, other
grabbers' hands go to the owner (`phand`). The holder gets zero-latency feel, which answers my own earlier worry
about 20 Hz server snapshots. Cost: no rotation physics (things sway, they don't tumble), no stacking.

## Tested
- Two browsers on the GPU: the strongbox lifts alone; the safe won't lift alone (it drags) and lifts with two; the
  other player sees it lifted, with a beam from each grabber; a throw goes about 14 m; a 3 m drop costs 9 of 80
  seeds; it sells at Mr. Sir's pickup.
- Roster: every kind spawned, and bites/strikes/stings land as poison. The Warden warned an idle camper and Kate
  got me when I looked away. Squashing works on the server.
- `npm test` passes.
- **Not tested:** real people over the Tailscale link, and phones.

## Still unsolved
- The only grabbable things on the lake are the safe and the strongbox, which are rare finds. Your ranch had 23
  valuables. **Question:** should some common finds (the jar of peaches, Sploosh) come out of the hole as fragile
  physical objects instead of sack items? That's where R.E.P.O. gets its comedy, but it changes the dig loop.
- No rope, cart or carrying a downed friend yet (next batch).
- The roster's day scaling assumes our quota days; the curse and moods don't exist on our side.

## Questions for you
1. Is owner-simulated physics OK with you for now, or do you think server authority with cannon matters for the
   ranch or the cellar (stacking, tumbling, lifting through the opening)?
2. Your Sheriff only spawns in the last 90 s before curfew. On a 9.5-minute day that's rare. Intended?
3. Should hatchlings hurt more (yours was 5 poison per bite) now that the poison bar recovers at 0.2/s?

## Next experiments
- Rope + cart + carrying downed friends (JT's next pick after this batch).
- Zones: merging your `buissong/repo-to-peak` branch (clean test merge, waiting on JT + Greg).
