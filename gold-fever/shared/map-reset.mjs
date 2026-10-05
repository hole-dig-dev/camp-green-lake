import {heightAt,riverX} from './world.mjs';
import {inMine,ensureMine} from './mine.mjs';
import {emptyCargo,addCargo} from './cargo.mjs';
// Host maintenance: call with the room offline, after saving a backup.
// Progress, equipment and material are retained; excavation and forest damage are cleared.
export function resetMap(room){
  const crew=Object.values(room.players),owner=crew.find(p=>p.id===room.ownerId)||crew[0];
  const loose=emptyCargo();for(const s of room.spills||[])addCargo(loose,s.cargo);for(const c of room.clods||[])addCargo(loose,c.cargo);
  const old=room.mine;
  if(owner&&old){
    owner.kits??=[];for(const t of old.tracks||[])owner.kits.push('minetrack');
    for(const c of old.carts||[]){owner.kits.push('minecart');addCargo(loose,c.cargo);}
    for(const p of old.props||[])owner.kits.push(p.type==='rope'?'rope':p.type==='timber'?'timber':'minelamp');
    if(old.hoist){owner.kits.push('hoist');if(old.hoist.powered)owner.kits.push('steamhoist');}
    for(const l of old.levels||[])if(l<-6)owner.kits.push('shaftkit');
  }
  const stacks=(room.forest?.stacks||[]).map((s,i)=>({...s,x:-20-i%4*1.4,z:63,y:heightAt(-20-i%4*1.4,63)}));
  room.cells={};delete room.guards;delete room.mine;ensureMine(room);room.forest={version:1,trees:{},stacks};
  for(const [i,p]of crew.entries()){
    if(p.busy?.sample)addCargo(p.cargo,p.busy.sample);
    Object.assign(p,{x:-25+i%4*1.4,z:58+Math.floor(i%8/4)*2,y:3.15,yaw:-1.05,vy:0,active:false,input:{},lastInput:0,vehicle:null,cart:null,mineCart:null,hoistRide:false,busy:null,tumble:null,aid:0,shovelPlant:null,excavatorPlant:null,bucketPos:null,digUntil:0,muddyUntil:0,fly:false,speedScale:1,jumpScale:1});
    delete p.mineSafe;p.samples=[];p.consoleMarks={};p.consoleBack=null;
  }
  for(const [i,m]of room.machines.entries())if(inMine(m.x,m.z)){m.z=35+i*7;m.x=riverX(m.z)+11;m.yaw=0;}
  for(const [i,v]of room.vehicles.entries())Object.assign(v,{x:-16+(i%3)*9,z:43-Math.floor(i/3)*7,yaw:0,driver:null,speed:0,vx:0,vz:0});
  for(const [i,c]of (room.carts||[]).entries())Object.assign(c,{x:-18+i*2,z:58,operator:null,steadier:null,brake:true,tipped:false,wobble:0,roll:0,vx:0,vz:0});
  room.clods=[];room.spills=loose.mass?[{id:'s'+room.nextId++,x:-18,y:heightAt(-18,62),z:62,cargo:loose}]:[];
  room.mapGeneration='crooked-gorge-1';room.revision++;room.dirty=true;return room;
}
