'use strict';
/* public/js/79-hud-tidy.js -- a quieter HUD (2026-11-10, JT: "fix up the UI... not too busy").
   The HUD showed every number all the time: an empty sack, a full flashlight at noon, "walk to camp 0:01" while
   standing in camp, a crew panel saying there is no crew. Each is true and none is news. This file hides what is
   not news right now and brings it back the moment it is:
     - Sack row:        only when there is something in it.
     - Flashlight row:  only at night, when the light is on, or when the battery is under 60%.
     - Walk-to-camp:    only outside the fence.
     - Level bar:       only for a few seconds after XP changes (the level number stays).
     - Crew panel:      only once somebody has been hired.
     - Hopper meter is already hidden until you own one (78-hud.js).
   It only ever sets `hidden` on existing rows twice a second; 78-hud.js keeps filling them in as before, so nothing
   here can change a value. The matching spacing and sizes are at the end of game.css ("quieter HUD"). */
const TIDY={xp:-1,xpAt:0};
function hudTidy(){
  if(!S.started)return;const now=performance.now(),$i=id=>document.getElementById(id),set=(el,hide)=>{if(el&&el.hidden!==hide)el.hidden=hide};
  const sack=$i('sack');if(sack)set(sack.closest('.row'),!(S.sack&&S.sack.length));
  const night=typeof nightF==='function'&&nightF()>0.15;
  set($i('battRow'),!(night||S.light||(S.batt!=null&&S.batt<60)));
  set($i('backRow'),inCamp(P.x,P.z)||inTent()||!!S.inTown);
  const xpw=$i('xpBar');if(xpw){const w=xpw.style.width;if(w!==TIDY.xp){TIDY.xp=w;TIDY.xpAt=now}const bar=xpw.closest('.ui-meter');if(bar)bar.style.visibility=now-TIDY.xpAt<6000?'visible':'hidden'}
  const cp=$i('crewPanel');if(cp&&typeof bots!=='undefined')cp.classList.toggle('crew-panel--none',bots.every(b=>b.state==='away'));
}
setInterval(hudTidy,500);
