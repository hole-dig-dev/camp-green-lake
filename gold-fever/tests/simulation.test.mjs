import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRoom, createPlayer, act, tick, addCargo, cancelPan, snapshot } from '../shared/simulation.mjs';
import { deposits, toCell, keyOf, goldInScoop, riverX, heightAt } from '../shared/world.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
function setup(mode='rush'){const r=createRoom('TESTGOLD',rules,mode),p=createPlayer('test-token-123456','Tester',r);return {r,p};}
test('gold follows deterministic deposits and is richer in the buried pay layer',()=>{
  const {r}=setup(),d=deposits(r.seed)[0],c=toCell(d.x,d.z);
  const deep=goldInScoop(r.seed,c.ix,c.iz,d.depth,2,6),surface=goldInScoop(r.seed,c.ix,c.iz,0,2,6),remote=goldInScoop(r.seed,1,1,d.depth,2,6);
  assert.ok(deep>surface*2);assert.ok(deep>remote);assert.equal(deep,goldInScoop(r.seed,c.ix,c.iz,d.depth,2,6));
});
test('reach and protected town ground reject excavation without changing terrain',()=>{
  const {r,p}=setup();assert.equal(act(r,p,{type:'dig',x:90,z:90},rules,1000).ok,false);assert.equal(act(r,p,{type:'dig',x:p.x,z:p.z},rules,1000).ok,false);assert.equal(Object.keys(r.cells).length,0);assert.equal(p.cargo.mass,0);
});
test('scoops change shared terrain and stop when the bucket is full',()=>{
  const {r,p}=setup();p.x=riverX(35)-10;p.z=35;p.y=heightAt(p.x,p.z);
  for(let i=0;i<4;i++){const out=act(r,p,{type:'dig',x:p.x,z:p.z},rules,1000+i*1000);assert.equal(out.ok,true);assert.ok(out.patches.length);}
  const depth=Object.values(r.cells)[0].depth;assert.equal(p.cargo.mass,24);assert.equal(act(r,p,{type:'dig',x:p.x,z:p.z},rules,6000).ok,false);assert.equal(Object.values(r.cells)[0].depth,depth);
  const publicState=snapshot(r,p,rules,6000);assert.equal(publicState.self.cargo.goldMg,undefined);
});
test('panning requires water, washing and then settling; records a measured sample',()=>{
  const {r,p}=setup();addCargo(p.cargo,{mass:8,goldMg:100,x:10,z:30});assert.equal(act(r,p,{type:'pan'},rules,1000).ok,false);
  p.x=riverX(30)-10;p.z=30;p.lastInput=1000;p.input={wash:true};assert.equal(act(r,p,{type:'pan'},rules,1000).ok,true);
  tick(r,rules,4,1000);assert.ok(p.busy);assert.equal(p.goldMg,0);p.input.wash=false;tick(r,rules,1.1,1000);assert.equal(p.busy,null);assert.equal(p.goldMg,82);assert.equal(p.samples[0].goldMg,82);assert.equal(p.cargo.mass,0);
});
test('cancelling or disconnecting a pan returns every unprocessed grain',()=>{
  const {r,p}=setup();p.x=riverX(30);p.z=30;addCargo(p.cargo,{mass:12,goldMg:125,x:10,z:30});act(r,p,{type:'pan'},rules,1000);cancelPan(p);assert.equal(p.cargo.mass,12);assert.equal(p.cargo.goldMg,125);assert.equal(p.goldMg,0);
});
test('a sale credits crew cash once; unwashed gravel cannot be sold',()=>{
  const {r,p}=setup();p.x=-37;p.z=64;p.goldMg=100;assert.equal(act(r,p,{type:'sell'},rules,1000).ok,true);assert.equal(r.cash,300);assert.equal(p.goldMg,0);assert.equal(act(r,p,{type:'sell'},rules,1001).ok,false);assert.equal(r.cash,300);
});
test('simultaneous crew purchases cannot overdraw the treasury',()=>{
  const {r,p}=setup(),q=createPlayer('second-token-123456','Friend',r);p.x=q.x=-46;p.z=q.z=49;r.cash=3500;
  assert.equal(act(r,p,{type:'buy',item:'sieve'},rules,1000).ok,true);assert.equal(act(r,q,{type:'buy',item:'sieve'},rules,1000).ok,false);assert.equal(r.cash,0);assert.deepEqual(q.upgrades,[]);
});
test('machinery prerequisites still apply when a crew has plenty of cash',()=>{
  const {r,p}=setup();p.x=-46;p.z=49;r.cash=10000000;assert.equal(act(r,p,{type:'buy',item:'truck'},rules,1000).ok,false);assert.equal(r.vehicles.length,0);
});
test('washers need creek access; packing cannot duplicate loaded gravel or gold',()=>{
  const {r,p}=setup();p.kits=['rocker'];p.x=75;p.z=30;assert.equal(act(r,p,{type:'deploy',item:'rocker',x:77,z:30},rules,1000).ok,false);assert.equal(p.kits.length,1);
  p.x=riverX(30)-12;assert.equal(act(r,p,{type:'deploy',item:'rocker',x:p.x,z:30},rules,1000).ok,true);const m=r.machines[0];addCargo(m.cargo,{mass:8,goldMg:100,x:p.x,z:p.z});assert.equal(act(r,p,{type:'pack',target:m.id},rules,1000).ok,false);
  p.kits.push('washplant');assert.equal(act(r,p,{type:'deploy',item:'washplant',x:p.x+2,z:30},rules,1000).ok,false);assert.ok(p.kits.includes('washplant'));
  assert.equal(act(r,p,{type:'deploy',item:'washplant',x:p.x-7,z:30},rules,1000).ok,true);
});
test('a rocker needs a nearby operator; a sluice runs while the crew scouts',()=>{
  const {r,p}=setup();p.x=riverX(30)-12;p.z=30;p.kits=['rocker','sluice'];act(r,p,{type:'deploy',item:'rocker',x:p.x,z:30},rules,1000);const m=r.machines[0];addCargo(m.cargo,{mass:7,goldMg:100,x:p.x,z:p.z});tick(r,rules,1,1000);assert.equal(m.cargo.mass,7);
  p.lastInput=1000;p.input={wash:true,operate:m.id};tick(r,rules,2,1000);assert.equal(m.cargo.mass,0);assert.equal(m.goldMg,90);
  p.z+=6;assert.equal(act(r,p,{type:'deploy',item:'sluice',x:p.x,z:p.z},rules,1000).ok,true);const sluice=r.machines[1];addCargo(sluice.cargo,{mass:7,goldMg:100,x:p.x,z:p.z});p.input={};tick(r,rules,1,1000);assert.equal(sluice.cargo.mass,0);assert.equal(sluice.goldMg,94);
});
test('vehicle seats are exclusive; excavation-to-truck transfer conserves mass and gold',()=>{
  const {r,p}=setup('sandbox'),q=createPlayer('second-token-123456','Friend',r),v=r.vehicles[0],truck=r.vehicles[1];p.x=q.x=v.x;p.z=q.z=v.z;assert.equal(act(r,p,{type:'enter',target:v.id},rules,1000).ok,true);assert.equal(act(r,q,{type:'enter',target:v.id},rules,1000).ok,false);
  addCargo(v.cargo,{mass:360,goldMg:200,x:0,z:30});truck.x=v.x+5;truck.z=v.z;assert.equal(act(r,p,{type:'interact',target:truck.id},rules,1000).ok,true);assert.equal(v.cargo.mass,0);assert.equal(truck.cargo.mass,360);assert.equal(truck.cargo.goldMg,200);
});
test('empty offline worlds freeze processing; room state exports as plain JSON',()=>{
  const {r,p}=setup();p.active=false;const clock=r.clock;tick(r,rules,20,1000);assert.equal(r.clock,clock);assert.equal(JSON.parse(JSON.stringify(r)).code,'TESTGOLD');
});
