// Engine-neutral articulated excavator. Radians, metres, Y up; shared tip geometry drives digging.
import {clamp,heightAt,protectedGround,toCell,fromCell,keyOf,goldInScoop,GRID} from './world.mjs';
import {inMine} from './mine.mjs';import {emptyCargo,addCargo,takeCargo} from './cargo.mjs';
export const ARM={boom:[-.2,1.05],stick:[.45,2.05],slew:[-2.5,2.5],curl:[0,1],boomLength:3.6,stickLength:3.1,pull:36};
const defaults={boom:.35,stick:1.3,slew:0,curl:0};
export function armTargets(input={}){return Object.fromEntries(Object.keys(defaults).map(k=>[k,clamp(Number.isFinite(input[k])?input[k]:defaults[k],...ARM[k])]));}
export function ensureArm(v){if(v?.type!=='excavator')return null;v.arm??={...defaults,target:{...defaults},velocity:{boom:0,stick:0,slew:0,curl:0}};v.arm.target??={...defaults};v.arm.velocity??={boom:0,stick:0,slew:0,curl:0};return v.arm;}
export function excavatorPose(v,cells={},pose=ensureArm(v)){
 const a=pose||defaults,ground=heightAt(v.x,v.z,cells),yaw=v.yaw+a.slew;
 const world=(x,y,z)=>({x:v.x+Math.cos(yaw)*x+Math.sin(yaw)*z,y:ground+y,z:v.z-Math.sin(yaw)*x+Math.cos(yaw)*z});
 const elbow={x:-.85,y:2.65+Math.sin(a.boom)*ARM.boomLength,z:-.8-Math.cos(a.boom)*ARM.boomLength};
 const wrist={x:-.85,y:elbow.y+Math.sin(a.boom-a.stick)*ARM.stickLength,z:elbow.z-Math.cos(a.boom-a.stick)*ARM.stickLength};
 const bucketAngle=.15+a.curl*1.35,lipY=-.55*Math.cos(bucketAngle)+.55*Math.sin(bucketAngle),lipZ=-.55*Math.sin(bucketAngle)-.55*Math.cos(bucketAngle);
 return {shoulder:world(-.85,2.65,-.8),elbow:world(elbow.x,elbow.y,elbow.z),wrist:world(wrist.x,wrist.y,wrist.z),tip:world(wrist.x,wrist.y+lipY,wrist.z+lipZ),cab:world(.82,3.25,-1.1),yaw};
}
export function tickArm(v,input,dt){
 const a=ensureArm(v);if(!a)return;if(input?.arm)a.target=armTargets(input.arm);
 const n=Math.max(1,Math.ceil(dt/.016)),step=dt/n,load=clamp(v.cargo.mass/720,0,1);
 for(let i=0;i<n;i++)for(const k of Object.keys(defaults)){
  const stiffness=k==='curl'?65:32-load*7,damping=k==='curl'?11:7.5;
  a.velocity[k]+=(stiffness*(a.target[k]-a[k])-damping*a.velocity[k])*step;
  a.velocity[k]=clamp(a.velocity[k],-3,3);const next=a[k]+a.velocity[k]*step;a[k]=clamp(next,...ARM[k]);if(next!==a[k])a.velocity[k]*=-.25;
 }
}
const fail=message=>({ok:false,message}),good=(message='',extra={})=>({ok:true,message,...extra});
export function excavatorAction(r,p,a,rules,now){
 if(!['excavatorPlant','excavatorCancel','excavatorScoop','excavatorDump','excavatorReset'].includes(a.type))return null;
 const v=r.vehicles.find(v=>v.id===p.vehicle&&v.driver===p.id&&v.type==='excavator');if(!v)return fail('Take the excavator controls first.');const arm=ensureArm(v);
 if(a.type==='excavatorCancel'){p.excavatorPlant=null;return good();}
 if(a.type==='excavatorReset'){arm.target={...defaults};p.excavatorPlant=null;r.dirty=true;return good('Arm centred. Mouse moves the boom; wheel folds the stick.');}
 const tip=excavatorPose(v,r.cells).tip,cfg=rules.catalog.find(i=>i.id==='excavator');
 if(a.type==='excavatorDump'){
  if(!Number.isFinite(a.power))return fail('Invalid bucket impulse.');if(v.cargo.mass<.001)return fail('The excavator bucket is empty.');if(r.clods.length>138)return fail('Let the flying dirt settle first.');
  const power=clamp(a.power,0,1),count=Math.max(1,Math.min(12,Math.ceil(v.cargo.mass/60))),part=v.cargo.mass/count,pose=excavatorPose(v,r.cells),speed=power*13;
  const lateral=clamp(arm.velocity.slew,-2,2)*power*4;
  for(let i=0;i<count;i++){
   const parcel=takeCargo(v.cargo,part),scatter=(i%3-1)*.14;
   r.clods.push({id:'d'+r.nextId++,x:tip.x+Math.cos(pose.yaw)*scatter,y:tip.y+.12+i%2*.08,z:tip.z-Math.sin(pose.yaw)*scatter,vx:-Math.sin(pose.yaw)*speed+Math.cos(pose.yaw)*lateral,vy:power*5-.4,vz:-Math.cos(pose.yaw)*speed-Math.sin(pose.yaw)*lateral,age:0,bounces:0,cargo:parcel,owner:p.id});
  }
  arm.target.curl=0;arm.velocity.curl=-2;p.excavatorPlant=null;r.revision++;r.dirty=true;return good(power>.3?'PAYDIRT AIRMAIL! Missed loads remain recoverable.':'Bucket tipped. Aim above a truck bed or washer to catch the load.',{excavator:'dumped',effect:{type:'throw',x:tip.x,y:tip.y,z:tip.z,player:p.id}});
 }
 if(a.type==='excavatorPlant'){
  if(now<p.digUntil)return {ok:false,quiet:true};if(v.cargo.mass+cfg.digKg>cfg.capacity)return fail('Bucket full. Dump, fling or E transfer the load first.');
  if(Math.abs(tip.x)>106||Math.abs(tip.z)>106||protectedGround(tip.x,tip.z)||inMine(tip.x,tip.z))return fail('Lower the bucket onto surface dirt outside town and the mine shaft.');
  const ground=heightAt(tip.x,tip.z,r.cells);if(tip.y-ground>.95||tip.y-ground<-.9)return fail('Lower the bucket teeth to the dirt first. Mouse down lowers the boom; wheel adjusts reach.');
  p.excavatorPlant={x:tip.x,z:tip.z,y:ground,at:now,vehicle:v.id};return good('',{excavator:'planted'});
 }
 const plant=p.excavatorPlant;if(!plant||plant.vehicle!==v.id||!Number.isFinite(a.pull)||a.pull<ARM.pull||now-plant.at<180||now-plant.at>8000)return fail('Hold left with the teeth at the dirt, then pull up to scoop.');
 if(now<p.digUntil)return {ok:false,quiet:true};if(Math.hypot(tip.x-plant.x,tip.z-plant.z)>3||Math.hypot(v.x-plant.x,v.z-plant.z)>8.5)return fail('The bucket moved away from its cut. Release and plant again.');
 if(v.cargo.mass+cfg.digKg>cfg.capacity)return fail('Bucket full. Dump or transfer it first.');
 if(protectedGround(plant.x,plant.z)||inMine(plant.x,plant.z))return fail('Dig on surface dirt outside town and the shaft.');
 const {ix,iz}=toCell(plant.x,plant.z),cell=r.cells[keyOf(ix,iz)]||{depth:0,digs:0};if(cell.depth>=rules.world.maxDepth)return fail('Bedrock here. Swing toward another patch.');
 const pos=fromCell(ix,iz),mg=goldInScoop(r.seed,ix,iz,cell.depth,cell.digs,cfg.digKg),patches=[];
 for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){
  if(ix+ox<1||ix+ox>=GRID||iz+oz<1||iz+oz>=GRID)continue;const k=keyOf(ix+ox,iz+oz),c=r.cells[k]||{depth:0,digs:0};c.depth=Math.min(rules.world.maxDepth,c.depth+.48/(1+Math.hypot(ox,oz)*2));if(!ox&&!oz)c.digs++;r.cells[k]=c;patches.push({key:k,...c});
 }
 addCargo(v.cargo,{mass:cfg.digKg,goldMg:mg,...pos});p.excavatorPlant=null;p.digUntil=now+cfg.digSeconds*1000;p.stats.dug+=cfg.digKg;r.totalDugKg+=cfg.digKg;arm.target.curl=1;arm.velocity.boom+=.7;v.swing=now;r.revision++;r.dirty=true;
 return good('Scoop loaded. Release to keep it; next hold + swing + release dumps. E transfers nearby.',{excavator:'loaded',patches,effect:{type:'dig',x:plant.x,y:plant.y,z:plant.z,player:p.id,large:true}});
}
