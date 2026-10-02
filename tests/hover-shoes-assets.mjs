import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const bytes = fs.readFileSync(new URL('public/models/footwear/hover-shoes.glb', root));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
assert.ok(bytes.equals(fs.readFileSync(new URL('art/blender/glb/hover-shoes.glb', root))));
const len = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + len));
const bin = bytes.subarray(28 + len);
function read(index) {
  const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
  const size = {SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16}[a.type];
  const [width, method] = {5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5126: [4, 'readFloatLE']}[a.componentType];
  return Array.from({length: a.count}, (_, n) => Array.from({length: size}, (_, k) =>
    bin[method]((v.byteOffset || 0) + (a.byteOffset || 0) + n * (v.byteStride || size * width) + k * width)));
}
assert.equal(gltf.scenes.length, 1);
assert.ok(!gltf.animations?.length && !gltf.cameras?.length);
assert.ok(!gltf.extensions?.KHR_lights_punctual);
const meshes = gltf.nodes.filter(n => n.mesh != null);
assert.equal(meshes.length, 2, 'one material-grouped mesh per foot');
assert.deepEqual(meshes.map(n => n.extras.side).sort(), ['L', 'R']);
const bounds = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
let triangles = 0;
for (const n of meshes) {
  assert.equal(n.extras.slot, 'footwear');
  assert.equal(n.extras.cosmeticOnly, true);
  assert.ok(n.name.startsWith('HoverShoes_') && n.skin != null);
  assert.ok(!n.translation?.some(v => v !== 0), 'vertices already in bind space');
  const bones = gltf.skins[n.skin].joints.map(j => gltf.nodes[j].name);
  for (const p of gltf.meshes[n.mesh].primitives) {
    triangles += gltf.accessors[p.indices].count / 3;
    const weights = read(p.attributes.WEIGHTS_0), joints = read(p.attributes.JOINTS_0);
    weights.forEach((w, i) => {
      assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-6);
      w.forEach((v, k) => { if (v > 1e-6) assert.equal(bones[joints[i][k]], 'shin.' + n.extras.side); });
    });
    for (const v of read(p.attributes.POSITION)) {
      v.forEach((value, i) => { bounds[i][0] = Math.min(bounds[i][0], value); bounds[i][1] = Math.max(bounds[i][1], value); });
      assert.ok(Math.abs(v[0]) < .31 && Math.abs(v[2]) < .27);
      assert.ok(n.extras.side === 'L' ? v[0] < 0 : v[0] > 0, 'correct bind-space side');
    }
  }
}
assert.ok(Math.abs(bounds[1][0]) < .002, 'authoring floor stays at zero; runtime supplies hover offset');
assert.ok(bounds[1][1] < .25, 'low sneaker collar below the knee');
assert.ok(triangles < 10000);
const glow = gltf.materials.filter(m => m.emissiveFactor?.some(v => v > 0));
assert.deepEqual(glow.map(m => m.name).sort(), ['cgl_hover_sole_cyan', 'cgl_hover_thruster_cyan']);
for (const m of glow) assert.ok(m.extensions?.KHR_materials_emissive_strength?.emissiveStrength >= 2);
const meta = JSON.parse(fs.readFileSync(new URL('art/blender/glb/hover-shoes.json', root)));
assert.equal(meta.sourceCamperSHA256, createHash('sha256').update(fs.readFileSync(new URL('public/models/camper.glb', root))).digest('hex'));
assert.deepEqual(meta.bones, ['shin.L', 'shin.R']);
assert.deepEqual(meta.emissiveMaterials.sort(), glow.map(m => m.name).sort());
console.log(`Hover shoes: ${bytes.length} bytes, ${triangles} triangles, paired bind-space shin skins, floor contact, low collars, two emissive materials and identical authoring/public copies OK.`);
