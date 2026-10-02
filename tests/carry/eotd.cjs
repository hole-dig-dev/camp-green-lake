// Employee of the Day (88-eotd.js): live standings from today's tallies, portraits on the board, winners at curfew.
// bash tests/carry/run.sh PORT OUT eotd.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);for(const p of[A,B])p.on('pageerror',e=>console.log('STACK',String(e.stack).split('\n').slice(0,7).join(' | ')));
await A.evaluate(()=>{tuneSet('haz.all',0);S.seeds+=300;setMyWard({hat:4,face:2,glasses:6,torso:3,arms:3,legs:3,shoes:2})});await B.evaluate(()=>setMyWard({hat:11,face:9,glasses:-1,torso:12,arms:12,legs:12,shoes:8}));
await A.evaluate(()=>crewBuy('Zach',CREW_HIRE_ITEM));await A.waitForTimeout(1500);
await A.evaluate(()=>foundGold(30));await B.evaluate(()=>{foundGold(12);buyShopItem('dynamite');buyShopItem('dynamite');buyShopItem('scarecrow')});
await A.evaluate(()=>{P.x=40;P.z=-40;P.y=groundAt(40,-40);blastLaunch(P.x+0.5,P.z,4,1,'mn',null)});await A.waitForFunction(()=>twSt===0,null,{timeout:20000});await A.waitForTimeout(500);await A.evaluate(()=>{blastLaunch(P.x+0.5,P.z,4,1,'mn',null)});await A.waitForTimeout(5000);
const st=await B.evaluate(()=>EOTD.standings);
check('most gold found: Alpha (30)',st&&st.found&&st.found.n==='Alpha'&&st.found.v===30,JSON.stringify(st));
check('most thrown around: Alpha (2)',st&&st.thrown&&st.thrown.n==='Alpha'&&st.thrown.v>=2);
check('least valuable person: Zach (found nothing yet)',st&&st.lvp&&st.lvp.n==='Zach');
check('big spender: Bravo (100)',st&&st.spent&&st.spent.n==='Bravo'&&st.spent.v===100);
// look at the board
await B.evaluate(()=>{if(FP)toggleView();P.x=EOTD_AT.x+6;P.z=EOTD_AT.z+1;P.y=groundAt(P.x,P.z);const o=updateWardrobeCam;window.updateWardrobeCam=function(){o();camera.position.set(EOTD_AT.x+4.2,baseH(EOTD_AT.x,EOTD_AT.z)+1.9,EOTD_AT.z+0.2);camera.lookAt(EOTD_AT.x,baseH(EOTD_AT.x,EOTD_AT.z)+1.5,EOTD_AT.z)}});
await B.waitForTimeout(5000);await B.evaluate(()=>document.querySelectorAll('#toasts > *').forEach(e=>e.remove()));await B.screenshot({path:SP+'/board.png'});
check('the board is up, four portraits and plaques',await B.evaluate(()=>EOTD.rts.length===4&&EOTD.canvases.length===4&&!!EOTD.shown));
// curfew: winners read out, a fresh day
await A.evaluate(()=>jumpTo(SIM.DAYMS-2500));await A.waitForTimeout(8000);
check('at curfew: "Employee of the Day!" for everyone',await B.evaluate(()=>__ev.some(e=>e[0]==='toast'&&/Employee of the Day/.test(e[2]))));
check('a fresh day: nobody yet',await B.evaluate(()=>{const s=EOTD.standings||{};return !s.found&&!s.thrown&&!s.spent}),JSON.stringify(await B.evaluate(()=>EOTD.standings)));
await A.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
