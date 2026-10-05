import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRoom,createPlayer,act} from '../shared/simulation.mjs';
import {baseHeight,heightAt} from '../shared/world.mjs';import {CANYON_ROUTE,canyonCenter,CANYON_BRIDGE} from '../shared/canyon.mjs';
import {mineStep,mineFloor,mineBodyClear,mineRay,digMine,undergroundAt} from '../shared/mine.mjs';
import {tickStability,ensureSupports} from '../shared/supports.mjs';import {resetMap} from '../shared/map-reset.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
function setup(){const r=createRoom('CANYONUNIT',rules),p=createPlayer('solo','Solo',r);return{r,p};}
test('a solo miner walks down the complete canyon route and returns without flight or jumping',()=>{
  const {r,p}=setup();Object.assign(p,{...CANYON_ROUTE[0],y:baseHeight(CANYON_ROUTE[0].x,CANYON_ROUTE[0].z)});
  function walk(target){for(let i=0;i<1000;i++){const dx=target.x-p.x,dz=target.z-p.z;if(Math.hypot(dx,dz)<.2)return;p.yaw=Math.atan2(-dx,-dz);mineStep(r.mine,p,{forward:1},3.6,.05);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));}assert.fail('Route blocked');}
  for(const t of CANYON_ROUTE.slice(1))walk(t);assert.ok(p.y<-28);assert.equal(undergroundAt(r.mine,p),false);
  for(const t of [...CANYON_ROUTE].reverse().slice(1))walk(t);assert.ok(p.y>5);
});
test('bridge supports a crossing, its open edge drops, and steep canyon walls block walking',()=>{
  const {r,p}=setup(),b=CANYON_BRIDGE;Object.assign(p,{x:b.x,z:b.z+22.5,y:baseHeight(b.x,b.z+22.5),yaw:0});for(let i=0;i<250;i++)mineStep(r.mine,p,{forward:1},3.6,.05);assert.ok(p.z<b.z-21.5);assert.ok(p.y>8.5);
  Object.assign(p,{x:b.x,z:b.z,y:b.y,yaw:0,vy:0});for(let i=0;i<30;i++)mineStep(r.mine,p,{right:1},3.6,.05);assert.ok(p.y<8);assert.ok(p.x>b.x+1.5);
  Object.assign(p,{x:0,z:canyonCenter(0)-9,y:-29,yaw:0,vy:0});for(let i=0;i<200;i++)mineStep(r.mine,p,{forward:1},3.6,.05);assert.ok(p.z>canyonCenter(0)-16);assert.ok(p.y>-30);
});
test('diagonal canyon-wall cuts remove real rock, retain ore and can extend below the old mine floor',()=>{
  const {r,p}=setup();p.upgrades=['tunnelpick'];p.input.tool='pick';Object.assign(p,{x:-28,z:canyonCenter(-28)-11,y:baseHeight(-28,canyonCenter(-28)-11)});
  const eye={x:p.x,y:p.y+1.65,z:p.z},dir={x:0,y:-.3,z:-Math.sqrt(.91)},hit=mineRay(r.mine,eye,dir,4.7);assert.ok(hit);const result=digMine(r,p,hit,rules,1000);assert.ok(result.ok,result.message);assert.ok(r.mine.brushes[0].floor.sz>0);assert.ok(p.cargo.mass>0);assert.ok(p.cargo.goldMg>0);
  r.mine.brushes.push({id:'deep',a:{x:0,y:-40,z:-66},b:{x:0,y:-40,z:-66},radius:2});Object.assign(p,{x:0,y:-41,z:-66});assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));assert.ok(mineFloor(r.mine,0,-66,-40)<-41);
});
test('open-air canyon cuts never produce cave-ins; actual roofs above the old height limit still need bracing',()=>{
  const {r}=setup();r.mine.brushes.push({id:'open',a:{x:0,y:-28,z:-66},b:{x:2,y:-28,z:-66},radius:2,floor:{x:0,y:-29,z:-66,sx:0,sz:0}});ensureSupports(r);for(let i=0;i<110;i++)tickStability(r,1,1000+i*1000);assert.equal(r.mine.rubble.length,0);assert.equal(r.mine.risks[0].supported,true);
  r.mine.brushes.push({id:'roof',a:{x:0,y:5.9,z:-90},b:{x:3,y:5.9,z:-90},radius:1.7,floor:{x:0,y:5,z:-90,sx:0,sz:0}});ensureSupports(r);for(let i=0;i<95;i++)tickStability(r,1,200000+i*1000);assert.ok(r.mine.rubble.some(b=>b.y>3));
});
test('a miner walks across the support footprint from the sloping wall into a freshly carved level tunnel',()=>{
  const {r,p}=setup();Object.assign(p,{x:-28,z:canyonCenter(-28)-11,y:heightAt(-28,canyonCenter(-28)-11)+.3});mineStep(r.mine,p,{},0,.3);p.upgrades=['tunnelpick','bucket'];p.input.tool='pick';
  for(let i=0;i<2;i++){const h=mineRay(r.mine,{x:p.x,y:p.y+1.65,z:p.z},{x:0,y:0,z:-1},4.7);assert.ok(h);const result=digMine(r,p,h,rules,1000+i*2000);assert.ok(result.ok,result.message);}
  const start=p.z;p.yaw=0;mineStep(r.mine,p,{forward:1},5.52,.5);assert.ok(p.z<start-2);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));
});
test('map reset preserves treasury, identities, upgrades, equipment and every carried or loose parcel',()=>{
  const {r,p}=setup();r.cash=4143097;p.upgrades=['tunnelpick'];p.goldMg=4321;p.wood=8;p.cargo={mass:12,goldMg:4,x:0,z:0};r.cells.a={depth:3};r.mine.brushes.push({id:'old'});r.mine.tracks.push({id:'rail'});r.mine.carts.push({cargo:{mass:18,goldMg:9,x:0,z:0}});r.mine.props.push({type:'timber'});r.forest.trees.tree1={felledAt:1};r.spills.push({cargo:{mass:6,goldMg:2,x:0,z:0}});r.vehicles.push({id:'v1',type:'truck',cargo:{mass:100,goldMg:11,x:0,z:0},x:0,z:-66});
  resetMap(r);assert.equal(r.cash,4143097);assert.equal(r.players.solo,p);assert.deepEqual(p.upgrades,['tunnelpick']);assert.equal(p.goldMg,4321);assert.equal(p.wood,8);assert.equal(p.cargo.mass,12);assert.deepEqual(r.cells,{});assert.equal(r.mine.brushes.length,0);assert.deepEqual(r.forest.trees,{});assert.equal(r.vehicles[0].cargo.mass,100);assert.equal(r.spills[0].cargo.mass,24);assert.equal(r.spills[0].cargo.goldMg,11);assert.ok(p.kits.includes('minecart')&&p.kits.includes('minetrack')&&p.kits.includes('timber'));assert.equal(p.z,58);
});
