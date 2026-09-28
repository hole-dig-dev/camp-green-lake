'use strict';
/* public/js/85-lion.js -- the mountain lion: one apex predator that stalks, circles and pounces on whoever looks
   most exposed outside the fence, and never sets foot inside it. The rules (target scoring, stalk/circle/pounce,
   deterrence, retreat) live in sim.js's stepLion/lionSwat -- pure functions of shared state, run on the server
   when online and right here for solo play (see stepSoloLion below), exactly like stepMonsters/showTruck/showZeroni
   in 82-patrol.js. This file only draws the animal, plays its sounds, and turns a shovel swing or the console
   command into the messages that drive it.
   Left off the minimap and the HUD on purpose: it's a stalking predator, not a police truck on patrol -- a dot on
   the map would spoil the entire point of "you can't see it coming". A roar (and, up close, a heartbeat) is the
   only warning you get. */

/* ---------- rendering: one animal, a handful of meshes built once and reused (there's only ever one) ---------- */
const LION_C={fur:0xb9824c,dark:0x7a5230,belly:0xe4cd9e,black:0x241812,eye:0xf2d24a};
// body + head + ears + eyes, all baked into one merged mesh (one draw call) -- see mergeBoxes in 10-core.js
const LION_BODY=mergeBoxes([
  [1.05,0.85,2.1,LION_C.fur,0,0.85,0.05],[0.95,0.35,0.55,LION_C.fur,0,1.22,0.85],     // torso, shoulder hump
  [0.85,0.22,1.7,LION_C.belly,0,0.42,0.05],[0.8,0.55,0.5,LION_C.fur,0,0.72,-1.0],     // pale belly, rump taper
  [0.55,0.55,0.5,LION_C.fur,0,1.05,1.2],[0.62,0.5,0.58,LION_C.fur,0,1.18,1.58],       // neck, head
  [0.4,0.26,0.34,LION_C.belly,0,1.03,1.88],[0.16,0.1,0.08,LION_C.black,0,1.05,2.06],  // muzzle, nose
  [0.16,0.22,0.08,LION_C.dark,-0.22,1.5,1.42],[0.16,0.22,0.08,LION_C.dark,0.22,1.5,1.42], // ears
  [0.07,0.06,0.04,LION_C.eye,-0.15,1.24,1.86],[0.07,0.06,0.04,LION_C.eye,0.15,1.24,1.86], // eyes
]);
const LION_LEG=mergeBoxes([[0.22,0.72,0.24,LION_C.fur,0,-0.36,0],[0.24,0.12,0.26,LION_C.dark,0,-0.76,0]]); // one leg + paw, pivot at the hip/shoulder
const LION_TAIL=mergeBoxes([[0.16,0.16,0.7,LION_C.fur,0,-0.02,-0.35],[0.12,0.12,0.55,LION_C.dark,0,-0.28,-0.95]]); // droops, darker toward the tip
const LION_LEG_POS=[['fl',-0.4,0.82,0.62],['fr',0.4,0.82,0.62],['bl',-0.38,0.82,-0.6],['br',0.38,0.82,-0.6]];
const LION_CROUCH={stalk:0.8,circle:0.9,pounce:1.05,pin:0.6,flee:1,leave:1}; // how low it holds itself, per mode
function buildLion(){
  const g=new T.Group();
  const body=new T.Mesh(LION_BODY,mergedMat);body.castShadow=true;body.receiveShadow=true;g.add(body);
  const legs={};for(const[id,x,y,z]of LION_LEG_POS){const p=new T.Group();p.position.set(x,y,z);const m=new T.Mesh(LION_LEG,mergedMat);m.castShadow=true;p.add(m);g.add(p);legs[id]=p}
  const tail=new T.Group();tail.position.set(0,1.1,-1.15);const tm=new T.Mesh(LION_TAIL,mergedMat);tm.castShadow=true;tail.add(tm);g.add(tail);
  g.visible=false;scene.add(g);
  return{g,legs,tail};
}
const LION_M=buildLion();
creatureUpgrade('lion',()=>{const r=spawnCreature('lion');for(const c of LION_M.g.children)c.visible=false;LION_M.g.add(r.obj);LION_M.rig=r});   // the Blender lion (24-creatures.js)

/* ---------- client-side view state: smoothed toward whatever the server (or the solo sim) last reported ---------- */
const LIONV={active:false,x:0,z:0,h:0,mode:'stalk',tgt:null,hp:SIM.LION_HP,init:false,lx:0,lz:0,lh:0,gaitPh:0};
function lionSetActive(on){LIONV.active=on;if(!on){LION_M.g.visible=false;LIONV.init=false}}
function lionFromServer(o){
  const a=o&&o.lion;
  if(!Array.isArray(a)){if(LIONV.active)lionSetActive(false);return}
  if(!LIONV.active)lionSetActive(true);
  LIONV.x=num(a[0],-700,700,LIONV.x);LIONV.z=num(a[1],-700,700,LIONV.z);LIONV.h=num(a[2],-1e4,1e4,LIONV.h);
  LIONV.mode=SIM.LION_MODES[num(a[3],0,SIM.LION_MODES.length-1,0)|0]||'stalk';LIONV.tgt=a[4];LIONV.hp=num(a[5],0,SIM.LION_HP,SIM.LION_HP);
}

/* ---------- solo play: run the exact same sim.js rules locally, like stepSoloMonsters() in 82-patrol.js ---------- */
const LIONL={active:false,armed:true,x:0,z:0,h:0,mode:'stalk',tgt:null,hp:0};
function stepSoloLion(dt){
  if(online())return;
  LIONL.noNatural=DIRECTOR_ON;const ev=[];SIM.stepLion(LIONL,[meSim()],clockT(),dt,ev);
  if(LIONL.active!==LIONV.active)lionSetActive(LIONL.active);
  if(LIONL.active){LIONV.x=LIONL.x;LIONV.z=LIONL.z;LIONV.h=LIONL.h;LIONV.mode=LIONL.mode;LIONV.tgt=LIONL.tgt;LIONV.hp=LIONL.hp}
  for(const e of ev)lionEvent(e);
}

/* ---------- host console command + the matching server message (see the 'lion' case in server.js) ---------- */
command('lion',{usage:'lion [distance]',help:'Spawn the mountain lion out on the lake, [40] m ahead of you. It never enters camp.',
  run([d]){
    const dist=numArg(d,40,15,150),a=P.yaw+Math.PI;   // same "in front of you" math as spawnAhead() in 76-console.js
    const x=clamp(P.x+Math.sin(a)*dist,-EDGE+10,EDGE-10),z=clamp(P.z+Math.cos(a)*dist,-EDGE+10,EDGE-10);
    if(online())wsSend({t:'lion',x,z});else LIONL.pendingSpawn={x,z};
    return`Mountain lion spawned ${dist} m ahead. It hunts whoever looks most exposed -- watch your back, and stay out of its blind spot.`;
  }});

/* ---------- a shovel swing at melee range hits the lion instead of digging (see the one-line hook in scoop()) ---------- */
const LION_SWAT_R=2.8;          // must be at least this close for a swing to land (server re-checks with its own LION_REACH)
const LION_SWAT_COOLDOWN=300;   // ms -- a touch faster than the 420ms dig interval, so every scoop() tick still counts once
let lionSwatT=-1e9;
function lionSwing(){
  if(!LIONV.active||S.ko)return false;
  const d=Math.hypot(LIONV.x-P.x,LIONV.z-P.z);
  if(d>LION_SWAT_R)return false;
  const now=performance.now();
  if(now-lionSwatT<LION_SWAT_COOLDOWN)return true;   // too soon to land another hit, but it still counts as "swinging at the lion", not digging
  lionSwatT=now;
  if(online())wsSend({t:'swat'});else if(SIM.lionSwat(LIONL))lionEvent({k:'swat',id:myId()});
  sfx.clank();P.fa=Math.atan2(LIONV.x-P.x,LIONV.z-P.z);   // square up to face it
  return true;
}

/* ---------- pinned by a pounce: no movement for a moment (camera shake is added in updateLion, after updateCamera runs) ---------- */
let lionPinT=0;
function lionPinStep(dt){
  lionPinT=Math.max(0,lionPinT-dt);
  P.moving=false;P.anim=3;me.g.position.set(P.x,P.y,P.z);animPerson(me,3,dt);
}

/* ---------- sounds: a low growl while it's close and actively hunting, a roar on the pounce and the final
   retreat, and a heartbeat when it's within earshot but out of your view cone ---------- */
const LGROWL={};
function lionLoop(){
  if(!AC)return false;if(LGROWL.ok)return true;LGROWL.ok=true;
  const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=58;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=220;
  LGROWL.g=AC.createGain();LGROWL.g.gain.value=0;o.connect(f).connect(LGROWL.g).connect(fxBus);o.start();
  const lfo=AC.createOscillator();lfo.frequency.value=5.5;const lg=AC.createGain();lg.gain.value=10;lfo.connect(lg).connect(o.frequency);lfo.start(); // a growl's rough edge
  return true;
}
function roar(v){v=v||1;noise(0.55,700,0.6,0.35*v,'lowpass');tone(140,0.7,'sawtooth',0.3*v,50);setTimeout(()=>tone(90,0.5,'sawtooth',0.22*v,40),120)}
let lionHbT=0;
function updateLionSound(dt,d,canSee,mode){
  if(!lionLoop())return;
  const hunting=mode==='stalk'||mode==='circle';
  LGROWL.g.gain.setTargetAtTime(hunting&&d<45?clamp(1-d/45,0,1)*0.05:0,AC.currentTime,0.4);
  lionHbT-=dt;
  if(d<20&&!canSee&&lionHbT<=0){lionHbT=0.75-clamp(1-d/20,0,1)*0.35;tone(58,0.14,'sine',0.28,42);setTimeout(()=>tone(52,0.16,'sine',0.22,38),160)}
}

/* ---------- events (tuning lives in sim.js): a warning the first time you're targeted, deterrence feedback,
   the pounce itself -- damage applied by the victim's own client, same pattern as Zeroni's 'down' -- and the
   roar when it finally gives up. Reached from monEvent()'s default case in 82-patrol.js. ---------- */
function lionEvent(e){
  const mine=e.id===myId(),near=LIONV.active&&Math.hypot(LIONV.x-P.x,LIONV.z-P.z)<90;
  switch(e.k){
    case 'lionTarget':if(mine){toast('You feel like you\'re being watched…','bad',5000);tone(60,0.5,'sine',0.15,45)}break;
    case 'lionPounceStart':if(mine)tone(200,0.15,'sawtooth',0.08,700);break;
    case 'pounce':
      if(mine&&!S.ko){
        hurt(SIM.LION_DMG,'Mountain lion','A mountain lion broke from cover and pounced on you.');
        roar(1.2);sfx.bite();logEv('lionPounce',{x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
        if(!S.ko){lionPinT=SIM.LION_PIN_TIME;toast(`The mountain lion pounced! -${SIM.LION_DMG} health`,'bad',3000)}
        // else: hurt() already knocked you out -- the normal downed flow owns movement/camera from here
      }else if(near)roar(0.4);
      break;
    case 'lionFlee':
      if(mine){const why=e.why==='faced'?'It backs off -- holding your ground worked.':e.why==='lit'?'The flashlight beam spooks it back into the dark.':'It won\'t come any closer with your friends around.';toast(why,'good',3500)}
      break;
    case 'lionRoar':if(near&&e.why==='retreat')toast('The mountain lion roars and lopes off into the heat haze.','good',4500);if(near)roar(0.9);break;
    case 'swat':if(!mine)tone(320,0.08,'square',0.05,180);break;
  }
}

/* ---------- once a frame: solo stepping, smoothing toward the latest numbers, gait animation, sound, shake.
   Called from the main loop after updateCamera(), like updateTwisters() -- so the shake below isn't overwritten
   the same frame it's applied. ---------- */
function updateLion(dt){
  stepSoloLion(dt);
  const g=LION_M.g;
  if(!LIONV.active){if(g.visible)g.visible=false;return}
  g.visible=true;
  if(!LIONV.init){LIONV.init=true;LIONV.lx=LIONV.x;LIONV.lz=LIONV.z;LIONV.lh=LIONV.h}
  const k=Math.min(1,dt*8),ox=LIONV.lx,oz=LIONV.lz;
  LIONV.lx+=(LIONV.x-LIONV.lx)*k;LIONV.lz+=(LIONV.z-LIONV.lz)*k;
  let dh=LIONV.h-LIONV.lh;dh=Math.atan2(Math.sin(dh),Math.cos(dh));LIONV.lh+=dh*k;
  g.position.set(LIONV.lx,groundAt(LIONV.lx,LIONV.lz),LIONV.lz);g.rotation.y=LIONV.lh;
  g.scale.y=lerp(g.scale.y,LION_CROUCH[LIONV.mode]||0.85,Math.min(1,dt*6));
  // leg speed follows its actual ground speed this frame, so a slow stalk creeps and a pounce/flee sprints -- no per-mode guessing
  const moveSpd=Math.min(6,Math.hypot(LIONV.lx-ox,LIONV.lz-oz)/Math.max(dt,0.001));
  if(LION_M.rig)creatureAnim(LION_M.rig,moveSpd<0.3?'Idle':moveSpd<3.5?'Walk':'Run',dt,moveSpd<0.3?1:moveSpd<3.5?0.5+moveSpd/3:0.7+moveSpd/12);
  if(LIONV.mode!=='pin'){LIONV.gaitPh+=dt*(1.6+moveSpd*1.3);
    const s=Math.sin(LIONV.gaitPh)*0.5;LION_M.legs.fl.rotation.x=s;LION_M.legs.br.rotation.x=s;LION_M.legs.fr.rotation.x=-s;LION_M.legs.bl.rotation.x=-s}
  const agitated=LIONV.mode==='pounce'||LIONV.mode==='pin'||LIONV.mode==='flee';
  LION_M.tail.rotation.x=agitated?-0.5:-0.1+Math.sin(performance.now()/500)*0.12;
  LION_M.tail.rotation.y=Math.sin(performance.now()/(agitated?140:260))*(agitated?0.55:0.15);
  const d=Math.hypot(LIONV.x-P.x,LIONV.z-P.z);
  const dx=LIONV.x-P.x,dz=LIONV.z-P.z,dd=Math.hypot(dx,dz)||1,canSee=(dx*Math.sin(P.fa)+dz*Math.cos(P.fa))/dd>0.4;
  updateLionSound(dt,d,canSee,LIONV.mode);
  if(lionPinT>0){const a=clamp(lionPinT/SIM.LION_PIN_TIME,0,1)*0.16;camera.position.x+=(Math.random()-0.5)*a;camera.position.y+=(Math.random()-0.5)*a*0.6;camera.position.z+=(Math.random()-0.5)*a}
}
