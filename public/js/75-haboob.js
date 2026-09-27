'use strict';
/* public/js/75-haboob.js -- haboob (desert dust storm): schedule, wall visuals, fog/light blend, sound. */
/* ---------- haboob ---------- */
/* A haboob is a wall of dust pushed ahead of a storm's outflow, rolling across the desert faster than you can
   outrun it. Modelled as a single straight front sweeping the whole map in a compass direction: every camper
   works out the SAME front position from the shared clock (twNow()) + a fixed seed, exactly like twisters
   (twPlan/twAt in 72-twisters.js), so late joiners agree automatically with no network traffic for natural storms.
   Per-player state is a pure function of (shared time, that player's own x/z) recomputed fresh every frame -- no
   memory of "when it hit me" is stored, so it can't drift or get stuck.
   Fog/sky/light ownership: 80-ui.js's updateParty() sets scene.fog/sky/sun/hemi for day-night and the disco every
   frame; updateHaboob() runs AFTER that in the main loop and blends its own colour into whatever those left behind
   (see hbBlend), the same "final step on top of the day/night code" approach 15-terrain.js's Thumb haze already
   uses. It restores itself the moment haboobF() reaches 0 -- nothing needs to reset by hand. */
const HB_SEED=0x5a17b008;           // fixed seed: same natural schedule for everyone, independent of the twister/landslide seeds
const HB_WIN=3*12*60*1000;          // one roll every 3 in-game days (a day is CYCLE=12 real minutes in 82-patrol.js, loaded after this file, so spelled out here)
const HB_CHANCE=0.45;               // chance per window -> a natural haboob roughly every ~7 in-game days on average
const HB_SPEED=18;                  // wall ground speed, m/s (~65 km/h -- middle of a real haboob's 40-100 km/h)
const HB_WARN=58;                   // seconds of visible approach before the wall reaches you (JT asked for ~60s)
const HB_INSIDE=140;                // seconds fully inside once it hits (JT asked for 1.5-3 min)
const HB_RECEDE=12;                 // seconds for visibility to recover as the tail clears (JT asked for 10-15s)
const HB_WARN_DIST=HB_SPEED*HB_WARN;// metres out the wall is when the warning window opens (~1044 m)
const HB_NEAR=1.2,HB_FAR=8;         // fog near/far at full intensity -- about the ~8 m visibility JT asked for
const HB_FOG=new T.Color(0x8a5c34),HB_SKY=new T.Color(0x9c6a3a);   // orange-brown dust colour for fog/sky
const HB_CAMP_MULT=0.55;            // a haboob doesn't care about fences, but the buildings cut it some -- 55% strength inside camp
const HB_DRAIN_MULT=0.5;            // water drain multiplier at full intensity -> 1.5x drain (one-liner added in 70-player.js)
const HB_LIZ_BOOST=5;               // metres added to lizard detection radius at full intensity (one-liner in updateLizards)
const HB_SHAKE=0.16;                // camera buffet amplitude at full intensity, same scale as the twister's shake
let HABOOB_NATURAL=true;            // OFF SWITCH for the natural schedule: the event director can set this false to take over timing.
                                     // The ENV entry (spawnEnv('haboob',...)) stays the one way to actually start one either way.

/* fromVec: unit vector pointing toward the compass bearing the storm comes FROM (0 = north, clockwise), in the
   same x=east/z=south world axes compass() uses (public/js/80-ui.js) -- so compass(-vx*k,-vz*k) always names it right. */
function hbFromVec(brg){return[Math.sin(brg),-Math.cos(brg)]}

/* one natural plan per HB_WIN window: does a haboob happen, and which way does it come from. Same trick as
   twPlan()/lsPlan(): a window index hashed with a fixed seed, so every camper computes the identical answer.
   Unlike twisters, this ISN'T scaled by (1-nightF()) -- a haboob at night (with flashlights and headlights the
   only light poking through) is allowed on purpose. It's safe to allow: hbBlend() only ever blends a copy of
   whatever colour the night code already picked THIS frame, so a night haboob never fights or overwrites the
   night sky/fog -- it just darkens and dusts it further, the same way it darkens and dusts a daytime sky. */
function hbPlan(k){
  const r=mulberry32((k*2654435761^HB_SEED)>>>0);r();
  if(r()>HB_CHANCE)return null;
  const brg=r()*Math.PI*2;
  const span=(HB_WARN+HB_INSIDE+HB_RECEDE)*1000,slack=Math.max(HB_WIN-span-20000,0);   // leave room so the whole event fits inside its own window
  return{brg,t0:k*HB_WIN+r()*slack};
}
/* a storm made on demand (console / ENV). Ignores the natural schedule/flag entirely -- it's a separate, one-off
   event. ox,oz: the spawn point (the host's own position when they typed the command) -- t0 is picked so the storm
   is exactly HB_SPAWN_DIST out from THAT point right now, same idea as spawnAhead() for twisters/landslides. Using
   the transmitted spawn point (not each client's own position) matters: every client must derive the same t0, or
   the front ends up in a different place for each of them. */
let hbForced=null;
const HB_SPAWN_DIST=HB_WARN_DIST;   // a freshly-triggered storm starts right at the edge of the warning window
function addHaboob(brg,ox,oz){
  const[frx,frz]=hbFromVec(brg),vx=-frx,vz=-frz,pu=ox*vx+oz*vz;
  hbForced={brg,t0:twNow()-(pu-HB_SPAWN_DIST)*1000/HB_SPEED};
}

/* where the front is, right now, relative to one point (the player). Pure function of (plan, shared time, x, z) --
   no state at all, so it can't drift between clients or get stuck if a client joins mid-storm.
   d: metres to the wall (+ ahead of you approaching, 0 at you, - it has already swept past). e: seconds since it
   reached you (negative = still approaching). f: 0-1 intensity from the approach/inside/recede curve. */
function hbCalc(pl,T,fx,fz){
  const[frx,frz]=hbFromVec(pl.brg),vx=-frx,vz=-frz;             // it travels opposite the direction it comes FROM
  const pu=fx*vx+fz*vz,frontU=(T-pl.t0)/1000*HB_SPEED;
  const d=pu-frontU,e=-d/HB_SPEED;
  let f=0;
  if(e>=-HB_WARN&&e<0)f=sm((e+HB_WARN)/HB_WARN);
  else if(e>=0&&e<HB_INSIDE)f=1;
  else if(e>=HB_INSIDE&&e<HB_INSIDE+HB_RECEDE)f=1-sm((e-HB_INSIDE)/HB_RECEDE);
  return{d,e,f,vx,vz};
}
/* which plan (if any) is currently relevant to the player: a live forced storm wins over the natural schedule. */
function hbPick(T,fx,fz){
  if(hbForced){
    const st=hbCalc(hbForced,T,fx,fz);
    if(st.e<HB_INSIDE+HB_RECEDE+5)return{pl:hbForced,id:'hbF'+hbForced.t0,st};
    hbForced=null;   // fully over -- stop checking it every frame
  }
  if(!HABOOB_NATURAL)return null;
  const k=Math.floor(T/HB_WIN);
  for(const kk of[k-1,k]){
    const pl=hbPlan(kk);if(!pl)continue;
    const st=hbCalc(pl,T,fx,fz);
    if(st.e>=-HB_WARN-1&&st.e<HB_INSIDE+HB_RECEDE+1)return{pl,id:'hbN'+kk,st};
  }
  return null;
}

/* ---------- looks: a few billboarded, layered dust planes that always face the camera, plus streaming particles.
   Built once and reused every frame (no per-frame allocation) -- "pooled" the same way the twister's funnel is. ---------- */
const hbTex=(()=>{const c=document.createElement('canvas');c.width=256;c.height=256;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,256,0,0);g.addColorStop(0,'rgba(120,80,45,0.95)');g.addColorStop(0.55,'rgba(150,100,55,0.6)');g.addColorStop(1,'rgba(150,100,55,0)');
  x.fillStyle=g;x.fillRect(0,0,256,256);
  for(let i=0;i<90;i++){const r=8+Math.random()*34,px=Math.random()*256,py=256-Math.random()*Math.random()*230;   // billowy blobs, denser low, thinning toward the top
    const rg=x.createRadialGradient(px,py,0,px,py,r);rg.addColorStop(0,`rgba(160,110,60,${0.25+Math.random()*0.3})`);rg.addColorStop(1,'rgba(160,110,60,0)');
    x.fillStyle=rg;x.beginPath();x.arc(px,py,r,0,6.3);x.fill()}
  const t=new T.CanvasTexture(c);t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;return t})();
function hbMat(tex,op){return new T.MeshBasicMaterial({map:tex,color:0xffffff,transparent:true,opacity:op,depthWrite:false,side:T.DoubleSide,fog:false})}
const HB_PLANE=new T.PlaneGeometry(1,1,1,10);   // extra height segments so the vertex shader can undulate the top edge
const hbWall=new T.Group();hbWall.visible=false;scene.add(hbWall);
const hbLayers=[[1,0.85,2.2],[0.72,0.7,1.6],[0.5,0.55,1.1]].map(([sc,op,speed])=>{   // three depths: back/mid/front, each a bit smaller & fainter
  const tex=hbTex.clone();tex.needsUpdate=true;   // its own offset, so the three layers scroll at their own speed instead of sharing one
  const m=hbMat(tex,op),mesh=new T.Mesh(HB_PLANE,m);mesh.renderOrder=2;
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=hbU.uTime;sh.uniforms.uSeed={value:sc*7.3};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;uniform float uSeed;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nfloat top=uv.y;transformed.x+=sin(uTime*0.6+position.x*0.015+uSeed)*top*top*9.0;transformed.z+=cos(uTime*0.5+position.x*0.02+uSeed)*top*top*6.0;')};
  hbWall.add(mesh);return{mesh,sc,speed,tex};
});
const hbU={uTime:{value:0}};

/* dust streaking past sideways, camera-relative (same trick as updateRain in 40-fx.js): a pool of small flat
   streaks that respawn around the camera as they drift out of range, moving along the wind direction. */
const HB_DUST_N=LOW_POWER?140:420;   // PERF: fewer on phones
const hbDustMesh=new T.InstancedMesh(new T.PlaneGeometry(0.4,0.06),new T.MeshBasicMaterial({color:0x9a6f42,transparent:true,opacity:0.5,depthWrite:false,fog:false}),HB_DUST_N);
hbDustMesh.frustumCulled=false;hbDustMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);hbDustMesh.visible=false;scene.add(hbDustMesh);
const hbDust=[];for(let i=0;i<HB_DUST_N;i++)hbDust.push({x:0,y:0,z:0,life:0});
const hbDummy=new T.Object3D();

/* place/scale/fade the wall. offset: signed metres from the player, along the wind direction, to where the wall
   should be drawn (see updateHaboob for how it's picked); null hides it entirely (deep inside the storm there's
   nothing discrete left to draw -- just fog and dust, which is correct: you can't see a wall 2km away through 8m
   of dust anyway). vx,vz: the wind's travel direction (unit vector). */
function hbVisual(offset,vx,vz,dt){
  hbU.uTime.value+=dt;
  if(offset==null){hbWall.visible=false;return}
  const near=clamp(1-Math.abs(offset)/HB_WARN_DIST,0,1);   // 0 far away, 1 right on top of you
  if(near<0.01){hbWall.visible=false;return}
  hbWall.visible=true;
  const fx=S.started?P.x:0,fz=S.started?P.z:12;
  const wx=fx+offset*vx,wz=fz+offset*vz;
  const ang=Math.atan2(camera.position.x-wx,camera.position.z-wz);   // billboard: always face the camera around Y
  const h=60+180*near,w=500+900*near;                                // grows from a distant sliver into a towering, wide wall
  hbWall.position.set(wx,groundAt(wx,wz)+h*0.42,wz);hbWall.rotation.y=ang;
  hbLayers.forEach((l,i)=>{l.mesh.scale.set(w*l.sc,h*l.sc,1);l.mesh.position.set(0,0,(1-l.sc)*40);   // deeper layers sit a touch further back for parallax
    l.mesh.material.opacity=(0.25+0.65*near)*[1,0.85,0.7][i];l.tex.offset.x=(l.tex.offset.x+dt*l.speed*0.02)%1});
}
function hbDustUpdate(dt,vx,vz,F){
  if(F<0.04){hbDustMesh.visible=false;return}
  hbDustMesh.visible=true;
  const cx=camera.position.x,cz=camera.position.z,px=-vz,pz=vx;   // px/pz: perpendicular to the wind, for the "streams past sideways" drift
  for(let i=0;i<HB_DUST_N;i++){
    const d=hbDust[i];d.life-=dt;
    if(d.life<=0){d.life=1.2+Math.random()*1.4;d.x=(Math.random()-0.5)*26;d.y=0.3+Math.random()*2.4;d.z=(Math.random()-0.5)*26}
    d.x+=(vx*7+px*2.5)*dt;d.z+=(vz*7+pz*2.5)*dt;
    hbDummy.position.set(cx+d.x,d.y,cz+d.z);hbDummy.rotation.y=Math.atan2(vx,vz);hbDummy.scale.setScalar(0.6+0.4*F);hbDummy.updateMatrix();
    hbDustMesh.setMatrixAt(i,hbDummy.matrix);
  }
  hbDustMesh.instanceMatrix.needsUpdate=true;
}
function hbSound(level){
  if(!AC)return;
  if(!hbWind){const src=AC.createBufferSource();src.buffer=noiseBuf;src.loop=true;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=520;
    const lfo=AC.createOscillator();lfo.frequency.value=0.6;const lg=AC.createGain();lg.gain.value=140;lfo.connect(lg).connect(f.frequency);lfo.start();   // gusting: the lowpass wobbles instead of holding steady
    hbWind=AC.createGain();hbWind.gain.value=0;src.connect(f).connect(hbWind).connect(master);src.start()}
  hbWind.gain.setTargetAtTime(level*0.5,AC.currentTime,0.25);
}
let hbWind=null;

/* ---------- the frame hook + the one thing other systems read ---------- */
const HB={f:0};                     // HB.f: raw outdoor intensity, updated once per frame by updateHaboob; haboobF() below applies shelter
/* the single thing water drain, lizards and the minimap read: 0 outside/none, up to 1 caught out on the open lake.
   Tents are a full escape; the camp fence cuts it but doesn't stop it (a haboob doesn't care about fences). */
function haboobF(){if(inTent())return 0;return inCamp(P.x,P.z)?HB.f*HB_CAMP_MULT:HB.f}

/* minimap hook (78-hud.js): thick enough dust scrambles the map to static -- you navigate by memory, the camp
   fence or friends' voices instead. Still draws your own marker, dead centre, same as the normal map does. */
function haboobMap(mx,W){
  if(haboobF()<0.3)return false;
  mx.fillStyle='#6b5136';mx.fillRect(0,0,W,W);
  const n=26,cell=W/n;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    if(Math.random()<0.55)continue;
    const g=120+Math.random()*100;mx.fillStyle=`rgba(${g|0},${(g*0.8)|0},${(g*0.55)|0},${0.25+Math.random()*0.5})`;
    mx.fillRect(i*cell,j*cell,cell+1,cell+1);
  }
  if(S.started){mx.save();mx.translate(W/2,W/2);mx.rotate(-P.fa+Math.PI);mx.fillStyle='#e8742a';mx.strokeStyle='#2b1d12';mx.lineWidth=2;
    mx.beginPath();mx.moveTo(0,-10);mx.lineTo(7,8);mx.lineTo(-7,8);mx.closePath();mx.fill();mx.stroke();mx.restore()}
  return true;
}
let hbCurId=null,hbWarnedId=null;
function updateHaboob(dt){
  const T=twNow(),fx=S.started?P.x:0,fz=S.started?P.z:12;
  const picked=hbPick(T,fx,fz);
  if(!picked){
    if(hbCurId){logEv('haboobEnd',{});hbCurId=null;hbWarnedId=null}
    HB.f=0;hbVisual(null,1,0,dt);hbDustUpdate(dt,1,0,0);hbSound(0);hbBlend(0,dt);
    return;
  }
  const{id,st}=picked;
  if(id!==hbCurId){hbCurId=id;hbWarnedId=null;logEv('haboobBegin',{dir:compass(-st.vx*100,-st.vz*100)})}
  HB.f=st.f;
  const F=haboobF();
  if(!inTent()&&hbWarnedId!==id&&st.d<700&&st.d>-40){
    hbWarnedId=id;const dir=compass(-st.vx*100,-st.vz*100);
    logEv('haboobWarn',{dir,d:+st.d.toFixed(0)});
    toast(`Dust storm coming from the ${dir}! Get to camp or a tent.`,'bad',6000);
  }
  // wall: real physics distance while it approaches; nothing to draw once you're deep inside (see hbVisual's comment);
  // an artistic "rolling away downwind" distance while it recedes, since by then the true distance is kilometres off-screen.
  let offset=null;
  if(st.e<0)offset=-st.d;
  else if(st.e>=HB_INSIDE)offset=lerp(30,HB_WARN_DIST,clamp((st.e-HB_INSIDE)/HB_RECEDE,0,1));
  hbVisual(offset,st.vx,st.vz,dt);
  hbDustUpdate(dt,st.vx,st.vz,F);
  hbSound(F);
  hbBlend(F,dt);
  if(!inTent()&&F>0.04){const a=F*HB_SHAKE;camera.position.x+=(Math.random()-0.5)*a;camera.position.y+=(Math.random()-0.5)*a*0.5;camera.position.z+=(Math.random()-0.5)*a}
}
/* blend on top of whatever day/night/disco/win-rain already set scene.fog/sky/light to THIS frame (see the file's
   header comment): copy-then-lerp from the CURRENT (this-frame, pre-haboob) colour, never an iterative lerp toward
   our own colour -- doing that instead would creep all the way to full haboob colour over many frames even at a
   low, steady F. Scalars (sun/hemi intensity) are just dimmed by a one-shot multiplier off that same baseline.
   Fog near/far aren't touched by anything else, so they're the one thing here that's safe to ease frame-to-frame
   toward a target that already reflects the current F (so a partial storm gives partial closeness, not "eventually
   fully closed"), and that's also what restores them once the storm passes (F back to 0 -> target back to normal). */
const hbTmp=new T.Color();
function hbBlend(F,dt){
  const k=Math.min(1,dt*3);
  scene.fog.near=lerp(scene.fog.near,lerp(80,HB_NEAR,F),k);scene.fog.far=lerp(scene.fog.far,lerp(1000,HB_FAR,F),k);
  if(F<=0.003)return;
  hbTmp.copy(scene.fog.color).lerp(HB_FOG,F);scene.fog.color.copy(hbTmp);
  hbTmp.copy(sky.material.color).lerp(HB_SKY,F*0.9);sky.material.color.copy(hbTmp);
  sun.intensity*=1-F*0.75;hemi.intensity*=1-F*0.55;
}
