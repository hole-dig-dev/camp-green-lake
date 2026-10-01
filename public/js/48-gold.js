'use strict';
/* public/js/48-gold.js -- gold in the dirt (Greg's gold-dig pivot, 2026-09-30; docs/plans/2026-09-30-gold-dig-design.md).
   Like Needle In A Haystack Simulator, the dirt is the haystack: most of it is just sand, and the game is working
   through enough of it, in the right places, with better and better tools (49-tools.js).
   - Where: Green Lake was a lake, so its gold settled along old creek channels (paystreaks) winding across the bed,
     plus a few rich pockets. Away from them there's almost none. Deeper is richer (it settles toward bedrock).
     Nothing marks the paystreaks: you find them by digging, and by where the gold comes up.
   - Two kinds of gold in every handful or shovelful:
     * pieces you can see (goldSift): the odd flake or nugget, spotted as it comes up. Bare eyes catch about a third
       (GOLD_SPOT); a sifting screen catches them all.
     * fine gold (fineGold): dust too fine to see. It only comes out in a gold pan at the water truck, so the dirt has
       to go into a pan or bucket and be carried to camp (49-tools.js loadDirt and the 'pan' spot).
   - Your pouch (S.gold) is counted in seeds' worth. Mr. Sir buys it (80-ui.js), into the crew wallet. */
const GOLD_BASE=0.006;      // chance 10 L of barren ground holds a piece you could see
const GOLD_RICH=0.16;       // extra chance, right on a paystreak at full depth
const GOLD_NUGGET=0.03;     // of those pieces, this share is a nugget
const FLAKE_VAL=2;          // seeds Mr. Sir pays for a visible flake
const NUGGET_VAL=40;        // ...and for a nugget
const GOLD_SPOT=0.35;       // by eye (no screen), you spot this share of the pieces that come up
const FINE_L=1.5;           // seeds of fine gold in a litre of paystreak dirt at full depth (only a pan gets it out)
const FINE_BASE=0.03;       // the trace of fine gold even barren ground has, as a share of a paystreak's
const STREAK_W=0.055;       // paystreak width, in noise units (~25 m across on the lake)
/* how rich the ground is here: 0 (barren) to 1 (the middle of a paystreak) */
function goldRich(x,z){
  const s=1-Math.abs(vnoise(x*0.009+31.7,z*0.009-12.3)-0.5)/STREAK_W;   // a winding channel where the noise crosses its middle
  const pocket=Math.max(0,vnoise(x*0.04+5.1,z*0.04+77.2)-0.78)/0.22;   // small rich pockets off the channels
  return clamp(Math.max(s,pocket*0.8),0,1);
}
/* depth d (m) of the dirt: richer toward the bottom of a 5 ft hole, and richer still below it */
const goldDepth=d=>0.25+0.75*clamp(d/FIVE_FT,0,1.4);
/* seeds of fine gold in a litre of dirt from here */
const fineGold=(x,z,d)=>tuneOr('gold.fine',FINE_L)*(FINE_BASE+goldRich(x,z))*goldDepth(d);
let goldMissedT=0,goldTold=0;
/* called from scoop() (45-state.js) with every handful or shovelful (litres of dirt) out of hole h: anything you can see? */
function goldSift(h,litres){
  const p=(tuneOr('gold.base',GOLD_BASE)+tuneOr('gold.rich',GOLD_RICH)*goldRich(h.x,h.z))*goldDepth(h.d)*(litres/10);
  if(Math.random()>=p)return;
  const nugget=Math.random()<GOLD_NUGGET,val=nugget?NUGGET_VAL:tuneOr('gold.value',FLAKE_VAL);
  if(!S.up.screen&&Math.random()>=tuneOr('gold.spot',GOLD_SPOT)){   // it went back on the pile with the dirt
    const now=performance.now();
    if(now-goldMissedT>45000){goldMissedT=now;toast(nugget?'Something heavy glinted in that dirt and tumbled back into the pile. A sifting screen would have caught it.':'A glint in the dirt, gone before you could pick it out. A sifting screen catches every fleck.','',3600)}
    logEv('goldMissed',{val,x:+h.x.toFixed(1),z:+h.z.toFixed(1),d:+h.d.toFixed(2)});return;
  }
  S.gold=(S.gold||0)+val;
  const y=groundAt(h.x,h.z)+0.5;puff(h.mx,y,h.mz,h.mx,h.mz,3);
  if(nugget){sfx.gold();addXP(15);toast(`A gold nugget! Worth ${val} seeds to Mr. Sir. (${Math.round(S.gold)} in your pouch)`,'gold',4200)}
  else{sfx.find();addXP(1);const now=performance.now();if(now-goldTold>8000){goldTold=now;toast(`A fleck of gold you can see. (${Math.round(S.gold)} seeds' worth in your pouch)`,'good',1800)}}
  logEv('gold',{val,total:+S.gold.toFixed(1),x:+h.x.toFixed(1),z:+h.z.toFixed(1),d:+h.d.toFixed(2),rich:+goldRich(h.x,h.z).toFixed(2)});
}
/* bare hands only: picking through a handful, you also turn up the camp's old junk now and then (sell it to Mr. Sir) */
const HAND_JUNK=0.012,HAND_JUNK_TYPES=['cap','cap','can','can','spoon','arrow'];
function handFind(h){
  if(Math.random()>=tuneOr('gold.handJunk',HAND_JUNK)||S.sack.length>=sackMax())return;
  const k=HAND_JUNK_TYPES[Math.floor(Math.random()*HAND_JUNK_TYPES.length)];S.sack.push(k);sfx.find();
  toast(`In the dirt: ${LOOT[k].name.toLowerCase()} (${LOOT[k].val} seeds to Mr. Sir).`,'',2400);logEv('handFind',{type:k,x:+h.x.toFixed(1),z:+h.z.toFixed(1)});
}
const goldValue=()=>S.gold||0;
