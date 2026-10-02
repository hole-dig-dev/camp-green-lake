'use strict';
/* public/js/84-spend.js -- spending the one crew wallet safely, and who found the gold (JT 2026-10-01, on Greg's
   84-wallet.js). Loads after 84-wallet.js.
   - walletSpend(cost, undo, label): a purchase. The server checks the crew wallet still covers it at that moment
     (server.js 'wallet' with spend): two campers buying at once from a wallet that only covers one, the second is
     turned down ('walletNo') and undo() puts their purchase back. A message sent with the same rid (crewBuy) is then
     ignored by the server too.
   - quotaShort(cost): how far a spend would leave the wallet under tonight's quota (0: it doesn't). The store's confirm
     panel, the crew tab's "Sure?" and the blackjack table say so before you spend the crew's quota.
   - foundGold(v): gold you brought in (dug, panned, sifted, hopper, pipeline, sold, hauled, the gold tube). Tallied per
     camper (and per crew member, from their deposits) on the server and read out at curfew: "Found today". */
const SPEND={rid:0,pending:new Map()};
function walletSpend(cost,undo,label){
  cost=Math.round(cost);if(!(cost>0))return 0;
  const rid=++SPEND.rid;RUN.bank=Math.max(0,RUN.bank-cost);
  if(online()){wsSend({t:'wallet',d:-cost,spend:1,rid});SPEND.pending.set(rid,{undo,label,t:performance.now()});setTimeout(()=>SPEND.pending.delete(rid),15000)}
  else saveRun();
  return rid;
}
function walletNo(m){
  const p=SPEND.pending.get(m.rid);if(!p)return;SPEND.pending.delete(m.rid);
  try{p.undo&&p.undo()}catch(e){}
  toast(`Someone on the crew spent that gold first: ${p.label||'that'} wasn't bought.`,'bad',4000);logEv('walletNo',{label:p.label||''});
  if(typeof renderShop==='function'&&shopOpen)renderShop();
}
const quotaShort=cost=>Math.max(0,RUN.quota-(RUN.bank-cost));
const safeToSpend=()=>Math.max(0,RUN.bank-RUN.quota);
function quotaWarnText(cost){const s=quotaShort(cost);return s>0?`This leaves the crew ${s} short of tonight's quota (${RUN.quota}).`:''}
/* found today: mine for the HUD/log, the server keeps everyone's */
const FOUND={mine:0};
function foundGold(v){v=Math.round(v);if(!(v>0))return;FOUND.mine+=v;if(online())wsSend({t:'found',v});else{RUN.found=RUN.found||{};RUN.found[S.name]=(RUN.found[S.name]||0)+v}}
function foundLine(f){const e=Object.entries(f||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);return e.length?'Found today: '+e.map(([n,v])=>`${n} ${v}`).join(' · '):''}
