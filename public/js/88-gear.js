'use strict';
/* public/js/88-gear.js -- late-game gear and the scarecrow (JT 2026-10-01).
   Scarecrow (stack, S.scarecrow): U (remappable: 'place') plants one where you stand, out on the lake bed. Vultures
   won't go for anyone within SCARE_R m of one: they circle off (83-vultures.js asks scareNear). Vultures only. One
   camp-wide set on the server (world.scarecrows, up to SCARE_MAX), Scarecrow.glb (Sol).
   Gravity boots (S.up.grav): twisters can't suck you up, giant tumbleweeds can't roll you up, vultures can't lift you;
   blasts still throw you (that's the fun). The catch: you walk gear.gravSlow as fast. Friends see them: worn in place of
   your shoes (public/models/footwear/gravity-boots.glb, bound like the Wardrobe's shoes, 81-wardrobe.js), pos flag gv.
   Grapple hook (S.up.grapple): down a sinkhole or a hole too deep to climb, hold F for GRAP_T s: the hook flies to the
   rim and hauls you out (popOutOfSinkhole / popOut).
   Gold-plated shovel (S.up.goldShovel): pure flex, its steel goes gold for everyone (25-people.js spadeLook, pos gs). */
const SCARE_R=25,SCARE_MAX=12,GRAP_T=1.4;
const SCARE={list:new Map(),parts:null,loading:false};
const gravOn=()=>!!(S.started&&S.up.grav);
const scareNear=(x,z)=>{for(const s of SCARE.list.values())if(Math.hypot(s.x-x,s.z-z)<SCARE_R)return true;return false};
function scareLoad(){if(SCARE.loading)return;SCARE.loading=true;modelParts('Scarecrow').then(p=>{SCARE.parts=p;for(const s of SCARE.list.values())scareMesh(s)}).catch(()=>{})}
function scareMesh(s){scareLoad();if(s.obj||!SCARE.parts)return;const g=new T.Group();for(const pt of SCARE.parts){const m=new T.Mesh(pt.geometry,pt.material);m.castShadow=true;g.add(m)}g.position.set(s.x,groundAt(s.x,s.z),s.z);g.rotation.y=(s.id*2.1)%6.28;scene.add(g);s.obj=g}
function scaresSet(list){for(const s of SCARE.list.values())if(s.obj)scene.remove(s.obj);SCARE.list.clear();for(const d of list||[]){const s={id:d.id,x:+d.x,z:+d.z,obj:null};SCARE.list.set(s.id,s);scareMesh(s)}}
function plantScarecrow(){
  if(!S.started||S.ko||twSt||inTent()||S.inTown||uiOpen())return;
  if(!(S.scarecrow>0)){toast('No scarecrow. The Supply Depot has them.','',2400);return}
  if(inCamp(P.x,P.z)){toast('Out on the lake bed: that\'s where the vultures are.','',2600);return}
  S.scarecrow--;sfx.thud();toast(`Scarecrow up. Vultures won't come within ${SCARE_R} m of it.`,'good',3000);logEv('scarecrow',{x:+P.x.toFixed(1),z:+P.z.toFixed(1)});
  const fx=Math.sin(P.fa),fz=Math.cos(P.fa),x=+(P.x+fx*1.2).toFixed(2),z=+(P.z+fz*1.2).toFixed(2);
  if(online())wsSend({t:'scare',x,z});else{const id=Date.now();const l=[...SCARE.list.values()].map(s=>({id:s.id,x:s.x,z:s.z}));l.push({id,x,z});scaresSet(l.slice(-SCARE_MAX))}
}
/* the grapple hook */
const GRAP={t:0,line:null,head:null,fly:0};
function grappleStuck(){if(!S.started||!S.up.grapple||S.ko)return null;if(typeof inSinkhole==='function'&&inSinkhole())return 'sink';if(isTrapped())return 'hole';return null}
function grappleSpot(){const k=grappleStuck();if(!k)return null;return{id:'grapple',label:GRAP.t>0?`Grappling… ${Math.floor(GRAP.t/GRAP_T*100)}%`:'Hold F: fire your grapple hook at the rim',use:()=>{}}}
function grappleDone(k){
  sfx.clank();addXP(5);logEv('grapple',{k});
  if(k==='sink'&&sinkTrapped)popOutOfSinkhole(sinkTrapped);else popOut();
  toast('Up and out on your grapple hook.','good',2200);GRAP.fly=0.6;
}
function updateGear(dt){
  /* friends' gravity boots and gold shovels, from their pos flags */
  for(const R of remotes.values()){R.p.goldShovel=!!R.gs;if(R.p.gravBoots!==!!R.gv){R.p.gravBoots=!!R.gv;if(R.p.ward||R.gv){R.p.ward=R.p.ward||wardDefault();wardApply(R.p)}}}
  if(me){me.goldShovel=!!S.up.goldShovel;if(me.gravBoots!==!!S.up.grav){me.gravBoots=!!S.up.grav;me.ward=me.ward||MY_WARD;wardApply(me)}}
  /* the grapple: hold F while stuck */
  const k=(KEYS['f'])&&!uiOpen()?grappleStuck():null;
  if(k){GRAP.t+=dt;digHeld=false;if(GRAP.t>=GRAP_T){GRAP.t=0;grappleDone(k)}}else if(GRAP.t>0)GRAP.t=Math.max(0,GRAP.t-dt*2);
  if(GRAP.t>0||GRAP.fly>0){GRAP.fly=Math.max(0,GRAP.fly-dt);
    if(!GRAP.line){GRAP.line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0x8a6a44}));GRAP.line.frustumCulled=false;scene.add(GRAP.line)}
    const fx=Math.sin(P.fa),fz=Math.cos(P.fa),u=GRAP.fly>0?1:clamp(GRAP.t/GRAP_T*1.6,0,1),rx=P.x+fx*3*u,rz=P.z+fz*3*u;
    GRAP.line.visible=true;GRAP.line.geometry.setFromPoints([new T.Vector3(P.x,P.y+1.3,P.z),new T.Vector3(rx,Math.max(groundAt(rx,rz),P.y)+0.4*u+0.2,rz)])}
  else if(GRAP.line)GRAP.line.visible=false;
}
