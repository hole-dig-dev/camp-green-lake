// "ufo <name>" wherever he is (88-ufo.js ufoLureStep): out digging, in camp at the sifter, held up by a camper and
// thrown, asleep in D Tent at night, "ufo back" before he's even up there. He always walks out onto the lake bed first;
// the saucer never comes down over the camp. bash tests/carry/run.sh PORT OUT ufo-scenarios.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
const who=n=>A.evaluate(n=>{const b=bots.find(b=>b.d.n===n),g=b.p.g.position;return{st:b.state,vis:b.p.g.visible,lure:!!b.ufoLure,ufo:!!b.ufo,ab:isAbducted(b),alien:isAlien(b),x:+g.x.toFixed(1),y:+g.y.toFixed(1),z:+g.z.toFixed(1),act:crewActivity(b)}},n);
const ev=(k,n)=>A.evaluate(([k,n])=>__ev.filter(e=>e[0]===k&&e[1]&&e[1].n===n).map(e=>e[1]),[k,n]);
const waitEv=(k,n,ms)=>A.waitForFunction(([k,n])=>__ev.some(e=>e[0]===k&&e[1]&&e[1].n===n),[k,n],{timeout:ms}).catch(()=>{});
const cmd=l=>A.evaluate(l=>runCommand(l),l);
await A.evaluate(()=>{window.__ev=[];const o=logEv;window.logEv=function(t,d){__ev.push([t,d]);return o(t,d)};tuneSet('haz.all',0);GOD=true;runCommand('time 09:00');runCommand('crew hire all');P.x=0;P.z=-10;P.y=groundAt(0,-10)});
// 1. someone out digging on the lake: taken right where he is
await A.waitForFunction(()=>bots.some(b=>crewHired(b)&&b.state==='dig'&&!ufoInCamp(b.p.g.position.x,b.p.g.position.z)&&!['Stan','Randy','Zach','Larry'].includes(b.d.n)),null,{timeout:90000}).catch(()=>{});
const dg=await A.evaluate(()=>{const b=bots.find(b=>crewHired(b)&&b.state==='dig'&&!['Stan','Randy','Zach','Larry'].includes(b.d.n));return b&&b.d.n});
const d0=await who(dg);await cmd('ufo '+dg);
// 2. Stan in camp, at the sifter
await A.evaluate(()=>{const s=bots.find(b=>b.d.n==='Stan'),F=SIM.GOLD.SIFTER;s.p.g.position.set(F.x-2.5,groundAt(F.x-2.5,F.z),F.z);s.state='drink';s.t=30});
check('setup: Stan inside the camp fence',await A.evaluate(()=>{const g=bots.find(b=>b.d.n==='Stan').p.g.position;return inCamp(g.x,g.z)}));
await cmd('ufo stan');
// 3. Randy held up in the air by a camper: it waits until he's down
await A.evaluate(()=>{const r=bots.find(b=>b.d.n==='Randy'),g=r.p.g.position;crewGrabbed(r,true);r.handAt=[g.x,groundAt(g.x,g.z)+2.6,g.z]});
await cmd('ufo randy');
await waitEv('ufoTake',dg,15000);const td=(await ev('ufoTake',dg))[0]||{};
check(dg+', out digging: taken where he stands (no walk)',td.x!=null&&Math.hypot(td.x-d0.x,td.z-d0.z)<1.5&&!td.inCamp,JSON.stringify({td,d0}));
await A.waitForTimeout(5000);const r1=await who('Randy');
check('Randy, held up by a camper: the saucer waits',r1.lure&&!r1.ufo&&r1.st==='held'&&!(await ev('ufoTake','Randy')).length,JSON.stringify(r1));
await A.evaluate(()=>crewGrabbed(bots.find(b=>b.d.n==='Randy'),false,[0.3,0.8,0.5]));   /* thrown */
await A.waitForTimeout(1500);const s1=await who('Stan');
check('Stan: walking out of camp, not beamed in it',s1.lure&&s1.vis&&/lake/.test(s1.act)&&!(await ev('ufoTake','Stan')).length,JSON.stringify(s1));
for(const n of['Stan','Randy']){await waitEv('ufoTake',n,90000);const t=(await ev('ufoTake',n))[0];check(n+': beamed up out on the lake bed, outside the camp',t&&!t.inCamp,JSON.stringify(t))}
await A.waitForTimeout(12000);
const gone=await A.evaluate(n=>[n,'Stan','Randy'].map(n=>{const b=bots.find(b=>b.d.n===n);return n+':'+(isAbducted(b)&&!b.p.g.visible&&!b.ufoLure&&!b.ufo)}),dg);
check('all three up in the saucer, gone from the lake',gone.every(s=>s.endsWith('true')),gone.join(' '));
await cmd('ufo back');
await A.waitForFunction(n=>[n,'Stan','Randy'].every(n=>{const b=bots.find(b=>b.d.n===n);return isAlien(b)&&b.p.g.visible&&!b.ufo}),dg,{timeout:40000}).catch(()=>{});
const dr=await A.evaluate(()=>__ev.filter(e=>e[0]==='ufoDrop').map(e=>e[1]));
check('"ufo back": all three dropped off as aliens, out on the lake bed',dr.length===3&&dr.every(d=>!d.inCamp)&&await A.evaluate(n=>[n,'Stan','Randy'].every(n=>{const b=bots.find(b=>b.d.n===n);return isAlien(b)&&b.p.g.visible}),dg),JSON.stringify(dr));
// 4. night: Zach asleep in D Tent
await A.evaluate(()=>{const z=bots.find(b=>b.d.n==='Zach');runCommand('time 23:30');z.state='inside';z.p.g.position.set(z.p.g.position.x,TENT_FLOOR_Y,z.p.g.position.z);z.p.g.visible=false});
await A.waitForTimeout(1500);const z0=await who('Zach');
check('setup: Zach asleep in D Tent',/Asleep|D Tent/.test(z0.act)&&!z0.vis,JSON.stringify(z0));
await cmd('ufo zach');await A.waitForTimeout(2500);
const z1=await who('Zach');check('he gets up and comes out of D Tent, walking out to the lake bed',z1.vis&&z1.lure&&z1.y>-1&&/lake/.test(z1.act),JSON.stringify(z1));
await waitEv('ufoTake','Zach',90000);const tz=(await ev('ufoTake','Zach'))[0];check('Zach: beamed up outside the camp, at night',tz&&!tz.inCamp,JSON.stringify(tz));
// 5. Larry: "ufo back" before he's even up there
await A.evaluate(()=>{const l=bots.find(b=>b.d.n==='Larry'),F=SIM.GOLD.SIFTER;l.p.g.position.set(F.x+3,groundAt(F.x+3,F.z),F.z+4);l.state='drink';l.t=30});
await cmd('ufo larry');await A.waitForTimeout(1200);await cmd('ufo back');
await waitEv('ufoTake','Larry',90000);const tl=(await ev('ufoTake','Larry'))[0];check('Larry: beamed up outside the camp, though "ufo back" was already sent',tl&&!tl.inCamp,JSON.stringify(tl));
await waitEv('ufoDrop','Larry',40000);await A.waitForFunction(()=>{const l=bots.find(b=>b.d.n==='Larry');return isAlien(l)&&l.p.g.visible&&!l.ufo},null,{timeout:40000}).catch(()=>{});
const l2=await who('Larry'),dl=(await ev('ufoDrop','Larry'))[0];check('...and dropped straight back off as an alien, on the lake bed',l2.alien&&l2.vis&&!l2.ab&&dl&&!dl.inCamp,JSON.stringify({l2,dl}));
await A.waitForTimeout(25000);
const night=await A.evaluate(()=>bots.filter(b=>isAlien(b)).map(b=>b.d.n+':'+b.state));
check('it\'s night: the aliens head for D Tent like the rest',night.length>=5&&night.every(s=>/gotent|indoor|inside|gatein|gatebackin|return/.test(s)),night.join(' '));
check('Zach (still up there) stays gone',await A.evaluate(()=>{const z=bots.find(b=>b.d.n==='Zach');return isAbducted(z)?!z.p.g.visible:isAlien(z)}));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
