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
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const hand = gltf.scene.getObjectByName('CGLCamper_L_Hand');
  const rearHand = gltf.scene.getObjectByName('CGLCamper_R_Hand');
  const shaft = gltf.scene.getObjectByName('CGLCamper_R_ShovelShaft');
  const blade = gltf.scene.getObjectByName('CGLCamper_R_ShovelBlade');
  for (const mesh of [hand, rearHand]) mesh.geometry.computeBoundingBox();
  const center = mesh => mesh.localToWorld(mesh.geometry.boundingBox.getCenter(new THREE.Vector3()));
  function sample(time) {
    action.enabled = true;
    action.paused = false;
    mixer.setTime(time);
    gltf.scene.updateMatrixWorld(true);
    return {front: center(hand), rear: center(rearHand),
      grip: shaft.localToWorld(new THREE.Vector3(0, .27, 0)),
      tip: blade.localToWorld(new THREE.Vector3(0, -.36, 0)),
      normal: new THREE.Vector3(0, 0, 1).transformDirection(blade.matrixWorld)};
  }
  const torso = gltf.scene.getObjectByName('CGLCamper_Torso');
  const sleeve = gltf.scene.getObjectByName('CGLCamper_L_Sleeve');
  const torsoPosition = torso.geometry.attributes.position;
  const torsoIndex = torso.geometry.index.array;
  const planes = [];
  for (let i = 0; i < torsoIndex.length; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(torsoPosition, torsoIndex[i]);
    const b = new THREE.Vector3().fromBufferAttribute(torsoPosition, torsoIndex[i + 1]);
    const c = new THREE.Vector3().fromBufferAttribute(torsoPosition, torsoIndex[i + 2]);
    const normal = b.sub(a).cross(c.sub(a)).normalize();
    if (normal.lengthSq() > .5) planes.push([normal.x, normal.y, normal.z, normal.dot(a)]);
  }
  // Shift each face plane outward to contain every torso vertex. This also
  // covers slightly non-planar bevel quads with a conservative convex envelope.
  for (const plane of planes) {
    for (let i = 0; i < torsoPosition.count; i++) {
      plane[3] = Math.max(plane[3], plane[0] * torsoPosition.getX(i) +
        plane[1] * torsoPosition.getY(i) + plane[2] * torsoPosition.getZ(i));
    }
  }
  // Confirm the entire torso mesh lies inside the supporting half-spaces.
  for (const [x, y, z, d] of planes) {
    for (let i = 0; i < torsoPosition.count; i++) {
      assert.ok(x * torsoPosition.getX(i) + y * torsoPosition.getY(i) +
        z * torsoPosition.getZ(i) - d < 1e-5, 'torso lies inside each supporting plane');
    }
  }
  let minSeparatingClearance = Infinity;
  function checkClearance(mesh, time) {
    const position = mesh.geometry.attributes.position;
    const index = mesh.geometry.index.array;
    const transform = new THREE.Matrix4().copy(torso.matrixWorld).invert().multiply(mesh.matrixWorld);
    const vertex = new THREE.Vector3();
    const distances = Array.from({length: position.count}, (_, i) => {
      vertex.fromBufferAttribute(position, i);
      if (mesh.isSkinnedMesh) mesh.boneTransform(i, vertex);
      vertex.applyMatrix4(transform);
      return planes.map(([x, y, z, d]) => x * vertex.x + y * vertex.y + z * vertex.z - d);
    });
    for (let i = 0; i < index.length; i += 3) {
      const a = distances[index[i]], b = distances[index[i + 1]], c = distances[index[i + 2]];
      let separatingClearance = -Infinity;
      for (let p = 0; p < planes.length; p++) {
        separatingClearance = Math.max(separatingClearance, Math.min(a[p], b[p], c[p]));
      }
      assert.ok(separatingClearance > .005,
        `${mesh.name} triangle ${i/3} at ${time}s: no torso separating plane with 5mm clearance (${separatingClearance})`);
      minSeparatingClearance = Math.min(minSeparatingClearance, separatingClearance);
    }
  }
  let maxGripError = 0;
  // Quarter-frame samples also exercise interpolation between baked poses.
  for (let frame = 0; frame <= 180; frame++) {
    const pose = sample(frame / 120);
    maxGripError = Math.max(maxGripError, pose.front.distanceTo(pose.grip));
    checkClearance(sleeve, frame / 120);
    checkClearance(hand, frame / 120);
  }
  assert.ok(maxGripError < .02, `left hand stays within 2cm of fixed shaft grip: ${maxGripError}`);
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
        if (old.name === 'Scoop' && /^(armL|forearmL)\./.test(oldTrack.name)) continue;
        const track = current.tracks.find(t => t.name === oldTrack.name);
        assert.ok(track, `${old.name}: ${oldTrack.name} preserved`);
        for (const field of ['times', 'values']) {
          assert.equal(track[field].length, oldTrack[field].length);
          for (let i = 0; i < track[field].length; i++) close(track[field][i], oldTrack[field][i], `${old.name}: ${oldTrack.name}.${field}[${i}]`);
        }
      }
    }
    console.log('All legacy clips and all non-left-arm Scoop tracks match baseline (tolerance 1e-5).');
  }
  console.log(`GLTFLoader torso clearance: every sleeve/hand triangle separated at all 181 quarter-frame samples; conservative lower bound ${(minSeparatingClearance * 100).toFixed(2)}cm.`);
  console.log(`GLTFLoader: Scoop ${clip.duration}s; max left grip error ${(maxGripError * 100).toFixed(2)}cm; plant, lever, level hold, side dump and loop verified.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
