#!/usr/bin/env node
// tests/machines.mjs -- the Company's machines on the server (server.js machOp / excScoopS, public/js/87-excavator.js):
// buying both, one seat each, a scoop digging holes and filling the bucket only within reach, outside the camp's strip and
// after the cooldown, the load and its richness kept from bucket to truck to the sifter's payout and from bucket to a
// pile on the ground, a digger tipping a bucket in at the tail, and the machines staying put while nobody drives.
// Talks to a real server over WebSocket like a page does (no browser): a few seconds. Part of `npm test`.
//   node tests/machines.mjs     (starts its own server on a free port, scratch data)
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const WebSocket = require('ws'); const SIM = require('../public/sim.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); const M = SIM.MACH;
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort(), data = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-machines-'));
fs.writeFileSync(path.join(data, 'world.json'), '{"director":{"on":false}}');
const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: data }, stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch { } await new Promise(r => setTimeout(r, 100)); }
let fails = 0; const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  -- ' + info : ''}`); if (!ok) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(20); } return fn(); };
function client(name) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), c = { name, ws, msgs: [], id: null, mach: null, host: false, holes: new Map(), piles: new Map(), pay: [] };
    c.send = o => ws.send(JSON.stringify(o));
    c.take = t => { const i = c.msgs.findIndex(m => m.t === t); return i < 0 ? null : c.msgs.splice(i, 1)[0]; };
    c.at = (x, z) => c.send({ t: 'pos', x, y: 0, z, r: 0, a: 0, f: 0 });
    ws.on('message', raw => { const m = JSON.parse(raw); c.msgs.push(m);
      if (m.t === 'hello') { c.id = m.id; c.mach = m.mach && m.mach.st; for (const p of m.piles || []) c.piles.set(p.id, p); }
      if (m.t === 'mach') c.mach = m.st; if (m.t === 'host') c.host = true;
      if (m.t === 'dig') c.holes.set(m.x + '|' + m.z, m.d); if (m.t === 'pile') c.piles.set(m.p.id, m.p); if (m.t === 'machPay') c.pay.push(m); });
    ws.on('open', () => c.send({ t: 'join', n: name }));
    ws.on('error', rej);
    const t0 = Date.now(), iv = setInterval(() => { if (c.host && c.id != null) { clearInterval(iv); res(c); } else if (Date.now() - t0 > 8000) { clearInterval(iv); rej(new Error('join timeout ' + name)); } }, 20);
  });
}
const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;
// a driver's page reporting its way somewhere, a few metres a report (the server ignores teleports)
async function drive(c, k, from, to, h) { let p = { ...from }; for (;;) { const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz); if (d < 0.01) break; const s = Math.min(5, d); p = { x: p.x + dx / d * s, z: p.z + dz / d * s }; c.send({ t: k, op: 'pos', x: p.x, z: p.z, h }); await sleep(50); } }
try {
  const A = await client('Alpha'), B = await client('Bravo'), C = await client('Charlie');
  // ---- buying
  A.send({ t: 'campBuy', id: 'excavator', cost: 4000 }); await sleep(250);
  check('the excavator needs the long tom & sluice first (refused, no machine)', !(A.mach && A.mach.exc));
  A.send({ t: 'campBuy', id: 'washRocker', cost: 600 }); A.send({ t: 'campBuy', id: 'washSluice', cost: 2200 });
  A.send({ t: 'campBuy', id: 'dumpTruck', cost: 3000 }); await sleep(250);
  check('the dump truck needs the excavator first', !(A.mach && A.mach.dump));
  A.send({ t: 'campBuy', id: 'excavator', cost: 4000 }); await until(() => A.mach && A.mach.exc);
  A.send({ t: 'campBuy', id: 'dumpTruck', cost: 3000 }); await until(() => B.mach && B.mach.dump);
  const E0 = B.mach.exc, D0 = B.mach.dump;
  check('bought: both parked by the service gate, empty, nobody driving', E0 && D0 && near(E0.x, M.EXC_PARK.x) && near(D0.z, M.DUMP_PARK.z) && E0.load === 0 && D0.load === 0 && E0.drv == null && D0.drv == null, JSON.stringify({ E0, D0 }));
  check('a late joiner hears about them in hello', (await client('Delta')).mach?.exc != null);
  // ---- one seat each
  A.at(E0.x + 2, E0.z); B.at(E0.x - 2, E0.z); C.at(D0.x + 2, D0.z); await sleep(120);
  A.send({ t: 'exc', op: 'in' }); await until(() => B.mach.exc.drv === A.id);
  B.send({ t: 'exc', op: 'in' }); await sleep(200);
  check('Alpha drives the excavator; Bravo can\'t take the seat', B.mach.exc.drv === A.id, 'drv ' + B.mach.exc.drv);
  A.send({ t: 'dump', op: 'in' }); await sleep(200);
  check('...and Alpha can\'t be in the dump truck at the same time', B.mach.dump.drv == null);
  C.send({ t: 'dump', op: 'in' }); await until(() => B.mach.dump.drv === C.id);
  check('Charlie drives the dump truck', B.mach.dump.drv === C.id);
  B.send({ t: 'dump', op: 'pos', x: 0, z: 0, h: 0 }); B.send({ t: 'exc', op: 'pos', x: 0, z: 0, h: 0 }); await sleep(200);
  check('nobody but the driver moves a machine', B.mach.exc.x === E0.x && A.mach.dump.x === D0.x);
  // ---- the excavator out on the lake bed, facing east
  const EX = { x: 45, z: 50.5, h: Math.PI / 2 };
  A.send({ t: 'exc', op: 'pos', x: E0.x + 6, z: EX.z, h: EX.h, a: [0.2, 1.2, 0, 0.2] }); await sleep(60); A.send({ t: 'exc', op: 'pos', x: EX.x, z: EX.z, h: EX.h, a: [0.2, 1.2, 0, 0.2] });
  const mp = await until(() => B.msgs.find(m => m.t === 'mpos' && m.k === 'exc' && near(m.p[0], EX.x)));
  check('the driver\'s position and arm reach the others', mp && mp.p.length === 7 && near(mp.p[3], 0.2), JSON.stringify(mp && mp.p));
  A.send({ t: 'exc', op: 'pos', x: EX.x + 30, z: EX.z, h: EX.h }); await sleep(100);
  check('a 30 m jump in one report is ignored', !B.msgs.some(m => m.t === 'mpos' && m.p[0] > EX.x + 5));
  const scoop = async (x, z) => { A.take('excScoop'); A.send({ t: 'excScoop', x, z }); return until(() => A.take('excScoop'), 2000); };
  let r = await scoop(EX.x + 20, EX.z); check('a scoop out of reach is refused', r && !r.ok && r.why === 'reach', JSON.stringify(r));
  r = await scoop(EX.x + 1.5, EX.z); check('a scoop under its own tracks is refused', r && !r.ok && r.why === 'close', JSON.stringify(r));
  const T1 = { x: EX.x + 5.5, z: EX.z }; const before = B.holes.size;
  r = await scoop(T1.x, T1.z);
  check('a scoop in reach digs holes (everyone sees them) and loads the bucket', r && r.ok && r.v > 0.9 && (await until(() => B.holes.size >= before + 7)) && B.mach.exc.load > 0.9, JSON.stringify(r) + ' holes ' + B.holes.size);
  check('...the middle one 0.45 m deep, the ring 0.2 m, a metre out', B.holes.get(T1.x + '|' + T1.z) === 0.45 && B.holes.get((T1.x + 1) + '|' + T1.z) === 0.2);
  const rich1 = SIM.excScoopPlan(T1.x, T1.z, () => 0, () => true).rich;
  check('...as rich as the ground it came from (sim.js payMult)', near(B.mach.exc.rich, rich1, 2e-3), `${B.mach.exc.rich} vs ${rich1.toFixed(3)}`);
  r = await scoop(T1.x + 0.5, T1.z); check('a second scoop straight away waits for the cooldown', r && !r.ok && r.why === 'wait');
  // the camp's no-dig strip: put it by the fence, reach toward it
  A.send({ t: 'exc', op: 'pos', x: EX.x - 4, z: EX.z, h: -Math.PI / 2 }); await sleep(60); A.send({ t: 'exc', op: 'pos', x: 37, z: EX.z, h: -Math.PI / 2 }); await sleep(M.EXC_COOLDOWN * 1000);
  r = await scoop(32.5, EX.z); check('no scooping in the strip by the camp fence', r && !r.ok && r.why === 'camp', JSON.stringify(r));
  A.send({ t: 'exc', op: 'pos', x: 41, z: EX.z, h: EX.h }); await sleep(60); A.send({ t: 'exc', op: 'pos', x: EX.x, z: EX.z, h: EX.h }); await sleep(80);
  r = await scoop(T1.x - 0.3, T1.z + 1.2); check('after the cooldown, another scoop', r && r.ok, JSON.stringify(r));
  const L1 = { ...B.mach.exc };
  // ---- bucket -> the truck's bed: Charlie parks the bed under the teeth
  const DT = { x: EX.x + 6, z: EX.z + 2, h: 0 }, bed = SIM.machAt(DT, M.DUMP_BED[0], M.DUMP_BED[1]);
  await drive(C, 'dump', D0, DT, DT.h);
  await until(() => near(B.mach.dump.x, DT.x) && near(B.mach.dump.z, DT.z), 1500);
  A.send({ t: 'exc', op: 'drop', x: bed.x + 0.4, z: bed.z - 0.3, power: 0 });
  await until(() => B.mach.dump.load > 0);
  check('tipped over the bed: the whole load goes in the truck, as rich as it was', near(B.mach.dump.load, L1.load) && near(B.mach.dump.rich, L1.rich, 2e-3) && B.mach.exc.load === 0, JSON.stringify({ exc: L1, dump: B.mach.dump }));
  // ---- a digger tips a bucket in at the tail
  const tail = SIM.machAt(DT, M.DUMP_TAIL[0], M.DUMP_TAIL[1]); B.at(tail.x, tail.z); await sleep(80);
  const d1 = B.mach.dump.load, r1 = B.mach.dump.rich; B.send({ t: 'dump', op: 'tip', v: 5, rich: 2.5 }); await until(() => B.mach.dump.load > d1 + 1);
  const mix = (d1 * r1 + 5 * 2.5) / (d1 + 5);
  check('a digger at the tail tips 5 holes in, mixed in by volume', near(B.mach.dump.load, d1 + 5) && near(B.mach.dump.rich, mix, 2e-3), `${B.mach.dump.load} x${B.mach.dump.rich} (want x${mix.toFixed(3)})`);
  B.at(tail.x + 30, tail.z); await sleep(80); B.send({ t: 'dump', op: 'tip', v: 5, rich: 2.5 }); await sleep(200);
  check('...but not from 30 m away', near(B.mach.dump.load, d1 + 5));
  // ---- unloading: only near the sifter; it pays the unloader the whole load at its richness
  const L2 = { load: B.mach.dump.load, rich: B.mach.dump.rich };
  C.send({ t: 'dump', op: 'unload' }); await sleep(200); check('no unloading out on the lake', C.pay.length === 0 && near(B.mach.dump.load, L2.load));
  const G = SIM.GOLD.SIFTER; await drive(C, 'dump', DT, { x: G.x + 15, z: G.z }, -Math.PI / 2);
  await until(() => Math.hypot(B.mach.dump.x - (G.x + 15), B.mach.dump.z - G.z) < 1.5, 1500);
  const tip0 = B.mach.dump.tip; C.send({ t: 'dump', op: 'unload' }); const pay = await until(() => C.pay[0]);
  check('at the sifter: the driver gets the whole load at its richness, the bed tips and is empty', pay && near(pay.holes, L2.load) && near(pay.rich, L2.rich, 2e-3) && pay.src === 'dump' && (await until(() => B.mach.dump.load === 0)) && B.mach.dump.tip === tip0 + 1, JSON.stringify(pay));
  // ---- bucket -> a pile on the ground (a flick throws it along the arm)
  await sleep(M.EXC_COOLDOWN * 1000); r = await scoop(T1.x + 0.4, T1.z - 1.1); const L3 = { ...B.mach.exc };
  check('one more scoop', r && r.ok && L3.load > 0.3, JSON.stringify(r));
  const n0 = B.piles.size, Tp = { x: EX.x + 6, z: EX.z - 3 }; A.send({ t: 'exc', op: 'drop', x: Tp.x, z: Tp.z, power: 0.5 });
  const pile = await until(() => B.piles.size > n0 && [...B.piles.values()].find(q => q.pay > 0 && Math.abs(q.x - (Tp.x + M.EXC_FLING * 0.5)) < 0.2));
  check('tipped over open ground: a pile with the same sand and richness, flung 3 m along the arm', pile && near(pile.sand, L3.load) && near(pile.pay, L3.rich, 2e-3) && near(pile.z, Tp.z, 0.05) && B.mach.exc.load === 0, JSON.stringify({ pile, L3 }));
  C.send({ t: 'pileTake', id: pile.id, v: 0.5 }); const p2 = await until(() => { const q = B.piles.get(pile.id); return q && q.sand < pile.sand - 0.4 && q; });
  check('a digger scooping it: the pile shrinks and still says how rich it is', p2 && near(p2.sand, pile.sand - 0.5) && near(p2.pay, pile.pay), JSON.stringify(p2));
  // ---- nobody driving: they stay put
  A.send({ t: 'exc', op: 'out' }); C.send({ t: 'dump', op: 'out' }); await until(() => B.mach.exc.drv == null && B.mach.dump.drv == null);
  const s0 = JSON.stringify(B.mach); B.msgs.length = 0; A.send({ t: 'exc', op: 'pos', x: 0, z: 0, h: 0 }); await sleep(800);
  check('out of the seats: no position from anyone moves them, nothing is sent', JSON.stringify(B.mach) === s0 && !B.msgs.some(m => m.t === 'mpos'));
  for (const c of [A, B, C]) c.ws.close();
} catch (e) { check('exception ' + e.message, false); }
srv.kill(); console.log(fails ? `MACHINES FAILED (${fails})` : 'MACHINES PASSED'); process.exit(fails ? 1 : 0);
