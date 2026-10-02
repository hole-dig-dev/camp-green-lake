'use strict';
/* public/js/88-hazards.js -- one switch for every hazard and mob (JT 2026-10-01: "add a switch for turning off all hazards
   and mobs that you can flip when you're testing stuff, maybe allow one-off turn-ons if testing a single mob or hazard").
   F2 → Hazards: "ALL hazards and mobs" (haz.all). Off: nothing new spawns (natural schedules, the event director, the
   server's herds/lion/night patrols, landmines) and what's already out there is cleared away. Each one has an "on anyway"
   flag (haz.on.<kind>) that lets just that one back in while ALL is off, and a "spawn one now" button (the console
   commands: twister, landslide, ...). The gate is hazOn(kind) in 11-tune.js (server.js: hazOnS); the flags are shared
   through the test server, which tells everyone at once ('tunehaz'), so flipping them changes it for everyone playing.
   Kinds: twister landslide tumbleweed haboob sinkhole mines javelinas lion vultures lizards night. Sinkholes already
   open are left to fill in on their own (someone may be down one). */
const HAZ_KINDS=['twister','landslide','tumbleweed','haboob','sinkhole','mines','javelinas','lion','vultures','lizards','night'];
const HAZ_WAS={};
/* the console command for one, right now (it doesn't care about the switch: that's the point) */
function hazNow(cmd){const r=runCommand(cmd);if(r)toast(String(r).slice(0,140),'',2600)}
/* the test server tells everyone when the Hazards tab changes: take its haz.* values as ours (not re-posted) */
function hazTuneFrom(o){
  if(!o||typeof o!=='object')return;
  for(const k of Object.keys(TUNE_OVR))if(k.startsWith('haz.')&&!(k in o))delete TUNE_OVR[k];
  for(const k in o){const e=o[k],d=TUNE_BY[k];if(d&&e&&Number.isFinite(e.v)&&e.def===d.def)TUNE_OVR[k]={v:e.v,def:e.def}}
  tuneSaveLocal();
}
function hazClear(k){
  if(k==='twister')twSpawned.length=0;
  else if(k==='tumbleweed'){for(const w of tbWeeds){w.dead=true;w.deadT=Math.max(w.deadT||0,TB_FADE_TIME*0.5)}}
  else if(k==='landslide'){for(const b of lsBoulders){b.settledT=LS_SETTLE_TIME;b.fadeT=Math.max(b.fadeT,LS_FADE_TIME*0.8)}}
  else if(k==='haboob')hbForced=null;
  else if(k==='vultures'){if(vSt>0&&vSt<3)vCancelToIdle()}
  else if(k==='javelinas')JAV_LOCAL.list.length=0;
  else if(k==='lion')LIONL.active=false;
  else if(k==='night'){MONL.trucks=[];MONL.zer=null}
}
function updateHazardSwitch(){
  for(const k of HAZ_KINDS){const on=hazOn(k);if(HAZ_WAS[k]===true&&!on){hazClear(k);logEv('hazOff',{k})}HAZ_WAS[k]=on}
}
