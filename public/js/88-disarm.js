'use strict';
/* public/js/88-disarm.js -- the mine disarm kit (JT 2026-10-01: "a mine disarm tool that you can get for yourself and
   for NPCs; they can hold interact from just to the side of the mine to disarm it").
   You (S.up.disarm, Supply Depot): stand just beside a landmine you can see (DISARM_MIN..DISARM_MAX m: any closer and
   you're on it) and hold F for mine.disarmTime seconds; the server takes it out quietly ('mineDisarm' → 'mineGone'),
   and the scrap's worth DISARM_GOLD to the crew wallet.
   The crew (their store's "Mine disarm kit"): a crew member with one spots a mine within DISARM_SEE m of him, stops,
   kneels beside it and disarms it (state 'disarming', 30-npcs.js hands him to crewDisarmStep) instead of walking into it.
   Every client runs its own copy of the crew; the one that runs the crew's bank (crewPaysHere) tells the server. */
const DISARM_MIN=0.6,DISARM_MAX=1.9,DISARM_SEE=3,DISARM_GOLD=5,DISARM_CREW_T=5;
const DIS={t:0,id:-1};
function disarmTarget(){
  if(!S.up.disarm||!S.started||S.ko||twSt||inTent()||S.inTown)return null;
  let best=null,bd=DISARM_MAX;for(const m of MINES.values()){const d=Math.hypot(P.x-m.x,P.z-m.z);if(d>=DISARM_MIN&&d<bd&&(m.obj&&m.obj.visible||m.marked)){bd=d;best=m}}return best;
}
function disarmSpot(){const m=disarmTarget();if(!m)return null;
  return{id:'disarm',label:DIS.id===m.id&&DIS.t>0?`Disarming the landmine… ${Math.floor(DIS.t/tune('mine.disarmTime')*100)}%`:'Hold F to disarm the landmine (stay beside it)',use:()=>{}}}
function mineGone(id,by){const m=MINES.get(id);if(!m)return;mineDrop(id);if(nearCam(m.x,m.z,30))sfx.clank();if(by&&by!==S.name&&Math.hypot(P.x-m.x,P.z-m.z)<30)toast(`${by} disarmed a landmine.`,'good',2400)}
function disarmDone(m,crew){
  if(online())wsSend({t:'mineDisarm',id:m.id,crew:crew||undefined});else mineGone(m.id);
  if(!crew){S.seeds+=DISARM_GOLD;foundGold(DISARM_GOLD);addXP(15);sfx.clank();toast(`Landmine disarmed. The scrap's worth ${DISARM_GOLD} gold.`,'good',2800)}
  logEv('mineDisarm',{id:m.id,crew:crew||''});
}
/* the crew: spot, stop, kneel, disarm */
function crewDisarmCheck(){
  for(const b of bots){if(!b.p.g.visible||!crewHas(b,'disarm')||!OUTDOOR.has(b.state)||b.state==='disarming')continue;const g=b.p.g.position;
    for(const m of MINES.values()){const d=Math.hypot(g.x-m.x,g.z-m.z);if(d<DISARM_SEE){b.preDisarm=b.state;b.state='disarming';b.disarmId=m.id;b.disarmT=DISARM_CREW_T;
      if(d<DISARM_MIN+0.1){const l=d||1;g.x=m.x+(g.x-m.x)/l*(DISARM_MIN+0.3);g.z=m.z+(g.z-m.z)/l*(DISARM_MIN+0.3)}
      if(nearCam(g.x,g.z,40))say(b.L,pick(['Hold up. Mine.','Everybody freeze. I got this.','Easy... easy...']),2400);break}}}
}
function crewDisarmStep(b,dt){   /* 30-npcs.js updateBots, while b.state==='disarming' */
  const g=b.p.g,m=MINES.get(b.disarmId);
  if(!m){b.state=b.preDisarm||'walk';return}
  g.rotation.y=Math.atan2(m.x-g.position.x,m.z-g.position.z);g.position.y=groundAt(g.position.x,g.position.z);animPerson(b.p,2,dt,(b.disarmT*1.3)%1);
  b.disarmT-=dt;if(b.disarmT<=0){if(crewPaysHere())disarmDone(m,b.d.n);else mineGone(m.id);if(nearCam(g.position.x,g.position.z,40))say(b.L,pick(['Got it.','Clear.','Phew.']),2000);b.state=b.preDisarm||'walk'}
}
function updateDisarm(dt){
  crewDisarmCheck();
  const m=S.started&&(KEYS['f'])&&!uiOpen()?disarmTarget():null;
  if(m){if(DIS.id!==m.id){DIS.id=m.id;DIS.t=0}DIS.t+=dt;digHeld=false;if(DIS.t>=tune('mine.disarmTime')){DIS.t=0;DIS.id=-1;disarmDone(m)}}
  else if(DIS.t>0)DIS.t=Math.max(0,DIS.t-dt*2);
}
