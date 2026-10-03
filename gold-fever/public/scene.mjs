import { heldBucketPose } from '/shared/soil.mjs';
import * as THREE from '/vendor/three.module.js';
import { SIZE, STEP, HALF, GRID, WATER, baseHeight, heightAt, riverX, random, nearWater, keyOf, vertexHeight, clamp, protectedGround } from '/shared/world.mjs';

const materials = new Map();
function mat(color, extra = {}) { const key = color + JSON.stringify(extra); if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .92, flatShading: true, ...extra })); return materials.get(key); }
const wood = mat('#88603d'), darkWood = mat('#523c2b'), iron = mat('#424b4c'), yellow = mat('#d89e39'), skin = mat('#d5a176'), gold = mat('#ffd063', { metalness: .6, roughness: .3 });
const glass = mat('#7facb4', { transparent: true, opacity: .6, roughness: .3 });
const outfits = ['#507d86','#ba6653','#73914f','#a48b51','#837496','#4d9790','#b38555','#667fb8'];
const earth=mat('#725039'),clodGeometry=new THREE.IcosahedronGeometry(.14,0);
function soilTexture(){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#b5a18a';ctx.fillRect(0,0,256,256);for(let i=0;i<9500;i++){const r=random(224,i),v=105+Math.floor(r*110);ctx.fillStyle=`rgba(${v},${v-8},${v-16},.35)`;const size=1+random(226,i)*2;ctx.fillRect(random(227,i)*256,random(228,i)*256,size,size);}for(let i=0;i<120;i++){ctx.fillStyle=i%3?'#776c5c':'#ddd0b9';ctx.beginPath();ctx.ellipse(random(229,i)*256,random(230,i)*256,1+random(231,i)*2,.6+random(232,i),random(233,i)*6,0,Math.PI*2);ctx.fill();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(96,96);t.colorSpace=THREE.SRGBColorSpace;return t;}
function mesh(g, geometry, material, x=0,y=0,z=0) { const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; g.add(m); return m; }
const box = (g,w,h,d,m,x=0,y=0,z=0) => mesh(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);
const cylinder = (g,r1,r2,h,m,x=0,y=0,z=0,n=10) => mesh(g,new THREE.CylinderGeometry(r1,r2,h,n),m,x,y,z);
const ball = (g,r,m,x=0,y=0,z=0) => mesh(g,new THREE.IcosahedronGeometry(r,1),m,x,y,z);
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
  const g=new THREE.Group(), shirt=mat(outfits[color%outfits.length]);
  box(g,.67,.68,.4,shirt,0,.93,0);box(g,.7,.25,.45,mat('#414b5b'),0,.6,0);
  for(const x of [-.22,.22]){box(g,.07,.67,.04,mat('#463a2d'),x,.98,-.22);box(g,.095,.08,.05,yellow,x,.84,-.25);}box(g,.37,.09,.08,mat('#bb4e38'),0,1.28,-.21);
  for(const x of [-.22,.22]){const leg=new THREE.Group();leg.position.set(x,.57,0);box(leg,.22,.46,.25,mat('#525d68'),0,-.18,0);box(leg,.28,.17,.42,darkWood,0,-.43,-.07);g.add(leg);(g.userData.legs||=[]).push(leg);}
  cylinder(g,.14,.17,.18,skin,0,1.31,0);
  const head=ball(g,.44,skin,0,1.66,0);head.scale.set(1.12,.95,1);ball(g,.20,skin,0,1.59,-.4);
  for(const x of [-.17,.17]) {const eye=ball(g,.12,mat('#fffbeb'),x,1.77,-.35);eye.scale.y=x<0?1.15:.86;ball(g,.047,mat('#242b2e'),x,1.75,-.453);}
  for(const x of [-.10,.10]){const moustache=ball(g,.13,darkWood,x,1.51,-.44);moustache.scale.set(1.1,.38,.45);moustache.rotation.z=Math.sign(x)*.3;}
  box(g,.36,.07,.08,darkWood,0,1.5,-.31);
  const hat=new THREE.Group();hat.position.set(0,2.02,0);hat.rotation.z=(color%2?1:-1)*.12;g.add(hat);cylinder(hat,.72,.76,.075,mat('#775735'),0,0,0,10);cylinder(hat,.39,.46,.32,mat('#8b673b'),0,.15,0,8);cylinder(hat,.465,.46,.06,darkWood,0,.05,0,10);
  for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.42,1.14,0);box(arm,.21,.36,.23,shirt,0,-.17,0);ball(arm,.145,skin,0,-.43,0);g.add(arm);(g.userData.arms||=[]).push(arm);}
  box(g,.1,.16,.05,mat('#e6b954'),0,.72,-.24);
  const shovel=shovelModel();shovel.position.set(.48,.8,-.30);shovel.scale.setScalar(.85);g.add(shovel);g.userData.shovel=shovel;const bucket=bucketModel();bucket.scale.setScalar(.72);g.add(bucket);g.userData.bucket=bucket;const mud=new THREE.Group();for(let i=0;i<7;i++){const spot=ball(mud,.085,earth,(random(883,i)-.5)*.55,1.48+random(884,i)*.4,-.43);spot.scale.z=.15;}g.add(mud);g.userData.mud=mud;
  const shadow=mesh(g,new THREE.CircleGeometry(.58,18),new THREE.MeshBasicMaterial({color:'#25241c',transparent:true,opacity:.19,depthWrite:false}),0,.03,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  if(name){const s=label(name,2.8);s.position.set(0,2.65,0);g.add(s);g.userData.name=s;}
  return g;
}
function bucketModel(){const g=new THREE.Group();mesh(g,new THREE.CylinderGeometry(.345,.31,.55,14,1,true),mat('#65452d',{side:THREE.DoubleSide}),0,.30,0);for(let i=0;i<14;i++){const a=i/14*Math.PI*2,plank=box(g,.14,.55,.065,i%2?wood:darkWood,Math.sin(a)*.34,.30,Math.cos(a)*.34);plank.rotation.y=a;}for(const y of [.12,.48]){const rim=mesh(g,new THREE.TorusGeometry(.405,.026,5,18),iron,0,y,0);rim.rotation.x=Math.PI/2;}cylinder(g,.32,.3,.05,wood,0,.035,0,14);const dirt=cylinder(g,.30,.30,.12,earth,0,.15,0,14);g.userData.fill=dirt;const handle=mesh(g,new THREE.TorusGeometry(.35,.016,5,18,Math.PI),iron,0,.53,0);handle.rotation.z=.15;return g;}
function shovelModel(){const g=new THREE.Group();cylinder(g,.033,.035,1.10,wood,0,.10,0,8);for(const x of [-.105,.105])box(g,.036,.18,.045,iron,x,.60,0);box(g,.24,.04,.055,darkWood,0,.70,0);const blade=new THREE.Group();blade.position.set(0,-.56,0);g.add(blade);const vertices=[],indices=[];for(let iy=0;iy<4;iy++)for(let ix=0;ix<5;ix++){const x=(ix/4-.5)*.36*(iy===0?.5:1),y=(iy/3-.5)*.43,z=.035+(1-Math.abs(ix/4-.5)*2)*.07;vertices.push(x,y,z);}for(let iy=0;iy<3;iy++)for(let ix=0;ix<4;ix++){const a=iy*5+ix;indices.push(a,a+1,a+5,a+1,a+6,a+5);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(blade,geo,mat('#667070',{metalness:.35,side:THREE.DoubleSide}));const load=new THREE.Group();blade.add(load);for(let i=0;i<8;i++){const c=mesh(load,clodGeometry,earth,(random(81,i)-.5)*.25,(random(82,i)-.5)*.22,.10+random(83,i)*.09);c.scale.set(.65,.65,.42);}load.visible=false;g.userData.load=load;return g;}
function cartModel() {
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
function vehicleModel(type) {
  const g=new THREE.Group();
  if(type==='truck'){
    box(g,3.25,.45,6.7,iron,0,1.15,.35);box(g,3.2,1.9,2.5,mat('#bc7440'),0,2.2,-1.95);box(g,2.7,.95,.06,glass,0,2.51,-3.23);box(g,3.35,.22,2.7,yellow,0,3.24,-1.95);box(g,2.9,.65,1.35,yellow,0,1.77,-3.55);
    const bed=new THREE.Group();bed.position.set(0,1.45,3.55);g.add(bed);box(bed,3.4,.25,4.9,yellow,0,.08,-2.45);for(const x of [-1.63,1.63])box(bed,.16,1.15,5,yellow,x,.65,-2.45);box(bed,3.4,1.15,.16,yellow,0,.65,-4.87);box(bed,3.4,.8,.15,yellow,0,.45,0);
    const fill=box(bed,3.05,.6,4.5,mat('#937147'),0,.45,-2.4);g.userData.fill=fill;g.userData.bed=bed;
    for(const x of [-1.68,1.68])for(const z of [-2.5,1.3,2.8]){const wheel=cylinder(g,.7,.7,.48,mat('#303637'),x,.77,z,14);wheel.rotation.z=Math.PI/2;cylinder(g,.31,.31,.5,iron,x,.77,z,10).rotation.z=Math.PI/2;}
    for(const x of [-1.1,1.1])box(g,.55,.23,.15,mat('#ffe9ad',{emissive:'#fff2bf',emissiveIntensity:.5}),x,1.82,-4.25);
  }else{
    for(const x of [-1.5,1.5]){box(g,.95,.75,4.7,mat('#323b3b'),x,.6,.2);for(const z of [-1.55,-.5,.6,1.65])cylinder(g,.35,.35,1,iron,x,.6,z,10).rotation.z=Math.PI/2;}
    cylinder(g,1.5,1.6,.5,iron,0,1.15,0,12);box(g,3.5,1.1,3.2,yellow,0,1.85,.3);box(g,1.5,1.6,1.75,yellow,.82,2.9,-.55);box(g,1.25,1.13,.06,glass,.82,3.02,-1.46);box(g,1.68,.18,1.93,iron,.82,3.77,-.55);
    if(type==='hydraulic'){
      const cannon=new THREE.Group();cannon.position.set(-.8,2.95,-.7);g.add(cannon);beam(cannon,[0,0,0],[0,-.3,-4],.38,mat('#9e5037'));cylinder(cannon,.65,.65,.3,iron,0,0,0);g.userData.boom=cannon;
      const jet=beam(cannon,[0,-.3,-4],[0,-1.4,-19],.13,mat('#b7e2e6',{transparent:true,opacity:.7}));jet.visible=false;g.userData.jet=jet;box(g,3,1.1,3.5,mat('#77795b'),0,2.3,2.2);
    }else{
      const boom=new THREE.Group();boom.position.set(-.85,2.65,-.8);g.add(boom);beam(boom,[0,0,0],[0,1.5,-3.1],.23,yellow);beam(boom,[0,1.5,-3.1],[0,-.8,-5.9],.2,yellow);beam(boom,[.2,.2,-.1],[.2,1.45,-2.7],.09,iron);box(boom,1.6,.8,1.25,iron,0,-1.03,-5.86);g.userData.boom=boom;
    }
    const fill=box(g,2.5,.55,2.3,mat('#95794e'),0,2.53,1.1);g.userData.fill=fill;
  }
  const s=label(type==='truck'?'DUMP TRUCK':type==='excavator'?'RUSTBUCKET':'WIDOWMAKER',4);s.position.set(0,4.7,0);g.add(s);return g;
}
function machineModel(type) {
  const g=new THREE.Group();
  if(type==='rocker'){
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
  const name=type==='rocker'?'ROCKER BOX':type==='sluice'?'LONG TOM':'WASH PLANT',s=label(name,type==='washplant'?4:3);s.position.set(0,type==='washplant'?6:2.6,0);g.add(s);return g;
}
function viewTools(camera) {
  const rig=new THREE.Group();camera.add(rig);
  const shovel=shovelModel();rig.add(shovel);shovel.position.set(.42,-.10,-.9);shovel.rotation.set(.65,0,-.36);
  ball(shovel,.075,skin,.035,.15,.04);box(shovel,.13,.36,.13,mat('#ac7950'),.13,-.01,.04).rotation.z=.35;
  const bucket=bucketModel();bucket.scale.setScalar(.72);bucket.position.set(-.48,-.53,-.85);bucket.rotation.x=.25;rig.add(bucket);
  for(const m of [shovel,bucket])m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.depthTest=true;o.material.depthWrite=true;o.renderOrder=0;o.castShadow=false;}});
  const pan=new THREE.Group();pan.position.set(0,-.47,-.64);pan.rotation.x=.35;rig.add(pan);
  cylinder(pan,.29,.19,.11,iron,0,0,0,22);cylinder(pan,.26,.26,.012,mat('#9b825d'),0,.06,0,22);const dirt=cylinder(pan,.245,.245,.016,mat('#6e5b3d'),0,.075,0,18);
  const water=cylinder(pan,.254,.254,.012,mat('#a8c8c7',{transparent:true,opacity:.5}),0,.09,0,22);pan.userData.dirt=dirt;pan.userData.water=water;
  const flakes=new THREE.Group();pan.add(flakes);for(let i=0;i<20;i++){const m=ball(flakes,.012+random(77,i)*.01,gold,(random(78,i)-.5)*.23,.092,(random(79,i)-.5)*.21);m.scale.y=.25;}pan.userData.flakes=flakes;flakes.visible=false;
  for(const x of [-.31,.31]){ball(pan,.075,skin,x,0,0);box(pan,.10,.27,.12,mat('#aa7950'),x,-.12,.07).rotation.z=-Math.sign(x)*.3;}
  const boots=new THREE.Group();camera.add(boots);boots.position.set(0,-.48,-.85);boots.rotation.x=-.7;
  const flailing=[];for(const x of [-.2,.2]){const leg=new THREE.Group();leg.position.x=x;box(leg,.18,.46,.21,mat('#525d68',{depthTest:false,depthWrite:false}),0,.12,0);box(leg,.25,.19,.4,mat('#523c2b',{depthTest:false,depthWrite:false}),0,.41,-.07);boots.add(leg);flailing.push(leg);}
  boots.traverse(m=>{if(m.isMesh){m.renderOrder=100;m.castShadow=false;m.receiveShadow=false;}});
  const helpHands=new THREE.Group();rig.add(helpHands);for(const x of [-.31,.31]){ball(helpHands,.09,skin,x,-.26,-.65);box(helpHands,.13,.32,.13,mat('#aa7950'),x,-.42,-.54).rotation.x=-.55;}
  for(const group of [rig,boots])group.traverse(o=>{o.layers.set(1);if(o.isMesh){o.material=o.material.clone();o.material.depthTest=true;o.material.depthWrite=true;o.renderOrder=0;o.castShadow=false;o.receiveShadow=false;}});
  helpHands.visible=false;boots.visible=false;return {rig,shovel,bucket,pan,boots,flailing,helpHands};
}

export function createView(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.autoClear=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bfdce4');scene.fog=new THREE.Fog('#bfdce4',85,240);
  const camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.045,420);camera.rotation.order='YXZ';scene.add(camera);
  const skyLight=new THREE.HemisphereLight('#fff6df','#8e8d63',2.35);skyLight.layers.enable(1);scene.add(skyLight);const sun=new THREE.DirectionalLight('#fff0ce',2.4);sun.layers.enable(1);sun.position.set(-45,85,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:.5,far:230});sun.shadow.bias=-.001;scene.add(sun);scene.add(sun.target);
  const geometry=new THREE.PlaneGeometry(SIZE,SIZE,GRID,GRID);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position;
  const colors=new Float32Array(positions.count*3),color=new THREE.Color();
  function terrainColor(ix,iz,depth=0){const x=ix*STEP-HALF,z=iz*STEP-HALF,d=Math.abs(x-riverX(z)),r=random(918,ix,iz);let c=d<15?'#c1a578':d<27?'#ae8f64':r>.52?'#ac966b':'#b59b74';if(depth>.1)c=depth>1.3?'#7e563a':'#916442';if(x>-55&&x<-20&&z>39&&z<78)c='#c6ac7b';return color.set(c).multiplyScalar(.94+r*.12);}
  for(let iz=0;iz<=GRID;iz++)for(let ix=0;ix<=GRID;ix++){const i=iz*(GRID+1)+ix;positions.setY(i,baseHeight(ix*STEP-HALF,iz*STEP-HALF));terrainColor(ix,iz).toArray(colors,i*3);}
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();const dirtTexture=soilTexture();const terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,map:dirtTexture,bumpMap:dirtTexture,bumpScale:.08,flatShading:true,roughness:1}));terrain.receiveShadow=true;scene.add(terrain);
  const waterGeo=new THREE.BufferGeometry(),wv=[],wi=[];
  for(let i=0;i<=112;i++){const z=i*2-HALF,x=riverX(z);wv.push(x-6.6,WATER,z,x+6.6,WATER,z);if(i<112){const a=i*2;wi.push(a,a+2,a+1,a+1,a+2,a+3);}}
  waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(wv,3));waterGeo.setIndex(wi);waterGeo.computeVertexNormals();const water=new THREE.Mesh(waterGeo,mat('#67a6ac',{transparent:true,opacity:.82,roughness:.34,metalness:.15,side:THREE.DoubleSide}));scene.add(water);
  for(const side of [-1,1]){const pts=[];for(let z=-110;z<=110;z+=2)pts.push(new THREE.Vector3(riverX(z)+side*6.5,WATER+.025,z));scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#d0ded0',transparent:true,opacity:.7})));}
  const rippleGroup=new THREE.Group();scene.add(rippleGroup);for(let i=0;i<70;i++){const z=random(43,i)*215-107,x=riverX(z)+(random(44,i)-.5)*10;const m=mesh(rippleGroup,new THREE.PlaneGeometry(.7+random(45,i)*1.8,.025),new THREE.MeshBasicMaterial({color:'#d0e9de',transparent:true,opacity:.4}),x,WATER+.04,z);m.rotation.x=-Math.PI/2;}
  // Forest uses instancing so distant trees stay inexpensive.
  const trees=[];for(let i=0;i<600&&trees.length<140;i++){const x=random(891,i)*220-110,z=random(892,i)*220-110;if(nearWater(x,z,22)||x>-61&&x<-9&&z>30&&z<84)continue;trees.push({x,z,scale:1+random(893,i)*1.1});}
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.15,.25,2.8,5),wood,trees.length),foliage=new THREE.InstancedMesh(new THREE.ConeGeometry(1.6,4.8,6),mat('#587b62'),trees.length),tops=new THREE.InstancedMesh(new THREE.ConeGeometry(1.2,3.8,6),mat('#6d8a63'),trees.length);const dummy=new THREE.Object3D();
  trees.forEach((t,i)=>{const y=baseHeight(t.x,t.z);dummy.scale.setScalar(t.scale);dummy.position.set(t.x,y+1.4*t.scale,t.z);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);dummy.position.y=y+4*t.scale;dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);dummy.position.y=y+6*t.scale;dummy.updateMatrix();tops.setMatrixAt(i,dummy.matrix);});for(const m of [trunk,foliage,tops]){m.castShadow=true;m.receiveShadow=true;scene.add(m);}
  const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),mat('#969889'),110);
  for(let i=0;i<110;i++){const z=random(553,i)*212-106,x=riverX(z)+(i%2?1:-1)*(8+random(554,i)*20);dummy.position.set(x,baseHeight(x,z)+.2,z);dummy.scale.set(.4+random(555,i)*1.4,.35+random(556,i)*.8,.4+random(557,i)*1.2);dummy.rotation.set(random(558,i),random(559,i)*5,0);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.castShadow=true;rocks.receiveShadow=true;scene.add(rocks);
  for(let i=0;i<16;i++){const angle=i/16*Math.PI*2,x=Math.sin(angle)*168,z=Math.cos(angle)*168;const peak=mesh(scene,new THREE.ConeGeometry(35+random(15,i)*22,32+random(16,i)*30,5),mat(i%2?'#8a9c95':'#a0aaa0'),x,15,z);peak.rotation.y=i;}
  for(let i=0;i<5;i++){const cloud=new THREE.Group();cloud.position.set(-90+i*45,45+i%2*12,-90+i*8);for(let j=0;j<3;j++)box(cloud,9,2.2,4,mat('#eef0df'),j*6,Math.sin(j)*1.5,0);scene.add(cloud);}
  building(scene,-37,69,11,6.6,"BILL'S ASSAY",'#a8784e','north');building(scene,-46,44,11.4,6.8,"MABEL'S HARDWARE",'#aa9065','south');building(scene,-27,71,8,6,'THE EMPTY POCKET','#896c54','north');
  const npc1=prospector(3),npc2=prospector(1);npc1.position.set(-37,3.35,64.1);npc2.position.set(-46,3.35,49);npc2.rotation.y=Math.PI;scene.add(npc1,npc2);
  for(let i=0;i<9;i++){const x=-56+i*4;const g=new THREE.Group();g.position.set(x,baseHeight(x,78),78);cylinder(g,.06,.07,1.4,wood,0,.7,0,6);box(g,4.2,.13,.14,wood,1.8,1,0);box(g,4.2,.13,.14,wood,1.8,.55,0);scene.add(g);}
  for(let i=0;i<6;i++){const x=-52+i*5,z=57+(i%2)*2;const barrel=new THREE.Group();barrel.position.set(x,baseHeight(x,z),z);cylinder(barrel,.46,.4,1,wood,0,.5,0,9);for(const y of [.2,.8])cylinder(barrel,.475,.475,.06,iron,0,y,0,9);scene.add(barrel);}
  const campSign=label("FOOL'S CROSSING",7,'#ffecc4','#5e4930');campSign.position.set(-23,7.5,57);scene.add(campSign);for(const x of [-26,-20])cylinder(scene,.09,.1,4.1,wood,x,5.1,57,6);
  const tools=viewTools(camera),players=new Map(),machines=new Map(),vehicles=new Map(),carts=new Map(),spills=new Map(),clods=new Map(),buckets=new Map(),particles=[];
  const placementRing=mesh(scene,new THREE.RingGeometry(1.7,1.78,40),new THREE.MeshBasicMaterial({color:'#efc566',side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));placementRing.rotation.x=-Math.PI/2;placementRing.visible=false;placementRing.castShadow=false;
  const ray=new THREE.Raycaster();let cells={},mode='lobby',swingAt=-10,goldFlash=0,swayX=0,swayY=0;
  function updateTerrain(changes=null) {
    if(!changes){for(let iz=0;iz<=GRID;iz++)for(let ix=0;ix<=GRID;ix++){const i=iz*(GRID+1)+ix,k=keyOf(ix,iz);positions.setY(i,vertexHeight(ix,iz,cells));terrainColor(ix,iz,cells[k]?.depth||0).toArray(colors,i*3);}}
    else for(const c of changes){cells[c.key]={depth:c.depth,digs:c.digs};const[ix,iz]=c.key.split(',').map(Number),i=iz*(GRID+1)+ix;positions.setY(i,vertexHeight(ix,iz,cells));terrainColor(ix,iz,c.depth).toArray(colors,i*3);}
    positions.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  }
  function syncEntities(items,map,builder,selfId=null) {
    const alive=new Set();for(const item of items){if(item.id===selfId)continue;alive.add(item.id);let g=map.get(item.id);if(!g){g=builder(item);scene.add(g);map.set(item.id,g);g.position.set(item.x,item.y??heightAt(item.x,item.z,cells),item.z);}g.userData.state=item;}
    for(const[id,g]of map)if(!alive.has(id)){scene.remove(g);map.delete(id);}
  }
  function effect(e, selfId) {
    if(e.type==='dig'||e.type==='spill'||e.type==='catch'||e.type==='mud') {if(e.player===selfId)swingAt=performance.now()/1000;
      const y=e.y??heightAt(e.x,e.z,cells);for(let i=0;i<(e.large?26:10);i++){const m=mesh(scene,new THREE.IcosahedronGeometry(.03+Math.random()*.025,0),earth,e.x,y+.10,e.z);m.scale.set(1,.7,1.15);particles.push({m,v:new THREE.Vector3((Math.random()-.5)*2,.8+Math.random()*1.5,(Math.random()-.5)*2),life:.35+Math.random()*.3});}
    }
  }
  function alignCamera(state,local){const v=state?.vehicles.find(v=>v.id===state.self.vehicle),fallen=state?.self.tumbleUntil>(state?.now||0),eye=v?(v.type==='truck'?3.65:4):fallen?.5:1.65;camera.position.set(local.x,local.y+eye,local.z);camera.rotation.set(local.pitch||0,local.yaw,fallen?.12:0,'YXZ');if(v){const ahead=v.type==='truck'?3.15:1.85;camera.position.x-=Math.sin(v.yaw)*ahead;camera.position.z-=Math.cos(v.yaw)*ahead;}}
  function render(dt,time,state,local,tool='shovel',holding=false,placementConfig=null,gesture={}) {
    if(mode==='lobby'){camera.position.set(-57+Math.sin(time*.04)*3,25,94);camera.lookAt(-1,3,27);tools.boots.visible=false;tools.rig.visible=false;}
    else if(state&&local){
      const v=state.vehicles.find(v=>v.id===state.self.vehicle);alignCamera(state,local);
      if(!v){const bob=local.moving?Math.sin(time*10)*.022:Math.sin(time*1.8)*.004;camera.position.y+=bob;tools.rig.position.y=bob;}
      tools.boots.visible=state.self.tumbleUntil>state.now;tools.flailing.forEach((leg,i)=>leg.rotation.x=Math.sin(time*5+i*2)*.18);tools.rig.visible=!v&&!placementConfig&&!state.self.cart&&!tools.boots.visible;tools.helpHands.visible=state.self.helping&&!state.self.busy;tools.shovel.visible=!state.self.busy&&!tools.helpHands.visible&&tool==='shovel';tools.pan.visible=!tools.helpHands.visible&&(!!state.self.busy||tool==='pan');
      const planted=!!state.self.shovelPlant||gesture.phase==='planted',loaded=state.self.shovelMass>0;
      swayX+=(clamp(gesture.x||0,-.55,.55)-swayX)*Math.min(1,dt*12);swayY+=(clamp(gesture.y||0,-.5,.5)-swayY)*Math.min(1,dt*12);
      const lift=planted?clamp((gesture.pull||0)/42,0,1):1,sw=clamp((time-swingAt)/.32,0,1);
      tools.shovel.rotation.set((loaded?1.12:.70)+(planted?-.6*(1-lift):Math.sin(sw*Math.PI)*.12)+swayY*.35,swayX*.32,-.36-swayX*.65);
      tools.shovel.position.set(.42+swayX*.30,-.10+swayY*.23-(planted?.18*(1-lift):0),-.90-(planted?.30*(1-lift):0));
      tools.shovel.userData.load.visible=loaded;tools.bucket.visible=!state.self.bucketPos&&!state.self.busy&&tool==='shovel'&&!tools.helpHands.visible;tools.bucket.userData.fill.visible=state.self.cargo.mass>0;tools.bucket.userData.fill.position.y=.09+Math.min(1,state.self.cargo.mass/state.self.capacity)*.30;const bucketPose=heldBucketPose({...state.self,...local,input:{...gesture,yaw:local.yaw,pitch:local.pitch},tumble:tools.boots.visible});tools.bucket.position.set(bucketPose.local.x,bucketPose.local.y,bucketPose.local.z);tools.bucket.rotation.x=bucketPose.catching?-local.pitch:.25;
      const b=state.self.busy;tools.pan.rotation.z=b&&holding?Math.sin(time*7)*.13:0;tools.pan.rotation.x=.35+(b&&holding?Math.cos(time*7)*.08:0);tools.pan.userData.dirt.scale.setScalar(b?Math.max(.12,1-b.progress):.3);tools.pan.userData.water.visible=!!b;tools.pan.userData.flakes.visible=!b&&goldFlash>time;
    }
    placementRing.visible=!!placementConfig&&mode==='game';
    if(placementRing.visible){const h=groundTarget();if(h){placementRing.position.set(h.x,h.y+.08,h.z);placementRing.scale.setScalar(placementConfig.id==='washplant'?3.5:1);const d=Math.hypot(h.x-local.x,h.z-local.z),valid=d<=10&&d>=(placementConfig.placementClearance||0)&&nearWater(h.x,h.z,placementConfig.waterReach)&&h.y>=.65&&!protectedGround(h.x,h.z);placementRing.material.color.set(valid?'#efc566':'#ca6555');}else placementRing.visible=false;}
    for(const g of players.values()){const s=g.userData.state,old=g.position.clone(),fallen=s.tumbleUntil>(state?.now||0);g.position.lerp(new THREE.Vector3(s.x,s.y+(fallen?.28:0),s.z),Math.min(1,dt*12));g.rotation.set(fallen?-.35:0,s.yaw,fallen?1.25:0);const walking=old.distanceTo(g.position)>.006;g.userData.legs?.forEach((leg,i)=>leg.rotation.x=fallen?Math.sin(time*3+i)*.35:walking?Math.sin(time*10+i*Math.PI)*.38:0);g.userData.arms?.forEach((arm,i)=>arm.rotation.x=fallen?Math.sin(time*4+i)*.7:s.cart||s.helping?1.1:s.shovelMass?-.7:s.emoteUntil>(state?.now||Date.now())?Math.sin(time*7)*.4-2:walking?-Math.sin(time*10+i*Math.PI)*.35:.06);g.userData.shovel.visible=!s.cart&&!s.helping&&!fallen;g.userData.shovel.rotation.set(s.shovelPlanted?.15:s.shovelMass?1.0:.55,0,-.4);g.userData.shovel.userData.load.visible=s.shovelMass>0;g.userData.bucket.visible=s.catching&&!fallen;const bp=heldBucketPose({...s,input:s,tumble:fallen});const dx=bp.x-s.x,dz=bp.z-s.z;g.userData.bucket.position.set(Math.cos(s.yaw)*dx-Math.sin(s.yaw)*dz,bp.y-s.y,Math.sin(s.yaw)*dx+Math.cos(s.yaw)*dz);g.userData.bucket.userData.fill.visible=false;g.userData.mud.visible=s.muddyUntil>(state?.now||0);g.visible=!s.vehicle;}
    for(const g of carts.values()){const s=g.userData.state;g.position.lerp(new THREE.Vector3(s.x,heightAt(s.x,s.z,cells),s.z),Math.min(1,dt*15));const gx=(heightAt(s.x+.5,s.z,cells)-heightAt(s.x-.5,s.z,cells)),gz=(heightAt(s.x,s.z+.5,cells)-heightAt(s.x,s.z-.5,cells));g.rotation.set(clamp(-gx*Math.sin(s.yaw)-gz*Math.cos(s.yaw),-.45,.45),s.yaw,s.tipped?1.4:s.roll||0);g.userData.wheel.rotation.x=s.wheel||0;g.userData.hands.visible=!!s.operator&&s.operator===state?.self.id;g.userData.fill.visible=s.cargo.mass>.001;g.userData.fill.scale.y=.15+Math.min(1,s.cargo.mass/180)*.65;g.userData.sign.visible=s.id!==state?.self.cart&&distance2(local,s)>2.5&&distance2(local,s)<9;}
    for(const g of spills.values()){const s=g.userData.state;g.position.set(s.x,heightAt(s.x,s.z,cells)+.05,s.z);const scale=.7+Math.min(1.5,s.cargo.mass/120);g.scale.set(scale,Math.sqrt(scale),scale);g.userData.sign.visible=s.id!==state?.self.cart&&distance2(local,s)>2.5&&distance2(local,s)<9;}
    for(const g of clods.values()){const s=g.userData.state;g.position.lerp(new THREE.Vector3(s.x,s.y,s.z),Math.min(1,dt*24));g.rotation.x+=dt*s.vz;g.rotation.z+=dt*s.vx;g.scale.setScalar(.7+Math.cbrt(s.mass)*.35);}
    for(const g of buckets.values()){const s=g.userData.state;g.position.set(s.x,heightAt(s.x,s.z,cells),s.z);g.userData.fill.visible=s.mass>0;g.userData.fill.position.y=.09+Math.min(1,s.mass/s.capacity)*.30;}
    for(const g of vehicles.values()){const s=g.userData.state;g.position.lerp(new THREE.Vector3(s.x,heightAt(s.x,s.z,cells),s.z),Math.min(1,dt*15));g.rotation.y=s.yaw;if(g.userData.fill)g.userData.fill.visible=s.cargo.mass>0;
      if(g.userData.bed){const elapsed=((state?.now||0)-s.tipped)/1000;g.userData.bed.rotation.x=elapsed>=0&&elapsed<2?-Math.sin(elapsed/2*Math.PI)*.65:0;}
      if(g.userData.boom){const t=((state?.now||0)-s.swing)/1000;g.userData.boom.rotation.x=t>=0&&t<1.6?Math.sin(t/1.6*Math.PI)*.3:0;if(g.userData.jet)g.userData.jet.visible=t>=0&&t<.7;}
    }
    for(const g of machines.values()){const s=g.userData.state;g.position.set(s.x,heightAt(s.x,s.z,cells),s.z);g.rotation.y=s.yaw;if(g.userData.cradle)g.userData.cradle.rotation.z=s.running?Math.sin(time*7)*.10:0;if(g.userData.drum&&s.running)g.userData.drum.rotation.z+=dt*1.3;}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=dt*5;p.m.position.addScaledVector(p.v,dt);p.m.rotation.x+=dt*5;if(p.life<0){scene.remove(p.m);p.m.geometry.dispose();particles.splice(i,1);}}
    rippleGroup.children.forEach((m,i)=>{m.position.x+=Math.sin(time+i)*dt*.035;m.material.opacity=.23+Math.sin(time*1.1+i)*.15;});
    npc1.userData.arms[0].rotation.x=Math.sin(time*1.5)*.12;
    // Separate depth pass: held tools stay in front of terrain, while their solid parts occlude each other.
    renderer.clear();camera.layers.set(0);renderer.render(scene,camera);renderer.clearDepth();const background=scene.background;scene.background=null;camera.layers.set(1);renderer.shadowMap.autoUpdate=false;renderer.render(scene,camera);renderer.shadowMap.autoUpdate=true;scene.background=background;camera.layers.set(0);
  }
  function groundTarget(local=null,state=null){if(local&&state)alignCamera(state,local);camera.updateMatrixWorld();ray.setFromCamera(new THREE.Vector2(0,0),camera);const hit=ray.intersectObject(terrain,false)[0];return hit?{x:hit.point.x,y:hit.point.y,z:hit.point.z,distance:hit.distance}:null;}
  window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
  return {renderer,camera,scene,groundTarget,render,effect,get soilVisuals(){return {clods:clods.size,buckets:buckets.size,shovelLoad:tools.shovel.userData.load.visible,bucket:tools.bucket.position.toArray(),bucketDepthTest:tools.bucket.children[0].material.depthTest,swayX,swayY};},get cells(){return cells;},loadWorld(c){cells=c;updateTerrain();mode='game';},updateTerrain,flashGold(){goldFlash=performance.now()/1000+3;},sync(state){syncEntities(state.players,players,p=>prospector(p.color,p.name),state.self.id);syncEntities(state.machines,machines,m=>machineModel(m.type));syncEntities(state.vehicles,vehicles,v=>vehicleModel(v.type));syncEntities(state.carts||[],carts,cartModel);syncEntities(state.spills||[],spills,spillModel);syncEntities(state.buckets||[],buckets,bucketModel);syncEntities(state.clods||[],clods,()=>{const g=new THREE.Group();mesh(g,clodGeometry,earth);return g;});},get playerMeshes(){return players;},reset(){mode='lobby';for(const map of [players,machines,vehicles,carts,spills,clods,buckets]){for(const g of map.values())scene.remove(g);map.clear();}}};
}
const distance2=(a,b)=>a?Math.hypot(a.x-b.x,a.z-b.z):Infinity;
