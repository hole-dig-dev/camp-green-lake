#!/usr/bin/env node
// tests/wallet.mjs -- the crew wallet (public/js/84-wallet.js): two campers, one shared pot of gold.
// One camper finds gold, the other sees it and spends it, both see what's left, and a reload doesn't pay anyone twice.
// Usage: node tests/wallet.mjs   (starts its own server on a free port with a scratch data dir)
import net from 'node:net';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
const results = []; let fails = 0;
const check = (name, ok, detail = '') => { results.push(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' -- ' + detail : ''}`); if (!ok) fails++; };
const waitFor = (page, fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }).then(() => true, () => false);

const port = await freePort(), dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgl-wallet-'));
const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: dataDir, HOST_TOKEN: 'wallet-test' }, stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
async function camper(label) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[${label}] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/?r=1#dbg`, { waitUntil: 'load', timeout: 90000 });
  await waitFor(page, () => !!window.__cgl, null, 60000);
  await page.evaluate(() => document.querySelector('#startBtn').click());
  await waitFor(page, () => !document.querySelector('#hud').hidden && window.__cgl.S.started, null, 60000);
  return page;
}
const gold = p => p.evaluate(() => window.__cgl.S.seeds);
try {
  const p1 = await camper('p1'), p2 = await camper('p2');
  await waitFor(p1, () => document.querySelector('#onlineList').textContent !== 'Just you');
  check('two campers start with the same empty wallet', (await gold(p1)) === 0 && (await gold(p2)) === 0, `${await gold(p1)} / ${await gold(p2)}`);

  await p1.evaluate(() => window.__cgl.runCommand('give gold 200'));
  check('p1 finds 200 gold: p2 sees it in the crew wallet', await waitFor(p2, () => window.__cgl.S.seeds === 200), `p2 has ${await gold(p2)}`);
  check("p2's HUD shows the crew's gold", await waitFor(p2, () => document.querySelector('#seeds').textContent === '200'), await p2.$eval('#seeds', e => e.textContent));

  await p2.evaluate(() => { window.__cgl.S.seeds -= 50; });   // what every purchase does (50-tents.js buy)
  check('p2 spends 50: p1 sees 150 left', await waitFor(p1, () => window.__cgl.S.seeds === 150), `p1 has ${await gold(p1)}`);

  await p1.evaluate(() => { window.__cgl.S.seeds += 7; window.__cgl.S.seeds += 3; });   // two finds in a row
  check('two quick finds both count', await waitFor(p2, () => window.__cgl.S.seeds === 160), `p2 has ${await gold(p2)}`);

  await p1.evaluate(() => { window.__cgl.S.seeds -= 1000; });
  check('the wallet never goes below zero', await waitFor(p2, () => window.__cgl.S.seeds === 0), `p2 has ${await gold(p2)}`);
  await p1.evaluate(() => { window.__cgl.S.seeds += 40; });
  await waitFor(p2, () => window.__cgl.S.seeds === 40);

  await p1.reload({ waitUntil: 'load' });
  await waitFor(p1, () => !!window.__cgl && window.__cgl.S.started, null, 60000);
  await new Promise(r => setTimeout(r, 4000));
  check('a reload resumes with the crew wallet, nobody paid twice', (await gold(p1)) === 40 && (await gold(p2)) === 40, `${await gold(p1)} / ${await gold(p2)}`);

  const warden = await p2.evaluate(() => { const n = wardenNode(true); return n.opts.map(o => o.label); });
  check('the Warden has no deposit option any more', !warden.some(l => /Put gold/.test(l)) && warden.some(l => /crew wallet/.test(l)), warden.slice(0, 2).join(' | '));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' ; '));
} catch (e) { check('test ran', false, e.message); }
await browser.close(); server.kill();
console.log('--- wallet test ---\n' + results.join('\n') + `\n${fails ? 'FAIL' : 'PASS'} (${results.length - fails}/${results.length})`);
setTimeout(() => { try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {} process.exit(fails ? 1 : 0); }, 1500);
