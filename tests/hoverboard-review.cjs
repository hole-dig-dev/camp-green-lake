/* Reproducible asset placement in the real game; client source stays unchanged. */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const {browser, player} = require('./carry/lib.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'art/blender/renders/hoverboard-game');
const freePort = () => new Promise(resolve => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});

(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const data = fs.mkdtempSync(path.join(ROOT, '.hoverboard-review-'));
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
    const page = await player(b, port, 'Hoverboard review', errors);
    await page.setViewportSize({width: 1600, height: 1000});
    await page.addStyleTag({content: 'body > :not(#game) { visibility: hidden !important; }'});
    const audit = await page.evaluate(async () => {
      GOD = true; crewPanelOn = false; window.lsPlan = () => null;
      window.updateHaboob = () => {}; window.nightF = () => 0;
      const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
      const loaded = await new Promise((resolve, reject) => new T.GLTFLoader().load('models/Hoverboard.glb', resolve, undefined, reject));
      const board = loaded.scene, localBounds = new T.Box3().setFromObject(board);
      const materials = [];
      board.traverse(n => {
        if (!n.isMesh) return;
        n.material = gameMat(n.material); n.castShadow = !n.material.transparent; n.receiveShadow = true;
        if (n.material.emissive?.getHex()) materials.push({name:n.material.name,
          emissive:n.material.emissive.toArray(), intensity:n.material.emissiveIntensity,
          opacity:n.material.opacity, transparent:n.material.transparent});
      });
      const x = -19.5, z = 38.5, ground = baseH(x,z), top = ground + .0969;
      board.position.set(x,top,z); scene.add(board);
      const rider = makePerson({skin:SKIN_TONES[2],band:CAMPER_COLORS[1],hat:'bucket',body:'average',shovel:false});
      rider.g.rotation.y = Math.PI/2; // Skate-style stance, feet along the deck's length.
      rider.g.position.set(x,top,z); scene.add(rider.g);
      setClip(rider,'Idle',0); stepMixer(rider,.3);
      rider.g.updateMatrixWorld(true);
      const feet = [];
      rider.model.traverse(n => {
        if (n.isMesh && /Sneaker|Shoe|Foot/.test(n.name) && n.visible) {
          const box = new T.Box3().setFromObject(n);
          feet.push({name:n.name,min:box.min.toArray(),max:box.max.toArray()});
        }
      });
      // Align the character's actual sneaker soles with the standing surface.
      if (feet.length) rider.g.position.y += top - Math.min(...feet.map(f=>f.min[1]));
      rider.g.updateMatrixWorld(true);
      const target = new T.Vector3(x,top+.65,z);
      window.__hoverReview = {board,rider,target,ground,top,mode:'rider',distance:3.1,x,z};
      const viewDirection = distance => distance===15
        ? new T.Vector3(1,.08,0).normalize() : new T.Vector3(.68,.16,.72).normalize();
      P.x=x+1.8; P.z=z+2; P.y=groundAt(P.x,P.z);
      window.updateCamera = () => {
        me.g.visible=false;
        const q=__hoverReview;
        if(q.mode==='detail') {
          camera.position.set(q.x+1.05,q.top+.22,q.z+1.2); camera.lookAt(q.x,q.top-.02,q.z);
        } else if(q.mode==='underside') {
          camera.position.set(q.x+.7,q.top-.38,q.z+.6);camera.lookAt(q.x,q.top-.03,q.z);
        } else {
          const direction=viewDirection(q.distance);
          camera.position.copy(q.target).addScaledVector(direction,q.distance); camera.lookAt(q.target);
        }
      };
      updateCamera(); camera.updateMatrixWorld(true);
      const footBoxes=[];
      rider.model.traverse(n=>{if(n.isMesh&&/Sneaker|Shoe|Foot/.test(n.name)&&n.visible){
        const box=new T.Box3().setFromObject(n);
        footBoxes.push({name:n.name,min:box.min.toArray(),max:box.max.toArray()});
      }});
      // Projected board footprint at an actual 15 m camera distance.
      const saved=camera.position.clone();
      camera.position.copy(target).addScaledVector(viewDirection(15),15);
      camera.lookAt(target);camera.updateMatrixWorld(true);
      const points=[];
      for(const xx of[-.16,.16])for(const yy of[-.082,0])for(const zz of[-.475,.475])
        points.push(new T.Vector3(x+xx,top+yy,z+zz).project(camera));
      const pixelWidth=(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*800;
      camera.position.copy(saved);camera.lookAt(target);camera.updateMatrixWorld(true);
      return {renderer:gpu,localBounds:[localBounds.min.toArray(),localBounds.max.toArray()],
        materials,deckTopWorldY:top,solidClearanceM:top-.0715-ground,
        stance:'skate-style',feet:footBoxes,boardProjectedWidthAt15mPx:pixelWidth,
        reviewOnlyPlacement:true};
    });
    assert.match(audit.renderer,/AMD.*Vulkan|Vulkan.*AMD/);
    assert.doesNotMatch(audit.renderer,/SwiftShader|llvmpipe/i);
    assert.ok(Math.abs(audit.localBounds[1][1])<1e-6,'top at local Y=0');
    assert.ok(Math.abs(audit.solidClearanceM-.0254)<1e-6,'one inch beneath solid pads');
    assert.equal(new Set(audit.materials.map(m=>m.name)).size,4,'four emissive game materials');
    assert.ok(audit.boardProjectedWidthAt15mPx>35,'readable 15 m footprint');
    assert.ok(audit.feet.length>=2,'actual camper sneakers found');
    assert.ok(Math.abs(Math.min(...audit.feet.map(f=>f.min[1]))-audit.deckTopWorldY)<1e-5,'soles on deck');
    for(const f of audit.feet){
      assert.ok(f.min[0]>=-19.5-.161&&f.max[0]<=-19.5+.161,'feet fit board width');
      assert.ok(f.min[2]>=38.5-.475&&f.max[2]<=38.5+.475,'feet fit board length');
    }
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(OUT,'camper.png')});
    await page.evaluate(()=>{__hoverReview.mode='detail';__hoverReview.rider.g.visible=false;});
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(OUT,'deck-clearance.png')});
    await page.evaluate(()=>{__hoverReview.mode='rider';__hoverReview.rider.g.visible=true;__hoverReview.distance=15;});
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(OUT,'yard-15m.png')});
    await page.evaluate(()=>{
      const q=__hoverReview;
      const h=addHole({x:q.x,z:q.z,d:FIVE_FT,r:1.25,noMound:true});touchHole(h);
      updateHoleLiners(.3);q.distance=4.4;
    });
    await page.waitForTimeout(400);
    await page.screenshot({path:path.join(OUT,'over-dug-hole.png')});
    await page.evaluate(()=>{__hoverReview.mode='underside';});
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(OUT,'thrusters-over-hole.png')});
    await page.evaluate(()=>{__hoverReview.mode='rider';window.nightF=()=>1;runCommand('time 23:00');});
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(OUT,'night-hover.png')});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(OUT,'audit.json'),JSON.stringify(audit,null,2)+'\n');
    console.log(`Hoverboard: ${audit.renderer}; emission, foot fit, one-inch pad clearance and 15 m footprint verified.`);
  } finally {
    if(b)await b.close();
    if(server.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill();await exited;}
    fs.rmSync(data,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
