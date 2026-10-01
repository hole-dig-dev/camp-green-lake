#!/usr/bin/env node
// tests/smoke.mjs
//
// End-to-end smoke test for Camp Green Lake. Starts the real server (against a scratch data
// directory, never the repo's own data/world.json), drives it with Playwright + headless
// Chromium, and checks the basics actually work: the title screen renders, you can start, move,
// dig, spawn a twister, use the developer console, and two browsers can see each other. Fails on
// any page error or (non-whitelisted) console error. Meant to run unchanged whether
// public/index.html is the single unsplit file or the split public/js/*.js + public/css/*.css
// output of scripts/split-client.mjs -- that's the whole point of it.
//
// Usage: node tests/smoke.mjs   (also wired up as `npm test`)

import net from 'node:net';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// Ask the OS for a free port instead of a fixed list: with fixed ports, a second smoke run (another agent, CI,
// a teammate) already listening on the same port could answer our /healthz check before our own server failed
// to bind, and the two runs' players would end up in each other's games.
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref(); srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}
// Use the real GPU (minipc's Radeon 760M via Vulkan) whenever a render node is usable; software GL
// (swiftshader) pins 6-7 CPU cores per run. Falls back to swiftshader on GPU-less CI, or force it
// with SMOKE_GL=swiftshader.
function gpuUsable() {
  try { fs.accessSync('/dev/dri/renderD128', fs.constants.R_OK | fs.constants.W_OK); return true; } catch { return false; }
}
const USE_GPU = process.env.SMOKE_GL !== 'swiftshader' && gpuUsable();
const LAUNCH_ARGS = USE_GPU
  ? ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan',
     '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl']
  : ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];

// Console/page noise that's expected from a software GL renderer in a headless CI box and isn't a
// real bug. Anything else logged as an error, or any uncaught page error, fails the run.
const HARMLESS = [
  /SwiftShader/i,
  /GPU stall due to ReadPixels/i,
  /Failed to load resource.*favicon/i,
  /WebGL.*[Pp]erformance [Cc]aveat/i,
  /Automatic fallback to software WebGL/i,
];

const steps = []; // {name, ok, detail}
function record(name, ok, detail) { steps.push({ name, ok, detail }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function waitForHealthz(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) return;
    } catch (e) { lastErr = e; }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`server never answered /healthz on port ${port}: ${lastErr}`);
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-smoke-data-'));
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = await freePort();
    const out = [];
    const child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: dataDir, HOST_TOKEN: 'smoke-test-token' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', d => out.push(d.toString()));
    child.stderr.on('data', d => out.push(d.toString()));
    const exited = new Promise(resolve => child.once('exit', resolve));
    let exitedEarly = false;
    exited.then(() => { exitedEarly = true; });
    try {
      await Promise.race([
        waitForHealthz(port, 5000),
        exited.then(() => { throw new Error(`server exited early on port ${port}:\n${out.join('')}`); }),
      ]);
      if (exitedEarly) throw new Error(`server exited early on port ${port}:\n${out.join('')}`);
      return { port, child, dataDir, log: () => out.join('') };
    } catch (e) {
      lastError = e;
      try { child.kill(); } catch (e2) { /* already gone */ }
    }
  }
  throw new Error(`could not start the server after 3 attempts: ${lastError}`);
}

// Software-rendered WebGL (swiftshader) under load can leave the page's main thread badly
// congested for seconds at a time -- long enough that Playwright's `waitForSelector` (which
// partly relies on layout/accessibility-tree snapshots) can time out even though the DOM state it
// is waiting for already changed. `waitForFunction` with an explicit poll interval just re-runs a
// plain JS predicate in the page, which is far more reliable here, so every wait in this test uses
// that instead of a CSS-attribute selector wait.
// The server autosaves data/world.json on a timer and again on shutdown; kill() only sends the
// signal, it doesn't wait for that in-flight write+rename to finish, so an immediate rmSync can
// occasionally see the directory change out from under it (ENOTEMPTY). Wait for the process to
// actually exit, then give rmSync a couple of retries.
async function stopServerAndCleanup(serverProc, dataDir) {
  serverProc.kill();
  await Promise.race([
    new Promise(r => serverProc.once('exit', r)),
    new Promise(r => setTimeout(r, 2000)),
  ]);
  for (let attempt = 0; attempt < 3; attempt++) {
    try { fs.rmSync(dataDir, { recursive: true, force: true }); return; } catch (e) {
      if (attempt === 2) console.error(`warning: could not remove ${dataDir}: ${e.message}`);
      else await new Promise(r => setTimeout(r, 200));
    }
  }
}

function waitFor(page, fn, timeoutMs, what, arg) {
  return page.waitForFunction(fn, arg, { timeout: timeoutMs, polling: 200 })
    .catch(e => { throw new Error(`timed out waiting for: ${what} (${e.message})`); });
}

function attachPageWatchers(page, label, errors) {
  page.on('pageerror', err => errors.push(`[${label}] pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (HARMLESS.some(re => re.test(text))) return;
    errors.push(`[${label}] console.error: ${text}`);
  });
}

async function main() {
  const t0 = Date.now();
  const { port, child: serverProc, dataDir, log } = await startServer();
  record('server started', true, `port ${port}`);

  // Headless needs no X server. An inherited DISPLAY that points at a dead one (a stopped Xvfb) makes the GPU
  // process fail its xcb_connect and exit, and then no page gets WebGL at all -- so drop it.
  const { DISPLAY, ...browserEnv } = process.env;
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS, env: browserEnv });
  const errors = [];
  let screenshotPath = null;
  try {
    // Small viewport: this is a full 3D scene rendered by Chromium's software (swiftshader) GL
    // path in CI/headless environments -- every pixel is rasterized on the CPU, so a smaller
    // canvas matters a lot for speed (and for not tipping over a loaded shared box).
    const ctx1 = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page1 = await ctx1.newPage();
    attachPageWatchers(page1, 'p1', errors);

    await page1.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load' });
    await waitFor(page1, () => !!window.__cgl, 15000, 'window.__cgl to appear');
    record('page loaded, window.__cgl present', true);
    const clip = await fetch(`http://127.0.0.1:${port}/audio/shovel.mp3`);
    assert(clip.ok && clip.headers.get('content-type') === 'audio/mpeg' && (await clip.arrayBuffer()).byteLength > 1000, 'CC0 audio file was not served');
    record('CC0 sound files are served as audio', true);

    const titleOk = await page1.evaluate(() => {
      const title = document.querySelector('#title'), btn = document.querySelector('#startBtn');
      return !!title && !title.hidden && !!btn;
    });
    assert(titleOk, 'title screen (#title / #startBtn) did not render');
    record('title screen renders', true);

    // A real Playwright mouse click waits for the element to be visually "stable" across frames,
    // which under software-rendered WebGL can take a very long time (the scene keeps repainting).
    // Dispatching the click programmatically still fires the game's onclick handler, just without
    // that (here, pointless) wait.
    await page1.evaluate(() => document.querySelector('#startBtn').click());
    await waitFor(page1, () => document.querySelector('#hud') && !document.querySelector('#hud').hidden, 20000, 'HUD to show after start');
    record('HUD shows after start', true);
    await waitFor(page1, () => audioBuffers.has('shovel') && audioBuffers.has('step-sand-1'), 20000, 'CC0 clips to decode');
    record('dig and footstep recordings decode in the browser', true);
    const audioModes = await page1.evaluate(() => {
      const initial = AUDIO_MODE.wind;
      window.__cgl.runCommand('audio wind new');const recorded = AUDIO_MODE.wind;
      window.__cgl.runCommand('audio old');const allOld = Object.values(AUDIO_MODE).every(v => v === 'original');
      window.__cgl.runCommand('audio new');const allNew = Object.values(AUDIO_MODE).every(v => v === 'recorded');
      window.__cgl.runCommand('audio wind old');return { initial, recorded, allOld, allNew, restored: AUDIO_MODE.wind };
    });
    assert(audioModes.initial === 'original' && audioModes.recorded === 'recorded' && audioModes.allOld && audioModes.allNew && audioModes.restored === 'original', 'audio A/B switch did not preserve the original wind or switch every category');
    record('audio A/B switches wind and every changed sound category', true);
    await page1.waitForTimeout(400); // let the join round-trip (host flag, etc.) land

    // Poll for the effect rather than trusting a fixed wall-clock wait: under software-rendered
    // WebGL the game can run at a handful of FPS (its own frame loop drives simulated time), so a
    // fixed short wait is unreliable -- give it a generous ceiling and stop as soon as it's true.
    const before = await page1.evaluate(() => ({ x: window.__cgl.P.x, z: window.__cgl.P.z }));
    await page1.keyboard.down('w');
    let moved = 0;
    try {
      await waitFor(page1, b => Math.hypot(window.__cgl.P.x - b.x, window.__cgl.P.z - b.z) > 0.5, 15000, 'player to move while holding W', before);
    } finally {
      await page1.keyboard.up('w');
    }
    const after = await page1.evaluate(() => ({ x: window.__cgl.P.x, z: window.__cgl.P.z }));
    moved = Math.hypot(after.x - before.x, after.z - before.z);
    record('holding W moves the player', true, `${moved.toFixed(1)}m`);

    // Room IDs matter for both shelter and multiplayer visibility. Exercise the real use action
    // at each door, then verify the larger D room and the Warden's office are reachable.
    const rooms = await page1.evaluate(() => {
      const c = window.__cgl;
      c.P.x = 0; c.P.z = 47 - c.TENTS[2].hd - 1.3; c.P.y = c.groundAt(c.P.x, c.P.z);
      c.use();
      const d = { inside: c.S.tent === 2, width: c.TENTS[2].roomW * 2, depth: c.TENTS[2].roomD * 2 };
      c.exitTent();
      c.P.x = -30; c.P.z = 45 - c.TENTS[4].hd - 1.3; c.P.y = c.groundAt(c.P.x, c.P.z);
      c.use();
      const office = { inside: c.S.tent === 4, spot: null };
      c.P.x = c.TENTS[4].desk.x; c.P.z = c.TENTS[4].desk.z;
      office.spot = c.nearSpot()?.id;
      c.exitTent();
      c.P.yaw = 0; // the digging check below faces -z
      return { d, office, outside: c.S.tent === null };
    });
    assert(rooms.d.inside && rooms.d.width >= 18 && rooms.d.depth >= 16, 'D Tent must open into a broad walkable room');
    assert(rooms.office.inside && rooms.office.spot === 'office' && rooms.outside, "Warden's office must be enterable, usable and exitable");
    record('large D Tent and Warden office work', true);

    const fence = await page1.evaluate(() => {
      const c = window.__cgl;
      c.P.x = 10; c.P.z = 26.5; c.P.y = c.groundAt(10, 26.5); c.P.yaw = Math.PI;
      c.KEYS.w = true; c.KEYS[' '] = true;
      for (let i = 0; i < 80; i++) updatePlayer(0.05);
      const wallZ = c.P.z;
      c.KEYS[' '] = false;
      c.P.x = 0; c.P.z = 26.5; c.P.y = c.groundAt(0, 26.5); c.P.vy = 0;
      for (let i = 0; i < 30; i++) updatePlayer(0.05);
      c.KEYS.w = false;
      c.P.yaw = 0; c.P.fa = Math.PI; // face -z again: the dig check below looks for its hole 1.1 m to the north
      return { wallZ, gateZ: c.P.z };
    });
    assert(fence.wallZ < 27 && fence.gateZ > 30, 'fence must block a jump while its gate stays passable');
    record('fence blocks jumps and main gate opens', true);

    // scoop() digs into a spot ~1.1m in front of wherever the player is facing, not at the
    // player's own feet -- so the '#depth' HUD readout (which reports the hole under the
    // player, via holeDepthHere() = baseH(P.x,P.z) - P.y) stays "0.0 ft" while you're digging
    // and only reflects it once you're actually standing over the dug spot. Facing is locked to
    // yaw 0 here (no mouse look), so "in front" is straight toward -z; teleport onto that exact
    // spot afterward rather than trying to walk it (which, at software-rendered frame rates,
    // risks over/undershooting a 1.1m target).
    await page1.evaluate(() => { window.__cgl.runCommand('tp 0 120'); window.__cgl.runCommand('time 13:00'); });
    await page1.waitForTimeout(200);
    await page1.keyboard.down('e');
    await page1.waitForTimeout(3000); // several scoops' worth, generous for a slow software-rendered frame rate
    await page1.keyboard.up('e');
    await page1.evaluate(() => window.__cgl.runCommand('tp 0 121.1'));
    await waitFor(page1, () => document.querySelector('#depth').textContent !== '0.0 ft', 5000, 'depth readout to reflect the just-dug hole');
    const depthText = await page1.$eval('#depth', el => el.textContent);
    record('digging on the lake bed changes hole depth', true, depthText);

    // The D Tent crew keep a schedule: home at the curfew siren, shovels on the rack, asleep without them (Jim Bob deals
    // until 01:00), and out again with their shovels in the morning. The clock is paused at each hour and the crew's
    // update is stepped by hand, so this doesn't wait on real time.
    const crew = await page1.evaluate(() => {
      const step = (h, secs) => { CLK.paused = true; CLK.pt = tAtHour(h); for (let i = 0; i < secs * 10; i++) updateBots(0.1, performance.now()) };
      const snap = () => bots.map(b => ({ n: b.d.n, st: b.state, stowed: !!b.p.stowed, racked: RACK[bots.indexOf(b)].mesh.visible, xs: !!b.xraySleeps, y: +b.p.g.position.y.toFixed(1) }));
      const OUT = new Set(['dig', 'rest', 'walk', 'return', 'gatebackin', 'gatebackout']);
      step(17, 2);
      step(19, 0.1); const atSiren = snap();
      step(21, 120); const night = snap();
      step(2, 30); const late = snap();
      // morning: each should get up, take their shovel and step outside at least once within 90 s of dawn (after that,
      // a daytime break can send them back to the tent, so check "has been out", not "is out")
      const wasOut = new Set();CLK.paused = true; CLK.pt = tAtHour(6);
      for (let i = 0; i < 900; i++) { updateBots(0.1, performance.now()); for (const b of bots) if (OUT.has(b.state) && !b.p.stowed && b.p.g.position.y > TENT_FLOOR_Y + 1) wasOut.add(b.d.n) }
      const morning = snap().map(b => ({ ...b, wasOut: wasOut.has(b.n) }));
      CLK.paused = false;
      return { atSiren, night, late, morning,
        sirenOk: atSiren.every(b => !['dig', 'rest', 'walk', 'return', 'gatebackout'].includes(b.st)),
        nightOk: night.every(b => b.st === 'inside' && b.stowed && b.racked && (b.n === 'Jim Bob' ? !b.xs : true)),
        lateOk: late.find(b => b.n === 'Jim Bob').xs && late.every(b => b.st === 'inside'),
        morningOk: morning.every(b => b.wasOut) };
    });
    assert(crew.sirenOk, `crew kept working through the siren: ${JSON.stringify(crew.atSiren)}`);
    assert(crew.nightOk, `crew not all in bed with shovels racked by 21:00: ${JSON.stringify(crew.night)}`);
    assert(crew.lateOk, `Jim Bob not in bed after 01:00: ${JSON.stringify(crew.late)}`);
    assert(crew.morningOk, `crew not all out with their shovels within 90 s of dawn: ${JSON.stringify(crew.morning)}`);
    record('D Tent crew: home at the siren, shovels racked, Jim Bob deals till 01:00, out with shovels by morning', true);

    await page1.evaluate(() => window.__cgl.runCommand('twister 30'));
    await waitFor(page1, () => window.__cgl.TW_LIVE.size > 0, 5000, 'TW_LIVE to gain an entry'); // TW_LIVE is a Map -- .size, not .length
    const twCount = await page1.evaluate(() => window.__cgl.TW_LIVE.size);
    record('twister command spawns a twister', true, `TW_LIVE.size=${twCount}`);

    const conLogBefore = await page1.$eval('#conLog', el => el.textContent.length);
    await page1.evaluate(() => window.__cgl.runCommand('help'));
    const conLogAfterHelp = await page1.$eval('#conLog', el => el.textContent);
    assert(conLogAfterHelp.length > conLogBefore, 'runCommand("help") should print to the console log');
    record('help command prints output', true);

    await page1.keyboard.press('Backquote');
    await waitFor(page1, () => document.querySelector('#console') && !document.querySelector('#console').hidden, 5000, 'console to open on backquote');
    record('backquote opens the console', true);
    await page1.keyboard.press('Backquote');
    await waitFor(page1, () => document.querySelector('#console') && document.querySelector('#console').hidden, 5000, 'console to close on backquote');
    record('backquote closes the console', true);

    // Second browser context: connect, start, and confirm each side sees the other.
    const ctx2 = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page2 = await ctx2.newPage();
    attachPageWatchers(page2, 'p2', errors);
    await page2.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load' });
    await waitFor(page2, () => !!window.__cgl, 15000, 'window.__cgl to appear (p2)');
    await page2.evaluate(() => document.querySelector('#startBtn').click());
    await waitFor(page2, () => document.querySelector('#hud') && !document.querySelector('#hud').hidden, 20000, 'HUD to show after start (p2)');

    // Give the join broadcasts a moment to reach each other, then check both directions.
    await waitFor(page1, () => document.querySelector('#onlineList').textContent !== 'Just you', 20000, 'p1 to see another camper');
    await waitFor(page2, () => document.querySelector('#onlineList').textContent !== 'Just you', 20000, 'p2 to see another camper');
    const seenByP1 = await page1.$eval('#onlineList', el => el.textContent);
    const seenByP2 = await page2.$eval('#onlineList', el => el.textContent);
    record('two browsers see each other', true, `p1 sees "${seenByP1}", p2 sees "${seenByP2}"`);

    await ctx2.close();
    await ctx1.close();

    // Regression test: a returning player with a saved session used to get a black screen on
    // reload. maybeResume() (plus a second, older resume line) ran before the pause-menu section
    // further down the script, so startGame() read pause-menu consts (e.g. SETTINGS) before they
    // were initialised, threw "Cannot access 'SETTINGS' before initialization", and killed the
    // rest of the script -- including the code that shows the HUD and hides the title screen.
    // The fix moved the resume to run once, at the very end of the script. Sessions live in
    // sessionStorage (autosaved by saveSession() every 2s), which persists across reload() within
    // the same tab/context, so this drives it in a fresh context: start, wait out an autosave,
    // reload, and confirm the page comes back alive and auto-resumed instead of going dark.
    const ctx3 = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page3 = await ctx3.newPage();
    attachPageWatchers(page3, 'p3', errors);
    await page3.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load' });
    await waitFor(page3, () => !!window.__cgl, 15000, 'window.__cgl to appear (p3)');
    await page3.evaluate(() => document.querySelector('#startBtn').click());
    await waitFor(page3, () => document.querySelector('#hud') && !document.querySelector('#hud').hidden, 20000, 'HUD to show after start (p3)');
    await page3.waitForTimeout(400);
    await page3.evaluate(() => {
      const c = window.__cgl, t = c.TENTS[2];
      c.P.x = t.x; c.P.z = t.z - t.hd - 1.3; c.P.y = c.groundAt(c.P.x, c.P.z);
      c.use();
    });
    assert(await page3.evaluate(() => window.__cgl.S.tent === 2), 'D Tent entry failed before reload');
    await page3.waitForTimeout(3000); // saveSession()'s setInterval autosaves to sessionStorage every 2s

    const errorsBeforeReload = errors.length;
    await page3.reload({ waitUntil: 'load' });
    await waitFor(page3, () => !!window.__cgl, 15000, 'window.__cgl to appear after reload');
    // The old bug threw during script init, before later handlers (like mousemove, used for
    // look/aim) were even attached -- move the mouse to make sure that path survived too.
    await page3.mouse.move(400, 300);
    await page3.mouse.move(420, 320);
    await waitFor(page3, () => document.querySelector('#hud') && !document.querySelector('#hud').hidden, 10000, 'HUD to show after reload (auto-resume)');

    const resumedOk = await page3.evaluate(() => {
      const title = document.querySelector('#title'), hud = document.querySelector('#hud');
      return !!title && title.hidden && !!hud && !hud.hidden;
    });
    assert(resumedOk, 'saved session did not auto-resume after reload (#title should be hidden, #hud visible)');
    assert(await page3.evaluate(() => window.__cgl.S.tent === 2 && window.__cgl.P.y === -4), 'saved interior position did not resume inside D Tent');
    const newErrors = errors.slice(errorsBeforeReload);
    assert(newErrors.length === 0, 'page/console errors after reload:\n' + newErrors.map(e => '  - ' + e).join('\n'));
    record('returning player auto-resumes after reload without errors', true);
    record('interior position survives reload', true);

    await ctx3.close();

    if (errors.length) {
      throw new Error('page/console errors were reported:\n' + errors.map(e => '  - ' + e).join('\n'));
    }
  } catch (err) {
    if (errors.length) console.log('page errors so far:\n  ' + errors.join('\n  '));
    try {
      const pages = browser.contexts().flatMap(c => c.pages());
      if (pages[0]) {
        screenshotPath = path.join(ROOT, 'tests', 'smoke-failure.png');
        await pages[0].screenshot({ path: screenshotPath }).catch(() => {});
      }
    } catch (e) { /* best effort */ }
    record('FAILED', false, err.message);
    printSummary(Date.now() - t0);
    if (screenshotPath) console.error(`\nScreenshot saved: ${screenshotPath}`);
    console.error(`\nServer log:\n${log()}`);
    await browser.close();
    await stopServerAndCleanup(serverProc, dataDir);
    process.exit(1);
  }

  await browser.close();
  await stopServerAndCleanup(serverProc, dataDir);
  printSummary(Date.now() - t0);
  process.exit(0);
}

function printSummary(ms) {
  console.log('\n--- smoke test summary ---');
  for (const s of steps) console.log(`  [${s.ok ? 'PASS' : 'FAIL'}] ${s.name}${s.detail ? ' -- ' + s.detail : ''}`);
  const failed = steps.some(s => !s.ok);
  console.log(`${failed ? 'FAIL' : 'PASS'} (${(ms / 1000).toFixed(1)}s)`);
}

main().catch(err => {
  console.error('smoke test crashed:', err);
  process.exit(1);
});
