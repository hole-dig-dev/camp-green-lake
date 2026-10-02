/* EmployeeBoard runtime contract: named, independently textured, front-facing quads. */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../art/blender/glb/EmployeeBoard.glb', import.meta.url));
assert.ok(source.equals(fs.readFileSync(new URL('../public/models/EmployeeBoard.glb', import.meta.url))));
assert.equal(source.toString('ascii', 0, 4), 'glTF');
assert.equal(source.readUInt32LE(4), 2);
assert.equal(source.readUInt32LE(8), source.length);
const jsonSize = source.readUInt32LE(12);
const g = JSON.parse(source.subarray(20, 20 + jsonSize));
const bin = source.subarray(28 + jsonSize);
function read(index) {
  const a = g.accessors[index], v = g.bufferViews[a.bufferView];
  const size = {SCALAR: 1, VEC2: 2, VEC3: 3}[a.type];
  const [bytes, method] = {5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE']}[a.componentType];
  return Array.from({length: a.count}, (_, i) => Array.from({length: size}, (_, k) =>
    bin[method]((v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || bytes * size) + bytes * k)));
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const names = ['EmployeeBoardBody', ...['Photo', 'Plaque'].flatMap(prefix => [1, 2, 3, 4].map(i => prefix + i))];
assert.deepEqual(g.meshes.map(m => m.name).sort(), names.sort());
assert.equal(g.scenes.length, 1);
assert.ok(!g.cameras?.length && !g.animations?.length && !g.skins?.length);
const root = g.nodes.find(n => n.name === 'EmployeeBoard');
assert.ok(root && root.children.length === 9);
assert.ok(!root.translation && !root.rotation && !root.scale);
const materials = new Set(), bounds = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
for (const node of g.nodes.filter(n => n.mesh != null)) {
  assert.ok(!node.rotation && !node.scale && !node.matrix, 'export uses game axes directly');
  const mesh = g.meshes[node.mesh], translation = node.translation || [0, 0, 0];
  for (const p of mesh.primitives) for (const pos of read(p.attributes.POSITION)) {
    pos.forEach((v, i) => { bounds[i][0] = Math.min(bounds[i][0], v + translation[i]); bounds[i][1] = Math.max(bounds[i][1], v + translation[i]); });
  }
  if (node.name === 'EmployeeBoardBody') continue;
  assert.equal(mesh.primitives.length, 1);
  const p = mesh.primitives[0], positions = read(p.attributes.POSITION), uv = read(p.attributes.TEXCOORD_0);
  assert.equal(positions.length, 4, node.name + ' has four vertices');
  assert.equal(new Set(positions.map(v => v.join(','))).size, 4);
  const indices = read(p.indices).flat();
  assert.equal(indices.length, 6, 'single quad becomes two glTF triangles');
  assert.equal(new Set(indices).size, 4);
  const width = node.name.startsWith('Photo') ? .48 : .60;
  const height = node.name.startsWith('Photo') ? .64 : .15;
  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i];
    near(Math.abs(x), width / 2); near(Math.abs(y), height / 2); near(z, 0);
    near(uv[i][0], x < 0 ? 0 : 1);
    // glTF's V origin is top-left; GLTFLoader CanvasTexture.flipY=false.
    near(uv[i][1], y > 0 ? 0 : 1);
  }
  for (const normal of read(p.attributes.NORMAL)) {
    near(normal[0], 0); near(normal[1], 0); near(normal[2], 1);
  }
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map(j => positions[j]);
    assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0, 'front winding +Z');
  }
  assert.equal(g.materials[p.material].name, node.name.toLowerCase());
  assert.ok(!materials.has(p.material), 'every canvas has its own material');
  materials.add(p.material);
  assert.equal(node.extras.canvasTextureFlipY, false);
  const slot = Number(node.name.slice(-1));
  near(translation[0], [-1.11, -.37, .37, 1.11][slot - 1]);
}
near(bounds[0][0], -1.6); near(bounds[0][1], 1.6);
near(bounds[1][0], 0); near(bounds[1][1], 2.6);
console.log(`EmployeeBoard: ${source.length} bytes; 3.2 × 2.6 m; eight independent quads, UV corners, +Z normals, origin and matching exports OK.`);
