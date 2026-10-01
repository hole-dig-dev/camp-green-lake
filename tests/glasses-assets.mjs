import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../public/',import.meta.url),list=JSON.parse(fs.readFileSync(new URL('glasses-lab/manifest.json',base)));
assert.equal(list.length,20);assert.equal(new Set(list.map(d=>d.slug)).size,20);
const hats=JSON.parse(fs.readFileSync(new URL('hat-lab/manifest.json',base)));
assert.equal(hats.length,20);assert.ok(hats.every(d=>d.approved),'JT approved the full hat library');
for(const [i,d]of list.entries()){
 assert.equal(d.id,i+1);assert.equal(d.head,'unchanged');assert.ok(d.cosmeticOnly);
 const b=fs.readFileSync(new URL(d.file,new URL('glasses-lab/',base)));
 assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
 const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 assert.equal(g.scenes.length,1);assert.ok(!g.skins?.length&&!g.animations?.length,'cosmetic face sets add no skeleton or physics');
 assert.ok(g.nodes.every(n=>!/(FitReference|Nose|Head|Rig)/.test(n.name||'')),'head and nose remain references, not replacements');
 assert.ok(g.meshes.length>=3);let triangles=0;
 for(const m of g.meshes)for(const p of m.primitives)triangles+=g.accessors[p.indices].count/3;
 assert.ok(triangles<20000,'compact eyewear geometry');
}
console.log('Glasses assets: 20 cosmetic-only sets, no head/nose/skeleton replacements; all 20 approved hats retained.');

assert.equal(list.filter(d=>d.group==='Regular').length,7);assert.equal(list.filter(d=>d.group==='Sunglasses').length,7);assert.equal(list.filter(d=>d.group==='Crazy').length,6);
assert.ok(list.every(d=>d.frontMaxHeight<.489));
const faces=JSON.parse(fs.readFileSync(new URL('face-lab/manifest.json',base)));assert.equal(faces.length,20);assert.ok(faces.every(d=>d.approved));
for(const d of list.filter(d=>d.clearLenses)){const b=fs.readFileSync(new URL(d.file,new URL('glasses-lab/',base))),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert.ok(g.materials.some(m=>m.alphaMode==='BLEND'&&m.pbrMetallicRoughness.baseColorFactor[3]<.2),'clear lenses remain transparent');}
