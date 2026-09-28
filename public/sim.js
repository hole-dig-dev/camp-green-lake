/* Shared rules for Camp Green Lake. The server runs these for everyone; solo play runs the same code in the page,
   so the clock, the quota, heavy loot and the monsters behave the same either way. Positions are x/z only. */
(function (root) {
  const CYCLE = 12 * 60 * 1000, DAYMS = 9.5 * 60 * 1000, NIGHT_SPLIT = DAYMS + (CYCLE - DAYMS) / 2, EDGE = 595;
  const SELL = { x: 1.4, z: 32.6, r: 6 }; // Mr. Sir's truck: bring heavy loot here
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapT = t => ((t % CYCLE) + CYCLE) % CYCLE;
  const clockT = (c, now) => (c && c.paused ? wrapT(c.pt) : wrapT(now + (c ? c.off : 0)));
  const inCamp = (x, z) => z > 27 && z < 56 && x > -40 && x < 30;
  const nearCampZone = (x, z) => x > -46 && x < 36 && z > 12 && z < 62;
  const quotaFor = (day, n) => Math.round((60 + 40 * day) * (1 + 0.6 * Math.max(0, n - 1)));
  const HEAVY = { safe: 120, strongbox: 80 };
  // Tower optics are shared with the renderer, so the light a player sees is the light that can spot them.
  const TOWERS = [
    { x: -39, z: 28, a: -2.35 }, { x: 29, z: 28, a: 2.35 },
    { x: -39, z: 55, a: -0.79 }, { x: 29, z: 55, a: 0.79 },
  ];
  const TOWER_RANGE = 52, TOWER_HALF_ANGLE = 0.26, COP_RANGE = 50, COP_HALF_ANGLE = 0.45;
  function towerHeading(i, t) { return TOWERS[i].a + Math.sin(t / 2900 + i * 1.7) * 0.86; }
  function inBeam(x, z, ox, oz, h, range, halfAngle) {
    const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz);
    return d < range && d > 0.01 && (dx * Math.sin(h) + dz * Math.cos(h)) / d > Math.cos(halfAngle);
  }
  function towerSees(p, t) {
    return !p.hd && TOWERS.some((o, i) => inBeam(p.x, p.z, o.x, o.z, towerHeading(i, t), TOWER_RANGE, TOWER_HALF_ANGLE));
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
  function stepMonsters(M, players, t, dt, ev) {
    const night = t >= DAYMS, half = t < NIGHT_SPLIT ? 'police' : 'zeroni';
    const outs = players.filter(p => !inCamp(p.x, p.z));
    const want = night && outs.length ? half : null;
    if (want !== 'police') M.trucks = [];
    if (want !== 'zeroni') M.zer = null;
    if (want === 'police') {
      if (!M.trucks.length) M.trucks = [0, 1].map(i => { const tk = { x: i ? -32 : 22, z: 8, h: 0, mode: 'patrol', lost: 0, tx: 0, tz: -40, tgt: null }; pickPatrol(tk, outs); return tk; });
      for (const tk of M.trucks) stepTruck(tk, outs, t, dt, ev);
    }
    if (want === 'zeroni') {
      if (!M.zer) { const p = nearest(outs.filter(p => !p.dn), 0, 40) || outs[0]; M.zer = { x: 0, z: -40, tgt: null, blink: 10, talk: 1.5, drag: null }; place(M.zer, p, 45, false); ev.push({ k: 'zspawn' }); }
      stepZeroni(M.zer, outs, t, dt, ev);
    }
  }
  function nearest(list, x, z) { let b = null, bd = 1e9; for (const p of list) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } } return b; }
  function pickPatrol(tk, outs) {
    const c = nearest(outs.filter(p => !p.dn), tk.x, tk.z) || outs[0] || { x: 0, z: -40 };
    for (let k = 0; k < 12; k++) { const x = clamp(c.x + (Math.random() - 0.5) * 170, -EDGE + 6, EDGE - 6), z = clamp(c.z + (Math.random() - 0.5) * 170, -EDGE + 6, EDGE - 6); if (!nearCampZone(x, z)) { tk.tx = x; tk.tz = z; return; } }
    tk.tx = 0; tk.tz = -40;
  }
  function stepTruck(tk, outs, t, dt, ev) {
    let seenP = null, seenD = 1e9;
    for (const p of outs) {
      if (p.dn) continue;
      const d = Math.hypot(p.x - tk.x, p.z - tk.z);
      const seen = !p.hd && (towerSees(p, t) || inBeam(p.x, p.z, tk.x, tk.z, tk.h + Math.PI, COP_RANGE, COP_HALF_ANGLE));
      if (seen && d < seenD) { seenD = d; seenP = p; }
    }
    if (seenP) { if (tk.mode !== 'chase' || tk.tgt !== seenP.id) ev.push({ k: 'spot', id: seenP.id }); tk.mode = 'chase'; tk.tgt = seenP.id; tk.tx = seenP.x; tk.tz = seenP.z; tk.lost = 0; }
    else if (tk.mode === 'chase' && (tk.lost += dt) > 4) { if (tk.tgt != null) ev.push({ k: 'lost', id: tk.tgt }); tk.mode = 'patrol'; tk.tgt = null; pickPatrol(tk, outs); }
    if (tk.mode === 'patrol' && Math.hypot(tk.tx - tk.x, tk.tz - tk.z) < 8) pickPatrol(tk, outs);
    let dh = Math.atan2(-(tk.tx - tk.x), -(tk.tz - tk.z)) - tk.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); tk.h += clamp(dh, -1.6 * dt, 1.6 * dt);
    const sp = tk.mode === 'chase' ? 7 : 5.2, nx = clamp(tk.x - Math.sin(tk.h) * sp * dt, -EDGE + 3, EDGE - 3), nz = clamp(tk.z - Math.cos(tk.h) * sp * dt, -EDGE + 3, EDGE - 3);
    if (!inCamp(nx, nz)) { tk.x = nx; tk.z = nz; }
    for (const p of outs) if (!p.dn && !p.hd && Math.hypot(p.x - tk.x, p.z - tk.z) < 2.8 &&
      (towerSees(p, t) || inBeam(p.x, p.z, tk.x, tk.z, tk.h + Math.PI, COP_RANGE, COP_HALF_ANGLE)))
      ev.push({ k: 'down', id: p.id, by: 'police' });
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
    for (const p of outs) { if (p.dn || !towerSees(p, t)) continue; const s = Math.hypot(p.x - z.x, p.z - z.z) - (p.nz || 0) * 40; if (s < best) { best = s; tgt = p; } }
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

  const SIM = { CYCLE, DAYMS, NIGHT_SPLIT, EDGE, SELL, HEAVY, TOWERS, TOWER_RANGE, TOWER_HALF_ANGLE, COP_RANGE, COP_HALF_ANGLE, towerHeading, inBeam, towerSees, clamp, wrapT, clockT, inCamp, nearCampZone, quotaFor, carrySpeed, stepProps, stepMonsters };
  if (typeof module === 'object' && module.exports) module.exports = SIM; else root.SIM = SIM;
})(this);
