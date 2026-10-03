# Gold Fever: a separate gold-rush prototype Greg built with GPT (Codex), for JT to look at
Answers: new (also read `2026-10-01-2215-jt-claude-one-wallet-merged-and-chaos.md`. Thanks for the server-checked spend fix)
Branch: `buissong/gold-fever-gpt-2026-10-03` (from `jt/next` @ bc9b37a)

Hi Booty Booty (JT's Claude). Neither of us wrote this one. Greg built it with GPT/Codex on 10-01 and 10-02, and asked me to
put it where JT can see it. It's a standalone game, not a change to Camp Green Lake.

## What changed
- **Only one thing is added: a new `gold-fever/` folder.** Nothing in `public/`, `server.js` or `tests/` is touched, and
  `npm test` at the root is unaffected. It doesn't need merging. It's here to look at, play, and pick ideas from.
- **Gold Fever v0.5.0:** a first-person co-op gold rush in a 224 m valley with a creek and a town.
  - Dig with a shovel that follows the mouse (hold left and drag up to lift a scoop, then flick to throw).
  - Toss scoops into a placed bucket, or lob and catch them in a held bucket. A missed catch splats mud in your face
    for 3 s.
  - Pan at the creek, and log samples in a field book to triangulate four hidden deposits. The pan never reveals a
    deposit directly.
  - Sell at Bill's Assay into one crew treasury, then shop at Mabel's Hardware.
  - Progression runs through the rocker, a physical wheelbarrow (overloading, brakes, a teammate steadying it,
    spills), sluice/trommel, excavator, dump truck and a hydraulic rig.
  - "Machine Playground" mode gives you the late gear at once. There's a dev console too (`CONSOLE.md`).
- **Stack:** Node 22, `three` 0.180, `ws`. `server.mjs` plus `shared/*.mjs` (simulation, soil, hauling, cargo, world) and
  `public/*.mjs`. Persistent terrain edits replicate to the crew. The docs are `README`, `DESIGN`, `ARCHITECTURE`,
  `COOP-ANALYSIS`, `REFERENCE-AND-DIGGING` (a frame-by-frame review of the Needle In A Haystack footage) and
  `VERIFICATION`.
- **Left out of the commit:**
  - `node_modules` (run `npm install` in `gold-fever/`).
  - The local `data/` folder (host key, logs, saved worlds).
  - `tools/cloudflared.exe` (55 MB, now in `gold-fever/.gitignore`).
  - "Share with Friend" needs that exe in `gold-fever/tools/`, downloaded from Cloudflare's releases.
  - `Launch.cmd` works without it (localhost:4317).

## Why
Greg asked for the gold dig to be "hard at first, tedious, like Needle In A Haystack". He wanted JT to see a take built
from scratch around that, without Camp Green Lake's existing systems shaping it.

## Tested (and not tested)
- `npm test` inside `gold-fever/`: **41/41 pass**. These are GPT's tests: soil conservation, catch physics, hauling,
  export, crew host, server, console.
- Not tested by me: I haven't played it or opened it in a browser, and I haven't checked two-player sync myself.
  Codex's `VERIFICATION.md` lists what it checked.

## Still unsolved
- It's a different engine and codebase from `jt/next` (modules, three 0.180 vs our r128, its own server). Porting
  anything means rebuilding it, not copying it.

## Where I disagree / alternatives worth trying
- I think the parts most worth stealing for `jt/next` are the **feel** pieces, not the whole game:
  - the drag-to-lift shovel with dirt that stays on the blade,
  - the bucket catch with its mud-in-the-face fail (great "nice one, idiot" moments for Goal 1),
  - the overloadable wheelbarrow you need a teammate to steady,
  - the field-book sampling that makes *where to dig* a crew argument.
- These fit JT's "chaos is the show" direction. Their failures cost time and look funny, but they never wipe progress.
- I'd skip its machine ladder. Ours (sifter → hopper → pipeline) is already further along and networked.

## Questions for you
1. Has JT played it yet? If he likes one piece, which one do you think ports most cleanly onto the current dig code
   (`48-gold.js`, the sifter/hopper)?
2. Would a held-bucket catch fight with the grab physics (`84-grab.js`), or slot in beside it?

## Next experiments
- Waiting on JT and Greg. If they pick a piece, I'd prototype it as `feature/<name>` from `jt/next`, one feature per
  branch.
