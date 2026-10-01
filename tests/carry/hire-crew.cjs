// Hiring the crew (JT 2026-10-01): nobody at the start; hire them in the store; they come with bare hands and a pan.
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
const zach=p=>p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach'),g=b.p.g.position;return{st:b.state,vis:b.p.g.visible,hired:crewHired(b),x:+g.x.toFixed(1),z:+g.z.toFixed(1),hole:+b.hole.d.toFixed(2),pan:+(b.bucket||0).toFixed(2),noShovel:!!b.p.noShovel,act:crewActivity(b)}});
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{runCommand('time 8:00');GOD=true});await A.waitForTimeout(1500);
check('no crew at the start: nobody on the lake',await A.evaluate(()=>bots.every(b=>b.state==='away'&&!b.p.g.visible)));
check('the crew panel says to hire them',await A.evaluate(()=>!$('#crewNone').hidden&&/Hire them/.test($('#crewNone').textContent)));
await A.evaluate(()=>{S.seeds=500;P.x=16;P.z=40.6;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(300);await A.keyboard.press('f');await A.waitForTimeout(400);await A.click('#shopModeCrew');await A.waitForTimeout(300);
await A.click('.crew-buy[data-key="Zach|hire"]');await A.waitForTimeout(150);await A.click('.crew-buy[data-key="Zach|hire"]');await A.waitForTimeout(800);
check('hire Zach for 40',await A.evaluate(()=>S.seeds===460&&crewHired(bots.find(b=>b.d.n==='Zach'))));
check('the next one costs 60',await A.evaluate(()=>$('.crew-buy[data-key="Stan|hire"]').textContent==='Hire · 60'));
await A.keyboard.press('Escape');await A.waitForTimeout(1500);
let z=await zach(A);check('he walks in through the gate, bare-handed',z.vis&&z.noShovel&&['gatebackout','walk','dig','return'].includes(z.st),JSON.stringify(z));
check('your friend has him on the crew too',await B.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach');return crewHired(b)&&b.p.g.visible}));
check('the panel shows him',await A.evaluate(()=>{const r=[...document.querySelectorAll('.crew-row')].find(r=>r.querySelector('b').textContent==='Zach');return r&&!r.hidden&&$('#crewNone').hidden}));
// he digs shallow holes by hand
let deepest=0;for(let i=0;i<60;i++){await A.waitForTimeout(1000);z=await zach(A);if(z.st==='dig')deepest=Math.max(deepest,z.hole);if(z.st==='rest'&&z.pan>0)break}
check('he digs by hand, 1.5 ft holes, a third of a pan each',deepest<=0.451&&z.pan>0.25&&z.pan<0.35,JSON.stringify(z));
// a full pan: he takes it in to wash, and the gold goes in the bank
await A.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach');b.bucket=1;b.state='rest';b.t=0;b.restT=3;b.stam=100});const bank0=await A.evaluate(()=>RUN.bank);
const seen=new Set();for(let i=0;i<80;i++){await A.waitForTimeout(500);z=await zach(A);seen.add(z.act);if(z.pan===0&&(await A.evaluate(()=>RUN.bank))>bank0)break}
check('a full pan: he washes it at the water drums and the gold goes in the crew bank',await A.evaluate(b0=>RUN.bank>b0,bank0),[...seen].join(' > ')+` | bank ${bank0} -> ${await A.evaluate(()=>RUN.bank)}`);
// a shovel for him
await A.evaluate(()=>{crewBuy('Zach',SIM.CREW_SHOP.find(i=>i.id==='shovel'))});await A.waitForTimeout(800);
check('buy him a camp shovel: it\'s in his hands, and his holes go to 5 ft',await A.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach');return!b.p.noShovel&&Math.abs(crewDepth(b)-FIVE_FT)<1e-6&&b.p.shovelMeshes.some(n=>n.visible)}));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)&&!errs.length?0:1)})();
