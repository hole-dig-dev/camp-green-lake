'use strict';
/* public/js/71-bonk.js -- shovel bonk: whack a friend with your shovel and send them tumbling (harmless). See ARCHITECTURE.md. */
/* ---------- shovel bonk ---------- */
/* Pure slapstick between friends: swing your shovel (the normal dig input, E / click / the touch dig button) while a
   friend is right in front of you and, instead of scooping dirt, you bonk them. They get knocked into the same
   ragdoll tumble a twister uses (twSt 2 airborne -> 3 down -> 4 get up, see 72-twisters.js), just a short hop instead of
   a 30 m throw, and they take NO damage. The server checks you're actually standing next to them (see 'bonk' in
   server.js) and passes it on, so the victim's own client plays the tumble and everyone else sees it through normal
   position sync. The D Tent crew can be bonked too (they just complain), which also makes this testable solo.
   No bonk while either of you is inside a tent (the tumble uses outdoor ground), and a camper down in a hole just
   gets their bell rung instead of a launch, so a bonk can never pop anyone out of a deep hole (or a sinkhole). */
const BONK_REACH=2.3;        // how far in front of you (m) the shovel connects
const BONK_CONE=0.5;         // cos of the half-angle they must be within (0.5 = 60 degrees either side of where you face)
const BONK_CD=0.9;           // seconds between your bonks, so holding dig isn't a machine gun
const BONK_SPEED=6.5;        // how fast (m/s) the victim is knocked away along the swing
const BONK_VY=6;             // upward pop (m/s): a ~1 m hop, enough for a proper tumble
const BONK_DEEP=0.5;         // in a hole deeper than this (m) you only get dizzy, no launch (can't bonk anyone out of a hole)
const BONK_LINES=['Hey! Watch it!','Ow! My head!','Do that again, I dare you.','That\'s going in my report to Mr. Sir.','Not cool, man.'];
let bonkT=0;                  // time (performance.now ms) of your last bonk swing
/* Called at the top of scoop(): returns true if this swing hit someone (so no dirt gets dug) */
function bonkSwing(){
  const now=performance.now();if(now-bonkT<BONK_CD*1000||inTent())return false;
  const fx=Math.sin(P.fa),fz=Math.cos(P.fa);
  const inFront=(x,z)=>{const dx=x-P.x,dz=z-P.z,d=Math.hypot(dx,dz);return d<tuneOr('env.bonkReach',BONK_REACH)&&d>0.05&&(dx*fx+dz*fz)/d>BONK_CONE?d:0};
  // friends first (skip anyone knocked out or inside a tent: their y is down at TENT_FLOOR_Y)
  let best=null,bd=1e9;
  for(const[id,R]of remotes){if(R.f&2||R.ty<TENT_FLOOR_Y+2)continue;const g=R.p.g.position,d=inFront(g.x,g.z);if(d&&d<bd){bd=d;best={id,R}}}
  if(best){
    bonkT=now;wsSend({t:'bonk',id:best.id});bonkFx(best.R.p.g.position);
    logEv('bonk',{id:best.id,n:best.R.name,x:+P.x.toFixed(1),z:+P.z.toFixed(1)});return true;
  }
  for(const b of bots){if(b.state==='inside'||b.state==='away')continue;const g=b.p.g.position;if(inFront(g.x,g.z)){bonkT=now;bonkFx(g);say(b.L,pick(BONK_LINES),3000);return true}}
  return false;
}
function bonkFx(pos){sfx.clank();sfx.thud();puff(pos.x,pos.y+1.6,pos.z,pos.x,pos.z,6)}
/* the server says someone bonked you: (dx,dz) is the direction from them to you */
function bonked(by,dx,dz){
  if(!S.started||S.ko||twSt||inTent())return;   // already tumbling / knocked out / sheltered: shrug it off
  sfx.clank();sfx.thud();hurtFx=Math.max(hurtFx,0.2);logEv('bonked',{by,x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
  if(holeDepthHere()>BONK_DEEP||S.carry!=null){toast(`BONK! ${by} rang your bell.`,'',2000);return}   // in a hole or hauling loot: dizzy, not launched
  const l=Math.hypot(dx,dz)||1;
  const bk=tune('rag.bonk');P.kx=dx/l*BONK_SPEED*bk;P.kz=dz/l*BONK_SPEED*bk;P.vy=BONK_VY*Math.min(1.5,bk);P.grounded=false;digHeld=false;
  twRagX=(Math.random()*2-1)*9;twRagY=(Math.random()*2-1)*6;twRagZ=(Math.random()*2-1)*8;   // same mixed-axis tumble as a twister throw
  twSt=2;twStT=0;   // hand the player to the twister's airborne -> down -> get-up states (72-twisters.js twStep)
  toast(`BONK! ${by} whacked you with a shovel.`,'',2500);
}
