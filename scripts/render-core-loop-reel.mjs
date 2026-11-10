#!/usr/bin/env node
// scripts/render-core-loop-reel.mjs -- checks and records the core-loop cues of public/js/41-cues.js in the real game.
// For each cue it plays the old (synthesized) and the new version through the game's own Web Audio graph, records
// what reaches the master bus as PCM, counts the buffer sources / oscillators the cue started, and measures the level.
// Then it drives the real paths (menus with the mouse, `hurt`, a purchase, an assay) to prove the wiring, and writes:
//   <out>.mp3  the review reel (every cue in order, old first then new, a short gap between)
//   <out>.md   the order and timestamps, and a table of measured levels
// Usage: PORT=4362 env -u DISPLAY node scripts/render-core-loop-reel.mjs asset-library/audio/review-reels/2026-11-10-core-loop
// The server must already be running (DEV_MODE=1). Audio only: no frames are drawn after the game has started.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const OUT = process.argv[2]; if (!OUT) throw Error('usage: render-core-loop-reel.mjs <out path without extension>');
const PORT = process.env.PORT || 4362;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-core-loop-'));
const GAP = 0.6;   // seconds of silence between reel items

/* each cue: label, how long to record, and page code for the new and (where there was one) the old sound */
const tick = (n, ms, body) => `for(let i=0;i<${n};i++)setTimeout(()=>{${body}},i*${ms})`;
const CUES = [
  { id: 'ref-dig', label: 'Reference: digging (approved, unchanged)', s: 1.2, ref: true, now: 'sfx.scoop()' },
  { id: 'ref-metal', label: 'Reference: metal click (approved, unchanged)', s: 1.0, ref: true, now: 'sfx.clank()' },
  { id: 'coin-1', cat: 'rewards', label: 'Coin, a fleck (1 gold)', s: 1.0, now: 'sfx.coin(1)', old: 'sfx.coin(1)' },
  { id: 'coin-12', cat: 'rewards', label: 'Coin, a washed pan (12 gold)', s: 1.0, now: 'sfx.coin(12)' },
  { id: 'coin-120', cat: 'rewards', label: 'Coin, a big batch (120 gold)', s: 1.1, now: 'sfx.coin(120)' },
  { id: 'coin-x6', cat: 'rewards', label: 'Six flecks in a row (the variation)', s: 2.4, now: tick(6, 330, 'sfx.coin(1)'), old: tick(6, 330, 'sfx.coin(1)') },
  { id: 'gold', cat: 'rewards', label: 'Nugget / rich batch / badge', s: 1.6, now: 'sfx.gold()', old: 'sfx.gold()' },
  { id: 'find', cat: 'rewards', label: 'Found an item', s: 1.0, now: 'sfx.find()', old: 'sfx.find()' },
  { id: 'assay-3', cat: 'rewards', label: 'Assay: Pay dirt (after the coin)', s: 2.0, now: 'sfx.coin(12);sfx.assay(3)', old: 'sfx.coin(12)' },
  { id: 'assay-4', cat: 'rewards', label: 'Assay: Rich (after the nugget)', s: 3.2, now: 'sfx.gold();sfx.assay(4)', old: 'sfx.gold()' },
  { id: 'glint', cat: 'rewards', label: 'Dig with a glint: 1, 2, then 3 sparks', s: 3.2, now: tick(3, 950, 'sfx.scoop();sfx.glint(i+1)'), old: tick(3, 950, 'sfx.scoop()') },
  { id: 'pan', cat: 'rewards', label: 'Pan wash: dunk, water over the lip, dunk', s: 4.2, now: `sfx.panDunk();${tick(8, 300, 'sfx.panSwirl()')};setTimeout(()=>sfx.panDunk(),2700)`, old: `sfx.panDunk();${tick(8, 300, 'sfx.panSwirl()')};setTimeout(()=>sfx.panDunk(),2700)` },
  { id: 'sift', cat: 'rewards', label: 'Sifter shaking', s: 3.0, now: tick(14, 180, 'sfx.siftShake()'), old: tick(14, 180, 'sfx.siftShake()') },
  { id: 'buy', cat: 'rewards', label: 'Store purchase', s: 1.5, now: 'sfx.buy()', old: 'sfx.buy()' },
  { id: 'quota', cat: 'rewards', label: 'The nightly quota leaves the wallet (was silent)', s: 2.0, now: 'sfx.quota()' },
  { id: 'level', cat: 'rewards', label: 'Level up', s: 2.6, now: 'sfx.levelUp()', old: 'sfx.levelUp()' },
  { id: 'ui-open', cat: 'ui', label: 'Menu open (was silent)', s: 0.9, now: 'sfx.uiOpen()' },
  { id: 'ui-close', cat: 'ui', label: 'Menu close (was silent)', s: 0.8, now: 'sfx.uiClose()' },
  { id: 'ui-hover', cat: 'ui', label: 'Button hover x3 (was silent)', s: 1.2, now: tick(3, 280, 'sfx.uiHover()') },
  { id: 'ui-click', cat: 'ui', label: 'Button press x2 (was silent)', s: 1.1, now: tick(2, 380, 'sfx.uiClick()') },
  { id: 'ui-deny', cat: 'ui', label: "Error / can't afford (was silent)", s: 1.0, now: 'sfx.deny()' },
  { id: 'hurt-5', cat: 'danger', label: 'Hurt, light (5)', s: 1.0, now: 'sfx.hurt(5)', old: 'sfx.hurt(5)' },
  { id: 'hurt-30', cat: 'danger', label: 'Hurt, heavy (30)', s: 1.0, now: 'sfx.hurt(30)' },
  { id: 'ko', cat: 'danger', label: 'Knocked out (was silent)', s: 1.6, now: 'sfx.ko()' },
  { id: 'lizard', cat: 'danger', label: 'Lizard warning hiss', s: 1.7, now: 'sfx.lizard()', old: 'sfx.lizard()' },
  { id: 'siren', cat: 'danger', label: 'Curfew siren', s: 9.5, sOld: 5.2, now: 'siren()', old: 'siren()' },
  { id: 'sting', cat: 'ui', label: 'Title screen start press (was silent)', s: 4.5, now: 'sfx.startSting()' },
];

function run(cmd, args) { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw Error(`${cmd} failed: ${r.stderr.slice(-600)}`); return r; }
function wav(file, f32, rate) {
  const n = f32.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}
const dB = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
function measure(f32, rate, file) {
  let peak = 0; for (const v of f32) { const a = Math.abs(v); if (a > peak) peak = a; }
  // loudest 100 ms and the time above -50 dBFS: comparable between a 60 ms tick and an 8 s siren
  const w = Math.round(rate * 0.1); let best = 0, acc = 0, active = 0;
  for (let i = 0; i < f32.length; i++) { acc += f32[i] * f32[i]; if (i >= w) acc -= f32[i - w] * f32[i - w]; if (acc > best) best = acc; if (Math.abs(f32[i]) > 0.00316) active = i; }
  let first = f32.findIndex(v => Math.abs(v) > 0.00316);
  const e = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const mom = [...e.matchAll(/ M:\s*(-?[\d.]+)/g)].map(m => +m[1]).filter(v => v > -100);
  return { peak: dB(peak), rms100: dB(Math.sqrt(best / w)), lufsM: mom.length ? Math.max(...mom) : null, len: first < 0 ? 0 : (active - first) / rate };
}

const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, bypassCSP: true });   // the cue snippets above are eval'd in the page
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
// count every sound source the page starts, and which clip it was (installed before any game code runs)
await page.addInitScript(() => {
  const N = window.__snd = { buf: 0, osc: 0, clips: [] };
  const bs = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) {
    N.buf++; try { let name = this.buffer === noiseBuf ? '(noise)' : '?'; for (const [k, v] of audioBuffers) if (v === this.buffer) name = k; N.clips.push(name); } catch (e) { }
    return bs.apply(this, a);
  };
  const os = OscillatorNode.prototype.start; OscillatorNode.prototype.start = function (...a) { N.osc++; return os.apply(this, a); };
});
await page.goto(`http://127.0.0.1:${PORT}/?r=1#dbg`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__cgl && document.querySelector('#startBtn') && !document.querySelector('#startBtn').disabled, null, { timeout: 60000 });
await page.evaluate(() => document.querySelector('#startBtn').click());
await page.waitForFunction(() => !document.querySelector('#hud').hidden && typeof AC !== 'undefined' && AC, null, { timeout: 30000 });
await page.waitForFunction(() => Object.keys(AUDIO_FILES).every(n => audioBuffers.has(n)), null, { timeout: 30000 });
const startSting = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 1500)); return window.__snd.clips.filter(c => c === 'bell' || c === 'ting' || c === 'shovel') });
const info = await page.evaluate(async () => {
  renderer.render = () => { };                      // audio only from here on: draw nothing
  window.requestAnimationFrame = () => 0;           // and stop the game loop, so no stray in-game sound (a badge, a crew find) lands in a recording
  await AC.resume(); windNoiseGain.disconnect(); rainGain.disconnect(); updateAudioScene = () => { }; updateFootsteps = () => { };
  for (const l of ambientLoops.values()) l.gain.disconnect();
  window.__cgl.runCommand('god on');
  // PCM tap on the master bus: what the player's speakers would get, before the pause-menu volume is undone below
  const sp = AC.createScriptProcessor(4096, 2, 1), sink = AC.createGain(); sink.gain.value = 0; master.connect(sp); sp.connect(sink).connect(AC.destination);
  window.__tap = { on: false, chunks: [] };
  sp.onaudioprocess = e => { if (!window.__tap.on) return; const a = e.inputBuffer.getChannelData(0), b = e.inputBuffer.getChannelData(1), o = new Float32Array(a.length); for (let i = 0; i < a.length; i++)o[i] = (a[i] + b[i]) / 2; window.__tap.chunks.push(o); };
  return { rate: AC.sampleRate, state: AC.state, master: master.gain.value, fx: fxBus.gain.value, clips: Object.keys(AUDIO_FILES).length, modes: audioModeStatus() };
});
console.log('audio context', JSON.stringify(info), 'start sting clips:', startSting.join(','));

async function capture(code, seconds, mode, cat) {
  const r = await page.evaluate(async ({ code, seconds, mode, cat }) => {
    if (cat) setAudioMode(cat, mode);
    const N = window.__snd, b0 = N.buf, o0 = N.osc, c0 = N.clips.length, T = window.__tap;
    T.chunks = []; T.on = true; await new Promise(r => setTimeout(r, 250));
    (0, eval)(code);
    await new Promise(r => setTimeout(r, seconds * 1000)); T.on = false;
    if (cat) setAudioMode(cat, 'recorded');
    const n = T.chunks.reduce((s, c) => s + c.length, 0), all = new Float32Array(n); let o = 0; for (const c of T.chunks) { all.set(c, o); o += c.length }
    const bytes = new Uint8Array(all.buffer); let s = ''; for (let i = 0; i < bytes.length; i += 8192)s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return { pcm: btoa(s), buf: N.buf - b0, osc: N.osc - o0, clips: N.clips.slice(c0) };
  }, { code, seconds, mode, cat });
  const raw = Buffer.from(r.pcm, 'base64'); return { f32: new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4), buf: r.buf, osc: r.osc, clips: r.clips };
}
const rows = [], reel = [];
for (const c of CUES) {
  for (const mode of (c.old ? ['original', 'recorded'] : ['recorded'])) {
    const isOld = mode === 'original', cap = await capture(isOld ? c.old : c.now, isOld && c.sOld || c.s, mode, c.cat);
    const file = path.join(tmp, `${c.id}-${isOld ? 'old' : 'new'}.wav`); wav(file, cap.f32, info.rate);
    const m = measure(cap.f32, info.rate, file);
    const row = { id: c.id, label: c.label, ver: c.ref ? 'ref' : isOld ? 'old' : 'new', ...m, buf: cap.buf, osc: cap.osc, clips: [...new Set(cap.clips)].join(' ') };
    rows.push(row); reel.push({ file, row, dur: cap.f32.length / info.rate });
    console.log(`${row.id.padEnd(10)} ${row.ver.padEnd(3)} peak ${m.peak.toFixed(1).padStart(6)} dBFS  loudest-100ms ${m.rms100.toFixed(1).padStart(6)} dB  M-max ${m.lufsM == null ? '   n/a' : m.lufsM.toFixed(1).padStart(6)} LUFS  len ${m.len.toFixed(2)}s  sources ${cap.buf} buf + ${cap.osc} osc  [${row.clips}]`);
  }
}

/* ---- the real paths: prove the wiring, not just the functions ---- */
const wiring = await page.evaluate(async () => {
  const N = window.__snd, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
  const during = async (name, fn, ms = 500) => { const c0 = N.clips.length, o0 = N.osc; await fn(); await wait(ms); out[name] = N.clips.slice(c0).join(',') || (N.osc - o0 ? `(${N.osc - o0} osc)` : 'NOTHING'); };
  await during('pause opens', () => openPause());
  await during('pause closes', () => closePause());
  await during('store opens', () => openShop());
  await during('assay Pay dirt (payAssay)', () => { SIM.PAY.on = true; payAssay(SIM.PAY.cuts[2] + 0.01) }, 1500);
  await during('assay Rich (payAssay)', () => { payAssay(SIM.PAY.cuts[3] + 0.5) }, 1800);
  await during('assay Barren (payAssay) stays silent', () => { payAssay(0) }, 900);
  await during('level up (addXP)', () => { addXP(100000) }, 1200);
  await during('new day, quota paid (newDay)', () => { newDay({ paid: 10 }) }, 1500);
  window.__cgl.runCommand('god off');
  await during('hurt (console: hurt 10)', () => { window.__cgl.runCommand('hurt 10') });
  await during('knocked out (knockOut)', () => { knockOut('Test', 'Test.') }, 900);
  respawn(); window.__cgl.runCommand('god on');
  await during('curfew siren (siren())', () => { siren() }, 300);
  muted = true; applyVolume(); out['M (mute)'] = 'master gain becomes ' + master.gain.value; muted = false; applyVolume();
  { const v = SETTINGS.volFx; SETTINGS.volFx = 0.25; applyVolume(); out['Effects volume set to 25%'] = 'the bus all these cues play through becomes ' + fxBus.gain.value; SETTINGS.volFx = v; applyVolume() }
  return out;
});
// real mouse: hover and press a store button, then press a greyed-out one
const mouse = {};
async function clipsDuring(name, fn) { const c0 = await page.evaluate(() => window.__snd.clips.length); await fn(); await page.waitForTimeout(400); mouse[name] = (await page.evaluate(c0 => window.__snd.clips.slice(c0).join(','), c0)) || 'NOTHING'; }
const boxOf = async sel => { const b = await page.locator(sel).first().boundingBox(); return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
await page.evaluate(() => { RUN.bank = 0; renderShop() });
const item = await boxOf('.shop-item'), closeB = await boxOf('#shopClose'), buyB = await boxOf('#shopBuyBtn');
if (item) { await page.mouse.move(5, 5); await clipsDuring('mouse hovers a store item', () => page.mouse.move(item.x, item.y)); await clipsDuring('mouse presses a store item', () => page.mouse.click(item.x, item.y)); }
const buyState = await page.evaluate(() => { const b = document.querySelector('#shopBuyBtn'); return b ? `${b.textContent} (disabled=${b.disabled})` : 'none' });
const buyB2 = await boxOf('#shopBuyBtn');
if (buyB2) await clipsDuring(`mouse presses greyed-out "${buyState}"`, () => page.mouse.click(buyB2.x, buyB2.y));
await page.evaluate(() => { window.__cgl.runCommand('bank 5000') }); await page.waitForTimeout(700); await page.evaluate(() => renderShop());
await clipsDuring('a real purchase (buy + confirm buttons)', async () => { const b = await boxOf('#shopBuyBtn:not([disabled])'); if (!b) return; await page.mouse.click(b.x, b.y); await page.waitForTimeout(200); const c = await boxOf('#shopConfirmBuy'); if (c) await page.mouse.click(c.x, c.y); await page.waitForTimeout(500); });
if (closeB) await clipsDuring('store closes (close button)', () => page.mouse.click(closeB.x, closeB.y));
const oldAll = await page.evaluate(async () => { window.__cgl.runCommand('audio old'); const c0 = window.__snd.clips.length; sfx.coin(5); sfx.uiClick(); sfx.hurt(5); await new Promise(r => setTimeout(r, 300)); const r = window.__snd.clips.slice(c0).join(',') || 'no clips (synth only)'; const st = audioModeStatus(); window.__cgl.runCommand('audio new'); return r + '; modes: ' + st });
await browser.close();

/* ---- the reel: every capture in order with a gap, loudness left exactly as the game mixes it at Master 55% ---- */
const list = path.join(tmp, 'list.txt'), silence = path.join(tmp, 'gap.wav'); wav(silence, new Float32Array(Math.round(info.rate * GAP)), info.rate);
let t = 0; const stamps = []; const lines = [];
for (const r of reel) { stamps.push({ t, row: r.row }); lines.push(`file '${r.file}'`, `file '${silence}'`); t += r.dur + GAP; }
fs.writeFileSync(list, lines.join('\n'));
// +9 dB on the whole reel (one gain for everything, so relative levels are the game's): the captures are at the default Master 55%
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-af', 'volume=9dB,alimiter=limit=0.95', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', OUT + '.mp3']);
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const f = (v, d = 1) => v == null || !isFinite(v) ? 'n/a' : v.toFixed(d);
const md = [`# Core-loop sound pass: review reel`, ``,
  `[MP3](${path.basename(OUT)}.mp3), ${mmss(t)}. Recorded from the running game's master bus by \`scripts/render-core-loop-reel.mjs\` (headless Chromium, default volumes: Master 55%, Effects 100%). No spoken labels: use the times below. Where a cue had an older sound, the **old** one plays first and the **new** one right after. The whole reel is 9 dB louder than the game's output; the balance between cues is untouched.`, ``,
  `**Not yet reviewed by ear.** Levels were set by measurement against the approved digging clip.`, ``,
  `| Time | Cue | Version | Peak dBFS | Loudest 100 ms dB | Momentary max LUFS | Length s | Sources started |`, `| --- | --- | --- | --- | --- | --- | --- | --- |`,
  ...stamps.map(s => `| ${mmss(s.t)} | ${s.row.label} | ${s.row.ver} | ${f(s.row.peak)} | ${f(s.row.rms100)} | ${f(s.row.lufsM)} | ${f(s.row.len, 2)} | ${s.row.buf} clip + ${s.row.osc} osc |`),
  ``, `Levels are of the game's output at default volumes (not of the files). "Sources started" counts the buffer sources and oscillators the cue scheduled on the AudioContext.`, ``,
  `## Wiring check (the real game paths)`, ``, `| Action | Clips the game started |`, `| --- | --- |`,
  `| Start button on the title screen | ${startSting.join(',') || 'NOTHING'} |`,
  ...Object.entries(wiring).map(([k, v]) => `| ${k} | ${v} |`), ...Object.entries(mouse).map(([k, v]) => `| ${k} | ${v} |`),
  `| \`audio old\` then coin, button press, hurt | ${oldAll} |`, ``,
  `Console errors during the run: ${errs.length ? errs.length : 'none'}.`, ...errs.slice(0, 10).map(e => `- ${e}`), ``];
fs.writeFileSync(OUT + '.md', md.join('\n'));
fs.writeFileSync(path.join(tmp, 'rows.json'), JSON.stringify({ rows, wiring, mouse, errs }, null, 1));
console.log('\nwiring', JSON.stringify(wiring, null, 1), JSON.stringify(mouse, null, 1), '\nold-mode:', oldAll);
console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no console errors'); console.log('reel', OUT + '.mp3', mmss(t), 'tmp', tmp);
