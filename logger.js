// Play-test event logging for Camp Green Lake. Written FOR AN LLM TO READ: one JSON object per line
// (JSON Lines) under data/logs/<YYYY-MM-DD>.jsonl, so "a lizard bit me around 3pm" can be answered with
// `node scripts/logq.js --type lizBite --since 15:00`. See scripts/logq.js and the README's Play-test logging
// section for how to query these files.
//
// Every line has: ts (wall-clock ISO time it was written), gt (in-game clock "hh:mm" at that moment, matching
// what players see in the HUD), t (event type), then event-specific fields below. Player events carry id (a
// camper's connection id — changes on reconnect, so query by name) and n (display name). Positions are x/z
// (occasionally y), rounded to 1 decimal, meaning "this happened here" — used by `logq.js --near`.
//
// Event types and fields:
//   join            {id,n}                             camper connected
//   joinRejected    {id?,ip,n?,reason,badJoins?}         a socket was refused: wrong camp password, too many
//                                                        connections from that address, or a connection-rate limit
//   leave           {id,n}                              camper disconnected
//   pos             {id,n,x,y,z,a,hp,wt,f,down,camp}    position snapshot, ~2s per camper (a = anim state 0-4,
//                                                        f = raw client flag bits, down/camp = booleans)
//   chat            {id,n,s}                            proximity chat
//   shout           {id,n,i}                             shout (0-4; see SHOUTS in index.html)
//   sell            {id,n,v}                             sold sack contents to Mr. Sir (counts toward quota)
//   propSpawn       {id,n,item,type,x,z}                 dug up something too heavy for the sack (safe/strongbox)
//   propGrab        {id,n,item,type,x,z}                 started hauling heavy loot
//   propSold        {item,type,v,who}                    heavy loot reached Mr. Sir's truck (who = carrier names)
//   bagDrop         {id,n,x,z,items}                     a downed camper's sack fell
//   bagGrab         {id,n,bagId}                         someone grabbed a dropped sack
//   revive          {id,n,by,x,z}                        by picked up downed camper n
//   pull            {id,n,by,x,z}                        by pulled camper n out of a deep hole
//   kb              {id,n}                               gave the gold KB tube to the Warden
//   win             {id,n}                               dug up the suitcase
//   clock           {id,n,off,paused,pt,prevOff,prevPaused,prevPt}   host changed the camp clock
//   env             {id,n,k,x,z,a}                       hazard spawned from the console (e.g. a twister)
//   admin           {id,n,a}                             admin panel button (fill/empty the team bank)
//   party           {id,n,dur}                           disco started
//   quota           {met,bank,quota,day}                 curfew quota check
//   grace           {}                                   crew got here too late in the day to be checked
//   fired           {bank,quota}                          crew missed quota; the run resets
//   sleep           {id,n,on}                             a camper lay down in (on:true) or got out of (on:false)
//                                                          a bunk
//   daybreak        {asleep}                              every joined camper was asleep in a bunk; the night was
//                                                          skipped straight to dawn (asleep = how many campers)
//   mobsOn/mobsOff  {kind}                               police trucks / Madame Zeroni appear or leave for the night
//   spot / lost     {id,n,x,z}                            a police truck spotted / lost a camper
//   down            {id,n,x,z,by}                         knocked down by police or Zeroni ("by")
//   blink/drop/gone {id,n,x,z,front?}                     Zeroni teleports near / lets go of / drags off a camper
//   zspawn          {x,z}                                 Madame Zeroni appears for the night
//   mon             {trucks,zer}                          periodic (~2s) position/mode snapshot while mobs are out
//   hurt            {id,n,amt,hp,title,text,x,z}          damage (client-reported: only the client tracks HP)
//   ko              {id,n,title,text,x,z}                  knocked out
//   lizChase        {id,n,liz,x,z,dist}                    lizard #liz started chasing camper n from dist metres
//   lizBite         {id,n,liz,x,z}                          lizard #liz bit camper n
//   twWarn          {id,n,x,z,twx,twz,dist,dir}            twister warning shown to a camper
//   twSuckUp        {id,n,x,z,twx,twz,s}                    a twister's core caught a camper and started pulling
//                                                           them up (before the throw)
//   twThrow         {id,n,x,z,twx,twz,dmg}                  a twister threw a camper
//   found           {id,n,item,type,value,x,z,heavy,kb}     dug up an item
//   tentEnter       {id,n,tent,name,x,z}                    ducked inside a tent (tent = index into TENTS)
//   tentExit        {id,n,tent,name,x,z}                    stepped back outside a tent
//   pause           {id,n,action}                           used the pause menu (action: 'restart' or 'quit')
//   cmd             {id,n,line,reply,error}                developer console command: who ran what, and the result
//   err             {id,n,msg,src,line,col,stack}           client JS error (window.onerror / unhandledrejection)
//   perf            {id,n,fps,pr,gpu,sw}                    client fps / render pixel ratio / GPU name, ~10s
//   report          {id,n,liz,bots,rp,tw}                   compact snapshot of what one client sees nearby:
//                                                           liz=[[x,z,mode]] (only chasing/fleeing lizards, not
//                                                           all 48 wandering ones), bots=[[name,state,x,z]],
//                                                           rp=[[name,x,z]] (remote players), tw=[[x,z,strength]]
//
// Buffered + async: events are queued and flushed at most once a second, and again (best-effort, synchronously)
// on SIGTERM/SIGINT — see flushSync(). Rotates to a new file past ~50MB (same day: .2.jsonl, .3.jsonl, ...) and
// deletes files older than 14 days on startup. Set PLAYLOG=0 to turn logging off entirely. Every function here is
// wrapped so a logging bug can never crash the game or the server.
'use strict';
const fs = require('fs');
const path = require('path');
const SIM = require('./public/sim.js');

const DIR = path.join(__dirname, 'data', 'logs');
const ENABLED = process.env.PLAYLOG !== '0';
const MAX_BYTES = 50 * 1024 * 1024;          // roll to a new file past this size
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // delete files older than this on startup
const FLUSH_MS = 1000;

let getClock = () => null; // set by init(); lets us compute the in-game time of day without a circular require
let queue = [];
let day = '', part = 1, filePath = '', bytesInFile = 0, flushing = false;

// same math as hourOf()/clockText() in index.html, so gt matches what players see in the HUD to the minute
function hourOf(t) { return t < SIM.DAYMS ? 6 + t / SIM.DAYMS * 14 : (20 + (t - SIM.DAYMS) / (SIM.CYCLE - SIM.DAYMS) * 10) % 24; }
function gameClock(now) {
  try {
    const c = getClock(); if (!c) return '--:--';
    const t = SIM.clockT(c, now), h = hourOf(t), hh = Math.floor(h) % 24, mi = Math.floor((h % 1) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  } catch (e) { return '--:--'; }
}
function todayStr(d) { return d.toISOString().slice(0, 10); }

function cleanupOld() {
  try {
    if (!fs.existsSync(DIR)) return;
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const f of fs.readdirSync(DIR)) {
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(f); if (!m) continue;
      const t = Date.parse(m[1]);
      if (Number.isFinite(t) && t < cutoff) { try { fs.unlinkSync(path.join(DIR, f)); } catch (e) { /* best effort */ } }
    }
  } catch (e) { /* best effort */ }
}

function pickFile() { day = todayStr(new Date()); part = 1; bytesInFile = 0; filePath = path.join(DIR, `${day}.jsonl`); }
pickFile();
// pick up the true size of today's file if the server restarted mid-day (so rotation still triggers near 50MB)
try { const st = fs.statSync(filePath); bytesInFile = st.size; } catch (e) { /* new file */ }

function rollIfNeeded(nextBytes) {
  const d = todayStr(new Date());
  if (d !== day) { day = d; part = 1; bytesInFile = 0; filePath = path.join(DIR, `${day}.jsonl`); return; }
  if (bytesInFile + nextBytes > MAX_BYTES) { part++; bytesInFile = 0; filePath = path.join(DIR, `${day}.${part}.jsonl`); }
}

function flush() {
  if (flushing || !queue.length) return;
  const lines = queue; queue = [];
  const text = lines.join('');
  flushing = true;
  try {
    fs.mkdir(DIR, { recursive: true }, () => {
      try {
        rollIfNeeded(Buffer.byteLength(text));
        fs.appendFile(filePath, text, err => { flushing = false; if (!err) bytesInFile += Buffer.byteLength(text); });
      } catch (e) { flushing = false; }
    });
  } catch (e) { flushing = false; }
}
const flushTimer = setInterval(flush, FLUSH_MS);
if (flushTimer.unref) flushTimer.unref();

// best-effort synchronous flush for the ~300ms window the server gives itself on SIGTERM/SIGINT
function flushSync() {
  if (!ENABLED || !queue.length) return;
  const lines = queue; queue = [];
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const text = lines.join('');
    rollIfNeeded(Buffer.byteLength(text));
    fs.appendFileSync(filePath, text);
    bytesInFile += Buffer.byteLength(text);
  } catch (e) { /* best effort on the way out */ }
}

function log(t, fields) {
  if (!ENABLED) return;
  try {
    const now = Date.now();
    const line = Object.assign({ ts: new Date(now).toISOString(), gt: gameClock(now), t }, fields || {});
    queue.push(JSON.stringify(line) + '\n');
    if (queue.length > 500) flush(); // safety valve: don't let a burst grow the buffer unbounded
  } catch (e) { /* logging must never crash the game or the server */ }
}

function init(opts) {
  if (opts && typeof opts.getClock === 'function') getClock = opts.getClock;
  if (ENABLED) cleanupOld();
}

module.exports = { init, log, flush, flushSync, enabled: ENABLED };
