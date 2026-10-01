import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base=new URL('../public/',import.meta.url),list=JSON.parse(fs.readFileSync(new URL('footwear-lab/manifest.json',base))),hash=createHash('sha256').update(fs.readFileSync(new URL('models/camper.glb',base))).digest('hex');
assert.equal(list.length,20);assert.equal(new Set(list.map(d=>d.slug)).size,20);assert.equal(list.filter(d=>d.group==='Shoes').length,10);assert.equal(list.filter(d=>d.group==='Boots').length,10);
for(const [i,d]of list.entries()){
 assert.equal(d.id,i+1);assert.equal(d.slot,'footwear');assert.ok(d.cosmeticOnly);assert.equal(d.sourceCamperSHA256,hash);
 const bytes=fs.readFileSync(new URL(d.file,new URL('footwear-lab/',base)));assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jl=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jl)),bin=bytes.subarray(28+jl);assert.equal(g.scenes.length,1);assert.ok(!g.animations?.length,'use original camper clips');
 const nodes=g.nodes.filter(n=>n.mesh!=null);assert.ok(nodes.every(n=>n.skin!=null&&n.extras.slot==='footwear'));assert.deepEqual([...new Set(nodes.map(n=>n.extras.side))].sort(),['L','R']);assert.ok(nodes.every(n=>!/(FitReference|CGLCamper|_(Head|Hand|Sleeve|Leg)(_|$))/.test(n.name)));
 function read(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type],[len,fn]={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];return Array.from({length:a.count},(_,n)=>Array.from({length:size},(_,k)=>bin[fn]((v.byteOffset||0)+(a.byteOffset||0)+n*(v.byteStride||size*len)+k*len)))}
 let triangles=0,minY=Infinity,maxY=-Infinity;
 for(const n of nodes){const bones=g.skins[n.skin].joints.map(j=>g.nodes[j].name);for(const p of g.meshes[n.mesh].primitives){triangles+=g.accessors[p.indices].count/3;const ws=read(p.attributes.WEIGHTS_0),js=read(p.attributes.JOINTS_0);ws.forEach((w,i)=>{assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-5);for(let k=0;k<4;k++)if(w[k]>1e-6)assert.equal(bones[js[i][k]],'shin.'+n.extras.side,'all components follow their own original shin')});for(const v of read(p.attributes.POSITION)){minY=Math.min(minY,v[1]);maxY=Math.max(maxY,v[1]);assert.ok(Math.abs(v[0])<.31&&Math.abs(v[2])<.27,'bounded original foot footprint')}}}
 assert.ok(Math.abs(minY)<.002,'soles remain on original ground plane');assert.ok(maxY<.50,'boot uppers remain below original knee');assert.ok(triangles<22000);
}
console.log('Footwear assets: 20 paired exports, 10 shoes + 10 boots, normalized original shin weights, floor contact, knee clearance, bounded footprint and no replacement body or clips.');
