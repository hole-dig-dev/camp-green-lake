'use strict';
/* Four staffed-looking corner towers. Their visible sweep uses the same time and cone math as SIM. */
const WATCHTOWERS=[];let TOWERS_PROC=null,YARD_PROC=null;const YARD_CRATES=[],MESS_TABLES=[];
const TOWER_FOOT=2.9;   // tower collider width (m): the splayed legs plus the ladder standing off one face
/* Each tower sits square to the fence with its ladder (the model's -x face) and searchlight (+z) on the two
   faces that look into the yard, so the ladder never ends up against or through the fence. */
function towerRy(o){
  const sx=Math.sign(-5-o.x),sz=Math.sign(41-o.z);   // which way the yard is from this corner
  return sx===sz?sx*Math.PI/2:sz>0?0:Math.PI;
}
{
  const pieces=[],metal=0x485350,deck=0x77634c,rail=0x9a8e71,glass=0x263840;
  const add=(w,h,d,c,x,y,z)=>pieces.push([w,h,d,c,x,y,z]);
  const towerPieces=[],addT=(w,h,d,c,x,y,z)=>towerPieces.push([w,h,d,c,x,y,z]);   // tower boxes: own mesh, hidden once the Blender tower loads
  // Packed walkways tie the gate, barracks, office and mess building into one compound.
  for(const [x,z,w,d] of [[0,35,5,14],[-29,36.5,4,11],[-12,36,24,3],[17,37,4,11]]){
    add(w,0.045,d,0xb69b72,x,baseH(x,z)+0.018,z);
  }
  // Supply stacks and a pair of shaded mess benches break up the open yard (both solid, but clear of the paths).
  // (these two go in their own mesh, YARD_PROC, so the Blender crates and mess tables can replace them)
  const yard=[],addY=(w,h,d,c,x,y,z)=>yard.push([w,h,d,c,x,y,z]);
  for(const [x,z] of [[-22,34],[23,33]]){
    for(let n=0;n<3;n++){addY(0.95,0.7,0.95,n===2?0x927c57:0x765b3b,x+n*1.05,baseH(x,z)+0.35,z);YARD_CRATES.push({x:x+n*1.05,y:baseH(x,z),z,ry:(n-1)*0.12})}
    solid(x+1.05,z,3.2,1.0);   // the three-crate stack
  }
  for(const x of [13.5,18.5]){
    addY(3.1,0.14,0.95,0x75543a,x,baseH(x,32)+0.75,32);
    for(const dx of[-1.3,1.3])addY(0.12,0.73,0.12,0x493426,x+dx,baseH(x,32)+0.37,32);
    MESS_TABLES.push({x,y:baseH(x,32),z:32,ry:0});solid(x,32,3.1,2.0);   // table + both benches
  }
  YARD_PROC=new T.Mesh(mergeBoxes(yard),mergedMat);YARD_PROC.castShadow=true;YARD_PROC.receiveShadow=true;scene.add(YARD_PROC);
  for(let i=0;i<SIM.TOWERS.length;i++){
    const o=SIM.TOWERS[i],x=o.x,z=o.z,y=baseH(x,z),H=8.4;
    for(const dx of[-1.05,1.05])for(const dz of[-1.05,1.05])addT(0.2,H,0.2,metal,x+dx,y+H/2,z+dz);
    for(const h of[1.4,4.2,7]){
      addT(2.35,0.12,0.1,metal,x,y+h,z-1.05);addT(2.35,0.12,0.1,metal,x,y+h,z+1.05);
      addT(0.1,0.12,2.35,metal,x-1.05,y+h,z);addT(0.1,0.12,2.35,metal,x+1.05,y+h,z);
    }
    addT(3.2,0.28,3.2,deck,x,y+7.25,z);
    addT(2.8,1.45,2.8,rail,x,y+8.08,z);
    for(const side of[-1,1]){
      addT(1.65,0.75,0.06,glass,x,y+8.15,z+side*1.43);
      addT(0.06,0.75,1.65,glass,x+side*1.43,y+8.15,z);
    }
    addT(3.45,0.24,3.45,metal,x,y+8.94,z);
    addT(0.75,0.2,0.75,0xe8d398,x,y+9.05,z);
    // A slim ladder is a visual affordance; the tower itself stays inaccessible. It climbs the same face as the
    // Blender model's ladder, which towerRy turns toward the yard.
    const ry=towerRy(o),lx=-Math.cos(ry),lz=Math.sin(ry),alongX=Math.abs(lx)>0.5,ax=x+lx*1.42,az=z+lz*1.42;
    for(let h=0.5;h<7;h+=0.48)addT(alongX?0.08:0.85,0.07,alongX?0.85:0.08,rail,ax,y+h,az);
    for(const s of[-0.43,0.43])addT(0.08,6.8,0.08,metal,ax+(alongX?0:s),y+3.4,az+(alongX?s:0));
    solid(x,z,TOWER_FOOT,TOWER_FOOT);
    const by=y+8.55;
    const beam=new T.Mesh(new T.ConeGeometry(Math.tan(SIM.TOWER_HALF_ANGLE)*SIM.TOWER_RANGE,SIM.TOWER_RANGE,12,1,true),
      new T.MeshBasicMaterial({color:0xffe7aa,transparent:true,opacity:0.11,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}));
    beam.geometry.translate(0,-SIM.TOWER_RANGE/2,0);beam.position.set(x,by,z);beam.visible=false;scene.add(beam);
    const lamp=new T.Mesh(new T.SphereGeometry(0.3,6,4),new T.MeshBasicMaterial({color:0xffe5a6}));lamp.position.set(x,by,z);lamp.visible=false;scene.add(lamp);
    WATCHTOWERS.push({beam,lamp,x,z,by});
  }
  const staticMesh=new T.Mesh(mergeBoxes(pieces),mergedMat);staticMesh.castShadow=true;staticMesh.receiveShadow=true;scene.add(staticMesh);
  TOWERS_PROC=new T.Mesh(mergeBoxes(towerPieces),mergedMat);TOWERS_PROC.castShadow=true;TOWERS_PROC.receiveShadow=true;scene.add(TOWERS_PROC);
}
const TOWER_AXIS=new T.Vector3(0,-1,0),TOWER_DIR=new T.Vector3();
function updateWatchtowers(){
  const n=nightF(),t=clockT();
  for(let i=0;i<WATCHTOWERS.length;i++){
    const o=WATCHTOWERS[i],on=n>0.04;o.beam.visible=on;o.lamp.visible=on;
    if(!on)continue;
    const a=SIM.towerHeading(i,t);
    TOWER_DIR.set(Math.sin(a)*SIM.TOWER_RANGE,-8.55,Math.cos(a)*SIM.TOWER_RANGE).normalize();
    o.beam.quaternion.setFromUnitVectors(TOWER_AXIS,TOWER_DIR);
    o.beam.material.opacity=0.11*n;
  }
}
