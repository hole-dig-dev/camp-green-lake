// Validate and capture a face-only Wardrobe attachment on the unchanged camper.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const out=path.join(root,'art/blender/renders'),scratch=path.join(root,'.ufo-tmp');
fs.mkdirSync(scratch,{recursive:true});
const bytes=fs.readFileSync(path.join(root,'public/models/AlienFace.glb'));
assert.ok(bytes.equals(fs.readFileSync(path.join(root,'art/blender/glb/AlienFace.glb'))));
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
assert.equal(gltf.meshes.length,7);assert.ok(!gltf.skins&&!gltf.animations&&!gltf.images);
assert.ok(gltf.nodes.every(n=>/^AlienFace/.test(n.name)&&!/Head|Neck|Reference/.test(n.name)));
const meta=JSON.parse(fs.readFileSync(path.join(out,'AlienFace-asset.json')));
const camper=fs.readFileSync(path.join(root,'public/models/camper.glb'));
assert.equal(meta.source_camper_sha256,createHash('sha256').update(camper).digest('hex'));
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:path.join(scratch,'alien-face-data'),DEV_MODE:'1'},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/healthz`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,env:{...process.env,TMPDIR:scratch},args:['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${port}/face-lab/`);
 await page.waitForFunction(()=>window.faceLab?.ready,null,{timeout:60000});
 const fit=await page.evaluate(async()=>{
  const H=faceLab,T=THREE,head=H.model.getObjectByName('head');
  const skull=H.model.getObjectByName('CGLCamper_Head'),neck=H.model.getObjectByName('CGLCamper_Neck');
  const snapshot=n=>JSON.stringify({positions:Array.from(n.geometry.attributes.position.array),indices:Array.from(n.geometry.index.array),position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray()});
  const before={head:snapshot(skull),neck:snapshot(neck)};
  H.faces.forEach(f=>f.scene.visible=false);H.hats.forEach(f=>f.scene.visible=false);
  const hidden=[];
  H.model.traverse(n=>{
   if(!n.isMesh)return;
   if(/^CGLCamper_(Eye|Brow|Mouth|Teeth|Nose)/.test(n.name)||/_(Bucket|Cowboy|DesertCap|Hair|Shades)_/.test(n.name)){n.visible=false;hidden.push(n.name)}
   if(n.material.name==='CGL_Skin')n.material.color.setHex(0x5fd04a);
  });
  const face=await new Promise((res,rej)=>new T.GLTFLoader().load('/models/AlienFace.glb',res,undefined,rej));
  const seen=new Set();face.scene.traverse(n=>{if(n.isMesh&&!seen.has(n.material)){seen.add(n.material);n.material.color.convertLinearToSRGB()}});
  head.add(face.scene);H.model.updateMatrixWorld(true);
  const gl=H.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  const draw=view=>{
   const c=H.cam,w=H.renderer.domElement.clientWidth,h=H.renderer.domElement.clientHeight;
   const span=view==='body'?3.45:1.1,y=view==='body'?1.5:2.35;
   c.left=-span*w/h/2;c.right=-c.left;c.top=span/2;c.bottom=-c.top;c.updateProjectionMatrix();
   c.position.set(0,y,7);c.lookAt(0,y,0);H.model.rotation.y=view==='side'?-Math.PI/2:0;
   H.model.updateMatrixWorld(true);H.renderer.render(H.scene,c);
  };
  document.querySelector('#selectedName').textContent='Alien face · original camper head';
  document.querySelector('#selectedDescription').textContent='Only the face changes. Original green head, neck, body and rig retained.';
  window.alienFaceReview={H,face:face.scene,draw};draw('front');
  return {gpu:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),attached:face.scene.parent===head,
   localPosition:face.scene.position.toArray(),localQuaternion:face.scene.quaternion.toArray(),localScale:face.scene.scale.toArray(),
   originalHeadVisible:skull.visible,originalNeckVisible:neck.visible,
   headUnchanged:before.head===snapshot(skull),neckUnchanged:before.neck===snapshot(neck),
   skin:'#'+skull.material.color.getHexString(),hidden};
 });
 assert.match(fit.gpu,/AMD.*RADV|AMD.*radv/);assert.doesNotMatch(fit.gpu,/swiftshader|llvmpipe/i);
 assert.ok(fit.attached&&fit.originalHeadVisible&&fit.originalNeckVisible&&fit.headUnchanged&&fit.neckUnchanged);
 assert.equal(fit.skin,'#5fd04a');assert.deepEqual(fit.localPosition,[0,0,0]);
 assert.deepEqual(fit.localQuaternion,[0,0,0,1]);assert.deepEqual(fit.localScale,[1,1,1]);
 for(const view of ['front','side','body']){
  await page.evaluate(v=>alienFaceReview.draw(v),view);
  await page.locator('#viewport').screenshot({path:out+`/AlienFace-fit-${view}.png`});
 }
 const animation=await page.evaluate(async()=>{
  const {H,face}=alienFaceReview,head=H.model.getObjectByName('head');
  const g=await new Promise((res,rej)=>new THREE.GLTFLoader().load('/models/camper.glb',res,undefined,rej));
  const mixer=new THREE.AnimationMixer(H.model),checks=[];
  for(const name of ['Idle','Walk','Dig']){
   const action=mixer.clipAction(g.animations.find(a=>a.name===name));action.play();mixer.setTime(.37);H.model.updateMatrixWorld(true);
   checks.push({clip:name,attached:face.parent===head,finite:face.matrixWorld.elements.every(Number.isFinite),originalHeadVisible:H.model.getObjectByName('CGLCamper_Head').visible});mixer.stopAllAction();
  }
  return checks;
 });
 assert.ok(animation.every(a=>a.attached&&a.finite&&a.originalHeadVisible));assert.deepEqual(errors,[]);
 const validation={bytes:bytes.length,triangles:meta.triangles,sourceCamperSHA256:meta.source_camper_sha256,fit,animation};
 fs.writeFileSync(out+'/AlienFace-validation.json',JSON.stringify(validation,null,2)+'\n');
 console.log(JSON.stringify(validation,null,2));
}finally{if(browser)await browser.close();server.kill();}
