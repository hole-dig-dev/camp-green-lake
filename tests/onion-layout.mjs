// Onion Mountain's layout (public/sim.js ONION.layout): for 200 seeds, the mountain can always be climbed by a camper
// on their own, with the same numbers the game uses (SIM.CLIMB is what 88-climb.js reads). "Difficult but possible"
// (Greg): a failing seed means a crew could be stuck for a whole run, so this blocks the push. Run: node tests/onion-layout.mjs
import { createRequire } from 'module';
const SIM = createRequire(import.meta.url)('../public/sim.js');
const O = SIM.ONION, C = SIM.CLIMB, bad = [];
const deg = a => a * 180 / Math.PI, gap = (a, b) => Math.abs(deg(Math.atan2(Math.sin(a - b), Math.cos(a - b))));
// the shape itself (every layout shares it)
for (let k = 1; k <= 6; k++) {
  const rise = O.H[k] - O.H[k - 1], ringW = k < 6 ? O.R[k - 1] - O.R[k] : O.R[5];
  if (rise > O.FALL_MAX) bad.push(`wall ${k}: a fall down it is ${rise} m, more than ${O.FALL_MAX}`);
  if (ringW < O.RAMP_L + 4) bad.push(`ring ${k}: ${ringW} m wide, too narrow for a ramp and a path past it`);
  if (O.SECT_W > 2 * Math.PI * O.R[k - 1] / 6) bad.push(`wall ${k}: its section takes up too much of the wall`);
}
if (O.RIM < O.R[0] + 40) bad.push('the basin rim is too close to the onion');
for (let seed = 0; seed < 200; seed++) {
  const L = O.layout(seed * 7919 + 13), S = L.sec, tag = `seed ${seed}`;
  if (S.length !== 7 || S[1].kind !== 'roots' || S[6].kind !== 'peel') bad.push(`${tag}: the Roots must be first and the Peel Gate last`);
  if ([...S.slice(2, 6).map(s => s.kind)].sort().join() !== [...O.MIDDLE].sort().join()) bad.push(`${tag}: the middle four aren't one of each`);
  if (!O.TWISTS.some(t => t[0] === L.twist)) bad.push(`${tag}: unknown twist ${L.twist}`);
  for (let k = 1; k <= 6; k++) {
    const s = S[k], rise = O.H[k] - O.H[k - 1];
    if (k > 1 && gap(s.a, S[k - 1].a) < 120)   // right above the last one, a layer would be no walk at all
      bad.push(`${tag}: section ${k} is only ${gap(s.a, S[k - 1].a).toFixed(0)} degrees from the one below`);
    if (s.ramp) { if (rise / O.RAMP_L > C.rampMax) bad.push(`${tag}: wall ${k}'s ramp is too steep to walk (${(rise / O.RAMP_L).toFixed(2)})`); }
    else {
      // solo, healthy: jump, catch the wall, climb the rest. Keep a margin so a hurt camper (stamina capped by health) still can.
      const cost = C.min + Math.max(0, rise - C.jump) / C.up * C.move;
      if (cost > C.stam * C.margin) bad.push(`${tag}: wall ${k} costs ${cost.toFixed(0)} stamina to climb, over ${C.stam * C.margin}`);
    }
  }
}
if (bad.length) { console.error(`FAIL onion layout: ${bad.length} problems\n  ` + bad.slice(0, 20).join('\n  ')); process.exit(1); }
console.log('PASS onion layout: 200 seeds, every wall climbable on one stamina bar, every fall one ring at most');
