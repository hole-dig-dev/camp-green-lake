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
      for (const tk of M.trucks) stepTruck(tk, outs, dt, ev);
    }
    if (want === 'zeroni') {
      if (!M.zer) { const p = nearest(outs.filter(p => !p.dn), 0, 40) || outs[0]; M.zer = { x: 0, z: -40, tgt: null, blink: 10, talk: 1.5, drag: null }; place(M.zer, p, 45, false); ev.push({ k: 'zspawn' }); }
      stepZeroni(M.zer, outs, dt, ev);
    }
  }
  function nearest(list, x, z) { let b = null, bd = 1e9; for (const p of list) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } } return b; }
  function pickPatrol(tk, outs) {
    const c = nearest(outs.filter(p => !p.dn), tk.x, tk.z) || outs[0] || { x: 0, z: -40 };
    for (let k = 0; k < 12; k++) { const x = clamp(c.x + (Math.random() - 0.5) * 170, -EDGE + 6, EDGE - 6), z = clamp(c.z + (Math.random() - 0.5) * 170, -EDGE + 6, EDGE - 6); if (!nearCampZone(x, z)) { tk.tx = x; tk.tz = z; return; } }
    tk.tx = 0; tk.tz = -40;
  }
  function stepTruck(tk, outs, dt, ev) {
    let seenP = null, seenD = 1e9;
    for (const p of outs) {
      if (p.dn) continue;
      const dx = p.x - tk.x, dz = p.z - tk.z, d = Math.hypot(dx, dz), cosA = d > 0.01 ? (dx * -Math.sin(tk.h) + dz * -Math.cos(tk.h)) / d : 1;
      const range = 55 * (p.cr ? 0.6 : 1), seen = !p.hd && ((cosA > 0.85 && d < range) || d < (p.cr ? 5 : 11));
      if (seen && d < seenD) { seenD = d; seenP = p; }
    }
    if (seenP) { if (tk.mode !== 'chase' || tk.tgt !== seenP.id) ev.push({ k: 'spot', id: seenP.id }); tk.mode = 'chase'; tk.tgt = seenP.id; tk.tx = seenP.x; tk.tz = seenP.z; tk.lost = 0; }
    else if (tk.mode === 'chase' && (tk.lost += dt) > 4) { if (tk.tgt != null) ev.push({ k: 'lost', id: tk.tgt }); tk.mode = 'patrol'; tk.tgt = null; pickPatrol(tk, outs); }
    if (tk.mode === 'patrol' && Math.hypot(tk.tx - tk.x, tk.tz - tk.z) < 8) pickPatrol(tk, outs);
    let dh = Math.atan2(-(tk.tx - tk.x), -(tk.tz - tk.z)) - tk.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); tk.h += clamp(dh, -1.6 * dt, 1.6 * dt);
    const sp = tk.mode === 'chase' ? 7 : 5.2, nx = clamp(tk.x - Math.sin(tk.h) * sp * dt, -EDGE + 3, EDGE - 3), nz = clamp(tk.z - Math.cos(tk.h) * sp * dt, -EDGE + 3, EDGE - 3);
    if (!inCamp(nx, nz)) { tk.x = nx; tk.z = nz; }
    for (const p of outs) if (!p.dn && Math.hypot(p.x - tk.x, p.z - tk.z) < 2.8) ev.push({ k: 'down', id: p.id, by: 'police' });
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
  function stepZeroni(z, outs, dt, ev) {
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
      if (t < DAYMS && J.natCooldown <= 0) {
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

  const SIM = { CYCLE, DAYMS, NIGHT_SPLIT, EDGE, SELL, HEAVY, clamp, wrapT, clockT, inCamp, nearCampZone, quotaFor, carrySpeed, stepProps, stepMonsters, JAV_COUNT, JAV_HP, spawnJavHerd, stepJavelinas, whackJavelina };
  if (typeof module === 'object' && module.exports) module.exports = SIM; else root.SIM = SIM;
})(this);
