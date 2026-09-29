'use strict';
/* public/js/84-grab.js -- R.E.P.O.-style grabbing for heavy loot (the safe, the strongbox), after Greg's phys.js
   (claude/intense-change-1-test-2026-09-27-1829), rebuilt for the lake's own ground (groundAt: holes, mounds and all).
     aim at it and hold R (or the right mouse button)   it hangs from your hands on a spring
     scroll wheel                                       hold it closer or farther
     click (or E) while holding                         throw it
     let go of R                                        drop it
   Soft co-op, no hard gates: one camper pulls at most GRAB.FMAX (700 N), so ~71 kg is all one of you can lift. The 120 kg
   safe needs two to get off the ground; alone you can only drag it (slowly, it's heavy). Hard landings chip value off.
   Walk too far from it and you lose your grip. Get it to Mr. Sir's pickup (SIM.SELL) and it sells for what's left.
   Networking: one camper "owns" a moving prop (the server picks the first grabber). The owner's page runs its physics
   and sends 'pst' ten times a second; other grabbers send their hand position ('phand'), which the server passes to
   the owner. Everyone else draws the reported position, smoothed. When it settles and the owner has let go, the next
   grabber becomes the owner. Solo: you own everything. The old F-to-haul still works (it starts/stops a grab). */
const GRAB_ST={id:null,dist:2.2,handT:0};
const G_UP=new T.Vector3(),G_DIR=new T.Vector3(),G_EYE=new T.Vector3();
function physOf(pr){
  if(!pr.ph){
    const bb=new T.Box3().setFromObject(pr.g),sz=bb.getSize(new T.Vector3());
    const P0=SIM.PHYS[pr.type]||{m:80,frag:0.3};
    pr.ph={m:P0.m,frag:P0.frag,h:Math.max(0.3,sz.y),r:Math.max(0.3,Math.max(sz.x,sz.z)/2)};
    if(pr.y==null)pr.y=groundAt(pr.x,pr.z);pr.vx=pr.vy=pr.vz=0;pr.hands=pr.hands||new Map();pr.grab=pr.grab||[];
    if(pr.val==null)pr.val=SIM.HEAVY[pr.type];pr.v0=SIM.HEAVY[pr.type];pr.hitT=0;pr.restT=0;pr.rest=true;
  }
  return pr.ph;
}
const iOwn=pr=>!online()||pr.owner===myId();
function tuneGrab(k){return tuneOr('grab.'+k,SIM.GRAB[k.toUpperCase()]||0)}

/* ---- aiming: the prop your crosshair is on, within reach ---- */
function aimProp(){
  camera.getWorldPosition(G_EYE);camera.getWorldDirection(G_DIR);
  let best=null,bd=1e9;
  for(const pr of PROPS.values()){
    const ph=physOf(pr);if(Math.hypot(pr.x-P.x,pr.z-P.z)>SIM.GRAB.REACH)continue;
    const cx=pr.x-G_EYE.x,cy=pr.y+ph.h/2-G_EYE.y,cz=pr.z-G_EYE.z,t=cx*G_DIR.x+cy*G_DIR.y+cz*G_DIR.z;if(t<0)continue;
    const off=Math.hypot(cx-G_DIR.x*t,cy-G_DIR.y*t,cz-G_DIR.z*t);
    if(off<ph.r+0.35&&t<bd){bd=t;best=pr}
  }
  return best;
}
/* where your hands are: your chest, out along where you're looking */
function myHand(){
  camera.getWorldDirection(G_DIR);
  return[P.x+G_DIR.x*GRAB_ST.dist,P.y+1.05+G_DIR.y*GRAB_ST.dist,P.z+G_DIR.z*GRAB_ST.dist];   // a little below eye level, so it hangs under the crosshair
}

/* ---- grab / let go / throw ---- */
function grabProp(pr){
  if(!pr||S.ko||uiOpen()||inTent())return false;
  physOf(pr);
  GRAB_ST.id=pr.id;S.carry=pr.id;digHeld=false;
  camera.getWorldPosition(G_EYE);GRAB_ST.dist=clamp(Math.hypot(pr.x-P.x,pr.y+pr.ph.h/2-(P.y+1.25),pr.z-P.z),2.6,3.6);   // at arm's length plus: big things shouldn't fill your view
  if(online())wsSend({t:'pgrab',id:pr.id});else{pr.owner=myId();pr.grab=[myId()]}
  logEv('propGrab',{item:pr.id,type:pr.type});
  const lift=SIM.GRAB.FMAX/9.82;
  if(!grabProp.told){grabProp.told=true;toast(pr.ph.m>lift?`The ${LOOT[pr.type].name} is too heavy to lift alone (${pr.ph.m} kg). Drag it, or get a friend on it too. Scroll to hold it closer, click to throw.`:`Got it. Scroll to hold it closer or farther, click to throw, let go of R to drop it.`,'',6000)}
  return true;
}
function releaseGrab(throwIt){
  const id=GRAB_ST.id;if(id==null)return;GRAB_ST.id=null;if(S.carry===id)S.carry=null;
  const pr=PROPS.get(id);if(!pr)return;
  camera.getWorldDirection(G_DIR);const d=[+G_DIR.x.toFixed(3),+G_DIR.y.toFixed(3),+G_DIR.z.toFixed(3)];
  if(iOwn(pr)){pr.hands.delete(myId());if(throwIt)yeetProp(pr,d,1+pr.grab.filter(g=>g!==myId()).length)}
  if(online())wsSend({t:throwIt?'pyeet':'prel',id,d});else pr.grab=[];
  if(throwIt){sfx.shout();logEv('propThrow',{item:id})}
}
function yeetProp(pr,d,n){
  const ph=physOf(pr),k=Math.min(1,(tuneGrab('fmax')*n/9.82)/ph.m),th=SIM.GRAB.THROW*tune('grab.throw');   // heavy things barely leave your hands
  pr.vx+=d[0]*th*k;pr.vy+=(d[1]*th+2.5)*k;pr.vz+=d[2]*th*k;pr.rest=false;pr.restT=0;
}

/* ---- the physics, run by whoever owns the prop ---- */
function stepProp(pr,dt){
  const ph=physOf(pr),m=ph.m,K=SIM.GRAB.K,D=SIM.GRAB.DAMP,FM=tuneGrab('fmax');
  let fx=0,fy=-9.82*m,fz=0,held=0;
  const now=performance.now();
  for(const[pid,h]of pr.hands){
    if(pid!==myId()&&now-h.t>600){pr.hands.delete(pid);continue}   // a friend's hand we stopped hearing about
    const cx=pr.x,cy=pr.y+ph.h/2,cz=pr.z,dx=h.h[0]-cx,dy=h.h[1]-cy,dz=h.h[2]-cz;
    if(Math.hypot(dx,dy,dz)>SIM.GRAB.SNAP){pr.hands.delete(pid);if(pid===myId()){releaseGrab(false);toast('It slipped out of your hands. Too far, or too heavy.','bad',2500)}continue}
    let gx=dx*K-pr.vx*D,gy=dy*K-pr.vy*D,gz=dz*K-pr.vz*D;const gm=Math.hypot(gx,gy,gz);if(gm>FM){gx*=FM/gm;gy*=FM/gm;gz*=FM/gm}
    fx+=gx;fy+=gy;fz+=gz;held++;
  }
  const lin=held?0.35:0.05;
  pr.vx+=fx/m*dt;pr.vy+=fy/m*dt;pr.vz+=fz/m*dt;
  pr.vx*=1-lin*dt;pr.vy*=1-lin*dt;pr.vz*=1-lin*dt;
  let nx=pr.x+pr.vx*dt,nz=pr.z+pr.vz*dt;
  nx=clamp(nx,-EDGE+1,EDGE-1);nz=clamp(nz,-EDGE+1,EDGE-1);
  const R=ph.r*0.8;
  for(const c of colliders){if(nx>c.x0-R&&nx<c.x1+R&&nz>c.z0-R&&nz<c.z1+R){const px=Math.min(nx-(c.x0-R),(c.x1+R)-nx),pz=Math.min(nz-(c.z0-R),(c.z1+R)-nz);
    if(px<pz){nx=nx<(c.x0+c.x1)/2?c.x0-R:c.x1+R;pr.vx*=-0.2}else{nz=nz<(c.z0+c.z1)/2?c.z0-R:c.z1+R;pr.vz*=-0.2}}}
  pr.x=nx;pr.z=nz;pr.y+=pr.vy*dt;
  const g=groundAt(pr.x,pr.z);
  if(pr.y<=g){
    const imp=-pr.vy;pr.y=g;pr.vy=imp>1.2?imp*0.18:0;
    if(imp>DMG_MIN()&&now-pr.hitT>SIM.DMG.COOL*1000&&pr.val>0){
      pr.hitT=now;const loss=Math.min(pr.val,Math.max(1,Math.round(pr.v0*ph.frag*(imp-DMG_MIN())*SIM.DMG.RATE*tune('grab.fragile'))));
      pr.val-=loss;propHit(pr,loss);
    }
    // ground friction, less while someone's taking some of the weight
    const lift=clamp(fy/(9.82*m)+1,0,1),fr=0.6*9.82*(1-lift)*dt,hs=Math.hypot(pr.vx,pr.vz);
    if(hs>0){const k=Math.max(0,hs-fr)/hs;pr.vx*=k;pr.vz*=k}
  }
  const moving=Math.hypot(pr.vx,pr.vy,pr.vz)>0.08||held;
  pr.restT=moving?0:pr.restT+dt;
  const wasRest=pr.rest;pr.rest=!held&&pr.restT>0.6;
  if(online()&&(now-(pr.sentT||0)>100&&(!pr.rest||!wasRest))){pr.sentT=now;
    wsSend({t:'pst',id:pr.id,x:+pr.x.toFixed(2),y:+pr.y.toFixed(2),z:+pr.z.toFixed(2),vx:+pr.vx.toFixed(2),vy:+pr.vy.toFixed(2),vz:+pr.vz.toFixed(2),val:pr.val,rest:pr.rest})}
  if(!online()&&Math.hypot(pr.x-SIM.SELL.x,pr.z-SIM.SELL.z)<SIM.SELL.r){const v=pr.val;propSold(pr.id,v,[myId()]);payTeam(v)}
}
const DMG_MIN=()=>SIM.DMG.MIN;
function propHit(pr,loss){
  sfx.thud();noise(0.25,260,0.8,0.3,'lowpass');
  if(pr.L)say(pr.L,`-${loss}`,1400);
  if(online())wsSend({t:'pst',id:pr.id,x:+pr.x.toFixed(2),y:+pr.y.toFixed(2),z:+pr.z.toFixed(2),vx:0,vy:0,vz:0,val:pr.val,rest:false});
  logEv('propDmg',{item:pr.id,loss,val:pr.val});
}

/* ---- network ---- */
function grabMsg(m){
  const pr=PROPS.get(num(m.id,0,1e5,-1)|0);if(!pr)return;physOf(pr);
  if(m.t==='pown'){pr.owner=m.owner;pr.grab=Array.isArray(m.grab)?m.grab.slice(0,8):[];
    for(const pid of [...pr.hands.keys()])if(!pr.grab.includes(pid))pr.hands.delete(pid);
    if(GRAB_ST.id===pr.id&&!pr.grab.includes(myId()))releaseGrab(false)}
  else if(m.t==='pst'){
    if(iOwn(pr))return;
    pr.x=num(m.x,-600,600,pr.x);pr.y=num(m.y,-10,60,pr.y);pr.z=num(m.z,-600,600,pr.z);pr.vx=num(m.vx,-40,40,0);pr.vy=num(m.vy,-40,40,0);pr.vz=num(m.vz,-40,40,0);
    const v=num(m.val,0,1e4,pr.val)|0;if(v<pr.val){const loss=pr.val-v;pr.val=v;if(pr.L)say(pr.L,`-${loss}`,1400);sfx.thud()}
    pr.rest=m.rest===true;if(m.owner!==undefined)pr.owner=m.owner;if(Array.isArray(m.grab))pr.grab=m.grab.slice(0,8);pr.netT=performance.now();
  }
  else if(m.t==='phand'){if(iOwn(pr)&&Array.isArray(m.h))pr.hands.set(m.pid,{h:m.h.map(v=>+v||0),t:performance.now()})}
  else if(m.t==='pyeet'){if(iOwn(pr)){pr.hands.delete(m.pid);yeetProp(pr,Array.isArray(m.d)?m.d:[0,0,0],1+pr.grab.length)}}
}

/* ---- grabBeams: a line from each grabber's hands to the object, so everyone can see who's holding what ---- */
const grabBeamMat=new T.LineBasicMaterial({color:0xfff2a8,transparent:true,opacity:0.8});
const grabBeams=[];
function grabBeamLine(i){let l=grabBeams[i];if(!l){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(6),3));l=new T.Line(g,grabBeamMat);l.frustumCulled=false;scene.add(l);grabBeams[i]=l}return l}

/* ---- every frame ---- */
function updateGrab(dt){
  if(!S.started)return;
  // input: hold R / right mouse to grab what you're aiming at; let go to drop
  const want=(KEYS['r']||grabMouse)&&!S.ko&&!uiOpen()&&!inTent();
  if(want&&GRAB_ST.id==null&&!grabHeldBefore){const pr=aimProp();if(pr)grabProp(pr)}
  grabHeldBefore=want;
  if(!want&&GRAB_ST.id!=null&&!grabByUse)releaseGrab(false);
  if(GRAB_ST.id!=null&&(S.carry!==GRAB_ST.id||S.ko||!PROPS.has(GRAB_ST.id)))releaseGrab(false);   // let go from the inventory, knocked out, sold...
  if(GRAB_ST.id==null)grabByUse=false;
  // my hand
  if(GRAB_ST.id!=null){
    const pr=PROPS.get(GRAB_ST.id),h=myHand();
    if(iOwn(pr))pr.hands.set(myId(),{h,t:performance.now()});
    else if((GRAB_ST.handT-=dt)<=0){GRAB_ST.handT=0.1;wsSend({t:'phand',id:pr.id,h:h.map(v=>+v.toFixed(2))})}
    pr.n=Math.max(1,pr.grab.length);
  }
  // physics for what I own, smoothing for the rest
  const sub=Math.max(1,Math.ceil(dt/(1/60))),sdt=dt/sub;
  let bi=0;
  for(const pr of [...PROPS.values()]){
    const ph=physOf(pr);
    if(iOwn(pr)&&(!pr.rest||pr.hands.size))for(let i=0;i<sub&&PROPS.has(pr.id);i++)stepProp(pr,sdt);
    if(!PROPS.has(pr.id))continue;
    let tx=pr.x,ty=pr.y,tz=pr.z;
    if(!iOwn(pr)&&!pr.rest&&pr.netT){const a=Math.min(0.15,(performance.now()-pr.netT)/1000);tx+=pr.vx*a;tz+=pr.vz*a;ty=Math.max(groundAt(tx,tz),ty+pr.vy*a)}
    const g=pr.g,k=iOwn(pr)?1:Math.min(1,dt*12);
    g.position.x+=(tx-g.position.x)*k;g.position.z+=(tz-g.position.z)*k;g.position.y+=(ty-g.position.y)*k;
    // a little sway while it's moving, flat when it rests
    const tilt=pr.rest?0:clamp(Math.hypot(pr.vx,pr.vz)*0.05,0,0.25);g.rotation.z+=(Math.sin(performance.now()/260+pr.id)*tilt-g.rotation.z)*Math.min(1,dt*6);
    if(pr.L){const v=pr.val;if(pr.shownVal!==v){pr.shownVal=v;pr.L.n.textContent=`${LOOT[pr.type].name} · ${v} seeds`}}
    // grabBeams from every grabber
    for(const pid of pr.grab){
      let hx,hy,hz;
      if(pid===myId()){if(GRAB_ST.id!==pr.id)continue;hx=P.x;hy=P.y+1.25;hz=P.z}
      else{const R=remotes.get(pid);if(!R)continue;hx=R.p.g.position.x;hy=R.p.g.position.y+1.25;hz=R.p.g.position.z}
      const l=grabBeamLine(bi++),a=l.geometry.attributes.position;a.setXYZ(0,hx,hy,hz);a.setXYZ(1,g.position.x,g.position.y+ph.h/2,g.position.z);a.needsUpdate=true;l.visible=true;
    }
  }
  for(let i=bi;i<grabBeams.length;i++)grabBeams[i].visible=false;
}
/* how fast you can walk while holding something: light things don't slow you, the safe alone crawls */
function grabSpeed(sp){
  const pr=GRAB_ST.id==null?null:PROPS.get(GRAB_ST.id);if(!pr)return sp;
  const ph=physOf(pr),lift=tuneGrab('fmax')*Math.max(1,pr.grab.length)/9.82/ph.m;
  return sp*clamp(0.3+0.7*lift,0.3,1);
}
let grabMouse=false,grabHeldBefore=false,grabByUse=false;
canvas.addEventListener('mousedown',e=>{if(e.button===2&&S.started&&!uiOpen())grabMouse=true;if(e.button===0&&GRAB_ST.id!=null){releaseGrab(true);digHeld=false}});
addEventListener('mouseup',e=>{if(e.button===2)grabMouse=false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(GRAB_ST.id==null)return;e.preventDefault();GRAB_ST.dist=clamp(GRAB_ST.dist-(e.deltaY>0?0.25:-0.25),1.4,4)},{passive:false});
/* F on a prop (touch screens, or anyone used to the old haul): toggles a grab */
function useProp(pr){if(GRAB_ST.id===pr.id){releaseGrab(false);return}if(grabProp(pr))grabByUse=true}

command('prop',{usage:'prop [safe|strongbox]',help:'Drop a piece of heavy loot [safe] 3 m in front of you, to test grabbing (hold R). Everyone sees it.',
  run([a]){const type=(a||'safe').toLowerCase();if(!(type in SIM.HEAVY))throw new Error('Usage: prop safe | prop strongbox');
    const fx=Math.sin(P.fa),fz=Math.cos(P.fa),x=+(P.x+fx*3).toFixed(2),z=+(P.z+fz*3).toFixed(2);
    let id=9000+Math.floor(Math.random()*999);while(PROPS.has(id))id++;
    if(online())wsSend({t:'prop',item:id,type,x,z});else addProp(id,type,x,z);
    return`A ${LOOT[type].name} (${SIM.PHYS[type].m} kg) landed in front of you. Aim at it and hold R.`}});
