'use strict';
/* public/js/88-mines.js -- landmines (JT 2026-10-01: "randomly spawning landmines that are hard to see unless you're
   really close, that throw you comically far (and NPCs)").
   The server drops one now and then (server.js mineTick: every ~haz.mineEvery seconds, up to haz.mineMax at once) on the
   lakebed outside the fence, somewhere 8-45 m from a camper who's out there, so they turn up where people dig. Same
   mines for everyone. You only see one when you're within haz.mineSee metres (it fades in from twice that), and even
   then it's a dusty lid in the sand (art/blender/landmine.py: Landmine.glb).
   Step on one: you report it ('mineHit'), the server takes it out and tells everyone ('mineBoom'), and everyone inside
   the blast (haz.mineBlast m, you and anyone near you, and the D Tent crew) goes flying: the twister's tumble
   (72-twisters.js twSt 2 -> 3 -> 4), only much, much further. No extra damage; landing is landing.
   The crew sets them off too: the client that runs the crew's bank (30-npcs.js crewPaysHere) reports their steps.
   Dig into one (the ground under it drops) and it goes off just the same. Never spawned in a hole.
   Offline (no server), this file spawns them itself. Off with the F2 flag haz.mines (Environment tab). */
const MINES=new Map();   // id -> {id,x,z,obj}
let MINE_PARTS=null;modelParts('Landmine').then(p=>{MINE_PARTS=p;for(const m of MINES.values())mineMesh(m)}).catch(()=>{});
let mineSent=0,mineLocalT=20,mineLocalSeq=1;
const minesOn=()=>tune('haz.mines')>=0.5&&hazOn('mines');
function mineMesh(m){
  if(m.obj||!MINE_PARTS)return;const g=new T.Group();
  for(const pt of MINE_PARTS){const mat=pt.material.clone();mat.transparent=true;mat.opacity=0;mat.depthWrite=false;const mm=new T.Mesh(pt.geometry,mat);mm.receiveShadow=true;g.add(mm)}
  g.position.set(m.x,groundAt(m.x,m.z),m.z);g.rotation.y=(m.id*2.39)%6.28;g.visible=false;scene.add(g);m.obj=g;
}
function mineAdd(d){if(!d||MINES.has(d.id))return;const m={id:d.id,x:+d.x,z:+d.z,obj:null};MINES.set(m.id,m);mineMesh(m)}
function mineDrop(id){const m=MINES.get(id);if(!m)return;if(m.obj)scene.remove(m.obj);MINES.delete(id)}
function minesSet(list){for(const id of[...MINES.keys()])mineDrop(id);for(const d of list||[])mineAdd(d)}
/* KABOOM: the fx for everyone, and a launch for whoever's inside the blast */
function mineBoom(id,x,z,by){
  mineDrop(id);const y=groundAt(x,z),near=Math.hypot(P.x-x,P.z-z);
  for(let k=0;k<4;k++)puff(x,y+0.2,z,x+(Math.random()-0.5)*0.4,z+(Math.random()-0.5)*0.4,14);
  if(nearCam(x,z,90)){mineBoomSfx(clamp(1-near/90,0.15,1));if(near<25)hurtFx=Math.max(hurtFx,0.6*(1-near/25))}
  logEv('mineBoom',{x:+x.toFixed(1),z:+z.toFixed(1),by:by||''});
  const R=tune('haz.mineBlast'),L=tune('haz.mineLaunch');pipeBlast(x,z,R);   /* cracks the sand pipeline (88-pipeline.js) */
  blastLaunch(x,z,R,L,'mn',by===S.name?'BOOM! You stepped on a landmine.':`BOOM! ${by||'Someone'} set off a landmine right next to you.`);
}
/* everyone inside a blast flies: you (the twister's tumble, 72-twisters.js) and the D Tent crew (crewToss). k: the
   centre throws full, the edge half. Shared by landmines and dynamite (88-dynamite.js). */
function blastLaunch(x,z,R,L,why,msg){
  const near=Math.hypot(P.x-x,P.z-z);
  if(S.started&&!S.ko&&!twSt&&!inTent()&&!S.inTown&&near<R){
    let dx=P.x-x,dz=P.z-z,l=Math.hypot(dx,dz);if(l<0.15){const a=Math.random()*Math.PI*2;dx=Math.cos(a);dz=Math.sin(a);l=1}
    const k=1-0.5*near/R;   // dead centre: the full throw; the edge of the blast: half
    P.kx=dx/l*16*L*k;P.kz=dz/l*16*L*k;P.vy=20*Math.min(2,L)*k;P.grounded=false;digHeld=false;
    twRagX=(Math.random()*2-1)*12;twRagY=(Math.random()*2-1)*9;twRagZ=(Math.random()*2-1)*11;twSt=2;twStT=0;
    if(msg)toast(msg,'',3200);
  }
  for(const b of bots){if(!b.p.g.visible)continue;const g=b.p.g.position,d=Math.hypot(g.x-x,g.z-z);if(d>=R)continue;
    let dx=g.x-x,dz=g.z-z,l=Math.hypot(dx,dz);if(l<0.15){const a=Math.random()*Math.PI*2;dx=Math.cos(a);dz=Math.sin(a);l=1}
    const k=1-0.5*d/R;crewToss(b,dx/l*16*L*k,20*Math.min(2,L)*k,dz/l*16*L*k,why)}
}
function mineBoomSfx(v){
  noise(1.4,260,0.6,0.9*v);tone(55,0.9,'sine',0.7*v,22);
  setTimeout(()=>noise(0.9,900,0.8,0.25*v),120);   // the sand coming back down
}
function mineHit(m,crew){
  const now=performance.now();if(now-mineSent<400)return;mineSent=now;
  if(online())wsSend({t:'mineHit',id:m.id,crew:crew||undefined});else mineBoom(m.id,m.x,m.z,crew||S.name);
}
function updateMines(dt){
  if(!minesOn()){if(MINES.size&&!online())minesSet([]);for(const m of MINES.values())if(m.obj)m.obj.visible=false;return}
  if(!online())mineLocalSpawn(dt);
  const see=tune('haz.mineSee');
  for(const m of MINES.values()){
    const d=Math.hypot(P.x-m.x,P.z-m.z);
    if(m.obj){const o=clamp((2*see-d)/see,0,1);m.obj.position.y=groundAt(m.x,m.z);m.obj.visible=o>0.01&&!S.inTown;if(m.obj.visible)for(const c of m.obj.children)c.material.opacity=o}
    // you: on your feet, on the surface (not down a hole next to it), not already flying
    if(S.started&&!S.ko&&!twSt&&!inTent()&&!S.inTown&&d<0.55&&Math.abs(P.y-groundAt(m.x,m.z))<0.35)mineHit(m);
    else if(m.obj&&m.y0!=null&&m.y0-m.obj.position.y>0.06&&d<3)mineHit(m);   /* someone dug into it: that sets it off too */
    if(m.obj&&m.y0==null)m.y0=m.obj.position.y;
  }
  if(crewPaysHere())for(const b of bots){if(!b.p.g.visible||!OUTDOOR.has(b.state))continue;const g=b.p.g.position;
    for(const m of MINES.values())if(Math.hypot(g.x-m.x,g.z-m.z)<0.55){mineHit(m,b.d.n);break}}
}
/* offline only: the same rules as server.js mineTick */
function mineLocalSpawn(dt){
  mineLocalT-=dt;if(mineLocalT>0)return;mineLocalT=tune('haz.mineEvery')*(0.6+Math.random()*0.8);
  if(MINES.size>=tune('haz.mineMax')||SIM.inCamp(P.x,P.z))return;
  for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2,d=8+Math.random()*37,x=P.x+Math.cos(a)*d,z=P.z+Math.sin(a)*d;
    if(Math.abs(x)>HALF-10||Math.abs(z)>HALF-10||SIM.inCamp(x,z)||SIM.nearCampZone(x,z))continue;mineAdd({id:mineLocalSeq++,x,z});return}
}
