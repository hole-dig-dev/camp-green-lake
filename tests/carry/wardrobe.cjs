// the Wardrobe (81-wardrobe.js): hats, faces, glasses, outfits (top/sleeves/bottoms), shoes on your camper; friends see it.
// bash tests/carry/run.sh PORT OUT wardrobe.cjs
const {browser,player,lookAt}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
const R=[];const check=(n,ok,i)=>{R.push(!!ok);console.log((ok?'PASS ':'FAIL ')+n+(i?'  -- '+i:''))};
const vis=`p=>{const o={};p.model.traverse(n=>{if(n.isMesh&&/^CGLCamper_(Torso|L_Sleeve|L_Leg|L_Shoe|Eye-1|Bucket_HatCrown|DesertCap_HatCrown|Cowboy_HatCrown)$/.test(n.name))o[n.name.replace('CGLCamper_','')]=n.visible});o.ward=(p.wardObjs||[]).length;return o}`;
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs),B=await player(b,PORT,'Bravo',errs);
await A.evaluate(()=>{tuneSet('haz.all',0);P.x=0;P.z=-20;P.y=groundAt(0,-20);runCommand('time 10:00')});await B.evaluate(()=>{P.x=0;P.z=-16.5;P.y=groundAt(0,-16.5);P.yaw=0;P.pitch=0.1})
await A.waitForTimeout(800);
check('the pause menu has a Wardrobe button',await A.evaluate(()=>!!document.getElementById('pWardBtn')));
await A.evaluate(()=>openWardrobe());await A.waitForTimeout(400);
check('open: the panel, third person, the game paused for input',await A.evaluate(()=>!document.getElementById('wardrobe').hidden&&!FP&&uiOpen()));
const looks=[{hat:0,face:2,glasses:4,torso:1,arms:1,legs:1,shoes:3},{hat:6,face:7,glasses:14,torso:9,arms:9,legs:9,shoes:12},{hat:16,face:13,glasses:19,torso:17,arms:4,legs:12,shoes:18}];
for(const [i,w] of looks.entries()){
  await A.evaluate(w=>setMyWard(w),w);await A.waitForTimeout(2500);
  const va=await A.evaluate(s=>eval(s)(me),vis);
  check(`look ${i+1}: 7 new pieces on, the camper's own hidden`,va.ward===7&&!va.Torso&&!va.L_Sleeve&&!va.L_Leg&&!va.L_Shoe&&!va['Eye-1']&&!va.Bucket_HatCrown&&!va.DesertCap_HatCrown,JSON.stringify(va));
  await A.screenshot({path:SP+`/ward_${i+1}_me.png`});
  await B.evaluate(()=>{const R=[...remotes.values()][0];const g=R.p.g.position;const e=new T.Vector3();camera.getWorldPosition(e)});
  await lookAt(B,0,1,-20);
  const vb=await B.evaluate(s=>{const R=[...remotes.values()].find(r=>r.name==='Alpha');return eval(s)(R.p)},vis);
  check(`look ${i+1}: your friend sees it`,vb.ward===7&&!vb.Torso,JSON.stringify(vb));
}
await B.evaluate(()=>{P.yaw=0;P.pitch=0.15});await B.waitForTimeout(500);await B.screenshot({path:SP+'/ward_friend.png'});
await A.evaluate(()=>{setMyWard({hat:-2,face:-1,glasses:-1,torso:-1,arms:-1,legs:-1,shoes:-1})});await A.waitForTimeout(1500);
const vh=await A.evaluate(()=>{const o={};me.model.traverse(n=>{if(n.isMesh&&n.name.includes('_Hair_'))o.hair=n.visible;if(n.isMesh&&/_Bucket_HatCrown|_DesertCap_HatCrown|_Cowboy_HatCrown/.test(n.name)&&n.visible)o.hat=true});o.ward=me.wardObjs.length;o.torso=me.model.getObjectByName('CGLCamper_Torso').visible;return o});
check('no hat: hair shows; the rest your own again',vh.hair&&!vh.hat&&vh.ward===0&&vh.torso,JSON.stringify(vh));
await A.evaluate(()=>{setMyWard({hat:3,face:0,glasses:1,torso:5,arms:5,legs:5,shoes:5});closeWardrobe()});await A.waitForTimeout(2500);
check('closed: back to first person, your new pieces hidden from your own camera',await A.evaluate(()=>FP&&me.fpOn&&me.wardObjs.every(o=>{let ok=true;o.traverse(n=>{if(n.isMesh&&n.layers.mask===1&&!(n.parent&&n.parent.name==='head'&&!n.visible)){ /* head pieces hide via visible */ if(o.parent&&o.parent.name!=='head')ok=false}});return ok})));
await A.reload();await A.waitForFunction(()=>!document.querySelector('#startBtn').disabled,null,{timeout:30000}).catch(()=>{});
check('saved in this browser',await A.evaluate(()=>MY_WARD.hat===3&&MY_WARD.torso===5));
await B.evaluate(()=>tuneSet('haz.all',1));
console.log(R.filter(Boolean).length+'/'+R.length+' passed | errors:',errs.join(' | ')||'none');await b.close();process.exit(R.every(Boolean)?0:1)})();
