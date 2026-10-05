import {ensureRelics} from './shared/relics.mjs';
import {ensureGuards} from './shared/guards.mjs';
import {armTargets} from './shared/excavator.mjs';
import {ensureForest} from './shared/forestry.mjs';
import {ensureSupports} from './shared/supports.mjs';
import {ensureMine,releaseMine,inMine,mineBodyClear} from './shared/mine.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createRoom, createPlayer, act, tick, snapshot, cancelPan } from './shared/simulation.mjs';
import { ensureHauling, releaseCart } from './shared/hauling.mjs';
import { ensureSoil } from './shared/soil.mjs';
import { exportWorld, exportTerrainOBJ } from './shared/export.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/rules.json'), 'utf8'));
const PORT = Number(process.env.PORT || 4317);
const SAVE_DIR = process.env.GOLD_FEVER_SAVE_DIR || path.join(ROOT, 'data/worlds');
fs.mkdirSync(SAVE_DIR, { recursive: true });
const CONTROL_DIR = process.env.GOLD_FEVER_CONTROL_DIR || path.join(ROOT, 'data');
fs.mkdirSync(CONTROL_DIR, { recursive: true });
const hostKey = crypto.randomBytes(32).toString('hex');
fs.writeFileSync(path.join(CONTROL_DIR, 'host.key'), hostKey);
const rooms = new Map(), sessions = new Map();
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
const cleanRoom = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 1024 * 1024) ws.send(JSON.stringify(data)); };
function loadRoom(code, mode, crewSize = 2) {
  if (rooms.has(code)) return rooms.get(code);
  let room;
  try { room = JSON.parse(fs.readFileSync(path.join(SAVE_DIR, `${code}.json`), 'utf8')); } catch { room = createRoom(code, RULES, mode, crewSize); }
  if (room.version !== 1 || !room.players || !room.cells) throw Error('Unsupported save format');
  room.crewSize ??= 6; room.ownerId ??= Object.values(room.players)[0]?.id || null; ensureHauling(room); ensureSoil(room); ensureMine(room);ensureForest(room);ensureSupports(room);ensureGuards(room);ensureRelics(room);for(const g of room.guards){g.state='patrol';g.target=null;g.until=0;g.stateAt=0;}
  for (const p of Object.values(room.players)) { releaseCart(room,p,true);releaseMine(room,p); p.active = false; p.fly = false; p.speedScale = p.jumpScale = 1; p.cheatSafe = false; p.vehicle = null; p.input = {}; p.lastInput = 0; p.digUntil = 0; p.shovelPlant = null;p.excavatorPlant=null;p.guardKnock=null;p.guardSafeUntil=0; p.emoteUntil = 0; cancelPan(p); }
  for(const p of Object.values(room.players))if(inMine(p.x,p.z)&&!mineBodyClear(room.mine,p.x,p.y,p.z)){p.x=-68;p.z=34;p.y=6;p.vy=0;}
  for (const v of room.vehicles) v.driver = null;
  room.dirty = false; rooms.set(code, room); return room;
}
function saveRoom(room) {
  if (!room.dirty) return;
  const serialized = JSON.parse(JSON.stringify(room)); delete serialized.dirty;
  for (const p of Object.values(serialized.players)) { p.active = false; p.input = {}; p.lastInput = 0; p.vehicle = null; p.shovelPlant = null;p.excavatorPlant=null; cancelPan(p); }
  for (const v of serialized.vehicles) v.driver = null;
  for (const c of serialized.carts || []) { c.operator = null; c.steadier = null; c.brake = true; c.vx = c.vz = 0; }
  for (const p of Object.values(serialized.players)) p.cart = null;
  for (const p of Object.values(serialized.players)) releaseMine(serialized,p);
  const file = path.join(SAVE_DIR, `${room.code}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(serialized)); fs.renameSync(`${file}.tmp`, file); room.dirty = false;
}
function broadcast(room, message) { for (const [ws, s] of sessions) if (s.room === room) send(ws, message); }
function announce(room, text) { broadcast(room, { type: 'notice', message: text }); }
function lanUrls() {
  return Object.values(os.networkInterfaces()).flat().filter(i => i?.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${PORT}`);
}
function shareUrl() {
  try { const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/share-url.json'), 'utf8')); process.kill(s.pid, 0); return s.url; } catch { return null; }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/api/host/stop') {
    if (req.headers.authorization !== `Bearer ${hostKey}`) { res.writeHead(403); res.end(); return; }
    for (const room of rooms.values()) { room.dirty = true; saveRoom(room); }
    res.writeHead(200, { 'Content-Type': MIME['.json'] }); res.end('{"saved":true}');
    setTimeout(shutdown, 100); return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  if (url.pathname === '/api/health') { res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ game: 'Gold Fever', version: '0.17.0', online: sessions.size })); return; }
  if (url.pathname === '/api/connection') { res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ shareUrl: shareUrl(), lanUrls: lanUrls() })); return; }
  if (url.pathname === '/api/export' || url.pathname === '/api/terrain') {
    const room = rooms.get(cleanRoom(url.searchParams.get('room'))), token = url.searchParams.get('token') || '';
    if (!room?.players[tokenHash(token)]) { res.writeHead(403); res.end('Join the room before exporting.'); return; }
    const obj = url.pathname === '/api/terrain';
    res.writeHead(200, { 'Content-Type': obj ? 'text/plain; charset=utf-8' : MIME['.json'], 'Content-Disposition': `attachment; filename="Gold-Fever-${room.code}.${obj?'obj':'json'}"`, 'Cache-Control': 'no-store' }); res.end(obj ? exportTerrainOBJ(room) : JSON.stringify(exportWorld(room), null, 2)); return;
  }
  let base = path.join(ROOT, 'public'), relative;
  try { relative = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end(); return; }
  if (relative.startsWith('/shared/')) { base = path.join(ROOT, 'shared'); relative = relative.slice(7); }
  if (relative.startsWith('/vendor/')) {
    relative = relative.slice(7);
    if (['/three.module.js', '/three.core.js'].includes(relative)) base = path.join(ROOT, 'node_modules/three/build');
    else if (['/loaders/GLTFLoader.js','/loaders/HDRLoader.js','/utils/BufferGeometryUtils.js','/utils/SkeletonUtils.js'].includes(relative)) base = path.join(ROOT,'public/vendor');
    else { res.writeHead(404); res.end(); return; }
  }
  if (relative === '/') relative = '/index.html';
  const resolved = path.resolve(base, `.${relative}`);
  if (!resolved.startsWith(base + path.sep) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(resolved).pipe(res);
});
const wss = new WebSocketServer({ server, path: '/crew', maxPayload: 16384 });
wss.on('connection', ws => {
  let budget = 100, lastRefill = Date.now();
  const joinTimer = setTimeout(() => { if (!sessions.has(ws)) ws.close(1008, 'Join a crew first'); }, 10000);
  ws.on('message', raw => {
    const now = Date.now(); budget = Math.min(100, budget + (now - lastRefill) * .045); lastRefill = now;
    if (--budget < 0) { ws.close(1008, 'Too many messages'); return; }
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'join' && !sessions.has(ws)) {
      const code = cleanRoom(msg.room);
      if (code.length < 6 || typeof msg.token !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(msg.token)) { send(ws, { type: 'error', message: 'Enter a room code of at least six letters or numbers.' }); return; }
      const crewSize = Number.isInteger(msg.crewSize) ? Math.max(1, Math.min(8, msg.crewSize)) : 2;
      let room; try { room = loadRoom(code, msg.mode === 'sandbox' ? 'sandbox' : 'rush', crewSize); } catch { send(ws, { type: 'error', message: 'This save needs a newer game version.' }); return; }
      const token = tokenHash(msg.token), existing = room.players[token];
      const occupants = Object.values(room.players).filter(p => p.active && p !== existing).length;
      if (occupants >= Math.min(8, room.crewSize)) { send(ws, { type: 'error', message: `This crew is full (${room.crewSize}). The world creator can increase capacity in the guide.` }); return; }
      for (const [old, s] of sessions) if (s.room === room && s.token === token) old.close(1000, 'Opened on another tab');
      const name = String(msg.name || 'Prospector').replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 22) || 'Prospector';
      const player = existing || createPlayer(token, name, room); player.name = name; player.active = true; player.input = {}; player.lastInput = now;
      sessions.set(ws, { room, player, token }); room.dirty = true; clearTimeout(joinTimer);
      send(ws, { type: 'welcome', room: code, seed: room.seed, mode: room.mode, rules: RULES, cells:room.cells,mineTerrain:room.mine.removed,mineBrushes:room.mine.brushes,state: snapshot(room, player, RULES, now) });
      announce(room, `${name} arrived at Fool’s Crossing.`); return;
    }
    const s = sessions.get(ws); if (!s) return;
    const { room, player } = s;
    if (msg.type === 'input') {
      player.input = { forward: Math.max(-1, Math.min(1, Number(msg.forward) || 0)), right: Math.max(-1, Math.min(1, Number(msg.right) || 0)), yaw: Number.isFinite(msg.yaw) ? msg.yaw % (Math.PI * 2) : player.yaw, sprint: !!msg.sprint, jump: !!msg.jump, wash: !!msg.wash, operate: typeof msg.operate === 'string' ? msg.operate : null };
      if(msg.arm&&typeof msg.arm==='object')player.input.arm=armTargets(msg.arm);
      player.input.tool=['axe','pan','shovel','pick','rod'].includes(msg.tool)?msg.tool:'shovel';player.input.hoistUp=!!msg.hoistUp;player.input.hoistDown=!!msg.hoistDown;
      player.input.catching = !!msg.catching;
      player.input.bucketX = Number.isFinite(msg.bucketX) ? Math.max(-.75,Math.min(.75,msg.bucketX)) : 0;
      player.input.bucketY = Number.isFinite(msg.bucketY) ? Math.max(-.65,Math.min(.65,msg.bucketY)) : 0;
      player.input.help = !!msg.help; player.input.pitch = Math.max(-1.38,Math.min(1.38,Number(msg.pitch)||0)); player.input.vertical = Math.max(-1,Math.min(1,Number(msg.vertical)||0)); player.lastInput = now; return;
    }
    if (msg.type === 'action') {
      const result = act(room, player, msg.action || {}, RULES, now);
      if(result.mineRubble)broadcast(room,{type:'mineRubble',rubble:result.mineRubble});
      if(result.mineBrushes)broadcast(room,{type:'mineBrushes',brushes:result.mineBrushes});
      if(result.minePatches)broadcast(room,{type:'mineTerrain',patches:result.minePatches});
      if(result.mineRebuild)broadcast(room,{type:'mineRebuild'});
      if (result.patches) broadcast(room, { type: 'terrain', patches: result.patches });
      if (result.effect) broadcast(room, { type: 'effect', effect: result.effect, now });
      if (result.broadcast) announce(room, result.message);
      if (result.crewNotice) announce(room, result.crewNotice);
      if (!result.quiet && (result.message || result.console || result.shovel || result.excavator)) send(ws, { type: 'result', ...result });
      if (result.resync) send(ws, snapshot(room, player, RULES, now));
      return;
    }
    if (msg.type === 'chat') {
      const text = String(msg.text || '').replace(/[\x00-\x1f]/g, '').trim().slice(0, 160);
      if (text && now - (player.lastChat || 0) > 900) { player.lastChat = now; broadcast(room, { type: 'chat', name: player.name, text }); }
    }
  });
  ws.on('close', () => {
    clearTimeout(joinTimer); const s = sessions.get(ws); if (!s) return; sessions.delete(ws);
    // A replaced socket must not mark its replacement offline.
    if ([...sessions.values()].some(n => n.room === s.room && n.player === s.player)) return;
    releaseMine(s.room,s.player);cancelPan(s.player); s.player.shovelPlant = null;s.player.excavatorPlant=null; s.player.active = false; s.player.input = {};
    releaseCart(s.room, s.player, true);
    if (s.player.vehicle) { const v = s.room.vehicles.find(v => v.id === s.player.vehicle); if (v) v.driver = null; s.player.vehicle = null; }
    s.room.dirty = true; announce(s.room, `${s.player.name} left the crew.`); saveRoom(s.room);
  });
  ws.on('error', () => {});
});
let frame = 0;
const timer = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const events = tick(room, RULES, .05, now);
    for (const event of events) {
      if(event.mineRubble)broadcast(room,{type:'mineRubble',rubble:event.mineRubble});
      if (event.broadcast) announce(room, event.broadcast);
      if (event.effect) broadcast(room, { type: 'effect', effect: event.effect, now });
      if (event.player) for (const [ws, s] of sessions) if (s.player.id === event.player && s.room === room) send(ws, { type: 'result', ...event.result });
    }
  }
  if (++frame % 2 === 0) for (const [ws, s] of sessions) send(ws, snapshot(s.room, s.player, RULES, now));
}, 50);
const saving = setInterval(() => { for (const room of rooms.values()) { if (Object.values(room.players).some(p => p.active)) room.dirty = true; try { saveRoom(room); } catch (e) { console.error('Save failed:', e.message); } } }, 5000);
function shutdown() { clearInterval(timer); clearInterval(saving); for (const room of rooms.values()) { room.dirty = true; saveRoom(room); } wss.close(); server.close(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gold Fever is running: http://localhost:${PORT}`);
  for (const url of lanUrls()) console.log(`Same-network friend: ${url}`);
  console.log('Worlds save automatically. Run Share with Friend.cmd for an Internet link.');
});

