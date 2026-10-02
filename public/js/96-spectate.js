'use strict';
/* public/js/96-spectate.js -- spectator mode (JT 2026-10-02: "enter the game not as a playable character but as a camera
   that floats and rotates freely as the game progresses; it'd really improve our iteration process").
   Open the game with ?spectate (e.g. https://…:8445/?spectate). The title's button says Watch: you join as a spectator
   (server.js: you get every update, but you're not a camper: nobody sees you, you don't count for the quota, the
   mines or anything else), and the game runs around a free camera. You never start a camper (S.started stays false,
   so nothing in the game happens to you).
     free:   WASD fly (along where you look), mouse look (click to grab the mouse), Space / C up / down, Shift fast,
             mouse wheel speed
     F       follow the next camper or crew member: the camera orbits them (wheel: closer / further); F again: the next
     R       back to free flight from where you are     H   hide / show the help     Esc   let go of the mouse
   For scripted shots (tests, videos): SPEC.set([x,y,z],[lookX,lookY,lookZ]), SPEC.follow(name,{r,h,spin}),
   SPEC.path([{t,pos,look},…]) flies a keyframed path (t in seconds), SPEC.free(). */
const SPEC={on:/[?&]spectate\b/.test(location.search),mode:'free',pos:new T.Vector3(0,14,-10),yaw:Math.PI,pitch:0.35,speed:12,
  target:null,r:9,h:3,spin:0.25,orbitA:0,keys:null,path:null,pathT:0,joined:false,help:true};
function specJoin(){wsSend({t:'join',n:'Spectator',c:0,u:0,v:2,spec:true,host:HOST||undefined,p:PASS||undefined});SPEC.joined=true}
function specStart(){
  if(!SPEC.on)return;$('#title').hidden=true;$('#hud').hidden=true;initAudio();applyVolume();
  if(online())specJoin();
  let el=document.getElementById('specHelp');if(!el){el=document.createElement('div');el.id='specHelp';el.className='ui-panel spec-help';document.body.appendChild(el)}
  el.innerHTML='<b>Spectator</b> · WASD fly · mouse look (click) · Space/C up/down · Shift fast · wheel speed<br>F follow the next person · R free flight · H hide this';el.hidden=!SPEC.help;
}
/* who's there to follow: campers (remote ones; you're not one) and the crew who are out */
function specPeople(){const L=[];for(const R of remotes.values())if(R.p.g.visible)L.push({n:R.name,p:R.p});for(const b of bots)if(b.p.g.visible&&crewHired(b))L.push({n:b.d.n,p:b.p});return L}
function specFollowNext(){const L=specPeople();if(!L.length){toast('Nobody out to follow.','',1600);return}const i=L.findIndex(x=>SPEC.target&&x.p===SPEC.target.p);SPEC.target=L[(i+1)%L.length];SPEC.mode='follow';toast('Following '+SPEC.target.n,'',1400)}
SPEC.set=(pos,look)=>{SPEC.mode='free';SPEC.pos.set(...pos);if(look){const d=new T.Vector3(...look).sub(SPEC.pos);SPEC.yaw=Math.atan2(-d.x,-d.z);SPEC.pitch=-Math.atan2(d.y,Math.hypot(d.x,d.z))}};
SPEC.follow=(who,o={})=>{const L=specPeople(),t=typeof who==='string'?L.find(x=>x.n.toLowerCase()===who.toLowerCase()):who;if(!t)return false;SPEC.target=t.p?t:{n:'?',p:t};SPEC.mode='follow';if(o.r)SPEC.r=o.r;if(o.h!=null)SPEC.h=o.h;if(o.spin!=null)SPEC.spin=o.spin;return true};
SPEC.path=keys=>{SPEC.keys=keys.slice().sort((a,b)=>a.t-b.t);SPEC.pathT=0;SPEC.mode='path'};
SPEC.free=()=>{SPEC.mode='free'};
const _sv=new T.Vector3(),_sl=new T.Vector3();
function specKey(k,e){
  if(k==='f'){specFollowNext();return true}
  if(k==='r'){SPEC.pos.copy(camera.position);SPEC.mode='free';return true}
  if(k==='h'){SPEC.help=!SPEC.help;const el=document.getElementById('specHelp');if(el)el.hidden=!SPEC.help;return true}
  return false;
}
function specMouse(dx,dy){if(SPEC.mode==='follow'){SPEC.orbitA-=dx*0.004;SPEC.h=clamp(SPEC.h+dy*0.01,0.5,30);return}SPEC.yaw-=dx*0.0026*SETTINGS.sens;SPEC.pitch=clamp(SPEC.pitch+dy*0.0022*SETTINGS.sens,-1.5,1.5)}
function specWheel(dy){if(SPEC.mode==='follow')SPEC.r=clamp(SPEC.r*(dy>0?1.12:0.89),2,80);else SPEC.speed=clamp(SPEC.speed*(dy>0?0.85:1.18),2,120)}
function updateSpectator(dt){
  if(SPEC.mode==='path'&&SPEC.keys&&SPEC.keys.length){
    SPEC.pathT+=dt;const K=SPEC.keys;let i=0;while(i<K.length-1&&K[i+1].t<=SPEC.pathT)i++;const a=K[i],b=K[Math.min(i+1,K.length-1)],u=b.t>a.t?clamp((SPEC.pathT-a.t)/(b.t-a.t),0,1):1,e=u*u*(3-2*u);
    const look=a.look&&b.look?_sl.set(...a.look).lerp(_sv.set(...b.look),e):null;camera.position.set(...a.pos).lerp(_sv.set(...b.pos),e);if(look)camera.lookAt(look);
    if(typeof a.look==='string'||typeof b.look==='string'){const t=specPeople().find(x=>x.n===(b.look||a.look));if(t)camera.lookAt(t.p.g.position.x,t.p.g.position.y+1.2,t.p.g.position.z)}
    SPEC.pos.copy(camera.position);return}
  if(SPEC.mode==='follow'&&SPEC.target&&SPEC.target.p){
    const g=SPEC.target.p.g.position;SPEC.orbitA+=dt*SPEC.spin;
    camera.position.set(g.x+Math.sin(SPEC.orbitA)*SPEC.r,g.y+SPEC.h,g.z+Math.cos(SPEC.orbitA)*SPEC.r);camera.lookAt(g.x,g.y+1.1,g.z);SPEC.pos.copy(camera.position);return}
  /* free flight */
  const fast=KEYS['shift']?4:1,sp=SPEC.speed*fast*dt,cy=Math.cos(SPEC.yaw),sy=Math.sin(SPEC.yaw),cp=Math.cos(SPEC.pitch);
  const fw=_sv.set(-sy*cp,-Math.sin(SPEC.pitch),-cy*cp),rt=_sl.set(cy,0,-sy);
  if(KEYS['w'])SPEC.pos.addScaledVector(fw,sp);if(KEYS['s'])SPEC.pos.addScaledVector(fw,-sp);if(KEYS['d'])SPEC.pos.addScaledVector(rt,sp);if(KEYS['a'])SPEC.pos.addScaledVector(rt,-sp);
  if(KEYS[' '])SPEC.pos.y+=sp;if(KEYS['c'])SPEC.pos.y-=sp;SPEC.pos.y=Math.max(SPEC.pos.y,groundAt(SPEC.pos.x,SPEC.pos.z)+0.3);
  camera.position.copy(SPEC.pos);camera.rotation.set(0,0,0,'YXZ');camera.rotation.order='YXZ';camera.rotation.y=SPEC.yaw;camera.rotation.x=-SPEC.pitch;
}
if(SPEC.on){const b=document.getElementById('startBtn');if(b)b.textContent='Watch (spectator)';const n=document.getElementById('nick');if(n&&!n.value)n.value='Spectator'}
