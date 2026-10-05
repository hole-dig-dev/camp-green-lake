import * as THREE from '/vendor/three.module.js';
export function createRelicView(scene,camera,label){
 const models=new Map(),gold=new THREE.MeshStandardMaterial({color:'#e9b845',metalness:.7,roughness:.35}),silver=new THREE.MeshStandardMaterial({color:'#b7b6a2',metalness:.6,roughness:.5}),leather=new THREE.MeshStandardMaterial({color:'#733f26'}),wood=new THREE.MeshStandardMaterial({color:'#ac7440'}),cream=new THREE.MeshStandardMaterial({color:'#f4e5b9'});
 function piece(g,geo,mat,x=0,y=0,z=0){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);g.add(o);o.castShadow=true;return o;}
 function beam(g,a,b,r,mat){const dir=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),o=piece(g,new THREE.CylinderGeometry(r,r,dir.length(),8),mat);o.position.set(...a).addScaledVector(dir,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return o;}
 function build(t){const g=new THREE.Group();scene.add(g);g.position.set(t.x,t.y+.07,t.z);
  if(t.type==='motherlode'){const rock=piece(g,new THREE.IcosahedronGeometry(.47,1),gold);rock.scale.set(1.2,.8,1);for(let i=0;i<5;i++)piece(g,new THREE.IcosahedronGeometry(.13,0),gold,Math.sin(i)*.38,Math.cos(i)*.25,Math.cos(i*2)*.3);}
  else if(t.type==='watch'||t.type==='coin'){const disk=piece(g,new THREE.CylinderGeometry(.18,.18,.065,16),gold);disk.rotation.x=Math.PI/2;disk.rotation.z=.3;if(t.type==='watch'){const face=piece(g,new THREE.CircleGeometry(.15,16),cream,0,0,-.04);face.rotation.y=Math.PI;beam(g,[0,0,-.045],[.08,.05,-.045],.008,leather);beam(g,[0,0,-.046],[-.02,.12,-.046],.007,leather);piece(g,new THREE.TorusGeometry(.055,.013,6,12),gold,0,.22,0);}else piece(g,new THREE.IcosahedronGeometry(.055,0),silver,0,0,-.045);}
  else if(t.type==='horseshoe'){const shoe=piece(g,new THREE.TorusGeometry(.19,.043,6,14,Math.PI*1.45),silver);shoe.rotation.z=-.7;}
  else{piece(g,new THREE.BoxGeometry(.17,.32,.17),leather,0,.05,0);piece(g,new THREE.BoxGeometry(.18,.13,.31),leather,0,-.1,-.08);piece(g,new THREE.BoxGeometry(.20,.035,.32),silver,0,-.18,-.08);}
  const shine=piece(g,new THREE.OctahedronGeometry(.055,0),cream,.25,.34,0);shine.castShadow=false;const sign=label(t.name,1.55,'#ffe89d','#554029');sign.position.y=t.type==='motherlode'?.88:.6;g.add(sign);g.userData={t,shine,sign};return g;
 }
 const rod=new THREE.Group();camera.add(rod);rod.position.set(.37,-.42,-.72);rod.rotation.z=-.18;
 beam(rod,[-.21,-.2,.04],[0,.10,-.15],.018,wood);beam(rod,[.21,-.2,.04],[0,.10,-.15],.018,wood);beam(rod,[0,.10,-.15],[0,.39,-.30],.019,silver);
 const dial=piece(rod,new THREE.CylinderGeometry(.11,.11,.045,16),gold,0,.09,-.13);dial.rotation.x=Math.PI/2;const gauge=piece(rod,new THREE.CircleGeometry(.092,16),cream,0,.09,-.102);
 const needle=new THREE.Group();needle.position.set(0,.09,-.095);rod.add(needle);beam(needle,[0,0,0],[0,.079,0],.008,leather);
 for(const side of[-1,1])piece(rod,new THREE.IcosahedronGeometry(.07,1),new THREE.MeshStandardMaterial({color:'#dfad75'}),side*.21,-.2,.04);
 rod.traverse(o=>{o.layers.set(1);o.castShadow=false;});rod.visible=false;
 function sync(items=[]){const alive=new Set();for(const t of items){alive.add(t.id);let g=models.get(t.id);if(!g){g=build(t);models.set(t.id,g);}g.position.set(t.x,t.y+.07,t.z);g.userData.t=t;}for(const[id,g]of models)if(!alive.has(id)){scene.remove(g);g.traverse(o=>{if(o.geometry)o.geometry.dispose();});models.delete(id);}}
 function render(time,state,local,tool){const strength=state?.self.relicSignal?.strength||0;rod.visible=tool==='rod'&&!!state?.self.upgrades.includes('diviningrod')&&!state.self.vehicle&&!state.self.cart&&!state.self.mineCart&&!state.self.hoistRide&&!state.self.busy&&state.self.tumbleUntil<state.now;
  rod.rotation.x=Math.sin(time*3)*.025+Math.sin(time*(4+strength*25))*strength*.055;needle.rotation.z=1.05-strength*2.1+Math.sin(time*32)*strength*.13;
  for(const g of models.values()){g.userData.shine.rotation.y=time*2;g.userData.shine.scale.setScalar(.65+Math.sin(time*4)*.3);const d=Math.hypot(g.position.x-local.x,g.position.y-local.y,g.position.z-local.z);g.userData.sign.visible=d>1.8&&d<5;}
 }
 return {sync,render,reset(){sync([]);rod.visible=false;},get metrics(){return {visible:models.size,rodVisible:rod.visible,needle:needle.rotation.z};}};
}
