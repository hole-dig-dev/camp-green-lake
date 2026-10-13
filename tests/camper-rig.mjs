// Check the exported asset, so a Blender rebuild cannot silently drop skinning or joint animation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const file=new URL('../public/models/camper.glb',import.meta.url),bytes=fs.readFileSync(file);
assert.equal(bytes.toString('ascii',0,4),'glTF');
const jsonLength=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+jsonLength));
const bin=bytes.subarray(28+jsonLength);
function accessor(i){
  const a=g.accessors[i],v=g.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type];
  const [len,read]={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];
  return Array.from({length:a.count},(_,n)=>Array.from({length:size},(_,k)=>bin[read]((v.byteOffset||0)+(a.byteOffset||0)+n*(v.byteStride||size*len)+k*len)));
}
const limbs=g.nodes.filter(n=>n.skin!=null);
assert.equal(limbs.length,4,'two continuous sleeves and two continuous trouser legs');
for(const node of limbs){
  assert.match(node.name,/_[LR]_(Sleeve|Leg)$/);
  const side=node.name.includes('_L_')?'L':'R',arm=node.name.endsWith('Sleeve');
  const pair=[(arm?'arm.':'leg.')+side,(arm?'forearm.':'shin.')+side];
  const names=g.skins[node.skin].joints.map(i=>g.nodes[i].name);
  const p=g.meshes[node.mesh].primitives[0],weights=accessor(p.attributes.WEIGHTS_0),joints=accessor(p.attributes.JOINTS_0);
  let blended=0;
  weights.forEach((w,i)=>{
    assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-5,'normalized skin weights');
    const used=w.map((v,k)=>v>1e-6?names[joints[i][k]]:null).filter(Boolean);
    assert.ok(used.every(n=>pair.includes(n)),`${node.name}: only its own two bones influence it`);
    if(used.length===2)blended++;
  });
  assert.ok(blended>70,`${node.name}: several weighted rings span the joint`);
  // glTF can split vertices for normals; weld equal positions before checking the closed surface.
  const positions=accessor(p.attributes.POSITION),unique=new Map(),map=positions.map(v=>{
    const key=v.map(x=>Math.round(x*1e6)).join(',');if(!unique.has(key))unique.set(key,unique.size);return unique.get(key);
  });
  const indices=accessor(p.indices).flat(),edges=new Map(),neighbors=Array.from({length:unique.size},()=>new Set());
  for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3).map(v=>map[v]);if(new Set(tri).size<3)continue;
    for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],key=[a,b].sort((x,y)=>x-y).join(',');edges.set(key,(edges.get(key)||0)+1);neighbors[a].add(b);neighbors[b].add(a)}
  }
  assert.ok([...edges.values()].every(n=>n===2),`${node.name}: no open seams at the joint`);
  const seen=new Set([0]),queue=[0];for(const n of queue)for(const next of neighbors[n])if(!seen.has(next)){seen.add(next);queue.push(next)}
  assert.equal(seen.size,unique.size,`${node.name}: one connected surface`);
}
const clips=['Idle','Walk','Run','Dig','Scoop','Jump','KO','Drink','WipeSweat','Dance','Wave','Radio','Sit','SitEdge'];
assert.deepEqual(g.animations.map(a=>a.name).sort(),clips.sort());
for(const name of ['Walk','Run','Jump','Sit']){
  const a=g.animations.find(a=>a.name===name);
  for(const joint of ['shin.L','shin.R']){
    const ch=a.channels.find(c=>g.nodes[c.target.node].name===joint&&c.target.path==='rotation');
    assert.ok(ch,`${name}: ${joint} has a knee rotation track`);
    const values=accessor(a.samplers[ch.sampler].output);
    assert.ok(values.some(q=>Math.abs(q[0])+Math.abs(q[1])+Math.abs(q[2])>.05),`${name}: knee actually bends`);
  }
}
for(const side of ['L','R'])assert.ok(g.nodes.some(n=>n.name===`CGLCamper_${side}_Hand`));
console.log('Camper rig: 4 closed connected skins, normalized blended weights, knee animation and all 14 clips OK.');
