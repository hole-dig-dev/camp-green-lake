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
const MAX_ITEM = 10000;
const MAX_BAGS = 60, MAX_PROPS = 40;
const NEW_DAY_AFTER_WIN_MS = 10 * 60 * 1000;
// Token for the admin endpoints (curl over SSH). Set HOST_TOKEN in the environment;
// without it a random one is generated, which effectively turns the admin endpoints off.
// DEV_MODE=1 (the play-test server): every camper gets host powers, so anyone testing can use the in-game
// console and admin panel. Never set it on the server your friends play on.
const DEV_MODE = process.env.DEV_MODE === '1';
const HOST_TOKEN = process.env.HOST_TOKEN || require('crypto').randomBytes(24).toString('hex');
const PARTY_SECS = 60, DISCO_COOLDOWN_MS = 3 * 60 * 1000;
const RECENT_MS = 60 * 60 * 1000;
const CHAT_RANGE = 30, HELP_RANGE = 3.5;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? clamp(v, a, b) : d; };
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} _'.-]/gu, '').trim().slice(0, 16) || 'Camper';
const cleanChat = s => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80);
const LOOT_KEYS = ['cap', 'can', 'spoon', 'shoe', 'arrow', 'jar', 'fossil', 'lipstick', 'sploosh', 'locket', 'pistol'];

function freshRun() { return { day: 1, bank: 0, peak: 1 }; }
function freshWorld(day) { return { day, holes: {}, got: [], kb: null, won: null, wonAt: 0, recent: {}, hostNames: [], bags: {}, props: {} }; }
let world = freshWorld(1);
try { world = Object.assign(freshWorld(1), JSON.parse(fs.readFileSync(SAVE, 'utf8'))); } catch (e) { /* first run */ }
if (!world.recent || typeof world.recent !== 'object') world.recent = {};
if (!Array.isArray(world.hostNames)) world.hostNames = [];
if (!world.clock || typeof world.clock !== 'object') world.clock = { off: 0, paused: false, pt: 0 };
if (!world.run || typeof world.run !== 'object') world.run = freshRun();
if (!world.players || typeof world.players !== 'object') world.players = {};
if (!world.bags || typeof world.bags !== 'object') world.bags = {};
if (!world.props || typeof world.props !== 'object') world.props = {};
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
function peerInfo(c) { return { id: c.id, n: c.n, c: c.c, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a, f: c.f, lv: c.lv }; }
function runInfo() { const n = Math.max(world.run.peak, joined().length, 1); return { t: 'run', day: world.run.day, bank: world.run.bank, quota: SIM.quotaFor(world.run.day, n) }; }
function near(a, b, r) { return Math.hypot(a.x - b.x, a.z - b.z) < r; }

wss.on('connection', ws => {
  if (clients.size >= MAX_CLIENTS) { ws.close(1013, 'camp is full'); return; }
  const c = { id: nextId++, ws, joined: false, n: 'Camper', c: 0, x: 0, y: 0, z: 40, r: 0, a: 0, f: 0, cy: -1, nz: 0, lv: 1, sc: 0, dnAt: 0, tokens: 80, last: Date.now(), alive: true };
  clients.set(c.id, c);
  send(c, {
    t: 'hello', id: c.id, day: world.day,
    holes: Object.entries(world.holes).map(([k, d]) => { const [x, z] = k.split('|').map(Number); return [x, z, d]; }),
    got: [...gotSet], kb: world.kb, won: world.won, clock: world.clock,
    bags: Object.entries(world.bags).map(([id, b]) => ({ id: +id, ...b })),
    props: Object.entries(world.props).map(([id, p]) => ({ id: +id, type: p.type, x: p.x, z: p.z })),
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
      c.n = cleanName(m.n); c.c = num(m.c, 0, 7, 0) | 0;
      c.host = DEV_MODE || m.host === HOST_TOKEN || world.hostNames.includes(c.n.toLowerCase()); c.v = num(m.v, 0, 99, 0) | 0;
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
        c.x = num(m.x, -620, 620, c.x); c.y = num(m.y, -5, 10, c.y); c.z = num(m.z, -620, 620, c.z);
        c.r = num(m.r, -10, 10, c.r); c.a = num(m.a, 0, 4, 0) | 0; c.sc = num(m.sc, 0, 1e6, 0) | 0;
        // flags: 1 hidden in a deep hole, 2 downed, 4 flashlight on, 8 crouching, 16 stuck in a hole
        c.f = num(m.f, 0, 255, 0) | 0; c.cy = num(m.cy, -1, MAX_ITEM, -1) | 0; c.nz = num(m.nz, 0, 1, 0); c.lv = num(m.lv, 1, 99, 1) | 0;
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
        world.props[id] = { type, x: r2(num(m.x, -595, 595, 0)), z: r2(num(m.z, -595, 595, 0)) }; dirty = true;
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
        if (m.t === 'revive') { o.dnAt = 0; o.f &= ~2; }
        send(o, { t: m.t === 'revive' ? 'revived' : 'pulled', by: c.n });
        break;
      }
      case 'ping':
        broadcast({ t: 'ping', id: c.id, x: r1(num(m.x, -600, 600, 0)), z: r1(num(m.z, -600, 600, 0)) });
        break;
      case 'chat': {
        // Proximity chat: only campers within earshot see it.
        const s = cleanChat(m.s); if (!s) return;
        c.nz = 1; c.chatAt = Date.now();
        for (const o of clients.values()) if (o.joined && o !== c && near(c, o, CHAT_RANGE)) send(o, { t: 'chat', id: c.id, s });
        break;
      }
      case 'admin':
        // Buttons in the hidden admin panel. Only the host can use them.
        if (!c.host) return;
        if (m.a === 'fill') { world.run.bank = runInfo().quota; dirty = true; broadcast(runInfo()); }
        else if (m.a === 'empty') { world.run.bank = 0; dirty = true; broadcast(runInfo()); }
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
      case 'env': {
        // An environmental hazard spawned from the in-game console (e.g. "twister"). Host only. The server just
        // relays it; every client builds the same hazard from the kind, position and heading.
        if (!c.host || typeof m.k !== 'string' || !/^[a-z]{1,16}$/.test(m.k)) return;
        broadcast({ t: 'env', id: c.id, n: c.n, k: m.k, x: r1(num(m.x, -600, 600, 0)), z: r1(num(m.z, -600, 600, 0)), a: num(m.a, -10, 10, 0) }, c.id);
        break;
      }
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
const MON = { trucks: [], zer: null };
let lastT = SIM.clockT(world.clock, Date.now()), lastTick = Date.now(), monOn = false;
function simPlayers(now) {
  return joined().map(c => ({
    id: c.id, x: c.x, z: c.z, fa: c.r, cy: c.cy,
    hd: !!(c.f & 1), cr: !!(c.f & 8),
    dn: !!(c.f & 2) || now - c.dnAt < 2000,
    nz: now - (c.chatAt || 0) < 3000 ? 1 : c.nz,
  }));
}
function endOfDay() {
  const q = runInfo(), played = world.run.played || 0;
  world.run.played = 0;
  if (!joined().length) return;
  if (world.run.bank < q.quota && played < 180) { broadcast({ t: 'grace' }); return; } // the crew only just got here: no check today
  if (world.run.bank >= q.quota) {
    world.run.day++; world.run.bank = 0; world.run.peak = joined().length; dirty = true;
    broadcast({ ...runInfo(), t: 'quota', met: true });
  } else {
    // Fired: the run starts over. The lake is refilled and everyone's seeds and gear are gone (levels stay).
    const got = q.bank;
    world = Object.assign(freshWorld(1), { hostNames: world.hostNames, clock: world.clock, players: world.players, run: freshRun() });
    gotSet = new Set(); kbHolder = null; dirty = true; save();
    broadcast({ t: 'fired', bank: got, quota: q.quota });
  }
}
setInterval(() => {
  const now = Date.now(), dt = Math.min(0.25, (now - lastTick) / 1000); lastTick = now;
  const t = SIM.clockT(world.clock, now);
  if (lastT < SIM.DAYMS && t >= SIM.DAYMS) endOfDay();
  lastT = t;
  if (t < SIM.DAYMS && joined().length) world.run.played = (world.run.played || 0) + dt;
  const players = simPlayers(now);
  // heavy loot
  const sold = SIM.stepProps(world.props, players, dt);
  const moved = [];
  for (const id in world.props) { const p = world.props[id]; if (p.moved) { p.moved = false; p.x = r2(p.x); p.z = r2(p.z); moved.push([+id, p.x, p.z, p.n]); } }
  if (moved.length) broadcast({ t: 'props', list: moved });
  for (const id of sold) {
    const p = world.props[id], v = SIM.HEAVY[p.type]; delete world.props[id];
    world.run.bank += v; dirty = true;
    broadcast({ t: 'psold', id: +id, v, who: p.who || [] }); broadcast(runInfo());
  }
  // monsters
  const ev = [];
  SIM.stepMonsters(MON, players, t, dt, ev);
  for (const e of ev) if (e.k === 'down') { const c = clients.get(e.id); if (c) c.dnAt = now; }
  const on = MON.trucks.length > 0 || !!MON.zer;
  if (on || monOn) broadcast({ t: 'mon', trucks: MON.trucks.map(k => [r2(k.x), r2(k.z), r2(k.h), k.mode === 'chase' ? 1 : 0]), zer: MON.zer ? [r2(MON.zer.x), r2(MON.zer.z), MON.zer.tgt, MON.zer.drag] : null, ev });
  monOn = on;
  for (const c of clients.values()) c.nz *= 0.9;
}, 100);

setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false; try { c.ws.ping(); } catch (e) { /* closing */ }
  }
  if (world.won && Date.now() - world.wonAt > NEW_DAY_AFTER_WIN_MS) {
    world = Object.assign(freshWorld(world.day + 1), { recent: world.recent, hostNames: world.hostNames, clock: world.clock, run: world.run, players: world.players }); gotSet = new Set(); kbHolder = null; dirty = true; save();
    broadcast({ t: 'reset' });
  }
}, 30000);

process.on('SIGINT', () => { dirty = true; save(); setTimeout(() => process.exit(0), 300); });
process.on('SIGTERM', () => { dirty = true; save(); setTimeout(() => process.exit(0), 300); });

server.listen(PORT, '127.0.0.1', () => console.log(`Camp Green Lake listening on 127.0.0.1:${PORT}`));
