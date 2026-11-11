'use strict';
/* public/js/24-yard.js -- the yard between the buildings (2026-11-11): worn paths where people actually walk, a fire
   pit with log benches to sit on at night, a woodpile, and a horseshoe pitch the diggers play on. Models from
   art/blender/camp.py. Everything solid is placed clear of the doors, the store window, the sifter and its queue, the
   water drums, the vehicles' parking spots, the gates and the crew's routes (29-nav.js paths round the rest). */

/* ---- paths: packed, paler ground along the routes between the gates and the doors. One soft-edged ribbon mesh
   (an alpha gradient across it, blotchy along it), laid just over the ground. [width, points...] ---- */
const YARD_PATHS=[
  [2.8,[0,21],[0,27.2],[-0.3,32],[0.4,36.5],[0,40.4]],                                    // the main gate to Bunk D
  [2.0,[0.4,35.5],[4.5,35.6],[7.6,36.6],[10.3,37.4],[13.5,39.0],[16,40.7]],               // past the water drums and the sifter to the store
  [1.5,[-20.5,40.6],[-16,41.5],[-12,40.7],[-8,41.5],[-4,40.6],[0,40.4],[4,40.6],[8,41.5],[11.5,40.6],[16,40.7]],   // along the bunkhouse fronts
  [1.6,[-30,39.4],[-26,38.9],[-21,37.2],[-14,36.6],[-6,36.2],[-0.3,35.2]],               // the Superintendent's porch to the main path
  [2.4,[31,39],[27,39],[22,39.6],[18.5,40.4],[16,40.7]],                                  // the service gate (the jeep's way in) to the store
  [1.2,[-22,40.6],[-22.6,45],[-22.5,51.5]],                                               // round the back to the outhouse
];
{
  const cv=document.createElement('canvas');cv.width=64;cv.height=256;const x=cv.getContext('2d'),rnd=mulberry32(4411);
  for(let j=0;j<256;j++)for(let i=0;i<64;i++){
    const u=Math.abs(i/63-0.5)*2,edge=1-sm((u-0.35)/0.65);                               // solid in the middle, feathered to the edges
    const a=Math.max(0,Math.min(1,edge*(0.7+0.3*Math.sin(j*0.21+i*0.05)+0.25*(rnd()-0.5))));
    x.fillStyle=`rgba(255,255,255,${a.toFixed(3)})`;x.fillRect(i,j,1,1);
  }
  const tex=new T.CanvasTexture(cv);tex.wrapT=T.RepeatWrapping;
  const pos=[],uv=[],idx=[];
  for(const[w,...pts]of YARD_PATHS){
    const curve=new T.CatmullRomCurve3(pts.map(([px,pz])=>new T.Vector3(px,0,pz)),false,'centripetal'),L=curve.getLength(),n=Math.max(2,Math.ceil(L/0.5));
    const base=pos.length/3;
    for(let k=0;k<=n;k++){
      const p=curve.getPointAt(k/n),t=curve.getTangentAt(k/n),nx=-t.z,nz=t.x;
      for(const s of[-1,0,1]){const vx=p.x+nx*w/2*s,vz=p.z+nz*w/2*s;pos.push(vx,baseH(vx,vz)+0.03,vz);uv.push((s+1)/2,k/n*L/5)}
      if(k<n)for(const c of[0,1]){const a=base+k*3+c,b=a+3;idx.push(a,a+1,b,a+1,b+1,b)}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const m=new T.Mesh(g,new T.MeshStandardMaterial({color:0xcdb38a,alphaMap:tex,transparent:true,depthWrite:false,roughness:1,metalness:0,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  m.receiveShadow=true;m.renderOrder=-1;scene.add(m);
}

/* ---- the fire pit: three log benches round it (86-sit.js seats you on them), the woodpile behind. The flames show
   from dusk (47-camplight.js lights the circle round it) ---- */
const FIRE_AT={x:-12.5,z:35.4};
const FIRE_LOGS=[Math.PI/2,Math.PI*7/6,Math.PI*11/6].map(a=>({a,x:FIRE_AT.x+Math.cos(a)*2.15,z:FIRE_AT.z+Math.sin(a)*2.15}));   // round the fire, each tangent to it
const FIRE={flame:null};
{
  const y=baseH(FIRE_AT.x,FIRE_AT.z);
  placeModel('FirePit',{x:FIRE_AT.x,y,z:FIRE_AT.z,ry:0}).catch(()=>{});solid(FIRE_AT.x,FIRE_AT.z,1.6,1.6);
  placeModel('FirePitFlame',{x:FIRE_AT.x,y,z:FIRE_AT.z,ry:0}).then(g=>{FIRE.flame=g;g.visible=false}).catch(()=>{});
  instanceModel('LogBench',FIRE_LOGS.map(l=>({x:l.x,y:baseH(l.x,l.z),z:l.z,ry:-l.a-Math.PI/2}))).catch(()=>{});
  for(const l of FIRE_LOGS){const along=Math.abs(Math.cos(l.a))<0.5;solid(l.x,l.z,along?1.7:1.2,along?0.4:1.0)}   // a log across x, or (the two slanting ones) its box
  placeModel('Woodpile',{x:FIRE_AT.x+0.3,y:baseH(FIRE_AT.x+0.3,FIRE_AT.z+3.6),z:FIRE_AT.z+3.6,ry:0.2}).catch(()=>{});solid(FIRE_AT.x+0.3,FIRE_AT.z+3.75,1.0,1.4);
}

/* ---- the horseshoe pitch: two pits eleven metres apart in the west yard (flat, nothing to trip on) ---- */
instanceModel('HorseshoePit',[[-34,31.6],[-23,31.6]].map(([x,z])=>({x,y:baseH(x,z),z,ry:Math.PI/2}))).catch(()=>{});
