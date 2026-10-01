/* Real-browser contract checks: preselected payouts, late reveal, re-entry and cleanup. */
const assert=require('node:assert/strict');
const {browser,player}=require('../carry/lib2.cjs');
(async()=>{
  const b=await browser(),errs=[];
  try{
    const p=await player(b,process.argv[2],'GoldCheck',errs);
    await p.evaluate(()=>{GOD=true;window.lsPlan=()=>null;tbWeeds.length=0});
    await p.waitForFunction(()=>GFX_ASSETS.every(n=>gfxParts[n])&&gfxTray);
    for(const kind of ['pan','sift','zero']){
      const start=await p.evaluate(kind=>{
        S.seeds=100;S.bucket=kind==='pan'?1:5;S.up=kind==='pan'?{pan:true}:{pan:true,bucket:true,shovel:true};
        P.x=kind==='pan'?8.6:12.6;P.z=kind==='pan'?35.6:38.6;P.y=groundAt(P.x,P.z);P.yaw=.4;P.pitch=.3;
        window.__goldAudit={calls:0,disposals:0,early:0,shown:0,frames:0};
        if(!window.__goldOldUpdate){window.__goldOldUpdate=updateGoldFx;window.updateGoldFx=function(dt){
          __goldOldUpdate(dt);if(!GFX.on)return;__goldAudit.frames++;
          if(S.seeds!==100)__goldAudit.early++;
          for(const g of gfxGd)if(g.fade>0){__goldAudit.shown++;if(GFX.on==='sift'&&g.m!=='rest')__goldAudit.early++;if(GFX.on==='pan'&&GFX.t<5.05)__goldAudit.early++}
        }}
        if(kind==='zero')gfxStart('sift',{gold:0,holes:5},()=>{});else if(kind==='pan')washPan();else siftBucket();
        const done=GFX.done;GFX.done=()=>{__goldAudit.calls++;done()};
        GFX.materials.forEach(m=>m.addEventListener('dispose',()=>__goldAudit.disposals++));
        window.__goldRoot=GFX.root;
        return{reward:GFX.p.gold,mats:GFX.materials.length,duplicate:gfxStart('pan',{gold:999},()=>{__goldAudit.calls+=100})};
      },kind);
      assert.equal(start.duplicate,false,'active cinematic rejects re-entry');assert.ok(Number.isFinite(start.reward),'reward chosen before playback');
      await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>S.seeds),100,'payout is delayed');
      await p.waitForFunction(()=>!gfxBusy(),null,{timeout:14000});
      const end=await p.evaluate(()=>({...__goldAudit,gold:S.seeds,bucket:S.bucket,yaw:P.yaw,pitch:P.pitch,clean:GFX.root===null&&__goldRoot.parent===null&&!gfxSandIM.visible&&!gfxGoldIM.visible&&!gfxDropIM.visible&&!gfxDustIM.visible&&gfxTray.position.y===0}));
      assert.equal(end.calls,1,'completion called once');assert.equal(end.early,0,'no premature payout or gold reveal');
      assert.ok(end.frames>20,'cinematic ran across frames');assert.equal(end.disposals,start.mats,'temporary materials disposed');assert.ok(end.clean,'scene and pools cleaned');
      assert.equal(end.yaw,.4);assert.equal(end.pitch,.3);
      assert.equal(end.gold,100+(kind==='zero'?0:start.reward),'payout matches the original payload');
      if(kind!=='zero')assert.equal(end.bucket,0,'processed sand emptied');
      if(start.reward>0)assert.ok(end.shown>0,'selected gold was visible');else assert.equal(end.shown,0,'zero reward invents no gold');
      console.log('PASS',kind,'reward',start.reward,'frames',end.frames,'revealed samples',end.shown);
    }
    assert.deepEqual(errs,[],'no browser exceptions');
  }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
