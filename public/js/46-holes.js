'use strict';
/* public/js/46-holes.js -- how a hole looks while you dig it.
   The terrain is a 40 cm grid, so a 1.25 m hole used to come out as a jagged, faceted dip. Now every hole near
   you gets its own finely-sampled "liner" mesh, and the terrain is cut away (a shader discard) inside the rim:
     - clean shovel-cut walls with soil strata, darker and damper toward the bottom
     - faint marks on the wall at every foot of depth, so 5 ft is visible without reading the HUD
   plus two bits of dig feedback:
     - each scoop throws dirt clods in an arc from the hole onto its spoil pile
     - a clink and a glint in the bottom of the hole a scoop or two before a find comes up
   Purely visual: collisions/standing still use the terrain heights (groundAt), and the liner samples the same
   surfaceAt() shape, so what you see matches where you stand to within a few centimetres.
   Neighbouring holes merge the way the ground does (the deeper hole wins at every spot), so a row of holes reads
   as one trench: each liner draws only its own bowl, and its shader drops any pixel where another lined hole is
   deeper. Overlapping liners never stack, and a neighbour's later digging can't leave a stale rim across it. */

const HL_N=40;               // holes that get a liner (the nearest ones); farther holes keep the plain terrain dip
const HL_SEG=40;             // segments around each hole (fine enough that where two holes meet, their walls line up)
const HL_LIP=0.78;           // m past the rim the liner still covers: well past the terrain cut, so at a grazing angle you can't see under the seam
const HL_CUT=0.55;           // m past the rim the terrain is discarded (a little less than the lip, so the seam sits under terrain)
const HL_SCAN_R=45;          // look for holes this far around you
const HL_RESCAN=0.25;        // seconds between re-picking which holes get liners
const HL_SPILL=0.3;          // m outside the rim of loose, freshly spilled sand (no dry-crust plates on it)
const FOOT=0.3048;

/* ---- the hole's shape in GLSL: the same sums as 15-terrain.js holeLobe / holeDepthAt, so the terrain cut, the
   liners and the ground agree. Per lined hole: uHoles = (x, z, radius as wide as it has grown, visual depth) and two
   vec4s of shape (lobes 1-2, then lobe 3 and the floor tilt). ---- */
const hlHoleU={value:Array.from({length:HL_N},()=>new T.Vector4(0,0,0,0))};   // radius 0 = slot unused
const hlKU={value:Array.from({length:HL_N*2},()=>new T.Vector4(0,0,0,0))};
const _f=v=>v.toFixed(4);
const HL_GLSL=`uniform vec4 uHoles[${HL_N}];uniform vec4 uHoleK[${HL_N*2}];
  float hlLobe(vec4 a,vec4 b,vec2 u){float c=u.x,s=u.y,c2=c*c-s*s,s2=2.0*c*s,c3=c*c2-s*s2,s3=s*c2+c*s2;return a.x*c+a.y*s+a.z*c2+a.w*s2+b.x*c3+b.y*s3;}
  float hlRad(vec4 h,vec4 a,vec4 b,vec2 p){vec2 d=p-h.xy;float l=length(d);return h.z*(1.0+hlLobe(a,b,l>1e-5?d/l:vec2(1.0,0.0)));}
  float hlDep(vec4 h,vec4 a,vec4 b,vec2 p){if(h.z<=0.0)return -1.0;vec2 d=p-h.xy;float l=length(d);if(l>h.z*1.3)return 0.0;
    float lob=hlLobe(a,b,l>1e-5?d/l:vec2(1.0,0.0)),t=l/(h.z*(1.0+lob));if(t>=1.0)return 0.0;
    float f=max(0.05,${_f(HOLE_FLOOR[0])}+${_f(HOLE_FLOOR[1]-HOLE_FLOOR[0])}*min(1.0,max(h.w,0.0)/${_f(HOLE_FLOOR_D)})-${_f(HOLE_SLUMP)}*max(0.0,lob));
    float p0=t<f?1.0-${_f(HOLE_DISH)}*(t/f)*(t/f):(1.0-${_f(HOLE_DISH)})*(1.0-smoothstep(0.0,1.0,(t-f)/(1.0-f)));
    return h.w*p0*(1.0+dot(b.zw,d)/h.z-length(b.zw));}`;

/* ---- the terrain cut: chunk fragments inside a lined hole's (rim + HL_CUT) are discarded ---- */
const gdHook=chunkMat.onBeforeCompile;   // 15-terrain.js's dry-lake-bed detail: run it first, then add the hole cut
chunkMat.onBeforeCompile=(sh,r)=>{
  gdHook(sh,r);
  sh.uniforms.uHoles=hlHoleU;sh.uniforms.uHoleK=hlKU;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vHW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHW=(modelMatrix*vec4(transformed,1.0)).xz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec2 vHW;${HL_GLSL}`)
    .replace('void main() {',`void main() {\nfor(int i=0;i<${HL_N};i++){vec4 h=uHoles[i];if(h.z>0.0){float l=distance(vHW,h.xy);if(l<h.z*1.25+${_f(HL_CUT)}&&l<hlRad(h,uHoleK[i*2],uHoleK[i*2+1],vHW)+${_f(HL_CUT)})discard;}}`);
};

/* ---- liner geometry: fixed topology, rings from the lip in to the centre. Rings sit at fractions of the hole's own
   profile (rim, down the wall to where the floor starts, across the floor), so a divot and a 5 ft hole both get the
   wall's detail where the wall is. ---- */
// each ring: [kind, value]: 'lip' = metres outside the rim, 'wall' = 0 rim .. 1 floor's edge, 'floor' = 1 edge .. 0 centre
const HL_RINGS=(()=>{const R=[];
  for(const m of[HL_LIP,0.66,HL_CUT,0.42,0.3,0.18,0.08,0.02])R.push(['lip',m]);
  for(let k=0;k<=12;k++)R.push(['wall',k/12]);
  R.push(['floor',0.66],['floor',0.33],['floor',0]);
  return R})();
const HL_VPR=HL_SEG+1;   // vertices per ring (a seam column, so the triangle strips close)
function hlGeometry(){
  const nr=HL_RINGS.length,nv=nr*HL_VPR,g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(nv*3),3));
  g.setAttribute('color',new T.BufferAttribute(new Float32Array(nv*3),3));
  g.setAttribute('aDepth',new T.BufferAttribute(new Float32Array(nv),1));
  g.setAttribute('aWall',new T.BufferAttribute(new Float32Array(nv),1));
  g.setAttribute('aSpill',new T.BufferAttribute(new Float32Array(nv),1));
  const idx=[];
  for(let r=0;r<nr-1;r++)for(let s=0;s<HL_SEG;s++){const a=r*HL_VPR+s,b=a+1,c=a+HL_VPR,d=c+1;idx.push(a,c,b,b,c,d)}
  g.setIndex(idx);return g;
}
/* A liner draws its own hole's bowl, so where holes overlap it keeps only the pixels where its hole is the deepest
   (the same rule surfaceAt() uses). On an exact tie (a shared flat floor, or overlapping lips) the lower slot draws
   it, so two liners never z-fight. One material per slot, so each shader knows which hole it is (uSelf) and how rich
   its ground is (uRich); they all compile to the same program.
   The walls: soil bands by depth that wander a little round the hole (not ruler-level rings), soft edges between them,
   a fine grain so it reads as sand, darker and damper toward the bottom, a faint line at every foot; and on rich
   ground (sim.js richAt), warmer, redder sand with thin streaks of black sand, the old prospector's sign. The lip
   gets the dry-lake-bed plates (15-terrain.js groundDetail) like the ground round it, except on dug or spilled sand. */
function hlMakeMat(slot){
  const m=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,metalness:0}),self={value:slot},rich={value:0};
  m.onBeforeCompile=sh=>{
  sh.uniforms.uHoles=hlHoleU;sh.uniforms.uHoleK=hlKU;sh.uniforms.uSelf=self;sh.uniforms.uRich=rich;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aDepth;attribute float aWall;attribute float aSpill;varying float vDepth;varying float vWall;varying float vSpill;varying vec2 vHW;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvDepth=aDepth;vWall=aWall;vSpill=aSpill;vHW=(modelMatrix*vec4(transformed,1.0)).xz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>\nvarying float vDepth;varying float vWall;varying float vSpill;varying vec2 vHW;uniform int uSelf;uniform float uRich;\n${HL_GLSL}`)
    .replace('void main() {',`void main() {
      vec4 sH=uHoles[uSelf];float own=hlDep(sH,uHoleK[uSelf*2],uHoleK[uSelf*2+1],vHW);
      for(int i=0;i<${HL_N};i++){
        if(i==uSelf)continue;
        vec4 h=uHoles[i];if(h.z<=0.0)continue;
        vec4 a=uHoleK[i*2],b=uHoleK[i*2+1];
        float o=hlDep(h,a,b,vHW);
        if(o>own+0.0001)discard;
        if(i<uSelf&&o>=own-0.0001&&distance(vHW,h.xy)<hlRad(h,a,b,vHW)+${_f(HL_LIP-0.02)})discard;
      }`)
    .replace('#include <color_fragment>',`#include <color_fragment>
      if(vWall>0.01){
        float d=max(vDepth,0.0);
        float wob=sin(vHW.x*2.7+vHW.y*1.9)*0.045+sin(vHW.x*6.1-vHW.y*7.7)*0.018;
        float dd=d+wob,s=sin(dd*17.0+sin(dd*6.3)*1.4);
        vec3 lo=vec3(0.63,0.42,0.26),mid=vec3(0.72,0.50,0.32),hi=vec3(0.80,0.59,0.37);
        vec3 strata=s>0.0?mix(mid,hi,smoothstep(0.2,0.8,s)):mix(mid,lo,smoothstep(0.2,0.8,-s));
        strata=mix(strata,strata*vec3(1.06,0.9,0.8),uRich*0.6);
        float bs=smoothstep(0.9,0.98,sin(dd*43.0+sin(vHW.x*4.0)*0.8))*smoothstep(0.55,0.9,sin(dd*7.1+1.3))*smoothstep(0.3,0.5,d)*uRich;strata=mix(strata,vec3(0.22,0.19,0.17),bs*0.6);
        strata*=mix(1.0,0.56,clamp(d/2.4,0.0,1.0));
        strata=mix(diffuseColor.rgb*0.95,strata,smoothstep(0.03,0.3,d));   // the top few inches are the same sand as the surface
        float f=fract(dd/${FOOT.toFixed(4)});
        float mark=d>0.12?1.0-smoothstep(0.0,0.025,min(f,1.0-f)):0.0;
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(strata,strata*0.6,mark*0.5),vWall);
      }`);
  };
  groundDetail(m,null,'(1.-vSpill)*(1.-smoothstep(0.004,0.04,vDepth))','hl');
  m.userData.rich=rich;
  return m;
}
const hlPool=[];
for(let i=0;i<HL_N;i++){const m=new T.Mesh(hlGeometry(),hlMakeMat(i));m.receiveShadow=true;m.castShadow=false;m.visible=false;m.frustumCulled=false;scene.add(m);hlPool.push({m,h:null,seen:-1,seenM:-1,dirty:false})}
let hlLined=new Set();   // holes that currently have a liner; their bowls are left out of every other liner's shape
const _hlC=new T.Color(),_hlTmp=[0,0,0],C_SPILL=new T.Color(0xc79a62),C_FRESH=new T.Color(0xa87448);
let _hlSelf=null;const hlSkip=o=>o!==_hlSelf&&hlLined.has(o);

/* sample one hole's own bowl into its liner: the true ground shape (spoil mounds, and any hole without a liner)
   minus the other lined holes, which draw themselves */
function hlBuild(slot,h){
  _hlSelf=h;
  const g=slot.m.geometry,pos=g.attributes.position.array,col=g.attributes.color.array,dep=g.attributes.aDepth.array,wall=g.attributes.aWall.array,spill=g.attributes.aSpill.array;
  const d=holeVD(h),R=holeReff(h),old=HOLE_OLD(h.r),f0=old?0.72:holeFloorAt(d),rich=SIM.PAY&&SIM.PAY.on?clamp((SIM.richAt(h.x,h.z)-0.3)/0.6,0,1):0;
  slot.m.material.userData.rich.value=rich;
  let v=0;
  for(const ring of HL_RINGS){
    const kind=ring[0],q=ring[1];
    for(let s=0;s<HL_VPR;s++){
      const a=s/HL_SEG*Math.PI*2,c=Math.cos(a),sn=Math.sin(a),lob=old?0:holeLobe(h.k,c,sn),rr=R*(1+lob),f=old?f0:Math.max(0.05,f0-HOLE_SLUMP*Math.max(0,lob));
      const t=kind==='lip'?(rr+q)/rr:kind==='wall'?1-(1-f)*q:f*q,rad=rr*t;
      const x=h.x+c*rad,z=h.z+sn*rad,b=baseH(x,z);
      let y=surfaceAt(x,z,b,hlSkip);if(kind==='lip'&&q>HL_CUT)y-=0.015*(q-HL_CUT)/(HL_LIP-HL_CUT);   // level with the ground at the cut, tucked just under it by the outer edge
      pos[v*3]=x;pos[v*3+1]=y;pos[v*3+2]=z;dep[v]=b-y;
      // the wall weight fades onto the floor over the last few rings, so the floor isn't banded
      wall[v]=kind==='wall'?(q<0.85?1:1-(q-0.85)/0.15*0.7):kind==='floor'?0:0;
      // sand thrown just past the rim: loose and fresh, patchy round the hole
      const sp=kind==='lip'?clamp(1-q/HL_SPILL,0,1)*(0.55+0.45*Math.sin(a*3+h.x*1.7)*Math.sin(a*5-h.z*1.3)):0;spill[v]=d>0.02?sp:0;
      shade(_hlTmp,0,x,z,b,y,toneAt(x,z));_hlC.setRGB(_hlTmp[0],_hlTmp[1],_hlTmp[2]);
      if(kind==='floor'||kind==='wall'&&q>0.85)_hlC.lerp(C_FRESH,0.35).multiplyScalar(0.82+0.06*rich);   // the floor: loose, damp, fresh-turned sand
      else if(spill[v]>0)_hlC.lerp(C_SPILL,spill[v]*0.7);
      col[v*3]=_hlC.r;col[v*3+1]=_hlC.g;col[v*3+2]=_hlC.b;v++;
    }
  }
  _hlSelf=null;
  g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;g.attributes.aDepth.needsUpdate=true;g.attributes.aWall.needsUpdate=true;g.attributes.aSpill.needsUpdate=true;
  g.computeVertexNormals();g.computeBoundingSphere();
  slot.h=h;slot.seen=d;slot.seenM=holeVM(h);slot.dirty=false;slot.m.visible=true;
}
/* a hole changed (dug, gained or lost its liner): rebuild the liners its bowl or spoil pile can reach */
function hlDirtyNear(h){
  for(const s of hlPool)if(s.h&&s.h!==h&&Math.hypot(s.h.x-h.x,s.h.z-h.z)<s.h.r+HL_LIP+h.r+HOLE_REACH)s.dirty=true;
}
/* backstop: dark soil well below the deepest hole (hidden while you're inside a tent room, which sits lower still). Where two liners meet, rounding can leave a hairline between
   them; through it you see this, a dark crease, instead of the sky (the terrain under a lined hole is cut away). */
const hlUnder=new T.Mesh(new T.PlaneGeometry(260,260).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x3a2616,roughness:1,metalness:0}));
hlUnder.position.y=-EIGHT_FT-0.8;hlUnder.frustumCulled=false;scene.add(hlUnder);
let hlScanT=0;
function updateHoleLiners(dt){
  hlScanT-=dt;
  const fx=S.started?P.x:0,fz=S.started?P.z:12;
  hlUnder.position.x=fx;hlUnder.position.z=fz;
  hlUnder.visible=!inTent();   // the tent rooms are built underground (floor at TENT_FLOOR_Y, below this plane): never draw it through them
  if(hlScanT<=0){
    hlScanT=HL_RESCAN;
    // the nearest real holes (not sinkhole craters, which draw themselves) get a liner
    const near=[],R2=HL_SCAN_R*HL_SCAN_R,cr=Math.ceil(HL_SCAN_R/CELL),cx=cellOf(fx),cz=cellOf(fz);
    for(let i=-cr;i<=cr;i++)for(let j=-cr;j<=cr;j++){const L=grid.get(gkey(cx+i,cz+j));if(!L)continue;
      for(const h of L){if(h.d<0.04||h.r>HOLE_R*1.5)continue;const d2=(h.x-fx)**2+(h.z-fz)**2;if(d2<R2)near.push([d2,h])}}
    near.sort((a,b)=>a[0]-b[0]);
    const want=new Set(near.slice(0,HL_N).map(e=>e[1])),dropped=[];
    for(const s of hlPool)if(s.h&&!want.has(s.h)){dropped.push(s.h);s.h=null;s.m.visible=false}
    const held=new Set(hlPool.filter(s=>s.h).map(s=>s.h)),added=[];
    for(const h of want)if(!held.has(h)){const s=hlPool.find(q=>!q.h);if(s){s.h=h;s.dirty=true;added.push(h)}}
    hlLined=new Set(hlPool.filter(s=>s.h).map(s=>s.h));
    for(const h of dropped)hlDirtyNear(h);   // its bowl is now part of its neighbours' liners
    for(const h of added)hlDirtyNear(h);     // and a new liner's bowl comes out of theirs
  }
  for(const s of hlPool)if(s.h&&(Math.abs(holeVD(s.h)-s.seen)>0.001||Math.abs(holeVM(s.h)-s.seenM)>0.002)){s.dirty=true;hlDirtyNear(s.h)}
  for(let i=0;i<HL_N;i++){
    const s=hlPool[i],u=hlHoleU.value[i];
    if(s.h){const h=s.h;if(s.dirty)hlBuild(s,h);u.set(h.x,h.z,holeReff(h),holeVD(h));hlKU.value[i*2].set(h.k[0],h.k[1],h.k[2],h.k[3]);hlKU.value[i*2+1].set(h.k[4],h.k[5],h.k[6],h.k[7])}else u.set(0,0,0,0);
  }
}

/* ---- dirt clods: each scoop tosses a few from where the blade is working onto the spoil pile. They thud onto the
   pile, squash flat, shed a couple of crumbs that trickle down its slope, then settle and sink into it -- so the
   pile visibly takes them in, instead of clods popping out of existence next to it. ---- */
const CLOD_MAX=LOW_POWER?120:180,CLOD_T=0.5,CLOD_G=14;
const CLOD_DELAY=0.18;            // s after a dig with no scoop animation to time it (a friend's, the crew's): the throw
const CLOD_REST=1.1,CLOD_SINK=0.7; // s a landed clod sits squashed on the pile, then s it takes to sink into it
const GRAIN_REST=0.12,GRAIN_SINK=0.3; // the same for a grain of sand (trickles, a bucket's shedding, a pour)
const CLOD_COL=[0xb98552,0xa8743f,0xc99a64,0x9c6a3a];   // fresh, slightly damp dirt; the spoil pile is shaded to match
const clodGeo=(()=>{const g=new T.IcosahedronGeometry(1,0),p=g.attributes.position,rnd=mulberry32(99),bump=new Map();   // shared corners move together, so the lump stays closed
  for(let i=0;i<p.count;i++){const key=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3);if(!bump.has(key))bump.set(key,0.75+rnd()*0.4);const k=bump.get(key);p.setXYZ(i,p.getX(i)*k,p.getY(i)*k*0.8,p.getZ(i)*k)}g.computeVertexNormals();return g})();
const clodMesh=new T.InstancedMesh(clodGeo,new T.MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:1}),CLOD_MAX);
clodMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);clodMesh.frustumCulled=false;clodMesh.castShadow=true;scene.add(clodMesh);
const clods=[];let clodNext=0,clodLive=0;const _cc=new T.Color();
for(let i=0;i<CLOD_MAX;i++){clods.push({life:0});clodMesh.setColorAt(i,_cc.setHex(CLOD_COL[i%4]))}
function clodSlot(){const c=clods[clodNext],i=clodNext;clodNext=(clodNext+1)%CLOD_MAX;clodMesh.setColorAt(i,_cc.setHex(CLOD_COL[(Math.random()*4)|0]));clodMesh.instanceColor.needsUpdate=true;c.grain=false;return c}
function launch(c,sx,sy,sz,tx,tz,T_,s,delay,frag,ty){
  if(ty==null)ty=groundAt(tx,tz)+s*0.5;
  c.x=sx;c.y=sy;c.z=sz;c.vx=(tx-sx)/T_;c.vz=(tz-sz)/T_;c.vy=(ty-sy+0.5*CLOD_G*T_*T_)/T_;c.t=0;c.land=T_;c.delay=delay;c.frag=frag;c.s=s;c.rest=0;c.life=1;c.spin=Math.random()*6;c.landed=false;c.hx=c.hz=undefined;clodLive=1;
}
/* a grain of sand from (sx, sy, sz) to (tx, tz) (on the ground there, or at height ty), t seconds in the air */
function grain(sx,sy,sz,tx,tz,t,s,delay,ty){const c=clodSlot();launch(c,sx,sy,sz,tx,tz,t,s,delay||0,true,ty);c.grain=true;return c}
/* clods from where the dirt leaves the tool (from: {x,y,z}; else the side of the hole nearest the digger) onto the
   spoil pile. scale: their size (bare hands and first person throw smaller ones); delay: s before they fly. */
function throwClods(h,n,from,scale,delay){
  // first person (JT 2026-10-01: the body's out of the way, so were the clods in your face): from the far side of the hole, half the size
  const fp=FP&&Math.hypot(P.x-h.x,P.z-h.z)<h.r+2;let ox,oy,oz;
  if(from){ox=from.x;oy=from.y;oz=from.z}
  else{const dx=P.x-h.x,dz=P.z-h.z,dl=Math.hypot(dx,dz)||1,side=fp?-0.3:0.35;ox=h.x+dx/dl*h.r*side;oz=h.z+dz/dl*h.r*side;oy=groundAt(ox,oz)+0.2}
  const k=scale!=null?scale:fp?0.5:1;
  for(let i=0;i<n+1;i++){
    const c=clodSlot(),sx=ox+(Math.random()-0.5)*0.18,sz=oz+(Math.random()-0.5)*0.18;
    // aim at the upper half of the spoil pile, so clods land on its crest and read as joining it
    const a=Math.random()*6.283,r=Math.sqrt(Math.random())*MR*0.45,tx=h.mx+Math.cos(a)*r,tz=h.mz+Math.sin(a)*r;
    launch(c,sx,oy+(Math.random()-0.5)*0.08,sz,tx,tz,CLOD_T*(0.85+Math.random()*0.3),(0.06+Math.random()*0.07)*k,(delay!=null?delay:CLOD_DELAY)+i*0.035,false);
    c.hx=h.mx;c.hz=h.mz;   // the pile's crest: crumbs roll away from it
  }
}
function updateClods(dt){
  if(!clodLive)return;let live=0;   // nothing in the air: skip the matrix upload
  for(let i=0;i<CLOD_MAX;i++){
    const c=clods[i];
    if(c.life>0&&c.delay>0){c.delay-=dt;dummy.scale.setScalar(0);live++}
    else if(c.life>0){live++;
      if(!c.landed){
        c.t+=dt;c.x+=c.vx*dt;c.z+=c.vz*dt;c.vy-=CLOD_G*dt;c.y+=c.vy*dt;c.spin+=dt*9;
        if(c.t>=c.land){
          c.landed=true;c.gy=groundAt(c.x,c.z);if(c.y<c.gy)c.y=c.gy;c.gy=c.y-c.s*0.3;
          if(!c.frag)for(let k=0;k<2+(Math.random()*2|0);k++){   // it breaks up: crumbs trickle down the pile's slope, away from its crest
            const f=clodSlot(),ang=Math.atan2(c.z-(c.hz??c.z),c.x-(c.hx??c.x))+Math.random()*2-1,d=0.25+Math.random()*0.35;
            launch(f,c.x,c.y+0.02,c.z,c.x+Math.cos(ang)*d,c.z+Math.sin(ang)*d,0.28+Math.random()*0.12,c.s*0.4,0,true);
          }
        }
        dummy.position.set(c.x,c.y,c.z);dummy.rotation.set(c.spin,c.spin*0.7,0);dummy.scale.setScalar(c.s);
      }else{
        c.rest+=dt;
        const R=c.grain?GRAIN_REST:CLOD_REST,K=c.grain?GRAIN_SINK:CLOD_SINK,sq=Math.min(1,c.rest/0.08),sink=Math.max(0,(c.rest-R)/K);   // squash on impact, then settle down into the pile
        dummy.position.set(c.x,c.gy+c.s*(0.3-0.55*sink),c.z);dummy.rotation.set(0,c.spin,0);
        dummy.scale.set(c.s*(1+0.35*sq),c.s*(1-0.45*sq)*(1-sink*0.6),c.s*(1+0.35*sq));
        if(sink>=1)c.life=0;
      }
    }else dummy.scale.setScalar(0);
    dummy.updateMatrix();clodMesh.setMatrixAt(i,dummy.matrix);
  }
  clodMesh.instanceMatrix.needsUpdate=true;clodLive=live;
}

/* ---- the clink: a scoop or two before a find, a metallic tick and a glint down in the hole ---- */
const HINT_AHEAD=0.2;   // m above a buried find's depth where the shovel first "hits something"
const glintTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,230,1)');g.addColorStop(0.25,'rgba(255,230,150,0.8)');g.addColorStop(1,'rgba(255,220,120,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);x.fillStyle='rgba(255,255,240,0.95)';x.fillRect(30,2,4,60);x.fillRect(2,30,60,4);return new T.CanvasTexture(cv)})();
const glint=new T.Sprite(new T.SpriteMaterial({map:glintTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));glint.visible=false;scene.add(glint);
let glintT=0;
function hintFind(it,h){
  if(it.hinted)return;it.hinted=true;
  sfx.clank();
  const x=h.x+(it.x-h.x)*0.5,z=h.z+(it.z-h.z)*0.5;glint.position.set(x,groundAt(x,z)+0.12,z);glintT=0.9;glint.visible=true;
}
function updateGlint(dt){
  if(glintT<=0)return;glintT-=dt;
  const k=Math.max(0,glintT)/0.9,s=0.25+Math.sin((1-k)*Math.PI)*0.45;glint.scale.set(s,s,1);glint.material.rotation+=dt*3;glint.material.opacity=Math.min(1,k*2);
  if(glintT<=0)glint.visible=false;
}
function updateHoles(dt){updateHoleLiners(dt);updateClods(dt);updateGlint(dt)}
