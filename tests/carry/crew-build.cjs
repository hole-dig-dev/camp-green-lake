// the crew vs things built at runtime (pipes, new buildings) and the layout (29-nav.js, 30-npcs.js). Fast, pass/fail.
// For a long measured run see crew-stress.cjs. bash tests/carry/run.sh PORT OUT crew-build.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);runCommand('crew hire all')});await A.waitForTimeout(800);
check('crew gate, nurse and camp box come from the fence (20-world.js)',await A.evaluate(()=>CREW_GATE.x===(GATE_X0+GATE_X1)/2&&CREW_GATE.out<FENCE_Z0&&CREW_GATE.in>FENCE_Z0&&NAV_CAMP.x0<FENCE_X0&&NAV_CAMP.z1>FENCE_Z1&&CREW_NURSE.z>FENCE_Z0));
check('the sifter queue is laid out from the sifter',await A.evaluate(()=>Math.hypot(SIFT_SLOTS[0][0]-SIM.GOLD.SIFTER.x,SIFT_SLOTS[0][1]-SIM.GOLD.SIFTER.z)<2));
await A.evaluate(()=>runCommand('pipe 3,36 0,31 0,22 0,4 18,-12'));await A.waitForTimeout(800);
check('no new hole under the pipeline (anywhere within 1.5 m of it)',await A.evaluate(()=>{for(let i=2;i<PIPE.nodes.length;i++){const n=PIPE.nodes[i],q=PIPE.nodes[n.p];for(const u of[0.25,0.5,0.75])for(const o of[-1.2,-0.4,0.4,1.2])if(crewDigOK(q.x+(n.x-q.x)*u+o,q.z+(n.z-q.z)*u+o*0.5,null))return false}return true}));
check('gate lanes step off a pipe laid through the gate',await A.evaluate(()=>bots.every(b=>pipeNear(gateX(b),CREW_GATE.out)>0.5)),await A.evaluate(()=>bots.map(b=>gateX(b).toFixed(2)).join(' ')));
check('a route along the pipe goes beside it, not on it',await A.evaluate(()=>{const p=navPath(0,20,0,6);let on=0;let a={x:0,z:20};for(const q of p){const n=Math.ceil(Math.hypot(q.x-a.x,q.z-a.z)/0.3);for(let s=1;s<=n;s++){const u=s/n;const x=a.x+(q.x-a.x)*u,z=a.z+(q.z-a.z)*u;if(z<19&&z>7&&pipeNear(x,z)<0.3)on++}a=q}return on===0}),JSON.stringify(await A.evaluate(()=>navPath(0,20,0,6))));   /* its ends are on the pipe; in between, beside it */
const s0=await A.evaluate(()=>siftSlot(1));
await A.evaluate(()=>{const s=SIFT_SLOTS[1];runCommand(`block ${s[0]} ${s[1]} 1.2 1.2`);runCommand('block 10 15 3 3')});
check('a building on a sifter-queue spot: the spot moves off it',await A.evaluate(s0=>{const s=siftSlot(1),c=colliders[colliders.length-2];return(s[0]!==s0[0]||s[1]!==s0[1])&&!(s[0]>c.x0&&s[0]<c.x1&&s[1]>c.z0&&s[1]<c.z1)},s0));
check('no digging against a new building',await A.evaluate(()=>!crewDigOK(11.8,15,null)));
check('the way round it',await A.evaluate(()=>{const p=navPath(10,10,10,20);return p.length>1&&p.every(q=>!(q.x>8.5&&q.x<11.5&&q.z>13.5&&q.z<16.5))}));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
