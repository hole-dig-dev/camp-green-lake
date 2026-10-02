// the UFO easter egg (88-ufo.js): "ufo <name>" abducts a crew member; he comes back as an alien ("I'm Zach.") with
// "ufo back" or at the next new day. bash tests/carry/run.sh PORT OUT ufo.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
const zach=p=>p.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach');return{vis:b.p.g.visible,st:b.state,ufo:!!b.ufo,ab:isAbducted(b),alien:isAlien(b),act:crewActivity(b)}});
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);S.seeds+=400;crewBuy('Zach',CREW_HIRE_ITEM);crewBuy('Pete',CREW_HIRE_ITEM)});
await A.waitForFunction(()=>{const b=bots.find(b=>b.d.n==='Zach');return b&&b.p.g.visible&&b.state!=='away'},null,{timeout:40000});await A.waitForTimeout(2000);
await A.evaluate(()=>runCommand('ufo zach'));await A.waitForTimeout(5500);
check('ufo zach: the saucer has him (on both screens)',(await zach(A)).ufo&&(await zach(B)).ufo,JSON.stringify(await zach(B)));
await B.waitForFunction(()=>{const b=bots.find(b=>b.d.n==='Zach');return isAbducted(b)&&!b.p.g.visible&&!b.ufo},null,{timeout:90000}).catch(()=>{});   /* he may walk out of camp first (ufoLureStep) */
const z1=await zach(B);check('gone: abducted, nowhere on the lake',z1.ab&&!z1.vis&&/UFO/.test(z1.act),JSON.stringify(z1));
// the next day it brings him back
await A.evaluate(()=>jumpTo(SIM.DAYMS-2500));await A.waitForTimeout(6000+8000+9000);
const z2=await zach(B);check('the next day: back, as an alien, working again',!z2.ab&&z2.alien&&z2.vis&&!z2.ufo,JSON.stringify(z2));
check('all he says: "I\'m Zach."',await A.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach');const n=botNode(b,true);return n.text==="I'm Zach."&&n.name==='Glorb Glorb'&&n.opts.length>2}));
check('anything he\'d say comes out "I\'m Zach."',await A.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach');say(b.L,'Taking a breather.',1000);const t=b.L.el.innerText||b.L.el.textContent;return /I'm Zach\./.test(t)&&!/breather/.test(t)}),await A.evaluate(()=>{const b=bots.find(b=>b.d.n==='Zach');return b.L.el.innerText}));
// ufo back: right now
await A.evaluate(()=>runCommand('ufo pete'));await A.waitForTimeout(12000);
await A.evaluate(()=>runCommand('ufo back'));await A.waitForTimeout(9000);
check('ufo back: Pete\'s dropped off straight away, an alien too',await A.evaluate(()=>{const b=bots.find(b=>b.d.n==='Pete');return isAlien(b)&&!isAbducted(b)&&b.p.g.visible}));
await A.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
