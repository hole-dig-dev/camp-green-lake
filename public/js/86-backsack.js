'use strict';
/* public/js/86-backsack.js -- the clear backsack (JT 2026-10-01): a clear pack worn on your back, in three comically
   large tiers of BACKSACK_HOLES 5, 10 and 20 holes (45-state.js bucketMax), and the sand inside rises hole by hole, so
   everyone can see how full you are. The HUD meter says "Backsack".
   Models are Blender's (art/blender/backsack.py, gear.blend): public/models/Backsack{1,2,3}.glb + BacksackSand{1,2,3}.glb
   (the sand, full, scaled up from its bottom as it fills).
   p.bk: fill 0..1, or -1 for none; p.bt: the tier. Yours from S; friends' from their pos fields bk, bt (65-net.js,
   relayed by server.js).
   Hung on the 'spine' bone, so it leans with you as you dig. In first person it's on FP_HIDE_LAYER like the rest of
   your body (70-player.js fpBody): it still casts its shadow. */
const BACKSACK={parts:{},sand:{},rest:null};
const BACKSACK_HOLES=[5,10,20];
for(const t of[1,2,3]){modelParts('Backsack'+t).then(p=>{BACKSACK.parts[t]=p}).catch(()=>{});modelParts('BacksackSand'+t).then(p=>{BACKSACK.sand[t]=p}).catch(()=>{})}
const BK_AT=[0,1.06,-0.212];   // in the camper model's own space: its bottom edge, against the back of the torso (CGLCamper_Torso z -0.215)
/* bought, like the buckets (JT 2026-10-02: "purchaseable upgrades for the crew just like players"): pack, pack2, pack3 in
   the store (50-tents.js) and the crew store (sim.js CREW_SHOP), each needs a bucket first. You carry whichever of your
   bucket and pack holds more; a pack that holds as much as the bucket is worn instead of it (hands free). */
const packTier=u=>u&&u.pack3?3:u&&u.pack2?2:u&&u.pack?1:0;
const packHoles=u=>{const t=packTier(u);return t?BACKSACK_HOLES[t-1]:0};
const bucketHolesOf=u=>u.bucket3?SIM.GOLD.buckets[2]:u.bucket2?SIM.GOLD.buckets[1]:u.bucket?SIM.GOLD.buckets[0]:0;
const wearsPack=u=>!!u&&packTier(u)>0&&packHoles(u)>=bucketHolesOf(u);
const backsackOn=()=>wearsPack(S.up);
const myBackTier=()=>packTier(S.up)||1;
/* the D Tent crew the same (30-npcs.js crewBucketMax, crewHands) */
const crewPack=b=>wearsPack(CREW_UP[b.d.n]);
const crewPackTier=b=>packTier(CREW_UP[b.d.n])||1;
function myBackFill(){return backsackOn()&&carrier()==='bucket'?+clamp(S.bucket/Math.max(1e-6,bucketMax()),0,1).toFixed(3):-1}
/* where it sits on the spine bone: the bone's rest pose (MODEL.scene) undone, then BK_AT, turned so the straps face the back */
function backsackRest(){
  if(BACKSACK.rest)return BACKSACK.rest;const s=MODEL.scene,b=s&&s.getObjectByName('spine');if(!b)return null;
  s.updateMatrixWorld(true);const rel=new T.Matrix4().copy(s.matrixWorld).invert().multiply(b.matrixWorld);
  const want=new T.Matrix4().compose(new T.Vector3(...BK_AT),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI),new T.Vector3(1,1,1));
  return BACKSACK.rest=rel.invert().multiply(want);
}
function backsackMesh(p,t){
  if(p.bkObj&&p.bkObj.userData.t===t)return p.bkObj;
  const rest=backsackRest(),bone=p.model.getObjectByName('spine');if(!rest||!bone||!BACKSACK.parts[t]||!BACKSACK.sand[t])return p.bkObj&&(p.bkObj.visible=false),null;
  if(p.bkObj){p.bkObj.parent&&p.bkObj.parent.remove(p.bkObj);p.bkObj=null}   /* a new tier: swap the pack */
  const g=new T.Group(),inner=new T.Group(),sand=new T.Group();g.userData.t=t;g.add(inner);inner.add(sand);
  rest.decompose(g.position,g.quaternion,g.scale);
  inner.scale.setScalar(1/(p.model.scale.x||1));   // real size: the camper model is scaled down as a whole
  for(const pt of BACKSACK.parts[t]){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;m.renderOrder=2;inner.add(m)}   // clear panels draw after the sand
  for(const pt of BACKSACK.sand[t]){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;sand.add(m)}
  bone.add(g);p.bkObj=g;p.bkSand=sand;return g;
}
/* after the mixer (25-people.js animModel): show it, and the sand at its level */
function backsackLook(p){
  if(p===me){p.bk=myBackFill();p.bt=myBackTier()}
  const f=p.bk==null?-1:p.bk;
  if(f<0||!p.model){if(p.bkObj)p.bkObj.visible=false;return}
  const g=backsackMesh(p,clamp(p.bt|0,1,3));if(!g)return;g.visible=true;
  const k=f<0.02?0:Math.max(0.06,f);p.bkSand.visible=k>0;p.bkSand.scale.y=k||1;   // a thin layer at least once there's any
  if(p===me){const L=me.fpOn?FP_HIDE_LAYER:0;g.traverse(o=>o.layers.set(L))}
}
