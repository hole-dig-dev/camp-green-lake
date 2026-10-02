'use strict';
/* public/js/88-hover.js -- the hoverboard (JT 2026-10-01: "like real futuristic ones, hover one inch above the ground;
   no real change to perspective height, but you can float above dug holes and sinkholes"). Late-game gear
   (S.up.hover). Z (remappable: 'hover') hops on or off. On it you ride HOVER_H above the undug ground (70-player.js:
   max(groundAt, baseH)), so holes and sinkholes pass under you; a little quicker (gear.hoverSpeed); no digging, and
   a twister, tumbleweed, vulture or knockout knocks you off it. Not inside a hole: hop on from level ground.
   Friends see it (pos flag hv). Model: Sol's Hoverboard.glb under your feet, its pads glowing.
   Hover shoes (S.up.hoverShoes, JT): the same float, worn (Sol's footwear/hover-shoes.glb in place of your shoes, via
   the Wardrobe binding; pos flag hs). You walk and dig as normal: start digging and they quietly switch off so you
   settle into your hole (SHOE.sup); they come back on once you're out on level ground and walking. N (remappable:
   'hoverShoes') switches them off / on whenever you like, say to go down a sinkhole on purpose. */
const HOVER_H=0.05;
const HOV={on:false,parts:null,loading:false};
const hoverOn=()=>HOV.on&&!!S.up.hover;   // the board
const SHOE={on:true,sup:false,supT:0};
const shoesOn=()=>!!S.up.hoverShoes&&SHOE.on&&!SHOE.sup&&!S.ko&&!twSt&&!tbSt&&!vSt;
const floating=()=>hoverOn()||shoesOn();   /* 70-player.js rides HOVER_H over the undug ground; sinkholes/holes don't catch you */
function toggleHoverShoes(){if(!S.started||uiOpen())return;if(!S.up.hoverShoes){toast('No hover shoes. The Supply Depot has them (late game).','',2400);return}
  SHOE.on=!SHOE.on;SHOE.sup=false;tone(SHOE.on?520:380,0.18,'sine',0.045,SHOE.on?880:220);toast(SHOE.on?'Hover shoes on.':'Hover shoes off: down you go wherever you step.','',1800)}
/* 45-state.js scoop: digging switches them off, quietly */
function shoesDig(){if(S.up.hoverShoes&&SHOE.on){SHOE.sup=true;SHOE.supT=performance.now()}}
function toggleHover(){
  if(!S.started||uiOpen())return;
  if(!S.up.hover){toast('No hoverboard. The Supply Depot has them (late game).','',2400);return}
  if(HOV.on){HOV.on=false;sfx.thud();toast('You step off your hoverboard.','',1600);return}
  if(S.ko||twSt||tbSt||vSt||inTent()||S.inTown){return}
  if(holeDepthHere()>0.4||isTrapped()||(typeof inSinkhole==='function'&&inSinkhole())){toast('Climb out first: you need level ground to hop on.','',2400);return}
  HOV.on=true;digHeld=false;tone(520,0.25,'sine',0.05,880);toast('On your hoverboard: holes and sinkholes pass under you. Z to step off.','good',2600);logEv('hover',{on:1});
}
function hoverMesh(p){
  if(p.hoverObj)return p.hoverObj;if(!HOV.parts){if(!HOV.loading){HOV.loading=true;modelParts('Hoverboard').then(x=>{HOV.parts=x}).catch(()=>{})}return null}
  const g=new T.Group();for(const pt of HOV.parts){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;g.add(m)}p.g.add(g);p.hoverObj=g;return g;
}
function hoverLook(p,on){const m=on?hoverMesh(p):p.hoverObj;if(m)m.visible=!!on}
function updateHover(dt){
  /* the shoes come back on once you're out on level ground and walking (not mid-dig) */
  if(SHOE.sup&&P.moving&&performance.now()-SHOE.supT>1200&&baseH(P.x,P.z)-groundAt(P.x,P.z)<0.15)SHOE.sup=false;
  if(me&&me.hoverShoes!==!!S.up.hoverShoes){me.hoverShoes=!!S.up.hoverShoes;me.ward=me.ward||MY_WARD;wardApply(me)}
  for(const R of remotes.values())if(R.p.hoverShoes!==!!R.hs){R.p.hoverShoes=!!R.hs;R.p.ward=R.p.ward||wardDefault();wardApply(R.p)}
  if(HOV.on&&(!S.up.hover||S.ko||twSt||tbSt||vSt)){HOV.on=false;if(S.started&&S.up.hover)toast('You fell off your hoverboard!','',2200)}
  if(me)hoverLook(me,hoverOn());
  for(const R of remotes.values())hoverLook(R.p,!!R.hv);
}
