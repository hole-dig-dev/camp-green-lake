// Exercise the actual footwear-lab binder with a review-only manifest, without changing its catalog.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
execFileSync(process.execPath, ['/home/botuser/personal-assistant/scripts/gpu-preflight.mjs'], {cwd: root, stdio: 'inherit'});
const out = path.join(root, 'art/blender/renders/hover-shoes-bound');
fs.mkdirSync(out, {recursive: true});
const publicRoot = path.join(root, 'public');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(publicRoot, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(publicRoot + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', ({'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png'})[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({headless: true, args: ['--use-gl=angle', '--use-angle=vulkan',
    '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/footwear-lab/manifest.json', route => route.fulfill({json: [{id: 1,
    slug: 'hover-shoes', name: 'Hover Shoes', group: 'Shoes', file: '../models/footwear/hover-shoes.glb',
    description: 'Pearl runners with cyan hover soles and recessed heel thrusters.'}]}));
  await page.goto(`http://127.0.0.1:${server.address().port}/footwear-lab/`);
  await page.waitForFunction(() => window.footwearLab?.ready, null, {timeout: 60000});
  const audit = await page.evaluate(() => {
    const h = footwearLab, f = h.footwear[0], base = new Set(h.original.skeleton.bones);
    const gl = h.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    const point = n => {
      n.skeleton.update();
      return n.boneTransform(0, new THREE.Vector3().fromBufferAttribute(n.geometry.attributes.position, 0));
    };
    const samples = {};
    for (const side of ['L', 'R']) {
      const n = f.meshes.find(n => n.userData.side === side);
      h.pose('Rest'); const rest = point(n);
      samples[side] = {};
      for (const clip of ['Walk', 'Run', 'Sit', 'Dig']) {
        h.pose(clip, clip === 'Sit' ? .5 : .35);
        samples[side][clip] = rest.distanceTo(point(n));
      }
    }
    h.pose('Rest');
    const materials = [...new Set(f.meshes.flatMap(n => Array.isArray(n.material) ? n.material : [n.material]))]
      .filter(m => m.emissive?.getHex() > 0)
      .map(m => ({name: m.name, emissive: m.emissive.toArray(), intensity: m.emissiveIntensity}));
    return {gpu, sharedBones: f.meshes.every(n => n.skeleton.bones.every(b => base.has(b))),
      originalsHidden: ['L_Shoe', 'R_Shoe', 'L_Sole', 'R_Sole'].every(s => !h.model.getObjectByName('CGLCamper_' + s).visible),
      sides: [...new Set(f.meshes.map(n => n.userData.side))].sort(), movement: samples, emissiveMaterials: materials,
      binder: 'public/footwear-lab/viewer.js', headVisible: h.model.getObjectByName('CGLCamper_Head').visible};
  });
  assert.match(audit.gpu, /AMD Radeon 760M.*RADV|AMD Radeon 760M.*radv/i);
  assert.ok(audit.sharedBones && audit.originalsHidden && audit.headVisible);
  assert.deepEqual(audit.sides, ['L', 'R']);
  for (const side of ['L', 'R']) for (const clip of ['Walk', 'Run', 'Sit', 'Dig']) {
    assert.ok(audit.movement[side][clip] > .005, `${side} follows ${clip}`);
  }
  assert.deepEqual(audit.emissiveMaterials.map(m => m.name).sort(), ['cgl_hover_sole_cyan', 'cgl_hover_thruster_cyan']);
  // The lab's older Three.js loader reads emissiveFactor; newer loaders also read
  // KHR_materials_emissive_strength. Both must retain nonzero cyan emission.
  assert.ok(audit.emissiveMaterials.every(m => m.intensity > 0 && m.emissive[1] > 0 && m.emissive[2] > 0));
  // Capture the canvas: the existing lab's twenty-pair UI is not part of this asset handoff.
  await page.evaluate(() => {
    document.querySelector('#viewport').style.height = '850px';
    document.querySelector('.studio').style.gridTemplateColumns = '1fr';
    document.querySelector('.details').style.display = 'none';
    footwearLab.draw();
  });
  const canvas = page.locator('#viewport canvas');
  await page.locator('#turn').evaluate(e => { e.value = '32'; e.dispatchEvent(new Event('input')); });
  await canvas.screenshot({path: out + '/standing-close.png'});
  await page.locator('[data-view="back"]').dispatchEvent('click');
  await canvas.screenshot({path: out + '/heel-close.png'});
  await page.locator('[data-view="body"]').dispatchEvent('click');
  await canvas.screenshot({path: out + '/camper-standing.png'});
  await page.evaluate(() => footwearLab.pose('Walk', .35));
  await canvas.screenshot({path: out + '/camper-walk.png'});
  await page.evaluate(() => footwearLab.pose('Sit', .5));
  await canvas.screenshot({path: out + '/camper-sit.png'});
  assert.deepEqual(errors, []);
  fs.writeFileSync(out + '/audit.json', JSON.stringify(audit, null, 2) + '\n');
  console.log('Hover shoes bound with the existing footwear viewer: hardware GPU, original bones, hidden original shoes, two emissive materials and both feet moving through Walk/Run/Sit/Dig passed.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
