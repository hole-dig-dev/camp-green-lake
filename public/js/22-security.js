'use strict';
/* Four staffed-looking corner towers. Their visible sweep uses the same time and cone math as SIM. */
const WATCHTOWERS=[];
{
  const pieces=[],metal=0x485350,deck=0x77634c,rail=0x9a8e71,glass=0x263840;
  const add=(w,h,d,c,x,y,z,r)=>pieces.push([w,h,d,c,x,y,z,r]);
  // Packed walkways tie the gate, barracks, office and mess building into one compound.
  for(const [x,z,w,d] of [[0,35,5,14],[-29,36.5,4,11],[-12,36,24,3],[17,37,4,11]]){
    add(w,0.045,d,0xb69b72,x,baseH(x,z)+0.018,z);
  }
  // Supply stacks and a pair of shaded mess benches break up the open yard without blocking paths.
  for(const [x,z] of [[-22,34],[23,33]]){
    for(let n=0;n<3;n++)add(0.95,0.7,0.95,n===2?0x927c57:0x765b3b,x+n*1.05,baseH(x,z)+0.35,z);
  }
  for(const x of [13.5,18.5]){
    add(3.1,0.14,0.95,0x75543a,x,baseH(x,32)+0.75,32);
    for(const dx of[-1.3,1.3])add(0.12,0.73,0.12,0x493426,x+dx,baseH(x,32)+0.37,32);
  }
  for(let i=0;i<SIM.TOWERS.length;i++){
    const o=SIM.TOWERS[i],x=o.x,z=o.z,y=baseH(x,z),H=7.35;
    for(const dx of[-1.13,1.13])for(const dz of[-1.13,1.13]){
      add(0.24,H,0.24,metal,x+dx,y+H/2,z+dz);
      add(0.39,0.18,0.39,0x9d9278,x+dx,y+0.09,z+dz);
    }
    for(const h of[1.8,4.5,6.8]){
      add(2.5,0.14,0.12,metal,x,y+h,z-1.13);add(2.5,0.14,0.12,metal,x,y+h,z+1.13);
      add(0.12,0.14,2.5,metal,x-1.13,y+h,z);add(0.12,0.14,2.5,metal,x+1.13,y+h,z);
    }
    // Cross braces keep the tall frame from reading as four floating posts.
    const angle=Math.atan2(2.7,2.26),length=Math.hypot(2.7,2.26);
    for(const side of[-1,1]){
      for(const h of[1.8,4.5]){
        add(length,0.105,0.12,rail,x,y+h+1.35,z+side*1.13,[0,0,angle]);
        add(length,0.105,0.12,rail,x,y+h+1.35,z+side*1.13,[0,0,-angle]);
        add(0.12,0.105,length,rail,x+side*1.13,y+h+1.35,z,[angle,0,0]);
        add(0.12,0.105,length,rail,x+side*1.13,y+h+1.35,z,[-angle,0,0]);
      }
    }
    add(3.35,0.23,3.35,deck,x,y+7.28,z);
    for(const side of[-1,1]){
      add(3.0,0.62,0.13,deck,x,y+7.7,z+side*1.48);
      add(0.13,0.62,3.0,deck,x+side*1.48,y+7.7,z);
      add(1.8,0.79,0.055,glass,x,y+8.42,z+side*1.49);
      add(0.055,0.79,1.8,glass,x+side*1.49,y+8.42,z);
      for(const a of[-1.45,1.45]){
        add(0.13,1.3,0.14,metal,x+a,y+8.25,z+side*1.48);
        add(0.14,1.3,0.13,metal,x+side*1.48,y+8.25,z+a);
      }
      add(3.3,0.13,0.16,rail,x,y+8.93,z+side*1.48);
      add(0.16,0.13,3.3,rail,x+side*1.48,y+8.93,z);
    }
    add(3.85,0.2,3.85,metal,x,y+9.22,z);
    add(0.8,0.16,0.8,0xe8d398,x,y+9.32,z);
    const cap=new T.Mesh(new T.ConeGeometry(2.75,0.9,4),M(0x68614c));
    cap.rotation.y=Math.PI/4;cap.position.set(x,y+9.75,z);cap.castShadow=true;scene.add(cap);
    // A slim ladder is a visual affordance; the tower itself stays inaccessible.
    for(let h=0.5;h<7;h+=0.48)add(0.85,0.07,0.08,rail,x-1.42,y+h,z);
    for(const sz of[-0.43,0.43])add(0.08,6.8,0.08,metal,x-1.42,y+3.4,z+sz);
    const by=y+8.55;
    const beam=new T.Mesh(new T.ConeGeometry(Math.tan(SIM.TOWER_HALF_ANGLE)*SIM.TOWER_RANGE,SIM.TOWER_RANGE,12,1,true),
      new T.MeshBasicMaterial({color:0xffe7aa,transparent:true,opacity:0.11,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}));
    beam.geometry.translate(0,-SIM.TOWER_RANGE/2,0);beam.position.set(x,by,z);beam.visible=false;scene.add(beam);
    const lamp=new T.Mesh(new T.SphereGeometry(0.3,6,4),new T.MeshBasicMaterial({color:0xffe5a6}));lamp.position.set(x,by,z);lamp.visible=false;scene.add(lamp);
    WATCHTOWERS.push({beam,lamp,x,z,by});
  }
  const staticMesh=new T.Mesh(mergeBoxes(pieces),mergedMat);staticMesh.castShadow=true;staticMesh.receiveShadow=true;scene.add(staticMesh);
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
