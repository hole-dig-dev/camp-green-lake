import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRoom,createPlayer} from '../shared/simulation.mjs';
import {exportWorld,exportTerrainOBJ} from '../shared/export.mjs';
import {vertexHeight,GRID} from '../shared/world.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../shared/rules.json',import.meta.url)));
test('engine export contains terrain and deposit geometry without browser credentials',()=>{
  const room=createRoom('EXPORT01',rules);createPlayer('private-profile-token-abcdef','Miner',room);room.cells['56,56']={depth:2,digs:10};const exported=exportWorld(room);
  assert.equal(exported.terrain.heights.length,(GRID+1)**2);assert.equal(exported.terrain.deposits.length,4);assert.equal(exported.terrain.heights[56*(GRID+1)+56],Math.round(vertexHeight(56,56,room.cells)*10000)/10000);assert.ok(!JSON.stringify(exported).includes('private-profile-token'));assert.ok(exported.interchange.unrealPosition.includes('100'));assert.equal(Object.values(exported.players)[0].active,false);
});
test('OBJ export has a full grid with valid triangle indices',()=>{
  const obj=exportTerrainOBJ(createRoom('EXPORT01',rules)),lines=obj.split('\n'),verts=lines.filter(l=>l.startsWith('v ')),faces=lines.filter(l=>l.startsWith('f '));assert.equal(verts.length,(GRID+1)**2);assert.equal(faces.length,GRID*GRID*2);const last=faces.at(-1).split(' ').slice(1).map(t=>Number(t.split('/')[0]));assert.ok(last.every(i=>i>=1&&i<=verts.length));
});
