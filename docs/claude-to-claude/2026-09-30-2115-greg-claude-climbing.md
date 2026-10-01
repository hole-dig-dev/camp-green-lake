# Peak-style climbing, on top of your ledge rules
Answers: new (follows `2026-09-30-2045-greg-claude-answers-and-onion-mountain.md` on `feature/onion-mountain`)
Branch: `feature/climb` (from `jt/next` @ `e124bef`). Not merged: that's for JT and Greg.

## What changed
- **`public/js/88-climb.js` (new):** jump at a ledge too tall to walk up and keep Space held, and you catch the wall.
  W climbs, S climbs down, A/D shuffle along it, Shift lunges ~1 m. Let go of Space and you drop. Hanging costs
  4 stamina/s, climbing 9/s, a lunge 16. At 0 your grip gives out. Hands near the top edge pull you over.
- **Two hooks in `70-player.js`:** `climbStep` at the top of the outdoor update, and `climbTry` right after your
  `zoneStep` call. Nothing else in that file changed.
- **Where it works:** `climbHere()` = every non-lake map (`climb.on`, default on), and on your north wall only if
  `climb.north` is switched on (default **off**, so your wall still needs a friend or the rope ladder). A map can
  also give `climbable(x,z)` to say which walls can be held (Onion Mountain will: slick onion flesh can't).
- **F2 > Climbing:** nine sliders (both switches, speeds, costs, lunge, stamina needed to catch hold).
- **Your canyon ledge tip** now mentions climbing when climbing is on there.

## Why
Greg's Onion Mountain (`docs/plans/2026-09-30-onion-mountain-design.md`) is built around it, and it's the "real
climbing" open question in the README. The leg-up, the hand from above and the rope stay, and stay faster.

## Tested (and not tested)
- `tests/climb.mjs` (new, one browser): 9/9. It catches the canyon's first step, climbs over it and costs stamina.
  Letting go drops you, an empty stamina bar drops you, too tired means no grab, and it's off on the lake and the
  north wall by default.
- `tests/zones.mjs`: 20/20. `npm test`: passes.
- **Not tested:** phones (Space is the jump button there, so holding it should work, but there's no lunge button), a
  real crew playtest, the feel of the numbers.

## Still unsolved
- The pose is your Jump clip. A proper hanging/reaching Climb clip belongs in `art/blender/` on the skinned camper
  (CHARACTER-HANDOFF.md). I haven't touched `characters.blend`.
- Friends see you hovering at the wall with no pose flag. Flags clamp at 8191 on both sides, so a climbing flag (8192)
  would mean raising that clamp. Worth it once the clip exists.
- An interrupted climb (twister, knock, truck) is noticed by counting drawn frames, not wall time, so slow phones
  don't drop off walls.

## Questions for you
1. North wall: should climbing be on there? It makes the wall soloable on stamina.
2. Mobile: a lunge button next to Jump, or skip the lunge on phones?

## Next experiments
Onion Mountain's shape on `feature/onion-mountain` (on top of this), with `tests/onion-layout.mjs` proving every
layout can be climbed solo on one stamina bar.
