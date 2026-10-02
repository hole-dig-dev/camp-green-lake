/* Review Blender pipeline exports using the game's actual loader/materials.
   run.sh <port> tests/goldfx/pipeshots.cjs <port> <out>
   The browser helper passes the required Radeon/Vulkan flags. */
const {browser,player}=require('../carry/lib2.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const PORT=process.argv[2],OUT=process.argv[3];
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const b=await browser(),errs=[];
  try{
    const p=await player(b,PORT,'PipeReview',errs);
    await p.setViewportSize({width:1440,height:900});
    await p.waitForFunction(()=>gfxTray&&gfxCrank);
    const audit=await p.evaluate(async()=>{
      GOD=true;window.lsPlan=()=>null;tbWeeds.length=0;crewPanelOn=false;
      const s=SIM.GOLD.SIFTER,h=baseH(s.x,s.z);
      P.x=s.x-3;P.z=s.z+4;P.y=groundAt(P.x,P.z);
      window.__pipeView={eye:[-3.4,2.7,3.6],target:[-0.7,1.15,0]};
      window.updateCamera=()=>{
        camera.position.set(s.x+__pipeView.eye[0],h+__pipeView.eye[1],s.z+__pipeView.eye[2]);
        camera.lookAt(s.x+__pipeView.target[0],h+__pipeView.target[1],s.z+__pipeView.target[2]);
      };
      const names=['Sifter','PipeSection','PipeJoint','PipeCrack','PipeSlug','PipeIntake'];
      const parts=await Promise.all(names.map(modelParts));
      const materials=Object.fromEntries(names.map((n,i)=>[n,parts[i].map(p=>({
        name:p.material.name,transparent:p.material.transparent,opacity:p.material.opacity,depthWrite:p.material.depthWrite
      }))]));
      const inletResponse=await fetch('models/PipeInletPath.json');
      if(!inletResponse.ok||inletResponse.headers.get('content-type')!=='application/json')throw new Error('inlet JSON is not served');
      const path=await inletResponse.json();
      const blocked=await Promise.all(['models/other.json','models/..%2f..%2fserver.js'].map(async u=>(await fetch(u)).status));
      window.__pipeReview=new T.Group();scene.add(__pipeReview);
      const at=(x,extra={})=>Object.assign({x:s.x+x,y:h,z:s.z},extra);
      window.__pipeStraight=await placeModel('PipeSection',at(-7.4,{sx:5.5}),__pipeReview);
      for(const x of [-7.4,-4.65,-1.9]){
        const g=await placeModel('PipeJoint',at(x),__pipeReview);
        if(x===-4.65)window.__pipeMidJoint=g;
      }
      await placeModel('PipeIntake',at(-7.75,{ry:Math.PI}),__pipeReview);
      window.__pipeRunSlug=await placeModel('PipeSlug',at(-4.0),__pipeReview);
      window.__pipeCrack=await placeModel('PipeCrack',at(-4.65),__pipeReview);
      __pipeCrack.visible=false;
      /* Offset the authored slug axis into a pivot before rotating along a path. */
      const pivot=new T.Group();pivot.position.set(s.x-1.6,h+1.18,s.z);
      pivot.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),new T.Vector3(0,1,0));
      scene.add(pivot);
      const slug=await placeModel('PipeSlug',{x:0,y:0,z:0},pivot);
      slug.position.y=-0.24;
      window.__pipePathSlug=pivot;
      const matrices={tray:gfxTray.children[0].matrix.elements,crank:gfxCrank.position.toArray()};
      return{gpu:GPU_NAME,materials,path:path.points,matrices,blocked};
    });
    assert.match(audit.gpu,/AMD|RADV|Radeon/i);
    assert.doesNotMatch(audit.gpu,/swiftshader|llvmpipe|software/i);
    assert.deepEqual(audit.path[0],[-1.9,0.24,0]);
    assert.deepEqual(audit.path.at(-1),[-0.85,1.9,0]);
    assert.deepEqual(audit.blocked,[404,404],'unlisted model JSON and traversal stay blocked');
    for(const n of ['Sifter','PipeSection','PipeJoint','PipeCrack','PipeIntake']){
      assert.ok(audit.materials[n].some(m=>m.transparent&&m.opacity<0.3&&!m.depthWrite),n+' has clear walls');
    }
    await p.addStyleTag({content:'#hud,#crosshair,#prompt,#toasts,#crewPanel,#coords,#labels{visibility:hidden!important}'});
    async function shot(name,eye,target){
      if(eye)await p.evaluate(([eye,target])=>{__pipeView={eye,target}},[eye,target]);
      await p.waitForTimeout(350);
      await p.screenshot({path:OUT+'/'+name+'.png'});
    }
    await shot('sifter-connector');
    await shot('pipe-connected',[-5.5,2.8,5.0],[-4.1,0.65,0]);
    await shot('pipe-sand-close',[-5.0,0.9,1.7],[-4.0,0.24,0]);
    await p.evaluate(async()=>{
      __pipeCrack.visible=true;__pipeStraight.visible=false;__pipeMidJoint.visible=false;__pipeRunSlug.visible=false;
      const s=SIM.GOLD.SIFTER,y=baseH(s.x,s.z);
      /* Replace a 1 m stretch at the middle with the broken fitting. */
      for(const x of [-7.4,-4.15])await placeModel('PipeSection',{x:s.x+x,y,z:s.z,sx:2.25},__pipeReview);
    });
    await shot('pipe-crack-close',[-5.8,1.6,2.2],[-4.65,0.36,0]);
    /* Use open lakebed for the distance check, clear of camp tents and fence. */
    const dy=await p.evaluate(async()=>{
      const s=SIM.GOLD.SIFTER,y=groundAt(s.x-10,s.z-25),dy=y-baseH(s.x,s.z);
      await placeModel('PipeCrack',{x:s.x-10,y,z:s.z-25});
      return dy;
    });
    await shot('pipe-crack-20m',[-10,dy+1.8,-45],[-10,dy+0.45,-25]);
    fs.writeFileSync(OUT+'/audit.json',JSON.stringify(audit,null,2)+'\n');
    assert.deepEqual(errs,[],'no browser exceptions');
    console.log('PASS pipeline screenshots; clear walls, exact path endpoints, Radeon GPU; no browser exceptions');
  }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
