'use strict';
/* public/js/89-town.js -- the buried town of Green Lake (after Greg's branch, claude/intense-change-1-test-2026-09-27-1829).
   The layout is in public/sim.js (TOWN, townLayout): Main Street, a buried street cavern with three big buildings on each
   side, and seven more buildings off it, joined by timber-shored tunnels. The town is the same every day; only the loot
   is new. It's built off the lake map at x 2000, the way the tent rooms sit underground, so nothing on the lake reaches you.
   Getting in:  dig a 5 ft hole (any shovel) at the middle of the old town (SIM.OLD_TOWN, the cracked ground with old
                timbers sticking out; the X/Y on the Warden's note). Only there, and you always land in the same place
                (JT: fixed while we build the level). The floor gives way: press F by the hole to climb down.
   Down there:  it's dark (bring the flashlight). Some tunnels are crawlspaces (crouch, C). Finds lie around (F picks them
                up); Kate's vault has gold bars. Everyone who breaks through shares the same town.
   Getting out: climb a shaft (F under it) or the old well. You can't alone: a friend down here crouching next to you boosts
                you, someone up top holding F at the hole lowers a hand, or you stake your rope ladder in it for good.
                The collapsed stairwell at the west end of Main Street you can just walk up; it comes out at the old town.
   The pieces (street, buildings, door plugs, tunnel timber and debris) are Blender models from art/blender/town.py; the
   tunnels' cave walls are dug here along each tunnel's path. Where you can walk: Main Street, inside the buildings, through
   their open doors and along the tunnels, minus the furniture (public/data/TownColliders.json).
   Not yet: the lizard queen and Trout Walker's mob, heavy loot down here, a town minimap. */
let TLAY=null,TLAY_DAY=-1,townGroup=null,townRoom=null;
const TLOOTM=new Map(),TGOT=new Set(),BREACH=new Map(),breachDisc=new Map();
const TW=SIM.TOWN;
const TOWN_DW=1.8;   // door width in the Blender buildings (art/blender/town.py DW)
function townLay(){const d=RUN.day||1;if(TLAY_DAY!==d){TLAY_DAY=d;TLAY=SIM.townLayout(d);TGOT.clear();if(townGroup)buildTown()}return TLAY}
function townFloorAt(){return TW.Y}
const tx=x=>TW.X+x,tz=z=>TW.Z+z;

/* ---- where you can walk (world coordinates) ---- */
const TWALK={rects:[],caps:[],obst:[],ceil:[]};   // rects: {x0,x1,z0,z1,h,name}; caps: {ax,az,bx,bz,r,crawl,h}; obst: rects
function townWalkBuild(L,J){
  const W=TWALK;W.rects=[];W.caps=[];W.obst=[];
  const S_=TW.STREET,m=0.3;
  W.rects.push({x0:tx(S_.x0)+m,x1:tx(S_.x1)-m,z0:tz(S_.z0)+m,z1:tz(S_.z1)-m,h:S_.h,name:'Main Street'});
  for(const b of L.bldgs){
    const q=Math.abs(Math.sin(b.ry))>0.5,w=(q?b.D:b.W)/2-0.15-m,d=(q?b.W:b.D)/2-0.15-m;
    W.rects.push({x0:tx(b.x)-w,x1:tx(b.x)+w,z0:tz(b.z)-d,z1:tz(b.z)+d,h:TW.H,name:b.name,b});
    for(const[side,v]of Object.entries(b.doors)){if(!v)continue;const D=SIM.townDoor(b,side),hw=TOWN_DW/2-m;   // through the open doorway
      W.rects.push(D.nx?{x0:tx(D.x)-1.2,x1:tx(D.x)+1.2,z0:tz(D.z)-hw,z1:tz(D.z)+hw,h:2.4}:{x0:tx(D.x)-hw,x1:tx(D.x)+hw,z0:tz(D.z)-1.2,z1:tz(D.z)+1.2,h:2.4})}
    townColAdd(J.cols[b.key],tx(b.x),tz(b.z),b.ry);
  }
  townColAdd(J.cols.street,tx(0),tz(0),0);
  for(const t of L.tunnels)for(const sg of townSamples(t))W.caps.push({ax:tx(sg[0][0]),az:tz(sg[0][1]),bx:tx(sg[1][0]),bz:tz(sg[1][1]),r:TW.TUN_R-m,crawl:sg[2],h:sg[2]?1.2:TW.TUN_H});
}
function townColAdd(list,cx,cz,ry){   // [dx,dz,w,d] from the piece's centre, turned by ry (a multiple of 90 degrees)
  const q=Math.round(ry/(Math.PI/2))&3;
  for(const[dx,dz,w,d]of list||[]){
    const x=[dx,dz,-dx,-dz][q],z=[dz,-dx,-dz,dx][q],W=q&1?d:w,D=q&1?w:d;
    TWALK.obst.push({x0:cx+x-W/2,x1:cx+x+W/2,z0:cz+z-D/2,z1:cz+z+D/2});
  }
}
const inR=(r,x,z,m=0)=>x>r.x0-m&&x<r.x1+m&&z>r.z0-m&&z<r.z1+m;
function segD(x,z,c){const dx=c.bx-c.ax,dz=c.bz-c.az,L=dx*dx+dz*dz;let t=L?((x-c.ax)*dx+(z-c.az)*dz)/L:0;t=t<0?0:t>1?1:t;return Math.hypot(x-c.ax-t*dx,z-c.az-t*dz)}
/* where you are: a room ({name,h}), or null if that's solid ground. crouch lets you into crawlspaces */
function townWhere(x,z,crouch){
  for(const r of TWALK.rects)if(inR(r,x,z))return r;
  let best=null;for(const c of TWALK.caps)if((!c.crawl||crouch)&&segD(x,z,c)<c.r){if(!c.crawl)return{name:'tunnel',h:c.h};best={name:'crawl',h:c.h}}
  return best;
}
function townWalk(x,z,crouch){return!!townWhere(x,z,crouch)&&!TWALK.obst.some(o=>inR(o,x,z,0.3))}
function townCeil(x,z){const w=townWhere(x,z,true);return w?w.h:2.4}

/* ---- the tunnels: a path sampled every ~0.7 m, and which samples are the crawlspace ---- */
function townSamples(t){
  const P=t.pts,out=[];let L=0;const seg=[];
  for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);seg.push(l);L+=l}
  const n=Math.max(2,Math.ceil(L/0.7)),pts=[];for(let k=0;k<=n;k++)pts.push(SIM.townAlong(P,k/n));
  for(let k=0;k<n;k++){const f=(k+0.5)/n;out.push([pts[k],pts[k+1],!!(t.crawl&&f>t.crawl[0]&&f<t.crawl[1])])}
  return out;
}
const TUN_MAT=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide});
function tunnelMesh(t){   // a rough arched cave along the path: rings of 9 points, jittered, lower through a crawlspace
  const S=townSamples(t),n=S.length+1,R=TW.TUN_R,H=TW.TUN_H,NR=9,pos=[],col=[],idx=[];
  const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7+t.id*74.7)*43758.5453;return v-Math.floor(v)};
  for(let k=0;k<n;k++){
    const p=k<S.length?S[k][0]:S[S.length-1][1],q=S[Math.min(k,S.length-1)],dx=q[1][0]-q[0][0],dz=q[1][1]-q[0][1],l=Math.hypot(dx,dz)||1;
    const nx=-dz/l,nz=dx/l,f=k/(n-1),cr=t.crawl?Math.max(0,1-Math.max(0,Math.max(t.crawl[0]-f,f-t.crawl[1]))*30):0,h=H*(1-0.52*Math.min(1,cr));
    for(let j=0;j<NR;j++){
      const a=Math.PI*j/(NR-1),end=j===0||j===NR-1,w=R*(1.06+(end?0:(hash(k,j)-0.5)*0.35)),v=end?-0.05:Math.pow(Math.sin(a),0.6)*h*(1+(hash(j,k)-0.5)*0.18);
      pos.push(tx(p[0])+nx*Math.cos(a)*w,TW.Y+v,tz(p[1])+nz*Math.cos(a)*w);
      const c=0.34+hash(k*3,j)*0.1+(v>h*0.8?-0.05:0);col.push(c*1.25,c*0.95,c*0.7);
    }
  }
  for(let k=0;k<n-1;k++)for(let j=0;j<NR-1;j++){const a=k*NR+j,b=a+NR;idx.push(a,b,a+1,a+1,b,b+1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new T.Mesh(g,TUN_MAT);m.receiveShadow=true;return m;
}

/* ---- building it ---- */
let TOWN_COLS=null;
function townCols(){if(!TOWN_COLS)TOWN_COLS=fetch('data/TownColliders.json').then(r=>r.json());return TOWN_COLS}
function buildTown(){
  const L=townLay();
  if(townGroup){scene.remove(townGroup);townGroup.traverse(o=>{if(o.geometry&&o.userData.own)o.geometry.dispose()})}   // Blender pieces share cached geometry: only free our own
  const grp=townGroup=new T.Group();grp.visible=!!S.inTown;scene.add(grp);TLOOTM.clear();
  const own=m=>{m.userData.own=true;grp.add(m);return m};
  const ground=own(new T.Mesh(new T.PlaneGeometry(150,130),new T.MeshStandardMaterial({color:0x3a2c1e,roughness:1})));ground.rotation.x=-Math.PI/2;ground.position.set(tx(0),TW.Y-0.01,tz(0));
  for(const t of L.tunnels)own(tunnelMesh(t));
  for(const Lt of L.loot){if(TGOT.has(Lt.id))continue;const m=itemMesh(Lt.type);m.scale.multiplyScalar(1.6);m.position.set(tx(Lt.x),TW.Y+0.25,tz(Lt.z));grp.add(m);TLOOTM.set(Lt.id,{L:{...Lt,x:tx(Lt.x),z:tz(Lt.z)},m})}
  for(const[k,b]of BREACH)shaftMark(k,b);
  const P_={},put=(name,x,z,ry)=>(P_[name]=P_[name]||[]).push({x:tx(x),y:TW.Y,z:tz(z),ry:ry||0});
  put('TownStreet',0,0,0);
  for(const b of L.bldgs){
    put('TownBldg_'+b.key,b.x,b.z,b.ry);
    for(const side of['N','S','E','W']){if(b.doors[side])continue;const D=SIM.townDoor(b,side);put('TownDoorPlug',D.x,D.z,Math.atan2(-D.nx,-D.nz))}
  }
  if(!L.tunnels.some(t=>t.edge===TOWN_STREET_EDGE))put('TownMouthPlug',TW.STREET.x1+0.4,0,-Math.PI/2);
  for(const t of L.tunnels){   // timber sets every 3 m (not in the crawlspace: that part came down), debris now and then
    const S=townSamples(t);let acc=1.5;
    S.forEach(([a,b,crawl],k)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]);acc+=l;
      if(k<3||k>S.length-4)return;
      if(acc>=3&&!crawl){acc=0;put('TownShoring',a[0],a[1],Math.atan2(-(b[0]-a[0]),-(b[1]-a[1])))}
      const h=Math.abs(Math.sin(k*12.9898+t.id*78.233)*43758.5)%1;
      if(h<0.07){const s=h<0.035?1:-1,nx=-(b[1]-a[1])/l,nz=(b[0]-a[0])/l;put('TownJunk'+'ABC'[k%3],a[0]+nx*0.75*s,a[1]+nz*0.75*s,k)}
    });
  }
  // the models and the floor load separately, so a missing colliders file can't leave you in a black void
  Promise.all(Object.entries(P_).map(([n,pl])=>instanceModel(n,pl,grp))).catch(e=>console.warn('town',e&&e.message));
  townCols().then(J=>{if(grp===townGroup)townWalkBuild(L,J)})
    .catch(e=>{console.warn('town colliders',e&&e.message);if(grp===townGroup)townWalkBuild(L,{cols:{}})});
}
const TOWN_STREET_EDGE=SIM.TOWN_EDGES.findIndex(e=>e[0]==='street');
function shaftPos(b){const L=townLay(),p=SIM.townBreachSpot(b.x,b.z,L);return{x:tx(p[0]),z:tz(p[1])}}
function shaftMark(k,b){
  if(!townGroup)return;const p=shaftPos(b);
  const s=new T.Mesh(new T.CylinderGeometry(0.9,0.9,TW.H,10,1,true),new T.MeshBasicMaterial({color:0xfff0cc,transparent:true,opacity:0.16,depthWrite:false,side:T.DoubleSide}));
  s.position.set(p.x,TW.Y+TW.H/2,p.z);s.name='shaft'+k;s.userData.own=true;townGroup.add(s);
  if(b.ladder){const l=box(0.5,TW.H,0.08,0x8a6440);l.position.set(p.x+0.7,TW.Y+TW.H/2,p.z);townGroup.add(l)}
}

/* ---- the Warden's note (on her desk: 20-world.js, art/blender/wardennote.py): where to dig. The coordinates are the
   ones the map shows (78-hud.js coordXY); that's the only spot that breaks through, and you land on Main Street by the
   stairwell (sim.js townBreaks, townBreachSpot). ---- */
function readWardenNote(){
  const[X,Y]=coordXY(SIM.OLD_TOWN.x,SIM.OLD_TOWN.z);
  toast(`The Warden's ledgers, and a note in her hand: "OLD TOWN. X ${X}, Y ${Y}. Dig 5 ft. Floor gives. Don't tell Mr. Sir." (Your coordinates are above the Field map button.)`,'gold',9000);
  logEv('note',{});
}
/* ---- the old town on the lake: a clue (cracked, darker ground and old timbers poking out) ---- */
{
  const O=SIM.OLD_TOWN,g=new T.Group();scene.add(g);
  for(let i=0;i<26;i++){const a=i*2.399,d=Math.sqrt((i+0.5)/26)*O.r*0.9,x=O.x+Math.cos(a)*d,z=O.z+Math.sin(a)*d,h=0.4+((i*37)%10)/12;
    const t=box(0.25,h,0.25,0x5a4630);t.position.set(x,baseH(x,z)+h/2-0.1,z);t.rotation.set((i%5-2)*0.15,a,(i%3-1)*0.2);g.add(t)}
  const sign=box(1.4,0.5,0.08,0x7a5a3c);sign.position.set(O.x+O.r*0.6,baseH(O.x+O.r*0.6,O.z)+0.9,O.z);sign.rotation.z=0.35;g.add(sign);
}

/* ---- breaking through ---- */
function townCheckBreach(h){
  if(h.d<SIM.TOWN_BREAK_DEPTH||h.breachTried||!h.own||(typeof ZONE_H!=='undefined'&&ZONE_H))return;h.breachTried=true;
  if(!SIM.townBreaks(h.x,h.z,RUN.day||1))return;
  const k=h.x+'|'+h.z;
  if(online())wsSend({t:'breach',x:h.x,z:h.z});else addBreach(k,{x:h.x,z:h.z,at:Date.now(),ladder:false});
}
function addBreach(k,b){
  const had=BREACH.get(k);BREACH.set(k,b);
  if(townGroup){const old=townGroup.getObjectByName('shaft'+k);if(old)townGroup.remove(old);shaftMark(k,b)}
  if(had)return;
  const d=new T.Mesh(new T.CircleGeometry(0.8,16),new T.MeshBasicMaterial({color:0x050403}));d.rotation.x=-Math.PI/2;d.position.set(b.x,groundAt(b.x,b.z)+0.03,b.z);scene.add(d);breachDisc.set(k,d);
  if(Math.hypot(P.x-b.x,P.z-b.z)<20&&!S.inTown){sfx.thud();noise(1.2,120,0.7,0.5,'lowpass');
    toast('The bottom of the hole gave way. There\'s a dark street down there: the buried town. Press F by the hole to climb down.','gold',7000)}
}
function breachNear(r){for(const[k,b]of BREACH)if(Math.hypot(P.x-b.x,P.z-b.z)<r)return{k,b};return null}

/* ---- in and out ---- */
function enterTown(k){
  const b=BREACH.get(k);if(!b||S.ko)return;
  if(!townGroup)buildTown();
  const p=shaftPos(b);S.inTown=true;S.townBreach=k;P.x=p.x;P.z=p.z;P.y=TW.Y;P.vy=0;
  if(typeof releaseGrab==='function'){releaseGrab(false);untieRope(false)}S.carry=null;
  townGroup.visible=true;townRoom=null;camera.far=70;camera.updateProjectionMatrix();
  hurt(4,'Fall','You dropped into the buried town.');sfx.thud();logEv('townIn',{k});
  toast('You drop into the dark: the buried town of Green Lake. Grab what you can. To get out, press F under the shaft you came down, or at the collapsed stairwell at the end of Main Street.','gold',9000);
}
function exitTown(x,z,why){
  S.inTown=false;S.townBreach=null;if(townGroup)townGroup.visible=false;
  P.x=x;P.z=z;P.y=groundAt(x,z);P.vy=0;townRoom=null;camera.far=3000;camera.updateProjectionMatrix();
  streamChunks(P.x,P.z,999);farU.uFocus.value.set(P.x,P.z);logEv('townOut',{why});
  if(why)toast(why,'good',3500);
}
/* who can help you up a shaft or a well: a staked ladder, a friend down here crouching next to you, or a hand from the top */
function climbHelp(b){
  if(b)return'your own two hands';   // JT: much easier for now -- the shaft you came down you can climb back up alone (wells still need a boost)
  if(b&&b.ladder)return'the rope ladder';
  for(const R of remotes.values()){const g=R.p.g.position;if(g.x>TW.X-60&&(R.f&8)&&!(R.f&2)&&Math.hypot(g.x-P.x,g.z-P.z)<2.6)return R.name+' boosting you'}
  if(b)for(const R of remotes.values()){const g=R.p.g.position;if((R.f&256)&&Math.hypot(g.x-b.x,g.z-b.z)<3.6)return R.name+'\'s hand'}
  return null;
}
function townSpot(){
  if(!S.inTown)return null;const L=townLay();
  for(const e of TLOOTM.values())if(Math.hypot(P.x-e.L.x,P.z-e.L.z)<2)return{id:'townLoot',e};
  for(const[k,b]of BREACH){const p=shaftPos(b);if(Math.hypot(P.x-p.x,P.z-p.z)<1.8)return{id:'townShaft',k,b}}
  const w=L.bldgs[L.well];if(Math.hypot(P.x-tx(w.x),P.z-tz(w.z))<2.2)return{id:'townWell',i:w.i};
  if(Math.hypot(P.x-tx(L.stair.x),P.z-tz(L.stair.z))<3.2)return{id:'townStair'};
  return null;
}
function townUse(s){
  if(s.id==='townDown'){enterTown(s.k);return true}
  if(s.id==='townLoot'){townTake(s.e);return true}
  if(s.id==='townStair'){const O=SIM.OLD_TOWN;exitTown(O.x+4,O.z+3,'You climb the broken stairwell and come out by the hole in the old town.');return true}
  if(s.id==='townShaft'||s.id==='townWell'){
    const help=climbHelp(s.id==='townShaft'?s.b:null);
    if(!help){
      if(s.id==='townShaft'&&S.up.rope){S.up.rope=false;if(online())wsSend({t:'ladder',k:s.k});else{s.b.ladder=true;addBreach(s.k,s.b)}toast('You stake your rope ladder in the shaft. Now anyone can climb it alone.','good',4000);sfx.clank();return true}
      toast(s.id==='townWell'?'The well is too high to climb alone. A friend down here has to crouch (C) next to you and boost you.':'Too high to climb alone. A friend down here can crouch (C) and boost you, someone up top can hold F at the hole, or stake a rope ladder (Supply Depot).','bad',5000);return true}
    if(!spendStam(20)){toast('Too tired to climb. Catch your breath first.','bad',2500);return true}
    if(s.id==='townWell'){const a=s.i*2.39;exitTown(Math.cos(a)*250,Math.sin(a)*250-60,`You climb up the old well (${help}) and come out somewhere on the lake.`);return true}
    exitTown(s.b.x+1.8,s.b.z,`You climb out (${help}).`);countUp('helps',10,'ladder');return true;
  }
  return false;
}
function townTake(e){
  if(S.sack.length>=sackMax()){toast(`Your sack is full (${sackMax()} items).`,'bad',2500);return}
  townGone(e.L.id);if(online())wsSend({t:'tgot',id:e.L.id});
  S.sack.push(e.L.type);sfx.find();addXP(4+LOOT[e.L.type].val/4);
  toast(`Found: ${LOOT[e.L.type].name} (worth ${LOOT[e.L.type].val} seeds).`,'good',3000);logEv('townLoot',{type:e.L.type});
}
function townGone(id){const e=TLOOTM.get(id);if(e){if(townGroup)townGroup.remove(e.m);TLOOTM.delete(id)}TGOT.add(id)}

/* ---- moving around down there (like the tent rooms: its own little movement update) ---- */
function updatePlayerTown(dt){
  let ix=(KEYS['d']||KEYS['arrowright']?1:0)-(KEYS['a']||KEYS['arrowleft']?1:0),iz=(KEYS['w']||KEYS['arrowup']?1:0)-(KEYS['s']||KEYS['arrowdown']?1:0);
  if(touch.id!==null){ix=touch.ix;iz=touch.iz}
  if(uiOpen()){ix=0;iz=0}
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);
  let mx=fx*iz+rx*ix,mz=fz*iz+rz*ix;const ml=Math.hypot(mx,mz);
  const sprint=KEYS['shift']&&S.stam>2&&!P.crouch;
  P.moving=false;P.anim=0;
  if(ml>0.1){
    mx/=Math.max(1,ml);mz/=Math.max(1,ml);const sp=(P.crouch?2:sprint?6.5:4.3)*Math.min(1,ml);
    let nx=P.x+mx*sp*dt,nz=P.z+mz*sp*dt;
    if(!townWalk(nx,nz,P.crouch)){if(townWalk(nx,P.z,P.crouch))nz=P.z;else if(townWalk(P.x,nz,P.crouch))nx=P.x;else{nx=P.x;nz=P.z}}   // slide along walls and furniture
    P.x=nx;P.z=nz;P.fa=FP?Math.atan2(fx,fz):Math.atan2(mx,mz);P.moving=true;P.anim=sprint?4:1;if(sprint)drainStam(tune('stam.sprint')*dt);
  }
  P.y=TW.Y;P.vy=0;P.grounded=true;
  me.g.position.set(P.x,P.y,P.z);me.g.scale.y=lerp(me.g.scale.y,P.crouch?0.7:1,Math.min(1,dt*10));
  let dr=P.fa-me.g.rotation.y;dr=Math.atan2(Math.sin(dr),Math.cos(dr));me.g.rotation.y+=dr*Math.min(1,dt*14);
  animPerson(me,P.anim,dt,P.digPh);
  // a name when you walk into a new place
  const w=townWhere(P.x,P.z,true),nm=w?w.name:null;
  if(nm&&nm!==townRoom){townRoom=nm;const b=w.b;
    if(nm==='crawl')toast('The roof came down here. Crouch (C) to crawl through.','',2400);
    else if(nm!=='tunnel')toast(nm+(b&&b.key==='vault'?'. Gold glints in the dark.':b&&b.key==='well'?'. Daylight, far up the shaft.':nm==='Main Street'?'. The old town\'s street, buried under the lake.':''),'',2400)}
}
/* the third-person camera down here: pulled in toward you so it never ends up in the earth or furniture */
function townCamPull(cx,cz){
  let t=1;const dx=cx-P.x,dz=cz-P.z;
  for(let k=1;k<=12;k++){const f=k/12;if(!townWhere(P.x+dx*f,P.z+dz*f,true)){t=Math.max(0.12,(k-1)/12);break}}
  return[P.x+dx*t,P.z+dz*t];
}
/* every frame, after the sky: it's dark down there */
function updateTown(dt){
  if(S.inTown){scene.fog.color.setRGB(0.02,0.015,0.01);scene.fog.near=2;scene.fog.far=S.light?tune('light.townSee'):12;sun.intensity=0.04;hemi.intensity=S.light?0.1:0.05}   // no daylight down here (the day/night code eases it back once you're out)
  S.handDown=!S.inTown&&!S.ko&&KEYS['f']&&(!!breachNear(3.6)&&holeDepthHere()<1.2||northClimb(P.x,P.z));   // (or on the north wall: a hand down to a friend on the ledge below, 88-north.js)   // on the rim (not down in the hole), holding F   // lowering a hand to a friend climbing a shaft (their climbHelp sees flag 256)
}

/* ---- network ---- */
function townMsg(m){
  if(m.t==='breach'){const k=String(m.k||'');if(k)addBreach(k,{x:num(m.x,-600,600,0),z:num(m.z,-600,600,0),at:m.at||0,ladder:m.ladder===true})}
  else if(m.t==='tgot')townGone(num(m.id,0,999,-1)|0);
}
function townHello(m){
  if(m.breaches&&typeof m.breaches==='object')for(const k of Object.keys(m.breaches).slice(0,200)){const b=m.breaches[k];if(b)addBreach(k,{x:num(b.x,-600,600,0),z:num(b.z,-600,600,0),at:b.at||0,ladder:b.ladder===true})}
  if(Array.isArray(m.tgot)){townLay();for(const id of m.tgot.slice(0,999))townGone(num(id,0,999,-1)|0)}
}

command('town',{usage:'town [in|out]',help:'Buried town: break through right where you stand and drop in, or climb straight out (testing).',
  run([a]){a=(a||'in').toLowerCase();
    if(a==='out'){if(!S.inTown)return'Not in the town.';const O=SIM.OLD_TOWN;exitTown(O.x+4,O.z+3,'');return'Back on the lake.'}
    if(S.inTown)return'Already down there.';
    const x=r1(P.x),z=r1(P.z),k=x+'|'+z;addBreach(k,{x,z,at:Date.now(),ladder:false});enterTown(k);return'Dropped into the buried town.'}});
