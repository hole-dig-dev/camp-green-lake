// the one crew wallet, spent safely (84-spend.js): two campers buying at once can't overspend it; a purchase that
// leaves the crew short of tonight's quota says so; "Found today" at curfew. bash tests/carry/run.sh PORT OUT wallet-spend.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0)});
for(const p of [A,B])await p.evaluate(()=>{S.up.pan=true;S.up.bucket=true});
await A.evaluate(()=>{S.seeds+=100});await A.waitForTimeout(1200);
check('one wallet: both see 100',await A.evaluate(()=>S.seeds)===100&&await B.evaluate(()=>S.seeds)===100);
// both buy the 90-gold hopper at the same moment
await Promise.all([A.evaluate(()=>buyShopItem('hopper')),B.evaluate(()=>buyShopItem('hopper'))]);await A.waitForTimeout(1500);
const ha=await A.evaluate(()=>!!S.up.hopper),hb=await B.evaluate(()=>!!S.up.hopper),bank=await A.evaluate(()=>S.seeds),bankB=await B.evaluate(()=>S.seeds);
check('two buying at once from a wallet that covers one: exactly one gets it, the wallet isn\'t overspent',(ha!==hb)&&bank===10&&bankB===10,JSON.stringify({ha,hb,bank,bankB}));
check('the one turned down is told',await (ha?B:A).evaluate(()=>__ev.some(e=>e[0]==='toast'&&/spent that gold first/.test(e[2]))));
// the quota warning
await A.evaluate(()=>{S.seeds+=30});await A.waitForTimeout(1000);
const w=await A.evaluate(()=>{openShop();openShopConfirm('shovel');const t=document.getElementById('shopConfirm').innerText;const safe=document.getElementById('shopSafe').textContent;closeShop&&closeShop();return{t,safe,q:RUN.quota,bank:RUN.bank}});
check('buying below tonight\'s quota warns in the confirm panel; the store shows safe to spend',/short of tonight's quota/.test(w.t)&&/safe to spend/.test(w.safe),JSON.stringify(w));
// found today, read out at curfew
await A.evaluate(()=>foundGold(30));await B.evaluate(()=>foundGold(12));await A.waitForTimeout(800);
await A.evaluate(()=>jumpTo(SIM.DAYMS-2500));await A.waitForTimeout(6000);
const fa=await A.evaluate(()=>__ev.filter(e=>e[0]==='toast'&&/Found today/.test(e[2])).map(e=>e[2])),fb=await B.evaluate(()=>__ev.filter(e=>e[0]==='toast'&&/Found today/.test(e[2])).map(e=>e[2]));
check('curfew: "Found today" for everyone, biggest first',fa.length&&/Alpha 30 · Bravo 12/.test(fa[0])&&fb.length,JSON.stringify(fa));
await A.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
