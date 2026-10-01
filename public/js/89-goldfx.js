'use strict';
/* First-person gold work. All props, grip poses, arms and fluid surfaces are authored in
   art/blender/goldfx.py. Runtime animation poses those assets and advances bounded particle pools.
   Rewards are chosen by 45-state.js before playback; this file only shows that payload. */
const GFX={on:null,t:0,done:null,yaw:0,pitch:0,cam:new T.Vector3(),look:new T.Vector3(),camT:new T.Vector3(),lookT:new T.Vector3()};
const GFX_SAND=900,GFX_GOLD=48,GFX_DROP=240,GFX_DUST=72,GFX_TRAY_W=0.62;
const GFX_SIFT_T=9.2,GFX_PAN_T=7.0;
const TUB={x:10.3,z:35.2,r:0.43,waterY:0.4};
{solid(TUB.x,TUB.z,0.95,0.95);placeModel('WashTub',{x:TUB.x,y:baseH(TUB.x,TUB.z),z:TUB.z,ry:0.3}).catch(()=>{})}
SPOTS.push({id:'water',x:TUB.x,z:TUB.z,r:2.4});

/* Reusable pools: no per-run geometry allocation, and no permanent particles left in the world. */
const gfxGeo=new T.IcosahedronGeometry(1,0);
const gfxSandIM=new T.InstancedMesh(gfxGeo,new T.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true}),GFX_SAND);
const gfxGoldIM=new T.InstancedMesh(gfxGeo,new T.MeshStandardMaterial({color:0xffd35b,emissive:0x755010,metalness:0.55,roughness:0.25,flatShading:true}),GFX_GOLD);
const gfxDropIM=new T.InstancedMesh(gfxGeo,new T.MeshStandardMaterial({color:0xa3cdc6,roughness:0.18,transparent:true,opacity:0.65,depthWrite:false}),GFX_DROP);
const gfxDustIM=new T.InstancedMesh(gfxGeo,new T.MeshBasicMaterial({color:0xcab58b,transparent:true,opacity:0.065,depthWrite:false}),GFX_DUST);
for(const im of[gfxSandIM,gfxGoldIM,gfxDropIM,gfxDustIM]){im.frustumCulled=false;im.instanceMatrix.setUsage(T.DynamicDrawUsage);im.visible=false;scene.add(im)}
{const c=new T.Color();for(let i=0;i<GFX_SAND;i++){c.setHex([0xc6a06b,0xb9945e,0xd5b47c,0xa28251,0x987b51][i%5]);gfxSandIM.setColorAt(i,c)}gfxSandIM.instanceColor.needsUpdate=true}
const gfxGr=[],gfxGd=[],gfxDrops=[],gfxDust=[];
const _gm=new T.Matrix4(),_gq=new T.Quaternion(),_gs=new T.Vector3(),_gp=new T.Vector3(),_ge=new T.Euler(),_gfxUp=new T.Vector3(0,1,0);
function gfxDraw(){
  const put=(im,list,n)=>{let i=0;for(const g of list){if(i>=n)break;if(g.m==='gone'||g.fade===0)continue;
    _ge.set(g.rx||0,g.ry||0,0);_gq.setFromEuler(_ge);const s=g.s*(g.fade==null?1:g.fade);
    _gs.set(s*(g.sx||1),s*(g.sy||1),s*(g.sz||1));_gp.set(g.x,g.y,g.z);im.setMatrixAt(i++,_gm.compose(_gp,_gq,_gs))}
    im.count=i;im.instanceMatrix.needsUpdate=true};
  put(gfxSandIM,gfxGr,GFX_SAND);put(gfxGoldIM,gfxGd,GFX_GOLD);put(gfxDropIM,gfxDrops,GFX_DROP);put(gfxDustIM,gfxDust,GFX_DUST);
}

/* Asset arrivals also fill props created while the download was still in flight. */
const gfxParts={},gfxWaiting=new Map();
const GFX_ASSETS=['GoldPan','CampBucketEmpty','CampBucketBail','GoldFxBucketSand','GoldFxSediment','GoldFxBlackSand','GoldFxWater','GoldFxPanHands','GoldFxBucketHandL','GoldFxBucketHandR','GoldFxArm','GoldFxStream','GoldFxSpill','GoldFxRipple'];
for(const n of GFX_ASSETS)modelParts(n).then(p=>{gfxParts[n]=p;for(const fill of gfxWaiting.get(n)||[])fill();gfxWaiting.delete(n)}).catch(()=>{gfxWaiting.delete(n)});
function gfxModel(n,tint){
  const g=new T.Group(),owner=GFX.root;
  const fill=()=>{if(owner!==GFX.root)return;for(const pt of gfxParts[n]||[]){let mat=pt.material;
    if(tint||/gfx_skin|gfx_sleeve|gfx_cuff/.test(mat.name)){mat=mat.clone();GFX.materials.push(mat);
      if(/gfx_skin/.test(mat.name)&&me&&me.o)mat.color.setHex(me.o.skin);
      if(/gfx_sleeve|gfx_cuff/.test(mat.name)&&me&&me.o&&me.o.suit!=null)mat.color.setHex(me.o.suit);
      if(tint){mat.transparent=true;mat.depthWrite=false;mat.side=n==='GoldFxWater'?T.FrontSide:T.DoubleSide}}
    const m=new T.Mesh(pt.geometry,mat);m.castShadow=!tint;m.receiveShadow=!tint;g.add(m)}};
  if(gfxParts[n])fill();else{if(!gfxWaiting.has(n))gfxWaiting.set(n,[]);gfxWaiting.get(n).push(fill)}
  return g;
}
function gfxOpacity(g,opacity){g.visible=opacity>0.005;g.traverse(m=>{if(m.isMesh)m.material.opacity=opacity})}
function gfxSpan(g,a,b,width=1){g.position.copy(a);const v=b.clone().sub(a);g.quaternion.setFromUnitVectors(_gfxUp,v.clone().normalize());g.scale.set(width,v.length(),width)}
function gfxArms(parents,sockets){GFX.armParents=parents;GFX.sockets=sockets;GFX.arms=sockets.map(()=>{const g=gfxModel('GoldFxArm');GFX.root.add(g);return g})}
function gfxPoseArms(){
  for(const p of GFX.armParents)p.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),down=new T.Vector3(0,-1,0).applyQuaternion(camera.quaternion),front=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  GFX.arms.forEach((g,i)=>{const p=GFX.armParents[i];g.visible=p.visible;const a=new T.Vector3(...GFX.sockets[i]).applyMatrix4(p.matrixWorld);
    const b=camera.position.clone().addScaledVector(right,i?0.36:-0.36).addScaledVector(down,0.57).addScaledVector(front,0.16);gfxSpan(g,a,b)})
}
let gfxCrank=null,gfxTray=null;
placeModel('SifterCrank',{x:0,y:0,z:0}).then(g=>{
  const S0=SIM.GOLD.SIFTER;g.position.set(S0.x-0.35,baseH(S0.x,S0.z)+0.42,S0.z+1.09);
  for(const m of g.children){m.matrixAutoUpdate=true;m.matrix.decompose(m.position,m.quaternion,m.scale)}gfxCrank=g;
}).catch(()=>{});
{const s=SIM.GOLD.SIFTER;placeModel('SifterTray',{x:s.x,y:baseH(s.x,s.z),z:s.z,ry:s.ry}).then(g=>{gfxTray=g}).catch(()=>{})}
function sloc(bx,by,bz,v){const s=SIM.GOLD.SIFTER;return(v||new T.Vector3()).set(s.x+bx,baseH(s.x,s.z)+bz,s.z-by)}
const SFT={X0:-1.05,X1:1.05,Z0:1.32,Z1:0.78,hopX:-0.85,hopZ:1.86,panX:1.37};
const SFT_SL=Math.hypot(SFT.X1-SFT.X0,SFT.Z0-SFT.Z1);
const SFT_RIF=Array.from({length:9},(_,k)=>(0.35+k*0.2)/SFT_SL);
const trayAt=(u,w,v)=>sloc(SFT.X0+(SFT.X1-SFT.X0)*u,w,SFT.Z0+(SFT.Z1-SFT.Z0)*u+0.045+(GFX.shake||0),v);
const gfxEase=(t,a,b)=>sm(clamp((t-a)/(b-a),0,1));
function gfxGoldCount(){return clamp(Math.round(GFX.p.gold||0),0,GFX_GOLD)}
function gfxBusy(){return!!GFX.on}
function gfxStart(kind,payload,done){
  if(GFX.on)return false;
  GFX.on=kind;GFX.t=0;GFX.done=done;GFX.p=payload||{};GFX.yaw=P.yaw;GFX.pitch=P.pitch;GFX.shake=0;GFX.materials=[];
  camera.updateMatrixWorld();GFX.cam.copy(camera.position);camera.getWorldDirection(GFX.look);GFX.look.multiplyScalar(3).add(camera.position);GFX.homeCam=GFX.cam.clone();GFX.homeLook=GFX.look.clone();
  for(const a of[gfxGr,gfxGd,gfxDrops,gfxDust])a.length=0;
  for(const im of[gfxSandIM,gfxGoldIM,gfxDropIM,gfxDustIM]){im.count=0;im.visible=true}
  digHeld=false;GFX.root=new T.Group();scene.add(GFX.root);
  if(kind==='pan')gfxPanStart();else gfxSiftStart();
  logEv('goldfx',{kind});return true;
}
function gfxEnd(){
  const done=GFX.done;GFX.on=null;GFX.done=null;scene.remove(GFX.root);GFX.root=null;
  for(const m of GFX.materials)m.dispose();GFX.materials=[];
  for(const im of[gfxSandIM,gfxGoldIM,gfxDropIM,gfxDustIM])im.visible=false;
  for(const a of[gfxGr,gfxGd,gfxDrops,gfxDust])a.length=0;
  if(gfxTray)gfxTray.position.y=0;GFX.shake=0;
  P.yaw=GFX.yaw;P.pitch=GFX.pitch;if(me)me.g.visible=true;
  if(done)done();
}
function gfxBallistic(list,dt,floor){
  for(const g of list){if(g.m==='gone')continue;g.age=(g.age||0)+dt;g.vy-=9.8*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;
    if(g.y<floor||g.age>0.8)g.m='gone';else g.fade=1-g.age/0.8}
  while(list.length&&list[0].m==='gone')list.shift();
}

/* A weighted lift, held pour, last shake, then follow the material all the way down. */
function gfxSiftStart(){
  const R=GFX.root,b=GFX.bucket=new T.Group(),pail=gfxModel('CampBucketEmpty');pail.scale.setScalar(1.35);b.add(pail);
  const load=GFX.bucketSand=gfxModel('GoldFxBucketSand');load.scale.setScalar(1.35);b.add(load,gfxModel('GoldFxBucketHandR'));R.add(b);
  const bail=GFX.bail=new T.Group(),handle=gfxModel('CampBucketBail');handle.scale.setScalar(1.35);bail.add(handle,gfxModel('GoldFxBucketHandL'));R.add(bail);
  gfxArms([bail,b],[[-.095,.2215,.085],[.231,.028,.081]]);
  GFX.stream=gfxModel('GoldFxStream');R.add(GFX.stream);GFX.stream.visible=false;
  GFX.hopperSand=gfxModel('GoldFxBucketSand');R.add(GFX.hopperSand);GFX.hopperSand.visible=false;
  GFX.poured=0;GFX.emit=0;GFX.dustEmit=0;GFX.soundT=0;
  for(let i=0;i<gfxGoldCount();i++)gfxGd.push({m:'waiting',s:0.009+Math.random()*0.005,fade:0,rx:Math.random()*6,ry:Math.random()*6,cx:(Math.random()-.5)*.28,cz:(Math.random()-.5)*.28});
  sloc(-.25,-1.45,2.7,GFX.camT);sloc(-.65,0,1.74,GFX.lookT);
}
function gfxSiftStep(dt){
  const t=GFX.t,b=GFX.bucket,hop=sloc(SFT.hopX,0,SFT.hopZ);
  const up=gfxEase(t,.3,1.3),tip=gfxEase(t,1.35,2.15)-gfxEase(t,3.5,4.15),away=gfxEase(t,4.15,4.85);
  b.visible=t<4.85;b.rotation.set(-tip*1.95,0,.035*Math.sin(t*3)*tip);
  const lipLocal=new T.Vector3(0,.378,-.2),rotLip=lipLocal.clone().applyEuler(b.rotation);
  const lip=hop.clone().add(new T.Vector3(.02, .52-.26*tip-1.1*(1-up)-.5*away,.36-.3*tip+.6*(1-up)+.6*away));
  b.position.copy(lip).sub(rotLip);b.updateMatrixWorld(true);
  GFX.bail.position.copy(new T.Vector3(0,.3375,0).applyMatrix4(b.matrixWorld));GFX.bail.rotation.set(.07*Math.sin(t*3)*(1-away),0,.04*Math.sin(t*2));GFX.bail.visible=b.visible;
  const pouring=t>=1.9&&t<3.5;
  GFX.bucketSand.visible=GFX.poured<GFX_SAND;
  const remain=1-GFX.poured/GFX_SAND;GFX.bucketSand.scale.set(1.35,1.35*Math.max(.03,remain),1.35);
  if(pouring){
    GFX.emit+=dt*GFX_SAND/1.6;const n=Math.min(GFX_SAND-GFX.poured,Math.floor(GFX.emit));GFX.emit-=n;
    for(let i=0;i<n;i++)gfxGr.push({x:lip.x+(Math.random()-.5)*.055,y:lip.y,z:lip.z+(Math.random()-.5)*.035,vx:-.04,vy:-.65,vz:-.10,s:.008+Math.random()*.008,m:'pour',rx:Math.random()*6,ry:Math.random()*6});
    GFX.poured+=n;
    const end=sloc(SFT.hopX,0,SFT.hopZ-.15);gfxSpan(GFX.stream,lip,end,.75+.16*Math.sin(t*23));GFX.stream.visible=true;
  }else GFX.stream.visible=false;
  if(t>2.2)for(const g of gfxGd)if(g.m==='waiting'){g.m='hopper';g.wait=.08+Math.random()*.45;g.w=(Math.random()-.5)*.42;g.x=hop.x;g.y=hop.y-.15;g.z=hop.z-g.w;g.u=.07;g.spd=.26+Math.random()*.05;g.k=0;g.h=0;g.vh=0}
  const fill=gfxEase(t,1.9,2.6)*(1-gfxEase(t,3.1,4.1));
  GFX.hopperSand.visible=fill>.01;GFX.hopperSand.position.copy(sloc(SFT.hopX,0,SFT.hopZ-.26));GFX.hopperSand.scale.set(1.6,.38*fill,1.6);
  const running=t>2&&t<8.1,envelope=gfxEase(t,2,2.4)*(1-gfxEase(t,7.5,8.1));
  GFX.shake=Math.sin(t*48)*.006*envelope;if(gfxTray)gfxTray.position.y=GFX.shake;
  if(gfxCrank&&running)gfxCrank.rotation.z-=dt*9*envelope;
  if(running){GFX.soundT+=dt;if(GFX.soundT>.18){GFX.soundT=0;noise(.07,360,0.8,.026,'lowpass')}
    GFX.dustEmit+=dt*19;while(GFX.dustEmit>=1){GFX.dustEmit--;if(gfxDust.length<GFX_DUST){const q=trayAt(Math.random()*.85,.28);gfxDust.push({x:q.x,y:q.y+.02,z:q.z,vx:.2,vy:.12,vz:-.38,age:0,s:.035+Math.random()*.035,m:'dust'})}}}
  const step=(g,gold)=>{
    if(g.m==='waiting')return;
    if(g.m==='pour'){
      g.vy-=9.8*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;
      if(g.y<hop.y-.15){g.m='hopper';g.wait=.1+Math.random()*.24;g.w=(Math.random()-.5)*.49;g.u=.06;g.spd=.30+Math.random()*.07;g.k=0;g.h=0;g.vh=0;g.y=hop.y-.15}
    }else if(g.m==='hopper'){
      g.wait-=dt;const q=trayAt(g.u,g.w);g.y=Math.max(q.y,g.y-dt*(g.wait<0?1.5:.08));g.x+=(q.x-g.x)*Math.min(1,dt*5);g.z+=(q.z-g.z)*Math.min(1,dt*5);
      if(g.y<=q.y+.002)g.m='tray';
    }else if(g.m==='tray'){
      g.u+=g.spd*dt*(.86+.14*Math.sin(t*30));
      if(g.k<SFT_RIF.length&&g.u>SFT_RIF[g.k]){g.u-=.007;g.vh=.17+Math.random()*.14;g.k++}
      g.vh-=5*dt;g.h=Math.max(0,g.h+g.vh*dt);if(!g.h)g.vh=0;
      const q=trayAt(Math.min(1,g.u),g.w);g.x=q.x;g.y=q.y+g.h;g.z=q.z;g.rx+=dt*7;
      if(g.u>=1){g.m=gold?'topan':'off';g.vx=gold?.36:.28;g.vy=0;g.vz=gold?0:-.65}
    }else if(g.m==='off'||g.m==='topan'){
      g.vy-=9.8*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;
      if(gold){const pc=sloc(SFT.panX,0,.08);g.x+=(pc.x+g.cx-g.x)*Math.min(1,dt*5);g.z+=(pc.z+g.cz-g.z)*Math.min(1,dt*6)}
      const floor=gold?sloc(0,0,.081).y:groundAt(g.x,g.z)+.04;
      if(g.y<=floor){g.y=floor;g.m='rest';g.age=0;g.s0=g.s}
    }else if(g.m==='rest'){g.age+=dt;if(!gold&&g.age>1.8)g.fade=clamp(1-(g.age-1.8)/.8,0,1)}
    if(gold)g.fade=g.m==='rest'?1+.13*Math.max(0,Math.sin(t*8+g.w*90)):0;
  };
  for(const g of gfxGr)step(g,false);for(const g of gfxGd)step(g,true);
  for(const g of gfxDust){g.age+=dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;g.s+=dt*.035;g.fade=Math.sin(clamp(g.age/1.4,0,1)*Math.PI);if(g.age>=1.4)g.m='gone'}
  while(gfxDust.length&&gfxDust[0].m==='gone')gfxDust.shift();
  const follow=gfxEase(t,3.6,6.3),finish=gfxEase(t,6.65,8.1);
  GFX.camT.copy(sloc(-.25+.85*follow+.85*finish,-1.45+.2*follow+.52*finish,2.7-.55*follow-1.25*finish));
  GFX.lookT.copy(sloc(-.65+1.30*follow+.72*finish,0,1.74-.73*follow-.93*finish));
}

/* Dip, stratify with alternating shakes, wash over the riffles, re-dip, drain, inspect. */
function gfxPanStart(){
  const R=GFX.root,pan=GFX.pan=new T.Group();pan.scale.setScalar(1.1);pan.add(gfxModel('GoldPan'),gfxModel('GoldFxPanHands'));R.add(pan);
  GFX.panSand=gfxModel('GoldFxSediment');GFX.panBlack=gfxModel('GoldFxBlackSand');GFX.panWater=gfxModel('GoldFxWater',true);
  pan.add(GFX.panSand,GFX.panBlack,GFX.panWater);gfxArms([pan,pan],[[-.282,.052,.078],[.282,.052,.078]]);
  GFX.spill=gfxModel('GoldFxSpill',true);R.add(GFX.spill);
  GFX.ripples=[0,1,2].map(()=>{const g=gfxModel('GoldFxRipple',true);R.add(g);return g});
  const tub=GFX.tub=new T.Vector3(TUB.x,baseH(TUB.x,TUB.z)+TUB.waterY,TUB.z),dx=P.x-TUB.x,dz=P.z-TUB.z,d=Math.hypot(dx,dz)||1;
  GFX.dir={x:dx/d,z:dz/d};GFX.panYaw=Math.atan2(dx,dz);GFX.splash=0;GFX.washSound=0;GFX.dropEmit=0;
  const D=GFX.dir;GFX.camT.set(tub.x+D.x*.67,tub.y+.63,tub.z+D.z*.67);GFX.lookT.copy(tub).add(new T.Vector3(D.x*.10,.12,D.z*.10));
  for(let i=0;i<gfxGoldCount();i++){const a=Math.random()*Math.PI*2,r=.022+Math.random()*.061;gfxGd.push({lx:Math.cos(a)*r,lz:Math.sin(a)*r,s:.0055+Math.random()*.0035,m:'inpan',fade:0,rx:Math.random()*6,ry:Math.random()*6,x:0,y:-50,z:0})}
}
function gfxPanStep(dt){
  const t=GFX.t,pan=GFX.pan,tub=GFX.tub,D=GFX.dir;
  const bring=gfxEase(t,0,.6),dip=gfxEase(t,.6,1.15)-gfxEase(t,1.2,1.85),redip=gfxEase(t,3.5,3.85)-gfxEase(t,3.9,4.4);
  const first=gfxEase(t,1.85,3.5),second=gfxEase(t,4.35,5.55),show=gfxEase(t,5.8,6.4),lower=gfxEase(t,6.8,7);
  const wash=(t>1.85&&t<3.5)||(t>4.35&&t<5.55),w=t*12;
  const shake=wash?Math.sin(w)*.032:0,orbit=wash?Math.cos(w)*.014:0;
  const right={x:D.z,z:-D.x};
  pan.position.set(tub.x+D.x*(.08+.07*bring+.1*show)+right.x*shake+D.x*orbit,tub.y-.36*(1-bring)+.21*bring-.32*dip-.28*redip+.045*show-.14*lower,tub.z+D.z*(.08+.07*bring+.1*show)+right.z*shake+D.z*orbit);
  pan.rotation.order='YXZ';pan.rotation.set((wash?-.22+.10*Math.cos(w):0)-.16*redip+.48*show,GFX.panYaw,wash?.10*Math.sin(w-.4):.025*Math.sin(t*3)*(1-show));
  pan.updateMatrixWorld(true);
  const left=clamp(1-first*.68-second*.32,0,1);
  GFX.panSand.visible=left>.035;GFX.panSand.scale.set(.52+.48*left,Math.max(.035,left),.52+.48*left);GFX.panSand.position.z=-.017*first;
  GFX.panBlack.visible=first>.5;GFX.panBlack.scale.setScalar(.65+.35*second);
  const wet=gfxEase(t,.95,1.25),drain=gfxEase(t,5.4,5.85),water=wet*(1-drain);
  gfxOpacity(GFX.panWater,water*(.72-.27*first-.16*second));
  GFX.panWater.rotation.set(-pan.rotation.x*.25,0,-pan.rotation.z*.25);GFX.panWater.position.y=-.009*first-.006*second;
  const waterRadius=.98-.18*first-.09*second;GFX.panWater.scale.set(waterRadius,1,waterRadius);
  GFX.panWater.position.x=wash?-.012*Math.sin(w-.7):0;GFX.panWater.position.z=wash?-.012+.009*Math.cos(w-.7):0;
  GFX.panWater.traverse(o=>{if(o.isMesh)o.material.color.setHex(second>.6?0x84b9b0:first>.6?0x859b85:0x9c956b)});
  const spill=wash?Math.max(0,Math.cos(w)+.35):t>5.4&&t<5.8?.5:0;
  const lip=new T.Vector3(-.122,.073,-.158).applyMatrix4(pan.matrixWorld),landing=lip.clone().add(new T.Vector3(-D.x*.09-right.x*.04,-.10,-D.z*.09-right.z*.04));landing.y=Math.min(landing.y,tub.y+.004);
  gfxSpan(GFX.spill,lip,landing,.6+.4*spill);gfxOpacity(GFX.spill,Math.min(.55,spill*.55)*water);
  if(spill>.2){
    GFX.dropEmit+=dt*85*spill;
    while(GFX.dropEmit>=1){GFX.dropEmit--;const q=lip.clone().add(new T.Vector3(right.x*(Math.random()-.5)*.10,0,right.z*(Math.random()-.5)*.10));
      if(gfxDrops.length<GFX_DROP)gfxDrops.push({x:q.x,y:q.y,z:q.z,vx:-D.x*.22,vy:-.12,vz:-D.z*.22,s:.003+Math.random()*.004,sy:1.8,m:'drop'});
      if(left>.04&&gfxGr.length<GFX_SAND)gfxGr.push({x:q.x,y:q.y,z:q.z,vx:-D.x*.20,vy:-.05,vz:-D.z*.20,s:.004+Math.random()*.004,m:'spill'})}
    GFX.washSound+=dt;if(GFX.washSound>.3){GFX.washSound=0;noise(.15,950,.6,.045,'bandpass')}
  }
  gfxBallistic(gfxDrops,dt,tub.y-.014);gfxBallistic(gfxGr,dt,tub.y-.014);
  GFX.ripples.forEach((r,i)=>{const phase=((t+i*.3)%1.05)/1.05;r.position.copy(tub);r.position.y+=.018;r.scale.setScalar(.5+phase*1.5);gfxOpacity(r,(1-phase)*.20*wet*(t<5.8?1:0))});
  if(GFX.splash===0&&t>1.02){GFX.splash=1;sfx.splash()}if(GFX.splash===1&&t>3.75){GFX.splash=2;sfx.splash()}
  for(const g of gfxGd){const v=new T.Vector3(g.lx,.022,g.lz).applyMatrix4(pan.matrixWorld);g.x=v.x;g.y=v.y;g.z=v.z;g.fade=gfxEase(t,5.05,5.65)*(1+.16*Math.max(0,Math.sin(t*9+g.lx*90)))}
  GFX.lookT.copy(tub).add(new T.Vector3(D.x*(.10+.14*show),.12+.16*show,D.z*(.10+.14*show)));
  GFX.camT.set(tub.x+D.x*(.67-.06*show),tub.y+.63-.015*show,tub.z+D.z*(.67-.06*show));
}

/* Run after updateCamera; the view and arm endpoints share the same final camera transform. */
function updateGoldFx(dt){
  if(!GFX.on)return;GFX.t+=dt;if(me)me.g.visible=false;
  if(GFX.on==='pan')gfxPanStep(dt);else gfxSiftStep(dt);
  const k=1-Math.exp(-dt*(GFX.t<.8?4:3.2));GFX.cam.lerp(GFX.camT,k);GFX.look.lerp(GFX.lookT,1-Math.exp(-dt*5));
  const duration=GFX.on==='pan'?GFX_PAN_T:GFX_SIFT_T,exit=gfxEase(GFX.t,duration-.4,duration);
  camera.position.copy(GFX.cam).lerp(GFX.homeCam,exit);camera.lookAt(GFX.look.clone().lerp(GFX.homeLook,exit));gfxPoseArms();
  if(vm)vm.visible=false;if(FPH.g)FPH.g.visible=false;gfxDraw();
  if(GFX.t>=(GFX.on==='pan'?GFX_PAN_T:GFX_SIFT_T))gfxEnd();
}
