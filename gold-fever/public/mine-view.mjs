import {groundMaterial,logMaterials} from './materials.mjs';
import {inCanyon} from '/shared/canyon.mjs';
import * as THREE from '/vendor/three.module.js';
import {MINE,inMine,mineGrade,mineFloor,undergroundAt} from '/shared/mine.mjs';
import {mineChunkMesh,mineChunkKeys,affectedChunks,brushBounds,rubbleBounds} from '/shared/mine-terrain.mjs';
export function createMineView(scene,camera,{wood,iron,earth,label}){
  const root=new THREE.Group();scene.add(root);const chunks=new Map(),carts=new Map(),fixtures=new THREE.Group();root.add(fixtures);
  const material=groundMaterial({mine:true});
  const lanternMaterial=new THREE.MeshStandardMaterial({color:'#ffc772',emissive:'#ffaf39',emissiveIntensity:1.5});
  let mine={levels:[6,-6],removed:{},brushes:[],rubble:[],terrainRevision:0,tracks:[],carts:[],props:[],hoist:null},seed=0,structure='',cage=null,cable=null;
  const cracks=new Map(),dust=[],dustGeo=new THREE.IcosahedronGeometry(.045,0),dustMat=new THREE.MeshStandardMaterial({color:'#a08b71',roughness:1});let lastDustAt=0;
  const torch=new THREE.PointLight('#ffdfae',10,20,1.5);torch.layers.enable(1);camera.add(torch);torch.position.set(.15,.2,-.35);torch.visible=false;
  const box=(g,w,h,d,mat,x=0,y=0,z=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);g.add(o);return o;};
  function chunk(cx,cy,cz){
    const id=`${cx},${cy},${cz}`,data=mineChunkMesh(mine,cx,cy,cz,inCanyon(cx*8+.1,cz*8+.1)&&!mine.brushes.some(b=>{const a=brushBounds(b,1);return a.lo[0]<cx*8+8&&a.hi[0]>cx*8&&a.lo[1]<cy*8+8&&a.hi[1]>cy*8&&a.lo[2]<cz*8+8&&a.hi[2]>cz*8;})?1:.5),v=data.positions,colors=[],uv=[],c=new THREE.Color();
    const old=chunks.get(id);if(old){root.remove(old);old.geometry.dispose();chunks.delete(id);}if(!v.length)return;
    const sandstoneDark=new THREE.Color('#986b4c'),sandstoneLight=new THREE.Color('#bf946b');
    for(let i=0;i<v.length;i+=3){const[x,y,z]=v.slice(i,i+3),grade=mineGrade(seed,x,y,z);if(inCanyon(x,z)){c.copy(sandstoneDark).lerp(sandstoneLight,.5+.5*Math.sin(y*.65+Math.sin(x*.10+z*.08)*.35));if(grade>.045)c.lerp(new THREE.Color('#b99b62'),.4);}else c.set(grade>.055?'#b29963':y>3?'#a17e55':grade>.02?'#8f8371':'#666258');c.multiplyScalar(.98+Math.sin(x*.13+y*.25+z*.17)*.025);colors.push(c.r,c.g,c.b);const nx=Math.abs(data.normals[i]),ny=Math.abs(data.normals[i+1]),nz=Math.abs(data.normals[i+2]);uv.push((ny>nx&&ny>nz?x:nx>nz?z:x)*.8,(ny>nx&&ny>nz?z:y)*.8);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeBoundingSphere();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;root.add(mesh);chunks.set(id,mesh);
  }
  function rebuild(){const active=mineChunkKeys(mine);for(const [k,g]of chunks)if(!active.has(k)){root.remove(g);g.geometry.dispose();chunks.delete(k);}for(const k of active)chunk(...k.split(',').map(Number));}
  function patches(keys){const dirty=new Set();for(const k of keys){mine.removed[k]=1;const[x,y,z]=k.split(',').map(Number);for(const id of affectedChunks({lo:[x,y,z],hi:[x+1,y+1,z+1]}))dirty.add(id);}mine.terrainRevision++;for(const k of dirty)chunk(...k.split(',').map(Number));}
  function brushPatches(brushes){const dirty=new Set();for(const b of brushes){if(mine.brushes.some(old=>old.id===b.id))continue;mine.brushes.push(b);for(const k of affectedChunks(brushBounds(b)))dirty.add(k);}for(const k of dirty)chunk(...k.split(',').map(Number));if(mine.props.some(p=>p.type==='rope'))fixturesBuild();}
  function rubblePatches(next){const dirty=new Set();for(const b of[...(mine.rubble||[]),...next])for(const k of affectedChunks(rubbleBounds(b)))dirty.add(k);mine.rubble=next.map(b=>({...b}));mine.terrainRevision++;for(const k of dirty)chunk(...k.split(',').map(Number));}
  const {bark,cap}=logMaterials();
  function log(g,a,b,r=.14){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),axis=vb.clone().sub(va),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.07,axis.length(),10),[bark,cap,cap]);o.position.copy(va.add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());g.add(o);return o;}
  function frame(g,p){const w=(p.width||2.2)/2,h=p.height||2.4;g.rotation.y=p.yaw||0;for(const x of[-w,w])log(g,[x,0,0],[x,h,0],.15);log(g,[-w-.18,h,0],[w+.18,h,0],.18);for(const sign of[-1,1])log(g,[sign*w,h-.65,0],[sign*(w-.55),h-.05,0],.075);}
  function disposeGroup(g){g.traverse(o=>{if(o.isMesh)o.geometry.dispose();if(o.isLight)o.dispose();});g.clear();}
  function rail(g,axis){const a=new THREE.Group();if(axis==='x')a.rotation.y=Math.PI/2;g.add(a);for(const x of[-.38,.38])box(a,.06,.09,2,iron,x,.075,0);for(const z of[-.8,-.4,0,.4,.8])box(a,1,.07,.17,wood,0,.015,z);}
  function fixturesBuild(){
    disposeGroup(fixtures);cage=null;cable=null;
    const sign=label('CROOKED HAT MINE',5,'#ffe3a2','#49372a');sign.position.set(-64,8.2,35);fixtures.add(sign);box(fixtures,.13,2.2,.13,wood,-66,7.1,35);box(fixtures,.13,2.2,.13,wood,-62,7.1,35);
    const bottom=Math.min(...mine.levels),ladder=new THREE.Group();ladder.position.set(-65.35,0,31.35);fixtures.add(ladder);for(const x of[-.25,.25])box(ladder,.07,6-bottom,.07,wood,x,(6+bottom)/2,0);for(let y=bottom+.25;y<6.2;y+=.4)box(ladder,.56,.045,.09,wood,0,y,-.03);
    for(const level of mine.levels.filter(y=>y<6)){
      box(fixtures,5.7,.10,2,wood,-69,level-.035,30); // Landing floor, outside the open shaft.
      box(fixtures,.10,2.8,.10,wood,-71,level+1.4,31.8);box(fixtures,.10,2.8,.10,wood,-71,level+1.4,24.1);box(fixtures,.13,.15,7.8,wood,-71,level+2.75,28);
      const l=new THREE.PointLight('#ffc677',8,12,1.4);l.position.set(-70,level+2.4,28);fixtures.add(l);box(fixtures,.13,.20,.13,lanternMaterial,-70,level+2.4,28);
      const s=label(`${6-level}m · LADDER / CAGE`,2);s.position.set(-66.3,level+2,24.7);s.rotation.y=-Math.PI/2;fixtures.add(s);
    }
    for(const t of mine.tracks){const g=new THREE.Group();g.position.set(t.x,t.y+.02,t.z);fixtures.add(g);const nx=mine.tracks.some(n=>Math.abs(n.x-t.x)===2&&n.z===t.z&&n.y===t.y),nz=mine.tracks.some(n=>Math.abs(n.z-t.z)===2&&n.x===t.x&&n.y===t.y);if(nx||t.axis==='x')rail(g,'x');if(nz||t.axis==='z')rail(g,'z');}
    for(const prop of mine.props){const g=new THREE.Group();g.position.set(prop.x,prop.y,prop.z);fixtures.add(g);if(prop.type==='rope'){const floor=mineFloor(mine,prop.x,prop.z,prop.y),depth=Math.max(.4,prop.y+.5-floor);for(const x of[-.18,.18])box(g,.035,depth,.035,wood,x,.5-depth/2,0);for(let y=.5;y>.5-depth;y-=.4)box(g,.4,.045,.07,wood,0,y,0);}else if(prop.type==='timber'){frame(g,prop);}else{box(g,.12,.22,.12,lanternMaterial,0,2,0);const l=new THREE.PointLight('#ffca80',6,10,1.4);l.position.y=2;g.add(l);}}
    const frames=mine.props.filter(p=>p.type==='timber');for(let i=0;i<frames.length;i++){const p=frames[i],q=frames.slice(0,i).filter(q=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<5.2&&Math.hypot(p.x-q.x,p.z-q.z)>1.5).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];if(!q)continue;for(const side of[-1,1]){const point=(p)=>[p.x+Math.cos(p.yaw||0)*side*(p.width||2.2)/2,p.y+.65,p.z-Math.sin(p.yaw||0)*side*(p.width||2.2)/2];log(fixtures,point(p),point(q),.09);}}
    if(mine.hoist){
      const tower=new THREE.Group();tower.position.set(-64,6,30);fixtures.add(tower);for(const x of[-1.65,1.65])for(const z of[-1.65,1.65])box(tower,.22,4.5,.22,wood,x,2.25,z);box(tower,3.8,.3,3.8,wood,0,4.5,0);
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.55,.07,6,16),iron);wheel.position.set(0,5,0);tower.add(wheel);
      box(tower,1.2,.8,1,iron,3,.5,0);box(tower,.1,.1,.8,wood,3.7,.6,.1);if(mine.hoist.powered){box(tower,1.3,1.3,1.8,iron,4,.7,-1);box(tower,.15,2,.15,iron,4.4,1.9,-1);}
      cage=new THREE.Group();fixtures.add(cage);box(cage,2.4,.14,2.4,iron,0,-.06,0);rail(cage,'x');for(const x of[-1.1,1.1])for(const z of[-1.1,1.1])box(cage,.07,2.4,.07,iron,x,1.2,z);box(cage,2.35,.09,2.35,iron,0,2.45,0);
      cable=box(fixtures,.035,1,.035,iron,-64,0,30);
    }
  }
  function cartModel(){const g=new THREE.Group();box(g,.9,.14,1.1,iron,0,.35,0);for(const x of[-.47,.47])box(g,.06,.5,1.1,wood,x,.63,0);for(const z of[-.55,.55])box(g,.97,.5,.06,wood,0,.63,z);for(const x of[-.46,.46])for(const z of[-.34,.34]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.10,10),iron);w.rotation.z=Math.PI/2;w.position.set(x,.23,z);g.add(w);}const dirt=new THREE.Group();dirt.position.y=.65;g.add(dirt);box(dirt,.85,.4,1,earth);for(const x of[-.25,0,.25])for(const z of[-.3,.15]){const lump=new THREE.Mesh(new THREE.IcosahedronGeometry(.13,0),earth);lump.position.set(x,.24,z);dirt.add(lump);}g.userData.fill=dirt;const s=label('ORE CART · Q / E',1.6);s.position.y=1.35;g.add(s);g.userData.label=s;return g;}
  function sync(state){const removed=mine.removed,brushes=mine.brushes,oldDepth=mine.levels.join();Object.assign(mine,state.mine,{removed,brushes});if(oldDepth!==mine.levels.join())rebuild();
    const key=JSON.stringify([mine.tracks,mine.props,mine.levels,!!mine.hoist,mine.hoist?.powered]);if(key!==structure){structure=key;fixturesBuild();}
    const alive=new Set();for(const c of mine.carts){alive.add(c.id);let g=carts.get(c.id);if(!g){g=cartModel();root.add(g);carts.set(c.id,g);}g.userData.state=c;}
    for(const[id,g]of carts)if(!alive.has(id)){root.remove(g);disposeGroup(g);carts.delete(id);}
  }
  function render(local){const now=performance.now()/1000,dt=Math.min(.06,Math.max(0,now-lastDustAt));lastDustAt=now;const alive=new Set();for(const h of mine.hazards||[]){if(h.supported||h.stress<45||!h.roofY||h.state==='collapsed')continue;alive.add(h.id);let g=cracks.get(h.id);if(!g){const v=[-.65,0,-.2,0,0,0,0,0,0,.7,-.02,.25,0,0,0,-.15,0,.6,-.15,0,.6,-.45,0,.8];const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#302014'}));root.add(g);cracks.set(h.id,g);}g.position.set(h.x,h.roofY-.12,h.z);const stamp=Math.floor(now*2);if(g.userData.stamp!==stamp&&Math.hypot(local.x-h.x,local.y-h.y,local.z-h.z)<9){g.userData.stamp=stamp;for(let i=0;i<(h.stress>=70?5:2);i++){const m=new THREE.Mesh(dustGeo,dustMat);m.position.set(h.x+(Math.random()-.5),h.roofY-.2,h.z+(Math.random()-.5));root.add(m);dust.push({m,vy:0,life:1.1});}}}for(const[id,g]of cracks)if(!alive.has(id)){root.remove(g);g.geometry.dispose();g.material.dispose();cracks.delete(id);}for(let i=dust.length-1;i>=0;i--){const p=dust[i];p.vy-=dt*5;p.m.position.y+=p.vy*dt;p.life-=dt;if(p.life<=0){root.remove(p.m);dust.splice(i,1);}}
torch.visible=undergroundAt(mine,local);for(const g of carts.values()){const c=g.userData.state;g.position.set(c.x,c.y,c.z);g.rotation.y=c.yaw;g.userData.label.visible=Math.hypot(local.x-c.x,local.y-c.y,local.z-c.z)>2.8;g.userData.fill.visible=c.cargo.mass>0;g.userData.fill.scale.y=.2+c.cargo.mass/240*.8;}
    if(cage&&mine.hoist){const h=mine.hoist;cage.position.set(-64,h.y,30);const length=11-(h.y+2.5);cable.position.y=(11+h.y+2.5)/2;cable.scale.y=Math.max(.1,length);}
  }
  return {load(removed={},worldSeed=0,brushes=[],rubble=[]){mine.rubble=rubble.map(b=>({...b}));mine.removed={...removed};mine.brushes=[...brushes];mine.terrainRevision++;seed=worldSeed;rebuild();structure='';},patches,brushPatches,rubblePatches,sync,render,get mine(){return mine;},get metrics(){return {chunks:chunks.size,removed:Object.keys(mine.removed).length,brushes:mine.brushes.length,supports:mine.props.filter(p=>p.type==='timber').length,rubble:(mine.rubble||[]).filter(b=>b.remaining>0).length,cracks:cracks.size,tracks:mine.tracks.length,carts:carts.size,depth:6-Math.min(...mine.levels)};},reset(){mine={levels:[6,-6],removed:{},brushes:[],rubble:[],tracks:[],carts:[],props:[],hoist:null};structure='';rebuild();}};
}
