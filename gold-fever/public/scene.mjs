import {bucketProp,shovelProp} from './hand-props.mjs';
import {minerBody} from './miner-model.mjs';
import {westernEnvironment} from './western-environment.mjs';
import {authoredRocks} from './scenery-models.mjs';
import {vehicleModel as sculptedVehicle} from './vehicle-model.mjs';
import {ellipsoid,softBox} from './model-parts.mjs';
import {configureMaterials,textureMaterial,groundMaterial,materialMetrics,cloneMaterial} from './materials.mjs';
import {createRelicView} from './relic-view.mjs';
import {createGuardView} from './guard-view.mjs';
import {CANYON,CANYON_BRIDGE,canyonCenter,inCanyon} from '/shared/canyon.mjs';
import {feederPose} from '/shared/automation.mjs';
import {ARM,ensureArm,excavatorPose} from '/shared/excavator.mjs';
import {miningTool} from '/shared/tools.mjs';
import {createForestView} from './forest-view.mjs';
import {createMineView} from './mine-view.mjs';
import {MINE,inMine,mineRay,groundAt,undergroundAt} from '/shared/mine.mjs';
import { heldBucketPose } from '/shared/soil.mjs';
import * as THREE from '/vendor/three.module.js';
import { SIZE, STEP, HALF, GRID, WATER, baseHeight, heightAt, riverX, random, nearWater, keyOf, vertexHeight, clamp, protectedGround } from '/shared/world.mjs';

const materials = new Map();
function mat(color, extra = {}) { const key = color + JSON.stringify(extra); if (!materials.has(key)) materials.set(key, textureMaterial(new THREE.MeshStandardMaterial({ color, roughness: .92, flatShading: true, ...extra }),color)); return materials.get(key); }
const wood = mat('#88603d'), darkWood = mat('#523c2b'), iron = mat('#424b4c'), yellow = mat('#d89e39'), skin = mat('#d5a176'), gold = mat('#ffd063', { metalness: .6, roughness: .3 });
const glass = mat('#7facb4', { transparent: true, opacity: .6, roughness: .3 });

const earth=mat('#725039'),clodGeometry=new THREE.IcosahedronGeometry(.14,0);
function mesh(g, geometry, material, x=0,y=0,z=0) { if(material.map&&!geometry.attributes.uv){if(!geometry.attributes.normal)geometry.computeVertexNormals();const p=geometry.attributes.position,n=geometry.attributes.normal,uv=[];for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));uv.push(ny>nx&&ny>nz?p.getX(i):nx>nz?p.getZ(i):p.getX(i),ny>nx&&ny>nz?p.getZ(i):p.getY(i));}geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));}const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; g.add(m); return m; }
const box = (g,w,h,d,m,x=0,y=0,z=0) => mesh(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);
const cylinder = (g,r1,r2,h,m,x=0,y=0,z=0,n=10) => mesh(g,new THREE.CylinderGeometry(r1,r2,h,n),m,x,y,z);
const smoothMaterials=new WeakMap();
function smoothMaterial(m){if(!smoothMaterials.has(m)){const clone=cloneMaterial(m);clone.flatShading=false;smoothMaterials.set(m,clone);}return smoothMaterials.get(m);}
const ball = (g,r,m,x=0,y=0,z=0) => ellipsoid(g,smoothMaterial(m),x,y,z,r,r,r);
function beam(g,a,b,width,material=wood) { const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b); const m=cylinder(g,width,width,va.distanceTo(vb),material); m.position.copy(va.add(vb).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize()); return m; }
function label(text, width=4, color='#fff5d9', background=null) {
  const canvas=document.createElement('canvas'); canvas.width=768;canvas.height=160;const c=canvas.getContext('2d');
  if(background){c.fillStyle=background;c.fillRect(0,0,768,160);c.strokeStyle='#cbaa70';c.lineWidth=7;c.strokeRect(9,9,750,142);}
  c.font='bold 65px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(text,384,82,730);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.scale.set(width,width*160/768,1);return sprite;
}
function roof(g,width,depth,y,color) {
  const w=width/2,d=depth/2,h=2;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-w,y,-d,w,y,-d,0,y+h,-d, -w,y,d,0,y+h,d,w,y,d, -w,y,-d,0,y+h,-d,0,y+h,d, -w,y,-d,0,y+h,d,-w,y,d, w,y,-d,w,y,d,0,y+h,d, w,y,-d,0,y+h,d,0,y+h,-d],3));geo.computeVertexNormals();mesh(g,geo,mat(color));
}
function building(scene,x,z,width,depth,name,color,front) {
  const g=new THREE.Group();g.position.set(x,baseHeight(x,z),z);scene.add(g);
  box(g,width,4.3,depth,mat(color),0,2.15,0);roof(g,width+1,depth+1,4.3,'#825539');
  for(let y=.8;y<4.3;y+=.7)box(g,width+.08,.04,depth+.08,darkWood,0,y,0);
  const side=front === 'north' ? -1 : 1, face=side*(depth/2+.02);
  box(g,1.35,2.7,.09,darkWood,0,1.35,face);
  for(const wx of [-width*.3,width*.3]) {box(g,1.55,1.65,.12,darkWood,wx,2.45,face);box(g,1.3,1.4,.14,mat('#dfd9ad',{emissive:'#87704b',emissiveIntensity:.22}),wx,2.45,face+side*.03);box(g,.06,1.45,.15,wood,wx,2.45,face+side*.08);}
  box(g,width+1,.22,2.4,wood,0,.1,face+side*1.05);box(g,width+1,.18,2.3,darkWood,0,3.6,face+side*1.1);
  for(const wx of [-width/2,width/2])cylinder(g,.09,.1,3.6,wood,wx,1.8,face+side*2.1,6);
  const sign=label(name,width*.97,'#f6dc9e','#443421');sign.position.set(0,4.2,face+side*.25);g.add(sign);
  return g;
}
export function prospector(color=0, name='') {
  const g=minerBody({color});
  const shovel=shovelModel();shovel.position.set(.48,.8,-.30);shovel.scale.setScalar(.85);g.add(shovel);g.userData.shovel=shovel;const rod=new THREE.Group();beam(rod,[0,-.2,0],[0,.35,-.12],.025,wood);beam(rod,[0,.35,-.12],[-.18,.63,-.19],.025,wood);beam(rod,[0,.35,-.12],[.18,.63,-.19],.025,wood);rod.position.set(.48,.8,-.3);g.add(rod);g.userData.rod=rod;const axe=axeModel();axe.position.set(.48,.8,-.3);g.add(axe);g.userData.axe=axe;const pick=pickModel();pick.position.set(.48,.8,-.3);pick.scale.setScalar(.85);g.add(pick);g.userData.pick=pick;const bucket=bucketModel();bucket.scale.setScalar(.72);g.add(bucket);g.userData.bucket=bucket;const mud=new THREE.Group();for(let i=0;i<7;i++){const spot=ball(mud,.085,earth,(random(883,i)-.5)*.55,1.48+random(884,i)*.4,-.43);spot.scale.z=.15;}g.add(mud);g.userData.mud=mud;rod.visible=axe.visible=pick.visible=bucket.visible=mud.visible=false;
  const shadow=mesh(g,new THREE.CircleGeometry(.58,18),new THREE.MeshBasicMaterial({color:'#25241c',transparent:true,opacity:.19,depthWrite:false}),0,.03,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  if(name){const s=label(name,2.8);s.position.set(0,2.65,0);g.add(s);g.userData.name=s;}
  return g;
}
function bucketModel(){return bucketProp();}
function shovelModel(){return shovelProp();}
function cartModel() {
  const box=(g,w,h,d,m,x=0,y=0,z=0)=>softBox(g,w,h,d,smoothMaterial(m),x,y,z,Math.min(w,h,d)*.25);
  const g = new THREE.Group(), rust = mat('#b87946'), dark = mat('#384847');
  const tray = new THREE.Group(); tray.position.y = .75; g.add(tray);
  box(tray,1.18,.12,1.55,rust,0,0,-.12);
  for(const x of [-.59,.59]) { const side=box(tray,.09,.52,1.6,rust,x,.23,-.12);side.rotation.z=-Math.sign(x)*.12; }
  box(tray,1.22,.48,.09,rust,0,.23,-.9);box(tray,1.22,.42,.09,rust,0,.2,.65);
  const fill=mesh(tray,new THREE.IcosahedronGeometry(.65,1),mat('#a78956'),0,.2,-.12);fill.scale.set(.85,.25,1.15);g.userData.fill=fill;
  for(const x of [-.47,.47]) { beam(g,[x,.55,-.65],[x,.88,1.5],.045,wood);beam(g,[x,.05,.48],[x,.65,.4],.04,iron);box(g,.11,.11,.36,dark,x,.88,1.34); }
  const wheel=new THREE.Group();wheel.position.set(0,.35,-.72);g.add(wheel);
  const tire=cylinder(wheel,.35,.35,.17,dark,0,0,0,12);tire.rotation.z=Math.PI/2;
  const hub=cylinder(wheel,.13,.13,.2,rust,0,0,0,10);hub.rotation.z=Math.PI/2;box(wheel,.21,.035,.54,wood);
  g.userData.wheel=wheel;
  const hands=new THREE.Group();g.add(hands);for(const x of [-.47,.47])ball(hands,.095,skin,x,.84,1.0);g.userData.hands=hands;
  const sign=label('LOANER · MIND THE BRAKE',1.6,'#f8e5b7','#604c34');sign.position.set(0,1.85,-.15);g.add(sign);g.userData.sign=sign;
  return g;
}
function spillModel() {
  const g=new THREE.Group();
  for(let i=0;i<7;i++){const chunk=mesh(g,new THREE.IcosahedronGeometry(.22,0),mat(i%2?'#aa8a58':'#8e734b'),(random(889,i)-.5)*1.3,.08,(random(890,i)-.5)*1.3);chunk.scale.set(1.4,.6,1.2);}
  const sign=label('SPILLED PAYDIRT',2,'#f8e5b7');sign.position.y=.85;g.add(sign);g.userData.sign=sign;return g;
}
function vehicleModel(type){return sculptedVehicle(type,label);}
function machineModel(type) {
  const g=new THREE.Group();
  if(type==='feeder'){
    box(g,1.65,.16,1.3,iron,0,1.08,0);for(const x of [-.76,.76])box(g,.12,.65,1.3,wood,x,1.35,0);box(g,1.65,.65,.12,wood,0,1.35,.61);
    for(const x of [-.6,.6]){beam(g,[x,1.15,0],[x,2.5,-4.4],.11,wood);for(const z of [0,-3.8])box(g,.14,z===0?1:2.1,.14,darkWood,x,z===0?.5:1.05,z);}
    const belt=new THREE.Group();belt.position.set(0,1.15,0);belt.rotation.x=Math.atan2(1.35,4.4);g.add(belt);box(belt,1.2,.09,4.6,iron,0,0,-2.25);
    const cleats=[];for(let i=0;i<12;i++)cleats.push(box(belt,1.15,.11,.09,yellow,0,.1,-i/12*4.6));g.userData.cleats=cleats;
    const load=new THREE.Group();g.add(load);for(let i=0;i<12;i++)mesh(load,clodGeometry,earth,(i%3-1)*.3,1.4,-i/12*4.4);g.userData.beltLoad=load;
    const wheel=cylinder(g,.48,.48,.25,yellow,1,1.1,-.35,12);wheel.rotation.z=Math.PI/2;box(wheel,.8,.07,.08,iron,0,.14,0);g.userData.flywheel=wheel;
    const lever=beam(g,[1.12,.9,.4],[1.12,1.8,.4],.08,iron);g.userData.lever=lever;
    const warning=label('JAMMED · HOLD H',3);warning.position.set(0,2.4,0);g.add(warning);g.userData.warning=warning;
  }else if(type==='rocker'){
    const motor=new THREE.Group();g.add(motor);box(motor,.6,.65,.65,yellow,1.35,.7,.2);const wheel=cylinder(motor,.52,.52,.12,iron,1.55,1.1,.2,12);wheel.rotation.z=Math.PI/2;for(let i=0;i<4;i++){const spoke=box(wheel,.9,.08,.08,yellow,0,.08,0);spoke.rotation.y=i*Math.PI/4;}g.userData.motor=motor;g.userData.flywheel=wheel;
    const cradle=new THREE.Group();cradle.position.y=.9;g.add(cradle);box(cradle,1.6,.15,2.5,wood);for(const x of [-.75,.75])box(cradle,.14,.65,2.5,wood,x,.28,0);box(cradle,1.6,.65,.14,wood,0,.28,-1.2);box(cradle,1.4,.16,.65,iron,0,.65,-.8);box(cradle,1.3,.03,1.6,mat('#95c3c6',{transparent:true,opacity:.7}),0,.16,.1);for(let z=-.4;z<1.1;z+=.35)box(cradle,1.5,.1,.08,darkWood,0,.16,z);
    beam(g,[1,.7,-.2],[1,1.9,-.2],.07,wood);beam(g,[1,1.9,-.2],[.5,1.9,-.2],.08,wood);g.userData.cradle=cradle;
    for(const x of [-.65,.65])box(g,.17,.65,2.1,darkWood,x,.33,0);
  }else if(type==='sluice'){
    const trough=new THREE.Group();trough.rotation.x=.07;trough.position.y=1;g.add(trough);box(trough,1.5,.15,6.5,wood);for(const x of [-.72,.72])box(trough,.14,.48,6.5,wood,x,.22,0);box(trough,1.35,.035,6.2,mat('#91c1c0',{transparent:true,opacity:.8}),0,.14,0);for(let z=-2.8;z<3.1;z+=.45)box(trough,1.4,.13,.08,darkWood,0,.15,z);for(const z of [-2.5,2.5])for(const x of [-.5,.5])box(g,.15,1.1,.15,wood,x,.55,z);
  }else{
    for(const x of [-2.5,2.5])for(const z of [-1.8,1.8])box(g,.22,2.3,.22,iron,x,1.15,z);
    box(g,5.8,.25,4.8,iron,0,2.3,0);const drum=new THREE.Group();drum.position.set(0,3.35,0);g.add(drum);
    const shell=cylinder(drum,1.17,1.17,4.3,mat('#c79344',{wireframe:true}),0,0,0,14);shell.rotation.x=Math.PI/2;
    for(const z of [-2.15,-1,0,1,2.15]){const ring=mesh(drum,new THREE.TorusGeometry(1.2,.09,6,16),yellow,0,0,z);ring.rotation.y=0;}
    g.userData.drum=drum;cylinder(g,1.7,.6,1.7,yellow,0,4.3,-2.8,4).rotation.y=Math.PI/4;
    box(g,2.1,.7,1.8,mat('#707c60'),3,1.7,-.2);const pipe=beam(g,[3,1.5,0],[5,.3,1],.12,iron);pipe.castShadow=false;
    const chute=box(g,2,.18,5.5,wood,0,1.05,3.25);chute.rotation.x=.15;box(g,1.8,.04,5.4,mat('#83bbbe'),0,1.14,3.25);
    for(let z=1;z<5.7;z+=.55)box(g,1.9,.12,.08,darkWood,0,1.15-(z-3.25)*.15,z);
  }
  const name=type==='feeder'?'PAYDIRT FEEDER':type==='rocker'?'ROCKER BOX':type==='sluice'?'LONG TOM':'WASH PLANT',s=label(name,type==='washplant'?4:3);s.position.set(0,type==='washplant'?6:2.6,0);g.add(s);return g;
}
function axeModel(){const g=new THREE.Group();cylinder(g,.035,.045,.88,wood,0,.32,0,8);box(g,.11,.17,.07,iron,0,.69,0);const blade=box(g,.24,.25,.055,iron,-.14,.69,0);blade.rotation.z=.15;ball(g,.07,skin,.03,.12,.035);box(g,.12,.25,.12,mat('#ac7950'),.07,-.02,.04);return g;}
function pickModel(){const g=new THREE.Group();cylinder(g,.038,.045,1.15,wood,0,.05,0,8);const head=new THREE.Group();g.add(head);head.position.y=.55;box(head,.18,.18,.15,iron);const tip=mesh(head,new THREE.ConeGeometry(.085,.48,6),iron,-.31,0,0);tip.rotation.z=Math.PI/2;const adze=box(head,.36,.06,.22,iron,.24,-.04,0);adze.rotation.z=-.2;g.userData.head=head;g.userData.adze=adze;const load=new THREE.Group();for(let i=0;i<8;i++)mesh(load,clodGeometry,earth,(random(981,i)-.5)*.3,.1+random(982,i)*.10,.12);head.add(load);load.visible=false;g.userData.load=load;return g;}
function stylePick(g,id){g.userData.head.scale.setScalar(id==='tunnelpick'?1.4:id==='mattock'?1.15:1);g.userData.adze.scale.z=id==='minerpick'?.35:1;g.userData.adze.material=id==='tunnelpick'?yellow:iron;}
function viewTools(camera) {
  const box=(g,w,h,d,m,x=0,y=0,z=0)=>softBox(g,w,h,d,smoothMaterial(m),x,y,z,Math.min(w,h,d)*.28);
  const rig=new THREE.Group();camera.add(rig);
  const shovel=shovelModel();rig.add(shovel);shovel.position.set(.42,-.10,-.9);shovel.rotation.set(.65,0,-.36);
  ball(shovel,.075,skin,.035,.15,.04);box(shovel,.13,.36,.13,mat('#ac7950'),.13,-.01,.04).rotation.z=.35;
  const pick=pickModel();rig.add(pick);ball(pick,.075,skin,.035,.15,.04);box(pick,.13,.36,.13,mat('#ac7950'),.13,-.01,.04).rotation.z=.35;
  const axe=axeModel();rig.add(axe);axe.position.set(.5,-.50,-.9);axe.rotation.set(.25,0,-.4);
  const bucket=bucketModel();bucket.scale.setScalar(.72);bucket.position.set(-.48,-.53,-.85);bucket.rotation.x=.25;rig.add(bucket);
  for(const m of [shovel,bucket])m.traverse(o=>{if(o.isMesh){o.material=cloneMaterial(o.material);o.material.depthTest=true;o.material.depthWrite=true;o.renderOrder=0;o.castShadow=false;}});
  const pan=new THREE.Group();pan.position.set(0,-.47,-.64);pan.rotation.x=.35;rig.add(pan);
  cylinder(pan,.29,.19,.11,iron,0,0,0,32);cylinder(pan,.26,.26,.012,iron,0,.06,0,32);const dirt=cylinder(pan,.245,.245,.016,mat('#6e5b3d'),0,.075,0,24);
  const water=cylinder(pan,.254,.254,.012,mat('#a8c8c7',{transparent:true,opacity:.5}),0,.09,0,22);pan.userData.dirt=dirt;pan.userData.water=water;
  const flakes=new THREE.Group();pan.add(flakes);for(let i=0;i<20;i++){const m=ball(flakes,.012+random(77,i)*.01,gold,(random(78,i)-.5)*.23,.092,(random(79,i)-.5)*.21);m.scale.y=.25;}pan.userData.flakes=flakes;flakes.visible=false;
  for(const x of [-.31,.31]){ball(pan,.075,skin,x,0,0);box(pan,.10,.27,.12,mat('#aa7950'),x,-.12,.07).rotation.z=-Math.sign(x)*.3;}
  const boots=new THREE.Group();camera.add(boots);boots.position.set(0,-.48,-.85);boots.rotation.x=-.7;
  const flailing=[];for(const x of [-.2,.2]){const leg=new THREE.Group();leg.position.x=x;box(leg,.18,.46,.21,mat('#525d68',{depthTest:false,depthWrite:false}),0,.12,0);box(leg,.25,.19,.4,mat('#523c2b',{depthTest:false,depthWrite:false}),0,.41,-.07);boots.add(leg);flailing.push(leg);}
  boots.traverse(m=>{if(m.isMesh){m.renderOrder=100;m.castShadow=false;m.receiveShadow=false;}});
  const helpHands=new THREE.Group();rig.add(helpHands);for(const x of [-.31,.31]){ball(helpHands,.09,skin,x,-.26,-.65);box(helpHands,.13,.32,.13,mat('#aa7950'),x,-.42,-.54).rotation.x=-.55;}
  for(const group of [rig,boots])group.traverse(o=>{o.layers.set(1);if(o.isMesh){o.material=cloneMaterial(o.material);o.material.depthTest=true;o.material.depthWrite=true;o.renderOrder=0;o.castShadow=false;o.receiveShadow=false;}});
  helpHands.visible=false;boots.visible=false;return {rig,shovel,pick,axe,bucket,pan,boots,flailing,helpHands};
}

export function createView(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  configureMaterials(renderer);
  renderer.autoClear=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bfdce4');scene.fog=new THREE.Fog('#bfdce4',85,240);
  const camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.045,420);camera.rotation.order='YXZ';scene.add(camera);
  const skyLight=new THREE.HemisphereLight('#fff6df','#8e8d63',2.35);skyLight.layers.enable(1);scene.add(skyLight);const sun=new THREE.DirectionalLight('#fff0ce',2.4);sun.layers.enable(1);sun.position.set(-45,85,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:.5,far:230});sun.shadow.bias=-.001;scene.add(sun);scene.add(sun.target);
  const environment=westernEnvironment(scene,renderer,sun,skyLight);
  const geometry=new THREE.PlaneGeometry(SIZE,SIZE,GRID,GRID);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position;
  const colors=new Float32Array(positions.count*3),color=new THREE.Color();
  function terrainColor(ix,iz,depth=0){const x=ix*STEP-HALF,z=iz*STEP-HALF,d=Math.abs(x-riverX(z)),r=random(918,ix,iz);let c=d<15?'#c1a578':d<27?'#ae8f64':r>.52?'#ac966b':'#b59b74';if(depth>.1)c=depth>1.3?'#7e563a':'#916442';if(x>-55&&x<-20&&z>39&&z<78)c='#c6ac7b';return color.set(c).multiplyScalar(.94+r*.12);}
  for(let iz=0;iz<=GRID;iz++)for(let ix=0;ix<=GRID;ix++){const i=iz*(GRID+1)+ix;positions.setY(i,baseHeight(ix*STEP-HALF,iz*STEP-HALF));terrainColor(ix,iz).toArray(colors,i*3);}
  const originalIndices=geometry.index.array,newIndices=[];for(let i=0;i<originalIndices.length;i+=3){const ids=[originalIndices[i],originalIndices[i+1],originalIndices[i+2]],x=ids.reduce((n,k)=>n+positions.getX(k),0)/3,z=ids.reduce((n,k)=>n+positions.getZ(k),0)/3;if(!inMine(x,z))newIndices.push(...ids);}geometry.setIndex(newIndices);
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();const terrain=new THREE.Mesh(geometry,groundMaterial());terrain.receiveShadow=true;scene.add(terrain);
  const waterGeo=new THREE.BufferGeometry(),wv=[],wi=[];
  /* the creek (JT 2026-10-05): one shader, no textures. aRiver = (across the creek -1..1, metres along it). Ripples are
     two scrolling layers of noise flowing downstream (+z); colour goes from clear sandy shallows at the banks to deep teal
     in the middle; the shoreline fades out with broken foam; it's smooth enough that the HDR sky reflects at grazing
     angles and the sun glints off the ripples. Replaces the flat teal ribbon, the bank lines and the 70 ripple strips. */
  const wr=[];
  for(let i=0;i<=112;i++){const z=i*2-HALF,x=riverX(z);wv.push(x-6.6,WATER,z,x+6.6,WATER,z);wr.push(-1,z,1,z);if(i<112&&z>=-24){const a=i*2;wi.push(a,a+2,a+1,a+1,a+2,a+3);}}
  waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(wv,3));waterGeo.setAttribute('aRiver',new THREE.Float32BufferAttribute(wr,2));waterGeo.setIndex(wi);waterGeo.computeVertexNormals();
  const waterMat=new THREE.MeshStandardMaterial({color:'#ffffff',transparent:true,roughness:.08,metalness:0,envMapIntensity:1.6,side:THREE.DoubleSide});
  const waterU={uTime:{value:0}};
  waterMat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,waterU);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 aRiver;varying vec2 vRiver;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRiver=aRiver;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
      varying vec2 vRiver;uniform float uTime;
      float cwHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float cwNoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(cwHash(i),cwHash(i+vec2(1,0)),u.x),mix(cwHash(i+vec2(0,1)),cwHash(i+vec2(1,1)),u.x),u.y);}
      float cwFbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=a*cwNoise(p);p=p*2.07+vec2(5.3,1.9);a*=.5;}return v;}
      /* two ripple layers moving downstream at different speeds and scales, stretched along the flow */
      float cwH(vec2 p){return .6*cwFbm(p*vec2(.95,.55)-vec2(0.0,uTime*.85))+.4*cwFbm(p*vec2(1.8,1.05)+vec2(3.1,-uTime*1.45));}`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cwP=vec2(vRiver.x*6.6,vRiver.y);float cwA=abs(vRiver.x),cwD=1.0-cwA;
      vec3 cwShallow=vec3(.25,.42,.39),cwDeep=vec3(.075,.25,.255),cwBed=vec3(.40,.41,.33);   /* JT: lighter edges less drastic */
      vec3 cwCol=mix(cwShallow,cwDeep,smoothstep(.04,.60,cwD));cwCol=mix(cwBed,cwCol,smoothstep(.0,.06,cwD));
      float cwEdge=smoothstep(.86,.975,cwA),cwFoamN=cwFbm(cwP*vec2(2.4,1.1)-vec2(0.0,uTime*1.1));
      float cwFoam=clamp(cwEdge*smoothstep(.55,.78,cwFoamN+cwEdge*.12),0.0,1.0)*.75*(1.0-smoothstep(.975,1.0,cwA));   /* broken, not a line */
      float cwStreak=smoothstep(.74,.83,cwFbm(cwP*vec2(2.6,.32)-vec2(0.0,uTime*1.3)))*.22*smoothstep(.15,.5,cwD);
      cwFoam=max(cwFoam,cwStreak);
      diffuseColor.rgb=mix(cwCol,vec3(.84,.88,.84),cwFoam);
      diffuseColor.a=(mix(.76,.93,smoothstep(.0,.30,cwD))+cwFoam*.25)*(1.0-smoothstep(.965,1.0,cwA));`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.07,.55,cwFoam);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      {float e=.06,h0=cwH(cwP),hx=cwH(cwP+vec2(e,0.0))-h0,hz=cwH(cwP+vec2(0.0,e))-h0;
       vec3 cwN=normalize(vec3(-hx/e*.10,1.0,-hz/e*.10));normal=normalize((viewMatrix*vec4(cwN,0.0)).xyz);if(!gl_FrontFacing)normal=-normal;}`);
  };
  waterMat.customProgramCacheKey=()=>'gf-creek-3';
  const water=new THREE.Mesh(waterGeo,waterMat);water.renderOrder=1;scene.add(water);
  const rippleGroup=new THREE.Group();scene.add(rippleGroup);   /* kept (empty): the shader draws the ripples now */
  // The shared floor collider follows this deck; the ropes are deliberately precarious.
  const bridge=CANYON_BRIDGE,bridgeGroup=new THREE.Group();scene.add(bridgeGroup);
  for(let z=-bridge.halfLength;z<bridge.halfLength;z+=.65){
    const plank=box(bridgeGroup,2.5,.16,.57,z%2?wood:darkWood,bridge.x,bridge.y-.08,bridge.z+z+.29);plank.rotation.y=Math.sin(z*2)*.025;
  }
  for(const side of[-1,1]){
    for(let z=-22;z<=22;z+=4.4){const x=bridge.x+side*1.24;box(bridgeGroup,.09,1.15,.09,wood,x,bridge.y+.55,bridge.z+z);if(z<22)beam(bridgeGroup,[x,bridge.y+1.05,bridge.z+z],[x,bridge.y+1.05,bridge.z+z+4.4],.035,darkWood);}
    beam(bridgeGroup,[bridge.x+side*1,bridge.y-.2,bridge.z-22],[bridge.x+side*1,bridge.y-.2,bridge.z+22],.08,darkWood);
  }
  function canyonSign(text,x,z,width=5){const y=baseHeight(x,z),g=new THREE.Group();scene.add(g);const sign=label(text,width,'#ffe8bc','#61452e');sign.position.set(x,y+2,z);g.add(sign);for(const side of[-1,1])cylinder(g,.08,.11,2,wood,x+side*width*.35,y+1,z,7);}
  canyonSign('CROOKED GORGE · WEST DESCENT ←',-76,-33,8);
  canyonSign('WEST DESCENT · FOLLOW THE STAKES',-101,-38,6);
  canyonSign('THE BAD IDEA BRIDGE',28,bridge.z+25,5);
  canyonSign('GOLD GORGE ↑ · WEST DESCENT ←',-59,1,7);
  for(let x=-100;x<=-28;x+=6){const z=canyonCenter(x)+5,y=baseHeight(x,z);cylinder(scene,.065,.09,1,wood,x,y+.5,z,7);box(scene,.24,.11,.12,yellow,x,y+.87,z);}
  for(let z=-42;z>canyonCenter(-101)+5;z-=5){const y=baseHeight(-101,z);cylinder(scene,.065,.09,1,wood,-101,y+.5,z,7);box(scene,.24,.11,.12,yellow,-101,y+.87,z);}
  const forestView=createForestView(scene,{wood,label}),dummy=new THREE.Object3D();
  const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mat('#969889'),110);
  for(let i=0;i<110;i++){const z=random(553,i)*212-106,x=riverX(z)+(i%2?1:-1)*(8+random(554,i)*20);dummy.position.set(x,baseHeight(x,z)+.2,z);dummy.scale.set(.4+random(555,i)*1.4,.35+random(556,i)*.8,.4+random(557,i)*1.2);dummy.rotation.set(random(558,i),random(559,i)*5,0);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.castShadow=true;rocks.receiveShadow=true;scene.add(rocks);authoredRocks(scene,rocks);
  building(scene,-37,69,11,6.6,"BILL'S ASSAY",'#a8784e','north');building(scene,-46,44,11.4,6.8,"MABEL'S HARDWARE",'#aa9065','south');building(scene,-27,71,8,6,'THE EMPTY POCKET','#896c54','north');
  const npc1=prospector(3),npc2=prospector(1);npc1.position.set(-37,3.35,64.1);npc2.position.set(-46,3.35,49);npc2.rotation.y=Math.PI;scene.add(npc1,npc2);
  for(let i=0;i<9;i++){const x=-56+i*4;const g=new THREE.Group();g.position.set(x,baseHeight(x,78),78);cylinder(g,.06,.07,1.4,wood,0,.7,0,6);box(g,4.2,.13,.14,wood,1.8,1,0);box(g,4.2,.13,.14,wood,1.8,.55,0);scene.add(g);}
  for(let i=0;i<6;i++){const x=-52+i*5,z=57+(i%2)*2;const barrel=new THREE.Group();barrel.position.set(x,baseHeight(x,z),z);cylinder(barrel,.46,.4,1,wood,0,.5,0,9);for(const y of [.2,.8])cylinder(barrel,.475,.475,.06,iron,0,y,0,9);scene.add(barrel);}
  const campSign=label("FOOL'S CROSSING",7,'#ffecc4','#5e4930');campSign.position.set(-23,7.5,57);scene.add(campSign);for(const x of [-26,-20])cylinder(scene,.09,.1,4.1,wood,x,5.1,57,6);
  const mineView=createMineView(scene,camera,{wood,iron,earth,label});
  const guardView=createGuardView(scene,label);
  const relicView=createRelicView(scene,camera,label);
  const tools=viewTools(camera),players=new Map(),machines=new Map(),vehicles=new Map(),carts=new Map(),spills=new Map(),clods=new Map(),buckets=new Map(),particles=[];
  const placementRing=mesh(scene,new THREE.RingGeometry(1.7,1.78,40),new THREE.MeshBasicMaterial({color:'#efc566',side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));placementRing.rotation.x=-Math.PI/2;placementRing.visible=false;placementRing.castShadow=false;
  const outletRing=mesh(scene,new THREE.RingGeometry(.6,.68,24),new THREE.MeshBasicMaterial({color:'#94b861',side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));outletRing.rotation.x=-Math.PI/2;outletRing.visible=false;outletRing.castShadow=false;
  const teethRing=mesh(scene,new THREE.RingGeometry(.43,.49,24),new THREE.MeshBasicMaterial({color:'#efc566',side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));teethRing.rotation.x=-Math.PI/2;teethRing.visible=false;teethRing.castShadow=false;
  const ray=new THREE.Raycaster();let cells={},mode='lobby',swingAt=-10,goldFlash=0,swayX=0,swayY=0,kickAt=-10,kickStrength=0,bucketHitAt=-10,feedbackCount=0,lastFeedback='';
  function updateTerrain(changes=null) {
    if(!changes){for(let iz=0;iz<=GRID;iz++)for(let ix=0;ix<=GRID;ix++){const i=iz*(GRID+1)+ix,k=keyOf(ix,iz);positions.setY(i,vertexHeight(ix,iz,cells));terrainColor(ix,iz,cells[k]?.depth||0).toArray(colors,i*3);}}
    else for(const c of changes){cells[c.key]={depth:c.depth,digs:c.digs};const[ix,iz]=c.key.split(',').map(Number),i=iz*(GRID+1)+ix;positions.setY(i,vertexHeight(ix,iz,cells));terrainColor(ix,iz,c.depth).toArray(colors,i*3);}
    positions.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }
  function syncEntities(items,map,builder,selfId=null) {
    const alive=new Set();for(const item of items){if(item.id===selfId)continue;alive.add(item.id);let g=map.get(item.id);if(!g){g=builder(item);scene.add(g);map.set(item.id,g);g.position.set(item.x,item.y??heightAt(item.x,item.z,cells),item.z);}g.userData.state=item;}
    for(const[id,g]of map)if(!alive.has(id)){scene.remove(g);map.delete(id);}
  }
  function effect(e,selfId){
    const t=performance.now()/1000;feedbackCount++;lastFeedback=e.type;
    if(['plant','dig'].includes(e.type)&&e.player===selfId){swingAt=t;kickAt=t;kickStrength=e.type==='plant'?.018:.04;}
    if(['mud','guardBump'].includes(e.type)&&e.player===selfId){kickAt=t;kickStrength=.065;}
    if(e.type==='catch'){
      if(e.receiver==='bucket-'+selfId)bucketHitAt=t;
      for(const map of [machines,vehicles,carts,buckets]){const g=map.get(e.receiver);if(g)g.userData.hitAt=t;}
    }
    if(['relicReveal','relicTake','relicSale','plant','dig','spill','catch','mud','chop','treeFall','roofCrack','caveIn','beltJam','beltBurp','motorFit','guardBump','guardDance'].includes(e.type)){
      const y=e.y??heightAt(e.x,e.z,cells),treasure=e.type.startsWith('relic'),count=e.type==='plant'?5:e.type==='caveIn'?30:e.type==='beltBurp'?20:e.large?24:8;
      for(let i=0;i<count&&particles.length<160;i++){const m=mesh(scene,new THREE.IcosahedronGeometry(.03+Math.random()*.025,0),treasure?yellow:earth,e.x,y+.1,e.z);m.scale.set(1,.7,1.15);particles.push({m,v:new THREE.Vector3((Math.random()-.5)*2,.8+Math.random()*1.5,(Math.random()-.5)*2),life:.35+Math.random()*.3});}
    }
  }
  function alignCamera(state,local){const e=state?.vehicles.find(v=>v.id===state.self.vehicle&&v.type==='excavator');if(e){const visual=vehicles.get(e.id)?.userData.visualVehicle||e,pose=excavatorPose(visual,cells,visual.arm);camera.position.set(pose.cab.x,pose.cab.y,pose.cab.z);const pitch=Math.atan2(pose.tip.y-pose.cab.y,Math.hypot(pose.tip.x-pose.cab.x,pose.tip.z-pose.cab.z));camera.rotation.set(clamp(pitch+(local.pitch||0),-1.2,.4),pose.yaw+(local.headYaw||0),clamp((visual.arm?.velocity?.slew||0)*.012,-.03,.03),'YXZ');return;}const v=state?.vehicles.find(v=>v.id===state.self.vehicle),fallen=state?.self.tumbleUntil>(state?.now||0),eye=v?(v.type==='truck'?3.65:4):fallen?.5:1.65;camera.position.set(local.x,local.y+eye,local.z);camera.rotation.set(local.pitch||0,local.yaw,fallen?.12:0,'YXZ');if(v){const ahead=v.type==='truck'?3.15:1.85;camera.position.x-=Math.sin(v.yaw)*ahead;camera.position.z-=Math.cos(v.yaw)*ahead;}}
  function render(dt,time,state,local,tool='shovel',holding=false,placementConfig=null,gesture={}) {
    const underground=!!state&&undergroundAt(mineView.mine,local);environment.update(local,underground);mineView.render(local);guardView.render(dt,time,state?.now||Date.now(),local);forestView.render(local,state?.now||Date.now());relicView.render(time,state,local,placementConfig?'none':tool);
    // Use one continuous render pose for the cab and machine. Server snapshots remain authoritative.
    for(const g of vehicles.values()){
      const s=g.userData.state,own=s.id===state?.self.vehicle,x=own?local.x:s.x,z=own?local.z:s.z;
      if(own)g.position.set(x,heightAt(x,z,cells),z);else g.position.lerp(new THREE.Vector3(x,heightAt(x,z,cells),z),1-Math.exp(-dt*15));
      const previous=g.userData.wheelPosition;if(previous){const dx=g.position.x-previous.x,dz=g.position.z-previous.z,travel=-Math.sin(g.rotation.y)*dx-Math.cos(g.rotation.y)*dz;if(Math.hypot(dx,dz)<3)for(const w of g.userData.wheels||[])w.rotation.x-=travel/(s.type==='truck'?.7:.3);}g.userData.wheelPosition={x:g.position.x,z:g.position.z};
      const yaw=own?local.driveYaw:s.yaw;g.rotation.y+=Math.atan2(Math.sin(yaw-g.rotation.y),Math.cos(yaw-g.rotation.y))*(own?1:1-Math.exp(-dt*20));
      if(s.type==='excavator'){
        const a=ensureArm(s),v=g.userData.visualArm??={boom:a.boom,stick:a.stick,slew:a.slew,curl:a.curl,velocity:{...a.velocity}},f=1-Math.exp(-dt*22);
        for(const k of ['boom','stick','slew','curl']){v[k]+=(a[k]-v[k])*f;v.velocity[k]+=(a.velocity[k]-v.velocity[k])*f;}
        g.userData.visualVehicle={...s,x:g.position.x,z:g.position.z,yaw:g.rotation.y,arm:v};
      }
    }
    const operated=state?.vehicles.find(v=>v.id===state.self.vehicle&&v.type==='excavator');teethRing.visible=!!operated;if(operated){const visual=vehicles.get(operated.id)?.userData.visualVehicle||operated,tip=excavatorPose(visual,cells,visual.arm).tip,floor=heightAt(tip.x,tip.z,cells);teethRing.position.set(tip.x,floor+.04,tip.z);teethRing.material.color.set(Math.abs(tip.y-floor)<=.95&&!protectedGround(tip.x,tip.z)&&!inMine(tip.x,tip.z)?'#94b861':'#e7a957');}
    if(mode==='lobby'){camera.position.set(-57+Math.sin(time*.04)*3,25,94);camera.lookAt(-1,3,27);tools.boots.visible=false;tools.rig.visible=false;}
    else if(state&&local){
      const v=state.vehicles.find(v=>v.id===state.self.vehicle);alignCamera(state,local);const kick=Math.max(0,1-(time-kickAt)/.24)*kickStrength;camera.rotation.x+=Math.sin((time-kickAt)*36)*kick;
      if(!v){const bob=local.moving?Math.sin(time*10)*.022:Math.sin(time*1.8)*.004;camera.position.y+=bob;tools.rig.position.y=bob;}
      tools.boots.visible=state.self.tumbleUntil>state.now;tools.flailing.forEach((leg,i)=>leg.rotation.x=Math.sin(time*5+i*2)*.18);tools.rig.visible=!v&&!placementConfig&&!state.self.cart&&!state.self.mineCart&&!tools.boots.visible;tools.helpHands.visible=state.self.helping&&!state.self.busy;tools.shovel.visible=!state.self.busy&&!tools.helpHands.visible&&tool==='shovel';tools.pick.visible=!state.self.busy&&!tools.helpHands.visible&&tool==='pick';stylePick(tools.pick,miningTool(state.self,'pick').id);tools.axe.visible=!state.self.busy&&!tools.helpHands.visible&&tool==='axe';const chop=Math.max(0,(state.self.chopUntil-state.now)/650);tools.axe.rotation.set(.25+Math.sin(chop*Math.PI)*1.1,0,-.4-Math.sin(chop*Math.PI)*.5);tools.axe.position.x=.5-Math.sin(chop*Math.PI)*.2;tools.pan.visible=!tools.helpHands.visible&&(!!state.self.busy||tool==='pan');
      const planted=!!state.self.shovelPlant||gesture.phase==='planted',loaded=state.self.shovelMass>0;
      swayX+=(clamp(gesture.x||0,-.55,.55)-swayX)*Math.min(1,dt*12);swayY+=(clamp(gesture.y||0,-.5,.5)-swayY)*Math.min(1,dt*12);
      const lift=planted?clamp((gesture.pull||0)/(tool==='pick'?miningTool(state.self,'pick').pull:42),0,1)**.72:1,sw=clamp((time-swingAt)/.32,0,1);
      tools.shovel.rotation.set((loaded?1.12:.70)+(planted?-.6*(1-lift):Math.sin(sw*Math.PI)*.12)+swayY*.35,swayX*.32,-.36-swayX*.65);
      tools.shovel.position.set(.42+swayX*.30,-.10+swayY*.23-(planted?.18*(1-lift):0),-.90-(planted?.30*(1-lift):0));
      tools.pick.rotation.set((loaded?.65:.4)-(planted?.45*(1-lift):0)+swayY*.3,swayX*.28,-.45-swayX*.5);tools.pick.position.set(.28+swayX*.24,-.55+swayY*.2-(planted?.12*(1-lift):0),-1.45-(planted?.18*(1-lift):0));tools.pick.userData.load.visible=loaded;tools.shovel.userData.load.visible=loaded;tools.bucket.visible=!state.self.bucketPos&&!state.self.busy&&['shovel','pick'].includes(tool)&&!tools.helpHands.visible;tools.bucket.userData.fill.visible=state.self.cargo.mass>0;tools.bucket.userData.fill.position.y=.09+Math.min(1,state.self.cargo.mass/state.self.capacity)*.30;const bucketPose=heldBucketPose({...state.self,...local,input:{...gesture,yaw:local.yaw,pitch:local.pitch},tumble:tools.boots.visible});tools.bucket.position.set(bucketPose.local.x,bucketPose.local.y,bucketPose.local.z);tools.bucket.rotation.x=(bucketPose.catching?-local.pitch:.25)+Math.sin((time-bucketHitAt)*30)*Math.max(0,1-(time-bucketHitAt)/.45)*.12;
      const b=state.self.busy;tools.pan.rotation.z=b&&holding?Math.sin(time*7)*.13:0;tools.pan.rotation.x=.35+(b&&holding?Math.cos(time*7)*.08:0);tools.pan.userData.dirt.scale.setScalar(b?Math.max(.12,1-b.progress):.3);tools.pan.userData.water.visible=!!b;tools.pan.userData.flakes.visible=!b&&goldFlash>time;
    }
    placementRing.visible=!!placementConfig&&mode==='game';outletRing.visible=false;
    if(placementRing.visible){const h=groundTarget();if(h){placementRing.position.set(h.x,h.y+.08,h.z);placementRing.scale.setScalar(placementConfig.id==='washplant'?3.5:1);const d=Math.hypot(h.x-local.x,h.z-local.z),valid=placementConfig.id==='rockerdrive'?state.machines.some(m=>m.type==='rocker'&&!m.powered&&distance2(m,h)<2.8&&d<10):placementConfig.kind==='mine'?(inMine(h.x,h.z)&&d<4.5&&(placementConfig.id!=='timber'||undergroundAt(mineView.mine,{x:h.x,y:h.y,z:h.z}))):d<=10&&d>=(placementConfig.placementClearance||0)&&nearWater(h.x,h.z,placementConfig.waterReach)&&h.y>=.65&&!protectedGround(h.x,h.z);placementRing.material.color.set(valid?'#efc566':'#ca6555');if(placementConfig.id==='feeder'){const out=feederPose({x:h.x,z:h.z,yaw:local.yaw},cells).outlet;outletRing.visible=true;outletRing.position.set(out.x,heightAt(out.x,out.z,cells)+.08,out.z);outletRing.material.color.set(state.machines.some(m=>{const offset=m.type==='washplant'?2.8:0,x=m.x-Math.sin(m.yaw)*offset,z=m.z-Math.cos(m.yaw)*offset,y=heightAt(m.x,m.z,cells)+(m.type==='washplant'?5.15:m.type==='rocker'?1.55:1.3);return distance2({x,z},out)<(m.type==='washplant'?1.5:.8)&&out.y>y&&out.y-y<3;})?'#94b861':'#e7a957');}}else placementRing.visible=false;}
    for(const g of players.values()){const s=g.userData.state,old=g.position.clone(),fallen=s.tumbleUntil>(state?.now||0);g.position.lerp(new THREE.Vector3(s.x,s.y+(fallen?.28:0),s.z),Math.min(1,dt*12));g.rotation.set(fallen?-.35:0,s.yaw,fallen?1.25:0);const walking=old.distanceTo(g.position)>.006;g.userData.legs?.forEach((leg,i)=>leg.rotation.x=fallen?Math.sin(time*3+i)*.35:walking?Math.sin(time*10+i*Math.PI)*.38:0);g.userData.arms?.forEach((arm,i)=>arm.rotation.x=fallen?Math.sin(time*4+i)*.7:s.cart||s.helping?1.1:s.shovelMass?-.7:s.emoteUntil>(state?.now||Date.now())?Math.sin(time*7)*.4-2:walking?-Math.sin(time*10+i*Math.PI)*.35:.06);g.userData.pick.visible=s.tool==='pick'&&!s.cart&&!s.helping&&!fallen;stylePick(g.userData.pick,s.miningTool);g.userData.pick.rotation.set(s.shovelPlanted?.15:s.shovelMass?1:.55,0,-.4);g.userData.pick.userData.load.visible=s.shovelMass>0;g.userData.shovel.visible=!['axe','pick','rod'].includes(s.tool)&&!s.cart&&!s.helping&&!fallen;g.userData.rod.visible=s.tool==='rod'&&!s.cart&&!s.helping&&!fallen;g.userData.rod.rotation.x=Math.sin(time*8)*.06;g.userData.axe.visible=s.tool==='axe'&&!s.cart&&!s.helping&&!fallen;g.userData.axe.rotation.x=.25+Math.sin(Math.max(0,(s.chopUntil-state.now)/650)*Math.PI)*1.1;g.userData.shovel.rotation.set(s.shovelPlanted?.15:s.shovelMass?1.0:.55,0,-.4);g.userData.shovel.userData.load.visible=s.shovelMass>0;g.userData.bucket.visible=s.catching&&!fallen;const bp=heldBucketPose({...s,input:s,tumble:fallen});const dx=bp.x-s.x,dz=bp.z-s.z;g.userData.bucket.position.set(Math.cos(s.yaw)*dx-Math.sin(s.yaw)*dz,bp.y-s.y,Math.sin(s.yaw)*dx+Math.cos(s.yaw)*dz);g.userData.bucket.userData.fill.visible=false;g.userData.mud.visible=s.muddyUntil>(state?.now||0);g.visible=!s.vehicle;}
    for(const g of carts.values()){const s=g.userData.state;g.position.lerp(new THREE.Vector3(s.x,heightAt(s.x,s.z,cells),s.z),Math.min(1,dt*15));const gx=(heightAt(s.x+.5,s.z,cells)-heightAt(s.x-.5,s.z,cells)),gz=(heightAt(s.x,s.z+.5,cells)-heightAt(s.x,s.z-.5,cells));g.rotation.set(clamp(-gx*Math.sin(s.yaw)-gz*Math.cos(s.yaw),-.45,.45),s.yaw,s.tipped?1.4:s.roll||0);g.userData.wheel.rotation.x=s.wheel||0;g.userData.hands.visible=!!s.operator&&s.operator===state?.self.id;g.userData.fill.visible=s.cargo.mass>.001;g.userData.fill.scale.y=.15+Math.min(1,s.cargo.mass/180)*.65;g.userData.sign.visible=s.id!==state?.self.cart&&distance2(local,s)>2.5&&distance2(local,s)<9;}
    for(const g of spills.values()){const s=g.userData.state;g.position.set(s.x,(s.y??heightAt(s.x,s.z,cells))+.05,s.z);const scale=.7+Math.min(1.5,s.cargo.mass/120);g.scale.set(scale,Math.sqrt(scale),scale);g.userData.sign.visible=s.id!==state?.self.cart&&distance2(local,s)>2.5&&distance2(local,s)<9;}
    for(const g of clods.values()){const s=g.userData.state;g.position.lerp(new THREE.Vector3(s.x,s.y,s.z),Math.min(1,dt*24));g.rotation.x+=dt*s.vz;g.rotation.z+=dt*s.vx;g.scale.setScalar(.7+Math.cbrt(s.mass)*.35);}
    for(const g of buckets.values()){const s=g.userData.state;g.position.set(s.x,s.y??heightAt(s.x,s.z,cells),s.z);g.userData.fill.visible=s.mass>0;g.userData.fill.position.y=.09+Math.min(1,s.mass/s.capacity)*.30;}
    for(const g of vehicles.values()){const s=g.userData.state;if(g.userData.fill)g.userData.fill.visible=s.cargo.mass>0;
      if(g.userData.bed){const elapsed=((state?.now||0)-s.tipped)/1000;g.userData.bed.rotation.x=elapsed>=0&&elapsed<2?-Math.sin(elapsed/2*Math.PI)*.65:0;}
      if(g.userData.windshield)g.userData.windshield.visible=s.id!==state?.self.vehicle;
      if(g.userData.armRig){const a=g.userData.visualArm||ensureArm(s),rig=g.userData.armRig;g.userData.upper.rotation.y=a.slew;rig.boom.rotation.x=a.boom;rig.stick.rotation.x=-a.stick;rig.bucket.rotation.x=.15+a.curl*1.35-(a.boom-a.stick);g.userData.upper.rotation.z=0;g.userData.fill.scale.y=.35+Math.min(1,s.cargo.mass/720)*1.4;const piston=g.userData.piston,A=new THREE.Vector3(-.63,2.25,-.8),B=new THREE.Vector3(-.63,2.65+Math.sin(a.boom)*2.8,-.8-Math.cos(a.boom)*2.8),len=A.distanceTo(B);piston.group.position.copy(A.clone().add(B).multiplyScalar(.5));piston.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());piston.barrel.scale.y=len*.6;piston.barrel.position.y=-len*.2;piston.rod.scale.y=len*.5;piston.rod.position.y=len*.25;}
      if(g.userData.boom){const t=((state?.now||0)-s.swing)/1000;g.userData.boom.rotation.x=t>=0&&t<1.6?Math.sin(t/1.6*Math.PI)*.3:0;if(g.userData.jet)g.userData.jet.visible=t>=0&&t<.7;}
    }
    for(const g of machines.values()){
      const s=g.userData.state,hit=Math.max(0,1-(time-(g.userData.hitAt??-10))/.35);g.position.set(s.x,heightAt(s.x,s.z,cells)+Math.sin(time*38)*hit*.035,s.z);g.rotation.y=s.yaw;
      if(g.userData.cradle)g.userData.cradle.rotation.z=s.running?Math.sin(time*7)*.10:0;
      if(g.userData.drum&&s.running)g.userData.drum.rotation.z+=dt*1.3;
      if(g.userData.motor)g.userData.motor.visible=!!s.powered;
      if(g.userData.flywheel&&s.running)g.userData.flywheel.rotation.x+=dt*8;
      if(g.userData.cleats){
        g.userData.cleats.forEach((c,i)=>c.position.z=-((i/12*4.6+(s.processed||0)/3*.25)%4.6));
        g.userData.beltLoad.visible=s.cargo.mass>0;g.userData.beltLoad.children.forEach((c,i)=>{const t=(i/12+(s.processed||0)/24)%1;c.position.set((i%3-1)*.3,1.3+1.35*t+.12,-4.4*t);});
        g.userData.warning.visible=!!s.jammed;g.userData.lever.rotation.z=s.helper?Math.sin(time*12)*.2:0;g.rotation.z=s.jammed?Math.sin(time*24)*.012:0;
      }
    }
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=dt*5;p.m.position.addScaledVector(p.v,dt);p.m.rotation.x+=dt*5;if(p.life<0){scene.remove(p.m);p.m.geometry.dispose();particles.splice(i,1);}}
    waterU.uTime.value=time;   /* the creek flows (shader above) */
    npc1.userData.arms[0].rotation.x=Math.sin(time*1.5)*.12;
    // Separate depth pass: held tools stay in front of terrain, while their solid parts occlude each other.
    renderer.clear();camera.layers.set(0);renderer.render(scene,camera);renderer.clearDepth();const background=scene.background;scene.background=null;camera.layers.set(1);renderer.shadowMap.autoUpdate=false;renderer.render(scene,camera);renderer.shadowMap.autoUpdate=true;scene.background=background;camera.layers.set(0);
  }
  function groundTarget(local=null,state=null){if(local&&state)alignCamera(state,local);camera.updateMatrixWorld();ray.setFromCamera(new THREE.Vector2(0,0),camera);const hit=ray.intersectObject(terrain,false)[0],dir=camera.getWorldDirection(new THREE.Vector3()),mh=mineRay(mineView.mine,camera.position,dir,80);if(mh&&(!hit||mh.distance<hit.distance))return mh;return hit?{x:hit.point.x,y:hit.point.y,z:hit.point.z,distance:hit.distance}:null;}
  window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
  return {renderer,camera,scene,groundTarget,render,effect,get feedbackVisuals(){return {eventCount:feedbackCount,lastEvent:lastFeedback,particles:particles.length,bucketImpact:Math.max(0,1-(performance.now()/1000-bucketHitAt)/.45),machines:[...machines.values()].map(g=>({id:g.userData.state.id,motorVisible:g.userData.motor?.visible,beltVisible:g.userData.beltLoad?.visible,jamSign:g.userData.warning?.visible}))};},get materials(){return {...materialMetrics(),environment:environment.metrics};},get relicVisuals(){return relicView.metrics;},get guardVisuals(){return guardView.metrics;},get soilVisuals(){return {clods:clods.size,buckets:buckets.size,heldPick:tools.pick.visible,pickLoad:tools.pick.userData.load.visible,shovelLoad:tools.shovel.visible&&tools.shovel.userData.load.visible,bucket:tools.bucket.position.toArray(),bucketDepthTest:tools.bucket.children[0].material.depthTest,swayX,swayY};},get excavatorVisuals(){return [...vehicles.values()].filter(g=>g.userData.armRig).map(g=>({id:g.userData.state.id,cabPose:g.userData.visualVehicle?excavatorPose(g.userData.visualVehicle,cells,g.userData.visualArm).cab:null,boom:g.userData.armRig.boom.rotation.x,stick:g.userData.armRig.stick.rotation.x,curl:g.userData.armRig.bucket.rotation.x,slew:g.userData.upper.rotation.y,loaded:g.userData.fill.visible}));},get mine(){return mineView.mine;},get forestMetrics(){return forestView.metrics;},get mineMetrics(){return mineView.metrics;},loadMine(removed,seed,brushes,rubble){mineView.load(removed,seed,brushes,rubble);},updateMine:mineView.patches,updateMineBrushes:mineView.brushPatches,updateMineRubble:mineView.rubblePatches,get cells(){return cells;},loadWorld(c){cells=c;updateTerrain();mode='game';},updateTerrain,flashGold(){goldFlash=performance.now()/1000+3;},sync(state){relicView.sync(state.relics);guardView.sync(state.guards);forestView.sync(state.forest,cells);if(state.mine)mineView.sync(state);syncEntities(state.players,players,p=>prospector(p.color,p.name),state.self.id);syncEntities(state.machines,machines,m=>machineModel(m.type));syncEntities(state.vehicles,vehicles,v=>vehicleModel(v.type));syncEntities(state.carts||[],carts,cartModel);syncEntities(state.spills||[],spills,spillModel);syncEntities(state.buckets||[],buckets,bucketModel);syncEntities(state.clods||[],clods,()=>{const g=new THREE.Group();mesh(g,clodGeometry,earth);return g;});},get modelMetrics(){return {style:"sculpted",drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:camera.position.toArray(),players:[...players.values()].map(g=>({id:g.userData.state.id,x:g.position.x,y:g.position.y,z:g.position.z})),vehicles:[...vehicles.values()].map(g=>({id:g.userData.state.id,x:g.position.x,y:g.position.y,z:g.position.z}))};},get playerMeshes(){return players;},reset(){mode='lobby';relicView.reset();guardView.reset();mineView.reset();forestView.reset();for(const map of [players,machines,vehicles,carts,spills,clods,buckets]){for(const g of map.values())scene.remove(g);map.clear();}}};
}
const distance2=(a,b)=>a?Math.hypot(a.x-b.x,a.z-b.z):Infinity;


