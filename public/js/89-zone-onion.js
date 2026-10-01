'use strict';
/* public/js/89-zone-onion.js -- Onion Mountain, the Peak-style climb after the Dry Canyon (Greg's Claude, 2026-09-30).
   Design: docs/plans/2026-09-30-onion-mountain-design.md. "Difficult but possible" (Greg) comes first.

   A giant half-buried onion (Sam's onions got out of hand), climbed ring by ring. The shape lives in sim.js (SIM.ONION)
   so the server and tests/onion-layout.mjs see the same mountain:
   - Ring 0 is the desert round it, rings 1-5 are its layers (flat terraces), ring 6 is the top, with the sprout and the
     campfire. Between rings is a layer wall, slick onion flesh nobody can hold on to (88-climb.js asks climbable()).
   - Each wall has one section where the way up is. The Roots (wall 1) are always first: a 2 m wall you can climb
     anywhere, and a root ramp. The Peel Gate (wall 6) is always last. The four in between are shuffled every day
     (the seed is the map + day, zoneSeed in 88-zones.js), and the next section is 140-200 degrees round the ring, so
     each layer is a walk round the onion.
   - This first pass: every middle section is a patch of dry skin you can climb, with a rope anchor at the top for the
     first one up (F drops it for the rest). The Peel Gate is a ramp for now. Skin Walls, Scree, the Fume Crack, the
     Shoot Garden and the flap come one per commit, each replacing its placeholder.
   - A fall is never more than one ring (8 m at most): the terrace below catches you. */
{
const O=SIM.ONION;
let LAY=O.layout(1);                    // the day's layout, picked as the crew arrives (enter)
const ROPE_IN=1.2;                      // a rope's stake: this far in from the wall's top edge
/* how far up wall k a point is, 0 (the ring below) to 1 (the ring above) */
function onRise(k,r,x,z){
  const R=O.R[k-1];
  if(r>R+O.RAMP_L/2+2)return 0;if(r<R-O.RAMP_L/2-2)return 1;
  let s=sm((R-r+O.FACE)/(2*O.FACE));
  const S=LAY.sec[k];
  if(S.ramp){const d=Math.abs(O.along(x,z,S)),w=O.SECT_W/2;   // a walkable ramp through the wall, blending into it at the sides
    if(d<w+1.5){const ramp=clamp((R+O.RAMP_L/2-r)/O.RAMP_L,0,1);s=lerp(ramp,s,sm((d-w+0.5)/2))}}
  return s;
}
function onHeight(x,z){
  const r=Math.hypot(x-O.X,z-O.Z);
  let h=0.25*(vnoise(x*0.08,z*0.08)-0.5);
  for(let k=1;k<=6;k++)h+=(O.H[k]-O.H[k-1])*onRise(k,r,x,z);
  if(r>O.RIM)h+=Math.min(14,(r-O.RIM)*2.8);   // the basin rim
  return h;
}
/* 88-climb.js: can you hold on here? (x,z is the wall's top, just past its face) */
function onClimbable(x,z){
  const r=Math.hypot(x-O.X,z-O.Z);let k=1,best=1e9;
  for(let i=1;i<=6;i++){const d=Math.abs(r-O.R[i-1]);if(d<best){best=d;k=i}}
  if(best>2.5)return false;              // the basin rim, or not a wall at all
  const S=LAY.sec[k];
  if(S.kind==='roots')return true;       // the tutorial: all the way round
  if(S.kind==='peel')return false;
  return Math.abs(O.along(x,z,S))<O.SECT_W/2;   // dry skin you can hold (placeholder until each section is built)
}

const C_SKIN=new T.Color(0xc9a15a),C_SKIN2=new T.Color(0xa87c3e),C_FLESH=new T.Color(0xe9dcec),C_PURPLE=new T.Color(0x8e4a7e),
  C_DRY=new T.Color(0x8a5a2e),C_ROOT=new T.Color(0x5e4128),C_TOP=new T.Color(0x7a8f48),C_ASH=new T.Color(0x5a4636);
function onTint(c,x,z,b){
  const dx=x-O.X,dz=z-O.Z,r=Math.hypot(dx,dz),th=Math.atan2(dz,dx);
  if(r>O.R[0]+2)return;                  // the desert round it stays sand
  c.copy(C_SKIN).lerp(C_SKIN2,0.5+0.2*Math.sin(th*36+r*0.05));   // the papery veins of an onion skin, running up the mountain
  if(r<O.R[5])c.lerp(C_TOP,0.7*sm((O.R[5]-r)/10));
  for(let k=1;k<=6;k++){const R=O.R[k-1];if(Math.abs(r-R)<O.FACE+0.6){
    const S=LAY.sec[k],sec=Math.abs(O.along(x,z,S))<O.SECT_W/2;
    c.copy(k===1?C_ROOT:sec&&!S.ramp?C_DRY:C_FLESH);if(!sec&&k>1)c.lerp(C_PURPLE,0.25+0.2*Math.sin(b*2.3))}}   // red-onion flesh: pale, purple-streaked
  const f=Math.hypot(x-FIRE.x,z-FIRE.z);if(f<3.2)c.lerp(C_ASH,0.6*(1-f/3.2));
}
function onMap(g,night){
  g.fillStyle=night?'#2b2a24':'#d8b98a';g.fillRect(0,0,1024,1024);
  const ring=(r,col)=>{g.fillStyle=col;g.beginPath();g.arc(ccx(O.X),ccz(O.Z),ccs(r),0,Math.PI*2);g.fill()};
  ring(O.RIM,night?'#3a362c':'#e2c79a');
  O.R.forEach((R,i)=>ring(R,night?`hsl(40,20%,${16+i*3}%)`:`hsl(${38+i*6},45%,${52+i*4}%)`));
  g.fillStyle=night?'#ede2c8':'#5a2e18';
  for(let k=1;k<=6;k++){const S=LAY.sec[k],R=O.R[k-1];g.beginPath();g.arc(ccx(O.X+Math.cos(S.a)*R),ccz(O.Z+Math.sin(S.a)*R),5,0,Math.PI*2);g.fill()}
  g.fillStyle='#e0782a';g.beginPath();g.arc(ccx(FIRE.x),ccz(FIRE.z),5,0,Math.PI*2);g.fill();
}

const FIRE={x:O.X,z:O.Z,r:9};
const ARRIVE={x:O.X,z:O.Z+O.R[0]+28,yaw:0};
const ROPES=[];
/* the crew arrives: the day's layout, and everything placed from it */
function onEnter(){
  LAY=O.layout(zoneSeed('onion'));
  const a1=LAY.sec[1].a,r0=O.R[0]+28;
  ARRIVE.x=O.X+Math.cos(a1)*r0;ARRIVE.z=O.Z+Math.sin(a1)*r0;ARRIVE.yaw=Math.atan2(Math.cos(a1),Math.sin(a1));   // facing the onion
  const af=LAY.sec[6].a+Math.PI;FIRE.x=O.X+Math.cos(af)*18;FIRE.z=O.Z+Math.sin(af)*18;   // across the top from the Peel Gate
  ROPES.length=0;
  for(let k=2;k<=5;k++){const S=LAY.sec[k],R=O.R[k-1]-ROPE_IN,c=Math.cos(S.a),s=Math.sin(S.a);
    ROPES.push({x:O.X+c*R,z:O.Z+s*R,a:Math.atan2(c,s),len:ROPE_IN+2*O.FACE+1.6,flag:'rope'+k,label:'Drop the rope down this wall'})}   // a: facing out, down the wall
}

const ropeMesh={},coils={};
function onBuild(group){
  const at=(x,z)=>onHeight(x,z),add=(m,x,z,dy)=>{m.position.set(x,at(x,z)+(dy||0),z);group.add(m);return m};
  const rnd=mulberry32(LAY.seed^0x5eed);
  /* the sprout: a fat green shoot out of the top, the landmark you can see from the desert */
  const sprout=new T.Group(),green=M(0x6f9a3a),pale=M(0xc6d68a);
  const base=new T.Mesh(new T.CylinderGeometry(3.2,5.5,4,10),pale);base.position.y=2;sprout.add(base);
  for(let i=0;i<5;i++){const h=10+rnd()*8,l=new T.Mesh(new T.ConeGeometry(0.9,h,6),green);l.position.set(Math.cos(i*1.3)*1.6,4+h/2,Math.sin(i*1.3)*1.6);l.rotation.set(Math.sin(i*2.1)*0.25,0,Math.cos(i*1.7)*0.25);l.castShadow=true;sprout.add(l)}
  add(sprout,O.X,O.Z);
  ZONES.onion.solids=[[O.X,O.Z,9,9]];
  /* the ropes: an iron stake and a coil at the top of each middle section; the rope shows once it's dropped */
  for(const R of ROPES){
    const top=at(R.x,R.z),k=+R.flag.slice(4),Rw=O.R[k-1],c=(R.x-O.X)/(Rw-ROPE_IN),s=(R.z-O.Z)/(Rw-ROPE_IN);
    const stake=new T.Mesh(new T.CylinderGeometry(0.05,0.05,0.9,6),M(0x3a3a3a));stake.position.set(R.x,top+0.45,R.z);group.add(stake);
    const coil=new T.Mesh(new T.TorusGeometry(0.32,0.07,6,14),M(0xb89a62));coil.rotation.x=Math.PI/2;coil.position.set(R.x-s*0.5,top+0.08,R.z+c*0.5);group.add(coil);coils[R.flag]=coil;
    const fx=O.X+c*(Rw+O.FACE+0.15),fz=O.Z+s*(Rw+O.FACE+0.15),bottom=O.H[k-1],len=O.H[k]-bottom+0.4;
    const rope=new T.Mesh(new T.CylinderGeometry(0.04,0.04,len,5),M(0xb89a62));rope.position.set(fx,bottom+len/2-0.2,fz);rope.visible=false;group.add(rope);ropeMesh[R.flag]=rope;
  }
  /* wild onions on the lower rings: purple bulbs half out of the ground (the onion rows come with the lizards) */
  const ON=70,og=new T.SphereGeometry(0.5,8,6),om=new T.InstancedMesh(og,M(0x8e4a7e),ON),mx=new T.Matrix4(),q=new T.Quaternion(),sv=new T.Vector3(),pv=new T.Vector3();
  let n=0;
  for(let i=0;i<400&&n<ON;i++){const k=1+Math.floor(rnd()*3),r=O.R[k]+3+rnd()*(O.R[k-1]-O.R[k]-6),th=rnd()*Math.PI*2,x=O.X+Math.cos(th)*r,z=O.Z+Math.sin(th)*r;
    const s=0.5+rnd()*0.7;sv.set(s,s*0.85,s);pv.set(x,at(x,z)+s*0.15,z);q.identity();mx.compose(pv,q,sv);om.setMatrixAt(n++,mx)}
  om.count=n;om.castShadow=true;om.frustumCulled=false;group.add(om);
  /* the campfire at the top: stones, logs, a flame and a warm light */
  const ring=new T.Group();for(let i=0;i<9;i++){const a=i/9*Math.PI*2,st=new T.Mesh(new T.DodecahedronGeometry(0.26,0),M(0x7c7466));st.position.set(Math.cos(a)*0.95,0.12,Math.sin(a)*0.95);ring.add(st)}
  for(let i=0;i<2;i++){const l=new T.Mesh(new T.CylinderGeometry(0.1,0.1,1.4,6),M(0x5a3a22));l.rotation.set(Math.PI/2,0,i?0.9:-0.9);l.position.y=0.15;ring.add(l)}
  const flameMat=new T.MeshBasicMaterial({color:0xffa23a,transparent:true,opacity:0.9});flameMat.userData.own=true;
  const flame=new T.Mesh(new T.ConeGeometry(0.42,1.2,7),flameMat);flame.position.y=0.75;ring.add(flame);
  const light=new T.PointLight(0xff9a40,1.6,22,1.6);light.position.y=1.4;ring.add(light);
  add(ring,FIRE.x,FIRE.z);
  let t=0;
  const night=()=>{try{return scene.fog.color.r<0.35}catch(e){return false}};   // as the canyon's fire: bright at night, a glow by day
  return dt=>{t+=dt;const f=0.85+0.15*Math.sin(t*17)+0.1*Math.sin(t*7.3);flame.scale.set(1,f,1);light.intensity=night()?1.3+0.8*f:0.3+0.3*f}
}

function onItems(rnd){
  const W=[['jar',14],['arrow',10],['shoe',10],['fossil',8],['spoon',8],['can',10],['lipstick',4],['locket',3],['sploosh',3]],WS=W.reduce((s,w)=>s+w[1],0);
  const pick=()=>{let r=rnd()*WS;for(const[k,v]of W)if((r-=v)<0)return k;return 'can'};
  const out=[];
  for(let i=0;i<80;i++){const k=1+Math.floor(rnd()*5),r=O.R[k]+4+rnd()*(O.R[k-1]-O.R[k]-8),th=rnd()*Math.PI*2;
    out.push({type:pick(),x:O.X+Math.cos(th)*r,z:O.Z+Math.sin(th)*r,depth:0.3+rnd()*1.1})}
  return out;
}

ZONES.onion={id:'onion',name:'Onion Mountain',
  blurb:'Sam\'s onions got out of hand. Climb the onion ring by ring to the campfire by the sprout. Big Thumb is just past it.',
  height:onHeight,tint:onTint,map:onMap,climbable:onClimbable,enter:onEnter,
  arrive:ARRIVE,fire:FIRE,ropes:ROPES,
  build:onBuild,items:onItems,solids:[],
  onFlags(f){for(const k in ropeMesh){ropeMesh[k].visible=!!f[k];coils[k].visible=!f[k]}}};
}
