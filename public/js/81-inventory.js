'use strict';
/* public/js/81-inventory.js -- the inventory screen (I or Tab; tap the supplies panel / Bag button on touch).
   One place to see everything you're carrying: the finds in your sack, supplies (onions, flashlight,
   water), the gear you've bought, and special items (the KB tube, heavy loot you're hauling).
   It reuses the Supply Depot store's layout and card styles (.shop-*), so it looks like part of the same
   UI, and it only *reads* the existing state (S.sack, S.onions, S.batt, S.up...) and calls the existing
   actions (eatOnion, toggleLight, dropBag): no new save format, nothing new on the wire.
   The game keeps running while it's open, same as the store. */

const INV_CATS=[{id:'all',label:'All'},{id:'sack',label:'Sack'},{id:'supplies',label:'Supplies'},{id:'gear',label:'Gear'}];
const INV_REFRESH_MS=400;   // how often the open screen re-checks state (water drains, finds get added while you dig)
let invOpen=false,invCat='all',invSel=null,invPrevFocus=null,invTimer=null,invSig='';

/* Every entry the screen can show, built fresh from game state each time something changes.
   Each: {id, cat, name, desc, icon | swatch, meta (left, red), state (right, small caps), dim, detail()} */
function invEntries(){
  const out=[];
  // sack finds, grouped by type so six bottle caps are one card, most valuable first
  const counts={};for(const t of S.sack)counts[t]=(counts[t]||0)+1;
  const types=Object.keys(counts).sort((a,b)=>LOOT[b].val-LOOT[a].val);
  for(const t of types){
    const L=LOOT[t],n=counts[t];
    out.push({id:'find:'+t,cat:'sack',type:t,name:L.name,desc:`Find · worth ${L.val} seeds${n>1?' each':''}. Sell it to Mr. Sir at camp.`,
      loot:t,swatch:L.color,meta:`${L.val*n} seeds`,state:n>1?`× ${n}`:'In sack',count:n,val:L.val});
  }
  if(!types.length)out.push({id:'sack:empty',cat:'sack',name:'Empty sack',desc:`Nothing dug up yet. Room for ${sackMax()} finds.`,icon:'sack',meta:'',state:`0 / ${sackMax()}`,dim:true});
  // special items: the KB tube, and heavy loot you're dragging
  if(S.hasKB)out.push({id:'kb',cat:'sack',name:LOOT.kb.name,desc:'Key item. The Warden will want this. Take it to her cabin.',loot:'kb',swatch:LOOT.kb.color,meta:'Key item',state:'Carried'});
  const pr=S.carry!=null&&typeof PROPS!=='undefined'?PROPS.get(S.carry):null;
  if(pr&&pr.type==='cart')out.push({id:'haul',cat:'sack',name:'Wheelbarrow',desc:`The crew's wheelbarrow${(pr.load||[]).length?`, with ${(pr.load||[]).length} thing(s) in it`:''}. Push it to Mr. Sir's pickup to sell what's inside.`,icon:'sack',meta:'',state:'Pushing'});
  else if(pr)out.push({id:'haul',cat:'sack',name:LOOT[pr.type].name,desc:`Too heavy for the sack. Drag it to Mr. Sir's pickup by the main gate: worth ${LOOT[pr.type].val} seeds to the team.`,loot:pr.type,swatch:LOOT[pr.type].color,meta:`${LOOT[pr.type].val} seeds`,state:'Hauling'});
  // supplies
  out.push({id:'onion',cat:'supplies',name:'Raw onion',icon:'onion',art:'gear/onion',desc:'Eat one (Q) and lizards won\'t come near you for 45 seconds.',
    meta:S.onionT>0?`Working: ${Math.ceil(S.onionT)} s left`:'',state:`${S.onions} on hand`,dim:S.onions<=0&&!(S.onionT>0)});
  if(S.tonic>0)out.push({id:'tonic',cat:'supplies',name:'Sam\'s onion tonic',icon:'onion',art:'gear/tonic',desc:'Q when you\'re poisoned, sunburnt or overheated: cures the poison, soothes the rest, and lizards stay off you for 30 s.',meta:'',state:`${S.tonic} on hand`});
  if(S.medkit>0)out.push({id:'medkit',cat:'supplies',name:'First-aid kit',icon:'heart',art:'gear/medkit',desc:'Q when you\'re hurt: patches your injuries. Or hold F on a downed friend: they\'re up in 1 second instead of 3.',meta:'',state:`${S.medkit} on hand`});
  out.push({id:'light',cat:'supplies',name:'Flashlight',icon:'flashlight',art:'gear/flashlight',desc:'Toggle with L. A full battery lasts about 3 minutes; the Supply Depot sells refills.',
    meta:`${Math.round(S.batt)}% battery`,state:S.light?'On':'Off',dim:S.batt<=0});
  out.push({id:'water',cat:'supplies',name:'Water',icon:'water',art:S.up.canteen?'gear/canteen':'gear/water',desc:'Refill at the water truck or from Mr. Sir. Sleeping in your bunk tops it up too.',
    meta:`${Math.round(S.water)} / ${waterMax()}`,state:S.water<waterMax()*0.25?'Low':'Water'});
  // gear from the store: owned ones first, the rest greyed out with where to get them
  const gear=SHOP.filter(it=>!it.stack);
  for(const it of [...gear.filter(g=>S.up[g.id]),...gear.filter(g=>!S.up[g.id])]){
    const own=!!S.up[it.id];
    out.push({id:'gear:'+it.id,cat:'gear',shop:it,name:it.name,icon:it.icon,art:GEAR_ART.has(it.id)?'gear/'+it.id:null,desc:it.desc,meta:own?'':`${it.cost} seeds`,state:own?'In use':'Not owned',dim:!own});
  }
  if(!S.up.spade&&!S.up.long)out.push({id:'shovel',cat:'gear',name:'Camp shovel',icon:'shovel',art:'gear/shovel',desc:'Standard issue. Holes go down to 5 feet.',meta:'',state:'In use'});   // bought shovels show as their own gear cards
  return out;
}
function invVisible(){const all=invEntries();return invCat==='all'?all:all.filter(e=>e.cat===invCat)}

function invSwatch(color){const s=document.createElement('span');s.className='inv-swatch';s.style.background='#'+color.toString(16).padStart(6,'0');return s}
// treasure art: 128px cut-outs in public/icons/loot/<LOOT key>.png (ChatGPT sheet, background removed).
// Falls back to the find's colour dot if an image is missing.
function invLootImg(type,big){
  const img=document.createElement('img');img.className='item-art'+(big?' item-art--lg':'');img.alt='';img.src=`icons/loot/${type}.png`;
  img.onerror=()=>img.replaceWith(invSwatch(LOOT[type].color));return img;
}
function invIconEl(e,big){
  if(e.loot)return invLootImg(e.loot,big);
  if(e.swatch!=null)return invSwatch(e.swatch);
  if(e.art){const span=document.createElement('span');span.innerHTML=itemArtHTML(e.art,big);return span.firstChild}
  const span=document.createElement('span');span.innerHTML=`<svg class="ui-icon${big?' ui-icon--lg':''}"><use href="#icon-${e.icon}"></use></svg>`;return span.firstChild;
}

function buildInvTabs(){
  const box=$('#invTabs');box.textContent='';
  for(const c of INV_CATS){
    const b=document.createElement('button');b.type='button';b.className='shop-tab';b.setAttribute('role','tab');b.id='invtab-'+c.id;b.textContent=c.label;
    const sel=c.id===invCat;b.setAttribute('aria-selected',String(sel));b.tabIndex=sel?0:-1;
    b.onclick=()=>{invCat=c.id;renderInventory(true)};box.appendChild(b);
  }
}
function buildInvGrid(list){
  const grid=$('#invList');grid.textContent='';
  for(const e of list){
    const b=document.createElement('button');b.type='button';b.className='shop-item'+(e.dim?' is-dim':'');b.dataset.item=e.id;
    const sel=e.id===invSel;b.classList.toggle('is-selected',sel);b.setAttribute('aria-pressed',String(sel));b.setAttribute('aria-controls','invDetail');
    const icon=document.createElement('span');icon.className='shop-item__icon';icon.setAttribute('aria-hidden','true');icon.appendChild(invIconEl(e,true));
    const body=document.createElement('span');body.className='shop-item__body';
    const copy=document.createElement('span');copy.className='shop-item__copy';
    const strong=document.createElement('strong');strong.textContent=e.name;
    const small=document.createElement('small');small.textContent=e.desc;
    copy.append(strong,small);
    const meta=document.createElement('span');meta.className='shop-item__meta';
    const price=document.createElement('span');price.className='shop-item__price';price.textContent=e.meta||'';
    const state=document.createElement('span');state.className='shop-item__state';state.textContent=e.state||'';
    meta.append(price,state);body.append(copy,meta);b.append(icon,body);
    b.onclick=()=>{invSel=e.id;renderInventory(false);const el=invCard(e.id);if(el)el.focus()};
    grid.appendChild(b);
  }
}
function invCard(id){return[...$('#invList').children].find(el=>el.dataset.item===id)||null}
function invButton(label,onclick,primary){const b=document.createElement('button');b.type='button';b.className='ui-button '+(primary?'ui-button--primary':'ui-button--quiet');b.textContent=label;b.onclick=onclick;return b}

function renderInvDetail(e){
  const box=$('#invDetailContent');box.textContent='';
  if(!e){const p=document.createElement('p');p.className='shop-empty';p.textContent='Nothing here.';box.appendChild(p);return}
  const h=document.createElement('h3');h.className='shop-detail__title';h.append(invIconEl(e,true),document.createTextNode(e.name));
  const desc=document.createElement('p');desc.className='shop-detail__desc';desc.textContent=e.desc;
  box.append(h,desc);
  const row=(k,v)=>{const w=document.createElement('div');w.className='shop-detail__effect';w.innerHTML=`<span class="k"></span><span class="to"></span>`;w.firstChild.textContent=k;w.lastChild.textContent=v;box.appendChild(w)};
  const acts=document.createElement('div');acts.className='inv-actions';
  if(e.cat==='sack'&&e.type){
    row('Value',`${e.val} seeds${e.count>1?` × ${e.count} = ${e.val*e.count} seeds`:''}`);
    acts.append(invButton(e.count>1?'Drop one here':'Drop it here',()=>invDrop(e.type),false));
  }
  if(e.cat==='sack'&&(e.type||e.id==='sack:empty')){
    const sum=S.sack.reduce((s,t)=>s+LOOT[t].val,0);
    row('Sack',`${S.sack.length} / ${sackMax()} finds · worth ${sum} seeds`);
    if(S.sack.length)acts.append(invButton('Drop the whole sack',()=>{dropBag();toast('You set your sack down. Anyone can pick it up with F.','',2200);sfx.thud();renderInventory(true)},false));
  }
  if(e.type==='jar'||e.type==='sploosh'){   // food: cures hunger (70-player.js eatFood), but then you can't sell it
    const b=invButton(AFF.hunger>4?'Eat it':'Eat it (not hungry)',()=>{eatFood(e.type);renderInventory(true)},AFF.hunger>4);acts.append(b);
    if(AFF.hunger>0)row('Hunger',`${Math.round(AFF.hunger)} of your health bar`);
  }
  if(e.id==='haul')acts.append(invButton('Let go of it',()=>{S.carry=null;toast('You let go.','',1200);renderInventory(true)},false));
  if(e.id==='onion'){
    row('On hand',`${S.onions} onion${S.onions===1?'':'s'}`);
    const b=invButton(S.onions>0?'Eat one now':'No onions left',()=>{eatOnion();renderInventory(true)},true);b.disabled=S.onions<=0;acts.append(b);
  }
  if(e.id==='tonic'||e.id==='medkit'){const need=e.id==='tonic'?(AFF.poison>3||AFF.burn>5||AFF.heat>5):AFF.injury>10;
    const b=invButton(need?'Use one now':'Not needed right now',()=>{useSupply();renderInventory(true)},true);b.disabled=!need;acts.append(b)}
  if(e.id==='light'){
    row('Battery',`${Math.round(S.batt)}%`);
    const b=invButton(S.light?'Turn it off':'Turn it on',()=>{toggleLight();renderInventory(true)},true);b.disabled=!S.light&&S.batt<=0;acts.append(b);
  }
  if(e.id==='water')row('Water',`${Math.round(S.water)} of ${waterMax()}`);
  if(e.shop){
    const eff=shopEffect(e.shop);if(eff)row(eff.label,S.up[e.shop.id]?eff.to:eff.from);
    if(!S.up[e.shop.id])row('Where to get it',`Supply Depot, ${e.shop.cost} seeds`);
  }
  if(acts.children.length)box.appendChild(acts);
}
// drop a single find on the ground as a little sack anyone can pick up (same path as a dropped sack)
function invDrop(type){
  const i=S.sack.indexOf(type);if(i<0)return;S.sack.splice(i,1);
  if(online())wsSend({t:'bag',x:P.x,z:P.z,items:[type]});else addBag(bagSeq++,P.x,P.z,[type],S.name);
  sfx.thud();toast(`Dropped: ${LOOT[type].name}. Pick it back up with F.`,'',2000);renderInventory(true);
}

/* full=true rebuilds tabs + grid + detail; otherwise only what changed. The timer calls it with a state
   signature so it only redraws when something actually changed (and doesn't steal button focus). */
function renderInventory(full){
  if(!invOpen)return;
  const list=invVisible();
  if(!list.some(e=>e.id===invSel))invSel=list[0]?list[0].id:null;
  const sum=S.sack.reduce((s,t)=>s+LOOT[t].val,0);
  $('#invSeeds').textContent=S.seeds;
  $('#invFlavor').textContent=`Sack ${S.sack.length} / ${sackMax()} · worth ${sum} seeds`;
  if(full)buildInvTabs();
  const focusId=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#invList')?document.activeElement.dataset.item:null;
  buildInvGrid(list);
  if(focusId){const el=invCard(focusId);if(el)el.focus()}
  renderInvDetail(list.find(e=>e.id===invSel));
  invSig=invSignature();
}
function invSignature(){return[S.sack.join(','),S.onions,Math.ceil(S.onionT),Math.round(S.batt),S.light,Math.round(S.water),S.seeds,S.hasKB,S.carry,JSON.stringify(S.up)].join('|')}
function invTick(){if(invOpen&&invSignature()!==invSig){const inDetail=$('#invDetail').contains(document.activeElement);renderInventory(false);if(inDetail){const b=$('#invDetail button');if(b)b.focus()}}}

function openInventory(){
  if(invOpen||!S.started)return;
  invOpen=true;releaseLock();invPrevFocus=document.activeElement;$('#inv').hidden=false;
  renderInventory(true);clearInterval(invTimer);invTimer=setInterval(invTick,INV_REFRESH_MS);
  setTimeout(()=>{const el=invSel?invCard(invSel):null;(el||$('#invClose')).focus()},30);
}
function closeInventory(){
  invOpen=false;$('#inv').hidden=true;clearInterval(invTimer);invTimer=null;
  if(invPrevFocus&&document.contains(invPrevFocus))invPrevFocus.focus();invPrevFocus=null;
}
$('#invClose').onclick=closeInventory;

function invMove(key){
  const ids=[...$('#invList').children].map(el=>el.dataset.item),cur=ids.indexOf(invSel);if(!ids.length)return;
  const items=[...$('#invList').children],top0=items[0].offsetTop;let cols=0;for(const it of items){if(it.offsetTop===top0)cols++;else break}cols=Math.max(1,cols);
  let next=cur<0?0:cur;
  if(key==='ArrowRight')next=Math.min(ids.length-1,next+1);else if(key==='ArrowLeft')next=Math.max(0,next-1);
  else if(key==='ArrowDown')next=Math.min(ids.length-1,next+cols);else if(key==='ArrowUp')next=Math.max(0,next-cols);
  invSel=ids[next];renderInventory(false);const el=invCard(invSel);if(el)el.focus();
}
/* keyboard while the inventory is open (called from 55-input.js): I, Tab or Escape close it; arrows move;
   Q still eats an onion. Everything else is swallowed so you don't walk off while reading. */
function invKeydown(e){
  const k=e.key.toLowerCase();
  if(k==='escape'||k==='tab'||k===SETTINGS.binds.inventory){e.preventDefault();closeInventory();return}
  if(k===SETTINGS.binds.onion){e.preventDefault();eatOnion();return}
  if(document.activeElement&&document.activeElement.closest('#invTabs')&&(k==='arrowleft'||k==='arrowright')){
    e.preventDefault();const i=INV_CATS.findIndex(c=>c.id===invCat),n=INV_CATS.length;invCat=INV_CATS[(i+(k==='arrowright'?1:-1)+n)%n].id;renderInventory(true);$('#invtab-'+invCat).focus();return}
  if(document.activeElement&&document.activeElement.classList.contains('shop-item')&&k.startsWith('arrow')){e.preventDefault();invMove(e.key)}
}
$('#hudSupplies').addEventListener('click',()=>{if(S.started&&!uiOpen())openInventory()});
