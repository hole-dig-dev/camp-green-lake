/* Capture both sides of a change with actual cinematic time in frames.json.
   GOLDFX_BASELINE=1 serves the committed assets/code, without changing the worktree. */
const {browser,player}=require('../carry/lib2.cjs');
const fs=require('fs'),{execFileSync}=require('child_process');
const PORT=process.argv[2],SP=process.argv[3],KIND=process.argv[4];
(async()=>{
  fs.mkdirSync(SP,{recursive:true});const b=await browser(),errs=[];
  if(process.env.GOLDFX_BASELINE){
    const ref=process.env.GOLDFX_BASELINE==='1'?'8705f438c0391735d345b68d30d2d99fc0639a04':process.env.GOLDFX_BASELINE;
    const route=b.newContext.bind(b);b.newContext=async opts=>{
      const ctx=await route(opts);
      for(const file of ['js/89-goldfx.js','js/45-state.js','models/Sifter.glb','models/GoldPan.glb'])await ctx.route('**/'+file,r=>r.fulfill({body:execFileSync('git',['show',ref+':public/'+file],{maxBuffer:2e6}),contentType:file.endsWith('.glb')?'model/gltf-binary':'text/javascript'}));
      return ctx;
    };
  }
  const p=await player(b,PORT,'Shot',errs);await p.setViewportSize({width:1280,height:720});
  await p.evaluate(k=>{runCommand('time 10:00');GOD=true;window.lsPlan=()=>null;tbWeeds.length=0;crewPanelOn=false;
    if(k==='sift'){S.up={pan:true,shovel:true,bucket:true};S.bucket=5;P.x=12.6;P.z=38.6;}else{S.up={pan:true};S.bucket=1;P.x=8.6;P.z=35.6}
    P.y=groundAt(P.x,P.z);P.yaw=k==='pan'?Math.atan2(-(TUB.x-P.x),-(TUB.z-P.z)):Math.PI/2;P.pitch=k==='pan'?.7:.4;
  },KIND);
  await p.waitForTimeout(2500);await p.evaluate(()=>document.querySelectorAll('#toasts > *').forEach(e=>e.remove()));
  if(!process.env.GOLDFX_BASELINE)await p.waitForFunction(()=>GFX_ASSETS.every(n=>gfxParts[n])&&gfxTray);
  console.log('prompt',await p.evaluate(()=>$('#prompt').textContent));await p.keyboard.press('f');
  await p.waitForFunction(()=>gfxBusy());const duration=await p.evaluate(()=>GFX.on==='pan'?GFX_PAN_T:GFX_SIFT_T),frames=[],start=Date.now();
  for(let i=0;i<Math.ceil((duration+.6)/.5);i++){
    await p.waitForTimeout(Math.max(1,start+(i+1)*500-Date.now()));
    const state=await p.evaluate(()=>({t:GFX.t,busy:gfxBusy(),gold:S.seeds}));
    const name=`fx_${KIND}_${String(i).padStart(2,'0')}.png`;await p.screenshot({path:`${SP}/${name}`});frames.push({file:name,...state});
  }
  fs.writeFileSync(`${SP}/frames-${KIND}.json`,JSON.stringify(frames,null,2));
  console.log('gold',await p.evaluate(()=>S.seeds),'busy',await p.evaluate(()=>gfxBusy()),'errors',errs.join('|')||'none');
  await b.close();if(errs.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
