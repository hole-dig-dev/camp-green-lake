'use strict';
/* public/js/24-campfront.js -- what tells you across the yard what each place is (2026-11-11). The bunkhouses and the
   Superintendent's house are placed in 23-models.js; this file adds the pieces around them, all from
   art/blender/camp.py:
     - the Company Store's front: a porch roof on posts, COMPANY STORE along it, goods stacked by the window, and the
       booth behind the window stocked to the rafters (the store itself is CompanyStore.glb)
     - string lights over the bunkhouse row, on three poles and the store's porch post: the warm line you walk home under
     - the sifter's work lights: a flood mast with its generator, the industrial end of the yard
     - the Company notice board by the main path: the day, tonight's cut and what's in the crew wallet, in chalk
   Colliders go in now (like 24-dressing.js), so the crew's paths (29-nav.js) see them from the start.
   CAMP_LIGHTS: where these pieces' lamps are, for 47-camplight.js (x, y, z, reach, brightness). */
const CAMP_LIGHTS=[];
const STORE_AT={x:16,z:45};   // the store's centre (20-world.js storeCabin); its front wall is 2.53 m toward the yard
{
  const S0=STORE_AT,y=baseH(S0.x,S0.z);
  placeModel('StoreFront',{x:S0.x,y,z:S0.z,ry:0}).catch(()=>{});
  for(const dx of[-3.85,3.85])solid(S0.x+dx,S0.z-4.45,0.25,0.25);              // the porch posts
  solid(S0.x-2.6,S0.z-3.12,1.95,1.2);                                         // sacks, the shovel barrel, buckets, a crate
  solid(S0.x+2.25,S0.z-2.93,1.0,0.42);                                        // the water jugs
  for(const dx of[-2.2,2.2])CAMP_LIGHTS.push([S0.x+dx,y+4.0,S0.z-5.1,3.6,3.0]);   // the two lamps on the sign
}

/* ---- string lights: wire sagging between pole tops, a bulb every FESTOON_STEP m. One mesh for the wire, one
   InstancedMesh for the bulbs (their colour goes above 1 at night, so the bloom picks them up). ---- */
const FESTOON_POLES=[[-20.6,41.3],[-4.4,40.9],[4.4,40.9]];      // the row's poles; the run ends on the store's west porch post
const FESTOON_STEP=0.85,FESTOON_SAG=0.055;                        // sag: metres of droop per metre of span
const FESTOON_CLEAR=0.75;   // no bulb this close (along x) to a bunkhouse's painted gable letter: from the path a bulb hid it
const FESTOON={bulbs:null,mat:null,on:-1};
{
  instanceModel('FestoonPole',FESTOON_POLES.map(([x,z])=>({x,y:baseH(x,z),z,ry:0}))).catch(()=>{});
  for(const[x,z]of FESTOON_POLES)solid(x,z,0.25,0.25);
  const tops=FESTOON_POLES.map(([x,z])=>[x,baseH(x,z)+3.47,z]);tops.push([STORE_AT.x-3.85,baseH(STORE_AT.x,STORE_AT.z)+2.9,STORE_AT.z-4.45]);
  const wire=[],bulbs=[];
  for(let i=0;i<tops.length-1;i++){
    const[a,b]=[tops[i],tops[i+1]],L=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.max(2,Math.round(L/FESTOON_STEP)),sag=L*FESTOON_SAG;
    const at=u=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u-4*sag*u*(1-u),a[2]+(b[2]-a[2])*u];
    for(let k=0;k<n;k++){const p=at(k/n),q=at((k+1)/n);wire.push([p,q]);if(k&&!TENTS.some(t=>!t.house&&Math.abs(p[0]-t.x)<FESTOON_CLEAR))bulbs.push(at(k/n));if(k%7===3)CAMP_LIGHTS.push([p[0],p[1]-0.3,p[2],3.2,0.55])}
  }
  // the wire: two crossed thin ribbons along each little piece (reads as a line from any side), one mesh
  const pos=[],W2=0.014;
  for(const[p,q]of wire)for(const[ox,oy]of[[0,W2],[W2,0]]){
    const A=[p[0]-ox,p[1]-oy,p[2]],B=[p[0]+ox,p[1]+oy,p[2]],C=[q[0]+ox,q[1]+oy,q[2]],D=[q[0]-ox,q[1]-oy,q[2]];
    pos.push(...A,...B,...C,...A,...C,...D);
  }
  const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(pos,3));wg.computeVertexNormals();
  scene.add(new T.Mesh(wg,new T.MeshBasicMaterial({color:0x1e1a16,side:T.DoubleSide})));
  const m=new T.Matrix4();
  FESTOON.mat=new T.MeshBasicMaterial({color:new T.Color(0.55,0.5,0.4)});
  const bm=new T.InstancedMesh(new T.IcosahedronGeometry(0.075,0),FESTOON.mat,bulbs.length);
  bulbs.forEach((p,i)=>bm.setMatrixAt(i,m.makeTranslation(p[0],p[1]-0.09,p[2])));bm.frustumCulled=false;scene.add(bm);FESTOON.bulbs=bm;
}
function updateFestoon(night){   // 47-camplight.js: off by day (dull glass), warm and blooming from dusk
  if(Math.abs(night-FESTOON.on)<0.01)return;FESTOON.on=night;
  FESTOON.mat.color.setRGB(0.55+2.9*night,0.5+1.7*night,0.4+0.5*night);
}

/* ---- the sifter's work lights: a flood mast aimed at the sifter, its generator behind it ---- */
const FLOOD_AT={x:13.4,z:38.8};
{
  const G=SIM.GOLD.SIFTER,ry=Math.atan2(G.x-FLOOD_AT.x,G.z-FLOOD_AT.z);   // the lamps (the model's +z) look at the sifter
  placeModel('FloodMast',{x:FLOOD_AT.x,y:baseH(FLOOD_AT.x,FLOOD_AT.z),z:FLOOD_AT.z,ry}).catch(()=>{});
  const bx=FLOOD_AT.x-Math.sin(ry)*0.45,bz=FLOOD_AT.z-Math.cos(ry)*0.45;solid(bx,bz,1.4,1.4);   // the pole and the generator behind it
  CAMP_LIGHTS.push([G.x+0.6,baseH(G.x,G.z)+3.0,G.z-0.2,6.5,1.7]);            // the pool the floods throw on the sifter
}

/* ---- the Company notice board: chalk on a slate, rewritten when the numbers change ---- */
const CUT_AT={x:-3.9,z:35.0,ry:-Math.PI/2};   // beside the main path, facing it
const CUTB={cv:null,tex:null,txt:''};
{
  const g=new T.Group();g.position.set(CUT_AT.x,baseH(CUT_AT.x,CUT_AT.z),CUT_AT.z);g.rotation.y=CUT_AT.ry;scene.add(g);
  placeModel('CutBoard',{x:0,y:0,z:0,ry:0},g).catch(()=>{});
  solid(CUT_AT.x,CUT_AT.z,0.4,2.3);
  const cv=document.createElement('canvas');cv.width=512;cv.height=320;CUTB.cv=cv;CUTB.tex=new T.CanvasTexture(cv);
  const slate=new T.Mesh(new T.PlaneGeometry(1.48,0.93),new T.MeshStandardMaterial({map:CUTB.tex,roughness:1}));
  slate.position.set(0,1.555,-0.015);slate.rotation.y=Math.PI;g.add(slate);   // the plane's front faces +z; the slate faces -z
  CAMP_LIGHTS.push([CUT_AT.x+0.9,baseH(CUT_AT.x,CUT_AT.z)+2.3,CUT_AT.z,2.6,1.2]);   // somebody hung a lamp on it
}
function updateCutBoard(){
  if(typeof RUN==='undefined'||!CUTB.cv)return;
  const day=RUN.day|0,cut=RUN.quota|0,wal=Math.max(0,S.seeds|0),short=cut-wal,txt=day+'|'+cut+'|'+wal;
  if(txt===CUTB.txt)return;CUTB.txt=txt;
  const x=CUTB.cv.getContext('2d'),W=CUTB.cv.width,H=CUTB.cv.height;
  x.fillStyle='#26302a';x.fillRect(0,0,W,H);
  x.fillStyle='rgba(230,226,212,0.08)';for(let i=0;i<9;i++)x.fillRect(20+i*53,30+((i*37)%200),90,22);   // old chalk, half wiped
  x.textAlign='left';x.textBaseline='middle';x.fillStyle='#e6e2d4';
  const font=(s,px)=>{x.font=`700 ${px}px "Barlow Condensed", "Big Shoulders Stencil Display", Impact, sans-serif`};
  font(0,46);x.fillText('DAY '+day,28,44);
  font(0,30);x.fillText("TONIGHT'S CUT",28,104);x.fillText('IN THE WALLET',28,168);
  font(0,44);x.textAlign='right';x.fillText(cut+' gold',W-28,104);x.fillText(wal+' gold',W-28,168);
  x.strokeStyle='#e6e2d4';x.lineWidth=3;x.beginPath();x.moveTo(28,206);x.lineTo(W-28,206);x.stroke();
  x.textAlign='center';font(0,38);
  if(short>0){x.fillStyle='#e0806a';x.fillText('SHORT '+short+' GOLD',W/2,244)}else{x.fillStyle='#a8d0a0';x.fillText('COVERED',W/2,244)}
  font(0,24);x.fillStyle='#bdb8a8';x.fillText('Taken at lights-out. The Company thanks you.',W/2,292);
  CUTB.tex.needsUpdate=true;
}
