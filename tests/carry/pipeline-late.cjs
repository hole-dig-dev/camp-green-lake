// late-game pipeline + camp upgrades (88-pipeline.js, 84-camp.js): tee fittings branch it, the booster pump speeds the
// sand, reinforced pipe never cracks, the gold scale adds 10%. bash tests/carry/run.sh PORT OUT pipeline-late.cjs
const {browser,player,lookAt}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
const walk=async(p,way)=>{const pts=await p.evaluate(way=>{const out=[];for(let i=1;i<way.length;i++){const[a,b]=[way[i-1],way[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/0.8);for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n])}return out},way);
  for(const [x,z] of pts){await p.evaluate(([x,z])=>{P.x=x;P.z=z;P.y=groundAt(x,z)},[x,z]);await p.waitForTimeout(60)}};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);S.up.pan=true;S.up.bucket=true;S.pipe=12;S.seeds+=1200});await A.waitForTimeout(800);
const so=await A.evaluate(()=>pipeSocket());
await A.evaluate(so=>{P.x=so.x-0.5;P.z=so.z;P.y=groundAt(P.x,P.z)},so);await A.waitForTimeout(300);await A.keyboard.press('f');
await walk(A,[[so.x-0.5,so.z],[5,37],[2,33],[0.3,30],[0,24],[0,13],[0,3]]);await A.keyboard.press('f');await A.waitForTimeout(600);
const n1=await A.evaluate(()=>PIPE.nodes.length);
check('without tee fittings: no branching at a joint',await A.evaluate(()=>{const j=PIPE.nodes[4];P.x=j.x+0.3;P.z=j.z;P.y=groundAt(P.x,P.z);const s=nearSpot();return !(s&&/Branch/.test(s.label||''))}));
// the camp upgrades, from the Camp tab
await A.evaluate(()=>{buyShopItem('pipeTee')});await A.waitForTimeout(1200);
check('tee fittings: bought for the whole camp (the friend has them too)',await A.evaluate(()=>campHas('pipeTee'))&&await B.evaluate(()=>campHas('pipeTee')));
await A.waitForTimeout(200);
check('at a joint: branch the pipeline',await A.evaluate(()=>{const s=nearSpot();return s&&/Branch the pipeline/.test(s.label)}));
await A.keyboard.press('f');const j=await A.evaluate(()=>({x:PIPE.nodes[4].x,z:PIPE.nodes[4].z}));
await walk(A,[[j.x,j.z],[j.x-6,j.z-2],[j.x-14,j.z-4]]);await A.keyboard.press('f');await A.waitForTimeout(800);
const tree=await A.evaluate(()=>({n:PIPE.nodes.length,leaves:pipeLeaves(),branchParent:PIPE.nodes[PIPE.nodes.length-1]&&pipeChain(PIPE.nodes.length-1)}));
check('a branch off joint 4: two intakes, the new line runs back through joint 4',tree.leaves.length===2&&tree.branchParent.includes(4)&&!tree.branchParent.includes(5),JSON.stringify(tree));
check('the friend has the same tree',await B.evaluate(n=>PIPE.nodes.length===n&&pipeLeaves().length===2,tree.n));
// dump at the branch's intake: it rides to the sifter
const leaf=tree.leaves.find(c=>c!==n1-1);
const timeRun=async()=>{await A.evaluate(leaf=>{const it=pipeIntakeAt(leaf);P.x=it.x;P.z=it.z;P.y=groundAt(P.x,P.z);S.bucket=3},leaf);await A.waitForTimeout(250);const b0=await A.evaluate(()=>RUN.bank);await A.keyboard.press('f');const t0=Date.now();
  while(Date.now()-t0<15000){await A.waitForTimeout(100);if(await A.evaluate(()=>PIPE.slugs.length===0))break}return{t:(Date.now()-t0)/1000,gold:await A.evaluate(()=>RUN.bank)-b0}};
await lookAt(A,0,0,0);const r1=await timeRun();
check('sand from the branch reaches the sifter and pays the wallet',r1.gold>0,JSON.stringify(r1));
await A.evaluate(()=>{buyShopItem('pipePump')});await A.waitForTimeout(1000);
const r2=await timeRun();
check('the booster pump: the same trip ~2.5x faster',r2.t<r1.t/1.8,`${r1.t.toFixed(1)} s -> ${r2.t.toFixed(1)} s`);
check('reinforced pipe not yet: a blast cracks it',await A.evaluate(()=>{const b=PIPE.nodes[3];pipeBlast(b.x,b.z,1);return Object.keys(PIPE.broken).length>0}));
await A.evaluate(()=>{for(const k of Object.keys(PIPE.broken)){delete PIPE.broken[k];wsSend({t:'pipeFix',i:+k})}const b=PIPE.nodes[3];P.x=b.x+1;P.z=b.z;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(500);
await A.evaluate(()=>{buyShopItem('pipeSteel')});await A.waitForTimeout(1000);
check('reinforced pipe: a blast doesn\'t crack it',await A.evaluate(()=>{const b=PIPE.nodes[3];pipeBlast(b.x,b.z,1);return Object.keys(PIPE.broken).length===0}));
await A.evaluate(()=>{buyShopItem('goldScale')});await A.waitForTimeout(1500);
check('the gold scale: +10% on every sift, for everyone',await A.evaluate(()=>goldScale()===1.1)&&await B.evaluate(()=>goldScale()===1.1));
const G=await A.evaluate(()=>SIM.GOLD.SIFTER);await A.evaluate(G=>{P.x=G.x+3;P.z=G.z-4;P.y=groundAt(P.x,P.z);if(FP)toggleView()},G);await A.waitForTimeout(400);await lookAt(A,G.x+1.2,1,G.z);await A.waitForTimeout(800);await A.screenshot({path:SP+'/camp_sifter.png'});
check('buying one the camp already has: refused, the wallet keeps its gold',await A.evaluate(async()=>{const b0=RUN.bank;const st=shopStatus(SHOP.find(i=>i.id==='goldScale'));return st.kind==='owned'}));
await A.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
