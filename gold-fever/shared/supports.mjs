import {mineDistance,mineFloor,mineBodyClear,mineRay,inMine,d3,releaseMine} from './mine.mjs';
import {WOOD,ensureForest} from './forestry.mjs';
export const SUPPORT={radius:2.6,spacing:4,creakAt:45,dangerAt:70,collapseAt:90};
const mark=(r,terrain=false)=>{r.dirty=true;r.revision++;if(terrain)r.mine.terrainRevision++;};
const no=message=>({ok:false,message}),ok=(message,extra={})=>({ok:true,message,...extra});
export function ceilingAt(m,x,y,z){for(let h=1.8;h<6;h+=.05)if(mineDistance(m,x,y+h,z)<0)return y+h;return null;}
function clearBetween(m,a,b){const n=Math.max(1,Math.ceil(d3(a,b)/.4));for(let i=0;i<=n;i++){const t=i/n;if(mineDistance(m,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t+1.1,a.z+(b.z-a.z)*t)<-.01)return false;}return true;}
export function initialSupport(m,p){
  return m.levels.some(y=>y<6&&Math.abs(p.y-y)<1.2&&((p.x>=-72&&p.x<=-62&&p.z>=24&&p.z<=32)||d3(p,{x:-71,y,z:30})<=SUPPORT.radius&&clearBetween(m,p,{x:-71,y,z:30})));
}
export function roofSupported(m,p){if(initialSupport(m,p))return true;return m.props.some(s=>s.type==='timber'&&!s.undermined&&d3(s,p)<=SUPPORT.radius&&clearBetween(m,s,p));}
export function ensureSupports(r){
  const m=r.mine;m.rubble??=[];m.risks??=[];m.registeredCuts??=0;
  for(let i=m.registeredCuts;i<m.brushes.length;i++){
    const b=m.brushes[i];if(!b.floor)continue;const p={x:b.b.x,y:b.floor.y+b.floor.sx*(b.b.x-b.floor.x)+b.floor.sz*(b.b.z-b.floor.z),z:b.b.z};
    if(m.risks.some(s=>d3(s,p)<1.6)||m.risks.length>=1200)continue;
    m.risks.push({id:'roof-'+b.id,...p,stress:0,supported:false,state:'stable',yaw:Math.atan2(-(b.b.x-b.a.x),-(b.b.z-b.a.z))});
  }
  m.registeredCuts=m.brushes.length;return m;
}
export function supportAction(r,p,a){
  if(a.type!=='craftSupport'&&!(a.type==='deploy'&&a.item==='timber'))return null;
  ensureForest(r);const m=ensureSupports(r);
  if(p.vehicle||p.cart||p.mineCart||p.hoistRide||p.busy||p.tumble||p.shovel?.mass)return no('Free your hands and empty the shovel before making a support.');
  if(a.type==='craftSupport'){
    if(p.wood<WOOD.supportCost)return no(`A support needs ${WOOD.supportCost} logs. Equip the axe with 3, chop a tree, then E collects its wood.`);
    if(p.kits.length>=24)return no('Your kit pack is full. Place some equipment first.');
    p.wood-=WOOD.supportCost;p.kits.push('timber');mark(r);return ok('Log support crafted. Choose it in B, then click a cleared tunnel floor.');
  }
  const index=p.kits.indexOf('timber');if(index<0)return no('Craft a support from four logs in B first.');
  const x=Number(a.x),z=Number(a.z),aimY=Number(a.y),yaw=Number(a.yaw);
  if(![x,z,aimY,yaw].every(Number.isFinite)||!inMine(x,z)||d3(p,{x,y:aimY,z})>4.5)return no('Place the frame on a nearby cleared underground floor.');
  const y=mineFloor(m,x,z,p.y);if(Math.abs(y-aimY)>.45||!mineBodyClear(m,x,y,z)||!clearBetween(m,p,{x,y,z}))return no('Clear a walkable tunnel floor before placing a frame.');
  if(m.props.some(s=>s.type==='timber'&&d3(s,{x,y,z})<1.5))return no('Frames are too close. Aim farther along the passage.');
  if(m.props.length>=120)return no('The mine has enough fixtures (120).');
  const height=ceilingAt(m,x,y,z);if(height===null||height-y<1.9)return no('The frame needs a solid roof with room to stand underneath.');
  const side={x:Math.cos(yaw),y:0,z:-Math.sin(yaw)},origin={x,y:y+1,z},left=mineRay(m,origin,side,2),right=mineRay(m,origin,{x:-side.x,y:0,z:-side.z},2);
  const half=Math.max(.75,Math.min(1.1,(left?.distance??1.35)-.18,(right?.distance??1.35)-.18));
  m.props.push({id:'prop'+r.nextId++,type:'timber',x,y,z,yaw,width:half*2,height:Math.min(4.5,height-y-.08),undermined:false});p.kits.splice(index,1);
  for(const s of m.risks)if(roofSupported(m,s)){s.supported=true;s.stress=0;s.state='supported';s.warned=0;}
  mark(r);return ok('Roof braced. Keep frames roughly four metres apart, including every branch.');
}
function collapse(r,s,now){
  const m=r.mine,rubble={id:'fall'+r.nextId++,x:s.x,y:mineFloor(m,s.x,s.z,s.y),z:s.z,yaw:s.yaw,radius:1.45,height:2.25,remaining:36,total:36};
  m.rubble.push(rubble);s.rubble=rubble.id;s.state='collapsed';mark(r,true);
  for(const p of Object.values(r.players)){
    if(!p.active||p.fly||p.hoistRide||d3(p,rubble)>3.1)continue;
    releaseMine(r,p);p.shovelPlant=null;let safe=null;
    for(const d of[2.4,3.2,4])for(const angle of[s.yaw+Math.PI,s.yaw,s.yaw+Math.PI/2,s.yaw-Math.PI/2]){if(safe)break;const x=s.x-Math.sin(angle)*d,z=s.z-Math.cos(angle)*d,y=mineFloor(m,x,z,p.y);if(mineBodyClear(m,x,y,z))safe={x,y,z};}
    if(!safe&&p.mineSafe&&mineBodyClear(m,p.mineSafe.x,p.mineSafe.y,p.mineSafe.z))safe=p.mineSafe;
    if(!safe)safe={x:-68,y:m.levels.filter(y=>y<6).sort((a,b)=>Math.abs(a-p.y)-Math.abs(b-p.y))[0]??6,z:30};
    Object.assign(p,safe,{vy:0,muddyUntil:now+2500});
  }
  return {mineRubble:m.rubble.map(b=>({...b})),broadcast:'CAVE-IN! Get clear. Shovel the fallen rock away, then brace the roof with log supports.',effect:{type:'caveIn',x:s.x,y:rubble.y+2,z:s.z}};
}
export function tickStability(r,dt,now){
  const m=ensureSupports(r),events=[];m.supportClock=(m.supportClock||0)+dt;if(m.supportClock<1)return events;const elapsed=m.supportClock;m.supportClock=0;
  for(const p of m.props)if(p.type==='timber')p.undermined=mineFloor(m,p.x,p.z,p.y)<p.y-.4;
  for(const s of m.risks){
    const block=m.rubble.find(b=>b.id===s.rubble&&b.remaining>0);if(block){s.state='collapsed';continue;}
    if(s.state==='collapsed'){s.stress=30;s.warned=0;delete s.rubble;}
    const floor=mineFloor(m,s.x,s.z,s.y);if(!mineBodyClear(m,s.x,floor,s.z)){s.state='buried';continue;}s.y=floor;
    s.roofY=ceilingAt(m,s.x,s.y,s.z);s.supported=s.roofY===null||roofSupported(m,s);
    if(s.supported){s.stress=Math.max(0,s.stress-elapsed*8);s.state='supported';if(!s.stress)s.warned=0;continue;}
    s.stress=Math.min(SUPPORT.collapseAt,s.stress+elapsed);s.state=s.stress>=SUPPORT.dangerAt?'danger':s.stress>=SUPPORT.creakAt?'creaking':'unbraced';r.dirty=true;
    if(s.stress>=SUPPORT.collapseAt){events.push(collapse(r,s,now));continue;}
    const nearby=Object.values(r.players).some(p=>p.active&&d3(p,s)<7);
    if(nearby&&s.stress>=SUPPORT.creakAt&&!(s.warned&1)){s.warned=(s.warned||0)|1;events.push({broadcast:'Roof creaking! Craft log supports with B and brace this tunnel. Keep frames about 4m apart.',effect:{type:'roofCrack',x:s.x,y:s.roofY,z:s.z}});}
    if(nearby&&s.stress>=SUPPORT.dangerAt&&!(s.warned&2)){s.warned=(s.warned||0)|2;events.push({broadcast:'ROOF COMING DOWN — brace it or back away! About 20 seconds left.',effect:{type:'roofCrack',x:s.x,y:s.roofY,z:s.z}});}
  }
  for(const p of Object.values(r.players))if(p.active&&p.y<4&&roofSupported(m,p)&&mineBodyClear(m,p.x,p.y,p.z))p.mineSafe={x:p.x,y:p.y,z:p.z};
  return events;
}
export function stabilityPublic(m,p){return (m.risks||[]).filter(s=>s.state!=='buried'&&d3(s,p)<16).sort((a,b)=>d3(a,p)-d3(b,p)).slice(0,18).map(({id,x,y,z,stress,state,supported,roofY})=>({id,x,y,z,stress,state,supported,roofY}));}
