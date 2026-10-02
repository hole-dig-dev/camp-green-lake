// sifter hopper upgrades (86-hopper.js): dump your bucket and go; it sifts on its own and pays you. bash tests/carry/run.sh PORT OUT hopper.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
const G=await A.evaluate(()=>SIM.GOLD.SIFTER);
await A.evaluate(G=>{S.up.pan=true;S.up.bucket=true;S.bucket=5;P.x=G.x;P.z=G.z+1.6;P.y=groundAt(P.x,P.z);runCommand('time 10:00')},G);await A.waitForTimeout(600);
check('no hopper: the sifter works as before (no hopper meter)',await A.evaluate(()=>hopperCap()===0&&document.getElementById('hopperMeter').hidden));
check('the store sells three tiers, each needing the last',await A.evaluate(()=>{const ids=SHOP.map(i=>i.id);return ids.includes('hopper')&&SHOP.find(i=>i.id==='hopper2').needs==='hopper'&&SHOP.find(i=>i.id==='hopper3').needs==='hopper2'}));
await A.evaluate(()=>{S.up.hopper=true});await A.waitForTimeout(300);
check('the prompt says dump',await A.evaluate(()=>/Dump your bucket into the hopper/.test(document.body.innerText)));
const g0=await A.evaluate(()=>S.seeds);
await A.keyboard.press('f');await A.waitForTimeout(500);
check('F dumps the bucket at once: empty bucket, 5 holes in the hopper, no cinematic',await A.evaluate(()=>S.bucket===0&&S.hopper>4.8&&S.hopper<=5&&!gfxBusy()),await A.evaluate(()=>JSON.stringify({b:S.bucket,h:S.hopper})));
check('the hopper meter shows',await A.evaluate(()=>!document.getElementById('hopperMeter').hidden));
await A.evaluate(()=>{P.yaw=-Math.PI/2+0.35;P.pitch=0.25;if(FP)toggleView()});await A.waitForTimeout(400);await A.screenshot({path:SP+'/t1_full.png'});
// walk away: it keeps sifting and paying (8 s a hole at tier 1)
await A.evaluate(G=>{P.x=G.x-20;P.z=G.z-30;P.y=groundAt(P.x,P.z)},G);await A.waitForTimeout(17500);
const mid=await A.evaluate(()=>({h:S.hopper,g:S.seeds}));
check('away from it, about 2 holes sifted in 17 s and gold paid to you',mid.h<3.2&&mid.h>2.6&&mid.g>g0,JSON.stringify(mid));
// a full one over capacity: only what fits goes in
await A.evaluate(G=>{tuneSet('gold.hopperSpeed',0.2);S.hopper=18;S.bucket=5;P.x=G.x;P.z=G.z+1.6;P.y=groundAt(P.x,P.z)},G);await A.waitForTimeout(400);
await A.keyboard.press('f');await A.waitForTimeout(300);
check('only what fits goes in (20 holes), the rest stays in the bucket',await A.evaluate(()=>S.hopper>19.9&&S.hopper<=20&&S.bucket>2.9&&S.bucket<3.1),await A.evaluate(()=>JSON.stringify({b:S.bucket,h:S.hopper})));
for(const [t,ups,cap] of [[2,{hopper2:true},50],[3,{hopper3:true},120]]){
  await A.evaluate(([u,cap])=>{Object.assign(S.up,u);S.hopper=cap*0.8},[ups,cap]);await A.waitForTimeout(500);
  check('tier '+t+': holds '+cap+', its add-on shows',await A.evaluate(([t,cap])=>hopperCap()===cap&&HOP.ext[t]&&HOP.ext[t].visible&&HOP.sand[t].visible,[t,cap]));
  await A.evaluate(G=>{P.x=G.x+3.5;P.z=G.z+4.5;P.y=groundAt(P.x,P.z);P.yaw=Math.PI*0.2+0.15;P.pitch=0.12},G);await A.waitForTimeout(500);await A.screenshot({path:SP+'/t'+t+'.png'})}
await A.evaluate(()=>{tuneSet('gold.hopperSpeed',30);S.hopper=3});await A.waitForTimeout(1500);
check('it runs dry and tells you the total',await A.evaluate(()=>S.hopper===0&&HOP.gold===0&&__ev.some(e=>e[0]==='toast'&&/through your sand/.test(e[2]))));
await A.evaluate(()=>tuneSet('gold.hopperSpeed',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
