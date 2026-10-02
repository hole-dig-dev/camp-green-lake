// sodas you hand to the crew, and the soda vending machine (88-morale.js). bash tests/carry/run.sh PORT OUT soda.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);S.seeds+=600});await A.waitForTimeout(500);
await A.evaluate(()=>crewBuy('Zach',CREW_HIRE_ITEM));await A.waitForFunction(()=>{const bt=bots.find(b=>b.d.n==='Zach');return bt&&bt.p.g.visible&&bt.state!=='away'},null,{timeout:40000});
await A.evaluate(()=>{buyShopItem('soda');buyShopItem('soda')});await A.waitForTimeout(400);
check('sodas on the Me side, a stack',await A.evaluate(()=>S.soda===2));
await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');bt.morale=20;const g=bt.p.g.position;P.x=g.x+1.5;P.z=g.z;P.y=groundAt(P.x,P.z);openDialog('bot',bt)});await A.waitForTimeout(400);
check('talk to him: "Here, have a soda"',await A.evaluate(()=>/have a soda/i.test(document.getElementById('dlg')?.innerText||document.body.innerText)));
await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');giveSoda(bt);closeDialog()});await A.waitForTimeout(1000);
check('handed over: he cheers up, on everyone\'s screen; one soda left',await A.evaluate(()=>moraleOf(bots.find(b=>b.d.n==='Zach'))>60&&S.soda===1)&&await B.evaluate(()=>moraleOf(bots.find(b=>b.d.n==='Zach'))>80));
// the vending machine
await A.evaluate(()=>buyShopItem('sodaMachine'));await A.waitForTimeout(800);
check('the soda machine: a camp upgrade everyone has',await A.evaluate(()=>campHas('sodaMachine'))&&await B.evaluate(()=>campHas('sodaMachine')));
await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');bt.morale=20;bt.state='dig';bt.errand=null});await A.waitForTimeout(800);
check('fed up, he takes himself off for a soda break',await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return bt.errand==='water'&&bt.soda&&/soda/.test(crewActivity(bt))}),await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return bt.state+' '+bt.errand+' '+crewActivity(bt)}));
await A.waitForFunction(()=>moraleOf(bots.find(b=>b.d.n==='Zach'))>=99,null,{timeout:90000}).catch(()=>{});
check('...and comes back at full morale',await A.evaluate(()=>moraleOf(bots.find(b=>b.d.n==='Zach'))>=99),await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return bt.state+' '+Math.round(moraleOf(bt))}));
await A.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
