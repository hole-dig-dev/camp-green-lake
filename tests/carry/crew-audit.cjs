// crew pathing / habits audit (not a pass/fail suite): six hired crew, N minutes of play, measured every frame.
// node tests/carry/crew-audit.cjs PORT OUT [minutes]   (via run.sh: bash tests/carry/run.sh PORT OUT crew-audit.cjs)
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3],MIN=+(process.argv[4]||3);
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);runCommand('time 08:00');S.seeds+=3000;P.x=60;P.z=-90;P.y=groundAt(60,-90);GOD=true;
  for(const n of SIM.CREW){crewBuy(n,CREW_HIRE_ITEM)}});
await A.waitForTimeout(2500);
await A.evaluate(()=>{for(const n of SIM.CREW)for(const id of['shovel','bucket'])crewBuy(n,SIM.CREW_SHOP.find(i=>i.id===id));
  /* the audit: every frame */
  const A={frames:0,inSolid:{},overlap:0,campCut:{},stuck:{},state:{},lastPos:new Map(),stillT:new Map(),samples:[]};window.__audit=A;
  const insideSolid=(x,z)=>colliders.some(c=>x>c.x0+0.1&&x<c.x1-0.1&&z>c.z0+0.1&&z<c.z1-0.1);
  const campInterior=(x,z)=>x>-38&&x<28&&z>29&&z<54;
  const moving=new Set(['walk','return','gateout','gatein','gotent','gatebackin','gatebackout','siftq','drink']);
  const tick=()=>{A.frames++;const vis=bots.filter(b=>b.p.g.visible&&crewHired(b)&&b.state!=='indoor'&&b.state!=='inside');
    for(const b of vis){const g=b.p.g.position,n=b.d.n;A.state[b.state]=(A.state[b.state]||0)+1;
      if(insideSolid(g.x,g.z)){A.inSolid[n]=(A.inSolid[n]||0)+1;if(A.samples.length<40)A.samples.push([n,b.state,+g.x.toFixed(1),+g.z.toFixed(1)])}
      if(campInterior(g.x,g.z)&&!b.errand&&!['gatein','gotent','gatebackin','siftq','sifting','drink'].includes(b.state))A.campCut[n]=(A.campCut[n]||0)+1;
      const lp=A.lastPos.get(b)||[g.x,g.z];const mv=Math.hypot(g.x-lp[0],g.z-lp[1]);A.lastPos.set(b,[g.x,g.z]);
      if(moving.has(b.state)&&mv<0.002){A.stillT.set(b,(A.stillT.get(b)||0)+1);if(A.stillT.get(b)===300)A.stuck[n]=(A.stuck[n]||0)+1}else A.stillT.set(b,0)}
    for(let i=0;i<vis.length;i++)for(let j=i+1;j<vis.length;j++){const p=vis[i].p.g.position,q=vis[j].p.g.position;if(Math.hypot(p.x-q.x,p.z-q.z)<0.45&&!(vis[i].state==='siftq'&&vis[j].state==='siftq'))A.overlap++}
    requestAnimationFrame(tick)};requestAnimationFrame(tick)});
const t0=Date.now();
while(Date.now()-t0<MIN*60000){await A.waitForTimeout(15000);await A.evaluate(()=>{S.water=999;S.stam=100})}
const r=await A.evaluate(()=>{const A=window.__audit;const tot=Object.values(A.state).reduce((a,b)=>a+b,0)||1;
  return{frames:A.frames,inSolidFrames:A.inSolid,overlapFrames:A.overlap,campCutFrames:A.campCut,stuckEvents:A.stuck,
    statePct:Object.fromEntries(Object.entries(A.state).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(v/tot*100).toFixed(1)])),bank:RUN.bank,samples:A.samples.slice(0,12)}});
console.log(JSON.stringify(r,null,1));require('fs').writeFileSync(SP+'/crew-audit.json',JSON.stringify(r,null,1));
console.log('errors:',errs.join(' | ')||'none');await b.close()})();
