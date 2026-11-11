'use strict';
/* public/js/46-holes.js -- how a hole looks while you dig it.
   The terrain is a 40 cm grid, so a 1.25 m hole would come out as a jagged, faceted dip. Near you, holes are drawn
   by DIG PATCHES instead, and the terrain is cut away (a shader discard) inside their rims:
     - every group of overlapping holes (one hole, a row, an excavator's bite, a dynamite crater) gets ONE patch: a fine
       grid (HL_GRID) over the group, sampled from the ground's own shape (15-terrain.js holeDepthAt / holeMound), so
       holes that meet are one continuous dug surface with no seam between them
     - the sand slumps: the dug depth is smoothed by a grayscale closing with a parabola (HL_SLUMP), which wears every
       crest down to a rounded slope no tighter than loose sand holds: the blade of sand between two holes, the lip
       where a deep hole cuts into a shallow one's floor (a shelf with a sandy slope down, not a cliff), the cusps
       between an excavator bite's seven holes. It never makes a hole shallower, and leaves floors and walls alone.
     - walls: soil bands by depth that wander round the hole, darker and damper toward the bottom, a faint line at
       every foot; on rich ground, warmer sand and thin black-sand streaks; the lip keeps the dry-lake-bed plates
   plus dig feedback: clods thrown onto the spoil heap, a clink and a glint a scoop before a find.
   Where you stand (groundAt) reads the patch where there is one, so your feet are on what you see. Gameplay still
   treats every hole as its circle (holeNear, falling in, the crew, the server). (Until 2026-11-11 each hole had its own
   ring-shaped liner and a shader decided which one drew where; joined holes met at a hard seam.) */

const HL_N=40;               // holes that get drawn by a patch (the nearest ones); farther holes keep the plain terrain dip
const HL_GRID=LOW_POWER?0.13:0.1;   // m between patch samples (walls get 4-5 samples down a 5 ft hole's side)
const HL_LIP=0.78;           // m past the rim the patch still covers: well past the terrain cut, so at a grazing angle you can't see under the seam
const HL_CUT=0.55;           // m past the rim the terrain is discarded (a little less than the lip, so the seam sits under terrain)
const HL_SCAN_R=45;          // look for holes this far around you
const HL_RESCAN=0.25;        // seconds between re-picking which holes get patches
const HL_SPILL=0.3;          // m outside the rim of loose, freshly spilled sand (no dry-crust plates on it)
const HL_SLUMP=5;            // the slump's curvature (1/m): a crest is rounded into a parabola no sharper than this
const HL_SLUMP_W=7;          // samples each way the slump looks (its reach: covers crests up to ~1.6 m deep at HL_GRID)
const HL_EASE_EVERY=2;       // while a hole's depth eases in, rebuild its patch every this many frames (it moves ~2 cm a frame)
const FOOT=0.3048;
const HL_EXT=h=>h.r*(1+HOLE_LOBES[0]+HOLE_LOBES[1]+HOLE_LOBES[2])+HL_LIP;   // how far a hole's patch can reach from its centre

/* ---- the terrain cut: chunk fragments inside a patched hole's (rim + HL_CUT) are discarded. Same lobes as
   15-terrain.js holeLobe, per hole: uHoles = (x, z, radius, depth), uHoleK = two vec4s of shape. ---- */
const hlHoleU={value:Array.from({length:HL_N},()=>new T.Vector4(0,0,0,0))};   // radius 0 = slot unused
const hlKU={value:Array.from({length:HL_N*2},()=>new T.Vector4(0,0,0,0))};
const _f=v=>v.toFixed(4);
const HL_GLSL=`uniform vec4 uHoles[${HL_N}];uniform vec4 uHoleK[${HL_N*2}];
  float hlLobe(vec4 a,vec4 b,vec2 u){float c=u.x,s=u.y,c2=c*c-s*s,s2=2.0*c*s,c3=c*c2-s*s2,s3=s*c2+c*s2;return a.x*c+a.y*s+a.z*c2+a.w*s2+b.x*c3+b.y*s3;}
  float hlRad(vec4 h,vec4 a,vec4 b,vec2 p){vec2 d=p-h.xy;float l=length(d);return h.z*(1.0+hlLobe(a,b,l>1e-5?d/l:vec2(1.0,0.0)));}`;
const gdHook=chunkMat.onBeforeCompile;   // 15-terrain.js's dry-lake-bed detail: run it first, then add the hole cut
chunkMat.onBeforeCompile=(sh,r)=>{
  gdHook(sh,r);
  sh.uniforms.uHoles=hlHoleU;sh.uniforms.uHoleK=hlKU;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vHW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHW=(modelMatrix*vec4(transformed,1.0)).xz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec2 vHW;${HL_GLSL}`)
    .replace('void main() {',`void main() {\nfor(int i=0;i<${HL_N};i++){vec4 h=uHoles[i];if(h.z>0.0){float l=distance(vHW,h.xy);if(l<h.z*1.25+${_f(HL_CUT)}&&l<hlRad(h,uHoleK[i*2],uHoleK[i*2+1],vHW)+${_f(HL_CUT)})discard;}}`);
};

/* ---- the patch material: one program for all of them. The walls: soil bands by depth that wander a little round
   the hole, soft edges, the top few inches the same sand as the surface, darker and damper toward the bottom, a
   faint line at every foot; on rich ground (sim.js richAt) warmer, redder sand with thin streaks of black sand.
   The lip gets the dry-lake-bed plates (15-terrain.js groundDetail) like the ground round it, except on dug or
   spilled sand. ---- */
function hlMakeMat(){
  const m=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0}),rich={value:0};
  m.onBeforeCompile=sh=>{
  sh.uniforms.uRich=rich;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aDepth;attribute float aWall;attribute float aSpill;varying float vDepth;varying float vWall;varying float vSpill;varying vec2 vHW;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvDepth=aDepth;vWall=aWall;vSpill=aSpill;vHW=(modelMatrix*vec4(transformed,1.0)).xz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vDepth;varying float vWall;varying float vSpill;varying vec2 vHW;uniform float uRich;')
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
        strata=mix(diffuseColor.rgb*0.95,strata,smoothstep(0.03,0.3,d));
        float f=fract(dd/${FOOT.toFixed(4)});
        float fw=max(0.025,fwidth(dd/${FOOT.toFixed(4)})*1.5),mark=d>0.12?(1.0-smoothstep(0.0,fw,min(f,1.0-f)))*0.025/fw:0.0;   // wider and fainter when it would alias
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(strata,strata*0.6,mark*0.5),vWall);
      }`);
  };
  groundDetail(m,null,'(1.-vSpill)*(1.-smoothstep(0.004,0.04,vDepth))*(1.-smoothstep(0.012,0.08,-vDepth))','hl');   // no plates on dug sand, spill, or the spoil heap
  m.userData.rich=rich;
  return m;
}
const hlMat=hlMakeMat();   // (uRich is shared: patches set it in onBeforeRender)

/* ---- the patches ---- */
let hlLined=new Set();       // holes drawn by a patch (their terrain is cut away)
const hlGroups=[];           // {holes, key, x0, z0, nx, nz, mesh, D, W (scratch), B (baseH), tone, H (heights), mask, dirty, easeT, rich}
const _hlC=new T.Color(),_hlTmp=[0,0,0],C_SPILL=new T.Color(0xc79a62),C_FRESH=new T.Color(0xa87448);
/* a patch for a group of overlapping holes: a grid over them all, plus a margin for the slump to see past the rims */
function hlNewGroup(hs){
  let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;
  for(const h of hs){const e=HL_EXT(h);x0=Math.min(x0,h.x-e);z0=Math.min(z0,h.z-e);x1=Math.max(x1,h.x+e);z1=Math.max(z1,h.z+e)}
  const pad=HL_SLUMP_W*HL_GRID;x0-=pad;z0-=pad;x1+=pad;z1+=pad;
  const nx=Math.ceil((x1-x0)/HL_GRID)+1,nz=Math.ceil((z1-z0)/HL_GRID)+1,n=nx*nz;
  const G={holes:hs,key:hs.map(h=>h.x+','+h.z).sort().join(';'),x0,z0,nx,nz,D:new Float32Array(n),W:new Float32Array(n),B:new Float32Array(n),tone:new Float32Array(n),H:new Float32Array(n),E:new Float32Array(n),mask:new Uint8Array(n),dirty:true,easeT:0,rich:0,mesh:null};
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,x=x0+i*HL_GRID,z=z0+j*HL_GRID;G.B[k]=baseH(x,z);G.tone[k]=toneAt(x,z);
    let e=1e9;for(const h of hs){const dx=x-h.x,dz=z-h.z,l=Math.hypot(dx,dz),c=l>1e-5?dx/l:1,s2=l>1e-5?dz/l:0;e=Math.min(e,l-h.r*(1+holeLobe(h.k,c,s2)))}G.E[k]=e;   // how far outside the nearest rim (full width)
    G.mask[k]=e<HL_LIP?1:0}
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3),3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('color',new T.BufferAttribute(new Float32Array(n*3),3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('aDepth',new T.BufferAttribute(new Float32Array(n),1).setUsage(T.DynamicDrawUsage));
  g.setAttribute('aWall',new T.BufferAttribute(new Float32Array(n),1).setUsage(T.DynamicDrawUsage));
  g.setAttribute('aSpill',new T.BufferAttribute(new Float32Array(n),1).setUsage(T.DynamicDrawUsage));
  const idx=[];   // a cell is drawn when any of its corners is within the patch's reach
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;if(G.mask[a]|G.mask[b]|G.mask[c]|G.mask[d])idx.push(a,c,b,b,c,d)}
  g.setIndex(n>65535?new T.Uint32BufferAttribute(idx,1):new T.Uint16BufferAttribute(idx,1));
  const m=new T.Mesh(g,hlMat);m.receiveShadow=true;m.castShadow=false;m.frustumCulled=false;
  m.onBeforeRender=()=>{hlMat.userData.rich.value=G.rich};scene.add(m);G.mesh=m;
  let r=0;if(SIM.PAY&&SIM.PAY.on)for(const h of hs)r+=clamp((SIM.richAt(h.x,h.z)-0.3)/0.6,0,1);G.rich=r/hs.length;
  return G;
}
function hlDropGroup(G){scene.remove(G.mesh);G.mesh.geometry.dispose()}
/* the slump: a grayscale closing of the dug depth D with a parabola (dilate, then erode; separable, one axis at a time).
   It raises D only where a narrower-than-the-parabola dip in D would be (a crest of sand), so it deepens ridges and
   rounds lips and leaves everything else as it was. */
function hlClose(G){
  const{nx,nz,D,W}=G,c=HL_SLUMP*HL_GRID*HL_GRID,R=HL_SLUMP_W;
  const pass=(src,dst,along,sign)=>{   // sign +1: dilate (max of v - c k^2), -1: erode (min of v + c k^2)
    const n1=along?nx:nz,n2=along?nz:nx,st=along?1:nx,st2=along?nx:1;
    for(let b=0;b<n2;b++){const o=b*st2;for(let a=0;a<n1;a++){let best=src[o+a*st];
      for(let k=1;k<=R;k++){const q=c*k*k;if(sign>0){if(a-k>=0){const v=src[o+(a-k)*st]-q;if(v>best)best=v}if(a+k<n1){const v=src[o+(a+k)*st]-q;if(v>best)best=v}}
        else{if(a-k>=0){const v=src[o+(a-k)*st]+q;if(v<best)best=v}if(a+k<n1){const v=src[o+(a+k)*st]+q;if(v<best)best=v}}}
      dst[o+a*st]=best}}};
  pass(D,W,true,1);pass(W,D,false,1);pass(D,W,true,-1);pass(W,D,false,-1);
}
function hlBuildGroup(G){
  const{nx,nz,x0,z0,D,H,B,E}=G,g=G.mesh.geometry,pos=g.attributes.position.array,col=g.attributes.color.array,dep=g.attributes.aDepth.array,wall=g.attributes.aWall.array,spill=g.attributes.aSpill.array;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,x=x0+i*HL_GRID,z=z0+j*HL_GRID;   // the raw dug depth: the deepest hole at each point
    let d=0;forNearHoles(x,z,h=>{if(h.d<=0&&!(h.vd>0))return;const dx=x-h.x,dz=z-h.z;if(dx*dx+dz*dz<h.r*h.r*1.69){const q=holeDepthAt(h,dx,dz);if(q.dep>d)d=q.dep}});D[k]=d}
  hlClose(G);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,x=x0+i*HL_GRID,z=z0+j*HL_GRID,b=B[k],d=D[k];
    let mound=0;forNearHoles(x,z,h=>{if(h.d>0||h.vd>0)mound+=holeMound(h,x,z)});
    let y=b-d+mound*(1-Math.min(1,d/HOLE_MOUND_FADE));const e=E[k];
    if(e>HL_CUT)y-=0.015*Math.min(1,(e-HL_CUT)/(HL_LIP-HL_CUT));   // level with the ground at the cut, tucked just under it at the edge
    H[k]=y;pos[k*3]=x;pos[k*3+1]=y;pos[k*3+2]=z;dep[k]=b-y;
    const sp=d<0.03&&e>-0.05&&e<HL_SPILL?(1-Math.max(0,e)/HL_SPILL)*(0.55+0.45*Math.sin(x*3.1+z*1.7)*Math.sin(x*1.3-z*4.1)):0;spill[k]=sp;
    shade(_hlTmp,0,x,z,b,y,G.tone[k]);_hlC.setRGB(_hlTmp[0],_hlTmp[1],_hlTmp[2]);
    if(d>0.03)_hlC.lerp(C_FRESH,clamp((d-0.03)/0.2,0,1)*0.35);else if(sp>0)_hlC.lerp(C_SPILL,sp*0.7);
    col[k*3]=_hlC.r;col[k*3+1]=_hlC.g;col[k*3+2]=_hlC.b}
  g.computeVertexNormals();
  const nrm=g.attributes.normal.array;
  for(let k=0;k<nx*nz;k++)wall[k]=D[k]>0.03?clamp((0.94-nrm[k*3+1])/0.25,0,1):0;   // soil bands on the steep parts, fresh sand on the floor
  for(const a of['position','color','aDepth','aWall','aSpill'])g.attributes[a].needsUpdate=true;
  g.computeBoundingSphere();G.dirty=false;
  for(const h of G.holes){h.hlSeen=holeVD(h);h.hlSeenM=holeVM(h)}
}
/* where you stand: a patch's surface where there is one (15-terrain.js groundAt asks), else NaN */
function hlGroundAt(x,z){
  for(const G of hlGroups){const fx=(x-G.x0)/HL_GRID,fz=(z-G.z0)/HL_GRID;if(fx<0||fz<0||fx>=G.nx-1||fz>=G.nz-1)continue;
    const i=fx|0,j=fz|0,k=j*G.nx+i;if(G.E[k]>HL_CUT||G.dirty)continue;const tx=fx-i,tz=fz-j,H=G.H;
    return lerp(lerp(H[k],H[k+1],tx),lerp(H[k+G.nx],H[k+G.nx+1],tx),tz)}
  return NaN;
}
GROUND_PATCH=hlGroundAt;
/* backstop: dark soil well below the deepest hole (hidden while you're inside a tent room, which sits lower still) */
const hlUnder=new T.Mesh(new T.PlaneGeometry(260,260).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x3a2616,roughness:1,metalness:0}));
hlUnder.position.y=-EIGHT_FT-0.8;hlUnder.frustumCulled=false;scene.add(hlUnder);
let hlScanT=0,hlFrame=0;
function updateHoleLiners(dt){
  hlScanT-=dt;hlFrame++;
  const fx=S.started?P.x:0,fz=S.started?P.z:12;
  hlUnder.position.x=fx;hlUnder.position.z=fz;
  hlUnder.visible=!inTent();   // the tent rooms are built underground (floor at TENT_FLOOR_Y, below this plane): never draw it through them
  if(hlScanT<=0){
    hlScanT=HL_RESCAN;
    // the nearest real holes (not sinkhole craters, which draw themselves) get a patch
    const near=[],R2=HL_SCAN_R*HL_SCAN_R,cr=Math.ceil(HL_SCAN_R/CELL),cx=cellOf(fx),cz=cellOf(fz);
    for(let i=-cr;i<=cr;i++)for(let j=-cr;j<=cr;j++){const L=grid.get(gkey(cx+i,cz+j));if(!L)continue;
      for(const h of L){if(h.d<0.04||HOLE_OLD(h.r))continue;const d2=(h.x-fx)**2+(h.z-fz)**2;if(d2<R2)near.push([d2,h])}}
    near.sort((a,b)=>a[0]-b[0]);
    const want=near.slice(0,HL_N).map(e=>e[1]),groups=[],seen=new Set();
    for(const h of want){if(seen.has(h))continue;const grp=[h];seen.add(h);   // overlapping patches join into one group
      for(let q=0;q<grp.length;q++){const a=grp[q];for(const o of want)if(!seen.has(o)&&Math.hypot(o.x-a.x,o.z-a.z)<HL_EXT(a)+HL_EXT(o)){seen.add(o);grp.push(o)}}
      groups.push(grp)}
    const keep=new Map(hlGroups.map(G=>[G.key,G]));hlGroups.length=0;
    for(const grp of groups){const key=grp.map(h=>h.x+','+h.z).sort().join(';');let G=keep.get(key);if(G)keep.delete(key);else G=hlNewGroup(grp);hlGroups.push(G)}
    for(const G of keep.values())hlDropGroup(G);
    hlLined=new Set(want);
  }
  for(const G of hlGroups){
    if(!G.dirty){let ch=false,easing=false;for(const h of G.holes){if(Math.abs(holeVD(h)-h.hlSeen)>0.001||Math.abs(holeVM(h)-h.hlSeenM)>0.002)ch=true;if(h.vd!=null||h.vm!=null)easing=true}
      if(ch){G.dirty=!easing||(hlFrame+G.nx)%HL_EASE_EVERY===0}}
    if(G.dirty)hlBuildGroup(G);
  }
  let i=0;
  for(const G of hlGroups)for(const h of G.holes){if(i>=HL_N)break;hlHoleU.value[i].set(h.x,h.z,h.r,holeVD(h));hlKU.value[i*2].set(h.k[0],h.k[1],h.k[2],h.k[3]);hlKU.value[i*2+1].set(h.k[4],h.k[5],h.k[6],h.k[7]);i++}
  for(;i<HL_N;i++)hlHoleU.value[i].set(0,0,0,0);
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
