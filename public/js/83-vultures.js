'use strict';
/* public/js/83-vultures.js -- vultures: ambient circling, low-health warning, dive/grab/carry/drop, fall damage. */
/* ---------- vultures ---------- */
/* They're always up there, drifting slowly over whoever on the crew looks worst - a cheap visible flare for where a
   hurt or downed friend is. Let your own health sink too low out on the open lake and, after a grace period to duck
   into a hole or run for camp, one notices you specifically: circling tightens, it screeches, then dives, grabs you,
   carries you up and a short way off, and drops you. The fall hurts (see fallDamage below) - being already low, that
   can finish the job, but a cooldown after a drop stops them chain-lifting you, and a well-timed shovel swing while
   one is diving close in front of you (hooked into scoop()) chases it off.
   Like the twister's suck/throw/down/getup states (72-twisters.js), the actual grab-through-getup sequence is purely
   local/per-client and takes over updatePlayer (vSt>=3, mirroring twSt) - it never needs the server to agree on
   anything. Everyone else sees you get carried through the ordinary 'pos' sync plus one flag bit (128) that tells
   their client to draw a vulture over you; see sendPresence() in 65-net.js and vRenderRemoteCarries() below. */
let vulturesEnabled=true;   // one clean switch (a later scheduled "event director" can flip this instead of hooking the state machine)

/* ---- tuning ---- */
const VULTURE_COUNT=6;              // ambient birds always circling (JT asked for "kind of always up there", 4-8)
const VULTURE_ALT_BASE=54;          // baseline altitude (m) - spec wants roughly 40-70m over the lake
const VULTURE_ALT_SPREAD=10;        // +/- per bird, so the flock isn't a flat disc
const VULTURE_ORBIT_MIN=18,VULTURE_ORBIT_MAX=32;   // each bird's own orbit radius (m), picked once
const VULTURE_TIGHT_MIN=0.35;       // how much the orbit shrinks when circling tight over someone hurt/warned
// health lines (circle below / target below / give up above) are tester sliders: tune('vulture.attract'|'vulture.thresh'|'vulture.clear'), defaults 0.55/0.30/0.40 in 11-tune.js
const VULTURE_GRACE=4;              // seconds under threshold before the warning fires - a beat to notice your own health bar
const VULTURE_WARN_TIME=5;          // seconds of tightening circling before the dive - JT's window to heal/onion/run
const VULTURE_DIVE_TIME=1.3;        // swoop-in duration, timed to be readable (and shoo-able)
const VULTURE_GRAB_TIME=0.35;       // the snatch, before it starts hauling you
const VULTURE_CARRY_TIME=2.6;       // how long it carries you before letting go
// carry distance: "a short way across", 14-22 m by default; F2 > Creatures > vulture.dist sets the middle
const VULTURE_APEX_MIN=6,VULTURE_APEX_MAX=8.5;   // carry height (m) above the grab point's ground - varies the fall, and the damage with it
const VULTURE_Y_MAX=60,VULTURE_Y_MIN=-4.5;   // inside the server's -5..ZONE_MAX_Y (200) P.y clamp; the height slider tops out ~29 m over the ground
const VULTURE_MAX_BRAKE=8;   // m/s²: the climb eases out no harder than this (under 1 g), or the camper hanging from its foot swings up over it
const VULTURE_HOLD_UP=1.3;          // how far above the victim the bird's body sits while it's got them
const VULTURE_DOWN_TIME=1.3,VULTURE_GETUP_TIME=0.4;   // lie-still then stand, same shape as the twister's landing
const VULTURE_LEAVE_TIME=0.5;       // how long the bird lingers flying off after letting go (cosmetic only)
const VULTURE_COOLDOWN=32;          // seconds after a drop before it can single you out again - can't chain-lift you
const VULTURE_SHOO_COOL=10;         // shorter cooldown after a successful shovel shoo-off
const VULTURE_NIGHT_CUTOFF=0.7;     // nightF() past this and they've folded up for the night: no new grace/dives
const VULTURE_SHOO_RANGE=6,VULTURE_SHOO_DOT=0.35;   // shovel swing has to land roughly in front of it, and close

/* fallDamage: a small reusable helper turning a fall's impact speed (m/s, i.e. |vy| the instant you land) into health
   damage, named thresholds instead of magic numbers. Written generically so another hazard could reuse it later, but
   per JT's spec it's only ever called from the vulture drop below - ordinary jumping and the twister's own landing
   are untouched. */
const FALL_SAFE_SPEED=6;    // land softer than this (an ordinary jump) and it's free
const FALL_MAX_SPEED=17;    // at/above this speed (roughly a full-height vulture drop) damage caps out
const FALL_DMG_MAX=25;      // cap keeps a single drop from being a guaranteed kill even at 1 hp
function fallDamage(impactSpeed){
  if(impactSpeed<=FALL_SAFE_SPEED)return 0;
  const u=clamp((impactSpeed-FALL_SAFE_SPEED)/(FALL_MAX_SPEED-FALL_SAFE_SPEED),0,1);
  return Math.round(tuneOr('vulture.fallDmg',FALL_DMG_MAX)*u*u);   // ease-in: a near-safe drop barely stings, a full one hurts a lot (tuned to ~12-25)
}

/* ---- local per-client state machine (see file banner) ----
   vSt: 0 free, 1 warning (tight circling, still fully player-controlled), 2 diving (still controlled - shoo-able),
   3 grab, 4 carry, 5 drop/tumble, 6 down, 7 getting up (3-7 take over movement, like twSt). */
let vSt=0,vStT=0,vGraceT=0,vCool=0;
let vGrabX=0,vGrabZ=0,vGrabY0=0;
let vCarryX0=0,vCarryZ0=0,vCarryX1=0,vCarryZ1=0,vCarryGround=0,vCarryApex=0,vRiseT=1.56,vCarryT=2.6;
let vRagX=0,vRagY=0,vRagZ=0;
let vDiveX0=0,vDiveY0=0,vDiveZ0=0,vLastBirdX=0,vLastBirdZ=0;
function vStateName(){return['free','warn','dive','grab','carry','drop','down','getup'][vSt]}

/* a screech: cheap synthesised sound, no new asset. `near` makes it a bit louder/higher for the up-close moments. */
function vScreech(near){noise(0.5,2500+Math.random()*400,2,near?0.34:0.22,'bandpass');tone(1900,0.3,'sawtooth',near?0.16:0.1,700)}

/* ---- ambient flock: cheap - one InstancedMesh, one draw call, no per-frame allocation (reuses the shared `dummy`) ---- */
const VULTURE_BODY=mergeBoxes([
  [0.16,0.14,0.85,0x2a241d,0,0,0.05],          // body
  [1.35,0.045,0.36,0x201a15,-0.76,0.01,0.02],  // left wing (flat slab - reads as a soaring silhouette from below)
  [1.35,0.045,0.36,0x201a15,0.76,0.01,0.02],   // right wing
  [0.12,0.05,0.32,0x2a241d,0,0.01,-0.5],       // tail fan
]);
const vMesh=new T.InstancedMesh(VULTURE_BODY,mergedMat,VULTURE_COUNT);
vMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);vMesh.frustumCulled=false;vMesh.castShadow=false;scene.add(vMesh);
const vFlock=Array.from({length:VULTURE_COUNT},(_,i)=>({a:i/VULTURE_COUNT*Math.PI*2,w:0.12+Math.random()*0.08,r0:VULTURE_ORBIT_MIN+Math.random()*(VULTURE_ORBIT_MAX-VULTURE_ORBIT_MIN),dAlt:(Math.random()*2-1)*VULTURE_ALT_SPREAD,ph:Math.random()*6.28}));
let vFlockX=0,vFlockZ=39;
let vFlockRigs=null;   // the Blender vulture (24-creatures.js): one animated copy per flock bird, once loaded
   // smoothed flock center, starts near the camp/spawn area
function updateVultureFlock(dt){
  // who the flock is watching: whichever camper (you or a friend) is hurt worst, defaulting to you
  let tx=P.x,tz=P.z,worstFrac=S.started?S.hp/HP_MAX:1;
  for(const R of remotes.values()){const f=(R.hp==null?100:R.hp)/HP_MAX;if(f<worstFrac){worstFrac=f;tx=R.p.g.position.x;tz=R.p.g.position.z}}
  const k=1-Math.exp(-dt*0.25);   // slow drift - they're loitering, not homing missiles
  vFlockX+=(tx-vFlockX)*k;vFlockZ+=(tz-vFlockZ)*k;
  const dayVis=clamp(1-nightF()*1.4,0,1);   // fold away as night falls - they're a daytime hazard
  const attractTight=worstFrac<tune('vulture.attract')?lerp(1,VULTURE_TIGHT_MIN,clamp(1-worstFrac/tune('vulture.attract'),0,1)):1;
  const warnTight=vSt>=1?VULTURE_TIGHT_MIN*0.7:1;   // an active warning/dive on YOU tightens it further, as a readable tell
  const tight=Math.min(attractTight,warnTight);
  for(let i=0;i<VULTURE_COUNT;i++){
    const b=vFlock[i];b.a+=dt*b.w;
    const r=b.r0*tight,x=vFlockX+Math.cos(b.a)*r,z=vFlockZ+Math.sin(b.a)*r,y=VULTURE_ALT_BASE+b.dAlt;
    dummy.position.set(x,y,z);dummy.rotation.set(0,b.a+Math.PI/2,Math.sin(b.a*3+b.ph)*0.12);dummy.scale.setScalar(dayVis);dummy.updateMatrix();
    if(vFlockRigs){const r=vFlockRigs[i],o=r.obj;o.position.copy(dummy.position);o.rotation.copy(dummy.rotation);o.scale.setScalar(dayVis*CREATURE_DEFS.vulture.scale);o.visible=dayVis>0.01;
      if(o.visible)creatureAnim(r,Math.sin(b.a*0.7+b.ph)>0.93?'Flap':'Glide',dt,1)}   // mostly gliding, the odd few wingbeats
    vMesh.setMatrixAt(i,dummy.matrix);
  }
  vMesh.instanceMatrix.needsUpdate=true;
}
/* the nearest ambient bird's current position - where a dive peels off from */
function vPickDiveStart(){
  let best=null,bd=1e9;
  for(const b of vFlock){const bx=vFlockX+Math.cos(b.a)*b.r0*VULTURE_TIGHT_MIN*0.7,bz=vFlockZ+Math.sin(b.a)*b.r0*VULTURE_TIGHT_MIN*0.7,d2=(bx-P.x)**2+(bz-P.z)**2;if(d2<bd){bd=d2;best={x:bx,y:VULTURE_ALT_BASE+b.dAlt,z:bz}}}
  return best||{x:P.x+20,y:VULTURE_ALT_BASE,z:P.z+20};
}

/* ---- one detailed pooled model, used both for the local hunter (key 'me') and for drawing a remote camper's
   carrier (key 'r'+id) - a handful of extra meshes only while a carry is actually happening, so it's basically free. ---- */
function makeVultureModel(){
  const g=new T.Group();
  const body=box(0.22,0.2,0.95,0x241f1a);body.position.y=0.05;g.add(body);
  const head=box(0.16,0.15,0.22,0xb5645a);head.position.set(0,0.1,0.62);g.add(head);   // bald pinkish head, vulture-style
  const beak=box(0.07,0.06,0.14,0xe8d9a0);beak.position.set(0,0.07,0.78);g.add(beak);
  const tail=box(0.14,0.05,0.4,0x241f1a);tail.position.set(0,0.02,-0.55);g.add(tail);
  const wingL=new T.Group();wingL.position.set(-0.11,0.1,0.05);g.add(wingL);
  const wingR=new T.Group();wingR.position.set(0.11,0.1,0.05);g.add(wingR);
  const wL=box(1.35,0.05,0.42,0x1c1712);wL.position.set(-0.75,0,0);wingL.add(wL);
  const wR=box(1.35,0.05,0.42,0x1c1712);wR.position.set(0.75,0,0);wingR.add(wR);
  const legL=new T.Group();legL.position.set(-0.08,-0.08,0.12);g.add(legL);
  const legR=new T.Group();legR.position.set(0.08,-0.08,0.12);g.add(legR);
  const lgL=cyl(0.025,0.02,0.5,4,0xc9a25a);lgL.position.y=-0.25;legL.add(lgL);
  const lgR=cyl(0.025,0.02,0.5,4,0xc9a25a);lgR.position.y=-0.25;legR.add(lgR);
  g.visible=false;scene.add(g);
  return{g,wingL,wingR,legL,legR,tail,ph:Math.random()*6.28,used:null};
}
const VULTURE_TALON=0.5;   // box-model leg length: its tip stands in for the grip until the Blender vulture loads
const VPOOL_N=4;   // 1 for whoever has YOU, a few spares so several carried friends can be seen at once
const vPool=Array.from({length:VPOOL_N},makeVultureModel);
creatureUpgrade('vulture',()=>{vFlockRigs=vFlock.map(()=>{const r=spawnCreature('vulture');scene.add(r.obj);return r});vMesh.visible=false;
  for(const v of vPool){const r=spawnCreature('vulture');for(const c of v.g.children)c.visible=false;v.g.add(r.obj);v.rig=r;
    v.grip=r.obj.getObjectByName('gripR')}});   // the bone inside its clenched right foot (art/blender/vulture.py); registered after vPool exists
function vPoolGet(key){
  let v=vPool.find(p=>p.used===key);if(v)return v;
  v=vPool.find(p=>!p.used);if(v){v.used=key;v.g.visible=true}return v;
}
function vPoolFree(key){const v=vPool.find(p=>p.used===key);if(v){v.used=null;v.g.visible=false}}
// the Blender vulture's clips (art/blender/vulture.py): Flap (legs tucked), Reach (the dive: feet thrown forward, toes
// spread), Carry (feet down, toes clenched around what it's got)
function vFlap(v,dt,rate,amp,clip){if(v.rig){creatureAnim(v.rig,clip||'Flap',dt,rate/7);return}v.ph+=dt*rate;const s=Math.sin(v.ph)*amp;v.wingL.rotation.z=s;v.wingR.rotation.z=-s;v.tail.rotation.x=Math.sin(v.ph*0.5)*0.08}
function vDrawCarrier(key,x,y,z,yaw,mode,dt){
  const v=vPoolGet(key);if(!v)return;
  v.g.position.set(x,y,z);v.g.rotation.y=yaw;
  const legOut=mode==='carry'||mode==='grab';   // it's actually holding someone
  vFlap(v,dt,mode==='carry'?9:mode==='dive'?5:7,mode==='carry'?0.55:0.4,legOut?'Carry':mode==='dive'?'Reach':'Flap');
  v.legL.rotation.x=legOut?Math.sin(v.ph*1.6)*0.5-0.6:0;
  v.legR.rotation.x=legOut?Math.sin(v.ph*1.6+3.1)*0.15-0.35:0;   // (box model) the right foot has you: it barely swings
  v.g.updateMatrixWorld(true);
  v.talon=!legOut?null:v.grip?v.grip.getWorldPosition(v.talon||new T.Vector3()):v.legR.localToWorld((v.talon||new T.Vector3()).set(0,-VULTURE_TALON,0));
}
/* where the vulture that has camper `key` ('me' or 'r'+id) is gripping (inside its clenched right foot), or null */
function vTalonOf(key){const v=vPool.find(p=>p.used===key);return v&&v.talon||null}
/* other clients' carried campers: driven purely off the flag bit + ordinary pos sync, no local state needed */
function vRenderRemoteCarries(dt){
  for(const[id,R]of remotes){
    if(R.f&128){const g=R.p.g.position;vDrawCarrier('r'+id,g.x,g.y+VULTURE_HOLD_UP,g.z,R.p.g.rotation.y,'carry',dt)}   // (was g.rotation: g is the position vector)
    else vPoolFree('r'+id);
  }
}

/* dive shadow: one flat circle on the ground, only for the local dive (spec: "a readable swoop and shadow") */
const vShadow=new T.Mesh(new T.CircleGeometry(1,16),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false,fog:false}));
vShadow.rotation.x=-Math.PI/2;vShadow.position.y=0.05;scene.add(vShadow);

/* struggling-in-its-talons pose, reusing the player's own limb groups (same trick as twStep's direct rotation.z tumble) */
function vPersonPose(dt,k){
  const s=Math.sin(performance.now()/140),ek=Math.min(1,dt*6);
  me.upper.rotation.x=lerp(me.upper.rotation.x,-0.25,ek);
  me.armL.rotation.x=lerp(me.armL.rotation.x,-2.2,ek);me.armR.rotation.x=lerp(me.armR.rotation.x,-2.2,ek);
  me.legL.rotation.x=s*0.5*k;me.legR.rotation.x=-s*0.5*k;
}

/* ---- transitions ---- */
function underThreatNow(){
  return S.started&&!S.ko&&!twSt&&!inTent()&&!inCamp(P.x,P.z)&&S.hp<HP_MAX*tune('vulture.thresh')&&nightF()<VULTURE_NIGHT_CUTOFF&&vulturesEnabled&&vCool<=0;
}
function vCancelCheck(){
  return !vulturesEnabled||S.ko||twSt||inTent()||inCamp(P.x,P.z)||S.hp>=HP_MAX*tune('vulture.clear')||nightF()>=VULTURE_NIGHT_CUTOFF;
}
function vCancelToIdle(){vSt=0;vStT=0;vGraceT=0;vShadow.material.opacity=0;vPoolFree('me')}
function startWarn(){
  vSt=1;vStT=0;vScreech(false);
  logEv('vNotice',{hp:Math.round(S.hp),x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
  toast('You\'re looking weak... the vultures have noticed you.','bad',4500);
}
function startDive(){
  vSt=2;vStT=0;const s=vPickDiveStart();vDiveX0=s.x;vDiveY0=s.y;vDiveZ0=s.z;
  vScreech(true);logEv('vDive',{x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
  toast('A vulture peels off and dives at you!','bad',2600);
}
function startGrab(){
  vSt=3;vStT=0;vGrabX=P.x;vGrabZ=P.z;vGrabY0=P.y;P.moving=false;digHeld=false;P.vy=0;P.kx=P.kz=0;
  vShadow.material.opacity=0;sfx.thud();
  logEv('vGrab',{x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
  if(!S.ko)toast('It\'s got you!','bad',1800);
}
function startCarry(){
  vSt=4;vStT=0;vCarryX0=P.x;vCarryZ0=P.z;vCarryGround=groundAt(P.x,P.z);
  // height and distance: the F2 sliders set the middle, the old ranges' spread is kept (6-8.5 m, 14-22 m at the defaults)
  const dir=Math.random()*Math.PI*2,dist=tuneOr('vulture.dist',18)*(0.78+Math.random()*0.44);
  vCarryX1=clamp(vCarryX0+Math.sin(dir)*dist,-HALF+3,HALF-3);vCarryZ1=clamp(vCarryZ0+Math.cos(dir)*dist,-HALF+3,HALF-3);
  vCarryApex=tuneOr('vulture.height',(VULTURE_APEX_MIN+VULTURE_APEX_MAX)/2)*(0.83+Math.random()*0.34);
  // the climb takes 60% of the carry, or longer when it's high enough that it would have to brake harder than
  // VULTURE_MAX_BRAKE (ease-out: braking = 2*height/time²); the carry stretches to keep a beat at the top
  const T=tuneOr('vulture.carry',VULTURE_CARRY_TIME);vRiseT=Math.max(T*0.6,Math.sqrt(2*vCarryApex/VULTURE_MAX_BRAKE));vCarryT=Math.max(T,vRiseT+T*0.4);
}
function startDrop(){
  vSt=5;vStT=0;P.vy=1.2;   // a small final upward toss as it lets go, then gravity takes over
  vRagX=(Math.random()*2-1)*9;vRagY=(Math.random()*2-1)*6;vRagZ=(Math.random()*2-1)*8;
  vScreech(false);logEv('vRelease',{x:+P.x.toFixed(1),z:+P.z.toFixed(1),y:+P.y.toFixed(1)});
  if(!S.ko)toast('It let go!','bad',1800);
}
function vLand(impactSpeed){
  const dmg=fallDamage(impactSpeed);
  logEv('vDrop',{dmg,speed:+impactSpeed.toFixed(1),x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
  vCool=tuneOr('vulture.cool',VULTURE_COOLDOWN);vPoolFree('me');   // a breather before it can single you out again
  if(dmg>0)hurt(dmg,'Vulture','A vulture carried you up and dropped you.');
  if(S.ko)return;   // hurt() knocked you out - knockOut() already reset vSt; the ordinary KO/downed flow takes it from here
  vSt=6;vStT=0;P.kx=P.kz=0;
  toast(`The vulture dropped you! -${dmg} health`,'bad',3000);
}
/* a well-timed shovel swing while it's diving close in front of you (hooked at the top of scoop() in 45-state.js) */
function vShoo(){
  if(vSt!==2)return false;
  const dx=vLastBirdX-P.x,dz=vLastBirdZ-P.z,d=Math.hypot(dx,dz);
  if(d>VULTURE_SHOO_RANGE)return false;
  const fx=Math.sin(P.fa),fz=Math.cos(P.fa),dot=(dx*fx+dz*fz)/(d||1);
  if(dot<VULTURE_SHOO_DOT)return false;
  vCancelToIdle();vCool=VULTURE_SHOO_COOL;
  sfx.thud();logEv('vShoo',{x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
  toast('You swing the shovel and scare it off!','good',2200);
  return true;
}

/* ---- states 3-7: drives the takeover, called from updatePlayer's early-return (mirrors twStep) ---- */
function vStep(dt){
  vStT+=dt;
  if(vSt===3){                                                  // grab: brief snatch, already off the ground
    const u=clamp(vStT/VULTURE_GRAB_TIME,0,1);
    P.x=vGrabX;P.z=vGrabZ;P.y=lerp(vGrabY0,vGrabY0+VULTURE_HOLD_UP*0.7,sm(u));P.vy=0;P.grounded=false;
    me.g.position.set(P.x,P.y,P.z);vPersonPose(dt,0.4);
    vDrawCarrier('me',P.x,P.y+VULTURE_HOLD_UP*0.6,P.z,me.g.rotation.y,'grab',dt);
    if(vStT>=VULTURE_GRAB_TIME)startCarry();
  }else if(vSt===4){                                            // carried up and a short way across
    const u=clamp(vStT/vCarryT,0,1);
    P.x=lerp(vCarryX0,vCarryX1,sm(u));P.z=lerp(vCarryZ0,vCarryZ1,sm(u));
    // climbing: fast off the ground, easing to the top at under 1 g (a smoothstep here braked at ~4 g, and the camper
    // hanging from its foot swung up over it)
    const riseU=clamp(vStT/vRiseT,0,1);P.y=clamp(vCarryGround+vCarryApex*(1-(1-riseU)*(1-riseU)),VULTURE_Y_MIN,VULTURE_Y_MAX);
    let dr=Math.atan2(vCarryX1-vCarryX0,vCarryZ1-vCarryZ0)-me.g.rotation.y;dr=Math.atan2(Math.sin(dr),Math.cos(dr));me.g.rotation.y+=dr*Math.min(1,dt*4);
    me.g.position.set(P.x,P.y,P.z);vPersonPose(dt,1);
    vDrawCarrier('me',P.x,P.y+VULTURE_HOLD_UP,P.z,me.g.rotation.y,'carry',dt);
    if(vStT>=vCarryT)startDrop();
  }else if(vSt===5){                                            // dropped - falling ragdoll, same idea as the twister's tumble
    P.vy-=16*dt;P.y+=P.vy*dt;
    if(!me.model){me.g.rotation.x+=dt*vRagX;me.g.rotation.y+=dt*vRagY;me.g.rotation.z+=dt*vRagZ}   // the Blender camper ragdolls instead (26-ragdoll.js)
    if(vStT<VULTURE_LEAVE_TIME)vDrawCarrier('me',P.x,P.y+VULTURE_HOLD_UP+vStT*4,P.z,me.g.rotation.y,'leave',dt);else vPoolFree('me');
    const g=groundAt(P.x,P.z);if(P.y<=g){const impact=Math.abs(P.vy);P.y=g;P.vy=0;vLand(impact)}
    me.g.position.set(P.x,P.y,P.z);
  }else if(vSt===6){                                            // down - lie still, same pose as any other knockout
    animPerson(me,3,dt);me.g.rotation.z=lerp(me.g.rotation.z,0,Math.min(1,dt*6));me.g.position.set(P.x,P.y,P.z);
    if(vStT>=tuneOr('vulture.down',VULTURE_DOWN_TIME)){vSt=7;vStT=0}
  }else if(vSt===7){                                            // getting up
    const u=clamp(vStT/VULTURE_GETUP_TIME,0,1);
    if(!me.model){me.g.rotation.x=lerp(-Math.PI/2,0,u);me.g.rotation.z=lerp(me.g.rotation.z,0,Math.min(1,dt*8))}
    me.g.position.set(P.x,P.y,P.z);
    if(u>=1){vSt=0;P.kx=P.kz=0;P.anim=0;me.g.rotation.set(0,me.g.rotation.y,0)}
  }
}

/* ---- everything above, once a frame (hooked into the main loop in 90-loop.js); runs even before S.started so the
   ambient flock is visible over the title screen too, and even while S.ko so a downed camper still flares for friends ---- */
function updateVultures(dt){
  vCool=Math.max(0,vCool-dt);
  updateVultureFlock(dt);
  if(vSt<2)vPoolFree('me');   // states 3+ are drawn from vStep(); this is just a safety net (KO/respawn/reload mid-sequence)
  if(vSt===0){
    if(underThreatNow())vGraceT+=dt;else vGraceT=0;
    if(vGraceT>=tuneOr('vulture.grace',VULTURE_GRACE))startWarn();
  }else if(vSt===1){
    if(vCancelCheck()){vCancelToIdle();return vRenderRemoteCarries(dt)}
    vStT+=dt;if(vStT>=tuneOr('vulture.warn',VULTURE_WARN_TIME))startDive();
  }else if(vSt===2){
    if(vCancelCheck()){vCancelToIdle();return vRenderRemoteCarries(dt)}
    vStT+=dt;
    const u=sm(clamp(vStT/tuneOr('vulture.dive',VULTURE_DIVE_TIME),0,1)),tx=P.x,tz=P.z,gy=groundAt(tx,tz);
    const bx=lerp(vDiveX0,tx,u),by=lerp(vDiveY0,gy+VULTURE_HOLD_UP,u),bz=lerp(vDiveZ0,tz,u);
    vLastBirdX=bx;vLastBirdZ=bz;
    vDrawCarrier('me',bx,by,bz,Math.atan2(tx-bx,tz-bz),'dive',dt);
    const h=Math.max(0,by-gy);vShadow.position.set(tx,gy+0.05,tz);
    vShadow.material.opacity=clamp(1-h/22,0,0.5);vShadow.scale.setScalar(clamp(1.7-h*0.06,0.35,1.7));
    if(vStT>=tuneOr('vulture.dive',VULTURE_DIVE_TIME)){vShadow.material.opacity=0;startGrab()}
  }
  vRenderRemoteCarries(dt);
}

command('vultures',{usage:'vultures [on|off|now]',help:'Toggle the vulture hazard, force your health low to test the warning, or "now" to skip straight to a dive.',
  run([a]){
    if(a==='off'){vulturesEnabled=false;vCancelToIdle();return'Vultures disabled.'}
    if(a==='on'){vulturesEnabled=true;return'Vultures enabled.'}
    if(a==='now'){
      if(vSt>=3)return'One already has you.';
      setHp(Math.min(S.hp,HP_MAX*tune('vulture.thresh')-1));   // otherwise vCancelCheck() sees full health next frame and calls it straight back off
      startWarn();startDive();return'A vulture dives at you now.';
    }
    setHp(Math.min(S.hp,HP_MAX*tune('vulture.thresh')-1));vGraceT=0;
    return`Health set to ${Math.round(S.hp)}. Stay out on the lake, out of camp and a tent, and they'll notice you in a few seconds.`;
  }});
