// Camp Green Lake's camper in Gold Fever (JT 2026-10-05: "bring our characters in from our other game ... we can always
// revert"). The Blender camper (assets/characters/camper.glb, from camp-green-lake public/models): a rigid-segment rig
// (12 bones, body parts parented to them), 13 clips, the camp shovel built into the right forearm, three hats.
// camperBody() replaces minerBody() for players and the town NPCs; camperAnimate() picks the clip from the player state,
// and drives the Dig clip by the real shovel gesture: planted = blade pushed in (0.31 s of Dig), loaded = scoop lifted
// to the chest (0.60 s), thrown = the rest of the swing (0.60 -> 1.23 s), instead of looping it.
import * as THREE from '/vendor/three.module.js';
import {GLTFLoader} from '/vendor/loaders/GLTFLoader.js';
import {clone as skeletonClone} from '/vendor/utils/SkeletonUtils.js';   /* the legs and sleeves are skinned: a plain clone() leaves them bound to the template's bones */
import {random} from '/shared/world.mjs';

export const CAMPER_SCALE=.68;   // the same scale Camp Green Lake uses: about 1.87 m tall, eyes near Gold Fever's 1.65 m
const OUTFITS=['#507d86','#ba6653','#73914f','#a48b51','#837496','#4d9790','#b38555','#667fb8'];   // Gold Fever's player colours
const HATS=['Cowboy','Bucket','DesertCap'];
let template=null,clips=[];
try{const g=await new GLTFLoader().loadAsync('/assets/characters/camper.glb');template=g.scene;clips=g.animations;}
catch(e){console.error('Camper model failed to load; using the original prospector',e);}
export const camperReady=()=>!!template;

/* the camp shovel's parts, in the right forearm (CGLCamper_R_Shovel*; the *Long ones are the long-handled variant) */
const isShovel=n=>/_R_Shovel/.test(n),isLong=n=>/Long$/.test(n);
/* the two-handed Scoop clip (Sol, Camp Green Lake blender/cgl_rig.py anim_scoop, SCOOP_TIMES): plant, lever the blade
   up, lift it level to the waist (held while you carry the load), toss to the right, recover. JT: Dig read as a stab */
const THROW_MS=650;   /* the toss and recover, played at about the clip's speed */
export const DIG={planted:.267,levered:.533,loaded:.833,tossed:1.167,end:1.5};

export function camperBody({color=0}={}){
  const root=new THREE.Group(),inner=skeletonClone(template);
  inner.rotation.y=Math.PI;inner.scale.setScalar(CAMPER_SCALE);root.add(inner);   // the camper faces +Z; Gold Fever's body faces -Z
  const tint=new THREE.Color(OUTFITS[color%OUTFITS.length]),hat=HATS[color%HATS.length],shovel=[];
  inner.traverse(o=>{
    if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;o.frustumCulled=false;
    if(/_(Cowboy|Bucket|DesertCap)_/.test(o.name))o.visible=o.name.includes('_'+hat+'_');
    if(/Shades/.test(o.name))o.visible=false;
    if(isShovel(o.name)){if(isLong(o.name))o.visible=false;else shovel.push(o);}
    if(o.material&&(o.material.name==='CGL_HatBand'||o.material.name==='CGL_Patch')){o.material=o.material.clone();o.material.color.copy(tint);}   // the player's colour on the hat band and the name patch
  });
  const bone=n=>inner.getObjectByName(n),forearm=bone('forearmR'),hand=bone('CGLCamper_R_Hand'),blade=bone('CGLCamper_R_ShovelBlade');
  /* other hand tools (pick, axe, divining rod) hang off the right hand along the shovel's shaft, in real metres */
  const holder=new THREE.Group();forearm.add(holder);holder.position.copy(hand.position);holder.scale.setScalar(1/CAMPER_SCALE);
  const cap=bone('CGLCamper_R_ShovelCap'),dir=blade.position.clone().sub(cap.position).normalize();
  holder.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),dir);
  /* dirt on the blade when the shovel's loaded */
  const load=new THREE.Group(),clod=new THREE.IcosahedronGeometry(.11,1),earth=new THREE.MeshStandardMaterial({color:'#6e5b3d',roughness:1});
  for(let i=0;i<7;i++){const m=new THREE.Mesh(clod,earth);m.position.set((random(91,i)-.5)*.10,(random(92,i)-.5)*.10,(random(93,i)-.5)*.10);m.scale.set(.7,.6,.6);m.castShadow=true;load.add(m);}
  blade.geometry.computeBoundingBox();load.position.copy(blade.geometry.boundingBox.getCenter(new THREE.Vector3()));   /* on the blade itself, not its pivot */
  load.scale.setScalar(.75/CAMPER_SCALE);load.visible=false;blade.add(load);
  const mixer=new THREE.AnimationMixer(inner),actions={};for(const c of clips)actions[c.name]=mixer.clipAction(c);
  for(const k of['KO','Wave','Dance'])if(actions[k]){actions[k].setLoop(THREE.LoopOnce,1);actions[k].clampWhenFinished=true;}
  root.userData.camper={inner,mixer,actions,holder,shovel,load,current:null,digT:0,prevMass:0,throwAt:-1,lastPos:null,speed:0};
  play(root.userData.camper,'Idle');
  return root;
}
function play(C,name,fade=.18){
  const a=C.actions[name];if(!a||C.current===name)return a;
  const prev=C.current&&C.actions[C.current];a.reset();a.timeScale=1;a.setEffectiveWeight(1);a.play();if(prev)a.crossFadeFrom(prev,fade,false);
  C.current=name;return a;
}
/* s: the player's state (server snapshot); fallen: tumbling; time: seconds */
export function camperAnimate(g,s,dt,now,fallen){
  const C=g.userData.camper;if(!C)return;
  const p=g.position;if(C.lastPos&&dt>0){const v=Math.hypot(p.x-C.lastPos.x,p.z-C.lastPos.z)/dt;C.speed+=(v-C.speed)*Math.min(1,dt*8);}C.lastPos={x:p.x,z:p.z};
  const tool=s.tool||'shovel',shovelOut=!['axe','pick','rod'].includes(tool)&&!s.cart&&!s.helping&&!fallen&&!s.vehicle;
  for(const m of C.shovel)m.visible=shovelOut;
  const digging=['shovel','pick',undefined].includes(s.tool),mass=s.shovelMass||0;
  if(C.prevMass>0&&mass===0&&!s.shovelPlanted)C.throwAt=now;   // the scoop just went: play the toss
  C.prevMass=mass;C.load.visible=mass>0&&shovelOut;
  const emote=s.emoteUntil>now,chop=tool==='axe'&&s.chopUntil>now,throwing=C.throwAt>0&&now-C.throwAt<THROW_MS,moving=C.speed>.35;
  let a;
  if(fallen)a=play(C,'KO',.12);
  else if(emote)a=play(C,'Wave');
  else if(chop){a=play(C,'Dig');a.timeScale=1.8;}
  else if(digging&&throwing){a=play(C,C.actions.Scoop?'Scoop':'Dig',.08);a.timeScale=0;C.digT=Math.max(C.digT,DIG.loaded+(DIG.end-DIG.loaded)*Math.min(1,(now-C.throwAt)/THROW_MS));a.time=Math.min(DIG.end-.01,C.digT);}
  else if(digging&&(s.shovelPlanted||(mass>0&&!moving))){
    a=play(C,C.actions.Scoop?'Scoop':'Dig',.15);a.timeScale=0;
    if(C.digT>DIG.loaded+.05)C.digT=0;
    /* planted: ease into the plant; loaded: play the lever and the lift at the clip's own speed, then hold the carry pose */
    if(mass>0)C.digT=Math.min(DIG.loaded,Math.max(C.digT,DIG.planted)+dt);else C.digT+=(DIG.planted-C.digT)*Math.min(1,dt*7);
    a.time=C.digT;
  }else{
    C.digT=0;
    if(moving){const run=C.speed>4.2;a=play(C,run?'Run':'Walk');a.timeScale=THREE.MathUtils.clamp(C.speed/(run?5.5:2.4),.55,1.7);}
    else a=play(C,'Idle');
  }
  C.mixer.update(dt);
}
/* the town NPCs: just breathe */
export function camperIdle(g,dt){const C=g.userData.camper;if(!C)return;play(C,'Idle');C.mixer.update(dt);}

/* the camp shovel on its own, in Gold Fever's held-shovel frame (shaft along Y, blade down to about y -0.79, grip at
   about +0.72; see hand-props.mjs shovelProp), for the first-person view. sharp: the steel-shovel upgrade's darker steel */
export function camperShovelProp({sharp=false}={}){
  const src=template.getObjectByName('forearmR'),parts=[];src.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(src.matrixWorld).invert();
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);
  src.children.forEach(o=>{if(!o.isMesh||!isShovel(o.name)||isLong(o.name))return;
    const m=o.clone();m.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld).multiply(new THREE.Matrix4().copy(o.matrix).invert()));
    if(sharp&&m.material&&m.material.name==='CGL_SteelBlue'){m.material=m.material.clone();m.material.color.setHex(0x2b3036);m.material.metalness=.85;m.material.roughness=.28;}
    m.castShadow=true;inner.add(m);parts.push(m);});
  const cap=src.getObjectByName('CGLCamper_R_ShovelCap'),blade=src.getObjectByName('CGLCamper_R_ShovelBlade');
  const dir=blade.position.clone().sub(cap.position).normalize();
  inner.quaternion.setFromUnitVectors(dir,new THREE.Vector3(0,-1,0));
  const box=new THREE.Box3().setFromObject(inner),len=box.max.y-box.min.y,k=1.51/len;
  inner.scale.setScalar(k);const box2=new THREE.Box3().setFromObject(inner);inner.position.y+=.72-box2.max.y;
  const c=box2.getCenter(new THREE.Vector3());inner.position.x-=c.x;inner.position.z-=c.z;
  /* dirt on the blade (Gold Fever's userData.load contract) */
  const load=new THREE.Group(),clod=new THREE.IcosahedronGeometry(.14,1),earth=new THREE.MeshStandardMaterial({color:'#6e5b3d',roughness:1});
  for(let i=0;i<8;i++){const m=new THREE.Mesh(clod,earth);m.position.set((random(81,i)-.5)*.25,(random(82,i)-.5)*.22,.10+random(83,i)*.09);m.scale.set(.65,.65,.42);load.add(m);}
  load.position.set(0,-.56,0);load.visible=false;g.add(load);g.userData.load=load;g.userData.camperShovel=true;
  return g;
}
