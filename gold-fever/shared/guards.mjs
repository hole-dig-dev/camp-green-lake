import {inCanyon,canyonCenter,CANYON_BRIDGE} from './canyon.mjs';
import {baseHeight} from './world.mjs';
import {mineStep,mineFloor,mineBodyClear,mineDistance,d3} from './mine.mjs';
import {takeCargo} from './cargo.mjs';
import {looseSoil} from './soil.mjs';
export const GUARD_RULES={notice:24,noise:34,speed:3.15,reach:1.85,windup:1000,dance:1800,hitAt:420,recovery:2300,immunity:4200};
const homes=[[-58,canyonCenter(-58)+3,'GRUMBLE GUS'],[-5,canyonCenter(-5)-2,'OLD MAN ORE'],[55,canyonCenter(55)+2,'BOOT SCOOT BILL'],[28,CANYON_BRIDGE.z+15,'BRIDGE BERT']];
const nav=new WeakMap();
export function ensureGuards(r){
  r.guards??=homes.map(([x,z,name],i)=>({id:'guard'+i,name,x,z,y:i===3?CANYON_BRIDGE.y:baseHeight(x,z)+.3,vy:0,yaw:i===3?0:Math.PI/2,home:{x,z,y:i===3?CANYON_BRIDGE.y:baseHeight(x,z)},state:'patrol',stateAt:0,until:0,target:null,turn:i%2?1:-1}));return r.guards;
}
export function guardSight(m,g,p){
  const a={x:g.x,y:g.y+1.3,z:g.z},b={x:p.x,y:p.y+1.15,z:p.z},n=Math.ceil(d3(a,b)/.45);
  for(let i=1;i<n;i++){const t=i/n;if(mineDistance(m,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t)<-.02)return false;}return true;
}
function eligible(p,now){return p.active&&inCanyon(p.x,p.z)&&!p.fly&&!p.vehicle&&!p.hoistRide&&!p.mineCart&&!p.cart&&!p.tumble&&now>(p.guardSafeUntil||0);}
function floorNode(m,x,z,y){
  if(!inCanyon(x,z))return null;const natural=baseHeight(x,z),from=Math.abs(natural-y)<2.2?natural+.8:y+.65;
  let floor=mineFloor(m,x,z,from);for(const dx of[-.25,.25])for(const dz of[-.25,.25])floor=Math.max(floor,mineFloor(m,x+dx,z+dz,from));
  return mineBodyClear(m,x,floor,z)?{x,y:floor,z}:null;
}
// Bounded search, rebuilt only when a chase route changes. Every step still uses terrain collision.
function route(m,g,p){
  const start=floorNode(m,Math.round(g.x/2)*2,Math.round(g.z/2)*2,g.y);if(!start)return [];
  const key=n=>`${n.x},${n.z},${Math.round(n.y)}`,h=n=>Math.hypot(n.x-p.x,n.z-p.z)+Math.abs(n.y-p.y)*1.8;
  const first={...start,cost:0,score:h(start),parent:null},open=[first],seen=new Map([[key(first),0]]);let best=first;
  for(let visited=0;open.length&&visited<420;visited++){
    let pick=0;for(let i=1;i<open.length;i++)if(open[i].score<open[pick].score)pick=i;const a=open.splice(pick,1)[0];if(h(a)<h(best))best=a;if(h(a)<2.2)break;
    for(const [dx,dz]of[[2,0],[-2,0],[0,2],[0,-2]]){const n=floorNode(m,a.x+dx,a.z+dz,a.y);if(!n||Math.abs(n.y-a.y)>1.75)continue;const cost=a.cost+2+Math.abs(n.y-a.y)*.4,k=key(n);if((seen.get(k)??Infinity)<=cost)continue;seen.set(k,cost);open.push({...n,cost,score:cost+h(n),parent:a});}
  }
  const path=[];for(let a=best;a?.parent;a=a.parent)path.unshift({x:a.x,y:a.y,z:a.z});return path;
}
function walk(r,g,goal,dt,now,chasing=false){
  let data=nav.get(g);if(!data){data={path:[],next:0,stuck:0,revision:-1};nav.set(g,data);}
  let target=goal;if(chasing){
    if(now>data.next||data.revision!==r.mine.terrainRevision||!data.goal||d3(data.goal,goal)>3){data.path=route(r.mine,g,goal);data.next=now+1600;data.goal={x:goal.x,y:goal.y,z:goal.z};data.revision=r.mine.terrainRevision;}
    while(data.path.length&&Math.hypot(data.path[0].x-g.x,data.path[0].z-g.z)<.55)data.path.shift();if(data.path.length)target=data.path[0];
  }
  const dx=target.x-g.x,dz=target.z-g.z,before={x:g.x,z:g.z};if(Math.hypot(dx,dz)>.2)g.yaw=Math.atan2(-dx,-dz);
  mineStep(r.mine,g,{forward:Math.hypot(dx,dz)>.2?1:0},chasing?GUARD_RULES.speed:1.15,dt);
  data.stuck=Math.hypot(g.x-before.x,g.z-before.z)<.003?data.stuck+dt:0;
  if(data.stuck>1.2){data.next=0;if(!chasing){g.turn=-g.turn;g.patrol=null;}data.stuck=0;}
}
function enter(g,state,now,duration=0){g.state=state;g.stateAt=now;g.until=now+duration;}
export function applyGuardKnock(m,p,dt,now){
  const k=p.guardKnock;if(!k||now>k.until)return;const yaw=p.yaw,vy=p.vy; p.yaw=Math.atan2(-k.x,-k.z);
  mineStep(m,p,{forward:1},7*Math.max(.15,(k.until-now)/480),dt);p.yaw=yaw;p.vy=Math.max(p.vy||0,vy||0);
}
export function tickGuards(r,dt,now){
  const events=[],guards=ensureGuards(r),players=Object.values(r.players);
  if(!players.some(p=>p.active))return events;
  for(const g of guards){
    const candidates=players.filter(p=>eligible(p,now)),old=candidates.find(p=>p.id===g.target);
    if(g.state==='dance'){
      if(!g.hit&&now-g.stateAt>=GUARD_RULES.hitAt){g.hit=true;const p=players.find(p=>p.id===g.target);
        if(p&&eligible(p,now)&&d3(g,p)<GUARD_RULES.reach+.2&&guardSight(r.mine,g,p)){
          const dx=p.x-g.x,dz=p.z-g.z,len=Math.hypot(dx,dz)||1;p.guardKnock={x:dx/len,z:dz/len,until:now+480};p.guardSafeUntil=now+GUARD_RULES.immunity;p.shovelPlant=null;
          let spilled=false;if(!p.bucketPos&&p.cargo.mass){const part=takeCargo(p.cargo,Math.min(4,p.cargo.mass*.15));looseSoil(r,part,p.x,p.z,p.y);spilled=true;}
          r.dirty=true;events.push({effect:{type:'guardBump',x:p.x,y:p.y+1,z:p.z,player:p.id,guard:g.id},player:p.id,result:{ok:true,message:`${g.name} delivered a backside bump! ${spilled?'Your spilled dirt is recoverable. ':''}Sprint away while he dances.`}});
        }
      }
      if(now>=g.until)enter(g,'recover',now,GUARD_RULES.recovery);continue;
    }
    if(g.state==='recover'){mineStep(r.mine,g,{},0,dt);if(now>=g.until){enter(g,'patrol',now);g.target=null;}continue;}
    if(g.state==='windup'){
      if(!old||d3(g,old)>3.4||!guardSight(r.mine,g,old)){enter(g,'recover',now,700);continue;}
      g.yaw=Math.atan2(-(old.x-g.x),-(old.z-g.z));if(now>=g.until){g.yaw+=Math.PI;g.hit=false;enter(g,'dance',now,GUARD_RULES.dance);events.push({effect:{type:'guardDance',x:g.x,y:g.y+1,z:g.z,guard:g.id}});}continue;
    }
    let target=old;
    if(!target||d3(g,target)>38||now>(g.seenUntil||0)){
      target=candidates.filter(p=>d3(g,p)<GUARD_RULES.notice&&guardSight(r.mine,g,p)).sort((a,b)=>d3(g,a)-d3(g,b))[0];
      if(target&&g.target!==target.id)events.push({effect:{type:'guardShout',x:g.x,y:g.y+1,z:g.z,guard:g.id},player:target.id,result:{ok:true,message:`${g.name}: GET OUT OF OUR GORGE! Run, or dodge the wind-up!`}});
      g.target=target?.id||null;if(target)g.seenUntil=now+6000;
    }
    if(target){if(guardSight(r.mine,g,target))g.seenUntil=now+6000;enter(g,'chase',g.state==='chase'?g.stateAt:now);
      if(d3(g,target)<GUARD_RULES.reach&&guardSight(r.mine,g,target)){enter(g,'windup',now,GUARD_RULES.windup);events.push({effect:{type:'guardWindup',x:g.x,y:g.y+1,z:g.z,guard:g.id}});}else walk(r,g,target,dt,now,true);
    }else{if(g.state!=='patrol')enter(g,'patrol',now);if(!g.patrol||Math.hypot(g.x-g.patrol.x,g.z-g.patrol.z)<.6)g.patrol={x:g.home.x+(g.id==='guard3'?0:g.turn*3),z:g.home.z+(g.id==='guard3'?g.turn*5:g.turn*2),y:g.home.y};if(Math.hypot(g.x-g.patrol.x,g.z-g.patrol.z)<.7)g.turn=-g.turn;walk(r,g,g.patrol,dt,now);}
  }
  return events;
}
export function guardsPublic(r){return ensureGuards(r).map(({id,name,x,y,z,yaw,state,stateAt,until,target})=>({id,name,x,y,z,yaw,state,stateAt,until,target}));}
