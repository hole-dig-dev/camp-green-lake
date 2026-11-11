#!/usr/bin/env node
// tests/town-play.mjs -- a bot plays the buried town of Marlow's Landing start to finish, with real keys (W to walk, steering
// like a player with the mouse, E to dig, F to use, R to grab):
//   dig a 5 ft hole at the old town's spot until the floor gives, climb down, walk Main Street, light a lantern, go into
//   five buildings, take the bank manager's key, read the notes with the vault's combination, watch the map fill in,
//   pull the cellar's counterweight, open Lil's vault, carry a gold bar up the shaft, and sell it at the Company Store.
//   A second browser then joins and must see the same town: the lantern lit, the vault open, the find gone, the map.
// Prints a timeline and exits non-zero on a failed step.
//   node tests/town-play.mjs            (starts its own server on a free port, scratch data, event director and mines off)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS || '';   // a folder: save a screenshot at each milestone
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = +(process.env.PORT || await freePort()), data = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-townplay-'));
fs.writeFileSync(path.join(data, 'world.json'), '{"director":{"on":false}}'); fs.writeFileSync(path.join(data, 'tune.json'), '{"haz.mines":{"v":0,"def":1},"haz.all":{"v":0,"def":1}}');
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: data }, stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const errs = []; let failed = 0, page;
async function open(name) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errs.push(name + ' PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|SwiftShader|WebSocket|ERR_/i.test(m.text())) errs.push(name + ' CONSOLE ' + m.text().slice(0, 200)); });
  await p.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load' }); await p.waitForFunction(() => window.__cgl && document.querySelector('#startBtn'), null, { timeout: 60000 });
  await p.evaluate(n => { document.querySelector('#nick') && (document.querySelector('#nick').value = n); }, name);
  await p.evaluate(() => document.querySelector('#startBtn').click()); await p.waitForTimeout(3000);
  await p.waitForFunction(() => online() && S.started, null, { timeout: 20000 });
  return p;
}
const log = async (what, ok = true) => {
  const s = await page.evaluate(() => `${clockText()}  gold ${S.seeds}  at ${(P.x - (S.inTown ? SIM.TOWN.X : 0)).toFixed(0)},${P.z.toFixed(0)}${S.inTown ? ' (town)' : ''}`).catch(() => '?');
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${s}  ${what}`); if (!ok) failed++; return ok;
};
const shot = async n => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const ev = (f, a) => page.evaluate(f, a);
async function walkTo(x, z, maxS = 60, tol = 0.9) {   // hold W and steer like a player with the mouse; give up if stuck
  const t0 = Date.now(); await page.keyboard.down('w'); let d = 99, best = 99, bestT = Date.now();
  while (Date.now() - t0 < maxS * 1000) {
    d = await ev(([x, z]) => { P.yaw = Math.atan2(-(x - P.x), -(z - P.z)); P.pitch = 0.1; return Math.hypot(x - P.x, z - P.z); }, [x, z]);
    if (d < tol) break; if (d < best - 0.2) { best = d; bestT = Date.now(); } else if (Date.now() - bestT > 6000) break;
    await page.waitForTimeout(80);
  }
  await page.keyboard.up('w'); return d < tol + 0.5;
}
async function walkPath(pts, what) { for (const [x, z] of pts) if (!(await walkTo(x, z))) return log(`${what}: stuck on the way to ${(x - 2000).toFixed(1)},${z.toFixed(1)} (${await ev(([x, z]) => { const dx = x - P.x, dz = z - P.z, l = Math.hypot(dx, dz); return 'ahead walkable ' + townWalk(P.x + dx / l * 0.3, P.z + dz / l * 0.3, P.crouch) + ', crouch ' + P.crouch; }, [x, z])})`, false); return true; }
// world points along the layout (town coordinates in the page are relative: tx/tz add the offset)
const doorIn = (key, side, inside = 2.2, out = 2.0) => ev(([key, side, inside, out]) => { const b = townLay().bldgs.find(b => b.key === key), D = SIM.townDoor(b, side), st = b.doors[side] === 'street';
  return [...(st ? [[tx(D.x), tz(0)]] : []), [tx(D.x + D.nx * out), tz(D.z + D.nz * out)], [tx(D.x - D.nx * inside), tz(D.z - D.nz * inside)]]; }, [key, side, inside, out]);   // a street door: by way of the middle of the street
const tunnel = (a, b) => ev(([a, b]) => { const L = townLay(), t = L.tunnels.find(t => { const k = L.bldgs.filter(q => Object.values(q.doors).includes('t' + t.id)).map(q => q.key); return k.includes(a) && (b === 'street' ? k.length === 1 : k.includes(b)); });
  const ends = L.bldgs.filter(q => Object.values(q.doors).includes('t' + t.id)); let pts = [...townSamples(t).map(s => s[0]), t.pts[t.pts.length - 1]].map(p => [tx(p[0]), tz(p[1])]);   // along the tunnel's middle
  const A = ends.find(q => q.key === a), dA = A ? Math.hypot(t.pts[0][0] - A.x, t.pts[0][1] - A.z) : 0, dZ = A ? Math.hypot(t.pts[t.pts.length - 1][0] - A.x, t.pts[t.pts.length - 1][1] - A.z) : 0;
  if (dZ < dA) pts = pts.reverse(); return { pts, crawl: !!t.crawl }; }, [a, b]);
async function goTunnel(a, b) { const t = await tunnel(a, b); if (t.crawl) await page.keyboard.press('c'); const ok = await walkPath(t.pts.slice(1, -1), `tunnel ${a} to ${b}`); if (t.crawl) await page.keyboard.press('c'); return ok; }
// stand within reach of something and check that F would do the expected thing
async function approach(target, id) {
  // a spot to stand where this is what F would do (tried by asking the game's own nearSpot at each candidate), then walk there
  const p = await ev(([t, id]) => { const x0 = P.x, z0 = P.z; let found = null;
    for (let r = 0.9; r <= 2.1 && !found; r += 0.2) for (let k = 0; k < 24 && !found; k++) { const a = k * Math.PI / 12, x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r; if (!townWalk(x, z, false)) continue;
      let ok = true; for (let j = 0; j < 9 && ok; j++) { P.x = x + (j ? Math.cos(j * 0.785) * 0.4 : 0); P.z = z + (j ? Math.sin(j * 0.785) * 0.4 : 0); const s = nearSpot(); ok = !!s && s.id === id; }   // with some room to spare
      if (ok) found = [x, z]; }
    P.x = x0; P.z = z0; return found; }, [target, id]);
  if (!p) return false; await walkTo(p[0], p[1], 40, 0.3);   // (judged below by what F would do, not by how close it got)
  await ev(([t]) => { P.yaw = Math.atan2(-(t.x - P.x), -(t.z - P.z)); }, [target]); await page.waitForTimeout(150);
  return ev(id => { const s = nearSpot(); return s && s.id === id ? (s.label || s.id) : null; }, id);
}
async function useF(target, id, what) { const s = await approach(target, id); if (!s) return log(`${what}: couldn't get to it (spot ${await ev(() => { const s = nearSpot(); return s && (s.label || s.id); })})`, false); await page.keyboard.press('f'); await page.waitForTimeout(700); return s; }
const closeDlg = async () => { if (await ev(() => DLG.open)) { await page.click('#dlg-opt-0'); await page.waitForTimeout(300); } };

try {
  page = await open('Dusty');
  await ev(() => { __cgl.runCommand('god on'); __cgl.runCommand('time 07:00'); S.up.shovel = true; S.batt = 100; });
  // ---- 1. break in: a 5 ft hole at the old town's spot, dug with E
  const O = await ev(() => SIM.OLD_TOWN);
  await ev(([x, z]) => { __cgl.runCommand(`tp ${x + 1.5} ${-(z)}`); }, [O.x, O.z]); await page.waitForTimeout(1500);
  await log('at the old town (the Superintendent\'s X/Y)', await walkTo(O.x, O.z, 20, 0.6));
  await ev(() => { P.pitch = 0.6; }); let t0 = Date.now();
  await page.keyboard.down('e'); await page.waitForFunction(() => BREACH.size > 0, null, { timeout: 150000 }).catch(() => { }); await page.keyboard.up('e');
  await log(`dug down until the floor gave way (${((Date.now() - t0) / 1000).toFixed(0)} s)`, await ev(() => BREACH.size > 0));
  await page.waitForTimeout(800);
  await log('F by the hole: climb down', (await ev(() => (nearSpot() || {}).id)) === 'townDown');
  await page.keyboard.press('f'); await page.waitForTimeout(2500);
  await log('in the buried town, on Main Street', await ev(() => S.inTown && townWhere(P.x, P.z, true)?.name === 'Main Street')); await shot('01-arrival');
  await ev(() => { if (!S.light) toggleLight(); });
  // ---- 2. the street, a lantern, the saloon (its find, and the IOU with the dial's first half)
  const sal = await doorIn('saloon', 'S');
  await log('walked Main Street to the saloon and in', await walkPath(sal, 'saloon'));
  const lamp0 = await ev(() => { const l = SIM.townLamps()[0]; return { x: tx(l.x), z: tz(l.z), i: 0 }; });
  await useF(lamp0, 'townLamp', 'saloon lantern');
  await page.waitForTimeout(500); await log('lit the saloon\'s lantern (the server holds it)', await ev(() => TST.lit.includes(0)));
  const note = k => ev(k => { const n = TS.notes.find(n => n.key === k); return n && { x: n.x, z: n.z }; }, k);
  await useF(await note('saloon'), 'townNote', 'saloon IOU');
  await log(`read the IOU: "${(await ev(() => $('#dlgText').textContent)).slice(0, 60)}..."`, await ev(() => DLG.open && S.townRead.includes('saloon'))); await shot('02-note'); await closeDlg();
  await log('the map: the saloon has a name on it', await ev(() => TM.entered.has('saloon')));
  // ---- 3. more buildings on the street: store, hotel, then the bank's key
  for (const k of ['store', 'hotel']) { const p = await doorIn(k, 'S'); await walkPath([sal[0], ...p], k); await log(`went into the ${k}`, await ev(k => townWhere(P.x, P.z, true)?.b?.key === k, k)); await walkTo(p[0][0], p[0][1]); }
  const bank = await doorIn('bank', 'N');
  await walkPath(bank, 'bank'); await log('went into the bank', await ev(() => townWhere(P.x, P.z, true)?.b?.key === 'bank'));
  const fpos = k => ev(k => { const e = TS.finds.get(k); return { x: e.x, z: e.z }; }, k);
  await useF(await fpos('bank'), 'townFind', 'bank key'); await page.waitForTimeout(800);
  await log('took the bank manager\'s key (the find is the crew\'s; the key is mine)', await ev(() => TST.sigs.bank && S.up.vaultkey));
  await useF(await note('bank'), 'townNote', 'bank ledger'); await closeDlg();
  // ---- 4. south through the tunnels: the root cellar's lever, the well, Lil's house (the dial's second half)
  const bS = await doorIn('bank', 'S'); await walkPath([bS[1], bS[0]], 'bank south door');
  await log('through the tunnel from the bank to the root cellar', await goTunnel('bank', 'cellar'));
  const cN = await doorIn('cellar', 'N'); await walkPath([cN[1]], 'cellar');
  const lever = await ev(() => TS.leverPos);
  await useF(lever, 'townLever', 'counterweight'); await page.waitForTimeout(1000);
  await log('pulled the counterweight lever', await ev(() => !!TST.vault.lever)); await shot('03-cellar');
  const cW = await doorIn('cellar', 'W'); await walkPath([cW[1], cW[0]], 'cellar west door');
  await log('tunnel to the old well', await goTunnel('cellar', 'well'));
  const wE = await doorIn('well', 'E'), wS = await doorIn('well', 'S');
  await walkPath([wE[1], [wE[1][0], wS[1][1]], wS[1], wS[0]], 'across the well'); await shot('04-well');
  await log('tunnel to Lil\'s house', await goTunnel('well', 'lil'));
  const lS = await doorIn('lil', 'S'); await walkPath([lS[1]], 'Lil\'s house');
  await useF(await note('lil'), 'townNote', 'Lil\'s diary'); await log('read Lil\'s diary (the dial\'s second half)', await ev(() => S.townRead.includes('lil'))); await closeDlg();
  await useF(await fpos('lil'), 'townFind', 'silver dollar'); await page.waitForTimeout(600);
  await log('took Lil\'s lucky silver dollar (into the sack)', await ev(() => S.sack.includes('dollar'))); await shot('05-lil');
  const nb = await ev(() => TM.entered.size), cells = await ev(() => { let n = 0; for (let i = 0; i < SIM.TOWN_MAP_N; i++)n += SIM.mapBit(TST.map, i); return n; });
  await log(`the map has filled in: ${cells} cells explored, ${nb} buildings named`, cells > 150 && nb >= 6);
  await ev(() => openFieldMap()); await page.waitForTimeout(800); await shot('06-map'); await ev(() => closeFieldMap());
  // ---- 5. back up to the street and east to Lil's vault
  await walkPath([lS[0]], 'out of Lil\'s'); await goTunnel('lil', 'well'); await walkPath([wS[1], [wE[1][0], wS[1][1]], wE[1], wE[0]], 'across the well');
  await goTunnel('well', 'cellar'); await walkPath([cW[1], cN[1], cN[0]], 'through the cellar'); await goTunnel('cellar', 'bank'); await walkPath([bS[1], bank[2], bank[1], bank[0]], 'up through the bank');
  const vt = await tunnel('vault', 'street'), vin = [...vt.pts].reverse(); await walkPath([[vin[0][0] - 2, 0], ...vin.slice(1, -1)], 'the vault tunnel');   // vt runs from the vault's door to the street
  const door = await ev(() => ({ x: TS.doorPos.x, z: TS.doorPos.z }));
  await useF(door, 'townVault', 'vault door'); await shot('07-vault-door');
  const dlg = await ev(() => [...document.querySelectorAll('#dlgOpts button')].map(b => b.textContent));
  await log(`at the vault door: ${dlg.length - 1} things to do`, dlg.some(t => /key/.test(t)) && dlg.some(t => /18/.test(t)) && dlg.some(t => /87/.test(t)));
  for (const want of [/key/, /18/, /87/]) { if (!(await ev(() => DLG.open))) { await page.keyboard.press('f'); await page.waitForTimeout(600); }
    const i = await ev(w => [...document.querySelectorAll('#dlgOpts button')].findIndex(b => new RegExp(w).test(b.textContent)), want.source); if (i >= 0) await page.click('#dlg-opt-' + i); await page.waitForTimeout(900); }
  await log('turned the key, dialled 18 and 87: the vault opens', await ev(() => !!TST.vault.open));
  await page.waitForTimeout(5500); await log('the door swung open', await ev(() => TS.doorA >= 1)); await shot('08-vault-open');
  // ---- 6. a gold bar, carried west to the break-in shaft and up
  await walkTo(door.x + 2.5, door.z, 20, 0.8);
  const bar = await ev(() => ({ x: TS.bars[0].position.x, z: TS.bars[0].position.z }));
  await useF(bar, 'townBar', 'gold bar'); await page.waitForTimeout(700);
  await log('picked up one of Lil\'s gold bars (45 kg: a slow walk)', await ev(() => townCarrying())); await shot('09-carry');
  const shaft = await ev(() => { const [k, b] = [...BREACH][0]; return shaftPos(b); });
  await walkPath([...vt.pts.slice(1, -1), [vin[0][0] - 3, 0], [shaft.x, shaft.z]], 'carrying the bar to the shaft');
  await log('under the shaft with the bar', (await ev(() => (nearSpot() || {}).id)) === 'townShaft');
  await page.keyboard.press('f'); await page.waitForTimeout(2000);
  const prop = await ev(() => PROPS.has(SIM.TOWN_BAR_ID0 + 0));
  await log('climbed out with it: the bar is heavy loot on the lake', !(await ev(() => S.inTown)) && prop); await shot('10-out');
  // ---- 7. grab it with R and haul it to the Company Store window. The 380 m across the lake is shortened: still holding
  //         R, you and the bar are moved to the camp, 7 m short of the window, and you walk it the rest of the way
  await ev(() => { const pr = PROPS.get(SIM.TOWN_BAR_ID0); P.yaw = Math.atan2(-(pr.x - P.x), -(pr.z - P.z)); P.pitch = 0.45; });
  await page.keyboard.down('r'); await page.waitForTimeout(1500);
  await log('holding R: grabbed the gold bar', await ev(() => GRAB_ST.id === SIM.TOWN_BAR_ID0));
  const g0 = await ev(() => S.seeds);
  await ev(() => { __cgl.runCommand('tp 16 -32'); const pr = PROPS.get(SIM.TOWN_BAR_ID0); pr.x = P.x; pr.z = P.z + 1.8; pr.y = groundAt(pr.x, pr.z) + 0.3; pr.vx = pr.vy = pr.vz = 0; pr.rest = false; pr.restT = 0; P.yaw = Math.PI; });
  await page.waitForTimeout(2000);
  await page.keyboard.down('w'); for (let k = 0; k < 60; k++) { await ev(() => { P.yaw = Math.atan2(-(16 - P.x), -(37.5 - P.z)); }); await page.waitForTimeout(100); } await page.keyboard.up('w');
  await page.waitForTimeout(2000); await page.keyboard.up('r'); await page.waitForTimeout(1000);
  const sold = await ev(() => !PROPS.has(SIM.TOWN_BAR_ID0)), g1 = await ev(() => S.seeds);
  await log(`sold the gold bar at the Company Store (+${g1 - g0} gold)`, sold && g1 > g0);
  // ---- 8. a second digger: the same town
  const A = page; page = await open('Pockets');
  const st = await ev(() => ({ lit: TST.lit.length, open: !!TST.vault.open, bank: TST.sigs.bank, map: (() => { let n = 0; for (let i = 0; i < SIM.TOWN_MAP_N; i++)n += SIM.mapBit(TST.map, i); return n; })(), up: TST.bars.filter(b => b.at === 'up').length }));
  await log(`second browser joins: ${st.lit} lantern lit, vault ${st.open ? 'open' : 'shut'}, bank find taken by ${st.bank}, ${st.map} map cells, ${st.up} bar up`, st.lit >= 1 && st.open && st.bank === 'Dusty' && st.map === cells || (st.map >= cells && st.open && st.lit >= 1));
  await ev(() => { __cgl.runCommand('god on'); __cgl.runCommand('town in'); }); await page.waitForTimeout(4000);
  const seen = await ev(() => ({ door: TS.doorA, glow: [...TL.glow.geometry.attributes.lit.array].filter(v => v > 0).length, bankFind: TS.finds.get('bank').g ? TS.finds.get('bank').g.visible : null }));
  await log(`down there too: vault door open (${seen.door}), ${seen.glow} lantern glowing, the bank's find gone`, seen.door >= 1 && seen.glow >= 1 && seen.bankFind === false);
  await ev(() => { P.x = TS.doorPos.x - 6; P.z = TS.doorPos.z; P.yaw = -Math.PI / 2; }); await page.waitForTimeout(1500); await shot('11-second-browser');
  // ---- 9. the danger (switched on for this part only): run past a creaky ceiling twice and it comes down; dig through it
  await ev(() => { TUNE_OVR['haz.on.cavein'] = { v: 1, def: 0 }; S.up.shovel = true; const s = TD.sags[0], ax = Math.sin(s.ry), az = Math.cos(s.ry); P.x = tx(s.x) - ax * 5; P.z = tz(s.z) - az * 5; });
  await page.waitForTimeout(800);
  const sag = await ev(() => { const s = TD.sags[0], ax = Math.sin(s.ry), az = Math.cos(s.ry); return { x: tx(s.x), z: tz(s.z), ax, az }; });
  const run = async (x, z, ms) => { await page.keyboard.down('Shift'); await page.keyboard.down('w'); const t0 = Date.now(); while (Date.now() - t0 < ms) { await ev(([x, z]) => { P.yaw = Math.atan2(-(x - P.x), -(z - P.z)); }, [x, z]); await page.waitForTimeout(60); } await page.keyboard.up('w'); await page.keyboard.up('Shift'); };
  await run(sag.x - sag.ax * 2.5, sag.z - sag.az * 2.5, 700);
  await log('ran at a creaky ceiling: it groans (a warning, nothing falls yet)', await ev(() => TD.warnT[0] > 0 && !TST.caves[0]));
  await walkTo(sag.x - sag.ax * 5, sag.z - sag.az * 5, 10); await page.waitForTimeout(1200);
  await run(sag.x - sag.ax * 2.5, sag.z - sag.az * 2.5, 900); await page.waitForTimeout(1200);
  await log('ran at it again while it groaned: the ceiling came down and blocks the tunnel', await ev(() => TST.caves[0] === 1 && townCaveBlocks(TD.sags[0].x + SIM.TOWN.X, TD.sags[0].z)));
  await shot('12-cave-in');
  await walkTo(sag.x - sag.ax * 2.6, sag.z - sag.az * 2.6, 10, 0.6);
  await log('at the pile: hold E to dig', (await ev(() => (nearSpot() || {}).id)) === 'townCave');
  await page.keyboard.down('e'); await page.waitForFunction(() => TST.caves[0] === 2, null, { timeout: 30000 }).catch(() => { }); await page.keyboard.up('e');
  await log('dug through it: the tunnel is open again, and it has settled', await ev(() => TST.caves[0] === 2 && !townCaveBlocks(TD.sags[0].x + SIM.TOWN.X, TD.sags[0].z)));
  await A.close();
} catch (e) { console.log('FAIL exception: ' + (e && e.stack || e)); failed++; }
if (errs.length) { console.log(errs.slice(0, 12).join('\n')); failed += errs.length; }
await browser.close(); srv.kill();
console.log(failed ? `TOWN PLAY FAILED (${failed})` : 'TOWN PLAY PASSED');
process.exit(failed ? 1 : 0);
