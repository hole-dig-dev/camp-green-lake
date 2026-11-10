#!/usr/bin/env node
// scripts/balance-sim.mjs -- a rough day-by-day model of a SOLO camper's gold against the Warden's quota.
// Not the game: a spreadsheet in code, using the real numbers from public/sim.js (payMult, siftGold, quotaFor) and
// the shop prices, to see whether progression has an arc: can a new player make day 1, when do upgrades land,
// when does the quota start to bite. Run: node scripts/balance-sim.mjs [ground]   ground = creek | streak | poor
import { createRequire } from 'node:module';
const SIM = createRequire(import.meta.url)('../public/sim.js');
const DAY = SIM.DAYMS / 1000, SCOOP = 0.42, RUN_MPS = 5.2, WALK_MPS = 3.4;
const ground = process.argv[2] || 'creek';
// how rich the sand is, and how far the walk back to camp is, for three kinds of player
const G = { creek: { mult: d => SIM.payMult(0, SIM.PAY.creek.z, d), dist: 34.6 - SIM.PAY.creek.z }, poor: { mult: d => SIM.PAY.barren * (d > 1.5 ? 1.5 : d >= 1.5 ? 1 : 0.8), dist: 140 },
  streak: { mult: d => SIM.payMult(...bestSpot(), d), dist: 260 } }[ground];
function bestSpot() { let b = [0, -78], bm = 0; for (let x = -400; x <= 400; x += 10) for (let z = -500; z <= -60; z += 10) { const m = SIM.richAt(x, z); if (m > bm) { bm = m; b = [x, z]; } } return b; }
const S = { gold: 0, shovel: false, spade: false, long: false, bucket: 0, hopper: false, rec: 0.75, scale: 1 };
const BUY = [ // [cost, name, condition, effect] in the order a sensible player buys
  [25, 'camp shovel', s => !s.shovel, s => { s.shovel = true; }], [45, 'bucket (5)', s => s.bucket < 5, s => { s.bucket = 5; }],
  [45, 'sharpened spade', s => !s.spade, s => { s.spade = true; }], [60, 'big bucket (10)', s => s.bucket < 10, s => { s.bucket = 10; }],
  [150, 'gold scale', s => s.scale === 1, s => { s.scale = 1.1; }], [110, 'long shovel', s => !s.long, s => { s.long = true; }],
  [140, 'huge bucket (15)', s => s.bucket < 15, s => { s.bucket = 15; }], [600, 'rocker box', s => s.rec < 0.88, s => { s.rec = 0.88; }],
  [2200, 'long tom & sluice', s => s.rec < 1, s => { s.rec = 1; }], [6500, 'wash plant', s => s.rec < 1.18, s => { s.rec = 1.18; }]];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
console.log(`ground: ${ground}   (x${G.mult(1.5).toFixed(2)} at 5 ft, ${G.dist} m from camp)\nday  quota  earned  wallet-after  bought`);
for (let day = 1; day <= 20; day++) {
  const quota = SIM.quotaFor(day, 1), got = []; let t = DAY * 0.85, earned = 0;                             // 15% of the day lost to water, hazards, the store
  for (;;) {
    const depth = !S.shovel ? SIM.HANDS.depth : S.long ? 2.6 : 1.5, step = !S.shovel ? SIM.HANDS.scoop : S.spade ? 0.15 : 0.088;
    const cap = S.bucket || SIM.PAN, holeSand = depth / 1.5, holeSecs = depth / step * SCOOP + 4;        // +4 s to step to fresh ground
    const trip = cap / holeSand * holeSecs + 2 * G.dist / (RUN_MPS * 0.6 + WALK_MPS * 0.4) + 12;           // dig, run back, wash or sift
    if (t < trip) break; t -= trip;
    const g = SIM.siftGold(cap, rnd, SIM.GOLD.perHole * G.mult(depth) * S.rec * S.scale, 1).gold; earned += g; S.gold += g;
    // back in camp: buy the next thing only if tonight's quota is still covered afterwards (day 1 is a grace day)
    for (const [c, n, need, eff] of BUY) { if (!need(S)) continue; const owe = day === 1 ? 0 : quota; if (S.gold - c >= owe) { S.gold -= c; eff(S); got.push(n); } break; }
  }
  const paid = day === 1 || S.gold >= quota; if (day > 1) S.gold -= Math.min(S.gold, quota);
  console.log(`${String(day).padStart(3)}  ${String(quota).padStart(5)}  ${String(earned).padStart(6)}  ${String(Math.round(S.gold)).padStart(12)}  ${paid ? '' : 'FIRED  '}${got.join(', ')}`);
  if (!paid) break;
}
