'use strict';
/* public/js/26-ragdoll.js -- full-body ragdolls for the Blender camper, the way Peak does it: when something knocks you
   around (a twister throw, a tumbleweed fling, a vulture drop, a bonk, a hard fall, a knockout), the animation lets go
   and physics takes the body: arms and legs flop, it tumbles, lands in a heap, and blends back into the animation when
   you get up.
   How: a small Verlet skeleton (13 points: pelvis, chest, head, shoulders, elbows, hands, hip joints, feet) held
   together by distance constraints (a stiff torso box, softer neck and limbs), with gravity and the ground (holes and
   all), then the camper's bones are pointed along it each frame, after the animation mixer (so it overrides the clip).
   The game still decides where YOU are: while a twister or vulture has you, the pelvis is pinned to your position
   (P) and the rest flails around it; lying down, the pin goes soft and the body settles on its own. Friends see it the
   same way: pos flag 512 says "ragdolled", and each viewer runs the flop pinned to where you are.
     ragdollOn(p, {vx,vy,vz, spin, flail})   start (or keep) p's ragdoll, with a kick
     ragdollPin(p, x,y,z, k)                 pull the pelvis toward (x,y,z) this frame: k 1 = locked, 0.05 = a nudge
     ragdollOff(p)                           let go: the body blends back into its animation over RAG_BLEND s
   The rig has no knees or hands, so legs are one piece and hands are the forearm tips. */
const RAG_G=16,RAG_ITER=6,RAG_BLEND=0.5;
const RAG_BONES=['hips','spine','head','armL','forearmL','armR','forearmR','legL','legR'];
const RP={pelvis:0,chest:1,head:2,shL:3,elL:4,hdL:5,shR:6,elR:7,hdR:8,hipL:9,ftL:10,hipR:11,ftR:12};
const _rv=new T.Vector3(),_rv2=new T.Vector3(),_rv3=new T.Vector3(),_rq=new T.Quaternion(),_rq2=new T.Quaternion(),_rm=new T.Matrix4(),_Y=new T.Vector3(0,1,0);
let RAG_REST=null;   // bone name -> rest local quaternion (from the model as loaded)
function ragRest(){if(!RAG_REST&&MODEL.scene){RAG_REST={};for(const n of RAG_BONES){const b=MODEL.scene.getObjectByName(n);if(b)RAG_REST[n]=b.quaternion.clone()}}return RAG_REST}
function ragBones(p){if(!p.ragB){const B={};for(const n of RAG_BONES)B[n]=p.model.getObjectByName(n);p.ragB=B}return p.ragB}
function wpos(o,v){return o.getWorldPosition(v)}
function wdirY(o,len,v){o.getWorldQuaternion(_rq);return v.copy(_Y).applyQuaternion(_rq).multiplyScalar(len)}

/* build the point skeleton from the camper's current pose (so a ragdoll starts from whatever you were doing) */
function ragBuild(p){
  const B=ragBones(p);p.model.updateMatrixWorld(true);
  const pts=[],add=v=>{pts.push({x:v.x,y:v.y,z:v.z,px:v.x,py:v.y,pz:v.z});return pts.length-1};
  const pel=wpos(B.hips,new T.Vector3()),shL=wpos(B['armL'],new T.Vector3()),shR=wpos(B['armR'],new T.Vector3());
  const elL=wpos(B['forearmL'],new T.Vector3()),elR=wpos(B['forearmR'],new T.Vector3());
  const up=shL.distanceTo(elL),chest=shL.clone().add(shR).multiplyScalar(0.5);
  const head=wpos(B.head,new T.Vector3()),headTop=head.clone().add(wdirY(B.head,up*0.9,_rv));
  const hdL=elL.clone().add(wdirY(B['forearmL'],up*0.95,_rv)),hdR=elR.clone().add(wdirY(B['forearmR'],up*0.95,_rv));
  const hipL=wpos(B['legL'],new T.Vector3()),hipR=wpos(B['legR'],new T.Vector3());
  const legLen=Math.max(0.3,hipL.y-p.g.position.y);
  const ftL=hipL.clone().add(wdirY(B['legL'],legLen,_rv)),ftR=hipR.clone().add(wdirY(B['legR'],legLen,_rv));
  for(const v of[pel,chest,headTop,shL,elL,hdL,shR,elR,hdR,hipL,ftL,hipR,ftR])add(v);
  const L=[],link=(a,b,stiff,min)=>{const A=pts[a],Bp=pts[b];L.push([a,b,Math.hypot(A.x-Bp.x,A.y-Bp.y,A.z-Bp.z),stiff==null?1:stiff,min||0])};
  const R=RP;
  // torso: a stiff box
  link(R.pelvis,R.chest);link(R.shL,R.shR);link(R.chest,R.shL);link(R.chest,R.shR);link(R.pelvis,R.shL);link(R.pelvis,R.shR);
  link(R.hipL,R.hipR);link(R.pelvis,R.hipL);link(R.pelvis,R.hipR);link(R.chest,R.hipL);link(R.chest,R.hipR);link(R.shL,R.hipR,0.8);link(R.shR,R.hipL,0.8);
  // neck: stiff-ish, the head can nod a bit
  link(R.chest,R.head);link(R.shL,R.head,0.5);link(R.shR,R.head,0.5);
  // limbs (floppy): upper arm, forearm, legs; "min" keeps an elbow from folding into itself
  link(R.shL,R.elL);link(R.elL,R.hdL);link(R.shR,R.elR);link(R.elR,R.hdR);
  link(R.hipL,R.ftL);link(R.hipR,R.ftR);
  L.push([R.shL,R.hdL,up*1.0,1,1]);L.push([R.shR,R.hdR,up*1.0,1,1]);   // inequality: hand at least this far from the shoulder
  L.push([R.ftL,R.ftR,0.18,1,1]);                                       // feet don't pass through each other
  L.push([R.pelvis,R.ftL,legLen*0.8,1,1]);L.push([R.pelvis,R.ftR,legLen*0.8,1,1]);   // legs don't fold up into the belly
  return{pts,links:L,up,legLen,hipH:pel.y-p.g.position.y,chestH:chest.y-p.g.position.y};
}
function ragdollOn(p,o){
  if(!p||!p.model||!ragRest())return;
  o=o||{};
  if(!p.rag){p.rag=ragBuild(p);p.rag.t=0;p.model.traverse(n=>{if(n.isMesh)n.frustumCulled=false})}
  const r=p.rag;r.on=true;r.flail=o.flail||0;
  if(o.vx||o.vy||o.vz){const dt=1/60;for(const q of r.pts){q.px-=(o.vx||0)*dt;q.py-=(o.vy||0)*dt;q.pz-=(o.vz||0)*dt}}
  if(o.spin){const c=r.pts[RP.chest],dt=1/60;for(const q of r.pts){q.px+=(q.z-c.z)*o.spin*dt;q.pz-=(q.x-c.x)*o.spin*dt}}   // a twist about the vertical
}
function ragdollPin(p,x,y,z,k,at){if(p&&p.rag&&p.rag.on)p.rag.pin={x,y,z,k:k==null?1:k,at}}
function ragdollOff(p){if(!p||!p.rag)return;if(p.rag.on){p.rag.on=false;p.ragBlend=1}}
function ragActive(p){return!!(p&&p.rag&&p.rag.on)}

/* one physics step for p's ragdoll; ground(x,z) gives the floor under a point */
function ragStep(p,dt,ground){
  const r=p.rag,pts=r.pts;dt=Math.min(dt,1/30);r.t+=dt;
  const damp=0.992,g=RAG_G*(1-(r.lift||0))*dt*dt;
  for(const q of pts){const vx=(q.x-q.px)*damp,vy=(q.y-q.py)*damp,vz=(q.z-q.pz)*damp;q.px=q.x;q.py=q.y;q.pz=q.z;q.x+=vx;q.y+=vy-g;q.z+=vz}
  // flailing (Peak's airborne arms): little random shoves on the hands and feet while pinned in the air
  if(r.flail){for(const i of[RP.hdL,RP.hdR,RP.ftL,RP.ftR]){const q=pts[i],s=r.flail*dt*dt*60;q.x+=(Math.random()-0.5)*s;q.y+=(Math.random()-0.3)*s;q.z+=(Math.random()-0.5)*s}}
  for(let it=0;it<RAG_ITER;it++){
    for(const[a,b,len,stiff,min]of r.links){
      const A=pts[a],B=pts[b],dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z,d=Math.hypot(dx,dy,dz)||1e-4;
      if(min&&d>=len)continue;   // an inequality ("at least this far") that's already satisfied
      const k=(d-len)/d*0.5*stiff;A.x+=dx*k;A.y+=dy*k;A.z+=dz*k;B.x-=dx*k;B.y-=dy*k;B.z-=dz*k;
    }
    if(r.pin){const q=pts[r.pin.at==='chest'?RP.chest:RP.pelvis],k=r.pin.k;q.x+=(r.pin.x-q.x)*k;q.y+=(r.pin.y-q.y)*k;q.z+=(r.pin.z-q.z)*k}
    for(const q of pts){const gy=ground(q.x,q.z)+0.06;if(q.y<gy){q.y=gy;q.px+=(q.x-q.px)*0.35;q.pz+=(q.z-q.pz)*0.35;if(q.py<gy)q.py=gy+(q.py-gy)*0.2}}   // floor, with friction
  }
  r.pin=null;
}
/* point the camper's bones along the skeleton (world space, through each parent's current world transform) */
function aimBone(bone,restQ,dir){
  bone.parent.getWorldQuaternion(_rq2);
  const W=_rq.copy(_rq2).multiply(restQ);                 // where the bone points in its rest pose, in the world
  const a=_rv3.copy(_Y).applyQuaternion(W),d=_rv2.copy(dir).normalize();
  const delta=new T.Quaternion().setFromUnitVectors(a,d);
  bone.quaternion.copy(_rq2.invert().multiply(delta.multiply(W)));
}
function ragApply(p){
  const r=p.rag,B=ragBones(p),Rq=ragRest(),P0=r.pts,v=i=>_rv.set(P0[i].x,P0[i].y,P0[i].z);
  // hips: position = pelvis; orientation from the torso box (up = pelvis->chest, right = left->right shoulder)
  const up=new T.Vector3(P0[RP.chest].x-P0[RP.pelvis].x,P0[RP.chest].y-P0[RP.pelvis].y,P0[RP.chest].z-P0[RP.pelvis].z).normalize();
  const right=new T.Vector3(P0[RP.shR].x-P0[RP.shL].x,P0[RP.shR].y-P0[RP.shL].y,P0[RP.shR].z-P0[RP.shL].z);
  right.addScaledVector(up,-right.dot(up)).normalize();const fwd=new T.Vector3().crossVectors(right,up);
  _rm.makeBasis(right,up,fwd);const hq=new T.Quaternion().setFromRotationMatrix(_rm);
  p.g.updateMatrixWorld(true);B.hips.parent.getWorldQuaternion(_rq2);
  B.hips.quaternion.copy(_rq2.invert().multiply(hq)).multiply(Rq.hips);
  B.hips.position.copy(B.hips.parent.worldToLocal(v(RP.pelvis).clone()));
  B.spine.quaternion.copy(Rq.spine);
  p.model.updateMatrixWorld(true);
  const dir=(a,b)=>new T.Vector3(P0[b].x-P0[a].x,P0[b].y-P0[a].y,P0[b].z-P0[a].z);
  aimBone(B.head,Rq.head,dir(RP.chest,RP.head));
  aimBone(B['armL'],Rq['armL'],dir(RP.shL,RP.elL));aimBone(B['armR'],Rq['armR'],dir(RP.shR,RP.elR));
  aimBone(B['legL'],Rq['legL'],dir(RP.hipL,RP.ftL));aimBone(B['legR'],Rq['legR'],dir(RP.hipR,RP.ftR));
  p.model.updateMatrixWorld(true);
  aimBone(B['forearmL'],Rq['forearmL'],dir(RP.elL,RP.hdL));aimBone(B['forearmR'],Rq['forearmR'],dir(RP.elR,RP.hdR));
  // remember the pose, for blending back into the animation
  p.ragQ=p.ragQ||{};for(const n of RAG_BONES){(p.ragQ[n]=p.ragQ[n]||new T.Quaternion()).copy(B[n].quaternion)}
  p.ragHipP=(p.ragHipP||new T.Vector3()).copy(B.hips.position);
}
/* after the mixer, every frame: run the ragdoll, or blend out of it */
function ragAfterMixer(p,dt,ground){
  if(!p.model)return;
  if(p.rag&&p.rag.on){ragStep(p,dt,ground||groundAt);ragApply(p);return}
  if(p.ragBlend>0&&p.ragQ){
    p.ragBlend=Math.max(0,p.ragBlend-dt/RAG_BLEND);const B=ragBones(p),k=sm(p.ragBlend);
    for(const n of RAG_BONES)B[n].quaternion.slerp(p.ragQ[n],k);
    B.hips.position.lerp(p.ragHipP,k);
    if(p.ragBlend<=0){p.rag=null;p.model.traverse(n=>{if(n.isMesh)n.frustumCulled=true})}
  }
}
/* the pelvis world position (for the camera and for letting P follow a settled body) */
function ragPelvis(p){return p&&p.rag?p.rag.pts[RP.pelvis]:null}
function ragHead(p){return p&&p.rag?p.rag.pts[RP.head]:null}

/* ---------- who's ragdolled, every frame (90-loop.js, after the player and the remotes have moved) ---------- */
/* Me: the state machines that throw you around (twisters, tumbleweeds, vultures), bonks, hard falls and knockouts decide
   WHERE you are (P); the ragdoll decides how your body looks getting there. S.ragT: a short knock (bonk, hard fall). */
function myRagState(){
  if(S.ko){const held=typeof bodyHeld==='function'&&bodyHeld();return{on:true,pin:held?0.35:0.03,lift:held?0.55:0,flail:0}}
  if(twSt===1)return{on:true,pin:0.5,lift:1.15,flail:1.4};              // sucked up the funnel: flailing in the wind
  if(twSt===2)return{on:true,pin:0.12,lift:0,flail:1.0};                // thrown: tumbling through the air
  if(twSt===3)return{on:true,pin:0.03,lift:0,flail:0};                  // down: a heap on the ground
  if(tbSt===2)return{on:true,pin:0.12,lift:0,flail:1.0};
  if(tbSt===3)return{on:true,pin:0.03,lift:0,flail:0};
  if(vSt===3||vSt===4)return{on:true,pin:0.6,lift:0.9,flail:1.2,at:'chest'};   // carried off by the shoulders
  if(vSt===5)return{on:true,pin:0.12,lift:0,flail:1.0};
  if(vSt===6)return{on:true,pin:0.03,lift:0,flail:0};
  if(S.ragT>0)return{on:true,pin:0.03,lift:0,flail:0};
  return null;
}
function ragGroundMe(x,z){return S.inTown?SIM.TOWN.Y:inTent()?TENT_FLOOR_Y:groundAt(x,z)}
/* a short knock: a bonk, a hard landing. v: the kick */
function ragKnock(secs,vx,vy,vz){
  if(!me||!me.model||S.ko||GOD&&false)return;
  S.ragT=Math.max(S.ragT||0,secs);ragdollOn(me,{vx,vy,vz});
}
function updateRagdolls(dt){
  if(me&&me.model){
    const st=S.started?myRagState():null;
    if(S.ragT>0)S.ragT-=dt;
    if(st){
      {const q=ragPelvis(me);if(q&&Math.hypot(q.x-P.x,q.z-P.z)>4){me.rag=null;me.ragBlend=0}}   // you were moved (respawn, teleport, the town): start the body fresh where you are
      if(!ragActive(me))ragdollOn(me,{vx:P.kx||0,vy:P.vy||0,vz:P.kz||0});
      const r=me.rag,at=st.at==='chest';r.lift=st.lift;r.flail=st.flail;
      ragdollPin(me,P.x,P.y+(at?r.chestH:r.hipH),P.z,st.pin,st.at);
      me.g.rotation.set(0,me.g.rotation.y,0);
      ragAfterMixer(me,dt,ragGroundMe);
      // lying there: you get up where your body ended up, not where the throw said
      if(st.pin<0.05&&!S.ko){const q=ragPelvis(me);P.x+=(q.x-P.x)*Math.min(1,dt*3);P.z+=(q.z-P.z)*Math.min(1,dt*3);me.g.position.set(P.x,P.y,P.z)}
      // first person: the camera rides the head, like Peak
      if(FP){const h=ragHead(me);camera.position.set(h.x,h.y+0.05,h.z)}
    }else{
      if(ragActive(me))ragdollOff(me);
      if(me.ragBlend>0)me.g.rotation.set(0,me.g.rotation.y,0);
      ragAfterMixer(me,dt,ragGroundMe);
    }
    me.ragOn=!!st;
  }
  // friends: pos flag 512 = ragdolled (1024 = airborne), 2 = downed. Each of us runs the flop pinned to where they are.
  for(const R of remotes.values()){
    const p=R.p;if(!p.model)continue;
    const want=(R.f&512)||(R.f&2);
    if(want){
      {const q=ragPelvis(p),g0=p.g.position;if(q&&Math.hypot(q.x-g0.x,q.z-g0.z)>4){p.rag=null;p.ragBlend=0}}
      if(!ragActive(p)){ragdollOn(p,{vx:(R.tx-(R.rx0??R.tx))/Math.max(dt,0.016),vy:0,vz:(R.tz-(R.rz0??R.tz))/Math.max(dt,0.016)})}
      const r=p.rag,gp=p.g.position,sp=Math.hypot(gp.x-(R.rgx??gp.x),gp.z-(R.rgz??gp.z))/Math.max(dt,0.016);
      r.flail=(R.f&1024)?1:0;r.lift=0;
      ragdollPin(p,gp.x,gp.y+r.hipH,gp.z,(R.f&1024)?0.15:sp>0.6?0.3:0.03);
      p.g.rotation.set(0,p.g.rotation.y,0);
      const under=gp.y<groundAt(gp.x,gp.z)-1.5;
      ragAfterMixer(p,dt,under?(()=>gp.y):groundAt);
    }else{if(ragActive(p))ragdollOff(p);if(p.ragBlend>0)p.g.rotation.set(0,p.g.rotation.y,0);ragAfterMixer(p,dt)}
    R.rgx=p.g.position.x;R.rgz=p.g.position.z;
  }
}
