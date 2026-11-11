'use strict';
/* public/js/47-camplight.js -- the camp at night: the one warm place in a cold dark desert (2026-11-11).
   Three cheap tricks, no shadows, no extra draw calls for the light itself:
     1. Lit glass. Window panes, lamp bulbs and lanterns in the Blender models get an emissive colour brighter than 1
        from dusk, so the bloom (14-look.js) makes them glow. Each building's glass is its own material copy, so a bunk
        can go dark at lights-out while the Superintendent's house stays lit all night.
     2. Fake lamps. Up to CL_N warm "pools" (position, reach, colour) are added to every lit material in the shader,
        the same way 47-searchlight-glow.js adds the searchlights: walls and people light by how squarely they face
        the lamp, the ground evenly. The nearest CL_N fixtures to the camera are fed in each frame, the farthest of
        them faded so nothing pops. Lamp posts, lanterns, doorways, the store's booth, the gate sign, window spill.
     3. Rooms (the tents and the Super's house are rooms underground, 50-tents.js). Inside, the sky light is turned
        right down so the corners go dark; the room's own fixtures (its lamp, the stove, the windows) are the pools.
        By day the windows are bright and throw daylight on the floor; at night they go blue-black and the lamp
        takes over.
   Loads after 47-searchlight-glow.js (it wraps that file's shader hook) and the camp models (23/24). updateCampLight
   runs from the main loop after the sky and day-night code, so it can have the last word on the light in a room. */
const CL_N=16;               // fake lamps in the shader at once (the nearest to the camera)
const CL_WARM=[1.0,0.7,0.38];   // lamplight
const CL_DAY=[1.0,0.96,0.86];   // daylight through a window
const CL_U={uCLPos:{value:[...Array(CL_N)].map(()=>new T.Vector4(0,-999,0,0.01))},uCLCol:{value:[...Array(CL_N)].map(()=>new T.Vector3())},uCLOn:{value:0}};
function clPatch(sh,facing){
  Object.assign(sh.uniforms,CL_U);
  const face=facing?'*(0.3+0.7*max(dot(inverseTransformDirection(normal,viewMatrix),v/d),0.0))':'';
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>\nuniform vec4 uCLPos[${CL_N}];uniform vec3 uCLCol[${CL_N}];uniform float uCLOn;`)
    .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      if(uCLOn>0.0){
        vec3 cl=vec3(0.0);
        for(int i=0;i<${CL_N};i++){
          vec3 v=uCLPos[i].xyz-vSLW;float d=max(length(v),0.01);
          float f=clamp(1.0-d/uCLPos[i].w,0.0,1.0);   // reach: full at the lamp, nothing at w metres
          cl+=uCLCol[i]*f*f${face};
        }
        totalEmissiveRadiance+=cl*diffuseColor.rgb;
      }`);
}
/* every standard material (and the terrain) gets the searchlights first (vSLW comes from there), then the camp lamps */
{
  const slStd=T.MeshStandardMaterial.prototype.onBeforeCompile;
  T.MeshStandardMaterial.prototype.onBeforeCompile=function(sh,r){slStd.call(this,sh,r);clPatch(sh,true)};
  const prev=chunkMat.onBeforeCompile;chunkMat.onBeforeCompile=(sh,r)=>{prev(sh,r);clPatch(sh,false)};
}

/* ---- the fixtures. x y z: where the light sits; r: how far it reaches (m); k: brightness; col; on(): 0..1 now.
   room: the room index (TENTS) it lights, or null for the yard ---- */
const CL_FIX=[];
const clFix=(x,y,z,r,k,on,room=null,col=CL_WARM)=>{const f={x,y,z,r,k,on,room,col,w:0};CL_FIX.push(f);return f};
const clDusk=()=>lookNightF();   // yard lamps come on with the dusk
/* a bunk's lights: on at dusk; the small bunks put their lamp out an hour or so after the siren and keep a stove glow;
   Bunk D stays up while Jim Bob deals (until 01:00, 30-npcs.js dealerBedtime) */
const CL_BED_H=22.25;   // the small bunks' lamp goes out at 22:15
function clBunkOn(t){const n=lookNightF();if(n<=0)return 0;const ct=lookT();if(ct<DAYMS)return n;
  const late=t.crew?dealerBedtime():(ct>=tAtHour(CL_BED_H)||dealerBedtime());return late?0.18:1}
{
  // lamp posts: the bulb hangs off the arm, 0.5 m out toward the middle of camp (LampPost.glb: bulb at y 2.47, z 0.5)
  for(const p of LAMP_POSTS)clFix(p.x+Math.sin(p.ry)*0.5,p.y+2.35,p.z+Math.cos(p.ry)*0.5,9.5,2.4,clDusk);
  // the yard lanterns (24-dressing.js): small, close pools
  for(const p of DRESS_CAMP)if(p.m==='DressLantern')clFix(p.x,baseH(p.x,p.z)+(p.y||0)+0.45,p.z,4.6,1.5,clDusk);
  // the Superintendent's porch lanterns and her lit windows' spill on the porch (SuptHouse.glb, turned to face the yard)
  const sh=baseH(-30,45);
  for(const s of[-1,1]){clFix(-30+s*1.25,sh+2.45,41.6,5.5,1.6,clDusk);clFix(-30+s*2.4,sh+1.3,40.9,3.4,0.8,clDusk)}
  // the Company Store: the bulb in Mr. Abel's booth lights the shelves and the counter, and spills out of the window
  const st=baseH(16,45);clFix(16,st+2.2,43.5,3.2,2.6,clDusk);clFix(16,st+1.1,41.4,4.6,1.2,clDusk);
  // the main gate: its two lanterns, and two lamps on the arch sign (lake side and camp side), so it reads from both
  const gy=baseH(0,FENCE_Z0);
  for(const s of[-1,1])clFix(s*6.18,gy+4.9,FENCE_Z0+0.9,7,1.6,clDusk);
  clFix(0,gy+5.3,FENCE_Z0-1.3,3.4,1.2,clDusk);clFix(0,gy+5.3,FENCE_Z0+1.5,3.4,0.9,clDusk);
}
/* the bunks: light spilling from the doorway onto the step (the door is on the yard side, -z) */
const CL_BUNK_FIX=TENTS.map(t=>t.house?null:clFix(t.x,baseH(t.x,t.z)+1.0,t.z-t.hd-0.7,4.6,1.3,()=>clBunkOn(t)));

/* ---- lit glass: emissive materials in the models, driven by a schedule ---- */
const CL_GLOW=[];   // {mat, on(), k, col}
/* every material of a placed model whose name starts with one of prefixes; per: a copy per placement (so each
   building can light on its own schedule), fn(x,z) gets the placement's position */
function clGlow(model,prefixes,k,fn,col=CL_WARM,per=false){
  const bind=()=>{
    let found=0;
    scene.traverse(g=>{if(g.name!==model||!g.isGroup||g.userData.clBound)return;g.userData.clBound=true;found++;
      const copies=new Map();
      for(const m of g.children){
        if(!m.material||!prefixes.some(p=>(m.material.name||'').startsWith(p)))continue;
        let mat=m.material;
        if(per){if(!copies.has(mat)){const c=mat.clone();c.name=mat.name;copies.set(mat,c)}mat=m.material=copies.get(mat)}
        if(CL_GLOW.some(o=>o.mat===mat))continue;
        if(!mat.emissive)continue;mat.emissive.setRGB(0,0,0);
        const pos=m.isInstancedMesh?null:{x:m.matrix.elements[12],z:m.matrix.elements[14]};
        CL_GLOW.push({mat,k,col,on:()=>fn(pos),w:-1});
      }
    });
    return found;
  };
  return loadModel(model).then(()=>new Promise(res=>{let n=0;const tick=()=>{if(bind()||++n>40)res();else setTimeout(tick,250)};setTimeout(tick,50)})).catch(()=>{});
}
const clTentAt=pos=>pos?TENTS.find(t=>!t.house&&Math.abs(t.x-pos.x)<0.5&&Math.abs(t.z-pos.z)<0.5):null;
clGlow('LampPost',['cgl_bulb'],3.2,clDusk);
clGlow('SuptHouse',['cgl_glass'],1.6,clDusk);
clGlow('SuptHouse',['cgl_lantern'],2.6,clDusk);
clGlow('CompanyStore',['cgl_bulb'],3.5,clDusk);
clGlow('CompanyStore',['cgl_glass'],1.1,clDusk);
clGlow('MainGate',['cgl_lantern'],2.8,clDusk);
clGlow('WatchtowerBody',['cgl_glass'],0.9,clDusk);   // a guard's lamp in each tower cab
for(const m of['TentSmall','TentCrew'])clGlow(m,['cgl_c25251d'],1.0,pos=>{const t=clTentAt(pos);return t?clBunkOn(t):0},CL_WARM,true);   // the doorway glows while the bunk's lamp is lit

/* ---- rooms: each room's fixtures come from its layout (20-world.js t.lights). A lamp is lit while the bunk's lamp is
   (dim by day: the windows do the work then), the stove always glows (more at night), a window is daylight by day. ---- */
const CL_STOVE=[1.0,0.42,0.14],CL_FIRE=[1.0,0.5,0.2];
function clRoomLampOn(t){const n=lookNightF();if(t.house)return 0.4+0.6*n;return n<=0.001?0.3:0.3*(1-n)+clBunkOn(t)}
const CL_ROOM=TENTS.map(t=>(t.lights||[]).map(l=>({x:l.x,y:l.y,z:l.z,r:l.r,k:l.k,w:0,
  col:l.kind==='day'?CL_DAY:l.kind==='stove'?CL_STOVE:l.kind==='fire'?CL_FIRE:CL_WARM,
  on:l.kind==='day'?()=>1-lookNightF():l.kind==='lamp'?()=>clRoomLampOn(t):()=>0.6+0.4*lookNightF()})));
/* the room models' own glass: windows ('cgl_daylight'), lamp glass ('cgl_lampglow'), the fire in the stove ('cgl_stoveglow') */
const CL_ROOM_MATS=TENTS.map(()=>({day:[],lamp:[],stove:[]}));
TENTS.forEach((t,ti)=>loadModel(t.room).then(({meshes})=>{for(const p of meshes){const n=p.material.name||'',M=CL_ROOM_MATS[ti];
  if(n.startsWith('cgl_daylight'))M.day.push(p.material);else if(n.startsWith('cgl_lampglow'))M.lamp.push(p.material);else if(n.startsWith('cgl_stoveglow'))M.stove.push(p.material)}}).catch(()=>{}));
/* ---- every frame ---- */
const CL_ROOM_HEMI=[0.34,0.1];   // the sky light in a room: by day (through the windows and the canvas), at night
let clT=0;
function updateCampLight(dt){
  const room=typeof S!=='undefined'&&S.tent!=null?S.tent:null,night=lookNightF();
  // lit glass (cheap: only touched when the value moves)
  for(const g of CL_GLOW){const v=g.on()*g.k;if(Math.abs(v-g.w)>0.01){g.w=v;g.mat.emissive.setRGB(g.col[0]*v,g.col[1]*v,g.col[2]*v)}}
  if(room!=null){   // the room you're in: its windows, lamp glass, stove fire and its one real light
    const t=TENTS[room],M=CL_ROOM_MATS[room],d=1-night,lamp=clRoomLampOn(t);
    for(const m of M.day)m.emissive.setRGB(0.03+1.3*d,0.04+1.22*d,0.08+1.02*d);
    for(const m of M.lamp)m.emissive.setRGB(2.6*lamp,1.8*lamp,0.8*lamp);
    for(const m of M.stove)m.emissive.setRGB(2.4,0.9,0.25);
    ROOM_LIGHTS[room].intensity=ROOM_LAMP*lamp;
  }
  if(room!=null&&!PARTY.on){hemi.intensity=lerp(CL_ROOM_HEMI[0],CL_ROOM_HEMI[1],night);sun.intensity=0}   // a room under the ground: no sun, little sky (the day-night code eases it back outside)
  // which fixtures feed the shader: the room's own, or the yard's nearest (refreshed a few times a second)
  clT-=dt;if(clT>0)return;clT=0.1;
  const cx=camera.position.x,cy=camera.position.y,cz=camera.position.z;
  const list=room!=null?CL_ROOM[room]:night>0.01?CL_FIX:[];
  const live=[];
  for(const f of list){const v=f.on();if(v<=0.001)continue;f.w=v;f.d=Math.hypot(f.x-cx,f.y-cy,f.z-cz);live.push(f)}
  live.sort((a,b)=>a.d-b.d);
  const cut=live.length>CL_N?live[CL_N].d:1e9,P4=CL_U.uCLPos.value,C3=CL_U.uCLCol.value;
  for(let i=0;i<CL_N;i++){const f=live[i];
    if(!f){P4[i].set(0,-999,0,0.01);C3[i].set(0,0,0);continue}
    const fade=Math.min(1,(cut-f.d)/8),v=f.w*f.k*fade;   // the last few in the list fade out before they drop off it
    P4[i].set(f.x,f.y,f.z,f.r);C3[i].set(f.col[0]*v,f.col[1]*v,f.col[2]*v);
  }
  CL_U.uCLOn.value=live.length?1:0;
}
