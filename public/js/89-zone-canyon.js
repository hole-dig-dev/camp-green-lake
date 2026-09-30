'use strict';
/* public/js/89-zone-canyon.js -- the Dry Canyon, the first Peak-style map (see 88-zones.js for how maps work).

   A dry wash that winds north toward Big Thumb and climbs as it goes, like one of Peak's biomes:
   1. The wash (start): wide and easy. Dig for loot, learn the ground.
   2. The first step: a rock ledge too tall to jump. A friend crouches (C) and you jump off them (a leg-up), or you
      find the lone boulder at the side (a cairn marks it) and hop up from that.
   3. The narrows: a tight, winding slot.
   4. The stairs: three more steps in a row, each with its boulder on alternating sides.
   5. The dry fall: a 4.8 m wall nobody can leg-up. One camper takes the long, narrow shelf up the east wall (fall off
      and you're back at the bottom, a bit hurt), then drops the rope at the top (F) for everyone else.
   6. The upper bench: one last step, then the rim camp's campfire with Big Thumb ahead. Get the whole crew to it.

   It sits east of the lake's middle (x ~190-330), well clear of the camp fence box, running from z +520 (start) to
   z -525 (the campfire). Everything off the canyon floor is sheer cliff and plateau.
*/
{
const CY_Z0=SIM.CANYON.Z0, CY_Z1=SIM.CANYON.Z1;   // start (south) and campfire (north) ends of the canyon floor (the floor plan is shared with the server: sim.js CANYON)
const CY_SLOPE=0.018;                   // the floor climbs this much per metre north, on top of the ledges (~19 m in all)
const CY_WALL_K=2.8;                    // cliff steepness (rise per metre); anything over ~1.1 can't be walked up
const cyX=SIM.CANYON.x;   // the floor's centre line
const cyW=SIM.CANYON.w;   // the floor's half-width along the canyon (widths table: sim.js CANYON.W)
/* the steps up the canyon. side: which side its boulder is on (+1 east). The dry fall has the shelf instead. */
const CY_STEPS=[{z:370,h:1.8,side:1},{z:150,h:1.8,side:-1},{z:90,h:2.0,side:1},{z:25,h:1.75,side:-1},{z:-330,h:1.9,side:1}];
const CY_FALL={z:-165,h:4.8,shelf:95};  // the dry fall, and how far back (m) the shelf up the east wall starts
const CY_FACE=0.35;                     // half-thickness of a ledge's face (m): steep enough that nobody walks up it
const CY_BOULDER_R=1.0, CY_BOULDER_H=1.05;  // the hop-up boulder in front of each step
const CY_SHELF_W=1.7;                   // the dry-fall shelf's width (m)

const stepRise=(L,z)=>L.h*sm((L.z-z+CY_FACE)/(2*CY_FACE));
function cyFloor(x,z){
  const zc=clamp(z,CY_Z1-40,CY_Z0+40),cx=cyX(z),w=cyW(z);
  let h=(CY_Z0-zc)*CY_SLOPE+0.3*(vnoise(x*0.08,z*0.08)-0.5);
  for(const L of CY_STEPS){
    h+=stepRise(L,z);
    const bx=cx+L.side*w*0.62,bz=L.z+1.7,d=Math.hypot(x-bx,z-bz);   // the hop-up boulder
    if(d<CY_BOULDER_R*1.3)h+=CY_BOULDER_H*sm(1-d/(CY_BOULDER_R*1.3))**0.35;
  }
  // the dry fall, with the shelf: a narrow ramp hugging the east wall that climbs from the canyon floor to the top
  let fall=stepRise(CY_FALL,z);
  const sx=cx+w-CY_SHELF_W*0.5,t=(CY_FALL.z+CY_FALL.shelf-z)/CY_FALL.shelf;
  if(Math.abs(x-sx)<CY_SHELF_W*0.5+0.3&&t>0&&t<1.02){const k=1-sm((Math.abs(x-sx)-CY_SHELF_W*0.5)/0.3);fall=Math.max(fall,lerp(fall,CY_FALL.h*Math.min(1,t),k))}
  return h+fall;
}
const CY_RIM=4;                         // the low rim past the campfire: too tall to climb, low enough to see Big Thumb over
function cyWall(x,z){
  const d=Math.abs(x-cyX(z))-cyW(z);
  let q=d>0?d*CY_WALL_K:0;
  if(z>CY_Z0)q=Math.max(q,(z-CY_Z0)*CY_WALL_K);            // the south end
  const rim=z<CY_Z1-28?Math.min(CY_RIM,(CY_Z1-28-z)*CY_WALL_K):0;   // the north end, behind the campfire
  if(q<=0&&rim<=0)return 0;
  const top=24+18*vnoise(x*0.013+5,z*0.013);
  const wall=q<=0?0:q<top?q+0.5*Math.sin(q*1.3):top+1.5*vnoise(x*0.05,z*0.05);   // little strata benches on the face, a rough plateau on top
  return Math.max(wall,rim);
}
function cyHeight(x,z){return cyFloor(x,z)+cyWall(x,z)}

const CY_BANDS=[new T.Color(0xb5653d),new T.Color(0x9c4f2e),new T.Color(0xc98a5c)],CY_FLOOR=new T.Color(0xd9a77a),CY_ASH=new T.Color(0x5a4636);
const FIRE={x:cyX(CY_Z1+20),z:CY_Z1+20,r:9};
function cyTint(c,x,z,b){
  const cx=cyX(z),w=cyW(z),d=Math.abs(x-cx);
  c.lerp(CY_FLOOR,0.35);
  let rock=sm((d-w+0.5)/2.5);
  for(const L of CY_STEPS)if(Math.abs(L.z-z)<CY_FACE+0.2)rock=Math.max(rock,0.8);
  if(Math.abs(CY_FALL.z-z)<CY_FACE+0.2)rock=Math.max(rock,0.9);
  if(rock>0.01)c.lerp(CY_BANDS[((Math.floor(b/2.6)%3)+3)%3],rock*0.9);
  const f=Math.hypot(x-FIRE.x,z-FIRE.z);if(f<3.2)c.lerp(CY_ASH,0.6*(1-f/3.2));
}
function cyMap(g,night){
  g.fillStyle=night?'#2b2320':'#9c6a48';g.fillRect(0,0,1024,1024);   // plateau
  g.fillStyle=night?'#3a312a':'#d9a878';
  for(let z=CY_Z1-30;z<=CY_Z0+10;z+=3){const cx=cyX(z),w=cyW(z);g.fillRect(ccx(cx-w),ccz(z),ccs(w*2),ccs(3.4))}
  g.strokeStyle=night?'rgba(237,226,200,.55)':'rgba(70,35,18,.8)';g.lineWidth=2;
  for(const L of [...CY_STEPS,CY_FALL]){const cx=cyX(L.z),w=cyW(L.z);g.beginPath();g.moveTo(ccx(cx-w),ccz(L.z));g.lineTo(ccx(cx+w),ccz(L.z));g.stroke()}
  g.fillStyle='#e0782a';g.beginPath();g.arc(ccx(FIRE.x),ccz(FIRE.z),5,0,Math.PI*2);g.fill();
}

/* the rope at the top of the dry fall */
const ROPE={x:cyX(CY_FALL.z-1.2),z:CY_FALL.z-1.2,a:0,len:3.2,flag:'rope0',label:'Drop the rope down the dry fall'};

let ropeMesh=null,coil=null;
function cyBuild(group){
  const add=(m,x,z,dy)=>{m.position.set(x,cyHeight(x,z)+(dy||0),z);group.add(m);return m};
  const rnd=mulberry32(4471);
  /* boulders along the floor edges: one instanced mesh, one draw call */
  const BN=60,bg=new T.DodecahedronGeometry(1,0),bm=new T.InstancedMesh(bg,M(0x9a6a4a),BN),mx=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),sv=new T.Vector3(),pv=new T.Vector3();
  const solids=[];let bi=0;
  for(let k=0;k<400&&bi<BN;k++){
    const z=CY_Z1+10+rnd()*(CY_Z0-CY_Z1-20),cx=cyX(z),w=cyW(z),x=cx+(rnd()<0.5?-1:1)*w*(0.72+rnd()*0.2);
    if(CY_STEPS.some(L=>Math.abs(L.z-z)<6)||Math.abs(CY_FALL.z-z)<8||Math.abs(CY_FALL.z+CY_FALL.shelf/2-z)<CY_FALL.shelf/2+4&&x>cx||Math.hypot(x-FIRE.x,z-FIRE.z)<14)continue;
    const s=0.7+rnd()*1.3;e.set(rnd()*3,rnd()*3,rnd()*3);q.setFromEuler(e);sv.set(s,s*(0.6+rnd()*0.4),s);pv.set(x,cyHeight(x,z)+s*0.25,z);
    mx.compose(pv,q,sv);bm.setMatrixAt(bi++,mx);if(s>1)solids.push([x,z,s*1.3,s*1.3]);
  }
  bm.count=bi;bm.castShadow=true;bm.receiveShadow=true;bm.frustumCulled=false;group.add(bm);
  ZONES.canyon.solids=solids;
  /* dead brush and snags */
  const TN=50,tg=new T.CylinderGeometry(0.06,0.14,2.4,5);tg.translate(0,1.2,0);const tm=new T.InstancedMesh(tg,M(0x6b5a48),TN);
  for(let i=0;i<TN;i++){const z=CY_Z1+rnd()*(CY_Z0-CY_Z1),cx=cyX(z),w=cyW(z),x=cx+(rnd()*2-1)*w*0.9;e.set((rnd()-0.5)*0.6,rnd()*6,(rnd()-0.5)*0.6);q.setFromEuler(e);const s=0.6+rnd()*0.9;sv.set(s,s,s);pv.set(x,cyHeight(x,z)-0.1,z);mx.compose(pv,q,sv);tm.setMatrixAt(i,mx)}
  tm.castShadow=true;tm.frustumCulled=false;group.add(tm);
  /* cairns: little rock stacks marking each hop-up boulder and the bottom of the shelf */
  const cairn=(x,z)=>{for(let i=0;i<3;i++){const r=0.28-i*0.07,m=new T.Mesh(new T.DodecahedronGeometry(r,0),M(0xcfc2a8));add(m,x,z,r+i*0.36).castShadow=true}};
  for(const L of CY_STEPS){const cx=cyX(L.z),w=cyW(L.z);cairn(cx+L.side*w*0.62,L.z+4.2)}
  {const z=CY_FALL.z+CY_FALL.shelf+3,cx=cyX(z),w=cyW(z);cairn(cx+w-3,z)}
  /* the dry fall's rope: an iron stake and a coil at the top; the rope itself shows once someone drops it */
  const top=cyHeight(ROPE.x,ROPE.z);
  const stake=new T.Mesh(new T.CylinderGeometry(0.05,0.05,0.9,6),M(0x3a3a3a));stake.position.set(ROPE.x,top+0.45,ROPE.z);group.add(stake);
  coil=new T.Mesh(new T.TorusGeometry(0.32,0.07,6,14),M(0xb89a62));coil.rotation.x=Math.PI/2;coil.position.set(ROPE.x+0.5,top+0.08,ROPE.z);group.add(coil);
  const bottom=cyHeight(ROPE.x,ROPE.z+ROPE.len),len=top-bottom+0.4;
  ropeMesh=new T.Mesh(new T.CylinderGeometry(0.04,0.04,len,5),M(0xb89a62));ropeMesh.position.set(ROPE.x,bottom+len/2-0.2,CY_FALL.z+0.45);ropeMesh.visible=false;group.add(ropeMesh);
  /* the rim camp's campfire: a ring of stones, crossed logs, a flame, and a warm light */
  const ring=new T.Group();for(let i=0;i<9;i++){const a=i/9*Math.PI*2,s=new T.Mesh(new T.DodecahedronGeometry(0.26,0),M(0x7c7466));s.position.set(Math.cos(a)*0.95,0.12,Math.sin(a)*0.95);ring.add(s)}
  for(let i=0;i<2;i++){const l=new T.Mesh(new T.CylinderGeometry(0.1,0.1,1.4,6),M(0x5a3a22));l.rotation.set(Math.PI/2,0,i?0.9:-0.9);l.position.y=0.15;ring.add(l)}
  const flameMat=new T.MeshBasicMaterial({color:0xffa23a,transparent:true,opacity:0.9});flameMat.userData.own=true;
  const flame=new T.Mesh(new T.ConeGeometry(0.42,1.2,7),flameMat);flame.position.y=0.75;ring.add(flame);
  const inner=new T.Mesh(new T.ConeGeometry(0.22,0.7,6),M(0xfff0a0,{emissive:0xffd060,emissiveIntensity:1}));inner.position.y=0.55;ring.add(inner);
  const light=new T.PointLight(0xff9a40,1.6,22,1.6);light.position.y=1.4;ring.add(light);
  add(ring,FIRE.x,FIRE.z);
  /* a weathered sign at the start, pointing the way */
  {const z=CY_Z0-18,x=cyX(z)-cyW(z)*0.5,s=new T.Group();
   const post=new T.Mesh(new T.BoxGeometry(0.14,1.8,0.14),M(0x6b4a2e));post.position.y=0.9;s.add(post);
   const board=new T.Mesh(new T.BoxGeometry(1.5,0.42,0.06),M(0xa27a52));board.position.y=1.55;s.add(board);
   s.rotation.y=0.3;add(s,x,z)}
  let t=0;
  return dt=>{t+=dt;const f=0.85+0.15*Math.sin(t*17)+0.1*Math.sin(t*7.3);flame.scale.set(1,f,1);light.intensity=1.3+0.5*f*(isNightNow()?1.6:0.6)};
}
function isNightNow(){try{return scene.fog.color.r<0.35}catch(e){return false}}

function cyItems(rnd){
  const W=[['jar',14],['arrow',14],['shoe',10],['fossil',10],['spoon',8],['can',8],['lipstick',4],['locket',3],['pistol',2],['sploosh',2]],WS=W.reduce((s,w)=>s+w[1],0);
  const pick=()=>{let r=rnd()*WS;for(const[k,v]of W)if((r-=v)<0)return k;return 'can'};
  const out=[],clear=z=>!CY_STEPS.some(L=>Math.abs(L.z-z)<3)&&Math.abs(CY_FALL.z-z)>3;
  for(let i=0;i<90;i++){const z=CY_Z1+25+rnd()*(CY_Z0-CY_Z1-40);if(!clear(z))continue;out.push({type:pick(),x:cyX(z)+(rnd()*2-1)*cyW(z)*0.75,z,depth:0.3+rnd()*1.1})}
  for(let i=0;i<4;i++){const z=CY_Z1+60+rnd()*(CY_Z0-CY_Z1-120);if(!clear(z))continue;out.push({type:rnd()<0.5?'safe':'strongbox',x:cyX(z)+(rnd()*2-1)*cyW(z)*0.5,z,depth:1.3})}   // haul these over the ledges together
  return out;
}

ZONES.canyon={id:'canyon',name:'The Dry Canyon',
  blurb:'Zero ran for Big Thumb. Follow the canyon up to the rim and get the whole crew to the campfire.',
  height:cyHeight,tint:cyTint,map:cyMap,
  arrive:{x:cyX(CY_Z0-12),z:CY_Z0-12,yaw:0},fire:FIRE,ropes:[ROPE],
  build:cyBuild,items:cyItems,solids:[],
  onFlags(f){if(ropeMesh)ropeMesh.visible=!!f.rope0;if(coil)coil.visible=!f.rope0}};
}
