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
  // the storm cellar under the yard (relative to the ranch): a 6 x 6.5 m room, 3 m down, under a boarded-over patch of cracked dirt.
  // Dig through the boards (o = the opening) and it caves in. The ways out: a friend pulls you up, or you dig a dirt ramp up through the opening.
  const CELLAR = { x0: 13, x1: 19, z0: -15.5, z1: -9, Y: -3, CEIL: -0.6, ox0: 14.8, ox1: 17.2, oz0: -12.6, oz1: -9, HITS: 6, RAMPN: 14 };

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
    // more in the house
    plates: { name: 'Stack of china', shape: 'cyl', r: 0.16, h: 0.12, m: 3, val: 90, frag: 2.2, color: 0xf4f4ee },
    painting: { name: 'Oil painting', shape: 'box', hx: 0.5, hy: 0.4, hz: 0.03, m: 4, val: 100, frag: 1.1, color: 0x3a6a4a },
    // in the barn and up in the hayloft
    saddle: { name: 'Leather saddle', shape: 'box', hx: 0.3, hy: 0.15, hz: 0.25, m: 15, val: 130, frag: 0.3, color: 0x6a3a1a },
    anvil: { name: 'Anvil', shape: 'box', hx: 0.35, hy: 0.2, hz: 0.15, m: 95, val: 170, frag: 0.05, color: 0x2e3033 },
    milkcan: { name: 'Milk can', shape: 'cyl', r: 0.18, h: 0.5, m: 12, val: 60, frag: 0.4, color: 0xb8bcc0 },
    lantern: { name: 'Barn lantern', shape: 'cyl', r: 0.1, h: 0.3, m: 1.2, val: 55, frag: 1.6, color: 0x8a5a2a },
    eggs: { name: 'Crate of eggs', shape: 'box', hx: 0.25, hy: 0.1, hz: 0.15, m: 1.5, val: 60, frag: 2.6, color: 0xf0e0c0 },
    trophy: { name: 'Mounted jackalope', shape: 'box', hx: 0.3, hy: 0.3, hz: 0.15, m: 6, val: 110, frag: 1.1, color: 0x7a5a3a },
    gramophone: { name: 'Gramophone', shape: 'box', hx: 0.22, hy: 0.18, hz: 0.22, m: 7, val: 140, frag: 1.3, color: 0x8a2a2a },
    hopechest: { name: 'Hope chest', shape: 'box', hx: 0.45, hy: 0.3, hz: 0.3, m: 40, val: 150, frag: 0.25, color: 0x7a4a2a },
    // down in the storm cellar
    kbsafe: { name: "Kate Barlow's safe", shape: 'box', hx: 0.4, hy: 0.42, hz: 0.4, m: 100, val: 450, frag: 0.12, color: 0x2a3a30 },
    peaches: { name: 'Jar of spiced peaches', shape: 'cyl', r: 0.12, h: 0.3, m: 1.5, val: 75, frag: 1.8, color: 0xe89a4a },
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
    // the barn, 12 x 14 m west of the house: a wide door facing the house, packed hay under a hayloft along the back,
    // and a ramp up the north wall to the loft (the dogs won't go up it)
    const bc = 0x9a3b2a, BH = 5;
    b(-17, BH / 2, -21, 6, BH / 2, T, bc); b(-17, BH / 2, -7, 6, BH / 2, T, bc); b(-23, BH / 2, -14, T, BH / 2, 7, bc);
    b(-11, BH / 2, -18.5, T, BH / 2, 2.5, bc); b(-11, BH / 2, -9.5, T, BH / 2, 2.5, bc); b(-11, 4.5, -14, T, 0.5, 2, bc, false);
    b(-17, BH + 0.06, -14, 6.2, 0.06, 7.2, 0x6a2a1e, false);                       // roof
    b(-20, 1.3, -14, 3, 1.3, 7, 0xd8b860);                                          // packed hay (solid)
    b(-20, 2.65, -14, 3.02, 0.05, 7, 0x8a6a44, false);                              // loft floor
    S.push({ x: X - 14.25, y: 1.24, z: Z - 19.9, hx: 3.07, hy: 0.1, hz: 1.1, c: 0x8a6a44, block: false, rz: -Math.atan2(2.7, 5.5) }); // ramp
    b(-14.6, 0.55, -18.7, 2, 0.55, 0.05, 0x6d5a44);                                 // ramp railing (no stepping onto it from the side)
    b(-12.2, 0.45, -9, 0.6, 0.45, 1.4, 0x6d5a44);                                   // workbench
    b(-13, 0.55, -3, 0.7, 0.55, 0.8, 0x7a4a2a);                                     // doghouse
    // the ground is 4 slabs around the cellar opening (top at y 0, 0.6 thick, so they're the cellar's ceiling too)
    const K = CELLAR, E = 400, gt = (x0, x1, z0, z1) => S.push({ x: X + (x0 + x1) / 2, y: K.CEIL / 2, z: Z + (z0 + z1) / 2, hx: (x1 - x0) / 2, hy: -K.CEIL / 2, hz: (z1 - z0) / 2, c: 0xdcab6e, block: false, ground: true });
    gt(-E, K.ox0, -E, E); gt(K.ox1, E, -E, E); gt(K.ox0, K.ox1, K.oz1, E); gt(K.ox0, K.ox1, -E, K.oz0);
    // the cellar: earth walls, a plank floor, a shelf (block walls have their top below ground, so they only stop you down there)
    const cw = 0x5a4030, WH = (K.CEIL - K.Y) / 2, WY = K.Y + WH, cx = (K.x0 + K.x1) / 2, cz = (K.z0 + K.z1) / 2;
    b(cx, WY, K.z0 - 0.1, (K.x1 - K.x0) / 2 + 0.2, WH, 0.1, cw); b(cx, WY, K.z1 + 0.1, (K.x1 - K.x0) / 2 + 0.2, WH, 0.1, cw);
    b(K.x0 - 0.1, WY, cz, 0.1, WH, (K.z1 - K.z0) / 2, cw); b(K.x1 + 0.1, WY, cz, 0.1, WH, (K.z1 - K.z0) / 2, cw);
    b(cx, K.Y - 0.05, cz, (K.x1 - K.x0) / 2, 0.05, (K.z1 - K.z0) / 2, 0x4a3a2a, false);
    b(14.3, K.Y + 1.0, K.z0 + 0.3, 1.2, 0.04, 0.25, 0x6d5a44, false);
    return S;
  }
  // where the valuables start (relative to the ranch)
  const SPAWN = [
    ['vase', -5, 1.55, -4.6], ['jar', -3.6, 1.45, -4.6], ['lamp', -2.5, 1.5, -4.6], ['radio', -3, 1.0, 0.5], ['jar', -2.6, 1.0, 0.8],
    ['bust', 4.5, 1.3, -4.3], ['mirror', 5.6, 0.7, 3.5], ['clock', -6.3, 1.0, 3.8], ['safe', 5, 0.55, 0.2], ['piano', -1.5, 0.7, -3.8],
    ['bell', -9, 0.3, 4], ['vase', 3.2, 1.3, -4.3],
    ['plates', 3.6, 1.07, -4.3], ['painting', 6.4, 0.42, -2.0],
    ['saddle', -12.2, 1.1, -9], ['lantern', -12.2, 1.06, -10], ['anvil', -14, 0.2, -11], ['milkcan', -15.5, 0.25, -8.2], ['milkcan', -12, 0.25, -16.5],
    ['eggs', -18.5, 2.82, -10], ['trophy', -21, 3.0, -16], ['gramophone', -19.5, 2.9, -12.5], ['hopechest', -21.5, 3.0, -9],
    ['kbsafe', 13.9, -2.57, -13.4], ['peaches', 13.7, -1.8, -15.2], ['peaches', 14.6, -1.8, -15.2],
  ];
  // how high the walkable floor is: the hayloft and its ramp, and the storm cellar.
  // y is how high you are now (down in the cellar the floor is 3 m down; up top it's the ground); cel is the cellar's state {open, ramp}
  const inOpening = (xr, zr) => xr > CELLAR.ox0 && xr < CELLAR.ox1 && zr > CELLAR.oz0 && zr < CELLAR.oz1;
  const rampH = zr => CELLAR.Y + Math.max(0, Math.min(1, (zr - CELLAR.oz0) / (CELLAR.oz1 - CELLAR.oz0))) * -CELLAR.Y;
  function floorAt(x, z, y, cel) {
    const xr = x - RANCH.X, zr = z - RANCH.Z, K = CELLAR;
    if (zr > -21 && zr < -7 && xr > -23 && xr < -17) return 2.7;
    if (zr > -21 && zr < -18.8 && xr >= -17 && xr < -11.5) return 2.7 * (-11.5 - xr) / 5.5;
    if (cel && cel.open && inOpening(xr, zr)) return cel.ramp ? rampH(zr) : K.Y;
    if (y != null && y < K.CEIL - 0.2 && xr > K.x0 - 0.4 && xr < K.x1 + 0.4 && zr > K.z0 - 0.4 && zr < K.z1 + 0.4) return K.Y;
    return 0;
  }
  // the truck bed: a platform with low sides; what's resting in it rides home
  function bedBox(tx, tz, h) { const s = Math.sin(h), c = Math.cos(h); return { x: tx + s * 0.6, z: tz + c * 0.6, hx: 1.1, hz: 2.2, y: 1.0 }; }
  function inBed(p, tx, tz, h) {
    const B = bedBox(tx, tz, h), s = Math.sin(h), c = Math.cos(h), dx = p.x - B.x, dz = p.z - B.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < B.hx + 0.2 && Math.abs(lz) < B.hz + 0.2 && p.y > B.y - 0.3 && p.y < B.y + 2.5;
  }

  function create(C, seed, dogs) {
    const world = new C.World({ gravity: new C.Vec3(0, -9.82, 0), allowSleep: true });
    world.broadphase = new C.SAPBroadphase(world); world.solver.iterations = 12;
    const mat = new C.Material('d'); world.defaultContactMaterial = new C.ContactMaterial(mat, mat, { friction: 0.45, restitution: 0.15 }); world.defaultMaterial = mat;
    const ground = new C.Body({ mass: 0, shape: new C.Plane(), position: new C.Vec3(0, CELLAR.Y, 0) }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground); // the cellar floor (the yard is the slabs in layout())
    for (const s of layout()) { const bd = new C.Body({ mass: 0, shape: new C.Box(new C.Vec3(s.hx, s.hy, s.hz)), position: new C.Vec3(s.x, s.y, s.z) }); if (s.rz) bd.quaternion.setFromEuler(0, 0, s.rz); world.addBody(bd); }
    // the truck: cab and bed (kinematic, so it can roll away with the loot in it)
    const truck = { x: TRUCK.x, z: TRUCK.z, h: TRUCK.h, parts: [] };
    // (everything we move by hand stays awake: a sleeping body that gets moved keeps its old collision box, and things pass through it)
    const addPart = (lx, ly, lz, hx, hy, hz) => { const bd = new C.Body({ mass: 0, type: C.Body.KINEMATIC, allowSleep: false, shape: new C.Box(new C.Vec3(hx, hy, hz)) }); bd.local = [lx, ly, lz]; world.addBody(bd); truck.parts.push(bd); };
    addPart(0, 0.85, 0.6, 1.1, 0.15, 2.2); addPart(0, 1.5, -2.4, 1.1, 1.0, 1.0);             // bed, cab
    addPart(-1.15, 1.25, 0.6, 0.05, 0.25, 2.2); addPart(1.15, 1.25, 0.6, 0.05, 0.25, 2.2);  // low sides
    addPart(0, 1.25, -1.55, 1.1, 0.25, 0.05);                                               // front board (tailgate is open)
    const W = { C, world, bodies: new Map(), grabs: new Map(), players: new Map(), truck, events: [], t: 0, digs: digSpots(seed) };
    placeTruck(W, truck.x, truck.z, truck.h, 0);
    let id = 1; for (const [type, x, y, z] of SPAWN) addObj(W, 50000 + id++, type, RANCH.X + x, y, RANCH.Z + z);
    // the boards over the cellar opening (they hold until someone digs through them)
    const K = CELLAR, hx = (K.ox1 - K.ox0) / 2, hz = (K.oz1 - K.oz0) / 2;
    W.hatch = new C.Body({ mass: 0, shape: new C.Box(new C.Vec3(hx, 0.05, hz)), position: new C.Vec3(RANCH.X + K.ox0 + hx, -0.05, RANCH.Z + K.oz0 + hz) }); world.addBody(W.hatch);
    W.cellar = { open: false, ramp: false, n: 0 };
    addDogs(W, dogs == null ? 2 : dogs);
    W.liz = []; W.lizId = 0; addLiz(W, RANCH.X + 18.2, RANCH.Z - 14.8, true); addLiz(W, RANCH.X + 17.4, RANCH.Z - 15, true); // the nest in the cellar
    return W;
  }
  // dig through the boards: the ground gives way (anything standing on it falls in)
  function openCellar(W) {
    if (W.cellar.open) return false; W.cellar.open = true; W.world.removeBody(W.hatch);
    for (const bd of W.bodies.values()) if (inOpening(bd.position.x - RANCH.X, bd.position.z - RANCH.Z)) bd.wakeUp();
    W.noise.push({ x: W.hatch.position.x, z: W.hatch.position.z, r: 6 }); // a quiet crunch: the nest a few metres away sleeps through it
    return true;
  }
  // one shovelful of dirt piled up under the opening; enough of them make a ramp you (and the loot) can go up
  function digRamp(W) {
    const K = CELLAR, c = W.cellar; if (!c.open || c.ramp) return false;
    c.n++; if (c.n < K.RAMPN) return true;
    c.ramp = true;
    const C = W.C, L = Math.hypot(K.oz1 - K.oz0, -K.Y), a = Math.atan2(-K.Y, K.oz1 - K.oz0), th = 0.15;
    const bd = new C.Body({ mass: 0, shape: new C.Box(new C.Vec3((K.ox1 - K.ox0) / 2, th, L / 2)), position: new C.Vec3(RANCH.X + (K.ox0 + K.ox1) / 2, K.Y / 2 - th * Math.cos(a), RANCH.Z + (K.oz0 + K.oz1) / 2 + th * Math.sin(a)) });
    bd.quaternion.setFromEuler(-a, 0, 0); W.world.addBody(bd);
    for (const o of W.bodies.values()) if (inOpening(o.position.x - RANCH.X, o.position.z - RANCH.Z)) { o.position.y = Math.max(o.position.y, rampH(o.position.z - RANCH.Z) + 0.5); o.wakeUp(); }
    return true;
  }
  function rampGeom() { const K = CELLAR, L = Math.hypot(K.oz1 - K.oz0, -K.Y), a = Math.atan2(-K.Y, K.oz1 - K.oz0); return { x: RANCH.X + (K.ox0 + K.ox1) / 2, y: K.Y / 2, z: RANCH.Z + (K.oz0 + K.oz1) / 2, w: K.ox1 - K.ox0, L, a }; }
  // dirt mounds in the yard, each hiding something (a different set every trip)
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const BURIED = ['can', 'fossil', 'tube', 'chest', 'can', 'fossil', 'nest']; // one mound is a lizard nest (it has little burrow holes in it)
  function digSpots(seed) {
    const r = rng((seed | 0) + 77), out = [];
    for (let tries = 0; out.length < BURIED.length && tries < 500; tries++) {
      const x = (r() * 2 - 1) * 26, z = (r() * 2 - 1) * 26;
      if (Math.abs(x) < 9 && Math.abs(z) < 7.5) continue;              // not in or right next to the house
      if (Math.abs(x) < 4 && z > 8 && z < 22) continue;                 // not under the truck
      if (x > -24.5 && x < -9.5 && z > -22.5 && z < -5.5) continue;       // not in or by the barn
      if (Math.abs(x + 13) < 2.5 && Math.abs(z + 2.5) < 2.5) continue;    // not on the doghouse
      if (x > CELLAR.x0 - 2 && x < CELLAR.x1 + 2 && z > CELLAR.z0 - 2 && z < CELLAR.z1 + 2) continue; // not on the storm cellar
      if (Math.abs(x + 10) < 3 && Math.abs(z - 9) < 2.5 || Math.abs(x - 10) < 2.5 && Math.abs(z - 7) < 3) continue; // trough, woodpile
      if (out.some(o => Math.hypot(o.x - RANCH.X - x, o.z - RANCH.Z - z) < 6)) continue;
      out.push({ i: out.length, id: 50100 + out.length, x: +(RANCH.X + x).toFixed(2), z: +(RANCH.Z + z).toFixed(2), type: BURIED[out.length], dug: false });
    }
    return out;
  }
  function unbury(W, i) {
    const d = W.digs[i]; if (!d || d.dug) return false; d.dug = true;
    if (d.type === 'nest') { for (let k = 0; k < 2; k++) { const l = addLiz(W, d.x + (k ? 0.6 : -0.6), d.z, false); l.state = 'emerge'; l.gx = d.x; l.gz = d.z; l.t = 0; } W.events.push({ k: 'nest', i, x: d.x, z: d.z }); return true; }
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
      if (e.body && e.body.liz && imp > 2.2 && e.body.liz.state !== 'stun') { const l = e.body.liz; l.state = 'stun'; l.t = 0; W.events.push({ k: 'stun', id: l.id, x: l.x, z: l.z }); }
      if (imp < DMG.MIN || W.t - bd.cgl.lastHit < DMG.COOL || bd.cgl.val <= 0) return;
      bd.cgl.lastHit = W.t;
      const loss = Math.min(bd.cgl.val, Math.max(1, Math.round(bd.cgl.v0 * L.frag * (imp - DMG.MIN) * DMG.RATE)));
      bd.cgl.val -= loss; W.events.push({ k: 'dmg', id, loss, val: bd.cgl.val, x: bd.position.x, y: bd.position.y, z: bd.position.z });
      if (W.noise) W.noise.push({ x: bd.position.x, z: bd.position.z, y: bd.position.y, r: 8 + loss * 0.5 });
      if (L.noisy) { W.events.push({ k: 'ring', id }); if (W.noise) W.noise.push({ x: bd.position.x, z: bd.position.z, y: bd.position.y, r: 40 }); }
    });
    W.world.addBody(bd); W.bodies.set(id, bd); return bd;
  }
  // players push things around: each is a kinematic cylinder that follows the player
  function setPlayer(W, pid, x, y, z, dt, info) {
    const C = W.C; let bd = W.players.get(pid);
    if (!bd) { bd = new C.Body({ mass: 0, type: C.Body.KINEMATIC, allowSleep: false, shape: new C.Cylinder(0.32, 0.32, 1.7, 8) }); W.world.addBody(bd); W.players.set(pid, bd); }
    const nx = x, ny = y + 0.85, nz = z;
    // a big jump is a teleport (arriving, respawning), not a shove; otherwise push things at walking/running speed at most
    const jump = Math.hypot(nx - bd.position.x, nz - bd.position.z);
    if (dt > 0 && jump < 3) { const k = Math.min(1, 9 / (jump / dt || 1)); bd.velocity.set((nx - bd.position.x) / dt * k, (ny - bd.position.y) / dt * k, (nz - bd.position.z) / dt * k); } else bd.velocity.set(0, 0, 0);
    bd.position.set(nx, ny, nz); bd.info = info || {};
  }
  function dropPlayer(W, pid) { const bd = W.players.get(pid); if (bd) { W.world.removeBody(bd); W.players.delete(pid); } W.grabs.delete(pid); }
  // grabbing: a spring from the grabbed point toward your hand, capped at how strong one camper is
  function grab(W, pid, id, lp, hand) { const bd = W.bodies.get(id); if (!bd) return false; W.grabs.set(pid, { id, lp: new W.C.Vec3(lp[0], lp[1], lp[2]), hand: new W.C.Vec3(hand[0], hand[1], hand[2]) }); bd.wakeUp(); return true; }
  function hold(W, pid, hand) { const g = W.grabs.get(pid); if (g) g.hand.set(hand[0], hand[1], hand[2]); }
  function release(W, pid) { W.grabs.delete(pid); }
  function yeet(W, pid, dir) {
    const g = W.grabs.get(pid); if (!g) return; const bd = W.bodies.get(g.id); W.grabs.delete(pid); if (!bd) return;
    const n = [...W.grabs.values()].filter(q => q.id === g.id).length + 1, k = Math.min(1, (GRAB.FMAX * n / 9.82) / bd.mass); // heavy things barely leave your hands
    W.thrown = g.id;
    bd.velocity.x += dir[0] * GRAB.THROW * k; bd.velocity.y += (dir[1] * GRAB.THROW + 2.5) * k; bd.velocity.z += dir[2] * GRAB.THROW * k; bd.wakeUp();
  }
  // fixed 60 Hz substeps, with the grab springs applied on every one (cannon clears forces after each substep,
  // so letting world.step() catch up on its own would quietly halve everyone's strength at 30 fps)
  function step(W, dt) {
    W.acc = Math.min(5 / 60, (W.acc || 0) + dt); W.t += dt;
    if (dt > 0) {
      // loud campers: digging (quiet if you crouch) and sprinting carry (and anyone listening can tell whether it came from down in the cellar)
      for (const [, pl] of W.players) { const inf = pl.info || {}, a = inf.a, p = pl.position; if (a === 2) W.noise.push({ x: p.x, z: p.z, y: p.y, r: inf.crouch ? 5 : 13 }); else if (a === 4) W.noise.push({ x: p.x, z: p.z, y: p.y, r: 9 }); }
      // the bell rings while you carry it around
      for (const g of W.grabs.values()) {
        const bd = W.bodies.get(g.id); if (!bd || !LOOT[bd.cgl.type].noisy || bd.velocity.length() < 0.7 || W.t - (bd.cgl.ringT || 0) < 0.9) continue;
        bd.cgl.ringT = W.t; W.events.push({ k: 'ring', id: g.id }); W.noise.push({ x: bd.position.x, z: bd.position.z, y: bd.position.y, r: 40 });
      }
      stepDogs(W, dt); stepLiz(W, dt); W.noise.length = 0;
    }
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
  // ---- the Walkers' guard dogs: asleep at first; noise wakes them, they chase and bite, and they can't resist a thrown thing ----
  const DOG = { WALK: 2.4, RUN: 5.8, SIGHT: 13, CROUCH: 5, WAKE: 5, BITE: 1.2, CD: 1.6, CALM: 14, LOST: 3, FETCH: 7 };
  const DOGBEDS = [[-13, -1.4], [4, -7.4]];
  function zoneOf(x, z, y) {
    const xr = x - RANCH.X, zr = z - RANCH.Z;
    if (y != null && y < -1 && xr > CELLAR.x0 - 0.5 && xr < CELLAR.x1 + 0.5 && zr > CELLAR.z0 - 0.5 && zr < CELLAR.z1 + 0.5) return 'cellar';
    if (Math.abs(xr) < 7 && Math.abs(zr) < 5) return xr < 1.5 ? 'hw' : 'he';
    if (xr > -23 && xr < -11 && zr > -21 && zr < -7) return floorAt(x, z) > 0.6 ? 'loft' : 'barn';
    return 'yard';
  }
  const DOORS = [['yard', 'hw', [0, 6.6], [0, 3.6]], ['hw', 'he', [0.2, -0.9], [2.8, -0.9]], ['yard', 'barn', [-9.4, -14], [-12.6, -14]]];
  function route(from, to) { // the first doorway on the way from one area to another: [this side, other side]
    if (from === to) return null;
    const q = [[from, null]], seen = new Set([from]);
    while (q.length) {
      const [zn, first] = q.shift();
      for (const [a, b, pa, pb] of DOORS) {
        let nx = null, mine, other; if (a === zn) { nx = b; mine = pa; other = pb; } else if (b === zn) { nx = a; mine = pb; other = pa; }
        if (!nx || seen.has(nx)) continue; const f = first || [mine, other]; if (nx === to) return f; seen.add(nx); q.push([nx, f]);
      }
    }
    return null;
  }
  function addDogs(W, n) {
    const C = W.C; W.dogs = []; W.noise = []; W.thrown = null;
    W.dogBlocks = layout().filter(s => s.block).map(s => ({ x0: s.x - s.hx, x1: s.x + s.hx, z0: s.z - s.hz, z1: s.z + s.hz, top: s.y + s.hy }));
    for (let i = 0; i < n; i++) {
      const [bx, bz] = DOGBEDS[i % DOGBEDS.length], x = RANCH.X + bx, z = RANCH.Z + bz;
      const body = new C.Body({ mass: 0, type: C.Body.KINEMATIC, allowSleep: false, shape: new C.Cylinder(0.3, 0.3, 0.6, 8), position: new C.Vec3(x, 0.3, z) }); W.world.addBody(body);
      W.dogs.push({ id: i, x, z, h: i ? Math.PI : 0, bed: [x, z], state: 'sleep', t: 0, cd: 0, bark: 0, tgt: null, gx: x, gz: z, lost: 0, hold: null, holdT: 0, back: null, body });
    }
  }
  function dogSees(W, d) { // the nearest camper this dog notices
    const dz = zoneOf(d.x, d.z); let best = null, bd = 1e9;
    for (const [pid, pl] of W.players) {
      const p = pl.position, inf = pl.info || {}, dist = Math.hypot(p.x - d.x, p.z - d.z), pz = zoneOf(p.x, p.z, p.y);
      if (pz === 'cellar') continue; // dogs don't go down there
      const near = pz === dz || (pz === 'loft' && dz === 'barn') || dist < 3.5;
      let r = d.state === 'sleep' ? DOG.WAKE * (inf.a === 4 ? 1.6 : 1) * (inf.crouch ? 0.5 : 1) : inf.crouch ? DOG.CROUCH : DOG.SIGHT;
      if (near && dist < r && dist < bd) { bd = dist; best = pid; }
    }
    return best;
  }
  function moveDog(W, d, gx, gz, sp, dt) {
    const from = zoneOf(d.x, d.z); let to = zoneOf(gx, gz);
    if (to === 'loft') { gx = RANCH.X - 12; gz = RANCH.Z - 19.9; to = 'barn'; } // can't climb: wait at the bottom of the ramp
    let tx = gx, tz = gz; const r = route(from, to);
    if (r) {
      const ax = RANCH.X + r[0][0], az = RANCH.Z + r[0][1], bx = RANCH.X + r[1][0], bz = RANCH.Z + r[1][1];
      if (Math.hypot(ax - d.x, az - d.z) < 0.9 || Math.hypot(bx - d.x, bz - d.z) < Math.hypot(bx - ax, bz - az)) { tx = bx; tz = bz; } else { tx = ax; tz = az; }
    }
    const dx = tx - d.x, dz = tz - d.z, L = Math.hypot(dx, dz); if (L < 0.05 || sp <= 0) return;
    const st = Math.min(L, sp * dt); let nx = d.x + dx / L * st, nz = d.z + dz / L * st;
    const T = W.truck, s = Math.abs(Math.sin(T.h)), c = Math.abs(Math.cos(T.h)), thx = 1.2 * c + 3.1 * s, thz = 1.2 * s + 3.1 * c;
    const tcx = T.x - Math.sin(T.h) * 0.3, tcz = T.z - Math.cos(T.h) * 0.3;
    for (const b of W.dogBlocks.concat([{ x0: tcx - thx, x1: tcx + thx, z0: tcz - thz, z1: tcz + thz, top: 2 }])) {
      if (b.top < 0.5) continue; const R = 0.35;
      if (nx > b.x0 - R && nx < b.x1 + R && nz > b.z0 - R && nz < b.z1 + R) {
        const px = Math.min(nx - (b.x0 - R), b.x1 + R - nx), pz = Math.min(nz - (b.z0 - R), b.z1 + R - nz);
        if (px < pz) nx = nx < (b.x0 + b.x1) / 2 ? b.x0 - R : b.x1 + R; else nz = nz < (b.z0 + b.z1) / 2 ? b.z0 - R : b.z1 + R;
      }
    }
    if (floorAt(nx, nz) > 0.5) { nx = d.x; nz = d.z; } // dogs don't do ramps
    if (W.cellar && W.cellar.open && inOpening(nx - RANCH.X, nz - RANCH.Z) && !inOpening(d.x - RANCH.X, d.z - RANCH.Z)) { nx = d.x; nz = d.z; } // or holes (lizards climb down theirs separately)
    nx = Math.max(RANCH.X - RANCH.HALF, Math.min(RANCH.X + RANCH.HALF, nx)); nz = Math.max(RANCH.Z - RANCH.HALF, Math.min(RANCH.Z + RANCH.HALF, nz));
    d.h = Math.atan2(dx, dz); d.x = nx; d.z = nz;
  }
  function stepDogs(W, dt) {
    if (!W.dogs || !W.dogs.length || dt <= 0) return;
    const thrown = W.thrown != null ? W.bodies.get(W.thrown) : null; W.thrown = null;
    for (const d of W.dogs) {
      const ox = d.x, oz = d.z; d.cd = Math.max(0, d.cd - dt); d.bark -= dt; d.t += dt;
      const bark = () => { if (d.bark <= 0) { d.bark = 2.2; W.events.push({ k: 'bark', id: d.id, x: d.x, z: d.z }); } };
      const seen = d.state === 'back' || d.hold != null ? null : dogSees(W, d);
      const heard = W.noise.find(n => Math.hypot(n.x - d.x, n.z - d.z) < n.r);
      if (thrown && d.hold == null && Math.hypot(thrown.position.x - d.x, thrown.position.z - d.z) < (d.state === 'sleep' ? 12 : 22)) { d.state = 'fetch'; d.fetch = thrown.cgl.id; d.t = 0; bark(); }
      if (d.state === 'sleep' || d.state === 'sniff' || d.state === 'home') {
        if (seen != null) { d.state = 'chase'; d.tgt = seen; d.lost = 0; bark(); }
        else if (heard) { if (d.state === 'sleep') bark(); d.state = 'sniff'; d.gx = heard.x; d.gz = heard.z; d.t = 0; }
      }
      if (d.hold != null) { // running home with something in its mouth
        const g = W.grabs.get('dog' + d.id); d.holdT -= dt;
        if (!g || d.holdT <= 0 || Math.hypot(d.x - d.bed[0], d.z - d.bed[1]) < 1.2) { W.grabs.delete('dog' + d.id); d.hold = null; d.state = 'sniff'; d.gx = d.x; d.gz = d.z; d.t = 0; }
        else { moveDog(W, d, d.bed[0], d.bed[1], DOG.RUN * 0.8, dt); g.hand.set(d.x + Math.sin(d.h) * 0.55, 0.55, d.z + Math.cos(d.h) * 0.55); }
      } else if (d.state === 'fetch') {
        const b = W.bodies.get(d.fetch);
        if (!b || d.t > DOG.FETCH) { d.state = 'sniff'; d.t = 0; }
        else if (Math.hypot(b.position.x - d.x, b.position.z - d.z) < 1.0) {
          const held = [...W.grabs.values()].some(g => g.id === d.fetch);
          if (b.mass <= 6 && !held) { d.hold = d.fetch; d.holdT = 10; W.grabs.set('dog' + d.id, { id: d.fetch, lp: new W.C.Vec3(0, 0, 0), hand: new W.C.Vec3(b.position.x, 0.55, b.position.z) }); b.wakeUp(); bark(); }
          else { d.state = 'sniff'; d.gx = d.x; d.gz = d.z; d.t = 0; }
        } else moveDog(W, d, b.position.x, b.position.z, DOG.RUN, dt);
      } else if (d.state === 'chase') {
        const pl = W.players.get(d.tgt);
        if (seen != null) { d.tgt = seen; d.lost = 0; } else d.lost += dt;
        if (!pl || d.lost > DOG.LOST) { d.state = 'sniff'; d.t = 0; if (pl) { d.gx = pl.position.x; d.gz = pl.position.z; } }
        else {
          const p = pl.position; d.gx = p.x; d.gz = p.z; moveDog(W, d, p.x, p.z, DOG.RUN, dt);
          if (zoneOf(p.x, p.z) === 'loft') bark();
          if (d.cd <= 0 && Math.hypot(p.x - d.x, p.z - d.z) < DOG.BITE && Math.abs(p.y - 0.85 - floorAt(d.x, d.z)) < 0.9) {
            W.events.push({ k: 'bite', pid: d.tgt, id: d.id, x: d.x, z: d.z }); d.cd = DOG.CD; d.state = 'back'; d.t = 0; d.back = [p.x, p.z];
          }
        }
      } else if (d.state === 'back') { // backs off a step after a bite, then comes again
        const ax = d.x - d.back[0], az = d.z - d.back[1], L = Math.hypot(ax, az) || 1;
        moveDog(W, d, d.x + ax / L * 2, d.z + az / L * 2, DOG.WALK, dt); d.h = Math.atan2(-ax, -az);
        if (d.t > 1.0) { d.state = 'sniff'; d.gx = d.back[0]; d.gz = d.back[1]; d.t = DOG.CALM - 4; }
      } else if (d.state === 'sniff') {
        moveDog(W, d, d.gx, d.gz, DOG.WALK * 1.3, dt); if (d.t > DOG.CALM) { d.state = 'home'; d.t = 0; }
      } else if (d.state === 'home') {
        moveDog(W, d, d.bed[0], d.bed[1], DOG.WALK, dt); if (Math.hypot(d.x - d.bed[0], d.z - d.bed[1]) < 0.5) d.state = 'sleep';
      }
      d.body.position.set(d.x, 0.3, d.z); d.body.velocity.set((d.x - ox) / dt, 0, (d.z - oz) / dt);
    }
  }
  function dogSnap(W) {
    const r2 = v => Math.round(v * 100) / 100, code = d => d.hold != null ? 3 : d.state === 'sleep' ? 0 : d.state === 'chase' || d.state === 'fetch' ? 2 : 1;
    return (W.dogs || []).map(d => [d.id, r2(d.x), r2(d.z), r2(d.h), code(d)]);
  }
  // ---- yellow-spotted lizards (the hole creature): asleep in their nests (the cellar, and one of the dirt mounds). Noise wakes them and
  // they go looking for it; if they see you they chase, and one bite knocks you out. They climb in and out of the cellar opening.
  // Hit one with something thrown and it's stunned for a few seconds.
  const LZ = { WALK: 2.2, RUN: 4.9, SIGHT: 9, CROUCH: 3.5, WAKE: 2.5, BITE: 0.85, LOST: 4, CALM: 12, STUN: 6, HEAR: 0.6 };
  function addLiz(W, x, z, down) {
    const C = W.C, id = W.lizId++, y = down ? CELLAR.Y : 0;
    const body = new C.Body({ mass: 0, type: C.Body.KINEMATIC, allowSleep: false, shape: new C.Cylinder(0.3, 0.3, 0.24, 8), position: new C.Vec3(x, y + 0.12, z) }); W.world.addBody(body);
    const l = { id, x, z, down, h: id * 2.1, nest: [x, z, down], state: 'sleep', t: 0, cd: 0, hiss: 0, tgt: null, gx: x, gz: z, gdown: down, lost: 0, body };
    body.liz = l; W.liz.push(l); return l;
  }
  const lizY = l => l.down ? CELLAR.Y : floorAt(l.x, l.z);
  const downAt = (x, z, y) => y != null && zoneOf(x, z, y) === 'cellar';
  function lizSees(W, l) {
    const lz = l.down ? 'cellar' : zoneOf(l.x, l.z); let best = null, bd = 1e9;
    for (const [pid, pl] of W.players) {
      const p = pl.position, inf = pl.info || {}, pz = zoneOf(p.x, p.z, p.y), dist = Math.hypot(p.x - l.x, p.z - l.z);
      if ((pz === 'cellar') !== l.down || !(pz === lz || dist < 3.5)) continue;
      const r = l.state === 'sleep' ? LZ.WAKE * (inf.crouch ? 0.5 : 1) : inf.crouch ? LZ.CROUCH : LZ.SIGHT;
      if (dist < r && dist < bd) { bd = dist; best = pid; }
    }
    return best;
  }
  function moveLiz(W, l, gx, gz, gdown, sp, dt) {
    const K = CELLAR;
    if (l.down !== gdown) { // up or down the cellar wall, through the opening
      if (!W.cellar.open) return;
      const bx = RANCH.X + (K.ox0 + K.ox1) / 2, bz = RANCH.Z + (K.oz0 + K.oz1) / 2, tz = RANCH.Z + K.oz1 + 0.7, px = bx, pz = l.down ? bz : tz;
      if (Math.hypot(px - l.x, pz - l.z) < 0.6) { l.down = !l.down; l.z = l.down ? bz : tz; l.x = bx; l.jump = true; return; }
      gx = px; gz = pz;
    }
    if (!l.down) { moveDog(W, l, gx, gz, sp, dt); return; }
    const dx = gx - l.x, dz = gz - l.z, L = Math.hypot(dx, dz); if (L < 0.05) return;
    const st = Math.min(L, sp * dt);
    l.x = Math.max(RANCH.X + K.x0 + 0.3, Math.min(RANCH.X + K.x1 - 0.3, l.x + dx / L * st)); l.z = Math.max(RANCH.Z + K.z0 + 0.3, Math.min(RANCH.Z + K.z1 - 0.3, l.z + dz / L * st)); l.h = Math.atan2(dx, dz);
  }
  function stepLiz(W, dt) {
    for (const l of W.liz || []) {
      const ox = l.x, oz = l.z; l.t += dt; l.cd = Math.max(0, l.cd - dt); l.hiss -= dt; l.jump = false;
      const hiss = () => { if (l.hiss <= 0) { l.hiss = 2.5; W.events.push({ k: 'hiss', id: l.id, x: l.x, z: l.z }); } };
      if (l.state === 'stun') { if (l.t > LZ.STUN) { l.state = 'hunt'; l.t = LZ.CALM - 5; l.gx = l.x; l.gz = l.z; l.gdown = l.down; } }
      else if (l.state === 'emerge') { if (l.t > 1.2) { l.state = 'hunt'; l.t = 0; } } // crawling out of a dug-up nest: a moment to run
      else {
        const seen = lizSees(W, l);
        // down in the cellar, a sleeping lizard only wakes for noise down there (or the bell, through the opening); awake, it hears everything
        const hears = n => !l.down || downAt(n.x, n.z, n.y) || (W.cellar.open && (l.state !== 'sleep' || n.r >= 30));
        const heard = W.noise.find(n => Math.hypot(n.x - l.x, n.z - l.z) < n.r * (l.state === 'sleep' ? LZ.HEAR : 1) && hears(n));
        if (l.state !== 'chase') {
          if (seen != null) { l.state = 'chase'; l.tgt = seen; l.lost = 0; hiss(); }
          else if (heard) { if (l.state === 'sleep') hiss(); l.state = 'hunt'; l.gx = heard.x; l.gz = heard.z; l.gdown = downAt(heard.x, heard.z, heard.y); l.t = 0; }
        }
        if (l.state === 'chase') {
          const pl = W.players.get(l.tgt);
          if (seen != null) { l.tgt = seen; l.lost = 0; } else l.lost += dt;
          if (!pl || l.lost > LZ.LOST) { l.state = 'hunt'; l.t = 0; if (pl) { l.gx = pl.position.x; l.gz = pl.position.z; l.gdown = downAt(pl.position.x, pl.position.z, pl.position.y); } }
          else {
            const p = pl.position, pdown = downAt(p.x, p.z, p.y); moveLiz(W, l, p.x, p.z, pdown, LZ.RUN, dt); hiss();
            if (l.cd <= 0 && pdown === l.down && Math.hypot(p.x - l.x, p.z - l.z) < LZ.BITE && Math.abs(p.y - 0.85 - lizY(l)) < 1.2) {
              W.events.push({ k: 'lbite', pid: l.tgt, id: l.id, x: l.x, z: l.z }); l.cd = 3; l.state = 'home'; l.t = 0; // one bite, then it goes back to its nest
            }
          }
        } else if (l.state === 'hunt') { moveLiz(W, l, l.gx, l.gz, l.gdown, LZ.WALK * 1.4, dt); if (l.t > LZ.CALM) { l.state = 'home'; l.t = 0; } }
        else if (l.state === 'home') { moveLiz(W, l, l.nest[0], l.nest[1], l.nest[2], LZ.WALK, dt); if (l.down === l.nest[2] && Math.hypot(l.x - l.nest[0], l.z - l.nest[1]) < 0.5) l.state = 'sleep'; }
      }
      const y = lizY(l), jump = l.jump || Math.hypot(l.x - ox, l.z - oz) > 1;
      l.body.position.set(l.x, y + 0.12, l.z); l.body.velocity.set(jump ? 0 : (l.x - ox) / dt, 0, jump ? 0 : (l.z - oz) / dt);
    }
  }
  function lizSnap(W) {
    const r2 = v => Math.round(v * 100) / 100, code = l => l.state === 'sleep' ? 0 : l.state === 'chase' ? 2 : l.state === 'stun' ? 3 : 1;
    return (W.liz || []).map(l => [l.id, r2(l.x), r2(lizY(l)), r2(l.z), r2(l.h), code(l)]);
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

  const PHYS = { RANCH, TRUCK, GRAB, DMG, LOOT, SPAWN, CELLAR, LZ, layout, floorAt, zoneOf, inOpening, rampH, openCellar, digRamp, rampGeom, lizSnap, dogSnap, DOG, digSpots, unbury, bedBox, inBed, create, addObj, placeTruck, setPlayer, dropPlayer, grab, hold, release, yeet, step, snapshot, bedLoad };
  if (typeof module === 'object' && module.exports) module.exports = PHYS; else root.PHYS = PHYS;
})(this);
