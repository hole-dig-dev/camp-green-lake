'use strict';
/* public/js/87-excavator.js -- the Company's machines: an excavator and a dump truck (2026-11-10, ported from Gold Fever's
   "Rustbucket" and its dump truck; spec docs/plans/2026-11-10-machines-port-spec.md).
   - Bought for the whole camp at the Company Store (Camp tab: `excavator` needs the long tom & sluice, `dumpTruck` needs
     the excavator). Each waits just outside the east fence by the service gate (sim.js MACH.EXC_PARK / DUMP_PARK).
   - F at the cab door climbs in (one seat each; the server says whose it is). W/S drive, A/D turn. Both are simple and
     slow: no physics, they sit on the ground, stop at the fence, anything solid and the map edge, and refuse ground that
     drops away more than MACH_DROP under them, so the excavator never drives into its own pit.
   - The excavator's arm (Gold Fever's controls): the mouse swings the turret and raises or lowers the boom, the wheel
     folds the stick, C + mouse curls the bucket, right-drag looks round, R puts it all back. Each joint chases where you
     aim it on a spring, so it has weight (a load makes it heavier). The scoop: get the teeth into the dirt (the ring
     under them goes green), hold the left button and pull the mouse up. The server digs the holes (a cluster of
     overlapping ones, sim.js excScoopPlan) and puts the sand in the bucket, as rich as the ground it came from. With a
     load, hold left, swing, and let go: over the dump truck's bed it goes in the bed, at the sifter through the hopper
     and sifter, anywhere else it's a pile of loose sand on the ground (a flick throws it further) that any digger can
     scoop up by walking into it (88-dynamite.js piles, which now keep their richness).
   - The dump truck's bed holds MACH.DUMP_CAP holes. The excavator fills it, or a digger tips a bucket in at its tail
     (F, like the jeep). Near the sifter (MACH.DUMP_UNLOAD_R: inside the service gate or standing in it), F at the tail
     or E in the cab tips the bed and the load goes through your hopper and the sifter, like the jeep's unload.
   Online, like the jeep: the driver's page drives and sends where it is (and where the arm is aimed) ~12 times a
   second, everyone else eases toward that and runs the same arm spring; the server holds the seats, the loads and
   every dig (server.js machOp / excScoopS). Solo, this page does the server's part (machSolo*).
   Models: art/blender/machines.py (Excavator.glb, DumpTruck.glb), one node per moving part, pivots on the hinges.
   Hooks: nearSpot() (45-state.js) asks machSpot(); updatePlayer/updateCamera (70-player.js) hand over to machPlayer /
   machCamera while you're in one; the mouse (55-input.js) goes to machMouse; 65-net.js passes 'mach', 'mpos',
   'excScoop', 'machPay' and 'mfx' here; 90-loop.js calls updateMachines(). */
const MACH=SIM.MACH;
const MACH_ID={exc:'excavator',dump:'dumpTruck'};             // their camp-upgrade ids (84-camp.js, server.js CAMP_IDS)
const MACH_SEND=1/12;                                        // the driver sends where it is this often (s)
const MACH_DROP=0.6;                                         // m: ground under it more than this lower than under the rest: it won't go there
const MACH_IN_R=2.4;                                         // m from the cab door that F climbs in
/* the excavator (sizes from art/blender/machines.py; turret coordinates: x its left, y up from the ground, z forward) */
const EXC_LIM=[[-0.6,1.0],[0.35,2.1],[-2.6,2.6],[0,1]];      // boom (rad up from level), stick (rad folded in), slew (turret, rad from the tracks), curl (0 open .. 1 closed)
const EXC_DEF=[0.35,1.9,0,1];                                // parked and after R: bucket curled, resting on the ground
const EXC_SH=[-0.3,1.55,0.95];                               // the boom's foot pin
const EXC_BOOM_L=3.9,EXC_STICK_L=2.4,EXC_TEETH=1.12;         // pin to pin, and wrist pin to the bucket's teeth
const EXC_PHI0=-0.6,EXC_PHI1=-2.6;                           // the bucket's wrist-to-teeth line from level: open (teeth down and out) .. curled (teeth tucked under, mouth up)
const EXC_BOOM_RAM=[[1.18,1.15],[1.7,-0.14]];                // [z, y]: the boom rams' barrel pin on the turret, their rod pin on the boom (boom's own frame)
const EXC_STICK_RAM=[[2.0,0.86],[-0.15,0.85]];               // the stick ram's barrel pin on the boom, its rod pin on the stick's heel
const EXC_SEAT=[0.68,1.78,0.42],EXC_EYE=[0.68,2.45,0.55];    // the driver's hips and eyes in the cab
const EXC_DOOR=[1.75,0.4],EXC_OUT=[2.4,0.4];                 // where F works from, where you step out
const EXC_FOOT={x:1.25,z0:-1.9,z1:1.9};                      // the tracks on the ground
const EXC_SPRING=32,EXC_SPRING_LOAD=7,EXC_DAMP=7.5,EXC_CURL_K=65,EXC_CURL_D=11,EXC_VMAX=3;   // the arm's weight (Gold Fever tickArm): stiffness (a full bucket takes 7 off), damping, top joint speed (rad/s)
const EXC_PULL=36,EXC_PULL_MS=220;                           // a scoop: pull the mouse up this many pixels, no sooner than this after the teeth go in
const EXC_PLANT=[-0.9,0.95];                                 // m: teeth this far below .. above the ground are in the dirt
const EXC_DRIFT=4.5;                                           // m: teeth dragged further than this from where they went in: the scoop's off
const EXC_FLICK_MS=180,EXC_FLICK_PX=2.5;                     // a release is a throw if the mouse moved in the last 180 ms; 2.5 px/ms is full power
const EXC_CAM_DIST=13;                                       // third person: how far the camera stands off
/* the dump truck (body coordinates as above: cab at the front, +z) */
const DUMP_FOOT={x:1.3,z0:-3.5,z1:4.0};
const DUMP_SEAT=[0.55,1.75,2.85],DUMP_EYE=[0.55,2.62,3.05],DUMP_DOOR=[1.9,2.7],DUMP_OUT=[2.4,2.6];
const DUMP_WHEEL_R=0.55;
const DUMP_TIP_UP=0.8,DUMP_TIP_HOLD=1.1,DUMP_TIP_DOWN=1.0,DUMP_TIP_MAX=0.85;   // s raising, at the top, lowering; rad at the top
const DUMP_CAM_DIST=12;

const MACH_NO_COL={x0:1e9,x1:1e9,z0:1e9,z1:1e9};   // a machine that isn't there: a collider far off the map (a zero box would be a post at 0,0 for anyone walking)
function machNew(k){return{k,on:false,name:k==='exc'?'the excavator':'the dump truck',x:0,z:0,h:0,y:0,pitch:0,roll:0,v:0,drv:null,load:0,rich:1,
  foot:k==='exc'?EXC_FOOT:DUMP_FOOT,hang:0,root:new T.Group(),n:{},col:{...MACH_NO_COL},tgt:null,sendT:0,sentKey:'',
  arm:EXC_DEF.slice(),vel:[0,0,0,0],aim:EXC_DEF.slice(),tip:0,tipT:-1,tipLoad:0,tipN:null,wheel:0}}
const MACHS={exc:machNew('exc'),dump:machNew('dump')};
for(const M of Object.values(MACHS)){M.root.visible=false;scene.add(M.root);colliders.push(M.col);Object.assign(M,M.k==='exc'?MACH.EXC_PARK:MACH.DUMP_PARK)}
let MACH_ON=true;   // the server's word: machines run on this map (the lake)
const machMe=()=>online()?net.id:'me';
const machMine=M=>M.drv!=null&&M.drv===machMe();
const machLake=()=>(typeof ZONE==='undefined'||ZONE.id==='lake')&&MACH_ON;
const _mchQ=new T.Quaternion(),_mchV=new T.Vector3(),_mchE=new T.Euler(),_mchV2=new T.Vector3();

/* ---- the models: one GLB each, kept whole so the code can turn the named nodes ---- */
function machModel(M,name){
  new T.GLTFLoader().load(MODEL_DIR+name+'.glb',gl=>{
    gl.scene.traverse(o=>{if(o.isMesh){srgbVertexColors(o.geometry);o.material=gameMat(o.material);o.castShadow=true;o.receiveShadow=true}if(o.name&&!M.n[o.name])M.n[o.name]=o});
    M.root.add(gl.scene);machDraw(M);
  },undefined,e=>console.warn('model failed',name,e&&e.message));
}
let machLoaded=false;
function machLoad(){if(machLoaded)return;machLoaded=true;machModel(MACHS.exc,'Excavator');machModel(MACHS.dump,'DumpTruck')}

/* ---- where it sits: the ground under its two tracks (or wheel lines), five points along each; its height, pitch and
   roll; the collider box. It bridges a digger's hole the way a real machine does (the body is clear of the ground, and a
   track or wheelbase is longer than the hole); what stops it is more than half a track hanging over a drop of MACH_DROP
   or more, which is what its own pit (a bowl a few metres across) does as it rolls toward the edge. ---- */
const MACH_SAMPLES=9,MACH_BRIDGE=0.7;   // points along each track (or wheel line); how much of its length may hang over a drop (a digger's hole is ~2.5 m across: it bridges that, not its own pit)
function machFoot(M,x,z,h){const f=M.foot,c=Math.cos(h),s=Math.sin(h),g=[];
  for(const lx of[-f.x,f.x])for(let j=0;j<MACH_SAMPLES;j++){const lz=f.z0+(f.z1-f.z0)*j/(MACH_SAMPLES-1);g.push(groundAt(x+lx*c+lz*s,z-lx*s+lz*c))}return g}   // right track back..front, then left
function machHang(g,M){const top=Math.max(...g),step=(M.foot.z1-M.foot.z0)/(MACH_SAMPLES-1);let worst=0;   // the longest run of track over a drop, in metres
  for(let t=0;t<2;t++){let n=0;for(let j=0;j<MACH_SAMPLES;j++){if(g[t*MACH_SAMPLES+j]<top-MACH_DROP){n++;worst=Math.max(worst,n*step)}else n=0}}return worst}
function machSettle(M){
  const g=machFoot(M,M.x,M.z,M.h),f=M.foot,top=Math.max(...g),r=g.map(v=>Math.max(v,top-0.3)),N=MACH_SAMPLES;M.hang=machHang(g,M);   // it rests on its high points: a hole under it doesn't tip it in
  const back=(r[0]+r[N])/2,front=(r[N-1]+r[2*N-1])/2,right=r.slice(0,N).reduce((a,b)=>a+b)/N,left=r.slice(N).reduce((a,b)=>a+b)/N;
  M.y=(right+left)/2;M.pitch=-Math.atan2(front-back,f.z1-f.z0);M.roll=Math.atan2(left-right,f.x*2);machDraw(M);
}
function machQuat(M){return _mchQ.setFromEuler(_mchE.set(M.pitch,M.h,M.roll,'YXZ'))}
function machDraw(M){
  M.root.position.set(M.x,M.y,M.z);M.root.quaternion.copy(machQuat(M));
  const f=M.foot,c=Math.cos(M.h),s=Math.sin(M.h);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const lx of[-f.x,f.x])for(const lz of[f.z0,f.z1]){const x=M.x+lx*c+lz*s,z=M.z-lx*s+lz*c;x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z)}
  if(M.on&&machLake())Object.assign(M.col,{x0,x1,z0,z1});else Object.assign(M.col,MACH_NO_COL);
  if(M.k==='exc')excPoseNodes(M);else dumpPoseNodes(M);
}

/* ---- the excavator's arm: the spring, the geometry, the nodes ---- */
function excArmStep(M,dt){
  const load=clamp(M.load/MACH.EXC_BUCKET,0,1);let t=Math.min(dt,0.1);
  while(t>1e-6){const h=Math.min(0.016,t);t-=h;
    for(let i=0;i<4;i++){const curl=i===3,k=curl?EXC_CURL_K:EXC_SPRING-EXC_SPRING_LOAD*load,c=curl?EXC_CURL_D:EXC_DAMP;
      M.vel[i]=clamp(M.vel[i]+(k*(M.aim[i]-M.arm[i])-c*M.vel[i])*h,-EXC_VMAX,EXC_VMAX);M.arm[i]+=M.vel[i]*h;
      const[a,b]=EXC_LIM[i];if(M.arm[i]<a){M.arm[i]=a;M.vel[i]*=-0.25}else if(M.arm[i]>b){M.arm[i]=b;M.vel[i]*=-0.25}}}
}
/* the arm in the turret's side view (z forward, y up): the elbow, the wrist, the bucket's angle, the teeth */
function excArm2D(arm){
  const[b,s,,c]=arm,ez=EXC_SH[2]+Math.cos(b)*EXC_BOOM_L,ey=EXC_SH[1]+Math.sin(b)*EXC_BOOM_L,a=b-s,wz=ez+Math.cos(a)*EXC_STICK_L,wy=ey+Math.sin(a)*EXC_STICK_L,phi=EXC_PHI0+(EXC_PHI1-EXC_PHI0)*c;
  return{ez,ey,wz,wy,phi,tz:wz+Math.cos(phi)*EXC_TEETH,ty:wy+Math.sin(phi)*EXC_TEETH};
}
/* a turret-frame point -> the world (the turret slewed, the hull pitched and rolled on the ground) */
function excWorld(M,x,y,z,out){const s=M.arm[2],c=Math.cos(s),sn=Math.sin(s);out.set(x*c+z*sn,y,-x*sn+z*c).applyQuaternion(machQuat(M));out.x+=M.x;out.y+=M.y;out.z+=M.z;return out}
function excTeeth(M,out=new T.Vector3()){const A=excArm2D(M.arm);return excWorld(M,EXC_SH[0],A.ty,A.tz,out)}
/* where a load falls from: the bucket itself (its pin), not the teeth, which tuck back under it when it's curled */
function excBucketAt(M,out=new T.Vector3()){const A=excArm2D(M.arm);return excWorld(M,EXC_SH[0],A.wy,A.wz,out)}
const rot2=(z,y,a)=>[z*Math.cos(a)-y*Math.sin(a),z*Math.sin(a)+y*Math.cos(a)];
function excPoseNodes(M){
  const n=M.n;if(!n.Upper)return;const[b,s,sl]=M.arm,A=excArm2D(M.arm);
  n.Upper.rotation.y=sl;n.Boom.rotation.x=-b;n.Stick.rotation.x=s;n.Bucket.rotation.x=-(A.phi-b+s);
  {const[az,ay]=EXC_BOOM_RAM[0],[pz,py]=rot2(EXC_BOOM_RAM[1][0],EXC_BOOM_RAM[1][1],b),th=Math.atan2(EXC_SH[1]+py-ay,EXC_SH[2]+pz-az);   // the rams turn to meet each other
    if(n.BoomRamA)n.BoomRamA.rotation.x=-th;if(n.BoomRamB)n.BoomRamB.rotation.x=-(th-b)}
  {const[qz,qy]=rot2(EXC_STICK_RAM[0][0],EXC_STICK_RAM[0][1],b),[hz,hy]=rot2(EXC_STICK_RAM[1][0],EXC_STICK_RAM[1][1],b-s),th=Math.atan2(A.ey+hy-EXC_SH[1]-qy,A.ez+hz-EXC_SH[2]-qz);
    if(n.StickRamA)n.StickRamA.rotation.x=-(th-b);if(n.StickRamB)n.StickRamB.rotation.x=-(th-(b-s))}
  if(n.BucketFill){const f=clamp((M.fillV??M.load)/MACH.EXC_BUCKET,0,1);   // fillV: the sand you see, rising as it fills (47-digfeel.js)
   n.BucketFill.visible=f>0.01;n.BucketFill.scale.setScalar(0.4+0.6*Math.sqrt(f))}
  if(n.Cab)n.Cab.visible=!(S.inMach==='exc'&&FP&&machMine(M));   // looking out of it: no cab in the way
}
function dumpPoseNodes(M){
  const n=M.n;if(!n.Bed)return;let tip=0,f=clamp((M.fillV??M.load)/MACH.DUMP_CAP,0,1);
  if(M.tipT>=0){const t=M.tipT,u=t<DUMP_TIP_UP?t/DUMP_TIP_UP:t<DUMP_TIP_UP+DUMP_TIP_HOLD?1:Math.max(0,1-(t-DUMP_TIP_UP-DUMP_TIP_HOLD)/DUMP_TIP_DOWN);
    tip=DUMP_TIP_MAX*u*u*(3-2*u);const go=clamp((t-DUMP_TIP_UP*0.5)/(DUMP_TIP_HOLD+DUMP_TIP_UP*0.5),0,1);f=Math.max(f,clamp(M.tipLoad/MACH.DUMP_CAP,0,1)*(1-go))}   // the load slides out as it goes up
  n.Bed.rotation.x=-tip;
  if(n.BedFill){n.BedFill.visible=f>0.005;n.BedFill.scale.set(0.75+0.25*Math.sqrt(f),Math.max(0.05,f),0.6+0.4*Math.sqrt(f))}
  for(const k in n)if(/^Wheel(F|R1|R2)_[LR]$/.test(k))n[k].rotation.x=M.wheel;
}

/* ---- driving: the driver's page only ---- */
function machBlocked(M,x,z,h){
  if(Math.max(Math.abs(x),Math.abs(z))>EDGE-4)return true;
  const f=M.foot,c=Math.cos(h),s=Math.sin(h);
  const pts=(x,z,h)=>{const c=Math.cos(h),s=Math.sin(h),o=[];for(const lx of[-f.x,0,f.x])for(const lz of[f.z0,0,f.z1])o.push([x+lx*c+lz*s,z-lx*s+lz*c]);return o};
  const hit=(cc,P)=>cc!==M.col&&P.some(([X,Z])=>X>cc.x0&&X<cc.x1&&Z>cc.z0&&Z<cc.z1),now=pts(M.x,M.z,M.h),nw=pts(x,z,h);
  for(const cc of colliders)if(hit(cc,nw)&&!hit(cc,now))return true;   // (something it already stands in, it may drive out of)
  const n=machHang(machFoot(M,x,z,h),M);return n>=MACH_BRIDGE*(M.foot.z1-M.foot.z0)&&n>(M.hang||0)+0.01;   // two thirds of a track over a pit (its own, or anyone's): no further in (backing out is fine)
}
function machDrive(M,dt){
  const key=k=>!uiOpen()&&!!KEYS[k],exc=M.k==='exc';
  const thr=(key('w')||key('arrowup')?1:0)-(key('s')||key('arrowdown')?1:0),st=(key('a')||key('arrowleft')?1:0)-(key('d')||key('arrowright')?1:0);
  const slow=1-clamp(M.load/(exc?MACH.EXC_BUCKET:MACH.DUMP_CAP),0,1)*tune('mach.loadSlow'),vmax=tune(exc?'mach.excSpeed':'mach.dumpSpeed')*slow;
  const tv=thr>0?vmax:thr<0?-vmax*0.6:0;M.v+=(tv-M.v)*Math.min(1,dt*(tv?2.5:5));if(Math.abs(M.v)<0.02&&!tv)M.v=0;
  const turn=exc?st*tune('mach.excTurn'):st*tune('mach.dumpTurn')*clamp(M.v/2.5,-1,1);   // tracks turn on the spot; wheels only rolling
  if(!M.v&&!turn)return false;
  const nh=M.h+turn*dt,nx=M.x+Math.sin(nh)*M.v*dt,nz=M.z+Math.cos(nh)*M.v*dt;
  if(!machBlocked(M,nx,nz,nh)){M.x=nx;M.z=nz;M.h=nh;M.wheel+=M.v*dt/DUMP_WHEEL_R}
  else if(turn&&!machBlocked(M,M.x,M.z,nh)){M.h=nh;M.v=0}
  else{if(Math.abs(M.v)>1.2){sfx.thud();machWarn('Something in the way: '+(machHang(machFoot(M,nx,nz,nh),M)>=MACH_BRIDGE*(M.foot.z1-M.foot.z0)?'the ground drops away there.':'back up.'))}M.v=0}
  machSettle(M);return true;
}
function machSend(M,dt){
  if(!online())return;M.sendT-=dt;if(M.sendT>0)return;
  const a=M.k==='exc'?M.aim.map(v=>+v.toFixed(3)):null,key=[M.x.toFixed(2),M.z.toFixed(2),M.h.toFixed(3),a&&a.join()].join();if(key===M.sentKey)return;
  M.sentKey=key;M.sendT=MACH_SEND;const o={t:M.k,op:'pos',x:+M.x.toFixed(2),z:+M.z.toFixed(2),h:+M.h.toFixed(3)};if(a)o.a=a;wsSend(o);
}

/* ---- getting in and out ---- */
function machDoor(M,o){const d=o||(M.k==='exc'?EXC_DOOR:DUMP_DOOR);if(M.k==='exc'){const p=excWorld(M,d[0],0,d[1],_mchV2);return{x:p.x,z:p.z}}return SIM.machAt(M,d[0],d[1])}
function machWho(id){if(id==='me'||(online()&&id===net.id))return'You';const R=remotes.get(id);return R?R.name:'Someone'}
function machIn(M){
  if(S.inTruck||S.inMach)return;
  if(online()){wsSend({t:M.k,op:'in'});return}
  M.drv='me';machSeated();
}
function machOut(){
  const k=S.inMach;if(!k)return;const M=MACHS[k];
  if(online()){M.sendT=0;M.sentKey='';machSend(M,0);wsSend({t:k,op:'out'})}M.drv=null;M.outAt=Date.now();machSeated();   // where it stopped, before the seat goes (or the others would keep the last report but one)
}
const EXCV={headYaw:0,pitch:0.1};                             // the look: where you've turned your head from the turret (right-drag)
/* my seat changed (the server's word, or solo at once): sit down, or climb out */
function machSeated(){
  const k=machMine(MACHS.exc)?'exc':machMine(MACHS.dump)?'dump':null;if(k===(S.inMach||null))return;
  const was=S.inMach;
  if(k){S.inMach=k;const M=MACHS[k];P.moving=false;digHeld=false;EXCI.phase='idle';EXCV.headYaw=0;EXCV.pitch=0.1;M.prevH=M.h;
    if(k==='exc')M.aim=M.arm.map((v,i)=>clamp(v,...EXC_LIM[i]));else{P.yaw=M.h+Math.PI;P.pitch=FP?0.05:0.3}
    toast(k==='exc'?'In the cab. W/S A/D drive. The mouse swings the arm and the boom, the wheel folds the stick, C + mouse curls the bucket. Teeth in the dirt, hold left and pull up to scoop.':
      'Driving the dump truck. W/S A/D drive. The excavator loads the bed; near the sifter, E tips the load out. F to get out.','',6000);sfx.thud();logEv('machIn',{k});return}
  S.inMach=null;if(me)me.g.visible=true;
  const M=MACHS[was],o=machDoor(M,was==='exc'?EXC_OUT:DUMP_OUT);P.x=o.x;P.z=o.z;P.y=groundAt(o.x,o.z);P.vy=0;P.yaw=M.h+(was==='exc'?M.arm[2]:0)+Math.PI;
}
/* the F prompt (45-state.js nearSpot) */
function machSpot(){
  if(S.inMach)return{id:'mach',label:`Get out of ${MACHS[S.inMach].name}`,use:machOut};
  if(!S.started||S.ko||S.inTown||inTent()||S.carry!=null||S.inTruck||S.sit!=null||!machLake())return null;
  const D=MACHS.dump;
  if(D.on){const t=SIM.machAt(D,MACH.DUMP_TAIL[0],MACH.DUMP_TAIL[1]);if(Math.hypot(P.x-t.x,P.z-t.z)<MACH.DUMP_TAIL_R){
    if(dumpAtSifter(D)&&D.load>0.05)return{id:'dumpUnload',label:`Tip the dump truck's load out at the sifter (${fmtHoles(D.load)} holes of sand)`,use:dumpUnload};
    if(carrier()==='bucket'&&S.bucket>0.05){
      if(D.load>=MACH.DUMP_CAP-0.05)return{id:'dumpFull',label:`The dump truck's full (${MACH.DUMP_CAP} holes). Drive it to the sifter.`,use:()=>{}};
      return{id:'dumpTip',label:`Tip your ${backsackOn()?'backsack':'bucket'} into the dump truck (${fmtHoles(D.load)}/${MACH.DUMP_CAP} holes aboard)`,use:dumpTip}}}}
  for(const M of[MACHS.exc,D]){if(!M.on)continue;const d=machDoor(M);if(Math.hypot(P.x-d.x,P.z-d.z)>MACH_IN_R)continue;
    if(M.drv!=null)return{id:'machBusy',label:`${machWho(M.drv)} is driving ${M.name}`,use:()=>{}};
    return{id:'machIn',label:M.k==='exc'?'Climb into the excavator':'Drive the dump truck',use:()=>machIn(M)}}
  return null;
}
/* every frame from updatePlayer while you're in one (in place of walking): you sit in the cab */
function machPlayer(dt){
  const M=MACHS[S.inMach];if(!M||!M.on){S.inMach=null;return}
  digHeld=false;
  if(M.k==='dump'){P.yaw+=M.h-(M.prevH??M.h);M.prevH=M.h}   // your view turns with the truck
  const p=M.k==='exc'?excWorld(M,EXC_SEAT[0],EXC_SEAT[1],EXC_SEAT[2],_mchV2):SIM.machAt(M,DUMP_SEAT[0],DUMP_SEAT[2]),y=M.k==='exc'?p.y:M.y+DUMP_SEAT[1];
  const face=M.h+(M.k==='exc'?M.arm[2]:0);
  if(me)sitPose(me,p.x,y,p.z,face,dt,10);
  P.x=p.x;P.z=p.z;P.y=y-0.5;P.vy=0;P.grounded=true;P.moving=false;P.anim=10;P.fa=face;
}
/* from updateRemotes (65-net.js): a friend at the controls sits in the cab, whatever their last position said */
function machRemoteSeat(id,R,dt){
  for(const M of Object.values(MACHS)){if(!M.on||M.drv!==id)continue;
    const p=M.k==='exc'?excWorld(M,EXC_SEAT[0],EXC_SEAT[1],EXC_SEAT[2],_mchV2):SIM.machAt(M,DUMP_SEAT[0],DUMP_SEAT[2]),y=M.k==='exc'?p.y:M.y+DUMP_SEAT[1];
    sitPose(R.p,p.x,y,p.z,M.h+(M.k==='exc'?M.arm[2]:0),dt,10);R.p.g.visible=true;return true}
  return false;
}

/* ---- the cameras: a cab view that follows the turret and looks toward the bucket, and a third-person orbit ---- */
function machCamera(dt){
  if(!S.inMach)return false;const M=MACHS[S.inMach];if(!M)return false;
  if(M.k==='exc'){
    const T=excTeeth(M,_mchV),yaw=M.h+M.arm[2]+EXCV.headYaw;
    if(FP){if(me)me.g.visible=false;const e=excWorld(M,EXC_EYE[0],EXC_EYE[1],EXC_EYE[2],_mchV2);
      const down=Math.atan2(e.y-T.y,Math.max(1,Math.hypot(T.x-e.x,T.z-e.z)));   // tilt toward the bucket, so it stays in view
      camera.position.copy(e);camera.rotation.set(-clamp(down*0.55+EXCV.pitch,-0.4,0.9),yaw+Math.PI,clamp(M.vel[2]*0.012,-0.03,0.03),'YXZ');return true}
    if(me){me.g.visible=true;if(me.fpOn)fpBody(false)}
    const pe=clamp(0.42+EXCV.pitch,0.05,1.2),cx=M.x-Math.sin(yaw)*EXC_CAM_DIST*Math.cos(pe),cz=M.z-Math.cos(yaw)*EXC_CAM_DIST*Math.cos(pe);
    const cy=Math.max(M.y+2.5+Math.sin(pe)*EXC_CAM_DIST,groundAt(cx,cz)+1),k=1-Math.exp(-dt*8);
    camera.position.x+=(cx-camera.position.x)*k;camera.position.y+=(cy-camera.position.y)*k;camera.position.z+=(cz-camera.position.z)*k;
    camera.lookAt((M.x*2+T.x)/3,M.y+1.6,(M.z*2+T.z)/3);return true;
  }
  if(FP){if(me)me.g.visible=false;const p=SIM.machAt(M,DUMP_EYE[0],DUMP_EYE[2]);camera.position.set(p.x,M.y+DUMP_EYE[1],p.z);camera.rotation.set(-P.pitch,P.yaw,0,'YXZ');return true}
  if(me){me.g.visible=true;if(me.fpOn)fpBody(false)}
  const a=P.yaw,cp=Math.cos(P.pitch),k=1-Math.exp(-dt*10),cx=M.x+Math.sin(a)*DUMP_CAM_DIST*cp,cz=M.z+Math.cos(a)*DUMP_CAM_DIST*cp,cy=Math.max(M.y+2+Math.sin(P.pitch)*DUMP_CAM_DIST+1.2,groundAt(cx,cz)+1);
  camera.position.x+=(cx-camera.position.x)*k;camera.position.z+=(cz-camera.position.z)*k;camera.position.y+=(cy-camera.position.y)*k;
  camera.lookAt(M.x,M.y+1.8,M.z);return true;
}

/* ---- the excavator's controls ---- */
const EXCI={phase:'idle',pull:0,t0:0,px:0,pz:0,next:0,lastMove:0,speed:0,lx:null,ly:null,right:false,warnT:0,told:false};
const excInput=()=>S.inMach==='exc'&&S.started&&!uiOpen()&&!S.ko;
function machWarn(t){const n=performance.now();if(n-EXCI.warnT<1800)return;EXCI.warnT=n;toast(t,'',2200)}
/* from 55-input.js mousemove: true means the excavator took it (your view stays put) */
function machMouse(e){
  if(S.inMach!=='exc')return false;if(!excInput())return true;
  let mx,my;
  if(lockOk()){if(!lookDelta(e.movementX,e.movementY))return true;mx=e.movementX;my=e.movementY}
  else{if(EXCI.lx==null){EXCI.lx=e.clientX;EXCI.ly=e.clientY;return true}mx=e.clientX-EXCI.lx;my=e.clientY-EXCI.ly;EXCI.lx=e.clientX;EXCI.ly=e.clientY}   // no pointer lock (a browser that refuses it, tests): the pointer's own moves
  const now=performance.now();EXCI.speed=Math.hypot(mx,my)/Math.max(4,now-EXCI.lastMove);EXCI.lastMove=now;
  if(EXCI.right||(e.buttons&2)){EXCV.headYaw=clamp(EXCV.headYaw-mx*0.004,-2.2,2.2);EXCV.pitch=clamp(EXCV.pitch+my*0.003,-0.8,0.9);return true}   // right-drag: look round
  const M=MACHS.exc,k=tune('mach.armSens');
  if(KEYS.c)M.aim[3]=clamp(M.aim[3]-my*0.008*k,...EXC_LIM[3]);
  else{M.aim[2]=clamp(M.aim[2]-mx*0.005*k,...EXC_LIM[2]);M.aim[0]=clamp(M.aim[0]-my*0.004*k,...EXC_LIM[0])}
  if(EXCI.phase==='planted'){EXCI.pull-=my;M.aim[3]=Math.max(M.aim[3],clamp(EXCI.pull/EXC_PULL,0,1))}   // pulling up curls the bucket through the dirt
  return true;
}
canvas.addEventListener('mousedown',e=>{if(!excInput())return;EXCI.lx=e.clientX;EXCI.ly=e.clientY;if(e.button===2){EXCI.right=true;return}if(e.button===0)excPress()});
addEventListener('mouseup',e=>{if(e.button===2)EXCI.right=false;if(e.button===0&&S.inMach==='exc')excRelease()});
addEventListener('wheel',e=>{if(!excInput()||!e.deltaY)return;const M=MACHS.exc;M.aim[1]=clamp(M.aim[1]+Math.sign(e.deltaY)*0.12,...EXC_LIM[1])},{passive:true});
addEventListener('keydown',e=>{
  if(!S.inMach||!S.started||uiOpen()||e.repeat||typeof remapKey!=='function')return;const k=remapKey(e.key.toLowerCase());
  if(S.inMach==='exc'&&k==='r'){MACHS.exc.aim=EXC_DEF.slice();EXCV.headYaw=0;EXCV.pitch=0.1;EXCI.phase='idle'}   // R: arm and view back to centre
  if(S.inMach==='dump'&&k==='e')dumpUnload();
});
/* why the teeth can't go in here (null: they can) */
function excPlantWhy(M,T){
  if(performance.now()<EXCI.next)return'wait';
  if(M.load>=MACH.EXC_BUCKET-0.05)return'The bucket\'s full. Hold left, swing it over the truck or anywhere, and let go.';
  const dy=T.y-groundAt(T.x,T.z);if(dy>EXC_PLANT[1])return'Lower the teeth to the dirt (move the mouse down), then hold left and pull up.';
  if(dy<EXC_PLANT[0])return'Too deep: raise the boom a little.';
  if(inCamp(T.x,T.z)||nearCampNoDig(T.x,T.z)||Math.max(Math.abs(T.x),Math.abs(T.z))>EDGE-2)return'No digging in camp or by the fence. Out on the lake bed.';
  const d=Math.hypot(T.x-M.x,T.z-M.z);if(d<MACH.EXC_MIN_REACH)return'Too close to the tracks: reach out further (wheel up).';if(d>MACH.EXC_REACH-0.4)return'Too far out.';
  if(!machLake())return'Not here.';
  return null;
}
function excPress(){
  const M=MACHS.exc;
  if(M.load>0.05&&!KEYS.shift){EXCI.phase='carry';return}   // a load aboard: this hold ends in a dump (Shift: add another scoop instead)
  const T=excTeeth(M),why=excPlantWhy(M,T);if(why){EXCI.phase='idle';if(why!=='wait')machWarn(why);return}
  EXCI.phase='planted';EXCI.pull=0;EXCI.t0=performance.now();EXCI.px=T.x;EXCI.pz=T.z;sfx.thud();digDust(T.x,groundAt(T.x,T.z)+0.15,T.z,M.x-T.x,M.z-T.z,2,0.35,0.28);   // the teeth go in (47-digfeel.js)
}
function excRelease(){
  const M=MACHS.exc;
  if(EXCI.phase==='carry'&&M.load>0.01){
    const now=performance.now(),power=now-EXCI.lastMove<EXC_FLICK_MS?clamp(EXCI.speed/EXC_FLICK_PX,0,1):0,T=excBucketAt(M);
    if(online())wsSend({t:'exc',op:'drop',x:+T.x.toFixed(2),z:+T.z.toFixed(2),power:+power.toFixed(2)});else machSoloDrop(T.x,T.z,power);
    M.aim[3]=0;M.vel[3]=-2;logEv('excDrop',{power:+power.toFixed(2)});   // the bucket opens: out it goes
  }
  EXCI.phase='idle';
}
function excScoopTick(M){   // the frame loop: a planted pull long and far enough is a scoop
  if(EXCI.phase!=='planted')return;
  const T=excTeeth(M,_mchV);if(Math.hypot(T.x-EXCI.px,T.z-EXCI.pz)>EXC_DRIFT){EXCI.phase='idle';return}
  if(EXCI.pull<EXC_PULL||performance.now()-EXCI.t0<EXC_PULL_MS)return;
  EXCI.phase='scooping';EXCI.next=performance.now()+MACH.EXC_COOLDOWN*1000;
  if(online())wsSend({t:'excScoop',x:+EXCI.px.toFixed(2),z:+EXCI.pz.toFixed(2)});else machSoloScoop(EXCI.px,EXCI.pz);
}
/* the server's answer to a scoop */
function excScooped(m){
  const M=MACHS.exc;if(EXCI.phase==='scooping')EXCI.phase='idle';
  if(!m.ok){const t={full:'The bucket\'s full.',reach:'Too far out.',close:'Too close to the tracks.',camp:'No digging in camp or by the fence.',deep:'That\'s as deep as it goes here (8 feet). Move along.',wait:''}[m.why];if(t)machWarn(t);EXCI.next=0;return}
  M.aim[3]=1;sfx.scoop();setTimeout(()=>sfx.scoop(),120);payDug({x:EXCI.px,z:EXCI.pz});addXP(1);
  if(!EXCI.told){EXCI.told=true;toast('A bucket of sand. Hold left, swing it over the dump truck\'s bed (or the sifter, or anywhere for a pile), let go. A flick throws it.','good',5000)}
  logEv('excScoop',{v:num(m.v,0,9,0),rich:num(m.rich,0,9,1)});
}

/* ---- the dump truck: tipping a bucket in, unloading at the sifter ---- */
const dumpAtSifter=M=>{const G=SIM.GOLD.SIFTER;return Math.hypot(M.x-G.x,M.z-G.z)<MACH.DUMP_UNLOAD_R};
function dumpTip(){
  const D=MACHS.dump,amt=Math.min(S.bucket,MACH.DUMP_CAP-D.load,MACH.DUMP_TIP_MAX);if(!(amt>0.01))return;const rich=sandRich('bucket');
  S.bucket=Math.max(0,S.bucket-amt);if(S.bucket<0.05){S.bucket=0;sandReset('bucket')}
  if(online())wsSend({t:'dump',op:'tip',v:+amt.toFixed(3),rich:+rich.toFixed(3)});else{SIM.loadMix(machLoadOf(D),amt,rich);machSoloSave()}
  sfx.scoop();const t=SIM.machAt(D,0,-1.5);puff(t.x,D.y+2.4,t.z,t.x,t.z,6);
  toast(`${fmtHoles(amt)} holes of sand into the dump truck (${fmtHoles(Math.min(MACH.DUMP_CAP,D.load+(online()?amt:0)))}/${MACH.DUMP_CAP}).`,'good',2400);logEv('dumpTip',{holes:+amt.toFixed(2)});
}
function dumpUnload(){
  const D=MACHS.dump;if(!D.on)return;
  if(!dumpAtSifter(D)){if(S.inMach==='dump')machWarn('Drive up to the sifter first: in through the service gate, or stop in it.');return}
  if(!(D.load>0.05)){if(S.inMach==='dump')machWarn('The bed\'s empty.');return}
  if(online()){wsSend({t:'dump',op:'unload'});return}
  const L=machLoadOf(D);dumpTipStart(D);machPay(L.holes,L.rich,'dump');D.load=0;D.rich=1;machSoloSave();
}
function dumpTipStart(M){M.tipT=0;M.tipLoad=Math.max(M.tipLoad||0,M.load);sfx.clank()}
/* a load arrives at the sifter (the excavator's bucket, or the truck's bed): your hopper first, the rest through the
   sifter, like the jeep's unload (88-jeephaul.js jeepUnload). The gold is the crew's, like any sift. */
function machPay(holes,rich,src){
  let rest=holes;if(!(rest>0.01))return;const cap=hopperCap();let put=0;if(src==='dump')PAYDUG.w=0;   // a truckload's from all over: no map dot
  if(cap){put=Math.min(rest,Math.max(0,cap-S.hopper));sandMix('hopper',put,rich);S.hopper+=put;rest-=put}
  const what=src==='exc'?'The bucket':'The dump truck\'s load';sfx.scoop();
  if(rest>0.01){const r=SIM.siftGold(rest,Math.random,tune('gold.perHole')*goldScale()*rich,RUN.mood==='digday'?2:1);S.seeds+=r.gold;foundGold(r.gold);addXP(4+r.gold/3);r.nugget?sfx.gold():sfx.coin();
    toast(`${r.nugget?'A NUGGET! ':''}${what} goes through the sifter: ${r.gold} gold from ${fmtHoles(rest)} holes.${put>0.01?` (${fmtHoles(put)} more went in your hopper.)`:''} ${payAssay(rich)}`,'gold',5200)}
  else toast(`${what} is in your hopper (${fmtHoles(S.hopper)}/${cap}). ${payAssay(rich)}`,'good',4200);
  logEv('machPay',{src,holes:+holes.toFixed(2),pay:+rich.toFixed(2)});
}
/* where the bucket went (everyone): a puff and a thump there */
function machFx(m){const x=num(m.x,-600,600,0),z=num(m.z,-600,600,0);if(!nearCam(x,z,80))return;
  digPour(m);sfx.thud();sfx.scoop();setTimeout(()=>sfx.scoop(),260)}   // a pour from the bucket, not a pop (47-digfeel.js)

/* ---- network (65-net.js) ---- */
function machMsg(m){
  if(!m)return;MACH_ON=m.on!==false;const st=m.st&&typeof m.st==='object'?m.st:{};
  for(const k of['exc','dump']){const M=MACHS[k],s=st[k];
    if(!s||typeof s!=='object'){M.on=false;M.drv=null;M.root.visible=false;machDraw(M);continue}
    const was=M.on;M.on=true;machLoad();M.drv=s.drv??null;if(M.drv===machMe()&&Date.now()-(M.outAt||0)<1500)M.drv=null;   // the seat I just got out of: old news
    const load=num(s.load,0,999,0);
    if(k==='dump'){const tip=num(s.tip,0,1e9,0)|0;if(M.tipN!=null&&tip>M.tipN){M.tipLoad=M.load;dumpTipStart(M)}M.tipN=tip}
    M.load=load;M.rich=num(s.rich,0.05,20,1);
    if(!machMine(M)){const x=num(s.x,-600,600,M.x),z=num(s.z,-600,600,M.z),h=num(s.h,-100,100,M.h);
      if(m.park||!was||Math.hypot(x-M.x,z-M.z)>12){Object.assign(M,{x,z,h,tgt:null});if(k==='exc'&&Array.isArray(s.arm)){M.aim=s.arm.map((v,i)=>num(v,...EXC_LIM[i],EXC_DEF[i]));M.arm=M.aim.slice();M.vel=[0,0,0,0]}machSettle(M)}
      else M.tgt={x,z,h}}
  }
  machSeated();
}
function machPos(m){
  const M=MACHS[m.k];if(!M||!M.on||machMine(M)||!Array.isArray(m.p))return;const p=m.p;
  M.tgt={x:num(p[0],-600,600,M.x),z:num(p[1],-600,600,M.z),h:num(p[2],-100,100,M.h)};
  if(M.k==='exc'&&p.length>=7)M.aim=[3,4,5,6].map((j,i)=>num(p[j],...EXC_LIM[i],M.aim[i]));
}

/* ---- solo: this page is the server (the same rules: sim.js MACH, excScoopPlan, loadMix) ---- */
const MACH_SOLO_KEY='cgl-machines';
const machLoadOf=M=>({get holes(){return M.load},set holes(v){M.load=v},get rich(){return M.rich},set rich(v){M.rich=v}});
let machSoloT=0,machSoloDirty=false;
function machSoloSave(){machSoloDirty=true}
function machSoloSync(dt){
  if(online())return;let ch=false;
  for(const k of['exc','dump']){const M=MACHS[k],own=typeof campHas==='function'&&campHas(MACH_ID[k]);
    if(own&&!M.on){M.on=true;machLoad();let s=null;try{s=(JSON.parse(localStorage.getItem(MACH_SOLO_KEY)||'{}')||{})[k]}catch(e){}
      Object.assign(M,k==='exc'?MACH.EXC_PARK:MACH.DUMP_PARK);
      if(s&&typeof s==='object'){M.x=num(s.x,-590,590,M.x);M.z=num(s.z,-590,590,M.z);M.h=num(s.h,-100,100,M.h);M.load=num(s.load,0,999,0);M.rich=num(s.rich,0.05,20,1);if(k==='exc'&&Array.isArray(s.arm)){M.aim=s.arm.map((v,i)=>num(v,...EXC_LIM[i],EXC_DEF[i]));M.arm=M.aim.slice()}}
      machSettle(M);ch=true}
    if(!own&&M.on){M.on=false;M.load=0;if(machMine(M)){M.drv=null;machSeated()}M.drv=null;machDraw(M);ch=true}}
  machSoloT-=dt;if((machSoloDirty||ch)&&machSoloT<=0){machSoloT=2;machSoloDirty=false;const o={};
    for(const k of['exc','dump']){const M=MACHS[k];if(M.on)o[k]={x:+M.x.toFixed(2),z:+M.z.toFixed(2),h:+M.h.toFixed(3),load:+M.load.toFixed(3),rich:+M.rich.toFixed(3),arm:k==='exc'?M.aim.map(v=>+v.toFixed(3)):undefined}}
    try{localStorage.setItem(MACH_SOLO_KEY,JSON.stringify(o))}catch(e){}}
}
const machNoDig=(x,z)=>inCamp(x,z)||nearCampNoDig(x,z)||Math.max(Math.abs(x),Math.abs(z))>EDGE-2;
function machSoloScoop(x,z){
  const M=MACHS.exc,d=Math.hypot(x-M.x,z-M.z),room=MACH.EXC_BUCKET-M.load;
  if(d>MACH.EXC_REACH)return excScooped({ok:false,why:'reach'});if(d<MACH.EXC_MIN_REACH)return excScooped({ok:false,why:'close'});
  if(machNoDig(x,z))return excScooped({ok:false,why:'camp'});if(room<0.05)return excScooped({ok:false,why:'full'});
  const plan=SIM.excScoopPlan(x,z,(hx,hz)=>{const h=holeNear(hx,hz,0.06);return h?h.d:0},(hx,hz)=>!machNoDig(hx,hz));
  if(!plan.holes.length)return excScooped({ok:false,why:'deep'});
  for(const[hx,hz,hd]of plan.holes)applyDig(hx,hz,hd,true);
  const v=Math.min(plan.vol,room);SIM.loadMix(machLoadOf(M),v,plan.rich);machSoloSave();excScooped({ok:true,v,rich:plan.rich});
}
function machSoloDrop(x,z,power){
  const M=MACHS.exc,D=MACHS.dump,G=SIM.GOLD.SIFTER;let rest=M.load,to='ground';
  if(D.on){const b=SIM.machAt(D,MACH.DUMP_BED[0],MACH.DUMP_BED[1]);if(Math.hypot(x-b.x,z-b.z)<MACH.DUMP_BED_R){const v=Math.min(rest,MACH.DUMP_CAP-D.load);if(v>0){SIM.loadMix(machLoadOf(D),v,M.rich);rest-=v;to='dump'}}}
  if(to==='ground'&&Math.hypot(x-G.x,z-G.z)<MACH.EXC_SIFT_R){machPay(rest,M.rich,'exc');rest=0;to='sifter'}
  if(rest>0.01){const yaw=M.h+M.arm[2],f=to==='ground'?power*MACH.EXC_FLING:0;let gx=x+Math.sin(yaw)*f,gz=z+Math.cos(yaw)*f;if(inCamp(gx,gz)&&!inCamp(x,z)){gx=x;gz=z}
    let q=[...DYN.piles.values()].find(p=>Math.hypot(p.x-gx,p.z-gz)<MACH.PILE_MERGE);
    if(q){const L={holes:q.sand,rich:q.pay>0?q.pay:1};SIM.loadMix(L,rest,M.rich);pileSet({id:q.id,x:q.x,z:q.z,sand:L.holes,pay:L.rich})}
    else pileSet({id:DYN.localId++,x:gx,z:gz,sand:rest,pay:M.rich})}
  machFx({x,z,to});M.load=0;M.rich=1;machSoloSave();
}

/* ---- the HUD line while you're at the controls, and the ring under the teeth ---- */
const EXC_RING=new T.Mesh(new T.RingGeometry(0.43,0.5,28),new T.MeshBasicMaterial({color:0x94b861,transparent:true,opacity:0.9,depthWrite:false,side:T.DoubleSide}));
EXC_RING.rotation.x=-Math.PI/2;EXC_RING.visible=false;EXC_RING.renderOrder=3;scene.add(EXC_RING);
const MACH_HUD=document.createElement('div');MACH_HUD.id='machHud';MACH_HUD.className='panel';MACH_HUD.hidden=true;
MACH_HUD.style.cssText='position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top,0px));transform:translateX(-50%);padding:6px 12px;font:600 14px/1.35 var(--ui);text-align:center;max-width:calc(100vw - 32px);pointer-events:none;z-index:6';
document.body.appendChild(MACH_HUD);
function machHud(){
  const M=S.inMach&&MACHS[S.inMach],on=!!M&&S.started&&!uiOpen();MACH_HUD.hidden=!on;EXC_RING.visible=on&&M.k==='exc';if(!on)return;
  let l1,l2;
  if(M.k==='exc'){
    const loaded=M.load>0.05,T=loaded?excBucketAt(M,_mchV):excTeeth(M,_mchV),D=MACHS.dump,G=SIM.GOLD.SIFTER;   // loaded: the ring marks where it would land
    const overBed=D.on&&(()=>{const b=SIM.machAt(D,MACH.DUMP_BED[0],MACH.DUMP_BED[1]);return Math.hypot(T.x-b.x,T.z-b.z)<MACH.DUMP_BED_R})(),atSifter=Math.hypot(T.x-G.x,T.z-G.z)<MACH.EXC_SIFT_R;
    const why=loaded?null:excPlantWhy(M,T),ok=!loaded&&!why;
    EXC_RING.position.set(T.x,groundAt(T.x,T.z)+0.06,T.z);EXC_RING.material.color.setHex(loaded?(overBed||atSifter?0xffc040:0xd8d0c0):ok?0x94b861:0xe7a957);
    l1=`EXCAVATOR · bucket ${fmtHoles(M.load)}/${MACH.EXC_BUCKET} holes · W/S A/D drive · Mouse: swing & boom · Wheel: stick · C + mouse: curl · Right-drag: look · R: centre`;
    l2=EXCI.phase==='planted'?'TEETH IN · pull the mouse up to scoop':loaded?(overBed?'Over the truck\'s bed: let go to tip it in':atSifter?'Over the sifter: let go to tip it in':'Hold left, swing, let go to tip it here (a flick throws it) · Shift + hold: another scoop'):
      ok?'Teeth on the dirt: hold left and pull the mouse up':why==='wait'?'...':why;
  }else{
    const at=dumpAtSifter(M);
    l1=`DUMP TRUCK · bed ${fmtHoles(M.load)}/${MACH.DUMP_CAP} holes · W/S A/D drive · F: get out`;
    l2=at&&M.load>0.05?'At the sifter: E tips the load out':M.load>=MACH.DUMP_CAP-0.05?'Full: drive it to the sifter (in through the service gate)':'Park by the excavator: it tips its bucket into the bed. Diggers: F at the tail.';
  }
  const t=l1+'\n'+l2;if(MACH_HUD.textContent!==t){MACH_HUD.textContent=t;MACH_HUD.style.whiteSpace='pre-line'}
}

/* ---- every frame (90-loop.js) ---- */
function updateMachines(dt){
  machSoloSync(dt);
  const lake=machLake();
  for(const M of Object.values(MACHS)){
    const show=M.on&&lake;M.root.visible=show;if(!show){if(S.inMach===M.k)machOut();if(M.col.x0!==MACH_NO_COL.x0)machDraw(M);continue}   // (machDraw: its collider goes too)
    if(M.k==='dump'&&M.tipT>=0){M.tipT+=dt;if(M.tipT>DUMP_TIP_UP+DUMP_TIP_HOLD+DUMP_TIP_DOWN){M.tipT=-1;M.tipLoad=0}
      else if(M.tipT>DUMP_TIP_UP*0.6&&M.tipT<DUMP_TIP_UP+DUMP_TIP_HOLD&&nearCam(M.x,M.z,70)&&Math.random()<dt*12){const t=SIM.machAt(M,0,-3.9);puff(t.x,M.y+0.9,t.z,t.x,t.z,3)}}   // sand pouring off the back
    if(machMine(M)){machDrive(M,dt);if(M.k==='exc')excScoopTick(M);machSend(M,dt)}
    else if(M.tgt){const g=M.tgt,k=Math.min(1,dt*8),ox=M.x,oz=M.z;M.x+=(g.x-M.x)*k;M.z+=(g.z-M.z)*k;let dh=g.h-M.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));M.h+=dh*k;
      const mv=Math.hypot(M.x-ox,M.z-oz);if(mv>1e-4||Math.abs(dh)>1e-4){M.wheel+=mv/DUMP_WHEEL_R*Math.sign(Math.sin(M.h)*(M.x-ox)+Math.cos(M.h)*(M.z-oz));machSettle(M)}
      if(Math.hypot(g.x-M.x,g.z-M.z)<0.005&&Math.abs(dh)<0.001)M.tgt=null}
    if(M.k==='exc')excArmStep(M,dt);
    if(nearCam(M.x,M.z,160))machDraw(M);
  }
  machHud();
}

/* ---- console: `machines` says where they are; `machines park` (host) puts them back by the service gate ---- */
command('machines',{usage:'machines [park]',help:'The excavator and the dump truck: where they are, who is driving, what they carry. park (host): everyone out, back by the service gate.',
  run([a]){
    if(a==='park'){if(online()){wsSend({t:'exc',op:'park'});return'Parking the machines.'}for(const M of Object.values(MACHS)){if(machMine(M))machOut();Object.assign(M,M.k==='exc'?MACH.EXC_PARK:MACH.DUMP_PARK);machSettle(M)}machSoloSave();return'The machines are back by the service gate.'}
    return Object.values(MACHS).map(M=>M.on?`${M.name}: at ${M.x.toFixed(1)}, ${M.z.toFixed(1)}, ${M.drv!=null?machWho(M.drv)+' driving':'parked'}, ${fmtHoles(M.load)} holes (x${M.rich.toFixed(2)})`:`${M.name}: not bought`).join(' | ')}});
