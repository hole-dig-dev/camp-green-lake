// the sand pipeline (88-pipeline.js): lay it from the sifter, dump sand at the intake, it rides to the sifter;
// boulders/sinkholes/mines crack it, hold F to fix. bash tests/carry/run.sh PORT OUT pipeline.cjs
const {browser,player,lookAt}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.mines',0);tuneSet('pipe.fixTime',3)});
const so=await A.evaluate(()=>pipeSocket());
await A.evaluate(so=>{S.up.pan=true;S.up.bucket=true;S.pipe=6;P.x=so.x-0.5;P.z=so.z;P.y=groundAt(P.x,P.z)},so);await A.waitForTimeout(500);
check('at the sifter connector with pipe: F lays a pipeline',await A.evaluate(()=>{const s=nearSpot();return s&&s.id==='pipe'&&/Lay a sand pipeline/.test(s.label)}));
await A.keyboard.press('f');await A.waitForTimeout(200);check('laying',await A.evaluate(()=>PIPE.laying));
// walk out through the camp gate area toward the lake: teleport in small steps along a route (south, then out the gate)
const route=await A.evaluate(so=>{const pts=[];for(let k=1;k<=26;k++)pts.push([so.x-k*0.2,so.z-k*1.0]);return pts},so);
for(const [x,z] of route){await A.evaluate(([x,z])=>{P.x=x;P.z=z;P.y=groundAt(x,z)},[x,z]);await A.waitForTimeout(60)}
const st=await A.evaluate(()=>({n:PIPE.nodes.length,pipe:S.pipe,laying:PIPE.laying}));
check('a joint every 5 m, a section each (26 m: 5 runs)',st.n===6&&st.pipe===1,JSON.stringify(st));
await A.keyboard.press('f');await A.waitForTimeout(800);
check('F stops; the server and the friend have the same pipeline',await A.evaluate(()=>!PIPE.laying)&&await B.evaluate(n=>PIPE.nodes.length===n,st.n),await B.evaluate(()=>PIPE.nodes.length));
// dump at the intake
const g0=await A.evaluate(()=>S.seeds);
await A.evaluate(()=>{const N=PIPE.nodes,e=N[N.length-1];P.x=e.x;P.z=e.z;P.y=groundAt(P.x,P.z);S.bucket=5});await A.waitForTimeout(300);
check('the intake says dump',await A.evaluate(()=>/Dump your bucket down the pipeline/.test(nearSpot().label)));
await A.keyboard.press('f');await A.waitForTimeout(400);
check('bucket empty, a plug of sand in the pipe (the friend sees one too)',await A.evaluate(()=>S.bucket===0&&PIPE.slugs.length===1)&&await B.evaluate(()=>PIPE.slugs.length===1));
await B.evaluate(()=>{const N=PIPE.nodes,m=N[2];P.x=m.x+2.5;P.z=m.z+1.5;P.y=groundAt(P.x,P.z)});await B.waitForTimeout(400);
await lookAt(B,(await B.evaluate(()=>PIPE.nodes[2].x)),0.4,(await B.evaluate(()=>PIPE.nodes[2].z)));await B.waitForTimeout(700);await B.screenshot({path:SP+'/pipe_flow.png'});
await A.waitForTimeout(4500);
const g1=await A.evaluate(()=>S.seeds);check('it reaches the sifter and pays you',g1>g0&&await A.evaluate(()=>PIPE.slugs.length===0),g0+' -> '+g1);
// a mine blast cracks it; sand can't go through; hold F to fix
await A.evaluate(()=>{const N=PIPE.nodes;pipeBlast((N[2].x+N[3].x)/2,(N[2].z+N[3].z)/2,1.5)});await A.waitForTimeout(800);
check('a blast cracks the run it hits (for everyone)',await A.evaluate(()=>PIPE.broken[2]===true)&&await B.evaluate(()=>PIPE.broken[2]===true));
await A.evaluate(()=>{S.bucket=3});await A.keyboard.press('f');await A.waitForTimeout(300);
check('cracked: the intake refuses the sand',await A.evaluate(()=>S.bucket===3));
await A.evaluate(()=>{const N=PIPE.nodes;P.x=(N[2].x+N[3].x)/2+1;P.z=(N[2].z+N[3].z)/2;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(300);
await lookAt(A,await A.evaluate(()=>(PIPE.nodes[2].x+PIPE.nodes[3].x)/2),0.3,await A.evaluate(()=>(PIPE.nodes[2].z+PIPE.nodes[3].z)/2));await A.waitForTimeout(500);await A.screenshot({path:SP+'/pipe_crack.png'});
check('next to the crack: hold F to fix',await A.evaluate(()=>nearSpot().id==='pipeFix'));
await A.keyboard.down('f');await A.waitForTimeout(1500);check('half way it isn\'t fixed yet',await A.evaluate(()=>PIPE.broken[2]===true&&PIPE.fixT>0.5));
await A.waitForTimeout(2200);await A.keyboard.up('f');await A.waitForTimeout(500);
check('held long enough: fixed for everyone',await A.evaluate(()=>!PIPE.broken[2])&&await B.evaluate(()=>!PIPE.broken[2]));
// a landslide boulder rolling over a run cracks it
await A.evaluate(()=>{const N=PIPE.nodes;lsBoulders.push({r:1.2,x:(N[4].x+N[5].x)/2,y:baseH(N[4].x,N[4].z)+1.2,z:(N[4].z+N[5].z)/2,fadeT:0,vx:0,vy:0,vz:0,simT:0,settledT:0,dodeca:false,bg:0,stagger:0,seed:1,rot:0,bounces:0,pace:0,impT:0,impX:0,impZ:0,_target:0});pipeHazards();lsBoulders.pop()});await A.waitForTimeout(400);
check('a boulder on a run cracks it',await A.evaluate(()=>PIPE.broken[4]===true));
await A.evaluate(()=>{lsBoulders.length=0;tuneSet('haz.mines',1);tuneSet('pipe.fixTime',15)});
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
