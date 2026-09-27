# Camp Green Lake -- architecture

This file is generated (and kept up to date) by `scripts/split-client.mjs` -- see that file for
the mechanics. It exists so a human or an AI agent picking up a feature branch can find where code
lives without re-deriving it.

## How the client is put together

`public/index.html` used to be one file: CSS in a `<style>` block, HTML overlays (HUD, menus,
the console), then one big `<script>` whose body was an IIFE. It's now split into:

- `public/css/game.css` -- all the CSS, verbatim, loaded with a plain `<link>`.
- `public/index.html` -- just the markup: overlay `<div>`s, the CSS link, the cdnjs three.js
  tag, the `sim.js` tag, and then the module `<script src="js/...">` tags below, in load order.
- `public/js/NN-name.js` -- the game logic, cut into ordered files (below).
- `public/sim.js` -- shared rules (the team quota, heavy loot, night monsters). Loaded by the
  page AND `require`'d directly by `server.js`, so the server and every client run exactly the
  same math for anything that has to agree (who reached quota, whether a twister caught you).
  It exports itself as `module.exports` under Node and as `root.SIM` in the browser -- see the
  last line of the file. Don't move game logic that the server also needs to care about out of
  here; anything only the client needs (rendering, input, UI) belongs in `public/js/`.
- `server.js` -- a small Node + `ws` server. It serves the client files (see below), relays
  player positions/digs/chat/hazards over WebSocket, and keeps the one shared world (dug holes,
  found items, the KB tube, the suitcase, heavy props) so late joiners see the same camp. It does
  NOT run the renderer or any Three.js code -- only `public/sim.js`'s pure functions.

## Load order, and why it matters

`public/index.html` loads scripts as plain classic `<script src>` tags, in this order:

1. `https://cdnjs.cloudflare.com/.../three.min.js` (r128, from cdnjs)
2. `sim.js`
3. `public/js/10-core.js` ... `public/js/99-boot.js`, in ascending numeric order

| File | Responsibility |
|---|---|
| `public/js/10-core.js` | seeded RNG, world constants, renderer/scene/camera, sky |
| `public/js/15-terrain.js` | dug holes, buried-loot seeding, streaming terrain chunks (near/far detail levels) |
| `public/js/20-world.js` | static camp geometry: fenced compound, tents and their interiors, cabins, signs, Big Thumb |
| `public/js/25-people.js` | camper avatars, name/speech labels |
| `public/js/30-npcs.js` | Mr. Sir, the Warden, the D Tent crew (including tent breaks) |
| `public/js/35-lizards.js` | yellow-spotted lizards |
| `public/js/40-fx.js` | dirt particles, item pops, rain, WebAudio sound effects |
| `public/js/45-state.js` | player/session state, digging, world interactions (use/F) |
| `public/js/50-tents.js` | entering/leaving tents, bunks, sleeping |
| `public/js/55-input.js` | keyboard/mouse/touch input (with the key-remap layer) |
| `public/js/60-title.js` | title screen, camp password, session save/resume, start-game flow |
| `public/js/65-net.js` | WebSocket client, remote players, server messages, play-test log batching |
| `public/js/70-player.js` | player movement/physics, camera, health and healing |
| `public/js/72-twisters.js` | twisters: schedule, pull/suck-up/ragdoll, visuals, sound |
| `public/js/74-landslide.js` | landslides: deterministic boulder physics, hits, warnings |
| `public/js/75-tumbleweed.js` | giant tumbleweeds: deterministic bouncy physics, getting stuck to one and wriggling free, visuals, sound |
| `public/js/76-console.js` | ENV hazard registry + the developer console and its commands |
| `public/js/78-hud.js` | HUD panel and minimap |
| `public/js/80-ui.js` | NPC dialogue, D Tent blackjack, the disco easter egg |
| `public/js/82-patrol.js` | shared clock/curfew, police patrols, Madame Zeroni |
| `public/js/84-coop.js` | levels, team quota, heavy loot, dropped sacks, helping friends, pings/chat, flashlight, co-op tick |
| `public/js/86-voice.js` | WebRTC proximity voice chat and positional audio |
| `public/js/90-loop.js` | the requestAnimationFrame main loop |
| `public/js/95-pause.js` | pause menu, settings, key rebinding; then the final session resume and debug exports (must stay last) |

**The global-scope rule.** These are classic scripts, not ES modules -- no `type="module"`, no
`import`/`export`. Top-level `const`/`let`/`class`/`function` in a classic <script> at the
top of a page all live in the SAME global lexical scope, shared across every <script> tag on that
page. That's the whole trick: `public/js/40-people.js` can freely reference a `const` declared in
`public/js/10-core.js` with no import, exactly as if the file boundary didn't exist. This is why
the split needed no code rewriting -- only cutting the original script into ordered pieces.

**The hoisting caveat.** `function` declarations are hoisted to the top of their OWN `<script>`,
not across script tags. If file A has a top-level statement that runs immediately (at load time,
not inside a callback) and calls a function only declared in a later file B, that throws
`ReferenceError` the moment A's script runs, before B has even loaded. `scripts/split-client.mjs`
does a best-effort static scan for this (see its `--write`/`--check` output for warnings), but
the real check is the smoke test (`npm test`), which actually loads the split page in a browser --
any such problem shows up immediately as a `pageerror`. If you hit one: either move the split
point so the two things end up in the same file, reorder the manifest in
`scripts/split-client.mjs` so the callee's file loads first, or (for something that's only ever
supposed to run once everything else is ready, like the boot-time debug hooks) move the offending
call into `public/js/99-boot.js`, which always loads last.

**Global-name collisions.** A top-level `let`/`const`/`class` at the top of a page can collide
with a real property of `window` (`top`, `self`, `name`, `location`, `history`, `status`,
`screen`, `event`, ... -- see `RISKY_GLOBALS` in `scripts/split-client.mjs`). Some of these throw
a `SyntaxError` the instant the script parses; others silently shadow the real global for the rest
of the page. The splitter scans for this and prints a warning; if you add a new top-level binding,
give it a name that isn't on that list.

## Adding a new feature

1. Add your code to `public/index.html` under a section banner:
   `/* ---------- your feature ---------- */`, in whichever file/section it conceptually belongs
   near (this only matters again once someone re-runs the splitter -- day to day, before the next
   split, the file is still one script and banners are just comments).
2. When it's time to re-run the splitter (see workflow below) and your banner doesn't match
   anything in `MANIFEST` (in `scripts/split-client.mjs`), it will print a warning telling you
   which file it landed in by default (whatever file was "open" at that point). Add an explicit
   entry to `MANIFEST` for it if it deserves its own file or a different home.
3. Keep the manifest's file order matching the order sections actually appear in
   `public/index.html` -- the splitter cuts contiguous ranges, it does not reorder, so a manifest
   entry has to appear in an order consistent with where its banner actually sits in the source.

## The ENV hazard registry + developer console pattern

Environmental hazards (twisters, and whatever else gets added -- landslides, etc.) are spawned
through one registry, `ENV`, keyed by hazard name: `ENV.sandstorm = {spawn: o => ...}` where
`o` is `{x, z, a}` (position + heading). The server only relays *that* a host spawned a hazard of
a given kind, position and heading (see the `'env'` case in `server.js`); every client builds the
identical hazard client-side from those three numbers, so nothing bulky needs to go over the wire.

The developer console (backtick to open) registers commands the same way, one `command(...)` call
per command, e.g. `command('twister', {usage: ..., help: ..., run(args) { ...; return 'reply' }})`.
Adding a hazard usually means one `ENV.xyz = {...}` entry plus one `command('xyz', ...)` that calls
`spawnAhead('xyz', dist)`. See the README's "Developer console" section for the full command list.

## Branch / test workflow

- `npm test` (`tests/smoke.mjs`) starts the server, drives it with Playwright + headless
  Chromium, and fails on any page error or console error, whether the client is split or not. Run
  it before and after re-running the splitter.
- `npm run split:check` runs the splitter in `--check` mode: it splits into a temp directory,
  verifies the CSS/HTML/JS all round-trip back to exactly the current `public/index.html`, and
  exits non-zero on any mismatch. It never touches `public/`.
- `npm run split` runs it for real (`--write`), in place.
- The intended sequence, once the parallel feature branches above have merged: merge everything
  into `public/index.html` as one file (as today), run `npm test` (must pass unsplit), run
  `npm run split`, run `npm test` again (must pass split), commit the split output. Do this once,
  not per-branch -- splitting earlier would make every one of those branches conflict on the same
  file for no reason.
