'use strict';
/* public/js/86-sit.js -- sitting down (JT, 2026-09-30): F at a free seat to sit, F again (or just walk) to get up.
   The seats: the mess tables' benches (four a table, facing it), the two yard benches (two each, facing the yard) and
   the four stools round D Tent's card table (facing it; X-Ray deals from one of them). Mr. Sir's pickup has its own
   seats (87-truck.js) but sits you the same way.
   Sitting is the camper's Sit clip (animPerson mode 10, blender/cgl_rig.py anim_sit). It goes out as your animation,
   so friends see you sit; a seat with someone on it (a friend or a bot) isn't offered. */
const SIT_HIP=0.59;   // the camper's hips above its feet (rig LIFT 0.87 x MODEL_SCALE 0.68), times its body height
const SIT_R=1.3;      // how close you need to be to a seat to sit on it
/* {x, z, y: seat height above the floor, h: which way you face (three.js Y rotation; 0 faces +z), out: [dx, dz] where
   you stand up to, tent: the room it's in (null outdoors)} */
const SEATS=[];
for(const t of MESS_TABLES)for(const s of[-1,1])for(const dx of[-0.7,0.7])   // the benches either side (art/blender/yard.py MessTable)
  SEATS.push({x:t.x+dx,z:t.z+s*0.8,y:0.47,h:s>0?Math.PI:0,out:[0,s*0.8],tent:null,what:'the bench'});
for(const[bx,bz]of[[-12,42.3],[-26.5,39.2]])for(const dx of[-0.45,0.45])   // the yard benches (23-models.js CAMP_PROPS), facing the yard
  SEATS.push({x:bx+dx,z:bz,y:0.47,h:Math.PI,out:[0,-0.8],tent:null,what:'the bench'});
{
  const ti=TENTS.indexOf(D_TENT),cx=D_TENT.table.x,cz=D_TENT.table.z+1.75;   // the card table's centre (20-world.js)
  for(const[sx,sz]of[[-1.7,0],[1.7,0],[0,-1.7],[0,1.7]])
    SEATS.push({x:cx+sx,z:cz+sz,y:0.46,h:Math.atan2(-sx,-sz),out:[sx*0.45,sz*0.45],tent:ti,what:'the stool'});
}
const seatFloor=s=>s.tent!=null?TENT_FLOOR_Y:groundAt(s.x,s.z);
const bodyH=p=>((BODY_TYPES[(p.o||{}).body]||{h:1}).h);
/* pose any camper sitting at (x,z) on a seat whose top is at height y, facing h (mode 11: on an edge, legs dangling) */
function sitPose(p,x,y,z,h,dt,mode=10){p.g.position.set(x,y-SIT_HIP*bodyH(p),z);p.g.rotation.set(0,h,0);animPerson(p,mode,dt)}
function seatTaken(s){
  for(const R of remotes.values())if(R.anim===10&&(R.tx-s.x)**2+(R.tz-s.z)**2<0.16)return true;
  for(const b of bots){const g=b.p.g.position;if((g.x-s.x)**2+(g.z-s.z)**2<0.36&&b.state==='inside')return true}
  return false;
}
function sitSpot(){
  if(S.sit!=null)return{id:'sit',label:'Stand up',use:standUp};
  if(S.ko||S.inTown||S.inTruck||S.carry!=null||S.inBed!=null)return null;
  let best=null,bd=SIT_R*SIT_R;
  for(let i=0;i<SEATS.length;i++){const s=SEATS[i];if(s.tent!==(S.tent??null))continue;
    const d=(P.x-s.x)**2+(P.z-s.z)**2;if(d<bd&&!seatTaken(s)){bd=d;best=i}}
  return best!=null?{id:'sit',label:'Sit on '+SEATS[best].what,use:()=>sitDown(best)}:null;
}
/* sitting, F does what the seat's for: at the card table that's a hand of blackjack; anywhere else it's getting up */
function seatedSpot(){
  const s=SEATS[S.sit];if(s&&s.tent===TENTS.indexOf(D_TENT))return SPOTS.find(q=>q.id==='cards')||{id:'sit',label:'Stand up',use:standUp};
  return{id:'sit',label:'Stand up',use:standUp};
}
function sitDown(i){S.sit=i;P.moving=false;digHeld=false;sfx.thud()}
function standUp(){
  const s=SEATS[S.sit];S.sit=null;if(!s)return;
  P.x=s.x+s.out[0];P.z=s.z+s.out[1];P.y=seatFloor(s);P.vy=0;
}
/* every frame from updatePlayer while you're sitting (in place of walking): any move key gets you up */
function sitStep(dt){
  const s=SEATS[S.sit];
  if(!s||S.ko){S.sit=null;return}
  if(!uiOpen()&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].some(k=>KEYS[k])){standUp();return}
  sitPose(me,s.x,seatFloor(s)+s.y,s.z,s.h,dt);
  P.x=s.x;P.z=s.z;P.y=me.g.position.y;P.vy=0;P.grounded=true;P.moving=false;P.anim=10;P.fa=s.h;
}
