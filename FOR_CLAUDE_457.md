# For Claude (local run) — verify the UI redesign

A cloud session built the Camp Green Lake UI redesign on branch `feature/ui-redesign`. All 6
required steps from `docs/ui-redesign-spec.md` section 7 (plus the optional step 7, the full-screen
field map) are implemented, one commit per step, already pushed to `origin/feature/ui-redesign`.

**What I need from you:** run the real smoke test on real hardware/network and report back whether
it actually passes, since the cloud sandbox that built this could not run it.

## Why this needs a local run

The cloud sandbox's network policy blocks `cdnjs.cloudflare.com` (where `public/index.html` loads
three.js r128 from) and `fonts.googleapis.com`. `npm test` therefore times out waiting for
`window.__cgl` to appear, on *every* commit including the pre-redesign baseline — confirmed by
running it against `88b3671` (the commit before this branch existed) and getting the identical
failure. So the cloud session could not produce a real `PASS`. It built an uncommitted, gitignored
local harness that intercepted those two hosts and got full interaction coverage with zero errors,
but that's not the same as the actual committed code passing the actual committed test on a normal
network.

## What to do

```bash
git fetch origin feature/ui-redesign
git checkout feature/ui-redesign
npm ci
npx playwright install chromium
npm test
```

`npm test` runs `tests/smoke.mjs`: it starts the server on a free port, drives it with Playwright +
headless Chromium (software rendering), and fails on any page error or console error. It should
load three.js and Google Fonts from the real CDNs with no problem on a normal machine.

If it fails, look at `tests/smoke-failure.png` (written on failure) and the printed server log
first — most likely cause of a *new* failure would be something introduced during the 10-commit
redesign, not the harness itself.

## Optional: eyeball the actual UI

Tests only catch page/console errors, not whether the redesign actually looks right. If you want to
look at it:

```bash
PORT=4400 DEV_MODE=1 node server.js
```

Then open `http://localhost:4400/?r=1#dbg`, click `#startBtn`. Useful debug commands from the
console (backtick key) or `window.__cgl.runCommand(...)`:

- `tp 0 36` — teleport near Mr. Sir (dialogue)
- `F` near the Wreck Room — opens the store
- `J` — full-screen field map (the optional step 7 addition)

`docs/ui-screenshots/` already has committed reference screenshots (1280×720 and 360×800) of the
store, HUD+minimap, title, dialogue, blackjack, and the field map, taken through the workaround
harness — useful to compare against if something looks off.

## What changed, in one paragraph per step

1. Design tokens (desert-camp palette), a hidden SVG icon sprite, and shared CSS components
   (`.ui-button`, `.ui-panel`, `.ui-card`, `.ui-badge`, `.ui-meter`, `.ui-kbd`, etc.).
2. Wreck Room store rebuilt as a tabbed catalog + detail/confirm panel, with keyboard grid nav,
   gamepad support while open, and touch support. Item IDs and save format unchanged.
3. Minimap restyled into a survey-frame look with 3 zoom levels (130/260/520 m) and an offscreen
   static-layer cache so the 5 Hz redraw doesn't re-rasterize the terrain every time.
4. Minimap edge indicators (off-screen camp/objective/ping/friend arrows), a real night palette
   swap, nearby-only lizard markers, and initials on remote-player dots.
5. HUD reorganized into four screen clusters per the spec, plus a static crosshair and toast
   variants (success/reward/warning/neutral) with de-dupe.
6. Title, dialogue, blackjack, and outcome screens (`#ko`/`#win`/`#fired`) restyled to match;
   blackjack payout/card logic untouched.
7. (Optional, done anyway) Full-screen field map on `J`, sharing the minimap's draw code, forced to
   520 m zoom, closes with `J` or Escape.

Full commit list and deviation notes are in the branch's own commit messages (`git log
feature/ui-redesign`) — each commit body explains what changed and why.

## Report back

Once you've run it, please report: the actual `npm test` output (pass/fail and why if it fails),
and anything that looked visually wrong when you eyeballed it against the spec or the committed
screenshots.
