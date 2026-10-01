// The grab/carry suite: every way of carrying things and people, with real keys where a player would press them.
const {browser,player,spawn,aimAt,walkTo}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(name,ok,info)=>{R.push([ok,name,info]);console.log((ok?'PASS ':'FAIL ')+name+(info?'  -- '+info:''))};
const at=(p,x,z,yaw)=>p.evaluate(([x,z,yaw])=>{P.x=x;P.z=z;P.y=groundAt(x,z);P.vy=0;if(yaw!=null)P.yaw=yaw;P.pitch=FP?0.05:0.32;S.stam=100},[x,z,yaw]);
const face=(p,x,z)=>p.evaluate(([x,z])=>{P.yaw=Math.atan2(-(x-P.x),-(z-P.z));const d=Math.hypot(x-P.x,z-P.z);P.pitch=FP?clamp(Math.atan2(1.2,d),0,1.2):0.32},[x,z]);   // first person: look down at it, like a player would
const clearProps=p=>p.evaluate(()=>{for(const pr of [...PROPS.values()])if(!isCart(pr)){removeProp(pr.id)}});
const prompt=p=>p.evaluate(()=>$('#prompt').hidden?'':$('#prompt').textContent);
const prop=(p,id)=>p.evaluate(id=>{const t=PROPS.get(id);return t?{x:+t.x.toFixed(2),z:+t.z.toFixed(2),up:+(t.y-groundAt(t.x,t.z)).toFixed(2),val:t.val,held:GRAB_ST.id===id,grab:t.grab.slice(),cart:t.cartId}:null},id);
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{/* crewKit: the crew start unhired now; take them all on */crewMsg({up:Object.fromEntries(SIM.CREW.map(n=>[n,{hired:true,shovel:true,bucket:true}]))})});await A.waitForTimeout(500);
const bid=await B.evaluate(()=>myId()),aid=await A.evaluate(()=>myId());
await A.evaluate(()=>{for(const b of bots)b.talkT=999});

// 1. the prompt says what R grabs
await at(A,0,4,Math.PI);await at(B,30,4);let id=await spawn(A,'crate',0,6.2);await A.waitForTimeout(400);
let pr=await prompt(A);check('prompt: facing a crate offers the grab (F or R)',/Grab the Crate/.test(pr),pr);
// 2. solo carry to the window: no value lost, set down and picked up again
await A.keyboard.down('r');await A.waitForTimeout(500);
check('R grabs the crate in front (normal view, no aiming)',(await prop(A,id)).held);
pr=await prompt(A);check('prompt while holding says how to put it down',/let go of R|Let go/.test(pr),pr);
await walkTo(A,0,15,15);let s1=await prop(A,id);check('carried, not dragged (held up off the ground)',s1.held&&s1.up>0.25,`${s1.up} m up`);
await A.keyboard.up('r');await A.waitForTimeout(1500);let s2=await prop(A,id);check('setting it down costs nothing',s2.val===s1.val,`${s1.val} -> ${s2.val}`);
await face(A,s2.x,s2.z);await A.waitForTimeout(150);await A.keyboard.down('r');await A.waitForTimeout(400);
await walkTo(A,0,28.6,20);await walkTo(A,10.7,28.8,15);await walkTo(A,10.7,35.8,15);await walkTo(A,13.4,36.2,15);await A.waitForTimeout(1200);await A.keyboard.up('r');
check('crate carried through the gate sells at the window, full value',!(await prop(A,id)),`gold ${await A.evaluate(()=>S.seeds)}`);

await clearProps(A);await clearProps(B);
// 3. the safe: alone you drag it slowly; two of you lift it and carry it
await at(A,-1,4,Math.PI);await at(B,1,4,Math.PI);id=await spawn(A,'safe',0,6.4);await B.waitForTimeout(500);
await A.keyboard.down('r');await A.waitForTimeout(500);check('safe: one camper can grab it',(await prop(A,id)).held);
await A.keyboard.down('s');await A.waitForTimeout(3000);await A.keyboard.up('s');let sa=await prop(A,id);
check('safe: alone, walking backwards drags it',sa.held&&sa.z<6.0,`moved to z ${sa.z} (from 6.4), ${sa.up} m up`);
await face(B,sa.x,sa.z);await B.waitForTimeout(100);await B.keyboard.down('r');await B.waitForTimeout(800);
sa=await prop(A,id);check('safe: a second camper grabs on',sa.grab.length===2,`grab ${sa.grab}`);
await face(A,0,20);await face(B,0,20);await A.waitForTimeout(300);
const ups=[];await Promise.all([walkTo(A,-1,16,12,async()=>{const q=await prop(A,id);if(q)ups.push(q.up)}),walkTo(B,1,16,12)]);
sa=await prop(A,id);check('safe: two of you lift it off the ground and carry it',sa&&sa.held&&Math.max(...ups)>0.15&&sa.z>11,`z ${sa&&sa.z}, highest ${Math.max(...ups)} m`);
check('safe: neither of you lost your grip',(await A.evaluate(id=>GRAB_ST.id===id,id))&&(await B.evaluate(id=>GRAB_ST.id===id,id)));
await A.keyboard.up('r');await B.keyboard.up('r');await A.waitForTimeout(1500);sa=await prop(A,id);check('safe: put down together, no chip',sa.val===60,`val ${sa.val} `+JSON.stringify(await A.evaluate(()=>__ev.filter(e=>e[0]==='HIT'))));

await clearProps(A);await clearProps(B);
// 4. grab a friend who's standing: they get dragged, two of you lift them, they wriggle free
await at(B,0,-10);await at(A,0,-12.2,Math.PI);await A.waitForTimeout(800);
pr=await prompt(A);check('prompt: facing a friend offers to grab them',/Grab Bravo/.test(pr),pr);
await A.keyboard.down('r');await A.waitForTimeout(700);check('grabbing a standing friend works',await A.evaluate(bid=>GRAB_ST.id===-bid,bid));
const bt=await B.evaluate(()=>[...document.querySelectorAll('#toasts > *')].map(e=>e.textContent).join(' | '));check('your friend is told how to get free',/grabbed you.*Space/.test(bt),bt.slice(-90));
const b0=await B.evaluate(()=>[P.x,P.z]);await A.keyboard.down('s');await A.waitForTimeout(2500);await A.keyboard.up('s');const b1=await B.evaluate(()=>[P.x,P.z]);
check('they get pulled along when you walk off',Math.hypot(b1[0]-b0[0],b1[1]-b0[1])>1.5,`moved ${Math.hypot(b1[0]-b0[0],b1[1]-b0[1]).toFixed(1)} m`);
for(let i=0;i<3;i++){await B.keyboard.down(' ');await B.waitForTimeout(90);await B.keyboard.up(' ');await B.waitForTimeout(160)}
await A.waitForTimeout(800);check('three taps of Space wriggles free',!(await A.evaluate(bid=>GRAB_ST.id===-bid,bid)));
await A.keyboard.up('r');

await clearProps(A);await clearProps(B);
// 5. a knocked-out friend: carry them inside the fence and they wake up
await at(B,0,18);await B.evaluate(()=>{GOD=false;knockOut('Test','Knocked out for the test.')});await B.waitForTimeout(800);
await at(A,0,15.8,Math.PI);await A.waitForTimeout(500);pr=await prompt(A);check('prompt: a knocked-out friend says carry them home',/knocked out|pick up/i.test(pr),pr);
await A.keyboard.down('r');await A.waitForTimeout(600);check('grabbing a knocked-out friend',await A.evaluate(bid=>GRAB_ST.id===-bid,bid),JSON.stringify(await A.evaluate(()=>__ev.slice(-4)))+' B ko '+await B.evaluate(()=>S.ko)+' B f '+await A.evaluate(bid=>remotes.get(bid).f,bid));
await walkTo(A,0,31,20);await A.waitForTimeout(1500);await A.keyboard.up('r');
check('carried inside the fence, they are back on their feet',await B.evaluate(()=>!S.ko),await B.evaluate(()=>`ko ${S.ko} at ${P.x.toFixed(1)},${P.z.toFixed(1)}`));

await clearProps(A);await clearProps(B);
// 6. the D Tent crew: grab one, carry, throw; he lands and gets back to work
await A.evaluate(()=>{const z=bots.find(b=>b.d.n==='Zach');z.state='dig';z.p.g.position.set(z.hole.x,groundAt(z.hole.x,z.hole.z),z.hole.z)});
const zp=await A.evaluate(()=>{const g=bots.find(b=>b.d.n==='Zach').p.g.position;return[g.x,g.z]});
await at(A,zp[0],zp[1]-2.2);await face(A,zp[0],zp[1]);await A.waitForTimeout(400);pr=await prompt(A);check('prompt: facing a crew member offers to grab him',/Zach.*R to grab|Grab Zach/.test(pr),pr);
await A.keyboard.down('r');await A.waitForTimeout(600);check('grab Zach',await A.evaluate(()=>bots.find(b=>b.d.n==='Zach').state==='held'));
await A.keyboard.down('s');await A.waitForTimeout(1500);await A.keyboard.up('s');
const zh=await A.evaluate(()=>{const g=bots.find(b=>b.d.n==='Zach').p.g.position;return{up:+(g.y-groundAt(g.x,g.z)).toFixed(2),d:+Math.hypot(g.x-P.x,g.z-P.z).toFixed(2)}});
check('Zach comes with you, held up',zh.up>=-0.05&&zh.d<2.6&&await A.evaluate(()=>bots.find(b=>b.d.n==='Zach').state==='held'),JSON.stringify(zh));
await A.mouse.down();await A.waitForTimeout(80);await A.mouse.up();await A.waitForTimeout(2500);
const zs=await A.evaluate(()=>bots.find(b=>b.d.n==='Zach').state);check('thrown, he lands and heads back to work',['return','dig','rest'].includes(zs),zs);
await A.keyboard.up('r');

await clearProps(A);await clearProps(B);
// 7. the wheelbarrow: load a find (F), push it to the window
await at(A,-4,8,Math.PI);await A.evaluate(()=>runCommand('prop cart'));await A.waitForTimeout(800);
id=await spawn(A,'jug',-4,9.6);await face(A,-4,9.6);await A.waitForTimeout(200);await A.keyboard.down('r');await A.waitForTimeout(500);
pr=await prompt(A);await A.keyboard.press('f');await A.waitForTimeout(800);await A.keyboard.up('r');
check('F puts what you hold in the wheelbarrow',(await prop(A,id)||{}).cart!=null,pr);
const cart=await A.evaluate(()=>{const c=[...PROPS.values()].find(isCart);return[c.id,c.x,c.z]});
await face(A,cart[1],cart[2]);await A.waitForTimeout(150);await A.keyboard.down('r');await A.waitForTimeout(400);
await walkTo(A,0,29.4,25);await walkTo(A,10.7,29.4,15);await walkTo(A,10.7,35.8,15);await walkTo(A,13.4,36.2,15);await A.waitForTimeout(1500);await A.keyboard.up('r');
check('wheelbarrow pushed to the window sells what is in it',!(await prop(A,id)),`cart at ${JSON.stringify(await prop(A,cart[0]))}`);

await clearProps(A);await clearProps(B);
// 8. the rope: tie it to a strongbox and pull
await at(A,6,-20,Math.PI);id=await spawn(A,'strongbox',6,-17.8);await A.waitForTimeout(300);await face(A,6,-17.8);await A.waitForTimeout(150);
await A.keyboard.press('x');await A.waitForTimeout(400);check('X ties your rope to it',await A.evaluate(()=>ROPE_ST.id!=null));
await A.evaluate(()=>{P.yaw=0});await A.keyboard.down('w');await A.waitForTimeout(4500);await A.keyboard.up('w');
let rb=await prop(A,id);check('walking away, the rope pulls it along',rb.z<-19.5,`strongbox z ${rb.z} (from -17.8)`);
await A.keyboard.press('x');

await clearProps(A);await clearProps(B);
// 9. a throw: it flies, and a hard landing chips it
await at(A,10,-30,Math.PI);id=await spawn(A,'crate',10,-27.8);await face(A,10,-27.8);await A.waitForTimeout(150);
await A.keyboard.down('r');await A.waitForTimeout(500);await A.evaluate(()=>{P.pitch=-0.1});await A.waitForTimeout(200);
await A.mouse.down();await A.waitForTimeout(60);await A.mouse.up();await A.keyboard.up('r');await A.waitForTimeout(2500);
const th=await prop(A,id);check('a throw sends it flying',Math.hypot(th.x-10,th.z+27.8)>2.5,`landed ${Math.hypot(th.x-10,th.z+27.8).toFixed(1)} m away, value ${th.val}`);

await A.screenshot({path:SP+'/suite_end.png'});
console.log('\n'+R.filter(r=>r[0]).length+'/'+R.length+' passed');console.log('errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(r=>r[0])&&!errs.length?0:1)})();
