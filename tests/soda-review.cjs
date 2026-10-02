/* Asset handoff review in the actual r128 game. No persistent game placement.
   Run from the repo root after gpu-preflight.mjs: node tests/soda-review.cjs */
const {browser,player}=require('./carry/lib.cjs');
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'art/blender/renders');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){
 return new Promise((resolve,reject)=>{
  const s=net.createServer();s.on('error',reject);
  s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))});
 });
}
(async()=>{
 fs.mkdirSync(path.join(ROOT,'tests/out'),{recursive:true});
 const data=fs.mkdtempSync(path.join(ROOT,'tests/out/soda-review-'));
 fs.writeFileSync(path.join(data,'world.json'),'{"director":{"on":false}}');
 const port=await freePort(),errors=[];
 const server=spawn(process.execPath,['server.js'],{
  cwd:ROOT,env:{...process.env,PORT:String(port),DEV_MODE:'1',PLAYLOG:'0',DATA_DIR:data},
  stdio:['ignore','ignore','pipe']
 });
 let serverError='';server.stderr.on('data',chunk=>serverError+=chunk);
 let b;
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   if(server.exitCode!==null)throw Error('Review server exited: '+serverError);
   try{ready=(await fetch(`http://127.0.0.1:${port}/healthz`)).ok}catch{}
   if(ready)break;await delay(100);
  }
  assert.ok(ready,'Review server ready');
  const art=fs.readFileSync(path.join(ROOT,'art/blender/glb/SodaMachine.glb'));
  assert.deepEqual(art,fs.readFileSync(path.join(ROOT,'public/models/SodaMachine.glb')));
  assert.equal(art.readUInt32LE(4),2);
  const gltf=JSON.parse(art.subarray(20,20+art.readUInt32LE(12)).toString());
  assert.equal(gltf.meshes.length,1);
  assert.ok(gltf.materials.some(m=>m.emissiveFactor?.some(v=>v>0)), 'Lit panel exported');
  b=await browser();
  const p=await player(b,port,'SodaReview',errors);
  await p.setViewportSize({width:1440,height:1000});
  await p.addStyleTag({content:'body > :not(#game) { visibility: hidden !important; }'});
  const audit=await p.evaluate(async()=>{
   GOD=true;window.lsPlan=()=>null;window.updateHaboob=()=>{};window.nightF=()=>0;
   tbWeeds.length=0;crewPanelOn=false;
   sun.intensity=1.05;hemi.intensity=.62;
   sky.material.color.copy(WHITE);scene.fog.color.copy(FOG_DAY);
   const x=5.6,z=34.2,h=baseH(x,z);
   const machine=await placeModel('SodaMachine',{x,y:h,z,ry:Math.PI});
   machine.updateMatrixWorld(true);
   const box=new T.Box3().setFromObject(machine),size=box.getSize(new T.Vector3());
   const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   window.__soda={machine,h,eye:new T.Vector3(4.0,h+2.75,31.5),
                        target:new T.Vector3(6.85,h+.82,34.2)};
   P.x=-3;P.z=20;P.y=groundAt(P.x,P.z);
   window.updateCamera=()=>{camera.position.copy(__soda.eye);camera.lookAt(__soda.target)};
   return {placement:{x,z,ry:Math.PI,groundY:h},dimensions:size.toArray(),
           min:box.min.toArray(),max:box.max.toArray(),
           renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'',
           materialNames:[...new Set(machine.children.map(n=>n.material.name))],
           adapterPreservesEmission:machine.children.some(n=>n.material.emissive?.getHex()>0)};
  });
  assert.match(audit.renderer,/AMD.*Vulkan|Vulkan.*AMD/);
  assert.doesNotMatch(audit.renderer,/SwiftShader|llvmpipe/i);
  assert.ok(Math.abs(audit.dimensions[0]-.9)<.02);
  assert.ok(Math.abs(audit.dimensions[1]-1.9)<.001);
  assert.ok(Math.abs(audit.dimensions[2]-.75)<.02);
  assert.ok(Math.abs(audit.min[1]-audit.placement.groundY)<.00001,'Feet at ground');
  await p.waitForTimeout(500);
  await p.screenshot({path:path.join(OUT,'SodaMachine-game.png')});
  await p.evaluate(()=>{
   __soda.eye.set(4.05,__soda.h+1.66,31.75);
   __soda.target.set(5.6,__soda.h+.99,34.2);
  });
  await p.waitForTimeout(150);
  await p.screenshot({path:path.join(OUT,'SodaMachine-game-detail.png')});
  await p.evaluate(()=>{
   // A diagonal view inside the yard clears the gate and parked truck. Exactly 15 m
   // from the panel centre, retaining the real camp, shadows and material adapter.
   __soda.eye.set(-7.4,__soda.h+.95+Math.sqrt(31),29.2);
   __soda.target.set(5.6,__soda.h+.95,34.2);
  });
  await p.waitForTimeout(150);
  await p.screenshot({path:path.join(OUT,'SodaMachine-game-15m.png')});
  assert.deepEqual(errors,[]);
  audit.longShotDistanceM=await p.evaluate(()=>__soda.eye.distanceTo(__soda.target));
  assert.ok(Math.abs(audit.longShotDistanceM-15)<1e-6);
  fs.writeFileSync(path.join(OUT,'SodaMachine-game.json'),JSON.stringify(audit,null,2)+'\n');
  console.log(JSON.stringify(audit,null,2));
 }finally{
  if(b)await b.close();
  server.kill();
  if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));
  fs.rmSync(data,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1});
