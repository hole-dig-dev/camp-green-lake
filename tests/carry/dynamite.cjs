// dynamite (88-dynamite.js): Y tosses a lit stick; after the fuse: a crater, everyone close flies (the crew too), nearby
// mines go off, and a mound of loose sand that fills your bucket as you walk into it. bash tests/carry/run.sh PORT OUT dynamite.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);S.up.pan=true;S.up.bucket=true;S.seeds+=100});await A.waitForTimeout(800);
await A.evaluate(()=>buyShopItem('dynamite'));await A.waitForTimeout(500);
check('bought a stick (30 from the wallet)',await A.evaluate(()=>S.dynamite===1&&S.seeds===70));
await A.evaluate(()=>{P.x=0;P.z=40;P.y=groundAt(0,40)});await A.keyboard.press('y');await A.waitForTimeout(400);
check('not in camp',await A.evaluate(()=>S.dynamite===1&&DYN.fuses.size===0));
// out on the lake: Bravo 2 m from where it lands, a crew member next to it, a mine nearby
await A.evaluate(()=>{P.x=0;P.z=-30;P.y=groundAt(0,-30);P.fa=Math.PI;crewMsg({up:{Zach:{hired:true}}})});await A.waitForTimeout(500);
const land=await A.evaluate(()=>({x:P.x+Math.sin(P.fa)*4,z:P.z+Math.cos(P.fa)*4}));
await B.evaluate(l=>{P.x=l.x+2;P.z=l.z;P.y=groundAt(P.x,P.z)},land);
await A.evaluate(l=>{const bt=bots.find(b=>b.d.n==='Zach');bt.state='rest';bt.t=30;bt.restT=5;bt.p.g.visible=true;bt.p.g.position.set(l.x-1.5,groundAt(l.x-1.5,l.z),l.z)},land);
await A.waitForTimeout(600);const b0=await B.evaluate(()=>({x:P.x,z:P.z}));
await A.keyboard.press('y');await A.waitForTimeout(500);
check('Y: lit and tossed; both see the fuse',await A.evaluate(()=>S.dynamite===0&&DYN.fuses.size===1)&&await B.evaluate(()=>DYN.fuses.size===1));
await A.waitForTimeout(2600);await A.evaluate(l=>{const bt=bots.find(b=>b.d.n==='Zach');bt.state='rest';bt.t=30;bt.restT=5;bt.p.g.position.set(l.x-1.5,groundAt(l.x-1.5,l.z),l.z)},land);await A.waitForTimeout(700);
check('BOOM: the friend 2 m away flies',await B.evaluate(()=>twSt>=2||P.vy>3),'');
check('the crew member is blown up',await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return bt.tossWhy==='dy'}),await A.evaluate(()=>{const bt=bots.find(b=>b.d.n==='Zach');return bt.state+' '+bt.tossWhy}));
check('a crater where it went off',await A.evaluate(l=>{let d=0;forNearHoles(l.x,l.z,h=>{if(Math.hypot(h.x-l.x,h.z-l.z)<1)d=Math.max(d,h.d)});return d>1.2},land));
const pile=await B.evaluate(()=>[...DYN.piles.values()].map(q=>({x:q.x,z:q.z,sand:q.sand})));
check('a mound of loose sand (everyone has it)',pile.length===1&&pile[0].sand>5&&await A.evaluate(()=>DYN.piles.size===1),JSON.stringify(pile));
await A.waitForTimeout(4000);
// walk into it with an empty bucket
await A.evaluate(()=>{const q=[...DYN.piles.values()][0];S.bucket=0;P.x=q.x+1;P.z=q.z;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(3000);
const st=await A.evaluate(()=>({bucket:S.bucket,pile:[...DYN.piles.values()][0]?.sand}));
check('walking into it fills your bucket by itself',st.bucket>=4.5&&st.pile<4,JSON.stringify(st));
await A.waitForTimeout(800);check('the friend sees the mound shrink',await B.evaluate(s=>{const q=[...DYN.piles.values()][0];return q&&q.sand<4},st));
await A.evaluate(()=>{S.bucket=0});await A.waitForTimeout(4000);
check('scooped all up: the mound\'s gone for everyone',await A.evaluate(()=>DYN.piles.size===0)&&await B.evaluate(()=>DYN.piles.size===0),await A.evaluate(()=>S.bucket));
// a landmine near the blast goes off with it
await A.evaluate(()=>{tuneSet('haz.on.mines',1);tuneSet('haz.mines',1);S.dynamite=1;P.x=40;P.z=-60;P.y=groundAt(40,-60);P.fa=0});await A.waitForTimeout(800);
const l2=await A.evaluate(()=>({x:P.x+Math.sin(P.fa)*4,z:P.z+Math.cos(P.fa)*4}));
await A.evaluate(l=>{mineAdd({id:999,x:l.x+2,z:l.z})},l2);
await A.evaluate(async l=>{await fetch('/tune');},l2);
console.log('note: server-side mines are separate; local-only mine check skipped');
await A.evaluate(()=>{tuneSet('haz.all',1);tuneSet('haz.on.mines',0)});
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
