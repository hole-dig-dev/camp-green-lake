// Serve the repo root with `python3 -m http.server`, then pass its URL to this script.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Usage: node tools/capture-character.mjs http://127.0.0.1:PORT');
const out = join(import.meta.dirname, '..', 'docs', 'character-prototype');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader'] });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 360, height: 800 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${root}/tools/character-lab.html`, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
    if (!await page.locator('canvas').count()) throw new Error(`${name}: no character canvas`);
    await page.screenshot({ path: join(out, `${name}-idle.png`) });
    await page.getByRole('button', { name: 'Walk' }).click();
    const first = await page.evaluate(() => p.legL.rotation.x);
    await page.waitForTimeout(180);
    const second = await page.evaluate(() => p.legL.rotation.x);
    if (Math.abs(first - second) < 0.1) throw new Error(`${name}: walk joint did not move`);
    await page.getByRole('button', { name: 'Dig' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `${name}-dig.png`) });
    const elbow = await page.evaluate(() => p.armR.rotation.x);
    if (elbow > -0.6) throw new Error(`${name}: digging arm did not swing`);
    if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
    await page.close();
  }
} finally { await browser.close(); }
console.log(`Character preview loaded and walk/dig joints moved; screenshots: ${out}`);
