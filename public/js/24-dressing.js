'use strict';
/* public/js/24-dressing.js -- what stands on the lake and in the yard: scatter, landmarks and camp props.
   Loaded right after 23-models.js, so everything later (crew pathing, the pickup, the pipe) sees its colliders.

   Three layers, all built from free CC0 models converted by art/blender/dressing.py (CREDITS.md lists them):
     1. Scatter: dead shrubs, dry grass, three cacti, pebbles, bones, a few dead trees. Where each one stands comes
        from hashes of its position (never Math.random), so every player sees the same lake. It is sparse and
        patchy, thicker toward the lake's edges, and stays out of the camp, the gate lane and the landmarks.
        Each kind is ONE InstancedMesh that only holds the copies near you (refilled as you walk), so the whole
        layer costs about a dozen draw calls and a few thousand triangles whatever its total size.
        A hole dug where something stands hides it (and drops its collider); it is back when the hole is gone.
     2. Landmarks: eight fixed scenes, each one mesh with a clear outline, spread around the lake as places to go
        to. LANDMARKS is the list gameplay can hang rewards on later; nothing here gives any.
     3. Camp props: barrels, crates, a tool rack, a washing line, lanterns, buckets.
   Trees, tall cacti and the big pieces of each landmark are solid (20-world.js solid()); small things are not. */

/* ---- landmarks. x,z: where it stands; r: how far out its scene reaches (for gameplay later); solids: boxes
   [dx,dz,w,d] around x,z, copied from what dressing.py prints. Names are generic on purpose (one place to rename). ---- */
const LANDMARKS=[
  {id:'wreck',name:'The Wreck',model:'LmWreck',x:-110,z:-140,r:11,
    solids:[[-0.3,-1.1,5.3,8.3],[6.6,3.2,3.7,2.3],[-5.2,-2,1.1,1.2]]},
  {id:'pier',name:'The Old Pier',model:'LmPier',x:165,z:-215,r:25,
    solids:[[1.7,11.3,0.5,0.5],[-1.7,11.4,0.5,0.5],[1.7,8,0.5,0.5],[-1.6,8,0.5,0.5],[-1.7,4.7,0.5,0.5],[1.6,4.6,0.5,0.5],[1.7,2.7,0.5,0.5],[-1.7,2.8,0.5,0.5],[1.7,-0.6,0.5,0.5],[-1.6,-0.6,0.5,0.5],[-1.7,-3.9,0.5,0.5],[1.6,-4,0.5,0.5],[1.7,-5.9,0.5,0.5],[-1.7,-5.8,0.5,0.5],[1.7,-9.2,0.5,0.5],[-1.6,-9.2,0.5,0.5],[-1.7,-12.5,0.5,0.5],[1.6,-12.6,0.5,0.5],[-1,-22,0.5,0.5],[-1,-19,0.5,0.5],[4.8,-9,2.4,3.9],[1.9,-23.2,0.5,0.5],[-3,13.5,0.4,0.4],[2.6,13,0.8,0.8]]},
  {id:'car',name:'The Car Wreck',model:'LmCar',x:255,z:150,r:8,
    solids:[[0.1,0,3.3,4.2],[-3.4,-1.6,2.1,2],[3.3,-2.2,0.5,0.5],[-1.2,-3.4,0.5,0.5]]},
  {id:'windmill',name:'The Windmill',model:'LmWindmill',x:-300,z:70,r:11,
    solids:[[-0.1,-0.3,2.4,2.3],[4.2,1,3.2,1.1]]},
  {id:'tree',name:'The Lone Tree',model:'LmTree',x:40,z:-390,r:8,
    solids:[[0,0,1.6,1.6],[2.6,2.2,0.6,0.6],[-2.4,2.8,1.2,1.1]]},
  {id:'stones',name:'The Standing Stones',model:'LmStones',x:-390,z:-400,r:13,
    solids:[[7.9,-1.6,2.4,2.2],[4.4,-6.7,1.6,1.7],[-1.9,-7.9,2.8,2.8],[-6.8,-4.4,2,1.8],[-7.8,1.8,2.1,2.2],[-6.8,10.8,3.8,5.5],[1.7,7.9,1.8,1.9],[6.7,4.4,3.1,2.7]]},
  {id:'camp',name:'The Old Claim',model:'LmCamp',x:370,z:-330,r:9,
    solids:[[-1.5,-2.2,4.3,5.4],[1.9,3.6,1.8,0.6],[3.9,-0.6,1,1],[-4.6,0.4,0.8,0.8],[-3.6,4.7,2.1,2.7],[5.6,-3.2,0.4,0.4]]},
  {id:'fence',name:'The Fence Line',model:'LmFence',x:-120,z:330,r:19,
    solids:[[-15.5,-0.5,2.9,0.4],[-12.6,-0.3,2.9,0.3],[-9.8,0.1,2.9,0.3],[-6.9,0.5,2.9,0.4],[-1.2,0.2,2.9,0.3],[1.7,-0.2,2.9,0.4],[4.6,-0.4,2.9,0.5],[10.4,0,2.9,0.4],[13.2,0.4,2.9,0.3],[-5.3,0,0.4,0.4],[-2.7,0,0.4,0.4],[16.6,-1.2,0.9,0.9]]},
];

/* ---- camp props: m model, x z ry, w d = solid footprint (none = walk-through), y = lift (stacked) ---- */
const DRESS_CAMP=[
  {m:'DressToolRack',x:-19,z:28.5,ry:0,w:2.3,d:0.6},              // inside the fence, left of the gate: shovels for the way out
  {m:'DressWashLine',x:-36.6,z:32.4,ry:Math.PI/2,posts:2.6},       // along the west fence; only its two posts are solid
  {m:'DressBucket',x:-35.8,z:29.7,ry:0.6},
  {m:'DressBarrel',x:-23.3,z:34.2,ry:0.4,w:0.8,d:0.8},             // with the yard's crate stack
  {m:'DressBarrel',x:-23.5,z:35.2,ry:2.1,w:0.8,d:0.8},
  {m:'DressCrate',x:-18.7,z:34.3,ry:0.35,w:0.85,d:0.85},
  {m:'DressBarrel',x:27.4,z:33.1,ry:1.2,w:0.8,d:0.8},              // east stack, clear of the pickup's spot by the service gate
  {m:'DressBarrel',x:28.2,z:34.0,ry:0.2,w:0.8,d:0.8},
  {m:'DressCrate',x:21.6,z:47.6,ry:0.2,w:0.85,d:0.85},             // beside the depot, under the water tower
  {m:'DressCrate',x:22.5,z:47.9,ry:-0.25,w:0.85,d:0.85},
  {m:'DressCrate',x:22.0,z:47.75,ry:0.6,y:0.8},
  {m:'DressBarrel',x:21.7,z:48.8,ry:0.9,w:0.8,d:0.8},
  {m:'DressBucket',x:10.2,z:33.2,ry:1.9},                          // by the water drums and the sifter
  {m:'DressBucket',x:12.5,z:38.5,ry:0.3},
  {m:'DressLantern',x:-17.9,z:42.9,ry:0.3},                        // one by each bunk tent's door, one at the rack, one by the laundry
  {m:'DressLantern',x:-9.9,z:42.9,ry:1.1},
  {m:'DressLantern',x:6.1,z:42.9,ry:2.0},
  {m:'DressLantern',x:-17.4,z:28.6,ry:0.7},
  {m:'DressLantern',x:-36.2,z:35.6,ry:0.2},
  {m:'DressLantern',x:22.0,z:47.75,ry:0.4,y:1.6},                  // on top of the crate stack
];

/* ---- scatter kinds. far: drawn within this many metres (phones: less); box: solid footprint; w: how common;
   flat: too low or thin to be worth a pass through the shadow map ---- */
const DRESS_NEAR=LOW_POWER?80:130,DRESS_FAR=LOW_POWER?240:480,DRESS_FADE=22;
const DRESS_KINDS=[
  {m:'DressGrass',w:38,far:DRESS_NEAR,s:[0.8,1.5],bunch:[2,5],flat:1},
  {m:'DressShrub',w:22,far:DRESS_NEAR,s:[0.8,1.6],bunch:[1,3]},
  {m:'RockA',w:5,far:DRESS_NEAR,s:[0.35,0.8],bunch:[2,4],flat:1},         // the lakebed rock models again, pebble-sized
  {m:'RockC',w:5,far:DRESS_NEAR,s:[0.35,0.8],bunch:[2,4],flat:1},
  {m:'DressCactusPear',w:8,far:DRESS_NEAR,s:[0.8,1.4],bunch:[1,3],cactus:1},
  {m:'DressCactusBarrel',w:7,far:DRESS_NEAR,s:[0.8,1.5],bunch:[1,2],cactus:1},
  {m:'DressCactusTall',w:6,far:DRESS_FAR,s:[0.75,1.35],box:0.5,cactus:1},
  {m:'DressFishBone',w:2.5,far:DRESS_NEAR,s:[0.8,1.3],flat:1},
  {m:'DressBones',w:1.6,far:DRESS_NEAR,s:[0.85,1.15]},
  {m:'DressDeadTreeA',w:1.3,far:DRESS_FAR,s:[0.8,1.25],box:0.8,tree:1},
  {m:'DressDeadTreeB',w:1.6,far:DRESS_FAR,s:[0.8,1.3],box:0.5,tree:1},
];
const DRESS_CELL=13;                    // one roll of the dice per 13 m square of lake
const DRESS_SOLID_KEEP=70;              // nothing solid this close to the gate: the crew walks and digs there

/* where scatter may not stand */
function dressKeepOut(x,z){
  if(Math.max(Math.abs(x),Math.abs(z))>EDGE-10||z<NORTH.trench[0]+16)return true;       // the rim; the trench, ramps and wall
  if(x>-52&&x<42&&z>8&&z<68)return true;                                                // the camp, its no-dig strip and a little air
  if(Math.abs(x)<7&&z<=30&&z>-42)return true;                                           // the lane out of the gate
  const O=SIM.OLD_TOWN;if(Math.hypot(x-O.x,z-O.z)<28)return true;                       // the old town's marked ground
  for(const L of LANDMARKS)if(Math.hypot(x-L.x,z-L.z)<L.r+6)return true;                // landmarks are composed by hand
  return false;
}
/* how likely a square is to grow something: patchy (big soft blobs of noise), and thicker toward the lake's edges */
function dressDensity(x,z){
  const patch=sm((vnoise(x/75+5.3,z/75+9.1)-0.42)/0.3),edge=Math.max(Math.abs(x),Math.abs(z-20))/HALF;
  return (0.07+0.5*patch)*(0.38+0.85*edge*edge);
}

const DRESS={group:new T.Group(),kinds:[],cols:[],grid:new Map(),px:1e9,pz:1e9,scanT:0,dirty:false,parked:false,glow:null,holesN:-1};
DRESS.group.name='dressing';scene.add(DRESS.group);
const dressSolid=(x,z,w,d)=>{solid(x,z,w,d);const c=colliders[colliders.length-1];DRESS.cols.push({c,x0:c.x0,x1:c.x1,z0:c.z0,z1:c.z1});return c};
const dressCell=(x,z)=>(Math.floor(x/8)+512)*2048+Math.floor(z/8)+512;

/* ---- 1. scatter: roll every square once, up front (about 8,000 hash lookups) ---- */
{
  for(const k of DRESS_KINDS)DRESS.kinds.push(Object.assign({list:[],im:null},k));
  const n=Math.floor(HALF/DRESS_CELL);
  for(let i=-n;i<n;i++)for(let j=-n;j<n;j++){
    const h=a=>hash2(i*7+a,j*13-a);                                   // this square's own random numbers
    const x=(i+h(1))*DRESS_CELL,z=(j+h(2))*DRESS_CELL;
    if(h(3)>dressDensity(x,z)||dressKeepOut(x,z))continue;
    // what grows here: cactus country in some parts of the lake, grass flats and dead trees in others
    const flavour=vnoise(x/170+31.7,z/170-7.3),wt=k=>k.w*(k.cactus?(flavour>0.52?2.6:0.5):k.tree?(flavour<0.45?1.8:0.6):1);
    let pick=h(4)*DRESS.kinds.reduce((a,k)=>a+wt(k),0),K=DRESS.kinds[0];
    for(const k of DRESS.kinds){pick-=wt(k);if(pick<=0){K=k;break}}
    if(K.box&&Math.hypot(x,z-27)<DRESS_SOLID_KEEP)continue;
    const count=K.bunch?K.bunch[0]+Math.floor(h(5)*(K.bunch[1]-K.bunch[0]+1)):1;
    for(let c=0;c<count;c++){
      const a=h(10+c)*6.283,d=c?1.2+h(20+c)*3.2:0,ix=x+Math.cos(a)*d,iz=z+Math.sin(a)*d;
      if(c&&dressKeepOut(ix,iz))continue;
      const s=K.s[0]+(K.s[1]-K.s[0])*h(30+c)*(c?0.8:1);
      const o={x:ix,y:baseH(ix,iz),z:iz,ry:h(40+c)*6.283,s,tint:0.86+h(50+c)*0.26,r:(K.box||0.5)*s,hid:false,col:null};
      if(K.box)o.col=dressSolid(ix,iz,K.box*s,K.box*s);
      K.list.push(o);const key=dressCell(ix,iz);let L=DRESS.grid.get(key);if(!L){L=[];DRESS.grid.set(key,L)}L.push(o);
    }
  }
  for(const K of DRESS.kinds)if(K.list.length)modelParts(K.m).then(parts=>{
    const p=parts[0],cap=Math.min(K.list.length,K.far>DRESS_NEAR?K.list.length:LOW_POWER?120:320);   // the most copies ever in range at once
    K.im=new T.InstancedMesh(p.geometry,p.material,cap);K.im.setColorAt(0,new T.Color(1,1,1));   // (allocates the per-copy tints while count is still the full capacity)
    K.im.count=0;K.im.castShadow=!K.flat&&(!LOW_POWER||K.far>DRESS_NEAR);   // phones: only the tall things cast
    K.im.receiveShadow=true;
    K.im.frustumCulled=false;                                         // its copies ring the player; one bounding sphere would cull them wrongly
    DRESS.group.add(K.im);DRESS.dirty=true;
  }).catch(()=>{});
}
/* put the copies near (fx,fz) into each kind's InstancedMesh; the last few metres of range shrink them in, so nothing pops */
const _dM=new T.Matrix4(),_dQ=new T.Quaternion(),_dS=new T.Vector3(),_dP=new T.Vector3(),_dC=new T.Color();
function dressFill(fx,fz){
  for(const K of DRESS.kinds){
    const im=K.im;if(!im)continue;let n=0;const cap=im.instanceMatrix.count,far2=K.far*K.far;
    for(const o of K.list){
      if(o.hid)continue;const dx=o.x-fx,dz=o.z-fz,d2=dx*dx+dz*dz;if(d2>far2||n>=cap)continue;
      const k=o.s*Math.min(1,(K.far-Math.sqrt(d2))/DRESS_FADE+0.05);
      _dQ.setFromAxisAngle(_mUp,o.ry);_dS.set(k,k,k);_dP.set(o.x,o.y,o.z);im.setMatrixAt(n,_dM.compose(_dP,_dQ,_dS));
      im.setColorAt(n,_dC.setScalar(o.tint));n++;
    }
    im.count=n;im.instanceMatrix.needsUpdate=true;im.instanceColor.needsUpdate=true;
  }
  DRESS.px=fx;DRESS.pz=fz;DRESS.dirty=false;
}
/* holes: anything standing inside a dug hole's rim goes (it would float over the pit), with its collider */
function dressHoleScan(){
  let changed=false;const hit=new Set();
  for(const h of holes){
    if(h.d<0.12)continue;const R=(h.r||HOLE_R)+0.35;
    for(let cx=Math.floor((h.x-R)/8);cx<=Math.floor((h.x+R)/8);cx++)for(let cz=Math.floor((h.z-R)/8);cz<=Math.floor((h.z+R)/8);cz++){
      const L=DRESS.grid.get((cx+512)*2048+cz+512);if(!L)continue;
      for(const o of L){const dx=o.x-h.x,dz=o.z-h.z,rr=R+o.r*0.5;if(dx*dx+dz*dz<rr*rr)hit.add(o)}
    }
  }
  for(const o of hit)if(!o.hid){o.hid=true;changed=true;if(o.col)o.col.x0=o.col.x1=1e9}
  for(const o of DRESS.hidden)if(!hit.has(o)){o.hid=false;changed=true;if(o.col){const s=DRESS.cols.find(c=>c.c===o.col);o.col.x0=s.x0;o.col.x1=s.x1}}
  DRESS.hidden=hit;if(changed)DRESS.dirty=true;
}
DRESS.hidden=new Set();

/* ---- 2. landmarks: colliders now, the model when it arrives ---- */
for(const L of LANDMARKS){
  L.y=baseH(L.x,L.z);
  for(const[dx,dz,w,d]of L.solids)dressSolid(L.x+dx,L.z+dz,w,d);
  placeModel(L.model,{x:L.x,y:L.y,z:L.z,ry:0},DRESS.group).catch(()=>{});
}
/* small diamonds on the minimap and field map (78-hud.js drawMap); names only on the big map */
function dressMap(mx,wx,wz,W,night,big){
  if(ZONE_H)return;
  for(const L of LANDMARKS){
    const X=wx(L.x),Z=wz(L.z);if(X<-8||Z<-8||X>W+8||Z>W+8)continue;
    mx.save();mx.translate(X,Z);mx.rotate(Math.PI/4);mx.fillStyle=night?'#b9a67c':'#6b4a2b';mx.strokeStyle=night?'#2b1d12':'#f3e6c8';mx.lineWidth=1.2;
    mx.fillRect(-3,-3,6,6);mx.strokeRect(-3,-3,6,6);mx.restore();
    if(big){mx.fillStyle=night?'#EDE2C8':'#2b1d12';mx.font='600 11px "Barlow Condensed",sans-serif';mx.textAlign='center';mx.textBaseline='top';mx.fillText(L.name,X,Z+7)}
  }
}

/* ---- 3. camp props ---- */
{
  const byModel={},glow=[];
  for(const p of DRESS_CAMP){
    const y=baseH(p.x,p.z)+(p.y||0);
    if(p.w)solid(p.x,p.z,Math.abs(Math.sin(p.ry))>0.7?p.d:p.w,Math.abs(Math.sin(p.ry))>0.7?p.w:p.d);
    if(p.posts)for(const k of[-1,1])solid(p.x+Math.cos(p.ry)*p.posts*k,p.z-Math.sin(p.ry)*p.posts*k,0.3,0.3);   // the model's long side is its x
    (byModel[p.m]=byModel[p.m]||[]).push({x:p.x,y,z:p.z,ry:p.ry});
    if(p.m==='DressLantern')glow.push({x:p.x,y:y+0.19,z:p.z});
  }
  for(const m in byModel)instanceModel(m,byModel[m]).catch(()=>{});
  // the lanterns' flames: a diamond of light just bigger than each glass, so it shows through the panes. Night only
  // (brighter than 1, so it blooms).
  const g=new T.InstancedMesh(new T.OctahedronGeometry(0.125,0),new T.MeshBasicMaterial({color:new T.Color(3.4,2.1,0.8),fog:false}),glow.length);
  glow.forEach((p,i)=>g.setMatrixAt(i,_dM.makeTranslation(p.x,p.y,p.z)));g.frustumCulled=false;g.visible=false;scene.add(g);DRESS.glow=g;
}

/* ---- every frame (90-loop.js): cheap checks, real work only when you have moved or a hole changed ---- */
function updateDressing(dt,fx,fz){
  const off=!!ZONE_H;
  if(off!==DRESS.parked){   // another map (88-zones.js): the lake's dressing and its colliders step aside, and come back with the lake
    DRESS.parked=off;DRESS.group.visible=!off;
    for(const s of DRESS.cols){s.c.x0=off?1e9:s.x0;s.c.x1=off?1e9:s.x1}
    if(!off){for(const o of DRESS.hidden)o.hid=false;DRESS.hidden=new Set();DRESS.dirty=true}
  }
  DRESS.glow.visible=!off&&typeof clockT==='function'&&clockT()>=DAYMS-20000;   // lit from dusk
  if(off)return;
  DRESS.scanT-=dt;if(DRESS.scanT<=0){DRESS.scanT=0.6;dressHoleScan()}
  const dx=fx-DRESS.px,dz=fz-DRESS.pz;
  if(DRESS.dirty||dx*dx+dz*dz>36)dressFill(fx,fz);
}
