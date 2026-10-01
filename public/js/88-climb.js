'use strict';
/* public/js/88-climb.js -- Peak-style climbing (Greg's Claude, 2026-09-30; step 1 of docs/plans/2026-09-30-onion-mountain-design.md).
   It adds to the ledge rules (88-zones.js zoneStep, 88-north.js), never replaces them:
   - Jump at a ledge too tall to walk up and keep Space held: you catch the wall and hang there. W climbs, S climbs down,
     A/D shuffle along it, Shift lunges about a metre up. Let go of Space and you drop.
   - Hanging drains stamina, climbing drains it faster, and a lunge costs a lump. At 0 your grip gives out. Stamina can
     never be more than health (70-player.js), so a hurt camper climbs badly and friends notice.
   - Get your hands to the top edge and you pull yourself over it.
   - The crew ways up stay, and stay quicker: a leg-up off a crouching friend, a hand from above, a dropped rope.
   Where: every map but the lake (F2 > Climbing), and on the lake's north wall only if "on the north wall" is switched
   on. JT built that wall to need a friend or a rope ladder, so it's his call.
   Only your own client runs this; friends just see where you are. */
const CLIMB_UP=1.1;               // m/s up (or down) the wall
const CLIMB_SIDE=0.9;             // m/s along it
const CLIMB_HOLD=4;               // stamina/s just hanging on
const CLIMB_MOVE=9;               // stamina/s while climbing
const CLIMB_LUNGE=1.0;            // m a lunge (Shift) takes you up
const CLIMB_LUNGE_COST=16;        // stamina a lunge costs
const CLIMB_LUNGE_T=0.25;         // s a lunge takes
const CLIMB_MIN=8;                // stamina you need to catch hold at all
const CLIMB_REACH=0.35;           // hands this close to the top edge: you pull yourself over
const CLIMB_FACE=0.9;             // m ahead where the wall's top is measured (past zoneStep's 0.5 m look)
let CL=null;                      // the climb: {nx,nz} into the wall, lunge time left, the last frame it ran, Shift held
const climbFrame=()=>renderer.info.render.frame;   // counts drawn frames (not wall time: a slow phone runs few of them)
function climbHere(){return ZONE_STEP?tuneOr('climb.on',1)>0:northClimb(P.x,P.z)&&tuneOr('climb.north',0)>0}
const climbTop=(nx,nz)=>groundAt(P.x+nx*CLIMB_FACE,P.z+nz*CLIMB_FACE);
const climbing=()=>!!CL;
/* called from updatePlayer after zoneStep: at the top of a jump or falling, Space held, pushing into a ledge -> catch the wall */
function climbTry(mx,mz){
  if(CL||P.grounded||P.vy>0||!KEYS[' ']||S.carry!=null||P.crouch||!climbHere())return false;   // vy>0: still rising, so a jump that clears a small step isn't caught on it
  const d=Math.hypot(mx,mz);if(d<0.1)return false;
  const nx=mx/d,nz=mz/d;if(!zoneBlocked(P.x,P.z,P.x+nx*0.1,P.z+nz*0.1,P.y))return false;
  if(S.stam<tuneOr('climb.min',CLIMB_MIN)&&!GOD){climbTell('Too tired to hold on. Get your breath back first.','bad');return false}
  CL={nx,nz,lunge:0,at:climbFrame(),shift:!!KEYS['shift']};P.vy=0;
  logEv('climb',{x:+P.x.toFixed(1),z:+P.z.toFixed(1),y:+P.y.toFixed(1)});
  climbTell('Holding on. W climbs, Shift lunges, let go of Space to drop.','');
  return true;
}
function climbLetGo(why){CL=null;P.vy=0;P.grounded=false;if(why)logEv('climbOff',{why,y:+P.y.toFixed(1)})}
/* called from updatePlayer every frame while climbing: true = it handled the frame */
function climbStep(dt,ix,iz){
  const f=climbFrame();
  if(f-CL.at>2){CL=null;return false}   // frames went by without the climb (a twister, a knock, the truck): the hold's gone
  CL.at=f;
  if(!KEYS[' ']||S.ko||uiOpen()){climbLetGo('let go');return false}
  if(S.stam<=0&&!GOD){climbLetGo('stamina');climbTell('Your grip gives out!','bad');return false}
  const {nx,nz}=CL,rx=-nz,rz=nx;   // (rx,rz): to your right, facing the wall
  let up=iz*tuneOr('climb.up',CLIMB_UP),moved=iz!==0||ix!==0;
  // a lunge: Shift, once per press
  if(KEYS['shift']&&!CL.shift&&CL.lunge<=0&&spendStam(tuneOr('climb.lungeCost',CLIMB_LUNGE_COST))){CL.lunge=CLIMB_LUNGE_T;sfx.thud()}
  CL.shift=!!KEYS['shift'];
  if(CL.lunge>0){CL.lunge-=dt;up=tuneOr('climb.lunge',CLIMB_LUNGE)/CLIMB_LUNGE_T;moved=true}
  P.y+=up*dt;
  // along the wall: only while there's still wall to hold (otherwise you'd shuffle off its end)
  if(ix){const s=ix*tuneOr('climb.side',CLIMB_SIDE)*dt,x=P.x+rx*s,z=P.z+rz*s;
    if(groundAt(x+nx*CLIMB_FACE,z+nz*CLIMB_FACE)-P.y>tuneOr('zone.stepRise',STEP_RISE)){P.x=x;P.z=z}}
  drainStam((moved?tuneOr('climb.move',CLIMB_MOVE):tuneOr('climb.hold',CLIMB_HOLD))*dt);
  S.water=Math.max(0,S.water-1.05*dt/tune('water.last'));   // as thirsty as digging
  const top=climbTop(nx,nz),g=groundAt(P.x,P.z);
  if(P.y<=g){P.y=g;climbLetGo('down');P.grounded=true;return false}   // climbed back down to the ground
  if(top-P.y<=CLIMB_REACH){   // hands on the top edge: over you go
    const x=P.x+nx*CLIMB_FACE,z=P.z+nz*CLIMB_FACE;P.x=x;P.z=z;P.y=groundAt(x,z);CL=null;P.vy=0;P.grounded=true;
    logEv('mantle',{x:+x.toFixed(1),z:+z.toFixed(1),y:+P.y.toFixed(1)});return false}
  P.vy=0;P.grounded=false;P.moving=moved;P.anim=7;P.fa=Math.atan2(nx,nz);
  me.g.position.set(P.x,P.y,P.z);
  let dr=P.fa-me.g.rotation.y;dr=Math.atan2(Math.sin(dr),Math.cos(dr));me.g.rotation.y+=dr*Math.min(1,dt*14);
  animPerson(me,7,dt);
  return true;
}
function climbTell(t,kind){const now=performance.now();if(now-(climbTell.at||0)>6000){climbTell.at=now;toast(t,kind,2200)}}
