// rich veins (88-vein.js): announced to all, glitter + minimap; digging inside pays gold as you go (sand still sifts);
// dynamite inside throws up nuggets; its loose sand is rich. The crew don't go for it. bash tests/carry/run.sh PORT OUT vein.cjs
const {browser,player,lookAt}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);S.up={pan:true,shovel:true,bucket:true};P.x=0;P.z=-20;P.y=groundAt(0,-20);P.fa=Math.PI;runCommand('time 10:00')});await A.waitForTimeout(500);
await A.evaluate(()=>runCommand('vein'));await A.waitForTimeout(1000);
const v=await B.evaluate(()=>({on:VEIN.on,x:VEIN.x,z:VEIN.z,toast:__ev.some(e=>e[0]==='toast'&&/rich vein/i.test(e[2]))}));
check('a rich vein: everyone told, it\'s on for everyone',v.on&&v.toast&&await A.evaluate(()=>VEIN.on),JSON.stringify(v));
// dig in it
await A.evaluate(v=>{P.x=v.x+2;P.z=v.z;P.y=groundAt(P.x,P.z);S.bucket=0},v);await A.waitForTimeout(400);const w0=await A.evaluate(()=>RUN.bank);
await A.keyboard.down('e');await A.waitForTimeout(9000);await A.keyboard.up('e');await A.waitForTimeout(800);
const d=await A.evaluate(w0=>({gold:RUN.bank-w0,bucket:S.bucket}),w0);
check('digging in it: gold straight to the wallet AND the sand in the bucket',d.gold>=3&&d.bucket>0.5,JSON.stringify(d));
await A.evaluate(v=>{P.y+=0;window.__cam=null;if(FP)toggleView();P.x=v.x-16;P.z=v.z-10;P.y=groundAt(P.x,P.z)},v);await A.waitForTimeout(600);await lookAt(A,v.x,0.5,v.z);await A.waitForTimeout(900);await A.screenshot({path:SP+'/vein.png'});
// the same digging outside it pays nothing extra
await A.evaluate(()=>{P.x+=-30;P.y=groundAt(P.x,P.z)});await A.waitForTimeout(300);const w1=await A.evaluate(()=>RUN.bank);await A.keyboard.down('e');await A.waitForTimeout(5000);await A.keyboard.up('e');
check('outside it: only the odd fleck',await A.evaluate(w1=>RUN.bank-w1<=2,w1));
// dynamite in it
await A.evaluate(v=>{S.dynamite=1;P.x=v.x;P.z=v.z-5;P.y=groundAt(P.x,P.z);P.fa=0},v);await A.waitForTimeout(400);const w2=await A.evaluate(()=>RUN.bank);
await A.keyboard.press('y');await A.waitForTimeout(4500);
check('dynamite in it throws up nuggets for whoever lit it',await A.evaluate(w2=>RUN.bank-w2>=8,w2),await A.evaluate(w2=>RUN.bank-w2,w2));
const rich=await A.evaluate(()=>{const q=[...DYN.piles.values()][0];return q&&q.rich});check('its loose sand is rich',rich===true);
check('the minimap draws it',await A.evaluate(()=>typeof veinMap==='function'&&VEIN.on));
await A.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
