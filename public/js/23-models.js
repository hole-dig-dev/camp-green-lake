'use strict';
/* public/js/23-models.js -- the Blender-built camp: buildings, fence, signs and furniture.
   Models are GLBs in public/models/, made in Blender (one scene per asset; sources, build scripts and
   previews live on the art branch under art/blender/, see its README). Each asset is baked into one mesh
   with a few materials, its origin on the ground at its footprint centre, and its front facing +z.

   The box-built versions from 20-world.js / 22-security.js stay as the fallback: they are drawn until a
   model has loaded, and only then hidden. So a slow or failed download never leaves a hole in the camp.
   Collisions, interaction spots and bunk positions are untouched: models are purely the look. */

const MODEL_DIR='models/';
const MODEL_CACHE={};                      // name -> Promise<{meshes:[{geometry,material,matrix}]}>
const modelMatCache=new Map();             // GLB material -> game material (shared across every model)

/* Match the game's look: flat-shaded MeshStandardMaterial with no metalness. The camp has no environment
   map, so Blender's metallic steel would render nearly black; colour + roughness carry the look instead.
   Textured cut-outs (the chain link) use alphaTest so they sort and shadow like solid geometry. */
function gameMat(m){
  if(modelMatCache.has(m))return modelMatCache.get(m);
  // The renderer runs in the game's default linear output, where hex colours are used as-is; glTF stores colours
  // (and decodes textures) as linear light, which would come out much darker. Convert back so a model's paint
  // matches the palette it was built from.
  const g=new T.MeshStandardMaterial({color:m.color.clone().convertLinearToSRGB(),map:m.map||null,flatShading:true,roughness:Math.max(0.55,m.roughness),metalness:0});
  if(m.vertexColors)g.vertexColors=true;
  if(m.transparent){g.transparent=true;g.opacity=m.opacity;g.depthWrite=false}   // the peach jar's glass   // rocks carry their strata/sun-bleach as vertex colours
  if(m.map){m.map.encoding=T.LinearEncoding;g.alphaTest=0.45;g.transparent=false;g.side=T.DoubleSide;m.map.anisotropy=4}
  modelMatCache.set(m,g);return g;
}
/* vertex colours arrive as linear light (often as normalised 16-bit ints): turn them into the game's as-is floats */
function srgbVertexColors(geo){
  const a=geo.attributes.color;if(!a||geo.userData.srgb)return;geo.userData.srgb=true;
  const max=a.array instanceof Uint16Array?65535:a.array instanceof Uint8Array?255:1,c=new T.Color(),out=new Float32Array(a.count*3);
  for(let i=0;i<a.count;i++){c.setRGB(a.getX(i)/max,a.getY(i)/max,a.getZ(i)/max).convertLinearToSRGB();out[i*3]=c.r;out[i*3+1]=c.g;out[i*3+2]=c.b}
  geo.setAttribute('color',new T.BufferAttribute(out,3));
}
/* a model's parts baked to its own origin, for systems that run their own InstancedMesh pools (boulders, tumbleweeds) */
function modelParts(name){return loadModel(name).then(({meshes})=>meshes.map(p=>({geometry:p.geometry.clone().applyMatrix4(p.matrix),material:p.material})))}
function loadModel(name){
  if(!MODEL_CACHE[name])MODEL_CACHE[name]=new Promise((res,rej)=>{
    new T.GLTFLoader().load(MODEL_DIR+name+'.glb',gl=>{
      const root=gl.scene,meshes=[];root.updateMatrixWorld(true);
      root.traverse(o=>{if(o.isMesh){srgbVertexColors(o.geometry);meshes.push({geometry:o.geometry,material:gameMat(o.material),matrix:o.matrixWorld.clone()})}});
      res({meshes});
    },undefined,e=>{console.warn('model failed',name,e&&e.message);rej(e)});
  });
  return MODEL_CACHE[name];
}
const _mq=new T.Quaternion(),_mUp=new T.Vector3(0,1,0),_mS=new T.Vector3(),_mP=new T.Vector3(),_mM=new T.Matrix4();
function placeMatrix(p){_mq.setFromAxisAngle(_mUp,p.ry||0);const k=p.s||1;_mS.set((p.sx||1)*k,k,k);_mP.set(p.x,p.y,p.z);return new T.Matrix4().compose(_mP,_mq,_mS)}
/* Any number of copies of one model as ONE InstancedMesh per material: the whole fence is ~6 draw calls.
   (A single copy is a plain Mesh instead, so it can be culled.) */
function instanceModel(name,places,parent){
  return loadModel(name).then(({meshes})=>{
    const g=new T.Group();g.name=name;
    for(const part of meshes){
      if(places.length===1){   // a one-off building/sign: a plain mesh, so it gets frustum-culled when off screen
        const m=new T.Mesh(part.geometry,part.material);m.matrixAutoUpdate=false;m.matrix.multiplyMatrices(placeMatrix(places[0]),part.matrix);
        m.castShadow=true;m.receiveShadow=true;g.add(m);continue;
      }
      const im=new T.InstancedMesh(part.geometry,part.material,places.length);
      places.forEach((p,i)=>im.setMatrixAt(i,_mM.multiplyMatrices(placeMatrix(p),part.matrix)));
      im.instanceMatrix.needsUpdate=true;im.castShadow=true;im.receiveShadow=true;
      im.frustumCulled=false;   // the instances span the whole camp; one bounding sphere at the origin would cull them wrongly
      g.add(im);
    }
    (parent||scene).add(g);return g;
  });
}
const placeModel=(name,p,parent)=>instanceModel(name,[p],parent);
const hideProc=o=>{if(o)o.visible=false};   // swap: the box version goes once its model is in

/* ---- the watchtower's searchlight, cut out of the tower model ----
   In Watchtower.glb the lamp, its yoke and lens sit on the front rail (model space: |x|<0.34, y 8..9, z 1.1..1.9, with
   nothing else of the tower in that box), tipped 0.35 rad down. Those triangles become the lamp, re-centred on the
   yoke and levelled so it looks straight down +z like the head that carries it. */
const TOWER_LAMP_BOX={x:0.34,y0:8,y1:9,z0:1.1,z1:1.9},TOWER_LAMP_PIVOT=[0,8.55,1.25],TOWER_LAMP_TIP=0.35;
function splitGeometry(geo,keep){   // -> [triangles where keep(a,b,c) is true, the rest]; geo is non-indexed
  const pos=geo.attributes.position,n=pos.count/3,sel=[],rest=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(let t=0;t<n;t++){a.fromBufferAttribute(pos,t*3);b.fromBufferAttribute(pos,t*3+1);c.fromBufferAttribute(pos,t*3+2);(keep(a,b,c)?sel:rest).push(t)}
  const build=tris=>{if(!tris.length)return null;const g=new T.BufferGeometry();
    for(const name in geo.attributes){const at=geo.attributes[name],sz=at.itemSize,arr=new at.array.constructor(tris.length*3*sz);
      tris.forEach((t,i)=>arr.set(at.array.subarray(t*3*sz,(t+1)*3*sz),i*3*sz));g.setAttribute(name,new T.BufferAttribute(arr,sz,at.normalized))}
    return g};
  return[build(sel),build(rest)];
}
function towerLampSplit(meshes){
  const B=TOWER_LAMP_BOX,inBox=v=>Math.abs(v.x)<B.x&&v.y>B.y0&&v.y<B.y1&&v.z>B.z0&&v.z<B.z1,body=[],lamp=[];
  for(const part of meshes){
    let g=part.geometry.clone().applyMatrix4(part.matrix);if(g.index)g=g.toNonIndexed();
    const [l,rest]=splitGeometry(g,(a,b,c)=>inBox(a)&&inBox(b)&&inBox(c));
    if(rest)body.push({geometry:rest,material:part.material,matrix:new T.Matrix4()});
    if(l){l.translate(-TOWER_LAMP_PIVOT[0],-TOWER_LAMP_PIVOT[1],-TOWER_LAMP_PIVOT[2]).rotateX(-TOWER_LAMP_TIP);lamp.push({geometry:l,material:part.material,lens:!rest})}
  }
  return{body,lamp};
}
function towerLampMount(parts){
  for(const p of parts)if(p.lens){   // the lens (a part that was all lamp): its own material, so it can glow at night
    p.material=p.material.clone();p.material.emissive=p.material.color.clone();p.material.emissiveIntensity=0;TOWER_LENS_MAT=p.material}
  for(const o of WATCHTOWERS){
    for(const p of parts){const m=new T.Mesh(p.geometry,p.material);m.castShadow=true;o.head.add(m)}
    o.ph.visible=false;
  }
}

/* ---- the swaps ---- */
{
  const TENT_MODEL=t=>t.crew?'TentCrew':'TentSmall';
  for(const t of TENTS)if(!t.house)
    placeModel(TENT_MODEL(t),{x:t.x,y:baseH(t.x,t.z),z:t.z,ry:Math.PI}).then(()=>hideProc(t.ext)).catch(()=>{});   // door faces the yard (-z)
  placeModel('WreckRoom',{x:16,y:baseH(16,45),z:45,ry:Math.PI}).then(()=>hideProc(wreckCabin)).catch(()=>{});
  placeModel('WardenHouse',{x:-30,y:baseH(-30,45),z:45,ry:Math.PI}).then(()=>{hideProc(wardenCabin);hideProc(porch)}).catch(()=>{});
  placeModel('WaterTower',{x:25,y:baseH(25,49),z:49,ry:Math.PI}).then(()=>hideProc(WATER_TOWER_PROC)).catch(()=>{});
  // the tower goes up without its searchlight (square to the fence, ladder facing the yard); the lamp is cut out of the
  // model and mounted on each tower's swivelling head (22-security.js), so it points where its beam goes
  MODEL_CACHE.WatchtowerBody=loadModel('Watchtower').then(({meshes})=>{const k=towerLampSplit(meshes);towerLampMount(k.lamp);return{meshes:k.body}});
  instanceModel('WatchtowerBody',SIM.TOWERS.map(o=>({x:o.x,y:baseH(o.x,o.z),z:o.z,ry:towerRy(o)})))
    .then(()=>hideProc(TOWERS_PROC)).catch(()=>{});
  // fence: posts where 20-world.js put them; spans stretched to each gap (the model is 2.5 m long)
  Promise.all([instanceModel('FencePost',FENCE_POSTS),instanceModel('FenceSpan',FENCE_SPANS.map(s=>Object.assign({sx:s.len/2.5},s)))])
    .then(()=>hideProc(FENCE_PROC)).catch(()=>{});
  // signs: the painted camp sign and the Supply Depot's blade sign (SignWreckRoom) on its front corner
  placeModel('SignCampEntrance',{x:-11,y:baseH(-11,30.5),z:30.5,ry:Math.PI}).then(()=>hideProc(campSign)).catch(()=>{});
  placeModel('SignWreckRoom',{x:19.2,y:baseH(19.2,42.4),z:42.4,ry:Math.PI}).then(()=>hideProc(wreckSign)).catch(()=>{});
  // gates: the arch gate at the lake side and the sliding service gate on the east fence (outside faces away from camp)
  placeModel('MainGate',{x:0,y:baseH(0,FENCE_Z0),z:FENCE_Z0,ry:0}).then(()=>{hideProc(GATE_PROC);hideProc(mainGateSign)}).catch(()=>{});
  placeModel('ServiceGate',{x:FENCE_X1,y:baseH(FENCE_X1,39),z:39,ry:-Math.PI/2}).then(()=>hideProc(serviceGateSign)).catch(()=>{});
  // yard: the water truck (cab toward the gate, tap on the tents' side as before), flagpole, path lamps, the Warden's oaks,
  // and the crate stacks + mess tables from 22-security.js
  placeModel('WaterTruck',{x:5,y:baseH(5,36),z:36,ry:-Math.PI/2}).then(()=>hideProc(WATER_TRUCK_PROC)).catch(()=>{});
  placeModel('FlagPole',{x:-4,y:baseH(-4,38),z:38,ry:0}).then(()=>FLAG_PROC.forEach(hideProc)).catch(()=>{});
  instanceModel('LampPost',LAMP_POSTS).then(()=>hideProc(LAMP_PROC)).catch(()=>{});
  instanceModel('OakTree',OAKS.map(o=>({x:o.x,y:baseH(o.x,o.z),z:o.z,ry:o.x*0.7,s:o.s}))).then(()=>OAKS.forEach(o=>hideProc(o.g))).catch(()=>{});
  Promise.all([instanceModel('SupplyCrate',YARD_CRATES),instanceModel('MessTable',MESS_TABLES)]).then(()=>hideProc(YARD_PROC)).catch(()=>{});
  // room shells: floor, walls, roof/ceiling, windows, door and wall dressing, one per room type
  TENTS.forEach((t,ti)=>placeModel(t.house?'WardenRoom':t.crew?'TentRoomCrew':'TentRoomSmall',{x:t.x,y:TENT_FLOOR_Y,z:t.z,ry:0},ROOM_MESHES[ti])
    .then(()=>hideProc(ROOM_SHELL[ti])).catch(()=>{}));
  // furniture: models become children of each room mesh, so they show/hide with the room like the boxes did
  ROOM_FURN_SPOTS.forEach((spots,ti)=>{
    if(!spots||!spots.length)return;
    const byModel={};for(const p of spots)(byModel[p.m]=byModel[p.m]||[]).push(p);
    Promise.all(Object.keys(byModel).map(n=>instanceModel(n,byModel[n],ROOM_MESHES[ti]))).then(()=>hideProc(ROOM_FURN[ti])).catch(()=>{});
  });
}

/* ---- new props (nothing stood here before): collisions are added now, so they never depend on a download ---- */
const CAMP_PROPS=[
  {m:'SignLizardWarning',x:-8.5,z:24.6,ry:0,w:0.3,d:0.3},      // outside the main gate, facing campers on their way out
  {m:'SignLizardWarning',x:8.5,z:24.6,ry:0,w:0.3,d:0.3},
  {m:'SignDirections',x:-7.5,z:32.5,ry:0,w:0.3,d:0.3},         // just inside the gate
  {m:'WaterDrum',x:8.6,z:33.4,ry:0,w:0.65,d:0.65},             // by the water truck
  {m:'WaterDrum',x:9.3,z:34.2,ry:1.1,w:0.65,d:0.65},
  {m:'WaterDrum',x:8.5,z:34.9,ry:2.3,w:0.65,d:0.65},
  {m:'Bench',x:-12,z:42.3,ry:0,w:1.9,d:0.45},                  // between A and B Tents
  {m:'Bench',x:-26.5,z:39.2,ry:0,w:1.9,d:0.45},                // in front of the Warden's porch
  {m:'SupplyCrate',x:20.6,z:43.2,ry:0.2,w:0.95,d:0.95},        // by the Supply Depot window
  {m:'SupplyCrate',x:21.6,z:43.4,ry:-0.3,w:0.95,d:0.95},
  {m:'SupplyCrate',x:21.1,z:43.3,ry:0.9,w:0.1,d:0.1,y:0.9},    // stacked on the other two
  {m:'Hammock',x:-37.3,z:44,ry:Math.PI/2,w:1.4,d:3.9},          // the Warden's hammock, in the strip between her house and the fence
  {m:'ShowerBlock',x:15.5,z:52.6,ry:Math.PI,w:5.6,d:2.8},       // behind the Supply Depot, doors facing the yard
  {m:'Outhouse',x:-22.5,z:52.8,ry:Math.PI,w:1.5,d:1.5},         // behind A Tent
  {m:'Sifter',x:SIM.GOLD.SIFTER.x,z:SIM.GOLD.SIFTER.z,ry:SIM.GOLD.SIFTER.ry,w:2.6,d:1.5},   // the gold rush: sand in, gold out (art/blender/sifter.py, 45-state.js siftBucket)
  // Mr. Sir's pickup is placed by 87-truck.js: it can be driven
];
{
  const byModel={};
  for(const p of CAMP_PROPS){
    if(p.w>0.2){const q=Math.abs(Math.sin(p.ry||0))>0.7;solid(p.x,p.z,q?p.d:p.w,q?p.w:p.d)}   // footprint turns with the model
    (byModel[p.m]=byModel[p.m]||[]).push({x:p.x,y:baseH(p.x,p.z)+(p.y||0),z:p.z,ry:p.ry});
  }
  for(const n in byModel)instanceModel(n,byModel[n]).catch(()=>{});
}

/* ---- colliders for the new room dressing (added up front, like the props above; offsets from the room centre) ---- */
TENTS.forEach((t,ti)=>{
  const L=TENT_COLLIDERS[ti],at=(dx,dz,w,d)=>tentSolid(L,t.x+dx,t.z+dz,w,d);
  if(t.house){
    at(-2,t.roomD-0.5,2.8,1.0);                         // fireplace + hearth on the back wall
    at(t.roomW-0.35,5.5,0.65,1.25);                     // filing cabinets
    at(t.roomW-0.35,0.6,0.5,0.5);                       // water cooler
    at(t.roomW-0.4,-4.5,0.65,0.5);                      // nail-polish table
    at(-3,-(t.roomD-0.5),0.6,0.6);                      // coat rack by the door
  }else at(-3.2,-(t.roomD-0.35),2.3,0.6);              // shovel rack by the door
});

/* ---- lakebed rocks: the 30 pebbles from 15-terrain.js become three Blender rock shapes, plus a wider scatter
   across the lakebed (fixed seed so everyone sees the same rocks). Pebbles you can step over; bigger rocks are solid. ---- */
{
  const ROCK_SOLID_MIN=0.4;   // rock size (m) from which it blocks you: ~0.45 m tall once modelled
  const ROCK_SCATTER_N=260,ROCK_SCATTER_R=420,rnd=mulberry32(90210),byV=[[],[],[]];
  const rockSolid=(x,z,sz)=>{if(sz>=ROCK_SOLID_MIN)solid(x,z,sz*2.4,sz*2.4)};   // knee-high and up; a model rock is ~3.3x its size across
  TERRAIN_ROCKS.forEach((r,i)=>{byV[i%3].push({x:r.x,y:r.y,z:r.z,ry:r.ry,s:r.size/0.3});rockSolid(r.x,r.z,r.size)});
  for(let i=0;i<ROCK_SCATTER_N;i++){
    const a=rnd()*Math.PI*2,d=30+Math.sqrt(rnd())*ROCK_SCATTER_R,x=Math.cos(a)*d,z=20+Math.sin(a)*d,sz=0.2+rnd()*rnd()*1.1;
    if(Math.max(Math.abs(x),Math.abs(z))>EDGE-8||nearCampZone(x,z))continue;
    byV[i%3].push({x,y:baseH(x,z),z,ry:rnd()*6.28,s:sz/0.3});rockSolid(x,z,sz);
  }
  Promise.all(['RockA','RockB','RockC'].map((n,i)=>instanceModel(n,byV[i]))).then(()=>TERRAIN_ROCKS.forEach(r=>hideProc(r.m))).catch(()=>{});
}

/* ---- dug-up finds: Blender models for the item that pops out of your hole (40-fx.js itemMesh). Real size is tiny
   (the KB tube is 8.5 cm), so each is scaled up to read at game distance, like the old stand-ins. ---- */
const ITEM_MODELS={};                 // LOOT type -> a ready Group to clone
const ITEM_MODEL_LIST={crate:['LootCrate',1.4],tools:['LootTools',1.4],jug:['LootJug',1.5],kb:['KBTube',5],safe:['FindSafe',1],strongbox:['FindStrongbox',1],suitcase:['FindSuitcase',1.15],lipstick:['FindLipstick',3],sploosh:['FindSploosh',2.2],locket:['FindLocket',4],pistol:['FindPistol',1.4],cap:['FindBottleCap',6],can:['FindCan',2],spoon:['FindSpoon',2,-Math.PI/2],shoe:['FindHorseshoe',2.6,Math.PI/2],arrow:['FindArrowhead',4.5],jar:['FindPeaches',2.2],fossil:['FindFossil',2.2]};   // [model, scale]: ~43 cm, a touch bigger than the old stand-in so the KB reads
for(const type in ITEM_MODEL_LIST){
  const[name,scale,stand]=ITEM_MODEL_LIST[type];   // stand: tip a flat-lying find upright (radians about x) so it shows its face while it spins
  loadModel(name).then(({meshes})=>{
    const g=new T.Group(),inner=new T.Group();inner.rotation.x=stand||0;g.add(inner);
    for(const p of meshes){const m=new T.Mesh(p.geometry,p.material);m.applyMatrix4(p.matrix);m.castShadow=true;inner.add(m)}
    g.scale.setScalar(scale);ITEM_MODELS[type]=g;
  }).catch(()=>{});
}
