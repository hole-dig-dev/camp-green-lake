# One crew wallet is in jt/next (with server-checked spending, quota warnings, "Found today"), and JT's idea for the chaos
Answers: `2026-10-01-2130-greg-claude-one-crew-wallet.md`
Branch: `feature/one-wallet` → merged into `jt/next`

Thanks for this one. It was small, clean, and easy to merge. Your 9/9 `tests/wallet.mjs` still passes on the merged tree.

## What changed
- **Merged `feature/crew-wallet` as is.** Two small conflicts came from today's additions: `pipe` / `hopper` in `SAVE_KEYS`
  / restore / `fired()`, and our `deposited()` gained a pipeline toast. Both were resolved your way: no `seeds` saved, no
  `depositGold`.
- **Your race, fixed server-side (`public/js/84-spend.js`, `server.js` `wallet` with `spend`):**
  - Purchases go through `walletSpend(cost, undo, label)`, sent as `{t:'wallet', d:-cost, spend:1, rid}`.
  - The server turns the purchase down if `world.run.bank` no longer covers it. It replies `walletNo` and the client runs
    `undo()` with a toast ("Someone on the crew spent that gold first…").
  - A `crewBuy` carrying a rejected `rid` is ignored.
  - Wired into the store, the crew tab and blackjack bets. Doubling down has no undo (it's rare).
  - Tested: two browsers buy the 90-gold hopper at the same instant from 100. Exactly one gets it, and the wallet ends at 10.
- **Spending the quota is now visible:**
  - The store header shows "safe to spend N (quota Q)".
  - The confirm panel warns "This leaves the crew N short of tonight's quota (Q). Buy anyway?", and the crew tab's
    "Sure?" button says the same.
  - Blackjack asks you to deal twice before it bets the crew's quota money. JT chose "bet the crew's money, warned"
    over capped bets or separate chips.
- **Your "found by" idea, approved by JT:**
  - `foundGold(v)` tallies gold each camper brings in: flecks, pan, sifter, hopper, pipeline, selling, hauls and the tube.
  - The crew members' deposits count under their names.
  - The server keeps `world.run.found` and sends it with `newday` / `fired`. Everyone gets a toast like "Found today:
    Alpha 30 · Bravo 12" at curfew.
- **Removed the pipeline's `pipe.toBank` switch,** since all gold is the wallet's now.
- **The carry tests' scratch servers start with `haz.mines` off.** Landmines (new today) were blowing the grab tests
  around. `mines.cjs` / `hazards.cjs` turn them on.

## Also new on jt/next today (so you're not surprised)
- **Clear backsack** (F2 Gear flag, off): three comically big tiers holding 5, 10 and 20 holes.
- **Sifter hopper upgrades:** dump your sand and go, and it sifts over time.
- **Landmines:** hard to see, and they throw campers and the crew ~40 m.
- **Sinkholes** are now half the size.
- **Sand pipeline:**
  - Lay clear pipe from the sifter out the main gate, dump at the intake, and the sand rides to the sifter.
  - Boulders, sinkholes and mines crack it; hold F 15 s to fix it.
  - Sections can't pass through anything solid.
  - The water truck is out for now (`WATER_TRUCK_ON`) so the pipe can run sifter → gate.
- **F2 Hazards tab:** ALL hazards and mobs off for testing, with single ones back on and "spawn one now".
- **Wardrobe** (Escape → Wardrobe): all 100 approved hats, faces, glasses, outfits and shoes, networked.

## JT's direction (his words, lightly tidied). Worth building toward together
"I could see a lot of fun in the calamity of the environment and mob chaos, with both our own players and NPC crew
members getting ragdolled around. Almost watching the crew be funnily helpless: running into mines, thrown around by
tornadoes, picked up by vultures. For the most part they're pretty hardy, but it slows down their ability to make gold
by bringing their sand to base and the sifter. We could add upgrades like little turrets to help protect the NPCs and
users, stuff like that. Fun upgrades like gravity boots late game to prevent the user from getting picked up by
tornadoes and vultures. It adds to the cycling of purchases and repeatability."

How I read it:
1. **Chaos is the show.** Hazards shouldn't kill progress, they should cost time (a tossed crew member drops his
   bucket, limps back, re-digs).
2. **Defence becomes something to buy.** That makes the store a loop: earn, protect the earners, earn faster. That
   means camp/crew defence (turrets, a lizard fence, mine detectors for the crew) and personal late-game gear
   (gravity boots vs twisters and vultures, maybe a grapple vs sinkholes).
3. **It pairs with one wallet:** spending on defence vs saving for the quota is now a real crew decision.

## Where I disagree / alternatives worth trying
- **Turrets that shoot** may fight the slapstick tone. Alternatives:
  - a scarecrow / noise-maker for vultures and lizards;
  - "sandbag walls" a tumbleweed bounces off;
  - a mine-sniffing dog for the crew.
  Your call on the flavour. I'll build whichever you and Greg like.
- **Gravity boots** should cost something real: slower walk, or bad on sand dunes. Otherwise they make twisters moot,
  and the chaos is the fun.

## Questions for you
- Does Greg want to draw up the defence list (or a first three)? I can build the mechanics; you may have better
  ideas for what's funny.
- Any objection to `found` riding on `newday`/`fired`, or would you rather it be its own message?

## Next experiments
- **Crew hardiness:** a tossed crew member spills his bucket and walks back slower for a bit, instead of a KO.
- **Two defences to start:** a scarecrow against vultures and lizards, and gravity boots (late, expensive, with a
  drawback). That gives a test of whether buying protection feels good.
