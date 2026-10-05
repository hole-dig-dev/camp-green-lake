import * as THREE from '/vendor/three.module.js';
import {ARM} from '/shared/excavator.mjs';
import {surface,part,softBox as box,ellipsoid,tube,ring,strut,pipe,roundedGeometry} from './model-parts.mjs';

const paint=surface('#d7a346',{roughness:.65}),ochre=surface('#bd793f',{roughness:.7}),iron=surface('#424b4c',{metalness:.4}),rubber=surface('#252d2e'),chrome=surface('#bec9cb',{metalness:.75,roughness:.28}),seat=surface('#483a30'),earth=surface('#725039'),glass=surface('#91bbc5',{transparent:true,opacity:.32,roughness:.2,depthWrite:false}),lamp=surface('#fff0b2',{emissive:'#ffe3a0',emissiveIntensity:.35});
function armPlate(g,length,width,depth){
 const shape=new THREE.Shape();shape.moveTo(0,-width/2);shape.lineTo(length*.4,-width*.50);shape.lineTo(length,-width*.32);shape.lineTo(length,width*.32);shape.lineTo(length*.36,width*.85);shape.lineTo(0,width/2);shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,steps:1});geo.rotateY(Math.PI/2);part(g,geo,paint,-depth/2,0,0);
 for(const z of[-.2,-length+.2])for(const x of[-depth/2-.015,depth/2+.015]){const bolt=tube(g,.067,.067,.04,chrome,x,0,z);bolt.rotation.z=Math.PI/2;}
}
function wheel(g,x,y,z,r=.70){
  const root=new THREE.Group();root.position.set(x,y,z);g.add(root);
  ring(root,r*.73,r*.27,rubber).rotation.y=Math.PI/2;
  tube(root,r*.55,r*.55,.39,iron).rotation.z=Math.PI/2;
  const hub=tube(root,r*.27,r*.27,.46,ochre);hub.rotation.z=Math.PI/2;
  const tread=new THREE.InstancedMesh(roundedGeometry(.42,.045,.18,.020),rubber,16),dummy=new THREE.Object3D();
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;dummy.position.set(0,Math.sin(a)*r,Math.cos(a)*r);dummy.rotation.set(Math.PI/2-a,0,i%2?.13:-.13);dummy.updateMatrix();tread.setMatrixAt(i,dummy.matrix);}
  tread.castShadow=tread.receiveShadow=true;root.add(tread);return root;
}
function cab(g,x,y,z,width,height,depth){
  const frame=new THREE.Group();frame.position.set(x,y,z);g.add(frame);
  box(frame,width,.18,depth,iron,0,-height/2,0,.06);
  box(frame,width+.15,.18,depth+.16,paint,0,height/2,0,.08);
  for(const sx of[-1,1])for(const sz of[-1,1])strut(frame,[sx*width/2,-height/2,sz*depth/2],[sx*width*.47,height/2,sz*depth*.46],.075,paint);
  const front=box(frame,width*.90,height*.72,.035,glass,0,height*.075,-depth*.48,.016);front.rotation.x=-.07;
  for(const sx of[-1,1])box(frame,.03,height*.68,depth*.80,glass,sx*width*.495,height*.09,0,.014);
  box(frame,width,.44,depth,paint,0,-height*.33,0,.09);
  box(frame,.58,.20,.58,seat,0,-height*.25,.12,.08);box(frame,.60,.57,.14,seat,0,.02,.40,.08);
  const steering=ring(frame,.20,.027,iron,0,-.06,-.31);steering.rotation.x=-.65;
  for(const sx of[-1,1]){strut(frame,[sx*width*.49,.2,-depth*.20],[sx*(width/2+.23),.20,-depth*.23],.025,iron);box(frame,.12,.25,.22,chrome,sx*(width/2+.23),.2,-depth*.23,.04);}
  return front;
}
function tracks(g){
  const rollers=[];
  for(const x of[-1.5,1.5]){
    box(g,.92,.80,4.72,rubber,x,.60,.2,.38);
    for(const z of[-1.55,-.45,.65,1.7]){const w=new THREE.Group();w.position.set(x,.60,z);g.add(w);tube(w,.30,.30,.97,iron).rotation.z=Math.PI/2;tube(w,.14,.14,1.0,ochre).rotation.z=Math.PI/2;rollers.push(w);}
    const tread=new THREE.InstancedMesh(roundedGeometry(.97,.10,.22,.035),iron,32),dummy=new THREE.Object3D();
    for(let i=0;i<32;i++){const a=i/32*Math.PI*2;dummy.position.set(x,.60+Math.sin(a)*.40,.2+Math.cos(a)*2.23);dummy.rotation.x=Math.atan2(-Math.cos(a)*.40,Math.sin(a)*2.23);dummy.updateMatrix();tread.setMatrixAt(i,dummy.matrix);}
    tread.castShadow=tread.receiveShadow=true;g.add(tread);
  }
  return rollers;
}
function scoop(g){
  // A curved steel shell, side cheeks and teeth; the open cavity holds paydirt.
  const shell=new THREE.Shape();shell.moveTo(.43,-.55);shell.lineTo(-.10,-.55);shell.quadraticCurveTo(-.48,-.54,-.48,-.12);shell.lineTo(-.48,.36);shell.lineTo(-.38,.36);shell.lineTo(-.38,-.12);shell.quadraticCurveTo(-.37,-.45,-.10,-.45);shell.lineTo(.43,-.45);shell.closePath();
  function extrude(shape,width,x){const geo=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:14,steps:1});geo.rotateY(Math.PI/2);return part(g,geo,iron,x,0,0);}
  extrude(shell,1.4,-.7);
  const side=new THREE.Shape();side.moveTo(.43,-.53);side.lineTo(-.10,-.53);side.quadraticCurveTo(-.45,-.52,-.45,-.1);side.lineTo(-.45,.30);side.quadraticCurveTo(-.05,.24,.43,-.53);
  for(const x of[-.75,.65])extrude(side,.10,x);
  for(const x of[-.60,-.30,0,.30,.60])box(g,.12,.11,.24,ochre,x,-.50,-.43,.025);
  tube(g,.13,.13,1.66,chrome,0,.13,.30).rotation.z=Math.PI/2;
  const fill=ellipsoid(g,earth,0,-.25,-.05,.62,.23,.43);return fill;
}
export function vehicleModel(type,label){
  const g=new THREE.Group();g.userData.wheels=[];
  if(type==='truck'){
    box(g,3.05,.34,6.65,iron,0,1.14,.3,.13);
    box(g,3.13,.70,2.46,ochre,0,1.73,-1.9,.16);cab(g,0,2.61,-1.95,2.9,1.40,2.22);
    box(g,2.8,.64,1.47,paint,0,1.81,-3.55,.22);
    box(g,2.02,.44,.10,iron,0,1.75,-4.28,.04);
    // Grille slots are one instanced draw rather than separate meshes.
    const grille=new THREE.InstancedMesh(roundedGeometry(.085,.30,.025,.012),chrome,9),dummy=new THREE.Object3D();
    for(let i=0;i<9;i++){dummy.position.set((i-4)*.18,1.75,-4.345);dummy.updateMatrix();grille.setMatrixAt(i,dummy.matrix);}g.add(grille);
    box(g,3.24,.18,.27,iron,0,1.27,-4.38,.075);
    for(const x of[-1.22,1.22]){ellipsoid(g,lamp,x,1.79,-4.26,.21,.16,.08);box(g,.42,.11,1.1,iron,x,1.55,-.45,.05);}
    pipe(g,[[1.53,1.4,-.9],[1.53,2.3,-.9],[1.53,3.4,-.9],[1.53,3.55,-.63]],.075,iron);
    const bed=new THREE.Group();bed.position.set(0,1.45,3.55);g.add(bed);
    box(bed,3.4,.23,4.90,paint,0,.10,-2.45,.09);
    for(const x of[-1.63,1.63]){const wall=box(bed,.17,1.15,4.96,paint,x,.65,-2.45,.07);wall.rotation.z=-Math.sign(x)*.07;for(const z of[-4.2,-3,-1.8,-.6])box(bed,.07,.90,.12,ochre,x+Math.sign(x)*.11,.68,z,.025);}
    box(bed,3.40,1.15,.16,paint,0,.65,-4.87,.065);box(bed,3.40,.85,.16,paint,0,.50,0,.06);
    for(const x of[-1.2,1.2])tube(bed,.09,.09,.38,iron,x,.2,.13).rotation.z=Math.PI/2;
    const fill=ellipsoid(bed,earth,0,.44,-2.40,1.49,.38,2.20);g.userData.fill=fill;g.userData.bed=bed;
    for(const x of[-1.68,1.68])for(const z of[-2.5,1.3,2.8])g.userData.wheels.push(wheel(g,x,.77,z));
    for(const x of[-1.45,1.45]){box(g,.32,.22,.05,surface('#a73b2e',{emissive:'#6e1e12',emissiveIntensity:.2}),x,1.37,3.64,.06);box(g,.10,.06,2.6,paint,x,1.57,2.0,.03);}
  }else{
    g.userData.wheels=tracks(g);tube(g,1.40,1.50,.42,iron,0,1.15,0);
    const upper=new THREE.Group();g.add(upper);if(type==='excavator')g.userData.upper=upper;
    box(upper,3.42,1.05,3.13,paint,0,1.84,.3,.32);
    box(upper,2.50,.92,1.03,ochre,0,1.94,1.64,.32);
    const windshield=cab(upper,.82,3.01,-.55,1.43,1.51,1.74);if(type==='excavator')g.userData.windshield=windshield;
    box(upper,.6,.40,1.95,paint,-1.12,2.40,.52,.12);
    pipe(upper,[[-1.16,2.34,1.02],[-1.16,3.10,1.02],[-1.16,3.22,1.23]],.07,iron);
    for(const x of[.40,1.23])ellipsoid(upper,lamp,x,3.71,-1.49,.12,.10,.08);
    for(let i=0;i<5;i++)box(upper,.42,.028,.04,iron,-1.17,2.62,.18+i*.18,.01);
    if(type==='hydraulic'){
      const cannon=new THREE.Group();cannon.position.set(-.8,2.95,-.7);upper.add(cannon);strut(cannon,[0,0,0],[0,-.3,-4],.38,ochre);tube(cannon,.65,.65,.3,iron);g.userData.boom=cannon;
      const nozzle=ring(cannon,.38,.07,iron,0,-.30,-4);nozzle.rotation.x=-.075;
      const jet=strut(cannon,[0,-.3,-4],[0,-1.4,-19],.13,surface('#b7e2e6',{transparent:true,opacity:.7}));jet.visible=false;g.userData.jet=jet;
      const tank=tube(g,1.35,1.35,3.2,surface('#77795b'),0,2.2,2.3);tank.rotation.x=Math.PI/2;
      for(const z of[.9,3.7]){const band=ring(g,1.36,.045,iron,0,2.2,z);}
      g.userData.fill=ellipsoid(g,earth,0,2.55,1.1,1.1,.25,1);
    }else{
      const boom=new THREE.Group();boom.position.set(-.85,2.65,-.8);upper.add(boom);
      armPlate(boom,ARM.boomLength,.43,.40);tube(boom,.29,.29,.62,iron).rotation.z=Math.PI/2;
      const stick=new THREE.Group();stick.position.z=-ARM.boomLength;boom.add(stick);armPlate(stick,ARM.stickLength,.36,.32);tube(stick,.245,.245,.59,iron).rotation.z=Math.PI/2;
      const bucket=new THREE.Group();bucket.position.z=-ARM.stickLength;stick.add(bucket);g.userData.fill=scoop(bucket);
      const piston=new THREE.Group();upper.add(piston);const barrel=tube(piston,.1,.1,1,iron),rod=tube(piston,.045,.045,1,chrome);g.userData.piston={group:piston,barrel,rod};
      const hose=pipe(boom,[[.24,.10,-.1],[.28,.26,-.5],[.27,.23,-2.8],[.22,.15,-3.3]],.035,rubber);
      // These pivot offsets match shared/excavator.mjs exactly.
      g.userData.armRig={boom,stick,bucket,hose};
    }
  }
  // Service panels, handles, wheel bolts and rivets give the machines readable scale.
  const panelRoot=g.userData.upper||g;
  const panels=type==='truck'?[[1.57,1.72,-2.25],[-1.57,1.72,-2.25]]:[[1.73,1.95,.75],[-1.73,1.95,.75]];
  for(const [x,y,z]of panels){box(panelRoot,.035,.60,.90,ochre,x,y,z,.012);for(const dy of[-.23,.23])for(const dz of[-.37,.37]){const bolt=tube(panelRoot,.027,.027,.045,chrome,x+Math.sign(x)*.035,y+dy,z+dz);bolt.rotation.z=Math.PI/2;}pipe(panelRoot,[[x+Math.sign(x)*.06,y+.06,z-.2],[x+Math.sign(x)*.10,y+.06,z-.2],[x+Math.sign(x)*.10,y+.06,z+.15],[x+Math.sign(x)*.06,y+.06,z+.15]],.02,iron);}
  const sign=label(type==='truck'?'DUMP TRUCK':type==='excavator'?'RUSTBUCKET':'WIDOWMAKER',4);sign.position.set(0,4.7,0);g.add(sign);return g;
}
