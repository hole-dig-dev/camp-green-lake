'use strict';
/* public/js/89-town.js -- the buried town of Green Lake: the framework (after Greg's branch, claude/intense-change-1-test-2026-09-27-1829).
   Rules and layout are in public/sim.js (TOWN, townLayout): a 6 x 6 maze of dark rooms, new every day, deep under the lake
   (it's built off the lake map at x 2000, the way the tent rooms sit underground, so nothing on the lake reaches you).
   Getting in:  dig an 8 ft hole (long shovel) inside the old town (SIM.OLD_TOWN, the cracked ground with old timbers
                sticking out), or with some luck anywhere else. The floor gives way: stand in the hole and press F.
   Down there:  it's dark (bring the flashlight), doorways join the rooms, 1 in 5 is a crawlspace (crouch, C). Finds lie
                around (F picks them up); Kate's vault has gold bars. Everyone who breaks through shares the same town.
   Getting out: climb a shaft (F under it) or an old well. You can't alone: a friend down here crouching next to you boosts
                you, someone up top holding F at the hole lowers a hand, or you stake your rope ladder in it for good.
                The collapsed stairwell you can just walk out of; it comes up at the edge of the old town.
   Not yet (framework): the lizard queen and Trout Walker's mob, rotten floors and flooded cellars (marked, not live),
   heavy loot down here, a town minimap. */
let TLAY=null,TLAY_DAY=-1,townGroup=null,townRoom=-1;
const TOWNCOL=[],TLOOTM=new Map(),TGOT=new Set(),BREACH=new Map(),breachDisc=new Map();
const TW=SIM.TOWN;
function townLay(){const d=RUN.day||1;if(TLAY_DAY!==d){TLAY_DAY=d;TLAY=SIM.townLayout(d);TGOT.clear();if(townGroup)buildTown()}return TLAY}
function townFloorAt(){return TW.Y}

/* ---- the rooms ---- */
function buildTown(){
  const L=townLay();
  if(townGroup){scene.remove(townGroup);townGroup.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
  townGroup=new T.Group();townGroup.visible=!!S.inTown;scene.add(townGroup);TOWNCOL.length=0;TLOOTM.clear();
  const N=TW.N,C=TW.C,H=TW.H,x0=TW.X-N*C/2,z0=TW.Z-N*C/2,th=0.4;
  const add=(w,h,d,col,x,y,z)=>{const m=box(w,h,d,col);m.castShadow=false;m.receiveShadow=true;m.position.set(x,y,z);townGroup.add(m);return m};
  const wall=(x,z,w,d,col,crawl)=>{if(crawl)add(w,H-1.1,d,col,x,TW.Y+1.1+(H-1.1)/2,z);else add(w,H,d,col,x,TW.Y+H/2,z);TOWNCOL.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,crawl:!!crawl})};
  const seg=(x,z,alongX,kind,col)=>{   // one side of a room: solid, a doorway, or a crawlspace
    const gap=2.4,Lg=(C-gap)/2;
    if(kind===0){alongX?wall(x,z,C,th,col):wall(x,z,th,C,col);return}
    for(const s of[-1,1]){const o=s*(gap/2+Lg/2);alongX?wall(x+o,z,Lg,th,col):wall(x,z+o,th,Lg,col)}
    if(kind===2)alongX?wall(x,z,gap,th,col,true):wall(x,z,th,gap,col,true);
  };
  for(const c of L.cells){
    const cx=c.i%N,cz=Math.floor(c.i/N),mx=x0+cx*C+C/2,mz=z0+cz*C+C/2,col=[0x6a4e38,0x5e4c3a,0x4e3c2c][c.i%3];
    add(C,0.2,C,c.flood?0x2e3a38:0x3f2e20,mx,TW.Y-0.1,mz);
    add(C,0.3,C,0x1e1610,mx,TW.Y+H+0.15,mz);
    for(let k=0;k<3;k++)add(0.25,0.25,C,0x2e2218,mx-C/2+2+k*(C-4)/2,TW.Y+H-0.1,mz);   // ceiling beams
    if(c.flood){const w=new T.Mesh(new T.BoxGeometry(C-0.4,0.05,C-0.4),new T.MeshBasicMaterial({color:0x1d3f4a,transparent:true,opacity:0.5,depthWrite:false}));w.position.set(mx,TW.Y+0.3,mz);townGroup.add(w)}
    if(c.rot)add(5,0.06,5,0x8a6a42,mx,TW.Y+0.02,mz);
    if(c.well){const w=cyl(1.1,1.1,0.9,10,0x6f6860);w.position.set(mx,TW.Y+0.45,mz);townGroup.add(w)}
    if(c.stair)for(let k=0;k<5;k++)add(3,0.4*(k+1),1.2,0x5e4c3a,mx,TW.Y+0.2*(k+1),mz-2+k*1.2);
    if(c.vault){add(2,1.2,0.3,0xd4af37,mx,TW.Y+0.6,mz-C/2+0.6);add(3.2,2.4,0.2,0x3b3f45,mx,TW.Y+1.2,mz-C/2+0.35)}
    if(cx<N-1)seg(x0+(cx+1)*C,mz,false,c.e,col);
    if(cz<N-1)seg(mx,z0+(cz+1)*C,true,c.s,col);
    // a bit of the old town in each room: a table or a crate or two
    const r=((c.i*2654435761)>>>0)/4294967296;
    if(!c.stair&&!c.well){add(1.6,0.8,0.9,0x5a4028,mx+(r-0.5)*6,TW.Y+0.4,mz+((r*7)%1-0.5)*6);if(r>0.5)add(0.9,0.9,0.9,0x6b4e30,mx-(r-0.3)*5,TW.Y+0.45,mz+3)}
    for(const Lt of c.loot){if(TGOT.has(Lt.id))continue;const m=itemMesh(Lt.type);m.scale.multiplyScalar(1.6);m.position.set(Lt.x,TW.Y+0.25,Lt.z);townGroup.add(m);TLOOTM.set(Lt.id,{L:Lt,m})}
  }
  const ow=0x3a2c20;wall(TW.X,z0,N*C,th,ow);wall(TW.X,z0+N*C,N*C,th,ow);wall(x0,TW.Z,th,N*C,ow);wall(x0+N*C,TW.Z,th,N*C,ow);
  for(const[k,b]of BREACH)shaftMark(k,b);
}
function shaftPos(b){const L=townLay(),i=SIM.townBreachCell(b.x,b.z,L),cc=SIM.townCellCenter(i);return{x:cc.x+2,z:cc.z+2,i}}
function shaftMark(k,b){
  if(!townGroup)return;const p=shaftPos(b);
  const s=new T.Mesh(new T.CylinderGeometry(0.9,0.9,TW.H,10,1,true),new T.MeshBasicMaterial({color:0xfff0cc,transparent:true,opacity:0.16,depthWrite:false,side:T.DoubleSide}));
  s.position.set(p.x,TW.Y+TW.H/2,p.z);s.name='shaft'+k;townGroup.add(s);
  if(b.ladder){const l=box(0.5,TW.H,0.08,0x8a6440);l.position.set(p.x+0.7,TW.Y+TW.H/2,p.z);townGroup.add(l)}
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
  if(h.d<2.4||h.breachTried||!h.own||(typeof ZONE_H!=='undefined'&&ZONE_H))return;h.breachTried=true;
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
    toast('The bottom of the hole gave way. There\'s a dark room down there: the buried town. Stand in the hole and press F to climb down.','gold',7000)}
}
function breachNear(r){for(const[k,b]of BREACH)if(Math.hypot(P.x-b.x,P.z-b.z)<r)return{k,b};return null}

/* ---- in and out ---- */
function enterTown(k){
  const b=BREACH.get(k);if(!b||S.ko)return;
  if(!townGroup)buildTown();
  const p=shaftPos(b);S.inTown=true;S.townBreach=k;P.x=p.x;P.z=p.z;P.y=TW.Y;P.vy=0;
  if(typeof releaseGrab==='function'){releaseGrab(false);untieRope(false)}S.carry=null;
  townGroup.visible=true;townRoom=-1;camera.far=70;camera.updateProjectionMatrix();
  hurt(4,'Fall','You dropped into the buried town.');sfx.thud();logEv('townIn',{k});
  toast('You drop into the dark: the buried town of Green Lake. Grab what you can, then find a way out. A shaft or a well needs help to climb (a friend boosting you, a hand from up top, or a staked rope ladder). The collapsed stairwell you can walk out of.','gold',9000);
}
function exitTown(x,z,why){
  S.inTown=false;S.townBreach=null;if(townGroup)townGroup.visible=false;
  P.x=x;P.z=z;P.y=groundAt(x,z);P.vy=0;townRoom=-1;camera.far=3000;camera.updateProjectionMatrix();
  streamChunks(P.x,P.z,999);farU.uFocus.value.set(P.x,P.z);logEv('townOut',{why});
  if(why)toast(why,'good',3500);
}
/* who can help you up a shaft or a well: a staked ladder, a friend down here crouching next to you, or a hand from the top */
function climbHelp(b){
  if(b&&b.ladder)return'the rope ladder';
  for(const R of remotes.values()){const g=R.p.g.position;if(g.x>TW.X-60&&(R.f&8)&&!(R.f&2)&&Math.hypot(g.x-P.x,g.z-P.z)<2.6)return R.name+' boosting you'}
  if(b)for(const R of remotes.values()){const g=R.p.g.position;if((R.f&256)&&Math.hypot(g.x-b.x,g.z-b.z)<3.6)return R.name+'\'s hand'}
  return null;
}
function townSpot(){
  if(!S.inTown)return null;const L=townLay(),i=SIM.townCellAt(P.x,P.z);if(i<0)return null;const c=L.cells[i],cc=SIM.townCellCenter(i);
  for(const e of TLOOTM.values())if(Math.hypot(P.x-e.L.x,P.z-e.L.z)<1.6)return{id:'townLoot',e};
  for(const[k,b]of BREACH){const p=shaftPos(b);if(Math.hypot(P.x-p.x,P.z-p.z)<1.8)return{id:'townShaft',k,b}}
  if(c.well&&Math.hypot(P.x-cc.x,P.z-cc.z)<2)return{id:'townWell',i};
  if(c.stair&&Math.hypot(P.x-cc.x,P.z-cc.z)<3.2)return{id:'townStair',i};
  return null;
}
function townUse(s){
  if(s.id==='townDown'){enterTown(s.k);return true}
  if(s.id==='townLoot'){townTake(s.e);return true}
  if(s.id==='townStair'){const O=SIM.OLD_TOWN;exitTown(O.x+O.r+4,O.z,'You climb the broken stairwell and come out at the edge of the old town.');return true}
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
    for(const c of TOWNCOL){if(c.crawl&&P.crouch)continue;if(nx>c.x0-0.3&&nx<c.x1+0.3&&nz>c.z0-0.3&&nz<c.z1+0.3){const px=Math.min(nx-(c.x0-0.3),(c.x1+0.3)-nx),pz=Math.min(nz-(c.z0-0.3),(c.z1+0.3)-nz);if(px<pz)nx=nx<(c.x0+c.x1)/2?c.x0-0.3:c.x1+0.3;else nz=nz<(c.z0+c.z1)/2?c.z0-0.3:c.z1+0.3}}
    P.x=nx;P.z=nz;P.fa=FP?Math.atan2(fx,fz):Math.atan2(mx,mz);P.moving=true;P.anim=sprint?4:1;if(sprint)drainStam(tune('stam.sprint')*dt);
  }
  P.y=TW.Y;P.vy=0;P.grounded=true;
  me.g.position.set(P.x,P.y,P.z);me.g.scale.y=lerp(me.g.scale.y,P.crouch?0.7:1,Math.min(1,dt*10));
  let dr=P.fa-me.g.rotation.y;dr=Math.atan2(Math.sin(dr),Math.cos(dr));me.g.rotation.y+=dr*Math.min(1,dt*14);
  animPerson(me,P.anim,dt,P.digPh);
  // a room name when you walk into a new one
  const i=SIM.townCellAt(P.x,P.z);if(i>=0&&i!==townRoom){townRoom=i;const c=townLay().cells[i];toast(c.name+(c.vault?'. Gold glints in the dark.':c.flood?'. The floor is wet.':c.rot?'. The boards creak under you.':''),'',2200)}
}
/* every frame, after the sky: it's dark down there */
function updateTown(dt){
  if(S.inTown){scene.fog.color.setRGB(0.02,0.015,0.01);scene.fog.near=2;scene.fog.far=S.light?26:12;sun.intensity=0.04;hemi.intensity=S.light?0.1:0.05}   // no daylight down here (the day/night code eases it back once you're out)
  S.handDown=!S.inTown&&!S.ko&&KEYS['f']&&!!breachNear(3.6)&&holeDepthHere()<1.2;   // on the rim (not down in the hole), holding F   // lowering a hand to a friend climbing a shaft (their climbHelp sees flag 256)
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
    if(a==='out'){if(!S.inTown)return'Not in the town.';const O=SIM.OLD_TOWN;exitTown(O.x+O.r+4,O.z,'');return'Back on the lake.'}
    if(S.inTown)return'Already down there.';
    const x=r1(P.x),z=r1(P.z),k=x+'|'+z;addBreach(k,{x,z,at:Date.now(),ladder:false});enterTown(k);return'Dropped into the buried town.'}});
