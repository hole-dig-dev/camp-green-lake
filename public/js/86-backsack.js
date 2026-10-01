'use strict';
/* public/js/86-backsack.js -- the clear backsack (JT 2026-10-01): a possible later stand-in for the bucket, behind the F2
   flag gear.backsack (Gear tab, off by default; the bucket is untouched). With it on, the bucket you bought is worn as
   a clear pack on your back instead: same capacity (bucketMax: full after 5 holes for the first one), and the sand
   inside rises hole by hole, so everyone can see how full you are. The HUD meter says "Backsack".
   Models are Blender's (art/blender/backsack.py, gear.blend): public/models/Backsack.glb + BacksackSand.glb (the sand,
   full, scaled up from its bottom as it fills).
   p.bk: fill 0..1, or -1 for none. Yours from S.bucket; friends' from their pos field bk (65-net.js, relayed by server.js).
   Hung on the 'spine' bone, so it leans with you as you dig. In first person it's on FP_HIDE_LAYER like the rest of
   your body (70-player.js fpBody): it still casts its shadow. */
const BACKSACK={parts:null,sand:null,H:0.46,rest:null};
modelParts('Backsack').then(p=>{BACKSACK.parts=p}).catch(()=>{});
modelParts('BacksackSand').then(p=>{BACKSACK.sand=p}).catch(()=>{});
const BK_AT=[0,1.06,-0.212];   // in the camper model's own space: its bottom edge, against the back of the torso (CGLCamper_Torso z -0.215)
const backsackOn=()=>tune('gear.backsack')>=0.5;
function myBackFill(){return backsackOn()&&carrier()==='bucket'?+clamp(S.bucket/Math.max(1e-6,bucketMax()),0,1).toFixed(3):-1}
/* where it sits on the spine bone: the bone's rest pose (MODEL.scene) undone, then BK_AT, turned so the straps face the back */
function backsackRest(){
  if(BACKSACK.rest)return BACKSACK.rest;const s=MODEL.scene,b=s&&s.getObjectByName('spine');if(!b)return null;
  s.updateMatrixWorld(true);const rel=new T.Matrix4().copy(s.matrixWorld).invert().multiply(b.matrixWorld);
  const want=new T.Matrix4().compose(new T.Vector3(...BK_AT),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI),new T.Vector3(1,1,1));
  return BACKSACK.rest=rel.invert().multiply(want);
}
function backsackMesh(p){
  if(p.bkObj)return p.bkObj;
  const rest=backsackRest(),bone=p.model.getObjectByName('spine');if(!rest||!bone||!BACKSACK.parts||!BACKSACK.sand)return null;
  const g=new T.Group(),inner=new T.Group(),sand=new T.Group();g.add(inner);inner.add(sand);
  rest.decompose(g.position,g.quaternion,g.scale);
  inner.scale.setScalar(1/(p.model.scale.x||1));   // real size: the camper model is scaled down as a whole
  for(const pt of BACKSACK.parts){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;m.renderOrder=2;inner.add(m)}   // clear panels draw after the sand
  for(const pt of BACKSACK.sand){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;sand.add(m)}
  bone.add(g);p.bkObj=g;p.bkSand=sand;return g;
}
/* after the mixer (25-people.js animModel): show it, and the sand at its level */
function backsackLook(p){
  if(p===me)p.bk=myBackFill();
  const f=p.bk==null?-1:p.bk;
  if(f<0||!p.model){if(p.bkObj)p.bkObj.visible=false;return}
  const g=backsackMesh(p);if(!g)return;g.visible=true;
  const k=f<0.02?0:Math.max(0.06,f);p.bkSand.visible=k>0;p.bkSand.scale.y=k||1;   // a thin layer at least once there's any
  if(p===me){const L=me.fpOn?FP_HIDE_LAYER:0;g.traverse(o=>o.layers.set(L))}
}
