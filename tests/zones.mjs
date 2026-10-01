#!/usr/bin/env node
// tests/zones.mjs
//
// Checks the Peak-style maps (public/js/88-zones.js, 89-zone-canyon.js) end to end: a real server, two headless
// browsers. The crew moves to the Dry Canyon together, the lake camp is set aside and comes back, ledges block, a
// crouching friend gives a leg-up, a dropped rope is shared, and the campfire counts everyone. Takes screenshots
// into tests/out/ (gitignored) so a human or Claude can look at the map.
//
// Usage: node tests/zones.mjs

import net from 'node:net';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); }
const waitFor = (page, fn, ms, what, arg) => page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }).catch(e => { throw new Error(`timed out waiting for ${what}: ${e.message}`); });

const port = await freePort();
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-zones-'));
const srvOut = [];
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: dataDir, HOST_TOKEN: 'zones-test' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  await page.evaluate(n => { const i = document.querySelector('#nick'); if (i) i.value = n; }, name);
  await page.evaluate(() => document.querySelector('#startBtn').click());
  await waitFor(page, () => window.__cgl.S.started && typeof net !== 'undefined' && online(), 60000, `${label} started and online`);
  return page;
}
// screenshots at 1280x720 (phones keep their own size), then back to a light 800x600 so the other browsers keep up
const shot = async (page, file) => { const v = page.viewportSize(), big = v.width > 400; if (big) await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(2500); await page.screenshot({ path: path.join(OUT, file) }); if (big) await page.setViewportSize(v); };

let exit = 1;
try {
  const p1 = await openPlayer('p1', 'Stanley');
  const p2 = await openPlayer('p2', 'Zero');
  await waitFor(p1, () => remotes.size === 1, 15000, 'p1 to see p2');
  // no random hazards, roster monsters (the Warden KOs idle campers) or curfew police in the middle of a measurement (they do run in the canyon: that's the point, but not here)
  await p1.evaluate(() => { window.__cgl.runCommand('director off'); window.__cgl.runCommand('roster off'); window.__cgl.runCommand('time 08:00'); });

  // --- the crew moves together ---
  const campBefore = await p1.evaluate(() => ({ bots: bots.filter(b => b.p.g.parent === scene).length, holes: holes.length, items: items.length }));
  await p1.evaluate(() => window.__cgl.runCommand('zone canyon'));
  await waitFor(p1, () => ZONE.id === 'canyon', 30000, 'p1 in the canyon');
  await waitFor(p2, () => ZONE.id === 'canyon', 30000, 'p2 in the canyon');
  await p1.waitForTimeout(1200);
  const inCanyon = await p1.evaluate(() => {
    const a = ZONES.canyon.arrive;
    return { dArrive: Math.hypot(P.x - a.x, P.z - a.z), onGround: Math.abs(P.y - groundAt(P.x, P.z)) < 0.3, botsInScene: bots.filter(b => b.p.g.parent === scene).length,
      items: items.length, holes: holes.length, far: !!(FAR_TERRAIN && FAR_TERRAIN.parent), step: ZONE_STEP };
  });
  check('both campers moved to the canyon, at the start', inCanyon.dArrive < 6 && inCanyon.onGround, inCanyon);
  check('the lake camp and its far ground are set aside', inCanyon.botsInScene === 0 && !inCanyon.far && campBefore.bots > 0, { before: campBefore.bots, now: inCanyon.botsInScene });
  check('the canyon has its own buried loot and no lake holes', inCanyon.items > 50 && inCanyon.items < 200 && inCanyon.holes === 0, inCanyon);
  await p1.evaluate(() => { P.yaw = 0; P.pitch = 0.05; });
  await shot(p1, 'canyon-start-1280.png');

  // --- a ledge blocks you; a crouching friend gives a leg-up ---
  const ledge = await p1.evaluate(() => {
    // walk north in 10 cm steps the way updatePlayer does, starting `lift` m in the air (a jump), and report how far we got
    const walk = (x, z, zEnd, lift) => { let y = groundAt(x, z) + lift; for (let i = 0; i < 400 && z > zEnd; i++) { const q = zoneStep(x, z, x, z - 0.1, y); if (q[1] === z) break; z = q[1]; y = Math.max(y, groundAt(x, z)); } return +z.toFixed(2); };
    const Lz = 370, x = 250 + 55 * Math.sin(Lz * 0.0065) + 18 * Math.sin(Lz * 0.021 + 1.3);   // cyX(370): the middle of the first step
    P.x = x; P.z = Lz + 3; P.y = groundAt(P.x, P.z); P.vy = 0;
    return { rise: +(groundAt(x, Lz - 1) - groundAt(x, Lz + 1)).toFixed(2), walked: walk(x, Lz + 3, Lz - 3, 0), jumped: walk(x, Lz + 3, Lz - 3, 0.98), legup: walk(x, Lz + 3, Lz - 3, 2.1), ledgeZ: Lz, soloJump: zoneJumpV() };
  });
  check('the first step is a real ledge (~1.8 m)', ledge.rise > 1.6 && ledge.rise < 2.2, ledge);
  check('walking into it stops you at its foot', ledge.walked > ledge.ledgeZ, ledge);
  check('a plain jump (~1 m) doesn\'t get you up', ledge.jumped > ledge.ledgeZ, ledge);
  check('a leg-up (~2.1 m) does', ledge.legup <= ledge.ledgeZ - 2.9, ledge);
  check('no friend nearby: a normal jump', ledge.soloJump === 5.6, ledge);
  const p1pos = await p1.evaluate(() => ({ x: P.x, z: P.z }));
  await p2.evaluate(q => { P.x = q.x + 0.6; P.z = q.z; P.y = groundAt(P.x, P.z); P.crouch = true; }, p1pos);
  await waitFor(p1, () => [...remotes.values()].some(R => (R.f & 8) && Math.hypot(R.tx - P.x, R.tz - P.z) < 1.3), 10000, 'p1 to see p2 crouching beside them');   // any remote: with 3 campers, p3 can be first in the map
  const legup = await p1.evaluate(() => zoneJumpV());
  check('a crouching friend gives a leg-up', legup > 7, { legup });
  await p1.evaluate(() => { P.yaw = Math.PI * 0.85; P.pitch = 0.15; });
  await shot(p1, 'canyon-first-step-1280.png');

  // --- the dry fall and its rope, shared by everyone ---
  const fall = await p1.evaluate(() => {
    // walk north in 10 cm steps the way updatePlayer does, starting `lift` m in the air (a jump), and report how far we got
    const walk = (x, z, zEnd, lift) => { let y = groundAt(x, z) + lift; for (let i = 0; i < 400 && z > zEnd; i++) { const q = zoneStep(x, z, x, z - 0.1, y); if (q[1] === z) break; z = q[1]; y = Math.max(y, groundAt(x, z)); } return +z.toFixed(2); };
    const r = ZONES.canyon.ropes[0];
    P.x = r.x; P.z = r.z + 5; P.y = groundAt(P.x, P.z);
    return { h: +(groundAt(r.x, r.z) - groundAt(r.x, r.z + r.len)).toFixed(2), walked: walk(r.x, r.z + 5, r.z - 2, 0), legup: walk(r.x, r.z + 5, r.z - 2, 2.1), top: +r.z.toFixed(2) };
  });
  check('the dry fall is too tall for a leg-up (> 2.7 m)', fall.h > 2.7, fall);
  check('without the rope, walking or a leg-up can\'t get you up it', fall.walked > fall.top + 1 && fall.legup > fall.top + 1, fall);
  await p1.evaluate(() => { const r = ZONES.canyon.ropes[0]; P.x = r.x; P.z = r.z - 1.2; P.y = groundAt(P.x, P.z); });
  const spot = await p1.evaluate(() => { const s = nearSpot(); return s && s.id; });
  check('at the top, F is "drop the rope"', spot === 'zrope', { spot });
  await p1.evaluate(() => use());
  await waitFor(p2, () => ZONE_FLAGS.rope0 === 1, 10000, 'p2 to learn the rope is down');
  const climb = await p2.evaluate(() => {
    // walk north in 10 cm steps the way updatePlayer does, starting `lift` m in the air (a jump), and report how far we got
    const walk = (x, z, zEnd, lift) => { let y = groundAt(x, z) + lift; for (let i = 0; i < 400 && z > zEnd; i++) { const q = zoneStep(x, z, x, z - 0.1, y); if (q[1] === z) break; z = q[1]; y = Math.max(y, groundAt(x, z)); } return +z.toFixed(2); };
    const r = ZONES.canyon.ropes[0];
    P.crouch = false;
    return { walked: walk(r.x, r.z + 5, r.z - 2, 0), top: +r.z.toFixed(2), slowed: (() => { const z = r.z + 1.5, y = groundAt(r.x, z); const q = zoneStep(r.x, z, r.x, z - 0.1, y); return +(z - q[1]).toFixed(3) })() };
  });
  check('once the rope is down, a friend below climbs it, slower than walking', climb.walked <= climb.top - 1.9 && climb.slowed < 0.06, climb);
  await p1.evaluate(() => { const r = ZONES.canyon.ropes[0]; P.x = r.x + 3; P.z = r.z + 12; P.y = groundAt(P.x, P.z); P.yaw = Math.PI * 1.1; P.pitch = 0.12; });
  await shot(p1, 'canyon-dry-fall-1280.png');

  // --- fall damage ---
  const fallDmg = await p1.evaluate(async () => {
    const hp0 = S.hp; P.y = groundAt(P.x, P.z) + 1.5; P.vy = -16;   // already falling fast, about to land
    await new Promise(r => setTimeout(r, 4000));
    return { hp0, hp1: S.hp };
  });
  check('a long fall hurts', fallDmg.hp1 < fallDmg.hp0, fallDmg);

  // --- the campfire needs everyone ---
  await p1.evaluate(() => { const f = ZONES.canyon.fire; P.x = f.x + 1; P.z = f.z + 2; P.y = groundAt(P.x, P.z); clearAff(); P.yaw = Math.PI; P.pitch = 0.1; });
  await waitFor(p1, () => cpStat && cpStat.at === 1 && cpStat.total === 2, 10000, 'the campfire to count 1 of 2');
  const line1 = await p1.evaluate(() => document.querySelector('#zoneLine').textContent);
  check('one camper at the campfire: waiting for the crew', /1 of 2/.test(line1), { line1 });
  await shot(p1, 'canyon-campfire-waiting-1280.png');
  await p2.evaluate(() => { const f = ZONES.canyon.fire; P.x = f.x - 1; P.z = f.z + 1; P.y = groundAt(P.x, P.z); });
  await waitFor(p1, () => (cpStat && cpStat.at === 2) || ZONE.id === 'onion', 10000, 'the campfire to count 2 of 2');   // or already moved on: the server switches maps the moment everyone's there
  // the line on screen is rewritten on the next HUD refresh, not the instant the count arrives: give it a moment
  await waitFor(p1, () => /whole crew made it|everyone made it/i.test(document.querySelector('#zoneLine').textContent), 5000, 'the campfire line to say the crew made it').catch(() => {});
  const line2 = await p1.evaluate(() => ZONE.id === 'onion' ? 'moved on' : document.querySelector('#zoneLine').textContent);
  check('the whole crew at the campfire', /whole crew made it|everyone made it|moved on/i.test(line2), { line2 });
  await p1.evaluate(() => { P.yaw = 0; P.pitch = -0.08; });
  await shot(p1, 'canyon-campfire-big-thumb-1280.png');

  // the canyon isn't the last map any more (Greg's Onion Mountain follows it): the whole crew moves on
  await waitFor(p1, () => ZONE.id === 'onion', 30000, 'the crew to move on from the canyon campfire');
  check('the whole crew at the campfire moves on to the next map', await p2.evaluate(() => ZONE.id === 'onion'));

  // --- a phone-sized view ---
  const phone = await openPlayer('p3', 'Squid', 360, 800);
  await waitFor(phone, () => ZONE.id === 'onion', 30000, 'a late joiner to land in the crew map');
  check('a late joiner lands where the crew is, at the start', await phone.evaluate(() => Math.hypot(P.x - ZONE.arrive.x, P.z - ZONE.arrive.z) < 8));
  await shot(phone, 'zone-late-joiner-phone.png');

  // --- back to the lake: everything comes back ---
  await p1.evaluate(() => window.__cgl.runCommand('zone lake'));
  await waitFor(p1, () => ZONE.id === 'lake', 30000, 'p1 back on the lake');
  await p1.waitForTimeout(1200);
  const back = await p1.evaluate(() => ({ bots: bots.filter(b => b.p.g.parent === scene).length, holes: holes.length, items: items.length, far: !!(FAR_TERRAIN && FAR_TERRAIN.parent), zoneGroup: !!zoneGroup, step: ZONE_STEP, h: baseH(0, 0) === ((vnoise(11, -3) - 0.5) * 0.6 + (vnoise(0, 0) - 0.5) * 0.12) }));
  check('back on the lake: camp, holes and loot are all back', back.bots === campBefore.bots && back.holes >= campBefore.holes && back.items === campBefore.items && back.far && !back.zoneGroup && back.step === 0, { before: campBefore, back });
  check('the lake ground is the lake again', back.h, back);
  await p1.evaluate(() => { window.__cgl.runCommand('tp camp'); P.yaw = 0; });
  await shot(p1, 'lake-after-return-1280.png');

  check('no page errors', errors.length === 0, errors.slice(0, 5));
  exit = results.every(r => r.ok) ? 0 : 1;
} catch (e) {
  console.error('zones test crashed:', e.message);
  console.error(srvOut.join('').slice(-2000));
} finally {
  await browser.close();
  srv.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { }
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  process.exit(exit);
}
