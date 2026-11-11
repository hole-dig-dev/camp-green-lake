'use strict';
/* public/js/27-alive.js -- LIFE IN THE CHARACTERS (2026-11-10).
   The diggers had good bodies and dead faces: the head never turned, the eyes never blinked, the mouth never moved,
   nobody looked at anybody. In PEAK, R.E.P.O. and CRACK the bodies are simpler than ours; what sells them is that a
   character visibly attends to things: it looks where its player looks, its mouth moves when its player talks, it
   blinks, breathes, flinches and sags. This file adds that layer on top of whatever clip is playing, for every person
   (you in third person, your friends, the crew, the staff). It runs after the animation mixer each frame
   (25-people.js animModel calls alivePose) and only ever adds small offsets to the pose, so every clip keeps working.

     look     the head (and a little of the chest) turns toward where the person is looking: for you, where your camera
              points; for friends, their camera (sent in 'pos' as look yaw/pitch); for everyone else, the nearest person
              in front of them within ALIVE.see metres, else a slow idle drift. The eyes lead the head.
     blink    every 2-6 s, 110 ms, plus a blink when the gaze jumps.
     breath   the chest rises and falls; faster and deeper when out of stamina (person.tired 0..1).
     talk     the mouth opens with the voice (86-voice.js levels for players, a synthetic flap while an NPC's speech
              bubble is up). aliveTalk(person, 0..1) feeds it.
     mood     brows: pain for a moment after a hit (aliveFlinch), heavy when tired; the head hangs when exhausted.

   Bones are found by name in the person's own cloned skeleton; face parts (eyes, brows, mouth) are separate little
   meshes parented to the head bone, so they can be moved without touching the rig or the GLB. If a model has no such
   parts the layer quietly does less. Tuning numbers are in ALIVE. */
const ALIVE={see:9,headYaw:1.05,headPitch:0.55,chest:0.28,lookSpeed:7,eyeLead:0.012,blinkMin:2,blinkMax:6,blinkLen:0.11,breath:0.014,mouthOpen:1.9,on:true};
const _alQ=new T.Quaternion(),_alE=new T.Euler(0,0,0,'YXZ'),_alV=new T.Vector3(),_alW=new T.Vector3();
function aliveInit(p){
  const A={head:null,spine:null,eyes:[],brows:[],mouth:null,yaw:0,pitch:0,ty:0,tp:0,blinkAt:1+Math.random()*4,blink:0,ph:Math.random()*6.28,talk:0,talkT:0,flinch:0,drift:Math.random()*10,ok:false};
  if(!p.model)return A;
  if(p.g)p.g.userData.person=p;   // so a speech bubble can find whose mouth to move (25-people.js say)
  p.model.traverse(n=>{const nm=n.name||'';
    if(n.isBone&&/^head$/i.test(nm))A.head=n;else if(n.isBone&&/^spine$/i.test(nm))A.spine=n;
    else if(/_Eye-?1$/.test(nm))A.eyes.push({n,p:n.position.clone(),s:n.scale.clone()});
    else if(/_Brow-?1$/.test(nm))A.brows.push({n,r:n.rotation.z,y:n.position.y,side:/-1$/.test(nm)?-1:1});
    else if(/_Mouth$/.test(nm))A.mouth={n,s:n.scale.clone(),y:n.position.y}});
  A.ok=!!A.head;return A;
}
/* feed the mouth: level 0..1 (voice loudness). Decays by itself, so call it while they speak. */
function aliveTalk(p,level){if(!p)return;const A=p.alive||(p.alive=aliveInit(p));A.talk=Math.max(A.talk,clamp(level,0,1));A.talkT=0.18}
/* a wince: brows pinch, eyes shut, head snaps down a little. Call when the person is hurt. */
function aliveFlinch(p,amount){if(!p)return;const A=p.alive||(p.alive=aliveInit(p));A.flinch=Math.max(A.flinch,clamp(amount==null?1:amount,0,1));A.blink=ALIVE.blinkLen*2.2}
const _alWrap=a=>{a%=6.283185307;return a>3.14159265?a-6.283185307:a<-3.14159265?a+6.283185307:a};
/* where this person wants to look, as yaw/pitch relative to their body: explicit (p.look = {yaw,pitch} in world terms,
   yaw being a heading like p.g.rotation.y), or the nearest person in front of them, or an idle drift */
function aliveTarget(p,A,dt){
  const g=p.g,by=g.rotation.y;
  if(p===me&&S.started){A.ty=_alWrap(Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw))-by);A.tp=P.pitch;p.tired=Math.max(clamp(1-S.stam/35,0,1),digEffort()*0.6);return}   // you: where your camera points
  if(p.look){A.ty=_alWrap(p.look.yaw-by);A.tp=p.look.pitch;return}
  let best=null,bd=ALIVE.see;g.getWorldPosition(_alW);
  const consider=(x,y,z)=>{const dx=x-_alW.x,dz=z-_alW.z,d=Math.hypot(dx,dz);if(d<0.4||d>=bd)return;const ry=_alWrap(Math.atan2(dx,dz)-by);if(Math.abs(ry)>1.75)return;bd=d;best=[ry,Math.atan2(y-(_alW.y+1.55),d)]};
  if(typeof P!=='undefined'&&S.started&&p!==me)consider(P.x,P.y+1.6,P.z);
  if(typeof remotes!=='undefined')for(const R of remotes.values()){if(R.p===p)continue;const q=R.p.g.position;consider(q.x,q.y+1.6,q.z)}
  if(best){A.ty=best[0];A.tp=-best[1]*0.9;return}
  A.drift+=dt;A.ty=Math.sin(A.drift*0.23+A.ph)*0.35+Math.sin(A.drift*0.61+A.ph*2)*0.12;A.tp=Math.sin(A.drift*0.31+A.ph)*0.06;   // nobody around: look about idly
}
function alivePose(p,dt){
  if(!ALIVE.on||!p.model)return;const A=p.alive||(p.alive=aliveInit(p));if(!A.ok)return;
  dt=Math.min(0.05,dt||0.016);A.ph+=dt;
  const ko=p.ragOn||p.sleeping||p.koPose;                       // out cold or asleep: eyes shut, no looking
  /* --- look --- */
  if(!ko)aliveTarget(p,A,dt);else{A.ty=0;A.tp=0.25}
  const ty=clamp(A.ty,-ALIVE.headYaw-ALIVE.chest,ALIVE.headYaw+ALIVE.chest),tp=clamp(A.tp,-ALIVE.headPitch,ALIVE.headPitch),k=Math.min(1,dt*ALIVE.lookSpeed);
  const jump=Math.abs(ty-A.yaw)+Math.abs(tp-A.pitch);if(jump>0.7&&A.blink<=0)A.blink=ALIVE.blinkLen;                 // people blink when their gaze jumps
  A.yaw+=(ty-A.yaw)*k;A.pitch+=(tp-A.pitch)*k;
  const tired=clamp(p.tired||0,0,1),chestYaw=clamp(A.yaw*0.3,-ALIVE.chest,ALIVE.chest),headYaw=clamp(A.yaw-chestYaw,-ALIVE.headYaw,ALIVE.headYaw);
  if(A.spine){_alE.set(0,chestYaw,0);A.spine.quaternion.multiply(_alQ.setFromEuler(_alE))}
  _alE.set((A.pitch+tired*0.22+A.flinch*0.25)*(1-0.45*Math.abs(headYaw)/ALIVE.headYaw),headYaw,0);   // less nod when turned far to the side: the two together read as a broken neck
A.head.quaternion.multiply(_alQ.setFromEuler(_alE));
  /* --- breath --- */
  if(A.spine){const rate=1.5+tired*2.6,amp=ALIVE.breath*(1+tired*2.2),b=Math.sin(A.ph*rate);A.spine.scale.set(1+b*amp*0.6,1+b*amp,1+b*amp*1.4)}
  /* --- blink --- */
  A.blinkAt-=dt;if(A.blinkAt<=0){A.blink=ALIVE.blinkLen;A.blinkAt=ALIVE.blinkMin+Math.random()*(ALIVE.blinkMax-ALIVE.blinkMin)*(1-tired*0.5)}
  if(A.blink>0)A.blink-=dt;
  const shut=ko?1:A.blink>0?1:tired>0.75?0.35:0,ex=(ty-A.yaw),ey=(tp-A.pitch);
  for(const e of A.eyes){e.n.scale.set(e.s.x,e.s.y*(1-shut*0.88),e.s.z);e.n.position.set(e.p.x+clamp(ex,-1,1)*ALIVE.eyeLead,e.p.y-clamp(ey,-1,1)*ALIVE.eyeLead*0.7,e.p.z)}   // eyes lead the head toward the target
  /* --- talk --- */
  if(A.sayUntil&&performance.now()<A.sayUntil){A.talk=Math.max(A.talk,0.55+0.45*Math.abs(Math.sin(A.ph*9.3)));A.talkT=0.1}   // an NPC line: flap along with the bubble
  if(A.talkT>0)A.talkT-=dt;else A.talk*=Math.max(0,1-dt*14);
  if(A.mouth){const open=ko?0.25:A.talk*(0.65+0.35*Math.abs(Math.sin(A.ph*17)));A.mouth.n.scale.set(A.mouth.s.x*(1-open*0.18),A.mouth.s.y*(1+open*ALIVE.mouthOpen),A.mouth.s.z);A.mouth.n.position.y=A.mouth.y-open*0.012}
  /* --- mood --- */
  if(A.flinch>0)A.flinch=Math.max(0,A.flinch-dt*2.2);
  for(const b of A.brows){b.n.rotation.z=b.r+b.side*(A.flinch*0.45-tired*0.22);b.n.position.y=b.y-A.flinch*0.006-tired*0.004+(A.talk>0.5?0.004:0)}
}
