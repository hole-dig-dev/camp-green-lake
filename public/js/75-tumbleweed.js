'use strict';
/* public/js/75-tumbleweed.js -- giant tumbleweeds: schedule, bouncy physics, getting stuck to one, visuals, sound. */
/* ---------- giant tumbleweeds ---------- */
/* JT's spec: "a couple of them, big, big, big, comically large, and they bounce and they move quickly. If they hit
   a player, the player actually gets stuck to it as it rolls, kind of in a funny way."
   A gust of 1-3 comically huge (TB_R_MIN-TB_R_MAX m radius) tumbleweeds forms out on the lake during the day, the
   same way twisters do: worked out from the shared camp clock and a fixed seed (see twPlan/lsPlan), so every
   camper sees the same gust in the same place without a network message. Once spawned, each weed is a small
   deterministic physics sim -- fixed timestep (TB_DT) over baseH(), stepped forward from its own spawn time -- so
   every client, whatever their frame rate or however late they joined, computes the exact same bounce-by-bounce
   path (same trick as the landslide's boulders). They blow across the lake fast, bounce springily the whole way
   (never quite settle), wander a little with a slow steering drift, and either blow off the edge, run out of life,
   or break apart if they get near the camp fence -- like the fence is a wall to them.
   Get hit by one and you're stuck to its surface as it rolls -- upside down at the top, limbs flailing -- until
   you either mash Space enough times to wriggle free, ride it too long, or it bounces hard enough to buck you
   loose; any of those ends in a short tumble + get-up (twister's ragdoll idea, reused). This part (twSt-style state
   machine: tbSt) is purely local to the player it has -- like the twister's twSt, it never touches the weed's own
   path, so it can't desync anyone. Little to no damage: this is a comedy hazard, not a real threat.
   Sheltered the same way as a twister: inside a tent, or down in a hole deeper than 4 ft (TB_SAFE_DEPTH). */
const TB_CELL=280;                   // natural schedule: grid square size (m), same trick as twPlan/lsPlan
const TB_WIN=180000;                 // time window per square (ms) -- 3 minutes
const TB_CHANCE=0.1;                 // per-window chance for a square -- rarer than a twister (0.3), a special sight
const TB_N_MIN=1,TB_N_MAX=3;         // a gust is 1-3 tumbleweeds, per JT's "just maybe a couple of them"
const TB_R_MIN=4,TB_R_MAX=7;         // comically huge -- towers over a camper
const TB_SPEED_MIN=10,TB_SPEED_MAX=16; // m/s blowing across the lake
const TB_SPREAD=9;                   // how far apart the weeds in one gust start (m)
const TB_AIM_JITTER=0.12;            // +/- rad each weed's heading varies from the gust's (was 0.5 = +/-29 deg, so a gust aimed at
                                     // you mostly missed)
const TB_WOBBLE_AMP=0.04;            // steering wobble (rad/s at the sine's peak). Was 0.5: over the ~3 s a gust takes to reach you
                                     // the heading could swing ~1 rad, so a gust aimed straight at you usually missed by 20+ m
const TB_WOBBLE_FQ_MIN=0.05,TB_WOBBLE_FQ_MAX=0.15; // wobble cycles per second, randomized a bit per weed
const TB_GRAV=18;                    // gravity for the bounce arc -- a touch lighter than a boulder, it's basically air
const TB_BOUNCE_MIN=4;               // minimum upward kick (m/s) on every bounce -- keeps it springy its whole life, never settles
const TB_BOUNCE_REST=0.3;            // fraction of impact speed kept on top of the minimum kick. Was 7 + 0.55x, which settles at a
                                     // ~15.6 m/s kick = 6.7 m hops, so weeds sailed right over people. 4 + 0.3x settles at ~5.7 m/s
                                     // (~0.9 m hops): a big ball that bounds along at camper height and actually sweeps you up
const TB_BOUNCE_FRIC=0.94;           // fraction of ground speed kept through a bounce -- it's the wind pushing it, barely slows
const TB_SPEED_FLOOR_FRAC=0.65;      // ground speed never decays below this fraction of a weed's starting speed -- blowing wind, not friction, so it can't ever fully stall out
const TB_BIG_BOUNCE_VY=9;            // an impact at least this hard (m/s) bucks a rider loose next frame
const TB_DT=1/60;                    // physics step (s): fixed, so results don't depend on render frame rate
const TB_MAX_STEPS=600;              // caps the catch-up burst for a late joiner (10 sim-seconds per real frame)
const TB_LIFE=150;                   // seconds before a tumbleweed blows apart on its own. Was 40; JT: "roll for WAY longer"
const TB_FADE_TIME=1.1;              // seconds to pop/shrink away once dead (blew off, or broke on the fence)
const TB_CAMP_R=18;                  // glances off this close (m) to the camp fence -- can't roll through camp
const TB_CAMP_BREAK=2;               // ...but one that somehow ends up right at/inside the fence still breaks apart
const TB_EDGE_TURN=60;               // the wind turns a weed back this far (m) inside the map edge instead of it blowing off
const TB_EDGE_KEEP=40;               // a natural spawn stays at least this far inside the lake's edge
const TB_HIT_PAD=1.2;                // reach (m) past the ball's surface that still snags you: camper half-width + scraggly twigs
const TB_BODY_LO=0.15,TB_BODY_HI=1.75; // the part of you (m above your feet) a weed can catch: shins to top of the head
const TB_SAFE_DEPTH=1.2;             // a hole deeper than this (4 ft, same threshold as the twister) shields you
const TB_HIT_COOL=2.5;               // seconds of immunity to a new stick right after being released
const TB_STICK_TIME_MAX=7;           // seconds before you're flung off on your own even without mashing
const TB_STICK_MASH_N=6;             // fresh Space presses needed to wriggle free early
const TB_STICK_MASH_WINDOW=1.1;      // seconds since the last press before the mash count resets -- gotta keep mashing
const TB_RIDE_FAC=0.85;              // how far out from center you ride, as a fraction of the weed's own radius
const TB_DOWN_TIME=1.0;              // seconds lying down after a release before getting up
const TB_GETUP_TIME=0.4;             // quick stand-up transition, same idea as the twister's
const TB_DMG_MIN=3,TB_DMG_MAX=8;     // a small bump of damage on a hard release -- comedy hazard, not a real threat
const TB_WARN_R=110;                 // being this close (m) to a fresh gust gets you the warning toast
const TB_POOL_CAP=16;                // max tumbleweeds rendered/simulated at once (150 s lives overlap several gusts)
const TB_TWIG_N=90;                  // twigs per tumbleweed, sticking out of the core so the silhouette reads as brush, not a rock
const TB_TWIG_THICK=0.35;            // twig box thickness per metre of weed radius (x each twig's own 1.8-3.4 factor)
const TB_CORE_FRAC=0.62;             // the solid brush core's radius as a fraction of the weed's (the twigs make up the rest)

let tbWeeds=[],tbGusts=[];            // active tumbleweeds, and the gust "events" they belong to (warning + minimap)
const tbSeen=new Map();               // natural-gust plan-id -> the window k it belongs to, so each plan spawns once
let tbLastK=-1,tbWind=null;
/* tbSt: what a tumbleweed is currently doing to YOU (0 free, 1 stuck riding, 2 airborne/tumbling, 3 down, 4 getting
   up) -- same shape as the twister's twSt, and just as purely local: it never touches a weed's own path. */
let tbSt=0,tbStT=0,tbGrab=null,tbSpaceWas=false,tbMashN=0,tbMashT=0,tbCoolT=0;
let tbTheta0=0,tbThetaOff=0,tbRideR=1,tbRagX=0,tbRagY=0,tbRagZ=0;
function tbStateName(){return['free','stuck','airborne','down','gettingup'][tbSt]}

/* one gust: n weeds sharing a seed and heading, so anyone computing the same numbers gets the same tumbleweeds */
function spawnTumbleweedGust(x,z,a,n,seed,t0){
  const r=mulberry32(seed>>>0);r();
  for(let i=0;i<n&&tbWeeds.length<TB_POOL_CAP;i++){
    // the first weed of a gust starts dead on the gust's line (a gust aimed at you always has one coming straight at
    // you); the rest fan out around it. Still the same seeded numbers for everyone.
    const ox=(r()*2-1)*TB_SPREAD,oz=(r()*2-1)*TB_SPREAD,bx=x+(i?ox:0),bz=z+(i?oz:0),rad=TB_R_MIN+r()*(TB_R_MAX-TB_R_MIN);
    const spd=TB_SPEED_MIN+r()*(TB_SPEED_MAX-TB_SPEED_MIN);
    tbWeeds.push({id:t0+'_'+i,r:rad,t0,simT:0,dead:false,deadT:0,rot:0,big:false,
      x:bx,y:baseH(bx,bz)+rad,z:bz,
      head:a+(i?(r()*2-1)*TB_AIM_JITTER:(r(),0)),speed:spd,speedMin:spd*TB_SPEED_FLOOR_FRAC,vy:TB_BOUNCE_MIN,
      wobPh:r()*6.2832,wobFq:TB_WOBBLE_FQ_MIN+r()*(TB_WOBBLE_FQ_MAX-TB_WOBBLE_FQ_MIN),wobAmp:TB_WOBBLE_AMP*(0.6+r()*0.6)});
  }
  tbGusts.push({x,z,t0,warned:false,n});
}

/* one fixed physics step for a single weed. returns true if it bounced this step (used for the near-player dust/thud).
   Deterministic: only w's own fields and a seeded phase feed in -- no Math.random(), no player state -- so every
   camper stepping from the same t0 lands on the exact same bounce in the exact same spot. */
function tbPhysStep(w){
  w.simT+=TB_DT;
  w.head+=Math.sin(w.simT*w.wobFq*6.2832+w.wobPh)*w.wobAmp*TB_DT;   // deterministic steering drift, not a random walk
  const dirx=Math.cos(w.head),dirz=Math.sin(w.head);
  w.vy-=TB_GRAV*TB_DT;
  w.x+=dirx*w.speed*TB_DT;w.y+=w.vy*TB_DT;w.z+=dirz*w.speed*TB_DT;
  tbDeflect(w,dirx,dirz);
  const gy=baseH(w.x,w.z)+w.r;                     // deterministic ground, same reasoning as the landslide's boulders
  let bounced=false;
  if(w.y<=gy){
    const impactVy=w.vy;
    w.y=gy;bounced=true;
    w.vy=Math.abs(impactVy)*TB_BOUNCE_REST+TB_BOUNCE_MIN;   // a floor on the kick keeps it springy for its whole life
    w.speed=Math.max(w.speed*TB_BOUNCE_FRIC,w.speedMin);    // a floor on ground speed too -- it's the wind, not rolling to a stop
    w.big=impactVy<-TB_BIG_BOUNCE_VY;               // hit hard enough to buck a rider loose
  }else w.big=false;
  w.rot+=w.speed/w.r*TB_DT;                          // rolling rotation speed matches ground speed
  return bounced;
}

/* Keep a weed rolling instead of ending it: near the map edge the wind swings it back inward, and at the
   camp fence it glances off like a ball off a wall (reflect the heading about the fence's outward normal).
   Pure maths on the weed's own state, so every client still gets the same path. */
function tbDeflect(w,dx,dz){
  const lim=EDGE-TB_EDGE_TURN;
  if((w.x>lim&&dx>0)||(w.x<-lim&&dx<0))dx=-dx;
  if((w.z>lim&&dz>0)||(w.z<-lim&&dz<0))dz=-dz;
  const d=campDist(w.x,w.z);
  if(d<TB_CAMP_R&&d>0){
    const nx=(w.x-clamp(w.x,-40,30))/d,nz=(w.z-clamp(w.z,27,56))/d,dot=dx*nx+dz*nz;   // same fence box as campDist()
    if(dot<0){dx-=2*dot*nx;dz-=2*dot*nz}
  }
  w.head=Math.atan2(dz,dx);
}

/* natural gust: deterministic per TB_CELL square and TB_WIN time window, same trick as twPlan()/lsPlan() */
function tbPlan(ci,cj,k){
  const r=mulberry32((((ci+321)*97711+(cj+321))*2971215073^(k*3542024437))>>>0);r();
  if(r()>TB_CHANCE)return null;
  const x=(ci+r())*TB_CELL,z=(cj+r())*TB_CELL;
  if(Math.max(Math.abs(x),Math.abs(z))>EDGE-TB_EDGE_KEEP||campDist(x,z)<TB_CAMP_R+25)return null;   // stay off the edge and away from camp
  const a=r()*Math.PI*2;                             // which way the gust blows (radians, same convention as twisters)
  const n=TB_N_MIN+Math.floor(r()*(TB_N_MAX-TB_N_MIN+1));
  return{id:ci+','+cj+','+k,x,z,a,n,t0:k*TB_WIN+r()*(TB_WIN-4000),seed:((ci+640)*130363+(cj+640)*160481+k*2971215073)>>>0};
}

const TB_VOL=0.1;   // tumbleweed thuds at 10% (JT: tumbleweeds too loud)
function tbSound(level){
  if(!AC)return;
  if(!tbWind){const src=AC.createBufferSource();src.buffer=noiseBuf;src.loop=true;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=900;f.Q.value=0.6;tbWind=AC.createGain();tbWind.gain.value=0;src.connect(f).connect(tbWind).connect(fxBus);src.start()}
  tbWind.gain.setTargetAtTime(level*0.05,AC.currentTime,0.3);   // 10% of the old 0.5 (JT: tumbleweeds too loud)
}

/* looks: a pooled InstancedMesh pair (two twig shades) so every tumbleweed on screen ever, twigs and all, is 2 draw
   calls total. Each twig's own local offset/length/tilt is picked once at load (cosmetic layout only, like the
   twister's flying debris) and just re-transformed per weed per frame -- no per-frame allocation. */
const TB_TWIG_GEO=new T.BoxGeometry(0.05,0.05,1);
const tbMatA=new T.MeshStandardMaterial({color:0xb08a52,flatShading:true,roughness:1}),
      tbMatB=new T.MeshStandardMaterial({color:0x6b4f2a,flatShading:true,roughness:1});
const tbMeshA=new T.InstancedMesh(TB_TWIG_GEO,tbMatA,TB_POOL_CAP*TB_TWIG_N),
      tbMeshB=new T.InstancedMesh(TB_TWIG_GEO,tbMatB,TB_POOL_CAP*TB_TWIG_N);
/* The core is what makes it read as a solid ball of tangled brush instead of a scribble of lines: a lumpy low-poly
   ball (an icosphere with every vertex pushed in or out a little, and patchy tan/brown faces), shared by every weed,
   one instance each. Fixed seeds, so it looks the same for everyone. */
const TB_CORE_GEO=(()=>{const g=new T.IcosahedronGeometry(1,2).toNonIndexed(),pos=g.attributes.position,rnd=mulberry32(4242),bump=new Map(),col=[],c=new T.Color();
  for(let i=0;i<pos.count;i++){const k=pos.getX(i).toFixed(3)+','+pos.getY(i).toFixed(3)+','+pos.getZ(i).toFixed(3);if(!bump.has(k))bump.set(k,0.82+rnd()*0.3);const m=bump.get(k);pos.setXYZ(i,pos.getX(i)*m,pos.getY(i)*m,pos.getZ(i)*m)}
  for(let f=0;f<pos.count/3;f++){c.setHex([0xb8955a,0xc9a86a,0x9c7a45,0xd4b67a,0xa8864f][Math.floor(rnd()*5)]);for(let v=0;v<3;v++)col.push(c.r,c.g,c.b)}
  g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeVertexNormals();return g})();
const tbCoreMat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1});
const tbMeshCore=new T.InstancedMesh(TB_CORE_GEO,tbCoreMat,TB_POOL_CAP);
for(const im of[tbMeshA,tbMeshB,tbMeshCore]){im.castShadow=true;im.frustumCulled=false;im.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(im)}
tbMeshCore.receiveShadow=true;
const tbTwigs=[];
{
  const baseZ=new T.Vector3(0,0,1),rnd=mulberry32(777);
  for(let i=0;i<TB_TWIG_N;i++){
    const dir=new T.Vector3(rnd()*2-1,rnd()*2-1,rnd()*2-1);
    if(dir.lengthSq()<0.01)dir.set(1,0,0);dir.normalize();
    // twigs are rooted around the core's surface and poke out past it, tilted so they criss-cross like real brush
    const len=0.45+rnd()*0.55,rad=TB_CORE_FRAC*(0.7+rnd()*0.35);
    const q=new T.Quaternion().setFromUnitVectors(baseZ,dir);
    q.multiply(new T.Quaternion().setFromEuler(new T.Euler((rnd()-0.5)*1.6,(rnd()-0.5)*1.6,(rnd()-0.5)*1.6)));
    tbTwigs.push({dir,rad,len,thick:1.2+rnd()*1.4,q,a:rnd()<0.5});
  }
}
const tbAxis=new T.Vector3(),tbQuat=new T.Quaternion(),tbVec=new T.Vector3();
/* The Blender tumbleweed (art/blender/rocks.py: ~120 curling stems round a packed core, unit radius). Once it loads it
   takes over from the core + twigs above: same pool size, one InstancedMesh per part (3 draws for every weed). */
let tbModel=null;
modelParts('Tumbleweed').then(parts=>{
  tbModel=parts.map(p=>{const im=new T.InstancedMesh(p.geometry,p.material,TB_POOL_CAP);im.castShadow=true;im.receiveShadow=true;im.frustumCulled=false;im.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(im);return im});
  for(const im of[tbMeshA,tbMeshB,tbMeshCore])im.visible=false;
}).catch(()=>{});
function tbRender(){
  let slot=0;
  for(const w of tbWeeds){
    if(slot>=TB_POOL_CAP)break;
    const fade=w.dead?clamp(1-w.deadT/TB_FADE_TIME,0,1):1;
    tbAxis.set(-Math.sin(w.head),0,Math.cos(w.head));tbQuat.setFromAxisAngle(tbAxis,w.rot);   // rolling axis matches travel direction
    if(tbModel){   // the Blender tangle: one instance per weed per part, sized to the whole weed
      dummy.position.set(w.x,w.y,w.z);dummy.quaternion.copy(tbQuat);dummy.scale.setScalar(w.r*fade);dummy.updateMatrix();
      for(const im of tbModel)im.setMatrixAt(slot,dummy.matrix);slot++;continue;
    }
    dummy.position.set(w.x,w.y,w.z);dummy.quaternion.copy(tbQuat);dummy.scale.setScalar(w.r*TB_CORE_FRAC*fade);dummy.updateMatrix();tbMeshCore.setMatrixAt(slot,dummy.matrix);
    const base=slot*TB_TWIG_N;
    for(let i=0;i<TB_TWIG_N;i++){
      const t=tbTwigs[i];
      tbVec.copy(t.dir).multiplyScalar(w.r*t.rad).applyQuaternion(tbQuat);
      dummy.position.set(w.x+tbVec.x,w.y+tbVec.y,w.z+tbVec.z);
      dummy.quaternion.copy(tbQuat).multiply(t.q);
      const tw=t.thick*w.r*TB_TWIG_THICK*fade;   // twig thickness scales with the ball (it was a fixed ~1-2 cm on a ball up to 14 m wide)
      dummy.scale.set(tw,tw,t.len*w.r*0.95*fade);
      dummy.updateMatrix();
      (t.a?tbMeshA:tbMeshB).setMatrixAt(base+i,dummy.matrix);
    }
    slot++;
  }
  dummy.scale.setScalar(0);dummy.updateMatrix();
  if(tbModel){for(const im of tbModel){for(let s=slot;s<TB_POOL_CAP;s++)im.setMatrixAt(s,dummy.matrix);im.instanceMatrix.needsUpdate=true}return}
  for(let s=slot;s<TB_POOL_CAP;s++){tbMeshCore.setMatrixAt(s,dummy.matrix);for(let i=0;i<TB_TWIG_N;i++){tbMeshA.setMatrixAt(s*TB_TWIG_N+i,dummy.matrix);tbMeshB.setMatrixAt(s*TB_TWIG_N+i,dummy.matrix)}}
  tbMeshA.instanceMatrix.needsUpdate=true;tbMeshB.instanceMatrix.needsUpdate=true;tbMeshCore.instanceMatrix.needsUpdate=true;
}

/* hit test: are you close enough to a live weed to get swept up? Only checked while free (not already stuck/KO'd),
   sheltered the same way the twister is (tent, or a hole deeper than 4 ft). */
function tbHit(w){
  if(inTent())return;
  if(holeDepthHere()>TB_SAFE_DEPTH)return;
  // Real 3D contact: the ball against your body (a vertical segment from shins to head), not a flat radius plus a
  // loose height window. Anything the ball's surface touches gets swept up; a ball bounding over your head doesn't.
  const cy=clamp(w.y,P.y+TB_BODY_LO,P.y+TB_BODY_HI);
  if(Math.hypot(w.x-P.x,w.y-cy,w.z-P.z)>w.r+TB_HIT_PAD)return;
  tbStart(w);
}
function tbStart(w){
  tbSt=1;tbStT=0;tbGrab=w.id;tbMashN=0;tbMashT=0;tbSpaceWas=!!KEYS[' '];w.big=false;   // clear any stale bounce flag from before you grabbed on
  tbTheta0=w.rot;tbThetaOff=-Math.PI/2;tbRideR=w.r*TB_RIDE_FAC;   // start at the front -- it immediately rolls you up and over
  P.moving=false;P.anim=0;P.grounded=false;digHeld=false;
  logEv('tbStick',{x:+P.x.toFixed(1),z:+P.z.toFixed(1),tbx:+w.x.toFixed(1),tbz:+w.z.toFixed(1),r:+w.r.toFixed(1)});
  toast('A giant tumbleweed swept you up! Mash Space to wriggle free.','bad',3200);
}
/* release: any way out (wriggling free, riding too long, or a hard bounce bucking you off) ends in the same short
   tumble + get-up (states 2-4), reusing the twister's ragdoll idea. Only a hard release does the tiny bit of damage
   this comedy hazard allows; wriggling free or the weed despawning under you costs nothing. */
function tbRelease(cause){
  tbCoolT=TB_HIT_COOL;
  const gentle=cause==='gone'||cause==='wriggle';
  const out=Math.random()*Math.PI*2,sp=gentle?2.5+Math.random()*2:8+Math.random()*5;
  P.kx=Math.cos(out)*sp;P.kz=Math.sin(out)*sp;P.vy=gentle?3+Math.random()*1.5:6+Math.random()*3;P.grounded=false;
  tbRagX=(Math.random()*2-1)*(gentle?4:10);tbRagY=(Math.random()*2-1)*(gentle?3:7);tbRagZ=(Math.random()*2-1)*(gentle?4:9);
  tbSt=2;tbStT=0;digHeld=false;
  logEv('tbRelease',{cause,x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
  if(cause==='timeout'||cause==='bigbounce'){
    const dmg=Math.round(TB_DMG_MIN+Math.random()*(TB_DMG_MAX-TB_DMG_MIN));
    hurt(dmg,'Tumbleweed',cause==='bigbounce'?'A giant tumbleweed bounced you loose.':'You rode a giant tumbleweed too long and got flung off.');
    if(!S.ko)toast(`The tumbleweed flings you loose! -${dmg} health`,'bad',3000);
  }else if(cause==='wriggle'){sfx.thud(TB_VOL);toast('You wriggle free and tumble off the tumbleweed!','good',2400)}
  else toast('The tumbleweed rolls on without you.','',2200);
}
/* drives states 1-4 every frame, in place of the normal movement/digging code in updatePlayer (which it replaces
   while a tumbleweed has you) -- same shape as the twister's twStep. If S.ko fires mid-sequence, knockOut() clears
   tbSt itself, so control falls straight back to normal KO handling next frame. */
function tbStep(dt){
  tbStT+=dt;
  if(tbSt===1){
    const w=tbWeeds.find(x=>x.id===tbGrab);
    if(!w||w.dead){tbRelease('gone');return}
    if(w.big){w.big=false;tbRelease('bigbounce');return}
    if(KEYS[' ']&&!tbSpaceWas){tbMashN++;tbMashT=TB_STICK_MASH_WINDOW}
    tbSpaceWas=!!KEYS[' '];tbMashT-=dt;if(tbMashT<=0)tbMashN=0;
    if(tbMashN>=TB_STICK_MASH_N){tbRelease('wriggle');return}
    if(tbStT>=TB_STICK_TIME_MAX){tbRelease('timeout');return}
    const theta=tbThetaOff+(w.rot-tbTheta0),dirx=Math.cos(w.head),dirz=Math.sin(w.head);
    P.x=w.x+dirx*Math.sin(theta)*tbRideR;P.z=w.z+dirz*Math.sin(theta)*tbRideR;P.y=w.y-Math.cos(theta)*tbRideR;
    me.g.position.set(P.x,P.y,P.z);me.g.rotation.x=theta;                    // tumbles around with the ball -- upside down at the top
    let dr=w.head-me.g.rotation.y;dr=Math.atan2(Math.sin(dr),Math.cos(dr));me.g.rotation.y+=dr*Math.min(1,dt*6);
    const flail=Math.sin(tbStT*20)*0.85;                                     // limbs flailing -- purely cosmetic, no gameplay meaning
    me.armL.rotation.x=flail;me.armR.rotation.x=-flail*0.9;me.legL.rotation.x=-flail*0.6;me.legR.rotation.x=flail*0.6;
    me.upper.rotation.z=Math.sin(tbStT*11+1)*0.22;
  }else if(tbSt===2){                                                        // airborne -- tumbling flight, same shape as twSt===2
    P.x=clamp(P.x+P.kx*dt,-HALF+3,HALF-3);P.z=clamp(P.z+P.kz*dt,-HALF+3,HALF-3);
    P.vy-=16*dt;P.y+=P.vy*dt;
    if(!me.model){me.g.rotation.x+=dt*tbRagX;me.g.rotation.y+=dt*tbRagY;me.g.rotation.z+=dt*tbRagZ}   // the Blender camper ragdolls instead (26-ragdoll.js)
    const g=groundAt(P.x,P.z);
    if(P.y<=g){P.y=g;P.vy=0;P.grounded=true;tbSt=3;tbStT=0;P.anim=3;P.kx*=0.4;P.kz*=0.4;me.upper.rotation.z=0;me.armL.rotation.x=me.armR.rotation.x=me.legL.rotation.x=me.legR.rotation.x=0}
    me.g.position.set(P.x,P.y,P.z);
  }else if(tbSt===3){                                                        // down -- skid dies out, then lie still
    const f=Math.exp(-dt*5);P.kx*=f;P.kz*=f;
    if(Math.hypot(P.kx,P.kz)>0.05){P.x=clamp(P.x+P.kx*dt,-HALF+3,HALF-3);P.z=clamp(P.z+P.kz*dt,-HALF+3,HALF-3);P.y=groundAt(P.x,P.z)}
    animPerson(me,3,dt);me.g.rotation.z=lerp(me.g.rotation.z,0,Math.min(1,dt*6));me.g.position.set(P.x,P.y,P.z);
    if(tbStT>=TB_DOWN_TIME){tbSt=4;tbStT=0}
  }else if(tbSt===4){                                                        // getting up
    const u=clamp(tbStT/TB_GETUP_TIME,0,1);
    if(!me.model){me.g.rotation.x=lerp(-Math.PI/2,0,u);me.g.rotation.z=lerp(me.g.rotation.z,0,Math.min(1,dt*8))}
    me.g.position.set(P.x,P.y,P.z);
    if(u>=1){tbSt=0;P.kx=P.kz=0;P.anim=0;me.g.rotation.set(0,me.g.rotation.y,0)}
  }
}

function updateTumbleweeds(dt){
  tbCoolT=Math.max(0,tbCoolT-dt);
  const T0=twNow(),k=Math.floor(T0/TB_WIN),fx=S.started?P.x:0,fz=S.started?P.z:12;
  const ci=Math.floor(fx/TB_CELL),cj=Math.floor(fz/TB_CELL);
  if(!DIRECTOR_ON&&!ZONE_H)for(let i=ci-1;i<=ci+1;i++)for(let j=cj-1;j<=cj+1;j++)for(const kk of[k-1,k]){   // natural gusts: only when the event director is off (it owns the budget)
    const pl=tbPlan(i,j,kk);if(!pl||tbSeen.has(pl.id))continue;
    const e=(T0-pl.t0)/1000;if(e<0||e>TB_LIFE)continue;
    tbSeen.set(pl.id,kk);
    if(nightF()<=0.3)spawnTumbleweedGust(pl.x,pl.z,pl.a,pl.n,pl.seed,pl.t0);   // daytime-only hazard, like twisters
  }
  if(k!==tbLastK){tbLastK=k;for(const[id,kk]of tbSeen)if(kk<k-2)tbSeen.delete(id)}   // forget old windows

  let loud=0,nearBounce=false;
  for(const w of tbWeeds){
    if(w.dead){w.deadT+=dt;continue}
    const target=(T0-w.t0)/1000,steps=Math.min(TB_MAX_STEPS,Math.max(0,Math.round((target-w.simT)/TB_DT)));
    for(let s=0;s<steps;s++){
      const bounced=tbPhysStep(w);
      if(bounced&&steps<20&&Math.hypot(w.x-fx,w.z-fz)<50){
        if(Math.hypot(w.x-fx,w.z-fz)<40)nearBounce=true;
        puff(w.x,w.y-w.r*0.7,w.z,w.x-Math.cos(w.head)*3,w.z-Math.sin(w.head)*3,12);   // dust kicks up behind it (reuses the shared particle pool)
      }
    }
    const dead=target>=TB_LIFE||Math.max(Math.abs(w.x),Math.abs(w.z))>EDGE-4||campDist(w.x,w.z)<TB_CAMP_BREAK;
    if(dead&&!w.dead){w.dead=true;w.deadT=0;puff(w.x,w.y,w.z,w.x+1,w.z+1,10)}   // blew off, or broke apart on the fence
    if(!w.dead){
      loud=Math.max(loud,clamp(1-Math.hypot(w.x-fx,w.z-fz)/180,0,1));
      if(S.started&&!S.ko&&!tbSt&&tbCoolT<=0)tbHit(w);
    }
  }
  if(nearBounce)sfx.thud(TB_VOL);
  tbSound(loud);
  for(let i=tbWeeds.length-1;i>=0;i--)if(tbWeeds[i].dead&&tbWeeds[i].deadT>=TB_FADE_TIME)tbWeeds.splice(i,1);
  for(let i=tbGusts.length-1;i>=0;i--)if((T0-tbGusts[i].t0)/1000>=TB_LIFE+TB_FADE_TIME+1)tbGusts.splice(i,1);

  for(const g of tbGusts)if(!g.warned&&S.started&&Math.hypot(g.x-fx,g.z-fz)<TB_WARN_R){
    g.warned=true;logEv('tbWarn',{x:+P.x.toFixed(1),z:+P.z.toFixed(1),tbx:+g.x.toFixed(1),tbz:+g.z.toFixed(1)});
    toast(`Giant tumbleweed${g.n>1?'s':''} blowing in from the ${compass(g.x-P.x,g.z-P.z)}! Get clear, or duck into a tent or a deep hole.`,'bad',5500);
  }
  if(S.started&&!inTent()&&nearBounce){camera.position.x+=(Math.random()-0.5)*0.16;camera.position.y+=(Math.random()-0.5)*0.16}   // a little shake when one lands close
  // NOTE: tbStep() (the ride/thrown/down/up state machine) is driven from updatePlayer's early-return hook, same
  // as the twister's twStep -- not from here, so it runs exactly once per frame.
  tbRender();
}
