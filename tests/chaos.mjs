// CHAOS (F2 haz.chaos): the event director makes about chaos x as many natural hazards. node tests/chaos.mjs
import { createRequire } from 'module';const require=createRequire(import.meta.url);const D=require('../public/director.js');
let seed=7;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
function run(ch,min=30){const st=D.createState();st.enabled=true;let n=0;const t0=1e9;
  for(let t=0;t<min*60000;t+=500){const now=t0+t,players=[{id:1,x:40,z:-60,inCamp:false},{id:2,x:-50,z:-20,inCamp:false}];
    n+=D.step(st,{now,day:4,clockT:200000,players,rand,zone:'lake',rate:1*ch,chaos:ch}).length}return n}
const r={};for(const c of[0,0.5,1,2,5])r[c]=run(c);console.log(JSON.stringify(r));
const ok=r[0]===0&&r[0.5]<r[1]&&r[1]<r[2]&&r[2]<r[5]&&r[5]>=2.5*r[1];
console.log(ok?'PASS chaos scales the director (0 none, more each step, 5 at least 2.5x of 1)':'FAIL');process.exit(ok?0:1);
