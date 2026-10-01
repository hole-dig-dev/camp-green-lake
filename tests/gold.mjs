#!/usr/bin/env node
// tests/gold.mjs
//
// The gold dig (public/js/48-gold.js and the realistic digging in 45-state.js), in a real browser against a real server:
// first person from the start, a shovelful moves a real shovelful of dirt and costs stamina, a 5 ft hole takes a couple
// of hundred of them, the spoil pile holds what came out, paystreaks have gold and barren ground almost none, the
// sifting screen catches what bare hands miss, found gold is the crew's money, Mr. Sir trades junk for gold, and the
// day-1 quota starts tiny.
// Screenshots go to tests/out/.
//
// Usage: node tests/gold.mjs

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
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-gold-'));
const srvOut = [];
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: dataDir, HOST_TOKEN: 'gold-test' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  await page.evaluate(() => { window.__cgl.runCommand('director off'); window.__cgl.runCommand('roster off'); window.__cgl.runCommand('time 09:00'); });

  check('first person from the start', await page.evaluate(() => FP === true));
  await page.evaluate(() => window.__cgl.runCommand('tool shovel'));   // these checks are about the shovel; bare hands are tests/tools.mjs
  await waitFor(page, () => !!hasTool('shovel'), 15000, 'a shovel in hand');

  // find a paystreak and a barren spot out on the lake bed, away from camp and the pre-dug holes
  const spots = await page.evaluate(() => {
    let rich = null, barren = null;
    for (let x = -400; x <= 400 && !(rich && barren); x += 7) for (let z = -420; z <= -60 && !(rich && barren); z += 7) {
      if (holeNear(x, z, 4)) continue; const g = goldRich(x, z);
      if (!rich && g > 0.95) rich = { x, z, g }; if (!barren && g < 0.02) barren = { x, z, g };
    }
    return { rich, barren };
  });
  check('the lake has paystreaks and barren ground', spots.rich && spots.barren, spots);

  // --- one shovelful ---
  const one = await page.evaluate(s => {
    P.x = s.x; P.z = s.z + 1.1; P.y = groundAt(P.x, P.z); P.fa = Math.PI; P.yaw = 0; clearAff(); S.stam = 100;
    scoop(); const h = holeNear(s.x, s.z, 1.5);
    return { d: h ? +(h.d * 1000).toFixed(1) : null, expect: +(shovelful() / holeArea(h) * 1000).toFixed(1), stam: Math.round(S.stam), perHole: Math.round(FIVE_FT * holeArea(h) / shovelful()) };
  }, spots.barren);
  check('one shovelful takes a real shovelful of dirt (~6 mm off the whole hole)', one.d > 3 && one.d < 10 && Math.abs(one.d - one.expect) < 0.5, one);
  check('a 5 ft hole is a couple of hundred shovelfuls', one.perHole > 180 && one.perHole < 320, one);
  check('each shovelful costs stamina', one.stam <= 94, one);
  const tired = await page.evaluate(s => { const h = holeNear(s.x, s.z, 1.5), d0 = h.d; S.stam = 3; scoop(); return { dug: h.d > d0, stam: S.stam }; }, spots.barren);
  check('out of stamina, no shovelful comes out', !tired.dug, tired);

  // --- the spoil pile holds what came out ---
  const pile = await page.evaluate(s => { const h = holeNear(s.x, s.z, 1.5); h.d = FIVE_FT; return { peak: +(surfaceAt(h.mx, h.mz, baseH(h.mx, h.mz)) - baseH(h.mx, h.mz)).toFixed(2), floor: +(baseH(h.x, h.z) - surfaceAt(h.x, h.z, baseH(h.x, h.z))).toFixed(2), r: h.r }; }, spots.barren);
  check('a 5 ft hole is five feet across and five deep', Math.abs(pile.floor - 1.5) < 0.05 && pile.r < 0.9, pile);
  check('its spoil pile holds what came out: about waist high', pile.peak > 0.7 && pile.peak < 1.15, pile);

  // --- gold: paystreak vs barren, screen vs bare hands (400 shovelfuls each, at 5 ft) ---
  const gold = await page.evaluate(sp => {
    // count golden shovelfuls (caught or let slip), not flakes: one nugget is worth 20 flakes and would swamp a sample this size
    let caught = 0, missed = 0; const lg = logEv; logEv = (k, o) => { if (k === 'gold') caught++; if (k === 'goldMissed') missed++; return lg(k, o); };
    const run = (s, screen) => { const h = { x: s.x, z: s.z, d: FIVE_FT, mx: s.x + 2, mz: s.z, r: HOLE_R }; S.gold = 0; S.up.screen = screen; caught = missed = 0; for (let i = 0; i < 600; i++) goldSift(h, 10); return { caught, missed, flakes: S.gold }; };
    const out = { richScreen: run(sp.rich, true), richHand: run(sp.rich, false), barren: run(sp.barren, true) };
    logEv = lg; S.up.screen = false; return out;
  }, spots);
  check('a paystreak pays, barren ground almost never does', gold.richScreen.caught > 50 && gold.barren.caught < gold.richScreen.caught / 5, gold);
  { const h = gold.richHand, share = h.caught / (h.caught + h.missed);
    check('bare hands catch about a third of it; the screen catches it all', share > 0.15 && share < 0.6 && gold.richScreen.missed === 0, { share: +share.toFixed(2), ...gold }); }

  // --- found gold is the crew's money; Mr. Sir trades junk for gold ---
  await page.waitForTimeout(6000);   // let the crew's gold settle after all that sifting (the server rate-limits wallet changes)
  const sold = await page.evaluate(async () => {
    S.sack = ['can']; const seeds0 = S.seeds, val = LOOT.can.val;
    openDialog('sir'); await new Promise(r => setTimeout(r, 300));
    const b = [...document.querySelectorAll('button')].find(e => /found some stuff/i.test(e.textContent)); if (b) b.click();
    for (let i = 0; i < 20 && S.seeds - seeds0 < val; i++) await new Promise(r => setTimeout(r, 250));   // the crew wallet comes back from the server
    return { button: !!b, sack: S.sack.length, paid: S.seeds - seeds0, val, shown: document.querySelector('#seeds').textContent };
  });
  await page.evaluate(() => closeDialog());
  check('Mr. Sir trades gold for junk, into the crew\'s gold (shown in grams)', sold.button && sold.sack === 0 && sold.paid === sold.val && / g$/.test(sold.shown), sold);
  check('found gold goes straight into the crew\'s gold', await page.evaluate(() => { const s0 = S.seeds; addGold(40); return S.seeds === s0 + 40; }));
  check('the shop sells a sifting screen', await page.evaluate(() => SHOP.some(s => s.id === 'screen')));
  check('day 1 quota is tiny, and grows every day', await page.evaluate(() => SIM.quotaFor(1, 1) <= 8 && SIM.quotaFor(5, 1) > SIM.quotaFor(1, 1)));

  // --- what it looks like: first person, digging into a hole (fast sliders so the headless frames show a hole) ---
  await page.evaluate(s => { TUNE_OVR['dig.time'] = { v: 0.42 }; TUNE_OVR['dig.shovelful'] = { v: 120 }; P.x = s.x + 6; P.z = s.z + 1.1; P.y = groundAt(P.x, P.z); P.yaw = 0; P.fa = Math.PI; P.pitch = 0.6; clearAff(); }, spots.rich);
  await page.keyboard.down('e'); await page.waitForTimeout(9000); await page.keyboard.up('e');
  await page.evaluate(() => { delete TUNE_OVR['dig.time']; delete TUNE_OVR['dig.shovelful']; });
  await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, 'gold-dig-first-person-1280.png') });

  check('no page errors', errors.length === 0, errors.slice(0, 5));
  exit = results.every(r => r.ok) ? 0 : 1;
} catch (e) {
  console.error('gold test crashed:', e.message);
  console.error(srvOut.join('').slice(-2000));
} finally {
  await browser.close();
  srv.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { }
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  process.exit(exit);
}
