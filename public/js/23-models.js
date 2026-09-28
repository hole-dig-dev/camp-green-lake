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
  if(m.map){m.map.encoding=T.LinearEncoding;g.alphaTest=0.45;g.transparent=false;g.side=T.DoubleSide;m.map.anisotropy=4}
  modelMatCache.set(m,g);return g;
}
function loadModel(name){
  if(!MODEL_CACHE[name])MODEL_CACHE[name]=new Promise((res,rej)=>{
    new T.GLTFLoader().load(MODEL_DIR+name+'.glb',gl=>{
      const root=gl.scene,meshes=[];root.updateMatrixWorld(true);
      root.traverse(o=>{if(o.isMesh)meshes.push({geometry:o.geometry,material:gameMat(o.material),matrix:o.matrixWorld.clone()})});
      res({meshes});
    },undefined,e=>{console.warn('model failed',name,e&&e.message);rej(e)});
  });
  return MODEL_CACHE[name];
}
const _mq=new T.Quaternion(),_mUp=new T.Vector3(0,1,0),_mS=new T.Vector3(),_mP=new T.Vector3(),_mM=new T.Matrix4();
function placeMatrix(p){_mq.setFromAxisAngle(_mUp,p.ry||0);_mS.set(p.sx||1,1,1);_mP.set(p.x,p.y,p.z);return new T.Matrix4().compose(_mP,_mq,_mS)}
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

/* ---- the swaps ---- */
{
  const TENT_MODEL=t=>t.crew?'TentCrew':'TentSmall';
  for(const t of TENTS)if(!t.house)
    placeModel(TENT_MODEL(t),{x:t.x,y:baseH(t.x,t.z),z:t.z,ry:Math.PI}).then(()=>hideProc(t.ext)).catch(()=>{});   // door faces the yard (-z)
  placeModel('WreckRoom',{x:16,y:baseH(16,45),z:45,ry:Math.PI}).then(()=>hideProc(wreckCabin)).catch(()=>{});
  placeModel('WardenHouse',{x:-30,y:baseH(-30,45),z:45,ry:Math.PI}).then(()=>{hideProc(wardenCabin);hideProc(porch)}).catch(()=>{});
  placeModel('WaterTower',{x:25,y:baseH(25,49),z:49,ry:Math.PI}).then(()=>hideProc(WATER_TOWER_PROC)).catch(()=>{});
  instanceModel('Watchtower',SIM.TOWERS.map(o=>({x:o.x,y:baseH(o.x,o.z),z:o.z,ry:Math.atan2(-o.x,-(o.z-41))})))   // searchlight side toward the camp centre
    .then(()=>hideProc(TOWERS_PROC)).catch(()=>{});
  // fence: posts where 20-world.js put them; spans stretched to each gap (the model is 2.5 m long)
  Promise.all([instanceModel('FencePost',FENCE_POSTS),instanceModel('FenceSpan',FENCE_SPANS.map(s=>Object.assign({sx:s.len/2.5},s)))])
    .then(()=>hideProc(FENCE_PROC)).catch(()=>{});
  // signs: the painted camp sign and the Wreck Room's blade sign on its front corner
  placeModel('SignCampEntrance',{x:-11,y:baseH(-11,30.5),z:30.5,ry:Math.PI}).then(()=>hideProc(campSign)).catch(()=>{});
  placeModel('SignWreckRoom',{x:19.2,y:baseH(19.2,42.4),z:42.4,ry:Math.PI}).then(()=>hideProc(wreckSign)).catch(()=>{});
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
  {m:'SupplyCrate',x:20.6,z:43.2,ry:0.2,w:0.95,d:0.95},        // by the Wreck Room door
  {m:'SupplyCrate',x:21.6,z:43.4,ry:-0.3,w:0.95,d:0.95},
  {m:'SupplyCrate',x:21.1,z:43.3,ry:0.9,w:0.1,d:0.1,y:0.9},    // stacked on the other two
];
{
  const byModel={};
  for(const p of CAMP_PROPS){
    if(p.w>0.2)solid(p.x,p.z,p.w,p.d);
    (byModel[p.m]=byModel[p.m]||[]).push({x:p.x,y:baseH(p.x,p.z)+(p.y||0),z:p.z,ry:p.ry});
  }
  for(const n in byModel)instanceModel(n,byModel[n]).catch(()=>{});
}
