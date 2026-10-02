'use strict';
/* public/js/84-wallet.js -- one crew wallet (Greg, 2026-10-01): nobody has their own gold any more. S.seeds IS the crew
   bank (RUN.bank, the server's world.run.bank), so every camper sees the same number, spends from it and adds to it.
   Any "S.seeds += n" / "S.seeds -= cost" anywhere in the game (a fleck, a sifted bucket, the store, blackjack, selling
   to Pendanski, the KB reward) becomes a change to the crew wallet, sent to the server as a 'wallet' delta. The Warden
   still takes her quota out of it at curfew, so spending is a crew decision. Depositing is gone: there's nothing to
   deposit. Load order: after 84-coop.js, which declares RUN. */
function walletAdd(d){
  d=Math.round(d);if(!d)return;
  RUN.bank=Math.max(0,RUN.bank+d);   // show it straight away; online, the server's number comes back in the next 'run'
  if(online())wsSend({t:'wallet',d});else saveRun();
}
Object.defineProperty(S,'seeds',{get(){return RUN.bank},set(v){walletAdd(num(v,-1e9,1e9,RUN.bank)-RUN.bank)},enumerable:true});
