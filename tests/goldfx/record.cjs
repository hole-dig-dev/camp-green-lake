// Records a scene to MP4: CDP screencast frames (with their timestamps) -> ffmpeg concat at true speed.
const {browser}=require('../carry/lib.cjs');const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const PORT=process.argv[2],SCENE=process.argv[3],OUT=process.argv[4];
const W=1280,H=720;
const walkTo=async(p,x,z,maxS,run)=>{const t0=Date.now();if(run)await p.keyboard.down('Shift');await p.keyboard.down('w');
  while(Date.now()-t0<maxS*1000){const d=await p.evaluate(([x,z])=>{const a=Math.atan2(-(x-P.x),-(z-P.z));let dy=a-P.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));P.yaw+=dy*0.35;return Math.hypot(x-P.x,z-P.z)},[x,z]);if(d<0.9)break;await p.waitForTimeout(60)}
  await p.keyboard.up('w');if(run)await p.keyboard.up('Shift')};
const turnTo=async(p,yaw,ms)=>{const n=Math.max(1,ms/40);for(let i=0;i<n;i++){await p.evaluate(([y,k])=>{let dy=y-P.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));P.yaw+=dy*k},[yaw,1/(n-i)]);await p.waitForTimeout(40)}};
const dig=async(p,ms)=>{await p.keyboard.down('e');const t0=Date.now();   // dig until the hole's as deep as your tool goes
  while(Date.now()-t0<ms){await p.waitForTimeout(100);if(await p.evaluate(()=>{let d=0;forNearHoles(P.x,P.z,h=>{if(h.own&&Math.hypot(h.x-P.x,h.z-P.z)<2.2)d=Math.max(d,h.d)});return d>=digDepthMax()-0.002||S.bucket>=bucketMax()-1e-3}))break}
  await p.waitForTimeout(250);await p.keyboard.up('e')};
const step=async(p,ms)=>{await p.keyboard.down('d');await p.waitForTimeout(ms);await p.keyboard.up('d');await p.waitForTimeout(150)};
(async()=>{const b=await browser(),errs=[];
const ctx=await b.newContext({viewport:{width:W,height:H}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://127.0.0.1:${PORT}/?r=1`);await p.waitForFunction(()=>!document.querySelector('#startBtn').disabled,null,{timeout:30000});
await p.evaluate(()=>{document.querySelector('#nick').value='Caveman';document.querySelector('#startBtn').click()});
await p.waitForFunction(()=>!document.querySelector('#hud').hidden&&MODEL.ready,null,{timeout:60000});
await p.evaluate(()=>{runCommand('time 9:30');runCommand('roster off');GOD=true;window.lsPlan=()=>null;window.twPlan&&(window.twPlan=()=>null);tbWeeds.length=0;crewPanelOn=false;S.water=200});
// a clean start: a stretch of open lake just outside the gate, no tutorial toasts
const scene=SCENE;
await p.evaluate(sc=>{
  if(sc==='pan'){S.up={pan:true};S.seeds=0;S.bucket=0}
  else{S.up={pan:true,shovel:true,bucket:true};S.seeds=60;S.bucket=0}
  P.x=-22;P.z=15;P.y=groundAt(P.x,P.z);P.yaw=0.25;P.fa=Math.PI/2;P.pitch=0.55;   // open ground just west of the gate (no old holes for 16 m east)
},scene);
await p.waitForTimeout(3500);await p.evaluate(()=>{document.querySelectorAll('#toasts > *').forEach(e=>e.remove())});
// --- record ---
const cdp=await ctx.newCDPSession(p);const frames=[];const dir=path.join(path.dirname(OUT),'frames-'+SCENE);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
cdp.on('Page.screencastFrame',async f=>{const i=frames.length;fs.writeFileSync(path.join(dir,String(i).padStart(5,'0')+'.jpg'),Buffer.from(f.data,'base64'));frames.push(f.metadata.timestamp);try{await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId})}catch(e){}});
await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:W,maxHeight:H,everyNthFrame:1});
await p.waitForTimeout(800);
if(scene==='pan'){
  // three shallow holes by hand: the pan fills
  for(let k=0;k<5;k++){await dig(p,9000);if(await p.evaluate(()=>S.bucket>=bucketMax()-1e-3))break;await step(p,700)}
  await p.waitForTimeout(1200);
  // back through the gate to the water drums
  await walkTo(p,0,26,12,true);await walkTo(p,0.5,28.7,5,true);await walkTo(p,10.7,28.8,8,true);await walkTo(p,11.3,34.6,6);   // the wash tub's open side
  await p.evaluate(()=>{P.yaw=Math.atan2(-(TUB.x-P.x),-(TUB.z-P.z));P.pitch=0.6});await p.waitForTimeout(500);
  await p.keyboard.press('f');await p.waitForFunction(()=>gfxBusy());await p.waitForFunction(()=>!gfxBusy(),null,{timeout:12000});
}else{
  // five holes with the shovel: the bucket fills
  for(let k=0;k<7;k++){await dig(p,9000);if(await p.evaluate(()=>S.bucket>=bucketMax()-1e-3))break;await step(p,900)}
  await p.waitForTimeout(1200);
  // in through the gate, along the fence, up to the sifter
  await walkTo(p,0,26,12,true);await walkTo(p,0.5,28.7,5,true);await walkTo(p,10.7,28.8,8,true);await walkTo(p,10.7,36.4,8);
  await walkTo(p,12.8,37.6,4);await walkTo(p,12.6,39.2,4);   // to the sifter's east end (within its reach): the camera looks west along it
  await turnTo(p,Math.PI/2,700);await p.evaluate(()=>{P.pitch=0.24});await p.waitForTimeout(500);
  await p.keyboard.press('f');await p.waitForFunction(()=>gfxBusy());await p.waitForFunction(()=>!gfxBusy(),null,{timeout:14000});
}
await p.waitForTimeout(1500);
await cdp.send('Page.stopScreencast');await p.waitForTimeout(300);
const gold=await p.evaluate(()=>S.seeds);if(errs.length)throw new Error(errs.join('|'));if(!(await p.evaluate(()=>S.bucket===0)))throw new Error('Sand was not processed');
// --- encode at true speed ---
const list=[];for(let i=0;i<frames.length;i++){const d=i+1<frames.length?frames[i+1]-frames[i]:0.04;list.push(`file '${String(i).padStart(5,'0')}.jpg'`,`duration ${Math.max(0.005,d).toFixed(4)}`)}
list.push(`file '${String(frames.length-1).padStart(5,'0')}.jpg'`);fs.writeFileSync(path.join(dir,'list.txt'),list.join('\n'));
execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(dir,'list.txt'),'-vf','fps=30,format=yuv420p','-c:v','libx264','-crf','20','-preset','medium','-movflags','+faststart',OUT]);
console.log(SCENE,'frames',frames.length,'over',(frames[frames.length-1]-frames[0]).toFixed(1),'s | gold at the end',gold,'| errors',errs.join('|')||'none');
await b.close()})();
