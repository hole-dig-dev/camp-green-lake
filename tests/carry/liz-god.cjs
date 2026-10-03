// a lizard reaching you in god mode (no knockout): it bites once and backs off, not every frame (JT: "destroys my
// ears"). bash tests/carry/run.sh PORT OUT liz-god.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);
await A.evaluate(()=>{GOD=true;runCommand('time 10:00');window.__snd={bite:0,hiss:0};const ob=sfx.bite,oh=sfx.hiss;sfx.bite=function(){__snd.bite++;return ob.apply(this,arguments)};sfx.hiss=function(){__snd.hiss++;return oh.apply(this,arguments)};
  const L=lizards[0];P.x=L.x+3;P.z=L.z;P.y=groundAt(P.x,P.z)});
await A.waitForTimeout(10000);
const s=await A.evaluate(()=>__snd);
check('god mode, a lizard on you for 10 s: a few bites, not hundreds',s.bite>=1&&s.bite<=4,JSON.stringify(s));
check('...and a hiss or two, not one every frame',s.hiss<=8,JSON.stringify(s));
await A.evaluate(()=>{GOD=false;S.ko=0;const L=lizards[1];L.calmT=0;P.x=L.x+2;P.z=L.z;P.y=groundAt(P.x,P.z)});
await A.waitForFunction(()=>S.ko>0,null,{timeout:15000}).catch(()=>{});
check('out of god mode a bite still knocks you out',await A.evaluate(()=>S.ko>0));
await A.evaluate(()=>{S.up={pan:true};runCommand('god off');runCommand('god on')});
check('god mode: the long shovel and the camp shovel, so you dig with it',await A.evaluate(()=>S.up.shovel&&S.up.long&&digDepthMax()===EIGHT_FT));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
