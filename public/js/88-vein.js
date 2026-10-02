'use strict';
/* public/js/88-vein.js -- rich vein events (JT 2026-10-01). Every so often (server.js veinTick, vein.every minutes) a
   patch of the lake bed turns rich for vein.time minutes: everyone's told, it glitters (a gold ring on the ground and
   sparkles) and shows on the minimap. Inside it:
   - digging pays gold straight into the crew wallet as you go (a hole's worth of gold per hole dug, x vein.mult, on top
     of the sand: the sand still sifts as usual, so it's double gold);
   - it's a player adventure (JT): the crew don't go for it;
   - dynamite in it throws up a burst of nuggets for whoever lit it, and its loose sand is rich too (server pile.rich):
     scooping it pays like digging.
   Not a hazard: the F2 Hazards switch leaves it alone. Off with vein.every = 0. */
const VEIN={on:false,x:0,z:0,r:12,until:0,acc:0,ring:null,sparkT:0};
const inVein=(x,z)=>VEIN.on&&Math.hypot(x-VEIN.x,z-VEIN.z)<VEIN.r;
function veinSet(v){
  const was=VEIN.on;VEIN.on=!!(v&&v.on);if(VEIN.on){VEIN.x=+v.x;VEIN.z=+v.z;VEIN.r=+v.r||12;VEIN.until=Date.now()+Math.max(0,+v.left||0)}
  if(VEIN.on&&!was&&S.started&&!v.quiet){const dx=VEIN.x-P.x,dz=VEIN.z-P.z,d=Math.round(Math.hypot(dx,dz)),dir=['east','south-east','south','south-west','west','north-west','north','north-east'][((Math.round(Math.atan2(dz,dx)/(Math.PI/4))%8)+8)%8];
    sfx.gold();toast(`A rich vein! The ground's glittering ${d} m ${dir} of you. Double gold there for ${Math.round(tune('vein.time'))} minutes.`,'gold',6000)}
  if(!VEIN.on&&was&&S.started)toast('The rich vein\'s played out.','',3000);
  veinLook();
}
function veinLook(){
  if(!VEIN.ring){VEIN.ring=new T.Mesh(new T.RingGeometry(0.93,1,64),new T.MeshBasicMaterial({color:0xffd34a,transparent:true,opacity:0.55,depthWrite:false,side:T.DoubleSide}));VEIN.ring.rotation.x=-Math.PI/2;scene.add(VEIN.ring)}
  VEIN.ring.visible=VEIN.on;if(VEIN.on){VEIN.ring.scale.setScalar(VEIN.r);VEIN.ring.position.set(VEIN.x,baseH(VEIN.x,VEIN.z)+0.08,VEIN.z)}
}
/* gold straight to the wallet: v holes' worth dug (or scooped) inside the vein */
function veinPay(v){
  VEIN.acc+=v*tune('gold.perHole')*goldScale()*tune('vein.mult');
  const g=Math.floor(VEIN.acc);if(g<1)return;VEIN.acc-=g;S.seeds+=g;foundGold(g);sfx.coin();
  if(performance.now()-(veinPay.t||0)>3500){veinPay.t=performance.now();toast(`Rich vein! +${g} gold as you dig.`,'gold',1800)}
}
function veinDynamite(f){   /* 88-dynamite.js: it went off inside the vein: nuggets for whoever lit it */
  if(!inVein(f.x,f.z)||f.by!==S.name)return;const g=Math.round(3*tune('gold.perHole')*goldScale()*tune('vein.mult'));
  S.seeds+=g;foundGold(g);sfx.gold();toast(`The blast throws up nuggets! +${g} gold.`,'gold',3200)}
function updateVein(dt){
  if(!VEIN.on)return;if(Date.now()>VEIN.until+2000&&!online()){veinSet({on:false});return}
  VEIN.ring.material.opacity=0.35+0.25*Math.sin(performance.now()/300);
  VEIN.sparkT-=dt;if(VEIN.sparkT<=0&&nearCam(VEIN.x,VEIN.z,VEIN.r+60)){VEIN.sparkT=0.15;const a=Math.random()*6.28,d=Math.sqrt(Math.random())*VEIN.r,x=VEIN.x+Math.cos(a)*d,z=VEIN.z+Math.sin(a)*d;sparkle(x,baseH(x,z)+0.1,z)}
}
/* a glint: a little gold flash that floats up and fades */
const SPARKS=[];let sparkMat=null;
function sparkle(x,y,z){if(!sparkMat)sparkMat=new T.MeshBasicMaterial({color:0xffe27a,transparent:true,depthWrite:false});
  const m=new T.Mesh(sparkGeo||(sparkGeo=new T.OctahedronGeometry(0.07,0)),sparkMat.clone());m.position.set(x,y,z);scene.add(m);SPARKS.push({m,t:0})}
let sparkGeo=null;
function updateSparks(dt){for(let i=SPARKS.length-1;i>=0;i--){const s=SPARKS[i];s.t+=dt;s.m.position.y+=dt*0.6;s.m.rotation.y+=dt*6;s.m.material.opacity=Math.max(0,1-s.t/1.2);if(s.t>1.2){scene.remove(s.m);s.m.material.dispose();SPARKS.splice(i,1)}}}
/* minimap: a gold ring where it is */
function veinMap(mx,wx,wz,ws){if(!VEIN.on)return;mx.strokeStyle='#ffcf33';mx.lineWidth=3;mx.beginPath();mx.arc(wx(VEIN.x),wz(VEIN.z),Math.max(5,ws(VEIN.r)),0,6.3);mx.stroke();mx.fillStyle='rgba(255,207,51,.25)';mx.fill()}
command('vein',{usage:'vein',help:'Start a rich vein 25 m in front of you (testing).',run(){const x=P.x+Math.sin(P.fa)*25,z=P.z+Math.cos(P.fa)*25;if(online())wsSend({t:'veinNow',x,z});else veinSet({on:true,x,z,r:12,left:tune('vein.time')*60000});return'A rich vein, 25 m ahead.'}});
