// Camp Green Lake multiplayer server: serves the game and relays campers over WebSocket.
// The world (holes, dug-up items, the KB tube, the suitcase) is kept here so late joiners see it.
// It also runs the shared rules in public/sim.js: the team quota, heavy loot, and the night monsters.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const SIM = require('./public/sim.js');
const DIRECTOR = require('./public/director.js'); // event director: picks natural hazards on a shared budget (see that file)
const LOG = require('./logger.js'); // play-test event logging (data/logs/*.jsonl); PLAYLOG=0 turns it off

const PORT = Number(process.env.PORT) || 4300;
const PUB = path.join(__dirname, 'public');
// DATA_DIR lets the smoke test (and anyone else) point world.json at a scratch directory
// instead of the repo's own data/ folder, so test runs never clobber real save state.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const SAVE = path.join(DATA_DIR, 'world.json');
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
const HOST_TOKEN = process.env.HOST_TOKEN || crypto.randomBytes(24).toString('hex');
const PARTY_SECS = 60, DISCO_COOLDOWN_MS = 3 * 60 * 1000;
const RECENT_MS = 60 * 60 * 1000;
const CHAT_RANGE = 30, HELP_RANGE = 3.5, SINK_HELP_RANGE = 5;   // sinkhole rims are big; a bit more generous than the ordinary deep-hole pull

/* ---- proximity voice: WebRTC signaling relay ---- */
// SDP offers/answers run a few KB, well past what every other message needs, so 'rtc' gets its own ceiling
// (checked in the message handler) instead of loosening the limit for everyone. maxPayload below must cover it.
const RTC_MAX = 8192, GEN_MAX = 1024, LOG_MAX = 8192;
const LOG_BURST = 60, LOG_RATE = 0.012; // per-client play-test log budget: 60 events at once, refilling 12/s
// STUN only by default (no TURN server exists yet). Set ICE_SERVERS to a JSON array of RTCIceServer objects,
// e.g. '[{"urls":"turn:host:3478","username":"u","credential":"p"}]', to add a TURN server later.
const ICE_SERVERS = (() => {
  const base = [{ urls: 'stun:stun.l.google.com:19302' }];
  try { const extra = JSON.parse(process.env.ICE_SERVERS || '[]'); if (Array.isArray(extra)) return base.concat(extra); } catch (e) { /* bad env, fall back to STUN */ }
  return base;
})();

/* ---- public-internet guards -------------------------------------------------------------------------------
   PUBLIC=1 means "this server is reachable off the tailnet" (e.g. behind Tailscale Funnel) and turns on the
   stricter defaults below. ALLOW_OPEN=1 is the explicit opt-out of the password requirement that comes with it.
   CAMP_PASSWORD (optional even off PUBLIC) gates joining; unset means the old behind-Tailscale-only behaviour. */
const PUBLIC = process.env.PUBLIC === '1';
const ALLOW_OPEN = process.env.ALLOW_OPEN === '1';
const CAMP_PASSWORD = process.env.CAMP_PASSWORD || '';
if (PUBLIC && DEV_MODE) { console.error('Refusing to start: DEV_MODE=1 gives every camper host powers and cannot be combined with PUBLIC=1.'); process.exit(1); }
if (PUBLIC && !CAMP_PASSWORD && !ALLOW_OPEN) { console.error('Refusing to start: PUBLIC=1 needs CAMP_PASSWORD=<something> set (or ALLOW_OPEN=1 to run it without one on purpose).'); process.exit(1); }
if (DEV_MODE) console.warn('\n*** DEV_MODE=1: every camper gets host powers (console, clock, hazard spawns). Never run this on a server friends connect to. ***\n');

// Behind Tailscale Funnel every socket/request arrives from 127.0.0.1; Funnel sets X-Forwarded-For to the real
// caller's address. Trust its first hop when present, else fall back to the raw connection (local/tailnet-direct use).
function clientIp(req) { const xff = req.headers['x-forwarded-for']; return xff ? String(xff).split(',')[0].trim() : (req.socket.remoteAddress || 'unknown'); }
// Fixed-length hash compare so string length/content never leaks through timing.
function safeEqual(a, b) { const ah = crypto.createHash('sha256').update(String(a)).digest(), bh = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(ah, bh); }
// Sliding-window rate limiter for a per-connection hit array (pos/dig/ping/chat/etc.).
function withinRate(hits, limit, windowMs) { const now = Date.now(); while (hits.length && now - hits[0] > windowMs) hits.shift(); if (hits.length >= limit) return false; hits.push(now); return true; }
// Same, but keyed by IP into a shared Map (HTTP requests, new WS connections).
function ipWithinRate(map, key, limit, windowMs) { let hits = map.get(key); if (!hits) { hits = []; map.set(key, hits); } return withinRate(hits, limit, windowMs); }

const MAX_PER_IP = 4;                        // simultaneous sockets from one address
const MAX_CONNS_PER_IP_PER_MIN = 10;         // new socket attempts per address per minute
const JOIN_TIMEOUT_MS = 15000;               // sockets that never send a valid join get dropped
const MAX_BAD_JOINS = 5;                     // wrong-password attempts before we hang up on a socket
const HTTP_RATE = 120, HTTP_WINDOW_MS = 60000; // page/other HTTP requests per address per minute
// The client is ~35 static files (public/js/*.js, css, sim.js, director.js), so one page load is ~35 requests.
// Counting those against HTTP_RATE blocked a player after 3 reloads in a minute (429s -> missing scripts ->
// "setClock is not defined" -> dead page). Static files get their own, much bigger budget instead.
const STATIC_RATE = 1500; // static file requests per address per minute (~40 full page loads)
const MAX_DIG_DIST = 6;                      // can't report a dig farther than this from your last known position
const MAX_PLACE_DIST = 14;                   // ditto for dropped bags (props are placed at the dig site)
const DIG_RATE = 8, DIG_WINDOW_MS = 1000;    // digs per connection per window
const PING_RATE = 6, PING_WINDOW_MS = 2000;  // pings per connection per window
const CHAT_RATE = 5, CHAT_WINDOW_MS = 4000;  // chat/shout messages per connection per window
const ENV_RATE = 4, ENV_WINDOW_MS = 5000;    // hazard spawns per connection per window (host-only already)
const SELL_RATE = 5, SELL_WINDOW_MS = 5000;  // sell messages per connection per window
const BONK_RATE = 3, BONK_WINDOW_MS = 2000;  // shovel bonks per connection per window (the client already waits ~0.9 s between swings)
const BONK_RANGE = 3.2;                      // m: a bonk only lands on someone standing right next to you (client reach is 2.3 m, plus lag slack)
const WHACK_RATE = 6, WHACK_WINDOW_MS = 1000; // shovel swings at a javelina per connection per window (a swing lands at most every ~0.42s)
const JAV_WHACK_MAX = 2.4;                   // generous server-side reach check for a 'whack' (latency headroom over the client's own ~1.9m check)
const SWAT_RATE = 4, SWAT_WINDOW_MS = 1000;  // shovel swats at the mountain lion, per connection per window
const LION_REACH = 3;                        // max distance a swat message can land from (some slack for latency)
const MAX_SELL_V = 900;                      // above a full sack of the rarest loot (~825); trims a hacked client's ceiling

const ipConnWindow = new Map(); // ip -> recent connection timestamps (rate limiting)
const ipHttpWindow = new Map(); // ip -> recent HTTP request timestamps
const ipStaticWindow = new Map(); // ip -> recent static-file request timestamps (separate, larger budget)
setInterval(() => { // drop windows nobody's touched in a couple minutes so these maps don't grow forever
  const cutoff = Date.now() - 120000;
  for (const [ip, hits] of ipConnWindow) if (!hits.length || hits[hits.length - 1] < cutoff) ipConnWindow.delete(ip);
  for (const [ip, hits] of ipHttpWindow) if (!hits.length || hits[hits.length - 1] < cutoff) ipHttpWindow.delete(ip);
  for (const [ip, hits] of ipStaticWindow) if (!hits.length || hits[hits.length - 1] < cutoff) ipStaticWindow.delete(ip);
}, 60000);

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
if (!world.director || typeof world.director !== 'object') world.director = { on: true }; // persisted so a restart doesn't silently disable it
if (!world.players || typeof world.players !== 'object') world.players = {};
if (!world.bags || typeof world.bags !== 'object') world.bags = {};
if (!world.props || typeof world.props !== 'object') world.props = {};
LOG.init({ getClock: () => world.clock });
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

// CSP: 'self' for scripts/styles/connect plus the CDN/font hosts and inline <script>/<style> the game actually
// uses; wss:/ws: spelled out (not just relying on 'self') since that's what the spec asked us to pin down.
// blob: in img-src/connect-src: GLTFLoader unpacks a GLB's embedded textures (the fence's chain link) through blob URLs
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src 'self' data: blob:; connect-src 'self' ws: wss: blob:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'";
function securityHeaders(res, isHtml) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (isHtml) { res.setHeader('Content-Security-Policy', CSP); res.setHeader('X-Frame-Options', 'DENY'); }
}
function sendFile(res, file, type, headOnly) {
  fs.readFile(path.join(PUB, file), (err, buf) => {
    if (err) { res.writeHead(500); return res.end('missing game file'); } // never echo fs error details to a client
    securityHeaders(res, type.startsWith('text/html'));
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(headOnly ? undefined : buf);
  });
}

// Static assets for the split client and its CC0 recordings. Whitelisted extensions only; the resolved path must land inside
// public/<subdir> so '..', absolute paths, encoded traversal (%2e%2e) and symlinks that point
// outside public/ all 404 instead of serving anything. no-cache: the game relies on a plain
// reload picking up new client code (see /admin/update above).
const STATIC_DIRS = { js: { ext: '.js', type: 'text/javascript; charset=utf-8' }, css: { ext: '.css', type: 'text/css; charset=utf-8' },
  icons: { ext: '.png', type: 'image/png' },          // inventory art, e.g. public/icons/loot/cap.png (same traversal checks)
  models: { ext: '.glb', type: 'model/gltf-binary' }, // the Blender camp and creatures (public/models/*.glb)
  audio: { ext: '.mp3', type: 'audio/mpeg' } };       // licensed ambience and Foley (public/audio/*.mp3)
function sendStatic(res, subdir, rawName) {
  const dir = STATIC_DIRS[subdir];
  let name;
  try { name = decodeURIComponent(rawName); } catch (e) { res.writeHead(404); return res.end('not found'); }
  if (!name || name.includes('\0') || path.extname(name) !== dir.ext) { res.writeHead(404); return res.end('not found'); }
  const base = path.join(PUB, subdir);
  const full = path.join(base, name);
  // path.join already resolves '..' segments; this just confirms the result is still under base
  // (catches absolute paths in `name`, which path.join would otherwise happily keep rooted elsewhere... it doesn't, but belt and suspenders).
  const relToBase = path.relative(base, full);
  if (relToBase.startsWith('..') || path.isAbsolute(relToBase)) { res.writeHead(404); return res.end('not found'); }
  fs.realpath(full, (err, real) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    // Follow symlinks in our head, not just the filesystem's: reject if the real path escaped public/.
    if (path.relative(PUB, real).startsWith('..')) { res.writeHead(404); return res.end('not found'); }
    fs.readFile(real, (err2, buf) => {
      if (err2) { res.writeHead(404); return res.end('not found'); }
      securityHeaders(res, false);
      res.writeHead(200, { 'content-type': dir.type, 'cache-control': 'no-cache' });
      res.end(buf);
    });
  });
}

const server = http.createServer((req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { 'content-type': 'text/plain', allow: 'GET, HEAD' }); return res.end('method not allowed'); }
    const ip = clientIp(req);
    const url0 = (req.url || '/').split('?')[0];
    const isStatic = /^\/(?:js\/[\w.-]+\.js|css\/[\w.-]+\.css|audio\/[\w.-]+\.mp3|models\/[\w.-]+\.glb|icons\/[\w-]+\/[\w.-]+\.png)$/.test(url0) || url0 === '/sim.js' || url0 === '/director.js';
    if (isStatic ? !ipWithinRate(ipStaticWindow, ip, STATIC_RATE, HTTP_WINDOW_MS) : !ipWithinRate(ipHttpWindow, ip, HTTP_RATE, HTTP_WINDOW_MS)) { res.writeHead(429, { 'content-type': 'text/plain' }); return res.end('slow down'); }
    const url = (req.url || '/').split('?')[0];
    if (url.startsWith('/admin/')) {
      // Admin controls for the host, over SSH only: curl -H 'x-admin: <token>' localhost:4300/admin/who
      // A request that went through Funnel/any reverse proxy always carries X-Forwarded-For; refuse those
      // outright, correct token or not, so the admin surface is unreachable from the network no matter what.
      if (req.headers['x-forwarded-for']) { res.writeHead(404); return res.end('not found'); }
      if (!safeEqual(req.headers['x-admin'] || '', HOST_TOKEN)) { res.writeHead(404); return res.end('not found'); }
      const q = new URL(req.url, 'http://x').searchParams;
      securityHeaders(res, false);
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
    if (url === '/' || url === '/index.html') return sendFile(res, 'index.html', 'text/html; charset=utf-8', req.method === 'HEAD');
    if (url === '/sim.js') return sendFile(res, 'sim.js', 'text/javascript; charset=utf-8', req.method === 'HEAD');
    if (url === '/director.js') return sendFile(res, 'director.js', 'text/javascript; charset=utf-8', req.method === 'HEAD');
    // split client files (see scripts/split-client.mjs): whitelisted, resolved strictly inside public/
    if (url.startsWith('/js/')) return sendStatic(res, 'js', url.slice('/js/'.length));
    if (url.startsWith('/css/')) return sendStatic(res, 'css', url.slice('/css/'.length));
    if (url.startsWith('/icons/')) return sendStatic(res, 'icons', url.slice('/icons/'.length));
    if (url.startsWith('/models/')) return sendStatic(res, 'models', url.slice('/models/'.length));
    if (url.startsWith('/audio/')) return sendStatic(res, 'audio', url.slice('/audio/'.length));
    securityHeaders(res, false);
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  } catch (e) {
    console.error('http handler error:', e && e.message);
    try { res.writeHead(500, { 'content-type': 'text/plain' }); res.end('server error'); } catch (e2) { /* headers already sent */ }
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: Math.max(8192, RTC_MAX) }); // batched play-test log messages and WebRTC offers both need more than the old 2048
const LOG_TYPE_RE = /^[a-zA-Z]{1,16}$/, LOG_FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,15}$/;
// Client-reported log events (case 'log' below) come from our own client code but are still untrusted input:
// keep only plain, small fields so a modified client can't stuff arbitrary data or huge blobs into the log files.
function sanitizeLogFields(o) {
  const out = {};
  for (const k in o) {
    if (!LOG_FIELD_RE.test(k)) continue;
    let v = o[k];
    if (typeof v === 'string') v = v.slice(0, 600);
    else if (Array.isArray(v)) v = v.slice(0, 20);
    else if (typeof v === 'number') { if (!Number.isFinite(v)) continue; }
    else if (typeof v !== 'boolean' && v !== null) continue;
    out[k] = v;
  }
  return out;
}
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
function broadcastSleep() { const js = joined(); broadcast({ t: 'sleepstat', asleep: js.filter(c => c.sleeping).length, total: js.length }); }
// If it's night and every connected camper is asleep in a bunk, everyone skips straight to dawn (06:00, clock t=0).
// This mirrors the host clock change above: set world.clock, then broadcast it the same way.
function maybeSkipNight() {
  const js = joined();
  if (!js.length || SIM.clockT(world.clock, Date.now()) < SIM.DAYMS) return;
  if (!js.every(c => c.sleeping)) return;
  world.clock = { off: -Date.now(), paused: false, pt: 0 }; dirty = true;
  broadcast({ t: 'clock', ...world.clock });
  broadcast({ t: 'daybreak' });
  LOG.log('daybreak', { asleep: js.length });
  for (const c of js) c.sleeping = false;
  broadcastSleep();
}
function peerInfo(c) { return { id: c.id, n: c.n, c: c.c, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a, f: c.f, lv: c.lv, hp: c.hp, room: c.room }; }
function runInfo() { const n = Math.max(world.run.peak, joined().length, 1); return { t: 'run', day: world.run.day, bank: world.run.bank, quota: SIM.quotaFor(world.run.day, n) }; }
function near(a, b, r) { return Math.hypot(a.x - b.x, a.z - b.z) < r; }

wss.on('connection', (ws, req) => {
  if (clients.size >= MAX_CLIENTS) { ws.close(1013, 'camp is full'); return; }
  const ip = clientIp(req);
  let perIp = 0; for (const cl of clients.values()) if (cl.ip === ip) perIp++;
  if (perIp >= MAX_PER_IP) { LOG.log('joinRejected', { ip, reason: 'too many connections from this address' }); ws.close(1013, 'too many connections from this address'); return; }
  if (!ipWithinRate(ipConnWindow, ip, MAX_CONNS_PER_IP_PER_MIN, 60000)) { LOG.log('joinRejected', { ip, reason: 'slow down' }); ws.close(1013, 'slow down'); return; }
  const c = {
    id: nextId++, ws, ip, joined: false, authed: !CAMP_PASSWORD, badJoins: 0,
    n: 'Camper', c: 0, x: 0, y: 0, z: 40, r: 0, a: 0, f: 0, room: null, cy: -1, nz: 0, lv: 1, sc: 0, hp: 100, dnAt: 0, tokens: 80, last: Date.now(), alive: true, sleeping: false,
    digTimes: [], pingTimes: [], chatTimes: [], envTimes: [], sellTimes: [], bonkTimes: [], whackTimes: [], swatTimes: [], lionTimes: [], // per-type spam limiters
    lastPosLogT: 0, logTokens: LOG_BURST, lastLog: Date.now(), // play-test logging (see logger.js)
  };
  clients.set(c.id, c);
  // A camper who never joins (never sends a valid 'join', e.g. wrong/no password, or just sits on the title screen) doesn't get to hold a socket open forever.
  const joinTimer = setTimeout(() => { if (!c.joined) { try { ws.close(4000, 'join timeout'); } catch (e) { /* already closing */ } } }, JOIN_TIMEOUT_MS);

  function sendHello() {
    send(c, {
      t: 'hello', id: c.id, day: world.day, iceServers: ICE_SERVERS,
      holes: Object.entries(world.holes).map(([k, d]) => { const [x, z] = k.split('|').map(Number); return [x, z, d]; }),
      got: [...gotSet], kb: world.kb, won: world.won, clock: world.clock,
      bags: Object.entries(world.bags).map(([id, b]) => ({ id: +id, ...b })),
      props: Object.entries(world.props).map(([id, p]) => ({ id: +id, type: p.type, x: p.x, z: p.z })),
      peers: [...clients.values()].filter(p => p.joined && p.id !== c.id).map(peerInfo),
      mon: monSnapshot(), // ground truth for a (re)connecting client: never make it wait for the next change
      dirOn: dirState.enabled, // event director on/off, and any of its events still running that can be replayed
      dirEvents: DIRECTOR.activeEvents(dirState, Date.now()).map(e => ({ k: e.kind, x: e.x, z: e.z, t0: e.t0 })),
      jav: javSnapshot(), // ditto for the javelina herd, if one's out there right now
    });
  }
  // No password set: keep the old behaviour of sending the whole world right away. With one set, a socket gets
  // nothing (not even that a game exists) until it proves it knows the password in 'join'.
  if (c.authed) sendHello(); else send(c, { t: 'needpass' });

  ws.on('pong', () => { c.alive = true; });
  // Without a listener here, a malformed frame (oversized, bad opcode, broken utf8, ...) emits an unlistened
  // 'error' on this socket and takes the whole Node process down with it. Log it and let 'close' clean up.
  ws.on('error', e => console.error('ws error from', ip, ':', e && e.message));
  ws.on('message', raw => {
   try {
    const now = Date.now();
    c.tokens = Math.min(80, c.tokens + (now - c.last) * 0.04); c.last = now;
    if (c.tokens < 1) return;
    c.tokens -= 1;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    // 'rtc' (WebRTC signaling) gets its own bigger size allowance and costs extra tokens; every other
    // message type stays capped small so one big frame can't be smuggled in under a different type.
    if (m.t === 'rtc') { if (raw.length > RTC_MAX || c.tokens < 2) return; c.tokens -= 2; }
    // 'log' (batched play-test events, up to 24 per message) also needs room; it has its own token bucket in case 'log'.
    else if (m.t === 'log') { if (raw.length > LOG_MAX) return; }
    else if (raw.length > GEN_MAX) return;

    if (m.t === 'join') {
      if (!c.authed) {
        if (!safeEqual(String(m.p || ''), CAMP_PASSWORD)) {
          c.badJoins++;
          LOG.log('joinRejected', { id: c.id, ip: c.ip, n: cleanName(m.n), reason: 'wrong camp password', badJoins: c.badJoins });
          send(c, { t: 'joinrejected', reason: 'Wrong camp password' });
          if (c.badJoins >= MAX_BAD_JOINS) ws.close(4001, 'too many attempts');
          return;
        }
        c.authed = true; sendHello(); // now, and only now, does this socket learn about the world
      }
      c.n = cleanName(m.n); c.c = num(m.c, 0, 7, 0) | 0;
      c.host = DEV_MODE || safeEqual(String(m.host || ''), HOST_TOKEN) || world.hostNames.includes(c.n.toLowerCase()); c.v = num(m.v, 0, 99, 0) | 0;
      send(c, { t: 'host', on: !!c.host });
      const pr = world.players[c.n.toLowerCase()];
      if (pr) send(c, { t: 'prog', xp: pr.xp });
      if (!c.joined) {
        c.joined = true; clearTimeout(joinTimer); LOG.log('join', { id: c.id, n: c.n }); broadcast({ t: 'join', ...peerInfo(c) }, c.id);
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
        // flags: 1 hidden in a deep hole, 2 downed, 4 flashlight on, 8 crouching, 16 stuck in a hole,
        // 32 trapped in a sinkhole, 64 holding on to pull a sinkhole friend up (see 87-sinkhole.js),
        // 128 a vulture has you (83-vultures.js)
        c.f = num(m.f, 0, 255, 0) | 0; c.room = Number.isInteger(m.room) && m.room >= 0 && m.room < 5 && c.y < -2 ? m.room : null; // which tent/office room (rooms are underground)
        c.cy = num(m.cy, -1, MAX_ITEM, -1) | 0; c.nz = num(m.nz, 0, 1, 0); c.lv = num(m.lv, 1, 99, 1) | 0;
        c.hp = num(m.hp, 0, 100, c.hp); // relayed so idle vultures can tell who's hurt (83-vultures.js) and for the mountain lion's targeting (lionScore in sim.js)
        world.recent[c.n.toLowerCase()] = { sc: c.sc, x: c.x, z: c.z, at: Date.now() };
        broadcast({ t: 'pos', id: c.id, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a, f: c.f, lv: c.lv, hp: c.hp, room: c.room }, c.id);
        // position snapshot for the play-test log, ~2s per camper (not every message: that would flood the file)
        if (now - c.lastPosLogT >= 2000) {
          c.lastPosLogT = now;
          LOG.log('pos', { id: c.id, n: c.n, x: r1(c.x), y: r1(c.y), z: r1(c.z), a: c.a, hp: num(m.hp, 0, 100, 100) | 0, wt: num(m.wt, 0, 200, 100) | 0, f: c.f, down: !!(c.f & 2), camp: SIM.inCamp(c.x, c.z) });
        }
        break;
      case 'dig': {
        if (!withinRate(c.digTimes, DIG_RATE, DIG_WINDOW_MS)) return; // digging faster than a shovel can move
        const x = r1(num(m.x, -595, 595, 0)), z = r1(num(m.z, -595, 595, 0)), d = Math.round(num(m.d, 0, 2.6, 0) * 100) / 100;
        if (Math.hypot(x - c.x, z - c.z) > MAX_DIG_DIST) return; // no teleport-digging across the map
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
        // Selling at Mr. Sir's truck pays the team bank toward today's quota. The client reports its own sack's
        // value (client-authoritative, known issue) — MAX_SELL_V and the rate limit just cap the damage a hacked
        // client can do per message and per second, they don't verify the sack was honestly earned.
        if (!withinRate(c.sellTimes, SELL_RATE, SELL_WINDOW_MS)) return;
        const v = num(m.v, 0, MAX_SELL_V, 0) | 0; if (!v) return;
        world.run.bank += v; dirty = true;
        LOG.log('sell', { id: c.id, n: c.n, v });
        broadcast(runInfo());
        break;
      }
      case 'prop': {
        // Someone dug up something too heavy for the sack. It sits on the ground until campers carry it to the truck.
        const id = num(m.item, 0, MAX_ITEM, -1) | 0, type = String(m.type);
        if (id < 0 || !(type in SIM.HEAVY) || world.props[id] || Object.keys(world.props).length >= MAX_PROPS) return;
        world.props[id] = { type, x: r2(num(m.x, -595, 595, 0)), z: r2(num(m.z, -595, 595, 0)) }; dirty = true;
        LOG.log('propSpawn', { id: c.id, n: c.n, item: id, type, x: world.props[id].x, z: world.props[id].z });
        broadcast({ t: 'prop', id, ...world.props[id] });
        break;
      }
      case 'bag': {
        // A camper got caught and dropped their sack. Anyone can pick it up.
        const items = (Array.isArray(m.items) ? m.items : []).filter(t => LOOT_KEYS.includes(t)).slice(0, 12);
        if (!items.length) return;
        const x = r2(num(m.x, -600, 600, 0)), z = r2(num(m.z, -600, 600, 0));
        if (Math.hypot(x - c.x, z - c.z) > MAX_PLACE_DIST) return; // dropped where you actually are, not across the map
        const ids = Object.keys(world.bags); if (ids.length >= MAX_BAGS) delete world.bags[ids[0]];
        const id = nextObj++; world.bags[id] = { x, z, items, n: c.n }; dirty = true;
        LOG.log('bagDrop', { id: c.id, n: c.n, x, z, items });
        broadcast({ t: 'bag', id, ...world.bags[id] });
        break;
      }
      case 'grab': {
        const id = num(m.id, 0, 1e9, -1) | 0, b = world.bags[id];
        if (!b || !near(c, b, HELP_RANGE)) return;
        delete world.bags[id]; dirty = true;
        LOG.log('bagGrab', { id: c.id, n: c.n, bagId: id });
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
        LOG.log(m.t, { id: o.id, n: o.n, by: c.n, x: r1(o.x), z: r1(o.z) });
        send(o, { t: m.t === 'revive' ? 'revived' : 'pulled', by: c.n });
        break;
      }
      case 'bonk': {
        // Shovel bonk: a harmless whack that sends a friend tumbling (public/js/71-bonk.js). You have to be standing
        // right next to them, on the same level (nobody bonks into or out of a tent interior), and neither of you downed.
        if (!withinRate(c.bonkTimes, BONK_RATE, BONK_WINDOW_MS)) return;
        const o = clients.get(num(m.id, 0, 1e9, -1) | 0);
        if (!o || !o.joined || o === c || !near(c, o, BONK_RANGE) || Math.abs(o.y - c.y) > 2 || (o.f & 2) || (c.f & 2)) return;
        const d = Math.hypot(o.x - c.x, o.z - c.z) || 1;
        LOG.log('bonk', { id: o.id, n: o.n, by: c.n, x: r1(o.x), z: r1(o.z) });
        send(o, { t: 'bonked', from: c.id, by: c.n, dx: r2((o.x - c.x) / d), dz: r2((o.z - c.z) / d) });
        break;
      }
      case 'sinkpull': {
        // A camper who was just pulled out of a sinkhole credits everyone who was actually holding on at the rim
        // (the trapped client sends one of these per active rescuer once its own local rescue timer completes --
        // see updateSinkholes() in 87-sinkhole.js). Same proximity check as 'pull'/'revive', just a bigger radius.
        const o = clients.get(num(m.id, 0, 1e9, -1) | 0);
        if (!o || !o.joined || o === c || !near(c, o, SINK_HELP_RANGE)) return;
        LOG.log('sinkpull', { id: o.id, n: o.n, by: c.n, x: r1(o.x), z: r1(o.z) });
        send(o, { t: 'sinkpulled', by: c.n });
        break;
      }
      case 'ping':
        if (!withinRate(c.pingTimes, PING_RATE, PING_WINDOW_MS)) return; // no flooding the map with pings
        broadcast({ t: 'ping', id: c.id, x: r1(num(m.x, -600, 600, 0)), z: r1(num(m.z, -600, 600, 0)) });
        break;
      case 'rtc': {
        // Proximity voice signaling: relay an SDP offer/answer or ICE candidate to exactly one joined peer,
        // with the sender's id attached so the recipient knows who it's from. Never broadcast.
        const to = clients.get(num(m.to, 0, 1e9, -1) | 0);
        if (!to || !to.joined || to === c || !m.d || typeof m.d !== 'object') return;
        send(to, { t: 'rtc', from: c.id, d: m.d });
        break;
      }
      case 'chat': {
        // Proximity chat: only campers within earshot see it.
        if (!withinRate(c.chatTimes, CHAT_RATE, CHAT_WINDOW_MS)) return;
        const s = cleanChat(m.s); if (!s) return;
        c.nz = 1; c.chatAt = Date.now();
        LOG.log('chat', { id: c.id, n: c.n, s });
        for (const o of clients.values()) if (o.joined && o !== c && o.room === c.room && near(c, o, CHAT_RANGE)) send(o, { t: 'chat', id: c.id, s });
        break;
      }
      case 'admin':
        // Buttons in the hidden admin panel. Only the host can use them.
        if (!c.host) return;
        if (m.a === 'fill') { world.run.bank = runInfo().quota; dirty = true; LOG.log('admin', { id: c.id, n: c.n, a: m.a }); broadcast(runInfo()); }
        else if (m.a === 'empty') { world.run.bank = 0; dirty = true; LOG.log('admin', { id: c.id, n: c.n, a: m.a }); broadcast(runInfo()); }
        break;
      case 'disco': {
        const now = Date.now();
        if (now < partyUntil) { send(c, { t: 'nodisco', busy: true }); return; }
        if (c.lastDisco && now - c.lastDisco < DISCO_COOLDOWN_MS) { send(c, { t: 'nodisco' }); return; }
        c.lastDisco = now; partyUntil = now + PARTY_SECS * 1000;
        LOG.log('party', { id: c.id, n: c.n, dur: PARTY_SECS });
        broadcast({ t: 'party', id: c.id, n: c.n, dur: PARTY_SECS });
        return;
      }
      case 'clock': {
        // Only the host can move the camp clock (the hidden admin panel in the game).
        if (!c.host) return;
        const prev = world.clock;
        world.clock = { off: num(m.off, -1e13, 1e13, 0), paused: m.paused === true, pt: num(m.pt, 0, 12 * 60 * 1000, 0) }; dirty = true;
        LOG.log('clock', { id: c.id, n: c.n, off: world.clock.off, paused: world.clock.paused, pt: world.clock.pt, prevOff: prev.off, prevPaused: prev.paused, prevPt: prev.pt });
        broadcast({ t: 'clock', ...world.clock }, c.id);
        break;
      }
      case 'sleep':
        // A camper lay down in (or got out of) a bunk. If it's night and EVERY joined camper is asleep, skip to dawn.
        c.sleeping = m.on === true;
        LOG.log('sleep', { id: c.id, n: c.n, on: c.sleeping });
        broadcastSleep();
        maybeSkipNight();
        break;
      case 'env': {
        // An environmental hazard spawned from the in-game console (e.g. "twister"). Host only (verified below)
        // — everyone else's console can't reach here at all — plus a rate limit against a compromised host client.
        if (!c.host || typeof m.k !== 'string' || !/^[a-z]{1,16}$/.test(m.k)) return;
        if (!withinRate(c.envTimes, ENV_RATE, ENV_WINDOW_MS)) return;
        const x = r1(num(m.x, -600, 600, 0)), z = r1(num(m.z, -600, 600, 0)), a = num(m.a, -10, 10, 0);
        LOG.log('env', { id: c.id, n: c.n, k: m.k, x, z, a });
        broadcast({ t: 'env', id: c.id, n: c.n, k: m.k, x, z, a }, c.id);
        break;
      }
      case 'dir': {
        // Host console: "director on|off" toggles the whole event director; "event <kind>" forces one placement.
        if (!c.host) return;
        if (typeof m.on === 'boolean') {
          world.director.on = dirState.enabled = m.on; dirty = true;
          LOG.log('directorToggle', { id: c.id, n: c.n, on: m.on });
          broadcast({ t: 'dir', on: m.on }); // everyone, including the host who asked, so they all gate the same way
        } else if (typeof m.force === 'string' && /^[a-z]{1,16}$/.test(m.force)) {
          const now = Date.now();
          const hz = hazardNow(now), d = DIRECTOR.forceEvent(dirState, m.force, { x: c.x, z: c.z, now, hazardNow: hz });
          if (d) {
            LOG.log('director', { kind: d.kind, x: d.x, z: d.z, target: c.n, major: d.major, why: 'forced by ' + c.n });
            if (d.mode === 'env') broadcast({ t: 'env', id: 0, n: '', k: d.kind, x: d.x, z: d.z, a: d.a, t0: hz, dir: true });
            else dirStartMonster(d, c.x, c.z);
          } else LOG.log('directorForceFailed', { id: c.id, n: c.n, k: m.force });
        }
        break;
      }
      case 'javspawn': {
        // Host-only console command ("javelinas [count] [distance]"): spawn a herd out on the lake, aimed at the
        // caller. Self-contained (see the javelina section of sim.js) -- doesn't touch MON/stepMonsters at all.
        if (!c.host) return;
        if (!withinRate(c.envTimes, ENV_RATE, ENV_WINDOW_MS)) return; // shares the host hazard-spawn budget with 'env'
        const n = num(m.n, 4, SIM.JAV_COUNT, SIM.JAV_COUNT) | 0, dist = num(m.dist, 20, 300, 70); // capped at JAV_COUNT: the client's render pool can't show more
        const jev = []; SIM.spawnJavHerd(JAV, { x: c.x, z: c.z }, n, dist, jev);
        LOG.log('javSpawn', { id: c.id, n: c.n, count: n, dist });
        broadcast({ t: 'jav', list: javSnapshot(), ev: jev }); // don't wait for the next 100ms tick to tell everyone
        break;
      }
      case 'whack': {
        // A shovel swing landed on javelina `idx`. Fully server-validated: alive, in reach, not spamming.
        if (c.f & 2) return; // can't swing while downed
        const idx = num(m.idx, 0, SIM.JAV_COUNT - 1, -1) | 0, j = JAV.list[idx];
        if (!j || j.state || Math.hypot(j.x - c.x, j.z - c.z) > JAV_WHACK_MAX) return;
        if (!withinRate(c.whackTimes, WHACK_RATE, WHACK_WINDOW_MS)) return;
        const jev = []; SIM.whackJavelina(JAV, idx, c.x, c.z, jev, c.id);
        if (jev.some(e => e.k === 'javDeath')) LOG.log('javKill', { id: c.id, n: c.n, idx });
        broadcast({ t: 'jav', list: javSnapshot(), ev: jev });
        break;
      }
      case 'lion': {
        // Host console command ("lion [distance]"): spawn the mountain lion out on the lake near the caller.
        // Unlike ENV hazards it isn't a stateless one-shot every client can derive on its own -- it's a persistent,
        // server-stepped predator (see SIM.stepLion) -- so this just records where to put it; the tick loop below
        // does the actual spawning next pass, and only if one isn't already out (SIM.stepLion enforces "one at a time").
        if (!c.host) return;
        if (!withinRate(c.lionTimes, ENV_RATE, ENV_WINDOW_MS)) return; // same budget as other host hazard spawns
        const x = r1(num(m.x, -600, 600, 0)), z = r1(num(m.z, -600, 600, 0));
        LOG.log('lionSpawnCmd', { id: c.id, n: c.n, x, z });
        LION.pendingSpawn = { x, z };
        break;
      }
      case 'swat': {
        // A shovel swing landed on the mountain lion (see lionSwing()/scoop() on the client). Sender must be alive
        // and actually standing close enough to reach it; SIM.lionSwat applies a fixed amount of damage server-side
        // so a hacked client can't report bigger hits, and the rate limit caps how often one client can "swing".
        if (c.f & 2) return; // can't swing a shovel while downed
        if (!withinRate(c.swatTimes, SWAT_RATE, SWAT_WINDOW_MS)) return;
        if (!LION.active || Math.hypot(c.x - LION.x, c.z - LION.z) > LION_REACH) return;
        if (SIM.lionSwat(LION)) { LOG.log('lionSwat', { id: c.id, n: c.n, hp: Math.round(LION.hp) }); lionEvQ.push({ k: 'swat', id: c.id }); }
        break;
      }
      case 'say':
        if (!withinRate(c.chatTimes, CHAT_RATE, CHAT_WINDOW_MS)) return; // shouts share the chat spam budget
        c.nz = 1; c.chatAt = Date.now();
        LOG.log('shout', { id: c.id, n: c.n, i: num(m.i, 0, 4, 0) | 0 });
        broadcast({ t: 'say', id: c.id, i: num(m.i, 0, 4, 0) | 0 }, c.id);
        break;
      case 'kb':
        if (world.kb) return;
        world.kb = c.n; dirty = true; kbHolder = null;
        LOG.log('kb', { id: c.id, n: c.n });
        broadcast({ t: 'kb', n: c.n }, c.id);
        break;
      case 'win':
        if (world.won) return;
        world.won = c.n; world.wonAt = Date.now(); dirty = true;
        LOG.log('win', { id: c.id, n: c.n });
        broadcast({ t: 'win', n: c.n }, c.id);
        break;
      case 'log': {
        // Batched client-reported play-test events (see logger.js): damage/KO, lizard chases, twister
        // warnings/throws, item finds, console commands, JS errors, fps samples, and a compact "what I see nearby"
        // report. A separate token bucket (from the gameplay one above) so a chatty client can't crowd out play
        // messages, and vice versa.
        if (!Array.isArray(m.ev) || !m.ev.length) return;
        c.logTokens = Math.min(LOG_BURST, c.logTokens + (now - c.lastLog) * LOG_RATE); c.lastLog = now;
        // Keep whatever fits the budget instead of dropping the whole batch (bursts are exactly when you need the
        // log), client errors first, and note how many were dropped so a gap in the log is visible, not silent.
        const all = m.ev.slice(0, 24).sort((a, b) => (b && b.k === 'err') - (a && a.k === 'err'));
        const items = all.slice(0, Math.max(0, Math.floor(c.logTokens)));
        c.logTokens -= items.length;
        if (items.length < all.length) LOG.log('logDropped', { id: c.id, n: c.n, dropped: all.length - items.length });
        for (const e of items) {
          if (!e || typeof e !== 'object' || typeof e.k !== 'string' || !LOG_TYPE_RE.test(e.k)) continue;
          const f = sanitizeLogFields(e); delete f.k;
          LOG.log(e.k, Object.assign({ id: c.id, n: c.n }, f));
        }
        break;
      }
    }
   } catch (e) { console.error('message handler error:', e && e.message); } // one bad message from one camper never takes the server down
  });
  ws.on('close', () => {
    clearTimeout(joinTimer);
    clients.delete(c.id);
    if (kbHolder === c.id && !world.kb) {
      // The camper walked off with the gold tube without reporting it: put it back in the ground.
      kbHolder = null;
      if (gotSet.delete(kbItem)) { dirty = true; broadcast({ t: 'ungot', item: kbItem }); }
    }
    if (c.joined) { LOG.log('leave', { id: c.id, n: c.n }); broadcast({ t: 'leave', id: c.id }); broadcastSleep(); maybeSkipNight(); }
  });
});

/* ---- shared rules, 10 times a second: heavy loot, night monsters, the quota at curfew, and the event director ---- */
const MON = { trucks: [], zer: null };
const dirState = DIRECTOR.createState(); dirState.enabled = world.director.on; // one director for the whole camp; the server is its only authority
let lastDirInfoT = 0; // throttle for the 'dirinfo' status broadcast (host "events" command reads it)
const LION = { active: false, armed: true, x: 0, z: 0, h: 0, mode: 'stalk', tgt: null, hp: 0 }; // the one mountain lion; see SIM.stepLion
let lionEvQ = []; // events from message handlers (a shovel swat) waiting for the next tick's broadcast -- see the 'swat' case above
// Wire format for the 'mon' field, shared by the periodic broadcast and the 'hello' a (re)connecting
// client gets. A fresh connection has to see the CURRENT truth here, not just wait for the next change:
// the periodic broadcast only fires on the tick a monster appears or disappears, so a client that wasn't
// connected at that exact moment (dropped and reconnected, or just joined) would otherwise never learn
// monsters are gone and keep rendering whatever it saw last.
function monSnapshot() {
  return {
    trucks: MON.trucks.map(k => [r2(k.x), r2(k.z), r2(k.h), k.mode === 'chase' ? 1 : 0]), zer: MON.zer ? [r2(MON.zer.x), r2(MON.zer.z), MON.zer.tgt, MON.zer.drag] : null,
    // [x,z,h,modeIndex,targetId,hp] -- modeIndex indexes SIM.LION_MODES; hp is sent raw (0..SIM.LION_HP) so the
    // client doesn't need to duplicate that constant just to draw a bar or gate a sound.
    lion: LION.active ? [r2(LION.x), r2(LION.z), r2(LION.h), Math.max(0, SIM.LION_MODES.indexOf(LION.mode)), LION.tgt, Math.round(LION.hp)] : null,
  };
}
// Javelina herd: a separate, self-contained hazard (its rules live in their own section of sim.js, not mixed into
// stepMonsters above). JAV.list is [] when no herd is out; otherwise a fixed-size array for that herd's lifetime,
// so a client can address one by its stable array index ('whack'), the same idea as MON above but a herd of many.
const JAV = { list: [] };
let javOn = false;
function javSnapshot() { return JAV.list.map(j => [r2(j.x), r2(j.z), r2(j.h), j.state]); }
// One call from the main tick (see below): steps the herd (host-authoritative AI, bites, natural spawns) and
// broadcasts anything that changed. Kept as its own function so the tick body only grows by one line for this.
// The event director picked a server-side monster ('monster' mode in public/director.js): start it around (tx,tz),
// the camper it was aimed at. The herd spawns 50-100 m out from them; the lion spawns at the director's ring spot.
// The shared hazard clock: the same number every client's twNow() gives (Date.now() + the camp clock offset wrapped
// to one day, see 72-twisters.js). Director events are stamped with it, so a spawn's start time means the same thing
// to the server, to everyone who hears it live, and to a late joiner replaying it from 'hello'.
function hazardNow(now) { return now + SIM.wrapT(world.clock.off); }
function dirStartMonster(d, tx, tz) {
  if (d.kind === 'javelinas') {
    const jev = []; SIM.spawnJavHerd(JAV, { x: tx, z: tz }, SIM.JAV_COUNT, Math.min(100, Math.max(50, Math.hypot(d.x - tx, d.z - tz))), jev);
    broadcast({ t: 'jav', list: javSnapshot(), ev: jev });
  } else if (d.kind === 'lion') LION.pendingSpawn = { x: d.x, z: d.z };
}
function tickJavelinas(t, dt, players) {
  JAV.noNatural = dirState.enabled; // the event director owns natural herds while it's on (sim.js stepJavelinas)
  const jev = []; SIM.stepJavelinas(JAV, players, t, dt, jev);
  for (const e of jev) {
    if (e.k === 'javBite') LOG.log('javBite', { id: e.id, dmg: e.dmg });
    else if (e.k === 'javSpawn' || e.k === 'javLeave' || e.k === 'javGone') LOG.log(e.k, { n: e.n, x: e.x != null ? r1(e.x) : undefined, z: e.z != null ? r1(e.z) : undefined });
  }
  const on = JAV.list.length > 0;
  if (on || javOn) broadcast({ t: 'jav', list: javSnapshot(), ev: jev });
  javOn = on;
}
let lastT = SIM.clockT(world.clock, Date.now()), lastTick = Date.now(), monOn = false;
let policeOn = false, zerOn = false, lionOn = false, lastMonLogT = 0;
function simPlayers(now) {
  return joined().map(c => ({
    id: c.id, x: c.x, z: c.z, fa: c.r, cy: c.cy, hp: c.hp,
    hd: !!(c.f & 1), cr: !!(c.f & 8), lt: !!(c.f & 4), an: c.a,
    dn: !!(c.f & 2) || now - c.dnAt < 2000,
    nz: now - (c.chatAt || 0) < 3000 ? 1 : c.nz,
  }));
}
function endOfDay() {
  const q = runInfo(), played = world.run.played || 0;
  world.run.played = 0;
  if (!joined().length) return;
  if (world.run.bank < q.quota && played < 180) { LOG.log('grace', {}); broadcast({ t: 'grace' }); return; } // the crew only just got here: no check today
  if (world.run.bank >= q.quota) {
    LOG.log('quota', { met: true, bank: world.run.bank, quota: q.quota, day: world.run.day });
    world.run.day++; world.run.bank = 0; world.run.peak = joined().length; dirty = true;
    broadcast({ ...runInfo(), t: 'quota', met: true });
  } else {
    // Fired: the run starts over. The lake is refilled and everyone's seeds and gear are gone (levels stay).
    const got = q.bank;
    LOG.log('fired', { bank: got, quota: q.quota });
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
  if (lionEvQ.length) { ev.push(...lionEvQ); lionEvQ.length = 0; } // shovel swats reported since the last tick (see the 'swat' case)
  LION.noNatural = dirState.enabled; // ditto for the lion's own pre-curfew window
  SIM.stepLion(LION, players, t, dt, ev);
  for (const e of ev) {
    if (e.k === 'down') { const c = clients.get(e.id); if (c) c.dnAt = now; }
    const cc = e.id != null ? clients.get(e.id) : null;
    const fields = { id: e.id, n: cc && cc.n, x: cc && r1(cc.x), z: cc && r1(cc.z) };
    if (e.by) fields.by = e.by;
    if (e.front !== undefined) fields.front = e.front;
    if (e.why !== undefined) fields.why = e.why;
    if (e.k === 'zspawn' && MON.zer) { fields.x = r1(MON.zer.x); fields.z = r1(MON.zer.z); }
    if ((e.k === 'lionSpawn' || e.k === 'pounce') && LION.active) { fields.x = r1(LION.x); fields.z = r1(LION.z); }
    LOG.log(e.k, fields);
  }
  const policeNow = MON.trucks.length > 0, zerNow = !!MON.zer, lionNow = LION.active;
  if (policeNow !== policeOn) { LOG.log(policeNow ? 'mobsOn' : 'mobsOff', { kind: 'police' }); policeOn = policeNow; }
  if (zerNow !== zerOn) { LOG.log(zerNow ? 'mobsOn' : 'mobsOff', { kind: 'zeroni' }); zerOn = zerNow; }
  if (lionNow !== lionOn) { LOG.log(lionNow ? 'mobsOn' : 'mobsOff', { kind: 'lion' }); lionOn = lionNow; }
  const on = policeNow || zerNow || lionNow;
  if (on && now - lastMonLogT >= 2000) {
    lastMonLogT = now;
    LOG.log('mon', { trucks: MON.trucks.map(k => ({ x: r2(k.x), z: r2(k.z), mode: k.mode })), zer: MON.zer ? { x: r2(MON.zer.x), z: r2(MON.zer.z), tgt: MON.zer.tgt, drag: MON.zer.drag } : null, lion: LION.active ? { x: r2(LION.x), z: r2(LION.z), mode: LION.mode, tgt: LION.tgt, hp: Math.round(LION.hp) } : null });
  }
  if (on || monOn) broadcast({ t: 'mon', ...monSnapshot(), ev });
  monOn = on;
  // event director: one shared budget for natural hazards (see public/director.js). Decisions go out through the
  // same 'env' relay every console-spawned hazard already uses, so every camper's spawnEnv() sees one message.
  const dirPlayers = players.map(p => ({ id: p.id, x: p.x, z: p.z, inCamp: SIM.inCamp(p.x, p.z), down: p.dn }));
  const hz = hazardNow(now);
  for (const d of DIRECTOR.step(dirState, { now, day: world.run.day, clockT: t, players: dirPlayers, hazardNow: hz })) {
    LOG.log('director', { kind: d.kind, x: d.x, z: d.z, target: d.targetId, major: d.major, why: 'natural roll' });
    if (d.mode === 'env') broadcast({ t: 'env', id: 0, n: '', k: d.kind, x: d.x, z: d.z, a: d.a, t0: hz, dir: true });
    else { const tp = clients.get(d.targetId); dirStartMonster(d, tp ? tp.x : d.x, tp ? tp.z : d.z); }
  }
  if (now - lastDirInfoT >= 3000 && joined().length) {
    lastDirInfoT = now;
    broadcast({ t: 'dirinfo', ...DIRECTOR.describe(dirState, now, world.run.day, Math.max(1, joined().length)) });
  }
  tickJavelinas(t, dt, players);
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

process.on('SIGINT', () => { dirty = true; save(); LOG.flushSync(); setTimeout(() => process.exit(0), 300); });
process.on('SIGTERM', () => { dirty = true; save(); LOG.flushSync(); setTimeout(() => process.exit(0), 300); });

server.listen(PORT, '127.0.0.1', () => console.log(`Camp Green Lake listening on 127.0.0.1:${PORT}`));
