'use strict';
/* public/js/84-grab.js -- R.E.P.O.-style grabbing, the rope, the wheelbarrow and carrying downed friends, after Greg's
   branch (claude/intense-change-1-test-2026-09-27-1829: phys.js and checkpoint 3), rebuilt for the lake's own ground.
     aim + hold R (or right mouse)   grab it: loot, the wheelbarrow, or a downed friend. It hangs from your hands on a spring
     scroll                          hold it closer / farther          click or E while holding   throw it
     X (aimed at something)          tie your rope to it; walk away and it pulls once it's taut. X again unties
     F next to the wheelbarrow       put what you're holding in it (up to 3 things: loot or a downed friend)
   One camper pulls at most GRAB.FMAX (900 N): ~92 kg is the most one of you can lift. The 60 kg strongbox lifts alone, the
   120 kg safe needs two (alone you drag it, slowly), a 70 kg body lifts alone.
   Carrying (JT 2026-09-30, tests/carry): in third person it rides chest-high in front of you and a little to the right,
   where the camera sees it (look down / up to lower / raise it); it's a leash, not a snap: when it falls behind your
   hands you slow down instead of losing it. Setting it down, or knocks while someone holds it, don't chip it; drops
   from a height and throws do. You can also grab a friend on their feet (they're dragged; two of you lift them; three
   taps of Space and they wriggle free) and the D Tent crew (only you see that: they aren't networked). A rope pulls like another pair of
   hands, but hauling something heavy up out of a hole with too few people on it (or running out of stamina) and THE ROPE
   SLIPS. The wheelbarrow rolls easily with anything in it, but hit a bump or a hole edge fast and it tips and spills.
   Downed friends: grab or rope them, or wheel them. While someone's got hold of you, your knockout timer stops, and
   being carried inside the camp fence picks you up. Sell loot by getting it (or the wheelbarrow with it inside) to
   Mr. Sir's pickup; bumps chip value off.
   Networking: one camper "owns" a moving thing and runs its physics (the first grabber for loot and the cart; a downed
   camper always owns their own body). Everyone else holding on sends their hand ('phand', rope:true for ropes), which
   the server passes to the owner. Target ids: >= 0 a prop (PROPS, the cart is a prop), < 0 the body of camper -id. */
const GRAB_ST={id:null,dist:2.8,handT:0};
const ROPE_ST={id:null,handT:0,taut:false};
const G_DIR=new T.Vector3(),G_EYE=new T.Vector3();
const MYBODY={id:null,x:0,y:0,z:0,vx:0,vy:0,vz:0,hands:new Map(),grab:[],ropes:[],ph:{m:70,frag:0,h:0.5,r:0.45},rest:true,restT:0,val:0,v0:0,hitT:0,body:true};
const BODIES=new Map();   // remote downed campers as grab targets: pid -> {id:-pid, grab, ropes}
function physOf(pr){
  if(!pr.ph){
    const bb=new T.Box3().setFromObject(pr.g),sz=bb.getSize(new T.Vector3());
    const P0=SIM.PHYS[pr.type]||{m:80,frag:0.3};
    pr.ph={m:P0.m,frag:P0.frag,h:Math.max(0.3,sz.y),r:Math.max(0.3,Math.max(sz.x,sz.z)/2)};
    if(pr.y==null)pr.y=groundAt(pr.x,pr.z);pr.vx=pr.vy=pr.vz=0;pr.hands=pr.hands||new Map();pr.grab=pr.grab||[];pr.ropes=pr.ropes||[];
    pr.v0=pr.val0!=null?pr.val0:SIM.HEAVY[pr.type]||0;if(pr.val==null)pr.val=pr.v0;pr.hitT=0;pr.restT=0;pr.rest=true;pr.load=pr.load||[];   // v0: chips scale with what it was worth when dug up
  }
  return pr.ph;
}
const isCart=pr=>pr&&pr.type==='cart';
const propName=pr=>pr.type==='cart'?'wheelbarrow':LOOT[pr.type].name;
const iOwn=pr=>pr.body?true:(!online()||pr.owner===myId());
function tuneGrab(k){return tuneOr('grab.'+k,SIM.GRAB[k.toUpperCase()]||0)}
/* a grab target by id: a prop, or a remote downed camper's body */
/* ids: >= 0 a prop; -pid a friend (knocked out, or on their feet: JT 2026-09-30, grab anyone, R.E.P.O.-style);
   CREW_GRAB_ID - k the D Tent crew member bots[k] (they aren't networked, so only you see it: 30-npcs.js crewHeld) */
const CREW_GRAB_ID=-1e6;
function targetOf(id){
  if(id==null)return null;
  if(id>=0)return PROPS.get(id)||null;
  if(id<=CREW_GRAB_ID){const b=bots[CREW_GRAB_ID-id];if(!b||!crewGrabbable(b))return null;const g=b.p.g.position;
    return Object.assign(b.gt||(b.gt={id,isCrew:true,grab:[],ropes:[]}),{b,x:g.x,y:g.y,z:g.z})}
  const R=remotes.get(-id);if(!R||R.room!==S.tent||!!R.tn!==!!S.inTown)return null;
  let b=BODIES.get(-id);if(!b){b={id,pid:-id,grab:[],ropes:[],isBody:true};BODIES.set(-id,b)}
  b.R=R;b.standing=!(R.f&2);b.x=R.p.g.position.x;b.y=R.p.g.position.y;b.z=R.p.g.position.z;b.ph=MYBODY.ph;return b;
}
const tName=t=>t.isCrew?t.b.d.n:t.isBody?(t.R?t.R.name:'your friend'):isCart(t)?'wheelbarrow':LOOT[t.type].name;
function massOf(t){if(t.isBody||t.isCrew)return 70;const ph=physOf(t);if(!isCart(t))return ph.m;let m=ph.m;for(const l of t.load||[])m+=l<0?70:((SIM.PHYS[(PROPS.get(l)||{}).type]||{m:0}).m);return m}

/* ---- aiming: whatever your crosshair is on, within reach ---- */
function aimTarget(reach){
  camera.getWorldPosition(G_EYE);camera.getWorldDirection(G_DIR);
  let best=null,bd=1e9;
  const test=(t,cx,cy,cz,r)=>{if(Math.hypot(t.x-P.x,t.z-P.z)>reach)return;cx-=G_EYE.x;cy-=G_EYE.y;cz-=G_EYE.z;const d=cx*G_DIR.x+cy*G_DIR.y+cz*G_DIR.z;if(d<0)return;
    if(Math.hypot(cx-G_DIR.x*d,cy-G_DIR.y*d,cz-G_DIR.z*d)<r&&d<bd){bd=d;best=t}};
  for(const pr of PROPS.values()){if(pr.cartId!=null)continue;const ph=physOf(pr);test(pr,pr.x,pr.y+ph.h/2,pr.z,ph.r+(isCart(pr)?0.6:0.35))}   // what's in the wheelbarrow: the wheelbarrow (it's bigger to aim at)
  for(const rid of remotes.keys()){const t=targetOf(-rid);if(t)test(t,t.x,t.y+(t.standing?0.9:0.35),t.z,t.standing?0.55:0.8)}
  if(S.tent==null&&!S.inTown)bots.forEach((b,k)=>{const t=targetOf(CREW_GRAB_ID-k);if(t)test(t,t.x,t.y+0.9,t.z,0.55)});
  return best;
}
/* where your hands hold it. First person: out along your view (R.E.P.O.). Third person: in front of you and a touch to
   the right, where the camera can see it past your shoulder, at chest height; look down or up to lower or raise it.
   (It used to follow the camera's ray in third person too, which points down at your camper: things dragged along
   the ground hidden behind you. JT 2026-09-30.) Never below the ground. */
const GRAB_SIDE=0.65,GRAB_CHEST=1.05,GRAB_CARRY=1.3;   // CARRY: third person's carrying height (chest-high, so a crate swings clear of the ground)
function myHand(){
  let h;
  if(FP){camera.getWorldDirection(G_DIR);h=[P.x+G_DIR.x*GRAB_ST.dist,P.y+GRAB_CHEST+G_DIR.y*GRAB_ST.dist,P.z+G_DIR.z*GRAB_ST.dist]}
  else{const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),up=clamp((0.32-P.pitch)*1.6,-0.75,0.8);
    h=[P.x+fx*GRAB_ST.dist-fz*GRAB_SIDE,P.y+GRAB_CARRY+up,P.z+fz*GRAB_ST.dist+fx*GRAB_SIDE]}
  h[1]=Math.max(h[1],groundAt(h[0],h[2])+0.3);return h;
}
/* how far the thing you're holding has fallen behind your hands (m, flat): 0 when it keeps up */
function grabLag(t){if(!t)return 0;const h=myHand();return Math.hypot(h[0]-t.x,h[2]-t.z)}
/* what R takes: what the crosshair's on, unless that's someone on their feet and there's loot or a knocked-out friend
   right in front of you (the crosshair in third person easily runs on past a body on the ground to whoever's behind) */
function pickGrab(){
  const a=aimTarget(tuneOr('env.grabReach',SIM.GRAB.REACH)),n=nearGrab(3.2);
  if(a&&n&&a!==n&&(a.isCrew||a.standing)&&!(n.isCrew||n.standing))return n;
  return a||n;
}
/* the nearest thing you could grab in front of you, for when the crosshair isn't quite on it */
function nearGrab(r){
  const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);let best=null,bd=r;
  const test=t=>{const dx=t.x-P.x,dz=t.z-P.z,d=Math.hypot(dx,dz)+(t.isCrew?0.8:t.standing?0.5:0);if(d<bd&&(dx*fx+dz*fz)/(d||1)>0.35){bd=d;best=t}};   // loot and knocked-out friends before people on their feet
  for(const pr of PROPS.values())if(pr.cartId==null)test(pr);
  for(const rid of remotes.keys()){const t=targetOf(-rid);if(t)test(t)}
  if(S.tent==null&&!S.inTown)bots.forEach((b,k)=>{const t=targetOf(CREW_GRAB_ID-k);if(t)test(t)});
  return best;
}
function ropeHand(){return[P.x,P.y+1.0,P.z]}

/* ---- grab / let go / throw ---- */
function grabTarget(t){
  if(!t||S.ko||uiOpen()||inTent())return false;
  if(t.cartId!=null)t.cartId=null;   // taking it back out of the wheelbarrow (the server hears it from pgrab)
  GRAB_ST.id=t.id;if(t.id>=0)S.carry=t.id;digHeld=false;
  const h=t.isBody||t.isCrew?0.4:physOf(t).h/2;
  const rad=t.isBody||t.isCrew?0.5:physOf(t).r;GRAB_ST.dist=FP?clamp(Math.hypot(t.x-P.x,t.y+h-(P.y+1.05),t.z-P.z),1.3,t.isBody||t.isCrew?2.0:2.6):clamp(0.75+rad,1.1,2.0);   // first person: at arm's length (a person closer still)   // just in front of you; scroll to change
  t.grabT=performance.now();
  if(isCart(t)&&t.tip){t.tip=false;t.rest=false;toast('You set the wheelbarrow back on its wheel.','',2000)}
  if(t.isCrew){t.grab=[myId()];crewGrabbed(t.b,true)}
  else if(online())wsSend({t:'pgrab',id:t.id});else{t.owner=myId();t.grab=[myId()]}
  logEv('propGrab',{item:t.id,type:t.isCrew?'crew':t.isBody?(t.standing?'friend':'body'):t.type});
  const crew=1+(t.grab||[]).filter(g=>g!==myId()).length,lift=tuneGrab('fmax')*crew/9.82;
  if(massOf(t)>lift)toast(crew>1?`Still too heavy for ${crew} of you (${massOf(t)} kg). Drag it, or get another pair of hands on it.`:`Too heavy to lift alone (${massOf(t)} kg). Drag it (slowly), or get a friend to grab it too.`,'',4500);
  else if(crew>1)toast(`${crew} of you on it: you can lift it.`,'good',2500);
  else if(!grabTarget.told){grabTarget.told=true;toast('Got it. Walk to carry it. Look down / up to lower or raise it, scroll for closer / farther, click to throw, let go of R to set it down.','',6500)}
  return true;
}
function releaseGrab(throwIt,silent){
  const id=GRAB_ST.id;if(id==null)return;GRAB_ST.id=null;if(S.carry===id)S.carry=null;
  const t=targetOf(id);
  camera.getWorldDirection(G_DIR);const d=[+G_DIR.x.toFixed(3),+G_DIR.y.toFixed(3),+G_DIR.z.toFixed(3)];
  if(t&&t.isCrew){t.grab=[];crewGrabbed(t.b,false,throwIt?d:null)}
  else if(t&&!t.isBody&&iOwn(t)){t.hands.delete(myId());if(throwIt)yeetThing(t,d,1+t.grab.filter(g=>g!==myId()).length)}
  if(!silent&&!(t&&t.isCrew)){if(online())wsSend({t:throwIt?'pyeet':'prel',id,d});else if(t)t.grab=[]}
  if(throwIt){sfx.shout();logEv('propThrow',{item:id})}
}
function yeetThing(t,d,n){
  const m=massOf(t),k=Math.min(1,(tuneGrab('fmax')*n/9.82)/m),th=SIM.GRAB.THROW*tune('grab.throw');   // heavy things barely leave your hands
  const dvx=d[0]*th*k,dvy=(d[1]*th+2.5)*k,dvz=d[2]*th*k;
  t.vx+=dvx;t.vy+=dvy;t.vz+=dvz;t.rest=false;t.restT=0;
  if(isRigid(t))rigidKick(t,dvx,dvy,dvz);   // loot with a shape also tumbles (84-rigid.js)
}
/* ---- the rope ---- */
function tieRope(){
  if(ROPE_ST.id!=null){untieRope(true);return}
  const t=aimTarget(3.2);if(!t){toast('Aim at loot, the wheelbarrow or a downed friend (within 3 m) to tie your rope to it.','',2600);return}
  if(t.id===GRAB_ST.id)releaseGrab(false);
  ROPE_ST.id=t.id;ROPE_ST.taut=false;
  if(online())wsSend({t:'pgrab',id:t.id,rope:true});else{t.owner=myId();t.ropes=[myId()]}
  countUp('ropes',10,'knots');sfx.clank();toast(`Rope tied to the ${tName(t)}. Walk away and it pulls once it's taut. X to untie.`,'',3500);logEv('ropeTie',{item:t.id});
}
function untieRope(say){
  const id=ROPE_ST.id;if(id==null)return;ROPE_ST.id=null;ROPE_ST.taut=false;
  const t=targetOf(id);if(t&&!t.isBody&&iOwn(t)){t.hands.delete('r'+myId())}
  if(online())wsSend({t:'prel',id,rope:true});else if(t)t.ropes=[];
  if(say)toast('Rope untied.','',1500);
}

/* ---- the physics, run by whoever owns the thing ---- */
function stepThing(t,dt){
  const m=massOf(t),K=SIM.GRAB.K,D=SIM.GRAB.DAMP,FM=tuneGrab('fmax'),cart=isCart(t),h=t.ph.h/2;
  let fx=0,fy=-9.82*m,fz=0,held=0,ropeUp=0,ropeCap=0,handCap=0;
  const now=performance.now();
  for(const[key,H]of t.hands){
    const self=key===myId()||key==='r'+myId();
    if(!self&&now-H.t>600){t.hands.delete(key);continue}   // a friend's hand we stopped hearing about
    const dx=H.h[0]-t.x,dy=H.h[1]-(t.y+h),dz=H.h[2]-t.z,dl=Math.hypot(dx,dy,dz)||1e-3;
    if(H.rope){
      if(dl>SIM.ROPE.MAX*1.15){t.hands.delete(key);ropeGone(t,key);continue}
      if(dl<=SIM.ROPE.L)continue;   // slack
      const f=Math.min(FM,SIM.ROPE.K*(dl-SIM.ROPE.L)),vr=(t.vx*dx+t.vy*dy+t.vz*dz)/dl,fd=f-Math.max(0,vr)*D*0.3;
      fx+=dx/dl*fd;fy+=dy/dl*fd;fz+=dz/dl*fd;held++;ropeCap+=FM;ropeUp+=dy/dl;
      continue;
    }
    if(gripGone(t,key,dl,dt)){t.hands.delete(key);if(self){releaseGrab(false);toast('It slipped out of your hands. Too far, or too heavy.','bad',2500)}continue}
    let gx=dx*K-t.vx*D,gy=dy*K-t.vy*D,gz=dz*K-t.vz*D;const gm=Math.hypot(gx,gy,gz);if(gm>FM){gx*=FM/gm;gy*=FM/gm;gz*=FM/gm}
    fx+=gx;fy+=gy;fz+=gz;held++;handCap+=FM;
  }
  // THE ROPE SLIPS: hauling something heavy up out of a hole with too few people on it
  if(ropeCap&&ropeUp>0.5&&!cart){const inHole=baseH(t.x,t.z)-t.y>0.9;
    if(inHole&&ropeCap+handCap<m*9.82*1.15&&Math.random()<dt*0.45){for(const k of [...t.hands.keys()])if(t.hands.get(k).rope)t.hands.delete(k);t.vy=-1.5;ropeSlip(t);return}}
  if(cart&&!t.tip)fy=Math.min(fy,0);   // a wheelbarrow rolls; you can't lift it off its wheel
  const lin=held?0.35:0.05;
  t.vx+=fx/m*dt;t.vy+=fy/m*dt;t.vz+=fz/m*dt;
  t.vx*=1-lin*dt;t.vy*=1-lin*dt;t.vz*=1-lin*dt;
  let nx=t.x+t.vx*dt,nz=t.z+t.vz*dt;
  nx=clamp(nx,-EDGE+1,EDGE-1);nz=clamp(nz,-EDGE+1,EDGE-1);
  const R=t.ph.r*0.8;
  if(!t.body)for(const c of colliders){if(nx>c.x0-R&&nx<c.x1+R&&nz>c.z0-R&&nz<c.z1+R){const px=Math.min(nx-(c.x0-R),(c.x1+R)-nx),pz=Math.min(nz-(c.z0-R),(c.z1+R)-nz);
    if(px<pz){nx=nx<(c.x0+c.x1)/2?c.x0-R:c.x1+R;t.vx*=-0.2}else{nz=nz<(c.z0+c.z1)/2?c.z0-R:c.z1+R;t.vz*=-0.2}}}
  // the wheelbarrow tips over on a bump or a hole edge taken too fast
  if(cart&&held){const sp=Math.hypot(t.vx,t.vz),cap=(KEYS['shift']&&GRAB_ST.id===t.id?tune('move.sprint'):tune('move.walk'))*1.1;if(sp>cap){t.vx*=cap/sp;t.vz*=cap/sp}}   // a wheelbarrow goes as fast as you push it, no faster (grabbing it used to yank it into a tip)
  if(cart&&!t.tip&&now-(t.grabT||0)>800){const sp=Math.hypot(t.vx,t.vz);if(sp>SIM.CART.TIP_SPEED*tune('grab.cartTip')){const ax=t.x+t.vx/sp*0.6,az=t.z+t.vz/sp*0.6;
    if(Math.abs(groundAt(ax,az)-groundAt(t.x,t.z))>SIM.CART.TIP_STEP)cartTip(t)}}
  t.x=nx;t.z=nz;t.y+=t.vy*dt;
  const g=groundAt(t.x,t.z);
  if(t.y<=g){
    const imp=-t.vy;t.y=g;t.vy=imp>1.2?imp*0.18:0;
    if(!t.body&&t.v0&&!held&&imp>SIM.DMG.MIN&&now-t.hitT>SIM.DMG.COOL*1000&&t.val>0){
      t.hitT=now;const loss=Math.min(t.val,Math.max(1,Math.round(t.v0*t.ph.frag*(imp-SIM.DMG.MIN)*SIM.DMG.RATE*tune('grab.fragile'))));
      t.val-=loss;propHit(t,loss);
    }
    // ground friction: rolling for the wheelbarrow, sliding for everything else, less while someone's taking weight
    const mu=cart?(t.tip?1.2:0.08):0.45,lift=clamp(fy/(9.82*m)+1,0,1),fr=mu*9.82*(1-lift)*dt,hs=Math.hypot(t.vx,t.vz);
    if(hs>0){const k=Math.max(0,hs-fr)/hs;t.vx*=k;t.vz*=k}
  }
  if(cart&&Math.hypot(t.vx,t.vz)>0.3)t.yaw=Math.atan2(t.vx,t.vz);
  const moving=Math.hypot(t.vx,t.vy,t.vz)>0.08||held;
  t.restT=moving?0:t.restT+dt;
  const wasRest=t.rest;t.rest=!held&&t.restT>0.6;
  if(t.body)return;   // a body's position goes out with the downed camper's own 'pos'
  if(online()&&((t.rest&&!wasRest)||(!t.rest&&now-(t.sentT||0)>100))){t.sentT=now;   // the settling update always goes out
    wsSend({t:'pst',id:t.id,x:+t.x.toFixed(2),y:+t.y.toFixed(2),z:+t.z.toFixed(2),vx:+t.vx.toFixed(2),vy:+t.vy.toFixed(2),vz:+t.vz.toFixed(2),val:t.val,rest:t.rest,tip:!!t.tip})}
  if(!online()&&Math.hypot(t.x-SIM.SELL.x,t.z-SIM.SELL.z)<SIM.SELL.r){
    if(cart){for(const l of [...(t.load||[])]){const q=PROPS.get(l);if(q){const v=q.val;propSold(l,v,[myId()])}}t.load=[]}
    else{const v=t.val;propSold(t.id,v,[myId()])}
  }
}
/* a grip only gives when the thing has been out of reach (stuck on something, or yanked away) for a moment, not the
   instant it swings past arm's length */
function gripGone(t,key,dl,dt){const F=t.farT||(t.farT={});if(dl<=SIM.GRAB.SNAP){F[key]=0;return false}F[key]=(F[key]||0)+dt;if(F[key]<0.8)return false;F[key]=0;return true}
function propHit(pr,loss){
  sfx.thud();noise(0.25,260,0.8,0.3,'lowpass');
  if(pr.L)say(pr.L,`-${loss}`,1400);countUp('butter',50,'butter',loss);
  if(online())wsSend({t:'pst',id:pr.id,x:+pr.x.toFixed(2),y:+pr.y.toFixed(2),z:+pr.z.toFixed(2),vx:0,vy:0,vz:0,val:pr.val,rest:false});
  logEv('propDmg',{item:pr.id,loss,val:pr.val});
}
function ropeGone(t,key){if(key==='r'+myId()){ROPE_ST.id=null;toast('The rope pulled out of your hands.','bad',2500)}}
function ropeSlip(t){
  noise(0.4,300,1,0.3);sfx.thud();toast('THE ROPE SLIPPED! Too heavy for that few hands.','bad',3500);logEv('ropeSlip',{item:t.id});
  if(online())wsSend({t:'pslip',id:t.id});else{t.ropes=[];ROPE_ST.id=null}
}
function cartTip(t){
  t.tip=true;sfx.thud();noise(0.5,200,0.7,0.35,'lowpass');toast('The wheelbarrow tipped over! Everything spilled.','bad',3000);logEv('cartTip',{n:(t.load||[]).length});
  if(online())wsSend({t:'ptip',id:t.id});
  else{for(const l of t.load||[]){const q=PROPS.get(l);if(q){const a=Math.random()*6.28;q.cartId=null;q.x=t.x+Math.cos(a)*1.6;q.z=t.z+Math.sin(a)*1.6;q.y=groundAt(q.x,q.z)+0.3;q.rest=false}}t.load=[]}
}

/* ---- the wheelbarrow: F while holding something next to it ---- */
function cartNear(){for(const pr of PROPS.values())if(isCart(pr)&&!pr.tip&&Math.hypot(pr.x-P.x,pr.z-P.z)<3.5)return pr;return null}
function loadIntoCart(){
  const cart=cartNear(),id=GRAB_ST.id;if(!cart||id==null||id===cart.id)return;
  if((cart.load||[]).length>=SIM.CART.CAP){toast('The wheelbarrow is full (3 things).','bad',2000);return}
  const t=targetOf(id);releaseGrab(false,true);
  if(online())wsSend({t:'pload',id,cart:cart.id});
  else if(t&&!t.isBody){cart.load=[...(cart.load||[]),id];t.cartId=cart.id;t.grab=[]}
  sfx.clank();toast(`In the wheelbarrow: ${tName(t||{type:'safe'})}. Grab the wheelbarrow (R) and push.`,'good',3000);
}

/* a heard orientation (loot with a shape, 84-rigid.js): the one we ease towards, and where we'd start from if we took over */
function propQ(pr,a){const q=new T.Quaternion(+a[0]||0,+a[1]||0,+a[2]||0,+a[3]||1).normalize();pr.qNet=q;(pr.q||(pr.q=new T.Quaternion())).copy(q)}
/* ---- network ---- */
function grabMsg(m){
  const id=num(m.id,-1e9,1e5,-1e9)|0;
  if(id<0){   // bodies
    if(-id===myId()){   // somebody's got hold of me
      if(m.t==='pown'){const was=MYBODY.grab.length+MYBODY.ropes.length;MYBODY.grab=Array.isArray(m.grab)?m.grab:[];MYBODY.ropes=Array.isArray(m.ropes)?m.ropes:[];
        if(!S.ko&&MYBODY.grab.length+MYBODY.ropes.length>was){const R=remotes.get([...MYBODY.grab,...MYBODY.ropes].slice(-1)[0]);toast(`${R?R.name:'Someone'} grabbed you! Mash Space to wriggle free.`,'',3500)}
        for(const k of [...MYBODY.hands.keys()]){const pid=typeof k==='string'?+k.slice(1):k;if(!(typeof k==='string'?MYBODY.ropes:MYBODY.grab).includes(pid))MYBODY.hands.delete(k)}}
      else if(m.t==='phand'&&Array.isArray(m.h))MYBODY.hands.set(m.rope?'r'+m.pid:m.pid,{h:m.h.map(v=>+v||0),t:performance.now(),rope:!!m.rope});
      else if(m.t==='pyeet'){MYBODY.hands.delete(m.pid);yeetThing(MYBODY,Array.isArray(m.d)?m.d:[0,0,0],1+MYBODY.grab.length);if(!S.ko){P.vy=Math.max(P.vy,MYBODY.vy);P.grounded=false;MYBODY.fly=0.6}}   // thrown on your feet: you fly a bit
      return;
    }
    const b=targetOf(id);if(!b)return;
    if(m.t==='pown'){b.grab=Array.isArray(m.grab)?m.grab:[];b.ropes=Array.isArray(m.ropes)?m.ropes:[];
      if(GRAB_ST.id===id&&!b.grab.includes(myId()))releaseGrab(false,true);if(ROPE_ST.id===id&&!b.ropes.includes(myId()))ROPE_ST.id=null}
    return;
  }
  const pr=PROPS.get(id);if(!pr)return;physOf(pr);
  if(m.t==='pown'){pr.owner=m.owner;pr.grab=Array.isArray(m.grab)?m.grab.slice(0,8):[];pr.ropes=Array.isArray(m.ropes)?m.ropes.slice(0,8):[];
    for(const k of [...pr.hands.keys()]){const rope=typeof k==='string',pid=rope?+k.slice(1):k;if(!(rope?pr.ropes:pr.grab).includes(pid))pr.hands.delete(k)}
    if(GRAB_ST.id===pr.id&&!pr.grab.includes(myId()))releaseGrab(false,true);
    if(ROPE_ST.id===pr.id&&!pr.ropes.includes(myId())){ROPE_ST.id=null}}
  else if(m.t==='pst'){
    if(iOwn(pr))return;
    pr.x=num(m.x,-600,600,pr.x);pr.y=num(m.y,-10,60,pr.y);pr.z=num(m.z,-600,600,pr.z);pr.vx=num(m.vx,-40,40,0);pr.vy=num(m.vy,-40,40,0);pr.vz=num(m.vz,-40,40,0);
    const v=num(m.val,0,1e4,pr.val)|0;if(v<pr.val){const loss=pr.val-v;pr.val=v;if(pr.L)say(pr.L,`-${loss}`,1400);sfx.thud()}
    pr.rest=m.rest===true;pr.tip=m.tip===true;if(m.owner!==undefined)pr.owner=m.owner;if(Array.isArray(m.q))propQ(pr,m.q);if(Array.isArray(m.grab))pr.grab=m.grab.slice(0,8);if(Array.isArray(m.ropes))pr.ropes=m.ropes.slice(0,8);pr.netT=performance.now();
  }
  else if(m.t==='phand'){if(iOwn(pr)&&Array.isArray(m.h))pr.hands.set(m.rope?'r'+m.pid:m.pid,{h:m.h.map(v=>+v||0),t:performance.now(),rope:!!m.rope})}
  else if(m.t==='pyeet'){if(iOwn(pr)){pr.hands.delete(m.pid);yeetThing(pr,Array.isArray(m.d)?m.d:[0,0,0],1+pr.grab.length)}}
  else if(m.t==='pslip'){pr.ropes=[];for(const k of [...pr.hands.keys()])if(typeof k==='string')pr.hands.delete(k);if(ROPE_ST.id===pr.id){ROPE_ST.id=null;if(!iOwn(pr))toast('THE ROPE SLIPPED!','bad',2500)}}
  else if(m.t==='pcart'){
    pr.load=Array.isArray(m.load)?m.load.slice(0,SIM.CART.CAP):[];if(m.tip!==undefined)pr.tip=!!m.tip;
    for(const q of PROPS.values())if(q.cartId===pr.id&&!pr.load.includes(q.id))q.cartId=null;
    for(const l of pr.load)if(l>=0){const q=PROPS.get(l);if(q)q.cartId=pr.id}
    S.inCart=pr.load.includes(-myId())?pr.id:(S.inCart===pr.id?null:S.inCart);
    if(Array.isArray(m.spill))for(const s of m.spill){const sid=s[0]|0,x=num(s[1],-600,600,0),z=num(s[2],-600,600,0);
      if(sid>=0){const q=PROPS.get(sid);if(q){physOf(q);q.x=x;q.z=z;q.y=groundAt(x,z)+0.3;q.rest=false;q.cartId=null}}
      else if(-sid===myId()){P.x=x;P.z=z;P.y=groundAt(x,z);S.inCart=null;   // thrown out of it: it costs you some of your knockout time
        if(S.ko){S.ko=Math.max(1,S.ko-tune('cart.spillKo'));sfx.thud();hurtFx=1;toast('You got tipped out of the wheelbarrow! That hurt.','bad',3000)}}}
    if(m.tip&&!iOwn(pr))toast('The wheelbarrow tipped over!','bad',2500);
  }
}

/* ---- on my feet with someone's hands on me: they pull me along (two of them can lift me); mash Space to get free ---- */
let wrigN=0,wrigT=0,wrigSpace=false;
function stepMeHeld(dt){
  const now=performance.now();
  for(const[k,H]of MYBODY.hands)if(now-H.t>600)MYBODY.hands.delete(k);
  const B=MYBODY;
  if(B.fly>0){B.fly-=dt;P.x+=B.vx*dt;P.z+=B.vz*dt;B.vx*=1-1.5*dt;B.vz*=1-1.5*dt}   // thrown
  if(S.ko||!B.hands.size){wrigN=0;return}
  const K=SIM.GRAB.K,D=SIM.GRAB.DAMP,FM=tuneGrab('fmax'),m=70,cy=P.y+0.9;let fx=0,fy=0,fz=0;
  for(const H of B.hands.values()){const dx=H.h[0]-P.x,dy=H.h[1]-cy,dz=H.h[2]-P.z,dl=Math.hypot(dx,dy,dz)||1e-3;
    if(H.rope){if(dl<=SIM.ROPE.L)continue;const f=Math.min(FM,SIM.ROPE.K*(dl-SIM.ROPE.L));fx+=dx/dl*f;fy+=dy/dl*f;fz+=dz/dl*f;continue}
    let gx=dx*K-B.vx*D,gy=dy*K-P.vy*D,gz=dz*K-B.vz*D;const gm=Math.hypot(gx,gy,gz);if(gm>FM){gx*=FM/gm;gy*=FM/gm;gz*=FM/gm}fx+=gx;fy+=gy;fz+=gz}
  B.vx+=fx/m*dt;B.vz+=fz/m*dt;const fr=P.grounded?6:1.2;B.vx*=1-Math.min(1,fr*dt);B.vz*=1-Math.min(1,fr*dt);   // your feet drag on the ground
  let nx=clamp(P.x+B.vx*dt,-EDGE+2,EDGE-2),nz=clamp(P.z+B.vz*dt,-EDGE+2,EDGE-2);
  for(const c of colliders)if(nx>c.x0-0.3&&nx<c.x1+0.3&&nz>c.z0-0.3&&nz<c.z1+0.3){nx=P.x;nz=P.z;B.vx=B.vz=0;break}
  P.x=nx;P.z=nz;
  if(fy>0){P.vy+=fy/m*dt;if(P.vy>0.2)P.grounded=false}   // gravity's in updatePlayer: one pair of hands can't lift you, two can
  // wriggle free: three taps of Space in two seconds
  const sp=!!KEYS[' '];if(sp&&!wrigSpace){if(now-wrigT>2000)wrigN=0;wrigT=now;if(++wrigN>=3){wrigN=0;B.hands.clear();wsSend({t:'pfree'});toast('You wriggled free.','good',1800);logEv('wriggle',{})}}wrigSpace=sp;
}

/* ---- my body, while I'm downed (called from downed() in 84-coop.js): true = someone else is moving me ---- */
function bodyHeld(){return S.ko>0&&(MYBODY.hands.size>0||S.inCart!=null)}
function stepMyBody(dt){
  if(S.inCart!=null){const c=PROPS.get(S.inCart);if(!c){S.inCart=null;return false}P.x=c.x;P.z=c.z;P.y=groundAt(c.x,c.z)+0.55;
    if(atHome(P.x,P.z)){carriedHome();}return true}
  if(!MYBODY.hands.size){MYBODY.x=P.x;MYBODY.y=P.y;MYBODY.z=P.z;MYBODY.vx=MYBODY.vy=MYBODY.vz=0;return false}
  const B=MYBODY;B.x=P.x;B.y=P.y;B.z=P.z;
  const sub=Math.max(1,Math.ceil(dt/(1/60)));for(let i=0;i<sub;i++)stepThing(B,dt/sub);
  P.x=B.x;P.y=B.y;P.z=B.z;
  if(atHome(P.x,P.z))carriedHome();
  return true;
}
/* home, for a downed friend being carried: inside the camp fence on the lake, or the campfire on any other map
   (88-zones.js ZONE.fire). JT: the campfire counts as home off the lake. */
function atHome(x,z){
  if(inCamp(x,z))return true;
  const f=typeof ZONE!=='undefined'&&ZONE_H&&ZONE.fire;return!!(f&&Math.hypot(x-f.x,z-f.z)<f.r*tune('zone.fireR'));
}
function carriedHome(){
  if(!S.ko)return;
  const by=[...new Set([...MYBODY.grab,...MYBODY.ropes])].map(pid=>{const R=remotes.get(pid);return R?R.name:null}).filter(Boolean)[0]||'Your crew';
  const carriers=[...new Set([...MYBODY.grab,...MYBODY.ropes])];wsSend({t:'carried',who:carriers});
  MYBODY.hands.clear();S.inCart=null;revived(by);S.justUp=true;logEv('carriedHome',{by});toast(`${by} got you back ${inCamp(P.x,P.z)?'inside the fence':'to the campfire'}. You're up.`,'good',3500);
}

/* ---- beams and ropes: everyone can see who's holding what ---- */
const grabBeamMat=new T.LineBasicMaterial({color:0xfff2a8,transparent:true,opacity:0.8}),ropeMat=new T.LineBasicMaterial({color:0x8a6a3a});
const grabBeams=[],ropeLines=[];
function grabBeamLine(i){let l=grabBeams[i];if(!l){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(6),3));l=new T.Line(g,grabBeamMat);l.frustumCulled=false;scene.add(l);grabBeams[i]=l}return l}
const ROPE_SEG=12;
function ropeLine(i){let l=ropeLines[i];if(!l){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array((ROPE_SEG+1)*3),3));l=new T.Line(g,ropeMat);l.frustumCulled=false;scene.add(l);ropeLines[i]=l}return l}
function drawRope(i,ax,ay,az,bx,by,bz){
  const l=ropeLine(i),a=l.geometry.attributes.position,d=Math.hypot(bx-ax,by-ay,bz-az),sag=Math.max(0,SIM.ROPE.L-d)*0.35+0.05;
  for(let k=0;k<=ROPE_SEG;k++){const u=k/ROPE_SEG;a.setXYZ(k,ax+(bx-ax)*u,ay+(by-ay)*u-Math.sin(u*Math.PI)*sag,az+(bz-az)*u)}
  a.needsUpdate=true;l.visible=true;
}
function holderPos(pid){if(pid===myId())return[P.x,P.y,P.z];const R=remotes.get(pid);if(!R)return null;const p=R.p.g.position;return[p.x,p.y,p.z]}

/* ---- every frame ---- */
function updateGrab(dt){
  if(!S.started)return;
  if(!S.ko&&S.inCart!=null)S.inCart=null;   // back on my feet
  stepMeHeld(dt);
  // input: hold R / right mouse to grab what you're aiming at; let go to drop
  const want=(KEYS['r']||grabMouse)&&!S.ko&&!uiOpen()&&!inTent();
  if(want&&GRAB_ST.id==null&&!grabHeldBefore){const t=pickGrab();if(t)grabTarget(t);else toast('Nothing to grab here. Aim at loot, the wheelbarrow or a knocked-out friend and hold R.','',2200)}
  grabHeldBefore=want;
  if(!want&&GRAB_ST.id!=null&&!grabByUse)releaseGrab(false);
  const gt=targetOf(GRAB_ST.id);
  if(GRAB_ST.id!=null&&(!gt||S.ko||(GRAB_ST.id>=0&&S.carry!==GRAB_ST.id)))releaseGrab(false);   // let go from the inventory, knocked out, sold, friend got up...
  if(GRAB_ST.id==null)grabByUse=false;
  if(ROPE_ST.id!=null&&(S.ko||!targetOf(ROPE_ST.id)))untieRope(false);
  // my hands and my rope
  if(GRAB_ST.id!=null){
    const t=targetOf(GRAB_ST.id),h=myHand();
    if(t.isCrew)t.b.handAt=h;
    else if(!t.isBody&&iOwn(t))t.hands.set(myId(),{h,t:performance.now()});
    else if((GRAB_ST.handT-=dt)<=0){GRAB_ST.handT=0.1;wsSend({t:'phand',id:t.id,h:h.map(v=>+v.toFixed(2))})}
    if((t.isBody||t.isCrew)&&P.moving)drainStam(tune('stam.carry')*dt);
  }
  if(ROPE_ST.id!=null){
    const t=targetOf(ROPE_ST.id),h=ropeHand(),d=Math.hypot(t.x-P.x,t.z-P.z);
    ROPE_ST.taut=d>SIM.ROPE.L;
    if(d>SIM.ROPE.MAX){const k=SIM.ROPE.MAX/d;P.x=t.x+(P.x-t.x)*k;P.z=t.z+(P.z-t.z)*k}   // the rope's full length: you can't walk any farther than that
    if(!t.isBody&&iOwn(t))t.hands.set('r'+myId(),{h,t:performance.now(),rope:true});
    else if((ROPE_ST.handT-=dt)<=0){ROPE_ST.handT=0.1;wsSend({t:'phand',id:t.id,h:h.map(v=>+v.toFixed(2)),rope:true})}
    if(ROPE_ST.taut&&P.moving){drainStam(tune('stam.rope')*dt);if(S.stam<=0&&!GOD){untieRope(false);toast('Too tired to hold the rope. It slipped out of your hands.','bad',2500)}}
  }
  // physics for what I own, smoothing for the rest
  const sub=Math.max(1,Math.ceil(dt/(1/60))),sdt=dt/sub;
  let bi=0,ri=0;
  for(const pr of [...PROPS.values()]){
    const ph=physOf(pr);
    if(pr.cartId!=null){const c=PROPS.get(pr.cartId);if(c){const slot=c.load.indexOf(pr.id),a=(c.yaw||0);pr.x=c.x+Math.sin(a+1.6)*(slot-1)*0.3;pr.z=c.z+Math.cos(a+1.6)*(slot-1)*0.3;pr.y=c.y+0.45+slot*0.05;pr.vx=pr.vy=pr.vz=0;pr.rest=true;
      pr.g.position.set(pr.x,pr.y,pr.z);pr.g.rotation.set(0,a,0);if(pr.q){pr.q.copy(pr.g.quaternion);pr.qNet=null;pr.rp=null}continue}else pr.cartId=null}   // riding upright; its shape rebuilds once it's out
    const rig=isRigid(pr);if(rig&&!iOwn(pr))pr.rOwn=false;
    if(iOwn(pr)&&(!pr.rest||pr.hands.size))for(let i=0;i<sub&&PROPS.has(pr.id);i++)(rig?stepRigid:stepThing)(pr,sdt);
    if(!PROPS.has(pr.id))continue;
    let tx=pr.x,ty=pr.y,tz=pr.z;
    if(!iOwn(pr)&&!pr.rest&&pr.netT){const a=Math.min(0.15,(performance.now()-pr.netT)/1000);tx+=pr.vx*a;tz+=pr.vz*a;ty=rig?ty+pr.vy*a:Math.max(groundAt(tx,tz),ty+pr.vy*a)}   // (a tipped-over thing's y sits below the ground by design: 84-rigid.js)
    const g=pr.g,k=iOwn(pr)?1:Math.min(1,dt*12);
    if(rig)rigidDraw(pr,tx,ty,tz,k);   // turned and tipped as its shape says (84-rigid.js)
    else{g.position.x+=(tx-g.position.x)*k;g.position.z+=(tz-g.position.z)*k;g.position.y+=(ty-g.position.y)*k}
    if(isCart(pr)){if(!iOwn(pr)&&Math.hypot(pr.vx,pr.vz)>0.3)pr.yaw=Math.atan2(pr.vx,pr.vz);g.rotation.y+=(((pr.yaw||0)-g.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*6);g.rotation.z+=((pr.tip?1.35:0)-g.rotation.z)*Math.min(1,dt*8)}
    else if(!rig){const tilt=pr.rest?0:clamp(Math.hypot(pr.vx,pr.vz)*0.05,0,0.25);g.rotation.z+=(Math.sin(performance.now()/260+pr.id)*tilt-g.rotation.z)*Math.min(1,dt*6)}
    if(pr.L){const txt=isCart(pr)?`Wheelbarrow${pr.load.length?` · ${pr.load.length}/3`:''}${pr.tip?' · tipped over':''}`:`${LOOT[pr.type].name} · ${pr.val} gold`;if(pr.shownTxt!==txt){pr.shownTxt=txt;pr.L.n.textContent=txt}}
    const cy=rig?pr.y+rigBox(pr).hy:g.position.y+ph.h/2,cx=rig?pr.x:g.position.x,cz=rig?pr.z:g.position.z;   // beams and ropes go to its middle
    bi=drawHolders(pr,cx,cy,cz,bi);
    for(const pid of pr.ropes){const hp=holderPos(pid);if(hp)drawRope(ri++,hp[0],hp[1]+1.0,hp[2],cx,cy,cz)}
  }
  // bodies: beams and ropes to downed friends (and to me, while I'm down)
  for(const b of BODIES.values()){const t=targetOf(b.id);if(!t){BODIES.delete(b.pid);continue}
    bi=drawHolders(t,t.x,t.y+0.35,t.z,bi);for(const pid of t.ropes){const hp=holderPos(pid);if(hp)drawRope(ri++,hp[0],hp[1]+1.0,hp[2],t.x,t.y+0.35,t.z)}}
  {const t=GRAB_ST.id!=null&&GRAB_ST.id<=CREW_GRAB_ID?targetOf(GRAB_ST.id):null;if(t){const l=grabBeamLine(bi++),a=l.geometry.attributes.position;a.setXYZ(0,P.x,P.y+1.25,P.z);a.setXYZ(1,t.x,t.y+0.9,t.z);a.needsUpdate=true;l.visible=true}}   // a crew member in your hands
  if(S.ko){for(const pid of MYBODY.grab){const hp=holderPos(pid);if(hp){const l=grabBeamLine(bi++),a=l.geometry.attributes.position;a.setXYZ(0,hp[0],hp[1]+1.25,hp[2]);a.setXYZ(1,P.x,P.y+0.35,P.z);a.needsUpdate=true;l.visible=true}}
    for(const pid of MYBODY.ropes){const hp=holderPos(pid);if(hp)drawRope(ri++,hp[0],hp[1]+1.0,hp[2],P.x,P.y+0.35,P.z)}}
  for(let i=bi;i<grabBeams.length;i++)grabBeams[i].visible=false;
  for(let i=ri;i<ropeLines.length;i++)ropeLines[i].visible=false;
}
/* what R would grab right now, for the prompt (78-hud.js): the crosshair first, else the nearest thing in front of you */
function grabHint(){
  if(GRAB_ST.id!=null&&GRAB_ST.id<0&&!S.ko){const t=targetOf(GRAB_ST.id);return t?`Holding ${tName(t)}: let go to put them down · click: throw`:null}
  if(GRAB_ST.id!=null||S.ko||S.inTruck||inTent())return null;
  const t=pickGrab();if(!t)return null;
  if(t.isCrew)return`Grab ${t.b.d.n} (carry or throw them)`;
  if(t.isBody)return t.standing?`Grab ${tName(t)} (drag them; two of you can lift them)`:`Grab ${tName(t)} (knocked out): carry them inside the fence to wake them up`;
  if(isCart(t))return t.tip?'Grab the wheelbarrow and set it back up':'Grab the wheelbarrow and push it';
  const m=massOf(t),crew=1+(t.grab||[]).length,heavy=m>tuneGrab('fmax')*crew/9.82;
  return`Grab the ${tName(t)} (${t.val!=null?t.val:SIM.HEAVY[t.type]} gold, ${m} kg${heavy?(crew>1?`: too heavy even with ${crew} of you`:': too heavy to lift alone, drag it or get help'):''})`;
}
function drawHolders(t,x,y,z,bi){
  for(const pid of t.grab){
    if(pid===myId()&&GRAB_ST.id!==t.id)continue;
    const hp=holderPos(pid);if(!hp)continue;
    const l=grabBeamLine(bi++),a=l.geometry.attributes.position;a.setXYZ(0,hp[0],hp[1]+1.25,hp[2]);a.setXYZ(1,x,y,z);a.needsUpdate=true;l.visible=true;
  }
  return bi;
}
/* how fast you can walk while holding something (or pulling it on a rope): light things don't slow you, the safe alone crawls */
function grabSpeed(sp){
  let f=1;
  const g=targetOf(GRAB_ST.id);if(g){const n=Math.max(1,(g.grab||[]).length+(g.ropes||[]).length);f=Math.min(f,clamp(0.3+0.7*tuneGrab('fmax')*n/9.82/massOf(g),0.3,1));
    f*=clamp(1-(grabLag(g)-0.5)/1.3,0.08,1)}   // the leash: it's fallen behind your hands, so you lean into it and slow down (instead of it slipping out)
  const r=ROPE_ST.taut?targetOf(ROPE_ST.id):null;if(r&&!isCart(r)){const n=Math.max(1,(r.grab||[]).length+(r.ropes||[]).length);f=Math.min(f,clamp(0.25+0.75*tuneGrab('fmax')*n/9.82/massOf(r),0.25,1))}
  return sp*f;
}
let grabMouse=false,grabHeldBefore=false,grabByUse=false;
canvas.addEventListener('mousedown',e=>{if(e.button===2&&S.started&&!uiOpen())grabMouse=true;if(e.button===0&&GRAB_ST.id!=null){releaseGrab(true);digHeld=false}});
addEventListener('mouseup',e=>{if(e.button===2)grabMouse=false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(GRAB_ST.id==null)return;e.preventDefault();GRAB_ST.dist=clamp(GRAB_ST.dist-(e.deltaY>0?0.2:-0.2),FP?1.2:0.9,FP?3.6:2.8)},{passive:false});
/* F on a prop (touch screens, or anyone used to the old haul): toggles a grab */
function useProp(pr){if(GRAB_ST.id===pr.id){releaseGrab(false);return}if(grabTarget(pr))grabByUse=true}

command('prop',{usage:'prop [safe|strongbox|cart]',help:'Drop heavy loot [safe] (or bring the wheelbarrow) 3 m in front of you, to test grabbing (hold R).',
  run([a]){const type=(a||'safe').toLowerCase();
    const fx=Math.sin(P.fa),fz=Math.cos(P.fa),x=+(P.x+fx*3).toFixed(2),z=+(P.z+fz*3).toFixed(2);
    if(type==='cart'){const c=[...PROPS.values()].find(isCart);if(!c)throw new Error('No wheelbarrow in this camp.');physOf(c);
      if(online())wsSend({t:'pcall',x,z});else{c.x=x;c.z=z;c.y=groundAt(x,z);c.tip=false;c.rest=false}return'The wheelbarrow rolled up in front of you.'}
    if(!(type in SIM.HEAVY))throw new Error('Usage: prop safe | prop strongbox | prop cart');
    let id=9000+Math.floor(Math.random()*999);while(PROPS.has(id))id++;
    if(online())wsSend({t:'prop',item:id,type,x,z});else addProp(id,type,x,z);
    return`A ${LOOT[type].name} (${SIM.PHYS[type].m} kg) landed in front of you. Aim at it and hold R.`}});
