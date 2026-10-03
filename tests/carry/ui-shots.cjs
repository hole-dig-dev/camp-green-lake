// screenshots of every menu, tab and inventory screen, with a mid-game state (not pass/fail).
// bash tests/carry/run.sh PORT OUT ui-shots.cjs  -> OUT/ui-NN-name.png
const {browser,player}=require('./lib2.cjs');const PORT=process.argv[2],SP=process.argv[3];
(async()=>{const b=await browser(),errs=[];const A=await player(b,PORT,'Alpha',errs);await A.setViewportSize({width:1440,height:900});
let n=0;const shot=async(name,wait=500)=>{await A.waitForTimeout(wait);const f=`${SP}/ui-${String(++n).padStart(2,'0')}-${name}.png`;await A.screenshot({path:f});console.log(f)};
const esc=async()=>{await A.keyboard.press('Escape');await A.waitForTimeout(300)};
await A.evaluate(()=>{tuneSet('haz.all',0);runCommand('time 10:30');runCommand('crew hire all');GOD=true});await A.waitForTimeout(800);
await A.evaluate(()=>{runCommand('crew kit all shovel bucket2');runCommand('crew kit Zach spade bucket3 pack3 canteen');runCommand('kit shovel bucket2 pack canteen hopper dog disarm hoverShoes');
  runCommand('campup goldScale sodaMachine pipeTee');runCommand('bank 640');runCommand('pipe 3,36 0,31 0,20');
  const L=Object.keys(LOOT).filter(k=>k!=='kb'&&!SIM.HEAVY[k]).slice(0,5);S.sack=[L[0],L[0],L[1],L[2],L[3]];S.onions=3;S.soda=2;S.medkit=1;S.dynamite=2;S.pipe=4;S.bucket=6.4;
  P.x=4;P.z=10;P.y=groundAt(4,10);if(FP)toggleView();P.yaw=Math.PI;P.pitch=0.3});
await A.waitForTimeout(3000);
await shot('hud',1200);
await A.evaluate(()=>setCrewPanelMin(true));await shot('hud-crew-minimized');await A.evaluate(()=>setCrewPanelMin(false));
await A.evaluate(()=>openFieldMap());await shot('field-map',900);await esc();
for(const c of ['all','sack','supplies','gear']){await A.evaluate(c=>{if(!invOpen)openInventory();invCat=c;renderInventory(true)},c);await shot('inventory-'+c)}
await esc();
await A.evaluate(()=>openShop());
for(const c of ['all','dig','survival','supplies','camp']){await A.evaluate(c=>{setShopMode('me');setShopCategory(c)},c);await shot('store-'+c)}
await A.evaluate(()=>{setShopCategory('dig');selectShopItem('pack2');openShopConfirm('pack2')});await shot('store-confirm');await A.evaluate(()=>hideShopConfirm());
await A.evaluate(()=>setShopMode('crew'));await shot('store-crew');
await A.evaluate(()=>{const g=document.querySelector('#crewShop');if(g)g.scrollTop=g.scrollHeight});await shot('store-crew-scrolled');
await esc();await A.evaluate(()=>{if(shopOpen)closeShop()});
await A.evaluate(()=>{const z=bots.find(b=>b.d.n==='Zach');openDialog('bot',z)});await shot('dialog-crew');await A.evaluate(()=>closeDialog());
await A.evaluate(()=>{try{openCards()}catch(e){}});await shot('blackjack');await A.evaluate(()=>{try{closeCards()}catch(e){$('#cards').hidden=true;BJ.open=false}});
await A.evaluate(()=>openWardrobe());await shot('wardrobe',1500);await esc();await A.evaluate(()=>{if(WARD.open)closeWardrobe()});
await A.evaluate(()=>openPause());await shot('pause');
for(const [btn,name] of [['#pOptions','pause-options'],['#pControlsBtn','pause-controls'],['#pBadgesBtn','pause-badges']]){await A.click(btn);await shot(name);await A.evaluate(()=>{for(const id of['#pOptBack','#pCtrlBack','#pBadgesBack']){const e=document.querySelector(id);if(e&&e.offsetParent)e.click()}})}
await A.evaluate(()=>{if(PAUSE.open)closePause()});await A.waitForTimeout(300);
await A.evaluate(()=>openTune());
for(const t of await A.evaluate(()=>TUNE_TABS)){await A.evaluate(t=>{tuneTab=t;renderTune()},t);await shot('f2-'+t.toLowerCase(),250)}
await esc();await A.evaluate(()=>{if(tuneOpen())closeTune()});
await A.evaluate(()=>{openConsole();runCommand('help')});await shot('console');await A.evaluate(()=>closeConsole());
await A.evaluate(()=>{try{toggleAdmin()}catch(e){}});await shot('admin-panel',900);await A.evaluate(()=>{const e=$('#admin');if(e)e.hidden=true});
await A.evaluate(()=>openChat());await shot('chat');await esc();
console.log('errors:',errs.join(' | ')||'none');await b.close()})();
