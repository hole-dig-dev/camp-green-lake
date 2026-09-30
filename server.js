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
/* ---- proximity voice: relay fallback ----
   When two campers can't reach each other directly (strict home/mobile NATs, and no TURN server), their voice comes
   through here instead: 'vo' = one 60 ms frame of 16 kHz mu-law audio (base64, ~1.3 KB), sent ~17 times a second while
   the mic is transmitting. It has its own size cap and token bucket so it never eats the budget position updates
   use, and it's only forwarded to joined campers in the same room within VO_RANGE m (no listening in from afar). */
const VO_MAX = 2048, VO_A_MAX = 1400, VO_BURST = 30, VO_REFILL = 0.025, VO_RANGE = 90;   // refill: tokens per ms (25/s)
function relayVoice(c, raw) {
  const now = Date.now();
  c.voTok = Math.min(VO_BURST, (c.voTok == null ? VO_BURST : c.voTok) + (now - (c.voLast || now)) * VO_REFILL); c.voLast = now;
  const st = c.voStat || (c.voStat = { in: 0, fwd: {}, drop: {} });   // diagnostics: GET /admin/voice
  st.in++;
  if (!c.joined || c.voTok < 1) { st.drop.rate = (st.drop.rate || 0) + 1; return; }
  c.voTok -= 1;
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.a !== 'string' || m.a.length > VO_A_MAX || !Array.isArray(m.to)) return;
  let out = null;
  for (const id of m.to.slice(0, 8)) {
    const t = clients.get(id | 0);
    const radio = c.wk && t && t.wk; // both have walkie-talkies: voice carries any distance, tent to lake (86-walkie.js)
    const why = !t ? 'gone' : t === c ? 'self' : !t.joined ? 'notjoined' : radio ? '' : t.room !== c.room ? 'room' : Math.hypot((t.x || 0) - (c.x || 0), (t.z || 0) - (c.z || 0)) > VO_RANGE ? 'far' : '';
    if (why) { st.drop[why] = (st.drop[why] || 0) + 1; continue; }
    send(t, out || (out = JSON.stringify({ t: 'vo', f: c.id, a: m.a }))); st.fwd[t.n] = (st.fwd[t.n] || 0) + 1;
  }
}
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
const CAMP_NODIG = 4;                       // no digging within this many m of the camp fence (matches CAMP_NODIG in public/js/10-core.js)
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
const LOOT_KEYS = ['cap', 'can', 'spoon', 'shoe', 'arrow', 'jar', 'fossil', 'lipstick', 'sploosh', 'locket', 'pistol', 'goldbar', 'sneakers'];

/* Peak-style maps (public/js/88-zones.js). The whole crew is always in ONE map (world.zone, 'lake' when unset), so
   everything else here runs unchanged on whichever map is loaded. Each map keeps its own holes, finds, heavy loot,
   sacks and flags (a dropped rope); the ones not in use wait in world.zones. ZONE_ORDER is the escape route and
   must match the client's. */
const ZONE_ORDER = ['lake', 'canyon'];
const ZONE_MAX_Y = 200; // the canyon floor climbs; public/js/10-core.js has the same number
function zoneMsg() {
  return {
    t: 'zone', zone: world.zone || 'lake', zflags: world.zflags || {},
    holes: Object.entries(world.holes).map(([k, d]) => { const [x, z] = k.split('|').map(Number); return [x, z, d]; }),
    got: [...gotSet],
    bags: Object.entries(world.bags).map(([id, b]) => ({ id: +id, ...b })),
    props: Object.entries(world.props).map(([id, p]) => ({ id: +id, type: p.type, x: p.x, z: p.z, val: p.val, v0: p.v0 })),
  };
}
function zoneSwitch(id, why) {
  const cur = world.zone || 'lake';
  if (id === cur || !ZONE_ORDER.includes(id)) return;
  if (!world.zones || typeof world.zones !== 'object') world.zones = {};
  world.zones[cur] = { holes: world.holes, got: [...gotSet], props: world.props, bags: world.bags, zflags: world.zflags || {} };
  const z = world.zones[id] || {};
  delete world.zones[id];
  world.zone = id; SIM.setZone(id); ROSTER.mobs = []; JAV.list = []; world.holes = z.holes || {}; gotSet = new Set(z.got || []); world.props = z.props || {}; world.bags = z.bags || {}; world.zflags = z.zflags || {};
  for (const c of clients.values()) c.cp = false;
  dirty = true;
  LOG.log('zone', { from: cur, to: id, why });
  broadcast(zoneMsg());
}
/* Like Peak's campfires: the next map only opens once every joined camper is standing at this one's. */
/* grab physics ownership: when the camper running a thing's physics lets go or leaves, it passes to someone still
   holding it (hands first, then ropes); nobody left and it's free for the next grabber. The new owner's page picks up
   from the last state it heard, and the physics does the rest: too heavy for who's left and it sags to the ground. */
function passOwner(p, leaving) {
  if (p.owner !== leaving) return;
  const next = [...(p.grab || []), ...(p.ropes || [])].find(g => g !== leaving && clients.has(g) && clients.get(g).joined);
  p.owner = next != null ? next : null;
}
function checkCampfire() {
  const js = joined(), at = js.filter(c => c.cp).length;
  broadcast({ t: 'cpstat', at, total: js.length });
  const next = ZONE_ORDER[ZONE_ORDER.indexOf(world.zone || 'lake') + 1];
  if (js.length && at === js.length && next) zoneSwitch(next, 'campfire');
}

function freshRun() { return { day: 1, bank: 0, peak: 1, curse: 0, mood: 'normal' }; }
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
SIM.setZone(world.zone || 'lake');
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

// ---- control-center slider values (DEV_MODE only): data/tune.json, { key: { v, def } } for the knobs someone moved.
// Claude reads this file to bake a tester's values in as new defaults. Untrusted input: plain numbers under short keys only.
const TUNE_FILE = path.join(DATA_DIR, 'tune.json'), TUNE_MAX_BYTES = 16384, TUNE_KEY_RE = /^[A-Za-z0-9_. ]{1,40}$/;
// the server's copy of the tester's sliders (the few rules the server runs: roster, events, the curse)
let TUNE_S = {};
try { TUNE_S = JSON.parse(fs.readFileSync(TUNE_FILE, 'utf8')) || {}; } catch (e) { /* none saved yet */ }
function tuneS(key, def) { const o = TUNE_S[key]; return o && Number.isFinite(o.v) && o.def === def ? o.v : def; }
function sendTune(res) {
  fs.readFile(TUNE_FILE, 'utf8', (err, txt) => {
    securityHeaders(res, false);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(err ? '{}' : txt);
  });
}
/* The Curfew tab's sliders drive the shared police/searchlight rules, which run here: apply the saved values (only
   those set against the current default, like the page's tuneAdopt) and send them to everyone. */
function applyCurfewTune(o, quiet) {
  const v = {};
  for (const k in SIM.CURFEW_DEF) { const e = o && o['curfew.' + k]; if (e && e.def === SIM.CURFEW_DEF[k]) v[k] = e.v; }
  SIM.setCurfew(Object.assign({}, SIM.CURFEW_DEF, v));
  if (!quiet) broadcast({ t: 'curfew', v: SIM.CURFEW });
}
if (DEV_MODE) { try { applyCurfewTune(JSON.parse(fs.readFileSync(TUNE_FILE, 'utf8')), true); } catch (e) {} }   // at startup: nobody to tell yet
function saveTune(req, res) {
  let body = '', over = false;
  req.setEncoding('utf8');
  req.on('data', c => { if (over) return; body += c; if (body.length > TUNE_MAX_BYTES) { over = true; res.writeHead(413); res.end('too big'); req.destroy(); } });
  req.on('end', () => {
    if (over) return;
    let o; try { o = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('bad json'); }
    if (!o || typeof o !== 'object' || Array.isArray(o)) { res.writeHead(400); return res.end('bad shape'); }
    const clean = {};
    for (const k of Object.keys(o).slice(0, 200)) {
      const e = o[k];
      if (TUNE_KEY_RE.test(k) && e && Number.isFinite(e.v) && Number.isFinite(e.def)) clean[k] = { v: e.v, def: e.def };
    }
    applyCurfewTune(clean);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFile(TUNE_FILE + '.tmp', JSON.stringify(clean, null, 1), err => {
      if (err) { res.writeHead(500); return res.end('save failed'); }
      TUNE_S = clean;
      fs.rename(TUNE_FILE + '.tmp', TUNE_FILE, () => { securityHeaders(res, false); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
    });
  });
}

const server = http.createServer((req, res) => {
  try {
    const url0 = (req.url || '/').split('?')[0];
    const tunePost = DEV_MODE && req.method === 'POST' && url0 === '/tune';
    if (req.method !== 'GET' && req.method !== 'HEAD' && !tunePost) { res.writeHead(405, { 'content-type': 'text/plain', allow: 'GET, HEAD' }); return res.end('method not allowed'); }
    const ip = clientIp(req);
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
      if (url === '/admin/voice') return res.end(JSON.stringify([...clients.values()].filter(c => c.joined).map(c => ({ id: c.id, n: c.n, x: c.x, z: c.z, room: c.room, vo: c.voStat || null }))));
      if (url === '/admin/who') return res.end(JSON.stringify([...clients.values()].map(c => ({ id: c.id, n: c.n, joined: c.joined, host: c.host, v: c.v || 0 }))));
      if (url === '/admin/sethost') { const n = cleanName(q.get('name')).toLowerCase(); if (!world.hostNames.includes(n)) world.hostNames.push(n); dirty = true; for (const c of clients.values()) if (c.n.toLowerCase() === n) { c.host = true; send(c, { t: 'host', on: true }); } return res.end(JSON.stringify(world.hostNames)); }
      if (url === '/admin/refresh') { broadcast({ t: 'reset' }); return res.end('{"ok":true}'); }
      // Tell open pages to save their progress and reload into the newest version.
      if (url === '/admin/update') { broadcast({ t: 'update' }); return res.end('{"ok":true}'); }
      return res.end('{}');
    }
    // The play-tester's control-center sliders (public/js/11-tune.js). Play-test server only: a normal server 404s.
    if (url === '/tune') { if (!DEV_MODE) { res.writeHead(404); return res.end('not found'); } return tunePost ? saveTune(req, res) : sendTune(res); }
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

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: Math.max(8192, RTC_MAX, VO_MAX) }); // batched play-test log messages and WebRTC offers both need more than the old 2048
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
function peerInfo(c) { return { id: c.id, n: c.n, c: c.c, u: c.u || 0, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a, f: c.f, lv: c.lv, hp: c.hp, room: c.room }; }
function runInfo() { const n = Math.max(world.run.peak, joined().length, 1); return { t: 'run', day: world.run.day, bank: world.run.bank, quota: SIM.quotaFor(world.run.day, n) * (world.run.mood === 'digday' ? 2 : 1), mood: world.run.mood || 'normal', curse: Math.round(world.run.curse || 0) }; }
// the curse (sim.js CURSE): the crew's, 0-100. why: shown to everyone
function addCurse(d, why) {
  const was = world.run.curse || 0; world.run.curse = Math.max(0, Math.min(100, was + d)); dirty = true;
  if (Math.round(world.run.curse) === Math.round(was)) return;
  LOG.log('curse', { d, curse: Math.round(world.run.curse), why }); broadcast({ t: 'curse', d, curse: Math.round(world.run.curse), why }); broadcast(runInfo());
}
const payMult = () => (world.run.mood === 'digday' ? 2 : 1); // dig day: Mr. Sir pays double
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
      zone: world.zone || 'lake', zflags: world.zflags || {}, // which map the crew is in; the holes etc. below are that map's
      holes: Object.entries(world.holes).map(([k, d]) => { const [x, z] = k.split('|').map(Number); return [x, z, d]; }),
      got: [...gotSet], kb: world.kb, won: world.won, clock: world.clock,
      bags: Object.entries(world.bags).map(([id, b]) => ({ id: +id, ...b })),
      props: Object.entries(world.props).map(([id, p]) => ({ id: +id, type: p.type, x: p.x, z: p.z, y: p.y, val: p.val, v0: p.v0, q: p.q, owner: p.owner, grab: p.grab || [], ropes: p.ropes || [], load: p.load, tip: p.tip, cartId: p.cartId })),
      peers: [...clients.values()].filter(p => p.joined && p.id !== c.id).map(peerInfo),
      mon: monSnapshot(), // ground truth for a (re)connecting client: never make it wait for the next change
      dirOn: dirState.enabled, // event director on/off, and any of its events still running that can be replayed
      dirEvents: DIRECTOR.activeEvents(dirState, Date.now()).map(e => ({ k: e.kind, x: e.x, z: e.z, t0: e.t0 })),
      jav: javSnapshot(), // ditto for the javelina herd, if one's out there right now
      breaches: world.breaches || {}, tgot: world.tgot && world.tgot.day === world.run.day ? world.tgot.ids : [], // the buried town (89-town.js)
      rost: SIM.packRoster(ROSTER), rostToday: ROSTER.roster || SIM.rosterFor(world.run.day, world.run.curse || 0), // and the day's roster
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
    if (raw.length <= VO_MAX && String(raw).startsWith('{"t":"vo"')) return relayVoice(c, raw);   // voice frames: own budget (above)
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
      c.n = cleanName(m.n); c.c = num(m.c, 0, 7, 0) | 0; c.u = num(m.u, 0, 9, 0) | 0; // u: jumpsuit (public/js/81-badges.js)
      c.host = DEV_MODE || safeEqual(String(m.host || ''), HOST_TOKEN) || world.hostNames.includes(c.n.toLowerCase()); c.v = num(m.v, 0, 99, 0) | 0;
      send(c, { t: 'host', on: !!c.host });
      send(c, { t: 'curfew', v: SIM.CURFEW });
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
        c.town = m.tn === true; // down in the buried town (public/js/89-town.js), at x ~2000, y -30
        c.x = num(m.x, -620, c.town ? SIM.TOWN.X + 60 : 620, c.x); c.y = num(m.y, c.town ? SIM.TOWN.Y - 5 : -5, ZONE_MAX_Y, c.y); c.z = num(m.z, -620, 620, c.z);
        c.r = num(m.r, -10, 10, c.r); c.a = num(m.a, 0, 4, 0) | 0; c.sc = num(m.sc, 0, 1e6, 0) | 0;
        c.wk = m.wk === true; // has a walkie-talkie (the 'chat' case)
        c.kt = m.kt === true; c.on = m.on === true; c.vy = num(m.vy, -100, 100, 0); // roster inputs (sim.js stepRoster)
        // flags: 1 hidden in a deep hole, 2 downed, 4 flashlight on, 8 crouching, 16 stuck in a hole,
        // 32 trapped in a sinkhole, 64 holding on to pull a sinkhole friend up (see 87-sinkhole.js),
        // 128 a vulture has you (83-vultures.js), ... 2048 talking on the walkie, 4096 owns a walkie (86-walkie.js)
        c.f = num(m.f, 0, 8191, 0) | 0; c.room = Number.isInteger(m.room) && m.room >= 0 && m.room < 5 && c.y < -2 ? m.room : null; // which tent/office room (rooms are underground)
        if (!(c.f & 2) && (c.body || c.cartId != null)) { // back on their feet: nobody's holding a body any more
          if (c.cartId != null && world.props[c.cartId]) { const k = world.props[c.cartId]; k.load = (k.load || []).filter(l => l !== -c.id); broadcast({ t: 'pcart', id: c.cartId, load: k.load }); }
          c.body = null; c.cartId = null; broadcast({ t: 'pown', id: -c.id, owner: c.id, grab: [], ropes: [] });
        }
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
        if (Math.hypot(Math.max(-40 - x, 0, x - 30), Math.max(27 - z, 0, z - 56)) < CAMP_NODIG) return; // the no-dig strip round the camp fence (public/js/10-core.js)
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
        world.run.bank += v * payMult(); dirty = true;
        LOG.log('sell', { id: c.id, n: c.n, v });
        broadcast(runInfo());
        break;
      }
      case 'prop': {
        // Someone dug up something too heavy for the sack. It sits on the ground until campers carry it to the truck.
        const id = num(m.item, 0, MAX_ITEM, -1) | 0, type = String(m.type);
        if (id < 0 || !(type in SIM.HEAVY) || world.props[id] || Object.keys(world.props).length >= MAX_PROPS) return;
        const val = Math.round(num(m.val, 1, SIM.HEAVY[type], SIM.HEAVY[type])); // a carried find brings its own worth (45-state.js carryFind); HEAVY is the cap
        world.props[id] = { type, x: r2(num(m.x, -595, 595, 0)), z: r2(num(m.z, -595, 595, 0)), val, v0: val }; dirty = true;
        LOG.log('propSpawn', { id: c.id, n: c.n, item: id, type, x: world.props[id].x, z: world.props[id].z });
        broadcast({ t: 'prop', id, ...world.props[id] });
        break;
      }
      /* ---- grab physics (public/js/84-grab.js): heavy loot, the wheelbarrow and downed campers' bodies.
         A target id >= 0 is a prop in world.props; a negative id is the body of camper -id (downed).
         A moving prop has one "owner" whose page runs its physics and reports it ('pst'); a body's owner is always the
         downed camper themself (their own position). Everyone else holding on (hands, or a rope) sends 'phand', and the
         server passes it to the owner. The cart carries up to 3 things (loot or bodies); they ride along with it. ---- */
      case 'pgrab': {
        const id = num(m.id, -1e9, MAX_ITEM, -1e9) | 0, T = grabTarget(id); if (!T) return;
        const reach = tuneS('env.grabReach', SIM.GRAB.REACH) + (m.rope ? SIM.ROPE.L + 2 : 1);
        if (Math.hypot(T.x - c.x, T.z - c.z) > reach) return;
        const key = m.rope ? 'ropes' : 'grab';
        T.o.grab = (T.o.grab || []).filter(g => g !== c.id && clients.has(g)); T.o.ropes = (T.o.ropes || []).filter(g => g !== c.id && clients.has(g));
        T.o[key] = [...T.o[key], c.id].slice(0, 8);
        if (id >= 0) {
          if (T.o.cartId != null) unloadFromCart(id); // taking it out of the wheelbarrow
          if (T.o.owner == null || !clients.has(T.o.owner)) T.o.owner = c.id;
        } else send(T.c, { t: 'pown', id, owner: T.c.id, grab: T.o.grab, ropes: T.o.ropes });
        broadcast({ t: 'pown', id, owner: id >= 0 ? T.o.owner : T.c.id, grab: T.o.grab, ropes: T.o.ropes });
        break;
      }
      case 'prel': case 'pyeet': {
        const id = num(m.id, -1e9, MAX_ITEM, -1e9) | 0, T = grabTarget(id); if (!T) return;
        T.o.grab = (T.o.grab || []).filter(g => g !== c.id); T.o.ropes = (T.o.ropes || []).filter(g => g !== c.id);
        if (id >= 0 && m.t === 'prel') passOwner(T.o, c.id); // JT: whoever's still holding it takes over (too heavy for them alone and it drops)
        const owner = id >= 0 ? T.o.owner : T.c.id;
        if (m.t === 'pyeet' && owner !== c.id && clients.has(owner)) { const d = Array.isArray(m.d) ? m.d.slice(0, 3).map(v => num(v, -1, 1, 0)) : [0, 0, 0]; send(clients.get(owner), { t: 'pyeet', id, pid: c.id, d }); }
        broadcast({ t: 'pown', id, owner, grab: T.o.grab, ropes: T.o.ropes });
        break;
      }
      case 'phand': {
        const id = num(m.id, -1e9, MAX_ITEM, -1e9) | 0, T = grabTarget(id); if (!T) return;
        const rope = m.rope === true; if (!(rope ? T.o.ropes || [] : T.o.grab || []).includes(c.id)) return;
        const owner = id >= 0 ? T.o.owner : T.c.id; if (owner === c.id) return;
        const h = Array.isArray(m.h) ? m.h.slice(0, 3).map((v, i) => num(v, i === 1 ? -10 : -620, i === 1 ? 210 : 620, 0)) : null; if (!h) return;
        const o = clients.get(owner); if (o) send(o, { t: 'phand', id, pid: c.id, h, rope, st: num(m.st, 0, 200, 100) });
        break;
      }
      case 'pst': {
        const id = num(m.id, 0, MAX_ITEM, -1) | 0, p = world.props[id]; if (!p || p.owner !== c.id) return;
        const x = num(m.x, -595, 595, p.x), z = num(m.z, -595, 595, p.z);
        if (Math.hypot(x - c.x, z - c.z) > 40) return; // the owner is somewhere near their prop
        p.x = r2(x); p.z = r2(z); p.y = r2(num(m.y, -10, 60, p.y || 0));
        const v0 = p.v0 || SIM.HEAVY[p.type] || 0; if (v0) p.val = Math.min(p.val == null ? v0 : p.val, num(m.val, 0, v0, v0) | 0); // value only ever goes down
        if (p.type === 'cart') p.tip = m.tip === true;
        if (Array.isArray(m.q) && m.q.length === 4) p.q = m.q.map(v => Math.round(num(v, -1, 1, 0) * 1000) / 1000); // loot's orientation (84-rigid.js)
        if (m.rest === true && !(p.grab || []).includes(c.id) && !(p.ropes || []).includes(c.id)) passOwner(p, c.id); // settled and let go: whoever still holds it takes over (or the next grabber)
        for (const lid of p.load || []) if (lid >= 0 && world.props[lid]) { world.props[lid].x = p.x; world.props[lid].z = p.z; } // loot riding in the cart
        dirty = true;
        broadcast({ t: 'pst', id, x: p.x, y: p.y, z: p.z, vx: num(m.vx, -40, 40, 0), vy: num(m.vy, -40, 40, 0), vz: num(m.vz, -40, 40, 0), val: p.val, rest: m.rest === true, tip: p.tip, q: p.q, owner: p.owner, grab: p.grab || [], ropes: p.ropes || [] }, c.id);
        if (Math.hypot(p.x - SIM.SELL.x, p.z - SIM.SELL.z) < SIM.SELL.r) {
          const sell = p.type === 'cart' ? (p.load || []).filter(l => l >= 0 && world.props[l]) : [id];
          for (const sid of sell) {
            const q = world.props[sid], v = q.val == null ? SIM.HEAVY[q.type] : q.val, who = [...new Set([c.id, ...(p.grab || []), ...(p.ropes || [])])];
            delete world.props[sid]; if (p.load) p.load = p.load.filter(l => l !== sid);
            world.run.bank += v * payMult(); dirty = true;
            LOG.log('propSold', { item: sid, type: q.type, v, who, cart: p.type === 'cart' });
            broadcast({ t: 'psold', id: sid, v, who });
          }
          if (sell.length) { broadcast(runInfo()); if (p.type === 'cart') broadcast({ t: 'pcart', id, load: p.load || [] }); }
        }
        break;
      }
      case 'breach': { // an 8 ft hole broke through into the buried town (89-town.js). Must be a real, deep hole near you.
        const x = r1(num(m.x, -595, 595, 0)), z = r1(num(m.z, -595, 595, 0)), k = x + '|' + z;
        if ((world.zone || 'lake') !== 'lake' || Math.hypot(x - c.x, z - c.z) > 6 || (world.holes[k] || 0) < 2.4) return;
        if (!SIM.townBreaks(x, z, world.run.day)) return;
        world.breaches = world.breaches || {}; if (world.breaches[k]) return;
        world.breaches[k] = { x, z, at: Date.now(), ladder: false }; dirty = true;
        LOG.log('breach', { id: c.id, n: c.n, x, z });
        broadcast({ t: 'breach', k, ...world.breaches[k] });
        break;
      }
      case 'ladder': { // someone staked a rope ladder in a shaft: anyone can climb it now
        const k = String(m.k || ''), b = (world.breaches || {})[k]; if (!b) return;
        b.ladder = true; dirty = true; broadcast({ t: 'breach', k, ...b });
        break;
      }
      case 'tgot': { // town loot picked up (ids are per day's layout)
        const id = num(m.id, 0, 999, -1) | 0; if (id < 0) return;
        world.tgot = world.tgot && world.tgot.day === world.run.day ? world.tgot : { day: world.run.day, ids: [] };
        if (world.tgot.ids.includes(id)) return;
        world.tgot.ids.push(id); dirty = true; broadcast({ t: 'tgot', id }, c.id);
        break;
      }
      case 'pslip': { // the rope slipped (the owner's physics says so): everyone's rope on it comes loose
        const id = num(m.id, -1e9, MAX_ITEM, -1e9) | 0, T = grabTarget(id); if (!T) return;
        if ((id >= 0 ? T.o.owner : T.c.id) !== c.id) return;
        T.o.ropes = []; LOG.log('ropeSlip', { id, by: c.n });
        broadcast({ t: 'pslip', id }); broadcast({ t: 'pown', id, owner: id >= 0 ? T.o.owner : T.c.id, grab: T.o.grab || [], ropes: [] });
        break;
      }
      case 'pcall': { // host/play-test console: bring the wheelbarrow to just in front of you
        if (!c.host) return; ensureCart(); const k = world.props[CART_ID];
        for (const l of k.load || []) if (l >= 0 && world.props[l]) world.props[l].cartId = null;
        k.x = r2(num(m.x, -595, 595, c.x)); k.z = r2(num(m.z, -595, 595, c.z)); k.tip = false; k.load = []; k.owner = null; k.grab = []; k.ropes = []; dirty = true;
        broadcast({ t: 'pcart', id: CART_ID, load: [], tip: false }); broadcast({ t: 'pst', id: CART_ID, x: k.x, y: 0, z: k.z, vx: 0, vy: 0, vz: 0, rest: true, tip: false, owner: null, grab: [], ropes: [] });
        break;
      }
      case 'pload': { // put what you're holding (loot, or a downed friend: negative id) in the wheelbarrow
        const id = num(m.id, -1e9, MAX_ITEM, -1e9) | 0, cartId = num(m.cart, 0, MAX_ITEM, -1) | 0, cart = world.props[cartId], T = grabTarget(id);
        if (!cart || cart.type !== 'cart' || !T || id === cartId || cart.tip) return;
        if (!near(c, cart, 4) || Math.hypot(T.x - cart.x, T.z - cart.z) > 5) return;
        cart.load = (cart.load || []).filter(l => l >= 0 ? !!world.props[l] : clients.has(-l));
        if (cart.load.length >= SIM.CART.CAP || cart.load.includes(id)) return;
        cart.load.push(id); T.o.grab = []; T.o.ropes = [];
        if (id >= 0) { T.o.cartId = cartId; T.o.owner = null; T.o.x = cart.x; T.o.z = cart.z; broadcast({ t: 'pown', id, owner: null, grab: [], ropes: [] }); }
        else { T.c.cartId = cartId; send(T.c, { t: 'pown', id, owner: T.c.id, grab: [], ropes: [] }); }
        dirty = true; LOG.log('cartLoad', { id, cart: cartId, by: c.n });
        broadcast({ t: 'pcart', id: cartId, load: cart.load });
        break;
      }
      case 'ptip': { // the wheelbarrow went over: everything in it spills out around it (only its owner can say so)
        const id = num(m.id, 0, MAX_ITEM, -1) | 0, cart = world.props[id]; if (!cart || cart.type !== 'cart' || cart.owner !== c.id) return;
        cart.tip = true; const spill = [];
        for (const l of cart.load || []) {
          const a = Math.random() * Math.PI * 2, x = r2(cart.x + Math.cos(a) * 1.6), z = r2(cart.z + Math.sin(a) * 1.6);
          if (l >= 0 && world.props[l]) { const q = world.props[l]; q.cartId = null; q.x = x; q.z = z; spill.push([l, x, z]); }
          else if (l < 0 && clients.has(-l)) { clients.get(-l).cartId = null; spill.push([l, x, z]); }
        }
        cart.load = []; dirty = true; LOG.log('cartTip', { cart: id, by: c.n, n: spill.length });
        broadcast({ t: 'pcart', id, load: [], tip: true, spill });
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
        for (const o of clients.values()) {
          if (!o.joined || o === c) continue;
          if (o.room === c.room && near(c, o, CHAT_RANGE)) send(o, { t: 'chat', id: c.id, s });
          else if (c.wk && o.wk) send(o, { t: 'chatw', id: c.id, n: c.n, s }); // walkie-talkies reach each other anywhere
        }
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
      case 'zone':
        // Host console "zone <name>": move the whole crew to another map (for testing, until the escape starts it).
        if (!c.host || typeof m.zone !== 'string') return;
        zoneSwitch(m.zone, 'console by ' + c.n);
        break;
      case 'cp':
        // A camper walked into (or out of) the current map's campfire circle.
        c.cp = m.on === true;
        checkCampfire();
        break;
      case 'zev': {
        // Something in a map that changes for everyone and stays changed, e.g. a rope dropped down a dry fall.
        if (typeof m.k !== 'string' || !/^[a-z]{1,12}$/.test(m.k)) return;
        const key = m.k + (num(m.i, 0, 50, 0) | 0);
        if (!world.zflags || typeof world.zflags !== 'object') world.zflags = {};
        if (world.zflags[key]) return;
        world.zflags[key] = 1; dirty = true;
        LOG.log('zev', { id: c.id, n: c.n, key, zone: world.zone || 'lake' });
        broadcast({ t: 'zev', key, n: c.n });
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
      case 'rswat': { // a shovel swing at the small roster critters (public/js/83-roster.js rosterSwing)
        const now = Date.now(); if (now - (c.rswatAt || 0) < 300) return; c.rswatAt = now;
        const sx = num(m.x, -620, 620, c.x), sz = num(m.z, -620, 620, c.z), sfa = num(m.fa, -10, 10, c.r);
        if (Math.hypot(sx - c.x, sz - c.z) > 3) return; // must be (about) where the server last saw you
        const rev = []; if (SIM.rosterSwat(ROSTER, { id: c.id, x: sx, z: sz, fa: sfa }, rev)) broadcast({ t: 'rost', list: SIM.packRoster(ROSTER), ev: rev, today: ROSTER.roster });
        break;
      }
      case 'roster': { // host/play-test console: roster all | off | today | <kind>  (see 83-roster.js)
        if (!c.host) return;
        const op = String(m.op || '');
        if (op === 'all') { ROSTER.all = true; ROSTER.off = []; }
        else if (op === 'today') { ROSTER.all = false; ROSTER.force = []; ROSTER.off = []; }
        else if (op === 'off') { ROSTER.all = false; ROSTER.force = []; ROSTER.off = SIM.RO_KINDS.slice(); ROSTER.mobs = []; }
        else if (SIM.RO_KINDS.includes(op)) { ROSTER.off = (ROSTER.off || []).filter(k => k !== op); ROSTER.force = [...new Set([...(ROSTER.force || []), op])]; SIM.rosterSpawnNow(ROSTER, op, { x: c.x, z: c.z }); }
        else return;
        LOG.log('roster', { op, by: c.n });
        break;
      }
      case 'suit': { c.u = num(m.u, 0, 9, 0) | 0; broadcast({ t: 'suit', id: c.id, u: c.u }, c.id); break; }
      case 'carried': { // a downed camper got carried back inside the fence: tell the people who carried them (badges)
        const who = (Array.isArray(m.who) ? m.who : []).map(v => num(v, 0, 1e9, -1) | 0).filter(v => v > 0).slice(0, 8);
        LOG.log('carriedHome', { id: c.id, n: c.n, by: who });
        for (const id of who) { const o = clients.get(id); if (o) send(o, { t: 'carried', who }); }
        break;
      }
      case 'koCurse': { // a camper got knocked out (any cause): the curse grows a little. At most once a minute each.
        const now = Date.now(); if (now - (c.koCurseAt || 0) < 60000) return; c.koCurseAt = now;
        addCurse(tuneS('curse.ko', 4), `${c.n} knocked out`);
        break;
      }
      case 'runset': { // host/play-test console: curse <n> | mood <name>
        if (!c.host) return;
        if (m.curse != null) { world.run.curse = Math.max(0, Math.min(100, num(m.curse, 0, 100, 0))); }
        if (typeof m.mood === 'string' && SIM.MOODS[m.mood]) world.run.mood = m.mood;
        dirty = true; LOG.log('runset', { by: c.n, curse: world.run.curse, mood: world.run.mood }); broadcast(runInfo());
        break;
      }
      case 'emote': { // twerk / sing (public/js/73-emotes.js), tonic / medkit in hand (86-walkie.js): relay to everyone else, at most one every 0.8 s
        const k = ['twerk', 'sing', 'tonic', 'medkit'].includes(m.k) ? m.k : null; if (!k) return;
        const now = Date.now(); if (now - (c.emoteAt || 0) < 800) return; c.emoteAt = now;
        if (k === 'tonic' || k === 'medkit') { broadcast({ t: 'emote', id: c.id, k }, c.id); break }
        c.nz = 1; // noisy: draws Madame Zeroni like a shout
        if (k === 'sing' && MON.zer && Math.hypot(MON.zer.x - c.x, MON.zer.z - c.z) < 14) { // the lullaby, close to her: she fades away for the night
          MON.zer.song = (MON.zer.song || 0) + 1;
          if (MON.zer.song >= SIM.CURSE.SONG + 2 * Math.max(0, joined().length - 1)) {
            const zx = MON.zer.x, zz = MON.zer.z; MON.appeased = true; MON.zer = null;
            LOG.log('appeased', { by: c.n }); broadcast({ t: 'mon', ...monSnapshot(), ev: [{ k: 'appeased', x: r1(zx), z: r1(zz), by: c.n }] });
            addCurse(-tuneS('curse.lullaby', 20), `${c.n} sang Madame Zeroni away`);
          }
        }
        broadcast({ t: 'emote', id: c.id, k }, c.id);
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
    for (const [pid, p] of Object.entries(world.props)) { // let go of anything they were holding; what they were running passes on
      const held = (p.grab || []).includes(c.id) || (p.ropes || []).includes(c.id);
      if (!held && p.owner !== c.id) continue;
      p.grab = (p.grab || []).filter(g => g !== c.id); p.ropes = (p.ropes || []).filter(g => g !== c.id); passOwner(p, c.id);
      broadcast({ t: 'pown', id: +pid, owner: p.owner, grab: p.grab, ropes: p.ropes });
    }
    if (kbHolder === c.id && !world.kb) {
      // The camper walked off with the gold tube without reporting it: put it back in the ground.
      kbHolder = null;
      if (gotSet.delete(kbItem)) { dirty = true; broadcast({ t: 'ungot', item: kbItem }); }
    }
    if (c.joined) { LOG.log('leave', { id: c.id, n: c.n }); broadcast({ t: 'leave', id: c.id }); broadcastSleep(); maybeSkipNight(); if ((world.zone || 'lake') !== 'lake') checkCampfire(); }
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
// Grab targets (see 'pgrab'): a prop, or the body of a downed camper (negative id). o holds its grab/ropes lists.
function grabTarget(id) {
  if (id >= 0) { const p = world.props[id]; return p ? { o: p, x: p.x, z: p.z } : null; }
  const b = clients.get(-id); if (!b || !b.joined || !((b.f & 2) || Date.now() - b.dnAt < 2000)) return null;
  b.body = b.body || { grab: [], ropes: [] }; return { o: b.body, c: b, x: b.x, z: b.z };
}
function unloadFromCart(id) {
  const p = world.props[id]; if (!p || p.cartId == null) return;
  const cart = world.props[p.cartId]; p.cartId = null;
  if (cart) { cart.load = (cart.load || []).filter(l => l !== id); broadcast({ t: 'pcart', id: +Object.keys(world.props).find(k => world.props[k] === cart), load: cart.load }); }
}
// the crew's wheelbarrow: always one, parked by the Wreck Room (id CART_ID, never sold)
const CART_ID = 9999;
function ensureCart() { if (!world.props[CART_ID]) { world.props[CART_ID] = { type: 'cart', x: SIM.CART.HOME.x, z: SIM.CART.HOME.z, load: [] }; dirty = true; } }
ensureCart();
// The day's monster roster (sim.js stepRoster): hatchlings, rattlesnakes, scorpions, Mr. Sir, the Warden, the Sheriff's
// ghost and Kate Barlow's ghost. Same pattern as the herd: server-authoritative, one 'rost' message per tick while any are out.
const ROSTER = { mobs: [] };
let rostOn = false;
function tickRoster(t, dt, players) {
  const rev = []; SIM.stepRoster(ROSTER, players, t, dt, rev, { day: world.run.day, curse: world.run.curse || 0, mood: world.run.mood, rate: tuneS('mon.roster', 1), sheriffWin: tuneS('ro.sheriffWin', 0.15) });
  const now = Date.now();
  for (const e of rev) {
    if (e.k === 'down') { const c = clients.get(e.id); if (c) c.dnAt = now; }
    if (e.k !== 'rattle') LOG.log('roster', { ev: e.k, id: e.id, by: e.by });
  }
  const on = ROSTER.mobs.length > 0;
  if (on || rostOn || rev.length) broadcast({ t: 'rost', list: SIM.packRoster(ROSTER), ev: rev, today: ROSTER.roster });
  rostOn = on;
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
  return joined().filter(c => !c.town).map(c => ({   // campers down in the buried town (89-town.js) are out of reach of the lake
    id: c.id, x: c.x, z: c.z, fa: c.r, cy: c.cy, hp: c.hp,
    hd: !!(c.f & 1), cr: !!(c.f & 8), lt: !!(c.f & 4), an: c.a,
    dn: !!(c.f & 2) || now - c.dnAt < 2000,
    nz: now - (c.chatAt || 0) < 3000 ? 1 : c.nz,
    kt: !!c.kt, on: !!c.on, vy: c.vy || 0, // for the roster (sim.js stepRoster): Kate's loot, an onion on, where the camera looks
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
    world.run.curse = Math.max(0, (world.run.curse || 0) - tuneS('curse.quota', 10)); world.run.mood = SIM.rollMood(world.run.day, world.run.curse);
    broadcast({ ...runInfo(), t: 'quota', met: true });
  } else {
    // Fired: the run starts over. The lake is refilled and everyone's seeds and gear are gone (levels stay).
    const got = q.bank;
    LOG.log('fired', { bank: got, quota: q.quota });
    const wasZone = world.zone || 'lake';
    world = Object.assign(freshWorld(1), { hostNames: world.hostNames, clock: world.clock, players: world.players, run: freshRun() }); ensureCart();
    gotSet = new Set(); kbHolder = null; dirty = true; save();
    broadcast({ t: 'fired', bank: got, quota: q.quota });
    if (wasZone !== 'lake') broadcast(zoneMsg()); // a fresh run starts back at camp
  }
}
setInterval(() => {
  const now = Date.now(), dt = Math.min(0.25, (now - lastTick) / 1000); lastTick = now;
  const t = SIM.clockT(world.clock, now);
  if (lastT < SIM.DAYMS && t >= SIM.DAYMS) {
    // roll call at curfew: anyone still outside the fence makes the curse worse (the lake only; see 88-zones.js)
    const out = (world.zone || 'lake') === 'lake' ? joined().filter(c => !c.town && !SIM.inCamp(c.x, c.z)).length : 0;
    if (out) addCurse(tuneS('curse.curfew', 5) * out, `${out} camper${out > 1 ? 's' : ''} outside the fence at curfew`);
    endOfDay();
  }
  if (lastT > t + SIM.CYCLE / 2 && (world.run.curse || 0) > 0) addCurse(-tuneS('curse.dawn', 3), 'dawn');   // the clock wrapped: a new morning
  lastT = t;
  if (t < SIM.DAYMS && joined().length) world.run.played = (world.run.played || 0) + dt;
  const players = simPlayers(now);
  // heavy loot
  // heavy loot is grab physics now (public/js/84-grab.js): the holder's page simulates it and reports 'pst'; see there.
  for (const id in world.props) { const p = world.props[id]; if (p.owner != null && !clients.has(p.owner)) { p.owner = null; p.grab = (p.grab || []).filter(g => clients.has(g)); } }
  // monsters
  const ev = [];
  if ((world.zone || 'lake') === 'lake') SIM.stepMonsters(MON, players, t, dt, ev, { mood: world.run.mood }); else { MON.trucks = []; MON.zer = null; } // police and Zeroni are the lake's (88-zones.js)
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
  for (const d of DIRECTOR.step(dirState, { now, day: world.run.day, clockT: t, players: dirPlayers, hazardNow: hz, zone: world.zone || 'lake', curse: world.run.curse || 0, rate: tuneS('mon.events', 1) })) {
    LOG.log('director', { kind: d.kind, x: d.x, z: d.z, target: d.targetId, major: d.major, why: 'natural roll' });
    if (d.mode === 'env') broadcast({ t: 'env', id: 0, n: '', k: d.kind, x: d.x, z: d.z, a: d.a, t0: hz, dir: true });
    else { const tp = clients.get(d.targetId); dirStartMonster(d, tp ? tp.x : d.x, tp ? tp.z : d.z); }
  }
  if (now - lastDirInfoT >= 3000 && joined().length) {
    lastDirInfoT = now;
    broadcast({ t: 'dirinfo', ...DIRECTOR.describe(dirState, now, world.run.day, Math.max(1, joined().length)) });
  }
  tickJavelinas(t, dt, players);
  tickRoster(t, dt, players);
  for (const c of clients.values()) c.nz *= 0.9;
}, 100);

setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false; try { c.ws.ping(); } catch (e) { /* closing */ }
  }
  if (world.won && Date.now() - world.wonAt > NEW_DAY_AFTER_WIN_MS) {
    world = Object.assign(freshWorld(world.day + 1), { recent: world.recent, hostNames: world.hostNames, clock: world.clock, run: world.run, players: world.players }); ensureCart(); gotSet = new Set(); kbHolder = null; dirty = true; save();
    broadcast({ t: 'reset' });
  }
}, 30000);

process.on('SIGINT', () => { dirty = true; save(); LOG.flushSync(); setTimeout(() => process.exit(0), 300); });
process.on('SIGTERM', () => { dirty = true; save(); LOG.flushSync(); setTimeout(() => process.exit(0), 300); });

server.listen(PORT, '127.0.0.1', () => console.log(`Camp Green Lake listening on 127.0.0.1:${PORT}`));
