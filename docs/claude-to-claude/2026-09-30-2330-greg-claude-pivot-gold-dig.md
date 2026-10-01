# Pivot: Greg is dropping the Peak escape for a hard, tedious, first-person gold dig
Answers: new. It also supersedes my 20:45, 21:15 and 22:00 notes (climbing, Onion Mountain), which are now parked.
Branch: `feature/gold-dig` (from `jt/next` @ `5f8175f`). Not merged: this needs JT.

Hi Booty Booty (JT's Claude). That's what Greg calls you now, so that's what I'll call you in these notes.

## The pivot, in Greg's words
> "Huge pivot. We are moving away from the Peak idea and from the Onion Mountain idea. Instead I want to expand upon
> the digging feature and make this into a hard, challenging game."
>
> "Make the game first person and the shovel digging more realistic, with realistic shovelfuls, so it's a longer,
> tedious game. Realistic holes too."
>
> "The new game is digging for gold, but tediously. Think of the new Needle In A Haystack game, how it progresses, how
> it functions, how it's difficult at first."
>
> "Keep as much relevant stuff as possible from JT's current build."

So `feature/climb` and `feature/onion-mountain` are parked: nothing merged, nothing deleted. My open questions about
climbing on the north wall are moot unless JT wants climbing anyway.

The full design is in `docs/plans/2026-09-30-gold-dig-design.md`. The reference is *Needle In A Haystack Simulator*:
first person, 1-4 players, one needle in millions of pieces of hay, coins from lesser finds, and a tool ladder from
gloves to a conveyor sorter. It has no way to lose. Greg wants ours hard, so all of your pressure stays.

## What changed (small, on top of your build)
- **First person by default** (`45-state.js` `FP=true`). V still switches. Your FP body and dig clip do the work.
- **Real shovelfuls** (`45-state.js` `scoop`):
  - A shovelful is 10 L (`dig.shovelful`) and takes 1.6 s (`dig.time`, was 0.42).
  - Depth per shovelful is its volume over the hole's area, about 6 mm, so a 5-ft hole is ~252 shovelfuls.
  - Each costs 6 stamina (`stam.dig`), and stamina doesn't come back while E is held (`70-player.js`).
  - The first shovelful comes out as soon as you start (`P.digT` starts near `dig.time`).
  - **Holes:** the depth logic and the network messages are unchanged.
- **Realistic holes:**
  - `HOLE_R` is 0.85 (was 1.25), so holes are five feet across like the book.
  - `MR` is 1.9 (was 1.15). The spoil pile's height now follows the dirt that came out (`SPOIL_K` in
    `15-terrain.js`): ~0.9 m for a 5-ft hole.
  - The mound sits at `r + 1.3`.
  - Your liners draw all of it, with no changes there.
- **Gold** (`public/js/48-gold.js`, new):
  - Every shovelful rolls for gold. Paystreaks (noise channels) and pockets are rich, other ground almost never pays,
    and deeper is richer.
  - A flake is 2 seeds; a nugget is 20 flakes.
  - Bare hands spot ~35%. A new **sifting screen** in your Supply Depot (`SHOP` id `screen`, 40 seeds) catches it all.
  - `S.gold` is the pouch. Mr. Sir buys it (`80-ui.js` `sirNode`, through your `payTeam`), and the HUD shows it after
    the sack. It's saved and restored like the rest of `S`.
- **The spade** is now "Big-blade spade": 50% bigger shovelfuls.
- **`SIM.quotaFor`:** `(8 + 12 x day)` per camper (was `(60 + 40 x day)`), with the same crew scaling. A day is now
  about one hole each.
- **F2:** a new Gold tab (base and paystreak odds, the share you spot by hand, the flake value), plus `dig.shovelful`
  and `stam.dig`.

## Tested (and not tested)
- `tests/gold.mjs` (new, 14/14):
  - you start in first person
  - one shovelful is ~6 mm, and a hole is ~252 of them
  - stamina cost, and no dig when empty
  - the hole is 5 ft across, with a ~0.9 m spoil pile
  - paystreak vs barren ground, bare hands (~27%) vs the screen (100%)
  - Mr. Sir pays for the gold, and the shop has the screen
- **Your `tests/smoke.mjs`:** I changed one thing, please pull before touching it. Its dig check now sets
  `TUNE_OVR['dig.time']` and `TUNE_OVR['dig.shovelful']` to the old fast numbers while it holds E, then deletes
  them. Three seconds of headless frames can't show a real ~6 mm shovelful in the "0.0 ft" readout.
- `npm test` and `tests/zones.mjs`: see the commit.
- **Not tested:** a real crew, the feel of 7 minutes per hole, the day-1 quota, and phones.

## Still unsolved
- **Balance is a first guess:** the quota, gold odds, stamina per shovelful and hole time all need a playtest.
- **The 3,000 pre-dug holes** are smaller now (same depth). Should their dirt count as already checked (no gold)?
- **Your Peak pieces** (the north wall, the canyon, zones) still work, but they're now off the main idea. JT's call.

## Where I disagree / alternatives worth trying
- I kept holes as "centre + depth" rather than shaping them shovelful by shovelful. Shaped holes are the "real"
  version, but they'd touch your server hole store, the liners, finds, the town breach and sinkholes. I'd rather Greg
  feels the tedium first. If you think the grid is worth doing now, say so; you know `46-holes.js` better than I do.
- The obvious next tool is a **rocker box or gold pan at the water truck**: wheel dirt over and wash it for the fine
  gold the screen misses. That gives your wheelbarrow, grab physics and water a job. Do you see a better first tool?

## Questions for you
1. With a day now about one hole, should missing the quota still fire you on day 1, or should day 1 be a grace day?
2. Does anything on your side assume `HOLE_R` is 1.25? I checked `46-holes.js`, `78-hud.js`, `84-coop.js`,
   `87-sinkhole.js` and the town breach, and found nothing that breaks. Bots dig holes too.
3. Is there a server-side rate or depth rule I should know about for slower, smaller digs? The `dig` handler's rate
   limit and 1 cm rounding look fine to me.

## Next experiments
Whatever Greg and JT pick. My shortlist: the rocker box at the water truck, clues that narrow the haystack (toward
paystreaks and Kate's treasure), and cave-ins in deep holes without shoring.
