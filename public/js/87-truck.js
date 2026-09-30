'use strict';
/* public/js/87-truck.js -- Mr. Sir's pickup, drivable (JT, 2026-09-30) while the F2 flag "Make drivable" is on
   (Vehicles tab, veh.drivable; off by default).
   Four seats (JT): F at the left door to drive, F at the right door to ride shotgun, F at the back to sit on the edge
   of the dropped tailgate (two spots). F again to get out. Up front you're out of sight, "in the truck" (JT: no heads
   through the roof); on the tailgate you sit on the gate with your legs straight out past its end (SitEdge clip,
   blender/cgl_rig.py). Driving: W/S gas and brake/reverse, A/D steer, Space handbrake.
   With the flag on it waits just inside the service gate, nose into camp (JT: "back out of the service gate"): back it
   out through the gate, swing round outside and drive off. Once it's out through the gate and ESCAPE_R away, that's
   the escape: the whole crew moves on to the next map, the same as everyone reaching the campfire (server.js 'truck',
   op 'gate'). With the flag off it's parked by Mr. Sir as always.
   The driver's page runs the physics and sends where it is ~12 times a second; everyone else eases toward that. Solo,
   the page does all of it. The pickup parks back by the main gate when the flag goes off or the crew changes map.
   Sizes are the Blender model's (art/blender/heavy.py MrSirTruck): cab at the front (local +z), bed behind it. */
const TRUCK_PARK={x:6.1,z:31.2,h:Math.PI/2};                  // by Mr. Sir, tailgate toward him (flag off)
const TRUCK_GATE_PARK={x:25.4,z:39,h:-Math.PI/2};             // just inside the service gate, nose into camp (flag on)
const ESCAPE_R=18;                                            // out through the gate and this far from it: gone
const truckPark=()=>truckOn()?TRUCK_GATE_PARK:TRUCK_PARK;
const TRUCK_L=5.2,TRUCK_W=2.0,TRUCK_AXLE_F=1.45,TRUCK_AXLE_R=-1.35,TRUCK_TRACK=0.86,TRUCK_WB=2.8;
/* the seats, in truck coordinates (x: its left, z: forward): where your hips go, the seat's height, which way you face
   (0 forward, PI backward), where you stand to get in, where you step out; hide: in the cab, out of sight; clip: the
   animPerson mode you sit with. The tailgate is dropped flat at z -2.3..-2.8, top 0.81 (art/blender/heavy.py); its
   seats sit a thigh's thickness (~0.09) above that so the legs rest on it, not in it. */
const TRUCK_SEATS={
  drive:  {at:[0.38,0.3],y:0.9,face:0,hide:true,door:[1.45,0.35],out:[1.75,0.35],label:'Drive Mr. Sir\'s pickup'},
  shotgun:{at:[-0.38,0.3],y:0.9,face:0,hide:true,door:[-1.45,0.35],out:[-1.75,0.35],label:'Ride shotgun'},
  tail0:  {at:[0.42,-2.55],y:0.9,face:Math.PI,clip:11,door:[0,-3.4],out:[0.6,-3.9],label:'Sit on the tailgate'},
  tail1:  {at:[-0.42,-2.55],y:0.9,face:Math.PI,clip:11,door:[0,-3.4],out:[-0.6,-3.9],label:'Sit on the tailgate'}};
const TRUCK_SEAT_KEYS=Object.keys(TRUCK_SEATS);
const TRUCK_SEND=1/12;                                        // the driver sends where it is this often (s)
const TRUCK={x:TRUCK_PARK.x,z:TRUCK_PARK.z,h:TRUCK_PARK.h,v:0,steer:0,y:0,pitch:0,roll:0,vx:0,vz:0,vy:0,pr:0,rr:0,wz:0,air:false,bog:0,lift:0,hitCool:{},seats:{},on:false,
  root:null,col:null,sendT:0,tgt:null,escaped:false,outGate:false,prevH:TRUCK_PARK.h,outAt:0,wasOn:false};
const truckMe=()=>online()?net.id:'me';
const truckOn=()=>(online()?TRUCK.on:tune('veh.drivable')>=0.5)&&(typeof ZONE==='undefined'||ZONE.id==='lake');
/* local truck coordinates -> world */
function truckAt(lx,lz,T=TRUCK){const c=Math.cos(T.h),s=Math.sin(T.h);return{x:T.x+lx*c+lz*s,z:T.z-lx*s+lz*c}}

/* ---- the model and its collider (it moves, so it's one live box in colliders, not a solid() from 23-models.js) ---- */
TRUCK.root=new T.Group();scene.add(TRUCK.root);
instanceModel('MrSirTruck',[{x:0,y:0,z:0,ry:0}],TRUCK.root).catch(()=>{});
TRUCK.col={x0:0,x1:0,z0:0,z1:0};colliders.push(TRUCK.col);
/* settle it on the ground where it stands (parking, or before its physics has run), then draw it there */
function truckPose(){
  const T=TRUCK,g=(lx,lz)=>{const p=truckAt(lx,lz);return groundAt(p.x,p.z)};
  const fl=g(TRUCK_TRACK,TRUCK_AXLE_F),fr=g(-TRUCK_TRACK,TRUCK_AXLE_F),rl=g(TRUCK_TRACK,TRUCK_AXLE_R),rr=g(-TRUCK_TRACK,TRUCK_AXLE_R);
  T.y=(fl+fr+rl+rr)/4;T.pitch=-Math.atan2((fl+fr)/2-(rl+rr)/2,TRUCK_AXLE_F-TRUCK_AXLE_R);T.roll=Math.atan2((fl+rl)/2-(fr+rr)/2,TRUCK_TRACK*2);
  T.vx=T.vz=T.vy=T.pr=T.rr=T.wz=0;T.air=false;truckDraw();
}
/* the model and the moving collider box, from x/y/z/h/pitch/roll */
function truckDraw(){
  const T=TRUCK;T.root.position.set(T.x,T.y,T.z);T.root.rotation.set(T.pitch,T.h,T.roll,'YXZ');
  const c=Math.abs(Math.cos(T.h)),s=Math.abs(Math.sin(T.h)),hx=(TRUCK_W*c+TRUCK_L*s)/2,hz=(TRUCK_W*s+TRUCK_L*c)/2;
  Object.assign(T.col,{x0:T.x-hx,x1:T.x+hx,z0:T.z-hz,z1:T.z+hz});
}
truckPose();

/* ---- getting in and out ---- */
const truckDriver=()=>TRUCK.seats.drive??null;
function truckSeatOf(id){for(const k of TRUCK_SEAT_KEYS)if(TRUCK.seats[k]===id)return k;return null}
function truckSeat(){return truckSeatOf(truckMe())}
function truckSpot(){
  if(S.inTruck)return{id:'truck',label:'Get out of the truck',use:()=>truckOut()};
  if(!truckOn()||S.inTown||inTent()||S.ko||S.carry!=null)return null;
  let best=null,bd=1.7;
  for(const k of TRUCK_SEAT_KEYS){const q=TRUCK_SEATS[k];if(TRUCK.seats[k]!=null)continue;const d=truckAt(q.door[0],q.door[1]),dd=Math.hypot(P.x-d.x,P.z-d.z);if(dd<bd){bd=dd;best=k}}
  return best?{id:'truck',label:TRUCK_SEATS[best].label,use:()=>truckIn(best)}:null;
}
function truckIn(seat){
  if(online()){wsSend({t:'truck',op:'in',seat});return}
  TRUCK.seats[seat]='me';truckSeated();
}
function truckOut(){
  const k=truckSeat();if(k)delete TRUCK.seats[k];   // off at once; the server agrees
  if(online())wsSend({t:'truck',op:'out'});
  truckSeated();
}
/* my seat changed (from the server, or solo right away): sit down or climb out */
function truckSeated(){
  const seat=truckSeat();if(seat===(S.inTruck||null))return;
  if(seat){const was=S.inTruck;S.inTruck=seat;TRUCK.prevH=TRUCK.h;TRUCK.pY=TRUCK.pVy=TRUCK.pVx=TRUCK.pVz=undefined;P.moving=false;digHeld=false;if(was)return;
    toast(seat==='drive'?'W/S gas and brake, A/D steer, Space handbrake, F to get out. Back her out through the service gate, swing round and drive: that\'s the way out of here.':seat==='shotgun'?'Riding shotgun. F to hop out.':'Sitting on the tailgate, legs over the edge. F to hop off.','',4500);sfx.thud();return}
  const was=S.inTruck;S.inTruck=null;TRUCK.outAt=Date.now();TRUCK.outSeat=was;if(me)me.g.visible=true;
  const o=TRUCK_SEATS[was].out,p=truckAt(o[0],o[1]);
  P.x=p.x;P.z=p.z;P.y=groundAt(p.x,p.z);P.vy=0;
}
function truckLeaveLocal(){if(S.inTruck&&me)me.g.visible=true;S.inTruck=null;Object.assign(TRUCK,truckPark(),{v:0,steer:0,seats:{},tgt:null,escaped:false,outGate:false});truckPose()}
/* put a camper in a seat: hips on it, facing the right way, sitting */
function truckSit(p,seat,dt){const q=TRUCK_SEATS[seat],w=truckAt(q.at[0],q.at[1]);sitPose(p,w.x,TRUCK.y+q.y,w.z,TRUCK.h+q.face,dt,q.clip||10);p.g.visible=!q.hide}

/* ---- its physics (JT: "some sort of weight to the truck"): run by one page, the owner -- the driver, or with nobody
   driving the camper with the lowest id (online) -- who sends where it is; everyone else eases toward that.
   - a body on four springy wheels (suspension per wheel, gravity, airtime off bumps, it can land hard)
   - driving: engine along its heading, tyres that grip sideways, steering only with wheels on the ground
   - holes grab a wheel: a shallow one jolts, a deep one (5 ft) bogs it down until you reverse out or friends push
   - twisters pull it and spin it, and lift it only near the core of a strong one (it weighs TRUCK_MASS: a camper is 80)
   - giant tumbleweeds and landslide boulders shove it by their weight and speed; they never lift it
   - it bumps off anything solid and anyone standing in its way gets hit (the page of whoever's hit does that part)
   JT: the driver and shotgun are immune (no damage, nothing grabs them: 70-player.js hurt, 72-twisters, 75-tumbleweed,
   83-vultures, and the server leaves them out of the creatures' reach); the two on the tailgate are open to the
   elements: twisters, tumbleweeds, vultures, boulders and creatures can get them, and a hard jolt throws them off. */
const TRUCK_WHEELS=[[TRUCK_TRACK,TRUCK_AXLE_F],[-TRUCK_TRACK,TRUCK_AXLE_F],[TRUCK_TRACK,TRUCK_AXLE_R],[-TRUCK_TRACK,TRUCK_AXLE_R]];
const TRUCK_G=16;                 // gravity, the same as a camper's jump arc
const TRUCK_SUB=4;                // physics substeps a frame (stiff springs)
const TRUCK_SPRING=9,TRUCK_DAMP=0.9;   // suspension: natural frequency (rad/s x the wheel's share of the weight) and damping ratio
const TRUCK_GRIP=7;               // sideways slip dies away this fast (1/s) with wheels on the ground
const TRUCK_BOG_DEPTH=0.55,TRUCK_STUCK_DEPTH=1.1;   // a wheel's ground this far below the others': in a hole; this far: stuck in it
const truckMass=()=>tune('veh.mass');
function truckOwner(){
  const d=truckDriver();if(d!=null)return d;if(!online())return'me';
  let lo=net.id;for(const id of remotes.keys())if(id<lo)lo=id;return lo;
}
function truckHurtIn(n){   // a hard landing or a big knock hurts whoever's on the tailgate (the cab is safe: hurt() skips it)
  if(S.inTruck&&n>2)hurt(Math.min(40,n),'Truck','Thrown about on Mr. Sir\'s pickup.');
}
function truckPhys(dt){
  const T=TRUCK,M=truckMass(),drive=truckDriver()===truckMe()&&S.inTruck==='drive',key=k=>drive&&!uiOpen()&&!!KEYS[k];
  const gas=key('w')||key('arrowup'),rev=key('s')||key('arrowdown'),hb=key(' '),st=(key('a')||key('arrowleft')?1:0)-(key('d')||key('arrowright')?1:0);
  const vmax=tune('veh.speed'),acc=tune('veh.accel');
  T.steer+=(st*tune('veh.steer')-T.steer)*Math.min(1,dt*(st?3:5));
  const kS=(M/4)*TRUCK_SPRING*TRUCK_SPRING,cS=2*TRUCK_DAMP*Math.sqrt(kS*M/4),sag=M*TRUCK_G/(4*kS);
  const Ip=M*(TRUCK_L*TRUCK_L)/14,Ir=M*(TRUCK_W*TRUCK_W)/10;
  const hz=truckHazards(dt);   // wind, tumbleweeds, boulders: extra acceleration (and lift) this frame
  const sd=dt/TRUCK_SUB;let landV=0;
  for(let k=0;k<TRUCK_SUB;k++){
    // ---- the four wheels: springs push the body up where it's low; which wheels touch; holes
    let F=0,Tp=0,Tr=0,touch=0;const gs=[];
    for(const[lx,lz]of TRUCK_WHEELS){const p=truckAt(lx,lz);gs.push(groundAt(p.x,p.z))}
    const gm=(gs[0]+gs[1]+gs[2]+gs[3])/4;let inHole=0,stuck=0;
    TRUCK_WHEELS.forEach(([lx,lz],i)=>{
      const others=(gm*4-gs[i])/3,depth=others-gs[i];if(depth>TRUCK_BOG_DEPTH)inHole++;if(depth>TRUCK_STUCK_DEPTH)stuck++;
      const g=Math.max(gs[i],others-0.45);   // a wheel drops into a hole only so far: it's wider than the tyre, the rim catches
      const hy=T.y-Math.sin(T.pitch)*lz+Math.sin(T.roll)*lx,vyW=T.vy-Math.cos(T.pitch)*T.pr*lz+Math.cos(T.roll)*T.rr*lx;
      const comp=g+sag-hy;if(comp<=0)return;touch++;
      let f=kS*Math.min(comp,0.35)-cS*vyW;if(comp>0.35)f+=kS*8*(comp-0.35)-cS*3*vyW;   // bump stop
      if(vyW<-6)landV=Math.max(landV,-vyW);
      f=Math.max(0,f);F+=f;Tp+=-f*lz;Tr+=f*lx;
    });
    T.bog=stuck?1:inHole?0.4:0;
    T.vy+=(F/M-TRUCK_G+hz.lift)*sd;T.pr+=(Tp/Ip)*sd;T.rr+=(Tr/Ir)*sd;
    T.pr*=Math.exp(-2*sd);T.rr*=Math.exp(-2*sd);
    T.y+=T.vy*sd;T.pitch=clamp(T.pitch+T.pr*sd,-1.2,1.2);T.roll=clamp(T.roll+T.rr*sd,-1.2,1.2);
    const lowest=Math.min(...TRUCK_WHEELS.map(([lx,lz],i)=>T.y-Math.sin(T.pitch)*lz+Math.sin(T.roll)*lx-gs[i]));
    if(lowest<-0.6){T.y-=lowest+0.6;T.vy=Math.max(T.vy,0)}   // never through the ground
    // ---- driving: along the heading (engine, brakes, the slope), grip across it, steering with wheels down
    const fx=Math.sin(T.h),fz=Math.cos(T.h),lx=Math.cos(T.h),lz=-Math.sin(T.h);
    let vl=T.vx*fx+T.vz*fz,vs=T.vx*lx+T.vz*lz;
    const ground=touch>0,traction=ground?touch/4:0;
    if(ground){
      if(gas)vl+=(vl<0?acc*2.2:acc)*traction*(stuck?0.1:1)*sd;
      else if(rev)vl-=(vl>0?acc*2.2:acc*0.7)*traction*(stuck?0.9:1)*sd;
      else vl-=Math.sign(vl)*Math.min(Math.abs(vl),2.2*sd);
      if(hb||!drive)vl-=Math.sign(vl)*Math.min(Math.abs(vl),(drive?16:9)*sd);   // handbrake; parked, nobody at the wheel: the brake's on
      vl+=TRUCK_G*Math.sin(T.pitch)*0.7*sd;                          // rolls back down a slope
      if(T.bog)vl*=Math.exp(-(stuck?6:1.5)*sd);                        // a wheel in a hole drags
      vs*=Math.exp(-TRUCK_GRIP*traction*sd);
      vl=clamp(vl,-vmax*0.35,vmax);
      T.wz+=(vl/TRUCK_WB*Math.tan(T.steer)-T.wz)*Math.min(1,traction*10*sd);   // grounded: the wheels set the turn
    }
    T.vx=fx*vl+lx*vs+hz.ax*sd;T.vz=fz*vl+lz*vs+hz.az*sd;T.wz+=hz.spin*sd;
    const ox=T.x,oz=T.z,oh=T.h;
    T.h+=T.wz*sd;T.x+=T.vx*sd;T.z+=T.vz*sd;
    // ---- bump: a corner or side point inside something solid (or off the map) knocks it back
    let hit=Math.abs(T.x)>EDGE-3||Math.abs(T.z)>EDGE-3;
    if(!hit&&T.y<groundAt(T.x,T.z)+3)for(const[px,pz]of[[1,2.6],[-1,2.6],[1,-2.6],[-1,-2.6],[1,0],[-1,0],[0,2.7],[0,-2.7]]){const p=truckAt(px,pz);
      if(colliders.some(c=>c!==T.col&&p.x>c.x0&&p.x<c.x1&&p.z>c.z0&&p.z<c.z1)){hit=true;break}}
    if(hit){T.x=ox;T.z=oz;T.h=oh;const sp=Math.hypot(T.vx,T.vz);if(sp>2.5&&k===0){sfx.thud();noise(0.25,300,0.4,0.3,'lowpass');truckHurtIn((sp-6)*3)}T.vx*=-0.25;T.vz*=-0.25;T.wz*=-0.3}
  }
  T.air=T.y>groundAt(T.x,T.z)+0.6;
  if(landV>7){sfx.thud();truckHurtIn((landV-7)*4);if(S.inTruck&&!TRUCK_SEATS[S.inTruck].hide)truckEject(T.vx,4,T.vz)}
  T.v=T.vx*Math.sin(T.h)+T.vz*Math.cos(T.h);
  truckDraw();
  if(online()){const moving=Math.hypot(T.vx,T.vz)>0.05||Math.abs(T.vy)>0.05||T.air||drive;
    T.sendT-=dt;if(moving&&T.sendT<=0){T.sendT=TRUCK_SEND;
      wsSend({t:'truck',op:'pos',x:+T.x.toFixed(2),z:+T.z.toFixed(2),h:+T.h.toFixed(3),v:+T.v.toFixed(1),y:+T.y.toFixed(2),p:+T.pitch.toFixed(3),r:+T.roll.toFixed(3),vx:+T.vx.toFixed(1),vz:+T.vz.toFixed(1)})}}
  if(drive){   // out through the service gate (forwards or backwards), then away from it: the escape
    if(T.x>FENCE_X1+1&&T.z>EAST_GATE_Z0&&T.z<EAST_GATE_Z1)T.outGate=true;
    if(T.x<FENCE_X1-1)T.outGate=false;   // drove back in
    if(!T.escaped&&T.outGate&&Math.hypot(T.x-FENCE_X1,T.z-(EAST_GATE_Z0+EAST_GATE_Z1)/2)>ESCAPE_R){T.escaped=true;
      if(online())wsSend({t:'truck',op:'gate'});
      else{const next=ZONE_ORDER[ZONE_ORDER.indexOf(ZONE.id)+1];if(next){toast('You floor it out the service gate. Camp Green Lake is behind you.','gold',5000);zoneFade(()=>zoneEnter(next))}}}
  }
}
/* what the weather and the rocks do to it this frame: horizontal acceleration, spin, and lift (all per unit mass) */
function truckHazards(dt){
  const T=TRUCK,M=truckMass(),out={ax:0,az:0,spin:0,lift:0};
  // twisters: the same wind as on campers (72-twisters.js), divided by the weight; lift only in the core of a strong one
  for(const tw of TW_LIVE.values()){
    const ts=(tw.s||0)*tune('env.twStrength'),d=Math.hypot(tw.x-T.x,tw.z-T.z),pr=tuneOr('env.twReach',TW_PULL_R)*ts;
    if(d>pr||d<0.01)continue;
    const sr=Math.max(tuneOr('env.twGrab',TW_SUCK_R)*ts,0.4),f=Math.pow(clamp(1-(d-sr)/(pr-sr),0,1),TW_PULL_POW),w=80/M*tune('veh.windK');
    const dx=(tw.x-T.x)/d,dz=(tw.z-T.z)/d,pull=TW_PULL_MAX*ts*f*w*20,spin=TW_SPIN_MAX*ts*f*w*20;   // per unit mass: a camper's pull, scaled by 80/weight
    out.ax+=dx*pull-dz*spin;out.az+=dz*pull+dx*spin;out.spin+=spin*0.25;
    // lifted: only in the core of a strong one, for up to 2.5 s or 9 m up, then flung out of the side
    if(T.liftCool<=0&&d<sr*0.6&&ts>=tune('veh.twLift')){
      if(!T.lift){T.lift=1;T.liftT=0;logEv('truckLift',{x:+T.x.toFixed(1),z:+T.z.toFixed(1),s:+ts.toFixed(2)})}
      T.liftT+=dt;out.spin+=6*ts;
      if(T.liftT<2.5&&T.y<groundAt(T.x,T.z)+9)out.lift+=TRUCK_G*(1.25+ts)*(1-d/(sr*0.6));
      else{T.liftCool=4;out.ax-=dx*14/dt*0.05;out.az-=dz*14/dt*0.05}
    }
  }
  T.liftCool=Math.max(0,(T.liftCool||0)-dt);if(T.lift&&!T.air&&out.lift===0&&T.liftT>0.3)T.lift=0;
  // things that hit it: an impulse of (their mass x speed) / its mass, no lift; a cooldown per thing
  const bump=(id,vx,vz,m,kick)=>{const now=performance.now();if((T.hitCool[id]||0)>now)return;T.hitCool[id]=now+700;
    const dv=Math.min(9,m*Math.hypot(vx,vz)/M),n=Math.hypot(vx,vz)||1;T.vx+=vx/n*dv;T.vz+=vz/n*dv;T.vy+=Math.min(0.6,dv*0.08);   // a jolt, never a liftT.wz+=(Math.random()-0.5)*dv*0.3;
    sfx.thud();if(kick)truckHurtIn(dv*3);if(S.inTruck&&!TRUCK_SEATS[S.inTruck].hide&&dv>2.5)truckEject(vx/n*dv,3,vz/n*dv)};
  const near=(x,y,z,r)=>{const dx=x-T.x,dz=z-T.z,c=Math.cos(T.h),s=Math.sin(T.h),lx=dx*c-dz*s,lz=dx*s+dz*c;   // into the truck's own frame
    return Math.abs(lx)<TRUCK_W/2+r&&Math.abs(lz)<TRUCK_L/2+r&&y-r<T.y+2.1&&y+r>T.y};
  if(typeof tbWeeds!=='undefined')for(const w of tbWeeds)if(!w.dead&&near(w.x,w.y,w.z,w.r*0.8))bump('tb'+(w.id??tbWeeds.indexOf(w)),Math.cos(w.head)*w.speed,Math.sin(w.head)*w.speed,tune('veh.tbMass'),false);
  if(typeof lsBoulders!=='undefined')lsBoulders.forEach((b,i)=>{if(b.r&&Math.hypot(b.vx||0,b.vz||0)>2&&near(b.x,b.y,b.z,b.r))bump('ls'+(b.id??i),b.vx,b.vz,2600*4.19*b.r*b.r*b.r*0.35,true)});
  return out;
}
/* thrown off the back (a jolt, a twister, a hard landing): out of the seat and tumbling, where you are */
function truckEject(vx,vy,vz){
  if(!S.inTruck)return;const k=S.inTruck;
  delete TRUCK.seats[k];if(online())wsSend({t:'truck',op:'out'});
  S.inTruck=null;TRUCK.outAt=Date.now();TRUCK.outSeat=k;if(me)me.g.visible=true;
  if(S.ko)return;   // knocked out in your seat: you're just out of it, where you are
  if(typeof ragKnock==='function')ragKnock(tune('rag.knockTime'),vx||0,vy||3,vz||0);
  toast('You\'re thrown off the pickup!','bad',2000);
}
/* every frame from updatePlayer while you're in it (in place of walking) */
function truckPlayer(dt){
  const T=TRUCK;
  if(!TRUCK_SEATS[S.inTruck].hide){   // on the tailgate: a hard jolt, a hard landing or leaving the ground throws you off
    const vy=dt>0?(T.y-(T.pY??T.y))/dt:0,dv=Math.hypot(T.vx-(T.pVx??T.vx),T.vz-(T.pVz??T.vz)),hard=(T.pVy??0)<-7&&vy>-1;
    T.pY=T.y;T.pVy=vy;T.pVx=T.vx;T.pVz=T.vz;
    if(dv>4||hard||T.y>groundAt(T.x,T.z)+2.2){const k=hard?-(T.pVy||0):dv;hurt(Math.min(35,k*3),'Truck','Thrown off Mr. Sir\'s pickup.');truckEject(T.vx,4,T.vz);return}
  }
  P.yaw+=T.h-T.prevH;T.prevH=T.h;   // your view turns with the truck
  if(me)truckSit(me,S.inTruck,dt);
  const g=me?me.g.position:truckAt(0,0);P.x=g.x;P.z=g.z;P.y=me?g.y:T.y;P.vy=0;P.grounded=true;P.moving=false;P.anim=10;P.fa=T.h+TRUCK_SEATS[S.inTruck].face;
}
/* the third-person camera while driving: behind and above, looking down the road */
function truckCamera(dt){
  const T=TRUCK,f=[Math.sin(T.h),Math.cos(T.h)],k=1-Math.exp(-dt*6),back=9,up=4.2;
  camera.position.x+=(T.x-f[0]*back-camera.position.x)*k;camera.position.z+=(T.z-f[1]*back-camera.position.z)*k;
  camera.position.y+=(Math.max(T.y+up,groundAt(camera.position.x,camera.position.z)+1)-camera.position.y)*k;
  camera.lookAt(T.x+f[0]*4,T.y+1.3,T.z+f[1]*4);
}

/* ---- every frame: everyone else's view of it, and the people in it ---- */
function updateTruck(dt){
  const T=TRUCK,on=truckOn();
  if(S.inTruck&&!on)truckOut();
  if(on!==T.wasOn){T.wasOn=on;if(!online()&&!S.inTruck)truckLeaveLocal()}   // solo: to its spot by the service gate, or back by Mr. Sir
  if(on&&truckOwner()===truckMe())truckPhys(dt);
  else if(T.tgt){   // ease toward the owner's last word, carried on by its speed in between
    const g=T.tgt,k=Math.min(1,dt*8);g.x+=g.vx*dt;g.z+=g.vz*dt;
    T.x+=(g.x-T.x)*k;T.z+=(g.z-T.z)*k;T.y+=(g.y-T.y)*k;T.pitch+=(g.p-T.pitch)*k;T.roll+=(g.r-T.roll)*k;
    let dh=g.h-T.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));T.h+=dh*k;T.vx=g.vx;T.vz=g.vz;T.v=g.v;truckDraw();
  }
  truckRunOver(dt);
  truckPushCheck(dt);
  // (remote campers in seats are posed from updateRemotes: truckRemoteSeat)
}

/* on foot in its way: whoever's hit, their own page knocks them flying (and hurts them) */
let truckHitCool=0;
function truckRunOver(dt){
  truckHitCool=Math.max(0,truckHitCool-dt);
  const T=TRUCK,sp=Math.hypot(T.vx,T.vz);
  if(S.inTruck||!S.started||S.ko||S.inTown||inTent()||truckHitCool>0||sp<tune('veh.hitSpeed'))return;
  const dx=P.x-T.x,dz=P.z-T.z,c=Math.cos(T.h),s=Math.sin(T.h),lx=dx*c-dz*s,lz=dx*s+dz*c;
  if(Math.abs(lx)>TRUCK_W/2+0.35||Math.abs(lz)>TRUCK_L/2+0.35||P.y>T.y+1.8||P.y+1.6<T.y)return;
  truckHitCool=1.5;const n=sp||1;
  hurt(Math.min(70,(sp-tune('veh.hitSpeed')+1)*tune('veh.hitDmg')),'Truck','Hit by Mr. Sir\'s pickup.');
  if(typeof ragKnock==='function')ragKnock(tune('rag.knockTime'),T.vx/n*Math.min(14,sp*1.1),4+sp*0.25,T.vz/n*Math.min(14,sp*1.1));
  logEv('truckHit',{sp:+sp.toFixed(1)});
}
/* a friend pushing it (a deep hole, say): walking into it sends a little shove to whoever runs its physics */
let truckPushT=0;
function truckPushCheck(dt){
  truckPushT=Math.max(0,truckPushT-dt);
  if(S.inTruck||!truckOn()||!P.moving||truckPushT>0||S.inTown||inTent())return;
  const T=TRUCK,c=T.col;if(P.x<c.x0-0.5||P.x>c.x1+0.5||P.z<c.z0-0.5||P.z>c.z1+0.5)return;
  const dx=T.x-P.x,dz=T.z-P.z,d=Math.hypot(dx,dz)||1;truckPushT=0.25;
  if(truckOwner()===truckMe())truckShove(dx/d,dz/d);else wsSend({t:'truck',op:'push',dx:+(dx/d).toFixed(2),dz:+(dz/d).toFixed(2)});
}
function truckShove(dx,dz){const T=TRUCK,k=tune('veh.push')*(1800/truckMass());T.vx+=dx*k;T.vz+=dz*k}

/* from updateRemotes (65-net.js): a friend in one of the seats sits there, whatever their last position said */
function truckRemoteSeat(id,R,dt){const k=truckSeatOf(id);if(!k)return false;truckSit(R.p,k,dt);return true}

/* ---- network (65-net.js) ---- */
function truckMsg(m){
  if(m.st){const s=m.st,me_=truckMe(),wasDriver=truckDriver()===me_,seats={};
    if(s.seats&&typeof s.seats==='object')for(const k of TRUCK_SEAT_KEYS)if(s.seats[k]!=null)seats[k]=s.seats[k];
    if(!S.inTruck&&Date.now()-TRUCK.outAt<1500&&seats[TRUCK.outSeat]===me_)delete seats[TRUCK.outSeat];   // the seat I just got out of: old news
    TRUCK.on=!!s.on;TRUCK.seats=seats;
    if(truckDriver()!==me_){if(s.park){TRUCK.x=num(s.x,-600,600,TRUCK.x);TRUCK.z=num(s.z,-600,600,TRUCK.z);TRUCK.h=num(s.h,-100,100,TRUCK.h);TRUCK.tgt=null;truckPose()}}
    else if(!wasDriver){TRUCK.escaped=false}
    truckSeated()}
  if(Array.isArray(m.pos)&&truckOwner()!==truckMe()){const q=m.pos;
    TRUCK.tgt={x:num(q[0],-600,600,TRUCK.x),z:num(q[1],-600,600,TRUCK.z),h:num(q[2],-100,100,TRUCK.h),v:num(q[3],-40,40,0),y:num(q[4],-50,200,TRUCK.y),p:num(q[5],-2,2,0),r:num(q[6],-2,2,0),vx:num(q[7],-60,60,0),vz:num(q[8],-60,60,0)}}
  if(m.push&&truckOwner()===truckMe())truckShove(num(m.push[0],-1,1,0),num(m.push[1],-1,1,0));
  if(m.escaped)toast(`${String(m.escaped).slice(0,24)} drives Mr. Sir's pickup out through the service gate. Everyone's out of camp!`,'gold',6000);
}
function truckHello(st){if(st&&typeof st==='object')truckMsg({st})}

command('truck',{usage:'truck [park]',help:'Mr. Sir\'s pickup: where it is and who is in it; park puts it back (solo). Drivable only with the F2 flag Vehicles > Make drivable.',
  run([a]){
    if(a==='park'){if(online())return'Online it parks itself when the flag goes off or the crew changes map.';truckLeaveLocal();return'Parked by the main gate.'}
    return`Drivable: ${truckOn()?'yes':'no (F2 > Vehicles > Make drivable)'}. At ${TRUCK.x.toFixed(1)}, ${TRUCK.z.toFixed(1)}. Seats: ${TRUCK_SEAT_KEYS.map(k=>k+' '+(TRUCK.seats[k]??'-')).join(', ')}.`}});
