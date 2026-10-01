const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
const vis=`p=>Object.fromEntries((p.shovelMeshes||[]).map(n=>[n.name.replace('CGLCamper_R_Shovel',''),n.visible]))`;
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{S.up.shovel=true;P.x+=0.01});await A.waitForTimeout(1500);let v=await A.evaluate(s=>eval(s)(me),vis);
check('the camp shovel: camp handle, no long one',v.Shaft&&v.Cap&&!v.ShaftLong&&!v.CapLong,JSON.stringify(v));
await A.evaluate(()=>{S.up.long=true;P.x+=0.01});await A.waitForTimeout(1500);v=await A.evaluate(s=>eval(s)(me),vis);
check('buy the long-handled shovel: the long handle, collar and red cap show instead',!v.Shaft&&!v.Cap&&v.ShaftLong&&v.CollarLong&&v.CapLong,JSON.stringify(v));
check('your friend sees the long one on you',await B.evaluate(s=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');const v=eval(s)(R.p);return v.ShaftLong&&!v.Shaft},vis));
check('first person: the long handle',await A.evaluate(()=>{toggleView();updateViewmodel();const L=VM_SHOVEL.filter(m=>m.userData.longPart),C=VM_SHOVEL.filter(m=>m.userData.campPart);return L.length&&L.every(m=>m.visible)&&C.every(m=>!m.visible)}));
await A.evaluate(()=>{toggleView();S.up.spade=true;P.x=0;P.z=-15;P.y=groundAt(0,-15);P.yaw=-Math.PI/2+0.5;P.fa=Math.PI/2;P.pitch=0.2;runCommand('time 10:00')});
await A.waitForTimeout(800);await A.screenshot({path:SP+'/long_stand.png'});
await A.keyboard.down('e');await A.waitForTimeout(700);await A.screenshot({path:SP+'/long_dig1.png'});await A.waitForTimeout(350);await A.screenshot({path:SP+'/long_dig2.png'});await A.keyboard.up('e');
// the friend's view of you, digging, side-on
await B.evaluate(()=>{P.x=3.5;P.z=-15.5;P.y=groundAt(P.x,P.z);P.yaw=Math.PI/2;P.pitch=0.15});await A.keyboard.down('e');await B.waitForTimeout(900);await B.screenshot({path:SP+'/long_friend.png'});await A.keyboard.up('e');
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
