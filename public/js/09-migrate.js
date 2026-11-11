'use strict';
/* public/js/09-migrate.js -- carry a browser's saved game across the 2026-11 identifier rename (docs/STORY.md).
   Until then the ids in the code were the old setting's ("sploosh", "onions", "hasKB", "curse"...). The code now
   uses the DRYWATER ids everywhere, so anything this browser saved before has to be renamed once, here, before any
   other script reads it. This is the ONLY client file that still spells the old ids, and only as the left-hand
   side of these maps. One-way and safe to run on every load: each step only acts when it finds an old name, and a
   save it cannot read is left alone (the loaders already ignore what they do not recognise).
     session save (cgl-session): sack item ids, S.onions -> S.bitterroots, S.hasKB -> S.hasLM
     solo run (cgl-run):         curse -> badluck
     badges (cgl-meta):          badge ids and the counters behind them
     solo crew kits (cgl-crew):  onions -> bitterroots
     moved sliders (cgl-tune):   curse.* -> badluck.*, ro.sheriffWin -> ro.marshalWin
     key bindings (cgl-settings): binds.onion -> binds.bitterroot
   Must stay the first of the js/ files in index.html (11-tune.js reads its sliders as it loads). */
(function(){
  const ITEM={sploosh:'shine',lipstick:'matchsafe',sneakers:'oldboots',kb:'lmcase',suitcase:'lilstrongbox'};
  const BADGE={caveman:'shovelhead',magnet:'stickyfingers',squid:'punchingbag',barfbag:'loosehips',stanley:'lucky',clyde:'bootfall',onion:'bitterroot',sploosh:'shine'};
  const COUNT={onions:'bitterroots',clyde:'bootfall'};
  const tuneKey=k=>k==='ro.sheriffWin'?'ro.marshalWin':k.replace(/^curse\./,'badluck.');
  const move=(o,from,to)=>{if(!o||typeof o!=='object'||!(from in o))return false;if(!(to in o))o[to]=o[from];delete o[from];return true};
  const rekey=(o,map)=>{let n=false;if(o&&typeof o==='object')for(const k of Object.keys(o)){const t=typeof map==='function'?map(k):map[k];if(t&&t!==k)n=move(o,k,t)||n}return n};
  function fix(store,key,fn){
    try{const raw=store.getItem(key);if(!raw)return;const o=JSON.parse(raw);if(!o||typeof o!=='object')return;if(fn(o))store.setItem(key,JSON.stringify(o))}catch(e){}
  }
  fix(sessionStorage,'cgl-session',o=>{
    const s=o.S;if(!s||typeof s!=='object')return false;
    let n=move(s,'onions','bitterroots');n=move(s,'hasKB','hasLM')||n;
    if(Array.isArray(s.sack)&&s.sack.some(t=>ITEM[t])){s.sack=s.sack.map(t=>ITEM[t]||t);n=true}
    return n});
  fix(sessionStorage,'cgl-run',o=>move(o,'curse','badluck'));
  fix(localStorage,'cgl-meta',o=>{const a=rekey(o.badges,BADGE),b=rekey(o.cnt,COUNT);return a||b});
  fix(localStorage,'cgl-crew',o=>{let n=false;for(const who of Object.keys(o))n=move(o[who],'onions','bitterroots')||n;return n});
  fix(localStorage,'cgl-tune',o=>rekey(o,tuneKey));
  fix(localStorage,'cgl-settings',o=>move(o.binds,'onion','bitterroot'));
})();
