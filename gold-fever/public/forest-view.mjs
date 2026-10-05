import {logMaterials} from './materials.mjs';
import * as THREE from '/vendor/three.module.js';
import {GLTFLoader} from '/vendor/loaders/GLTFLoader.js';
import {FOREST_TREES,heightAt,random,nearWater,protectedGround} from '/shared/world.mjs';
import {inCanyon} from '/shared/canyon.mjs';

export function createForestView(scene,{label}){
 const {bark,cap}=logMaterials(),dummy=new THREE.Object3D(),fallen=new Map(),stacks=new Map();
 const batches=[],templates=[],decorations=[];let state={trees:{},stacks:[]},cells={},key='',loaded=false,failed=[],lastLocal={x:0,z:0},lastTreeX=Infinity,lastTreeZ=Infinity;
 const fallback=new THREE.InstancedMesh(new THREE.CylinderGeometry(.15,.25,5,10),bark,FOREST_TREES.length);fallback.castShadow=true;scene.add(fallback);
 const loader=new GLTFLoader();
 /* our own pines (Sol, art/blender/pines.py): real metres and their own vertex colours; the old Quaternius ones were stretched to 7.5 m and tinted */
 function prepare(model,real=false){
  model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),scale=real?1:7.5/(bounds.max.y-bounds.min.y);
  const parts=[];model.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);geometry.scale(scale,scale,scale);
   const m=o.material;m.roughness=1;m.metalness=0;m.envMapIntensity=.5;
   if(m.normalMap)m.normalScale.set(.45,.45);if(m.map)m.map.anisotropy=4;
   if(m.name.includes('Leaves')){m.alphaTest=.40;m.transparent=false;m.color.set('#ced9bf');m.emissive.set('#788b56');m.emissiveIntensity=.16;}
   parts.push({geometry,material:m});
  });return parts;
 }
 const PINES=[...Array(10)].map((_,i)=>'pine-'+String(i+1).padStart(2,'0'));   /* templates 0-9 near, 10-19 their far versions */
 Promise.all([...PINES,...PINES.map(n=>n+'-far')].map(name=>loader.loadAsync('/assets/trees/'+name+'.glb'))).then(models=>{
  for(const model of models)templates.push(prepare(model.scene,true));
  for(let variant=0;variant<templates.length;variant++)for(const part of templates[variant]){
   const m=new THREE.InstancedMesh(part.geometry,part.material,FOREST_TREES.length);m.userData.variant=variant;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;scene.add(m);batches.push(m);
  }
  loaded=true;fallback.visible=false;key='';sync(state,cells);
 }).catch(e=>{failed.push('trees');console.error('Forest asset load failed',e);});
 // Authored foliage adds ground detail without changing mining or collision.
 for(const [name,count]of[['Grass_Common_Short',700],['Bush_Common',65]]){
  loader.loadAsync('/assets/nature/'+name+'.gltf').then(gltf=>{
   gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld),m=o.material;m.roughness=1;m.color.set(name.startsWith('Grass')?'#b0a073':'#98aa77');
    if(name==='Bush_Common'){
     m.color.set('#70844a');m.emissive.set('#465635');m.emissiveIntensity=.12;
     m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
       vec4 leafTexel=texture2D(map,vMapUv);diffuseColor.rgb*=.65+dot(leafTexel.rgb,vec3(.2126,.7152,.0722))*1.5;diffuseColor.a*=leafTexel.a;
       #endif`);};m.customProgramCacheKey=()=> 'gf-sage-bush-1';
    }
    const batch=new THREE.InstancedMesh(geo,m,count);batch.receiveShadow=true;batch.castShadow=!name.startsWith('Grass');batch.frustumCulled=false;
    const spots=[];for(let i=0;i<count*8&&spots.length<count;i++){
     const x=random(481,i)*220-110,z=random(482,i)*220-110;
     if(protectedGround(x,z)||inCanyon(x,z)||nearWater(x,z,7))continue;
     const water=nearWater(x,z,24),tree=FOREST_TREES[i%FOREST_TREES.length];
     if(!water&&Math.hypot(x-tree.x,z-tree.z)>20&&random(483,i)>.24)continue;
     spots.push({x,z,scale:name.startsWith('Grass')?.4+random(484,i)*.6:.5+random(484,i)*.55,yaw:random(485,i)*6.28});
    }
    batch.count=spots.length;decorations.push({batch,spots});scene.add(batch);updateDecoration(cells);
   });
  }).catch(e=>{failed.push(name);console.error('Foliage asset load failed',e);});
 }
 function updateDecoration(c){for(const {batch,spots}of decorations){spots.forEach((s,i)=>{dummy.position.set(s.x,heightAt(s.x,s.z,c),s.z);dummy.rotation.set(0,s.yaw,0);dummy.scale.setScalar(s.scale);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.instanceMatrix.needsUpdate=true;}}
 function updateTrees(local){
  for(const m of batches){let count=0;FOREST_TREES.forEach((t,i)=>{
   if(state.trees?.[t.id]?.felledAt!==undefined)return;
   const distance=Math.hypot(t.x-local.x,t.z-local.z),variant=distance<70?i%10:10+i%10;
   if(variant!==m.userData.variant)return;
   dummy.position.set(t.x,heightAt(t.x,t.z,cells),t.z);dummy.rotation.set(0,random(671,i)*Math.PI*2,0);dummy.scale.setScalar(t.scale);dummy.updateMatrix();m.setMatrixAt(count++,dummy.matrix);
  });m.count=count;m.instanceMatrix.needsUpdate=true;}
  lastTreeX=local.x;lastTreeZ=local.z;
 }
 function logPile(){const g=new THREE.Group();for(let i=0;i<6;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,1.5,12),[bark,cap,cap]);log.castShadow=log.receiveShadow=true;log.rotation.z=Math.PI/2;log.position.set(0,.18+Math.floor(i/3)*.27,(i%3-1)*.3);g.add(log);}g.userData.sign=label('LOGS · E',1.5);g.userData.sign.position.y=1;g.add(g.userData.sign);return g;}
 function dispose(g){if(g.userData.stump){scene.remove(g.userData.stump);g.userData.stump.geometry.dispose();}scene.remove(g);if(!g.userData.sharedTree)g.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}
 function makeFallen(t,cut,y,i){const g=new THREE.Group();g.userData.sharedTree=loaded;
  if(loaded)for(const p of templates[i%10]){const m=new THREE.Mesh(p.geometry,p.material);m.castShadow=m.receiveShadow=true;g.add(m);}else {const stem=new THREE.Mesh(new THREE.CylinderGeometry(.15,.25,5,10),bark);stem.position.y=2.5;g.add(stem);}
  g.scale.setScalar(t.scale);g.position.set(t.x,y,t.z);g.rotation.y=cut.yaw;g.userData.cut=cut;
  const stump=new THREE.Mesh(new THREE.CylinderGeometry(.19*t.scale,.26*t.scale,.36,12),[bark,cap,cap]);stump.position.set(t.x,y+.18,t.z);stump.castShadow=true;scene.add(stump);g.userData.stump=stump;scene.add(g);return g;
 }
 function sync(f={},c={}){state=f;cells=c;const next=JSON.stringify(f)+Object.entries(c).reduce((s,[k,v])=>s+k+v,'');if(key===next)return;key=next;
  FOREST_TREES.forEach((t,i)=>{const cut=state.trees?.[t.id],y=heightAt(t.x,t.z,cells),isCut=cut?.felledAt!==undefined;
   dummy.rotation.set(0,random(671,i)*Math.PI*2,0);dummy.position.set(t.x,y,t.z);
   dummy.scale.setScalar(isCut?0:t.scale);dummy.position.y=y+2.5*t.scale;dummy.updateMatrix();fallback.setMatrixAt(i,dummy.matrix);
   if(isCut&&!fallen.has(t.id))fallen.set(t.id,makeFallen(t,cut,y,i));else if(fallen.has(t.id))fallen.get(t.id).userData.cut=cut;
  });
  fallback.instanceMatrix.needsUpdate=true;updateTrees(lastLocal);updateDecoration(cells);
  const entries=[...FOREST_TREES.filter(t=>state.trees?.[t.id]?.logs>0).map(t=>({...t,y:heightAt(t.x,t.z,cells),logs:state.trees[t.id].logs,felledAt:state.trees[t.id].felledAt})),...(state.stacks||[])],alive=new Set();
  for(const s of entries){alive.add(s.id);let g=stacks.get(s.id);if(!g){g=logPile();scene.add(g);stacks.set(s.id,g);}g.position.set(s.x,s.y,s.z);g.userData.state=s;for(let i=0;i<6;i++)g.children[i].visible=i<s.logs;}
  for(const[id,g]of stacks)if(!alive.has(id)){dispose(g);stacks.delete(id);}
 }
 function render(local,now){lastLocal={x:local.x,z:local.z};if(Math.hypot(local.x-lastTreeX,local.z-lastTreeZ)>6)updateTrees(local);for(const g of fallen.values()){const age=(now-g.userData.cut.felledAt)/1000;g.rotation.x=-Math.min(Math.PI/2,Math.max(0,age/1.4)**2*Math.PI/2);g.visible=age<1.8;}for(const g of stacks.values()){const s=g.userData.state;g.visible=!s.felledAt||now>s.felledAt+1400;g.userData.sign.visible=Math.hypot(local.x-s.x,local.y-s.y,local.z-s.z)<9;}}
 sync();return {sync,render,get metrics(){return {standing:FOREST_TREES.length-fallen.size,felled:fallen.size,logPiles:stacks.size,authoredTrees:loaded,failed,foliagePatches:decorations.reduce((n,d)=>n+d.spots.length,0)};},reset(){for(const g of fallen.values())dispose(g);for(const g of stacks.values())dispose(g);fallen.clear();stacks.clear();key='';sync();}};
}
