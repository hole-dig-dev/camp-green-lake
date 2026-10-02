// Review Blender assets on the actual camper and in the actual game, without
// changing any runtime JS. Scratch server/browser files stay in this checkout.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const out=path.join(root,'art/blender/renders');
const scratch=path.join(root,'.ufo-tmp');fs.mkdirSync(scratch,{recursive:true});
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:path.join(scratch,'preview-data'),DEV_MODE:'1'},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/healthz`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,env:{...process.env,TMPDIR:scratch},args:['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const url=`http://127.0.0.1:${port}`;
 await page.goto(url+'/face-lab/');await page.waitForFunction(()=>window.faceLab?.ready,null,{timeout:60000});
 const fit=await page.evaluate(async()=>{
  const H=faceLab,T=THREE,gl=H.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu=gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  const alien=await new Promise((res,rej)=>new T.GLTFLoader().load('/models/AlienHead.glb',res,undefined,rej));
  H.faces.forEach(f=>f.scene.visible=false);H.hats.forEach(f=>f.scene.visible=false);
  const hidden=[];
  H.model.traverse(n=>{if(n.isMesh&&(/^CGLCamper_(Head|Nose|Eye|Brow|Mouth|Teeth)/.test(n.name)||/_(Bucket|Cowboy|DesertCap|Hair|Shades)_/.test(n.name))){n.visible=false;hidden.push(n.name)}});
  const seen=new Set();alien.scene.traverse(n=>{if(n.isMesh)for(const m of[].concat(n.material)){if(!seen.has(m)){seen.add(m);m.color.convertLinearToSRGB()}}});
  const head=H.model.getObjectByName('head');head.add(alien.scene);H.model.updateMatrixWorld(true);
  // Measure the retained neck in HEAD space, from the actual GLB vertices.
  const neck=H.model.getObjectByName('CGLCamper_Neck'),p=neck.geometry.attributes.position;
  const intoHead=head.matrixWorld.clone().invert().multiply(neck.matrixWorld);
  const verts=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(intoHead));
  const neckBounds=new T.Box3().setFromPoints(verts);
  const fitByBody=Object.entries({average:[1,1],slim:[.86,.9],stocky:[1.17,1.14],tall:[.95,.97],short:[1.06,1.05]}).map(([body,[w,d]])=>({body,
   covered:verts.every(v=>v.y>=-.105-1e-5&&v.y<=.065+1e-5&&Math.hypot(v.x*w,v.z*d/.87)<.182),
   neckWidth:neckBounds.max.x-neckBounds.min.x,neckDepth:neckBounds.max.z-neckBounds.min.z}));
  document.querySelector('#selectedName').textContent='Alien · real camper fit';
  document.querySelector('#selectedDescription').textContent='Replacement head on the unchanged head bone. Original head and cosmetics hidden; neck, body and rig retained.';
  document.querySelector('#selectedNumber').textContent='BLENDER ASSET · HEAD LOCAL METRES';
  const draw=view=>{
   const c=H.cam,w=H.renderer.domElement.clientWidth,h=H.renderer.domElement.clientHeight;
   const span=view==='body'?3.6:1.35,y=view==='body'?1.6:2.47;
   c.left=-span*w/h/2;c.right=-c.left;c.top=span/2;c.bottom=-c.top;c.updateProjectionMatrix();
   c.position.set(0,y,7);c.lookAt(0,y,0);H.model.rotation.y=view==='side'?-Math.PI/2:0;
   H.model.updateMatrixWorld(true);H.renderer.render(H.scene,c);
  };
  window.alienFit={alien:alien.scene,H,draw};
  draw('front');
  return {gpu,attached:alien.scene.parent===head,position:alien.scene.position.toArray(),scale:alien.scene.scale.toArray(),
   forward:'eyes at positive game Z',hidden,neckBounds:{min:neckBounds.min.toArray(),max:neckBounds.max.toArray()},fitByBody};
 });
 assert.match(fit.gpu,/AMD.*RADV|AMD.*radv/);assert.doesNotMatch(fit.gpu,/swiftshader|llvmpipe/i);
 assert.ok(fit.attached);assert.deepEqual(fit.position,[0,0,0]);assert.deepEqual(fit.scale,[1,1,1]);
 assert.ok(fit.fitByBody.every(b=>b.covered),'alien sleeve must fully cover the retained neck for every body type');
 await page.locator('#viewport').screenshot({path:out+'/AlienHead-fit-front.png'});
 await page.evaluate(()=>alienFit.draw('side'));await page.locator('#viewport').screenshot({path:out+'/AlienHead-fit-side.png'});
 await page.evaluate(()=>alienFit.draw('body'));await page.locator('#viewport').screenshot({path:out+'/AlienHead-fit-body.png'});
 // Verify the replacement stays attached through existing animation clips.
 const animation=await page.evaluate(()=>{
  const {H,alien}=alienFit,head=H.model.getObjectByName('head');
  // Re-load clips without touching the real fit model's bind geometry.
  return new Promise((res,rej)=>new THREE.GLTFLoader().load('/models/camper.glb',g=>{
   const mixer=new THREE.AnimationMixer(H.model),checks=[];
   for(const name of ['Idle','Walk','Dig']){const c=g.animations.find(a=>a.name===name);const a=mixer.clipAction(c);a.play();mixer.setTime(.37);H.model.updateMatrixWorld(true);
    checks.push({clip:name,attached:alien.parent===head,localOrigin:alien.position.toArray(),finite:alien.matrixWorld.elements.every(Number.isFinite)});mixer.stopAllAction()}
   res(checks)
  },undefined,rej))
 });
 assert.ok(animation.every(a=>a.attached&&a.finite));
 await page.goto(url+'/?r=1#dbg');await page.waitForFunction(()=>typeof MODEL!=='undefined'&&MODEL.ready&&typeof bots!=='undefined');
 await page.evaluate(()=>document.querySelector('#startBtn').click());
 await page.waitForFunction(()=>!document.querySelector('#hud').hidden);
 const game=await page.evaluate(async()=>{
  // Find undug ground so the crew member's full body is visible in the review.
  let at;
  for(let x=-8;x<=8&&!at;x+=2)for(let z=-6;z<=8;z+=2){
   if(holes.every(h=>Math.hypot(h.x-x,h.z-z)>HOLE_R+MR+1)&&Math.abs(groundAt(x,z)-baseH(x,z))<.05){at={x,z};break}
  }
  if(!at)throw Error('No clear review ground near camp');
  const ufo=await placeModel('UFO',{x:at.x,y:5.5,z:at.z});
  const gltf=await new Promise((res,rej)=>new T.GLTFLoader().load('models/AlienHead.glb',res,undefined,rej));
  // The real D Tent NPC keeps its body, skeleton and game materials.
  const b=bots.find(b=>b.d.n==='Zero')||bots[1];
  updateBots=()=>{};b.p.g.visible=true;b.p.g.position.set(at.x,groundAt(at.x,at.z),at.z);b.p.g.rotation.set(0,0,0);
  b.p.mixer.stopAllAction();setClip(b.p,'Idle',0);b.p.mixer.update(.2);
  const m=b.p.model,head=m.getObjectByName('head');
  m.traverse(n=>{if(n.isMesh&&(/^CGLCamper_(Head|Nose|Eye|Brow|Mouth|Teeth)/.test(n.name)||/_(Bucket|Cowboy|DesertCap|Hair|Shades)_/.test(n.name)))n.visible=false});
  for(const g of b.p.wardObjs||[])g.visible=false;
  const seen=new Set();gltf.scene.traverse(n=>{if(n.isMesh){n.castShadow=true;for(const mat of[].concat(n.material))if(!seen.has(mat)){seen.add(mat);mat.color.convertLinearToSRGB()}}});
  head.add(gltf.scene);m.updateMatrixWorld(true);
  const reviewCam=new T.PerspectiveCamera(48,innerWidth/innerHeight,.05,1000);
  reviewCam.position.set(at.x+8,5,at.z+13);reviewCam.lookAt(at.x,3.6,at.z);
  const originalRender=renderer.render.bind(renderer);renderer.render=(s,c)=>originalRender(s,s===scene?reviewCam:c);
  // Keep the screenshot camera and daylight stable while the game draws normally.
  CLK.paused=true;CLK.pt=tAtHour(12);nightF=()=>0;
  updateMood=()=>{};updateHaboob=()=>{};hemi.intensity=.7;sun.intensity=1.05;
  sky.material.color.setHex(0xffffff);scene.fog.color.copy(FOG_DAY);scene.fog.near=80;scene.fog.far=1000;
  P.x=at.x;P.z=at.z+8;P.y=groundAt(P.x,P.z);sky.position.copy(reviewCam.position);stars.visible=false;
  document.querySelectorAll('body > :not(#game):not(script):not(style)').forEach(n=>n.style.display='none');
  window.ufoReview={ufo,b,reviewCam,originalRender,at};
  const emission={};ufo.traverse(n=>{if(n.isMesh&&n.material.emissive?.toArray().some(v=>v>0))emission[n.material.name]=n.material.emissive.toArray()});
  return {gpu:GPU_NAME,crewMember:b.d.n,headAttached:gltf.scene.parent===head,emission,reviewGround:at};
 });
 assert.ok(game.headAttached);assert.equal(Object.keys(game.emission).length,4);
 await page.waitForTimeout(600);await page.screenshot({path:out+'/UFO-AlienHead-game.png'});
 await page.evaluate(()=>{const {reviewCam:c,at}=ufoReview;c.position.set(at.x+1.9,2.1,at.z+4);c.lookAt(at.x,1.45,at.z)});
 await page.waitForTimeout(200);await page.screenshot({path:out+'/AlienHead-game.png'});
 await page.evaluate(()=>{const {reviewCam:c,at}=ufoReview;c.position.set(at.x+60,5.5,at.z);c.lookAt(at.x,6.1,at.z)});
 await page.waitForTimeout(200);await page.screenshot({path:out+'/UFO-game-60m.png'});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/UFO-AlienHead-validation.json',JSON.stringify({fit,animation,game},null,2)+'\n');
 console.log(JSON.stringify({fit,animation,game},null,2));
}finally{if(browser)await browser.close();server.kill();}
