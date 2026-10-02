// the hoverboard (88-hover.js): an inch over the undug ground; holes and sinkholes pass under; no digging; knocked off
// by a blast; friends see it. bash tests/carry/run.sh PORT OUT hover.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);S.up={pan:true,shovel:true,bucket:true};S.seeds+=600;P.x=60;P.z=-80;P.y=groundAt(60,-80);runCommand('time 10:00')});await A.waitForTimeout(500);
await A.evaluate(()=>buyShopItem('hover'));await A.keyboard.press('z');await A.waitForTimeout(800);
check('Z: on the hoverboard, an inch up',await A.evaluate(()=>hoverOn()&&Math.abs(P.y-(baseH(P.x,P.z)+HOVER_H))<0.03),await A.evaluate(()=>P.y-baseH(P.x,P.z)));
const d0=await A.evaluate(()=>holeDepthHere());await A.keyboard.down('e');await A.waitForTimeout(1500);await A.keyboard.up('e');
check('no digging on it',await A.evaluate(d0=>holeDepthHere()<=d0+0.001,d0));
// a deep hole: glide over it
await A.evaluate(()=>{const x=P.x+4,z=P.z;for(let i=0;i<6;i++)applyDig(x,z,2.5,true);P.x=x;P.z=z});await A.waitForTimeout(1200);
check('over a deep hole: still an inch over the ground, not trapped',await A.evaluate(()=>baseH(P.x,P.z)-groundAt(P.x,P.z)>2&&P.y>baseH(P.x,P.z)-0.02&&!isTrapped()),await A.evaluate(()=>JSON.stringify({d:holeDepthHere(),y:P.y-baseH(P.x,P.z)})));
check('friends see the board',await B.evaluate(()=>[...remotes.values()].find(r=>r.name==='Alpha').hv===true));
// a sinkhole opens under you
await A.evaluate(()=>{P.x+=20;spawnSinkhole(P.x,P.z,7,twNow())});await A.waitForTimeout(9000);
check('a sinkhole opens under you: you float over it',await A.evaluate(()=>!inSinkhole()&&P.y>baseH(P.x,P.z)-0.05&&baseH(P.x,P.z)-groundAt(P.x,P.z)>2),await A.evaluate(()=>JSON.stringify({d:holeDepthHere(),y:P.y-baseH(P.x,P.z),sink:!!inSinkhole()})));
// step off over it: down you go
await A.keyboard.press('z');await A.waitForTimeout(1500);
check('step off over it: down you go',await A.evaluate(()=>!hoverOn()&&P.y<baseH(P.x,P.z)-1.5));
check('can\'t hop on from the bottom of a hole',await A.evaluate(()=>{toggleHover();return !hoverOn()}));
// a blast knocks you off
await A.evaluate(()=>{P.x+=30;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(500);await A.keyboard.press('z');await A.waitForTimeout(400);
await A.evaluate(()=>blastLaunch(P.x+0.5,P.z,4,1,'mn',null));await A.waitForTimeout(300);
check('a blast knocks you off it',await A.evaluate(()=>!hoverOn()));
// hover shoes: float the same, digging switches them off quietly, N toggles
await A.waitForFunction(()=>twSt===0,null,{timeout:20000});await A.evaluate(()=>{S.seeds+=1000;buyShopItem('hoverShoes');P.x+=25;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(1200);
check('hover shoes: floating an inch up, walking (not gliding)',await A.evaluate(()=>shoesOn()&&!hoverOn()&&Math.abs(P.y-(baseH(P.x,P.z)+HOVER_H))<0.03));
await A.keyboard.down('e');await A.waitForTimeout(2500);await A.keyboard.up('e');await A.waitForTimeout(300);
check('start digging: they switch off quietly and you dig in',await A.evaluate(()=>!shoesOn()&&SHOE.sup&&baseH(P.x,P.z)-groundAt(P.x,P.z)>0.1&&P.y<baseH(P.x,P.z)));
await A.evaluate(()=>{P.x+=4;P.y=groundAt(P.x,P.z)});await A.keyboard.down('w');await A.waitForTimeout(1600);await A.keyboard.up('w');
check('out on level ground and walking: back on',await A.evaluate(()=>shoesOn()));
await A.keyboard.press('n');await A.waitForTimeout(200);check('N: off',await A.evaluate(()=>!shoesOn()&&!floating()));
await A.keyboard.press('n');await A.waitForTimeout(200);check('N: on again',await A.evaluate(()=>shoesOn()));
check('friends know you wear them',await B.evaluate(()=>[...remotes.values()].find(r=>r.name==='Alpha').hs===true));
await A.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
