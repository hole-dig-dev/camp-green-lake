/* In-game GPU review. No public/js edits; temporary placement and textures. */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const {browser, player} = require('./carry/lib.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'art/blender/renders/employee-board-game');

async function freePort() {
  return new Promise(resolve => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const data = fs.mkdtempSync(path.join(ROOT, '.employee-board-review-'));
  fs.writeFileSync(path.join(data, 'world.json'), '{"director":{"on":false}}\n');
  const port = await freePort(), errors = [];
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, env: {...process.env, PORT: String(port), DEV_MODE: '1', DATA_DIR: data}, stdio: 'ignore'
  });
  let b;
  try {
    for (let i = 0; ; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch {}
      if (i >= 60) throw Error('review server unavailable');
      await new Promise(r => setTimeout(r, 100));
    }
    b = await browser();
    const page = await player(b, port, 'Gold Digger', errors);
    await page.setViewportSize({width: 1600, height: 1000});
    await page.addStyleTag({content: 'body > :not(#game) { visibility: hidden !important; }'});
    const audit = await page.evaluate(async () => {
      GOD = true; crewPanelOn = false; window.lsPlan = () => null;
      window.updateHaboob = () => {}; window.nightF = () => 0;
      sun.intensity = 1.05; hemi.intensity = .62;
      sky.material.color.copy(WHITE); scene.fog.color.copy(FOG_DAY);
      const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
      const loaded = await new Promise((resolve, reject) => new T.GLTFLoader().load('models/EmployeeBoard.glb', resolve, undefined, reject));
      const board = loaded.scene;
      // Between the tents and the Warden's yard; front remains game +Z.
      board.position.set(-19.5, baseH(-19.5, 38.5), 38.5);
      board.traverse(n => { if (n.isMesh) { n.material = gameMat(n.material).clone(); n.castShadow = true; n.receiveShadow = true; } });
      scene.add(board); board.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(board), size = bounds.getSize(new T.Vector3());
      const title = ['MOST GOLD FOUND', 'MOST TIMES THROWN', 'LEAST VALUABLE PERSON', 'BIG SPENDER'];
      const people = [me, bots[1].p, bots[2].p, sir];
      const names = ['Gold Digger', bots[1].d.n, bots[2].d.n, 'Mr. Sir'];
      const colors = ['#e73535', '#26d447', '#2764e8', '#f4dc26'];
      // Portraits capture the actual game avatars and their current visible outfit.
      const portrait = person => {
        const s = new T.Scene(); s.background = new T.Color(0xb8c2ad);
        s.add(new T.HemisphereLight(0xffffff, 0x8b7152, 1.1));
        const light = new T.DirectionalLight(0xffefcf, 1.2); light.position.set(-2, 4, 4); s.add(light);
        const clone = T.SkeletonUtils.clone(person.g);
        clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0); clone.visible = true;
        clone.traverse(n => { n.layers.set(0); if (n.userData.fpWas !== undefined) n.visible = n.userData.fpWas; });
        s.add(clone); clone.updateMatrixWorld(true);
        const head = clone.getObjectByName('head').getWorldPosition(new T.Vector3());
        const c = new T.OrthographicCamera(-.48, .48, .64, -.64, .1, 10);
        c.position.set(.12, head.y + .04, 3); c.lookAt(0, head.y - .23, 0);
        const rt = new T.WebGLRenderTarget(288, 384), pixels = new Uint8Array(288 * 384 * 4);
        renderer.setRenderTarget(rt); renderer.render(s, c); renderer.readRenderTargetPixels(rt, 0, 0, 288, 384, pixels); renderer.setRenderTarget(null);
        const cv = document.createElement('canvas'); cv.width = 288; cv.height = 384;
        const cx = cv.getContext('2d'), im = cx.createImageData(288, 384);
        for (let y = 0; y < 384; y++) im.data.set(pixels.subarray(y * 288 * 4, (y + 1) * 288 * 4), (383 - y) * 288 * 4);
        cx.putImageData(im, 0, 0); rt.dispose(); return cv;
      };
      const surfaces = [];
      for (let i = 0; i < 4; i++) for (const prefix of ['Photo', 'Plaque']) {
        const name = prefix + (i + 1), mesh = board.getObjectByName(name), cv = document.createElement('canvas');
        const photo = prefix === 'Photo'; cv.width = photo ? 384 : 1024; cv.height = photo ? 512 : 256;
        const cx = cv.getContext('2d'), w = cv.width, h = cv.height;
        cx.fillStyle = '#efdfb5'; cx.fillRect(0, 0, w, h);
        if (photo) {
          cx.drawImage(portrait(people[i]), 10, 55, w - 20, h - 105);
          cx.fillStyle = '#25352a'; cx.textAlign = 'center'; cx.font = 'bold 26px sans-serif';
          cx.fillText('TOP ↑  /  PHOTO ' + (i + 1), w / 2, 37);
          cx.font = 'bold 22px sans-serif'; cx.fillText('LEFT  ←  ' + (i + 1) + '  →  RIGHT', w / 2, h - 17);
        } else {
          cx.fillStyle = '#352817'; cx.textAlign = 'center';
          cx.font = 'bold 57px sans-serif'; cx.fillText(title[i], w / 2, 83, w - 125);
          cx.font = 'bold 80px sans-serif'; cx.fillText(names[i], w / 2, 192, w - 160);
        }
        // Distinct corner swatches sampled away from text, for every canvas.
        const cw = w * .12, ch = h * .18;
        for (const [j, x, y] of [[0, 0, 0], [1, w - cw, 0], [2, 0, h - ch], [3, w - cw, h - ch]]) {
          cx.fillStyle = colors[j]; cx.fillRect(x, y, cw, ch);
        }
        const texture = new T.CanvasTexture(cv); texture.flipY = false; texture.encoding = T.LinearEncoding;
        mesh.material = new T.MeshBasicMaterial({map: texture});
        mesh.castShadow = false;
        surfaces.push({name, material: texture.uuid, corners: []});
      }
      const target = board.position.clone().add(new T.Vector3(0, 1.5, 0));
      window.__employeeBoard = {board, target, distance: 4.7};
      P.x = -20; P.z = 41; P.y = groundAt(P.x, P.z);
      window.updateCamera = () => {
        me.g.visible = false;
        const dx = __employeeBoard.distance === 10 ? -2 : 0;
        camera.position.copy(__employeeBoard.target).add(new T.Vector3(dx, 0, Math.sqrt(__employeeBoard.distance ** 2 - dx ** 2)));
        camera.lookAt(__employeeBoard.target);
      };
      updateCamera(); camera.updateMatrixWorld(true);
      // Prove rendered corner colors. Single sample per corner, all eight surfaces.
      const rt = new T.WebGLRenderTarget(1600, 1000), pixel = new Uint8Array(4);
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      for (const entry of surfaces) {
        const mesh = board.getObjectByName(entry.name), a = mesh.geometry.attributes.position;
        const width = entry.name.startsWith('Photo') ? .48 : .60, height = entry.name.startsWith('Photo') ? .64 : .15;
        for (const [x, y] of [[-.46, .43], [.46, .43], [-.46, -.43], [.46, -.43]]) {
          const point = mesh.localToWorld(new T.Vector3(x * width, y * height, a.getZ(0))).project(camera);
          renderer.readRenderTargetPixels(rt, Math.floor((point.x + 1) / 2 * 1600), Math.floor((point.y + 1) / 2 * 1000), 1, 1, pixel);
          entry.corners.push([...pixel]);
        }
      }
      renderer.setRenderTarget(null); rt.dispose();
      return {renderer: gpu, size: size.toArray(), front: '+Z', canvasTextureFlipY: false,
        portraits: names, surfaces, expectedCorners: [[231, 53, 53], [38, 212, 71], [39, 100, 232], [244, 220, 38]]};
    });
    assert.match(audit.renderer, /AMD.*Vulkan|Vulkan.*AMD/);
    assert.doesNotMatch(audit.renderer, /SwiftShader|llvmpipe/i);
    assert.ok(Math.abs(audit.size[0] - 3.2) < .001 && Math.abs(audit.size[1] - 2.6) < .001);
    assert.equal(new Set(audit.surfaces.map(s => s.material)).size, 8);
    for (const s of audit.surfaces) s.corners.forEach((color, j) =>
      color.slice(0, 3).forEach((v, k) => assert.ok(Math.abs(v - audit.expectedCorners[j][k]) < 12,
        `${s.name} corner ${j} channel ${k}: ${v} != ${audit.expectedCorners[j][k]}`)));
    await page.waitForTimeout(200);
    await page.screenshot({path: path.join(OUT, 'front-uv.png')});
    await page.evaluate(() => { __employeeBoard.distance = 10; });
    await page.waitForTimeout(200);
    await page.screenshot({path: path.join(OUT, 'yard-10m.png')});
    assert.deepEqual(errors, []);
    audit.cornerPixelsVerified = 32;
    fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
    console.log(`EmployeeBoard game review: ${audit.renderer}; 32 canvas corner pixels correct; front and 10 m screenshots saved.`);
  } finally {
    if (b) await b.close();
    const exited = new Promise(resolve => server.once('exit', resolve));
    if (server.exitCode === null) { server.kill(); await exited; }
    fs.rmSync(data, {recursive: true, force: true});
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
