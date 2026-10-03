import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRoom,createPlayer,act,tick,snapshot} from '../shared/simulation.mjs';
import {heightAt,riverX} from '../shared/world.mjs';
import {emptyCargo,addCargo} from '../shared/cargo.mjs';
import {soilReceivers,tickSoil,heldBucketPose} from '../shared/soil.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
function setup(){const r=createRoom('DIRTTEST',rules),p=createPlayer('dirt-player-123456','Dusty',r);p.x=riverX(35)-12;p.z=35;p.y=heightAt(p.x,p.z);p.yaw=0;return {r,p};}
function total(r){const cargos=[...Object.values(r.players).flatMap(p=>[p.cargo,p.shovel,p.busy?.sample]),...r.clods.map(c=>c.cargo),...r.spills.map(s=>s.cargo),...r.carts.map(c=>c.cargo),...r.machines.map(m=>m.cargo)];return cargos.filter(Boolean).reduce((a,c)=>({mass:a.mass+c.mass,goldMg:a.goldMg+c.goldMg}),{mass:0,goldMg:0});}
function close(a,b){assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);}

test('moving a held bucket under an actual lob catches conserved dirt before it reaches the face',()=>{
  const {r,p}=setup();p.active=true;p.input={catching:true,bucketX:.73,bucketY:0,pitch:-.08,yaw:0};
  const pose=heldBucketPose(p);close(pose.local.x,.177);assert.ok(pose.catching);
  p.shovel={mass:6,goldMg:150,x:p.x,z:p.z};assert.equal(act(r,p,{type:'shovelThrow',yaw:0,pitch:-.08,power:0,lob:true},rules,1000).ok,true);
  let catches=0;for(let i=0;i<60;i++)catches+=tickSoil(r,rules,.05,1050+i*50).filter(e=>e.effect.type==='catch').length;
  close(p.cargo.mass,6);close(total(r).goldMg,150);assert.equal(catches,5);assert.equal(p.muddyUntil,undefined);assert.equal(r.spills.length,0);
});
test('a missed self catch muddies the face for three seconds and all soil remains recoverable',()=>{
  const {r,p}=setup();p.active=true;p.input={catching:true,pitch:-.08,yaw:0};p.shovel={mass:6,goldMg:150,x:p.x,z:p.z};
  act(r,p,{type:'shovelThrow',yaw:0,pitch:-.08,power:0,lob:true},rules,1000);
  const events=[];for(let i=0;i<60;i++){const now=1050+i*50;for(const e of tickSoil(r,rules,.05,now)){if(e.effect.type==='mud'){assert.equal(e.effect.until,now+3000);events.push(e);}}}
  assert.ok(events.length);assert.equal(p.cargo.mass,0);close(total(r).mass,6);close(total(r).goldMg,150);assert.equal(r.clods.length,0);
});
test('face splats affect the struck friend, while distant misses do not blind the thrower',()=>{
  const {r,p}=setup(),q=createPlayer('mud-friend-123456','Buckets',r);p.active=q.active=true;q.x=p.x+5;q.z=p.z;q.y=p.y;q.yaw=0;
  r.clods.push({id:'face-shot',owner:p.id,x:q.x,y:q.y+1.70,z:q.z-1,vx:0,vz:8,vy:0,age:.2,bounces:0,cargo:{mass:2,goldMg:50,x:p.x,z:p.z}});
  const events=[];for(let i=0;i<30;i++)events.push(...tickSoil(r,rules,.02,1000+i*20));
  assert.ok(events.some(e=>e.effect.type==='mud'&&e.effect.player===q.id));assert.equal(p.muddyUntil,undefined);assert.ok(q.muddyUntil);close(total(r).mass,2);close(total(r).goldMg,50);
  r.clods.push({id:'far-miss',owner:p.id,x:p.x+12,y:p.y+3,z:p.z,vx:0,vz:0,vy:-4,age:.2,bounces:0,cargo:{mass:1,goldMg:10,x:p.x,z:p.z}});
  for(let i=0;i<80;i++)tickSoil(r,rules,.05,2000+i*50);assert.equal(p.muddyUntil,undefined);close(total(r).mass,3);
});
test('a full held bucket lets overflow reach the face without losing gold',()=>{
  const {r,p}=setup();p.active=true;p.input={catching:true,bucketX:.73,pitch:-.08,yaw:0};addCargo(p.cargo,{mass:24,goldMg:24,x:p.x,z:p.z});p.shovel={mass:6,goldMg:60,x:p.x,z:p.z};
  act(r,p,{type:'shovelThrow',yaw:0,pitch:-.08,power:0,lob:true},rules,1000);for(let i=0;i<60;i++)tickSoil(r,rules,.05,1050+i*50);
  assert.ok(p.muddyUntil);close(p.cargo.mass,24);close(total(r).mass,30);close(total(r).goldMg,84);
});
test('a held click and cancelled plant do not excavate; a deliberate pull puts soil on the blade',()=>{
  const {r,p}=setup();assert.equal(act(r,p,{type:'shovelPlant',x:p.x,z:p.z-1},rules,1000).ok,true);
  assert.equal(Object.keys(r.cells).length,0);assert.equal(act(r,p,{type:'shovelLift',pull:55},rules,1050).ok,false);
  assert.equal(act(r,p,{type:'shovelLift',pull:12},rules,1400).ok,false);assert.equal(Object.keys(r.cells).length,0);
  assert.equal(act(r,p,{type:'shovelLift',pull:55},rules,1400).ok,true);assert.equal(p.shovel.mass,6);assert.equal(p.cargo.mass,0);assert.ok(Object.keys(r.cells).length);assert.equal(p.shovelPlant,null);
  assert.equal(act(r,p,{type:'shovelLift',pull:55},rules,2000).ok,false);assert.equal(act(r,p,{type:'shovelPlant',x:p.x,z:p.z-1},rules,2000).ok,false);
  const s=snapshot(r,p,rules,2000);assert.equal(s.self.shovelMass,6);assert.equal(s.self.shovel?.goldMg,undefined);
});
test('invalid throw impulses cannot discard or duplicate paydirt; a real fling splits conserved parcels',()=>{
  const {r,p}=setup();p.shovel={mass:6,goldMg:150,x:p.x,z:p.z};const before=total(r);
  assert.equal(act(r,p,{type:'shovelThrow',yaw:0,pitch:NaN,power:1},rules,1000).ok,false);assert.deepEqual(total(r),before);
  assert.equal(act(r,p,{type:'shovelThrow',yaw:0,pitch:.2,power:1},rules,1000).ok,true);assert.equal(r.clods.length,5);assert.equal(p.shovel,null);close(total(r).mass,6);close(total(r).goldMg,150);
  assert.equal(act(r,p,{type:'shovelThrow',yaw:0,pitch:.2,power:1},rules,1000).ok,false);
  for(let i=0;i<160;i++)tickSoil(r,rules,.05);assert.equal(r.clods.length,0);assert.ok(r.spills.length);close(total(r).mass,6);close(total(r).goldMg,150);
});
test('descending clods land in the opening of a bucket; overflow remains recoverable',()=>{
  const {r,p}=setup();act(r,p,{type:'bucket'},rules,1000);const receiver=soilReceivers(r,rules).find(b=>b.id===`bucket-${p.id}`);
  addCargo(p.cargo,{mass:23,goldMg:23,x:p.x,z:p.z});
  r.clods.push({id:'d-test',x:receiver.x,y:receiver.y+.15,z:receiver.z,vx:0,vz:0,vy:-2,age:0,bounces:0,cargo:{mass:6,goldMg:60,x:p.x,z:p.z}});
  for(let i=0;i<80;i++)tickSoil(r,rules,.05);
  close(p.cargo.mass,24);close(p.cargo.goldMg,33);close(r.spills.reduce((n,s)=>n+s.cargo.mass,0),5);close(total(r).mass,29);close(total(r).goldMg,83);
});
test('a friend can throw into a bucket, wheelbarrow or washer and shared snapshots expose physical state only',()=>{
  const {r,p}=setup(),q=createPlayer('dirt-friend-123456','Buckets',r);p.bucketPos={x:p.x,z:p.z};const c=r.carts[0];c.x=p.x+4;c.z=p.z;c.brake=true;
  r.machines.push({id:'m-test',type:'rocker',x:p.x+8,z:p.z,yaw:0,cargo:emptyCargo(),goldMg:0,processed:0});
  for(const receiver of soilReceivers(r,rules).filter(b=>[c.id,'m-test',`bucket-${p.id}`].includes(b.id))){r.clods.push({id:`d-${receiver.id}`,owner:q.id,x:receiver.x,y:receiver.y+.10,z:receiver.z,vx:0,vz:0,vy:-2,age:0,bounces:0,cargo:{mass:2,goldMg:50,x:p.x,z:p.z}});}
  tickSoil(r,rules,.1);assert.equal(r.clods.length,0);assert.equal(p.cargo.mass,2);assert.equal(c.cargo.mass,2);assert.equal(r.machines[0].cargo.mass,2);close(total(r).goldMg,150);
  const s=snapshot(r,q,rules,1000);assert.equal(s.buckets[0].mass,2);assert.equal(s.buckets[0].goldMg,undefined);assert.equal(s.machines[0].cargo.goldMg,undefined);
});
test('bucket placement persists and cannot move cargo at a distance; active flight survives a save/reload',()=>{
  const {r,p}=setup();addCargo(p.cargo,{mass:10,goldMg:80,x:p.x,z:p.z});act(r,p,{type:'bucket'},rules,1000);const pos={...p.bucketPos};p.x+=20;
  assert.equal(act(r,p,{type:'bucket'},rules,1500).ok,false);assert.equal(act(r,p,{type:'pan'},rules,1500).ok,false);assert.deepEqual(p.bucketPos,pos);
  p.shovel={mass:6,goldMg:25,x:p.x,z:p.z};act(r,p,{type:'shovelThrow',yaw:0,pitch:.3,power:.6},rules,2000);
  const copy=JSON.parse(JSON.stringify(r));for(let i=0;i<200;i++)tick(copy,rules,.05,2050+i*50);close(total(copy).mass,16);close(total(copy).goldMg,105);assert.equal(copy.clods.length,0);
  assert.deepEqual(copy.players['dirt-player-123456'].bucketPos,pos);
});
test('eight simultaneous shovel loads are bounded and every missed scoop is recoverable',()=>{
  const {r,p}=setup();const miners=[p,...Array.from({length:7},(_,i)=>createPlayer(`more-dirt-player-${i}`,'Miner '+i,r))];
  for(const [i,miner] of miners.entries()){miner.x=p.x+i*2;miner.z=p.z;miner.y=heightAt(miner.x,miner.z);miner.shovel={mass:6,goldMg:100,x:miner.x,z:miner.z};assert.equal(act(r,miner,{type:'shovelThrow',yaw:0,pitch:.3,power:1},rules,1000).ok,true);}
  assert.equal(r.clods.length,40);for(let i=0;i<200;i++)tickSoil(r,rules,.05);close(total(r).mass,48);close(total(r).goldMg,800);assert.equal(r.clods.length,0);
});
