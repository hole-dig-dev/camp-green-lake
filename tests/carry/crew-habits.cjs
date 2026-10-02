// crew habits (88-habits.js): lunch at the mess tables at noon, saying hello, chatter that fits what's going on.
// bash tests/carry/run.sh PORT OUT crew-habits.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);runCommand('time 10:00');S.seeds+=800;GOD=true;P.x=60;P.z=-90;P.y=groundAt(60,-90);for(const n of['Zach','Pete','Stan'])crewBuy(n,CREW_HIRE_ITEM)});
await A.waitForFunction(()=>['Zach','Pete','Stan'].every(n=>{const b=bots.find(b=>b.d.n===n);return b.p.g.visible&&b.state==='dig'}),null,{timeout:90000});
// chatter in context
check('chatter fits what\'s going on (a rich vein out there)',await A.evaluate(()=>{VEIN.on=true;let hit=0;for(let i=0;i<40;i++)if(/glitter|rich today/.test(crewChatter(bots.find(b=>b.d.n==='Zach'))))hit++;VEIN.on=false;return hit>5}));
check('no more Mr. Sir in the crew\'s lines',await A.evaluate(()=>bots.every(b=>b.d.lines.every(l=>!/Mr\. Sir/.test(l)))));
// hello
await A.evaluate(()=>{const b=bots.find(b=>b.d.n==='Pete');b.state='rest';b.t=30;b.restT=5;b.greetT=0;const g=b.p.g.position;P.x=g.x+2;P.z=g.z;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(600);
check('walk up to Pete: he says hi and waves',await A.evaluate(()=>{const b=bots.find(b=>b.d.n==='Pete');return /Alpha|hey|You again/i.test(b.L.el.innerText)&&b.greetT>60}),await A.evaluate(()=>bots.find(b=>b.d.n==='Pete').L.el.innerText));
await A.evaluate(()=>{P.x=60;P.z=-90;P.y=groundAt(60,-90)});
// lunch
await A.evaluate(()=>jumpTo(tAtHour(12)+500));await A.waitForTimeout(1500);
check('noon: they head in for lunch',await A.evaluate(()=>['Zach','Pete','Stan'].every(n=>{const b=bots.find(b=>b.d.n===n);return b.errand==='lunch'})),await A.evaluate(()=>bots.filter(b=>crewHired(b)).map(b=>b.d.n+':'+b.state+'/'+b.errand).join(' ')));
await A.waitForFunction(()=>['Zach','Pete','Stan'].every(n=>bots.find(b=>b.d.n===n).state==='lunch'&&bots.find(b=>b.d.n===n).t!=null),null,{timeout:90000}).catch(()=>{});
const at=await A.evaluate(()=>bots.filter(b=>crewHired(b)).map(b=>({n:b.d.n,st:b.state,seated:b.t!=null,x:+b.p.g.position.x.toFixed(1),z:+b.p.g.position.z.toFixed(1)})));
check('all three sit at the mess tables',at.every(a=>a.st==='lunch'&&a.seated),JSON.stringify(at));
await A.evaluate(()=>{if(FP)toggleView();const t=MESS_TABLES[0];P.x=t.x+3;P.z=t.z-5;P.y=groundAt(P.x,P.z);const o=updateWardrobeCam;window.updateWardrobeCam=function(){o();camera.position.set(t.x+5,t.y+3.2,t.z-6);camera.lookAt(t.x,t.y+0.6,t.z)}});
await A.waitForTimeout(800);await A.screenshot({path:SP+'/lunch.png'});
await A.waitForTimeout(25000);
check('after lunch they head back out to work',await A.evaluate(()=>['Zach','Pete','Stan'].every(n=>{const s=bots.find(b=>b.d.n===n).state;return s!=='lunch'})),await A.evaluate(()=>bots.filter(b=>crewHired(b)).map(b=>b.d.n+':'+b.state).join(' ')));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
