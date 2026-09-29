/* Event director: one place that decides which natural hazard (twister, landslide, and future ones) happens,
   where, and when, on a shared budget -- instead of each hazard rolling its own independent dice, which can stack
   three disasters on one camper at once. Dual-export like sim.js: required directly by server.js (the server is
   the authority when online -- it steps this and relays decisions through the existing 'env' message so every
   camper gets the same spawn), and loaded by the page so solo/offline play can run the identical logic locally
   and call spawnEnv() itself (see stepSoloDirector() in 82-patrol.js).
   Unlike twPlan()/lsPlan() in the client hazard files (pure functions of shared time + seed, replayed by every
   peer), this is STATEFUL like sim.js's stepMonsters(): one place (the server, or the solo client) owns a
   director state object and steps it forward, handing out decisions as they're made. That's fine here because
   there's exactly one authority per session (the server online, the local page solo) instead of many independent
   peers that all have to agree without talking. */
(function (root) {
  const SIM = (typeof module === 'object' && module.exports) ? require('./sim.js') : root.SIM;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const r1 = v => Math.round(v * 10) / 10;
  const r2 = v => Math.round(v * 1000) / 1000;

  /* ---- tuning knobs (all named, all one-line-commented so a designer can tune the lake's mood here) ---- */
  const DIR_ROLL_MS = 20000;        // how often (ms of real/server time) the director considers rolling a new event
  const DIR_ROLL_JITTER = 8000;     // +/- random jitter on that interval, so rolls don't feel metronomic
  const DIR_BASE_CHANCE = 0.35;     // chance an eligible roll actually produces an event, before intensity scaling
  const DIR_MIN_GAP_MS = 75000;     // minimum real time between ANY two natural events, whatever their kind
  const DIR_MAJOR_RADIUS = 220;     // metres: no two active MAJOR events may both be within this of one camper
  const DIR_TARGET_TRIES = 8;       // attempts to find a legal (off-camp, in-bounds) spawn ring point per roll
  const DIR_DAY_RAMP = 0.05;        // +5% intensity per day number -- the lake gets busier the longer the run goes
  const DIR_CREW_RAMP = 0.12;       // +12% intensity per camper beyond the first -- a fuller camp sees more events
  const DIR_INTENSITY_CAP = 2.5;    // intensity multiplier never climbs past this (keeps late game from flooding)
  const DIR_INTENSITY_FLOOR = 0.4;  // ...or drops below this (there's always SOME chance, even on day 1 solo)
  const DIR_DUSK_MS = 60000;        // last this-many ms of the day (before SIM.DAYMS) count as "dusk" for `times`

  /* ---- the registry: one entry per event kind. `mode` says how the server should realize a decision:
     'env'     -- broadcast through the existing env relay; every client's ENV[kind].spawn(o) builds it locally
                  (exactly how twister/landslide already work). Wire in a new kind by adding its ENV entry
                  (public/js/76-console.js) and flipping `enabled` to true here.
     'monster' -- not an env spawn: a living, chasing thing (javelina herd, mountain lion) that the SERVER has to
                  start and step every tick, the way it already does for police trucks / Madame Zeroni in
                  sim.js's stepMonsters(). The director only decides WHERE and WHEN one should start; a future
                  branch adding these needs to add that server-side start/step logic and read `mode==='monster'`
                  decisions in server.js's tick handler (marked with a TODO there) instead of broadcasting 'env'.
     `supportsLateJoin: false` means a camper who joins mid-event won't see it appear (see activeEvents() below);
     that's the case for twister today because addTwister() always seeds t0 = "now", so replaying an in-progress
     one from a stored start time would draw it in the wrong place. Landslide already takes an explicit t0
     (spawnLandslide(x,z,seed,t0)), so it replays correctly for late joiners. */
  const REGISTRY = {
    twister: {
      weight: 3, major: true, cooldownMs: 60000, minDay: 1, times: ['day', 'dusk'],
      ringMin: 35, ringMax: 90, lifeMs: 75000, mode: 'env', enabled: true, supportsLateJoin: false,
    },
    landslide: {
      weight: 2, major: true, cooldownMs: 90000, minDay: 1, times: ['day', 'dusk'],
      ringMin: 40, ringMax: 110, lifeMs: 45000, mode: 'env', enabled: true, supportsLateJoin: true,   // lifeMs: the 9 s rock rain plus long rolls (74-landslide.js)
    },
    /* -- the other events. Each one's own natural schedule (tbPlan, sinkPlan, the haboob's hbPlan, the javelinas'
       random roll, the lion's pre-curfew window) steps aside while DIRECTOR_ON / the server's director is on, so
       these entries are the only natural source; `director off` hands scheduling back to those old schedules.
       'monster' kinds are started server-side by dirStartMonster() in server.js (solo: stepSoloDirector). -- */
    tumbleweed: { // giant tumbleweed: minor, frequent, harmless-ish knockdown -- like a gentler twister
      weight: 2, major: false, cooldownMs: 40000, minDay: 1, times: ['day', 'dusk'],
      ringMin: 50, ringMax: 140, lifeMs: 152000, mode: 'env', enabled: true, supportsLateJoin: true, // lifeMs: TB_LIFE 150 s + fade (75-tumbleweed.js), so late joiners still see the gust
    },
    sinkhole: { // opens a big crater that stays open ~3.5 min, then fills back in
      weight: 1, major: true, cooldownMs: 120000, minDay: 2, times: ['day', 'dusk'],
      ringMin: 20, ringMax: 70, lifeMs: 225000, mode: 'env', enabled: true, supportsLateJoin: true, // ~5 s warn + 1.6 s open + 210 s open + 6 s fill (87-sinkhole.js); spawnSinkhole takes a t0, so late joiners replay it
    },
    javelinas: { // a ~30-strong herd that charges -- server-side monster, not a client env spawn
      weight: 1, major: true, cooldownMs: 150000, minDay: 3, times: ['day', 'dusk'],
      ringMin: 30, ringMax: 80, lifeMs: 60000, mode: 'monster', enabled: true, supportsLateJoin: false,
    },
    lion: { // a lone stalking mountain lion -- server-side monster, prowls dusk/night
      weight: 1, major: true, cooldownMs: 180000, minDay: 4, times: ['day', 'dusk'],
      ringMin: 40, ringMax: 100, lifeMs: 90000, mode: 'monster', enabled: true, supportsLateJoin: false,
    },
    haboob: { // map-crossing dust storm -- NOT placed near one camper (placement:'mapwide', see mapWidePlace()
      // below): it spawns off a random edge of the lake and crosses toward the middle, and while it's up it
      // counts as a major event for EVERY camper everywhere, not just within DIR_MAJOR_RADIUS of a point (see
      // the `e.mapWide` check in canMajorAffect()). Rare on purpose: the longest cooldown of any kind.
      weight: 1, major: true, mapWide: true, placement: 'mapwide', cooldownMs: 3 * SIM.CYCLE, minDay: 4, times: ['day'],
      lifeMs: 130000, mode: 'env', enabled: true, supportsLateJoin: false, // flip supportsLateJoin true once its ENV spawn takes an explicit t0, like spawnLandslide's
    },
    /* vultures aren't here: they're triggered by a camper's own health dropping low, not rolled on a schedule.
       Whatever adds them should still respect the shared "one major per camper" budget before swooping in --
       call canMajorAffect(state, x, z, now) below to check, so a vulture doesn't pile onto someone already mid-twister. */
  };
  for (const k in REGISTRY) REGISTRY[k].key = k; // stamp each entry with its own name, so a picked cfg still knows its kind string

  function phaseOf(clockT) {
    if (clockT >= SIM.DAYMS) return 'night';
    if (clockT >= SIM.DAYMS - DIR_DUSK_MS) return 'dusk';
    return 'day';
  }
  function computeIntensity(day, crew) {
    return clamp(1 + Math.max(0, day - 1) * DIR_DAY_RAMP + Math.max(0, crew - 1) * DIR_CREW_RAMP, DIR_INTENSITY_FLOOR, DIR_INTENSITY_CAP);
  }
  // Fisher-Yates over [0..n), so target-picking doesn't always try the same camper first.
  function shuffledIndices(n, rand) {
    const a = []; for (let i = 0; i < n; i++) a.push(i);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // true if no active MAJOR event is already within DIR_MAJOR_RADIUS of (x,z) -- the "one major per camper" rule.
  // A map-wide major (haboob) counts everywhere, not just within the radius, since it's meant to be a major
  // event for every camper on the lake at once while it's up. Exported for future hazards (e.g. health-triggered
  // vultures) that aren't rolled by step() but should still respect the same no-pile-on budget.
  function canMajorAffect(state, x, z, now) {
    return !(state.active || []).some(e => e.expiresAt > now && e.major && (e.mapWide || Math.hypot(e.x - x, e.z - z) < DIR_MAJOR_RADIUS));
  }
  // Placement for a 'mapwide' kind: starts off a random point near the edge of the lake and heads toward
  // (aimX,aimZ) with some spread -- a natural roll aims through the map's middle (not at any one camper, on
  // purpose: it's not "near a camper" the way ring events are); a forced 'event' command aims at the host so
  // testing it actually shows it to them. Same {x,z,a} heading convention as tryPlace().
  function mapWidePlace(aimX, aimZ, rand) {
    const edge = SIM.EDGE - 5, ang = rand() * Math.PI * 2;
    const x = Math.cos(ang) * edge, z = Math.sin(ang) * edge;
    return { x, z, a: Math.atan2(aimZ - z, aimX - x) + (rand() * 2 - 1) * 0.4 };
  }
  // Ring placement around a point: random angle/distance within the kind's ring, retried a few times to dodge
  // the camp fence zone and the edge of the lake. Returns {x,z,a} (a = heading back toward the point, same
  // convention twister/spawnAhead already use: atan2(dz,dx)) or null if nothing legal turned up.
  function tryPlace(cfg, x0, z0, rand) {
    for (let i = 0; i < DIR_TARGET_TRIES; i++) {
      const a = rand() * Math.PI * 2, dist = cfg.ringMin + rand() * (cfg.ringMax - cfg.ringMin);
      const x = clamp(x0 + Math.sin(a) * dist, -SIM.EDGE + 10, SIM.EDGE - 10);
      const z = clamp(z0 + Math.cos(a) * dist, -SIM.EDGE + 10, SIM.EDGE - 10);
      if (SIM.nearCampZone(x, z)) continue;
      return { x, z, a: Math.atan2(z0 - z, x0 - x) };
    }
    return null;
  }

  function createState() { return { enabled: true, active: [], cooldowns: {}, nextRollAt: null, lastGlobalAt: 0, nextId: 1 }; }
  function setEnabled(state, on) { state.enabled = !!on; }

  /* One tick of the director. ctx: {now (ms, any monotonic-ish shared clock -- Date.now() on the server), day
     (world.run.day), clockT (ms into the shared day/night cycle, for `times`), players ([{id,x,z,inCamp,down}]),
     rand (optional () => [0,1) RNG; defaults to Math.random -- tests pass a seeded one for determinism)}.
     Returns an array (0 or 1 entries in practice, since DIR_MIN_GAP_MS is normally well over DIR_ROLL_MS) of
     decisions: {id,kind,x,z,a,major,mode,targetId,start}. */
  // per-map hazard weights (88-zones.js): multiply each kind's weight in that map; missing = 1, 0 = never there
  const ZONE_WEIGHTS = {
    lake: {},
    canyon: { landslide: 2.5, twister: 0.3, haboob: 0.5, tumbleweed: 0.4, sinkhole: 0, javelinas: 0.6, lion: 1.5 },
  };
  function step(state, ctx) {
    const now = ctx.now, rand = ctx.rand || Math.random;
    state.active = (state.active || []).filter(e => e.expiresAt > now); // drop expired before budget checks below
    if (state.nextRollAt == null) state.nextRollAt = now + DIR_ROLL_MS;
    if (!state.enabled) return [];
    if (now < state.nextRollAt) return [];
    const day = ctx.day || 1, players = ctx.players || [], crew = Math.max(1, players.length);
    const intensity = computeIntensity(day, crew);
    state.nextRollAt = now + Math.max(4000, DIR_ROLL_MS / intensity + (rand() * 2 - 1) * DIR_ROLL_JITTER);
    if (now - state.lastGlobalAt < DIR_MIN_GAP_MS) return []; // global cooldown: never two natural events too close together
    if (rand() > Math.min(0.9, DIR_BASE_CHANCE * intensity)) return []; // the roll itself
    const phase = phaseOf(ctx.clockT || 0);
    const eligible = [];
    for (const k in REGISTRY) { const cfg = REGISTRY[k]; if (cfg.enabled && day >= cfg.minDay && cfg.times.includes(phase) && now >= (state.cooldowns[k] || 0)) eligible.push(cfg); }
    if (!eligible.length) return [];
    const outs = players.filter(p => !p.inCamp && !p.down);
    const zw = ZONE_WEIGHTS[ctx.zone || 'lake'] || {}, wOf = cfg => cfg.weight * (zw[cfg.key] != null ? zw[cfg.key] : 1);
    let total = 0; for (const cfg of eligible) total += wOf(cfg);
    if (total <= 0) return [];
    let roll = rand() * total, chosen = eligible[eligible.length - 1];
    for (const cfg of eligible) { const w = wOf(cfg); if (w <= 0) continue; roll -= w; if (roll <= 0) { chosen = cfg; break; } }
    let placed = null, targetId = null;
    if (!outs.length) return []; // nobody out on the lake: nothing to put near anyone, and a storm nobody's out in is wasted
    if (chosen.placement === 'mapwide') {
      // not "near a camper" -- it crosses the whole lake, so skip the outs/ring logic below entirely. It can only
      // start while no OTHER major is running anywhere (it's about to become a major for everyone at once).
      if (chosen.major && (state.active || []).some(e => e.expiresAt > now && e.major)) return [];
      placed = mapWidePlace(0, 0, rand); // aimed through the map's middle, not at any one player
    } else {
      for (const idx of shuffledIndices(outs.length, rand)) {
        const p = outs[idx];
        if (chosen.major && !canMajorAffect(state, p.x, p.z, now)) continue; // budget: don't pile a second major on them
        const spot = tryPlace(chosen, p.x, p.z, rand);
        if (spot) { placed = spot; targetId = p.id; break; }
      }
    }
    if (!placed) return []; // every out-of-camp camper already has a major nearby, or no legal spot -- try again next roll
    const id = state.nextId++;
    state.active.push({ id, kind: chosen.key, x: placed.x, z: placed.z, major: chosen.major, mapWide: !!chosen.mapWide, startAt: now, expiresAt: now + chosen.lifeMs, t0: ctx.hazardNow != null ? ctx.hazardNow : now, supportsLateJoin: chosen.supportsLateJoin !== false });
    state.cooldowns[chosen.key] = now + chosen.cooldownMs;
    state.lastGlobalAt = now;
    return [{ id, kind: chosen.key, x: r1(placed.x), z: r1(placed.z), a: r2(placed.a), major: chosen.major, mode: chosen.mode, targetId, start: now }];
  }

  /* Host "event <kind>" console command: place one of `kind` near (ctx.x, ctx.z) right now, bypassing the
     weight pick / base chance / global gap (it's a deliberate ask, not a natural roll) but still respecting the
     kind's own enabled flag and dodging the camp fence zone. Still sets the kind's cooldown and the global gap
     timer, so spamming the command can't be used to defeat the budget for the natural rolls that follow it. */
  function forceEvent(state, kind, ctx) {
    const cfg = REGISTRY[kind];
    if (!cfg || !cfg.enabled) return null;
    const rand = ctx.rand || Math.random, now = ctx.now;
    const spot = cfg.placement === 'mapwide' ? mapWidePlace(ctx.x, ctx.z, rand) : tryPlace(cfg, ctx.x, ctx.z, rand);
    if (!spot) return null;
    const id = state.nextId++;
    state.active = (state.active || []).filter(e => e.expiresAt > now);
    state.active.push({ id, kind: cfg.key, x: spot.x, z: spot.z, major: cfg.major, mapWide: !!cfg.mapWide, startAt: now, expiresAt: now + cfg.lifeMs, t0: ctx.hazardNow != null ? ctx.hazardNow : now, supportsLateJoin: cfg.supportsLateJoin !== false });
    state.cooldowns[cfg.key] = now + cfg.cooldownMs;
    state.lastGlobalAt = now;
    return { id, kind: cfg.key, x: r1(spot.x), z: r1(spot.z), a: r2(spot.a), major: cfg.major, mode: cfg.mode, forced: true, start: now };
  }

  // For a (re)connecting client's 'hello': events still running whose kind can be replayed from a start time.
  function activeEvents(state, now) {
    return (state.active || []).filter(e => e.expiresAt > now && e.supportsLateJoin).map(e => ({ kind: e.kind, x: r1(e.x), z: r1(e.z), t0: e.t0 }));
  }

  // Compact status snapshot for the host "events" command / the periodic 'dirinfo' broadcast.
  function describe(state, now, day, crew) {
    const cooldowns = {}; for (const k in (state.cooldowns || {})) cooldowns[k] = Math.max(0, Math.round((state.cooldowns[k] - now) / 1000));
    return {
      on: !!state.enabled,
      nextIn: Math.max(0, Math.round(((state.nextRollAt || now) - now) / 1000)),
      intensity: +computeIntensity(day || 1, crew || 1).toFixed(2),
      cooldowns,
      active: (state.active || []).filter(e => e.expiresAt > now).map(e => ({ k: e.kind, x: r1(e.x), z: r1(e.z), age: Math.max(0, Math.round((now - e.startAt) / 1000)) })),
    };
  }

  const DIRECTOR = { REGISTRY, createState, setEnabled, step, forceEvent, activeEvents, describe, computeIntensity, canMajorAffect };
  if (typeof module === 'object' && module.exports) module.exports = DIRECTOR; else root.DIRECTOR = DIRECTOR;
})(this);

/* These live OUTSIDE the module IIFE above, on purpose: unlike SIM's internals (hidden behind root.SIM),
   72-twisters.js and 74-landslide.js need a plain global they can check with a single `if(!DIRECTOR_ON)` guard
   in front of their existing natural-schedule loop, and 82-patrol.js/76-console.js need somewhere to keep the
   solo/offline director's state between frames. All harmless as ordinary module-local vars under Node
   (server.js drives its OWN director state through the exported DIRECTOR API instead of these). */
let DIRECTOR_ON = true;   // gate: true = the director (server, or solo below) owns natural events; false = the
                           // old independent twPlan/lsPlan schedules run instead (see the "director off" command)
let soloDirState = null;  // lazily-created director state for solo/offline play; mirrors what the server keeps
// The haboob branch's own natural map-crossing-storm schedule (once it has one, the way twPlan/lsPlan already do
// for twister/landslide) should sit behind this flag exactly like DIRECTOR_ON gates those: `if(!HABOOB_NATURAL)`
// in front of that schedule's loop. Separate from DIRECTOR_ON because haboob's placement (a random edge point
// crossing toward the middle) doesn't fit the per-cell twPlan/lsPlan shape those two already gate.
let HABOOB_NATURAL = true;
