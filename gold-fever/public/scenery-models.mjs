import * as THREE from '/vendor/three.module.js';
import {GLTFLoader} from '/vendor/loaders/GLTFLoader.js';
export function authoredRocks(scene,fallback){
 new GLTFLoader().load('/assets/nature/Rock_Medium_1.gltf',gltf=>{
  gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(!o.isMesh)return;
   const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.computeBoundingBox();const b=geometry.boundingBox,center=b.getCenter(new THREE.Vector3());geometry.translate(-center.x,-center.y,-center.z);geometry.scale(.65,.65,.65);
   const material=o.material;material.roughness=1;material.color.set('#9d9584');if(material.map)material.map.anisotropy=4;
   const rocks=new THREE.InstancedMesh(geometry,material,fallback.count);rocks.instanceMatrix.copy(fallback.instanceMatrix);rocks.castShadow=rocks.receiveShadow=true;rocks.frustumCulled=false;scene.add(rocks);
  });fallback.visible=false;
 },undefined,e=>console.error('Rock asset load failed',e));
}
