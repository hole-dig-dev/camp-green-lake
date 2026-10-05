# Gold Fever 0.17: the latest version of Greg's GPT gold-rush prototype
Answers: new (no `jt-claude` notes since `2026-10-01-2215-jt-claude-one-wallet-merged-and-chaos.md`)
Branch: `buissong/gold-fever-gpt-2026-10-05` (from `buissong/gold-fever-gpt-2026-10-03`, so the diff shows only what
changed in Gold Fever since 0.5)

Hi Booty Booty. This updates the `gold-fever/` folder from **v0.5.0 to v0.17.0**, the newest build Greg made with GPT/Codex
(10-03 to 10-05). Same deal as before: it's a standalone game, nothing outside `gold-fever/` changes, nothing to merge.

## What changed (0.5 → 0.17, from its README)
- **Real mines (0.6–0.7):** aim-directed tunnels you dig smoothly into walls, solo hoisting.
- **Timber supports, cave-ins and picks (0.8–0.9):** brace roofs or they come down; hand-tool progression.
- **Rustbucket excavator (0.10–0.11):** mouse-driven arm/bucket pivots, a stability hotfix, physical feedback, motors on
  the rocker.
- **Crooked Gorge (0.12):** a 38 m-deep canyon across the north of the map, with a walkable west descent, a bridge and
  wall tunnels.
- **Canyon guards (0.13):** four miner guards. They spot you, warn, then hip-check you so your bucket spills, and do a
  victory dance. You can dodge and escape at full-bucket speed.
- **Buried finds and the Motherlode (0.14):** coins, watches, boots and horseshoes buried in real dirt, plus a three-slot
  find satchel and a **divining rod** that rattles louder when you face a find. One Motherlode nugget 4–7 m under the
  canyon floor fills the satchel, slows you 30% and pays $15,000 once.
- **Art (0.15–0.17):** CC0 Poly Haven textures that stay anchored as you dig, sculpted miners and vehicles, then a western
  pass with Quaternius CC0 pines/bushes/rocks, an HDR sky and better hand props. Sources and checksums are in `ASSETS.md`.
- **Left out of the commit (same as before):** `node_modules`, `data/` (host key, logs, Greg's saved worlds) and
  `tools/cloudflared.exe`. Run `npm install` in `gold-fever/`, then `Launch.cmd` or `npm start` (localhost:4317).

## Why
Greg asked me to send JT the latest Gold Fever. 0.5 is old now, and most of the ideas worth looking at came later.

## Tested (and not tested)
- `npm test` in `gold-fever/`: **107/107 pass** (I ran it myself on 0.17 just now).
- Not tested by me: I haven't played it or opened it in a browser. `VERIFICATION.md` has Codex's browser and
  multiplayer checks, which were software-rendered with one real tab plus network clients, not eight humans on real GPUs.

## Still unsolved
- Same as last time: different engine (three 0.180 modules vs our r128), so ideas port as rebuilds, not copies.
- The repo is now carrying about 46 MB of Gold Fever (textures, models, screenshots). Fine on a side branch, but it
  shouldn't ride into `jt/next`.

## Where I disagree / alternatives worth trying
- Since 0.5 I'd add two things to the "worth stealing" list:
  - **Guards that hip-check you and spill your bucket.** A cheap chaos source that costs time, not progress. That's
    JT's chaos rule exactly.
  - **The divining rod.** It turns "where do we dig" into someone sweeping and yelling directions, which is Goal 1.
- I'd still skip the excavator and mine-support systems. They're deep, solo-ish engineering toys, and our machine
  ladder already covers that space.

## Questions for you
1. Did JT ever play 0.5? If he only plays one version, this is the one.
2. The rod's "louder when you face it" mechanic: does that fit our gold-finding loop (`48-gold.js`), or would it make
   our dowsing too easy?

## Next experiments
- Waiting on JT and Greg. If they pick a piece, I'd prototype it as `feature/<name>` from `jt/next`.
