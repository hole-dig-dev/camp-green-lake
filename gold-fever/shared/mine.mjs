// Engine-neutral volumetric mine and rail logistics. Metres, Y up; one-metre rock cells.
import {clamp,random,heightAt} from './world.mjs';
import {emptyCargo,addCargo,takeCargo} from './cargo.mjs';
export const MINE={minX:-88,maxX:-40,minZ:-12,maxZ:36,minY:-32,top:6,shaftX:-64,shaftZ:30,cellSize:1};
export const mineKey=(x,y,z)=>`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
export const inMine=(x,z)=>x>=MINE.minX&&x<MINE.maxX&&z>=MINE.minZ&&z<MINE.maxZ;
export const d3=(a,b)=>Math.hypot(a.x-b.x,(a.y??MINE.top)-(b.y??MINE.top),a.z-b.z);
const mark=(r,terrain=false)=>{r.dirty=true;r.revision++;if(terrain)r.mine.terrainRevision++;};
const ok=(message='',extra={})=>({ok:true,message,...extra}),no=message=>({ok:false,message});
export function ensureMine(r){r.mine??={version:1,terrainRevision:0,removed:{},levels:[6,-6],tracks:[],carts:[],props:[],hoist:null};return r.mine;}
export function shaftPoint(x,z){return x>=-66&&x<-62&&z>=28&&z<32;}
function initialAir(m,x,y,z){
  if(shaftPoint(x+.5,z+.5)&&y>=Math.min(...m.levels)&&y<MINE.top)return true;
  return m.levels.filter(l=>l<MINE.top).some(l=>x>=-72&&x<-62&&z>=24&&z<32&&y>=l&&y<l+3);
}
export function mineSolid(m,x,y,z){
  if(!m||!inMine(x,z)||y>=MINE.top)return false;
  if(y<MINE.minY)return true;
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
  return !initialAir(m,ix,iy,iz)&&!m.removed[mineKey(ix,iy,iz)];
}
export function mineGrade(seed,x,y,z){
  const veinX=-74+Math.sin(z*.19+y*.12)*3,veinZ=14+Math.sin(y*.26)*8;
  const rich=Math.exp(-((x-veinX)**2/6+(z-veinZ)**2/80));
  return (.0002+rich*.11)*(.4+random(seed,Math.floor(x),Math.floor(z),Math.floor(y)+300)*1.2);
}
export function mineRay(m,origin,dir,max=5){
  for(let t=0;t<=max;t+=.06){const x=origin.x+dir.x*t,y=origin.y+dir.y*t,z=origin.z+dir.z*t;if(mineSolid(m,x,y,z))return {x,y,z,ix:Math.floor(x),iy:Math.floor(y),iz:Math.floor(z),key:mineKey(x,y,z),distance:t,mine:true};}return null;
}
export function mineFloor(m,x,z,y=6){
  const h=m?.hoist;
  if(h&&Math.abs(x+64)<1.15&&Math.abs(z-30)<1.15&&y>=h.y-.08&&y<h.y+2.5)return h.y;
  for(let py=Math.min(MINE.top,Math.floor(y+.05));py>=MINE.minY-1;py--)if(mineSolid(m,x,py-.02,z))return py;
  return MINE.minY;
}
export function groundAt(r,x,z,y=6){return inMine(x,z)&&r.mine?mineFloor(r.mine,x,z,y):heightAt(x,z,r.cells);}
export function mineBodyClear(m,x,y,z){
  for(const dx of[-.25,.25])for(const dz of[-.25,.25])for(const dy of[.08,.90,1.72])if(mineSolid(m,x+dx,y+dy,z+dz))return false;return true;
}
export function mineStep(m,p,input,speed,dt){
  // Shared client/server capsule collision, including ceiling, gravity and a permanently usable ladder.
  const steps=Math.max(1,Math.ceil(dt/.016)),step=dt/steps;
  const f=Number(input.forward)||0,r=Number(input.right)||0,n=Math.max(1,Math.hypot(f,r));
  for(let j=0;j<steps;j++){
    const dx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*r)/n*speed*step,dz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*r)/n*speed*step;
    if(mineBodyClear(m,p.x+dx,p.y,p.z))p.x+=dx;if(mineBodyClear(m,p.x,p.y,p.z+dz))p.z+=dz;
    const ladder=Math.hypot(p.x+65.35,p.z-31.35)<.85&&p.y>=Math.min(...m.levels)-.1&&p.y<MINE.top+.1;
    const vertical=Number(input.vertical)||0;
    if(ladder&&vertical){const y=clamp(p.y+vertical*2.8*step,Math.min(...m.levels),MINE.top);if(mineBodyClear(m,p.x,y,p.z))p.y=y;p.vy=0;continue;}
    const floor=mineFloor(m,p.x,p.z,p.y);if(input.jump&&p.y<=floor+.08)p.vy=5.6;
    p.vy=(p.vy||0)-15*step;const ny=p.y+p.vy*step;
    if(p.vy<=0&&ny<floor){p.y=floor;p.vy=0;}else if(mineBodyClear(m,p.x,ny,p.z))p.y=ny;else p.vy=0;
  }
}
export function digMine(r,p,target,rules,now,physical=false){
  const m=ensureMine(r),x=Number(target.x),y=Number(target.y),z=Number(target.z);
  if(![x,y,z].every(Number.isFinite)||!inMine(x,z)||y<MINE.minY||y>=MINE.top)return no('Choose exposed rock inside the mining claim.');
  if(p.vehicle||p.cart||p.mineCart||p.hoistRide||p.busy||p.shovel?.mass)return no('Free your hands and empty the shovel before mining.');
  if(now<p.digUntil)return {ok:false,quiet:true};
  const eye={x:p.x,y:p.y+1.65,z:p.z},delta={x:x-eye.x,y:y-eye.y,z:z-eye.z},len=Math.hypot(delta.x,delta.y,delta.z);
  if(len>rules.player.reach||len<.01)return no('Move closer to the exposed rock.');
  const hit=mineRay(m,eye,{x:delta.x/len,y:delta.y/len,z:delta.z/len},len+.15);
  if(!hit||hit.key!==mineKey(x,y,z))return no('Dig exposed rock; solid walls block your reach.');
  const keys=[hit.key];
  // A face-level cut clears the foot cell too, making a walkable two-metre passage.
  if(hit.iy>=Math.floor(p.y)+1&&hit.iy<=Math.floor(p.y)+2&&mineSolid(m,hit.ix,hit.iy-1,hit.iz))keys.push(mineKey(hit.ix,hit.iy-1,hit.iz));
  const cargo=physical?emptyCargo():p.cargo,mass=keys.length*6,capacity=physical?Infinity:(p.upgrades.includes('bucket')?64:rules.player.bucketKg);
  if(cargo.mass+mass>capacity+.001)return no('Bucket full. Catch into a mine cart or unload it with E.');
  for(const k of keys){const[ix,iy,iz]=k.split(',').map(Number);m.removed[k]=1;addCargo(cargo,{mass:6,goldMg:Math.round(mineGrade(r.seed,ix,iy,iz)*6000),x:ix+.5,z:iz+.5});}
  if(physical){p.shovel=cargo;p.shovelPlant=null;}p.digUntil=now+(p.upgrades.includes('shovel')?650:1000);p.stats.dug+=mass;r.totalDugKg+=mass;mark(r,true);
  return ok('',{...(physical?{shovel:'loaded'}:{}),minePatches:keys,effect:{type:'dig',x,y,z,player:p.id}});
}
const trackKey=(x,y,z)=>`${Math.round(x/2)*2},${Math.round(y)},${Math.round(z/2)*2}`;
export function trackAt(m,x,y,z){const k=trackKey(x,y,z);return m.tracks.find(t=>t.key===k);}
function clearRail(m,x,y,z){for(const a of[-.65,0,.65])for(const b of[-.65,0,.65])if(!mineBodyClear(m,x+a,y,z+b)||Math.abs(mineFloor(m,x+a,z+b,y)-y)>.1)return false;return true;}
export function deployMine(r,p,a){
  const m=ensureMine(r),idx=p.kits.indexOf(a.item);if(idx<0)return no('Buy that mine equipment at Mabel’s first.');
  if(p.vehicle||p.cart||p.mineCart||p.busy||p.hoistRide)return no('Free your hands before building.');
  const x=Math.round(Number(a.x)/2)*2,z=Math.round(Number(a.z)/2)*2,y=Math.round(Number(a.y));
  if(![x,y,z].every(Number.isFinite)||!inMine(x,z)||d3(p,{x,y,z})>8)return no('Build nearby, inside the mine claim.');
  let message='';
  if(a.item==='minetrack'){
    if(m.tracks.length>=300)return no('Track limit reached (300 sections).');
    if(trackAt(m,x,y,z))return no('Track already occupies that position.');
    if(!clearRail(m,x,y,z))return no('Clear a two-metre-wide tunnel with a level floor first.');
    const axis=Math.abs(Math.sin(Number(a.yaw)||0))>.7?'x':'z';m.tracks.push({id:`rail${r.nextId++}`,key:trackKey(x,y,z),x,y,z,axis});message='Track laid. Sections snap to a two-metre grid; corners connect automatically.';
  }else if(a.item==='minecart'){
    const t=trackAt(m,x,y,z);if(!t)return no('Lay track before placing a mine cart.');
    if(m.carts.length>=12||m.carts.some(c=>d3(c,t)<1.8))return no('Leave space for another cart (maximum 12).');
    m.carts.push({id:`ore${r.nextId++}`,x,y,z,rail:t.id,yaw:t.axis==='x'?-Math.PI/2:0,cargo:emptyCargo(),operator:null,brake:true});message='Mine cart ready. Q takes the handle, W pushes toward your aim, E loads, X retrieves, F brakes.';
  }else if(['hoist','steamhoist','shaftkit'].includes(a.item)){
    if(Math.hypot(p.x+64,p.z-30)>6)return no('Install hoist equipment beside the claim’s shaft.');
    if(a.item==='hoist'){if(m.hoist)return no('This shaft already has a cage hoist.');m.hoist={y:6,target:6,powered:false,moving:false,cart:null,riders:[]};message='Cage hoist installed. L calls it; I raises, K lowers. E boards or exits. You can crank from inside.';}
    if(a.item==='steamhoist'){if(!m.hoist)return no('Install the cage hoist first.');if(m.hoist.powered)return no('The hoist already has steam power.');m.hoist.powered=true;message='Steam hoist fitted. Tap I/K to travel automatically to the next landing.';}
    if(a.item==='shaftkit'){const bottom=Math.min(...m.levels)-6;if(bottom<-30)return no('The shaft has reached this claim’s 36-metre depth limit.');m.levels.push(bottom);mark(r,true);message=`Shaft extended to ${6-bottom} metres deep. Guides, ladder and a new landing are included.`;}
  }else if(['minelamp','timber'].includes(a.item)){
    if(!mineBodyClear(m,x,y,z))return no('Clear space for that equipment.');if(m.props.length>=120)return no('The mine has enough fixtures (120).');
    m.props.push({id:`prop${r.nextId++}`,type:a.item,x,y,z});message=a.item==='minelamp'?'Lantern installed.':'Timber frame installed. Supports are visual in this prototype; cave-ins come later.';
  }else return no('Unknown mine kit.');
  p.kits.splice(idx,1);mark(r);return ok(message,{mineRebuild:a.item==='shaftkit'});
}
export function mineAction(r,p,a,rules,now){
  const m=ensureMine(r);
  if(a.type==='mineDig')return digMine(r,p,a,rules,now);
  if(a.type==='deploy'&&['minetrack','minecart','hoist','steamhoist','shaftkit','minelamp','timber'].includes(a.item))return deployMine(r,p,a);
  if(!['mineCart','mineLoad','mineRetrieve','mineBrake','mineTip','hoistCall','hoistBoard','mineRecover'].includes(a.type))return null;
  if(p.vehicle||p.cart||p.busy||p.tumble)return no('Free your hands and stand up first.');
  if(a.type==='mineRecover'){
    const pile=r.spills.find(s=>s.id===a.target);if(!pile||d3(p,{...pile,y:pile.y??heightAt(pile.x,pile.z,r.cells)})>3.8)return no('Stand beside the spilled material.');
    const capacity=p.upgrades.includes('bucket')?64:rules.player.bucketKg,part=takeCargo(pile.cargo,capacity-p.cargo.mass);if(!part.mass)return no('Your bucket is full.');addCargo(p.cargo,part);r.spills=r.spills.filter(s=>s.cargo.mass>1e-8);mark(r);return ok(`Recovered ${part.mass.toFixed(0)} kg.`);
  }
  const h=m.hoist;
  if(a.type.startsWith('hoist')){
    if(!h)return no('Buy and install a cage hoist. The ladder works before that.');
    if(Math.hypot(p.x+64,p.z-30)>5)return no('Stand at a shaft landing or inside the cage.');
    if(a.type==='hoistCall'){if(p.hoistRide)return no('Use I/K while aboard.');const landing=m.levels.find(l=>Math.abs(l-p.y)<1.2);if(landing===undefined)return no('Call the cage from a landing.');h.target=landing;h.call=true;mark(r);return ok('Cage called. The empty cage can travel without another operator.');}
    if(p.hoistRide){if(h.moving)return no('Wait for the cage to stop at a landing.');if(!m.levels.some(l=>Math.abs(l-h.y)<.05))return no('Raise or lower the cage to a landing first.');p.hoistRide=false;h.riders=h.riders.filter(id=>id!==p.id);p.x=-66.7;p.z=30;p.y=h.y;
      if(h.cart){const c=m.carts.find(c=>c.id===h.cart);if(c&&p.mineCart===c.id){c.x=-68;c.z=30;c.y=h.y;c.rail=trackAt(m,c.x,c.y,c.z)?.id||null;h.cart=null;}}
      mark(r);return ok('At the landing. Cart released onto the landing rails.',{resync:true});}
    if(h.moving||Math.abs(p.y-h.y)>1)return no('L calls the cage to this landing.');if(h.riders.length>=8)return no('The cage is full.');
    const c=m.carts.find(c=>c.id===p.mineCart);if(c){if(h.cart&&h.cart!==c.id)return no('One cart fits in this cage.');if(d3(c,{x:-64,y:h.y,z:30})>5)return no('Push the cart to the shaft first.');h.cart=c.id;c.x=-64;c.z=30;c.y=h.y;c.brake=true;}
    p.hoistRide=true;p.x=-64.55;p.z=30;p.y=h.y;p.vy=0;if(!h.riders.includes(p.id))h.riders.push(p.id);mark(r);return ok('Cart latched. Hold I up / K down; E exits at a landing.',{resync:true});
  }
  const c=m.carts.find(c=>c.id===(a.target||p.mineCart));if(!c||d3(p,c)>4)return no('Stand beside the mine cart.');
  if(a.type==='mineLoad'){const part=takeCargo(p.cargo,240-c.cargo.mass);if(!part.mass)return no('Your bucket is empty or the cart is full.');addCargo(c.cargo,part);mark(r);return ok(`Loaded ${part.mass.toFixed(0)} kg into the mine cart.`);}
  if(a.type==='mineRetrieve'){const part=takeCargo(c.cargo,(p.upgrades.includes('bucket')?64:rules.player.bucketKg)-p.cargo.mass);if(!part.mass)return no('The cart is empty or your bucket is full.');addCargo(p.cargo,part);mark(r);return ok(`Retrieved ${part.mass.toFixed(0)} kg for processing.`);}
  if(a.type==='mineBrake'){c.brake=!c.brake;mark(r);return ok(c.brake?'Cart brake on.':'Cart brake released.');}
  if(a.type==='mineTip'){if(c.operator&&c.operator!==p.id)return no('Your friend has this cart.');if(!c.cargo.mass)return no('The cart is empty.');r.spills.push({id:`s${r.nextId++}`,x:c.x+.8,y:c.y,z:c.z,cargo:takeCargo(c.cargo,c.cargo.mass)});c.brake=true;mark(r);return ok('Cart tipped. X recovers the pile; its gold stays inside.');}
  if(p.hoistRide)return no('Exit the cage first.');
  if(p.mineCart===c.id){c.operator=null;c.brake=true;p.mineCart=null;mark(r);return ok('Cart parked.');}
  if(c.operator)return no('Your friend is pushing this cart.');if(p.shovel?.mass)return no('Empty your shovel first.');c.operator=p.id;p.mineCart=c.id;c.brake=false;mark(r);return ok('W pushes toward your aim; S pulls back. F brakes. Q parks and releases.');
}
export function releaseMine(r,p){const m=ensureMine(r);const c=m.carts.find(c=>c.id===p.mineCart);if(c){c.operator=null;c.brake=true;}p.mineCart=null;p.hoistRide=false;if(m.hoist)m.hoist.riders=m.hoist.riders.filter(id=>id!==p.id);}
export function tickMine(r,dt,now){
  const m=ensureMine(r),h=m.hoist;
  if(h){
    h.riders=h.riders.filter(id=>Object.values(r.players).some(p=>p.id===id&&p.active&&p.hoistRide));
    const users=Object.values(r.players).filter(p=>p.active&&now-p.lastInput<600&&(p.hoistRide||Math.hypot(p.x+64,p.z-30)<4&&m.levels.some(l=>Math.abs(l-p.y)<1)));
    const direction=users.some(p=>p.input.hoistUp)?1:users.some(p=>p.input.hoistDown)?-1:0;
    if(direction&&Math.abs(h.target-h.y)<.05){const levels=[...m.levels].sort((a,b)=>a-b),next=direction>0?levels.find(l=>l>h.y+.1):levels.toReversed().find(l=>l<h.y-.1);if(next!==undefined){h.target=next;h.call=false;}}
    const run=h.call||h.powered||direction;const delta=h.target-h.y;
    h.moving=!!run&&Math.abs(delta)>.001;
    if(h.moving){h.y+=Math.sign(delta)*Math.min(Math.abs(delta),dt*(h.powered?2.6:1.2));r.dirty=true;}
    const c=m.carts.find(c=>c.id===h.cart);if(c){c.x=-64;c.z=30;c.y=h.y;}
    for(const p of Object.values(r.players))if(p.hoistRide){p.x=-64.55;p.z=30;p.y=h.y;p.vy=0;if(Number.isFinite(p.input.yaw))p.yaw=p.input.yaw;}
  }
  for(const c of m.carts){
    if(c.id===h?.cart)continue;const p=Object.values(r.players).find(p=>p.active&&p.id===c.operator);
    if(!p){c.operator=null;c.brake=true;continue;}if(p.hoistRide)continue;if(Number.isFinite(p.input.yaw))p.yaw=p.input.yaw;
    const input=now-p.lastInput<600?p.input:{},f=Number(input.forward)||0;
    if(f&&!c.brake){
      const dx=-Math.sin(p.yaw)*Math.sign(f),dz=-Math.cos(p.yaw)*Math.sign(f),axis=Math.abs(dx)>Math.abs(dz)?'x':'z',sign=Math.sign(axis==='x'?dx:dz),speed=2.2*(1-c.cargo.mass/240*.45),nx=c.x+(axis==='x'?sign*speed*dt:0),nz=c.z+(axis==='z'?sign*speed*dt:0);
      const rail=trackAt(m,nx,c.y,nz),onCage=h&&Math.abs(h.y-c.y)<.05&&Math.abs(nx+64)<1.2&&Math.abs(nz-30)<1.2;
      if((rail||onCage)&&mineBodyClear(m,nx,c.y,nz)&&!m.carts.some(other=>other!==c&&d3(other,{x:nx,y:c.y,z:nz})<1.2)){
        c.x=nx;c.z=nz;if(rail)c.rail=rail.id;c.yaw=axis==='x'?(sign>0?-Math.PI/2:Math.PI/2):(sign>0?Math.PI:0);r.dirty=true;
      }
    }
    // The handle remains within the same cleared rail tile; releasing always parks the cart.
    const px=c.x+Math.sin(c.yaw)*.8,pz=c.z+Math.cos(c.yaw)*.8;
    if(mineBodyClear(m,px,c.y,pz)){p.x=px;p.z=pz;p.y=c.y;}else{p.x=c.x;p.z=c.z;p.y=c.y;}p.vy=0;
  }
}
export function minePublic(m){if(!m)return null;return {...m,removed:undefined,carts:m.carts.map(c=>({...c,capacity:240,cargo:{mass:c.cargo.mass}}))};}
