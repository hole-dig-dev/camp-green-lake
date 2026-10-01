// shared helpers for the carry tests
const { chromium } = require('playwright');
const ARGS=['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan','--ignore-gpu-blocklist'];
async function browser(){return chromium.launch({headless:true,args:ARGS})}
async function player(b,port,name,errs){
  const p=await (await b.newContext({viewport:{width:960,height:600}})).newPage();
  p.on('pageerror',e=>errs.push(name+': '+e.message));
  await p.goto(`http://127.0.0.1:${port}/?r=1`);await p.waitForFunction(()=>!document.querySelector('#startBtn').disabled,null,{timeout:30000});
  await p.evaluate(n=>{document.querySelector('#nick').value=n;document.querySelector('#startBtn').click()},name);
  await p.waitForFunction(()=>!document.querySelector('#hud').hidden&&MODEL.ready,null,{timeout:60000});
  await p.evaluate(()=>{runCommand('time 10:00');runCommand('roster off');GOD=false;S.water=999;S.stam=100});
  // log every grab change and toast
  await p.evaluate(()=>{window.__ev=[];const og=grabTarget,orl=releaseGrab;
    window.grabTarget=function(t){const r=og(t);__ev.push(['grab',performance.now()|0,t&&t.id,r]);return r};
    window.releaseGrab=function(a,b){__ev.push(['release',performance.now()|0,GRAB_ST.id,!!a,new Error().stack.split('\n')[2].trim().slice(0,90)]);return orl(a,b)};
    const oh=propHit;window.propHit=function(pr,loss){__ev.push(['HIT',performance.now()|0,pr.id,loss,'held:'+GRAB_ST.id,'hands:'+(pr.hands?pr.hands.size:0),'grab:'+(pr.grab||[]).join('/')]);return oh(pr,loss)};
    const ot=toast;window.toast=function(m,c,d){__ev.push(['toast',performance.now()|0,String(m).slice(0,90)]);return ot(m,c,d)};});
  return p;
}
// look at a world point (sets the camera's aim like the mouse would)
async function lookAt(p,x,y,z){await p.evaluate(([x,y,z])=>{const e=new T.Vector3();camera.getWorldPosition(e);const dx=x-e.x,dy=y-e.y,dz=z-e.z;P.yaw=Math.atan2(-dx,-dz);P.fa=Math.atan2(dx,dz);P.pitch=clamp(-Math.atan2(dy,Math.hypot(dx,dz))+(FP?0:0),-1.35,1.35)},[x,y,z])}
module.exports={browser,player,lookAt};
