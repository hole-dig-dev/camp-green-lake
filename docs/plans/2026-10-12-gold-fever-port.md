# Gold Fever Port Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring Gold Fever's best parts into Camp Green Lake one phase at a time (design:
`docs/plans/2026-10-12-gold-fever-port-design.md`). This plan details Phase 1 (animations). Phases 2-6 are outlined
and each gets its own detailed plan when it starts.

**Architecture:** Camp Green Lake client = numbered global scripts in `public/js/` (global `T` = THREE), server =
`server.js` (ws, port 4301 for the test server). Third-person and first-person both play the camper's own clips:
first person hides the body on `FP_HIDE_LAYER` and keeps the hands and shovel (`fpBody`, `public/js/70-player.js:110`).
Digging is a timer loop: `P.digPh` runs 0 to 1 every `tune('dig.time')` seconds and `scoop()` fires on the wrap
(`public/js/70-player.js:64`). Remote players get the same phase over the network and go through
`animModel(p,mode,dt,digPhase)` (`public/js/25-people.js:200`).

**Tech stack:** Three.js (vendored, global), Node + ws, Blender exports (`public/models/*.glb`), `npm test`
(node asserts + headless smoke).

**Rules (every phase):**
- Work in `~/cgl-wt/integration`. Never resolve conflicts in `~/camp-green-lake`, because the test server serves it from disk.
- `feature/<name>` branch → `git merge --no-ff` onto a detached `origin/jt/next` → `if npm test; then git push origin HEAD:jt/next; fi` →
  then push the feature branch (jt/next first, or the branch watcher races you).
- After a push: `cd ~/camp-green-lake && git pull --ff-only` (the watcher usually does it within 2 min), and
  `pm2 restart camp-green-lake-test` if the push changed `server.js`.
- Headless browser checks use the iGPU: `sg render -c "..."` + `--use-gl=angle --use-angle=vulkan
  --enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan --ignore-gpu-blocklist`.
- Nothing goes to `main` without JT's OK.

---

## Phase 1: Animations

What already exists: Sol's `feature/sol-scoop` (3 commits on top of `08f27bb`, which is in `jt/next`) adds the `Scoop`
clip to `public/models/camper.glb`, plus `public/models/camper-fp.glb` (ScoopFP), Blender scripts, review renders and
two asset tests. The gold-pan sequence (`public/js/89-goldfx.js`, gold in the pan from the start via
`fix/playtest-2`) is already Camp Green Lake code, so `feature/camper-characters` holds nothing more to port. Only its
*timing* idea is worth copying: Scoop's phase times `{planted:.267, levered:.533, loaded:.833, tossed:1.167, end:1.5}`.

### Task 1: Merge Sol's Scoop assets

**Files:** merged from `origin/feature/sol-scoop` (`public/models/camper.glb`, `public/models/camper-fp.glb`,
`tests/camper-rig.mjs`, `tests/camper-scoop.cjs`, `tests/camper-scoopfp.cjs`, `package.json`, `blender/*`, `art/blender/*`)

**Step 1:** `cd ~/cgl-wt/integration && git fetch -q && git switch -c feature/scoop-anim origin/jt/next && git branch --unset-upstream`
**Step 2:** `git merge --no-ff origin/feature/sol-scoop -m "Merge feature/sol-scoop: Sol's two-handed Scoop + ScoopFP clips"`
Expected: no conflicts (only additions plus the camper.glb, package.json and camper-rig changes).
**Step 3:** `npm test`. Expected: PASS, including "all 14 clips OK" and the two scoop asset tests.
**Step 4:** Nothing uses Scoop yet, so the game looks unchanged. Don't push yet.

### Task 2: Play Scoop instead of Dig, synced to the scoop timer

**Files:** Modify `public/js/25-people.js` (around line 208, `animModel`; line 217, model URL cache-bust).

The Dig clip is driven by `digPhase*duration`. Scoop plants, levers and lifts (0 to 0.833 s), then tosses and
recovers (0.833 to 1.5 s). `scoop()` fires when `digPh` wraps to 0, and clods fly `CLOD_DELAY` (0.18 s) later
(`46-holes.js:155`). So the wrap has to land on the start of the toss: phase 0 → 0.833 s, and phase rising
through the cycle → wrap through end → 0 → back to 0.833.

**Step 1: Write the change**

```js
// 25-people.js, next to MODE_CLIP
const SCOOP_LOADED=0.833,SCOOP_END=1.5;   // Sol's Scoop (blender/cgl_rig.py SCOOP_TIMES): lifted at 0.833 s, toss + recover to 1.5 s
// the game's scoop() fires as digPhase wraps, so phase 0 = the loaded pose: the toss plays right as the dirt flies
function scoopTime(ph){return(SCOOP_LOADED+clamp(ph||0,0,0.999)*SCOOP_END)%SCOOP_END}
```

In `animModel`, pick Scoop when the model has it:

```js
let name=MODE_CLIP[mode]||'Idle';
if(name==='Dig'&&p.acts.Scoop)name='Scoop';
setClip(p,name);
const a=p.acts[name];
if(a&&name==='Scoop'){a.timeScale=0;a.time=scoopTime(digPhase)}
else if(a&&name==='Dig'){a.timeScale=0;a.time=clamp(digPhase||0,0,0.999)*a.getClip().duration}   /* scoops stay in sync with the game's dig timer */
```

Bump `models/camper.glb?v=7` → `?v=8` so browsers fetch the new clip.

**Step 2:** `grep -n "acts\[" public/js/*.js | grep -v 25-people` checks that nothing else assumes `p.cur==='Dig'`.
Fix any hit (e.g. checks for `'Dig'` should accept `'Scoop'`).
**Step 3:** `npm test`. Expected: PASS.
**Step 4: Look at it.** Run a spectator recording (`?spectate`, `SPEC.follow('<name>',{r:4,h:1.6,spin:0.3})`,
recorder pattern from `tests/carry`) of a camper digging, third person. Check: the blade goes in, levers, lifts,
the toss lines up with the clods leaving the shovel, and there's no pop at the wrap.
If the toss looks early or late, adjust `SCOOP_LOADED` (or move it to a `tune('dig.scoopOffset')` knob).
**Step 5: Commit**

```bash
git add public/js/25-people.js
git commit -m "Campers dig with Sol's two-handed Scoop, the toss timed to the scoop's dirt throw"
```

### Task 3: First person check (body hands vs ScoopFP)

First person already shows your own hands and shovel playing the same clip (`fpBody`), so after Task 2 first
person shows Scoop automatically. In Gold Fever JT approved the separate camera-space ScoopFP viewmodel
(`camper-fp.glb`), because the body's hands framed badly there.

**Step 1:** Record first person while digging (spectate can't do FP; use a scripted player via `tests/carry/run.sh`
or console `v`) and send JT the clip next to Gold Fever's FP dig (:8449).
**Step 2: Only if JT prefers ScoopFP:** add `public/js/71-fp-scoop.js`. Load `models/camper-fp.glb`, parent it
to the camera (origin = eye, -Z forward), and while `FP && digging`, put the body's hand/shovel meshes on
`FP_HIDE_LAYER` too and drive `ScoopFP` with `scoopTime(P.digPh)`. Hide it otherwise. Commit separately.
Otherwise skip this step. `camper-fp.glb` stays as an unused asset.

### Task 4: Ship Phase 1

**Step 1:** `git switch --detach origin/jt/next && git merge --no-ff feature/scoop-anim -m "Merge feature/scoop-anim: two-handed Scoop dig"`
**Step 2:** `if npm test; then git push origin HEAD:jt/next && git push origin feature/scoop-anim; fi`
**Step 3:** Confirm `~/camp-green-lake` pulled it (`git -C ~/camp-green-lake log -1 --oneline`). No server restart
is needed (client-only).
**Step 4:** Tell JT it's live on :8445 / the :10000 tester link. Refreshing picks it up.

---

## Phases 2-6 (outline; detailed plan written when each starts)

Reference code is Gold Fever on `origin/jt/gold-fever` (`git show origin/jt/gold-fever:gold-fever/<path>`).

| Phase | Branch | Gold Fever reference | Camp Green Lake hooks |
|---|---|---|---|
| 2 Wheelbarrow | `feature/wheelbarrow` | `shared/hauling.mjs`, `shared/cargo.mjs`, `public/hand-props.mjs` | `84-grab.js` / `84-rigid.js` (carry + physics), `26-ragdoll.js` (tumbles), `86-hopper.js` (tip into it), `86-backsack.js` (capacity rules) |
| 3 Washers | `feature/washers` | `shared/rules.json` catalog (rocker, sluice, washplant), `shared/simulation.mjs` machine tick | `86-hopper.js` / sifter, `88-pipeline.js`, `84-spend.js` `walletSpend`, Pendanski store, `TUNE_DEFS` rates |
| 4 Excavator + truck | `feature/excavator` | `shared/excavator.mjs` (arm: ensureArm / tickArm / excavatorAction), vehicle code in `shared/simulation.mjs` | `87-truck.js` (driving + camera), `46-holes.js` / server holes (bucket digs big holes/trenches), `86-hopper.js` (truck tips in), Sol Blender art in `art/blender/` |
| 5 Hydraulic rig | `feature/hydraulic` | `simulation.mjs` hydraulic cut/radius | Phase 4's vehicle setup |
| 6 Real dirt | design first | `shared/soil.mjs`, `shared/cargo.mjs` | `46-holes.js` clods → real counted pieces |

Every phase: server-authoritative (spends and loads checked on the server), knobs in `TUNE_DEFS`, a hazards/F2
switch where it can hurt players, a `tests/` check of its server rules, and a spectator video for JT before the
merge.
