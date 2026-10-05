// Load the shipped GLB using the same three.js / GLTFLoader as the wardrobe lab.
// Optional baseline: node tests/camper-scoop.cjs /path/to/pre-change/camper.glb
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '..');
global.THREE = require(path.join(repo, 'public/hat-lab/vendor/three.min.js'));
vm.runInThisContext(fs.readFileSync(path.join(repo, 'public/hat-lab/vendor/GLTFLoader.js'), 'utf8'));
function load(file) {
  const bytes = fs.readFileSync(file);
  return new Promise((resolve, reject) => new THREE.GLTFLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));
}
function close(a, b, message, tolerance = 1e-5) {
  assert.ok(Math.abs(a - b) < tolerance, `${message}: ${a} vs ${b}`);
}
(async () => {
  const gltf = await load(path.join(repo, 'public/models/camper.glb'));
  const clip = gltf.animations.find(a => a.name === 'Scoop');
  assert.ok(clip, 'GLTFLoader lists Scoop');
  close(clip.duration, 1.5, '45 frame intervals at 30fps');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play();
  const hand = gltf.scene.getObjectByName('CGLCamper_L_Hand');
  const rearHand = gltf.scene.getObjectByName('CGLCamper_R_Hand');
  const shaft = gltf.scene.getObjectByName('CGLCamper_R_ShovelShaft');
  const blade = gltf.scene.getObjectByName('CGLCamper_R_ShovelBlade');
  for (const mesh of [hand, rearHand]) mesh.geometry.computeBoundingBox();
  const center = mesh => mesh.localToWorld(mesh.geometry.boundingBox.getCenter(new THREE.Vector3()));
  function sample(time) {
    mixer.setTime(time);
    gltf.scene.updateMatrixWorld(true);
    return {front: center(hand), rear: center(rearHand),
      grip: shaft.localToWorld(new THREE.Vector3(0, .27, 0)),
      tip: blade.localToWorld(new THREE.Vector3(0, -.36, 0)),
      normal: new THREE.Vector3(0, 0, 1).transformDirection(blade.matrixWorld)};
  }
  let maxGripError = 0;
  // Half-frame samples also exercise interpolation between baked poses.
  for (let frame = 0; frame < 90; frame++) {
    const pose = sample(frame / 60);
    maxGripError = Math.max(maxGripError, pose.front.distanceTo(pose.grip));
  }
  assert.ok(maxGripError < .03, `left hand stays within 3cm of fixed shaft grip: ${maxGripError}`);
  const ready = sample(0), planted = sample(8/30), levered = sample(16/30);
  assert.ok(planted.tip.y < .07 && planted.tip.y > -.03, 'blade plants at ground');
  assert.ok(planted.tip.z > ready.tip.z + .2, 'plant drives blade forward');
  assert.ok(levered.rear.y < planted.rear.y - .04, 'rear grip pushes down to lever');
  assert.ok(levered.tip.y > planted.tip.y + .25, 'lever tips blade upward');
  assert.ok(Math.abs(levered.tip.z - planted.tip.z) < .15, 'lever pivots near planted blade');
  const loaded = sample(25/30), held = sample(28/30), tossed = sample(35/30);
  assert.ok(loaded.normal.y > .999, 'loaded blade is level, concave face up');
  assert.ok(loaded.tip.y > 1.1 && loaded.tip.y < 1.5, 'waist height carry');
  assert.ok(loaded.tip.distanceTo(held.tip) < 1e-5, 'loaded pose holds still');
  assert.ok(tossed.tip.x > loaded.tip.x + .8, 'toss swings to camper right');
  assert.ok(tossed.normal.y < .25, 'blade rolls sideways to dump');
  for (const track of clip.tracks) {
    const size = track.getValueSize();
    for (let i = 0; i < size; i++) close(track.values[i], track.values[track.values.length - size + i], `${track.name}: loop endpoints`);
  }
  if (process.argv[2]) {
    const before = await load(process.argv[2]);
    for (const old of before.animations) {
      const current = gltf.animations.find(a => a.name === old.name);
      assert.ok(current, `${old.name} preserved`);
      close(current.duration, old.duration, `${old.name} duration unchanged`);
      assert.equal(current.tracks.length, old.tracks.length, `${old.name} track count`);
      for (const oldTrack of old.tracks) {
        const track = current.tracks.find(t => t.name === oldTrack.name);
        assert.ok(track, `${old.name}: ${oldTrack.name} preserved`);
        for (const field of ['times', 'values']) {
          assert.equal(track[field].length, oldTrack[field].length);
          for (let i = 0; i < track[field].length; i++) close(track[field][i], oldTrack[field][i], `${old.name}: ${oldTrack.name}.${field}[${i}]`);
        }
      }
    }
    console.log('All 13 legacy clips match baseline tracks and timing (tolerance 1e-5).');
  }
  console.log(`GLTFLoader: Scoop ${clip.duration}s; max left grip error ${(maxGripError * 100).toFixed(2)}cm; plant, lever, level hold, side dump and loop verified.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
