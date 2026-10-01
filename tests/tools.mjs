#!/usr/bin/env node
// tests/tools.mjs
//
// The start of the gold dig (public/js/49-tools.js), with two real browsers against a real server: you start with bare
// hands, the crew shares one wallet, tools cost more with a bigger crew, a bought pan appears at the Supply Depot window
// for anyone to pick up (one holder), dirt scraped by hand goes into the pan, the water truck washes it into gold, Z
// puts it down, and at curfew the Warden takes her quota out of the wallet and keeps the rest.
//
// Usage: node tests/tools.mjs

import net from 'node:net';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const SIM = createRequire(import.meta.url)('../public/sim.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); }
const waitFor = (page, fn, ms, what, arg) => page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }).catch(e => { throw new Error(`timed out waiting for ${what}: ${e.message}`); });

const port = await freePort();
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-tools-'));
const srvOut = [];
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: dataDir, HOST_TOKEN: 'tools-test' }, stdio: ['ignore', 'pipe', 'pipe'] });
srv.stdout.on('data', d => srvOut.push(String(d))); srv.stderr.on('data', d => srvOut.push(String(d)));
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
async function openPlayer(label, name, w = 800, h = 600) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${label}] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/SwiftShader|ReadPixels|favicon|Performance Caveat|fallback to software/i.test(m.text())) errors.push(`[${label}] ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load', timeout: 120000 });
  await waitFor(page, () => !!window.__cgl, 60000, `${label} page`);
  await page.evaluate(n => { document.querySelector('#nick').value = n; document.querySelector('#startBtn').click(); }, name);
  await waitFor(page, () => window.__cgl.S.started && online(), 60000, `${label} started and online`);
  return page;
}

let exit = 1;
try {
  const p1 = await openPlayer('p1', 'Stanley'), p2 = await openPlayer('p2', 'Zero');
  await waitFor(p1, () => remotes.size === 1, 15000, 'p1 to see p2');
  await p1.evaluate(() => { window.__cgl.runCommand('director off'); window.__cgl.runCommand('roster off'); window.__cgl.runCommand('time 09:00'); });

  // --- bare hands ---
  const hands = await p1.evaluate(() => {
    let spot = null; for (let x = -300; x <= 300 && !spot; x += 9) for (let z = -300; z <= -60 && !spot; z += 9) if (!holeNear(x, z, 4) && goldRich(x, z) > 0.9) spot = { x, z };
    P.x = spot.x; P.z = spot.z + 1.1; P.y = groundAt(P.x, P.z); P.fa = Math.PI; P.yaw = 0; clearAff(); S.stam = 100;
    const tools = [...TOOLS_W.values()].length; scoop(); const h = holeNear(spot.x, spot.z, 1.5);
    const r = { tools, hasShovel: !!hasTool('shovel'), mm: h ? +(h.d * 1000).toFixed(2) : null, stam: Math.round(S.stam), spot, hud: document.querySelector('#tools').textContent };
    h.d = HAND_DEPTH; const d0 = h.d; scoop(); r.capped = h.d === d0; return r;
  });
  check('the crew starts with no tools: bare hands', hands.tools === 0 && !hands.hasShovel && /Bare hands/.test(hands.hud), hands);
  check('a handful barely scratches the ground (~1 mm)', hands.mm > 0.4 && hands.mm < 2, hands);
  check('by hand you only get down about a foot and a half', hands.capped, hands);

  // --- one crew wallet ---
  await p1.evaluate(() => window.__cgl.runCommand('give seeds 100'));
  await waitFor(p2, () => S.seeds === 100, 10000, 'p2 to see the crew wallet at 100');
  check('one crew wallet: money p1 gets, p2 sees', await p2.evaluate(() => S.seeds) === 100);
  const cost = await p1.evaluate(() => ({ pan: SIM.toolCost('pan', remotes.size + 1), shop: SHOP.find(s => s.id === 'pan').cost, solo: SIM.toolCost('pan', 1) }));
  check('tools cost more with a bigger crew (2 campers: half as much again)', cost.pan === Math.round(SIM.TOOLS.pan.cost * 1.5) && cost.shop === cost.pan && cost.solo === SIM.TOOLS.pan.cost, cost);

  // --- buying a pan: out of the wallet, onto the ground at the Supply Depot ---
  await p1.evaluate(() => buyTool('pan'));
  await waitFor(p2, () => TOOLS_W.size === 1, 10000, 'p2 to see the new pan');
  const bought = await p2.evaluate(() => { const t = [...TOOLS_W.values()][0]; return { k: t.k, held: t.h, seeds: S.seeds, nearDepot: Math.hypot(t.x - 15.5, t.z - 38.6) < 2 }; });
  check('buying a pan takes it from the crew wallet and puts it out front', bought.k === 'pan' && !bought.held && bought.nearDepot && bought.seeds === 100 - cost.pan, bought);

  // --- one holder: p1 picks it up, p2 can't ---
  await p1.evaluate(() => { const t = [...TOOLS_W.values()][0]; P.x = t.x + 1; P.z = t.z; P.y = groundAt(P.x, P.z); const s = nearSpot(); window.__spot = s && s.id; use(); });
  await waitFor(p1, () => !!hasTool('pan'), 10000, 'p1 to hold the pan');
  check('F at a tool on the ground picks it up', await p1.evaluate(() => window.__spot === 'tool' && !!hasTool('pan')));
  await waitFor(p2, () => [...TOOLS_W.values()][0].h > 0, 10000, 'p2 to see the pan held');
  await p2.evaluate(() => { const t = [...TOOLS_W.values()][0]; wsSend({ t: 'toolTake', id: t.id }); });
  await p2.waitForTimeout(1500);
  check('a tool someone holds can\'t be taken', await p2.evaluate(() => !hasTool('pan')));

  // --- scrape into the pan, wash it at the water truck ---
  const load = await p1.evaluate(s => { P.x = s.x + 4; P.z = s.z + 1.1; P.y = groundAt(P.x, P.z); P.fa = Math.PI; S.stam = 100; for (let i = 0; i < 4; i++) scoop(); return { L: +S.load.L.toFixed(2), g: +S.load.g.toFixed(2), cap: toolCap() }; }, hands.spot);
  check('scraped dirt goes into the pan, up to its 4 L', load.L === load.cap && load.cap === 4 && load.g > 0, load);
  await p1.evaluate(() => { TUNE_OVR['gold.panTime'] = { v: 1 }; P.x = 7.3; P.z = 38.2; P.y = groundAt(P.x, P.z); P.yaw = Math.PI * 0.5; window.__seeds0 = S.seeds + goldFrac; const s = nearSpot(); window.__spot = s && s.id; use(); });
  // (the pan-load time is 1 s above, not 8: headless frames are slow)
  check('at the water truck, F washes the pan', await p1.evaluate(() => window.__spot === 'pan'));
  await waitFor(p1, () => S.load.L === 0, 120000, 'the pan to be washed');
  const washed = await p1.evaluate(l => ({ gold: +(S.seeds + goldFrac - window.__seeds0).toFixed(2), expect: l.g }), load);
  check('washing the pan turns its dirt into the crew\'s gold', Math.abs(washed.gold - washed.expect) < 0.05 && washed.gold > 0, washed);
  await p1.setViewportSize({ width: 1280, height: 720 }); await p1.waitForTimeout(2500);
  await p1.screenshot({ path: path.join(OUT, 'tools-water-truck-1280.png') });

  // --- Z puts it down ---
  await p1.evaluate(() => dropTool());
  await waitFor(p2, () => { const t = [...TOOLS_W.values()][0]; return t && !t.h; }, 10000, 'p2 to see the pan put down');
  check('Z puts the tool down where anyone can pick it up', await p1.evaluate(() => !hasTool('pan')));

  // --- curfew: the Warden takes her quota out of the wallet, the rest stays ---
  const before = await p1.evaluate(() => ({ seeds: S.seeds, quota: RUN.quota, day: RUN.day }));
  await p1.evaluate(() => window.__cgl.runCommand('time 19:58'));
  await waitFor(p1, d => RUN.day === d + 1, 60000, 'curfew to pass', before.day);
  const after = await p1.evaluate(() => ({ seeds: S.seeds, day: RUN.day }));
  check('at curfew the Warden takes her quota; the rest stays in the wallet', after.seeds === before.seeds - before.quota && before.quota > 0, { before, after });

  check('no page errors', errors.length === 0, errors.slice(0, 5));
  exit = results.every(r => r.ok) ? 0 : 1;
} catch (e) {
  console.error('tools test crashed:', e.message);
  console.error(srvOut.join('').slice(-2000));
} finally {
  await browser.close();
  srv.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { }
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  process.exit(exit);
}
