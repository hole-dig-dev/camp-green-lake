#!/usr/bin/env node
// tests/playtest-day1.mjs -- a bot plays the first day the way a new player would, with real keys:
// walk out of the gate to the old creek, dig with bare hands until the pan is full, walk back, wash it at the water
// drums, repeat until there is enough gold, buy the camp shovel at the store, then dig one hole with it.
// It answers "does the first ten minutes work?": every step is reachable on foot, the pan pays, the shovel is
// affordable well inside day 1, and nothing throws. Prints a timeline (game clock) and exits non-zero on a failed step.
//   node tests/playtest-day1.mjs            (starts its own server on a free port, scratch data, event director off)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort(), data = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-playtest-'));
fs.writeFileSync(path.join(data, 'world.json'), '{"director":{"on":false}}'); fs.writeFileSync(path.join(data, 'tune.json'), '{"haz.mines":{"v":0,"def":1}}');
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: data }, stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; let failed = 0;
page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|SwiftShader/i.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 200)); });
const log = async (what, ok = true) => { const s = await page.evaluate(() => `${clockText()}  gold ${S.seeds}  sand ${S.bucket.toFixed(2)}/${bucketMax()}  at ${P.x.toFixed(0)},${P.z.toFixed(0)}`); console.log(`${ok ? 'ok  ' : 'FAIL'} ${s}  ${what}`); if (!ok) failed++; };
async function walkTo(x, z, maxS = 90, run = true) {            // hold W (and Shift) and steer like a player with the mouse
  const t0 = Date.now(); await page.keyboard.down('w'); if (run) await page.keyboard.down('Shift'); let d = 99;
  while (Date.now() - t0 < maxS * 1000) { d = await page.evaluate(([x, z]) => { P.yaw = Math.atan2(-(x - P.x), -(z - P.z)); return Math.hypot(x - P.x, z - P.z); }, [x, z]); if (d < 1.2) break; await page.waitForTimeout(120); }
  await page.keyboard.up('w'); if (run) await page.keyboard.up('Shift'); return d < 1.6;
}
async function digUntilFull(maxS = 150) {                          // hold E; step sideways to fresh ground when a hole is as deep as the tool goes
  const t0 = Date.now(); await page.evaluate(() => { P.pitch = 0.5; }); await page.keyboard.down('e'); let last = -1, stuck = 0;
  while (Date.now() - t0 < maxS * 1000) {
    await page.waitForTimeout(900); const b = await page.evaluate(() => [S.bucket, bucketMax()]); if (b[0] >= b[1] - 0.01) break;
    if (b[0] <= last + 1e-4) { if (++stuck >= 2) { await page.keyboard.up('e'); await page.evaluate(() => { P.yaw += 0.9; }); await page.keyboard.down('w'); await page.waitForTimeout(700); await page.keyboard.up('w'); await page.keyboard.down('e'); stuck = 0; } } else stuck = 0; last = b[0];
  }
  await page.keyboard.up('e'); return (await page.evaluate(() => S.bucket >= bucketMax() - 0.01));
}
try {
  await page.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__cgl && document.querySelector('#startBtn'), null, { timeout: 60000 });
  await page.evaluate(() => document.querySelector('#startBtn').click()); await page.waitForTimeout(3000);
  await page.evaluate(() => window.__cgl.runCommand('time 06:10')); await page.waitForTimeout(500);
  const start = await page.evaluate(() => ({ t: clockT(), shovel: !!S.up.shovel, gold: S.seeds, creek: SIM.PAY.creek.z, water: SIM.GOLD.WATER }));
  await log(`start: bare hands (shovel ${start.shovel}), creek at z ${start.creek}`, !start.shovel && start.gold === 0);
  let trips = 0;
  while (trips < 8 && (await page.evaluate(() => S.seeds)) < 25) {
    trips++;
    await log(`trip ${trips}: reached the creek`, await walkTo((trips % 3 - 1) * 5, start.creek + (trips % 2 ? 2 : -3)));
    await log(`trip ${trips}: pan filled by hand (ground x${(await page.evaluate(() => sandRich('bucket'))).toFixed(2)})`, await digUntilFull());
    await log(`trip ${trips}: back at the water drums`, await walkTo(start.water.x, start.water.z + 1.6));
    const g0 = await page.evaluate(() => S.seeds); await page.keyboard.press('f'); await page.waitForFunction(g => S.seeds > g && S.bucket === 0, g0, { timeout: 25000 }).catch(() => { });
    const g1 = await page.evaluate(() => S.seeds); await log(`trip ${trips}: washed the pan, +${g1 - g0} gold`, g1 > g0);
    if (g1 === g0) break;
  }
  const used = await page.evaluate(t0 => (clockT() - t0) / DAYMS, start.t);
  await log(`25 gold for the shovel after ${trips} pans, ${(used * 100).toFixed(0)}% of the day`, (await page.evaluate(() => S.seeds)) >= 25 && used < 0.8);
  await walkTo(16, 40.6, 60); await page.waitForTimeout(400); await page.keyboard.press('f'); await page.waitForTimeout(600);
  const open = await page.evaluate(() => shopOpen); await log('store opened at the window', open);
  if (open) { await page.click('.shop-item[data-item="shovel"]'); await page.waitForTimeout(200); await page.click('#shopBuyBtn'); await page.waitForTimeout(200); await page.click('#shopConfirmBuy').catch(() => { }); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  await log('bought the camp shovel', await page.evaluate(() => !!S.up.shovel));
  await walkTo(8, start.creek - 6); const ok = await digUntilFull(60); const depth = await page.evaluate(() => { let m = 0; for (const h of (typeof HOLES !== 'undefined' && HOLES.values ? HOLES.values() : [])) if (h.mine) m = Math.max(m, h.d); return m; }).catch(() => 0);
  await log(`dug with the shovel: pan ${ok ? 'full' : 'not full'}, deepest own hole ${depth.toFixed(2)} m`, ok);
  await log(`next-task line reads: "${await page.evaluate(() => (document.querySelector('#nextTask .v') || {}).textContent || '')}"`);
} catch (e) { console.log('FAIL exception', e.message.split('\n')[0]); failed++; }
if (errs.length) { console.log('page errors:\n' + errs.slice(0, 8).join('\n')); failed++; }
await browser.close(); srv.kill(); console.log(failed ? `PLAYTEST FAILED (${failed})` : 'PLAYTEST PASSED'); process.exit(failed ? 1 : 0);
