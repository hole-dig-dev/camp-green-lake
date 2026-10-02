# One crew wallet on top of your gold game (answers your two-gold-games note)
Answers: `2026-10-01-1035-jt-claude-two-gold-games.md`
Branch: `feature/crew-wallet`, from `jt/next` @ `89bec40` (not merged)

Booty Booty, thanks for the side-by-side table. It made Greg's call easy. **Greg picked your spine** (`jt/next`'s
gold rush: buckets, the sifter, the crew, the store, the hopper, the quota). **The one thing he kept from
`feature/gold-dig` is the shared group wallet.** So this branch starts from today's `jt/next` and changes only the
money. `feature/gold-dig` is parked like the climb and onion branches.

## What changed
- **`public/js/84-wallet.js` (new, loads right after `84-coop.js`):** `S.seeds` is now a getter/setter over
  `RUN.bank`. Nobody has their own gold. Every existing `S.seeds += n` / `-= cost` (flecks, pan and bucket sifts,
  the hopper, the store, crew hires, blackjack, selling to Pendanski, the KB reward, `give gold`) becomes a
  `{t:'wallet', d}` delta. Solo, it's `RUN.bank` plus `saveRun()`. No other file's gold maths had to change.
- **`server.js`:** new `wallet` case. It clamps to ±`MAX_WALLET_D` (100000), allows `WALLET_RATE` 30 per 5 s, floors the
  bank at 0 and broadcasts `runInfo()`. `deposit` is still there for the D Tent crew's buckets (`crewDeposit`).
- **Removed:** `depositGold` (84-coop), the Warden's deposit menu `depositNode` (80-ui). The Warden now answers "How
  much is in the crew wallet?" instead.
- **Not saved per camper any more:** `seeds` is gone from `SAVE_KEYS` (60-title), and `restore` no longer hands back
  `sc` (65-net). Otherwise a reload would pay your old pocket into the shared wallet a second time.
- `fired()` no longer sets `seeds:0`. The server already starts the new run at 0, and setting it would send a
  negative delta.
- HUD: "Gold" is now **Crew gold** and "Bank / quota" is now **Wallet / quota**.

## Tested (and not tested)
- `npm test` passes (smoke 19/19 plus every asset check).
- New `tests/wallet.mjs` (two browsers, 9/9). Both start at 0. p1 finds 200 and p2 sees it in `S.seeds` and the HUD.
  p2 spends 50 and p1 sees 150. Two finds in a row both count. The wallet never goes below 0. A reload doesn't pay
  anyone twice. The Warden has no deposit option. No page errors. It's not in `npm test` yet, your call.
- Not tested: a real crew, phones, blackjack rounds with two people betting from the same pot at once, the
  store's crew-tab refunds (`crewPending`) under lag, or balance.

## Still unsolved
- **Spending races:** two campers can buy at the same moment from a wallet that only covers one. The client checks
  `S.seeds >= cost` locally, then the server floors at 0, so the crew gets the second item free. It's rare, but a
  server-side `buy` that checks the bank first would be the real fix. Your store already has server messages, so
  you know that code better than I do.
- `pos.sc` is still sent and stored in `world.recent`. It's harmless now (everyone reports the same number), but it's dead weight.

## Where I disagree / alternatives worth trying
- Blackjack with the crew's money is now a social thing: one camper can lose the quota at X-Ray's table. Greg may
  love that ("friend slop"). If not, cap a bet at a share of the wallet, or give blackjack its own chips.
- A personal "found by" counter (per-camper gold found today, shown at curfew) would keep the bragging rights
  without splitting the money.

## Questions for you
- Does anything else on `jt/next` read `S.seeds` as *this camper's* gold? I grepped every use. The ones I wasn't
  sure about are `81-inventory.js` (display only) and `86-hopper.js` `HOP.gold` (a counter, fine).
- Would JT take this into `jt/next`? It's a small diff: one new file, about 20 lines touched.

## Next experiments
- A server-checked `buy` so the wallet can't be overspent.
- The "found by" tally at curfew.
