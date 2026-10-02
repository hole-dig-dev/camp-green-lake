'use strict';
/* public/js/86-hopper.js -- sifter hopper upgrades (JT 2026-10-01: "add upgrades to sifter, sifts over time, holds
   volumes of sand to dump so player can keep digging"). With a hopper bought at the Supply Depot, F at the sifter
   dumps your whole bucket (or backsack) into it in a second instead of standing through a sift; the sifter then works
   through the sand on its own and the gold comes straight to you, a hole at a time, wherever you are. Go dig.
     hopper   20 holes, a hole every 8 s     (the sifter's own hopper, sand piling up to the bars)
     hopper2  50 holes, a hole every 4 s     (a plank collar on top)
     hopper3  120 holes, a hole every 1.5 s  (a towering galvanised bin on legs, and a gas motor on the blower)
   Yours alone: S.hopper is the sand in it (saved with the rest of S, 60-title.js); each camper sees their own load.
   Without a hopper the sifter works as before (45-state.js siftBucket). The crew's queue is unchanged (30-npcs.js).
   Models are Blender's (art/blender/hopper.py, gear.blend): HopperExt2/3 in the sifter's own frame, HopperSand1..3
   (full, scaled up from the hopper floor). */
const HOPPER=[{holes:20,secs:8},{holes:50,secs:4},{holes:120,secs:1.5}];
const HOP={g:null,ext:{},sand:{},acc:0,gold:0,puffT:0,parts:{}};
for(const n of['HopperExt2','HopperExt3','HopperSand1','HopperSand2','HopperSand3'])modelParts(n).then(p=>{HOP.parts[n]=p}).catch(()=>{});
const hopperTier=()=>S.up.hopper3?3:S.up.hopper2?2:S.up.hopper?1:0;
const hopperCap=()=>{const t=hopperTier();return t?HOPPER[t-1].holes:0};
function hopperMesh(n){
  const parts=HOP.parts[n];if(!parts)return null;const g=new T.Group();
  for(const pt of parts){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;m.receiveShadow=true;g.add(m)}
  return g;
}
/* F at the sifter with a hopper: in goes as much of your bucket as fits */
function dumpHopper(){
  const cap=hopperCap(),room=cap-S.hopper;
  if(S.bucket<0.05){toast(`Your ${backsackOn()?'backsack':'bucket'}'s empty. Go dig. (The hopper has ${fmtHoles(S.hopper)} of ${cap} holes of sand in it.)`,'',3200);return}
  if(room<0.05){toast(`The hopper's full (${cap} holes). It's sifting: give it a minute.`,'',3200);return}
  const amt=Math.min(S.bucket,room);S.bucket=Math.max(0,S.bucket-amt);S.hopper+=amt;sfx.scoop();
  const G=SIM.GOLD.SIFTER;puff(G.x-0.85,baseH(G.x,G.z)+1.9,G.z,G.x-0.85,G.z,6);
  toast(`You dump ${fmtHoles(amt)} holes of sand into the hopper (${fmtHoles(S.hopper)}/${cap}). It sifts while you dig: the gold comes to you.`+(S.bucket>0.05?` ${fmtHoles(S.bucket)} didn't fit.`:''),'good',3800);
  logEv('hopper',{holes:+amt.toFixed(2),inHopper:+S.hopper.toFixed(2)});
}
const fmtHoles=h=>String(Math.round(h*10)/10);
/* every frame: sift, pay, and draw the sand at its level */
function updateHopper(dt){
  const t=hopperTier();
  if(t&&S.hopper>0&&S.started){
    const d=Math.min(S.hopper,dt/HOPPER[t-1].secs*tune('gold.hopperSpeed'));S.hopper-=d;HOP.acc+=d;if(S.hopper<1e-4)S.hopper=0;
    if(HOP.acc>=1||(S.hopper===0&&HOP.acc>0)){   // a hole's worth through: its gold is yours
      const r=SIM.siftGold(HOP.acc,Math.random,tune('gold.perHole')*goldScale(),RUN.mood==='digday'?2:1);HOP.acc=0;S.seeds+=r.gold;foundGold(r.gold);HOP.gold+=r.gold;addXP(1+r.gold/4);
      if(r.nugget){sfx.gold();toast(`A NUGGET in the sifter! +${r.gold} gold.`,'gold',3000)}else sfx.coin();
      if(S.hopper===0){toast(`The sifter's through your sand: ${HOP.gold} gold in all.`,'good',3600);logEv('hopperDone',{gold:HOP.gold});HOP.gold=0}
    }
    const G=SIM.GOLD.SIFTER;HOP.puffT-=dt;
    if(HOP.puffT<=0&&(P.x-G.x)**2+(P.z-G.z)**2<40*40){HOP.puffT=0.5;puff(G.x+0.9,baseH(G.x,G.z)+0.9,G.z,G.x+1.6,G.z,1);if(t===3)puff(G.x+0.4,baseH(G.x,G.z)+1.1,G.z+0.85,G.x+0.4,G.z+0.85,1)}   // tailings off the low end; the motor's exhaust
  }
  drawHopper(t);
}
function drawHopper(t){
  if(!HOP.g){const G=SIM.GOLD.SIFTER;HOP.g=new T.Group();HOP.g.position.set(G.x,baseH(G.x,G.z),G.z);HOP.g.rotation.y=G.ry||0;scene.add(HOP.g)}
  for(const k of[2,3]){const n='HopperExt'+k;if(t===k&&!HOP.ext[k]){HOP.ext[k]=hopperMesh(n);if(HOP.ext[k])HOP.g.add(HOP.ext[k])}if(HOP.ext[k])HOP.ext[k].visible=t===k}
  for(const k of[1,2,3]){const n='HopperSand'+k;
    if(t===k&&!HOP.sand[k]){const m=hopperMesh(n);if(m){m.position.set(-0.85,1.45,0);HOP.g.add(m);HOP.sand[k]=m}}   // the hopper floor (hopper.py HX, HZ0)
    const m=HOP.sand[k];if(!m)continue;const f=t===k?clamp(S.hopper/HOPPER[k-1].holes,0,1):0;m.visible=f>0.005;m.scale.y=Math.max(0.03,f)}
}
