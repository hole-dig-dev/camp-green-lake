'use strict';
/* public/js/87-sinkhole.js -- sinkhole hazard: ground shakes, a big deep crater opens, only a friend linking hands
   (or, alone, Zach with a line) can pull you out; it fills back in after a few minutes. Loads after 86-voice.js so
   it can use campDist/CLK/twNow (82-patrol.js), remoteNear/addXP/holeDepthHere/isTrapped/popOut (84-coop.js) and the
   ENV/command registry (76-console.js) at load time; other files that run earlier (65-net.js, 45-state.js, 70-player.js,
   78-hud.js, 30-npcs.js, 90-loop.js) reach the handful of names below from inside their own functions, which is fine
   -- only *immediate* top-level code is order-sensitive (see ARCHITECTURE.md). See ARCHITECTURE.md for the split. */
/* ---------- sinkhole hazard ---------- */
/* Natural sinkholes are worked out the same deterministic way as twisters/landslides (shared clock + a seed, see
   twPlan/lsPlan) so every camper agrees on where and when without any network traffic, and a late joiner computing
   the same plan sees an already-open crater at the right spot. Unlike those, the whole map's grid of cells is
   rescanned every frame (not just the cells near you) -- there are only a couple of dozen SINK_CELL squares on the
   whole lake, so the cost is trivial, and it means an open sinkhole never "un-tracks" itself just because you walked
   away from it (which would otherwise re-run its opening animation from scratch when you came back). */
const SINK_CELL=260, SINK_WIN=300000, SINK_CHANCE=0.045;   // ~1 new one somewhere on the lake every ~5 real minutes
const SINK_CAMP_KEEPOUT=130;                 // stay this far (m, via campDist) from the camp fence
const SINK_THUMB_KEEPOUT=400;                // stay this far from Big Thumb's base (it's already off the playable map, but keep this honest)
const SINK_R_MIN=10, SINK_R_MAX=14;          // crater radius (m) -- "make it pretty big" per JT's spec; × tune env.sinkSize (0.5 since 2026-10-01: half the diameter)
const SINK_DEPTH=4.4;                        // crater bottom depth (m) below the undug ground. baseH() noise is
                                              // small (well under half a metre) so the bottom lands close to -4.5 --
                                              // deep enough to tower over a player (1.8 m tall) with room to spare
                                              // before the network's -5..10 player-Y clamp (see 65-net.js/server.js).
                                              // Widening that clamp would touch every remote-position path (and the
                                              // y=-4 tent interiors); -4.4ish is plenty "deep" without touching it.
const SINK_WARN_TIME=5;                      // seconds of ground-shake warning before it opens
const SINK_OPEN_TIME=1.6;                    // seconds for the ground to actually drop away
const SINK_LIFETIME=210;                     // seconds fully open before it starts trying to fill back in (~3.5 min)
const SINK_FILL_TIME=6;                      // seconds for the crater to fill back in once it starts
const SINK_FORCE_EMPTY_AFTER=25;             // if someone's still down there blocking the fill this long, pop them
                                              // out anyway (AFK safety net -- the world should never wait forever)
const SINK_TRAP_DEPTH=2.9;                   // deeper than the deepest a shovel can dig (EIGHT_FT=2.6): tells a
                                              // sinkhole apart from an ordinary dug hole so isTrapped()'s climb-out
                                              // never fires for one (a sinkhole's walls are "too steep and loose")
const SINK_RESCUE_R=6;                       // how close (m, flat distance) a rescuer at the rim must be to the trapped camper; the trapped one is held within SINK_FLOOR_FRAC of the radius, so on a 14 m crater the rim is up to ~5 m away
const SINK_RESCUE_TIME=2;                    // seconds to hold, solo, before you're hauled up (JT: "hold with E or something")
const SINK_CHAIN_BONUS=0.5;                  // each extra simultaneous rescuer adds this much rate (2 friends = 1.5x, 3 = 2x, ...)
const SINK_MAX_CHAIN=4;                      // helpers beyond this stop adding speed (diminishing returns, not exploitable)
const SINK_RESCUE_XP=40;                     // XP for each rescuer once the pull completes
const SINK_SOLO_WAIT=50;                     // seconds trapped alone before Zach sets out with a line (40-60s per spec)
const SINK_SOLO_APPROACH_R=14;               // Zach "arrives" this far out from the rim, then walks the rest -- keeps
                                              // the wait bounded no matter how far away his own hole actually is
const SINK_SOLO_WALK_SPEED=3.1;              // m/s
const SINK_SOLO_PULL_TIME=2.2;               // seconds of Zach's own reach-down animation before you're free
const SINK_WARN_R=110;                       // toast/shake range (m) around a shaking-ground warning
const SINK_SLIDE_TIME=0.35;                  // seconds of "sliding toward the middle" once you fall in -- feel, not physics
const SINK_POSE_K=6;                         // lerp speed for the reach-up/reach-down poses

const SINK_LIVE=new Map();   // plan id -> live sinkhole {x,z,r,stage,...}
let sinkSpawned=[];          // console/env-triggered ones (mirrors twSpawned/ENV pattern)
let sinkRumbleNode=null;
let sinkPulling=false;                        // am I (locally) holding the rescue key at someone's rim right now?
let sinkRescueT=0, sinkPrevSh=null, sinkFallSlideT=0;
/* Once you fall in you STAY in: sinkTrapped remembers which crater has you until a friend's pull, Zach's line, the
   crater filling in, a knockout, or another hazard carrying you off (twister/tumbleweed/vulture) ends it. The old
   check only stopped a single step that climbed more than 0.6 m, but the crater's wall rises 4.4 m over ~3.4 m, so
   every step climbed only ~7 cm and you could just walk up the side (and halfway up you no longer counted as "in").
   While trapped, updateSinkholes() keeps you on the crater floor and 70-player.js blocks jumping. */
const SINK_FLOOR_FRAC=0.66;                  // you're held inside this fraction of the radius: the flat, full-depth floor
let sinkTrapped=null;

/* one grid cell + time window, exactly like twPlan/lsPlan: same seed math everywhere gives the same answer everywhere */
function sinkPlan(ci,cj,k){
  const r=mulberry32((((ci+777)*93481+(cj+777))*2654435761^(k*2246822519))>>>0);r();
  if(r()>SINK_CHANCE)return null;
  const x=(ci+r())*SINK_CELL,z=(cj+r())*SINK_CELL;
  if(Math.max(Math.abs(x),Math.abs(z))>EDGE-20||nearCampZone(x,z)||campDist(x,z)<SINK_CAMP_KEEPOUT||Math.hypot(x-TH_X,z-TH_Z)<SINK_THUMB_KEEPOUT)return null;
  const rad=(SINK_R_MIN+r()*(SINK_R_MAX-SINK_R_MIN))*tune('env.sinkSize');   /* F2 slider: JT 2026-10-01 halved them */
  return{id:'n'+ci+','+cj+','+k,x,z,r:rad,t0:k*SINK_WIN+r()*(SINK_WIN-20000)};
}
/* a sinkhole made on demand (console / ENV). x,z,seed,t0 are the only numbers that cross the network -- every
   client re-derives the same radius from the same seed, same trick as spawnLandslide(). */
function spawnSinkhole(x,z,seed,t0){
  const r=mulberry32(seed>>>0);r();
  const rad=(SINK_R_MIN+r()*(SINK_R_MAX-SINK_R_MIN))*tune('env.sinkSize');   /* F2 slider: JT 2026-10-01 halved them */
  const id='s'+Math.round(x*10)+'_'+Math.round(z*10)+'_'+Math.round(t0);
  if(sinkSpawned.some(p=>p.id===id)||SINK_LIVE.has(id))return;
  sinkSpawned.push({id,x,z,r:rad,t0,forced:true});
}
ENV.sinkhole={spawn:o=>spawnSinkhole(o.x,o.z,(hash2(Math.round(o.x*10),Math.round(o.z*10))*4294967296)>>>0,o.t0!=null?o.t0:twNow())};
command('sinkhole',{usage:'sinkhole [distance]',help:'Warn, then open a big sinkhole [50] m ahead of you. Everyone sees it. A friend has to pull you out if you fall in.',
  run([d]){
    const dist=numArg(d,50,20,150),a=P.yaw+Math.PI;
    let x=clamp(P.x+Math.sin(a)*dist,-EDGE+16,EDGE-16),z=clamp(P.z+Math.cos(a)*dist,-EDGE+16,EDGE-16);
    for(let i=0;i<8&&(nearCampZone(x,z)||campDist(x,z)<SINK_CAMP_KEEPOUT);i++){x+=Math.sin(a)*20;z+=Math.cos(a)*20}   // nudge it off camp/the fence
    const o={x,z,a:Math.atan2(P.z-z,P.x-x)};
    spawnEnv('sinkhole',o);if(online())wsSend({t:'env',k:'sinkhole',...o});
    return`Sinkhole cracking open ${Math.round(Math.hypot(x-P.x,z-P.z))} m ahead.`;
  }});

/* register a big hole into every CELL it overlaps, not just the one under its centre. The terrain grid (15-terrain.js)
   assumes small holes -- forNearHoles() only checks the 3x3 cells around whoever's asking -- so a 10-14 m sinkhole
   needs to be findable from a query anywhere on its rim, not just from on top of its centre point. */
function sinkRegisterGrid(h){
  const c0x=cellOf(h.x-h.r),c1x=cellOf(h.x+h.r),c0z=cellOf(h.z-h.r),c1z=cellOf(h.z+h.r);
  for(let cx=c0x;cx<=c1x;cx++)for(let cz=c0z;cz<=c1z;cz++){const k=gkey(cx,cz);let L=grid.get(k);if(!L){L=[];grid.set(k,L)}if(!L.includes(h))L.push(h)}
}

/* the warning look: a darkening ring plus a few radiating cracks, both flat on the ground, opacity ramping with the
   countdown. Hidden again once the ground actually drops (the crater itself is the visual from then on). Built once
   per sinkhole instance and disposed when it's gone -- these are rare, big, one-at-a-time-ish events (unlike
   twisters), so a per-instance group is simpler than pooling and costs nothing noticeable. */
function makeSinkhole(id,x,z,r){
  const g=new T.Group();g.visible=false;scene.add(g);
  const ring=new T.Mesh(new T.RingGeometry(r*0.55,r*1.05,28),new T.MeshBasicMaterial({color:0x1a1006,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,fog:false}));
  ring.rotation.x=-Math.PI/2;g.add(ring);
  const cracks=[],cr=mulberry32((Math.abs(Math.round(x*10)^(Math.round(z*10)*7))>>>0));
  for(let i=0;i<7;i++){
    const a=cr()*Math.PI*2,len=r*(0.55+cr()*0.5);
    const m=new T.Mesh(new T.BoxGeometry(0.18,0.04,len),new T.MeshBasicMaterial({color:0x1a1006,transparent:true,opacity:0,fog:false}));
    m.position.set(Math.sin(a)*len*0.5,0.04,Math.cos(a)*len*0.5);m.rotation.y=-a;g.add(m);cracks.push(m);
  }
  return{id,x,z,r,g,ring,cracks,stage:'warn',warned:false,hole:null,myTrapT:0,fillT:0,holdT:0,soloBot:null};
}
function disposeSinkhole(sh){scene.remove(sh.g);sh.ring.geometry.dispose();sh.ring.material.dispose();for(const c of sh.cracks){c.geometry.dispose();c.material.dispose()}}

/* is anyone (me, or a remote flagged as sinkhole-trapped) still down in this crater? Checked locally from whatever
   this client can see -- good enough to keep every client from filling a sinkhole out from under someone, without
   needing the server to track it. */
function sinkStillOccupied(sh){
  if(inSinkhole()===sh)return true;
  for(const R of remotes.values())if((R.f&32)&&Math.hypot(R.p.g.position.x-sh.x,R.p.g.position.z-sh.z)<sh.r*0.85)return true;
  return false;
}
/* am I, right now, standing down inside an open sinkhole? Distance-to-centre AND depth-below-base both have to say
   so, the same two-part test isTrapped() uses for an ordinary deep hole (see 84-coop.js). */
function inSinkhole(){
  if(!S.started||S.ko||inTent())return null;
  if(sinkTrapped){const live=SINK_LIVE.get(sinkTrapped.id)===sinkTrapped&&(sinkTrapped.stage==='open'||sinkTrapped.stage==='settled'||sinkTrapped.stage==='filling');if(live)return sinkTrapped;sinkTrapped=null}
  if(!P.grounded)return null;
  for(const sh of SINK_LIVE.values()){
    if(sh.stage!=='open'&&sh.stage!=='settled'&&sh.stage!=='filling')continue;
    if(Math.hypot(P.x-sh.x,P.z-sh.z)<sh.r*0.82&&holeDepthHere()>SINK_TRAP_DEPTH)return sh;
  }
  return null;
}
/* haul the local player up onto the rim, in whatever direction they're already offset from the centre (same idea as
   popOut() for an ordinary hole). Also cleans up a mid-rescue solo bot, if Zach was on his way or already pulling. */
function popOutOfSinkhole(sh,by){
  sinkTrapped=null;
  if(sh.soloBot){const b=sh.soloBot;b.sinkOverride=null;b.state='return';b.tx=b.hole.x;b.tz=b.hole.z;b.p.upper.rotation.x=0;b.p.armR.rotation.x=0;sh.soloBot=null}
  const dx=P.x-sh.x,dz=P.z-sh.z,d=Math.hypot(dx,dz)||1;
  P.x=sh.x+dx/d*(sh.r*0.92);P.z=sh.z+dz/d*(sh.r*0.92);P.y=groundAt(P.x,P.z);P.vy=0;P.grounded=true;
  me.armL.rotation.x=0;me.armR.rotation.x=0;me.upper.rotation.x=0;sinkRescueT=0;sh.myTrapT=0;sfx.thud();
  if(by)toast(`${by} pulled you up onto the rim.`,'good',2800);
  logEv('sinkPulled',{by:by||'',x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
}

/* ---- solo fallback: with nobody else online, Zach (D Tent's fastest digger) comes with a line instead ---- *
   He "arrives" from SINK_SOLO_APPROACH_R out (not literally from his own hole clear across the map) so the whole
   fallback resolves in a bounded, predictable time -- worse than a friend, never a softlock. b.sinkOverride, set
   here, tells updateBots() (30-npcs.js) to leave this bot alone while it's set; updateSoloRescues() below drives it. */
function startSoloRescue(sh){
  const hired=bots.filter(b=>crewHired(b)),zero=hired.find(b=>b.d.n==='Zach')||hired[0]||bots.find(b=>b.d.n==='Zach');if(!zero||zero.sinkOverride)return;   // Zach comes even if he's not on the crew yet: never a softlock
  zero.p.g.visible=true;zero.L.el.style.display='';
  const a=Math.atan2(sh.x,sh.z-39)||0.001;   // roughly "away from camp", so he visibly walks in from outside
  const sx=sh.x+Math.sin(a)*(sh.r+SINK_SOLO_APPROACH_R),sz=sh.z+Math.cos(a)*(sh.r+SINK_SOLO_APPROACH_R);
  zero.sinkOverride={stage:'walk',tx:sh.x+Math.sin(a)*(sh.r*0.7),tz:sh.z+Math.cos(a)*(sh.r*0.7),t:0};
  zero.p.g.position.set(sx,groundAt(sx,sz),sz);
  sh.soloBot=zero;
  toast('Nobody else is around to pull you out... but Zach heard you and is coming with a line.','good',5000);
  logEv('sinkSolo',{x:+sh.x.toFixed(1),z:+sh.z.toFixed(1)});
}
function updateSoloRescues(dt){
  for(const b of bots){
    const o=b.sinkOverride;if(!o)continue;
    const g=b.p.g;
    const targetSh=[...SINK_LIVE.values()].find(s=>s.soloBot===b);
    if(!targetSh){b.sinkOverride=null;continue}   // the crater filled/emptied from under him somehow -- bail cleanly
    if(o.stage==='walk'){
      const dx=o.tx-g.position.x,dz=o.tz-g.position.z,d=Math.hypot(dx,dz);
      if(d<0.4){o.stage='pull';o.t=0}
      else{const s=Math.min(d,dt*SINK_SOLO_WALK_SPEED);g.position.x+=dx/d*s;g.position.z+=dz/d*s;g.rotation.y=Math.atan2(dx,dz);g.position.y=groundAt(g.position.x,g.position.z);animPerson(b.p,1,dt)}
    }else if(o.stage==='pull'){
      o.t+=dt;g.rotation.y=Math.atan2(targetSh.x-g.position.x,targetSh.z-g.position.z);
      b.p.upper.rotation.x=lerp(b.p.upper.rotation.x,0.5,Math.min(1,dt*SINK_POSE_K));b.p.armR.rotation.x=lerp(b.p.armR.rotation.x,1.3,Math.min(1,dt*SINK_POSE_K));
      if(o.t>=SINK_SOLO_PULL_TIME){
        popOutOfSinkhole(targetSh,'Zach');
        toast('Zach pulled you out with the line. "I like digging holes. Not falling in them."','good',3800);
        logEv('sinkSoloRescued',{x:+targetSh.x.toFixed(1),z:+targetSh.z.toFixed(1)});
      }
    }
  }
}

function sinkSound(level){
  if(!AC)return;
  if(!sinkRumbleNode){const src=AC.createBufferSource();src.buffer=noiseBuf;src.loop=true;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=90;sinkRumbleNode=AC.createGain();sinkRumbleNode.gain.value=0;src.connect(f).connect(sinkRumbleNode).connect(fxBus);src.start()}
  sinkRumbleNode.gain.setTargetAtTime(level*0.6,AC.currentTime,0.25);
}

/* step one live sinkhole: warning visuals -> collapse the terrain -> sit open -> (once clear) fill back in */
function advanceSinkhole(sh,e,dt,fx,fz){
  const g=groundAt(sh.x,sh.z);
  if(sh.stage!=='filling'&&sh.stage!=='gone'){
    if(e<SINK_WARN_TIME)sh.stage='warn';
    else if(e<SINK_WARN_TIME+SINK_OPEN_TIME)sh.stage='open';
    else if(e<SINK_WARN_TIME+SINK_OPEN_TIME+SINK_LIFETIME)sh.stage='settled';
    else sh.stage='filling';
  }
  const dist=Math.hypot(sh.x-fx,sh.z-fz);
  if(sh.stage==='warn'){
    const u=e/SINK_WARN_TIME;
    if(!sh.warned&&S.started&&dist<SINK_WARN_R){sh.warned=true;logEv('sinkWarn',{x:+P.x.toFixed(1),z:+P.z.toFixed(1),shx:+sh.x.toFixed(1),shz:+sh.z.toFixed(1),dist:+dist.toFixed(1)});toast(`The ground is shaking to the ${compass(sh.x-P.x,sh.z-P.z)}!`,'bad',6000)}
    sh.g.visible=true;sh.g.position.set(sh.x,g+0.03,sh.z);
    const op=0.12+0.6*u;sh.ring.material.opacity=op;for(const c of sh.cracks)c.material.opacity=op*0.9;
    if(S.started&&dist<sh.r*2.2&&Math.random()<dt*2.4)puff(sh.x+(Math.random()-0.5)*sh.r*1.2,g+0.15,sh.z+(Math.random()-0.5)*sh.r*1.2,sh.x,sh.z,2);
    return{loud:dist<SINK_WARN_R*1.4?u*clamp(1-dist/(SINK_WARN_R*1.4),0,1):0,shakeD:dist,shakeK:0.5+0.5*u};
  }
  sh.g.visible=false;
  // Create the terrain hole the first time it's needed, whichever stage we first meet it in -- a late joiner can
  // discover a sinkhole already mid-fill (rare, but the last few seconds of its life), and it still needs a crater
  // under it rather than silently having none at all (sh.hole stays null forever otherwise).
  if(!sh.hole&&sh.stage!=='warn'){sh.hole=addHole({x:sh.x,z:sh.z,d:sh.stage==='filling'?SINK_DEPTH:0,r:sh.r,sink:true,noMound:true});sinkRegisterGrid(sh.hole);
    logEv('sinkOpen',{x:+sh.x.toFixed(1),z:+sh.z.toFixed(1),r:+sh.r.toFixed(1)});
    if(dist<sh.r*2&&sh.stage!=='filling')puff(sh.x,g+0.4,sh.z,sh.x,sh.z,14);
  }
  if(sh.stage==='open'||sh.stage==='settled'){
    const u=sh.stage==='open'?clamp((e-SINK_WARN_TIME)/SINK_OPEN_TIME,0,1):1;   // 0..1 through the drop
    const targetD=SINK_DEPTH*sm(u);
    if(Math.abs(sh.hole.d-targetD)>0.3||u>=1){sh.hole.d=targetD;touchHole(sh.hole);if(sh.stage==='open'&&Math.random()<dt*6&&dist<sh.r*2)puff(sh.x+(Math.random()-0.5)*sh.r,g,sh.z+(Math.random()-0.5)*sh.r,sh.x,sh.z,3)}
    return{loud:sh.stage==='open'?clamp(1-dist/90,0,1):0,shakeD:dist,shakeK:sh.stage==='open'?1.6:0};
  }
  if(sh.stage==='filling'){
    if(sinkStillOccupied(sh)){
      // If it's ME still down there, force me out after a while (AFK safety net -- the world should never wait
      // forever). If it's a REMOTE camper, there's nothing to force from here: their own client runs this exact
      // same check against their own inSinkhole(), so it force-empties them (and clears their broadcast flag) on
      // its own after the same timeout -- this client will simply see the flag drop and resume filling then.
      sh.holdT+=dt;
      if(sh.holdT>SINK_FORCE_EMPTY_AFTER&&inSinkhole()===sh){popOutOfSinkhole(sh,'');sh.holdT=0}
      return{loud:0,shakeD:dist,shakeK:0};
    }
    sh.holdT=0;
    sh.fillT+=dt;const u=clamp(sh.fillT/SINK_FILL_TIME,0,1),targetD=SINK_DEPTH*(1-sm(u));
    if(sh.hole&&Math.abs(sh.hole.d-targetD)>0.15){sh.hole.d=Math.max(0,targetD);touchHole(sh.hole)}
    if(u>=1){sh.stage='gone';logEv('sinkFilled',{x:+sh.x.toFixed(1),z:+sh.z.toFixed(1)})}
    return{loud:0,shakeD:dist,shakeK:0};
  }
  return{loud:0,shakeD:1e9,shakeK:0};
}

function updateSinkholes(dt){
  if(!S.started){updateSoloRescues(dt);return}
  if(ZONE_H){for(const[id,sh]of SINK_LIVE){disposeSinkhole(sh);if(sh.hole){const i=holes.indexOf(sh.hole);if(i>=0)holes.splice(i,1)}SINK_LIVE.delete(id)}return}   // sinkholes are the lake's (88-zones.js)
  const T0=twNow(),k=Math.floor(T0/SINK_WIN),fx=P.x,fz=P.z;
  const CMAX=Math.ceil(EDGE/SINK_CELL)+1,plans=[];
  if(!DIRECTOR_ON)for(let i=-CMAX;i<=CMAX;i++)for(let j=-CMAX;j<=CMAX;j++)for(const kk of[k-1,k]){const pl=sinkPlan(i,j,kk);if(pl)plans.push(pl)}   // natural ones only when the event director is off
  plans.push(...sinkSpawned);
  let loud=0,nearestShakeD=1e9,shakeK=0;
  const seen=new Set();
  for(const pl of plans){
    const e=(T0-pl.t0)/1000;if(e<0)continue;
    seen.add(pl.id);
    let sh=SINK_LIVE.get(pl.id);
    if(!sh){
      if(!pl.forced&&nightF()>0.3)continue;   // only start natural ones during the day; try again another window
      sh=makeSinkhole(pl.id,pl.x,pl.z,pl.r);SINK_LIVE.set(pl.id,sh);
    }
    if(sh.stage==='gone')continue;
    const r=advanceSinkhole(sh,e,dt,fx,fz);
    loud=Math.max(loud,r.loud);
    if(r.shakeK>0&&r.shakeD<nearestShakeD){nearestShakeD=r.shakeD;shakeK=r.shakeK}
  }
  for(const[id,sh]of SINK_LIVE)if(!seen.has(id)||sh.stage==='gone'){if(sh.soloBot){sh.soloBot.sinkOverride=null;sh.soloBot=null}disposeSinkhole(sh);sinkSpawned=sinkSpawned.filter(p=>p.id!==id);SINK_LIVE.delete(id)}
  sinkSound(loud);
  if(!inTent()&&nearestShakeD<45){const a=clamp(1-nearestShakeD/45,0,1)*0.1*shakeK;camera.position.x+=(Math.random()-0.5)*a;camera.position.y+=(Math.random()-0.5)*a}

  /* ---- am I trapped? fall-in slide + reach-up pose + tallying rescuers + the solo fallback ---- */
  // Another hazard grabbing you (twister, tumbleweed, vulture) or a knockout frees you from the crater; so does
  // anything that moved you well outside it (a console tp, a respawn).
  if(sinkTrapped&&(S.ko||twSt||tbSt||vSt||Math.hypot(P.x-sinkTrapped.x,P.z-sinkTrapped.z)>sinkTrapped.r))sinkTrapped=null;
  const sh=inSinkhole();
  if(sh&&!sinkTrapped)sinkTrapped=sh;
  if(sh){   // hold you on the crater floor: no walking, sprinting or jumping up the wall
    const dx=P.x-sh.x,dz=P.z-sh.z,d=Math.hypot(dx,dz),maxR=sh.r*SINK_FLOOR_FRAC;
    if(d>maxR){P.x=sh.x+dx/d*maxR;P.z=sh.z+dz/d*maxR}
    const gy=groundAt(P.x,P.z);if(P.y>gy+0.05||d>maxR){P.y=gy;P.vy=0;P.grounded=true}
    me.g.position.set(P.x,P.y,P.z);
  }
  if(sh&&sh!==sinkPrevSh){sinkFallSlideT=SINK_SLIDE_TIME;sfx.thud();toast('You fell into a sinkhole! The walls are too steep to climb. A friend at the rim can hold E to pull you out.','bad',6000);logEv('sinkFellIn',{x:+P.x.toFixed(1),z:+P.z.toFixed(1)})}
  sinkPrevSh=sh;
  if(sh){
    if(sinkFallSlideT>0){sinkFallSlideT-=dt;const dx=sh.x-P.x,dz=sh.z-P.z,d=Math.hypot(dx,dz);if(d>0.3){const s=Math.min(d,dt*3.2);P.x+=dx/d*s;P.z+=dz/d*s;P.y=groundAt(P.x,P.z)}}
    me.armL.rotation.x=lerp(me.armL.rotation.x,-2.7,Math.min(1,dt*SINK_POSE_K));me.armR.rotation.x=lerp(me.armR.rotation.x,-2.7,Math.min(1,dt*SINK_POSE_K));me.upper.rotation.x=lerp(me.upper.rotation.x,-0.22,Math.min(1,dt*SINK_POSE_K));
    sh.myTrapT+=dt;
    let helpers=0;for(const R of remotes.values())if((R.f&64)&&Math.hypot(R.p.g.position.x-P.x,R.p.g.position.z-P.z)<SINK_RESCUE_R+2)helpers++;
    if(helpers>0){
      sinkRescueT+=dt*(1+Math.min(helpers-1,SINK_MAX_CHAIN-1)*SINK_CHAIN_BONUS);   // more hands linked on = faster (capped)
      if(sinkRescueT>=SINK_RESCUE_TIME){
        for(const[rid,R]of remotes)if((R.f&64)&&Math.hypot(R.p.g.position.x-P.x,R.p.g.position.z-P.z)<SINK_RESCUE_R+2)wsSend({t:'sinkpull',id:rid});
        popOutOfSinkhole(sh,helpers>1?'Your friends':'A friend');
      }
    }else sinkRescueT=0;
    if(!othersOnline()&&!sh.soloBot&&sh.myTrapT>=SINK_SOLO_WAIT)startSoloRescue(sh);
  }else{
    sinkRescueT=0;
    for(const b of bots)if(b.sinkOverride){b.p.upper.rotation.x=lerp(b.p.upper.rotation.x,0,dt*4);b.p.armR.rotation.x=lerp(b.p.armR.rotation.x,0,dt*4)}
  }

  /* ---- am I rescuing someone? hold E or F at the rim of a sinkhole-trapped friend to link hands (E is also dig,
     but scoop() in 45-state.js skips digging while a trapped friend is in reach, so E pulls instead) ---- */
  const target=!S.ko&&!uiOpen()&&!sh&&(KEYS['f']||KEYS['e'])?remoteNear(R=>R.f&32,SINK_RESCUE_R):null;
  sinkPulling=!!target;
  if(target){me.upper.rotation.x=lerp(me.upper.rotation.x,0.5,Math.min(1,dt*SINK_POSE_K));me.armR.rotation.x=lerp(me.armR.rotation.x,1.3,Math.min(1,dt*SINK_POSE_K))}
  else if(!sh){me.upper.rotation.x=lerp(me.upper.rotation.x,0,dt*4);me.armR.rotation.x=lerp(me.armR.rotation.x,0,dt*4)}

  /* ---- pose remote campers the same way, from the flags they broadcast (bit 32 trapped, bit 64 pulling) ---- */
  for(const R of remotes.values()){
    if(R.f&32){R.p.armL.rotation.x=lerp(R.p.armL.rotation.x,-2.7,Math.min(1,dt*SINK_POSE_K));R.p.armR.rotation.x=lerp(R.p.armR.rotation.x,-2.7,Math.min(1,dt*SINK_POSE_K));R.p.upper.rotation.x=lerp(R.p.upper.rotation.x,-0.22,Math.min(1,dt*SINK_POSE_K))}
    else if(R.f&64){R.p.upper.rotation.x=lerp(R.p.upper.rotation.x,0.5,Math.min(1,dt*SINK_POSE_K));R.p.armR.rotation.x=lerp(R.p.armR.rotation.x,1.3,Math.min(1,dt*SINK_POSE_K))}
  }
  updateSoloRescues(dt);
}
/* HUD text for the trapped player's own prompt (shown from 78-hud.js; no interaction of their own, just status) */
function sinkTrappedText(sh){
  if(sh.soloBot)return sh.soloBot.sinkOverride&&sh.soloBot.sinkOverride.stage==='pull'?'Zach is pulling you up…':'Zach is on his way with a line…';
  if(sinkRescueT>0)return`Being pulled up… ${Math.round(clamp(sinkRescueT/SINK_RESCUE_TIME,0,1)*100)}%`;
  if(!othersOnline())return`Too steep to climb. Nobody else is around; someone will come find you in ${Math.max(0,Math.ceil(SINK_SOLO_WAIT-sh.myTrapT))}s.`;
  return'Too steep and loose to climb. A friend has to come to the rim and hold E (or F) to link hands and pull you up.';
}
