// crew pathing (29-nav.js): routes go round solid things, out through the gate, round open sinkholes and holes; crew
// keep their distance; six crew for two minutes never stand in anything or on each other. bash tests/carry/run.sh PORT OUT crew-nav.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);P.x=60;P.z=-90;P.y=groundAt(60,-90);GOD=true});
const legsClear=`pts=>{let a={x:pts.from[0],z:pts.from[1]};for(const p of pts.path){if(!navSegClear(a.x,a.z,p.x,p.z,0.2))return false;a=p}return true}`;
// from north of camp to the main gate: round the fence, never through the camp
const r1=await A.evaluate(s=>{const from=[0,72],path=navPath(0,72,0,25);const ok=eval(s)({from,path});const cut=path.some(p=>p.x>-38&&p.x<28&&p.z>30&&p.z<54);return{ok,cut,n:path.length,path:path.map(p=>[+p.x.toFixed(1),+p.z.toFixed(1)])}},legsClear);
check('north of camp to the gate: a planned route (round the fence or in through the service gate), every leg clear',r1.ok&&r1.n>1,JSON.stringify(r1));
// from the gate to the water drums: round the camp's things
const r2=await A.evaluate(s=>{const W=SIM.GOLD.WATER,t=navFree(W.x+1,W.z-1.5),path=navPath(gateX(bots[0]),30,t.x,t.z);return{ok:eval(s)({from:[gateX(bots[0]),30],path}),n:path.length}},legsClear);
check('gate to the water drums: every leg clear',r2.ok,JSON.stringify(r2));
// an open sinkhole in the way: round it
const r3=await A.evaluate(()=>{spawnSinkhole(0,-120,3,twNow());return true});await A.waitForTimeout(9000);
const r4=await A.evaluate(()=>{const sh=[...SINK_LIVE.values()].find(s=>Math.abs(s.x)<1&&Math.abs(s.z+120)<1);const path=navPath(0,-120-sh.r-6,0,-120+sh.r+6);let a={x:0,z:-120-sh.r-6},minD=1e9;for(const p of path){for(let u=0;u<=1;u+=0.05){const x=a.x+(p.x-a.x)*u,z=a.z+(p.z-a.z)*u;minD=Math.min(minD,Math.hypot(x-sh.x,z-sh.z))}a=p}return{r:sh.r,minD,n:path.length}});
check('an open sinkhole in the way: they go round it',r4.minD>r4.r,JSON.stringify(r4));
// holes in the way: round them if it's not far
const r5=await A.evaluate(()=>{for(let k=-3;k<=3;k++)applyDig(40+k*1.2,-60,1.5,true);const path=navPath(40,-66,40,-54);let a={x:40,z:-66},inHole=0;for(const p of path){for(let u=0;u<=1;u+=0.05){const x=a.x+(p.x-a.x)*u,z=a.z+(p.z-a.z)*u;const h=holeNear(x,z,0.9);if(h&&h.d>0.4)inHole++}a=p}return{inHole,n:path.length}});
check('a row of holes in the way: round them, not through',r5.inHole===0&&r5.n>1,JSON.stringify(r5));
// the whole crew for two minutes
await A.evaluate(()=>{S.seeds+=3000;runCommand('time 09:00');for(const n of SIM.CREW)crewBuy(n,CREW_HIRE_ITEM)});await A.waitForTimeout(1500);
await A.evaluate(()=>{for(const n of SIM.CREW)for(const id of['shovel','bucket'])crewBuy(n,SIM.CREW_SHOP.find(i=>i.id===id));
  const Q={inSolid:0,overlap:0};window.__q=Q;const tick=()=>{const vis=bots.filter(b=>b.p.g.visible&&crewHired(b)&&OUTDOOR.has(b.state));
    for(const b of vis){const g=b.p.g.position;if(colliders.some(c=>g.x>c.x0+0.1&&g.x<c.x1-0.1&&g.z>c.z0+0.1&&g.z<c.z1-0.1))Q.inSolid++}
    for(let i=0;i<vis.length;i++)for(let j=i+1;j<vis.length;j++){const p=vis[i].p.g.position,q=vis[j].p.g.position;if(Math.hypot(p.x-q.x,p.z-q.z)<0.45&&!(vis[i].state==='siftq'&&vis[j].state==='siftq'))Q.overlap++}
    requestAnimationFrame(tick)};requestAnimationFrame(tick)});
await A.waitForTimeout(120000);
const q=await A.evaluate(()=>window.__q);check('six crew, two minutes: never in anything solid, never on top of each other',q.inSolid===0&&q.overlap<30,JSON.stringify(q));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
