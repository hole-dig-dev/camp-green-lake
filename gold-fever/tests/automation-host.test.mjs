import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';import WebSocket from 'ws';
import {excavatorPose} from '../shared/excavator.mjs';import {heightAt} from '../shared/world.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,limit=7000){const t=Date.now();while(Date.now()-t<limit){if(await fn())return;await pause(35);}throw Error('Arm network timeout');}
test('real host replicates mechanical automation to eight clients and restores a powered rocker and loaded conveyor',{timeout:35000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gold-arm-host-')),sockets=[];let host;
 const port=await new Promise(resolve=>{const n=net.createServer();n.listen(0,'127.0.0.1',()=>{const p=n.address().port;n.close(()=>resolve(p));});}),origin=`http://127.0.0.1:${port}`;
 async function start(){host=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),GOLD_FEVER_SAVE_DIR:path.join(dir,'worlds'),GOLD_FEVER_CONTROL_DIR:path.join(dir,'control')},stdio:'ignore',windowsHide:true});await until(async()=>{try{return(await fetch(origin+'/api/health')).ok;}catch{return false;}});}
 async function stop(){await fetch(origin+'/api/host/stop',{method:'POST',headers:{Authorization:`Bearer ${fs.readFileSync(path.join(dir,'control/host.key'),'utf8')}`}});await until(()=>host.exitCode!==null);}
 async function join(token=randomUUID()){const ws=new WebSocket(`ws://127.0.0.1:${port}/crew`),c={ws,state:null,results:[],patches:0};sockets.push(ws);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome')c.state=m.state;if(m.type==='snapshot')c.state=m;if(m.type==='result')c.results.push(m);if(m.type==='terrain')c.patches+=m.patches.length;});await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',token,room:'AUTOHOST',name:'Arm crew',crewSize:8}));await until(()=>c.state);return c;}
 async function action(c,a){const n=c.results.length;c.ws.send(JSON.stringify({type:'action',action:a}));await until(()=>c.results.length>n);return c.results.at(-1);}
 try{await start();const token=randomUUID(),a=await join(token),friends=[];for(let i=0;i<7;i++)friends.push(await join());await until(()=>a.state.players.length===8);

  const {riverX}=await import('../shared/world.mjs'),x=riverX(30)-12,z=30;
  await action(a,{type:'console',line:'tp '+(x+2)+' '+z});
  for(const item of ['rocker','rockerdrive','feeder','sluice'])await action(a,{type:'console',line:'give '+item});
  assert.equal((await action(a,{type:'deploy',item:'rocker',x:x-6,z,yaw:0})).ok,true);
  assert.equal((await action(a,{type:'deploy',item:'rockerdrive',x:x-6,z})).ok,true);
  assert.equal((await action(a,{type:'deploy',item:'feeder',x,z,yaw:0})).ok,true);
  assert.equal((await action(a,{type:'deploy',item:'sluice',x,z:z-4.4,yaw:0})).ok,true);
  await until(()=>friends.every(c=>c.state.machines.length===3&&c.state.machines.some(m=>m.powered)));
  const belt=a.state.machines.find(m=>m.type==='feeder');await action(a,{type:'console',line:'fill 24 1'});assert.equal((await action(a,{type:'interact',target:belt.id})).ok,true);
  await until(()=>friends.every(c=>c.state.machines.find(m=>m.id===belt.id).processed>0));
  await until(()=>friends.every(c=>c.state.machines.find(m=>m.type==='sluice').goldMg>0));
  await action(a,{type:'console',line:'fill 24 1'});await action(a,{type:'interact',target:belt.id});
  await stop();const saved=JSON.parse(fs.readFileSync(path.join(dir,'worlds/AUTOHOST.json')));assert.equal(saved.machines.find(m=>m.type==='rocker').powered,true);assert.ok(saved.machines.find(m=>m.id===belt.id).cargo.mass>0);
  await start();const restored=await join(token);assert.equal(restored.state.machines.find(m=>m.type==='rocker').powered,true);assert.ok(restored.state.machines.find(m=>m.id===belt.id).cargo.mass>0);await until(()=>restored.state.machines.find(m=>m.id===belt.id).running);await stop();

 }finally{for(const s of sockets)s.terminate();if(host?.exitCode===null)host.kill();const resolved=path.resolve(dir);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('gold-arm-host-'))fs.rmSync(resolved,{recursive:true,force:true});}
});
