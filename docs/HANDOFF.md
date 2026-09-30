# Handoff: Camp Green Lake (as of 2026-09-27, evening)

> **Update (later the same evening):** a cloud planner session built nine new features (hazards, monsters, shovel
> bonk, an event director) and combined them on `integration/all-events`. See `docs/FOR-CLAUDE-458.md` for what's
> in it, how it was tested, and how to put it on the test link.

Written by the Claude Code session that ran on JT's mini PC ("minipc") all day, for the Claude Code cloud sessions taking over. Read `CLAUDE.md` first (branch rules), then this, then `ARCHITECTURE.md`.

---

## 1. The project in 60 seconds

- **Game:** a multiplayer 3D browser game set at Camp Green Lake from *Holes*. Dig holes on a 1.2 km dry lake bed, sell finds to Mr. Sir, dodge yellow-spotted lizards, get back inside the camp fence before curfew (police at night, then Madame Zeroni after 01:00), hit the crew's daily seed quota or everyone's "fired" and the run restarts (levels persist). Find the KB tube, give it to the Warden, dig up Kissin' Kate's suitcase.
- **Tech:** Three.js r128 from cdnjs, plain JS, no build step. Node server with `ws`. Low-poly flat-shaded art.
- **People:** JT (owner, designer, play-tester, `jth458`). Greg (`buissong`, collaborator with write access). Greg's AI built the big-map / night / co-op version that became the baseline. Since 2026-09-29 his Claude and JT's talk through `docs/claude-to-claude/` (notes on any branch), and most of Greg's Act 1 systems have been ported to `jt/next` (table in that folder's README).
- **How JT works:** he talks to Claude (often from his phone), Claude dispatches agents for features and reviews/merges their work, JT play-tests the test link and reports what he sees. He wants things **well annotated** (clear commits and comments) and **nothing merged to `main` without his say-so**. He likes fast iteration and parallel agents.

## 2. Where things run

| What | Where |
|---|---|
| Repo | `github.com/hole-dig-dev/camp-green-lake` |
| **Test link** (JT plays here) | `https://minipc.tail46206f.ts.net:8445`, PM2 app `camp-green-lake-test`, runs `jt/next` from `~/camp-green-lake` on the mini PC, `DEV_MODE=1` (everyone is host). Tailnet-only (JT's Tailscale devices). |
| Main link | `https://minipc.tail46206f.ts.net:8444`, PM2 app `camp-green-lake`, runs `main` from `~/camp-green-lake-live`. Friends' link eventually. |
| Auto-update | cron on the mini PC every 2 min: `~/cgl-autopull.sh` fast-forwards `~/camp-green-lake` to `origin/jt/next`, runs `npm install` if package files changed, restarts the test app. Log: `~/cgl-autopull.log`. **So pushing to `jt/next` = deploying to JT's test link.** |
| Play-test logs | JSONL on the mini PC in `~/camp-green-lake/data/logs/YYYY-MM-DD.jsonl`, query with `node scripts/logq.js` (see README). **Cloud sessions can't read these**; if JT reports a bug, ask him to paste the output of e.g. `node scripts/logq.js --summary` and `--type err --tail 20`, run from `~/camp-green-lake` on the mini PC (or have the local Claude do it). |

The mini PC is permanent (it's the old Hetzner server that's being retired, not the mini PC).

## 3. Branches and what's in them

- `main` (`a36f093`): Greg's co-op version, plus PR #2 (the performance work) **and a revert of it**, because JT wanted to play-test it before it went to `main`. Consequence for later: `jt/next` already contains those perf commits, so git considers them merged and a plain `jt/next` -> `main` merge would let the revert strip them back out (or conflict). **When JT says to merge to `main`**: on a branch from `main`, first `git revert a36f093` (revert the revert), then merge `jt/next`, then `npm test`.
- `jt/next`: everything below, integrated and tested.
- Per-feature branches (history/record): `perf/render-efficiency`, `feature/twisters-health` (the old name of the play-test branch), `fix/zeroni-daytime`, `feature/camp-base`, `feature/twister-physics`, `feature/pause-menu`, `feature/public-access`, `feature/big-thumb-landslide`, `feature/playtest-logging`, `feature/proximity-voice`, `feature/modular-framework`, `test/smoke-resume`.
- **In flight:** `feature/ui-redesign`, being built by a cloud session (https://claude.ai/code/session_01UDbANbLt4roR724UYBf8TW) from `docs/ui-redesign-spec.md`. When it lands: review it, run `npm test`, look at its screenshots in `docs/ui-screenshots/`, merge into `jt/next`.
- Tags: `original-v1` (JT's very first version), `buissong-v2026-09-27` (Greg's).

## 4. What was built today (all on `jt/next`)

1. **Performance** (`perf/render-efficiency`): each lizard drawn as 2 meshes instead of 20 (48 lizards were ~1,000 draw calls); terrain chunks near the player at full detail, far ones at 1/3 detail; phones get cheaper shadows and a lower pixel ratio; adaptive resolution (drops toward 0.75x under 45 fps, recovers above 57); `#fps` in the URL shows fps / resolution / draw calls / GPU name; warns the player once if the browser is software-rendering (JT's own 10 fps turned out to be Chrome's hardware acceleration switched off).
2. **Health** (0-100) with natural healing (after 5 s without damage, +1.5/s). Running out of water drains health instead of instant knockout. `hurt(amount, title, text)` is the one entry point; at 0 you're downed (co-op revive system from Greg's version).
3. **Twisters**: deterministic from the shared clock (200 m squares x 2-minute windows, 30% chance each), same for every player with no network traffic. Progressive pull (power curve between 25 m and 6 m), then sucked up ~9 m spiralling, thrown ~30 m, ragdoll tumble, lie on the ground ~1.4 s, get up. Up to 30 damage. Safe in a hole deeper than 4 ft or inside a tent; they fall apart near camp and die down at night. JT asked "is the flight too floaty?": unconfirmed, may want tuning.
4. **Developer console** (` key) and the **ENV hazard registry**: `ENV.<kind>.spawn({x,z,a})`, `spawnEnv()`, `spawnAhead()`; hazards spawned by the host are relayed by the server (`env` message) so everyone sees them. Adding a hazard = an ENV entry + a `command(...)`.
5. **Zeroni/police daytime freeze fix**: the server now includes the current monster snapshot in `hello`, so a reconnecting client never keeps rendering a monster that's gone.
6. **Camp base**: fenced compound, water tower, lights, bigger tents you enter with **E** (interiors are rooms underground at y = -4 at the tent's own x/z, so "in camp" logic still works), blackjack table inside D Tent with X-Ray, bunks, **night skip when every connected player is asleep in a bunk** (server-decided), crew NPCs take breaks and sleep inside. Tents shelter you from twisters/landslides/police/Zeroni/lizards.
7. **Pause menu** (Esc, also opens when pointer lock is lost): Resume, Options (mouse sensitivity, invert Y, touch sensitivity, FOV, master/effects/music/voice volume, shadows, render quality, FPS counter), Controls, key rebinding (a remap layer translates pressed keys to the default key names the code checks), Restart (= respawn at camp), Quit to title. Settings in `localStorage['cgl-settings']`.
8. **Server hardening** for eventual public access: optional camp password (`CAMP_PASSWORD`, invite links `?camp=...`), world data withheld until a correct join, per-IP connection limits and join timeout, per-type message rate limits, dig distance/rate checks, admin endpoints unreachable through a proxy, security headers/CSP, `PUBLIC=1` refuses `DEV_MODE`, and a crash fix (malformed frames used to kill the process). Public exposure (Tailscale Funnel) is **not** turned on; JT decides.
9. **Big Thumb**: a ~450 m thumb-shaped mountain outside the playable area, visible from everywhere, haze-matched at night/disco.
10. **Landslides**: `landslide [dist]` console command + natural ones (more common on the Big Thumb side). 8-20 boulders fall from the sky, bounce and roll with **fixed-timestep deterministic physics** (identical on every client), damage by speed x size, settled boulders are solid but harmless, +2 draw calls total.
11. **Play-test logging**: `logger.js` + `scripts/logq.js`. Positions, damage, knockouts, mobs, hazards, finds, console commands, clock changes, tents/bunks, pause actions, rejected joins, **client JS errors**, fps/GPU. This is how the black-screen bug below was found in about a minute.
12. **Proximity voice chat**: WebRTC mesh, signaling over the game socket, HRTF positional audio fading to silence past ~36 m, connects only within 60 m. Push-to-talk **B** (rebindable), mic button bottom right, open-mic mode, mute-voices, speaking indicator. STUN only; `ICE_SERVERS` env var for a future TURN server.
13. **The split**: `index.html` (3,200 lines) became 23 ordered files in `public/js/` + `public/css/game.css` via `scripts/split-client.mjs` (byte-exact round trip verified). `ARCHITECTURE.md` documents it.
14. **Smoke test + CI**: `npm test` (`tests/smoke.mjs`) and `.github/workflows/smoke.yml` (runs on every push).

## 5. Gotchas learned the hard way

- **Load order / TDZ = black screen.** A resume ran at load time before the pause menu's `SETTINGS` const existed; the whole script threw and JT got a black screen. The saved-session resume now runs once at the very end of `95-pause.js`. Any top-level call must only touch names from earlier files. The smoke test's reload-and-resume check guards this.
- **Merges between agents conflict in the same spots**: the main loop's update line (`updateTwisters(...);updateLandslides(...);...`), the `#dbg` `window.__cgl` export list, the server connection object, `hello` contents, the message size/rate checks. Resolve by keeping both sides.
- **Message size caps**: non-`rtc`/non-`log` messages are capped at 1 KB (`GEN_MAX`); `rtc` and `log` have 8 KB allowances. A new message type that can be big needs its own allowance or it's silently dropped.
- **Log budget**: per client 60 events burst, +12/s, errors first, drops noted as `logDropped`.
- **Network clamps player Y to -5..10**, so tent interiors are at y = -4.
- **E is both dig and "enter tent / bunk"** (digging is disabled in camp, so E at a door enters).
- **Deterministic hazards**: twister and landslide schedules must stay pure functions of shared time + seed (`twNow()` = `Date.now() + wrapT(CLK.off)`), never of player state, or clients diverge.
- **Headless testing**: software rendering is slow (~1-2 fps) and makes game time crawl. On the mini PC the local session used the Radeon iGPU (`sg render -c` + `--use-angle=vulkan`); cloud runners won't have that, so allow time, and prefer state-based assertions.
- **Two smoke runs at once** used to collide on a fixed port; it now asks the OS for a free port.
- **Don't** `pkill -f "node server.js"`: it kills other people's servers. Kill by PID.
- **Pushing workflow files** needs the token's `workflow` scope (granted on the mini PC now).

## 6. Backlog (JT-approved ideas and loose ends)

Loose ends:
- Review/merge `feature/ui-redesign` when the cloud session finishes (GPT-6 Sol's spec in `docs/ui-redesign-spec.md`; step 7, the J field map, was optional).
- Twister flight may be too floaty (thrown ~30 m, peaks ~15 m): ask JT after he plays.
- Voice chat is untested between different home networks (STUN only).
- `node_modules` / `playwright` devDependency: CI installs Chromium itself.

Ideas JT liked or asked for (not started):
- **Water truck run**: once a day the truck drives onto the lake with a timer, everyone rushes to it.
- **AI NPC dialogue**: X-Ray, Zigzag, the Warden answer typed questions in character via a cheap fast model, remembering the day.
- **Sam's onion field** near Big Thumb (onions heal and repel lizards), **Kissin' Kate's treasures** (lipstick tube, gold, Clyde Livingston's sneakers) as rare finds with story popups, **daily objectives** from Mr. Sir, a **curse meter** (Zeroni catches make things worse; carrying Zero up Big Thumb breaks it).
- **Achievements + stats**, **photo mode**, **controller support**, a **first-run tutorial** and a **"next task" line** (from Sol's spec).
- **Public access** via Tailscale Funnel on port 10000 with `PUBLIC=1` + `CAMP_PASSWORD` (the code is ready; JT decides when).
- Longer term: JT asked about moving to a real engine (Godot recommended, via GodotSteam for Steam) once the design settles; keep game rules separable from rendering (like `sim.js`) to make that easier.

## 7. How to keep going

1. `git fetch`, check out `jt/next`, read `CLAUDE.md` + this file + `ARCHITECTURE.md`.
2. For a feature: `git checkout -b feature/<name>` from `jt/next`, build it in a new or relevant `public/js/` file, add a console command if it's a spawnable thing, run `npm test`, take and look at screenshots, commit with a clear message, push the branch.
3. To ship it to JT: merge into `jt/next` (`git checkout jt/next && git merge --no-ff feature/<name>`), run `npm test` again on the merge, push `jt/next`. Within ~2 minutes it's on JT's test link. Tell JT what to try and which console commands help (e.g. "type `time 13:00` then `twister 40`").
4. Several independent features can go in parallel as separate sessions/branches; merge them one at a time, re-running `npm test` after each merge.
5. Never touch `main` without JT's explicit OK.
