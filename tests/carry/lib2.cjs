const L=require('./lib.cjs');
let NEXT=7000+Math.floor(Math.random()*900);
async function spawn(p,type,x,z){const id=NEXT++;await p.evaluate(([id,t,x,z])=>wsSend({t:'prop',item:id,type:t,x,z,val:Math.min(60,SIM.HEAVY[t])}),[id,type,x,z]);await p.waitForTimeout(800);return id}
async function aimAt(p,id){   // tilt a frame at a time until the crosshair is on it (what a player does with the mouse)
  await p.evaluate(id=>{const t=PROPS.get(id);if(!t)return;P.yaw=Math.atan2(-(t.x-P.x),-(t.z-P.z));P.fa=Math.atan2(t.x-P.x,t.z-P.z)},id);
  for(let k=-20;k<=60;k+=2){await p.evaluate(k=>{P.pitch=k/50},k);await p.waitForTimeout(40);if(await p.evaluate(id=>{const t=aimTarget(SIM.GRAB.REACH);return!!t&&t.id===id},id))return k/50}
  return null}
// hold W and steer toward (x,z) like a player with the mouse; samples(fn) each 150 ms
async function walkTo(p,x,z,maxS,sample){const t0=Date.now();await p.keyboard.down('w');
  while(Date.now()-t0<maxS*1000){const d=await p.evaluate(([x,z])=>{P.yaw=Math.atan2(-(x-P.x),-(z-P.z));return Math.hypot(x-P.x,z-P.z)},[x,z]);if(sample)await sample();if(d<0.8)break;await p.waitForTimeout(150)}
  await p.keyboard.up('w');return(Date.now()-t0)/1000}
module.exports={...L,spawn,aimAt,walkTo};
