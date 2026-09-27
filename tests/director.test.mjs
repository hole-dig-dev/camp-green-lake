#!/usr/bin/env node
// tests/director.test.mjs
//
// Plain-Node unit tests for the event director (public/director.js): budget rules (no two majors near one
// camper, a minimum gap between any two natural events, per-kind cooldowns), gating (nothing in camp, nothing
// outside its allowed time of day, nothing before its min day), intensity ramping with day number and crew size,
// and determinism given the same seeded RNG. Not wired into `npm test` -- run it directly:
//   node tests/director.test.mjs

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DIRECTOR = require(path.join(__dirname, '..', 'public', 'director.js'));
const SIM = require(path.join(__dirname, '..', 'public', 'sim.js'));

// Same generator the game itself uses (public/js/10-core.js) -- deterministic, no external dependency.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`ok - ${name}`); }
  catch (e) { fail++; console.error(`FAIL - ${name}\n    ${e.message}`); }
}

// Runs the director for `hours` of simulated game time, one 1s step at a time, with `players` (a fixed list of
// {id,x,z} out on the lake, never in camp/downed) and a fresh seeded RNG. Returns {state, events} where events
// carries every decision plus the `now` it fired at.
function simulate(seed, hours, players, day = 1) {
  const rand = mulberry32(seed);
  const state = DIRECTOR.createState();
  const events = [];
  const stepMs = 1000;
  const steps = Math.round((hours * 3600000) / stepMs);
  for (let i = 0; i < steps; i++) {
    const now = i * stepMs;
    const clockT = now % SIM.CYCLE;
    const decisions = DIRECTOR.step(state, { now, day, clockT, players, rand });
    for (const d of decisions) events.push(Object.assign({ now, clockT }, d));
  }
  return { state, events };
}

const FAR_PLAYERS = [
  { id: 'a', x: 100, z: 100, inCamp: false, down: false },
  { id: 'b', x: -300, z: -350, inCamp: false, down: false }, // far enough apart that both can hold a major independently
];

test('produces events over a long run', () => {
  const { events } = simulate(1, 24, FAR_PLAYERS, 5);
  assert.ok(events.length > 5, `expected several events over 24h, got ${events.length}`);
});

test('minimum global gap between any two natural events holds', () => {
  const { events } = simulate(2, 48, FAR_PLAYERS, 8);
  assert.ok(events.length > 10, 'need enough events to test the gap meaningfully');
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].now - events[i - 1].now;
    assert.ok(gap >= 75000, `events ${i - 1}->${i} only ${gap}ms apart, expected >= 75000ms (DIR_MIN_GAP_MS)`);
  }
});

test('per-kind cooldown holds: the same kind never re-fires inside its own cooldown', () => {
  const { events } = simulate(3, 72, FAR_PLAYERS, 10);
  const cooldownMs = { twister: 60000, landslide: 90000 };
  const lastByKind = {};
  for (const e of events) {
    if (lastByKind[e.kind] != null) {
      const gap = e.now - lastByKind[e.kind];
      assert.ok(gap >= cooldownMs[e.kind], `${e.kind} re-fired after only ${gap}ms, expected >= ${cooldownMs[e.kind]}ms`);
    }
    lastByKind[e.kind] = e.now;
  }
});

test('no two active MAJOR events both sit within DIR_MAJOR_RADIUS of the same camper', () => {
  // pack several players close together on purpose, so the budget rule is the only thing stopping a pile-up
  const players = [
    { id: 'a', x: 0, z: 200, inCamp: false, down: false },
    { id: 'b', x: 20, z: 220, inCamp: false, down: false },
    { id: 'c', x: -30, z: 180, inCamp: false, down: false },
  ];
  const { events } = simulate(4, 96, players, 15);
  const MAJOR_RADIUS = 220;
  const active = []; // {x,z,expiresAt}
  for (const e of events) {
    // drop expired (use each kind's known lifeMs)
    const lifeMs = e.kind === 'twister' ? 75000 : 32000;
    for (let i = active.length - 1; i >= 0; i--) if (active[i].expiresAt <= e.now) active.splice(i, 1);
    if (e.major) {
      for (const a of active) {
        const d = Math.hypot(a.x - e.x, a.z - e.z);
        assert.ok(d >= MAJOR_RADIUS, `major ${e.kind} at (${e.x},${e.z}) landed only ${d.toFixed(1)}m from another active major (radius ${MAJOR_RADIUS}m)`);
      }
      active.push({ x: e.x, z: e.z, expiresAt: e.now + lifeMs });
    }
  }
  assert.ok(events.length > 5, 'need enough events for this check to mean anything');
});

test('nothing spawns inside the camp fence zone', () => {
  const { events } = simulate(5, 48, FAR_PLAYERS, 8);
  for (const e of events) assert.ok(!SIM.nearCampZone(e.x, e.z), `${e.kind} spawned at (${e.x},${e.z}), inside the camp fence zone`);
  assert.ok(events.length > 5, 'need enough events for this check to mean anything');
});

test('nothing spawns at night (only day/dusk are allowed for the seeded kinds)', () => {
  const { events } = simulate(6, 72, FAR_PLAYERS, 10);
  for (const e of events) assert.ok(e.clockT < SIM.DAYMS, `${e.kind} fired at clockT=${e.clockT}, which is >= SIM.DAYMS (night)`);
  assert.ok(events.length > 5, 'need enough events for this check to mean anything');
});

test('nothing spawns before a kind\'s min day', () => {
  // day 1 run: both seeded kinds (minDay 1) are legal, so this mostly guards the mechanism itself
  const { events } = simulate(7, 24, FAR_PLAYERS, 1);
  for (const e of events) {
    const cfg = DIRECTOR.REGISTRY[e.kind];
    assert.ok(1 >= cfg.minDay, `${e.kind} has minDay ${cfg.minDay}, fired on day 1`);
  }
});

test('no event ever fires with nobody out on the lake', () => {
  const inCampPlayers = [{ id: 'a', x: 0, z: 40, inCamp: true, down: false }];
  const { events } = simulate(8, 24, inCampPlayers, 10);
  assert.equal(events.length, 0, 'director fired with every player inside camp');
});

test('disabled kinds (tumbleweed/sinkhole/javelinas/lion/haboob) never fire', () => {
  const { events } = simulate(9, 96, FAR_PLAYERS, 20);
  for (const e of events) assert.ok(DIRECTOR.REGISTRY[e.kind].enabled, `${e.kind} fired but is disabled in the registry`);
});

test('intensity ramps up with day number', () => {
  const lowDay = DIRECTOR.computeIntensity(1, 1);
  const highDay = DIRECTOR.computeIntensity(30, 1);
  assert.ok(highDay > lowDay, `day 30 intensity (${highDay}) should exceed day 1 (${lowDay})`);
});

test('intensity ramps up with crew size', () => {
  const solo = DIRECTOR.computeIntensity(5, 1);
  const fullCamp = DIRECTOR.computeIntensity(5, 8);
  assert.ok(fullCamp > solo, `8-camper intensity (${fullCamp}) should exceed solo (${solo})`);
});

test('intensity is capped and floored', () => {
  assert.ok(DIRECTOR.computeIntensity(9999, 999) <= 2.5, 'intensity should never exceed DIR_INTENSITY_CAP');
  assert.ok(DIRECTOR.computeIntensity(0, 0) >= 0.4, 'intensity should never drop below DIR_INTENSITY_FLOOR');
});

test('deterministic: the same seed produces the exact same sequence of events', () => {
  const a = simulate(42, 24, FAR_PLAYERS, 6).events;
  const b = simulate(42, 24, FAR_PLAYERS, 6).events;
  assert.equal(a.length, b.length, 'two runs with the same seed produced different event counts');
  assert.deepEqual(a, b, 'two runs with the same seed produced different events');
});

test('a different seed can produce a different sequence (sanity check the seed is actually used)', () => {
  const a = simulate(1, 24, FAR_PLAYERS, 6).events;
  const b = simulate(999, 24, FAR_PLAYERS, 6).events;
  assert.notDeepEqual(a, b, 'two different seeds produced an identical sequence (suspicious)');
});

test('forceEvent places the requested kind near the given point, off-camp, and sets its cooldown', () => {
  const state = DIRECTOR.createState();
  const rand = mulberry32(11);
  const d = DIRECTOR.forceEvent(state, 'twister', { x: 150, z: 150, now: 0, rand });
  assert.ok(d, 'forceEvent returned nothing');
  assert.equal(d.kind, 'twister');
  assert.ok(!SIM.nearCampZone(d.x, d.z), 'forced event landed inside the camp fence zone');
  assert.ok(Math.hypot(d.x - 150, d.z - 150) <= 90 + 1, 'forced event landed outside its ring');
  assert.ok(state.cooldowns.twister > 0, 'forceEvent did not set the cooldown');
});

test('forceEvent refuses a disabled kind', () => {
  const state = DIRECTOR.createState();
  const d = DIRECTOR.forceEvent(state, 'sinkhole', { x: 150, z: 150, now: 0 });
  assert.equal(d, null, 'forceEvent should refuse a disabled kind');
});

// haboob is disabled by default (see REGISTRY -- no branch has wired up its ENV spawn yet); these two tests flip
// it on just for the duration of the test, same as flipping `enabled: false` -> `true` will do for real once
// that branch lands, and flip it back off after so it doesn't leak into any other test in this file.
test('haboob (forced): map-wide placement is off the edge, not a ring around the point, and counts as major everywhere', () => {
  DIRECTOR.REGISTRY.haboob.enabled = true;
  try {
    const state = DIRECTOR.createState();
    const rand = mulberry32(21);
    const d = DIRECTOR.forceEvent(state, 'haboob', { x: 0, z: 0, now: 0, rand });
    assert.ok(d, 'forceEvent returned nothing for haboob');
    assert.equal(d.kind, 'haboob');
    assert.ok(Math.hypot(d.x, d.z) > SIM.EDGE - 20, 'haboob should spawn out near the edge of the lake, not near the aim point');
    // once active, canMajorAffect must say "blocked" EVERYWHERE, not just within DIR_MAJOR_RADIUS of the storm itself
    assert.equal(DIRECTOR.canMajorAffect(state, 0, 0, 1000), false, 'haboob should block a major at the map center');
    assert.equal(DIRECTOR.canMajorAffect(state, 590, 590, 1000), false, 'haboob should block a major clear across the map too');
  } finally { DIRECTOR.REGISTRY.haboob.enabled = false; }
});

test('a natural roll never starts a second map-wide major while one is already active, or a local major while a haboob is up', () => {
  DIRECTOR.REGISTRY.haboob.enabled = true;
  try {
    const state = DIRECTOR.createState();
    state.active.push({ kind: 'haboob', x: 500, z: 500, major: true, mapWide: true, startAt: 0, expiresAt: 200000 });
    state.cooldowns.twister = 0; state.cooldowns.landslide = 0; state.enabled = true; state.nextRollAt = 0;
    const rand = mulberry32(22);
    const decisions = DIRECTOR.step(state, { now: 1000, day: 10, clockT: 0, players: FAR_PLAYERS, rand });
    for (const d of decisions) assert.ok(!d.major, `expected no new major while haboob is active, got ${d.kind}`);
  } finally { DIRECTOR.REGISTRY.haboob.enabled = false; }
});

test('canMajorAffect reflects the active list', () => {
  const state = DIRECTOR.createState();
  state.active.push({ kind: 'twister', x: 0, z: 0, major: true, startAt: 0, expiresAt: 100000 });
  assert.equal(DIRECTOR.canMajorAffect(state, 50, 0, 1000), false, 'should be blocked within DIR_MAJOR_RADIUS');
  assert.equal(DIRECTOR.canMajorAffect(state, 1000, 0, 1000), true, 'should be clear far away');
  assert.equal(DIRECTOR.canMajorAffect(state, 50, 0, 200000), true, 'should be clear once the event has expired');
});

test('activeEvents only returns kinds that support late-join replay (landslide, not twister)', () => {
  const state = DIRECTOR.createState();
  state.active.push({ kind: 'twister', x: 1, z: 1, major: true, startAt: 0, expiresAt: 100000, t0: 0, supportsLateJoin: false });
  state.active.push({ kind: 'landslide', x: 2, z: 2, major: true, startAt: 0, expiresAt: 100000, t0: 500, supportsLateJoin: true });
  const list = DIRECTOR.activeEvents(state, 1000);
  assert.equal(list.length, 1, 'expected only the landslide to be replayable');
  assert.equal(list[0].kind, 'landslide');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
