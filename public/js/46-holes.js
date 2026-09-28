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
   surfaceAt() shape, so what you see matches where you stand to within a few centimetres. */

const HL_N=40;               // holes that get a liner (the nearest ones); farther holes keep the plain terrain dip
const HL_SEG=28;             // segments around each hole
const HL_LIP=0.6;            // m past the rim the liner still covers: the terrain triangles that straddle the rim dip down this far
const HL_CUT=0.55;           // m past the rim the terrain is discarded (a little less than the lip, so the seam sits under terrain)
const HL_SCAN_R=45;          // look for holes this far around you
const HL_RESCAN=0.25;        // seconds between re-picking which holes get liners
const FOOT=0.3048;

/* ---- the terrain cut: chunk fragments inside a lined hole's (rim + HL_CUT) are discarded ---- */
const hlHoleU={value:Array.from({length:HL_N},()=>new T.Vector4(0,0,0,0))};
chunkMat.onBeforeCompile=sh=>{
  sh.uniforms.uHoles=hlHoleU;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vHW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHW=(modelMatrix*vec4(transformed,1.0)).xz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec2 vHW;uniform vec4 uHoles[${HL_N}];`)
    .replace('void main() {',`void main() {\nfor(int i=0;i<${HL_N};i++){vec4 h=uHoles[i];if(h.z>0.0&&distance(vHW,h.xy)<h.z)discard;}`);
};

/* ---- liner geometry: fixed topology, rings from the lip in to the centre ---- */
// each ring: [radius as a fraction of r (or r + metres for the lip), isWall]
const HL_RINGS=(()=>{const R=[];
  R.push(['lip',HL_LIP],['lip',HL_LIP*0.5],['lip',0.02]);
  for(let k=0;k<=12;k++)R.push(['t',1-0.28*k/12,1]);   // the wall: t from the rim (1) down to the floor edge (0.72)
  R.push(['t',0.5,0],['t',0.25,0],['t',0,0]);
  return R})();
const HL_VPR=HL_SEG+1;   // vertices per ring (a seam column, so the triangle strips close)
function hlGeometry(){
  const nr=HL_RINGS.length,nv=nr*HL_VPR,g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(nv*3),3));
  g.setAttribute('color',new T.BufferAttribute(new Float32Array(nv*3),3));
  g.setAttribute('aDepth',new T.BufferAttribute(new Float32Array(nv),1));
  g.setAttribute('aWall',new T.BufferAttribute(new Float32Array(nv),1));
  const idx=[];
  for(let r=0;r<nr-1;r++)for(let s=0;s<HL_SEG;s++){const a=r*HL_VPR+s,b=a+1,c=a+HL_VPR,d=c+1;idx.push(a,c,b,b,c,d)}
  g.setIndex(idx);return g;
}
const hlMat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,metalness:0});
hlMat.onBeforeCompile=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aDepth;attribute float aWall;varying float vDepth;varying float vWall;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvDepth=aDepth;vWall=aWall;');
  // walls: soil strata by depth (a wobbly sine so the bands aren't ruler-straight), darker the deeper you go,
  // and a thin dark line at every foot
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vDepth;varying float vWall;')
    .replace('#include <color_fragment>',`#include <color_fragment>
      if(vWall>0.5){
        float d=max(vDepth,0.0);
        float s=sin(d*19.0+sin(d*6.3)*1.4);
        vec3 strata=s>0.4?vec3(0.80,0.58,0.36):(s<-0.5?vec3(0.60,0.39,0.24):vec3(0.71,0.49,0.31));
        strata*=mix(1.0,0.58,clamp(d/2.4,0.0,1.0));
        float f=fract(d/${FOOT.toFixed(4)});
        float mark=d>0.12?1.0-smoothstep(0.0,0.03,min(f,1.0-f)):0.0;
        diffuseColor.rgb=mix(strata,strata*0.42,mark*0.85);
      }`);
};
const hlPool=[];
for(let i=0;i<HL_N;i++){const m=new T.Mesh(hlGeometry(),hlMat);m.receiveShadow=true;m.castShadow=false;m.visible=false;m.frustumCulled=false;scene.add(m);hlPool.push({m,h:null,d:-1})}
const _hlC=new T.Color();

/* sample the true (smooth) ground shape around one hole into its liner */
function hlBuild(slot,h){
  const g=slot.m.geometry,pos=g.attributes.position.array,col=g.attributes.color.array,dep=g.attributes.aDepth.array,wall=g.attributes.aWall.array;
  let v=0;
  for(const ring of HL_RINGS){
    const rad=ring[0]==='lip'?h.r+ring[1]:h.r*ring[1],isWall=ring[0]==='t'&&ring[2]===1;
    for(let s=0;s<HL_VPR;s++){
      const a=s/HL_SEG*Math.PI*2,x=h.x+Math.cos(a)*rad,z=h.z+Math.sin(a)*rad,b=baseH(x,z);
      let y=surfaceAt(x,z,b);if(ring[0]==='lip'&&ring[1]>=HL_LIP-0.01)y-=0.012;   // tuck the outer edge just under the terrain
      pos[v*3]=x;pos[v*3+1]=y;pos[v*3+2]=z;dep[v]=b-y;wall[v]=isWall?1:0;
      // floor and lip use the terrain's own colouring; the floor a bit darker and damper
      const tmp=[0,0,0];shade(tmp,0,x,z,b,y,toneAt(x,z));_hlC.setRGB(tmp[0],tmp[1],tmp[2]);
      if(!isWall&&ring[0]==='t')_hlC.multiplyScalar(0.8);
      col[v*3]=_hlC.r;col[v*3+1]=_hlC.g;col[v*3+2]=_hlC.b;v++;
    }
  }
  g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;g.attributes.aDepth.needsUpdate=true;g.attributes.aWall.needsUpdate=true;
  g.computeVertexNormals();g.computeBoundingSphere();
  slot.h=h;slot.d=h.d;slot.m.visible=true;
}
let hlScanT=0;
function updateHoleLiners(dt){
  hlScanT-=dt;
  const fx=S.started?P.x:0,fz=S.started?P.z:12;
  if(hlScanT<=0){
    hlScanT=HL_RESCAN;
    // the nearest real holes (not sinkhole craters, which draw themselves) get a liner
    const near=[],R2=HL_SCAN_R*HL_SCAN_R,cr=Math.ceil(HL_SCAN_R/CELL),cx=cellOf(fx),cz=cellOf(fz);
    for(let i=-cr;i<=cr;i++)for(let j=-cr;j<=cr;j++){const L=grid.get(gkey(cx+i,cz+j));if(!L)continue;
      for(const h of L){if(h.d<0.04||h.r>HOLE_R*1.5)continue;const d2=(h.x-fx)**2+(h.z-fz)**2;if(d2<R2)near.push([d2,h])}}
    near.sort((a,b)=>a[0]-b[0]);
    const want=new Set(near.slice(0,HL_N).map(e=>e[1]));
    for(const s of hlPool)if(s.h&&!want.has(s.h)){s.h=null;s.m.visible=false}
    const held=new Set(hlPool.filter(s=>s.h).map(s=>s.h));
    for(const h of want)if(!held.has(h)){const s=hlPool.find(q=>!q.h);if(s)hlBuild(s,h)}
  }
  for(let i=0;i<HL_N;i++){
    const s=hlPool[i],u=hlHoleU.value[i];
    if(s.h){if(Math.abs(s.h.d-s.d)>0.001)hlBuild(s,s.h);u.set(s.h.x,s.h.z,s.h.r+HL_CUT,0)}else u.set(0,0,0,0);
  }
}

/* ---- dirt clods: each scoop tosses a few from where the blade is working onto the spoil pile. They thud onto the
   pile, squash flat, shed a couple of crumbs that trickle down its slope, then settle and sink into it -- so the
   pile visibly takes them in, instead of clods popping out of existence next to it. ---- */
const CLOD_MAX=110,CLOD_T=0.5,CLOD_G=14;
const CLOD_DELAY=0.18;            // s after the scoop: lines the throw up with the toss in the dig swing
const CLOD_REST=1.1,CLOD_SINK=0.7; // s a landed clod sits squashed on the pile, then s it takes to sink into it
const CLOD_COL=[0xb98552,0xa8743f,0xc99a64,0x9c6a3a];   // fresh, slightly damp dirt; the spoil pile is shaded to match
const clodGeo=(()=>{const g=new T.IcosahedronGeometry(1,0),p=g.attributes.position,rnd=mulberry32(99),bump=new Map();   // shared corners move together, so the lump stays closed
  for(let i=0;i<p.count;i++){const key=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3);if(!bump.has(key))bump.set(key,0.75+rnd()*0.4);const k=bump.get(key);p.setXYZ(i,p.getX(i)*k,p.getY(i)*k*0.8,p.getZ(i)*k)}g.computeVertexNormals();return g})();
const clodMesh=new T.InstancedMesh(clodGeo,new T.MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:1}),CLOD_MAX);
clodMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);clodMesh.frustumCulled=false;clodMesh.castShadow=true;scene.add(clodMesh);
const clods=[];let clodNext=0;const _cc=new T.Color();
for(let i=0;i<CLOD_MAX;i++){clods.push({life:0});clodMesh.setColorAt(i,_cc.setHex(CLOD_COL[i%4]))}
function clodSlot(){const c=clods[clodNext],i=clodNext;clodNext=(clodNext+1)%CLOD_MAX;clodMesh.setColorAt(i,_cc.setHex(CLOD_COL[(Math.random()*4)|0]));clodMesh.instanceColor.needsUpdate=true;return c}
function launch(c,sx,sy,sz,tx,tz,T_,s,delay,frag){
  const ty=groundAt(tx,tz)+s*0.5;
  Object.assign(c,{x:sx,y:sy,z:sz,vx:(tx-sx)/T_,vz:(tz-sz)/T_,vy:(ty-sy+0.5*CLOD_G*T_*T_)/T_,t:0,land:T_,delay,frag,s,rest:0,life:1,spin:Math.random()*6,landed:false});
}
function throwClods(h,n){
  // from the side of the hole nearest the digger (you, or whoever's at this hole), at the bottom where the blade bites
  const dx=P.x-h.x,dz=P.z-h.z,dl=Math.hypot(dx,dz)||1,ox=h.x+dx/dl*h.r*0.35,oz=h.z+dz/dl*h.r*0.35;
  for(let k=0;k<n+1;k++){
    const c=clodSlot(),sx=ox+(Math.random()-0.5)*0.3,sz=oz+(Math.random()-0.5)*0.3;
    // aim at the upper half of the spoil pile, so clods land on its crest and read as joining it
    const a=Math.random()*6.283,r=Math.sqrt(Math.random())*MR*0.45,tx=h.mx+Math.cos(a)*r,tz=h.mz+Math.sin(a)*r;
    launch(c,sx,groundAt(sx,sz)+0.2,sz,tx,tz,CLOD_T*(0.85+Math.random()*0.3),0.07+Math.random()*0.07,CLOD_DELAY+k*0.05,false);
    c.hx=h.mx;c.hz=h.mz;   // the pile's crest: crumbs roll away from it
  }
}
function updateClods(dt){
  for(let i=0;i<CLOD_MAX;i++){
    const c=clods[i];
    if(c.life>0&&c.delay>0){c.delay-=dt;dummy.scale.setScalar(0)}
    else if(c.life>0){
      if(!c.landed){
        c.t+=dt;c.x+=c.vx*dt;c.z+=c.vz*dt;c.vy-=CLOD_G*dt;c.y+=c.vy*dt;c.spin+=dt*9;
        if(c.t>=c.land){
          c.landed=true;c.y=groundAt(c.x,c.z)+c.s*0.3;
          if(!c.frag)for(let k=0;k<2+(Math.random()*2|0);k++){   // it breaks up: crumbs trickle down the pile's slope, away from its crest
            const f=clodSlot(),ang=Math.atan2(c.z-(c.hz||c.z),c.x-(c.hx||c.x))+Math.random()*2-1,d=0.25+Math.random()*0.35;
            launch(f,c.x,c.y+0.02,c.z,c.x+Math.cos(ang)*d,c.z+Math.sin(ang)*d,0.28+Math.random()*0.12,c.s*0.4,0,true);
          }
        }
        dummy.position.set(c.x,c.y,c.z);dummy.rotation.set(c.spin,c.spin*0.7,0);dummy.scale.setScalar(c.s);
      }else{
        c.rest+=dt;
        const sq=Math.min(1,c.rest/0.08),sink=Math.max(0,(c.rest-CLOD_REST)/CLOD_SINK);   // squash on impact, then settle down into the pile
        dummy.position.set(c.x,groundAt(c.x,c.z)+c.s*(0.3-0.55*sink),c.z);dummy.rotation.set(0,c.spin,0);
        dummy.scale.set(c.s*(1+0.35*sq),c.s*(1-0.45*sq)*(1-sink*0.6),c.s*(1+0.35*sq));
        if(sink>=1)c.life=0;
      }
    }else dummy.scale.setScalar(0);
    dummy.updateMatrix();clodMesh.setMatrixAt(i,dummy.matrix);
  }
  clodMesh.instanceMatrix.needsUpdate=true;
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
