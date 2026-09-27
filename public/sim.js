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
  const DAYS = 5; // a sentence is 5 days; the curfew comes earlier every day
  const curfewT = day => DAYMS - (clamp(day, 1, DAYS) - 1) * 35000;
  const quotaFor = (day, n, sentence, mood) => { let q = (80 + 60 * day) * (1 + 0.45 * (clamp(n, 1, 8) - 1)) * (1 + 0.25 * ((sentence || 1) - 1)); if (mood === 'digday') q *= 2; return Math.round(q / 5) * 5; };
  const nightSplit = (cur, curse, mood) => mood === 'fullmoon' ? cur : cur + (CYCLE - cur) / 2 * (1 - clamp(curse, 0, 100) / 200);
  // the Warden's mood: one rule for the whole day and night
  const MOODS = {
    normal: { name: 'A regular day', desc: 'Nothing special. Dig.' },
    heatwave: { name: 'Heatwave', desc: 'Water drains faster and the sun burns twice as fast.' },
    sandstorm: { name: 'Sandstorm', desc: 'You can barely see. The map only works at the Lookout post.' },
    breeding: { name: 'Lizard breeding season', desc: 'Twice as many lizard nests in the holes.' },
    stingy: { name: 'Mr. Sir is in a mood', desc: 'Only 3 water refills each today.' },
    fullmoon: { name: 'Full moon', desc: 'Madame Zeroni is out all night. No police.' },
    digday: { name: 'Dig day', desc: 'Double quota, but Mr. Sir pays double.' },
    inspection: { name: 'Inspection day', desc: 'The Warden walks the lake all day. Look busy.' },
    swarm: { name: 'Hatching day', desc: 'Lizard hatchlings everywhere, twice as many.' },
  };
  // dig sites the Warden assigns: farther means richer and more dangerous
  const SITES = {
    near: { name: 'Near camp', x: 0, z: -40, r: 90, mult: 1.2 },
    ruins: { name: "Kate's old town ruins", x: -300, z: -230, r: 110, mult: 1.5 },
    thumb: { name: 'Big Thumb flats', x: 170, z: -400, r: 120, mult: 1.9 },
  };
  function rnd(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pickW(r, w) { let s = 0; for (const k in w) s += w[k]; let x = r() * s; for (const k in w) { if ((x -= w[k]) < 0) return k; } return Object.keys(w)[0]; }
  function rollDay(seed, day, curse, sentence) {
    const r = rnd(seed * 31 + day * 977), c = clamp(curse, 0, 100) / 100;
    const hard = (sentence || 1) >= 2 ? 1 : 0;
    const mood = day === 1 ? 'normal' : pickW(r, { normal: 3 - 2 * c, heatwave: 1 + c, sandstorm: 1 + c, breeding: 1 + c, stingy: 1 + c, fullmoon: 0.6 + c, digday: 0.8, inspection: hard * (1 + c), swarm: hard * (1 + c) });
    const site = pickW(r, { near: [5, 3, 2, 1, 1][day - 1] || 1, ruins: [1, 3, 3, 3, 2][day - 1] || 2, thumb: [0.2, 1, 2, 3, 4][day - 1] || 4 });
    return { mood, site };
  }
  const HEAVY = { safe: 120, strongbox: 80 };
  // gear bought from the crew's shared seeds
  const SHOP = { spade: 45, long: 110, detector: 70, canteen: 30, bigsack: 60, rope: 35, onion: 8, battery: 6, tonic: 20, newshovel: 12 };

  /* ---- heavy loot: one camper drags it slowly, two or more carry it at a walk ---- */
  function carrySpeed(n, type) { return n >= 2 ? 3.5 : type === 'body' ? 2.2 : 1.2; }
  // props: {id:{type,x,z,n}}; players: [{id,x,z,cy,dn}]. Returns ids that reached Mr. Sir's truck.
  function stepProps(props, players, dt) {
    const sold = [];
    for (const id in props) {
      const pr = props[id];
      const cs = pr.cargo ? [] : players.filter(p => p.cy === +id && !p.dn && Math.hypot(p.x - pr.x, p.z - pr.z) < 3.4);
      pr.n = cs.length + cs.filter(p => p.br).length; // a wheelbarrow counts as a second pair of hands
      pr.who = cs.map(p => p.id);
      if (cs.length) {
        let ax = 0, az = 0; for (const p of cs) { ax += p.x; az += p.z; } ax /= cs.length; az /= cs.length;
        const dx = ax - pr.x, dz = az - pr.z, d = Math.hypot(dx, dz);
        if (d > 1.1) { const s = Math.min(d - 1.1, carrySpeed(pr.n, pr.type) * 1.4 * dt); pr.x += dx / d * s; pr.z += dz / d * s; pr.moved = true; }
      }
      // heavy loot is sold at Mr. Sir's truck; a friend's body only has to make it back inside the fence
      if (pr.type === 'body' ? inCamp(pr.x, pr.z) : Math.hypot(pr.x - SELL.x, pr.z - SELL.z) < SELL.r) sold.push(id);
    }
    return sold;
  }

  /* ---- monsters: police trucks until 01:00, then Madame Zeroni until dawn ---- */
  // M: {trucks:[], zer:null}. players: [{id,x,z,fa,cr,hd,dn,nz}]. t: clock. ev: events out.
  // ---- the day's monster roster: which kinds show up is random each day, and it grows with the day and the curse ----
  const SMALL = ['hatch', 'snake', 'scorp', 'vulture'], MEDIUM = ['sir', 'sheriff'], BIG = ['kate', 'warden'];
  const KIND = ['hatch', 'snake', 'scorp', 'vulture', 'sir', 'sheriff', 'kate', 'warden', 'trout', 'queen'];
  function roster(seed, day, curse) {
    const r = rnd(seed * 7 + day * 131), c = clamp(curse, 0, 100);
    const take = (list, n) => { const a = list.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };
    const ns = Math.min(4, 1 + Math.floor(day / 2) + Math.floor(c / 40)), nm = day >= 2 ? (day >= 4 ? 2 : 1) : 0, nb = day >= 3 ? (day >= 5 || c >= 60 ? 2 : 1) : 0;
    return [...take(SMALL, ns), ...take(MEDIUM, nm), ...take(BIG, nb)];
  }
  function stepMonsters(M, players, t, dt, ev, opt) {
    opt = opt || {}; const cur = opt.curfew || DAYMS, split = opt.split || NIGHT_SPLIT, run = opt.run || { seed: 1, day: 1, curse: 0, mood: 'normal' };
    const night = t >= cur, half = t < split ? 'police' : 'zeroni';
    const lake = players.filter(p => !p.tn), outs = lake.filter(p => !inCamp(p.x, p.z));
    if (!night) M.appeased = false;
    const want = night && outs.length && !opt.finale ? (half === 'zeroni' && M.appeased ? null : half) : null;
    // a stolen (or overdue) water truck: the police come after it, day or night
    if (opt.wanted) { stepWanted(M, opt.wanted, dt, ev); } else if (want !== 'police' && M.trucks.some(k => k.wanted)) M.trucks = [];
    if (want !== 'police' && !opt.wanted) M.trucks = [];
    if (want !== 'zeroni') M.zer = null;
    if (want === 'police' && !opt.wanted) {
      if (!M.trucks.length) M.trucks = [0, 1].map(i => { const tk = { x: i ? -32 : 22, z: 8, h: 0, mode: 'patrol', lost: 0, tx: 0, tz: -40, tgt: null }; pickPatrol(tk, outs); return tk; });
      for (const tk of M.trucks) stepTruck(tk, outs, dt, ev);
    }
    if (want === 'zeroni') {
      if (!M.zer) { const p = nearest(outs.filter(p => !p.dn), 0, 40) || outs[0]; M.zer = { x: 0, z: -40, tgt: null, blink: 10, talk: 1.5, drag: null, song: 0 }; place(M.zer, p, 45, false); ev.push({ k: 'zspawn' }); }
      stepZeroni(M.zer, outs, dt, ev, lake);
      if (M.zer && M.zer.song >= (lake.length > 1 ? 10 : 8)) { ev.push({ k: 'appeased', x: M.zer.x, z: M.zer.z }); M.zer = null; M.appeased = true; }
    }
    stepMobs(M, lake, outs, t, dt, ev, { cur, night, run, n: players.length });
    if (opt.town) opt.town(M, players.filter(p => p.tn), dt, ev);
  }
  // campers standing around doing nothing out on the lake (for Mr. Sir and the Warden)
  function idleOf(M, p, dt) { const m = M.pm[p.id] || (M.pm[p.id] = { idle: 0, warned: 0 }); if (p.a === 0 && p.cy < 0 && !p.dn && !inCamp(p.x, p.z)) m.idle += dt; else { m.idle = 0; m.warned = 0; } return m; }
  const lonely = (p, all) => !all.some(o => o !== p && !o.dn && Math.hypot(o.x - p.x, o.z - p.z) < 25);
  function spawnNear(M, k, p, dmin, dmax, extra) {
    for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin), x = clamp(p.x + Math.cos(a) * d, -EDGE + 3, EDGE - 3), z = clamp(p.z + Math.sin(a) * d, -EDGE + 3, EDGE - 3); if (!nearCampZone(x, z)) { const m = Object.assign({ id: M.nid++, k, x, z, h: 0, y: 0, st: 0, t: 0, cd: 0 }, extra || {}); M.mobs.push(m); return m; } }
    return null;
  }
  function chase(m, p, sp, dt, stop) { const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz) || 0.01; if (d > (stop || 0)) { const s = Math.min(d - (stop || 0), sp * dt); const nx = m.x + dx / d * s, nz = m.z + dz / d * s; if (!inCamp(nx, nz)) { m.x = nx; m.z = nz; } } m.h = Math.atan2(dx, dz); return d; }
  function stepMobs(M, lake, outs, t, dt, ev, o) {
    M.mobs = M.mobs || []; M.pm = M.pm || {}; M.nid = M.nid || 1; M.sp = M.sp || {};
    const key = o.run.seed + ':' + o.run.day + ':' + Math.floor(o.run.curse / 20);
    if (M.rkey !== key) { M.rkey = key; M.roster = roster(o.run.seed, o.run.day, o.run.curse); }
    const has = k => M.roster.includes(k) || (k === 'warden' && o.run.mood === 'inspection') || (k === 'hatch' && o.run.mood === 'swarm'), c = clamp(o.run.curse, 0, 100) / 100, live = outs.filter(p => !p.dn), count = k => M.mobs.filter(m => m.k === k).length;
    const tick = (k, every) => { if (M.sp[k] == null) M.sp[k] = every * Math.random(); M.sp[k] -= dt; if (M.sp[k] <= 0) { M.sp[k] = every; return true; } return false; };
    const pickP = () => live[Math.floor(Math.random() * live.length)];
    for (const p of lake) idleOf(M, p, dt);
    if (live.length) {
      if (has('hatch') && count('hatch') < 26 && tick('hatch', 50 / (1 + c) / Math.sqrt(live.length) / (o.run.mood === 'swarm' ? 2 : 1))) { const p = pickP(), g = spawnNear(M, 'hatch', p, 10, 16, { life: 30 }); if (g) for (let i = 0; i < 3 + Math.floor(c * 3); i++) M.mobs.push({ id: M.nid++, k: 'hatch', x: g.x + (Math.random() - 0.5) * 2, z: g.z + (Math.random() - 0.5) * 2, h: 0, y: 0, st: 0, t: 0, cd: 0, life: 30 }); }
      if (has('snake') && count('snake') < 3 + 2 * live.length && tick('snake', 22)) spawnNear(M, 'snake', pickP(), 14, 34, { life: 150 });
      // Sam's onion fields always have snakes in the grass, whatever the day's roster
      const inField = live.filter(p => Math.hypot(p.x - 170, p.z + 420) < 120);
      if (inField.length && count('snake') < 6 + 2 * live.length && tick('fsnake', 9)) spawnNear(M, 'snake', inField[Math.floor(Math.random() * inField.length)], 8, 22, { life: 120 });
      if (has('scorp')) for (const p of live) if (p.a === 2 && count('scorp') < 6 + live.length && Math.random() < 0.15 * (1 + c) * dt) spawnNear(M, 'scorp', p, 1.4, 2.2, { life: 25 });
      if (has('vulture') && count('vulture') < 2 + Math.floor(c * 2) && tick('vulture', 30)) { const lone = live.filter(p => lonely(p, lake)).concat(outs.filter(p => p.dn)); if (lone.length) { const p = lone[Math.floor(Math.random() * lone.length)]; const v = spawnNear(M, 'vulture', p, 30, 40, { y: 14, tgt: p.id, life: 60 }); if (v) ev.push({ k: 'caw', x: v.x, z: v.z }); } }
      if (has('sir') && !o.night && !count('sir')) spawnNear(M, 'sir', pickP(), 40, 60, {});
      if (has('warden') && !o.night && !count('warden')) spawnNear(M, 'warden', pickP(), 50, 70, {});
      const kt = live.filter(p => p.kt);
      if (has('sheriff') && t > o.cur - 90000 && kt.length && !count('sheriff')) { const s = spawnNear(M, 'sheriff', kt[0], 45, 55, {}); if (s) ev.push({ k: 'sheriff' }); }
      if (has('kate') && o.night && !count('kate')) { const kk = spawnNear(M, 'kate', pickP(), 35, 45, {}); if (kk) ev.push({ k: 'kate' }); }
    }
    for (const m of M.mobs) {
      m.t += dt; m.cd = Math.max(0, m.cd - dt);
      const pool = (m.k === 'hatch' || m.k === 'snake' || m.k === 'scorp') ? live.filter(p => !p.on) : live;
      const tg = nearest(pool, m.x, m.z), d = tg ? Math.hypot(tg.x - m.x, tg.z - m.z) : 1e9;
      if (m.life != null && (m.life -= dt) <= 0) m.dead = true;
      switch (m.k) {
        case 'hatch':
          if (tg && d < 14) { chase(m, tg, 5.1, dt); if (d < 0.8 && !m.cd) { m.cd = 1.2; ev.push({ k: 'bite', id: tg.id }); } } else { m.h += dt; m.x += Math.sin(m.h) * dt; m.z += Math.cos(m.h) * dt; }
          break;
        case 'snake':
          if (!live.length) m.dead = true;
          if (tg && d < 6 && !m.cd) { m.cd = 2.5; ev.push({ k: 'rattle', x: m.x, z: m.z }); }
          if (tg && d < 1.6 && m.st !== 1) { m.st = 1; m.cd = 4; ev.push({ k: 'strike', id: tg.id }); }
          if (m.st === 1 && m.cd <= 0) m.st = 0;
          if (tg) m.h = Math.atan2(tg.x - m.x, tg.z - m.z);
          break;
        case 'scorp':
          if (tg && d < 7) { chase(m, tg, 2.6, dt); if (d < 0.7 && !m.cd) { m.cd = 3; ev.push({ k: 'sting', id: tg.id }); } }
          break;
        case 'vulture': {
          const p = outs.find(q => q.id === m.tgt);
          if (!p || (!p.dn && !lonely(p, lake)) || p.lt) m.st = 2;
          if (m.st === 0) { m.a = (m.a || 0) + dt * 0.8; m.x = p.x + Math.cos(m.a) * 8; m.z = p.z + Math.sin(m.a) * 8; m.h = m.a + Math.PI / 2; m.y = 12; if (m.t > 12) m.st = 1; }
          else if (m.st === 1) { const dd = chase(m, p, 11, dt); m.y = Math.max(1, m.y - 8 * dt); if (dd < 1.4 && m.y < 2) { ev.push({ k: 'peck', id: p.id, dn: !!p.dn }); m.st = 2; } }
          else { m.y += 6 * dt; m.x += Math.sin(m.h) * 8 * dt; m.z += Math.cos(m.h) * 8 * dt; if (m.y > 30) m.dead = true; }
          break;
        }
        case 'sir': case 'warden': {
          if (o.night || !live.length) { m.dead = true; break; }
          // they go after whoever is standing around; otherwise they wander between campers
          let lazy = null, li = 0; for (const p of live) { const im = M.pm[p.id]; if (im && im.idle > li && Math.hypot(p.x - m.x, p.z - m.z) < 70) { li = im.idle; lazy = p; } }
          const warnAt = m.k === 'sir' ? 6 : 5, near = m.k === 'sir' ? 18 : 25;
          if (lazy && li > warnAt) {
            const dd = chase(m, lazy, m.k === 'sir' ? 3.4 : 2.8, dt, m.k === 'sir' ? 2 : 1.1), im = M.pm[lazy.id];
            if (dd < near && !im.warned) { im.warned = 1; ev.push({ k: m.k === 'sir' ? 'sirWarn' : 'wardenWarn', id: lazy.id }); }
            if (m.k === 'sir' && dd < near && li > 11) { ev.push({ k: 'confiscate', id: lazy.id }); im.idle = 0; im.warned = 0; }
            if (m.k === 'warden' && dd < 1.4) { ev.push({ k: 'down', id: lazy.id, by: 'warden' }); im.idle = 0; im.warned = 0; }
          } else { if (!m.goal || Math.hypot(m.goal.x - m.x, m.goal.z - m.z) < 3) { const p = pickP(); m.goal = { x: p.x + (Math.random() - 0.5) * 30, z: p.z + (Math.random() - 0.5) * 30 }; } chase(m, m.goal, 2.4, dt); }
          break;
        }
        case 'sheriff': {
          const p = nearest(live.filter(q => q.kt), m.x, m.z);
          if (!p) { if (m.life == null) m.life = 4; m.st = 1; break; }
          m.st = 0; m.life = null;
          if (chase(m, p, 5.2, dt) < 1.3) { ev.push({ k: 'down', id: p.id, by: 'sheriff' }); m.dead = true; }
          break;
        }
        case 'kate': {
          if (!o.night || !live.length) { m.dead = true; break; }
          // she only moves while nobody is looking at her
          const watched = lake.some(p => { if (p.dn) return false; const dx = m.x - p.x, dz = m.z - p.z, dd = Math.hypot(dx, dz); if (dd > 45) return false; const vx = -Math.sin(p.vy || 0), vz = -Math.cos(p.vy || 0); return (dx * vx + dz * vz) / (dd || 1) > 0.72; });
          m.st = watched ? 1 : 0;
          if (!watched && tg && chase(m, tg, 8, dt) < 1.3) { ev.push({ k: 'down', id: tg.id, by: 'kate' }); const p2 = pickP(); if (p2) { const a = Math.random() * 6.3; m.x = p2.x + Math.cos(a) * 45; m.z = p2.z + Math.sin(a) * 45; } }
          break;
        }
      }
      if ((m.k === 'hatch' || m.k === 'snake' || m.k === 'scorp') && (!tg || d > 160)) m.dead = true;
    }
    M.mobs = M.mobs.filter(m => !m.dead);
  }
  // shovel bonk: squashes small critters in front of you and scares off a diving vulture
  function bonk(M, p, ev) {
    const fx = Math.sin(p.fa || 0), fz = Math.cos(p.fa || 0);
    for (const m of M.mobs || []) {
      const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
      if ((m.k === 'hatch' || m.k === 'snake' || m.k === 'scorp') && d < 2.4 && (dx * fx + dz * fz) / (d || 1) > 0.2) { m.dead = true; ev.push({ k: 'squash', kind: m.k, x: m.x, z: m.z, id: p.id }); }
      if (m.k === 'vulture' && d < 5 && m.y < 6) { m.st = 2; ev.push({ k: 'shoo', x: m.x, z: m.z }); }
    }
    if (M.mobs) M.mobs = M.mobs.filter(m => !m.dead);
  }
  const packMobs = M => (M.mobs || []).map(m => [m.id, KIND.indexOf(m.k), Math.round(m.x * 100) / 100, Math.round(m.z * 100) / 100, Math.round(m.h * 100) / 100, Math.round((m.y || 0) * 10) / 10, m.st | 0]);
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
  function stepZeroni(z, outs, dt, ev, lake) {
    // the way to beat her, like Elya was supposed to: sing her the lullaby, and pick her up and carry her
    const all = lake || outs, singers = all.filter(p => p.sg && !p.dn && Math.hypot(p.x - z.x, p.z - z.z) < 14).length, carriers = all.filter(p => p.cy === -2 && !p.dn && Math.hypot(p.x - z.x, p.z - z.z) < 2.6).length;
    if (singers || carriers) z.song = (z.song || 0) + dt * (singers + carriers); else z.song = Math.max(0, (z.song || 0) - dt * 0.5);
    z.held = carriers > 0;
    if (z.held) { z.talk -= dt; if (z.talk <= 0) { z.talk = 4; ev.push({ k: 'talk' }); } return; }
    // dragging someone off toward the edge of the lake; a friend reviving them makes her let go
    if (z.drag != null) {
      const v = outs.find(p => p.id === z.drag);
      if (!v || !v.dn) { ev.push({ k: 'drop', id: z.drag }); z.drag = null; const o = nearest(outs.filter(p => !p.dn), z.x, z.z); if (o) place(z, o, 40, false); z.blink = 10; return; }
      const ex = Math.abs(z.x) > Math.abs(z.z) ? Math.sign(z.x) : 0, ez = ex ? 0 : Math.sign(z.z) || 1;
      z.x = clamp(z.x + ex * 2 * dt, -EDGE, EDGE); z.z = clamp(z.z + ez * 2 * dt, -EDGE, EDGE);
      if (Math.max(Math.abs(z.x), Math.abs(z.z)) >= EDGE - 1) { ev.push({ k: 'gone', id: z.drag }); z.drag = null; }
      return;
    }
    // she goes after whoever is closest; noise counts like being 40 m closer, and being alone like 35 m closer
    let tgt = null, best = 1e9;
    for (const p of outs) { if (p.dn) continue; const s = Math.hypot(p.x - z.x, p.z - z.z) - (p.nz || 0) * 40 - (lonely(p, all) ? 35 : 0); if (s < best) { best = s; tgt = p; } }
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

  // ---- the buried town of Green Lake: a new layout of dark rooms under the lake every day ----
  // Big Thumb: a mound with a stone thumb on top; the finale is carrying Madame Zeroni up it while the lake floods
  const THUMB = { x: 170, z: -500, r: 8, y0: 14, h: 50, mound: 32, ledges: [26, 38, 50] };
  const waterAt = (fin, now) => !fin || !fin.waterAt ? -2 : -1 + (now - fin.waterAt) / 1000 * 0.3;
  const TOWN = { X: 2000, Z: 0, N: 6, C: 14, Y: -30, H: 4 };
  const ROOM_NAMES = ['Schoolhouse', "Sheriff's office", 'Jail', 'General store', 'Church', "Sam's boat shed", 'Saloon', 'Post office', "Kate's house", 'Barbershop', 'Stable', 'Bank', 'Onion cellar', 'Doctor\'s office', 'Hotel'];
  const TLOOT = ['lipstick', 'locket', 'pistol', 'sploosh', 'goldbar', 'jar', 'fossil', 'shoe', 'spoon'];
  const cellAt = (x, z) => { const cx = Math.floor((x - TOWN.X) / TOWN.C + TOWN.N / 2), cz = Math.floor((z - TOWN.Z) / TOWN.C + TOWN.N / 2); return cx >= 0 && cz >= 0 && cx < TOWN.N && cz < TOWN.N ? cz * TOWN.N + cx : -1; };
  const cellCenter = i => ({ x: TOWN.X + ((i % TOWN.N) - TOWN.N / 2 + 0.5) * TOWN.C, z: TOWN.Z + (Math.floor(i / TOWN.N) - TOWN.N / 2 + 0.5) * TOWN.C });
  const inTownXZ = x => x > TOWN.X - TOWN.N * TOWN.C;
  function townLayout(seed, day) {
    const r = rnd(seed * 13 + day * 71), N = TOWN.N, cells = [];
    for (let i = 0; i < N * N; i++) cells.push({ i, e: 0, s: 0, name: ROOM_NAMES[Math.floor(r() * ROOM_NAMES.length)], flood: false, rot: false, loot: [] });
    // doors: a random maze that reaches every room, plus some extra doors; some doors are crawlspaces (crouch to pass)
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
    const treasure = order[0], stair = order[1], wells = [order[2], order[3]];
    cells[treasure].name = "Kate's vault"; cells[treasure].treasure = true; cells[stair].stair = true; cells[stair].name = 'Collapsed stairwell';
    for (const w of wells) { cells[w].well = true; cells[w].name = 'Old well'; }
    for (const i of order.slice(4, 9)) cells[i].flood = true;
    for (const i of order.slice(9, 14)) cells[i].rot = true;
    let id = 0;
    for (const c of cells) {
      const n = c.treasure ? 4 : c.flood ? 3 : Math.floor(r() * 3), cc = cellCenter(c.i);
      for (let k = 0; k < n; k++) c.loot.push({ id: 20000 + (day % 50) * 400 + id++, type: c.treasure && k === 0 ? 'strongbox' : c.treasure ? 'goldbar' : TLOOT[Math.floor(r() * TLOOT.length)], x: cc.x + (r() - 0.5) * (TOWN.C - 4), z: cc.z + (r() - 0.5) * (TOWN.C - 4) });
    }
    return { seed, day, cells, treasure, stair, wells };
  }
  // where a hole that breaks through lands you: a room picked from the hole's position
  const breachCell = (x, z, lay) => { const cand = lay.cells.filter(c => !c.treasure && !c.stair && !c.well && !c.flood); return cand[Math.abs(Math.floor(x * 7.3 + z * 3.1)) % cand.length].i; };
  // Trout Walker's torch mob (hunts anyone with a light on) and the lizard queen (guards Kate's vault)
  function stepTown(M, tps, dt, ev, lay, day) {
    M.town = M.town || { key: '' };
    const key = lay.seed + ':' + lay.day;
    if (M.town.key !== key) { M.town = { key, mobs: [] }; }
    const T_ = M.town, live = tps.filter(p => !p.dn);
    if (!tps.length) { M.mobs = (M.mobs || []).filter(m => m.k !== 'trout' && m.k !== 'queen'); return; }
    M.mobs = M.mobs || []; M.nid = M.nid || 1;
    const have = k => M.mobs.filter(m => m.k === k).length;
    if (!have('queen')) { const c = cellCenter(lay.treasure); M.mobs.push({ id: M.nid++, k: 'queen', x: c.x, z: c.z, h: 0, y: 0, st: 0, t: 0, cd: 0, home: c }); }
    const want = 1 + Math.floor(day / 2);
    while (have('trout') < want) { const c = cellCenter(lay.cells[Math.floor(Math.random() * lay.cells.length)].i); M.mobs.push({ id: M.nid++, k: 'trout', x: c.x, z: c.z, h: 0, y: 0, st: 0, t: 0, cd: 0 }); }
    for (const m of M.mobs) {
      if (m.k === 'queen') {
        // she wakes up when someone moves carelessly (not crouched) or makes noise near her
        let tgt = null, bd = 1e9; for (const p of live) { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd && d < 16 && ((p.a !== 0 && !p.cr) || p.nz > 0.5 || m.st === 1)) { bd = d; tgt = p; } }
        if (tgt && bd < 20) { if (m.st !== 1) ev.push({ k: 'queen' }); m.st = 1; m.calm = 0; if (chase(m, tgt, 6, dt) < 1.6 && !m.cd) { m.cd = 2; ev.push({ k: 'down', id: tgt.id, by: 'queen' }); } }
        else { m.calm = (m.calm || 0) + dt; if (m.calm > 4) m.st = 0; if (m.st === 0) chase(m, m.home, 1.5, dt, 0.5); }
      } else if (m.k === 'trout') {
        let tgt = null, bd = 1e9; for (const p of live) { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < bd && ((p.lt && d < 18) || d < 3)) { bd = d; tgt = p; } }
        if (tgt) { if (m.st !== 1) ev.push({ k: 'trout', id: tgt.id }); m.st = 1; if (chase(m, tgt, 4.2, dt) < 1.3 && !m.cd) { m.cd = 3; ev.push({ k: 'down', id: tgt.id, by: 'trout' }); } }
        else { m.st = 0; if (!m.goal || Math.hypot(m.goal.x - m.x, m.goal.z - m.z) < 2) m.goal = cellCenter(Math.floor(Math.random() * lay.cells.length)); chase(m, m.goal, 1.8, dt); }
      }
      m.cd = Math.max(0, (m.cd || 0) - dt);
    }
  }
  // ---- the water truck: rent it by day, hotwire it by night; overdue or stolen, the police come for it ----
  const TRUCK = { HOME: { x: 5, z: 36, h: Math.PI / 2 }, RENT: 120, SECS: 180, MAXSP: 12, COPSP: 10, TANK: 100 };
  function stepWanted(M, w, dt, ev) {
    if (!M.trucks.length || !M.trucks[0].wanted) M.trucks = [0, 1].map(i => ({ x: i ? -32 : 22, z: 8, h: 0, mode: 'chase', lost: 0, tx: w.x, tz: w.z, tgt: null, wanted: true }));
    for (const tk of M.trucks) {
      tk.mode = 'chase'; tk.tx = w.x; tk.tz = w.z;
      let dh = Math.atan2(-(tk.tx - tk.x), -(tk.tz - tk.z)) - tk.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); tk.h += clamp(dh, -2 * dt, 2 * dt);
      const nx = clamp(tk.x - Math.sin(tk.h) * TRUCK.COPSP * dt, -EDGE + 3, EDGE - 3), nz = clamp(tk.z - Math.cos(tk.h) * TRUCK.COPSP * dt, -EDGE + 3, EDGE - 3);
      if (!inCamp(nx, nz)) { tk.x = nx; tk.z = nz; }
      if (Math.hypot(tk.x - w.x, tk.z - w.z) < 4.2 && !inCamp(w.x, w.z)) { ev.push({ k: 'truckCaught' }); M.trucks = []; return; }
    }
  }

  // ---- missions (GAME_DESIGN.md): hub -> truck ride -> timed dig site -> truck leaves -> results -> hub ----
  const MISSION = {
    SECS: 540,              // time on site before the truck leaves (9 minutes)
    RIDE: 4000,             // ms of truck ride from camp to the site
    RESULTS: 12000,         // ms the results card shows before everyone is back at camp
    HORNS: [180, 60, 30, 10], // seconds left: distant horn, engine starts, repeated horn, truck rolls
    ROLL: 10,               // seconds left when the truck starts rolling away
    ROLLSP: 1.3,            // how fast it rolls (m/s): a jog catches it, a slow drag doesn't
    HALF: 75,               // the site is a square this many metres from its centre to each edge
    BED: 3.2,               // loot within this distance of the truck counts as "in the bed"
  };
  function newMission(seed, trip, now) {
    const r = rnd(seed * 17 + trip * 101);
    let cx = 0, cz = -200;
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, d = 170 + r() * 250; cx = clamp(Math.cos(a) * d, -EDGE + 90, EDGE - 90); cz = clamp(20 + Math.sin(a) * d, -EDGE + 90, EDGE - 90);
      if (!nearCampZone(cx, cz) && Math.hypot(cx - THUMB.x, cz - THUMB.z) > THUMB.mound + MISSION.HALF + 10) break;
    }
    return { phase: 'ride', site: 'flats', trip, cx, cz, half: MISSION.HALF, rideEnd: now + MISSION.RIDE, endsAt: now + MISSION.RIDE + MISSION.SECS * 1000, horn: 0 };
  }
  // pure timing: returns events for the caller (server, or the page when solo) to act on
  function stepMission(MS, now, ev) {
    if (!MS || MS.phase === 'hub') return;
    if (MS.phase === 'ride' && now >= MS.rideEnd) { MS.phase = 'site'; ev.push({ k: 'arrive' }); }
    if (MS.phase === 'site') {
      const left = (MS.endsAt - now) / 1000;
      while (MS.horn < MISSION.HORNS.length && left <= MISSION.HORNS[MS.horn]) ev.push({ k: 'horn', n: MISSION.HORNS[MS.horn++] });
      if (left <= 0) { MS.phase = 'results'; MS.resEnd = now + MISSION.RESULTS; ev.push({ k: 'depart' }); }
    }
    if (MS.phase === 'results' && now >= MS.resEnd) { MS.phase = 'hub'; ev.push({ k: 'home' }); }
  }
  const inSite = (MS, x, z) => !!MS && Math.max(Math.abs(x - MS.cx), Math.abs(z - MS.cz)) <= MS.half;

  const SIM = { CYCLE, DAYMS, NIGHT_SPLIT, EDGE, SELL, HEAVY, SHOP, DAYS, MOODS, SITES, clamp, wrapT, clockT, inCamp, nearCampZone, curfewT, quotaFor, nightSplit, rnd, rollDay, roster, KIND, carrySpeed, stepProps, stepMonsters, bonk, packMobs, TOWN, townLayout, cellAt, cellCenter, breachCell, stepTown, inTownXZ, THUMB, waterAt, TRUCK, stepWanted, MISSION, newMission, stepMission, inSite };
  if (typeof module === 'object' && module.exports) module.exports = SIM; else root.SIM = SIM;
})(this);
