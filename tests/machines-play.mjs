#!/usr/bin/env node
// tests/machines-play.mjs -- a scripted run with the Company's machines (public/js/87-excavator.js), the way a player
// would: buy both at the store, climb into the excavator, drive it out, work the arm with the mouse (moves, wheel,
// C + mouse, the left button), take scoops, tip one into the dump truck, fling one onto the ground, drive in and tip one
// at the sifter; drive the truck to the sifter and unload it; walk a digger into the pile. Saves screenshots to look at.
//   env -u DISPLAY node tests/machines-play.mjs [outdir]     (PORT=nnnn to use a running server, else it starts its own)
// Not part of `npm test` (a few minutes, GPU); tests/machines.mjs is the quick server check.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-machplay-')); fs.mkdirSync(OUT, { recursive: true });
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
let port = +process.env.PORT || 0, srv = null;
if (!port) {
  port = await freePort(); const data = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-machplay-data-'));
  fs.writeFileSync(path.join(data, 'world.json'), '{"director":{"on":false}}'); fs.writeFileSync(path.join(data, 'tune.json'), '{"haz.mines":{"v":0,"def":1}}');
  srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: data }, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
}
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const W = 1280, H = 720, page = await browser.newPage({ viewport: { width: W, height: H } }); const errs = []; let fails = 0;
page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|SwiftShader/i.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 200)); });
const ev = (f, a) => page.evaluate(f, a), wait = ms => page.waitForTimeout(ms);
const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  -- ' + info : ''}`); if (!ok) fails++; return ok; };
const shot = async (n, note) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log(`shot ${n}.png ${note || ''}`); };
const st = () => ev(() => { const E = MACHS.exc, D = MACHS.dump, T = E.load > 0.05 ? excBucketAt(E) : excTeeth(E), g = groundAt(T.x, T.z); return { inMach: S.inMach, phase: EXCI.phase, seeds: S.seeds, bucket: S.bucket, brich: sandRich('bucket'), hopper: S.hopper,
  exc: { x: E.x, z: E.z, h: E.h, load: E.load, rich: E.rich, arm: E.arm.slice(), drv: E.drv }, dump: { x: D.x, z: D.z, h: D.h, load: D.load, rich: D.rich, drv: D.drv, tipT: D.tipT },
  teeth: { x: T.x, y: T.y, z: T.z, up: T.y - g, d: Math.hypot(T.x - E.x, T.z - E.z) }, why: excPlantWhy(E, T) }; });
// the mouse, as a player moves it (no pointer lock in a headless page: the game reads the pointer's own moves)
let mx = W / 2, my = H / 2;
async function mouse(dx, dy, steps = 6, gap = 16) { for (let i = 0; i < steps; i++) {
  if (mx + dx / steps < 40 || mx + dx / steps > W - 40 || my + dy / steps < 40 || my + dy / steps > H - 40) { mx = W / 2; my = H / 2; await ev(() => { EXCI.lx = null; }); await page.mouse.move(mx, my); }   // back to the middle without it counting (a player lifts the mouse)
  mx += dx / steps; my += dy / steps; await page.mouse.move(mx, my); if (gap) await wait(gap); } }
// a press lands on the game, not on a HUD panel (with the pointer locked, as in play, it always does)
async function centre() { mx = W / 2; my = H / 2 + 60; await ev(() => { EXCI.lx = null; }); await page.mouse.move(mx, my); await wait(30); }
async function wheel(n) { for (let i = 0; i < Math.abs(n); i++) { await page.mouse.wheel(0, Math.sign(n) * 100); await wait(60); } }
// hold W/A/D like a driver until the machine is at (x, z) (tracks turn on the spot; the truck steers while rolling)
async function driveTo(k, x, z, maxS = 60, tol = 1.2) {
  const t0 = Date.now(); let held = new Set();
  const hold = async keys => { for (const q of held) if (!keys.includes(q)) { await page.keyboard.up(q); held.delete(q); } for (const q of keys) if (!held.has(q)) { await page.keyboard.down(q); held.add(q); } };
  let d = 99, it = 0;
  while (Date.now() - t0 < maxS * 1000) {
    const s = await ev(k => { const M = MACHS[k]; return { x: M.x, z: M.z, h: M.h }; }, k); d = Math.hypot(x - s.x, z - s.z); if (d < tol) break;
    let df = Math.atan2(x - s.x, z - s.z) - s.h; df = Math.atan2(Math.sin(df), Math.cos(df)); const keys = [];
    if (df > 0.06) keys.push('a'); else if (df < -0.06) keys.push('d');
    if (k === 'exc' ? Math.abs(df) < 0.5 : (Math.abs(df) < 0.25 && d > 6) || it++ % 3 === 0) keys.push('w');   // the truck: easy on the gas while turning and arriving
    await hold(keys); await wait(60);
  }
  await hold([]); await wait(300); return d < tol + 0.5;
}
async function faceTo(k, h, maxS = 20) { const t0 = Date.now(); while (Date.now() - t0 < maxS * 1000) { const s = await ev(k => MACHS[k].h, k); let df = h - s; df = Math.atan2(Math.sin(df), Math.cos(df)); if (Math.abs(df) < 0.05) break; const key = df > 0 ? 'a' : 'd'; await page.keyboard.down(key); await wait(Math.min(400, Math.abs(df) / 0.85 * 1000 * 0.6)); await page.keyboard.up(key); await wait(80); } }
// work the arm until the teeth are in the dirt (the ring goes green): open the bucket (C + mouse down), lower or raise the boom
async function teethToDirt(maxTries = 40) {
  await page.keyboard.down('c'); await mouse(0, 160, 8); await page.keyboard.up('c'); await wait(500);
  for (let i = 0; i < maxTries; i++) { const s = await st(); if (!s.why) return true;
    if (/Lower the teeth/.test(s.why)) await mouse(0, 25, 3); else if (/Too deep/.test(s.why)) await mouse(0, -15, 3); else if (/close/.test(s.why)) await wheel(-1); else if (/far/.test(s.why)) await wheel(1); else if (s.why === 'wait') { /* cooldown */ } else return s.why;
    await wait(350); }
  return (await st()).why;
}
async function scoop() { const ok = await teethToDirt(); if (ok !== true) return 'teeth: ' + ok; const l0 = (await st()).exc.load; await ev(() => { window.__lastScoop = null; if (!window.__wrapped) { window.__wrapped = 1; const o = excScooped; excScooped = function (m) { window.__lastScoop = m; return o(m); }; } });
  await ev(() => { window.__tr = []; clearInterval(window.__trI); window.__trI = setInterval(() => { const T = excTeeth(MACHS.exc); __tr.push([EXCI.phase, EXCI.pull | 0, +Math.hypot(T.x - EXCI.px, T.z - EXCI.pz).toFixed(2)].join(':')); }, 60); }); await centre(); await page.mouse.down(); await wait(80); await mouse(0, -70, 7, 40); const got = await page.waitForFunction(l => MACHS.exc.load > l + 0.1, l0, { timeout: 5000 }).then(() => true, () => false); await page.mouse.up(); await wait(300); return got || 'no scoop: ' + JSON.stringify(await ev(() => ({ answer: window.__lastScoop, phase: EXCI.phase, pull: EXCI.pull, tr: __tr.slice(0, 30).join(' ') }))); }
const tp = (x, z, yaw, pitch) => ev(([x, z, yaw, pitch]) => { P.x = x; P.z = z; P.y = groundAt(x, z); if (yaw != null) P.yaw = yaw; if (pitch != null) P.pitch = pitch; }, [x, z, yaw, pitch]);
const view = async fp => { if ((await ev(() => FP)) !== fp) { await page.keyboard.press('v'); await wait(300); } };

try {
  await page.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__cgl && document.querySelector('#startBtn'), null, { timeout: 60000 });
  await ev(() => { canvas.requestPointerLock = () => { }; });   // headless: no pointer lock (the game falls back to the pointer's moves)
  await ev(() => document.querySelector('#startBtn').click()); await page.waitForFunction(() => S.started && MODEL.ready, null, { timeout: 60000 }); await wait(1500);
  await ev(() => { runCommand('time 10:00'); runCommand('god on'); tuneSet('haz.all', 0); runCommand('give gold 20000'); S.up.pan = true; S.up.bucket = true; }); await wait(800);
  // ---- buy: the washers first (the excavator needs the long tom), then the two machines at the store's window
  await ev(() => { buyShopItem('washRocker'); }); await wait(400); await ev(() => { buyShopItem('washSluice'); }); await wait(600);
  await tp(16, 40.6, 0, 0.1); await wait(300); await page.keyboard.press('f'); await wait(700);
  for (const id of ['excavator', 'dumpTruck']) {
    const open = await ev(() => shopOpen); if (!open) { await page.keyboard.press('f'); await wait(600); }
    await ev(id => { const it = SHOP.find(i => i.id === id); if (typeof setShopCat === 'function') setShopCat(it.cat); }, id);
    const el = await page.$(`.shop-item[data-item="${id}"]`);
    if (el && await el.isVisible()) { await el.click(); await wait(200); await page.click('#shopBuyBtn').catch(() => { }); await wait(200); await page.click('#shopConfirmBuy').catch(() => { }); await wait(600); }
    else { console.log('note: clicked through buyShopItem for', id); await ev(id => buyShopItem(id), id); await wait(600); }
  }
  await page.keyboard.press('Escape'); await wait(300);
  await page.waitForFunction(() => MACHS.exc.on && MACHS.dump.on && MACHS.exc.n.Boom && MACHS.dump.n.Bed, null, { timeout: 15000 }).catch(() => { });
  let s = await st(); check('bought both: parked by the service gate with their models', s.exc && Math.abs(s.exc.x - SIMX('EXC_PARK').x) < 0.1 && (await ev(() => !!(MACHS.exc.n.Boom && MACHS.dump.n.Bed))), JSON.stringify({ exc: s.exc, dump: s.dump }));
  await view(true); await tp(62, 40, Math.PI / 2, 0.08); await wait(1200); await shot('01-parked', 'both machines by the service gate, from the lake');
  await view(false); await tp(41.8, 53.2, 2.6, 0.15); await wait(1200); await shot('02-scale', 'a 1.75 m digger at the excavator\'s cab');
  await tp(39.8, 33.3, 2.2, 0.12); await wait(900); await shot('02b-truck-scale', 'a digger at the dump truck');
  // ---- the dump truck first: out to where the excavator will work, bed toward it
  const door = await ev(() => { const d = machDoor(MACHS.dump); return d; }); await tp(door.x, door.z); await wait(300); await page.keyboard.press('f'); await wait(800);
  check('F at the truck\'s door: driving it', (await st()).inMach === 'dump');
  let ok = await driveTo('dump', 54, 40) && await driveTo('dump', 55, 56.5) && await driveTo('dump', 47, 56.5, 40, 0.8);
  s = await st(); check('drove the dump truck round to the dig (it refuses holes and walls)', ok, JSON.stringify(s.dump));
  await page.keyboard.press('f'); await wait(600);
  // ---- the excavator: climb in, cab view, drive it out east
  const edoor = await ev(() => machDoor(MACHS.exc)); await tp(edoor.x, edoor.z); await wait(300); await page.keyboard.press('f'); await wait(800);
  check('F at the cab: in the excavator', (await st()).inMach === 'exc');
  await view(true); await wait(800); await shot('03-cab', 'cab view and the HUD line');
  const hud = await ev(() => !MACH_HUD.hidden && MACH_HUD.textContent); check('the HUD shows the controls while seated', /EXCAVATOR/.test(hud || '') && /Wheel: stick/.test(hud || ''), hud);
  const x0 = (await st()).exc.x; ok = await driveTo('exc', 47.5, 50.5, 40, 0.6); await faceTo('exc', Math.PI / 2);
  s = await st(); check('drove the excavator out (slowly)', ok && s.exc.x > x0 + 7, JSON.stringify(s.exc));
  // ---- arm poses: reach out (wheel), open the bucket and get the teeth in the dirt
  await view(false); await wheel(-5); await wait(800);
  let r = await teethToDirt(); check('the arm (wheel, C + mouse, mouse) gets the teeth into the dirt: the ring goes green', r === true, String(r));
  await ev(() => { EXCV.headYaw = 0.9; EXCV.pitch = -0.1; }); await wait(400); await shot('04-pose-dig', 'arm reaching out, bucket open, teeth in the dirt');
  // scoop 1 -> the truck's bed
  r = await scoop(); s = await st(); check('scoop 1: hold left, pull up: the bucket loads', r === true && s.exc.load > 0.5, `${r} load ${s.exc.load}`);
  await centre(); await page.mouse.down(); await wait(60); await mouse(0, -120, 8, 30); await mouse(320, 0, 16, 30); await wait(1200);
  s = await st(); const bed = await ev(() => { const b = SIM.machAt(MACHS.dump, SIM.MACH.DUMP_BED[0], SIM.MACH.DUMP_BED[1]); return b; });
  console.log('teeth over bed?', Math.hypot(s.teeth.x - bed.x, s.teeth.z - bed.z).toFixed(2), 'teeth up', s.teeth.up.toFixed(2));
  await ev(() => { EXCV.headYaw = 1.4; EXCV.pitch = -0.05; }); await wait(300); await shot('05-pose-swing', 'loaded bucket swung over the truck, boom up');
  for (let i = 0; i < 12 && Math.hypot(s.teeth.x - bed.x, s.teeth.z - bed.z) > 1.6; i++) { const t = s.teeth, a = Math.atan2(bed.x - s.exc.x, bed.z - s.exc.z) - Math.atan2(t.x - s.exc.x, t.z - s.exc.z); await mouse(-Math.atan2(Math.sin(a), Math.cos(a)) / 0.005, 0, 4, 30); const bd = Math.hypot(bed.x - s.exc.x, bed.z - s.exc.z); if (bd < s.teeth.d - 0.6) await wheel(1); else if (bd > s.teeth.d + 0.6) await wheel(-1); await wait(700); s = await st(); }
  const d0 = s.dump.load; await wait(300); await page.mouse.up(); await page.waitForFunction(l => MACHS.dump.load > l + 0.3, d0, { timeout: 4000 }).catch(() => { });
  for (const t of [300, 1200]) { await wait(t); console.log('after the bed drop', JSON.stringify(await ev(() => ({ load: MACHS.exc.load, phase: EXCI.phase, dump: MACHS.dump.load })))); }
  s = await st(); check('let go over the bed: the load is in the truck, as rich as it came up', s.dump.load > 0.5 && s.exc.load < 0.01, JSON.stringify({ dump: s.dump.load, rich: s.dump.rich }));
  await wait(400); await shot('06-truck-loaded', 'sand in the truck\'s bed');
  // scoop 2 -> a flick onto the ground
  await mouse(-320, 0, 12, 30); await ev(() => { EXCV.headYaw = 0.6; }); await wait(1500);
  r = await scoop(); s = await st(); check('scoop 2', r === true && s.exc.load > 0.5, `${r} load ${s.exc.load}`);
  const L2 = { load: s.exc.load, rich: s.exc.rich }, piles0 = await ev(() => DYN.piles.size);
  await centre(); await page.mouse.down(); await wait(60); await mouse(0, -60, 6, 25); await mouse(130, 0, 3, 25); await wait(1200); await mouse(-180, 0, 5, 4); await page.mouse.up();
  await page.waitForFunction(n => DYN.piles.size > n, piles0, { timeout: 4000 }).catch(() => { });
  const pile = await ev(() => { const q = [...DYN.piles.values()].pop(); return q && { id: q.id, x: q.x, z: q.z, sand: q.sand, pay: q.pay }; });
  check('a flick over open ground: a pile with the same sand and richness', pile && Math.abs(pile.sand - L2.load) < 0.01 && Math.abs(pile.pay - L2.rich) < 0.01, JSON.stringify({ pile, L2 }));
  await wait(600); await ev(() => { EXCV.headYaw = 0.5; EXCV.pitch = 0.1; }); await wait(400); await shot('07-pile', 'the flung load on the ground');
  // scoop 3 (curled, carried) and the pit
  await mouse(60, 0, 3, 30); await wait(1500); r = await scoop(); s = await st(); check('scoop 3', r === true && s.exc.load > 0.5, `${r} load ${s.exc.load}`);
  await mouse(0, -150, 8, 30); await wheel(3); await wait(1200); await ev(() => { EXCV.headYaw = -0.9; EXCV.pitch = 0.0; }); await wait(300); await shot('08-pose-carry', 'bucket curled with a load, stick folded in');
  const pit = await ev(() => { let n = 0, d = 0; forNearHoles(MACHS.exc.x + 6, MACHS.exc.z, h => { if (Math.hypot(h.x - MACHS.exc.x - 6, h.z - MACHS.exc.z) < 4) { n++; d = Math.max(d, h.d); } }); return { n, d }; });
  check('the pit: several overlapping holes, deeper in the middle', pit.n >= 10 && pit.d > 0.6, JSON.stringify(pit));
  await view(false); await ev(() => { EXCV.headYaw = 0.35; EXCV.pitch = 0.35; }); await wait(800); await shot('09-pit', 'the pit after three scoops');
  // ---- drive in through the service gate with the load and tip it at the sifter
  await view(true); ok = await driveTo('exc', 40, 39.5, 60) && await driveTo('exc', 31, 39.5, 40, 0.8) && await driveTo('exc', 17.5, 39.5, 60, 0.8); await faceTo('exc', -Math.PI / 2);
  s = await st(); check('drove the excavator in through the service gate to the sifter', ok, JSON.stringify(s.exc));
  await shot('10-cab-camp', 'cab view inside camp, heading for the sifter');
  const G = await ev(() => SIM.GOLD.SIFTER);
  for (let i = 0; i < 10; i++) { s = await st(); const dz = Math.hypot(s.teeth.x - G.x, s.teeth.z - G.z); if (dz < 3) break; const a = Math.atan2(G.x - s.exc.x, G.z - s.exc.z) - Math.atan2(s.teeth.x - s.exc.x, s.teeth.z - s.exc.z); await mouse(-Math.atan2(Math.sin(a), Math.cos(a)) / 0.005, 0, 4, 30); if (Math.hypot(G.x - s.exc.x, G.z - s.exc.z) > s.teeth.d + 0.5) await wheel(-1); else if (Math.hypot(G.x - s.exc.x, G.z - s.exc.z) < s.teeth.d - 0.5) await wheel(1); await wait(800); }
  const g0 = (await st()).seeds, h0 = (await st()).hopper; await centre(); await page.mouse.down(); await wait(100); await page.mouse.up();
  await page.waitForFunction(([g, h]) => S.seeds > g || S.hopper > h, [g0, h0], { timeout: 5000 }).catch(() => { });
  s = await st(); check('tipped at the sifter: it goes through (gold to the crew)', s.seeds > g0 || s.hopper > h0, `gold ${g0} -> ${s.seeds}, teeth ${Math.hypot(s.teeth.x - G.x, s.teeth.z - G.z).toFixed(2)} m from the sifter`);
  await page.keyboard.press('f'); await wait(600);
  // ---- the truck to the sifter and unload
  const tdoor = await ev(() => machDoor(MACHS.dump)); await tp(tdoor.x, tdoor.z); await wait(300); await page.keyboard.press('f'); await wait(700);
  await view(false); ok = await driveTo('dump', 52, 46) && await driveTo('dump', 40, 39.5) && await driveTo('dump', 28.5, 39.5, 40, 1.0);
  s = await st(); check('drove the loaded truck in at the service gate', Math.hypot(s.dump.x - G.x, s.dump.z - G.z) < 22 && s.dump.load > 0.5, JSON.stringify(s.dump));
  const g1 = s.seeds; await page.keyboard.press('e'); await page.waitForFunction(() => MACHS.dump.tipT > 0.9, null, { timeout: 5000 }).catch(() => { });
  await ev(() => { P.yaw = MACHS.dump.h + Math.PI * 0.62; P.pitch = 0.25; }); await wait(250); await shot('11-truck-tipping', 'the bed up, the load pouring out at the sifter');
  await page.waitForFunction(g => S.seeds > g || S.hopper > 0, g1, { timeout: 5000 }).catch(() => { });
  s = await st(); check('E at the sifter: the load goes through and the bed is empty', s.seeds > g1 && s.dump.load < 0.01, `gold ${g1} -> ${s.seeds}`);
  await page.keyboard.press('f'); await wait(600);
  // ---- a digger walks into the pile: their bucket fills with that sand, as rich as it was
  await view(true); await ev(() => { S.bucket = 0; sandReset('bucket'); }); await tp(pile.x + 1.2, pile.z, -Math.PI / 2, 0.4); await wait(2500);
  s = await st(); check('a digger at the pile: bucket fills at the pile\'s richness', s.bucket > 1 && Math.abs(s.brich - pile.pay) < 0.01, `bucket ${s.bucket.toFixed(2)} x${s.brich.toFixed(3)} (pile x${pile.pay.toFixed(3)})`);
  const still = await ev(() => [MACHS.exc.x, MACHS.exc.z, MACHS.dump.x, MACHS.dump.z].map(v => v.toFixed(3)).join()); await wait(1500);
  check('nobody driving: they stay put', still === await ev(() => [MACHS.exc.x, MACHS.exc.z, MACHS.dump.x, MACHS.dump.z].map(v => v.toFixed(3)).join()));
  await view(false); await tp(30, 46, 2.3, 0.25); await wait(900); await shot('12-parked-in-camp', 'both machines left by the sifter');
} catch (e) { console.log('FAIL exception', e.message.split('\n')[0]); fails++; }
function SIMX(k) { return { EXC_PARK: { x: 39 } }[k]; }
if (errs.length) { console.log('page errors:\n' + errs.slice(0, 8).join('\n')); fails++; }
await browser.close(); if (srv) srv.kill(); console.log(`screenshots in ${OUT}`); console.log(fails ? `MACHINES PLAY FAILED (${fails})` : 'MACHINES PLAY PASSED'); process.exit(fails ? 1 : 0);
