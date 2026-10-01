# Camp Green Lake: instructions for Claude

A multiplayer browser game inspired by the book *Holes*. JT (repo owner, `jth458`) directs the work; Greg (`buissong`) collaborates. Read `docs/HANDOFF.md` for the full history, current state and backlog, and `ARCHITECTURE.md` for how the code is laid out.

**Characters / animation / ragdoll work: read [CHARACTER-HANDOFF.md](CHARACTER-HANDOFF.md) first.** It identifies
JT's approved continuously skinned camper, the smooth elbow update, all asset/runtime paths and the player/NPC
physics audit he requested. The finished model and integration are already on `jt/next`.

## Branches (the most important rules)

- **`main`**: Greg's co-op version plus a revert. **Never commit to, merge into, or push `main`** unless JT explicitly says "merge it to main" in the current conversation.
- **`jt/next`**: JT's play-test branch. Everything that's been reviewed and tested is merged here. JT's test link auto-updates from GitHub's `jt/next` about every 2 minutes, so **anything pushed to `jt/next` is live for JT to play almost immediately**. Only push to `jt/next` after `npm test` passes on the exact commit you push.
- **Feature work**: branch from `jt/next` as `feature/<name>` (or `fix/<name>`), commit there, push the feature branch, then merge it into `jt/next` (a `--no-ff` merge commit with a clear message) once it's tested. Keep one feature per branch so it's easy to review or back out.
- If a session starts "on `jt/next`" with a banner saying Claude will push directly to it, still create a feature branch first.
- Don't force-push shared branches. Don't delete other people's branches.

## Before you push anything

1. `npm ci` (first time), then `npx playwright install chromium` if the browser is missing.
2. `npm test`: the smoke test starts its own server on a free port and drives two headless browsers (load, start, move, dig, twister, console, two players, reload-and-resume). It must pass. Gate on the exit code, not on grepping its output.
3. For anything visual, take Playwright screenshots and **look at them** (you can read PNGs). Check both 1280x720 and 360x800 (phone).
4. `node --check server.js` for server changes.

## Shell commands that don't stop for permission

JT often runs sessions unattended from his phone. Claude Code still asks for permission on some delete commands even in bypass-permissions mode, and a wildcard `rm` (e.g. `rm -f fr/*`, `rm -rf dir`) is the likely trigger. A prompt stalls the whole run until JT answers.
- Delete with `find DIR -maxdepth 1 -name '*.png' -delete` (or `-type f -delete`), not `rm` with a wildcard or `-r`.
- Better still, don't delete: overwrite (`ffmpeg -y`, `>`), or write to a fresh folder in the scratchpad.
- Keep deletes out of long `;` chains, so a prompt can't hold up the useful work around them.

## Working alongside Greg's Claude

Greg's Claude and JT's Claude talk through notes in `docs/claude-to-claude/` (its README has the rules, the design
decisions, and a table of everything ported from Greg's branches to `jt/next`). Notes can land on **any** branch
(Greg's Claude writes on his own `buissong/*` branches), so before writing one, `git fetch` and list that folder on
every remote branch, then answer anything unanswered. Never change Greg's branches; bring his work over to `jt/next`.

## Code layout in one paragraph

`server.js` (Node `http` + `ws`) serves `public/` and runs the shared world, monsters (via `public/sim.js`), logging (`logger.js`) and security limits. The client is **ordered classic scripts** in `public/js/NN-name.js` (plus `public/css/game.css` and a thin `public/index.html`): top-level names are shared across files, but a file's *load-time* code can only use names from earlier files (a violation crashes the whole page = black screen). `95-pause.js` must stay last: it ends with the saved-session resume and the `#dbg` debug export. New features get a new `public/js/NN-feature.js` file registered in `index.html` (and in `scripts/split-client.mjs`'s MANIFEST notes if relevant), not more code in `index.html`.

## Art and models

Any change to a model (new parts, legs, bones, animation clips) is made in Blender: the build scripts in `art/blender/` (see its README), exported to GLB and copied to `public/models/`. The assets are split into `buildings`, `props`, `finds`, `creatures`, `characters` and `town.blend`, saved compressed; don't merge them back into one file or save them uncompressed (the old single 53 MB file bloated the repo on every commit). Don't patch a model in the game's JS by bolting on boxes or moving its pieces around. JT called a code-side leg fix a bandaid. The code only reads what the model provides, e.g. a named bone such as the vulture's `gripR`.

## Style

Match the surrounding code: compact JS, `const`, short helpers, named tuning constants with a one-line comment each, comments that explain *why* in plain words for teammates. Commit messages: a summary line, a blank line, then a plain-language body (what changed and why, tuning numbers, what was tested).

## Handy in-game tools (for testing)

- Open the page with `#dbg` (e.g. `http://localhost:PORT/?r=1#dbg`) to get `window.__cgl` (includes `runCommand`, `P` player, `S` state, `TW_LIVE`, tents, pause, voice, landslide internals).
- Developer console: press **`** in game. `help`, `twister [dist]`, `landslide [dist]`, `time hh:mm`, `heal`, `hurt [n]`, `tp x z` / `tp camp`, `where`, `clear`. On a server started with `DEV_MODE=1` everyone is host, so the console and the hidden `sploosh` admin panel work.
- Headless tests run ~2 fps with software rendering; the game clamps dt to 0.05 s, so game time runs ~10x slower than wall-clock. Judge by game state, not wall time.
