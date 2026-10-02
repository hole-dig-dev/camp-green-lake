'use strict';
/* public/js/88-dynamite.js -- dynamite (JT 2026-10-01): "the sand gets blown loose, and anyone who walks by auto-fills
   their bucket / pack". Buy sticks at the Supply Depot (S.dynamite); Y (remappable: 'dynamite') lights one and tosses
   it ~4 m ahead (never inside the camp or its no-dig strip). The server runs the fuse (3 s) so everyone sees the same
   thing, then ('dynBoom'): a crater (holes, server-side), everyone within dyn.blast m flies (blastLaunch, 88-mines.js,
   the crew too), the pipeline cracks if it's close, and landmines nearby go off with it. It leaves a mound of LOOSE
   SAND (server world.piles: {x,z,sand}): walk into it and your bucket / backsack / pan fills by itself (fillBucket),
   as fast as dyn.scoop holes a second, until the mound's gone. The crew top up from it too (crewPaysHere client).
   Models (art/blender, Sol): Dynamite (on the ground, fizzing), LooseSand (scaled down in Y as it's scooped). */
const DYN={fuses:new Map(),piles:new Map(),parts:{},take:new Map(),sendT:0,localId:1};
function dynLoad(){if(DYN.loading)return;DYN.loading=1;for(const n of['Dynamite','LooseSand'])modelParts(n).then(p=>{DYN.parts[n]=p;for(const f of DYN.fuses.values())dynMesh(f,'Dynamite');for(const q of DYN.piles.values())dynMesh(q,'LooseSand')}).catch(()=>{})}   /* on first use */
const DYN_SAND=8,DYN_PILE_R=1.9;
function dynMesh(o,n){dynLoad();if(o.obj||!DYN.parts[n])return;const g=new T.Group();for(const pt of DYN.parts[n]){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;m.receiveShadow=true;g.add(m)}
  g.position.set(o.x,groundAt(o.x,o.z),o.z);g.rotation.y=(o.id*1.7)%6.28;scene.add(g);o.obj=g;if(n==='LooseSand')dynPileLook(o)}
function dynPileLook(q){if(q.obj){q.obj.scale.y=Math.max(0.2,q.sand/DYN_SAND);q.obj.position.y=groundAt(q.x,q.z)}}
/* Y: light one and toss it */
function throwDynamite(){
  if(!S.started||S.ko||twSt||inTent()||S.inTown||uiOpen())return;
  if(!(S.dynamite>0)){toast('No dynamite. The Supply Depot sells it.','',2500);return}
  const fx=Math.sin(P.fa),fz=Math.cos(P.fa),x=P.x+fx*4,z=P.z+fz*4;
  if(inCamp(x,z)||nearCampNoDig(x,z)||inCamp(P.x,P.z)){toast('Not in camp! Out on the lake bed, past the white line.','bad',2600);return}
  S.dynamite--;sfx.hiss();showSupply('dynamite');   /* in your hand for a moment (86-walkie.js) */logEv('dynThrow',{x:+x.toFixed(1),z:+z.toFixed(1)});
  if(online())wsSend({t:'dyn',x:+x.toFixed(2),z:+z.toFixed(2)});else{const id=DYN.localId++;dynLit({id,x,z,by:S.name});setTimeout(()=>dynBoom({id,x,z,pile:{id,x,z,sand:DYN_SAND,rich:inVein(x,z)}}),tune('dyn.fuse')*1000)}
  toast('Fire in the hole!','',1800);
}
function dynLit(m){const f={id:m.id,x:+m.x,z:+m.z,t:0,obj:null,by:m.by};DYN.fuses.set(f.id,f);dynMesh(f,'Dynamite')}
function dynBoom(m){
  const f=DYN.fuses.get(m.id);if(f){if(f.obj)scene.remove(f.obj);DYN.fuses.delete(m.id);veinDynamite(f)}
  const x=+m.x,z=+m.z,y=groundAt(x,z),near=Math.hypot(P.x-x,P.z-z);
  for(let k=0;k<6;k++)puff(x,y+0.2,z,x+(Math.random()-0.5)*0.6,z+(Math.random()-0.5)*0.6,16);
  if(nearCam(x,z,120)){mineBoomSfx(clamp(1.2-near/120,0.2,1));if(near<30)hurtFx=Math.max(hurtFx,0.7*(1-near/30))}
  const R=tune('dyn.blast');pipeBlast(x,z,R*0.7,'dynamite');
  blastLaunch(x,z,R,tune('haz.mineLaunch')*0.85,'dy',near<R?'BOOM! Dynamite.':null);
  if(!online()){applyDig(x,z,1.3,true);for(const[ox,oz]of[[1,0],[-1,0],[0,1],[0,-1]])applyDig(x+ox*0.9,z+oz*0.9,0.9,true)}
  if(m.pile)pileSet(m.pile);
  logEv('dynBoom',{x:+x.toFixed(1),z:+z.toFixed(1)});
}
/* the loose sand */
function pileSet(d){if(!d)return;let q=DYN.piles.get(d.id);if(!(d.sand>0.01)){if(q){if(q.obj)scene.remove(q.obj);DYN.piles.delete(d.id)}return}
  if(!q){q={id:d.id,x:+d.x,z:+d.z,sand:+d.sand,obj:null,rich:d.rich===true};DYN.piles.set(q.id,q);dynMesh(q,'LooseSand')}else{q.sand=+d.sand;dynPileLook(q)}}
function pilesSet(list){for(const q of DYN.piles.values())if(q.obj)scene.remove(q.obj);DYN.piles.clear();for(const d of list||[])pileSet(d)}
function pileTake(q,v,who){
  q.sand=Math.max(0,q.sand-v);dynPileLook(q);DYN.take.set(q.id,(DYN.take.get(q.id)||0)+v);
  if(q.sand<=0.01&&!online()){if(q.obj)scene.remove(q.obj);DYN.piles.delete(q.id)}
}
function updateDynamite(dt){
  for(const f of DYN.fuses.values()){f.t+=dt;if(f.obj&&nearCam(f.x,f.z,60)&&Math.random()<dt*14)puff(f.x,groundAt(f.x,f.z)+0.3,f.z,f.x,f.z,1)}   // the fuse fizzing
  if(!S.started)return;
  const rate=tune('dyn.scoop')*dt;
  for(const q of DYN.piles.values()){
    if(q.sand<=0.01)continue;
    /* you: walk into it with room in your bucket / pack / pan */
    if(!S.ko&&!twSt&&carrier()&&Math.hypot(P.x-q.x,P.z-q.z)<DYN_PILE_R&&S.bucket<bucketMax()-1e-3){
      const v=Math.min(rate,q.sand,bucketMax()-S.bucket);if(!q.told){q.told=true;toast('Loose sand! It pours straight into your '+(carrier()==='pan'?'pan':backsackOn()?'backsack':'bucket')+'.','good',2200)}
      fillBucket(v*FIVE_FT);pileTake(q,v);if(q.rich)veinPay(v);if(Math.random()<dt*6)sfx.scoop()}
    /* the crew (one client runs them) */
    if(crewPaysHere())for(const b of bots){if(!b.p.g.visible||!OUTDOOR.has(b.state)||!crewHired(b))continue;const g=b.p.g.position;if(Math.hypot(g.x-q.x,g.z-q.z)>DYN_PILE_R)continue;
      const mx=crewBucketMax(b),v=Math.min(rate,q.sand,mx-(b.bucket||0));if(v>1e-4){b.bucket=(b.bucket||0)+v;pileTake(q,v)}}
  }
  DYN.sendT-=dt;if(DYN.sendT<=0&&DYN.take.size){DYN.sendT=0.25;if(online())for(const[id,v]of DYN.take)wsSend({t:'pileTake',id,v:+v.toFixed(3)});DYN.take.clear()}
}
