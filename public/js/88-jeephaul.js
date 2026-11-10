'use strict';
/* public/js/88-jeephaul.js -- the jeep is something the crew earns, and it hauls sand (2026-11-10).
   Before: the jeep only drove with a tester's switch (F2 > Vehicles) and carried nothing. Now:
     - The crew buys the jeep keys at the store (Camp tab, `jeepKeys`, a camp upgrade like the washers). From then on it
       waits inside the service gate and anyone can drive it (87-truck.js truckOn, server.js truckOn).
     - Its tub carries JEEP_HOLES holes of sand, six big buckets' worth. Stand at the back with sand in your bucket: F
       tips it in. The sand keeps its richness (48-paydirt.js). Park within JEEP_UNLOAD_R of the sifter (its own spot inside the service gate counts): F at the jeep
       shovels the load out, into your hopper if you have one (what doesn't fit goes straight through the sifter).
     So the far paystreaks are worth working: dig there all morning, drive the lot home in one trip.
   The load is each digger's own (S.jeepSand, saved with S), like the hopper's: two diggers can both load the same
   jeep. A mound in the tub shows your load. Hooks: nearSpot() in 45-state.js asks jeepSpot(); 90-loop.js calls
   updateJeepHaul(). */
const JEEP_HOLES=30,JEEP_UNLOAD_R=18,JEEP_TAIL=[0,-2.35],JEEP_REACH=2.3;
const jeepOwned=()=>typeof campHas==='function'&&campHas('jeepKeys');
const jeepSand=()=>Math.max(0,S.jeepSand||0);
let JEEP_MOUND=null;
function jeepSpot(){
  if(!jeepOwned()||!truckOn()||S.inTruck||S.inTown||S.ko||inTent()||TRUCK.flipped)return null;
  const t=truckAt(JEEP_TAIL[0],JEEP_TAIL[1]);if(Math.hypot(P.x-t.x,P.z-t.z)>JEEP_REACH)return null;
  const G=SIM.GOLD.SIFTER,atSifter=Math.hypot(TRUCK.x-G.x,TRUCK.z-G.z)<JEEP_UNLOAD_R,load=jeepSand();
  if(atSifter&&load>0.05)return{id:'jeepUnload',label:`Shovel the jeep's load out at the sifter (${fmtHoles(load)} holes of sand)`,use:jeepUnload};
  if(carrier()==='bucket'&&S.bucket>0.05){
    if(load>=JEEP_HOLES-0.05)return{id:'jeepFull',label:`The jeep's tub is full (${JEEP_HOLES} holes). Drive it to the sifter.`,use:()=>{}};
    return{id:'jeepLoad',label:`Tip your ${backsackOn()?'backsack':'bucket'} into the jeep (${fmtHoles(load)}/${JEEP_HOLES} holes aboard)`,use:jeepLoad};
  }
  return null;
}
function jeepLoad(){
  const amt=Math.min(S.bucket,JEEP_HOLES-jeepSand());if(!(amt>0.01))return;
  sandMix('jeepSand',amt,sandRich('bucket'));S.jeepSand=jeepSand()+amt;S.bucket=Math.max(0,S.bucket-amt);if(S.bucket<0.05){S.bucket=0;sandReset('bucket')}
  sfx.scoop();const t=truckAt(0,-1.3);puff(t.x,TRUCK.y+1.2,t.z,t.x,t.z,6);
  toast(`${fmtHoles(amt)} holes of sand into the jeep (${fmtHoles(jeepSand())}/${JEEP_HOLES}).`,'good',2400);logEv('jeepLoad',{holes:+amt.toFixed(2),aboard:+jeepSand().toFixed(2)});
}
function jeepUnload(){
  let rest=jeepSand();if(!(rest>0.05))return;const pm=sandRich('jeepSand'),cap=hopperCap();let put=0;
  if(cap){put=Math.min(rest,Math.max(0,cap-S.hopper));sandMix('hopper',put,pm);S.hopper+=put;rest-=put}
  S.jeepSand=0;sandReset('jeepSand');sfx.scoop();
  if(rest>0.01){const r=SIM.siftGold(rest,Math.random,tune('gold.perHole')*goldScale()*pm,RUN.mood==='digday'?2:1);S.seeds+=r.gold;foundGold(r.gold);addXP(4+r.gold/3);r.nugget?sfx.gold():sfx.coin();
    toast(`${r.nugget?'A NUGGET! ':''}The jeep's load goes through the sifter: ${r.gold} gold from ${fmtHoles(rest)} holes.${put>0.01?` (${fmtHoles(put)} more went in your hopper.)`:''} ${payAssay(pm)}`,'gold',5200)}
  else toast(`The jeep's load is in your hopper (${fmtHoles(S.hopper)}/${cap}). ${payAssay(pm)}`,'good',4200);
  logEv('jeepUnload',{holes:+(rest+put).toFixed(2),pay:+pm.toFixed(2)});
}
/* the mound in the tub: one squashed sand-coloured blob that grows with your load */
function updateJeepHaul(){
  if(!TRUCK.root)return;const f=jeepOwned()?clamp(jeepSand()/JEEP_HOLES,0,1):0;
  if(!JEEP_MOUND){if(f<=0)return;const g=new T.IcosahedronGeometry(1,1);JEEP_MOUND=new T.Mesh(g,M(0xd2a064));JEEP_MOUND.castShadow=true;JEEP_MOUND.position.set(0,1.02,-1.15);TRUCK.root.add(JEEP_MOUND)}
  JEEP_MOUND.visible=f>0.01;if(JEEP_MOUND.visible)JEEP_MOUND.scale.set(0.62,0.12+0.3*f,0.5+0.12*f);
}
