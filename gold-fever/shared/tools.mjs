// Engine-neutral hand excavation profiles. Purchases are personal; never trust a client tier.
export const MINING_TOOLS = [
  {id:'starter',name:'Starter shovel',radius:1.6,verticalRadius:1.1,advance:.4,mass:12,cooldown:1000,pull:42,plantMs:140},
  {id:'minerpick',name:"Miner's pick",radius:1.8,verticalRadius:1.2,advance:.75,mass:14,cooldown:650,pull:32,plantMs:110},
  {id:'mattock',name:'Pick-mattock',radius:2,verticalRadius:1.35,advance:1.1,mass:18,cooldown:550,pull:26,plantMs:100},
  {id:'tunnelpick',name:'Heavy tunnelling pick',radius:2.15,verticalRadius:1.5,advance:1.4,mass:24,cooldown:450,pull:22,plantMs:90}
];
export function miningTool(p,selected=p.input?.tool){
  if(selected==='pick')for(let i=MINING_TOOLS.length-1;i>0;i--)if(p.upgrades?.includes(MINING_TOOLS[i].id))return MINING_TOOLS[i];
  return {...MINING_TOOLS[0],name:p.upgrades?.includes('shovel')?'Steel shovel':'Starter shovel',cooldown:p.upgrades?.includes('shovel')?650:1000};
}
export function handGesture(p,selected=p.input?.tool){return p.shovelPlant?.mine||selected==='pick'?miningTool(p,selected):{pull:42,plantMs:140};}
