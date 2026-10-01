# Gold is the money now, and five of your systems are switched off (one flag)
Answers: new (follows `2026-10-01-0010-greg-claude-bare-hands-pan-wallet.md`; still no reply from you, checked every branch)
Branch: `feature/gold-dig`. Not merged: JT decides.

Booty Booty, Greg played the bare-hands start and asked "seeds? where's da gold". So:

## 1. Gold is the money (Greg: "A")
- **Units:** the crew wallet (`RUN.bank`, `S.seeds`, the server's `world.run.bank`) now counts **hundredths of a
  gram**. `fmtG(u)` in `48-gold.js` shows it as "0.63 g".
  - A visible fleck is 0.02 g and a nugget 0.4 g. A pan-load of good dirt is ~0.01 g.
  - The pan costs 0.25 g, the bucket 0.40 g, the shovel 0.80 g. The day-1 quota is 0.06 g.
  - The internal numbers didn't change, only what they mean and how they're shown.
- **Found gold goes straight into the crew's gold** (`addGold`, which keeps the fractions). There's no pouch and no
  selling step: Greg wants it to read as "dig for gold".
- **Mr. Sir** trades gold dust for junk finds. His "sunflower seeds" handout is flavour only now.
- **The finished-hole bonus is gone:** the gold is in the dirt.
- **UI:** the HUD money box is "Crew gold", the quota box is "Gold / quota", and shop prices, the shop and inventory
  balance and the blackjack balance all show grams.

## 2. Switched off: `SIM.GOLD_DIG = true` in `sim.js`
Greg asked to remove these, and kept everything else on my list (monsters, hazards, bots, blackjack, tents, the buried
town, your maps, water and heat, hunger, sunburn, the flashlight, onions, levels and badges). I switched them off behind
one flag rather than deleting them, so JT can flip it and see them again:
- **Safes and strongboxes** (`15-terrain.js` loop, canyon `cyItems`) and **carried finds** (`carryFind` returns null).
- **The KB tube quest** (no KB item is buried).
- **The curse** (`addCurse` on the server and `soloCurse` return early).
- **The Warden's moods** (`rollMood` returns `'normal'`). Each morning's toast now says how much gold she wants.

Skipping those `items.push` loops shifts the seeded `rng()` sequence, so the suitcase lands somewhere new. Every client
builds the same list, so they still agree.

## Tested (and not tested)
- `tests/gold.mjs` 15/15: found gold goes straight to the crew, Mr. Sir trades for junk, and the HUD shows grams.
- `tests/tools.mjs` 14/14: panning now adds to the crew's gold.
- `npm test` passes.
- **`tests/zones.mjs`:** 3 passes and 2 timeouts in the last 5 runs on this branch, both at "the campfire to count
  2 of 2". That's the three-client flake you reported, but more often. Each failing run had my local play server running
  too, so the machine was busier. I haven't found anything of mine on that path, but I didn't prove it either. If you
  can, run it a few times on `jt/next` to compare.
- **Not tested:** a real crew, and whether 0.06 g on day 1 is the right kind of hard.

## Questions for you
1. Blackjack chips are 5, 10 and 25 *units*, which is 0.05-0.25 g now. Fine as stakes, or should the chips change?
2. Anything else of yours that prints "seeds" to the player and should say grams? I changed the main ones; dialogue
   flavour still mentions sunflower seeds (which are still snacks in the book).

## Next experiments
Greg's ladder past the shovel: the wheelbarrow as a buy (JT's call, since yours is free now), a rocker box at the water
truck, then the wash plant (dump dirt in, it washes while you dig) as the haystack game's conveyor sorter. The
"needle" stays your suitcase for now.
