import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';import WebSocket from 'ws';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,time=8000){const start=Date.now();while(Date.now()-start<time){if(await fn())return;await pause(50);}throw Error('Timed out waiting for network state');}
test('real host isolates rooms, replicates digging, exports geometry, and restores a saved crew after restart', {timeout:35000},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gold-fever-test-'));
  const port=await new Promise(resolve=>{const n=net.createServer();n.listen(0,'127.0.0.1',()=>{const p=n.address().port;n.close(()=>resolve(p));});});
  const origin=`http://127.0.0.1:${port}`;let processHost=null;const sockets=[];let log='';
  async function start(){processHost=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),GOLD_FEVER_SAVE_DIR:path.join(dir,'worlds'),GOLD_FEVER_CONTROL_DIR:path.join(dir,'control')},stdio:['ignore','pipe','pipe'],windowsHide:true});processHost.stdout.on('data',d=>log+=d);processHost.stderr.on('data',d=>log+=d);await until(async()=>{try{return(await fetch(origin+'/api/health')).ok;}catch{return false;}});}
  async function stop(){if(!processHost||processHost.exitCode!==null)return;const key=fs.readFileSync(path.join(dir,'control/host.key'),'utf8');const r=await fetch(origin+'/api/host/stop',{method:'POST',headers:{Authorization:`Bearer ${key}`}});assert.equal(r.status,200);await until(()=>processHost.exitCode!==null);}
  async function join(room,token,mode='rush'){
    const ws=new WebSocket(`ws://127.0.0.1:${port}/crew`),c={ws,latest:null,welcome:null,patches:0};sockets.push(ws);
    ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome'){c.welcome=m;c.latest=m.state;}if(m.type==='snapshot')c.latest=m;if(m.type==='terrain')c.patches+=m.patches.length;});
    await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'join',room,name:'Test miner',token,mode}));await until(()=>c.welcome);return c;
  }
  try{
    await start();const token=randomUUID(),a=await join('NETSAVE0',token,'sandbox'),b=await join('NETSAVE0',randomUUID()),other=await join('OTHERROOM',randomUUID());
    await until(()=>a.latest.players.length===2);assert.equal(a.latest.cash,100000000);assert.equal(other.latest.cash,0);assert.equal(other.latest.vehicles.length,0);
    a.ws.send(JSON.stringify({type:'input',forward:1,right:0,yaw:-.4,sprint:true}));
    for(let i=0;i<31;i++){await pause(100);a.ws.send(JSON.stringify({type:'input',forward:1,right:0,yaw:-.4,sprint:true}));}
    a.ws.send(JSON.stringify({type:'input',forward:0,right:0,yaw:-.4}));await pause(200);
    a.ws.send(JSON.stringify({type:'action',action:{type:'dig',x:a.latest.self.x+.5,z:a.latest.self.z}}));
    await until(()=>a.latest.self.cargo.mass===10&&b.patches>0);assert.equal(other.patches,0);
    const exported=await(await fetch(`${origin}/api/export?room=NETSAVE0&token=${token}`)).json();assert.equal(exported.terrain.heights.length,12769);assert.ok(Object.keys(exported.cells).length>0);assert.ok(!JSON.stringify(exported).includes(token));
    const obj=await(await fetch(`${origin}/api/terrain?room=NETSAVE0&token=${token}`)).text();assert.ok(obj.startsWith('# Gold Fever terrain'));assert.ok((obj.match(/^f /gm)||[]).length>25088);assert.ok(obj.includes('o CrookedHatMine'));
    assert.equal((await fetch(`${origin}/data/host.key`)).status,404);
    for(const ws of sockets)ws.close();await pause(200);await stop();await start();
    const restored=await join('NETSAVE0',token);assert.equal(restored.welcome.mode,'sandbox');assert.equal(restored.latest.self.cargo.mass,10);assert.equal(restored.latest.cash,100000000);assert.equal(restored.latest.vehicles.length,3);assert.ok(Object.keys(restored.welcome.cells).length>0);
    restored.ws.close();await pause(100);await stop();
  }catch(e){e.message+='\nHost log: '+log;throw e;}
  finally{
    for(const ws of sockets)ws.terminate();if(processHost&&processHost.exitCode===null)processHost.kill();
    const resolved=path.resolve(dir);if(path.dirname(resolved)===path.resolve(os.tmpdir())&&path.basename(resolved).startsWith('gold-fever-test-'))fs.rmSync(resolved,{recursive:true,force:true});
  }
});
