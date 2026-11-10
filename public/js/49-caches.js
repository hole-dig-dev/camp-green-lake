'use strict';
/* public/js/49-caches.js -- something to find at every landmark (2026-11-10).
   Our own design research (docs/STORY.md has the setting; the rule is from the mine research): "add reasons to go to
   specific places, not more places", and "if you see something cool, there should be something there". The eight
   landmarks on the lake (24-dressing.js LANDMARKS) were scenery. Now each holds one cache per digger per run:
     - gold, more the farther the landmark is from camp (CACHE_BASE + CACHE_PER_M a metre), and
     - a scrap of an old prospector's map: the richest ground within CACHE_SCAN metres is assayed for you and marked
       on your map (48-paydirt.js samples), so a trip to a landmark is also how you learn where a paystreak runs.
   F at the landmark searches it. What you've searched is saved with the rest of S and forgotten when the crew is let
   go and the run starts over (the day counter goes back). Nothing is on the wire: each digger finds their own. */
const CACHE_BASE=25,CACHE_PER_M=0.3,CACHE_SCAN=160,CACHE_STEP=8;
const CAMP_AT={x:0,z:39};
function cacheState(){
  if(!S.caches||typeof S.caches!=='object'||!Array.isArray(S.caches.got))S.caches={day:0,got:[]};
  const day=(typeof RUN!=='undefined'&&RUN.day)|0;
  if(day&&day<S.caches.day)S.caches.got=[];          // a new run: every cache is there again
  if(day)S.caches.day=day;
  return S.caches;
}
const cacheGot=id=>cacheState().got.includes(id);
function cacheSpot(){
  if(typeof LANDMARKS==='undefined'||!S.started||S.ko||S.inTown||S.inTruck||inTent()||S.carry!=null)return null;
  for(const L of LANDMARKS){
    if(Math.hypot(P.x-L.x,P.z-L.z)>Math.max(7,(L.r||8)+2.5)||cacheGot(L.id))continue;
    return{id:'cache',label:`Search ${L.name}`,use:()=>cacheOpen(L)};
  }
  return null;
}
const CACHE_DIRS=['north','north-east','east','south-east','south','south-west','west','north-west'];
function cacheOpen(L){
  if(cacheGot(L.id))return;cacheState().got.push(L.id);
  const gold=Math.round(CACHE_BASE+CACHE_PER_M*Math.hypot(L.x-CAMP_AT.x,L.z-CAMP_AT.z));
  S.seeds+=gold;foundGold(gold);addXP(12);sfx.gold();
  // the map scrap: the best ground nearby, as an assay dot on your map
  let bx=L.x,bz=L.z,bm=0;
  for(let x=L.x-CACHE_SCAN;x<=L.x+CACHE_SCAN;x+=CACHE_STEP)for(let z=L.z-CACHE_SCAN;z<=L.z+CACHE_SCAN;z+=CACHE_STEP){
    if(Math.abs(x)>EDGE-10||Math.abs(z)>EDGE-10||inCamp(x,z))continue;
    const m=SIM.payMult(x,z,1.5)-Math.hypot(x-L.x,z-L.z)*0.002;if(m>bm){bm=m;bx=x;bz=z}}
  const mult=SIM.payMult(bx,bz,1.5),g=SIM.gradeOf(mult),d=Math.round(Math.hypot(bx-L.x,bz-L.z)/5)*5;
  const dir=CACHE_DIRS[((Math.round(Math.atan2(bx-L.x,-(bz-L.z))/(Math.PI/4))%8)+8)%8];   // map north is -z
  if(!Array.isArray(S.samples))S.samples=[];
  S.samples=S.samples.filter(q=>Math.hypot(q[0]-bx,q[1]-bz)>=6);S.samples.push([Math.round(bx),Math.round(bz),g]);if(S.samples.length>PAY_SAMPLES)S.samples.shift();
  const where=d<10?'right here':`about ${d} m to the ${dir}`;
  toast(`${L.name}: ${gold} gold in an old tin, and a scrap of somebody's map. It marks ${SIM.PAY.grades[g].toLowerCase()} ground ${where}. It's on your map now.`,'gold',8000);
  logEv('cache',{id:L.id,gold,g,x:Math.round(bx),z:Math.round(bz)});
}
