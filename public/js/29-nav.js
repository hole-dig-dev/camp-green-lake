'use strict';
/* public/js/29-nav.js -- how the D Tent crew find their way (JT 2026-10-02: in-depth crew pathing). Before this they
   walked dead straight: through tents, crates and the fence, and across the camp to reach the gate.
   navPath(from, to): if nothing solid lies on the straight line (20-world.js colliders, the fence included) it's just
   [to]; otherwise an A* route on a NAV_CELL grid over the two points' box (+NAV_PAD): cells inside a collider (grown by
   NAV_R) are walls; holes cost extra (they'd rather walk round one than climb through it), an open sinkhole's crater
   and a dog-marked landmine cost a lot. The route is string-pulled into a few straight legs.
   30-npcs.js walkTo follows it (re-planning when the target changes, every NAV_REPLAN s, or when he's stuck) and keeps
   a little personal space from the rest of the crew and from campers (navSeparate). */
const NAV_PIPE=2,NAV_CELL=0.5,NAV_PAD=14,NAV_R=0.38,NAV_MAX=420;   // metres; a box over NAV_MAX cells a side uses coarser cells
function navSegClear(ax,az,bx,bz,m){
  const dx=bx-ax,dz=bz-az;
  for(const c of colliders){if(Math.max(ax,bx)<c.x0-m||Math.min(ax,bx)>c.x1+m||Math.max(az,bz)<c.z0-m||Math.min(az,bz)>c.z1+m)continue;
    let t0=0,t1=1;
    for(const[p,dp,lo,hi]of[[ax,dx,c.x0-m,c.x1+m],[az,dz,c.z0-m,c.z1+m]]){if(Math.abs(dp)<1e-9){if(p<lo||p>hi){t0=2;break}continue}let u=(lo-p)/dp,v=(hi-p)/dp;if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)break}
    if(t0<=t1)return false}
  return true;
}
/* extra cost of standing in a cell: holes, open sinkholes, known mines */
function navCost(x,z){
  let c=0;const h=holeNear(x,z,1.4);if(h&&h.d>0.4)c+=4;
  if(typeof SINK_LIVE!=='undefined')for(const sh of SINK_LIVE.values())if(sh.stage!=='warn'&&Math.hypot(x-sh.x,z-sh.z)<sh.r+1)c+=40;
  if(typeof MINES!=='undefined')for(const m of MINES.values())if(m.marked&&Math.hypot(x-m.x,z-m.z)<1.6)c+=60;
  if(typeof pipeNear==='function'&&pipeNear(x,z)<0.45)c+=NAV_PIPE;   /* step over the sand pipeline, don't walk along it */
  return c;
}
const NAV_CAMP={x0:FENCE_X0-10,x1:FENCE_X1+10,z0:FENCE_Z0-9,z1:FENCE_Z1+10};   // the fenced camp (20-world.js) and round it: any route near it can go all the way round
function navPath(ax,az,bx,bz){
  if(navSegClear(ax,az,bx,bz,NAV_R)&&navCheap({x:ax,z:az},{x:bx,z:bz}))return[{x:bx,z:bz}];
  /* heading into something solid (a spot by the drums): route to the open ground next to it, then the last step */
  const fr=navFree(bx,bz);if(Math.hypot(fr.x-bx,fr.z-bz)>0.01){const p=navPath(ax,az,fr.x,fr.z);p.push({x:bx,z:bz});return p}
  let x0=Math.min(ax,bx)-NAV_PAD,x1=Math.max(ax,bx)+NAV_PAD,z0=Math.min(az,bz)-NAV_PAD,z1=Math.max(az,bz)+NAV_PAD;
  if(x1>NAV_CAMP.x0-80&&x0<NAV_CAMP.x1+80&&z1>NAV_CAMP.z0-80&&z0<NAV_CAMP.z1+80){x0=Math.min(x0,NAV_CAMP.x0);x1=Math.max(x1,NAV_CAMP.x1);z0=Math.min(z0,NAV_CAMP.z0);z1=Math.max(z1,NAV_CAMP.z1)}
  const cs=Math.max(NAV_CELL,Math.max(x1-x0,z1-z0)/NAV_MAX),W=Math.ceil((x1-x0)/cs)+1,H=Math.ceil((z1-z0)/cs)+1,N=W*H;
  const wall=new Uint8Array(N);
  for(const c of colliders){if(c.x1<x0||c.x0>x1||c.z1<z0||c.z0>z1)continue;
    const i0=Math.max(0,Math.floor((c.x0-NAV_R-x0)/cs)),i1=Math.min(W-1,Math.ceil((c.x1+NAV_R-x0)/cs)),j0=Math.max(0,Math.floor((c.z0-NAV_R-z0)/cs)),j1=Math.min(H-1,Math.ceil((c.z1+NAV_R-z0)/cs));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=x0+i*cs,z=z0+j*cs;if(x>c.x0-NAV_R&&x<c.x1+NAV_R&&z>c.z0-NAV_R&&z<c.z1+NAV_R)wall[j*W+i]=1}}
  const cell=(x,z)=>[clamp(Math.round((x-x0)/cs),0,W-1),clamp(Math.round((z-z0)/cs),0,H-1)];
  const [si,sj]=cell(ax,az),[ei,ej]=cell(bx,bz),S0=sj*W+si,E=ej*W+ei;wall[S0]=0;wall[E]=0;   // he may be standing at (or heading to) a wall's edge
  const g=new Float32Array(N).fill(1e9),from=new Int32Array(N).fill(-1),closed=new Uint8Array(N),extra=new Float32Array(N).fill(-1);
  const heap=[];const push=(n,f)=>{heap.push([f,n]);let k=heap.length-1;while(k){const p=(k-1)>>1;if(heap[p][0]<=heap[k][0])break;[heap[p],heap[k]]=[heap[k],heap[p]];k=p}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m}}return top};
  const hcost=n=>Math.hypot(n%W-ei,((n/W)|0)-ej)*cs;
  g[S0]=0;push(S0,hcost(S0));let found=false,iter=0,near=S0,nearH=hcost(S0);
  const D=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  while(heap.length&&iter++<60000){const[,n]=pop();if(closed[n])continue;closed[n]=1;if(n===E){found=true;break}{const hh=hcost(n);if(hh<nearH){nearH=hh;near=n}}
    const i=n%W,j=(n/W)|0;
    for(const[di,dj,dc]of D){const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=W||nj>=H)continue;const m=nj*W+ni;if(wall[m]||closed[m])continue;
      if(di&&dj&&(wall[j*W+ni]||wall[nj*W+i]))continue;   // no cutting a wall's corner
      if(extra[m]<0)extra[m]=navCost(x0+ni*cs,z0+nj*cs);
      const ng=g[n]+dc*cs*(1+extra[m]);if(ng<g[m]){g[m]=ng;from[m]=n;push(m,ng+hcost(m))}}}
  /* no way all the way there (a spot squeezed between things): as close as he can get, then the last short step */
  const end=found?E:near;if(!found&&near===S0)return[{x:bx,z:bz}];
  const pts=[];for(let n=end;n!==-1;n=from[n])pts.push({x:x0+(n%W)*cs,z:z0+((n/W)|0)*cs});pts.reverse();if(found)pts[pts.length-1]={x:bx,z:bz};else pts.push({x:bx,z:bz});
  /* string-pull: from each kept point, jump to the furthest one in a clear, cheap straight line */
  const out=[];let cur={x:ax,z:az},k=0;
  while(k<pts.length-1){let best=k+1;for(let t=pts.length-1;t>k+1;t--){if(navSegClear(cur.x,cur.z,pts[t].x,pts[t].z,NAV_R*0.9)&&navCheap(cur,pts[t])){best=t;break}}out.push(pts[best]);cur=pts[best];k=best}
  if(!out.length)out.push({x:bx,z:bz});
  return out;
}
/* a straight leg doesn't cut across anything costly the grid route went round (a hole, a crater) */
function navCheap(a,b){const d=Math.hypot(b.x-a.x,b.z-a.z),n=Math.ceil(d/0.6);let onPipe=0;
  for(let s=1;s<n;s++){const u=s/n,c=navCost(a.x+(b.x-a.x)*u,a.z+(b.z-a.z)*u);if(c>=4)return false;if(c>=NAV_PIPE&&++onPipe>2)return false}return true}   /* more than a step's worth along a pipe: not cheap */
/* personal space: a walking crew member eases away from the others and from campers */
function navSeparate(b,dt){
  const g=b.p.g.position;let px=0,pz=0;
  const away=(x,z,r)=>{const dx=g.x-x,dz=g.z-z,d=Math.hypot(dx,dz);if(d>0.001&&d<r){const k=(r-d)/r;px+=dx/d*k;pz+=dz/d*k}};
  for(const o of bots)if(o!==b&&o.p.g.visible&&OUTDOOR.has(o.state)&&o.state!=='siftq')away(o.p.g.position.x,o.p.g.position.z,0.75);
  if(S.started&&S.tent==null)away(P.x,P.z,0.8);
  for(const R of remotes.values())if(R.room==null)away(R.p.g.position.x,R.p.g.position.z,0.8);
  if(px||pz){const nx=g.x+px*dt*1.6,nz=g.z+pz*dt*1.6;if(!colliders.some(c=>nx>c.x0&&nx<c.x1&&nz>c.z0&&nz<c.z1)){g.x=nx;g.z=nz}}
}
/* the nearest open ground to (x, z): for fixed spots (by the drums, in the sifter queue) that land in something solid */
function navFree(x,z,room){
  const m=NAV_R+(room||0),solid=(x,z)=>colliders.some(c=>x>c.x0-m&&x<c.x1+m&&z>c.z0-m&&z<c.z1+m);   /* room: elbow room beyond the walking margin */
  if(!solid(x,z))return{x,z};
  for(let r=0.25;r<=3;r+=0.25)for(let k=0;k<16;k++){const a=k/16*Math.PI*2,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(!solid(px,pz))return{x:px,z:pz}}
  return{x,z};
}
