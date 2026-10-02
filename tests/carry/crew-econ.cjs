// crew economics (not a pass/fail suite): six crew with a given kit, MIN real minutes of work; holes finished and gold
// banked per crew member. node tests/carry/crew-econ.cjs PORT OUT kit minutes   (kit: hands | shovel | bucket | bucket3 | top)
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3],KIT=process.argv[4]||'shovel',MIN=+(process.argv[5]||4);
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);runCommand('time 07:00');P.x=80;P.z=-120;P.y=groundAt(80,-120);GOD=true});
const ids={hands:'none',shovel:'shovel',bucket:'shovel bucket',bucket3:'shovel bucket3',top:'spade bucket3 canteen3'}[KIT];   /* admin commands (96-admin.js): free, instant, identical */
await A.evaluate(ids=>{runCommand('crew hire all');setTimeout(()=>runCommand('crew kit all '+ids),800)},ids);
await A.waitForTimeout(2000);
const kit=await A.evaluate(()=>bots.map(b=>b.d.n+':'+Object.keys(CREW_UP[b.d.n]||{}).join('+')).join(' '));
await A.waitForFunction(()=>bots.filter(b=>crewHired(b)&&b.p.g.visible&&b.state!=='away'&&b.state!=='gatebackout').length>=6,null,{timeout:60000}).catch(()=>{});
const s0=await A.evaluate(()=>{window.__holes={};window.__gold={};const oL=logEv;window.logEv=function(t,o){if(t==='crewSift')__gold[o.n]=(__gold[o.n]||0)+o.gold;return oL(t,o)};
  for(const b of bots){b.__wasDig=false}
  const tick=()=>{for(const b of bots){const d=b.state==='dig';if(b.__wasDig&&b.state==='rest')__holes[b.d.n]=(__holes[b.d.n]||0)+1;b.__wasDig=d}requestAnimationFrame(tick)};requestAnimationFrame(tick);
  return{bank:RUN.bank,clock:clockText()}});
const t0=Date.now();while(Date.now()-t0<MIN*60000){await A.waitForTimeout(15000);await A.evaluate(()=>{S.water=999;S.stam=100})}
const r=await A.evaluate(s0=>({holes:window.__holes,gold:window.__gold,bankGain:RUN.bank-s0.bank,clock0:s0.clock,clock1:clockText()}),s0);
const n=Math.max(1,await A.evaluate(()=>bots.filter(crewHired).length)),holes=Object.values(r.holes).reduce((a,b)=>a+b,0),gold=Object.values(r.gold).reduce((a,b)=>a+b,0);
const out={crew:n,kit:KIT,minutes:MIN,kitDetail:kit,...r,holesPerCrewPerMin:+(holes/n/MIN).toFixed(2),goldPerCrewPerMin:+(gold/n/MIN).toFixed(1)};
console.log(JSON.stringify(out));require('fs').writeFileSync(SP+'/econ-'+KIT+'.json',JSON.stringify(out,null,1));await b.close()})();
