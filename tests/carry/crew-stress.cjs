// crew robustness audit (not pass/fail): the six crew at work with things added to the map at runtime: a branching sand
// pipeline out through the main gate, every camp upgrade, and stand-in buildings (admin "block") dropped on their usual
// spots (a sifter-queue slot, the nurse's spot, by the water drums, a gate lane, a wall across the dig). Measured every
// frame: inside anything solid, stuck, walking inside a pipe; errands done. node via run.sh: crew-stress.cjs [minutes] [noblocks]
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3],MIN=+(process.argv[4]||4),BLOCKS=process.argv[5]!=='noblocks';
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.evaluate(()=>{window.__ev=[];const o=logEv;window.logEv=function(t,d){__ev.push([t,d]);return o(t,d)};tuneSet('haz.all',0);runCommand('time 11:20');P.x=60;P.z=-90;P.y=groundAt(60,-90);GOD=true;runCommand('crew hire all')});
await A.waitForTimeout(1000);
const setup=await A.evaluate(B=>{const out=[];const c=l=>{runCommand(l);out.push(l+' -> '+(conLog.lastChild&&conLog.lastChild.textContent))};
  c('crew kit all shovel bucket');c('campup goldScale pipeTee pipePump pipeSteel sodaMachine');
  c('pipe 3,36 0,31 0,22 0,4 18,-12');c('pipe from 4 -20,6 -30,-8');
  if(B){c('block 11.2 36.9 1.2 1.2');c('block -1.5 33 1.6 1.6');c('block 6 31.5 2 1.2');c('block 3.5 29.6 1 1');c('block 0 12 16 0.6');c('block -14 -2 3 3')}
  return out},BLOCKS);
console.log(setup.join('\n'));
await A.waitForTimeout(3000);
await A.evaluate(()=>{const A={frames:0,inSolid:{},inPipe:{},stuck:{},state:{},lastPos:new Map(),stillT:new Map(),samples:[],pipeSamples:[]};window.__audit=A;
  const insideSolid=(x,z)=>colliders.some(c=>x>c.x0+0.1&&x<c.x1-0.1&&z>c.z0+0.1&&z<c.z1-0.1);
  const moving=new Set(['walk','return','gateout','gatein','gotent','gatebackin','gatebackout','siftq','drink','lunch']);
  const tick=()=>{A.frames++;const vis=bots.filter(b=>b.p.g.visible&&crewHired(b)&&b.state!=='indoor'&&b.state!=='inside'&&!(b.state==='lunch'&&b.t!=null));   /* seated at lunch: on the bench, meant to be */
    for(const b of vis){const g=b.p.g.position,n=b.d.n;A.state[b.state]=(A.state[b.state]||0)+1;
      if(insideSolid(g.x,g.z)){A.inSolid[n]=(A.inSolid[n]||0)+1;if(A.samples.length<30)A.samples.push([n,b.state,+g.x.toFixed(1),+g.z.toFixed(1)])}
      for(let i=1;i<PIPE.nodes.length;i++)if(pipeSegDist(i,g.x,g.z)<0.12){A.inPipe[n]=(A.inPipe[n]||0)+1;if(A.pipeSamples.length<20&&A.frames%30===0)A.pipeSamples.push([n,b.state,+g.x.toFixed(1),+g.z.toFixed(1)]);break}
      const lp=A.lastPos.get(b)||[g.x,g.z];const mv=Math.hypot(g.x-lp[0],g.z-lp[1]);A.lastPos.set(b,[g.x,g.z]);
      if(moving.has(b.state)&&mv<0.002){A.stillT.set(b,(A.stillT.get(b)||0)+1);if(A.stillT.get(b)===300){A.stuck[n]=(A.stuck[n]||0)+1;if(A.samples.length<30)A.samples.push(['STUCK',n,b.state,+g.x.toFixed(1),+g.z.toFixed(1)])}}else A.stillT.set(b,0)}
    requestAnimationFrame(tick)};requestAnimationFrame(tick)});
const t0=Date.now();while(Date.now()-t0<MIN*60000){await A.waitForTimeout(15000);await A.evaluate(()=>{S.water=999;S.stam=100})}
const r=await A.evaluate(()=>{const A=window.__audit,tot=Object.values(A.state).reduce((a,b)=>a+b,0)||1,cnt=k=>__ev.filter(e=>e[0]===k).length;
  return{frames:A.frames,pipeNodes:PIPE.nodes.length,inSolidFrames:A.inSolid,inPipeFrames:A.inPipe,stuckEvents:A.stuck,sifts:cnt('crewSift'),
    statePct:Object.fromEntries(Object.entries(A.state).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>[k,+(v/tot*100).toFixed(1)])),samples:A.samples,pipeSamples:A.pipeSamples}});
await A.evaluate(()=>{P.x=2;P.z=18;P.y=groundAt(2,18)+12;P.yaw=0;P.pitch=-0.5});await A.waitForTimeout(800);await A.screenshot({path:SP+'/stress.png'});
console.log(JSON.stringify(r,null,1));require('fs').writeFileSync(SP+'/crew-stress'+(BLOCKS?'':'-noblocks')+'.json',JSON.stringify(r,null,1));
console.log('errors:',errs.join(' | ')||'none');await b.close()})();
