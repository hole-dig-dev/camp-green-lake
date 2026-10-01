const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const p=await player(b,PORT,'Watcher',errs);
await p.evaluate(()=>{window.lsPlan=()=>null;GOD=true;for(const b of bots)b.talkT=999});
// put one crew member digging out on the lake, the watcher 14 m off
const setup=async(name,x,z)=>p.evaluate(([n,x,z])=>{const b=bots.find(b=>b.d.n===n);b.hole=addHole({x,z,d:0.3,bot:true});b.state='dig';b.bucket=3;b.p.g.position.set(x,groundAt(x,z),z);P.x=x+14;P.z=z;P.y=groundAt(P.x,P.z);P.yaw=Math.PI/2;P.pitch=0.2;return b.state},[name,x,z]);
const st=n=>p.evaluate(n=>{const b=bots.find(b=>b.d.n===n),g=b.p.g.position;return{st:b.state,bucket:b.bucket,up:+(g.y-groundAt(g.x,g.z)).toFixed(2),rag:!!(b.p.rag&&ragActive(b.p)),x:+g.x.toFixed(1),z:+g.z.toFixed(1)}},n);
const watch=async(n,secs,shot)=>{const seen=new Set();let rag=false,maxUp=0,shotDone=false;for(let i=0;i<secs*5;i++){await p.waitForTimeout(200);const s=await st(n);seen.add(s.st);rag=rag||s.rag;maxUp=Math.max(maxUp,s.up);if(shot&&s.st==='tossed'&&s.up>1&&!shotDone){shotDone=true;await p.screenshot({path:SP+'/crew_'+shot+'.png'})}if(seen.has('tossed')&&['return','dig','rest','walk'].includes(s.st)&&i>3)break;if(seen.has('ko')&&s.st==='gatebackout')break}return{seen:[...seen],rag,maxUp}};
// 1. a twister
await setup('Zero',-60,-40);await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zero'),g=b.p.g.position;spawnEnv('twister',{x:g.x-30,z:g.z,a:0})});
let w=await watch('Zero',30,'twister');let s=await st('Zero');
check('twister: Zero gets thrown (a ragdoll), lands, gets back to work, bucket kept',w.seen.includes('tossed')&&w.seen.includes('down')&&w.rag&&s.bucket>=3&&w.maxUp>2,JSON.stringify(w)+' '+JSON.stringify(s));
// 2. a tumbleweed
await setup('Squid',60,-40);await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Squid'),g=b.p.g.position;spawnEnv('tumbleweed',{x:g.x-40,z:g.z,a:0})});
w=await watch('Squid',20,'tumbleweed');s=await st('Squid');
check('tumbleweed: Squid gets bowled over, gets up, bucket kept',w.seen.includes('tossed')&&w.rag&&s.bucket===3,JSON.stringify(w)+' '+JSON.stringify(s));
// 3. a boulder
await setup('Magnet',-80,-120);await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Magnet'),g=b.p.g.position;for(let k=0;k<3;k++)spawnEnv('landslide',{x:g.x,z:g.z,a:0})});
w=await watch('Magnet',30,'boulder');s=await st('Magnet');
check('landslide: a boulder knocks Magnet flying, no harm, bucket kept',w.seen.includes('tossed')&&s.bucket===3,JSON.stringify(w)+' '+JSON.stringify(s));
// 4. a lizard
await setup('Armpit',100,-60);await p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Armpit'),g=b.p.g.position,L=lizards[0];L.x=g.x+3;L.z=g.z;P.x=g.x+40});
w=await watch('Armpit',20,'lizard');s=await st('Armpit');
check('lizard: it goes for Armpit, he is knocked out, his bucket spills, he wakes at the nurse and walks out',w.seen.includes('ko')&&s.bucket===0&&(s.st==='gatebackout'||Math.hypot(s.x,s.z-33)<12),JSON.stringify(w)+' '+JSON.stringify(s));
// 5. a javelina
await setup('X-Ray',-100,60);await p.evaluate(()=>{const g=bots.find(b=>b.d.n==='X-Ray').p.g.position;JAVV=[[g.x+0.4,g.z,0,0]]});
w=await watch('X-Ray',8);s=await st('X-Ray');check('javelina: X-Ray is knocked out, bucket spills',w.seen.includes('ko')&&s.bucket===0,JSON.stringify(w)+' '+JSON.stringify(s));
await p.evaluate(()=>{JAVV=[]});
// 6. me: pass out with sand in the bucket
await p.evaluate(()=>{GOD=false;S.bucket=3.5;knockOut('Test','Knocked out.')});await p.waitForTimeout(300);
check('you: passing out spills your bucket',await p.evaluate(()=>S.bucket===0&&/bucket spilled/.test($('#koText').textContent)),await p.evaluate(()=>$('#koText').textContent));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)&&!errs.length?0:1)})();
