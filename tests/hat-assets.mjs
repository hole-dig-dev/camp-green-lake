// The hat library is a candidate set: each GLB must contain only its own head-local hat.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../public/',import.meta.url),list=JSON.parse(fs.readFileSync(new URL('hat-lab/manifest.json',base)));
assert.equal(list.length,20);assert.equal(new Set(list.map(d=>d.slug)).size,20);
for(const [i,d] of list.entries()){
  assert.equal(d.id,i+1);assert.ok(d.frontMinHeight-d.eyeLine>.073,'front edge clears the eye line');
  const b=fs.readFileSync(new URL(d.file,new URL('hat-lab/',base)));
  assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
  const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
  assert.equal(g.scenes.length,1,'export only the active hat scene, not previous candidates');
  assert.ok(g.nodes.every(n=>!n.name?.includes('FitReference')),'reference camper stays out of the hat GLB');
  assert.ok(!g.skins?.length,'hat attaches rigidly to the camper head bone');
  assert.ok(g.meshes.length>1);let triangles=0;
  for(const m of g.meshes)for(const p of m.primitives)triangles+=(g.accessors[p.indices].count/3);
  assert.ok(triangles<20000,`${d.name}: bounded geometry for phone previews`);
}
console.log('Hat assets: 20 distinct, self-contained head attachments with front eye clearance and bounded geometry.');
