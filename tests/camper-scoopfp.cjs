// Verify the actual camera-child asset using the game's three.js / GLTFLoader.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '..');
global.THREE = require(path.join(repo, 'public/hat-lab/vendor/three.min.js'));
vm.runInThisContext(fs.readFileSync(path.join(repo, 'public/hat-lab/vendor/GLTFLoader.js'), 'utf8'));
const bytes = fs.readFileSync(path.join(repo, 'public/models/camper-fp.glb'));
new THREE.GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', gltf => {
  try {
    assert.deepEqual(gltf.animations.map(a => a.name), ['ScoopFP']);
    const clip = gltf.animations[0];
    assert.ok(Math.abs(clip.duration - 1.5) < 1e-6);
    const meshes = [];
    gltf.scene.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
    assert.equal(meshes.length, 9, 'two sleeves, two hands, five camp shovel parts');
    for (const mesh of meshes) assert.match(mesh.name, /^CGLCamper_([LR]_(Sleeve|Hand)|R_Shovel(Blade|Shaft|Cap|Socket|Ridge))$/);
    const blade = gltf.scene.getObjectByName('CGLCamper_R_ShovelBlade');
    const shaft = gltf.scene.getObjectByName('CGLCamper_R_ShovelShaft');
    const hands = ['L', 'R'].map(side => gltf.scene.getObjectByName(`CGLCamper_${side}_Hand`));
    for (const hand of hands) hand.geometry.computeBoundingBox();
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const camera = new THREE.PerspectiveCamera(76, 16/9, .045, 200);
    camera.add(gltf.scene);
    function sample(time, pitch = 0) {
      camera.rotation.x = pitch;
      camera.updateMatrixWorld(true);
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      action.enabled = true; action.paused = false;
      mixer.setTime(time);
      camera.updateMatrixWorld(true);
      const center = hand => hand.localToWorld(hand.geometry.boundingBox.getCenter(new THREE.Vector3()));
      const grip = height => shaft.localToWorld(new THREE.Vector3(0, height, 0));
      return {left: center(hands[0]), right: center(hands[1]), frontGrip: grip(.47), rearGrip: grip(.74),
        tip: blade.localToWorld(new THREE.Vector3(0, -.36, 0)),
        bladeNormal: new THREE.Vector3(0, 0, 1).transformDirection(blade.matrixWorld)};
    }
    let nearest = Infinity, gripError = 0, worstBladeEdge = 0;
    for (const pitch of [0, -Math.PI/6]) {
      for (let frame = 0; frame <= 180; frame++) {
        const time = frame / 120;
        const pose = sample(time, pitch);
        gripError = Math.max(gripError, pose.left.distanceTo(pose.frontGrip), pose.right.distanceTo(pose.rearGrip));
        for (const mesh of meshes) {
          const position = mesh.geometry.attributes.position;
          for (let i = 0; i < position.count; i++) {
            const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
            if (mesh.isSkinnedMesh) mesh.boneTransform(i, vertex);
            vertex.applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
            nearest = Math.min(nearest, -vertex.z);
            assert.ok(-vertex.z > .045, `${mesh.name} clips the near plane at ${time}s`);
            if (mesh === blade) {
              const projected = vertex.clone().applyMatrix4(camera.projectionMatrix);
              worstBladeEdge = Math.max(worstBladeEdge, Math.abs(projected.x), Math.abs(projected.y));
              assert.ok(Math.abs(projected.x) < .98 && Math.abs(projected.y) < .98,
                `blade outside frame at ${time}s: ${projected.x},${projected.y}`);
            }
          }
        }
      }
    }
    assert.ok(gripError < .02, `both hands stay on shaft: ${gripError}m`);
    const ready = sample(0), plant = sample(8/30), lever = sample(16/30), loaded = sample(25/30), held = sample(28/30), toss = sample(35/30);
    assert.ok(plant.tip.y < ready.tip.y - .3 && plant.tip.z < ready.tip.z - .05, 'forward/down plant');
    assert.ok(lever.right.y < plant.right.y - .1 && lever.right.z > plant.right.z + .1, 'rear grip pushes down/back');
    assert.ok(lever.tip.y > plant.tip.y + .2, 'blade tips up during lever');
    assert.ok(loaded.bladeNormal.y > .999, 'level upward-facing carry blade in camera space');
    assert.ok(loaded.tip.distanceTo(held.tip) < 1e-5, 'frozen loaded hold');
    const loadedNDC = loaded.tip.clone().project(camera);
    assert.ok(loadedNDC.y < -1/3 && loadedNDC.y > -.8, 'carry blade in lower third');
    const tossNDC = toss.tip.clone().project(camera);
    assert.ok(tossNDC.x > .5, 'dump toward right edge');
    assert.ok(toss.bladeNormal.y < .2, 'sideways blade dump');
    for (const track of clip.tracks) {
      const size = track.getValueSize();
      for (let i = 0; i < size; i++) assert.ok(Math.abs(track.values[i] - track.values[track.values.length - size + i]) < 1e-5, `${track.name}: matching loop endpoints`);
    }
    console.log(`ScoopFP: 1.5s, 9 meshes, named blade; 181 quarter-frame samples at both pitches; max grip error ${(gripError*100).toFixed(2)}cm, nearest vertex ${nearest.toFixed(3)}m, maximum blade NDC edge ${worstBladeEdge.toFixed(3)}.`);
  } catch (error) { console.error(error); process.exitCode = 1; }
}, error => { console.error(error); process.exitCode = 1; });
