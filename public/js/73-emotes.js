'use strict';
/* public/js/73-emotes.js -- emotes, ported from Greg's branch (claude/intense-change-1-test-2026-09-27-1829):
     B        twerk: bend over and shake it for a couple of seconds, then an audible fart and a little green cloud
     hold H   sing Madame Zeroni's lullaby: a line over your head and the tune, every ~0.9 s while held
   Friends nearby see and hear both (server relays 'emote', rate-limited). Both are noisy (S.noise), so at night they
   draw Madame Zeroni like a shout does.
   The pose is layered on top of the camper's animation after the mixer runs (emotePose, called from 25-people.js),
   so it works on the Blender camper; the box people (before the model loads) get Greg's original box pose. */
const TWERK_SECS=2.4,SING_EVERY=0.9;
const LULLABY=['If only, if only,','the woodpecker sighs,','the bark on the tree','was as soft as the skies.'];
const SONG_NOTES=[392,440,494,440,392,330,392,440];

/* ---- starting an emote (mine or a friend's) ---- */
function startEmote(p,k,L){
  if(!p)return;
  if(k==='twerk'){if(p.emote&&p.emote.k==='twerk')return;p.emote={k,t:TWERK_SECS}}
  else if(k==='sing'){p.emote={k,t:SING_EVERY+0.15};p.singN=(p.singN||0);if(L)say(L,LULLABY[(p.singN>>1)%LULLABY.length]+' ♪',2200);singNote(p.singN,p===me?1:emoteVol(p));p.singN++}
}
function emoteVol(p){const d=Math.hypot(p.g.position.x-P.x,p.g.position.z-P.z);return clamp(1-d/45,0,1)}
function twerk(){
  if(!S.started||S.ko||uiOpen()||S.carry!=null||(me&&me.emote&&me.emote.k==='twerk'))return;
  digHeld=false;S.noise=1;countUp('twerks',20,'barfbag');startEmote(me,'twerk');wsSend({t:'emote',k:'twerk'});logEv('emote',{k:'twerk'});
}
let singT=0;
function updateSinging(dt){
  const on=KEYS['h']&&S.started&&!S.ko&&!uiOpen();
  if(!on){singT=0;return}
  S.noise=Math.max(S.noise,0.7);
  if((singT-=dt)<=0){singT=SING_EVERY;countUp('sing',40,'lullaby');moodSing();startEmote(me,'sing',meL);wsSend({t:'emote',k:'sing'})}
}

/* ---- the pose, layered over whatever clip is playing ---- */
function emotePose(p,dt){
  const e=p.emote;if(!e)return;
  e.t-=dt;
  const ph=performance.now()/1000;
  if(e.t<=0){
    if(e.k==='twerk'){const g=p.g.position;fart(g.x,g.y,g.z,p.g.rotation.y,p===me?1:emoteVol(p))}
    p.emote=null;if(!p.model&&p.upper){p.upper.rotation.set(0,0,0);p.upper.position.y=0.8}
    return;
  }
  if(p.model){
    const B=p.bones||(p.bones=emoteBones(p));if(!B.spine)return;
    if(e.k==='twerk'){
      const s=ph*20,b=Math.abs(Math.sin(s));
      B.spine.rotation.x+=0.95;                          // bent over at the waist
      B.hips.rotation.z+=Math.sin(s)*0.18;B.hips.rotation.y+=Math.sin(s*0.5)*0.12;
      B.hips.position.y-=0.1-b*0.06;                     // bounce
      if(B.legL)B.legL.rotation.x-=0.3;if(B.legR)B.legR.rotation.x-=0.3;
      if(B.armL)B.armL.rotation.x+=0.9;if(B.armR)B.armR.rotation.x+=0.9;   // hands on knees
    }else if(e.k==='sing'){
      B.head.rotation.x-=0.35+Math.sin(ph*3)*0.05;       // chin up
      if(B.armL)B.armL.rotation.z-=0.5;if(B.armR)B.armR.rotation.z+=0.5;   // arms out a little
      B.spine.rotation.z+=Math.sin(ph*2.2)*0.06;         // sway
    }
  }else if(p.upper){   // box person
    if(e.k==='twerk'){const s=ph*20,b=Math.abs(Math.sin(s));
      p.upper.rotation.x=0.95;p.upper.rotation.y=Math.sin(s*0.5)*0.12;p.upper.rotation.z=Math.sin(s)*0.16;p.upper.position.y=0.72+b*0.08;
      p.legL.rotation.x=-0.25;p.legR.rotation.x=-0.25;p.armL.rotation.x=-1;p.armR.rotation.x=-1}
  }
}
function emoteBones(p){
  const names={hips:'hips',spine:'spine',head:'head',armL:'armL',armR:'armR',legL:'legL',legR:'legR'},B={};p.poseRest=p.poseRest||[];const have=new Set(p.poseRest.map(e=>e[0]));
  for(const k in names){const b=p.model.getObjectByName(names[k]),r=MODEL.scene.getObjectByName(names[k]);B[k]=b||null;
    if(b&&r&&!have.has(b))p.poseRest.push([b,r.quaternion.clone(),r.position.clone()])}   // stepMixer (25-people.js) resets these to rest before each update
  return B;
}

/* ---- sound and the cloud ---- */
function singNote(n,vol){if(vol>0.02)tone(SONG_NOTES[n%SONG_NOTES.length],0.4,'triangle',0.06*vol)}
function fart(x,y,z,ry,vol){fartSound(vol);fartCloud(x,y,z,ry)}
function fartSound(vol){
  if(!AC||vol<=0.02)return;
  vol*=tune('vol.synth');if(vol<=0)return;
  const t=AC.currentTime,o=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain(),lfo=AC.createOscillator(),lg=AC.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(115,t);o.frequency.exponentialRampToValueAtTime(52,t+0.8);
  lfo.type='square';lfo.frequency.setValueAtTime(30,t);lfo.frequency.linearRampToValueAtTime(12,t+0.8);lg.gain.value=38;lfo.connect(lg).connect(o.frequency);
  f.type='lowpass';f.frequency.value=450;f.Q.value=7;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.55*vol,t+0.04);g.gain.setValueAtTime(0.55*vol,t+0.55);g.gain.exponentialRampToValueAtTime(0.001,t+0.9);
  o.connect(f).connect(g).connect(fxBus);o.start(t);lfo.start(t);o.stop(t+0.95);lfo.stop(t+0.95);noise(0.55,320,1,0.3*vol,'lowpass');
}
const CLOUDS=[],cloudGeo=new T.SphereGeometry(0.2,8,6);
function fartCloud(x,y,z,ry){
  const g=new T.Group(),bx=-Math.sin(ry),bz=-Math.cos(ry);g.position.set(x+bx*0.35,y+0.72,z+bz*0.35);
  for(let i=0;i<7;i++){const m=new T.Mesh(cloudGeo,new T.MeshBasicMaterial({color:0x86d44f,transparent:true,opacity:0.65,depthWrite:false}));
    m.position.set((Math.random()-0.5)*0.35,(Math.random()-0.3)*0.25,(Math.random()-0.5)*0.35);
    m.userData.v=new T.Vector3(bx*0.5+(Math.random()-0.5)*0.35,0.2+Math.random()*0.3,bz*0.5+(Math.random()-0.5)*0.35);g.add(m)}
  scene.add(g);CLOUDS.push({g,t:0});
}
function updateEmotes(dt){
  updateSinging(dt);
  for(let i=CLOUDS.length-1;i>=0;i--){const c=CLOUDS[i];c.t+=dt;
    for(const m of c.g.children){m.position.addScaledVector(m.userData.v,dt);m.scale.setScalar(1+c.t*1.4);m.material.opacity=Math.max(0,0.65*(1-c.t/2.2))}
    if(c.t>2.2){scene.remove(c.g);for(const m of c.g.children)m.material.dispose();CLOUDS.splice(i,1)}}
}
