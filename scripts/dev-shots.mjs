#!/usr/bin/env node
// scripts/dev-shots.mjs -- take screenshots of the running game, for looking at visual changes (CLAUDE.md: "look at them").
// Usage:  PORT=4350 env -u DISPLAY node scripts/dev-shots.mjs <outdir> <spec.json>
//   spec.json: [{"title":true}, {"name":"camp","cmds":["tp camp","time 12:00"],"yaw":0,"pitch":0.1,"wait":3000,"js":"S.up.shovel=true"}, ...]
//   {"title":true} first = also save title.png before starting. cmds are developer-console commands (tp x y, time hh:mm, ...).
//   `tp x y` puts you at world x, z = -y. yaw 0 looks toward -z (out over the lake), pitch > 0 looks down. js runs in the page.
// Env: PORT (server port), W/H (viewport, default 1280x720), HASH (extra URL hash). Uses the Radeon via ANGLE/Vulkan;
// run with `env -u DISPLAY` (a stale DISPLAY gives "no WebGL"). The server must already be running (DEV_MODE=1).
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2]; const spec = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const PORT = process.env.PORT || 4310; const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${PORT}/?r=1#dbg${process.env.HASH || ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__cgl && document.querySelector('#startBtn'), null, { timeout: 60000 });
if (spec[0]?.title) { await page.waitForTimeout(3000); await page.screenshot({ path: `${out}/title.png` }); }
await page.evaluate(() => document.querySelector('#startBtn').click());
await page.waitForTimeout(4000);
await page.evaluate(() => { window.__cgl.runCommand('god on'); });
for (const s of spec) {
  if (s.title) continue;
  await page.evaluate(s => { const c = window.__cgl; for (const k of (s.cmds || [])) c.runCommand(k); if (s.yaw != null) c.P.yaw = s.yaw; if (s.pitch != null) c.P.pitch = s.pitch; if (s.js) (0, eval)(s.js); }, s);
  await page.waitForTimeout(s.wait || 2500);
  if (s.yaw != null) await page.evaluate(s => { const c = window.__cgl; c.P.yaw = s.yaw; if (s.pitch != null) c.P.pitch = s.pitch; }, s);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${s.name}.png` });
  console.log('shot', s.name, await page.evaluate(() => { const P = window.__cgl.P; return `x${P.x.toFixed(0)} z${P.z.toFixed(0)} yaw${P.yaw.toFixed(2)}` }));
}
console.log(await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g.getExtension('WEBGL_debug_renderer_info'); return 'GPU ' + g.getParameter(e.UNMASKED_RENDERER_WEBGL) }));
if (errs.length) console.log(errs.slice(0, 10).join('\n'));
await browser.close();
