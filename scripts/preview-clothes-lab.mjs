// Capture all Blender clothing sets on the actual camper and exercise modular skinning and movement.
import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
const out=process.env.CLOTHES_OUT||new URL('../tests/out/clothes-lab',import.meta.url).pathname;
fs.mkdirSync(out,{recursive:true});const url=process.env.CLOTHES_URL||'http://127.0.0.1:4301/clothes-lab/',origin=new URL(url).origin;
for(const [file,type]of [['/clothes-lab/','text/html'],['/clothes-lab/manifest.json','application/json'],['/clothes-lab/viewer.js','text/javascript']]){const head=await fetch(origin+file,{method:'HEAD'});assert.equal(head.status,200);assert.ok(head.headers.get('content-type').startsWith(type));assert.equal((await head.arrayBuffer()).byteLength,0)}
for(const bad of ['/clothes-lab/server.js','/clothes-lab/manifest.json.bak','/clothes-lab/%2e%2fmanifest.json','/models/clothes/%2e%2f%2e%2fserver.js'])assert.equal((await fetch(origin+bad)).status,404);
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));await page.goto(url);await page.waitForFunction(()=>window.clothesLab?.ready,null,{timeout:60000});assert.equal(await page.locator('.card').count(),20);
 await page.screenshot({path:out+'/studio-desktop.png'});
 await page.evaluate(()=>document.body.classList.add('gallery-only'));await page.screenshot({path:out+'/all-20.png',fullPage:true});
 for(let start=0;start<20;start+=5){await page.evaluate(start=>{document.querySelectorAll('.card').forEach((n,i)=>n.style.display=i>=start&&i<start+5?'':'none');document.querySelector('.grid').style.gridTemplateColumns='repeat(5,1fr)'},start);await page.setViewportSize({width:1500,height:650});await page.screenshot({path:out+`/clothes-${start+1}-${start+5}.png`,fullPage:true})}
 await page.evaluate(()=>{document.querySelectorAll('.card').forEach(n=>n.style.display='');document.querySelector('.grid').style.gridTemplateColumns='';document.body.classList.remove('gallery-only')});
 const result=await page.evaluate(()=>{
  const H=clothesLab,head=H.model.getObjectByName('CGLCamper_Head'),headData=JSON.stringify(head.geometry.attributes.position.array),rows=[];
  const jointNames=H.original.skeleton.bones.map(b=>b.name),baseBones=new Set(H.original.skeleton.bones);
  function skinPoint(n,i){const v=new THREE.Vector3().fromBufferAttribute(n.geometry.attributes.position,i);n.skeleton.update();return n.boneTransform(i,v)}
  for(let i=0;i<20;i++){
   H.pose('Rest');H.select(i);H.model.updateMatrixWorld(true);
   const set=H.clothes[i];let triangles=0;set.meshes.forEach(n=>triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3);
   const limb=set.meshes.find(n=>n.userData.surface==='L_Sleeve'),leg=set.meshes.find(n=>n.userData.surface==='L_Leg');
   const a=skinPoint(limb,Math.floor(limb.geometry.attributes.position.count/2)),b=skinPoint(leg,Math.floor(leg.geometry.attributes.position.count/2));
   H.pose('Dig',.55);const bentA=skinPoint(limb,Math.floor(limb.geometry.attributes.position.count/2));H.pose('Sit',.5);const bentB=skinPoint(leg,Math.floor(leg.geometry.attributes.position.count/2));
   const box=new THREE.Box3().setFromObject(set.scene);rows.push({id:i+1,name:H.manifest[i].name,triangles,slots:[...new Set(set.meshes.map(n=>n.userData.slot))],sharedBones:set.meshes.every(n=>n.skeleton.bones.every(b=>baseBones.has(b))),armMovement:a.distanceTo(bentA),legMovement:b.distanceTo(bentB),finite:[...box.min.toArray(),...box.max.toArray()].every(Number.isFinite),headUnchanged:headData===JSON.stringify(head.geometry.attributes.position.array),noseVisible:H.model.getObjectByName('CGLCamper_Nose').visible});
  }H.pose('Rest');H.select(0);return {rows,jointNames};
 });
 for(const d of result.rows){assert.deepEqual(d.slots.slice().sort(),['arms','legs','torso']);assert.ok(d.sharedBones&&d.finite&&d.headUnchanged&&d.noseVisible);assert.ok(d.armMovement>.01&&d.legMovement>.05,'clothing actually deforms with original elbow/knee animations');assert.ok(d.triangles<18000)}
 fs.writeFileSync(out+'/validation.json',JSON.stringify(result,null,2));
 await page.setViewportSize({width:360,height:800});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/studio-phone.png'});
 await page.getByRole('button',{name:'17 Garden Overalls',exact:true}).click();await page.locator('#arms').selectOption('4');await page.locator('#legs').selectOption('13');await page.locator('#face').selectOption('11');await page.locator('#hat').selectOption('7');await page.locator('#glasses').selectOption('1');await page.locator('#motion').selectOption('Walk');
 const mixed=await page.evaluate(()=>({chosen:clothesLab.chosen,visible:clothesLab.clothes.flatMap(h=>h.scene.visible?h.meshes.filter(n=>n.visible).map(n=>({slot:n.userData.slot,name:n.name})):[]),extras:[clothesLab.faces,clothesLab.hats,clothesLab.glasses].map(a=>a.filter(h=>h.scene.visible).length)}));
 assert.deepEqual(mixed.chosen,{torso:16,arms:4,legs:13});assert.deepEqual(mixed.extras,[1,1,1]);assert.ok(mixed.visible.every(n=>n.name.startsWith('Garment_'+String(mixed.chosen[n.slot]+1).padStart(2,'0'))));
 await page.getByRole('button',{name:'☆ Save this pick',exact:true}).click();assert.match(await page.locator('#saved').textContent(),/17/);await page.getByRole('button',{name:'▶ Play movement',exact:true}).click();await page.waitForTimeout(350);await page.getByRole('button',{name:'Ⅱ Pause movement',exact:true}).click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/mixed-phone.png'});
 await page.setViewportSize({width:1280,height:1000});await page.evaluate(()=>{clothesLab.select(5);clothesLab.pose('Dig',.55);scrollTo(0,0)});await page.screenshot({path:out+'/hoodie-dig.png'});
 await page.evaluate(()=>{clothesLab.select(16);clothesLab.pose('Sit',.5)});await page.screenshot({path:out+'/overalls-sit.png'});
 assert.deepEqual(errors,[]);console.log('20 outfits: shared camper bones, unchanged head/nose, actual arm/leg deformation, independent torso/arm/leg mixing, accessory combinations, phone controls, animation playback and favorites passed.');
}finally{await browser.close()}
