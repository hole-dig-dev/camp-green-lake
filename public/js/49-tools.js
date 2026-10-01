'use strict';
/* public/js/49-tools.js -- earning your tools, and the crew wallet (Greg's gold-dig pivot, 2026-09-30;
   docs/plans/2026-09-30-gold-dig-design.md).
   - You start with bare hands: E scrapes up a handful of dirt and you pick through it for anything you can see.
   - The crew wallet: S.seeds IS the crew's money (RUN.bank, the server's world.run.bank). Selling to Mr. Sir fills it,
     the Warden takes her quota out of it at curfew, and every purchase comes out of it. Any "S.seeds += n" anywhere in
     the game (a finished hole, blackjack, the KB reward) is a change to the crew wallet, sent to the server as a delta.
   - Tools (SIM.TOOLS: gold pan, bucket, shovel) are real objects bought from the crew wallet at the Supply Depot,
     dearer the bigger the crew. One appears on the ground in front of the window per purchase. F picks one up (one of
     each kind at a time), Z puts down the last one you picked up. Leave the game and yours stay where you stood.
   - A pan or a bucket carries dirt (S.load): what you dig or scrape goes in it instead of on the pile, while there's
     room. At the water truck (F, with a pan) you wash it: the fine gold your eyes can't see (48-gold.js fineGold)
     comes out into your pouch. A pan-load takes PAN_T seconds; a bucket is five of them. */
const HAND_DEPTH=0.45;      // m: as deep as you can scrape with your hands (about a foot and a half)
const PAN_T=8;              // s to wash one pan-load (4 L) at the water truck
const PAN_SPOT={x:7.3,z:38.2,r:2.4};   // by the water truck's tap (20-world.js: the truck at 5,36 turned side-on)
const TOOL_PICK_R=2.2;
const digTime=()=>tune(hasTool('shovel')?'dig.time':'dig.handTime');   // s per shovelful, or per handful      // m: how close to a tool on the ground F picks it up

/* ---- the crew wallet ---- */
function walletAdd(d){
  d=Math.round(d);if(!d)return;
  if(online()){wsSend({t:'wallet',d});RUN.bank=Math.max(0,RUN.bank+d)}   // the server's number comes back in the next 'run'
  else{RUN.bank=Math.max(0,RUN.bank+d);saveRun()}
}
// (RUN is declared later, in 84-coop.js: until that script has run, there's no wallet yet)
Object.defineProperty(S,'seeds',{get(){return typeof RUN==='undefined'?0:RUN.bank},set(v){if(typeof RUN!=='undefined')walletAdd(num(v,-1e7,1e7,RUN.bank)-RUN.bank)},enumerable:true});

/* ---- the crew's tools ---- */
const TOOLS_W=new Map();    // id -> {id,k,x,z,h,g}: h = the holder's id (0: on the ground)
const toolMe=()=>online()?net.id:1;   // whose hands: this camper's id (82-patrol.js has its own myId for something else)
let toolOrder=[];           // the tools you hold, in the order you picked them up (Z puts the last one down)
function hasTool(k,who){const id=who==null?toolMe():who;for(const t of TOOLS_W.values())if(t.h===id&&t.k===k)return t;return null}
const toolCap=()=>(hasTool('pan')?SIM.TOOLS.pan.L:0)+(hasTool('bucket')?SIM.TOOLS.bucket.L:0);   // litres you can carry
function toolMesh(k){
  const g=new T.Group();
  if(k==='pan'){const p=cyl(0.24,0.17,0.07,14,0x6d6a63);p.position.y=0.04;g.add(p)}
  else if(k==='bucket'){const b=cyl(0.17,0.13,0.3,12,0x8d949a);b.position.y=0.15;const h=new T.Mesh(new T.TorusGeometry(0.15,0.01,4,12,Math.PI),M(0x555555));h.position.y=0.3;g.add(b,h)}
  else{const hd=cyl(0.028,0.028,1.2,5,0x8a6440);hd.rotation.z=Math.PI/2;hd.position.set(-0.2,0.05,0);const bl=box(0.3,0.03,0.24,0x7d8288);bl.position.set(0.5,0.03,0);g.add(hd,bl)}
  scene.add(g);return g;
}
function setTools(list){
  const seen=new Set();
  for(const o of(Array.isArray(list)?list:[]).slice(0,80)){
    const id=num(o.id,0,1e6,-1)|0,k=String(o.k);if(id<0||!SIM.TOOLS[k])continue;seen.add(id);
    let t=TOOLS_W.get(id);if(!t){t={id,k,g:toolMesh(k)};TOOLS_W.set(id,t)}
    t.x=num(o.x,-600,600,0);t.z=num(o.z,-600,600,0);t.h=num(o.h,0,1e9,0)|0;
    t.g.visible=!t.h;t.g.position.set(t.x,groundAt(t.x,t.z),t.z);
  }
  for(const[id,t]of TOOLS_W)if(!seen.has(id)){scene.remove(t.g);TOOLS_W.delete(id)}
  toolOrder=toolOrder.filter(id=>{const t=TOOLS_W.get(id);return t&&t.h===toolMe()});
  for(const t of TOOLS_W.values())if(t.h===toolMe()&&!toolOrder.includes(t.id))toolOrder.push(t.id);
  if(S.load.L>toolCap()){S.load.L=toolCap();if(!toolCap())S.load.g=0}
}
function toolNear(r){let best=null,bd=r*r;for(const t of TOOLS_W.values()){if(t.h)continue;const d2=(t.x-P.x)**2+(t.z-P.z)**2;if(d2<bd){bd=d2;best=t}}return best}
function takeTool(t){
  if(hasTool(t.k)){toast(`You've already got a ${SIM.TOOLS[t.k].name.toLowerCase()}.`,'',1800);return}
  if(online())wsSend({t:'toolTake',id:t.id});else{t.h=toolMe();setTools([...TOOLS_W.values()])}
  sfx.clank();logEv('toolTake',{k:t.k});
}
function dropTool(){
  const id=toolOrder[toolOrder.length-1],t=TOOLS_W.get(id);if(!t){toast('You\'re not holding any tools.','',1500);return}
  const x=P.x+Math.sin(P.fa)*0.8,z=P.z+Math.cos(P.fa)*0.8;
  if(online())wsSend({t:'toolDrop',id,x,z});else{t.h=0;t.x=x;t.z=z;setTools([...TOOLS_W.values()])}
  toast(`You put down the ${SIM.TOOLS[t.k].name.toLowerCase()}.`,'',1500);logEv('toolDrop',{k:t.k});
}
function buyTool(k){
  const cost=SIM.toolCost(k,remotes.size+1);
  if(S.seeds<cost){toast(`The crew needs ${fmtG(cost)} of gold for a ${SIM.TOOLS[k].name.toLowerCase()}. It has ${fmtG(S.seeds)}.`,'bad',3000);return false}
  if(online())wsSend({t:'buyTool',k});
  else{RUN.bank-=cost;saveRun();const id=1+Math.max(0,...TOOLS_W.keys());setTools([...TOOLS_W.values(),{id,k,x:15.5+(Math.random()-0.5)*1.6,z:38.6,h:0}]);toolBoughtMsg({k,n:S.name,cost})}
  return true;
}
function toolBoughtMsg(m){const k=String(m.k);if(!SIM.TOOLS[k])return;sfx.coin();toast(`${cleanName(m.n)||'The crew'} bought a ${SIM.TOOLS[k].name.toLowerCase()} (${fmtG(num(m.cost,0,1e6,0)|0)} of the crew's gold). It's on the ground at the Supply Depot window.`,'gold',5000)}
/* server messages (65-net.js) */
function toolsMsg(m){
  if(m.t==='tools')setTools(m.tools);
  else if(m.t==='toolBought')toolBoughtMsg(m);
  else if(m.t==='toolNo')toast(`Not enough gold: that costs ${fmtG(num(m.cost,0,1e6,0)|0)}, and the crew has ${fmtG(num(m.bank,0,1e7,0)|0)}.`,'bad',3500);
}

/* ---- carrying dirt, and washing it at the water truck ---- */
let panT=0,panTold=0;
/* called from scoop() (45-state.js) with every handful or shovelful: into your pan or bucket if there's room */
function loadDirt(h,litres){
  const room=toolCap()-S.load.L;if(room<=0)return false;
  const l=Math.min(room,litres);S.load.L+=l;S.load.g+=l*fineGold(h.x,h.z,h.d);
  if(S.load.L>=toolCap()-0.01&&performance.now()-panTold>20000){panTold=performance.now();toast(hasTool('bucket')?'Your bucket is full. Carry it to the water truck in camp and pan it (F).':'Your pan is full of dirt. Carry it to the water truck in camp and wash it (F).','',4000)}
  return true;
}
const panLabel=()=>!hasTool('pan')?'Water truck: you need a gold pan to wash dirt here (Supply Depot)':S.load.L<=0?'Water truck: fill your pan with dirt out on the lake first':panT>0?`Washing… ${Math.round(S.load.L)} L of dirt left`:`Pan your dirt (${Math.round(S.load.L)} L, about ${Math.max(1,Math.ceil(S.load.L/SIM.TOOLS.pan.L))} pan-loads)`;
SPOTS.push({id:'pan',x:PAN_SPOT.x,z:PAN_SPOT.z,r:PAN_SPOT.r,get label(){return panLabel()},use(){
  if(!hasTool('pan')){toast('You need a gold pan to wash dirt. The Supply Depot sells them, if the crew can afford one.','',3200);return}
  if(S.load.L<=0){toast('Nothing to wash. Scrape or dig some dirt into your pan out on the lake bed.','',2600);return}
  if(panT<=0){panT=tune('gold.panTime');sfx.splash();logEv('panStart',{L:+S.load.L.toFixed(1)})}}});
function updateTools(dt){
  if(!S.started)return;
  // who's holding a shovel shows one in their hands (25-people.js reads o.shovel)
  if(me&&me.o)me.o.shovel=!!hasTool('shovel');
  for(const[id,R]of remotes)if(R.p&&R.p.o)R.p.o.shovel=!!hasTool('shovel',id);
  if(panT>0){
    const at=(P.x-PAN_SPOT.x)**2+(P.z-PAN_SPOT.z)**2<(PAN_SPOT.r+0.6)**2;
    if(!at||S.ko||!hasTool('pan')||S.load.L<=0){panT=0;return}
    panT-=dt;
    if(panT<=0){   // one pan-load washed
      const l=Math.min(SIM.TOOLS.pan.L,S.load.L),g=S.load.g*(l/S.load.L);
      S.load.L-=l;S.load.g-=g;if(S.load.L<0.01){S.load.L=0;S.load.g=0}
      addGold(g);sfx.splash();if(g>=0.5)sfx.find();
      toast(g>=0.5?`You swirl the pan: ${(g/100).toFixed(3)} g of fine gold settles out. The crew has ${fmtG(S.seeds)}.`:'You swirl the pan. Mud, sand, a few specks of nothing much.',g>=0.5?'good':'',2600);
      logEv('pan',{L:+l.toFixed(1),g:+g.toFixed(2),crew:S.seeds});
      if(S.load.L>0)panT=tune('gold.panTime');   // straight on to the next pan-load
    }
  }
}
addEventListener('DOMContentLoaded',()=>command('tool',{   // registered once every script has loaded (the console is 76-console.js)
usage:'tool <pan|bucket|shovel>',help:'Testing: put a free tool at your feet and pick it up (no cost).',host:true,
  run([k]){if(!SIM.TOOLS[k])throw new Error('Usage: tool pan|bucket|shovel');
    if(online()){const before=new Set(TOOLS_W.keys());wsSend({t:'wallet',d:SIM.toolCost(k,remotes.size+1)});setTimeout(()=>wsSend({t:'buyTool',k}),150);   // paid for by a free top-up, so the wallet comes out even
      let n=0;const grab=()=>{const t=[...TOOLS_W.values()].find(o=>o.k===k&&!o.h&&!before.has(o.id));if(t){wsSend({t:'toolTake',id:t.id});return}if(++n<40)setTimeout(grab,250)};setTimeout(grab,300);
      return`A free ${k}: it'll be in your hands in a moment.`}
    const id=1+Math.max(0,...TOOLS_W.keys());setTools([...TOOLS_W.values(),{id,k,x:P.x,z:P.z,h:toolMe()}]);return`You've got a ${k}.`}}));
