/* Real-browser contract checks: preselected payouts, physical burial, fixed gold size, re-entry and cleanup. */
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
        window.__goldAudit={calls:0,disposals:0,early:0,shown:0,buried:0,caughtBuried:0,caughtExposed:0,invalidSize:0,frames:0,modes:{}};
        if(!window.__goldOldUpdate){window.__goldOldUpdate=updateGoldFx;window.updateGoldFx=function(dt){
          __goldOldUpdate(dt);if(!GFX.on)return;__goldAudit.frames++;
          if(S.seeds!==100)__goldAudit.early++;
          const a=__goldAudit,matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),ray=new T.Raycaster(),cover=[];
          const roots=GFX.on==='pan'?[GFX.panSand,GFX.panBlack]:[GFX.bucketSand,GFX.hopperSand,GFX.stream,...GFX.beds.map(b=>b.model),...GFX.bucket.children];
          roots.forEach(root=>{if(!root.visible)return;root.updateMatrixWorld(true);root.traverse(o=>{if(o.isMesh){let shown=true;for(let parent=o;parent;parent=parent.parent)if(!parent.visible)shown=false;if(shown)cover.push(o)}})});
          if(gfxGoldIM.count!==gfxGd.length||gfxGoldIM.material.transparent||gfxGoldIM.material.opacity!==1)a.invalidSize++;
          gfxGd.forEach((g,i)=>{
            a.modes[g.m]=(a.modes[g.m]||0)+1;
            gfxGoldIM.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
            if(GFX.on==='sift'&&(g.m==='tray'||g.m==='wash')&&(g.spd>=.30||g.washSpeed>=.30||g.y>=trayAt(g.u,g.w).y))a.invalidSize++;
            if(g.fade!=null||Math.abs(g.s-a.sizes[i])>1e-8||[scale.x,scale.y,scale.z].some(v=>Math.abs(v-g.s)>1e-6))a.invalidSize++;
            const target=new T.Vector3(g.x,g.y,g.z),distance=target.distanceTo(camera.position);
            ray.set(camera.position,target.sub(camera.position).normalize());ray.far=distance;
            const buried=ray.intersectObjects(cover,false).some(hit=>hit.distance<distance-.001);
            if(buried){a.buried++;if(g.m==='caught')a.caughtBuried++}else{a.shown++;if(g.m==='caught')a.caughtExposed++;if(GFX.t<.5)a.early++}
          });
        }}
        if(kind==='zero')gfxStart('sift',{gold:0,holes:5},()=>{});else if(kind==='pan')washPan();else siftBucket();
        __goldAudit.sizes=gfxGd.map(g=>g.s);
        const done=GFX.done;GFX.done=()=>{__goldAudit.calls++;done()};
        GFX.materials.forEach(m=>m.addEventListener('dispose',()=>__goldAudit.disposals++));
        window.__goldRoot=GFX.root;
        return{reward:GFX.p.gold,mats:GFX.materials.length,duplicate:gfxStart('pan',{gold:999},()=>{__goldAudit.calls+=100})};
      },kind);
      assert.equal(start.duplicate,false,'active cinematic rejects re-entry');assert.ok(Number.isFinite(start.reward),'reward chosen before playback');
      await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>S.seeds),100,'payout is delayed');
      await p.waitForFunction(()=>!gfxBusy(),null,{timeout:14000});
      const end=await p.evaluate(()=>({...__goldAudit,gold:S.seeds,bucket:S.bucket,yaw:P.yaw,pitch:P.pitch,clean:GFX.root===null&&__goldRoot.parent===null&&!gfxSandIM.visible&&!gfxGoldIM.visible&&!gfxDropIM.visible&&!gfxDustIM.visible&&gfxTray.position.y===0}));
      assert.equal(end.calls,1,'completion called once');assert.equal(end.early,0,'no premature payout or initially unburied gold');
      assert.ok(end.frames>20,'cinematic ran across frames');assert.equal(end.disposals,start.mats,'temporary materials disposed');assert.ok(end.clean,'scene and pools cleaned');
      assert.equal(end.yaw,.4);assert.equal(end.pitch,.3);
      assert.equal(end.gold,100+(kind==='zero'?0:start.reward),'payout matches the original payload');
      if(kind!=='zero')assert.equal(end.bucket,0,'processed sand emptied');
      assert.equal(end.invalidSize,0,'all gold is drawn at its original size and full opacity throughout');
      if(start.reward>0){
        assert.ok(end.buried>0&&end.shown>0,'actual geometry covers and then uncovers the gold');
        if(kind==='sift'){
          for(const mode of ['bucket','pour','hopper','tray','caught','wash','rest'])assert.ok(end.modes[mode]>0,'continuous gold path includes '+mode);
          assert.ok(end.caughtBuried>0&&end.caughtExposed>0,'gold is buried then uncovered behind the riffles');
        }
      }else assert.equal(end.shown,0,'zero reward invents no gold');
      console.log('PASS',kind,'reward',start.reward,'frames',end.frames,'buried/exposed samples',end.buried+'/'+end.shown,'riffle samples',end.caughtBuried+'/'+end.caughtExposed);
    }
    assert.deepEqual(errs,[],'no browser exceptions');
  }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
