/* Physics feel test (GAME_DESIGN.md sections 2, 19, 20): R.E.P.O.-style grabbing with real rigid bodies.
   The same world is built on the server (which is in charge when playing together) and in the page (solo),
   from the shared layout below, using cannon-es (passed in as C). Positions are metres; the ranch sits far east of the lake. */
(function (root) {
  const RANCH = { X: 3000, Z: 0, HALF: 30 };
  const TRUCK = { x: RANCH.X, z: RANCH.Z + 15, h: Math.PI }; // parked in the yard, tailgate facing the house
  const GRAB = {
    K: 1400,        // spring stiffness pulling the grabbed point toward your hand
    DAMP: 70,      // damping so it doesn't wobble forever
    FMAX: 700,     // most one camper can pull (N): the 120 kg safe (~1180 N) takes 2 of you to lift, the 190 kg piano 3
    SNAP: 4.2,     // if the object ends up this far from your hand, you lose your grip
    THROW: 7.5,    // how hard a throw is (m/s of velocity change for light things; heavier things fly less)
  };
  const DMG = { MIN: 2.4, RATE: 0.06, COOL: 0.25 }; // impacts faster than MIN m/s chip value off

  // the valuables: shape, size (half-extents or radius/height), mass (kg), value, and fragility (how fast bumps eat value)
  const LOOT = {
    vase: { name: 'Antique vase', shape: 'cyl', r: 0.2, h: 0.55, m: 2, val: 70, frag: 1.6, color: 0x3f7fa8 },
    jar: { name: 'Jar of Sploosh', shape: 'cyl', r: 0.14, h: 0.34, m: 1.5, val: 40, frag: 1.8, color: 0xe8a040 },
    lamp: { name: 'Oil lamp', shape: 'cyl', r: 0.12, h: 0.42, m: 1, val: 35, frag: 1.5, color: 0xc9b060 },
    radio: { name: 'Old radio', shape: 'box', hx: 0.26, hy: 0.18, hz: 0.15, m: 6, val: 80, frag: 1.0, color: 0x6a4a2a },
    bust: { name: 'Marble bust', shape: 'box', hx: 0.18, hy: 0.26, hz: 0.16, m: 14, val: 110, frag: 0.8, color: 0xe8e4dc },
    mirror: { name: 'Antique mirror', shape: 'box', hx: 0.45, hy: 0.65, hz: 0.04, m: 8, val: 120, frag: 1.7, color: 0xcfe4ee },
    clock: { name: 'Grandfather clock', shape: 'box', hx: 0.24, hy: 0.95, hz: 0.18, m: 30, val: 160, frag: 0.9, color: 0x7a4a24 },
    bell: { name: 'School bell', shape: 'cyl', r: 0.36, h: 0.55, m: 22, val: 90, frag: 0.3, color: 0xb08a3a, noisy: true },
    safe: { name: 'Iron safe', shape: 'box', hx: 0.45, hy: 0.5, hz: 0.45, m: 120, val: 300, frag: 0.15, color: 0x3b3f45 },
    piano: { name: 'Upright piano', shape: 'box', hx: 1.0, hy: 0.65, hz: 0.33, m: 190, val: 420, frag: 0.35, color: 0x2a1a10 },
    // buried in the yard (dug out of dirt mounds)
    can: { name: 'Tin of old coins', shape: 'cyl', r: 0.1, h: 0.16, m: 3, val: 55, frag: 0.4, color: 0x9a9a8a },
    fossil: { name: 'Fossil', shape: 'box', hx: 0.2, hy: 0.06, hz: 0.14, m: 4, val: 65, frag: 0.7, color: 0xcfc2a0 },
    tube: { name: 'Gold KB tube', shape: 'cyl', r: 0.05, h: 0.2, m: 0.4, val: 150, frag: 0.5, color: 0xd8b040 },
    chest: { name: 'Buried chest', shape: 'box', hx: 0.4, hy: 0.28, hz: 0.28, m: 45, val: 190, frag: 0.5, color: 0x5a3a1e },
  };

  // the ranch: static boxes {x,y,z,hx,hy,hz,c,block} (block = players can't walk through it)
  function layout() {
    const X = RANCH.X, Z = RANCH.Z, S = [], b = (x, y, z, hx, hy, hz, c, block) => S.push({ x: X + x, y, z: Z + z, hx, hy, hz, c, block: block !== false });
    const H = 3, T = 0.12, wc = 0x9b7b58;
    // house 14 x 10 m: north wall, south wall with a front door, west wall, east wall with a window
    b(0, H / 2, -5, 7, H / 2, T, wc);
    b(-4.1, H / 2, 5, 2.9, H / 2, T, wc); b(4.1, H / 2, 5, 2.9, H / 2, T, wc); b(0, 2.6, 5, 1.2, 0.4, T, wc, false); // 2.4 m wide front door
    b(-7, H / 2, 0, T, H / 2, 5, wc);
    b(7, H / 2, -3.2, T, H / 2, 1.8, wc); b(7, H / 2, 3.2, T, H / 2, 1.8, wc); b(7, 0.5, 0, T, 0.5, 1.4, wc); b(7, 2.6, 0, T, 0.4, 1.4, wc, false); // window
    // inside wall splitting the living room from the back room, with a narrow doorway (the piano won't go through it flat)
    b(1.5, H / 2, -3.3, T, H / 2, 1.7, wc); b(1.5, H / 2, 2.8, T, H / 2, 2.2, wc); b(1.5, 2.55, -0.9, T, 0.45, 0.7, wc, false);
    b(0, H + 0.06, 0, 7.1, 0.06, 5.1, 0x5a4636, false); // roof
    // furniture: a shelf along the north wall, a table, a counter in the back room
    b(-4, 1.2, -4.6, 2.4, 0.05, 0.3, 0x6d5a44, false); b(-4, 0.6, -4.6, 2.4, 0.6, 0.05, 0x6d5a44, false);
    b(-3, 0.4, 0.5, 1.1, 0.4, 0.6, 0x7a5a3a, false);
    b(4.3, 0.5, -4.3, 2.4, 0.5, 0.45, 0x7a5a3a, false);
    b(0, 0.1, 5.8, 1.6, 0.1, 0.8, 0x8a6a44, false); // porch step
    // yard: a water trough and a woodpile
    b(-10, 0.35, 9, 1.4, 0.35, 0.5, 0x6d5a44); b(10, 0.45, 7, 1.0, 0.45, 1.6, 0x8a6a44);
    return S;
  }
  // where the valuables start (relative to the ranch)
  const SPAWN = [
    ['vase', -5, 1.55, -4.6], ['jar', -3.6, 1.45, -4.6], ['lamp', -2.5, 1.5, -4.6], ['radio', -3, 1.0, 0.5], ['jar', -2.6, 1.0, 0.8],
    ['bust', 4.5, 1.3, -4.3], ['mirror', 5.6, 0.7, 3.5], ['clock', -6.3, 1.0, 3.8], ['safe', 5, 0.55, 0.2], ['piano', -1.5, 0.7, -3.8],
    ['bell', -9, 0.3, 4], ['vase', 3.2, 1.3, -4.3],
  ];
  // the truck bed: a platform with low sides; what's resting in it rides home
  function bedBox(tx, tz, h) { const s = Math.sin(h), c = Math.cos(h); return { x: tx + s * 0.6, z: tz + c * 0.6, hx: 1.1, hz: 2.2, y: 1.0 }; }
  function inBed(p, tx, tz, h) {
    const B = bedBox(tx, tz, h), s = Math.sin(h), c = Math.cos(h), dx = p.x - B.x, dz = p.z - B.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < B.hx + 0.2 && Math.abs(lz) < B.hz + 0.2 && p.y > B.y - 0.3 && p.y < B.y + 2.5;
  }

  function create(C, seed) {
    const world = new C.World({ gravity: new C.Vec3(0, -9.82, 0), allowSleep: true });
    world.broadphase = new C.SAPBroadphase(world); world.solver.iterations = 12;
    const mat = new C.Material('d'); world.defaultContactMaterial = new C.ContactMaterial(mat, mat, { friction: 0.45, restitution: 0.15 }); world.defaultMaterial = mat;
    const ground = new C.Body({ mass: 0, shape: new C.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
    for (const s of layout()) { const bd = new C.Body({ mass: 0, shape: new C.Box(new C.Vec3(s.hx, s.hy, s.hz)), position: new C.Vec3(s.x, s.y, s.z) }); world.addBody(bd); }
    // the truck: cab and bed (kinematic, so it can roll away with the loot in it)
    const truck = { x: TRUCK.x, z: TRUCK.z, h: TRUCK.h, parts: [] };
    const addPart = (lx, ly, lz, hx, hy, hz) => { const bd = new C.Body({ mass: 0, type: C.Body.KINEMATIC, shape: new C.Box(new C.Vec3(hx, hy, hz)) }); bd.local = [lx, ly, lz]; world.addBody(bd); truck.parts.push(bd); };
    addPart(0, 0.85, 0.6, 1.1, 0.15, 2.2); addPart(0, 1.5, -2.4, 1.1, 1.0, 1.0);             // bed, cab
    addPart(-1.15, 1.25, 0.6, 0.05, 0.25, 2.2); addPart(1.15, 1.25, 0.6, 0.05, 0.25, 2.2);  // low sides
    addPart(0, 1.25, -1.55, 1.1, 0.25, 0.05);                                               // front board (tailgate is open)
    const W = { C, world, bodies: new Map(), grabs: new Map(), players: new Map(), truck, events: [], t: 0, digs: digSpots(seed) };
    placeTruck(W, truck.x, truck.z, truck.h, 0);
    let id = 1; for (const [type, x, y, z] of SPAWN) addObj(W, 50000 + id++, type, RANCH.X + x, y, RANCH.Z + z);
    return W;
  }
  // dirt mounds in the yard, each hiding something (a different set every trip)
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const BURIED = ['can', 'fossil', 'tube', 'chest', 'can', 'fossil'];
  function digSpots(seed) {
    const r = rng((seed | 0) + 77), out = [];
    for (let tries = 0; out.length < BURIED.length && tries < 500; tries++) {
      const x = (r() * 2 - 1) * 26, z = (r() * 2 - 1) * 26;
      if (Math.abs(x) < 9 && Math.abs(z) < 7.5) continue;              // not in or right next to the house
      if (Math.abs(x) < 4 && z > 8 && z < 22) continue;                 // not under the truck
      if (Math.abs(x + 10) < 3 && Math.abs(z - 9) < 2.5 || Math.abs(x - 10) < 2.5 && Math.abs(z - 7) < 3) continue; // trough, woodpile
      if (out.some(o => Math.hypot(o.x - RANCH.X - x, o.z - RANCH.Z - z) < 6)) continue;
      out.push({ i: out.length, id: 50100 + out.length, x: +(RANCH.X + x).toFixed(2), z: +(RANCH.Z + z).toFixed(2), type: BURIED[out.length], dug: false });
    }
    return out;
  }
  function unbury(W, i) {
    const d = W.digs[i]; if (!d || d.dug) return false; d.dug = true;
    const bd = addObj(W, d.id, d.type, d.x, 0.45, d.z); if (bd) { bd.velocity.set(0, 2.5, 0); bd.cgl.lastHit = W.t + 0.5; }
    return true;
  }
  function placeTruck(W, x, z, h, dt) {
    const T = W.truck, s = Math.sin(h), c = Math.cos(h), tp = dt && Math.hypot(x - T.x, z - T.z) < 2, vx = tp ? (x - T.x) / dt : 0, vz = tp ? (z - T.z) / dt : 0; // a jump (arriving) is a teleport
    T.x = x; T.z = z; T.h = h;
    for (const bd of T.parts) { const [lx, ly, lz] = bd.local; bd.position.set(x + lx * c + lz * s, ly, z - lx * s + lz * c); bd.quaternion.setFromEuler(0, h, 0); bd.velocity.set(vx, 0, vz); }
  }
  function addObj(W, id, type, x, y, z) {
    const C = W.C, L = LOOT[type]; if (!L) return null;
    const shape = L.shape === 'cyl' ? new C.Cylinder(L.r, L.r, L.h, 10) : new C.Box(new C.Vec3(L.hx, L.hy, L.hz));
    const bd = new C.Body({ mass: L.m, shape, position: new C.Vec3(x, y, z), linearDamping: 0.05, angularDamping: 0.25, sleepSpeedLimit: 0.15 });
    bd.cgl = { id, type, val: L.val, v0: L.val, lastHit: 0 };
    bd.addEventListener('collide', e => {
      const imp = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (imp < DMG.MIN || W.t - bd.cgl.lastHit < DMG.COOL || bd.cgl.val <= 0) return;
      bd.cgl.lastHit = W.t;
      const loss = Math.min(bd.cgl.val, Math.max(1, Math.round(bd.cgl.v0 * L.frag * (imp - DMG.MIN) * DMG.RATE)));
      bd.cgl.val -= loss; W.events.push({ k: 'dmg', id, loss, val: bd.cgl.val, x: bd.position.x, y: bd.position.y, z: bd.position.z });
      if (L.noisy) W.events.push({ k: 'ring', id });
    });
    W.world.addBody(bd); W.bodies.set(id, bd); return bd;
  }
  // players push things around: each is a kinematic cylinder that follows the player
  function setPlayer(W, pid, x, y, z, dt) {
    const C = W.C; let bd = W.players.get(pid);
    if (!bd) { bd = new C.Body({ mass: 0, type: C.Body.KINEMATIC, shape: new C.Cylinder(0.32, 0.32, 1.7, 8) }); W.world.addBody(bd); W.players.set(pid, bd); }
    const nx = x, ny = y + 0.85, nz = z;
    // a big jump is a teleport (arriving, respawning), not a shove; otherwise push things at walking/running speed at most
    const jump = Math.hypot(nx - bd.position.x, nz - bd.position.z);
    if (dt > 0 && jump < 3) { const k = Math.min(1, 9 / (jump / dt || 1)); bd.velocity.set((nx - bd.position.x) / dt * k, (ny - bd.position.y) / dt * k, (nz - bd.position.z) / dt * k); } else bd.velocity.set(0, 0, 0);
    bd.position.set(nx, ny, nz);
  }
  function dropPlayer(W, pid) { const bd = W.players.get(pid); if (bd) { W.world.removeBody(bd); W.players.delete(pid); } W.grabs.delete(pid); }
  // grabbing: a spring from the grabbed point toward your hand, capped at how strong one camper is
  function grab(W, pid, id, lp, hand) { const bd = W.bodies.get(id); if (!bd) return false; W.grabs.set(pid, { id, lp: new W.C.Vec3(lp[0], lp[1], lp[2]), hand: new W.C.Vec3(hand[0], hand[1], hand[2]) }); bd.wakeUp(); return true; }
  function hold(W, pid, hand) { const g = W.grabs.get(pid); if (g) g.hand.set(hand[0], hand[1], hand[2]); }
  function release(W, pid) { W.grabs.delete(pid); }
  function yeet(W, pid, dir) {
    const g = W.grabs.get(pid); if (!g) return; const bd = W.bodies.get(g.id); W.grabs.delete(pid); if (!bd) return;
    const n = [...W.grabs.values()].filter(q => q.id === g.id).length + 1, k = Math.min(1, (GRAB.FMAX * n / 9.82) / bd.mass); // heavy things barely leave your hands
    bd.velocity.x += dir[0] * GRAB.THROW * k; bd.velocity.y += (dir[1] * GRAB.THROW + 2.5) * k; bd.velocity.z += dir[2] * GRAB.THROW * k; bd.wakeUp();
  }
  // fixed 60 Hz substeps, with the grab springs applied on every one (cannon clears forces after each substep,
  // so letting world.step() catch up on its own would quietly halve everyone's strength at 30 fps)
  function step(W, dt) {
    W.acc = Math.min(5 / 60, (W.acc || 0) + dt); W.t += dt;
    while (W.acc >= 1 / 60) { W.acc -= 1 / 60; substep(W); W.world.step(1 / 60); }
  }
  function substep(W) {
    const C = W.C, F = new C.Vec3(), r = new C.Vec3(), vp = new C.Vec3();
    const held = new Set();
    for (const [pid, g] of W.grabs) {
      const bd = W.bodies.get(g.id); if (!bd) { W.grabs.delete(pid); continue; }
      held.add(g.id);
      const P = bd.pointToWorldFrame(g.lp); P.vsub(bd.position, r);
      bd.angularVelocity.cross(r, vp); vp.vadd(bd.velocity, vp);
      const dx = g.hand.x - P.x, dy = g.hand.y - P.y, dz = g.hand.z - P.z;
      if (Math.hypot(dx, dy, dz) > GRAB.SNAP) { W.grabs.delete(pid); W.events.push({ k: 'slip', pid, id: g.id }); continue; }
      F.set(dx * GRAB.K - vp.x * GRAB.DAMP, dy * GRAB.K - vp.y * GRAB.DAMP, dz * GRAB.K - vp.z * GRAB.DAMP);
      const m = F.length(); if (m > GRAB.FMAX) F.scale(GRAB.FMAX / m, F);
      bd.applyForce(F, r); bd.wakeUp();
    }
    for (const [id, bd] of W.bodies) { const h = held.has(id); bd.angularDamping = h ? 0.9 : 0.25; bd.linearDamping = h ? 0.35 : 0.05; }
  }
  function snapshot(W, all) {
    const out = [];
    for (const [id, bd] of W.bodies) {
      if (!all && bd.sleepState === 2 && bd.cgl.sent) continue; bd.cgl.sent = true;
      const p = bd.position, q = bd.quaternion, r3 = v => Math.round(v * 1000) / 1000;
      out.push([id, r3(p.x), r3(p.y), r3(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w), bd.cgl.val]);
    }
    return out;
  }
  // what's in the truck bed right now (and its total value)
  function bedLoad(W) { const T = W.truck, list = []; let val = 0; for (const [id, bd] of W.bodies) if (inBed(bd.position, T.x, T.z, T.h)) { list.push(id); val += bd.cgl.val; } return { list, val }; }

  const PHYS = { RANCH, TRUCK, GRAB, DMG, LOOT, SPAWN, layout, digSpots, unbury, bedBox, inBed, create, addObj, placeTruck, setPlayer, dropPlayer, grab, hold, release, yeet, step, snapshot, bedLoad };
  if (typeof module === 'object' && module.exports) module.exports = PHYS; else root.PHYS = PHYS;
})(this);
