'use strict';
/* public/js/88-pipeline.js -- the sand pipeline (JT 2026-10-01): "allow building of a sand pipeline to the sifter: get to
   the end of the pipeline and empty your sand, sending it to the sifter automatically, basically allowing you to build
   into the lake and send sand from there." Plus: "it can never be destroyed, but can crack/break if hit by rocks,
   sinkholes, mines etc. Fixed if you hold interact on it for like 15 seconds", and "clear so you can see the sand move".
   - Pipe comes in 5 m sections from the Supply Depot (S.pipe). F at the end of the pipeline (at first: the connector at
     the bottom of the sifter) starts laying it: walk, and a joint goes down every PIPE_RUN metres behind you, one
     section each. F again (or running out) stops; the far end is the intake.
   - One pipeline for the whole camp (server.js world.pipe: nodes + broken runs; everyone can extend, use and fix it).
     Node 0 is the sifter's connector socket (sifter frame (-1.9, 0.24, 0)).
   - F at the intake with sand: it all goes down the pipe at pipe.speed m/s as a plug of sand you can watch through
     the clear pipe, through the connector into the sifter: into your hopper if you have one (86-hopper.js; what
     doesn't fit is sifted straight away), else sifted on arrival, the gold yours.
   - Boulders (74-landslide.js), open sinkholes (87-sinkhole.js) and mine blasts (88-mines.js pipeBlast) crack the runs
     they hit. A cracked run stops the sand (a plug that reaches it spills out there). Hold F next to the crack for
     pipe.fixTime seconds to fix it.
   Models (art/blender/pipe.py, gear.blend; the sifter's connector is in Sifter.glb, art/blender/sifter.py):
   PipeSection (1 m along +X, stretched to each run), PipeJoint, PipeCrack, PipeSlug, PipeIntake. The sand's way
   through the connector into the hopper comes from public/data/PipeInletPath.json (sifter frame), if it's there. */
const PIPE_RUN=5,PIPE_AX=0.24,PIPE_INTAKE_OFF=0.35;
const PIPE={nodes:[],broken:{},g:null,parts:{},dirty:true,laying:false,fixT:0,fixI:-1,slugs:[],inlet:null,checkT:0};
for(const n of['PipeSection','PipeJoint','PipeCrack','PipeSlug','PipeIntake'])modelParts(n).then(p=>{PIPE.parts[n]=p;PIPE.dirty=true}).catch(()=>{});
fetch('data/PipeInletPath.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&Array.isArray(j.points))PIPE.inlet=j.points}).catch(()=>{});
const pipeSocket=()=>{const G=SIM.GOLD.SIFTER;return{x:G.x-1.9,z:G.z}};
const pipeNodes=()=>PIPE.nodes.length?PIPE.nodes:[pipeSocket()];
const pipeY=(x,z)=>baseH(x,z);   // the undug ground: a run bridges a hole dug under it
function pipeSet(d){if(!d)return;PIPE.nodes=Array.isArray(d.nodes)?d.nodes.map(n=>({x:+n.x,z:+n.z})):[];PIPE.broken={};for(const k in d.broken||{})if(d.broken[k])PIPE.broken[k]=true;PIPE.dirty=true}
function pipeMesh(n){const parts=PIPE.parts[n];if(!parts)return null;const g=new T.Group();for(const pt of parts){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=!pt.material.transparent;m.receiveShadow=true;g.add(m)}return g}
const _pX=new T.Vector3(1,0,0),_pD=new T.Vector3();
/* (re)build the pipeline's meshes: runs, joints, cracks, the intake */
function pipeBuild(){
  PIPE.dirty=false;if(!PIPE.g){PIPE.g=new T.Group();scene.add(PIPE.g)}PIPE.g.clear();
  const N=PIPE.nodes;if(N.length<2)return;
  for(let i=0;i<N.length-1;i++){
    const a=N[i],b=N[i+1],ya=pipeY(a.x,a.z),yb=pipeY(b.x,b.z);_pD.set(b.x-a.x,yb-ya,b.z-a.z);const L=_pD.length();if(L<0.01)continue;_pD.normalize();
    const s=pipeMesh('PipeSection');if(s){s.position.set(a.x,ya,a.z);s.quaternion.setFromUnitVectors(_pX,_pD);s.scale.set(L,1,1);PIPE.g.add(s)}
    if(PIPE.broken[i]){const c=pipeMesh('PipeCrack');if(c){c.position.set((a.x+b.x)/2,(ya+yb)/2,(a.z+b.z)/2);c.rotation.y=Math.atan2(-(b.z-a.z),b.x-a.x);PIPE.g.add(c)}}
  }
  for(let i=1;i<N.length;i++){const a=N[i-1],b=N[i],j=pipeMesh('PipeJoint');if(!j)continue;j.position.set(b.x,pipeY(b.x,b.z),b.z);j.rotation.y=Math.atan2(-(b.z-a.z),b.x-a.x);PIPE.g.add(j)}
  const a=N[N.length-2],b=N[N.length-1],it=pipeMesh('PipeIntake');
  if(it){const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;const x=b.x+dx/l*PIPE_INTAKE_OFF,z=b.z+dz/l*PIPE_INTAKE_OFF;it.position.set(x,pipeY(b.x,b.z),z);it.rotation.y=Math.atan2(-dz,dx);PIPE.g.add(it)}
}
/* ---- laying it ---- */
function pipeEnd(){const N=pipeNodes();return N[N.length-1]}
function pipeLayStart(){
  if(S.pipe<1){toast('You need pipe: 5 m sections at the Supply Depot.','',3000);return}
  PIPE.laying=true;if(!PIPE.nodes.length){PIPE.nodes=[pipeSocket()]}
  toast(`Laying pipe: walk where you want it (a joint every ${PIPE_RUN} m, ${S.pipe} section${S.pipe>1?'s':''} left). F to stop.`,'good',4000);
}
function pipeLayStop(why){if(!PIPE.laying)return;PIPE.laying=false;if(PIPE.line)PIPE.line.visible=false;toast(why||(PIPE.nodes.length>1?'Pipe laid. Dump your sand in the intake at its end.':'You stop laying pipe.'),'',3000)}
function pipeLayStep(){
  if(S.ko||twSt||inTent()||S.inTown){pipeLayStop('You drop the pipe.');return}
  const e=pipeEnd(),d=Math.hypot(P.x-e.x,P.z-e.z);
  if(!PIPE.line){PIPE.line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0xfff2c0}));PIPE.line.frustumCulled=false;scene.add(PIPE.line)}
  PIPE.line.visible=true;PIPE.line.geometry.setFromPoints([new T.Vector3(e.x,pipeY(e.x,e.z)+PIPE_AX,e.z),new T.Vector3(P.x,pipeY(P.x,P.z)+PIPE_AX,P.z)]);
  if(d<PIPE_RUN)return;
  if(PIPE.nodes.length>=tune('pipe.max')+1){pipeLayStop(`That's as long as the pipeline goes (${tune('pipe.max')} sections).`);return}
  const n={x:+(e.x+(P.x-e.x)/d*PIPE_RUN).toFixed(2),z:+(e.z+(P.z-e.z)/d*PIPE_RUN).toFixed(2)};
  PIPE.nodes.push(n);S.pipe--;PIPE.dirty=true;sfx.clank();if(online())wsSend({t:'pipeAdd',x:n.x,z:n.z});
  logEv('pipeAdd',{x:n.x,z:n.z,n:PIPE.nodes.length});
  if(S.pipe<1)pipeLayStop('Out of pipe. Buy more at the Supply Depot, then F at the intake to carry on.');
}
/* ---- breaking and fixing ---- */
function pipeSegDist(i,x,z){const a=PIPE.nodes[i],b=PIPE.nodes[i+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz||1,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/l2,0,1);return Math.hypot(a.x+dx*t-x,a.z+dz*t-z)}
function pipeBreak(i,why){
  if(PIPE.broken[i]||i<0||i>=PIPE.nodes.length-1)return;PIPE.broken[i]=true;PIPE.dirty=true;
  if(online())wsSend({t:'pipeBreak',i});logEv('pipeBreak',{i,why});
  const a=PIPE.nodes[i],b=PIPE.nodes[i+1];if(nearCam((a.x+b.x)/2,(a.z+b.z)/2,40)){sfx.clank();puff((a.x+b.x)/2,pipeY(a.x,a.z)+0.3,(a.z+b.z)/2,(a.x+b.x)/2,(a.z+b.z)/2,8)}
  toast(`The pipeline's cracked (${why==='mine'?'a landmine':why==='rock'?'a boulder':why==='sink'?'a sinkhole':'something'}), ${Math.round(pipeAlong(i+0.5))} m out from the sifter. Hold F on the crack to fix it.`,'bad',4200);
}
function pipeBlast(x,z,r){for(let i=0;i<PIPE.nodes.length-1;i++)if(pipeSegDist(i,x,z)<r)pipeBreak(i,'mine')}   // 88-mines.js mineBoom
function pipeAlong(f){let s=0;const N=PIPE.nodes;for(let i=0;i<N.length-1&&i<f;i++){const l=Math.hypot(N[i+1].x-N[i].x,N[i+1].z-N[i].z);s+=l*Math.min(1,f-i)}return s}
function pipeHazards(){
  const N=PIPE.nodes;if(N.length<2)return;
  if(typeof lsBoulders!=='undefined')for(const b of lsBoulders){if(b.fadeT>0||b.y-baseH(b.x,b.z)>b.r+0.5)continue;for(let i=0;i<N.length-1;i++)if(!PIPE.broken[i]&&pipeSegDist(i,b.x,b.z)<b.r+0.15)pipeBreak(i,'rock')}
  if(typeof SINK_LIVE!=='undefined')for(const sh of SINK_LIVE.values()){if(sh.stage!=='open'&&sh.stage!=='settled')continue;for(let i=0;i<N.length-1;i++)if(!PIPE.broken[i]&&pipeSegDist(i,sh.x,sh.z)<sh.r*0.9)pipeBreak(i,'sink')}
}
function pipeNearCrack(r){let best=-1,bd=r;for(let i=0;i<PIPE.nodes.length-1;i++){if(!PIPE.broken[i])continue;const d=pipeSegDist(i,P.x,P.z);if(d<bd){bd=d;best=i}}return best}
/* ---- the sand going down it ---- */
function pipePath(){   // world points from the intake to the hopper: the runs backwards, then the connector
  const N=PIPE.nodes,pts=[];for(let i=N.length-1;i>=0;i--)pts.push(new T.Vector3(N[i].x,pipeY(N[i].x,N[i].z)+PIPE_AX,N[i].z));
  const G=SIM.GOLD.SIFTER,gy=baseH(G.x,G.z),inl=PIPE.inlet||[];   /* no connector path yet: the sand goes in at the socket */
  for(let k=1;k<inl.length;k++)pts.push(new T.Vector3(G.x+inl[k][0],gy+inl[k][1],G.z+inl[k][2]));
  return pts;
}
function pipeSlug(mine,holes){
  const pts=pipePath();if(pts.length<2)return;let len=0;const cum=[0];for(let i=1;i<pts.length;i++){len+=pts[i].distanceTo(pts[i-1]);cum.push(len)}
  const m=pipeMesh('PipeSlug');if(m)scene.add(m);PIPE.slugs.push({mine,holes,pts,cum,len,s:0,m});
}
function pipeDump(){
  if(carrier()!=='bucket'){toast('The pipe takes a bucket of sand. (Pan sand: wash it at the water drums.)','',3200);return}
  if(S.bucket<0.05){toast(`Your ${backsackOn()?'backsack':'bucket'}'s empty. Dig, then dump it here: it goes down the pipe to the sifter.`,'',3200);return}
  const br=Object.keys(PIPE.broken).map(Number).filter(i=>i<PIPE.nodes.length-1);
  if(br.length){const i=Math.max(...br);toast(`The pipe's cracked ${Math.round(pipeAlong(PIPE.nodes.length-1)-pipeAlong(i+0.5))} m back toward camp. Fix it first: hold F on the crack.`,'bad',4000);return}
  const holes=S.bucket;S.bucket=0;sfx.scoop();pipeSlug(true,holes);if(online())wsSend({t:'pipeFlow'});
  toast(`Down the pipe it goes: ${Math.round(holes*10)/10} holes of sand to the sifter.`,'good',3000);logEv('pipeDump',{holes:+holes.toFixed(2)});
}
function pipeArrive(holes){
  let rest=holes;const cap=hopperCap();
  if(cap){const put=Math.min(rest,Math.max(0,cap-S.hopper));S.hopper+=put;rest-=put}
  if(rest>0.01){const r=SIM.siftGold(rest,Math.random,tune('gold.perHole'),RUN.mood==='digday'?2:1);S.seeds+=r.gold;addXP(3+r.gold/3);r.nugget?sfx.gold():sfx.coin();
    toast(`Your sand came through the pipeline: the sifter shakes ${r.gold} gold out of it.`+(holes-rest>0.01?` (${Math.round((holes-rest)*10)/10} holes went in your hopper.)`:''),r.nugget?'gold':'good',3800)}
  else toast(`Your sand came through the pipeline into your hopper (${Math.floor(S.hopper)}/${cap}).`,'good',3000);
  logEv('pipeArrive',{holes:+holes.toFixed(2)});
}
function pipeSlugStep(sl,dt){
  sl.s+=dt*tune('pipe.speed');
  let i=1;while(i<sl.cum.length-1&&sl.cum[i]<sl.s)i++;
  const nRuns=PIPE.nodes.length-1,run=nRuns-i;   // the run it's in (runs are walked backwards)
  if(run>=0&&run<nRuns&&PIPE.broken[run]){   // a crack: the sand spills out there
    const a=PIPE.nodes[run],b=PIPE.nodes[run+1],x=(a.x+b.x)/2,z=(a.z+b.z)/2;puff(x,pipeY(x,z)+0.3,z,x,z,12);
    if(sl.mine)toast(`Your sand spilled out of a crack in the pipe (${Math.round(sl.holes*10)/10} holes lost). Hold F on the crack to fix it.`,'bad',4000);
    return false}
  if(sl.s>=sl.len){if(sl.mine)pipeArrive(sl.holes);const G=SIM.GOLD.SIFTER;if(nearCam(G.x,G.z,40))puff(G.x-0.85,baseH(G.x,G.z)+1.9,G.z,G.x-0.85,G.z,5);return false}
  if(sl.m){const a=sl.pts[i-1],b=sl.pts[i],u=clamp((sl.s-sl.cum[i-1])/((sl.cum[i]-sl.cum[i-1])||1),0,1);
    sl.m.position.lerpVectors(a,b,u);sl.m.position.y-=PIPE_AX;_pD.subVectors(b,a).normalize();sl.m.quaternion.setFromUnitVectors(_pX,_pD)}
  return true;
}
/* ---- spots for F (45-state.js nearSpot), and the per-frame work ---- */
function pipeSpot(){
  if(S.inTown||inTent())return null;
  if(PIPE.laying)return{id:'pipe',label:`Stop laying pipe (${S.pipe} section${S.pipe===1?'':'s'} left)`,use:()=>pipeLayStop()};
  const ci=pipeNearCrack(2.6);
  if(ci>=0)return{id:'pipeFix',label:PIPE.fixI===ci&&PIPE.fixT>0?`Fixing the pipe… ${Math.floor(PIPE.fixT/tune('pipe.fixTime')*100)}%`:'Hold F to fix the cracked pipe',use:()=>{}};
  const N=PIPE.nodes,G=SIM.GOLD.SIFTER,atSifter=(P.x-G.x)**2+(P.z-G.z)**2<SIM.GOLD.SIFT_R**2;
  if(N.length>1){const e=N[N.length-1],a=N[N.length-2],dx=e.x-a.x,dz=e.z-a.z,l=Math.hypot(dx,dz)||1,ix=e.x+dx/l*PIPE_INTAKE_OFF,iz=e.z+dz/l*PIPE_INTAKE_OFF;
    if((P.x-ix)**2+(P.z-iz)**2<2.4*2.4){
      if(S.bucket>0.05&&carrier()==='bucket')return{id:'pipe',label:`Dump your ${backsackOn()?'backsack':'bucket'} down the pipeline (${Math.floor(S.bucket*10)/10} holes of sand)`,use:pipeDump};
      if(S.pipe>0)return{id:'pipe',label:`Lay more pipe from here (${S.pipe} section${S.pipe===1?'':'s'})`,use:pipeLayStart};
      return{id:'pipe',label:'The pipeline intake (dump sand here: it goes to the sifter)',use:pipeDump}}}
  else if(S.pipe>0&&!(atSifter&&S.bucket>0.05)){const s=pipeSocket();if((P.x-s.x)**2+(P.z-s.z)**2<2.2*2.2)return{id:'pipe',label:`Lay a sand pipeline from the sifter (${S.pipe} section${S.pipe===1?'':'s'})`,use:pipeLayStart}}
  return null;
}
function updatePipeline(dt){
  if(PIPE.dirty)pipeBuild();if(!S.started)return;
  if(PIPE.laying)pipeLayStep();
  PIPE.checkT-=dt;if(PIPE.checkT<=0){PIPE.checkT=0.1;pipeHazards()}
  for(let k=PIPE.slugs.length-1;k>=0;k--){const sl=PIPE.slugs[k];if(!pipeSlugStep(sl,dt)){if(sl.m)scene.remove(sl.m);PIPE.slugs.splice(k,1)}}
  /* fixing: hold F (or E) by a crack */
  const ci=S.started&&(KEYS['f']||KEYS['e'])&&!S.ko&&!twSt&&!uiOpen()?pipeNearCrack(2.6):-1;   /* keys first: uiOpen() needs 95-pause.js, which loads after the loop starts */
  if(ci>=0){if(PIPE.fixI!==ci){PIPE.fixI=ci;PIPE.fixT=0}PIPE.fixT+=dt;digHeld=false;
    if(PIPE.fixT>=tune('pipe.fixTime')){delete PIPE.broken[ci];PIPE.dirty=true;PIPE.fixT=0;PIPE.fixI=-1;if(online())wsSend({t:'pipeFix',i:ci});sfx.clank();addXP(10);toast('Pipe fixed. Sand can get through again.','good',2600);logEv('pipeFix',{i:ci})}}
  else if(PIPE.fixT>0)PIPE.fixT=Math.max(0,PIPE.fixT-dt*2);
}
