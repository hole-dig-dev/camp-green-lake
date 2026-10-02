// the D Tent crew wear the clear backsack tiers too (86-backsack.js crewPack). bash tests/carry/run.sh PORT OUT crew-packs.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);runCommand('crew hire Zach');runCommand('crew hire Stan')});await A.waitForTimeout(800);
await A.evaluate(()=>{runCommand('crew kit Zach shovel bucket3');runCommand('crew kit Stan shovel bucket')});await A.waitForTimeout(800);
const zach=p=>p.evaluate(()=>{const z=bots.find(b=>b.d.n==='Zach');return{max:crewBucketMax(z),bk:z.p.bk,bt:z.p.bt,held:!!(z.p.held&&z.p.held.k==='bucket'&&z.p.held.t>0)}});
check('flag off: a 15-hole bucket, no pack',await zach(A).then(z=>z.max===15&&!(z.bk>=0)),JSON.stringify(await zach(A)));
await A.evaluate(()=>tuneSet('gear.backsack',1));await A.waitForTimeout(1500);
check('flag on: Zach\'s huge bucket is a 20-hole pack, Stan\'s bucket a 5-hole one',await A.evaluate(()=>crewBucketMax(bots.find(b=>b.d.n==='Zach'))===20&&crewBucketMax(bots.find(b=>b.d.n==='Stan'))===5));
await A.waitForFunction(()=>{const z=bots.find(b=>b.d.n==='Zach');return z.p.g.visible&&z.state!=='away'&&z.state!=='gatein'},null,{timeout:40000}).catch(()=>{});
await A.evaluate(()=>{const z=bots.find(b=>b.d.n==='Zach');z.bucket=12});await A.waitForTimeout(800);
check('worn on his back, tier 3, filling (12 of 20), no bucket in his hand',await A.evaluate(()=>{const z=bots.find(b=>b.d.n==='Zach');return z.p.bt===3&&Math.abs(z.p.bk-0.6)<0.01&&z.p.bkObj&&z.p.bkObj.visible&&!(z.p.held&&z.p.held.k==='bucket'&&z.p.held.t>0)}),JSON.stringify(await zach(A)));
check('the crew store calls it a pack',await A.evaluate(()=>crewItemText(SIM.CREW_SHOP.find(i=>i.id==='bucket3')).name==='Huge backsack'));
await A.evaluate(()=>{const z=bots.find(b=>b.d.n==='Zach');z.bucket=20;z.state='dig';z.t=0.01;z.errand=null});
await A.waitForFunction(()=>bots.find(b=>b.d.n==='Zach').errand==='sift',null,{timeout:30000}).catch(()=>{});
check('a full pack: off to the sifter',await A.evaluate(()=>bots.find(b=>b.d.n==='Zach').errand==='sift'));
const V=await (await b.newContext({viewport:{width:960,height:600}})).newPage();V.on('pageerror',e=>errs.push('spec: '+e.message));   /* a spectator's camera for the picture */
await V.goto(`http://127.0.0.1:${PORT}/?r=1&spectate`);await V.waitForFunction(()=>!document.querySelector('#startBtn').disabled,null,{timeout:30000});
await V.evaluate(()=>document.querySelector('#startBtn').click());await V.waitForTimeout(3000);
await V.waitForFunction(()=>{const z=bots.find(b=>b.d.n==='Zach');return z&&z.p.g.visible&&z.p.bkObj},null,{timeout:40000}).catch(()=>{});
await V.evaluate(()=>{for(const b of bots)if(crewHired(b))b.bucket=crewBucketMax(b)*0.7;SPEC.follow('Zach',{r:3.2,h:1.6,spin:0.25})});await V.waitForTimeout(2500);
await V.screenshot({path:SP+'/crew-pack.png'});await V.waitForTimeout(2200);await V.screenshot({path:SP+'/crew-pack2.png'});
await A.evaluate(()=>tuneSet('gear.backsack',0));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
