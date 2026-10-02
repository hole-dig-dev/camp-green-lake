'use strict';
/* public/js/88-morale.js -- crew morale (JT 2026-10-01). Each D Tent crew member has a mood, 0-100 (b.morale, starts at
   MORALE_START). Getting blown up, tossed by a twister or a tumbleweed, knocked out, bitten: it drops (moraleHit, from
   30-npcs.js crewToss / crewKO). It creeps back over time (MORALE_REGEN a minute) and he's fresh again after a night's
   sleep (a new day). Below MORALE_LOW he digs slower (down to MORALE_MIN_RATE at 0) and grumbles. A soda from the
   crew store (consumable, 'soda') cheers him right up (+MORALE_SODA): bought on anyone's screen, every client's crew
   drinks it ('crewSoda'). The crew panel shows it as a fourth bar. */
const MORALE_START=80,MORALE_REGEN=2,MORALE_LOW=50,MORALE_MIN_RATE=0.55,MORALE_SODA=45;
const moraleOf=b=>b.morale==null?(b.morale=MORALE_START):b.morale;
const crewMoraleMul=b=>{const m=moraleOf(b);return m>=MORALE_LOW?1:MORALE_MIN_RATE+(1-MORALE_MIN_RATE)*m/MORALE_LOW};
const MORALE_HIT={mn:25,dy:25,tw:15,tb:12,ls:15,ko:20,bite:15};
const MORALE_GRUMBLE=['Why do I even bother.','This lake hates me.','I want my mom.','Nobody tells me anything.','Not again...','My back. My everything.'];
function moraleHit(b,why){const v=MORALE_HIT[why]||12;b.morale=Math.max(0,moraleOf(b)-v);logEv('crewMorale',{n:b.d.n,why,m:Math.round(b.morale)})}
function crewSoda(n){const b=bots.find(b=>b.d.n===n);if(!b)return;b.morale=Math.min(100,moraleOf(b)+MORALE_SODA);if(nearCam(b.p.g.position.x,b.p.g.position.z,40))say(b.L,pick(['Ahh. Sweet, sweet soda.','Now we\'re talking!','I could dig all day now.']),2600);holdProp(b.p,'tonic',HOLD_SECS.tonic)}
function moraleNewDay(){for(const b of bots)b.morale=Math.max(moraleOf(b),90)}
function updateMorale(dt){
  for(const b of bots){if(!crewHired(b))continue;b.morale=Math.min(100,moraleOf(b)+MORALE_REGEN*dt/60);
    if(b.morale<MORALE_LOW-15&&b.p.g.visible&&OUTDOOR.has(b.state)&&Math.random()<dt/45&&nearCam(b.p.g.position.x,b.p.g.position.z,35))say(b.L,pick(MORALE_GRUMBLE),2600)}
}
