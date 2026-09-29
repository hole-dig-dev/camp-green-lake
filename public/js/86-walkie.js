'use strict';
/* public/js/86-walkie.js -- things in your hand, that everyone can see: the walkie-talkie held up to your mouth while you
   talk into it, and Sam's onion tonic or the first-aid kit for a moment when you use one.
   Models are Blender assets (art/blender/supplies.py): public/models/Supply{Walkie,Tonic,Medkit}.glb. Poses are the
   camper's own clips (blender/cgl_rig.py): Radio for the walkie, Drink for the tonic. Only their left arm and head are
   laid over whatever the body is doing, so you can walk and talk. The first-aid kit just hangs from the hand by its
   handle.
   Talking = holding P (push-to-talk), speaking (open mic), or just sent a chat message, with a walkie-talkie bought.
   Friends see it: pos flag 2048 = talking on the walkie (65-net.js); a tonic or kit is an emote ('tonic'/'medkit'). */
const HELD_MODEL={walkie:'SupplyWalkie',tonic:'SupplyTonic',medkit:'SupplyMedkit'};
const HELD_GRIP={walkie:0.059,tonic:0.055,medkit:0.155};   // grip height above each model's origin (supplies.py GRIP)
const HELD_SIZE={walkie:1.7,tonic:1.6,medkit:1.3};        // × real size: the camper's chunky hands (~10 cm across) would swallow a life-size radio
const HELD_POSE={walkie:'Radio',tonic:'Drink'};           // the clip whose left arm + head go over the body's clip
const HELD_BONES=['armL','forearmL','head'];
const HOLD_SECS={tonic:1.7,medkit:1.5};
const WALKIE_CHAT_SECS=2.5;   // a typed message: the walkie comes up for this long
const HELD_BLEND=0.22;        // seconds to raise / lower the arm
const HELD_PARTS={};          // key -> [{geometry,material}] once its model is in
for(const k in HELD_MODEL)modelParts(HELD_MODEL[k]).then(parts=>{HELD_PARTS[k]=parts}).catch(()=>{});

/* ---- the pose: sample a clip's left arm + head (cached interpolants per clip) ---- */
const heldInterp={};
function heldPoseAt(clipName,t){
  let I=heldInterp[clipName];
  if(!I){const c=MODEL.clips&&MODEL.clips.find(c=>c.name===clipName);if(!c)return null;
    I=heldInterp[clipName]={dur:c.duration,b:{}};
    for(const tr of c.tracks){const[bn,prop]=tr.name.split('.');if(prop==='quaternion'&&HELD_BONES.includes(bn))I.b[bn]=tr.createInterpolant()}}
  const out={};for(const bn in I.b){const v=I.b[bn].evaluate(Math.min(t,I.dur-1e-4));out[bn]=_heldQ(bn).fromArray(v)}
  return{q:out,dur:I.dur};
}
const _heldQs={};const _heldQ=bn=>_heldQs[bn]||(_heldQs[bn]=new T.Quaternion());

/* ---- holding something: p.held = {k, t (seconds left; Infinity while talking)}, p.heldW the arm's blend ---- */
function holdProp(p,k,secs){
  if(!p||!p.model)return;
  if(p.held&&p.held.k!==k)dropHeldMesh(p);
  p.held={k,t:secs==null?Infinity:secs,age:0};
}
function releaseProp(p,k){if(p&&p.held&&(!k||p.held.k===k))p.held.t=0}
function dropHeldMesh(p){if(p.heldMeshObj){p.heldMeshObj.parent&&p.heldMeshObj.parent.remove(p.heldMeshObj);p.heldMeshObj=null}}
function heldMesh(p,k){
  if(p.heldMeshObj&&p.heldMeshObj.userData.k===k)return p.heldMeshObj;
  dropHeldMesh(p);const parts=HELD_PARTS[k],hand=p.model.getObjectByName('CGLCamper_L_Hand');if(!parts||!hand)return null;
  // the hand is a rigid piece on forearm.L, turned 180° so its fingers run down its own -y from the wrist (0) to 0.18
  const g=new T.Group(),inner=new T.Group();g.userData.k=k;g.add(inner);
  for(const pt of parts){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;inner.add(m)}
  inner.position.y=-HELD_GRIP[k];                                  // grip point on the palm
  const ws=new T.Vector3();hand.getWorldScale(ws);g.scale.setScalar(HELD_SIZE[k]/ws.x);
  g.position.set(0,-0.1,0);                                        // in the fist (turned each frame by heldAim)
  hand.add(g);p.heldMeshObj=g;g.userData.hand=hand;return g;
}
/* turn the prop in the fist by where things are in the world, whatever the arm is doing: the walkie upright with its
   grille to the mouth, the tonic's neck tipped to the lips, the first-aid kit hanging by its handle, lid forward */
const _hY=new T.Vector3(),_hZ=new T.Vector3(),_hX=new T.Vector3(),_hH=new T.Vector3(),_hP=new T.Vector3(),_hM=new T.Matrix4(),_hQ=new T.Quaternion(),_hQ2=new T.Quaternion();
function heldAim(p,g,k){
  const hand=g.userData.hand,head=p.heldBones&&p.heldBones.head;hand.updateWorldMatrix(true,false);
  hand.getWorldPosition(_hP);if(head)head.getWorldPosition(_hH).y+=0.25;else _hH.copy(_hP).y+=0.3;
  const yaw=p.g.rotation.y;_hZ.set(Math.sin(yaw),0,Math.cos(yaw));   // the camper's forward
  if(k==='walkie'){_hY.set(0,1,0);_hZ.subVectors(_hH,_hP).setY(0);if(_hZ.lengthSq()<1e-6)_hZ.set(Math.sin(yaw),0,Math.cos(yaw))}
  else if(k==='tonic'){_hY.subVectors(_hH,_hP).normalize().multiplyScalar(1.2).add(new T.Vector3(0,0.6,0));}
  else _hY.set(0,1,0);
  _hY.normalize();_hZ.addScaledVector(_hY,-_hZ.dot(_hY)).normalize();_hX.crossVectors(_hY,_hZ);
  _hQ.setFromRotationMatrix(_hM.makeBasis(_hX,_hY,_hZ));
  g.quaternion.copy(hand.getWorldQuaternion(_hQ2).invert().multiply(_hQ));
}
/* after the mixer (25-people.js animModel): raise the arm into the clip's pose and show the prop */
function heldPose(p,dt){
  const h=p.held,on=!!(h&&h.t>0);
  p.heldW=clamp((p.heldW||0)+(on?dt:-dt)/HELD_BLEND,0,1);
  if(h){h.age+=dt;if(h.t!==Infinity)h.t-=dt}
  if(!on&&p.heldW<=0){p.held=null;dropHeldMesh(p);return}
  const k=(h||{}).k||(p.heldMeshObj&&p.heldMeshObj.userData.k);if(!k)return;
  const clip=HELD_POSE[k];
  if(clip&&p.model){
    const I=heldInterp[clip]||heldPoseAt(clip,0),t=k==='walkie'?(h?h.age:0)%(I?I.dur:1):clamp((h?h.age:HOLD_SECS[k])/HOLD_SECS[k],0,1)*(I?I.dur*0.8:1);
    const P2=heldPoseAt(clip,t);
    if(P2){const B=p.heldBones||(p.heldBones=Object.fromEntries(HELD_BONES.map(n=>[n,p.model.getObjectByName(n)])));const w=sm(p.heldW);
      for(const bn in P2.q)if(B[bn])B[bn].quaternion.slerp(P2.q[bn],w)}
  }
  const m=heldMesh(p,k);if(m){m.visible=p.heldW>(clip?0.45:0.05);if(m.visible)heldAim(p,m,k)}   // in hand once the arm is most of the way up
}

/* ---- mine: the walkie while talking; friends: from their pos flag ---- */
let walkieChatT=0;
function walkieChatSent(){if(S.up&&S.up.walkie)walkieChatT=WALKIE_CHAT_SECS}
function walkieTalking(){
  if(!S.started||!S.up||!S.up.walkie||S.ko||(me&&me.ragOn))return false;
  return walkieChatT>0||!!(VOX.enabled&&VOX.tx&&(VOX.mode==='ptt'||VOX.selfSpeaking));
}
function updateWalkie(dt){
  if(walkieChatT>0)walkieChatT-=dt;
  if(me&&me.model){const talk=walkieTalking();
    if(talk&&!(me.held&&me.held.k==='walkie'&&me.held.t>0)&&!(me.held&&me.held.k!=='walkie'&&me.held.t>0))holdProp(me,'walkie');
    else if(!talk)releaseProp(me,'walkie')}
  for(const R of remotes.values()){const p=R.p;if(!p.model)continue;const talk=!!(R.f&2048)&&!(R.f&(2|512));
    if(talk&&!(p.held&&p.held.t>0))holdProp(p,'walkie');else if(!talk)releaseProp(p,'walkie')}
}
/* a tonic or first-aid kit: in your hand for a moment, and friends see it too */
function showSupply(k){holdProp(me,k,HOLD_SECS[k]);wsSend({t:'emote',k})}
