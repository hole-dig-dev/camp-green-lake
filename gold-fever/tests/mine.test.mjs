import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRoom,createPlayer,act,tick,snapshot} from '../shared/simulation.mjs';
import {mineSolid,mineRay,mineStep,mineBodyClear,mineFloor,mineDistance,releaseMine} from '../shared/mine.mjs';
import {emptyCargo,addCargo} from '../shared/cargo.mjs';import {tickSoil} from '../shared/soil.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
function setup(){const r=createRoom('REALMINE',rules),p=createPlayer('mine-player-123456','Solo Dusty',r);p.x=-70;p.y=-6;p.z=30;p.yaw=Math.PI/2;return {r,p};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function hit(r,p,dir={x:-1,y:0,z:0}){return mineRay(r.mine,{x:p.x,y:p.y+1.65,z:p.z},dir,4.7);}
function mass(r){return Object.values(r.players).reduce((n,p)=>n+p.cargo.mass+(p.shovel?.mass||0),0)+r.mine.carts.reduce((n,c)=>n+c.cargo.mass,0)+r.spills.reduce((n,s)=>n+s.cargo.mass,0)+r.clods.reduce((n,c)=>n+c.cargo.mass,0);}
function kit(r,p,item,x=-68,y=-6,z=30){p.kits.push(item);const result=act(r,p,{type:'deploy',item,x,y,z,yaw:-Math.PI/2},rules,1000);assert.equal(result.ok,true,result.message);return result;}
test('real 3D wall cuts open a walkable passage while preserving its ceiling and surrounding rock',()=>{
  const {r,p}=setup(),h=hit(r,p);assert.ok(h);assert.equal(act(r,p,{type:'shovelPlant',...h},rules,1000).ok,true);assert.equal(act(r,p,{type:'shovelLift',pull:50},rules,1300).ok,true);
  assert.equal(p.shovel.mass,12);assert.equal(p.cargo.mass,0);assert.equal(mineSolid(r.mine,-72.5,-5.5,30.5),false);assert.equal(mineSolid(r.mine,-72.5,-4.5,30.5),false);
  assert.equal(mineBodyClear(r.mine,-72.5,-6,30),true);assert.equal(mineSolid(r.mine,-72.5,-2.8,30.5),true);assert.equal(mineSolid(r.mine,-74.5,-4.5,30.5),true);
  assert.equal(snapshot(r,p,rules,1300).mine.removed,undefined);assert.equal(p.stats.dug,12);
});
test('downward and overhead digging carve continuous surfaces and cannot reach through rock or duplicate a cut',()=>{
  const {r,p}=setup(),down=hit(r,p,{x:0,y:-1,z:0});assert.equal(act(r,p,{type:'mineDig',...down},rules,1000).ok,true);assert.ok(mineFloor(r.mine,p.x,p.z,p.y)<-7.4);
  const up=hit(r,p,{x:0,y:1,z:0});assert.equal(act(r,p,{type:'mineDig',...up},rules,2100).ok,true);assert.equal(mineSolid(r.mine,p.x,-2.9,p.z),false);
  const before=JSON.stringify(r.mine.brushes),dug=r.totalDugKg;assert.equal(act(r,p,{type:'mineDig',x:-76.5,y:-4.5,z:30},rules,3200).ok,false);assert.equal(JSON.stringify(r.mine.brushes),before);assert.equal(r.totalDugKg,dug);
  assert.equal(act(r,p,{type:'mineDig',...down},rules,4300).ok,false);near(mass(r),r.totalDugKg);
});
test('capsule collision blocks walls and ceilings; the emergency ladder works both ways with no hoist or helper',()=>{
  const {r,p}=setup();for(let i=0;i<100;i++)mineStep(r.mine,p,{forward:1},4.6,.05);assert.ok(p.x>=-71.76);assert.ok(p.y>=-6&&p.y<-5.5);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));
  for(let i=0;i<30;i++)mineStep(r.mine,p,{jump:true},0,.05);assert.ok(p.y<-4.5);
  p.x=-65.35;p.z=31.35;p.y=6;p.vy=0;for(let i=0;i<120;i++)mineStep(r.mine,p,{vertical:-1},0,.05);near(p.y,-6);
  p.y=-1;for(let i=0;i<30;i++)mineStep(r.mine,p,{},0,.05);near(p.y,-1);
  for(let i=0;i<120;i++)mineStep(r.mine,p,{vertical:1},0,.05);near(p.y,6);assert.equal(mineBodyClear(r.mine,-88.1,-6,0),false);
});

test('a solo miner recovers a loaded cage cart after its operator disconnects mid-shaft',()=>{
  const {r,p}=setup();kit(r,p,'minetrack',-68);kit(r,p,'minecart',-68);kit(r,p,'hoist',-64);const h=r.mine.hoist,c=r.mine.carts[0];h.y=-6;
  addCargo(c.cargo,{mass:123,goldMg:456,x:-70,z:30});p.x=-68;assert.equal(act(r,p,{type:'mineCart',target:c.id},rules,1000).ok,true);assert.equal(act(r,p,{type:'hoistBoard'},rules,1100).ok,true);h.y=-2;c.y=-2;
  releaseMine(r,p);near(p.y,-6);assert.equal(c.operator,null);assert.equal(h.cart,c.id);assert.equal(act(r,p,{type:'hoistCall'},rules,1200).ok,true);
  for(let i=0;i<90;i++)tick(r,rules,.05,1250+i*50);near(h.y,-6);assert.equal(act(r,p,{type:'hoistBoard'},rules,6000).ok,true);assert.equal(act(r,p,{type:'hoistBoard'},rules,6100).ok,true);assert.equal(h.cart,null);near(c.x,-68);near(c.cargo.mass,123);near(c.cargo.goldMg,456);
});
test('mine purchases use the crew treasury and failed track placement preserves the kit',()=>{
  const {r,p}=setup();p.x=-46;p.y=3.15;p.z=49;r.cash=100000;
  const before=r.cash;assert.equal(act(r,p,{type:'buy',item:'minetrack'},rules,1000).ok,true);assert.equal(p.kits.filter(k=>k==='minetrack').length,6);assert.equal(r.cash,before-9500);
  p.x=-70;p.y=-6;p.z=30;assert.equal(act(r,p,{type:'deploy',item:'minetrack',x:-74,y:-6,z:30},rules,2000).ok,false);assert.equal(p.kits.length,6);
  assert.equal(act(r,p,{type:'deploy',item:'minetrack',x:-70,y:-6,z:30},rules,2000).ok,true);assert.equal(p.kits.length,5);
});
test('one player loads a cart, calls the empty cage, rides and cranks it up, exits and recovers every parcel',()=>{
  const {r,p}=setup();kit(r,p,'minetrack',-68);kit(r,p,'minecart',-68);kit(r,p,'hoist',-64);p.y=6;kit(r,p,'minetrack',-68,6);p.y=-6;
  const h=hit(r,p);assert.equal(act(r,p,{type:'mineDig',...h},rules,1000).ok,true);const gold=p.cargo.goldMg,kg=p.cargo.mass,c=r.mine.carts[0];
  assert.equal(act(r,p,{type:'mineLoad',target:c.id},rules,2100).ok,true);assert.equal(p.cargo.mass,0);p.x=-68;assert.equal(act(r,p,{type:'hoistCall'},rules,2200).ok,true);
  for(let i=0;i<230;i++)tick(r,rules,.05,2300+i*50);near(r.mine.hoist.y,-6);
  assert.equal(act(r,p,{type:'mineCart',target:c.id},rules,14000).ok,true);assert.equal(act(r,p,{type:'hoistBoard'},rules,14010).ok,true);assert.equal(r.mine.hoist.cart,c.id);
  for(let i=0;i<230;i++){const now=15000+i*50;p.input={hoistUp:true};p.lastInput=now;tick(r,rules,.05,now);}near(p.y,6);near(c.y,6);assert.equal(r.mine.hoist.moving,false);
  assert.equal(act(r,p,{type:'hoistBoard'},rules,28000).ok,true);near(c.x,-68);assert.equal(r.mine.hoist.cart,null);assert.equal(act(r,p,{type:'mineCart',target:c.id},rules,28010).ok,true);
  assert.equal(act(r,p,{type:'mineRetrieve',target:c.id},rules,29000).ok,true);near(p.cargo.mass,kg);near(p.cargo.goldMg,gold);near(mass(r),kg);
});
test('shaft extensions expose deeper mine levels and powered lifting continues after the operator releases the key',()=>{
  const {r,p}=setup();kit(r,p,'hoist',-64);kit(r,p,'shaftkit',-64);assert.ok(r.mine.levels.includes(-12));assert.equal(mineBodyClear(r.mine,-70,-12,30),true);assert.equal(mineSolid(r.mine,-74,-10,30),true);
  kit(r,p,'steamhoist',-64);p.x=-64.55;p.y=6;p.z=30;assert.equal(act(r,p,{type:'hoistBoard'},rules,2000).ok,true);
  p.input={hoistDown:true};p.lastInput=2100;tick(r,rules,.05,2100);p.input={};for(let i=0;i<120;i++)tick(r,rules,.05,2150+i*50);near(p.y,-6);assert.equal(act(r,p,{type:'hoistBoard'},rules,9000).ok,true);
});

test('a hand-cranked cage holds when released and can reverse safely between landings',()=>{
  const {r,p}=setup();kit(r,p,'hoist',-64);const h=r.mine.hoist;h.y=-6;p.x=-64.55;p.z=30;assert.equal(act(r,p,{type:'hoistBoard'},rules,1000).ok,true);
  for(let i=0;i<40;i++){const now=1100+i*50;p.input={hoistUp:true};p.lastInput=now;tick(r,rules,.05,now);}const held=h.y;assert.ok(held>-6&&held<6);
  p.input={};for(let i=0;i<20;i++)tick(r,rules,.05,4000+i*50);near(h.y,held);assert.equal(h.moving,false);assert.equal(act(r,p,{type:'hoistBoard'},rules,5100).ok,false);
  for(let i=0;i<45;i++){const now=5200+i*50;p.input={hoistDown:true};p.lastInput=now;tick(r,rules,.05,now);}near(h.y,-6);assert.equal(act(r,p,{type:'hoistBoard'},rules,8000).ok,true);
});

test('players can excavate a long gallery, widen it, lay track inside it and drive a loaded cart past the original chamber',()=>{
  const {r,p}=setup();let now=1000;p.upgrades.push('bucket');
  for(let i=0;i<12;i++){p.cargo=emptyCargo();const wall=hit(r,p);if(wall){const result=act(r,p,{type:'mineDig',...wall},rules,now+=1100);assert.equal(result.ok,true,result.message);}for(let j=0;j<20;j++)mineStep(r.mine,p,{forward:1},2,.025);}
  assert.ok(r.mine.brushes.length>=6);assert.ok(p.x<-80);assert.equal(mineSolid(r.mine,-78.5,-2.5,30),true);assert.equal(mineSolid(r.mine,-78.5,-5.5,28),true);
  for(const x of [-74,-76,-78]){p.x=x;p.z=30;assert.equal(mineBodyClear(r.mine,x,-6,30),true);for(const z of[-1,1]){p.cargo=emptyCargo();const side=hit(r,p,{x:0,y:0,z});assert.ok(side);assert.equal(act(r,p,{type:'mineDig',...side},rules,now+=1100).ok,true);}kit(r,p,'minetrack',x);}
  p.x=-74;kit(r,p,'minecart',-74);const c=r.mine.carts[0];addCargo(c.cargo,{mass:120,goldMg:321,x:-78,z:30});assert.equal(act(r,p,{type:'mineCart',target:c.id},rules,now+=1100).ok,true);
  for(let i=0;i<60;i++){p.input={forward:1,yaw:Math.PI/2};p.lastInput=now+=50;tick(r,rules,.05,now);}assert.ok(c.x<-77);near(c.cargo.mass,120);near(c.cargo.goldMg,321);
});
test('cart control is exclusive, rail gaps stop movement, and disconnect parks cargo without duplication',()=>{
  const {r,p}=setup(),q=createPlayer('mine-friend-123456','Friend',r);q.x=p.x;q.y=p.y;q.z=p.z;kit(r,p,'minetrack',-68);kit(r,p,'minecart',-68);const c=r.mine.carts[0];addCargo(c.cargo,{mass:100,goldMg:200,x:-70,z:30});
  assert.equal(act(r,p,{type:'mineCart',target:c.id},rules,1000).ok,true);assert.equal(act(r,q,{type:'mineCart',target:c.id},rules,1000).ok,false);
  for(let i=0;i<100;i++){const now=1100+i*50;p.input={forward:1,yaw:-Math.PI/2};p.lastInput=now;tick(r,rules,.05,now);}assert.ok(c.x<-67);
  releaseMine(r,p);assert.equal(c.operator,null);assert.equal(c.brake,true);near(c.cargo.mass,100);near(c.cargo.goldMg,200);
  const copy=JSON.parse(JSON.stringify(r));assert.equal(copy.mine.carts[0].cargo.mass,100);assert.deepEqual(copy.mine.removed,r.mine.removed);
});
test('clods enter underground mine carts; overflow settles at the correct depth and cannot be retrieved from another level',()=>{
  const {r,p}=setup();kit(r,p,'minetrack',-68);kit(r,p,'minecart',-68);const c=r.mine.carts[0];addCargo(c.cargo,{mass:239,goldMg:239,x:-68,z:30});
  r.clods.push({id:'mine-clod',x:c.x,y:c.y+1,z:c.z,vx:0,vz:0,vy:-2,age:0,bounces:0,cargo:{mass:6,goldMg:60,x:-68,z:30}});
  for(let i=0;i<100;i++)tickSoil(r,rules,.05,1000+i*50);near(c.cargo.mass,240);near(mass(r),245);assert.ok(r.spills.length);assert.equal(r.spills[0].y,-6);
  p.x=r.spills[0].x;p.z=r.spills[0].z;p.y=6;assert.equal(act(r,p,{type:'retrieve',target:r.spills[0].id},rules,8000).ok,false);p.y=-6;assert.equal(act(r,p,{type:'retrieve',target:r.spills[0].id},rules,8100).ok,true);near(mass(r),245);
});

test('diagonal descending passages are walkable in both directions and never snap cuts to a grid',()=>{
  const {r,p}=setup();p.yaw=Math.PI/2-.55;let now=1000;const pitch=-.4,dir={x:-Math.sin(p.yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(p.yaw)*Math.cos(pitch)};
  for(let i=0;i<8;i++){p.cargo=emptyCargo();const h=hit(r,p,dir);if(h)assert.equal(act(r,p,{type:'mineDig',...h},rules,now+=1100).ok,true);for(let j=0;j<30;j++)mineStep(r.mine,p,{forward:1},2,.025);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));}
  assert.ok(p.x<-79&&p.z<25&&p.y<-9);assert.ok(r.mine.brushes.every(b=>b.floor&&b.floor.sx&&b.floor.sz));assert.ok(r.mine.brushes.some(b=>Math.abs(b.a.x-Math.round(b.a.x))>.1));
  for(let i=0;i<300;i++)mineStep(r.mine,p,{forward:-1},2,.025);assert.ok(p.x>-71,'Cannot return up the excavated ramp');assert.ok(p.y>-6.1);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));
});
test('a solo miner digs more than ten metres straight down and climbs the purchased rope back out',()=>{
  const {r,p}=setup();kit(r,p,'rope');let now=1000;
  for(let i=0;i<8;i++){p.cargo=emptyCargo();const h=hit(r,p,{x:.189,y:-.982,z:0});assert.ok(h);assert.equal(act(r,p,{type:'mineDig',...h},rules,now+=1100).ok,true);for(let j=0;j<80;j++)mineStep(r.mine,p,{vertical:-1},0,.025);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));}
  assert.ok(p.y<-17);for(let i=0;i<300;i++)mineStep(r.mine,p,{vertical:1},0,.025);assert.ok(p.y>=-5.7);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));
});

test('a clod bouncing close to a mine ceiling settles on the floor with all material recoverable',()=>{const {r}=setup();r.clods.push({id:'roof-clod',x:-70,y:-3.12,z:29,vx:0,vz:0,vy:3,age:0,bounces:0,cargo:{mass:6,goldMg:60,x:-70,z:29}});for(let i=0;i<150;i++)tickSoil(r,rules,.025,1000+i*25);assert.equal(r.clods.length,0);assert.equal(r.spills.length,1);assert.equal(r.spills[0].y,-6);near(r.spills[0].cargo.mass,6);near(r.spills[0].cargo.goldMg,60);});
