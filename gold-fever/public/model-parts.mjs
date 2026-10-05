import * as THREE from '/vendor/three.module.js';
import {textureMaterial} from './materials.mjs';

// Shared geometry and smooth shading for sculpted props; no simulation dependency.
const geometries=new Map(),materials=new Map();
export function surface(color,extra={}){
  const key=color+JSON.stringify(extra);
  if(!materials.has(key))materials.set(key,textureMaterial(new THREE.MeshStandardMaterial({color,roughness:.82,flatShading:false,...extra}),color));
  return materials.get(key);
}
export function part(parent,geometry,material,x=0,y=0,z=0){
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
export function roundedGeometry(w,h,d,r=.08){
  r=Math.min(r,w*.49,h*.49,d*.49);const key=`box:${w}:${h}:${d}:${r}`;
  if(!geometries.has(key)){
    const geo=new THREE.BoxGeometry(1,1,1,8,8,8),p=geo.attributes.position,n=geo.attributes.normal;
    const v=new THREE.Vector3(),core=new THREE.Vector3(),normal=new THREE.Vector3();
    const stretch=(q,half)=>Math.sign(q)*(Math.abs(q)<=.25?Math.abs(q)*4*(half-r):half-r+(Math.abs(q)-.25)*4*r);
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);v.set(stretch(v.x,w/2),stretch(v.y,h/2),stretch(v.z,d/2));core.set(THREE.MathUtils.clamp(v.x,-w/2+r,w/2-r),THREE.MathUtils.clamp(v.y,-h/2+r,h/2-r),THREE.MathUtils.clamp(v.z,-d/2+r,d/2-r));
      normal.copy(v).sub(core).normalize();v.copy(core).addScaledVector(normal,r);p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    geo.computeBoundingSphere();geometries.set(key,geo);
  }
  return geometries.get(key);
}
export const softBox=(g,w,h,d,m,x=0,y=0,z=0,r=.08)=>part(g,roundedGeometry(w,h,d,r),m,x,y,z);
export function ellipsoid(g,m,x,y,z,sx,sy,sz){
  if(!geometries.has('sphere'))geometries.set('sphere',new THREE.SphereGeometry(1,24,16));
  const mesh=part(g,geometries.get('sphere'),m,x,y,z);mesh.scale.set(sx,sy,sz);return mesh;
}
export function tube(g,r1,r2,h,m,x=0,y=0,z=0){
  const key=`cylinder:${r1}:${r2}:${h}`;if(!geometries.has(key))geometries.set(key,new THREE.CylinderGeometry(r1,r2,h,24));
  return part(g,geometries.get(key),m,x,y,z);
}
export function ring(g,r,t,m,x=0,y=0,z=0){
  const key=`ring:${r}:${t}`;if(!geometries.has(key))geometries.set(key,new THREE.TorusGeometry(r,t,8,32));
  return part(g,geometries.get(key),m,x,y,z);
}
export function strut(g,a,b,r,m){
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),mesh=tube(g,r,r,A.distanceTo(B),m);
  mesh.position.copy(A.clone().add(B).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.sub(A).normalize());return mesh;
}
export function pipe(g,points,r,m){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return part(g,new THREE.TubeGeometry(curve,16,r,6,false),m);
}

const mergedGeometries=new Map();
export function mergeStaticParts(group){
  // Merge only fixed siblings. Head, hips, hat and each limb retain their pivots.
  for(const child of [...group.children])if(child.isGroup)mergeStaticParts(child);
  const batches=new Map();for(const child of group.children)if(child.isMesh&&!Array.isArray(child.material)){if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(child);}
  for(const [material,meshes]of batches){
    if(meshes.length<2)continue;for(const m of meshes)m.updateMatrix();
    const key=meshes.map(m=>`${m.geometry.uuid}:${m.matrix.elements.join(',')}`).join('|');let geometry=mergedGeometries.get(key);
    if(!geometry){
      const arrays={position:[],normal:[],uv:[]},indices=[];let offset=0;
      for(const m of meshes){const geo=m.geometry.clone().applyMatrix4(m.matrix);for(const name of Object.keys(arrays))arrays[name].push(...geo.attributes[name].array);const index=geo.index?.array??Array.from({length:geo.attributes.position.count},(_,i)=>i);for(const i of index)indices.push(i+offset);offset+=geo.attributes.position.count;geo.dispose();}
      geometry=new THREE.BufferGeometry();for(const [name,data]of Object.entries(arrays))geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,name==='uv'?2:3));geometry.setIndex(indices);geometry.computeBoundingSphere();mergedGeometries.set(key,geometry);
    }
    for(const m of meshes)group.remove(m);part(group,geometry,material);
  }
}
