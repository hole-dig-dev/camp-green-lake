import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../public/',import.meta.url),list=JSON.parse(fs.readFileSync(new URL('face-lab/manifest.json',base)));
assert.equal(list.length,20);assert.equal(new Set(list.map(d=>d.slug)).size,20);
const hats=JSON.parse(fs.readFileSync(new URL('hat-lab/manifest.json',base)));
assert.equal(hats.length,20);assert.ok(hats.every(d=>d.approved),'JT approved the full hat library');
for(const [i,d]of list.entries()){
 assert.equal(d.id,i+1);assert.equal(d.head,'unchanged');assert.equal(d.nose,'original');assert.ok(d.cosmeticOnly);
 const b=fs.readFileSync(new URL(d.file,new URL('face-lab/',base)));
 assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
 const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 assert.equal(g.scenes.length,1);assert.ok(!g.skins?.length&&!g.animations?.length,'cosmetic face sets add no skeleton or physics');
 assert.ok(g.nodes.every(n=>!/(FitReference|Nose|Head|Rig)/.test(n.name||'')),'head and nose remain references, not replacements');
 assert.ok(g.meshes.length>=5);let triangles=0;
 for(const m of g.meshes)for(const p of m.primitives)triangles+=g.accessors[p.indices].count/3;
 assert.ok(triangles<8000,'small facial detail set');
}
console.log('Face assets: 20 cosmetic-only sets, no head/nose/skeleton replacements; all 20 approved hats retained.');
