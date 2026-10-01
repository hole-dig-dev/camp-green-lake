'use strict';
/* public/js/84-grab.js -- R.E.P.O.-style grabbing, the rope, the wheelbarrow and carrying downed friends, after Greg's
   branch (claude/intense-change-1-test-2026-09-27-1829: phys.js and checkpoint 3), rebuilt for the lake's own ground.
     aim + hold R (or right mouse)   grab it: loot, the wheelbarrow, or a downed friend. It hangs from your hands on a spring
     scroll                          hold it closer / farther          click or E while holding   throw it
     X (aimed at something)          tie your rope to it; walk away and it pulls once it's taut. X again unties
     F next to the wheelbarrow       put what you're holding in it (up to 3 things: loot or a downed friend)
   One camper pulls at most GRAB.FMAX (700 N): ~71 kg is the most one of you can lift. The 60 kg strongbox lifts alone, the
   120 kg safe needs two (alone you drag it), a 70 kg body is just about liftable alone. A rope pulls like another pair of
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
function targetOf(id){
  if(id==null)return null;
  if(id>=0)return PROPS.get(id)||null;
  const R=remotes.get(-id);if(!R||!(R.f&2))return null;
  let b=BODIES.get(-id);if(!b){b={id,pid:-id,grab:[],ropes:[],isBody:true};BODIES.set(-id,b)}
  b.R=R;b.x=R.p.g.position.x;b.y=R.p.g.position.y;b.z=R.p.g.position.z;b.ph=MYBODY.ph;return b;
}
const tName=t=>t.isBody?(t.R?t.R.name:'your friend'):isCart(t)?'wheelbarrow':LOOT[t.type].name;
function massOf(t){if(t.isBody)return 70;const ph=physOf(t);if(!isCart(t))return ph.m;let m=ph.m;for(const l of t.load||[])m+=l<0?70:((SIM.PHYS[(PROPS.get(l)||{}).type]||{m:0}).m);return m}

/* ---- aiming: whatever your crosshair is on, within reach ---- */
function aimTarget(reach){
  camera.getWorldPosition(G_EYE);camera.getWorldDirection(G_DIR);
  let best=null,bd=1e9;
  const test=(t,cx,cy,cz,r)=>{if(Math.hypot(t.x-P.x,t.z-P.z)>reach)return;cx-=G_EYE.x;cy-=G_EYE.y;cz-=G_EYE.z;const d=cx*G_DIR.x+cy*G_DIR.y+cz*G_DIR.z;if(d<0)return;
    if(Math.hypot(cx-G_DIR.x*d,cy-G_DIR.y*d,cz-G_DIR.z*d)<r&&d<bd){bd=d;best=t}};
  for(const pr of PROPS.values()){const ph=physOf(pr);test(pr,pr.x,pr.y+ph.h/2,pr.z,ph.r+0.35)}
  for(const[rid,R]of remotes)if(R.f&2&&R.room===S.tent){const t=targetOf(-rid);if(t)test(t,t.x,t.y+0.35,t.z,0.8)}
  return best;
}
function myHand(){camera.getWorldDirection(G_DIR);return[P.x+G_DIR.x*GRAB_ST.dist,P.y+1.05+G_DIR.y*GRAB_ST.dist,P.z+G_DIR.z*GRAB_ST.dist]}
function ropeHand(){return[P.x,P.y+1.0,P.z]}

/* ---- grab / let go / throw ---- */
function grabTarget(t){
  if(!t||S.ko||uiOpen()||inTent())return false;
  if(t.cartId!=null)t.cartId=null;   // taking it back out of the wheelbarrow (the server hears it from pgrab)
  GRAB_ST.id=t.id;if(t.id>=0)S.carry=t.id;digHeld=false;
  const h=t.isBody?0.4:physOf(t).h/2;
  GRAB_ST.dist=clamp(Math.hypot(t.x-P.x,t.y+h-(P.y+1.05),t.z-P.z),2.2,3.6);
  if(isCart(t)&&t.tip){t.tip=false;t.rest=false;toast('You set the wheelbarrow back on its wheel.','',2000)}
  if(online())wsSend({t:'pgrab',id:t.id});else{t.owner=myId();t.grab=[myId()]}
  logEv('propGrab',{item:t.id,type:t.isBody?'body':t.type});
  if(!grabTarget.told){grabTarget.told=true;toast(massOf(t)>SIM.GRAB.FMAX/9.82?`Too heavy to lift alone (${massOf(t)} kg): drag it, or get a friend on it too. Scroll: closer / farther. Click: throw.`:'Got it. Scroll to hold it closer or farther, click to throw, let go of R to drop it.','',6000)}
  return true;
}
function releaseGrab(throwIt,silent){
  const id=GRAB_ST.id;if(id==null)return;GRAB_ST.id=null;if(S.carry===id)S.carry=null;
  const t=targetOf(id);
  camera.getWorldDirection(G_DIR);const d=[+G_DIR.x.toFixed(3),+G_DIR.y.toFixed(3),+G_DIR.z.toFixed(3)];
  if(t&&!t.isBody&&iOwn(t)){t.hands.delete(myId());if(throwIt)yeetThing(t,d,1+t.grab.filter(g=>g!==myId()).length)}
  if(!silent){if(online())wsSend({t:throwIt?'pyeet':'prel',id,d});else if(t)t.grab=[]}
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
    if(dl>SIM.GRAB.SNAP){t.hands.delete(key);if(self){releaseGrab(false);toast('It slipped out of your hands. Too far, or too heavy.','bad',2500)}continue}
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
  if(cart&&!t.tip){const sp=Math.hypot(t.vx,t.vz);if(sp>SIM.CART.TIP_SPEED*tune('grab.cartTip')){const ax=t.x+t.vx/sp*0.6,az=t.z+t.vz/sp*0.6;
    if(Math.abs(groundAt(ax,az)-groundAt(t.x,t.z))>SIM.CART.TIP_STEP)cartTip(t)}}
  t.x=nx;t.z=nz;t.y+=t.vy*dt;
  const g=groundAt(t.x,t.z);
  if(t.y<=g){
    const imp=-t.vy;t.y=g;t.vy=imp>1.2?imp*0.18:0;
    if(!t.body&&t.v0&&imp>SIM.DMG.MIN&&now-t.hitT>SIM.DMG.COOL*1000&&t.val>0){
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
      if(m.t==='pown'){MYBODY.grab=Array.isArray(m.grab)?m.grab:[];MYBODY.ropes=Array.isArray(m.ropes)?m.ropes:[];
        for(const k of [...MYBODY.hands.keys()]){const pid=typeof k==='string'?+k.slice(1):k;if(!(typeof k==='string'?MYBODY.ropes:MYBODY.grab).includes(pid))MYBODY.hands.delete(k)}}
      else if(m.t==='phand'&&Array.isArray(m.h)&&S.ko)MYBODY.hands.set(m.rope?'r'+m.pid:m.pid,{h:m.h.map(v=>+v||0),t:performance.now(),rope:!!m.rope});
      else if(m.t==='pyeet'&&S.ko){MYBODY.hands.delete(m.pid);yeetThing(MYBODY,Array.isArray(m.d)?m.d:[0,0,0],1+MYBODY.grab.length)}
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
  if(!S.ko&&(S.inCart!=null||MYBODY.hands.size)){S.inCart=null;MYBODY.hands.clear()}   // back on my feet
  // input: hold R / right mouse to grab what you're aiming at; let go to drop
  const want=(KEYS['r']||grabMouse)&&!S.ko&&!uiOpen()&&!inTent();
  if(want&&GRAB_ST.id==null&&!grabHeldBefore){const t=aimTarget(tuneOr('env.grabReach',SIM.GRAB.REACH));if(t)grabTarget(t)}
  grabHeldBefore=want;
  if(!want&&GRAB_ST.id!=null&&!grabByUse)releaseGrab(false);
  const gt=targetOf(GRAB_ST.id);
  if(GRAB_ST.id!=null&&(!gt||S.ko||(GRAB_ST.id>=0&&S.carry!==GRAB_ST.id)))releaseGrab(false);   // let go from the inventory, knocked out, sold, friend got up...
  if(GRAB_ST.id==null)grabByUse=false;
  if(ROPE_ST.id!=null&&(S.ko||!targetOf(ROPE_ST.id)))untieRope(false);
  // my hands and my rope
  if(GRAB_ST.id!=null){
    const t=targetOf(GRAB_ST.id),h=myHand();
    if(!t.isBody&&iOwn(t))t.hands.set(myId(),{h,t:performance.now()});
    else if((GRAB_ST.handT-=dt)<=0){GRAB_ST.handT=0.1;wsSend({t:'phand',id:t.id,h:h.map(v=>+v.toFixed(2))})}
    if(t.isBody&&P.moving)drainStam(tune('stam.carry')*dt);
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
  if(S.ko){for(const pid of MYBODY.grab){const hp=holderPos(pid);if(hp){const l=grabBeamLine(bi++),a=l.geometry.attributes.position;a.setXYZ(0,hp[0],hp[1]+1.25,hp[2]);a.setXYZ(1,P.x,P.y+0.35,P.z);a.needsUpdate=true;l.visible=true}}
    for(const pid of MYBODY.ropes){const hp=holderPos(pid);if(hp)drawRope(ri++,hp[0],hp[1]+1.0,hp[2],P.x,P.y+0.35,P.z)}}
  for(let i=bi;i<grabBeams.length;i++)grabBeams[i].visible=false;
  for(let i=ri;i<ropeLines.length;i++)ropeLines[i].visible=false;
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
  const g=targetOf(GRAB_ST.id);if(g){const n=Math.max(1,(g.grab||[]).length+(g.ropes||[]).length);f=Math.min(f,clamp(0.3+0.7*tuneGrab('fmax')*n/9.82/massOf(g),0.3,1))}
  const r=ROPE_ST.taut?targetOf(ROPE_ST.id):null;if(r&&!isCart(r)){const n=Math.max(1,(r.grab||[]).length+(r.ropes||[]).length);f=Math.min(f,clamp(0.25+0.75*tuneGrab('fmax')*n/9.82/massOf(r),0.25,1))}
  return sp*f;
}
let grabMouse=false,grabHeldBefore=false,grabByUse=false;
canvas.addEventListener('mousedown',e=>{if(e.button===2&&S.started&&!uiOpen())grabMouse=true;if(e.button===0&&GRAB_ST.id!=null){releaseGrab(true);digHeld=false}});
addEventListener('mouseup',e=>{if(e.button===2)grabMouse=false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(GRAB_ST.id==null)return;e.preventDefault();GRAB_ST.dist=clamp(GRAB_ST.dist-(e.deltaY>0?0.25:-0.25),1.4,4)},{passive:false});
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
