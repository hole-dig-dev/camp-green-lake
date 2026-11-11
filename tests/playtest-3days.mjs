#!/usr/bin/env node
// tests/playtest-3days.mjs -- a bot plays days 1 to 3 the way a new solo player would, with real keys, on a normal
// server (hazards and the event director ON). Each day: walk out of the gate to the old creek, dig until the pan or
// bucket is full, walk back, wash at the drums or tip into the sifter, buy the next tool at the store through its
// real UI when the wallet covers it and tonight's cut, drink when thirsty, and be inside the fence before lights-out.
// It passes if day 4 dawns with the crew never let go, the shovel and a bucket bought, and no page errors.
// Knock-outs are reported, not failures: a real player gets knocked out too. Takes about 35 minutes.
//   node tests/playtest-3days.mjs [days=3]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), DAYS = +(process.argv[2] || 3);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort(), data = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-playtest3-'));
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: data }, stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; let failed = 0, kos = 0, letGo = 0;
page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|SwiftShader|Failed to load resource/i.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 200)); });
const ev = (f, a) => page.evaluate(f, a), sleep = ms => page.waitForTimeout(ms);
const st = () => ev(() => ({ day: RUN.day, hour: hourOf(clockT()), gold: S.seeds, quota: RUN.quota, sand: S.bucket, max: bucketMax(), water: S.water / waterMax(), ko: !!S.ko, x: P.x, z: P.z, inCamp: inCamp(P.x, P.z), shovel: !!S.up.shovel, bucket: !!S.up.bucket, spade: !!S.up.spade, hp: S.hp }));
const log = async (what, ok = true) => { const s = await st(); console.log(`${ok ? 'ok  ' : 'FAIL'} d${s.day} ${String(Math.floor(s.hour)).padStart(2, '0')}:${String(Math.floor(s.hour % 1 * 60)).padStart(2, '0')} gold ${String(s.gold).padStart(3)}/${s.quota} sand ${s.sand.toFixed(1)}/${s.max} hp ${Math.round(s.hp)}  ${what}`); if (!ok) failed++; };
async function recover() {                                         // knocked out: say why, wait to be back on your feet; report if it does not happen
  let s = await st(); if (!s.ko) return false; kos++;
  const why = await ev(() => `"${(document.querySelector('#koTitle') || {}).textContent}: ${((document.querySelector('#koText') || {}).textContent || '').slice(0, 90)}" ko=${(+S.ko).toFixed(1)} tent=${inTent()} town=${!!S.inTown} ui=${uiOpen()} trapped=${typeof isTrapped === 'function' && isTrapped()} sink=${typeof inSinkhole === 'function' && inSinkhole()} truck=${S.inTruck} others=${typeof othersOnline === 'function' && othersOnline()}`);
  await log('knocked out ' + why); const t0 = Date.now();
  while (Date.now() - t0 < 60000 && (await st()).ko) await sleep(1000);
  if ((await st()).ko) { await log('STILL DOWN after 60 s: ' + await ev(() => `ko=${(+S.ko).toFixed(2)} hp=${S.hp} paused=${typeof PAUSE !== 'undefined' && PAUSE.open} ui=${uiOpen()} started=${S.started} overlay=${!document.querySelector('#ko').hidden}`), false); await ev(() => window.__cgl.runCommand('respawn')); await sleep(1500); }
  return true;
}
async function walkTo(x, z, maxS = 60) {
  const t0 = Date.now(); await page.keyboard.down('w'); await page.keyboard.down('Shift'); let d = 99, lastD = 999, stuck = 0;
  while (Date.now() - t0 < maxS * 1000) {
    d = await ev(([x, z]) => { P.yaw = Math.atan2(-(x - P.x), -(z - P.z)); return S.ko ? -1 : Math.hypot(x - P.x, z - P.z); }, [x, z]); if (d < 0 || d < 1.3) break;
    if (d > lastD - 0.05) { if (++stuck > 12) { await page.keyboard.press('Space'); await ev(() => { P.yaw += 1.2; }); await sleep(500); stuck = 0; } } else stuck = 0; lastD = d; await sleep(120);
  }
  await page.keyboard.up('w'); await page.keyboard.up('Shift'); return d >= 0 && d < 1.8;
}
const toLake = async (x, z) => (await walkTo(0, 33, 30)) && (await walkTo(0, 18, 30)) && (await walkTo(x, z, 70));
const toCamp = async () => { const s = await st(); if (s.inCamp && s.z > 30) return true; return (await walkTo(0, 20, 80)) && (await walkTo(0, 32, 30)); };
async function dig(maxS) {
  const t0 = Date.now(), every = await ev(() => S.up.shovel ? (S.up.spade ? 5200 : 8300) : 4200); await ev(() => { P.pitch = 0.5; });
  while (Date.now() - t0 < maxS * 1000) {
    await page.keyboard.down('e'); await sleep(every); await page.keyboard.up('e'); const s = await st(); if (s.ko) return false; if (s.sand >= s.max - 0.01) return true;
    if (s.hour > 18.4) return s.sand > 0.2; await ev(() => { P.yaw += 0.3; }); await page.keyboard.down('w'); await sleep(650); await page.keyboard.up('w');
  }
  return (await st()).sand > 0.2;
}
async function useAt(x, z, done, what) { if (!(await walkTo(x, z, 40))) return false; for (let k = 0; k < 3; k++) { await page.keyboard.press('f'); try { await page.waitForFunction(done.fn, done.arg, { timeout: 20000 }); return true; } catch { } } await log(`${what}: F did nothing (prompt: "${await ev(() => { const s = nearSpot(); return s && (s.label || s.id); })}")`, false); return false; }
async function buy(id, name) {
  if (!(await walkTo(16, 40.6, 40))) return log(`could not reach the store for ${name}`, false);
  await sleep(300); if (!(await ev(() => shopOpen))) { await page.keyboard.press('f'); await sleep(600); }
  if (!(await ev(() => shopOpen))) return log(`store did not open for ${name}`, false);
  const g0 = (await st()).gold; let ok = true;
  try { await page.click(`.shop-item[data-item="${id}"]`, { timeout: 5000 }); await sleep(200); await page.click('#shopBuyBtn', { timeout: 5000 }); await sleep(200); await page.click('#shopConfirmBuy', { timeout: 5000 }).catch(() => { }); await sleep(500); } catch (e) { ok = false; }
  const owned = await ev(id => !!S.up[id], id), g1 = (await st()).gold; await page.keyboard.press('Escape'); await sleep(300);
  await log(`store: bought ${name} through the UI (gold ${g0} -> ${g1})`, ok && owned && g1 < g0 && !(await ev(() => shopOpen)));
}
const PLAN = [['shovel', 25, 'the camp shovel'], ['bucket', 45, 'a bucket'], ['spade', 45, 'the sharpened spade'], ['bucket2', 60, 'the big bucket']];
try {
  await page.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__cgl && document.querySelector('#startBtn'), null, { timeout: 60000 });
  await ev(() => document.querySelector('#startBtn').click()); await sleep(3000); await ev(() => window.__cgl.runCommand('time 06:05')); await sleep(500);
  const C = await ev(() => ({ creek: SIM.PAY.creek, water: SIM.GOLD.WATER, sifter: SIM.GOLD.SIFTER })); let trip = 0, day = 1; await log('start');
  while (day <= DAYS) {
    await recover(); let s = await st();
    if (s.day > day || s.day < day) { if (s.day < day || (s.day === 1 && day > 1)) { letGo++; await log('THE CREW WAS LET GO', false); break; } day = s.day; await log(`=== day ${day} begins: wallet ${s.gold}, tonight's cut ${s.quota}`); if (day > DAYS) break; continue; }
    if (s.hour >= 18.3 || s.hour < 5.9) {                                 // evening: inside the fence and wait for morning
      if (!s.inCamp) await log('back inside the fence for lights-out', await toCamp());
      if (s.sand > 0.2 && s.hour < 19.6) { if (s.bucket) await useAt(C.sifter.x + 1.8, C.sifter.z, { fn: () => S.bucket < 0.05 }, 'sifter'); else await useAt(C.water.x, C.water.z + 1.6, { fn: () => S.bucket < 0.05 }, 'water drums'); }
      await walkTo(-6, 44, 20); const before = await st(); await log(`waiting for morning (wallet ${before.gold}, cut ${before.quota})`, before.inCamp);
      for (let i = 0; i < 300; i++) { await sleep(1000); const n = await st(); if (n.day !== before.day || (n.hour >= 6 && n.hour < 7)) break; }
      continue;
    }
    if (s.water < 0.4) { await toCamp(); await useAt(C.water.x, C.water.z + 1.6, { fn: () => S.water >= waterMax() - 2 }, 'water drums'); await log('drank at the drums'); continue; }
    const next = PLAN.find(([id]) => !s[id] && !(id === 'bucket2' && !s.bucket)); const owned = await ev(id => !!S.up[id], next ? next[0] : 'pan');
    if (next && !owned && s.gold >= next[1] + (day === 1 ? 0 : s.quota)) { await toCamp(); await buy(next[0], next[2]); continue; }
    trip++; const x = ((trip * 7) % 44) - 22, z = C.creek.z + C.creek.amp * Math.sin(x * C.creek.wave) + ((trip % 3) - 1) * 2.5;
    if (!(await toLake(x, z))) { if (!(await recover())) await log('could not reach the creek', false); continue; }
    const full = await dig(s.bucket ? 110 : 75); if (await recover()) continue; s = await st();
    await log(`trip ${trip}: dug ${s.sand.toFixed(1)} holes of sand (x${(await ev(() => sandRich('bucket'))).toFixed(2)})`, full);
    if (!(await toCamp())) { if (!(await recover())) await log('could not get back to camp', false); continue; }
    const g0 = (await st()).gold;
    if (s.bucket) await useAt(C.sifter.x + 1.8, C.sifter.z, { fn: () => S.bucket < 0.05 }, 'sifter'); else await useAt(C.water.x, C.water.z + 1.6, { fn: () => S.bucket < 0.05 }, 'water drums');
    await sleep(600); await log(`trip ${trip}: ${s.bucket ? 'sifted' : 'washed'}, +${(await st()).gold - g0} gold`, (await st()).sand < 0.05);
  }
  const e = await st(); await log(`finished: day ${e.day}, shovel ${e.shovel}, bucket ${e.bucket}, spade ${e.spade}, knock-outs ${kos}`, e.day > DAYS && !letGo && e.shovel && e.bucket);
} catch (e) { console.log('FAIL exception', e.message.split('\n')[0]); failed++; }
if (errs.length) { console.log('page errors (' + errs.length + '):\n' + [...new Set(errs)].slice(0, 10).join('\n')); failed++; }
await browser.close(); srv.kill(); console.log(failed ? `PLAYTEST FAILED (${failed})` : 'PLAYTEST PASSED'); process.exit(failed ? 1 : 0);
