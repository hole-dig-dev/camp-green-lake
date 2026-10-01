'use strict';
/* public/js/48-gold.js -- gold in the dirt: every shovelful is checked (Greg's gold-dig pivot, 2026-09-30;
   docs/plans/2026-09-30-gold-dig-design.md). Like Needle In A Haystack Simulator, the dirt is the haystack: most of it is
   just sand, and the game is working through enough of it, in the right places, with better and better tools.
   - Where: Green Lake was a lake, so its gold settled along old creek channels (paystreaks) winding across the bed,
     plus a few rich pockets. Away from them a shovelful almost never has any. Deeper is richer (it settles toward
     bedrock). Nothing marks the paystreaks: you find them by digging, and by where the flakes come up.
   - What: a gold-bearing shovelful holds a flake (FLAKE_VAL seeds) or, now and then, a nugget.
   - Seeing it: by hand you only spot the flakes that happen to show (GOLD_SPOT). A sifting screen (Supply Depot)
     catches all of it, and the game tells you about the gold you're letting slip until you buy one.
   - Selling: Mr. Sir buys the gold pouch (80-ui.js), toward the team quota like everything else.
   Only your own client rolls your shovelfuls; the pouch (S.gold, in flakes) is yours until you sell it. */
const GOLD_BASE=0.006;      // chance a shovelful from barren ground has gold in it
const GOLD_RICH=0.16;       // extra chance, right on a paystreak at full depth
const GOLD_NUGGET=0.03;     // of the shovelfuls with gold, this share is a nugget
const NUGGET_FLAKES=20;     // a nugget is worth this many flakes
const FLAKE_VAL=2;          // seeds Mr. Sir pays per flake
const GOLD_SPOT=0.35;       // by hand (no screen), you spot this share of the gold that comes up
const STREAK_W=0.055;       // paystreak width, in noise units (~25 m across on the lake)
/* how rich the ground is here: 0 (barren) to 1 (the middle of a paystreak) */
function goldRich(x,z){
  const s=1-Math.abs(vnoise(x*0.009+31.7,z*0.009-12.3)-0.5)/STREAK_W;   // a winding channel where the noise crosses its middle
  const pocket=Math.max(0,vnoise(x*0.04+5.1,z*0.04+77.2)-0.78)/0.22;   // small rich pockets off the channels
  return clamp(Math.max(s,pocket*0.8),0,1);
}
/* depth d (m) of the shovelful: richer toward the bottom of a 5 ft hole, and richer still below it */
const goldDepth=d=>0.25+0.75*clamp(d/FIVE_FT,0,1.4);
let goldMissedT=0,goldTold=0;
/* called from scoop() (45-state.js) for every shovelful that comes out of hole h */
function goldSift(h){
  const p=(tuneOr('gold.base',GOLD_BASE)+tuneOr('gold.rich',GOLD_RICH)*goldRich(h.x,h.z))*goldDepth(h.d);
  if(Math.random()>=p)return;
  const nugget=Math.random()<GOLD_NUGGET,flakes=nugget?NUGGET_FLAKES:1;
  if(!S.up.screen&&Math.random()>=tuneOr('gold.spot',GOLD_SPOT)){   // it went back on the pile with the dirt
    const now=performance.now();
    if(now-goldMissedT>45000){goldMissedT=now;toast(nugget?'Something heavy glinted in that shovelful and tumbled back into the pile. A sifting screen would have caught it.':'A glint in the dirt, gone before you could pick it out. A sifting screen catches every fleck.','',3600)}
    logEv('goldMissed',{flakes,x:+h.x.toFixed(1),z:+h.z.toFixed(1),d:+h.d.toFixed(2)});return;
  }
  S.gold=(S.gold||0)+flakes;
  const y=groundAt(h.x,h.z)+0.5;puff(h.mx,y,h.mz,h.mx,h.mz,3);
  if(nugget){sfx.gold();addXP(15);toast(`A gold nugget! Worth ${NUGGET_FLAKES*FLAKE_VAL} seeds to Mr. Sir. (${S.gold} flakes' worth in your pouch)`,'gold',4200)}
  else{sfx.find();addXP(1);const now=performance.now();if(now-goldTold>8000){goldTold=now;toast(`A fleck of gold. (${S.gold} in your pouch)`,'good',1800)}}
  logEv('gold',{flakes,total:S.gold,x:+h.x.toFixed(1),z:+h.z.toFixed(1),d:+h.d.toFixed(2),rich:+goldRich(h.x,h.z).toFixed(2)});
}
const goldValue=()=>(S.gold||0)*tuneOr('gold.value',FLAKE_VAL);
