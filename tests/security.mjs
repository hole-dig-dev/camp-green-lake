import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SIM = require('../public/sim.js');
const policeTime = SIM.DAYMS + 1000;
const zeroniTime = SIM.NIGHT_SPLIT + 1000;
const camper = (x, z, hd = false) => ({ id: 1, x, z, fa: 0, cr: false, hd, dn: false, nz: 0 });

function policeAt(x, z, h = 0) {
  return { trucks: [{ x, z, h, mode: 'patrol', lost: 0, tx: x, tz: z - 30, tgt: null }], zer: null };
}

test('tower spotting follows the rendered sweep, range, and hole cover', () => {
  const tower = SIM.TOWERS[0], h = SIM.towerHeading(0, policeTime);
  const on = camper(tower.x + Math.sin(h) * 25, tower.z + Math.cos(h) * 25);
  const off = camper(tower.x + Math.sin(h + SIM.TOWER_HALF_ANGLE + 0.1) * 25,
    tower.z + Math.cos(h + SIM.TOWER_HALF_ANGLE + 0.1) * 25);
  assert.equal(SIM.towerSees(on, policeTime), true);
  assert.equal(SIM.towerSees(off, policeTime), false);
  assert.equal(SIM.towerSees({ ...on, hd: true }, policeTime), false);
});

test('a police officer cannot catch a camper behind their flashlight, even at touching distance', () => {
  const behind = camper(0, -98), M = policeAt(0, -99), ev = [];
  SIM.stepMonsters(M, [behind], policeTime, 0, ev);
  assert.deepEqual(ev, []);
  const lit = camper(0, -100), N = policeAt(0, -99), spotted = [];
  SIM.stepMonsters(N, [lit], policeTime, 0, spotted);
  assert.ok(spotted.some(e => e.k === 'spot' && e.id === lit.id));
  assert.ok(spotted.some(e => e.k === 'down' && e.id === lit.id));
  const hidden = [];
  SIM.stepMonsters(policeAt(0, -99), [camper(0, -100, true)], policeTime, 0, hidden);
  assert.deepEqual(hidden, []);
});

test('Zeroni hunts a camper out on the lake whether or not a searchlight is on them', () => {
  // The searchlights are a police mechanic only; Madame Zeroni ignores light and goes after whoever is out there.
  const M = { trucks: [], zer: { x: 0, z: -95, tgt: null, blink: 10, talk: 10, drag: null } }, ev = [];
  SIM.stepMonsters(M, [camper(0, -100)], zeroniTime, 0.1, ev);
  assert.equal(M.zer.tgt, 1);
});
