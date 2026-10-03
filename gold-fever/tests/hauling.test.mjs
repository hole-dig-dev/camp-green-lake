import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRoom, createPlayer, act, tick, addCargo, snapshot, equipmentPrice } from '../shared/simulation.mjs';
import { releaseCart, spillCart, tumble } from '../shared/hauling.mjs';
import { heightAt, riverX } from '../shared/world.mjs';
import { exportWorld } from '../shared/export.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
function setup(crew=2){const r=createRoom('HAULTEST',rules,'rush',crew),p=createPlayer('first-miner-123456','Dusty',r),q=createPlayer('friend-miner-123456','Buckets',r),c=r.carts[0];p.x=q.x=c.x-2;p.z=q.z=c.z;return{r,p,q,c};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function step(r,p,time,input,dt=.05){p.input=input;p.lastInput=time;tick(r,rules,dt,time);}
test('handles are exclusive and release permits another player without duplicating ownership',()=>{
  const{r,p,q,c}=setup();assert.equal(act(r,p,{type:'cart',target:c.id},rules,1000).ok,true);
  assert.equal(act(r,q,{type:'cart',target:c.id},rules,1000).ok,false);
  assert.equal(act(r,p,{type:'dig',x:p.x,z:p.z},rules,1000).ok,false);
  assert.equal(act(r,p,{type:'cart',target:c.id},rules,1001).ok,true);
  assert.equal(act(r,q,{type:'cart',target:c.id},rules,1002).ok,true);assert.equal(p.cart,null);assert.equal(c.operator,q.id);
  releaseCart(r,q,true);assert.equal(c.operator,null);assert.equal(c.brake,true);
});
test('loading, tipping, and repeated solo recovery conserve every grain of gravel and gold',()=>{
  const{r,p,c}=setup(1);addCargo(p.cargo,{mass:24,goldMg:137.25,x:10,z:20});
  assert.equal(act(r,p,{type:'interact',target:c.id},rules,1000).ok,true);assert.equal(p.cargo.mass,0);
  assert.equal(snapshot(r,p,rules,1000).carts[0].cargo.goldMg,undefined);
  spillCart(r,c,1001);close(c.cargo.mass+r.spills[0].cargo.mass,24);close(c.cargo.goldMg+r.spills[0].cargo.goldMg,137.25);
  assert.equal(act(r,p,{type:'cartTip',target:c.id},rules,1002).ok,true);assert.equal(c.tipped,false);
  const pile=r.spills[0];p.x=pile.x;p.z=pile.z;assert.equal(act(r,p,{type:'retrieve',target:pile.id},rules,1003).ok,true);
  assert.equal(act(r,p,{type:'retrieve',target:c.id},rules,1004).ok,true);assert.equal(r.spills.length,0);close(p.cargo.mass,24);close(p.cargo.goldMg,137.25);
});
test('a full cart only accepts available capacity, and deliberate dumps merge nearby piles',()=>{
  const{r,p,c}=setup();addCargo(c.cargo,{mass:174,goldMg:1740,x:10,z:20});addCargo(p.cargo,{mass:24,goldMg:240,x:10,z:20});
  act(r,p,{type:'interact',target:c.id},rules,1000);assert.equal(c.cargo.mass,180);assert.equal(p.cargo.mass,18);
  act(r,p,{type:'cartTip',target:c.id},rules,1001);act(r,p,{type:'interact',target:c.id},rules,1002);act(r,p,{type:'cartTip',target:c.id},rules,1003);
  assert.equal(r.spills.length,1);close(r.spills[0].cargo.mass,198);close(r.spills[0].cargo.goldMg,1980);assert.equal(c.tipped,false);
});
test('held and parked brakes stop a loaded cart even while forward is held',()=>{
  const{r,p,c}=setup();act(r,p,{type:'cart',target:c.id},rules,1000);addCargo(c.cargo,{mass:120,goldMg:120,x:0,z:0});
  for(let n=0;n<20;n++)step(r,p,1000+n*50,{forward:1,yaw:c.yaw,sprint:true});
  assert.ok(Math.hypot(c.vx,c.vz)>2);for(let n=0;n<20;n++)step(r,p,2000+n*50,{forward:1,yaw:c.yaw,jump:true});
  assert.ok(Math.hypot(c.vx,c.vz)<.02);act(r,p,{type:'cartBrake',target:c.id},rules,3000);releaseCart(r,p);
  const x=c.x,z=c.z;for(let n=0;n<40;n++)step(r,p,3000+n*50,{});assert.ok(Math.hypot(c.x-x,c.z-z)<.01);assert.equal(c.tipped,false);
});
test('a reckless overloaded turn spills; nearby steadying prevents the same accident',()=>{
  function run(help){const{r,p,q,c}=setup();q.x=70;q.z=70;act(r,p,{type:'cart',target:c.id},rules,1000);addCargo(c.cargo,{mass:150,goldMg:800,x:0,z:0});
    for(let n=0;n<150&&!c.tipped;n++){const now=1000+n*50;if(help){q.x=c.x+1.2;q.z=c.z;q.input={help:true};q.lastInput=now;}step(r,p,now,{forward:1,sprint:true,yaw:-Math.PI/2+n*.09});}
    return{r,p,c};}
  const reckless=run(false),steady=run(true);assert.equal(reckless.c.tipped,true);assert.ok(reckless.p.tumble);assert.equal(steady.c.tipped,false);
  close(reckless.c.cargo.mass+reckless.r.spills.reduce((a,s)=>a+s.cargo.mass,0),150);close(reckless.c.cargo.goldMg+reckless.r.spills.reduce((a,s)=>a+s.cargo.goldMg,0),800);
});
test('a solo miner can get up; a friend helps sooner; an idle miner eventually recovers',()=>{
  function recover(help,self){const{r,p,q}=setup();q.x=p.x+1;tumble(r,p,1000);let elapsed=0;
    for(let n=1;n<=260&&p.tumble;n++){const now=1000+n*50;q.input={help};q.lastInput=now;step(r,p,now,{jump:self});elapsed=n*50;}assert.equal(p.tumble,null);return elapsed;}
  const alone=recover(false,true),friend=recover(true,false),idle=recover(false,false);assert.ok(alone<3000);assert.ok(friend<alone);assert.ok(idle<=12050);
});
test('one player can haul directly into a rocker and then operate it sequentially',()=>{
  const{r,p,c}=setup(1);p.x=c.x=riverX(30)-12;p.z=c.z=30;p.kits=['rocker'];p.y=heightAt(p.x,p.z,r.cells);
  assert.equal(act(r,p,{type:'deploy',item:'rocker',x:p.x+2,z:30},rules,1000).ok,true);const m=r.machines[0];
  act(r,p,{type:'cart',target:c.id},rules,1001);addCargo(c.cargo,{mass:24,goldMg:100,x:10,z:20});
  assert.equal(act(r,p,{type:'interact',target:m.id},rules,1002).ok,true);assert.equal(c.cargo.mass,0);close(m.cargo.goldMg,100);
  act(r,p,{type:'cartBrake',target:c.id},rules,1003);act(r,p,{type:'cart',target:c.id},rules,1004);
  for(let n=0;n<150;n++)step(r,p,1100+n*50,{wash:true,operate:m.id});assert.equal(m.cargo.mass,0);close(m.goldMg,90);
  assert.equal(act(r,p,{type:'interact',target:m.id},rules,9000).ok,true);close(p.goldMg,90);
});
test('crew capacity is persistent, creator-controlled, and exported carts are parked',()=>{
  const{r,p,q,c}=setup(1),item=rules.catalog.find(x=>x.id==='rocker');const price=equipmentPrice(r,item);
  assert.equal(act(r,q,{type:'crewSize',size:8},rules,1000).ok,false);assert.equal(act(r,p,{type:'crewSize',size:8},rules,1001).ok,true);
  assert.ok(equipmentPrice(r,item)>price);q.active=false;assert.equal(r.crewSize,8);assert.equal(act(r,p,{type:'crewSize',size:2},rules,1002).ok,false);
  act(r,p,{type:'cart',target:c.id},rules,1003);const exported=exportWorld(r);assert.equal(exported.carts[0].operator,null);assert.equal(exported.carts[0].brake,true);assert.equal(exported.crewSize,8);
});
