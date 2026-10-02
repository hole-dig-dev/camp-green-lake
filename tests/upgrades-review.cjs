/* Actual game renderer/loader review. Own server: tests/run-upgrades-review.sh. */
const {browser,player}=require('./carry/lib.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict');
const PORT=process.argv[2]||'4318',OUT='art/blender/renders/upgrades-game';
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});const b=await browser(),errors=[];
 try{
  const p=await player(b,PORT,'UpgradeReview',errors);await p.setViewportSize({width:1440,height:900});
  await p.addStyleTag({content:'body > :not(#game) { visibility: hidden !important; }'});
  const audit=await p.evaluate(async()=>{
   GOD=true;window.lsPlan=()=>null;tbWeeds.length=0;crewPanelOn=false;
   /* Keep asset review in daylight while seeded weather would otherwise dim the shots. */
   window.updateHaboob=()=>{};window.nightF=()=>0;
   sun.intensity=1.05;hemi.intensity=.62;sky.material.color.copy(WHITE);scene.fog.color.copy(FOG_DAY);
   const s=SIM.GOLD.SIFTER,h=baseH(s.x,s.z),frame=new T.Group();frame.position.set(s.x,h,s.z);frame.rotation.y=s.ry||0;scene.add(frame);
   const staticNames=['Dynamite','DynamiteHeld','LooseSand','Scarecrow','DisarmKit','GrappleHook','GrappleHookHead','GoldScale','PipePump','PipeSectionSteel'];
   const at=(x=0,y=0,z=0)=>({x,y,z});
   const objects={};
   for(const [name,x,y,z]of [['Dynamite',2.4,0,2.1],['LooseSand',0,0,-3],['Scarecrow',-3,0,-2.2],['GoldScale',0,0,0],['PipePump',0,0,0],['PipeSectionSteel',-7.4,0,0],['GrappleHookHead',2.0,.5,1.1]]){
    objects[name]=await placeModel(name,{...at(x,y,z),sx:name==='PipeSectionSteel'?5.5:1},frame);
   }
   objects.slug=await placeModel('PipeSlug',at(-4.8),frame);
   const load=url=>new Promise((res,rej)=>new T.GLTFLoader().load(url,res,undefined,rej));
   const dog=await load('models/Dog.glb');frame.add(dog.scene);dog.scene.position.set(2.7,0,1.8);dog.scene.rotation.y=-.25;
   dog.scene.traverse(n=>{if(n.isMesh){n.material=gameMat(n.material).clone();n.material.skinning=!!n.isSkinnedMesh;n.frustumCulled=false}});
   const dogMixer=new T.AnimationMixer(dog.scene);
   const animated={};
   for(const clip of dog.animations){
    dogMixer.stopAllAction();const act=dogMixer.clipAction(clip).play();dogMixer.update(.031);dog.scene.updateMatrixWorld(true);
    const bone=dog.scene.getObjectByName(clip.name==='Bark'?'jaw':'tail');const before=bone.quaternion.clone();
    dogMixer.update(.083);dog.scene.updateMatrixWorld(true);animated[clip.name]={length:clip.duration,moved:before.angleTo(bone.quaternion)>1e-4};
    if(clip.name==='Sniff'){
     let min=Infinity;dog.scene.traverse(n=>{if(n.isSkinnedMesh){n.skeleton.update();const pos=n.geometry.attributes.position;
      for(let i=0;i<pos.count;i++)min=Math.min(min,n.boneTransform(i,new T.Vector3().fromBufferAttribute(pos,i)).y);
     }});animated[clip.name].minY=min;
    }
   }
   const camper=T.SkeletonUtils.clone(MODEL.scene);frame.add(camper);camper.scale.setScalar(MODEL_SCALE);camper.position.set(4,0,.9);
   camper.traverse(n=>{if(n.isMesh&&(/_(Bucket|Cowboy|DesertCap|Hair|Shades)_/.test(n.name)||n.name.includes('_R_Shovel')||/^CGLCamper_[LR]_(Shoe|Sole)$/.test(n.name)))n.visible=false});
   camper.updateMatrixWorld(true);const original=camper.getObjectByName('CGLCamper_L_Sleeve');
   const normalize=n=>n.replace(/\./g,''),map=new Map(original.skeleton.bones.map((bone,i)=>[normalize(bone.name),{bone,inverse:original.skeleton.boneInverses[i]}]));
   const boot=await load('models/footwear/gravity-boots.glb'),meshes=[];boot.scene.updateMatrixWorld(true);boot.scene.traverse(n=>{if(n.isMesh)meshes.push(n)});
   const boots=new T.Group();camper.add(boots);let shared=true;
   for(const n of meshes){
    let meta=n;while(meta&&!meta.userData.slot)meta=meta.parent;
    if(!n.isSkinnedMesh||meta?.userData.slot!=='footwear')throw Error('Footwear contract missing');
    const matches=n.skeleton.bones.map(b=>map.get(normalize(b.name)));if(matches.some(m=>!m))throw Error('Unmatched camper joint');
    boots.add(n);n.position.set(0,0,0);n.quaternion.identity();n.scale.set(1,1,1);n.updateMatrixWorld(true);
    n.bind(new T.Skeleton(matches.map(m=>m.bone),matches.map(m=>m.inverse.clone())),original.bindMatrix.clone());n.frustumCulled=false;
    n.material=n.material.clone();n.material.color.convertLinearToSRGB();n.material.skinning=true;
    shared=shared&&n.skeleton.bones.every((bone,i)=>bone===matches[i].bone);
   }
   const cmix=new T.AnimationMixer(camper),cclip=MODEL.clips.find(c=>c.name==='Walk');
   if(!cclip)throw Error('Camper Walk missing');cmix.clipAction(cclip).play();cmix.update(.12);camper.updateMatrixWorld(true);
   const shin=map.get('shinL').bone,before=shin.matrixWorld.clone(),bootMesh=meshes.find(n=>n.name.includes('_L_'));
   bootMesh.skeleton.update();const vertex=new T.Vector3().fromBufferAttribute(bootMesh.geometry.attributes.position,0),v0=bootMesh.boneTransform(0,vertex.clone());
   cmix.update(.27);camper.updateMatrixWorld(true);bootMesh.skeleton.update();
   const vertexMoved=v0.distanceTo(bootMesh.boneTransform(0,vertex.clone()))>1e-5;
   const moved=before.elements.some((v,i)=>Math.abs(v-shin.matrixWorld.elements[i])>1e-5);
   const hand=camper.getObjectByName('CGLCamper_R_Hand');if(!hand)throw Error('Camper right hand missing');
   const tools={};for(const name of ['DynamiteHeld','DisarmKit','GrappleHook']){
    const group=new T.Group();hand.add(group);group.position.set(0,-.1,0);
    const ws=hand.getWorldScale(new T.Vector3());group.scale.setScalar(1/ws.x);
    group.quaternion.copy(hand.getWorldQuaternion(new T.Quaternion()).invert().multiply(frame.getWorldQuaternion(new T.Quaternion())));
    tools[name]=group;await placeModel(name,at(),group);group.visible=false;
   }
   window.__up={frame,dog,dogMixer,cmix,camper,boots,tools,objects,eye:new T.Vector3(-6.5,6,-7),target:new T.Vector3(-.5,1,1)};
   P.x=s.x+4;P.z=s.z+5;P.y=groundAt(P.x,P.z);
   window.updateCamera=()=>{camera.position.copy(frame.localToWorld(__up.eye.clone()));camera.lookAt(frame.localToWorld(__up.target.clone()))};
   const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'',staticNames,animated,boots:{shared,moved,vertexMoved,meshes:meshes.length,hidden:['L','R'].every(side=>['Shoe','Sole'].every(part=>!camper.getObjectByName('CGLCamper_'+side+'_'+part).visible))}};
  });
  assert.match(audit.renderer,/AMD.*Vulkan|Vulkan.*AMD/);assert.doesNotMatch(audit.renderer,/SwiftShader|llvmpipe/i);
  for(const [name,clip]of Object.entries(audit.animated))assert.ok(clip.moved,name+' mixer motion');
  assert.ok(audit.animated.Sniff.minY>-.02,'Sniff paws stay near the ground: '+audit.animated.Sniff.minY);
  assert.ok(audit.boots.shared&&audit.boots.moved&&audit.boots.vertexMoved&&audit.boots.hidden);
  await p.waitForTimeout(300);await p.screenshot({path:OUT+'/overview.png'});
  for(const [name,eye,target]of [['sifter',[3,2.6,3],[0,1,0]],['pipeline',[-4.5,2,3],[-4.5,.35,0]],['scarecrow',[-4.2,2,.6],[-3,1.1,-2.2]],['sand',[2,2.3,-1],[0,.15,-3]],['dynamite',[2.72,.40,2.5],[2.4,.11,2.1]],['hook-head',[2.6,.8,1.7],[2.13,.5,1.1]],['boots',[4.5,.65,1.8],[4,.20,.9]]]){
   await p.evaluate(([eye,target])=>{__up.eye.fromArray(eye);__up.target.fromArray(target)},[eye,target]);await p.waitForTimeout(120);await p.screenshot({path:OUT+'/'+name+'.png'});
   if(name==='sand'){
    await p.evaluate(()=>{__up.objects.LooseSand.scale.y=.2});await p.waitForTimeout(120);await p.screenshot({path:OUT+'/sand-flat.png'});
    await p.evaluate(()=>{__up.objects.LooseSand.scale.y=1});
   }
  }
  for(const name of ['Idle','Walk','Run','Sniff','Bark','Sit']){
   await p.evaluate(name=>{__up.dogMixer.stopAllAction();__up.dogMixer.clipAction(__up.dog.animations.find(c=>c.name===name)).play();__up.dogMixer.update(name==='Bark'?.12:.27);__up.eye.set(3.65,.70,3.05);__up.target.set(2.7,.28,1.8)},name);
   await p.waitForTimeout(120);await p.screenshot({path:OUT+'/dog-'+name+'.png'});
  }
  for(const name of ['DynamiteHeld','DisarmKit','GrappleHook']){
   await p.evaluate(name=>{Object.entries(__up.tools).forEach(([k,g])=>g.visible=k===name);const v=__up.tools[name].getWorldPosition(new T.Vector3());__up.frame.worldToLocal(v);__up.target.copy(v);__up.eye.copy(v).add(new T.Vector3(.4,.3,.5))},name);
   await p.waitForTimeout(120);await p.screenshot({path:OUT+'/held-'+name+'.png'});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(OUT+'/audit.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
