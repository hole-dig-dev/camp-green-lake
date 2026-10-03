'use strict';
/* public/js/88-ufo.js -- an easter egg (JT 2026-10-01): a UFO abducts a crew member; a day later it comes back and drops
   off an alien in his place who works just like him, and all he'll ever say is "I'm <name>." Console only for now:
     ufo <name>   he walks out onto the lake bed (from wherever he is), the saucer beams him up and flies off (any hired crew member if no name)
     ufo back     bring the abductee(s) back now (otherwise it happens at the next new day)
   The server keeps it (world.crew[n].abducted = the day he was taken, .alien once he's back) and tells everyone
   ('ufo' take/drop); each screen plays the saucer over its own copy of him (30-npcs.js leaves a crew member alone
   while b.ufo is set). The alien: the camper's own body and head, green, with Sol's AlienFace.glb in place of his face, hair, hats and glasses. Models: UFO.glb, AlienFace.glb (art/blender, Sol). */
const UFO={obj:null,beam:null,anims:[],parts:null,head:null,loading:false};
function ufoLoad(){if(UFO.loading)return;UFO.loading=true;modelParts('UFO').then(p=>{UFO.parts=p}).catch(()=>{});modelParts('AlienFace').then(p=>{UFO.head=p}).catch(()=>{})}
function ufoMesh(){
  const g=new T.Group();if(UFO.parts){g.userData.model=true;for(const pt of UFO.parts){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;g.add(m)}}
  const beam=new T.Mesh(new T.CylinderGeometry(0.6,3.2,1,24,1,true),new T.MeshBasicMaterial({color:0x8dff6a,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide})   /* a green tractor beam */);
  beam.position.y=-0.5;g.add(beam);g.userData.beam=beam;scene.add(g);return g;
}
function ufoSound(on){if(!AC)return;tone(on?180:240,1.2,'sine',0.05,on?420:90);setTimeout(()=>tone(on?260:200,1,'triangle',0.035,on?520:110),200)}
const crewBot=n=>bots.find(b=>b.d.n===n);
/* the call (JT 2026-10-02: wherever he is, asleep in D Tent included, he heads out of camp first): he stops what he's
   doing, says he hears something, walks out of the tent and through the gate onto the lake bed, and the saucer takes
   him there, never over the camp. Grabbed, flung, disarming a mine or busy in a sinkhole: it waits for him.
   UFO_LURE_MAX s and he goes wherever he's got to. b.ufoLure while it lasts (30-npcs.js keeps him on screen). */
const UFO_LURE_MAX=90,UFO_LURE_Z=10;   // the spot: past the main gate (CREW_GATE.out 25), out on the lake bed
const ufoInCamp=(x,z)=>inCamp(x,z)||nearCampNoDig(x,z);
const ufoBusy=b=>b.state==='held'||b.state==='flung'||b.state==='disarming'||b.sinkOverride||(b.p.rag&&b.p.rag.on)||b.state==='away';
function ufoTake(n){
  ufoLoad();const b=crewBot(n);if(!b)return;
  if(b.state==='away'&&!b.p.g.visible){if(CREW_UP[n])CREW_UP[n].abducted=true;return}   // not here at all: he's just gone
  if(b.ufoLure||b.ufo)return;
  b.ufoLure={t:0,go:false};logEv('ufoCall',{n,state:b.state});
}
function ufoLureStep(b,dt){
  const L=b.ufoLure,g=b.p.g;L.t+=dt;
  if(!L.go){if(ufoBusy(b)&&L.t<UFO_LURE_MAX)return;   /* let him land / finish first */
    L.go=true;b.ufo=true;leaveSiftQ(b);b.errand=null;if(b.p.held&&b.p.held.k==='bucket')releaseProp(b.p,'bucket');
    const inside=b.state==='inside'||b.state==='indoor'||g.position.y<TENT_FLOOR_Y+1,asleep=inside&&(curfewSoon()||clockT()>=DAYMS);
    b.state='ufocall';   /* not 'inside' any more: 30-npcs.js would keep him hidden */
    if(inside){g.position.set(D_TENT_DOOR.x,groundAt(D_TENT_DOOR.x,D_TENT_DOOR.z),D_TENT_DOOR.z);g.rotation.y=Math.PI}   /* out of D Tent's door */
    g.visible=true;b.L.el.style.display='';
    const x=g.position.x,z=g.position.z;
    if(ufoInCamp(x,z)||inside){L.tx=gateX(b)+(botRng()-0.5)*6;L.tz=UFO_LURE_Z-botRng()*4}else{L.tx=x;L.tz=z}
    say(b.L,asleep?pick(['Wh... what\'s that light?','Mmf. Someone\'s calling me. Out there.']):inside?pick(['Do you guys hear that?','I gotta go... outside. Don\'t know why.']):ufoInCamp(x,z)?pick(['Something out on the lake is calling me.','Hang on. I need to be... out there.']):pick(['Uh... guys?','Is that a... no.','Not again!']),3200);
    L.t=0}
  const there=walkTo(b,L.tx,L.tz,dt,1.6);
  if(there||L.t>UFO_LURE_MAX){b.ufoLure=null;ufoBeam(b)}
}
/* the abduction: down, beam, up he goes, away */
function ufoBeam(b){
  const n=b.d.n,g=b.p.g.position,x=g.x,z=g.z,y0=groundAt(x,z);
  const u=ufoMesh();u.position.set(x+30,y0+60,z-20);b.ufo=true;leaveSiftQ(b);
  if(nearCam(x,z,120)){ufoSound(true);toast(`What is THAT?! Something's hovering over ${n}!`,'bad',3500)}
  UFO.anims.push({kind:'take',b,u,t:0,x,z,y0,n});logEv('ufoTake',{n,x:+x.toFixed(1),z:+z.toFixed(1),inCamp:ufoInCamp(x,z)});
}
function ufoDrop(n){
  ufoLoad();const b=crewBot(n);if(!b)return;
  if(b.ufoLure||UFO.anims.some(a=>a.b===b)){b.ufoDropAfter=true;return}   /* "ufo back" before he's even up there: right after */
  const h=b.hole&&!ufoInCamp(b.hole.x,b.hole.z)?b.hole:{x:gateX(b),z:UFO_LURE_Z},x=h.x+1.5,z=h.z,y0=groundAt(x,z);
  const u=ufoMesh();u.position.set(x-30,y0+60,z+20);b.ufo=true;b.p.g.visible=false;
  if(S.started)toast(`The saucer's back over the lake... and it's dropping someone off.`,'gold',3500);if(nearCam(x,z,120))ufoSound(true);
  UFO.anims.push({kind:'drop',b,u,t:0,x,z,y0,n});logEv('ufoDrop',{n,x:+x.toFixed(1),z:+z.toFixed(1),inCamp:ufoInCamp(x,z)});
}
const _ue=t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function ufoStep(a,dt){
  a.t+=dt;const u=a.u,beam=u.userData.beam,hov=a.y0+14,b=a.b,g=b.p.g;u.rotation.y+=dt*1.6;
  if(!u.userData.model&&UFO.parts){u.userData.model=true;for(const pt of UFO.parts){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;u.add(m)}}   /* the saucer's model arrives (first time it's loaded) */
  const T1=3,T2=4,T3=7,T4=10;   // arrive, beam on, the lift (or the drop), leave
  if(a.t<T1){const k=_ue(a.t/T1);u.position.set(lerp(a.x+(a.kind==='take'?30:-30),a.x,k),lerp(a.y0+60,hov,k),lerp(a.z+(a.kind==='take'?-20:20),a.z,k))}
  const beamOn=a.t>=T1&&a.t<T3+0.4;beam.material.opacity=beamOn?0.28+0.08*Math.sin(a.t*12):Math.max(0,beam.material.opacity-dt);beam.scale.y=hov-a.y0;beam.position.y=-(hov-a.y0)/2;
  /* it lights what it falls on, like the watchtower searchlights (47-searchlight-glow.js UFO_U) */
  UFO_U.uUFOGain.value=beam.material.opacity*3;UFO_U.uUFOPos.value.copy(u.position);UFO_U.uUFOCos.value=Math.cos(Math.atan2(3.4,Math.max(1,hov-a.y0)));
  if(a.kind==='take'){
    if(a.t>=T2&&a.t<T3){const k=_ue((a.t-T2)/(T3-T2));g.visible=true;g.position.set(a.x,lerp(a.y0,hov-1.5,k),a.z);g.rotation.y+=dt*3;animPerson(b.p,7,dt)}
    if(a.t>=T3&&!a.gone){a.gone=true;g.visible=false;g.position.y=-200;b.state='away';if(CREW_UP[a.n])CREW_UP[a.n].abducted=true}
  }else{
    if(a.t>=T2&&a.t<T3){const k=_ue((a.t-T2)/(T3-T2));g.visible=true;g.position.set(a.x,lerp(hov-1.5,a.y0,k),a.z);g.rotation.y+=dt*2;animPerson(b.p,0,dt)}
    if(a.t>=T3&&!a.landed){a.landed=true;g.position.set(a.x,a.y0,a.z);b.state='return';b.tx=b.hole?b.hole.x:a.x;b.tz=b.hole?b.hole.z:a.z;b.ufo=false;say(b.L,`I'm ${a.n}.`,3500)}
  }
  if(a.t>=T3)u.position.set(u.position.x+dt*(a.t-T3)*12,u.position.y+dt*(a.t-T3)*14,u.position.z);
  if(a.t>=T4){scene.remove(u);UFO_U.uUFOGain.value=0;if(a.kind==='take'){b.ufo=false;if(b.ufoDropAfter){b.ufoDropAfter=false;if(CREW_UP[a.n]){CREW_UP[a.n].abducted=false;CREW_UP[a.n].alien=true}setTimeout(()=>ufoDrop(a.n),1500)}}return false}
  return true;
}
/* the alien look: his own body, head and neck (JT: "keep the head almost the same shape"), green skin, and Sol's
   AlienFace.glb (Wardrobe-face format) on the head bone in place of his eyes, brows, mouth, nose, hair, hat and glasses
   (kept up every frame: the Wardrobe or a hat change mustn't bring his old face back) */
const ALIEN_SKIN=0x5fd04a;   /* alien green (JT: "make the colors green") */
function alienLook(b){
  const p=b.p,m=p.model;if(!m)return;const head=m.getObjectByName('head');if(!head)return;
  if(!p.alienHead&&UFO.head){const g=new T.Group();for(const pt of UFO.head){const mm=new T.Mesh(pt.geometry,pt.material);mm.castShadow=true;g.add(mm)}head.add(g);p.alienHead=g}
  if(!p.alienHead){ufoLoad();return}
  for(const o of head.children)if(o!==p.alienHead)o.visible=/_Head$/.test(o.name);   /* his own head stays, everything on it goes */
  if(!p.alienSkin){p.alienSkin=true;m.traverse(n=>{if(n.isMesh&&n.material&&n.material.name==='CGL_Skin'){n.material=n.material.clone();n.material.color.setHex(ALIEN_SKIN)}})}
}
const isAlien=b=>!!(CREW_UP[b.d.n]&&CREW_UP[b.d.n].alien);
const isAbducted=b=>!!(CREW_UP[b.d.n]&&CREW_UP[b.d.n].abducted);
function updateUfo(dt){
  if(!PARTY.on&&!ZONE_H)for(const b of bots)if(b.ufoLure)ufoLureStep(b,dt);
  for(let i=UFO.anims.length-1;i>=0;i--)if(!ufoStep(UFO.anims[i],dt))UFO.anims.splice(i,1);
  for(const b of bots){if(isAlien(b)&&b.p.g.visible)alienLook(b);const nm=isAlien(b)?ALIEN_NAME:b.d.n;if(b.L.n.textContent!==nm)b.L.n.textContent=nm}   /* the tag over his head gives him away too (JT): Glorb Glorb */
}
/* the alien's conversation (80-ui.js botNode) */
/* the dialog's speaker name gives him away (JT): "Glorb Glorb", saying he's Zach */
const ALIEN_NAME='Glorb Glorb';
function alienNode(b){const name=b.d.n,back=()=>alienNode(b),r=()=>reply(ALIEN_NAME,`I'm ${name}.`,back);
  return{name:ALIEN_NAME,text:`I'm ${name}.`,opts:[{label:'Where have you been?',go:r},{label:'You look... different.',go:r},{label:'What\'s your favourite food?',go:r},{label:'Blink twice if you need help.',go:r},LEAVE]}}
command('ufo',{usage:'ufo [name] | ufo back',help:'An easter egg: a UFO abducts a crew member; "ufo back" brings him back (as himself, more or less).',
  run([a]){const L=bots.filter(b=>crewHired(b)&&!isAbducted(b));
    if((a||'').toLowerCase()==='back'){if(online())wsSend({t:'ufo',back:true});else for(const b of bots)if(isAbducted(b)){CREW_UP[b.d.n].abducted=false;CREW_UP[b.d.n].alien=true;ufoDrop(b.d.n)}return'The saucer is on its way back.'}
    const b=a?bots.find(x=>x.d.n.toLowerCase().startsWith(String(a).toLowerCase())):L[Math.floor(Math.random()*L.length)];
    if(!b||!crewHired(b))return'Nobody to take (hire some crew first).';if(isAbducted(b))return`${b.d.n}'s already up there.`;
    if(online())wsSend({t:'ufo',n:b.d.n});else ufoTake(b.d.n);return`Look up. ${b.d.n}'s about to have a very strange day.`}});
/* whatever the crew would say (work chatter, grumbles, soda breaks...): an alien only ever says "I'm <name>." (JT) */
{const _say=say;say=function(L,text,ms){const b=L&&bots.find(x=>x.L===L);if(b&&isAlien(b))text=`I'm ${b.d.n}.`;return _say(L,text,ms)}}
