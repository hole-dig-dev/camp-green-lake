import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRoom,createPlayer,snapshot,tick} from '../shared/simulation.mjs';
import {ensureGuards,tickGuards,applyGuardKnock,guardSight,GUARD_RULES} from '../shared/guards.mjs';
import {mineBodyClear,mineStep,mineFloor} from '../shared/mine.mjs';
import {baseHeight} from '../shared/world.mjs';import {exportWorld} from '../shared/export.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
function setup(){const r=createRoom('DANCEUNIT',rules),p=createPlayer('solo','Solo',r),g=ensureGuards(r)[1];r.guards=[g];mineStep(r.mine,g,{},0,.25);Object.assign(p,{x:g.x+1,y:g.y,z:g.z,vy:0});return{r,p,g};}
test('four persistent canyon guards remain inert offline and publish the same bounded roster to 1-8 players',()=>{
 const r=createRoom('EIGHTDANCERS',rules),p=createPlayer('solo','Solo',r);assert.equal(r.guards.length,4);const saved=JSON.stringify(r.guards);p.active=false;tickGuards(r,.05,1000);assert.equal(JSON.stringify(r.guards),saved);
 for(let i=0;i<8;i++){const q=createPlayer('friend'+i,'Friend',r);assert.equal(snapshot(r,q,rules,1000).guards.length,4);}const restored=JSON.parse(JSON.stringify(r));assert.equal(ensureGuards(restored).length,4);assert.equal(exportWorld(r).guards.length,4);
});
test('guards acquire a visible trespasser, pursue with terrain collision and wind up before dancing',()=>{
 const {r,p,g}=setup();p.x=g.x+7;let first=null;for(let n=0;n<140;n++){const e=tickGuards(r,.05,1000+n*50);if(e.some(e=>e.effect?.type==='guardShout'))first=n;assert.ok(mineBodyClear(r.mine,g.x,g.y,g.z));if(g.state==='windup')break;}
 assert.equal(first,0);assert.equal(g.state,'windup');assert.ok(g.x> -5+2);assert.equal(p.guardKnock,undefined);const until=g.until;tickGuards(r,.05,until-1);assert.equal(g.state,'windup');tickGuards(r,.05,until);assert.equal(g.state,'dance');assert.equal(p.guardKnock,undefined);
});
test('a dance hits once, turns away, moves the miner physically, conserves spilled gold and prevents chain attacks',()=>{
 const {r,p,g}=setup();Object.assign(g,{state:'windup',stateAt:1000,until:2000,target:p.id});p.cargo={mass:24,goldMg:240,x:0,z:0};tickGuards(r,.05,2000);assert.equal(g.state,'dance');assert.ok(Math.abs(g.yaw-Math.PI/2)<.01);
 assert.equal(tickGuards(r,.05,2419).length,0);const e=tickGuards(r,.05,2420);assert.ok(e.some(e=>e.effect?.type==='guardBump'));assert.equal(p.cargo.mass,20.4);assert.equal(r.spills[0].cargo.mass,3.5999999999999996);assert.equal(p.cargo.goldMg+r.spills[0].cargo.goldMg,240);
 const old=p.x;for(let n=0;n<8;n++)applyGuardKnock(r.mine,p,.05,2420+n*50);assert.ok(p.x>old+.7);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));tickGuards(r,.05,2480);assert.equal(r.spills.length,1);
 const clone={...g,id:'guard-friend',state:'patrol',target:null,x:p.x+.6};r.guards.push(clone);tickGuards(r,.05,2500);assert.equal(clone.target,null);assert.equal(p.guardSafeUntil,2420+GUARD_RULES.immunity);
 tickGuards(r,.05,3800);assert.equal(g.state,'recover');assert.equal(g.until,3800+GUARD_RULES.recovery);
});
test('a solo miner can dodge the wind-up, outrun pursuit with a full starter bucket and escape into town',()=>{
 const {r,p,g}=setup();Object.assign(g,{state:'windup',stateAt:1000,until:2000,target:p.id});p.x=g.x+3;tickGuards(r,.05,2000);assert.equal(g.state,'dance');tickGuards(r,.05,2420);assert.equal(p.guardKnock,undefined);
 assert.ok(rules.player.speed*(1-.24)>GUARD_RULES.speed);Object.assign(p,{x:-25,y:3.15,z:58});for(let now=2470;now<=8000;now+=50)tickGuards(r,.05,now);assert.equal(g.target,null);assert.equal(g.state,'patrol');
});
test('rock blocks detection and attack; flight, vehicles and placed buckets provide correct handling',()=>{
 const {r,p,g}=setup();Object.assign(p,{z:g.z-28,y:baseHeight(p.x,g.z-28)});assert.equal(guardSight(r.mine,g,p),false);tickGuards(r,.05,1000);assert.equal(g.target,null);
 Object.assign(p,{x:g.x+1,y:g.y,z:g.z,fly:true});tickGuards(r,.05,2000);assert.equal(g.target,null);p.fly=false;p.vehicle='truck';tickGuards(r,.05,2100);assert.equal(g.target,null);p.vehicle=null;
 Object.assign(g,{state:'windup',stateAt:2200,until:3200,target:p.id});p.bucketPos={x:p.x,z:p.z,y:p.y};p.cargo={mass:24,goldMg:240,x:0,z:0};tickGuards(r,.05,3200);tickGuards(r,.05,3620);assert.equal(p.cargo.mass,24);assert.equal(r.spills.length,0);
});
