// the hazards switch (88-hazards.js): ALL off clears and stops everything; single ones back on; spawn one now.
// bash tests/carry/run.sh PORT OUT hazards.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
check('by default everything is on',await A.evaluate(()=>HAZ_KINDS.every(k=>hazOn(k))));
check('the F2 Hazards tab has the master switch, an on-anyway and a spawn-now for each',await A.evaluate(()=>TUNE_BY['haz.all']&&HAZ_KINDS.every(k=>TUNE_BY['haz.on.'+k])&&TUNE_DEFS.some(d=>d.key==='haz.now.twister')&&TUNE_DEFS.some(d=>d.key==='haz.now.javelinas')));
// some things out there: mines (server), a javelina herd (server), lizards near you
await A.evaluate(()=>{tuneSet('haz.mineEvery',0.5);P.x=40;P.z=-60;P.y=groundAt(40,-60)});
await A.evaluate(()=>runCommand('javelinas'));await A.waitForTimeout(23000);
const before=await A.evaluate(()=>({mines:MINES.size,jav:JAVV.length,liz:lizards.some(L=>L.m.g.visible)}));
check('before: mines and a herd are out',before.mines>0&&before.jav>0,JSON.stringify(before));
await A.evaluate(()=>tuneSet('haz.all',0));await A.waitForTimeout(2500);
const after=await B.evaluate(()=>({mines:MINES.size,jav:JAVV.length,on:HAZ_KINDS.filter(k=>hazOn(k))}));
check('ALL off: mines and herds gone for everyone, nothing on',after.mines===0&&after.jav===0&&after.on.length===0,JSON.stringify(after));
check('ALL off: no lizards',await A.evaluate(()=>lizards.every(L=>!L.m.g.visible)));
await A.evaluate(()=>{const L=lizards[0];P.x=L.x+3;P.z=L.z;P.y=groundAt(P.x,P.z);tuneSet('haz.on.lizards',1)});await A.waitForTimeout(800);
check('lizards on anyway: they\'re back, the rest stay off',await A.evaluate(()=>lizards.some(L=>L.m.g.visible)&&!hazOn('twister')&&hazOn('lizards')));
await A.evaluate(()=>{P.x=0;P.z=-80;P.y=groundAt(0,-80);tuneSet('haz.on.lizards',0)});await A.waitForTimeout(300);
await A.evaluate(()=>TUNE_DEFS.find(d=>d.key==='haz.now.twister').run());await A.waitForTimeout(600);
check('spawn one now works with everything off',await A.evaluate(()=>twSpawned.length===1));
await A.waitForTimeout(25000);
check('no mines come back while off',await A.evaluate(()=>MINES.size===0));
await A.evaluate(()=>{tuneSet('haz.all',1);tuneSet('haz.mineEvery',25)});await A.waitForTimeout(500);
check('back on',await A.evaluate(()=>HAZ_KINDS.every(k=>hazOn(k))));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
