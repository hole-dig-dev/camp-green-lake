'use strict';
/* public/js/47-digfeel.js -- HOW DIGGING FEELS (2026-11-10). Digging is the game, so the ground has to answer the shovel.
   Input stays one held key; everything here is what you see and hear, and none of it goes over the network.
   - The bite: a scoop lands when the blade bites (DIG_BITE, the Scoop clip's plant; 70-player.js), and the ground
     gives over the lever and lift (the hole's visual depth h.vd eases to its real depth h.d; 15-terrain.js holeVD).
   - The dirt comes up on the blade: a clump of sand sits on the shovel (or in your hand, bare-handed) from the lever
     until the toss, on you, your friends and the crew, in third person and on the first-person arms (71-fp-scoop.js).
   - The toss: the clump leaves the blade as clods that arc onto the spoil heap (46-holes.js throwClods), with a puff of
     sand-coloured dust at the blade and a few grains trickling back down the wall. The heap (h.vm) grows when they land.
   - Feel: a low thud under the dig recording as the blade bites, a hiss of sand on the toss, a tiny dip of the view in
     first person (dig.dip), breathing that deepens with a run of scoops (27-alive.js), and a tick on the HUD's pan /
     bucket meter as sand goes in (no input: it's handled for you).
   - The excavator carves: its seven-hole bite eases in under the bucket over dig.carve seconds, nearest the teeth first,
     its bucket's sand rises as it fills, sheds a few grains as it swings, and a dump pours: grains stream from the bucket
     and the pile or the truck's load grows over dig.pour seconds (88-dynamite.js piles, 87-excavator.js).
   Everything is pooled: the dust is one instanced draw call, grains reuse the clod pool. Phones (LOW_POWER) get fewer.
   Hooks: scoop() calls digBite (45-state.js); applyDig calls digRemote (65-net.js); animModel calls digClumpPose
   (25-people.js); updateFpScoop the same for the arms; updateCamera adds digDip(); 90-loop.js calls updateDigFeel(). */
/* where things happen in the dig cycle (P.digPh: 0 = the lifted pose, see 25-people.js scoopTime) */
const DIG_START=0.45;     // a fresh press starts here: the very start of the clip, so you see the blade go in
const DIG_BITE=0.622;     // the plant (clip 0.267 s): the scoop lands and the ground starts to give
const DIG_LIFT=0.8;       // levered (clip 0.533 s): the dirt is fully on the blade
const DIG_TOSS=0.13;      // part-way into the toss (clip 1.03 s): the dirt leaves the blade
const DIG_EASE_K=0.92;    // the ground finishes giving this far through the lever+lift
const DIG_REMOTE_EASE=0.18;   // s: someone else's scoop (no animation of theirs to sync to)
const DIG_GRAINS=LOW_POWER?1:3;   // grains trickling back down the wall per scoop
const DUST_MAX=LOW_POWER?28:72;   // dust puffs alive at once
const POUR_RATE=LOW_POWER?36:90;  // grains a second while a load pours (plus a thin curtain of dust down the stream)
const CLUMP_COL=0x9a6a40;         // damp, fresh-turned sand on the blade
const DIGF={ease:[],bite:null,dipT:9,effort:0,fill:false,shedT:0,pours:[],nfrom:{x:0,y:0,z:0}};
const _dfV=new T.Vector3(),_dfV2=new T.Vector3(),_dfQ=new T.Quaternion(),_dfY=new T.Vector3(0,1,0);

/* ---- easing a hole's visual depth (vd) or its heap (vm) toward the real depth ---- */
function digEase(h,key,from,dur,delay){
  for(let i=DIGF.ease.length-1;i>=0;i--){const e=DIGF.ease[i];if(e.h===h&&e.key===key){DIGF.ease[i]=DIGF.ease[DIGF.ease.length-1];DIGF.ease.pop()}}
  if(!(from<h.d-0.0005)){delete h[key];return}
  h[key]=from;DIGF.ease.push({h,key,from,dur:Math.max(0.02,dur),t:-(delay||0)});
}
let _dfX0=0,_dfZ0=0,_dfX1=0,_dfZ1=0,_dfAny=false;
function _dfTouch(h){const e=h.r+HOLE_REACH;if(!_dfAny){_dfX0=h.x-e;_dfZ0=h.z-e;_dfX1=h.x+e;_dfZ1=h.z+e;_dfAny=true}else{_dfX0=Math.min(_dfX0,h.x-e);_dfZ0=Math.min(_dfZ0,h.z-e);_dfX1=Math.max(_dfX1,h.x+e);_dfZ1=Math.max(_dfZ1,h.z+e)}}
function updateDigEase(dt){
  _dfAny=false;
  for(let i=DIGF.ease.length-1;i>=0;i--){const e=DIGF.ease[i];e.t+=dt;if(e.t<0)continue;
    const u=Math.min(1,e.t/e.dur),k=1-(1-u)*(1-u);   // fast as the blade goes in, slowing as it comes free
    if(u>=1||!(e.from<e.h.d)){delete e.h[e.key];DIGF.ease[i]=DIGF.ease[DIGF.ease.length-1];DIGF.ease.pop()}else e.h[e.key]=e.from+(e.h.d-e.from)*k;
    _dfTouch(e.h);}
  if(_dfAny)rebuildRegion(_dfX0,_dfZ0,_dfX1,_dfZ1);   // one pass over the ground for all of them
}

/* ---- dust: soft sand-coloured puffs, camera-facing quads in one instanced draw ---- */
const dustGeo=new T.InstancedBufferGeometry();
{const q=new T.PlaneGeometry(1,1);dustGeo.setIndex(q.index);dustGeo.setAttribute('position',q.attributes.position);dustGeo.setAttribute('uv',q.attributes.uv)}
const dustP=new Float32Array(DUST_MAX*4),dustA=new Float32Array(DUST_MAX*2);
dustGeo.setAttribute('aP',new T.InstancedBufferAttribute(dustP,4).setUsage(T.DynamicDrawUsage));
dustGeo.setAttribute('aA',new T.InstancedBufferAttribute(dustA,2).setUsage(T.DynamicDrawUsage));
dustGeo.instanceCount=DUST_MAX;
const dustMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uCol:{value:new T.Color(0xd8b07c)},uLight:{value:1}},
  vertexShader:`attribute vec4 aP;attribute vec2 aA;varying vec2 vUv;varying vec2 vA;
    void main(){vUv=uv;vA=aA;vec3 r=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]),u=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
      float a=aA.y*6.2832;vec2 q=vec2(cos(a)*position.x-sin(a)*position.y,sin(a)*position.x+cos(a)*position.y);
      gl_Position=projectionMatrix*viewMatrix*vec4(aP.xyz+(r*q.x+u*q.y)*aP.w,1.0);}`,
  fragmentShader:`uniform vec3 uCol;uniform float uLight;varying vec2 vUv;varying vec2 vA;
    void main(){vec2 p=vUv-0.5;float r=length(p)*2.0,n=0.7+0.3*sin(p.x*9.0+vA.y*20.0)*sin(p.y*11.0-vA.y*13.0);
      float a=vA.x*(1.0-smoothstep(0.1,1.0,r))*n;if(a<0.004)discard;gl_FragColor=vec4(uCol*uLight,a);}`});
const dustMesh=new T.Mesh(dustGeo,dustMat);dustMesh.frustumCulled=false;dustMesh.renderOrder=2;scene.add(dustMesh);
const dusts=[];for(let i=0;i<DUST_MAX;i++)dusts.push({life:0,max:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,s0:0,s1:0,a:0,seed:Math.random()});
let dustNext=0,dustLive=0;
/* n puffs at (x, y, z) drifting toward (dx, dz) (a direction, any length), size s m, opacity a */
function digDust(x,y,z,dx,dz,n,s,a){
  n=Math.round(n*tune('dig.dust')*(LOW_POWER?0.6:1));if(n<=0||!nearCam(x,z,60))return;
  const dl=Math.hypot(dx,dz)||1;
  for(let k=0;k<n;k++){const p=dusts[dustNext];dustNext=(dustNext+1)%DUST_MAX;
    p.x=x+(Math.random()-0.5)*s*0.5;p.y=y+(Math.random()-0.5)*s*0.3;p.z=z+(Math.random()-0.5)*s*0.5;
    const sp=0.35+Math.random()*0.5;p.vx=dx/dl*sp+(Math.random()-0.5)*0.4;p.vz=dz/dl*sp+(Math.random()-0.5)*0.4;p.vy=0.25+Math.random()*0.45;
    p.max=p.life=0.9+Math.random()*0.7;p.s0=s*(0.5+Math.random()*0.3);p.s1=s*(1.6+Math.random()*0.8);p.a=a*(0.7+Math.random()*0.3);p.seed=Math.random()}
  dustLive=1;
}
function updateDust(dt){
  if(!dustLive)return;let live=0;
  const day=1-nightF();dustMat.uniforms.uLight.value=0.22+0.78*day;
  for(let i=0;i<DUST_MAX;i++){const p=dusts[i],j=i*4;
    if(p.life>0){p.life-=dt;live++;const u=1-p.life/p.max,drag=Math.max(0,1-dt*1.8);p.vx*=drag;p.vz*=drag;p.vy=p.vy*drag-0.15*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      dustP[j]=p.x;dustP[j+1]=p.y;dustP[j+2]=p.z;dustP[j+3]=p.s0+(p.s1-p.s0)*Math.sqrt(u);dustA[i*2]=p.a*Math.min(1,u*8)*(1-u)*(1-u);dustA[i*2+1]=p.seed}
    else{dustP[j+3]=0;dustA[i*2]=0}}
  dustGeo.attributes.aP.needsUpdate=true;dustGeo.attributes.aA.needsUpdate=true;dustLive=live;
}

/* ---- the clump of dirt on the blade (or in the hand) ---- */
const clumpGeo=(()=>{const g=new T.SphereGeometry(1,9,5,0,Math.PI*2,0,Math.PI/2),p=g.attributes.position,rnd=mulberry32(7),bump=new Map();   // a lumpy heap (a dome, shared corners moved together)
  for(let i=0;i<p.count;i++){const key=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3);if(!bump.has(key))bump.set(key,0.8+rnd()*0.35);const k=p.getY(i)>0.01?bump.get(key):1;p.setXYZ(i,p.getX(i)*k,p.getY(i)*k*0.55,p.getZ(i)*k)}
  g.computeVertexNormals();return g})();
const clumpMat=new T.MeshStandardMaterial({color:CLUMP_COL,flatShading:true,roughness:1,metalness:0});
const CLUMP_SIZE=0.07,CLUMP_HAND=0.045;   // m across: on a shovel blade, in a bare hand
/* p: a person (p.model) or the first-person arms (FPS: p.g). ph: its dig phase, or -1 when not digging. on: show it
   at all (you: only when that scoop actually took dirt) */
function digClumpPose(p,ph,on,hands){
  const root=p.model||p.g;if(!root)return;
  let C=p.dclump;
  if(!C||C.hands!==!!hands){
    if(C&&C.m.parent)C.m.parent.remove(C.m);
    const host=root.getObjectByName(hands?'CGLCamper_R_Hand':'CGLCamper_R_ShovelBlade');if(!host||!host.geometry){p.dclump={hands:!!hands,m:null};return}
    host.geometry.computeBoundingBox();const bb=host.geometry.boundingBox,sz=bb.getSize(_dfV),c=bb.getCenter(_dfV2).clone();
    const ax=sz.x<=sz.y&&sz.x<=sz.z?0:sz.y<=sz.z?1:2,n=new T.Vector3();n.setComponent(ax,1);   // the blade's thin axis: the clump sits on its face
    const m=new T.Mesh(clumpGeo,clumpMat);m.castShadow=p!==FPS;   // (the first-person arms cast none)
   m.frustumCulled=false;m.visible=false;
    m.position.copy(c).addScaledVector(n,sz.getComponent(ax)*0.5);m.quaternion.setFromUnitVectors(_dfY,n);
    host.add(m);host.updateWorldMatrix(true,false);host.getWorldScale(_dfV);C=p.dclump={hands:!!hands,m,host,ws:(_dfV.x+_dfV.y+_dfV.z)/3||1};
  }
  if(!C.m)return;
  let k=0;if(on&&ph>=0){if(ph>=DIG_BITE)k=sm((ph-DIG_BITE)/(DIG_LIFT-DIG_BITE));else if(ph<DIG_TOSS)k=1-sm((ph-DIG_TOSS*0.6)/(DIG_TOSS*0.4))}
  C.m.visible=k>0.02;if(!C.m.visible)return;
  const s=(C.hands?CLUMP_HAND:CLUMP_SIZE)*tune('dig.clump')*k/C.ws;C.m.scale.set(s,s*(0.7+0.3*k),s);C.m.layers.mask=C.host.layers.mask;
}
/* where the dirt is (world): the clump if it's showing, else the near side of the hole */
function digFrom(p,h,out){
  const C=p&&p.dclump;if(C&&C.m&&C.m.visible){C.m.getWorldPosition(_dfV);out.x=_dfV.x;out.y=_dfV.y;out.z=_dfV.z;return out}
  const dx=P.x-h.x,dz=P.z-h.z,dl=Math.hypot(dx,dz)||1,R=holeReff(h)*0.6;out.x=h.x+dx/dl*R;out.z=h.z+dz/dl*R;out.y=groundAt(out.x,out.z)+0.12;return out;
}

/* ---- your scoop: from scoop() (45-state.js) the moment the blade bites ---- */
function digBite(h,v0,hands){
  if(DIGF.bite&&!DIGF.bite.tossed)digToss(DIGF.bite);   // the last one never got tossed (you stopped): out it goes
  const iv=tune('dig.time'),dur=Math.max(0.06,(1-DIG_BITE)*iv*DIG_EASE_K),toss=(1-DIG_BITE+DIG_TOSS)*iv;
  const m0=holeVM(h);digEase(h,'vd',v0,dur,0);digEase(h,'vm',Math.min(m0,v0),0.35,toss+CLOD_T*0.9);   // the heap waits for the dirt to land on it
  DIGF.bite={h,hands:!!hands,t:0,toss,tossed:false};
  if(nearCam(h.x,h.z,40)){
    if(hands){noise(0.1,1500,0.8,0.07,'highpass')}else sfx.thud(0.32*tune('dig.thud'));   // a scrape for hands, a low thud under the dig recording for the blade
    // a few grains let go of the wall where the blade went in and trickle down it
    const dx=P.x-h.x,dz=P.z-h.z,dl=Math.hypot(dx,dz)||1,R=holeReff(h);
    for(let i=0;i<(hands?1:DIG_GRAINS);i++){const a=Math.atan2(dz,dx)+(Math.random()-0.5)*1.6,sx=h.x+Math.cos(a)*R*0.97,sz=h.z+Math.sin(a)*R*0.97,tx=h.x+Math.cos(a)*R*0.45,tz=h.z+Math.sin(a)*R*0.45;
      grain(sx,groundAt(sx,sz)+0.02,sz,tx,tz,0.3+Math.random()*0.15,0.012+Math.random()*0.01,0.05+Math.random()*0.25)}
  }
  if(!hands)DIGF.dipT=0;DIGF.effort=Math.min(1,DIGF.effort+0.05);
}
function digToss(b){
  b.tossed=true;const h=b.h;if(!nearCam(h.x,h.z,45))return;
  // bare-handed in first person your hands are below the view: the dirt comes off the near edge of the scrape
  const fp=FP&&FPS.on,f=digFrom(fp?FPS:b.hands&&FP?null:me,h,DIGF.nfrom),ax=h.mx-f.x,az=h.mz-f.z;
  throwClods(h,b.hands?1:FP?1:2,f,b.hands?0.4:FP?0.5:0.85,0);
  digDust(f.x,f.y,f.z,ax,az,b.hands?2:FP?2:3,b.hands?0.16:FP?0.24:0.34,b.hands?0.24:FP?0.26:0.36);
  noise(0.22,2600,0.6,b.hands?0.025:0.045,'bandpass');   // the sand hissing off the blade
  if(!b.hands)payGlint(h,f.y);
  if(DIGF.fill){DIGF.fill=false;const w=document.getElementById('bucketWrap');if(w){w.classList.remove('dig-tick');void w.offsetWidth;w.classList.add('dig-tick')}noise(0.16,700,0.7,0.03,'lowpass')}   // a soft pour into the pan / bucket
}
/* fillBucket (45-state.js) put some sand in your pan or bucket: tick the meter as the scoop is tossed */
function digFilled(){DIGF.fill=true}
/* first-person view: a few millimetres down as the blade bites, and back */
function digDip(){const t=DIGF.dipT;if(t>0.5)return 0;const a=tune('dig.dip');return a*(t<0.07?Math.sin(t/0.07*Math.PI/2):Math.exp(-(t-0.07)/0.11))}
/* how worked you are from digging (0..1): 27-alive.js breathes harder with it */
const digEffort=()=>DIGF.effort;

/* ---- someone else's dig, the crew's, and the excavator's (from applyDig, 65-net.js) ---- */
function digRemote(h,v0){
  const E=typeof MACHS!=='undefined'?MACHS.exc:null;
  if(E&&E.on&&machLake()){const T=excTeeth(E,_dfV);if(Math.hypot(h.x-T.x,h.z-T.z)<2.8){excCarve(h,v0,E,T);return}}
  digEase(h,'vd',v0,DIG_REMOTE_EASE,0);digEase(h,'vm',Math.min(holeVM(h),v0),0.35,CLOD_DELAY+CLOD_T*0.9);
  if(nearCam(h.x,h.z,40)){throwClods(h,1);const y=groundAt(h.x,h.z)+0.3;digDust(h.x,y,h.z,h.mx-h.x,h.mz-h.z,2,0.3,0.3)}
}
/* the crew's scoop: the ground gives under the blade, then the toss (30-npcs.js) */
function digCrewBite(h,v0){digEase(h,'vd',v0,0.2,0);digEase(h,'vm',Math.min(holeVM(h),v0),0.35,0.75)}
function digCrewToss(b){
  const h=b.hole;if(!h||!nearCam(h.x,h.z,35))return;const f=digFrom(b.p,h,DIGF.nfrom);
  if(!(b.p.dclump&&b.p.dclump.m&&b.p.dclump.m.visible)){const g=b.p.g.position;f.x=g.x+(h.mx-g.x)*0.25;f.z=g.z+(h.mz-g.z)*0.25;f.y=g.y+1.1}
  throwClods(h,1,f,0.8,0);digDust(f.x,f.y,f.z,h.mx-f.x,h.mz-f.z,2,0.3,0.3);
}
/* the excavator's bite: the hole under the teeth gives first, the ring round it as the bucket drags in and curls */
function excCarve(h,v0,E,T){
  const ux=E.x-T.x,uz=E.z-T.z,ul=Math.hypot(ux,uz)||1,along=((h.x-T.x)*ux+(h.z-T.z)*uz)/ul,dist=Math.hypot(h.x-T.x,h.z-T.z);
  const C=tune('dig.carve'),delay=C*0.3*clamp(0.5-along*0.5+dist*0.15,0,1);   // far side of the teeth first, then dragged toward the cab
  digEase(h,'vd',v0,C*0.7,delay);digEase(h,'vm',Math.min(holeVM(h),v0),C,delay);
  if(dist<0.3&&nearCam(h.x,h.z,60)){digDust(T.x,groundAt(T.x,T.z)+0.15,T.z,ux,uz,4,0.45,0.32);DIGF.shedT=1.6;sfx.thud(0.5*tune('dig.thud'))}
}
/* a load leaves the bucket (87-excavator.js machFx): sand pours from the bucket to where it lands */
function digPour(m){
  const x=num(m.x,-600,600,0),z=num(m.z,-600,600,0);if(!nearCam(x,z,90))return;
  const E=MACHS.exc,D=MACHS.dump;let sx=x,sy=groundAt(x,z)+3,sz=z;
  if(E.on){const B=excBucketAt(E,_dfV);if(Math.hypot(B.x-x,B.z-z)<4){sx=B.x;sy=B.y;sz=B.z}}
  let tx=x,tz=z;
  if(m.to==='ground'&&typeof DYN!=='undefined'){let bd=MACH.EXC_FLING+3;for(const q of DYN.piles.values()){const d=Math.hypot(q.x-x,q.z-z);if(d<bd){bd=d;tx=q.x;tz=q.z}}}   // a flick lands it further out: pour to the pile
  let ty=groundAt(tx,tz);
  if(m.to==='dump'&&D.on){const b=SIM.machAt(D,MACH.DUMP_BED[0],MACH.DUMP_BED[1]);tx=b.x;tz=b.z;ty=D.y+2.0}else if(m.to==='sifter')ty+=1.1;
  DIGF.pours.push({sx,sy,sz,tx,ty,tz,t:0,dur:tune('dig.pour'),acc:0,dusted:false});
}
function updatePours(dt){
  for(let i=DIGF.pours.length-1;i>=0;i--){const q=DIGF.pours[i];q.t+=dt;
    const u=q.t/q.dur,rate=POUR_RATE*Math.sin(Math.PI*Math.min(1,u*1.15));q.acc+=rate*dt;   // swells and tails off
    const fall=Math.max(0.15,Math.sqrt(2*Math.max(0.1,q.sy-q.ty)/CLOD_G));
    while(q.acc>=1){q.acc-=1;const a=Math.random()*6.283,r=Math.random()*0.25,spread=0.15+0.5*Math.random()*u;
      grain(q.sx+Math.cos(a)*r,q.sy-0.2,q.sz+Math.sin(a)*r,q.tx+Math.cos(a)*spread,q.tz+Math.sin(a)*spread,fall*(0.9+Math.random()*0.2),0.025+Math.random()*0.035,0,q.ty+0.02)}
    if(u<1&&Math.random()<dt*14){const k=Math.random();digDust(q.sx+(q.tx-q.sx)*k,q.sy-0.3+(q.ty-q.sy+0.3)*k,q.sz+(q.tz-q.sz)*k,0,0,1,0.35,0.22)}
    if(!q.dusted&&q.t>fall){q.dusted=true;digDust(q.tx,q.ty+0.2,q.tz,0,0,6,0.7,0.4)}
    if(q.t>fall+0.4&&Math.random()<dt*4)digDust(q.tx,q.ty+0.25,q.tz,Math.random()-0.5,Math.random()-0.5,1,0.7,0.3);
    if(q.t>q.dur+fall){DIGF.pours[i]=DIGF.pours[DIGF.pours.length-1];DIGF.pours.pop()}}
}
function machFillStep(M,dt){if(!M.on){M.fillV=M.load;return}
  const cap=M.k==='exc'?MACH.EXC_BUCKET:MACH.DUMP_CAP,v=M.fillV??M.load;
  M.fillV=M.load>v?Math.min(M.load,v+cap*dt/(M.k==='exc'?tune('dig.carve')*1.4:tune('dig.pour'))):Math.max(M.load,v-cap*dt/tune('dig.pour'))}
/* the machines' loads as you see them: the bucket's sand rises as it fills, the truck's grows as it's poured in */
function updateMachFill(dt){
  if(typeof MACHS==='undefined')return;
  machFillStep(MACHS.exc,dt);machFillStep(MACHS.dump,dt);
  const E=MACHS.exc;
  // a loaded bucket sheds a little sand off its lip: just after the bite, and while it swings
  if(E.on&&E.load>0.05&&nearCam(E.x,E.z,60)){
    if(DIGF.shedT>0)DIGF.shedT-=dt;
    const swing=Math.abs(E.vel[2])+Math.abs(E.vel[0])*0.5,p=(DIGF.shedT>0?7:0)+swing*6;
    if(Math.random()<p*dt*(LOW_POWER?0.5:1)){const B=excBucketAt(E,_dfV),a=Math.random()*6.283;grain(B.x+Math.cos(a)*0.4,B.y-0.1,B.z+Math.sin(a)*0.4,B.x+Math.cos(a)*0.6,B.z+Math.sin(a)*0.6,Math.max(0.2,Math.sqrt(2*Math.max(0.1,B.y-groundAt(B.x,B.z))/CLOD_G)),0.02+Math.random()*0.02,0)}}
  else DIGF.shedT=0;
}

/* ---- every frame (90-loop.js) ---- */
function updateDigFeel(dt){
  updateDigEase(dt);
  const b=DIGF.bite;
  if(b&&!b.tossed){b.t+=dt;
    if(P.anim!==2||b.t>b.toss+0.35||(b.t>0.05&&P.digPh>=DIG_TOSS&&P.digPh<DIG_BITE))digToss(b)}
  // the clump on your own blade or hand: only while a scoop's dirt is on it
  const mine=!!(b&&!b.tossed&&P.anim===2);
  if(me&&me.model)digClumpPose(me,P.anim===2?P.digPh:-1,mine,!!me.noShovel);
  DIGF.dipT+=dt;DIGF.effort=Math.max(0,DIGF.effort-dt*(P.anim===2?0.02:0.08));
  updateDust(dt);updatePours(dt);updateMachFill(dt);
}
