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
function campSet(c){for(const k of Object.keys(CAMP))delete CAMP[k];if(c&&typeof c==='object')for(const k in c)if(c[k]===true)CAMP[k]=true;
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
