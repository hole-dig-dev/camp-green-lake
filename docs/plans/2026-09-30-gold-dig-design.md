# The gold dig: Camp Green Lake as a hard, tedious, first-person dig for gold

Proposed by Greg on September 30, 2026. Designed with Greg's Claude. **This is a pivot. It needs JT's say before any of
it goes on `jt/next`.** It lives on `feature/gold-dig`, branched from `jt/next` @ `5f8175f`.

## What Greg asked for
> "We are moving away from the Peak idea and from the Onion Mountain idea. Instead I want to expand upon the digging
> feature and make this into a hard challenging game."
>
> "Make the game first person and the shovel digging more realistic, with realistic shovelfuls, so it's a longer,
> tedious game. Realistic holes too."
>
> "The new game is digging for gold, but tediously. Think of the new Needle In A Haystack game, how it progresses, how
> it functions, how it's difficult at first."
>
> "Keep as much relevant stuff as possible from JT's current build."

The Peak escape and Onion Mountain are parked on `feature/climb` and `feature/onion-mountain`. Nothing there is merged
and nothing was deleted.

## The reference: *Needle In A Haystack Simulator*
Nas Nakarus / Studio Bitdot. It went viral in August 2026 and comes to Steam in Q4 2026. One to four players search a
haystack of about 4 million pieces for one needle, in first person. Along the way there are 34 kinds of lesser finds
that pay for tools: gloves, then a rake, a vacuum and a conveyor sorting line with sorter upgrades. It starts slow by hand
and becomes an operation. It has no deadline and no way to lose. **Greg wants ours hard,** so we keep JT's pressure: the
quota, getting fired, heat, water, lizards, curfew, the Warden.

## How it maps onto Camp Green Lake
| Needle In A Haystack | The gold dig |
|---|---|
| The haystack | The lake bed's dirt. Every shovelful is one "piece of hay", and most of it is just sand. |
| The needle | JT's existing big prizes: the suitcase marked STANLEY YELNATS (2.3 m down, wins the game) and Kate's KB tube. |
| Coins from lesser finds | Gold flakes and nuggets in the dirt, plus JT's existing buried finds. All sold to Mr. Sir toward the quota. |
| Gloves, rake, vacuum, conveyor | The tool ladder: bare hands, sifting screen, big-blade spade, long-handled shovel, metal detector. Later: gold pan or rocker box, wheelbarrow runs, auger, conveyor sifter (see "Next"). |
| Slow by hand at first | One 5-ft hole takes most of a day alone, and bare hands miss two thirds of the gold. |
| No way to lose | Kept from JT's game: the daily quota (miss it and you're fired), heat, thirst, lizards, curfew, the Warden. |

## Built in this first slice
1. **First person by default.** V still switches to third person. You see your own camper's dig animation.
2. **Real shovelfuls.**
   - A shovelful is 10 litres of dirt (F2 > Player, `dig.shovelful`) and takes 1.6 s to dig, lift and throw (`dig.time`).
   - It lowers the whole hole by its volume over the hole's area: about 6 mm.
   - A 5-ft hole is about 252 shovelfuls, roughly 7 minutes of solid digging alone.
   - The first shovelful comes out as soon as you start.
3. **Digging is work.**
   - Every shovelful costs 6 stamina (F2 > Stamina, `stam.dig`), and stamina doesn't come back while you keep digging.
   - With an empty bar no shovelful comes out, so you dig in bursts of about 16 and rest.
   - Stamina is capped by health, so a hurt, thirsty or sunburnt camper digs slower.
4. **Realistic holes.**
   - A hole is five feet across, as in the book: `HOLE_R` went from 1.25 to 0.85, giving a ~1.2 m flat floor and a
     ~1.7 m rim.
   - The spoil pile holds the dirt that came out, fluffed up by a quarter. For a 5-ft hole it's a 1.9 m-radius pile
     about 0.9 m high (`SPOIL_K`), and it grows with the hole.
5. **Gold in every shovelful** (`public/js/48-gold.js`):
   - **Paystreaks:** gold runs in winding old creek channels across the lake bed, plus some rich pockets.
     Nothing marks them; you find them by digging.
   - **Odds:** off a paystreak, about 1 shovelful in 170 has gold. Right on one at full depth, about 1 in 6. Deeper is
     richer.
   - **What comes up:** a flake (2 seeds), or now and then (3%) a nugget worth 20 flakes.
   - **Bare hands** spot about a third of it. The game tells you, now and then, about the glint you just lost.
   - **The sifting screen** (Supply Depot, 40 seeds) catches all of it.
   - **The pouch** shows next to the sack on the HUD, and Mr. Sir buys it toward the team quota.
6. **The spade** is now a big blade: shovelfuls are 50% bigger, so a hole takes a third fewer.
7. **The quota is retuned for real digging:** `(8 + 12 x day)` per camper, scaled for the crew as before. It was
   `(60 + 40 x day)`. Day 1 alone is 20 seeds. Bare hands on a paystreak make about 15-20 per hole, so day 1 means
   finding good ground. A screen roughly quintuples that.

Everything else in JT's build is unchanged: the lake, camp, Mr. Sir, the Warden, tents, monsters, hazards, grabbing,
carried finds, the buried town, the north wall, the zones, voice, walkies, and the store.

## Open questions (JT / Greg)
- **The quota numbers are a first guess.** They need a playtest. They're one line in `sim.js` (`quotaFor`).
- **Should missing the quota still fire you** (game over) now that a day is about one hole? Hard is what Greg asked for,
  but day 1 might want a grace day.
- **The pre-dug holes** (3,000 old 5-ft holes) are now realistic size too. Should old holes count as "already checked"
  dirt (no gold), so the crew has to break new ground?
- **What do the Peak pieces become?** JT's north wall and the canyon are still there. Do they stay as the ending, or go?

## Next (not built)
In order of how much they change the feel:
1. **Gold pan / rocker box at the water truck.** Carry dirt there in the wheelbarrow and wash it for fine gold that
   even the screen misses. That gives the wheelbarrow and water a job.
2. **Clues that narrow the haystack.** Finds and the Warden's moods point toward paystreaks and toward Kate's treasure.
3. **Cave-ins.** Dig too deep in loose sand without shoring and the walls slump back in.
4. **Bigger tools to buy as the crew earns:** a post-hole auger (fast and narrow), a hand-cranked conveyor sifter at a
   site, a mule cart.
5. **Shaped holes.** Each shovelful comes out where the blade goes in, so holes take whatever shape you dig them.
   This is a bigger change: holes become a fine depth grid, which touches the server, the liners, finds and the
   town breach.

## Tests
- `tests/gold.mjs` (new, browser, 14 checks):
  - you start in first person
  - one shovelful is a real shovelful (~6 mm), and a hole is about 252 of them
  - stamina cost, and no dig when empty
  - hole size and spoil pile
  - paystreak vs barren ground
  - bare hands vs the screen
  - Mr. Sir buys the gold
  - the shop and the day-1 quota
- `tests/smoke.mjs`: its dig check now digs with the old fast numbers through the sliders, because a few headless frames
  can't show a real shovelful.
