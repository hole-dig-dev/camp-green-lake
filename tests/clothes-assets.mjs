// Inspect exported geometry/weights, including all material splits, to catch broken continuous garment joints.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base=new URL('../public/',import.meta.url),list=JSON.parse(fs.readFileSync(new URL('clothes-lab/manifest.json',base)));
assert.equal(list.length,20);assert.equal(new Set(list.map(d=>d.slug)).size,20);
const sourceHash=createHash('sha256').update(fs.readFileSync(new URL('models/camper.glb',base))).digest('hex');
for(const [i,d]of list.entries()){
 assert.equal(d.id,i+1);assert.equal(d.head,'unchanged');assert.ok(d.cosmeticOnly&&d.continuousSkinning);assert.deepEqual(d.slots,['torso','arms','legs']);assert.equal(d.sourceCamperSHA256,sourceHash,'rebuild outfits if the base bind geometry changes');
 const bytes=fs.readFileSync(new URL(d.file,new URL('clothes-lab/',base)));assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jl=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jl)),bin=bytes.subarray(28+jl);
 assert.equal(g.scenes.length,1);assert.ok(!g.animations?.length,'use camper animation clips');assert.ok(g.skins.length>=1);
 const nodes=g.nodes.filter(n=>n.mesh!=null);assert.ok(nodes.every(n=>n.skin!=null&&d.slots.includes(n.extras.slot)),'every garment is assigned and skinned');assert.ok(nodes.every(n=>!/(FitReference|CGLCamper|Head|Nose|Hand|Shoe)/.test(n.name)),'no body or accessory replacement exports');
 const names=new Set(g.skins.flatMap(s=>s.joints.map(j=>g.nodes[j].name)));assert.deepEqual([...names].sort(),['root','hips','spine','head','arm.L','arm.R','forearm.L','forearm.R','leg.L','leg.R','shin.L','shin.R'].sort());
 function accessor(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type];const [len,read]={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];return Array.from({length:a.count},(_,n)=>Array.from({length:size},(_,k)=>bin[read]((v.byteOffset||0)+(a.byteOffset||0)+n*(v.byteStride||size*len)+k*len)))}
 let triangles=0;
 for(const node of nodes){const jointNames=g.skins[node.skin].joints.map(j=>g.nodes[j].name);for(const p of g.meshes[node.mesh].primitives){triangles+=g.accessors[p.indices].count/3;const weights=accessor(p.attributes.WEIGHTS_0);weights.forEach(w=>assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-5,'normalized weights'))}}
 assert.ok(triangles<18000);
 const limbs=nodes.filter(n=>/_[LR]_(Sleeve|Leg)$/.test(n.name));assert.equal(limbs.length,4);
 for(const node of limbs){
  const side=node.name.includes('_L_')?'L':'R',arm=node.name.endsWith('Sleeve'),pair=[(arm?'arm.':'leg.')+side,(arm?'forearm.':'shin.')+side],jointNames=g.skins[node.skin].joints.map(j=>g.nodes[j].name);
  const unique=new Map(),edges=new Map(),neighbors=[];let blended=0;
  for(const p of g.meshes[node.mesh].primitives){
   const positions=accessor(p.attributes.POSITION),weights=accessor(p.attributes.WEIGHTS_0),joints=accessor(p.attributes.JOINTS_0),indices=accessor(p.indices).flat();
   weights.forEach((w,i)=>{const used=w.map((v,k)=>v>1e-6?jointNames[joints[i][k]]:null).filter(Boolean);assert.ok(used.every(n=>pair.includes(n)));if(used.length===2)blended++});
   const map=positions.map(v=>{const key=v.map(x=>Math.round(x*1e6)).join(',');if(!unique.has(key)){unique.set(key,unique.size);neighbors.push(new Set())}return unique.get(key)});
   for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3).map(v=>map[v]);if(new Set(tri).size<3)continue;for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],key=[a,b].sort((x,y)=>x-y).join(',');edges.set(key,(edges.get(key)||0)+1);neighbors[a].add(b);neighbors[b].add(a)}}
  }
  assert.ok(blended>70,'blended rings span each joint');assert.ok([...edges.values()].every(n=>n===2),'closed continuous garment surface');const seen=new Set([0]),queue=[0];for(const n of queue)for(const next of neighbors[n])if(!seen.has(next)){seen.add(next);queue.push(next)}assert.equal(seen.size,unique.size,'one connected limb surface');
 }
}
console.log('Clothing assets: 20 modular outfits, 80 connected closed limb skins, normalized blended weights, compatible camper bones, no head or animation replacements.');
