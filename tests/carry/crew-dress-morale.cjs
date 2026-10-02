// dressing the crew (81-wardrobe.js) and crew morale (88-morale.js). bash tests/carry/run.sh PORT OUT crew-dress-morale.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);S.seeds+=400});await A.waitForTimeout(500);
await A.evaluate(()=>{crewBuy('Zach',CREW_HIRE_ITEM)});await A.waitForFunction(()=>{const bt=bots.find(b=>b.d.n==='Zach');return bt&&bt.p.g.visible&&bt.state!=='away'},null,{timeout:40000});await A.waitForTimeout(1000);   // he walks in
// dressing
await A.evaluate(()=>{openWardrobe()});await A.waitForTimeout(300);
check('the Wardrobe can dress a hired crew member',await A.evaluate(()=>wardWhoList().includes('Zach')&&/Dressing/i.test(document.getElementById('wardrobe').innerText)));
await A.evaluate(()=>{WARD.who='Zach';renderWardrobe();setCur({hat:5,face:3,glasses:2,torso:8,arms:8,legs:8,shoes:6})});await A.waitForTimeout(3000);
const zp=await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return{ward:(bt.p.wardObjs||[]).length,still:crewBeingDressed(bt)}});
check('Zach wears it, and stands still for it',zp.ward===7&&zp.still,JSON.stringify(zp));
await A.screenshot({path:SP+'/zach-dressed.png'});
check('your friend sees Zach dressed',await B.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return CREW_WARD.Zach&&CREW_WARD.Zach.hat===5&&(bt.p.wardObjs||[]).length===7}));
await A.evaluate(()=>closeWardrobe());
// morale
const m0=await A.evaluate(()=>moraleOf(bots.find(b=>b.d.n==='Zach')));
await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');for(let i=0;i<3;i++){bt.state='dig';moraleHit(bt,'mn')}});
const m1=await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return{m:moraleOf(bt),mul:crewMoraleMul(bt)}});
check('blown up three times: morale down, he digs slower',m1.m<m0-60&&m1.mul<0.8,JSON.stringify({m0,...m1}));
check('the crew panel shows a morale bar',await A.evaluate(()=>!!document.querySelector('.crew-bar--mo')));
await A.evaluate(()=>{crewBuy('Zach',SIM.CREW_SHOP.find(i=>i.id==='soda'))});await A.waitForTimeout(1200);
const m2=await A.evaluate(()=>moraleOf(bots.find(b=>b.d.n==='Zach'))),m2b=await B.evaluate(()=>moraleOf(bots.find(b=>b.d.n==='Zach')));
check('a soda cheers him up (on everyone\'s screen); it\'s drunk, not kept',m2>m1.m+40&&m2b>40&&await A.evaluate(()=>!(CREW_UP.Zach||{}).soda),JSON.stringify({m2,m2b}));
check('he can have another soda',await A.evaluate(()=>crewItemState('Zach',SIM.CREW_SHOP.find(i=>i.id==='soda')).k==='buy'));
await A.evaluate(()=>{moraleNewDay()});check('a night\'s sleep: fresh again',await A.evaluate(()=>moraleOf(bots.find(b=>b.d.n==='Zach'))>=90));
await A.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
