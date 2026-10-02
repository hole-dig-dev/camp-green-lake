// the clear backsack (86-backsack.js), bought (pack, pack2, pack3): worn instead of the bucket, sand rises as it fills, friends see it. bash tests/carry/run.sh PORT OUT backsack.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{S.up.bucket=true;S.bucket=0;P.x=0;P.z=-15;P.y=groundAt(0,-15);runCommand('time 10:00')});await A.waitForTimeout(800);
check('a bucket only: no backsack, meter says Bucket',await A.evaluate(()=>!(me.bkObj&&me.bkObj.visible)&&me.bk===-1&&hq.bucketK.textContent==='Bucket'));
await A.evaluate(()=>{S.up.pack=true;if(FP)toggleView();P.yaw=0;P.fa=Math.PI;P.pitch=0.25});await A.waitForTimeout(800);
check('buy a backsack: you wear it, meter says Backsack',await A.evaluate(()=>me.bkObj&&me.bkObj.visible&&hq.bucketK.textContent==='Backsack'));
for(const [n,f] of [['empty',0],['half',2.5],['full',5]]){await A.evaluate(f=>{S.bucket=f;P.x+=0.001},f);await A.waitForTimeout(700);
  const r=await A.evaluate(()=>({bk:me.bk,sy:me.bkSand.scale.y,sv:me.bkSand.visible}));console.log(n,JSON.stringify(r));await A.screenshot({path:SP+'/tp_'+n+'.png'})}
check('full at 5 holes',await A.evaluate(()=>me.bk===1&&me.bkSand.scale.y===1));
await B.evaluate(()=>{P.x=2.6;P.z=-15.4;P.y=groundAt(P.x,P.z);P.yaw=Math.PI/2+0.35;P.fa=-Math.PI/2;P.pitch=0.1});await B.waitForTimeout(1200);await B.screenshot({path:SP+'/friend_full.png'});
check('friend sees it full',await B.evaluate(()=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return R.p.bk===1&&R.p.bkObj&&R.p.bkObj.visible}));
await A.evaluate(()=>{S.bucket=1.2;P.x+=0.001});await B.waitForTimeout(1200);
check('friend sees it drop to 1.2/5',await B.evaluate(()=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return Math.abs(R.p.bk-0.24)<0.01&&Math.abs(R.p.bkSand.scale.y-0.24)<0.01}));
await A.keyboard.down('e');await A.waitForTimeout(800);await A.screenshot({path:SP+'/tp_dig.png'});await B.screenshot({path:SP+'/friend_dig.png'});await A.keyboard.up('e');
await A.evaluate(()=>{toggleView()});await A.waitForTimeout(500);
check('first person: on the hidden layer',await A.evaluate(()=>FP&&me.fpOn&&me.bkObj.children[0].children.every(o=>o.layers.mask===1<<FP_HIDE_LAYER)));
await A.evaluate(()=>{S.up.bucket=false;S.up.pack=false;S.up.pan=true;P.x+=0.001});await A.waitForTimeout(600);
check('a pan only: no backsack',await A.evaluate(()=>!me.bkObj.visible&&hq.bucketK.textContent==='Pan'));
// three tiers, comically large: 5, 10, 20 holes; friends see the right one
await A.evaluate(()=>{if(FP)toggleView();S.up.pan=false;S.up.bucket=true;S.up.pack=true;P.yaw=0;P.fa=Math.PI;P.pitch=0.25});
for(const [t,ups,holes] of [[1,{},5],[2,{pack2:true},10],[3,{pack2:true,pack3:true},20]]){
  await A.evaluate(u=>{Object.assign(S.up,u);S.bucket=bucketMax()*0.6;P.x+=0.001},ups);await A.waitForTimeout(900);
  check('tier '+t+': holds '+holes+' holes, wears pack '+t,await A.evaluate(([t,h])=>bucketMax()===h&&me.bkObj.visible&&me.bkObj.userData.t===t,[t,holes]));
  await A.screenshot({path:SP+'/tier'+t+'_back.png'});await B.screenshot({path:SP+'/tier'+t+'_friend.png'});
  check('tier '+t+': the friend sees pack '+t,await B.evaluate(t=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return R.p.bt===t&&R.p.bkObj&&R.p.bkObj.userData.t===t},t))}
await A.evaluate(()=>{S.up={bucket:true,bucket2:true,bucket3:true,pack:true,pack2:true};P.x+=0.001});await A.waitForTimeout(600);
check('a huge bucket (15) and a big backsack (10): he carries the bucket',await A.evaluate(()=>bucketMax()===15&&!me.bkObj.visible&&hq.bucketK.textContent==='Bucket'));
await A.evaluate(()=>{S.seeds=1000;S.up={bucket:true};openShop&&openShop()});await A.waitForTimeout(500);
check('in the store: Backsack, then Big and Huge',await A.evaluate(()=>shopStatus(SHOP.find(i=>i.id==='pack')).kind==='available'&&shopStatus(SHOP.find(i=>i.id==='pack3')).kind==='locked'));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
