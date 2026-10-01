// Capture the Blender hat candidates on the actual game camper, and check all 20 can be selected.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out=process.env.HAT_OUT||new URL('../tests/out/hat-lab',import.meta.url).pathname;
fs.mkdirSync(out,{recursive:true});
const url=process.env.HAT_URL||'http://127.0.0.1:4301/hat-lab/';
const origin=new URL(url).origin;
for(const [file,type]of [['/hat-lab/','text/html'],['/hat-lab/manifest.json','application/json'],['/hat-lab/viewer.js','text/javascript']]){
 const head=await fetch(origin+file,{method:'HEAD'});assert.equal(head.status,200);assert.ok(head.headers.get('content-type').startsWith(type));assert.equal((await head.arrayBuffer()).byteLength,0);
}
for(const bad of ['/hat-lab/server.js','/hat-lab/manifest.json.bak','/hat-lab/%2e%2fmanifest.json','/hat-lab/vendor/%2e%2f%2e%2fserver.js'])assert.equal((await fetch(origin+bad)).status,404);
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));await page.goto(url);await page.waitForFunction(()=>window.hatLab?.ready,null,{timeout:60000});
 assert.equal(await page.locator('.card').count(),20);
 const result=await page.evaluate(()=>{
  const H=hatLab,out=[];
  const head=H.model.getObjectByName('head');H.model.updateMatrixWorld(true);
  for(let i=0;i<20;i++){H.select(i);const visible=H.hats.filter(h=>h.scene.visible).length;let meshes=0,triangles=0;
   H.hats[i].scene.traverse(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3}});
   out.push({id:i+1,name:H.manifest[i].name,visible,attached:H.hats[i].scene.parent===head,meshes,triangles,clearance:H.manifest[i].frontMinHeight-H.manifest[i].eyeLine});
  }H.select(0);return out;
 });
 for(const h of result){assert.equal(h.visible,1);assert.ok(h.attached&&h.meshes>1&&h.clearance>.073);assert.ok(h.triangles<20000)}
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/validation.json',JSON.stringify(result,null,2));
 await page.screenshot({path:out+'/studio-desktop.png'});
 await page.evaluate(()=>document.body.classList.add('gallery-only'));await page.screenshot({path:out+'/all-20.png',fullPage:true});
 for(let start=0;start<20;start+=5){
  await page.evaluate(start=>{document.querySelectorAll('.card').forEach((n,i)=>n.style.display=i>=start&&i<start+5?'':'none');document.querySelector('.grid').style.gridTemplateColumns='repeat(5,1fr)'},start);
  await page.setViewportSize({width:1500,height:580});await page.screenshot({path:out+`/hats-${start+1}-${start+5}.png`,fullPage:true});
 }
 await page.evaluate(()=>{document.querySelectorAll('.card').forEach(n=>n.style.display='');document.querySelector('.grid').style.gridTemplateColumns='';document.body.classList.remove('gallery-only')});
 await page.setViewportSize({width:360,height:800});await page.screenshot({path:out+'/studio-phone.png'});
 await page.getByRole('button',{name:'12 Night Shift Miner',exact:true}).click();await page.getByRole('button',{name:'Side',exact:true}).click();await page.getByRole('button',{name:'☆ Save this pick',exact:true}).click();assert.match(await page.locator('#saved').textContent(),/12/);assert.match(await page.locator('#selectedName').textContent(),/Night Shift Miner/);
 await page.screenshot({path:out+'/miner-phone.png'});
 console.log('20 hats: head attachments, front eye clearance, independent selections, mesh counts, phone controls and favorites passed; contact sheets captured.');
}finally{await browser.close()}
