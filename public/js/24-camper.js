'use strict';
/* A game-ready camper prototype. It keeps makePerson's limb pivots so every existing action can animate it. */
const CAMPER_GEO={
  head:new T.SphereGeometry(1,9,7),
  eye:new T.SphereGeometry(1,8,6),
  body:new T.SphereGeometry(1,9,7),
};
function camperPart(g,geo,color,x,y,z,sx,sy,sz){
  const m=new T.Mesh(geo,M(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);
  m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function makeCamper(o){
  const g=new T.Group(),suit=o.suit||0xbf6b3e,skin=o.skin||0xe0b48f;
  const dark=0x352b27,cloth=0xe0d1aa,boots=0x57402e,accent=o.band||0x2f5f8a;
  const legL=new T.Group(),legR=new T.Group(),armL=new T.Group(),armR=new T.Group();
  const upper=new T.Group();upper.position.y=0.82;
  legL.position.set(-0.18,0.82,0);legR.position.set(0.18,0.82,0);
  for(const leg of[legL,legR]){
    camperPart(leg,CAMPER_GEO.body,suit,0,-0.35,0,0.16,0.45,0.17);
    camperPart(leg,CAMPER_GEO.body,accent,0,-0.64,0.04,0.17,0.12,0.18); // knee patch
    const boot=box(0.32,0.24,0.39,boots);boot.position.set(0,-0.75,0.09);leg.add(boot);
    const toe=box(0.33,0.11,0.43,0x3b2b23);toe.position.set(0,-0.83,0.13);leg.add(toe);
    g.add(leg);
  }
  camperPart(upper,CAMPER_GEO.body,suit,0,0.31,0,0.40,0.39,0.27);
  const belt=box(0.72,0.11,0.50,boots);belt.position.set(0,0.04,0);upper.add(belt);
  const buckle=box(0.12,0.10,0.03,0xc4aa71);buckle.position.set(0,0.04,0.27);upper.add(buckle);
  const collar=box(0.45,0.09,0.40,cloth);collar.position.set(0,0.65,0);upper.add(collar);
  for(const side of[-1,1]){
    const pocket=box(0.16,0.16,0.035,accent);pocket.position.set(side*0.18,0.37,0.25);upper.add(pocket);
    const arm=side<0?armL:armR;arm.position.set(side*0.43,0.57,0);
    camperPart(arm,CAMPER_GEO.body,suit,0,-0.19,0,0.15,0.28,0.16);
    camperPart(arm,CAMPER_GEO.body,skin,0,-0.48,0.01,0.13,0.12,0.13);
    const cuff=box(0.25,0.08,0.25,cloth);cuff.position.set(0,-0.42,0);arm.add(cuff);
    upper.add(arm);
  }
  const head=new T.Group();head.position.set(0,0.85,0);upper.add(head);
  camperPart(head,CAMPER_GEO.head,skin,0,0,0,0.33,0.33,0.29);
  for(const side of[-1,1]){
    camperPart(head,CAMPER_GEO.eye,skin,side*0.32,-0.015,0,0.065,0.10,0.065); // ears
    camperPart(head,CAMPER_GEO.eye,0xfff7e7,side*0.115,0.045,0.259,0.073,0.082,0.034);
    camperPart(head,CAMPER_GEO.eye,dark,side*0.115,0.042,0.291,0.034,0.048,0.015);
    const brow=box(0.15,0.035,0.035,dark);brow.position.set(side*0.115,0.167,0.272);brow.rotation.z=side*0.13;head.add(brow);
  }
  camperPart(head,CAMPER_GEO.eye,skin,0,-0.065,0.286,0.065,0.055,0.058);
  const smileCurve=new T.QuadraticBezierCurve3(
    new T.Vector3(-0.11,-0.14,0.253),new T.Vector3(0,-0.23,0.30),new T.Vector3(0.11,-0.14,0.253));
  const smile=new T.Mesh(new T.TubeGeometry(smileCurve,8,0.012,4,false),M(dark));head.add(smile);
  const gasp=camperPart(head,CAMPER_GEO.eye,dark,0,-0.17,0.268,0.057,0.074,0.018);gasp.visible=false;
  const hat=new T.Group();hat.position.y=0.275;
  const brim=cyl(0.39,0.39,0.045,10,cloth);hat.add(brim);
  const crown=cyl(0.22,0.255,0.22,8,cloth);crown.position.y=0.12;hat.add(crown);
  const band=cyl(0.255,0.255,0.045,8,accent);band.position.y=0.055;hat.add(band);head.add(hat);
  let shovel=null;
  if(o.shovel!==false){
    shovel=new T.Group();const handle=cyl(0.032,0.032,1.15,6,0x896640);handle.position.y=-0.30;
    const blade=box(0.24,0.30,0.045,0x737d7e);blade.position.y=-0.95;
    shovel.add(handle,blade);shovel.position.set(0,-0.53,0.04);shovel.rotation.x=-0.45;armR.add(shovel);
  }
  upper.add(head);g.add(upper);
  return{g,upper,legL,legR,armL,armR,shovel,hat,head,face:{smile,gasp,t:0},ph:0};
}
function animateCamperFace(p,mode,dt,digPhase){
  if(!p.face)return;
  const f=p.face;f.t+=dt;
  const exerting=mode===2&&digPhase>0.22&&digPhase<0.8;
  f.gasp.visible=exerting||mode===4;f.smile.visible=!f.gasp.visible;
  const x=mode===2?0.12:mode===4?-0.12:0;
  p.head.rotation.x+=(x-p.head.rotation.x)*Math.min(1,dt*8);
  p.head.rotation.z=Math.sin(f.t*2)*0.025;
  const sway=mode===1||mode===4?Math.sin(p.ph)*0.045:mode===2?Math.sin(digPhase*Math.PI*2)*0.035:0;
  p.upper.rotation.z+=(sway-p.upper.rotation.z)*Math.min(1,dt*8);
}
