// the mine disarm kit (88-disarm.js: you, and the crew with theirs) and the mine-sniffing dog (88-dog.js).
// bash tests/carry/run.sh PORT OUT disarm-dog.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);tuneSet('haz.on.mines',1);tuneSet('haz.mines',1);tuneSet('haz.mineEvery',0.5);tuneSet('haz.mineMax',4);P.x=0;P.z=-40;P.y=groundAt(0,-40);S.seeds+=400});
await B.evaluate(()=>{P.x=20;P.z=-60;P.y=groundAt(P.x,P.z)});
await A.waitForTimeout(24000);
const ms=await A.evaluate(()=>[...MINES.values()].map(m=>({id:m.id,x:m.x,z:m.z})));check('mines are out',ms.length>=3,ms.length);
await A.evaluate(()=>{tuneSet('haz.mineEvery',25);tuneSet('haz.mineMax',12)});
// you, with the kit
await A.evaluate(()=>buyShopItem('disarm'));await A.waitForTimeout(400);
const m0=ms[0];await A.evaluate(m=>{P.x=m.x+1.2;P.z=m.z;P.y=groundAt(P.x,P.z)},m0);await A.waitForTimeout(400);
check('beside a mine with the kit: hold F to disarm',await A.evaluate(()=>{const s=nearSpot();return s&&s.id==='disarm'}));
const w0=await A.evaluate(()=>RUN.bank);
await A.keyboard.down('f');await A.waitForTimeout(2000);check('not yet at 2 s',await A.evaluate(id=>MINES.has(id),m0.id));
await A.waitForTimeout(2600);await A.keyboard.up('f');await A.waitForTimeout(700);
check('disarmed: gone for everyone, quietly (nobody flew), scrap gold to the wallet',await A.evaluate(id=>!MINES.has(id)&&twSt===0,m0.id)&&await B.evaluate(id=>!MINES.has(id),m0.id)&&await A.evaluate(()=>RUN.bank)>w0-60,`wallet ${w0} -> ${await A.evaluate(()=>RUN.bank)}`);
// the crew with theirs: Zach walks toward a mine and stops to disarm it
const m1=ms[1];await A.evaluate(()=>crewMsg({up:{Zach:{hired:true,disarm:true}}}));await A.waitForTimeout(400);
await A.evaluate(m=>{const bt=bots.find(b=>b.d.n==='Zach');bt.state='walk';bt.p.g.visible=true;bt.p.g.position.set(m.x+4,groundAt(m.x+4,m.z),m.z);bt.tx=m.x-6;bt.tz=m.z},m1);
await A.waitForTimeout(1500);
check('Zach spots it and stops to disarm it',await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return bt.state==='disarming'&&crewActivity(bt)==='Disarming a landmine'}),await A.evaluate(()=>bots.find(b=>b.d.n==='Zach').state));
await A.waitForTimeout(6000);
check('Zach disarms it: gone for everyone, he carries on',await A.evaluate(id=>!MINES.has(id)&&bots.find(b=>b.d.n==='Zach').state!=='disarming',m1.id)&&await B.evaluate(id=>!MINES.has(id),m1.id));
// the dog
await A.evaluate(()=>buyShopItem('dog'));await A.waitForTimeout(300);
const m2=ms[2];await A.evaluate(m=>{P.x=m.x+7;P.z=m.z+2;P.y=groundAt(P.x,P.z)},m2);await A.waitForTimeout(4500);
const dg=await A.evaluate(()=>{const d=DOG.dogs.get('me');return d&&{st:d.state,mine:d.mine,x:+d.x.toFixed(1),z:+d.z.toFixed(1)}});
check('the dog runs to the mine and points at it',dg&&dg.st==='point'&&dg.mine===m2.id,JSON.stringify(dg));
await A.waitForTimeout(1600);
check('it\'s marked for everyone, visible from far off',await A.evaluate(id=>MINES.get(id).marked,m2.id)&&await B.evaluate(id=>{const m=MINES.get(id);if(!m)return false;P.x=m.x+25;P.z=m.z;P.y=groundAt(P.x,P.z);updateMines(0.016);return m.marked&&(!m.obj||m.obj.visible)},m2.id));
check('friends know you have a dog',await B.evaluate(()=>[...remotes.values()].find(r=>r.name==='Alpha').dog===true));
await A.evaluate(()=>{tuneSet('haz.all',1);tuneSet('haz.on.mines',0)});
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
