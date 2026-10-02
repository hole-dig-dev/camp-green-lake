/* Upgrade geometry contracts, original-shin weights and exported clip timing. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir=new URL('../',import.meta.url);
export const names=['Dynamite','DynamiteHeld','LooseSand','Scarecrow','Dog','DisarmKit','GravityBoots','GrappleHook','GrappleHookHead','GoldScale','PipePump','PipeSectionSteel'];
function glb(path){
 const b=fs.readFileSync(new URL(path,dir));assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
 const len=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+len)),bin=b.subarray(28+len);
 function read(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
  const [bytes,fn]={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];
  return Array.from({length:a.count},(_,n)=>Array.from({length:size},(_,k)=>bin[fn]((v.byteOffset||0)+(a.byteOffset||0)+n*(v.byteStride||size*bytes)+k*bytes)));
 }
 const positions=g.meshes.flatMap(m=>m.primitives.flatMap(p=>read(p.attributes.POSITION)));
 const bounds=[0,1,2].map(i=>[Math.min(...positions.map(p=>p[i])),Math.max(...positions.map(p=>p[i]))]);
 return {g,read,bounds,b};
}
const models=Object.fromEntries(names.map(n=>{
 const file=n==='GravityBoots'?'footwear/gravity-boots.glb':n+'.glb',a=glb('art/blender/glb/'+n+'.glb');
 assert.ok(a.b.equals(fs.readFileSync(new URL('public/models/'+file,dir))),'source/public exports agree');
 assert.equal(a.g.scenes.length,1);assert.ok(!a.g.cameras?.length);return[n,a];
}));
const near=(v,w)=>assert.ok(Math.abs(v-w)<.002,`${v} != ${w}`);
const ground=n=>near(models[n].bounds[1][0],0);
for(const n of ['Dynamite','LooseSand','Scarecrow','Dog','GravityBoots','GoldScale','PipePump'])ground(n);
near(models.Dynamite.bounds[1][1],.249);
near(models.LooseSand.bounds[1][1],.45);assert.ok(models.LooseSand.bounds[0][1]>1.5);
for(const m of models.LooseSand.g.meshes)for(const p of m.primitives){
 const vertices=models.LooseSand.read(p.attributes.POSITION),indices=models.LooseSand.read(p.indices).flat();
 for(let i=0;i<indices.length;i+=3){
  const [a,b,c]=indices.slice(i,i+3).map(k=>vertices[k]);
  if(Math.max(a[1],b[1],c[1])>.17){
   const normalY=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
   assert.ok(normalY>=-1e-7,'pile top winding faces up for the game FrontSide material');
  }
 }
}
assert.ok(models.Scarecrow.bounds[1][1]>2.19&&models.Scarecrow.bounds[1][1]<2.22);
for(const [i,h]of [0,.1,0].entries())near(models.DynamiteHeld.bounds[i][0],models.Dynamite.bounds[i][0]-h);
assert.ok(models.GrappleHookHead.bounds[0][1]>.24&&models.GrappleHookHead.bounds[0][0]>-.005);
assert.ok(models.GoldScale.bounds[0][0]>1.23&&models.GoldScale.bounds[0][1]<1.97);
assert.ok(models.GoldScale.bounds[2][0]>-.97&&models.GoldScale.bounds[2][1]<-.44);
assert.ok(models.PipePump.bounds[0][1]<-1.95&&models.PipePump.bounds[0][0]>-2.61);
const steel=models.PipeSectionSteel;near(steel.bounds[0][0],0);near(steel.bounds[0][1],1);near(steel.bounds[1][0],.12);near(steel.bounds[1][1],.36);
assert.ok(steel.g.materials.some(m=>m.alphaMode==='BLEND'&&m.pbrMetallicRoughness.baseColorFactor[3]<.2));
const dog=models.Dog;
assert.equal(dog.g.skins[0].joints.length,14);
const expected={Idle:2,Walk:1,Run:.5,Sniff:2,Bark:1,Sit:2};
assert.deepEqual(dog.g.animations.map(a=>a.name).sort(),Object.keys(expected).sort());
for(const a of dog.g.animations){
 const times=a.samplers.flatMap(s=>dog.read(s.input).flat());near(Math.min(...times),0);near(Math.max(...times),expected[a.name]);
 assert.ok(a.channels.length>5);assert.ok(a.samplers.some(s=>new Set(dog.read(s.output).map(v=>v.join(','))).size>2),'clip has motion');
}
const boots=models.GravityBoots,nodes=boots.g.nodes.filter(n=>n.mesh!=null);
assert.deepEqual([...new Set(nodes.map(n=>n.extras.side))].sort(),['L','R']);assert.ok(!boots.g.animations?.length);
for(const n of nodes){
 assert.equal(n.extras.slot,'footwear');assert.ok(n.skin!=null);
 const bones=boots.g.skins[n.skin].joints.map(j=>boots.g.nodes[j].name);
 for(const p of boots.g.meshes[n.mesh].primitives){
  const ws=boots.read(p.attributes.WEIGHTS_0),js=boots.read(p.attributes.JOINTS_0);
  ws.forEach((w,i)=>{near(w.reduce((a,b)=>a+b,0),1);w.forEach((v,k)=>{if(v>1e-6)assert.equal(bones[js[i][k]],'shin.'+n.extras.side)})});
 }
}
assert.ok(boots.bounds[1][1]<.50&&boots.bounds[0][0]>-.31&&boots.bounds[0][1]<.31);
const meta=JSON.parse(fs.readFileSync(new URL('art/blender/glb/GravityBoots.json',dir)));
assert.equal(meta.sourceCamperSHA256,createHash('sha256').update(fs.readFileSync(new URL('public/models/camper.glb',dir))).digest('hex'));
console.log('12 upgrade exports: frames, dimensions, transparent pipe, 14-bone dog/six exact clips, original-shin boots and matching public copies OK.');
