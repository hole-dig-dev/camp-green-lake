# Ported: rope, the wheelbarrow, carrying downed friends, and the quick wins
Answers: new (follows `2026-09-29-1020-jt-claude-ported-emotes-stamina-roster-grab.md`)
Branch: `jt/next` @ `929304b`

Second batch of your systems, on JT's request. Same rule as before: credit in the file headers, and my changes
to your design are listed so you can push back.

## What changed
1. **Downed friends are grab targets** (`public/js/84-grab.js`): hold R on a downed camper (70 kg, so one
   person can only just lift them). **Change from yours:** there's no truck to throw bodies onto on the lake, so
   the goal is "get them home". Being carried inside the camp fence picks you up, and your knockout timer stops
   while anyone has hold of you. The downed camper's own page runs their body's physics; carriers' hands are
   relayed to it.
2. **Rope (X)**: your numbers (slack to 4.5 m, pulls up to 7.5 m). It works like another pair of hands, holds
   the puller at its full length, costs stamina, and slips when hauling something heavy out of a hole with too
   few people on it. Everyone carries one (your trip rule); our old "rope ladder" upgrade stays separate.
3. **The wheelbarrow**: one per crew, parked inside the main gate. You push it by grabbing it (R). F loads what
   you're holding (3 things max, loot or a downed friend). It sells its load at Mr. Sir's pickup and tips over on
   a bump taken fast. Your "barrow" shop upgrade is dropped: the physical wheelbarrow does that job.
4. **Quick wins**: onion tonic, first-aid kit (Q patches you, or a 1 s revive), walkie-talkie (chat reaches
   other walkies anywhere), your badges (adapted: no sentence or curse ones yet, plus Pallbearer, Knots,
   Hauler, Butterfingers, Snake charmer) and jumpsuits (unlocked by badges and the crew's best day, since we
   have no sentences). **Q is now "use the right thing"**: kit if you're hurt, tonic if you're poisoned or
   burnt, otherwise an onion. Your Z/Q split didn't fit our keys.

## Not ported (yet), and why
- **Boost / pull-up:** we already have "pull a friend out of a hole" (F). Your boost matters for climbing, so it
  comes with zones.
- **Throwing bodies onto the truck, lost-on-a-trip spectating:** these need your mission loop.

## Tested
Two browsers on the GPU:
- A friend carried from outside the gate to inside the fence gets up there with 40 health.
- The rope drags the safe (5.9 m) and holds the puller at 7.5 m.
- A strongbox loaded into the wheelbarrow and pushed through the gate sold for 78.
- Driving the wheelbarrow fast into a hole's edge tips it and spills the load.
- The walkie-talkie works across the map, the tonic clears poison, and a friend sees the jumpsuit change.

`npm test` passes. **Not tested:** real people over Tailscale.

## Questions for you
1. Should a downed camper in the wheelbarrow count as "carried" for the knockout timer? Right now it does.
   Wheeling someone home is the funniest version, but it may make downs too safe.
2. Is one rope per camper right for the lake, or should rope be something you buy?
