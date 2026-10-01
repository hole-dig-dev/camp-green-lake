const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const p=await player(b,PORT,'Tester',errs);
await p.evaluate(()=>{runCommand('time 9:00');P.x=0;P.z=12;P.y=groundAt(P.x,P.z)});await p.waitForTimeout(1500);
const rows=await p.evaluate(()=>[...document.querySelectorAll('.crew-row')].map(r=>r.querySelector('b').textContent+': '+r.querySelector('.crew-row__doing').textContent+' / bucket '+r.querySelector('.crew-bk').textContent));
check('the crew panel shows all six, with what they are doing',!(await p.evaluate(()=>$('#crewPanel').hidden))&&rows.length===6,'\n    '+rows.join('\n    '));
check('it sits under the map',await p.evaluate(()=>$('#crewPanel').getBoundingClientRect().top>=$('#mapbox').getBoundingClientRect().bottom));
// digging dries him out and tires him
const w0=await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Stan');b.state='dig';b.stam=100;b.water=100;return b.water});await p.waitForTimeout(5000);
const sq=await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Stan');return{w:b.water,s:b.stam}});check('digging costs him water and stamina',sq.w<w0&&sq.s<100,JSON.stringify(sq));
// low on water: at his next rest he goes in for water, fills up, heads back out
await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Larry');b.water=10;b.stam=100;b.state='rest';b.t=0;b.restT=3});
const seen=new Set();let filled=false,shot=false;
for(let i=0;i<70;i++){await p.waitForTimeout(500);const s=await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Larry');return{st:b.state,w:Math.round(b.water),act:crewActivity(b)}});seen.add(s.act);
  if(s.st==='drink'&&!shot){shot=true;await p.screenshot({path:SP+'/crewpanel.png'})}if(s.st==='gatebackin'&&s.w>90){filled=true;break}}
check('low on water, Larry walks in to the drums, fills up and heads back out',filled,[...seen].join(' > '));
await p.keyboard.press('k');await p.waitForTimeout(400);check('K hides the panel',await p.evaluate(()=>$('#crewPanel').hidden));
await p.keyboard.press('k');await p.waitForTimeout(400);check('K shows it again',await p.evaluate(()=>!$('#crewPanel').hidden));
await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach');b.state='dig';crewKO(b,'liz')});await p.waitForTimeout(400);
check('a knockout shows on the panel, in red, with health at 0',await p.evaluate(()=>{const r=[...document.querySelectorAll('.crew-row')].find(r=>r.querySelector('b').textContent==='Zach');return r.classList.contains('is-bad')&&/Knocked out .lizard./.test(r.textContent)&&r.querySelector('.crew-bar--hp i').style.width==='0%'}));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)&&!errs.length?0:1)})();
