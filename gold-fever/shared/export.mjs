import { GRID, HALF, STEP, vertexHeight, deposits } from './world.mjs';
import { cancelPan } from './simulation.mjs';
import {MINE,inMine,releaseMine} from './mine.mjs';
import {mineChunkKeys,mineChunkMesh} from './mine-terrain.mjs';
import {CANYON,CANYON_BRIDGE} from './canyon.mjs';
export function exportWorld(room) {
  const out=JSON.parse(JSON.stringify(room));delete out.dirty;
  out.players=Object.fromEntries(Object.values(out.players).map(p=>{cancelPan(p);delete p.input;delete p.lastInput;delete p.lastChat;p.active=false;p.vehicle=null;return[p.id,p];}));
  for(const v of out.vehicles)v.driver=null;
  for(const c of out.carts||[]){c.operator=null;c.steadier=null;c.brake=true;c.vx=c.vz=0;}
  for(const p of Object.values(out.players)){p.cart=null;p.shovelPlant=null;p.excavatorPlant=null;}
  for(const p of Object.values(out.players))releaseMine(out,p);
  out.mine.volume={...MINE,terrain:'continuous-csg',meshSampleSpacing:.5};
  out.mine.volumes=[{...MINE},{...CANYON}];out.canyon={...CANYON,bridge:{...CANYON_BRIDGE},terrain:'continuous-csg'};
  out.interchange={format:'gold-fever-world',version:1,units:'metres',axes:{x:'east',y:'up',z:'south'},unrealPosition:'X = x * 100; Y = z * 100; Z = y * 100',unrealYawDegrees:'-90 - webYawRadians * 180 / PI'};
  out.terrain={width:GRID+1,height:GRID+1,spacing:STEP,origin:{x:-HALF,z:-HALF},heights:[],deposits:deposits(room.seed)};
  for(let iz=0;iz<=GRID;iz++)for(let ix=0;ix<=GRID;ix++)out.terrain.heights.push(Math.round(vertexHeight(ix,iz,room.cells)*10000)/10000);
  return out;
}
export function exportTerrainOBJ(room) {
  const lines=['# Gold Fever terrain; metres; Y up; +X east; +Z south','o GoldFeversTerrain'];
  for(let iz=0;iz<=GRID;iz++)for(let ix=0;ix<=GRID;ix++)lines.push(`v ${ix*STEP-HALF} ${vertexHeight(ix,iz,room.cells).toFixed(4)} ${iz*STEP-HALF}`);
  for(let iz=0;iz<=GRID;iz++)for(let ix=0;ix<=GRID;ix++)lines.push(`vt ${(ix/GRID).toFixed(5)} ${(1-iz/GRID).toFixed(5)}`);
  for(let iz=0;iz<GRID;iz++)for(let ix=0;ix<GRID;ix++){if(inMine(ix*STEP-HALF+STEP/2,iz*STEP-HALF+STEP/2))continue;const a=iz*(GRID+1)+ix+1,b=a+1,c=a+GRID+1,d=c+1;lines.push(`f ${a}/${a} ${c}/${c} ${b}/${b}`,`f ${b}/${b} ${c}/${c} ${d}/${d}`);}
  let count=(GRID+1)**2;lines.push('o CrookedHatMine');
  for(const k of mineChunkKeys(room.mine)){const {positions}=mineChunkMesh(room.mine,...k.split(',').map(Number));for(let i=0;i<positions.length;i+=9){for(let j=0;j<9;j+=3)lines.push(`v ${positions[i+j].toFixed(4)} ${positions[i+j+1].toFixed(4)} ${positions[i+j+2].toFixed(4)}`);lines.push(`f ${count+1} ${count+2} ${count+3}`);count+=3;}}
  return lines.join('\n');
}
