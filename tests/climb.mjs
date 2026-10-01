#!/usr/bin/env node
// tests/climb.mjs
//
// Checks Peak-style climbing (public/js/88-climb.js) in a real browser against a real server: in the Dry Canyon, a
// camper jumps at the first 1.8 m ledge with Space held, catches the wall, climbs it on stamina and pulls over the top.
// Letting go drops you, running out of stamina drops you, and too tired means you can't catch hold. On the lake, and
// on the north wall while its slider is off, climbing stays off. Screenshots go to tests/out/ (gitignored).
//
// Usage: node tests/climb.mjs

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
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-climb-'));
const srvOut = [];
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: dataDir, HOST_TOKEN: 'climb-test' }, stdio: ['ignore', 'pipe', 'pipe'] });
srv.stdout.on('data', d => srvOut.push(String(d))); srv.stderr.on('data', d => srvOut.push(String(d)));
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
let exit = 1;
try {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/SwiftShader|ReadPixels|favicon|Performance Caveat|fallback to software/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load', timeout: 120000 });
  await waitFor(page, () => !!window.__cgl, 60000, 'the page');
  await page.evaluate(() => { document.querySelector('#nick').value = 'Stanley'; document.querySelector('#startBtn').click(); });
  await waitFor(page, () => window.__cgl.S.started && online(), 60000, 'started and online');

  // --- off on the lake, and on the north wall unless its slider is on ---
  const lake = await page.evaluate(() => { const r = { camp: climbHere() }; P.x = 100; P.z = -560; r.north = climbHere(); window.__cgl.runCommand('tp camp'); return r; });
  check('no climbing on the lake, or on the north wall by default', !lake.camp && !lake.north, lake);

  await page.evaluate(() => { window.__cgl.runCommand('director off'); window.__cgl.runCommand('roster off'); window.__cgl.runCommand('time 08:00'); window.__cgl.runCommand('zone canyon'); });
  await waitFor(page, () => ZONE.id === 'canyon', 30000, 'the canyon');
  await page.waitForTimeout(1500);

  // stand at the foot of the first step (the same spot as tests/zones.mjs), facing it (north, -z)
  const foot = () => page.evaluate(() => {
    const Lz = 370, x = 250 + 55 * Math.sin(Lz * 0.0065) + 18 * Math.sin(Lz * 0.021 + 1.3);
    for (const k in KEYS) KEYS[k] = false;
    P.x = x; P.z = Lz + 0.9; P.y = groundAt(P.x, P.z); P.vy = 0; P.yaw = 0; P.pitch = 0.1; P.crouch = false; clearAff(); S.water = 100;
    return { x, Lz, foot: groundAt(x, Lz + 1), top: groundAt(x, Lz - 1) };
  });
  const L = await foot();
  check('climbing is on in the canyon', await page.evaluate(() => climbHere()));

  // --- jump at it with Space held: catch the wall, climb, pull over ---
  await page.evaluate(() => { KEYS['w'] = true; KEYS[' '] = true; });
  await waitFor(page, () => climbing(), 30000, 'catching the wall');
  const caught = await page.evaluate(L => ({ y: +(P.y - L.foot).toFixed(2), stam: Math.round(S.stam) }), L);
  check('jumping at the ledge with Space held catches the wall', caught.y > 0.3 && caught.y < 1.6, caught);
  await page.waitForTimeout(600);
  await page.evaluate(() => { P.yaw = Math.PI * 0.75; });   // the camera round to the side, to see the camper on the wall
  await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'climb-on-the-wall-1280.png') });
  await page.setViewportSize({ width: 800, height: 600 });
  await page.evaluate(() => { P.yaw = 0; });
  // read where you are the moment the climb ends (W is still held, so you'd walk on)
  await waitFor(page, L => { if (climbing() || !P.grounded) return false; for (const k in KEYS) KEYS[k] = false;
    window.__over = { z: +P.z.toFixed(2), aboveTop: +(P.y - L.top).toFixed(2), onGround: Math.abs(P.y - groundAt(P.x, P.z)) < 0.3, stam: Math.round(S.stam) }; return true; }, 60000, 'the climb to end', L);
  const over = await page.evaluate(() => window.__over);
  check('climbing up pulls you over the top', over.z < L.Lz && over.aboveTop > -0.3 && over.onGround, over);
  check('the climb cost stamina', over.stam < caught.stam, { caught: caught.stam, over: over.stam });

  // --- letting go of Space drops you ---
  await foot();
  await page.evaluate(() => { KEYS[' '] = true; KEYS['w'] = true; });
  await waitFor(page, () => climbing(), 30000, 'catching the wall again');
  await page.evaluate(() => { KEYS['w'] = false; KEYS[' '] = false; });
  await waitFor(page, () => !climbing() && P.grounded, 30000, 'dropping off');
  const dropped = await page.evaluate(L => ({ dy: +(P.y - L.foot).toFixed(2), z: +P.z.toFixed(2) }), L);
  check('letting go of Space drops you back down', Math.abs(dropped.dy) < 0.4 && dropped.z > L.Lz, dropped);

  // --- out of stamina: the grip gives out ---
  await foot();
  await page.evaluate(() => { KEYS[' '] = true; KEYS['w'] = true; });
  await waitFor(page, () => climbing(), 30000, 'catching the wall a third time');
  await page.evaluate(() => { KEYS['w'] = false; S.stam = 1; });   // just hanging on, almost spent
  await waitFor(page, () => !climbing(), 30000, 'the grip to give out');
  await page.evaluate(() => { KEYS[' '] = false; });
  await waitFor(page, () => P.grounded, 30000, 'landing');
  const spent = await page.evaluate(L => ({ dy: +(P.y - L.foot).toFixed(2) }), L);
  check('out of stamina, your grip gives out and you fall', Math.abs(spent.dy) < 0.4, spent);

  // --- too tired to catch hold at all ---
  await foot();
  await page.evaluate(() => { setHp(5); KEYS[' '] = true; KEYS['w'] = true; });   // stamina can't be more than health
  await page.waitForTimeout(8000);
  const tired = await page.evaluate(() => ({ climbing: climbing(), stam: Math.round(S.stam) }));
  await page.evaluate(() => { for (const k in KEYS) KEYS[k] = false; clearAff(); });
  check('too hurt and tired to hold on: no grab', !tired.climbing, tired);

  check('no page errors', errors.length === 0, errors.slice(0, 5));
  exit = results.every(r => r.ok) ? 0 : 1;
} catch (e) {
  console.error('climb test crashed:', e.message);
  console.error(srvOut.join('').slice(-2000));
} finally {
  await browser.close();
  srv.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { }
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  process.exit(exit);
}
