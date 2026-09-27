# For the local Claude on JT's mini PC: get up to speed, then serve the new build

Written 2026-09-27 (evening) by the cloud planner session (https://claude.ai/code/session_01DJcNnYMimb2whMvxuB1bic)
for the Claude Code session running on JT's mini PC. JT wants you to **get up to speed and put the new game
version on his test link for play-testing**. Read `CLAUDE.md` first (branch rules: never touch `main`), then
this file. `docs/HANDOFF.md` and `ARCHITECTURE.md` are the background.

---

## 1. TL;DR: what to do

Everything from this session is combined and tested on **`integration/all-events`** (branched from `jt/next`).
To serve it on the test link (https://minipc.tail46206f.ts.net:8445, which auto-pulls `jt/next` every ~2 min):

```bash
cd ~/camp-green-lake && git fetch origin
# work in a scratch worktree so the 2-minute auto-pull can't trip over a half-done merge
git worktree add --detach ~/cgl-merge origin/jt/next
cd ~/cgl-merge && ln -s ~/camp-green-lake/node_modules node_modules
git merge --no-ff origin/integration/all-events -m "Merge integration/all-events: new hazards, monsters, shovel bonk, event director"
scripts/check-globals.sh          # must print OK (catches black-screen duplicate globals)
node tests/director.test.mjs      # must print 20 passed, 0 failed
npm test; echo "EXIT $?"          # must be EXIT 0
git push origin HEAD:jt/next      # only if all three passed
cd ~ && git -C ~/camp-green-lake worktree remove --force ~/cgl-merge
```

Then confirm it deployed: `tail -5 ~/cgl-autopull.log` and `pm2 status` (the test app restarts on its own
when `jt/next` moves; `pm2 restart camp-green-lake-test` if it didn't). If `jt/next` moved since this was written
and the merge conflicts, resolve by keeping both sides (see section 5), re-run all three checks, then push.
If `npm test` fails, **don't push**: tell JT what failed.

Then tell JT the build is live and what to try (section 3). The test server runs `DEV_MODE=1`, so everyone is
host and the console (the ` key) works for everyone.

## 2. What's new in this build

Nine feature branches, each built by one agent (or the planner), all merged into `integration/all-events`, plus two
integration commits on top that fix the clashes between them, wire everything into the event director, and fix the
director's start times (see section 5).

| Branch | What it adds | Main file(s) |
|---|---|---|
| `feature/shovel-bonk` | Dig while a friend is right in front of you and you bonk them: a short harmless tumble (twister ragdoll states), no damage. Server-checked (`bonk` message: 3.2 m, same level, rate-limited). Crew NPCs just complain. Can't bonk anyone out of a hole. | `public/js/71-bonk.js` |
| `feature/event-director` | One server-side place that picks natural events on a budget: 75 s minimum gap, no two major events within 220 m of a camper, per-kind cooldowns, intensity ramps with day and crew size. Solo play runs the same code locally. | `public/director.js`, `tests/director.test.mjs` |
| `feature/landslide-rain` | Landslide overhaul: boulders rain down staggered over a few seconds (some angled in from Big Thumb), bounce hard, ricochet and roll unpredictably; ground markers show where each lands. Still deterministic (fixed timestep, seeded). | `public/js/74-landslide.js` |
| `feature/giant-tumbleweed` | 1-3 comically huge bouncing tumbleweeds; one hits you and you stick to it and ride around; mash Space to wriggle free, or get flung off after ~7 s or on a big bounce. | `public/js/75-tumbleweed.js` |
| `feature/haboob` | Dust storm: a huge wall rolls across the whole lake with ~1 min warning, ~8 m visibility inside for 1.5-3 min, minimap scrambles, water drains 1.5x, lizards bolder; tents shelter you. | `public/js/75-haboob.js` |
| `feature/sinkhole` | Ground shakes, then a big (10-14 m) ~4.4 m deep crater opens; you can't climb out; a friend holds F at the rim to pull you up (solo: Zero comes after a wait). | `public/js/87-sinkhole.js` |
| `feature/vultures` | Always circling overhead; below ~30% health out on the lake they notice you, dive, grab you, carry you up and drop you (fall damage). A well-timed shovel swing shoos a diving one. They also circle over hurt friends. | `public/js/83-vultures.js` |
| `feature/javelina-herd` | 30 javelinas (server-run, everyone sees the same herd): fast, bite for health, stop at the camp fence, two shovel hits kill one. | `public/js/83-javelinas.js`, `sim.js`, `server.js` |
| `feature/mountain-lion` | One smart mountain lion (server-run): targets the most vulnerable camper, stalks from behind, freezes when you face it, flanks, pounces (35 damage + pin); facing it, grouping up, flashlight and shovel hits drive it off; never enters camp; not on the minimap on purpose. | `public/js/85-lion.js`, `sim.js`, `server.js` |

**Shovel swing priority** (top of `scoop()` in `45-state.js`): shoo a diving vulture, whack a javelina, swat the lion,
bonk a friend, then the sinkhole "can't dig" message, then normal digging.

## 3. What JT should try (console: the ` key)

Get out on the lake first (`tp 60 -150`), and make it daytime (`time 13:00`).

| Command | What happens |
|---|---|
| `landslide 45` | Boulder rain 45 m out |
| `tumbleweed 45` | Tumbleweeds heading at you; stand in the way to get stuck, mash Space |
| `haboob w` | Dust storm from the west (any of n/ne/e/se/s/sw/w/nw) |
| `sinkhole 25` | Sinkhole opens 25 m ahead; walk in, then have a friend hold F at the rim |
| `javelinas 30 50` | Herd of 30, 50 m out; dig (E / click) at one in front of you to whack it |
| `lion 30` | Mountain lion 30 m ahead; face it to freeze it, swing at it to drive it off |
| `vultures now` | A vulture dives at you (`hurt 75` first to see the low-health warning path) |
| `event <kind>` | Ask the director to place any of the above near you (kinds: twister, landslide, tumbleweed, sinkhole, javelinas, lion, haboob) |
| `events` | What the director is doing: next roll, cooldowns, active events |
| `director off` / `on` | Hand natural scheduling back to each event's old schedule / to the director |
| (no command) | Shovel bonk: stand next to a friend facing them and dig |

With the director on (the default), natural events are rolled for campers out on the lake. Some only start
naturally from a given day: sinkhole day 2, javelinas day 3, lion and haboob day 4 (`minDay` in the
`REGISTRY` in `public/director.js`). The console commands and `event <kind>` work any day.

## 4. How it was tested (cloud sandbox, headless software rendering)

On the final `integration/all-events` commit:
- `npm test` (the repo's smoke test): all 12 steps pass.
- `node tests/director.test.mjs`: 20/20.
- `scripts/check-globals.sh`: clean across 32 scripts.
- A second browser joining after a director sinkhole opened sees the same crater with the same start time.
- A browser script fired every event both from its own console command and through `event <kind>`: each one
  spawned (boulders, weeds, sinkhole, javelina herd from the server, lion from the server, vulture dive, haboob that
  actually reaches the player), and there were zero page or console errors. The director log showed its decisions.
- Shovel bonk with two real browsers: the server relays it, the victim is knocked ~4.7 m, lands, lies down, gets
  up, health stays 100. Single-page checks: in a hole you only get "rang your bell", X-Ray complains when bonked,
  a swing with nobody in front still digs.

**Not verified by a human or by me** (please watch for these when JT plays):
- The tumbleweed ride (stuck-to-it rotation/flailing) was never seen rendered; the agent's screenshots failed.
- The sinkhole two-player rescue (friend holds F at the rim) and the solo Zero fallback: not re-tested after merge.
- Javelinas and the lion in two browsers at once (sync of positions/kills); the lion's stalking "feel".
- Looks in general: the machine was too loaded for most agents to get their 1280x720 / 360x800 screenshots.
- Four agents (haboob, sinkhole, vultures, javelinas) were stopped by an account spend limit before sending their
  final reports. Their last edits were saved as "WIP:" commits on their branches; the integration tests above
  cover them, but they never did a final polish pass.

## 5. Things that bit us today (merge gotchas)

Merging nine branches found real bugs that none of the branches had on its own:
- **Duplicate top-level `let` across files** (`HABOOB_NATURAL` in both `director.js` and `75-haboob.js`) = the
  later file dies at load. Run `scripts/check-globals.sh` after every merge.
- **Position flag bits** (`f` in the `pos` message, clamped 0-255): 1 hidden in a hole, 2 downed, 4 flashlight,
  8 crouching, 16 stuck in a hole, 32 in a sinkhole, 64 pulling a sinkhole friend up, 128 carried by a vulture.
  All 8 bits are now used. Any new flag needs a new field, not another bit.
- **Shared hot spots** where every branch adds a line (resolve by keeping both): the main loop update line in
  `90-loop.js`, the `#dbg` `window.__cgl` export at the end of `95-pause.js`, the top of `scoop()`, `ENV` in
  `76-console.js`, the `updatePlayer` takeover early-returns in `70-player.js`, `knockOut`/`respawn` resets in
  `50-tents.js`, `hello` in `server.js`/`65-net.js`, the per-connection limiter arrays in `server.js`, the README
  console table, and the `SIM` export list at the bottom of `sim.js` (two branches each added their own
  `const SIM = {...}`; there must be exactly one).
- **Hazard clock**: clients time hazards on `twNow()` (real time + the camp clock offset wrapped to a day). The
  server stamps director events with the same value (`hazardNow()` in `server.js`) and sends it as `t0`; before
  that fix, after any `time` change a late joiner replayed events up to 12 minutes off.
- **Natural schedules**: every event branch also brought its own natural schedule, which bypassed the director and
  let events pile up. They're all gated now (`DIRECTOR_ON` on the client, `noNatural` on the server monsters). A
  new event should be added to the director's `REGISTRY` instead of getting its own schedule
  (see "Adding an event to the director" in `ARCHITECTURE.md`).

## 6. Open items / decisions for JT

- **Tuning**: every number is a first guess (lion 260 HP / ~29 shovel hits / 35 pounce damage; javelinas 2 hits;
  vulture threshold ~30%; director gaps and cooldowns). Adjust after play-testing.
- **Network height clamp**: other players see anyone above y = 10 at 10 (and below -5 at -5). Tumbleweed riders
  can go higher; vultures cap carry height at ~9.5 m because of it. Widening it means changing `server.js` and
  `65-net.js` together.
- **Late joiners**: a camper joining mid-event sees director-started landslides, sinkholes and tumbleweeds already
  in progress (tested for sinkholes: same crater, same start time), but not twisters or director-started haboobs
  (their spawns don't take a start time yet). Javelinas and the lion come from the server snapshot, so they're fine.
- **Shovel bonk off switch**: a settings toggle is waiting on the UI redesign (pause menu).
- **UI redesign** (`feature/ui-redesign`, another cloud session): not merged yet. It will likely conflict with the
  minimap lines several hazards added in `78-hud.js`; keep both sides.
- **Greg's branch** (`claude/holes-slop-2026-09-27-1338`, by `buissong`): a big design overhaul (5-day sentence,
  curse meter, stamina, daily monster roster incl. vultures/rattlesnakes/scorpions, shovel bonk on R, a buried town,
  climbable Big Thumb, flood finale). It's based on his co-op version from before the file split, so it can't be
  merged with git: it has to be ported, phase by phase, into the split layout, and overlaps with this build
  (vultures, bonk, sinkhole vs his buried-town cave-ins, director vs his daily roster, haboob vs his sandstorm mood)
  need a decision per feature. **Key clash: his twerk emote is on B, which is push-to-talk here.** Nothing of his is
  merged; JT and Greg decide.
- **Repo move**: JT may move the repo to a GitHub organization so Greg's Claude can connect. GitHub redirects the
  old URL, but after a transfer update both checkouts:
  `git remote set-url origin https://github.com/<org>/camp-green-lake.git` in `~/camp-green-lake` and
  `~/camp-green-lake-live`.
- Small hardening follow-up: the sinkhole's `sinkpull` message (XP credit for rescuers) has a proximity check but
  no rate limit.
