import {inCanyon,CANYON} from './canyon.mjs';
import {baseHeight} from './world.mjs';
// Continuous, engine-neutral excavation. Negative density is rock, positive is air.
export const VOLUME={minX:-88,maxX:-40,minZ:-12,maxZ:36,minY:-64,top:12};
export const MESH_CHUNK=8,MESH_STEP=.5;
const cache=new WeakMap(),key=(x,y,z)=>`${x},${y},${z}`;
export function rubbleBounds(b){return {lo:[b.x-b.radius,b.y,b.z-b.radius],hi:[b.x+b.radius,b.y+b.height,b.z+b.radius]};}
export function rubbleDistance(b,x,y,z){if(b.remaining<=0)return Infinity;const h=b.height*b.remaining/b.total,dx=x-b.x,dz=z-b.z,lx=dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw),lz=dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw);return (Math.hypot(lx/b.radius,(y-b.y-h/2)/(h/2),lz/1.05)-1)*Math.min(h/2,1.05);}
function boxDistance(x,y,z,c,h,round=0){
  const a=Math.abs(x-c.x)-h.x+round,b=Math.abs(y-c.y)-h.y+round,d=Math.abs(z-c.z)-h.z+round;
  return Math.hypot(Math.max(a,0),Math.max(b,0),Math.max(d,0))+Math.min(Math.max(a,b,d),0)-round;
}
export function brushBounds(b,pad=0){const r=b.radius+pad;return {lo:[Math.min(b.a.x,b.b.x)-r,Math.min(b.a.y,b.b.y)-r,Math.min(b.a.z,b.b.z)-r],hi:[Math.max(b.a.x,b.b.x)+r,Math.max(b.a.y,b.b.y)+r,Math.max(b.a.z,b.b.z)+r]};}
export function brushDistance(b,x,y,z){
  const dx=b.b.x-b.a.x,dy=b.b.y-b.a.y,dz=b.b.z-b.a.z,px=x-b.a.x,py=y-b.a.y,pz=z-b.a.z;
  const t=Math.max(0,Math.min(1,(px*dx+py*dy+pz*dz)/(dx*dx+dy*dy+dz*dz||1)));
  let d=Math.hypot(px-dx*t,py-dy*t,pz-dz*t)-b.radius;
  if(b.floor)d=Math.max(d,b.floor.y+b.floor.sx*(x-b.floor.x)+b.floor.sz*(z-b.floor.z)-y);
  return d;
}
export function densityField(m){
  const revision=m.terrainRevision||0,length=m.brushes?.length||0,levels=m.levels.length,old=cache.get(m);
  if(old&&old.revision===revision&&old.length===length&&old.levels===levels&&old.removed===m.removed)return old.query;
  const index=new Map(),bottom=Math.min(...m.levels);
  const register=(shape,bounds)=>{for(let x=Math.floor(bounds.lo[0]/4);x<=Math.floor(bounds.hi[0]/4);x++)for(let y=Math.floor(bounds.lo[1]/4);y<=Math.floor(bounds.hi[1]/4);y++)for(let z=Math.floor(bounds.lo[2]/4);z<=Math.floor(bounds.hi[2]/4);z++){const k=key(x,y,z);if(!index.has(k))index.set(k,[]);index.get(k).push(shape);}};
  for(const b of m.brushes||[])register(b,brushBounds(b,1));
  for(const b of m.rubble||[])if(b.remaining>0)register({rubble:b},rubbleBounds(b));
  for(const k of Object.keys(m.removed||{})){const[x,y,z]=k.split(',').map(Number),s={c:{x:x+.5,y:y+.5,z:z+.5},h:{x:.5,y:.5,z:.5}};register(s,{lo:[x-1,y-1,z-1],hi:[x+2,y+2,z+2]});}
  const rooms=m.levels.filter(l=>l<6).map(l=>({c:{x:-67,y:l+1.5,z:28},h:{x:5,y:1.5,z:4}}));
  const query=(x,y,z)=>{
    const canyon=inCanyon(x,z),top=canyon?baseHeight(x,z):6,bottomY=canyon?CANYON.minY:-32;
    let d=canyon?y-top:Math.max(y-6,VOLUME.minX-x,x-VOLUME.maxX,VOLUME.minZ-z,z-VOLUME.maxZ);
    if(!canyon&&(x<VOLUME.minX||x>VOLUME.maxX||z<VOLUME.minZ||z>VOLUME.maxZ))return Math.max(.001,d);
    d=Math.max(d,-boxDistance(x,y,z,{x:-64,y:(6+bottom)/2,z:30},{x:2,y:(6-bottom)/2+.001,z:2}));
    for(const s of rooms)d=Math.max(d,-boxDistance(x,y,z,s.c,s.h,.38));
    for(const s of index.get(key(Math.floor(x/4),Math.floor(y/4),Math.floor(z/4)))||[])if(!s.rubble)d=Math.max(d,-(s.c?boxDistance(x,y,z,s.c,s.h,.08):brushDistance(s,x,y,z)));
    for(const s of index.get(key(Math.floor(x/4),Math.floor(y/4),Math.floor(z/4)))||[])if(s.rubble)d=Math.min(d,rubbleDistance(s.rubble,x,y,z));
    return Math.min(d,y-bottomY);
  };
  cache.set(m,{revision,length,levels,removed:m.removed,query});return query;
}
export function affectedChunks(bounds,pad=.5){const keys=new Set();for(let x=Math.floor((bounds.lo[0]-pad)/8);x<=Math.floor((bounds.hi[0]+pad)/8);x++)for(let y=Math.floor((bounds.lo[1]-pad)/8);y<=Math.floor((bounds.hi[1]+pad)/8);y++)for(let z=Math.floor((bounds.lo[2]-pad)/8);z<=Math.floor((bounds.hi[2]+pad)/8);z++)if(y>=-8&&y<=1)keys.add(key(x,y,z));return keys;}
export function mineChunkKeys(m){
  const keys=affectedChunks({lo:[-88,6,-12],hi:[-40,6,36]},0);
  const add=b=>{for(const k of affectedChunks(b))keys.add(k);};
  // Only chunks intersecting the exposed canyon surface; solid interior is meshed when cut.
  for(let cx=-13;cx<13;cx++)for(let cz=-13;cz<-3;cz++){
    let lo=Infinity,hi=-Infinity;
    for(let x=cx*8;x<=cx*8+8;x+=2)for(let z=cz*8;z<=cz*8+8;z+=2){const h=baseHeight(x,z);lo=Math.min(lo,h);hi=Math.max(hi,h);}
    for(let cy=Math.floor((lo-.1)/8);cy<=Math.floor((hi+.1)/8);cy++)keys.add(key(cx,cy,cz));
  }
  add({lo:[-66,Math.min(...m.levels),28],hi:[-62,6,32]});
  for(const l of m.levels.filter(l=>l<6))add({lo:[-72,l,24],hi:[-62,l+3,32]});
  for(const k of Object.keys(m.removed||{})){const[x,y,z]=k.split(',').map(Number);add({lo:[x,y,z],hi:[x+1,y+1,z+1]});}
  for(const b of m.brushes||[])add(brushBounds(b));for(const b of m.rubble||[])if(b.remaining>0)add(rubbleBounds(b));return keys;
}
const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
// Marching tetrahedra interpolates the actual zero surface; cells are mesh samples, not dig blocks.
export function mineChunkMesh(m,cx,cy,cz,step=MESH_STEP){
  const field=densityField(m),positions=[],normals=[],n=Math.round(8/step),size=n+1,values=new Float32Array(size**3),ox=cx*8,oy=cy*8,oz=cz*8;
  const at=(x,y,z)=>(x*size+y)*size+z;
  for(let x=0;x<=n;x++)for(let y=0;y<=n;y++)for(let z=0;z<=n;z++)values[at(x,y,z)]=field(ox+x*step,oy+y*step,oz+z*step);
  const normal=p=>{const e=.025,a=field(p[0]+e,p[1],p[2])-field(p[0]-e,p[1],p[2]),b=field(p[0],p[1]+e,p[2])-field(p[0],p[1]-e,p[2]),c=field(p[0],p[1],p[2]+e)-field(p[0],p[1],p[2]-e),len=Math.hypot(a,b,c)||1;return [a/len,b/len,c/len];};
  const emit=(a,b,c)=>{const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...cross)<1e-8)return;const na=normal(a);if(cross.reduce((s,v,i)=>s+v*na[i],0)<0)[b,c]=[c,b];for(const p of[a,b,c]){positions.push(...p);normals.push(...normal(p));}};
  for(let x=0;x<n;x++)for(let y=0;y<n;y++)for(let z=0;z<n;z++){
    const px=ox+x*step,pz=oz+z*step,py=oy+y*step,canyon=inCanyon(px+.001,pz+.001);
    if(canyon?(py<-64||py>12):(px<-88.5||px> -39.5||pz<-12.5||pz>36.5||py< -32||py>6))continue;
    const d=corners.map(p=>values[at(x+p[0],y+p[1],z+p[2])]);if(d.every(v=>v>=0)||d.every(v=>v<0))continue;
    const p=corners.map(v=>[ox+(x+v[0])*step,oy+(y+v[1])*step,oz+(z+v[2])*step]);
    const edge=(a,b)=>{const t=d[a]/(d[a]-d[b]);return p[a].map((v,i)=>v+(p[b][i]-v)*t);};
    for(const t of tetra){const inside=t.filter(i=>d[i]<0),outside=t.filter(i=>d[i]>=0);if(inside.length===1){const a=inside[0];emit(...outside.map(b=>edge(a,b)));}else if(inside.length===3){const b=outside[0];emit(...inside.map(a=>edge(a,b)));}else if(inside.length===2){const[a,b]=inside,[c,e]=outside,A=edge(a,c),B=edge(a,e),C=edge(b,e),D=edge(b,c);emit(A,B,C);emit(A,C,D);}}
  }return {positions,normals};
}
