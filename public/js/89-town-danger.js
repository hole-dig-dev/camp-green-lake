'use strict';
/* public/js/89-town-danger.js -- the buried town's one threat (2026-11-11): creaky ceilings. Three long tunnels have a
   stretch where the timbers have gone crooked and the lake bed bulges through (sim.js townSags, the same every run; the
   sand trickles there more than anywhere). They're fine if you're gentle. Run past one, or shout near it, and the timbers
   groan and sand pours: a warning. Do it again while it's still groaning and the ceiling comes down, filling the tunnel
   (anyone right under it dives clear with a few bruises). The pile cuts that tunnel for the whole crew until somebody
   digs through it (hold E; quicker with a shovel). Once dug clear it has settled and won't come down again.
   Learnable (it always warns first, and the bulge is visible), avoidable (walk), shared ('tcave', server-held for the
   run), and behind the hazard switches (F2 > Hazards: ALL, or "Buried town cave-ins"). */
const CAVE_R=1.7;            // m around a fallen ceiling that's blocked until it's dug clear
const CAVE_RUN_R=6;          // m: running this close disturbs it
const CAVE_SHOUT_R=10;       // m: shouting this close disturbs it
const CAVE_WARN_T=8;         // s it keeps groaning after a disturbance; another one in that time brings it down
const CAVE_DIG_S=6;          // s of digging (E) to clear one with a shovel (twice that with your hands)
const TD={sags:[],piles:[],warnT:[],told:new Set(),runT:0,noise0:0,dig:0,digI:-1,digSnd:0};
function townDangerPlace(L,put){TD.sags=SIM.townSags();TD.warnT=TD.sags.map(()=>0);for(const s of TD.sags)put('TownSag',s.x,s.z,s.ry)}
function townDangerBuild(grp,L){
  TD.piles=TD.sags.map(()=>null);
  loadModel('TownCaveIn').then(({meshes})=>{if(grp!==townGroup)return;
    TD.sags.forEach((s,i)=>{const g=new T.Group();for(const m of meshes){const k=new T.Mesh(m.geometry,m.material);k.applyMatrix4(m.matrix);g.add(k)}
      g.position.set(tx(s.x),TW.Y,tz(s.z));g.rotation.y=s.ry;grp.add(g);TD.piles[i]=g;g.visible=TST.caves[i]===1})}).catch(()=>{});
}
function townCaveBlocks(x,z){for(let i=0;i<TD.sags.length;i++)if(TST.caves[i]===1&&Math.hypot(x-tx(TD.sags[i].x),z-tz(TD.sags[i].z))<CAVE_R)return true;return false}
function townDangerState(m){
  TD.piles.forEach((g,i)=>{if(g)g.visible=TST.caves[i]===1});
  if(!m||m.t!=='tcave')return;const s=TD.sags[m.i];if(!s)return;const x=tx(s.x),z=tz(s.z),d=Math.hypot(x-P.x,z-P.z);
  if(m.v===1){   // it came down
    if(S.inTown&&d<45){townRumble(Math.max(0.3,1-d/45));for(let k=0;k<5;k++)setTimeout(()=>puff(x+(Math.random()-0.5)*2,TW.Y+0.4,z+(Math.random()-0.5)*2,x,z,8),k*120)}
    if(S.inTown&&d<CAVE_R+0.4){   // right under it: dive clear, out the side you came in
      const ax=Math.sin(s.ry),az=Math.cos(s.ry),side=(P.x-x)*ax+(P.z-z)*az>=0?1:-1;P.x=x+ax*side*(CAVE_R+0.6);P.z=z+az*side*(CAVE_R+0.6);
      hurt(8,'Cave-in','The ceiling came down on you.');toast('The ceiling comes down! You dive clear, mostly. The tunnel is blocked: dig through it (hold E).','bad',6000)}
    else if(S.inTown&&d<45)toast(m.by===(S.name||'You')?'Behind you, the ceiling comes down with a roar. That tunnel is blocked until someone digs through (hold E at the pile).':`A roar and a gust of dust: a ceiling came down somewhere${d<20?' close':''}. ${m.by} was nearby.`,'bad',5500);
  }else if(m.v===2&&S.inTown&&d<30)toast(`${m.by===(S.name||'You')?'You dig':m.by+' digs'} through the cave-in. It's settled now.`,'good',3500);
}
/* what you're near: a pile to dig through */
function townDangerSpot(){
  for(let i=0;i<TD.sags.length;i++)if(TST.caves[i]===1&&Math.hypot(tx(TD.sags[i].x)-P.x,tz(TD.sags[i].z)-P.z)<CAVE_R+1.3)return{id:'townCave',i,label:'Dig through the cave-in (hold E)'};
  return null;
}
function townDangerUse(s){if(s.id!=='townCave')return false;toast('Hold E to dig through it.','',2000);return true}
function townDangerUpdate(dt){
  if(!TD.sags.length)return;
  // digging through a pile: hold E next to it
  const sp=townDangerSpot();
  if(sp&&KEYS['e']&&!uiOpen()&&!S.ko){if(TD.digI!==sp.i){TD.digI=sp.i;TD.dig=0;toast('Digging through the cave-in...','',2000)}
    TD.dig+=dt*(S.up.shovel?1:0.5);P.anim=2;if((TD.digSnd-=dt)<=0){TD.digSnd=0.55;sfx.scoop();const s=TD.sags[sp.i];puff(tx(s.x),TW.Y+0.3,tz(s.z),P.x,P.z,3)}
    if(TD.dig>=CAVE_DIG_S){TD.dig=0;TD.digI=-1;townAct({t:'tcave',i:sp.i,op:'clear'});addXP(15)}}
  else if(!sp)TD.digI=-1;
  if(!hazOn('cavein')||S.ko)return;
  // what disturbs a creaky ceiling: running near it, or a shout
  const shout=S.noise>0.95&&TD.noise0<=0.95;TD.noise0=S.noise;
  const run=P.moving&&P.anim===4;if(run)TD.runT+=dt;else TD.runT=0;
  TD.sags.forEach((s,i)=>{
    if(TD.warnT[i]>0)TD.warnT[i]-=dt;if(TST.caves[i])return;
    const d=Math.hypot(tx(s.x)-P.x,tz(s.z)-P.z),hit=(run&&d<CAVE_RUN_R&&TD.runT>0.4)||(shout&&d<CAVE_SHOUT_R);if(!hit)return;
    if(TD.warnT[i]>CAVE_WARN_T-1.5)return;   // still the same disturbance
    if(TD.warnT[i]>0){townAct({t:'tcave',i,op:'fall'});return}
    TD.warnT[i]=CAVE_WARN_T;townCreak();setTimeout(townCreak,500);noise(2.2,4800,0.7,0.09,'highpass');
    for(let k=0;k<6;k++)setTimeout(()=>puff(tx(s.x)+(Math.random()-0.5)*1.4,TW.Y+2.2,tz(s.z)+(Math.random()-0.5)*1.4,tx(s.x),tz(s.z),2),k*200);
    toast(TD.told.has(i)?'The timbers groan again. Easy...':'The timbers overhead groan and sand pours down. Something up there didn\'t like that. (Walk, and keep your voice down.)','bad',4500);TD.told.add(i);
  });
}
