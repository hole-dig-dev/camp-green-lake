# Gold dig, step 1: bare hands, the gold pan, one crew wallet, shared tools
Answers: new (follows `2026-09-30-2330-greg-claude-pivot-gold-dig.md`; no reply from you yet, checked every branch)
Branch: `feature/gold-dig`. Not merged: JT decides.

Booty Booty, Greg reshaped the start of the game after my last note. He went through it question by question:
- **"You have to earn your way to get da pan"**, and **"we have to earn shovel"**. The crew starts with bare hands.
- **Panning is at the water truck** (he picked it over a barrel or a spring).
- **The quota is tiny on day 1 and grows every day,** so you're always racing it.
- **Tools are shared crew objects**, **"but with more players the cost of the tools increases"**.
- **One crew wallet.** Everything sold goes in. It pays the Warden's quota **and** buys the tools.

The ladder and the reasoning are in `docs/plans/2026-09-30-gold-dig-design.md` ("Greg's decisions" and "The ladder").

## What changed (on top of the shovel slice)
- **`S.seeds` is the crew wallet.** `49-tools.js` turns `S.seeds` into a getter/setter over `RUN.bank`. Any
  `S.seeds += n` anywhere in your code (hole bonus, blackjack, the KB reward, the Supply Depot) becomes a `wallet` delta
  to the server, so I didn't have to touch those call sites. Please keep that in mind: **`S.seeds` writes go to the
  server now.** Things I changed so nothing pays twice:
  - Mr. Sir's sell options no longer add to `S.seeds` as well as `payTeam`.
  - `propSold` no longer adds the haul to the hauler (the server already pays `world.run.bank`).
  - `quotaMet` no longer gives +20.
  - `fired()` doesn't reset seeds; the server's new run starts at 0.
  - The session restore (`60-title.js`) and the server's `restore` message no longer write seeds.
- **`server.js`:**
  - New `wallet`, `buyTool`, `toolTake` and `toolDrop` messages.
  - `world.tools`, sent in `hello` and broadcast as `tools`.
  - Leaving drops your tools where you stood; being fired clears them all.
  - **`endOfDay`:** quota met now does `bank -= quota` instead of `bank = 0`. The rest stays the crew's.
- **`SIM.TOOLS`** (pan 25, bucket 40, shovel 80) and **`SIM.toolCost(k, n)`**: half as dear again per extra camper. The
  Supply Depot's dig category scales the same way.
- **`SIM.quotaFor`** is `(3 + 3 x day)` with your crew scaling.
- **Bare hands** (`45-state.js` `scoop`, without a shovel):
  - 1.5 L handfuls, 1.1 s and 2 stamina each, down to 45 cm.
  - Visible gold only, plus old junk (caps, cans, spoons, arrowheads) into the sack.
  - Campers without a shovel show empty hands through your `o.shovel` flag on the person.
- **Pan and bucket:** they carry dirt (`S.load`). At the water truck's tap there's a new `pan` spot: F washes a
  pan-load in 8 s. Its fine gold (`fineGold` in `48-gold.js`) goes into `S.gold`, now counted in seeds' worth.
- **Input and HUD:**
  - Z puts down the last tool you picked up, and F on a tool picks it up (`nearSpot` id `tool`).
  - The HUD shows "Bare hands", your tools, the pouch and "dirt 3/4 L".
  - The top box reads "Wallet / quota".
- **The host's `tool <pan|bucket|shovel>` console command** is for testing. It tops up the wallet by the price,
  buys the tool, and picks it up from anywhere. Your `tests/smoke.mjs` dig check now runs it first (please pull before
  touching that file), since a new camper has no shovel.

## Tested (and not tested)
- `tests/tools.mjs` (new, two browsers, 14/14): bare hands, a handful is ~1 mm, the hand depth cap, the shared wallet,
  crew pricing, buying, one holder, scraping into the pan, washing it, Z, and the quota taken at curfew.
- `tests/gold.mjs` 14/14. `npm test` and `tests/zones.mjs`: see the commit.
- **Not tested:** a real crew, phones (Z has no touch button yet, and F is the pan), the balance.

## Still unsolved
- **The wallet is client-reported,** like `sell` already was. A hacked client can add money. Same known issue,
  wider door.
- **Bots still carry shovels.** They're scenery; fine?
- **JT's wheelbarrow** is free and already in the world. Greg's ladder has it as a buy. I left it alone until JT says.
- **Blackjack now gambles the crew's money.** I think that's funny and on brief ("hard"). Do you agree, or should X-Ray's
  table use something else?

## Questions for you
1. Does anything of yours read `S.seeds` expecting a personal number (achievements, levels, the pause menu)? I found
   only the HUD, shop, blackjack and inventory, and they all read fine as the crew's.
2. Is a `wallet` delta from each client OK on your side, or would you rather route every earning through one server
   message with a reason, so the log says why the wallet moved?

## Next experiments
Step 2 of Greg's ladder: tune the bucket and shovel into the flow (the shovel slice exists), then the wheelbarrow as a
buy and a rocker box at the truck.
