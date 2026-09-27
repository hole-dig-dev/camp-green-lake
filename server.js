// Camp Green Lake multiplayer server: serves the game and relays campers over WebSocket.
// The world (holes, dug-up items, the KB tube, the suitcase) is kept here so late joiners see it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 4300;
const PUB = path.join(__dirname, 'public');
const SAVE = path.join(__dirname, 'data', 'world.json');
const MAX_CLIENTS = 40;
const MAX_HOLES = 9000;
const MAX_ITEM = 1000;
const NEW_DAY_AFTER_WIN_MS = 10 * 60 * 1000;
// Token for the admin endpoints (curl over SSH). Set HOST_TOKEN in the environment;
// without it a random one is generated, which effectively turns the admin endpoints off.
const HOST_TOKEN = process.env.HOST_TOKEN || require('crypto').randomBytes(24).toString('hex');
const PARTY_SECS = 60, DISCO_COOLDOWN_MS = 3 * 60 * 1000;
const RECENT_MS = 60 * 60 * 1000;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? clamp(v, a, b) : d; };
const r1 = v => Math.round(v * 10) / 10;
const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} _'.-]/gu, '').trim().slice(0, 16) || 'Camper';

function freshWorld(day) { return { day, holes: {}, got: [], kb: null, won: null, wonAt: 0, recent: {}, hostNames: [] }; }
let world = freshWorld(1);
try { world = Object.assign(freshWorld(1), JSON.parse(fs.readFileSync(SAVE, 'utf8'))); } catch (e) { /* first run */ }
if (!world.recent || typeof world.recent !== 'object') world.recent = {};
if (!Array.isArray(world.hostNames)) world.hostNames = [];
let gotSet = new Set(world.got);
let dirty = false;

function save() {
  if (!dirty) return;
  dirty = false;
  world.got = [...gotSet];
  fs.mkdirSync(path.dirname(SAVE), { recursive: true });
  fs.writeFile(SAVE + '.tmp', JSON.stringify(world), err => { if (!err) fs.rename(SAVE + '.tmp', SAVE, () => {}); });
}
setInterval(() => { if (Object.keys(world.recent).length) dirty = true; save(); }, 15000);

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url.startsWith('/admin/')) {
    // Admin controls for the host, used over SSH: curl -H 'x-admin: <token>' localhost:4300/admin/who
    if (req.headers['x-admin'] !== HOST_TOKEN) { res.writeHead(404); return res.end('not found'); }
    const q = new URL(req.url, 'http://x').searchParams;
    res.writeHead(200, { 'content-type': 'application/json' });
    if (url === '/admin/who') return res.end(JSON.stringify([...clients.values()].map(c => ({ id: c.id, n: c.n, joined: c.joined, host: c.host, v: c.v || 0 }))));
    if (url === '/admin/sethost') { const n = cleanName(q.get('name')).toLowerCase(); if (!world.hostNames.includes(n)) world.hostNames.push(n); dirty = true; for (const c of clients.values()) if (c.n.toLowerCase() === n) c.host = true; return res.end(JSON.stringify(world.hostNames)); }
    if (url === '/admin/refresh') { broadcast({ t: 'reset' }); return res.end('{"ok":true}'); }
    // Tell open pages to save their progress and reload into the newest version.
    if (url === '/admin/update') { broadcast({ t: 'update' }); return res.end('{"ok":true}'); }
    return res.end('{}');
  }
  if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (url === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (url === '/' || url === '/index.html') {
    fs.readFile(path.join(PUB, 'index.html'), (err, buf) => {
      if (err) { res.writeHead(500); return res.end('missing game file'); }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(buf);
    });
    return;
  }
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
function peerInfo(c) { return { id: c.id, n: c.n, c: c.c, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a }; }

wss.on('connection', ws => {
  if (clients.size >= MAX_CLIENTS) { ws.close(1013, 'camp is full'); return; }
  const c = { id: nextId++, ws, joined: false, n: 'Camper', c: 0, x: 0, y: 0, z: 40, r: 0, a: 0, sc: 0, tokens: 80, last: Date.now(), alive: true };
  clients.set(c.id, c);
  send(c, {
    t: 'hello', id: c.id, day: world.day,
    holes: Object.entries(world.holes).map(([k, d]) => { const [x, z] = k.split('|').map(Number); return [x, z, d]; }),
    got: [...gotSet], kb: world.kb, won: world.won,
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
      c.host = m.host === HOST_TOKEN || world.hostNames.includes(c.n.toLowerCase()); c.v = num(m.v, 0, 99, 0) | 0;
      if (!c.joined) {
        c.joined = true; broadcast({ t: 'join', ...peerInfo(c) }, c.id);
        const r = world.recent[c.n.toLowerCase()];
        if (m.fresh === true && r && Date.now() - r.at < RECENT_MS) send(c, { t: 'restore', sc: r.sc, x: r.x, z: r.z });
      }
      return;
    }
    if (!c.joined) return;
    switch (m.t) {
      case 'pos':
        c.x = num(m.x, -60, 60, c.x); c.y = num(m.y, -5, 10, c.y); c.z = num(m.z, -60, 60, c.z);
        c.r = num(m.r, -10, 10, c.r); c.a = num(m.a, 0, 4, 0) | 0; c.sc = num(m.sc, 0, 1e6, 0) | 0;
        world.recent[c.n.toLowerCase()] = { sc: c.sc, x: c.x, z: c.z, at: Date.now() };
        broadcast({ t: 'pos', id: c.id, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a }, c.id);
        break;
      case 'dig': {
        const x = r1(num(m.x, -54, 54, 0)), z = r1(num(m.z, -54, 54, 0)), d = Math.round(num(m.d, 0, 2.6, 0) * 100) / 100;
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
      case 'disco': {
        const now = Date.now();
        if (now < partyUntil) { send(c, { t: 'nodisco', busy: true }); return; }
        if (c.lastDisco && now - c.lastDisco < DISCO_COOLDOWN_MS) { send(c, { t: 'nodisco' }); return; }
        c.lastDisco = now; partyUntil = now + PARTY_SECS * 1000;
        broadcast({ t: 'party', id: c.id, n: c.n, dur: PARTY_SECS });
        return;
      }
      case 'say':
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

setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false; try { c.ws.ping(); } catch (e) { /* closing */ }
  }
  if (world.won && Date.now() - world.wonAt > NEW_DAY_AFTER_WIN_MS) {
    world = Object.assign(freshWorld(world.day + 1), { recent: world.recent, hostNames: world.hostNames }); gotSet = new Set(); kbHolder = null; dirty = true; save();
    broadcast({ t: 'reset' });
  }
}, 30000);

process.on('SIGINT', () => { dirty = true; save(); setTimeout(() => process.exit(0), 300); });
process.on('SIGTERM', () => { dirty = true; save(); setTimeout(() => process.exit(0), 300); });

server.listen(PORT, '127.0.0.1', () => console.log(`Camp Green Lake listening on 127.0.0.1:${PORT}`));
