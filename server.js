// Camp Green Lake multiplayer server: serves the game and relays campers over WebSocket.
// The world (holes, dug-up items, the KB tube, the suitcase) is kept here so late joiners see it.
// It also runs the shared rules in public/sim.js: the crew bank, heavy loot, and the night monsters.
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
// One page load is ~150 static requests now (53 scripts, 67 models, 24 sounds, css; measured 2026-09-29).
// Counting those against HTTP_RATE blocked a player after 3 reloads in a minute (429s -> missing scripts ->
// "setClock is not defined" -> dead page). Static files get their own, much bigger budget instead. At 1500 that
// was only ~10 loads a minute, and the two-browser smoke test started tripping it ("setHat is not defined").
const STATIC_RATE = 6000; // static file requests per address per minute (~40 full page loads)
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
const MAX_DEPOSIT = 100000;                  // gold per crew-bank deposit; trims a hacked client's ceiling
const MAX_WALLET_D = 100000;               // gold per crew-wallet change (public/js/84-wallet.js); trims a hacked client's ceiling
const WALLET_RATE = 30, WALLET_WINDOW_MS = 5000; // wallet changes per connection per window (flecks, sifts, blackjack hands, purchases)
const MAX_CREW_DEPOSIT = 600;                // one D Tent crew bucket (5 holes, a nugget on a dig day: ~200)
const CREW_NAMES = SIM.CREW; // the D Tent crew (public/js/30-npcs.js BOTDEF)

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
  for (const c of clients.values()) { c.cp = false; c.summit = false; }
  dirty = true;
  LOG.log('zone', { from: cur, to: id, why });
  broadcast(zoneMsg());
  if (typeof truckPark === 'function') truckPark();   // back in its spot by the main gate (and nobody's in it)
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

/* Mr. Sir's pickup (public/js/87-truck.js): drivable while the F2 flag veh.drivable is on. One driver runs its physics
   and sends where it is; seats: drive, shotgun and two on the tailgate (TRUCK_SEATS). With the flag on it waits just inside the service gate, nose in;
   backing it out through the gate and driving off is the escape: the whole crew moves on to the next map (like
   everyone reaching the campfire). With the flag off it's parked by Mr. Sir. */
const TRUCK_PARK = { x: 6.1, z: 31.2, h: Math.PI / 2 }, TRUCK_GATE_PARK = { x: 25.4, z: 39, h: -Math.PI / 2 }, TRUCK_SEATS = ['drive', 'shotgun', 'tail0', 'tail1'];
const TRUCK = { x: TRUCK_PARK.x, z: TRUCK_PARK.z, h: TRUCK_PARK.h, seats: {} };
const truckSeatOf = id => TRUCK_SEATS.find(k => TRUCK.seats[k] === id) || null;
const truckOn = () => tuneS('veh.drivable', 0) >= 0.5 && (world.zone || 'lake') === 'lake' && !TRUCK.wreck;
let truckWasOn = false;
const truckMsg = park => ({ t: 'truck', st: { x: TRUCK.x, z: TRUCK.z, h: TRUCK.h, seats: TRUCK.seats, on: truckOn(), park: !!park, wreck: !!TRUCK.wreck } });
// whose page runs its physics: the driver, or with nobody driving the camper with the lowest id (87-truck.js truckOwner)
function truckOwner() { if (TRUCK.seats.drive != null && clients.has(TRUCK.seats.drive)) return TRUCK.seats.drive; let lo = null; for (const c of joined()) if (lo == null || c.id < lo) lo = c.id; return lo; }
const TRUCK_RAM_SPEED = 4, truckRamAt = {};   // creatures in its way at this speed get knocked (per creature, once a second)
function truckRams(now, jev) {
  const d = TRUCK.seats.drive, sp = Math.hypot(TRUCK.vx || 0, TRUCK.vz || 0);
  if (d == null || sp < TRUCK_RAM_SPEED || !truckOn()) return;
  const hit = (k, x, z, r) => { const dx = x - TRUCK.x, dz = z - TRUCK.z, c = Math.cos(TRUCK.h), s = Math.sin(TRUCK.h);
    if (Math.abs(dx * c - dz * s) > 1 + r || Math.abs(dx * s + dz * c) > 2.6 + r || (truckRamAt[k] || 0) > now) return false; truckRamAt[k] = now + 1000; return true; };
  JAV.list.forEach((j, i) => { if (j && !j.state && hit('j' + i, j.x, j.z, 0.6)) SIM.whackJavelina(JAV, i, TRUCK.x, TRUCK.z, jev, d); });
  if (LION.active && hit('lion', LION.x, LION.z, 0.8)) { SIM.lionSwat(LION); SIM.lionSwat(LION); lionEvQ.push({ k: 'swat', id: d }); }
  const rev = [], fa = TRUCK.h;
  for (const m of ROSTER.mobs || []) if (hit('r' + m.id, m.x, m.z, 0.5)) SIM.rosterSwat(ROSTER, { id: d, x: m.x - Math.sin(fa) * 1, z: m.z - Math.cos(fa) * 1, fa }, rev);
  if (rev.length) broadcast({ t: 'rost', list: SIM.packRoster(ROSTER), ev: rev, today: ROSTER.roster });
}
function truckPark() { TRUCK.parkAt = Date.now(); TRUCK.wreck = 0; Object.assign(TRUCK, truckOn() ? TRUCK_GATE_PARK : TRUCK_PARK, { seats: {}, vx: 0, vz: 0 }); broadcast(truckMsg(true)); }
function truckLeave(id) { const k = truckSeatOf(id); if (!k) return; delete TRUCK.seats[k]; broadcast(truckMsg()); }
/* The end of Act 1: the whole crew on top of the wall past the trench (88-north.js). Like the campfire: everyone joined
   (and not down in the buried town) has to be up there. */
function checkSummit() {
  if ((world.zone || 'lake') !== 'lake') return;
  const js = joined().filter(c => !c.town), at = js.filter(c => c.summit).length;
  broadcast({ t: 'sumstat', at, total: js.length });
  const next = ZONE_ORDER[ZONE_ORDER.indexOf('lake') + 1];
  if (js.length && at === js.length && next) { LOG.log('summit', { n: js.length }); for (const c of js) c.summit = false; zoneSwitch(next, 'the crew climbed the north wall'); }
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
if (!world.crew || typeof world.crew !== 'object') world.crew = {}; // the crew's upgrades: { name: { id: true } } (sim.js CREW_SHOP)
{ const was = { 'X-Ray': 'Jim Bob', Armpit: 'Randy', Squid: 'Stan', Zigzag: 'Pete', Magnet: 'Larry', Zero: 'Zach' }; // JT 2026-10-01 renamed the crew: their kit goes with them
  for (const [o, n] of Object.entries(was)) if (world.crew[o]) { world.crew[n] = Object.assign(world.crew[n] || {}, world.crew[o]); delete world.crew[o]; }
  for (const n of Object.keys(world.crew)) if (Object.keys(world.crew[n]).length && world.crew[n].hired === undefined) world.crew[n].hired = true; } // kit bought before hiring existed: he's on the crew
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
  audio: { ext: '.mp3', type: 'audio/mpeg' },         // licensed ambience and Foley (public/audio/*.mp3)
  data: { ext: '.json', type: 'application/json' } }; // data exported with the models, e.g. public/data/TownColliders.json (art/blender/town.py)
// The hat comparison studio has a small explicit file list; it cannot browse arbitrary public files.
const HAT_LAB_FILES = Object.fromEntries([
  ['index.html','text/html; charset=utf-8'],['style.css','text/css; charset=utf-8'],
  ['viewer.js','text/javascript; charset=utf-8'],['manifest.json','application/json'],
  ['vendor/three.min.js','text/javascript; charset=utf-8'],['vendor/GLTFLoader.js','text/javascript; charset=utf-8'],
  ...['all-20','hats-1-5','hats-6-10','hats-11-15','hats-16-20'].map(n=>['previews/'+n+'.png','image/png'])
].map(([file,type])=>['/hat-lab/'+file,{file,type}]));
HAT_LAB_FILES['/hat-lab/']=HAT_LAB_FILES['/hat-lab/index.html'];
const FACE_LAB_FILES=Object.fromEntries([
  ['index.html','text/html; charset=utf-8'],['style.css','text/css; charset=utf-8'],
  ['viewer.js','text/javascript; charset=utf-8'],['manifest.json','application/json'],
  ...['all-20','faces-1-5','faces-6-10','faces-11-15','faces-16-20'].map(n=>['previews/'+n+'.png','image/png'])
].map(([file,type])=>['/face-lab/'+file,{file,type}]));
FACE_LAB_FILES['/face-lab/']=FACE_LAB_FILES['/face-lab/index.html'];
const GLASSES_LAB_FILES=Object.fromEntries([
  ['index.html','text/html; charset=utf-8'],['style.css','text/css; charset=utf-8'],
  ['viewer.js','text/javascript; charset=utf-8'],['manifest.json','application/json'],
  ...['all-20','glasses-1-5','glasses-6-10','glasses-11-15','glasses-16-20'].map(n=>['previews/'+n+'.png','image/png'])
].map(([file,type])=>['/glasses-lab/'+file,{file,type}]));
GLASSES_LAB_FILES['/glasses-lab/']=GLASSES_LAB_FILES['/glasses-lab/index.html'];
const CLOTHES_LAB_FILES=Object.fromEntries([
  ['index.html','text/html; charset=utf-8'],['style.css','text/css; charset=utf-8'],
  ['viewer.js','text/javascript; charset=utf-8'],['manifest.json','application/json'],
  ...['all-20','clothes-1-5','clothes-6-10','clothes-11-15','clothes-16-20'].map(n=>['previews/'+n+'.png','image/png'])
].map(([file,type])=>['/clothes-lab/'+file,{file,type}]));
CLOTHES_LAB_FILES['/clothes-lab/']=CLOTHES_LAB_FILES['/clothes-lab/index.html'];
const FOOTWEAR_LAB_FILES=Object.fromEntries([
  ['index.html','text/html; charset=utf-8'],['style.css','text/css; charset=utf-8'],
  ['viewer.js','text/javascript; charset=utf-8'],['manifest.json','application/json'],
  ...['all-20','footwear-1-5','footwear-6-10','footwear-11-15','footwear-16-20'].map(n=>['previews/'+n+'.png','image/png'])
].map(([file,type])=>['/footwear-lab/'+file,{file,type}]));
FOOTWEAR_LAB_FILES['/footwear-lab/']=FOOTWEAR_LAB_FILES['/footwear-lab/index.html'];
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
truckWasOn = truckOn(); if (truckWasOn) Object.assign(TRUCK, TRUCK_GATE_PARK); // the pickup's flag was on at startup: it waits by the service gate
/* Landmines (JT 2026-10-01; public/js/88-mines.js): every ~haz.mineEvery seconds one goes down on the lakebed outside
   the fence, 8-45 m from a camper who's out there (so they turn up where people dig), up to haz.mineMax at once. Not
   saved: a restart clears the lake. Off with the F2 flag haz.mines. */
const MINES = []; let mineSeq = 1, mineNextT = Date.now() + 20000;
function mineTick(now) {
  if (tuneS('haz.mines', 1) < 0.5 || !hazOnS('mines') || (world.zone || 'lake') !== 'lake') { if (MINES.length) { MINES.length = 0; broadcast({ t: 'mines', list: [] }); } return; }
  if (now < mineNextT) return;
  mineNextT = now + tuneS('haz.mineEvery', 25) * 1000 * (0.6 + Math.random() * 0.8);
  if (MINES.length >= tuneS('haz.mineMax', 12)) return;
  const outs = joined().filter(c => !c.town && c.room == null && !SIM.inCamp(c.x, c.z));
  if (!outs.length) return;
  const o = outs[Math.floor(Math.random() * outs.length)];
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 37, x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
    if (Math.abs(x) > 590 || Math.abs(z) > 590 || SIM.inCamp(x, z) || SIM.nearCampZone(x, z)) continue;
    if (joined().some(c => Math.hypot(c.x - x, c.z - z) < 5)) continue;   // never right under someone
    if (Object.keys(world.holes).some(h => { const [hx, hz] = h.split('|').map(Number); return Math.hypot(hx - x, hz - z) < 2; })) continue;   // nor in a hole
    const k = { id: mineSeq++, x: r2(x), z: r2(z) }; MINES.push(k); broadcast({ t: 'mine', m: k }); return;
  }
}
/* the sand pipeline (public/js/88-pipeline.js): one for the camp, saved with the world, gone when the crew's fired */
function pipeW() {
  if (!world.pipe || typeof world.pipe !== 'object' || !Array.isArray(world.pipe.nodes)) world.pipe = { nodes: [], broken: {} };
  if (!world.pipe.broken || typeof world.pipe.broken !== 'object') world.pipe.broken = {};
  const p = world.pipe;
  // a tree since branches (JT 2026-10-01): every node names its parent; runs are keyed by the child. Old chains: convert.
  if (p.nodes.length > 1 && p.nodes[1].p === undefined) { p.nodes.forEach((n, i) => { n.p = i - 1; }); const b = {}; for (const k in p.broken) if (p.broken[k]) b[+k + 1] = true; p.broken = b; }
  return p;
}
/* may this hazard or mob happen? The F2 Hazards tab (public/js/88-hazards.js): ALL off for testing, single ones back on */
function hazOnS(k) { return tuneS('haz.all', 1) >= 0.5 || tuneS('haz.on.' + k, 0) >= 0.5; }
/* Employee of the Day (public/js/88-eotd.js): today's tallies → the four winners. Everyone on today and the hired crew
   are in the running; the Least Valuable Person found the least. */
let eotdDirty = false, eotdSentAt = 0;
function eotdStandings() {
  const f = world.run.found || {}, t = world.run.thrown || {}, s = world.run.spent || {};
  const crew = CREW_NAMES.filter(n => world.crew[n] && world.crew[n].hired), names = [...new Set([...joined().map(c => c.n), ...crew, ...Object.keys(f), ...Object.keys(t), ...Object.keys(s)])];
  const best = (o, low) => { let w = null; for (const n of names) { const v = o[n] || 0; if (!low && !(v > 0)) continue; if (!w || (low ? v < w.v : v > w.v)) w = { n, v }; } return w; };
  return { found: best(f), thrown: best(t), lvp: names.length > 1 ? best(f, true) : null, spent: best(s) };
}
function eotdReset() { world.run.found = {}; world.run.thrown = {}; world.run.spent = {}; eotdDirty = true; }
/* the UFO comes back (public/js/88-ufo.js): next new day, or 'ufo back' */
function ufoReturnAll(day) {
  for (const n of CREW_NAMES) { const k = world.crew[n]; if (!k || !k.abducted || (day != null && k.abductedDay >= day)) continue;
    k.abducted = false; k.alien = true; dirty = true; LOG.log('ufoBack', { n }); broadcast({ t: 'crew', up: world.crew }); broadcast({ t: 'ufo', n, phase: 'drop' }); }
}
/* rich veins (public/js/88-vein.js): every ~vein.every minutes a patch of the lake turns rich for vein.time minutes */
let VEIN = null, veinNextT = Date.now() + 3 * 60000;
function veinMsg() { return VEIN && Date.now() < VEIN.until ? { t: 'vein', on: true, x: VEIN.x, z: VEIN.z, r: VEIN.r, left: VEIN.until - Date.now() } : { t: 'vein', on: false }; }
function veinTick(now) {
  if (VEIN && now >= VEIN.until) { VEIN = null; broadcast(veinMsg()); }
  const every = tuneS('vein.every', 8); if (VEIN || !(every > 0) || (world.zone || 'lake') !== 'lake' || now < veinNextT) return;
  veinNextT = now + every * 60000 * (0.75 + Math.random() * 0.5);
  if (!joined().length) return;
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = 45 + Math.random() * 110, x = Math.round(5 + Math.cos(a) * d), z = Math.round(40 + Math.sin(a) * d);
    if (Math.abs(x) > 560 || Math.abs(z) > 560 || SIM.inCamp(x, z) || SIM.nearCampZone(x, z)) continue;
    VEIN = { x, z, r: 12, until: now + tuneS('vein.time', 10) * 60000 }; LOG.log('vein', { x, z }); broadcast(veinMsg()); return;
  }
}
/* dynamite going off (public/js/88-dynamite.js): a crater, a mound of loose sand, and any landmine close by goes too */
let DYN_SEQ = 1;
function dynBoomS(id, x, z) {
  const piles = world.piles || (world.piles = {});
  const ids = Object.keys(piles); if (ids.length >= 20) delete piles[ids[0]]; // the oldest mound goes
  const pile = { id, x, z, sand: tuneS('dyn.sand', 8), rich: !!(VEIN && Date.now() < VEIN.until && Math.hypot(x - VEIN.x, z - VEIN.z) < VEIN.r) }; piles[id] = pile; dirty = true;
  broadcast({ t: 'dynBoom', id, x, z, pile });
  for (const [ox, oz, d] of [[0, 0, 1.3], [0.9, 0, 0.9], [-0.9, 0, 0.9], [0, 0.9, 0.9], [0, -0.9, 0.9]]) { // the crater
    const hx = r1(x + ox), hz = r1(z + oz), k = hx + '|' + hz; if ((world.holes[k] || 0) >= d) continue;
    if (!(k in world.holes) && Object.keys(world.holes).length >= MAX_HOLES) continue;
    world.holes[k] = d; broadcast({ t: 'dig', id: 0, x: hx, z: hz, d });
  }
  for (let i = MINES.length - 1; i >= 0; i--) { const k = MINES[i]; if (Math.hypot(k.x - x, k.z - z) < tuneS('dyn.blast', 4.5)) { MINES.splice(i, 1); broadcast({ t: 'mineBoom', id: k.id, x: k.x, z: k.z, by: 'Dynamite' }); } }
}
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
      TUNE_S = clean; broadcast({ t: 'tunehaz', o: Object.fromEntries(Object.entries(clean).filter(([k]) => k.startsWith('haz.'))) }); // the hazards switch is everyone's at once (public/js/88-hazards.js)
      if (truckOn() !== truckWasOn) { truckWasOn = truckOn(); truckPark(); } else broadcast(truckMsg()); // the flag moved: to its spot by the service gate, or back by Mr. Sir
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
    const isStatic = /^\/(?:js\/[\w.-]+\.js|css\/[\w.-]+\.css|audio\/[\w.-]+\.mp3|models\/(?:(?:hats|faces|glasses|clothes|footwear)\/)?[\w.-]+\.glb|data\/[\w.-]+\.json|icons\/[\w-]+\/[\w.-]+\.png)$/.test(url0) || url0 === '/models/PipeInletPath.json' || url0 === '/sim.js' || url0 === '/director.js' || Object.hasOwn(HAT_LAB_FILES,url0) || Object.hasOwn(FACE_LAB_FILES,url0) || Object.hasOwn(GLASSES_LAB_FILES,url0) || Object.hasOwn(CLOTHES_LAB_FILES,url0) || Object.hasOwn(FOOTWEAR_LAB_FILES,url0);
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
    if (url === '/hat-lab') { res.writeHead(302,{location:'/hat-lab/'}); return res.end(); }
    if (Object.hasOwn(HAT_LAB_FILES,url)) { const f=HAT_LAB_FILES[url]; return sendFile(res,'hat-lab/'+f.file,f.type,req.method==='HEAD'); }
    if (url === '/face-lab') { res.writeHead(302,{location:'/face-lab/'}); return res.end(); }
    if (Object.hasOwn(FACE_LAB_FILES,url)) { const f=FACE_LAB_FILES[url]; return sendFile(res,'face-lab/'+f.file,f.type,req.method==='HEAD'); }
    if (url === '/glasses-lab') { res.writeHead(302,{location:'/glasses-lab/'}); return res.end(); }
    if (Object.hasOwn(GLASSES_LAB_FILES,url)) { const f=GLASSES_LAB_FILES[url]; return sendFile(res,'glasses-lab/'+f.file,f.type,req.method==='HEAD'); }
    if (url === '/clothes-lab') { res.writeHead(302,{location:'/clothes-lab/'}); return res.end(); }
    if (Object.hasOwn(CLOTHES_LAB_FILES,url)) { const f=CLOTHES_LAB_FILES[url]; return sendFile(res,'clothes-lab/'+f.file,f.type,req.method==='HEAD'); }
    if (url === '/footwear-lab') { res.writeHead(302,{location:'/footwear-lab/'}); return res.end(); }
    if (Object.hasOwn(FOOTWEAR_LAB_FILES,url)) { const f=FOOTWEAR_LAB_FILES[url]; return sendFile(res,'footwear-lab/'+f.file,f.type,req.method==='HEAD'); }
    if (url === '/' || url === '/index.html') return sendFile(res, 'index.html', 'text/html; charset=utf-8', req.method === 'HEAD');
    if (url === '/sim.js') return sendFile(res, 'sim.js', 'text/javascript; charset=utf-8', req.method === 'HEAD');
    if (url === '/director.js') return sendFile(res, 'director.js', 'text/javascript; charset=utf-8', req.method === 'HEAD');
    // split client files (see scripts/split-client.mjs): whitelisted, resolved strictly inside public/
    if (url.startsWith('/js/')) return sendStatic(res, 'js', url.slice('/js/'.length));
    if (url.startsWith('/css/')) return sendStatic(res, 'css', url.slice('/css/'.length));
    if (url.startsWith('/icons/')) return sendStatic(res, 'icons', url.slice('/icons/'.length));
    if (url === '/models/PipeInletPath.json') return sendFile(res, 'models/PipeInletPath.json', 'application/json', req.method === 'HEAD');
    if (url.startsWith('/models/')) return sendStatic(res, 'models', url.slice('/models/'.length));
    if (url.startsWith('/audio/')) return sendStatic(res, 'audio', url.slice('/audio/'.length));
    if (url.startsWith('/data/')) return sendStatic(res, 'data', url.slice('/data/'.length));
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
function joined() { return [...clients.values()].filter(c => c.joined && !c.spectator); } // spectators (public/js/96-spectate.js) watch, they don't play
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
function wardS(w) { const o = {}; for (const k of ['hat', 'face', 'glasses', 'torso', 'arms', 'legs', 'shoes']) o[k] = num(w && w[k], k === 'hat' ? -2 : -1, 19, -1) | 0; return o; } // the Wardrobe (public/js/81-wardrobe.js)
function peerInfo(c) { return { id: c.id, n: c.n, c: c.c, u: c.u || 0, w: c.w, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a, f: c.f, lv: c.lv, hp: c.hp, room: c.room }; }
function quotaNow() { return SIM.quotaFor(world.run.day, Math.max(world.run.peak || 1, joined().length, 1)); }
function runInfo() { return { t: 'run', day: world.run.day, bank: world.run.bank, quota: quotaNow(), mood: world.run.mood || 'normal', curse: Math.round(world.run.curse || 0) }; }
// the curse (sim.js CURSE): the crew's, 0-100. why: shown to everyone
function addCurse(d, why) {
  const was = world.run.curse || 0; world.run.curse = Math.max(0, Math.min(100, was + d)); dirty = true;
  if (Math.round(world.run.curse) === Math.round(was)) return;
  LOG.log('curse', { d, curse: Math.round(world.run.curse), why }); broadcast({ t: 'curse', d, curse: Math.round(world.run.curse), why }); broadcast(runInfo());
}
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
      peers: [...clients.values()].filter(p => p.joined && !p.spectator && p.id !== c.id).map(peerInfo),
      mon: monSnapshot(), // ground truth for a (re)connecting client: never make it wait for the next change
      mines: MINES, // landmines (public/js/88-mines.js)
      pipe: pipeW(), // the sand pipeline (public/js/88-pipeline.js)
      camp: world.camp || {}, // the camp's upgrades (public/js/84-camp.js)
      piles: Object.values(world.piles || {}), // loose sand from dynamite (public/js/88-dynamite.js)
      scares: world.scares || [], // scarecrows (public/js/88-gear.js)
      crewWard: world.crewWard || {}, // what the crew are wearing (public/js/81-wardrobe.js)
      vein: veinMsg(), // a rich vein, if one's on (public/js/88-vein.js)
      eotd: eotdStandings(), // Employee of the Day (public/js/88-eotd.js)
      dirOn: dirState.enabled, // event director on/off, and any of its events still running that can be replayed
      dirEvents: DIRECTOR.activeEvents(dirState, Date.now()).map(e => ({ k: e.kind, x: e.x, z: e.z, t0: e.t0 })),
      jav: javSnapshot(), // ditto for the javelina herd, if one's out there right now
      truck: truckMsg(true).st, // Mr. Sir's pickup (87-truck.js)
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
      c.n = cleanName(m.n); c.c = num(m.c, 0, 7, 0) | 0; c.u = num(m.u, 0, 9, 0) | 0; c.w = wardS(m.w); // w: the Wardrobe (public/js/81-wardrobe.js); u: jumpsuit (public/js/81-badges.js)
      c.host = DEV_MODE || safeEqual(String(m.host || ''), HOST_TOKEN) || world.hostNames.includes(c.n.toLowerCase()); c.v = num(m.v, 0, 99, 0) | 0;
      send(c, { t: 'host', on: !!c.host });
      send(c, { t: 'curfew', v: SIM.CURFEW });
      send(c, { t: 'crew', up: world.crew });
      const pr = world.players[c.n.toLowerCase()];
      if (pr) send(c, { t: 'prog', xp: pr.xp });
      if (!c.joined) {
        c.spectator = m.spec === true; c.joined = true; clearTimeout(joinTimer); LOG.log('join', { id: c.id, n: c.n, spectator: c.spectator }); if (!c.spectator) broadcast({ t: 'join', ...peerInfo(c) }, c.id); // a spectator (public/js/96-spectate.js): nobody sees them
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
        c.r = num(m.r, -10, 10, c.r); c.a = num(m.a, 0, 10, 0) | 0; /* 10: sitting (86-sit.js) */ c.sc = num(m.sc, 0, 1e6, 0) | 0;
        c.wk = m.wk === true; // has a walkie-talkie (the 'chat' case)
        c.sp = m.sp === true; c.lg = m.lg === true; c.sh = m.sh !== false; c.bk = num(m.bk, -1, 1, -1); c.bt = num(m.bt, 1, 3, 1) | 0; c.dg = m.dg === true; c.gv = m.gv === true; c.gs = m.gs === true; c.hv = m.hv === true; c.hs = m.hs === true; /* hv: on a hoverboard (public/js/88-hover.js) */ /* gravity boots, gold shovel (public/js/88-gear.js) */ /* dg: their mine-sniffing dog (public/js/88-dog.js) */ /* bk: the clear backsack's fill, -1 none (public/js/86-backsack.js) */ /* lg: the long-handled shovel's handle shows (25-people.js) */ // a sharpened spade: friends see its darker blade (public/js/25-people.js spadeLook)
        c.kt = m.kt === true; c.on = m.on === true; c.vy = num(m.vy, -100, 100, 0); // roster inputs (sim.js stepRoster)
        // flags: 1 hidden in a deep hole, 2 downed, 4 flashlight on, 8 crouching, 16 stuck in a hole,
        // 32 trapped in a sinkhole, 64 holding on to pull a sinkhole friend up (see 87-sinkhole.js),
        // 128 a vulture has you (83-vultures.js), ... 2048 talking on the walkie, 4096 owns a walkie (86-walkie.js)
        c.f = num(m.f, 0, 8191, 0) | 0; c.room = Number.isInteger(m.room) && m.room >= 0 && m.room < 5 && c.y < -2 ? m.room : null; // which tent/office room (rooms are underground)
        const gotUp = c.wasDown && !(c.f & 2); c.wasDown = !!(c.f & 2); // (only as they get up: a friend can grab you on your feet, 84-grab.js)
        if (gotUp && (c.body || c.cartId != null)) { // back on their feet: nobody's holding a body any more
          if (c.cartId != null && world.props[c.cartId]) { const k = world.props[c.cartId]; k.load = (k.load || []).filter(l => l !== -c.id); broadcast({ t: 'pcart', id: c.cartId, load: k.load }); }
          c.body = null; c.cartId = null; broadcast({ t: 'pown', id: -c.id, owner: c.id, grab: [], ropes: [] });
        }
        c.cy = num(m.cy, -1, MAX_ITEM, -1) | 0; c.nz = num(m.nz, 0, 1, 0); c.lv = num(m.lv, 1, 99, 1) | 0;
        c.hp = num(m.hp, 0, 100, c.hp); // relayed so idle vultures can tell who's hurt (83-vultures.js) and for the mountain lion's targeting (lionScore in sim.js)
        world.recent[c.n.toLowerCase()] = { sc: c.sc, x: c.x, z: c.z, at: Date.now() };
        broadcast({ t: 'pos', id: c.id, x: c.x, y: c.y, z: c.z, r: c.r, a: c.a, f: c.f, lv: c.lv, hp: c.hp, room: c.room, tn: c.town, sp: c.sp, lg: c.lg, sh: c.sh, bk: c.bk, bt: c.bt, dg: c.dg, gv: c.gv, gs: c.gs, hv: c.hv, hs: c.hs }, c.id);
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
      case 'deposit': {
        // Gold a camper puts in the crew bank (the Warden's; the gold rush, sim.js GOLD). Everyone shares it. The client
        // says how much it took out of its own pocket (client-authoritative, like the rest of the economy): the rate limit
        // and MAX_DEPOSIT just cap a hacked client per message.
        if (!withinRate(c.sellTimes, SELL_RATE, SELL_WINDOW_MS)) return;
        // bot: a D Tent crew member's sifted bucket (public/js/30-npcs.js crewDeposit), paid by one camper's screen
        const bot = CREW_NAMES.includes(m.bot) ? m.bot : null;
        const v = num(m.v, 0, bot ? MAX_CREW_DEPOSIT : MAX_DEPOSIT, 0) | 0; if (!v) return;
        world.run.bank += v; dirty = true;
        if (bot) { const f = world.run.found || (world.run.found = {}); f[bot] = (f[bot] || 0) + v; eotdDirty = true; } // the crew count in "Found today" too
        LOG.log('deposit', { id: c.id, n: c.n, v, bank: world.run.bank, bot });
        broadcast({ t: 'deposit', id: c.id, n: c.n, v, bot, pipe: m.pipe === true || undefined }); // pipe: it came down the sand pipeline (public/js/88-pipeline.js)
        broadcast(runInfo());
        break;
      }
      case 'thrown': { // sent flying (public/js/88-eotd.js): you, or a crew member (crew: his name; the client that runs the crew sends it)
        if (!withinRate(c.thrownTimes || (c.thrownTimes = []), 6, 5000)) return; const n = typeof m.crew === 'string' ? (CREW_NAMES.includes(m.crew) ? m.crew : null) : c.n; if (!n) return;
        const t = world.run.thrown || (world.run.thrown = {}); t[n] = (t[n] || 0) + 1; dirty = true; eotdDirty = true; break;
      }
      case 'found': { // gold a camper brought in (public/js/84-spend.js foundGold): read out at curfew, "Found today"
        if (!withinRate(c.foundTimes || (c.foundTimes = []), WALLET_RATE, WALLET_WINDOW_MS)) return;
        const v = num(m.v, 0, 5000, 0) | 0; if (!v) return; const f = world.run.found || (world.run.found = {});
        f[c.n] = (f[c.n] || 0) + v; dirty = true; eotdDirty = true; break;
      }
      case 'wallet': {
        // One crew wallet (Greg, 2026-10-01; public/js/84-wallet.js): nobody has their own gold. Any change a camper's game
        // makes to its gold (a find, a sifted bucket, a purchase, a blackjack hand) arrives here as a delta to the crew
        // bank. Client-authoritative, like the rest of the economy: the rate limit and MAX_WALLET_D cap a hacked client.
        if (!withinRate(c.walletTimes || (c.walletTimes = []), WALLET_RATE, WALLET_WINDOW_MS)) return;
        const d = Math.round(num(m.d, -MAX_WALLET_D, MAX_WALLET_D, 0)); if (!d) return;
        // a purchase (public/js/84-spend.js walletSpend): only if the wallet still covers it right now. Two campers buying
        // at once from a wallet that covers one: the second is turned down, and anything sent with that rid (crewBuy) too.
        if (m.spend && d < 0 && world.run.bank >= -d) { const sp = world.run.spent || (world.run.spent = {}); sp[c.n] = (sp[c.n] || 0) - d; eotdDirty = true; } // Big Spender (public/js/88-eotd.js)
        if (m.spend && d < 0 && world.run.bank < -d) { const rid = num(m.rid, 0, 1e9, 0) | 0; (c.walletNo || (c.walletNo = new Set())).add(rid); send(c, { t: 'walletNo', rid }); send(c, runInfo()); break; }
        world.run.bank = Math.max(0, world.run.bank + d); dirty = true;
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
      case 'crewBuy': { // an upgrade for one of the crew (the store's "The crew" side), paid from the buyer's own gold on their screen
        if (m.rid != null && c.walletNo && c.walletNo.has(num(m.rid, 0, 1e9, -1) | 0)) return; // the wallet couldn't cover it (84-spend.js)
        if (!withinRate(c.sellTimes, SELL_RATE, SELL_WINDOW_MS)) return;
        if (m.id === 'hire') { // taking him on: the price goes up with each one already hired (sim.js crewHirePrice)
          const n = CREW_NAMES.includes(m.n) ? m.n : null; if (!n) return;
          const hired = CREW_NAMES.filter(k => world.crew[k] && world.crew[k].hired).length, cost = SIM.crewHirePrice(hired);
          if (world.crew[n] && world.crew[n].hired) { send(c, { t: 'crew', up: world.crew, refund: num(m.cost, 0, 1000, cost) | 0, n, id: 'hire' }); return; }
          world.crew[n] = Object.assign(world.crew[n] || {}, { hired: true }); dirty = true;
          LOG.log('crewHire', { id: c.id, n: c.n, crew: n, cost });
          broadcast({ t: 'crew', up: world.crew, by: c.n, byId: c.id, n, id: 'hire' });
          break;
        }
        const n = CREW_NAMES.includes(m.n) && world.crew[m.n] && world.crew[m.n].hired ? m.n : null, it = SIM.CREW_SHOP.find(i => i.id === m.id); if (!n || !it) return;
        const up = world.crew[n];
        if (it.use) { LOG.log('crewBuy', { id: c.id, n: c.n, crew: n, item: it.id, cost: it.cost }); broadcast({ t: 'crewSoda', n, by: c.n }); break; } // a consumable (the soda, public/js/88-morale.js)
        if (up[it.id] || (it.needs && !up[it.needs])) { send(c, { t: 'crew', up: world.crew, refund: it.cost, n, id: it.id }); return; } // someone beat you to it: your gold back
        up[it.id] = true; dirty = true;
        LOG.log('crewBuy', { id: c.id, n: c.n, crew: n, item: it.id, cost: it.cost });
        broadcast({ t: 'crew', up: world.crew, by: c.n, byId: c.id, n, id: it.id });
        break;
      }
      case 'pfree': { // wriggled out of everyone's hands (public/js/84-grab.js stepMeHeld): only when you're on your feet
        if (c.f & 2 || !c.body) return;
        c.body.grab = []; c.body.ropes = [];
        broadcast({ t: 'pown', id: -c.id, owner: c.id, grab: [], ropes: [] });
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
            dirty = true; // the gold goes to whoever carried it in (84-coop.js propSold), not the crew bank
            LOG.log('propSold', { item: sid, type: q.type, v, who, cart: p.type === 'cart' });
            broadcast({ t: 'psold', id: sid, v, who });
          }
          if (sell.length) { if (p.type === 'cart') broadcast({ t: 'pcart', id, load: p.load || [] }); }
        }
        break;
      }
      case 'truck': { // Mr. Sir's pickup (87-truck.js): get in/out, the driver's position, driving out the service gate
        const op = m.op;
        if (op === 'out') { truckLeave(c.id); return; }
        if (!truckOn()) { if (Object.keys(TRUCK.seats).length) truckPark(); return; }
        if (op === 'in') {
          const k = TRUCK_SEATS.includes(m.seat) ? m.seat : null;
          if (!k || Math.hypot(c.x - TRUCK.x, c.z - TRUCK.z) > 6 || truckSeatOf(c.id)) return;
          if (TRUCK.seats[k] != null && clients.has(TRUCK.seats[k])) return;   // taken
          TRUCK.seats[k] = c.id;
          LOG.log('truck', { id: c.id, n: c.n, seat: k });
          broadcast(truckMsg()); return;
        }
        if (op === 'respawn') { if (!c.host) return; LOG.log('truckRespawn', { id: c.id, n: c.n }); truckPark(); return; } // console / F2: back where you drive it from
        if (op === 'flip') { const o = truckOwner(); if (o != null && o !== c.id && clients.has(o) && Math.hypot(c.x - TRUCK.x, c.z - TRUCK.z) < 6) send(clients.get(o), { t: 'truck', flip: 1 }); return; } // heave it back upright (the owner's page does it)
        if (op === 'wreck') { // it came down in the trench (88-north.js): wrecked till dawn
          if (truckOwner() !== c.id || TRUCK.z > -505 || TRUCK.wreck) return;
          TRUCK.wreck = world.run.day; TRUCK.seats = {}; LOG.log('truckWreck', { x: r1(TRUCK.x), z: r1(TRUCK.z) }); broadcast(truckMsg()); return;
        }
        if (op === 'push') { const o = truckOwner(); if (o != null && o !== c.id && clients.has(o) && Math.hypot(c.x - TRUCK.x, c.z - TRUCK.z) < 5) send(clients.get(o), { t: 'truck', push: [num(m.dx, -1, 1, 0), num(m.dz, -1, 1, 0)] }); return; }
        if (op === 'pos') { // from whoever runs its physics (the driver, else the lowest id): where it is, how it's tipped, how fast
          if (truckOwner() !== c.id || Date.now() - (TRUCK.parkAt || 0) < 1000) return; // just parked: the old position still in flight doesn't count
          TRUCK.x = num(m.x, -600, 600, TRUCK.x); TRUCK.z = num(m.z, -600, 600, TRUCK.z); TRUCK.h = num(m.h, -100, 100, TRUCK.h);
          TRUCK.vx = num(m.vx, -60, 60, 0); TRUCK.vz = num(m.vz, -60, 60, 0);
          const qn = k => Math.round(num(m[k], -1, 1, k === 'qw' ? 1 : 0) * 10000) / 10000; // its full turn (a quaternion): it can be on its side or roof
          const q = [r1(TRUCK.x), r1(TRUCK.z), Math.round(TRUCK.h * 1000) / 1000, r1(num(m.v, -40, 40, 0)), Math.round(num(m.y, -50, 200, 0) * 100) / 100,
            qn('qx'), qn('qy'), qn('qz'), qn('qw'), r1(TRUCK.vx), r1(TRUCK.vz)];
          broadcast({ t: 'truck', pos: q }, c.id); return;
        }
        if (TRUCK.seats.drive !== c.id) return;
        return;
      }
      case 'breach': { // an 8 ft hole broke through into the buried town (89-town.js). Must be a real, deep hole near you.
        const x = r1(num(m.x, -595, 595, 0)), z = r1(num(m.z, -595, 595, 0)), k = x + '|' + z;
        if ((world.zone || 'lake') !== 'lake' || Math.hypot(x - c.x, z - c.z) > 6 || (world.holes[k] || 0) < SIM.TOWN_BREAK_DEPTH) return;
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
      case 'pipeAdd': {
        // A camper laying the sand pipeline (public/js/88-pipeline.js) put a joint down where they're standing, ~5 m on
        // from the last one. Node 0 is the sifter's connector socket.
        const p = pipeW(), x = num(m.x, -600, 600, NaN), z = num(m.z, -600, 600, NaN); if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        if (!p.nodes.length) p.nodes.push({ x: r2(SIM.GOLD.SIFTER.x - 1.9), z: r2(SIM.GOLD.SIFTER.z), p: -1 });
        const pi = Number.isInteger(m.p) && m.p >= 0 && m.p < p.nodes.length ? m.p : p.nodes.length - 1, e = p.nodes[pi], d = Math.hypot(x - e.x, z - e.z);
        if (d < 2 || d > 7 || Math.hypot(c.x - x, c.z - z) > 4 || p.nodes.length > tuneS('pipe.max', 60) + 1) { send(c, { t: 'pipe', ...p }); return; }   // put them right
        p.nodes.push({ x: r2(x), z: r2(z), p: pi }); dirty = true; broadcast({ t: 'pipe', by: c.id, ...p }); break;
      }
      case 'pipeBreak': {   // a boulder, sinkhole or mine cracked a run (worked out client-side, like those hazards)
        const p = pipeW(), i = num(m.i, 0, 1e4, -1) | 0; if (i < 1 || i >= p.nodes.length || p.broken[i] || (world.camp && world.camp.pipeSteel)) return; // i: the run's child node; reinforced pipe doesn't crack
        p.broken[i] = true; dirty = true; LOG.log('pipeBreak', { i, by: c.n }); broadcast({ t: 'pipe', ...p }); break;
      }
      case 'pipeFix': {   // held F at the crack for pipe.fixTime: they have to be standing by it
        const p = pipeW(), i = num(m.i, 0, 1e4, -1) | 0; if (!p.broken[i]) return;
        const b = p.nodes[i], a = b && p.nodes[b.p]; if (!a || !b || Math.min(Math.hypot(c.x - a.x, c.z - a.z), Math.hypot(c.x - b.x, c.z - b.z), Math.hypot(c.x - (a.x + b.x) / 2, c.z - (a.z + b.z) / 2)) > 5) return;
        delete p.broken[i]; dirty = true; LOG.log('pipeFix', { i, by: c.n }); broadcast({ t: 'pipe', ...p }); break;
      }
      case 'pipeFlow': broadcast({ t: 'pipeFlow', leaf: num(m.leaf, 1, 1e4, 1) | 0 }, c.id); break;
      case 'campBuy': { // a camp upgrade (public/js/84-camp.js), paid from the crew wallet by walletSpend just before this
        if (m.rid != null && c.walletNo && c.walletNo.has(num(m.rid, 0, 1e9, -1) | 0)) return;
        const id = String(m.id || ''); if (!['goldScale', 'pipeTee', 'pipePump', 'pipeSteel', 'sodaMachine'].includes(id)) return;
        const camp = world.camp || (world.camp = {});
        if (camp[id]) { world.run.bank += num(m.cost, 0, 2000, 0) | 0; broadcast(runInfo()); send(c, { t: 'camp', camp }); return; } // someone beat them to it: the wallet gets it back
        camp[id] = true; dirty = true; LOG.log('campBuy', { id, by: c.n }); broadcast({ t: 'camp', camp }); break;
      }   // someone sent sand down it: everyone sees the plug go
      case 'dyn': { // a lit stick of dynamite (public/js/88-dynamite.js): the server runs the fuse so everyone sees the same boom
        if (!withinRate(c.dynTimes || (c.dynTimes = []), 3, 5000)) return;
        const x = r2(num(m.x, -590, 590, NaN)), z = r2(num(m.z, -590, 590, NaN)); if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(c.x - x, c.z - z) > 10) return;
        if (SIM.inCamp(x, z) || Math.hypot(Math.max(-40 - x, 0, x - 30), Math.max(27 - z, 0, z - 56)) < CAMP_NODIG) return; // never in camp or its no-dig strip
        const id = DYN_SEQ++; LOG.log('dyn', { by: c.n, x, z }); broadcast({ t: 'dyn', id, x, z, by: c.n });
        setTimeout(() => dynBoomS(id, x, z), tuneS('dyn.fuse', 3) * 1000); break;
      }
      case 'pileTake': { // someone (or the crew) scooping the loose sand
        const q = (world.piles || {})[num(m.id, 0, 1e9, -1) | 0]; if (!q) return; const v = num(m.v, 0, 2, 0); if (!v) return;
        q.sand = Math.max(0, Math.round((q.sand - v) * 1000) / 1000); dirty = true;
        if (q.sand <= 0.01) delete world.piles[q.id];
        broadcast({ t: 'pile', p: { id: q.id, x: q.x, z: q.z, sand: q.sand } }); break;
      }
      case 'scare': { // a scarecrow planted on the lake bed (public/js/88-gear.js): vultures keep off everyone near it
        if (!withinRate(c.dynTimes || (c.dynTimes = []), 3, 5000)) return;
        const x = r2(num(m.x, -590, 590, NaN)), z = r2(num(m.z, -590, 590, NaN)); if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(c.x - x, c.z - z) > 4 || SIM.inCamp(x, z)) return;
        const l = world.scares || (world.scares = []); l.push({ id: Date.now() * 10 + (c.id % 10), x, z }); while (l.length > 12) l.shift();
        dirty = true; broadcast({ t: 'scares', list: l }); break;
      }
      case 'mineDisarm': { // the disarm kit (public/js/88-disarm.js): you beside it, or a crew member with his kit
        const i = MINES.findIndex(k => k.id === (num(m.id, 0, 1e9, -1) | 0)); if (i < 0) return;
        const k = MINES[i], crew = typeof m.crew === 'string' ? String(m.crew).slice(0, 24) : null;
        if (!crew && Math.hypot(c.x - k.x, c.z - k.z) > 3.5) return;
        MINES.splice(i, 1); LOG.log('mineDisarm', { by: crew || c.n, x: k.x, z: k.z }); broadcast({ t: 'mineGone', id: k.id, by: crew || c.n }); break;
      }
      case 'mineMark': { // a dog found one (public/js/88-dog.js): it shows to everyone from much further
        const k = MINES.find(k => k.id === (num(m.id, 0, 1e9, -1) | 0)); if (!k || k.marked || Math.hypot(c.x - k.x, c.z - k.z) > 15) return;
        k.marked = true; broadcast({ t: 'mineMark', id: k.id }); break;
      }
      case 'mineHit': {
        // Someone stepped on a landmine (public/js/88-mines.js): you, or a D Tent camper on the client that runs the crew
        // (m.crew: his name). Yours has to be under your feet; the crew's we take on trust (the crew lives client-side).
        const i = MINES.findIndex(k => k.id === (num(m.id, 0, 1e9, -1) | 0)); if (i < 0) return;
        const k = MINES[i], crew = typeof m.crew === 'string' ? String(m.crew).slice(0, 24) : null;
        if (!crew && Math.hypot(c.x - k.x, c.z - k.z) > 4) return;
        MINES.splice(i, 1); LOG.log('mineBoom', { by: crew || c.n, x: k.x, z: k.z });
        broadcast({ t: 'mineBoom', id: k.id, x: k.x, z: k.z, by: crew || c.n });
        break;
      }
      case 'crewWard': { // dressing a crew member (public/js/81-wardrobe.js)
        if (!CREW_NAMES.includes(m.n)) return; const all = world.crewWard || (world.crewWard = {});
        all[m.n] = wardS(m.w); dirty = true; broadcast({ t: 'crewWard', all }); break;
      }
      case 'sodaStock': { // sodas into the camp's machine (public/js/84-camp.js): bought just before (walletSpend, rid) or the camper's own
        if (m.rid && c.walletNo && c.walletNo.has(num(m.rid, 0, 1e9, -1) | 0)) return; const camp = world.camp || (world.camp = {}); if (!camp.sodaMachine) return;
        camp.sodaStock = Math.min(500, (camp.sodaStock | 0) + (num(m.n, 1, 50, 0) | 0)); dirty = true; broadcast({ t: 'camp', camp }); break;
      }
      case 'sodaTake': { // a crew member's soda break (public/js/88-morale.js), sent by the client that runs the crew
        const camp = world.camp || {}; if (!(camp.sodaStock > 0)) return; camp.sodaStock--; dirty = true; broadcast({ t: 'camp', camp }); break;
      }
      case 'giveSoda': { // a camper handed a crew member a soda (public/js/88-morale.js): every screen's copy of him drinks it
        if (!CREW_NAMES.includes(m.n) || !withinRate(c.sellTimes, SELL_RATE, SELL_WINDOW_MS)) return; broadcast({ t: 'crewSoda', n: m.n, by: c.n }); break;
      }
      case 'ward': { c.w = wardS(m.w); broadcast({ t: 'ward', id: c.id, w: c.w }, c.id); break; } // changed clothes (public/js/81-wardrobe.js)
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
        if (m.a === 'empty') { world.run.bank = 0; dirty = true; LOG.log('admin', { id: c.id, n: c.n, a: m.a }); broadcast(runInfo()); }
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
      case 'summit':
        // A camper got to (or left) the top of the wall at the lake's north edge (public/js/88-north.js): the end of Act 1.
        c.summit = m.on === true && (world.zone || 'lake') === 'lake';
        checkSummit();
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
      case 'ufo': { // the UFO easter egg (public/js/88-ufo.js), console only: take a crew member, or bring the abductees back
        if (!c.host) return;
        if (m.back) { ufoReturnAll(); break; }
        const n = CREW_NAMES.includes(m.n) && world.crew[m.n] && world.crew[m.n].hired && !world.crew[m.n].abducted ? m.n : null; if (!n) return;
        world.crew[n].abducted = true; world.crew[n].alien = false; world.crew[n].abductedDay = world.run.day; dirty = true; LOG.log('ufo', { n, by: c.n });
        broadcast({ t: 'ufo', n, phase: 'take' }); setTimeout(() => broadcast({ t: 'crew', up: world.crew }), 11000); break;
      }
      case 'adminSet': { // admin console commands (public/js/96-admin.js), host only: set up game states for testing
        if (!c.host) return;
        const items = Array.isArray(m.items) ? m.items.map(String).slice(0, 40) : [], names = Array.isArray(m.names) ? m.names.filter(n => CREW_NAMES.includes(n)) : [];
        if (m.op === 'crew') {
          for (const n of names) { const k = world.crew[n] || (world.crew[n] = {});
            if (m.what === 'hire') k.hired = true; else if (m.what === 'fire') world.crew[n] = {};
            else if (m.what === 'kit') { const keep = { hired: !!k.hired }; world.crew[n] = keep; const add = id => { const it = SIM.CREW_SHOP.find(i => i.id === id); if (!it) return; keep[id] = true; if (it.needs) add(it.needs); }; for (const it of items) add(it); } }
          broadcast({ t: 'crew', up: world.crew });
        } else if (m.op === 'camp') { const camp = world.camp || (world.camp = {}); for (const it of items) { if (it === 'none') { world.camp = {}; } else if (['goldScale', 'pipeTee', 'pipePump', 'pipeSteel', 'sodaMachine'].includes(it)) (world.camp || (world.camp = {}))[it] = true; } broadcast({ t: 'camp', camp: world.camp }); }
        else if (m.op === 'pipe') { const p = pipeW();   // lay pipe without walking it (the client checked nothing solid is in the way)
          if (m.clear) { p.nodes = []; p.broken = {}; }
          for (const a of (Array.isArray(m.add) ? m.add.slice(0, 200) : [])) {
            if (!p.nodes.length) p.nodes.push({ x: r2(SIM.GOLD.SIFTER.x - 1.9), z: r2(SIM.GOLD.SIFTER.z), p: -1 });
            const x = num(a.x, -600, 600, NaN), z = num(a.z, -600, 600, NaN), pi = Number.isInteger(a.p) && a.p >= 0 && a.p < p.nodes.length ? a.p : -1;
            if (!Number.isFinite(x) || !Number.isFinite(z) || pi < 0 || p.nodes.length > tuneS('pipe.max', 60) + 1) break;
            const d = Math.hypot(x - p.nodes[pi].x, z - p.nodes[pi].z); if (d < 2 || d > 7) break;
            p.nodes.push({ x: r2(x), z: r2(z), p: pi }); }
          broadcast({ t: 'pipe', ...p }); }
        else if (m.op === 'bank') { world.run.bank = num(m.v, 0, 1e9, 0) | 0; broadcast(runInfo()); }
        else if (m.op === 'day') { world.run.day = num(m.v, 1, 999, 1) | 0; broadcast(runInfo()); }
        dirty = true; LOG.log('admin', { by: c.n, op: m.op, what: m.what, names, items }); break;
      }
      case 'veinNow': { // the console's 'vein' (host only): a rich vein 25 m ahead of you, right now (public/js/88-vein.js)
        if (!c.host) return; const x = Math.round(num(m.x, -560, 560, c.x)), z = Math.round(num(m.z, -560, 560, c.z)); if (SIM.inCamp(x, z)) return;
        VEIN = { x, z, r: 12, until: Date.now() + tuneS('vein.time', 10) * 60000 }; LOG.log('vein', { x, z, by: c.n }); broadcast(veinMsg()); break;
      }
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
        const k = ['twerk', 'sing', 'tonic', 'medkit', 'dynamite', 'disarm', 'grapple'].includes(m.k) ? m.k : null; if (!k) return;
        const now = Date.now(); if (now - (c.emoteAt || 0) < 800) return; c.emoteAt = now;
        if (k === 'tonic' || k === 'medkit' || k === 'dynamite' || k === 'disarm' || k === 'grapple') { broadcast({ t: 'emote', id: c.id, k }, c.id); break } // tools in hand (public/js/88-*.js)
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
    truckLeave(c.id);
    if (c.joined && !c.spectator) { LOG.log('leave', { id: c.id, n: c.n }); broadcast({ t: 'leave', id: c.id }); broadcastSleep(); maybeSkipNight(); if ((world.zone || 'lake') !== 'lake') checkCampfire(); else checkSummit(); }
  });
});

/* ---- shared rules, 10 times a second: heavy loot, night monsters, the new day at curfew, and the event director ---- */
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
  const b = clients.get(-id); if (!b || !b.joined) return null; // a downed camper, or one on their feet (grab anyone, R.E.P.O.-style; they can wriggle free: 'pfree')
  b.body = b.body || { grab: [], ropes: [] }; return { o: b.body, c: b, x: b.x, z: b.z };
}
function unloadFromCart(id) {
  const p = world.props[id]; if (!p || p.cartId == null) return;
  const cart = world.props[p.cartId]; p.cartId = null;
  if (cart) { cart.load = (cart.load || []).filter(l => l !== id); broadcast({ t: 'pcart', id: +Object.keys(world.props).find(k => world.props[k] === cart), load: cart.load }); }
}
// the crew's wheelbarrow: always one, parked by the Supply Depot (id CART_ID, never sold)
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
  JAV.noNatural = dirState.enabled || !hazOnS('javelinas'); if (!hazOnS('javelinas')) JAV.list.length = 0; // the event director owns natural herds while it's on (sim.js stepJavelinas)
  const jev = []; SIM.stepJavelinas(JAV, players, t, dt, jev); truckRams(Date.now(), jev); // Mr. Sir's pickup running into things
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
  const cab = [TRUCK.seats.drive, TRUCK.seats.shotgun];   // inside Mr. Sir's pickup's cab (87-truck.js): out of reach too
  return joined().filter(c => !c.town && !cab.includes(c.id)).map(c => ({   // campers down in the buried town (89-town.js) are out of reach of the lake
    id: c.id, x: c.x, z: c.z, fa: c.r, cy: c.cy, hp: c.hp,
    hd: !!(c.f & 1), cr: !!(c.f & 8), lt: !!(c.f & 4), an: c.a,
    dn: !!(c.f & 2) || now - c.dnAt < 2000,
    nz: now - (c.chatAt || 0) < 3000 ? 1 : c.nz,
    kt: !!c.kt, on: !!c.on, vy: c.vy || 0, // for the roster (sim.js stepRoster): Kate's loot, an onion on, where the camera looks
  }));
}
function endOfDay() {
  // The Warden's quota (JT 2026-10-01): at curfew she takes it out of the crew bank. Short, and the whole crew's fired:
  // the run starts over from nothing (the lake, the bank, the crew's kit; everyone's levels stay). A crew that's only
  // just got here gets a grace day.
  const quota = quotaNow(), played = world.run.played || 0;
  world.run.played = 0;
  if (!joined().length) return;
  if (world.run.bank >= quota) {
    LOG.log('quota', { met: true, bank: world.run.bank, quota, day: world.run.day });
    world.run.bank -= quota; world.run.day++; world.run.peak = joined().length; dirty = true;
    if (TRUCK.wreck) truckPark(); // the pickup that came down in the trench is hauled back overnight
    world.run.mood = SIM.rollMood(world.run.day, world.run.curse);
    broadcast({ ...runInfo(), t: 'newday', paid: quota, found: world.run.found || {}, eotd: eotdStandings() }); eotdReset(); setTimeout(() => ufoReturnAll(world.run.day), 8000);
  } else if (played < 180) { LOG.log('grace', { bank: world.run.bank, quota }); world.run.day++; dirty = true; broadcast({ ...runInfo(), t: 'newday', grace: true, found: world.run.found || {}, eotd: eotdStandings() }); eotdReset(); setTimeout(() => ufoReturnAll(world.run.day), 8000); }
  else {
    const got = world.run.bank;
    const foundWas = world.run.found || {};
    LOG.log('fired', { bank: got, quota, day: world.run.day });
    const wasZone = world.zone || 'lake';
    world = Object.assign(freshWorld(1), { hostNames: world.hostNames, clock: world.clock, players: world.players, run: freshRun(), crew: {}, director: world.director }); ensureCart();
    gotSet = new Set(); kbHolder = null; dirty = true; save();
    broadcast({ t: 'fired', bank: got, quota, found: foundWas });
    broadcast({ t: 'crew', up: world.crew }); broadcast(runInfo());
    if (wasZone !== 'lake') broadcast(zoneMsg()); // a fresh run starts back at camp
  }
}
setInterval(() => {
  const now = Date.now(), dt = Math.min(0.25, (now - lastTick) / 1000); lastTick = now;
  mineTick(now); veinTick(now);
  if (eotdDirty && now - eotdSentAt > 3000) { eotdDirty = false; eotdSentAt = now; broadcast({ t: 'eotd', st: eotdStandings() }); }
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
  if ((world.zone || 'lake') === 'lake' && hazOnS('night')) SIM.stepMonsters(MON, players, t, dt, ev, { mood: world.run.mood }); else { MON.trucks = []; MON.zer = null; } // police and Zeroni are the lake's (88-zones.js)
  if (lionEvQ.length) { ev.push(...lionEvQ); lionEvQ.length = 0; } // shovel swats reported since the last tick (see the 'swat' case)
  LION.noNatural = dirState.enabled || !hazOnS('lion'); if (!hazOnS('lion')) LION.active = false; // ditto for the lion's own pre-curfew window
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
    if (!hazOnS(d.kind)) continue; // switched off in F2 Hazards (public/js/88-hazards.js)
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
