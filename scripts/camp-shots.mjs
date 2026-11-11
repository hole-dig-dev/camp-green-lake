#!/usr/bin/env node
// scripts/camp-shots.mjs -- art-direction screenshots of the camp: a free camera you place by hand, at any clock time,
// outside or inside a room. Like dev-shots.mjs, but the camera is yours (the player stands wherever the cmds put them).
// Usage:  PORT=4368 env -u DISPLAY node scripts/camp-shots.mjs <outdir> <spec.json>
//   spec.json: [{"name":"yard-day","cmds":["time 10:30"],"cam":[x,y,z],"look":[x,y,z],"wait":2500,"js":"..."}, ...]
//   cmds are developer-console commands (time hh:mm, tent D, tent out, tp x y ...). cam/look are world coordinates
//   (inside a room: y around TENT_FLOOR_Y + 1.6, i.e. -2.4). Without cam the game's own camera is used.
//   {"calls":true} on a shot also prints the scene's draw calls for that view (one plain render, shadows included).
// Env: PORT, W/H (default 1280x720). GPU flags as CLAUDE.md asks (the Radeon via ANGLE/Vulkan).
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2]; const spec = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
fs.mkdirSync(out, { recursive: true });
const PORT = process.env.PORT || 4368; const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${PORT}/?r=1#dbg`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__cgl && document.querySelector('#startBtn'), null, { timeout: 60000 });
await page.evaluate(() => document.querySelector('#startBtn').click());
await page.waitForTimeout(5000);
await page.evaluate(() => {
  window.__cgl.runCommand('god on');
  // the free camera: placed after the game has set its own, just before the frame is drawn
  const orig = window.lookRender; window.CAMOV = null;
  window.lookRender = function (s, c) { const o = window.CAMOV; if (o) { c.position.set(...o.cam); c.lookAt(...o.look) } return orig(s, c) };
  for (const id of ['hud', 'toasts', 'toast']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden' }
});
for (const s of spec) {
  await page.evaluate(s => { const c = window.__cgl; for (const k of (s.cmds || [])) try { c.runCommand(k) } catch (e) { console.warn(e.message) }
    window.CAMOV = s.cam ? { cam: s.cam, look: s.look } : null; if (s.js) (0, eval)(s.js); }, s);
  await page.waitForTimeout(s.wait || 2500);
  await page.screenshot({ path: `${out}/${s.name}.png` });
  let info = '';
  if (s.calls) info = await page.evaluate(() => { const r = renderer; r.info.autoReset = false; r.info.reset(); r.render(scene, camera); const c = r.info.render.calls, t = r.info.render.triangles; r.info.autoReset = true; return ` calls ${c} tris ${t}` });
  console.log('shot', s.name, info);
}
if (errs.length) console.log(errs.slice(0, 10).join('\n'));
await browser.close();
