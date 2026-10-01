// Starting with nothing: bare hands, the pan, the shovel, the bucket and sifter, and the Warden's quota (pay / fired).
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
const buy=async(p,id)=>{await p.evaluate(()=>{P.x=16;P.z=40.6;P.y=groundAt(P.x,P.z)});await p.waitForTimeout(300);if(!(await p.evaluate(()=>shopOpen))){await p.keyboard.press('f');await p.waitForTimeout(400)}
  await p.click(`.shop-item[data-item="${id}"]`);await p.waitForTimeout(150);await p.click('#shopBuyBtn');await p.waitForTimeout(150);await p.click('#shopConfirmBuy');await p.waitForTimeout(250);await p.keyboard.press('Escape');await p.waitForTimeout(250)};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{GOD=true;runCommand('time 8:00')});await A.waitForTimeout(800);
check('you start with nothing: 0 gold, bare hands',await A.evaluate(()=>S.seeds===0&&!S.up.shovel&&/Bare hands/.test(document.querySelector('#tools').textContent+[...document.querySelectorAll('#tools [title]')].map(e=>e.title).join(''))));
check('no shovel in your hands (your view and your friend\'s)',await A.evaluate(()=>me.noShovel&&me.shovelMeshes.every(n=>!n.visible))&&await B.evaluate(()=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return R.p.noShovel&&R.p.shovelMeshes.every(n=>!n.visible)}));
check('no pan or bucket yet: no sand meter',await A.evaluate(()=>$('#bucketMeter').hidden));
check('quota on the HUD: bank / quota, day 1 is 15 a camper (24 for two of you)',await A.evaluate(()=>$('#quota').textContent)==='0 / 24',await A.evaluate(()=>$('#quota').textContent));
// dig with your hands (real E)
await A.evaluate(()=>{for(let i=0;i<200;i++){const x=-60+(i%20)*6,z=-80-((i/20)|0)*6;if(!holeNear(x,z,4)&&!holeNear(x,z+1.1,4)){P.x=x;P.z=z;P.y=groundAt(x,z);P.fa=0;P.yaw=Math.PI;break}}});await A.keyboard.down('e');await A.waitForTimeout(9000);await A.keyboard.up('e');   // clear ground (not next to one of the lake's old holes)
const hd=await A.evaluate(()=>{let d=0;forNearHoles(P.x,P.z,h=>{if(h.own)d=Math.max(d,h.d)});return +d.toFixed(2)});
check('bare hands dig, but only 1.5 ft down',hd>0.3&&hd<=0.451,`hole ${hd} m`);
// flecks: a lot of hand scoops
const fl=await A.evaluate(()=>{const g0=S.seeds;for(let i=0;i<300;i++){P.x=20+((i/10)|0)*3;P.z=-40+(i%10)*3;scoop()}return S.seeds-g0});
check('the odd fleck of gold turns up as you dig (about 1 scoop in 25)',fl>=4&&fl<=25,`${fl} gold in 300 hand scoops`);
// the pan
await A.evaluate(()=>{runCommand('give gold 200')});await buy(A,'pan');
check('the pan (10 gold): the meter says Pan',await A.evaluate(()=>S.up.pan&&!$('#bucketMeter').hidden&&$('#bucketK').textContent==='Pan'));
await A.evaluate(()=>{S.bucket=1;P.x=SIM.GOLD.WATER.x;P.z=SIM.GOLD.WATER.z;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(400);
const pr=await A.evaluate(()=>$('#prompt').textContent);const g1=await A.evaluate(()=>S.seeds);await A.keyboard.press('f');await A.waitForTimeout(3200);
check('a full pan washes out at the water drums (F)',/Wash your pan/.test(pr)&&await A.evaluate(g=>S.seeds>g&&S.bucket===0,g1),`${pr} | +${await A.evaluate(g=>S.seeds-g,g1)} gold`);
await A.evaluate(()=>{S.bucket=0.8;P.x=SIM.GOLD.SIFTER.x;P.z=SIM.GOLD.SIFTER.z-2;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(300);await A.keyboard.press('f');await A.waitForTimeout(400);
check('the sifter wants a bucket, not a pan',await A.evaluate(()=>S.bucket===0.8&&[...document.querySelectorAll('#toasts > *')].some(e=>/sifter takes a bucket/.test(e.textContent))));
// the shovel
check('the shovel comes before the spade',await A.evaluate(()=>shopStatus(SHOP.find(i=>i.id==='spade')).kind==='locked'));
await buy(A,'shovel');await A.evaluate(()=>{P.x+=0.01});await A.waitForTimeout(1500);
check('buy the camp shovel: it\'s in your hands, and your friend sees it',await A.evaluate(()=>!me.noShovel&&me.shovelMeshes.some(n=>n.visible))&&await B.evaluate(()=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return!R.p.noShovel}));
check('...and it digs to 5 feet',await A.evaluate(()=>Math.abs(digDepthMax()-FIVE_FT)<1e-6));
// the bucket and the sifter
await buy(A,'bucket');
check('the bucket (45): sand goes in the bucket now (5 holes)',await A.evaluate(()=>carrier()==='bucket'&&bucketMax()===5&&$('#bucketK').textContent==='Bucket'));
await A.evaluate(()=>{S.bucket=5;P.x=SIM.GOLD.SIFTER.x;P.z=SIM.GOLD.SIFTER.z-2;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(300);const g2=await A.evaluate(()=>S.seeds);await A.keyboard.press('f');await A.waitForTimeout(1800);
check('a bucket of sand goes through the sifter',await A.evaluate(g=>S.seeds>g&&S.bucket===0,g2));
// the crew start with no bucket
check('the crew dig but earn nothing until you buy them a bucket',await A.evaluate(()=>bots.every(b=>crewBucketMax(b)===0)&&/no bucket/.test($('#crewRows').textContent)));
// the quota. Day 1: you've only just got here, so a grace day
await A.evaluate(()=>jumpTo(DAYMS-3000));await A.waitForTimeout(6000);
let d=await A.evaluate(()=>({day:RUN.day,bank:RUN.bank,quota:RUN.quota,t:[...document.querySelectorAll('#toasts > *')].map(e=>e.textContent).join('|')}));
check('day 1, only just got here: a grace day (nothing taken), day 2 wants 37 a camper',d.day===2&&d.quota===59&&/let the quota slide/.test(d.t),JSON.stringify({...d,t:undefined}));
// day 2: a full day played, the bank covers it
await A.evaluate(()=>jumpTo(tAtHour(7)));await A.waitForTimeout(190000);
await A.evaluate(()=>{S.seeds+=100;depositGold(70)});await A.waitForTimeout(500);const bank2=await A.evaluate(()=>RUN.bank);
await A.evaluate(()=>jumpTo(DAYMS-3000));await A.waitForTimeout(6000);
d=await A.evaluate(()=>({day:RUN.day,bank:RUN.bank,quota:RUN.quota}));
check('day 2 at curfew: the Warden takes 59 out of the bank',d.day===3&&d.bank===bank2-59,`bank ${bank2} -> ${JSON.stringify(d)}`);
// day 3: short
await A.evaluate(()=>jumpTo(tAtHour(7)));await A.waitForTimeout(190000);
await A.evaluate(()=>jumpTo(DAYMS-3000));await A.waitForTimeout(6000);
const f=await A.evaluate(()=>({fired:!$('#fired').hidden,text:$('#firedText').textContent,gold:S.seeds,shovel:!!S.up.shovel}));
check('short on day 3: fired, everything gone',f.fired&&f.gold===0&&!f.shovel,JSON.stringify(f));
await A.screenshot({path:SP+'/fired.png'});
check('your friend is fired too',await B.evaluate(()=>!$('#fired').hidden));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
