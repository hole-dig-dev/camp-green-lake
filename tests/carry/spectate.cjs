// spectator mode (96-spectate.js): ?spectate joins as a free camera; nobody sees you; you see everyone; free flight,
// follow, scripted paths. bash tests/carry/run.sh PORT OUT spectate.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.evaluate(()=>{P.x=10;P.z=-20;P.y=groundAt(10,-20)});
const V=await (await b.newContext({viewport:{width:960,height:600}})).newPage();V.on('pageerror',e=>errs.push('spec: '+e.message));
await V.goto(`http://127.0.0.1:${PORT}/?r=1&spectate`);await V.waitForFunction(()=>!document.querySelector('#startBtn').disabled,null,{timeout:30000});
check('the title says Watch',await V.evaluate(()=>/Watch/.test(document.getElementById('startBtn').textContent)));
await V.evaluate(()=>document.querySelector('#startBtn').click());await V.waitForTimeout(3000);
check('in as a spectator: no camper, no HUD, the help strip',await V.evaluate(()=>SPEC.joined&&!S.started&&document.getElementById('hud').hidden&&!document.getElementById('specHelp').hidden));
check('the spectator sees Alpha',await V.evaluate(()=>[...remotes.values()].some(r=>r.name==='Alpha')));
check('Alpha doesn\'t see the spectator (and it isn\'t a camper on the server)',await A.evaluate(()=>![...remotes.values()].some(r=>r.name==='Spectator')));
// free flight
const p0=await V.evaluate(()=>camera.position.toArray());await V.keyboard.down('w');await V.waitForTimeout(1200);await V.keyboard.up('w');
const p1=await V.evaluate(()=>camera.position.toArray());check('W flies the camera',Math.hypot(p1[0]-p0[0],p1[2]-p0[2])>5,JSON.stringify({p0,p1}));
// follow Alpha
await V.evaluate(()=>SPEC.follow('Alpha',{r:6,h:2.5}));await V.waitForTimeout(1500);
check('follow: the camera orbits Alpha',await V.evaluate(()=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return camera.position.distanceTo(R.p.g.position)<9}));
await V.screenshot({path:SP+'/spectate-follow.png'});
// a scripted path
await V.evaluate(()=>SPEC.path([{t:0,pos:[0,30,0],look:[0,0,-40]},{t:2,pos:[40,20,-40],look:[0,0,-40]}]));await V.waitForTimeout(2600);
check('a scripted path ends where it should',await V.evaluate(()=>camera.position.distanceTo(new T.Vector3(40,20,-40))<1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
