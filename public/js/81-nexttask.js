'use strict';
/* public/js/81-nexttask.js -- the "next task" line (2026-11-10): one short sentence at the top of the screen that always
   says what to do next, so a brand-new camper is never standing in the desert wondering. It is worked out from what
   you own and carry, not from a script, so it is right after a reload, a firing or joining friends mid-run:
     dig on the creek -> wash the pan -> shovel -> bucket and the sifter -> prospect for pay dirt -> the washers,
   then it settles on tonight's quota. O hides or shows it (saved with your settings). Nothing here changes the game. */
const NEXT={el:null,last:'',hide:false};
try{NEXT.hide=localStorage.getItem('cgl-nexttask-hide')==='1'}catch(e){}
function nextTaskText(){
  const gold=S.seeds|0,pan=carrier()==='pan',full=bucketMax()>0&&S.bucket>=bucketMax()-0.01,any=S.bucket>0.05;
  const quota=(typeof RUN!=='undefined'&&RUN.quota)|0,need=(c,what)=>gold<c?`Earn ${c} gold for ${what} (${gold}/${c}).`:null;
  if(!inCamp(P.x,P.z)&&typeof curfewLeft==='function'&&curfewLeft()<60)return'Lights-out is close. Get back inside the camp fence.';
  if(full)return pan?'Your pan is full. Wash it at the water drums in camp (F).':hopperTier()?'Your bucket is full. Dump it in the hopper at the sifter (F).':'Your bucket is full. Take it to the sifter in camp (F).';
  if(!S.up.shovel){
    if(gold>=25)return'Buy a camp shovel at the Company Store window (F): it digs three times as fast, to 5 feet.';
    return any?`Fill your pan, then wash it at the water drums. ${need(25,'a camp shovel')||''}`:'Dig on the old creek bed just past the gate (hold click or E). Good ground throws up gold flecks.';
  }
  if(!S.up.bucket)return need(45,'a bucket')||'Buy a bucket at the Company Store: it carries 5 holes of sand to the sifter.';
  const best=Array.isArray(S.samples)?S.samples.reduce((m,q)=>Math.max(m,q[2]),0):0;
  if(best<3)return'Prospect: sift sand from different spots. Each assay leaves a dot on the map; orange is pay dirt.';
  if(!campHas('washRocker'))return need(600,'the rocker box (Camp tab)')||'Buy the rocker box at the Company Store (Camp tab): every sift pays more.';
  if(!S.up.long)return need(110,'the long-handled shovel')||'Buy the long-handled shovel: sand from 8 feet down is half again as rich.';
  if(!campHas('washSluice'))return need(2200,'the long tom & sluice')||'Buy the long tom & sluice (Camp tab).';
  if(!campHas('washPlant'))return need(6500,'the trommel wash plant')||'Buy the trommel wash plant (Camp tab).';
  return quota?`Tonight the Company takes ${quota} gold. Keep the wallet above it and keep digging the rich ground.`:'Keep digging the rich ground.';
}
function updateNextTask(){
  if(!NEXT.el){NEXT.el=document.getElementById('nextTask');if(!NEXT.el)return}
  const show=S.started&&!NEXT.hide&&!S.ko&&!S.inTown&&!(typeof uiOpen==='function'&&uiOpen());
  if(!show){if(!NEXT.el.hidden)NEXT.el.hidden=true;return}
  let t='';try{t=nextTaskText()}catch(e){t=''}
  if(t!==NEXT.last){NEXT.last=t;NEXT.el.querySelector('.v').textContent=t}
  NEXT.el.hidden=!t;
}
setInterval(updateNextTask,500);
addEventListener('keydown',e=>{if(e.key!=='o'&&e.key!=='O')return;const a=document.activeElement;if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'))return;
  if(!S.started||(typeof uiOpen==='function'&&uiOpen())||(typeof consoleOpen==='function'&&consoleOpen()))return;
  NEXT.hide=!NEXT.hide;try{localStorage.setItem('cgl-nexttask-hide',NEXT.hide?'1':'0')}catch(e2){}updateNextTask()});
