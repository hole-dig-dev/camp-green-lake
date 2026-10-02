// late gear (88-gear.js): scarecrow (vultures only), gravity boots, grapple hook, gold-plated shovel.
// bash tests/carry/run.sh PORT OUT gear.cjs
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);tuneSet('haz.on.vultures',1);tuneSet('vulture.thresh',1.01);S.up.shovel=true;S.seeds+=1500;P.x=30;P.z=-50;P.y=groundAt(30,-50);runCommand('time 10:00')});await A.waitForTimeout(1000);
// scarecrow
check('weak and out on the lake: the vultures would come',await A.evaluate(()=>underThreatNow()));
await A.evaluate(()=>buyShopItem('scarecrow'));await A.waitForTimeout(300);await A.keyboard.press('u');await A.waitForTimeout(900);
check('U plants a scarecrow; everyone has it',await A.evaluate(()=>SCARE.list.size===1&&S.scarecrow===0)&&await B.evaluate(()=>SCARE.list.size===1));
check('near it the vultures keep off',await A.evaluate(()=>!underThreatNow()&&scareNear(P.x,P.z)));
check('30 m away they come again',await A.evaluate(()=>{P.x+=30;return underThreatNow()}));
// gravity boots
await A.evaluate(()=>buyShopItem('grav'));await A.waitForTimeout(800);
check('gravity boots: a twister can\'t suck you up',await A.evaluate(()=>{twStart({id:'t',x:P.x,z:P.z,s:1},1);return twSt===0}));
check('...nor a giant tumbleweed roll you up',await A.evaluate(()=>{tbStart({id:'w',x:P.x,y:P.y+1,z:P.z,r:2});return tbSt===0}));
check('...nor a vulture lift you',await A.evaluate(()=>!underThreatNow()));
check('blasts still throw you',await A.evaluate(()=>{blastLaunch(P.x+0.5,P.z,4,1,'mn',null);const t=twSt;return t===2}));
await A.waitForTimeout(6000);
check('friends see you in them',await B.evaluate(()=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return R.gv===true&&R.p.gravBoots===true}));
// grapple
await A.evaluate(()=>buyShopItem('grapple'));await A.waitForTimeout(300);
await A.evaluate(()=>{const x=P.x+6,z=P.z;for(let i=0;i<6;i++)applyDig(x,z,2.5,true);P.x=x;P.z=z;P.y=groundAt(x,z);P.grounded=true});await A.waitForTimeout(600);
check('down a deep hole: the grapple prompt',await A.evaluate(()=>isTrapped()&&nearSpot().id==='grapple'),await A.evaluate(()=>JSON.stringify({trapped:isTrapped(),d:holeDepthHere(),s:nearSpot()&&nearSpot().id})));
await A.keyboard.down('f');await A.waitForTimeout(1900);await A.keyboard.up('f');await A.waitForTimeout(400);
check('hold F: hauled out onto the rim',await A.evaluate(()=>!isTrapped()&&holeDepthHere()<0.5));
// gold shovel
await A.evaluate(()=>buyShopItem('goldShovel'));await A.waitForTimeout(1200);
const gold=await A.evaluate(()=>me.shovelMeshes.some(n=>n.material&&n.material.color&&n.material.color.getHex()===SPADE_GOLD.color));
check('the gold-plated shovel: yours is gold',gold);
check('...and your friend sees it gold',await B.evaluate(()=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return R.p.shovelMeshes.some(n=>n.material&&n.material.color&&n.material.color.getHex()===SPADE_GOLD.color)}));
await A.evaluate(()=>{tuneSet('haz.all',1);tuneSet('haz.on.vultures',0);tuneSet('vulture.thresh',0.30)});
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
