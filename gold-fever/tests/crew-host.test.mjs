import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {randomUUID,createHash} from 'node:crypto';import WebSocket from 'ws';
import {createRoom,createPlayer,addCargo} from '../shared/simulation.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),rules=JSON.parse(fs.readFileSync(path.join(root,'shared/rules.json')));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const start=Date.now();while(Date.now()-start<7000){if(await fn())return;await pause(50);}throw Error('Timed out waiting for crew state');}
test('real host enforces 1/2/4/8 capacity, replicates spills, parks on disconnect and preserves cargo after restart',{timeout:30000},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gold-hauling-test-'));fs.mkdirSync(path.join(dir,'worlds'));const token=randomUUID(),hash=createHash('sha256').update(token).digest('hex'),room=createRoom('CREWHAUL',rules,'rush',1),miner=createPlayer(hash,'Dusty',room),cart=room.carts[0];miner.x=cart.x-2;miner.z=cart.z;
  addCargo(cart.cargo,{mass:100,goldMg:345.67,x:10,z:20});fs.writeFileSync(path.join(dir,'worlds/CREWHAUL.json'),JSON.stringify(room));
  const port=await new Promise(resolve=>{const n=net.createServer();n.listen(0,'127.0.0.1',()=>{const p=n.address().port;n.close(()=>resolve(p));});});
  const origin=`http://127.0.0.1:${port}`,sockets=[];let host;
  async function start(){host=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),GOLD_FEVER_SAVE_DIR:path.join(dir,'worlds'),GOLD_FEVER_CONTROL_DIR:path.join(dir,'control')},stdio:'ignore',windowsHide:true});await until(async()=>{try{return(await fetch(origin+'/api/health')).ok;}catch{return false;}});}
  async function stop(){await fetch(origin+'/api/host/stop',{method:'POST',headers:{Authorization:`Bearer ${fs.readFileSync(path.join(dir,'control/host.key'),'utf8')}`}});await until(()=>host.exitCode!==null);}
  async function join(pass=randomUUID()){const ws=new WebSocket(`ws://127.0.0.1:${port}/crew`),c={ws,latest:null,error:null};sockets.push(ws);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome')c.latest=m.state;if(m.type==='snapshot')c.latest=m;if(m.type==='error')c.error=m.message;});await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',room:'CREWHAUL',token:pass,name:'Miner',crewSize:8}));await until(()=>c.latest||c.error);return c;}
  const action=(c,a)=>c.ws.send(JSON.stringify({type:'action',action:a}));
  try{await start();const a=await join(token);assert.equal(a.latest.crewSize,1);const denied=await join();assert.match(denied.error,/full/);denied.ws.close();
    action(a,{type:'crewSize',size:2});await until(()=>a.latest.crewSize===2);const b=await join();assert.equal(b.error,null);action(b,{type:'crewSize',size:8});await pause(150);assert.equal(a.latest.crewSize,2);
    action(a,{type:'crewSize',size:4});await until(()=>a.latest.crewSize===4);const c=await join(),d=await join();await until(()=>a.latest.players.length===4);
    action(a,{type:'crewSize',size:8});await until(()=>a.latest.crewSize===8);const others=[];for(let i=0;i<4;i++)others.push(await join());await until(()=>a.latest.players.length===8);
    const ninth=await join();assert.match(ninth.error,/full/);ninth.ws.close();
    action(a,{type:'cart',target:cart.id});await until(()=>a.latest.self.cart===cart.id);action(a,{type:'cartBrake',target:cart.id});action(a,{type:'cartTip',target:cart.id});await until(()=>b.latest.spills.length===1);assert.equal(b.latest.spills[0].cargo.mass,100);assert.equal(b.latest.spills[0].cargo.goldMg,undefined);
    action(a,{type:'cart',target:cart.id});await until(()=>a.latest.self.cart===cart.id);a.ws.close();await until(()=>b.latest.carts[0].operator===null&&b.latest.carts[0].brake===true);assert.equal(b.latest.crewSize,8);
    for(const s of sockets)s.close();await pause(150);await stop();const saved=JSON.parse(fs.readFileSync(path.join(dir,'worlds/CREWHAUL.json')));assert.equal(saved.spills[0].cargo.goldMg,345.67);
    await start();const restored=await join(token);assert.equal(restored.latest.crewSize,8);assert.equal(restored.latest.ownerId,miner.id);assert.equal(restored.latest.spills[0].cargo.mass,100);assert.equal(restored.latest.carts[0].brake,true);assert.equal(restored.latest.self.cart,null);restored.ws.close();await pause(100);await stop();
  }finally{for(const s of sockets)s.terminate();if(host?.exitCode===null)host.kill();const resolved=path.resolve(dir);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('gold-hauling-test-'))fs.rmSync(resolved,{recursive:true,force:true});}
});
