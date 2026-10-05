// Camp Green Lake's gold-panning sequence in Gold Fever (JT 2026-10-05: "bring in our sifting animation too").
// Ported from camp-green-lake public/js/89-goldfx.js (gfxPanStart / gfxPanStep): Sol's Blender props
// (assets/goldfx: GoldPan, GoldFxPanHands, GoldFxSediment, GoldFxBlackSand, GoldFxWater, GoldFxSpill, GoldFxRipple,
// GoldFxArm): dip the pan in the creek, stratify with alternating shakes, wash over the riffles, re-dip, drain, show the
// gold. Instead of a fixed 7 s it follows Gold Fever's own panning (server p.busy): the dip plays on R, the two wash
// cycles follow your wash progress (0 -> 0.88, only while you hold Space/mouse), the drain plays during the settle, and
// the show plays when the result comes in, with gold flecks for what you actually recovered.
import * as THREE from '/vendor/three.module.js';
import {GLTFLoader} from '/vendor/loaders/GLTFLoader.js';

const SHOW_HOLD=1.5,PAN_T=7.0,WASH_START=1.85,WASH_END=5.55,DRAIN_END=5.85;
const N_SAND=300,N_GOLD=48,N_DROP=200;
const NAMES=['GoldPan','GoldFxPanHands','GoldFxSediment','GoldFxBlackSand','GoldFxWater','GoldFxSpill','GoldFxRipple','GoldFxArm'];
const parts={};const loader=new GLTFLoader();
await Promise.all(NAMES.map(n=>loader.loadAsync('/assets/goldfx/'+n+'.glb').then(g=>{g.scene.updateMatrixWorld(true);const out=[];
  g.scene.traverse(o=>{if(o.isMesh)out.push({geometry:o.geometry.clone().applyMatrix4(o.matrixWorld),material:o.material});});parts[n]=out;}).catch(e=>console.error('goldfx',n,e))));
export const goldFxReady=()=>NAMES.every(n=>parts[n]);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sm=t=>t*t*(3-2*t),ease=(t,a,b)=>sm(clamp((t-a)/(b-a),0,1));
const up=new THREE.Vector3(0,1,0);
function model(n,tint,mats){const g=new THREE.Group();for(const p of parts[n]||[]){let m=p.material;
  if(tint){m=m.clone();m.transparent=true;m.depthWrite=false;m.side=n==='GoldFxWater'?THREE.FrontSide:THREE.DoubleSide;mats.push(m);}
  const mesh=new THREE.Mesh(p.geometry,m);mesh.castShadow=!tint;mesh.receiveShadow=!tint;g.add(mesh);}return g;}
function opacity(g,o){g.visible=o>.005;g.traverse(m=>{if(m.isMesh)m.material.opacity=o;});}
function span(g,a,b,w=1){g.position.copy(a);const v=b.clone().sub(a);g.quaternion.setFromUnitVectors(up,v.clone().normalize());g.scale.set(w,v.length(),w);}

export function createGoldFx(scene,camera){
  const geo=new THREE.IcosahedronGeometry(1,0);
  const pool=(n,mat)=>{const im=new THREE.InstancedMesh(geo,mat,n);im.frustumCulled=false;im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);im.visible=false;scene.add(im);return im;};
  const sandIM=pool(N_SAND,new THREE.MeshStandardMaterial({color:'#b9945e',roughness:1,flatShading:true}));
  const goldIM=pool(N_GOLD,new THREE.MeshStandardMaterial({color:'#ffd35b',emissive:'#755010',metalness:.55,roughness:.25,flatShading:true}));
  const dropIM=pool(N_DROP,new THREE.MeshStandardMaterial({color:'#a3cdc6',roughness:.18,transparent:true,opacity:.65,depthWrite:false}));
  const sand=[],gold=[],drops=[];const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_e=new THREE.Euler();
  const S={on:false,t:0,root:null,mats:[],cam:new THREE.Vector3(),look:new THREE.Vector3(),camT:new THREE.Vector3(),lookT:new THREE.Vector3(),home:null,phase:'',goldShown:false};
  function draw(){const put=(im,list)=>{let i=0;for(const g of list){if(g.gone)continue;_e.set(g.rx||0,g.ry||0,0);_q.setFromEuler(_e);const s=g.s*(g.fade==null?1:g.fade);_s.set(s*(g.sx||1),s*(g.sy||1),s*(g.sz||1));_p.set(g.x,g.y,g.z);im.setMatrixAt(i++,_m.compose(_p,_q,_s));}im.count=i;im.instanceMatrix.needsUpdate=true;};put(sandIM,sand);put(goldIM,gold);put(dropIM,drops);}
  function ballistic(list,dt,floor){for(const g of list){if(g.gone)continue;g.age=(g.age||0)+dt;g.vy-=9.8*dt;g.x+=g.vx*dt;g.y+=g.vy*dt;g.z+=g.vz*dt;if(g.y<floor||g.age>.8)g.gone=true;else g.fade=1-g.age/.8;}while(list.length&&list[0].gone)list.shift();}
  /* start at the creek: water = the point of the creek in front of you (waterY), D = from it towards you */
  function start(local,water){
    if(!goldFxReady())return false;end();
    S.on=true;S.t=0;S.hold=0;S.phase='dip';S.goldShown=false;S.mats=[];sand.length=gold.length=drops.length=0;for(const im of[sandIM,goldIM,dropIM]){im.count=0;im.visible=true;}
    S.root=new THREE.Group();scene.add(S.root);
    const R=S.root,pan=S.pan=new THREE.Group();pan.scale.setScalar(1.1);pan.add(model('GoldPan',false,S.mats),model('GoldFxPanHands',false,S.mats));R.add(pan);
    S.panSand=model('GoldFxSediment',false,S.mats);S.panBlack=model('GoldFxBlackSand',false,S.mats);S.panWater=model('GoldFxWater',true,S.mats);pan.add(S.panSand,S.panBlack,S.panWater);
    S.arms=[0,1].map(()=>{const g=model('GoldFxArm',false,S.mats);R.add(g);return g;});S.sockets=[[-.282,.052,.078],[.282,.052,.078]];
    S.spill=model('GoldFxSpill',true,S.mats);R.add(S.spill);S.ripples=[0,1,2].map(()=>{const g=model('GoldFxRipple',true,S.mats);R.add(g);return g;});
    const dx=local.x-water.x,dz=local.z-water.z,d=Math.hypot(dx,dz)||1;S.tub=new THREE.Vector3(water.x,water.y,water.z);S.dir={x:dx/d,z:dz/d};S.panYaw=Math.atan2(dx,dz);S.dropEmit=0;
    camera.updateMatrixWorld();S.cam.copy(camera.position);camera.getWorldDirection(S.look);S.look.multiplyScalar(3).add(camera.position);S.home=null;
    const D=S.dir,tub=S.tub;S.camT.set(tub.x+D.x*.67,tub.y+.63,tub.z+D.z*.67);S.lookT.copy(tub).add(new THREE.Vector3(D.x*.1,.12,D.z*.1));
    return true;
  }
  function end(){if(!S.root)return;scene.remove(S.root);S.root=null;for(const m of S.mats)m.dispose();S.mats=[];for(const im of[sandIM,goldIM,dropIM])im.visible=false;sand.length=gold.length=drops.length=0;S.on=false;}
  /* the result: show the gold you recovered (mg), then lower the pan */
  function finish(goldMg){if(!S.on)return;S.phase='show';S.t=Math.max(S.t,DRAIN_END);
    const n=goldMg>.01?clamp(Math.round(Math.sqrt(goldMg)*1.6),1,N_GOLD):0;
    for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,r=.022+Math.random()*.049;gold.push({lx:Math.cos(a)*r,lz:Math.sin(a)*r,s:.0055+Math.random()*.0035,rx:Math.random()*6,ry:Math.random()*6,x:0,y:0,z:0});}}
  /* busy: Gold Fever's p.busy ({progress 0..0.88, settle 0..1.05}) or null; washing: the wash input is held */
  function step(dt,busy,washing){
    if(!S.on)return false;
    if(S.phase==='dip'){S.t=Math.min(WASH_START,S.t+dt);if(S.t>=WASH_START)S.phase='wash';}
    else if(S.phase==='wash'&&busy){const target=WASH_START+(WASH_END-WASH_START)*clamp(busy.progress/.88,0,1);S.t+=(target-S.t)*Math.min(1,dt*6);
      if(busy.progress>=.879&&!washing)S.phase='settle';}
    else if(S.phase==='settle'&&busy){S.t=Math.min(DRAIN_END,WASH_END+(DRAIN_END-WASH_END)*clamp((busy.settle||0)/1.05,0,1));if(washing)S.phase='wash';}
    else if(S.phase==='show'){if(S.t>=6.42&&S.hold<SHOW_HOLD)S.hold+=dt;else S.t+=dt;if(S.t>=PAN_T){end();return false;}}   /* hold the pan up so you can see your gold */
    const t=S.t,pan=S.pan,tub=S.tub,D=S.dir,wall=performance.now()/1000;
    const bring=ease(t,0,.6),dip=ease(t,.6,1.15)-ease(t,1.2,1.85),redip=ease(t,3.5,3.85)-ease(t,3.9,4.4);
    const first=ease(t,1.85,3.5),second=ease(t,4.35,5.55),show=ease(t,5.8,6.4),lower=ease(t,6.8,7);
    const wash=((t>1.85&&t<3.5)||(t>4.35&&t<5.55))&&washing,w=wall*12;   /* the swirl keeps going while you hold, even when the timeline creeps */
    const shake=wash?Math.sin(w)*.032:0,orbit=wash?Math.cos(w)*.014:0,right={x:D.z,z:-D.x};
    pan.position.set(tub.x+D.x*(.08+.07*bring+.1*show)+right.x*shake+D.x*orbit,tub.y-.36*(1-bring)+.21*bring-.32*dip-.28*redip+.045*show-.14*lower,tub.z+D.z*(.08+.07*bring+.1*show)+right.z*shake+D.z*orbit);
    pan.rotation.order='YXZ';pan.rotation.set((wash?-.22+.10*Math.cos(w):0)-.16*redip+.48*show,S.panYaw,wash?.10*Math.sin(w-.4):.025*Math.sin(t*3)*(1-show));pan.updateMatrixWorld(true);
    const left=clamp(1-first*.68-second*.32,0,1);
    S.panSand.visible=left>.035;S.panSand.scale.set(.52+.48*left,Math.max(.035,left),.52+.48*left);S.panSand.position.z=-.017*first;S.panSand.position.y=.012*(1-left);
    const clean=first*.22+second*.65+ease(t,5.4,5.85)*.13,blackDepth=1-.92*clean;
    S.panBlack.scale.set(1-.12*clean,blackDepth,1-.12*clean);S.panBlack.position.y=.012+.013*(1-clean)-.017*blackDepth;
    const wet=ease(t,.95,1.25),drain=ease(t,5.4,5.85),water=wet*(1-drain);
    opacity(S.panWater,water*(.72-.27*first-.16*second));S.panWater.rotation.set(-pan.rotation.x*.25,0,-pan.rotation.z*.25);S.panWater.position.y=-.009*first-.006*second;
    const wr=.98-.18*first-.09*second;S.panWater.scale.set(wr,1,wr);S.panWater.position.x=wash?-.012*Math.sin(w-.7):0;S.panWater.position.z=wash?-.012+.009*Math.cos(w-.7):0;
    S.panWater.traverse(o=>{if(o.isMesh)o.material.color.set(second>.6?'#84b9b0':first>.6?'#859b85':'#9c956b');});
    const spill=wash?Math.max(0,Math.cos(w)+.35):t>5.4&&t<5.8?.5:0;
    const lip=new THREE.Vector3(-.122,.073,-.158).applyMatrix4(pan.matrixWorld),landing=lip.clone().add(new THREE.Vector3(-D.x*.09-right.x*.04,-.10,-D.z*.09-right.z*.04));landing.y=Math.min(landing.y,tub.y+.004);
    span(S.spill,lip,landing,.6+.4*spill);opacity(S.spill,Math.min(.55,spill*.55)*water);
    if(spill>.2){S.dropEmit+=dt*85*spill;while(S.dropEmit>=1){S.dropEmit--;const q=lip.clone().add(new THREE.Vector3(right.x*(Math.random()-.5)*.1,0,right.z*(Math.random()-.5)*.1));
      if(drops.length<N_DROP)drops.push({x:q.x,y:q.y,z:q.z,vx:-D.x*.22,vy:-.12,vz:-D.z*.22,s:.003+Math.random()*.004,sy:1.8});
      if(left>.04&&sand.length<N_SAND)sand.push({x:q.x,y:q.y,z:q.z,vx:-D.x*.2,vy:-.05,vz:-D.z*.2,s:.004+Math.random()*.004});}}
    ballistic(drops,dt,tub.y-.014);ballistic(sand,dt,tub.y-.014);
    S.ripples.forEach((r,i)=>{const ph=((wall+i*.3)%1.05)/1.05;r.position.copy(tub);r.position.y+=.018;r.scale.setScalar(.5+ph*1.5);opacity(r,(1-ph)*.2*wet*(t<5.8?1:0));});
    for(const g of gold){const v=new THREE.Vector3(g.lx,.016,g.lz).applyMatrix4(pan.matrixWorld);g.x=v.x;g.y=v.y;g.z=v.z;}
    S.lookT.copy(tub).add(new THREE.Vector3(D.x*(.1+.14*show),.12+.16*show,D.z*(.1+.14*show)));S.camT.set(tub.x+D.x*(.67-.06*show),tub.y+.63-.015*show,tub.z+D.z*(.67-.06*show));
    return true;
  }
  /* after the game has placed its camera: ease into the panning view, and back out at the end */
  function view(dt){
    if(!S.on)return;if(!S.home){S.home={cam:camera.position.clone(),look:new THREE.Vector3()};camera.getWorldDirection(S.home.look);S.home.look.multiplyScalar(3).add(camera.position);}
    else{S.home.cam.copy(camera.position);camera.getWorldDirection(S.home.look);S.home.look.multiplyScalar(3).add(camera.position);}
    const k=1-Math.exp(-dt*(S.t<.8?4:3.2));S.cam.lerp(S.camT,k);S.look.lerp(S.lookT,1-Math.exp(-dt*5));
    const exit=S.phase==='show'?ease(S.t,PAN_T-.4,PAN_T):0;
    camera.position.copy(S.cam).lerp(S.home.cam,exit);camera.lookAt(S.look.clone().lerp(S.home.look,exit));camera.updateMatrixWorld(true);
    S.root.visible=goldIM.visible=exit<.25;   /* gone as the view swings back to you (no stretched arms) */
    /* arms from the pan's handles to just below the camera */
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),down=new THREE.Vector3(0,-1,0).applyQuaternion(camera.quaternion),front=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    S.arms.forEach((g,i)=>{const a=new THREE.Vector3(...S.sockets[i]).applyMatrix4(S.pan.matrixWorld);const b=camera.position.clone().addScaledVector(right,i?.36:-.36).addScaledVector(down,.57).addScaledVector(front,.16);span(g,a,b);});
    draw();
  }
  return{start,step,view,finish,end,get active(){return S.on;},get phase(){return S.phase;}};
}
