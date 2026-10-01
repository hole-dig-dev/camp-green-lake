'use strict';
/* public/js/87-truck.js -- Mr. Sir's pickup, drivable (JT, 2026-09-30) while the F2 flag "Make drivable" is on
   (Vehicles tab, veh.drivable; off by default).
   Four seats (JT): F at the left door to drive, F at the right door to ride shotgun, F at the back to sit on the edge
   of the dropped tailgate (two spots). F again to get out. Up front you're out of sight, "in the truck" (JT: no heads
   through the roof); on the tailgate you sit on the gate with your legs straight out past its end (SitEdge clip,
   blender/cgl_rig.py). Driving: W/S gas and brake/reverse, A/D steer, Space handbrake.
   With the flag on it waits just inside the service gate, nose into camp (JT: "back out of the service gate"): back it
   out through the gate, swing round outside and drive off: north toward Big Thumb, up the ramp and over the trench
   (10-core.js NORTH). Come down in the trench and it's wrecked till dawn. Past it, the crew climbs the wall on foot
   to win Act 1 (88-north.js). With the flag off it's parked by Mr. Sir as always.
   The driver's page runs the physics and sends where it is ~12 times a second; everyone else eases toward that. Solo,
   the page does all of it. The pickup parks back by the main gate when the flag goes off or the crew changes map.
   Sizes are the Blender model's (art/blender/heavy.py MrSirTruck): cab at the front (local +z), bed behind it. */
const TRUCK_PARK={x:6.1,z:31.2,h:Math.PI/2};                  // by Mr. Sir, tailgate toward him (flag off)
const TRUCK_GATE_PARK={x:25.4,z:39,h:-Math.PI/2};             // just inside the service gate, nose into camp (flag on)
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
const TRUCK={x:TRUCK_PARK.x,z:TRUCK_PARK.z,h:TRUCK_PARK.h,v:0,steer:0,y:0,pitch:0,roll:0,vx:0,vz:0,vy:0,q:new THREE.Quaternion(),w:new THREE.Vector3(),air:false,flipped:false,flipT:0,bog:0,lift:0,hitCool:{},seats:{},on:false,
  root:null,col:null,sendT:0,tgt:null,escaped:false,outGate:false,prevH:TRUCK_PARK.h,outAt:0,wasOn:false};
const truckMe=()=>online()?net.id:'me';
const truckOn=()=>(online()?TRUCK.on:tune('veh.drivable')>=0.5&&!TRUCK.wreck)&&(typeof ZONE==='undefined'||ZONE.id==='lake');
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
  T.y=(fl+fr+rl+rr)/4;const pitch=-Math.atan2((fl+fr)/2-(rl+rr)/2,TRUCK_AXLE_F-TRUCK_AXLE_R),roll=Math.atan2((fl+rl)/2-(fr+rr)/2,TRUCK_TRACK*2);
  T.q.setFromEuler(new THREE.Euler(pitch,T.h,roll,'YXZ'));T.vx=T.vz=T.vy=0;T.w.set(0,0,0);T.air=false;T.flipped=false;truckDraw();
}
/* the model and the moving collider box, from x/y/z/h/pitch/roll */
function truckDraw(){
  const T=TRUCK;T.root.position.set(T.x,T.y,T.z);T.root.quaternion.copy(T.q);
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
  if(TRUCK.wreck)return Math.hypot(P.x-TRUCK.x,P.z-TRUCK.z)<5?{id:'truck',label:'Wrecked in the trench. Hauled back by morning.',use:()=>{}}:null;
  if(!truckOn()||S.inTown||inTent()||S.ko||S.carry!=null)return null;
  if(TRUCK.flipped){   // on its side or roof and stopped: heave it back onto its wheels (JT: the same button as getting in)
    if(TRUCK.flipT>0||Math.hypot(TRUCK.vx,TRUCK.vz)>1.5||Math.hypot(P.x-TRUCK.x,P.z-TRUCK.z)>4.5)return null;
    return{id:'truck',label:'Flip the pickup back upright',use:truckFlip};
  }
  let best=null,bd=1.7;
  for(const k of TRUCK_SEAT_KEYS){const q=TRUCK_SEATS[k];if(TRUCK.seats[k]!=null)continue;const d=truckAt(q.door[0],q.door[1]),dd=Math.hypot(P.x-d.x,P.z-d.z);if(dd<bd){bd=dd;best=k}}
  return best?{id:'truck',label:TRUCK_SEATS[best].label,use:()=>truckIn(best)}:null;
}
function truckFlip(){if(online()&&truckOwner()!==truckMe())wsSend({t:'truck',op:'flip'});else truckFlipStart()}
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
  if(seat){const was=S.inTruck;S.inTruck=seat;TRUCK.prevH=TRUCK.h;if(!was&&!FP){P.yaw=TRUCK.h+Math.PI;P.pitch=0.25}   // the view starts behind the truckTRUCK.pY=TRUCK.pVy=TRUCK.pVx=TRUCK.pVz=undefined;P.moving=false;digHeld=false;if(was)return;
    toast(seat==='drive'?'W/S gas and brake, A/D steer, Space handbrake, F to get out. Back her out through the service gate, then north toward Big Thumb: jump the trench off the ramp.':seat==='shotgun'?'Riding shotgun. F to hop out.':'Sitting on the tailgate, legs over the edge. F to hop off.','',4500);sfx.thud();return}
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
const TRUCK_SUB=8;                // physics substeps a frame (stiff springs and body contacts)
const TRUCK_SPRING=9,TRUCK_DAMP=0.9;   // suspension: natural frequency (rad/s) and damping ratio
const TRUCK_MU=1.3;               // tyre grip (x the wheel's load); the body sliding on its side or roof grips less
const TRUCK_COM=0.7;              // centre of weight above the ground under it; tyre forces act lower (TRUCK_TYRE_Y) so it
const TRUCK_TYRE_Y=0.35;          // takes a hard turn at speed or a twister to roll it, not an ordinary corner
const TRUCK_BOG_DEPTH=0.55,TRUCK_STUCK_DEPTH=1.1;   // a wheel's ground this far below the others': in a hole; this far: stuck in it
const TRUCK_FLIP_UP=0.35;         // its up points this far off the sky and it's over: nobody drives, everyone out
const TRUCK_FLIP_TIME=1.3;        // seconds to heave it back on its wheels
/* the body's corners and roof line, for when it's on its side or roof (origin on the ground under the middle) */
const TRUCK_BODY=[];for(const x of[-0.95,0.95])for(const z of[-2.55,2.55])for(const y of[0.45,z>0?1.9:1.35])TRUCK_BODY.push([x,y,z]);
for(const x of[-0.9,0.9])TRUCK_BODY.push([x,1.9,0.5],[x,1.9,-0.6],[x,1.35,-1.4]);
for(const x of[-1.0,1.0])for(const z of[TRUCK_AXLE_F,TRUCK_AXLE_R])TRUCK_BODY.push([x,0.15,z],[x,0.62,z]);   // the tyres' outer faces: what it rests on when it's on its side
const truckMass=()=>tune('veh.mass');
function truckOwner(){
  const d=truckDriver();if(d!=null)return d;if(!online())return'me';
  let lo=net.id;for(const id of remotes.keys())if(id<lo)lo=id;return lo;
}
function truckHurtIn(n){   // a hard landing or a big knock hurts whoever's on the tailgate (the cab is safe: hurt() skips it)
  if(S.inTruck&&n>2)hurt(Math.min(40,n),'Truck','Thrown about on Mr. Sir\'s pickup.');
}
const _tq=new THREE.Quaternion(),_ta=new THREE.Vector3(),_tb=new THREE.Vector3(),_tc=new THREE.Vector3(),_tr=new THREE.Vector3(),_tf=new THREE.Vector3();
const truckUp=()=>_ta.set(0,1,0).applyQuaternion(TRUCK.q).y;   // 1 on its wheels, 0 on its side, -1 on its roof
/* its heading from where its nose points (or where it pointed, if the nose is straight up or down) */
function truckYaw(){const f=_ta.set(0,0,1).applyQuaternion(TRUCK.q);if(Math.hypot(f.x,f.z)>0.2)TRUCK.h=Math.atan2(f.x,f.z)}
/* a rigid body: the centre of weight moves, it turns any way, springy wheels while it's upright, the body's corners
   and roof when it isn't. Forces go in at points, so it pitches, rolls, tips and tumbles on its own. */
function truckPhys(dt){
  const K=TRUCK,M=truckMass(),drive=truckDriver()===truckMe()&&S.inTruck==='drive'&&!K.flipped,key=k=>drive&&!uiOpen()&&!!KEYS[k];
  if(K.flipT>0){truckFlipStep(dt);return}
  const gas=key('w')||key('arrowup'),rev=key('s')||key('arrowdown'),hb=key(' '),st=(key('a')||key('arrowleft')?1:0)-(key('d')||key('arrowright')?1:0);
  const vmax=tune('veh.speed'),acc=tune('veh.accel');
  K.steer+=(st*tune('veh.steer')-K.steer)*Math.min(1,dt*(st?3:5));
  const kS=(M/4)*TRUCK_SPRING*TRUCK_SPRING,cS=2*TRUCK_DAMP*Math.sqrt(kS*M/4),sag=M*TRUCK_G/(4*kS),kB=M*TRUCK_G/0.06,cB=2*1.3*Math.sqrt(kB*M/4);   // body contacts: stiff and dead (a truck landing on its roof doesn't bounce)
  const I=[M/12*(1.8*1.8+TRUCK_L*TRUCK_L),M/12*(TRUCK_W*TRUCK_W+TRUCK_L*TRUCK_L),M/12*(TRUCK_W*TRUCK_W+1.8*1.8)];
  const hz=truckHazards(dt);
  const sd=dt/TRUCK_SUB;let landV=0;
  // centre of weight, from the origin on the ground under the middle
  const com=_tc.set(0,TRUCK_COM,0).applyQuaternion(K.q).add(_tb.set(K.x,K.y,K.z));
  const v=new THREE.Vector3(K.vx,K.vy,K.vz),w=K.w,F=new THREE.Vector3(),Tq=new THREE.Vector3();
  const force=(r,fx,fy,fz)=>{F.x+=fx;F.y+=fy;F.z+=fz;Tq.x+=r.y*fz-r.z*fy;Tq.y+=r.z*fx-r.x*fz;Tq.z+=r.x*fy-r.y*fx};
  const ptVel=r=>_tf.set(v.x+w.y*r.z-w.z*r.y,v.y+w.z*r.x-w.x*r.z,v.z+w.x*r.y-w.y*r.x);
  let upright=truckUp(),touchW=0,stuck=0,inHole=0;
  for(let k=0;k<TRUCK_SUB;k++){
    F.set(0,-M*TRUCK_G,0);Tq.set(0,0,0);
    const fwd=_ta.set(0,0,1).applyQuaternion(K.q).clone(),left=_tb.set(1,0,0).applyQuaternion(K.q).clone();
    upright=truckUp();touchW=0;stuck=0;inHole=0;
    // ---- wheels (only while it's more or less on them): suspension, then the tyres
    if(upright>0.3){
      const gs=TRUCK_WHEELS.map(([lx,lz])=>{const p=truckAt(lx,lz);return groundAt(p.x,p.z)}),gm=(gs[0]+gs[1]+gs[2]+gs[3])/4;
      TRUCK_WHEELS.forEach(([lx,lz],i)=>{
        const r=_tr.set(lx,-TRUCK_COM,lz).applyQuaternion(K.q).clone(),wp=r.clone().add(com);
        const others=(gm*4-gs[i])/3,depth=others-gs[i];if(depth>TRUCK_BOG_DEPTH)inHole++;if(depth>TRUCK_STUCK_DEPTH)stuck++;
        const g=Math.max(gs[i],others-0.45);   // the tyre's wider than most holes: the rim catches
        const comp=g+sag-wp.y;if(comp<=0)return;
        const pv=ptVel(r);let N=kS*Math.min(comp,0.35)-cS*pv.y;if(comp>0.35)N+=kS*8*(comp-0.35);N=Math.max(0,N)*upright;
        if(-pv.y>6)landV=Math.max(landV,-pv.y);
        touchW++;force(r,0,N,0);
        // tyres: along the wheel (engine, brakes) and across it (grip), limited by the load on it
        let fw=fwd.clone();if(lz>0&&K.steer)fw=fwd.clone().multiplyScalar(Math.cos(K.steer)).addScaledVector(left,Math.sin(K.steer));
        fw.y=0;fw.normalize();const lw=new THREE.Vector3(fw.z,0,-fw.x);
        const vl=pv.x*fw.x+pv.z*fw.z,vs=pv.x*lw.x+pv.z*lw.z,share=M/4/sd,lim=TRUCK_MU*N;
        let Fl=0;const Fs=clamp(-vs*share*0.3,-lim,lim);
        if(gas&&vl<vmax)Fl=(vl<-0.3?-Math.sign(vl)*lim:M*acc/4*(stuck?0.1:1));
        else if(rev&&vl>-vmax*0.35)Fl=(vl>0.3?-lim*0.9:-M*acc*0.7/4*(stuck?0.9:1));
        else{const brake=hb||!drive?lim*0.9:M*2.2/4;Fl=-Math.sign(vl)*Math.min(Math.abs(vl)*share*0.3,brake)}
        if(depth>TRUCK_BOG_DEPTH)Fl-=Math.sign(vl)*Math.min(Math.abs(vl)*share*0.3,M/4*(depth>TRUCK_STUCK_DEPTH?10:3));   // a wheel in a hole drags
        const tot=Math.hypot(Fl,Fs),sc=tot>lim?lim/tot:1;
        const ra=r.clone();ra.y=r.y*TRUCK_TYRE_Y/TRUCK_COM;   // tyre forces act low: less tipping from ordinary driving
        force(ra,(fw.x*Fl+lw.x*Fs)*sc,0,(fw.z*Fl+lw.z*Fs)*sc);
      });
    }
    // ---- the body's corners and roof: when it's tipped, on its side, on its roof, or bottomed out in a hole
    let bodyTouch=0;
    for(const[bx,by,bz]of TRUCK_BODY){
      const r=_tr.set(bx,by-TRUCK_COM,bz).applyQuaternion(K.q).clone(),wp=r.clone().add(com),g=groundAt(wp.x,wp.z),pen=g-wp.y;if(pen<=0)continue;bodyTouch++;
      const pv=ptVel(r),N=Math.max(0,kB*Math.min(pen,0.3)-cB*pv.y);if(-pv.y>6)landV=Math.max(landV,-pv.y);
      const ht=Math.hypot(pv.x,pv.z),fr=ht>1e-4?Math.min(0.9*N,ht*M/8/sd*0.3)/ht:0;
      force(r,-pv.x*fr,N,-pv.z*fr);
    }
    // ---- wind, shoves and lift (per unit mass), and a tumble while a twister has it
    F.x+=hz.ax*M;F.z+=hz.az*M;F.y+=hz.lift*M;Tq.y+=hz.spin*I[1]*0.2;
    if(hz.lift>0){Tq.x+=hz.tumble[0]*I[0];Tq.z+=hz.tumble[1]*I[2]}
    // ---- integrate: the centre of weight, then the turn (torque into the body's frame and back)
    v.addScaledVector(F,sd/M);
    const tl=Tq.clone().applyQuaternion(_tq.copy(K.q).invert());tl.set(tl.x/I[0],tl.y/I[1],tl.z/I[2]).applyQuaternion(K.q);
    w.addScaledVector(tl,sd);w.multiplyScalar(Math.exp(-(bodyTouch&&upright<0.6?4:touchW?1.2:0.25)*sd));   // scraping along on its side or roof soaks up the tumble
    const ox=com.x,oz=com.z;
    com.addScaledVector(v,sd);
    const wl=w.length();if(wl>1e-6){_tq.setFromAxisAngle(_ta.copy(w).divideScalar(wl),wl*sd);K.q.premultiply(_tq).normalize()}
    // never through the ground: lift the whole body clear of its lowest point
    let low=0;for(const[bx,by,bz]of TRUCK_BODY){const r=_tr.set(bx,by-TRUCK_COM,bz).applyQuaternion(K.q),pen=groundAt(com.x+r.x,com.z+r.z)-(com.y+r.y);if(pen>low)low=pen}
    if(low>0.35){com.y+=low-0.35;if(v.y<0)v.y=0}
    // bump: anything solid (or the map edge) at its sides and ends knocks it back
    const hx=com.x,hzz=com.z;let hit=Math.abs(hx)>EDGE-3||Math.abs(hzz)>EDGE-3;
    if(!hit&&com.y<groundAt(hx,hzz)+3.5){const c=Math.cos(K.h),s_=Math.sin(K.h);
      for(const[px,pz]of[[1,2.6],[-1,2.6],[1,-2.6],[-1,-2.6],[1,0],[-1,0],[0,2.7],[0,-2.7]]){const X=hx+px*c+pz*s_,Z=hzz-px*s_+pz*c;
        if(colliders.some(cc=>cc!==K.col&&X>cc.x0&&X<cc.x1&&Z>cc.z0&&Z<cc.z1)){hit=true;break}}}
    if(hit){com.x=ox;com.z=oz;const sp=Math.hypot(v.x,v.z);if(sp>2.5&&k===0){sfx.thud();noise(0.25,300,0.4,0.3,'lowpass');truckHurtIn((sp-6)*3)}v.x*=-0.25;v.z*=-0.25;w.y*=-0.3}   // knocked back sideways; how it's tipped isn't undone
    // back to the origin under the middle (what the rest of the game uses)
    const o=_tr.set(0,-TRUCK_COM,0).applyQuaternion(K.q);K.x=com.x+o.x;K.y=com.y+o.y;K.z=com.z+o.z;truckYaw();
  }
  K.vx=v.x;K.vy=v.y;K.vz=v.z;K.bog=stuck?1:inHole?0.4:0;
  K.air=touchW===0&&K.y>groundAt(K.x,K.z)+0.6;
  // on its side or roof: nobody drives it; everyone gets out (heave it back upright with F: truckFlipSpot)
  const was=K.flipped;K.flipped=truckUp()<TRUCK_FLIP_UP;if(K.flipped&&!was)logEv('truckFlip',{x:+K.x.toFixed(1),z:+K.z.toFixed(1)});
  if(landV>7){sfx.thud();truckHurtIn((landV-7)*4)}
  K.v=K.vx*Math.sin(K.h)+K.vz*Math.cos(K.h);
  truckDraw();truckSend(dt,drive);
  truckWreckCheck(dt);
}
function truckSend(dt,drive){
  const K=TRUCK;if(!online())return;
  const moving=Math.hypot(K.vx,K.vz)>0.05||Math.abs(K.vy)>0.05||K.air||drive||K.flipT>0||K.w.lengthSq()>1e-3;
  const stopped=!moving&&K.wasMoving;K.wasMoving=moving;   // one last word when it comes to rest, so nobody keeps it coasting
  K.sendT-=dt;if(!stopped&&(!moving||K.sendT>0))return;K.sendT=TRUCK_SEND;
  wsSend({t:'truck',op:'pos',x:+K.x.toFixed(2),z:+K.z.toFixed(2),h:+K.h.toFixed(3),v:+K.v.toFixed(1),y:+K.y.toFixed(2),
    qx:+K.q.x.toFixed(4),qy:+K.q.y.toFixed(4),qz:+K.q.z.toFixed(4),qw:+K.q.w.toFixed(4),vx:+K.vx.toFixed(1),vz:+K.vz.toFixed(1)});
}
/* came down in the trench and stopped there: wrecked till dawn (the server's word online; the page's solo) */
function truckWreckCheck(dt){
  const K=TRUCK,[t0,t1]=NORTH.trench;
  const down=K.z<t0+1&&K.z>t1-1&&K.y<-1&&Math.hypot(K.vx,K.vz)<1.2;   // in the trench, a metre or more below its rim, stopped
  K.downT=down?(K.downT||0)+dt:0;if(K.downT<1.5||K.wreck)return;
  logEv('truckWreck',{x:+K.x.toFixed(1)});
  if(online())wsSend({t:'truck',op:'wreck'});else{K.wreck=RUN.day||1;K.seats={};truckSeated();toast('Mr. Sir\'s pickup is wrecked in the trench. It\'ll be hauled back by morning.','bad',5000)}
}
/* heaving it back onto its wheels (anyone, F by it once it's stopped): turned back to its heading, then set down */
function truckFlipStart(){
  const K=TRUCK;if(K.flipT>0)return;truckYaw();
  K.flipQ0=K.q.clone();K.flipQ1=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),K.h);K.flipY0=K.y;K.flipT=TRUCK_FLIP_TIME;
  K.vx=K.vy=K.vz=0;K.w.set(0,0,0);sfx.thud();logEv('truckUnflip',{x:+K.x.toFixed(1),z:+K.z.toFixed(1)});
}
function truckFlipStep(dt){
  const K=TRUCK;K.flipT=Math.max(0,K.flipT-dt);const u=1-K.flipT/TRUCK_FLIP_TIME,e=u*u*(3-2*u);
  K.q.copy(K.flipQ0).slerp(K.flipQ1,e);K.y=lerp(K.flipY0,groundAt(K.x,K.z),e)+Math.sin(Math.PI*u)*0.9;
  if(K.flipT<=0){K.flipped=false;truckPose()}else truckDraw();
  truckSend(dt,false);
}
/* what the weather and the rocks do to it this frame: horizontal acceleration, spin, and lift (all per unit mass) */
function truckHazards(dt){
  const T=TRUCK,M=truckMass(),out={ax:0,az:0,spin:0,lift:0,tumble:[0,0]};
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
      if(T.liftT<2.5&&T.y<groundAt(T.x,T.z)+9){out.lift+=TRUCK_G*(1.25+ts)*(1-d/(sr*0.6));   // up, and tumbling end over end and side over side
        if(!T.tumble)T.tumble=[(Math.random()<0.5?-1:1)*(2+Math.random()*3)*ts,(Math.random()<0.5?-1:1)*(3+Math.random()*4)*ts];out.tumble=T.tumble}
      else{T.tumble=null;T.liftCool=4;T.vx-=dx*10*ts;T.vz-=dz*10*ts;T.vy+=2}   // done: flung out of the side
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
  if(T.flipped){if(TRUCK_SEATS[S.inTruck].hide){truckOut();toast('The pickup\'s over. You climb out. F by it to heave it back on its wheels.','',3500)}else truckEject(T.vx,3,T.vz);return}
  if(!TRUCK_SEATS[S.inTruck].hide){   // on the tailgate: a hard jolt, a hard landing or leaving the ground throws you off
    const vy=dt>0?(T.y-(T.pY??T.y))/dt:0,dv=Math.hypot(T.vx-(T.pVx??T.vx),T.vz-(T.pVz??T.vz)),hard=(T.pVy??0)<-7&&vy>-1;
    T.pY=T.y;T.pVy=vy;T.pVx=T.vx;T.pVz=T.vz;
    if(dv>4||hard||T.y>groundAt(T.x,T.z)+2.2){const k=hard?-(T.pVy||0):dv;hurt(Math.min(35,k*3),'Truck','Thrown off Mr. Sir\'s pickup.');truckEject(T.vx,4,T.vz);return}
  }
  P.yaw+=T.h-T.prevH;T.prevH=T.h;   // your view turns with the truck
  if(me)truckSit(me,S.inTruck,dt);
  const g=me?me.g.position:truckAt(0,0);P.x=g.x;P.z=g.z;P.y=me?g.y:T.y;P.vy=0;P.grounded=true;P.moving=false;P.anim=10;P.fa=T.h+TRUCK_SEATS[S.inTruck].face;
}
/* the third-person camera for anyone in the pickup: it orbits the truck with the mouse (JT: look around while W stays
   the truck's forward). P.yaw turns with the truck (truckPlayer), so a view you've swung round stays put relative to it. */
function truckCamera(dt){
  const T=TRUCK,dist=9,a=P.yaw,cp=Math.cos(P.pitch),k=1-Math.exp(-dt*10);
  const cx=T.x+Math.sin(a)*dist*cp,cz=T.z+Math.cos(a)*dist*cp,cy=Math.max(T.y+1.6+Math.sin(P.pitch)*dist+1.2,groundAt(cx,cz)+1);
  camera.position.x+=(cx-camera.position.x)*k;camera.position.z+=(cz-camera.position.z)*k;camera.position.y+=(cy-camera.position.y)*k;
  camera.lookAt(T.x,T.y+1.4,T.z);
}

/* ---- every frame: everyone else's view of it, and the people in it ---- */
function updateTruck(dt){
  const T=TRUCK,on=truckOn();
  if(S.inTruck&&!on)truckOut();
  if(!online()&&T.wreck&&(RUN.day||1)!==T.wreck){T.wreck=0;truckLeaveLocal()}   // solo: hauled back overnight
  if(on!==T.wasOn){T.wasOn=on;if(!online()&&!S.inTruck&&!T.wreck)truckLeaveLocal()}   // solo: to its spot by the service gate, or back by Mr. Sir
  if(on&&truckOwner()===truckMe())truckPhys(dt);
  else if(T.tgt){   // ease toward the owner's last word, carried on by its speed in between
    const g=T.tgt,k=Math.min(1,dt*8);if(performance.now()-g.at<300){g.x+=g.vx*dt;g.z+=g.vz*dt}   // carried on by its speed only briefly between words
    T.x+=(g.x-T.x)*k;T.z+=(g.z-T.z)*k;T.y+=(g.y-T.y)*k;T.q.slerp(g.q,k);T.flipped=truckUp()<TRUCK_FLIP_UP;
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
    if(s.wreck&&!TRUCK.wreck)toast('Mr. Sir\'s pickup is wrecked in the trench. It\'ll be hauled back by morning.','bad',5000);
    TRUCK.on=!!s.on;TRUCK.seats=seats;TRUCK.wreck=s.wreck?1:0;
    if(truckDriver()!==me_){if(s.park){TRUCK.x=num(s.x,-600,600,TRUCK.x);TRUCK.z=num(s.z,-600,600,TRUCK.z);TRUCK.h=num(s.h,-100,100,TRUCK.h);TRUCK.tgt=null;truckPose()}}
    else if(!wasDriver){TRUCK.escaped=false}
    truckSeated()}
  if(Array.isArray(m.pos)&&truckOwner()!==truckMe()){const q=m.pos;
    const qq=new THREE.Quaternion(num(q[5],-1,1,0),num(q[6],-1,1,0),num(q[7],-1,1,0),num(q[8],-1,1,1));if(qq.lengthSq()<0.5)qq.set(0,0,0,1);qq.normalize();
    TRUCK.tgt={x:num(q[0],-600,600,TRUCK.x),z:num(q[1],-600,600,TRUCK.z),h:num(q[2],-100,100,TRUCK.h),v:num(q[3],-40,40,0),y:num(q[4],-50,200,TRUCK.y),q:qq,vx:num(q[9],-60,60,0),vz:num(q[10],-60,60,0),at:performance.now()}}
  if(m.push&&truckOwner()===truckMe())truckShove(num(m.push[0],-1,1,0),num(m.push[1],-1,1,0));
  if(m.flip&&truckOwner()===truckMe())truckFlipStart();
}
function truckHello(st){if(st&&typeof st==='object')truckMsg({st})}

/* put it back where you drive it from (JT): its spot by the service gate (or by Mr. Sir with the flag off), upright,
   everyone out, not wrecked. Online the server does it for everyone. Console `truck respawn`, or F2 > Vehicles. */
function truckRespawn(){
  if(online()){wsSend({t:'truck',op:'respawn'});return'Putting Mr. Sir\'s pickup back.'}
  TRUCK.wreck=0;truckLeaveLocal();return'Mr. Sir\'s pickup is back where you drive it from.';
}
command('truck',{usage:'truck [respawn]',help:'Mr. Sir\'s pickup: where it is and who is in it; respawn puts it back where you drive it from (upright, everyone out). Drivable only with the F2 flag Vehicles > Make drivable.',
  run([a]){
    if(a==='respawn'||a==='park'||a==='reset')return truckRespawn();
    return`Drivable: ${truckOn()?'yes':'no (F2 > Vehicles > Make drivable)'}. At ${TRUCK.x.toFixed(1)}, ${TRUCK.z.toFixed(1)}. Seats: ${TRUCK_SEAT_KEYS.map(k=>k+' '+(TRUCK.seats[k]??'-')).join(', ')}.`}});
