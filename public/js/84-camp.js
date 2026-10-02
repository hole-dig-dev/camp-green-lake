'use strict';
/* public/js/84-camp.js -- camp upgrades (JT 2026-10-01): things the whole crew owns, bought from the one crew wallet at
   the Supply Depot (the store's Camp category) and kept on the server (world.camp; gone when the crew's fired):
     goldScale   +10% gold from every sift (yours, the crew's, the pan, the hopper, the pipeline): a brass scale by the
                 sifter's catch pan (GoldScale.glb, in the sifter's frame)
     pipeTee     branch the sand pipeline: F at any joint, or another line out of the sifter (88-pipeline.js)
     pipePump    sand rides the pipeline 2.5x faster (PipePump.glb on the first run)
     pipeSteel   reinforced pipe: nothing cracks it any more (PipeSectionSteel.glb)
     sodaMachine a soda vending machine by the water drums: the crew take soda breaks (88-morale.js; SodaMachine.glb)
   A purchase goes through walletSpend (84-spend.js) and 'campBuy'; the server answers with everyone's 'camp'. */
const CAMP={};
const campHas=k=>!!CAMP[k];
const goldScale=()=>campHas('goldScale')?1.1:1;
let CAMP_SCALE=null,CAMP_SODA=null;const SODA_AT={x:5.6,z:34.2,ry:Math.PI};   /* by the water drums, facing the yard */
function campSet(c){for(const k of Object.keys(CAMP))delete CAMP[k];if(c&&typeof c==='object')for(const k in c)if(c[k]===true||(typeof c[k]==='number'&&Number.isFinite(c[k])))CAMP[k]=c[k];   /* numbers: the soda machine's stock */
  if(typeof PIPE!=='undefined')PIPE.dirty=true;campLook();if(typeof renderShop==='function'&&shopOpen)renderShop()}
function campLook(){
  if(campHas('sodaMachine')&&!CAMP_SODA){CAMP_SODA=true;solid(SODA_AT.x,SODA_AT.z,0.9,0.8);placeModel('SodaMachine',{x:SODA_AT.x,y:baseH(SODA_AT.x,SODA_AT.z),z:SODA_AT.z,ry:SODA_AT.ry}).then(m=>{CAMP_SODA=m||true}).catch(()=>{})}
  if(campHas('goldScale')&&!CAMP_SCALE){const G=SIM.GOLD.SIFTER;CAMP_SCALE=true;placeModel('GoldScale',{x:G.x,y:baseH(G.x,G.z),z:G.z,ry:G.ry||0}).then(m=>{CAMP_SCALE=m||true}).catch(()=>{CAMP_SCALE=null})}
  if(!campHas('goldScale')&&CAMP_SCALE&&CAMP_SCALE!==true){CAMP_SCALE.parent&&CAMP_SCALE.parent.remove(CAMP_SCALE);CAMP_SCALE=null}
}
function campBuy(it){
  const rid=walletSpend(it.cost,()=>{delete CAMP[it.id];campLook()},it.name);CAMP[it.id]=true;campLook();if(typeof PIPE!=='undefined')PIPE.dirty=true;
  if(online())wsSend({t:'campBuy',id:it.id,cost:it.cost,rid});else try{localStorage.setItem('cgl-camp-up',JSON.stringify(CAMP))}catch(e){}
}
if(!online())try{campSet(JSON.parse(localStorage.getItem('cgl-camp-up')||'{}'))}catch(e){}
/* ---- stocking the soda machine (JT 2026-10-01): walk up to it, F loads it. Your own sodas go in first (free), then
   SODA_LOAD more bought from the crew wallet at the shop price. Each crew soda break takes one (88-morale.js). ---- */
const SODA_LOAD=5;
const sodaStock=()=>CAMP.sodaStock|0;
function sodaSpot(){
  if(!campHas('sodaMachine')||!S.started||inTent()||S.inTown)return null;
  if((P.x-SODA_AT.x)**2+(P.z-SODA_AT.z)**2>2.2*2.2)return null;
  const mine=S.soda|0,cost=SODA_LOAD*15,n=sodaStock();
  return{id:'soda',label:mine>0?`Stock the soda machine with your ${mine} soda${mine>1?'s':''} (${n} in it)`:`Stock the soda machine: ${SODA_LOAD} sodas for ${cost} gold (${n} in it)`,use:sodaStockUp};
}
function sodaStockUp(){
  const mine=S.soda|0;
  if(mine>0){S.soda=0;sodaAdd(mine,0);toast(`You load your ${mine} soda${mine>1?'s':''} into the machine. ${sodaStock()} in it.`,'good',2600);return}
  const cost=SODA_LOAD*15;if(S.seeds<cost){toast(`${cost} gold for ${SODA_LOAD} sodas. The crew wallet's short.`,'bad',2600);return}
  if(quotaShort(cost)>0&&!(sodaStockUp.warnT&&performance.now()-sodaStockUp.warnT<5000)){sodaStockUp.warnT=performance.now();toast(quotaWarnText(cost)+' Press F again to stock it anyway.','bad',3500);return}
  sodaStockUp.warnT=0;const rid=walletSpend(cost,()=>{CAMP.sodaStock=Math.max(0,sodaStock()-SODA_LOAD)},'sodas for the machine');sodaAdd(SODA_LOAD,rid);sfx.coin();
  toast(`${SODA_LOAD} sodas into the machine (${cost} gold). ${sodaStock()} in it.`,'good',2600);
}
function sodaAdd(n,rid){CAMP.sodaStock=sodaStock()+n;logEv('sodaStock',{n});if(online())wsSend({t:'sodaStock',n,rid});else try{localStorage.setItem('cgl-camp-up',JSON.stringify(CAMP))}catch(e){}}
function sodaTake(){CAMP.sodaStock=Math.max(0,sodaStock()-1);if(online()){if(crewPaysHere())wsSend({t:'sodaTake'})}else try{localStorage.setItem('cgl-camp-up',JSON.stringify(CAMP))}catch(e){}}
