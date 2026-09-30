'use strict';
/* public/js/88-zones.js -- Peak-style maps ("zones"): the escape across the lake to Big Thumb, one map at a time.

   How it fits the rest of the game:
   - The whole crew is always in ONE map (the server decides: world.zone in server.js), so monsters, hazards, voice and
     networking don't know or care. They just run on whichever map is loaded, and anything added to the lake later
     (a new mob, a new hazard) shows up in every map too.
   - The lake ('lake') is the game exactly as it was. Another map registers itself in ZONES (89-zone-canyon.js is the
     first) and swaps into the same ±600 m square: its ground replaces the lake's (ZONE_H in 10-core.js), the camp is
     parked out of the scene, and the lake's holes and buried loot are set aside until the crew comes back.
   - Keep a map's playable ground away from the camp fence box (x -40..30, z 27..56): sim.js still treats that box
     as camp (police and monsters stay out, campers inside are safe).
   - Only one map is ever built, so leaving one frees its meshes (Peak does the same: the old biome is gone).

   A map entry (all optional except height):
     name, blurb           title card text
     height(x,z)           ground height, replaces baseH
     tint(col,x,z,b,tone)  recolours a ground vertex (col is a THREE.Color already set to plain sand)
     map(ctx,night)        paints the 1024 px minimap cache (use ccx/ccz/ccs from 78-hud.js)
     arrive:{x,z,yaw}      where the crew starts
     fire:{x,z,r}          the campfire: everyone standing here opens the next map
     ropes:[{x,z,a,len,flag,label}]  a rope anchor at the top of a drop (x,z), facing down the drop along angle a;
                           once someone drops it (F), anyone can climb the len m below it
     build(group)          adds the map's meshes to group; may return a per-frame update(dt)
     items(rnd)            buried loot for the day: [{type,x,z,depth}] (same for everyone: rnd is seeded by map + day)
     solids:[[x,z,w,d]]    box colliders, like solid() in 20-world.js
*/
const ZONES={lake:{id:'lake',name:'Camp Green Lake'}};
const ZONE_ORDER=['lake','canyon'];   // the escape route, in order; server.js has the same list
let ZONE=ZONES.lake;
const ZSTORE={};                      // per map: its holes and buried loot while the crew is somewhere else
const ZONE_FLAGS={};                  // things in this map that changed for everyone (rope0: the first rope is down)
let zoneGroup=null,zoneTick=null,zoneSolids=[],zoneSpots=[];
const LEGUP_R=1.3, LEGUP_V=8.2;       // a crouching friend this close gives you a leg-up: jump speed (~2.1 m high, vs ~1 m)
const STEP_LOOK=0.5, STEP_RISE=0.55;  // look this far ahead; ground rising more than this above your feet is a ledge
const ROPE_SLOW=0.35;                 // climbing a rope: this fraction of walking speed
const FALL_SAFE=11, FALL_DMG=7;       // landing faster than this (m/s) hurts, this much health per m/s over
const PARK_C={x:-5,z:41}, PARK_R=80;  // everything built within this radius of the camp is set aside in other maps

/* ---------- climbing: ledges, leg-ups, ropes ---------- */
function ropeAt(x,z){
  if(!ZONE.ropes)return null;
  for(const r of ZONE.ropes){
    if(!ZONE_FLAGS[r.flag])continue;
    const dx=x-r.x,dz=z-r.z,along=dx*Math.sin(r.a)+dz*Math.cos(r.a),across=dx*Math.cos(r.a)-dz*Math.sin(r.a);
    if(along>-1.2&&along<r.len+1&&Math.abs(across)<1)return r;
  }
  return null;
}
let ledgeHitT=0;
function zoneBlocked(x0,z0,x,z,y){
  const dx=x-x0,dz=z-z0,d=Math.hypot(dx,dz);if(d<1e-6)return false;
  const lx=x0+dx/d*STEP_LOOK,lz=z0+dz/d*STEP_LOOK;
  if(ropeAt(lx,lz)||ropeAt(x,z))return false;
  return groundAt(lx,lz)-y>STEP_RISE||groundAt(x,z)-y>STEP_RISE;
}
/* called from updatePlayer (70-player.js) with the move it wants: returns the move it gets */
function zoneStep(x0,z0,x1,z1,y){
  if(!zoneBlocked(x0,z0,x1,z1,y)){
    if(ropeAt(x1,z1)&&groundAt(x1,z1)>y+0.05)return[x0+(x1-x0)*tuneOr('zone.ropeSlow',ROPE_SLOW),z0+(z1-z0)*tuneOr('zone.ropeSlow',ROPE_SLOW)];   // hand over hand
    return[x1,z1];
  }
  ledgeHitT=0.4;
  if(!zoneBlocked(x0,z0,x1,z0,y))return[x1,z0];   // slide along the ledge instead of sticking to it
  if(!zoneBlocked(x0,z0,x0,z1,y))return[x0,z1];
  return[x0,z0];
}
/* called from updatePlayer when you jump */
function zoneJumpV(){
  for(const R of remotes.values())if((R.f&8)&&Math.hypot(R.tx-P.x,R.tz-P.z)<LEGUP_R&&Math.abs(R.ty-P.y)<0.9){
    logEv('legup',{from:R.name});if(!zoneJumpV.told){zoneJumpV.told=true;toast(`${R.name} gave you a leg-up!`,'good',1800)}
    return tuneOr('zone.legup',LEGUP_V);
  }
  return 5.6;
}

/* ---------- parking the camp while the crew is in another map ---------- */
const PARKED=[],PARKED_LABELS=[];
function keepInScene(o){
  if(o===zoneGroup||o===camera||o===sun||o===sun.target||o===hemi||o===sky||o===stars||(me&&o===me.g))return true;   // me: null until Start
  if(o.frustumCulled===false)return true;   // pools (particles, hole liners, clods, rain) follow you around
  if(o.isDirectionalLight||o.isHemisphereLight||o.isAmbientLight)return true;
  for(const R of remotes.values())if(R.p.g===o)return true;
  for(const s of FL)if(s===o||s.target===o)return true;
  for(const p of PINGS)if(p.g===o||p.beam===o)return true;
  for(const p of pops)if(p.m===o)return true;
  return false;
}
const _pb=new T.Box3(),_pc=new T.Vector3();
function nearCampThing(o){
  _pb.setFromObject(o);const c=_pb.isEmpty()?o.position:_pb.getCenter(_pc);
  return Math.hypot(c.x-PARK_C.x,c.z-PARK_C.z)<PARK_R;
}
function park(o){if(!o||!o.parent)return;o.parent.remove(o);PARKED.push(o)}
function parkSweep(){for(const o of [...scene.children])if(!keepInScene(o)&&nearCampThing(o))park(o)}
function parkLake(on){
  if(on){
    park(FAR_TERRAIN);
    for(const b of bots)park(b.p.g);park(sir.g);park(warden.g);
    for(const r of TERRAIN_ROCKS)park(r.m);
    parkSweep();
    const set=new Set(PARKED);
    for(let i=labeled.length-1;i>=0;i--){const L=labeled[i];if(set.has(L.obj)){labeled.splice(i,1);L.el.style.display='none';PARKED_LABELS.push(L)}}
  }else{
    for(const o of PARKED.splice(0))scene.add(o);
    for(const L of PARKED_LABELS.splice(0))labeled.push(L);
  }
}

/* ---------- building and dropping a map ---------- */
function zoneFarMesh(Z){
  // the map's own coarse far ground (the lake's is parked), cut away wherever the detailed chunks are, same as 15-terrain.js
  const FR=6,FN=Math.round(HALF*2/FR),g=new T.PlaneGeometry(HALF*2,HALF*2,FN,FN);g.rotateX(-Math.PI/2);
  const p=g.attributes.position,col=new Float32Array(p.count*3),c=new T.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),b=Z.height(x,z);p.setY(i,b-0.08);c.copy(C_SAND).lerp(C_SAND2,vnoise(x*0.03,z*0.03));if(Z.tint)Z.tint(c,x,z,b,0);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b}
  g.setAttribute('color',new T.BufferAttribute(col,3));g.computeVertexNormals();
  const mat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,metalness:0});mat.userData.own=true;
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,farU);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFarW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFarW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFarW;uniform vec2 uFocus;uniform float uR;').replace('void main() {','void main() {\nif(distance(vFarW.xz,uFocus)<uR)discard;')};
  const m=new T.Mesh(g,mat);m.receiveShadow=true;return m;
}
function buildZone(Z){
  zoneGroup=new T.Group();zoneGroup.name='zone:'+Z.id;scene.add(zoneGroup);
  zoneGroup.add(zoneFarMesh(Z));
  zoneTick=Z.build?Z.build(zoneGroup)||null:null;
  zoneSolids=(Z.solids||[]).map(([x,z,w,d])=>({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2}));colliders.push(...zoneSolids);
  zoneSpots=(Z.ropes||[]).map(r=>({id:'zrope',x:r.x-Math.sin(r.a)*1.2,z:r.z-Math.cos(r.a)*1.2,r:2.2,rope:r,label:r.label||'Drop the rope down',use(){dropRope(r)}}));
}
function dropZone(){
  if(!zoneGroup)return;
  for(const s of zoneSpots){const i=SPOTS.indexOf(s);if(i>=0)SPOTS.splice(i,1)}
  scene.remove(zoneGroup);
  zoneGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:o.material?[o.material]:[];for(const m of ms)if(m.userData&&m.userData.own){if(m.map)m.map.dispose();m.dispose()}});
  for(const c of zoneSolids){const i=colliders.indexOf(c);if(i>=0)colliders.splice(i,1)}
  zoneGroup=null;zoneTick=null;zoneSolids=[];zoneSpots=[];
}
function zoneSeed(id){let h=2166136261;for(const ch of id+'|'+(net.day||1))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0}

/* Move this client into map `id`. flags: that map's shared state from the server (ropes already dropped). */
function zoneEnter(id,flags){
  SIM.setZone(id);if(S.inTown)exitTown(0,39,'');if(typeof releaseGrab==='function'){releaseGrab(false);untieRope(false);S.inCart=null}   // camp box, grabs and ropes don't cross maps
  const Z=ZONES[id];
  if(!Z){console.warn('No map called',id);return false}
  if(Z===ZONE){setZoneFlags(flags);return false}
  if(inTent())exitTent();
  const from=ZONE;
  ZSTORE[from.id]={holes:holes.splice(0),grid:new Map(grid),items:items.splice(0),
    props:[...PROPS.values()].map(p=>[p.id,p.type,p.x,p.z,p.val,p.val0]),bags:[...BAGS.values()].map(b=>[b.id,b.x,b.z,b.items,b.n])};
  grid.clear();
  for(const k of [...PROPS.keys()])removeProp(k);for(const k of [...BAGS.keys()])removeBag(k);
  S.carry=null;
  if(from.id==='lake')parkLake(true);else dropZone();

  ZONE=Z;ZONE_H=Z.height||null;ZONE_TINT=Z.tint||null;ZONE_MAP=Z.map||null;ZONE_STEP=Z.height?1:0;
  const st=ZSTORE[id];delete ZSTORE[id];
  if(st){
    holes.push(...st.holes);for(const[k,v]of st.grid)grid.set(k,v);items.push(...st.items);
    if(!online()){for(const p of st.props)addProp(...p);for(const b of st.bags)addBag(...b)}   // online, the server sends them
  }else if(Z.items){const rnd=mulberry32(zoneSeed(id));Z.items(rnd).forEach((it,i)=>items.push({id:i,type:it.type,x:it.x,z:it.z,depth:it.depth,found:false}))}
  for(const[k,C]of chunks){scene.remove(C.m);C.g.dispose();chunks.delete(k)}   // the old map's ground
  if(id==='lake')parkLake(false);else{buildZone(Z);SPOTS.push(...zoneSpots)}
  setZoneFlags(flags);
  mapCacheNight=null;   // the minimap repaints for this map
  cpOn=false;cpStat=null;cpTold=false;zoneLine('');

  zonePlace(Z);
  logEv('zone',{to:id});
  if(id!=='lake')zoneCard(Z);
  return true;
}
/* put this camper at the map's start, spread out a little from the rest of the crew */
let zonePlaceLater=false;
function zonePlace(Z){
  zonePlaceLater=!S.started;   // still on the title screen: Start (or a saved-session resume) would move us, so do it again then
  const a=Z.arrive||{x:0,z:39,yaw:0},slot=online()?[...remotes.keys(),net.id].sort((p,q)=>p-q).indexOf(net.id):0;
  P.x=a.x+((slot%4)-1.5)*1.6;P.z=a.z+Math.floor(slot/4)*1.6;P.yaw=a.yaw||0;
  streamChunks(P.x,P.z,999);farU.uFocus.value.set(P.x,P.z);
  P.y=groundAt(P.x,P.z);P.vy=P.kx=P.kz=0;lastVy=0;
}
function setZoneFlags(flags){
  for(const k of Object.keys(ZONE_FLAGS))delete ZONE_FLAGS[k];
  if(flags&&typeof flags==='object')for(const k of Object.keys(flags).slice(0,50))if(/^[a-z]{1,12}\d{1,2}$/.test(k))ZONE_FLAGS[k]=1;
  if(ZONE.onFlags)ZONE.onFlags(ZONE_FLAGS);
}
function dropRope(r){
  if(ZONE_FLAGS[r.flag]){toast('The rope is already down.','',1500);return}
  const i=+r.flag.replace(/\D/g,''),k=r.flag.replace(/\d/g,'');
  if(online())wsSend({t:'zev',k,i});else zoneMsg({t:'zev',key:r.flag,n:S.name});
}

/* server messages (65-net.js hands these over) */
let cpStat=null;
function zoneMsg(m){
  if(m.t==='zone'){
    if(typeof m.zone!=='string')return;
    zoneFade(()=>{
      if(!zoneEnter(m.zone,m.zflags))setZoneFlags(m.zflags);
      if(Array.isArray(m.holes)){for(const e of m.holes.slice(0,40000))if(Array.isArray(e))applyDig(e[0],e[1],e[2],false);rebuildRegion(-HALF,-HALF,HALF,HALF)}
      if(Array.isArray(m.got))for(const i of m.got){const it=items[i|0];if(it)it.found=true}
      for(const k of [...PROPS.keys()])removeProp(k);for(const k of [...BAGS.keys()])removeBag(k);
      if(Array.isArray(m.props))for(const p of m.props.slice(0,60))if(p)addProp(num(p.id,0,1e5,-1)|0,String(p.type),num(p.x,-600,600,0),num(p.z,-600,600,0),p.val!=null?num(p.val,0,1e4,0)|0:null,p.v0!=null?num(p.v0,0,1e4,0)|0:null);
      if(Array.isArray(m.bags))for(const b of m.bags.slice(0,80))if(b)addBag(num(b.id,0,1e9,-1),num(b.x,-600,600,0),num(b.z,-600,600,0),Array.isArray(b.items)?b.items.filter(t=>LOOT[t]).slice(0,12):[],cleanName(b.n));
    });
  }else if(m.t==='cpstat'){cpStat={at:num(m.at,0,99,0)|0,total:num(m.total,0,99,0)|0}}
  else if(m.t==='zev'){
    if(typeof m.key!=='string'||!/^[a-z]{1,12}\d{1,2}$/.test(m.key)||ZONE_FLAGS[m.key])return;
    ZONE_FLAGS[m.key]=1;if(ZONE.onFlags)ZONE.onFlags(ZONE_FLAGS);
    const r=(ZONE.ropes||[]).find(q=>q.flag===m.key);
    if(r){sfx.thud();toast(`${cleanName(m.n)||'Someone'} dropped a rope down. Walk into the wall under it to climb.`,'good',4200)}
  }
}

/* ---------- screen bits: the fade between maps, the title card, the campfire line ---------- */
const zoneUI=(()=>{
  const fade=document.createElement('div');fade.id='zoneFade';
  fade.style.cssText='position:fixed;inset:0;background:#120c07;opacity:0;pointer-events:none;transition:opacity .45s;z-index:40';
  const card=document.createElement('div');card.id='zoneCard';
  card.style.cssText='position:fixed;left:50%;top:26%;transform:translateX(-50%);text-align:center;color:#fff8ea;text-shadow:0 2px 12px rgba(0,0,0,.7);pointer-events:none;opacity:0;transition:opacity .8s;z-index:41;font-family:var(--ui);max-width:min(90vw,640px)';
  const line=document.createElement('div');line.id='zoneLine';
  line.style.cssText='position:fixed;left:50%;top:max(64px,9vh);transform:translateX(-50%);background:rgba(43,29,18,.84);color:#fff8ea;padding:7px 16px;border-radius:999px;font:600 14px var(--ui);pointer-events:none;z-index:30;display:none;max-width:calc(100vw - 32px);text-align:center';
  document.body.append(fade,card,line);return{fade,card,line};
})();
let zoneFading=false;
function zoneFade(fn){
  if(zoneFading){fn();return}
  zoneFading=true;zoneUI.fade.style.opacity='1';
  setTimeout(()=>{try{fn()}finally{setTimeout(()=>{zoneUI.fade.style.opacity='0';zoneFading=false},250)}},480);
}
function zoneCard(Z){
  zoneUI.card.innerHTML='';
  const h=document.createElement('div');h.textContent=Z.name;h.style.cssText='font:800 clamp(28px,6vw,52px)/1.05 var(--ui);letter-spacing:.02em';
  const p=document.createElement('div');p.textContent=Z.blurb||'';p.style.cssText='font:500 clamp(14px,2.6vw,18px)/1.4 var(--ui);margin-top:10px';
  zoneUI.card.append(h,p);zoneUI.card.style.opacity='1';
  clearTimeout(zoneCard.t);zoneCard.t=setTimeout(()=>zoneUI.card.style.opacity='0',5200);
}
function zoneLine(txt){if(txt){zoneUI.line.textContent=txt;zoneUI.line.style.display=''}else zoneUI.line.style.display='none'}

/* ---------- every frame ---------- */
let cpOn=false,cpTold=false,lastVy=0,parkT=0,ledgeTipT=0;
function updateZones(dt){
  if(HELLO_LATER&&ZONES[HELLO_LATER.zone]){const m=HELLO_LATER;HELLO_LATER=null;onMsg(m)}   // arrived before this map's script had loaded
  if(ZONE.id==='lake')return;
  if(zoneTick)zoneTick(dt);
  if((parkT-=dt)<=0){parkT=2;parkSweep()}   // camp models that finish loading while we're away
  if(!S.started){zoneLine('');return}
  if(zonePlaceLater)zonePlace(ZONE);
  // Peak-style falls: a long drop off a ledge hurts (a twister's throw does its own damage)
  {const fs=tuneOr('zone.fallSafe',FALL_SAFE);if(P.grounded&&lastVy<-fs&&!(typeof twSt!=='undefined'&&twSt))hurt((-lastVy-fs)*tuneOr('zone.fallDmg',FALL_DMG),'Fall','You fell off a ledge.')}
  lastVy=P.vy;
  // walking into a ledge you can't climb: say how, now and then
  if(ledgeHitT>0){ledgeHitT-=dt;ledgeTipT+=dt;if(ledgeTipT>1.2){ledgeTipT=-25;toast(online()?'Too tall to climb. A friend crouches (C) against the wall and you jump off them, or find a way round.':'Too tall to climb alone. Look for a way round: a cairn marks it.','',5200)}}
  // the campfire
  const f=ZONE.fire;let txt='';
  if(f){
    const on=!S.ko&&Math.hypot(P.x-f.x,P.z-f.z)<f.r;
    if(on!==cpOn){cpOn=on;if(online())wsSend({t:'cp',on});else if(on)cpStat={at:1,total:1}}
    const next=ZONE_ORDER[ZONE_ORDER.indexOf(ZONE.id)+1];
    if(cpOn&&cpStat){
      if(cpStat.at>=cpStat.total){
        txt=next?'Everyone made it. Moving on…':'The whole crew made it! The trail to Big Thumb isn\'t built yet.';
        if(!cpTold){cpTold=true;sfx.coin();if(!online()&&next)zoneFade(()=>zoneEnter(next))}
      }else txt=`At the campfire: ${cpStat.at} of ${cpStat.total}. The whole crew has to be here to go on.`;
    }else if(cpOn)txt='At the campfire. Waiting for the crew…';
    else if(Math.hypot(P.x-f.x,P.z-f.z)<60)txt='The campfire is just ahead.';
  }
  zoneLine(txt);
}

/* ---------- developer console ---------- */
command('zone',{usage:'zone [name]',help:'Which map the crew is in, or move everyone to another one (e.g. zone canyon, zone lake).',
  run([a]){
    const names=Object.keys(ZONES).join(', ');
    if(!a)return`In: ${ZONE.id} (${ZONE.name}). Maps: ${names}`;
    if(!ZONES[a])throw new Error(`No map called ${a}. Maps: ${names}`);
    if(online()){wsSend({t:'zone',zone:a});return`Moving the crew to ${ZONES[a].name}…`}
    zoneFade(()=>zoneEnter(a));return`Moving to ${ZONES[a].name}.`;
  }});
