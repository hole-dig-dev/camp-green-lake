'use strict';
/* public/js/89-town-light.js -- the buried town's light and air (2026-11-11). What was a flat circle on a black screen:
   - the flashlight is a real cone in the world down here: soft-edged, held a little right of and below your eyes so
     surfaces show their angle, fading with distance (decay 2), dimming and flickering as the battery runs out;
     a faint bounce near you, and dust that only shows where a beam passes through it;
   - every opening to the surface (your break-in shaft, the old well, the stairwell) pours daylight down, with dust
     turning in it: by day a warm column you can see from down the street, at night a thin blue moonlit one. You find
     your way out by them;
   - old lanterns (one in every building, by each porch, in the long tunnels: sim.js townLamps). F lights one, and it
     stays lit for the whole crew for the rest of the run (the server holds them: sim.js townApply 'tlamp'). The nearest
     few lit ones throw real light (a pool of TOWN_POOL point lights, so the shaders never recompile), the rest glow;
   - sand trickles from the ceiling now and then with a hiss; the timbers creak; a low room tone; footsteps knock on
     boards and hush on sand.
   F2 > Town has the knobs. */
const TOWN_POOL=5;          // lit lanterns near you that cast real light (the rest just glow): more costs every pixel
const TOWN_FL_HAND=[0.28,-0.32];
const TOWN_FL_REACH=22,TOWN_FL_DECAY=1.7;   // the beam's reach and falloff underground (three's non-physical lights: (1-d/reach)^decay)   // the flashlight sits this far right of and below your eyes (m), so lit faces have an angle
const TOWN_DUST_N=700,TOWN_DUST_BOX=18;   // drifting dust motes, in a box this wide that moves with you
const TOWN_TRICKLES=4,TOWN_TRICKLE_N=48;  // sand streams at once, grains in each
const TL={glow:null,lamps:[],pool:[],bounce:null,shafts:[],shaftKey:'',dust:null,trk:null,trickles:[],trkT:4,creakT:9,tone:null,ready:false};

/* ---- lanterns: where (placed with the rest of the town's pieces), and the glow of the lit ones ---- */
function townLightPlace(L,put){
  TL.lamps=SIM.townLamps();
  TL.lamps.forEach(l=>{
    if(l.hook){put('TownLantern',l.x,l.z,l.ry,l.y);put('TownLanternHook',l.x-Math.sin(l.ry)*0.38,l.z-Math.cos(l.ry)*0.38,l.ry,l.y-1.55)}
    else put('TownLantern',l.x,l.z,l.ry,l.y);
  });
}
const GLOW_VS=`attribute float lit;attribute float seed;uniform float uT;varying float vA;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float f=0.86+0.1*sin(uT*7.3+seed*11.)+0.05*sin(uT*17.1+seed*3.);
vA=lit*f;gl_PointSize=lit>0.5?(150.*f)/max(0.5,-mv.z):0.;gl_Position=projectionMatrix*mv;}`;
const GLOW_FS=`varying float vA;void main(){vec2 c=gl_PointCoord-0.5;float d=length(c)*2.;if(d>1.)discard;
float a=vA*(pow(1.-d,3.)*1.4+smoothstep(0.25,0.,d)*1.6);gl_FragColor=vec4(vec3(2.6,1.5,0.55)*a,1.);}`;
function townLightBuild(grp,L){
  TL.lamps=SIM.townLamps();
  const n=TL.lamps.length,pos=new Float32Array(n*3),lit=new Float32Array(n),seed=new Float32Array(n);
  TL.lamps.forEach((l,i)=>{pos[i*3]=tx(l.x);pos[i*3+1]=TW.Y+l.y+0.19;pos[i*3+2]=tz(l.z);seed[i]=i*0.37});
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('lit',new T.BufferAttribute(lit,1));g.setAttribute('seed',new T.BufferAttribute(seed,1));
  const glow=new T.Points(g,new T.ShaderMaterial({vertexShader:GLOW_VS,fragmentShader:GLOW_FS,uniforms:{uT:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  glow.frustumCulled=false;glow.userData.own=true;grp.add(glow);TL.glow=glow;
  TL.pool=[];for(let i=0;i<TOWN_POOL;i++){const p=new T.PointLight(0xffa850,0,10,2);p.userData.lamp=-1;grp.add(p);TL.pool.push(p)}
  TL.bounce=new T.PointLight(0xffe2b0,0,7,2);grp.add(TL.bounce);
  // the daylight: three spotlights at most (a shaft, the well, the stairwell), made now so the light count never changes
  TL.shafts=[];TL.shaftKey='';for(let i=0;i<3;i++){const s=new T.SpotLight(0xffe8c0,0,18,0.5,0.7,1.4);grp.add(s,s.target);TL.shafts.push({light:s,beam:null,sky:null,on:false})}
  townDustBuild(grp);townTrickleBuild(grp);
  townLightState(null);TL.ready=true;
}
function townLightState(m){
  if(!TL.glow)return;const a=TL.glow.geometry.attributes.lit;
  for(let i=0;i<a.count;i++)a.array[i]=TST.lit.includes(i)?1:0;a.needsUpdate=true;
  if(m&&m.t==='tlamp'&&S.inTown){const l=TL.lamps[m.i];townStrike(l);
    if(m.by!==(S.name||'You')){const b=l&&l.b>=0?townLay().bldgs[l.b]:null;toast(`${m.by} lit a lantern${b?' in the '+b.name:''}.`,'',2600)}}
}
function townLampPos(l){return{x:tx(l.x),y:TW.Y+l.y+0.19,z:tz(l.z)}}
function townStrike(l){if(!l)return;const p=townLampPos(l),d=Math.hypot(p.x-P.x,p.z-P.z);if(d>25)return;const v=Math.max(0.1,1-d/25);
  noise(0.18,2400,0.7,0.12*v,'highpass');setTimeout(()=>noise(0.7,600,0.6,0.07*v,'lowpass'),120)}   // a match struck, then the wick catching
/* F by an unlit lantern */
function townLightSpot(){
  let best=null,bd=2.4;
  TL.lamps.forEach((l,i)=>{if(TST.lit.includes(i))return;const p=townLampPos(l),d=Math.hypot(p.x-P.x,p.z-P.z);if(d<bd){bd=d;best={id:'townLamp',i,label:'Light the old lantern'}}});
  return best;
}
function townLightUse(s){
  if(s.id!=='townLamp')return false;
  townAct({t:'tlamp',i:s.i});if(online())townStrike(TL.lamps[s.i]);   // solo hears it from townLightState
  return true;
}

/* ---- the daylight down the openings ---- */
const BEAM_VS=`varying vec3 vN,vV;varying float vY;uniform float uH;void main(){vec4 w=modelMatrix*vec4(position,1.);vY=position.y/uH+0.5;
vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`;
const BEAM_FS=`varying vec3 vN,vV;varying float vY;uniform vec3 uC;uniform float uA;void main(){
float edge=pow(abs(dot(vN,vV)),1.8);float a=uA*edge*(0.2+0.8*smoothstep(0.05,1.,vY))*smoothstep(0.,0.25,vY);
gl_FragColor=vec4(uC*a,1.);}`;
function townOpenings(){   // the openings to the sky: [{x,z,top,r,tilt}] in world coordinates
  const L=townLay(),out=[],seen=new Set();
  for(const[k,b]of BREACH){const p=shaftPos(b),key=Math.round(p.x)+'|'+Math.round(p.z);if(seen.has(key))continue;seen.add(key);out.push({x:p.x,z:p.z,top:TW.STREET.h,r:0.95,lean:0})}   // every breach lands in one spot
  const w=L.bldgs[L.well];out.push({x:tx(w.x),z:tz(w.z),top:TW.H+0.3,r:0.8,lean:0});
  out.push({x:tx(L.stair.x)-1.5,z:tz(L.stair.z),top:TW.STREET.h,r:1.3,lean:0.42});   // the stairwell: light slants in from the west, up the steps
  return out.slice(0,3);
}
function townShaftsBuild(){
  const ops=townOpenings(),key=ops.map(o=>o.x.toFixed(0)+o.z.toFixed(0)).join(',');if(key===TL.shaftKey)return;TL.shaftKey=key;
  TL.shafts.forEach((s,i)=>{
    if(s.beam){townGroup.remove(s.beam);s.beam.geometry.dispose()}if(s.sky){townGroup.remove(s.sky);s.sky.geometry.dispose()}s.beam=s.sky=null;
    const o=ops[i];s.on=!!o;s.o=o;if(!o){s.light.intensity=0;return}
    const H=o.top+2.5,geo=new T.CylinderGeometry(o.r*0.8,o.r*1.5,H,24,1,true);
    const mat=new T.ShaderMaterial({vertexShader:BEAM_VS,fragmentShader:BEAM_FS,uniforms:{uH:{value:H},uC:{value:new T.Color()},uA:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
    const b=new T.Mesh(geo,mat);b.position.set(o.x,TW.Y+H/2,o.z);b.rotation.z=o.lean;if(o.lean)b.position.x-=Math.sin(o.lean)*H/2*0.6;b.frustumCulled=false;b.renderOrder=5;b.userData.own=true;townGroup.add(b);s.beam=b;
    const sky=new T.Mesh(new T.CircleGeometry(o.r*0.9,18),new T.MeshBasicMaterial({color:0xffffff,fog:false}));sky.rotation.x=Math.PI/2;
    sky.position.set(o.x-(o.lean?Math.sin(o.lean)*o.top*0.7:0),TW.Y+o.top-0.08,o.z);sky.userData.own=true;townGroup.add(sky);s.sky=sky;
    s.light.position.set(o.x-(o.lean?3:0),TW.Y+o.top+3,o.z);s.light.target.position.set(o.x+(o.lean?1.5:0),TW.Y,o.z);s.light.target.updateMatrixWorld();
  });
}
function townShaftsUpdate(){
  const night=nightF(),k=tune('town.shaft');
  const day=new T.Color(1.0,0.86,0.62),moon=new T.Color(0.42,0.55,0.85),c=day.clone().lerp(moon,night);
  for(const s of TL.shafts){if(!s.on)continue;
    s.light.color.copy(c);s.light.intensity=k*(5.5-4*night);s.light.angle=s.o.lean?0.62:0.36;s.light.penumbra=0.8;s.light.distance=s.o.top+8;
    s.beam.material.uniforms.uC.value.copy(c).multiplyScalar(1.6-0.9*night);s.beam.material.uniforms.uA.value=k*(0.6-0.35*night);
    s.sky.material.color.copy(c).multiplyScalar(3.2-2.3*night)}   // the hole to the sky: brighter than white, so it blooms
}

/* ---- dust: motes that drift in a box around you, visible only where a beam (your flashlight, a friend's, a shaft) or a
   lit lantern catches them ---- */
const DUST_VS=`attribute vec3 seed;uniform float uT,uBox;uniform vec3 uCam,uFP,uFD;uniform float uFC,uFOn;uniform vec4 uSh[3];uniform vec4 uLamp[${TOWN_POOL}];varying float vA;
void main(){vec3 d=seed*uBox+vec3(sin(uT*0.13+seed.y*40.)*0.6,-uT*0.05,cos(uT*0.11+seed.x*30.)*0.6);
vec3 p=uCam+mod(d-uCam,uBox)-uBox*0.5;p.y=uCam.y+mod(d.y-uCam.y+2.,6.)-2.;
vec3 v=p-uFP;float dl=length(v);float cone=uFOn*smoothstep(uFC-0.06,uFC+0.03,dot(v/dl,uFD))*clamp(1.-dl/14.,0.,1.);
float sh=0.;for(int i=0;i<3;i++){float r=length(p.xz-uSh[i].xy);sh+=uSh[i].w*smoothstep(uSh[i].z,uSh[i].z*0.6,r);}
float lp=0.;for(int i=0;i<${TOWN_POOL};i++){lp+=uLamp[i].w*clamp(1.-length(p-uLamp[i].xyz)/2.2,0.,1.);}
vA=clamp(cone*1.2+sh+lp*0.5,0.,1.6);vec4 mv=viewMatrix*vec4(p,1.);gl_PointSize=vA>0.01?min(9.,(0.5+seed.z*1.2)*6./max(0.6,-mv.z)):0.;gl_Position=projectionMatrix*mv;}`;
const DUST_FS=`varying float vA;uniform float uK;void main(){vec2 c=gl_PointCoord-0.5;float d=length(c)*2.;if(d>1.)discard;gl_FragColor=vec4(vec3(1.1,0.95,0.75)*vA*uK*(1.-d),1.);}`;
function townDustBuild(grp){
  const seed=new Float32Array(TOWN_DUST_N*3);for(let i=0;i<seed.length;i++)seed[i]=Math.random();
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(TOWN_DUST_N*3),3));g.setAttribute('seed',new T.BufferAttribute(seed,3));
  const u={uT:{value:0},uBox:{value:TOWN_DUST_BOX},uCam:{value:new T.Vector3()},uFP:{value:new T.Vector3()},uFD:{value:new T.Vector3(0,0,-1)},uFC:{value:0.9},uFOn:{value:0},uK:{value:1},
    uSh:{value:[0,1,2].map(()=>new T.Vector4())},uLamp:{value:[...Array(TOWN_POOL)].map(()=>new T.Vector4())}};
  const d=new T.Points(g,new T.ShaderMaterial({vertexShader:DUST_VS,fragmentShader:DUST_FS,uniforms:u,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  d.frustumCulled=false;d.userData.own=true;d.renderOrder=6;grp.add(d);TL.dust=d;
}

/* ---- sand trickling from the ceiling: a stream of grains that falls for a few seconds, then stops ---- */
const TRK_VS=`attribute vec2 seed;uniform vec4 uS[${TOWN_TRICKLES}];uniform vec2 uY[${TOWN_TRICKLES}];uniform float uT;uniform vec3 uFP,uFD;uniform float uFC,uFOn;varying float vA;
void main(){int k=int(seed.x);vec4 s=uS[0];vec2 yy=uY[0];for(int i=1;i<${TOWN_TRICKLES};i++){if(i==k){s=uS[i];yy=uY[i];}}
float age=uT-s.w;float f=fract(seed.y+age*0.9);float on=step(0.,age)*step(age,s.z)+step(s.z,age)*step(age,s.z+1.2)*step(f,1.-(age-s.z)/1.2);
vec3 p=vec3(s.x+sin(seed.y*60.)*0.03,mix(yy.x,yy.y,f*f),s.y+cos(seed.y*50.)*0.03);vec3 v=p-uFP;float dl=length(v);
float lit=0.1+uFOn*smoothstep(uFC-0.08,uFC+0.02,dot(v/dl,uFD))*clamp(1.-dl/16.,0.,1.);
vA=on*lit;vec4 mv=viewMatrix*vec4(p,1.);gl_PointSize=on>0.?30./max(0.6,-mv.z):0.;gl_Position=projectionMatrix*mv;}`;
const TRK_FS=`varying float vA;void main(){vec2 c=gl_PointCoord-0.5;if(length(c)>0.5)discard;gl_FragColor=vec4(vec3(0.85,0.7,0.48)*vA,min(1.,vA*3.));}`;
function townTrickleBuild(grp){
  const n=TOWN_TRICKLES*TOWN_TRICKLE_N,seed=new Float32Array(n*2);for(let i=0;i<n;i++){seed[i*2]=Math.floor(i/TOWN_TRICKLE_N);seed[i*2+1]=(i%TOWN_TRICKLE_N)/TOWN_TRICKLE_N+Math.random()*0.02}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('seed',new T.BufferAttribute(seed,2));
  const u={uS:{value:[...Array(TOWN_TRICKLES)].map(()=>new T.Vector4(0,0,0,-99))},uY:{value:[...Array(TOWN_TRICKLES)].map(()=>new T.Vector2())},uT:{value:0},uFP:{value:new T.Vector3()},uFD:{value:new T.Vector3()},uFC:{value:0.9},uFOn:{value:0}};
  const t=new T.Points(g,new T.ShaderMaterial({vertexShader:TRK_VS,fragmentShader:TRK_FS,uniforms:u,transparent:true,depthWrite:false}));
  t.frustumCulled=false;t.userData.own=true;grp.add(t);TL.trk=t;TL.trickles=[...Array(TOWN_TRICKLES)].map(()=>({end:0}));
}
function townTrickle(now){   // a new stream somewhere near you, under the ceiling
  const slot=TL.trickles.findIndex(t=>now>t.end);if(slot<0)return;
  const sag=TD.sags.find((s,i)=>!TST.caves[i]&&Math.hypot(tx(s.x)-P.x,tz(s.z)-P.z)<16);   // the creaky ceilings (89-town-danger.js) give themselves away
  for(let k=0;k<8;k++){const a=Math.random()*6.283,d=2+Math.random()*9,near=sag&&Math.random()<0.6,x=near?tx(sag.x)+(Math.random()-0.5)*1.6:P.x+Math.cos(a)*d,z=near?tz(sag.z)+(Math.random()-0.5)*1.6:P.z+Math.sin(a)*d,w=townWhere(x,z,true);if(!w)continue;
    const dur=2.5+Math.random()*4,top=TW.Y+(w.h||TW.TUN_H)-0.1,u=TL.trk.material.uniforms;
    u.uS.value[slot].set(x,z,dur,now);u.uY.value[slot].set(top,TW.Y);TL.trickles[slot]={end:now+dur+1.2,x,z};
    const v=Math.max(0,1-d/12);noise(dur*0.8,5200,0.6,0.05*v,'highpass');setTimeout(()=>{if(S.inTown)puff(x,TW.Y+0.05,z,x,z,4)},dur*500);   // the hiss, and a little puff where it lands
    return}
}

/* ---- sound: a low room tone while you're down here, and the timbers now and then ---- */
function townToneOn(on){
  if(!AC)return;
  if(on&&!TL.tone){const s=AC.createBufferSource();s.buffer=noiseBuf;s.loop=true;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=140;const g=AC.createGain();g.gain.value=0;
    s.connect(f).connect(g).connect(fxBus);s.start();g.gain.setTargetAtTime(0.09*tune('vol.synth'),AC.currentTime,1.5);TL.tone={s,g}}
  else if(!on&&TL.tone){const t=TL.tone;TL.tone=null;t.g.gain.setTargetAtTime(0,AC.currentTime,0.3);setTimeout(()=>{try{t.s.stop()}catch(e){}},1500)}
}
function townCreak(){const f=60+Math.random()*50,v=0.03+Math.random()*0.03;tone(f,0.9,'sawtooth',v,f*0.8);noise(0.6,320+Math.random()*200,4,v*0.8);if(Math.random()<0.4)setTimeout(()=>tone(f*1.3,0.5,'sawtooth',v*0.7,f),700)}
/* footsteps (40-fx.js asks): boards in the wooden buildings and on the boardwalks, stone in the bank, jail, cellar and vault, sand elsewhere */
const TOWN_STONE=new Set(['bank','jail','cellar','vault']);
function townStepKind(){const w=townWhere(P.x,P.z,true);if(w&&w.b)return TOWN_STONE.has(w.b.key)||w.b.key==='well'?'stone':'board';
  return Math.abs(P.z-tz(0))>5.6&&w&&w.name==='Main Street'?'board':'sand'}

/* ---- every frame while you're down here ---- */
const _tlV=new T.Vector3(),_tlR=new T.Vector3();
function townLightUpdate(dt){
  if(!TL.ready)return;const now=performance.now()/1000;
  townShaftsBuild();townShaftsUpdate();if(!TL.tone)townToneOn(true);
  // the flashlight: from your hand, a soft cone, real falloff; the battery's last 15% dims and stutters
  camera.getWorldDirection(_tlV);_tlR.set(-_tlV.z,0,_tlV.x).normalize();
  const on=S.light&&!S.ko,bt=S.batt/100,flick=bt<0.15?(0.55+0.45*Math.max(0,Math.sin(now*23)*Math.sin(now*7.1)+0.4))*(0.4+bt*4):1;
  const f=FL[0],hx=camera.position.x+_tlR.x*TOWN_FL_HAND[0]+_tlV.x*0.2,hy=camera.position.y+TOWN_FL_HAND[1],hz=camera.position.z+_tlR.z*TOWN_FL_HAND[0]+_tlV.z*0.2;
  f.intensity=on?tune('light.townPower')*flick:0;f.angle=Math.min(1.2,tune('light.townWidth')*(S.up.mlantern?1.35:1));f.penumbra=tune('light.townSoft');f.decay=TOWN_FL_DECAY;f.distance=TOWN_FL_REACH;
  f.position.set(hx,hy,hz);f.target.position.set(hx+_tlV.x*10,hy+_tlV.y*10+0.25,hz+_tlV.z*10);f.target.updateMatrixWorld();
  for(let i=1;i<FL.length;i++)if(FL[i].intensity>0){FL[i].intensity=tune('light.townPower')*0.8;FL[i].decay=TOWN_FL_DECAY;FL[i].distance=TOWN_FL_REACH;FL[i].angle=tune('light.townWidth');FL[i].penumbra=tune('light.townSoft')}   // friends' beams the same
  TL.bounce.intensity=on?0.5*flick:0;TL.bounce.position.set(hx+_tlV.x*1.6,hy+_tlV.y*1.6,hz+_tlV.z*1.6);
  // the nearest lit lanterns get the real lights
  const lit=TST.lit.map(i=>{const p=townLampPos(TL.lamps[i]);return{i,p,d:(p.x-P.x)**2+(p.z-P.z)**2}}).sort((a,b)=>a.d-b.d).slice(0,TOWN_POOL);
  const du=TL.dust.material.uniforms;
  TL.pool.forEach((pl,k)=>{const e=lit[k];if(!e){pl.intensity=0;du.uLamp.value[k].w=0;return}
    const fl=0.88+0.08*Math.sin(now*7.3+e.i*4.07)+0.04*Math.sin(now*17.1+e.i*1.1);pl.position.set(e.p.x,e.p.y+0.05,e.p.z);pl.intensity=tune('town.lampPower')*fl;pl.distance=tune('town.lampReach');
    du.uLamp.value[k].set(e.p.x,e.p.y,e.p.z,0.6)});
  TL.glow.material.uniforms.uT.value=now;
  // dust and sand see the same beam
  const fc=Math.cos(f.angle);du.uT.value=now;du.uCam.value.copy(camera.position);du.uFP.value.set(hx,hy,hz);du.uFD.value.copy(_tlV);du.uFC.value=fc;du.uFOn.value=on?flick:0;du.uK.value=tune('town.dust')*0.55;
  TL.shafts.forEach((s,i)=>{const v=du.uSh.value[i];if(!s.on){v.w=0;return}v.set(s.o.x-(s.o.lean?1:0),s.o.z,s.o.r*(s.o.lean?1.6:1.2),0.9*(1-0.5*nightF())*tune('town.shaft'))});
  const tu=TL.trk.material.uniforms;tu.uT.value=now;tu.uFP.value.set(hx,hy,hz);tu.uFD.value.copy(_tlV);tu.uFC.value=fc;tu.uFOn.value=on?1:0;
  const rate=tune('town.trickle');if(rate>0&&(TL.trkT-=dt)<=0){TL.trkT=(60/rate)*(0.5+Math.random());townTrickle(now)}
  if((TL.creakT-=dt)<=0){TL.creakT=7+Math.random()*16;townCreak()}
}
/* out of the town: the flashlight goes back to the lake's settings next frame (84-coop.js aimLight), the room tone fades */
function townLightOff(){townToneOn(false)}
