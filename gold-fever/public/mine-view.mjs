import * as THREE from '/vendor/three.module.js';
import {MINE,inMine,mineSolid,mineGrade,mineKey} from '/shared/mine.mjs';
const faces=[{n:[1,0,0],v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]},{n:[-1,0,0],v:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]},{n:[0,1,0],v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]},{n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},{n:[0,0,1],v:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]]},{n:[0,0,-1],v:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]}];
export function createMineView(scene,camera,{wood,iron,earth,label}){
  const root=new THREE.Group();scene.add(root);const chunks=new Map(),carts=new Map(),fixtures=new THREE.Group();root.add(fixtures);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,side:THREE.DoubleSide});
  const lanternMaterial=new THREE.MeshStandardMaterial({color:'#ffc772',emissive:'#ffaf39',emissiveIntensity:1.5});
  let mine={levels:[6,-6],removed:{},terrainRevision:0,tracks:[],carts:[],props:[],hoist:null},seed=0,structure='',cage=null,cable=null;
  const torch=new THREE.PointLight('#ffdfae',10,20,1.5);camera.add(torch);torch.position.set(.15,.2,-.35);torch.visible=false;
  const box=(g,w,h,d,mat,x=0,y=0,z=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);g.add(o);return o;};
  function chunk(cx,cy,cz){
    const id=`${cx},${cy},${cz}`,v=[],normals=[],colors=[],c=new THREE.Color();
    for(let x=cx*16;x<(cx+1)*16;x++)for(let z=cz*16;z<(cz+1)*16;z++){
      if(!inMine(x,z))continue;
      for(let y=Math.max(MINE.minY,cy*16);y<Math.min(MINE.top,(cy+1)*16);y++){
        if(!mineSolid(mine,x+.5,y+.5,z+.5))continue;
        for(const f of faces){if(mineSolid(mine,x+.5+f.n[0],y+.5+f.n[1],z+.5+f.n[2]))continue;
          const grade=mineGrade(seed,x,y,z),shade=grade>.055?'#b29963':y>3?'#a17e55':grade>.02?'#8f8371':'#666258';c.set(shade).multiplyScalar(.92+((x*13+y*7+z*3)%5+5)%5*.025);
          for(const i of[0,1,2,0,2,3]){const p=f.v[i];v.push(x+p[0],y+p[1],z+p[2]);normals.push(...f.n);colors.push(c.r,c.g,c.b);}
        }
      }
    }
    const old=chunks.get(id);if(old){root.remove(old);old.geometry.dispose();chunks.delete(id);}
    if(!v.length)return;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeBoundingSphere();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;root.add(mesh);chunks.set(id,mesh);
  }
  function rebuild(){for(let x=Math.floor(MINE.minX/16);x<=Math.floor((MINE.maxX-1)/16);x++)for(let z=Math.floor(MINE.minZ/16);z<=Math.floor((MINE.maxZ-1)/16);z++)for(let y=-2;y<=0;y++)chunk(x,y,z);}
  function patches(keys){const dirty=new Set();for(const k of keys){mine.removed[k]=1;const[x,y,z]=k.split(',').map(Number);for(const f of[{n:[0,0,0]},...faces])dirty.add(`${Math.floor((x+f.n[0])/16)},${Math.floor((y+f.n[1])/16)},${Math.floor((z+f.n[2])/16)}`);}for(const k of dirty)chunk(...k.split(',').map(Number));}
  function disposeGroup(g){g.traverse(o=>{if(o.isMesh)o.geometry.dispose();if(o.isLight)o.dispose();});g.clear();}
  function rail(g,axis){const a=new THREE.Group();if(axis==='x')a.rotation.y=Math.PI/2;g.add(a);for(const x of[-.38,.38])box(a,.06,.09,2,iron,x,.075,0);for(const z of[-.8,-.4,0,.4,.8])box(a,1,.07,.17,wood,0,.015,z);}
  function fixturesBuild(){
    disposeGroup(fixtures);cage=null;cable=null;
    const sign=label('CROOKED HAT MINE',5,'#ffe3a2','#49372a');sign.position.set(-64,8.2,35);fixtures.add(sign);box(fixtures,.13,2.2,.13,wood,-66,7.1,35);box(fixtures,.13,2.2,.13,wood,-62,7.1,35);
    const bottom=Math.min(...mine.levels),ladder=new THREE.Group();ladder.position.set(-65.35,0,31.35);fixtures.add(ladder);for(const x of[-.25,.25])box(ladder,.07,6-bottom,.07,wood,x,(6+bottom)/2,0);for(let y=bottom+.25;y<6.2;y+=.4)box(ladder,.56,.045,.09,wood,0,y,-.03);
    for(const level of mine.levels.filter(y=>y<6)){
      box(fixtures,9.7,.10,2,wood,-67,level-.035,30); // Landing floor, outside the open shaft.
      box(fixtures,.10,2.8,.10,wood,-71,level+1.4,31.8);box(fixtures,.10,2.8,.10,wood,-71,level+1.4,24.1);box(fixtures,.13,.15,7.8,wood,-71,level+2.75,28);
      const l=new THREE.PointLight('#ffc677',8,12,1.4);l.position.set(-70,level+2.4,28);fixtures.add(l);box(fixtures,.13,.20,.13,lanternMaterial,-70,level+2.4,28);
      const s=label(`${6-level}m · LADDER / CAGE`,2);s.position.set(-71.8,level+2,30);s.rotation.y=Math.PI/2;fixtures.add(s);
    }
    for(const t of mine.tracks){const g=new THREE.Group();g.position.set(t.x,t.y+.02,t.z);fixtures.add(g);const nx=mine.tracks.some(n=>Math.abs(n.x-t.x)===2&&n.z===t.z&&n.y===t.y),nz=mine.tracks.some(n=>Math.abs(n.z-t.z)===2&&n.x===t.x&&n.y===t.y);if(nx||t.axis==='x')rail(g,'x');if(nz||t.axis==='z')rail(g,'z');}
    for(const prop of mine.props){const g=new THREE.Group();g.position.set(prop.x,prop.y,prop.z);fixtures.add(g);if(prop.type==='timber'){for(const x of[-.85,.85])box(g,.15,2.35,.15,wood,x,1.18,0);box(g,1.9,.18,.2,wood,0,2.4,0);}else{box(g,.12,.22,.12,lanternMaterial,0,2,0);const l=new THREE.PointLight('#ffca80',6,10,1.4);l.position.y=2;g.add(l);}}
    if(mine.hoist){
      const tower=new THREE.Group();tower.position.set(-64,6,30);fixtures.add(tower);for(const x of[-1.65,1.65])for(const z of[-1.65,1.65])box(tower,.22,4.5,.22,wood,x,2.25,z);box(tower,3.8,.3,3.8,wood,0,4.5,0);
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.55,.07,6,16),iron);wheel.position.set(0,5,0);tower.add(wheel);
      box(tower,1.2,.8,1,iron,3,.5,0);box(tower,.1,.1,.8,wood,3.7,.6,.1);if(mine.hoist.powered){box(tower,1.3,1.3,1.8,iron,4,.7,-1);box(tower,.15,2,.15,iron,4.4,1.9,-1);}
      cage=new THREE.Group();fixtures.add(cage);box(cage,2.4,.14,2.4,iron,0,-.06,0);rail(cage,'x');for(const x of[-1.1,1.1])for(const z of[-1.1,1.1])box(cage,.07,2.4,.07,iron,x,1.2,z);box(cage,2.35,.09,2.35,iron,0,2.45,0);
      cable=box(fixtures,.035,1,.035,iron,-64,0,30);
    }
  }
  function cartModel(){const g=new THREE.Group();box(g,.9,.14,1.1,iron,0,.35,0);for(const x of[-.47,.47])box(g,.06,.5,1.1,wood,x,.63,0);for(const z of[-.55,.55])box(g,.97,.5,.06,wood,0,.63,z);for(const x of[-.46,.46])for(const z of[-.34,.34]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.10,10),iron);w.rotation.z=Math.PI/2;w.position.set(x,.23,z);g.add(w);}const dirt=box(g,.85,.34,1,earth,0,.57,0);g.userData.fill=dirt;const s=label('ORE CART · Q / E',1.6);s.position.y=1.35;g.add(s);return g;}
  function sync(state){const removed=mine.removed,oldDepth=mine.levels.join();mine={...state.mine,removed};if(oldDepth!==mine.levels.join())rebuild();
    const key=JSON.stringify([mine.tracks,mine.props,mine.levels,!!mine.hoist,mine.hoist?.powered]);if(key!==structure){structure=key;fixturesBuild();}
    const alive=new Set();for(const c of mine.carts){alive.add(c.id);let g=carts.get(c.id);if(!g){g=cartModel();root.add(g);carts.set(c.id,g);}g.userData.state=c;}
    for(const[id,g]of carts)if(!alive.has(id)){root.remove(g);disposeGroup(g);carts.delete(id);}
  }
  function render(local){torch.visible=inMine(local.x,local.z)&&local.y<4.5;for(const g of carts.values()){const c=g.userData.state;g.position.set(c.x,c.y,c.z);g.rotation.y=c.yaw;g.userData.fill.visible=c.cargo.mass>0;g.userData.fill.scale.y=.2+c.cargo.mass/240*.8;}
    if(cage&&mine.hoist){const h=mine.hoist;cage.position.set(-64,h.y,30);const length=11-(h.y+2.5);cable.position.y=(11+h.y+2.5)/2;cable.scale.y=Math.max(.1,length);}
  }
  return {load(removed={},worldSeed=0){mine.removed={...removed};seed=worldSeed;rebuild();structure='';},patches,sync,render,get mine(){return mine;},get metrics(){return {chunks:chunks.size,removed:Object.keys(mine.removed).length,tracks:mine.tracks.length,carts:carts.size,depth:6-Math.min(...mine.levels)};},reset(){mine={levels:[6,-6],removed:{},tracks:[],carts:[],props:[],hoist:null};structure='';rebuild();}};
}
