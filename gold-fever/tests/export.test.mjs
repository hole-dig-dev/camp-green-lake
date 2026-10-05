import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRoom,createPlayer,act} from '../shared/simulation.mjs';
import {exportWorld,exportTerrainOBJ} from '../shared/export.mjs';
import {vertexHeight,GRID} from '../shared/world.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
test('engine export contains terrain and deposit geometry without browser credentials',()=>{
  const room=createRoom('EXPORT01',rules);createPlayer('private-profile-token-abcdef','Miner',room);room.cells['56,56']={depth:2,digs:10};const exported=exportWorld(room);
  assert.equal(exported.terrain.heights.length,(GRID+1)**2);assert.equal(exported.terrain.deposits.length,4);assert.equal(exported.terrain.heights[56*(GRID+1)+56],Math.round(vertexHeight(56,56,room.cells)*10000)/10000);assert.ok(!JSON.stringify(exported).includes('private-profile-token'));assert.ok(exported.interchange.unrealPosition.includes('100'));assert.equal(Object.values(exported.players)[0].active,false);
});
test('OBJ export replaces the mine surface with open shaft and underground faces with valid triangle indices',()=>{
  const room=createRoom('EXPORT01',rules);room.mine.removed['-73,-5,30']=1;const p=createPlayer('export-miner','Miner',room);Object.assign(p,{x:-70,y:-6,z:28});assert.equal(act(room,p,{type:'mineDig',x:-72.01,y:-4.35,z:28},rules,1000).ok,true);
  const obj=exportTerrainOBJ(room),lines=obj.split('\n'),verts=lines.filter(l=>l.startsWith('v ')),faces=lines.filter(l=>l.startsWith('f '));assert.ok(verts.length>(GRID+1)**2);assert.ok(faces.length>GRID*GRID*2);assert.ok(lines.includes('o CrookedHatMine'));assert.ok(verts.some(v=>Number(v.split(' ')[2])<0));
  for(const f of faces)assert.ok(f.split(' ').slice(1).every(t=>Number(t.split('/')[0])>=1&&Number(t.split('/')[0])<=verts.length));
  const json=exportWorld(room);assert.equal(json.mine.volume.terrain,'continuous-csg');assert.equal(json.mine.volume.meshSampleSpacing,.5);assert.equal(json.mine.brushes.length,1);assert.equal(JSON.stringify(json.mine.brushes),JSON.stringify(room.mine.brushes));assert.equal(json.mine.removed['-73,-5,30'],1);
});
