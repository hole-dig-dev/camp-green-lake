'use strict';
/* public/js/71-fp-scoop.js -- first-person digging with Sol's ScoopFP (models/camper-fp.glb, blender/cgl_scoopfp.py).
   JT 2026-10-12: from your own eyes the body's Scoop mostly showed the shovel flicking in from the side. ScoopFP is the
   same plant / lever / lift / toss, but sleeves, hands and shovel posed for the camera (origin = the eye, -Z forward),
   so it parents straight to the camera. It shows only while you dig in first person; the body's own hands and
   shovel go to FP_HIDE_LAYER meanwhile (their shadow stays). Clip time = scoopTime(P.digPh) (25-people.js), so the
   toss lines up with the dirt flying, the same as everyone else sees. */
const FPS={g:null,mixer:null,act:null,on:false};
(function(){
  if(!T.GLTFLoader||!/^https?:$/.test(location.protocol))return;
  new T.GLTFLoader().load('models/camper-fp.glb?v=1',g=>{
    const clip=g.animations.find(c=>c.name==='ScoopFP');if(!clip)return;
    FPS.g=g.scene;FPS.g.visible=false;
    FPS.g.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=false;o.receiveShadow=false}});
    FPS.mixer=new T.AnimationMixer(FPS.g);FPS.act=FPS.mixer.clipAction(clip);FPS.act.play();FPS.act.timeScale=0;
    camera.add(FPS.g);
  },undefined,e=>console.warn('camper-fp.glb failed to load; first person digs with the body',e));
})();
function fpScoopHands(hide){   // the body's hands and shovel: out of the camera's view while ScoopFP stands in for them
  if(!me||!me.model)return;
  if(!me.fpsHands){me.fpsHands=[];me.model.traverse(o=>{if(o.isMesh&&/_[LR]_Hand$|_R_Shovel/.test(o.name))me.fpsHands.push(o)})}
  for(const o of me.fpsHands)o.layers.set(hide?FP_HIDE_LAYER:0);
}
function updateFpScoop(dt){
  if(!FPS.g)return;
  const on=!!(FP&&me&&me.model&&me.fpOn&&S.started&&!S.ko&&P.anim===2&&!me.noShovel&&tune('fp.scoopfp')>0);
  if(on!==FPS.on){FPS.on=on;FPS.g.visible=on;fpScoopHands(on)}
  if(!on)return;
  FPS.act.time=scoopTime(P.digPh);FPS.mixer.update(0);
}
