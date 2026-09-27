// Camp Green Lake multiplayer server: serves the game and relays campers over WebSocket.
// The world (holes, dug-up items, the KB tube, the suitcase) is kept here so late joiners see it.
// It also runs the shared rules in public/sim.js: the team quota, heavy loot, and the night monsters.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const SIM = require('./public/sim.js');

const PORT = Number(process.env.PORT) || 4300;
const PUB = path.join(__dirname, 'public');
const SAVE = path.join(__dirname, 'data', 'world.json');
const MAX_CLIENTS = 40;
const MAX_HOLES = 40000;
const MAX_ITEM = 100000;
const MAX_BAGS = 60, MAX_PROPS = 40;
const NEW_DAY_AFTER_WIN_MS = 10 * 60 * 1000;
// Token for the admin endpoints (curl over SSH). Set HOST_TOKEN in the environment;
// without it a random one is generated, which effectively turns the admin endpoints off.
const HOST_TOKEN = process.env.HOST_TOKEN || require('crypto').randomBytes(24).toString('hex');
const PARTY_SECS = 60, DISCO_COOLDOWN_MS = 3 * 60 * 1000;
const RECENT_MS = 60 * 60 * 1000;
const CHAT_RANGE = 30, HELP_RANGE = 3.5;
// this branch runs the mission loop from GAME_DESIGN.md instead of the old day/night sentence
const MISSIONS = true;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? clamp(v, a, b) : d; };
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} _'.-]/gu, '').trim().slice(0, 16) || 'Camper';
const cleanChat = s => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80);
const LOOT_KEYS = ['cap', 'can', 'spoon', 'shoe', 'arrow', 'jar', 'fossil', 'lipstick', 'sploosh', 'locket', 'pistol', 'sneakers', 'goldbar'];

function freshRun(sentence) { const seed = (Math.random() * 1e9) | 0; return { day: 1, bank: 30, peak: 1, curse: 0, sentence: sentence || 1, seed, ...SIM.rollDay(seed, 1, 0) }; }
function freshWorld(day) { return { day, holes: {}, got: [], kb: null, won: null, wonAt: 0, recent: {}, hostNames: [], bags: {}, props: {}, breaches: {}, rot: [], truck: freshTruck(), mission: { phase: 'hub', trip: 0 } }; }
let world = freshWorld(1);
try { world = Object.assign(freshWorld(1), JSON.parse(fs.readFileSync(SAVE, 'utf8'))); } catch (e) { /* first run */ }
if (!world.recent || typeof world.recent !== 'object') world.recent = {};
if (!Array.isArray(world.hostNames)) world.hostNames = [];
if (!world.clock || typeof world.clock !== 'object') world.clock = { off: 0, paused: false, pt: 0 };
if (!world.run || typeof world.run !== 'object' || !world.run.seed) world.run = freshRun();
if (!world.meta || typeof world.meta !== 'object') world.meta = { served: 0, best: 0 };
if (!world.players || typeof world.players !== 'object') world.players = {};
if (!world.bags || typeof world.bags !== 'object') world.bags = {};
if (!world.props || typeof world.props !== 'object') world.props = {};
if (!world.breaches || typeof world.breaches !== 'object') world.breaches = {};
if (!Array.isArray(world.rot)) world.rot = [];
if (!world.truck || typeof world.truck !== 'object') world.truck = freshTruck();
if (!world.mission || typeof world.mission !== 'object') world.mission = { phase: 'hub', trip: 0 };
if (MISSIONS) { world.clock = { off: 0, paused: true, pt: SIM.DAYMS * 0.45 }; if (world.mission.phase !== 'hub') world.mission = { phase: 'hub', trip: world.mission.trip || 0 }; } // always daylight at camp; a restart mid-trip returns to camp
function freshTruck() { const H = SIM.TRUCK.HOME; return { x: H.x, z: H.z, h: H.h, sp: 0, mode: 'parked', driver: null, until: 0, stuck: false, tank: SIM.TRUCK.TANK }; }
function truckInfo() { const T = world.truck; return { t: 'truck', x: T.x, z: T.z, h: T.h, mode: T.mode, driver: T.driver, left: T.until ? Math.max(0, T.until - Date.now()) : 0, stuck: T.stuck, tank: T.tank }; }
let layCache = { key: '', lay: null };
function layout() { const k = world.run.seed + ':' + world.run.day; if (layCache.key !== k) layCache = { key: k, lay: SIM.townLayout(world.run.seed, world.run.day) }; return layCache.lay; }
let gotSet = new Set(world.got);
let dirty = false;
let nextObj = Date.now() % 100000;

function save() {
  if (!dirty) return;
  dirty = false;
  world.got = [...gotSet];
  fs.mkdirSync(path.dirname(SAVE), { recursive: true });
  fs.writeFile(SAVE + '.tmp', JSON.stringify(world), err => { if (!err) fs.rename(SAVE + '.tmp', SAVE, () => {}); });
}
setInterval(() => { if (Object.keys(world.recent).length) dirty = true; save(); }, 15000);

function sendFile(res, file, type) {
  fs.readFile(path.join(PUB, file), (err, buf) => {
    if (err) { res.writeHead(500); return res.end('missing game file'); }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url.startsWith('/admin/')) {
    // Admin controls for the host, used over SSH: curl -H 'x-admin: <token>' localhost:4300/admin/who
    if (req.headers['x-admin'] !== HOST_TOKEN) { res.writeHead(404); return res.end('not found'); }
    const q = new URL(req.url, 'http://x').searchParams;
    res.writeHead(200, { 'content-type': 'application/json' });
    if (url === '/admin/who') return res.end(JSON.stringify([...clients.values()].map(c => ({ id: c.id, n: c.n, joined: c.joined, host: c.host, v: c.v || 0 }))));
    if (url === '/admin/sethost') { const n = cleanName(q.get('name')).toLowerCase(); if (!world.hostNames.includes(n)) world.hostNames.push(n); dirty = true; for (const c of clients.values()) if (c.n.toLowerCase() === n) { c.host = true; send(c, { t: 'host', on: true }); } return res.end(JSON.stringify(world.hostNames)); }
    if (url === '/admin/refresh') { broadcast({ t: 'reset' }); return res.end('{"ok":true}'); }
    // Tell open pages to save their progress and reload into the newest version.
    if (url === '/admin/update') { broadcast({ t: 'update' }); return res.end('{"ok":true}'); }
    return res.end('{}');
  }
  if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (url === '/' || url === '/index.html') return sendFile(res, 'index.html', 'text/html; charset=utf-8');
  if (url === '/sim.js') return sendFile(res, 'sim.js', 'text/javascript; charset=utf-8');
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });
const clients = new Map();
let nextId = 1;
let kbHolder = null, kbItem = -1; // who is carrying the KB tube (not yet reported)
let partyUntil = 0; // easter egg: a dance party is running until this time

function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); }
function broadcast(msg, exceptId) {
  const s = JSON.stringify(msg);
  for (const c of clients.values()) if (c.joined && c.id !== exceptId) send(c, s);
}
function joined() { return [...clients.values()].filter(c => c.joined); }
function peerInfo(c) { return { id: c.id, n: c.n, c: c.c, u: c.u || 0, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a, f: c.f, lv: c.lv }; }
function runInfo() { const r = world.run, n = Math.max(r.peak, joined().length, 1); return { t: 'run', day: r.day, bank: r.bank, quota: SIM.quotaFor(r.day, n, r.sentence, r.mood), curse: r.curse || 0, mood: r.mood, site: r.site, sentence: r.sentence || 1, seed: r.seed, served: (world.meta && world.meta.served) || 0, angry: r.angry || 0 }; }
function near(a, b, r) { return Math.hypot(a.x - b.x, a.z - b.z) < r; }

wss.on('connection', ws => {
  if (clients.size >= MAX_CLIENTS) { ws.close(1013, 'camp is full'); return; }
  const c = { id: nextId++, ws, joined: false, n: 'Camper', c: 0, x: 0, y: 0, z: 40, r: 0, a: 0, f: 0, cy: -1, nz: 0, lv: 1, sc: 0, dnAt: 0, tokens: 80, last: Date.now(), alive: true };
  clients.set(c.id, c);
  send(c, {
    t: 'hello', id: c.id, day: world.day, fin: world.run.fin && world.run.fin.on ? world.run.fin : null, finNow: Date.now(),
    holes: Object.entries(world.holes).map(([k, d]) => { const [x, z] = k.split('|').map(Number); return [x, z, d]; }),
    got: [...gotSet], kb: world.kb, won: world.won, clock: world.clock,
    bags: Object.entries(world.bags).map(([id, b]) => ({ id: +id, ...b })),
    truck: truckInfo(), mission: { ...world.mission, now: Date.now() },
    breaches: world.breaches, rot: world.rot,
    props: Object.entries(world.props).map(([id, p]) => ({ id: +id, type: p.type, x: p.x, z: p.z, name: p.name })),
    peers: [...clients.values()].filter(p => p.joined && p.id !== c.id).map(peerInfo),
  });

  ws.on('pong', () => { c.alive = true; });
  ws.on('message', raw => {
    const now = Date.now();
    c.tokens = Math.min(80, c.tokens + (now - c.last) * 0.04); c.last = now;
    if (c.tokens < 1) return;
    c.tokens -= 1;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'join') {
      c.n = cleanName(m.n); c.c = num(m.c, 0, 7, 0) | 0; c.u = num(m.u, 0, 5, 0) | 0;
      c.host = m.host === HOST_TOKEN || world.hostNames.includes(c.n.toLowerCase()); c.v = num(m.v, 0, 99, 0) | 0;
      send(c, { t: 'host', on: !!c.host });
      const pr = world.players[c.n.toLowerCase()];
      if (pr) send(c, { t: 'prog', xp: pr.xp });
      if (!c.joined) {
        c.joined = true; broadcast({ t: 'join', ...peerInfo(c) }, c.id);
        const r = world.recent[c.n.toLowerCase()];
        if (m.fresh === true && r && Date.now() - r.at < RECENT_MS) send(c, { t: 'restore', sc: r.sc, x: r.x, z: r.z });
        world.run.peak = Math.max(world.run.peak, joined().length); dirty = true;
        broadcast(runInfo());
      }
      return;
    }
    if (!c.joined) return;
    switch (m.t) {
      case 'pos':
        c.x = num(m.x, -620, 2100, c.x); c.y = num(m.y, -40, 80, c.y); c.z = num(m.z, -620, 620, c.z);
        c.r = num(m.r, -10, 10, c.r); c.a = num(m.a, 0, 4, 0) | 0; c.sc = num(m.sc, 0, 1e6, 0) | 0; c.sv = num(m.sv, 0, 1e5, 0) | 0;
        // flags: 1 hidden in a deep hole, 2 downed, 4 flashlight on, 8 crouching, 16 stuck in a hole
        c.vy = num(m.vy, -100, 100, 0); c.f = num(m.f, 0, 65535, 0) | 0; c.cy = num(m.cy, -2, 1e7, -1) | 0; c.nz = num(m.nz, 0, 1, 0); c.lv = num(m.lv, 1, 99, 1) | 0;
        world.recent[c.n.toLowerCase()] = { sc: c.sc, x: c.x, z: c.z, at: Date.now() };
        broadcast({ t: 'pos', id: c.id, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a, f: c.f, lv: c.lv }, c.id);
        break;
      case 'dig': {
        const x = r1(num(m.x, -595, 595, 0)), z = r1(num(m.z, -595, 595, 0)), d = Math.round(num(m.d, 0, 2.6, 0) * 100) / 100;
        const k = x + '|' + z;
        if (!(k in world.holes) && Object.keys(world.holes).length >= MAX_HOLES) return;
        if ((world.holes[k] || 0) >= d) return;
        world.holes[k] = d; dirty = true;
        broadcast({ t: 'dig', id: c.id, x, z, d }, c.id);
        break;
      }
      case 'got': {
        const item = num(m.item, 0, MAX_ITEM, -1) | 0;
        if (item < 0 || gotSet.has(item)) return;
        gotSet.add(item); dirty = true;
        if (m.kb === true && !world.kb) { kbHolder = c.id; kbItem = item; }
        broadcast({ t: 'got', id: c.id, item }, c.id);
        break;
      }
      case 'sell': {
        // Selling at Mr. Sir's truck pays the team bank toward today's quota.
        const v = num(m.v, 0, 3000, 0) | 0; if (!v) return;
        world.run.bank += v; dirty = true;
        broadcast(runInfo());
        break;
      }
      case 'prop': {
        // Someone dug up something too heavy for the sack. It sits on the ground until campers carry it to the truck.
        const id = num(m.item, 0, MAX_ITEM, -1) | 0, type = String(m.type);
        if (id < 0 || !(type in SIM.HEAVY) || world.props[id] || Object.keys(world.props).length >= MAX_PROPS) return;
        world.props[id] = { type, x: r2(num(m.x, -595, 2100, 0)), z: r2(num(m.z, -595, 595, 0)) }; dirty = true;
        broadcast({ t: 'prop', id, ...world.props[id] });
        break;
      }
      case 'bag': {
        // A camper got caught and dropped their sack. Anyone can pick it up.
        const items = (Array.isArray(m.items) ? m.items : []).filter(t => LOOT_KEYS.includes(t)).slice(0, 12);
        if (!items.length) return;
        const ids = Object.keys(world.bags); if (ids.length >= MAX_BAGS) delete world.bags[ids[0]];
        const id = nextObj++; world.bags[id] = { x: r2(num(m.x, -600, 600, 0)), z: r2(num(m.z, -600, 600, 0)), items, n: c.n }; dirty = true;
        broadcast({ t: 'bag', id, ...world.bags[id] });
        break;
      }
      case 'grab': {
        const id = num(m.id, 0, 1e9, -1) | 0, b = world.bags[id];
        if (!b || !near(c, b, HELP_RANGE)) return;
        delete world.bags[id]; dirty = true;
        send(c, { t: 'grabbed', id, items: b.items, n: b.n });
        broadcast({ t: 'bagGone', id }, c.id);
        break;
      }
      case 'xp': {
        const k = c.n.toLowerCase(), xp = num(m.xp, 0, 1e8, 0) | 0;
        if (!world.players[k] || world.players[k].xp < xp) { world.players[k] = { xp }; dirty = true; }
        break;
      }
      case 'revive': case 'pull': {
        // Picking up a downed friend, or pulling one out of a deep hole: you have to be standing next to them.
        const o = clients.get(num(m.id, 0, 1e9, -1) | 0);
        if (!o || !o.joined || o === c || !near(c, o, HELP_RANGE)) return;
        if (m.t === 'revive') { o.dnAt = 0; o.f &= ~2; curse(-6); broadcast(runInfo()); }
        send(o, { t: m.t === 'revive' ? 'revived' : 'pulled', by: c.n });
        break;
      }
      case 'spend': {
        // spending the crew's shared seeds (the shop, blackjack): refused if the crew can't afford it
        const v = num(m.v, 0, 1e5, 0) | 0; if (!v) return;
        if (world.run.bank < v) { send(c, runInfo()); return; }
        world.run.bank -= v; dirty = true; broadcast(runInfo());
        break;
      }
      case 'out': {
        // nobody picked them up in time: they're out until morning, and their body stays where they fell
        if (c.f & 64) return;
        c.f |= 64; curse(10);
        const id = 900000 + c.id; delete world.props[id];
        world.props[id] = { type: 'body', owner: c.id, name: c.n, x: r2(num(m.x, -600, 600, c.x)), z: r2(num(m.z, -600, 600, c.z)) };
        broadcast({ t: 'prop', id, ...world.props[id] }); broadcast(runInfo());
        break;
      }
      case 'cave': {
        // a hole caved in: it's shallower now, and whoever was inside is buried
        const x = r1(num(m.x, -595, 595, 0)), z = r1(num(m.z, -595, 595, 0)), d = Math.round(num(m.d, 0, 2.6, 0) * 100) / 100, k = x + '|' + z;
        if (!(k in world.holes)) return;
        world.holes[k] = d; dirty = true;
        broadcast({ t: 'cave', id: c.id, x, z, d }, c.id);
        break;
      }
      case 'unbury': {
        const o = clients.get(num(m.id, 0, 1e9, -1) | 0);
        if (!o || !o.joined || o === c || !near(c, o, HELP_RANGE)) return;
        send(o, { t: 'unburied', by: c.n });
        break;
      }
      case 'curse':
        // small curse events a client notices itself (breaking fragile loot)
        if (m.k === 'broke') { curse(3); broadcast(runInfo()); }
        break;
      case 'breach': {
        // an 8-foot hole broke through into the buried town
        const x = r1(num(m.x, -595, 595, 0)), z = r1(num(m.z, -595, 595, 0)), k = x + '|' + z;
        if ((world.holes[k] || 0) < 2.35 || world.breaches[k]) return;
        world.breaches[k] = { x, z, at: Date.now(), ladder: false, closed: false }; dirty = true;
        broadcast({ t: 'breach', k, ...world.breaches[k] });
        break;
      }
      case 'ladder': {
        const b = world.breaches[String(m.k)]; if (!b || b.closed || b.ladder) return;
        b.ladder = true; dirty = true; broadcast({ t: 'ladder', k: String(m.k) });
        break;
      }
      case 'rot': {
        const i = num(m.i, 0, 35, -1) | 0; if (i < 0 || world.rot.includes(i)) return;
        world.rot.push(i); dirty = true; broadcast({ t: 'rot', i });
        break;
      }
      case 'propMove': {
        // someone carried heavy loot up the old stairwell: it comes up with them
        const id = num(m.id, 0, 1e7, -1) | 0, p = world.props[id];
        if (!p || c.cy !== id) return;
        p.x = r2(num(m.x, -600, 3000, p.x)); p.z = r2(num(m.z, -600, 600, p.z)); dirty = true;
        broadcast({ t: 'props', list: [[id, p.x, p.z, p.n || 0]] });
        break;
      }
      case 'zback': {
        // piggyback Madame Zeroni during the finale
        const f = world.run.fin; if (!f || !f.on) return;
        if (m.on === true) { if (f.holder != null || Math.hypot(c.x - f.zx, c.z - f.zz) > 3.5) return; f.holder = c.id; }
        else { if (f.holder !== c.id) return; f.holder = null; f.zx = c.x; f.zz = c.z; }
        dirty = true; broadcast({ t: 'finale', fin: f, now: Date.now() });
        break;
      }
      case 'curseBroken': {
        // sung to at the top of Big Thumb: the carrier (or someone right next to them) must be up there
        const f = world.run.fin; if (!f || !f.on) return;
        const h = clients.get(f.holder); if (!h || h.y < SIM.THUMB.y0 + SIM.THUMB.h - 3 || Math.hypot(c.x - h.x, c.z - h.z) > 10) return;
        f.on = false; broadcast({ t: 'curseBroken', by: c.n });
        setTimeout(() => endSentence(true), 15000);
        break;
      }
      case 'boost': case 'pullUp': {
        // climbing Big Thumb together: boost the friend above you, or pull the friend below you up to your ledge
        const o = clients.get(num(m.id, 0, 1e9, -1) | 0);
        if (!o || !o.joined || o === c || !near(c, o, 4.5)) return;
        send(o, { t: m.t === 'boost' ? 'boosted' : 'pulledUp', by: c.n, y: num(m.y, -40, 80, 0) });
        break;
      }
      case 'misStart': {
        // anyone at camp can send the crew out; the Warden picks a fresh patch of the lake
        if (!MISSIONS || world.mission.phase !== 'hub') return;
        world.mission = SIM.newMission(world.run.seed, (world.mission.trip || 0) + 1, now);
        world.clock = { off: 0, paused: true, pt: SIM.DAYMS * 0.45 }; broadcast({ t: 'clock', ...world.clock });
        dirty = true; broadcast(missionInfo()); broadcast({ t: 'truckNote', k: 'misStart', n: c.n });
        break;
      }
      case 'truckRent': case 'truckSteal': {
        if (MISSIONS) return;
        const T = world.truck; if (T.mode !== 'parked' || !near(c, T, 6)) return;
        const night = SIM.clockT(world.clock, now) >= SIM.curfewT(world.run.day);
        if (m.t === 'truckRent') {
          if (night) return;
          const price = Math.round(SIM.TRUCK.RENT * (world.run.angry ? 1.5 : 1));
          if (world.run.bank < price) { send(c, runInfo()); return; }
          world.run.bank -= price; T.mode = 'rented'; T.until = now + SIM.TRUCK.SECS * 1000; broadcast(runInfo()); truckNote('rented', { n: c.n, price });
        } else { if (!night) return; T.mode = 'stolen'; truckNote('stolen', { n: c.n }); }
        dirty = true; broadcast(truckInfo());
        break;
      }
      case 'truckDrive': {
        if (MISSIONS) return; // Mr. Sir drives on missions
        const T = world.truck;
        if (m.on === true) { if (T.mode === 'parked' || T.driver != null || !near(c, T, 5)) return; T.driver = c.id; }
        else if (T.driver === c.id) { T.driver = null; T.sp = 0; } else return;
        dirty = true; broadcast(truckInfo());
        break;
      }
      case 'truckPos': {
        const T = world.truck; if (T.driver !== c.id) return;
        T.x = r2(num(m.x, -600, 600, T.x)); T.z = r2(num(m.z, -600, 600, T.z)); T.h = r2(num(m.h, -1e3, 1e3, T.h)); T.sp = r2(num(m.sp, -20, 20, 0));
        broadcast({ t: 'tpos', x: T.x, z: T.z, h: T.h, sp: T.sp }, c.id);
        break;
      }
      case 'truckStuck': { const T = world.truck; if (T.driver !== c.id || T.stuck) return; T.stuck = true; T.push = 0; T.dig = 0; T.pushers = {}; T.sp = 0; broadcast(truckInfo()); truckNote('stuck'); break; }
      case 'truckPush': { const T = world.truck; if (!T.stuck || !near(c, T, 6)) return; (T.pushers = T.pushers || {})[c.id] = { at: now, tow: m.tow === true }; break; }
      case 'truckDig': { const T = world.truck; if (!T.stuck || !near(c, T, 6)) return; T.dig = (T.dig || 0) + 1; if (T.dig >= 8) unstick(); break; }
      case 'truckWater': { const T = world.truck; if (T.tank < 10 || !near(c, T, 6)) return; T.tank -= 10; send(c, { t: 'truckWaterOk' }); broadcast(truckInfo()); break; }
      case 'truckLoad': {
        const T = world.truck, id = num(m.id, 0, 1e7, -1) | 0, p = world.props[id];
        if (!p || p.type === 'body' || p.cargo || c.cy !== id || !near(c, T, 6) || T.mode === 'parked') return;
        p.cargo = true; dirty = true; broadcast({ t: 'cargo', id, on: true });
        break;
      }
      case 'bonk':
        // shovel swing: squashes critters in front of the camper (results go out with the next monster update)
        if (now - (c.bonkAt || 0) < 600) return;
        c.bonkAt = now;
        SIM.bonk(MON, { id: c.id, x: c.x, z: c.z, fa: c.r }, pendingEv);
        break;
      case 'ping':
        broadcast({ t: 'ping', id: c.id, x: r1(num(m.x, -600, 600, 0)), z: r1(num(m.z, -600, 600, 0)) });
        break;
      case 'chat': {
        // Proximity chat: only campers within earshot see it.
        const s = cleanChat(m.s); if (!s) return;
        c.nz = 1; c.chatAt = Date.now();
        for (const o of clients.values()) if (o.joined && o !== c && (near(c, o, CHAT_RANGE) || ((c.f & 8192) && (o.f & 8192)))) send(o, { t: 'chat', id: c.id, s });
        break;
      }
      case 'admin':
        // Buttons in the hidden admin panel. Only the host can use them.
        if (!c.host) return;
        if (m.a === 'fill') { world.run.bank = runInfo().quota; dirty = true; broadcast(runInfo()); }
        else if (m.a === 'seeds') { world.run.bank += 100; dirty = true; broadcast(runInfo()); }
        else if (m.a === 'empty') { world.run.bank = 0; dirty = true; broadcast(runInfo()); }
        else if (m.a === 'curseUp' || m.a === 'curseDown') { curse(m.a === 'curseUp' ? 20 : -20); broadcast(runInfo()); }
        else if (m.a === 'mood') { const ks = Object.keys(SIM.MOODS); world.run.mood = ks[(ks.indexOf(world.run.mood) + 1) % ks.length]; dirty = true; broadcast({ ...runInfo(), t: 'dawn' }); }
        else if (m.a === 'site') { const ks = Object.keys(SIM.SITES); world.run.site = ks[(ks.indexOf(world.run.site) + 1) % ks.length]; dirty = true; broadcast({ ...runInfo(), t: 'dawn' }); }
        else if (m.a === 'misEnd' && world.mission.phase === 'site') { world.mission.endsAt = Date.now() + 15000; world.mission.horn = 3; broadcast(missionInfo()); }
        else if (m.a === 'misMore' && world.mission.phase === 'site') { world.mission.endsAt += 60000; broadcast(missionInfo()); }
        else if (m.a === 'day') { world.run.day = world.run.day % SIM.DAYS + 1; dirty = true; broadcast({ ...runInfo(), t: 'dawn' }); }
        break;
      case 'disco': {
        const now = Date.now();
        if (now < partyUntil) { send(c, { t: 'nodisco', busy: true }); return; }
        if (c.lastDisco && now - c.lastDisco < DISCO_COOLDOWN_MS) { send(c, { t: 'nodisco' }); return; }
        c.lastDisco = now; partyUntil = now + PARTY_SECS * 1000;
        broadcast({ t: 'party', id: c.id, n: c.n, dur: PARTY_SECS });
        return;
      }
      case 'clock':
        // Only the host can move the camp clock (the hidden admin panel in the game).
        if (!c.host) return;
        world.clock = { off: num(m.off, -1e13, 1e13, 0), paused: m.paused === true, pt: num(m.pt, 0, 12 * 60 * 1000, 0) }; dirty = true;
        broadcast({ t: 'clock', ...world.clock }, c.id);
        break;
      case 'twerk':
        // emote: everyone nearby sees it and hears the fart at the end (and so does Zeroni)
        if (Date.now() - (c.twerkAt || 0) < 2000) return;
        c.twerkAt = Date.now(); c.nz = 1; c.chatAt = Date.now();
        broadcast({ t: 'twerk', id: c.id }, c.id);
        break;
      case 'say':
        c.nz = 1; c.chatAt = Date.now();
        broadcast({ t: 'say', id: c.id, i: num(m.i, 0, 4, 0) | 0 }, c.id);
        break;
      case 'kb':
        if (world.kb) return;
        world.kb = c.n; dirty = true; kbHolder = null;
        broadcast({ t: 'kb', n: c.n }, c.id);
        break;
      case 'win':
        if (world.won) return;
        world.won = c.n; world.wonAt = Date.now(); dirty = true;
        broadcast({ t: 'win', n: c.n }, c.id);
        break;
    }
  });
  ws.on('close', () => {
    clients.delete(c.id);
    if (kbHolder === c.id && !world.kb) {
      // The camper walked off with the gold tube without reporting it: put it back in the ground.
      kbHolder = null;
      if (gotSet.delete(kbItem)) { dirty = true; broadcast({ t: 'ungot', item: kbItem }); }
    }
    if (c.joined) broadcast({ t: 'leave', id: c.id });
  });
});

/* ---- shared rules, 10 times a second: heavy loot, night monsters, and the quota at curfew ---- */
const MON = { trucks: [], zer: null, mobs: [] };
let pendingEv = [];
let lastT = SIM.clockT(world.clock, Date.now()), lastTick = Date.now(), monOn = false;
const curse = d => { world.run.curse = clamp((world.run.curse || 0) + d, 0, 100); dirty = true; };
// flags on pos: 1 hidden in a deep hole, 2 downed, 4 flashlight, 8 crouching, 16 stuck in a hole, 32 buried by a cave-in, 64 out until morning
function simPlayers(now) {
  return joined().filter(c => !(c.f & 64)).map(c => ({
    id: c.id, x: c.x, z: c.z, fa: c.r, cy: c.cy, a: c.a, vy: c.vy,
    br: !!(c.f & 16384), hd: !!(c.f & 1), cr: !!(c.f & 8), lt: !!(c.f & 4), tn: !!(c.f & 128), sg: !!(c.f & 256), kt: !!(c.f & 512), on: !!(c.f & 1024),
    dn: !!(c.f & 2) || now - c.dnAt < 2000,
    nz: now - (c.chatAt || 0) < 3000 ? 1 : c.nz,
  }));
}
function endOfDay() {
  const js = joined(); if (!js.length) return;
  // roll call: everyone who isn't inside the fence (and isn't lying in the nurse's office) costs the crew
  const missing = js.filter(c => !SIM.inCamp(c.x, c.z) && !(c.f & 64));
  if (missing.length) { world.run.bank = Math.max(0, world.run.bank - 25 * missing.length); curse(8 * missing.length); } else curse(-4);
  broadcast({ t: 'rollcall', missing: missing.map(c => c.n), fine: 25 * missing.length });
  const q = runInfo(), played = world.run.played || 0;
  world.run.played = 0;
  if (world.run.bank < q.quota && played < 180) { broadcast({ t: 'grace' }); broadcast(runInfo()); return; } // the crew only just got here: no check today
  if (world.run.bank >= q.quota) {
    world.run.bank -= q.quota; dirty = true;
    if (world.run.day >= SIM.DAYS) {
      // the sentence is served, but the curse still has to be broken: the finale starts tonight
      world.run.fin = { on: true, start: Date.now(), waterAt: 0, holder: null, zx: 0, zz: 24 }; dirty = true;
      broadcast({ ...runInfo(), t: 'finale', fin: world.run.fin, now: Date.now() });
      return;
    }
    world.run.day++; world.run.peak = joined().length;
    broadcast({ ...runInfo(), t: 'quota', met: true, paid: q.quota });
  } else {
    // Fired: the run starts over. The lake is refilled and the crew's seeds and gear are gone (levels stay).
    const got = q.bank;
    world = Object.assign(freshWorld(1), { hostNames: world.hostNames, clock: world.clock, players: world.players, meta: world.meta, run: freshRun(world.run.sentence || 1) });
    gotSet = new Set(); kbHolder = null; dirty = true; save();
    broadcast({ t: 'fired', bank: got, quota: q.quota });
  }
}
function endSentence(broken) {
  // the crew is released; if they broke the curse too, that's the true ending. Next sentence is harder.
  const done = world.run.sentence || 1;
  world.meta = world.meta || { served: 0, best: 0, broken: 0 }; world.meta.served++; world.meta.best = Math.max(world.meta.best, done); if (broken) world.meta.broken = (world.meta.broken || 0) + 1;
  world = Object.assign(freshWorld(1), { hostNames: world.hostNames, clock: world.clock, players: world.players, meta: world.meta, run: freshRun(done + 1) });
  gotSet = new Set(); kbHolder = null; dirty = true; save();
  broadcast({ t: 'served', sentence: done, next: done + 1, broken: !!broken });
}
function finTick(now) {
  const f = world.run.fin; if (!f || !f.on) return;
  const h = f.holder != null ? clients.get(f.holder) : null;
  if (f.holder != null && (!h || !h.joined || (h.f & 66))) { if (h) { f.zx = h.x; f.zz = h.z; } f.holder = null; broadcast({ t: 'finale', fin: f, now: Date.now() }); }
  if (h) { f.zx = h.x; f.zz = h.z; }
  // the flood starts once Madame Zeroni reaches the mountain (or after a while anyway)
  if (!f.waterAt && (Math.hypot(f.zx - SIM.THUMB.x, f.zz - SIM.THUMB.z) < SIM.THUMB.mound + 4 || now - f.start > 150000)) { f.waterAt = now; broadcast({ t: 'finale', fin: f, now: Date.now() }); }
  if (f.waterAt && SIM.waterAt(f, now) > SIM.THUMB.y0 + SIM.THUMB.h + 2) { f.on = false; broadcast({ t: 'finaleLost' }); endSentence(false); }
}
/* ---- the water truck ---- */
function truckNote(k, extra) { broadcast({ t: 'truckNote', k, ...(extra || {}) }); }
function unstick() { const T = world.truck; T.stuck = false; T.push = 0; T.dig = 0; T.pushers = {}; dirty = true; broadcast(truckInfo()); truckNote('free'); }
function truckCaught() {
  // the police got the truck back: a fine, more curse, and Mr. Sir raises prices for two days
  const T = world.truck;
  for (const id in world.props) { const p = world.props[id]; if (p.cargo) { p.cargo = false; p.x = r2(T.x + 3); p.z = r2(T.z); p.moved = true; } }
  world.run.bank = Math.max(0, world.run.bank - 60); world.run.curse = clamp((world.run.curse || 0) + 15, 0, 100); world.run.angry = 2;
  Object.assign(T, freshTruck()); dirty = true;
  broadcast(truckInfo()); broadcast(runInfo()); truckNote('caught', { fine: 60 });
}
function truckTick(now, dt) {
  const T = world.truck;
  if (T.driver != null && !(clients.get(T.driver) || {}).joined) { T.driver = null; broadcast(truckInfo()); }
  if (T.mode === 'rented' && now > T.until) { T.mode = 'late'; dirty = true; broadcast(truckInfo()); truckNote('late'); }
  // pushing a stuck truck: two campers (twice as fast if one has a tow rope)
  if (T.stuck) {
    const ps = Object.values(T.pushers || {}).filter(p => now - p.at < 1200);
    if (ps.length >= 2) { T.push = (T.push || 0) + dt * (ps.some(p => p.tow) ? 2 : 1); if (T.push >= 3) unstick(); }
  }
  // cargo rides in the truck bed (and sells itself at Mr. Sir's truck in camp)
  const moved = [];
  for (const id in world.props) { const p = world.props[id]; if (p.cargo) { p.x = r2(T.x); p.z = r2(T.z); moved.push([+id, p.x, p.z, 0]); } }
  if (moved.length && (T.sp || 0) !== 0) broadcast({ t: 'props', list: moved });
  // brought back inside the fence: a rental is returned; a stolen truck got away with it
  if (T.mode !== 'parked' && !SIM.inCamp(T.x, T.z)) T.out = true;
  if (T.mode !== 'parked' && T.out && SIM.inCamp(T.x, T.z) && Math.abs(T.sp || 0) < 1 && T.driver == null && !T.stuck) {
    const was = T.mode; T.mode = 'parked'; T.until = 0; T.out = false; T.tank = SIM.TRUCK.TANK; dirty = true;
    broadcast(truckInfo()); truckNote('returned', { was });
  }
}
/* ---- missions (GAME_DESIGN.md sections 4-8): the truck takes the crew out, and only what's aboard when it leaves counts ---- */
function missionInfo() { return { t: 'mission', ...world.mission, now: Date.now() }; }
function missionTick(now, dt) {
  const MS = world.mission, T = world.truck, ev = [];
  SIM.stepMission(MS, now, ev);
  for (const e of ev) {
    if (e.k === 'arrive') {
      // the truck parks in the middle of the site, nose pointing home; it's the only way back
      const h = Math.atan2(-(0 - MS.cx), -(20 - MS.cz));
      Object.assign(T, { x: MS.cx, z: MS.cz, h, sp: 0, mode: 'mission', driver: null, stuck: false, tank: SIM.TRUCK.TANK, out: false, until: 0 });
      broadcast(truckInfo());
    }
    if (e.k === 'depart') missionDepart();
    if (e.k === 'home') {
      Object.assign(T, freshTruck()); broadcast(truckInfo());
      for (const id in world.props) { delete world.props[id]; broadcast({ t: 'propGone', id: +id }); }
    }
    dirty = true; broadcast({ ...missionInfo(), ev: e.k, n: e.n || 0 });
  }
  // the last seconds: the truck rolls away slowly, and you can still run and jump aboard
  if (MS.phase === 'site' && (MS.endsAt - now) / 1000 <= SIM.MISSION.ROLL) {
    T.x += -Math.sin(T.h) * SIM.MISSION.ROLLSP * dt; T.z += -Math.cos(T.h) * SIM.MISSION.ROLLSP * dt; T.sp = SIM.MISSION.ROLLSP;
    broadcast({ t: 'tpos', x: r2(T.x), z: r2(T.z), h: r2(T.h), sp: T.sp });
  }
}
function missionDepart() {
  // campers riding in the truck bed make it home; everything else stays out there
  const MS = world.mission, T = world.truck, js = joined();
  const aboard = js.filter(c => (c.f & 32768) && !(c.f & 66)), lost = js.filter(c => !aboard.includes(c));
  let payout = 0; const items = [];
  for (const c of aboard) if (c.sv) { payout += c.sv; items.push(`${c.n}'s sack: ${c.sv}`); }
  for (const id in world.props) {
    const p = world.props[id]; if (p.type === 'body') continue;
    if (p.cargo || Math.hypot(p.x - T.x, p.z - T.z) < SIM.MISSION.BED) { const v = SIM.HEAVY[p.type] || 0; payout += v; items.push(`${p.type}: ${v}`); delete world.props[id]; broadcast({ t: 'propGone', id: +id }); }
  }
  world.run.bank += payout;
  MS.results = { payout, aboard: aboard.map(c => c.n), lost: lost.map(c => c.n), items, failed: aboard.length === 0 };
  broadcast(runInfo());
}
function dawn() {
  world.run.angry = Math.max(0, (world.run.angry || 0) - 1);
  // a new morning: the Warden picks today's mood and dig site; anyone out cold wakes up in the nurse's office
  Object.assign(world.run, SIM.rollDay(world.run.seed, world.run.day, world.run.curse, world.run.sentence)); dirty = true;
  for (const id in world.props) if (world.props[id].type === 'body') delete world.props[id];
  for (const k in world.breaches) { const b = world.breaches[k]; if (!b.closed) world.holes[k] = Math.min(world.holes[k] || 0, 1); }
  world.breaches = {}; world.rot = []; layCache.key = '';
  broadcast({ ...runInfo(), t: 'dawn' });
}
setInterval(() => {
  const now = Date.now(), dt = Math.min(0.25, (now - lastTick) / 1000); lastTick = now;
  const t = SIM.clockT(world.clock, now), cur = SIM.curfewT(world.run.day);
  if (!MISSIONS) {
    if (lastT < cur && t >= cur) endOfDay();
    else if (lastT - t > SIM.CYCLE / 2 && !(world.run.fin && world.run.fin.on)) dawn();
  }
  lastT = t;
  if (t < cur && joined().length) world.run.played = (world.run.played || 0) + dt;
  if (MISSIONS) missionTick(now, dt); else finTick(now);
  truckTick(now, dt);
  const players = simPlayers(now);
  // heavy loot and bodies being carried
  const sold = SIM.stepProps(world.props, players, dt);
  const moved = [];
  for (const id in world.props) { const p = world.props[id]; if (p.moved) { p.moved = false; p.x = r2(p.x); p.z = r2(p.z); moved.push([+id, p.x, p.z, p.n]); } }
  if (moved.length) broadcast({ t: 'props', list: moved });
  // a shaft into the buried town only holds for 4 minutes before it caves in
  for (const k in world.breaches) { const b = world.breaches[k]; if (!b.closed && now - b.at > 240000) { b.closed = true; world.holes[k] = 1; dirty = true; broadcast({ t: 'shaftClosed', k, x: b.x, z: b.z }); } }
  for (const id of sold) {
    const p = world.props[id]; delete world.props[id];
    if (p.type === 'body') {
      // carried back inside the fence: the nurse wakes them up, sack and all
      const o = clients.get(p.owner); if (o) send(o, { t: 'revived', by: 'The nurse', body: true });
      curse(-6); broadcast({ t: 'bodyHome', id: +id, n: p.name, who: p.who || [] }); broadcast(runInfo());
      continue;
    }
    const v = SIM.HEAVY[p.type] * (world.run.mood === 'digday' ? 2 : 1);
    world.run.bank += v; dirty = true;
    broadcast({ t: 'psold', id: +id, v, who: p.who || [] }); broadcast(runInfo());
  }
  // monsters
  const ev = pendingEv; pendingEv = [];
  if (!MISSIONS) SIM.stepMonsters(MON, players, t, dt, ev, { curfew: cur, split: SIM.nightSplit(cur, world.run.curse, world.run.mood), run: world.run, wanted: world.truck.mode === 'stolen' || world.truck.mode === 'late' ? { x: world.truck.x, z: world.truck.z } : null, finale: !!(world.run.fin && world.run.fin.on), town: (M, tps, dt2, ev2) => SIM.stepTown(M, tps, dt2, ev2, layout(), world.run.day) });
  for (const e of ev) { if (e.k === 'truckCaught') truckCaught(); if (e.k === 'down') { const c = clients.get(e.id); if (c) c.dnAt = now; } if (e.k === 'appeased') { curse(-25); broadcast(runInfo()); } }
  const on = MON.trucks.length > 0 || !!MON.zer || MON.mobs.length > 0 || ev.length > 0;
  if (on || monOn) broadcast({ t: 'mon', trucks: MON.trucks.map(k => [r2(k.x), r2(k.z), r2(k.h), k.mode === 'chase' ? 1 : 0]), zer: MON.zer ? [r2(MON.zer.x), r2(MON.zer.z), MON.zer.tgt, MON.zer.drag, MON.zer.held ? 1 : 0, r2(MON.zer.song || 0)] : null, mobs: SIM.packMobs(MON), ev });
  monOn = on;
  for (const c of clients.values()) c.nz *= 0.9;
}, 100);

setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false; try { c.ws.ping(); } catch (e) { /* closing */ }
  }
}, 30000);

process.on('SIGINT', () => { dirty = true; save(); setTimeout(() => process.exit(0), 300); });
process.on('SIGTERM', () => { dirty = true; save(); setTimeout(() => process.exit(0), 300); });

server.listen(PORT, '127.0.0.1', () => console.log(`Camp Green Lake listening on 127.0.0.1:${PORT}`));
