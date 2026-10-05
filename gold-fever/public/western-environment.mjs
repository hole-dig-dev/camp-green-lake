import * as THREE from '/vendor/three.module.js';
import {HDRLoader} from '/vendor/loaders/HDRLoader.js';
import {random} from '/shared/world.mjs';
import {groundMaterial} from './materials.mjs';

export function westernEnvironment(scene,renderer,sun,skyLight){
 const air=new THREE.Color('#c4cbd0'),dark=new THREE.Color('#191b1c');let sky=null,environment=null,status='loading';
 const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
 new HDRLoader().load('/assets/nature/western-sky.hdr',texture=>{
  texture.mapping=THREE.EquirectangularReflectionMapping;
  environment=pmrem.fromEquirectangular(texture).texture;sky=texture;status='ready';pmrem.dispose();
 },undefined,()=>{status='fallback';pmrem.dispose();});
 // Irregular ridgelines replace the repeated triangle mountains. Outside playable land.
 const N=256,rings=25,position=[],index=[],colors=[];
 for(let layer=0;layer<rings;layer++){
  for(let i=0;i<=N;i++){
   const a=i/N*Math.PI*2,r=130+layer*9;
   const ridge=52+18*Math.sin(a*5+.9)+12*Math.sin(a*11+1.2)+9*Math.sin(a*21);
   const profile=Math.sin(layer/(rings-1)*Math.PI);
   // Folded rock ribs and drainage gullies, rather than broad cone faces.
   const folds=(Math.sin(a*83+layer*.09)*5+Math.sin(a*137-layer*.045)*2.5)*profile;
   const h=-12+profile*ridge+folds+Math.sin(layer*.65+a*31)*profile*3;
   position.push(Math.sin(a)*r,h,Math.cos(a)*r);
   const c=new THREE.Color('#776450').lerp(new THREE.Color('#aaa18c'),.25+.25*Math.sin(h*.65)+.12*Math.sin(h*.17));c.multiplyScalar(.86+random(62,i%N,layer)*.14);colors.push(c.r,c.g,c.b);
   if(layer<rings-1&&i<N){const k=layer*(N+1)+i;index.push(k,k+N+1,k+1,k+1,k+N+1,k+N+2);}
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(index);geo.computeVertexNormals();
 const mountains=new THREE.Mesh(geo,groundMaterial({mine:true}));scene.add(mountains);
 renderer.toneMappingExposure=.92;
 scene.backgroundIntensity=.70;scene.backgroundRotation.y=1.5;scene.environmentRotation.y=1.5;
 sun.color.set('#ffe2ba');sun.shadow.normalBias=.045;sun.shadow.bias=-.00012;sun.shadow.radius=3;
 Object.assign(sun.shadow.camera,{left:-38,right:38,top:38,bottom:-38,near:1,far:170});sun.shadow.camera.updateProjectionMatrix();
 skyLight.color.set('#b5c9e0');skyLight.groundColor.set('#57483b');
 return {
  update(local,underground){
   scene.background=underground?dark:(sky||air);scene.environment=underground?null:environment;
   scene.environmentIntensity=.40;skyLight.intensity=underground?.55:.82;sun.intensity=underground?0:3.15;
   scene.fog.color.copy(underground?dark:air);scene.fog.near=underground?12:105;scene.fog.far=underground?38:370;
   mountains.visible=!underground;
   // A smaller moving shadow region keeps machinery/boots sharply grounded.
   const x=Math.round(local.x/4)*4,z=Math.round(local.z/4)*4,y=local.y||0;
   sun.position.set(x-46,y+60,z+32);sun.target.position.set(x,y,z);
  },get metrics(){return {sky:status,style:'rugged Western',environmentIntensity:scene.environmentIntensity};}
 };
}
