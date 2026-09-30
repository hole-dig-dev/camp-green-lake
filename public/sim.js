/* Shared rules for Camp Green Lake. The server runs these for everyone; solo play runs the same code in the page,
   so the clock, the quota, heavy loot and the monsters behave the same either way. Positions are x/z only. */
(function (root) {
  const CYCLE = 12 * 60 * 1000, DAYMS = 9.5 * 60 * 1000, NIGHT_SPLIT = DAYMS + (CYCLE - DAYMS) / 2, EDGE = 595;
  const SELL = { x: 1.4, z: 32.6, r: 6 }; // Mr. Sir's truck: bring heavy loot here
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapT = t => ((t % CYCLE) + CYCLE) % CYCLE;
  const clockT = (c, now) => (c && c.paused ? wrapT(c.pt) : wrapT(now + (c ? c.off : 0)));
  // the camp only exists on the lake: in another map (88-zones.js) there's no safe fence box (setZone below)
  let ZONE_NOW = 'lake';
  const setZone = z => { ZONE_NOW = typeof z === 'string' ? z : 'lake'; };
  const inCamp = (x, z) => ZONE_NOW === 'lake' && z > 27 && z < 56 && x > -40 && x < 30;
  const nearCampZone = (x, z) => ZONE_NOW === 'lake' && x > -46 && x < 36 && z > 12 && z < 62;
  // the Dry Canyon's floor plan: public/js/89-zone-canyon.js builds its ground from this, and the server uses it to put
  // spawning monsters on the canyon floor, not inside a wall or up on a cliff top (toFloor). Z0 south end, Z1 the campfire end.
  const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const CANYON = { Z0: 520, Z1: -525, W: [[600, 30], [430, 30], [355, 13], [300, 9], [240, 10], [190, 14], [130, 22], [0, 18], [-120, 26], [-185, 15], [-240, 34], [-600, 44]].sort((a, b) => b[0] - a[0]) };
  CANYON.x = z => 250 + 55 * Math.sin(z * 0.0065) + 18 * Math.sin(z * 0.021 + 1.3);   // the floor's centre line
  CANYON.w = z => {   // the floor's half-width
    const W = CANYON.W; let w = W[W.length - 1][1];
    for (let i = 0; i < W.length - 1; i++) { const [a, wa] = W[i], [b, wb] = W[i + 1]; if (z <= a && z >= b) { w = wa + (wb - wa) * smooth((a - z) / (a - b)); break; } }
    return w + 2.2 * Math.sin(z * 0.05);
  };
  // a spawn point in this map, moved onto open floor if it isn't (only the canyon has walls; the lake is all floor)
  const toFloor = (x, z, pad) => {
    if (ZONE_NOW !== 'canyon') return { x, z };
    z = clamp(z, CANYON.Z1 + 15, CANYON.Z0 - 5);
    const cx = CANYON.x(z), w = Math.max(2, CANYON.w(z) - (pad == null ? 2.5 : pad));
    return { x: clamp(x, cx - w, cx + w), z };
  };
  // the day's roster in maps other than the lake: camp staff stay home (Greg's Claude + JT, 2026-09-29), the rest follow the crew
  const RO_LAKE_ONLY = ['sir', 'warden'];
  const quotaFor = (day, n) => Math.round((60 + 40 * day) * (1 + 0.6 * Math.max(0, n - 1)));
  // seeds each heavy thing is worth. crate / tools / jug are carried finds (45-state.js: about 1 in 3 finds comes out as
  // one, worth more than it would in the sack): their value is set when dug up, and these are only the caps
  const HEAVY = { safe: 120, strongbox: 80, crate: 250, tools: 150, jug: 400 };
  // R.E.P.O.-style grabbing (public/js/84-grab.js, after Greg's phys.js): mass (kg) and how easily bumps chip value.
  // One camper pulls at most GRAB.FMAX newtons, so ~71 kg is the most one of you can lift: the safe takes two.
  const PHYS = { safe: { m: 120, frag: 0.15 }, strongbox: { m: 60, frag: 0.35 }, cart: { m: 25, frag: 0 }, body: { m: 70, frag: 0 },
    crate: { m: 30, frag: 0.9 }, tools: { m: 28, frag: 0.2 }, jug: { m: 18, frag: 1.3 } };   // glass jars, iron, pottery
  // the rope (84-grab.js, X): slack up to L m, then it pulls like a pair of hands from wherever you are, up to MAX m away
  const ROPE = { L: 4.5, MAX: 7.5, K: 900 };
  // the crew's wheelbarrow: holds CAP things (loot or a downed friend), parks by the main gate, tips if you hit a bump fast
  const CART = { CAP: 3, HOME: { x: -8, z: 31 }, TIP_SPEED: 3.2, TIP_STEP: 0.32 };
  const GRAB = { K: 1400, DAMP: 70, FMAX: 700, SNAP: 4.2, THROW: 7.5, REACH: 4.5 };
  const DMG = { MIN: 2.4, RATE: 0.06, COOL: 0.25 };   // landings faster than MIN m/s chip value off
  // Tower optics are shared with the renderer, so the light a player sees is the light that can spot them.
  const TOWERS = [
    { x: -39, z: 28, a: -2.35 }, { x: 29, z: 28, a: 2.35 },
    { x: -39, z: 55, a: -0.79 }, { x: 29, z: 55, a: 0.79 },
  ];
  /* Curfew knobs. The play-tester's control center (F2, Curfew tab) changes these live: the server applies the saved
     values and sends them to everyone (setCurfew), so the light you see is still the light that spots you. */
  const CURFEW_DEF = {
    towerReach: 78,      // m along the ground to where a searchlight's far (top) edge lands (JT: 50% past the old 52 m)
    towerHalf: 0.26,     // rad: half the width of a searchlight beam
    towerSweep: 1.38,    // rad: how far each searchlight swings either side of its aim (±79°: JT asked for 30° more than ±49°)
    towerSpeed: 1,       // x: how fast the searchlights sweep
    copN: 4,             // officers on patrol
    copRing: 1,          // x: size of their patrol loop around camp
    copRange: 30,        // m: how far an officer's flashlight reaches
    copHalf: 0.42,       // rad: half the width of the flashlight cone
    copWalk: 1.7,        // m/s strolling the loop
    copRun: 6.3,         // m/s chasing: faster than walking (4.3), slower than sprinting (7.2)
    copLose: 5,          // seconds without seeing you before an officer gives up
    copCatch: 1.6,       // m: close enough to cuff you (only while their light or a tower is on you)
  };
  const CURFEW_LIM = { towerReach: [15, 250], towerHalf: [0.03, 0.8], towerSweep: [0, 3.2], towerSpeed: [0, 10], copN: [0, 12], copRing: [0.3, 4],
    copRange: [3, 120], copHalf: [0.05, 1.2], copWalk: [0.2, 8], copRun: [0.5, 15], copLose: [0, 60], copCatch: [0.5, 6] };
  const CURFEW = Object.assign({}, CURFEW_DEF);
  function setCurfew(o) {   // untrusted input: known keys, finite numbers, clamped
    for (const k in CURFEW_DEF) { const v = o && o[k]; if (Number.isFinite(v)) CURFEW[k] = clamp(v, CURFEW_LIM[k][0], CURFEW_LIM[k][1]); }
    CURFEW.copN = Math.round(CURFEW.copN);
    return CURFEW;
  }
  const TOWER_RANGE = CURFEW_DEF.towerReach, TOWER_HALF_ANGLE = CURFEW_DEF.towerHalf, COP_RANGE = CURFEW_DEF.copRange, COP_HALF_ANGLE = CURFEW_DEF.copHalf;   // defaults, for tests
  /* A searchlight is a real cone from the lamp (TOWER_LAMP_Y up) tilted down onto the flat lakebed: its top edge lands
     towerReach away, its bottom edge much nearer, so the lit patch on the ground is a long oval, not a flat wedge. */
  const TOWER_LAMP_Y = 10.3, TOWER_SPOT_Y = 0.2;   // lamp height (on a post above the roof peak); the height on a camper the light has to touch (feet in the lit patch count)
  function towerTilt() { return Math.atan2(TOWER_LAMP_Y, CURFEW.towerReach) + CURFEW.towerHalf; }   // how far the beam's axis points below level
  function towerHeading(i, t) { return TOWERS[i].a + Math.sin(t / 2900 * CURFEW.towerSpeed + i * 1.7) * CURFEW.towerSweep; }
  function towerLit(x, y, z, o, h) {
    const dx = x - o.x, dy = y - TOWER_LAMP_Y, dz = z - o.z, d = Math.hypot(dx, dy, dz), tl = towerTilt();
    return d > 0.01 && (Math.cos(tl) * (dx * Math.sin(h) + dz * Math.cos(h)) - Math.sin(tl) * dy) / d > Math.cos(CURFEW.towerHalf);
  }
  function inBeam(x, z, ox, oz, h, range, halfAngle) {
    const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz);
    return d < range && d > 0.01 && (dx * Math.sin(h) + dz * Math.cos(h)) / d > Math.cos(halfAngle);
  }
  function towerSees(p, t) {
    return !p.hd && TOWERS.some((o, i) => towerLit(p.x, TOWER_SPOT_Y, p.z, o, towerHeading(i, t)));
  }

  /* ---- heavy loot: one camper drags it slowly, two or more carry it at a walk ---- */
  function carrySpeed(n) { return n >= 2 ? 3.5 : 1.2; }
  // props: {id:{type,x,z,n}}; players: [{id,x,z,cy,dn}]. Returns ids that reached Mr. Sir's truck.
  function stepProps(props, players, dt) {
    const sold = [];
    for (const id in props) {
      const pr = props[id];
      const cs = players.filter(p => p.cy === +id && !p.dn && Math.hypot(p.x - pr.x, p.z - pr.z) < 3.4);
      pr.n = cs.length; pr.who = cs.map(p => p.id);
      if (cs.length) {
        let ax = 0, az = 0; for (const p of cs) { ax += p.x; az += p.z; } ax /= cs.length; az /= cs.length;
        const dx = ax - pr.x, dz = az - pr.z, d = Math.hypot(dx, dz);
        if (d > 1.1) { const s = Math.min(d - 1.1, carrySpeed(cs.length) * 1.4 * dt); pr.x += dx / d * s; pr.z += dz / d * s; pr.moved = true; }
      }
      if (Math.hypot(pr.x - SELL.x, pr.z - SELL.z) < SELL.r) sold.push(id);
    }
    return sold;
  }

  /* ---- monsters: police trucks until 01:00, then Madame Zeroni until dawn ---- */
  // M: {trucks:[], zer:null}. players: [{id,x,z,fa,cr,hd,dn,nz}]. t: clock. ev: events out.
  /* ---- the night patrol: four police officers on foot with flashlights (JT, 2026-09-27: no more cop cars, which
     only appeared around whoever was outside and "just teleport in") ----
     At curfew they walk out of the main gate one by one, then patrol a loop around the camp just outside the watchtower
     searchlights' reach, all night, whether or not anyone is outside. At dawn they walk back in through the gate.
     You're spotted when an officer's flashlight cone or a tower beam is on you (crouched down in a deep hole hides
     you); a tower sighting sends the nearest officer running over. Officers run a bit slower than a sprinting camper,
     give up after CURFEW.copLose seconds without seeing you, and never cross the camp fence. The array keeps its old wire
     name (M.trucks) so the server, logs and client plumbing stay the same; each entry is one officer. */
  const COP_GATE = { x: 0, z: 29 };         // where they come out of / go back into camp (just inside the main gate)
  const COP_RING = { x: -5, z: 41, rx: 96, rz: 92 };   // patrol loop around camp (x CURFEW.copRing); speeds etc. are in CURFEW
  const COP_BRISK = 2.9;                    // m/s walking out to the loop or home at dawn
  const COP_TURN = 3;                       // rad/s turn rate
  const COP_STAGGER = 3;                    // s between officers walking out of the gate
  const COP_WOBBLE = 9;                     // m of in-and-out drift around the loop, so they don't walk a perfect ellipse
  function ringPoint(th) { const k = CURFEW.copRing; return { x: COP_RING.x + Math.sin(th) * COP_RING.rx * k, z: clamp(COP_RING.z - Math.cos(th) * COP_RING.rz * k, -EDGE + 6, EDGE - 6) }; }
  // officer i of n: they spread evenly round the loop, alternate directions, and leave the gate COP_STAGGER apart (k-th in line)
  function spawnCop(i, n, k) {
    const th = i / Math.max(n, 1) * Math.PI * 2 + Math.PI / 4;
    return { x: COP_GATE.x + ((i % 4) - 1.5) * 1.2, z: COP_GATE.z, h: 0, mode: 'out', th, dir: i % 2 ? -1 : 1, delay: k * COP_STAGGER, lost: 0, tgt: null, tx: 0, tz: 0, wob: i * 1.7 };
  }
  function copLit(c, p) { return inBeam(p.x, p.z, c.x, c.z, c.h + Math.PI, CURFEW.copRange, CURFEW.copHalf); }
  function stepMonsters(M, players, t, dt, ev, opt) {
    const fm = !!(opt && opt.mood === 'fullmoon');   // full moon: Zeroni all night, no police
    const night = t >= DAYMS, half = fm ? 'zeroni' : t < NIGHT_SPLIT ? 'police' : 'zeroni';
    if (!night) M.appeased = false;   // sung away: gone until the next night
    const outs = players.filter(p => !inCamp(p.x, p.z));
    if (night && !fm) {   // keep CURFEW.copN officers out: more walk out of the gate, spares head home (the slider works mid-night)
      const on = M.trucks.filter(c => c.mode !== 'home'), n = CURFEW.copN;
      for (let k = 0; on.length + k < n; k++) M.trucks.push(spawnCop(on.length + k, n, k));
      for (const c of on.slice(n)) { c.mode = 'home'; c.tgt = null; c.delay = 0; }
    }
    else for (const c of M.trucks) if (c.mode !== 'home') { c.mode = 'home'; c.tgt = null; c.delay = 0; }
    for (const c of M.trucks) stepCop(c, M.trucks, outs, t, dt, ev);
    M.trucks = M.trucks.filter(c => !c.gone);
    // Madame Zeroni: out on the lake after 01:00, only while somebody is out there (the officers keep patrolling too)
    if (!(night && half === 'zeroni' && outs.length) || M.appeased) M.zer = null;
    else {
      if (!M.zer) { const p = nearest(outs.filter(p => !p.dn), 0, 40) || outs[0]; M.zer = { x: 0, z: -40, tgt: null, blink: 10, talk: 1.5, drag: null }; place(M.zer, p, 45, false); ev.push({ k: 'zspawn' }); }
      stepZeroni(M.zer, outs, t, dt, ev);
    }
  }
  function nearest(list, x, z) { let b = null, bd = 1e9; for (const p of list) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } } return b; }
  function stepCop(c, cops, outs, t, dt, ev) {
    if (c.delay > 0) { c.delay -= dt; return; }   // waiting their turn at the gate
    if (c.mode !== 'home') {
      // what this officer sees: anyone their flashlight is on; otherwise a camper a tower has lit up, if this is the
      // nearest officer to them (one officer answers each tower sighting, not all four)
      let seenP = null, seenD = 1e9;
      for (const p of outs) { if (p.dn || p.hd) continue; const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < seenD && copLit(c, p)) { seenD = d; seenP = p; } }
      if (!seenP) for (const p of outs) {
        if (p.dn || p.hd || !towerSees(p, t)) continue;
        let near = null, nd = 1e9; for (const o of cops) { if (o.mode === 'home' || o.delay > 0) continue; const d = Math.hypot(p.x - o.x, p.z - o.z); if (d < nd) { nd = d; near = o; } }
        if (near === c) { seenP = p; seenD = nd; break; }
      }
      if (seenP) { if (c.mode !== 'chase' || c.tgt !== seenP.id) ev.push({ k: 'spot', id: seenP.id }); c.mode = 'chase'; c.tgt = seenP.id; c.tx = seenP.x; c.tz = seenP.z; c.lost = 0; }
      else if (c.mode === 'chase' && (c.lost += dt) > CURFEW.copLose) { if (c.tgt != null) ev.push({ k: 'lost', id: c.tgt }); c.mode = 'return'; c.tgt = null; }
    }
    // where to walk, and how fast
    let gx, gz, sp;
    if (c.mode === 'chase') { gx = c.tx; gz = c.tz; sp = CURFEW.copRun; }
    else if (c.mode === 'home') { gx = COP_GATE.x; gz = COP_GATE.z; sp = COP_BRISK; }
    else {
      if (c.mode === 'patrol') c.th += c.dir * CURFEW.copWalk / ((COP_RING.rx + COP_RING.rz) / 2 * CURFEW.copRing) * dt;
      else if (c.mode === 'return') { let best = c.th, bd = 1e9; for (let k = 0; k < 24; k++) { const th = k / 24 * Math.PI * 2, q = ringPoint(th), d = Math.hypot(q.x - c.x, q.z - c.z); if (d < bd) { bd = d; best = th; } } c.th = best; c.mode = 'out'; }
      c.wob += dt * 0.07;
      const q = ringPoint(c.th), w = Math.sin(c.wob) * COP_WOBBLE, ox = Math.sin(c.th), oz = -Math.cos(c.th);
      gx = q.x + ox * w; gz = q.z + oz * w; sp = c.mode === 'out' ? COP_BRISK : CURFEW.copWalk;
      if (c.mode === 'out' && Math.hypot(gx - c.x, gz - c.z) < 3) c.mode = 'patrol';
    }
    const dx = gx - c.x, dz = gz - c.z, d = Math.hypot(dx, dz);
    if (c.mode === 'home' && d < 1.2) { c.gone = true; return; }
    if (d > 0.3) {
      let dh = Math.atan2(-dx, -dz) - c.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.h += clamp(dh, -COP_TURN * dt, COP_TURN * dt);
      const step = Math.min(d, sp * dt), nx = clamp(c.x - Math.sin(c.h) * step, -EDGE + 3, EDGE - 3), nz = clamp(c.z - Math.cos(c.h) * step, -EDGE + 3, EDGE - 3);
      // officers only cross the fence line walking out at curfew or home at dawn (through the gate)
      if (c.mode === 'out' || c.mode === 'home' || !inCamp(nx, nz)) { c.x = nx; c.z = nz; }
      else if (!inCamp(nx, c.z)) c.x = nx; else if (!inCamp(c.x, nz)) c.z = nz;
    }
    if (c.mode !== 'home') for (const p of outs) { if (p.dn || p.hd) continue; const pd = Math.hypot(p.x - c.x, p.z - c.z); if (pd < CURFEW.copCatch && (copLit(c, p) || towerSees(p, t))) ev.push({ k: 'down', id: p.id, by: 'police' }); }
  }
  // put Zeroni near player p: behind them, or (front=true) right in front of them
  function place(z, p, dist, front) {
    if (!p) return false;
    for (let k = 0; k < 24; k++) {
      const a = (p.fa || 0) + (front ? 0 : Math.PI) + (Math.random() - 0.5) * (1.2 + k * 0.2);
      const x = clamp(p.x + Math.sin(a) * dist, -EDGE + 4, EDGE - 4), zz = clamp(p.z + Math.cos(a) * dist, -EDGE + 4, EDGE - 4);
      if (!nearCampZone(x, zz)) { z.x = x; z.z = zz; return true; }
    }
    return false;
  }
  function stepZeroni(z, outs, t, dt, ev) {
    // dragging someone off toward the edge of the lake; a friend reviving them makes her let go
    if (z.drag != null) {
      const v = outs.find(p => p.id === z.drag);
      if (!v || !v.dn) { ev.push({ k: 'drop', id: z.drag }); z.drag = null; const o = nearest(outs.filter(p => !p.dn), z.x, z.z); if (o) place(z, o, 40, false); z.blink = 10; return; }
      const ex = Math.abs(z.x) > Math.abs(z.z) ? Math.sign(z.x) : 0, ez = ex ? 0 : Math.sign(z.z) || 1;
      z.x = clamp(z.x + ex * 2 * dt, -EDGE, EDGE); z.z = clamp(z.z + ez * 2 * dt, -EDGE, EDGE);
      if (Math.max(Math.abs(z.x), Math.abs(z.z)) >= EDGE - 1) { ev.push({ k: 'gone', id: z.drag }); z.drag = null; }
      return;
    }
    // she goes after whoever is closest, and noise (shouting, sprinting, chatting) counts like being 40 m closer
    let tgt = null, best = 1e9;
    // Light doesn't matter to her (JT, 2026-09-27): the watchtower searchlights are a police thing only.
    for (const p of outs) { if (p.dn) continue; const s = Math.hypot(p.x - z.x, p.z - z.z) - (p.nz || 0) * 40; if (s < best) { best = s; tgt = p; } }
    z.tgt = tgt ? tgt.id : null;
    if (!tgt) return;
    let dx = tgt.x - z.x, dz = tgt.z - z.z, d = Math.hypot(dx, dz) || 0.01;
    z.blink -= dt;
    if (d > 14 && (d > 80 || z.blink <= 0)) {
      z.blink = 8 + Math.random() * 6; const front = Math.random() < 0.25;
      if (place(z, tgt, front ? 9 : clamp(d * 0.5, 10, 28), front)) { ev.push({ k: 'blink', id: tgt.id, front }); dx = tgt.x - z.x; dz = tgt.z - z.z; d = Math.hypot(dx, dz) || 0.01; }
    }
    const nx = z.x + dx / d * 5.4 * dt, nz = z.z + dz / d * 5.4 * dt;
    if (!inCamp(nx, nz)) { z.x = nx; z.z = nz; }
    z.talk -= dt; if (z.talk <= 0) { z.talk = 6.5 + Math.random() * 2.5; ev.push({ k: 'talk' }); }
    if (d < 1.8) { ev.push({ k: 'down', id: tgt.id, by: 'zeroni' }); z.drag = tgt.id; }
  }

  /* ---- javelina herd: a swarm event out on the lake. Self-contained (doesn't touch MON/stepMonsters above) so it
     can be reasoned about and merged on its own. J: {list, age, noTgtT, leaving, leaveT, natCooldown}; list items:
     {x,z,h,hp,state,biteCd,mx,mz,idx} with state 0 alive, 1 dying (tumble), 2 gone. The camp fence stops them dead,
     same trick as the police trucks (inCamp check on the *next* position). Server owns this when online; solo play
     runs the identical function against just the local player, same pattern as stepMonsters/stepSoloMonsters. */
  const JAV_COUNT = 30;                          // default herd size (also the console command's default)
  const JAV_HP = 2;                              // shovel hits to kill one
  const JAV_SPEED = 6.3;                         // m/s: faster than walking (4.3), a bit slower than sprinting (7.2) -- sprinting to camp is a real, water-costly escape
  const JAV_LEAVE_SPEED = 8.5;                   // m/s while running off for good (leaving/giving up)
  const JAV_BITE_R = 1.3, JAV_BITE_CD = 1.4;     // bite range, and per-animal cooldown so 30 of them don't all bite the same tick
  const JAV_BITE_MIN = 5, JAV_BITE_MAX = 8;      // health damage per bite (hurt() on the bitten player's own client)
  const JAV_BITE_GAP = 0.4;                      // minimum seconds between bites landing on the SAME player, herd-wide: caps a 30-strong
                                                  // swarm's total dps (even if a dozen physically fit in range) at ~16-20/s -- scary, not instant death

  const JAV_SEP = 1.5;                           // personal space between herdmates, so 30 of them don't stack into one spot
  const JAV_MILL_R = 8;                          // how far they circle when nobody reachable is left near their last known target
  const JAV_GIVEUP_S = 18;                       // seconds with no reachable target before the whole herd gives up and leaves
  const JAV_LIFE_S = 210;                        // herd leaves on its own after this long even if it's still finding people
  const JAV_LEAVE_S = 6;                         // seconds spent visibly running off before the herd is gone for good
  const JAV_DEATH_S = 0.9;                       // tumble/poof time after the killing hit, before the slot goes fully invisible
  const JAV_KNOCK = 0.9;                         // metres a hit knocks a javelina back, away from whoever swung
  const JAV_NAT_CHANCE = 1 / 480;                // natural spawn: ~1 herd every 8 minutes on average, while conditions hold
  const JAV_NAT_COOLDOWN = 90;                   // seconds of quiet after any herd ends before another can spawn naturally
  // Build a fresh herd of `n` javelinas roughly `dist` m out from `target` ({x,z}), aimed back at it. `target` may be
  // null (natural spawn with nobody picked yet never calls this without one, but keep it safe): falls back to the
  // middle of the lake. Mutates J in place and pushes a 'javSpawn' event so every client can toast a warning.
  function spawnJavHerd(J, target, n, dist, ev) {
    n = Math.round(clamp(n || JAV_COUNT, 4, JAV_COUNT)); dist = clamp(dist || 70, 20, 300); // capped at JAV_COUNT (30): also the client's fixed render-instance pool size
    const cx = target ? target.x : 0, cz = target ? target.z : -40;
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      let x = clamp(cx + Math.sin(a) * dist + (Math.random() - 0.5) * 12, -EDGE + 5, EDGE - 5);
      let z = clamp(cz + Math.cos(a) * dist + (Math.random() - 0.5) * 12, -EDGE + 5, EDGE - 5);
      if (inCamp(x, z)) { x = clamp(x, -EDGE + 5, -50); } // shouldn't happen at these distances, but never spawn inside the fence
      ({ x, z } = toFloor(x, z));
      list.push({ x, z, h: 0, hp: JAV_HP, state: 0, biteCd: 0, mx: x, mz: z, idx: i });
    }
    Object.assign(J, { list, age: 0, noTgtT: 0, leaving: false, leaveT: 0 });
    ev.push({ k: 'javSpawn', n: list.length, x: cx, z: cz });
  }
  // players: [{id,x,z,dn,hd}] (same shape stepMonsters uses -- dn downed, hd hidden/crouched deep in a hole: both
  // make you unreachable, same as they do for the police). t: clock (for "leave at night"). ev: events out.
  function stepJavelinas(J, players, t, dt, ev) {
    if (J.natCooldown === undefined) J.natCooldown = JAV_NAT_COOLDOWN;
    const outs = players.filter(p => !inCamp(p.x, p.z));
    if (!J.list || !J.list.length) {
      J.natCooldown = Math.max(0, J.natCooldown - dt);
      if (t < DAYMS && J.natCooldown <= 0 && !J.noNatural) { // noNatural: the event director owns natural herds
        const cand = outs.filter(p => !p.dn);
        if (cand.length && Math.random() < JAV_NAT_CHANCE * dt) spawnJavHerd(J, cand[Math.floor(Math.random() * cand.length)], JAV_COUNT, 65 + Math.random() * 40, ev);
      }
      return;
    }
    const reachable = outs.filter(p => !p.dn && !p.hd);
    J.noTgtT = reachable.length ? 0 : (J.noTgtT || 0) + dt;
    J.age = (J.age || 0) + dt;
    J.biteGap = J.biteGap || {}; for (const k in J.biteGap) J.biteGap[k] += dt; // per-player "just got bitten" clock, herd-wide (see JAV_BITE_GAP)
    if (!J.leaving && (J.age > JAV_LIFE_S || J.noTgtT > JAV_GIVEUP_S || t >= DAYMS)) { J.leaving = true; J.leaveT = 0; ev.push({ k: 'javLeave' }); }
    if (J.leaving) {
      J.leaveT = (J.leaveT || 0) + dt;
      for (const j of J.list) {
        if (j.state === 2) continue;
        if (j.state === 1) { j.dT = (j.dT || 0) + dt; if (j.dT > JAV_DEATH_S) j.state = 2; continue; }
        const d = Math.hypot(j.x, j.z) || 1; // run outward, away from camp at the middle of the lake
        j.x = clamp(j.x + j.x / d * JAV_LEAVE_SPEED * dt, -EDGE, EDGE); j.z = clamp(j.z + j.z / d * JAV_LEAVE_SPEED * dt, -EDGE, EDGE);
        j.h = Math.atan2(j.x / d, j.z / d);
      }
      if (J.leaveT > JAV_LEAVE_S) { J.list = []; J.natCooldown = JAV_NAT_COOLDOWN; ev.push({ k: 'javGone' }); }
      return;
    }
    for (const j of J.list) {
      if (j.state === 2) continue;
      if (j.state === 1) { j.dT = (j.dT || 0) + dt; if (j.dT > JAV_DEATH_S) j.state = 2; continue; }
      j.biteCd = Math.max(0, j.biteCd - dt);
      let tgt = null, bd = 1e9;
      for (const p of reachable) { const d = Math.hypot(p.x - j.x, p.z - j.z); if (d < bd) { bd = d; tgt = p; } }
      let gx, gz;
      if (tgt) {
        j.mx = tgt.x; j.mz = tgt.z; // remember the last spot someone was, for milling if they slip away
        // flank: aim a bit to this animal's own side of the target instead of dead-on, so the herd swarms rather than filing in single line
        const ang = Math.atan2(tgt.x - j.x, tgt.z - j.z) + Math.sin(j.idx * 2.1 + J.age * 0.6) * 0.6;
        gx = tgt.x + Math.sin(ang) * 0.3; gz = tgt.z + Math.cos(ang) * 0.3;
        if (bd < JAV_BITE_R && j.biteCd <= 0 && (J.biteGap[tgt.id] === undefined || J.biteGap[tgt.id] >= JAV_BITE_GAP)) {
          j.biteCd = JAV_BITE_CD; J.biteGap[tgt.id] = 0;
          ev.push({ k: 'javBite', id: tgt.id, dmg: Math.round(JAV_BITE_MIN + Math.random() * (JAV_BITE_MAX - JAV_BITE_MIN)) });
        }
      } else { const ph = J.age * 0.6 + j.idx * 1.7; gx = j.mx + Math.cos(ph) * JAV_MILL_R; gz = j.mz + Math.sin(ph) * JAV_MILL_R; }
      let dx = gx - j.x, dz = gz - j.z, d = Math.hypot(dx, dz) || 0.01;
      let sx = 0, sz = 0;
      for (const o of J.list) { if (o === j || o.state) continue; const ox = j.x - o.x, oz = j.z - o.z, od = Math.hypot(ox, oz); if (od < JAV_SEP && od > 0.001) { sx += ox / od * (JAV_SEP - od); sz += oz / od * (JAV_SEP - od); } }
      let mx = dx / d + sx * 0.6, mz = dz / d + sz * 0.6, ml = Math.hypot(mx, mz) || 1;
      const nx = j.x + mx / ml * JAV_SPEED * dt, nz = j.z + mz / ml * JAV_SPEED * dt;
      // the fence stops them like it stops the police trucks, but sliding along it (one axis at a time) instead of
      // freezing dead against it, so a javelina on the wrong side of camp actually walks the fence line around to you
      if (!inCamp(nx, nz)) { j.x = clamp(nx, -EDGE, EDGE); j.z = clamp(nz, -EDGE, EDGE); }
      else if (!inCamp(nx, j.z)) j.x = clamp(nx, -EDGE, EDGE);
      else if (!inCamp(j.x, nz)) j.z = clamp(nz, -EDGE, EDGE);
      j.h = Math.atan2(mx, mz);
    }
  }
  // A shovel hit on javelina `idx`: (ax,az) is the striking player's position (for knockback direction), `by` their
  // id (for the death event's XP credit). Returns false if there's nothing alive to hit there.
  function whackJavelina(J, idx, ax, az, ev, by) {
    const j = J.list && J.list[idx]; if (!j || j.state) return false;
    j.hp -= 1;
    const dx = j.x - ax, dz = j.z - az, d = Math.hypot(dx, dz) || 1;
    const nx = j.x + dx / d * JAV_KNOCK, nz = j.z + dz / d * JAV_KNOCK;
    if (!inCamp(nx, nz)) { j.x = clamp(nx, -EDGE, EDGE); j.z = clamp(nz, -EDGE, EDGE); }
    if (j.hp <= 0) { j.state = 1; j.dT = 0; ev.push({ k: 'javDeath', idx, by }); } else ev.push({ k: 'javHit', idx, by });
    return true;
  }

  /* ---- mountain lion: one apex predator, out during a short pre-curfew window (or spawned from the console).
     It never sets foot in camp. It picks the most vulnerable camper outside the fence, stalks in from behind
     their facing (freezing the instant they could see it), circles at mid-range to cut off the way home, and
     only pounces from close range when it's sure it's unseen -- real damage, not an instant kill. Getting faced
     down, mobbed by friends, or hit enough times with a shovel drives it off. Runs on the server when online and
     locally for solo play (see stepSoloLion in 85-lion.js), exactly like stepMonsters above. */
  const LION_WIN_START = DAYMS - 3 * 60000, LION_WIN_END = DAYMS - 70000; // ~2 min window, clear of the 60s curfew siren
  const LION_HP = 260;              // total damage it soaks up (shovel swats -- see lionSwat) before fleeing for good
  const LION_SWAT_DMG = 9;          // one shovel hit's worth, applied by lionSwat()
  const LION_SPAWN_R = 55;          // natural spawn: this far from its first target, already at stalking range
  const LION_STALK_D = 16;          // preferred standoff while stalking, behind the target
  const LION_STALK_SPD = 3.2, LION_CIRCLE_SPD = 5.6, LION_BURST_SPD = 8.8, LION_POUNCE_SPD = 13.5, LION_LEAVE_SPD = 8;
  const LION_POUNCE_MIN = 6, LION_POUNCE_MAX = 9;   // it only lunges from this range, and only when unseen
  const LION_BITE_R = 1.7;          // contact distance for the lunge to land
  const LION_DMG = 35;              // one pounce's damage; hurt() is called by the victim's own client (like Zeroni's 'down')
  const LION_PIN_TIME = 1.6;        // seconds pinned in place after a pounce lands
  const LION_COOLDOWN = 10;         // seconds before it will try another pounce on the same stalk
  const LION_GIVEUP = 14;           // seconds waiting near a hole rim before giving up on a target it can't reach
  const LION_RETARGET = 6;          // how often it re-scores every camper for the most vulnerable one
  const LION_FLEE_TIME = 7;         // temporary backoff after being deterred (faced down, mobbed, flashlit)
  const LION_VIEW_COS = 0.35;       // roughly a 140 deg cone in front of the target counts as "could see it coming"
  const LION_MOB_R = 15, LION_MOB_N = 2; // "several campers together" = this many friends within this range of the target
  const CAMP_GATE = { x: -5, z: 41 }; // near the fence gate; it predicts a run for camp heads roughly here
  const LION_MODES = ['stalk', 'circle', 'pounce', 'pin', 'flee', 'leave']; // wire-format encoding of L.mode -- see monSnapshot() in server.js

  function lionCampDist(x, z) { return Math.hypot(Math.max(-40 - x, 0, x - 30), Math.max(27 - z, 0, z - 56)); }
  // how much p is oriented toward point (fx,fz): 1 = dead ahead, -1 = straight behind them
  function lionFacingCos(p, fx, fz) { const dx = fx - p.x, dz = fz - p.z, d = Math.hypot(dx, dz) || 0.01; return (dx * Math.sin(p.fa) + dz * Math.cos(p.fa)) / d; }
  // vulnerability score: alone beats crowded, hurt beats healthy, distracted/noisy beats alert, heavy loot beats empty-handed,
  // far from the fence beats close to it. Tuned by feel, not simulation -- see the numbers above each term.
  function lionScore(p, outs) {
    if (p.dn || p.hd) return -1e9; // can't target someone already down, or hidden down a hole deep enough to be safe
    let iso = 60; for (const q of outs) { if (q === p || q.dn) continue; const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < iso) iso = d; }
    let s = iso;
    if (p.hp != null) s += Math.max(0, 55 - p.hp) * 0.8;
    if (p.an === 2) s += 25;             // digging: back half-turned, focused on the hole
    s += (p.nz || 0) * 22;               // noisy: shouting, sprinting, chatting
    if (p.cy != null && p.cy >= 0) s += 28; // hauling something heavy: slow, hands full
    s += Math.min(lionCampDist(p.x, p.z), 220) * 0.12;
    return s;
  }
  function lionPick(outs) { let best = null, bs = -1e9; for (const p of outs) { const s = lionScore(p, outs); if (s > bs) { bs = s; best = p; } } return best; }
  function lionSpawn(L, outs, atX, atZ) {
    const p = atX != null ? nearest(outs.filter(p => !p.dn && !p.hd), atX, atZ) : lionPick(outs.filter(p => !p.dn && !p.hd));
    Object.assign(L, { active: true, hp: LION_HP, mode: 'stalk', tgt: p ? p.id : null, pounceCd: 2, waitT: 0, fleeT: 0, retargetT: 0, circleDir: Math.random() < 0.5 ? 1 : -1 });
    if (atX != null) { L.x = atX; L.z = atZ; }
    else { const a = (p ? p.fa : 0) + Math.PI + (Math.random() - 0.5) * 0.8; L.x = clamp((p ? p.x : 0) + Math.sin(a) * LION_SPAWN_R, -EDGE + 5, EDGE - 5); L.z = clamp((p ? p.z : -40) + Math.cos(a) * LION_SPAWN_R, -EDGE + 5, EDGE - 5); }
    ({ x: L.x, z: L.z } = toFloor(L.x, L.z));   // in the canyon: on the floor, not up a wall
    L.h = p ? Math.atan2(p.x - L.x, p.z - L.z) : 0;
  }
  // move L toward (x,z) at speed sp, never into camp; returns the distance that was left. Also faces it that way.
  function lionMove(L, x, z, sp, dt) {
    const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz); if (d < 0.05) return d;
    L.h = Math.atan2(dx, dz);
    const s = Math.min(d, sp * dt), nx = clamp(L.x + dx / d * s, -EDGE + 3, EDGE - 3), nz = clamp(L.z + dz / d * s, -EDGE + 3, EDGE - 3);
    if (!inCamp(nx, nz)) { L.x = nx; L.z = nz; }
    return d;
  }
  function lionLeave(L, dt, ev) {
    if (L.mode !== 'leave') { L.mode = 'leave'; ev.push({ k: 'lionRoar', why: 'retreat' }); }
    const ex = Math.abs(L.x) > Math.abs(L.z) ? (Math.sign(L.x) || 1) : 0, ez = ex ? 0 : (Math.sign(L.z) || 1);
    L.x = clamp(L.x + ex * LION_LEAVE_SPD * dt, -EDGE, EDGE); L.z = clamp(L.z + ez * LION_LEAVE_SPD * dt, -EDGE, EDGE);
    if (Math.max(Math.abs(L.x), Math.abs(L.z)) >= EDGE - 1) { L.active = false; ev.push({ k: 'lionGone' }); }
  }
  // L: {active,x,z,h,mode,tgt,hp,pounceCd,waitT,fleeT,pinT,retargetT,circleDir,armed,pendingSpawn}. players: like stepMonsters.
  function stepLion(L, players, t, dt, ev) {
    const outs = players.filter(p => !inCamp(p.x, p.z));
    if (t < LION_WIN_START) L.armed = true; // re-arm once we're back before the window, ready for the next day's cycle
    if (!L.active) {
      if (L.pendingSpawn) { const p = L.pendingSpawn; L.pendingSpawn = null; lionSpawn(L, outs, p.x, p.z); ev.push({ k: 'lionSpawn', id: L.tgt }); return; }
      if (!L.noNatural && L.armed && t >= LION_WIN_START && t < LION_WIN_END && outs.some(p => !p.dn && !p.hd)) { lionSpawn(L, outs); L.armed = false; ev.push({ k: 'lionSpawn', id: L.tgt }); }
      return;
    }
    L.pendingSpawn = null; // only one lion at a time -- ignore a spawn command while it's already out
    const curfew = t >= DAYMS || L.hp <= 0;
    L.retargetT = (L.retargetT || 0) - dt;
    let tgt = outs.find(p => p.id === L.tgt), wantLeave = L.mode === 'leave';
    if (curfew || !outs.length) { wantLeave = true; }
    else if (L.mode !== 'pounce' && L.mode !== 'pin' && (!tgt || tgt.dn || L.retargetT <= 0)) {
      L.retargetT = LION_RETARGET; const p = lionPick(outs.filter(p => !p.dn));
      if (p && p.id !== L.tgt) { L.tgt = p.id; L.waitT = 0; ev.push({ k: 'lionTarget', id: p.id }); }
      tgt = outs.find(p => p.id === L.tgt);
      if (!tgt) wantLeave = true;
    }
    if (wantLeave) return lionLeave(L, dt, ev); // lionLeave itself sets L.mode='leave' and roars once, on the first call
    if (!tgt) return;
    const mobbed = outs.filter(p => p !== tgt && !p.dn && Math.hypot(p.x - tgt.x, p.z - tgt.z) < LION_MOB_R).length >= LION_MOB_N;
    const facingCos = lionFacingCos(tgt, L.x, L.z), d = Math.hypot(tgt.x - L.x, tgt.z - L.z);
    const facedDown = facingCos > 0.5 && d < 30;                          // "look big": staring it down at close range spooks it
    const litUp = tgt.lt && facingCos > 0.3 && d < 25;                    // a flashlight beam square on it, at night, also spooks it
    if (tgt.hd) {                                                         // hiding down a deep hole: wait at the rim, then give up
      L.waitT += dt; if (L.waitT > LION_GIVEUP) { L.tgt = null; L.retargetT = 0; }
      return;
    }
    L.waitT = 0;
    if ((facedDown || litUp || mobbed) && L.mode !== 'flee' && L.mode !== 'pounce' && L.mode !== 'pin') {
      L.mode = 'flee'; L.fleeT = LION_FLEE_TIME; ev.push({ k: 'lionFlee', id: tgt.id, why: facedDown ? 'faced' : litUp ? 'lit' : 'mobbed' });
    }
    if (L.mode === 'flee') { L.fleeT -= dt; lionMove(L, L.x * 2 - tgt.x, L.z * 2 - tgt.z, LION_CIRCLE_SPD, dt); if (L.fleeT <= 0) L.mode = 'stalk'; return; }
    if (L.mode === 'pin') { L.pinT -= dt; if (L.pinT <= 0) { L.mode = 'stalk'; L.pounceCd = LION_COOLDOWN; lionMove(L, L.x - Math.sin(L.h) * 3, L.z - Math.cos(L.h) * 3, LION_CIRCLE_SPD, dt); } return; }
    if (L.mode === 'pounce') { if (lionMove(L, tgt.x, tgt.z, LION_POUNCE_SPD, dt) < LION_BITE_R) { L.mode = 'pin'; L.pinT = LION_PIN_TIME; ev.push({ k: 'pounce', id: tgt.id }); } return; }
    L.pounceCd = Math.max(0, (L.pounceCd || 0) - dt);
    const canSeeMe = facingCos > LION_VIEW_COS;
    if (!canSeeMe && !mobbed && L.pounceCd <= 0 && d >= LION_POUNCE_MIN && d <= LION_POUNCE_MAX) { L.mode = 'pounce'; ev.push({ k: 'lionPounceStart', id: tgt.id }); return; }
    if (d < LION_STALK_D * 1.4) {                                         // close enough to flank: circle to cut off the route home
      L.mode = 'circle';
      const gx0 = CAMP_GATE.x - tgt.x, gz0 = CAMP_GATE.z - tgt.z, gd = Math.hypot(gx0, gz0) || 1;
      const px = -gz0 / gd, pz = gx0 / gd;                                 // perpendicular to the escape line, for the flanking offset
      const burst = Math.sin(t / 1400 + L.x) > 0.6;                       // occasional speed bursts, not a steady orbit
      const gx = tgt.x + gx0 / gd * 8 + px * L.circleDir * 10, gz = tgt.z + gz0 / gd * 8 + pz * L.circleDir * 10;
      if (canSeeMe) lionMove(L, L.x - (gx - L.x) * 0.2, L.z - (gz - L.z) * 0.2, LION_CIRCLE_SPD, dt); // seen while circling: ease off a step
      else lionMove(L, gx, gz, burst ? LION_BURST_SPD : LION_CIRCLE_SPD, dt);
      if (Math.random() < 0.003) L.circleDir = -L.circleDir;
    } else {
      L.mode = 'stalk';
      const a = tgt.fa + Math.PI;                                         // behind the target's facing
      const sx = clamp(tgt.x + Math.sin(a) * LION_STALK_D, -EDGE + 4, EDGE - 4), sz = clamp(tgt.z + Math.cos(a) * LION_STALK_D, -EDGE + 4, EDGE - 4);
      if (!canSeeMe) lionMove(L, sx, sz, LION_STALK_SPD, dt);              // freeze in place the instant the target could see it move
      else L.h = Math.atan2(tgt.x - L.x, tgt.z - L.z);
    }
  }
  // a shovel hit landed on it (see lionSwing()/scoop() on the client, and the 'swat' message on the server).
  // Returns true if it counted, so the caller knows to log/broadcast it.
  function lionSwat(L) { if (!L.active) return false; L.hp = Math.max(0, L.hp - LION_SWAT_DMG); return true; }

  /* ---- the day's monster roster (ported from Greg's branch, claude/intense-change-1-test-2026-09-27-1829) ----
     Which kinds show up is picked each day (same pick on every client: seeded by the day), and it grows as the days go by:
       small  (from day 1)  hatch: lizard hatchlings in swarms, snake: rattlesnakes that rattle then strike,
                            scorp: scorpions that come up where you dig
       medium (from day 2)  sir: Mr. Sir walks the lake and takes your sack if you stand around,
                            sheriff: the Sheriff's ghost, near curfew, hunts whoever carries Kate Barlow's loot
       big    (from day 3)  warden: the Warden knocks out whoever she catches idle, kate: Kate Barlow's ghost at night,
                            who only moves while nobody is looking at her
     Our vultures, javelinas and lion stay their own systems. R: {mobs:[], pm:{}, nid, sp, roster, rkey, force:[]}.
     players: simPlayers() on the server / meSim() solo, plus kt (holding Kate's loot), on (onion active), vy (camera yaw). */
  const RO_SMALL = ['hatch', 'snake', 'scorp'], RO_MEDIUM = ['sir', 'sheriff'], RO_BIG = ['warden', 'kate'];
  const RO_KINDS = ['hatch', 'snake', 'scorp', 'sir', 'sheriff', 'warden', 'kate'];   // wire format: index into this
  function roRnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function rosterFor(day, curse) {
    const c = clamp(curse || 0, 0, 100);
    const r = roRnd(day * 131 + 7), take = (list, n) => { const a = list.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };
    const ns = Math.min(3, 1 + Math.floor(day / 2) + Math.floor(c / 40)), nm = day >= 2 || c >= 40 ? (day >= 4 || c >= 70 ? 2 : 1) : 0, nb = day >= 3 || c >= 60 ? (day >= 5 || c >= 80 ? 2 : 1) : 0;
    return [...take(RO_SMALL, ns), ...take(RO_MEDIUM, nm), ...take(RO_BIG, nb)];
  }
  const roSmall = k => k === 'hatch' || k === 'snake' || k === 'scorp';
  function roSpawn(R, k, p, dmin, dmax, extra) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin), x = clamp(p.x + Math.cos(a) * d, -EDGE + 3, EDGE - 3), z = clamp(p.z + Math.sin(a) * d, -EDGE + 3, EDGE - 3);
      const f = toFloor(x, z);
      if (!nearCampZone(f.x, f.z)) { const m = Object.assign({ id: R.nid++, k, x: f.x, z: f.z, h: 0, y: 0, st: 0, t: 0, cd: 0 }, extra || {}); R.mobs.push(m); return m; }
    }
    return null;
  }
  function roChase(m, p, sp, dt, stop) {
    const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz) || 0.01;
    if (d > (stop || 0)) { const s = Math.min(d - (stop || 0), sp * dt), nx = m.x + dx / d * s, nz = m.z + dz / d * s; if (!inCamp(nx, nz)) { m.x = nx; m.z = nz; } }
    m.h = Math.atan2(dx, dz); return d;
  }
  function stepRoster(R, players, t, dt, ev, o) {
    o = o || {}; R.mobs = R.mobs || []; R.pm = R.pm || {}; R.nid = R.nid || 1; R.sp = R.sp || {}; R.force = R.force || [];
    const day = Math.max(1, o.day | 0), night = t >= DAYMS, cur = DAYMS, cz = clamp(o.curse || 0, 0, 100), key = day + ':' + Math.floor(cz / 20);
    if (R.rkey !== key) { R.rkey = key; R.roster = rosterFor(day, cz); }
    const moodK = o.mood === 'breeding' ? 'hatch' : o.mood === 'inspection' ? 'warden' : null;   // the day's mood can force a kind in
    const has = k => (R.all || R.roster.includes(k) || R.force.includes(k) || k === moodK) && !(R.off || []).includes(k) && !(ZONE_NOW !== 'lake' && RO_LAKE_ONLY.includes(k));
    const cmul = (1 + cz / 100) * (o.rate == null ? 1 : Math.max(0.001, o.rate));   // the curse (and the tester's rate slider): everything spawns faster
    if (o.rate === 0) { R.mobs = R.mobs.filter(m => !roSmall(m.k)); }
    if (ZONE_NOW !== 'lake') R.mobs = R.mobs.filter(m => !RO_LAKE_ONLY.includes(m.k));   // camp staff don't follow the crew off the lake
    const outs = players.filter(p => !inCamp(p.x, p.z)), live = outs.filter(p => !p.dn), count = k => R.mobs.filter(m => m.k === k).length;
    const tick = (k, every) => { if (R.sp[k] == null) R.sp[k] = every * Math.random(); R.sp[k] -= dt; if (R.sp[k] <= 0) { R.sp[k] = every; return true; } return false; };
    const pickP = () => live[Math.floor(Math.random() * live.length)];
    // who's been standing around out on the lake (for Mr. Sir and the Warden)
    for (const p of players) { const m = R.pm[p.id] || (R.pm[p.id] = { idle: 0, warned: 0 }); if (p.an === 0 && p.cy < 0 && !p.dn && !inCamp(p.x, p.z)) m.idle += dt; else { m.idle = 0; m.warned = 0; } }
    if (live.length) {
      if (has('hatch') && count('hatch') < 26 && tick('hatch', 50 / Math.sqrt(live.length) / cmul / (o.mood === 'breeding' ? 2 : 1))) { const p = pickP(), g = roSpawn(R, 'hatch', p, 10, 16, { life: 30 }); if (g) for (let i = 0; i < 3; i++) R.mobs.push({ id: R.nid++, k: 'hatch', x: g.x + (Math.random() - 0.5) * 2, z: g.z + (Math.random() - 0.5) * 2, h: 0, y: 0, st: 0, t: 0, cd: 0, life: 30 }); }
      if (has('snake') && count('snake') < 3 + 2 * live.length && tick('snake', 22 / cmul)) roSpawn(R, 'snake', pickP(), 14, 34, { life: 150 });
      if (has('scorp')) for (const p of live) if (p.an === 2 && count('scorp') < 6 + live.length && Math.random() < 0.15 * cmul * dt) roSpawn(R, 'scorp', p, 1.4, 2.2, { life: 25 });
      if (has('sir') && !night && !count('sir')) roSpawn(R, 'sir', pickP(), 40, 60, {});
      if (has('warden') && !night && !count('warden')) roSpawn(R, 'warden', pickP(), 50, 70, {});
      const kt = live.filter(p => p.kt);
      if (has('sheriff') && (t > cur - DAYMS * (o.sheriffWin == null ? 0.15 : o.sheriffWin) || R.force.includes('sheriff')) && kt.length && !count('sheriff')) { if (roSpawn(R, 'sheriff', kt[0], 45, 55, {})) ev.push({ k: 'sheriff' }); }
      if (has('kate') && (night || R.force.includes('kate')) && !count('kate')) { if (roSpawn(R, 'kate', pickP(), 35, 45, {})) ev.push({ k: 'kate' }); }
    }
    for (const m of R.mobs) {
      m.t += dt; m.cd = Math.max(0, m.cd - dt);
      const pool = roSmall(m.k) ? live.filter(p => !p.on) : live;   // an onion keeps the small ones off you
      const tg = nearest(pool, m.x, m.z), d = tg ? Math.hypot(tg.x - m.x, tg.z - m.z) : 1e9;
      if (m.life != null && (m.life -= dt) <= 0) m.dead = true;
      switch (m.k) {
        case 'hatch':
          if (tg && d < 14) { roChase(m, tg, 5.1, dt); if (d < 0.8 && !m.cd) { m.cd = 1.2; ev.push({ k: 'rbite', id: tg.id }); } } else { m.h += dt; m.x += Math.sin(m.h) * dt; m.z += Math.cos(m.h) * dt; }
          break;
        case 'snake':
          if (tg && d < 6 && !m.cd) { m.cd = 2.5; ev.push({ k: 'rattle', x: m.x, z: m.z }); }
          if (tg && d < 1.6 && m.st !== 1) { m.st = 1; m.cd = 4; ev.push({ k: 'strike', id: tg.id }); }
          if (m.st === 1 && m.cd <= 0) m.st = 0;
          if (tg) m.h = Math.atan2(tg.x - m.x, tg.z - m.z);
          break;
        case 'scorp':
          if (tg && d < 7) { roChase(m, tg, 2.6, dt); if (d < 0.7 && !m.cd) { m.cd = 3; ev.push({ k: 'sting', id: tg.id }); } }
          break;
        case 'sir': case 'warden': {
          if ((night && !R.force.includes(m.k)) || !live.length) { m.dead = true; break; }
          // they go after whoever is standing around; otherwise they wander between campers
          let lazy = null, li = 0; for (const p of live) { const im = R.pm[p.id]; if (im && im.idle > li && Math.hypot(p.x - m.x, p.z - m.z) < 70) { li = im.idle; lazy = p; } }
          const warnAt = m.k === 'sir' ? 6 : 5, near = m.k === 'sir' ? 18 : 25;
          m.st = 0;
          if (lazy && li > warnAt) {
            m.st = 1;
            const dd = roChase(m, lazy, m.k === 'sir' ? 3.4 : 2.8, dt, m.k === 'sir' ? 2 : 1.1), im = R.pm[lazy.id];
            if (dd < near && !im.warned) { im.warned = 1; ev.push({ k: m.k === 'sir' ? 'sirWarn' : 'wardenWarn', id: lazy.id }); }
            if (m.k === 'sir' && dd < near && li > 11) { ev.push({ k: 'confiscate', id: lazy.id }); im.idle = 0; im.warned = 0; }
            if (m.k === 'warden' && dd < 1.4) { ev.push({ k: 'down', id: lazy.id, by: 'warden' }); im.idle = 0; im.warned = 0; }
          } else { if (!m.goal || Math.hypot(m.goal.x - m.x, m.goal.z - m.z) < 3) { const p = pickP(); m.goal = { x: p.x + (Math.random() - 0.5) * 30, z: p.z + (Math.random() - 0.5) * 30 }; } roChase(m, m.goal, 2.4, dt); }
          break;
        }
        case 'sheriff': {
          const p = nearest(live.filter(q => q.kt), m.x, m.z);
          if (!p) { if (m.life == null) m.life = 4; m.st = 1; break; }
          m.st = 0; m.life = null;
          if (roChase(m, p, 5.2, dt) < 1.3) { ev.push({ k: 'down', id: p.id, by: 'sheriff' }); m.dead = true; }
          break;
        }
        case 'kate': {
          if ((!night && !R.force.includes('kate')) || !live.length) { m.dead = true; break; }
          // she only moves while nobody is looking at her (vy: where each camper's camera points)
          const watched = players.some(p => { if (p.dn || inCamp(p.x, p.z)) return false; const dx = m.x - p.x, dz = m.z - p.z, dd = Math.hypot(dx, dz); if (dd > 45) return false; const vx = -Math.sin(p.vy || 0), vz = -Math.cos(p.vy || 0); return (dx * vx + dz * vz) / (dd || 1) > 0.72; });
          m.st = watched ? 1 : 0;
          if (!watched && tg && roChase(m, tg, 8, dt) < 1.3) { ev.push({ k: 'down', id: tg.id, by: 'kate' }); const p2 = pickP(); if (p2) { const a = Math.random() * 6.3; m.x = p2.x + Math.cos(a) * 45; m.z = p2.z + Math.sin(a) * 45; } }
          break;
        }
      }
      if (roSmall(m.k) && (!tg || d > 160)) m.dead = true;
    }
    R.mobs = R.mobs.filter(m => !m.dead);
  }
  // a shovel swing (the dig key, see rosterSwing() on the client): squashes the small ones in front of you
  function rosterSwat(R, p, ev) {
    const fx = Math.sin(p.fa || 0), fz = Math.cos(p.fa || 0); let hit = false;
    for (const m of R.mobs || []) {
      const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
      if (roSmall(m.k) && d < 2.4 && (dx * fx + dz * fz) / (d || 1) > 0.2) { m.dead = true; hit = true; ev.push({ k: 'squash', kind: m.k, x: m.x, z: m.z, id: p.id }); }
    }
    if (R.mobs) R.mobs = R.mobs.filter(m => !m.dead);
    return hit;
  }
  // console/testing: put one of kind k near camper p right now (the natural spawn distances, a bit closer)
  function rosterSpawnNow(R, k, p) {
    R.mobs = R.mobs || []; R.nid = R.nid || 1;
    const D = { hatch: [8, 12, { life: 30 }], snake: [6, 10, { life: 150 }], scorp: [3, 5, { life: 25 }], sir: [20, 30, {}], sheriff: [25, 30, {}], warden: [20, 30, {}], kate: [25, 30, {}] }[k];
    if (!D) return null;
    const m = roSpawn(R, k, p, D[0], D[1], Object.assign({}, D[2]));
    if (m && k === 'hatch') for (let i = 0; i < 3; i++) R.mobs.push({ id: R.nid++, k: 'hatch', x: m.x + (Math.random() - 0.5) * 2, z: m.z + (Math.random() - 0.5) * 2, h: 0, y: 0, st: 0, t: 0, cd: 0, life: 30 });
    return m;
  }
  const packRoster = R => (R.mobs || []).map(m => [m.id, RO_KINDS.indexOf(m.k), Math.round(m.x * 100) / 100, Math.round(m.z * 100) / 100, Math.round(m.h * 100) / 100, m.st | 0]);

  /* ---- the buried town of Green Lake (public/js/89-town.js; after Greg's branch, claude/intense-change-1-test-2026-09-27-1829) ----
     A maze of dark rooms deep under the lake, a new layout every day. You get in by digging an 8 ft hole that breaks
     through (always inside OLD_TOWN on the lake, sometimes elsewhere), and out by climbing a shaft or an old well
     (you need help: a friend boosting you, a hand from the top, or a staked rope ladder) or walking up the collapsed
     stairwell. It lives off the lake map (x 2000), like the tent rooms live underground, so nothing on the lake can
     reach you down there. */
  const TOWN = { X: 2000, Z: 0, N: 6, C: 14, Y: -30, H: 4 };
  const OLD_TOWN = { x: -230, z: -250, r: 70 };   // where the old town sits under the lake: every 8 ft hole in here breaks through
  const TOWN_ROOMS = ['Schoolhouse', "Sheriff's office", 'Jail', 'General store', 'Church', "Sam's boat shed", 'Saloon', 'Post office', "Kate's house", 'Barbershop', 'Stable', 'Bank', 'Onion cellar', "Doctor's office", 'Hotel'];
  const TOWN_LOOT = ['lipstick', 'locket', 'pistol', 'sploosh', 'goldbar', 'jar', 'fossil', 'shoe', 'spoon'];
  const townCellAt = (x, z) => { const cx = Math.floor((x - TOWN.X) / TOWN.C + TOWN.N / 2), cz = Math.floor((z - TOWN.Z) / TOWN.C + TOWN.N / 2); return cx >= 0 && cz >= 0 && cx < TOWN.N && cz < TOWN.N ? cz * TOWN.N + cx : -1; };
  const townCellCenter = i => ({ x: TOWN.X + ((i % TOWN.N) - TOWN.N / 2 + 0.5) * TOWN.C, z: TOWN.Z + (Math.floor(i / TOWN.N) - TOWN.N / 2 + 0.5) * TOWN.C });
  const inTownXZ = x => x > TOWN.X - TOWN.N * TOWN.C;
  function townLayout(day) {
    const r = roRnd(day * 71 + 13), N = TOWN.N, cells = [];
    for (let i = 0; i < N * N; i++) cells.push({ i, e: 0, s: 0, name: TOWN_ROOMS[Math.floor(r() * TOWN_ROOMS.length)], flood: false, rot: false, loot: [] });
    // doors: a random maze that reaches every room, plus some extra doors; 1 in 5 is a crawlspace (crouch to get through)
    const seen = new Set([0]), stack = [0];
    while (stack.length) {
      const i = stack[stack.length - 1], cx = i % N, cz = Math.floor(i / N), nb = [];
      if (cx < N - 1 && !seen.has(i + 1)) nb.push([i + 1, 'e', i]); if (cx > 0 && !seen.has(i - 1)) nb.push([i - 1, 'e', i - 1]);
      if (cz < N - 1 && !seen.has(i + N)) nb.push([i + N, 's', i]); if (cz > 0 && !seen.has(i - N)) nb.push([i - N, 's', i - N]);
      if (!nb.length) { stack.pop(); continue; }
      const [j, side, owner] = nb[Math.floor(r() * nb.length)]; cells[owner][side] = r() < 0.2 ? 2 : 1; seen.add(j); stack.push(j);
    }
    for (const c of cells) { const cx = c.i % N, cz = Math.floor(c.i / N); if (cx < N - 1 && !c.e && r() < 0.22) c.e = 1; if (cz < N - 1 && !c.s && r() < 0.22) c.s = 1; }
    const order = cells.map(c => c.i).sort(() => r() - 0.5);
    const vault = order[0], stair = order[1], wells = [order[2], order[3]];
    cells[vault].name = "Kate's vault"; cells[vault].vault = true; cells[stair].stair = true; cells[stair].name = 'Collapsed stairwell';
    for (const w of wells) { cells[w].well = true; cells[w].name = 'Old well'; }
    for (const i of order.slice(4, 9)) cells[i].flood = true;   // (framework: flooded cellars and rotten floors are marked, not playable yet)
    for (const i of order.slice(9, 14)) cells[i].rot = true;
    let id = 0;
    for (const c of cells) {
      const n = c.vault ? 4 : Math.floor(r() * 3), cc = townCellCenter(c.i);
      for (let k = 0; k < n; k++) c.loot.push({ id: id++, type: c.vault ? 'goldbar' : TOWN_LOOT[Math.floor(r() * TOWN_LOOT.length)], x: cc.x + (r() - 0.5) * (TOWN.C - 4), z: cc.z + (r() - 0.5) * (TOWN.C - 4) });
    }
    return { day, cells, vault, stair, wells };
  }
  // which room a breach from hole (x,z) drops you into (same answer everywhere)
  const townBreachCell = (x, z, lay) => { const cand = lay.cells.filter(c => !c.vault && !c.stair && !c.well && !c.flood); return cand[Math.abs(Math.floor(x * 7.3 + z * 3.1)) % cand.length].i; };
  // does an 8 ft hole at (x,z) break through? Always in the old town; now and then anywhere else (seeded by spot + day)
  const townBreaks = (x, z, day) => Math.hypot(x - OLD_TOWN.x, z - OLD_TOWN.z) < OLD_TOWN.r || roRnd(Math.floor(x * 10) * 7919 + Math.floor(z * 10) * 104729 + day * 31)() < 0.1;

  /* ---- the Warden's mood and the curse (after Greg's branch; public/js/82-mood.js shows and applies them) ----
     One mood per day, the same for everyone (seeded by the day; bad moods get likelier as the curse rises). Day 1 is normal.
     The curse (0-100) is the crew's: it rises when campers are out past curfew or get knocked out, eases each dawn, when
     the quota's met, and when someone sings Madame Zeroni away. It spawns more monsters and hazards. */
  const MOODS = {
    normal: { name: 'A regular day', desc: 'Nothing special. Dig.' },
    heatwave: { name: 'Heatwave', desc: 'Water drains faster and the sun burns twice as fast.' },
    sandstorm: { name: 'Sandstorm', desc: 'You can barely see, and the map only works in camp.' },
    breeding: { name: 'Lizard breeding season', desc: 'Lizard hatchlings everywhere, twice as many.' },
    stingy: { name: 'Mr. Sir is in a mood', desc: 'Only 3 water refills each today.' },
    fullmoon: { name: 'Full moon', desc: 'Madame Zeroni is out all night. No police.' },
    digday: { name: 'Dig day', desc: 'Double quota, but Mr. Sir pays double.' },
    inspection: { name: 'Inspection day', desc: 'The Warden walks the lake all day. Look busy.' },
  };
  function rollMood(day, curse) {
    if (day <= 1) return 'normal';
    const r = roRnd(day * 977 + 31), c = clamp(curse || 0, 0, 100) / 100;
    const w = { normal: 3 - 2 * c, heatwave: 1 + c, sandstorm: 1 + c, breeding: 1 + c, stingy: 1 + c, fullmoon: 0.6 + c, digday: 0.8, inspection: day >= 3 ? 1 + c : 0 };
    let s = 0; for (const k in w) s += w[k]; let x = r() * s; for (const k in w) { if ((x -= w[k]) < 0) return k; } return 'normal';
  }
  const CURSE = { KO: 4, CURFEW_OUT: 5, DAWN: -3, QUOTA: -10, LULLABY: -20, SONG: 8 };

  const SIM = { CANYON, toFloor, CYCLE, DAYMS, NIGHT_SPLIT, EDGE, SELL, HEAVY, TOWERS, TOWER_RANGE, TOWER_HALF_ANGLE, COP_RANGE, COP_HALF_ANGLE, TOWER_LAMP_Y, CURFEW, CURFEW_DEF, CURFEW_LIM, setCurfew, towerTilt, towerLit, towerHeading, inBeam, towerSees, clamp, wrapT, clockT, inCamp, nearCampZone, setZone, quotaFor, carrySpeed, stepProps, stepMonsters, PHYS, GRAB, DMG, ROPE, CART,
    JAV_COUNT, JAV_HP, spawnJavHerd, stepJavelinas, whackJavelina,
    LION_HP, LION_DMG, LION_BITE_R, LION_PIN_TIME, LION_MODES, stepLion, lionSwat,
    MOODS, rollMood, CURSE,
    TOWN, OLD_TOWN, townLayout, townCellAt, townCellCenter, inTownXZ, townBreachCell, townBreaks,
    RO_KINDS, rosterFor, stepRoster, rosterSwat, rosterSpawnNow, packRoster };
  if (typeof module === 'object' && module.exports) module.exports = SIM; else root.SIM = SIM;
})(this);
