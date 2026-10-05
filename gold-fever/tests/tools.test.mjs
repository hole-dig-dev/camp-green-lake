import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRoom,createPlayer,act,snapshot} from '../shared/simulation.mjs';
import {MINING_TOOLS,miningTool} from '../shared/tools.mjs';
import {mineRay,mineBodyClear,mineDistance,mineStep} from '../shared/mine.mjs';
import {tickSoil} from '../shared/soil.mjs';import {ensureSupports,tickStability} from '../shared/supports.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
function setup(){const r=createRoom('TOOLMINE',rules),p=createPlayer('tool-player','Solo',r);Object.assign(p,{x:-70,y:-6,z:30,yaw:Math.PI/2});return{r,p};}
const hit=(r,p,dir={x:-1,y:0,z:0})=>mineRay(r.mine,{x:p.x,y:p.y+1.65,z:p.z},dir,4.7);
test('personal pick progression enforces previous ownership, price, duplicate purchase and save recovery',()=>{
 const {r,p}=setup(),q=createPlayer('friend','Friend',r);Object.assign(p,{x:-46,z:49});Object.assign(q,{x:-46,z:49});r.cash=100000;
 assert.equal(act(r,p,{type:'buy',item:'mattock'},rules,1000).ok,false);assert.equal(r.cash,100000);
 for(const [id,price]of[['minerpick',65],['mattock',210],['tunnelpick',620]]){const before=r.cash;assert.equal(act(r,p,{type:'buy',item:id},rules,1000).ok,true);assert.equal(before-r.cash,price*100);assert.equal(act(r,p,{type:'buy',item:id},rules,1000).ok,false);}
 assert.equal(act(r,q,{type:'buy',item:'mattock'},rules,1000).ok,false);
 p.input.tool='pick';assert.equal(miningTool(p).id,'tunnelpick');q.input.tool='pick';assert.equal(miningTool(q).id,'starter');
 const saved=JSON.parse(JSON.stringify(r));assert.equal(miningTool(saved.players['tool-player']).id,'tunnelpick');assert.equal(snapshot(r,p,rules,1000).self.miningTool,'tunnelpick');
});
test('successive owned picks remove measurably larger true rock volumes and open walkable galleries',()=>{
 let previous=0,previousEnd=Infinity;
 for(const t of MINING_TOOLS){const {r,p}=setup();p.input.tool=t.id==='starter'?'shovel':'pick';p.upgrades=t.id==='starter'?[]:[t.id];const h=hit(r,p);assert.ok(h);
 assert.equal(act(r,p,{type:'shovelPlant',...h},rules,1000).ok,true);assert.equal(act(r,p,{type:'shovelLift',pull:t.pull},rules,1000+t.plantMs+20).ok,true);
 const cut=r.mine.brushes[0];assert.equal(cut.radius,t.radius);assert.equal(p.shovel.mass,t.mass);assert.equal(p.digUntil,1000+t.plantMs+20+t.cooldown);
 let opened=0,end=-72;for(let x=-72;x>-76;x-=.2){for(let z=27.6;z<32.4;z+=.2)if(mineDistance(r.mine,x,-5,z)>0)opened++;if(mineBodyClear(r.mine,x,-6,30))end=x;}
 assert.ok(opened>previous,`${t.id}: ${opened} <= ${previous}`);assert.ok(end<previousEnd);previous=opened;previousEnd=end;
 for(let i=0;i<24;i++)mineStep(r.mine,p,{forward:1},4.6,.05);assert.ok(p.x<-72.5);assert.ok(mineBodyClear(r.mine,p.x,p.y,p.z));
 }
});
test('pick gestures validate minimum pull and timing; changing equipment after planting cannot enlarge the cut',()=>{
 const{r,p}=setup();p.upgrades=['minerpick','tunnelpick'];p.input.tool='shovel';const h=hit(r,p);act(r,p,{type:'shovelPlant',...h},rules,1000);p.input.tool='pick';
 assert.equal(act(r,p,{type:'shovelLift',pull:22},rules,1300).ok,false);assert.equal(r.mine.brushes.length,0);
 assert.equal(act(r,p,{type:'shovelLift',pull:42},rules,1300).ok,true);assert.equal(r.mine.brushes[0].radius,1.6);assert.equal(p.shovel.mass,12);
 p.shovel=null;p.digUntil=0;const next=hit(r,p);act(r,p,{type:'shovelPlant',...next},rules,3000);assert.equal(act(r,p,{type:'shovelLift',pull:22},rules,3050).ok,false);assert.equal(act(r,p,{type:'shovelLift',pull:22},rules,3130).ok,true);assert.equal(p.shovel.mass,24);
});
test('heavy physical loads retain gold and mass through throwing; full buckets prevent direct cuts without altering rock',()=>{
 const {r,p}=setup();p.upgrades=['tunnelpick'];p.input.tool='pick';p.cargo.mass=24;const h=hit(r,p);assert.equal(act(r,p,{type:'mineDig',...h},rules,1000).ok,false);assert.equal(r.mine.brushes.length,0);
 act(r,p,{type:'shovelPlant',...h},rules,1000);assert.equal(act(r,p,{type:'shovelLift',pull:22},rules,1150).ok,true);const mg=p.shovel.goldMg;
 assert.equal(act(r,p,{type:'shovelThrow',yaw:Math.PI/2,pitch:0,power:.1},rules,1200).ok,true);for(let i=0;i<100;i++)tickSoil(r,rules,.05,1250+i*50);
 const parcels=[p.cargo,...r.spills.map(s=>s.cargo),...r.clods.map(s=>s.cargo)];assert.ok(Math.abs(parcels.reduce((n,c)=>n+c.mass,0)-48)<1e-6);assert.ok(Math.abs(parcels.reduce((n,c)=>n+c.goldMg,0)-mg)<1e-6);
 ensureSupports(r);assert.ok(r.mine.risks.length>0);for(let i=0;i<91;i++)tickStability(r,1,10000+i*1000); // Power tools retain the same structural risk rules.
});
test('heavy picks clear sterile fallen rock faster, without duplicating original gold or brushes',()=>{
 const {r,p}=setup();p.upgrades=['tunnelpick'];p.input.tool='pick';p.x=-67;r.mine.rubble.push({id:'fallen',radius:1.45,x:-70,y:-6,z:30,yaw:0,height:2.25,total:36,remaining:36});
 for(const expected of[12,0]){const b=r.mine.rubble[0],eye={x:p.x,y:p.y+1.65,z:p.z},dy=b.y+b.height*b.remaining/b.total/2-eye.y,dx=b.x-eye.x,len=Math.hypot(dx,dy),h=hit(r,p,{x:dx/len,y:dy/len,z:0});assert.ok(h);const result=act(r,p,{type:'mineDig',...h},rules,1000+(36-expected)*1000);assert.equal(result.ok,true,result.message);assert.equal(b.remaining,expected);assert.equal(p.cargo.goldMg,0);p.cargo.mass=0;}
 assert.equal(r.mine.brushes.length,0);assert.equal(r.totalDugKg,36);
});


