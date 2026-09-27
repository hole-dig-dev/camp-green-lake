#!/usr/bin/env node
// logq.js — query Camp Green Lake's play-test logs (data/logs/*.jsonl). Built for an LLM (or a human) with shell
// access to answer things like "did a lizard bite anyone around 3pm?" without reading raw JSON by hand.
// See logger.js's header comment for the full event list, and the README's "Play-test logging" section for more
// examples. Run with no arguments (or --help) to print this usage text.
'use strict';
const path = require('path'), fsm = require('fs');
const DIR = path.join(__dirname, '..', 'data', 'logs');

function help() {
  console.log(`logq.js — query Camp Green Lake's play-test logs (data/logs/*.jsonl)

  --player <name[,name2]>   only events for these camper names (case-insensitive, exact match on "n")
  --type <t1,t2,...>        only these event types, e.g. hurt,ko,lizBite (see logger.js's header for the list)
  --since <when>            "hh:mm" (in-game clock) OR a wall-clock time ("2026-09-27T15:00", "15:00") OR
                            a relative time ("10 min ago", "2 hours ago")
  --until <when>            same forms as --since, as an upper bound
  --near <x,z>              only events with a position within --radius metres of x,z
  --radius <r>              metres for --near (default 15)
  --tail <n>                only the last n matching lines
  --json                    print the raw JSON line instead of a human-readable one-liner
  --summary                 per-player counts (times hurt, damage taken, knockouts, finds, errors) + error list
  --file <path>             read one specific log file instead of every data/logs/*.jsonl

Examples:
  node scripts/logq.js --player JT --type hurt,ko --since 15:00
  node scripts/logq.js --near 120,-40 --radius 20 --since "10 min ago"
  node scripts/logq.js --type err --tail 20
  node scripts/logq.js --summary`);
}

function parseArgs(argv) {
  const o = { player: null, type: null, since: null, until: null, near: null, radius: 15, tail: null, json: false, summary: false, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--player') o.player = next().toLowerCase().split(',').map(s => s.trim());
    else if (a === '--type') o.type = next().split(',').map(s => s.trim());
    else if (a === '--since') o.since = next();
    else if (a === '--until') o.until = next();
    else if (a === '--near') { const [x, z] = next().split(',').map(Number); o.near = { x, z }; }
    else if (a === '--radius') o.radius = Number(next());
    else if (a === '--tail') o.tail = Number(next());
    else if (a === '--json') o.json = true;
    else if (a === '--summary') o.summary = true;
    else if (a === '--file') o.file = next();
    else if (a === '--help' || a === '-h') { help(); process.exit(0); }
    else { console.error(`Unknown option "${a}". Try --help.`); process.exit(1); }
  }
  return o;
}

function listFiles(one) {
  if (one) return [one];
  if (!fsm.existsSync(DIR)) return [];
  return fsm.readdirSync(DIR).filter(f => f.endsWith('.jsonl')).sort().map(f => path.join(DIR, f));
}

function readRows(files) {
  const out = [];
  for (const f of files) {
    let text; try { text = fsm.readFileSync(f, 'utf8'); } catch (e) { continue; }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch (e) { /* skip a corrupt/partial line */ }
    }
  }
  return out;
}

// "hh:mm" -> compare against the in-game clock string (gt); anything else -> a wall-clock cutoff (ts)
function resolveTime(s) {
  s = s.trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) { const [h, m] = s.split(':'); return { gt: h.padStart(2, '0') + ':' + m.padStart(2, '0') }; }
  const rel = /^(\d+(?:\.\d+)?)\s*(s|sec|second|m|min|minute|h|hr|hour)s?\s*ago$/i.exec(s);
  if (rel) { const n = Number(rel[1]), unit = rel[2][0].toLowerCase(); const ms = unit === 's' ? n * 1000 : unit === 'm' ? n * 60000 : n * 3600000; return { ts: Date.now() - ms }; }
  const t = Date.parse(s); if (Number.isFinite(t)) return { ts: t };
  throw new Error(`Can't understand time "${s}". Use hh:mm (game clock), an ISO time, or "N min/hours ago".`);
}

function inRange(row, lo, hi) {
  if (lo) { if (lo.gt !== undefined && row.gt < lo.gt) return false; if (lo.ts !== undefined && Date.parse(row.ts) < lo.ts) return false; }
  if (hi) { if (hi.gt !== undefined && row.gt > hi.gt) return false; if (hi.ts !== undefined && Date.parse(row.ts) > hi.ts) return false; }
  return true;
}

function posOf(row) {
  if (typeof row.x === 'number' && typeof row.z === 'number') return [row.x, row.z];
  if (typeof row.twx === 'number' && typeof row.twz === 'number') return [row.twx, row.twz];
  return null;
}

function wallTime(ts) { const m = /T(\d\d:\d\d:\d\d)/.exec(ts || ''); return m ? m[1] : (ts || '?'); }

function oneLine(r) {
  const head = `${wallTime(r.ts)} [${r.gt}] ${r.t}`.padEnd(28);
  switch (r.t) {
    case 'join': return `${head}${r.n} joined camp`;
    case 'leave': return `${head}${r.n} left camp`;
    case 'pos': return `${head}${r.n} @ (${r.x},${r.z}) hp${r.hp} wt${r.wt}${r.down ? ' DOWN' : ''}${r.camp ? ' in-camp' : ''}`;
    case 'chat': return `${head}${r.n}: ${r.s}`;
    case 'shout': return `${head}${r.n} shouted #${r.i}`;
    case 'sell': return `${head}${r.n} sold ${r.v} seeds to Mr. Sir`;
    case 'hurt': return `${head}${r.n} hurt -${r.amt} (hp ${r.hp}) ${r.title || ''}: ${r.text || ''} @ (${r.x},${r.z})`;
    case 'ko': return `${head}${r.n} knocked out — ${r.title}: ${r.text} @ (${r.x},${r.z})`;
    case 'revive': return `${head}${r.by} revived ${r.n} @ (${r.x},${r.z})`;
    case 'pull': return `${head}${r.by} pulled ${r.n} out of a hole @ (${r.x},${r.z})`;
    case 'lizChase': return `${head}lizard #${r.liz} started chasing ${r.n} from ${r.dist} m @ (${r.x},${r.z})`;
    case 'lizBite': return `${head}lizard #${r.liz} bit ${r.n} @ (${r.x},${r.z})`;
    case 'twWarn': return `${head}${r.n} warned of a twister ${r.dist} m to the ${r.dir} @ (${r.x},${r.z})`;
    case 'twThrow': return `${head}a twister threw ${r.n} for ${r.dmg} dmg @ (${r.x},${r.z})`;
    case 'found': return `${head}${r.n} found ${r.type} (${r.value} seeds)${r.heavy ? ' [heavy]' : ''}${r.kb ? ' [KB tube]' : ''} @ (${r.x},${r.z})`;
    case 'propGrab': return `${head}${r.n} started hauling a ${r.type} @ (${r.x},${r.z})`;
    case 'propSpawn': return `${head}${r.n} dug up a heavy ${r.type} @ (${r.x},${r.z})`;
    case 'propSold': return `${head}sold a ${r.type} for ${r.v} seeds (carried by ${(r.who || []).join(', ') || '?'})`;
    case 'bagDrop': return `${head}${r.n}'s sack fell @ (${r.x},${r.z}): ${(r.items || []).join(', ')}`;
    case 'bagGrab': return `${head}${r.n} grabbed sack #${r.bagId}`;
    case 'kb': return `${head}${r.n} gave the KB tube to the Warden`;
    case 'win': return `${head}${r.n} dug up the suitcase — GAME WON`;
    case 'cmd': return `${head}${r.n} ran "${r.line}"${r.error ? ' -> ERROR: ' + r.error : r.reply ? ' -> ' + r.reply : ''}`;
    case 'env': return `${head}${r.n} spawned a ${r.k} @ (${r.x},${r.z})`;
    case 'clock': return `${head}${r.n} set the clock (paused=${r.paused}, pt=${r.pt}, was paused=${r.prevPaused}, pt=${r.prevPt})`;
    case 'admin': return `${head}${r.n} used the admin panel: ${r.a}`;
    case 'party': return `${head}${r.n} started a disco (${r.dur}s)`;
    case 'quota': return `${head}quota ${r.met ? 'MET' : 'missed'}: ${r.bank}/${r.quota} (day ${r.day})`;
    case 'grace': return `${head}grace day (crew arrived too late to be checked)`;
    case 'fired': return `${head}FIRED: crew sold ${r.bank}/${r.quota}`;
    case 'mobsOn': return `${head}${r.kind} appeared for the night`;
    case 'mobsOff': return `${head}${r.kind} left`;
    case 'spot': return `${head}police spotted ${r.n} @ (${r.x},${r.z})`;
    case 'lost': return `${head}police lost ${r.n}`;
    case 'down': return `${head}${r.n} knocked down by ${r.by} @ (${r.x},${r.z})`;
    case 'blink': return `${head}Zeroni blinked near ${r.n}${r.front ? ' (right in front!)' : ''}`;
    case 'drop': return `${head}Zeroni let go of ${r.n}`;
    case 'gone': return `${head}Zeroni dragged ${r.n} off the edge of the lake`;
    case 'zspawn': return `${head}Madame Zeroni appeared @ (${r.x},${r.z})`;
    case 'mon': return `${head}trucks=${JSON.stringify(r.trucks)} zer=${JSON.stringify(r.zer)}`;
    case 'err': return `${head}${r.n} CLIENT ERROR: ${r.msg}${r.src ? ' (' + r.src + ':' + r.line + ')' : ''}`;
    case 'perf': return `${head}${r.n} ${r.fps} fps @ ${r.pr}x — ${r.gpu}${r.sw ? ' [software renderer!]' : ''}`;
    case 'report': return `${head}${r.n} sees: lizards=${(r.liz || []).length} bots=${(r.bots || []).length} players=${(r.rp || []).length} twisters=${(r.tw || []).length}`;
    default: return `${head}${r.n || ''} ${Object.keys(r).filter(k => !['ts', 'gt', 't', 'id', 'n'].includes(k)).map(k => `${k}=${JSON.stringify(r[k])}`).join(' ')}`;
  }
}

function printSummary(rows) {
  const byPlayer = new Map(), errors = [];
  const get = n => { if (!byPlayer.has(n)) byPlayer.set(n, { hurt: 0, dmg: 0, ko: 0, finds: 0, errors: 0 }); return byPlayer.get(n); };
  for (const r of rows) {
    if (r.t === 'err') { errors.push(`${wallTime(r.ts)} [${r.gt}] ${r.n || '?'}: ${r.msg}`); if (r.n) get(r.n).errors++; continue; }
    if (!r.n) continue;
    const p = get(r.n);
    if (r.t === 'hurt') { p.hurt++; p.dmg += r.amt || 0; }
    else if (r.t === 'ko') p.ko++;
    else if (r.t === 'found') p.finds++;
  }
  if (!byPlayer.size) console.log('No player events matched.');
  else { console.log('Per player:'); for (const [n, s] of byPlayer) console.log(`  ${n.padEnd(14)} hurt:${s.hurt} (${s.dmg} dmg)  knockouts:${s.ko}  finds:${s.finds}  errors:${s.errors}`); }
  if (errors.length) { console.log('\nClient errors:'); for (const e of errors) console.log('  ' + e); }
  else console.log('\nNo client errors.');
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) { help(); return; }
  const o = parseArgs(args);
  let rows = readRows(listFiles(o.file));
  const lo = o.since ? resolveTime(o.since) : null, hi = o.until ? resolveTime(o.until) : null;
  rows = rows.filter(r => {
    if (o.player && !(r.n && o.player.includes(String(r.n).toLowerCase()))) return false;
    if (o.type && !o.type.includes(r.t)) return false;
    if ((lo || hi) && !inRange(r, lo, hi)) return false;
    if (o.near) { const p = posOf(r); if (!p) return false; if (Math.hypot(p[0] - o.near.x, p[1] - o.near.z) > o.radius) return false; }
    return true;
  });
  if (o.summary) return printSummary(rows);
  if (o.tail) rows = rows.slice(-o.tail);
  if (!rows.length) { console.log('No events matched.'); return; }
  for (const r of rows) console.log(o.json ? JSON.stringify(r) : oneLine(r));
}

main();
