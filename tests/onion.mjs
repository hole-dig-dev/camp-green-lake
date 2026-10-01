#!/usr/bin/env node
// tests/onion.mjs
//
// Onion Mountain (public/js/89-zone-onion.js) in a real browser against a real server: the crew arrives in the desert
// facing the onion, the rings sit at their heights, the Roots can be climbed anywhere and walked up their ramp, slick
// onion flesh can't be held, a middle section's dry skin can be climbed on one stamina bar, the rope at its top drops
// for everyone, the Peel Gate ramp leads to the top, and the campfire there ends the map. Screenshots go to tests/out/.
//
// Usage: node tests/onion.mjs

import net from 'node:net';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const SIM = createRequire(import.meta.url)('../public/sim.js');   // the same numbers the page uses, for the checks out here

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); }
const waitFor = (page, fn, ms, what, arg) => page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }).catch(e => { throw new Error(`timed out waiting for ${what}: ${e.message}`); });

const port = await freePort();
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-onion-'));
const srvOut = [];
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: dataDir, HOST_TOKEN: 'onion-test' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
const shot = async (page, file) => { const v = page.viewportSize(), big = v.width > 400; if (big) await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(2500); await page.screenshot({ path: path.join(OUT, file) }); if (big) await page.setViewportSize(v); };

let exit = 1;
try {
  const page = await openPlayer('p1', 'Stanley');
  await page.evaluate(() => { window.__cgl.runCommand('director off'); window.__cgl.runCommand('roster off'); window.__cgl.runCommand('time 08:00'); window.__cgl.runCommand('zone onion'); });
  await waitFor(page, () => ZONE.id === 'onion', 30000, 'Onion Mountain');
  await page.waitForTimeout(1500);

  // in page: helpers for the rest. pt(k, off, dr): a point on wall k's radius (+dr outward), `off` metres round from its section
  await page.evaluate(() => {
    const O = SIM.ONION;
    window.LAYOUT_PEEK = () => O.layout(zoneSeed('onion'));   // the same layout the map picked on arrival (same map + day seed)
    window.pt = (k, off, dr) => { const S = LAYOUT_PEEK(); const a = S.sec[k].a + off / O.R[k - 1], r = O.R[k - 1] + dr; return { x: O.X + Math.cos(a) * r, z: O.Z + Math.sin(a) * r, a }; };
    // stand at p facing the onion's middle
    window.standAt = p => { for (const k in KEYS) KEYS[k] = false; P.x = p.x; P.z = p.z; P.y = groundAt(P.x, P.z); P.vy = 0; P.crouch = false; P.yaw = Math.atan2(Math.cos(p.a), Math.sin(p.a)); P.pitch = 0.1; clearAff(); S.water = 100; };
    // walk straight at the middle the way updatePlayer does (zoneStep), from p, and say how far in you got
    window.walkIn = (p, metres) => { const O = SIM.ONION, ix = -Math.cos(p.a) * 0.1, iz = -Math.sin(p.a) * 0.1; let x = p.x, z = p.z, y = groundAt(x, z);
      for (let i = 0; i < metres * 10; i++) { const q = zoneStep(x, z, x + ix, z + iz, y); if (q[0] === x && q[1] === z) break; x = q[0]; z = q[1]; y = Math.max(y, groundAt(x, z)); }
      return { r: +Math.hypot(x - O.X, z - O.Z).toFixed(1), y: +y.toFixed(1) }; };
  });

  const arrive = await page.evaluate(() => { const O = SIM.ONION, r = Math.hypot(P.x - O.X, P.z - O.Z);
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), inward = (fx * (O.X - P.x) + fz * (O.Z - P.z)) / r;
    return { r: +r.toFixed(1), onGround: Math.abs(P.y - groundAt(P.x, P.z)) < 0.3, facing: +inward.toFixed(2), ring: O.ring(P.x, P.z) }; });
  check('the crew arrives in the desert, facing the onion', arrive.ring === 0 && arrive.onGround && arrive.facing > 0.9, arrive);
  await shot(page, 'onion-arrive-1280.png');

  const rings = await page.evaluate(() => { const O = SIM.ONION, L = LAYOUT_PEEK(), out = [];
    for (let k = 0; k <= 6; k++) { const r = k === 0 ? O.R[0] + 15 : k === 6 ? O.R[5] - 12 : (O.R[k - 1] + O.R[k]) / 2, a = L.sec[Math.max(1, k)].a + Math.PI;   // across from the section
      out.push(+(groundAt(O.X + Math.cos(a) * r, O.Z + Math.sin(a) * r) - O.H[k]).toFixed(2)); }
    return out; });
  check('each ring sits at its height', rings.every(d => Math.abs(d) < 0.3), rings);

  // --- the Roots: walk up the ramp; or climb the 2 m wall anywhere ---
  const ramp = await page.evaluate(() => walkIn(pt(1, 0, 9), 20));
  check('the Roots\' ramp walks you up onto ring 1', ramp.r < SIM.ONION.R[0] - 3 && ramp.y > 1.6, ramp);
  const slab = await page.evaluate(() => walkIn(pt(1, 30, 3), 10));
  check('beside the ramp, the Roots wall stops a walk', slab.r > SIM.ONION.R[0], slab);
  await page.evaluate(() => { standAt(pt(1, 30, 0.9)); KEYS['w'] = true; KEYS[' '] = true; });
  await waitFor(page, () => climbing(), 30000, 'catching the Roots wall');
  await waitFor(page, () => { if (climbing() || !P.grounded) return false; for (const k in KEYS) KEYS[k] = false; window.__r = SIM.ONION.ring(P.x, P.z); return true; }, 60000, 'over the Roots');
  check('the Roots wall can be climbed anywhere', await page.evaluate(() => window.__r) === 1);

  // --- wall 2: slick flesh, except its section ---
  const slick = await page.evaluate(() => { const f = pt(2, 25, -0.6), s = pt(2, 0, -0.6); return { flesh: ZONES.onion.climbable(f.x, f.z), skin: ZONES.onion.climbable(s.x, s.z) }; });
  check('onion flesh is too slick to hold, the section\'s dry skin isn\'t', !slick.flesh && slick.skin, slick);
  await page.evaluate(() => { standAt(pt(2, 25, 0.9)); KEYS['w'] = true; KEYS[' '] = true; });
  await page.waitForTimeout(6000);
  const noGrab = await page.evaluate(() => ({ climbing: climbing(), ring: SIM.ONION.ring(P.x, P.z) }));
  await page.evaluate(() => { for (const k in KEYS) KEYS[k] = false; });
  check('jumping at slick flesh: no grab, no way up', !noGrab.climbing && noGrab.ring === 1, noGrab);

  await page.evaluate(() => { standAt(pt(2, 0, 0.9)); KEYS['w'] = true; KEYS[' '] = true; });
  await waitFor(page, () => climbing(), 30000, 'catching the dry skin');
  await page.evaluate(() => { P.yaw += 0.5; P.pitch = 0.35; });   // from behind and a little to the side, looking up the wall
  await shot(page, 'onion-climbing-wall2-1280.png');
  await page.evaluate(() => { P.yaw -= 0.5; });
  await waitFor(page, () => { if (climbing() || !P.grounded) return false; for (const k in KEYS) KEYS[k] = false; window.__w2 = { ring: SIM.ONION.ring(P.x, P.z), stam: Math.round(S.stam) }; return true; }, 120000, 'over wall 2');
  const w2 = await page.evaluate(() => window.__w2);
  check('an 8 m dry-skin section can be climbed on one stamina bar', w2.ring === 2 && w2.stam > 0, w2);

  // --- the rope at its top, for everyone ---
  const rope = await page.evaluate(() => { const r = ZONES.onion.ropes.find(q => q.flag === 'rope2'); P.x = r.x - Math.sin(r.a) * 1.2; P.z = r.z - Math.cos(r.a) * 1.2; P.y = groundAt(P.x, P.z); const s = nearSpot(); return s && s.id; });
  check('at the top of the section, F is "drop the rope"', rope === 'zrope', { rope });
  await page.evaluate(() => use());
  await waitFor(page, () => ZONE_FLAGS.rope2 === 1, 10000, 'the rope to drop');
  const ropeUp = await page.evaluate(() => walkIn(pt(2, 0, 4), 12));
  check('once the rope is down, anyone walks up it', ropeUp.y > SIM.ONION.H[2] - 0.5, ropeUp);

  // --- the Peel Gate ramp and the campfire ---
  const peel = await page.evaluate(() => walkIn(pt(6, 0, 9), 20));
  check('the Peel Gate ramp leads to the top', peel.y > SIM.ONION.H[6] - 0.5, peel);
  await page.evaluate(() => { const f = ZONES.onion.fire; P.x = f.x + 1; P.z = f.z + 1.5; P.y = groundAt(P.x, P.z); P.yaw = Math.atan2(P.x - SIM.ONION.X, P.z - SIM.ONION.Z); P.pitch = 0.15; });
  await waitFor(page, () => cpStat && cpStat.at === 1 && cpStat.total === 1, 15000, 'the campfire to count you');
  await waitFor(page, () => /made it/i.test(document.querySelector('#zoneLine').textContent), 8000, 'the campfire line').catch(() => {});
  const line = await page.evaluate(() => document.querySelector('#zoneLine').textContent);
  check('the campfire at the top: the crew made it', /made it/i.test(line), { line });
  await shot(page, 'onion-top-campfire-1280.png');

  // --- phone ---
  const phone = await openPlayer('p2', 'Zero', 360, 800);
  await waitFor(phone, () => ZONE.id === 'onion', 30000, 'the phone on Onion Mountain');
  await phone.waitForTimeout(1500);
  check('a late joiner lands at the bottom, in the desert', await phone.evaluate(() => SIM.ONION.ring(P.x, P.z) === 0));
  await shot(phone, 'onion-arrive-phone.png');

  check('no page errors', errors.length === 0, errors.slice(0, 5));
  exit = results.every(r => r.ok) ? 0 : 1;
} catch (e) {
  console.error('onion test crashed:', e.message);
  console.error(srvOut.join('').slice(-2000));
} finally {
  await browser.close();
  srv.kill();
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { }
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} passed`);
  process.exit(exit);
}
