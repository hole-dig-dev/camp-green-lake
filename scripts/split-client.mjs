#!/usr/bin/env node
// scripts/split-client.mjs
//
// Mechanically splits public/index.html's single inline <script> (an IIFE) into ordered classic
// <script> files under public/js/, pulls the <style> block out to public/css/game.css, and
// rewrites public/index.html to load them all in the right order. It never reorders a single
// line of the original script: it only decides where to cut it. See ARCHITECTURE.md (written by
// --write) for why this exists and how the pieces fit together.
//
// Usage:
//   node scripts/split-client.mjs --check   dry run: split into a temp dir, verify the round trip,
//                                            exit non-zero on any mismatch. Nothing under public/
//                                            is touched.
//   node scripts/split-client.mjs --write   do it for real, in place, and write ARCHITECTURE.md.
//
// Both modes are idempotent: run against an already-split tree, they say so and exit 0.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'public', 'index.html');
const CSS_PATH = path.join(ROOT, 'public', 'css', 'game.css');
const JS_DIR = path.join(ROOT, 'public', 'js');
const ARCH_PATH = path.join(ROOT, 'ARCHITECTURE.md');

// ---------------------------------------------------------------------------------------------
// The manifest: an ORDERED list of section banners that each start a new output module. The file
// already has ~30 banners like `/* ---------- twisters ---------- */`; everything from a trigger
// banner up to (not including) the next trigger banner's line lands in that module, in original
// order. A banner that matches none of these (a branch added a new section) just falls into
// whichever module is "open" at that point -- the script warns about it so this list can be
// updated with an explicit home for it. That's what keeps the split mechanical: we only ever
// choose cut points, never move code around, so re-concatenating the modules in this same order
// reproduces the original script byte for byte.
// ---------------------------------------------------------------------------------------------
const MANIFEST = [
  { file: '10-core.js', match: /deterministic randomness/i, note: 'seeded RNG, world constants, renderer/scene/camera, sky' },
  { file: '15-terrain.js', match: /^holes$/i, note: 'dug holes, buried-loot seeding, streaming terrain chunks (near/far detail levels)' },
  { file: '20-world.js', match: /camp buildings/i, note: 'static camp geometry: fenced compound, tents and their interiors, cabins, signs, Big Thumb' },
  { file: '25-people.js', match: /^people$/i, note: 'camper avatars, name/speech labels' },
  { file: '30-npcs.js', match: /^npcs$/i, note: 'Mr. Sir, the Warden, the D Tent crew (including tent breaks)' },
  { file: '35-lizards.js', match: /yellow-spotted lizards/i, note: 'yellow-spotted lizards' },
  { file: '40-fx.js', match: /dirt particles/i, note: 'dirt particles, item pops, rain, WebAudio sound effects' },
  { file: '45-state.js', match: /^game state$/i, note: 'player/session state, digging, world interactions (use/F)' },
  { file: '50-tents.js', match: /^tent interiors/i, note: 'entering/leaving tents, bunks, sleeping' },
  { file: '55-input.js', match: /^input$/i, note: 'keyboard/mouse/touch input (with the key-remap layer)' },
  { file: '60-title.js', match: /title \/ start/i, note: 'title screen, camp password, session save/resume, start-game flow' },
  { file: '65-net.js', match: /^multiplayer/i, note: 'WebSocket client, remote players, server messages, play-test log batching' },
  { file: '70-player.js', match: /^player update$/i, note: 'player movement/physics, camera, health and healing' },
  { file: '72-twisters.js', match: /^twisters$/i, note: 'twisters: schedule, pull/suck-up/ragdoll, visuals, sound' },
  { file: '74-landslide.js', match: /^landslide/i, note: 'landslides: deterministic boulder physics, hits, warnings' },
  { file: '76-console.js', match: /^environmental hazards/i, note: 'ENV hazard registry + the developer console and its commands' },
  { file: '78-hud.js', match: /hud \+ minimap/i, note: 'HUD panel and minimap' },
  { file: '80-ui.js', match: /^conversations/i, note: 'NPC dialogue, D Tent blackjack, the disco easter egg' },
  { file: '82-patrol.js', match: /curfew \+ police/i, note: 'shared clock/curfew, police patrols, Madame Zeroni' },
  { file: '84-coop.js', match: /^levels:/i, note: 'levels, team quota, heavy loot, dropped sacks, helping friends, pings/chat, flashlight, co-op tick' },
  { file: '86-voice.js', match: /^proximity voice chat$/i, note: 'WebRTC proximity voice chat and positional audio' },
  { file: '90-loop.js', match: /^main loop$/i, note: 'the requestAnimationFrame main loop' },
  { file: '95-pause.js', match: /^pause menu$/i, note: 'pause menu, settings, key rebinding; then the final session resume and debug exports (must stay last)' },
];

// Window own-properties that a top-level `let`/`const`/`class` in a classic script can collide
// with. Some (top, self, location, ...) are non-configurable accessors and THROW a SyntaxError
// ("Identifier 'x' has already been declared") the instant the script parses; others just silently
// shadow the real global for the rest of the page, which is its own kind of bug. `function` decls
// are fine (they behave like `var` and simply overwrite), so we only check const/let/class.
const RISKY_GLOBALS = new Set([
  'name', 'status', 'top', 'parent', 'length', 'event', 'origin', 'history', 'screen', 'self',
  'location', 'frames', 'closed', 'opener', 'document', 'window', 'navigator', 'external',
  'find', 'stop', 'print', 'open', 'close', 'alert', 'confirm', 'prompt', 'focus', 'blur',
  'scroll', 'scrollTo', 'scrollBy', 'moveTo', 'moveBy', 'resizeTo', 'resizeBy',
  'innerWidth', 'innerHeight', 'outerWidth', 'outerHeight', 'pageXOffset', 'pageYOffset',
  'screenX', 'screenY', 'screenLeft', 'screenTop', 'devicePixelRatio', 'crypto',
  'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'performance', 'console',
  'customElements', 'frameElement', 'fetch', 'Image', 'Audio', 'Option', 'Worker', 'WebSocket',
  'toolbar', 'menubar', 'statusbar', 'scrollbars', 'personalbar', 'locationbar', 'applicationCache',
]);

const BANNER_RE = /^\/\*\s*-{2,}\s*(.+?)\s*-{2,}\s*\*\/$/;
// Matches the *start* of a top-level declaration and captures the declared name.
const DECL_RE = /^(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*[=,]|class\s+([A-Za-z_$][\w$]*)\b)/;
const IDENT_RE = /[A-Za-z_$][\w$]*/g;

function readLines(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return { raw, lines: raw.split('\n') };
}

function isAlreadySplit(raw) {
  return !/<style>/.test(raw) && /css\/game\.css/.test(raw) && fs.existsSync(JS_DIR) && /js\/\d\d-[\w-]+\.js/.test(raw);
}

// Pulls the document apart into: html before <style>, the css body, html between </style> and the
// inline <script>, the script's own body lines (after 'use strict';, before the closing `})();`),
// and whatever (if anything) follows the closing </script>. Throws with a clear message if the
// expected shape (checked in on today's index.html) has drifted -- better than silently
// mis-splitting a file seven branches are actively editing.
function parseDocument(raw) {
  const lines = raw.split('\n');
  const idxStyleOpen = lines.findIndex(l => l.trim() === '<style>');
  if (idxStyleOpen === -1) throw new Error("couldn't find a bare '<style>' line");
  const idxStyleClose = lines.findIndex((l, i) => i > idxStyleOpen && l.trim() === '</style>');
  if (idxStyleClose === -1) throw new Error("couldn't find the matching '</style>' line");

  const idxScriptOpen = lines.findIndex((l, i) => i > idxStyleClose && l.trim() === '<script>' && lines[i + 1] && lines[i + 1].trim() === '(function(){');
  if (idxScriptOpen === -1) throw new Error("couldn't find the inline '<script>\\n(function(){' IIFE opener");
  if (lines[idxScriptOpen + 2].trim() !== "'use strict';") throw new Error("expected 'use strict'; right after (function(){");
  const bodyStart = idxScriptOpen + 3;

  // Find the LAST `})();` / `</script>` pair in the file -- that's the IIFE closing.
  let idxIifeClose = -1;
  for (let i = lines.length - 1; i >= bodyStart; i--) {
    if (lines[i].trim() === '})();' && lines[i + 1] && lines[i + 1].trim() === '</script>') { idxIifeClose = i; break; }
  }
  if (idxIifeClose === -1) throw new Error("couldn't find the closing '})();\\n</script>' pair");
  const idxScriptCloseTag = idxIifeClose + 1;

  return {
    lines,
    htmlHead: lines.slice(0, idxStyleOpen),
    cssLines: lines.slice(idxStyleOpen + 1, idxStyleClose),
    htmlOverlays: lines.slice(idxStyleClose + 1, idxScriptOpen), // includes the cdnjs + sim.js <script src> tags, unchanged
    bodyLines: lines.slice(bodyStart, idxIifeClose),
    bodyStartLineNo: bodyStart + 1, // 1-based, for warning messages
    epilogue: lines.slice(idxScriptCloseTag + 1), // normally just [''] (the file's trailing newline)
  };
}

// Cuts bodyLines into modules per MANIFEST. Never reorders anything -- just decides, banner by
// banner, which module is "open".
function splitBody(bodyLines, bodyStartLineNo) {
  const modules = MANIFEST.map(m => ({ file: m.file, note: m.note, lines: [] }));
  const unknownBanners = [];
  let cur = 0;
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const m = BANNER_RE.exec(line.trim());
    if (m) {
      const title = m[1];
      let matched = -1;
      for (let j = cur + 1; j < MANIFEST.length; j++) {
        if (MANIFEST[j].match.test(title)) { matched = j; break; }
      }
      if (matched !== -1) cur = matched;
      else unknownBanners.push({ title, landedIn: modules[cur].file, line: bodyStartLineNo + i });
    }
    modules[cur].lines.push(line);
  }
  return { modules: modules.filter(m => m.lines.length > 0), unknownBanners };
}

// Heuristic scans -- not a real parser, just column-0 pattern matching, which this file's own
// formatting (top-level decls always start at column 0) makes reliable enough to be useful. Both
// are advisory: the smoke test is the real verifier, since it actually runs the split output in a
// browser and would surface a ReferenceError from a genuine hoisting problem immediately.
function scanGlobalCollisions(modules) {
  const hits = [];
  for (const mod of modules) {
    for (const line of mod.lines) {
      const m = /^(?:const|let)\s+([A-Za-z_$][\w$]*)/.exec(line);
      if (m && RISKY_GLOBALS.has(m[1])) hits.push({ file: mod.file, name: m[1] });
    }
  }
  return hits;
}

// Strips the noise that otherwise swamps the hoisting scan with false positives: line comments,
// string/template literal contents (so words INSIDE a string, e.g. 'time <hh:mm>', don't look like
// identifier references), and object-literal property keys (`foo:` -- a key, not a reference).
// Not a tokenizer, just enough to make the column-0 heuristic below usable.
function stripNoise(line) {
  let s = line.replace(/\/\/.*$/, '');
  s = s.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');
  s = s.replace(/([A-Za-z_$][\w$]*)\s*:(?!:)/g, ':'); // drop object-literal keys (keeps ternary false negatives, which is fine -- advisory only)
  return s;
}

function scanHoisting(modules, bodyStartLineNo) {
  // name -> index of the module that FIRST declares it at top level (column 0)
  const declModule = new Map();
  modules.forEach((mod, mi) => {
    for (const line of mod.lines) {
      const m = DECL_RE.exec(line);
      const name = m && (m[1] || m[2] || m[3]);
      if (name && !declModule.has(name)) declModule.set(name, mi);
    }
  });
  const warnings = [];
  let lineNo = bodyStartLineNo - 1;
  modules.forEach((mod, mi) => {
    for (const line of mod.lines) {
      lineNo++;
      if (!/^[A-Za-z_$]/.test(line) && line.trim() !== '') continue; // only true column-0 statements
      // A top-level `function name(...) { ... }` declaration's body only runs when called, by
      // which point every script has loaded -- so it's not a load-time hoisting hazard, and
      // scanning inside it (this codebase writes whole function bodies on one line) is pure noise.
      if (/^function\s+[A-Za-z_$][\w$]*\s*\(/.test(line)) continue;
      const d = DECL_RE.exec(line);
      // Scan for forward references, skipping the declared name itself if this line declares one.
      const rest = stripNoise(d ? line.slice(d[0].length) : line);
      let mm;
      IDENT_RE.lastIndex = 0;
      const seen = new Set();
      while ((mm = IDENT_RE.exec(rest))) {
        const name = mm[0];
        if (seen.has(name)) continue;
        seen.add(name);
        const declaredAt = declModule.get(name);
        if (declaredAt !== undefined && declaredAt > mi) {
          warnings.push({ file: mod.file, line: lineNo, name, declaredIn: modules[declaredAt].file });
        }
      }
    }
  });
  return warnings;
}

function computeSplit(raw) {
  const doc = parseDocument(raw);
  const { modules, unknownBanners } = splitBody(doc.bodyLines, doc.bodyStartLineNo);
  const globalCollisions = scanGlobalCollisions(modules);
  const hoistingWarnings = scanHoisting(modules, doc.bodyStartLineNo);
  const cssContent = doc.cssLines.join('\n');

  const newIndexLines = [
    ...doc.htmlHead,
    '<link rel="stylesheet" href="css/game.css">',
    ...doc.htmlOverlays,
    ...modules.map(m => `<script src="js/${m.file}"></script>`),
    ...doc.epilogue,
  ];

  return { doc, modules, unknownBanners, globalCollisions, hoistingWarnings, cssContent, newIndexHtml: newIndexLines.join('\n') };
}

// The fixed preamble every module file gets: 'use strict'; plus one single-line header comment.
// Kept to exactly MODULE_PREAMBLE_LINES physical lines -- runCheck() strips exactly that many
// lines back off when verifying the round trip, so if you change this, update that constant too.
const MODULE_PREAMBLE_LINES = 2;
function modulePreamble(mod) {
  return `'use strict';\n/* public/js/${mod.file} -- ${mod.note}. Generated by scripts/split-client.mjs; see ARCHITECTURE.md. */\n`;
}
function moduleFileContent(mod) {
  return modulePreamble(mod) + mod.lines.join('\n') + '\n';
}

function reportSplit(split) {
  console.log('Modules:');
  let total = 0;
  for (const m of split.modules) {
    console.log(`  public/js/${m.file.padEnd(16)} ${String(m.lines.length).padStart(5)} lines  (${m.note})`);
    total += m.lines.length;
  }
  console.log(`  ${'total'.padEnd(23)} ${String(total).padStart(5)} lines`);
  console.log(`  public/css/game.css     ${String(split.doc.cssLines.length).padStart(5)} lines`);

  if (split.unknownBanners.length) {
    console.log('\nWARNING: unrecognized section banners (folded into the preceding module; update MANIFEST in scripts/split-client.mjs):');
    for (const u of split.unknownBanners) console.log(`  line ${u.line}: "${u.title}" -> landed in ${u.landedIn}`);
  }
  if (split.globalCollisions.length) {
    console.log('\nWARNING: top-level const/let/class names that collide with a window global:');
    for (const g of split.globalCollisions) console.log(`  ${g.file}: ${g.name}`);
  }
  if (split.hoistingWarnings.length) {
    console.log('\nWARNING: possible hoisting issues (heuristic -- a top-level statement appears to reference a name whose only top-level declaration is in a LATER module; verify with the smoke test):');
    for (const h of split.hoistingWarnings) console.log(`  ${h.file} line ${h.line}: '${h.name}' first declared in ${h.declaredIn}`);
  }
}

function writeArchitectureDoc(split) {
  const moduleRows = ['| File | Responsibility |', '|---|---|', ...split.modules.map(m => `| \`public/js/${m.file}\` | ${m.note} |`)].join('\n');
  const doc = `# Camp Green Lake -- architecture

This file is generated (and kept up to date) by \`scripts/split-client.mjs\` -- see that file for
the mechanics. It exists so a human or an AI agent picking up a feature branch can find where code
lives without re-deriving it.

## How the client is put together

\`public/index.html\` used to be one file: CSS in a \`<style>\` block, HTML overlays (HUD, menus,
the console), then one big \`<script>\` whose body was an IIFE. It's now split into:

- \`public/css/game.css\` -- all the CSS, verbatim, loaded with a plain \`<link>\`.
- \`public/index.html\` -- just the markup: overlay \`<div>\`s, the CSS link, the cdnjs three.js
  tag, the \`sim.js\` tag, and then the module \`<script src="js/...">\` tags below, in load order.
- \`public/js/NN-name.js\` -- the game logic, cut into ordered files (below).
- \`public/sim.js\` -- shared rules (the team quota, heavy loot, night monsters). Loaded by the
  page AND \`require\`'d directly by \`server.js\`, so the server and every client run exactly the
  same math for anything that has to agree (who reached quota, whether a twister caught you).
  It exports itself as \`module.exports\` under Node and as \`root.SIM\` in the browser -- see the
  last line of the file. Don't move game logic that the server also needs to care about out of
  here; anything only the client needs (rendering, input, UI) belongs in \`public/js/\`.
- \`server.js\` -- a small Node + \`ws\` server. It serves the client files (see below), relays
  player positions/digs/chat/hazards over WebSocket, and keeps the one shared world (dug holes,
  found items, the KB tube, the suitcase, heavy props) so late joiners see the same camp. It does
  NOT run the renderer or any Three.js code -- only \`public/sim.js\`'s pure functions.

## Load order, and why it matters

\`public/index.html\` loads scripts as plain classic \`<script src>\` tags, in this order:

1. \`https://cdnjs.cloudflare.com/.../three.min.js\` (r128, from cdnjs)
2. \`sim.js\`
3. \`public/js/10-core.js\` ... \`public/js/99-boot.js\`, in ascending numeric order

${moduleRows}

**The global-scope rule.** These are classic scripts, not ES modules -- no \`type="module"\`, no
\`import\`/\`export\`. Top-level \`const\`/\`let\`/\`class\`/\`function\` in a classic \<script\> at the
top of a page all live in the SAME global lexical scope, shared across every \<script\> tag on that
page. That's the whole trick: \`public/js/40-people.js\` can freely reference a \`const\` declared in
\`public/js/10-core.js\` with no import, exactly as if the file boundary didn't exist. This is why
the split needed no code rewriting -- only cutting the original script into ordered pieces.

**The hoisting caveat.** \`function\` declarations are hoisted to the top of their OWN \`<script>\`,
not across script tags. If file A has a top-level statement that runs immediately (at load time,
not inside a callback) and calls a function only declared in a later file B, that throws
\`ReferenceError\` the moment A's script runs, before B has even loaded. \`scripts/split-client.mjs\`
does a best-effort static scan for this (see its \`--write\`/\`--check\` output for warnings), but
the real check is the smoke test (\`npm test\`), which actually loads the split page in a browser --
any such problem shows up immediately as a \`pageerror\`. If you hit one: either move the split
point so the two things end up in the same file, reorder the manifest in
\`scripts/split-client.mjs\` so the callee's file loads first, or (for something that's only ever
supposed to run once everything else is ready, like the boot-time debug hooks) move the offending
call into \`public/js/99-boot.js\`, which always loads last.

**Global-name collisions.** A top-level \`let\`/\`const\`/\`class\` at the top of a page can collide
with a real property of \`window\` (\`top\`, \`self\`, \`name\`, \`location\`, \`history\`, \`status\`,
\`screen\`, \`event\`, ... -- see \`RISKY_GLOBALS\` in \`scripts/split-client.mjs\`). Some of these throw
a \`SyntaxError\` the instant the script parses; others silently shadow the real global for the rest
of the page. The splitter scans for this and prints a warning; if you add a new top-level binding,
give it a name that isn't on that list.

## Adding a new feature

1. Add your code to \`public/index.html\` under a section banner:
   \`/* ---------- your feature ---------- */\`, in whichever file/section it conceptually belongs
   near (this only matters again once someone re-runs the splitter -- day to day, before the next
   split, the file is still one script and banners are just comments).
2. When it's time to re-run the splitter (see workflow below) and your banner doesn't match
   anything in \`MANIFEST\` (in \`scripts/split-client.mjs\`), it will print a warning telling you
   which file it landed in by default (whatever file was "open" at that point). Add an explicit
   entry to \`MANIFEST\` for it if it deserves its own file or a different home.
3. Keep the manifest's file order matching the order sections actually appear in
   \`public/index.html\` -- the splitter cuts contiguous ranges, it does not reorder, so a manifest
   entry has to appear in an order consistent with where its banner actually sits in the source.

## The ENV hazard registry + developer console pattern

Environmental hazards (twisters, and whatever else gets added -- landslides, etc.) are spawned
through one registry, \`ENV\`, keyed by hazard name: \`ENV.sandstorm = {spawn: o => ...}\` where
\`o\` is \`{x, z, a}\` (position + heading). The server only relays *that* a host spawned a hazard of
a given kind, position and heading (see the \`'env'\` case in \`server.js\`); every client builds the
identical hazard client-side from those three numbers, so nothing bulky needs to go over the wire.

The developer console (backtick to open) registers commands the same way, one \`command(...)\` call
per command, e.g. \`command('twister', {usage: ..., help: ..., run(args) { ...; return 'reply' }})\`.
Adding a hazard usually means one \`ENV.xyz = {...}\` entry plus one \`command('xyz', ...)\` that calls
\`spawnAhead('xyz', dist)\`. See the README's "Developer console" section for the full command list.

## Branch / test workflow

- \`npm test\` (\`tests/smoke.mjs\`) starts the server, drives it with Playwright + headless
  Chromium, and fails on any page error or console error, whether the client is split or not. Run
  it before and after re-running the splitter.
- \`npm run split:check\` runs the splitter in \`--check\` mode: it splits into a temp directory,
  verifies the CSS/HTML/JS all round-trip back to exactly the current \`public/index.html\`, and
  exits non-zero on any mismatch. It never touches \`public/\`.
- \`npm run split\` runs it for real (\`--write\`), in place.
- The intended sequence, once the parallel feature branches above have merged: merge everything
  into \`public/index.html\` as one file (as today), run \`npm test\` (must pass unsplit), run
  \`npm run split\`, run \`npm test\` again (must pass split), commit the split output. Do this once,
  not per-branch -- splitting earlier would make every one of those branches conflict on the same
  file for no reason.
`;
  fs.writeFileSync(ARCH_PATH, doc);
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const write = args.includes('--write');
  if (check === write) {
    console.error('Usage: node scripts/split-client.mjs --check | --write');
    process.exit(2);
  }

  const raw = fs.readFileSync(INDEX_PATH, 'utf8');
  if (isAlreadySplit(raw)) {
    console.log('public/index.html is already split (found css/game.css link + public/js/*.js modules). Nothing to do.');
    process.exit(0);
  }

  let split;
  try {
    split = computeSplit(raw);
  } catch (e) {
    console.error('split-client: could not parse public/index.html:', e.message);
    process.exit(1);
  }

  reportSplit(split);

  if (check) {
    runCheck(raw, split);
  } else {
    runWrite(split);
  }
}

// Writes the computed split to a scratch directory, reads it back off disk, and verifies that
// re-assembling everything reproduces the current public/index.html exactly (css and html
// byte-for-byte, and the JS modules' own content -- with the fixed 2-line 'use strict'/comment
// preamble we add stripped back off -- concatenating back to the exact original script body).
function runCheck(raw, split) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-split-check-'));
  try {
    fs.mkdirSync(path.join(tmp, 'css'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'js'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'css', 'game.css'), split.cssContent);
    for (const mod of split.modules) fs.writeFileSync(path.join(tmp, 'js', mod.file), moduleFileContent(mod));
    fs.writeFileSync(path.join(tmp, 'index.html'), split.newIndexHtml);

    const problems = [];

    // CSS round-trip
    const cssBack = fs.readFileSync(path.join(tmp, 'css', 'game.css'), 'utf8');
    if (cssBack !== split.doc.cssLines.join('\n')) problems.push('css/game.css did not round-trip');

    // JS round-trip: strip the fixed 4-line preamble we know we wrote, compare the rest.
    let reassembled = [];
    for (const mod of split.modules) {
      const text = fs.readFileSync(path.join(tmp, 'js', mod.file), 'utf8');
      const fileLines = text.split('\n');
      const body = fileLines.slice(MODULE_PREAMBLE_LINES, fileLines.length - 1); // drop trailing '' from final \n
      reassembled.push(...body);
    }
    const originalBody = split.doc.bodyLines;
    if (reassembled.length !== originalBody.length || reassembled.some((l, i) => l !== originalBody[i])) {
      problems.push(`JS modules did not round-trip to the original script body (${reassembled.length} vs ${originalBody.length} lines)`);
    }

    // Full-document round trip: rebuild what the ORIGINAL public/index.html looked like from the
    // split pieces, and diff against the actual original bytes.
    const rebuiltOriginal = [
      ...split.doc.htmlHead,
      '<style>',
      ...split.doc.cssLines,
      '</style>',
      ...split.doc.htmlOverlays,
      '<script>',
      '(function(){',
      "'use strict';",
      ...originalBody,
      '})();',
      '</script>',
      ...split.doc.epilogue,
    ].join('\n');
    if (rebuiltOriginal !== raw) problems.push('reconstructed document does not match the original public/index.html byte-for-byte');

    // Sanity-check the new index.html itself.
    const newHtml = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    if (/<style>/.test(newHtml)) problems.push('new index.html still contains an inline <style> block');
    if (/\(function\(\)\{/.test(newHtml)) problems.push('new index.html still contains the inline IIFE script');
    if (!/<link rel="stylesheet" href="css\/game\.css">/.test(newHtml)) problems.push('new index.html is missing the css/game.css <link>');
    for (const mod of split.modules) {
      if (!newHtml.includes(`<script src="js/${mod.file}"></script>`)) problems.push(`new index.html is missing <script src="js/${mod.file}">`);
    }

    if (problems.length) {
      console.error('\nFAIL:');
      for (const p of problems) console.error('  - ' + p);
      process.exit(1);
    }
    console.log('\nOK: round-trip verified (css, html, and all JS modules reproduce the original file exactly).');
    process.exit(0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function runWrite(split) {
  fs.mkdirSync(path.dirname(CSS_PATH), { recursive: true });
  fs.mkdirSync(JS_DIR, { recursive: true });
  fs.writeFileSync(CSS_PATH, split.cssContent);
  for (const mod of split.modules) fs.writeFileSync(path.join(JS_DIR, mod.file), moduleFileContent(mod));
  fs.writeFileSync(INDEX_PATH, split.newIndexHtml);
  writeArchitectureDoc(split);
  console.log('\nWrote public/css/game.css, public/js/*.js, rewrote public/index.html, and wrote ARCHITECTURE.md.');
}

main();
