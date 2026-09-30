'use strict';
/* public/js/88-north.js -- the end of Act 1 (JT, 2026-09-30): out past the trench, the wall at the lake's north edge.
   The shapes are in the ground itself (10-core.js NORTH, northH); this file is the climbing, the models and the win.
   - Anywhere north of NORTH_CLIMB_Z the ledge rules apply, as in the other maps (88-zones.js zoneStep): a ledge more than
     a step high can't be walked up. The trench's sides are sheer (its camp side has a few dirt slopes out); the wall is
     three 2 m ledges.
   - Up a ledge: a leg-up from a friend crouching next to you, a hand from a friend on the ledge above holding F (flag
     256, the same "hand down" as a shaft into the buried town), or on your own with your rope ladder hooked over the edge.
   - The whole crew standing on top of the wall wins Act 1: the server moves everyone on to the next map (like the
     campfire in the other maps). Solo, you're there as soon as you're up. */
const NORTH_CLIMB_Z=-505;
const NORTH_TOP_Y=NORTH.tierH*NORTH.tiers;                                        // the top of the wall
const NORTH_TOP_Z=NORTH.wall-NORTH.tier*(NORTH.tiers-1);                            // where the top ledge starts
const northClimb=(x,z)=>!ZONE_H&&z<NORTH_CLIMB_Z;
const northOnTop=()=>!ZONE_H&&!S.inTown&&P.z<NORTH_TOP_Z-0.3&&P.y>NORTH_TOP_Y-0.6;
/* a jump in the north strip: a leg-up, a hand from above, or the rope ladder; otherwise an ordinary jump */
function northJumpV(){
  const legup=tuneOr('zone.legup',LEGUP_V);
  for(const R of remotes.values()){
    if((R.f&8)&&Math.hypot(R.tx-P.x,R.tz-P.z)<tuneOr('zone.legupR',LEGUP_R)&&Math.abs(R.ty-P.y)<0.9){northTold(`${R.name} gives you a leg-up!`);return legup}
    const up=R.ty-P.y;if((R.f&256)&&up>1.2&&up<NORTH.tierH+0.8&&Math.hypot(R.tx-P.x,R.tz-P.z)<3){northTold(`${R.name} pulls you up!`);return legup}
  }
  // on your own: hook the rope ladder over the ledge in front of you (only if there is one)
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),ahead=groundAt(P.x+fx*1.2,P.z+fz*1.2)-P.y;
  if(S.up.rope&&ahead>0.8&&ahead<NORTH.tierH+0.5){northTold('You hook your rope ladder over the edge and climb.');return legup}
  return tune('move.jump');
}
function northTold(t){const now=performance.now();if(now-(northTold.at||0)>2500){northTold.at=now;toast(t,'good',1800)}}

/* ---- the win: everyone on top ---- */
let northTop=false,northSent=0,northCount='';
function updateNorth(dt){
  if(!S.started||ZONE_H)return;
  const top=northOnTop()&&!S.ko;
  if(top!==northTop){northTop=top;
    if(top){toast('You\'re at the top of the wall. Big Thumb is right there. Get the whole crew up here.','gold',5000);logEv('summit',{x:+P.x.toFixed(1)})}
    if(online())wsSend({t:'summit',on:top});
    else if(top){const next=ZONE_ORDER[ZONE_ORDER.indexOf(ZONE.id)+1];if(next)zoneFade(()=>zoneEnter(next))}}
  if(online()&&top&&(northSent-=dt)<=0){northSent=5;wsSend({t:'summit',on:true})}   // a reminder, in case the server restarted
}
function northMsg(m){
  const s=`${num(m.at,0,99,0)|0}/${num(m.total,1,99,1)|0}`;if(s===northCount)return;northCount=s;
  if(m.at>0&&m.at<m.total)toast(`${s} of the crew on top of the wall.`,'',2600);
}

/* ---- the models on the ground's shapes (art/blender/north.py) ---- */
{
  const N=NORTH,[t0,t1]=N.trench,R=N.ramp,X0=-EDGE+5,X1=EDGE-5,C5=[],C2=[];
  for(let x=X0;x<=X1;x+=10){
    if(!N.exits.some(ex=>Math.abs(x-ex)<N.exitW/2+5))C5.push({x,y:0,z:t0,ry:Math.PI});   // the camp side, facing into the trench (not at the ways out)
    C5.push({x,y:0,z:t1,ry:0});                                                        // the far side
    for(let k=1;k<=N.tiers;k++)C2.push({x,y:k*N.tierH,z:N.wall-(k-1)*N.tier,ry:0});      // the wall's ledges, facing camp
  }
  const at=(x,z)=>baseH(x,z);
  instanceModel('NorthCliff5',C5).catch(()=>{});instanceModel('NorthCliff2',C2).catch(()=>{});
  placeModel('NorthRamp',{x:R.x,y:at(R.x,t0+R.len+0.5),z:t0+R.len,ry:0}).catch(()=>{});        // camp side, rising north to the lip
  placeModel('NorthRamp',{x:R.x,y:at(R.x,t1-R.len-0.5),z:t1-R.len,ry:Math.PI}).catch(()=>{});  // far side, for the way back
  placeModel('SignTrench',{x:R.x+5,y:at(R.x+5,t0+30),z:t0+30,ry:0}).catch(()=>{});
  placeModel('SignBigThumb',{x:R.x,y:NORTH_TOP_Y,z:NORTH_TOP_Z-5,ry:0}).catch(()=>{});
}
