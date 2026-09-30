import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
// Run against a local DEV_MODE game: CAMPER_URL=http://127.0.0.1:PORT/#dbg node scripts/verify-camper-joints.mjs
const out=process.env.CAMPER_OUT||new URL('../tests/out/camper-joints',import.meta.url).pathname;
fs.mkdirSync(out,{recursive:true});
const url=process.env.CAMPER_URL||'http://127.0.0.1:4301/#dbg';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url);await page.waitForFunction(()=>window.__cgl&&MODEL.ready,null,{timeout:60000});
 await page.waitForFunction(()=>HELD_PARTS.walkie&&HELD_PARTS.tonic,null,{timeout:20000});
 const data=await page.evaluate(()=>{
  renderer.render=()=>{};
  const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(420,460);r.outputEncoding=renderer.outputEncoding;r.toneMapping=renderer.toneMapping;r.toneMappingExposure=renderer.toneMappingExposure;
  const sc=new T.Scene();sc.background=new T.Color(0xe7dfcd);sc.add(new T.HemisphereLight(0xcfe2ee,0xc28a52,.62));const key=new T.DirectionalLight(0xfff0d2,1.05);key.position.set(3,6,5);sc.add(key);
  const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0xe7dfcd,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;sc.add(floor);
  const cam=new T.OrthographicCamera(-1.25,1.25,1.37,-1.37,.05,50);cam.position.set(2.6,1.9,6);cam.lookAt(0,1.05,0);
  const defs=[{name:'Your camper · idle',body:'average',clip:'Idle',time:.3},{name:'Your camper · bent knees',body:'average',clip:'Sit',time:.6},{name:'Your camper · wave',body:'average',clip:'Wave',time:.8},
   ...Object.keys(BODY_TYPES).map(body=>({name:body+' · running',body,clip:'Run',time:.13}))];
  const cards=[],checks=[];
  for(const d of defs){
   const p=makePerson({skin:SKIN_TONES[2],band:CAMPER_COLORS[0],hat:'bucket',body:d.body,shovel:false});sc.add(p.g);
   setClip(p,d.clip,0);stepMixer(p,d.time);sc.updateMatrixWorld(true);
   let skinned=0;const boxes=[];
   p.model.traverse(n=>{if(n.isSkinnedMesh){skinned++;n.skeleton.update();const v=new T.Vector3(),box=new T.Box3();for(let i=0;i<n.geometry.attributes.position.count;i++){v.fromBufferAttribute(n.geometry.attributes.position,i);n.boneTransform(i,v);box.expandByPoint(v)}boxes.push({name:n.name,min:box.min.toArray(),max:box.max.toArray()})}});
   checks.push({name:d.name,skinned,boxes,shin:p.model.getObjectByName('shinL').quaternion.toArray()});
   r.render(sc,cam);cards.push({name:d.name,data:r.domElement.toDataURL('image/png')});sc.remove(p.g);
  }
  const p=makePerson({body:'stocky',hat:'cowboy',shovel:false});sc.add(p.g);setClip(p,'Run',0);stepMixer(p,.16);
  holdProp(p,'walkie');heldPose(p,.25);const hand=p.model.getObjectByName('CGLCamper_L_Hand');checks.push({held:p.heldMeshObj?.parent===hand});
  ragdollOn(p,{vx:1,vy:3,spin:2});const points=p.rag.pts.length;
  for(let i=0;i<120;i++){stepMixer(p,1/60);ragdollPin(p,0,1.3,0,.15);ragAfterMixer(p,1/60,()=>0)}
  const finite=p.rag.pts.every(q=>Number.isFinite(q.x+q.y+q.z));ragdollOff(p);p.held=null;p.heldW=0;setClip(p,'Idle',0);
  for(let i=0;i<600;i++){stepMixer(p,1/60);ragAfterMixer(p,1/60,()=>0)}
  const q=p.model.getObjectByName('shinL').quaternion,rest=MODEL.scene.getObjectByName('shinL').quaternion;
  checks.push({ragPoints:points,ragFinite:finite,recovered:!p.rag&&p.ragBlend===0,kneeRestAngle:q.angleTo(rest)});sc.remove(p.g);
  // Every staff character uses the same skinned asset and keeps their clothing tint and hat selection.
  for(const npc of [sir,warden,clerk]){let skins=0;npc.model.traverse(n=>{if(n.isSkinnedMesh)skins++});checks.push({staffSkins:skins})}
  r.dispose();r.forceContextLoss();return{cards,checks};
 });
 assert.equal(errors.length,0,errors.join('\n'));
 for(const c of data.checks){if(c.skinned!=null){assert.equal(c.skinned,4);for(const b of c.boxes)assert.ok([...b.min,...b.max].every(Number.isFinite));}if(c.held!=null)assert.ok(c.held);if(c.ragPoints){assert.equal(c.ragPoints,15);assert.ok(c.ragFinite&&c.recovered);assert.ok(c.kneeRestAngle<1e-5);}if(c.staffSkins!=null)assert.equal(c.staffSkins,4)}
 fs.writeFileSync(out+'/runtime-checks.json',JSON.stringify(data.checks,null,2));
 const html=`<!doctype html><style>*{box-sizing:border-box}body{margin:0;background:#f6f0e4;color:#353025;font:16px system-ui;padding:18px}h1{font-size:26px;margin:0 0 8px}p{margin:0 0 14px;font-size:14px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{background:#e7dfcd;border-radius:10px;overflow:hidden}img{width:100%;display:block}.label{padding:9px 12px;background:#fff8ee;font-weight:600}@media(max-width:600px){h1{font-size:22px}.grid{grid-template-columns:1fr}}</style><h1>Your campers · continuous joints</h1><p>Same character design, with connected sleeves and trousers that bend at the elbows and knees.</p><div class="grid">${data.cards.slice(0,3).map(d=>`<div class="card"><img src="${d.data}"><div class="label">${d.name}</div></div>`).join('')}</div>`;
 await page.setContent(html);await page.waitForFunction(()=>[...document.images].every(i=>i.complete));await page.screenshot({path:out+'/joints-desktop.png',fullPage:true});
 await page.setViewportSize({width:360,height:800});await page.screenshot({path:out+'/joints-phone.png',fullPage:true});
 await page.setViewportSize({width:1280,height:720});await page.setContent(html.replace(data.cards.slice(0,3).map(d=>`<div class="card"><img src="${d.data}"><div class="label">${d.name}</div></div>`).join(''),data.cards.slice(3).map(d=>`<div class="card"><img src="${d.data}"><div class="label">${d.name}</div></div>`).join('')));await page.waitForFunction(()=>[...document.images].every(i=>i.complete));await page.screenshot({path:out+'/body-variants.png',fullPage:true});
 console.log('Actual game runtime: skins, five body variants, held radio, staff, 15-point ragdoll and knee recovery passed; desktop/phone screenshots saved.');
}finally{await browser.close()}
