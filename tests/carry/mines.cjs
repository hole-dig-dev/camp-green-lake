// landmines (88-mines.js, server.js mineTick): spawn near campers outside the fence, hard to see, throw you (and the crew) far.
// bash tests/carry/run.sh PORT OUT mines.cjs
const {browser,player,lookAt}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.mineEvery',0.5);tuneSet('haz.mineMax',3)});
await A.evaluate(()=>{P.x=0;P.z=-40;P.y=groundAt(0,-40)});await B.evaluate(()=>{P.x=6;P.z=-42;P.y=groundAt(6,-42)});
await A.waitForTimeout(25000);   // the first one comes ~20 s after the server starts, then every ~0.5 s
const ms=await A.evaluate(()=>[...MINES.values()].map(m=>({id:m.id,x:m.x,z:m.z,camp:SIM.inCamp(m.x,m.z)})));
check('mines spawn (up to the max) on the lakebed, outside camp',ms.length===3&&ms.every(m=>!m.camp),JSON.stringify(ms));
check('the friend has the same mines',await B.evaluate(ids=>[...MINES.keys()].sort().join()===ids,ms.map(m=>m.id).sort().join()));
const m=ms[0];
check('hard to see: hidden from 5 m',await A.evaluate(m=>{P.x=m.x+5;P.z=m.z;P.y=groundAt(P.x,P.z);updateMines(0.016);return !MINES.get(m.id).obj.visible},m));
check('visible right next to it',await A.evaluate(m=>{P.x=m.x+1.2;P.z=m.z;P.y=groundAt(P.x,P.z);updateMines(0.016);const o=MINES.get(m.id).obj;return o.visible&&o.children[0].material.opacity>0.9},m));
await A.waitForTimeout(300);
await A.evaluate(m=>{P.yaw=Math.PI/2;P.pitch=0.9},m);await A.waitForTimeout(500);await A.screenshot({path:SP+'/close.png'});
// Bravo stands 2 m away: inside the blast too. Alpha steps on it.
await B.evaluate(m=>{P.x=m.x-2;P.z=m.z;P.y=groundAt(P.x,P.z)},m);await B.waitForTimeout(600);
const a0=await A.evaluate(()=>({x:P.x,z:P.z})),b0=await B.evaluate(()=>({x:P.x,z:P.z}));
await A.evaluate(m=>{P.x=m.x+0.1;P.z=m.z;P.y=groundAt(P.x,P.z)},m);
await A.waitForTimeout(250);check('BOOM: you go flying',await A.evaluate(()=>twSt===2&&P.vy>5));
console.log('B after boom',await B.evaluate(m=>JSON.stringify({tw:twSt,x:P.x,z:P.z,mx:m.x,mz:m.z,ko:S.ko,tent:inTent(),town:S.inTown,started:S.started,ev:__ev.filter(e=>e[0]==='toast').slice(-3)}),m));await A.screenshot({path:SP+'/boom_a.png'});await B.screenshot({path:SP+'/boom_b.png'});
await A.waitForTimeout(5000);
const a1=await A.evaluate(()=>({x:P.x,z:P.z})),b1=await B.evaluate(()=>({x:P.x,z:P.z}));
const da=Math.hypot(a1.x-a0.x,a1.z-a0.z),db=Math.hypot(b1.x-b0.x,b1.z-b0.z);
check('comically far: you land 20+ m away',da>20,da.toFixed(1)+' m');
check('your friend in the blast flies too',db>8,db.toFixed(1)+' m');
check('the mine is gone for both',await A.evaluate(id=>!MINES.has(id),m.id)&&await B.evaluate(id=>!MINES.has(id),m.id));
// the crew: hire one, stand him on a mine
await A.evaluate(()=>{crewMsg({up:{Zach:{hired:true}}})});await A.waitForTimeout(500);
const r=await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');const k=[...MINES.values()][0];if(!k)return 'no mine';bt.state='rest';bt.t=0;bt.restT=30;bt.p.g.visible=true;bt.p.g.position.set(k.x,groundAt(k.x,k.z),k.z);return bt.d.n});
await A.waitForTimeout(600);
check('a crew member who steps on one is blown sky-high',await A.evaluate(n=>{const bt=bots.find(b=>b.d.n===n);return bt&&bt.state==='tossed'&&bt.tossWhy==='mn'},r),r);
await A.evaluate(()=>{tuneSet('haz.mineEvery',25);tuneSet('haz.mineMax',12)});
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
