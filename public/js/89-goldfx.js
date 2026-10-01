'use strict';
/* public/js/89-goldfx.js -- panning and sifting you watch happen (JT 2026-10-01: "much better animations for the sifter
   and the pan ... first person ... actually sifting the sand through the pan, and actually dumping the bucket in the top
   of the sifter and watching the sand roll through").
   Both take over your view for a few seconds (you can't walk or look about meanwhile), then hand it back:
   - THE PAN (gold pan, at the wash tub by the water drums): your hands bring the pan up, dip it in the tub, lift it out
     full of muddy water and swirl it; sand and water slop over the far lip, the sand in it shrinks to nothing, the
     water clears, and the gold flecks are left glinting in the bottom. Then you're paid (45-state.js washPan).
   - THE SIFTER (a bucket of sand): your bucket comes up over the hopper and tips; the sand pours in, the crank turns,
     the sand tumbles down the riffle tray, hopping the riffles, and off the end onto the tailings; the gold catches
     behind the riffles and slides down into the catch pan. Then you're paid (45-state.js siftBucket).
   Models are Blender's (art/blender/sifter.py: GoldPan, CampBucket, WashTub, SifterCrank, Sifter); your hands are the
   camper's own (camper.glb). The sand is grains in two instanced meshes: one draw call for the sand, one for the gold.
   Looks only: nothing here decides how much gold you get. */
const GFX={on:null,t:0,done:null,yaw:0,pitch:0,cam:new T.Vector3(),look:new T.Vector3(),camT:new T.Vector3(),lookT:new T.Vector3()};
const GFX_SAND=900,GFX_GOLD=48,GFX_TRAY_W=0.62;
const GFX_SIFT_T=8.6,GFX_PAN_T=6.2;   // how long each takes (s)
/* the wash tub (art/blender/sifter.py WashTub), by the water drums: you pan in it */
const TUB={x:10.3,z:35.2,r:0.43,waterY:0.4};
{solid(TUB.x,TUB.z,0.95,0.95);placeModel('WashTub',{x:TUB.x,y:baseH(TUB.x,TUB.z),z:TUB.z,ry:0.3}).catch(()=>{})}
SPOTS.push({id:'water',x:TUB.x,z:TUB.z,r:2.4});   // F at the tub: wash your pan (or drink: it's the same water as the drums)

/* ---- the grains ---- */
const gfxGeo=new T.IcosahedronGeometry(1,0);
const gfxSandIM=new T.InstancedMesh(gfxGeo,new T.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true}),GFX_SAND);
const gfxGoldIM=new T.InstancedMesh(gfxGeo,new T.MeshStandardMaterial({color:0xffcf3a,emissive:0x7a5200,metalness:0.9,roughness:0.22,flatShading:true}),GFX_GOLD);
for(const im of[gfxSandIM,gfxGoldIM]){im.frustumCulled=false;im.instanceMatrix.setUsage(T.DynamicDrawUsage);im.castShadow=false;im.visible=false;scene.add(im)}
{const c=new T.Color();for(let i=0;i<GFX_SAND;i++){c.setHex([0xcaa874,0xbf9c66,0xd6b684,0xa98a5c,0x8f7650][i%5]);gfxSandIM.setColorAt(i,c)}gfxSandIM.instanceColor.needsUpdate=true}
const gfxGr=[],gfxGd=[];   // {x,y,z,vx,vy,vz,s,m (mode),u,w,h,vh,t,k}
const _gm=new T.Matrix4(),_gq=new T.Quaternion(),_gs=new T.Vector3(),_gp=new T.Vector3(),_ge=new T.Euler();
function gfxDraw(){
  const put=(im,list,n)=>{let i=0;for(const g of list){if(i>=n)break;if(g.m==='gone')continue;_ge.set(g.rx||0,g.ry||0,0);_gq.setFromEuler(_ge);_gs.setScalar(g.s*(g.fade==null?1:g.fade));_gp.set(g.x,g.y,g.z);im.setMatrixAt(i++,_gm.compose(_gp,_gq,_gs))}
    _gs.setScalar(0);_gm.compose(_gp,_gq,_gs);for(;i<n;i++)im.setMatrixAt(i,_gm);im.instanceMatrix.needsUpdate=true};
  put(gfxSandIM,gfxGr,GFX_SAND);put(gfxGoldIM,gfxGd,GFX_GOLD);
}

/* ---- props: your hands, the bucket, the pan, the sifter's crank ---- */
let gfxParts={};
for(const n of['GoldPan','CampBucket'])modelParts(n).then(p=>{gfxParts[n]=p}).catch(()=>{});
function gfxModel(n){const g=new T.Group();for(const pt of gfxParts[n]||[]){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;g.add(m)}return g}
function gfxHand(side){   // a copy of your camper's hand (camper.glb), for the props you're holding
  const hm=me&&me.model&&me.model.getObjectByName('CGLCamper_'+side+'_Hand');if(!hm)return new T.Group();
  const h=new T.Mesh(hm.geometry,hm.material);const ws=new T.Vector3();hm.getWorldScale(ws);h.scale.setScalar(ws.x*1.1);return h;
}
let gfxCrank=null;
placeModel('SifterCrank',{x:0,y:0,z:0,ry:0}).then(g=>{   // on the sifter's blower axle (sifter.py CRANK_AT), turned while it runs
  const S0=SIM.GOLD.SIFTER,cx=-0.35,cy=-0.75-0.34,cz=0.42;g.position.set(S0.x+cx,baseH(S0.x,S0.z)+cz,S0.z-cy);
  for(const m of g.children){m.matrixAutoUpdate=true;m.matrix.decompose(m.position,m.quaternion,m.scale)}
  gfxCrank=g}).catch(()=>{});

/* the sifter, in the game's frame: Blender (x, y, z) about its origin -> world (ry 0: x = x, z = -y, y = up) */
function sloc(bx,by,bz,v){const S0=SIM.GOLD.SIFTER;return(v||new T.Vector3()).set(S0.x+bx,baseH(S0.x,S0.z)+bz,S0.z-by)}
const SFT={X0:-1.05,X1:1.05,Z0:1.32,Z1:0.78,hopX:-0.85,hopZ:1.66,panX:1.37};
const SFT_SL=Math.hypot(SFT.X1-SFT.X0,SFT.Z0-SFT.Z1);
const SFT_RIF=Array.from({length:9},(_,k)=>(0.35+k*0.2)/SFT_SL);   // the riffles, as a share of the way down the tray (sifter.py)
const trayAt=(u,w,v)=>sloc(SFT.X0+(SFT.X1-SFT.X0)*u,w,SFT.Z0+(SFT.Z1-SFT.Z0)*u+0.045,v);

/* ---- starting one ---- */
function gfxBusy(){return!!GFX.on}
function gfxStart(kind,payload,done){
  if(GFX.on)return false;
  GFX.on=kind;GFX.t=0;GFX.done=done;GFX.p=payload||{};GFX.yaw=P.yaw;GFX.pitch=P.pitch;
  camera.updateMatrixWorld();GFX.cam.copy(camera.position);camera.getWorldDirection(GFX.look);GFX.look.multiplyScalar(3).add(camera.position);
  gfxGr.length=0;gfxGd.length=0;gfxSandIM.visible=gfxGoldIM.visible=true;digHeld=false;
  GFX.root=new T.Group();scene.add(GFX.root);
  if(kind==='pan')gfxPanStart();else gfxSiftStart();
  logEv('goldfx',{kind});return true;
}
function gfxEnd(){
  const done=GFX.done;GFX.on=null;GFX.done=null;scene.remove(GFX.root);GFX.root=null;gfxSandIM.visible=gfxGoldIM.visible=false;gfxGr.length=0;gfxGd.length=0;
  P.yaw=GFX.yaw;P.pitch=GFX.pitch;if(me)me.g.visible=true;
  if(done)done();
}

/* ---- the sifter ---- */
function gfxSiftStart(){
  const R=GFX.root,b=GFX.bucket=new T.Group(),m=gfxModel('CampBucket');m.scale.setScalar(1.35);b.add(m);
  const hl=gfxHand('L'),hr=gfxHand('R');hl.position.set(-0.07,0.62,0);hr.position.set(0.07,0.62,0);b.add(hl,hr);   // both hands on the bail (0.53 m up the scaled bucket): wrists above, fingers down round it
  R.add(b);b.visible=false;GFX.poured=0;
  // the view: the blower side of the sifter (the sign's on the other), above it, looking down into the hopper
  sloc(-0.1,-1.75,2.3,GFX.camT);sloc(SFT.hopX,0.05,SFT.hopZ,GFX.lookT);
}
function gfxSiftStep(dt){
  const t=GFX.t,b=GFX.bucket,hop=sloc(SFT.hopX,0,SFT.hopZ+0.55);
  // the bucket: up from below the view, over the hopper, tip, back out
  const up=sm(clamp((t-0.5)/0.8,0,1)),tip=sm(clamp((t-1.3)/0.7,0,1))-sm(clamp((t-3.2)/0.6,0,1)),away=sm(clamp((t-3.4)/0.7,0,1));
  b.visible=t>0.45&&t<4.2;
  b.position.set(hop.x+0.05,hop.y-0.9*(1-up)-0.6*away+0.15,hop.z+0.42+0.3*(1-up)+0.4*away);
  b.rotation.set(-tip*2.15,0,0);   // tips toward the hopper (game -z is the sifter's +Y side: the bucket comes from the south)
  // the sand pours from its lip while it's tipped
  if(tip>0.55&&GFX.poured<GFX_SAND){const n=Math.min(GFX_SAND-GFX.poured,Math.ceil(dt*GFX_SAND/1.4));
    const lip=new T.Vector3(0,0.32*1.35,-0.17*1.35).applyEuler(b.rotation).add(b.position);
    for(let i=0;i<n;i++){gfxGr.push({x:lip.x+(Math.random()-0.5)*0.14,y:lip.y+(Math.random()-0.5)*0.05,z:lip.z+(Math.random()-0.5)*0.06,vx:(Math.random()-0.5)*0.4,vy:-0.3-Math.random()*0.6,vz:-0.5-Math.random()*0.5,s:0.008+Math.random()*0.012,m:'pour',rx:Math.random()*6,ry:Math.random()*6});
      if(Math.random()<GFX_GOLD/GFX_SAND*1.1&&gfxGd.length<GFX_GOLD)gfxGd.push({x:lip.x,y:lip.y,z:lip.z,vx:(Math.random()-0.5)*0.3,vy:-0.4,vz:-0.6,s:0.009+Math.random()*0.006,m:'pour',gold:true,rx:Math.random()*6})}
    GFX.poured+=n;if(nearCam(hop.x,hop.z,20)&&Math.random()<0.4)noise(0.12,700,0.5,0.05,'bandpass')}
  // the crank turns and the blower puffs while there's sand on the tray
  const running=t>1.8&&t<GFX_SIFT_T-1;
  if(gfxCrank&&running)gfxCrank.rotation.z-=dt*7;
  if(running&&Math.random()<dt*9)noise(0.09,320,0.8,0.03,'lowpass');
  // the camera: the hopper while it pours, then down the tray with the sand, then the catch pan
  const lk=t<2.6?sloc(SFT.hopX,0.05,SFT.hopZ):t<6.4?trayAt(clamp((t-2.6)/3.4,0,1)*0.85+0.1,0):sloc(SFT.panX,0,0.1);
  GFX.lookT.lerp(lk,Math.min(1,dt*2.2));
  if(t>2.6)GFX.camT.lerp(t<6.4?sloc(0.2,-1.55,2.0):sloc(1.15,-1.05,1.75),Math.min(1,dt*0.9));
  // the grains
  const step=(g,gold)=>{
    if(g.m==='pour'){g.vy-=9.8*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;
      const fl=sloc(SFT.hopX,0,SFT.hopZ-0.32);if(g.y<=fl.y+0.02){g.m='tray';g.u=0.02+Math.random()*0.04;g.w=(Math.random()-0.5)*(GFX_TRAY_W-0.1);g.h=0.02;g.vh=0;g.spd=(0.28+Math.random()*0.18)*(gold?0.8:1);g.k=0}}
    else if(g.m==='tray'){
      g.u+=g.spd*dt;g.w=clamp(g.w+(Math.random()-0.5)*dt*0.3,-GFX_TRAY_W/2+0.04,GFX_TRAY_W/2-0.04);
      while(g.k<SFT_RIF.length&&g.u>SFT_RIF[g.k]){   // over a riffle: a hop (and the gold, mostly, stops there)
        if(gold&&Math.random()<0.6){g.m='caught';g.u=SFT_RIF[g.k]-0.012;g.caughtAt=GFX.t;break}
        g.vh=0.35+Math.random()*0.35;g.k++}
      g.vh-=6*dt;g.h=Math.max(0.0,g.h+g.vh*dt);if(g.h===0)g.vh=0;
      if(g.m==='tray'&&g.u>=1){g.m='off';const e=trayAt(1,g.w);g.x=e.x;g.y=e.y;g.z=e.z;g.vx=0.5+Math.random()*0.4;g.vy=0.1;g.vz=(Math.random()-0.5)*0.2;
        if(gold){g.m='topan'}}
      else if(g.m==='tray'){const q=trayAt(g.u,g.w);g.x=q.x;g.y=q.y+g.h;g.z=q.z;g.rx=(g.rx||0)+dt*8}}
    else if(g.m==='caught'){const q=trayAt(g.u,g.w);g.x=q.x;g.y=q.y+0.005;g.z=q.z;g.s=g.s0||(g.s0=g.s);g.s=g.s0*(1+0.25*Math.sin(GFX.t*14+g.w*40));   // glinting behind its riffle
      if(GFX.t>6.6+g.w)g.m='tray',g.k=99}   // the last of the water washes it down to the catch pan
    else if(g.m==='off'||g.m==='topan'){g.vy-=9.8*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;
      const floor=g.m==='topan'?sloc(SFT.panX,0,0.06).y:groundAt(g.x,g.z)+0.01;if(g.y<=floor){g.y=floor;g.m='rest';g.vx=g.vy=g.vz=0;g.t=0}
      if(g.m==='topan'){const pc=sloc(SFT.panX,0,0);g.x+=(pc.x+(g.w||0)*0.3-g.x)*Math.min(1,dt*4);g.z+=(pc.z+(g.w||0)*0.3-g.z)*Math.min(1,dt*4)}}
    else if(g.m==='rest'){g.t+=dt;if(!gold&&g.t>2)g.fade=Math.max(0,1-(g.t-2)/1.2);if(gold)g.s=(g.s0||g.s)*(1+0.3*Math.max(0,Math.sin(GFX.t*9+g.x*50)))}
  };
  for(const g of gfxGr)step(g,false);for(const g of gfxGd)step(g,true);
}

/* ---- the pan ---- */
function gfxPanStart(){
  const R=GFX.root,pan=GFX.pan=new T.Group(),m=gfxModel('GoldPan');pan.add(m);
  GFX.hands=[gfxHand('L'),gfxHand('R')];pan.add(...GFX.hands);   // placed on the rim, left and right of where you're looking from (gfxPanStep)
  // what's in it: a heap of sand, the water, and (under it all) the gold
  const sand=GFX.panSand=new T.Mesh(new T.CylinderGeometry(0.11,0.12,0.03,18),new T.MeshStandardMaterial({color:0xb99a68,roughness:1,flatShading:true}));sand.position.y=0.025;pan.add(sand);
  const water=GFX.panWater=new T.Mesh(new T.CylinderGeometry(0.175,0.13,0.035,22),new T.MeshStandardMaterial({color:0x7a6a4a,roughness:0.15,metalness:0.1,transparent:true,opacity:0.0}));water.position.y=0.045;pan.add(water);
  R.add(pan);
  const tub=new T.Vector3(TUB.x,baseH(TUB.x,TUB.z)+TUB.waterY,TUB.z),dx=P.x-TUB.x,dz=P.z-TUB.z,dl=Math.hypot(dx,dz)||1;GFX.dir={x:dx/dl,z:dz/dl};GFX.tub=tub;
  {const rx=-GFX.dir.z,rz=GFX.dir.x;GFX.hands.forEach((h,i)=>{const sd=i?1:-1;h.position.set(rx*0.205*sd+GFX.dir.x*0.04,0.15,rz*0.205*sd+GFX.dir.z*0.04);h.rotation.set(0,Math.atan2(rx*sd,rz*sd),0)})}   // wrists just above the rim, fingers down over it
  GFX.camT.set(tub.x+GFX.dir.x*0.62,tub.y+0.56,tub.z+GFX.dir.z*0.62);GFX.lookT.set(tub.x+GFX.dir.x*0.12,tub.y+0.05,tub.z+GFX.dir.z*0.12);
  const n=clamp(Math.round(GFX.p.gold||4),3,GFX_GOLD);for(let i=0;i<n;i++){const a=Math.random()*6.28,r=0.02+Math.random()*0.07;gfxGd.push({lx:Math.cos(a)*r,lz:Math.sin(a)*r,s:0.0045+Math.random()*0.004,m:'inpan',rx:Math.random()*6,ry:Math.random()*6,x:0,y:-50,z:0})}
}
function gfxPanStep(dt){
  const t=GFX.t,pan=GFX.pan,tub=GFX.tub,D=GFX.dir;
  // where the pan is: brought up, dipped under, lifted, swirled, tipped toward you
  const bring=sm(clamp(t/0.6,0,1)),dip=Math.sin(clamp((t-0.6)/1.1,0,1)*Math.PI),swirl=t>1.8&&t<4.6,show=sm(clamp((t-4.7)/0.6,0,1));
  const base=new T.Vector3(tub.x+D.x*0.2,tub.y+0.2*bring-0.5*(1-bring)+0.08-0.11*dip,tub.z+D.z*0.16);
  let ox=0,oz=0,tilt=0;
  if(swirl){const w=(t-1.8)*15;ox=Math.cos(w)*0.022;oz=Math.sin(w)*0.022;tilt=0.12+0.06*Math.sin(w)}
  pan.position.set(base.x+ox,base.y,base.z+oz);
  pan.rotation.set(0,0,0);pan.rotateOnWorldAxis(new T.Vector3(-D.z,0,D.x),tilt);   // swirling: the far lip dips, so it slops out over there
  pan.rotateOnWorldAxis(new T.Vector3(D.z,0,-D.x),show*0.75);   // and at the end, tipped up toward you
  // the water: it comes in on the dip, thins as you swirl, clears at the end
  const wm=GFX.panWater.material;wm.opacity=t<0.9?0:t<1.6?0.85:swirl?0.85-0.5*((t-1.8)/2.8):Math.max(0,0.35-(t-4.6));GFX.panWater.visible=wm.opacity>0.02;
  if(swirl)GFX.panWater.scale.set(1,1,1),GFX.panWater.position.x=ox*1.5,GFX.panWater.position.z=oz*1.5;
  // the sand: washes out over the lip as you swirl
  const left=t<1.8?1:swirl?1-((t-1.8)/2.8):0;GFX.panSand.scale.set(0.4+0.6*left,Math.max(0.02,left),0.4+0.6*left);GFX.panSand.visible=left>0.01;
  if(swirl&&Math.random()<dt*70){const far=new T.Vector3(-D.x*0.19,0.06,-D.z*0.19).add(pan.position);
    gfxGr.push({x:far.x+(Math.random()-0.5)*0.08,y:far.y,z:far.z+(Math.random()-0.5)*0.08,vx:-D.x*(0.3+Math.random()*0.3),vy:0.05,vz:-D.z*(0.3+Math.random()*0.3),s:0.005+Math.random()*0.007,m:'spill',rx:Math.random()*6})
    if(Math.random()<0.15&&nearCam(tub.x,tub.z,10))noise(0.08,1200,0.5,0.035,'bandpass')}
  for(const g of gfxGr){if(g.m!=='spill')continue;g.vy-=9.8*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;if(g.y<tub.y-0.02)g.m='gone'}
  // the gold, in the bottom of the pan: hidden under the sand until it's washed, then glinting
  const pm=pan.matrixWorld;pan.updateMatrixWorld(true);
  for(const g of gfxGd){const v=new T.Vector3(g.lx,0.016,g.lz).applyMatrix4(pm);g.x=v.x;g.y=v.y;g.z=v.z;g.fade=clamp((t-3.6)/0.8,0,1)*(1+0.35*Math.max(0,Math.sin(t*10+g.lx*90)))}
  // the view: down into the pan, a little closer at the end
  if(t>4.6)GFX.camT.lerp(new T.Vector3(tub.x+D.x*0.58,tub.y+0.5,tub.z+D.z*0.58),Math.min(1,dt*1.5)),GFX.lookT.lerp(pan.position,Math.min(1,dt*3));
  if(t>0.6&&t<0.75&&nearCam(tub.x,tub.z,10))sfx.splash();
}

/* ---- every frame, after updateCamera (90-loop.js): run it and drive the view ---- */
function updateGoldFx(dt){
  if(!GFX.on)return;
  GFX.t+=dt;
  if(me)me.g.visible=false;   // your own body would only get in the shot (first or third person)
  if(GFX.on==='pan')gfxPanStep(dt);else gfxSiftStep(dt);
  const k=Math.min(1,dt*(GFX.t<0.8?3:2.2));GFX.cam.lerp(GFX.camT,k);GFX.look.lerp(GFX.lookT,Math.min(1,dt*3.5));
  camera.position.copy(GFX.cam);camera.lookAt(GFX.look);
  if(vm)vm.visible=false;if(FPH.g)FPH.g.visible=false;
  gfxDraw();
  if(GFX.t>=(GFX.on==='pan'?GFX_PAN_T:GFX_SIFT_T))gfxEnd();
}
