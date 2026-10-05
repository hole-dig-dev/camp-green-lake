// Engine-neutral mechanical upgrades. Cargo remains conserved during transport and mishaps.
import {heightAt,distance,clamp} from './world.mjs';
import {takeCargo,addCargo} from './cargo.mjs';
import {soilReceivers} from './soil.mjs';
export function feederPose(m,cells={}){const y=heightAt(m.x,m.z,cells);return {inlet:{x:m.x,y:y+1.3,z:m.z},outlet:{x:m.x-Math.sin(m.yaw)*4.4,y:y+2.65,z:m.z-Math.cos(m.yaw)*4.4}};}
const dirty=r=>{r.dirty=true;r.revision++;};
export function fitRockerDrive(r,p,a){
 if(a.type!=='deploy'||a.item!=='rockerdrive')return null;
 const index=p.kits.indexOf('rockerdrive'),x=Number(a.x),z=Number(a.z);
 if(index<0)return {ok:false,message:'Buy a treadle motor kit at Mabel’s first.'};
 if(!Number.isFinite(x)||!Number.isFinite(z)||distance(p,{x,z})>10)return {ok:false,message:'Stand near your rocker and aim beside it.'};
 const m=r.machines.find(m=>m.type==='rocker'&&distance(m,{x,z})<2.8&&distance(p,m)<10&&!m.powered);
 if(!m)return {ok:false,message:'Aim beside an unpowered rocker box to fit the motor.'};
 p.kits.splice(index,1);m.powered=true;dirty(r);return {ok:true,message:'Treadle motor fitted. This rocker now washes without someone holding the crank.',effect:{type:'motorFit',x:m.x,y:heightAt(m.x,m.z,r.cells)+1,z:m.z},broadcast:true};
}
export function tickAutomation(r,rules,dt,now){
 const events=[],players=Object.values(r.players);r.clods??=[];r.spills??=[];
 for(const m of r.machines){
  if(m.type!=='feeder')continue;const cfg=rules.catalog.find(c=>c.id==='feeder'),pose=feederPose(m,r.cells);m.strain??=0;m.clearProgress??=0;m.launchClock??=0;m.processed??=0;
  const helper=players.find(p=>p.active&&!p.vehicle&&!p.cart&&!p.tumble&&!p.busy&&now-p.lastInput<600&&p.input.help&&distance(p,m)<2.6&&Math.abs(p.y-heightAt(m.x,m.z,r.cells))<2);
  m.helper=helper?.id||null;
  if(m.jammed){
   m.running=false;m.clearProgress=helper?m.clearProgress+dt:Math.max(0,m.clearProgress-dt*.5);
   if(m.clearProgress>=2){
    m.jammed=false;m.strain=0;m.clearProgress=0;m.launchClock=0;
    const mass=Math.min(12,m.cargo.mass);for(let i=0;i<3&&mass>0&&r.clods.length<150;i++){
     const cargo=takeCargo(m.cargo,mass/3),dx=helper.x-m.x,dz=helper.z-m.z;
     r.clods.push({id:'d'+r.nextId++,x:m.x+(i-1)*.1,y:pose.inlet.y+.25,z:m.z,vx:dx*2.6,vy:2.5,vz:dz*2.6,age:0,bounces:0,cargo});
    }
    dirty(r);events.push({effect:{type:'beltBurp',x:m.x,y:pose.inlet.y,z:m.z},broadcast:'CHUTE SNEEZE! Belt cleared. The ejected paydirt is still recoverable.'});
   }
   continue;
  }
  const piles=r.spills.filter(s=>distance(s,m)<1.5&&Math.abs((s.y??heightAt(s.x,s.z,r.cells))-heightAt(m.x,m.z,r.cells))<1.5);
  let allowance=cfg.intakeRate*dt;for(const pile of piles){const part=takeCargo(pile.cargo,Math.min(allowance,cfg.capacity-m.cargo.mass));if(part.mass>0){addCargo(m.cargo,part);allowance-=part.mass;dirty(r);}if(allowance<=0)break;}
  r.spills=r.spills.filter(s=>s.cargo.mass>1e-8);
  const receiver=soilReceivers(r,rules).find(s=>s.id!==m.id&&distance(s,pose.outlet)<s.radius&&s.y<pose.outlet.y&&s.y>pose.outlet.y-3);
  const backedUp=!!receiver&&receiver.capacity-receiver.cargo.mass<3||r.spills.some(s=>distance(s,pose.outlet)<1.5&&s.cargo.mass>=24);
  const overloaded=m.cargo.mass>120;m.strain=clamp(m.strain+((overloaded||backedUp)&&m.cargo.mass>0?dt:-dt*2),0,5);
  m.jamReason=backedUp?'backed-up chute':'overloaded hopper';
  if(m.strain>=5){m.jammed=true;m.running=false;dirty(r);events.push({effect:{type:'beltJam',x:m.x,y:pose.inlet.y,z:m.z},broadcast:'Feeder jammed: '+m.jamReason+'. Hold H beside its hopper to clear it.'});continue;}
  m.running=m.cargo.mass>.001&&!backedUp&&r.clods.length<144;
  if(m.running){m.launchClock+=dt;if(m.launchClock>=.5){m.launchClock-=.5;const cargo=takeCargo(m.cargo,cfg.rate*.5);if(cargo.mass>0){r.clods.push({id:'d'+r.nextId++,x:pose.outlet.x,y:pose.outlet.y,z:pose.outlet.z,vx:0,vy:-.2,vz:0,age:0,bounces:0,cargo});m.processed+=cargo.mass;dirty(r);}}}else m.launchClock=0;
 }
 return events;
}
