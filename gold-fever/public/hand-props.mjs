import * as THREE from '/vendor/three.module.js';
import {surface,part,tube,ring,softBox} from './model-parts.mjs';
import {random} from '/shared/world.mjs';
const wood=surface('#88603d'),darkWood=surface('#523c2b'),iron=surface('#424b4c'),steel=surface('#667070',{metalness:.45,roughness:.54}),earth=surface('#725039');
let staveGeometry,bladeGeometry;
export function bucketProp(){
 const g=new THREE.Group();
 if(!staveGeometry){const points=[[.30,.025],[.35,.56],[.321,.56],[.27,.025],[.30,.025]].map(([x,y])=>new THREE.Vector2(x,y));staveGeometry=new THREE.LatheGeometry(points,4,0,Math.PI*2/24-.006);}
 // Each stave has a curved inner and outer face, retaining an opaque bucket wall.
 for(let i=0;i<24;i++){const stave=part(g,staveGeometry,i%5===0?darkWood:wood);stave.rotation.y=i/24*Math.PI*2;}
 for(const y of[.12,.48]){const rim=ring(g,.348+(y-.12)*.09,.019,iron,0,y,0);rim.rotation.x=Math.PI/2;}
 tube(g,.283,.285,.035,wood,0,.032,0);
 const dirt=tube(g,.29,.29,.12,earth,0,.15,0);g.userData.fill=dirt;
 const handle=part(g,new THREE.TorusGeometry(.35,.013,8,48,Math.PI),iron,0,.53,0);handle.rotation.z=.15;
 for(const side of[-1,1]){const pin=tube(g,.03,.03,.06,iron,side*.355,.53,0);pin.rotation.z=Math.PI/2;}
 return g;
}
export function shovelProp(){
 const g=new THREE.Group();tube(g,.031,.035,1.1,wood,0,.10,0);
 for(const side of[-1,1])softBox(g,.032,.18,.045,iron,side*.105,.60,0,.01);tube(g,.027,.027,.22,darkWood,0,.70,0).rotation.z=Math.PI/2;
 const blade=new THREE.Group();blade.position.set(0,-.56,0);g.add(blade);
 if(!bladeGeometry){
  const p=[],uv=[],index=[],cols=12,rows=14;
  for(let y=0;y<=rows;y++){const t=y/rows,width=.19*Math.sin(.08+t*1.45),height=(t-.5)*.45;
   for(let x=0;x<=cols;x++){const u=x/cols,v=(u-.5)*2;p.push(v*width,height,.02+.08*(1-v*v)+.035*Math.sin(t*Math.PI));uv.push(u,t);if(y<rows&&x<cols){const k=y*(cols+1)+x;index.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}
  }
  bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));bladeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));bladeGeometry.setIndex(index);bladeGeometry.computeVertexNormals();
 }
 const material=steel.clone();material.onBeforeCompile=steel.onBeforeCompile;material.customProgramCacheKey=steel.customProgramCacheKey;material.side=THREE.DoubleSide;part(blade,bladeGeometry,material);
 tube(g,.041,.047,.18,iron,0,-.41,.04);
 const load=new THREE.Group();blade.add(load);const clod=new THREE.IcosahedronGeometry(.14,1);
 for(let i=0;i<8;i++){const m=part(load,clod,earth,(random(81,i)-.5)*.25,(random(82,i)-.5)*.22,.10+random(83,i)*.09);m.scale.set(.65,.65,.42);}load.visible=false;g.userData.load=load;return g;
}
