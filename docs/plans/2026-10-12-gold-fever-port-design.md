# Bring the best of Gold Fever into Camp Green Lake

Decided with JT, 2026-10-12. We stay on Camp Green Lake's map and code (`jt/next`) and rebuild the best of Greg's
Gold Fever prototype here, instead of moving the game onto Gold Fever's map.

## Approach

Rebuild, don't transplant. Each feature is rewritten as Camp Green Lake code: numbered global scripts in
`public/js/`, plus the server logic. Gold Fever (`origin/jt/gold-fever`, `gold-fever/`) is the reference for how
each feature behaves. Its ES modules, heightfield terrain and ~46 MB of assets do not come into `jt/next`.

Rejected:
- Gold Fever modules behind an adapter: two terrain models and two Three.js setups, and every bug becomes a
  question of which game it lives in.
- Switching Camp Green Lake to Gold Fever's terrain first: means redoing holes, liners, nav, sinkholes and
  landslides before any new equipment shows up.

## Phases

Each phase is its own `feature/<name>` branch, merged `--no-ff` into `jt/next` after `npm test` passes, then
play-tested by JT on :8445. Nothing goes to `main` without JT's OK.

1. **Animations.** Merge `feature/sol-scoop` (Sol's two-handed Scoop clip and first-person ScoopFP). Port the
   panning work from `feature/camper-characters`: the gold-pan sequence with the gold in the pan from the start.
2. **Wheelbarrow.** Physical hauling (safe loads, overloaded turns, brakes, teammate steadying, spills,
   tumbles). Built on the existing grab/rigid/ragdoll code. Tips into the hopper.
3. **Washers as sifter upgrades.** The sifter stays as the starting machine. Rocker, then sluice, then wash
   plant are bought from Pendanski with the crew wallet (`walletSpend`). Each processes faster and recovers more
   gold. The hopper and sand pipeline feed whichever one the crew owns. No water needed (dry lake).
4. **Excavator and dump truck.** Drivable, with Gold Fever's mouse-driven arm (stick fold on the wheel, hold
   left at the dirt and pull up to scoop). The bucket digs through the holes system, so scoops make big
   holes and trenches. Excavator loads the truck, and the truck tips into the hopper. Art from Sol's Blender pipeline, with
   Gold Fever's models as a starting point.
5. **Hydraulic rig.** Uses the same vehicle setup as phase 4.
6. **Real dirt.** The clods thrown by digging become actual counted pieces of dirt that land in the bucket,
   wheelbarrow or truck bed, and spill when knocked over. This needs its own design pass once phases 1-5 are in.

## Fit with what already exists

- Money: one crew wallet. Prices go through `walletSpend` and its tonight's-quota warning.
- Chaos: machines and loads should ragdoll and spill like everything else. Hazards stay under the F2 switches.
- Tuning: every new rate and capacity is a `tune()` knob in `TUNE_DEFS`.
- Greg: his branches stay untouched. Write a Claude-to-Claude note telling Greg's Claude we're bringing Gold Fever ideas into Camp Green Lake.
