'use strict';
/* public/js/87-truck.js -- Mr. Sir's pickup, drivable (JT, 2026-09-30) while the F2 flag "Make drivable" is on
   (Vehicles tab, veh.drivable; off by default).
   F by the driver's door (the cab's left side) to drive; F by the bed or the tailgate to ride in the back (up to 4);
   F again to get out. W/S gas and brake/reverse, A/D steer, Space handbrake.
   Drive it out through the service gate in the east fence and that's the escape: the whole crew moves on to the next
   map, the same as everyone reaching the campfire (server.js 'truck', op 'gate').
   The driver's page runs the physics and sends where it is ~12 times a second; everyone else eases toward that. Solo,
   the page does all of it. The pickup parks back by the main gate when the flag goes off or the crew changes map.
   Sizes are the Blender model's (art/blender/heavy.py MrSirTruck): cab at the front (local +z), bed behind it. */
const TRUCK_PARK={x:6.1,z:31.2,h:Math.PI/2};
const TRUCK_L=5.2,TRUCK_W=2.0,TRUCK_AXLE_F=1.45,TRUCK_AXLE_R=-1.35,TRUCK_TRACK=0.86,TRUCK_WB=2.8;
const TRUCK_SEAT=[0.38,0.45],TRUCK_DOOR=[1.45,0.45];          // the driver sits on the truck's left (local +x)
const TRUCK_BED=[[0.4,-0.8],[-0.4,-0.8],[0.4,-1.8],[-0.4,-1.8]],TRUCK_BED_Y=0.82;
const TRUCK_SEND=1/12;                                        // the driver sends where it is this often (s)
const TRUCK={x:TRUCK_PARK.x,z:TRUCK_PARK.z,h:TRUCK_PARK.h,v:0,steer:0,y:0,pitch:0,roll:0,driver:null,riders:[],on:false,
  root:null,col:null,sendT:0,tgt:null,escaped:false,prevH:TRUCK_PARK.h,outAt:0};
const truckMe=()=>online()?net.id:'me';
const truckOn=()=>(online()?TRUCK.on:tune('veh.drivable')>=0.5)&&(typeof ZONE==='undefined'||ZONE.id==='lake');
/* local truck coordinates -> world */
function truckAt(lx,lz,T=TRUCK){const c=Math.cos(T.h),s=Math.sin(T.h);return{x:T.x+lx*c+lz*s,z:T.z-lx*s+lz*c}}

/* ---- the model and its collider (it moves, so it's one live box in colliders, not a solid() from 23-models.js) ---- */
TRUCK.root=new T.Group();scene.add(TRUCK.root);
instanceModel('MrSirTruck',[{x:0,y:0,z:0,ry:0}],TRUCK.root).catch(()=>{});
TRUCK.col={x0:0,x1:0,z0:0,z1:0};colliders.push(TRUCK.col);
function truckPose(){
  const T=TRUCK,g=(lx,lz)=>{const p=truckAt(lx,lz);return groundAt(p.x,p.z)};
  const fl=g(TRUCK_TRACK,TRUCK_AXLE_F),fr=g(-TRUCK_TRACK,TRUCK_AXLE_F),rl=g(TRUCK_TRACK,TRUCK_AXLE_R),rr=g(-TRUCK_TRACK,TRUCK_AXLE_R);
  T.y=(fl+fr+rl+rr)/4;T.pitch=-Math.atan2((fl+fr)/2-(rl+rr)/2,TRUCK_AXLE_F-TRUCK_AXLE_R);T.roll=Math.atan2((fl+rl)/2-(fr+rr)/2,TRUCK_TRACK*2);
  T.root.position.set(T.x,T.y,T.z);T.root.rotation.set(T.pitch,T.h,T.roll,'YXZ');
  const c=Math.abs(Math.cos(T.h)),s=Math.abs(Math.sin(T.h)),hx=(TRUCK_W*c+TRUCK_L*s)/2,hz=(TRUCK_W*s+TRUCK_L*c)/2;
  Object.assign(T.col,{x0:T.x-hx,x1:T.x+hx,z0:T.z-hz,z1:T.z+hz});
}
truckPose();

/* ---- getting in and out ---- */
function truckSeat(){const id=truckMe();return TRUCK.driver===id?'drive':TRUCK.riders.includes(id)?'bed':null}
function truckSpot(){
  if(S.inTruck)return{id:'truck',label:'Get out of the truck',use:()=>truckOut()};
  if(!truckOn()||S.inTown||inTent()||S.ko||S.carry!=null)return null;
  const d=truckAt(TRUCK_DOOR[0],TRUCK_DOOR[1]);
  if(Math.hypot(P.x-d.x,P.z-d.z)<1.8&&TRUCK.driver==null)return{id:'truck',label:'Drive Mr. Sir\'s pickup',use:()=>truckIn('drive')};
  for(const[lx,lz]of[[1.35,-1.4],[-1.35,-1.4],[0,-3.1]]){const b=truckAt(lx,lz);
    if(Math.hypot(P.x-b.x,P.z-b.z)<1.8&&TRUCK.riders.length<TRUCK_BED.length)return{id:'truck',label:'Hop in the back of the pickup',use:()=>truckIn('bed')}}
  return null;
}
function truckIn(seat){
  if(online()){wsSend({t:'truck',op:'in',seat});return}
  if(seat==='drive')TRUCK.driver='me';else TRUCK.riders.push('me');
  truckSeated();
}
function truckOut(){
  const id=truckMe();if(TRUCK.driver===id)TRUCK.driver=null;TRUCK.riders=TRUCK.riders.filter(r=>r!==id);   // off at once; the server agrees
  if(online())wsSend({t:'truck',op:'out'});
  truckSeated();
}
/* my seat changed (from the server, or solo right away): step in or climb out */
function truckSeated(){
  const seat=truckSeat();if(seat===(S.inTruck||null))return;
  if(seat){S.inTruck=seat;TRUCK.prevH=TRUCK.h;P.moving=false;digHeld=false;
    toast(seat==='drive'?'W/S gas and brake, A/D steer, Space handbrake, F to get out. Out through the service gate (east fence) is the way out of here.':'You\'re riding in the back. F to hop out.','',4500);sfx.thud();return}
  const was=S.inTruck;S.inTruck=null;TRUCK.outAt=Date.now();if(me)me.g.visible=true;
  const p=was==='drive'?truckAt(TRUCK_DOOR[0]+0.2,TRUCK_DOOR[1]):truckAt(0,-3.4);
  P.x=p.x;P.z=p.z;P.y=groundAt(p.x,p.z);P.vy=0;
}
function truckLeaveLocal(){if(S.inTruck){S.inTruck=null;if(me)me.g.visible=true}Object.assign(TRUCK,TRUCK_PARK,{v:0,steer:0,driver:null,riders:[],tgt:null,escaped:false});truckPose()}

/* ---- the driver: a simple bicycle model on the ground, bumping off anything solid ---- */
function truckDrive(dt){
  const T=TRUCK,key=k=>!uiOpen()&&!!KEYS[k];
  const gas=key('w')||key('arrowup'),rev=key('s')||key('arrowdown'),hb=key(' '),st=(key('a')||key('arrowleft')?1:0)-(key('d')||key('arrowright')?1:0);
  const vmax=tune('veh.speed'),acc=tune('veh.accel');
  T.steer+=(st*tune('veh.steer')-T.steer)*Math.min(1,dt*(st?3:5));
  if(gas)T.v+=(T.v<0?acc*2.2:acc)*dt;else if(rev)T.v-=(T.v>0?acc*2.2:acc*0.7)*dt;
  else T.v-=Math.sign(T.v)*Math.min(Math.abs(T.v),2.2*dt);
  if(hb)T.v-=Math.sign(T.v)*Math.min(Math.abs(T.v),16*dt);
  T.v=clamp(T.v,-vmax*0.35,vmax);
  const ox=T.x,oz=T.z,oh=T.h;
  T.h+=T.v/TRUCK_WB*Math.tan(T.steer)*dt;T.x+=Math.sin(T.h)*T.v*dt;T.z+=Math.cos(T.h)*T.v*dt;
  // bump: any corner or side point inside something solid (or off the edge of the map) and it's knocked back
  let hit=Math.abs(T.x)>EDGE-3||Math.abs(T.z)>EDGE-3;
  if(!hit)for(const[lx,lz]of[[1,2.6],[-1,2.6],[1,-2.6],[-1,-2.6],[1,0],[-1,0],[0,2.7],[0,-2.7]]){const p=truckAt(lx,lz);
    if(colliders.some(c=>c!==T.col&&p.x>c.x0&&p.x<c.x1&&p.z>c.z0&&p.z<c.z1)){hit=true;break}}
  if(hit){T.x=ox;T.z=oz;T.h=oh;if(Math.abs(T.v)>2.5){sfx.thud();noise(0.25,300,0.4,0.3,'lowpass')}T.v*=-0.25}
  truckPose();
  T.sendT-=dt;if(online()&&T.sendT<=0){T.sendT=TRUCK_SEND;wsSend({t:'truck',op:'pos',x:+T.x.toFixed(2),z:+T.z.toFixed(2),h:+T.h.toFixed(3),v:+T.v.toFixed(1)})}
  // out through the service gate: the escape
  if(!T.escaped&&T.x>FENCE_X1+1.5&&T.z>EAST_GATE_Z0&&T.z<EAST_GATE_Z1){T.escaped=true;
    if(online())wsSend({t:'truck',op:'gate'});
    else{const next=ZONE_ORDER[ZONE_ORDER.indexOf(ZONE.id)+1];if(next){toast('You floor it out the service gate. Camp Green Lake is behind you.','gold',5000);zoneFade(()=>zoneEnter(next))}}}
}
/* every frame from updatePlayer while you're in it (in place of walking) */
function truckPlayer(dt){
  const T=TRUCK;
  if(S.inTruck==='drive')truckDrive(dt);
  P.yaw+=T.h-T.prevH;T.prevH=T.h;   // your view turns with the truck
  const s=S.inTruck==='drive'?TRUCK_SEAT:TRUCK_BED[Math.max(0,T.riders.indexOf(truckMe()))];
  const p=truckAt(s[0],s[1]);P.x=p.x;P.z=p.z;P.y=T.y+(S.inTruck==='drive'?0.45:TRUCK_BED_Y);P.vy=0;P.grounded=true;P.moving=false;P.anim=0;
  if(me){me.g.visible=S.inTruck!=='drive';me.g.position.set(P.x,P.y,P.z);me.g.rotation.y=T.h;animPerson(me,0,dt)}
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
  const T=TRUCK;
  if(S.inTruck&&!truckOn())truckOut();
  if(T.driver!==truckMe()&&T.tgt){   // ease toward the driver's last word, carried on by its speed in between
    const[tx,tz,th,tv]=T.tgt,k=Math.min(1,dt*8);T.tgt[0]+=Math.sin(th)*tv*dt;T.tgt[1]+=Math.cos(th)*tv*dt;
    T.x+=(tx-T.x)*k;T.z+=(tz-T.z)*k;let dh=th-T.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));T.h+=dh*k;truckPose();
  }
  for(const[id,R]of remotes){   // the driver is inside the cab; riders stand in the bed
    if(id===T.driver)R.p.g.visible=false;
    const i=T.riders.indexOf(id);if(i>=0){const s=TRUCK_BED[i],p=truckAt(s[0],s[1]);R.p.g.position.set(p.x,T.y+TRUCK_BED_Y,p.z)}
  }
}

/* ---- network (65-net.js) ---- */
function truckMsg(m){
  if(m.st){const s=m.st,wasDriver=TRUCK.driver===truckMe();
    if(!S.inTruck&&Date.now()-TRUCK.outAt<1500&&(s.driver===truckMe()||(s.riders||[]).includes(truckMe())))return;TRUCK.on=!!s.on;TRUCK.driver=s.driver??null;TRUCK.riders=Array.isArray(s.riders)?s.riders.slice(0,TRUCK_BED.length):[];
    if(TRUCK.driver!==truckMe()){if(wasDriver||!TRUCK.driver){TRUCK.x=num(s.x,-600,600,TRUCK.x);TRUCK.z=num(s.z,-600,600,TRUCK.z);TRUCK.h=num(s.h,-100,100,TRUCK.h);TRUCK.tgt=null;truckPose()}}
    else if(!wasDriver){TRUCK.v=0;TRUCK.escaped=false}
    truckSeated()}
  if(Array.isArray(m.pos)&&TRUCK.driver!==truckMe())TRUCK.tgt=[num(m.pos[0],-600,600,TRUCK.x),num(m.pos[1],-600,600,TRUCK.z),num(m.pos[2],-100,100,TRUCK.h),num(m.pos[3],-30,30,0)];
  if(m.escaped)toast(`${String(m.escaped).slice(0,24)} drives Mr. Sir's pickup out through the service gate. Everyone's out of camp!`,'gold',6000);
}
function truckHello(st){if(st&&typeof st==='object')truckMsg({st})}

command('truck',{usage:'truck [park]',help:'Mr. Sir\'s pickup: where it is and who is in it; park puts it back (solo). Drivable only with the F2 flag Vehicles > Make drivable.',
  run([a]){
    if(a==='park'){if(online())return'Online it parks itself when the flag goes off or the crew changes map.';truckLeaveLocal();return'Parked by the main gate.'}
    return`Drivable: ${truckOn()?'yes':'no (F2 > Vehicles > Make drivable)'}. At ${TRUCK.x.toFixed(1)}, ${TRUCK.z.toFixed(1)}. Driver: ${TRUCK.driver??'nobody'}. In the back: ${TRUCK.riders.length}.`}});
