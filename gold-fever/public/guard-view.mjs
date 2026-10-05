import {minerBody} from './miner-model.mjs';
import {textureMaterial} from './materials.mjs';
import * as THREE from '/vendor/three.module.js';
// Fully clothed cartoon prospectors: broad hats, overalls and an articulated hip dance.
export function createGuardView(scene,label){
  let receivedAt=0;const miners=new Map(),material=c=>textureMaterial(new THREE.MeshStandardMaterial({color:c,roughness:.94}),c),hat=material('#342421'),dark=material('#241f1c');
  const ballGeo=new THREE.SphereGeometry(1,24,16),boxGeo=new THREE.BoxGeometry(1,1,1);
  function ell(g,mat,x,y,z,sx,sy,sz){const m=new THREE.Mesh(ballGeo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
  function box(g,mat,x,y,z,w,h,d){const m=new THREE.Mesh(boxGeo,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;g.add(m);return m;}
  function build(s){
    const root=minerBody({guard:true}),{hips,body,head,legs,arms}=root.userData;scene.add(root);
    const pick=new THREE.Group();arms[1].add(pick);box(pick,hat,0,-.61,-.03,.045,.85,.045);box(pick,dark,0,-.96,-.03,.56,.09,.10);pick.rotation.z=-.15;
    const sign=label(s.name,2.65,'#fff0bd','#573627');sign.position.set(0,2.94,0);root.add(sign);
    const warning=label('HEY! MY CANYON!',2.7,'#ffdb70','#593a2a');warning.position.set(0,3.32,0);root.add(warning);warning.visible=false;
    const dust=new THREE.Group();root.add(dust);for(let i=0;i<6;i++){const m=ell(dust,material('#bf9a71'),Math.cos(i)*.65,.08,Math.sin(i)*.65,.08,.04,.08);m.castShadow=false;}dust.visible=false;
    root.userData={s,hips,body,head,legs,arms,pick,sign,warning,dust};root.position.set(s.x,s.y,s.z);return root;
  }
  function sync(items=[]){receivedAt=performance.now();const alive=new Set();for(const s of items){alive.add(s.id);let g=miners.get(s.id);if(!g){g=build(s);miners.set(s.id,g);}g.userData.s=s;}for(const [id,g]of miners)if(!alive.has(id)){scene.remove(g);miners.delete(id);}}
  function render(dt,time,now,local){for(const g of miners.values()){
    const {s,hips,body,head,legs,arms,pick,sign,warning,dust}=g.userData,dance=s.state==='dance',windup=s.state==='windup',chase=s.state==='chase',walk=chase||s.state==='patrol',phase=(now+Math.min(200,performance.now()-receivedAt)-s.stateAt)/1000;
    g.position.lerp(new THREE.Vector3(s.x,s.y,s.z),Math.min(1,dt*14));const turn=Math.atan2(Math.sin(s.yaw-g.rotation.y),Math.cos(s.yaw-g.rotation.y));g.rotation.y+=turn*Math.min(1,dt*12);
    hips.position.set(dance?Math.sin(phase*16)*.11:0,1.04+(dance?Math.abs(Math.sin(phase*16))*.075:windup?-.13:walk?Math.abs(Math.sin(time*9))*.035:0),dance?Math.sin(phase*16)*.16:0);
    hips.rotation.set(dance?.25+Math.sin(phase*16)*.18:windup?.18:0,0,dance?Math.sin(phase*8)*.12:0);body.rotation.x=dance?.55:windup?-.12:0;head.rotation.x=dance?-.4:0;
    legs.forEach((l,i)=>{l.rotation.x=dance?-.18+Math.sin(phase*16+i*.4)*.12:walk?Math.sin(time*(chase?11:6)+i*Math.PI)*.36:0;l.rotation.z=dance?(i?-.15:.15):0;});
    arms.forEach((a,i)=>{a.rotation.x=dance?-1.0:windup?-1.7:walk?-Math.sin(time*(chase?11:6)+i*Math.PI)*.38:.08;a.rotation.z=dance?(i?.65:-.65):windup?(i?.4:-.4):0;});pick.visible=!dance&&!windup;
    sign.visible=Math.hypot(local.x-s.x,local.y-s.y,local.z-s.z)<15;warning.visible=windup;warning.scale.setScalar(1+(windup?Math.sin(phase*14)*.04:0));dust.visible=dance;dust.rotation.y=phase*3;
  }}
  return {sync,render,reset(){for(const g of miners.values())scene.remove(g);miners.clear();},get metrics(){return [...miners.values()].map(g=>({id:g.userData.s.id,state:g.userData.s.state,hipRotation:g.userData.hips.rotation.x,hipOffset:g.userData.hips.position.z,pickVisible:g.userData.pick.visible}));}};
}

